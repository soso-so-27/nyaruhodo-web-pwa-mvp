import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CAT_PHOTOS_BUCKET,
  getDataUrlExtension,
  getStoragePhotoPath,
  isUsablePhotoSrc,
  sanitizePathSegment,
  toStoragePhotoUrl,
  uploadDataUrl,
} from "../../../../lib/photoStorage";
import {
  buildSleepingDeliveryIpRateLimitKey,
  buildSleepingDeliveryRateLimitKey,
  checkExchangeRateLimit,
  type SleepingDeliveryValidationResult,
  validateOwnPhotoSrc,
  validateOwnStoragePhotoPathAccess,
} from "../../../../lib/home/sleepingDeliveryRequestGuards";
import { getAuthenticatedUserForRequest } from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { createServerSupabaseClient } from "../../../../lib/supabase/server";
import type { ExchangePhoto } from "../../../../lib/home/sleepingPhotos";
import {
  isBlockedDeliveryPhotoUrl,
  isBlockedDeliveryPoolRow,
} from "../../../../lib/home/deliveryPoolGuards";
import {
  getServerJstDateKey,
  isServerDateKey,
  validateServerDeliveryDateKey,
} from "../../../../lib/home/eveningDeliveryServer";
import { isOnboardingResumeToken } from "../../../../lib/onboarding/submissionContract";
import {
  createOnboardingJourneySubmissionId,
  createOnboardingOwnPhotoId,
  isOnboardingJourneyId,
} from "../../../../lib/onboarding/journeyContract";
import { advanceOnboardingSubmission } from "../../../../lib/server/onboardingSubmissionLedger";

export const dynamic = "force-dynamic";

type ExchangeRequest = {
  ownPhoto?: {
    id?: string;
    catId?: string;
    ownerCatId?: string;
    src?: string;
    createdAt?: number;
    triggerLabel?: string;
    theme?: string;
    shared?: boolean;
  };
  triggerLabel?: string;
  theme?: string;
  category?: string;
  seed?: string;
  deliveryDateKey?: string | null;
  recipientCatId?: string | null;
  anonymousId?: string | null;
  blockedPhotoIds?: string[];
  preferredSourcePhotoId?: string | null;
  requestedCandidateCount?: number | null;
  capability?: string | null;
  debugDryRun?: boolean;
  mode?: "onboarding" | null;
  onboardingSubmission?: {
    dateKey?: string | null;
    journeyId?: string | null;
    resumeToken?: string | null;
    source?: string | null;
    submissionId?: string | null;
  } | null;
};

type RemoteCatMomentRow = {
  id: string;
  user_id: string | null;
  anonymous_id: string | null;
  local_moment_id: string;
  local_cat_id: string;
  owner_cat_id: string;
  photo_url: string;
  visibility?: "private" | "shared";
  delivery_status: "available" | "hidden" | "reported";
  moderation_status?: "pending" | "approved" | "rejected";
  pool_date?: string | null;
  delivery_count?: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type FastStockCandidateRow = Omit<RemoteCatMomentRow, "photo_url">;

type RemoteDeliveryRow = {
  id: string;
  local_delivery_id: string;
  source_moment_id: string | null;
  source_photo_id: string | null;
  recipient_local_cat_id: string | null;
  photo_url: string;
  status: string;
  metadata: Record<string, unknown> | null;
  delivered_at: string;
};

type Candidate = {
  row: RemoteCatMomentRow;
  src: string;
  tags: string[];
  tier: DeliveryTier;
};

type DeliveryTier = 1 | 2 | 3;

type ExchangeRequestParseResult =
  | { ok: true; input: Required<ExchangeRequest> }
  | {
      ok: false;
      status: 400 | 413;
      error: "invalid_json" | "invalid_exchange_request" | "payload_too_large";
    };

const MAX_JSON_BODY_LENGTH = 3 * 1024 * 1024;
const MAX_BLOCKED_PHOTO_IDS = 100;
const MAX_ID_LENGTH = 160;
const MAX_TEXT_LENGTH = 120;
const MIN_CREATED_AT = Date.UTC(2020, 0, 1);
const MAX_CREATED_AT_FUTURE_DRIFT_MS = 24 * 60 * 60 * 1000;
const FAST_STORAGE_CANDIDATE_LIMIT = 80;
const FAST_STORAGE_CANDIDATE_PROBE_LIMIT = 12;
const TIERED_CANDIDATE_LIMIT = 240;
const TRANSIENT_DELIVERY_SIGNED_URL_SECONDS = 10 * 60;
const EVENING_CHOICE_CAPABILITY = "evening_choice_v1";
const EVENING_CHOICE_REQUESTED_COUNT = 4;
const EVENING_CHOICE_MAX_COUNT = 4;
type FastCandidateMode = "admin_storage" | "tiered";
type EveningChoiceVariant = "four_choice_v1" | "single_v1";

type OnboardingExceptionBucket = {
  startedAt: number;
  count: number;
  updatedAt: number;
};

const ONBOARDING_EXCEPTION_LIMIT_PER_IP = 3;
const ONBOARDING_EXCEPTION_WINDOW_MS = 24 * 60 * 60 * 1000;
const ONBOARDING_EXCEPTION_MAX_BUCKETS = 1000;
const onboardingExceptionBuckets = new Map<string, OnboardingExceptionBucket>();

function isExchangeDebugDryRunAllowed() {
  return (
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.EXCHANGE_DEBUG_DRY_RUN_ENABLED === "1"
  );
}

export async function POST(request: Request) {
  try {
    return await handleExchangePost(request);
  } catch (error) {
    console.error("[sleeping-delivery/exchange] unhandled error", error);
    return NextResponse.json(
      { photo: null, source: "none", error: "exchange_failed" },
      { status: 500 },
    );
  }
}

async function handleExchangePost(request: Request) {
  const timing = createExchangeTiming();
  const parsedInput = await readExchangeRequest(request);
  markExchangeTiming(timing, "read_request");

  if (!parsedInput.ok) {
    return exchangeError(parsedInput.error, parsedInput.status);
  }

  const input = parsedInput.input;
  const inputValidation = validateExchangeRequest(input);

  if (!inputValidation.ok) {
    return exchangeError(inputValidation.error, inputValidation.status);
  }

  const rateLimit = checkExchangeRateLimit(
    buildSleepingDeliveryRateLimitKey(request, input.anonymousId),
  );

  if (!rateLimit.allowed) {
    return exchangeError("too_many_requests", 429);
  }

  if (!isValidOwnPhotoInput(input)) {
    return NextResponse.json(
      { photo: null, source: "none", error: "invalid_exchange_request" },
      { status: 400 },
    );
  }

  const ownPhoto = input.ownPhoto;
  const createdAt = new Date(ownPhoto.createdAt ?? Date.now()).toISOString();
  const ownerCatId = ownPhoto.ownerCatId || ownPhoto.catId;
  const ownPhotoStoragePath = getStoragePhotoPath(ownPhoto.src);
  const isOnboardingExchange = input.mode === "onboarding";
  const shouldAddOwnPhotoToPool =
    ownPhoto.shared !== false &&
    !isBlockedDeliveryPhotoUrl(ownPhoto.src);
  const debugDryRunRequested = input.debugDryRun === true;
  const debugDryRun = debugDryRunRequested && isExchangeDebugDryRunAllowed();

  if (debugDryRunRequested && !debugDryRun) {
    return exchangeError("debug_dry_run_disabled", 403);
  }

  const user = shouldAddOwnPhotoToPool || ownPhotoStoragePath
    ? await getAuthenticatedUserForRequest(request)
    : null;
  markExchangeTiming(timing, "auth");

  if (ownPhotoStoragePath) {
    // Storage-backed own photos are account-owned. Do not accept anonymousId
    // alone here; otherwise a forged anonymousId could send someone else's path.
    const storageValidation = validateOwnStoragePhotoPathAccess(
      ownPhotoStoragePath,
      user?.id ?? null,
    );

    if (!storageValidation.ok) {
      return exchangeError(storageValidation.error, storageValidation.status);
    }
  }

  const userId = user?.id ?? null;
  const senderAnonymousId = input.anonymousId;
  const anonymousId = userId ? null : input.anonymousId;
  const adminSupabase = createSupabaseAdminClient();
  const serverSupabase = adminSupabase ? null : await createServerSupabaseClient();
  const supabase = adminSupabase ?? serverSupabase;

  if (!userId && !anonymousId) {
    return NextResponse.json(
      { photo: null, source: "none", error: "invalid_exchange_request" },
      { status: 400 },
    );
  }

  if (!supabase) {
    return NextResponse.json(
      { photo: null, source: "none", error: "server_unavailable" },
      { status: 503 },
    );
  }

  const deliveryDateValidation = await validateExchangeDeliveryDateKey({
    supabase,
    userId,
    anonymousId,
    deliveryDateKey: input.deliveryDateKey,
    mode: input.mode,
    debugDryRun,
    onboardingExceptionIpKey: buildSleepingDeliveryIpRateLimitKey(request),
  });

  if (!deliveryDateValidation.ok) {
    return NextResponse.json(
      {
        photo: null,
        source: "none",
        error: deliveryDateValidation.error,
        serverDateKey: deliveryDateValidation.serverDateKey,
      },
      { status: 422 },
    );
  }

  const onboardingLedger = input.onboardingSubmission;
  if (onboardingLedger && !debugDryRun) {
    if (!adminSupabase) {
      return NextResponse.json(
        { photo: null, source: "none", error: "onboarding_ledger_unavailable" },
        { status: 503 },
      );
    }

    const authorization = await advanceOnboardingSubmission({
      supabase: adminSupabase,
      userId,
      input: {
        anonymousId,
        dateKey: onboardingLedger.dateKey!,
        journeyId: onboardingLedger.journeyId,
        ownPhotoId: ownPhoto.id ?? null,
        resumeToken: onboardingLedger.resumeToken!,
        source: onboardingLedger.source!,
        stage: "submitted",
        submissionId: onboardingLedger.submissionId!,
      },
    });

    if (!authorization.ok) {
      const status = authorization.error === "conflict" ? 409 :
        authorization.error === "forbidden" ? 403 : 503;
      return NextResponse.json(
        {
          photo: null,
          source: "none",
          error:
            authorization.error === "conflict"
              ? "onboarding_submission_conflict"
              : authorization.error === "forbidden"
                ? "onboarding_submission_forbidden"
                : "onboarding_ledger_unavailable",
        },
        { status },
      );
    }
  }

  const onboardingJourneyId = onboardingLedger?.journeyId ?? null;
  const onboardingJourneyMetadata = onboardingJourneyId
    ? {
        onboarding_journey_id: onboardingJourneyId,
        onboarding_submission_id: onboardingLedger!.submissionId!,
      }
    : {};

  const idempotentDeliveryId =
    input.deliveryDateKey && !debugDryRun
      ? onboardingJourneyId
        ? buildOnboardingJourneyDeliveryId({
            journeyId: onboardingJourneyId,
            deliveryDateKey: input.deliveryDateKey,
          })
        : buildIdempotentDeliveryId({
            userId,
            anonymousId,
            deliveryDateKey: input.deliveryDateKey,
          })
      : null;
  const isEveningChoiceCapableRequest = Boolean(
    !isOnboardingExchange &&
      !debugDryRun &&
      input.deliveryDateKey &&
      input.capability === EVENING_CHOICE_CAPABILITY &&
      input.requestedCandidateCount === EVENING_CHOICE_REQUESTED_COUNT,
  );
  const eveningChoiceAssignedVariant: EveningChoiceVariant =
    isEveningChoiceCapableRequest &&
    isEveningChoiceRolloutAssigned({ userId, anonymousId })
      ? "four_choice_v1"
      : "single_v1";

  if (idempotentDeliveryId && !isOnboardingExchange) {
    const existingBundle = await readExistingDeliveryBundle({
      supabase,
      userId,
      anonymousId,
      bundleId: idempotentDeliveryId,
    });

    if (existingBundle.length > 0) {
      markExchangeTiming(timing, "read_existing_bundle");
      logExchangeTiming(timing, {
        result: "existing_bundle",
        deliveryDateKey: input.deliveryDateKey,
        servedCount: existingBundle.length,
      });
      return buildExistingBundleResponse({
        deliveries: existingBundle,
        input,
        isEveningChoiceCapableRequest,
        supabase,
        timing,
      });
    }
  }

  if (idempotentDeliveryId) {
    const existingDelivery = onboardingJourneyId
      ? await readExistingOnboardingDelivery({
          supabase,
          localDeliveryId: idempotentDeliveryId,
          submissionId: onboardingLedger!.submissionId!,
        })
      : await readExistingDelivery({
          supabase,
          userId,
          anonymousId,
          localDeliveryId: idempotentDeliveryId,
        });

    if (existingDelivery) {
      if (onboardingJourneyId) {
        await transferOnboardingExchangeRows({
          supabase,
          anonymousId,
          deliveryId: existingDelivery.local_delivery_id,
          ownPhotoId: ownPhoto.id,
          submissionId: onboardingLedger!.submissionId!,
          userId,
        });
      }
      markExchangeTiming(timing, "read_existing_delivery");
      logExchangeTiming(timing, {
        result: "existing",
        deliveryDateKey: input.deliveryDateKey,
      });
      const existingPhoto = await attachTransientDeliverySignedUrl(
        toExchangePhotoFromDelivery(existingDelivery, input),
        supabase,
      );
      await recordOnboardingDeliveryProgress({
        adminSupabase,
        anonymousId,
        delivery: existingDelivery,
        input,
        userId,
      });
      return NextResponse.json({
        photo: existingPhoto,
        ...(isEveningChoiceCapableRequest
          ? {
              photos: [existingPhoto],
              bundleId: idempotentDeliveryId,
              experienceVersion: EVENING_CHOICE_CAPABILITY,
              assignedVariant: "single_v1" satisfies EveningChoiceVariant,
              servedVariant: "single_v1" satisfies EveningChoiceVariant,
              requestedCount: EVENING_CHOICE_REQUESTED_COUNT,
              servedCount: 1,
              fallbackReason: "legacy_delivery",
              requestedCandidateCount: EVENING_CHOICE_REQUESTED_COUNT,
              returnedCandidateCount: 1,
            }
          : {}),
        source: "remote",
        diagnostics: {
          ...buildDiagnostics([], new Set(input.blockedPhotoIds ?? [])),
          source: "remote",
          candidateCount: 1,
          normalCandidateCount: 1,
          fallbackCandidateCount: 0,
          fallbackActive: false,
          excludedCount: 0,
          fastPathActive: false,
          fastCandidateCount: 0,
          idempotentReplay: true,
          tier: null,
          timing,
        },
        tier: null,
      });
    }
  }

  if (isOnboardingExchange && !debugDryRun) {
    const priorDelivery = await readPriorExchangeForIdentity({
      supabase,
      userId,
      senderAnonymousId,
      excludeLocalDeliveryId: idempotentDeliveryId,
    });

    if (priorDelivery.error) {
      console.warn(
        "[sleeping-delivery/exchange] prior onboarding delivery lookup failed",
        { code: priorDelivery.error.code },
      );
      return exchangeError("prior_delivery_lookup_failed", 500);
    }

    if (priorDelivery.data) {
      console.warn(
        "[sleeping-delivery/exchange] blocked repeat onboarding after delivery",
      );
      return exchangeError("onboarding_already_completed", 409);
    }
  }

  if (!debugDryRun && shouldAddOwnPhotoToPool) {
    const existingOwnMoment = onboardingJourneyId
      ? await readExistingOnboardingOwnMoment({
          supabase,
          localMomentId: ownPhoto.id,
          submissionId: onboardingLedger!.submissionId!,
        })
      : await readExistingOwnMoment({
          supabase,
          userId,
          anonymousId,
          localMomentId: ownPhoto.id,
        });

    if (existingOwnMoment.error) {
      return NextResponse.json(
        { photo: null, source: "none", error: "own_photo_lookup_failed" },
        { status: 500 },
      );
    }

    if (existingOwnMoment.data && onboardingJourneyId) {
      await transferOnboardingExchangeRows({
        supabase,
        anonymousId,
        ownPhotoId: ownPhoto.id,
        submissionId: onboardingLedger!.submissionId!,
        userId,
      });
    }

    if (!existingOwnMoment.data) {
      const ownPhotoUrl = await prepareExchangeMomentPhotoUrl({
        supabase,
        userId,
        anonymousId,
        ownerCatId,
        localMomentId: ownPhoto.id,
        src: ownPhoto.src,
        canUseStorage: Boolean(adminSupabase),
      });
      const { error: momentError } = await supabase.from("cat_moments").insert({
        user_id: userId,
        anonymous_id: anonymousId,
        local_moment_id: ownPhoto.id,
        local_cat_id: ownPhoto.catId,
        owner_cat_id: ownerCatId,
        photo_url: ownPhotoUrl,
        state: "sleeping",
        visibility: "shared",
        delivery_status: "available",
        moderation_status: "pending",
        source_moment_id: null,
        metadata: {
          source: "user",
          pool_kind: "user_shared",
          trigger_label: input.triggerLabel,
          theme: input.theme,
          category: input.category,
          shared: true,
          capture_context: isOnboardingExchange ? "onboarding" : "daily",
          ...onboardingJourneyMetadata,
        },
        captured_at: createdAt,
        created_at: createdAt,
      });

      if (momentError && momentError.code !== "23505") {
        return NextResponse.json(
          { photo: null, source: "none", error: momentError.message },
          { status: 500 },
        );
      }

      if (momentError && onboardingJourneyId) {
        const racedMoment = await readExistingOnboardingOwnMoment({
          supabase,
          localMomentId: ownPhoto.id,
          submissionId: onboardingLedger!.submissionId!,
        });

        if (racedMoment.error || !racedMoment.data) {
          return NextResponse.json(
            { photo: null, source: "none", error: "own_photo_race_lookup_failed" },
            { status: 500 },
          );
        }

        await transferOnboardingExchangeRows({
          supabase,
          anonymousId,
          ownPhotoId: ownPhoto.id,
          submissionId: onboardingLedger!.submissionId!,
          userId,
        });
      }
    }
  }
  markExchangeTiming(timing, "own_photo");

  const blockedPhotoIds = new Set(input.blockedPhotoIds ?? []);
  const deliveredSourceMomentIds = await readDeliveredSourceMomentIds({
    supabase,
    userId,
    anonymousId,
  });
  markExchangeTiming(timing, "read_delivered_sources");
  const deliverableContext = {
    userId,
    anonymousId,
    senderAnonymousId,
    recipientCatId: input.recipientCatId,
    excludePhotoId: ownPhoto.id,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  };

  if (
    idempotentDeliveryId &&
    shouldUseEveningChoiceBundlePath({
      isCapableRequest: isEveningChoiceCapableRequest,
      assignedVariant: eveningChoiceAssignedVariant,
      idempotentDeliveryId,
    })
  ) {
    return handleEveningChoiceExchange({
      assignedVariant: eveningChoiceAssignedVariant,
      blockedPhotoIds,
      bundleId: idempotentDeliveryId,
      canUseStorage: Boolean(adminSupabase),
      deliverableContext,
      input,
      supabase,
      timing,
      userId,
      anonymousId,
    });
  }

  const fastCandidateMode = isOnboardingExchange ? "tiered" : readFastCandidateMode();
  const fastRows =
    fastCandidateMode === "admin_storage"
      ? await readFastStockCandidateRows(supabase)
      : [];
  markExchangeTiming(timing, "read_fast_storage");
  const fastCandidates = fastRows.filter((row) =>
    isFastStockCandidateDeliverable(row, deliverableContext),
  );
  let diagnosticsBase = buildDiagnostics([], blockedPhotoIds);
  let candidates: RemoteCatMomentRow[] = [];
  let fallbackCandidates: RemoteCatMomentRow[] = [];
  let candidatePool: RemoteCatMomentRow[] = [];
  let selected =
    fastCandidateMode === "admin_storage"
      ? await selectFastStorageCandidate(
          fastCandidates,
          input,
          supabase,
          deliverableContext,
        )
      : null;
  let fastPathActive = Boolean(selected);
  markExchangeTiming(timing, "select_fast_storage");

  if (!selected) {
    const remoteRows = await readRemoteCandidateRows(supabase);
    markExchangeTiming(timing, "read_full_pool");
    diagnosticsBase = buildDiagnostics(remoteRows, blockedPhotoIds);
    const tieredRows = sortTieredCandidates(
      remoteRows.filter((row) => isRowDeliverable(row, deliverableContext)),
      input,
    );
    if (isOnboardingExchange) {
      candidates = [];
      fallbackCandidates = tieredRows.filter(
        (row) => readPoolKind(row.metadata) === "admin_stock",
      );
      candidatePool = fallbackCandidates;
    } else {
      candidates = tieredRows.filter((row) => getDeliveryTier(row, input) < 3);
      fallbackCandidates = tieredRows.filter(
        (row) => getDeliveryTier(row, input) === 3,
      );
      candidatePool = tieredRows;
    }
    selected = await selectCandidate(candidatePool, input, supabase);
    fastPathActive = false;
    markExchangeTiming(timing, "select_full_pool");
  } else {
    diagnosticsBase = buildDiagnostics([selected.row], blockedPhotoIds);
    candidates = [selected.row];
    candidatePool = [selected.row];
  }

  if (!selected) {
    logExchangeTiming(timing, {
      result: "none",
      fastPathActive,
      fastCandidateCount: fastCandidates.length,
      candidateCount: candidatePool.length,
    });
    return NextResponse.json({
      photo: null,
      source: "none",
      diagnostics: {
        ...diagnosticsBase,
        source: "none",
        candidateCount: candidatePool.length,
        normalCandidateCount: candidates.length,
        fallbackCandidateCount: fallbackCandidates.length,
        fallbackActive: candidates.length === 0 && fallbackCandidates.length > 0,
        excludedCount: Math.max(0, diagnosticsBase.availableCount - candidatePool.length),
        duplicateExcludedCount: deliveredSourceMomentIds.size,
        fastPathActive,
        fastCandidateCount: fastCandidates.length,
        timing,
      },
    });
  }

  const localDeliveryId =
    idempotentDeliveryId ??
    `delivered-sleeping-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const deliveredAt = new Date();
  const deliveryPhotoSrc = await prepareExchangeDeliveryPhotoSrc({
    supabase,
    row: selected.row,
    resolvedSrc: selected.src,
    canUseStorage: Boolean(adminSupabase),
  });
  markExchangeTiming(timing, "delivery_photo");
  const photo: ExchangePhoto = {
    id: localDeliveryId,
    sourcePhotoId: selected.row.local_moment_id,
    src: deliveryPhotoSrc,
    title: "ほかの猫のねがお",
    subtitle: "",
    triggerLabel: input.triggerLabel,
    theme: input.theme,
    deliveredAt: deliveredAt.getTime(),
  };

  if (!debugDryRun) {
    const { error: deliveryError } = await supabase
      .from("cat_moment_deliveries")
      .insert({
        user_id: userId,
        anonymous_id: anonymousId,
        local_delivery_id: localDeliveryId,
        source_moment_id: selected.row.id,
        source_photo_id: selected.row.local_moment_id,
        recipient_local_cat_id: input.recipientCatId,
        photo_url: deliveryPhotoSrc,
        status: "delivered",
        metadata: {
          source: "server_exchange",
          source_pool_kind: readPoolKind(selected.row.metadata),
          trigger_label: input.triggerLabel,
          theme: input.theme,
          category: input.category,
          delivery_date_key: input.deliveryDateKey,
          delivery_tier: selected.tier,
          ...onboardingJourneyMetadata,
        },
        delivered_at: deliveredAt.toISOString(),
      });

    if (deliveryError) {
      if (idempotentDeliveryId && isUniqueDeliveryError(deliveryError)) {
        const existingDelivery = onboardingJourneyId
          ? await readExistingOnboardingDelivery({
              supabase,
              localDeliveryId: idempotentDeliveryId,
              submissionId: onboardingLedger!.submissionId!,
            })
          : await readExistingDelivery({
              supabase,
              userId,
              anonymousId,
              localDeliveryId: idempotentDeliveryId,
            });

        if (existingDelivery) {
          if (onboardingJourneyId) {
            await transferOnboardingExchangeRows({
              supabase,
              anonymousId,
              deliveryId: existingDelivery.local_delivery_id,
              ownPhotoId: ownPhoto.id,
              submissionId: onboardingLedger!.submissionId!,
              userId,
            });
          }
          markExchangeTiming(timing, "read_duplicate_delivery");
          logExchangeTiming(timing, {
            result: "existing_after_duplicate",
            deliveryDateKey: input.deliveryDateKey,
          });
          const existingPhoto = await attachTransientDeliverySignedUrl(
            toExchangePhotoFromDelivery(existingDelivery, input),
            supabase,
          );
          await recordOnboardingDeliveryProgress({
            adminSupabase,
            anonymousId,
            delivery: existingDelivery,
            input,
            userId,
          });
          return NextResponse.json({
            photo: existingPhoto,
            source: "remote",
            diagnostics: {
              ...diagnosticsBase,
              source: "remote",
              candidateCount: candidatePool.length,
              normalCandidateCount: candidates.length,
              fallbackCandidateCount: fallbackCandidates.length,
              fallbackActive:
                candidates.length === 0 && fallbackCandidates.length > 0,
              excludedCount: Math.max(
                0,
                diagnosticsBase.availableCount - candidatePool.length,
              ),
              duplicateExcludedCount: deliveredSourceMomentIds.size,
              fastPathActive,
              fastCandidateCount: fastCandidates.length,
              idempotentReplay: true,
              tier: selected.tier,
              timing,
            },
            tier: selected.tier,
          });
        }
      }

      return NextResponse.json(
        { photo: null, source: "none", error: deliveryError.message },
        { status: 500 },
      );
    }

    await incrementDeliveryCount({
      supabase,
      row: selected.row,
    });
    await recordOnboardingDeliveryProgress({
      adminSupabase,
      anonymousId,
      delivery: {
        local_delivery_id: localDeliveryId,
        source_photo_id: selected.row.local_moment_id,
      },
      input,
      userId,
    });
  }
  markExchangeTiming(timing, "insert_delivery");
  logExchangeTiming(timing, {
    result: "remote",
    fastPathActive,
    fastCandidateCount: fastCandidates.length,
    candidateCount: candidatePool.length,
    selectedStorage: Boolean(getStoragePhotoPath(selected.row.photo_url)),
    tier: selected.tier,
  });

  return NextResponse.json({
    photo: await attachTransientDeliverySignedUrl(photo, supabase),
    source: "remote",
    tier: selected.tier,
    diagnostics: {
      ...diagnosticsBase,
      source: "remote",
      candidateCount: candidatePool.length,
      normalCandidateCount: candidates.length,
      fallbackCandidateCount: fallbackCandidates.length,
      fallbackActive: candidates.length === 0 && fallbackCandidates.length > 0,
      excludedCount: Math.max(0, diagnosticsBase.availableCount - candidatePool.length),
      duplicateExcludedCount: deliveredSourceMomentIds.size,
      fastPathActive,
      fastCandidateCount: fastCandidates.length,
      tier: selected.tier,
      timing,
    },
  });
}

async function handleEveningChoiceExchange({
  assignedVariant,
  blockedPhotoIds,
  bundleId,
  canUseStorage,
  deliverableContext,
  input,
  supabase,
  timing,
  userId,
  anonymousId,
}: {
  assignedVariant: EveningChoiceVariant;
  blockedPhotoIds: Set<string>;
  bundleId: string;
  canUseStorage: boolean;
  deliverableContext: Parameters<typeof isRowDeliverable>[1];
  input: Required<ExchangeRequest>;
  supabase: SupabaseClient;
  timing: ReturnType<typeof createExchangeTiming>;
  userId: string | null;
  anonymousId: string | null;
}) {
  const remoteRows = await readRemoteCandidateRows(supabase);
  markExchangeTiming(timing, "read_choice_pool");
  const diagnosticsBase = buildDiagnostics(remoteRows, blockedPhotoIds);
  const candidatePool = sortTieredCandidates(
    remoteRows.filter(
      (row) =>
        isRowDeliverable(row, deliverableContext) &&
        isPersistableEveningChoiceSource(row.photo_url),
    ),
    input,
  );
  const assignedCount =
    assignedVariant === "four_choice_v1" ? EVENING_CHOICE_REQUESTED_COUNT : 1;
  let selectedCandidates = await selectCandidates(
    candidatePool,
    input,
    supabase,
    assignedCount,
  );
  let servedVariant: EveningChoiceVariant = assignedVariant;
  let fallbackReason: string | null = null;

  if (
    assignedVariant === "four_choice_v1" &&
    selectedCandidates.length < EVENING_CHOICE_REQUESTED_COUNT
  ) {
    fallbackReason =
      selectedCandidates.length === 0 ? "no_candidate" : "candidate_shortage";
    selectedCandidates = selectedCandidates.slice(0, 1);
    servedVariant = "single_v1";
  }

  if (selectedCandidates.length === 0) {
    logExchangeTiming(timing, {
      result: "choice_none",
      candidateCount: candidatePool.length,
      assignedVariant,
    });
    return NextResponse.json({
      photo: null,
      photos: [],
      source: "none",
      bundleId,
      experienceVersion: EVENING_CHOICE_CAPABILITY,
      assignedVariant,
      servedVariant,
      requestedCount: EVENING_CHOICE_REQUESTED_COUNT,
      servedCount: 0,
      fallbackReason: fallbackReason ?? "no_candidate",
      requestedCandidateCount: EVENING_CHOICE_REQUESTED_COUNT,
      returnedCandidateCount: 0,
      diagnostics: {
        ...diagnosticsBase,
        source: "none",
        candidateCount: candidatePool.length,
        excludedCount: Math.max(
          0,
          diagnosticsBase.availableCount - candidatePool.length,
        ),
        choiceExperienceVersion: EVENING_CHOICE_CAPABILITY,
        choiceAssignedVariant: assignedVariant,
        choiceServedVariant: servedVariant,
        choiceRequestedCount: EVENING_CHOICE_REQUESTED_COUNT,
        choiceServedCount: 0,
        choiceFallbackReason: fallbackReason ?? "no_candidate",
        timing,
      },
    });
  }

  const deliveredAt = new Date();
  const deliveredAtMs = deliveredAt.getTime();
  const servedCount = selectedCandidates.length;
  const prepared = await Promise.all(
    selectedCandidates.map(async (selected, index) => {
      const localDeliveryId = buildEveningChoiceDeliverySlotId({
        bundleId,
        position: index + 1,
      });
      const deliveryPhotoSrc = await prepareExchangeDeliveryPhotoSrc({
        supabase,
        row: selected.row,
        resolvedSrc: selected.src,
        canUseStorage,
      });
      const metadata = {
        source: "server_exchange",
        source_pool_kind: readPoolKind(selected.row.metadata),
        trigger_label: input.triggerLabel,
        theme: input.theme,
        category: input.category,
        delivery_date_key: input.deliveryDateKey,
        delivery_tier: selected.tier,
        bundle_id: bundleId,
        experience_version: EVENING_CHOICE_CAPABILITY,
        assigned_variant: assignedVariant,
        served_variant: servedVariant,
        requested_count: EVENING_CHOICE_REQUESTED_COUNT,
        served_count: servedCount,
        fallback_reason: fallbackReason,
        delivery_position: index + 1,
      };
      const photo: ExchangePhoto = {
        id: localDeliveryId,
        sourcePhotoId: selected.row.local_moment_id,
        src: deliveryPhotoSrc,
        title: "ほかの猫のねがお",
        subtitle: "",
        triggerLabel: input.triggerLabel,
        theme: input.theme,
        deliveredAt: deliveredAtMs,
      };

      return {
        photo,
        selected,
        row: {
          user_id: userId,
          anonymous_id: anonymousId,
          local_delivery_id: localDeliveryId,
          source_moment_id: selected.row.id,
          source_photo_id: selected.row.local_moment_id,
          recipient_local_cat_id: input.recipientCatId,
          photo_url: deliveryPhotoSrc,
          status: "delivered",
          metadata,
          delivered_at: deliveredAt.toISOString(),
        },
      };
    }),
  );
  markExchangeTiming(timing, "choice_delivery_photos");

  const { error: deliveryError } = await supabase
    .from("cat_moment_deliveries")
    .insert(prepared.map((item) => item.row));

  if (deliveryError) {
    if (isUniqueDeliveryError(deliveryError)) {
      const existingBundle = await readExistingDeliveryBundle({
        supabase,
        userId,
        anonymousId,
        bundleId,
      });

      if (existingBundle.length > 0) {
        markExchangeTiming(timing, "read_duplicate_bundle");
        return buildExistingBundleResponse({
          deliveries: existingBundle,
          input,
          isEveningChoiceCapableRequest: true,
          supabase,
          timing,
        });
      }
    }

    return NextResponse.json(
      {
        photo: null,
        photos: [],
        source: "none",
        error: deliveryError.message,
        bundleId,
        experienceVersion: EVENING_CHOICE_CAPABILITY,
        assignedVariant,
        servedVariant,
        requestedCount: EVENING_CHOICE_REQUESTED_COUNT,
        servedCount: 0,
        fallbackReason: "delivery_insert_failed",
      },
      { status: 500 },
    );
  }

  await Promise.all(
    prepared.map(({ selected }) =>
      incrementDeliveryCount({ supabase, row: selected.row }),
    ),
  );
  markExchangeTiming(timing, "insert_choice_bundle");
  const photos = await Promise.all(
    prepared.map(({ photo }) => attachTransientDeliverySignedUrl(photo, supabase)),
  );
  logExchangeTiming(timing, {
    result: "choice_remote",
    candidateCount: candidatePool.length,
    assignedVariant,
    servedVariant,
    servedCount,
  });

  return NextResponse.json({
    photo: photos[0] ?? null,
    photos,
    source: "remote",
    tier: selectedCandidates[0]?.tier ?? null,
    bundleId,
    experienceVersion: EVENING_CHOICE_CAPABILITY,
    assignedVariant,
    servedVariant,
    requestedCount: EVENING_CHOICE_REQUESTED_COUNT,
    servedCount,
    fallbackReason,
    requestedCandidateCount: EVENING_CHOICE_REQUESTED_COUNT,
    returnedCandidateCount: servedCount,
    diagnostics: {
      ...diagnosticsBase,
      source: "remote",
      candidateCount: candidatePool.length,
      excludedCount: Math.max(
        0,
        diagnosticsBase.availableCount - candidatePool.length,
      ),
      duplicateExcludedCount: deliverableContext.deliveredSourceMomentIds.size,
      choiceExperienceVersion: EVENING_CHOICE_CAPABILITY,
      choiceAssignedVariant: assignedVariant,
      choiceServedVariant: servedVariant,
      choiceRequestedCount: EVENING_CHOICE_REQUESTED_COUNT,
      choiceServedCount: servedCount,
      choiceFallbackReason: fallbackReason,
      timing,
    },
  });
}

export function buildEveningChoiceDeliverySlotId({
  bundleId,
  position,
}: {
  bundleId: string;
  position: number;
}) {
  return `${bundleId}-choice-${position}`;
}

function isEveningChoiceRolloutAssigned({
  userId,
  anonymousId,
}: {
  userId: string | null;
  anonymousId: string | null;
}) {
  const identity = userId ? `user:${userId}` : `anon:${anonymousId ?? ""}`;
  return isIdentityInEveningChoiceRollout(
    identity,
    readEveningChoiceRolloutPercent(),
  );
}

export function isIdentityInEveningChoiceRollout(
  identity: string,
  rolloutPercent: number,
) {
  if (rolloutPercent <= 0) {
    return false;
  }
  if (rolloutPercent >= 100) {
    return true;
  }

  const digest = createHash("sha256").update(identity).digest();
  return digest.readUInt32BE(0) % 100 < rolloutPercent;
}

export function shouldUseEveningChoiceBundlePath({
  isCapableRequest,
  assignedVariant,
  idempotentDeliveryId,
}: {
  isCapableRequest: boolean;
  assignedVariant: EveningChoiceVariant;
  idempotentDeliveryId: string | null;
}) {
  return Boolean(
    isCapableRequest &&
      assignedVariant === "four_choice_v1" &&
      idempotentDeliveryId,
  );
}

export function readEveningChoiceRolloutPercent() {
  const raw = process.env.EVENING_DELIVERY_FOUR_CHOICE_ROLLOUT_PERCENT;
  if (raw === undefined || raw.trim() === "") {
    const isProduction =
      process.env.NODE_ENV === "production" &&
      process.env.VERCEL_ENV !== "preview" &&
      process.env.VERCEL_ENV !== "development";
    return isProduction ? 0 : 100;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.floor(parsed)));
}

async function readExistingDeliveryBundle({
  supabase,
  userId,
  anonymousId,
  bundleId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  bundleId: string;
}) {
  const slotIds = Array.from({ length: EVENING_CHOICE_MAX_COUNT }, (_, index) =>
    buildEveningChoiceDeliverySlotId({ bundleId, position: index + 1 }),
  );
  let query = supabase
    .from("cat_moment_deliveries")
    .select(
      "id, local_delivery_id, source_moment_id, source_photo_id, recipient_local_cat_id, photo_url, status, metadata, delivered_at",
    )
    .in("local_delivery_id", slotIds);

  query = userId
    ? query.eq("user_id", userId)
    : query.eq("anonymous_id", anonymousId ?? "").is("user_id", null);

  const { data, error } = await query;
  if (error) {
    console.warn("[sleeping-delivery/exchange] existing bundle lookup failed", {
      code: error.code,
    });
    return [];
  }

  return ((data ?? []) as RemoteDeliveryRow[]).sort(
    (first, second) =>
      readDeliveryPosition(first.metadata) - readDeliveryPosition(second.metadata) ||
      first.local_delivery_id.localeCompare(second.local_delivery_id),
  );
}

async function buildExistingBundleResponse({
  deliveries,
  input,
  isEveningChoiceCapableRequest,
  supabase,
  timing,
}: {
  deliveries: RemoteDeliveryRow[];
  input: Required<ExchangeRequest>;
  isEveningChoiceCapableRequest: boolean;
  supabase: SupabaseClient;
  timing: ReturnType<typeof createExchangeTiming>;
}) {
  const photos = await Promise.all(
    deliveries.map((delivery) =>
      attachTransientDeliverySignedUrl(
        toExchangePhotoFromDelivery(delivery, input),
        supabase,
      ),
    ),
  );
  const metadata = deliveries[0]?.metadata ?? {};
  const bundleId =
    typeof metadata.bundle_id === "string" ? metadata.bundle_id : null;
  const assignedVariant = readEveningChoiceVariant(
    metadata.assigned_variant,
    photos.length >= EVENING_CHOICE_REQUESTED_COUNT
      ? "four_choice_v1"
      : "single_v1",
  );
  const servedVariant = readEveningChoiceVariant(
    metadata.served_variant,
    photos.length >= EVENING_CHOICE_REQUESTED_COUNT
      ? "four_choice_v1"
      : "single_v1",
  );
  const requestedCount = readPositiveInteger(
    metadata.requested_count,
    EVENING_CHOICE_REQUESTED_COUNT,
  );
  const servedCount = photos.length;
  const fallbackReason =
    typeof metadata.fallback_reason === "string"
      ? metadata.fallback_reason
      : null;
  const tier = readDeliveryTier(metadata.delivery_tier);

  return NextResponse.json({
    photo: photos[0] ?? null,
    ...(isEveningChoiceCapableRequest
      ? {
          photos,
          bundleId,
          experienceVersion: EVENING_CHOICE_CAPABILITY,
          assignedVariant,
          servedVariant,
          requestedCount,
          servedCount,
          fallbackReason,
          requestedCandidateCount: requestedCount,
          returnedCandidateCount: servedCount,
        }
      : {}),
    source: photos.length > 0 ? "remote" : "none",
    tier,
    diagnostics: {
      ...buildDiagnostics([], new Set(input.blockedPhotoIds ?? [])),
      source: photos.length > 0 ? "remote" : "none",
      candidateCount: photos.length,
      normalCandidateCount: photos.length,
      fallbackCandidateCount: 0,
      fallbackActive: servedVariant === "single_v1" && requestedCount > 1,
      excludedCount: 0,
      idempotentReplay: true,
      tier,
      timing,
    },
  });
}

function readDeliveryPosition(metadata: Record<string, unknown> | null) {
  return readPositiveInteger(metadata?.delivery_position, Number.MAX_SAFE_INTEGER);
}

function readEveningChoiceVariant(
  value: unknown,
  fallback: EveningChoiceVariant,
): EveningChoiceVariant {
  return value === "four_choice_v1" || value === "single_v1" ? value : fallback;
}

function readPositiveInteger(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function readDeliveryTier(value: unknown): DeliveryTier | null {
  return value === 1 || value === 2 || value === 3 ? value : null;
}

async function readExchangeRequest(request: Request): Promise<ExchangeRequestParseResult> {
  const rawBody = await request.text().catch(() => "");

  if (rawBody.length > MAX_JSON_BODY_LENGTH) {
    return { ok: false, status: 413, error: "payload_too_large" };
  }

  let body: ExchangeRequest;

  try {
    body = JSON.parse(rawBody || "{}") as ExchangeRequest;
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }

  if (
    Array.isArray(body.blockedPhotoIds) &&
    body.blockedPhotoIds.length > MAX_BLOCKED_PHOTO_IDS
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return {
    ok: true,
    input: {
      ownPhoto: body.ownPhoto ?? {},
      triggerLabel: toStringOrDefault(body.triggerLabel, "ねがお"),
      theme: toStringOrDefault(body.theme, "sleeping"),
      category: toStringOrDefault(body.category, "sleeping"),
      seed: toStringOrDefault(body.seed, String(Date.now())),
      deliveryDateKey: toStringOrNull(body.deliveryDateKey),
      recipientCatId: toStringOrNull(body.recipientCatId),
      anonymousId: toStringOrNull(body.anonymousId),
      blockedPhotoIds: Array.isArray(body.blockedPhotoIds)
        ? body.blockedPhotoIds.filter((id) => typeof id === "string")
        : [],
      preferredSourcePhotoId: toStringOrNull(body.preferredSourcePhotoId),
      requestedCandidateCount:
        typeof body.requestedCandidateCount === "number"
          ? body.requestedCandidateCount
          : null,
      capability: toStringOrNull(body.capability),
      debugDryRun: body.debugDryRun === true,
      mode: body.mode === "onboarding" ? "onboarding" : null,
      onboardingSubmission:
        body.onboardingSubmission && typeof body.onboardingSubmission === "object"
          ? {
              dateKey: toStringOrNull(body.onboardingSubmission.dateKey),
              journeyId: toStringOrNull(body.onboardingSubmission.journeyId),
              resumeToken: toStringOrNull(body.onboardingSubmission.resumeToken),
              source: toStringOrNull(body.onboardingSubmission.source),
              submissionId: toStringOrNull(
                body.onboardingSubmission.submissionId,
              ),
            }
          : null,
    },
  };
}

function isValidOwnPhotoInput(
  input: Required<ExchangeRequest>,
): input is Required<ExchangeRequest> & {
  ownPhoto: {
    id: string;
    catId: string;
    ownerCatId?: string;
    src: string;
    createdAt?: number;
    shared?: boolean;
  };
} {
  return Boolean(
    typeof input.ownPhoto.id === "string" &&
      typeof input.ownPhoto.catId === "string" &&
      typeof input.ownPhoto.src === "string" &&
      input.ownPhoto.src,
  );
}

function validateExchangeRequest(
  input: Required<ExchangeRequest>,
): SleepingDeliveryValidationResult {
  if (!isValidOwnPhotoInput(input)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  const ownPhoto = input.ownPhoto;
  const stringFields = [
    ownPhoto.id,
    ownPhoto.catId,
    ownPhoto.ownerCatId,
    input.anonymousId,
    input.recipientCatId,
    input.preferredSourcePhotoId,
    input.capability,
  ].filter((value): value is string => typeof value === "string");

  if (stringFields.some((value) => value.length > MAX_ID_LENGTH)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  const textFields = [
    input.triggerLabel,
    input.theme,
    input.category,
    input.seed,
    input.deliveryDateKey,
    input.mode,
    ownPhoto.triggerLabel,
    ownPhoto.theme,
  ].filter((value): value is string => typeof value === "string");

  if (textFields.some((value) => value.length > MAX_TEXT_LENGTH)) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    ownPhoto.shared !== undefined &&
    typeof ownPhoto.shared !== "boolean"
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    input.blockedPhotoIds.length > MAX_BLOCKED_PHOTO_IDS ||
    input.blockedPhotoIds.some((id) => id.length > MAX_ID_LENGTH)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    input.requestedCandidateCount !== null &&
    (!Number.isInteger(input.requestedCandidateCount) ||
      input.requestedCandidateCount < 1 ||
      input.requestedCandidateCount > EVENING_CHOICE_MAX_COUNT)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    input.deliveryDateKey &&
    !isServerDateKey(input.deliveryDateKey)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  const onboardingSubmission = input.onboardingSubmission;
  if (
    onboardingSubmission &&
    (input.mode !== "onboarding" ||
      typeof onboardingSubmission.submissionId !== "string" ||
      onboardingSubmission.submissionId.length > 240 ||
      typeof onboardingSubmission.resumeToken !== "string" ||
      !isOnboardingResumeToken(onboardingSubmission.resumeToken) ||
      typeof onboardingSubmission.dateKey !== "string" ||
      !isServerDateKey(onboardingSubmission.dateKey) ||
      (onboardingSubmission.journeyId !== null &&
        (typeof onboardingSubmission.journeyId !== "string" ||
          !isOnboardingJourneyId(onboardingSubmission.journeyId) ||
          onboardingSubmission.submissionId !==
            createOnboardingJourneySubmissionId(
              onboardingSubmission.journeyId,
              onboardingSubmission.dateKey,
            ) ||
          ownPhoto.id !==
            createOnboardingOwnPhotoId(onboardingSubmission.submissionId))) ||
      (input.deliveryDateKey !== null &&
        input.deliveryDateKey !== onboardingSubmission.dateKey) ||
      typeof onboardingSubmission.source !== "string" ||
      !isOnboardingSource(onboardingSubmission.source))
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  if (
    typeof ownPhoto.createdAt === "number" &&
    (!Number.isFinite(ownPhoto.createdAt) ||
      ownPhoto.createdAt < MIN_CREATED_AT ||
      ownPhoto.createdAt > Date.now() + MAX_CREATED_AT_FUTURE_DRIFT_MS)
  ) {
    return { ok: false, status: 400, error: "invalid_exchange_request" };
  }

  return validateOwnPhotoSrc(ownPhoto.src);
}

async function recordOnboardingDeliveryProgress({
  adminSupabase,
  anonymousId,
  delivery,
  input,
  userId,
}: {
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>;
  anonymousId: string | null;
  delivery: {
    id?: string;
    local_delivery_id?: string;
    sourcePhotoId?: string;
    source_photo_id?: string | null;
  };
  input: Required<ExchangeRequest>;
  userId: string | null;
}) {
  const ledger = input.onboardingSubmission;
  if (!adminSupabase || !ledger || input.debugDryRun) {
    return;
  }

  const deliveryId = delivery.local_delivery_id ?? delivery.id ?? null;
  if (!deliveryId) {
    return;
  }

  const result = await advanceOnboardingSubmission({
    supabase: adminSupabase,
    userId,
    input: {
      anonymousId,
      dateKey: ledger.dateKey!,
      deliveryId,
      ownPhotoId: input.ownPhoto.id ?? null,
      resumeToken: ledger.resumeToken!,
      source: ledger.source!,
      sourcePhotoId:
        delivery.source_photo_id ?? delivery.sourcePhotoId ?? null,
      stage: "delivered",
      submissionId: ledger.submissionId!,
    },
  });

  if (!result.ok) {
    console.warn("[sleeping-delivery/exchange] onboarding ledger update failed", {
      error: result.error,
      code: result.code,
    });
  }
}

function isOnboardingSource(value: string) {
  return [
    "direct",
    "instagram",
    "instagram_story",
    "instagram_bio",
    "instagram_dm",
    "referral",
    "unknown",
  ].includes(value);
}

function exchangeError(
  error: string,
  status: 400 | 401 | 403 | 409 | 413 | 415 | 429 | 500,
) {
  return NextResponse.json({ photo: null, source: "none", error }, { status });
}

export async function validateExchangeDeliveryDateKey({
  supabase,
  userId,
  anonymousId,
  deliveryDateKey,
  mode,
  debugDryRun,
  onboardingExceptionIpKey,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  deliveryDateKey: string | null;
  mode: "onboarding" | null;
  debugDryRun: boolean;
  onboardingExceptionIpKey: string;
}) {
  const serverDateKey = getServerJstDateKey();

  if (debugDryRun) {
    return { ok: true as const };
  }

  const canUseOnboardingException = mode === "onboarding";

  if (canUseOnboardingException) {
    const onboardingExceptionLimit = checkOnboardingExchangeExceptionLimit(
      onboardingExceptionIpKey,
    );

    if (onboardingExceptionLimit.allowed) {
      return { ok: true as const };
    }

    await recordOnboardingExceptionLimitEvent({
      supabase,
      userId,
      anonymousId,
      ipKey: onboardingExceptionIpKey,
      count: onboardingExceptionLimit.count,
    });
  }

  if (!deliveryDateKey) {
    return {
      ok: false as const,
      error: "delivery_not_yet" as const,
      serverDateKey,
    };
  }

  return validateServerDeliveryDateKey({ deliveryDateKey });
}

export function checkOnboardingExchangeExceptionLimit(key: string) {
  const now = Date.now();
  const existing = onboardingExceptionBuckets.get(key);
  const bucket: OnboardingExceptionBucket = existing
    ? {
        startedAt:
          now - existing.startedAt > ONBOARDING_EXCEPTION_WINDOW_MS
            ? now
            : existing.startedAt,
        count:
          now - existing.startedAt > ONBOARDING_EXCEPTION_WINDOW_MS
            ? 0
            : existing.count,
        updatedAt: now,
      }
    : {
        startedAt: now,
        count: 0,
        updatedAt: now,
      };

  bucket.count += 1;
  onboardingExceptionBuckets.set(key, bucket);
  pruneOnboardingExceptionBuckets(now);

  return {
    allowed: bucket.count <= ONBOARDING_EXCEPTION_LIMIT_PER_IP,
    count: bucket.count,
  };
}

export function resetOnboardingExchangeExceptionLimitForTests() {
  onboardingExceptionBuckets.clear();
}

async function recordOnboardingExceptionLimitEvent({
  supabase,
  userId,
  anonymousId,
  ipKey,
  count,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  ipKey: string;
  count: number;
}) {
  const eventRow = {
    event_name: "onboarding_exchange_exception_limited",
    source: "unknown",
    user_id: userId,
    anonymous_id: userId ? null : anonymousId,
    route: "/api/sleeping-delivery/exchange",
    metadata: {
      ip_key_hash: hashText(ipKey).toString(36),
      count,
      limit: ONBOARDING_EXCEPTION_LIMIT_PER_IP,
      window_hours: 24,
    },
  };

  const { error } = await supabase.from("app_events").insert(eventRow);

  if (error) {
    console.warn("[sleeping-delivery/exchange] onboarding limit event failed", {
      code: error.code,
    });
  }
}

function pruneOnboardingExceptionBuckets(now: number) {
  if (onboardingExceptionBuckets.size <= ONBOARDING_EXCEPTION_MAX_BUCKETS) {
    return;
  }

  for (const [key, bucket] of onboardingExceptionBuckets) {
    if (now - bucket.updatedAt > ONBOARDING_EXCEPTION_WINDOW_MS * 2) {
      onboardingExceptionBuckets.delete(key);
    }
  }
}

export function buildIdempotentDeliveryId({
  userId,
  anonymousId,
  deliveryDateKey,
}: {
  userId: string | null;
  anonymousId: string | null;
  deliveryDateKey: string;
}) {
  const recipientIdentity = userId ? `user:${userId}` : `anon:${anonymousId ?? ""}`;
  const digest = createHash("sha256")
    .update(`${recipientIdentity}:${deliveryDateKey}`)
    .digest("hex")
    .slice(0, 24);

  return `delivered-sleeping-${deliveryDateKey}-${digest}`;
}

export function buildOnboardingJourneyDeliveryId({
  journeyId,
  deliveryDateKey,
}: {
  journeyId: string;
  deliveryDateKey: string;
}) {
  const digest = createHash("sha256")
    .update(`${journeyId}:${deliveryDateKey}`)
    .digest("hex")
    .slice(0, 24);

  return `delivered-onboarding-${deliveryDateKey}-${digest}`;
}

export async function readExistingDelivery({
  supabase,
  userId,
  anonymousId,
  localDeliveryId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  localDeliveryId: string;
}) {
  return readExistingDeliveryByLocalId({
    supabase,
    userId,
    anonymousId,
    localDeliveryId,
  });
}

async function readExistingOnboardingDelivery({
  supabase,
  localDeliveryId,
  submissionId,
}: {
  supabase: SupabaseClient;
  localDeliveryId: string;
  submissionId: string;
}) {
  const { data, error } = await supabase
    .from("cat_moment_deliveries")
    .select(
      "id, local_delivery_id, source_moment_id, source_photo_id, recipient_local_cat_id, photo_url, status, metadata, delivered_at",
    )
    .eq("local_delivery_id", localDeliveryId)
    .contains("metadata", { onboarding_submission_id: submissionId })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      "[sleeping-delivery/exchange] onboarding delivery lookup failed",
      { code: error.code },
    );
    return null;
  }

  return data as RemoteDeliveryRow | null;
}

async function readExistingDeliveryByLocalId({
  supabase,
  userId,
  anonymousId,
  localDeliveryId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  localDeliveryId: string;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select(
      "id, local_delivery_id, source_moment_id, source_photo_id, recipient_local_cat_id, photo_url, status, metadata, delivered_at",
    )
    .eq("local_delivery_id", localDeliveryId)
    .limit(1);

  query = userId
    ? query.eq("user_id", userId)
    : query.eq("anonymous_id", anonymousId ?? "").is("user_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn("[sleeping-delivery/exchange] existing delivery lookup failed", {
      code: error.code,
    });
    return null;
  }

  return data as RemoteDeliveryRow | null;
}

async function readPriorExchangeForIdentity({
  supabase,
  userId,
  senderAnonymousId,
  excludeLocalDeliveryId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  senderAnonymousId: string | null;
  excludeLocalDeliveryId: string | null;
}) {
  if (userId) {
    const result = await readPriorExchange({
      supabase,
      identityColumn: "user_id",
      identityValue: userId,
      excludeLocalDeliveryId,
    });

    if (result.error || result.data) {
      return result;
    }
  }

  if (senderAnonymousId) {
    return readPriorExchange({
      supabase,
      identityColumn: "anonymous_id",
      identityValue: senderAnonymousId,
      excludeLocalDeliveryId,
    });
  }

  return { data: null, error: null };
}

async function readPriorExchange({
  supabase,
  identityColumn,
  identityValue,
  excludeLocalDeliveryId,
}: {
  supabase: SupabaseClient;
  identityColumn: "anonymous_id" | "user_id";
  identityValue: string;
  excludeLocalDeliveryId: string | null;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select("id")
    .eq(identityColumn, identityValue)
    .limit(1);

  if (excludeLocalDeliveryId) {
    query = query.neq("local_delivery_id", excludeLocalDeliveryId);
  }

  return query.maybeSingle<{ id: string }>();
}

async function readDeliveredSourceMomentIds({
  supabase,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
}) {
  let query = supabase
    .from("cat_moment_deliveries")
    .select("source_moment_id")
    .not("source_moment_id", "is", null)
    .limit(1000);

  query = userId
    ? query.eq("user_id", userId)
    : query.is("user_id", null).eq("anonymous_id", anonymousId ?? "");

  const { data, error } = await query;

  if (error) {
    console.warn("[sleeping-delivery/exchange] delivered source lookup failed", {
      code: error.code,
    });
    return new Set<string>();
  }

  return new Set(
    (data ?? [])
      .map((row) =>
        typeof row.source_moment_id === "string" ? row.source_moment_id : null,
      )
      .filter((value): value is string => Boolean(value)),
  );
}

function toExchangePhotoFromDelivery(
  delivery: RemoteDeliveryRow,
  input: Required<ExchangeRequest>,
): ExchangePhoto {
  const metadata = delivery.metadata ?? {};
  const triggerLabel =
    typeof metadata.trigger_label === "string"
      ? metadata.trigger_label
      : input.triggerLabel;
  const theme = typeof metadata.theme === "string" ? metadata.theme : input.theme;
  const deliveredAt = Date.parse(delivery.delivered_at);

  return {
    id: delivery.local_delivery_id,
    sourcePhotoId: delivery.source_photo_id ?? delivery.source_moment_id ?? "",
    src: delivery.photo_url,
    title: "ほかの猫のねがお",
    subtitle: "",
    triggerLabel,
    theme,
    deliveredAt: Number.isFinite(deliveredAt) ? deliveredAt : Date.now(),
  };
}

async function attachTransientDeliverySignedUrl(
  photo: ExchangePhoto,
  supabase: SupabaseClient,
) {
  const storagePath = getStoragePhotoPath(photo.src);

  if (!storagePath) {
    return photo;
  }

  const signedUrl = await createTransientDeliverySignedUrl(supabase, storagePath);

  if (!signedUrl) {
    return photo;
  }

  return {
    ...photo,
    thumbnailSrc: signedUrl,
    displaySrc: signedUrl,
    originalSrc: signedUrl,
  };
}

async function createTransientDeliverySignedUrl(
  supabase: SupabaseClient,
  storagePath: string,
) {
  const { data, error } = await supabase.storage
    .from(CAT_PHOTOS_BUCKET)
    .createSignedUrl(storagePath, TRANSIENT_DELIVERY_SIGNED_URL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

function isUniqueDeliveryError(error: { code?: string; message?: string }) {
  return (
    error.code === "23505" ||
    /cat_moment_deliveries_(?:user|anonymous)_local_delivery_uidx/i.test(
      error.message ?? "",
    )
  );
}

async function readExistingOwnMoment({
  supabase,
  userId,
  anonymousId,
  localMomentId,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  localMomentId: string;
}) {
  let query = supabase
    .from("cat_moments")
    .select("id")
    .eq("local_moment_id", localMomentId)
    .limit(1);

  if (userId) {
    query = query.eq("user_id", userId);
  } else {
    query = query.is("user_id", null).eq("anonymous_id", anonymousId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn("[sleeping-delivery/exchange] existing moment lookup failed", {
      code: error.code,
    });
  }

  return { data: data as { id: string } | null, error };
}

async function readExistingOnboardingOwnMoment({
  supabase,
  localMomentId,
  submissionId,
}: {
  supabase: SupabaseClient;
  localMomentId: string;
  submissionId: string;
}) {
  const { data, error } = await supabase
    .from("cat_moments")
    .select("id")
    .eq("local_moment_id", localMomentId)
    .contains("metadata", { onboarding_submission_id: submissionId })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn(
      "[sleeping-delivery/exchange] onboarding moment lookup failed",
      { code: error.code },
    );
  }

  return { data: data as { id: string } | null, error };
}

async function transferOnboardingExchangeRows({
  supabase,
  anonymousId,
  deliveryId,
  ownPhotoId,
  submissionId,
  userId,
}: {
  supabase: SupabaseClient;
  anonymousId: string | null;
  deliveryId?: string | null;
  ownPhotoId?: string | null;
  submissionId: string;
  userId: string | null;
}) {
  const identity = userId
    ? { user_id: userId, anonymous_id: null }
    : { anonymous_id: anonymousId };
  const operations: Array<PromiseLike<{ error: { code?: string } | null }>> = [];

  if (ownPhotoId) {
    let query = supabase
      .from("cat_moments")
      .update(identity)
      .eq("local_moment_id", ownPhotoId)
      .contains("metadata", { onboarding_submission_id: submissionId });

    if (!userId) {
      query = query.is("user_id", null);
    }
    operations.push(query);
  }

  if (deliveryId) {
    let query = supabase
      .from("cat_moment_deliveries")
      .update(identity)
      .eq("local_delivery_id", deliveryId)
      .contains("metadata", { onboarding_submission_id: submissionId });

    if (!userId) {
      query = query.is("user_id", null);
    }
    operations.push(query);
  }

  const results = await Promise.all(operations);
  for (const result of results) {
    if (result.error) {
      console.warn(
        "[sleeping-delivery/exchange] onboarding identity transfer failed",
        { code: result.error.code },
      );
    }
  }
}

async function readRemoteCandidateRows(
  supabase: SupabaseClient,
) {
  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, visibility, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .eq("moderation_status", "approved")
    .order("delivery_count", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(TIERED_CANDIDATE_LIMIT);

  return (data ?? []) as RemoteCatMomentRow[];
}

async function readFastStockCandidateRows(
  supabase: SupabaseClient,
) {
  const mode = readFastCandidateMode();

  if (mode !== "admin_storage") {
    return [];
  }

  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, visibility, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("visibility", "shared")
    .eq("delivery_status", "available")
    .eq("moderation_status", "approved")
    .like("local_moment_id", "stock-sleeping-%")
    .order("created_at", { ascending: false })
    .limit(FAST_STORAGE_CANDIDATE_LIMIT);

  return (data ?? []) as FastStockCandidateRow[];
}

function readFastCandidateMode(): FastCandidateMode {
  const raw = process.env.SLEEPING_DELIVERY_FAST_CANDIDATES;

  if (raw === "admin_storage") {
    return "admin_storage";
  }

  return "tiered";
}

export function isFastStockCandidateDeliverable(
  row: FastStockCandidateRow,
  {
    userId,
    anonymousId,
    senderAnonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }: {
    userId: string | null;
    anonymousId: string | null;
    senderAnonymousId: string | null;
    recipientCatId: string | null;
    excludePhotoId: string;
    blockedPhotoIds: Set<string>;
    deliveredSourceMomentIds: Set<string>;
  },
) {
  if (row.visibility && row.visibility !== "shared") {
    return false;
  }
  if (userId && row.user_id === userId) {
    return false;
  }
  if (!userId && anonymousId && row.anonymous_id === anonymousId) {
    return false;
  }
  if (senderAnonymousId && row.anonymous_id === senderAnonymousId) {
    return false;
  }
  if (
    recipientCatId &&
    (row.local_cat_id === recipientCatId || row.owner_cat_id === recipientCatId)
  ) {
    return false;
  }
  if (row.id === excludePhotoId || row.local_moment_id === excludePhotoId) {
    return false;
  }
  if (
    deliveredSourceMomentIds.has(row.id) ||
    deliveredSourceMomentIds.has(row.local_moment_id)
  ) {
    return false;
  }

  return !blockedPhotoIds.has(row.id) && !blockedPhotoIds.has(row.local_moment_id);
}

export function isRowDeliverable(
  row: RemoteCatMomentRow,
  {
    userId,
    anonymousId,
    senderAnonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }: {
    userId: string | null;
    anonymousId: string | null;
    senderAnonymousId: string | null;
    recipientCatId: string | null;
    excludePhotoId: string;
    blockedPhotoIds: Set<string>;
    deliveredSourceMomentIds: Set<string>;
  },
) {
  if (row.visibility && row.visibility !== "shared") {
    return false;
  }
  if (isBlockedDeliveryPoolRow(row)) {
    return false;
  }
  if (row.moderation_status !== "approved") {
    return false;
  }
  if (!isUsablePhotoSrc(row.photo_url) || row.delivery_status !== "available") {
    return false;
  }
  if (userId && row.user_id === userId) {
    return false;
  }
  if (!userId && anonymousId && row.anonymous_id === anonymousId) {
    return false;
  }
  if (senderAnonymousId && row.anonymous_id === senderAnonymousId) {
    return false;
  }
  if (
    recipientCatId &&
    (row.local_cat_id === recipientCatId || row.owner_cat_id === recipientCatId)
  ) {
    return false;
  }
  if (row.id === excludePhotoId || row.local_moment_id === excludePhotoId) {
    return false;
  }
  if (
    deliveredSourceMomentIds.has(row.id) ||
    deliveredSourceMomentIds.has(row.local_moment_id)
  ) {
    return false;
  }

  return !blockedPhotoIds.has(row.id) && !blockedPhotoIds.has(row.local_moment_id);
}

async function resolvePhotoUrl(photoUrl: string, supabase: SupabaseClient) {
  const storagePath = getStoragePhotoPath(photoUrl);

  if (storagePath) {
    const { data, error } = await supabase.storage
      .from(CAT_PHOTOS_BUCKET)
      .createSignedUrl(storagePath, TRANSIENT_DELIVERY_SIGNED_URL_SECONDS);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  }

  return photoUrl;
}

async function prepareExchangeMomentPhotoUrl({
  supabase,
  userId,
  anonymousId,
  ownerCatId,
  localMomentId,
  src,
  canUseStorage,
}: {
  supabase: SupabaseClient;
  userId: string | null;
  anonymousId: string | null;
  ownerCatId: string;
  localMomentId: string;
  src: string;
  canUseStorage: boolean;
}) {
  if (!src.startsWith("data:image/") || !canUseStorage) {
    return src;
  }

  const ownerKey = userId ?? anonymousId ?? "anonymous";
  try {
    const storagePath = await uploadDataUrl(
      supabase,
      `${sanitizePathSegment(ownerKey)}/${sanitizePathSegment(ownerCatId)}/sleeping/${sanitizePathSegment(
        localMomentId,
      )}.${getDataUrlExtension(src)}`,
      src,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return src;
  }
}

async function prepareExchangeDeliveryPhotoSrc({
  supabase,
  row,
  resolvedSrc,
  canUseStorage,
}: {
  supabase: SupabaseClient;
  row: RemoteCatMomentRow;
  resolvedSrc: string;
  canUseStorage: boolean;
}) {
  if (getStoragePhotoPath(row.photo_url)) {
    return row.photo_url;
  }

  if (!row.photo_url.startsWith("data:image/") || !canUseStorage) {
    return resolvedSrc;
  }

  try {
    const storagePath = await uploadDataUrl(
      supabase,
      `delivery-cache/${sanitizePathSegment(row.local_moment_id)}.${getDataUrlExtension(
        row.photo_url,
      )}`,
      row.photo_url,
    );

    return toStoragePhotoUrl(storagePath);
  } catch {
    return resolvedSrc;
  }
}

async function incrementDeliveryCount({
  supabase,
  row,
}: {
  supabase: SupabaseClient;
  row: RemoteCatMomentRow;
}) {
  const nextDeliveryCount = Math.max(0, row.delivery_count ?? 0) + 1;
  const { error } = await supabase
    .from("cat_moments")
    .update({ delivery_count: nextDeliveryCount })
    .eq("id", row.id);

  if (error) {
    console.warn("[sleeping-delivery/exchange] delivery_count update failed", {
      code: error.code,
    });
  }
}

function sortTieredCandidates(
  rows: RemoteCatMomentRow[],
  input: Required<ExchangeRequest>,
) {
  return [...rows].sort((a, b) => {
    const tierDelta = getDeliveryTier(a, input) - getDeliveryTier(b, input);

    if (tierDelta !== 0) {
      return tierDelta;
    }

    const countDelta = (a.delivery_count ?? 0) - (b.delivery_count ?? 0);

    if (countDelta !== 0) {
      return countDelta;
    }

    return (
      hashText(`${input.seed}:${a.id}:${a.local_moment_id}`) -
      hashText(`${input.seed}:${b.id}:${b.local_moment_id}`)
    );
  });
}

function getDeliveryTier(
  row: RemoteCatMomentRow,
  input: Required<ExchangeRequest>,
): DeliveryTier {
  if (readPoolKind(row.metadata) === "admin_stock") {
    return 3;
  }

  return input.deliveryDateKey && row.pool_date === input.deliveryDateKey ? 1 : 2;
}

async function selectCandidate(
  rows: RemoteCatMomentRow[],
  input: Required<ExchangeRequest>,
  supabase: SupabaseClient,
) {
  if (rows.length === 0) {
    return null;
  }

  if (input.preferredSourcePhotoId) {
    const preferredRow = rows.find(
      (row) =>
        row.id === input.preferredSourcePhotoId ||
        row.local_moment_id === input.preferredSourcePhotoId,
    );

    const preferredCandidate = preferredRow
      ? await toResolvedCandidate(preferredRow, supabase, getDeliveryTier(preferredRow, input))
      : null;

    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const startIndex =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) %
    rows.length;

  for (let offset = 0; offset < rows.length; offset += 1) {
    const row = rows[(startIndex + offset) % rows.length];
    const candidate = await toResolvedCandidate(row, supabase, getDeliveryTier(row, input));

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function selectCandidates(
  rows: RemoteCatMomentRow[],
  input: Required<ExchangeRequest>,
  supabase: SupabaseClient,
  requestedCount: number,
) {
  if (rows.length === 0 || requestedCount <= 0) {
    return [];
  }

  const orderedRows: RemoteCatMomentRow[] = [];
  if (input.preferredSourcePhotoId) {
    const preferredRow = rows.find(
      (row) =>
        row.id === input.preferredSourcePhotoId ||
        row.local_moment_id === input.preferredSourcePhotoId,
    );
    if (preferredRow) {
      orderedRows.push(preferredRow);
    }
  }

  const startIndex =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) % rows.length;
  for (let offset = 0; offset < rows.length; offset += 1) {
    orderedRows.push(rows[(startIndex + offset) % rows.length]);
  }

  const selected: Candidate[] = [];
  const usedPhotoKeys = new Set<string>();
  const usedCatKeys = new Set<string>();
  for (const row of orderedRows) {
    if (selected.length >= requestedCount) {
      break;
    }

    const rowKeys = getCandidatePhotoKeys(row);
    const catKey = getCandidateCatKey(row);
    if (
      rowKeys.some((key) => usedPhotoKeys.has(key)) ||
      usedCatKeys.has(catKey)
    ) {
      continue;
    }

    const candidate = await toResolvedCandidate(
      row,
      supabase,
      getDeliveryTier(row, input),
    );
    if (!candidate) {
      continue;
    }

    const candidateKeys = [...rowKeys, `resolved:${candidate.src}`];
    if (candidateKeys.some((key) => usedPhotoKeys.has(key))) {
      continue;
    }

    selected.push(candidate);
    for (const key of candidateKeys) {
      usedPhotoKeys.add(key);
    }
    usedCatKeys.add(catKey);
  }

  return selected;
}

function getCandidatePhotoKeys(row: RemoteCatMomentRow) {
  return [
    `row:${row.id}`,
    `local:${row.local_moment_id}`,
    `photo:${row.photo_url}`,
  ];
}

function isPersistableEveningChoiceSource(photoUrl: string) {
  return Boolean(
    getStoragePhotoPath(photoUrl) || photoUrl.startsWith("data:image/"),
  );
}

function getCandidateCatKey(row: RemoteCatMomentRow) {
  const metadataCatKey = row.metadata?.source_cat_key;
  if (typeof metadataCatKey === "string" && metadataCatKey.trim()) {
    return `metadata:${metadataCatKey.trim()}`;
  }

  if (readPoolKind(row.metadata) === "admin_stock") {
    // Existing curated stock predates cat-level metadata. Treat each curated
    // stock moment as one cat until source_cat_key is populated.
    return `admin-stock-moment:${row.local_moment_id}`;
  }

  const ownerIdentity = row.user_id
    ? `user:${row.user_id}`
    : `anonymous:${row.anonymous_id ?? "unknown"}`;
  return `${ownerIdentity}:cat:${row.owner_cat_id || row.local_cat_id}`;
}

async function selectFastStorageCandidate(
  rows: FastStockCandidateRow[],
  input: Required<ExchangeRequest>,
  supabase: SupabaseClient,
  deliverableContext: Parameters<typeof isRowDeliverable>[1],
) {
  if (rows.length === 0) {
    return null;
  }

  if (input.preferredSourcePhotoId) {
    const preferredRow = rows.find(
      (row) =>
        row.id === input.preferredSourcePhotoId ||
        row.local_moment_id === input.preferredSourcePhotoId,
    );
    const preferredCandidate = preferredRow
      ? await fetchFastStorageCandidate(preferredRow, supabase, deliverableContext)
      : null;

    if (preferredCandidate) {
      return preferredCandidate;
    }
  }

  const startIndex =
    hashText(`${input.seed}:${input.triggerLabel}:${input.theme}`) %
    rows.length;
  const probeCount = Math.min(rows.length, FAST_STORAGE_CANDIDATE_PROBE_LIMIT);

  for (let offset = 0; offset < probeCount; offset += 1) {
    const row = rows[(startIndex + offset) % rows.length];
    const candidate = await fetchFastStorageCandidate(
      row,
      supabase,
      deliverableContext,
    );

    if (candidate) {
      return candidate;
    }
  }

  return null;
}

async function fetchFastStorageCandidate(
  row: FastStockCandidateRow,
  supabase: SupabaseClient,
  deliverableContext: Parameters<typeof isRowDeliverable>[1],
) {
  const { data } = await supabase
    .from("cat_moments")
    .select(
      "id, user_id, anonymous_id, local_moment_id, local_cat_id, owner_cat_id, photo_url, visibility, delivery_status, moderation_status, pool_date, delivery_count, metadata, created_at",
    )
    .eq("id", row.id)
    .maybeSingle();
  const fullRow = data as RemoteCatMomentRow | null;

  if (
    !fullRow ||
    !getStoragePhotoPath(fullRow.photo_url) ||
    !isRowDeliverable(fullRow, deliverableContext)
  ) {
    return null;
  }

  return toResolvedCandidate(fullRow, supabase, 3);
}

async function toResolvedCandidate(
  row: RemoteCatMomentRow,
  supabase: SupabaseClient,
  tier: DeliveryTier,
): Promise<Candidate | null> {
  if (getStoragePhotoPath(row.photo_url)) {
    return {
      row,
      src: row.photo_url,
      tags: readTags(row.metadata),
      tier,
    };
  }

  const src = await resolvePhotoUrl(row.photo_url, supabase);

  if (!src || !isUsablePhotoSrc(src)) {
    return null;
  }

  return {
    row,
    src,
    tags: readTags(row.metadata),
    tier,
  };
}

function buildDiagnostics(
  rows: RemoteCatMomentRow[],
  blockedPhotoIds: Set<string>,
) {
  const availableRows = rows.filter((row) => row.delivery_status === "available");
  const usableAvailableRows = availableRows.filter((row) =>
    isUsablePhotoSrc(row.photo_url),
  );
  const approvedRows = rows.filter((row) => row.moderation_status === "approved");
  const pendingRows = rows.filter((row) => row.moderation_status === "pending");
  const rejectedRows = rows.filter((row) => row.moderation_status === "rejected");
  const tier1Rows = usableAvailableRows.filter(
    (row) => readPoolKind(row.metadata) !== "admin_stock" && row.pool_date,
  );
  const tier3Rows = usableAvailableRows.filter(
    (row) => readPoolKind(row.metadata) === "admin_stock",
  );

  return {
    source: "none" as const,
    availableCount: availableRows.length,
    candidateCount: usableAvailableRows.length,
    normalCandidateCount: usableAvailableRows.length,
    fallbackCandidateCount: 0,
    fallbackActive: false,
    excludedCount: 0,
    unusableCount: Math.max(0, availableRows.length - usableAvailableRows.length),
    blockedCount: availableRows.filter(
      (row) => blockedPhotoIds.has(row.id) || blockedPhotoIds.has(row.local_moment_id),
    ).length,
    adminStockCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "admin_stock",
    ).length,
    userSharedCount: availableRows.filter(
      (row) => readPoolKind(row.metadata) === "user_shared",
    ).length,
    hiddenCount: rows.filter((row) => row.delivery_status === "hidden").length,
    reportedCount: rows.filter((row) => row.delivery_status === "reported").length,
    moderationPendingCount: pendingRows.length,
    moderationApprovedCount: approvedRows.length,
    moderationRejectedCount: rejectedRows.length,
    tier1CandidateCount: tier1Rows.length,
    tier2CandidateCount: Math.max(
      0,
      usableAvailableRows.length - tier1Rows.length - tier3Rows.length,
    ),
    tier3CandidateCount: tier3Rows.length,
    rlsReadable: true,
    checkedAt: new Date().toISOString(),
  };
}

function readTags(metadata: Record<string, unknown> | null) {
  const tags = ["sleeping", "ねてる"];
  const theme = metadata?.theme;
  const triggerLabel = metadata?.trigger_label;

  if (typeof theme === "string" && theme) {
    tags.push(theme);
  }
  if (typeof triggerLabel === "string" && triggerLabel) {
    tags.push(triggerLabel);
  }

  return [...new Set(tags)];
}

function readPoolKind(metadata: Record<string, unknown> | null) {
  const poolKind = metadata?.pool_kind;

  if (poolKind === "admin_stock" || poolKind === "user_shared") {
    return poolKind;
  }

  if (poolKind === "admin-stock") {
    return "admin_stock";
  }

  if (metadata?.source === "admin-stock") {
    return "admin_stock";
  }

  return "unknown";
}

function hashText(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function createExchangeTiming() {
  return {
    startedAt: Date.now(),
    marks: [] as { label: string; elapsedMs: number }[],
  };
}

function markExchangeTiming(
  timing: ReturnType<typeof createExchangeTiming>,
  label: string,
) {
  timing.marks.push({ label, elapsedMs: Date.now() - timing.startedAt });
}

function logExchangeTiming(
  timing: ReturnType<typeof createExchangeTiming>,
  details: Record<string, unknown>,
) {
  console.info("[sleeping-delivery/exchange] timing", {
    ...details,
    totalMs: Date.now() - timing.startedAt,
    marks: timing.marks,
  });
}

function toStringOrDefault(value: unknown, fallback: string) {
  return typeof value === "string" && value ? value : fallback;
}

function toStringOrNull(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

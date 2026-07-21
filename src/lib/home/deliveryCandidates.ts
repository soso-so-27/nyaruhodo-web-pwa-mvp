import {
  readBlockedExchangePhotoIds,
  type DeliverableSleepingPhotoInput,
  type ExchangePhoto,
  type ExchangePhotoPoolItem,
  type OwnSleepingPhoto,
} from "./sleepingPhotos";
import { createBrowserSupabaseClient } from "../supabase/browser";
import { getOrCreateAnonymousId } from "../identity/anonymousId";

type RemoteStockResponse = {
  photo?: ExchangePhotoPoolItem | null;
};

type SleepingExchangeResponse = {
  photo?: ExchangePhoto | null;
  photos?: ExchangePhoto[];
  source?: "remote" | "none";
  tier?: 1 | 2 | 3 | null;
  requestedCandidateCount?: number;
  returnedCandidateCount?: number;
  bundleId?: string | null;
  experienceVersion?: "evening_choice_v1";
  assignedVariant?: "four_choice_v1" | "single_v1";
  servedVariant?: "four_choice_v1" | "single_v1";
  requestedCount?: number;
  servedCount?: number;
  fallbackReason?: string | null;
  choiceResolution?: "kept" | "skipped" | "expired" | null;
  selectedPhotoId?: string | null;
  choiceResolvedAt?: string | null;
  diagnostics?: SleepingDeliveryDiagnostics;
  httpStatus?: number | null;
  error?: string | null;
  serverDateKey?: string | null;
};

const MAX_BLOCKED_PHOTO_IDS = 100;
const SLEEPING_EXCHANGE_TIMEOUT_MS = 15_000;

export type EveningChoiceCanonicalResult = {
  state: "kept" | "skipped" | "expired";
  selectedPhotoId: string | null;
  resolvedAt: string;
  conflict: boolean;
};

export type SleepingDeliveryDiagnostics = {
  source: "remote" | "none" | "error";
  availableCount: number;
  candidateCount: number;
  excludedCount: number;
  unusableCount: number;
  blockedCount: number;
  adminStockCount: number;
  userSharedCount: number;
  hiddenCount: number;
  reportedCount: number;
  moderationPendingCount?: number;
  moderationApprovedCount?: number;
  moderationRejectedCount?: number;
  tier1CandidateCount?: number;
  tier2CandidateCount?: number;
  tier3CandidateCount?: number;
  duplicateExcludedCount?: number;
  recirculationPolicy?: string;
  permanentExcludedCount?: number;
  recentExposureExcludedCount?: number;
  eligibleRecycledCount?: number;
  servedRecycledCount?: number;
  totalSharedRows?: number;
  blockedRows?: number;
  storageExcludedRows?: number;
  deliverableRows?: number;
  dataImageDeliverableRows?: number;
  httpDeliverableRows?: number;
  storageRows?: number;
  rlsReadable: boolean;
  lastError?: string | null;
  checkedAt: string;
};

export async function createSleepingExchange({
  ownPhoto,
  triggerLabel,
  theme,
  category,
  seed,
  deliveryDateKey,
  recipientCatId,
  preferredSourcePhotoId,
  requestedCandidateCount,
  capability,
  mode,
  onboardingSubmission,
}: DeliverableSleepingPhotoInput & {
  ownPhoto: OwnSleepingPhoto;
  preferredSourcePhotoId?: string | null;
  requestedCandidateCount?: number;
  capability?: "evening_choice_v1";
  mode?: "onboarding";
  onboardingSubmission?: {
    dateKey: string;
    journeyId?: string | null;
    resumeToken: string;
    source: string;
    submissionId: string;
  } | null;
}): Promise<SleepingExchangeResponse | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort("exchange_timeout"),
    SLEEPING_EXCHANGE_TIMEOUT_MS,
  );

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const supabase = createBrowserSupabaseClient();

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    const response = await fetch("/api/sleeping-delivery/exchange", {
      method: "POST",
      headers,
      signal: abortController.signal,
      body: JSON.stringify({
        ownPhoto: {
          id: ownPhoto.id,
          catId: ownPhoto.catId,
          ownerCatId: ownPhoto.ownerCatId,
          src: ownPhoto.src,
          createdAt: ownPhoto.createdAt,
          triggerLabel: ownPhoto.triggerLabel,
          theme: ownPhoto.theme,
          shared: ownPhoto.shared ?? ownPhoto.visibility === "shared",
        },
        triggerLabel,
        theme,
        category,
        seed,
        deliveryDateKey,
        recipientCatId,
        anonymousId: getOrCreateAnonymousId(),
        blockedPhotoIds: readBlockedExchangePhotoIdList(),
        preferredSourcePhotoId,
        requestedCandidateCount,
        capability,
        mode,
        onboardingSubmission,
      }),
    });

    if (!response.ok) {
      const error = await readExchangeError(response);
      return {
        photo: null,
        source: "none",
        httpStatus: response.status,
        error,
      };
    }

    const body = (await response.json()) as SleepingExchangeResponse;
    return { ...body, httpStatus: response.status };
  } catch (error) {
    return {
      photo: null,
      source: "none",
      httpStatus: null,
      error: abortController.signal.aborted
        ? "exchange_timeout"
        : formatFetchFailure(error),
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function finalizeEveningDeliveryChoice({
  operation,
  bundleId,
  deliveryDateKey,
  selectedPhotoId,
}: {
  operation: "keep" | "skip";
  bundleId: string;
  deliveryDateKey: string;
  selectedPhotoId?: string | null;
}): Promise<EveningChoiceCanonicalResult | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort("choice_timeout"),
    SLEEPING_EXCHANGE_TIMEOUT_MS,
  );

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const supabase = createBrowserSupabaseClient();

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    const response = await fetch("/api/sleeping-delivery/choice", {
      method: "POST",
      headers,
      signal: abortController.signal,
      body: JSON.stringify({
        operation,
        bundleId,
        deliveryDateKey,
        selectedPhotoId: operation === "keep" ? selectedPhotoId : null,
        anonymousId: getOrCreateAnonymousId(),
      }),
    });

    if (response.status !== 200 && response.status !== 409) {
      return null;
    }

    const body = (await response.json()) as {
      state?: unknown;
      selectedPhotoId?: unknown;
      resolvedAt?: unknown;
      canonical?: {
        state?: unknown;
        selectedPhotoId?: unknown;
        resolvedAt?: unknown;
      };
    };
    const canonical = response.status === 409 ? body.canonical : body;
    if (!isEveningChoiceCanonical(canonical)) {
      return null;
    }

    return {
      state: canonical.state,
      selectedPhotoId: canonical.selectedPhotoId,
      resolvedAt: canonical.resolvedAt,
      conflict: response.status === 409,
    };
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function readExchangeError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

function formatFetchFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "fetch_failed";
  const online =
    typeof navigator === "undefined" ? "unknown" : String(navigator.onLine);
  const visibility =
    typeof document === "undefined" ? "unknown" : document.visibilityState;

  return `${name}: ${message}; online:${online}; visibility:${visibility}`;
}

export async function saveRemoteDeliveryStockPhoto(src: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const supabase = createBrowserSupabaseClient();

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    const response = await fetch("/api/sleeping-delivery/stock", {
      method: "POST",
      headers,
      body: JSON.stringify({ src }),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as RemoteStockResponse;

    return result.photo ?? null;
  } catch {
    return null;
  }
}

export async function readSleepingDeliveryDiagnostics() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const supabase = createBrowserSupabaseClient();

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    const response = await fetch("/api/sleeping-delivery/diagnostics", {
      method: "POST",
      headers,
      body: JSON.stringify({
        anonymousId: getOrCreateAnonymousId(),
        blockedPhotoIds: readBlockedExchangePhotoIdList(),
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SleepingDeliveryDiagnostics;
  } catch {
    return null;
  }
}

function readBlockedExchangePhotoIdList() {
  return [...readBlockedExchangePhotoIds()].slice(0, MAX_BLOCKED_PHOTO_IDS);
}

function isEveningChoiceCanonical(value: unknown): value is {
  state: "kept" | "skipped" | "expired";
  selectedPhotoId: string | null;
  resolvedAt: string;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const canonical = value as Record<string, unknown>;
  const state = canonical.state;
  const selectedPhotoId = canonical.selectedPhotoId;
  return (
    (state === "kept" || state === "skipped" || state === "expired") &&
    typeof canonical.resolvedAt === "string" &&
    (selectedPhotoId === null || typeof selectedPhotoId === "string") &&
    (state !== "kept" || typeof selectedPhotoId === "string")
  );
}

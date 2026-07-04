"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { readClientAdminCapabilities } from "../../lib/adminCapabilitiesClient";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  createSleepingExchange,
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  keepExchangePhoto,
  readOwnSleepingPhotos,
  saveOwnSleepingPhoto,
  updateKeptExchangePhotoDataUrl,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import {
  getEveningDeliveryCompletionCopy,
  getJstDateKey,
  markEveningDeliveryKept,
  markEveningDeliveryOpened,
  recordEveningDeliveryTarget,
  setEveningDeliveredPhoto,
  updateEveningDeliveredPhotoDataUrl,
} from "../../lib/home/eveningDelivery";
import {
  createOnboardingSubmissionId,
  getOrCreateOnboardingAnonymousId,
  normalizeOnboardingSource,
  patchOnboardingProgress,
  readCurrentOnboardingProgress,
  writeOnboardingProgress,
  type OnboardingProgress,
  type OnboardingSource,
} from "../../lib/onboarding/progress";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { isUsablePhotoSrc } from "../../lib/photoStorage";
import { storeAccountPhotoDataUrl } from "../../lib/photoStorageClient";
import {
  getActiveCatProfile,
  isCatProfileNameUnset,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  updateCatProfileName,
} from "../home/homeInputHelpers";
import { AppButton } from "../ui/AppButton";
import { PhotoTile } from "../ui/PhotoTile";
import { WordmarkHeader } from "../ui/AppHeader";

type OnboardingState =
  | "intro"
  | "saving"
  | "naming"
  | "envelope"
  | "revealing"
  | "delivered"
  | "empty"
  | "kept";

const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";
const ONBOARDING_FALLBACK_DELIVERY_SRC =
  "/illustrations/sleeping-cat-empty.webp";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MAX_UPLOAD_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const ONBOARDING_REVEAL_MS = 1150;
const SUPPORTED_SOURCE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function OnboardingFlow() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>("intro");
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState("");
  const [deliveredPhoto, setDeliveredPhoto] = useState<ExchangePhoto | null>(null);
  const [isDeliveredPhotoKept, setIsDeliveredPhotoKept] = useState(false);
  const [pendingOwnPhoto, setPendingOwnPhoto] = useState<OwnSleepingPhoto | null>(null);
  const [message, setMessage] = useState("");
  const [isCandidateAdding, setIsCandidateAdding] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [completionCopy, setCompletionCopy] = useState("");
  const [entrySource, setEntrySource] = useState<OnboardingSource>(
    readOnboardingSourceFromLocation,
  );
  const [isOpeningEnvelope, setIsOpeningEnvelope] = useState(false);
  const [catNameDraft, setCatNameDraft] = useState("");
  const prefersReducedMotion = usePrefersReducedMotion();
  const autoKeptDeliveredPhotoIdRef = useRef("");
  const hasTrackedIntroViewRef = useRef(false);
  const hasResolvedProgressRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const isOpeningEnvelopeRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const revealStartedAtRef = useRef<number | null>(null);
  const revealPhotoLoadedTrackedRef = useRef("");
  const revealPhotoErrorTrackedRef = useRef("");
  const catNamePromptTrackedPhotoRef = useRef("");
  const entrySourceRef = useRef<OnboardingSource>(entrySource);
  const canShowTestTools = isTestMode && !IS_PRODUCTION;

  function markOnboardingAlbumCompletionReady() {
    window.sessionStorage.setItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY, "true");
  }

  function getEffectiveEntrySource() {
    const currentSource = entrySourceRef.current;

    if (hasReferralQueryInLocation()) {
      entrySourceRef.current = "referral";
      setEntrySource("referral");
      return "referral";
    }

    if (currentSource !== "direct") {
      return currentSource;
    }

    if (readOnboardingSourceFromLocation() === "referral") {
      entrySourceRef.current = "referral";
      setEntrySource("referral");
      return "referral";
    }

    try {
      if (window.localStorage.getItem(STORAGE_KEYS.pendingReferralCode)) {
        entrySourceRef.current = "referral";
        setEntrySource("referral");
        return "referral";
      }
    } catch {
      // Source correction is best-effort only.
    }

    return currentSource;
  }

  useEffect(() => {
    let isMounted = true;

    async function resolveTestMode() {
      const requestedTestMode = new URLSearchParams(window.location.search).has("test");

      if (!requestedTestMode) {
        return;
      }

      const capabilities = await readClientAdminCapabilities();

      if (isMounted) {
        setIsTestMode(capabilities.testToolsEnabled);
      }
    }

    void resolveTestMode();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasResolvedProgressRef.current) {
      return;
    }

    const source = readOnboardingSourceFromLocation();
    setEntrySource(source);
    entrySourceRef.current = source;
    hasResolvedProgressRef.current = true;
    resolveOnboardingProgress(source);
  }, []);

  useEffect(() => {
    if (state !== "delivered" || !deliveredPhoto || isDeliveredPhotoKept) {
      return;
    }

    if (autoKeptDeliveredPhotoIdRef.current === deliveredPhoto.id) {
      return;
    }

    autoKeptDeliveredPhotoIdRef.current = deliveredPhoto.id;
    void keepDeliveredPhotoForOnboarding();
  }, [state, deliveredPhoto, isDeliveredPhotoKept]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state === "envelope" || state === "revealing") {
      return;
    }

    setIsOpeningEnvelope(false);
    isOpeningEnvelopeRef.current = false;
  }, [state]);

  useEffect(() => {
    revealStartedAtRef.current = null;
    revealPhotoLoadedTrackedRef.current = "";
    revealPhotoErrorTrackedRef.current = "";
  }, [deliveredPhoto?.id]);

  function resolveOnboardingProgress(source: OnboardingSource) {
    const progress = readCurrentOnboardingProgress();

    if (restoreExistingProgress(progress, source)) {
      return;
    }

    if (
      (source === "direct" || source === "referral") &&
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) === "true"
    ) {
      if (!hasCompletedOnboardingEvidence()) {
        window.localStorage.removeItem(STORAGE_KEYS.onboardingCompleted);
        trackProductEvent("onboarding_stale_completion_cleared", {
          source,
          surface: "onboarding",
        });
        trackOnboardingIntroView(source);
        return;
      }

      router.replace("/home");
      return;
    }

    trackOnboardingIntroView(source);
  }

  function restoreExistingProgress(
    progress: OnboardingProgress | null,
    source: OnboardingSource,
  ) {
    if (!progress) {
      return false;
    }

    if (progress.stage === "album_created") {
      router.replace("/home");
      return true;
    }

    if (progress.stage === "opened") {
      router.replace(
        `/account/create?from=onboarding&source=${encodeURIComponent(source)}`,
      );
      return true;
    }

    if (progress.stage === "arrived" && progress.deliveredPhoto) {
      setSelectedPhotoSrc(progress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(progress.ownPhoto ?? null);
      setDeliveredPhoto(progress.deliveredPhoto);
      setIsDeliveredPhotoKept(progress.isDeliveredPhotoKept ?? true);
      setCompletionCopy(progress.completionCopy ?? "");
      setState("envelope");
      return true;
    }

    if (progress.stage === "name_pending" && progress.ownPhoto && progress.deliveredPhoto) {
      setSelectedPhotoSrc(progress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(progress.ownPhoto);
      setDeliveredPhoto(progress.deliveredPhoto);
      setIsDeliveredPhotoKept(false);
      setCatNameDraft("");
      setState("naming");
      trackCatNamePromptView(progress.ownPhoto.id);
      return true;
    }

    if (progress.stage === "name_pending" && progress.ownPhoto) {
      setSelectedPhotoSrc(progress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(progress.ownPhoto);
      setIsDeliveredPhotoKept(false);
      setState("saving");
      void resumeSubmittedProgress({ ...progress, stage: "submitted" });
      return true;
    }

    if (progress.stage === "submitted" && progress.ownPhoto) {
      setSelectedPhotoSrc(progress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(progress.ownPhoto);
      setIsDeliveredPhotoKept(false);
      setState("saving");
      void resumeSubmittedProgress(progress);
      return true;
    }

    return false;
  }

  async function resumeSubmittedProgress(progress: OnboardingProgress) {
    if (isSubmittingRef.current) {
      return;
    }

    isSubmittingRef.current = true;
    setMessage("");

    try {
      const delivered = await deliverOwnSleepingPhoto({
        ownPhoto: progress.ownPhoto!,
        recipientCatId: progress.ownPhoto!.catId,
        deliveryDateKey: progress.dateKey,
        submissionId: progress.submissionId,
        selectedPhotoSrc: progress.selectedPhotoSrc,
        emptyMessage: canShowTestTools
          ? "ねがおは入りました。とどく候補がまだありません。テスト用に候補を追加できます。"
          : "ねがおは入りました。今日はまだ、とどくねがおを準備中です。",
      });

      if (!delivered) {
        setState("empty");
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }

  function trackOnboardingIntroView(source: OnboardingSource) {
    if (hasTrackedIntroViewRef.current) {
      return;
    }

    hasTrackedIntroViewRef.current = true;
    trackProductEvent("onboarding_intro_view", {
      source,
    });
  }

  async function handleSelectSleepingPhoto() {
    if (state === "saving" || isSubmittingRef.current) {
      return;
    }

    const restored = restoreExistingProgress(
      readCurrentOnboardingProgress(),
      getEffectiveEntrySource(),
    );

    if (restored) {
      return;
    }

    trackProductEvent("onboarding_submit_photo_click", {
      source: getEffectiveEntrySource(),
    });
    trackProductEvent("onboarding_photo_select_click", {
      source: getEffectiveEntrySource(),
    });

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    const cleanupInput = () => {
      window.setTimeout(() => {
        input.remove();
      }, 0);
    };

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file || !isLikelyImageFile(file)) {
        setMessage("写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください。");
        cleanupInput();
        return;
      }

      setState("saving");
      isSubmittingRef.current = true;
      setMessage("");

      try {
        const profiles = readCatProfiles();
        const activeProfile = getActiveCatProfile(profiles, readActiveCatId());
        const catId = activeProfile.id;

        saveActiveCatId(catId);
        const savedResult = await saveSleepingPhotoWithFallback(file, catId);

        if (!savedResult) {
          setMessage("写真を保存できませんでした。少し時間をおいて、もう一度試してください。");
          setState("intro");
          return;
        }

        const { dataUrl, ownPhoto } = savedResult;
        setSelectedPhotoSrc(dataUrl);
        setPendingOwnPhoto(ownPhoto);
        setIsDeliveredPhotoKept(false);
        autoKeptDeliveredPhotoIdRef.current = "";
        const eveningTarget = recordEveningDeliveryTarget(ownPhoto);
        const onboardingDateKey = getJstDateKey();
        const anonymousId = getOrCreateOnboardingAnonymousId();
        const submissionId = createOnboardingSubmissionId(
          anonymousId,
          onboardingDateKey,
        );
        writeOnboardingProgress({
          version: 1,
          anonymousId,
          dateKey: onboardingDateKey,
          stage: "submitted",
          source: getEffectiveEntrySource(),
          submissionId,
          ownPhoto,
          selectedPhotoSrc: dataUrl,
          updatedAt: Date.now(),
        });
        trackProductEvent("take_photo", {
          catId,
          hour: new Date().getHours(),
          isExchangeTarget: eveningTarget.isExchangeTarget,
          source: "onboarding",
          delivery_date_key: eveningTarget.dateKey,
        });
        trackProductEvent("onboarding_photo_submitted", {
          catId,
          source: getEffectiveEntrySource(),
          submission_id: submissionId,
          delivery_date_key: eveningTarget.dateKey,
        });
        trackProductEvent("photo_submitted", {
          catId,
          source: getEffectiveEntrySource(),
          surface: "onboarding",
          submission_id: submissionId,
          delivery_date_key: eveningTarget.dateKey,
        });

        const delivered = await deliverOwnSleepingPhoto({
          ownPhoto,
          recipientCatId: catId,
          deliveryDateKey: onboardingDateKey,
          submissionId,
          selectedPhotoSrc: dataUrl,
          emptyMessage: canShowTestTools
            ? "ねがおは入りました。とどく候補がまだありません。テスト用に候補を追加できます。"
            : "ねがおは入りました。今日はまだ、とどくねがおを準備中です。",
        });

        if (!delivered) {
          setMessage(
            canShowTestTools
              ? "ねがおは入りました。とどく候補がまだありません。テスト用に候補を追加できます。"
              : "ねがおは入りました。今日はまだ、とどくねがおを準備中です。",
          );
          setState("empty");
          return;
        }
      } catch (error) {
        trackProductEvent("photo_upload_error", {
          source: getEffectiveEntrySource(),
          surface: "onboarding",
          error_code: "onboarding_photo_save_failed",
          error_message:
            error instanceof Error ? error.message : "onboarding photo save failed",
        });
        setMessage("写真を保存できませんでした。少し時間をおいて、もう一度試してください。");
        setState("intro");
      } finally {
        isSubmittingRef.current = false;
        cleanupInput();
      }
    };

    document.body.appendChild(input);
    input.click();
  }

  function trackCatNamePromptView(photoId?: string | null) {
    const key = photoId ?? pendingOwnPhoto?.id ?? "unknown";

    if (catNamePromptTrackedPhotoRef.current === key) {
      return;
    }

    catNamePromptTrackedPhotoRef.current = key;
    trackProductEvent("cat_name_prompt_view", {
      source: getEffectiveEntrySource(),
      surface: "onboarding",
    });
  }

  async function handleContinueAfterCatName(skip = false) {
    if (isSubmittingRef.current) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const ownPhoto = pendingOwnPhoto ?? progress?.ownPhoto ?? null;

    if (!ownPhoto) {
      setState("intro");
      return;
    }

    const deliveryDateKey = progress?.dateKey ?? getJstDateKey();
    const anonymousId =
      progress?.anonymousId ?? getOrCreateOnboardingAnonymousId();
    const submissionId =
      progress?.submissionId ??
      createOnboardingSubmissionId(anonymousId, deliveryDateKey);
    const selectedPhotoSrcForProgress =
      selectedPhotoSrc || progress?.selectedPhotoSrc || ownPhoto.src;
    const nextName = skip ? "" : catNameDraft.trim();

    isSubmittingRef.current = true;

    if (nextName) {
      updateCatProfileName(readCatProfiles(), ownPhoto.ownerCatId, nextName);
      trackProductEvent("cat_name_entered", {
        source: getEffectiveEntrySource(),
        surface: "onboarding",
      });
    } else {
      trackProductEvent("cat_name_skipped", {
        source: getEffectiveEntrySource(),
        surface: "onboarding",
      });
    }

    patchOnboardingProgress({
      stage: "opened",
      source: getEffectiveEntrySource(),
      ownPhoto,
      selectedPhotoSrc: selectedPhotoSrcForProgress,
      deliveredPhoto: deliveredPhoto ?? progress?.deliveredPhoto,
      isDeliveredPhotoKept: true,
    });
    markOnboardingAlbumCompletionReady();
    router.push(
      `/account/create?from=onboarding&source=${encodeURIComponent(getEffectiveEntrySource())}`,
    );
  }

  function handleContinueAfterDeliveredPhoto() {
    if (!isDeliveredPhotoKept) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const ownPhoto = pendingOwnPhoto ?? progress?.ownPhoto ?? null;
    const activeProfile = getActiveCatProfile(
      readCatProfiles(),
      ownPhoto?.ownerCatId ?? readActiveCatId(),
    );

    if (ownPhoto && isCatProfileNameUnset(activeProfile)) {
      patchOnboardingProgress({
        stage: "name_pending",
        source: getEffectiveEntrySource(),
        ownPhoto,
        selectedPhotoSrc: selectedPhotoSrc || progress?.selectedPhotoSrc,
        deliveredPhoto: deliveredPhoto ?? progress?.deliveredPhoto,
        isDeliveredPhotoKept: true,
      });
      setCatNameDraft("");
      trackCatNamePromptView(ownPhoto.id);
      setState("naming");
      return;
    }

    markOnboardingAlbumCompletionReady();
    router.push(
      `/account/create?from=onboarding&source=${encodeURIComponent(getEffectiveEntrySource())}`,
    );
  }

  async function keepDeliveredPhotoForOnboarding() {
    if (!deliveredPhoto) {
      return;
    }

    const keepResult = await keepExchangePhotoForAlbum(deliveredPhoto);
    setDeliveredPhoto(keepResult.photo);
    trackProductEvent("onboarding_delivered_photo_confirmed", {
      source: getEffectiveEntrySource(),
      source_photo_id: keepResult.photo.sourcePhotoId ?? null,
      saved_to_album: keepResult.saved,
      test_mode: canShowTestTools,
    });

    if (!keepResult.saved) {
      setMessage("ねがおはとどきましたが、アルバムに保存できませんでした。設定の保存状態を確認してください。");
      return;
    }

    setIsDeliveredPhotoKept(true);
    patchOnboardingProgress({
      stage: "opened",
      source: getEffectiveEntrySource(),
      deliveredPhoto: keepResult.photo,
      isDeliveredPhotoKept: keepResult.saved,
      completionCopy: getEveningDeliveryCompletionCopy(),
    });
    const progress = readCurrentOnboardingProgress();
    if (progress?.dateKey) {
      markEveningDeliveryKept(progress.dateKey);
    }

    if (!isTestMode) {
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      setCompletionCopy(getEveningDeliveryCompletionCopy());
      trackProductEvent("onboarding_completed", {
        source: getEffectiveEntrySource(),
        method: "delivery_kept",
        photo_id: keepResult.photo.id,
        delivery_photo_id: keepResult.photo.id,
      });
    }
  }

  function handleDeliveredPhotoDataUrl(dataUrl: string) {
    if (!deliveredPhoto || !dataUrl.startsWith("data:image/")) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const nextPhoto =
      progress?.dateKey
        ? updateEveningDeliveredPhotoDataUrl(progress.dateKey, dataUrl)
        : null;
    const photoWithDataUrl =
      nextPhoto ?? {
        ...deliveredPhoto,
        src: dataUrl,
        thumbnailSrc: dataUrl,
        displaySrc: dataUrl,
        originalSrc: dataUrl,
      };

    setDeliveredPhoto(photoWithDataUrl);
    updateKeptExchangePhotoDataUrl(photoWithDataUrl, dataUrl);
    patchOnboardingProgress({
      stage: progress?.stage ?? "opened",
      deliveredPhoto: photoWithDataUrl,
      isDeliveredPhotoKept,
    });
  }

  function handleOpenEnvelope() {
    if (!deliveredPhoto) {
      return;
    }

    if (isOpeningEnvelopeRef.current) {
      return;
    }

    isOpeningEnvelopeRef.current = true;
    setIsOpeningEnvelope(true);
    const startedAt = performance.now();
    revealStartedAtRef.current = startedAt;
    trackOnboardingRevealEvent("delivery_reveal_started", 0);
    trackProductEvent("envelope_opened", {
      source: "onboarding",
      photo_id: deliveredPhoto.id,
    });
    trackProductEvent("onboarding_delivery_opened", {
      source: getEffectiveEntrySource(),
      photo_id: deliveredPhoto.id,
      delivery_photo_id: deliveredPhoto.id,
    });
    patchOnboardingProgress({
      stage: "opened",
      source: getEffectiveEntrySource(),
      deliveredPhoto,
      isDeliveredPhotoKept,
    });
    const progress = readCurrentOnboardingProgress();
    if (progress?.dateKey) {
      markEveningDeliveryOpened(progress.dateKey);
    }

    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (prefersReducedMotion) {
      trackOnboardingRevealEvent("delivery_reveal_skipped", 0);
      setState("delivered");
      return;
    }

    setState("revealing");
    revealTimerRef.current = window.setTimeout(() => {
      revealTimerRef.current = null;
      trackOnboardingRevealEvent(
        "delivery_reveal_completed",
        performance.now() - startedAt,
      );
      setState("delivered");
    }, ONBOARDING_REVEAL_MS);
  }

  function getOnboardingRevealLatencyMs() {
    const startedAt = revealStartedAtRef.current;
    return startedAt ? performance.now() - startedAt : 0;
  }

  function trackOnboardingRevealEvent(
    name: string,
    latencyMs = getOnboardingRevealLatencyMs(),
  ) {
    trackProductEvent(name, {
      latency_ms: Math.max(0, Math.round(latencyMs)),
      route: "/onboarding",
      source: getEffectiveEntrySource(),
      surface: "onboarding",
      reduced_motion: prefersReducedMotion,
    });
  }

  function handleRevealPhotoLoaded() {
    if (!deliveredPhoto) {
      return;
    }

    if (revealPhotoLoadedTrackedRef.current === deliveredPhoto.id) {
      return;
    }

    revealPhotoLoadedTrackedRef.current = deliveredPhoto.id;
    trackOnboardingRevealEvent("delivery_reveal_photo_loaded");
  }

  function handleRevealPhotoError() {
    if (!deliveredPhoto) {
      return;
    }

    if (revealPhotoErrorTrackedRef.current === deliveredPhoto.id) {
      return;
    }

    revealPhotoErrorTrackedRef.current = deliveredPhoto.id;
    trackOnboardingRevealEvent("delivery_reveal_photo_error");
  }

  async function deliverOwnSleepingPhoto({
    ownPhoto,
    recipientCatId,
    emptyMessage,
    preferredSourcePhotoId,
    deliveryDateKey,
    submissionId,
    selectedPhotoSrc: selectedPhotoSrcForProgress,
  }: {
    ownPhoto: OwnSleepingPhoto;
    recipientCatId: string;
    emptyMessage: string;
    preferredSourcePhotoId?: string | null;
    deliveryDateKey?: string | null;
    submissionId?: string | null;
    selectedPhotoSrc?: string;
  }) {
    const exchangeResult = await createSleepingExchange({
      ownPhoto,
      triggerLabel: "ねがお",
      theme: "sleeping",
      category: "sleeping",
      seed: submissionId ?? `${ownPhoto.id}:${deliveryDateKey ?? Date.now()}`,
      deliveryDateKey: deliveryDateKey ?? undefined,
      recipientCatId,
      preferredSourcePhotoId,
      mode: "onboarding",
    });

    let nextPhoto = exchangeResult?.photo ?? null;
    let deliverySource = exchangeResult?.photo ? "exchange" : "illustration_fallback";

    if (!nextPhoto && canShowTestTools) {
      trackProductEvent("onboarding_sleeping_photo_delivered", {
        source: entrySource,
        has_delivered_photo: false,
        candidate_count: exchangeResult?.diagnostics?.candidateCount ?? null,
        available_count: exchangeResult?.diagnostics?.availableCount ?? null,
        excluded_count: exchangeResult?.diagnostics?.excludedCount ?? null,
      });
      setMessage(emptyMessage);
      return false;
    }

    if (!nextPhoto || !isUsablePhotoSrc(nextPhoto.src)) {
      nextPhoto = await createOnboardingFallbackDeliveryPhoto(ownPhoto, nextPhoto);
      deliverySource = "illustration_fallback";
    }

    trackProductEvent("onboarding_sleeping_photo_delivered", {
      source: entrySource,
      has_delivered_photo: Boolean(nextPhoto),
      delivery_source: deliverySource,
      candidate_count: exchangeResult?.diagnostics?.candidateCount ?? null,
      available_count: exchangeResult?.diagnostics?.availableCount ?? null,
      excluded_count: exchangeResult?.diagnostics?.excludedCount ?? null,
    });

    if (!nextPhoto) {
      setMessage(emptyMessage);
      return false;
    }

    setDeliveredPhoto(nextPhoto);
    setIsDeliveredPhotoKept(false);
    if (deliveryDateKey) {
      setEveningDeliveredPhoto(deliveryDateKey, nextPhoto);
    }
    patchOnboardingProgress({
      stage: "arrived",
      source: getEffectiveEntrySource(),
      dateKey: deliveryDateKey ?? undefined,
      submissionId: submissionId ?? undefined,
      ownPhoto,
      selectedPhotoSrc: selectedPhotoSrcForProgress,
      deliveredPhoto: nextPhoto,
      isDeliveredPhotoKept: false,
    });
    trackProductEvent("onboarding_delivery_ready", {
      source: getEffectiveEntrySource(),
      delivery_source: deliverySource,
      photo_id: nextPhoto.id,
    });
    trackProductEvent("onboarding_delivery_arrived", {
      source: getEffectiveEntrySource(),
      delivery_source: deliverySource,
      photo_id: nextPhoto.id,
      delivery_photo_id: nextPhoto.id,
      submission_id: submissionId ?? null,
      delivery_date_key: deliveryDateKey ?? null,
    });
    trackProductEvent("envelope_shown", {
      source: "onboarding",
      photo_id: nextPhoto.id,
    });
    setState("envelope");
    return true;
  }

  async function handleAddCandidatePhoto() {
    if (!canShowTestTools) {
      return;
    }

    if (isCandidateAdding) {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.tabIndex = -1;
    input.setAttribute("aria-hidden", "true");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    input.style.top = "0";
    input.style.width = "1px";
    input.style.height = "1px";
    input.style.opacity = "0";

    const cleanupInput = () => {
      window.setTimeout(() => {
        input.remove();
      }, 0);
    };

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file || !isLikelyImageFile(file)) {
        setMessage("写真を選べませんでした。別の写真でもう一度試してください。");
        cleanupInput();
        return;
      }

      setIsCandidateAdding(true);
      setMessage("");

      try {
        const saved = await saveStockCandidateWithFallback(file);

        if (!saved) {
          setMessage("候補写真を保存できませんでした。別の写真でもう一度試してください。");
          return;
        }

        trackProductEvent("onboarding_test_candidate_added", {
          source_photo_id: saved.sourceOwnPhotoId ?? saved.id,
        });

        if (!pendingOwnPhoto) {
          setMessage("とどく候補を追加しました。もう一度ねてるねこを入れるととどきます。");
          setState("intro");
          return;
        }

        const delivered = await deliverOwnSleepingPhoto({
          ownPhoto: pendingOwnPhoto,
          recipientCatId: pendingOwnPhoto.catId,
          preferredSourcePhotoId: saved.sourceOwnPhotoId ?? saved.id,
          deliveryDateKey: readCurrentOnboardingProgress()?.dateKey,
          submissionId: readCurrentOnboardingProgress()?.submissionId,
          selectedPhotoSrc,
          emptyMessage:
            "とどく候補を追加しましたが、まだ受け取れませんでした。設定のとどく状態を確認してください。",
        });

        if (!delivered) {
          setState("empty");
        }
      } catch {
        setMessage("候補写真を保存できませんでした。");
      } finally {
        setIsCandidateAdding(false);
        cleanupInput();
      }
    };

    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (!input.files?.length) {
        input.remove();
      }
    }, 60000);
  }

  function handleGoHome() {
    trackProductEvent("onboarding_skip", {
      source: getEffectiveEntrySource(),
      state,
      test_mode: canShowTestTools,
    });
    trackProductEvent("onboarding_skip_click", {
      source: getEffectiveEntrySource(),
      state,
      test_mode: canShowTestTools,
    });

    if (canShowTestTools) {
      router.push("/settings");
      return;
    }

    router.push("/home");
  }

  return (
    <main style={styles.page}>
      <style>{`
        @keyframes onboardingDots {
          0% { transform: translateX(-10px); opacity: 0.24; }
          45% { opacity: 0.72; }
          100% { transform: translateX(10px); opacity: 0.24; }
        }
        @keyframes deliveredEnvelope {
          0% { transform: translateY(8px) scale(0.94); opacity: 0; }
          55% { transform: translateY(-2px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes deliveredPhotoIn {
          0% { transform: translateY(18px) scale(0.9); opacity: 0; filter: blur(5px); }
          65% { transform: translateY(-2px) scale(1.015); opacity: 1; filter: blur(0); }
          100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
        }
        @keyframes ownPhotoSend {
          0% { transform: translateX(0) scale(1); opacity: 0.74; }
          100% { transform: translateX(4px) scale(1); opacity: 0.64; }
        }
        @keyframes onboardingEnvelopeFloat {
          0%, 100% { transform: translateY(0) rotate(-0.8deg); }
          50% { transform: translateY(-5px) rotate(0.5deg); }
        }
      `}</style>
      <div style={styles.paperBackground} aria-hidden="true" />
      <div style={styles.container}>
        <WordmarkHeader style={styles.brandHeader} />

        {state === "intro" || state === "saving" ? (
          <section style={styles.hero} aria-label="ねてるねこのはじめかた">
            <div style={styles.introArtifact} aria-hidden="true">
              <img
                src="/illustrations/sleeping-cat-empty.webp"
                alt=""
                style={styles.introCat}
              />
              <OnboardingEnvelopeArt compact />
            </div>
            <h1 style={styles.title}>
              ねがおを入れると
              <br />
              ねこだよりが届きます
            </h1>
            <p style={styles.lead}>
              自分のねこの写真を1枚入れると、
              <br />
              どこかのねこの寝顔が1枚届きます。
              <br />
              <br />
              入れた写真は、ねてるねこの中で
              <br />
              名前を出さずに届くことがあります。
              <br />
              <br />
              SNSなど外には出ません。
              <br />
              名前や場所も出ません。
            </p>
            {state === "saving" ? (
              <DeliveryWaiting />
            ) : null}
            <AppButton
              type="button"
              onClick={() => {
                void handleSelectSleepingPhoto();
              }}
              fullWidth
              style={styles.onboardingCta}
              disabled={state === "saving"}
            >
              {state === "saving" ? "ねこだよりを準備しています…" : "ねがおを1枚入れる"}
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "naming" ? (
          <section style={styles.result} aria-label="この子の名前">
            <p style={styles.kicker}>
              {deliveredPhoto
                ? "届いたねこだよりをしまいました"
                : "ねがおをおあずかりしました"}
            </p>
            {selectedPhotoSrc ? (
              <img src={selectedPhotoSrc} alt="" style={styles.namePreviewPhoto} />
            ) : null}
            <h2 style={styles.subTitle}>この子の名前は？</h2>
            <p style={styles.resultText}>
              名前を入れると、あとから見返しやすくなります。
              <br />
              外には出ません。
              <br />
              あとから変えられます。
            </p>
            <form
              style={styles.nameForm}
              onSubmit={(event) => {
                event.preventDefault();
                void handleContinueAfterCatName(false);
              }}
            >
              <input
                value={catNameDraft}
                onChange={(event) => setCatNameDraft(event.currentTarget.value)}
                placeholder="例：むぎ"
                maxLength={24}
                autoComplete="off"
                inputMode="text"
                style={styles.nameInput}
                aria-label="この子の名前"
              />
              <AppButton
                type="submit"
                fullWidth
                style={styles.onboardingCta}
                disabled={isSubmittingRef.current}
              >
                名前を入れて進む
              </AppButton>
            </form>
            <AppButton
              type="button"
              variant="quiet"
              size="md"
              onClick={() => {
                void handleContinueAfterCatName(true);
              }}
            >
              名前なしで進む
            </AppButton>
          </section>
        ) : null}

        {state === "envelope" && deliveredPhoto ? (
          <section style={styles.result} aria-label="ねがおがとどいています">
            <OnboardingEnvelopeArt />
            <span style={styles.deliveryPhotoPreload} aria-hidden="true">
              <PhotoTile
                src={getExchangePhotoDisplaySrc(deliveredPhoto)}
                fallbackSrcs={getExchangePhotoFallbackSrcs(deliveredPhoto)}
                loading="eager"
                onStorageDataUrl={handleDeliveredPhotoDataUrl}
                onLoad={handleRevealPhotoLoaded}
                onError={handleRevealPhotoError}
              />
            </span>
            <h2 style={styles.subTitle}>
              ねこだよりが
              <br />
              届きました
            </h2>
            <button
              type="button"
              onClick={handleOpenEnvelope}
              disabled={isOpeningEnvelope}
              aria-busy={isOpeningEnvelope}
              style={{
                ...styles.deliveryEnvelopeButton,
                ...(isOpeningEnvelope ? styles.deliveryEnvelopeButtonBusy : {}),
              }}
            >
              ねこだよりを開く
            </button>
          </section>
        ) : null}

        {state === "revealing" && deliveredPhoto ? (
          <section style={styles.result} aria-label="どこかのねがお">
            <div style={styles.revealingPhotoFrame}>
              <PhotoTile
                src={getExchangePhotoDisplaySrc(deliveredPhoto)}
                fallbackSrcs={getExchangePhotoFallbackSrcs(deliveredPhoto)}
                imageStyle={styles.revealingPhoto}
                onStorageDataUrl={handleDeliveredPhotoDataUrl}
                onLoad={handleRevealPhotoLoaded}
                onError={handleRevealPhotoError}
              />
            </div>
          </section>
        ) : null}

        {state === "delivered" && deliveredPhoto ? (
          <section style={styles.result} aria-label="とどいたねがお">
            <p style={styles.kicker}>ねこだよりが届きました</p>
            {selectedPhotoSrc ? (
              <div style={styles.deliveredMoment}>
                <PhotoTile
                  src={getExchangePhotoDisplaySrc(deliveredPhoto)}
                  fallbackSrcs={getExchangePhotoFallbackSrcs(deliveredPhoto)}
                  style={styles.deliveredPhotoTile}
                  imageStyle={styles.deliveredPhoto}
                  onStorageDataUrl={handleDeliveredPhotoDataUrl}
                  onLoad={handleRevealPhotoLoaded}
                  onError={handleRevealPhotoError}
                />
                <PhotoTile
                  src={selectedPhotoSrc}
                  muted
                  style={styles.ownPhotoTile}
                  imageStyle={styles.ownPhoto}
                />
              </div>
            ) : (
              <PhotoTile
                src={getExchangePhotoDisplaySrc(deliveredPhoto)}
                fallbackSrcs={getExchangePhotoFallbackSrcs(deliveredPhoto)}
                style={styles.deliveredPhotoTile}
                imageStyle={styles.deliveredPhoto}
                onStorageDataUrl={handleDeliveredPhotoDataUrl}
                onLoad={handleRevealPhotoLoaded}
                onError={handleRevealPhotoError}
              />
            )}
            <p style={styles.resultText}>
              {isDeliveredPhotoKept
                ? (
                    <>
                      届いたねこだよりを
                      <br />
                      しまいました。
                      <br />
                      <br />
                      あなたのねがおは、
                      <br />
                      夜8時の便りになります。
                    </>
                  )
                : "届いた写真を、ねこだよりに入れています。"}
            </p>
            <AppButton
              type="button"
              onClick={
                isDeliveredPhotoKept
                  ? handleContinueAfterDeliveredPhoto
                  : undefined
              }
              disabled={!isDeliveredPhotoKept}
              fullWidth
              style={styles.onboardingCta}
            >
              {isDeliveredPhotoKept ? "つづける" : "ねこだよりに入れています..."}
            </AppButton>
            <AppButton type="button" variant="quiet" size="md" onClick={handleGoHome}>
              閉じる
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "empty" ? (
          <section style={styles.result} aria-label="ねがおを保存しました">
            <p style={styles.kicker}>ねがおが入りました</p>
            {selectedPhotoSrc ? (
              <img src={selectedPhotoSrc} alt="" style={styles.savedPhoto} />
            ) : null}
            <p style={styles.resultText}>
              {canShowTestTools
                ? "とどく候補がまだありません。テスト用に、ここで候補を追加できます。"
                : "今日はまだ、届くねこだよりを準備中です。"}
            </p>
            {canShowTestTools ? (
              <AppButton
                type="button"
                onClick={() => {
                  void handleAddCandidatePhoto();
                }}
                fullWidth
                style={styles.onboardingCta}
                disabled={isCandidateAdding}
              >
                {isCandidateAdding ? "追加しています..." : "とどく候補を追加する"}
              </AppButton>
            ) : null}
            <AppButton type="button" variant="quiet" size="md" onClick={handleGoHome}>
              ねてるねこへ
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "kept" ? (
          <section style={styles.result} aria-label="とっておきました">
            <p style={styles.kicker}>とっておきました</p>
            {completionCopy ? (
              <p style={styles.resultText}>{completionCopy}</p>
            ) : null}
            <h2 style={styles.subTitle}>
              また寝ていたら、
              <br />
              ホームから送れます
            </h2>
            <AppButton
              type="button"
              onClick={handleGoHome}
              fullWidth
              style={styles.onboardingCta}
            >
              ホームへ戻る
            </AppButton>
            <AppButton
              href={`/account/create?from=onboarding&source=${encodeURIComponent(entrySource)}`}
              variant="quiet"
              size="md"
              onClick={markOnboardingAlbumCompletionReady}
            >
              うちのこを登録する
            </AppButton>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function OnboardingEnvelopeArt({ compact = false }: { compact?: boolean }) {
  return (
    <span
      style={{
        ...styles.onboardingEnvelopeArt,
        ...(compact ? styles.onboardingEnvelopeArtCompact : {}),
      }}
      aria-hidden="true"
    >
      <span style={styles.onboardingEnvelopeShadow} />
      <img
        src="/illustrations/onboarding-envelope.webp"
        alt=""
        style={styles.onboardingEnvelopeImage}
      />
    </span>
  );
}

function DeliveryWaiting() {
  return (
    <div style={styles.deliveryWaiting} aria-live="polite">
      <span style={styles.deliveryWaitingLine}>
        <span style={styles.deliveryWaitingDot} />
      </span>
      <span style={styles.deliveryWaitingText}>
        ねがおを
        <br />
        おあずかりしました
      </span>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    if (!media) {
      return;
    }

    const updatePreference = () => setPrefersReducedMotion(media.matches);
    updatePreference();
    media.addEventListener?.("change", updatePreference);

    return () => media.removeEventListener?.("change", updatePreference);
  }, []);

  return prefersReducedMotion;
}

function readOnboardingSourceFromLocation() {
  if (typeof window === "undefined") {
    return "direct" satisfies OnboardingSource;
  }

  if (hasReferralQueryInLocation()) {
    return "referral" satisfies OnboardingSource;
  }

  return normalizeOnboardingSource(
    new URLSearchParams(window.location.search).get("source"),
  );
}

function hasReferralQueryInLocation() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.has("ref") || params.has("referral") || params.has("invite");
}

async function createOnboardingFallbackDeliveryPhoto(
  ownPhoto: OwnSleepingPhoto,
  basePhoto?: ExchangePhoto | null,
): Promise<ExchangePhoto | null> {
  const fallbackSrc = await loadImageAssetAsDataUrl(ONBOARDING_FALLBACK_DELIVERY_SRC);
  const src = fallbackSrc && isUsablePhotoSrc(fallbackSrc)
    ? fallbackSrc
    : basePhoto?.src ?? "";

  if (!isUsablePhotoSrc(src)) {
    return null;
  }

  return {
    id: basePhoto?.id ?? `onboarding-fallback-${ownPhoto.id}`,
    sourcePhotoId: basePhoto?.sourcePhotoId ?? `onboarding-fallback-${ownPhoto.id}`,
    src,
    thumbnailSrc: basePhoto?.thumbnailSrc,
    displaySrc: basePhoto?.displaySrc,
    originalSrc: basePhoto?.originalSrc,
    title: basePhoto?.title ?? "ねこだより",
    subtitle: basePhoto?.subtitle ?? "どこかのねがお",
    triggerLabel: basePhoto?.triggerLabel ?? "ねがお",
    theme: basePhoto?.theme ?? "sleeping",
    deliveredAt: basePhoto?.deliveredAt ?? Date.now(),
  };
}

async function loadImageAssetAsDataUrl(src: string) {
  try {
    const response = await fetch(src, { cache: "force-cache" });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => {
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function resizeAndEncode(
  file: File,
  maxSize = 1100,
  quality = 0.78,
  mimeType = "image/jpeg",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      try {
        const encoded = canvas.toDataURL(mimeType, quality);
        resolve(
          encoded.startsWith(`data:${mimeType};`)
            ? encoded
            : canvas.toDataURL("image/jpeg", quality),
        );
      } catch (error) {
        reject(error);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    image.src = url;
  });
}

async function saveSleepingPhotoWithFallback(file: File, catId: string) {
  const createdAt = Date.now();
  const fileName = `onboarding-${createdAt}`;
  const [thumbnailDataUrl, displayDataUrl] = await Promise.all([
    resizeAndEncode(file, 512, 0.72, "image/webp"),
    resizeAndEncode(file, 2048, 0.84, "image/webp"),
  ]);
  const exchangeDataUrl = await createOnboardingExchangeDataUrl(
    file,
    displayDataUrl,
  );
  const storedDisplaySrc = await storeAccountPhotoDataUrl({
    dataUrl: displayDataUrl,
    pathSegments: ["onboarding", catId, "display"],
    fileName,
  });
  const canUseStorage = isStoragePhotoReference(storedDisplaySrc);
  const storedThumbnailSrc = canUseStorage
    ? await storeAccountPhotoDataUrl({
        dataUrl: thumbnailDataUrl,
        pathSegments: ["onboarding", catId, "thumbnail"],
        fileName,
      })
    : null;
  const attempts: Array<{
    src: string;
    displaySrc?: string;
    thumbnailSrc?: string;
  }> = [
    {
      src: canUseStorage ? storedDisplaySrc : exchangeDataUrl,
      displaySrc: canUseStorage ? storedDisplaySrc : undefined,
      thumbnailSrc: isStoragePhotoReference(storedThumbnailSrc)
        ? storedThumbnailSrc
        : undefined,
    },
    {
      src: exchangeDataUrl,
      displaySrc: canUseStorage ? storedDisplaySrc : undefined,
      thumbnailSrc: isStoragePhotoReference(storedThumbnailSrc)
        ? storedThumbnailSrc
        : undefined,
    },
    { src: await resizeAndEncode(file, 560, 0.66) },
    { src: await resizeAndEncode(file, 420, 0.58) },
    { src: await resizeAndEncode(file, 320, 0.5) },
    { src: await resizeAndEncode(file, 240, 0.42) },
  ];
  const triedSrcs = new Set<string>();

  for (const attempt of attempts) {
    if (!attempt.src || triedSrcs.has(attempt.src)) {
      continue;
    }

    triedSrcs.add(attempt.src);
    const ownPhoto = saveOwnSleepingPhoto({
      catId,
      src: attempt.src,
      thumbnailSrc: attempt.thumbnailSrc,
      displaySrc: attempt.displaySrc,
      originalSrc: canUseStorage ? storedDisplaySrc : undefined,
      triggerLabel: "ねがお",
      theme: "sleeping",
      shared: true,
      minRetainedCount: 1,
    });

    if (ownPhoto) {
      return { dataUrl: exchangeDataUrl, ownPhoto };
    }
  }

  const fallbackOwnPhoto = createOnboardingOwnPhotoFallback({
    catId,
    src: exchangeDataUrl,
    displaySrc: canUseStorage ? storedDisplaySrc : undefined,
    thumbnailSrc: isStoragePhotoReference(storedThumbnailSrc)
      ? storedThumbnailSrc
      : undefined,
    createdAt,
  });

  return { dataUrl: exchangeDataUrl, ownPhoto: fallbackOwnPhoto };
}

function isStoragePhotoReference(src: string | null | undefined): src is string {
  return Boolean(src?.startsWith("storage:") || src?.startsWith("storage://"));
}

async function createOnboardingExchangeDataUrl(
  file: File,
  preferredDataUrl: string,
) {
  if (preferredDataUrl.length <= 1_900_000) {
    return preferredDataUrl;
  }

  for (const attempt of [
    { maxSize: 1200, quality: 0.8 },
    { maxSize: 900, quality: 0.76 },
    { maxSize: 720, quality: 0.72 },
    { maxSize: 560, quality: 0.68 },
  ]) {
    const dataUrl = await resizeAndEncode(
      file,
      attempt.maxSize,
      attempt.quality,
      "image/webp",
    );

    if (dataUrl.length <= 1_900_000) {
      return dataUrl;
    }
  }

  return resizeAndEncode(file, 420, 0.62, "image/webp");
}

function createOnboardingOwnPhotoFallback({
  catId,
  src,
  displaySrc,
  thumbnailSrc,
  createdAt,
}: {
  catId: string;
  src: string;
  displaySrc?: string;
  thumbnailSrc?: string;
  createdAt: number;
}): OwnSleepingPhoto {
  return {
    id: `onboarding-${createdAt}-${Math.random().toString(16).slice(2)}`,
    ownerCatId: catId,
    catId,
    src,
    ...(thumbnailSrc ? { thumbnailSrc } : {}),
    ...(displaySrc ? { displaySrc } : {}),
    ...(displaySrc ? { originalSrc: displaySrc } : {}),
    state: "sleeping",
    visibility: "shared",
    deliveryStatus: "available",
    triggerLabel: "ねがお",
    theme: "sleeping",
    shared: true,
    createdAt,
  };
}

function hasCompletedOnboardingEvidence() {
  const progress = readCurrentOnboardingProgress();

  if (progress?.stage === "album_created" || progress?.stage === "opened") {
    return true;
  }

  return readOwnSleepingPhotos().length > 0;
}

async function saveStockCandidateWithFallback(file: File) {
  const attempts = [
    { maxSize: 560, quality: 0.66 },
    { maxSize: 420, quality: 0.58 },
    { maxSize: 320, quality: 0.5 },
    { maxSize: 240, quality: 0.42 },
  ];

  for (const attempt of attempts) {
    const dataUrl = await resizeAndEncode(file, attempt.maxSize, attempt.quality);
    const saved = await saveRemoteDeliveryStockPhoto(dataUrl);

    if (saved) {
      return saved;
    }
  }

  return null;
}

function isLikelyImageFile(file: File) {
  if (file.size > MAX_UPLOAD_SOURCE_FILE_BYTES) {
    return false;
  }

  if (file.type) {
    return SUPPORTED_SOURCE_IMAGE_MIME_TYPES.has(file.type.toLowerCase());
  }

  return /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

async function keepExchangePhotoForAlbum(photo: ExchangePhoto) {
  const candidates = await createAlbumPhotoCandidates(photo);

  for (const candidate of candidates) {
    if (keepExchangePhoto(candidate)) {
      return { photo: candidate, saved: true };
    }
  }

  return { photo: candidates[0] ?? photo, saved: false };
}

function getExchangePhotoDisplaySrc(photo: ExchangePhoto) {
  return (
    [photo.displaySrc, photo.thumbnailSrc, photo.originalSrc, photo.src].find(
      (src) => typeof src === "string" && isUsablePhotoSrc(src),
    ) ?? photo.src
  );
}

function getExchangePhotoFallbackSrcs(photo: ExchangePhoto) {
  return [photo.thumbnailSrc, photo.originalSrc, photo.src].filter(
    (src): src is string => typeof src === "string" && isUsablePhotoSrc(src),
  );
}

async function createAlbumPhotoCandidates(photo: ExchangePhoto) {
  if (!photo.src.startsWith("data:image/")) {
    return [photo];
  }

  const candidates: ExchangePhoto[] = [];
  const seenSrcs = new Set<string>();

  for (const attempt of [
    { maxSize: 420, quality: 0.62 },
    { maxSize: 320, quality: 0.56 },
    { maxSize: 240, quality: 0.5 },
    { maxSize: 180, quality: 0.44 },
  ]) {
    const compressedSrc = await resizeDataUrl(
      photo.src,
      attempt.maxSize,
      attempt.quality,
    );

    if (compressedSrc && isUsablePhotoSrc(compressedSrc) && !seenSrcs.has(compressedSrc)) {
      seenSrcs.add(compressedSrc);
      candidates.push({ ...photo, src: compressedSrc });
    }
  }

  if (isUsablePhotoSrc(photo.src) && !seenSrcs.has(photo.src)) {
    candidates.push(photo);
  }

  return candidates;
}

function resizeDataUrl(
  src: string,
  maxSize = 420,
  quality = 0.62,
): Promise<string | null> {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(null);
      }
    };

    image.onerror = () => {
      resolve(null);
    };

    image.src = src;
  });
}

const UI_FONT = "var(--font-ui)";

const styles = {
  page: {
    position: "relative",
    minHeight: "100dvh",
    overflow: "hidden",
    color: "#2f2a25",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif',
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  container: {
    position: "relative",
    zIndex: 1,
    width: "min(100%, 430px)",
    minHeight: "100dvh",
    margin: "0 auto",
    padding:
      "calc(42px + env(safe-area-inset-top)) 28px calc(34px + env(safe-area-inset-bottom))",
    display: "grid",
    alignContent: "center",
    boxSizing: "border-box",
  },
  brandHeader: {
    position: "fixed",
    top: "calc(42px + env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    paddingTop: 0,
  },
  hero: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "13px",
  },
  introArtifact: {
    position: "relative",
    width: "min(74vw, 260px)",
    height: "154px",
    display: "grid",
    placeItems: "center",
    margin: "-4px 0 10px",
  },
  introCat: {
    position: "absolute",
    zIndex: 2,
    top: "0",
    left: "50%",
    width: "94px",
    height: "94px",
    objectFit: "contain",
    transform: "translateX(-50%)",
    filter:
      "drop-shadow(0 10px 14px rgba(92,70,46,0.08)) saturate(0.94)",
  },
  onboardingEnvelopeArt: {
    position: "relative",
    display: "block",
    width: "min(82vw, 304px)",
    aspectRatio: "1375 / 664",
    margin: "0 auto",
    animation: "onboardingEnvelopeFloat 4.8s ease-in-out infinite",
  },
  onboardingEnvelopeArtCompact: {
    position: "absolute",
    zIndex: 1,
    bottom: "0",
    width: "200px",
    opacity: 0.94,
  },
  onboardingEnvelopeShadow: {
    position: "absolute",
    left: "12%",
    right: "12%",
    bottom: "1px",
    height: "18px",
    borderRadius: "999px",
    background:
      "radial-gradient(ellipse at center, rgba(92,70,46,0.14), transparent 70%)",
    filter: "blur(2px)",
  },
  onboardingEnvelopeImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "contain",
    filter: "drop-shadow(0 14px 22px rgba(68,50,32,0.08))",
  },
  title: {
    margin: "8px 0 0",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "22px",
    fontWeight: 400,
    lineHeight: 1.56,
    letterSpacing: "0.04em",
  },
  lead: {
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
  deliveryWaiting: {
    display: "grid",
    justifyItems: "center",
    gap: "9px",
    margin: "4px 0 -2px",
    padding: "12px 18px 13px",
    border: "1px solid rgba(144,126,102,0.1)",
    borderRadius: "var(--radius-xl)",
    background: "rgba(255,253,248,0.48)",
    boxShadow: "0 5px 14px rgba(90,76,60,0.035)",
  },
  deliveryWaitingLine: {
    position: "relative",
    width: "112px",
    height: "2px",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    background:
      "repeating-linear-gradient(90deg, rgba(142,128,110,0.24) 0 4px, transparent 4px 10px)",
  },
  deliveryWaitingDot: {
    position: "absolute",
    top: "-2px",
    left: "50%",
    width: "6px",
    height: "6px",
    borderRadius: "var(--radius-full)",
    background: "rgba(154,134,107,0.7)",
    animation: "onboardingDots 1.1s ease-in-out infinite alternate",
  },
  deliveryWaitingText: {
    color: "#746a5f",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.45,
    letterSpacing: 0,
  },
  namePreviewPhoto: {
    width: "min(48vw, 168px)",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: "26px",
    border: "7px solid rgba(255,253,248,0.82)",
    boxShadow: "0 16px 36px -24px rgba(66,48,31,0.46)",
  },
  nameForm: {
    width: "min(100%, 292px)",
    display: "grid",
    justifyItems: "center",
    gap: "12px",
  },
  nameInput: {
    width: "100%",
    minHeight: "54px",
    boxSizing: "border-box",
    border: "1px solid rgba(120,108,94,0.18)",
    borderRadius: "var(--radius-full)",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.94), rgba(250,244,235,0.86))",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "17px",
    fontWeight: 400,
    lineHeight: 1.4,
    letterSpacing: "0.03em",
    textAlign: "center",
    padding: "0 20px",
    outline: "none",
    boxShadow:
      "0 1px 0 rgba(255,255,255,0.55) inset, 0 14px 30px -26px rgba(90,76,60,0.36)",
  },
  onboardingCta: {
    width: "min(100%, 280px)",
    marginTop: "16px",
  },
  onboardingCtaLink: {
    width: "min(100%, 280px)",
    marginTop: "20px",
  },
  message: {
    margin: "2px 0 0",
    width: "min(100%, 280px)",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,253,248,0.64)",
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.55,
    padding: "10px 12px",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  result: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "17px",
  },
  kicker: {
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.03em",
  },
  subTitle: {
    margin: "6px 0 0",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "22px",
    fontWeight: 400,
    lineHeight: 1.56,
    letterSpacing: "0.04em",
  },
  deliveryEnvelopeButton: {
    width: "min(100%, 260px)",
    minHeight: "54px",
    border: "1px solid color-mix(in srgb, var(--seal) 28%, var(--line) 72%)",
    borderRadius: "var(--radius-full)",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.94), rgba(250,244,235,0.88))",
    color: "var(--seal)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow:
      "0 1px 0 rgba(255,255,255,0.5) inset, 0 16px 30px -24px rgba(90,76,60,0.42)",
    fontFamily: UI_FONT,
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1,
    letterSpacing: "0.03em",
    cursor: "pointer",
    animation: "deliveredEnvelope 460ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  deliveryEnvelopeButtonBusy: {
    cursor: "default",
    opacity: 0.72,
    transform: "translateY(1px) scale(0.992)",
  },
  deliveryPhotoPreload: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
    pointerEvents: "none",
  },
  revealingPhotoFrame: {
    width: "min(100%, 292px)",
    display: "grid",
    justifyItems: "center",
    animation: "deliveredPhotoIn 780ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  revealingPhoto: {
    width: "min(72vw, 268px)",
    height: "min(72vw, 268px)",
    objectFit: "cover",
    borderRadius: "var(--radius-2xl)",
    boxShadow: "0 18px 44px rgba(90,76,60,0.12)",
  },
  deliveredMoment: {
    position: "relative",
    width: "min(100%, 292px)",
    minHeight: "318px",
    display: "grid",
    justifyItems: "center",
    alignItems: "start",
    margin: "2px 0 0",
  },
  photoItem: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
  },
  singleDeliveredPhoto: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
  },
  deliveredPhotoTile: {
    position: "relative",
    zIndex: 2,
  },
  ownPhotoTile: {
    position: "absolute",
    zIndex: 3,
    right: "2px",
    bottom: "4px",
    transform: "rotate(3.2deg)",
  },
  ownPhoto: {
    width: "92px",
    height: "92px",
    objectFit: "cover",
    borderRadius: "20px",
    opacity: 0.78,
    border: "6px solid rgba(255,253,248,0.82)",
    boxShadow: "0 12px 24px -14px rgba(72,54,35,0.42)",
    animation: "ownPhotoSend 560ms ease-out both",
  },
  deliveredPhoto: {
    width: "min(74vw, 268px)",
    height: "min(74vw, 268px)",
    objectFit: "cover",
    borderRadius: "28px",
    border: "8px solid rgba(255,253,248,0.86)",
    boxShadow: "0 22px 46px -24px rgba(66,48,31,0.5)",
    animation: "deliveredPhotoIn 620ms 120ms cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  photoLabel: {
    color: "#8a8174",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.3,
    letterSpacing: "0.04em",
  },
  savedPhoto: {
    width: "min(100%, 260px)",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "var(--radius-2xl)",
    border: "7px solid rgba(255,253,248,0.82)",
    boxShadow: "0 14px 34px rgba(90,76,60,0.12)",
  },
  resultText: {
    width: "min(100%, 286px)",
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;

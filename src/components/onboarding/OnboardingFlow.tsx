"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { readClientAdminCapabilities } from "../../lib/adminCapabilitiesClient";
import {
  fallBackCatIllustrationImage,
  useCatIllustrationAssets,
} from "../../lib/assets/catIllustrationAssets";
import { STORAGE_KEYS } from "../../lib/storage";
import {
  createSleepingExchange,
  finalizeOnboardingDeliveryChoice,
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  deleteOwnSleepingPhoto,
  keepExchangePhoto,
  persistOwnSleepingPhotoHistory,
  saveOwnSleepingPhoto,
  updateKeptExchangePhotoDataUrl,
  updateKeptExchangePhotoDimensions,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import {
  clearEveningDeliveryTargetForPhoto,
  getEveningDeliveryCompletionCopy,
  getJstDateKey,
  recordOnboardingEveningDeliveryTarget,
} from "../../lib/home/eveningDelivery";
import {
  createOnboardingSubmissionId,
  getOrCreateOnboardingAnonymousId,
  markOnboardingAlbumCreated,
  patchOnboardingProgress,
  patchOnboardingProgressDurably,
  readCurrentOnboardingProgress,
  readCurrentOnboardingProgressDurably,
  readOnboardingProgress,
  readOnboardingSourceFromLocation,
  writeOnboardingProgressDurably,
  type OnboardingProgress,
  type OnboardingSource,
} from "../../lib/onboarding/progress";
import { createOnboardingHandoff } from "../../lib/onboarding/handoff";
import {
  clearOnboardingCompletionMarker,
  hasCompletedOnboardingEvidence,
  hasOnboardingCompletionMarker,
} from "../../lib/onboarding/completion";
import { getOrCreateOnboardingJourney } from "../../lib/onboarding/journey";
import { createOnboardingOwnPhotoId } from "../../lib/onboarding/journeyContract";
import { getOnboardingExchangeLedgerInput } from "../../lib/onboarding/submissionClient";
import { consumeOnboardingTestResetRequest } from "../../lib/onboarding/testReset";
import { resolveOnboardingResumeDecision } from "../../lib/onboarding/stateMachine";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { isEmbeddedInAppBrowser } from "../../lib/displayEnvironment";
import { HOME_INSTALL_ONBOARDING_COMPLETED_EVENT } from "../../lib/homeInstall";
import {
  validateImageFile,
  type ImageFileRejectionReason,
} from "../../lib/imageFileValidation";
import {
  readImageFileDimensions,
  resizeImageFileToDataUrl,
} from "../../lib/imageResize";
import { isUsablePhotoSrc } from "../../lib/photoStorage";
import {
  getPhotoAspectRatio,
  resolvePhotoFallbackSrcs,
  resolvePhotoSrc,
} from "../../lib/photoSources";
import { storeAccountPhotoDataUrl } from "../../lib/photoStorageClient";
import { queueOriginalPhotoPreservation } from "../../lib/photoOriginals";
import {
  getActiveCatProfile,
  isCatProfileNameUnset,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  updateCatProfileName,
} from "../home/homeInputHelpers";
import { AppButton } from "../ui/AppButton";
import { CameraIcon, LockIcon, MailIcon } from "../ui/AppIcons";
import { PhotoTile } from "../ui/PhotoTile";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";
import { WordmarkHeader } from "../ui/AppHeader";
import { deliveredLetterStyles } from "../ui/deliveredLetterStyles";
import { useNaturalPhotoFrame } from "../ui/useNaturalPhotoFrame";

type OnboardingState =
  | "intro"
  | "saving"
  | "naming"
  | "envelope"
  | "delivered"
  | "empty"
  | "kept";

type OnboardingDeliveryIssue = "no_candidate" | "temporary_error";
type OnboardingSavingStage = "saving_photo" | "receiving_letter";

type OnboardingPhotoDebugInfo = {
  stage: string;
  fileName: string;
  fileType: string;
  fileExtension: string;
  fileSize: string;
  lastModified: string;
  browser: string;
  errorMessage?: string;
};

const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";
const ONBOARDING_PHOTO_DEBUG_STORAGE_KEY = "neteruneko_onboarding_photo_debug";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const ONBOARDING_REVEAL_MS = 180;

export function OnboardingFlow() {
  const catIllustrations = useCatIllustrationAssets();
  const router = useRouter();
  const [state, setState] = useState<OnboardingState>("intro");
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState("");
  const [deliveredPhoto, setDeliveredPhoto] = useState<ExchangePhoto | null>(null);
  const [deliveredPhotos, setDeliveredPhotos] = useState<ExchangePhoto[]>([]);
  const [deliveryBundleId, setDeliveryBundleId] = useState<string | null>(null);
  const [selectedDeliveryPhotoId, setSelectedDeliveryPhotoId] = useState<
    string | null
  >(null);
  const [isFinalizingDeliveryChoice, setIsFinalizingDeliveryChoice] =
    useState(false);
  const [deliveryChoiceError, setDeliveryChoiceError] = useState("");
  const [localizedDeliveredPhoto, setLocalizedDeliveredPhoto] = useState<{
    photoId: string;
    dataUrl: string;
  } | null>(null);
  const [isDeliveredPhotoKept, setIsDeliveredPhotoKept] = useState(false);
  const [pendingOwnPhoto, setPendingOwnPhoto] = useState<OwnSleepingPhoto | null>(null);
  const [message, setMessage] = useState("");
  const [deliveryIssue, setDeliveryIssue] =
    useState<OnboardingDeliveryIssue | null>(null);
  const [savingStage, setSavingStage] =
    useState<OnboardingSavingStage>("saving_photo");
  const [isPhotoDebugMode, setIsPhotoDebugMode] = useState(false);
  const [photoDebugInfo, setPhotoDebugInfo] =
    useState<OnboardingPhotoDebugInfo | null>(null);
  const [isCandidateAdding, setIsCandidateAdding] = useState(false);
  const [isTestMode, setIsTestMode] = useState(false);
  const [completionCopy, setCompletionCopy] = useState("");
  const [entrySource, setEntrySource] = useState<OnboardingSource>(
    readOnboardingSourceFromLocation,
  );
  const [isExternalBrowserGuideDismissed, setIsExternalBrowserGuideDismissed] =
    useState(false);
  const [isPreparingExternalBrowserHandoff, setIsPreparingExternalBrowserHandoff] =
    useState(false);
  const [externalBrowserHandoffError, setExternalBrowserHandoffError] =
    useState("");
  const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(false);
  const [isOpeningEnvelope, setIsOpeningEnvelope] = useState(false);
  const [isRetryingDelivery, setIsRetryingDelivery] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [hasRevealPhotoError, setHasRevealPhotoError] = useState(false);
  const [isRevealPhotoReady, setIsRevealPhotoReady] = useState(false);
  const [revealPhotoRetryKey, setRevealPhotoRetryKey] = useState(0);
  const {
    frameStyle: naturalDeliveredPhotoFrameStyle,
    handleNaturalSize: applyDeliveredPhotoNaturalSize,
    photoAspect: deliveredPhotoAspect,
    resetPhotoAspect: resetDeliveredPhotoAspect,
  } = useNaturalPhotoFrame({
    horizontalInsetPx: 56,
    maxWidthPx: 350,
    verticalChromePx: 272,
    initialAspect: getPhotoAspectRatio(deliveredPhoto),
    photoKey: deliveredPhoto?.id,
  });
  const [catNameDraft, setCatNameDraft] = useState("");
  const prefersReducedMotion = usePrefersReducedMotion();
  const autoKeptDeliveredPhotoIdRef = useRef("");
  const hasTrackedIntroViewRef = useRef(false);
  const hasTrackedEmbeddedBrowserRef = useRef(false);
  const hasResolvedProgressRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const isPhotoPickerOpenRef = useRef(false);
  const isOpeningEnvelopeRef = useRef(false);
  const isContinuingRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const revealStartedAtRef = useRef<number | null>(null);
  const revealPhotoLoadedTrackedRef = useRef("");
  const revealPhotoRenderedTrackedRef = useRef("");
  const revealPhotoErrorTrackedRef = useRef("");
  const catNamePromptTrackedPhotoRef = useRef("");
  const entrySourceRef = useRef<OnboardingSource>(entrySource);
  const canShowTestTools = isTestMode && !IS_PRODUCTION;
  const hasOnboardingPhotoChoice = Boolean(
    deliveryBundleId &&
      deliveredPhotos.length > 0 &&
      deliveredPhotos.length <= 4,
  );
  const selectedDeliveryPhoto =
    deliveredPhotos.find((photo) => photo.id === selectedDeliveryPhotoId) ??
    null;

  useEffect(() => {
    resetDeliveredPhotoAspect();
  }, [deliveredPhoto?.id, resetDeliveredPhotoAspect]);

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

  function ensureOnboardingEveningDeliveryReservation({
    ownPhoto,
    submissionId,
    source,
    trigger,
  }: {
    ownPhoto: OwnSleepingPhoto;
    submissionId: string;
    source: OnboardingSource;
    trigger: "initial" | "resume" | "reentry";
  }) {
    const target = recordOnboardingEveningDeliveryTarget(ownPhoto);
    const commonProperties = {
      surface: "onboarding",
      source,
      reservation_origin: "onboarding_first_photo",
      reservation_trigger: trigger,
      experience_version: "onboarding_choice_v1",
      submission_id: submissionId,
      own_photo_id: ownPhoto.id,
    };
    const options = {
      localCatId: ownPhoto.ownerCatId ?? ownPhoto.catId,
    };

    if (!target) {
      trackProductEvent(
        trigger === "initial"
          ? "evening_delivery_reservation_failed"
          : "evening_delivery_reservation_skipped",
        {
          ...commonProperties,
          ...(trigger === "initial"
            ? { error_code: "onboarding_target_expired" }
            : { reason: "onboarding_target_expired" }),
        },
        options,
      );
      return null;
    }

    if (target.outcome === "already_reserved") {
      return target;
    }

    if (target.outcome === "existing_target_preserved") {
      trackProductEvent(
        "evening_delivery_reservation_skipped",
        {
          ...commonProperties,
          delivery_date_key: target.dateKey,
          reason: "existing_target_preserved",
        },
        options,
      );
      return target;
    }

    if (target.outcome === "reserved") {
      trackProductEvent(
        "evening_delivery_reserved",
        {
          ...commonProperties,
          delivery_date_key: target.dateKey,
          is_today_delivery: target.isTodayDelivery,
        },
        options,
      );
      return target;
    }

    trackProductEvent(
      "evening_delivery_reservation_failed",
      {
        ...commonProperties,
        delivery_date_key: target.dateKey,
        error_code:
          target.outcome === "write_failed"
            ? "local_target_save_failed"
            : "delivery_slot_unavailable",
      },
      options,
    );
    return target;
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
    const enabled = readOnboardingPhotoDebugEnabled();

    setIsPhotoDebugMode(enabled);
    setIsEmbeddedBrowser(isEmbeddedInAppBrowser());
  }, []);

  useEffect(() => {
    if (
      !isEmbeddedBrowser ||
      (state !== "delivered" && state !== "naming")
    ) {
      return;
    }

    router.prefetch(
      `/account/create?from=onboarding&source=${encodeURIComponent(
        entrySource,
      )}&embedded=1`,
    );
  }, [entrySource, isEmbeddedBrowser, router, state]);

  useEffect(() => {
    if (!isEmbeddedBrowser || hasTrackedEmbeddedBrowserRef.current) {
      return;
    }

    hasTrackedEmbeddedBrowserRef.current = true;
    trackProductEvent("inapp_browser_detected", {
      source: entrySource,
      surface: "onboarding",
    });
  }, [entrySource, isEmbeddedBrowser]);

  useEffect(() => {
    if (hasResolvedProgressRef.current) {
      return;
    }

    hasResolvedProgressRef.current = true;
    void (async () => {
      const didReset = await consumeOnboardingTestResetRequest();
      const source = readOnboardingSourceFromLocation();
      setEntrySource(source);
      entrySourceRef.current = source;

      if (!didReset) {
        const progress = await readCurrentOnboardingProgressDurably().catch(() =>
          readCurrentOnboardingProgress(),
        );
        resolveOnboardingProgress(source, progress);
        return;
      }

      setSelectedPhotoSrc("");
      setDeliveredPhoto(null);
      setDeliveredPhotos([]);
      setDeliveryBundleId(null);
      setSelectedDeliveryPhotoId(null);
      setPendingOwnPhoto(null);
      setIsDeliveredPhotoKept(false);
      setCompletionCopy("");
      setState("intro");
      setMessage(
        "テスト用に、この端末のオンボーディング状態とログイン状態をリセットしました。",
      );
      resolveOnboardingProgress(source, null);
    })();
  }, []);

  useEffect(() => {
    if (
      state !== "delivered" ||
      !deliveredPhoto ||
      isDeliveredPhotoKept ||
      hasOnboardingPhotoChoice
    ) {
      return;
    }

    if (autoKeptDeliveredPhotoIdRef.current === deliveredPhoto.id) {
      return;
    }

    autoKeptDeliveredPhotoIdRef.current = deliveredPhoto.id;
    markDeliveredPhotoReadyForOnboarding();
  }, [
    state,
    deliveredPhoto,
    isDeliveredPhotoKept,
    hasOnboardingPhotoChoice,
  ]);

  useEffect(() => {
    return () => {
      if (revealTimerRef.current) {
        window.clearTimeout(revealTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (state === "envelope") {
      return;
    }

    setIsOpeningEnvelope(false);
    isOpeningEnvelopeRef.current = false;
  }, [state]);

  useEffect(() => {
    revealStartedAtRef.current = null;
    revealPhotoLoadedTrackedRef.current = "";
    revealPhotoRenderedTrackedRef.current = "";
    revealPhotoErrorTrackedRef.current = "";
    setHasRevealPhotoError(false);
    setIsRevealPhotoReady(false);
    setRevealPhotoRetryKey(0);
  }, [deliveredPhoto?.id]);

  function resolveOnboardingProgress(
    source: OnboardingSource,
    progress = readCurrentOnboardingProgress(),
  ) {
    if (redirectCompletedOnboarding(source)) {
      return;
    }

    if (restoreExistingProgress(progress, source)) {
      return;
    }

    trackOnboardingIntroView(source);
  }

  function redirectCompletedOnboarding(source: OnboardingSource) {
    if (!hasOnboardingCompletionMarker()) {
      return false;
    }

    if (!hasCompletedOnboardingEvidence()) {
      clearOnboardingCompletionMarker();
      trackProductEvent("onboarding_stale_completion_cleared", {
        source,
        surface: "onboarding",
      });
      return false;
    }

    trackProductEvent("onboarding_completed_reentry_blocked", {
      source,
      surface: "onboarding",
    });
    const completedProgress = readOnboardingProgress();
    if (completedProgress?.ownPhoto) {
      ensureOnboardingEveningDeliveryReservation({
        ownPhoto: completedProgress.ownPhoto,
        submissionId: completedProgress.submissionId,
        source,
        trigger: "reentry",
      });
    }
    if (completedProgress?.stage === "opened") {
      markOnboardingAlbumCompletionReady();
      markOnboardingAlbumCreated(source);
      router.replace(
        isEmbeddedInAppBrowser()
          ? `/account/create?from=onboarding&source=${encodeURIComponent(source)}`
          : "/home",
      );
    } else {
      router.replace("/home");
    }
    return true;
  }

  function restoreExistingProgress(
    progress: OnboardingProgress | null,
    source: OnboardingSource,
  ) {
    if (progress?.ownPhoto) {
      ensureOnboardingEveningDeliveryReservation({
        ownPhoto: progress.ownPhoto,
        submissionId: progress.submissionId,
        source,
        trigger: "resume",
      });
    }
    const decision = resolveOnboardingResumeDecision(progress);

    if (decision.kind === "intro") {
      return false;
    }

    if (decision.kind === "home") {
      if (progress?.stage === "opened") {
        if (progress.ownPhoto) {
          recordOnboardingEveningDeliveryTarget(progress.ownPhoto);
        }
        markOnboardingAlbumCompletionReady();
        markOnboardingAlbumCreated(source);
        router.replace(
          isEmbeddedInAppBrowser()
            ? `/account/create?from=onboarding&source=${encodeURIComponent(source)}`
            : "/home",
        );
      } else {
        router.replace("/home");
      }
      return true;
    }

    const resumedProgress = decision.progress;

    if (decision.kind === "envelope") {
      setSelectedPhotoSrc(resumedProgress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(resumedProgress.ownPhoto ?? null);
      setDeliveredPhoto(resumedProgress.deliveredPhoto ?? null);
      setDeliveredPhotos(
        resumedProgress.deliveredPhotos ??
          (resumedProgress.deliveredPhoto
            ? [resumedProgress.deliveredPhoto]
            : []),
      );
      setDeliveryBundleId(resumedProgress.deliveryBundleId ?? null);
      setSelectedDeliveryPhotoId(null);
      setIsDeliveredPhotoKept(resumedProgress.isDeliveredPhotoKept ?? true);
      setCompletionCopy(resumedProgress.completionCopy ?? "");
      setState("envelope");
      return true;
    }

    if (decision.kind === "naming") {
      setSelectedPhotoSrc(resumedProgress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(resumedProgress.ownPhoto ?? null);
      setDeliveredPhoto(resumedProgress.deliveredPhoto ?? null);
      setDeliveredPhotos(
        resumedProgress.deliveredPhoto ? [resumedProgress.deliveredPhoto] : [],
      );
      setDeliveryBundleId(null);
      setSelectedDeliveryPhotoId(null);
      setIsDeliveredPhotoKept(false);
      setCatNameDraft("");
      setState("naming");
      trackCatNamePromptView(resumedProgress.ownPhoto?.id);
      return true;
    }

    if (decision.kind === "resume_submission") {
      setSelectedPhotoSrc(resumedProgress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(resumedProgress.ownPhoto ?? null);
      setDeliveredPhotos([]);
      setDeliveryBundleId(null);
      setSelectedDeliveryPhotoId(null);
      setIsDeliveredPhotoKept(false);
      setState("saving");
      setSavingStage("receiving_letter");
      void resumeSubmittedProgress(resumedProgress);
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
    setDeliveryIssue(null);

    try {
      const delivered = await deliverOwnSleepingPhoto({
        ownPhoto: progress.ownPhoto!,
        recipientCatId: progress.ownPhoto!.catId,
        deliveryDateKey: progress.dateKey,
        submissionId: progress.submissionId,
        selectedPhotoSrc: progress.selectedPhotoSrc,
      });

      if (!delivered) {
        setState("empty");
      }
    } catch (error) {
      setDeliveryIssue("temporary_error");
      setMessage(
        canShowTestTools && error instanceof Error
          ? `候補の確認で止まりました: ${error.message}`
          : "",
      );
      setState("empty");
    } finally {
      isSubmittingRef.current = false;
    }
  }

  function trackOnboardingIntroView(source: OnboardingSource) {
    if (hasTrackedIntroViewRef.current) {
      return;
    }

    hasTrackedIntroViewRef.current = true;
    getOrCreateOnboardingJourney({
      dateKey: getJstDateKey(),
      source,
    });
    trackProductEvent("onboarding_intro_view", {
      source,
    });
  }

  async function handleContinueInExternalBrowser() {
    if (
      typeof window === "undefined" ||
      isPreparingExternalBrowserHandoff
    ) {
      return;
    }

    const source = getEffectiveEntrySource();
    setIsPreparingExternalBrowserHandoff(true);
    setExternalBrowserHandoffError("");

    try {
      const result = await createOnboardingHandoff({
        source,
        entryPoint: "onboarding_intro",
      });
      const continueUrl = new URL(result.continueUrl, window.location.origin);
      continueUrl.searchParams.set("handoff_from", "intro");
      continueUrl.searchParams.set("source", source);
      continueUrl.searchParams.set("embedded", "1");

      trackProductEvent("onboarding_external_browser_handoff_created", {
        source,
      });
      window.location.replace(continueUrl.toString());
    } catch (error) {
      setExternalBrowserHandoffError(
        "ブラウザ移動の準備ができませんでした。通信を確認して、もう一度お試しください。",
      );
      trackProductEvent("onboarding_external_browser_handoff_failed", {
        source,
        error:
          error instanceof Error
            ? error.message.slice(0, 120)
            : "handoff_create_failed",
      });
      setIsPreparingExternalBrowserHandoff(false);
    }
  }

  function handleContinueInEmbeddedBrowser() {
    setIsExternalBrowserGuideDismissed(true);
    trackProductEvent("onboarding_embedded_browser_continue", {
      source: getEffectiveEntrySource(),
    });
  }

  async function handleSelectSleepingPhoto() {
    if (
      state === "saving" ||
      isSubmittingRef.current ||
      isPhotoPickerOpenRef.current
    ) {
      return;
    }

    const source = getEffectiveEntrySource();

    if (redirectCompletedOnboarding(source)) {
      return;
    }

    const restored = restoreExistingProgress(
      readCurrentOnboardingProgress(),
      source,
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
    const releasePhotoSelection = () => {
      isSubmittingRef.current = false;
      isPhotoPickerOpenRef.current = false;
      cleanupInput();
    };
    let hasHandledSelection = false;

    input.onchange = async () => {
      if (hasHandledSelection) {
        return;
      }
      hasHandledSelection = true;
      const file = input.files?.[0];
      const validation = validateImageFile(file);

      if (!file || !validation.ok) {
        const rejectionReason = validation.ok
          ? "missing_file"
          : validation.reason;
        if (isPhotoDebugMode) {
          setPhotoDebugInfo(
            createOnboardingPhotoDebugInfo(
              "rejected",
              file,
              rejectionReason,
            ),
          );
        }
        trackProductEvent("photo_upload_error", {
          source: getEffectiveEntrySource(),
          surface: "onboarding",
          error_code: `onboarding_photo_input_${rejectionReason}`,
          error_stage: "input",
          input_rejection_reason: rejectionReason,
          file_size_bucket: file ? getFileSizeBucket(file.size) : "missing",
          file_type: file ? sanitizeFileType(file.type) : "missing",
          file_extension: file ? getSafeFileExtension(file.name) : "missing",
        });
        setMessage(getOnboardingPhotoInputErrorMessage(rejectionReason));
        releasePhotoSelection();
        return;
      }

      setState("saving");
      setSavingStage("saving_photo");
      isSubmittingRef.current = true;
      setSelectedPhotoSrc("");
      setMessage("");
      setDeliveryIssue(null);
      if (isPhotoDebugMode) {
        setPhotoDebugInfo(createOnboardingPhotoDebugInfo("selected", file));
      } else {
        setPhotoDebugInfo(null);
      }

      let savedResult: Awaited<ReturnType<typeof saveSleepingPhotoWithFallback>> | null = null;
      let catId = "";
      const onboardingDateKey = getJstDateKey();
      const anonymousId = getOrCreateOnboardingAnonymousId();
      const onboardingJourney = getOrCreateOnboardingJourney({
        dateKey: onboardingDateKey,
        source: getEffectiveEntrySource(),
      });
      const submissionId = createOnboardingSubmissionId(
        anonymousId,
        onboardingDateKey,
        onboardingJourney.id,
      );
      const ownPhotoId = createOnboardingOwnPhotoId(submissionId);

      try {
        const profiles = readCatProfiles();
        const activeProfile = getActiveCatProfile(profiles, readActiveCatId());
        catId = activeProfile.id;

        saveActiveCatId(catId);
        const exchangeDataUrl = await createOnboardingExchangeDataUrl(file);
        setSelectedPhotoSrc(exchangeDataUrl);
        savedResult = await saveSleepingPhotoWithFallback(
          file,
          catId,
          exchangeDataUrl,
          ownPhotoId,
        );

        if (!savedResult) {
          if (isPhotoDebugMode) {
            setPhotoDebugInfo(
              createOnboardingPhotoDebugInfo(
                "save-returned-null",
                file,
                "saveSleepingPhotoWithFallback returned null",
              ),
            );
          }
          setMessage("写真を保存できませんでした。少し時間をおいて、もう一度試してください。");
          setSelectedPhotoSrc("");
          setState("intro");
          releasePhotoSelection();
          return;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "onboarding photo save failed";
        const errorStage = getOnboardingPhotoErrorStage(errorMessage);
        if (isPhotoDebugMode) {
          setPhotoDebugInfo(
            createOnboardingPhotoDebugInfo(errorStage, file, errorMessage),
          );
        }
        trackProductEvent("photo_upload_error", {
          source: getEffectiveEntrySource(),
          surface: "onboarding",
          error_code: "onboarding_photo_save_failed",
          error_message: errorMessage,
          error_stage: errorStage,
          file_size_bucket: getFileSizeBucket(file.size),
          file_type: sanitizeFileType(file.type),
          file_extension: getSafeFileExtension(file.name),
        });
        setMessage(
          errorStage === "decode"
            ? "写真の読み込みが途中で止まりました。少し待ってから、同じ写真をもう一度選んでください。"
            : "写真を保存できませんでした。少し時間をおいて、もう一度試してください。",
        );
        setSelectedPhotoSrc("");
        setState("intro");
        releasePhotoSelection();
        return;
      }

      if (!savedResult) {
        releasePhotoSelection();
        return;
      }

      try {
        const { dataUrl, ownPhoto } = savedResult;
        setSelectedPhotoSrc(dataUrl);
        setSavingStage("receiving_letter");
        setPendingOwnPhoto(ownPhoto);
        setDeliveredPhoto(null);
        setDeliveredPhotos([]);
        setDeliveryBundleId(null);
        setSelectedDeliveryPhotoId(null);
        setDeliveryChoiceError("");
        setIsDeliveredPhotoKept(false);
        autoKeptDeliveredPhotoIdRef.current = "";
        await writeOnboardingProgressDurably({
          version: 1,
          anonymousId,
          dateKey: onboardingDateKey,
          stage: "submitted",
          source: getEffectiveEntrySource(),
          journeyId: onboardingJourney.id,
          submissionId,
          resumeToken: onboardingJourney.resumeToken,
          ownPhoto,
          selectedPhotoSrc: dataUrl,
          updatedAt: Date.now(),
        });
        ensureOnboardingEveningDeliveryReservation({
          ownPhoto,
          submissionId,
          source: getEffectiveEntrySource(),
          trigger: "initial",
        });
        trackProductEvent("take_photo", {
          catId,
          hour: new Date().getHours(),
          isExchangeTarget: true,
          source: "onboarding",
          delivery_date_key: onboardingDateKey,
        });
        trackProductEvent("onboarding_photo_submitted", {
          catId,
          source: getEffectiveEntrySource(),
          submission_id: submissionId,
          delivery_date_key: onboardingDateKey,
          file_acceptance: validation.acceptedBy,
          file_size_bucket: getFileSizeBucket(file.size),
          file_type: sanitizeFileType(file.type),
          file_extension: getSafeFileExtension(file.name),
        });
        trackProductEvent("photo_submitted", {
          catId,
          source: getEffectiveEntrySource(),
          surface: "onboarding",
          submission_id: submissionId,
          delivery_date_key: onboardingDateKey,
        });

        const delivered = await deliverOwnSleepingPhoto({
          ownPhoto,
          recipientCatId: catId,
          deliveryDateKey: onboardingDateKey,
          submissionId,
          selectedPhotoSrc: dataUrl,
        });

        if (!delivered) {
          setState("empty");
          return;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "onboarding delivery failed";
        if (isPhotoDebugMode) {
          setPhotoDebugInfo(
            createOnboardingPhotoDebugInfo("delivery", file, errorMessage),
          );
        }
        trackProductEvent("onboarding_delivery_error", {
          source: getEffectiveEntrySource(),
          error_code: "onboarding_delivery_failed_after_photo_save",
          error_message: errorMessage,
          file_size_bucket: getFileSizeBucket(file.size),
          file_type: sanitizeFileType(file.type),
          file_extension: getSafeFileExtension(file.name),
        });
        trackProductEvent("photo_upload_error", {
          source: getEffectiveEntrySource(),
          surface: "onboarding",
          error_code: "onboarding_delivery_failed_after_photo_save",
          error_stage: "delivery",
          file_size_bucket: getFileSizeBucket(file.size),
          file_type: sanitizeFileType(file.type),
          file_extension: getSafeFileExtension(file.name),
        });
        setDeliveryIssue("temporary_error");
        setMessage(
          canShowTestTools
            ? "とどく候補の準備で止まりました。テスト用に候補を追加できます。"
            : "",
        );
        setState("empty");
      } finally {
        releasePhotoSelection();
      }
    };
    input.oncancel = () => {
      if (hasHandledSelection) {
        return;
      }
      isPhotoPickerOpenRef.current = false;
      window.setTimeout(() => {
        if (!hasHandledSelection) {
          hasHandledSelection = true;
          cleanupInput();
        }
      }, 5000);
    };

    document.body.appendChild(input);
    isPhotoPickerOpenRef.current = true;
    try {
      input.click();
    } catch {
      releasePhotoSelection();
    }
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
    const onboardingJourney = getOrCreateOnboardingJourney({
      dateKey: deliveryDateKey,
      source: progress?.source ?? getEffectiveEntrySource(),
      journeyId: progress?.journeyId,
      resumeToken: progress?.resumeToken,
    });
    const submissionId =
      progress?.submissionId ??
      createOnboardingSubmissionId(
        anonymousId,
        deliveryDateKey,
        onboardingJourney.id,
      );
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

    await patchOnboardingProgressDurably({
      stage: "opened",
      source: getEffectiveEntrySource(),
      anonymousId,
      dateKey: deliveryDateKey,
      journeyId: progress?.journeyId ?? onboardingJourney.id,
      submissionId,
      resumeToken: progress?.resumeToken ?? onboardingJourney.resumeToken,
      ownPhoto,
      selectedPhotoSrc: selectedPhotoSrcForProgress,
      deliveredPhoto: deliveredPhoto ?? progress?.deliveredPhoto,
      isDeliveredPhotoKept: true,
    });
    continueAfterOnboardingLetter();
  }

  function continueAfterOnboardingLetter() {
    if (isContinuingRef.current) {
      return;
    }

    isContinuingRef.current = true;
    setIsContinuing(true);
    markOnboardingAlbumCompletionReady();
    markOnboardingAlbumCreated(getEffectiveEntrySource());

    if (isEmbeddedBrowser) {
      router.push(
        `/account/create?from=onboarding&source=${encodeURIComponent(
          getEffectiveEntrySource(),
        )}&embedded=1`,
      );
      return;
    }

    router.push("/home");
  }

  function handleContinueAfterDeliveredPhoto() {
    if (!isDeliveredPhotoKept || isContinuingRef.current) {
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

    continueAfterOnboardingLetter();
  }

  function markDeliveredPhotoReadyForOnboarding(
    selectedPhoto = deliveredPhoto,
  ) {
    if (!selectedPhoto) {
      return;
    }

    const savedToReceived = keepExchangePhoto(selectedPhoto);

    trackProductEvent("onboarding_delivered_photo_confirmed", {
      source: getEffectiveEntrySource(),
      source_photo_id: selectedPhoto.sourcePhotoId ?? null,
      saved_to_album: savedToReceived,
      test_mode: canShowTestTools,
      delivery_bundle_id: deliveryBundleId,
      candidate_count: deliveredPhotos.length || 1,
    });

    setDeliveredPhoto(selectedPhoto);
    setIsDeliveredPhotoKept(true);
    patchOnboardingProgress({
      stage: "opened",
      source: getEffectiveEntrySource(),
      deliveredPhoto: selectedPhoto,
      deliveredPhotos,
      deliveryBundleId: deliveryBundleId ?? undefined,
      isDeliveredPhotoKept: true,
      completionCopy: getEveningDeliveryCompletionCopy(),
    });

    if (!isTestMode) {
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      window.dispatchEvent(
        new Event(HOME_INSTALL_ONBOARDING_COMPLETED_EVENT),
      );
      setCompletionCopy(getEveningDeliveryCompletionCopy());
      trackProductEvent("onboarding_completed", {
        source: getEffectiveEntrySource(),
        method: "delivery_confirmed",
        photo_id: selectedPhoto.id,
        delivery_photo_id: selectedPhoto.id,
        delivery_bundle_id: deliveryBundleId,
      });
    }
  }

  async function handleSaveOnboardingDeliveryChoice() {
    if (
      !deliveryBundleId ||
      deliveredPhotos.length === 0 ||
      deliveredPhotos.length > 4 ||
      !selectedDeliveryPhotoId ||
      isFinalizingDeliveryChoice
    ) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const deliveryDateKey = progress?.dateKey;
    if (!deliveryDateKey) {
      setDeliveryChoiceError(
        "選んだ写真を「とどいた」に保存できませんでした。もう一度お試しください。",
      );
      return;
    }

    setIsFinalizingDeliveryChoice(true);
    setDeliveryChoiceError("");
    try {
      if (!progress?.journeyId || !progress.resumeToken) {
        setDeliveryChoiceError(
          "選んだ写真を「とどいた」に保存できませんでした。もう一度お試しください。",
        );
        return;
      }
      const canonical = await finalizeOnboardingDeliveryChoice({
        bundleId: deliveryBundleId,
        deliveryDateKey,
        journeyId: progress.journeyId,
        resumeToken: progress.resumeToken,
        selectedPhotoId: selectedDeliveryPhotoId,
        submissionId: progress.submissionId,
      });
      const selectedPhoto = canonical?.selectedPhotoId
        ? deliveredPhotos.find(
            (photo) => photo.id === canonical.selectedPhotoId,
          ) ?? null
        : null;

      if (canonical?.state !== "kept" || !selectedPhoto) {
        setDeliveryChoiceError(
          "選んだ写真を「とどいた」に保存できませんでした。もう一度お試しください。",
        );
        return;
      }

      const selectedPosition =
        deliveredPhotos.findIndex((photo) => photo.id === selectedPhoto.id) + 1;
      trackProductEvent("onboarding_delivery_choice_saved", {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: deliveryBundleId,
        delivery_date_key: deliveryDateKey,
        photo_id: selectedPhoto.id,
        delivery_photo_id: selectedPhoto.id,
        selected_position: selectedPosition,
        candidate_count: deliveredPhotos.length,
        server_conflict: canonical.conflict,
      });
      markDeliveredPhotoReadyForOnboarding(selectedPhoto);
    } catch {
      setDeliveryChoiceError(
        "選んだ写真を「とどいた」に保存できませんでした。もう一度お試しください。",
      );
    } finally {
      setIsFinalizingDeliveryChoice(false);
    }
  }

  function handleDeliveredPhotoDataUrl(dataUrl: string) {
    if (!deliveredPhoto || !dataUrl.startsWith("data:image/")) {
      return;
    }

    setLocalizedDeliveredPhoto((current) =>
      current?.photoId === deliveredPhoto.id && current.dataUrl === dataUrl
        ? current
        : { photoId: deliveredPhoto.id, dataUrl },
    );
    updateKeptExchangePhotoDataUrl(deliveredPhoto, dataUrl);
  }

  function handleDeliveredPhotoNaturalSize(size: {
    width: number;
    height: number;
  }) {
    applyDeliveredPhotoNaturalSize(size);
    if (!deliveredPhoto) {
      return;
    }

    setDeliveredPhoto((current) => (current ? { ...current, ...size } : current));
    updateKeptExchangePhotoDimensions(deliveredPhoto, size);
  }

  function getDeliveredPhotoDisplaySrc(photo: ExchangePhoto) {
    return localizedDeliveredPhoto?.photoId === photo.id
      ? localizedDeliveredPhoto.dataUrl
      : getExchangePhotoDisplaySrc(photo);
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
      delivery_bundle_id: deliveryBundleId,
      candidate_count: deliveredPhotos.length || 1,
    });
    trackProductEvent("onboarding_delivery_opened", {
      source: getEffectiveEntrySource(),
      photo_id: deliveredPhoto.id,
      delivery_photo_id: deliveredPhoto.id,
      delivery_bundle_id: deliveryBundleId,
      candidate_count: deliveredPhotos.length || 1,
    });
    patchOnboardingProgress({
      stage:
        hasOnboardingPhotoChoice && !isDeliveredPhotoKept
          ? "arrived"
          : "opened",
      source: getEffectiveEntrySource(),
      deliveredPhoto,
      deliveredPhotos,
      deliveryBundleId: deliveryBundleId ?? undefined,
      isDeliveredPhotoKept,
    });

    if (revealTimerRef.current) {
      window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }

    if (prefersReducedMotion) {
      trackOnboardingRevealEvent("delivery_reveal_skipped", 0);
      setState("delivered");
      return;
    }

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

    setIsRevealPhotoReady(true);
    setHasRevealPhotoError(false);
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

    setIsRevealPhotoReady(false);
    setHasRevealPhotoError(true);
    if (revealPhotoErrorTrackedRef.current === deliveredPhoto.id) {
      return;
    }

    revealPhotoErrorTrackedRef.current = deliveredPhoto.id;
    trackOnboardingRevealEvent("delivery_reveal_photo_error");
  }

  function handleRevealPhotoVisible() {
    if (
      !deliveredPhoto ||
      revealPhotoRenderedTrackedRef.current === deliveredPhoto.id
    ) {
      return;
    }

    revealPhotoRenderedTrackedRef.current = deliveredPhoto.id;
    trackOnboardingRevealEvent("delivery_reveal_photo_rendered");
  }

  function handleRetryRevealPhoto() {
    revealPhotoErrorTrackedRef.current = "";
    setIsRevealPhotoReady(false);
    setHasRevealPhotoError(false);
    setRevealPhotoRetryKey((value) => value + 1);
    trackProductEvent("onboarding_delivery_photo_retry", {
      source: getEffectiveEntrySource(),
      photo_id: deliveredPhoto?.id ?? null,
    });
  }

  async function handleRetryOnboardingDelivery() {
    if (isSubmittingRef.current || isRetryingDelivery) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const ownPhoto = pendingOwnPhoto ?? progress?.ownPhoto ?? null;
    if (!ownPhoto) {
      setState("intro");
      setMessage("写真をもう一度選んでください。");
      return;
    }

    isSubmittingRef.current = true;
    setIsRetryingDelivery(true);
    setMessage("");
    setDeliveryIssue(null);
    trackProductEvent("onboarding_delivery_retry", {
      source: getEffectiveEntrySource(),
      submission_id: progress?.submissionId ?? null,
    });

    try {
      const delivered = await deliverOwnSleepingPhoto({
        ownPhoto,
        recipientCatId: ownPhoto.catId,
        deliveryDateKey: progress?.dateKey,
        submissionId: progress?.submissionId,
        selectedPhotoSrc: selectedPhotoSrc || progress?.selectedPhotoSrc,
      });

      if (!delivered) {
        setState("empty");
      }
    } catch (error) {
      setDeliveryIssue("temporary_error");
      setMessage(
        canShowTestTools && error instanceof Error
          ? `候補の確認で止まりました: ${error.message}`
          : "",
      );
      setState("empty");
    } finally {
      isSubmittingRef.current = false;
      setIsRetryingDelivery(false);
    }
  }

  async function deliverOwnSleepingPhoto({
    ownPhoto,
    recipientCatId,
    preferredSourcePhotoId,
    deliveryDateKey,
    submissionId,
    selectedPhotoSrc: selectedPhotoSrcForProgress,
  }: {
    ownPhoto: OwnSleepingPhoto;
    recipientCatId: string;
    preferredSourcePhotoId?: string | null;
    deliveryDateKey?: string | null;
    submissionId?: string | null;
    selectedPhotoSrc?: string;
  }) {
    const currentProgress = readCurrentOnboardingProgress();
    const onboardingSubmission =
      currentProgress?.submissionId === submissionId
        ? getOnboardingExchangeLedgerInput(currentProgress)
        : null;
    const exchangeResult = await createSleepingExchange({
      ownPhoto,
      triggerLabel: "ねがお",
      theme: "sleeping",
      category: "sleeping",
      seed: submissionId ?? `${ownPhoto.id}:${deliveryDateKey ?? Date.now()}`,
      deliveryDateKey: deliveryDateKey ?? undefined,
      recipientCatId,
      preferredSourcePhotoId,
      requestedCandidateCount: 4,
      capability: "onboarding_choice_v1",
      mode: "onboarding",
      onboardingSubmission,
    });

    if (exchangeResult?.error === "onboarding_already_completed") {
      if (clearEveningDeliveryTargetForPhoto(ownPhoto.id)) {
        await deleteOwnSleepingPhoto(ownPhoto.id);
      }
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      trackProductEvent("onboarding_completed_reentry_blocked", {
        source: getEffectiveEntrySource(),
        surface: "exchange",
      });
      router.replace("/home");
      return true;
    }

    const responsePhotos = (exchangeResult?.photos ?? []).filter(
      (photo) => photo && isUsablePhotoSrc(photo.src),
    );
    const hasServerOnboardingPhotoChoice = Boolean(
      exchangeResult?.bundleId &&
        exchangeResult?.experienceVersion === "onboarding_choice_v1" &&
        responsePhotos.length > 0 &&
        responsePhotos.length <= 4 &&
        responsePhotos.every((photo) =>
          photo.id.startsWith(`${exchangeResult.bundleId}-choice-`),
        ),
    );
    let nextPhoto = hasServerOnboardingPhotoChoice
      ? responsePhotos[0]
      : (exchangeResult?.photo ?? null);
    let deliverySource = exchangeResult?.photo ? "exchange" : "illustration_fallback";
    const exchangeFailed =
      Boolean(exchangeResult?.error) ||
      (typeof exchangeResult?.httpStatus === "number" &&
        exchangeResult.httpStatus >= 400);

    if (!nextPhoto && canShowTestTools) {
      trackProductEvent("onboarding_sleeping_photo_delivered", {
        source: entrySource,
        has_delivered_photo: false,
        candidate_count: exchangeResult?.diagnostics?.candidateCount ?? null,
        available_count: exchangeResult?.diagnostics?.availableCount ?? null,
        excluded_count: exchangeResult?.diagnostics?.excludedCount ?? null,
      });
      setDeliveryIssue(exchangeFailed ? "temporary_error" : "no_candidate");
      setMessage("");
      return false;
    }

    if (
      IS_PRODUCTION &&
      (!nextPhoto ||
        !isUsablePhotoSrc(nextPhoto.src) ||
        (exchangeResult?.experienceVersion === "onboarding_choice_v1" &&
          exchangeResult?.servedVariant === "four_choice_v1" &&
          !hasServerOnboardingPhotoChoice))
    ) {
      trackProductEvent("onboarding_delivery_blocked", {
        source: getEffectiveEntrySource(),
        reason: nextPhoto ? "unusable_photo_src" : "no_delivery_photo",
        http_status: exchangeResult?.httpStatus ?? null,
        exchange_error: exchangeResult?.error ?? null,
        candidate_count: exchangeResult?.diagnostics?.candidateCount ?? null,
        available_count: exchangeResult?.diagnostics?.availableCount ?? null,
        excluded_count: exchangeResult?.diagnostics?.excludedCount ?? null,
      });
      setDeliveryIssue(
        exchangeFailed || Boolean(nextPhoto)
          ? "temporary_error"
          : "no_candidate",
      );
      setMessage("");
      return false;
    }

    if (!nextPhoto || !isUsablePhotoSrc(nextPhoto.src)) {
      nextPhoto = await createOnboardingFallbackDeliveryPhoto(
        ownPhoto,
        catIllustrations.deliveryFallback,
        nextPhoto,
      );
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
      setDeliveryIssue(exchangeFailed ? "temporary_error" : "no_candidate");
      setMessage("");
      return false;
    }

    setDeliveryIssue(null);
    setDeliveredPhoto(nextPhoto);
    setDeliveredPhotos(
      hasServerOnboardingPhotoChoice ? responsePhotos : [nextPhoto],
    );
    setDeliveryBundleId(
      hasServerOnboardingPhotoChoice ? (exchangeResult?.bundleId ?? null) : null,
    );
    setSelectedDeliveryPhotoId(null);
    setDeliveryChoiceError("");
    setIsDeliveredPhotoKept(false);
    await patchOnboardingProgressDurably({
      stage: "arrived",
      source: getEffectiveEntrySource(),
      dateKey: deliveryDateKey ?? undefined,
      submissionId: submissionId ?? undefined,
      ownPhoto,
      selectedPhotoSrc: selectedPhotoSrcForProgress,
      deliveredPhoto: nextPhoto,
      deliveredPhotos: hasServerOnboardingPhotoChoice
        ? responsePhotos
        : [nextPhoto],
      deliveryBundleId: hasServerOnboardingPhotoChoice
        ? (exchangeResult?.bundleId ?? undefined)
        : undefined,
      isDeliveredPhotoKept: false,
    });
    trackProductEvent("onboarding_delivery_ready", {
      source: getEffectiveEntrySource(),
      delivery_source: deliverySource,
      photo_id: nextPhoto.id,
      delivery_bundle_id: exchangeResult?.bundleId ?? null,
      candidate_count: hasServerOnboardingPhotoChoice ? responsePhotos.length : 1,
    });
    trackProductEvent("onboarding_delivery_arrived", {
      source: getEffectiveEntrySource(),
      delivery_source: deliverySource,
      photo_id: nextPhoto.id,
      delivery_photo_id: nextPhoto.id,
      delivery_bundle_id: exchangeResult?.bundleId ?? null,
      candidate_count: hasServerOnboardingPhotoChoice ? responsePhotos.length : 1,
      submission_id: submissionId ?? null,
      delivery_date_key: deliveryDateKey ?? null,
    });
    trackProductEvent("envelope_shown", {
      source: "onboarding",
      photo_id: nextPhoto.id,
      delivery_bundle_id: exchangeResult?.bundleId ?? null,
      candidate_count: hasServerOnboardingPhotoChoice ? responsePhotos.length : 1,
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

      if (!file || !validateImageFile(file).ok) {
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
          setMessage(
            "とどく候補を追加しました。もう一度ねがおの写真を選ぶと、ねこだよりがとどきます。",
          );
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

  const shouldShowExternalBrowserGuide =
    state === "intro" &&
    isEmbeddedBrowser &&
    !isExternalBrowserGuideDismissed;
  const shouldShowBrandHeader = ![
    "envelope",
    "delivered",
  ].includes(state);

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
          0% { transform: translateY(8px) scale(0.985); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes onboardingEnvelopeFloat {
          0%, 100% { transform: translateY(0) rotate(-0.8deg); }
          50% { transform: translateY(-5px) rotate(0.5deg); }
        }
        @media (max-height: 640px) {
          [data-onboarding-intro="true"] { gap: 6px !important; }
          [data-onboarding-intro-art="true"] {
            height: 72px !important;
            margin: -6px 0 -2px !important;
          }
          [data-onboarding-intro-art="true"] img {
            width: 94px !important;
            height: 94px !important;
          }
          [data-onboarding-exchange-route="true"] {
            grid-template-columns: 36px 44px 36px !important;
            height: 36px !important;
            margin: 0 0 4px !important;
            transform: none !important;
          }
          [data-onboarding-exchange-route-icon="true"] {
            width: 36px !important;
            height: 36px !important;
          }
          [data-onboarding-title="true"] {
            margin-top: 0 !important;
            font-size: 20px !important;
            line-height: 1.38 !important;
          }
          [data-onboarding-lead="true"] {
            font-size: 12px !important;
            line-height: 1.55 !important;
          }
          [data-onboarding-cta="true"] { margin-top: 7px !important; }
          [data-testid="onboarding-privacy-note"] { font-size: 11px !important; }
        }
      `}</style>
      <div style={styles.paperBackground} aria-hidden="true" />
      <div style={styles.container} data-testid="onboarding-layout-container">
        {shouldShowBrandHeader ? (
          <WordmarkHeader style={styles.brandHeader} />
        ) : null}

        {shouldShowExternalBrowserGuide ? (
          <ExternalBrowserGuide
            source={entrySource}
            isPreparing={isPreparingExternalBrowserHandoff}
            errorMessage={externalBrowserHandoffError}
            onOpenExternalBrowser={() => {
              void handleContinueInExternalBrowser();
            }}
            onContinue={handleContinueInEmbeddedBrowser}
          />
        ) : null}

        {!shouldShowExternalBrowserGuide && (state === "intro" || state === "saving") ? (
          <section
            style={styles.hero}
            aria-label="ねてるねこのはじめかた"
            data-onboarding-intro={state === "intro" ? "true" : undefined}
          >
            {state === "intro" ? (
              <div
                style={styles.introArtifact}
                aria-hidden="true"
                data-onboarding-intro-art="true"
              >
                <img
                  src={catIllustrations.onboardingCat}
                  alt=""
                  style={styles.introCat}
                  onError={(event) =>
                    fallBackCatIllustrationImage(event.currentTarget, "onboardingCat")
                  }
                />
              </div>
            ) : null}
            <h1
              style={styles.title}
              data-onboarding-title={state === "intro" ? "true" : undefined}
            >
              {state === "saving" ? (
                savingStage === "saving_photo"
                  ? "写真を保存しています"
                  : "写真を用意しています"
              ) : (
                <>
                  ねがおの写真を1枚選ぶと
                  <br />
                  猫の写真が最大4枚とどく
                </>
              )}
            </h1>
            {state === "intro" ? <OnboardingExchangeRoute /> : null}
            {state === "intro" ? (
              <>
                <p
                  style={styles.lead}
                  data-onboarding-lead="true"
                  data-testid="onboarding-exchange-explanation"
                >
                  とどいた写真から1枚を選んで保存できます。
                  <br />
                  最初に選んだねがおの写真は、運営確認後にほかの利用者へとどくことがあります。
                </p>
                <p
                  style={styles.privacyNote}
                  data-testid="onboarding-privacy-note"
                >
                  <span aria-hidden="true" style={styles.privacyNoteIcon}>
                    <LockIcon size={14} />
                  </span>
                  公開一覧やSNSには表示されません
                </p>
              </>
            ) : null}
            {state === "saving" ? (
              <DeliveryWaiting photoSrc={selectedPhotoSrc} stage={savingStage} />
            ) : null}
            {state === "intro" ? (
              <>
                <AppButton
                  type="button"
                  data-testid="onboarding-photo-select"
                  onClick={() => {
                    void handleSelectSleepingPhoto();
                  }}
                  fullWidth
                  style={styles.onboardingCta}
                  data-onboarding-cta="true"
                >
                  ねがおの写真を1枚選ぶ
                </AppButton>
              </>
            ) : null}
            {message ? <p style={styles.message}>{message}</p> : null}
            {isPhotoDebugMode ? (
              <OnboardingPhotoDebugPanel info={photoDebugInfo} />
            ) : null}
          </section>
        ) : null}

        {state === "naming" ? (
          <section style={styles.result} aria-label="この子の名前">
            <p style={styles.kicker}>写真に写っている猫</p>
            <h2 style={styles.subTitle}>この子の名前は？</h2>
            {selectedPhotoSrc ? (
              <OnboardingNamePhoto photoSrc={selectedPhotoSrc} />
            ) : null}
            <p style={styles.resultText}>
              名前はあとから登録・変更できます。
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
                disabled={isSubmittingRef.current || isContinuing}
              >
                {isContinuing ? "準備しています…" : "名前を決めて進む"}
              </AppButton>
            </form>
            <AppButton
              type="button"
              variant="quiet"
              size="md"
              disabled={isSubmittingRef.current || isContinuing}
              onClick={() => {
                void handleContinueAfterCatName(true);
              }}
            >
              {isContinuing ? "準備しています…" : "名前なしで進む"}
            </AppButton>
          </section>
        ) : null}

        {state === "envelope" && deliveredPhoto ? (
          <section style={styles.result} aria-label="ねこだよりがとどいています">
            <OnboardingEnvelopeArt />
            <span style={styles.deliveryPhotoPreload} aria-hidden="true">
              <PhotoTile
                key={`onboarding-delivery-preload-${revealPhotoRetryKey}`}
                src={getDeliveredPhotoDisplaySrc(deliveredPhoto)}
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
              とどきました
            </h2>
            <button
              type="button"
              data-testid="onboarding-envelope-open"
              onClick={handleOpenEnvelope}
              disabled={isOpeningEnvelope}
              aria-busy={isOpeningEnvelope}
              style={{
                ...styles.deliveryEnvelopeButton,
                ...(isOpeningEnvelope ? styles.deliveryEnvelopeButtonBusy : {}),
              }}
            >
              {isOpeningEnvelope ? "ひらいています…" : "ねこだよりを ひらく"}
            </button>
          </section>
        ) : null}

        {state === "delivered" &&
        hasOnboardingPhotoChoice &&
        !isDeliveredPhotoKept ? (
          <section
            style={{ ...styles.result, ...styles.deliveredResult }}
            aria-label={`${deliveredPhotos.length}枚のねこだより`}
            data-testid="onboarding-four-choice"
            data-bundle-id={deliveryBundleId ?? undefined}
          >
            <div style={styles.onboardingFourChoiceLetter}>
              <div style={styles.onboardingDeliveredMasthead}>
                <p style={styles.onboardingDeliveredTitle}>
                  {deliveredPhotos.length}枚のねこだより
                </p>
                <span
                  style={styles.onboardingDeliveredMastheadRule}
                  aria-hidden="true"
                />
              </div>
              <p style={styles.onboardingFourChoiceLead}>
                「とどいた」に保存する1枚をえらんでください
              </p>
              <div
                role="radiogroup"
                aria-label="保存する写真"
                style={styles.onboardingFourChoiceGrid}
              >
                {deliveredPhotos.map((photo, index) => {
                  const isSelected = photo.id === selectedDeliveryPhotoId;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`${index + 1}枚目の写真をえらぶ`}
                      disabled={isFinalizingDeliveryChoice}
                      data-testid="onboarding-four-choice-option"
                      data-photo-id={photo.id}
                      data-position={index + 1}
                      data-selected={isSelected ? "true" : "false"}
                      style={{
                        ...styles.onboardingFourChoiceOption,
                        ...(isSelected
                          ? styles.onboardingFourChoiceOptionSelected
                          : {}),
                      }}
                      onClick={() => {
                        setSelectedDeliveryPhotoId(photo.id);
                        setDeliveryChoiceError("");
                        trackProductEvent("onboarding_delivery_choice_selected", {
                          source: getEffectiveEntrySource(),
                          delivery_bundle_id: deliveryBundleId,
                          photo_id: photo.id,
                          selected_position: index + 1,
                          candidate_count: deliveredPhotos.length,
                        });
                      }}
                    >
                      <StoredPhotoImage
                        src={getExchangePhotoDisplaySrc(photo)}
                        fallbackSrcs={getExchangePhotoFallbackSrcs(photo)}
                        alt=""
                        storageVariant="thumbnail"
                        loading="eager"
                        style={styles.onboardingFourChoicePhoto}
                      />
                      {isSelected ? (
                        <span
                          aria-hidden="true"
                          style={styles.onboardingFourChoiceMark}
                        >
                          選択中
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {deliveryChoiceError ? (
                <p role="alert" style={styles.onboardingFourChoiceError}>
                  {deliveryChoiceError}
                </p>
              ) : null}
              <AppButton
                type="button"
                fullWidth
                disabled={!selectedDeliveryPhoto || isFinalizingDeliveryChoice}
                onClick={() => {
                  void handleSaveOnboardingDeliveryChoice();
                }}
                style={styles.onboardingFourChoiceSave}
                data-testid="onboarding-four-choice-save"
              >
                {isFinalizingDeliveryChoice
                  ? "保存しています…"
                  : "この1枚を保存"}
              </AppButton>
            </div>
          </section>
        ) : null}

        {state === "delivered" &&
        deliveredPhoto &&
        (!hasOnboardingPhotoChoice || isDeliveredPhotoKept) ? (
          <section
            style={{ ...styles.result, ...styles.deliveredResult }}
            aria-label="ねこだより"
          >
            <div
              style={styles.onboardingDeliveredLetter}
              data-testid="onboarding-delivered-letter"
            >
              <div
                style={styles.onboardingDeliveredMasthead}
                data-testid="onboarding-delivered-masthead"
              >
                <p
                  style={styles.onboardingDeliveredTitle}
                  data-testid="onboarding-delivered-title"
                >
                  ねこだより
                </p>
                <span
                  style={styles.onboardingDeliveredMastheadRule}
                  aria-hidden="true"
                />
              </div>
              <div
                style={{
                  ...styles.onboardingDeliveredPhotoFrame,
                  ...naturalDeliveredPhotoFrameStyle,
                }}
                data-testid="onboarding-delivered-photos"
                data-photo-frame="f3"
                data-photo-aspect={deliveredPhotoAspect.toFixed(4)}
              >
                <StoredPhotoImage
                  key={`onboarding-delivery-opened-${revealPhotoRetryKey}`}
                  src={getDeliveredPhotoDisplaySrc(deliveredPhoto)}
                  fallbackSrcs={getExchangePhotoFallbackSrcs(deliveredPhoto)}
                  alt="ねこだより"
                  style={styles.onboardingDeliveredPhoto}
                  storageVariant="display"
                  onStorageDataUrl={handleDeliveredPhotoDataUrl}
                  onNaturalSize={handleDeliveredPhotoNaturalSize}
                  onLoad={handleRevealPhotoLoaded}
                  onVisible={handleRevealPhotoVisible}
                  onError={handleRevealPhotoError}
                />
                {!isRevealPhotoReady && !hasRevealPhotoError ? (
                  <p
                    data-testid="onboarding-delivery-photo-loading"
                    style={styles.onboardingDeliveredPhotoLoading}
                    role="status"
                  >
                    ひらいています…
                  </p>
                ) : null}
              </div>
              {hasRevealPhotoError ? (
                <div
                  data-testid="onboarding-delivery-photo-error"
                  role="alert"
                  style={styles.recoveryPanel}
                >
                  <p style={styles.recoveryText}>
                    ねこだよりを表示できませんでした。通信を確認して、もう一度お試しください。
                  </p>
                  <AppButton
                    type="button"
                    variant="quiet"
                    size="md"
                    onClick={handleRetryRevealPhoto}
                    data-testid="onboarding-delivery-photo-retry"
                  >
                    写真をもう一度読み込む
                  </AppButton>
                </div>
              ) : null}
              <p style={styles.onboardingDeliveredNote}>
                {isDeliveredPhotoKept ? (
                  <>
                    ほかのおうちからとどいたねこだよりです。
                    <br />
                    <span style={styles.onboardingDeliveredSavedPhrase}>
                      「とどいた」に保存しました
                    </span>
                  </>
                ) : (
                  "この写真を保存しています。"
                )}
              </p>
            </div>
            <AppButton
              type="button"
              onClick={
                isDeliveredPhotoKept
                  ? handleContinueAfterDeliveredPhoto
                  : undefined
              }
              disabled={!isDeliveredPhotoKept || isContinuing}
              fullWidth
              style={styles.onboardingDeliveredContinue}
              data-testid="onboarding-delivered-continue"
            >
              {isContinuing ? "準備しています…" : "ホームへ進む"}
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}
        {state === "empty" ? (
          <section
            style={styles.result}
            aria-label="ねがおを保存しました"
            data-delivery-issue={deliveryIssue ?? undefined}
          >
            <p style={styles.kicker}>ねがおは保存されています</p>
            {selectedPhotoSrc ? (
              <img src={selectedPhotoSrc} alt="" style={styles.savedPhoto} />
            ) : null}
            <h2 style={styles.subTitle}>ねこだよりを読み込めませんでした</h2>
            <p style={styles.resultText}>
              {canShowTestTools
                ? deliveryIssue === "temporary_error"
                  ? "候補の確認で止まりました。テスト用に、ここで候補を追加できます。"
                  : "とどく候補がまだありません。テスト用に、ここで候補を追加できます。"
                : deliveryIssue === "no_candidate"
                  ? "ねこだよりを用意できませんでした。少し時間をおいて、もう一度お試しください。"
                  : "通信が途中で止まりました。ねがおは保存されています。通信を確認して、もう一度お試しください。"}
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
            <AppButton
              type="button"
              variant="accent"
              fullWidth
              onClick={() => {
                void handleRetryOnboardingDelivery();
              }}
              disabled={isRetryingDelivery}
              data-testid="onboarding-delivery-retry"
            >
              {isRetryingDelivery
                ? "読み込んでいます..."
                : "ねこだよりを もう一度読み込む"}
            </AppButton>
            <AppButton type="button" variant="quiet" size="md" onClick={handleGoHome}>
              ホームへ
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "kept" ? (
          <section style={styles.result} aria-label="写真を保存しました">
            <p style={styles.kicker}>保存しました</p>
            {completionCopy ? (
              <p style={styles.resultText}>{completionCopy}</p>
            ) : null}
            <h2 style={styles.subTitle}>
              また寝ていたら、
              <br />
              ホームからねがおの写真を選べます
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
              アルバムを作る
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

function OnboardingExchangeRoute() {
  return (
    <div
      style={styles.exchangeRoute}
      aria-hidden="true"
      data-onboarding-exchange-route="true"
    >
      <span
        style={styles.exchangeRouteIcon}
        data-onboarding-exchange-route-icon="true"
      >
        <CameraIcon size={21} />
      </span>
      <span style={styles.exchangeRouteLine} />
      <span
        style={styles.exchangeRouteIcon}
        data-onboarding-exchange-route-icon="true"
      >
        <MailIcon size={21} />
      </span>
    </div>
  );
}

function OnboardingNamePhoto({ photoSrc }: { photoSrc: string }) {
  const { frameStyle, handleNaturalSize, photoAspect } = useNaturalPhotoFrame({
    horizontalInsetPx: 120,
    maxWidthPx: 220,
    verticalChromePx: 604,
  });

  return (
    <span
      style={{ ...styles.namePreviewPhotoFrame, ...frameStyle }}
      data-testid="onboarding-name-photo-preview"
      data-photo-frame="f3"
      data-photo-aspect={photoAspect.toFixed(4)}
    >
      <img
        src={photoSrc}
        alt=""
        style={styles.namePreviewPhoto}
        onLoad={(event) =>
          handleNaturalSize({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }
      />
    </span>
  );
}

function DeliveryWaiting({
  photoSrc,
  stage,
}: {
  photoSrc: string;
  stage: OnboardingSavingStage;
}) {
  const {
    frameStyle,
    handleNaturalSize,
    photoAspect,
  } = useNaturalPhotoFrame({
    horizontalInsetPx: 96,
    maxWidthPx: 240,
    verticalChromePx: 300,
  });

  return (
    <div style={styles.deliveryWaiting} aria-live="polite" role="status">
      <span
        style={{
          ...styles.deliveryWaitingPhotoFrame,
          ...(photoSrc ? frameStyle : {}),
        }}
        data-testid="onboarding-saving-photo-preview"
        data-photo-ready={photoSrc ? "true" : "false"}
        data-photo-frame="f3"
        data-photo-aspect={photoAspect.toFixed(4)}
      >
        {photoSrc ? (
          <img
            src={photoSrc}
            alt=""
            style={styles.deliveryWaitingPhoto}
            onLoad={(event) =>
              handleNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
        ) : (
          <span style={styles.deliveryWaitingPhotoPlaceholder} aria-hidden="true" />
        )}
      </span>
      <span style={styles.deliveryWaitingStatus}>
        <span style={styles.deliveryWaitingLine} aria-hidden="true">
          <span style={styles.deliveryWaitingDot} />
        </span>
        <span style={styles.deliveryWaitingText}>
          {stage === "saving_photo"
            ? "写真を読み込んでいます"
            : "写真を保存しました"}
        </span>
      </span>
    </div>
  );
}

function ExternalBrowserGuide({
  source,
  isPreparing,
  errorMessage,
  onOpenExternalBrowser,
  onContinue,
}: {
  source: OnboardingSource;
  isPreparing: boolean;
  errorMessage: string;
  onOpenExternalBrowser: () => void;
  onContinue: () => void;
}) {
  const catIllustrations = useCatIllustrationAssets();
  const kicker = source === "referral" ? "紹介リンク" : "アプリの中でひらいています";

  return (
    <section style={styles.externalBrowserGuide} aria-label="ブラウザでひらく案内">
      <div style={styles.externalBrowserArt} aria-hidden="true">
        <img
          src={catIllustrations.onboardingCat}
          alt=""
          style={styles.externalBrowserCat}
          onError={(event) =>
            fallBackCatIllustrationImage(event.currentTarget, "onboardingCat")
          }
        />
      </div>
      <p style={styles.kicker}>{kicker}</p>
      <h1 style={styles.title}>
        SafariやChromeで
        <br />
        つづけられます
      </h1>
      <p style={styles.externalBrowserText}>
        このあと選ぶ写真を、そのまま「ねてるねこ」に保存できます。
      </p>
      {errorMessage ? (
        <p style={styles.externalBrowserCopiedText} role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div style={styles.externalBrowserActions}>
        <AppButton
          type="button"
          variant="accent"
          fullWidth
          disabled={isPreparing}
          onClick={onOpenExternalBrowser}
          style={styles.onboardingCta}
        >
          {isPreparing ? "ブラウザ移動を準備しています..." : "Safari／Chromeでつづける"}
        </AppButton>
        <AppButton
          type="button"
          variant="quiet"
          size="md"
          disabled={isPreparing}
          onClick={onContinue}
        >
          このブラウザで先に試す
        </AppButton>
      </div>
      <p style={styles.externalBrowserFallbackText}>
        次の画面でURLをコピーし、SafariやChromeに貼り付けます。
      </p>
    </section>
  );
}

function OnboardingPhotoDebugPanel({
  info,
}: {
  info: OnboardingPhotoDebugInfo | null;
}) {
  if (!info) {
    return (
      <details style={styles.photoDebugPanel}>
        <summary style={styles.photoDebugSummary}>写真デバッグ</summary>
        <p style={styles.photoDebugText}>
          写真を選ぶと、ここに読み込み情報が出ます。
        </p>
      </details>
    );
  }

  const rows = [
    ["stage", info.stage],
    ["type", info.fileType],
    ["ext", info.fileExtension],
    ["size", info.fileSize],
    ["modified", info.lastModified],
    ["browser", info.browser],
    ...(info.errorMessage ? [["error", info.errorMessage]] : []),
  ];

  return (
    <details style={styles.photoDebugPanel} open>
      <summary style={styles.photoDebugSummary}>写真デバッグ</summary>
      <dl style={styles.photoDebugList}>
        {rows.map(([label, value]) => (
          <div key={label} style={styles.photoDebugRow}>
            <dt style={styles.photoDebugLabel}>{label}</dt>
            <dd style={styles.photoDebugValue}>{value}</dd>
          </div>
        ))}
      </dl>
    </details>
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

function hasReferralQueryInLocation() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  return params.has("ref") || params.has("referral") || params.has("invite");
}

function readOnboardingPhotoDebugEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const requested =
    params.get("photoDebug") === "1" || params.get("debug") === "photo";

  if (requested) {
    try {
      window.localStorage.setItem(ONBOARDING_PHOTO_DEBUG_STORAGE_KEY, "true");
    } catch {
      // Debug mode should not block onboarding.
    }

    return true;
  }

  try {
    return window.localStorage.getItem(ONBOARDING_PHOTO_DEBUG_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

async function createOnboardingFallbackDeliveryPhoto(
  ownPhoto: OwnSleepingPhoto,
  fallbackAssetSrc: string,
  basePhoto?: ExchangePhoto | null,
): Promise<ExchangePhoto | null> {
  const fallbackSrc = await loadImageAssetAsDataUrl(fallbackAssetSrc);
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
    thumbnailSrc: src,
    displaySrc: src,
    originalSrc: src,
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

async function resizeAndEncode(
  file: File,
  maxSize = 1100,
  quality = 0.78,
  mimeType = "image/jpeg",
) {
  return resizeImageFileToDataUrl(file, maxSize, quality, mimeType);
}

async function saveSleepingPhotoWithFallback(
  file: File,
  catId: string,
  exchangeDataUrl: string,
  ownPhotoId: string,
) {
  const createdAt = Date.now();
  const dimensions = await readImageFileDimensions(file);
  const fileName = ownPhotoId;
  const displayDataUrl =
    (await tryResizeAndEncode(file, 2048, 0.84, "image/webp")) ??
    exchangeDataUrl;
  const thumbnailDataUrl = await tryResizeAndEncode(
    file,
    512,
    0.72,
    "image/webp",
  );
  const storedDisplaySrc = await storeAccountPhotoDataUrl({
    dataUrl: displayDataUrl,
    pathSegments: ["onboarding", catId, "display"],
    fileName,
  });
  const canUseStorage = isStoragePhotoReference(storedDisplaySrc);
  const storedThumbnailSrc = canUseStorage && thumbnailDataUrl
    ? await storeAccountPhotoDataUrl({
        dataUrl: thumbnailDataUrl,
        pathSegments: ["onboarding", catId, "thumbnail"],
        fileName,
      })
    : null;
  const compactAttempts = await createCompactOwnPhotoAttempts(file);
  const attempts: Array<{
    src: string;
    displaySrc?: string;
    thumbnailSrc?: string;
  }> = (
    [
      canUseStorage
        ? {
            src: storedDisplaySrc,
            displaySrc: storedDisplaySrc,
            thumbnailSrc: isStoragePhotoReference(storedThumbnailSrc)
              ? storedThumbnailSrc
              : undefined,
          }
        : null,
      {
        src: exchangeDataUrl,
        displaySrc: canUseStorage ? storedDisplaySrc : undefined,
        thumbnailSrc: isStoragePhotoReference(storedThumbnailSrc)
          ? storedThumbnailSrc
          : undefined,
      },
      ...compactAttempts.map((src) => ({ src })),
    ] satisfies Array<{
      src: string;
      displaySrc?: string;
      thumbnailSrc?: string;
    } | null>
  ).filter((attempt): attempt is {
    src: string;
    displaySrc?: string;
    thumbnailSrc?: string;
  } => Boolean(attempt));
  const triedSrcs = new Set<string>();

  for (const attempt of attempts) {
    if (!attempt.src || triedSrcs.has(attempt.src)) {
      continue;
    }

    triedSrcs.add(attempt.src);
    const ownPhoto = await saveOwnSleepingPhoto({
      photoId: ownPhotoId,
      catId,
      src: attempt.src,
      thumbnailSrc: attempt.thumbnailSrc,
      displaySrc: attempt.displaySrc,
      originalSrc: canUseStorage ? storedDisplaySrc : undefined,
      width: dimensions.width,
      height: dimensions.height,
      triggerLabel: "ねがお",
      theme: "sleeping",
      shared: true,
      captureContext: "onboarding",
      minRetainedCount: 1,
    });

    if (ownPhoto) {
      void queueOriginalPhotoPreservation({
        file,
        localAssetId: ownPhoto.id,
        sourceSurface: "onboarding",
        displaySrc: ownPhoto.displaySrc ?? ownPhoto.src,
        catId,
      });
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
    width: dimensions.width,
    height: dimensions.height,
    createdAt,
    photoId: ownPhotoId,
  });

  await persistOwnSleepingPhotoHistory(fallbackOwnPhoto);
  void queueOriginalPhotoPreservation({
    file,
    localAssetId: fallbackOwnPhoto.id,
    sourceSurface: "onboarding",
    displaySrc: fallbackOwnPhoto.displaySrc ?? fallbackOwnPhoto.src,
    catId,
  });

  return { dataUrl: exchangeDataUrl, ownPhoto: fallbackOwnPhoto };
}

function isStoragePhotoReference(src: string | null | undefined): src is string {
  return Boolean(src?.startsWith("storage:") || src?.startsWith("storage://"));
}

async function createOnboardingExchangeDataUrl(
  file: File,
  preferredDataUrl?: string,
) {
  if (preferredDataUrl && preferredDataUrl.length <= 1_900_000) {
    return preferredDataUrl;
  }

  const firstAttempt = await resizeAndEncode(file, 1200, 0.8, "image/webp");
  if (firstAttempt.length <= 1_900_000) {
    return firstAttempt;
  }

  let lastUsableDataUrl: string | null = firstAttempt;

  for (const attempt of [
    { maxSize: 900, quality: 0.76 },
    { maxSize: 720, quality: 0.72 },
    { maxSize: 560, quality: 0.68 },
  ]) {
    const dataUrl = await tryResizeAndEncode(
      file,
      attempt.maxSize,
      attempt.quality,
      "image/webp",
    );

    if (!dataUrl) {
      continue;
    }

    lastUsableDataUrl = dataUrl;

    if (dataUrl.length <= 1_900_000) {
      return dataUrl;
    }
  }

  return (
    (await tryResizeAndEncode(file, 420, 0.62, "image/webp")) ??
    lastUsableDataUrl ??
    Promise.reject(new Error("onboarding_photo_decode_failed"))
  );
}

async function createCompactOwnPhotoAttempts(file: File) {
  const attempts: string[] = [];

  for (const attempt of [
    { maxSize: 560, quality: 0.66 },
    { maxSize: 420, quality: 0.58 },
    { maxSize: 320, quality: 0.5 },
    { maxSize: 240, quality: 0.42 },
  ]) {
    const dataUrl = await tryResizeAndEncode(
      file,
      attempt.maxSize,
      attempt.quality,
    );

    if (dataUrl) {
      attempts.push(dataUrl);
    }
  }

  return attempts;
}

async function tryResizeAndEncode(
  file: File,
  maxSize = 1100,
  quality = 0.78,
  mimeType = "image/jpeg",
) {
  try {
    return await resizeAndEncode(file, maxSize, quality, mimeType);
  } catch {
    return null;
  }
}

function createOnboardingOwnPhotoFallback({
  photoId,
  catId,
  src,
  displaySrc,
  thumbnailSrc,
  width,
  height,
  createdAt,
}: {
  photoId: string;
  catId: string;
  src: string;
  displaySrc?: string;
  thumbnailSrc?: string;
  width?: number;
  height?: number;
  createdAt: number;
}): OwnSleepingPhoto {
  return {
    id: photoId,
    ownerCatId: catId,
    catId,
    src,
    ...(thumbnailSrc ? { thumbnailSrc } : {}),
    ...(displaySrc ? { displaySrc } : {}),
    ...(displaySrc ? { originalSrc: displaySrc } : {}),
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    state: "sleeping",
    visibility: "shared",
    deliveryStatus: "available",
    triggerLabel: "ねがお",
    theme: "sleeping",
    shared: true,
    createdAt,
    captureContext: "onboarding",
  };
}

async function saveStockCandidateWithFallback(file: File) {
  const attempts = [
    { maxSize: 1600, quality: 0.86 },
    { maxSize: 1400, quality: 0.84 },
    { maxSize: 1200, quality: 0.82 },
    { maxSize: 900, quality: 0.78 },
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

function getOnboardingPhotoErrorStage(message: string) {
  if (
    message.includes("onboarding_photo_decode_failed") ||
    message.includes("image_decode_failed") ||
    message.includes("Image load failed")
  ) {
    return "decode";
  }

  if (message.includes("Canvas")) {
    return "canvas";
  }

  if (message.includes("Photo upload failed")) {
    return "storage";
  }

  return "unknown";
}

function getOnboardingPhotoInputErrorMessage(
  reason: ImageFileRejectionReason,
) {
  if (reason === "missing_file" || reason === "empty_file") {
    return "写真を読み込めませんでした。もう一度選んでください。";
  }

  if (reason === "file_too_large") {
    return "写真のサイズが大きすぎます。20MB以下の写真でもう一度試してください。";
  }

  return "写真を読み込めませんでした。JPEGやPNGなどの写真で、もう一度試してください。";
}

function sanitizeFileType(type: string) {
  const normalized = type.trim().toLowerCase();

  return /^image\/[a-z0-9.+-]+$/.test(normalized) ? normalized : "unknown";
}

function getSafeFileExtension(name: string) {
  const extension = name.split(".").pop()?.trim().toLowerCase();

  return extension && /^[a-z0-9]{2,8}$/.test(extension) ? extension : "unknown";
}

function getFileSizeBucket(size: number) {
  if (size < 1_000_000) {
    return "small";
  }
  if (size < 5_000_000) {
    return "medium";
  }
  return "large";
}

function createOnboardingPhotoDebugInfo(
  stage: string,
  file: File | null | undefined,
  errorMessage?: string,
): OnboardingPhotoDebugInfo {
  return {
    stage,
    fileName: getSafeDebugFileName(file?.name),
    fileType: sanitizeFileType(file?.type ?? ""),
    fileExtension: getSafeFileExtension(file?.name ?? ""),
    fileSize: formatFileSize(file?.size ?? 0),
    lastModified: formatFileTimestamp(file?.lastModified ?? 0),
    browser: getDebugBrowserLabel(),
    ...(errorMessage ? { errorMessage: truncateDebugText(errorMessage, 160) } : {}),
  };
}

function getSafeDebugFileName(name: string | undefined) {
  if (!name) {
    return "unknown";
  }

  const extension = getSafeFileExtension(name);
  return extension === "unknown" ? "selected-file" : `selected.${extension}`;
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "unknown";
  }

  return `${(size / 1_000_000).toFixed(2)} MB (${getFileSizeBucket(size)})`;
}

function formatFileTimestamp(timestamp: number) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "unknown";
  }

  return new Date(timestamp).toISOString();
}

function getDebugBrowserLabel() {
  if (typeof navigator === "undefined") {
    return "unknown";
  }

  const userAgent = navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const isLine = /Line/i.test(userAgent);
  const isInstagram = /Instagram/i.test(userAgent);
  const isWebView = /wv|Version\/[\d.]+ Chrome\/[\d.]+ Mobile Safari/i.test(
    userAgent,
  );

  return [
    isAndroid ? "Android" : /iPhone|iPad|iPod/i.test(userAgent) ? "iOS" : "other",
    isLine ? "LINE" : isInstagram ? "Instagram" : isWebView ? "WebView" : "browser",
  ].join(" / ");
}

function truncateDebugText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function getExchangePhotoDisplaySrc(photo: ExchangePhoto) {
  return resolvePhotoSrc(photo, "detail");
}

function getExchangePhotoFallbackSrcs(photo: ExchangePhoto) {
  return resolvePhotoFallbackSrcs(photo);
}

const UI_FONT = "var(--font-ui)";

const styles = {
  page: {
    position: "relative",
    width: "100%",
    maxWidth: "100%",
    minHeight: "100dvh",
    overflowX: "hidden",
    overflowY: "auto",
    boxSizing: "border-box",
    WebkitTextSizeAdjust: "100%",
    textSizeAdjust: "100%",
    color: "#2f2a25",
    background: "var(--app-paper-background)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    fontFamily: UI_FONT,
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
    maxWidth: "100%",
    minWidth: 0,
    minHeight: "100dvh",
    margin: "0 auto",
    padding:
      "calc(42px + env(safe-area-inset-top)) clamp(18px, 7vw, 28px) calc(34px + env(safe-area-inset-bottom))",
    display: "grid",
    alignContent: "safe center",
    boxSizing: "border-box",
  },
  brandHeader: {
    position: "fixed",
    top: "calc(42px + env(safe-area-inset-top))",
    left: 0,
    right: 0,
    width: "100%",
    transform: "none",
    paddingTop: 0,
    boxSizing: "border-box",
  },
  hero: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "12px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  externalBrowserGuide: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "12px",
    width: "100%",
    padding: "12px 4px 18px",
    boxSizing: "border-box",
  },
  externalBrowserArt: {
    width: "min(48vw, 164px)",
    height: "126px",
    display: "grid",
    placeItems: "center",
    margin: "-4px 0 2px",
  },
  externalBrowserCat: {
    width: "126px",
    height: "126px",
    objectFit: "contain",
    filter: "drop-shadow(0 8px 12px rgba(92,70,46,0.08)) saturate(0.94)",
  },
  externalBrowserText: {
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
  externalBrowserCopiedText: {
    width: "min(100%, 300px)",
    margin: 0,
    padding: "10px 12px",
    border: "1px solid color-mix(in srgb, var(--seal) 18%, var(--line) 82%)",
    borderRadius: "var(--radius-md)",
    background: "color-mix(in srgb, var(--paper-card) 68%, transparent)",
    color: "var(--ink)",
    fontFamily: UI_FONT,
    fontSize: "12px",
    lineHeight: 1.7,
    letterSpacing: 0,
  },
  externalBrowserActions: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    width: "100%",
  },
  externalBrowserFallbackText: {
    margin: "-2px 0 0",
    color: "var(--ink-faint)",
    fontFamily: UI_FONT,
    fontSize: "11px",
    lineHeight: 1.6,
    letterSpacing: 0,
  },
  introArtifact: {
    width: "min(52vw, 176px)",
    height: "136px",
    display: "grid",
    placeItems: "center",
    margin: "-4px 0 -2px",
  },
  introCat: {
    width: "154px",
    height: "154px",
    objectFit: "contain",
    filter:
      "drop-shadow(0 10px 14px rgba(92,70,46,0.08)) saturate(0.94)",
  },
  exchangeRoute: {
    display: "grid",
    gridTemplateColumns: "44px 54px 44px",
    alignItems: "center",
    justifyContent: "center",
    margin: "-3px 0 2px",
    color: "#756d62",
  },
  exchangeRouteIcon: {
    width: "44px",
    height: "44px",
    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(120,108,94,0.14)",
    borderRadius: "50%",
    background: "rgba(255,253,248,0.5)",
  },
  exchangeRouteLine: {
    height: "2px",
    background:
      "repeating-linear-gradient(90deg, rgba(120,108,94,0.3) 0 5px, transparent 5px 11px)",
  },
  onboardingEnvelopeArt: {
    position: "relative",
    display: "block",
    width: "min(100%, 304px)",
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
    margin: "8px 0 2px",
    maxWidth: "100%",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "22px",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
  },
  lead: {
    margin: 0,
    width: "100%",
    maxWidth: "286px",
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: 0,
  },
  privacyNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    width: "100%",
    maxWidth: "286px",
    flexWrap: "wrap",
    margin: "-2px 0 0",
    color: "#7d7468",
    fontFamily: UI_FONT,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  privacyNoteIcon: {
    display: "inline-grid",
    placeItems: "center",
    flex: "0 0 auto",
    color: "#8a7667",
  },
  deliveryWaiting: {
    display: "grid",
    justifyItems: "center",
    gap: "12px",
    width: "100%",
    minWidth: 0,
    margin: "4px 0 -2px",
  },
  deliveryWaitingPhotoFrame: {
    ...deliveredLetterStyles.photoFrame,
    display: "block",
    width: "min(100%, 240px, calc(100dvh - 300px))",
    aspectRatio: "1 / 1",
  },
  deliveryWaitingPhoto: {
    ...deliveredLetterStyles.photo,
  },
  deliveryWaitingPhotoPlaceholder: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.38), rgba(235,226,214,0.22))",
  },
  deliveryWaitingStatus: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    minWidth: "210px",
    padding: "4px 18px 5px",
    border: "none",
    background: "transparent",
    boxShadow: "none",
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
  embeddedBrowserNotice: {
    margin: "2px 0 -2px",
    width: "min(100%, 286px)",
    boxSizing: "border-box",
    border: "1px solid rgba(120,108,94,0.1)",
    borderRadius: "16px",
    background: "rgba(255,253,248,0.54)",
    color: "#7a7065",
    fontFamily: UI_FONT,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.7,
    padding: "9px 11px",
  },
  namePreviewPhotoFrame: {
    ...deliveredLetterStyles.photoFrame,
    display: "block",
    width: "min(100%, 220px)",
    aspectRatio: "1 / 1",
  },
  namePreviewPhoto: {
    ...deliveredLetterStyles.photo,
  },
  nameForm: {
    width: "min(100%, 292px)",
    maxWidth: "100%",
    minWidth: 0,
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
    marginTop: "14px",
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
  photoDebugPanel: {
    width: "min(100%, 280px)",
    margin: "0",
    border: "1px dashed rgba(142, 80, 70, 0.34)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,253,248,0.72)",
    color: "#5f554b",
    fontFamily: UI_FONT,
    fontSize: "11px",
    lineHeight: 1.45,
    padding: "9px 10px",
    textAlign: "left",
    boxSizing: "border-box",
  },
  photoDebugSummary: {
    cursor: "pointer",
    color: "var(--seal)",
    fontWeight: 500,
    letterSpacing: "0.03em",
  },
  photoDebugText: {
    margin: "8px 0 0",
  },
  photoDebugList: {
    display: "grid",
    gap: "5px",
    margin: "8px 0 0",
  },
  photoDebugRow: {
    display: "grid",
    gridTemplateColumns: "68px minmax(0, 1fr)",
    gap: "7px",
    alignItems: "start",
  },
  photoDebugLabel: {
    color: "#8a7d70",
    fontWeight: 500,
  },
  photoDebugValue: {
    minWidth: 0,
    margin: 0,
    overflowWrap: "anywhere",
  },
  result: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "17px",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  kicker: {
    margin: 0,
    maxWidth: "100%",
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
  },
  subTitle: {
    margin: "6px 0 0",
    maxWidth: "100%",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "22px",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
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
  deliveredResult: {
    gap: "12px",
  },
  onboardingFourChoiceLetter: {
    ...deliveredLetterStyles.sheet,
    width: "min(100%, 406px)",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  onboardingFourChoiceLead: {
    margin: "12px 0 14px",
    color: "var(--ink-soft)",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.65,
    textAlign: "center",
  },
  onboardingFourChoiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "9px",
  },
  onboardingFourChoiceOption: {
    position: "relative",
    minWidth: 0,
    aspectRatio: "1 / 1",
    padding: 0,
    overflow: "hidden",
    border: "2px solid color-mix(in srgb, var(--line) 82%, transparent)",
    borderRadius: "16px",
    background: "var(--paper-warm)",
    boxShadow: "0 4px 14px rgba(70, 50, 30, 0.10)",
    cursor: "pointer",
    transition:
      "border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease",
  },
  onboardingFourChoiceOptionSelected: {
    border: "2px solid var(--seal)",
    transform: "translateY(-2px)",
    boxShadow:
      "0 0 0 2px color-mix(in srgb, var(--seal) 18%, transparent), 0 8px 20px rgba(70, 50, 30, 0.18)",
  },
  onboardingFourChoicePhoto: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  onboardingFourChoiceMark: {
    position: "absolute",
    right: "8px",
    bottom: "8px",
    minWidth: "26px",
    height: "26px",
    padding: "0 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "999px",
    background: "var(--seal)",
    color: "#fff",
    fontFamily: UI_FONT,
    fontSize: "11px",
    fontWeight: 500,
    boxSizing: "border-box",
  },
  onboardingFourChoiceSave: {
    width: "100%",
    marginTop: "14px",
  },
  onboardingFourChoiceError: {
    margin: "10px 0 0",
    color: "var(--danger, #9f3f36)",
    fontFamily: UI_FONT,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
    textAlign: "center",
  },
  onboardingDeliveredLetter: {
    ...deliveredLetterStyles.sheet,
    width: "min(100%, 350px)",
    maxWidth: "100%",
    minWidth: 0,
    padding: 0,
  },
  onboardingDeliveredMasthead: {
    ...deliveredLetterStyles.masthead,
  },
  onboardingDeliveredTitle: {
    ...deliveredLetterStyles.title,
  },
  onboardingDeliveredMastheadRule: {
    ...deliveredLetterStyles.mastheadRule,
  },
  onboardingDeliveredPhotoFrame: {
    ...deliveredLetterStyles.photoFrame,
  },
  onboardingDeliveredPhoto: {
    ...deliveredLetterStyles.photo,
    animation: "deliveredPhotoIn 360ms cubic-bezier(0, 0, 0.2, 1) both",
  },
  onboardingDeliveredPhotoLoading: {
    ...deliveredLetterStyles.loadingOverlay,
  },
  onboardingDeliveredNote: {
    ...deliveredLetterStyles.note,
  },
  onboardingDeliveredSavedPhrase: {
    ...deliveredLetterStyles.savedPhrase,
    whiteSpace: "normal",
  },
  onboardingDeliveredContinue: {
    ...deliveredLetterStyles.action,
  },
  savedPhoto: {
    width: "min(100%, 260px)",
    aspectRatio: "4 / 3",
    objectFit: "cover",
    borderRadius: "var(--radius-2xl)",
    border: "7px solid rgba(255,253,248,0.82)",
    boxShadow: "0 14px 34px rgba(90,76,60,0.12)",
  },
  recoveryPanel: {
    ...deliveredLetterStyles.recoveryPanel,
  },
  recoveryText: {
    ...deliveredLetterStyles.recoveryText,
  },
  resultText: {
    width: "min(100%, 286px)",
    maxWidth: "100%",
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.9,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;

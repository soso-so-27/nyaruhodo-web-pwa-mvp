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
  createOnboardingPreviewExchange,
  createSleepingExchange,
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  deleteOwnSleepingPhoto,
  keepExchangePhotoDurably,
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
  markOnboardingSkipped,
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
import { finalizeOnboardingDeliveryChoice } from "../../lib/onboarding/choiceClient";
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
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
} from "../home/homeInputHelpers";
import { AppButton } from "../ui/AppButton";
import { CatChoicePreview } from "../ui/CatChoicePreview";
import { PhotoTile } from "../ui/PhotoTile";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";
import { WordmarkHeader } from "../ui/AppHeader";
import { deliveredLetterStyles } from "../ui/deliveredLetterStyles";
import { useNaturalPhotoFrame } from "../ui/useNaturalPhotoFrame";

type OnboardingState =
  | "intro"
  | "photo_confirm"
  | "choice_loading"
  | "choice"
  | "photo_prompt"
  | "saving"
  | "envelope"
  | "delivered"
  | "empty"
  | "kept"
  | "joined";

type OnboardingIntroStep = "value" | "kuji";

type OnboardingDeliveryIssue = "no_candidate" | "temporary_error";
type OnboardingSavingStage =
  | "loading_choices"
  | "saving_photo"
  | "receiving_letter";

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
  const [introStep, setIntroStep] =
    useState<OnboardingIntroStep>("value");
  const [draftPhotoPreviewSrc, setDraftPhotoPreviewSrc] = useState("");
  const [selectedPhotoSrc, setSelectedPhotoSrc] = useState("");
  const [deliveredPhoto, setDeliveredPhoto] = useState<ExchangePhoto | null>(null);
  const [deliveredPhotos, setDeliveredPhotos] = useState<ExchangePhoto[]>([]);
  const [deliveryBundleId, setDeliveryBundleId] = useState<string | null>(null);
  const [selectedDeliveryPhotoId, setSelectedDeliveryPhotoId] = useState<
    string | null
  >(null);
  const [previewDeliveryPhotoId, setPreviewDeliveryPhotoId] = useState<
    string | null
  >(null);
  const [failedDeliveryPhotoIds, setFailedDeliveryPhotoIds] = useState<
    Set<string>
  >(() => new Set());
  const [isFinalizingDeliveryChoice, setIsFinalizingDeliveryChoice] =
    useState(false);
  const isFinalizingDeliveryChoiceRef = useRef(false);
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
  const [hasResolvedDisplayEnvironment, setHasResolvedDisplayEnvironment] =
    useState(false);
  const [hasResolvedOnboardingProgress, setHasResolvedOnboardingProgress] =
    useState(false);
  const [isOpeningEnvelope, setIsOpeningEnvelope] = useState(false);
  const [isRetryingDelivery, setIsRetryingDelivery] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
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
  const prefersReducedMotion = usePrefersReducedMotion();
  const autoKeptDeliveredPhotoIdRef = useRef("");
  const hasTrackedIntroViewRef = useRef(false);
  const hasTrackedPreviewShownRef = useRef("");
  const hasTrackedEmbeddedBrowserRef = useRef(false);
  const hasResolvedProgressRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const isPhotoPickerOpenRef = useRef(false);
  const draftPhotoFileRef = useRef<File | null>(null);
  const draftPhotoPreviewSrcRef = useRef("");
  const isOpeningEnvelopeRef = useRef(false);
  const isContinuingRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const revealStartedAtRef = useRef<number | null>(null);
  const revealPhotoLoadedTrackedRef = useRef("");
  const revealPhotoRenderedTrackedRef = useRef("");
  const revealPhotoErrorTrackedRef = useRef("");
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
  const completedDeliveryPhoto = isDeliveredPhotoKept
    ? (selectedDeliveryPhoto ?? deliveredPhoto)
    : null;
  const previewDeliveryPhoto =
    deliveredPhotos.find((photo) => photo.id === previewDeliveryPhotoId) ??
    null;

  useEffect(() => {
    resetDeliveredPhotoAspect();
  }, [deliveredPhoto?.id, resetDeliveredPhotoAspect]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [state]);

  useEffect(() => {
    return () => {
      if (draftPhotoPreviewSrcRef.current) {
        URL.revokeObjectURL(draftPhotoPreviewSrcRef.current);
      }
    };
  }, []);

  function replaceDraftPhoto(file: File) {
    const nextPreviewSrc = URL.createObjectURL(file);
    if (draftPhotoPreviewSrcRef.current) {
      URL.revokeObjectURL(draftPhotoPreviewSrcRef.current);
    }
    draftPhotoFileRef.current = file;
    draftPhotoPreviewSrcRef.current = nextPreviewSrc;
    setDraftPhotoPreviewSrc(nextPreviewSrc);
  }

  function clearDraftPhoto() {
    if (draftPhotoPreviewSrcRef.current) {
      URL.revokeObjectURL(draftPhotoPreviewSrcRef.current);
    }
    draftPhotoFileRef.current = null;
    draftPhotoPreviewSrcRef.current = "";
    setDraftPhotoPreviewSrc("");
  }

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
    const embeddedBrowser = isEmbeddedInAppBrowser();

    setIsPhotoDebugMode(enabled);
    setIsEmbeddedBrowser(embeddedBrowser);
    setHasResolvedDisplayEnvironment(true);
  }, []);

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
      try {
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
        setIntroStep("value");
        setState("intro");
        setMessage(
          "テスト用に、この端末のオンボーディング状態とログイン状態をリセットしました。",
        );
        resolveOnboardingProgress(source, null);
      } finally {
        setHasResolvedOnboardingProgress(true);
      }
    })();
  }, []);

  useEffect(() => {
    const isPhotoFirstChoice =
      state === "delivered" &&
      Boolean(pendingOwnPhoto) &&
      Boolean(deliveryBundleId) &&
      deliveredPhotos.length === 4 &&
      !isDeliveredPhotoKept;
    if (
      (state !== "choice" && !isPhotoFirstChoice) ||
      !deliveryBundleId ||
      deliveredPhotos.length !== 4 ||
      hasTrackedPreviewShownRef.current === deliveryBundleId
    ) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      hasTrackedPreviewShownRef.current = deliveryBundleId;
      trackProductEvent("onboarding_preview_shown", {
        source: getEffectiveEntrySource(),
        submission_id:
          readCurrentOnboardingProgress()?.submissionId ?? null,
        delivery_bundle_id: deliveryBundleId,
        candidate_count: deliveredPhotos.length,
        flow_version: isPhotoFirstChoice
          ? "onboarding_own_photo_first_v3"
          : "onboarding_selection_first_v2",
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [
    deliveryBundleId,
    deliveredPhotos.length,
    isDeliveredPhotoKept,
    pendingOwnPhoto,
    state,
  ]);

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
    void markDeliveredPhotoReadyForOnboarding();
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
      router.replace("/home");
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
        router.replace("/home");
      } else {
        router.replace("/home");
      }
      return true;
    }

    const resumedProgress = decision.progress;

    if (decision.kind === "preview" || decision.kind === "photo_prompt") {
      const photos =
        resumedProgress.deliveredPhotos ??
        (resumedProgress.deliveredPhoto
          ? [resumedProgress.deliveredPhoto]
          : []);
      const selectedPhotoId =
        decision.kind === "photo_prompt"
          ? resumedProgress.pendingDeliveryPhotoId ?? null
          : null;
      const selectedPhoto =
        photos.find((photo) => photo.id === selectedPhotoId) ??
        resumedProgress.deliveredPhoto ??
        photos[0] ??
        null;

      setSelectedPhotoSrc(resumedProgress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(resumedProgress.ownPhoto ?? null);
      setDeliveredPhoto(selectedPhoto);
      setDeliveredPhotos(photos);
      setDeliveryBundleId(resumedProgress.deliveryBundleId ?? null);
      setSelectedDeliveryPhotoId(selectedPhotoId);
      setPreviewDeliveryPhotoId(selectedPhotoId);
      setIsDeliveredPhotoKept(false);
      setState("choice");
      return true;
    }

    if (decision.kind === "envelope") {
      const resumedPhotos =
        resumedProgress.deliveredPhotos ??
        (resumedProgress.deliveredPhoto
          ? [resumedProgress.deliveredPhoto]
          : []);
      const canResumePhotoFirstChoice = Boolean(
        resumedProgress.ownPhoto &&
          resumedProgress.deliveryBundleId &&
          resumedPhotos.length === 4,
      );
      setSelectedPhotoSrc(resumedProgress.selectedPhotoSrc ?? "");
      setPendingOwnPhoto(resumedProgress.ownPhoto ?? null);
      setDeliveredPhoto(resumedProgress.deliveredPhoto ?? null);
      setDeliveredPhotos(resumedPhotos);
      setDeliveryBundleId(resumedProgress.deliveryBundleId ?? null);
      setSelectedDeliveryPhotoId(null);
      setIsDeliveredPhotoKept(
        resumedProgress.isDeliveredPhotoKept ?? !canResumePhotoFirstChoice,
      );
      setState(canResumePhotoFirstChoice ? "delivered" : "envelope");
      return true;
    }

    if (decision.kind === "naming") {
      patchOnboardingProgress({
        stage: "opened",
        source,
        ownPhoto: resumedProgress.ownPhoto,
        selectedPhotoSrc: resumedProgress.selectedPhotoSrc,
        deliveredPhoto: resumedProgress.deliveredPhoto,
        isDeliveredPhotoKept:
          resumedProgress.isDeliveredPhotoKept ?? true,
      });
      markOnboardingAlbumCompletionReady();
      markOnboardingAlbumCreated(source);
      router.replace("/home");
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
      if (
        resumedProgress.deliveryBundleId &&
        resumedProgress.pendingDeliveryPhotoId &&
        resumedProgress.deliveredPhotos?.some(
          (photo) => photo.id === resumedProgress.pendingDeliveryPhotoId,
        )
      ) {
        setDeliveredPhotos(resumedProgress.deliveredPhotos);
        setDeliveryBundleId(resumedProgress.deliveryBundleId);
        setSelectedDeliveryPhotoId(
          resumedProgress.pendingDeliveryPhotoId,
        );
        setPreviewDeliveryPhotoId(resumedProgress.pendingDeliveryPhotoId);
        setDeliveredPhoto(
          resumedProgress.deliveredPhotos.find(
            (photo) =>
              photo.id === resumedProgress.pendingDeliveryPhotoId,
          ) ?? resumedProgress.deliveredPhoto ?? null,
        );
        void resumePreviewCommit(resumedProgress);
      } else {
        void resumeSubmittedProgress(resumedProgress);
      }
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
      flow_version: "onboarding_own_photo_first_v3",
    });
  }

  function selectDeliveryPhoto(photo: ExchangePhoto, index: number) {
    setSelectedDeliveryPhotoId(photo.id);
    setDeliveryChoiceError("");
    trackProductEvent(
      state === "choice"
        ? "onboarding_preview_option_selected"
        : "onboarding_delivery_choice_selected",
      {
        source: getEffectiveEntrySource(),
        flow_version:
          state === "choice"
            ? "onboarding_selection_first_v2"
            : "onboarding_own_photo_first_v3",
        delivery_bundle_id: deliveryBundleId,
        photo_id: photo.id,
        selected_position: index + 1,
        candidate_count: deliveredPhotos.length,
      },
    );
  }

  function openDeliveryPhotoPreview(
    photo: ExchangePhoto,
    index: number,
    previewSource: "grid" | "preview_navigation" = "grid",
  ) {
    if (failedDeliveryPhotoIds.has(photo.id)) {
      return;
    }
    setDeliveryChoiceError("");
    setPreviewDeliveryPhotoId(photo.id);
    trackProductEvent(
      state === "choice"
        ? "onboarding_preview_option_opened"
        : "onboarding_delivery_choice_previewed",
      {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: deliveryBundleId,
        photo_id: photo.id,
        previewed_position: index + 1,
        preview_source: previewSource,
        candidate_count: deliveredPhotos.length,
      },
    );
  }

  function confirmDeliveryPhotoPreview() {
    if (
      !previewDeliveryPhoto ||
      failedDeliveryPhotoIds.has(previewDeliveryPhoto.id) ||
      isFinalizingDeliveryChoiceRef.current ||
      isPhotoPickerOpenRef.current ||
      state === "saving"
    ) {
      return;
    }

    const index = deliveredPhotos.findIndex(
      (photo) => photo.id === previewDeliveryPhoto.id,
    );
    if (index < 0) {
      return;
    }

    selectDeliveryPhoto(previewDeliveryPhoto, index);
    if (state === "choice") {
      if (handleConfirmPreviewChoice(previewDeliveryPhoto)) {
        void handleSelectSleepingPhoto();
      }
      return;
    }

    void handleSaveOnboardingDeliveryChoice(previewDeliveryPhoto);
  }

  function handleDeliveryPhotoError(photo: ExchangePhoto) {
    setFailedDeliveryPhotoIds((current) => {
      const next = new Set(current);
      next.add(photo.id);
      return next;
    });
    if (selectedDeliveryPhotoId === photo.id) {
      setSelectedDeliveryPhotoId(null);
    }
    if (previewDeliveryPhotoId === photo.id) {
      setPreviewDeliveryPhotoId(null);
    }
  }

  async function handleStartOnboardingPreview() {
    if (isLoadingPreview || isSubmittingRef.current) {
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

    const dateKey = getJstDateKey();
    const anonymousId = getOrCreateOnboardingAnonymousId();
    const journey = getOrCreateOnboardingJourney({
      dateKey,
      source,
    });
    const submissionId = createOnboardingSubmissionId(
      anonymousId,
      dateKey,
      journey.id,
    );
    const activeProfile = getActiveCatProfile(
      readCatProfiles(),
      readActiveCatId(),
    );

    isSubmittingRef.current = true;
    setFailedDeliveryPhotoIds(new Set());
    setIsLoadingPreview(true);
    setSavingStage("loading_choices");
    setState("choice_loading");
    setMessage("");
    setDeliveryIssue(null);
    trackProductEvent("onboarding_preview_started", {
      source,
      submission_id: submissionId,
      flow_version: "onboarding_selection_first_v2",
    });

    try {
      const result = await createOnboardingPreviewExchange({
        deliveryDateKey: dateKey,
        recipientCatId: activeProfile.id,
        seed: `${submissionId}:preview`,
        onboardingSubmission: {
          dateKey,
          journeyId: journey.id,
          resumeToken: journey.resumeToken,
          source,
          submissionId,
        },
      });
      const photos = (result?.photos ?? []).filter(
        (photo) => photo && isUsablePhotoSrc(photo.src),
      );
      const isValidPreview = Boolean(
        result?.bundleId &&
          result.experienceVersion === "onboarding_choice_v1" &&
          result.servedVariant === "four_choice_v1" &&
          photos.length === 4 &&
          photos.every((photo) =>
            photo.id.startsWith(`${result.bundleId}-choice-`),
          ),
      );

      if (!isValidPreview || !result?.bundleId) {
        const hasTemporaryFailure = Boolean(
          result?.error ||
            (typeof result?.httpStatus === "number" &&
              result.httpStatus >= 400),
        );
        setDeliveryIssue(
          hasTemporaryFailure ? "temporary_error" : "no_candidate",
        );
        setState("empty");
        trackProductEvent("onboarding_preview_failed", {
          source,
          error_code: result?.error ?? "preview_unavailable",
          http_status: result?.httpStatus ?? null,
          candidate_count: photos.length,
        });
        return;
      }

      const firstPhoto = photos[0];
      setDeliveredPhoto(firstPhoto);
      setDeliveredPhotos(photos);
      setDeliveryBundleId(result.bundleId);
      setSelectedDeliveryPhotoId(null);
      setIsDeliveredPhotoKept(false);
      await writeOnboardingProgressDurably({
        version: 1,
        anonymousId,
        dateKey,
        stage: "preview_ready",
        source,
        journeyId: journey.id,
        submissionId,
        resumeToken: journey.resumeToken,
        deliveredPhoto: firstPhoto,
        deliveredPhotos: photos,
        deliveryBundleId: result.bundleId,
        isDeliveredPhotoKept: false,
        updatedAt: Date.now(),
      });
      setState("choice");
    } catch (error) {
      setDeliveryIssue("temporary_error");
      setMessage(
        canShowTestTools && error instanceof Error
          ? `候補の確認で止まりました: ${error.message}`
          : "",
      );
      setState("empty");
      trackProductEvent("onboarding_preview_failed", {
        source,
        error_code:
          error instanceof Error
            ? error.message.slice(0, 120)
            : "preview_failed",
      });
    } finally {
      isSubmittingRef.current = false;
      setIsLoadingPreview(false);
    }
  }

  function handleConfirmPreviewChoice(photoOverride?: ExchangePhoto) {
    const photoToConfirm = photoOverride ?? selectedDeliveryPhoto;
    if (
      !deliveryBundleId ||
      !photoToConfirm ||
      deliveredPhotos.length !== 4 ||
      isFinalizingDeliveryChoiceRef.current
    ) {
      return false;
    }

    setDeliveryChoiceError("");
    const currentProgress = readCurrentOnboardingProgress();
    const progressPatch = {
      stage: "photo_pending" as const,
      source: getEffectiveEntrySource(),
      deliveredPhoto: photoToConfirm,
      deliveredPhotos,
      deliveryBundleId,
      pendingDeliveryPhotoId: photoToConfirm.id,
      isDeliveredPhotoKept: false,
    };
    patchOnboardingProgress(progressPatch);
    void patchOnboardingProgressDurably(progressPatch).catch(() => {
      trackProductEvent("onboarding_preview_progress_persist_failed", {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: deliveryBundleId,
        photo_id: photoToConfirm.id,
        flow_version: "onboarding_selection_first_v2",
      });
    });
    trackProductEvent("onboarding_preview_selected", {
      source: getEffectiveEntrySource(),
      submission_id: currentProgress?.submissionId ?? null,
      delivery_bundle_id: deliveryBundleId,
      photo_id: photoToConfirm.id,
      selected_position:
        deliveredPhotos.findIndex((photo) => photo.id === photoToConfirm.id) + 1,
      candidate_count: deliveredPhotos.length,
      flow_version: "onboarding_selection_first_v2",
    });
    trackProductEvent("onboarding_photo_prompt_view", {
      source: getEffectiveEntrySource(),
      delivery_bundle_id: deliveryBundleId,
      flow_version: "onboarding_selection_first_v2",
    });
    setMessage("");
    setDeliveredPhoto(photoToConfirm);
    setPreviewDeliveryPhotoId(photoToConfirm.id);
    return true;
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

  function handleContinueFromOnboardingValue() {
    setIntroStep("kuji");
    trackProductEvent("onboarding_value_continue_click", {
      source: getEffectiveEntrySource(),
    });
    trackProductEvent("onboarding_kuji_intro_view", {
      source: getEffectiveEntrySource(),
      flow_version: "onboarding_own_photo_first_v3",
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

    const currentProgress = readCurrentOnboardingProgress();
    const isPreviewPhotoPrompt =
      currentProgress?.stage === "photo_pending" &&
      Boolean(
        currentProgress.deliveryBundleId &&
          currentProgress.pendingDeliveryPhotoId &&
          currentProgress.deliveredPhotos?.some(
            (photo) =>
              photo.id === currentProgress.pendingDeliveryPhotoId,
          ),
      );
    const restored = isPreviewPhotoPrompt
      ? false
      : restoreExistingProgress(currentProgress, source);

    if (restored) {
      return;
    }

    if (isPreviewPhotoPrompt) {
      trackProductEvent("onboarding_photo_invite_click", {
        source,
        submission_id: currentProgress?.submissionId ?? null,
        delivery_bundle_id: currentProgress?.deliveryBundleId ?? null,
      });
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

      replaceDraftPhoto(file);
      setMessage("");
      setDeliveryIssue(null);
      if (isPhotoDebugMode) {
        setPhotoDebugInfo(createOnboardingPhotoDebugInfo("selected", file));
      } else {
        setPhotoDebugInfo(null);
      }
      setState("photo_confirm");
      trackProductEvent("onboarding_photo_selected_for_review", {
        source: getEffectiveEntrySource(),
        file_size_bucket: getFileSizeBucket(file.size),
        file_type: sanitizeFileType(file.type),
        file_extension: getSafeFileExtension(file.name),
      });
      releasePhotoSelection();
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

  async function handleConfirmSleepingPhoto() {
    if (state !== "photo_confirm" || isSubmittingRef.current) {
      return;
    }

    const file = draftPhotoFileRef.current;
    const validation = validateImageFile(file);
    if (!file || !validation.ok) {
      const rejectionReason = validation.ok
        ? "missing_file"
        : validation.reason;
      setMessage(getOnboardingPhotoInputErrorMessage(rejectionReason));
      return;
    }

    const currentProgress = readCurrentOnboardingProgress();
    const previewProgress =
      currentProgress?.stage === "photo_pending" &&
      currentProgress.deliveryBundleId &&
      currentProgress.pendingDeliveryPhotoId &&
      currentProgress.deliveredPhotos?.some(
        (photo) => photo.id === currentProgress.pendingDeliveryPhotoId,
      )
        ? currentProgress
        : null;

    trackProductEvent("onboarding_photo_confirmed", {
      source: getEffectiveEntrySource(),
      submission_id: previewProgress?.submissionId ?? null,
      delivery_bundle_id: previewProgress?.deliveryBundleId ?? null,
      file_size_bucket: getFileSizeBucket(file.size),
      file_type: sanitizeFileType(file.type),
      file_extension: getSafeFileExtension(file.name),
    });

    await saveConfirmedSleepingPhoto(
      file,
      validation.acceptedBy,
      previewProgress,
    );
  }

  async function saveConfirmedSleepingPhoto(
    file: File,
    acceptedBy: "mime" | "extension",
    previewProgress: OnboardingProgress | null,
  ) {
    if (isSubmittingRef.current) {
      return;
    }

    setState("saving");
    setSavingStage("saving_photo");
    isSubmittingRef.current = true;
    setSelectedPhotoSrc("");
    setMessage("");
    setDeliveryIssue(null);

    let savedResult: Awaited<
      ReturnType<typeof saveSleepingPhotoWithFallback>
    > | null = null;
    let catId = "";
    const onboardingDateKey = previewProgress?.dateKey ?? getJstDateKey();
    const anonymousId = getOrCreateOnboardingAnonymousId();
    const onboardingJourney = getOrCreateOnboardingJourney({
      dateKey: onboardingDateKey,
      source: getEffectiveEntrySource(),
      journeyId: previewProgress?.journeyId,
      resumeToken: previewProgress?.resumeToken,
    });
    const submissionId =
      previewProgress?.submissionId ??
      createOnboardingSubmissionId(
        anonymousId,
        onboardingDateKey,
        onboardingJourney.id,
      );
    const ownPhotoId = createOnboardingOwnPhotoId(submissionId);

    try {
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
          setMessage(
            "写真を保存できませんでした。少し時間をおいて、もう一度試してください。",
          );
          setSelectedPhotoSrc("");
          setState("photo_confirm");
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
            ? "写真の読み込みが途中で止まりました。少し待ってから、もう一度お試しください。"
            : "写真を保存できませんでした。少し時間をおいて、もう一度試してください。",
        );
        setSelectedPhotoSrc("");
        setState("photo_confirm");
        return;
      }

      const { dataUrl, ownPhoto } = savedResult;
      const isPreviewCommit = Boolean(
        previewProgress?.stage === "photo_pending" &&
          previewProgress.deliveryBundleId &&
          previewProgress.pendingDeliveryPhotoId &&
          previewProgress.deliveredPhotos?.some(
            (photo) => photo.id === previewProgress.pendingDeliveryPhotoId,
          ),
      );
      const previewPhotos = isPreviewCommit
        ? (previewProgress?.deliveredPhotos ?? [])
        : [];
      const previewSelectedPhoto = isPreviewCommit
        ? previewPhotos.find(
            (photo) => photo.id === previewProgress?.pendingDeliveryPhotoId,
          ) ?? null
        : null;

      setSelectedPhotoSrc(dataUrl);
      setSavingStage("receiving_letter");
      setPendingOwnPhoto(ownPhoto);
      setDeliveredPhoto(previewSelectedPhoto);
      setDeliveredPhotos(previewPhotos);
      setDeliveryBundleId(
        isPreviewCommit
          ? (previewProgress?.deliveryBundleId ?? null)
          : null,
      );
      setSelectedDeliveryPhotoId(
        isPreviewCommit
          ? (previewProgress?.pendingDeliveryPhotoId ?? null)
          : null,
      );
      setDeliveryChoiceError("");
      setIsDeliveredPhotoKept(false);
      autoKeptDeliveredPhotoIdRef.current = "";
      clearDraftPhoto();

      try {
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
          ...(isPreviewCommit
            ? {
                deliveredPhoto: previewSelectedPhoto ?? undefined,
                deliveredPhotos: previewPhotos,
                deliveryBundleId:
                  previewProgress?.deliveryBundleId ?? undefined,
                pendingDeliveryPhotoId:
                  previewProgress?.pendingDeliveryPhotoId ?? undefined,
                isDeliveredPhotoKept: false,
              }
            : {}),
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
          flow_version: isPreviewCommit
            ? "onboarding_selection_first_v2"
            : "onboarding_own_photo_first_v3",
          submission_id: submissionId,
          delivery_date_key: onboardingDateKey,
          file_acceptance: acceptedBy,
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

        const delivered = isPreviewCommit
          ? await commitOnboardingPreview({
              ownPhoto,
              progress:
                readCurrentOnboardingProgress() ?? {
                  ...previewProgress!,
                  stage: "submitted",
                  ownPhoto,
                  selectedPhotoSrc: dataUrl,
                  updatedAt: Date.now(),
                },
            })
          : await deliverOwnSleepingPhoto({
              ownPhoto,
              recipientCatId: catId,
              deliveryDateKey: onboardingDateKey,
              submissionId,
              selectedPhotoSrc: dataUrl,
            });

        if (!delivered) {
          setState("empty");
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
      }
    } finally {
      isSubmittingRef.current = false;
    }
  }

  function continueAfterOnboardingLetter() {
    completeOnboardingAt("/home");
  }

  function continueToOwnCatAfterOnboarding() {
    completeOnboardingAt("/cats");
  }

  function continueToNekodayoriAfterJoining() {
    completeOnboardingAt("/collection");
  }

  function completeOnboardingAt(destination: "/home" | "/cats" | "/collection") {
    if (isContinuingRef.current) {
      return;
    }

    isContinuingRef.current = true;
    setIsContinuing(true);
    markOnboardingAlbumCompletionReady();
    markOnboardingAlbumCreated(getEffectiveEntrySource());
    window.location.assign(destination);
  }

  async function finishOnboardingPreviewInCollection({
    selectedPhoto,
    previewPhotos,
    bundleId,
  }: {
    selectedPhoto: ExchangePhoto;
    previewPhotos: ExchangePhoto[];
    bundleId: string;
  }) {
    const persistedPhoto = await keepExchangePhotoDurably(selectedPhoto);
    if (!persistedPhoto.persisted) {
      trackProductEvent("onboarding_preview_photo_persist_failed", {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: bundleId,
        photo_id: selectedPhoto.id,
        flow_version: "onboarding_selection_first_v2",
      });
      setDeliveryIssue("temporary_error");
      return false;
    }

    const source = getEffectiveEntrySource();
    setDeliveredPhoto(selectedPhoto);
    setDeliveredPhotos(previewPhotos);
    setDeliveryBundleId(bundleId);
    setSelectedDeliveryPhotoId(selectedPhoto.id);
    setIsDeliveredPhotoKept(true);
    await patchOnboardingProgressDurably({
      stage: "album_created",
      source,
      deliveredPhoto: selectedPhoto,
      deliveredPhotos: previewPhotos,
      deliveryBundleId: bundleId,
      pendingDeliveryPhotoId: selectedPhoto.id,
      isDeliveredPhotoKept: true,
      completionCopy: getEveningDeliveryCompletionCopy(),
    });

    trackProductEvent("onboarding_delivered_photo_confirmed", {
      source,
      source_photo_id: selectedPhoto.sourcePhotoId ?? null,
      saved_to_album: true,
      test_mode: canShowTestTools,
      delivery_bundle_id: bundleId,
      candidate_count: previewPhotos.length,
      flow_version: "onboarding_selection_first_v2",
    });

    if (!isTestMode) {
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      window.dispatchEvent(
        new Event(HOME_INSTALL_ONBOARDING_COMPLETED_EVENT),
      );
      trackProductEvent("onboarding_completed", {
        source,
        method: "delivery_confirmed",
        photo_id: selectedPhoto.id,
        delivery_photo_id: selectedPhoto.id,
        delivery_bundle_id: bundleId,
        flow_version: "onboarding_selection_first_v2",
      });
    }

    markOnboardingAlbumCompletionReady();
    try {
      window.sessionStorage.setItem(
        STORAGE_KEYS.onboardingCollectionNotice,
        "1",
      );
    } catch {
      // The collection still contains the photo when session storage is unavailable.
    }
    window.location.replace("/collection");
    return true;
  }

  async function resumePreviewCommit(progress: OnboardingProgress) {
    if (isSubmittingRef.current || !progress.ownPhoto) {
      return;
    }

    isSubmittingRef.current = true;
    setMessage("");
    setDeliveryIssue(null);

    try {
      const committed = await commitOnboardingPreview({
        ownPhoto: progress.ownPhoto,
        progress,
      });
      if (!committed) {
        setState("empty");
      }
    } catch (error) {
      setDeliveryIssue("temporary_error");
      setMessage(
        canShowTestTools && error instanceof Error
          ? `交換の確定で止まりました: ${error.message}`
          : "",
      );
      setState("empty");
    } finally {
      isSubmittingRef.current = false;
    }
  }

  function handleContinueAfterDeliveredPhoto() {
    if (!isDeliveredPhotoKept || isContinuingRef.current) {
      return;
    }

    continueAfterOnboardingLetter();
  }

  async function markDeliveredPhotoReadyForOnboarding(
    selectedPhoto = deliveredPhoto,
  ) {
    if (!selectedPhoto) {
      return false;
    }

    const persistedPhoto = await keepExchangePhotoDurably(selectedPhoto);
    const savedToReceived = persistedPhoto.persisted;

    trackProductEvent("onboarding_delivered_photo_confirmed", {
      source: getEffectiveEntrySource(),
      source_photo_id: selectedPhoto.sourcePhotoId ?? null,
      saved_to_album: savedToReceived,
      test_mode: canShowTestTools,
      delivery_bundle_id: deliveryBundleId,
      candidate_count: deliveredPhotos.length || 1,
    });

    if (!savedToReceived) {
      trackProductEvent("onboarding_delivery_choice_persist_failed", {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: deliveryBundleId,
        photo_id: selectedPhoto.id,
      });
      setDeliveryChoiceError(
        "選んだ猫を保存できませんでした。もう一度お試しください。",
      );
      return false;
    }

    setDeliveredPhoto(selectedPhoto);
    setIsDeliveredPhotoKept(true);
    await patchOnboardingProgressDurably({
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
      trackProductEvent("onboarding_completed", {
        source: getEffectiveEntrySource(),
        method: "delivery_confirmed",
        photo_id: selectedPhoto.id,
        delivery_photo_id: selectedPhoto.id,
        delivery_bundle_id: deliveryBundleId,
      });
    }
    return true;
  }

  async function handleSaveOnboardingDeliveryChoice(
    photoOverride?: ExchangePhoto,
  ) {
    await finalizeOnboardingPhotoChoice("keep", photoOverride?.id);
  }

  async function handleSkipOnboardingDeliveryChoice() {
    await finalizeOnboardingPhotoChoice("skip");
  }

  async function finalizeOnboardingPhotoChoice(
    operation: "keep" | "skip",
    selectedPhotoIdOverride?: string,
  ) {
    const photoIdToKeep =
      selectedPhotoIdOverride ?? selectedDeliveryPhotoId;
    if (
      !deliveryBundleId ||
      deliveredPhotos.length === 0 ||
      deliveredPhotos.length > 4 ||
      (operation === "keep" && !photoIdToKeep) ||
      isFinalizingDeliveryChoiceRef.current
    ) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const deliveryDateKey = progress?.dateKey;
    if (!deliveryDateKey) {
      setDeliveryChoiceError(
        "選択を完了できませんでした。もう一度お試しください。",
      );
      return;
    }

    isFinalizingDeliveryChoiceRef.current = true;
    setIsFinalizingDeliveryChoice(true);
    setDeliveryChoiceError("");
    try {
      if (!progress?.journeyId || !progress.resumeToken) {
        setDeliveryChoiceError(
          "選択を完了できませんでした。もう一度お試しください。",
        );
        return;
      }
      const canonical = await finalizeOnboardingDeliveryChoice({
        bundleId: deliveryBundleId,
        deliveryDateKey,
        journeyId: progress.journeyId,
        operation,
        resumeToken: progress.resumeToken,
        selectedPhotoId: operation === "keep" ? photoIdToKeep : null,
        submissionId: progress.submissionId,
      });

      if (canonical?.state === "skipped") {
        trackProductEvent("onboarding_delivery_choice_skipped", {
          source: getEffectiveEntrySource(),
          flow_version: "onboarding_own_photo_first_v3",
          delivery_bundle_id: deliveryBundleId,
          delivery_date_key: deliveryDateKey,
          candidate_count: deliveredPhotos.length,
          server_conflict: canonical.conflict,
        });
        markOnboardingDeliveryChoiceSkipped();
        return;
      }

      const selectedPhoto = canonical?.selectedPhotoId
        ? deliveredPhotos.find(
            (photo) => photo.id === canonical.selectedPhotoId,
          ) ?? null
        : null;

      if (canonical?.state !== "kept" || !selectedPhoto) {
        setDeliveryChoiceError(
          "選択を完了できませんでした。もう一度お試しください。",
        );
        return;
      }

      const selectedPosition =
        deliveredPhotos.findIndex((photo) => photo.id === selectedPhoto.id) + 1;
      trackProductEvent("onboarding_delivery_choice_saved", {
        source: getEffectiveEntrySource(),
        flow_version: "onboarding_own_photo_first_v3",
        delivery_bundle_id: deliveryBundleId,
        delivery_date_key: deliveryDateKey,
        photo_id: selectedPhoto.id,
        delivery_photo_id: selectedPhoto.id,
        selected_position: selectedPosition,
        candidate_count: deliveredPhotos.length,
        server_conflict: canonical.conflict,
      });
      await markDeliveredPhotoReadyForOnboarding(selectedPhoto);
    } catch {
      setDeliveryChoiceError(
        "選択を完了できませんでした。もう一度お試しください。",
      );
    } finally {
      isFinalizingDeliveryChoiceRef.current = false;
      setIsFinalizingDeliveryChoice(false);
    }
  }

  function markOnboardingDeliveryChoiceSkipped() {
    setSelectedDeliveryPhotoId(null);
    setIsDeliveredPhotoKept(false);
    patchOnboardingProgress({
      stage: "opened",
      source: getEffectiveEntrySource(),
      deliveredPhotos,
      deliveryBundleId: deliveryBundleId ?? undefined,
      isDeliveredPhotoKept: false,
    });

    if (!isTestMode) {
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      window.dispatchEvent(
        new Event(HOME_INSTALL_ONBOARDING_COMPLETED_EVENT),
      );
      trackProductEvent("onboarding_completed", {
        source: getEffectiveEntrySource(),
        method: "delivery_skipped",
        delivery_bundle_id: deliveryBundleId,
      });
    }

    setState("kept");
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

  async function commitOnboardingPreview({
    ownPhoto,
    progress,
  }: {
    ownPhoto: OwnSleepingPhoto;
    progress: OnboardingProgress;
  }) {
    const bundleId = progress.deliveryBundleId;
    const selectedPhotoId = progress.pendingDeliveryPhotoId;
    const previewPhotos = progress.deliveredPhotos ?? [];
    const selectedPhoto = previewPhotos.find(
      (photo) => photo.id === selectedPhotoId,
    );

    if (
      !bundleId ||
      !selectedPhotoId ||
      !selectedPhoto ||
      !progress.journeyId ||
      !progress.resumeToken ||
      previewPhotos.length !== 4
    ) {
      setDeliveryIssue("temporary_error");
      return false;
    }

    const exchangeResult = await createSleepingExchange({
      ownPhoto,
      triggerLabel: "ねがお",
      theme: "sleeping",
      category: "sleeping",
      seed: `${progress.submissionId}:commit`,
      deliveryDateKey: progress.dateKey,
      recipientCatId: ownPhoto.catId,
      requestedCandidateCount: 4,
      capability: "onboarding_choice_v1",
      mode: "onboarding",
      onboardingPhase: "commit",
      onboardingSubmission: getOnboardingExchangeLedgerInput(progress),
    });

    if (
      !exchangeResult ||
      exchangeResult.error ||
      exchangeResult.bundleId !== bundleId
    ) {
      setDeliveryIssue("temporary_error");
      trackProductEvent("onboarding_preview_commit_failed", {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: bundleId,
        error_code: exchangeResult?.error ?? "commit_unavailable",
        http_status: exchangeResult?.httpStatus ?? null,
      });
      return false;
    }

    const canonical = await finalizeOnboardingDeliveryChoice({
      bundleId,
      deliveryDateKey: progress.dateKey,
      journeyId: progress.journeyId,
      operation: "keep",
      resumeToken: progress.resumeToken,
      selectedPhotoId,
      submissionId: progress.submissionId,
    });

    if (!canonical) {
      setDeliveryIssue("temporary_error");
      trackProductEvent("onboarding_preview_commit_failed", {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: bundleId,
        error_code: "choice_finalize_failed",
      });
      return false;
    }

    if (canonical.state === "skipped") {
      trackProductEvent("onboarding_preview_commit_resolved_skipped", {
        source: getEffectiveEntrySource(),
        submission_id: progress.submissionId,
        delivery_bundle_id: bundleId,
        photo_id: null,
        candidate_count: previewPhotos.length,
        server_conflict: canonical.conflict,
        outcome: "skipped",
      });
      markOnboardingDeliveryChoiceSkipped();
      markOnboardingAlbumCompletionReady();
      markOnboardingAlbumCreated(getEffectiveEntrySource());
      window.location.replace("/home");
      return true;
    }

    const canonicalSelectedPhoto = canonical.selectedPhotoId
      ? previewPhotos.find(
          (photo) => photo.id === canonical.selectedPhotoId,
        ) ?? null
      : null;
    if (!canonicalSelectedPhoto) {
      setDeliveryIssue("temporary_error");
      trackProductEvent("onboarding_preview_commit_failed", {
        source: getEffectiveEntrySource(),
        delivery_bundle_id: bundleId,
        error_code: "canonical_photo_missing",
      });
      return false;
    }

    setDeliveredPhoto(canonicalSelectedPhoto);
    setDeliveredPhotos(previewPhotos);
    setDeliveryBundleId(bundleId);
    setSelectedDeliveryPhotoId(canonicalSelectedPhoto.id);
    trackProductEvent("onboarding_preview_committed", {
      source: getEffectiveEntrySource(),
      submission_id: progress.submissionId,
      delivery_bundle_id: bundleId,
      photo_id: canonicalSelectedPhoto.id,
      candidate_count: previewPhotos.length,
      server_conflict: canonical.conflict,
      outcome: "kept",
    });
    return finishOnboardingPreviewInCollection({
      selectedPhoto: canonicalSelectedPhoto,
      previewPhotos,
      bundleId,
    });
  }

  async function handleRetryOnboardingDelivery() {
    if (isSubmittingRef.current || isRetryingDelivery) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const ownPhoto = pendingOwnPhoto ?? progress?.ownPhoto ?? null;
    if (!ownPhoto) {
      if (
        progress?.stage === "photo_pending" &&
        progress.deliveryBundleId &&
        progress.pendingDeliveryPhotoId
      ) {
        restoreExistingProgress(progress, getEffectiveEntrySource());
        return;
      }
      setState("intro");
      setMessage("");
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
      const delivered =
        progress?.deliveryBundleId &&
        progress.pendingDeliveryPhotoId &&
        progress.deliveredPhotos?.some(
          (photo) => photo.id === progress.pendingDeliveryPhotoId,
        )
          ? await commitOnboardingPreview({ ownPhoto, progress })
          : await deliverOwnSleepingPhoto({
              ownPhoto,
              recipientCatId: ownPhoto.catId,
              deliveryDateKey: progress?.dateKey,
              submissionId: progress?.submissionId,
              selectedPhotoSrc:
                selectedPhotoSrc || progress?.selectedPhotoSrc,
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
    setState(hasServerOnboardingPhotoChoice ? "delivered" : "envelope");
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
            "とどく候補を追加しました。もう一度、4匹に会ってみてください。",
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
      window.location.assign("/settings");
      return;
    }

    window.location.assign("/home");
  }

  function handleSkipPreviewAndGoHome() {
    if (!canShowTestTools) {
      markOnboardingSkipped(getEffectiveEntrySource());
    }
    handleGoHome();
  }

  const shouldShowExternalBrowserGuide =
    hasResolvedDisplayEnvironment &&
    hasResolvedOnboardingProgress &&
    state === "intro" &&
    isEmbeddedBrowser &&
    !isExternalBrowserGuideDismissed;
  const isChoiceFirstSurface =
    state === "choice_loading" ||
    state === "choice" ||
    (state === "saving" && hasOnboardingPhotoChoice);
  const isChoiceFirstLoading = state === "choice_loading";
  const isPhotoReviewSurface =
    state === "photo_confirm" ||
    (state === "saving" && !hasOnboardingPhotoChoice);
  const isPhotoFirstChoice =
    state === "delivered" &&
    Boolean(pendingOwnPhoto) &&
    hasOnboardingPhotoChoice &&
    !isDeliveredPhotoKept;
  const isPhotoFirstChoiceCompleted =
    state === "delivered" &&
    Boolean(pendingOwnPhoto) &&
    hasOnboardingPhotoChoice &&
    isDeliveredPhotoKept;
  const shouldShowBrandHeader =
    hasResolvedDisplayEnvironment &&
    hasResolvedOnboardingProgress &&
    !isChoiceFirstSurface &&
    ![
      "photo_prompt",
      "envelope",
      "delivered",
      "empty",
      "joined",
      "kept",
    ].includes(state);
  const shouldUseScrollSafeLayout = [
    "photo_confirm",
    "photo_prompt",
    "empty",
    "joined",
    "kept",
  ].includes(state) ||
    isPhotoFirstChoice ||
    isPhotoFirstChoiceCompleted;
  const shouldUseTopAlignedOnboarding =
    state === "intro" ||
    isPhotoReviewSurface ||
    isPhotoFirstChoice ||
    isPhotoFirstChoiceCompleted ||
    state === "kept";

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
        @keyframes onboardingSkeleton {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        @keyframes onboardingChoiceReveal {
          0% { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes onboardingIntroFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-onboarding-choice-card="true"],
          [data-onboarding-kuji-cat-card="true"],
          [data-onboarding-intro="true"] > * {
            animation: none !important;
          }
        }
        [data-onboarding-intro="true"] > * {
          animation: onboardingIntroFade 200ms ease-out both;
        }
        @media (max-height: 700px) {
          .onboarding-brand-header {
            top: calc(24px + env(safe-area-inset-top)) !important;
          }
          [data-onboarding-brand-space="true"] {
            padding-top: calc(76px + env(safe-area-inset-top)) !important;
          }
          [data-onboarding-value-photo="true"] {
            height: 156px !important;
            margin-top: 0 !important;
            margin-bottom: 2px !important;
            transform: scale(0.92);
          }
          [data-onboarding-kuji-collage="true"] {
            width: min(56vw, 188px) !important;
            gap: 8px !important;
          }
          [data-onboarding-completion-photo="true"] {
            width: min(100%, 212px) !important;
          }
        }
        @media (max-height: 640px) {
          [data-onboarding-scroll-safe="true"] {
            align-content: start !important;
            padding-top: calc(22px + env(safe-area-inset-top)) !important;
            padding-bottom: calc(18px + env(safe-area-inset-bottom)) !important;
          }
          [data-onboarding-brand-space="true"] {
            padding-top: calc(70px + env(safe-area-inset-top)) !important;
          }
          [data-onboarding-top-layout="true"]:not([data-onboarding-brand-space="true"]) {
            padding-top: calc(22px + env(safe-area-inset-top)) !important;
          }
          [data-onboarding-result="true"] {
            gap: 9px !important;
          }
          [data-onboarding-result="true"] [data-onboarding-subtitle="true"] {
            margin-top: 2px !important;
            font-size: 19px !important;
            line-height: 1.4 !important;
          }
          [data-onboarding-result="true"] [data-onboarding-result-copy="true"] {
            font-size: 12.5px !important;
            line-height: 1.58 !important;
          }
          [data-onboarding-prompt-photo="true"] {
            width: 88px !important;
          }
          [data-onboarding-completion-photo="true"] {
            width: min(100%, 174px) !important;
          }
          [data-onboarding-intro="true"] { gap: 6px !important; }
          [data-testid="onboarding-photo-review"] { gap: 7px !important; }
          [data-onboarding-photo-review-frame="true"] {
            width: min(100%, 190px) !important;
          }
          [data-onboarding-title="true"] {
            margin-top: 0 !important;
            font-size: 20px !important;
            line-height: 1.38 !important;
          }
          [data-onboarding-lead="true"] {
            font-size: 12.5px !important;
            line-height: 1.55 !important;
          }
          [data-onboarding-cta="true"] { margin-top: 7px !important; }
          [data-testid="onboarding-privacy-note"] { font-size: 12px !important; }
        }
      `}</style>
      <div style={styles.paperBackground} aria-hidden="true" />
      <div
        style={{
          ...styles.container,
          ...(shouldUseTopAlignedOnboarding
            ? styles.onboardingTopAlignedContainer
            : {}),
          ...(shouldUseTopAlignedOnboarding && shouldShowBrandHeader
            ? styles.onboardingTopAlignedContainerWithBrand
            : {}),
        }}
        data-testid="onboarding-layout-container"
        data-onboarding-scroll-safe={
          shouldUseScrollSafeLayout ? "true" : undefined
        }
        data-onboarding-top-layout={
          shouldUseTopAlignedOnboarding ? "true" : undefined
        }
        data-onboarding-brand-space={
          shouldUseTopAlignedOnboarding && shouldShowBrandHeader
            ? "true"
            : undefined
        }
      >
        {shouldShowBrandHeader ? (
          <WordmarkHeader
            className="onboarding-brand-header"
            style={styles.brandHeader}
          />
        ) : null}

        {shouldShowExternalBrowserGuide ? (
          <ExternalBrowserGuide
            isPreparing={isPreparingExternalBrowserHandoff}
            errorMessage={externalBrowserHandoffError}
            onOpenExternalBrowser={() => {
              void handleContinueInExternalBrowser();
            }}
            onContinue={handleContinueInEmbeddedBrowser}
          />
        ) : null}

        {!shouldShowExternalBrowserGuide &&
        hasResolvedDisplayEnvironment &&
        hasResolvedOnboardingProgress &&
        state === "intro" ? (
          <section
            style={styles.hero}
            aria-label={
              introStep === "value"
                ? "ねてるねこのはじめかた"
                : "ねこくじのはじめかた"
            }
            data-onboarding-intro="true"
            data-onboarding-intro-step={introStep}
            data-testid="onboarding-intro"
          >
            {introStep === "value" ? (
              <>
                <h1
                  style={{
                    ...styles.title,
                    ...styles.onboardingIntroTitle,
                  }}
                  data-onboarding-title="true"
                >
                  スマホには、撮った写真。
                  <br />
                  ねてるねこには、
                  <br />
                  自分で選んだ写真。
                </h1>
                <div
                  style={styles.onboardingValuePhotoStage}
                  aria-hidden="true"
                  data-testid="onboarding-value-photo-stack"
                  data-onboarding-value-photo="true"
                >
                  {[
                    "/sample-cats/pose-box.webp",
                    "/sample-cats/mugi-portrait.webp",
                    "/sample-cats/pose-stretch.webp",
                  ].map((src, index) => (
                    <span
                      key={src}
                      style={{
                        ...styles.onboardingKujiPhotoStackCard,
                        ...(index === 1
                          ? styles.onboardingKujiPhotoStackCardSelected
                          : {}),
                        transform:
                          index === 0
                            ? "translate(-58px, 8px) rotate(-8deg) scale(0.88)"
                            : index === 1
                              ? "translate(0, -4px) rotate(1deg)"
                              : "translate(58px, 9px) rotate(8deg) scale(0.88)",
                        zIndex: index === 1 ? 4 : index + 1,
                      }}
                    >
                      <img
                        src={src}
                        alt=""
                        style={styles.onboardingKujiPhotoStackImage}
                      />
                      {index === 1 ? (
                        <span style={styles.onboardingKujiPhotoStackCheck}>
                          ✓
                        </span>
                      ) : null}
                    </span>
                  ))}
                </div>
                <AppButton
                  type="button"
                  variant="accent"
                  data-testid="onboarding-intro-next"
                  onClick={handleContinueFromOnboardingValue}
                  fullWidth
                  style={{
                    ...styles.onboardingCta,
                    ...styles.onboardingIntroCta,
                    ...styles.onboardingPrimaryCta,
                  }}
                  data-onboarding-cta="true"
                >
                  次へ
                </AppButton>
              </>
            ) : (
              <>
                <p style={styles.onboardingKujiLabel}>ねこくじ</p>
                <h1
                  style={{
                    ...styles.title,
                    ...styles.onboardingIntroTitle,
                    ...styles.onboardingKujiIntroTitle,
                  }}
                  data-onboarding-title="true"
                >
                  いろんな猫を見ると、
                  <br />
                  うちの子らしさが
                  <br />
                  見えてくる。
                </h1>
                <div
                  style={styles.onboardingKujiCatCollage}
                  aria-hidden="true"
                  data-testid="onboarding-kuji-cat-collage"
                  data-onboarding-kuji-collage="true"
                >
                  {[
                    "/sample-cats/neko-kuji-curled-2.webp",
                    "/sample-cats/home-hero-generated.webp",
                    "/sample-cats/neko-kuji-curled-3.webp",
                    "/sample-cats/neko-kuji-curled-5.webp",
                  ].map((src, index) => (
                    <span
                      key={src}
                      data-onboarding-kuji-cat-card="true"
                      style={{
                        ...styles.onboardingKujiCatCollageCard,
                        transform: `rotate(${index % 2 === 0 ? -1.2 : 1.2}deg)`,
                        animationDelay: `${index * 60}ms`,
                      }}
                    >
                      <img
                        src={src}
                        alt=""
                        style={styles.onboardingKujiCatCollageImage}
                      />
                    </span>
                  ))}
                </div>
                <p
                  style={{
                    ...styles.lead,
                    ...styles.onboardingKujiIntroLead,
                  }}
                  data-onboarding-lead="true"
                  data-testid="onboarding-kuji-explanation"
                >
                  写真を1枚選ぶと、4匹が登場します。
                </p>
                <AppButton
                  type="button"
                  variant="accent"
                  data-testid="onboarding-photo-select"
                  onClick={() => {
                    void handleSelectSleepingPhoto();
                  }}
                  fullWidth
                  style={{
                    ...styles.onboardingCta,
                    ...styles.onboardingIntroCta,
                    ...styles.onboardingPrimaryCta,
                  }}
                  data-onboarding-cta="true"
                >
                  うちの子の写真を1枚選ぶ
                </AppButton>
                <AppButton
                  type="button"
                  variant="quiet"
                  size="md"
                  data-testid="onboarding-intro-back"
                  onClick={() => {
                    setIntroStep("value");
                    trackProductEvent("onboarding_kuji_intro_back_click", {
                      source: getEffectiveEntrySource(),
                    });
                  }}
                >
                  戻る
                </AppButton>
              </>
            )}
            {message ? <p style={styles.message}>{message}</p> : null}
            {isPhotoDebugMode ? (
              <OnboardingPhotoDebugPanel info={photoDebugInfo} />
            ) : null}
          </section>
        ) : null}

        {!shouldShowExternalBrowserGuide && isPhotoReviewSurface ? (
          <section
            style={styles.hero}
            aria-label={
              state === "photo_confirm"
                ? "選んだ写真の確認"
                : "ねこくじを引いています"
            }
            data-testid="onboarding-photo-review"
          >
            <h1 style={styles.title} data-onboarding-title="true">
              {state === "photo_confirm"
                ? "この写真を「うちのこ」に保存しますか？"
                : "ねこくじを引いています"}
            </h1>
            <div
              style={styles.onboardingPhotoReviewFrame}
              data-onboarding-photo-review-frame="true"
            >
              {(draftPhotoPreviewSrc || selectedPhotoSrc) ? (
                <img
                  src={draftPhotoPreviewSrc || selectedPhotoSrc}
                  alt="選んだうちの子の写真"
                  style={styles.onboardingPhotoReviewImage}
                  data-testid="onboarding-photo-review-image"
                />
              ) : null}
              {state === "saving" ? (
                <span
                  style={styles.onboardingPhotoReviewBusy}
                  role="status"
                  aria-live="polite"
                >
                  {savingStage === "saving_photo"
                    ? "「うちのこ」に保存しています…"
                    : "4匹の猫を呼んでいます…"}
                </span>
              ) : null}
            </div>
            {state === "photo_confirm" ? (
              <>
                <p style={styles.onboardingPhotoReviewCopy}>
                  保存すると、ねこくじが始まります。
                  <br />
                  運営が確認したあと、この写真もだれかのねこくじに
                  <br />
                  登場することがあります。
                </p>
                <div style={styles.onboardingPhotoReviewActions}>
                  <AppButton
                    type="button"
                    variant="accent"
                    onClick={() => {
                      void handleConfirmSleepingPhoto();
                    }}
                    fullWidth
                    style={{
                      ...styles.onboardingCta,
                      ...styles.onboardingPrimaryCta,
                    }}
                    data-testid="onboarding-photo-confirm"
                  >
                    保存して、ねこくじへ
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="quiet"
                    size="md"
                    onClick={() => {
                      void handleSelectSleepingPhoto();
                    }}
                    data-testid="onboarding-photo-reselect"
                  >
                    写真を選び直す
                  </AppButton>
                </div>
              </>
            ) : null}
            {message ? <p style={styles.message}>{message}</p> : null}
            {isPhotoDebugMode ? (
              <OnboardingPhotoDebugPanel info={photoDebugInfo} />
            ) : null}
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

        {((hasResolvedDisplayEnvironment &&
          hasResolvedOnboardingProgress &&
          !shouldShowExternalBrowserGuide &&
          isChoiceFirstSurface) ||
          (state === "delivered" &&
            hasOnboardingPhotoChoice &&
            !isDeliveredPhotoKept)) ? (
          <section
            style={{ ...styles.result, ...styles.deliveredResult }}
            aria-labelledby="onboarding-delivered-title"
            aria-hidden={previewDeliveryPhoto ? true : undefined}
            inert={previewDeliveryPhoto ? true : undefined}
            data-testid="onboarding-four-choice"
            data-bundle-id={deliveryBundleId ?? undefined}
          >
            <div style={styles.onboardingFourChoiceLetter}>
              {isPhotoFirstChoice ? (
                <p
                  style={styles.onboardingOwnPhotoSavedStatus}
                  data-testid="onboarding-own-photo-saved"
                >
                  写真を「うちのこ」に保存しました
                </p>
              ) : null}
              <div style={styles.onboardingDeliveredMasthead}>
                <p
                  id="onboarding-delivered-title"
                  style={
                    isChoiceFirstSurface || isPhotoFirstChoice
                      ? styles.onboardingChoiceTitle
                      : styles.onboardingDeliveredTitle
                  }
                >
                  {isChoiceFirstSurface || isPhotoFirstChoice
                    ? "気になるのは、どの子？"
                    : "保存する猫を選んでください"}
                </p>
                <span
                  style={styles.onboardingDeliveredMastheadRule}
                  aria-hidden="true"
                />
              </div>
              {isChoiceFirstSurface ? (
                <p style={styles.onboardingChoiceNote}>
                  受け取るときに、あなたの猫の写真を1枚選びます。
                </p>
              ) : isPhotoFirstChoice ? (
                <p style={styles.onboardingChoiceNote}>
                  気になる子をタップすると、大きく見られます。
                </p>
              ) : null}
              {isChoiceFirstLoading ? (
                <div
                  role="status"
                  aria-label="4匹を準備しています"
                  style={styles.onboardingFourChoiceGrid}
                  data-testid="onboarding-choice-loading-skeleton"
                >
                  {Array.from({ length: 4 }, (_, index) => (
                    <span
                      key={index}
                      aria-hidden="true"
                      style={styles.onboardingFourChoiceSkeletonItem}
                      data-testid="onboarding-choice-loading-skeleton-item"
                    />
                  ))}
                </div>
              ) : (
                <div
                  role="group"
                  aria-label="4匹の猫から選ぶ"
                  style={styles.onboardingFourChoiceGrid}
                >
                  {deliveredPhotos.map((photo, index) => {
                    const isSelected = photo.id === selectedDeliveryPhotoId;
                    const isUnavailable = failedDeliveryPhotoIds.has(photo.id);
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        aria-label={`${index + 1}匹目の猫を大きく見る`}
                        disabled={
                          isUnavailable ||
                          isFinalizingDeliveryChoice ||
                          state === "saving"
                        }
                        data-testid="onboarding-four-choice-option"
                        data-photo-id={photo.id}
                        data-position={index + 1}
                        data-selected={isSelected ? "true" : "false"}
                        data-onboarding-choice-card="true"
                        style={{
                          ...styles.onboardingFourChoiceOption,
                          animationDelay: `${index * 70}ms`,
                          ...(isSelected
                            ? styles.onboardingFourChoiceOptionSelected
                            : {}),
                          ...(isUnavailable
                            ? styles.onboardingFourChoiceOptionUnavailable
                            : {}),
                        }}
                        onClick={() => openDeliveryPhotoPreview(photo, index)}
                      >
                        <StoredPhotoImage
                          src={getExchangePhotoDisplaySrc(photo)}
                          fallbackSrcs={getExchangePhotoFallbackSrcs(photo)}
                          alt=""
                          storageVariant="thumbnail"
                          loading="eager"
                          onError={() => handleDeliveryPhotoError(photo)}
                          style={styles.onboardingFourChoicePhoto}
                        />
                        {isUnavailable ? (
                          <span style={styles.onboardingFourChoiceUnavailableLabel}>
                            読み込めません
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
              {previewDeliveryPhoto ? (
                <CatChoicePreview
                  items={deliveredPhotos.map((photo) => ({
                    id: photo.id,
                    disabled: failedDeliveryPhotoIds.has(photo.id),
                  }))}
                  activeId={previewDeliveryPhoto.id}
                  onActiveChange={(photoId, index) => {
                    const photo = deliveredPhotos[index];
                    if (!photo || photo.id !== photoId) {
                      return;
                    }
                    openDeliveryPhotoPreview(
                      photo,
                      index,
                      "preview_navigation",
                    );
                  }}
                  onBack={() => setPreviewDeliveryPhotoId(null)}
                  onConfirm={confirmDeliveryPhotoPreview}
                  backLabel={isPhotoFirstChoice ? "4匹に戻る" : undefined}
                  renderPhoto={(item, index, variant) => {
                    const photo = deliveredPhotos[index];
                    if (!photo || photo.id !== item.id) {
                      return null;
                    }
                    return (
                      <StoredPhotoImage
                        src={getExchangePhotoDisplaySrc(photo)}
                        fallbackSrcs={getExchangePhotoFallbackSrcs(photo)}
                        alt={`${index + 1}匹目の猫`}
                        storageVariant={
                          variant === "main" ? "display" : "thumbnail"
                        }
                        loading="eager"
                        onError={() => handleDeliveryPhotoError(photo)}
                        style={
                          variant === "main"
                            ? styles.onboardingFourChoicePreviewPhoto
                            : styles.onboardingFourChoicePreviewThumbnail
                        }
                      />
                    );
                  }}
                  heading={
                    isChoiceFirstSurface
                      ? "この子を受け取る？"
                      : isPhotoFirstChoice
                        ? "この子を選びますか？"
                        : undefined
                  }
                  confirmLabel={
                    isChoiceFirstSurface
                      ? "あなたの猫の写真を選ぶ"
                      : isPhotoFirstChoice
                        ? "この子を選ぶ"
                        : "この猫を保存"
                  }
                  confirmBusyLabel={
                    isPhotoFirstChoice ? "選んでいます…" : "受け取っています…"
                  }
                  supportingText={
                    isChoiceFirstSurface
                      ? "相手に届くのは写真だけです"
                      : isPhotoFirstChoice
                        ? "選んだ1匹は、ねてるねこであとから見られます。"
                        : undefined
                  }
                  supportingTextPlacement={
                    isPhotoFirstChoice ? "before" : "after"
                  }
                  confirmStyle={
                    isChoiceFirstSurface
                      ? styles.onboardingPreviewConfirm
                      : undefined
                  }
                  confirmDisabled={
                    isFinalizingDeliveryChoice || state === "saving"
                  }
                  isConfirming={
                    isFinalizingDeliveryChoice || state === "saving"
                  }
                  errorMessage={deliveryChoiceError || message}
                  tone="paper"
                  manageHistory
                  testId="onboarding-four-choice-preview"
                  confirmTestId={
                    isChoiceFirstSurface
                      ? "onboarding-photo-invite"
                      : "onboarding-four-choice-save"
                  }
                />
              ) : null}
              {deliveryChoiceError && !previewDeliveryPhoto ? (
                <p role="alert" style={styles.onboardingFourChoiceError}>
                  {deliveryChoiceError}
                </p>
              ) : null}
              {state === "delivered" ? (
                <AppButton
                  type="button"
                  variant="quiet"
                  size="md"
                  disabled={isFinalizingDeliveryChoice}
                  onClick={() => {
                    void handleSkipOnboardingDeliveryChoice();
                  }}
                  data-testid="onboarding-four-choice-skip"
                >
                  今回は選ばない
                </AppButton>
              ) : null}
            </div>
          </section>
        ) : null}

        {state === "photo_prompt" && selectedDeliveryPhoto ? (
            <section
              style={{ ...styles.result, ...styles.deliveredResult }}
              aria-label={
                message
                  ? "写真を読み込めませんでした"
                  : "選んだ猫を受け取る"
              }
              data-testid="onboarding-photo-prompt"
              data-onboarding-result="true"
          >
            {!message ? (
              <div
                style={styles.onboardingPromptPhotoFrame}
                data-onboarding-prompt-photo="true"
              >
                <StoredPhotoImage
                  src={getExchangePhotoDisplaySrc(selectedDeliveryPhoto)}
                  fallbackSrcs={getExchangePhotoFallbackSrcs(
                    selectedDeliveryPhoto,
                  )}
                  alt=""
                  storageVariant="display"
                  loading="eager"
                  style={styles.onboardingPromptPhoto}
                />
              </div>
            ) : null}
            <h2
              style={styles.subTitle}
              data-onboarding-subtitle="true"
            >
              {message
                ? "写真を読み込めませんでした"
                : "この猫と交換しますか？"}
            </h2>
            {message ? (
              <p role="alert" style={styles.onboardingPromptNote}>
                {message}
              </p>
            ) : (
              <p
                style={styles.onboardingPromptNote}
                data-onboarding-result-copy="true"
              >
                選んだ写真は匿名で交換に使われます。
              </p>
            )}
            <div style={styles.onboardingPromptActions}>
              <AppButton
                type="button"
                variant="accent"
                data-testid="onboarding-photo-invite"
                onClick={() => {
                  void handleSelectSleepingPhoto();
                }}
                fullWidth
                style={styles.onboardingPromptCta}
              >
                {message ? "別の写真を選ぶ" : "写真を選んで交換する"}
              </AppButton>
              <AppButton
                type="button"
                variant="quiet"
                size="md"
                onClick={handleSkipPreviewAndGoHome}
              >
                やめる
              </AppButton>
            </div>
          </section>
        ) : null}

        {state === "delivered" &&
        deliveredPhoto &&
        (!hasOnboardingPhotoChoice || isDeliveredPhotoKept) ? (
          <section
            style={{ ...styles.result, ...styles.deliveredResult }}
            aria-label={
              isPhotoFirstChoiceCompleted
                ? "ねこくじが完了しました"
                : "ねこだより"
            }
            data-onboarding-result={
              isPhotoFirstChoiceCompleted ? "true" : undefined
            }
          >
            {isPhotoFirstChoiceCompleted && selectedPhotoSrc ? (
              <>
                <h2
                  style={styles.subTitle}
                  data-onboarding-subtitle="true"
                  data-testid="onboarding-completion-title"
                >
                  うちの子の1枚を保存しました。
                </h2>
                <div
                  style={styles.onboardingCompletionPhotoFrame}
                  data-onboarding-completion-photo="true"
                  data-testid="onboarding-completion-own-photo"
                >
                  <img
                    src={selectedPhotoSrc}
                    alt="「うちのこ」に保存した写真"
                    style={styles.onboardingCompletionPhoto}
                  />
                </div>
                <p
                  style={styles.onboardingCompletionMeaning}
                  data-onboarding-result-copy="true"
                  data-testid="onboarding-completion-value"
                >
                  いろんな猫に目をとめるたび、
                  <br />
                  うちの子の好きなところや、その子らしさに
                  <br />
                  気づいていけます。
                </p>
                <div
                  style={styles.onboardingCompletionDayori}
                  data-testid="onboarding-completion-dayori"
                >
                  <div style={styles.onboardingCompletionDayoriPhotoFrame}>
                    <StoredPhotoImage
                      src={getDeliveredPhotoDisplaySrc(deliveredPhoto)}
                      fallbackSrcs={getExchangePhotoFallbackSrcs(deliveredPhoto)}
                      alt="ねこくじで選んだ猫"
                      style={styles.onboardingCompletionDayoriPhoto}
                      storageVariant="thumbnail"
                    />
                  </div>
                  <div style={styles.onboardingCompletionDayoriText}>
                    <p style={styles.onboardingCompletionDayoriLabel}>
                      ねこだより
                    </p>
                    <p style={styles.onboardingCompletionDayoriCopy}>
                      ねこくじで選んだ1匹が、この日の「ねこだより」になりました。
                    </p>
                  </div>
                </div>
                <div style={styles.onboardingCompletionActions}>
                  <AppButton
                    type="button"
                    variant="accent"
                    onClick={continueToOwnCatAfterOnboarding}
                    disabled={isContinuing}
                    fullWidth
                    style={{
                      ...styles.onboardingCta,
                      ...styles.onboardingPrimaryCta,
                    }}
                    data-testid="onboarding-delivered-continue"
                  >
                    {isContinuing ? "準備しています…" : "うちのこを見る"}
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="quiet"
                    size="md"
                    onClick={continueToNekodayoriAfterJoining}
                    disabled={isContinuing}
                    data-testid="onboarding-completion-nekodayori"
                  >
                    ねこだよりを見る
                  </AppButton>
                </div>
              </>
            ) : (
              <>
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
                      "「ねこだより」に保存しました"
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
              </>
            )}
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}
        {state === "empty" ? (
          <section
            style={styles.result}
            data-onboarding-result="true"
            aria-label={
              pendingOwnPhoto
                ? "4匹を表示できませんでした"
                : deliveryIssue === "no_candidate"
                  ? "いま選べる猫がいません"
                  : "猫を表示できませんでした"
            }
            data-delivery-issue={deliveryIssue ?? undefined}
          >
            <h2
              style={styles.subTitle}
              data-onboarding-subtitle="true"
            >
              {pendingOwnPhoto
                ? "4匹を表示できませんでした"
                : deliveryIssue === "no_candidate"
                  ? "いま選べる猫がいません"
                  : "猫を表示できませんでした"}
            </h2>
            <p
              style={styles.resultText}
              data-onboarding-result-copy="true"
            >
              {canShowTestTools
                ? deliveryIssue === "temporary_error"
                  ? "候補の確認で止まりました。テスト用に、ここで候補を追加できます。"
                  : "とどく候補がまだありません。テスト用に、ここで候補を追加できます。"
                : pendingOwnPhoto
                  ? "写真は「うちのこ」に保存済みです。"
                  : deliveryIssue === "no_candidate"
                    ? "少し時間をおいて、もう一度お試しください。"
                    : "通信を確認して、もう一度お試しください。"}
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
              style={styles.onboardingPrimaryCta}
            >
              {isRetryingDelivery
                ? "読み込んでいます..."
                : pendingOwnPhoto
                  ? "もう一度試す"
                  : "もう一度読み込む"}
            </AppButton>
            <AppButton type="button" variant="quiet" size="md" onClick={handleGoHome}>
              ホームへ
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "joined" ? (
          <section
            style={styles.result}
            aria-label={
              completedDeliveryPhoto
                ? "交換できました"
                : "写真を保存しました"
            }
            data-testid="onboarding-joined"
            data-onboarding-result="true"
          >
            {completedDeliveryPhoto ? (
              <div
                style={styles.onboardingCompletionPhotoFrame}
                data-onboarding-completion-photo="true"
                data-testid="onboarding-joined-delivered-photo"
                data-photo-id={completedDeliveryPhoto.id}
              >
                <StoredPhotoImage
                  src={getExchangePhotoDisplaySrc(completedDeliveryPhoto)}
                  fallbackSrcs={getExchangePhotoFallbackSrcs(
                    completedDeliveryPhoto,
                  )}
                  alt="選んだ猫"
                  storageVariant="display"
                  loading="eager"
                  style={styles.onboardingCompletionPhoto}
                />
              </div>
            ) : selectedPhotoSrc ? (
              <img
                src={selectedPhotoSrc}
                alt=""
                style={styles.savedPhoto}
              />
            ) : null}
            <h2
              style={styles.subTitle}
              data-onboarding-subtitle="true"
            >
              {completedDeliveryPhoto
                ? "この猫が届きました"
                : "写真を保存しました"}
            </h2>
            {completedDeliveryPhoto ? (
              <p
                style={styles.resultText}
                data-onboarding-result-copy="true"
              >
                「ねこだより」に保存しました
              </p>
            ) : (
              <p
                style={styles.resultText}
                data-onboarding-result-copy="true"
              >
                「うちのこ」に保存しました
              </p>
            )}
            <AppButton
              type="button"
              variant="accent"
              onClick={continueToNekodayoriAfterJoining}
              disabled={isContinuing}
              fullWidth
              style={{
                ...styles.onboardingCta,
                ...styles.onboardingPrimaryCta,
              }}
            >
              {isContinuing ? "準備しています…" : "ねこだよりを見る"}
            </AppButton>
          </section>
        ) : null}

        {state === "kept" ? (
          <section
            style={styles.result}
            aria-label="最初の体験が完了しました"
            data-onboarding-result="true"
          >
            {selectedPhotoSrc ? (
              <div
                style={styles.onboardingCompletionPhotoFrame}
                data-onboarding-completion-photo="true"
                data-testid="onboarding-completion-own-photo"
              >
                <img
                  src={selectedPhotoSrc}
                  alt="「うちのこ」に保存した写真"
                  style={styles.onboardingCompletionPhoto}
                />
              </div>
            ) : null}
            <h2
              style={styles.subTitle}
              data-testid="onboarding-completion-title"
            >
              うちの子の1枚を保存しました。
            </h2>
            <p
              style={styles.onboardingCompletionMeaning}
              data-testid="onboarding-completion-value"
            >
              ねこくじで猫に目をとめることが、
              <br />
              うちの子らしさに気づくきっかけになります。
            </p>
            <AppButton
              type="button"
              variant="accent"
              onClick={continueToOwnCatAfterOnboarding}
              disabled={isContinuing}
              fullWidth
              style={{
                ...styles.onboardingCta,
                ...styles.onboardingPrimaryCta,
              }}
              data-testid="onboarding-delivered-continue"
            >
              {isContinuing ? "準備しています…" : "うちのこを見る"}
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

function ExternalBrowserGuide({
  isPreparing,
  errorMessage,
  onOpenExternalBrowser,
  onContinue,
}: {
  isPreparing: boolean;
  errorMessage: string;
  onOpenExternalBrowser: () => void;
  onContinue: () => void;
}) {
  const catIllustrations = useCatIllustrationAssets();

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
      <h1 style={styles.title}>
        このブラウザで試せます
      </h1>
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
          onClick={onContinue}
          style={{
            ...styles.onboardingCta,
            ...styles.onboardingPrimaryCta,
          }}
        >
          はじめる
        </AppButton>
        <AppButton
          type="button"
          variant="quiet"
          size="md"
          disabled={isPreparing}
          onClick={onOpenExternalBrowser}
        >
          {isPreparing ? "ブラウザ移動を準備しています..." : "Safari／Chromeでひらく"}
        </AppButton>
      </div>
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
    return "写真を選び直してください。";
  }

  if (reason === "file_too_large") {
    return "20MB以下の写真を選んでください。";
  }

  return "JPEGやPNGなどの写真を選んでください。";
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
    paddingTop: "calc(42px + env(safe-area-inset-top))",
    paddingRight: "clamp(18px, 7vw, 28px)",
    paddingBottom: "calc(34px + env(safe-area-inset-bottom))",
    paddingLeft: "clamp(18px, 7vw, 28px)",
    display: "grid",
    alignContent: "safe center",
    boxSizing: "border-box",
  },
  onboardingTopAlignedContainer: {
    alignContent: "start",
    paddingTop: "calc(52px + env(safe-area-inset-top))",
  },
  onboardingTopAlignedContainerWithBrand: {
    paddingTop: "calc(112px + env(safe-area-inset-top))",
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
    maxWidth: "326px",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "13.5px",
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: 0,
  },
  onboardingIntroTitle: {
    margin: "0 0 4px",
    color: "#342e27",
    fontSize: "26px",
    fontWeight: 500,
    lineHeight: 1.42,
    letterSpacing: "0.01em",
  },
  onboardingKujiIntroTitle: {
    fontSize: "24px",
    lineHeight: 1.42,
  },
  onboardingKujiLabel: {
    margin: "0 0 -2px",
    color: "var(--seal)",
    fontFamily: UI_FONT,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
    letterSpacing: "0.14em",
  },
  onboardingValuePhotoStage: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "min(100%, 250px)",
    height: "170px",
    margin: "4px 0 8px",
    transformOrigin: "center",
  },
  onboardingKujiPhotoStackCard: {
    position: "absolute",
    display: "block",
    width: "108px",
    height: "144px",
    padding: "5px 5px 16px",
    overflow: "hidden",
    border: "1px solid rgba(133, 116, 96, 0.2)",
    borderRadius: "14px",
    background: "#fffdf8",
    boxShadow: "0 10px 22px rgba(70, 50, 30, 0.12)",
    boxSizing: "border-box",
  },
  onboardingKujiPhotoStackCardSelected: {
    borderColor: "rgba(166, 83, 73, 0.72)",
    boxShadow:
      "0 0 0 2px rgba(166, 83, 73, 0.10), 0 12px 24px rgba(70, 50, 30, 0.15)",
  },
  onboardingKujiPhotoStackImage: {
    display: "block",
    width: "100%",
    height: "100%",
    borderRadius: "9px",
    objectFit: "cover",
  },
  onboardingKujiPhotoStackCheck: {
    position: "absolute",
    right: "4px",
    bottom: "4px",
    display: "grid",
    placeItems: "center",
    width: "26px",
    height: "26px",
    border: "1.5px solid #fffdf8",
    borderRadius: "50%",
    background: "var(--seal)",
    color: "#fffaf2",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1,
    boxShadow: "0 4px 10px rgba(90, 50, 42, 0.22)",
  },
  onboardingKujiCatCollage: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    width: "min(58vw, 212px)",
    margin: "2px 0 4px",
  },
  onboardingKujiCatCollageCard: {
    display: "block",
    minWidth: 0,
    aspectRatio: "1 / 1",
    padding: "4px",
    overflow: "hidden",
    border: "1px solid rgba(133, 116, 96, 0.18)",
    borderRadius: "15px",
    background: "#fffdf8",
    boxShadow: "0 5px 13px rgba(70, 50, 30, 0.06)",
    boxSizing: "border-box",
    animation:
      "onboardingChoiceReveal 320ms cubic-bezier(0.22, 1, 0.36, 1) backwards",
  },
  onboardingKujiCatCollageImage: {
    display: "block",
    width: "100%",
    height: "100%",
    borderRadius: "11px",
    objectFit: "cover",
  },
  onboardingKujiIntroLead: {
    maxWidth: "300px",
    color: "#51483e",
    fontSize: "15px",
    lineHeight: 1.6,
  },
  onboardingIntroCta: {
    maxWidth: "300px",
    minHeight: "54px",
    marginTop: "6px",
  },
  onboardingPrivacyNote: {
    margin: "-2px 0 0",
    width: "100%",
    maxWidth: "310px",
    color: "#4b4339",
    fontFamily: UI_FONT,
    fontSize: "12.5px",
    fontWeight: 400,
    lineHeight: 1.65,
    letterSpacing: 0,
  },
  onboardingPhotoReviewFrame: {
    position: "relative",
    display: "grid",
    placeItems: "center",
    width: "min(100%, 258px)",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "var(--radius-2xl)",
    background: "var(--paper-warm)",
    boxShadow: "0 8px 22px rgba(90,76,60,0.09)",
  },
  onboardingPhotoReviewImage: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  onboardingPhotoReviewBusy: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    padding: "18px",
    background: "rgba(255, 253, 248, 0.84)",
    color: "var(--ink)",
    fontFamily: UI_FONT,
    fontSize: "13.5px",
    fontWeight: 500,
    lineHeight: 1.6,
    letterSpacing: "0.01em",
  },
  onboardingPhotoReviewCopy: {
    width: "min(100%, 310px)",
    margin: 0,
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: 0,
  },
  onboardingPhotoReviewActions: {
    display: "grid",
    justifyItems: "center",
    gap: "3px",
    width: "min(100%, 280px)",
  },
  onboardingCta: {
    width: "min(100%, 280px)",
    marginTop: "14px",
  },
  onboardingPrimaryCta: {
    border: "1px solid #98493f",
    background: "#a65349",
    color: "#fffaf2",
    boxShadow: "0 9px 20px rgba(112,55,48,0.16)",
  },
  onboardingPromptCta: {
    width: "100%",
    border: "1px solid #98493f",
    background: "#a65349",
    color: "#fffaf2",
    boxShadow: "0 9px 20px rgba(112,55,48,0.16)",
  },
  onboardingPromptActions: {
    width: "min(100%, 280px)",
    display: "grid",
    justifyItems: "center",
    gap: "2px",
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
    gap: "11px",
  },
  onboardingFourChoiceLetter: {
    ...deliveredLetterStyles.sheet,
    width: "min(100%, 406px)",
    maxWidth: "100%",
    minWidth: 0,
    boxSizing: "border-box",
  },
  onboardingFourChoiceGrid: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
    boxSizing: "border-box",
  },
  onboardingOwnPhotoSavedStatus: {
    margin: "0 0 10px",
    color: "var(--ink-soft)",
    fontFamily: UI_FONT,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
    textAlign: "center",
  },
  onboardingChoiceTitle: {
    margin: 0,
    color: "var(--ink)",
    fontFamily: UI_FONT,
    fontSize: "22px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0.01em",
  },
  onboardingChoiceNote: {
    margin: "-2px 0 2px",
    color: "#51483e",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: 0,
    textAlign: "center",
  },
  onboardingFourChoiceSkeletonItem: {
    display: "block",
    minWidth: 0,
    aspectRatio: "1 / 1",
    borderRadius: "18px",
    background:
      "linear-gradient(105deg, rgba(255,253,248,0.52) 24%, rgba(224,211,194,0.44) 42%, rgba(255,253,248,0.52) 60%)",
    backgroundSize: "220% 100%",
    boxShadow: "0 4px 14px rgba(70, 50, 30, 0.05)",
    animation: "onboardingSkeleton 1.4s ease-in-out infinite",
  },
  onboardingFourChoiceOption: {
    position: "relative",
    minWidth: 0,
    aspectRatio: "1 / 1",
    padding: 0,
    overflow: "hidden",
    border: 0,
    borderRadius: "18px",
    background: "var(--paper-warm)",
    boxShadow: "0 4px 14px rgba(70, 50, 30, 0.10)",
    cursor: "pointer",
    transition:
      "border-color 140ms ease, transform 140ms ease, box-shadow 140ms ease",
    animation:
      "onboardingChoiceReveal 360ms cubic-bezier(0.22, 1, 0.36, 1) backwards",
  },
  onboardingFourChoiceOptionSelected: {
    border: "2px solid var(--seal)",
    transform: "translateY(-2px)",
    boxShadow:
      "0 0 0 2px color-mix(in srgb, var(--seal) 18%, transparent), 0 8px 20px rgba(70, 50, 30, 0.18)",
  },
  onboardingFourChoiceOptionUnavailable: {
    opacity: 0.42,
    cursor: "default",
  },
  onboardingFourChoicePhoto: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  onboardingFourChoiceUnavailableLabel: {
    position: "absolute",
    inset: "auto 8px 8px",
    padding: "4px 6px",
    borderRadius: "999px",
    background: "rgba(36, 31, 27, 0.72)",
    color: "#fffaf2",
    fontSize: "11px",
    lineHeight: 1.3,
    textAlign: "center",
  },
  onboardingFourChoicePreviewPhoto: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
    objectPosition: "center top",
    background: "transparent",
  },
  onboardingFourChoicePreviewThumbnail: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
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
  onboardingPreviewConfirm: {
    width: "min(100%, 280px)",
    maxWidth: "280px",
    minHeight: "54px",
    border: "1px solid var(--control-border)",
    background: "color-mix(in srgb, var(--paper-card) 96%, transparent)",
    color: "var(--ink)",
    boxShadow: "var(--shadow-e1)",
  },
  onboardingPromptPhotoFrame: {
    width: "min(40vw, 148px)",
    aspectRatio: "1 / 1",
    overflow: "hidden",
    borderRadius: "var(--radius-xl)",
    background: "var(--paper-warm)",
    boxShadow: "0 6px 16px rgba(90,76,60,0.08)",
  },
  onboardingPromptPhoto: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "cover",
  },
  onboardingPromptNote: {
    width: "min(100%, 286px)",
    margin: 0,
    color: "#6f6757",
    fontFamily: UI_FONT,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: 0,
    textAlign: "center",
  },
  onboardingCompletionPhotoFrame: {
    display: "grid",
    placeItems: "center",
    width: "min(100%, 260px)",
    maxHeight: "260px",
    padding: "5px",
    overflow: "hidden",
    borderRadius: "var(--radius-2xl)",
    background: "rgba(255, 253, 248, 0.74)",
    boxShadow: "0 8px 22px rgba(90,76,60,0.09)",
    boxSizing: "border-box",
  },
  onboardingCompletionPhoto: {
    width: "100%",
    height: "auto",
    maxHeight: "250px",
    display: "block",
    borderRadius: "calc(var(--radius-2xl) - 5px)",
    objectFit: "contain",
  },
  onboardingCompletionMeaning: {
    width: "min(100%, 310px)",
    margin: "-2px 0 0",
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.7,
    letterSpacing: 0,
  },
  onboardingCompletionDayori: {
    display: "grid",
    gridTemplateColumns: "64px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
    width: "min(100%, 310px)",
    padding: "11px",
    border: "1px solid rgba(133, 116, 96, 0.18)",
    borderRadius: "18px",
    background:
      "linear-gradient(145deg, rgba(255,253,248,0.72), rgba(248,241,232,0.58))",
    boxShadow: "0 7px 18px rgba(70, 50, 30, 0.06)",
    boxSizing: "border-box",
    textAlign: "left",
  },
  onboardingCompletionDayoriPhotoFrame: {
    width: "64px",
    height: "64px",
    overflow: "hidden",
    borderRadius: "12px",
    background: "var(--paper-warm)",
  },
  onboardingCompletionDayoriPhoto: {
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  onboardingCompletionDayoriText: {
    display: "grid",
    gap: "3px",
    minWidth: 0,
  },
  onboardingCompletionDayoriLabel: {
    margin: 0,
    color: "var(--seal)",
    fontFamily: UI_FONT,
    fontSize: "10.5px",
    fontWeight: 600,
    lineHeight: 1.4,
    letterSpacing: "0.12em",
  },
  onboardingCompletionDayoriCopy: {
    margin: 0,
    color: "#3f382e",
    fontFamily: UI_FONT,
    fontSize: "12.5px",
    fontWeight: 400,
    lineHeight: 1.6,
    letterSpacing: 0,
  },
  onboardingCompletionActions: {
    display: "grid",
    justifyItems: "center",
    gap: "3px",
    width: "min(100%, 280px)",
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
  onboardingDeliveredContinue: {
    ...deliveredLetterStyles.action,
  },
  savedPhoto: {
    display: "block",
    width: "auto",
    maxWidth: "min(100%, 260px)",
    height: "auto",
    maxHeight: "240px",
    borderRadius: "var(--radius-2xl)",
    boxShadow: "0 8px 22px rgba(90,76,60,0.09)",
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
    lineHeight: 1.7,
    letterSpacing: 0,
  },
} satisfies Record<string, CSSProperties>;

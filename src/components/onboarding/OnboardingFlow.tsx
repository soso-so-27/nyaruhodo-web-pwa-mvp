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
  readOwnSleepingPhotos,
  saveOwnSleepingPhoto,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import {
  getEveningDeliveryCompletionCopy,
  getJstDateKey,
} from "../../lib/home/eveningDelivery";
import {
  createOnboardingSubmissionId,
  getOrCreateOnboardingAnonymousId,
  patchOnboardingProgress,
  readCurrentOnboardingProgress,
  readOnboardingSourceFromLocation,
  writeOnboardingProgress,
  type OnboardingProgress,
  type OnboardingSource,
} from "../../lib/onboarding/progress";
import { consumeOnboardingTestResetRequest } from "../../lib/onboarding/testReset";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { resizeImageFileToDataUrl } from "../../lib/imageResize";
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
  | "second_photo_prompt"
  | "empty"
  | "kept";

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

type OnboardingInstallPlatform = "ios" | "android";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice?: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";
const ONBOARDING_SECOND_PHOTO_INTENT_KEY =
  "neteruneko_onboarding_second_photo_intent";
const ONBOARDING_INSTALL_GUIDE_DISMISSED_KEY =
  "neteruneko_onboarding_install_guide_dismissed";
const ONBOARDING_PHOTO_DEBUG_STORAGE_KEY = "neteruneko_onboarding_photo_debug";
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
  const [hasCopiedExternalBrowserUrl, setHasCopiedExternalBrowserUrl] =
    useState(false);
  const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(false);
  const [installPlatform, setInstallPlatform] =
    useState<OnboardingInstallPlatform | null>(null);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallGuideDismissed, setIsInstallGuideDismissed] = useState(false);
  const [isOpeningEnvelope, setIsOpeningEnvelope] = useState(false);
  const [catNameDraft, setCatNameDraft] = useState("");
  const prefersReducedMotion = usePrefersReducedMotion();
  const autoKeptDeliveredPhotoIdRef = useRef("");
  const hasTrackedIntroViewRef = useRef(false);
  const hasTrackedEmbeddedBrowserRef = useRef(false);
  const hasResolvedProgressRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const isOpeningEnvelopeRef = useRef(false);
  const revealTimerRef = useRef<number | null>(null);
  const revealStartedAtRef = useRef<number | null>(null);
  const revealPhotoLoadedTrackedRef = useRef("");
  const revealPhotoErrorTrackedRef = useRef("");
  const catNamePromptTrackedPhotoRef = useRef("");
  const entrySourceRef = useRef<OnboardingSource>(entrySource);
  const secondPhotoPromptTrackedRef = useRef(false);
  const installGuideTrackedRef = useRef(false);
  const canShowTestTools = isTestMode && !IS_PRODUCTION;
  const shouldShowSecondPhotoPrompt =
    state === "second_photo_prompt" &&
    Boolean(deliveredPhoto) &&
    isDeliveredPhotoKept &&
    isBeforeJstHour(20);
  const shouldShowInstallGuide =
    state === "delivered" &&
    Boolean(deliveredPhoto) &&
    isDeliveredPhotoKept &&
    Boolean(installPlatform) &&
    !isEmbeddedBrowser &&
    !isInstallGuideDismissed;

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
    const enabled = readOnboardingPhotoDebugEnabled();

    setIsPhotoDebugMode(enabled);
    setIsEmbeddedBrowser(isEmbeddedInAppBrowser());
    setIsInstallGuideDismissed(readOnboardingInstallGuideDismissed());
    if (!isStandaloneDisplay() && !isEmbeddedInAppBrowser()) {
      setInstallPlatform(getOnboardingInstallPlatform());
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      if (!isStandaloneDisplay() && !isEmbeddedInAppBrowser()) {
        setInstallPlatform("android");
      }
    };
    const handleAppInstalled = () => {
      trackProductEvent("pwa_install_guide_completed", {
        source: getEffectiveEntrySource(),
        surface: "onboarding",
        method: "installed",
      });
      dismissOnboardingInstallGuide();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
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

    const didReset = consumeOnboardingTestResetRequest();
    const source = readOnboardingSourceFromLocation();
    setEntrySource(source);
    entrySourceRef.current = source;
    hasResolvedProgressRef.current = true;
    if (didReset) {
      setSelectedPhotoSrc("");
      setDeliveredPhoto(null);
      setPendingOwnPhoto(null);
      setIsDeliveredPhotoKept(false);
      setCompletionCopy("");
      setState("intro");
      setMessage("テスト用に、この端末のオンボーディング状態をリセットしました。");
    }
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
    markDeliveredPhotoReadyForOnboarding();
  }, [state, deliveredPhoto, isDeliveredPhotoKept]);

  useEffect(() => {
    if (!shouldShowSecondPhotoPrompt || secondPhotoPromptTrackedRef.current) {
      return;
    }

    secondPhotoPromptTrackedRef.current = true;
    trackProductEvent("onboarding_second_photo_prompt_view", {
      source: getEffectiveEntrySource(),
    });
  }, [shouldShowSecondPhotoPrompt]);

  useEffect(() => {
    if (!shouldShowInstallGuide || installGuideTrackedRef.current) {
      return;
    }

    installGuideTrackedRef.current = true;
    trackProductEvent("pwa_install_prompt_view", {
      source: getEffectiveEntrySource(),
      surface: "onboarding",
      platform: installPlatform,
      can_prompt: Boolean(installPrompt),
    });
  }, [installPlatform, installPrompt, shouldShowInstallGuide]);

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

  async function handleCopyOnboardingUrl() {
    if (typeof window === "undefined") {
      return;
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setHasCopiedExternalBrowserUrl(true);
      trackProductEvent("onboarding_external_browser_url_copied", {
        source: getEffectiveEntrySource(),
      });
    } catch {
      setHasCopiedExternalBrowserUrl(false);
    }
  }

  function handleContinueInEmbeddedBrowser() {
    setIsExternalBrowserGuideDismissed(true);
    trackProductEvent("onboarding_embedded_browser_continue", {
      source: getEffectiveEntrySource(),
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
        if (isPhotoDebugMode) {
          setPhotoDebugInfo(
            createOnboardingPhotoDebugInfo(
              "rejected",
              file,
              file
                ? "unsupported_type_or_size"
                : "missing_file_from_browser_input",
            ),
          );
        }
        setMessage("写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください。");
        cleanupInput();
        return;
      }

      setState("saving");
      isSubmittingRef.current = true;
      setMessage("");
      if (isPhotoDebugMode) {
        setPhotoDebugInfo(createOnboardingPhotoDebugInfo("selected", file));
      } else {
        setPhotoDebugInfo(null);
      }

      let savedResult: Awaited<ReturnType<typeof saveSleepingPhotoWithFallback>> | null = null;
      let catId = "";

      try {
        const profiles = readCatProfiles();
        const activeProfile = getActiveCatProfile(profiles, readActiveCatId());
        catId = activeProfile.id;

        saveActiveCatId(catId);
        savedResult = await saveSleepingPhotoWithFallback(file, catId);

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
          setState("intro");
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
            ? "写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください。"
            : "写真を保存できませんでした。少し時間をおいて、もう一度試してください。",
        );
        setState("intro");
        return;
      }

      if (!savedResult) {
        return;
      }

      try {
        const { dataUrl, ownPhoto } = savedResult;
        setSelectedPhotoSrc(dataUrl);
        setPendingOwnPhoto(ownPhoto);
        setIsDeliveredPhotoKept(false);
        autoKeptDeliveredPhotoIdRef.current = "";
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
          isExchangeTarget: true,
          source: "onboarding",
          delivery_date_key: onboardingDateKey,
        });
        trackProductEvent("onboarding_photo_submitted", {
          catId,
          source: getEffectiveEntrySource(),
          submission_id: submissionId,
          delivery_date_key: onboardingDateKey,
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
        setMessage(
          canShowTestTools
            ? "ねがおは入りました。とどく候補の準備で止まりました。テスト用に候補を追加できます。"
            : "ねがおは入りました。とどくねがおの準備に時間がかかっています。少し時間をおいて、もう一度お試しください。",
        );
        setState("empty");
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
    continueAfterOnboardingLetter();
  }

  function continueAfterOnboardingLetter() {
    if (isBeforeJstHour(20) && deliveredPhoto && isDeliveredPhotoKept) {
      setState("second_photo_prompt");
      return;
    }

    continueToAccountCreate();
  }

  function continueToAccountCreate() {
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

    continueAfterOnboardingLetter();
  }

  function handleStartSecondPhoto() {
    if (!isDeliveredPhotoKept) {
      return;
    }

    markOnboardingAlbumCompletionReady();
    try {
      window.sessionStorage.setItem(ONBOARDING_SECOND_PHOTO_INTENT_KEY, "true");
    } catch {
      // Intent tracking should never block the next step.
    }
    trackProductEvent("onboarding_second_photo_submitted", {
      source: getEffectiveEntrySource(),
      surface: "onboarding_delivered",
      requires_handoff: isEmbeddedBrowser,
    });

    if (isEmbeddedBrowser) {
      router.push(
        `/account/create?from=onboarding&source=${encodeURIComponent(
          getEffectiveEntrySource(),
        )}&next=second_photo`,
      );
      return;
    }

    router.push("/home?from=onboarding_second_photo");
  }

  async function handleOnboardingInstallPrimary() {
    if (installPlatform === "android" && installPrompt) {
      const prompt = installPrompt;
      setInstallPrompt(null);
      await prompt.prompt();
      const choice = await prompt.userChoice?.catch(() => null);
      trackProductEvent("pwa_install_guide_completed", {
        source: getEffectiveEntrySource(),
        surface: "onboarding",
        method: choice?.outcome === "accepted" ? "accepted" : "dismissed",
      });
      if (choice?.outcome === "accepted") {
        dismissOnboardingInstallGuide();
      }
      return;
    }

    trackProductEvent("pwa_install_guide_completed", {
      source: getEffectiveEntrySource(),
      surface: "onboarding",
      method: "guide_read",
      platform: installPlatform,
    });
    dismissOnboardingInstallGuide();
  }

  function dismissOnboardingInstallGuide() {
    setIsInstallGuideDismissed(true);
    setInstallPrompt(null);
    try {
      window.localStorage.setItem(ONBOARDING_INSTALL_GUIDE_DISMISSED_KEY, "true");
    } catch {
      // Install guide should never block onboarding completion.
    }
  }

  function markDeliveredPhotoReadyForOnboarding() {
    if (!deliveredPhoto) {
      return;
    }

    trackProductEvent("onboarding_delivered_photo_confirmed", {
      source: getEffectiveEntrySource(),
      source_photo_id: deliveredPhoto.sourcePhotoId ?? null,
      saved_to_album: false,
      test_mode: canShowTestTools,
    });

    setIsDeliveredPhotoKept(true);
    patchOnboardingProgress({
      stage: "opened",
      source: getEffectiveEntrySource(),
      deliveredPhoto,
      isDeliveredPhotoKept: true,
      completionCopy: getEveningDeliveryCompletionCopy(),
    });

    if (!isTestMode) {
      window.localStorage.setItem(STORAGE_KEYS.onboardingCompleted, "true");
      setCompletionCopy(getEveningDeliveryCompletionCopy());
      trackProductEvent("onboarding_completed", {
        source: getEffectiveEntrySource(),
        method: "delivery_confirmed",
        photo_id: deliveredPhoto.id,
        delivery_photo_id: deliveredPhoto.id,
      });
    }
  }

  function handleDeliveredPhotoDataUrl(dataUrl: string) {
    if (!deliveredPhoto || !dataUrl.startsWith("data:image/")) {
      return;
    }

    const progress = readCurrentOnboardingProgress();
    const photoWithDataUrl = {
      ...deliveredPhoto,
      src: dataUrl,
      thumbnailSrc: dataUrl,
      displaySrc: dataUrl,
      originalSrc: dataUrl,
    };

    setDeliveredPhoto(photoWithDataUrl);
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

    if (IS_PRODUCTION && (!nextPhoto || !isUsablePhotoSrc(nextPhoto.src))) {
      trackProductEvent("onboarding_delivery_blocked", {
        source: getEffectiveEntrySource(),
        reason: nextPhoto ? "unusable_photo_src" : "no_delivery_photo",
        http_status: exchangeResult?.httpStatus ?? null,
        exchange_error: exchangeResult?.error ?? null,
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

  const shouldShowExternalBrowserGuide =
    state === "intro" &&
    isEmbeddedBrowser &&
    !isExternalBrowserGuideDismissed;

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

        {shouldShowExternalBrowserGuide ? (
          <ExternalBrowserGuide
            source={entrySource}
            copied={hasCopiedExternalBrowserUrl}
            onCopy={() => {
              void handleCopyOnboardingUrl();
            }}
            onContinue={handleContinueInEmbeddedBrowser}
          />
        ) : null}

        {!shouldShowExternalBrowserGuide && (state === "intro" || state === "saving") ? (
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
              自分のねこの寝顔を1枚入れると、
              <br />
              どこかのねこの寝顔が1通届きます。
              <br />
              <br />
              外には出ません。
              <br />
              届く前に、すべて確認しています。
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
            <p style={styles.ctaFootnote}>無料・ひとりで作っています</p>
            {message ? <p style={styles.message}>{message}</p> : null}
            {isPhotoDebugMode ? (
              <OnboardingPhotoDebugPanel info={photoDebugInfo} />
            ) : null}
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
                      ホームでねがおをとると、
                      <br />
                      よる8時にまた届きます。
                    </>
                  )
                : "届いた写真を、ねこだよりに入れています。"}
            </p>
            {!isBeforeJstHour(20) && isDeliveredPhotoKept ? (
              <p style={styles.resultText}>
                あしたの よる8時に、つぎの一通がとどきます。
              </p>
            ) : null}
            {shouldShowInstallGuide && installPlatform ? (
              <OnboardingInstallGuide
                platform={installPlatform}
                canPrompt={Boolean(installPrompt)}
                onPrimary={() => {
                  void handleOnboardingInstallPrimary();
                }}
                onDismiss={dismissOnboardingInstallGuide}
              />
            ) : null}
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
              data-testid="onboarding-delivered-continue"
            >
              {isDeliveredPhotoKept ? "つづける" : "ねこだよりに入れています..."}
            </AppButton>
            {message ? <p style={styles.message}>{message}</p> : null}
          </section>
        ) : null}

        {state === "second_photo_prompt" ? (
          <section style={styles.result} aria-label="きょうのもう一通">
            <p style={styles.kicker}>きょうのつづき</p>
            <h2 style={styles.subTitle}>
              よる8時に、
              <br />
              もう一通とどきます
            </h2>
            <p style={styles.resultText}>
              もう一枚だけ、ねがおをいれておくと
              <br />
              きょうのねこだよりになります。
            </p>
            <AppButton
              type="button"
              onClick={handleStartSecondPhoto}
              disabled={!isDeliveredPhotoKept}
              fullWidth
              style={styles.onboardingCta}
              data-testid="onboarding-second-photo-primary"
            >
              もう一枚いれておく
            </AppButton>
            <AppButton
              type="button"
              variant="quiet"
              size="md"
              onClick={continueToAccountCreate}
              data-testid="onboarding-second-photo-skip"
            >
              今日はここまで
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

function OnboardingInstallGuide({
  platform,
  canPrompt,
  onPrimary,
  onDismiss,
}: {
  platform: OnboardingInstallPlatform;
  canPrompt: boolean;
  onPrimary: () => void;
  onDismiss: () => void;
}) {
  const steps =
    platform === "ios"
      ? ["共有ボタンをひらく", "ホーム画面に追加をえらぶ", "追加をおす"]
      : canPrompt
        ? ["このボタンから、ホーム画面に追加できます。"]
        : ["Chromeのメニューをひらく", "アプリをインストール、またはホーム画面に追加をえらぶ"];
  const primaryLabel = platform === "android" && canPrompt ? "ホーム画面に追加する" : "わかった";

  return (
    <section
      style={styles.installGuide}
      aria-label="ホーム画面に追加する案内"
      data-testid="onboarding-install-guide"
    >
      <p style={styles.installGuideTitle}>
        とどく場所を、さきに作っておきましょう
      </p>
      <p style={styles.installGuideText}>
        ホーム画面に置いておくと、あしたからの一通をすぐ見られます。
      </p>
      <ol style={styles.installGuideList}>
        {steps.map((step) => (
          <li key={step} style={styles.installGuideItem}>
            {step}
          </li>
        ))}
      </ol>
      <div style={styles.installGuideActions}>
        <AppButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={onPrimary}
        >
          {primaryLabel}
        </AppButton>
        <AppButton type="button" variant="quiet" size="sm" onClick={onDismiss}>
          あとで
        </AppButton>
      </div>
    </section>
  );
}

function ExternalBrowserGuide({
  source,
  copied,
  onCopy,
  onContinue,
}: {
  source: OnboardingSource;
  copied: boolean;
  onCopy: () => void;
  onContinue: () => void;
}) {
  const kicker = source === "referral" ? "紹介リンク" : "アプリ内ブラウザ";

  return (
    <section style={styles.externalBrowserGuide} aria-label="ブラウザで開く案内">
      <div style={styles.externalBrowserArt} aria-hidden="true">
        <img
          src="/illustrations/sleeping-cat-empty.webp"
          alt=""
          style={styles.externalBrowserCat}
        />
        <OnboardingEnvelopeArt compact />
      </div>
      <p style={styles.kicker}>{kicker}</p>
      <h1 style={styles.title}>
        SafariやChromeで
        <br />
        開くと安心です
      </h1>
      <p style={styles.externalBrowserText}>
        LINEやInstagramの中で始めると、ホーム画面アプリにしたあと、
        写真を引き継ぐ手順が必要になります。
      </p>
      <p style={styles.externalBrowserText}>
        先にSafariやChromeで開くと、そのままホーム画面アプリへ残せます。
      </p>
      <div style={styles.externalBrowserActions}>
        <AppButton
          type="button"
          variant="accent"
          fullWidth
          onClick={onCopy}
          style={styles.onboardingCta}
        >
          {copied ? "URLをコピーしました" : "URLをコピー"}
        </AppButton>
        <AppButton type="button" variant="quiet" size="md" onClick={onContinue}>
          このまま進む
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

function isBeforeJstHour(hour: number) {
  const currentHour = Number(
    new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Asia/Tokyo",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "hour")?.value,
  );

  return Number.isFinite(currentHour) && currentHour < hour;
}

function isEmbeddedInAppBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent.toLowerCase();

  return (
    ua.includes(" line/") ||
    ua.includes("instagram") ||
    ua.includes("fbav") ||
    ua.includes("fban") ||
    ua.includes("twitter") ||
    ua.includes("micromessenger")
  );
}

function isStandaloneDisplay() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    window.matchMedia?.("(display-mode: fullscreen)").matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

function getOnboardingInstallPlatform(): OnboardingInstallPlatform | null {
  if (typeof window === "undefined") {
    return null;
  }

  const ua = window.navigator.userAgent;

  if (/iPad|iPhone|iPod/i.test(ua)) {
    return "ios";
  }

  if (/Android/i.test(ua)) {
    return "android";
  }

  return null;
}

function readOnboardingInstallGuideDismissed() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(ONBOARDING_INSTALL_GUIDE_DISMISSED_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
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

async function saveSleepingPhotoWithFallback(file: File, catId: string) {
  const createdAt = Date.now();
  const fileName = `onboarding-${createdAt}`;
  const exchangeDataUrl = await createOnboardingExchangeDataUrl(file);
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
    const ownPhoto = saveOwnSleepingPhoto({
      catId,
      src: attempt.src,
      thumbnailSrc: attempt.thumbnailSrc,
      displaySrc: attempt.displaySrc,
      originalSrc: canUseStorage ? storedDisplaySrc : undefined,
      triggerLabel: "ねがお",
      theme: "sleeping",
      shared: true,
      captureContext: "onboarding",
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
  preferredDataUrl?: string,
) {
  if (preferredDataUrl && preferredDataUrl.length <= 1_900_000) {
    return preferredDataUrl;
  }

  let lastUsableDataUrl: string | null = null;

  for (const attempt of [
    { maxSize: 1200, quality: 0.8 },
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
    captureContext: "onboarding",
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
  externalBrowserGuide: {
    display: "grid",
    justifyItems: "center",
    textAlign: "center",
    gap: "12px",
    width: "100%",
    padding: "22px 18px 24px",
    boxSizing: "border-box",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "24px",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.86), rgba(250,244,235,0.72))",
    boxShadow: "0 18px 42px -34px rgba(82, 61, 43, 0.48)",
  },
  externalBrowserArt: {
    position: "relative",
    width: "min(62vw, 214px)",
    height: "122px",
    display: "grid",
    placeItems: "center",
    margin: "-2px 0 4px",
  },
  externalBrowserCat: {
    position: "absolute",
    zIndex: 2,
    top: "-4px",
    left: "50%",
    width: "72px",
    height: "72px",
    objectFit: "contain",
    transform: "translateX(-50%)",
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
  externalBrowserActions: {
    display: "grid",
    justifyItems: "center",
    gap: "8px",
    width: "100%",
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
  installGuide: {
    width: "min(100%, 286px)",
    display: "grid",
    gap: "8px",
    margin: "4px 0 0",
    padding: "13px 14px",
    boxSizing: "border-box",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "18px",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.72), rgba(250,244,235,0.56))",
    boxShadow: "0 12px 28px -26px rgba(82,61,43,0.32)",
    textAlign: "left",
  },
  installGuideTitle: {
    margin: 0,
    color: "#4c4238",
    fontFamily: UI_FONT,
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.55,
    letterSpacing: 0,
  },
  installGuideText: {
    margin: 0,
    color: "#746a5f",
    fontFamily: UI_FONT,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.75,
    letterSpacing: 0,
  },
  installGuideList: {
    display: "grid",
    gap: "4px",
    margin: "0 0 2px",
    padding: "0 0 0 18px",
    color: "#746a5f",
    fontFamily: UI_FONT,
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.65,
    letterSpacing: 0,
  },
  installGuideItem: {
    paddingLeft: "2px",
  },
  installGuideActions: {
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
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
  ctaFootnote: {
    margin: "-6px 0 0",
    color: "#8a8175",
    fontFamily: UI_FONT,
    fontSize: "11px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: 0,
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
    fontWeight: 600,
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
    fontWeight: 600,
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

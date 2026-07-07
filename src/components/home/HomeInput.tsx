"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode, TouchEvent } from "react";
import {
  getAccountSyncOverview,
  restoreCatGalleryPhotosFromAccount,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { getOrCreateAnonymousId } from "../../lib/identity/anonymousId";
import { purgeAllPhotoSwCache } from "../../lib/photoSwCache";
import { resizeImageFileToDataUrl } from "../../lib/imageResize";
import {
  acknowledgeCatGalleryIntro,
  CAT_GALLERY_PHOTO_LIMIT,
  hasAcknowledgedCatGalleryIntro,
  readCatGalleryPhotos,
  saveCatGalleryPhoto,
} from "../../lib/cats/catGalleryPhotos";
import { writeAuthDebugEvent } from "../../lib/authDebug";
import {
  storeAccountPhotoDataUrl,
} from "../../lib/photoStorageClient";
import {
  getCollectionSlotPhotoSlug,
  getDailyCollectionTarget,
  isReservedCollectionSlotSlug,
  readStoredCollectionPhotos,
} from "../../lib/collection/dailyTarget";
import {
  COLLECTION_GROUPS,
  type CollectionSlot,
} from "../../lib/collection/poses";
import {
  buildMikkeWindowResult,
  getCurrentMikkeWindow,
  getMikkeWindowOption,
  getMikkeWindowOptions,
  MIKKE_WINDOW_QUESTIONS,
  readStoredMikkeWindowAnswer,
  saveStoredMikkeWindowAnswer,
  type MikkeWindowCategory,
  type MikkeWindow,
  type MikkeWindowCount,
  type MikkeWindowOption,
  type MikkeWindowResult,
  type StoredMikkeWindowAnswer,
} from "../../lib/home/mikkeWindows";
import {
  fetchMikkeWindowCounts,
  submitMikkeWindowAnswer,
} from "../../lib/home/mikkeWindowResults";
import {
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  buildEveningHomeState,
  getJstDateKey,
  isTodaySleepingCounterVisible,
  markEveningDeliveryKept,
  readEveningDeliveryStore,
  recordEveningDeliveryTarget,
  setEveningDeliveredPhoto,
  shouldShowGuidanceCopy,
  updateEveningDeliveredPhotoDataUrl,
  type EveningHomeState,
} from "../../lib/home/eveningDelivery";
import {
  ensureOmoideMemoryArrival,
} from "../../lib/home/omoideDelivery";
import { useEveningDelivery } from "../../lib/home/useEveningDelivery";
import {
  BOX_PHOTO_STORAGE_EVENT,
  dismissExchangePhoto,
  keepExchangePhoto,
  readKeptExchangePhotoCount,
  readOwnSleepingPhotos,
  readOwnSleepingPhotoCount,
  reportExchangePhoto,
  saveOwnSleepingPhoto,
  updateKeptExchangePhotoDataUrl,
  writeOwnSleepingPhotosWithFallback,
  type ExchangePhoto,
  type ExchangePhotoReportReason,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import { backupOwnSleepingPhotoMoment } from "../../lib/home/sleepingPhotoBackup";
import {
  STORAGE_KEYS,
  getDiscoveryLogKey,
  getLockDataKey,
  getRecordLogKey,
  readCachedJson,
  writeCachedJson,
} from "../../lib/storage";
import type { RecentEvent } from "../../lib/supabase/queries";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import { BottomNavigation } from "../navigation/BottomNavigation";
import { HomeDeskModel } from "./HomeDeskModel";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
} from "./homeInputHelpers";
import type { CatProfile } from "./homeInputHelpers";
import { AppBottomSheet, AppSheet } from "../ui/AppBottomSheet";
import {
  AppIcon,
  type AppIconName,
} from "../ui/AppIcons";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import {
  getStoragePhotoSignedUrl,
  StoredPhotoImage,
} from "../ui/StoredPhotoImage";

type HomeInputProps = {
  recentEvents: RecentEvent[];
  initialNow: number;
};

type DeliveredPhotoDecodeStatus = "idle" | "loading" | "ready" | "failed";
type DeliveredPhotoDecodeEntry = {
  status: DeliveredPhotoDecodeStatus;
  promise: Promise<DeliveredPhotoDecodeStatus>;
};

const DELIVERED_PHOTO_DECODE_WAIT_MS = 1500;

type LockData = {
  yousuLockedUntil?: number;
  mugiLockedUntil?: number;
  sleepingCounterLockedUntil?: number;
  mikkeCategoryLockedUntil?: Partial<Record<MikkeWindowCategory, number>>;
};

type LockType = "yousu" | "mugi";

const MIKKE_CATEGORIES: MikkeWindowCategory[] = ["place", "pose", "sign"];
const MIKKE_LOCK_MS = 60 * 60 * 1000;
const PRESENCE_SESSION_STORAGE_KEY = "neteruneko_presence_count";

const PHOTO_SAVE_FAILURE_MESSAGE =
  "写真を保存できませんでした。少し時間をおいて、もう一度試してください";
const PHOTO_INPUT_FAILURE_MESSAGE =
  "写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください";
const CAMERA_INPUT_STALE_CLEANUP_MS = 10 * 60 * 1000;

const MAX_UPLOAD_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_SOURCE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type RecordLogItem = {
  id: string;
  type: "yousu" | "mugi" | "reaction";
  value: string;
  timestamp: number;
  metadata?: {
    mikkeWindowId?: string;
    mikkeQuestionId?: string;
    mikkeCategory?: string;
    mikkeAnswerId?: string;
    homeCounterId?: string;
  };
};

type HomeBoardAction =
  | "open_mikke"
  | "open_photo"
  | "open_collection_photo"
  | "open_discovery"
  | "open_recent_change"
  | "go_torisetu"
  | "go_collection"
  | "add_sleeping";

type HomeBoardItem = {
  id: string;
  kind: "mission" | "notice" | "insight" | "tip" | "collection" | "account";
  priority: number;
  title: string;
  body: string;
  icon: "paw" | "sleep" | "hand" | "heart" | "bell" | "camera" | "book";
  actionLabel: string;
  actionType: HomeBoardAction;
  isUnread?: boolean;
  isDisabled?: boolean;
  surfaceText?: string;
  cooldownProgress?: number;
};

type HomeBoardCompletion = {
  itemId: string;
  title: string;
  surfaceText: string;
};

type HomeBoardTransitionSource = {
  itemId: string;
  rect: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  title: string;
  surfaceText: string;
  icon: HomeBoardItem["icon"];
};

type HomeBoardActionHandler = (
  actionType: HomeBoardAction,
  source?: HomeBoardTransitionSource,
) => void;

type PersonalityInsight = {
  title: string;
  body: string;
  surfaceText: string;
  sheetBody: string;
};

const YOUSU_OPTIONS = [
  "ねてる",
  "毛づくろい",
  "遊んでる",
  "ごはん",
  "トイレ",
  "ゴロゴロ",
  "ついてくる",
  "鳴いてる",
  "落ち着かない",
  "窓の外",
  "ふみふみ",
  "その他",
];

const HOME_NAV_FRAME_WIDTH = "min(calc(100% - 28px), 410px)";
const HOME_NAV_EDGE_INSET = "max(14px, calc((100vw - 410px) / 2))";
const HOME_STARTUP_HOLD_MIN_MS = 280;
let hasShownHomeStartupHold = false;

type BoardShelfStat = {
  icon: AppIconName;
  label: string;
  value: string;
  unit: string;
  detail: string;
};

type HomeCatCounter = {
  id: "sleeping" | "window" | "loaf";
  label: string;
  count: number;
};

type PendingExchangeSharePhoto = {
  src: string;
  exchangeSrc: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  triggerLabel: string;
  theme: string;
  fileSizeBucket: string;
};

type SleepingPhotoSource = "camera";

const SLEEPING_SAFETY_ACCEPTED_STORAGE_KEY =
  "nyaruhodo_sleeping_safety_accepted";
const HOME_INSTALL_HINT_DISMISSED_STORAGE_KEY =
  "neteruneko_home_install_hint_dismissed";
const HOME_TODAY_CAT_SELECTION_STORAGE_KEY =
  "neteruneko_home_today_cat_selection";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type HomeInstallPlatform = "ios" | "android";

export function HomeInput({
  recentEvents: _recentEvents,
  initialNow,
}: HomeInputProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CatProfile | null>(null);
  const [hasHydratedHomeState, setHasHydratedHomeState] = useState(false);
  const [isStartupHoldReleased, setIsStartupHoldReleased] = useState(
    () => hasShownHomeStartupHold,
  );
  const [lockData, setLockData] = useState<LockData>({});
  const [tick, setTick] = useState(initialNow);
  const isHomeClockReady = tick > 0;
  const homeNow = isHomeClockReady ? tick : 0;
  const [isYousuOpen, setIsYousuOpen] = useState(false);
  const [isCollectionPhotoSheetOpen, setIsCollectionPhotoSheetOpen] =
    useState(false);
  const [isCollectionPhotoAdding, setIsCollectionPhotoAdding] = useState(false);
  const [isAccountRestoreSheetOpen, setIsAccountRestoreSheetOpen] =
    useState(false);
  const [isAccountRestoring, setIsAccountRestoring] = useState(false);
  const [accountRestoreSummary, setAccountRestoreSummary] = useState<{
    remoteCats: number;
    remoteRecords: number;
    remoteCatGalleryPhotos: number;
    remoteCollectionPhotos: number;
    remoteOwnSleepingPhotos: number;
    remoteKeptExchangePhotos: number;
  } | null>(null);
  const [isDiscoverySheetOpen, setIsDiscoverySheetOpen] = useState(false);
  const [isRecentChangeSheetOpen, setIsRecentChangeSheetOpen] = useState(false);
  const [isCatGalleryIntroSheetOpen, setIsCatGalleryIntroSheetOpen] =
    useState(false);
  const [selectedYousu, setSelectedYousu] = useState<string | null>(null);
  const [recordLog, setRecordLog] = useState<RecordLogItem[]>([]);
  const [mikkeRefreshTick, setMikkeRefreshTick] = useState(0);
  const [mikkeResult, setMikkeResult] = useState<MikkeWindowResult | null>(null);
  const [isMikkeResultLoading, setIsMikkeResultLoading] = useState(false);
  const [toastText, setToastText] = useState("");
  const [boardCompletion, setBoardCompletion] =
    useState<HomeBoardCompletion | null>(null);
  const [boardSheetSource, setBoardSheetSource] =
    useState<HomeBoardTransitionSource | null>(null);
  const [boardSheetReturn, setBoardSheetReturn] =
    useState<HomeBoardCompletion | null>(null);
  const [isBoardSheetReturning, setIsBoardSheetReturning] = useState(false);
  const [deliveredExchangePhoto, setDeliveredExchangePhoto] =
    useState<ExchangePhoto | null>(null);
  const [openingEveningDelivery, setOpeningEveningDelivery] =
    useState<Extract<EveningHomeState, { kind: "delivered" }> | null>(null);
  const [deliveredPhotoDecodeStatus, setDeliveredPhotoDecodeStatus] =
    useState<DeliveredPhotoDecodeStatus>("idle");
  const [pendingExchangeSharePhoto, setPendingExchangeSharePhoto] =
    useState<PendingExchangeSharePhoto | null>(null);
  const [pendingExchangeCatId, setPendingExchangeCatId] = useState<string | null>(
    null,
  );
  const [isExchangePhotoAdding, setIsExchangePhotoAdding] = useState(false);
  const [hasAcceptedSleepingSafety, setHasAcceptedSleepingSafety] =
    useState(false);
  const [isSleepingSafetySheetOpen, setIsSleepingSafetySheetOpen] =
    useState(false);
  const [isSleepingSafetyChecked, setIsSleepingSafetyChecked] = useState(false);
  const [pendingSleepingPhotoSource, setPendingSleepingPhotoSource] =
    useState<SleepingPhotoSource>("camera");
  const [homeInstallPlatform, setHomeInstallPlatform] =
    useState<HomeInstallPlatform | null>(null);
  const [homeInstallPrompt, setHomeInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isHomeInstallHintVisible, setIsHomeInstallHintVisible] = useState(false);
  const [isHomeInstallGuideOpen, setIsHomeInstallGuideOpen] = useState(false);
  const [collectionRefreshTick, setCollectionRefreshTick] = useState(0);
  const [eveningRefreshTick, setEveningRefreshTick] = useState(0);
  const [discoveryDismissedToday, setDiscoveryDismissedToday] = useState(false);
  const hasTrackedHomeView = useRef(false);
  const hasTrackedGoogleAuthSuccess = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const completedBoardTimerRef = useRef<number | null>(null);
  const boardSheetReturnTimerRef = useRef<number | null>(null);
  const deliveredPhotoDecodeCacheRef = useRef(
    new Map<string, DeliveredPhotoDecodeEntry>(),
  );
  const openingEveningDeliveryRequestRef = useRef<string | null>(null);

  useEffect(() => {
    let releaseTimerId: number | null = null;
    const profiles = readCatProfiles();
    const activeId = readActiveCatId();
    const active = getActiveCatProfile(profiles, activeId);

    setCatProfiles(profiles);
    setActiveCatId(active.id);
    setActiveCat(active);
    saveActiveCatId(active.id);
    hydrateCatState(active.id);
    setHasAcceptedSleepingSafety(hasAcceptedSleepingSafetyNotice());
    setHasHydratedHomeState(true);

    if (hasShownHomeStartupHold) {
      setIsStartupHoldReleased(true);
      return undefined;
    }

    releaseTimerId = window.setTimeout(() => {
      hasShownHomeStartupHold = true;
      setIsStartupHoldReleased(true);
    }, HOME_STARTUP_HOLD_MIN_MS);

    return () => {
      if (releaseTimerId !== null) {
        window.clearTimeout(releaseTimerId);
      }
    };
  }, []);

  useEffect(() => {
    let timeoutId: number | null = null;

    function refreshTick() {
      setTick(Date.now());
    }

    function scheduleNextTick() {
      const now = Date.now();
      const intervalMs = shouldUseHighResolutionHomeClock(now) ? 1000 : 30000;
      const delay = intervalMs - (now % intervalMs);
      timeoutId = window.setTimeout(() => {
        refreshTick();
        scheduleNextTick();
      }, delay || intervalMs);
    }

    refreshTick();
    scheduleNextTick();

    window.addEventListener("focus", refreshTick);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshTick();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("focus", refreshTick);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function refreshEveningDeliveryState() {
      setEveningRefreshTick((value) => value + 1);
    }

    window.addEventListener("neteruneko_evening_delivery_updated", refreshEveningDeliveryState);
    window.addEventListener("storage", refreshEveningDeliveryState);

    return () => {
      window.removeEventListener(
        "neteruneko_evening_delivery_updated",
        refreshEveningDeliveryState,
      );
      window.removeEventListener("storage", refreshEveningDeliveryState);
    };
  }, []);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      void requestDeliveryNotificationPermission();
      dismissHomeInstallHint();
      return;
    }

    if (isInAppBrowser()) {
      dismissHomeInstallHint();
      return;
    }

    if (
      window.localStorage.getItem(HOME_INSTALL_HINT_DISMISSED_STORAGE_KEY) ===
        "true" ||
      window.localStorage.getItem(STORAGE_KEYS.onboardingCompleted) !== "true"
    ) {
      return;
    }

    const platform = getHomeInstallPlatform();
    if (!platform) {
      return;
    }

    setHomeInstallPlatform(platform);
    setIsHomeInstallHintVisible(true);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setHomeInstallPrompt(event as BeforeInstallPromptEvent);
      if (getHomeInstallPlatform() === "android" && !isStandaloneDisplay()) {
        setHomeInstallPlatform("android");
        setIsHomeInstallHintVisible(
          window.localStorage.getItem(HOME_INSTALL_HINT_DISMISSED_STORAGE_KEY) !==
            "true",
        );
      }
    };
    const handleAppInstalled = () => {
      void requestDeliveryNotificationPermission();
      dismissHomeInstallHint();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty("--home-bg-image", "none");
    body.style.setProperty("--home-bg-image", "none");
    body.style.removeProperty("background-image");
    body.style.removeProperty("background-position");
    body.style.removeProperty("background-size");
    body.style.removeProperty("background-repeat");

    return () => {
      root.style.removeProperty("--home-bg-image");
      body.style.removeProperty("--home-bg-image");
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      if (completedBoardTimerRef.current) {
        window.clearTimeout(completedBoardTimerRef.current);
      }
      if (boardSheetReturnTimerRef.current) {
        window.clearTimeout(boardSheetReturnTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldOpenMikke = params.get("mikke") === "1";
    const authStatus = params.get("auth");
    const authCode = params.get("code");
    const hasPendingGoogleAuth = Boolean(
      window.localStorage.getItem(STORAGE_KEYS.authGooglePending),
    );

    async function handleUrlState() {
      let shouldTrackGoogleAuth =
        authStatus === "google_success" || hasPendingGoogleAuth;

      if (authCode) {
        const supabase = createBrowserSupabaseClient();

        if (!supabase) {
          writeAuthDebugEvent("home_auth_missing_supabase_client", {
            hasCode: true,
            hasPendingGoogleAuth,
          });
          trackProductEvent("auth_google_failed", {
            error_type: "missing_supabase_client",
          });
          window.location.replace("/account/create?error=auth");
          return;
        }

        writeAuthDebugEvent("home_auth_code_exchange_started", {
          hasPendingGoogleAuth,
          origin: window.location.origin,
          path: window.location.pathname,
        });
        purgeAllPhotoSwCache("account_switch");
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);

        params.delete("code");
        params.delete("error");
        params.delete("error_code");
        params.delete("error_description");

        if (error) {
          window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
          writeAuthDebugEvent("home_auth_code_exchange_failed", {
            message: error.message,
          });
          trackProductEvent("auth_google_failed", {
            error_type: "code_exchange_failed",
            error_message: error.message,
          });
          window.location.replace("/account/create?error=auth");
          return;
        }

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        writeAuthDebugEvent("home_auth_code_exchange_succeeded", {
          hasSession: Boolean(sessionData.session),
          hasSessionUser: Boolean(sessionData.session?.user),
          sessionError: sessionError?.message ?? null,
        });
        shouldTrackGoogleAuth = true;
      }

      if (shouldTrackGoogleAuth) {
        await trackGoogleAuthSuccess(
          authStatus === "google_success" || authCode
            ? "callback_marker"
            : "pending_marker",
        );
        params.delete("auth");
      }

      if (shouldOpenMikke) {
        setIsYousuOpen(true);
        params.delete("mikke");
      }

      if (
        !shouldOpenMikke &&
        authStatus !== "google_success" &&
        !authCode &&
        !hasPendingGoogleAuth
      ) {
        return;
      }

      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
      window.history.replaceState(null, "", nextUrl);
    }

    void handleUrlState();
  }, []);

  async function trackGoogleAuthSuccess(trigger: "callback_marker" | "pending_marker") {
    if (hasTrackedGoogleAuthSuccess.current) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const localCatId = readActiveCatId();

    if (!supabase) {
      return;
    }

    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;

    if (!userId) {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      writeAuthDebugEvent("home_auth_success_without_user", {
        trigger,
        hasSession: Boolean(sessionData.session),
        hasSessionUser: Boolean(sessionData.session?.user),
        sessionError: sessionError?.message ?? null,
      });
      return;
    }

    hasTrackedGoogleAuthSuccess.current = true;
    window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
    writeAuthDebugEvent("home_auth_user_confirmed", {
      trigger,
      userId,
      email: data.user?.email ?? null,
    });
    trackProductEvent(
      "auth_google_succeeded",
      {
        route_after: "/home",
        trigger,
      },
      {
        localCatId,
        userId,
      },
    );

    const syncResult = await syncLocalDataWithAccount({
      restoreIfLocalEmpty: true,
    });
    const catGalleryLocalBefore = readCatGalleryPhotos(null).length;

    trackProductEvent(
      "cat_gallery_restore_started",
      {
        route: "/home",
        local_count: catGalleryLocalBefore,
        has_session: true,
      },
      {
        localCatId,
        userId,
      },
    );

    const catGalleryRestoreResult = await restoreCatGalleryPhotosFromAccount();
    const catGalleryRestoreEvent =
      catGalleryRestoreResult.status === "restored"
        ? "cat_gallery_restore_completed"
        : catGalleryRestoreResult.status === "empty"
          ? "cat_gallery_remote_empty"
          : catGalleryRestoreResult.status === "error"
            ? "cat_gallery_restore_failed"
            : "cat_gallery_local_merged";

    trackProductEvent(
      catGalleryRestoreEvent,
      {
        route: "/home",
        local_count: catGalleryRestoreResult.localBefore,
        remote_count: catGalleryRestoreResult.remoteCount,
        restored_count: catGalleryRestoreResult.restoredCount,
        merged_count: Math.max(
          0,
          catGalleryRestoreResult.localAfter - catGalleryRestoreResult.localBefore,
        ),
        has_session: catGalleryRestoreResult.hasSession,
        error_count: catGalleryRestoreResult.errors.length,
      },
      {
        localCatId,
        userId,
      },
    );

    trackProductEvent(
      "account_data_sync_completed",
      {
        status: syncResult.status,
        pushed_cats: syncResult.pushedCats,
        pushed_records: syncResult.pushedRecords,
        pushed_cat_gallery_photos: syncResult.pushedCatGalleryPhotos,
        pushed_collection_photos: syncResult.pushedCollectionPhotos,
        pushed_own_sleeping_photos: syncResult.pushedOwnSleepingPhotos,
        pushed_kept_exchange_photos: syncResult.pushedKeptExchangePhotos,
        restored_cats: syncResult.restoredCats,
        restored_records: syncResult.restoredRecords,
        restored_cat_gallery_photos:
          syncResult.restoredCatGalleryPhotos +
          catGalleryRestoreResult.restoredCount,
        restored_collection_photos: syncResult.restoredCollectionPhotos,
        restored_own_sleeping_photos: syncResult.restoredOwnSleepingPhotos,
        restored_kept_exchange_photos: syncResult.restoredKeptExchangePhotos,
        error_count:
          syncResult.errors.length + catGalleryRestoreResult.errors.length,
      },
      {
        localCatId,
        userId,
      },
    );

    if (
      syncResult.status === "synced" ||
      (syncResult.status === "restored" &&
        (syncResult.restoredCats > 0 ||
          syncResult.restoredCatGalleryPhotos > 0 ||
          syncResult.restoredCollectionPhotos > 0 ||
          syncResult.restoredOwnSleepingPhotos > 0 ||
          syncResult.restoredKeptExchangePhotos > 0)) ||
      catGalleryRestoreResult.restoredCount > 0
    ) {
      refreshHomeFromLocalStorage();
    }
  }

  const activeCatName = activeCat ? getCatName(activeCat) : "ねこ";
  const homeDateKey = isHomeClockReady ? getJstDateKey(homeNow) : "";
  const allOwnSleepingPhotos = useMemo(
    () => readOwnSleepingPhotos(null),
    [collectionRefreshTick, eveningRefreshTick],
  );
  const homeDisplayCat = useMemo(
    () =>
      selectTodayHomeCat({
        profiles: catProfiles,
        activeCatId,
        photos: allOwnSleepingPhotos,
        dateKey: homeDateKey,
      }),
    [activeCatId, allOwnSleepingPhotos, catProfiles, homeDateKey],
  );
  const homeDisplayCatId = homeDisplayCat?.id ?? activeCatId;
  const homeCatName = homeDisplayCat ? getCatName(homeDisplayCat) : activeCatName;
  const catName = activeCatName;
  const mikkeCategoryRemaining = getMikkeCategoryRemainingMap(lockData, tick);
  const mikkeAllRemaining = getAllMikkeCategoriesLockedRemaining(lockData, tick);
  const mikkeWindowKey = Math.floor(tick / (60 * 60 * 1000));
  const mikkeWindow = useMemo(
    () => getCurrentMikkeWindow(tick),
    [mikkeWindowKey],
  );
  const mikkeAnswer = useMemo(
    () =>
      activeCatId
        ? readStoredMikkeWindowAnswer(activeCatId, mikkeWindow.id)
        : null,
    [activeCatId, mikkeRefreshTick, mikkeWindow.id],
  );
  const mikkeSelectedOption = mikkeAnswer
    ? getMikkeWindowOption(mikkeWindow.question, mikkeAnswer.answerId)
    : null;
  const mikkeWindowRemaining = mikkeAnswer
    ? formatRemainingMs(mikkeWindow.endsAt - tick)
    : null;
  const sleepingCounterRemaining = null;
  const sleepingCounterCooldownProgress = null;
  const ownSleepingPhotosForHome = useMemo(
    () =>
      homeDisplayCatId
        ? allOwnSleepingPhotos
            .filter((photo) => (photo.ownerCatId ?? photo.catId) === homeDisplayCatId)
            .slice(0, 24)
        : readOwnSleepingPhotos(null),
    [allOwnSleepingPhotos, homeDisplayCatId],
  );
  const ownSleepingPhotosForDelivery = allOwnSleepingPhotos;
  const eveningDelivery = useEveningDelivery({
    activeCatId,
    ownSleepingPhotos: ownSleepingPhotosForDelivery,
  });
  const eveningDeliveryRefreshTick =
    eveningRefreshTick + eveningDelivery.refreshToken;
  const eveningHomeState = useMemo(
    () =>
      buildEveningHomeState({
        activeCatId: null,
        ownPhotos: allOwnSleepingPhotos,
        now: homeNow,
      }),
    [allOwnSleepingPhotos, eveningDeliveryRefreshTick, homeNow],
  );
  const deliveredHomePhoto =
    eveningHomeState.kind === "delivered"
      ? eveningHomeState.deliveredPhoto
      : null;
  const deliveredHomePhotoDecodeKey = deliveredHomePhoto
    ? getDeliveredPhotoDecodeKey(deliveredHomePhoto)
    : null;
  useEffect(() => {
    if (!deliveredHomePhoto || !deliveredHomePhotoDecodeKey) {
      setDeliveredPhotoDecodeStatus("idle");
      return;
    }

    let isActive = true;
    const entry = getOrStartDeliveredPhotoDecode(
      deliveredPhotoDecodeCacheRef.current,
      deliveredHomePhoto,
    );
    setDeliveredPhotoDecodeStatus(entry.status);
    entry.promise.then((status) => {
      if (isActive) {
        setDeliveredPhotoDecodeStatus(status);
      }
    });

    return () => {
      isActive = false;
    };
  }, [deliveredHomePhoto, deliveredHomePhotoDecodeKey]);
  useEffect(() => {
    if (!isHomeClockReady || !activeCatId || !activeCat) {
      return;
    }

    ensureOmoideMemoryArrival({
      catId: activeCatId,
      catName,
      familySinceDate: activeCat.basicInfo?.familySinceDate,
      ownPhotos: ownSleepingPhotosForHome,
      now: homeNow,
    });
  }, [
    activeCat,
    activeCatId,
    catName,
    homeNow,
    isHomeClockReady,
    ownSleepingPhotosForHome,
  ]);
  const keptExchangePhotoCount = useMemo(
    () => readKeptExchangePhotoCount(),
    [collectionRefreshTick, eveningDeliveryRefreshTick],
  );
  const homeCatCounters = useMemo(
    () =>
      buildHomeCatCounters({
        mikkeWindow,
        mikkeAnswer,
        mikkeResult,
        recordLog,
      }),
    [mikkeAnswer, mikkeResult, mikkeWindow, recordLog],
  );
  const latestRecord = recordLog[0] ?? null;
  const mikkeCategoryLastLabels = useMemo(
    () => buildMikkeCategoryLastLabels(recordLog),
    [recordLog],
  );
  const personalityInsight = useMemo(
    () => buildPersonalityInsight(recordLog, catName),
    [catName, recordLog],
  );
  const mikkeAllCooldownProgress = getAllMikkeCategoriesCooldownProgress(
    lockData,
    tick,
  );
  const activeCollectionPhotos = useMemo<Record<string, string[]>>(
    () => (activeCatId ? readStoredCollectionPhotos(activeCatId) : {}),
    [activeCatId, collectionRefreshTick],
  );
  const collectionPhotoCount = useMemo(
    () =>
      Object.values(activeCollectionPhotos).reduce(
        (total, photos) => total + photos.length,
        0,
      ),
    [activeCollectionPhotos],
  );
  const dailyCollectionTarget = useMemo(() => {
    return getDailyCollectionTarget(
      activeCatId ?? "cat",
      activeCollectionPhotos,
    );
  }, [activeCatId, activeCollectionPhotos]);
  const discovery = useMemo(() => {
    if (!activeCatId || discoveryDismissedToday) {
      return { available: false };
    }

    return getDiscoveryState(activeCatId);
  }, [activeCatId, discoveryDismissedToday, tick]);
  const boardItems = useMemo(
    () =>
      buildHomeBoardItems({
        catName,
        discoveryAvailable: discovery.available,
        hasHomePhoto: Boolean(activeCat?.homePhotoDataUrl),
        recordLog,
        collectionTargetLabel: dailyCollectionTarget?.label ?? null,
        mikkeWindow,
        mikkeAnswer,
        homeCatCounters,
        mikkeRemaining: mikkeAllRemaining,
        mikkeCooldownProgress: mikkeAllCooldownProgress,
        sleepingCounterRemaining,
        sleepingCounterCooldownProgress,
      }),
    [
      activeCat?.homePhotoDataUrl,
      catName,
      discovery.available,
      dailyCollectionTarget?.label,
      homeCatCounters,
      mikkeAnswer,
      mikkeWindow,
      recordLog,
      mikkeAllCooldownProgress,
      mikkeAllRemaining,
      sleepingCounterCooldownProgress,
      sleepingCounterRemaining,
    ],
  );

  useEffect(() => {
    let isCancelled = false;

    if (!mikkeAnswer) {
      setMikkeResult(null);
      setIsMikkeResultLoading(false);
      return;
    }

    async function loadMikkeResult() {
      setIsMikkeResultLoading(true);
      const counts = await fetchMikkeWindowCounts(mikkeWindow);

      if (isCancelled) {
        return;
      }

      setMikkeResult(
        buildMikkeWindowResult(
          mikkeWindow.question,
          addLocalAnswerCount(counts, mikkeAnswer),
          mikkeWindow.id,
        ),
      );
      setIsMikkeResultLoading(false);
    }

    void loadMikkeResult();

    return () => {
      isCancelled = true;
    };
  }, [mikkeAnswer, mikkeWindow]);

  useEffect(() => {
    if (hasTrackedHomeView.current || !activeCatId || !activeCat) {
      return;
    }
    hasTrackedHomeView.current = true;
    trackProductEvent(
      "home_viewed",
      {
        cat_count: catProfiles.length,
        has_active_cat: true,
        has_home_photo: Boolean(activeCat.homePhotoDataUrl),
        record_count: recordLog.length,
        own_sleeping_photo_count: readOwnSleepingPhotoCount(activeCatId),
        kept_exchange_photo_count: readKeptExchangePhotoCount(),
        delivery_remaining: sleepingCounterRemaining ?? null,
      },
      { localCatId: activeCatId },
    );
    trackProductEvent(
      "home_view",
      {
        cat_count: catProfiles.length,
        has_active_cat: true,
        has_home_photo: Boolean(activeCat.homePhotoDataUrl),
        record_count: recordLog.length,
        own_sleeping_photo_count: readOwnSleepingPhotoCount(activeCatId),
        kept_exchange_photo_count: readKeptExchangePhotoCount(),
        delivery_remaining: sleepingCounterRemaining ?? null,
      },
      { localCatId: activeCatId },
    );
  }, [
    activeCat,
    activeCatId,
    catProfiles.length,
    recordLog.length,
    sleepingCounterRemaining,
  ]);

  useEffect(() => {
    if (!pendingExchangeSharePhoto || !activeCatId) {
      return;
    }

    trackProductEvent(
      "home_exchange_share_sheet_viewed",
      {
        theme: pendingExchangeSharePhoto.theme,
        trigger_label: pendingExchangeSharePhoto.triggerLabel,
        delivery_available: !sleepingCounterRemaining,
        delivery_remaining: sleepingCounterRemaining ?? null,
      },
      { localCatId: activeCatId },
    );
  }, [activeCatId, pendingExchangeSharePhoto, sleepingCounterRemaining]);

  useEffect(() => {
    if (!activeCatId || isAccountRestoreDismissed()) {
      return;
    }

    let isCancelled = false;

    async function checkAccountRestoreSuggestion() {
      const overview = await getAccountSyncOverview();

      if (isCancelled || !overview.shouldSuggestRestore) {
        return;
      }

      setAccountRestoreSummary({
        remoteCats: overview.remoteCats,
        remoteRecords: overview.remoteRecords,
        remoteCatGalleryPhotos: overview.remoteCatGalleryPhotos,
        remoteCollectionPhotos: overview.remoteCollectionPhotos,
        remoteOwnSleepingPhotos: overview.remoteOwnSleepingPhotos,
        remoteKeptExchangePhotos: overview.remoteKeptExchangePhotos,
      });
      setIsAccountRestoreSheetOpen(true);
      trackProductEvent(
        "account_restore_prompt_viewed",
        {
          local_cats: overview.localCats,
          remote_cats: overview.remoteCats,
          remote_records: overview.remoteRecords,
          remote_cat_gallery_photos: overview.remoteCatGalleryPhotos,
          remote_collection_photos: overview.remoteCollectionPhotos,
          remote_own_sleeping_photos: overview.remoteOwnSleepingPhotos,
          remote_kept_exchange_photos: overview.remoteKeptExchangePhotos,
        },
        { localCatId: activeCatId },
      );
    }

    void checkAccountRestoreSuggestion();

    return () => {
      isCancelled = true;
    };
  }, [activeCatId]);

  function hydrateCatState(catId: string) {
    setLockData(readLockData(catId));
    setDiscoveryDismissedToday(hasSeenDiscoveryToday(catId));

    const records = readRecordLog(catId);
    const latestYousu = records.find((record) => record.type === "yousu");

    setRecordLog(records);
    setSelectedYousu(latestYousu?.value ?? null);
  }

  function refreshHomeFromLocalStorage() {
    const profiles = readCatProfiles();
    const activeId = readActiveCatId();
    const active = getActiveCatProfile(profiles, activeId);

    setCatProfiles(profiles);
    setActiveCatId(active.id);
    setActiveCat(active);
    saveActiveCatId(active.id);
    hydrateCatState(active.id);
    setCollectionRefreshTick((value) => value + 1);
  }

  function showToast(message: string) {
    setToastText(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastText("");
      toastTimerRef.current = null;
    }, 1500);
  }

  function showBoardCompletion(
    itemId: string,
    title: string,
    surfaceText: string,
  ) {
    setBoardCompletion({ itemId, title, surfaceText });

    if (completedBoardTimerRef.current) {
      window.clearTimeout(completedBoardTimerRef.current);
    }

    completedBoardTimerRef.current = window.setTimeout(() => {
      setBoardCompletion(null);
      completedBoardTimerRef.current = null;
    }, 1600);
  }

  function openBoardInput(
    setOpen: (value: boolean) => void,
    source?: HomeBoardTransitionSource,
  ) {
    if (boardSheetReturnTimerRef.current) {
      window.clearTimeout(boardSheetReturnTimerRef.current);
      boardSheetReturnTimerRef.current = null;
    }

    setBoardSheetSource(source ?? null);
    setBoardSheetReturn(null);
    setIsBoardSheetReturning(false);
    setOpen(true);
  }

  function resetBoardInputMotion() {
    setBoardSheetSource(null);
    setBoardSheetReturn(null);
    setIsBoardSheetReturning(false);
  }

  function closeBoardInput(
    setOpen: (value: boolean) => void,
    completion?: HomeBoardCompletion,
  ) {
    if (completion) {
      showBoardCompletion(
        completion.itemId,
        completion.title,
        completion.surfaceText,
      );
      setBoardSheetReturn(completion);
    } else {
      setBoardSheetReturn(null);
    }

    if (!boardSheetSource) {
      setOpen(false);
      resetBoardInputMotion();
      return;
    }

    setIsBoardSheetReturning(true);

    if (boardSheetReturnTimerRef.current) {
      window.clearTimeout(boardSheetReturnTimerRef.current);
    }

    boardSheetReturnTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      resetBoardInputMotion();
      boardSheetReturnTimerRef.current = null;
    }, 380);
  }

  function dismissAccountRestorePrompt() {
    trackProductEvent(
      "account_restore_prompt_dismissed",
      {
        remote_cats: accountRestoreSummary?.remoteCats ?? null,
        remote_records: accountRestoreSummary?.remoteRecords ?? null,
        remote_cat_gallery_photos:
          accountRestoreSummary?.remoteCatGalleryPhotos ?? null,
        remote_collection_photos:
          accountRestoreSummary?.remoteCollectionPhotos ?? null,
        remote_own_sleeping_photos:
          accountRestoreSummary?.remoteOwnSleepingPhotos ?? null,
        remote_kept_exchange_photos:
          accountRestoreSummary?.remoteKeptExchangePhotos ?? null,
      },
      { localCatId: activeCatId },
    );
    window.localStorage.setItem(
      STORAGE_KEYS.accountRestorePromptDismissed,
      String(Date.now()),
    );
    setIsAccountRestoreSheetOpen(false);
  }

  async function handleAccountRestoreFromSheet() {
    trackProductEvent(
      "account_restore_prompt_restore_clicked",
      {
        remote_cats: accountRestoreSummary?.remoteCats ?? null,
        remote_records: accountRestoreSummary?.remoteRecords ?? null,
        remote_cat_gallery_photos:
          accountRestoreSummary?.remoteCatGalleryPhotos ?? null,
        remote_collection_photos:
          accountRestoreSummary?.remoteCollectionPhotos ?? null,
        remote_own_sleeping_photos:
          accountRestoreSummary?.remoteOwnSleepingPhotos ?? null,
        remote_kept_exchange_photos:
          accountRestoreSummary?.remoteKeptExchangePhotos ?? null,
      },
      { localCatId: activeCatId },
    );
    setIsAccountRestoring(true);

    const result = await syncLocalDataWithAccount({
      forceRestore: true,
      restoreIfLocalEmpty: true,
    });

    setIsAccountRestoring(false);
    trackProductEvent(
      "account_restore_prompt_restore_completed",
      {
        status: result.status,
        restored_cats: result.restoredCats,
        restored_records: result.restoredRecords,
        restored_cat_gallery_photos: result.restoredCatGalleryPhotos,
        restored_collection_photos: result.restoredCollectionPhotos,
        restored_own_sleeping_photos: result.restoredOwnSleepingPhotos,
        restored_kept_exchange_photos: result.restoredKeptExchangePhotos,
        error_count: result.errors.length,
      },
      { localCatId: activeCatId },
    );

    if (
      result.status === "restored" &&
      (result.restoredCats > 0 ||
        result.restoredCatGalleryPhotos > 0 ||
        result.restoredCollectionPhotos > 0 ||
        result.restoredOwnSleepingPhotos > 0 ||
        result.restoredKeptExchangePhotos > 0)
    ) {
      refreshHomeFromLocalStorage();
      window.localStorage.setItem(
        STORAGE_KEYS.accountRestorePromptDismissed,
        String(Date.now()),
      );
      setIsAccountRestoreSheetOpen(false);
      showToast("復元しました");
      return;
    }

    if (result.status === "error") {
      showToast("復元できませんでした");
      return;
    }

    setIsAccountRestoreSheetOpen(false);
    showToast("復元できるデータはありません");
  }

  async function recordMikkeWindowAnswer(
    option: MikkeWindowOption,
  ) {
    if (!activeCatId || mikkeAnswer) return;

    const answer: StoredMikkeWindowAnswer = {
      windowId: mikkeWindow.id,
      questionId: mikkeWindow.question.id,
      category: mikkeWindow.question.category,
      answerId: option.id,
      answerLabel: option.label,
      answeredAt: Date.now(),
    };

    saveStoredMikkeWindowAnswer(activeCatId, answer);
    saveRecord(activeCatId, {
      type: "yousu",
      value: option.label,
      metadata: {
        mikkeWindowId: mikkeWindow.id,
        mikkeQuestionId: mikkeWindow.question.id,
        mikkeCategory: mikkeWindow.question.category,
        mikkeAnswerId: option.id,
      },
    });
    trackProductEvent(
      "home_mikke_recorded",
      {
        value: option.label,
        answer_id: option.id,
        question_id: mikkeWindow.question.id,
        category: mikkeWindow.question.category,
        window_id: mikkeWindow.id,
        window_remaining_before: mikkeWindow.endsAt - Date.now(),
      },
      { localCatId: activeCatId },
    );
    setSelectedYousu(option.label);
    setRecordLog(readRecordLog(activeCatId));
    setMikkeRefreshTick((value) => value + 1);

    try {
      await submitMikkeWindowAnswer({
        window: mikkeWindow,
        option,
        localCatId: activeCatId,
      });
    } catch {
      // Local input should still feel instant if aggregation is temporarily unavailable.
    }

    const counts = await fetchMikkeWindowCounts(mikkeWindow);
    setMikkeResult(
      buildMikkeWindowResult(
        mikkeWindow.question,
        addLocalAnswerCount(counts, answer),
        mikkeWindow.id,
      ),
    );
  }

  function recordMikkeFreeAnswer(
    question: (typeof MIKKE_WINDOW_QUESTIONS)[number],
    option: MikkeWindowOption,
  ) {
    if (
      !activeCatId ||
      isMikkeCategoryLocked(lockData, question.category, Date.now())
    ) {
      return;
    }

    const lockRemainingBefore = getMikkeCategoryRemainingTime(
      lockData,
      question.category,
      Date.now(),
    );
    const nextLockData = setMikkeCategoryLock(activeCatId, question.category);

    saveRecord(activeCatId, {
      type: "yousu",
      value: option.label,
      metadata: {
        mikkeQuestionId: question.id,
        mikkeCategory: question.category,
        mikkeAnswerId: option.id,
      },
    });
    trackProductEvent(
      "home_mikke_recorded",
      {
        value: option.label,
        answer_id: option.id,
        question_id: question.id,
        category: question.category,
        entry: "free_mikke",
        lock_remaining_before: lockRemainingBefore,
      },
      { localCatId: activeCatId },
    );
    setSelectedYousu(option.label);
    setRecordLog(readRecordLog(activeCatId));
    setLockData(nextLockData);
    closeBoardInput(setIsYousuOpen, {
      itemId: "today-mikke",
      title: option.label,
      surfaceText: "写真",
    });
  }

  async function handleHomePhotoSelect() {
    if (!activeCatId) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const dataUrl = await resizeAndEncode(file, 1600);
        const photoSrc = await storeAccountPhotoDataUrl({
          dataUrl,
          pathSegments: [activeCatId, "home"],
          fileName: "home",
        });
        const profiles = readCatProfiles();
        const nextProfiles = profiles.map((profile) =>
          profile.id === activeCatId
            ? {
                ...profile,
                homePhotoDataUrl: photoSrc,
                homePhotoPosition: profile.homePhotoPosition ?? "center 38%",
                updatedAt: new Date().toISOString(),
              }
            : profile,
        );
        const nextActive = getActiveCatProfile(nextProfiles, activeCatId);

        saveCatProfiles(nextProfiles);
        setCatProfiles(nextProfiles);
        setActiveCat(nextActive);
        trackProductEvent(
          "home_photo_added",
          {
            source: "gallery",
            file_size_bucket: getFileSizeBucket(file.size),
          },
          { localCatId: activeCatId },
        );
        showToast("写真を残したよ");
      } catch {
        showToast(PHOTO_SAVE_FAILURE_MESSAGE);
      }
    };

    input.click();
  }

  function requestCatGalleryPhotoAdd() {
    if (!activeCatId) return;

    if (!hasAcknowledgedCatGalleryIntro()) {
      setIsCatGalleryIntroSheetOpen(true);
      return;
    }

    void startCatGalleryPhotoAdd();
  }

  async function startCatGalleryPhotoAdd() {
    if (!activeCatId) return;

    const targetCatId = activeCatId;
    if (readCatGalleryPhotos(targetCatId).length >= CAT_GALLERY_PHOTO_LIMIT) {
      showToast(
        "保存できる枚数に達しています。残したい写真を整理してから追加してください。",
      );
      return;
    }

    trackProductEvent(
      "cat_gallery_add_entry_click",
      {
        route: "/home",
        source: "home_sub_cta",
        cat_id: targetCatId,
      },
      { localCatId: targetCatId },
    );

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const [dataUrl, thumbnailDataUrl] = await Promise.all([
          resizeAndEncode(file, 2560, 0.88),
          resizeAndEncode(file, 512, 0.72, "image/webp"),
        ]);
        const photoSrc = await storeAccountPhotoDataUrl({
          dataUrl,
          pathSegments: [targetCatId, "photos"],
          fileName: `photo-${Date.now()}`,
        });
        const thumbnailSrc = await storeAccountPhotoDataUrl({
          dataUrl: thumbnailDataUrl,
          pathSegments: [targetCatId, "photos"],
          fileName: `photo-${Date.now()}-thumb`,
        });

        if (!isStoragePhotoReference(photoSrc)) {
          showToast(PHOTO_SAVE_FAILURE_MESSAGE);
          return;
        }

        const savedPhoto = saveCatGalleryPhoto({
          catId: targetCatId,
          src: photoSrc,
          thumbnailSrc: isStoragePhotoReference(thumbnailSrc)
            ? thumbnailSrc
            : null,
        });

        if (!savedPhoto) {
          showToast(PHOTO_SAVE_FAILURE_MESSAGE);
          return;
        }

        trackProductEvent(
          "cat_gallery_photo_added",
          {
            route: "/home",
            source: "home_sub_cta",
            cat_id: targetCatId,
          },
          { localCatId: targetCatId },
        );
        showToast("この子の写真に追加しました");
      } catch {
        showToast(PHOTO_SAVE_FAILURE_MESSAGE);
      }
    };

    input.click();
  }

  function handleCatGalleryIntroContinue() {
    acknowledgeCatGalleryIntro();
    setIsCatGalleryIntroSheetOpen(false);
    void startCatGalleryPhotoAdd();
  }

  async function handleCollectionPhotoAdd(slot: CollectionSlot) {
    if (!activeCatId || isCollectionPhotoAdding) return;

    trackProductEvent(
      "collection_photo_add_started",
      {
        slot_id: slot.id,
        slot_slug: getCollectionSlotPhotoSlug(slot),
        group_id: slot.group,
        entry: "home_board",
      },
      { localCatId: activeCatId },
    );

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !activeCatId) return;

      setIsCollectionPhotoAdding(true);

      try {
        const slug = getCollectionSlotPhotoSlug(slot);
        const dataUrl = await resizeAndEncode(file, 560, 0.76);
        const photoSrc = await storeAccountPhotoDataUrl({
          dataUrl,
          pathSegments: [activeCatId, "collection", slug],
          fileName: `photo-${Date.now()}`,
        });

        saveCollectionPhoto(activeCatId, slug, photoSrc);
        setCollectionRefreshTick((value) => value + 1);
        closeBoardInput(setIsCollectionPhotoSheetOpen, {
          itemId: "daily-collection-target",
          title: slot.label,
          surfaceText: "コレクションへ",
        });
        trackProductEvent(
          "collection_photo_added",
          {
            slot_id: slot.id,
            slot_slug: slug,
            group_id: slot.group,
            entry: "home_board",
            file_size_bucket: getFileSizeBucket(file.size),
          },
          { localCatId: activeCatId },
        );
      } catch {
        showToast(PHOTO_SAVE_FAILURE_MESSAGE);
      } finally {
        setIsCollectionPhotoAdding(false);
      }
    };

    input.click();
  }

  async function handleMikkePhotoAdd(slot: CollectionSlot) {
    if (!activeCatId || isCollectionPhotoAdding) return;

    trackProductEvent(
      "collection_photo_add_started",
      {
        slot_id: slot.id,
        slot_slug: getCollectionSlotPhotoSlug(slot),
        group_id: slot.group,
        entry: "mikke_window",
      },
      { localCatId: activeCatId },
    );

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "environment");

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !activeCatId) return;

      setIsCollectionPhotoAdding(true);

      try {
        const slug = getCollectionSlotPhotoSlug(slot);
        const dataUrl = await resizeAndEncode(file, 900);
        const photoSrc = await storeAccountPhotoDataUrl({
          dataUrl,
          pathSegments: [activeCatId, "collection", slug],
          fileName: `photo-${Date.now()}`,
        });

        saveCollectionPhoto(activeCatId, slug, photoSrc);
        setCollectionRefreshTick((value) => value + 1);
        showToast(`${slot.label}を見つけた`);
        trackProductEvent(
          "collection_photo_added",
          {
            slot_id: slot.id,
            slot_slug: slug,
            group_id: slot.group,
            entry: "mikke_window",
            file_size_bucket: getFileSizeBucket(file.size),
          },
          { localCatId: activeCatId },
        );
      } catch {
        showToast(PHOTO_SAVE_FAILURE_MESSAGE);
      } finally {
        setIsCollectionPhotoAdding(false);
      }
    };

    input.click();
  }

  function handleDiscoveryClick() {
    if (!activeCatId || !discovery.available) return;

    markDiscoverySeen(activeCatId);
    setDiscoveryDismissedToday(true);
    setIsDiscoverySheetOpen(true);
  }

  function handleBoardAction(
    actionType: HomeBoardAction,
    source?: HomeBoardTransitionSource,
  ) {
    if (actionType === "open_mikke") {
      openBoardInput(setIsYousuOpen, source);
      return;
    }
    if (actionType === "add_sleeping") {
      handleSleepingPhotoStart("camera");
      return;
    }
    if (actionType === "open_photo") {
      void handleHomePhotoSelect();
      return;
    }
    if (actionType === "open_collection_photo") {
      openBoardInput(setIsCollectionPhotoSheetOpen, source);
      return;
    }
    if (actionType === "open_discovery") {
      handleDiscoveryClick();
      return;
    }
    if (actionType === "open_recent_change") {
      setIsRecentChangeSheetOpen(true);
      return;
    }
    if (actionType === "go_torisetu") {
      window.location.href = "/cats";
      return;
    }
    if (actionType === "go_collection") {
      window.location.href = "/collection";
    }
  }

  async function handleSleepingExchangePhotoSelect(source: SleepingPhotoSource) {
    if (
      !activeCatId ||
      isExchangePhotoAdding
    ) {
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
    if (source === "camera") {
      input.setAttribute("capture", "environment");
    }

    const cleanupInput = () => {
      window.setTimeout(() => {
        input.remove();
      }, 0);
    };

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        cleanupInput();
        return;
      }

      setIsExchangePhotoAdding(true);

      try {
        const photoVariants = await createStoredPhotoVariantSet({
          file,
          pathSegments: [activeCatId, "sleeping"],
          fileName: `sleeping-${Date.now()}`,
        });
        const fileSizeBucket = getFileSizeBucket(file.size);
        setPendingExchangeSharePhoto({
          ...photoVariants,
          triggerLabel: "sleeping",
          theme: "sleeping",
          fileSizeBucket,
        });
        setPendingExchangeCatId(activeCatId);

        trackProductEvent(
          "home_exchange_sleeping_photo_selected",
          {
            theme: "sleeping",
            source,
            file_size_bucket: fileSizeBucket,
            saved_immediately: false,
          },
          { localCatId: activeCatId },
        );
      } catch (error) {
        trackProductEvent(
          "photo_upload_error",
          {
            source,
            surface: "home",
            error_code: "home_sleeping_photo_save_failed",
            error_message:
              error instanceof Error ? error.message : "home sleeping photo save failed",
          },
          { localCatId: activeCatId },
        );
        showToast(PHOTO_INPUT_FAILURE_MESSAGE);
      } finally {
        setIsExchangePhotoAdding(false);
        cleanupInput();
      }
    };

    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      if (!input.files?.length) {
        input.remove();
      }
    }, CAMERA_INPUT_STALE_CLEANUP_MS);
  }

  async function handleSleepingStockPhotoImport() {
    if (isExchangePhotoAdding) {
      return;
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
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
      const files = Array.from(input.files ?? []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length === 0) {
        cleanupInput();
        return;
      }

      setIsExchangePhotoAdding(true);
      let savedCount = 0;

      try {
        for (const file of files.slice(0, 30)) {
          const dataUrl = await resizeAndEncode(file, 1400, 0.86);
          const saved = await saveRemoteDeliveryStockPhoto(dataUrl);
          if (saved) {
            savedCount += 1;
          }
        }

        trackProductEvent(
          "home_exchange_stock_photos_imported",
          {
            selected_count: files.length,
            saved_count: savedCount,
          },
          { localCatId: activeCatId },
        );
        showToast(
          savedCount > 0
            ? `とどくねがおを${savedCount}枚入れました`
            : PHOTO_SAVE_FAILURE_MESSAGE,
        );
      } catch {
        showToast(
          savedCount > 0
            ? `とどくねがおを${savedCount}枚入れました`
            : PHOTO_SAVE_FAILURE_MESSAGE,
        );
      } finally {
        setIsExchangePhotoAdding(false);
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

  function handleSleepingPhotoStart(source: SleepingPhotoSource = "camera") {
    trackProductEvent(
      "home_sleeping_photo_start_clicked",
      {
        source,
        has_accepted_safety: hasAcceptedSleepingSafety,
        delivery_available: !sleepingCounterRemaining,
        delivery_remaining: sleepingCounterRemaining ?? null,
      },
      { localCatId: activeCatId },
    );
    trackProductEvent(
      "home_photo_submit_click",
      {
        source,
        has_accepted_safety: hasAcceptedSleepingSafety,
        delivery_available: !sleepingCounterRemaining,
        delivery_remaining: sleepingCounterRemaining ?? null,
      },
      { localCatId: activeCatId },
    );

    if (!hasAcceptedSleepingSafety) {
      setPendingSleepingPhotoSource(source);
      setIsSleepingSafetyChecked(false);
      setIsSleepingSafetySheetOpen(true);
      return;
    }

    void handleSleepingExchangePhotoSelect(source);
  }

  function handleAcceptSleepingSafety() {
    const source = pendingSleepingPhotoSource;
    markSleepingSafetyNoticeAccepted();
    setHasAcceptedSleepingSafety(true);
    setIsSleepingSafetySheetOpen(false);
    setIsSleepingSafetyChecked(false);
    setPendingSleepingPhotoSource("camera");
    void handleSleepingExchangePhotoSelect(source);
  }

  function handleKeepExchangePhoto(photo: ExchangePhoto) {
    keepExchangePhoto(photo);
    setCollectionRefreshTick((value) => value + 1);
    setDeliveredExchangePhoto(null);
    showToast("アルバムに入りました");
    trackProductEvent(
      "home_exchange_photo_kept",
      {
        photo_id: photo.id,
        trigger_label: photo.triggerLabel,
        theme: photo.theme,
      },
      { localCatId: activeCatId },
    );
  }

  function handleCloseExchangePhoto(photo: ExchangePhoto) {
    dismissExchangePhoto(photo);
    setDeliveredExchangePhoto(null);
    trackProductEvent(
      "home_exchange_photo_closed",
      {
        photo_id: photo.id,
        trigger_label: photo.triggerLabel,
        theme: photo.theme,
      },
      { localCatId: activeCatId },
    );
  }

  function handleReportExchangePhoto(photo: ExchangePhoto) {
    reportExchangePhoto(photo);
    setDeliveredExchangePhoto(null);
    showToast("通報して閉じました");
    trackProductEvent(
      "home_exchange_photo_reported",
      {
        photo_id: photo.id,
        source_photo_id: photo.sourcePhotoId,
        trigger_label: photo.triggerLabel,
        theme: photo.theme,
      },
      { localCatId: activeCatId },
    );
  }

  async function handleOpenEveningDelivery(
    deliveryState: Extract<EveningHomeState, { kind: "delivered" }>,
  ) {
    if (openingEveningDeliveryRequestRef.current === deliveryState.dateKey) {
      return;
    }

    openingEveningDeliveryRequestRef.current = deliveryState.dateKey;
    const decodeStatus = await waitForDeliveredPhotoDecode(
      deliveredPhotoDecodeCacheRef.current,
      deliveryState.deliveredPhoto,
      DELIVERED_PHOTO_DECODE_WAIT_MS,
    );
    setDeliveredPhotoDecodeStatus(decodeStatus);
    setOpeningEveningDelivery(deliveryState);
    const wasSaved = keepExchangePhoto(deliveryState.deliveredPhoto);
    markEveningDeliveryKept(deliveryState.dateKey);
    openingEveningDeliveryRequestRef.current = null;
    setCollectionRefreshTick((value) => value + 1);
    setEveningRefreshTick((value) => value + 1);
    trackProductEvent(
      "envelope_opened",
      {
        delivery_date_key: deliveryState.dateKey,
        auto_saved: wasSaved,
        photo_id: deliveryState.deliveredPhoto.id,
      },
      {
        localCatId: activeCatId,
      },
    );
    trackProductEvent(
      "delivery_opened",
      {
        delivery_date_key: deliveryState.dateKey,
        auto_saved: wasSaved,
        photo_id: deliveryState.deliveredPhoto.id,
        delivery_photo_id: deliveryState.deliveredPhoto.id,
        surface: "home",
      },
      {
        localCatId: activeCatId,
      },
    );
  }

  function handleKeepEveningDelivery(dateKey: string, photo: ExchangePhoto) {
    keepExchangePhoto(photo);
    markEveningDeliveryKept(dateKey);
    setOpeningEveningDelivery(null);
    setCollectionRefreshTick((value) => value + 1);
    setEveningRefreshTick((value) => value + 1);
    trackProductEvent(
      "keep_tapped",
      {
        delivery_date_key: dateKey,
        photo_id: photo.id,
      },
      { localCatId: activeCatId },
    );
  }

  function handleReportEveningDelivery(
    dateKey: string,
    photo: ExchangePhoto,
    reason: ExchangePhotoReportReason,
  ) {
    reportExchangePhoto(photo, reason);
    setOpeningEveningDelivery(null);
    setCollectionRefreshTick((value) => value + 1);
    setEveningRefreshTick((value) => value + 1);
    showToast("うけつけました");
    void sendPhotoReport(photo, reason).catch(() => {
      // Local reporting hides the photo immediately; remote moderation can retry later.
    });
    trackProductEvent(
      "home_evening_delivery_photo_reported",
      {
        delivery_date_key: dateKey,
        photo_id: photo.id,
        source_photo_id: photo.sourcePhotoId ?? null,
        reason,
      },
      { localCatId: activeCatId },
    );
  }

  function handleEveningDeliveryDataUrl(dateKey: string, dataUrl: string) {
    const nextPhoto = updateEveningDeliveredPhotoDataUrl(dateKey, dataUrl);

    if (!nextPhoto) {
      return;
    }

    setOpeningEveningDelivery((current) =>
      current?.dateKey === dateKey
        ? {
            ...current,
            deliveredPhoto: nextPhoto,
          }
        : current,
    );
    setEveningRefreshTick((value) => value + 1);
  }

  function handleDeskDeliveredPhotoDataUrl(
    dateKey: string,
    photo: ExchangePhoto,
    dataUrl: string,
  ) {
    handleEveningDeliveryDataUrl(dateKey, dataUrl);
    updateKeptExchangePhotoDataUrl(photo, dataUrl);
  }

  function handleDeliveredExchangeDataUrl(dataUrl: string) {
    setDeliveredExchangePhoto((photo) =>
      photo
        ? {
            ...photo,
            src: dataUrl,
            thumbnailSrc: dataUrl,
            displaySrc: dataUrl,
            originalSrc: dataUrl,
          }
        : photo,
    );
  }

  function dismissHomeInstallHint() {
    window.localStorage.setItem(HOME_INSTALL_HINT_DISMISSED_STORAGE_KEY, "true");
    setIsHomeInstallHintVisible(false);
    setIsHomeInstallGuideOpen(false);
    setHomeInstallPrompt(null);
  }

  async function requestDeliveryNotificationPermission() {
    if (!("Notification" in window) || Notification.permission !== "default") {
      return;
    }

    const permission = await Notification.requestPermission().catch(() => null);
    trackProductEvent(
      "push_permission",
      {
        permission,
        trigger: "home_install",
      },
      { localCatId: activeCatId },
    );
  }

  async function handleHomeInstallPrimaryAction() {
    if (homeInstallPlatform === "android" && homeInstallPrompt) {
      const promptEvent = homeInstallPrompt;
      setHomeInstallPrompt(null);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => null);
      if (choice?.outcome === "accepted" || choice?.outcome === "dismissed") {
        dismissHomeInstallHint();
      }
      return;
    }

    setIsHomeInstallGuideOpen(true);
  }

  async function saveHomeSleepingPhoto({
    catId,
    photo,
    shared,
  }: {
    catId: string;
    photo: PendingExchangeSharePhoto;
    shared: boolean;
  }) {
    const ownPhoto = await saveOwnSleepingPhotoWithCompressedFallback({
      catId,
      src: photo.src,
      thumbnailSrc: photo.thumbnailSrc,
      displaySrc: photo.displaySrc,
      originalSrc: photo.originalSrc,
      triggerLabel: photo.triggerLabel,
      theme: photo.theme,
      shared,
    });

    if (!ownPhoto) {
      return null;
    }

    void backupOwnSleepingPhotoMoment(ownPhoto);
    const deliveryTarget = shared
      ? recordEveningDeliveryTarget(ownPhoto)
      : null;
    setCollectionRefreshTick((value) => value + 1);
    if (deliveryTarget) {
      setEveningRefreshTick((value) => value + 1);
    }

    if (shared) {
      trackProductEvent(
        "take_photo",
        {
          catId,
          hour: new Date().getHours(),
          isExchangeTarget: deliveryTarget?.isExchangeTarget ?? false,
        },
        { localCatId: catId },
      );
    }

    return { ownPhoto, deliveryTarget };
  }

  async function handleConfirmExchangeSharePhoto(photo: PendingExchangeSharePhoto) {
    const targetCatId = pendingExchangeCatId ?? activeCatId;
    if (!targetCatId) return;

    const ownPhoto = await saveOwnSleepingPhotoWithCompressedFallback({
      catId: targetCatId,
      src: photo.src,
      thumbnailSrc: photo.thumbnailSrc,
      displaySrc: photo.displaySrc,
      originalSrc: photo.originalSrc,
      triggerLabel: photo.triggerLabel,
      theme: photo.theme,
      shared: true,
    });

    if (!ownPhoto) {
      showToast(PHOTO_SAVE_FAILURE_MESSAGE);
      return;
    }
    void backupOwnSleepingPhotoMoment(ownPhoto);
    const deliveryTarget = recordEveningDeliveryTarget(ownPhoto);
    setCollectionRefreshTick((value) => value + 1);
    setEveningRefreshTick((value) => value + 1);
    setPendingExchangeSharePhoto(null);
    setPendingExchangeCatId(null);

    if (!deliveryTarget.isExchangeTarget) {
      showToast("とったねがおに入りました。");
    }
    trackProductEvent(
      "take_photo",
      {
        catId: targetCatId,
        hour: new Date().getHours(),
        isExchangeTarget: deliveryTarget.isExchangeTarget,
      },
      { localCatId: targetCatId },
    );
    trackProductEvent(
      "home_exchange_share_photo_confirmed",
      {
        theme: photo.theme,
        trigger_label: photo.triggerLabel,
        file_size_bucket: photo.fileSizeBucket,
        delivery_available: deliveryTarget.isExchangeTarget,
        delivery_date_key: deliveryTarget.dateKey,
      },
      { localCatId: targetCatId },
    );
  }

  async function handleKeepExchangeSharePhotoPrivate(photo: PendingExchangeSharePhoto) {
    const targetCatId = pendingExchangeCatId ?? activeCatId;
    if (!targetCatId) return;

    const ownPhoto = await saveOwnSleepingPhotoWithCompressedFallback({
      catId: targetCatId,
      src: photo.src,
      thumbnailSrc: photo.thumbnailSrc,
      displaySrc: photo.displaySrc,
      originalSrc: photo.originalSrc,
      triggerLabel: photo.triggerLabel,
      theme: photo.theme,
      shared: false,
    });

    if (!ownPhoto) {
      showToast(PHOTO_SAVE_FAILURE_MESSAGE);
      return;
    }
    void backupOwnSleepingPhotoMoment(ownPhoto);
    setCollectionRefreshTick((value) => value + 1);
    setPendingExchangeSharePhoto(null);
    setPendingExchangeCatId(null);
    showToast("とったねがおに入りました");
    trackProductEvent(
      "home_exchange_share_photo_declined",
      {
        theme: photo.theme,
        trigger_label: photo.triggerLabel,
      },
      { localCatId: targetCatId },
    );
  }

  const sleepingPresenceCount = useSleepingPresenceCount();
  const sleepingCounterCount =
    typeof sleepingPresenceCount === "number"
      ? formatSleepingCounterCount(sleepingPresenceCount)
      : "";
  const shouldShowHomeInstallHint =
    isHomeClockReady &&
    isHomeInstallHintVisible &&
    Boolean(homeInstallPlatform) &&
    eveningHomeState.kind !== "before";
  const shouldShowDeskGuidanceCopy = shouldShowGuidanceCopy({
    keptExchangePhotoCount,
    now: homeNow,
  });
  const canUsePendingPhotoAsDeliveryTarget =
    eveningHomeState.kind === "before" || eveningHomeState.kind === "waiting";
  const isHomeReady =
    isHomeClockReady && hasHydratedHomeState && isStartupHoldReleased;

  return (
    <main
      style={isHomeReady ? styles.page : styles.startupPage}
      aria-busy={isHomeReady ? undefined : true}
    >
      <div
        aria-hidden={openingEveningDelivery ? true : undefined}
        style={{
          ...styles.homeContentLayer,
          ...(openingEveningDelivery ? styles.homeContentLayerObscured : {}),
        }}
      >
        {!isHomeReady ? (
          <HomeStartupHold />
        ) : (
          <>
            <div style={styles.paperBackground} aria-hidden="true" />
            <div style={styles.paperNoise} aria-hidden="true" />
            <HomeDeskModel
              catName={homeCatName}
              eveningState={eveningHomeState}
              ownSleepingPhotos={ownSleepingPhotosForHome}
              sleepingCounter={sleepingCounterCount}
              showGuidanceCopy={shouldShowDeskGuidanceCopy}
              showSleepingCounter={
                typeof sleepingPresenceCount === "number" &&
                isTodaySleepingCounterVisible(sleepingCounterCount)
              }
              now={homeNow}
              onTakePhoto={() => handleSleepingPhotoStart("camera")}
              onAddCatPhoto={
                activeCatId
                  ? () => {
                      requestCatGalleryPhotoAdd();
                    }
                  : undefined
              }
              onOpenDelivery={handleOpenEveningDelivery}
              onKeepOpenedDelivery={handleKeepEveningDelivery}
              onReportOpenedDelivery={handleReportEveningDelivery}
              onDeliveredStorageDataUrl={handleDeskDeliveredPhotoDataUrl}
              eveningDeliveryCheckStatus={eveningDelivery.checkStatus}
              onRetryEveningDeliveryCheck={eveningDelivery.retryEveningDeliveryCheck}
              deliveredPhotoDecodeStatus={deliveredPhotoDecodeStatus}
            />
          </>
        )}

        {isHomeReady && shouldShowHomeInstallHint && homeInstallPlatform ? (
          <HomeInstallHintCard
            platform={homeInstallPlatform}
            canPrompt={Boolean(homeInstallPrompt)}
            onPrimary={handleHomeInstallPrimaryAction}
            onDismiss={dismissHomeInstallHint}
          />
        ) : null}

        {isHomeReady && isHomeInstallGuideOpen && homeInstallPlatform ? (
          <HomeInstallGuideSheet
            platform={homeInstallPlatform}
            onClose={dismissHomeInstallHint}
          />
        ) : null}
      </div>

      {openingEveningDelivery ? (
        <EveningDeliveryOpening
          state={openingEveningDelivery}
          catName={homeCatName}
          onStorageDataUrl={(dataUrl) => {
            handleEveningDeliveryDataUrl(openingEveningDelivery.dateKey, dataUrl);
            updateKeptExchangePhotoDataUrl(
              openingEveningDelivery.deliveredPhoto,
              dataUrl,
            );
            setCollectionRefreshTick((value) => value + 1);
          }}
          onClose={() => setOpeningEveningDelivery(null)}
        />
      ) : null}

      {isSleepingSafetySheetOpen ? (
        <SleepingSafetySheet
          isChecked={isSleepingSafetyChecked}
          onCheckedChange={setIsSleepingSafetyChecked}
          onConfirm={handleAcceptSleepingSafety}
          onClose={() => {
            setIsSleepingSafetySheetOpen(false);
            setIsSleepingSafetyChecked(false);
            setPendingSleepingPhotoSource("camera");
          }}
        />
      ) : null}

      {deliveredExchangePhoto ? (
        <ExchangePhotoSheet
          photo={deliveredExchangePhoto}
          onStorageDataUrl={handleDeliveredExchangeDataUrl}
          onKeep={() => handleKeepExchangePhoto(deliveredExchangePhoto)}
          onClose={() => handleCloseExchangePhoto(deliveredExchangePhoto)}
          onReport={() => handleReportExchangePhoto(deliveredExchangePhoto)}
        />
      ) : null}

      {pendingExchangeSharePhoto ? (
        <ExchangeSharePermissionSheet
          photo={pendingExchangeSharePhoto}
          catProfiles={catProfiles}
          selectedCatId={pendingExchangeCatId ?? activeCatId}
          isExchangeTargetAvailable={canUsePendingPhotoAsDeliveryTarget}
          deliveryCopy={
            canUsePendingPhotoAsDeliveryTarget && eveningHomeState.isTodayDelivery
              ? "よる8時に とどきます。"
              : "あした よる8時に とどきます。"
          }
          onCatSelect={setPendingExchangeCatId}
          onModeChange={(mode) => {
            trackProductEvent(
              "home_exchange_share_mode_selected",
              {
                mode,
                delivery_available: canUsePendingPhotoAsDeliveryTarget,
                delivery_date_key: eveningHomeState.dateKey,
              },
              { localCatId: pendingExchangeCatId ?? activeCatId },
            );
          }}
          onConfirm={() =>
            handleConfirmExchangeSharePhoto(pendingExchangeSharePhoto)
          }
          onPrivate={() =>
            handleKeepExchangeSharePhotoPrivate(pendingExchangeSharePhoto)
          }
          onClose={() => {
            setPendingExchangeSharePhoto(null);
            setPendingExchangeCatId(null);
          }}
        />
      ) : null}

      {isYousuOpen ? (
        <MikkeAllSheet
          title={`${catName}の写真`}
          source={boardSheetSource}
          returnCompletion={boardSheetReturn}
          isReturning={isBoardSheetReturning}
          questions={MIKKE_WINDOW_QUESTIONS}
          currentCategory={mikkeWindow.question.category}
          selected={selectedYousu}
          categoryRemaining={mikkeCategoryRemaining}
          categoryLastLabels={mikkeCategoryLastLabels}
          onClose={() => closeBoardInput(setIsYousuOpen)}
          onSelect={(question, option) => {
            recordMikkeFreeAnswer(question, option);
          }}
        />
      ) : null}

      {isDiscoverySheetOpen ? (
        <InfoSheet
          title={personalityInsight.title}
          lead={personalityInsight.body}
          body={personalityInsight.sheetBody}
          onClose={() => setIsDiscoverySheetOpen(false)}
        />
      ) : null}

      {isRecentChangeSheetOpen ? (
        <InfoSheet
          title={personalityInsight.title}
          lead={personalityInsight.body}
          body={personalityInsight.sheetBody}
          onClose={() => setIsRecentChangeSheetOpen(false)}
        />
      ) : null}

      {isCatGalleryIntroSheetOpen ? (
        <CatGalleryIntroSheet
          onContinue={handleCatGalleryIntroContinue}
          onClose={() => setIsCatGalleryIntroSheetOpen(false)}
        />
      ) : null}

      {isCollectionPhotoSheetOpen && dailyCollectionTarget ? (
        <CollectionQuickPhotoSheet
          slot={dailyCollectionTarget}
          source={boardSheetSource}
          returnCompletion={boardSheetReturn}
          isReturning={isBoardSheetReturning}
          isAdding={isCollectionPhotoAdding}
          onAdd={() => {
            void handleCollectionPhotoAdd(dailyCollectionTarget);
          }}
          onClose={() => closeBoardInput(setIsCollectionPhotoSheetOpen)}
        />
      ) : null}

      {isAccountRestoreSheetOpen ? (
        <AccountRestoreSheet
          summary={accountRestoreSummary}
          isRestoring={isAccountRestoring}
          onRestore={() => {
            void handleAccountRestoreFromSheet();
          }}
          onClose={dismissAccountRestorePrompt}
        />
      ) : null}

      {toastText ? (
        <div
          aria-hidden={openingEveningDelivery ? true : undefined}
          style={styles.toast}
        >
          {toastText}
        </div>
      ) : null}

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes boardCardSettle {
          from {
            opacity: 0;
            transform: translate3d(0, 8px, 0) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes boardCountdownRestEnter {
          from {
            opacity: 0;
            transform: scaleX(0.96);
          }
          to {
            opacity: 1;
            transform: scaleX(1);
          }
        }
        @keyframes homeCatChromeSettle {
          from {
            opacity: 0.86;
            transform: translate3d(0, 8px, 0) scale(0.992);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        @keyframes morphBloom {
          0% {
            opacity: 0;
            transform: scale(0.92);
          }
          36% {
            opacity: 0.72;
            transform: scale(1.035);
          }
          100% {
            opacity: 0;
            transform: scale(1.12);
          }
        }
        @keyframes exchangePhotoIn {
          from {
            opacity: 0;
            transform: translate3d(0, 18px, 0) scale(0.985);
            filter: blur(1.2px);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
            filter: blur(0);
          }
        }
        @keyframes eveningOpeningOverlayIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes eveningOpeningStageIn {
          from {
            opacity: 0;
            transform: translate3d(0, 8px, 0) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
        .mikke-all-body {
          scrollbar-width: none;
        }
        .mikke-all-body::-webkit-scrollbar {
          display: none;
        }
        .board-open-content {
          scrollbar-width: none;
        }
        .board-open-content::-webkit-scrollbar {
          display: none;
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </main>
  );
}

function HomeMorphSheet({
  title,
  source,
  returnCompletion,
  isReturning,
  onClose,
  children,
}: {
  title: string;
  source: HomeBoardTransitionSource | null;
  returnCompletion: HomeBoardCompletion | null;
  isReturning: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const [isContentReady, setIsContentReady] = useState(false);
  const [motionStyle, setMotionStyle] = useState<CSSProperties>(() => ({
    opacity: 0,
    transform: "translate3d(0, 14px, 0) scale(0.985)",
  }));
  const compactTitle = returnCompletion?.title ?? source?.title ?? title;
  const compactSub = returnCompletion?.surfaceText ?? source?.surfaceText ?? "";
  const sourceKey = source
    ? `${source.itemId}:${Math.round(source.rect.left)}:${Math.round(source.rect.top)}`
    : "no-source";

  function getSourceTransform() {
    const panel = panelRef.current;
    if (!panel || !source) {
      return "translate3d(0, 14px, 0) scale(0.985)";
    }

    const target = panel.getBoundingClientRect();
    const scaleX = source.rect.width / Math.max(target.width, 1);
    const scaleY = source.rect.height / Math.max(target.height, 1);
    const translateX = source.rect.left - target.left;
    const translateY = source.rect.top - target.top;

    return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
  }

  useLayoutEffect(() => {
    const fromTransform = getSourceTransform();

    setIsContentReady(false);
    setMotionStyle({
      opacity: source ? 0.86 : 0,
      transform: fromTransform,
      transition: "none",
      borderRadius: source ? "18px" : "24px",
    });

    const enterFrame = window.requestAnimationFrame(() => {
      setMotionStyle({
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
        transition:
          "transform 340ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 180ms ease-out, border-radius 340ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        borderRadius: "var(--radius-2xl)",
      });
    });

    openTimerRef.current = window.setTimeout(() => {
      setIsContentReady(true);
      openTimerRef.current = null;
    }, 145);

    return () => {
      window.cancelAnimationFrame(enterFrame);
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
        openTimerRef.current = null;
      }
    };
  }, [sourceKey]);

  useEffect(() => {
    if (!isReturning) return;

    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }

    setIsContentReady(false);
    setMotionStyle({
      opacity: 0.92,
      transform: getSourceTransform(),
      transition:
        "transform 340ms cubic-bezier(0.4, 0, 0.6, 1), opacity 260ms ease-in, border-radius 340ms cubic-bezier(0.4, 0, 0.6, 1)",
      borderRadius: "var(--radius-lg)",
    });
  }, [isReturning]);

  const compactOpacity = isReturning || !isContentReady ? 1 : 0;
  const contentOpacity = isReturning ? 0 : isContentReady ? 1 : 0;

  return (
    <>
      <div
        style={{
          ...styles.morphBackdrop,
          ...(isReturning ? styles.morphBackdropReturning : {}),
        }}
        onClick={onClose}
      />
      <section
        ref={panelRef}
        style={{
          ...styles.morphPanel,
          ...motionStyle,
        }}
        role="dialog"
        aria-modal="true"
      >
        <span style={styles.morphBloom} aria-hidden="true" />
        {source ? (
          <div
            style={{
              ...styles.morphCompact,
              opacity: compactOpacity,
            }}
            aria-hidden={!isReturning && isContentReady}
          >
            <span style={styles.morphCompactIcon}>
              <BoardIcon icon={source.icon} />
            </span>
            <span style={styles.morphCompactText}>
              <span style={styles.morphCompactTitle}>{compactTitle}</span>
              {compactSub ? (
                <span style={styles.morphCompactSub}>{compactSub}</span>
              ) : null}
            </span>
          </div>
        ) : null}
        <div
          style={{
            ...styles.morphContent,
            opacity: contentOpacity,
          }}
        >
          <p style={styles.morphTitle}>{title}</p>
          {children}
        </div>
      </section>
    </>
  );
}

function MikkeAllSheet({
  title,
  source,
  returnCompletion,
  isReturning,
  questions,
  currentCategory,
  selected,
  categoryRemaining,
  categoryLastLabels,
  onClose,
  onSelect,
}: {
  title: string;
  source: HomeBoardTransitionSource | null;
  returnCompletion: HomeBoardCompletion | null;
  isReturning: boolean;
  questions: typeof MIKKE_WINDOW_QUESTIONS;
  currentCategory: MikkeWindowCategory;
  selected: string | null;
  categoryRemaining: Record<MikkeWindowCategory, string | null>;
  categoryLastLabels: Record<MikkeWindowCategory, string | null>;
  onClose: () => void;
  onSelect: (
    question: (typeof MIKKE_WINDOW_QUESTIONS)[number],
    option: MikkeWindowOption,
  ) => void;
}) {
  const [expandedLockedCategories, setExpandedLockedCategories] = useState<
    Partial<Record<MikkeWindowCategory, boolean>>
  >({});
  const sectionRefs = useRef<Record<MikkeWindowCategory, HTMLElement | null>>({
    place: null,
    pose: null,
    sign: null,
  });
  const orderedQuestions = [
    ...questions.filter((question) => question.category === currentCategory),
    ...questions.filter((question) => question.category !== currentCategory),
  ];

  function jumpToCategory(category: MikkeWindowCategory) {
    sectionRefs.current[category]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function toggleLockedCategory(category: MikkeWindowCategory) {
    setExpandedLockedCategories((current) => ({
      ...current,
      [category]: !current[category],
    }));
  }

  return (
    <HomeMorphSheet
      title={title}
      source={source}
      returnCompletion={returnCompletion}
      isReturning={isReturning}
      onClose={onClose}
    >
      <div style={styles.mikkeCategoryNav} aria-label="みっけカテゴリ">
        {orderedQuestions.map((question) => {
          const remaining = categoryRemaining[question.category];
          const isCurrent = question.category === currentCategory;

          return (
            <button
              key={question.category}
              type="button"
              style={{
                ...styles.mikkeCategoryNavItem,
                ...(isCurrent ? styles.mikkeCategoryNavItemActive : {}),
              }}
              onClick={() => jumpToCategory(question.category)}
            >
              <span>{question.categoryLabel}</span>
              {remaining ? (
                <span style={styles.mikkeCategoryNavStatus}>あと</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <div className="mikke-all-body" style={styles.mikkeAllBody}>
        {orderedQuestions.map((question) => {
          const remaining = categoryRemaining[question.category];
          const isLocked = Boolean(remaining);
          const isExpandedLocked = Boolean(
            expandedLockedCategories[question.category],
          );
          const shouldCollapse = isLocked && !isExpandedLocked;
          const lastLabel = categoryLastLabels[question.category];

          return (
            <section
              key={question.id}
              ref={(node) => {
                sectionRefs.current[question.category] = node;
              }}
              style={styles.mikkeAllSection}
            >
              <div style={styles.mikkeAllSectionHeader}>
                <span style={styles.mikkeQuestionCategory}>
                  {question.categoryLabel}
                </span>
                <span style={styles.mikkeAllPromptRow}>
                  <span style={styles.mikkeAllPrompt}>{question.prompt}</span>
                  {remaining ? (
                    <span style={styles.mikkeAllCategoryLock}>
                      あと {remaining}
                    </span>
                  ) : null}
                </span>
              </div>
              {shouldCollapse ? (
                <button
                  type="button"
                  style={styles.mikkeLockedSummary}
                  onClick={() => toggleLockedCategory(question.category)}
                >
                  <span style={styles.mikkeLockedSummaryText}>
                    {lastLabel ? `${lastLabel}、みっけ` : "みっけ済み"}
                  </span>
                  <span style={styles.mikkeLockedSummarySub}>開く</span>
                </button>
              ) : null}
              {isLocked && isExpandedLocked ? (
                <button
                  type="button"
                  style={styles.mikkeLockedSummary}
                  onClick={() => toggleLockedCategory(question.category)}
                >
                  <span style={styles.mikkeLockedSummaryText}>
                    {lastLabel ? `${lastLabel}、みっけ` : "みっけ済み"}
                  </span>
                  <span style={styles.mikkeLockedSummarySub}>閉じる</span>
                </button>
              ) : null}
              {!shouldCollapse ? (
              <div style={styles.mikkeAllOptionGrid}>
                {question.options.map((option) => {
                  const isSelected = selected === option.label;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSelect(question, option)}
                      disabled={isLocked}
                      style={{
                        ...styles.mikkeOption,
                        ...styles.mikkeAllOption,
                        ...(isSelected ? styles.mikkeOptionSelected : {}),
                        ...(isLocked && !isSelected ? styles.lockedState : {}),
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </HomeMorphSheet>
  );
}

function MikkeWindowCard({
  window,
  answer,
  result,
  catName,
  catCounters,
  isResultLoading,
  remaining,
  onSelect,
  onOpenAll,
  photoSlot,
  isPhotoAdding,
  onAddPhoto,
}: {
  window: MikkeWindow;
  answer: StoredMikkeWindowAnswer | null;
  result: MikkeWindowResult | null;
  catName: string;
  catCounters: HomeCatCounter[];
  isResultLoading: boolean;
  remaining: string | null;
  onSelect: (option: MikkeWindowOption) => void;
  onOpenAll: () => void;
  photoSlot: CollectionSlot | null;
  isPhotoAdding: boolean;
  onAddPhoto: (slot: CollectionSlot) => void;
}) {
  return (
    <div style={styles.mikkeWindowPanel}>
      <div style={styles.mikkeWindowHeader}>
        <span style={styles.mikkeWindowKicker}>ほかの猫</span>
        <span style={styles.mikkeWindowBadge}>
          {remaining ? `あと ${remaining}` : window.question.categoryLabel}
        </span>
      </div>
      <div style={styles.catCounterGrid}>
        {catCounters.map((counter) => (
          <span key={counter.id} style={styles.catCounterTile}>
            <span style={styles.catCounterValue}>{counter.count}匹</span>
            <span style={styles.catCounterLabel}>{counter.label}</span>
          </span>
        ))}
      </div>
      <MikkeWindowContent
        window={window}
        answer={answer}
        result={result}
        catName={catName}
        isResultLoading={isResultLoading}
        onSelect={onSelect}
        onOpenAll={onOpenAll}
        photoSlot={photoSlot}
        isPhotoAdding={isPhotoAdding}
        onAddPhoto={onAddPhoto}
        variant="card"
      />
    </div>
  );
}

function MikkeWindowContent({
  window,
  answer,
  result,
  catName,
  isResultLoading,
  onSelect,
  onOpenAll,
  photoSlot,
  isPhotoAdding,
  onAddPhoto,
  variant,
}: {
  window: MikkeWindow;
  answer: StoredMikkeWindowAnswer | null;
  result: MikkeWindowResult | null;
  catName: string;
  isResultLoading: boolean;
  onSelect: (option: MikkeWindowOption) => void;
  onOpenAll: () => void;
  photoSlot: CollectionSlot | null;
  isPhotoAdding: boolean;
  onAddPhoto: (slot: CollectionSlot) => void;
  variant: "card" | "sheet";
}) {
  const isAnswered = Boolean(answer);
  const selectedCount =
    answer && result
      ? result.counts.find((count) => count.answerId === answer.answerId)
      : null;
  const visibleResultCounts = result
    ? getVisibleMikkeResultCounts(result.counts, answer?.answerId)
    : [];

  return (
    <div style={variant === "card" ? styles.mikkeWindowBody : styles.mikkeSheetBody}>
      {!isAnswered ? (
        <>
          <div style={styles.mikkeQuestionBlock}>
            <span style={styles.mikkeQuestionCategory}>
              {catName}も加える
            </span>
            <span style={styles.mikkeQuestionRow}>
              <p style={styles.mikkeQuestionText}>{window.question.prompt}</p>
              <button
                type="button"
                style={styles.mikkeAllOpenButton}
                onClick={onOpenAll}
              >
                ぜんぶ
              </button>
            </span>
          </div>
          <div style={styles.mikkeOptionGrid}>
            {getMikkeWindowOptions(window.question).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option)}
                style={styles.mikkeOption}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {isAnswered ? (
        <div
          style={{
            ...styles.mikkeResultBlock,
            ...styles.mikkeResultBlockCollapsed,
          }}
        >
          <div style={styles.mikkeResultCounter}>
            <span style={styles.mikkeResultCounterLabel}>
              {answer?.answerLabel}の猫
            </span>
            <span style={styles.mikkeResultCounterValue}>
              {selectedCount?.count ?? 1}匹
            </span>
            <span style={styles.mikkeResultCounterSub}>
              {catName}も加わりました
            </span>
          </div>
          <div style={styles.mikkeResultHeader}>
            <span style={styles.mikkeResultMine}>ほかの子</span>
            <span style={styles.mikkeResultMeta}>
              {result?.isMockAssisted ? "集まり中" : `${result?.realTotal ?? 0}匹`}
            </span>
          </div>
          {isResultLoading && !result ? (
            <p style={styles.mikkeResultEmpty}>ほかの子たちを見ています</p>
          ) : result ? (
            <div style={styles.mikkeResultRows}>
              {visibleResultCounts.map((count) => (
                <div
                  key={count.answerId}
                  style={{
                    ...styles.mikkeResultRow,
                    ...(count.answerId === answer?.answerId
                      ? styles.mikkeResultRowSelected
                      : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.mikkeResultLabel,
                      ...(count.answerId === answer?.answerId
                        ? styles.mikkeResultLabelSelected
                        : {}),
                    }}
                  >
                    {count.answerLabel}
                  </span>
                  <span style={styles.mikkeResultTrack}>
                    <span
                      style={{
                        ...styles.mikkeResultFill,
                        ...(count.answerId === answer?.answerId
                          ? styles.mikkeResultFillSelected
                          : {}),
                        width: `${Math.max(6, count.ratio)}%`,
                      }}
                    />
                  </span>
                  <span style={styles.mikkeResultRatio}>{count.ratio}%</span>
                </div>
              ))}
            </div>
          ) : null}
          {photoSlot ? (
            <button
              type="button"
              style={styles.mikkePhotoButton}
              onClick={() => onAddPhoto(photoSlot)}
              disabled={isPhotoAdding}
            >
              {isPhotoAdding ? "追加中..." : "写真も入れる"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InfoSheet({
  title,
  lead,
  body,
  onClose,
}: {
  title: string;
  lead: string;
  body: string;
  onClose: () => void;
}) {
  return (
    <AppBottomSheet title={title} onClose={onClose}>
      <div style={styles.infoSheetBody}>
        <p style={styles.infoSheetLead}>{lead}</p>
        <p style={styles.infoSheetText}>{body}</p>
      </div>
    </AppBottomSheet>
  );
}

function CatGalleryIntroSheet({
  onContinue,
  onClose,
}: {
  onContinue: () => void;
  onClose: () => void;
}) {
  return (
    <AppBottomSheet title="とっておきに のこす" onClose={onClose}>
      <div style={styles.infoSheetBody}>
        <p style={styles.infoSheetLead}>
          ここは、とっておきの 100枚だけ。
        </p>
        <p style={styles.infoSheetText}>ねこだよりには つかわれません。</p>
        <AppButton type="button" variant="primary" fullWidth onClick={onContinue}>
          写真を選ぶ
        </AppButton>
      </div>
    </AppBottomSheet>
  );
}

function HomeStartupHold() {
  return (
    <section
      data-testid="home-startup-hold"
      aria-label="きょうを読み込み中"
      aria-busy="true"
      style={styles.startupHold}
    />
  );
}

function useSleepingPresenceCount() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;
    const dateKey = getJstDateKey(Date.now());

    try {
      const cached = window.sessionStorage.getItem(PRESENCE_SESSION_STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as {
          dateKey?: unknown;
          count?: unknown;
        };
        if (
          parsed.dateKey === dateKey &&
          typeof parsed.count === "number" &&
          Number.isFinite(parsed.count)
        ) {
          setCount(parsed.count);
          return;
        }
      }
    } catch {
      // Presence is ambient; cache failures should not affect the home screen.
    }

    const controller = new AbortController();

    fetch("/api/presence", {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    })
      .then((response) => (response.ok ? response.json() : { count: null }))
      .then((body: { count?: unknown }) => {
        if (!isActive) return;

        const nextCount =
          typeof body.count === "number" && Number.isFinite(body.count)
            ? body.count
            : null;
        setCount(nextCount);

        if (nextCount === null) {
          return;
        }

        try {
          window.sessionStorage.setItem(
            PRESENCE_SESSION_STORAGE_KEY,
            JSON.stringify({ dateKey, count: nextCount }),
          );
        } catch {
          // Ignore cache write failures; the next visit can fetch again.
        }
      })
      .catch(() => {
        if (isActive) {
          setCount(null);
        }
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  return count;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(query.matches);
    const handleChange = () => setPrefersReducedMotion(query.matches);
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

function EveningDeliveryOpening({
  state,
  catName,
  onStorageDataUrl,
  onClose,
}: {
  state: Extract<EveningHomeState, { kind: "delivered" }>;
  catName: string;
  onStorageDataUrl: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const closeTimerRef = useRef<number | null>(null);
  const isClosingRef = useRef(false);
  const pushedHistoryRef = useRef(false);
  const ignoreNextPopRef = useRef(false);
  const requestCloseRef = useRef<(syncHistory?: boolean) => void>(() => undefined);
  const [isClosing, setIsClosing] = useState(false);

  function finishClose() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    onClose();
  }

  function requestClose(syncHistory = true) {
    if (isClosingRef.current) {
      return;
    }

    if (syncHistory && pushedHistoryRef.current) {
      ignoreNextPopRef.current = true;
      pushedHistoryRef.current = false;
      window.history.back();
    }

    if (prefersReducedMotion) {
      finishClose();
      return;
    }

    isClosingRef.current = true;
    setIsClosing(true);

    closeTimerRef.current = window.setTimeout(
      finishClose,
      160,
    );
  }
  requestCloseRef.current = requestClose;

  useEffect(() => {
    trackProductEvent("envelope_shown", {
      delivery_date_key: state.dateKey,
    });
  }, [state.dateKey]);

  useEffect(() => {
    window.history.pushState(
      { neterunekoEveningOpening: true },
      "",
      window.location.href,
    );
    pushedHistoryRef.current = true;

    function handlePopState() {
      if (ignoreNextPopRef.current) {
        ignoreNextPopRef.current = false;
        return;
      }

      pushedHistoryRef.current = false;
      requestCloseRef.current(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      style={styles.eveningOpeningOverlay}
      aria-live="polite"
      onClick={() => requestClose()}
    >
      <div
        style={{
          ...styles.eveningOpeningBackdrop,
          ...(isClosing ? styles.eveningOpeningBackdropClosing : {}),
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.eveningOpeningPairStage,
          ...(isClosing ? styles.eveningOpeningPairStageClosing : {}),
        }}
        data-testid="evening-opening-pair"
        onClick={(event) => event.stopPropagation()}
      >
        <p style={styles.eveningOpeningTitle}>ねこだより</p>
        <p style={styles.eveningOpeningSubtitle}>
          どこかのねがおが届きました
        </p>
        <div
          style={{
            ...styles.eveningOpeningPhotoFrame,
            ...(isClosing ? styles.eveningOpeningPhotoFrameClosing : {}),
          }}
        >
          <StoredPhotoImage
            src={getPhotoDetailSrc(state.deliveredPhoto)}
            fallbackSrcs={getPhotoFallbackSrcs(state.deliveredPhoto)}
            alt=""
            style={styles.eveningOpeningPhoto}
            onStorageDataUrl={onStorageDataUrl}
          />
        </div>
        <p style={styles.eveningOpeningSavedNote}>
          とどいたで見返せます
        </p>
        <AppButton
          type="button"
          variant="quiet"
          size="md"
          onClick={() => requestClose()}
          style={styles.eveningOpeningCloseButton}
        >
          閉じる
        </AppButton>
        <p style={styles.eveningOpeningAfterword}>また、あした</p>
      </div>
    </div>
  );
}

function HomeInstallHintCard({
  platform,
  canPrompt,
  onPrimary,
  onDismiss,
}: {
  platform: HomeInstallPlatform;
  canPrompt: boolean;
  onPrimary: () => void;
  onDismiss: () => void;
}) {
  const primaryLabel = platform === "android" && canPrompt ? "追加する" : "置き方を見る";

  return (
    <AppCard
      variant="floating"
      padding="md"
      style={styles.homeInstallHintCard}
      aria-label="ホーム画面に追加"
    >
      <div style={styles.homeInstallHintText}>
        <p style={styles.homeInstallHintTitle}>
          こんやの ねがおを
          <br />
          うけとる ポストを、
          <br />
          ホームがめんに おきませんか
        </p>
      </div>
      <div style={styles.homeInstallHintActions}>
        <AppButton
          type="button"
          variant="secondary"
          size="md"
          style={styles.homeInstallHintPrimary}
          onClick={onPrimary}
        >
          {primaryLabel}
        </AppButton>
        <AppButton
          type="button"
          variant="quiet"
          size="md"
          style={styles.homeInstallHintSecondary}
          onClick={onDismiss}
        >
          あとで
        </AppButton>
      </div>
    </AppCard>
  );
}

function HomeInstallGuideSheet({
  platform,
  onClose,
}: {
  platform: HomeInstallPlatform;
  onClose: () => void;
}) {
  const title =
    platform === "ios" ? "iPhoneでホームに置く" : "Androidでホームに置く";
  const steps =
    platform === "ios"
      ? [
          "画面下の共有ボタンを押す",
          "「ホーム画面に追加」を選ぶ",
          "追加を押す",
        ]
      : [
          "Chromeのメニューを開く",
          "「アプリをインストール」または「ホーム画面に追加」を選ぶ",
          "追加を押す",
        ];

  return (
    <AppBottomSheet title={title} onClose={onClose} variant="paper">
      <div style={styles.homeInstallGuideBody}>
        <ol style={styles.homeInstallGuideList}>
          {steps.map((step) => (
            <li key={step} style={styles.homeInstallGuideItem}>
              {step}
            </li>
          ))}
        </ol>
        <button
          type="button"
          style={styles.homeInstallGuideButton}
          onClick={onClose}
        >
          わかりました
        </button>
      </div>
    </AppBottomSheet>
  );
}

function SleepingSafetySheet({
  isChecked,
  onCheckedChange,
  onConfirm,
  onClose,
}: {
  isChecked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <AppBottomSheet
      title="ねこだよりの約束"
      onClose={onClose}
      showHandle={false}
    >
      <div style={styles.sleepingSafetyBody}>
        <div style={styles.sleepingSafetyList}>
          <p style={styles.sleepingSafetyItem}>
            <span style={styles.sleepingSafetyLine}>送る写真は、どこかのおうちに</span>
            <span style={styles.sleepingSafetyLine}>ねこだよりとして届きます。</span>
          </p>
          <p style={styles.sleepingSafetyItem}>
            <span style={styles.sleepingSafetyLine}>人の顔・住所・名前が写る写真は</span>
            <span style={styles.sleepingSafetyLine}>送らないでください。</span>
          </p>
          <p style={styles.sleepingSafetyItem}>
            <span style={styles.sleepingSafetyLine}>とどいた写真は、SNSなどに</span>
            <span style={styles.sleepingSafetyLine}>公開しないでください。</span>
          </p>
          <p style={styles.sleepingSafetyItem}>
            <span style={styles.sleepingSafetyLine}>人の顔・住所・名前が写っていたら</span>
            <span style={styles.sleepingSafetyLine}>報告してください。</span>
          </p>
        </div>
        <label style={styles.sleepingSafetyCheck}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(event) => onCheckedChange(event.currentTarget.checked)}
            style={styles.sleepingSafetyCheckbox}
          />
          確認しました
        </label>
        <button
          type="button"
          disabled={!isChecked}
          style={{
            ...styles.sleepingSafetyButton,
            ...(!isChecked ? styles.sleepingSafetyButtonDisabled : {}),
          }}
          onClick={onConfirm}
        >
          はじめる
        </button>
      </div>
    </AppBottomSheet>
  );
}

function ExchangePhotoSheet({
  photo,
  onStorageDataUrl,
  onKeep,
  onClose,
  onReport,
}: {
  photo: ExchangePhoto;
  onStorageDataUrl: (dataUrl: string) => void;
  onKeep: () => void;
  onClose: () => void;
  onReport: () => void;
}) {
  return (
    <AppSheet
      placement="bottom"
      title={"ねがおがとどきました"}
      variant="dim"
      onClose={onClose}
      style={styles.exchangeSheetFrame}
      headerAction={
        <AppButton
          type="button"
          aria-label={"通報して閉じる"}
          title={"通報して閉じる"}
          variant="ghost"
          size="icon"
          iconOnly
          onClick={onReport}
        >
          <AppIcon name="flag" size={18} />
        </AppButton>
      }
    >
        <div style={styles.exchangePhotoFrame}>
          <StoredPhotoImage
            src={getPhotoDetailSrc(photo)}
            fallbackSrcs={getPhotoFallbackSrcs(photo)}
            alt=""
            style={styles.exchangePhoto}
            onStorageDataUrl={onStorageDataUrl}
          />
        </div>
        <p style={styles.exchangeAssurance}>とっておくと、アルバムに入ります。</p>
        <div style={styles.exchangeActions}>
          <button type="button" style={styles.exchangeKeepButton} onClick={onKeep}>
            とっておく
          </button>
          <button type="button" style={styles.exchangePlainButton} onClick={onClose}>
            閉じる
          </button>
        </div>
    </AppSheet>
  );
}

function ExchangeSharePermissionSheet({
  photo,
  catProfiles,
  selectedCatId,
  isExchangeTargetAvailable,
  deliveryCopy,
  onCatSelect,
  onModeChange,
  onConfirm,
  onPrivate,
  onClose,
}: {
  photo: PendingExchangeSharePhoto;
  catProfiles: CatProfile[];
  selectedCatId: string | null;
  isExchangeTargetAvailable: boolean;
  deliveryCopy: string;
  onCatSelect: (catId: string) => void;
  onModeChange: (mode: "shared" | "private") => void;
  onConfirm: () => void;
  onPrivate: () => void;
  onClose: () => void;
}) {
  const shouldShowCatPicker = catProfiles.length > 1;
  const [mode, setMode] = useState<"shared" | "private">("shared");
  const isPrivate = mode === "private" || !isExchangeTargetAvailable;
  const selectedCatProfile =
    catProfiles.find((profile) => profile.id === selectedCatId) ??
    catProfiles[0] ??
    null;

  function selectMode(nextMode: "shared" | "private") {
    setMode(nextMode);
    onModeChange(nextMode);
  }

  return (
    <AppSheet
      placement="bottom"
      title={"このねがおを とっておく"}
      variant="dim"
      closeOnOverlay={false}
      onClose={onClose}
      style={styles.exchangeSheetFrame}
    >
        <div style={styles.exchangeShareLayout}>
          <div style={styles.exchangeSharePreview}>
          <StoredPhotoImage src={photo.src} alt="" style={styles.exchangePhoto} />
          </div>
          <div style={styles.exchangeShareSummary}>
            <span style={styles.exchangeShareSummaryIcon} aria-hidden="true">
              <AppIcon name={isPrivate ? "lock" : "mail"} size={17} />
            </span>
            <p style={styles.exchangeLead}>
              {isPrivate ? "自分だけの記録にします。" : deliveryCopy}
            </p>
          </div>
        </div>

        <div style={styles.exchangeDecisionStack}>
        {shouldShowCatPicker ? (
          <div style={styles.exchangeDecisionBlock}>
            <p style={styles.exchangeDecisionLabel}>この子の記録に入れる</p>
            <div style={styles.exchangeCatPicker} aria-label="入れる猫">
              {catProfiles.map((profile) => {
                const isSelected = profile.id === selectedCatId;

                return (
                  <button
                    key={profile.id}
                    type="button"
                    style={{
                      ...styles.exchangeCatOption,
                      ...(isSelected ? styles.exchangeCatOptionActive : {}),
                    }}
                    onClick={() => onCatSelect(profile.id)}
                    aria-pressed={isSelected}
                  >
                    <span style={styles.exchangeCatName}>{getCatName(profile)}</span>
                    {isSelected ? (
                      <span style={styles.exchangeCatSelectedMark} aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : selectedCatProfile ? (
          <div
            style={{
              ...styles.exchangeSelectedCatCard,
              ...styles.exchangeSelectedCatCardPlain,
            }}
          >
            <span style={styles.exchangeSelectedCatText}>
              {getCatName(selectedCatProfile)}の記録に入ります
            </span>
          </div>
        ) : null}

        {isExchangeTargetAvailable ? (
          <div style={styles.exchangeDecisionBlock}>
            <p style={styles.exchangeDecisionLabel}>ねこだより</p>
            <div style={styles.exchangeModeGroup} role="group" aria-label="ねこだより">
              <button
                type="button"
                style={{
                  ...styles.exchangeModeButton,
                  ...(!isPrivate ? styles.exchangeModeButtonActive : {}),
                }}
                onClick={() => selectMode("shared")}
                aria-pressed={!isPrivate}
              >
                <span style={styles.exchangeModeIcon} aria-hidden="true">
                  <AppIcon name="mail" size={18} />
                </span>
                <span style={styles.exchangeModeText}>
                  <span style={styles.exchangeModeLabel}>届ける</span>
                  <span style={styles.exchangeModeSub}>よる8時の便りに使う</span>
                </span>
              </button>
              <button
                type="button"
                style={{
                  ...styles.exchangeModeButton,
                  ...(isPrivate ? styles.exchangeModeButtonActive : {}),
                }}
                onClick={() => selectMode("private")}
                aria-pressed={isPrivate}
              >
                <span style={styles.exchangeModeIcon} aria-hidden="true">
                  <AppIcon name="lock" size={18} />
                </span>
                <span style={styles.exchangeModeText}>
                  <span style={styles.exchangeModeLabel}>自分だけ</span>
                  <span style={styles.exchangeModeSub}>ねこだよりに使わない</span>
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.exchangeSelectedCatCard}>
            <span style={styles.exchangeShareSummaryIcon} aria-hidden="true">
              <AppIcon name="lock" size={17} />
            </span>
            <span style={styles.exchangeSelectedCatText}>
              きょうの便りは届いたので、自分だけの記録にします
            </span>
          </div>
        )}
        </div>

        <div style={styles.exchangeActions}>
          <button
            type="button"
            style={styles.exchangeKeepButton}
            onClick={isPrivate ? onPrivate : onConfirm}
          >
            とっておく
          </button>
        </div>
    </AppSheet>
  );
}

function CollectionQuickPhotoSheet({
  slot,
  source,
  returnCompletion,
  isReturning,
  isAdding,
  onAdd,
  onClose,
}: {
  slot: CollectionSlot;
  source: HomeBoardTransitionSource | null;
  returnCompletion: HomeBoardCompletion | null;
  isReturning: boolean;
  isAdding: boolean;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <HomeMorphSheet
      title="今日の1枚"
      source={source}
      returnCompletion={returnCompletion}
      isReturning={isReturning}
      onClose={onClose}
    >
      <div style={styles.collectionQuickBody}>
        <div style={styles.collectionQuickTarget}>
          <span style={styles.collectionQuickThumb} aria-hidden="true">
            <img
              src={slot.iconPath}
              alt=""
              style={styles.collectionQuickIcon}
            />
          </span>
          <span style={styles.collectionQuickText}>
            <span style={styles.collectionQuickLabel}>見つけたい姿</span>
            <span style={styles.collectionQuickName}>{slot.label}</span>
          </span>
        </div>
        <button
          type="button"
          style={styles.collectionQuickButton}
          onClick={onAdd}
          disabled={isAdding}
        >
          {isAdding ? "追加中..." : "写真を追加"}
        </button>
      </div>
    </HomeMorphSheet>
  );
}

function AccountRestoreSheet({
  summary,
  isRestoring,
  onRestore,
  onClose,
}: {
  summary: {
    remoteCats: number;
    remoteRecords: number;
    remoteCatGalleryPhotos: number;
    remoteCollectionPhotos: number;
    remoteOwnSleepingPhotos: number;
    remoteKeptExchangePhotos: number;
  } | null;
  isRestoring: boolean;
  onRestore: () => void;
  onClose: () => void;
}) {
  return (
    <AppBottomSheet title="アカウントのデータがあります" onClose={onClose}>
      <div style={styles.accountRestoreBody}>
        <p style={styles.accountRestoreLead}>
          別の端末で保存した猫データを、この端末に復元できます。
        </p>
        {summary ? (
          <div style={styles.accountRestoreStats}>
            <span>猫 {summary.remoteCats}</span>
            <span>記録 {summary.remoteRecords}</span>
            <span>この子の写真 {summary.remoteCatGalleryPhotos}</span>
            <span>写真 {summary.remoteCollectionPhotos}</span>
            <span>とったねがお {summary.remoteOwnSleepingPhotos}</span>
            <span>とどいたねがお {summary.remoteKeptExchangePhotos}</span>
          </div>
        ) : null}
        <div style={styles.accountRestoreActions}>
          <button
            type="button"
            onClick={onRestore}
            disabled={isRestoring}
            style={styles.accountRestorePrimary}
          >
            {isRestoring ? "復元中..." : "復元する"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            style={styles.accountRestoreSecondary}
          >
            あとで
          </button>
        </div>
      </div>
    </AppBottomSheet>
  );
}

function CatSheet({
  profiles,
  activeCatId,
  onClose,
  onSelect,
}: {
  profiles: CatProfile[];
  activeCatId: string | null;
  onClose: () => void;
  onSelect: (catId: string) => void;
}) {
  return (
    <AppBottomSheet title="ねこを選ぶ" onClose={onClose}>
      <div style={styles.catList}>
        {profiles.map((profile) => {
          const isActive = profile.id === activeCatId;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              style={{
                ...styles.catListItem,
                ...(isActive ? styles.catListItemActive : {}),
              }}
            >
              <span style={styles.catListName}>{getCatName(profile)}</span>
              <span style={styles.catListMark}>{isActive ? "選択中" : ""}</span>
            </button>
          );
        })}
      </div>
    </AppBottomSheet>
  );
}
function HomeBulletinBoard({
  items,
  records,
  collectionPhotoCount,
  mikkeWindow,
  mikkeAnswer,
  mikkeResult,
  catName,
  catCounters,
  isMikkeResultLoading,
  mikkeRemaining,
  onAction,
  onMikkeAnswer,
  onOpenMikkeAll,
  mikkePhotoSlot,
  isMikkePhotoAdding,
  onMikkePhotoAdd,
  completion,
}: {
  items: HomeBoardItem[];
  records: RecordLogItem[];
  collectionPhotoCount: number;
  mikkeWindow: MikkeWindow;
  mikkeAnswer: StoredMikkeWindowAnswer | null;
  mikkeResult: MikkeWindowResult | null;
  catName: string;
  catCounters: HomeCatCounter[];
  isMikkeResultLoading: boolean;
  mikkeRemaining: string | null;
  onAction: HomeBoardActionHandler;
  onMikkeAnswer: (option: MikkeWindowOption) => void;
  onOpenMikkeAll: () => void;
  mikkePhotoSlot: CollectionSlot | null;
  isMikkePhotoAdding: boolean;
  onMikkePhotoAdd: (slot: CollectionSlot) => void;
  completion: HomeBoardCompletion | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const displayItems =
    items.length > 0
      ? items
      : [
          {
            id: "fallback",
            kind: "mission",
            priority: 999,
            title: "ねてるねこ",
            body: "写真",
            icon: "paw",
            actionLabel: "写真",
            actionType: "open_mikke",
            surfaceText: "写真",
          } satisfies HomeBoardItem,
        ];
  const peekItems = getBoardPeekItems(displayItems);
  const sleepingCounterItem = displayItems.find(
    (item) => item.id === "sleeping-counter",
  );
  const sleepingCounterCompletion =
    sleepingCounterItem && completion?.itemId === sleepingCounterItem.id
      ? completion
      : null;
  const sleepingCounterTitle = sleepingCounterItem?.title ?? "";
  const sleepingCounterValue =
    sleepingCounterCompletion?.title ??
    getBoardCounterPrimaryText(sleepingCounterItem?.surfaceText);
  const sleepingCounterSurfaceText =
    sleepingCounterCompletion?.surfaceText ??
    getBoardCounterSecondaryText(sleepingCounterItem?.surfaceText);

  useEffect(() => {
    if (completion) {
      setIsOpen(false);
    }
  }, [completion]);

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    setTouchStartY(event.touches[0]?.clientY ?? null);
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartY === null) return;

    const endY = event.changedTouches[0]?.clientY ?? touchStartY;
    const deltaY = endY - touchStartY;

    if (deltaY < -36) {
      setIsOpen(true);
    } else if (deltaY > 36) {
      setIsOpen(false);
    }
    setTouchStartY(null);
  }

  return (
    <section
      style={isOpen ? styles.boardExpanded : styles.boardPeek}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={isOpen ? () => setIsOpen(false) : undefined}
      aria-label={isOpen ? "うちの子らしさ" : "すぐ入れる"}
    >
      <div
        style={{
          ...styles.boardDockFrame,
          ...(isOpen ? styles.boardDockFrameHidden : styles.boardDockFrameVisible),
        }}
        aria-hidden={isOpen}
      >
          <span style={styles.boardDockShelfGlow} aria-hidden="true" />
          <button
            type="button"
            style={styles.boardDockHeader}
            onClick={() => setIsOpen(true)}
            aria-label="おすすめを開く"
          >
            <span style={styles.boardDockLiftHandle} aria-hidden="true" />
          </button>
          {sleepingCounterItem ? (
            <button
              type="button"
              disabled={sleepingCounterItem.isDisabled}
              style={{
                ...styles.boardSleepCounter,
                ...(sleepingCounterItem.isDisabled
                  ? styles.boardSleepCounterDisabled
                  : {}),
                ...(sleepingCounterCompletion
                  ? styles.boardSleepCounterCompleted
                  : {}),
              }}
              onClick={(event) => {
                onAction(
                  sleepingCounterItem.actionType,
                  getBoardTransitionSource(
                    event,
                    sleepingCounterItem,
                    sleepingCounterTitle,
                    `${sleepingCounterValue}・${sleepingCounterSurfaceText}`,
                  ),
                );
              }}
            >
              <span style={styles.boardSleepCounterIcon} aria-hidden="true">
                <BoardIcon
                  icon={sleepingCounterItem.icon}
                  size={22}
                  style={styles.boardSleepCounterIconSvg}
                />
              </span>
              <span style={styles.boardSleepCounterText}>
                <span style={styles.boardSleepCounterLabel}>
                  {sleepingCounterTitle}
                </span>
                <span style={styles.boardSleepCounterSub}>
                  {sleepingCounterSurfaceText}
                </span>
              </span>
              <span style={styles.boardSleepCounterValue}>
                {sleepingCounterValue}
              </span>
              {typeof sleepingCounterItem.cooldownProgress === "number" ? (
                <span style={styles.boardSleepCounterCountdown} aria-hidden="true">
                  <span style={styles.boardSleepCounterCountdownTrack} />
                  <span
                    style={{
                      ...styles.boardSleepCounterCountdownFill,
                      ...getBoardDockCountdownStyle(sleepingCounterItem),
                    }}
                  />
                </span>
              ) : null}
            </button>
          ) : null}
          <div style={styles.boardDock} aria-label="あなたへのおすすめ">
            {peekItems.map((item) => {
              const completed = completion?.itemId === item.id ? completion : null;
              const defaultTitle = item.title;
              const defaultSurfaceText = item.surfaceText;
              const displayTitle = completed?.title ?? defaultTitle;
              const displaySurfaceText =
                completed?.surfaceText ?? defaultSurfaceText ?? "";

              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.isDisabled}
                  style={{
                    ...styles.boardDockCard,
                    ...(item.isDisabled ? styles.boardCardDisabled : {}),
                    ...(completed ? styles.boardDockCardCompleted : {}),
                  }}
                  onClick={(event) => {
                    onAction(
                      item.actionType,
                      getBoardTransitionSource(
                        event,
                        item,
                        displayTitle,
                        displaySurfaceText,
                      ),
                    );
                  }}
                >
                  <span style={styles.boardDockText}>
                    <span style={styles.boardDockTitleRow}>
                      <span style={styles.boardDockIcon} aria-hidden="true">
                        <BoardIcon
                          icon={item.icon}
                          size={22}
                          style={styles.boardDockIconSvg}
                        />
                      </span>
                      <span style={styles.boardDockLabel}>{displayTitle}</span>
                    </span>
                    <span style={styles.boardDockSub}>{displaySurfaceText}</span>
                  </span>
                  {completed ? (
                    <span style={styles.boardCompletionMark}>
                      <svg
                        viewBox="0 0 24 24"
                        width="13"
                        height="13"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  ) : item.isUnread ? (
                    <span style={styles.boardUnreadDot} />
                  ) : null}
                  {typeof item.cooldownProgress === "number" ? (
                    <span style={styles.boardDockCountdown} aria-hidden="true">
                      <span style={styles.boardDockCountdownTrack} />
                      <span
                        style={{
                          ...styles.boardDockCountdownFill,
                          ...getBoardDockCountdownStyle(item),
                        }}
                      />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className="board-open-content"
          style={{
            ...styles.boardOpenContent,
            ...(isOpen
              ? styles.boardOpenContentVisible
              : styles.boardOpenContentHidden),
          }}
          onClick={(event) => event.stopPropagation()}
          aria-hidden={!isOpen}
        >
          <MikkeWindowCard
            window={mikkeWindow}
            answer={mikkeAnswer}
            result={mikkeResult}
            catName={catName}
            catCounters={catCounters}
            isResultLoading={isMikkeResultLoading}
            remaining={mikkeRemaining}
            onSelect={onMikkeAnswer}
            onOpenAll={onOpenMikkeAll}
            photoSlot={mikkePhotoSlot}
            isPhotoAdding={isMikkePhotoAdding}
            onAddPhoto={onMikkePhotoAdd}
          />
        </div>
      </section>
  );
}

function BoardShelfSummary({
  records,
  collectionPhotoCount,
}: {
  records: RecordLogItem[];
  collectionPhotoCount: number;
}) {
  const stats = buildBoardShelfStats(records, collectionPhotoCount);

  if (stats.length === 0) {
    return null;
  }

  return (
    <div style={styles.boardShelf}>
      <div style={styles.boardShelfGrid}>
        {stats.map((stat) => (
          <span key={stat.label} style={styles.boardShelfTile}>
            <span style={styles.boardShelfLabel}>{stat.label}</span>
            <span style={styles.boardShelfValue}>{stat.value}</span>
            <span style={styles.boardShelfDetail}>{stat.detail}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BoardNextPrompt({
  item,
  onAction,
}: {
  item: HomeBoardItem;
  onAction: HomeBoardActionHandler;
}) {
  return (
    <button
      type="button"
      disabled={item.isDisabled}
      style={{
        ...styles.boardNextCard,
        ...(item.isDisabled ? styles.boardActionRowDisabled : {}),
      }}
      onClick={() => onAction(item.actionType)}
    >
      <span style={styles.boardNextIcon} aria-hidden="true">
        <BoardIcon icon={item.icon} />
      </span>
      <span style={styles.boardNextText}>
        <span style={styles.boardNextKicker}>{item.title}</span>
        <span style={styles.boardNextTitle}>{item.surfaceText ?? item.body}</span>
        <span style={styles.boardNextBody}>{item.body}</span>
      </span>
    </button>
  );
}

function buildBoardShelfStats(
  records: RecordLogItem[],
  collectionPhotoCount: number,
): BoardShelfStat[] {
  const yousuCount = records.filter((record) => record.type === "yousu").length;
  const stats: BoardShelfStat[] = [];

  if (yousuCount > 0) {
    stats.push({
      icon: "paw",
      label: "写真",
      value: String(yousuCount),
      unit: "回",
      detail: "残った",
    });
  }

  if (collectionPhotoCount > 0) {
    stats.push({
      icon: "photo",
      label: "写真",
      value: String(collectionPhotoCount),
      unit: "枚",
      detail: "棚に",
    });
  }

  return stats;
}

function getBoardTransitionSource(
  event: MouseEvent<HTMLElement>,
  item: HomeBoardItem,
  title = item.title,
  surfaceText = item.surfaceText ?? item.body,
): HomeBoardTransitionSource {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    itemId: item.id,
    rect: {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    },
    title,
    surfaceText,
    icon: item.icon,
  };
}

function BoardIcon({
  icon,
  size = 30,
  style,
}: {
  icon: HomeBoardItem["icon"];
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <AppIcon
      name={icon}
      size={size}
      style={{ ...styles.boardIconSvg, ...style }}
    />
  );
}

function getBoardPeekItems(items: HomeBoardItem[]) {
  const orderedIds = ["today-mikke", "daily-collection-target"];
  const orderedItems = orderedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is HomeBoardItem => Boolean(item));

  if (orderedItems.length >= 2) {
    return orderedItems.slice(0, 2);
  }

  const fallbackItems = items.filter(
    (item) =>
      item.id !== "sleeping-counter" &&
      !orderedItems.some((orderedItem) => orderedItem.id === item.id),
  );

  return [...orderedItems, ...fallbackItems].slice(0, 2);
}

function getBoardDockCountdownStyle(item: HomeBoardItem): CSSProperties {
  if (typeof item.cooldownProgress !== "number") {
    return {};
  }

  const progress = Math.max(0, Math.min(1, item.cooldownProgress));

  return {
    transform: `scaleX(${progress})`,
  };
}

function getBoardCounterPrimaryText(surfaceText?: string) {
  return surfaceText?.split("・")[0] || "";
}

function getBoardCounterSecondaryText(surfaceText?: string) {
  const parts = surfaceText?.split("・") ?? [];

  if (parts.length <= 1) {
    return surfaceText ?? "";
  }

  return parts.slice(1).join("・");
}

function formatSleepingCounterCount(count: number) {
  return String(count);
}

async function sendPhotoReport(
  photo: ExchangePhoto,
  reason: ExchangePhotoReportReason,
) {
  const headers = new Headers({ "content-type": "application/json" });
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }
  }

  await fetch("/api/reports", {
    method: "POST",
    headers,
    body: JSON.stringify({
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId ?? null,
      anonymousId: getOrCreateReportAnonymousId(),
      reason,
    }),
  });
}

function getOrCreateReportAnonymousId() {
  try {
    return getOrCreateAnonymousId();
  } catch {
    return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function buildHomeCatCounters({
  mikkeWindow,
  mikkeAnswer,
  mikkeResult,
  recordLog,
}: {
  mikkeWindow: MikkeWindow;
  mikkeAnswer: StoredMikkeWindowAnswer | null;
  mikkeResult: MikkeWindowResult | null;
  recordLog: RecordLogItem[];
}): HomeCatCounter[] {
  const poseQuestion = MIKKE_WINDOW_QUESTIONS.find(
    (question) => question.category === "pose",
  );
  const placeQuestion = MIKKE_WINDOW_QUESTIONS.find(
    (question) => question.category === "place",
  );

  if (!poseQuestion || !placeQuestion) {
    return [];
  }

  const poseResult = getDisplayMikkeResult(
    poseQuestion,
    mikkeWindow,
    mikkeAnswer,
    mikkeResult,
  );
  const placeResult = getDisplayMikkeResult(
    placeQuestion,
    mikkeWindow,
    mikkeAnswer,
    mikkeResult,
  );
  const sleepingIds = new Set([
    "curled-up",
    "belly-up",
    "face-down-sleep",
    "side-sleep",
    "weird-sleep",
  ]);
  const localSleepingCount = recordLog.filter(
    (record) =>
      record.metadata?.homeCounterId === "sleeping" &&
      record.timestamp >= mikkeWindow.startsAt &&
      record.timestamp < mikkeWindow.endsAt,
  ).length;

  return [
    {
      id: "sleeping",
      label: "いま寝てる猫",
      count: sumCounts(poseResult, sleepingIds) + localSleepingCount,
    },
    {
      id: "window",
      label: "窓辺の猫",
      count: getCountByAnswerId(placeResult, "window"),
    },
    {
      id: "loaf",
      label: "ちょこん寝の猫",
      count: getCountByAnswerId(poseResult, "loaf"),
    },
  ];
}

function getDisplayMikkeResult(
  question: (typeof MIKKE_WINDOW_QUESTIONS)[number],
  currentWindow: MikkeWindow,
  answer: StoredMikkeWindowAnswer | null,
  currentResult: MikkeWindowResult | null,
) {
  if (question.id === currentWindow.question.id) {
    if (currentResult) {
      return currentResult;
    }

    const localCounts =
      answer?.questionId === question.id
        ? [
            {
              answerId: answer.answerId,
              answerLabel: answer.answerLabel,
              count: 1,
            },
          ]
        : [];

    return buildMikkeWindowResult(question, localCounts, currentWindow.id);
  }

  return buildMikkeWindowResult(
    question,
    [],
    `${question.id}-${new Date(currentWindow.startsAt).toISOString().slice(0, 13)}`,
  );
}

function addLocalAnswerCount(
  counts: MikkeWindowCount[],
  answer: StoredMikkeWindowAnswer | null,
) {
  if (!answer) {
    return counts;
  }

  let didIncrement = false;
  const nextCounts = counts.map((count) => {
    if (count.answerId !== answer.answerId) {
      return count;
    }

    didIncrement = true;
    return {
      ...count,
      count: count.count + 1,
    };
  });

  if (didIncrement) {
    return nextCounts;
  }

  return [
    ...nextCounts,
    {
      answerId: answer.answerId,
      answerLabel: answer.answerLabel,
      count: 1,
    },
  ];
}

function getVisibleMikkeResultCounts(
  counts: MikkeWindowResult["counts"],
  selectedAnswerId?: string,
) {
  const selected = selectedAnswerId
    ? counts.find((count) => count.answerId === selectedAnswerId)
    : null;
  const visible = counts.slice(0, 4);

  if (!selected || visible.some((count) => count.answerId === selected.answerId)) {
    return visible;
  }

  return [...visible.slice(0, 3), selected].sort((a, b) => b.count - a.count);
}

function sumCounts(
  result: MikkeWindowResult,
  answerIds: Set<string>,
) {
  return result.counts.reduce(
    (total, count) =>
      answerIds.has(count.answerId) ? total + count.count : total,
    0,
  );
}

function getCountByAnswerId(result: MikkeWindowResult, answerId: string) {
  return result.counts.find((count) => count.answerId === answerId)?.count ?? 0;
}

function selectTodayHomeCat({
  profiles,
  activeCatId,
  photos,
  dateKey,
}: {
  profiles: CatProfile[];
  activeCatId: string | null;
  photos: OwnSleepingPhoto[];
  dateKey: string;
}) {
  if (profiles.length === 0) {
    return null;
  }

  if (profiles.length === 1) {
    return profiles[0];
  }

  const fallbackProfile = getActiveCatProfile(profiles, activeCatId);

  if (!dateKey) {
    return fallbackProfile;
  }

  const stored = readStoredTodayHomeCatSelection();
  if (stored?.dateKey === dateKey) {
    const storedProfile = profiles.find((profile) => profile.id === stored.catId);
    if (storedProfile) {
      return storedProfile;
    }
  }

  const nextProfile = selectLeastRecentlyPhotographedCat(profiles, photos);
  saveStoredTodayHomeCatSelection({
    dateKey,
    catId: nextProfile.id,
  });

  return nextProfile;
}

function selectLeastRecentlyPhotographedCat(
  profiles: CatProfile[],
  photos: OwnSleepingPhoto[],
) {
  const latestPhotoByCat = new Map<string, number>();

  for (const photo of photos) {
    const catId = photo.ownerCatId ?? photo.catId;
    if (!catId) {
      continue;
    }

    latestPhotoByCat.set(
      catId,
      Math.max(latestPhotoByCat.get(catId) ?? 0, photo.createdAt ?? 0),
    );
  }

  return [...profiles].sort((left, right) => {
    const leftLatest = latestPhotoByCat.get(left.id) ?? -1;
    const rightLatest = latestPhotoByCat.get(right.id) ?? -1;

    if (leftLatest !== rightLatest) {
      return leftLatest - rightLatest;
    }

    return profiles.indexOf(left) - profiles.indexOf(right);
  })[0];
}

function readStoredTodayHomeCatSelection() {
  try {
    const parsed = readCachedJson<Partial<{
      dateKey: string;
      catId: string;
    }>>(HOME_TODAY_CAT_SELECTION_STORAGE_KEY);

    if (typeof parsed?.dateKey !== "string" || typeof parsed.catId !== "string") {
      return null;
    }

    return {
      dateKey: parsed.dateKey,
      catId: parsed.catId,
    };
  } catch {
    return null;
  }
}

function saveStoredTodayHomeCatSelection(selection: {
  dateKey: string;
  catId: string;
}) {
  try {
    window.localStorage.setItem(
      HOME_TODAY_CAT_SELECTION_STORAGE_KEY,
      JSON.stringify(selection),
    );
  } catch {
    // The home can still fall back to an in-memory selection when storage is full.
  }
}

function buildPersonalityInsight(
  recordLog: RecordLogItem[],
  catName: string,
): PersonalityInsight {
  const latestRecord = recordLog[0];
  const yousuRecords = recordLog.filter((record) => record.type === "yousu");
  const topYousu = getTopRecordValue(yousuRecords);

  if (!latestRecord) {
    return {
      title: "ねてるねこ",
      body: `${catName}の写真が、ここに少しずつ集まります。`,
      surfaceText: "これから",
      sheetBody:
        "最初から何かを分かろうとしなくて大丈夫です。見かけた姿が少しずつ増えると、あとからこの子らしさとして見返しやすくなります。",
    };
  }

  if (latestRecord.type === "mugi") {
    return {
      title: "ねてるねこ",
      body: `「${latestRecord.value}」のあとも、サインとして見返せます。`,
      surfaceText: "サイン",
      sheetBody:
        "お世話そのものより、そのとき猫に見えたサインを残す方が、この子らしさとして見返しやすくなります。",
    };
  }

  if (
    topYousu &&
    yousuRecords.length >= 5 &&
    topYousu.count >= 3 &&
    topYousu.count / yousuRecords.length >= 0.45
  ) {
    if (topYousu.value === "ねてる") {
      return {
        title: "ねてるねこ",
        body: "「ねてる」が少し多め。起きた直後があると、違いも残ります。",
        surfaceText: "違いを見る",
        sheetBody:
          "猫は寝ている時間が長いので、寝ている姿だけでは特徴になりにくいことがあります。起きた直後や移動した後が少し残ると、違いとして見返しやすくなります。",
      };
    }

    return {
      title: "ねてるねこ",
      body: `「${topYousu.value}」が何度か出ています。前後があると、比べやすくなります。`,
      surfaceText: "くり返し",
      sheetBody:
        "同じようすが何度か出てきたら、時間や直前の出来事が少しあるだけで、ただの回数より見返しやすくなります。",
    };
  }

  if (latestRecord.type === "yousu") {
    return {
      title: "ねてるねこ",
      body: `「${latestRecord.value}」が残っています。前後があると、あとで見やすくなります。`,
      surfaceText: "前後を見る",
      sheetBody:
        "ようすだけでも残りますが、前後に声をかけたか、なでたか、そっとしたかがあると、その日の流れとして見返しやすくなります。",
    };
  }

  if (recordLog.length >= 7) {
    return {
      title: "ねてるねこ",
      body: "場面が増えてきました。違う時間もあると、幅が残ります。",
      surfaceText: "幅を見る",
      sheetBody:
        "同じ場面だけでなく、少し違う時間や距離の姿もあると、あとから見たときに幅として残りやすくなります。",
    };
  }

  return {
    title: "ねてるねこ",
    body: `${catName}の違う場面も残ると、あとで見返しやすくなります。`,
    surfaceText: "少しずつ",
    sheetBody:
      "大きな変化を探さなくても大丈夫です。少し違う表情や距離感が残るだけで、あとから見返せるものになります。",
  };
}

function getTopRecordValue(records: RecordLogItem[]) {
  const counts = new Map<string, number>();

  for (const record of records) {
    counts.set(record.value, (counts.get(record.value) ?? 0) + 1);
  }

  let top: { value: string; count: number } | null = null;
  for (const [value, count] of counts.entries()) {
    if (!top || count > top.count) {
      top = { value, count };
    }
  }

  return top;
}

function buildHomeBoardItems({
  catName,
  discoveryAvailable,
  hasHomePhoto,
  recordLog,
  collectionTargetLabel,
  mikkeWindow,
  mikkeAnswer,
  homeCatCounters,
  mikkeRemaining,
  mikkeCooldownProgress,
  sleepingCounterRemaining,
  sleepingCounterCooldownProgress,
}: {
  catName: string;
  discoveryAvailable: boolean;
  hasHomePhoto: boolean;
  recordLog: RecordLogItem[];
  collectionTargetLabel: string | null;
  mikkeWindow: MikkeWindow;
  mikkeAnswer: StoredMikkeWindowAnswer | null;
  homeCatCounters: HomeCatCounter[];
  mikkeRemaining: string | null;
  mikkeCooldownProgress: number | null;
  sleepingCounterRemaining: string | null;
  sleepingCounterCooldownProgress: number | null;
}): HomeBoardItem[] {
  const items: HomeBoardItem[] = [];
  const sleepingCounter = homeCatCounters.find((counter) => counter.id === "sleeping");

  if (sleepingCounter) {
    items.push({
      id: "sleeping-counter",
      kind: "mission",
      priority: 7,
      title: "ねてるねこ",
      body: sleepingCounterRemaining
        ? `あと ${sleepingCounterRemaining}`
        : `${catName}も加わる`,
      icon: "sleep",
      actionLabel: sleepingCounterRemaining ? "待ち時間" : "加わる",
      actionType: "add_sleeping",
      surfaceText: sleepingCounterRemaining
        ? `${formatSleepingCounterCount(sleepingCounter.count)}・${catName}も加わった`
        : `${formatSleepingCounterCount(sleepingCounter.count)}・${catName}も加わる`,
      isDisabled: Boolean(sleepingCounterRemaining),
      cooldownProgress: sleepingCounterCooldownProgress ?? undefined,
    });
  }

  if (!hasHomePhoto) {
    items.push({
      id: "home-photo",
      kind: "mission",
      priority: 40,
      title: "写真を置く",
      body: "ホーム写真を設定",
      icon: "camera",
      actionLabel: "写真を選ぶ",
      actionType: "open_photo",
      surfaceText: "ホーム",
    });
  }

  if (collectionTargetLabel) {
    items.push({
      id: "daily-collection-target",
      kind: "collection",
      priority: 45,
      title: "今日の1枚",
      body: "写真を入れる",
      icon: "camera",
      actionLabel: "写真を入れる",
      actionType: "open_collection_photo",
      surfaceText: collectionTargetLabel,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

function getHomeCatThumbSrc(profile: CatProfile) {
  return (
    profile.avatarDataUrl ??
    profile.homePhotoDataUrl ??
    getCoatAvatarSrc(profile.appearance?.coat)
  );
}

function getCollectionSlotById(slotId?: string) {
  if (!slotId) return null;

  for (const group of COLLECTION_GROUPS) {
    const slot = group.slots.find((item) => item.id === slotId);
    if (slot) {
      return slot;
    }
  }

  return null;
}

function getCoatAvatarSrc(coat?: string) {
  const coatMap: Record<string, string> = {
    saba: "/sample-cats/saba.webp",
    gray: "/sample-cats/gray.webp",
    orange_tabby: "/sample-cats/orange_tabby.webp",
    black: "/sample-cats/black.webp",
    white: "/sample-cats/white.webp",
    calico: "/sample-cats/calico.webp",
    cream: "/sample-cats/saba.webp",
  };
  return coatMap[coat ?? ""] ?? "/sample-cats/saba.webp";
}

function readLockData(catId: string): LockData {
  try {
    return readCachedJson<LockData>(getLockDataKey(catId)) ?? {};
  } catch {
    return {};
  }
}

function saveLockData(catId: string, data: LockData) {
  // TODO: Supabase移行時はここを書き換え
  writeCachedJson(getLockDataKey(catId), data);
}

function readRecordLog(catId: string): RecordLogItem[] {
  try {
    return (readCachedJson<RecordLogItem[]>(getRecordLogKey(catId)) ?? []).sort(
      (a, b) => b.timestamp - a.timestamp,
    );
  } catch {
    return [];
  }
}

function saveRecord(
  catId: string,
  record: Omit<RecordLogItem, "id" | "timestamp">,
) {
  // TODO: Supabase移行時はここを書き換え
  const records = readRecordLog(catId);
  const nextRecord: RecordLogItem = {
    ...record,
    id: `record-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: Date.now(),
  };

  writeCachedJson(
    getRecordLogKey(catId),
    [nextRecord, ...records].slice(0, 200),
  );
}

function saveCollectionPhoto(catId: string, slug: string, dataUrl: string) {
  if (isReservedCollectionSlotSlug(slug)) {
    return;
  }

  try {
    const all =
      readCachedJson<Record<
        string,
        Record<string, StoredCollectionPhoto[] | StoredCollectionPhoto | string[] | string>
      >>(STORAGE_KEYS.collectionPhotos) ?? {};
    const photo: StoredCollectionPhoto = {
      id: createCollectionPhotoId(catId, slug),
      src: dataUrl,
      createdAt: new Date().toISOString(),
    };

    all[catId] ??= {};
    all[catId][slug] = [
      ...normalizeStoredPhotoList(all[catId][slug], catId, slug),
      photo,
    ];
    writeCachedJson(STORAGE_KEYS.collectionPhotos, all);
  } catch {
    // Keep the home flow usable even if local photo storage fails.
  }
}

function getPhotoThumbnailSrc(
  photo: Pick<OwnSleepingPhoto | ExchangePhoto, "src" | "thumbnailSrc" | "displaySrc">,
) {
  return photo.thumbnailSrc ?? photo.displaySrc ?? photo.src;
}

function getPhotoDetailSrc(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
) {
  return photo.displaySrc ?? photo.originalSrc ?? photo.thumbnailSrc ?? photo.src;
}

function getDeliveredPhotoDecodeKey(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "id" | "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
) {
  return [photo.id, ...getPhotoFallbackSrcs(photo)].join("|");
}

function getOrStartDeliveredPhotoDecode(
  cache: Map<string, DeliveredPhotoDecodeEntry>,
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "id" | "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
) {
  const key = getDeliveredPhotoDecodeKey(photo);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  let entry: DeliveredPhotoDecodeEntry;
  const promise = preloadDeliveredPhoto(photo).then((status) => {
    entry.status = status;
    return status;
  });
  entry = {
    status: "loading",
    promise,
  };
  cache.set(key, entry);
  return entry;
}

async function waitForDeliveredPhotoDecode(
  cache: Map<string, DeliveredPhotoDecodeEntry>,
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "id" | "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
  timeoutMs: number,
) {
  const entry = getOrStartDeliveredPhotoDecode(cache, photo);
  if (entry.status === "ready" || entry.status === "failed") {
    return entry.status;
  }

  return Promise.race([
    entry.promise,
    new Promise<DeliveredPhotoDecodeStatus>((resolve) => {
      window.setTimeout(() => resolve(entry.status), timeoutMs);
    }),
  ]);
}

async function preloadDeliveredPhoto(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
): Promise<DeliveredPhotoDecodeStatus> {
  const sources = getUniquePhotoSources([
    getPhotoDetailSrc(photo),
    ...getPhotoFallbackSrcs(photo),
  ]);

  for (const source of sources) {
    try {
      const resolvedSource = await getStoragePhotoSignedUrl(source);
      if (typeof resolvedSource !== "string" || !resolvedSource) {
        continue;
      }
      await decodeImageSource(resolvedSource);
      return "ready";
    } catch {
      // Try the next fallback source; the visible image path does the same.
    }
  }

  return "failed";
}

function getUniquePhotoSources(sources: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      sources.filter(
        (src): src is string => typeof src === "string" && src.trim().length > 0,
      ),
    ),
  );
}

async function decodeImageSource(src: string) {
  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image.src = src;

  if (typeof image.decode === "function") {
    await image.decode();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("image decode failed"));
  });
}

function getPhotoFallbackSrcs(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "thumbnailSrc" | "displaySrc" | "originalSrc"
  >,
) {
  return [photo.displaySrc, photo.thumbnailSrc, photo.originalSrc, photo.src].filter(
    (src): src is string => typeof src === "string" && src.trim().length > 0,
  );
}

function hasAcceptedSleepingSafetyNotice() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(SLEEPING_SAFETY_ACCEPTED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSleepingSafetyNoticeAccepted() {
  try {
    window.localStorage.setItem(SLEEPING_SAFETY_ACCEPTED_STORAGE_KEY, "1");
  } catch {
    // The notice is a gentle first-run guard; storage failure should not block use.
  }
}

function getHomeInstallPlatform(): HomeInstallPlatform | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (isInAppBrowser()) {
    return null;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIos =
    /iphone|ipad|ipod/.test(userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1);

  if (isIos) {
    return "ios";
  }

  if (/android/.test(userAgent)) {
    return "android";
  }

  return null;
}

function isInAppBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  return /instagram|fban|fbav|fb_iab|line\/|micromessenger|twitter|tiktok|bytedance|snapchat|pinterest/.test(
    userAgent,
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
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

type StoredCollectionPhoto = {
  id?: string;
  src?: string;
  createdAt?: string;
};

function normalizeStoredPhotoList(
  value: StoredCollectionPhoto[] | StoredCollectionPhoto | string[] | string | undefined,
  catId = "cat",
  slug = "photo",
) {
  if (typeof value === "string") {
    return [{ id: `${catId}:${slug}:0`, src: value }];
  }

  const values = Array.isArray(value) ? value : value ? [value] : [];

  return values
    .map((photo, index): StoredCollectionPhoto | null => {
      if (typeof photo === "string") {
        return photo ? { id: `${catId}:${slug}:${index}`, src: photo } : null;
      }

      if (photo && typeof photo.src === "string" && photo.src) {
        return {
          id: photo.id || `${catId}:${slug}:${index}`,
          src: photo.src,
          createdAt: photo.createdAt,
        };
      }

      return null;
    })
    .filter((photo): photo is StoredCollectionPhoto => Boolean(photo));
}

function createCollectionPhotoId(catId: string, slug: string) {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${catId}:${slug}:${random}`;
}

async function saveOwnSleepingPhotoWithCompressedFallback({
  catId,
  src,
  thumbnailSrc,
  displaySrc,
  originalSrc,
  triggerLabel,
  theme,
  shared,
}: {
  catId: string;
  src: string;
  thumbnailSrc?: string;
  displaySrc?: string;
  originalSrc?: string;
  triggerLabel: string;
  theme: string;
  shared: boolean;
}) {
  const triedSrcs = new Set<string>();
  const currentSavedCount = readOwnSleepingPhotos().length;
  const minRetainedCount = Math.min(currentSavedCount + 1, 12);
  const candidates = [
    src,
    ...(src.startsWith("data:image/")
      ? await Promise.all([
          resizeDataUrl(src, 420, 0.62),
          resizeDataUrl(src, 320, 0.54),
          resizeDataUrl(src, 240, 0.46),
          resizeDataUrl(src, 180, 0.4),
        ])
      : []),
  ];

  for (const candidateSrc of candidates) {
    if (!candidateSrc || triedSrcs.has(candidateSrc)) {
      continue;
    }

    triedSrcs.add(candidateSrc);
    const ownPhoto = saveOwnSleepingPhoto({
      catId,
      src: candidateSrc,
      thumbnailSrc,
      displaySrc,
      originalSrc,
      triggerLabel,
      theme,
      shared,
      minRetainedCount,
    });

    if (ownPhoto) {
      return ownPhoto;
    }
  }

  const didCompactExisting = await compactExistingOwnSleepingPhotos({
    minRetainedCount: Math.min(currentSavedCount, 12),
  });

  if (!didCompactExisting) {
    return null;
  }

  for (const candidateSrc of candidates) {
    if (!candidateSrc) {
      continue;
    }

    const ownPhoto = saveOwnSleepingPhoto({
      catId,
      src: candidateSrc,
      thumbnailSrc,
      displaySrc,
      originalSrc,
      triggerLabel,
      theme,
      shared,
      minRetainedCount,
    });

    if (ownPhoto) {
      return ownPhoto;
    }
  }

  return null;
}

async function compactExistingOwnSleepingPhotos({
  minRetainedCount,
}: {
  minRetainedCount: number;
}) {
  if (minRetainedCount <= 0) {
    return false;
  }

  const existingPhotos = readOwnSleepingPhotos();

  if (existingPhotos.length === 0) {
    return false;
  }

  const attempts = [
    { maxSize: 320, quality: 0.54 },
    { maxSize: 240, quality: 0.46 },
    { maxSize: 180, quality: 0.4 },
  ];

  for (const attempt of attempts) {
    const compactedPhotos = await Promise.all(
      existingPhotos.map(async (photo) => {
        if (!photo.src.startsWith("data:image/")) {
          return photo;
        }

        const compactedSrc = await resizeDataUrl(
          photo.src,
          attempt.maxSize,
          attempt.quality,
        );

        return compactedSrc ? { ...photo, src: compactedSrc } : photo;
      }),
    );
    const savedPhotos = writeOwnSleepingPhotosWithFallback(
      compactedPhotos,
      [24, 12, 6, 1],
      minRetainedCount,
    );

    if (savedPhotos.length >= minRetainedCount) {
      return true;
    }
  }

  return false;
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

function getFileSizeBucket(size: number) {
  if (size < 1_000_000) {
    return "small";
  }
  if (size < 5_000_000) {
    return "medium";
  }
  return "large";
}

async function createStoredPhotoVariantSet({
  file,
  pathSegments,
  fileName,
}: {
  file: File;
  pathSegments: string[];
  fileName: string;
}) {
  const [thumbnailDataUrl, displayDataUrl] = await Promise.all([
    resizeAndEncode(file, 512, 0.72, "image/webp"),
    resizeAndEncode(file, 2048, 0.84, "image/webp"),
  ]);
  const exchangeDataUrl =
    displayDataUrl.length <= 1_900_000
      ? displayDataUrl
      : await resizeAndEncode(file, 1200, 0.8, "image/webp");
  const storedDisplaySrc = await storeAccountPhotoDataUrl({
    dataUrl: displayDataUrl,
    pathSegments: [...pathSegments, "display"],
    fileName,
  });
  const canStoreVariants = isStoragePhotoReference(storedDisplaySrc);
  const thumbnailSrc = canStoreVariants
    ? await storeAccountPhotoDataUrl({
        dataUrl: thumbnailDataUrl,
        pathSegments: [...pathSegments, "thumbnail"],
        fileName,
      })
    : null;

  return {
    src: isStoragePhotoReference(storedDisplaySrc)
      ? storedDisplaySrc
      : exchangeDataUrl,
    exchangeSrc: exchangeDataUrl,
    ...(isStoragePhotoReference(storedDisplaySrc)
      ? { displaySrc: storedDisplaySrc }
      : {}),
    ...(thumbnailSrc && isStoragePhotoReference(thumbnailSrc)
      ? { thumbnailSrc }
      : {}),
  };
}

function isStoragePhotoReference(src: string | null | undefined) {
  return Boolean(src?.startsWith("storage:") || src?.startsWith("storage://"));
}

function resizeAndEncode(
  file: File,
  maxSize = 1200,
  quality = 0.86,
  mimeType = "image/jpeg",
): Promise<string> {
  assertSupportedSourceImage(file);

  return resizeImageFileToDataUrl(file, maxSize, quality, mimeType);
}

function assertSupportedSourceImage(file: File) {
  if (file.size > MAX_UPLOAD_SOURCE_FILE_BYTES) {
    throw new Error("Image file is too large");
  }

  if (file.type) {
    if (!SUPPORTED_SOURCE_IMAGE_MIME_TYPES.has(file.type.toLowerCase())) {
      throw new Error("Unsupported image file type");
    }

    return;
  }

  if (!/\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
    throw new Error("Unsupported image file type");
  }
}

function setLock(catId: string, type: LockType): LockData {
  const lockData = readLockData(catId);
  const field = type === "yousu" ? "yousuLockedUntil" : "mugiLockedUntil";
  const nextData = {
    ...lockData,
    [field]: Date.now() + MIKKE_LOCK_MS,
  };

  saveLockData(catId, nextData);
  return nextData;
}

function setMikkeCategoryLock(
  catId: string,
  category: MikkeWindowCategory,
): LockData {
  const lockData = readLockData(catId);
  const nextData: LockData = {
    ...lockData,
    mikkeCategoryLockedUntil: {
      ...lockData.mikkeCategoryLockedUntil,
      [category]: Date.now() + MIKKE_LOCK_MS,
    },
  };

  saveLockData(catId, nextData);
  return nextData;
}

function isMikkeCategoryLocked(
  lockData: LockData,
  category: MikkeWindowCategory,
  now = Date.now(),
) {
  return now < (lockData.mikkeCategoryLockedUntil?.[category] || 0);
}

function getMikkeCategoryRemainingTime(
  lockData: LockData,
  category: MikkeWindowCategory,
  now = Date.now(),
) {
  return formatRemainingMs(
    (lockData.mikkeCategoryLockedUntil?.[category] || 0) - now,
  );
}

function getMikkeCategoryRemainingMap(lockData: LockData, now = Date.now()) {
  return MIKKE_CATEGORIES.reduce(
    (remainingMap, category) => ({
      ...remainingMap,
      [category]: getMikkeCategoryRemainingTime(lockData, category, now),
    }),
    {} as Record<MikkeWindowCategory, string | null>,
  );
}

function buildMikkeCategoryLastLabels(records: RecordLogItem[]) {
  const labels: Record<MikkeWindowCategory, string | null> = {
    place: null,
    pose: null,
    sign: null,
  };

  for (const record of records) {
    const category = record.metadata?.mikkeCategory;

    if (!isMikkeCategory(category) || labels[category]) {
      continue;
    }

    labels[category] = record.value;
  }

  return labels;
}

function isMikkeCategory(value?: string): value is MikkeWindowCategory {
  return MIKKE_CATEGORIES.includes(value as MikkeWindowCategory);
}

function getAllMikkeCategoriesLockedRemaining(
  lockData: LockData,
  now = Date.now(),
) {
  const remainingMs = MIKKE_CATEGORIES.map(
    (category) => (lockData.mikkeCategoryLockedUntil?.[category] || 0) - now,
  );

  if (remainingMs.some((remaining) => remaining <= 0)) {
    return null;
  }

  return formatRemainingMs(Math.min(...remainingMs));
}

function getAllMikkeCategoriesCooldownProgress(
  lockData: LockData,
  now = Date.now(),
) {
  const remainingMs = MIKKE_CATEGORIES.map(
    (category) => (lockData.mikkeCategoryLockedUntil?.[category] || 0) - now,
  );

  if (remainingMs.some((remaining) => remaining <= 0)) {
    return null;
  }

  return Math.min(1, Math.min(...remainingMs) / MIKKE_LOCK_MS);
}

function shouldUseHighResolutionHomeClock(timestamp: number) {
  const hour = getJSTHour(timestamp);
  const minute = Number(
    new Intl.DateTimeFormat("ja-JP", {
      minute: "numeric",
      timeZone: "Asia/Tokyo",
    }).format(new Date(timestamp)),
  );

  return hour === 19 ? minute >= 58 : hour === 20 && minute <= 1;
}

function isLocked(lockData: LockData, type: LockType, now = Date.now()) {
  const field = type === "yousu" ? "yousuLockedUntil" : "mugiLockedUntil";
  return now < (lockData[field] || 0);
}

function getRemainingTime(lockData: LockData, type: LockType, now = Date.now()) {
  const field = type === "yousu" ? "yousuLockedUntil" : "mugiLockedUntil";
  return formatRemainingMs((lockData[field] || 0) - now);
}

function formatRemainingMs(remaining: number) {
  if (remaining <= 0) return null;
  const totalMinutes = Math.max(1, Math.ceil(remaining / 60000));

  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${hours}時間${minutes}分` : `${hours}時間`;
  }

  return `${totalMinutes}分`;
}

function getCooldownProgress(
  lockData: LockData,
  type: LockType,
  now = Date.now(),
) {
  const field = type === "yousu" ? "yousuLockedUntil" : "mugiLockedUntil";
  const remaining = (lockData[field] || 0) - now;

  if (remaining <= 0) {
    return null;
  }

  return Math.min(1, remaining / (60 * 60 * 1000));
}

function getTodayJST() {
  return new Date()
    .toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
}

function getJSTDate(timestamp: number) {
  return new Date(timestamp)
    .toLocaleDateString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\//g, "-");
}

function formatRecordTime(timestamp: number) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatRecordKind(type: RecordLogItem["type"]) {
  if (type === "yousu") return "ようす";
  if (type === "mugi") return "してあげた";
  return "反応";
}

function getJSTHour(timestamp: number) {
  const hourText = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));

  return Number(hourText);
}

function getYesterdayJST() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  utcDate.setUTCDate(utcDate.getUTCDate() - 1);

  return `${utcDate.getUTCFullYear()}-${String(
    utcDate.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(utcDate.getUTCDate()).padStart(2, "0")}`;
}

function getDiscoveryState(catId: string) {
  const now = Date.now();
  const jstHour = getJSTHour(now);

  if (jstHour < 5 || hasSeenDiscoveryToday(catId)) {
    return { available: false };
  }

  const yesterday = getYesterdayJST();
  const hasYesterdayRecord = readRecordLog(catId).some(
    (record) => getJSTDate(record.timestamp) === yesterday,
  );

  return { available: hasYesterdayRecord };
}

function hasSeenDiscoveryToday(catId: string) {
  try {
    const log = readCachedJson<string[]>(getDiscoveryLogKey(catId)) ?? [];
    return log.includes(getTodayJST());
  } catch {
    return false;
  }
}

function markDiscoverySeen(catId: string) {
  try {
    const log = readCachedJson<string[]>(getDiscoveryLogKey(catId)) ?? [];
    const today = getTodayJST();
    const nextLog = log.includes(today) ? log : [today, ...log];

    writeCachedJson(getDiscoveryLogKey(catId), nextLog.slice(0, 30));
  } catch {
    writeCachedJson(getDiscoveryLogKey(catId), []);
  }
}

function isAccountRestoreDismissed() {
  try {
    const raw = window.localStorage.getItem(
      STORAGE_KEYS.accountRestorePromptDismissed,
    );
    const dismissedAt = raw ? Number(raw) : 0;

    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) {
      return false;
    }

    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    return Date.now() - dismissedAt < sevenDays;
  } catch {
    return false;
  }
}

const homeBaseBackground = "var(--app-paper-background)";

const styles = {
  page: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: "auto",
    left: 0,
    width: "100%",
    height: "100vh",
    minHeight: "100vh",
    overflow: "hidden",
    background: homeBaseBackground,
    backgroundColor: "var(--paper-warm)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "#202020",
    fontFamily:
      'Outfit, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  startupPage: {
    position: "fixed",
    inset: 0,
    width: "100%",
    height: "100vh",
    minHeight: "100vh",
    overflow: "hidden",
    background: "#f4f1ea",
    color: "var(--ink-soft)",
    fontFamily:
      'Outfit, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  homeContentLayer: {
    display: "contents",
  },
  homeContentLayerObscured: {
    visibility: "hidden",
    pointerEvents: "none",
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    background: "var(--app-paper-background)",
    backgroundColor: "var(--paper-warm)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
  },
  paperNoise: {
    position: "fixed",
    inset: 0,
    zIndex: 1,
    pointerEvents: "none",
    opacity: 0.045,
    backgroundImage:
      "linear-gradient(90deg, rgba(88,73,50,0.035) 1px, transparent 1px), linear-gradient(0deg, rgba(88,73,50,0.03) 1px, transparent 1px)",
    backgroundSize: "28px 28px",
  },
  startupHold: {
    position: "fixed",
    inset: 0,
    zIndex: 18,
    display: "block",
    padding: "calc(env(safe-area-inset-top) + 24px) 24px calc(env(safe-area-inset-bottom) + 24px)",
    boxSizing: "border-box",
    color: "var(--ink-soft)",
    pointerEvents: "none",
    backgroundImage: "url('/splash/v6/apple-splash-1179-2556.png')",
    backgroundSize: "cover",
    backgroundPosition: "50% 50%",
    backgroundRepeat: "no-repeat",
  },
  homeInstallHintCard: {
    position: "fixed",
    left: "50%",
    bottom: "calc(98px + env(safe-area-inset-bottom))",
    zIndex: 17,
    width: HOME_NAV_FRAME_WIDTH,
    maxWidth: "calc(100vw - 32px)",
    boxSizing: "border-box",
    transform: "translateX(-50%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "11px",
    padding: "11px 12px 11px 14px",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
  },
  homeInstallHintText: {
    display: "grid",
    gap: "4px",
    minWidth: 0,
  },
  homeInstallHintTitle: {
    margin: 0,
    color: "#332c26",
    fontFamily:
      "var(--font-display)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0.04em",
  },
  homeInstallHintBody: {
    margin: 0,
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 440,
    lineHeight: 1.45,
    letterSpacing: "0.02em",
  },
  homeInstallHintActions: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexShrink: 0,
  },
  homeInstallHintPrimary: {
    minHeight: "34px",
    padding: "0 12px",
    borderRadius: "var(--radius-full)",
    border: "1px solid rgba(144,126,102,0.12)",
    background: "rgba(154,134,107,0.62)",
    color: "#fffdf8",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.03em",
    boxShadow: "0 3px 8px rgba(90,76,60,0.035)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  homeInstallHintSecondary: {
    minHeight: "34px",
    padding: "0 4px",
    border: "none",
    background: "transparent",
    color: "#9c9286",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  homeInstallGuideBody: {
    display: "grid",
    gap: "22px",
    padding: "4px 6px 8px",
  },
  homeInstallGuideList: {
    margin: 0,
    padding: "0 0 0 22px",
    color: "#4f463d",
    fontSize: "15px",
    lineHeight: 1.85,
    letterSpacing: "0.02em",
  },
  homeInstallGuideItem: {
    paddingLeft: "4px",
  },
  homeInstallGuideButton: {
    width: "100%",
    minHeight: "52px",
    borderRadius: "var(--radius-full)",
    border: "1px solid rgba(144,126,102,0.14)",
    background: "rgba(255,253,248,0.92)",
    color: "#332c26",
    fontSize: "15px",
    fontWeight: 500,
    letterSpacing: "0.03em",
    boxShadow: "0 10px 24px rgba(90,76,60,0.08)",
    cursor: "pointer",
  },
  boardPeek: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 18,
    width: "100%",
    height: "258px",
    padding: "0 0 calc(82px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    border: "none",
    borderRadius: 0,
    background:
      "linear-gradient(to top, rgba(239,229,214,0.86) 0%, rgba(247,240,229,0.58) 48%, rgba(247,240,229,0) 100%)",
    boxShadow: "none",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    transition:
      "height 0.52s cubic-bezier(0.22, 1, 0.36, 1), background 0.52s cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "height, background",
  },
  boardExpanded: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 18,
    width: "100%",
    height: "64dvh",
    maxHeight: "580px",
    padding: "0 0 calc(82px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    border: "none",
    borderRadius: 0,
    background:
      "linear-gradient(to top, rgba(246,238,224,0.98) 0%, rgba(250,246,238,0.92) 58%, rgba(250,246,238,0.5) 84%, rgba(250,246,238,0) 100%)",
    boxShadow: "none",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    overflow: "hidden",
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    transition:
      "height 0.52s cubic-bezier(0.22, 1, 0.36, 1), background 0.52s cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "height, background",
    cursor: "pointer",
  },
  boardRailFrame: {
    width: HOME_NAV_FRAME_WIDTH,
    margin: "0 auto",
    overflow: "visible",
  },
  boardRail: {
    width: `calc(100vw - ${HOME_NAV_EDGE_INSET})`,
    margin: 0,
    boxSizing: "border-box",
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    scrollbarWidth: "none",
    padding: "0 0 10px",
    scrollSnapType: "x mandatory",
    overscrollBehaviorX: "contain",
  },
  boardDockFrame: {
    width: HOME_NAV_FRAME_WIDTH,
    margin: 0,
    overflow: "visible",
    position: "absolute",
    left: "50%",
    bottom: "calc(76px + env(safe-area-inset-bottom))",
    transition:
      "opacity 0.24s ease-out, transform 0.44s cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "opacity, transform",
  },
  boardDockFrameVisible: {
    opacity: 1,
    transform: "translateX(-50%) translate3d(0, 0, 0) scale(1)",
    pointerEvents: "auto",
    transitionDelay: "0.12s",
  },
  boardDockFrameHidden: {
    opacity: 0,
    transform: "translateX(-50%) translate3d(0, 34px, 0) scale(0.985)",
    pointerEvents: "none",
    transitionDelay: "0s",
  },
  boardDockShelfGlow: {
    position: "absolute",
    left: "-8px",
    right: "-8px",
    bottom: "-2px",
    height: "178px",
    borderRadius: "var(--radius-2xl)",
    background:
      "radial-gradient(ellipse at 50% 100%, rgba(151,128,96,0.2), rgba(151,128,96,0.08) 48%, rgba(151,128,96,0) 76%)",
    filter: "blur(18px)",
    opacity: 0.58,
    pointerEvents: "none",
    zIndex: 0,
  },
  boardDockHeader: {
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "18px",
    padding: "0 0 7px",
    margin: 0,
    cursor: "pointer",
    position: "relative",
    zIndex: 2,
  },
  boardDockLiftHandle: {
    width: "40px",
    height: "3px",
    borderRadius: "var(--radius-full)",
    background: "rgba(143,126,100,0.32)",
    boxShadow: "0 1px 8px rgba(143,126,100,0.08)",
  },
  boardSleepCounter: {
    width: "100%",
    minHeight: "70px",
    border: "1px solid rgba(144,126,102,0.16)",
    borderRadius: "var(--radius-xl)",
    background:
      "linear-gradient(145deg, rgba(255,253,248,0.92), rgba(246,238,224,0.86))",
    color: "#332c26",
    display: "grid",
    gridTemplateColumns: "24px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "9px",
    padding: "11px 14px 14px",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
    position: "relative",
    zIndex: 2,
    margin: "0 0 9px",
    overflow: "hidden",
    isolation: "isolate",
    backdropFilter: "blur(26px)",
    WebkitBackdropFilter: "blur(26px)",
    boxShadow:
      "0 10px 28px rgba(90,76,60,0.08), inset 0 1px 0 rgba(255,255,255,0.74)",
    transition:
      "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
    animation: "boardCardSettle 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both",
    willChange: "transform, opacity",
  },
  boardSleepCounterCompleted: {
    transform: "translateY(-2px) scale(1.012)",
    border: "1px solid rgba(144,126,102,0.24)",
    background:
      "linear-gradient(145deg, rgba(255,253,248,0.98), rgba(239,229,214,0.92))",
  },
  boardSleepCounterDisabled: {
    cursor: "default",
    opacity: 0.9,
  },
  boardSleepCounterIcon: {
    width: "24px",
    height: "24px",
    borderRadius: 0,
    background: "transparent",
    color: "#8e7a63",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "none",
  },
  boardSleepCounterIconSvg: {
    width: "20px",
    height: "20px",
    strokeWidth: 1.9,
  },
  boardSleepCounterText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    position: "relative",
    zIndex: 2,
  },
  boardSleepCounterLabel: {
    color: "#332c26",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.18,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textShadow: "none",
  },
  boardSleepCounterSub: {
    color: "#746a5f",
    fontSize: "11.2px",
    fontWeight: 430,
    lineHeight: 1.16,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    textShadow: "none",
  },
  boardSleepCounterValue: {
    color: "#332c26",
    fontSize: "19px",
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: 0,
    fontVariantNumeric: "tabular-nums",
    whiteSpace: "nowrap",
    textShadow: "none",
    position: "relative",
    zIndex: 2,
  },
  boardSleepCounterCountdown: {
    position: "absolute",
    left: "14px",
    right: "14px",
    bottom: "8px",
    height: "3px",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 2,
  },
  boardSleepCounterCountdownTrack: {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    background: "rgba(142,122,99,0.14)",
  },
  boardSleepCounterCountdownFill: {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    background:
      "linear-gradient(90deg, rgba(169,149,126,0.58), rgba(142,122,99,0.78))",
    transformOrigin: "left center",
    transition: "transform 0.42s cubic-bezier(0.2, 0.8, 0.2, 1)",
  },
  boardDock: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
    alignItems: "stretch",
    overflowX: "visible",
    overflowY: "visible",
    scrollbarWidth: "none",
    padding: "0 0 8px",
    boxSizing: "border-box",
    scrollSnapType: "none",
    overscrollBehaviorX: "contain",
    position: "relative",
    zIndex: 1,
  },
  boardOpenContent: {
    width: HOME_NAV_FRAME_WIDTH,
    maxHeight: "100%",
    overflowY: "auto",
    overscrollBehavior: "contain",
    WebkitOverflowScrolling: "touch",
    padding: "0 0 2px",
    boxSizing: "border-box",
    cursor: "default",
    transition:
      "opacity 0.34s ease-out, transform 0.52s cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "opacity, transform",
  },
  boardOpenContentVisible: {
    opacity: 1,
    transform: "translate3d(0, 0, 0) scale(1)",
    pointerEvents: "auto",
    transitionDelay: "0.08s",
  },
  boardOpenContentHidden: {
    opacity: 0,
    transform: "translate3d(0, 34px, 0) scale(0.985)",
    pointerEvents: "none",
    transitionDelay: "0s",
  },
  boardHeroCard: {
    width: "100%",
    border: "none",
    borderRadius: "var(--radius-lg)",
    background: "transparent",
    color: "#332c26",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "7px",
    padding: "3px 5px 12px",
    marginBottom: "2px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow: "none",
  },
  boardHeroKickerRow: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  boardHeroBadge: {
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "var(--radius-full)",
    color: "rgba(255,255,255,0.74)",
    fontSize: "12px",
    fontWeight: 500,
    padding: "3px 8px",
  },
  boardHeroKicker: {
    color: "rgba(255,255,255,0.64)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  boardHeroStatement: {
    color: "rgba(255,255,255,0.92)",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.58,
  },
  boardSectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "4px 2px 8px",
  },
  boardSectionTitle: {
    color: "rgba(255,255,255,0.58)",
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: 0,
  },
  boardShelf: {
    margin: "0 auto 11px",
    width: "min(100%, 372px)",
  },
  boardShelfGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "16px",
    alignItems: "center",
    background: "transparent",
  },
  boardShelfTile: {
    minWidth: 0,
    minHeight: "78px",
    border: "0.5px solid rgba(86,78,64,0.18)",
    borderRadius: "8px",
    background: "rgba(255,255,255,0.54)",
    color: "#2b2924",
    display: "grid",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "11px 8px",
    boxSizing: "border-box",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "0 8px 22px rgba(72,61,43,0.06)",
  },
  boardShelfLabel: {
    color: "#756f64",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  boardShelfValue: {
    color: "#23211d",
    fontSize: "24px",
    fontWeight: 500,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
  },
  boardShelfDetail: {
    color: "#7f786d",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  boardNextCard: {
    width: "100%",
    minHeight: "88px",
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "var(--radius-xl)",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.075))",
    color: "rgba(255,255,255,0.94)",
    display: "grid",
    gridTemplateColumns: "42px 1fr",
    alignItems: "center",
    gap: "12px",
    padding: "13px 14px",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
    backdropFilter: "blur(22px)",
    WebkitBackdropFilter: "blur(22px)",
    boxShadow:
      "0 10px 26px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  boardNextIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.88)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
  },
  boardNextText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  boardNextKicker: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  boardNextTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.22,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  boardNextBody: {
    color: "rgba(255,255,255,0.56)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  boardQuickActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "9px",
    margin: "0 0 16px",
  },
  boardQuickAction: {
    minHeight: "58px",
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.09)",
    color: "rgba(255,255,255,0.94)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  boardQuickIcon: {
    width: "28px",
    height: "28px",
    color: "rgba(255,255,255,0.9)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boardQuickText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  boardQuickTitle: {
    color: "rgba(255,255,255,0.94)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  boardQuickSub: {
    color: "rgba(255,255,255,0.52)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  boardCard: {
    position: "relative",
    width: "min(156px, calc((100vw - 44px) / 2))",
    minWidth: "min(156px, calc((100vw - 44px) / 2))",
    minHeight: "98px",
    border: "0.5px solid rgba(255,255,255,0.22)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(42,36,34,0.44)",
    color: "rgba(255,255,255,0.94)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "10px",
    padding: "13px 12px",
    textAlign: "left",
    cursor: "pointer",
    scrollSnapAlign: "start",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    boxShadow:
      "0 10px 28px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.14)",
  },
  boardCardPrimary: {
    background: "rgba(54,47,43,0.5)",
  },
  boardDockCard: {
    position: "relative",
    width: "100%",
    minWidth: 0,
    minHeight: "68px",
    border: "1px solid rgba(144,126,102,0.14)",
    borderRadius: "var(--radius-lg)",
    background:
      "linear-gradient(145deg, rgba(255,253,248,0.9), rgba(246,238,224,0.76))",
    color: "#332c26",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: "0",
    padding: "10px 11px 13px",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
    scrollSnapAlign: "start",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    overflow: "visible",
    isolation: "isolate",
    boxShadow:
      "0 8px 22px rgba(90,76,60,0.07), inset 0 1px 0 rgba(255,255,255,0.7)",
    transition:
      "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
    animation: "boardCardSettle 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both",
    willChange: "transform, opacity",
    zIndex: 1,
  },
  boardDockCardCompleted: {
    transform: "translateY(-2px) scale(1.015)",
    border: "1px solid rgba(144,126,102,0.22)",
    background:
      "linear-gradient(145deg, rgba(255,253,248,0.98), rgba(239,229,214,0.9))",
  },
  boardCardDisabled: {
    cursor: "default",
    opacity: 0.84,
  },
  boardDockTop: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "26px",
    position: "relative",
    zIndex: 2,
  },
  boardDockIcon: {
    width: "20px",
    height: "20px",
    color: "#8e7a63",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boardCompletionMark: {
    position: "absolute",
    top: "10px",
    right: "10px",
    width: "21px",
    height: "21px",
    borderRadius: "50%",
    background: "rgba(169,149,126,0.9)",
    color: "#fffdf8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 4px rgba(169,149,126,0.12)",
  },
  boardIconSvg: {
    width: "28px",
    height: "28px",
    display: "block",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.1,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  boardDockIconSvg: {
    width: "20px",
    height: "20px",
    strokeWidth: 2.05,
  },
  boardDockText: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    position: "relative",
    zIndex: 2,
  },
  boardDockTitleRow: {
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  boardDockLabel: {
    color: "#332c26",
    fontSize: "12.8px",
    fontWeight: 500,
    lineHeight: 1.22,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflowWrap: "anywhere",
    textShadow: "none",
  },
  boardDockSub: {
    color: "#746a5f",
    fontSize: "11.2px",
    fontWeight: 430,
    lineHeight: 1.18,
    fontVariantNumeric: "tabular-nums",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    textShadow: "none",
  },
  boardUnreadDot: {
    position: "absolute",
    top: "13px",
    right: "13px",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "rgba(169,149,126,0.9)",
    boxShadow: "0 0 0 3px rgba(169,149,126,0.12)",
    flexShrink: 0,
  },
  boardDockCountdown: {
    position: "absolute",
    left: "12px",
    right: "12px",
    bottom: "9px",
    height: "3px",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: 2,
    animation: "boardCountdownRestEnter 0.32s cubic-bezier(0.2, 0.8, 0.2, 1) both",
  },
  boardDockCountdownTrack: {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    background: "rgba(142,122,99,0.14)",
  },
  boardDockCountdownFill: {
    position: "absolute",
    inset: 0,
    borderRadius: "inherit",
    background:
      "linear-gradient(90deg, rgba(169,149,126,0.58), rgba(142,122,99,0.76))",
    transformOrigin: "left center",
    transition: "transform 0.42s cubic-bezier(0.2, 0.8, 0.2, 1)",
  },
  boardActionList: {
    display: "grid",
    gap: "7px",
    marginBottom: "14px",
  },
  boardActionRow: {
    width: "100%",
    border: "1px solid rgba(144,126,102,0.12)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.72)",
    color: "#332c26",
    display: "grid",
    gridTemplateColumns: "64px 1fr auto",
    alignItems: "center",
    gap: "8px",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
  },
  boardActionRowDisabled: {
    cursor: "default",
    opacity: 0.58,
  },
  boardActionLabel: {
    color: "#aaa096",
    fontSize: "12px",
    fontWeight: 500,
  },
  boardActionTitle: {
    color: "#332c26",
    fontSize: "13px",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  boardLatestMemo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    borderTop: "1px solid rgba(144,126,102,0.12)",
    margin: "8px 0 0",
    padding: "12px 2px 0",
  },
  boardLatestMemoLabel: {
    flexShrink: 0,
    color: "#aaa096",
    fontSize: "12px",
    fontWeight: 500,
  },
  boardLatestMemoValue: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 590,
  },
  boardMemoList: {
    display: "grid",
    gap: "6px",
  },
  boardMemoRow: {
    display: "grid",
    gridTemplateColumns: "42px 70px 1fr",
    gap: "8px",
    alignItems: "center",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,253,248,0.66)",
    padding: "8px 10px",
  },
  boardMemoTime: {
    color: "#aaa096",
    fontSize: "12px",
    fontWeight: 500,
  },
  boardMemoKind: {
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 500,
  },
  boardMemoValue: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#332c26",
    fontSize: "12px",
    fontWeight: 500,
  },
  boardEmptyText: {
    margin: "0 2px",
    color: "#746a5f",
    fontSize: "12px",
    lineHeight: 1.6,
    fontWeight: 500,
  },
  lockedState: {
    pointerEvents: "none",
    border: "0.5px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.58)",
  },
  sleepingTopBar: {
    position: "fixed",
    top: "calc(32px + env(safe-area-inset-top))",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 22,
    color: "#6b6257",
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 400,
    letterSpacing: "0.16em",
    lineHeight: 1.34,
    pointerEvents: "none",
    whiteSpace: "nowrap",
  },
  sleepingTopBarHidden: {
    display: "none",
  },
  sleepingHome: {
    position: "fixed",
    inset: 0,
    zIndex: 18,
    color: "#39332d",
    pointerEvents: "none",
    textAlign: "center",
  },
  sleepingHomeHeader: {
    position: "fixed",
    top: "calc(clamp(132px, 21dvh, 188px) + env(safe-area-inset-top))",
    left: "50%",
    zIndex: 18,
    width: HOME_NAV_FRAME_WIDTH,
    transform: "translateX(-50%)",
    display: "grid",
    gap: "10px",
    padding: "0 16px",
    boxSizing: "border-box",
    pointerEvents: "none",
  },
  sleepingHomeKicker: {
    margin: 0,
    color: "#6f665a",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  sleepingHomeTitle: {
    margin: 0,
    color: "#202020",
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    fontWeight: 500,
    lineHeight: 1.42,
    letterSpacing: "0.08em",
  },
  sleepingHomeLead: {
    margin: "8px 0 0",
    color: "#6a6258",
    fontFamily: "var(--font-display)",
    fontSize: "15px",
    fontWeight: 400,
    lineHeight: 1.55,
    letterSpacing: "0.06em",
  },
  dayCycleStatic: {
    justifySelf: "center",
    marginTop: "24px",
    display: "inline-grid",
    gridTemplateColumns: "44px 66px 44px",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    border: "none",
    background: "transparent",
    color: "#746b5f",
    pointerEvents: "none",
  },
  clockLegacyPlaceholderTitle: {
    justifySelf: "center",
    width: "11em",
    height: "36px",
    borderRadius: "var(--radius-full)",
    background: "var(--paper)",
    border: "1px solid var(--line)",
  },
  clockLegacyPlaceholderLead: {
    justifySelf: "center",
    width: "17em",
    maxWidth: "80%",
    height: "22px",
    borderRadius: "var(--radius-full)",
    background: "var(--paper)",
    border: "1px solid var(--line)",
  },
  clockLegacyPlaceholderMotif: {
    justifySelf: "center",
    marginTop: "24px",
    display: "inline-grid",
    gridTemplateColumns: "44px 66px 44px",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    opacity: 0.62,
  },
  clockLegacyPlaceholderCircle: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "1px solid var(--line)",
    background: "var(--paper)",
  },
  clockLegacyPlaceholderDots: {
    justifySelf: "center",
    width: "48px",
    height: "4px",
    borderRadius: "var(--radius-full)",
    background:
      "repeating-linear-gradient(90deg, var(--ink-faint) 0 4px, transparent 4px 11px)",
  },
  dayCycleButton: {
    justifySelf: "center",
    marginTop: "24px",
    display: "inline-grid",
    gridTemplateColumns: "44px 66px 44px",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    border: "none",
    background: "transparent",
    color: "#746b5f",
    cursor: "pointer",
    pointerEvents: "auto",
    padding: 0,
  },
  dayCycleReserveSubcopySpace: {
    marginTop: "55px",
  },
  dayCycleCircle: {
    width: "44px",
    height: "44px",
    borderRadius: "var(--radius-full)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    border: "1px solid rgba(120,108,94,0.22)",
    background: "rgba(255,253,248,0.18)",
    color: "#8b8173",
    overflow: "hidden",
  },
  dayCycleCircleFilled: {
    background: "rgba(151,140,120,0.78)",
    borderColor: "rgba(120,108,94,0.08)",
    color: "rgba(255,255,255,0.92)",
  },
  dayCycleEnvelope: {
    borderColor: "rgba(153,53,86,0.16)",
    color: "rgba(153,53,86,0.38)",
  },
  dayCycleEnvelopeWaiting: {
    borderColor: "rgba(153,53,86,0.24)",
    color: "rgba(153,53,86,0.5)",
  },
  dayCycleEnvelopeFilled: {
    background: "rgba(153,53,86,0.82)",
    borderColor: "rgba(153,53,86,0.08)",
    color: "rgba(255,255,255,0.93)",
  },
  dayCycleDots: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
  },
  dayCycleDot: {
    width: "5px",
    height: "5px",
    borderRadius: "var(--radius-full)",
    background: "#8e806e",
    opacity: 0.3,
  },
  dayCycleDotStrong: {
    opacity: 0.72,
  },
  sleepingFlow: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    justifySelf: "center",
    marginTop: "6px",
    color: "#8b8173",
  },
  sleepingFlowIcon: {
    width: "44px",
    height: "44px",
    borderRadius: "var(--radius-full)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(239,229,214,0.78)",
    color: "#746b5f",
    border: "1px solid rgba(120,108,94,0.12)",
  },
  sleepingFlowIconAccent: {
    width: "44px",
    height: "44px",
    borderRadius: "var(--radius-full)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(244,228,221,0.76)",
    color: "#b98678",
    border: "1px solid rgba(178,132,116,0.12)",
  },
  sleepingFlowDots: {
    width: "62px",
    height: "2px",
    borderRadius: "var(--radius-full)",
    background:
      "repeating-linear-gradient(90deg, rgba(142,128,110,0.42) 0 4px, transparent 4px 10px)",
  },
  sleepingActionGroup: {
    position: "fixed",
    top: "calc(clamp(334px, 43dvh, 398px) + env(safe-area-inset-top))",
    left: "50%",
    zIndex: 19,
    transform: "translateX(-50%)",
    display: "grid",
    justifyItems: "center",
    gap: "16px",
    pointerEvents: "auto",
  },
  sleepingBoxStack: {
    display: "grid",
    gap: "10px",
  },
  sleepingBoxPrimary: {
    position: "relative",
    overflow: "hidden",
    display: "grid",
    gap: "6px",
    minHeight: "176px",
    border: "0.5px solid rgba(255,255,255,0.22)",
    borderRadius: "var(--radius-2xl)",
    background:
      "linear-gradient(145deg, rgba(49,44,40,0.76), rgba(23,21,19,0.9))",
    padding: "16px",
    boxSizing: "border-box",
    boxShadow:
      "0 18px 48px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.16)",
    backdropFilter: "blur(28px)",
    WebkitBackdropFilter: "blur(28px)",
  },
  sleepingBoxSecondary: {
    display: "grid",
    gap: "4px",
    minHeight: "122px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-xl)",
    background: "rgba(23,21,19,0.58)",
    padding: "14px 16px",
    boxSizing: "border-box",
    boxShadow: "0 14px 32px rgba(0,0,0,0.24)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
  },
  sleepingBoxTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  sleepingBoxLabel: {
    color: "rgba(255,255,255,0.68)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  sleepingBoxCount: {
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  sleepingBoxClosed: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.58)",
    fontSize: "12px",
    fontWeight: 500,
  },
  sleepingBoxLead: {
    margin: "10px 0 0",
    color: "rgba(255,255,255,0.96)",
    fontSize: "19px",
    fontWeight: 500,
    lineHeight: 1.25,
  },
  sleepingBoxSub: {
    margin: 0,
    color: "rgba(255,255,255,0.7)",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.32,
  },
  sleepingBoxNote: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.48)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  sleepingPhotoButton: {
    justifySelf: "center",
    width: "148px",
    height: "148px",
    border: "1px solid rgba(146,124,91,0.12)",
    borderRadius: "50%",
    background:
      "radial-gradient(circle at 50% 22%, rgba(255,255,255,0.09), rgba(255,255,255,0) 38%), radial-gradient(circle at 50% 54%, rgba(196,184,164,0.96), rgba(180,164,138,0.94))",
    color: "#f2eadc",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
    boxShadow:
      "0 0 0 9px rgba(255,255,255,0.58), 0 14px 26px rgba(119,101,73,0.1), inset 0 4px 12px rgba(0,0,0,0.06), inset 0 1px 4px rgba(255,255,255,0.08)",
  },
  sleepingLibraryButton: {
    position: "fixed",
    top: "calc(clamp(118px, 18dvh, 174px) + env(safe-area-inset-top))",
    right: HOME_NAV_EDGE_INSET,
    zIndex: 24,
    border: "0.5px solid rgba(86,78,64,0.12)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.42)",
    color: "#8a8174",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
    padding: "5px 9px",
    pointerEvents: "auto",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
  },
  sleepingDeliveryChip: {
    minHeight: "26px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 11px",
    border: "0.5px solid rgba(95,82,62,0.1)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.34)",
    color: "#8a8174",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
  },
  sleepingWaitingContent: {
    display: "grid",
    justifyItems: "center",
    gap: "18px",
    marginTop: "18px",
  },
  sleepingTodayPhotoArea: {
    width: "min(54vw, 216px)",
    display: "grid",
    justifyItems: "center",
    gap: "9px",
    pointerEvents: "none",
  },
  sleepingTodayPhoto: {
    width: "100%",
    aspectRatio: "1 / 1",
    height: "auto",
    objectFit: "cover",
    display: "block",
    borderRadius: "30px",
    overflow: "hidden",
    border: "8px solid rgba(255,253,248,0.72)",
    background: "rgba(255,253,248,0.58)",
    boxShadow: "0 16px 38px rgba(96,78,54,0.12)",
  },
  sleepingTodayPhotoLabel: {
    margin: 0,
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
  },
  sleepingWaitingSecondaryActionGroup: {
    display: "grid",
    justifyItems: "center",
    gap: "14px",
    width: "min(calc(100vw - 48px), 360px)",
    pointerEvents: "none",
  },
  sleepingEnvelopeButton: {
    position: "fixed",
    top: "calc(clamp(338px, 44dvh, 410px) + env(safe-area-inset-top))",
    left: "50%",
    zIndex: 19,
    transform: "translateX(-50%)",
    display: "grid",
    placeItems: "center",
    gap: "12px",
    width: "150px",
    height: "150px",
    border: "1px solid rgba(178,132,116,0.14)",
    borderRadius: "var(--radius-full)",
    background: "rgba(244,228,221,0.72)",
    color: "#b98678",
    boxShadow:
      "0 0 0 12px rgba(255,253,248,0.44), 0 16px 34px rgba(110,86,60,0.09)",
    cursor: "pointer",
    pointerEvents: "auto",
    fontSize: "13px",
    fontWeight: 500,
  },
  sleepingSecondaryActionGroup: {
    position: "fixed",
    left: "50%",
    top: "calc(clamp(558px, 68dvh, 620px) + env(safe-area-inset-top))",
    zIndex: 19,
    transform: "translateX(-50%)",
    display: "grid",
    justifyItems: "center",
    gap: "16px",
    width: "min(calc(100vw - 48px), 360px)",
    pointerEvents: "none",
  },
  sleepingSecondaryPhotoButton: {
    minHeight: "44px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 8px",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    color: "#8a8174",
    boxShadow: "none",
    cursor: "pointer",
    pointerEvents: "auto",
    fontSize: "12px",
    fontWeight: 500,
  },
  sleepingPairCard: {
    position: "fixed",
    top: "calc(clamp(314px, 42dvh, 388px) + env(safe-area-inset-top))",
    left: "50%",
    zIndex: 19,
    transform: "translateX(-50%)",
    width: "min(calc(100vw - 62px), 340px)",
    display: "grid",
    gridTemplateColumns: "1fr 28px 1fr",
    alignItems: "center",
    gap: 0,
    pointerEvents: "none",
  },
  sleepingPairTile: {
    width: "100%",
    display: "grid",
    gap: "8px",
    justifyItems: "center",
  },
  sleepingPairImage: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "20px",
    objectFit: "cover",
    overflow: "hidden",
    border: "6px solid color-mix(in srgb, var(--paper) 88%, transparent)",
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    boxShadow:
      "0 2px 8px rgba(70,50,30,0.10), 0 18px 34px -18px rgba(70,50,30,0.24)",
  },
  sleepingPairLabel: {
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
  },
  sleepingPairDots: {
    width: "22px",
    height: "2px",
    borderRadius: "var(--radius-full)",
    background:
      "repeating-linear-gradient(90deg, rgba(142,128,110,0.42) 0 4px, transparent 4px 10px)",
  },
  sleepingPresenceLine: {
    width: "min(calc(100vw - 48px), 360px)",
    margin: 0,
    textAlign: "center",
    color: "#8d8579",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.04em",
    pointerEvents: "none",
  },
  sleepingStatusStack: {
    position: "fixed",
    left: "50%",
    top: "calc(clamp(514px, 67dvh, 604px) + env(safe-area-inset-top))",
    zIndex: 19,
    transform: "translateX(-50%)",
    width: "min(calc(100vw - 48px), 410px)",
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    pointerEvents: "none",
  },
  sleepingStatusStackSingle: {
    gridTemplateColumns: "minmax(0, 1fr)",
    width: "min(calc(100vw - 96px), 260px)",
  },
  sleepingWorldCard: {
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    alignItems: "center",
    gap: "8px",
    minHeight: "54px",
    padding: "9px 11px",
    border: "1px solid rgba(120,108,94,0.08)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.46)",
    boxShadow: "0 6px 16px rgba(90,76,60,0.035)",
    boxSizing: "border-box",
  },
  sleepingDeliveryCard: {
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    alignItems: "center",
    gap: "8px",
    minHeight: "54px",
    padding: "9px 11px",
    border: "1px solid rgba(120,108,94,0.08)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.4)",
    boxShadow: "0 5px 14px rgba(90,76,60,0.03)",
    boxSizing: "border-box",
  },
  sleepingCardIcon: {
    width: "24px",
    height: "24px",
    borderRadius: "var(--radius-full)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    color: "#9d8d76",
  },
  sleepingCardIconAccent: {
    width: "24px",
    height: "24px",
    borderRadius: "var(--radius-full)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    color: "#b98678",
  },
  sleepingCardText: {
    minWidth: 0,
    display: "grid",
    gap: "3px",
    justifyItems: "start",
    textAlign: "left",
  },
  sleepingCardLabel: {
    color: "#756b5f",
    fontFamily: "var(--font-display)",
    fontSize: "12px",
    fontWeight: 400,
    lineHeight: 1.25,
    letterSpacing: "0.08em",
  },
  sleepingWorldCountValue: {
    color: "#5b4d40",
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  sleepingWorldCountUnit: {
    marginLeft: "3px",
    color: "#6b6257",
    fontSize: "12px",
  },
  sleepingDeliveryValue: {
    color: "#5b4d40",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 430,
    lineHeight: 1.2,
    letterSpacing: "0.02em",
  },
  sleepingBoxPills: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  sleepingBoxPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "30px",
    border: "0.5px solid rgba(95,82,62,0.16)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.52)",
    color: "#6c6559",
    fontSize: "12px",
    fontWeight: 500,
    padding: "0 10px",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },
  sleepingBoxPillValue: {
    color: "#2f2b25",
    fontSize: "12px",
    fontWeight: 500,
  },
  sleepingBoxPillIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#2f2b25",
  },
  sleepingSafetyBody: {
    display: "grid",
    gap: "16px",
    padding: "4px 2px 0",
  },
  sleepingSafetyList: {
    display: "grid",
    gap: "10px",
    margin: 0,
    padding: 0,
  },
  sleepingSafetyItem: {
    margin: 0,
    color: "var(--ink-soft)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.7,
    wordBreak: "normal",
    overflowWrap: "normal",
  },
  sleepingSafetyLine: {
    display: "block",
  },
  sleepingSafetyCheck: {
    display: "inline-flex",
    alignItems: "center",
    gap: "9px",
    color: "var(--ink)",
    fontSize: "13px",
    fontWeight: 400,
    marginTop: "2px",
  },
  sleepingSafetyCheckbox: {
    width: "18px",
    height: "18px",
    accentColor: "var(--seal)",
  },
  sleepingSafetyButton: {
    minHeight: "44px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-full)",
    background: "var(--paper-card)",
    color: "var(--ink)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    marginTop: "4px",
  },
  sleepingSafetyButtonDisabled: {
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    color: "var(--ink-faint)",
    cursor: "default",
  },
  eveningOpeningOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 88,
    display: "grid",
    placeItems: "center",
    padding:
      "calc(44px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    overflow: "hidden",
    color: "#292721",
  },
  eveningOpeningBackdrop: {
    position: "absolute",
    inset: 0,
    background: "var(--app-paper-background)",
    backgroundColor: "var(--paper-warm)",
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    transition: "opacity 180ms ease",
  },
  eveningOpeningBackdropClosing: {
    opacity: 0,
  },
  eveningOpeningPhotoStage: {
    width: "min(calc(100vw - 54px), 420px)",
    display: "grid",
    gap: "18px",
    justifyItems: "center",
  },
  eveningOpeningPhotoFrame: {
    width: "min(calc(100vw - 32px), 390px)",
    aspectRatio: "1 / 1",
    padding: "6px",
    borderRadius: "22px",
    background: "color-mix(in srgb, var(--paper-card) 68%, transparent)",
    boxShadow:
      "0 1px 0 rgba(255,255,255,.52) inset, 0 16px 38px rgba(96,78,54,0.12)",
    boxSizing: "border-box",
    overflow: "hidden",
  },
  eveningOpeningPhotoFrameClosing: {
    opacity: 0,
  },
  eveningOpeningPhoto: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: "17px",
    background: "rgba(255,253,248,0.72)",
    animation: "exchangePhotoIn 360ms cubic-bezier(0, 0, 0.2, 1) both",
  },
  eveningOpeningCaption: {
    margin: "8px 0 0",
    color: "#746a5f",
    fontFamily: "var(--font-display)",
    fontSize: "18px",
    fontWeight: 430,
    letterSpacing: "0.08em",
  },
  eveningOpeningPairStage: {
    position: "relative",
    zIndex: 1,
    width: "min(calc(100vw - 24px), 460px)",
    display: "grid",
    gap: "12px",
    justifyItems: "center",
    animation: "eveningOpeningStageIn 360ms cubic-bezier(0, 0, 0.2, 1) both",
    transition: "opacity 180ms ease",
  },
  eveningOpeningPairStageClosing: {
    opacity: 0,
    pointerEvents: "none",
  },
  eveningOpeningPairCard: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 22px minmax(0, 1fr)",
    alignItems: "center",
    gap: "12px",
  },
  eveningOpeningTitle: {
    margin: 0,
    color: "#292721",
    fontFamily: "var(--font-display)",
    fontSize: "24px",
    fontWeight: 500,
    lineHeight: 1.42,
    letterSpacing: "0.08em",
  },
  eveningOpeningSubtitle: {
    margin: "-4px 0 4px",
    color: "#746a5f",
    fontFamily: "var(--font-display)",
    fontSize: "14px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.04em",
  },
  eveningOpeningSavedNote: {
    margin: "2px 0 0",
    color: "#746a5f",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.04em",
  },
  eveningOpeningCloseButton: {
    minWidth: 120,
    marginTop: 2,
    color: "#746a5f",
  },
  eveningOpeningAfterword: {
    margin: "-2px 0 0",
    color: "#a65045",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 400,
    lineHeight: 1.5,
    letterSpacing: "0.08em",
  },
  exchangeSheetFrame: {
    left: "14px",
    right: "14px",
    width: "auto",
    maxWidth: "410px",
    margin: "0 auto",
  },
  exchangeShareLayout: {
    display: "grid",
    gap: "10px",
    minWidth: 0,
  },
  exchangeLead: {
    margin: 0,
    color: "#5f584f",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
  },
  exchangePhotoFrame: {
    width: "100%",
    height: "clamp(220px, 48vh, 360px)",
    borderRadius: "var(--radius-xl)",
    overflow: "hidden",
    background: "rgba(47,42,35,0.06)",
    border: "0.5px solid rgba(86,78,64,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
  },
  exchangePhoto: {
    width: "100%",
    height: "100%",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    display: "block",
  },
  exchangeSharePreview: {
    width: "100%",
    height: "clamp(230px, 43vh, 330px)",
    borderRadius: "24px",
    overflow: "hidden",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.92), rgba(248,242,232,0.88))",
    border: "1px solid rgba(144,126,102,0.12)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.62), 0 12px 28px rgba(90,76,60,0.06)",
  },
  exchangeShareSummary: {
    display: "grid",
    gridTemplateColumns: "30px minmax(0, 1fr)",
    alignItems: "center",
    gap: "9px",
    minHeight: "42px",
    padding: "8px 10px",
    borderRadius: "18px",
    border: "1px solid rgba(144,126,102,0.1)",
    background: "rgba(255,253,248,0.54)",
    boxSizing: "border-box",
  },
  exchangeShareSummaryIcon: {
    width: "30px",
    height: "30px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#a8493f",
    background: "rgba(168,73,63,0.08)",
  },
  exchangeDecisionStack: {
    display: "grid",
    gap: "10px",
    margin: "12px 0 14px",
    minWidth: 0,
  },
  exchangeDecisionBlock: {
    display: "grid",
    gap: "7px",
    minWidth: 0,
  },
  exchangeDecisionLabel: {
    margin: "0 2px",
    color: "#8a8174",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    letterSpacing: "0.04em",
  },
  exchangeCatPicker: {
    display: "flex",
    gap: "7px",
    overflowX: "auto",
    scrollbarWidth: "none",
    padding: "1px",
  },
  exchangeCatOption: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    minWidth: "78px",
    minHeight: "44px",
    border: "1px solid rgba(144,126,102,0.12)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.52)",
    color: "#716b60",
    padding: "8px 13px",
    cursor: "pointer",
    flexShrink: 0,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.48)",
  },
  exchangeCatOptionActive: {
    border: "1px solid rgba(168,73,63,0.36)",
    background: "rgba(255,248,240,0.88)",
    color: "#3b332c",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.56), 0 7px 16px rgba(120,82,58,0.06)",
  },
  exchangeCatName: {
    minWidth: 0,
    maxWidth: "96px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
    fontWeight: 500,
  },
  exchangeCatSelectedMark: {
    color: "#a8493f",
    fontSize: "12px",
    fontWeight: 720,
    lineHeight: 1,
  },
  exchangeSelectedCatCard: {
    display: "grid",
    gridTemplateColumns: "34px minmax(0, 1fr)",
    alignItems: "center",
    gap: "10px",
    minHeight: "50px",
    padding: "8px 10px",
    borderRadius: "18px",
    border: "1px solid rgba(144,126,102,0.1)",
    background: "rgba(255,253,248,0.52)",
    color: "#5f584f",
    boxSizing: "border-box",
  },
  exchangeSelectedCatCardPlain: {
    gridTemplateColumns: "minmax(0, 1fr)",
    padding: "9px 13px",
  },
  exchangeSelectedCatText: {
    minWidth: 0,
    color: "#5f584f",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0.02em",
  },
  exchangePrivateToggleButton: {
    justifySelf: "start",
    minHeight: "32px",
    margin: "0 2px 12px",
    border: "none",
    background: "transparent",
    color: "#8b8175",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
  },
  exchangePrivateToggleButtonActive: {
    color: "#5f564b",
  },
  exchangePrivateToggleInput: {
    width: "16px",
    height: "16px",
    margin: 0,
    accentColor: "#5b4d40",
    flexShrink: 0,
  },
  exchangePrivateToggleText: {
    display: "inline-flex",
    alignItems: "center",
  },
  exchangeText: {
    display: "grid",
    gap: "4px",
    padding: "13px 2px 12px",
  },
  exchangeTitle: {
    margin: 0,
    color: "#292721",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.28,
  },
  exchangeSubtitle: {
    margin: 0,
    color: "#716b60",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.45,
  },
  exchangeMeta: {
    margin: "2px 0 0",
    color: "#8a8174",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  exchangePrivateCheck: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    margin: "10px 2px 12px",
    color: "#5f584f",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.35,
    cursor: "pointer",
  },
  exchangePrivateCheckbox: {
    width: "16px",
    height: "16px",
    accentColor: "#292721",
    flexShrink: 0,
  },
  exchangeModeGroup: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    margin: 0,
  },
  exchangeModeButton: {
    minWidth: 0,
    minHeight: "66px",
    border: "1px solid rgba(144,126,102,0.12)",
    borderRadius: "20px",
    background: "rgba(255,253,248,0.5)",
    color: "#716b60",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: "9px",
    padding: "10px",
    cursor: "pointer",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.48)",
  },
  exchangeModeButtonActive: {
    border: "1px solid rgba(168,73,63,0.34)",
    background: "rgba(255,248,240,0.92)",
    color: "#3b332c",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.58), 0 8px 18px rgba(120,82,58,0.07)",
  },
  exchangeModeIcon: {
    width: "32px",
    height: "32px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "#a8493f",
    background: "rgba(168,73,63,0.08)",
  },
  exchangeModeText: {
    minWidth: 0,
    display: "grid",
    gap: "3px",
    textAlign: "left",
  },
  exchangeModeLabel: {
    fontSize: "13px",
    fontWeight: 520,
    lineHeight: 1.25,
    whiteSpace: "nowrap",
  },
  exchangeModeSub: {
    color: "#8a8174",
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.25,
  },
  exchangeAssurance: {
    margin: "0 2px 12px",
    color: "#8a8174",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  exchangeActions: {
    display: "grid",
    gridTemplateColumns: "1fr",
    alignItems: "center",
    gap: "10px",
  },
  exchangeKeepButton: {
    minHeight: "54px",
    border: "1px solid rgba(144,126,102,0.14)",
    borderRadius: "var(--radius-full)",
    background:
      "linear-gradient(180deg, rgba(255,253,248,0.98), rgba(248,242,232,0.94))",
    color: "#292721",
    fontSize: "15px",
    fontWeight: 520,
    letterSpacing: "0.04em",
    cursor: "pointer",
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.72), 0 12px 26px rgba(90,76,60,0.08)",
  },
  exchangePlainButton: {
    minHeight: "28px",
    border: "none",
    background: "transparent",
    color: "#7c7468",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
    padding: "0 2px",
  },
  morphBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 60,
    background: "rgba(13,11,10,0.34)",
    backdropFilter: "blur(2px)",
    WebkitBackdropFilter: "blur(2px)",
    transition: "opacity 220ms ease",
  },
  morphBackdropReturning: {
    opacity: 0,
  },
  morphPanel: {
    position: "fixed",
    left: HOME_NAV_EDGE_INSET,
    right: HOME_NAV_EDGE_INSET,
    bottom: "calc(86px + env(safe-area-inset-bottom))",
    zIndex: 61,
    maxWidth: "410px",
    margin: "0 auto",
    border: "0.5px solid rgba(255,255,255,0.2)",
    background:
      "linear-gradient(145deg, rgba(58,51,47,0.78), rgba(26,23,22,0.86))",
    color: "rgba(255,255,255,0.94)",
    boxShadow:
      "0 18px 54px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.16)",
    backdropFilter: "blur(28px)",
    WebkitBackdropFilter: "blur(28px)",
    padding: "16px 16px 18px",
    overflow: "hidden",
    transformOrigin: "top left",
    willChange: "transform, opacity",
  },
  morphBloom: {
    position: "absolute",
    inset: "-1px",
    pointerEvents: "none",
    borderRadius: "inherit",
    background:
      "radial-gradient(circle at 24% 10%, rgba(255,255,255,0.34), rgba(255,255,255,0) 34%), linear-gradient(120deg, rgba(255,255,255,0.2), rgba(255,255,255,0) 58%)",
    mixBlendMode: "screen",
    animation: "morphBloom 420ms cubic-bezier(0.2, 0.8, 0.2, 1) both",
  },
  morphHandleButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 0 12px",
    cursor: "pointer",
    position: "relative",
    zIndex: 2,
  },
  morphHandle: {
    width: "42px",
    height: "4px",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.36)",
  },
  morphCompact: {
    position: "absolute",
    inset: "12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    transition: "opacity 140ms ease",
    pointerEvents: "none",
    zIndex: 2,
  },
  morphCompactIcon: {
    width: "30px",
    height: "30px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.9)",
    flexShrink: 0,
  },
  morphCompactText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  morphCompactTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  morphCompactSub: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.18,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  morphContent: {
    position: "relative",
    zIndex: 2,
    transition: "opacity 150ms ease",
  },
  morphTitle: {
    margin: 0,
    color: "rgba(255,255,255,0.96)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.35,
  },
  mikkeAllBody: {
    display: "grid",
    gap: "15px",
    marginTop: "12px",
    maxHeight: "min(58dvh, 520px)",
    overflowY: "auto",
    overscrollBehavior: "contain",
    paddingRight: "2px",
    paddingBottom: "4px",
    WebkitOverflowScrolling: "touch",
  },
  mikkeCategoryNav: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "7px",
    marginTop: "12px",
  },
  mikkeCategoryNavItem: {
    minWidth: 0,
    minHeight: "34px",
    border: "0.5px solid rgba(255,255,255,0.13)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.66)",
    padding: "7px 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.15,
    cursor: "pointer",
  },
  mikkeCategoryNavItemActive: {
    border: "0.5px solid rgba(255,255,255,0.32)",
    background: "rgba(255,255,255,0.14)",
    color: "rgba(255,255,255,0.94)",
  },
  mikkeCategoryNavStatus: {
    color: "rgba(255,255,255,0.46)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
  },
  mikkeAllLockedText: {
    margin: 0,
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  mikkeAllSection: {
    display: "grid",
    gap: "9px",
  },
  mikkeAllSectionHeader: {
    display: "grid",
    gap: "3px",
  },
  mikkeAllPromptRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    minWidth: 0,
  },
  mikkeAllPrompt: {
    minWidth: 0,
    color: "rgba(255,255,255,0.88)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.3,
  },
  mikkeAllCategoryLock: {
    flex: "0 0 auto",
    color: "rgba(255,255,255,0.52)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
  },
  mikkeLockedSummary: {
    width: "100%",
    minHeight: "44px",
    border: "0.5px solid rgba(255,255,255,0.14)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.86)",
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    textAlign: "left",
    cursor: "pointer",
  },
  mikkeLockedSummaryText: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  mikkeLockedSummarySub: {
    flex: "0 0 auto",
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  mikkeWindowPanel: {
    width: "100%",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    padding: "0 4px 2px",
    boxSizing: "border-box",
  },
  mikkeWindowHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginBottom: "10px",
  },
  mikkeWindowKicker: {
    color: "rgba(255,255,255,0.68)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  mikkeWindowBadge: {
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.74)",
    padding: "4px 9px",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  catCounterGrid: {
    display: "grid",
    gridTemplateColumns: "1.25fr 1fr 1fr",
    gap: "8px",
    marginBottom: "12px",
  },
  catCounterTile: {
    minWidth: 0,
    minHeight: "64px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-lg)",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.13), rgba(255,255,255,0.07))",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "4px",
    padding: "10px 10px",
    boxSizing: "border-box",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.11)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },
  catCounterValue: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.05,
    letterSpacing: 0,
    fontVariantNumeric: "tabular-nums",
  },
  catCounterLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.16,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mikkeWindowBody: {
    display: "grid",
    gap: "12px",
  },
  mikkeSheetBody: {
    display: "grid",
    gap: "12px",
    marginTop: "14px",
  },
  mikkeQuestionBlock: {
    display: "grid",
    gap: "4px",
  },
  mikkeQuestionRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  mikkeQuestionCategory: {
    color: "rgba(255,255,255,0.52)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  mikkeQuestionText: {
    margin: 0,
    color: "rgba(255,255,255,0.96)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.28,
  },
  mikkeAllOpenButton: {
    flex: "0 0 auto",
    minHeight: "30px",
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.76)",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1,
    cursor: "pointer",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  mikkeOptionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
  },
  mikkeAllOptionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "7px",
  },
  mikkeOption: {
    minHeight: "48px",
    border: "0.5px solid rgba(255,255,255,0.17)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.94)",
    padding: "10px 8px",
    fontSize: "13px",
    fontWeight: 500,
    textAlign: "center",
    cursor: "pointer",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    transition:
      "background 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.18s cubic-bezier(0.2, 0.8, 0.2, 1)",
    willChange: "transform",
  },
  mikkeAllOption: {
    minHeight: "42px",
    borderRadius: "var(--radius-md)",
    padding: "8px 4px",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.16,
  },
  mikkeOptionSelected: {
    border: "0.5px solid rgba(255,255,255,0.72)",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    transform: "translateY(-1px)",
  },
  mikkeResultBlock: {
    display: "grid",
    gap: "8px",
    borderTop: "0.5px solid rgba(255,255,255,0.12)",
    paddingTop: "10px",
  },
  mikkeResultBlockCollapsed: {
    borderTop: "none",
    paddingTop: 0,
  },
  mikkeResultCounter: {
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "var(--radius-lg)",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.15), rgba(255,255,255,0.075))",
    padding: "12px 13px",
    display: "grid",
    gridTemplateColumns: "1fr auto",
    alignItems: "end",
    gap: "2px 12px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  mikkeResultCounterLabel: {
    minWidth: 0,
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mikkeResultCounterValue: {
    gridRow: "1 / span 2",
    gridColumn: 2,
    color: "rgba(255,255,255,0.97)",
    fontSize: "24px",
    fontWeight: 500,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  mikkeResultCounterSub: {
    minWidth: 0,
    color: "rgba(255,255,255,0.86)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.22,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mikkeResultHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
  },
  mikkeResultMine: {
    color: "rgba(255,255,255,0.92)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.25,
  },
  mikkeResultMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  mikkeResultEmpty: {
    margin: 0,
    color: "rgba(255,255,255,0.58)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  mikkeResultRows: {
    display: "grid",
    gap: "6px",
  },
  mikkeResultRow: {
    display: "grid",
    gridTemplateColumns: "70px 1fr 36px",
    alignItems: "center",
    gap: "8px",
  },
  mikkeResultRowSelected: {
    borderRadius: "var(--radius-sm)",
  },
  mikkeResultLabel: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    fontWeight: 500,
  },
  mikkeResultLabelSelected: {
    color: "rgba(255,255,255,0.96)",
    fontWeight: 500,
  },
  mikkeResultTrack: {
    height: "7px",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  mikkeResultFill: {
    display: "block",
    height: "100%",
    borderRadius: "inherit",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.56), rgba(255,255,255,0.92))",
    transition: "width 0.42s cubic-bezier(0.22, 1, 0.36, 1)",
  },
  mikkeResultFillSelected: {
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.92), rgba(255,255,255,1))",
    boxShadow: "0 0 12px rgba(255,255,255,0.22)",
  },
  mikkeResultRatio: {
    color: "rgba(255,255,255,0.6)",
    fontSize: "12px",
    fontWeight: 500,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  mikkePhotoButton: {
    width: "100%",
    minHeight: "44px",
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  yousuPanel: {
    border: "0.5px solid #E0DDD6",
    borderRadius: "var(--radius-lg)",
    background: "rgba(247, 245, 239, 0.85)",
    padding: "10px",
  },
  yousuHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  },
  yousuTitle: {
    color: "#2A2A28",
    fontSize: "13px",
    fontWeight: 500,
  },
  closeButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    border: "none",
    borderRadius: "50%",
    background: "transparent",
    color: "#888580",
    cursor: "pointer",
  },
  yousuGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
  },
  yousuOption: {
    minHeight: "48px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-sm)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.94)",
    padding: "10px 4px",
    fontSize: "12px",
    fontWeight: 500,
    textAlign: "center",
    cursor: "pointer",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    transition:
      "background 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1)",
    willChange: "transform",
  },
  yousuOptionSelected: {
    border: "0.5px solid rgba(255,255,255,0.72)",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    transform: "translateY(-1px)",
  },
  sheetGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginTop: "16px",
  },
  yousuSheetGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "8px",
    marginTop: "16px",
  },
  sheetOption: {
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.94)",
    padding: "20px 12px",
    fontSize: "15px",
    fontWeight: 500,
    textAlign: "center",
    cursor: "pointer",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    transition:
      "background 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.16s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.16s cubic-bezier(0.2, 0.8, 0.2, 1)",
    willChange: "transform",
  },
  sheetOptionSelected: {
    border: "0.5px solid rgba(255,255,255,0.72)",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    transform: "translateY(-1px)",
  },
  infoSheetBody: {
    marginTop: "18px",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.10)",
    padding: "16px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  infoSheetLead: {
    margin: "0 0 8px",
    color: "rgba(255,255,255,0.96)",
    fontSize: "15px",
    fontWeight: 500,
    lineHeight: 1.5,
  },
  infoSheetText: {
    margin: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.75,
  },
  collectionQuickBody: {
    marginTop: "18px",
    display: "grid",
    gap: "14px",
  },
  collectionQuickTarget: {
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.10)",
    padding: "14px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12)",
  },
  collectionQuickThumb: {
    width: "54px",
    height: "54px",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.10)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  collectionQuickIcon: {
    width: "46px",
    height: "46px",
    objectFit: "contain",
    display: "block",
  },
  collectionQuickText: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  collectionQuickLabel: {
    color: "rgba(255,255,255,0.56)",
    fontSize: "12px",
    fontWeight: 500,
  },
  collectionQuickName: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "18px",
    fontWeight: 500,
    lineHeight: 1.2,
  },
  collectionQuickButton: {
    width: "100%",
    minHeight: "50px",
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.94)",
    color: "#2A2A28",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
  },
  accountRestoreBody: {
    marginTop: "18px",
    display: "grid",
    gap: "14px",
  },
  accountRestoreLead: {
    margin: 0,
    color: "rgba(255,255,255,0.88)",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.7,
  },
  accountRestoreStats: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    color: "rgba(255,255,255,0.74)",
    fontSize: "12px",
    fontWeight: 500,
  },
  accountRestoreActions: {
    display: "grid",
    gap: "8px",
  },
  accountRestorePrimary: {
    width: "100%",
    minHeight: "48px",
    border: "none",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    fontSize: "15px",
    fontWeight: 500,
    cursor: "pointer",
  },
  accountRestoreSecondary: {
    width: "100%",
    minHeight: "40px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.64)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  catList: {
    display: "grid",
    gap: "8px",
    marginTop: "16px",
  },
  catListItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,255,255,0.10)",
    padding: "14px 16px",
    color: "rgba(255,255,255,0.94)",
    cursor: "pointer",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
  },
  catListItemActive: {
    border: "0.5px solid rgba(255,255,255,0.62)",
    background: "rgba(255,255,255,0.18)",
  },
  catListName: {
    fontSize: "15px",
    fontWeight: 500,
  },
  catListMark: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 500,
  },
  toast: {
    position: "fixed",
    top: "calc(18px + env(safe-area-inset-top))",
    left: "50%",
    zIndex: 120,
    transform: "translateX(-50%)",
    maxWidth: "min(312px, calc(100vw - 40px))",
    border: "1px solid rgba(120,108,94,0.14)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.94)",
    color: "#5f574e",
    boxShadow: "0 6px 16px rgba(90,76,60,0.08)",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.45,
    textAlign: "center",
    animation: "toastIn 0.2s ease-out",
  },
} satisfies Record<string, CSSProperties>;

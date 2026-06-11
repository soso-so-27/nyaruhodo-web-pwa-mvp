"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode, TouchEvent } from "react";
import {
  getAccountSyncOverview,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { writeAuthDebugEvent } from "../../lib/authDebug";
import {
  storeAccountPhotoDataUrl,
  storeAccountPhotoFile,
} from "../../lib/photoStorageClient";
import {
  getCollectionSlotPhotoSlug,
  getDailyCollectionTarget,
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
  createSleepingExchange,
  saveRemoteDeliveryStockPhoto,
} from "../../lib/home/deliveryCandidates";
import {
  buildEveningHomeState,
  getPendingEveningDeliveryDay,
  getJstDateKey,
  isTodaySleepingCounterVisible,
  markEveningDeliveryKept,
  markEveningDeliveryOpened,
  recordEveningDeliveryTarget,
  setAppBadge,
  setEveningDeliveredPhoto,
  type EveningHomeState,
} from "../../lib/home/eveningDelivery";
import {
  BOX_PHOTO_STORAGE_EVENT,
  dismissExchangePhoto,
  keepExchangePhoto,
  readKeptExchangePhotoCount,
  readOwnSleepingPhotos,
  readOwnSleepingPhotoCount,
  reportExchangePhoto,
  saveOwnSleepingPhoto,
  writeOwnSleepingPhotosWithFallback,
  type ExchangePhoto,
  type OwnSleepingPhoto,
} from "../../lib/home/sleepingPhotos";
import { backupOwnSleepingPhotoMoment } from "../../lib/home/sleepingPhotoBackup";
import {
  STORAGE_KEYS,
  getDiscoveryLogKey,
  getLockDataKey,
  getRecordLogKey,
} from "../../lib/storage";
import type { RecentEvent } from "../../lib/supabase/queries";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
} from "./homeInputHelpers";
import type { CatProfile } from "./homeInputHelpers";
import { AppBottomSheet } from "../ui/AppBottomSheet";
import {
  AppIcon,
  type AppIconName,
} from "../ui/AppIcons";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { StoredPhotoImage } from "../ui/StoredPhotoImage";

type HomeInputProps = {
  recentEvents: RecentEvent[];
};

type LockData = {
  yousuLockedUntil?: number;
  mugiLockedUntil?: number;
  sleepingCounterLockedUntil?: number;
  mikkeCategoryLockedUntil?: Partial<Record<MikkeWindowCategory, number>>;
};

type LockType = "yousu" | "mugi";

const MIKKE_CATEGORIES: MikkeWindowCategory[] = ["place", "pose", "sign"];
const MIKKE_LOCK_MS = 60 * 60 * 1000;
const SHOW_HOME_WORDMARK = false;
const SUBCOPY_HIDE_EXCHANGE_COUNT = 10;
const MOTIF_STATE_SHOWN_STORAGE_PREFIX = "neteruneko_motif_state_shown";
const SUBCOPY_HIDDEN_COHORT_STORAGE_KEY =
  "neteruneko_subcopy_hidden_cohort_tracked";
const PRESENCE_SESSION_STORAGE_KEY = "neteruneko_presence_count";

type DayCycleState = "1" | "1b" | "2" | "3" | "4";
const PHOTO_SAVE_FAILURE_MESSAGE =
  "写真を保存できませんでした。少し時間をおいて、もう一度試してください";
const PHOTO_INPUT_FAILURE_MESSAGE =
  "写真を読み込めませんでした。JPEGやPNGの写真で、もう一度試してください";

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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type HomeInstallPlatform = "ios" | "android";

export function HomeInput({ recentEvents: _recentEvents }: HomeInputProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CatProfile | null>(null);
  const [lockData, setLockData] = useState<LockData>({});
  const [tick, setTick] = useState(0);
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
    remoteCollectionPhotos: number;
    remoteOwnSleepingPhotos: number;
    remoteKeptExchangePhotos: number;
  } | null>(null);
  const [isDiscoverySheetOpen, setIsDiscoverySheetOpen] = useState(false);
  const [isRecentChangeSheetOpen, setIsRecentChangeSheetOpen] = useState(false);
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
  const pendingEveningDeliveryKeysRef = useRef(new Set<string>());
  const hasTrackedGoogleAuthSuccess = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const completedBoardTimerRef = useRef<number | null>(null);
  const boardSheetReturnTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const profiles = readCatProfiles();
    const activeId = readActiveCatId();
    const active = getActiveCatProfile(profiles, activeId);

    setCatProfiles(profiles);
    setActiveCatId(active.id);
    setActiveCat(active);
    saveActiveCatId(active.id);
    hydrateCatState(active.id);
    setHasAcceptedSleepingSafety(hasAcceptedSleepingSafetyNotice());
  }, []);

  useEffect(() => {
    setTick(Date.now());

    const intervalId = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
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
      restoreIfLocalEmpty: false,
    });

    trackProductEvent(
      "account_data_sync_completed",
      {
        status: syncResult.status,
        pushed_cats: syncResult.pushedCats,
        pushed_records: syncResult.pushedRecords,
        pushed_collection_photos: syncResult.pushedCollectionPhotos,
        pushed_own_sleeping_photos: syncResult.pushedOwnSleepingPhotos,
        pushed_kept_exchange_photos: syncResult.pushedKeptExchangePhotos,
        restored_cats: syncResult.restoredCats,
        restored_records: syncResult.restoredRecords,
        restored_collection_photos: syncResult.restoredCollectionPhotos,
        restored_own_sleeping_photos: syncResult.restoredOwnSleepingPhotos,
        restored_kept_exchange_photos: syncResult.restoredKeptExchangePhotos,
        error_count: syncResult.errors.length,
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
          syncResult.restoredCollectionPhotos > 0 ||
          syncResult.restoredOwnSleepingPhotos > 0 ||
          syncResult.restoredKeptExchangePhotos > 0))
    ) {
      refreshHomeFromLocalStorage();
    }
  }

  const catName = activeCat ? getCatName(activeCat) : "ねこ";
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
    () => readOwnSleepingPhotos(activeCatId),
    [activeCatId, collectionRefreshTick, eveningRefreshTick],
  );
  const eveningHomeState = useMemo(
    () =>
      buildEveningHomeState({
        activeCatId,
        ownPhotos: ownSleepingPhotosForHome,
        now: tick,
      }),
    [activeCatId, eveningRefreshTick, ownSleepingPhotosForHome, tick],
  );
  const keptExchangePhotoCount = useMemo(
    () => readKeptExchangePhotoCount(),
    [collectionRefreshTick, eveningRefreshTick],
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
    const pendingDay = getPendingEveningDeliveryDay(tick);

    if (!pendingDay?.targetOwnPhotoId || !activeCatId) {
      return;
    }

    if (pendingEveningDeliveryKeysRef.current.has(pendingDay.dateKey)) {
      return;
    }

    const ownPhoto =
      ownSleepingPhotosForHome.find(
        (photo) => photo.id === pendingDay.targetOwnPhotoId,
      ) ?? pendingDay.targetPhoto;

    if (!ownPhoto) {
      return;
    }

    pendingEveningDeliveryKeysRef.current.add(pendingDay.dateKey);

    void createExchangePhoto({
      ownPhoto: {
        ...ownPhoto,
        src: ownPhoto.originalSrc ?? ownPhoto.displaySrc ?? ownPhoto.src,
      },
      triggerLabel: ownPhoto.triggerLabel,
      theme: ownPhoto.theme,
      category: "sleep",
      seed: `${pendingDay.dateKey}:${ownPhoto.id}`,
      recipientCatId: pendingDay.targetCatId ?? activeCatId,
    }).then((photo) => {
      if (!photo) {
        pendingEveningDeliveryKeysRef.current.delete(pendingDay.dateKey);
        trackProductEvent(
          "delivery_sent",
          {
            delivery_date_key: pendingDay.dateKey,
            poolSource: "none",
            isOnboardingInstant: false,
            isDay1Evening: false,
          },
          { localCatId: pendingDay.targetCatId ?? activeCatId },
        );
        return;
      }

      setEveningDeliveredPhoto(pendingDay.dateKey, photo, Date.now());
      void setAppBadge(1);
      setEveningRefreshTick((value) => value + 1);
      trackProductEvent(
        "delivery_sent",
        {
          delivery_date_key: pendingDay.dateKey,
          poolSource: "normal",
          isOnboardingInstant: false,
          isDay1Evening: false,
        },
        { localCatId: pendingDay.targetCatId ?? activeCatId },
      );
    });
  }, [activeCatId, ownSleepingPhotosForHome, tick]);

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
          triggerLabel: "ねてる",
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
          },
          { localCatId: activeCatId },
        );
      } catch {
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
    }, 60000);
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

  function handleOpenEveningDelivery(
    deliveryState: Extract<EveningHomeState, { kind: "delivered" }>,
  ) {
    setOpeningEveningDelivery(deliveryState);
    markEveningDeliveryOpened(deliveryState.dateKey);
    setEveningRefreshTick((value) => value + 1);
    trackProductEvent(
      "envelope_opened",
      { delivery_date_key: deliveryState.dateKey },
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
    isHomeInstallHintVisible &&
    Boolean(homeInstallPlatform) &&
    eveningHomeState.kind !== "before";

  return (
    <main style={styles.page}>
      <div
        aria-hidden={openingEveningDelivery ? true : undefined}
        style={styles.homeContentLayer}
      >
        <div style={styles.paperBackground} aria-hidden="true" />
        <div style={styles.paperNoise} aria-hidden="true" />

        <SleepingPhotoHome
          catName={catName}
          sleepingCounter={sleepingCounterCount}
          eveningState={eveningHomeState}
          keptExchangePhotoCount={keptExchangePhotoCount}
          isInstallHintVisible={shouldShowHomeInstallHint}
          showSleepingCounter={
            typeof sleepingPresenceCount === "number" &&
            isTodaySleepingCounterVisible(sleepingCounterCount)
          }
          onTakePhoto={() => handleSleepingPhotoStart("camera")}
          onOpenDelivery={handleOpenEveningDelivery}
        />

        {shouldShowHomeInstallHint && homeInstallPlatform ? (
          <HomeInstallHintCard
            platform={homeInstallPlatform}
            canPrompt={Boolean(homeInstallPrompt)}
            onPrimary={handleHomeInstallPrimaryAction}
            onDismiss={dismissHomeInstallHint}
          />
        ) : null}

        {isHomeInstallGuideOpen && homeInstallPlatform ? (
          <HomeInstallGuideSheet
            platform={homeInstallPlatform}
            onClose={dismissHomeInstallHint}
          />
        ) : null}
      </div>

      {openingEveningDelivery ? (
        <EveningDeliveryOpening
          state={openingEveningDelivery}
          catName={catName}
          onKeep={() =>
            handleKeepEveningDelivery(
              openingEveningDelivery.dateKey,
              openingEveningDelivery.deliveredPhoto,
            )
          }
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
          isExchangeTargetAvailable={eveningHomeState.kind === "before"}
          deliveryCopy={
            eveningHomeState.kind === "before" && eveningHomeState.isTodayDelivery
              ? "よる8じごろ とどきます。"
              : "あしたのよるに とどきます。"
          }
          onCatSelect={setPendingExchangeCatId}
          onModeChange={(mode) => {
            trackProductEvent(
              "home_exchange_share_mode_selected",
              {
                mode,
                delivery_available: eveningHomeState.kind === "before",
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

      <div aria-hidden={openingEveningDelivery ? true : undefined}>
        <BottomNavigation active="today" />
      </div>
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translate3d(0, 18px, 0) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1);
          }
        }
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
        @keyframes dayCycleDotFlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.7; }
        }
        @keyframes dayCycleCameraFill {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .day-cycle-indicator {
          transition: opacity 300ms ease-out;
          -webkit-tap-highlight-color: transparent;
        }
        .day-cycle-dot-flow {
          animation: dayCycleDotFlow 2.4s linear infinite;
        }
        .day-cycle-dot-flow:nth-child(2) {
          animation-delay: 0.18s;
        }
        .day-cycle-dot-flow:nth-child(3) {
          animation-delay: 0.36s;
        }
        .day-cycle-dot-flow:nth-child(4) {
          animation-delay: 0.54s;
        }
        .day-cycle-dot-flow:nth-child(5) {
          animation-delay: 0.72s;
        }
        .day-cycle-camera-fill {
          animation: dayCycleCameraFill 600ms ease-out both;
        }
        .sleeping-photo-button {
          transition: transform 100ms ease-out;
          -webkit-tap-highlight-color: transparent;
        }
        .sleeping-photo-button:active {
          transform: scale(0.97);
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
        borderRadius: "24px",
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
      borderRadius: "18px",
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

function SleepingPhotoHome({
  catName,
  sleepingCounter,
  eveningState,
  keptExchangePhotoCount,
  isInstallHintVisible,
  showSleepingCounter,
  onTakePhoto,
  onOpenDelivery,
}: {
  catName: string;
  sleepingCounter: string;
  eveningState: EveningHomeState;
  keptExchangePhotoCount: number;
  isInstallHintVisible: boolean;
  showSleepingCounter: boolean;
  onTakePhoto: () => void;
  onOpenDelivery: (state: Extract<EveningHomeState, { kind: "delivered" }>) => void;
}) {
  const isBefore = eveningState.kind === "before";
  const isWaiting = eveningState.kind === "waiting";
  const isDelivered = eveningState.kind === "delivered";
  const isOpened = eveningState.kind === "opened";
  const title =
    isBefore && catName
      ? `${catName}、ねてる？`
      : isWaiting
        ? "おあずかり中"
        : isDelivered
          ? "ねがおが とどいています"
          : "きょうの 2まい";
  const lead =
    isBefore
      ? eveningState.isTodayDelivery
        ? "とると、よる8じごろ とどく"
        : "いまとると、あしたのよるに とどく"
      : isWaiting
        ? eveningState.isTodayDelivery
        ? "よる8じごろ、どこかのねがおが とどきます"
        : "あしたのよるに、どこかのねがおが とどきます"
        : isDelivered
          ? ""
          : "また、ねていたら。";
  const targetPhoto = isWaiting || isDelivered || isOpened
    ? eveningState.targetPhoto
    : null;
  const dayCycleState = getDayCycleState(eveningState);
  const shouldHideRoutineSubcopy =
    dayCycleState === "1" &&
    keptExchangePhotoCount >= SUBCOPY_HIDE_EXCHANGE_COUNT;
  const visibleLead = shouldHideRoutineSubcopy ? "" : lead;

  useEffect(() => {
    trackMotifStateShown(dayCycleState, eveningState.dateKey);
  }, [dayCycleState, eveningState.dateKey]);

  useEffect(() => {
    if (keptExchangePhotoCount < SUBCOPY_HIDE_EXCHANGE_COUNT) {
      return;
    }

    trackSubcopyHiddenCohort(keptExchangePhotoCount);
  }, [keptExchangePhotoCount]);

  function handleTakePhotoPress() {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
    onTakePhoto();
  }

  function handleMotifOpen() {
    if (!isDelivered) {
      return;
    }

    trackProductEvent("motif_tapped", {
      state: dayCycleState,
      delivery_date_key: eveningState.dateKey,
    });
    onOpenDelivery(eveningState);
  }

  return (
    <>
      <div
        style={SHOW_HOME_WORDMARK ? styles.sleepingTopBar : styles.sleepingTopBarHidden}
        aria-hidden="true"
      >
        ねてるねこ
      </div>
      <section style={styles.sleepingHome} aria-label="しゃしん">
        <div style={styles.sleepingHomeHeader}>
          <h1 style={styles.sleepingHomeTitle}>{title}</h1>
          {visibleLead ? (
            <p style={styles.sleepingHomeLead}>
              {visibleLead}
            </p>
          ) : null}
          <DayCycleIndicator
            state={dayCycleState}
            reserveSubcopySpace={shouldHideRoutineSubcopy}
            onOpen={handleMotifOpen}
          />

          {isWaiting && targetPhoto ? (
            <div style={styles.sleepingWaitingContent}>
              <div
                data-testid="sleeping-today-photo-area"
                style={styles.sleepingTodayPhotoArea}
              >
                <StoredPhotoImage
                  src={getPhotoDetailSrc(targetPhoto)}
                  alt=""
                  style={styles.sleepingTodayPhoto}
                />
                <p style={styles.sleepingTodayPhotoLabel}>
                  {catName ? `${catName}の きょうのねがお` : "きょうのねがお"}
                </p>
              </div>

              {!isInstallHintVisible ? (
                <div style={styles.sleepingWaitingSecondaryActionGroup}>
                  <button
                    type="button"
                    style={styles.sleepingSecondaryPhotoButton}
                    onClick={onTakePhoto}
                  >
                    <span>いまとると、アルバムに はいります</span>
                  </button>
                  {showSleepingCounter ? (
                    <p style={styles.sleepingPresenceLine}>
                      {formatSleepingPresenceLine(sleepingCounter)}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {isBefore ? (
          <div style={styles.sleepingActionGroup}>
            <button
              type="button"
              style={styles.sleepingPhotoButton}
              className="sleeping-photo-button"
              onClick={handleTakePhotoPress}
              aria-label="ねがおをとる"
            >
              <AppIcon name="camera" size={29} />
            </button>
            {showSleepingCounter ? (
              <p style={styles.sleepingPresenceLine}>
                {formatSleepingPresenceLine(sleepingCounter)}
              </p>
            ) : null}
          </div>
        ) : null}

        {isDelivered ? (
          <button
            type="button"
            style={styles.sleepingEnvelopeButton}
            onClick={() => onOpenDelivery(eveningState)}
            aria-label="ねがおをひらく"
          >
            <AppIcon name="mail" size={34} />
            <span>そっとひらく</span>
          </button>
        ) : null}

        {isOpened ? (
          <div style={styles.sleepingPairCard} aria-label="きょうの2まい">
            <div style={styles.sleepingPairTile}>
              {targetPhoto ? (
                <StoredPhotoImage
                  src={getPhotoThumbnailSrc(targetPhoto)}
                  alt=""
                  style={styles.sleepingPairImage}
                />
              ) : null}
              <span style={styles.sleepingPairLabel}>{catName}</span>
            </div>
            <span style={styles.sleepingPairDots} aria-hidden="true" />
            <div style={styles.sleepingPairTile}>
              <StoredPhotoImage
                src={getPhotoThumbnailSrc(eveningState.deliveredPhoto)}
                alt=""
                style={styles.sleepingPairImage}
              />
              <span style={styles.sleepingPairLabel}>どこかのこ</span>
            </div>
          </div>
        ) : null}

        {!isBefore && !isWaiting && !isInstallHintVisible ? (
          <div style={styles.sleepingSecondaryActionGroup}>
            <button
              type="button"
              style={styles.sleepingSecondaryPhotoButton}
              onClick={onTakePhoto}
            >
              <span>いまとると、アルバムに はいります</span>
            </button>
            {showSleepingCounter ? (
              <p style={styles.sleepingPresenceLine}>
                {formatSleepingPresenceLine(sleepingCounter)}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function DayCycleIndicator({
  state,
  reserveSubcopySpace,
  onOpen,
}: {
  state: DayCycleState;
  reserveSubcopySpace: boolean;
  onOpen: () => void;
}) {
  const isCameraFilled = state === "2" || state === "3" || state === "4";
  const isEnvelopeFilled = state === "3" || state === "4";
  const isEnvelopeWaiting = state === "2";
  const isInteractive = state === "3";
  const prefersReducedMotion = usePrefersReducedMotion();
  const shouldAnimateFlow = state === "2" && !prefersReducedMotion;
  const content = (
    <>
      <span
        style={{
          ...styles.dayCycleCircle,
          ...(isCameraFilled ? styles.dayCycleCircleFilled : {}),
        }}
        className={shouldAnimateFlow ? "day-cycle-camera-fill" : undefined}
        aria-hidden="true"
      >
        <AppIcon name="camera" size={20} />
      </span>
      <span style={styles.dayCycleDots} aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span
            key={index}
            style={{
              ...styles.dayCycleDot,
              ...(state === "1" || state === "1b" || state === "2"
                ? {}
                : styles.dayCycleDotStrong),
            }}
            className={shouldAnimateFlow ? "day-cycle-dot-flow" : undefined}
          />
        ))}
      </span>
      <span
        style={{
          ...styles.dayCycleCircle,
          ...styles.dayCycleEnvelope,
          ...(isEnvelopeWaiting ? styles.dayCycleEnvelopeWaiting : {}),
          ...(isEnvelopeFilled ? styles.dayCycleEnvelopeFilled : {}),
        }}
        aria-hidden="true"
      >
        <AppIcon name="mail" size={20} />
      </span>
    </>
  );

  if (isInteractive) {
    return (
      <button
        type="button"
        data-testid="day-cycle-indicator"
        data-state={state}
        className={`day-cycle-indicator day-cycle-indicator--state-${state}`}
        style={{
          ...styles.dayCycleButton,
          ...(reserveSubcopySpace ? styles.dayCycleReserveSubcopySpace : {}),
        }}
        aria-label={getDayCycleAriaLabel(state)}
        onClick={onOpen}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-testid="day-cycle-indicator"
      data-state={state}
      className={`day-cycle-indicator day-cycle-indicator--state-${state}`}
      style={{
        ...styles.dayCycleStatic,
        ...(reserveSubcopySpace ? styles.dayCycleReserveSubcopySpace : {}),
      }}
      aria-label={getDayCycleAriaLabel(state)}
    >
      {content}
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
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

function getDayCycleState(eveningState: EveningHomeState): DayCycleState {
  if (eveningState.kind === "waiting") return "2";
  if (eveningState.kind === "delivered") return "3";
  if (eveningState.kind === "opened") return "4";
  return eveningState.isTodayDelivery ? "1" : "1b";
}

function getDayCycleAriaLabel(state: DayCycleState) {
  switch (state) {
    case "2":
      return "ねがおをおあずかり中。よる8じごろにとどきます";
    case "3":
      return "ねがおがとどいています";
    case "4":
      return "きょうの2まいを受け取りました";
    case "1":
    case "1b":
    default:
      return "まだ撮っていません";
  }
}

function formatSleepingPresenceLine(sleepingCounter: string) {
  return `きょうも、${sleepingCounter}ひきの ねこが ねています`;
}

function trackMotifStateShown(state: DayCycleState, dateKey: string) {
  if (typeof window === "undefined") return;

  try {
    const storageKey = `${MOTIF_STATE_SHOWN_STORAGE_PREFIX}:${dateKey}:${state}`;
    if (window.localStorage.getItem(storageKey) === "1") {
      return;
    }
    window.localStorage.setItem(storageKey, "1");
    trackProductEvent("motif_state_shown", { state });
  } catch {
    trackProductEvent("motif_state_shown", { state });
  }
}

function trackSubcopyHiddenCohort(keptExchangePhotoCount: number) {
  if (typeof window === "undefined") return;

  try {
    if (window.localStorage.getItem(SUBCOPY_HIDDEN_COHORT_STORAGE_KEY) === "1") {
      return;
    }
    window.localStorage.setItem(SUBCOPY_HIDDEN_COHORT_STORAGE_KEY, "1");
    trackProductEvent("subcopy_hidden_cohort", {
      kept_exchange_photo_count: keptExchangePhotoCount,
    });
  } catch {
    trackProductEvent("subcopy_hidden_cohort", {
      kept_exchange_photo_count: keptExchangePhotoCount,
    });
  }
}

function EveningDeliveryOpening({
  state,
  catName,
  onKeep,
}: {
  state: Extract<EveningHomeState, { kind: "delivered" }>;
  catName: string;
  onKeep: () => void;
}) {
  const [stage, setStage] = useState<"photo" | "pair">("photo");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStage("pair");
    }, 1400);

    trackProductEvent("envelope_shown", {
      delivery_date_key: state.dateKey,
    });

    return () => window.clearTimeout(timer);
  }, [state.dateKey]);

  return (
    <div style={styles.eveningOpeningOverlay} aria-live="polite">
      {stage === "photo" ? (
        <div style={styles.eveningOpeningPhotoStage}>
          <StoredPhotoImage
            src={getPhotoDetailSrc(state.deliveredPhoto)}
            alt=""
            style={styles.eveningOpeningPhoto}
          />
          <p style={styles.eveningOpeningCaption}>どこかの ねがお</p>
        </div>
      ) : (
        <div
          style={styles.eveningOpeningPairStage}
          data-testid="evening-opening-pair"
        >
          <h2 style={styles.eveningOpeningTitle}>きょうの 2まい</h2>
          <div style={styles.eveningOpeningPairCard}>
            <div style={styles.sleepingPairTile}>
              {state.targetPhoto ? (
                <StoredPhotoImage
                  src={getPhotoThumbnailSrc(state.targetPhoto)}
                  alt=""
                  style={styles.sleepingPairImage}
                />
              ) : null}
              <span style={styles.sleepingPairLabel}>{catName}</span>
            </div>
            <span style={styles.sleepingPairDots} aria-hidden="true" />
            <div style={styles.sleepingPairTile}>
              <StoredPhotoImage
                src={getPhotoThumbnailSrc(state.deliveredPhoto)}
                alt=""
                style={styles.sleepingPairImage}
              />
              <span style={styles.sleepingPairLabel}>どこかのこ</span>
            </div>
          </div>
          <AppButton type="button" fullWidth onClick={onKeep}>
            とっておく
          </AppButton>
        </div>
      )}
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
      variant="soft"
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
    <AppBottomSheet title="ねてるねこが安心できる場所であるために" onClose={onClose}>
      <div style={styles.sleepingSafetyBody}>
        <p style={styles.sleepingSafetyText}>
          とどいたねがおを、そのまま外に出すのは控えてください。
        </p>
        <p style={styles.sleepingSafetyText}>
          不安なときは、自分だけに入れられます。
        </p>
        <label style={styles.sleepingSafetyCheck}>
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(event) => onCheckedChange(event.currentTarget.checked)}
            style={styles.sleepingSafetyCheckbox}
          />
          読みました
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
  onKeep,
  onClose,
  onReport,
}: {
  photo: ExchangePhoto;
  onKeep: () => void;
  onClose: () => void;
  onReport: () => void;
}) {
  return (
    <div style={styles.exchangeBackdrop} onClick={onClose}>
      <section
        style={styles.exchangePanel}
        aria-label="とどいたねがお"
        onClick={(event) => event.stopPropagation()}
      >
        <div style={styles.exchangeHeader}>
          <span style={styles.exchangeKicker}>ねがおがとどきました</span>
          <button
            type="button"
            aria-label="通報して閉じる"
            title="通報して閉じる"
            style={styles.exchangeReportButton}
            onClick={onReport}
          >
            <AppIcon name="flag" size={18} />
          </button>
        </div>
        <div style={styles.exchangePhotoFrame}>
          <StoredPhotoImage src={photo.src} alt="" style={styles.exchangePhoto} />
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
      </section>
    </div>
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

  function selectMode(nextMode: "shared" | "private") {
    setMode(nextMode);
    onModeChange(nextMode);
  }

  return (
    <div style={styles.exchangeBackdrop}>
      <section style={styles.exchangePanel} aria-label="ねがおを入れる確認">
        <div style={styles.exchangeHeader}>
          <span aria-hidden="true" />
          <button
            type="button"
            style={styles.exchangeCloseTextButton}
            onClick={onClose}
            aria-label="閉じる"
          >
            閉じる
          </button>
        </div>
        <div style={styles.exchangeSharePreview}>
          <StoredPhotoImage src={photo.src} alt="" style={styles.exchangePhoto} />
        </div>
        <p style={styles.exchangeLead}>
          {isPrivate
            ? "とっておくと、アルバムにだけ入ります。"
            : `とっておくと、${deliveryCopy}`}
        </p>
        {shouldShowCatPicker ? (
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
        ) : null}
        {isExchangeTargetAvailable ? (
          <button
            type="button"
            style={{
              ...styles.exchangePrivateToggleButton,
              ...(isPrivate ? styles.exchangePrivateToggleButtonActive : {}),
            }}
            onClick={() => selectMode(isPrivate ? "shared" : "private")}
            aria-pressed={isPrivate}
          >
            {isPrivate ? "この1まいは、とどけません" : "この1まいは、とどけない"}
          </button>
        ) : null}
        <div style={styles.exchangeActions}>
          <button
            type="button"
            style={styles.exchangeKeepButton}
            onClick={isPrivate ? onPrivate : onConfirm}
          >
            とっておく
          </button>
        </div>
      </section>
    </div>
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
    saba: "/sample-cats/saba.png",
    gray: "/sample-cats/gray.png",
    orange_tabby: "/sample-cats/orange_tabby.png",
    black: "/sample-cats/black.png",
    white: "/sample-cats/white.png",
    calico: "/sample-cats/calico.png",
    cream: "/sample-cats/saba.png",
  };
  return coatMap[coat ?? ""] ?? "/sample-cats/saba.png";
}

function readLockData(catId: string): LockData {
  try {
    const raw = window.localStorage.getItem(getLockDataKey(catId));
    if (!raw) return {};
    return JSON.parse(raw) as LockData;
  } catch {
    return {};
  }
}

function saveLockData(catId: string, data: LockData) {
  // TODO: Supabase移行時はここを書き換え
  window.localStorage.setItem(getLockDataKey(catId), JSON.stringify(data));
}

function readRecordLog(catId: string): RecordLogItem[] {
  try {
    const raw = window.localStorage.getItem(getRecordLogKey(catId));
    if (!raw) return [];
    return (JSON.parse(raw) as RecordLogItem[]).sort(
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

  window.localStorage.setItem(
    getRecordLogKey(catId),
    JSON.stringify([nextRecord, ...records].slice(0, 200)),
  );
}

function saveCollectionPhoto(catId: string, slug: string, dataUrl: string) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.collectionPhotos);
    const all = raw
      ? (JSON.parse(raw) as Record<
          string,
          Record<string, StoredCollectionPhoto[] | StoredCollectionPhoto | string[] | string>
        >)
      : {};
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
    window.localStorage.setItem(STORAGE_KEYS.collectionPhotos, JSON.stringify(all));
  } catch {
    // Keep the home flow usable even if local photo storage fails.
  }
}

async function createExchangePhoto({
  ownPhoto,
  triggerLabel,
  theme,
  category,
  seed,
  recipientCatId,
}: {
  ownPhoto: OwnSleepingPhoto;
  triggerLabel: string;
  theme: string;
  category: MikkeWindowCategory | "sleep";
  seed: string;
  recipientCatId?: string | null;
}): Promise<ExchangePhoto | null> {
  const result =
    await createSleepingExchange({
      ownPhoto,
      triggerLabel,
      theme,
      category,
      seed,
      recipientCatId,
    });

  if (!result?.photo) {
    return null;
  }

  return result.photo;
}

function getPhotoThumbnailSrc(
  photo: Pick<OwnSleepingPhoto | ExchangePhoto, "src" | "thumbnailSrc" | "displaySrc">,
) {
  return photo.thumbnailSrc ?? photo.displaySrc ?? photo.src;
}

function getPhotoDetailSrc(
  photo: Pick<
    OwnSleepingPhoto | ExchangePhoto,
    "src" | "displaySrc" | "originalSrc"
  >,
) {
  return photo.originalSrc ?? photo.displaySrc ?? photo.src;
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
    resizeAndEncode(file, 420, 0.72),
    resizeAndEncode(file, 1800, 0.9),
  ]);
  const exchangeDataUrl =
    displayDataUrl.length <= 1_900_000
      ? displayDataUrl
      : await resizeAndEncode(file, 1100, 0.8);
  const [originalSrc, storedDisplaySrc] = await Promise.all([
    storeAccountPhotoFile({
      file,
      pathSegments: [...pathSegments, "original"],
      fileName,
    }),
    storeAccountPhotoDataUrl({
      dataUrl: displayDataUrl,
      pathSegments: [...pathSegments, "display"],
      fileName,
    }),
  ]);
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
    ...(originalSrc ? { originalSrc } : {}),
  };
}

function isStoragePhotoReference(src: string | null | undefined) {
  return Boolean(src?.startsWith("storage:") || src?.startsWith("storage://"));
}

function resizeAndEncode(
  file: File,
  maxSize = 1200,
  quality = 0.86,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas is not available"));
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    img.src = url;
  });
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
    const raw = window.localStorage.getItem(getDiscoveryLogKey(catId));
    const log = raw ? (JSON.parse(raw) as string[]) : [];
    return log.includes(getTodayJST());
  } catch {
    return false;
  }
}

function markDiscoverySeen(catId: string) {
  try {
    const raw = window.localStorage.getItem(getDiscoveryLogKey(catId));
    const log = raw ? (JSON.parse(raw) as string[]) : [];
    const today = getTodayJST();
    const nextLog = log.includes(today) ? log : [today, ...log];

    window.localStorage.setItem(
      getDiscoveryLogKey(catId),
      JSON.stringify(nextLog.slice(0, 30)),
    );
  } catch {
    window.localStorage.setItem(getDiscoveryLogKey(catId), JSON.stringify([]));
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
    backgroundColor: "#f7f3ea",
    color: "#202020",
    fontFamily:
      'Outfit, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  homeContentLayer: {
    display: "contents",
  },
  paperBackground: {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    background: [
      "radial-gradient(circle at 18% 14%, rgba(255,255,255,0.84) 0%, rgba(255,255,255,0.28) 28%, rgba(255,255,255,0) 54%)",
      "radial-gradient(circle at 86% 82%, rgba(226,211,185,0.34) 0%, rgba(226,211,185,0.12) 30%, rgba(226,211,185,0) 58%)",
      "linear-gradient(180deg, #fbf8f0 0%, #f4efe4 52%, #eee6d8 100%)",
    ].join(", "),
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
    borderRadius: "21px",
    border: "1px solid rgba(144,126,102,0.075)",
    background:
      "linear-gradient(145deg, rgba(255,253,248,0.68), rgba(249,245,238,0.46))",
    boxShadow:
      "0 4px 12px rgba(90,76,60,0.032), inset 0 1px 0 rgba(255,255,255,0.42)",
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
      '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, "Noto Serif JP", serif',
    fontSize: "14.5px",
    fontWeight: 500,
    lineHeight: 1.45,
    letterSpacing: "0.04em",
  },
  homeInstallHintBody: {
    margin: 0,
    color: "#746a5f",
    fontSize: "11.5px",
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
    borderRadius: "999px",
    border: "1px solid rgba(144,126,102,0.12)",
    background: "rgba(154,134,107,0.62)",
    color: "#fffdf8",
    fontSize: "12px",
    fontWeight: 560,
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
    borderRadius: "999px",
    border: "1px solid rgba(144,126,102,0.14)",
    background: "rgba(255,253,248,0.92)",
    color: "#332c26",
    fontSize: "15px",
    fontWeight: 680,
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
    borderRadius: "28px",
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
    borderRadius: "999px",
    background: "rgba(143,126,100,0.32)",
    boxShadow: "0 1px 8px rgba(143,126,100,0.08)",
  },
  boardSleepCounter: {
    width: "100%",
    minHeight: "70px",
    border: "1px solid rgba(144,126,102,0.16)",
    borderRadius: "22px",
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
    fontWeight: 560,
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
    fontWeight: 460,
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
    borderRadius: "999px",
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
    borderRadius: "18px",
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
    borderRadius: "99px",
    color: "rgba(255,255,255,0.74)",
    fontSize: "10px",
    fontWeight: 620,
    padding: "3px 8px",
  },
  boardHeroKicker: {
    color: "rgba(255,255,255,0.64)",
    fontSize: "12px",
    fontWeight: 640,
    lineHeight: 1.2,
  },
  boardHeroStatement: {
    color: "rgba(255,255,255,0.92)",
    fontSize: "15px",
    fontWeight: 540,
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
    fontWeight: 620,
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
    fontSize: "11px",
    fontWeight: 560,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  boardShelfValue: {
    color: "#23211d",
    fontSize: "25px",
    fontWeight: 500,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
    textAlign: "center",
  },
  boardShelfDetail: {
    color: "#7f786d",
    fontSize: "10px",
    fontWeight: 520,
    lineHeight: 1.15,
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  boardNextCard: {
    width: "100%",
    minHeight: "88px",
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "21px",
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
    borderRadius: "14px",
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
    fontSize: "11.5px",
    fontWeight: 640,
    lineHeight: 1.2,
  },
  boardNextTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "17px",
    fontWeight: 640,
    lineHeight: 1.22,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  boardNextBody: {
    color: "rgba(255,255,255,0.56)",
    fontSize: "12px",
    fontWeight: 520,
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
    borderRadius: "18px",
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
    fontWeight: 660,
    lineHeight: 1.2,
  },
  boardQuickSub: {
    color: "rgba(255,255,255,0.52)",
    fontSize: "11px",
    fontWeight: 620,
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
    borderRadius: "18px",
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
    borderRadius: "18px",
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
    fontWeight: 540,
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
    borderRadius: "999px",
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
    borderRadius: "16px",
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
    fontSize: "11px",
    fontWeight: 620,
  },
  boardActionTitle: {
    color: "#332c26",
    fontSize: "13px",
    fontWeight: 650,
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
    fontSize: "11px",
    fontWeight: 620,
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
    borderRadius: "13px",
    background: "rgba(255,253,248,0.66)",
    padding: "8px 10px",
  },
  boardMemoTime: {
    color: "#aaa096",
    fontSize: "11px",
    fontWeight: 600,
  },
  boardMemoKind: {
    color: "#746a5f",
    fontSize: "11px",
    fontWeight: 650,
  },
  boardMemoValue: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#332c26",
    fontSize: "12px",
    fontWeight: 650,
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
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
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
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
    fontSize: "25px",
    fontWeight: 470,
    lineHeight: 1.42,
    letterSpacing: "0.08em",
  },
  sleepingHomeLead: {
    margin: "8px 0 0",
    color: "#6a6258",
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
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
    borderRadius: "999px",
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
    borderRadius: "999px",
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
    borderRadius: "999px",
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
    borderRadius: "999px",
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
    borderRadius: "999px",
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
    borderRadius: "24px",
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
    borderRadius: "22px",
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
    fontWeight: 620,
    lineHeight: 1.2,
  },
  sleepingBoxCount: {
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    fontWeight: 620,
    lineHeight: 1.2,
  },
  sleepingBoxClosed: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.1)",
    color: "rgba(255,255,255,0.58)",
    fontSize: "11px",
    fontWeight: 700,
  },
  sleepingBoxLead: {
    margin: "10px 0 0",
    color: "rgba(255,255,255,0.96)",
    fontSize: "19px",
    fontWeight: 660,
    lineHeight: 1.25,
  },
  sleepingBoxSub: {
    margin: 0,
    color: "rgba(255,255,255,0.7)",
    fontSize: "15px",
    fontWeight: 560,
    lineHeight: 1.32,
  },
  sleepingBoxNote: {
    margin: "8px 0 0",
    color: "rgba(255,255,255,0.48)",
    fontSize: "12px",
    fontWeight: 540,
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
    borderRadius: "999px",
    background: "rgba(255,255,255,0.42)",
    color: "#8a8174",
    fontSize: "10px",
    fontWeight: 560,
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
    borderRadius: "999px",
    background: "rgba(255,255,255,0.34)",
    color: "#8a8174",
    fontSize: "10.5px",
    fontWeight: 540,
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
    fontWeight: 560,
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
    borderRadius: "999px",
    background: "rgba(244,228,221,0.72)",
    color: "#b98678",
    boxShadow:
      "0 0 0 12px rgba(255,253,248,0.44), 0 16px 34px rgba(110,86,60,0.09)",
    cursor: "pointer",
    pointerEvents: "auto",
    fontSize: "13px",
    fontWeight: 560,
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
    fontWeight: 540,
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
    display: "grid",
    gap: "8px",
    justifyItems: "center",
  },
  sleepingPairImage: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: "24px",
    objectFit: "cover",
    overflow: "hidden",
    border: "7px solid rgba(255,253,248,0.68)",
    background: "rgba(255,253,248,0.58)",
    boxShadow: "0 14px 30px rgba(96,78,54,0.11)",
  },
  sleepingPairLabel: {
    color: "#746a5f",
    fontSize: "12px",
    fontWeight: 560,
    lineHeight: 1,
  },
  sleepingPairDots: {
    width: "28px",
    height: "2px",
    borderRadius: "999px",
    background:
      "repeating-linear-gradient(90deg, rgba(142,128,110,0.42) 0 4px, transparent 4px 10px)",
  },
  sleepingPresenceLine: {
    width: "min(calc(100vw - 48px), 360px)",
    margin: 0,
    textAlign: "center",
    color: "#8d8579",
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
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
    borderRadius: "18px",
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
    borderRadius: "18px",
    background: "rgba(255,253,248,0.4)",
    boxShadow: "0 5px 14px rgba(90,76,60,0.03)",
    boxSizing: "border-box",
  },
  sleepingCardIcon: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    background: "transparent",
    color: "#9d8d76",
  },
  sleepingCardIconAccent: {
    width: "24px",
    height: "24px",
    borderRadius: "999px",
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
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
    fontSize: "10.5px",
    fontWeight: 400,
    lineHeight: 1.25,
    letterSpacing: "0.08em",
  },
  sleepingWorldCountValue: {
    color: "#5b4d40",
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
    fontSize: "20px",
    fontWeight: 460,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  sleepingWorldCountUnit: {
    marginLeft: "3px",
    color: "#6b6257",
    fontSize: "11px",
  },
  sleepingDeliveryValue: {
    color: "#5b4d40",
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
    fontSize: "14.5px",
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
    borderRadius: "999px",
    background: "rgba(255,255,255,0.52)",
    color: "#6c6559",
    fontSize: "11px",
    fontWeight: 560,
    padding: "0 10px",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
  },
  sleepingBoxPillValue: {
    color: "#2f2b25",
    fontSize: "11px",
    fontWeight: 680,
  },
  sleepingBoxPillIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#2f2b25",
  },
  sleepingSafetyBody: {
    display: "grid",
    gap: "12px",
    padding: "4px 2px 0",
  },
  sleepingSafetyText: {
    margin: 0,
    color: "rgba(255,255,255,0.72)",
    fontSize: "13px",
    fontWeight: 460,
    lineHeight: 1.7,
  },
  sleepingSafetyCheck: {
    display: "inline-flex",
    alignItems: "center",
    gap: "9px",
    color: "rgba(255,255,255,0.86)",
    fontSize: "13px",
    fontWeight: 560,
    marginTop: "4px",
  },
  sleepingSafetyCheckbox: {
    width: "18px",
    height: "18px",
    accentColor: "#f4f1ea",
  },
  sleepingSafetyButton: {
    minHeight: "44px",
    border: "none",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.94)",
    color: "#2A2A28",
    fontSize: "14px",
    fontWeight: 660,
    cursor: "pointer",
    marginTop: "4px",
  },
  sleepingSafetyButtonDisabled: {
    background: "rgba(255,255,255,0.16)",
    color: "rgba(255,255,255,0.44)",
    cursor: "default",
  },
  eveningOpeningOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 88,
    display: "grid",
    placeItems: "center",
    padding: "calc(52px + env(safe-area-inset-top)) 24px calc(36px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    background: "linear-gradient(180deg, #fdfcf9, #f7f1e7)",
    color: "#292721",
  },
  eveningOpeningPhotoStage: {
    width: "min(calc(100vw - 54px), 420px)",
    display: "grid",
    gap: "18px",
    justifyItems: "center",
  },
  eveningOpeningPhoto: {
    width: "100%",
    maxHeight: "68vh",
    objectFit: "contain",
    borderRadius: "28px",
    background: "rgba(255,253,248,0.72)",
    boxShadow: "0 18px 46px rgba(96,78,54,0.12)",
    animation: "exchangePhotoIn 1.1s cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  eveningOpeningCaption: {
    margin: "8px 0 0",
    color: "#746a5f",
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
    fontSize: "17px",
    fontWeight: 430,
    letterSpacing: "0.08em",
  },
  eveningOpeningPairStage: {
    width: "min(calc(100vw - 54px), 380px)",
    display: "grid",
    gap: "24px",
    justifyItems: "center",
  },
  eveningOpeningPairCard: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr 28px 1fr",
    alignItems: "center",
    gap: "10px",
  },
  eveningOpeningTitle: {
    margin: 0,
    color: "#292721",
    fontFamily: "\"Shippori Mincho B1\", \"Hiragino Mincho ProN\", \"Yu Mincho\", serif",
    fontSize: "22px",
    fontWeight: 470,
    lineHeight: 1.42,
    letterSpacing: "0.08em",
  },
  exchangeBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 72,
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "center",
    padding: "0 14px calc(92px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    background: "rgba(32,28,22,0.18)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  },
  exchangePanel: {
    width: HOME_NAV_FRAME_WIDTH,
    maxWidth: "410px",
    border: "0.5px solid rgba(86,78,64,0.14)",
    borderRadius: "24px",
    background:
      "linear-gradient(145deg, rgba(255,253,248,0.96), rgba(244,239,229,0.96))",
    color: "#292721",
    padding: "14px",
    boxSizing: "border-box",
    boxShadow:
      "0 22px 60px rgba(64,52,34,0.2), inset 0 1px 0 rgba(255,255,255,0.74)",
    backdropFilter: "blur(26px)",
    WebkitBackdropFilter: "blur(26px)",
    animation: "exchangePhotoIn 0.44s cubic-bezier(0.22, 1, 0.36, 1) both",
  },
  exchangeHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    marginBottom: "10px",
  },
  exchangeKicker: {
    color: "#292721",
    fontSize: "14px",
    fontWeight: 620,
    lineHeight: 1.2,
  },
  exchangeCloseButton: {
    display: "grid",
    placeItems: "center",
    width: "30px",
    height: "30px",
    border: "0.5px solid rgba(86,78,64,0.12)",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.52)",
    color: "#716b60",
    cursor: "pointer",
    flexShrink: 0,
  },
  exchangeCloseTextButton: {
    border: "none",
    background: "transparent",
    color: "#9c9286",
    fontSize: "12px",
    fontWeight: 540,
    cursor: "pointer",
    padding: "4px 2px",
    lineHeight: 1,
  },
  exchangeReportButton: {
    display: "grid",
    placeItems: "center",
    width: "34px",
    height: "34px",
    border: "0.5px solid rgba(86,78,64,0.14)",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.54)",
    color: "#716b60",
    cursor: "pointer",
    flexShrink: 0,
  },
  exchangeLead: {
    margin: "0 2px 10px",
    color: "#716b60",
    fontSize: "12px",
    fontWeight: 460,
    lineHeight: 1.45,
  },
  exchangePhotoFrame: {
    width: "100%",
    height: "clamp(220px, 48vh, 360px)",
    borderRadius: "20px",
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
    height: "clamp(230px, 46vh, 340px)",
    borderRadius: "20px",
    overflow: "hidden",
    background: "rgba(47,42,35,0.06)",
    border: "0.5px solid rgba(86,78,64,0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    marginBottom: "10px",
  },
  exchangeCatPicker: {
    display: "flex",
    gap: "8px",
    overflowX: "auto",
    scrollbarWidth: "none",
    padding: "8px 1px 4px",
  },
  exchangeCatOption: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    minWidth: "74px",
    minHeight: "36px",
    border: "0.5px solid rgba(86,78,64,0.12)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.38)",
    color: "#716b60",
    padding: "0 14px",
    cursor: "pointer",
    flexShrink: 0,
  },
  exchangeCatOptionActive: {
    border: "1px solid rgba(61,54,44,0.34)",
    background: "rgba(86,78,64,0.12)",
    color: "#292721",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.46)",
  },
  exchangeCatName: {
    minWidth: 0,
    maxWidth: "116px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "12.5px",
    fontWeight: 640,
  },
  exchangeCatSelectedMark: {
    color: "#5b4d40",
    fontSize: "11px",
    fontWeight: 720,
    lineHeight: 1,
  },
  exchangePrivateToggleButton: {
    justifySelf: "start",
    minHeight: "32px",
    margin: "0 2px 12px",
    border: "none",
    background: "transparent",
    color: "#8b8175",
    fontSize: "12px",
    fontWeight: 540,
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
    fontSize: "17px",
    fontWeight: 600,
    lineHeight: 1.28,
  },
  exchangeSubtitle: {
    margin: 0,
    color: "#716b60",
    fontSize: "12.5px",
    fontWeight: 480,
    lineHeight: 1.45,
  },
  exchangeMeta: {
    margin: "2px 0 0",
    color: "#8a8174",
    fontSize: "12px",
    fontWeight: 480,
    lineHeight: 1.35,
  },
  exchangePrivateCheck: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    margin: "10px 2px 12px",
    color: "#5f584f",
    fontSize: "12.5px",
    fontWeight: 520,
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
    margin: "10px 0 8px",
  },
  exchangeModeButton: {
    minWidth: 0,
    minHeight: "54px",
    border: "0.5px solid rgba(86,78,64,0.12)",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.46)",
    color: "#716b60",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "8px 9px",
    cursor: "pointer",
  },
  exchangeModeButtonActive: {
    border: "0.5px solid rgba(61,54,44,0.22)",
    background: "rgba(255,255,255,0.9)",
    color: "#292721",
    boxShadow: "0 8px 18px rgba(90,76,60,0.06)",
  },
  exchangeModeText: {
    minWidth: 0,
    display: "grid",
    gap: "3px",
    textAlign: "left",
  },
  exchangeModeLabel: {
    fontSize: "13px",
    fontWeight: 680,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  },
  exchangeModeSub: {
    color: "#8a8174",
    fontSize: "10.5px",
    fontWeight: 520,
    lineHeight: 1.1,
    whiteSpace: "nowrap",
  },
  exchangeAssurance: {
    margin: "0 2px 12px",
    color: "#8a8174",
    fontSize: "11.5px",
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
    minHeight: "50px",
    border: "0.5px solid rgba(86,78,64,0.14)",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.94)",
    color: "#292721",
    fontSize: "15px",
    fontWeight: 620,
    cursor: "pointer",
    boxShadow: "0 8px 20px rgba(90,76,60,0.07)",
  },
  exchangePlainButton: {
    minHeight: "28px",
    border: "none",
    background: "transparent",
    color: "#7c7468",
    fontSize: "12px",
    fontWeight: 560,
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
    borderRadius: "999px",
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
    fontSize: "14px",
    fontWeight: 650,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  morphCompactSub: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 560,
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
    fontSize: "17px",
    fontWeight: 660,
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
    borderRadius: "999px",
    background: "rgba(255,255,255,0.07)",
    color: "rgba(255,255,255,0.66)",
    padding: "7px 8px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    fontSize: "12px",
    fontWeight: 650,
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
    fontSize: "10px",
    fontWeight: 650,
    lineHeight: 1,
  },
  mikkeAllLockedText: {
    margin: 0,
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 600,
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
    fontSize: "14px",
    fontWeight: 640,
    lineHeight: 1.3,
  },
  mikkeAllCategoryLock: {
    flex: "0 0 auto",
    color: "rgba(255,255,255,0.52)",
    fontSize: "11px",
    fontWeight: 650,
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
  },
  mikkeLockedSummary: {
    width: "100%",
    minHeight: "44px",
    border: "0.5px solid rgba(255,255,255,0.14)",
    borderRadius: "14px",
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
    fontWeight: 650,
    lineHeight: 1.2,
  },
  mikkeLockedSummarySub: {
    flex: "0 0 auto",
    color: "rgba(255,255,255,0.5)",
    fontSize: "11px",
    fontWeight: 650,
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
    fontWeight: 640,
    lineHeight: 1.2,
  },
  mikkeWindowBadge: {
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.74)",
    padding: "4px 9px",
    fontSize: "11px",
    fontWeight: 620,
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
    borderRadius: "17px",
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
    fontSize: "20px",
    fontWeight: 680,
    lineHeight: 1.05,
    letterSpacing: 0,
    fontVariantNumeric: "tabular-nums",
  },
  catCounterLabel: {
    color: "rgba(255,255,255,0.58)",
    fontSize: "11px",
    fontWeight: 610,
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
    fontSize: "11px",
    fontWeight: 640,
    lineHeight: 1.2,
  },
  mikkeQuestionText: {
    margin: 0,
    color: "rgba(255,255,255,0.96)",
    fontSize: "20px",
    fontWeight: 660,
    lineHeight: 1.28,
  },
  mikkeAllOpenButton: {
    flex: "0 0 auto",
    minHeight: "30px",
    border: "0.5px solid rgba(255,255,255,0.18)",
    borderRadius: "999px",
    background: "rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.76)",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: 650,
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
    borderRadius: "15px",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.94)",
    padding: "10px 8px",
    fontSize: "14px",
    fontWeight: 640,
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
    borderRadius: "14px",
    padding: "8px 4px",
    fontSize: "13px",
    fontWeight: 620,
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
    borderRadius: "18px",
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
    fontWeight: 640,
    lineHeight: 1.2,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  mikkeResultCounterValue: {
    gridRow: "1 / span 2",
    gridColumn: 2,
    color: "rgba(255,255,255,0.97)",
    fontSize: "28px",
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  mikkeResultCounterSub: {
    minWidth: 0,
    color: "rgba(255,255,255,0.86)",
    fontSize: "13px",
    fontWeight: 640,
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
    fontWeight: 650,
    lineHeight: 1.25,
  },
  mikkeResultMeta: {
    color: "rgba(255,255,255,0.5)",
    fontSize: "11px",
    fontWeight: 620,
    lineHeight: 1.2,
  },
  mikkeResultEmpty: {
    margin: 0,
    color: "rgba(255,255,255,0.58)",
    fontSize: "12px",
    fontWeight: 520,
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
    borderRadius: "11px",
  },
  mikkeResultLabel: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    fontWeight: 600,
  },
  mikkeResultLabelSelected: {
    color: "rgba(255,255,255,0.96)",
    fontWeight: 700,
  },
  mikkeResultTrack: {
    height: "7px",
    borderRadius: "999px",
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
    fontSize: "11px",
    fontWeight: 620,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  },
  mikkePhotoButton: {
    width: "100%",
    minHeight: "44px",
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "15px",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    fontSize: "14px",
    fontWeight: 680,
    cursor: "pointer",
  },
  yousuPanel: {
    border: "0.5px solid #E0DDD6",
    borderRadius: "16px",
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
    fontSize: "14px",
    fontWeight: 640,
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
    borderRadius: "10px",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.94)",
    padding: "10px 4px",
    fontSize: "12px",
    fontWeight: 600,
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
    borderRadius: "14px",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.94)",
    padding: "20px 12px",
    fontSize: "15px",
    fontWeight: 650,
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
    borderRadius: "18px",
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
    fontWeight: 680,
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
    borderRadius: "18px",
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
    borderRadius: "16px",
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
    fontWeight: 620,
  },
  collectionQuickName: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "20px",
    fontWeight: 680,
    lineHeight: 1.2,
  },
  collectionQuickButton: {
    width: "100%",
    minHeight: "50px",
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.94)",
    color: "#2A2A28",
    fontSize: "15px",
    fontWeight: 680,
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
    fontSize: "14px",
    fontWeight: 560,
    lineHeight: 1.7,
  },
  accountRestoreStats: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    color: "rgba(255,255,255,0.74)",
    fontSize: "12px",
    fontWeight: 620,
  },
  accountRestoreActions: {
    display: "grid",
    gap: "8px",
  },
  accountRestorePrimary: {
    width: "100%",
    minHeight: "48px",
    border: "none",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    fontSize: "15px",
    fontWeight: 680,
    cursor: "pointer",
  },
  accountRestoreSecondary: {
    width: "100%",
    minHeight: "40px",
    border: "none",
    background: "transparent",
    color: "rgba(255,255,255,0.64)",
    fontSize: "13px",
    fontWeight: 600,
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
    borderRadius: "14px",
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
    fontWeight: 620,
  },
  catListMark: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 520,
  },
  toast: {
    position: "fixed",
    top: "calc(18px + env(safe-area-inset-top))",
    left: "50%",
    zIndex: 120,
    transform: "translateX(-50%)",
    maxWidth: "min(312px, calc(100vw - 40px))",
    border: "1px solid rgba(120,108,94,0.14)",
    borderRadius: "18px",
    background: "rgba(255,253,248,0.94)",
    color: "#5f574e",
    boxShadow: "0 6px 16px rgba(90,76,60,0.08)",
    padding: "10px 14px",
    fontSize: "13px",
    fontWeight: 520,
    lineHeight: 1.45,
    textAlign: "center",
    animation: "toastIn 0.2s ease-out",
  },
} satisfies Record<string, CSSProperties>;

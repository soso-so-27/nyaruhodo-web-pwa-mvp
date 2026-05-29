"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode, TouchEvent } from "react";
import {
  getAccountSyncOverview,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  getCollectionSlotPhotoSlug,
  getDailyCollectionTarget,
  readStoredCollectionPhotos,
} from "../../lib/collection/dailyTarget";
import type { CollectionSlot } from "../../lib/collection/poses";
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
  ChevronRightIcon as SharedChevronRightIcon,
  SparklesIcon as SharedSparklesIcon,
} from "../ui/AppIcons";

type HomeInputProps = {
  recentEvents: RecentEvent[];
};

type LockData = {
  yousuLockedUntil?: number;
  mugiLockedUntil?: number;
};

type LockType = "yousu" | "mugi";

const HOME_FALLBACK_PHOTO_SRC = "/sample-cats/mugi-hero.png";

type RecordLogItem = {
  id: string;
  type: "yousu" | "mugi" | "reaction";
  value: string;
  timestamp: number;
};

type HomeBoardAction =
  | "open_mikke"
  | "open_care"
  | "open_photo"
  | "open_collection_photo"
  | "open_discovery"
  | "open_recent_change"
  | "go_torisetu"
  | "go_collection";

type HomeBoardItem = {
  id: string;
  kind: "mission" | "notice" | "insight" | "tip" | "collection" | "account";
  priority: number;
  title: string;
  body: string;
  icon: "paw" | "hand" | "heart" | "bell" | "camera" | "book";
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

const MUGI_OPTIONS = ["遊んだ", "なでた", "そっとした", "声かけた"];

const REACTION_OPTIONS = [
  "うれしそうだった",
  "ふつうだった",
  "いやそうだった",
  "わからなかった",
];

const HOME_NAV_FRAME_WIDTH = "min(calc(100% - 28px), 410px)";
const HOME_NAV_EDGE_INSET = "max(14px, calc((100vw - 410px) / 2))";
const QUICK_BOARD_ITEM_IDS = new Set(["today-mikke", "today-care"]);
const ACTION_BOARD_ITEM_IDS = new Set([
  "today-mikke",
  "today-care",
  "home-photo",
]);

export function HomeInput({ recentEvents: _recentEvents }: HomeInputProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CatProfile | null>(null);
  const [lockData, setLockData] = useState<LockData>({});
  const [tick, setTick] = useState(Date.now());
  const [isYousuOpen, setIsYousuOpen] = useState(false);
  const [isMugiSheetOpen, setIsMugiSheetOpen] = useState(false);
  const [isReactionSheetOpen, setIsReactionSheetOpen] = useState(false);
  const [isCatSheetOpen, setIsCatSheetOpen] = useState(false);
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
  } | null>(null);
  const [isDiscoverySheetOpen, setIsDiscoverySheetOpen] = useState(false);
  const [isRecentChangeSheetOpen, setIsRecentChangeSheetOpen] = useState(false);
  const [selectedYousu, setSelectedYousu] = useState<string | null>(null);
  const [selectedMugi, setSelectedMugi] = useState<string | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [recordLog, setRecordLog] = useState<RecordLogItem[]>([]);
  const [homeSwipeStart, setHomeSwipeStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [toastText, setToastText] = useState("");
  const [boardCompletion, setBoardCompletion] =
    useState<HomeBoardCompletion | null>(null);
  const [boardSheetSource, setBoardSheetSource] =
    useState<HomeBoardTransitionSource | null>(null);
  const [boardSheetReturn, setBoardSheetReturn] =
    useState<HomeBoardCompletion | null>(null);
  const [isBoardSheetReturning, setIsBoardSheetReturning] = useState(false);
  const [collectionRefreshTick, setCollectionRefreshTick] = useState(0);
  const [discoveryDismissedToday, setDiscoveryDismissedToday] = useState(false);
  const hasTrackedHomeView = useRef(false);
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
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
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
    const hasPendingGoogleAuth = Boolean(
      window.localStorage.getItem(STORAGE_KEYS.authGooglePending),
    );

    if (authStatus === "google_success" || hasPendingGoogleAuth) {
      void trackGoogleAuthSuccess(
        authStatus === "google_success" ? "callback_marker" : "pending_marker",
      );
      params.delete("auth");
    }

    if (shouldOpenMikke) {
      setIsYousuOpen(true);
      params.delete("mikke");
    }

    if (!shouldOpenMikke && authStatus !== "google_success") {
      return;
    }

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
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
      return;
    }

    hasTrackedGoogleAuthSuccess.current = true;
    window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
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

    trackProductEvent(
      "account_data_sync_completed",
      {
        status: syncResult.status,
        pushed_cats: syncResult.pushedCats,
        pushed_records: syncResult.pushedRecords,
        pushed_collection_photos: syncResult.pushedCollectionPhotos,
        restored_cats: syncResult.restoredCats,
        restored_records: syncResult.restoredRecords,
        restored_collection_photos: syncResult.restoredCollectionPhotos,
        error_count: syncResult.errors.length,
      },
      {
        localCatId,
        userId,
      },
    );

    if (syncResult.status === "restored" && syncResult.restoredCats > 0) {
      refreshHomeFromLocalStorage();
    }
  }

  const catName = activeCat ? getCatName(activeCat) : "ねこ";
  const photoSrc =
    activeCat?.homePhotoDataUrl ??
    activeCat?.avatarDataUrl ??
    HOME_FALLBACK_PHOTO_SRC;
  const homePhotoPosition = activeCat?.homePhotoPosition ?? "center 38%";
  const yousuRemaining = getRemainingTime(lockData, "yousu", tick);
  const mugiRemaining = getRemainingTime(lockData, "mugi", tick);
  const isYousuLocked = Boolean(yousuRemaining);
  const isMugiLocked = Boolean(mugiRemaining);
  const latestRecord = recordLog[0] ?? null;
  const personalityInsight = useMemo(
    () => buildPersonalityInsight(recordLog, catName),
    [catName, recordLog],
  );
  const yousuCooldownProgress = getCooldownProgress(lockData, "yousu", tick);
  const mugiCooldownProgress = getCooldownProgress(lockData, "mugi", tick);
  const dailyCollectionTarget = useMemo(() => {
    return getDailyCollectionTarget(
      activeCatId ?? "cat",
      activeCatId ? readStoredCollectionPhotos(activeCatId) : {},
    );
  }, [activeCatId, collectionRefreshTick]);
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
        yousuRemaining,
        mugiRemaining,
        yousuCooldownProgress,
        mugiCooldownProgress,
      }),
    [
      activeCat?.homePhotoDataUrl,
      catName,
      discovery.available,
      dailyCollectionTarget?.label,
      mugiCooldownProgress,
      mugiRemaining,
      recordLog,
      yousuCooldownProgress,
      yousuRemaining,
    ],
  );

  useEffect(() => {
    const cssPhotoUrl = toCssUrl(photoSrc);
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty("--home-bg-image", cssPhotoUrl);
    body.style.setProperty("--home-bg-image", cssPhotoUrl);
    body.style.backgroundImage = cssPhotoUrl;
    body.style.backgroundPosition = homePhotoPosition;
    body.style.backgroundSize = "cover";
    body.style.backgroundRepeat = "no-repeat";

    return () => {
      root.style.removeProperty("--home-bg-image");
      body.style.removeProperty("--home-bg-image");
      body.style.removeProperty("background-image");
      body.style.removeProperty("background-position");
      body.style.removeProperty("background-size");
      body.style.removeProperty("background-repeat");
    };
  }, [homePhotoPosition, photoSrc]);

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
      },
      { localCatId: activeCatId },
    );
  }, [activeCat, activeCatId, catProfiles.length, recordLog.length]);

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
      });
      setIsAccountRestoreSheetOpen(true);
      trackProductEvent(
        "account_restore_prompt_viewed",
        {
          local_cats: overview.localCats,
          remote_cats: overview.remoteCats,
          remote_records: overview.remoteRecords,
          remote_collection_photos: overview.remoteCollectionPhotos,
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
    const latestMugi = records.find((record) => record.type === "mugi");

    setRecordLog(records);
    setSelectedYousu(latestYousu?.value ?? null);
    setSelectedMugi(latestMugi?.value ?? null);
    setSelectedReaction(null);
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
  }

  function handleCatSelect(catId: string) {
    const profile = getActiveCatProfile(catProfiles, catId);

    saveActiveCatId(profile.id);
    setActiveCatId(profile.id);
    setActiveCat(profile);
    setIsCatSheetOpen(false);
    hydrateCatState(profile.id);
  }

  function switchActiveCat(direction: -1 | 1) {
    if (catProfiles.length < 2 || !activeCatId) return;

    const currentIndex = catProfiles.findIndex((profile) => profile.id === activeCatId);
    if (currentIndex === -1) return;

    const nextIndex =
      (currentIndex + direction + catProfiles.length) % catProfiles.length;
    handleCatSelect(catProfiles[nextIndex].id);
  }

  function handleHomeSwipeStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    setHomeSwipeStart({ x: touch.clientX, y: touch.clientY });
  }

  function handleHomeSwipeEnd(event: TouchEvent<HTMLDivElement>) {
    if (!homeSwipeStart) return;

    const touch = event.changedTouches[0];
    if (!touch) {
      setHomeSwipeStart(null);
      return;
    }

    const deltaX = touch.clientX - homeSwipeStart.x;
    const deltaY = touch.clientY - homeSwipeStart.y;
    const isHorizontalSwipe = Math.abs(deltaX) > 56 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3;

    if (isHorizontalSwipe) {
      switchActiveCat(deltaX < 0 ? 1 : -1);
    }

    setHomeSwipeStart(null);
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
        error_count: result.errors.length,
      },
      { localCatId: activeCatId },
    );

    if (result.status === "restored" && result.restoredCats > 0) {
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

  function recordYousu(value: string) {
    if (!activeCatId || isLocked(lockData, "yousu", Date.now())) return;

    const lockRemainingBefore = yousuRemaining;
    const nextLockData = setLock(activeCatId, "yousu");

    saveRecord(activeCatId, { type: "yousu", value });
    trackProductEvent(
      "home_mikke_recorded",
      {
        value,
        lock_remaining_before: lockRemainingBefore,
      },
      { localCatId: activeCatId },
    );
    setSelectedYousu(value);
    setRecordLog(readRecordLog(activeCatId));
    setLockData(nextLockData);
    closeBoardInput(setIsYousuOpen, {
      itemId: "today-mikke",
      title: value,
      surfaceText: "手がかりへ",
    });
  }

  function recordMugi(value: string) {
    if (!activeCatId || isLocked(lockData, "mugi", Date.now())) return;

    const lockRemainingBefore = mugiRemaining;
    const nextLockData = setLock(activeCatId, "mugi");

    saveRecord(activeCatId, { type: "mugi", value });
    trackProductEvent(
      "home_care_recorded",
      {
        value,
        lock_remaining_before: lockRemainingBefore,
      },
      { localCatId: activeCatId },
    );
    setSelectedMugi(value);
    setRecordLog(readRecordLog(activeCatId));
    setLockData(nextLockData);
    closeBoardInput(setIsMugiSheetOpen, {
      itemId: "today-care",
      title: value,
      surfaceText: "手がかりへ",
    });

    window.setTimeout(() => {
      if (Math.random() < 0.33) {
        setIsReactionSheetOpen(true);
      }
    }, 1650);
  }

  function recordReaction(value: string) {
    if (!activeCatId) return;

    saveRecord(activeCatId, { type: "reaction", value });
    setSelectedReaction(value);
    setRecordLog(readRecordLog(activeCatId));
    window.setTimeout(() => setIsReactionSheetOpen(false), 260);
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
        const profiles = readCatProfiles();
        const nextProfiles = profiles.map((profile) =>
          profile.id === activeCatId
            ? {
                ...profile,
                homePhotoDataUrl: dataUrl,
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
        showToast("写真を保存できませんでした");
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
        const dataUrl = await resizeAndEncode(file, 900);

        saveCollectionPhoto(activeCatId, slug, dataUrl);
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
        showToast("写真を保存できませんでした");
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
      if (!isYousuLocked) {
        openBoardInput(setIsYousuOpen, source);
      }
      return;
    }
    if (actionType === "open_care") {
      if (!isMugiLocked) {
        openBoardInput(setIsMugiSheetOpen, source);
      }
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
      window.location.href = "/torisetu";
      return;
    }
    if (actionType === "go_collection") {
      window.location.href = "/collection";
    }
  }

  return (
    <main
      style={{
        ...styles.page,
        backgroundImage: `url("${photoSrc}")`,
        backgroundPosition: homePhotoPosition,
      }}
    >
      <div
        style={{
          ...styles.backgroundPhoto,
          backgroundImage: `url("${photoSrc}")`,
          backgroundPosition: homePhotoPosition,
        }}
        aria-hidden="true"
      />
      <div
        style={styles.contentLayer}
        onTouchStart={handleHomeSwipeStart}
        onTouchEnd={handleHomeSwipeEnd}
      >
        <section style={styles.heroContent}>
          <div style={styles.heroTopBar}>
            <div style={styles.catSwitchRail} aria-label="ねこを切り替える">
              {(catProfiles.length > 0 ? catProfiles : activeCat ? [activeCat] : []).map(
                (profile) => {
                  const isActive = profile.id === activeCatId;
                  const profileName = getCatName(profile);

                  return (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() =>
                        isActive ? setIsCatSheetOpen(true) : handleCatSelect(profile.id)
                      }
                      style={isActive ? styles.catSwitchChipActive : styles.catSwitchChip}
                      aria-label={`${profileName}に切り替える`}
                    >
                      <span style={styles.catSwitchAvatar} aria-hidden="true">
                        <img
                          src={getHomeCatThumbSrc(profile)}
                          alt=""
                          style={styles.catSwitchAvatarImg}
                        />
                      </span>
                      {isActive ? (
                        <>
                          <span style={styles.catSwitchName}>{profileName}</span>
                          <span style={styles.catSwitchChevron} aria-hidden="true">
                            ▾
                          </span>
                        </>
                      ) : null}
                    </button>
                  );
                },
              )}
            </div>
          </div>
        </section>
      </div>

      <HomeBulletinBoard
        catName={catName}
        items={boardItems}
        records={recordLog}
        onAction={handleBoardAction}
        completion={boardCompletion}
      />

      {isYousuOpen ? (
        <YousuSheet
          title={`${catName}のようす`}
          source={boardSheetSource}
          returnCompletion={boardSheetReturn}
          isReturning={isBoardSheetReturning}
          options={YOUSU_OPTIONS}
          selected={selectedYousu}
          isLocked={isYousuLocked}
          onClose={() => closeBoardInput(setIsYousuOpen)}
          onSelect={recordYousu}
        />
      ) : null}

      {isMugiSheetOpen ? (
        <ActionSheet
          title={`${catName}にしたこと`}
          source={boardSheetSource}
          returnCompletion={boardSheetReturn}
          isReturning={isBoardSheetReturning}
          options={MUGI_OPTIONS}
          selected={selectedMugi}
          onClose={() => closeBoardInput(setIsMugiSheetOpen)}
          onSelect={recordMugi}
        />
      ) : null}

      {isReactionSheetOpen ? (
        <ActionSheet
          title={`${catName}はどんな反応でしたか？`}
          options={REACTION_OPTIONS}
          selected={selectedReaction}
          onClose={() => setIsReactionSheetOpen(false)}
          onSelect={recordReaction}
        />
      ) : null}

      {isDiscoverySheetOpen ? (
        <InfoSheet
          title="見えてきたこと"
          lead={personalityInsight.body}
          body={personalityInsight.sheetBody}
          onClose={() => setIsDiscoverySheetOpen(false)}
        />
      ) : null}

      {isRecentChangeSheetOpen ? (
        <InfoSheet
          title="見えてきたこと"
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

      {isCatSheetOpen ? (
        <CatSheet
          profiles={catProfiles}
          activeCatId={activeCatId}
          onClose={() => setIsCatSheetOpen(false)}
          onSelect={handleCatSelect}
        />
      ) : null}

      {toastText ? <div style={styles.toast}>{toastText}</div> : null}

      <BottomNavigation active="today" />
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
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
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

function YousuSheet({
  title,
  source,
  returnCompletion,
  isReturning,
  options,
  selected,
  isLocked,
  onClose,
  onSelect,
}: {
  title: string;
  source: HomeBoardTransitionSource | null;
  returnCompletion: HomeBoardCompletion | null;
  isReturning: boolean;
  options: string[];
  selected: string | null;
  isLocked: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <HomeMorphSheet
      title={title}
      source={source}
      returnCompletion={returnCompletion}
      isReturning={isReturning}
      onClose={onClose}
    >
      <div style={styles.yousuSheetGrid}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            disabled={isLocked}
            style={{
              ...styles.yousuOption,
              ...(selected === option ? styles.yousuOptionSelected : {}),
              ...(isLocked ? styles.lockedState : {}),
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </HomeMorphSheet>
  );
}

function ActionSheet({
  title,
  source,
  returnCompletion,
  isReturning,
  options,
  selected,
  onClose,
  onSelect,
}: {
  title: string;
  source?: HomeBoardTransitionSource | null;
  returnCompletion?: HomeBoardCompletion | null;
  isReturning?: boolean;
  options: string[];
  selected: string | null;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const content = (
    <div style={styles.sheetGrid}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          style={{
            ...styles.sheetOption,
            ...(selected === option ? styles.sheetOptionSelected : {}),
          }}
        >
          {option}
        </button>
      ))}
    </div>
  );

  if (source === undefined) {
    return (
      <AppBottomSheet title={title} onClose={onClose}>
        {content}
      </AppBottomSheet>
    );
  }

  return (
    <HomeMorphSheet
      title={title}
      source={source}
      returnCompletion={returnCompletion ?? null}
      isReturning={Boolean(isReturning)}
      onClose={onClose}
    >
      {content}
    </HomeMorphSheet>
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
  catName,
  items,
  records,
  onAction,
  completion,
}: {
  catName: string;
  items: HomeBoardItem[];
  records: RecordLogItem[];
  onAction: HomeBoardActionHandler;
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
            title: "みっけ",
            body: "ようす",
            icon: "paw",
            actionLabel: "ようす",
            actionType: "open_mikke",
            surfaceText: "ようす",
          } satisfies HomeBoardItem,
        ];
  const peekItems = getBoardPeekItems(displayItems);
  const actionItems = displayItems.filter((item) =>
    ACTION_BOARD_ITEM_IDS.has(item.id),
  );
  const quickActionItems = actionItems.filter((item) =>
    QUICK_BOARD_ITEM_IDS.has(item.id),
  );
  const supportActionItems = actionItems.filter(
    (item) => !QUICK_BOARD_ITEM_IDS.has(item.id),
  );
  const insightItems = displayItems.filter((item) =>
    ["daily-discovery", "personality-insight"].includes(item.id),
  );
  const collectionItems = displayItems.filter(
    (item) => item.id === "daily-collection-target",
  );
  const heroItem = insightItems[0] ?? collectionItems[0] ?? null;
  const secondaryInsightItems = heroItem
    ? insightItems.filter((item) => item.id !== heroItem.id)
    : insightItems;
  const secondaryCollectionItems = heroItem
    ? collectionItems.filter((item) => item.id !== heroItem.id)
    : collectionItems;
  const supportItems = [...supportActionItems, ...secondaryCollectionItems];
  const unreadCount = displayItems.filter((item) => item.isUnread).length;
  const latestRecord = records[0] ?? null;

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
      aria-label={isOpen ? "あなたへのおすすめ" : "すぐ残す"}
    >
      {isOpen ? <div style={styles.boardHeader}>
        <span style={styles.boardHeaderIcon} aria-hidden="true">
          <SharedSparklesIcon size={18} />
        </span>
        <span style={styles.boardHeaderText}>
          <span style={styles.boardTitle}>あなたへのおすすめ</span>
        </span>
        {unreadCount > 0 ? <span style={styles.boardHeaderMeta}>新着</span> : null}
      </div> : null}

      {!isOpen ? (
        <div style={styles.boardDockFrame}>
          <span style={styles.boardDockShelfGlow} aria-hidden="true" />
          <button
            type="button"
            style={styles.boardDockHeader}
            onClick={() => setIsOpen(true)}
            aria-label="おすすめを開く"
          >
            <span style={styles.boardDockLiftHandle} aria-hidden="true" />
          </button>
          <div style={styles.boardDock} aria-label="あなたへのおすすめ">
            {peekItems.map((item) => {
              const completed = completion?.itemId === item.id ? completion : null;
              const defaultTitle =
                item.id === "daily-collection-target"
                  ? item.surfaceText ?? item.title
                  : item.title;
              const defaultSurfaceText =
                item.id === "daily-collection-target"
                  ? item.title
                  : item.surfaceText;
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
                  onClick={(event) =>
                    onAction(
                      item.actionType,
                      getBoardTransitionSource(
                        event,
                        item,
                        displayTitle,
                        displaySurfaceText,
                      ),
                    )
                  }
                >
                  <span style={styles.boardDockTop}>
                    <span style={styles.boardDockIcon} aria-hidden="true">
                      <BoardIcon icon={item.icon} />
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
                  </span>
                  <span style={styles.boardDockText}>
                    <span style={styles.boardDockLabel}>{displayTitle}</span>
                    <span style={styles.boardDockSub}>{displaySurfaceText}</span>
                  </span>
                  {typeof item.cooldownProgress === "number" ? (
                    <span
                      style={{
                        ...styles.boardDockEdgeProgress,
                        ...getBoardDockEdgeStyle(item),
                      }}
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {isOpen ? (
        <div style={styles.boardOpenContent}>
          {heroItem ? (
            <button
              type="button"
              disabled={heroItem.isDisabled}
              style={{
                ...styles.boardHeroCard,
                ...(heroItem.isDisabled ? styles.boardActionRowDisabled : {}),
              }}
              onClick={() => onAction(heroItem.actionType)}
            >
              <span style={styles.boardHeroTop}>
                <span style={styles.boardHeroIcon} aria-hidden="true">
                  <BoardIcon icon={heroItem.icon} />
                </span>
                {heroItem.isUnread ? (
                  <span style={styles.boardHeroBadge}>新着</span>
                ) : null}
              </span>
              <span style={styles.boardHeroTitle}>{heroItem.title}</span>
              <span style={styles.boardHeroBody}>{heroItem.body}</span>
            </button>
          ) : null}

          {quickActionItems.length > 0 ? (
            <BoardQuickActions items={quickActionItems} onAction={onAction} />
          ) : null}

          {secondaryInsightItems.length > 0 ? (
            <BoardOpenSection
              title="届いていること"
              items={secondaryInsightItems}
              onAction={onAction}
            />
          ) : null}

          {supportItems.length > 0 ? (
            <BoardOpenSection
              title="次に見つけたい"
              items={supportItems}
              onAction={onAction}
            />
          ) : null}

          {latestRecord ? (
            <div style={styles.boardLatestMemo}>
              <span style={styles.boardLatestMemoLabel}>最後の記録</span>
              <span style={styles.boardLatestMemoValue}>
                {formatRecordTime(latestRecord.timestamp)} /{" "}
                {formatRecordKind(latestRecord.type)} / {latestRecord.value}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function BoardQuickActions({
  items,
  onAction,
}: {
  items: HomeBoardItem[];
  onAction: HomeBoardActionHandler;
}) {
  return (
    <div style={styles.boardQuickActions}>
      {items.map((item) => (
        <button
          key={`quick-${item.id}`}
          type="button"
          disabled={item.isDisabled}
          style={{
            ...styles.boardQuickAction,
            ...(item.isDisabled ? styles.boardActionRowDisabled : {}),
          }}
          onClick={() => onAction(item.actionType)}
        >
          <span style={styles.boardQuickIcon} aria-hidden="true">
            <BoardIcon icon={item.icon} />
          </span>
          <span style={styles.boardQuickText}>
            <span style={styles.boardQuickTitle}>{item.title}</span>
            <span style={styles.boardQuickSub}>{item.surfaceText ?? item.body}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function BoardOpenSection({
  title,
  items,
  onAction,
}: {
  title: string;
  items: HomeBoardItem[];
  onAction: HomeBoardActionHandler;
}) {
  return (
    <>
      <div style={styles.boardSectionHeader}>
        <span style={styles.boardSectionTitle}>{title}</span>
      </div>
      <div style={styles.boardActionList}>
        {items.map((item) => (
          <button
            key={`${title}-${item.id}`}
            type="button"
            disabled={item.isDisabled}
            style={{
              ...styles.boardActionRow,
              ...(item.isDisabled ? styles.boardActionRowDisabled : {}),
            }}
            onClick={() => onAction(item.actionType)}
          >
            <span style={styles.boardActionLabel}>{item.actionLabel}</span>
            <span style={styles.boardActionTitle}>{item.title}</span>
            <SharedChevronRightIcon
              size={18}
              style={{ color: "rgba(255,255,255,0.62)", flexShrink: 0 }}
            />
          </button>
        ))}
      </div>
    </>
  );
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

function BoardIcon({ icon }: { icon: HomeBoardItem["icon"] }) {
  return <AppIcon name={icon} size={30} style={styles.boardIconSvg} />;
}

function getBoardPeekItems(items: HomeBoardItem[]) {
  const orderedIds = ["today-mikke", "daily-collection-target", "today-care"];
  const orderedItems = orderedIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is HomeBoardItem => Boolean(item));

  if (orderedItems.length >= 3) {
    return orderedItems.slice(0, 3);
  }

  const fallbackItems = items.filter(
    (item) => !orderedItems.some((orderedItem) => orderedItem.id === item.id),
  );

  return [...orderedItems, ...fallbackItems].slice(0, 3);
}

function getBoardDockEdgeStyle(item: HomeBoardItem): CSSProperties {
  if (typeof item.cooldownProgress !== "number") {
    return {};
  }

  const progress = Math.max(0, Math.min(1, item.cooldownProgress));
  const degrees = Math.round(progress * 360);

  return {
    background:
      `conic-gradient(from -90deg, rgba(255,255,255,0.76) 0deg ${degrees}deg, rgba(255,255,255,0.08) ${degrees}deg 360deg)`,
  };
}

function buildPersonalityInsight(
  recordLog: RecordLogItem[],
  catName: string,
): PersonalityInsight {
  const latestRecord = recordLog[0];
  const yousuRecords = recordLog.filter((record) => record.type === "yousu");
  const careRecords = recordLog.filter((record) => record.type === "mugi");
  const reactionRecords = recordLog.filter(
    (record) => record.type === "reaction",
  );
  const topYousu = getTopRecordValue(yousuRecords);

  if (!latestRecord) {
    return {
      body: `${catName}を見かけたら、まずはひとつだけ残してみる。`,
      surfaceText: "はじめる",
      sheetBody:
        "最初は正確に分析しようとしなくて大丈夫です。見かけた瞬間をひとつ残すことが、この子らしさの入口になります。",
    };
  }

  if (latestRecord.type === "mugi") {
    return {
      body: `「${latestRecord.value}」のあと、どんな反応だったか残すと距離感が見えやすくなります。`,
      surfaceText: "反応を足す",
      sheetBody:
        "してあげたことだけでなく、その後の反応まで残すと、喜びやすい距離・苦手な距離が少しずつ分かれていきます。",
    };
  }

  if (careRecords.length >= 2 && reactionRecords.length === 0) {
    return {
      body: `おせわの後の反応をひとつ足すと、${catName}の好きな距離が残りやすくなります。`,
      surfaceText: "反応待ち",
      sheetBody:
        "おせわの記録に反応がつながると、ただの回数ではなく「この子には何が合いやすいか」を見返しやすくなります。",
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
        body: "ねてる記録は多くなりやすいので、起きた直後のようすをひとつ足すと差が見えます。",
        surfaceText: "違いを見る",
        sheetBody:
          "猫は寝ている時間が長いので、寝ている回数だけでは特徴になりにくいことがあります。起きた直後や移動した後を残すと、この子らしさが見えやすくなります。",
      };
    }

    return {
      body: `「${topYousu.value}」が何度か出ています。次はその前後を一緒に見ると特徴になります。`,
      surfaceText: "くり返し",
      sheetBody:
        "同じようすが繰り返し出てきたら、次は時間・直前の出来事・その後の反応を足すと、単なる記録から特徴に変わっていきます。",
    };
  }

  if (latestRecord.type === "yousu") {
    return {
      body: `「${latestRecord.value}」の前後に、何があったか見てみる。`,
      surfaceText: "前後を見る",
      sheetBody:
        "ようすだけを残すより、その前後に声をかけたか、なでたか、そっとしたかが残ると、この子の流れが見えやすくなります。",
    };
  }

  if (recordLog.length >= 7) {
    return {
      body: "記録が少しずつつながってきました。次はいつもと違う場面をひとつ足してみる。",
      surfaceText: "幅を見る",
      sheetBody:
        "同じ場面だけでなく、少し違う時間や距離で残すと、この子らしさの幅がトリセツに残りやすくなります。",
    };
  }

  return {
    body: `${catName}のいつもと違うところをひとつ残すと、見返す手がかりになります。`,
    surfaceText: "少しずつ",
    sheetBody:
      "大きな変化を探さなくても大丈夫です。少し違う表情や距離感を残すだけで、あとから見返せる手がかりになります。",
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
  yousuRemaining,
  mugiRemaining,
  yousuCooldownProgress,
  mugiCooldownProgress,
}: {
  catName: string;
  discoveryAvailable: boolean;
  hasHomePhoto: boolean;
  recordLog: RecordLogItem[];
  collectionTargetLabel: string | null;
  yousuRemaining: string | null;
  mugiRemaining: string | null;
  yousuCooldownProgress: number | null;
  mugiCooldownProgress: number | null;
}): HomeBoardItem[] {
  const items: HomeBoardItem[] = [];
  const latestRecord = recordLog[0];
  const personalityInsight = buildPersonalityInsight(recordLog, catName);

  items.push({
    id: "today-mikke",
    kind: "mission",
    priority: 5,
    title: "みっけ",
    body: yousuRemaining ? `あと ${yousuRemaining}` : "ようす",
    icon: "paw",
    actionLabel: yousuRemaining ? "待ち時間" : "ようす",
    actionType: "open_mikke",
    isDisabled: Boolean(yousuRemaining),
    surfaceText: yousuRemaining ? `あと ${yousuRemaining}` : "ようす",
    cooldownProgress: yousuCooldownProgress ?? undefined,
  });

  items.push({
    id: "today-care",
    kind: "mission",
    priority: 6,
    title: "おせわ",
    body: mugiRemaining ? `あと ${mugiRemaining}` : "したこと",
    icon: "hand",
    actionLabel: mugiRemaining ? "待ち時間" : "したこと",
    actionType: "open_care",
    isDisabled: Boolean(mugiRemaining),
    surfaceText: mugiRemaining ? `あと ${mugiRemaining}` : "したこと",
    cooldownProgress: mugiCooldownProgress ?? undefined,
  });

  if (discoveryAvailable) {
    items.push({
      id: "daily-discovery",
      kind: "insight",
      priority: 10,
      title: "見えてきたこと",
      body: personalityInsight.body,
      icon: "heart",
      actionLabel: "うちの子らしさ",
      actionType: "open_discovery",
      isUnread: true,
      surfaceText: personalityInsight.surfaceText,
    });
  } else {
    items.push({
      id: "personality-insight",
      kind: "insight",
      priority: 10,
      title: "見えてきたこと",
      body: personalityInsight.body,
      icon: "heart",
      actionLabel: "うちの子らしさ",
      actionType: "open_recent_change",
      surfaceText: latestRecord ? personalityInsight.surfaceText : "はじめる",
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
      body: `${catName}の${collectionTargetLabel}`,
      icon: "camera",
      actionLabel: "写真",
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
      ? (JSON.parse(raw) as Record<string, Record<string, string[] | string>>)
      : {};

    all[catId] ??= {};
    all[catId][slug] = [
      ...normalizeStoredPhotoList(all[catId][slug]),
      dataUrl,
    ];
    window.localStorage.setItem(STORAGE_KEYS.collectionPhotos, JSON.stringify(all));
  } catch {
    // Keep the home flow usable even if local photo storage fails.
  }
}

function normalizeStoredPhotoList(value: string[] | string | undefined) {
  if (typeof value === "string") {
    return [value];
  }

  return value ?? [];
}

function toCssUrl(src: string) {
  return `url("${src.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}")`;
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

function resizeAndEncode(file: File, maxSize = 1200): Promise<string> {
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
      resolve(canvas.toDataURL("image/jpeg", 0.86));
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
    [field]: Date.now() + 60 * 60 * 1000,
  };

  saveLockData(catId, nextData);
  return nextData;
}

function isLocked(lockData: LockData, type: LockType, now = Date.now()) {
  const field = type === "yousu" ? "yousuLockedUntil" : "mugiLockedUntil";
  return now < (lockData[field] || 0);
}

function getRemainingTime(lockData: LockData, type: LockType, now = Date.now()) {
  const field = type === "yousu" ? "yousuLockedUntil" : "mugiLockedUntil";
  const remaining = (lockData[field] || 0) - now;
  if (remaining <= 0) return null;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}`;
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
    backgroundColor: "#1a1a18",
    backgroundSize: "cover",
    backgroundPosition: "center 30%",
    backgroundRepeat: "no-repeat",
    color: "#2A2A28",
    fontFamily:
      'Outfit, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  backgroundPhoto: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100dvh",
    minHeight: "100vh",
    zIndex: 0,
    backgroundColor: "#1a1a18",
    backgroundSize: "cover",
    backgroundPosition: "center 38%",
    backgroundRepeat: "no-repeat",
  },
  contentLayer: {
    position: "relative",
    zIndex: 10,
    width: "100%",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    overflow: "hidden",
    paddingBottom: "calc(92px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
  },
  heroContent: {
    position: "relative",
    flex: "1 1 auto",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    padding: "calc(12px + env(safe-area-inset-top)) 16px 10px",
    boxSizing: "border-box",
  },
  heroTopBar: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  catSwitchRail: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    maxWidth: "min(78vw, 330px)",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  catSwitchChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "50px",
    height: "50px",
    border: "0.5px solid rgba(255,255,255,0.22)",
    borderRadius: "99px",
    background: "rgba(38,34,32,0.32)",
    color: "rgba(255,255,255,0.9)",
    padding: "3px",
    cursor: "pointer",
    backdropFilter: "blur(22px)",
    WebkitBackdropFilter: "blur(22px)",
    boxShadow:
      "0 10px 28px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.16)",
  },
  catSwitchChipActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "9px",
    minWidth: "116px",
    maxWidth: "176px",
    height: "52px",
    border: "0.5px solid rgba(255,255,255,0.3)",
    borderRadius: "99px",
    background: "rgba(54,48,44,0.42)",
    color: "rgba(255,255,255,0.96)",
    padding: "4px 13px 4px 4px",
    fontSize: "15px",
    fontWeight: 680,
    cursor: "pointer",
    backdropFilter: "blur(26px)",
    WebkitBackdropFilter: "blur(26px)",
    boxShadow:
      "0 12px 32px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.2)",
  },
  catSwitchAvatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,0.58)",
    overflow: "hidden",
    flexShrink: 0,
    background: "rgba(255,255,255,0.12)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  catSwitchAvatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  catSwitchName: {
    flex: 1,
    minWidth: 0,
    maxWidth: "92px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    textAlign: "center",
  },
  catSwitchChevron: {
    fontSize: "11px",
    lineHeight: 1,
    opacity: 0.58,
    flexShrink: 0,
  },
  boardPeek: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 18,
    width: "100%",
    height: "280px",
    paddingBottom: 0,
    boxSizing: "border-box",
    border: "none",
    borderRadius: 0,
    background:
      "linear-gradient(to top, rgba(18,16,15,0.58) 0%, rgba(18,16,15,0.34) 42%, rgba(18,16,15,0.02) 100%)",
    boxShadow: "none",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    overflow: "hidden",
    transition:
      "height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
    willChange: "transform",
  },
  boardExpanded: {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 18,
    width: "100%",
    height: "min(74dvh, 640px)",
    border: "none",
    borderTop: "0.5px solid rgba(255,255,255,0.34)",
    borderRadius: "30px 30px 0 0",
    background: "rgba(34,29,28,0.56)",
    boxShadow: "0 -18px 48px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16)",
    backdropFilter: "blur(30px)",
    WebkitBackdropFilter: "blur(30px)",
    overflow: "hidden",
    transition:
      "height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)",
    willChange: "transform",
  },
  boardHeader: {
    width: HOME_NAV_FRAME_WIDTH,
    margin: "0 auto",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "2px 0 10px",
  },
  boardHeaderIcon: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    color: "rgba(255,255,255,0.92)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  boardHeaderText: {
    minWidth: 0,
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  boardTitle: {
    fontSize: "15px",
    fontWeight: 680,
    color: "rgba(255,255,255,0.94)",
    whiteSpace: "nowrap",
  },
  boardHeaderMeta: {
    flexShrink: 0,
    border: "0.5px solid rgba(255,255,255,0.22)",
    borderRadius: "99px",
    color: "rgba(255,255,255,0.72)",
    fontSize: "10px",
    fontWeight: 620,
    padding: "3px 8px",
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
    transform: "translateX(-50%)",
  },
  boardDockShelfGlow: {
    position: "absolute",
    left: "-8px",
    right: "-8px",
    bottom: "-2px",
    height: "112px",
    borderRadius: "28px",
    background:
      "radial-gradient(ellipse at 50% 100%, rgba(0,0,0,0.34), rgba(0,0,0,0.12) 48%, rgba(0,0,0,0) 76%)",
    filter: "blur(16px)",
    opacity: 0.52,
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
    background: "rgba(255,255,255,0.46)",
    boxShadow: "0 1px 10px rgba(0,0,0,0.16)",
  },
  boardDock: {
    width: `calc(100vw - ${HOME_NAV_EDGE_INSET})`,
    display: "flex",
    gap: "10px",
    alignItems: "stretch",
    overflowX: "auto",
    overflowY: "visible",
    scrollbarWidth: "none",
    padding: "0 0 8px",
    scrollSnapType: "x mandatory",
    overscrollBehaviorX: "contain",
    position: "relative",
    zIndex: 1,
  },
  boardOpenContent: {
    height: "calc(100% - 70px)",
    overflowY: "auto",
    padding: `0 ${HOME_NAV_EDGE_INSET} calc(112px + env(safe-area-inset-bottom))`,
    boxSizing: "border-box",
  },
  boardHeroCard: {
    width: "100%",
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "22px",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08))",
    color: "rgba(255,255,255,0.94)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "8px",
    padding: "16px 16px 15px",
    marginBottom: "14px",
    textAlign: "left",
    cursor: "pointer",
    boxShadow:
      "0 14px 36px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.18)",
  },
  boardHeroTop: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  boardHeroIcon: {
    width: "32px",
    height: "32px",
    color: "rgba(255,255,255,0.92)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  boardHeroBadge: {
    border: "0.5px solid rgba(255,255,255,0.2)",
    borderRadius: "99px",
    color: "rgba(255,255,255,0.74)",
    fontSize: "10px",
    fontWeight: 620,
    padding: "3px 8px",
  },
  boardHeroTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "18px",
    fontWeight: 660,
    lineHeight: 1.25,
  },
  boardHeroBody: {
    color: "rgba(255,255,255,0.76)",
    fontSize: "13px",
    fontWeight: 540,
    lineHeight: 1.55,
  },
  boardSectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "6px 2px 8px",
  },
  boardSectionTitle: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "12px",
    fontWeight: 620,
    letterSpacing: "0.02em",
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
    width: "min(142px, calc((100vw - 58px) / 2.16))",
    minWidth: "min(142px, calc((100vw - 58px) / 2.16))",
    minHeight: "80px",
    border: "0.5px solid rgba(255,255,255,0.22)",
    borderRadius: "18px",
    background:
      "linear-gradient(145deg, rgba(72,64,60,0.46), rgba(38,34,32,0.38))",
    color: "rgba(255,255,255,0.94)",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "7px",
    padding: "10px 11px",
    boxSizing: "border-box",
    textAlign: "left",
    cursor: "pointer",
    scrollSnapAlign: "start",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
    overflow: "visible",
    isolation: "isolate",
    boxShadow:
      "0 4px 16px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.15)",
    transition:
      "transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)",
    animation: "boardCardSettle 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both",
    willChange: "transform, opacity",
    zIndex: 1,
  },
  boardDockCardCompleted: {
    transform: "translateY(-2px) scale(1.015)",
    borderColor: "rgba(255,255,255,0.54)",
    background:
      "linear-gradient(145deg, rgba(255,255,255,0.28), rgba(58,52,48,0.48))",
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
    width: "28px",
    height: "28px",
    color: "rgba(255,255,255,0.9)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  boardCompletionMark: {
    width: "21px",
    height: "21px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 0 0 4px rgba(255,255,255,0.14)",
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
  boardDockText: {
    minWidth: 0,
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    position: "relative",
    zIndex: 2,
  },
  boardDockLabel: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "13px",
    fontWeight: 610,
    lineHeight: 1.22,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    overflowWrap: "anywhere",
    textShadow: "0 1px 10px rgba(0,0,0,0.28)",
  },
  boardDockSub: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "11.5px",
    fontWeight: 520,
    lineHeight: 1.18,
    fontVariantNumeric: "tabular-nums",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
    textShadow: "0 1px 10px rgba(0,0,0,0.28)",
  },
  boardUnreadDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 0 0 3px rgba(255,255,255,0.12)",
    flexShrink: 0,
  },
  boardDockEdgeProgress: {
    position: "absolute",
    inset: "-2px",
    borderRadius: "inherit",
    padding: "2px",
    pointerEvents: "none",
    opacity: 1,
    zIndex: 3,
    WebkitMask:
      "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
    WebkitMaskComposite: "xor",
    maskComposite: "exclude",
  },
  boardActionList: {
    display: "grid",
    gap: "7px",
    marginBottom: "14px",
  },
  boardActionRow: {
    width: "100%",
    border: "0.5px solid rgba(255,255,255,0.16)",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
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
    color: "rgba(255,255,255,0.52)",
    fontSize: "11px",
    fontWeight: 620,
  },
  boardActionTitle: {
    color: "rgba(255,255,255,0.9)",
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
    borderTop: "0.5px solid rgba(255,255,255,0.12)",
    margin: "8px 0 0",
    padding: "12px 2px 0",
  },
  boardLatestMemoLabel: {
    flexShrink: 0,
    color: "rgba(255,255,255,0.42)",
    fontSize: "11px",
    fontWeight: 620,
  },
  boardLatestMemoValue: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,0.68)",
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
    background: "rgba(255,255,255,0.10)",
    padding: "8px 10px",
  },
  boardMemoTime: {
    color: "rgba(255,255,255,0.48)",
    fontSize: "11px",
    fontWeight: 600,
  },
  boardMemoKind: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "11px",
    fontWeight: 650,
  },
  boardMemoValue: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,0.86)",
    fontSize: "12px",
    fontWeight: 650,
  },
  boardEmptyText: {
    margin: "0 2px",
    color: "rgba(255,255,255,0.58)",
    fontSize: "12px",
    lineHeight: 1.6,
    fontWeight: 500,
  },
  lockedState: {
    pointerEvents: "none",
    borderColor: "rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.58)",
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
    borderColor: "rgba(255,255,255,0.72)",
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
    borderColor: "rgba(255,255,255,0.72)",
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
    borderColor: "rgba(255,255,255,0.62)",
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
    borderRadius: "99px",
    background: "#2A2A28",
    color: "#FFFFFF",
    padding: "8px 20px",
    fontSize: "13px",
    fontWeight: 560,
    animation: "toastIn 0.2s ease-out",
  },
} satisfies Record<string, CSSProperties>;

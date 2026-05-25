"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, TouchEvent } from "react";
import {
  getAccountSyncOverview,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  getDailyCollectionTarget,
  readStoredCollectionPhotos,
} from "../../lib/collection/dailyTarget";
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

const DISCOVERY_TEXT =
  "昨日の小さな記録から、少しだけリズムが見えてきました。";
const HOME_NAV_FRAME_WIDTH = "min(calc(100% - 28px), 410px)";
const HOME_NAV_EDGE_INSET = "max(14px, calc((100vw - 410px) / 2))";

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
  const [discoveryDismissedToday, setDiscoveryDismissedToday] = useState(false);
  const hasTrackedHomeView = useRef(false);
  const hasTrackedGoogleAuthSuccess = useRef(false);

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
  const dailyCollectionTarget = useMemo(() => {
    if (!activeCatId) {
      return null;
    }

    return getDailyCollectionTarget(
      activeCatId,
      readStoredCollectionPhotos(activeCatId),
    );
  }, [activeCatId]);
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
      }),
    [
      activeCat?.homePhotoDataUrl,
      catName,
      discovery.available,
      dailyCollectionTarget?.label,
      mugiRemaining,
      recordLog,
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
    window.setTimeout(() => setToastText(""), 1500);
  }

  function dismissAccountRestorePrompt() {
    window.localStorage.setItem(
      STORAGE_KEYS.accountRestorePromptDismissed,
      String(Date.now()),
    );
    setIsAccountRestoreSheetOpen(false);
  }

  async function handleAccountRestoreFromSheet() {
    setIsAccountRestoring(true);

    const result = await syncLocalDataWithAccount({
      forceRestore: true,
      restoreIfLocalEmpty: true,
    });

    setIsAccountRestoring(false);

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
    showToast("記録したよ");
    window.setTimeout(() => setIsYousuOpen(false), 1000);
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
    showToast("記録したよ");

    window.setTimeout(() => {
      setIsMugiSheetOpen(false);
      if (Math.random() < 0.33) {
        setIsReactionSheetOpen(true);
      }
    }, 500);
  }

  function recordReaction(value: string) {
    if (!activeCatId) return;

    saveRecord(activeCatId, { type: "reaction", value });
    setSelectedReaction(value);
    setRecordLog(readRecordLog(activeCatId));
    showToast("記録したよ");
    window.setTimeout(() => setIsReactionSheetOpen(false), 500);
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

  function handleDiscoveryClick() {
    if (!activeCatId || !discovery.available) return;

    markDiscoverySeen(activeCatId);
    setDiscoveryDismissedToday(true);
    setIsDiscoverySheetOpen(true);
  }

  function handleBoardAction(actionType: HomeBoardAction) {
    if (actionType === "open_mikke") {
      if (!isYousuLocked) {
        setIsYousuOpen(true);
      }
      return;
    }
    if (actionType === "open_care") {
      if (!isMugiLocked) {
        setIsMugiSheetOpen(true);
      }
      return;
    }
    if (actionType === "open_photo") {
      void handleHomePhotoSelect();
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
      />

      {isYousuOpen ? (
        <YousuSheet
          title={`${catName}のようす`}
          options={YOUSU_OPTIONS}
          selected={selectedYousu}
          isLocked={isYousuLocked}
          onClose={() => setIsYousuOpen(false)}
          onSelect={recordYousu}
        />
      ) : null}

      {isMugiSheetOpen ? (
        <ActionSheet
          title={`${catName}にしたこと`}
          options={MUGI_OPTIONS}
          selected={selectedMugi}
          onClose={() => setIsMugiSheetOpen(false)}
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
          title="発見"
          lead={DISCOVERY_TEXT}
          body="トリセツで見返せます。"
          onClose={() => setIsDiscoverySheetOpen(false)}
        />
      ) : null}

      {isRecentChangeSheetOpen ? (
        <InfoSheet
          title="最近の変化"
          lead={
            latestRecord
              ? `${formatRecordKind(latestRecord.type)}に「${latestRecord.value}」が残っています`
              : "まだ最近の記録がありません"
          }
          body={
            latestRecord
              ? `${catName}の特徴として、トリセツに残していきます。`
              : "みっけを残すと、変化がここに出ます。"
          }
          onClose={() => setIsRecentChangeSheetOpen(false)}
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
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
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

function YousuSheet({
  title,
  options,
  selected,
  isLocked,
  onClose,
  onSelect,
}: {
  title: string;
  options: string[];
  selected: string | null;
  isLocked: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <AppBottomSheet title={title} onClose={onClose}>
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
    </AppBottomSheet>
  );
}

function ActionSheet({
  title,
  options,
  selected,
  onClose,
  onSelect,
}: {
  title: string;
  options: string[];
  selected: string | null;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  return (
    <AppBottomSheet title={title} onClose={onClose}>
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
    </AppBottomSheet>
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
}: {
  catName: string;
  items: HomeBoardItem[];
  records: RecordLogItem[];
  onAction: (actionType: HomeBoardAction) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const boardRailRef = useRef<HTMLDivElement | null>(null);
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
  const unreadCount = displayItems.filter((item) => item.isUnread).length;
  const recentRecords = records.slice(0, 3);

  useEffect(() => {
    boardRailRef.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [catName, displayItems.length, isOpen]);

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
      aria-label="あなたへのおすすめ"
    >
      <button
        type="button"
        style={styles.boardHandleButton}
        onClick={() => setIsOpen((value) => !value)}
        aria-label={isOpen ? "おすすめを閉じる" : "おすすめを開く"}
      >
        <span style={styles.boardHandle} aria-hidden="true" />
      </button>

      <div style={styles.boardHeader}>
        <span style={styles.boardHeaderIcon} aria-hidden="true">
          <SharedSparklesIcon size={18} />
        </span>
        <span style={styles.boardHeaderText}>
          <span style={styles.boardTitle}>あなたへのおすすめ</span>
        </span>
        {unreadCount > 0 ? <span style={styles.boardHeaderMeta}>新着</span> : null}
      </div>

      <div style={styles.boardRailFrame}>
        <div ref={boardRailRef} style={styles.boardRail} aria-label="おすすめカード">
          {displayItems.map((item, index) => (
            <button
              key={item.id}
              type="button"
              disabled={item.isDisabled}
              style={{
                ...styles.boardCard,
                ...(index === 0 ? styles.boardCardPrimary : {}),
                ...(item.isDisabled ? styles.boardCardDisabled : {}),
              }}
              onClick={() => onAction(item.actionType)}
            >
              <span style={styles.boardCardTop}>
                <span style={styles.boardCardIcon} aria-hidden="true">
                  <BoardIcon icon={item.icon} />
                </span>
                {item.isUnread ? <span style={styles.boardUnreadDot} /> : null}
              </span>
              <span style={styles.boardCardTitle}>{item.title}</span>
              {item.surfaceText ? (
                <span style={styles.boardCardSub}>{item.surfaceText}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {isOpen ? (
        <div style={styles.boardOpenContent}>
          <div style={styles.boardSectionHeader}>
            <span style={styles.boardSectionTitle}>アクション</span>
          </div>
          <div style={styles.boardActionList}>
            {displayItems.map((item) => (
              <button
                key={`${item.id}-action`}
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
                  style={{ color: "#888580", flexShrink: 0 }}
                />
              </button>
            ))}
          </div>

          <div style={styles.boardSectionHeader}>
            <span style={styles.boardSectionTitle}>メモ</span>
          </div>
          {recentRecords.length > 0 ? (
            <div style={styles.boardMemoList}>
              {recentRecords.map((record) => (
                <div key={record.id} style={styles.boardMemoRow}>
                  <span style={styles.boardMemoTime}>
                    {formatRecordTime(record.timestamp)}
                  </span>
                  <span style={styles.boardMemoKind}>{formatRecordKind(record.type)}</span>
                  <span style={styles.boardMemoValue}>{record.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.boardEmptyText}>
              まだメモはありません。
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function BoardIcon({ icon }: { icon: HomeBoardItem["icon"] }) {
  return <AppIcon name={icon} size={30} style={styles.boardIconSvg} />;
}

function buildHomeBoardItems({
  catName,
  discoveryAvailable,
  hasHomePhoto,
  recordLog,
  collectionTargetLabel,
  yousuRemaining,
  mugiRemaining,
}: {
  catName: string;
  discoveryAvailable: boolean;
  hasHomePhoto: boolean;
  recordLog: RecordLogItem[];
  collectionTargetLabel: string | null;
  yousuRemaining: string | null;
  mugiRemaining: string | null;
}): HomeBoardItem[] {
  const items: HomeBoardItem[] = [];
  const latestRecord = recordLog[0];

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
    surfaceText: yousuRemaining ? yousuRemaining : "ようす",
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
    surfaceText: mugiRemaining ? mugiRemaining : "したこと",
  });

  if (discoveryAvailable) {
    items.push({
      id: "daily-discovery",
      kind: "insight",
      priority: 10,
      title: "発見",
      body: DISCOVERY_TEXT,
      icon: "heart",
      actionLabel: "見る",
      actionType: "open_discovery",
      isUnread: true,
    });
  } else if (latestRecord) {
    items.push({
      id: "recent-change",
      kind: "insight",
      priority: 20,
      title: "変化",
      body: `${formatRecordKind(latestRecord.type)}「${latestRecord.value}」`,
      icon: "heart",
      actionLabel: "見る",
      actionType: "open_recent_change",
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
    });
  }

  if (collectionTargetLabel) {
    items.push({
      id: "daily-collection-target",
      kind: "collection",
      priority: 45,
      title: "見つけたい姿",
      body: `${catName}の${collectionTargetLabel}`,
      icon: "camera",
      actionLabel: "探す",
      actionType: "go_collection",
      surfaceText: collectionTargetLabel,
    });
  }

  items.push({
    id: "torisetu-progress",
    kind: "notice",
    priority: 50,
    title: "トリセツ",
    body: "見返す",
    icon: "book",
    actionLabel: "見る",
    actionType: "go_torisetu",
  });

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
    height: "264px",
    paddingBottom: "calc(84px + env(safe-area-inset-bottom))",
    boxSizing: "border-box",
    border: "none",
    borderRadius: 0,
    background:
      "linear-gradient(to top, rgba(18,16,15,0.42) 0%, rgba(18,16,15,0.22) 48%, rgba(18,16,15,0) 100%)",
    boxShadow: "none",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    overflow: "hidden",
    transition: "height 0.24s ease, transform 0.24s ease, background 0.24s ease",
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
    transition: "height 0.24s ease, transform 0.24s ease, background 0.24s ease",
  },
  boardHandleButton: {
    width: "100%",
    border: "none",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "9px 0 5px",
    cursor: "pointer",
  },
  boardHandle: {
    width: "42px",
    height: "4px",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.34)",
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
  boardOpenContent: {
    height: "calc(100% - 198px)",
    overflowY: "auto",
    padding: `0 ${HOME_NAV_EDGE_INSET} calc(112px + env(safe-area-inset-bottom))`,
    boxSizing: "border-box",
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
  boardCardDisabled: {
    cursor: "default",
    opacity: 0.72,
  },
  boardCardTop: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  boardCardIcon: {
    width: "32px",
    height: "32px",
    color: "rgba(255,255,255,0.92)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  boardIconSvg: {
    width: "30px",
    height: "30px",
    display: "block",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.1,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
  boardCardTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "13px",
    fontWeight: 680,
    lineHeight: 1.24,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflowWrap: "anywhere",
  },
  boardCardSub: {
    marginTop: "-5px",
    color: "rgba(255,255,255,0.58)",
    fontSize: "11px",
    fontWeight: 650,
    lineHeight: 1.15,
    fontVariantNumeric: "tabular-nums",
  },
  boardUnreadDot: {
    position: "absolute",
    top: "11px",
    right: "11px",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.92)",
    boxShadow: "0 0 0 3px rgba(255,255,255,0.12)",
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
  },
  yousuOptionSelected: {
    borderColor: "rgba(255,255,255,0.72)",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
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
  },
  sheetOptionSelected: {
    borderColor: "rgba(255,255,255,0.72)",
    background: "rgba(255,255,255,0.92)",
    color: "#2A2A28",
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

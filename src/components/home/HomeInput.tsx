"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, TouchEvent } from "react";
import type { RecentEvent } from "../../lib/supabase/queries";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  APP_ACCENT,
  APP_ACCENT_SOFT_BG,
  APP_ACCENT_SOFT_BORDER,
  APP_SHEET,
  APP_SHEET_OVERLAY,
  APP_SUBTLE_SURFACE,
} from "../ui/appTheme";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
  saveCatProfiles,
} from "./homeInputHelpers";
import type { CatProfile } from "./homeInputHelpers";

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
  | "open_photo"
  | "open_discovery"
  | "go_torisetu"
  | "go_collection";

type HomeBoardItem = {
  id: string;
  kind: "mission" | "notice" | "insight" | "tip" | "collection" | "account";
  priority: number;
  title: string;
  body: string;
  icon: "paw" | "heart" | "bell" | "camera" | "book";
  actionLabel: string;
  actionType: HomeBoardAction;
  isUnread?: boolean;
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
const HOME_ACCENT_COLOR = APP_ACCENT;
const HOME_ACCENT_SOFT_BG = APP_ACCENT_SOFT_BG;
const HOME_ACCENT_SOFT_BORDER = APP_ACCENT_SOFT_BORDER;

export function HomeInput({ recentEvents: _recentEvents }: HomeInputProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CatProfile | null>(null);
  const [lockData, setLockData] = useState<LockData>({});
  const [tick, setTick] = useState(Date.now());
  const [isYousuOpen, setIsYousuOpen] = useState(false);
  const [isMikkeSheetOpen, setIsMikkeSheetOpen] = useState(false);
  const [isMugiSheetOpen, setIsMugiSheetOpen] = useState(false);
  const [isReactionSheetOpen, setIsReactionSheetOpen] = useState(false);
  const [isCatSheetOpen, setIsCatSheetOpen] = useState(false);
  const [selectedYousu, setSelectedYousu] = useState<string | null>(null);
  const [selectedMugi, setSelectedMugi] = useState<string | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [recordLog, setRecordLog] = useState<RecordLogItem[]>([]);
  const [homeSwipeStart, setHomeSwipeStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [toastText, setToastText] = useState("");
  const [discoveryDismissedToday, setDiscoveryDismissedToday] = useState(false);

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
    if (params.get("mikke") !== "1") return;

    setIsMikkeSheetOpen(true);
    params.delete("mikke");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, []);

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
        yousuRemaining,
        mugiRemaining,
      }),
    [
      activeCat?.homePhotoDataUrl,
      catName,
      discovery.available,
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

  function recordYousu(value: string) {
    if (!activeCatId || isLocked(lockData, "yousu", Date.now())) return;

    const nextLockData = setLock(activeCatId, "yousu");

    saveRecord(activeCatId, { type: "yousu", value });
    setSelectedYousu(value);
    setRecordLog(readRecordLog(activeCatId));
    setLockData(nextLockData);
    showToast("記録したよ");
    window.setTimeout(() => setIsYousuOpen(false), 1000);
  }

  function recordMugi(value: string) {
    if (!activeCatId || isLocked(lockData, "mugi", Date.now())) return;

    const nextLockData = setLock(activeCatId, "mugi");

    saveRecord(activeCatId, { type: "mugi", value });
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
    showToast("発見を残したよ");
  }

  function handleBoardAction(actionType: HomeBoardAction) {
    if (actionType === "open_mikke") {
      setIsMikkeSheetOpen(true);
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

      {isMikkeSheetOpen ? (
        <MikkeSheet
          catName={catName}
          yousuRemaining={yousuRemaining}
          mugiRemaining={mugiRemaining}
          onClose={() => setIsMikkeSheetOpen(false)}
          onOpenYousu={() => {
            if (isYousuLocked) return;
            setIsMikkeSheetOpen(false);
            setIsYousuOpen(true);
          }}
          onOpenMugi={() => {
            if (isMugiLocked) return;
            setIsMikkeSheetOpen(false);
            setIsMugiSheetOpen(true);
          }}
          onOpenPhoto={() => {
            setIsMikkeSheetOpen(false);
            void handleHomePhotoSelect();
          }}
        />
      ) : null}

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
          title={`${catName}のために、なにかした？`}
          options={MUGI_OPTIONS}
          selected={selectedMugi}
          onClose={() => setIsMugiSheetOpen(false)}
          onSelect={recordMugi}
        />
      ) : null}

      {isReactionSheetOpen ? (
        <ActionSheet
          title={`${catName}はどんな反応をしましたか？`}
          options={REACTION_OPTIONS}
          selected={selectedReaction}
          onClose={() => setIsReactionSheetOpen(false)}
          onSelect={recordReaction}
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

function MikkeSheet({
  catName,
  yousuRemaining,
  mugiRemaining,
  onClose,
  onOpenYousu,
  onOpenMugi,
  onOpenPhoto,
}: {
  catName: string;
  yousuRemaining: string | null;
  mugiRemaining: string | null;
  onClose: () => void;
  onOpenYousu: () => void;
  onOpenMugi: () => void;
  onOpenPhoto: () => void;
}) {
  const choices = [
    {
      key: "yousu",
      label: "ようす",
      sub: yousuRemaining ? yousuRemaining : "なにしてる？",
      icon: <PawIcon />,
      disabled: Boolean(yousuRemaining),
      onClick: onOpenYousu,
    },
    {
      key: "mugi",
      label: "してあげた",
      sub: mugiRemaining ? mugiRemaining : "なにした？",
      icon: <HandIcon />,
      disabled: Boolean(mugiRemaining),
      onClick: onOpenMugi,
    },
    {
      key: "photo",
      label: "写真",
      sub: "いまを残す",
      icon: <CameraIcon />,
      disabled: false,
      onClick: onOpenPhoto,
    },
  ];

  return (
    <>
      <div style={styles.sheetBackdrop} onClick={onClose} />
      <div style={styles.sheet}>
        <div style={styles.sheetHeader}>
          <p style={styles.sheetTitle}>{catName}みっけ</p>
          <button type="button" onClick={onClose} style={styles.sheetCloseButton}>
            <CloseIcon />
          </button>
        </div>
        <div style={styles.mikkeChoiceGrid}>
          {choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              disabled={choice.disabled}
              onClick={choice.onClick}
              style={{
                ...styles.mikkeChoice,
                ...(choice.disabled ? styles.mikkeChoiceDisabled : {}),
              }}
            >
              <span style={styles.mikkeChoiceIcon} aria-hidden="true">
                {choice.icon}
              </span>
              <span style={styles.mikkeChoiceLabel}>{choice.label}</span>
              <span style={styles.mikkeChoiceSub}>{choice.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </>
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
    <>
      <div style={styles.sheetBackdrop} onClick={onClose} />
      <div style={styles.sheet}>
        <div style={styles.sheetHeader}>
          <p style={styles.sheetTitle}>{title}</p>
          <button
            type="button"
            onClick={onClose}
            style={styles.sheetCloseButton}
            aria-label="閉じる"
          >
            <CloseIcon />
          </button>
        </div>
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
      </div>
    </>
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
    <>
      <div style={styles.sheetBackdrop} onClick={onClose} />
      <div style={styles.sheet}>
        <div style={styles.sheetHeader}>
          <p style={styles.sheetTitle}>{title}</p>
          <button
            type="button"
            onClick={onClose}
            style={styles.sheetCloseButton}
            aria-label="閉じる"
          >
            <CloseIcon />
          </button>
        </div>
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
      </div>
    </>
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
    <>
      <div style={styles.sheetBackdrop} onClick={onClose} />
      <div style={styles.sheet}>
        <div style={styles.sheetHeader}>
          <p style={styles.sheetTitle}>ねこを選ぶ</p>
          <button
            type="button"
            onClick={onClose}
            style={styles.sheetCloseButton}
            aria-label="閉じる"
          >
            <CloseIcon />
          </button>
        </div>
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
      </div>
    </>
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
            body: "ようす・してあげた・写真",
            icon: "paw",
            actionLabel: "開く",
            actionType: "open_mikke",
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
          <SparkIcon />
        </span>
        <span style={styles.boardHeaderText}>
          <span style={styles.boardTitle}>あなたへのおすすめ</span>
        </span>
        {unreadCount > 0 ? <span style={styles.boardHeaderMeta}>新着</span> : null}
      </div>

      <div ref={boardRailRef} style={styles.boardRail} aria-label="おすすめカード">
        {displayItems.map((item, index) => (
          <button
            key={item.id}
            type="button"
            style={{
              ...styles.boardCard,
              ...(index === 0 ? styles.boardCardPrimary : {}),
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
          </button>
        ))}
      </div>

      {isOpen ? (
        <div style={styles.boardOpenContent}>
          <div style={styles.boardSectionHeader}>
            <span style={styles.boardSectionTitle}>すぐできること</span>
          </div>
          <div style={styles.boardActionList}>
            {displayItems.map((item) => (
              <button
                key={`${item.id}-action`}
                type="button"
                style={styles.boardActionRow}
                onClick={() => onAction(item.actionType)}
              >
                <span style={styles.boardActionLabel}>{item.actionLabel}</span>
                <span style={styles.boardActionTitle}>{item.title}</span>
                <ChevronIcon />
              </button>
            ))}
          </div>

          <div style={styles.boardSectionHeader}>
            <span style={styles.boardSectionTitle}>最近のメモ</span>
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
              みっけを残すと、ここに小さな変化が並びます。
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function BoardIcon({ icon }: { icon: HomeBoardItem["icon"] }) {
  if (icon === "paw") return <PawIcon />;
  if (icon === "heart") return <HeartIcon />;
  if (icon === "camera") return <CameraIcon />;
  if (icon === "book") return <BookIcon />;
  return <BellIcon />;
}

function buildHomeBoardItems({
  catName,
  discoveryAvailable,
  hasHomePhoto,
  recordLog,
  yousuRemaining,
  mugiRemaining,
}: {
  catName: string;
  discoveryAvailable: boolean;
  hasHomePhoto: boolean;
  recordLog: RecordLogItem[];
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
    body:
      yousuRemaining && mugiRemaining
        ? `次のみっけまで、あと${yousuRemaining}くらいです。`
        : "ようす・してあげた・写真",
    icon: "paw",
    actionLabel: "開く",
    actionType: "open_mikke",
  });

  if (discoveryAvailable) {
    items.push({
      id: "daily-discovery",
      kind: "insight",
      priority: 10,
      title: "今日の小さな発見",
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
      title: "リズムが見えてきた",
      body: `${formatRecordKind(latestRecord.type)}に「${latestRecord.value}」が残っています。少しずつ${catName}のリズムが見えてきます。`,
      icon: "heart",
      actionLabel: "トリセツへ",
      actionType: "go_torisetu",
    });
  }

  if (!hasHomePhoto) {
    items.push({
      id: "home-photo",
      kind: "mission",
      priority: 40,
      title: "写真を置く",
      body: `ホームに${catName}の写真を置くと、開いた瞬間に思い出せます。`,
      icon: "camera",
      actionLabel: "写真を選ぶ",
      actionType: "open_photo",
    });
  }

  items.push({
    id: "torisetu-progress",
    kind: "notice",
    priority: 50,
    title: "トリセツが追加",
    body: "みっけが増えると、機嫌の見分け方や距離の縮め方が少しずつ見えてきます。",
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

function getLockDataKey(catId: string) {
  return `lock_data_${catId}`;
}

function getRecordLogKey(catId: string) {
  return `record_log_${catId}`;
}

function getDiscoveryLogKey(catId: string) {
  return `discovery_log_${catId}`;
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

function PawIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="16" cy="21.2" rx="7.2" ry="5.8" />
      <circle cx="7.5" cy="13" r="3.2" />
      <circle cx="13.1" cy="8.5" r="3.1" />
      <circle cx="18.9" cy="8.5" r="3.1" />
      <circle cx="24.5" cy="13" r="3.2" />
    </svg>
  );
}

function HandIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.5 17V9.2a2 2 0 0 1 4 0V16" />
      <path d="M14.5 15V7.4a2 2 0 0 1 4 0V16" />
      <path d="M18.5 16V9.2a2 2 0 0 1 4 0v8.7" />
      <path d="M10.5 17.2 8.8 15a2 2 0 0 0-3.1 2.4l5.1 7.2c1.5 2.1 3.9 3.2 6.5 3.2h1.2c4.1 0 7.5-3.4 7.5-7.5v-6.8a2 2 0 0 0-4 0" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20s-7-4.2-7-9.6A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.4C19 15.8 12 20 12 20Z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.2 10.5 12 7.8h8l1.8 2.7h3.1a3.1 3.1 0 0 1 3.1 3.1v9.2a3.1 3.1 0 0 1-3.1 3.1H7.1A3.1 3.1 0 0 1 4 22.8v-9.2a3.1 3.1 0 0 1 3.1-3.1h3.1Z" />
      <circle cx="16" cy="18" r="5" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" />
      <path d="M8 7h8M8 11h6" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3.5 13.7 9l5.8 1.7-5.8 1.7L12 18l-1.7-5.6-5.8-1.7L10.3 9 12 3.5Z" />
      <path d="M19 16.5 19.8 19l2.7.8-2.7.8L19 23l-.8-2.4-2.7-.8 2.7-.8.8-2.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ color: "#888580", flexShrink: 0 }}
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
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
    gap: "6px",
    maxWidth: "min(68vw, 286px)",
    overflowX: "auto",
    scrollbarWidth: "none",
  },
  catSwitchChip: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    border: "0.5px solid rgba(224,221,214,0.62)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.70)",
    color: "#2A2A28",
    padding: "3px",
    cursor: "pointer",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.10), inset 0 0.5px 0 rgba(255,255,255,0.55)",
  },
  catSwitchChipActive: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    minWidth: "auto",
    height: "38px",
    border: "0.5px solid rgba(224,221,214,0.72)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.86)",
    color: "#2A2A28",
    padding: "3px 10px 3px 4px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    boxShadow: "0 4px 14px rgba(0,0,0,0.12), inset 0 0.5px 0 rgba(255,255,255,0.62)",
  },
  catSwitchAvatar: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    overflow: "hidden",
    flexShrink: 0,
    background: "rgba(245,243,239,0.82)",
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
    maxWidth: "72px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  catSwitchChevron: {
    fontSize: "10px",
    lineHeight: 1,
    opacity: 0.74,
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
    background: "rgba(36,31,30,0.46)",
    boxShadow: "0 -18px 48px rgba(0,0,0,0.26), inset 0 1px 0 rgba(255,255,255,0.16)",
    backdropFilter: "blur(28px)",
    WebkitBackdropFilter: "blur(28px)",
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
    fontWeight: 760,
    color: "rgba(255,255,255,0.94)",
    whiteSpace: "nowrap",
  },
  boardHeaderMeta: {
    flexShrink: 0,
    border: "0.5px solid rgba(255,255,255,0.22)",
    borderRadius: "99px",
    color: "rgba(255,255,255,0.72)",
    fontSize: "10px",
    fontWeight: 760,
    padding: "3px 8px",
  },
  boardRail: {
    width: HOME_NAV_FRAME_WIDTH,
    margin: "0 auto",
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
    fontWeight: 800,
    letterSpacing: "0.03em",
  },
  boardCard: {
    position: "relative",
    width: "calc((100% - 16px) / 3)",
    minWidth: "calc((100% - 16px) / 3)",
    minHeight: "98px",
    border: "0.5px solid rgba(255,255,255,0.24)",
    borderRadius: "18px",
    background: "rgba(255,255,255,0.14)",
    color: "rgba(255,255,255,0.94)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "10px 6px",
    textAlign: "center",
    cursor: "pointer",
    scrollSnapAlign: "start",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    boxShadow: "inset 0 0.5px 0 rgba(255,255,255,0.16)",
  },
  boardCardPrimary: {
    background: "rgba(255,255,255,0.20)",
  },
  boardCardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  boardCardIcon: {
    width: "38px",
    height: "38px",
    borderRadius: "14px",
    border: "0.5px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.92)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  boardCardTitle: {
    color: "rgba(255,255,255,0.96)",
    fontSize: "12px",
    fontWeight: 820,
    lineHeight: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflowWrap: "anywhere",
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
  boardActionLabel: {
    color: "rgba(255,255,255,0.52)",
    fontSize: "11px",
    fontWeight: 760,
  },
  boardActionTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: "13px",
    fontWeight: 760,
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
    fontWeight: 750,
  },
  boardMemoKind: {
    color: "rgba(255,255,255,0.62)",
    fontSize: "11px",
    fontWeight: 800,
  },
  boardMemoValue: {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "rgba(255,255,255,0.86)",
    fontSize: "12px",
    fontWeight: 750,
  },
  boardEmptyText: {
    margin: "0 2px",
    color: "rgba(255,255,255,0.58)",
    fontSize: "12px",
    lineHeight: 1.6,
    fontWeight: 650,
  },
  lockedState: {
    pointerEvents: "none",
    background: "rgba(255,255,255,0.78)",
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
    fontWeight: 700,
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
    border: "0.5px solid #E0DDD6",
    borderRadius: "10px",
    background: "rgba(247, 245, 239, 0.85)",
    color: "#2A2A28",
    padding: "10px 4px",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "center",
    cursor: "pointer",
  },
  yousuOptionSelected: {
    borderColor: HOME_ACCENT_COLOR,
    background: HOME_ACCENT_COLOR,
    color: "#FFFFFF",
  },
  sheetBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 99,
    ...APP_SHEET_OVERLAY,
  },
  sheet: {
    position: "fixed",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    borderRadius: "24px 24px 0 0",
    ...APP_SHEET,
    padding: "24px 16px calc(40px + env(safe-area-inset-bottom))",
    animation: "slideUp 0.25s ease-out",
  },
  sheetHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  sheetTitle: {
    margin: 0,
    color: "#2A2A28",
    fontSize: "17px",
    fontWeight: 700,
    lineHeight: 1.5,
  },
  sheetCloseButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "32px",
    height: "32px",
    flexShrink: 0,
    border: "none",
    borderRadius: "50%",
    background: "transparent",
    color: "#888580",
    cursor: "pointer",
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
  mikkeChoiceGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "10px",
    marginTop: "16px",
  },
  mikkeChoice: {
    ...APP_SUBTLE_SURFACE,
    minHeight: "118px",
    borderRadius: "16px",
    color: "#2A2A28",
    padding: "14px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",
    textAlign: "center",
    cursor: "pointer",
  },
  mikkeChoiceDisabled: {
    opacity: 0.48,
    cursor: "not-allowed",
  },
  mikkeChoiceIcon: {
    width: "34px",
    height: "34px",
    color: HOME_ACCENT_COLOR,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  mikkeChoiceLabel: {
    color: "#2A2A28",
    fontSize: "14px",
    fontWeight: 720,
    lineHeight: 1.25,
  },
  mikkeChoiceSub: {
    color: "#74716a",
    fontSize: "11px",
    fontWeight: 650,
    lineHeight: 1.25,
  },
  sheetOption: {
    ...APP_SUBTLE_SURFACE,
    borderRadius: "14px",
    color: "#2A2A28",
    padding: "20px 12px",
    fontSize: "15px",
    fontWeight: 600,
    textAlign: "center",
    cursor: "pointer",
  },
  sheetOptionSelected: {
    borderColor: HOME_ACCENT_COLOR,
    background: HOME_ACCENT_COLOR,
    color: "#FFFFFF",
  },
  catList: {
    display: "grid",
    gap: "8px",
    marginTop: "16px",
  },
  catListItem: {
    ...APP_SUBTLE_SURFACE,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: "14px",
    padding: "14px 16px",
    color: "#2A2A28",
    cursor: "pointer",
  },
  catListItemActive: {
    borderColor: HOME_ACCENT_COLOR,
    background: HOME_ACCENT_SOFT_BG,
  },
  catListName: {
    fontSize: "15px",
    fontWeight: 700,
  },
  catListMark: {
    color: HOME_ACCENT_COLOR,
    fontSize: "12px",
    fontWeight: 600,
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
    fontWeight: 600,
    animation: "toastIn 0.2s ease-out",
  },
} satisfies Record<string, CSSProperties>;

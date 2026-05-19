"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { RecentEvent } from "../../lib/supabase/queries";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  LIGHT_LEVELS,
  getDebugLightScore,
  getLightLevel,
  getLightText,
  getPhotoStyle,
  type LightLevelKey,
} from "../ui/lightTheme";
import {
  APP_ACCENT,
  APP_ACCENT_SOFT_BG,
  APP_ACCENT_SOFT_BORDER,
  APP_SHEET,
  APP_SHEET_OVERLAY,
  APP_SUBTLE_SURFACE,
} from "../ui/appTheme";
import { getFrostedPaperCardStyle, getGlassPillStyle } from "../ui/surfaceStyles";
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

type LightData = {
  score: number;
  lastUpdated: number;
  todayYousuCount: number;
  todayMugiCount: number;
  todayDate: string;
};

type LockData = {
  yousuLockedUntil?: number;
  mugiLockedUntil?: number;
};

type LockType = "yousu" | "mugi";

const HOME_FALLBACK_PHOTO_SRC = "/sample-cats/mugi-hero.png";
const ENABLE_LIGHT_DEBUG = process.env.NODE_ENV !== "production";

type RecordLogItem = {
  id: string;
  type: "yousu" | "mugi" | "reaction";
  value: string;
  timestamp: number;
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
const HOME_ACCENT_COLOR = APP_ACCENT;
const HOME_ACCENT_SOFT_BG = APP_ACCENT_SOFT_BG;
const HOME_ACCENT_SOFT_BORDER = APP_ACCENT_SOFT_BORDER;

export function HomeInput({ recentEvents: _recentEvents }: HomeInputProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CatProfile | null>(null);
  const [lightData, setLightData] = useState<LightData | null>(null);
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
  const [toastText, setToastText] = useState("");
  const [recordGlowActive, setRecordGlowActive] = useState(false);
  const [isLightDebugEnabled, setIsLightDebugEnabled] = useState(false);
  const [debugLightLevel, setDebugLightLevel] = useState<LightLevelKey | null>(null);
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

    if (ENABLE_LIGHT_DEBUG) {
      const params = new URLSearchParams(window.location.search);
      setIsLightDebugEnabled(params.get("lightDebug") === "1");
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const catName = activeCat ? getCatName(activeCat) : "ねこ";
  const photoSrc =
    activeCat?.homePhotoDataUrl ??
    activeCat?.avatarDataUrl ??
    HOME_FALLBACK_PHOTO_SRC;
  const homePhotoPosition = activeCat?.homePhotoPosition ?? "center 38%";
  const liveLightScore = lightData ? getCurrentScore(lightData, tick) : 0;
  const lightScore = debugLightLevel ? getDebugLightScore(debugLightLevel) : liveLightScore;
  const lightLevel = getLightLevel(lightScore);
  const lightConfig = LIGHT_LEVELS[lightLevel];
  const dynamicCardStyle = getFrostedPaperCardStyle(lightConfig);
  const dynamicPillStyle = getGlassPillStyle(lightConfig);
  const lightText = getLightText(lightLevel, catName);
  const shouldShowLightText = lightLevel <= 2;
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
    setLightData(resetIfNewDay(readLightData(catId)));
    setLockData(readLockData(catId));
    setDiscoveryDismissedToday(hasSeenDiscoveryToday(catId));

    const records = readRecordLog(catId);
    const latestYousu = records.find((record) => record.type === "yousu");
    const latestMugi = records.find((record) => record.type === "mugi");

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

  function showToast(message: string) {
    setToastText(message);
    window.setTimeout(() => setToastText(""), 1500);
  }

  function triggerRecordGlow() {
    setRecordGlowActive(true);
    window.setTimeout(() => setRecordGlowActive(false), 1100);
  }

  function recordYousu(value: string) {
    if (!activeCatId || isLocked(lockData, "yousu", Date.now())) return;

    const nextLightData = updateLightForRecord(activeCatId, "yousu");
    const nextLockData = setLock(activeCatId, "yousu");

    saveRecord(activeCatId, { type: "yousu", value });
    setSelectedYousu(value);
    setLightData(nextLightData);
    setLockData(nextLockData);
    triggerRecordGlow();
    showToast("記録したよ");
    window.setTimeout(() => setIsYousuOpen(false), 1000);
  }

  function recordMugi(value: string) {
    if (!activeCatId || isLocked(lockData, "mugi", Date.now())) return;

    const nextLightData = updateLightForRecord(activeCatId, "mugi");
    const nextLockData = setLock(activeCatId, "mugi");

    saveRecord(activeCatId, { type: "mugi", value });
    setSelectedMugi(value);
    setLightData(nextLightData);
    setLockData(nextLockData);
    triggerRecordGlow();
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
    triggerRecordGlow();
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
        triggerRecordGlow();
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
          ...getPhotoStyle(lightConfig),
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.overlayLayer,
          background: lightConfig.mainOverlay,
          zIndex: 1,
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.overlayLayer,
          background: lightConfig.cornerGlow,
          zIndex: 2,
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.overlayLayer,
          background: lightConfig.ambientGlow,
          zIndex: 3,
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.overlayLayer,
          background: lightConfig.coldOverlay,
          zIndex: 4,
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.overlayLayer,
          background: lightConfig.fogOverlay,
          zIndex: 5,
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.overlayLayer,
          background: lightConfig.goldenBloom,
          zIndex: 6,
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.overlayLayer,
          background: lightConfig.bottomWarmth,
          zIndex: 7,
        }}
        aria-hidden="true"
      />
      <div
        style={{
          ...styles.recordGlowLayer,
          opacity: recordGlowActive ? 1 : 0,
        }}
        aria-hidden="true"
      />
      <div style={styles.contentLayer}>
        <section style={styles.heroContent}>
          <div style={styles.heroTopBar}>
        <button
          type="button"
          onClick={() => setIsCatSheetOpen(true)}
          style={{
            ...styles.catSwitchButton,
            ...dynamicPillStyle,
          }}
        >
          <span>{catName}</span>
          <span aria-hidden="true">▾</span>
        </button>
        <div
          style={{
            ...styles.lightPill,
            ...dynamicPillStyle,
          }}
        >
          <BulbIcon color={lightConfig.bulbColor} glow={lightConfig.bulbGlow} />
          <div style={styles.lightTrack}>
            <div
              style={{
                ...styles.lightFill,
                width: `${lightConfig.barWidth}%`,
                backgroundColor: lightConfig.barColor,
              }}
            />
          </div>
        </div>
          </div>
        {shouldShowLightText ? <p style={styles.lightText}>{lightText}</p> : null}
      </section>

        <section style={styles.controlArea}>
          <button
            type="button"
            onClick={() => setIsMikkeSheetOpen(true)}
            style={{
              ...dynamicCardStyle,
              ...styles.mikkeButton,
            }}
          >
            <span style={styles.mikkeIconRow} aria-hidden="true">
              <span style={styles.primaryIconBadge}>
                <PawIcon />
              </span>
            </span>
            <span style={styles.mikkeButtonText}>みっけ</span>
          </button>

        <button
          type="button"
          onClick={handleDiscoveryClick}
          style={{
            ...(discovery.available ? styles.discoveryCard : styles.discoveryEmptyCard),
            ...dynamicCardStyle,
            ...styles.discoverySurface,
          }}
        >
          {discovery.available ? (
            <>
              <span style={styles.discoveryIcon}>
                <HeartIcon />
              </span>
              <span style={styles.discoveryTextGroup}>
                <span style={styles.discoveryText}>{DISCOVERY_TEXT}</span>
              </span>
              <ChevronIcon />
            </>
          ) : (
            <span style={styles.discoveryEmptyGroup}>
              <span style={styles.discoveryEmptyText}>
                {catName}のことを記録すると、発見が届くよ
              </span>
            </span>
          )}
        </button>
      </section>
      </div>

      {ENABLE_LIGHT_DEBUG && isLightDebugEnabled ? (
        <div style={styles.lightDebugPanel}>
          <span style={styles.lightDebugLabel}>
            Lv{lightLevel} / {Math.round(lightScore)}
          </span>
          {([1, 3, 5] as const).map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setDebugLightLevel(level)}
              style={
                debugLightLevel === level
                  ? { ...styles.lightDebugButton, ...styles.lightDebugButtonActive }
                  : styles.lightDebugButton
              }
            >
              Lv{level}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDebugLightLevel(null)}
            style={
              debugLightLevel === null
                ? { ...styles.lightDebugButton, ...styles.lightDebugButtonActive }
                : styles.lightDebugButton
            }
          >
            Live
          </button>
        </div>
      ) : null}

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

function getLightDataKey(catId: string) {
  return `light_data_${catId}`;
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

function createDefaultLightData(): LightData {
  return {
    score: 0,
    lastUpdated: Date.now(),
    todayYousuCount: 0,
    todayMugiCount: 0,
    todayDate: getTodayJST(),
  };
}

function readLightData(catId: string): LightData {
  try {
    const raw = window.localStorage.getItem(getLightDataKey(catId));
    if (!raw) return createDefaultLightData();
    const parsed = JSON.parse(raw) as Partial<LightData>;

    return {
      score: typeof parsed.score === "number" ? parsed.score : 0,
      lastUpdated:
        typeof parsed.lastUpdated === "number" ? parsed.lastUpdated : Date.now(),
      todayYousuCount:
        typeof parsed.todayYousuCount === "number" ? parsed.todayYousuCount : 0,
      todayMugiCount:
        typeof parsed.todayMugiCount === "number" ? parsed.todayMugiCount : 0,
      todayDate: parsed.todayDate ?? getTodayJST(),
    };
  } catch {
    return createDefaultLightData();
  }
}

function saveLightData(catId: string, data: LightData) {
  // TODO: Supabase移行時はここを書き換え
  window.localStorage.setItem(getLightDataKey(catId), JSON.stringify(data));
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

function resetIfNewDay(lightData: LightData): LightData {
  const today = getTodayJST();

  if (lightData.todayDate !== today) {
    return {
      ...lightData,
      todayYousuCount: 0,
      todayMugiCount: 0,
      todayDate: today,
    };
  }

  return lightData;
}

function updateLightForRecord(catId: string, type: LockType): LightData {
  const lightData = resetIfNewDay(readLightData(catId));
  const currentScore = getCurrentScore(lightData, Date.now());
  const gain = getScoreGain(lightData);
  const nextData: LightData = {
    ...lightData,
    score: Math.min(100, currentScore + gain),
    lastUpdated: Date.now(),
    todayYousuCount:
      type === "yousu"
        ? lightData.todayYousuCount + 1
        : lightData.todayYousuCount,
    todayMugiCount:
      type === "mugi"
        ? lightData.todayMugiCount + 1
        : lightData.todayMugiCount,
  };

  saveLightData(catId, nextData);
  return nextData;
}

function getScoreGain(lightData: LightData) {
  const totalCount =
    (lightData.todayYousuCount || 0) + (lightData.todayMugiCount || 0);
  if (totalCount === 0) return 10;
  if (totalCount === 1) return 7;
  if (totalCount === 2) return 3;
  return 0;
}

function getCurrentScore(lightData: LightData, now = Date.now()) {
  const hoursSinceLast = (now - lightData.lastUpdated) / (1000 * 60 * 60);
  const decayPerHour = 100 / 480;
  const decayed = lightData.score - decayPerHour * hoursSinceLast;

  return Math.max(0, Math.min(100, decayed));
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

function BulbIcon({ color, glow }: { color: string; glow: string }) {
  return (
    <span
      style={{
        width: "16px",
        height: "20px",
        borderRadius: "50%",
        boxShadow: glow,
        color,
        filter: glow === "none" ? "none" : `drop-shadow(0 0 4px ${color})`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 1s ease-in-out",
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 20" width="16" height="20" fill="none">
        <path
          d="M8 1.6a5.7 5.7 0 0 0-3.4 10.3c.7.5 1 1.2 1 2.1h4.8c0-.9.4-1.6 1-2.1A5.7 5.7 0 0 0 8 1.6Z"
          fill="currentColor"
        />
        <path d="M5.7 15.1h4.6v1.4H5.7zM6.2 17.2h3.6v1.2H6.2z" fill="currentColor" />
      </svg>
    </span>
  );
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
  overlayLayer: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100dvh",
    minHeight: "100vh",
    pointerEvents: "none",
    transition: "background 1s ease-in-out",
  },
  recordGlowLayer: {
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100dvh",
    minHeight: "100vh",
    zIndex: 8,
    pointerEvents: "none",
    background:
      "radial-gradient(circle at 84% 12%, rgba(255,220,128,0.34) 0%, rgba(255,194,90,0.16) 24%, rgba(255,194,90,0) 48%), radial-gradient(ellipse at 50% 72%, rgba(255,232,190,0.12) 0%, rgba(255,232,190,0) 36%)",
    transition: "opacity 1s ease-out",
  },
  lightDebugPanel: {
    position: "fixed",
    right: "12px",
    bottom: "calc(92px + env(safe-area-inset-bottom))",
    zIndex: 140,
    display: "flex",
    alignItems: "center",
    gap: "5px",
    border: "0.5px solid rgba(255,255,255,0.22)",
    borderRadius: "99px",
    background: "rgba(24,24,22,0.58)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
    padding: "6px",
  },
  lightDebugLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: "10px",
    fontWeight: 700,
    padding: "0 5px",
    whiteSpace: "nowrap",
  },
  lightDebugButton: {
    minWidth: "34px",
    height: "26px",
    border: "0.5px solid rgba(255,255,255,0.20)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.82)",
    fontSize: "10px",
    fontWeight: 700,
    cursor: "pointer",
  },
  lightDebugButtonActive: {
    border: "0.5px solid rgba(245,200,66,0.65)",
    background: "rgba(245,200,66,0.28)",
    color: "#fff",
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
  catSwitchButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "0.5px solid rgba(224,221,214,0.7)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.85)",
    color: "#2A2A28",
    padding: "7px 12px",
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    backdropFilter: "blur(12px)",
  },
  lightPill: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    border: "0.5px solid rgba(224,221,214,0.7)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.85)",
    padding: "5px 10px",
    backdropFilter: "blur(12px)",
  },
  lightTrack: {
    width: "60px",
    height: "6px",
    borderRadius: "99px",
    background: "#E0DDD6",
    overflow: "hidden",
  },
  lightFill: {
    height: "100%",
    borderRadius: "99px",
    transition: "width 0.5s ease-in-out, background-color 0.5s ease-in-out",
  },
  lightText: {
    alignSelf: "flex-start",
    maxWidth: "min(100%, 330px)",
    margin: "auto 0 0",
    padding: "0 2px",
    color: "rgba(255,255,255,0.95)",
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1.6,
    textShadow: "0 1px 4px rgba(0,0,0,0.36)",
  },
  controlArea: {
    flex: "0 0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "transparent",
    padding: "0 18px 18px",
    boxSizing: "border-box",
  },
  mikkeButton: {
    width: "100%",
    minHeight: "88px",
    alignSelf: "center",
    border: "1px solid rgba(255,255,255,0.78)",
    borderRadius: "30px",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(238,237,231,0.92) 100%)",
    color: HOME_ACCENT_COLOR,
    padding: "14px 22px",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    cursor: "pointer",
    boxShadow:
      "0 12px 28px rgba(20,18,15,0.18), inset 0 1px 0 rgba(255,255,255,0.92), inset 0 -1px 0 rgba(180,176,166,0.18)",
    transform: "translateY(0)",
    transition: "transform 0.12s ease, box-shadow 0.12s ease, background 0.2s ease",
  },
  mikkeIconRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0",
    width: "42px",
    height: "42px",
    borderRadius: "16px",
    background: "rgba(86,96,82,0.09)",
    border: "0.5px solid rgba(86,96,82,0.12)",
    color: HOME_ACCENT_COLOR,
    flexShrink: 0,
  },
  mikkeButtonText: {
    color: "#2A2A28",
    fontSize: "27px",
    fontWeight: 800,
    lineHeight: 1.25,
    letterSpacing: 0,
    textShadow: "0 1px 0 rgba(255,255,255,0.55)",
  },
  primaryIconBadge: {
    width: "40px",
    height: "30px",
    borderRadius: "12px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: HOME_ACCENT_COLOR,
    background: "transparent",
    border: "none",
    boxShadow: "none",
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
  discoveryCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    border: "0.5px solid #E0DDD6",
    minHeight: "58px",
    borderRadius: "18px",
    background: "rgba(247, 245, 239, 0.85)",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
  },
  discoveryEmptyCard: {
    width: "100%",
    border: "0.5px solid #E0DDD6",
    minHeight: "54px",
    borderRadius: "18px",
    background: "rgba(247, 245, 239, 0.85)",
    padding: "12px 14px",
    textAlign: "center",
  },
  discoverySurface: {
    background: "rgba(255,255,255,0.88)",
    boxShadow: "0 3px 10px rgba(52, 50, 46, 0.06)",
    padding: "9px 14px",
  },
  discoveryIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "30px",
    height: "30px",
    flexShrink: 0,
    borderRadius: "50%",
    border: "none",
    background: "transparent",
    color: HOME_ACCENT_COLOR,
  },
  discoveryTextGroup: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: "3px",
  },
  discoveryText: {
    color: "#2A2A28",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.4,
    textShadow: "0 1px 0 rgba(255,255,255,0.22)",
  },
  discoveryEmptyGroup: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "3px",
  },
  discoveryEmptyText: {
    color: "#56534d",
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1.4,
    textShadow: "0 1px 0 rgba(255,255,255,0.22)",
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

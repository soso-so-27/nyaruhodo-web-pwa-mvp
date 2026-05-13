"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { RecentEvent } from "../../lib/supabase/queries";
import { BottomNavigation } from "../navigation/BottomNavigation";
import {
  getActiveCatProfile,
  getCatName,
  readActiveCatId,
  readCatProfiles,
  saveActiveCatId,
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

export function HomeInput({ recentEvents: _recentEvents }: HomeInputProps) {
  const [catProfiles, setCatProfiles] = useState<CatProfile[]>([]);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<CatProfile | null>(null);
  const [lightData, setLightData] = useState<LightData | null>(null);
  const [lockData, setLockData] = useState<LockData>({});
  const [tick, setTick] = useState(Date.now());
  const [isYousuOpen, setIsYousuOpen] = useState(false);
  const [isMugiSheetOpen, setIsMugiSheetOpen] = useState(false);
  const [isReactionSheetOpen, setIsReactionSheetOpen] = useState(false);
  const [isCatSheetOpen, setIsCatSheetOpen] = useState(false);
  const [selectedYousu, setSelectedYousu] = useState<string | null>(null);
  const [selectedMugi, setSelectedMugi] = useState<string | null>(null);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
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

  const catName = activeCat ? getCatName(activeCat) : "ねこ";
  const photoSrc = activeCat?.avatarDataUrl ?? null;
  const lightScore = lightData ? getCurrentScore(lightData, tick) : 0;
  const lightLevel = getLightLevel(lightScore);
  const lightColor = getLightColor(lightLevel);
  const lightText = getLightText(lightLevel, catName);
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

  function recordYousu(value: string) {
    if (!activeCatId || isLocked(lockData, "yousu", Date.now())) return;

    const nextLightData = updateLightForRecord(activeCatId, "yousu");
    const nextLockData = setLock(activeCatId, "yousu");

    saveRecord(activeCatId, { type: "yousu", value });
    setSelectedYousu(value);
    setLightData(nextLightData);
    setLockData(nextLockData);
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
    showToast("記録したよ");
    window.setTimeout(() => setIsReactionSheetOpen(false), 500);
  }

  function handleDiscoveryClick() {
    if (!activeCatId || !discovery.available) return;

    markDiscoverySeen(activeCatId);
    setDiscoveryDismissedToday(true);
    showToast("発見を残したよ");
  }

  return (
    <main style={styles.page}>
      <section
        style={{
          ...styles.photoArea,
          ...(photoSrc
            ? {
                backgroundImage: `url(${photoSrc})`,
                backgroundSize: "cover",
                backgroundPosition: "center top",
              }
            : { background: "linear-gradient(160deg, #C8C4BC, #A8A49C)" }),
        }}
      >
        <div style={styles.photoOverlay} aria-hidden="true" />
        <button
          type="button"
          onClick={() => setIsCatSheetOpen(true)}
          style={styles.catSwitchButton}
        >
          <span>{catName}</span>
          <span aria-hidden="true">▾</span>
        </button>
        <div style={styles.lightPill}>
          <BulbIcon color={lightColor} glow={lightLevel === 5} />
          <div style={styles.lightTrack}>
            <div
              style={{
                ...styles.lightFill,
                width: `${lightScore}%`,
                backgroundColor: lightColor,
              }}
            />
          </div>
        </div>
        <p style={styles.lightText}>{lightText}</p>
      </section>

      <section style={styles.controlArea}>
        {isYousuOpen ? (
          <div style={styles.yousuPanel}>
            <div style={styles.yousuHeader}>
              <span style={styles.yousuTitle}>{catName}のようす</span>
              <button
                type="button"
                onClick={() => setIsYousuOpen(false)}
                style={styles.closeButton}
                aria-label="閉じる"
              >
                <CloseIcon />
              </button>
            </div>
            <div style={styles.yousuGrid}>
              {YOUSU_OPTIONS.map((option) => {
                const isSelected = selectedYousu === option;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => recordYousu(option)}
                    disabled={isYousuLocked}
                    style={{
                      ...styles.yousuOption,
                      ...(isSelected ? styles.yousuOptionSelected : {}),
                      ...(isYousuLocked ? styles.lockedState : {}),
                    }}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={styles.primaryCards}>
            <button
              type="button"
              onClick={() => setIsYousuOpen(true)}
              disabled={isYousuLocked}
              style={{
                ...styles.primaryCard,
                ...(isYousuLocked ? styles.lockedState : {}),
              }}
            >
              <PawIcon />
              {yousuRemaining ? (
                <span style={styles.remainingTime}>{yousuRemaining}</span>
              ) : null}
              <span style={styles.primaryCardText}>{catName}のようす</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMugiSheetOpen(true)}
              disabled={isMugiLocked}
              style={{
                ...styles.primaryCard,
                ...(isMugiLocked ? styles.lockedState : {}),
              }}
            >
              <HandIcon />
              {mugiRemaining ? (
                <span style={styles.remainingTime}>{mugiRemaining}</span>
              ) : null}
              <span style={styles.primaryCardText}>{catName}へ</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={handleDiscoveryClick}
          style={
            discovery.available ? styles.discoveryCard : styles.discoveryEmptyCard
          }
        >
          {discovery.available ? (
            <>
              <span style={styles.discoveryIcon}>
                <HeartIcon />
              </span>
              <span style={styles.discoveryTextGroup}>
                <span style={styles.discoveryLabel}>きょうの小さな発見</span>
                <span style={styles.discoveryText}>{DISCOVERY_TEXT}</span>
              </span>
              <ChevronIcon />
            </>
          ) : (
            <span style={styles.discoveryEmptyText}>
              {catName}のことを記録すると、発見が届くよ
            </span>
          )}
        </button>
      </section>

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

function getLightLevel(score: number) {
  if (score <= 20) return 1;
  if (score <= 40) return 2;
  if (score <= 60) return 3;
  if (score <= 80) return 4;
  return 5;
}

function getLightColor(level: number) {
  if (level === 1) return "#C8C4BC";
  if (level === 2) return "#DDD5A8";
  if (level === 3) return "#EEE080";
  return "#F5C842";
}

function getLightText(level: number, name: string) {
  if (level === 1) return `${name}のことが、少し遠くなってきたかも`;
  if (level === 2) return `${name}のこと、もう少し見てあげたいな`;
  if (level === 3) return `${name}のことが、だんだんわかってきたかも`;
  if (level === 4) return `${name}のこと、最近よくわかる気がする`;
  return `${name}のこと、だいぶわかってきたよ`;
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

function BulbIcon({ color, glow }: { color: string; glow: boolean }) {
  return (
    <svg
      viewBox="0 0 16 20"
      width="16"
      height="20"
      fill="none"
      aria-hidden="true"
      style={glow ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
    >
      <path
        d="M8 1.6a5.7 5.7 0 0 0-3.4 10.3c.7.5 1 1.2 1 2.1h4.8c0-.9.4-1.6 1-2.1A5.7 5.7 0 0 0 8 1.6Z"
        fill={color}
      />
      <path d="M5.7 15.1h4.6v1.4H5.7zM6.2 17.2h3.6v1.2H6.2z" fill={color} />
    </svg>
  );
}

function PawIcon() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" fill="currentColor">
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
    minHeight: "100svh",
    height: "100svh",
    overflow: "hidden",
    background: "#FAF9F7",
    color: "#2A2A28",
    fontFamily:
      'Outfit, "Zen Kaku Gothic New", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  photoArea: {
    position: "relative",
    height: "40svh",
    minHeight: "280px",
    overflow: "hidden",
  },
  photoOverlay: {
    position: "absolute",
    inset: 0,
    background: "rgba(240, 237, 232, 0.25)",
    pointerEvents: "none",
  },
  catSwitchButton: {
    position: "absolute",
    top: "calc(12px + env(safe-area-inset-top))",
    left: "16px",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    border: "0.5px solid rgba(224,221,214,0.7)",
    borderRadius: "99px",
    background: "rgba(255,255,255,0.85)",
    color: "#2A2A28",
    padding: "7px 12px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    backdropFilter: "blur(12px)",
  },
  lightPill: {
    position: "absolute",
    top: "calc(12px + env(safe-area-inset-top))",
    right: "16px",
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
    position: "absolute",
    right: "16px",
    bottom: "12px",
    left: "16px",
    margin: 0,
    color: "rgba(255,255,255,0.95)",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.6,
    textShadow: "0 1px 3px rgba(0,0,0,0.3)",
  },
  controlArea: {
    height: "60svh",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    background: "#FAF9F7",
    padding: "16px 16px calc(86px + env(safe-area-inset-bottom))",
  },
  primaryCards: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  primaryCard: {
    minHeight: "116px",
    border: "0.5px solid #E0DDD6",
    borderRadius: "16px",
    background: "#F7F5EF",
    color: "#6B9E82",
    padding: "18px 12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    cursor: "pointer",
    transition: "transform 0.1s",
  },
  primaryCardText: {
    color: "#2A2A28",
    fontSize: "14px",
    fontWeight: 600,
  },
  remainingTime: {
    color: "#888580",
    fontSize: "11px",
    fontWeight: 600,
  },
  lockedState: {
    opacity: 0.4,
    pointerEvents: "none",
  },
  yousuPanel: {
    border: "0.5px solid #E0DDD6",
    borderRadius: "16px",
    background: "#FAF9F7",
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
    background: "#F7F5EF",
    color: "#2A2A28",
    padding: "10px 4px",
    fontSize: "12px",
    fontWeight: 600,
    textAlign: "center",
    cursor: "pointer",
  },
  yousuOptionSelected: {
    borderColor: "#6B9E82",
    background: "#6B9E82",
    color: "#FFFFFF",
  },
  discoveryCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    border: "0.5px solid #E0DDD6",
    borderRadius: "14px",
    background: "#F7F5EF",
    padding: "12px 14px",
    textAlign: "left",
    cursor: "pointer",
  },
  discoveryEmptyCard: {
    width: "100%",
    border: "0.5px solid #E0DDD6",
    borderRadius: "14px",
    background: "#F7F5EF",
    padding: "14px",
    textAlign: "center",
  },
  discoveryIcon: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    flexShrink: 0,
    borderRadius: "50%",
    background: "#6B9E82",
    color: "#FFFFFF",
  },
  discoveryTextGroup: {
    display: "flex",
    minWidth: 0,
    flex: 1,
    flexDirection: "column",
    gap: "3px",
  },
  discoveryLabel: {
    color: "#888580",
    fontSize: "11px",
    fontWeight: 600,
  },
  discoveryText: {
    color: "#2A2A28",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.45,
  },
  discoveryEmptyText: {
    color: "#888580",
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.5,
  },
  sheetBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 99,
    background: "rgba(42,42,40,0.18)",
  },
  sheet: {
    position: "fixed",
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    borderRadius: "24px 24px 0 0",
    background: "#FAF9F7",
    boxShadow: "0 -4px 24px rgba(0,0,0,0.1)",
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
    fontSize: "16px",
    fontWeight: 600,
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
  sheetOption: {
    border: "0.5px solid #E0DDD6",
    borderRadius: "14px",
    background: "#F7F5EF",
    color: "#2A2A28",
    padding: "20px 12px",
    fontSize: "14px",
    fontWeight: 600,
    textAlign: "center",
    cursor: "pointer",
  },
  sheetOptionSelected: {
    borderColor: "#6B9E82",
    background: "#6B9E82",
    color: "#FFFFFF",
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
    border: "0.5px solid #E0DDD6",
    borderRadius: "14px",
    background: "#F7F5EF",
    padding: "14px 16px",
    color: "#2A2A28",
    cursor: "pointer",
  },
  catListItemActive: {
    borderColor: "#6B9E82",
    background: "rgba(107,158,130,0.08)",
  },
  catListName: {
    fontSize: "14px",
    fontWeight: 700,
  },
  catListMark: {
    color: "#6B9E82",
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

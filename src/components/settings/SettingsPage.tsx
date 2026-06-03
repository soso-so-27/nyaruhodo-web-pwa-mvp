"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  getAccountSyncOverview,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import type { AccountSyncOverview, AccountSyncResult } from "../../lib/accountSync";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  APP_ACCENT,
  APP_PAGE_BACKGROUND,
  APP_PILL,
  APP_SURFACE,
} from "../ui/appTheme";

export function SettingsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [syncOverview, setSyncOverview] = useState<AccountSyncOverview | null>(null);

  useEffect(() => {
    void checkAuthState();
  }, []);

  async function checkAuthState() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(data.user));
    setEmail(data.user?.email ?? null);
    if (data.user) {
      await refreshSyncOverview();
    }
    setIsLoading(false);
  }

  async function refreshSyncOverview() {
    try {
      const overview = await getAccountSyncOverview();
      setSyncOverview(overview.isLoggedIn ? overview : null);
    } catch {
      setSyncOverview(null);
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setEmail(null);
    setSyncMessage("");
    setSyncOverview(null);
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    setSyncMessage("");
    trackProductEvent("settings_account_sync_clicked", {
      remote_cats: syncOverview?.remoteCats ?? null,
      remote_records: syncOverview?.remoteRecords ?? null,
      remote_collection_photos: syncOverview?.remoteCollectionPhotos ?? null,
      remote_own_sleeping_photos: syncOverview?.remoteOwnSleepingPhotos ?? null,
      remote_kept_exchange_photos: syncOverview?.remoteKeptExchangePhotos ?? null,
    });

    const result = await syncLocalDataWithAccount({ restoreIfLocalEmpty: true });

    setSyncMessage(getSyncResultMessage(result, "sync"));

    await refreshSyncOverview();
    trackProductEvent("settings_account_sync_completed", {
      status: result.status,
      pushed_cats: result.pushedCats,
      pushed_records: result.pushedRecords,
      pushed_collection_photos: result.pushedCollectionPhotos,
      pushed_own_sleeping_photos: result.pushedOwnSleepingPhotos,
      pushed_kept_exchange_photos: result.pushedKeptExchangePhotos,
      restored_cats: result.restoredCats,
      restored_records: result.restoredRecords,
      restored_collection_photos: result.restoredCollectionPhotos,
      restored_own_sleeping_photos: result.restoredOwnSleepingPhotos,
      restored_kept_exchange_photos: result.restoredKeptExchangePhotos,
      error_count: result.errors.length,
    });
    setIsSyncing(false);
  }

  async function handleRestoreFromAccount() {
    trackProductEvent("settings_account_restore_clicked", {
      remote_cats: syncOverview?.remoteCats ?? null,
      remote_records: syncOverview?.remoteRecords ?? null,
      remote_collection_photos: syncOverview?.remoteCollectionPhotos ?? null,
      remote_own_sleeping_photos: syncOverview?.remoteOwnSleepingPhotos ?? null,
      remote_kept_exchange_photos: syncOverview?.remoteKeptExchangePhotos ?? null,
    });
    if (
      !window.confirm(
        "アカウントに保存されているデータを、この端末に追加で復元しますか？",
      )
    ) {
      trackProductEvent("settings_account_restore_cancelled", {
        remote_cats: syncOverview?.remoteCats ?? null,
        remote_records: syncOverview?.remoteRecords ?? null,
        remote_collection_photos: syncOverview?.remoteCollectionPhotos ?? null,
        remote_own_sleeping_photos: syncOverview?.remoteOwnSleepingPhotos ?? null,
        remote_kept_exchange_photos: syncOverview?.remoteKeptExchangePhotos ?? null,
      });
      return;
    }

    setIsSyncing(true);
    setSyncMessage("");

    const result = await syncLocalDataWithAccount({
      forceRestore: true,
      restoreIfLocalEmpty: true,
    });

    setSyncMessage(getSyncResultMessage(result, "restore"));

    await refreshSyncOverview();
    trackProductEvent("settings_account_restore_completed", {
      status: result.status,
      restored_cats: result.restoredCats,
      restored_records: result.restoredRecords,
      restored_collection_photos: result.restoredCollectionPhotos,
      restored_own_sleeping_photos: result.restoredOwnSleepingPhotos,
      restored_kept_exchange_photos: result.restoredKeptExchangePhotos,
      error_count: result.errors.length,
    });
    setIsSyncing(false);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <a href="/home" style={styles.backButton}>
            <span style={styles.backIcon}>‹</span>
          </a>
          <h1 style={styles.title}>設定</h1>
        </div>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>アカウント</p>
          <div style={styles.card}>
            {isLoading ? (
              <p style={styles.loadingText}>確認中...</p>
            ) : isLoggedIn ? (
              <>
                <div style={styles.row}>
                  <div style={styles.rowLeft}>
                    <span style={styles.statusDot} />
                    <span style={styles.rowLabel}>接続済み</span>
                  </div>
                  <span style={styles.rowValue}>{email ?? ""}</span>
                </div>
                <div style={styles.divider} />
                {syncOverview ? (
                  <>
                    <SyncStatusPanel overview={syncOverview} />
                    <div style={styles.divider} />
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    void handleSyncNow();
                  }}
                  style={styles.primaryButton}
                  disabled={isSyncing}
                >
                  {isSyncing ? "保存中..." : "この端末を保存する"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleRestoreFromAccount();
                  }}
                  style={styles.restoreButton}
                  disabled={isSyncing}
                >
                  アカウントから復元する
                </button>
                {syncMessage ? (
                  <p style={styles.syncMessage} role="status">
                    {syncMessage}
                  </p>
                ) : null}
                <div style={styles.divider} />
                <button
                  type="button"
                  onClick={handleLogout}
                  style={styles.dangerButton}
                >
                  ログアウト
                </button>
              </>
            ) : (
              <>
                <div style={styles.row}>
                  <div style={styles.rowLeft}>
                    <span style={{ ...styles.statusDot, ...styles.statusDotOff }} />
                    <span style={styles.rowLabel}>未接続</span>
                  </div>
                </div>
                <div style={styles.divider} />
                <a href="/account/create" style={styles.primaryButton}>
                  アカウントを作成する
                </a>
              </>
            )}
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>安心とルール</p>
          <div style={styles.card}>
            <a href="/privacy" style={styles.linkRow}>
              <span style={styles.rowLabel}>プライバシーポリシー</span>
              <span style={styles.rowChevron}>›</span>
            </a>
            <div style={styles.divider} />
            <a href="/terms" style={styles.linkRow}>
              <span style={styles.rowLabel}>利用規約</span>
              <span style={styles.rowChevron}>›</span>
            </a>
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>データ</p>
          <div style={styles.card}>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "すべてのデータを削除しますか？この操作は元に戻せません。",
                  )
                ) {
                  localStorage.clear();
                  window.location.href = "/";
                }
              }}
              style={styles.dangerButton}
            >
              データをすべて削除する
            </button>
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>このアプリについて</p>
          <div style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>バージョン</span>
              <span style={styles.rowValue}>1.0.0</span>
            </div>
            <div style={styles.divider} />
            <div style={styles.row}>
              <span style={styles.rowLabel}>にゃるほど</span>
              <span style={styles.rowValue}>猫と話せない人のためのアプリ</span>
            </div>
            <div style={styles.divider} />
            <div style={styles.betaNote}>
              <p style={styles.betaNoteTitle}>現在ベータ版として無料公開中</p>
              <p style={styles.betaNoteText}>
                むぎの記録を長く残すためのデータ保管プランを準備しています。
                正式版リリース時に、記録の長期保存に関する有料プランを導入予定です。
                現在ご利用の記録データは引き続き大切にお預かりします。
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SyncStatusPanel({ overview }: { overview: AccountSyncOverview }) {
  return (
    <div style={styles.syncStatusPanel}>
      <div style={styles.syncStatusHeader}>
        <div>
          <p style={styles.syncOverviewLabel}>同期の状態</p>
          <p style={styles.syncOverviewText}>
            {overview.shouldSuggestRestore
              ? "アカウント側に復元できるデータがあります。"
              : "この端末とアカウントの件数を確認できます。"}
          </p>
        </div>
        {overview.shouldSuggestRestore ? (
          <span style={styles.syncOverviewBadge}>復元できます</span>
        ) : null}
      </div>

      <div style={styles.syncCompareGrid}>
        <SyncCountColumn
          title="この端末"
          cats={overview.localCats}
          records={overview.localRecords}
          collectionPhotos={overview.localCollectionPhotos}
          ownSleepingPhotos={overview.localOwnSleepingPhotos}
          keptExchangePhotos={overview.localKeptExchangePhotos}
        />
        <SyncCountColumn
          title="アカウント"
          cats={overview.remoteCats}
          records={overview.remoteRecords}
          collectionPhotos={overview.remoteCollectionPhotos}
          ownSleepingPhotos={overview.remoteOwnSleepingPhotos}
          keptExchangePhotos={overview.remoteKeptExchangePhotos}
        />
      </div>

      <div style={styles.syncMetaGrid}>
        <span>保存 {formatSyncDate(overview.lastPushAt)}</span>
        <span>復元 {formatSyncDate(overview.lastPullAt)}</span>
      </div>

      {overview.errors.length > 0 ? (
        <p style={styles.syncWarning}>一部の同期状態を確認できませんでした。</p>
      ) : null}
    </div>
  );
}

function SyncCountColumn({
  title,
  cats,
  records,
  collectionPhotos,
  ownSleepingPhotos,
  keptExchangePhotos,
}: {
  title: string;
  cats: number;
  records: number;
  collectionPhotos: number;
  ownSleepingPhotos: number;
  keptExchangePhotos: number;
}) {
  return (
    <div style={styles.syncCountColumn}>
      <p style={styles.syncCountTitle}>{title}</p>
      <div style={styles.syncCountRows}>
        <SyncCountRow label="猫" value={cats} />
        <SyncCountRow label="記録" value={records} />
        <SyncCountRow label="写真" value={collectionPhotos} />
        <SyncCountRow label="とったねがお" value={ownSleepingPhotos} />
        <SyncCountRow label="とどいたねがお" value={keptExchangePhotos} />
      </div>
    </div>
  );
}

function SyncCountRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={styles.syncCountRow}>
      <span>{label}</span>
      <span style={styles.syncCountValue}>{value}</span>
    </div>
  );
}

function getSyncResultMessage(
  result: AccountSyncResult,
  action: "sync" | "restore",
) {
  const hasPartialErrors = result.errors.length > 0;

  if (result.status === "synced") {
    return hasPartialErrors
      ? "保存しました。一部のねがお写真はあとで再同期されます。"
      : "この端末のデータをアカウントに保存しました。";
  }

  if (result.status === "restored") {
    return hasPartialErrors
      ? "復元しました。一部のねがお写真はあとで再同期されます。"
      : "アカウントのデータをこの端末に復元しました。";
  }

  if (result.status === "error") {
    return action === "restore"
      ? "復元できませんでした。ログイン状態を確認してください。"
      : "保存できませんでした。ログイン状態を確認してください。";
  }

  return action === "restore"
    ? "アカウント側に復元できるデータはまだありません。"
    : "この端末に保存できるデータはまだありません。";
}

function formatSyncDate(value: string | null) {
  if (!value) {
    return "まだ";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "不明";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    color: "#242522",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "0 16px 40px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 0 20px",
  },
  backButton: {
    ...APP_PILL,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    textDecoration: "none",
    color: "#2a2a28",
    flexShrink: 0,
  },
  backIcon: {
    fontSize: "20px",
    lineHeight: 1,
    color: "#2a2a28",
  },
  title: {
    fontSize: "21px",
    fontWeight: 680,
    color: "#2a2a28",
    margin: 0,
  },
  section: {
    marginBottom: "20px",
  },
  sectionLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#9a9890",
    margin: "0 0 8px 4px",
    letterSpacing: "0.04em",
  },
  card: {
    ...APP_SURFACE,
    borderRadius: "20px",
    padding: "4px 16px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 0",
  },
  linkRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 0",
    textDecoration: "none",
    color: "#2a2a28",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  rowLabel: {
    fontSize: "15px",
    color: "#2a2a28",
    fontWeight: 500,
  },
  rowValue: {
    fontSize: "13px",
    color: "#9a9890",
    maxWidth: "160px",
    textAlign: "right" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  rowChevron: {
    fontSize: "18px",
    lineHeight: 1,
    color: "#c8c5be",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: APP_ACCENT,
    flexShrink: 0,
  },
  statusDotOff: {
    background: "#d0cdc6",
  },
  divider: {
    height: "0.5px",
    background: "#f0ede8",
    margin: "0 -16px",
  },
  loadingText: {
    fontSize: "13px",
    color: "#9a9890",
    padding: "14px 0",
    margin: 0,
  },
  syncMessage: {
    fontSize: "12px",
    color: "#8a8a80",
    lineHeight: 1.6,
    margin: "0",
    padding: "0 0 12px",
    textAlign: "center" as const,
  },
  syncStatusPanel: {
    padding: "14px 0",
    display: "grid",
    gap: "12px",
  },
  syncStatusHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  syncOverview: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "14px 0",
  },
  syncOverviewLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#2a2a28",
    margin: "0 0 4px",
  },
  syncOverviewText: {
    fontSize: "12px",
    fontWeight: 500,
    color: "#8a8a80",
    margin: 0,
  },
  syncOverviewBadge: {
    flexShrink: 0,
    border: `0.5px solid ${APP_ACCENT}`,
    borderRadius: "99px",
    color: APP_ACCENT,
    fontSize: "11px",
    fontWeight: 600,
    padding: "4px 8px",
  },
  syncCompareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "10px",
  },
  syncCountColumn: {
    border: "1px solid #f0ede8",
    borderRadius: "16px",
    padding: "10px",
    background: "rgba(255,255,255,0.52)",
  },
  syncCountTitle: {
    margin: "0 0 8px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#2a2a28",
  },
  syncCountRows: {
    display: "grid",
    gap: "6px",
  },
  syncCountRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    color: "#8a8a80",
    fontSize: "11.5px",
    lineHeight: 1.25,
  },
  syncCountValue: {
    color: "#2a2a28",
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  syncMetaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "8px",
    color: "#9a9890",
    fontSize: "11.5px",
    lineHeight: 1.4,
  },
  syncWarning: {
    margin: 0,
    color: "#a66d3f",
    fontSize: "11.5px",
    lineHeight: 1.5,
  },
  primaryButton: {
    display: "block",
    width: "100%",
    textAlign: "center" as const,
    padding: "14px 0",
    fontSize: "15px",
    fontWeight: 600,
    color: APP_ACCENT,
    background: "transparent",
    border: "none",
    textDecoration: "none",
    cursor: "pointer",
  },
  restoreButton: {
    display: "block",
    width: "100%",
    textAlign: "center" as const,
    padding: "0 0 14px",
    fontSize: "13px",
    fontWeight: 500,
    color: "#8a8a80",
    background: "transparent",
    border: "none",
    textDecoration: "none",
    cursor: "pointer",
  },
  dangerButton: {
    display: "block",
    width: "100%",
    padding: "14px 0",
    fontSize: "15px",
    fontWeight: 600,
    color: "#d85a30",
    background: "transparent",
    border: "none",
    textAlign: "center" as const,
    cursor: "pointer",
  },
  betaNote: {
    padding: "14px 0",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },
  betaNoteTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: APP_ACCENT,
    margin: 0,
  },
  betaNoteText: {
    fontSize: "13px",
    color: "#8a8a80",
    lineHeight: 1.7,
    margin: 0,
  },
} satisfies Record<string, CSSProperties>;

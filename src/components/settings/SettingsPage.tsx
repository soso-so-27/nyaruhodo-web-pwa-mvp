"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  getAccountSyncOverview,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import type { AccountSyncOverview } from "../../lib/accountSync";
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
    });

    const result = await syncLocalDataWithAccount({ restoreIfLocalEmpty: true });

    if (result.status === "synced") {
      setSyncMessage(
        result.restoredCats > 0
          ? "アカウントとこの端末のデータを同期しました。"
          : "この端末のデータをアカウントに保存しました。",
      );
    } else if (result.status === "restored") {
      setSyncMessage("アカウントのデータをこの端末に復元しました。");
    } else if (result.status === "error") {
      setSyncMessage("同期できませんでした。少し時間をおいてもう一度お試しください。");
    } else {
      setSyncMessage("同期できるデータはまだありません。");
    }

    await refreshSyncOverview();
    trackProductEvent("settings_account_sync_completed", {
      status: result.status,
      pushed_cats: result.pushedCats,
      pushed_records: result.pushedRecords,
      pushed_collection_photos: result.pushedCollectionPhotos,
      restored_cats: result.restoredCats,
      restored_records: result.restoredRecords,
      restored_collection_photos: result.restoredCollectionPhotos,
      error_count: result.errors.length,
    });
    setIsSyncing(false);
  }

  async function handleRestoreFromAccount() {
    trackProductEvent("settings_account_restore_clicked", {
      remote_cats: syncOverview?.remoteCats ?? null,
      remote_records: syncOverview?.remoteRecords ?? null,
      remote_collection_photos: syncOverview?.remoteCollectionPhotos ?? null,
    });
    if (
      !window.confirm(
        "この端末の猫データを、アカウントに保存されているデータで復元しますか？",
      )
    ) {
      trackProductEvent("settings_account_restore_cancelled", {
        remote_cats: syncOverview?.remoteCats ?? null,
        remote_records: syncOverview?.remoteRecords ?? null,
      });
      return;
    }

    setIsSyncing(true);
    setSyncMessage("");

    const result = await syncLocalDataWithAccount({
      forceRestore: true,
      restoreIfLocalEmpty: true,
    });

    if (result.status === "restored") {
      setSyncMessage("アカウントのデータをこの端末に復元しました。");
    } else if (result.status === "error") {
      setSyncMessage("復元できませんでした。少し時間をおいてもう一度お試しください。");
    } else {
      setSyncMessage("復元できるアカウントデータはまだありません。");
    }

    await refreshSyncOverview();
    trackProductEvent("settings_account_restore_completed", {
      status: result.status,
      restored_cats: result.restoredCats,
      restored_records: result.restoredRecords,
      restored_collection_photos: result.restoredCollectionPhotos,
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
                    <div style={styles.syncOverview}>
                      <div>
                        <p style={styles.syncOverviewLabel}>アカウント保存</p>
                        <p style={styles.syncOverviewText}>
                          猫 {syncOverview.remoteCats} ・ 記録{" "}
                          {syncOverview.remoteRecords}
                          {syncOverview.remoteCollectionPhotos > 0
                            ? ` ・ 写真 ${syncOverview.remoteCollectionPhotos}`
                            : ""}
                        </p>
                      </div>
                      {syncOverview.shouldSuggestRestore ? (
                        <span style={styles.syncOverviewBadge}>復元できます</span>
                      ) : null}
                    </div>
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
                  {isSyncing ? "同期中..." : "この端末のデータを同期する"}
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

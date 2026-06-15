"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  getAccountSyncOverview,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import type { AccountSyncOverview, AccountSyncResult } from "../../lib/accountSync";
import {
  readClientAdminCapabilities,
  type ClientAdminCapabilities,
} from "../../lib/adminCapabilitiesClient";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  readClientBetaCapabilities,
  sendBetaFeedback,
  type BetaFeedbackCategory,
  type ClientBetaCapabilities,
} from "../../lib/betaClient";
import {
  openBillingPortal,
  readClientBillingStatus,
  startBetaSupporterCheckout,
  type ClientBillingStatus,
} from "../../lib/billingClient";
import {
  buildAuthDebugSnapshot,
  type AuthDebugSnapshot,
} from "../../lib/authDebug";
import {
  getDisplayEnvironment,
  getDisplayEnvironmentLabel,
  type DisplayEnvironment,
} from "../../lib/displayEnvironment";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  APP_ACCENT,
  APP_PAGE_BACKGROUND,
} from "../ui/appTheme";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import {
  readKeptExchangePhotoStorageDebug,
  type KeptExchangePhotoStorageDebug,
} from "../../lib/home/sleepingPhotos";
import {
  readSleepingDeliveryDiagnostics,
  saveRemoteDeliveryStockPhoto,
  type SleepingDeliveryDiagnostics,
} from "../../lib/home/deliveryCandidates";
import {
  readEveningDeliveryTrace,
  type EveningDeliveryTraceEntry,
} from "../../lib/home/eveningDeliveryTrace";
import {
  readOpenSoundEnabled,
  readSelectedOpenSoundCandidate,
  saveOpenSoundEnabled,
  saveSelectedOpenSoundCandidate,
  type OpenSoundCandidateId,
} from "../../lib/openSound";

type SettingsTab = "general" | "admin";
type PhotoReportSummary = {
  id: string;
  photo_id: string;
  source_photo_id: string | null;
  reporter_user_id: string | null;
  reporter_anonymous_id: string | null;
  reason: string;
  created_at: string;
};
type ModerationQueueItem = {
  id: string;
  localMomentId: string;
  photoSrc: string | null;
  moderationStatus: string;
  deliveryStatus: string;
  createdAt: string;
};
const APP_BUILD_SHA =
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_COMMIT_SHA ??
  "local";

export function SettingsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSyncResult, setLastSyncResult] = useState<{
    action: "sync" | "restore";
    result: AccountSyncResult;
  } | null>(null);
  const [syncOverview, setSyncOverview] = useState<AccountSyncOverview | null>(null);
  const [authDebug, setAuthDebug] = useState<AuthDebugSnapshot | null>(null);
  const [displayEnvironment, setDisplayEnvironment] =
    useState<DisplayEnvironment>("unknown");
  const [isStockAdding, setIsStockAdding] = useState(false);
  const [isDeliveryDiagnosticsLoading, setIsDeliveryDiagnosticsLoading] =
    useState(false);
  const [stockMessage, setStockMessage] = useState("");
  const [stockPhotoCount, setStockPhotoCount] = useState(0);
  const [deliveryDiagnostics, setDeliveryDiagnostics] =
    useState<SleepingDeliveryDiagnostics | null>(null);
  const [keptExchangeDebug, setKeptExchangeDebug] =
    useState<KeptExchangePhotoStorageDebug | null>(null);
  const [eveningDeliveryTrace, setEveningDeliveryTrace] = useState<
    EveningDeliveryTraceEntry[]
  >([]);
  const [photoReports, setPhotoReports] = useState<PhotoReportSummary[]>([]);
  const [moderationQueue, setModerationQueue] = useState<ModerationQueueItem[]>([]);
  const [moderationPendingCount, setModerationPendingCount] = useState(0);
  const [moderationMessage, setModerationMessage] = useState("");
  const [adminCapabilities, setAdminCapabilities] =
    useState<ClientAdminCapabilities>({
      isAdmin: false,
      testToolsEnabled: false,
      stockAdminEnabled: false,
    });
  const [betaCapabilities, setBetaCapabilities] =
    useState<ClientBetaCapabilities>({
      isLoggedIn: false,
      isBetaParticipant: false,
      feedbackEnabled: false,
      supporterVoiceEnabled: false,
      isBetaSupporter: false,
    });
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackKind, setFeedbackKind] =
    useState<"beta_feedback" | "supporter_voice">("beta_feedback");
  const [feedbackCategory, setFeedbackCategory] =
    useState<BetaFeedbackCategory>("good");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [isFeedbackSending, setIsFeedbackSending] = useState(false);
  const [billingStatus, setBillingStatus] = useState<ClientBillingStatus>({
    isLoggedIn: false,
    billingConfigured: false,
    isBetaSupporter: false,
    status: "none",
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canManageBilling: false,
  });
  const [billingMessage, setBillingMessage] = useState("");
  const [isBillingLoading, setIsBillingLoading] = useState(false);
  const [openSoundEnabled, setOpenSoundEnabled] = useState(true);
  const [openSoundCandidate, setOpenSoundCandidate] =
    useState<OpenSoundCandidateId>("1");
  const showsAdminSection =
    adminCapabilities.testToolsEnabled || adminCapabilities.stockAdminEnabled;
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTab>("general");

  useEffect(() => {
    setDisplayEnvironment(getDisplayEnvironment());
    setOpenSoundEnabled(readOpenSoundEnabled());
    setOpenSoundCandidate(readSelectedOpenSoundCandidate());
    refreshKeptExchangeDebug();
    refreshEveningDeliveryTrace();
    void checkAuthState();
    void refreshAdminCapabilities();
    void refreshBetaCapabilities();
    void refreshBillingStatus();
  }, []);

  useEffect(() => {
    if (!showsAdminSection && activeSettingsTab === "admin") {
      setActiveSettingsTab("general");
    }
  }, [activeSettingsTab, showsAdminSection]);

  function updateOpenSoundEnabled(enabled: boolean) {
    saveOpenSoundEnabled(enabled);
    setOpenSoundEnabled(enabled);
  }

  function updateOpenSoundCandidate(candidate: OpenSoundCandidateId) {
    saveSelectedOpenSoundCandidate(candidate);
    setOpenSoundCandidate(candidate);
  }

  async function checkAuthState() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      await refreshAuthDebug(null);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    setIsLoggedIn(Boolean(data.user));
    setEmail(data.user?.email ?? null);
    await refreshAuthDebug(supabase);
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

  async function refreshAuthDebug(
    supabase = createBrowserSupabaseClient(),
  ) {
    try {
      setAuthDebug(await buildAuthDebugSnapshot(supabase));
    } catch {
      setAuthDebug(null);
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) return;

    await supabase.auth.signOut();
    setIsLoggedIn(false);
    setEmail(null);
    setSyncMessage("");
    setLastSyncResult(null);
    setSyncOverview(null);
    setBetaCapabilities({
      isLoggedIn: false,
      isBetaParticipant: false,
      feedbackEnabled: false,
      supporterVoiceEnabled: false,
      isBetaSupporter: false,
    });
    setBillingStatus({
      isLoggedIn: false,
      billingConfigured: false,
      isBetaSupporter: false,
      status: "none",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      canManageBilling: false,
    });
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

    const result = await syncLocalDataWithAccount({ restoreIfLocalEmpty: false });

    setSyncMessage(getSyncResultMessage(result, "sync"));
    setLastSyncResult({ action: "sync", result });

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
    setLastSyncResult({ action: "restore", result });

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

  async function handleStockPhotoImport() {
    if (isStockAdding) {
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
      const selectedFiles = Array.from(input.files ?? []);
      const files = selectedFiles.filter(isLikelyImageFile);

      if (files.length === 0) {
        setStockMessage("写真を選べませんでした。別の写真でもう一度試してください。");
        cleanupInput();
        return;
      }

      setIsStockAdding(true);
      setStockMessage("");
      let savedCount = 0;

      try {
        for (const file of files.slice(0, 30)) {
          const saved = await saveStockPhotoWithFallback(file);

          if (saved) {
            savedCount += 1;
          }
        }

        trackProductEvent("settings_stock_photos_imported", {
          selected_count: selectedFiles.length,
          accepted_count: files.length,
          saved_count: savedCount,
        });
        setStockMessage(
          savedCount > 0
            ? `とどくねがおを${savedCount}枚入れました。`
            : "写真を保存できませんでした。",
        );
        setStockPhotoCount((count) =>
          count + savedCount,
        );
        void refreshDeliveryDiagnostics();
      } catch {
        setStockMessage(
          savedCount > 0
            ? `とどくねがおを${savedCount}枚入れました。`
            : "写真を保存できませんでした。",
        );
        setStockPhotoCount((count) =>
          count + savedCount,
        );
        void refreshDeliveryDiagnostics();
      } finally {
        setIsStockAdding(false);
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

  async function refreshDeliveryDiagnostics() {
    setIsDeliveryDiagnosticsLoading(true);
    const diagnostics = await readSleepingDeliveryDiagnostics();
    setDeliveryDiagnostics(diagnostics);
    if (diagnostics) {
      setStockPhotoCount(diagnostics.adminStockCount);
    }
    setIsDeliveryDiagnosticsLoading(false);
  }

  function refreshEveningDeliveryTrace() {
    setEveningDeliveryTrace(readEveningDeliveryTrace());
  }

  async function refreshAdminCapabilities() {
    const capabilities = await readClientAdminCapabilities();

    setAdminCapabilities(capabilities);
    if (capabilities.testToolsEnabled || capabilities.stockAdminEnabled) {
      void refreshDeliveryDiagnostics();
      void refreshPhotoReports();
      void refreshModerationQueue();
    }
  }

  async function refreshPhotoReports() {
    const reports = await readPhotoReports();
    setPhotoReports(reports);
  }

  async function refreshModerationQueue() {
    const queue = await readModerationQueue();
    setModerationQueue(queue.moments);
    setModerationPendingCount(queue.pendingCount);
  }

  async function handleModerationDecision(momentId: string, decision: "approved" | "rejected") {
    setModerationMessage("");
    const ok = await decideModerationMoment(momentId, decision);
    setModerationMessage(ok ? "moderation updated" : "moderation failed");
    if (ok) {
      trackProductEvent("moderation_decided", {
        decision,
        moment_id: momentId,
      });
    }
    await refreshModerationQueue();
  }

  async function refreshBetaCapabilities() {
    const capabilities = await readClientBetaCapabilities();

    setBetaCapabilities(capabilities);
  }

  async function refreshBillingStatus() {
    setBillingStatus(await readClientBillingStatus());
  }

  async function handleFeedbackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = feedbackMessage.trim();

    if (!message) {
      setFeedbackStatus("感じたことを入力してください。");
      return;
    }

    if (message.length > 2000) {
      setFeedbackStatus("2000文字以内で送ってください。");
      return;
    }

    setIsFeedbackSending(true);
    setFeedbackStatus("");

    const ok = await sendBetaFeedback({
      category: feedbackCategory,
      message,
      kind: feedbackKind,
    });

    if (ok) {
      setFeedbackMessage("");
      setFeedbackStatus("届きました。\nβに参加してくれてありがとう。");
    } else {
      setFeedbackStatus("送信できませんでした。ログイン状態を確認してください。");
    }

    setIsFeedbackSending(false);
  }

  async function handleStartBetaSupporter() {
    setIsBillingLoading(true);
    setBillingMessage("Stripeへ移動しています");

    const url = await startBetaSupporterCheckout();

    if (url) {
      window.location.href = url;
      return;
    }

    setBillingMessage("支払いページを開けませんでした。ログイン状態を確認してください。");
    setIsBillingLoading(false);
  }

  async function handleOpenBillingPortal() {
    setIsBillingLoading(true);
    setBillingMessage("Stripeへ移動しています");

    const url = await openBillingPortal();

    if (url) {
      window.location.href = url;
      return;
    }

    setBillingMessage("支払い管理を開けませんでした。");
    setIsBillingLoading(false);
  }

  function refreshKeptExchangeDebug() {
    setKeptExchangeDebug(readKeptExchangePhotoStorageDebug());
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <AppButton href="/home" variant="ghost" size="icon" iconOnly aria-label="ホームへ戻る">
            <span style={styles.backIcon}>‹</span>
          </AppButton>
          <h1 style={styles.title}>設定</h1>
        </div>

        {showsAdminSection ? (
          <div
            style={styles.settingsTabs}
            role="tablist"
            aria-label="設定の表示"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeSettingsTab === "general"}
              onClick={() => setActiveSettingsTab("general")}
              style={{
                ...styles.settingsTab,
                ...(activeSettingsTab === "general"
                  ? styles.settingsTabActive
                  : {}),
              }}
            >
              通常
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSettingsTab === "admin"}
              onClick={() => setActiveSettingsTab("admin")}
              style={{
                ...styles.settingsTab,
                ...(activeSettingsTab === "admin"
                  ? styles.settingsTabActive
                  : {}),
              }}
            >
              管理
            </button>
          </div>
        ) : null}

        {activeSettingsTab === "general" ? (
          <>
        <section style={{ ...styles.section, order: 2 }}>
          <p style={styles.sectionLabel}>保存とデータ</p>
          <AppCard variant="section" padding="sm" style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>
                {getDisplayEnvironmentLabel(displayEnvironment)}
              </span>
              <span style={styles.rowValue}>
                {displayEnvironment === "standalone"
                  ? "アプリ側"
                  : displayEnvironment === "browser"
                    ? "Web側"
                    : ""}
              </span>
            </div>
            <div style={styles.divider} />
            <p style={styles.storageNote}>
              iPhoneでは、ホーム画面アプリとSafari/Webで写真の保存場所が分かれることがあります。写真が見えないときは、撮ったときと同じ入口から開いてください。
            </p>
            {isLoggedIn ? (
              <>
                <div style={styles.divider} />
                {syncOverview ? (
                  <SyncStatusPanel overview={syncOverview} />
                ) : (
                  <p style={styles.storageNote}>アカウント保存の状態を確認中です。</p>
                )}
                <div style={styles.actionStack}>
                  <AppButton
                    type="button"
                    variant="primary"
                    fullWidth
                    loading={isSyncing}
                    onClick={() => {
                      void handleSyncNow();
                    }}
                    disabled={isSyncing}
                  >
                    {isSyncing ? "保存中..." : "この端末をアカウントに保存"}
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="secondary"
                    fullWidth
                    loading={isSyncing}
                    onClick={() => {
                      void handleRestoreFromAccount();
                    }}
                    disabled={isSyncing}
                  >
                    アカウントからこの端末に復元
                  </AppButton>
                </div>
                {syncMessage ? (
                  <p style={styles.syncMessage} role="status">
                    {syncMessage}
                  </p>
                ) : null}
                {lastSyncResult ? (
                  <SyncResultDetails
                    action={lastSyncResult.action}
                    result={lastSyncResult.result}
                  />
                ) : null}
              </>
            ) : null}
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 1 }}>
          <p style={styles.sectionLabel}>アカウント</p>
          <AppCard variant="section" padding="sm" style={styles.card}>
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
                <AppButton
                  type="button"
                  variant="danger"
                  fullWidth
                  onClick={handleLogout}
                >
                  ログアウト
                </AppButton>
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
                <AppButton href="/account/create" variant="primary" fullWidth>
                  アカウントを作成する
                </AppButton>
              </>
            )}
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 4 }}>
          <p style={styles.sectionLabel}>音</p>
          <AppCard variant="section" padding="sm" style={styles.card}>
            <div style={styles.row}>
              <div style={styles.rowLeft}>
                <span style={styles.rowLabel}>ひらく音</span>
                <span style={styles.rowValue}>手紙をひらいたときだけ</span>
              </div>
              <button
                type="button"
                onClick={() => updateOpenSoundEnabled(!openSoundEnabled)}
                style={{
                  ...styles.flagToggleButton,
                  ...(openSoundEnabled ? styles.flagToggleButtonActive : {}),
                }}
                aria-pressed={openSoundEnabled}
              >
                {openSoundEnabled ? "ON" : "OFF"}
              </button>
            </div>
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 5 }}>
          <p style={styles.sectionLabel}>βサポーターについて</p>
          <AppCard variant="section" padding="sm" style={{ ...styles.card, ...styles.betaCard }}>
            {betaCapabilities.feedbackEnabled ? (
              <>
                <div style={styles.betaNote}>
                  <p style={styles.betaNoteTitle}>感じたことを送る</p>
                  <p style={styles.betaNoteText}>
                    よかったこと、分かりにくかったこと、
                    バグっぽいことを送れます。
                  </p>
                </div>
                <AppButton
                  type="button"
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    setFeedbackKind("beta_feedback");
                    setIsFeedbackOpen((open) => !open);
                    setFeedbackStatus("");
                  }}
                >
                  意見を送る
                </AppButton>
                {isFeedbackOpen ? (
                  <BetaFeedbackForm
                    category={feedbackCategory}
                    message={feedbackMessage}
                    status={feedbackStatus}
                    isSending={isFeedbackSending}
                    onCategoryChange={setFeedbackCategory}
                    onMessageChange={setFeedbackMessage}
                    onSubmit={handleFeedbackSubmit}
                  />
                ) : null}
                <div style={styles.divider} />
              </>
            ) : (
              <>
                <div style={styles.betaNote}>
                  <p style={styles.betaNoteTitle}>感じたことを送る</p>
                  <p style={styles.betaNoteText}>
                    β参加者は、よかったことや分かりにくかったことを送れます。
                  </p>
                </div>
                {!isLoggedIn ? (
                  <AppButton href="/account/create" variant="secondary" fullWidth>
                    ログインして参加する
                  </AppButton>
                ) : null}
                <div style={styles.divider} />
              </>
            )}
            <BetaSupporterPanel
              billingStatus={billingStatus}
              betaCapabilities={betaCapabilities}
              isBillingLoading={isBillingLoading}
              billingMessage={billingMessage}
              isFeedbackOpen={isFeedbackOpen && feedbackKind === "supporter_voice"}
              feedbackCategory={feedbackCategory}
              feedbackMessage={feedbackMessage}
              feedbackStatus={feedbackStatus}
              isFeedbackSending={isFeedbackSending}
              onStartSupporter={handleStartBetaSupporter}
              onOpenPortal={handleOpenBillingPortal}
              onOpenSupporterVoice={() => {
                setFeedbackKind("supporter_voice");
                setIsFeedbackOpen((open) =>
                  feedbackKind === "supporter_voice" ? !open : true,
                );
                setFeedbackStatus("");
              }}
              onCategoryChange={setFeedbackCategory}
              onMessageChange={setFeedbackMessage}
              onSubmit={handleFeedbackSubmit}
            />
          </AppCard>
        </section>
          </>
        ) : null}

        {showsAdminSection && activeSettingsTab === "admin" ? (
          <section style={{ ...styles.section, ...styles.adminSection, order: 7 }}>
            <p style={styles.sectionLabel}>管理者</p>
            <AppCard
              variant="outlined"
              padding="sm"
              style={{ ...styles.card, ...styles.adminCard }}
            >
              <AuthDebugPanel snapshot={authDebug} />
              <div style={styles.divider} />
              <BuildInfoPanel
                buildSha={APP_BUILD_SHA}
              />
              <div style={styles.divider} />
              <div style={styles.row}>
                <div style={styles.rowLeft}>
                  <span style={styles.rowLabel}>ひらく音 候補</span>
                  <span style={styles.rowValue}>実機A/B用</span>
                </div>
                <select
                  value={openSoundCandidate}
                  onChange={(event) =>
                    updateOpenSoundCandidate(
                      event.currentTarget.value as OpenSoundCandidateId,
                    )
                  }
                  style={styles.soundCandidateSelect}
                  aria-label="ひらく音の候補"
                >
                  <option value="1">候補1</option>
                  <option value="2">候補2</option>
                  <option value="3">候補3</option>
                </select>
              </div>
              <div style={styles.divider} />
              <AppButton
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => {
                  void refreshAuthDebug();
                }}
              >
                ログイン状態を更新する
              </AppButton>
              <div style={styles.divider} />
              {adminCapabilities.testToolsEnabled ? (
                <>
                  <a href="/onboarding?test=1" style={styles.linkRow}>
                    <span style={styles.rowLabel}>オンボーディングを試す</span>
                    <span style={styles.rowChevron}>›</span>
                  </a>
                  <div style={styles.divider} />
                </>
              ) : null}
              <div style={styles.row}>
                <span style={styles.rowLabel}>とどく候補</span>
                <span style={styles.rowValue}>{stockPhotoCount}枚</span>
              </div>
              <div style={styles.divider} />
              <DeliveryDiagnosticsPanel diagnostics={deliveryDiagnostics} />
              <div style={styles.divider} />
              <ModerationQueuePanel
                moments={moderationQueue}
                pendingCount={moderationPendingCount}
                message={moderationMessage}
                onDecide={(momentId, decision) => {
                  void handleModerationDecision(momentId, decision);
                }}
              />
              <div style={styles.divider} />
              <PhotoReportsPanel reports={photoReports} />
              <div style={styles.divider} />
              <EveningDeliveryTracePanel entries={eveningDeliveryTrace} />
              <div style={styles.divider} />
              <KeptExchangeDebugPanel debug={keptExchangeDebug} />
              <div style={styles.divider} />
              <AppButton
                type="button"
                variant="secondary"
                fullWidth
                loading={isDeliveryDiagnosticsLoading}
                onClick={() => {
                  void refreshDeliveryDiagnostics();
                  void refreshPhotoReports();
                  void refreshModerationQueue();
                  refreshKeptExchangeDebug();
                  refreshEveningDeliveryTrace();
                }}
                disabled={isDeliveryDiagnosticsLoading}
              >
                {isDeliveryDiagnosticsLoading ? "確認中..." : "とどく状態を確認する"}
              </AppButton>
              {adminCapabilities.stockAdminEnabled ? (
                <>
                  <div style={styles.divider} />
                  <AppButton
                    type="button"
                    variant="secondary"
                    fullWidth
                    loading={isStockAdding}
                    onClick={() => {
                      void handleStockPhotoImport();
                    }}
                    disabled={isStockAdding}
                  >
                    {isStockAdding ? "追加中..." : "とどくねがおを追加する"}
                  </AppButton>
                  <div style={styles.divider} />
                  <p style={styles.storageNote}>
                    本番前の確認用です。ここで入れた写真は、とどくねがおの候補になります。
                  </p>
                </>
              ) : null}
              {stockMessage ? (
                <p style={styles.syncMessage} role="status">
                  {stockMessage}
                </p>
              ) : null}
            </AppCard>
          </section>
        ) : null}

        {activeSettingsTab === "general" ? (
          <>
        <section style={{ ...styles.section, order: 3 }}>
          <p style={styles.sectionLabel}>サポート・規約</p>
          <AppCard variant="section" padding="sm" style={styles.card}>
            <a href="/how-to-use" style={styles.linkRow}>
              <span style={styles.rowLabel}>使い方</span>
              <span style={styles.rowChevron}>›</span>
            </a>
            <div style={styles.divider} />
            <a href="/terms" style={styles.linkRow}>
              <span style={styles.rowLabel}>利用規約</span>
              <span style={styles.rowChevron}>›</span>
            </a>
            <div style={styles.divider} />
            <a href="/privacy" style={styles.linkRow}>
              <span style={styles.rowLabel}>プライバシーポリシー</span>
              <span style={styles.rowChevron}>›</span>
            </a>
            <div style={styles.divider} />
            <a href="/commercial-transactions" style={styles.linkRow}>
              <span style={styles.rowLabel}>特商法表記</span>
              <span style={styles.rowChevron}>›</span>
            </a>
            <div style={styles.divider} />
            <a href="/contact" style={styles.linkRow}>
              <span style={styles.rowLabel}>問い合わせ</span>
              <span style={styles.rowChevron}>›</span>
            </a>
            <div style={styles.divider} />
            <a href="/cancellation" style={styles.linkRow}>
              <span style={styles.rowLabel}>解約方法</span>
              <span style={styles.rowChevron}>›</span>
            </a>
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 4 }}>
          <p style={styles.sectionLabel}>アプリ情報</p>
          <AppCard variant="section" padding="sm" style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>バージョン</span>
              <span style={styles.rowValue}>1.0.0-beta.4</span>
            </div>
            <div style={styles.divider} />
            <div style={styles.betaNote}>
              <p style={styles.betaNoteTitle}>更新が反映されないとき</p>
              <p style={styles.betaNoteText}>
                iPhone PWAは古い画面が残ることがあります。ホーム画面から一度閉じて開き直すか、Safariで本番URLを開いてからPWAを起動してください。
              </p>
            </div>
            <div style={styles.divider} />
            <div style={styles.betaNote}>
              <p style={styles.betaNoteTitle}>現在ベータ版として無料公開中</p>
              <p style={styles.betaNoteText}>
                写真を長く置けるように、保存容量の拡張や家族共有の準備をしています。
                正式版リリース時に、有料プランを導入する場合があります。
                現在の写真と猫データは、引き続き大切に扱います。
              </p>
            </div>
          </AppCard>
        </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function BetaSupporterPanel({
  billingStatus,
  betaCapabilities,
  isBillingLoading,
  billingMessage,
  isFeedbackOpen,
  feedbackCategory,
  feedbackMessage,
  feedbackStatus,
  isFeedbackSending,
  onStartSupporter,
  onOpenPortal,
  onOpenSupporterVoice,
  onCategoryChange,
  onMessageChange,
  onSubmit,
}: {
  billingStatus: ClientBillingStatus;
  betaCapabilities: ClientBetaCapabilities;
  isBillingLoading: boolean;
  billingMessage: string;
  isFeedbackOpen: boolean;
  feedbackCategory: BetaFeedbackCategory;
  feedbackMessage: string;
  feedbackStatus: string;
  isFeedbackSending: boolean;
  onStartSupporter: () => void;
  onOpenPortal: () => void;
  onOpenSupporterVoice: () => void;
  onCategoryChange: (category: BetaFeedbackCategory) => void;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div style={styles.betaNote}>
      <p style={styles.betaNoteTitle}>
        {billingStatus.isBetaSupporter ? "βサポーターです" : "βサポーター"}
      </p>
      <p style={styles.betaNoteText}>
        これからの ねてるねこと、応援の使いみちを見られます。
      </p>
      <AppButton href="/beta-supporter" variant="secondary" fullWidth>
        これからの ねてるねこ
      </AppButton>
      {billingMessage ? (
        <p style={styles.syncMessage} role="status">
          {billingMessage}
        </p>
      ) : null}
    </div>
  );
}

function BetaFeedbackForm({
  category,
  message,
  status,
  isSending,
  onCategoryChange,
  onMessageChange,
  onSubmit,
}: {
  category: BetaFeedbackCategory;
  message: string;
  status: string;
  isSending: boolean;
  onCategoryChange: (category: BetaFeedbackCategory) => void;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} style={styles.feedbackForm}>
      <label style={styles.feedbackField}>
        <span style={styles.feedbackLabel}>種類</span>
        <select
          value={category}
          onChange={(event) =>
            onCategoryChange(event.target.value as BetaFeedbackCategory)
          }
          style={styles.feedbackSelect}
        >
          <option value="good">よかった</option>
          <option value="confusing">わかりにくい</option>
          <option value="bug">バグっぽい</option>
          <option value="request">要望</option>
          <option value="other">その他</option>
        </select>
      </label>
      <label style={styles.feedbackField}>
        <span style={styles.feedbackLabel}>本文</span>
        <textarea
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          maxLength={2000}
          required
          rows={5}
          placeholder="感じたことを書いてください"
          style={styles.feedbackTextarea}
        />
      </label>
      <AppButton
        type="submit"
        variant="primary"
        fullWidth
        loading={isSending}
        disabled={isSending}
      >
        {isSending ? "送っています..." : "送る"}
      </AppButton>
      {status ? (
        <p style={styles.feedbackStatus} role="status">
          {status}
        </p>
      ) : null}
    </form>
  );
}

function resizeAndEncode(
  file: File,
  maxSize = 800,
  quality = 0.82,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");

      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };

    image.src = url;
  });
}

async function saveStockPhotoWithFallback(file: File) {
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
  if (file.type) {
    return file.type.startsWith("image/");
  }

  return /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function AuthDebugPanel({ snapshot }: { snapshot: AuthDebugSnapshot | null }) {
  if (!snapshot) {
    return <p style={styles.loadingText}>ログイン状態を読み込み中...</p>;
  }

  const latestDetails = snapshot.latestEvent?.details
    ? JSON.stringify(snapshot.latestEvent.details)
    : "";

  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
      <p style={styles.syncOverviewText}>
        実機でログインが続かない原因を見るための一時表示です。
      </p>
      <div style={styles.authDebugRows}>
        <AuthDebugRow label="表示" value={snapshot.environment} />
        <AuthDebugRow label="URL" value={snapshot.origin} />
        <AuthDebugRow label="場所" value={snapshot.path} />
        <AuthDebugRow
          label="保存キー"
          value={
            snapshot.authStoragePresent
              ? `あり (${snapshot.authStorageLength})`
              : "なし"
          }
        />
        <AuthDebugRow
          label="code verifier"
          value={snapshot.codeVerifierPresent ? "あり" : "なし"}
        />
        <AuthDebugRow
          label="保留マーク"
          value={snapshot.pendingMarkerPresent ? "あり" : "なし"}
        />
        <AuthDebugRow
          label="getSession"
          value={snapshot.sessionPresent ? "あり" : "なし"}
        />
        <AuthDebugRow
          label="getUser"
          value={snapshot.userPresent ? "あり" : "なし"}
        />
        <AuthDebugRow label="email" value={snapshot.userEmail ?? "-"} />
        <AuthDebugRow
          label="最後"
          value={snapshot.latestEvent?.event ?? "-"}
        />
        <AuthDebugRow
          label="詳細"
          value={
            latestDetails ||
            snapshot.userError ||
            snapshot.sessionError ||
            "-"
          }
        />
      </div>
    </AppCard>
  );
}

function AuthDebugRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.authDebugRow}>
      <span style={styles.authDebugLabel}>{label}</span>
      <span style={styles.authDebugValue}>{value}</span>
    </div>
  );
}

function BuildInfoPanel({ buildSha }: { buildSha: string }) {
  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
      <p style={styles.syncOverviewText}>管理用のビルド識別です。</p>
      <div style={styles.authDebugRows}>
        <AuthDebugRow
          label="commit"
          value={buildSha === "local" ? "local" : buildSha.slice(0, 12)}
        />
      </div>
    </AppCard>
  );
}

function EveningDeliveryTracePanel({
  entries,
}: {
  entries: EveningDeliveryTraceEntry[];
}) {
  if (entries.length === 0) {
    return (
      <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
        <p style={styles.syncOverviewText}>
          配達トレースはまだありません。ホームを開くと直近20件まで記録されます。
        </p>
      </AppCard>
    );
  }

  const latest = entries[0];

  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
      <p style={styles.syncOverviewText}>
        配達effectの直近ゲートです。写真データや秘密情報は保存しません。
      </p>
      <div style={styles.authDebugRows}>
        <AuthDebugRow label="記録" value={formatSyncDate(latest.checkedAt)} />
        <AuthDebugRow label="日付" value={latest.dateKey} />
        <AuthDebugRow label="ゲート" value={formatTraceGate(latest.gate)} />
        <AuthDebugRow
          label="当日エントリ"
          value={formatTraceBool(latest.hasTodayEntry)}
        />
        <AuthDebugRow
          label="配達済み"
          value={formatTraceBool(latest.hasDeliveredPhoto)}
        />
        <AuthDebugRow
          label="20時以降"
          value={formatTraceBool(latest.isAfterDeliveryTime)}
        />
        <AuthDebugRow
          label="写真一致"
          value={formatTraceBool(latest.directOwnPhotoFound)}
        />
        <AuthDebugRow
          label="targetPhoto"
          value={formatTraceBool(latest.targetPhotoFallbackUsed)}
        />
        <AuthDebugRow
          label="旧形式救済"
          value={
            latest.legacyFallbackReason
              ? `${formatTraceBool(latest.legacyFallbackUsed)} (${latest.legacyFallbackReason})`
              : formatTraceBool(latest.legacyFallbackUsed)
          }
        />
        <AuthDebugRow label="選択" value={latest.selectedPhotoSource} />
        <AuthDebugRow label="送信画像" value={latest.selectedPhotoSrcKind ?? "-"} />
        <AuthDebugRow
          label="送信長"
          value={
            typeof latest.exchangePayloadLength === "number"
              ? `${latest.exchangePayloadLength}文字`
              : "-"
          }
        />
        <AuthDebugRow
          label="所要"
          value={
            typeof latest.exchangeElapsedMs === "number"
              ? `${latest.exchangeElapsedMs}ms`
              : "-"
          }
        />
        <AuthDebugRow
          label="exchange"
          value={
            latest.exchangeCalled
              ? `called / ${latest.exchangeStatus ?? "-"} / photo:${formatTraceBool(
                  Boolean(latest.exchangePhotoReceived),
                )}${latest.exchangeError ? ` / ${latest.exchangeError}` : ""}`
              : "not called"
          }
        />
        <AuthDebugRow label="件数" value={`${entries.length}件`} />
      </div>
    </AppCard>
  );
}

function DeliveryDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: SleepingDeliveryDiagnostics | null;
}) {
  if (!diagnostics) {
    return (
      <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
        <p style={styles.syncOverviewText}>
          とどく候補の状態をまだ確認していません。
        </p>
      </AppCard>
    );
  }

  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
      <p style={styles.syncOverviewText}>
        とどく候補はSupabaseだけを見ています。localStorageの候補は使いません。
      </p>
      <div style={styles.authDebugRows}>
        <AuthDebugRow
          label="取得元"
          value={
            diagnostics.source === "remote"
              ? "Supabase"
              : diagnostics.source === "error"
                ? "エラー"
                : "候補なし"
          }
        />
        <AuthDebugRow
          label="DB読込"
          value={diagnostics.rlsReadable ? "可" : "不可"}
        />
        <AuthDebugRow label="候補" value={`${diagnostics.candidateCount}枚`} />
        <AuthDebugRow label="利用可" value={`${diagnostics.availableCount}枚`} />
        <AuthDebugRow label="除外" value={`${diagnostics.excludedCount}枚`} />
        <AuthDebugRow label="壊れ" value={`${diagnostics.unusableCount}枚`} />
        <AuthDebugRow label="ブロック" value={`${diagnostics.blockedCount}枚`} />
        <AuthDebugRow
          label="管理"
          value={`${diagnostics.adminStockCount}枚`}
        />
        <AuthDebugRow
          label="通常"
          value={`${diagnostics.userSharedCount}枚`}
        />
        <AuthDebugRow label="非表示" value={`${diagnostics.hiddenCount}枚`} />
        <AuthDebugRow label="通報" value={`${diagnostics.reportedCount}枚`} />
        <AuthDebugRow
          label="確認"
          value={formatSyncDate(diagnostics.checkedAt)}
        />
        {diagnostics.lastError ? (
          <AuthDebugRow label="エラー" value={diagnostics.lastError} />
        ) : null}
      </div>
    </AppCard>
  );
}

function PhotoReportsPanel({ reports }: { reports: PhotoReportSummary[] }) {
  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
      <p style={styles.syncOverviewText}>
        報告された写真の直近一覧です。2件以上の報告で配達プールから外れます。
      </p>
      <div style={styles.authDebugRows}>
        <AuthDebugRow label="件数" value={`${reports.length}件`} />
        {reports.slice(0, 10).map((report) => (
          <AuthDebugRow
            key={report.id}
            label={formatReportReason(report.reason)}
            value={`${report.source_photo_id ?? report.photo_id} / ${formatReportDate(
              report.created_at,
            )}`}
          />
        ))}
      </div>
    </AppCard>
  );
}

function ModerationQueuePanel({
  moments,
  pendingCount,
  message,
  onDecide,
}: {
  moments: ModerationQueueItem[];
  pendingCount: number;
  message: string;
  onDecide: (momentId: string, decision: "approved" | "rejected") => void;
}) {
  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
      <p style={styles.syncOverviewText}>
        配達プールに入る前の写真を確認します。承認したものだけが候補になります。
      </p>
      <div style={styles.authDebugRows}>
        <AuthDebugRow label="未審査" value={`${pendingCount}件`} />
        {message ? <AuthDebugRow label="結果" value={message} /> : null}
      </div>
      {moments.slice(0, 6).map((moment) => (
        <div key={moment.id} style={styles.moderationItem}>
          {moment.photoSrc ? (
            <img
              src={moment.photoSrc}
              alt=""
              style={styles.moderationImage}
              loading="lazy"
            />
          ) : (
            <div style={styles.moderationImageFallback}>no image</div>
          )}
          <div style={styles.moderationBody}>
            <span style={styles.rowValue}>{moment.localMomentId}</span>
            <span style={styles.rowValue}>{formatReportDate(moment.createdAt)}</span>
            <div style={styles.moderationActions}>
              <AppButton
                type="button"
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => onDecide(moment.id, "approved")}
              >
                approve
              </AppButton>
              <AppButton
                type="button"
                variant="danger"
                size="sm"
                fullWidth
                onClick={() => onDecide(moment.id, "rejected")}
              >
                reject
              </AppButton>
            </div>
          </div>
        </div>
      ))}
    </AppCard>
  );
}

function KeptExchangeDebugPanel({
  debug,
}: {
  debug: KeptExchangePhotoStorageDebug | null;
}) {
  if (!debug) {
    return (
      <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
        <p style={styles.syncOverviewText}>
          とどいたねがおの保存状態をまだ確認していません。
        </p>
      </AppCard>
    );
  }

  return (
    <AppCard as="div" variant="inset" padding="sm" style={styles.authDebugPanel}>
      <p style={styles.syncOverviewText}>
        アルバムに出る「とどいたねがお」の端末内保存状態です。
      </p>
      <div style={styles.authDebugRows}>
        <AuthDebugRow label="保存件数" value={`${debug.validCount}枚`} />
        <AuthDebugRow label="保存枠" value={`${debug.totalCount}件`} />
        <AuthDebugRow label="不正枠" value={`${debug.invalidCount}件`} />
        <AuthDebugRow label="保存量" value={`${debug.rawLength}文字`} />
        <AuthDebugRow label="画像形式" value={debug.latestSrcKind} />
        <AuthDebugRow label="画像長さ" value={`${debug.latestSrcLength}文字`} />
        <AuthDebugRow label="最新ID" value={debug.latestId ?? "-"} />
        <AuthDebugRow
          label="元ID"
          value={debug.latestSourcePhotoId ?? "-"}
        />
        <AuthDebugRow label="先頭" value={debug.latestSrcPrefix || "-"} />
        {debug.parseError ? (
          <AuthDebugRow label="エラー" value={debug.parseError} />
        ) : null}
      </div>
    </AppCard>
  );
}

async function readPhotoReports() {
  const headers = new Headers();
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }
  }

  try {
    const response = await fetch("/api/reports", { headers });
    if (!response.ok) {
      return [] as PhotoReportSummary[];
    }

    const body = (await response.json().catch(() => null)) as {
      reports?: PhotoReportSummary[];
    } | null;

    return Array.isArray(body?.reports) ? body.reports : [];
  } catch {
    return [] as PhotoReportSummary[];
  }
}

async function readModerationQueue() {
  const headers = await buildAuthorizedHeaders();
  const fallback = { moments: [] as ModerationQueueItem[], pendingCount: 0 };

  try {
    const response = await fetch("/api/moderation/queue", { headers });
    if (!response.ok) {
      return fallback;
    }

    const body = (await response.json().catch(() => null)) as {
      moments?: ModerationQueueItem[];
      pendingCount?: number;
    } | null;

    const moments = Array.isArray(body?.moments) ? body.moments : [];
    return {
      moments,
      pendingCount:
        typeof body?.pendingCount === "number" ? body.pendingCount : moments.length,
    };
  } catch {
    return fallback;
  }
}

async function decideModerationMoment(
  momentId: string,
  decision: "approved" | "rejected",
) {
  const headers = await buildAuthorizedHeaders();
  headers.set("content-type", "application/json");

  try {
    const response = await fetch("/api/moderation/decide", {
      method: "POST",
      headers,
      body: JSON.stringify({ momentId, decision }),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function buildAuthorizedHeaders() {
  const headers = new Headers();
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }
  }

  return headers;
}

function formatReportReason(reason: string) {
  if (reason === "not_cat") {
    return "ねこ以外";
  }
  if (reason === "uncomfortable") {
    return "不快";
  }
  return "その他";
}

function formatReportDate(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return "-";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function SyncStatusPanel({ overview }: { overview: AccountSyncOverview }) {
  const localPhotoTotal =
    overview.localCollectionPhotos +
    overview.localOwnSleepingPhotos +
    overview.localKeptExchangePhotos;
  const remotePhotoTotal =
    overview.remoteCollectionPhotos +
    overview.remoteOwnSleepingPhotos +
    overview.remoteKeptExchangePhotos;
  const statusText = overview.shouldSuggestRestore
    ? "アカウントに、この端末へ戻せるデータがあります。"
    : "この端末の写真と記録をアカウントに保存できます。";

  return (
    <div style={styles.syncStatusPanel}>
      <div style={styles.syncStatusHeader}>
        <div>
          <p style={styles.syncOverviewLabel}>アカウント保存</p>
          <p style={styles.syncOverviewText}>{statusText}</p>
        </div>
        {overview.shouldSuggestRestore ? (
          <span style={styles.syncOverviewBadge}>復元できます</span>
        ) : null}
      </div>

      <div style={styles.syncMetaGrid}>
        <span>この端末: 写真 {localPhotoTotal}枚 / 猫 {overview.localCats}匹</span>
        <span>アカウント: 写真 {remotePhotoTotal}枚 / 猫 {overview.remoteCats}匹</span>
        <span>最終保存: {formatSyncDate(overview.lastPushAt)}</span>
        <span>最終復元: {formatSyncDate(overview.lastPullAt)}</span>
      </div>

      {overview.errors.length > 0 ? (
        <p style={styles.syncWarning}>一部の同期状態を確認できませんでした。</p>
      ) : null}
    </div>
  );
}

function SyncResultDetails({
  action,
  result,
}: {
  action: "sync" | "restore";
  result: AccountSyncResult;
}) {
  const rows =
    action === "sync"
      ? [
          ["アルバム写真", result.pushedCollectionPhotos, "枚"],
          ["とったねがお", result.pushedOwnSleepingPhotos, "枚"],
          ["とどいたねがお", result.pushedKeptExchangePhotos, "枚"],
          ["猫", result.pushedCats, "匹"],
          ["記録", result.pushedRecords, "件"],
        ]
      : [
          ["アルバム写真", result.restoredCollectionPhotos, "枚"],
          ["とったねがお", result.restoredOwnSleepingPhotos, "枚"],
          ["とどいたねがお", result.restoredKeptExchangePhotos, "枚"],
          ["猫", result.restoredCats, "匹"],
          ["記録", result.restoredRecords, "件"],
        ];
  const visibleRows = rows.filter(([, value]) => Number(value) > 0);
  const title = action === "sync" ? "保存結果" : "復元結果";
  const photoTotal =
    action === "sync"
      ? result.pushedCollectionPhotos +
        result.pushedOwnSleepingPhotos +
        result.pushedKeptExchangePhotos
      : result.restoredCollectionPhotos +
        result.restoredOwnSleepingPhotos +
        result.restoredKeptExchangePhotos;

  return (
    <div style={styles.syncResultDetails} role="status">
      <p style={styles.syncResultTitle}>{title}</p>
      <p style={styles.syncResultSummary}>
        {getSyncPhotoSummary(action, photoTotal, result.status)}
      </p>
      {visibleRows.length > 0 ? (
        <div style={styles.syncResultRows}>
          {visibleRows.map(([label, value, unit]) => (
            <span key={String(label)} style={styles.syncResultChip}>
              {label} {value}
              {unit}
            </span>
          ))}
        </div>
      ) : (
        <p style={styles.syncResultEmpty}>
          {action === "sync"
            ? "アカウントへ新しく保存されたデータはありません。"
            : "この端末へ新しく復元されたデータはありません。"}
        </p>
      )}
      {result.errors.length > 0 ? (
        <AppCard as="div" variant="inset" padding="sm" style={styles.syncErrorBox}>
          <p style={styles.syncErrorTitle}>確認が必要です</p>
          {result.errors.slice(0, 3).map((error, index) => (
            <p key={`${error}-${index}`} style={styles.syncErrorText}>
              {formatSyncError(error)}
            </p>
          ))}
        </AppCard>
      ) : null}
    </div>
  );
}

function getSyncPhotoSummary(
  action: "sync" | "restore",
  photoTotal: number,
  status: AccountSyncResult["status"],
) {
  if (photoTotal > 0) {
    return action === "sync"
      ? `写真 ${photoTotal}枚をアカウントに保存しました。`
      : `写真 ${photoTotal}枚をこの端末に戻しました。`;
  }

  if (status === "synced" || status === "restored") {
    return action === "sync"
      ? "猫や記録は保存しました。写真は新しく保存されていません。"
      : "猫や記録は戻りました。写真は新しく戻っていません。";
  }

  return action === "sync"
    ? "新しく保存された写真はありません。"
    : "新しく戻った写真はありません。";
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

function formatSyncError(error: string) {
  if (error.includes("cat_moments") || error.includes("Sleeping photo")) {
    return "とったねがおの保存先を確認できませんでした。";
  }

  if (error.includes("cat_moment_deliveries") || error.includes("Kept photo")) {
    return "とどいたねがおの保存先を確認できませんでした。";
  }

  if (error.includes("collection_photos") || error.includes("Collection photo")) {
    return "写真の保存先を確認できませんでした。";
  }

  if (error.includes("Photo upload")) {
    return "写真をアカウントへ保存できませんでした。";
  }

  if (error.includes("auth") || error.includes("JWT")) {
    return "ログイン状態を確認できませんでした。";
  }

  return "同期中にエラーがありました。";
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

function formatTraceBool(value: boolean) {
  return value ? "yes" : "no";
}

function formatTraceGate(gate: EveningDeliveryTraceEntry["gate"]) {
  switch (gate) {
    case "no_pending_day":
      return "no pending";
    case "missing_target_or_cat":
      return "missing target/cat";
    case "already_pending":
      return "already pending";
    case "missing_photo":
      return "missing photo";
    case "photo_not_data":
      return "photo non-data";
    case "legacy_photo_not_data":
      return "legacy non-data";
    case "exchange_started":
      return "exchange started";
    case "exchange_completed":
      return "exchange completed";
    case "storage_writeback":
      return "storage writeback";
    default:
      return gate;
  }
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    color: "var(--ink)",
  },
  container: {
    display: "flex",
    flexDirection: "column" as const,
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
  backIcon: {
    fontSize: "18px",
    lineHeight: 1,
    color: "var(--ink)",
  },
  title: {
    fontSize: "24px",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
  },
  settingsTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
    margin: "0 0 16px",
    padding: "4px",
    borderRadius: "var(--radius-full)",
    background: "rgba(255,253,248,0.56)",
    border: "1px solid rgba(120,108,94,0.10)",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  settingsTab: {
    minHeight: "34px",
    border: "none",
    borderRadius: "var(--radius-full)",
    background: "transparent",
    color: "var(--ink-soft)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  settingsTabActive: {
    background: "rgba(234,224,209,0.86)",
    color: "var(--ink)",
    boxShadow: "0 2px 8px rgba(90,76,60,0.045)",
  },
  section: {
    marginBottom: "16px",
  },
  sectionLabel: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--ink-soft)",
    margin: "0 0 7px 6px",
    letterSpacing: "0.08em",
  },
  card: {
    padding: "2px 14px",
  },
  betaCard: {},
  adminSection: {
    marginTop: "8px",
  },
  adminCard: {
    background: "rgba(255,253,248,0.38)",
    border: "1px dashed rgba(120,108,94,0.14)",
    boxShadow: "none",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
  },
  linkRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 0",
    textDecoration: "none",
    color: "var(--ink)",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  rowLabel: {
    fontSize: "13px",
    color: "var(--ink)",
    fontWeight: 500,
  },
  rowValue: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    maxWidth: "160px",
    textAlign: "right" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
  },
  rowChevron: {
    fontSize: "18px",
    lineHeight: 1,
    color: "var(--ink-soft)",
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
    background: "rgba(120,108,94,0.09)",
    margin: "0 -14px",
  },
  loadingText: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    padding: "14px 0",
    margin: 0,
  },
  storageNote: {
    margin: 0,
    padding: "10px 0 12px",
    color: "var(--ink-soft)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.65,
  },
  syncMessage: {
    fontSize: "12px",
    color: "var(--ink-soft)",
    lineHeight: 1.6,
    margin: "0",
    padding: "2px 0 0",
    textAlign: "center" as const,
  },
  syncResultDetails: {
    margin: "0 0 12px",
    padding: "12px",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.56)",
    border: "1px solid #f0ede8",
    display: "grid",
    gap: "8px",
  },
  syncResultTitle: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 500,
    color: "#2a2a28",
  },
  syncResultSummary: {
    margin: 0,
    color: "#5f584f",
    fontSize: "13px",
    lineHeight: 1.5,
  },
  syncResultRows: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
  },
  syncResultChip: {
    borderRadius: "var(--radius-full)",
    background: "#f7f2ea",
    color: "#5f584f",
    fontSize: "12px",
    fontWeight: 500,
    padding: "5px 8px",
    lineHeight: 1,
  },
  syncResultEmpty: {
    margin: 0,
    color: "#8a8a80",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  syncErrorBox: {
    marginTop: "2px",
    display: "grid",
    gap: "6px",
  },
  syncErrorTitle: {
    margin: "0 0 4px",
    color: "#8f5f35",
    fontSize: "12px",
    fontWeight: 500,
  },
  syncErrorText: {
    margin: "2px 0 0",
    color: "#8f5f35",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  syncStatusPanel: {
    padding: "12px 0",
    display: "grid",
    gap: "10px",
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
    fontWeight: 500,
    color: "#2a2a28",
    margin: "0 0 4px",
  },
  syncOverviewText: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--ink-soft)",
    margin: 0,
  },
  syncOverviewBadge: {
    flexShrink: 0,
    border: `0.5px solid ${APP_ACCENT}`,
    borderRadius: "var(--radius-full)",
    color: APP_ACCENT,
    fontSize: "12px",
    fontWeight: 500,
    padding: "4px 8px",
  },
  syncMetaGrid: {
    display: "grid",
    gap: "5px",
    color: "var(--ink-soft)",
    fontSize: "12px",
    lineHeight: 1.4,
  },
  syncWarning: {
    margin: 0,
    color: "#a66d3f",
    fontSize: "12px",
    lineHeight: 1.5,
  },
  authDebugPanel: {
    display: "grid",
    gap: "12px",
  },
  authDebugRows: {
    display: "grid",
    gap: "7px",
  },
  moderationItem: {
    display: "grid",
    gridTemplateColumns: "72px minmax(0, 1fr)",
    gap: "10px",
    alignItems: "start",
    padding: "10px 0",
    borderTop: "1px solid var(--line)",
  },
  moderationImage: {
    width: "72px",
    height: "72px",
    objectFit: "cover" as const,
    borderRadius: "var(--radius-md)",
    background: "var(--paper-card)",
  },
  moderationImageFallback: {
    width: "72px",
    height: "72px",
    display: "grid",
    placeItems: "center",
    borderRadius: "var(--radius-md)",
    background: "var(--paper-card)",
    color: "var(--ink-faint)",
    fontSize: "12px",
  },
  moderationBody: {
    display: "grid",
    gap: "7px",
    minWidth: 0,
  },
  moderationActions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  flagToggleGroup: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  flagToggleButton: {
    minHeight: "44px",
    borderRadius: "var(--radius-md)",
    border: "1px solid rgba(120,108,94,0.16)",
    background: "rgba(255,253,248,0.72)",
    color: "var(--ink-soft)",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  },
  flagToggleButtonActive: {
    border: "1px solid var(--line)",
    background: "var(--paper-card)",
    color: "var(--ink)",
  },
  soundCandidateSelect: {
    minHeight: "38px",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-md)",
    background: "color-mix(in srgb, var(--paper) 72%, transparent)",
    color: "var(--ink)",
    fontFamily: "var(--font-display)",
    fontSize: "13px",
    fontWeight: 400,
    letterSpacing: "var(--tracking-label)",
    padding: "0 10px",
  },
  authDebugRow: {
    display: "grid",
    gridTemplateColumns: "94px minmax(0, 1fr)",
    gap: "8px",
    alignItems: "start",
    fontSize: "12px",
    lineHeight: 1.45,
  },
  authDebugLabel: {
    color: "var(--ink-soft)",
    fontWeight: 500,
  },
  authDebugValue: {
    color: "var(--ink)",
    overflowWrap: "anywhere" as const,
    fontVariantNumeric: "tabular-nums",
  },
  actionStack: {
    display: "grid",
    gap: "10px",
    padding: "0 0 12px",
  },
  betaNote: {
    padding: "12px 0",
    display: "flex",
    flexDirection: "column" as const,
    gap: "5px",
  },
  betaNoteTitle: {
    fontSize: "13px",
    fontWeight: 500,
    color: APP_ACCENT,
    margin: 0,
  },
  betaNoteText: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    lineHeight: 1.65,
    margin: 0,
  },
  feedbackForm: {
    padding: "0 0 14px",
    display: "grid",
    gap: "12px",
  },
  feedbackField: {
    display: "grid",
    gap: "6px",
  },
  feedbackLabel: {
    color: "var(--ink-soft)",
    fontSize: "12px",
    fontWeight: 500,
  },
  feedbackSelect: {
    width: "100%",
    border: "1px solid #eee8df",
    borderRadius: "var(--radius-md)",
    background: "rgba(255,255,255,0.62)",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 500,
    padding: "11px 12px",
  },
  feedbackTextarea: {
    width: "100%",
    border: "1px solid #eee8df",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,255,255,0.62)",
    color: "#2a2a28",
    fontSize: "13px",
    lineHeight: 1.65,
    padding: "12px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  feedbackStatus: {
    margin: 0,
    whiteSpace: "pre-line" as const,
    color: "var(--ink-soft)",
    fontSize: "12px",
    lineHeight: 1.6,
    textAlign: "center" as const,
  },
  legalLinks: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "8px 12px",
    padding: "4px 0",
  },
  legalLink: {
    color: APP_ACCENT,
    fontSize: "12px",
    fontWeight: 500,
    textDecoration: "none",
  },
  legalMuted: {
    color: "var(--ink-soft)",
    fontSize: "12px",
    fontWeight: 500,
  },
} satisfies Record<string, CSSProperties>;

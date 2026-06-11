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
  APP_PILL,
} from "../ui/appTheme";
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

type SettingsTab = "general" | "admin";

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
  const showsAdminSection =
    adminCapabilities.testToolsEnabled || adminCapabilities.stockAdminEnabled;
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTab>("general");

  useEffect(() => {
    setDisplayEnvironment(getDisplayEnvironment());
    refreshKeptExchangeDebug();
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

  async function refreshAdminCapabilities() {
    const capabilities = await readClientAdminCapabilities();

    setAdminCapabilities(capabilities);
    if (capabilities.testToolsEnabled || capabilities.stockAdminEnabled) {
      void refreshDeliveryDiagnostics();
    }
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
          <a href="/home" style={styles.backButton}>
            <span style={styles.backIcon}>‹</span>
          </a>
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
          <AppCard variant="soft" padding="sm" style={styles.card}>
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
                  <button
                    type="button"
                    onClick={() => {
                      void handleSyncNow();
                    }}
                    style={{
                      ...styles.primaryButton,
                      ...(isSyncing ? styles.disabledButton : {}),
                    }}
                    disabled={isSyncing}
                  >
                    {isSyncing ? "保存中..." : "この端末をアカウントに保存"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void handleRestoreFromAccount();
                    }}
                    style={{
                      ...styles.secondaryButton,
                      ...(isSyncing ? styles.disabledButton : {}),
                    }}
                    disabled={isSyncing}
                  >
                    アカウントからこの端末に復元
                  </button>
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
          <AppCard variant="soft" padding="sm" style={styles.card}>
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
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 5 }}>
          <p style={styles.sectionLabel}>βサポーターについて</p>
          <AppCard variant="soft" padding="sm" style={{ ...styles.card, ...styles.betaCard }}>
            {betaCapabilities.feedbackEnabled ? (
              <>
                <div style={styles.betaNote}>
                  <p style={styles.betaNoteTitle}>感じたことを送る</p>
                  <p style={styles.betaNoteText}>
                    よかったこと、分かりにくかったこと、
                    バグっぽいことを送れます。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackKind("beta_feedback");
                    setIsFeedbackOpen((open) => !open);
                    setFeedbackStatus("");
                  }}
                  style={styles.primaryButton}
                >
                  意見を送る
                </button>
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
                  <a href="/account/create" style={styles.primaryButton}>
                    ログインして参加する
                  </a>
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
              <button
                type="button"
                onClick={() => {
                  void refreshAuthDebug();
                }}
                style={styles.secondaryButton}
              >
                ログイン状態を更新する
              </button>
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
              <KeptExchangeDebugPanel debug={keptExchangeDebug} />
              <div style={styles.divider} />
              <button
                type="button"
                onClick={() => {
                  void refreshDeliveryDiagnostics();
                  refreshKeptExchangeDebug();
                }}
                style={styles.secondaryButton}
                disabled={isDeliveryDiagnosticsLoading}
              >
                {isDeliveryDiagnosticsLoading ? "確認中..." : "とどく状態を確認する"}
              </button>
              {adminCapabilities.stockAdminEnabled ? (
                <>
                  <div style={styles.divider} />
                  <button
                    type="button"
                    onClick={() => {
                      void handleStockPhotoImport();
                    }}
                    style={styles.secondaryButton}
                    disabled={isStockAdding}
                  >
                    {isStockAdding ? "追加中..." : "とどくねがおを追加する"}
                  </button>
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
          <AppCard variant="soft" padding="sm" style={styles.card}>
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
          <AppCard variant="soft" padding="sm" style={styles.card}>
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
      <a href="/beta-supporter" style={styles.primaryButton}>
        これからの ねてるねこ
      </a>
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
      <button
        type="submit"
        style={styles.primaryButton}
        disabled={isSending}
      >
        {isSending ? "送っています..." : "送る"}
      </button>
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
    <div style={styles.authDebugPanel}>
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
    </div>
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

function DeliveryDiagnosticsPanel({
  diagnostics,
}: {
  diagnostics: SleepingDeliveryDiagnostics | null;
}) {
  if (!diagnostics) {
    return (
      <div style={styles.authDebugPanel}>
        <p style={styles.syncOverviewText}>
          とどく候補の状態をまだ確認していません。
        </p>
      </div>
    );
  }

  return (
    <div style={styles.authDebugPanel}>
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
    </div>
  );
}

function KeptExchangeDebugPanel({
  debug,
}: {
  debug: KeptExchangePhotoStorageDebug | null;
}) {
  if (!debug) {
    return (
      <div style={styles.authDebugPanel}>
        <p style={styles.syncOverviewText}>
          とどいたねがおの保存状態をまだ確認していません。
        </p>
      </div>
    );
  }

  return (
    <div style={styles.authDebugPanel}>
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
    </div>
  );
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
        <div style={styles.syncErrorBox}>
          <p style={styles.syncErrorTitle}>確認が必要です</p>
          {result.errors.slice(0, 3).map((error, index) => (
            <p key={`${error}-${index}`} style={styles.syncErrorText}>
              {formatSyncError(error)}
            </p>
          ))}
        </div>
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

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    color: "#242522",
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
  settingsTabs: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6px",
    margin: "0 0 16px",
    padding: "4px",
    borderRadius: "999px",
    background: "rgba(255,253,248,0.56)",
    border: "1px solid rgba(120,108,94,0.10)",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  settingsTab: {
    minHeight: "34px",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: "#83796d",
    fontSize: "13px",
    fontWeight: 620,
    cursor: "pointer",
  },
  settingsTabActive: {
    background: "rgba(234,224,209,0.86)",
    color: "#2f2c27",
    boxShadow: "0 2px 8px rgba(90,76,60,0.045)",
  },
  section: {
    marginBottom: "16px",
  },
  sectionLabel: {
    fontSize: "11.5px",
    fontWeight: 600,
    color: "#aaa196",
    margin: "0 0 7px 6px",
    letterSpacing: "0.08em",
  },
  card: {
    borderRadius: "18px",
    padding: "2px 14px",
    background: "rgba(255,253,248,0.58)",
    border: "1px solid rgba(120,108,94,0.10)",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  betaCard: {
    background: "rgba(255,253,248,0.50)",
  },
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
    color: "#2a2a28",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  rowLabel: {
    fontSize: "14px",
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
    background: "rgba(120,108,94,0.09)",
    margin: "0 -14px",
  },
  loadingText: {
    fontSize: "13px",
    color: "#9a9890",
    padding: "14px 0",
    margin: 0,
  },
  storageNote: {
    margin: 0,
    padding: "10px 0 12px",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.65,
  },
  syncMessage: {
    fontSize: "12px",
    color: "#8a8a80",
    lineHeight: 1.6,
    margin: "0",
    padding: "2px 0 0",
    textAlign: "center" as const,
  },
  syncResultDetails: {
    margin: "0 0 12px",
    padding: "12px",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.56)",
    border: "1px solid #f0ede8",
    display: "grid",
    gap: "8px",
  },
  syncResultTitle: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    color: "#2a2a28",
  },
  syncResultSummary: {
    margin: 0,
    color: "#5f584f",
    fontSize: "12.5px",
    lineHeight: 1.5,
  },
  syncResultRows: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px",
  },
  syncResultChip: {
    borderRadius: "999px",
    background: "#f7f2ea",
    color: "#5f584f",
    fontSize: "11.5px",
    fontWeight: 700,
    padding: "5px 8px",
    lineHeight: 1,
  },
  syncResultEmpty: {
    margin: 0,
    color: "#8a8a80",
    fontSize: "11.5px",
    lineHeight: 1.5,
  },
  syncErrorBox: {
    marginTop: "2px",
    borderRadius: "12px",
    background: "#fff7ee",
    border: "1px solid #f0d9bf",
    padding: "9px 10px",
  },
  syncErrorTitle: {
    margin: "0 0 4px",
    color: "#8f5f35",
    fontSize: "11.5px",
    fontWeight: 800,
  },
  syncErrorText: {
    margin: "2px 0 0",
    color: "#8f5f35",
    fontSize: "11.5px",
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
  syncMetaGrid: {
    display: "grid",
    gap: "5px",
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
  authDebugPanel: {
    padding: "14px 0",
    display: "grid",
    gap: "12px",
  },
  authDebugRows: {
    display: "grid",
    gap: "7px",
  },
  authDebugRow: {
    display: "grid",
    gridTemplateColumns: "94px minmax(0, 1fr)",
    gap: "8px",
    alignItems: "start",
    fontSize: "11.5px",
    lineHeight: 1.45,
  },
  authDebugLabel: {
    color: "#9a9890",
    fontWeight: 700,
  },
  authDebugValue: {
    color: "#2a2a28",
    overflowWrap: "anywhere" as const,
    fontVariantNumeric: "tabular-nums",
  },
  primaryButton: {
    display: "block",
    width: "100%",
    textAlign: "center" as const,
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 700,
    color: "#fffdf8",
    background: APP_ACCENT,
    border: `1px solid ${APP_ACCENT}`,
    borderRadius: "14px",
    textDecoration: "none",
    cursor: "pointer",
  },
  secondaryButton: {
    display: "block",
    width: "100%",
    textAlign: "center" as const,
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 650,
    color: "#5f584f",
    background: "rgba(255,253,248,0.72)",
    border: "1px solid rgba(120,108,94,0.16)",
    borderRadius: "14px",
    textDecoration: "none",
    cursor: "pointer",
  },
  actionStack: {
    display: "grid",
    gap: "10px",
    padding: "0 0 12px",
  },
  disabledButton: {
    opacity: 0.52,
    cursor: "default",
  },
  dangerButton: {
    display: "block",
    width: "100%",
    boxSizing: "border-box" as const,
    padding: "12px 14px",
    fontSize: "14px",
    fontWeight: 650,
    color: "#9b4a3d",
    background: "rgba(255,253,248,0.46)",
    border: "1px solid rgba(155,74,61,0.14)",
    borderRadius: "14px",
    textAlign: "center" as const,
    cursor: "pointer",
  },
  betaNote: {
    padding: "12px 0",
    display: "flex",
    flexDirection: "column" as const,
    gap: "5px",
  },
  betaNoteTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: APP_ACCENT,
    margin: 0,
  },
  betaNoteText: {
    fontSize: "12.5px",
    color: "#8a8a80",
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
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 700,
  },
  feedbackSelect: {
    width: "100%",
    border: "1px solid #eee8df",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.62)",
    color: "#2a2a28",
    fontSize: "14px",
    fontWeight: 600,
    padding: "11px 12px",
  },
  feedbackTextarea: {
    width: "100%",
    border: "1px solid #eee8df",
    borderRadius: "16px",
    background: "rgba(255,255,255,0.62)",
    color: "#2a2a28",
    fontSize: "14px",
    lineHeight: 1.65,
    padding: "12px",
    resize: "vertical",
    boxSizing: "border-box",
  },
  feedbackStatus: {
    margin: 0,
    whiteSpace: "pre-line" as const,
    color: "#8a8a80",
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
    fontWeight: 700,
    textDecoration: "none",
  },
  legalMuted: {
    color: "#9a9890",
    fontSize: "12px",
    fontWeight: 600,
  },
} satisfies Record<string, CSSProperties>;

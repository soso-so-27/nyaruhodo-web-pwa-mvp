"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  getAccountSyncOverview,
  mergeAccountDataWithAccount,
} from "../../lib/accountSync";
import type { AccountSyncOverview, AccountSyncResult } from "../../lib/accountSync";
import {
  readClientAdminCapabilities,
  type ClientAdminCapabilities,
} from "../../lib/adminCapabilitiesClient";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import { resizeImageFileToDataUrl } from "../../lib/imageResize";
import {
  readClientBetaCapabilities,
  sendBetaFeedback,
  type BetaFeedbackCategory,
  type ClientBetaCapabilities,
} from "../../lib/betaClient";
import {
  readClientBillingStatus,
  type ClientBillingStatus,
} from "../../lib/billingClient";
import {
  buildAuthDebugSnapshot,
  type AuthDebugSnapshot,
} from "../../lib/authDebug";
import {
  claimPendingReferral,
  readClientReferralSummary,
  type ClientReferralSummary,
} from "../../lib/referrals/client";
import {
  getDisplayEnvironment,
  type DisplayEnvironment,
} from "../../lib/displayEnvironment";
import { createBrowserSupabaseClient } from "../../lib/supabase/browser";
import {
  APP_ACCENT,
  APP_PAGE_BACKGROUND,
} from "../ui/appTheme";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { AppTextField } from "../ui/AppTextField";
import { PhotoTile } from "../ui/PhotoTile";
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
  disableOmoideMemories,
  readOmoideMemoryControls,
} from "../../lib/home/omoideDelivery";
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
const MAX_UPLOAD_SOURCE_FILE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_SOURCE_IMAGE_MIME_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function SettingsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [lastSyncResult, setLastSyncResult] = useState<{
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
  const [referralSummary, setReferralSummary] =
    useState<ClientReferralSummary | null>(null);
  const [referralMessage, setReferralMessage] = useState("");
  const [omoideDisabled, setOmoideDisabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const hasRunAccountAutoSync = useRef(false);
  const showsAdminSection =
    adminCapabilities.isAdmin ||
    adminCapabilities.testToolsEnabled ||
    adminCapabilities.stockAdminEnabled;
  const [activeSettingsTab, setActiveSettingsTab] =
    useState<SettingsTab>("general");

  useEffect(() => {
    setDisplayEnvironment(getDisplayEnvironment());
    setOmoideDisabled(readOmoideMemoryControls().disabled === true);
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
      await claimPendingReferral();
      await refreshSyncOverview();
      await refreshReferralSummary();
      if (!hasRunAccountAutoSync.current) {
        hasRunAccountAutoSync.current = true;
        void runAccountSync("auto");
      }
    }
    setIsLoading(false);
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setNotificationPermission(
      "Notification" in window ? Notification.permission : "unsupported",
    );
  }, []);

  async function refreshReferralSummary() {
    const summary = await readClientReferralSummary();
    setReferralSummary(summary.isLoggedIn ? summary : null);
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
    setReferralSummary(null);
    setReferralMessage("");
  }

  async function handleCopyReferralLink() {
    const shareUrl = referralSummary?.shareUrl;

    if (!shareUrl) {
      setReferralMessage("紹介リンクを準備できませんでした。少し時間をおいてもう一度お試しください。");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setReferralMessage("紹介リンクをコピーしました。");
      trackProductEvent("referral_link_copied", {
        code: referralSummary.code,
      });
    } catch {
      setReferralMessage(shareUrl);
    }
  }

  async function handleShareReferralLink() {
    const shareUrl = referralSummary?.shareUrl;

    if (!shareUrl) {
      setReferralMessage("紹介リンクを準備できませんでした。少し時間をおいてもう一度お試しください。");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: "ねてるねこ",
          text: "ねこだよりを一緒に試してみませんか。",
          url: shareUrl,
        });
        trackProductEvent("referral_link_shared", {
          code: referralSummary.code,
          method: "native_share",
        });
        return;
      } catch {
        // Native share can be cancelled; fall back to copy.
      }
    }

    await handleCopyReferralLink();
  }

  async function handleSyncNow() {
    await runAccountSync("manual");
  }

  async function runAccountSync(trigger: "auto" | "manual") {
    if (isSyncing && trigger === "manual") {
      return;
    }

    if (trigger === "manual") {
      setIsSyncing(true);
      setSyncMessage("");
    }
    trackProductEvent("settings_account_sync_clicked", {
      trigger,
      remote_cats: syncOverview?.remoteCats ?? null,
      remote_records: syncOverview?.remoteRecords ?? null,
      remote_cat_gallery_photos: syncOverview?.remoteCatGalleryPhotos ?? null,
      remote_collection_photos: syncOverview?.remoteCollectionPhotos ?? null,
      remote_own_sleeping_photos: syncOverview?.remoteOwnSleepingPhotos ?? null,
      remote_kept_exchange_photos: syncOverview?.remoteKeptExchangePhotos ?? null,
    });

    const result = await mergeAccountDataWithAccount();

    if (trigger === "manual" || result.status === "error") {
      setSyncMessage(getSyncResultMessage(result));
      setLastSyncResult({ result });
    }

    await refreshSyncOverview();
    trackProductEvent("settings_account_sync_completed", {
      trigger,
      status: result.status,
      pushed_cats: result.pushedCats,
      pushed_records: result.pushedRecords,
      pushed_cat_gallery_photos: result.pushedCatGalleryPhotos,
      pushed_collection_photos: result.pushedCollectionPhotos,
      pushed_own_sleeping_photos: result.pushedOwnSleepingPhotos,
      pushed_kept_exchange_photos: result.pushedKeptExchangePhotos,
      restored_cats: result.restoredCats,
      restored_records: result.restoredRecords,
      restored_cat_gallery_photos: result.restoredCatGalleryPhotos,
      restored_collection_photos: result.restoredCollectionPhotos,
      restored_own_sleeping_photos: result.restoredOwnSleepingPhotos,
      restored_kept_exchange_photos: result.restoredKeptExchangePhotos,
      error_count: result.errors.length,
    });

    if (trigger === "manual") {
      setIsSyncing(false);
    }
  }

  async function handleNotificationPermissionRequest() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    const permission = await Notification.requestPermission().catch(
      () => Notification.permission,
    );
    setNotificationPermission(permission);
    trackProductEvent("notification_permission_requested", {
      route: "/settings",
      permission,
      surface: "settings",
    });
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
    setModerationMessage(
      ok ? (decision === "approved" ? "承認しました" : "除外しました") : "更新できませんでした",
    );
    if (ok) {
      setModerationQueue((items) => items.filter((item) => item.id !== momentId));
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
      setFeedbackStatus("改善メモを入力してください。");
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
      kind: betaCapabilities.supporterVoiceEnabled
        ? "supporter_voice"
        : "beta_feedback",
    });

    if (ok) {
      setFeedbackMessage("");
      setFeedbackStatus("届きました。\nβに参加してくれてありがとう。");
    } else {
      setFeedbackStatus("送信できませんでした。ログイン状態を確認してください。");
    }

    setIsFeedbackSending(false);
  }

  function refreshKeptExchangeDebug() {
    setKeptExchangeDebug(readKeptExchangePhotoStorageDebug());
  }

  function handleOmoideDisabledToggle() {
    const next = !omoideDisabled;
    disableOmoideMemories(next);
    setOmoideDisabled(next);
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <AppButton href="/home" variant="quiet" size="sm" style={styles.backButton}>
            ‹ ホーム
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
          <p style={styles.sectionLabel}>アカウント同期</p>
          <AppCard variant="outlined" padding="sm" style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowLabel}>
                いまの入口: {formatDisplayEnvironmentValue(displayEnvironment)}
              </span>
            </div>
            <div style={styles.divider} />
            <p style={styles.storageNote}>
              この端末とアカウントの写真をそろえます。
            </p>
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
                    variant="ghost"
                    fullWidth
                    style={styles.settingsActionButton}
                    loading={isSyncing}
                    onClick={() => {
                      void handleSyncNow();
                    }}
                    disabled={isSyncing}
                  >
                    {isSyncing ? "同期中…" : "いますぐ同期する"}
                  </AppButton>
                </div>
                {syncMessage ? (
                  <p style={styles.syncMessage} role="status">
                    {syncMessage}
                  </p>
                ) : null}
                {lastSyncResult ? (
                  <SyncResultDetails result={lastSyncResult.result} />
                ) : null}
              </>
            ) : null}
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 1 }}>
          <p style={styles.sectionLabel}>アカウント</p>
          <AppCard variant="outlined" padding="sm" style={styles.card}>
            {isLoading ? (
              <p style={styles.loadingText}>確認中…</p>
            ) : isLoggedIn ? (
              <>
                <div style={styles.accountRow}>
                  <div style={styles.rowLeft}>
                    <span style={styles.statusDot} />
                    <span style={styles.rowLabel}>ログイン中</span>
                  </div>
                  <div style={styles.accountActionSide}>
                    <span style={styles.accountEmail}>{email ?? ""}</span>
                    <button
                      type="button"
                      style={styles.accountTextButton}
                      onClick={handleLogout}
                    >
                      ログアウト
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div style={styles.accountRow}>
                  <div style={styles.rowLeft}>
                    <span style={{ ...styles.statusDot, ...styles.statusDotOff }} />
                    <span style={styles.rowLabel}>ログアウト中</span>
                  </div>
                  <AppButton
                    href="/account/create"
                    variant="quiet"
                    size="sm"
                    style={styles.accountInlineButton}
                  >
                    作成する
                  </AppButton>
                </div>
              </>
            )}
            <div style={styles.divider} />
            <a href="/account-deletion" style={styles.linkRow}>
              <span style={styles.rowLabel}>アカウントとデータの削除について</span>
              <span style={styles.rowChevron}>›</span>
            </a>
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 3 }}>
          <p style={styles.sectionLabel}>通知</p>
          <AppCard variant="outlined" padding="sm" style={styles.card}>
            <NotificationSettingsPanel
              environment={displayEnvironment}
              permission={notificationPermission}
              onRequestPermission={() => {
                void handleNotificationPermissionRequest();
              }}
            />
          </AppCard>
        </section>

        <section style={{ ...styles.section, order: 4 }}>
          <p style={styles.sectionLabel}>思い出便</p>
          <AppCard variant="outlined" padding="sm" style={styles.card}>
            <div style={styles.row}>
              <span style={styles.rowTextStack}>
                <span style={styles.rowLabel}>思い出を 受け取らない</span>
                <span style={styles.rowDescription}>
                  オンにすると、過去のねがおの思い出便は届きません。
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={omoideDisabled}
                style={{
                  ...styles.switchButton,
                  ...(omoideDisabled ? styles.switchButtonOn : {}),
                }}
                onClick={handleOmoideDisabledToggle}
              >
                <span
                  style={{
                    ...styles.switchKnob,
                    ...(omoideDisabled ? styles.switchKnobOn : {}),
                  }}
                  aria-hidden="true"
                />
              </button>
            </div>
          </AppCard>
        </section>

        {isLoggedIn && referralSummary?.referralEnabled ? (
          <section style={{ ...styles.section, order: 5 }}>
            <p style={styles.sectionLabel}>紹介</p>
            <AppCard variant="outlined" padding="sm" style={styles.card}>
              <div style={styles.betaNote}>
                <p style={styles.betaNoteTitle}>ねてるねこを 紹介する</p>
                <p style={styles.betaNoteText}>
                  ねてるねこを試してほしい人に、あなた専用のリンクを渡せます。
                  登録されると、ここに紹介数が残ります。
                </p>
              </div>
              <div style={styles.divider} />
              <div style={styles.row}>
                <span style={styles.rowLabel}>紹介コード</span>
                <span style={styles.referralCode}>{referralSummary.code}</span>
              </div>
              {referralSummary.acceptedCount > 0 ? (
                <>
                  <div style={styles.divider} />
                  <div style={styles.row}>
                    <span style={styles.rowLabel}>紹介された人</span>
                    <span style={styles.rowValue}>{referralSummary.acceptedCount}人</span>
                  </div>
                </>
              ) : null}
              <div style={styles.divider} />
              <div style={styles.referralActions}>
                <AppButton
                  type="button"
                  variant="ghost"
                  fullWidth
                  style={styles.settingsActionButton}
                  onClick={() => {
                    void handleShareReferralLink();
                  }}
                >
                  共有する
                </AppButton>
                <AppButton
                  type="button"
                  variant="quiet"
                  fullWidth
                  style={styles.settingsQuietActionButton}
                  onClick={() => {
                    void handleCopyReferralLink();
                  }}
                >
                  リンクをコピー
                </AppButton>
              </div>
              {referralMessage ? (
                <p style={styles.syncMessage} role="status">
                  {referralMessage}
                </p>
              ) : null}
            </AppCard>
          </section>
        ) : null}

        <section style={{ ...styles.section, order: 6 }}>
          <p style={styles.sectionLabel}>参加と応援</p>
          <AppCard variant="outlined" padding="sm" style={{ ...styles.card, ...styles.betaCard }}>
            {betaCapabilities.feedbackEnabled ? (
              <>
                <div style={styles.betaNote}>
                  <p style={styles.betaNoteTitle}>改善メモを送る</p>
                  <p style={styles.betaNoteText}>
                    {betaCapabilities.supporterVoiceEnabled
                      ? "βサポーターの声も、ここにまとめて送れます。"
                      : "返信がいらない感想や気づきを送れます。"}
                    削除・ログイン・支払いなどの連絡は問い合わせへ。
                  </p>
                </div>
                <AppButton
                  type="button"
                  variant="ghost"
                  fullWidth
                  style={styles.settingsActionButton}
                  onClick={() => {
                    setIsFeedbackOpen((open) => !open);
                    setFeedbackStatus("");
                  }}
                >
                  改善メモを書く
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
                  <p style={styles.betaNoteTitle}>改善メモを送る</p>
                  <p style={styles.betaNoteText}>
                    β参加者は、返信不要の感想や気づきを送れます。
                    返事が必要な連絡は問い合わせを使ってください。
                  </p>
                </div>
                {!isLoggedIn ? (
                  <AppButton
                    href="/account/create"
                    variant="ghost"
                    fullWidth
                    style={styles.settingsActionButton}
                  >
                    ログインして参加する
                  </AppButton>
                ) : null}
                <div style={styles.divider} />
              </>
            )}
            <BetaSupporterPanel
              billingStatus={billingStatus}
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
              <a href="/admin/analytics" style={styles.linkRow}>
                <span style={styles.rowLabel}>Analytics</span>
                <span style={styles.rowChevron}>›</span>
              </a>
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
                {isDeliveryDiagnosticsLoading ? "確認中…" : "とどく状態を確認する"}
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
                    {isStockAdding ? "追加中…" : "とどくねがおを追加する"}
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
        <section style={{ ...styles.section, order: 7 }}>
          <p style={styles.sectionLabel}>ヘルプと規約</p>
          <AppCard variant="outlined" padding="sm" style={styles.card}>
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

        <section style={{ ...styles.section, order: 8 }}>
          <p style={styles.sectionLabel}>アプリについて</p>
          <AppCard variant="outlined" padding="sm" style={styles.card}>
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
              <p style={styles.betaNoteTitle}>現在ベータ版として公開中</p>
              <p style={styles.betaNoteText}>
                写真を長く置けるように、保存容量の拡張や家族共有の準備をしています。
                料金や提供範囲が変わる場合は、事前にお知らせします。
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
}: {
  billingStatus: ClientBillingStatus;
}) {
  return (
    <div style={styles.betaNote}>
      <p style={styles.betaNoteTitle}>
        {billingStatus.isBetaSupporter ? "βサポーターです" : "βサポーター"}
      </p>
      <p style={styles.betaNoteText}>
        ねてるねこのこれからと、この場所を静かに続けるための応援について見られます。
      </p>
      <AppButton
        href="/beta-supporter"
        variant="ghost"
        fullWidth
        style={styles.settingsActionButton}
      >
        これからの ねてるねこ
      </AppButton>
    </div>
  );
}

function formatDisplayEnvironmentValue(environment: DisplayEnvironment) {
  if (environment === "standalone") {
    return "ホーム画面アプリ";
  }

  if (environment === "browser") {
    return "Safari / Web";
  }

  return "確認中";
}

function NotificationSettingsPanel({
  environment,
  permission,
  onRequestPermission,
}: {
  environment: DisplayEnvironment;
  permission: NotificationPermission | "unsupported";
  onRequestPermission: () => void;
}) {
  if (environment !== "standalone") {
    return (
      <div style={styles.betaNote}>
        <p style={styles.betaNoteTitle}>Push通知はホーム画面アプリで使えます</p>
        <p style={styles.betaNoteText}>
          夜8時のねこだより通知は準備中です。通知を使うときは、ホーム画面に追加したねてるねこから設定します。
        </p>
      </div>
    );
  }

  if (permission === "granted") {
    return (
      <div style={styles.betaNote}>
        <p style={styles.betaNoteTitle}>通知は許可されています</p>
        <p style={styles.betaNoteText}>
          夜8時のPush通知は準備中です。配信が始まるまでは通知は届きません。
        </p>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div style={styles.betaNote}>
        <p style={styles.betaNoteTitle}>通知はオフです</p>
        <p style={styles.betaNoteText}>
          iPhoneの設定 &gt; ねてるねこ &gt; 通知 から変えられます。
        </p>
      </div>
    );
  }

  if (permission === "unsupported") {
    return (
      <div style={styles.betaNote}>
        <p style={styles.betaNoteTitle}>この端末では通知を使えません</p>
        <p style={styles.betaNoteText}>
          ホーム画面アプリで開いているか、端末の通知設定を確認してください。
        </p>
      </div>
    );
  }

  return (
    <div style={styles.betaNote}>
      <p style={styles.betaNoteTitle}>夜8時のPush通知（準備中）</p>
      <p style={styles.betaNoteText}>
        ねこだよりの時間を思い出すための通知です。今は許可設定だけ準備しています。
      </p>
      <AppButton
        type="button"
        variant="ghost"
        fullWidth
        style={styles.settingsActionButton}
        onClick={onRequestPermission}
      >
        通知を許可する
      </AppButton>
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
      <AppTextField
        as="select"
        label="種類"
        value={category}
        onChange={(event) =>
          onCategoryChange(event.target.value as BetaFeedbackCategory)
        }
      >
        <option value="good">よかった</option>
        <option value="confusing">わかりにくい</option>
        <option value="bug">バグっぽい</option>
        <option value="request">要望</option>
        <option value="other">その他</option>
      </AppTextField>
      <AppTextField
        as="textarea"
        label="本文"
        value={message}
        onChange={(event) => onMessageChange(event.target.value)}
        maxLength={2000}
        required
        rows={5}
        placeholder="返信がいらない感想や気づきを書いてください"
      />
      <AppButton
        type="submit"
        variant="ghost"
        fullWidth
        style={styles.settingsActionButton}
        loading={isSending}
        disabled={isSending}
      >
        {isSending ? "送っています…" : "送る"}
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
  return resizeImageFileToDataUrl(file, maxSize, quality);
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
  if (file.size > MAX_UPLOAD_SOURCE_FILE_BYTES) {
    return false;
  }

  if (file.type) {
    return SUPPORTED_SOURCE_IMAGE_MIME_TYPES.has(file.type.toLowerCase());
  }

  return /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name);
}

function AuthDebugPanel({ snapshot }: { snapshot: AuthDebugSnapshot | null }) {
  if (!snapshot) {
    return <p style={styles.loadingText}>ログイン状態を読み込み中…</p>;
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
        <AuthDebugRow label="表示中" value={`${moments.length}件`} />
        {message ? <AuthDebugRow label="結果" value={message} /> : null}
      </div>
      {moments.map((moment) => (
        <div key={moment.id} style={styles.moderationItem}>
          {moment.photoSrc ? (
            <PhotoTile
              src={moment.photoSrc}
              alt=""
              variant="tile"
              aspect="1 / 1"
              style={styles.moderationImageRoot}
              imageStyle={styles.moderationImage}
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
    overview.localCatGalleryPhotos +
    overview.localCollectionPhotos +
    overview.localOwnSleepingPhotos +
    overview.localKeptExchangePhotos;
  const remotePhotoTotal =
    overview.remoteCatGalleryPhotos +
    overview.remoteCollectionPhotos +
    overview.remoteOwnSleepingPhotos +
    overview.remoteKeptExchangePhotos;
  const latestSyncAt = getLatestSyncDate(overview.lastPushAt, overview.lastPullAt);

  return (
    <div style={styles.syncStatusPanel}>
      <div style={styles.syncMetaGrid}>
        <span>最終同期: {formatSyncDate(latestSyncAt)}</span>
        <span>
          この端末: 写真{localPhotoTotal}・猫{overview.localCats} ／ アカウント:
          写真{remotePhotoTotal}・猫{overview.remoteCats}
        </span>
      </div>

      {overview.errors.length > 0 ? (
        <p style={styles.syncWarning}>一部の同期状態を確認できませんでした。</p>
      ) : null}
    </div>
  );
}

function SyncResultDetails({
  result,
}: {
  result: AccountSyncResult;
}) {
  const rows = [
    ["この子の写真", result.restoredCatGalleryPhotos + result.pushedCatGalleryPhotos, "枚"],
    ["アルバム写真", result.restoredCollectionPhotos + result.pushedCollectionPhotos, "枚"],
    ["とったねがお", result.restoredOwnSleepingPhotos + result.pushedOwnSleepingPhotos, "枚"],
    ["とどいたねがお", result.restoredKeptExchangePhotos + result.pushedKeptExchangePhotos, "枚"],
    ["猫", result.restoredCats + result.pushedCats, "匹"],
    ["記録", result.restoredRecords + result.pushedRecords, "件"],
  ];
  const visibleRows = rows.filter(([, value]) => Number(value) > 0);
  const photoTotal =
    result.pushedCatGalleryPhotos +
    result.pushedCollectionPhotos +
    result.pushedOwnSleepingPhotos +
    result.pushedKeptExchangePhotos +
    result.restoredCatGalleryPhotos +
    result.restoredCollectionPhotos +
    result.restoredOwnSleepingPhotos +
    result.restoredKeptExchangePhotos;

  return (
    <div style={styles.syncResultDetails} role="status">
      <p style={styles.syncResultTitle}>同期結果</p>
      <p style={styles.syncResultSummary}>
        {getSyncPhotoSummary(photoTotal, result.status)}
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
          新しく揃えたデータはありません。
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
  photoTotal: number,
  status: AccountSyncResult["status"],
) {
  if (status === "error") {
    return "同期できませんでした。あとで もう一度。";
  }

  if (photoTotal > 0) {
    return `同期しました（写真${photoTotal}枚が新しく揃いました）。`;
  }

  return "同期しました。";
}

function getSyncResultMessage(
  result: AccountSyncResult,
) {
  if (result.status === "error") {
    return "同期できませんでした。あとで もう一度。";
  }

  const photoTotal =
    result.pushedCatGalleryPhotos +
    result.pushedCollectionPhotos +
    result.pushedOwnSleepingPhotos +
    result.pushedKeptExchangePhotos +
    result.restoredCatGalleryPhotos +
    result.restoredCollectionPhotos +
    result.restoredOwnSleepingPhotos +
    result.restoredKeptExchangePhotos;

  return getSyncPhotoSummary(photoTotal, result.status);
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

function getLatestSyncDate(lastPushAt: string | null, lastPullAt: string | null) {
  const candidates = [lastPushAt, lastPullAt]
    .map((value) => {
      const timestamp = value ? Date.parse(value) : NaN;
      return Number.isFinite(timestamp) ? { value, timestamp } : null;
    })
    .filter((candidate): candidate is { value: string; timestamp: number } =>
      Boolean(candidate),
    )
    .sort((a, b) => b.timestamp - a.timestamp);

  return candidates[0]?.value ?? null;
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
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "var(--ink)",
  },
  container: {
    display: "flex",
    flexDirection: "column" as const,
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding:
      "calc(18px + env(safe-area-inset-top)) 20px calc(40px + env(safe-area-inset-bottom))",
  },
  header: {
    display: "grid",
    gap: "18px",
    justifyItems: "start",
    padding: "0 0 24px",
  },
  backButton: {
    marginLeft: "-12px",
  },
  title: {
    fontSize: "24px",
    fontWeight: 500,
    color: "var(--ink)",
    margin: 0,
    letterSpacing: "0.04em",
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
    marginBottom: "18px",
  },
  sectionLabel: {
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--ink-soft)",
    margin: "0 0 8px 2px",
    letterSpacing: "0.08em",
  },
  card: {
    padding: "0 12px",
    borderRadius: "18px",
    background: "rgba(255,253,248,0.42)",
    border: "1px solid rgba(120,108,94,0.12)",
    boxShadow: "none",
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
    minHeight: "52px",
    padding: "8px 0",
  },
  linkRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "50px",
    padding: "7px 0",
    textDecoration: "none",
    color: "var(--ink)",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  rowTextStack: {
    minWidth: 0,
    display: "grid",
    gap: "4px",
  },
  rowLabel: {
    fontSize: "13px",
    color: "var(--ink)",
    fontWeight: 500,
  },
  rowDescription: {
    maxWidth: "230px",
    color: "var(--ink-soft)",
    fontSize: "12px",
    lineHeight: 1.55,
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
  referralCode: {
    borderRadius: "var(--radius-full)",
    border: "1px solid rgba(120,108,94,0.16)",
    background: "rgba(255,253,248,0.68)",
    color: "var(--ink)",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.12em",
    lineHeight: 1,
    padding: "7px 10px",
  },
  switchButton: {
    flex: "0 0 auto",
    width: "46px",
    height: "28px",
    padding: "3px",
    border: "1px solid rgba(120,108,94,0.18)",
    borderRadius: "999px",
    background: "rgba(120,108,94,0.12)",
    cursor: "pointer",
    transition: "background 160ms ease, border-color 160ms ease",
  },
  switchButtonOn: {
    borderColor: "color-mix(in srgb, var(--seal) 62%, transparent)",
    background: "color-mix(in srgb, var(--seal) 42%, var(--paper) 58%)",
  },
  switchKnob: {
    display: "block",
    width: "20px",
    height: "20px",
    borderRadius: "999px",
    background: "var(--paper-card)",
    boxShadow: "0 2px 8px rgba(70, 50, 30, 0.16)",
    transform: "translateX(0)",
    transition: "transform 160ms ease",
  },
  switchKnobOn: {
    transform: "translateX(18px)",
  },
  referralActions: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px",
    padding: "12px 0",
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
    margin: "0 -12px",
  },
  loadingText: {
    fontSize: "13px",
    color: "var(--ink-soft)",
    padding: "14px 0",
    margin: 0,
  },
  storageNote: {
    margin: 0,
    padding: "12px 0",
    color: "var(--ink-soft)",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.7,
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
  },
  moderationImageRoot: {
    width: "72px",
    height: "72px",
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
    gap: "8px",
    padding: "0 0 12px",
  },
  settingsActionButton: {
    minHeight: "42px",
    border: "1px solid rgba(120,108,94,0.14)",
    background: "rgba(255,253,248,0.38)",
    color: "var(--ink)",
    boxShadow: "none",
    fontSize: "13px",
    fontWeight: 500,
  },
  settingsQuietActionButton: {
    minHeight: "40px",
    border: "1px solid transparent",
    background: "transparent",
    color: "var(--ink-soft)",
    boxShadow: "none",
    fontSize: "13px",
    fontWeight: 500,
  },
  accountRow: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    alignItems: "center",
    gap: "12px",
    minHeight: "54px",
    padding: "8px 0",
  },
  accountActionSide: {
    minWidth: 0,
    display: "grid",
    justifyItems: "end",
    gap: "2px",
  },
  accountEmail: {
    maxWidth: "178px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap" as const,
    fontSize: "12px",
    lineHeight: 1.35,
    color: "var(--ink-soft)",
  },
  accountTextButton: {
    minHeight: "30px",
    padding: "0 2px",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: "var(--ink-soft)",
    boxShadow: "none",
    font: "inherit",
    fontSize: "12px",
    fontWeight: 500,
    cursor: "pointer",
  },
  accountInlineButton: {
    minHeight: "36px",
    padding: "0 12px",
    border: "1px solid rgba(120, 108, 94, 0.12)",
    background: "rgba(255, 253, 248, 0.3)",
    color: "var(--ink-soft)",
    boxShadow: "none",
    fontSize: "12px",
    fontWeight: 500,
  },
  betaNote: {
    padding: "12px 0",
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
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
    lineHeight: 1.7,
    margin: 0,
  },
  feedbackForm: {
    padding: "0 0 14px",
    display: "grid",
    gap: "12px",
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

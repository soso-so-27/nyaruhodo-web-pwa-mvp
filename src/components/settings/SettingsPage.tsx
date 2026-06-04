"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import {
  deleteAccountStoredData,
  getAccountSyncOverview,
  syncLocalDataWithAccount,
} from "../../lib/accountSync";
import type { AccountSyncOverview, AccountSyncResult } from "../../lib/accountSync";
import { trackProductEvent } from "../../lib/analytics/productAnalytics";
import {
  AUTH_CODE_VERIFIER_STORAGE_KEY,
  AUTH_STORAGE_KEY,
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
  APP_SURFACE,
} from "../ui/appTheme";
import {
  readSharedExchangePhotos,
  saveSharedExchangeStockPhoto,
} from "../../lib/home/sleepingPhotos";
import { saveRemoteDeliveryStockPhoto } from "../../lib/home/deliveryCandidates";

export function SettingsPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState("");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [lastSyncResult, setLastSyncResult] = useState<{
    action: "sync" | "restore";
    result: AccountSyncResult;
  } | null>(null);
  const [syncOverview, setSyncOverview] = useState<AccountSyncOverview | null>(null);
  const [authDebug, setAuthDebug] = useState<AuthDebugSnapshot | null>(null);
  const [displayEnvironment, setDisplayEnvironment] =
    useState<DisplayEnvironment>("unknown");
  const [isStockAdding, setIsStockAdding] = useState(false);
  const [stockMessage, setStockMessage] = useState("");
  const [stockPhotoCount, setStockPhotoCount] = useState(0);

  useEffect(() => {
    setDisplayEnvironment(getDisplayEnvironment());
    setStockPhotoCount(readSharedExchangePhotos().length);
    void checkAuthState();
  }, []);

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

  function handleDeleteLocalData() {
    if (
      !window.confirm(
        "この端末の猫データと写真を削除します。アカウントに保存済みのデータは残ります。",
      )
    ) {
      return;
    }

    clearLocalAppData();
    trackProductEvent("settings_local_data_deleted", {
      display_environment: displayEnvironment,
    });
    window.location.href = "/home";
  }

  async function handleDeleteAccountData() {
    if (
      !window.confirm(
        "アカウントに保存した猫データと写真を削除します。この端末のデータも消えます。元に戻せません。",
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setDeleteMessage("");
    const result = await deleteAccountStoredData();

    trackProductEvent("settings_account_data_deleted", {
      status: result.status,
      error_count: result.errors.length,
    });

    if (result.status === "deleted") {
      clearLocalAppData();
      setDeleteMessage("アカウントに保存したデータを削除しました。");
      window.location.href = "/home";
      return;
    }

    setDeleteMessage("アカウントのデータを削除できませんでした。ログイン状態を確認してください。");
    setIsDeleting(false);
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
          Math.max(readSharedExchangePhotos().length, count + savedCount),
        );
      } catch {
        setStockMessage(
          savedCount > 0
            ? `とどくねがおを${savedCount}枚入れました。`
            : "写真を保存できませんでした。",
        );
        setStockPhotoCount((count) =>
          Math.max(readSharedExchangePhotos().length, count + savedCount),
        );
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
          <p style={styles.sectionLabel}>保存場所</p>
          <div style={styles.card}>
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
          </div>
        </section>

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
                <div style={styles.row}>
                  <span style={styles.rowLabel}>写真の保存先</span>
                  <span style={styles.rowValue}>アカウント接続中</span>
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
                {lastSyncResult ? (
                  <SyncResultDetails
                    action={lastSyncResult.action}
                    result={lastSyncResult.result}
                  />
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
                <div style={styles.row}>
                  <span style={styles.rowLabel}>写真の保存先</span>
                  <span style={styles.rowValue}>この端末</span>
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
          <p style={styles.sectionLabel}>ログイン状態</p>
          <div style={styles.card}>
            <AuthDebugPanel snapshot={authDebug} />
            <div style={styles.divider} />
            <button
              type="button"
              onClick={() => {
                void refreshAuthDebug();
              }}
              style={styles.secondaryButton}
            >
              状態を更新
            </button>
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>テスト</p>
          <div style={styles.card}>
            <a href="/onboarding?test=1" style={styles.linkRow}>
              <span style={styles.rowLabel}>オンボーディングを試す</span>
              <span style={styles.rowChevron}>›</span>
            </a>
            <div style={styles.divider} />
            <div style={styles.row}>
              <span style={styles.rowLabel}>とどく候補</span>
              <span style={styles.rowValue}>{stockPhotoCount}枚</span>
            </div>
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
            {stockMessage ? (
              <p style={styles.syncMessage} role="status">
                {stockMessage}
              </p>
            ) : null}
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
              onClick={handleDeleteLocalData}
              style={styles.dangerButton}
            >
              この端末のデータを削除する
            </button>
            <p style={styles.deleteHelp}>
              アカウントに保存済みの写真は残ります。新しいPWAで復元できます。
            </p>
            {isLoggedIn ? (
              <>
                <div style={styles.divider} />
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteAccountData();
                  }}
                  style={styles.dangerButtonStrong}
                  disabled={isDeleting}
                >
                  {isDeleting ? "削除中..." : "アカウントの保存データも削除する"}
                </button>
                <p style={styles.deleteHelp}>
                  アカウントに保存した猫、写真、とった寝顔、とどいた寝顔を削除します。
                </p>
              </>
            ) : null}
            {deleteMessage ? (
              <p style={styles.syncMessage} role="status">
                {deleteMessage}
              </p>
            ) : null}
          </div>
        </section>

        <section style={styles.section}>
          <p style={styles.sectionLabel}>このアプリについて</p>
          <div style={styles.card}>
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
            <div style={styles.row}>
              <span style={styles.rowLabel}>ねてるねこ</span>
              <span style={styles.rowValue}>寝顔を撮ると、ほかの寝顔が届くアプリ</span>
            </div>
            <div style={styles.divider} />
            <div style={styles.row}>
              <span style={styles.rowLabel}>不具合・問い合わせ</span>
              <span style={styles.rowValue}>告知文の連絡先へ</span>
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
          </div>
        </section>
      </div>
    </main>
  );
}

function clearLocalAppData() {
  if (typeof window === "undefined") {
    return;
  }

  const preservedKeys = new Set([AUTH_STORAGE_KEY, AUTH_CODE_VERIFIER_STORAGE_KEY]);

  for (const key of Object.keys(window.localStorage)) {
    if (key.startsWith("sb-") || preservedKeys.has(key)) {
      continue;
    }
    window.localStorage.removeItem(key);
  }
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
    const remoteSaved = await saveRemoteDeliveryStockPhoto(dataUrl);
    const localSaved = saveSharedExchangeStockPhoto({ src: dataUrl });
    const saved = remoteSaved ?? localSaved;

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
  storageNote: {
    margin: 0,
    padding: "12px 0 14px",
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
    padding: "0 0 12px",
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
    padding: "14px 0",
    fontSize: "15px",
    fontWeight: 600,
    color: APP_ACCENT,
    background: "transparent",
    border: "none",
    textDecoration: "none",
    cursor: "pointer",
  },
  secondaryButton: {
    display: "block",
    width: "100%",
    textAlign: "center" as const,
    padding: "12px 0",
    fontSize: "13px",
    fontWeight: 600,
    color: "#8a8a80",
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
  dangerButtonStrong: {
    display: "block",
    width: "100%",
    padding: "14px 0",
    fontSize: "15px",
    fontWeight: 700,
    color: "#b53f23",
    background: "rgba(216,90,48,0.08)",
    border: "1px solid rgba(216,90,48,0.18)",
    borderRadius: "16px",
    textAlign: "center" as const,
    cursor: "pointer",
  },
  deleteHelp: {
    margin: "8px 0 0",
    color: "#8a8a80",
    fontSize: "12px",
    lineHeight: 1.55,
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

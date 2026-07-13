"use client";

import { useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense, useEffect, useState } from "react";

import { AppButton } from "../../../components/ui/AppButton";
import { AppCard } from "../../../components/ui/AppCard";
import { WordmarkHeader } from "../../../components/ui/AppHeader";
import { APP_PAGE_BACKGROUND } from "../../../components/ui/appTheme";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { getDisplayEnvironment } from "../../../lib/displayEnvironment";
import { redeemOnboardingHandoff } from "../../../lib/onboarding/handoff";
import { STORAGE_KEYS } from "../../../lib/storage";

type RestoreStatus = "ready" | "restoring" | "restored" | "error";

export default function OnboardingContinuePage() {
  return (
    <Suspense fallback={<OnboardingContinueShell />}>
      <OnboardingContinueContent />
    </Suspense>
  );
}

function OnboardingContinueContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("handoff") ?? "";
  const next =
    searchParams.get("next") === "second_photo" ||
    searchParams.get("handoff_from") === "account"
      ? "second_photo"
      : "";
  const [status, setStatus] = useState<RestoreStatus>("ready");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasCheckedEnvironment, setHasCheckedEnvironment] = useState(false);
  const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(false);
  const shouldShowEmbeddedGuide = hasCheckedEnvironment && isEmbeddedBrowser;
  const continueUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/onboarding/continue?handoff=${encodeURIComponent(
          token,
        )}${next ? `&next=${encodeURIComponent(next)}` : ""}`;

  useEffect(() => {
    setIsEmbeddedBrowser(detectEmbeddedBrowser());
    setHasCheckedEnvironment(true);
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("つづきの情報が見つかりませんでした。");
    }
  }, [token]);

  async function restoreAndGoHome(method: "auto" | "manual") {
    if (!token || status === "restoring") {
      return;
    }

    setStatus("restoring");
    setMessage("");
    try {
      const result = await redeemOnboardingHandoff(token);
      trackProductEvent("onboarding_handoff_restored", {
        method,
        environment: getDisplayEnvironment(),
        own_sleeping_photo_count: result.ownSleepingPhotoCount,
        kept_exchange_photo_count: result.keptExchangePhotoCount,
        cat_count: result.catCount,
      });
      trackProductEvent("onboarding_resumed", {
        source: "handoff",
        method,
        environment: getDisplayEnvironment(),
      });
      setStatus("restored");
      setMessage("ねがおを復元しました。ホームへ移動します。");
      window.setTimeout(() => {
        goHome();
      }, 350);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "handoff_restore_failed";

      trackProductEvent("onboarding_handoff_restore_failed", {
        method,
        error: errorMessage,
        environment: getDisplayEnvironment(),
      });
      if (
        errorMessage === "handoff_already_used" &&
        hasRestoredOnboardingState()
      ) {
        setStatus("restored");
        setMessage("この端末には、つづきが復元されています。ホームへ進めます。");
        return;
      }

      setStatus("error");
      setMessage(getRestoreErrorMessage(errorMessage));
    }
  }

  function goHome() {
    const suffix =
      next === "second_photo" ? "&from=onboarding_second_photo" : "";
    window.location.assign(`/home?handoff=restored${suffix}`);
  }

  async function copyContinueUrl() {
    if (!continueUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(continueUrl);
      setCopied(true);
      trackProductEvent("handoff_url_copied", {
        route: "/onboarding/continue",
        environment: getDisplayEnvironment(),
      });
    } catch {
      setCopied(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <WordmarkHeader style={styles.header} />
        <AppCard variant="section" padding="lg" style={styles.card}>
          <p style={styles.eyebrow}>つづき</p>
          <h1 style={styles.title}>
            {!hasCheckedEnvironment
              ? "ねがおを 確認しています"
              : shouldShowEmbeddedGuide
                ? "ホーム画面アプリで つづけます"
                : "ねがおを 復元しています"}
          </h1>
          <p style={styles.body}>
            {!hasCheckedEnvironment
              ? "少しだけお待ちください。"
              : shouldShowEmbeddedGuide
                ? "LINEやInstagramの中で入れた写真は、ホーム画面アプリへ自動では渡りません。URLをコピーして、ChromeやSafari、またはホーム画面アプリで開いてください。"
                : "さっき入れたねがおを、このブラウザに戻しています。"}
          </p>

          {shouldShowEmbeddedGuide ? (
            <div style={styles.urlBox}>
              <span style={styles.urlText}>{continueUrl}</span>
            </div>
          ) : null}

          {message ? (
            <p style={styles.message} role="status">
              {message}
            </p>
          ) : null}

          <div style={styles.actions}>
            {!hasCheckedEnvironment ? null : shouldShowEmbeddedGuide ? (
              <>
                <AppButton
                  type="button"
                  variant="accent"
                  fullWidth
                  onClick={() => {
                    void copyContinueUrl();
                  }}
                >
                  {copied ? "コピーしました" : "URLをコピー"}
                </AppButton>
              </>
            ) : (
              <AppButton
                type="button"
                variant="accent"
                fullWidth
                disabled={status === "restoring"}
                onClick={() => {
                  if (status === "restored") {
                    goHome();
                    return;
                  }

                  void restoreAndGoHome("manual");
                }}
              >
                {status === "restoring"
                  ? "復元しています..."
                  : status === "restored"
                    ? "ホームへ"
                    : "復元してホームへ"}
              </AppButton>
            )}
          </div>
          {status === "error" ? (
            <AppButton
              href="/onboarding?reset_onboarding=1"
              variant="quiet"
              size="md"
              data-testid="onboarding-handoff-restart"
            >
              はじめからやり直す
            </AppButton>
          ) : null}
        </AppCard>
      </div>
    </main>
  );
}

function OnboardingContinueShell() {
  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <WordmarkHeader style={styles.header} />
        <AppCard variant="section" padding="lg" style={styles.card}>
          <p style={styles.eyebrow}>つづき</p>
          <h1 style={styles.title}>ねがおを 確認しています</h1>
          <p style={styles.body}>少しだけお待ちください。</p>
        </AppCard>
      </div>
    </main>
  );
}

function getRestoreErrorMessage(errorMessage: string) {
  if (errorMessage === "handoff_local_storage_failed") {
    return "写真を端末に戻せませんでした。空き容量を確認して、同じURLからもう一度お試しください。";
  }

  if (errorMessage === "handoff_expired") {
    return "このつづきのリンクは期限が切れました。元の端末でリンクを作り直すか、この端末ではじめからお試しください。";
  }

  if (errorMessage === "handoff_already_used") {
    return "このつづきのリンクは使用済みです。すでに復元したホーム画面アプリから開いてください。";
  }

  return "つづきの復元ができませんでした。通信を確認してもう一度試すか、この端末ではじめからお試しください。";
}

function detectEmbeddedBrowser() {
  if (typeof window === "undefined") {
    return false;
  }

  const ua = window.navigator.userAgent.toLowerCase();

  return (
    ua.includes(" line/") ||
    ua.includes("instagram") ||
    ua.includes("fbav") ||
    ua.includes("fban") ||
    ua.includes("twitter") ||
    ua.includes("micromessenger")
  );
}

function hasRestoredOnboardingState() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const activeCatId = window.localStorage.getItem(STORAGE_KEYS.activeCatId);
    const profiles = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.catProfiles) ?? "[]",
    ) as Array<{ id?: unknown }>;

    return Boolean(
      activeCatId &&
        Array.isArray(profiles) &&
        profiles.some((profile) => profile?.id === activeCatId),
    );
  } catch {
    return false;
  }
}

const styles = {
  page: {
    minHeight: "100svh",
    background: APP_PAGE_BACKGROUND,
    color: "#40332a",
    padding: "24px 18px",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    display: "grid",
    gap: 18,
  },
  header: {
    justifyContent: "center",
  },
  card: {
    display: "grid",
    gap: 16,
  },
  eyebrow: {
    margin: 0,
    color: "#9f786f",
    fontSize: 12,
    letterSpacing: "0.12em",
  },
  title: {
    margin: 0,
    fontFamily: "var(--font-serif)",
    fontSize: 24,
    lineHeight: 1.45,
    fontWeight: 500,
  },
  body: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.9,
    color: "#62564d",
  },
  urlBox: {
    overflow: "hidden",
    borderRadius: 12,
    border: "1px solid rgba(88, 71, 58, 0.14)",
    background: "rgba(255, 252, 246, 0.78)",
    padding: "10px 12px",
  },
  urlText: {
    display: "block",
    fontSize: 12,
    lineHeight: 1.6,
    color: "#6a5b51",
    wordBreak: "break-all",
  },
  message: {
    margin: 0,
    color: "#9f786f",
    fontSize: 13,
    lineHeight: 1.7,
  },
  actions: {
    display: "grid",
    gap: 10,
  },
} satisfies Record<string, CSSProperties>;

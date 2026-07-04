"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

import { AppButton } from "../../../components/ui/AppButton";
import { AppCard } from "../../../components/ui/AppCard";
import { WordmarkHeader } from "../../../components/ui/AppHeader";
import { APP_PAGE_BACKGROUND } from "../../../components/ui/appTheme";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { getDisplayEnvironment } from "../../../lib/displayEnvironment";
import { redeemOnboardingHandoff } from "../../../lib/onboarding/handoff";

type RestoreStatus = "ready" | "restoring" | "restored" | "error";

export default function OnboardingContinuePage() {
  return (
    <Suspense fallback={<OnboardingContinueShell />}>
      <OnboardingContinueContent />
    </Suspense>
  );
}

function OnboardingContinueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("handoff") ?? "";
  const [status, setStatus] = useState<RestoreStatus>("ready");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const didAutoRestore = useRef(false);
  const isEmbeddedBrowser = useMemo(() => detectEmbeddedBrowser(), []);
  const continueUrl =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/onboarding/continue?handoff=${encodeURIComponent(
          token,
        )}`;

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("つづきの情報が見つかりませんでした。");
      return;
    }

    if (isEmbeddedBrowser || didAutoRestore.current) {
      return;
    }

    didAutoRestore.current = true;
    void restoreAndGoHome("auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmbeddedBrowser, token]);

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
      setStatus("restored");
      setMessage("ねがおを復元しました。ホームへ移動します。");
      window.setTimeout(() => {
        router.replace("/home?handoff=restored");
      }, 350);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "handoff_restore_failed";

      trackProductEvent("onboarding_handoff_restore_failed", {
        method,
        error: errorMessage,
        environment: getDisplayEnvironment(),
      });
      setStatus("error");
      setMessage(
        "つづきの復元ができませんでした。もう一度、招待リンクからお試しください。",
      );
    }
  }

  async function copyContinueUrl() {
    if (!continueUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(continueUrl);
      setCopied(true);
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
            {isEmbeddedBrowser
              ? "ホーム画面アプリで つづけます"
              : "ねがおを 復元しています"}
          </h1>
          <p style={styles.body}>
            {isEmbeddedBrowser
              ? "LINEやInstagramの中で入れた写真は、ホーム画面アプリへ自動では渡りません。このページをChromeやSafari、またはホーム画面アプリで開くと、さっきのねがおを復元できます。"
              : "さっき入れたねがおを、このブラウザに戻しています。"}
          </p>

          {isEmbeddedBrowser ? (
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
            {isEmbeddedBrowser ? (
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
                <AppButton
                  type="button"
                  variant="quiet"
                  size="md"
                  fullWidth
                  disabled={status === "restoring"}
                  onClick={() => {
                    void restoreAndGoHome("manual");
                  }}
                >
                  このまま復元する
                </AppButton>
              </>
            ) : (
              <AppButton
                type="button"
                variant="accent"
                fullWidth
                disabled={status === "restoring" || status === "restored"}
                onClick={() => {
                  void restoreAndGoHome("manual");
                }}
              >
                {status === "restoring" ? "復元しています..." : "復元してホームへ"}
              </AppButton>
            )}
          </div>
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

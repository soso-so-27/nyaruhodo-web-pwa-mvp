"use client";

import type { CSSProperties } from "react";
import { use, useEffect, useState } from "react";

import { AppButton } from "../../../components/ui/AppButton";
import { AppCard } from "../../../components/ui/AppCard";
import { WordmarkHeader } from "../../../components/ui/AppHeader";
import { APP_PAGE_BACKGROUND } from "../../../components/ui/appTheme";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { getDisplayEnvironment } from "../../../lib/displayEnvironment";
import { redeemOnboardingHandoff } from "../../../lib/onboarding/handoff";
import { normalizeOnboardingSource } from "../../../lib/onboarding/progress";
import { STORAGE_KEYS } from "../../../lib/storage";

type RestoreStatus = "ready" | "restoring" | "restored" | "error";
type RestoreDestination = "home" | "onboarding";

type OnboardingContinuePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function OnboardingContinuePage({
  searchParams,
}: OnboardingContinuePageProps) {
  const resolvedSearchParams = use(searchParams);
  return <OnboardingContinueContent searchParams={resolvedSearchParams} />;
}

function OnboardingContinueContent({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const token = readSearchParam(searchParams, "handoff") ?? "";
  const handoffFrom = readSearchParam(searchParams, "handoff_from") ?? "";
  const isIntroHandoff = handoffFrom === "intro";
  const onboardingSource = normalizeOnboardingSource(
    readSearchParam(searchParams, "source"),
  );
  const next =
    readSearchParam(searchParams, "next") === "second_photo" ||
    handoffFrom === "account"
      ? "second_photo"
      : "";
  const initialIsEmbeddedBrowser =
    readSearchParam(searchParams, "embedded") === "1";
  const [status, setStatus] = useState<RestoreStatus>("ready");
  const [message, setMessage] = useState("");
  const [restoreErrorCode, setRestoreErrorCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isEmbeddedBrowser, setIsEmbeddedBrowser] = useState(
    initialIsEmbeddedBrowser,
  );
  const [restoredDestination, setRestoredDestination] =
    useState<RestoreDestination>(isIntroHandoff ? "onboarding" : "home");
  const [restoredSource, setRestoredSource] = useState(onboardingSource);
  const shouldShowEmbeddedGuide = isEmbeddedBrowser && Boolean(token);
  const hasTerminalRestoreError =
    status === "error" && isTerminalRestoreError(restoreErrorCode);
  const restartHref = isIntroHandoff
    ? `/onboarding?source=${encodeURIComponent(onboardingSource)}`
    : "/onboarding?reset_onboarding=1";
  const continueUrl =
    typeof window === "undefined"
      ? ""
      : buildContinueUrl({
          origin: window.location.origin,
          token,
          next,
          isIntroHandoff,
          source: onboardingSource,
        });

  useEffect(() => {
    setIsEmbeddedBrowser(detectEmbeddedBrowser());
  }, []);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setRestoreErrorCode("handoff_missing");
      setMessage(getRestoreErrorMessage("handoff_missing"));
    }
  }, [token]);

  async function restoreAndContinue(method: "auto" | "manual") {
    if (!token || status === "restoring") {
      return;
    }

    setStatus("restoring");
    setMessage("");
    setRestoreErrorCode(null);
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
      const destination =
        result.entryPoint === "onboarding_intro" ? "onboarding" : "home";
      const source = result.source ?? onboardingSource;
      setRestoredDestination(destination);
      setRestoredSource(source);
      setStatus("restored");
      setRestoreErrorCode(null);
      setMessage(
        destination === "onboarding"
          ? "準備できました。このブラウザでつづけます。"
          : "ねがおを復元しました。ホームへ移動します。",
      );
      window.setTimeout(() => {
        goNext(destination, source);
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
        setRestoreErrorCode(null);
        setMessage("この端末には、つづきが復元されています。ホームへ進めます。");
        return;
      }

      setStatus("error");
      setRestoreErrorCode(errorMessage);
      setMessage(getRestoreErrorMessage(errorMessage));
    }
  }

  function goNext(
    destination = restoredDestination,
    source = restoredSource,
  ) {
    if (destination === "onboarding") {
      window.location.assign(
        `/onboarding?source=${encodeURIComponent(source)}&handoff=restored`,
      );
      return;
    }

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
          <p style={styles.eyebrow}>
            {isIntroHandoff ? "ブラウザをかえる" : "つづき"}
          </p>
          <h1 style={styles.title}>
            {shouldShowEmbeddedGuide
              ? isIntroHandoff
                ? "SafariやChromeで つづけます"
                : "ホーム画面アプリで つづけます"
              : getRestoreHeading(status, isIntroHandoff)}
          </h1>
          <p style={styles.body}>
            {shouldShowEmbeddedGuide
              ? isIntroHandoff
                ? "下のURLをコピーして、SafariやChromeのアドレス欄に貼り付けてください。同じ入口からつづけられます。"
                : "LINEやInstagramの中で入れた写真は、ホーム画面アプリへ自動では渡りません。URLをコピーして、ChromeやSafari、またはホーム画面アプリで開いてください。"
              : getRestoreBody(status, isIntroHandoff)}
          </p>

          {shouldShowEmbeddedGuide ? (
            <div style={styles.urlBox}>
              <span style={styles.urlText}>{continueUrl}</span>
            </div>
          ) : null}

          {message ? (
            <p
              style={styles.message}
              role={status === "error" ? "alert" : "status"}
            >
              {message}
            </p>
          ) : null}

          <div style={styles.actions}>
            {shouldShowEmbeddedGuide ? (
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
            ) : hasTerminalRestoreError ? (
              <AppButton
                href={restartHref}
                variant="accent"
                fullWidth
                data-testid="onboarding-handoff-restart"
              >
                {isIntroHandoff
                  ? "このブラウザで はじめる"
                  : "はじめからやり直す"}
              </AppButton>
            ) : (
              <AppButton
                type="button"
                variant="accent"
                fullWidth
                disabled={status === "restoring"}
                data-testid="onboarding-handoff-primary"
                onClick={() => {
                  if (status === "restored") {
                    goNext();
                    return;
                  }

                  void restoreAndContinue("manual");
                }}
              >
                {status === "restoring"
                  ? isIntroHandoff
                    ? "準備しています..."
                    : "戻しています..."
                  : status === "restored"
                    ? isIntroHandoff
                      ? "つづける"
                      : "ホームへ"
                    : status === "error"
                      ? "もう一度ためす"
                      : isIntroHandoff
                        ? "このブラウザで つづける"
                        : "ねがおを戻して ホームへ"}
              </AppButton>
            )}
          </div>
          {status === "error" && !hasTerminalRestoreError ? (
            <AppButton
              href={restartHref}
              variant="quiet"
              size="md"
              data-testid="onboarding-handoff-restart"
            >
              {isIntroHandoff
                ? "このブラウザで はじめる"
                : "はじめからやり直す"}
            </AppButton>
          ) : null}
        </AppCard>
      </div>
    </main>
  );
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function buildContinueUrl({
  origin,
  token,
  next,
  isIntroHandoff,
  source,
}: {
  origin: string;
  token: string;
  next: string;
  isIntroHandoff: boolean;
  source: string;
}) {
  const url = new URL("/onboarding/continue", origin);
  url.searchParams.set("handoff", token);

  if (next) {
    url.searchParams.set("next", next);
  }

  if (isIntroHandoff) {
    url.searchParams.set("handoff_from", "intro");
    url.searchParams.set("source", source);
  }

  return url.toString();
}

function getRestoreErrorMessage(errorMessage: string) {
  if (errorMessage === "handoff_missing") {
    return "つづきの情報が見つかりませんでした。この端末ではじめからお試しください。";
  }

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

function getRestoreHeading(status: RestoreStatus, isIntroHandoff: boolean) {
  if (isIntroHandoff) {
    if (status === "ready") {
      return "このブラウザで つづけます";
    }

    if (status === "restoring") {
      return "つづきを 準備しています";
    }

    if (status === "restored") {
      return "準備できました";
    }

    return "つづけられませんでした";
  }

  if (status === "ready") {
    return "ねがおの つづきを戻します";
  }

  if (status === "restoring") {
    return "ねがおを 戻しています";
  }

  if (status === "restored") {
    return "ねがおを 戻しました";
  }

  return "つづきを戻せませんでした";
}

function getRestoreBody(status: RestoreStatus, isIntroHandoff: boolean) {
  if (isIntroHandoff) {
    if (status === "ready") {
      return "InstagramやLINEで開いたつづきです。ここから写真を入れられます。";
    }

    if (status === "restoring") {
      return "少しだけお待ちください。";
    }

    if (status === "restored") {
      return "同じ入口を、このブラウザに引き継ぎました。";
    }

    return "通信を確認して、もう一度お試しください。";
  }

  if (status === "ready") {
    return "さっき入れたねがおを、このブラウザへ戻します。";
  }

  if (status === "restoring") {
    return "少しだけお待ちください。";
  }

  if (status === "restored") {
    return "この端末に戻せました。ホームへ進みます。";
  }

  return "状況に合わせて、下の案内から進んでください。";
}

function isTerminalRestoreError(errorCode: string | null) {
  return (
    errorCode === "handoff_missing" ||
    errorCode === "handoff_expired" ||
    errorCode === "handoff_already_used"
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
    fontFamily: "var(--font-ui)",
    fontSize: 24,
    lineHeight: 1.45,
    fontWeight: 500,
    letterSpacing: "0.02em",
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

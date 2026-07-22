"use client";

import { useRouter } from "next/navigation";
import { use, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AppButton } from "../../../components/ui/AppButton";
import { AppCard } from "../../../components/ui/AppCard";
import { WordmarkHeader } from "../../../components/ui/AppHeader";
import {
  getActiveCatProfile,
  isCatProfileNameUnset,
  readActiveCatId,
  readCatProfiles,
} from "../../../components/home/homeInputHelpers";
import {
  APP_ACCENT,
  APP_PAGE_BACKGROUND,
} from "../../../components/ui/appTheme";
import { STORAGE_KEYS } from "../../../lib/storage";
import { trackProductEvent } from "../../../lib/analytics/productAnalytics";
import { writeAuthDebugEvent } from "../../../lib/authDebug";
import {
  markOnboardingAlbumCreated,
  normalizeOnboardingSource,
  readOnboardingSourceFromLocation,
  type OnboardingSource,
} from "../../../lib/onboarding/progress";
import { createOnboardingHandoff } from "../../../lib/onboarding/handoff";
import {
  isAnonymousAuthEnabled,
  isAnonymousSupabaseUser,
} from "../../../lib/auth/anonymousAuth";
import {
  finalizeAnonymousStorageTransfer,
  prepareAnonymousStorageRefsForAccountSwitch,
} from "../../../lib/auth/anonymousAccountSwitch";
import { claimPendingReferral } from "../../../lib/referrals/client";
import {
  getEmbeddedBrowserInfo,
  getDisplayEnvironment,
  getDisplayEnvironmentLabel,
  type DisplayEnvironment,
} from "../../../lib/displayEnvironment";
import { createBrowserSupabaseClient } from "../../../lib/supabase/browser";

const ACCOUNT_CREATE_PROMPT_DISMISSED_KEY =
  STORAGE_KEYS.accountCreatePromptDismissed;
const ACCOUNT_CREATE_PROMPT_DISMISSED_MS = 7 * 24 * 60 * 60 * 1000;
const ONBOARDING_ALBUM_COMPLETION_READY_KEY =
  "neteruneko_onboarding_album_completion_ready";

type AccountCreatePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function AccountCreatePage({
  searchParams,
}: AccountCreatePageProps) {
  const resolvedSearchParams = use(searchParams);
  const initialIsFromOnboarding =
    readSearchParam(resolvedSearchParams, "from") === "onboarding";
  const initialOnboardingSource = readInitialOnboardingSource(
    resolvedSearchParams,
  );
  const initialHandoffNext =
    readSearchParam(resolvedSearchParams, "next") === "second_photo"
      ? "second_photo"
      : "";
  const initialReturnToPath = normalizeInternalReturnPath(
    readSearchParam(resolvedSearchParams, "returnTo"),
  );
  const initialEmbeddedBrowserLabel =
    readSearchParam(resolvedSearchParams, "embedded") === "1"
      ? "アプリ内ブラウザ"
      : "";
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pendingAction, setPendingAction] = useState<"google" | "handoff" | null>(null);
  const [isCheckingAccount, setIsCheckingAccount] = useState(true);
  const [isAccountConnected, setIsAccountConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [displayEnvironment, setDisplayEnvironment] =
    useState<DisplayEnvironment>("unknown");
  const [embeddedBrowserLabel, setEmbeddedBrowserLabel] = useState(
    initialEmbeddedBrowserLabel,
  );
  const [isFromOnboarding, setIsFromOnboarding] = useState(
    initialIsFromOnboarding,
  );
  const [onboardingSource, setOnboardingSource] =
    useState<OnboardingSource>(initialOnboardingSource);
  const [onboardingCatName, setOnboardingCatName] = useState("");
  const [returnToPath, setReturnToPath] = useState(initialReturnToPath);
  const hasTrackedCtaView = useRef(false);
  const hasTrackedOnboardingPromptView = useRef(false);
  const hasTrackedCallbackError = useRef(false);

  const hasOnboardingCatName = onboardingCatName.trim().length > 0;
  const isStartingAuth = pendingAction !== null;
  const isStartingGoogle = pendingAction === "google";
  const isPreparingHandoff = pendingAction === "handoff";
  const isEmbeddedBrowser = embeddedBrowserLabel.length > 0;
  const onboardingAlbumTitle = hasOnboardingCatName
    ? `${onboardingCatName.trim()}のアルバムをつくる`
    : "うちのこのアルバムをつくる";
  const onboardingAlbumBody = hasOnboardingCatName
    ? `${onboardingCatName.trim()}のねがおと、届いたねこだよりを\nあとから見返せるようにします。`
    : "今日のねがおと、届いたねこだよりを\nあとから見返せるようにします。";

  function markOnboardingAlbumCompletionReady() {
    window.sessionStorage.setItem(ONBOARDING_ALBUM_COMPLETION_READY_KEY, "true");
  }

  function trackOnboardingAlbumCreatedVariant(method: string) {
    trackProductEvent(
      hasOnboardingCatName
        ? "album_created_with_name"
        : "album_created_without_name",
      {
        source: onboardingSource,
        method,
        surface: "onboarding",
      },
    );
  }

  const [handoffNext, setHandoffNext] = useState(initialHandoffNext);

  useEffect(() => {
    setDisplayEnvironment(getDisplayEnvironment());
    const embeddedBrowser = getEmbeddedBrowserInfo();
    setEmbeddedBrowserLabel(embeddedBrowser.label);
    const fromOnboarding =
      new URLSearchParams(window.location.search).get("from") === "onboarding";
    const searchParams = new URLSearchParams(window.location.search);
    const next = searchParams.get("next");
    const returnTo = normalizeInternalReturnPath(searchParams.get("returnTo"));
    const source = readOnboardingSourceFromLocation();
    let catName = "";

    if (fromOnboarding) {
      const activeProfile = getActiveCatProfile(
        readCatProfiles(),
        readActiveCatId(),
      );

      if (!isCatProfileNameUnset(activeProfile)) {
        catName = activeProfile.name.trim();
        setOnboardingCatName(catName);
      }
    }

    setIsFromOnboarding(fromOnboarding);
    setOnboardingSource(source);
    setHandoffNext(next === "second_photo" ? "second_photo" : "");
    setReturnToPath(returnTo);

    if (embeddedBrowser.isEmbedded) {
      trackProductEvent("inapp_browser_detected", {
        route: "/account/create",
        source,
        surface: "account_create",
        browser: embeddedBrowser.label,
      });
    }

    if (fromOnboarding && !hasTrackedOnboardingPromptView.current) {
      hasTrackedOnboardingPromptView.current = true;
      trackProductEvent("onboarding_album_create_prompt_view", {
        source,
      });
      trackProductEvent("onboarding_album_prompt_view", {
        source,
      });
      trackProductEvent(
        catName ? "album_prompt_view_with_name" : "album_prompt_view_without_name",
        {
          source,
          surface: "onboarding",
        },
      );
    }

    let isMounted = true;

    async function checkAccountConnection() {
      const supabase = createBrowserSupabaseClient();

      if (!supabase) {
        if (isMounted) {
          setIsCheckingAccount(false);
        }
        return;
      }

      const { data, error } = await supabase.auth.getUser();

      if (!isMounted) {
        return;
      }

      if (!error && data.user && !isAnonymousSupabaseUser(data.user)) {
        setIsAccountConnected(true);
        setConnectedEmail(data.user.email ?? "");
      }

      setIsCheckingAccount(false);
    }

    void checkAccountConnection();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (hasTrackedCtaView.current || isCheckingAccount || isAccountConnected) {
      return;
    }

    hasTrackedCtaView.current = true;
    trackProductEvent("account_create_cta_viewed", {
      route: "/account/create",
      trigger: "account_create_page",
    });
  }, [isAccountConnected, isCheckingAccount]);

  useEffect(() => {
    if (hasTrackedCallbackError.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("error") !== "auth") {
      return;
    }

    hasTrackedCallbackError.current = true;
    trackProductEvent("auth_google_failed", {
      error_type: "callback_failed",
    });
    setMessage(
      "Googleログインを完了できませんでした。少し時間をおいてもう一度お試しください。",
    );
  }, []);

  async function handleGoogleSignIn() {
    if (isEmbeddedBrowser) {
      const browserLabel = embeddedBrowserLabel || "このアプリ";
      trackProductEvent("auth_google_blocked_embedded_browser", {
        route: "/account/create",
        source: onboardingSource,
        surface: isFromOnboarding ? "onboarding" : "account_create",
        browser: browserLabel,
      });
      if (isFromOnboarding) {
        setMessage(
          `${browserLabel}の中からは、Googleのログインがひらけない決まりになっています。「つづきのリンクを作る」から、Safari/Chromeまたはホーム画面アプリでつづけられます。`,
        );
      } else {
        setMessage(
          `${browserLabel}の中からは、Googleのログインがひらけない決まりになっています。Safari/Chromeで開き直してからお試しください。`,
        );
      }
      return;
    }

    if (isFromOnboarding) {
      trackProductEvent("onboarding_google_continue_click", {
        source: onboardingSource,
        method: "oauth_redirect",
      });
    }

    const supabase = createBrowserSupabaseClient();

    if (!supabase) {
      setMessage("アカウント接続の準備がまだできていません。");
      return;
    }

    setPendingAction("google");
    setMessage("");
    const redirectTo = createAuthCallbackUrl({
      nextPath: isFromOnboarding
        ? `/account/create?from=onboarding&source=${encodeURIComponent(
            onboardingSource,
          )}`
        : returnToPath || "/home",
    });

    const { data: sessionData } = await supabase.auth.getSession();
    const shouldLinkIdentity =
      isAnonymousAuthEnabled() &&
      isAnonymousSupabaseUser(sessionData.session?.user);
    const method = shouldLinkIdentity ? "link_identity" : "oauth_redirect";
    window.localStorage.setItem(
      STORAGE_KEYS.authGooglePending,
      JSON.stringify({
        provider: "google",
        route: "/account/create",
        method,
        startedAt: new Date().toISOString(),
      }),
    );
    trackProductEvent("auth_google_started", {
      route: "/account/create",
      method,
    });

    const authWithLinkIdentity = supabase.auth as typeof supabase.auth & {
      linkIdentity?: typeof supabase.auth.signInWithOAuth;
    };
    const { error } =
      shouldLinkIdentity && typeof authWithLinkIdentity.linkIdentity === "function"
        ? await authWithLinkIdentity.linkIdentity({
            provider: "google",
            options: {
              redirectTo,
              queryParams: {
                prompt: "select_account",
              },
            },
          })
        : await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo,
              queryParams: {
                prompt: "select_account",
              },
            },
          });

    if (error) {
      if (shouldLinkIdentity) {
        const fallback = await startExistingGoogleFallback({
          supabase,
          redirectTo,
          reason: "link_identity_start_failed",
        });

        if (!fallback.error) {
          return;
        }
      }

      writeAuthDebugEvent("oauth_redirect_failed", {
        message: error.message,
      });
      trackProductEvent("auth_google_failed", {
        error_type: "oauth_redirect_failed",
        error_message: error.message,
      });
      window.localStorage.removeItem(STORAGE_KEYS.authGooglePending);
      setPendingAction(null);
      setMessage("Googleログインを開始できませんでした。少し時間をおいてもう一度お試しください。");
    }
  }

  async function startExistingGoogleFallback({
    supabase,
    redirectTo,
    reason,
  }: {
    supabase: NonNullable<ReturnType<typeof createBrowserSupabaseClient>>;
    redirectTo: string;
    reason: string;
  }) {
    const prepared = await prepareAnonymousStorageRefsForAccountSwitch();
    trackProductEvent("auth_google_link_fallback_started", {
      route: "/account/create",
      reason,
      had_error: Boolean(prepared.error),
      pending_storage_refs: prepared.pendingPaths,
    });
    window.localStorage.setItem(
      STORAGE_KEYS.authGooglePending,
      JSON.stringify({
        provider: "google",
        route: "/account/create",
        method: "oauth_redirect_existing_fallback",
        reason,
        startedAt: new Date().toISOString(),
      }),
    );
    await supabase.auth.signOut({ scope: "local" });
    return supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
  }

  async function handleLater() {
    if (isFromOnboarding) {
      trackProductEvent("onboarding_skip", {
        source: onboardingSource,
        state: "account_create",
      });
      trackProductEvent("onboarding_skip_click", {
        source: onboardingSource,
        state: "account_create",
      });

      setPendingAction("handoff");
      setMessage("");

      try {
        const handoff = await createOnboardingHandoff({
          source: onboardingSource,
          markCompleted: true,
        });

        markOnboardingAlbumCompletionReady();
        trackProductEvent("onboarding_album_created", {
          source: onboardingSource,
          method: "handoff",
        });
        trackProductEvent("cat_album_created", {
          source: onboardingSource,
          method: "handoff",
        });
        trackProductEvent("onboarding_completed", {
          source: onboardingSource,
          method: "handoff",
        });
        trackOnboardingAlbumCreatedVariant("handoff");
        const nextParam =
          handoffNext === "second_photo" ? "&next=second_photo" : "";
        const embeddedParam = isEmbeddedBrowser ? "&embedded=1" : "";
        router.push(
          `${handoff.continueUrl}${nextParam}&handoff_from=account${embeddedParam}`,
        );
      } catch {
        setPendingAction(null);
        setMessage(
          "つづきの準備ができませんでした。少し時間をおいて、もう一度お試しください。",
        );
      }

      return;
    }

    window.localStorage.setItem(
      ACCOUNT_CREATE_PROMPT_DISMISSED_KEY,
      JSON.stringify({
        dismissedAt: new Date().toISOString(),
        dismissedUntil: new Date(
          Date.now() + ACCOUNT_CREATE_PROMPT_DISMISSED_MS,
        ).toISOString(),
      }),
    );
    router.push(returnToPath || "/home");
  }

  return (
    <main style={styles.page} aria-busy={isCheckingAccount}>
      <div style={styles.container}>
        {isFromOnboarding ? <WordmarkHeader style={styles.wordmarkHeader} /> : null}
        <AppCard
          variant="section"
          padding="lg"
          style={{
            ...styles.card,
            ...(isFromOnboarding ? styles.onboardingCard : {}),
          }}
        >
          {isAccountConnected ? (
            <>
              <p style={styles.eyebrow}>アカウント</p>
              <h1 style={styles.title}>
                {isFromOnboarding
                  ? onboardingAlbumTitle
                  : "Googleアカウントにログイン中です"}
              </h1>
              <p style={styles.body}>
                {isFromOnboarding
                  ? onboardingAlbumBody
                  : "この端末のねがおを、アカウントに保存できます。別の端末でも復元できます。"}
              </p>
              {connectedEmail ? (
                <p style={styles.connectedEmail}>{connectedEmail}</p>
              ) : null}
              {!isFromOnboarding ? (
                <EnvironmentNotice environment={displayEnvironment} />
              ) : null}
              <div style={styles.actions}>
                {isFromOnboarding ? (
                  <AppButton
                    type="button"
                    onClick={() => {
                      markOnboardingAlbumCompletionReady();
                      markOnboardingAlbumCreated(onboardingSource);
                      trackProductEvent("onboarding_album_created", {
                        source: onboardingSource,
                        method: "already_connected",
                      });
                      trackProductEvent("cat_album_created", {
                        source: onboardingSource,
                        method: "already_connected",
                      });
                      trackProductEvent("onboarding_completed", {
                        source: onboardingSource,
                        method: "already_connected",
                      });
                      trackOnboardingAlbumCreatedVariant("already_connected");
                      router.push("/cats?onboarding=1");
                    }}
                    fullWidth
                  >
                    アルバムへ進む
                  </AppButton>
                ) : (
                  <AppButton
                    type="button"
                    onClick={() => {
                      router.push(returnToPath || "/home");
                    }}
                    variant="primary"
                    fullWidth
                  >
                    ホームへ戻る
                  </AppButton>
                )}
              </div>
            </>
          ) : (
            <>
              <p style={styles.eyebrow}>
                {isFromOnboarding ? "つづき" : "ねてるねこの保存"}
              </p>
              <h1 style={styles.title}>
                {isFromOnboarding
                  ? onboardingAlbumTitle
                  : "ねがおを、あとから見返せるように"}
              </h1>
              <p style={styles.body}>
                {isFromOnboarding
                  ? onboardingAlbumBody
                  : "Googleアカウントで接続すると、この端末のねがおを保存できます。別の端末でも、とったねがおやとどいたねがおを復元できます。"}
              </p>
              {!isFromOnboarding ? (
                <div style={styles.valueList} aria-label="保存できるもの">
                  {[
                    "とったねがお",
                    "とどいたねがお",
                    "猫のプロフィール",
                    "写真と記録",
                  ].map((item) => (
                    <div key={item} style={styles.valueItem}>
                      <span style={styles.valueDot} aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {!isFromOnboarding ? (
                <EnvironmentNotice environment={displayEnvironment} />
              ) : null}

              {message ? (
                <p style={styles.message} role="status">
                  {message}
                </p>
              ) : null}
              {!isFromOnboarding || isEmbeddedBrowser ? (
                <p style={styles.authNote}>
                  {isEmbeddedBrowser
                    ? isFromOnboarding
                      ? `${embeddedBrowserLabel}ではGoogleを開けません。つづきのリンクを作り、SafariかChromeで開いてください。`
                      : `${embeddedBrowserLabel}の中からはGoogleを開けません。SafariかChromeで開き直してください。`
                    : "Googleの画面が開きます。うまくいかない場合は、SafariかChromeで開き直してください。"}
                </p>
              ) : null}

              <div style={styles.actions}>
                {isFromOnboarding ? (
                  <>
                    {!isEmbeddedBrowser ? (
                      <AppButton
                        type="button"
                        data-testid="account-create-google"
                        onClick={() => {
                          void handleGoogleSignIn();
                        }}
                        variant="accent"
                        fullWidth
                        disabled={isStartingAuth || isCheckingAccount}
                      >
                        {isCheckingAccount
                          ? "準備しています…"
                          : isStartingGoogle
                            ? "Googleを開いています..."
                            : "Googleでつづける"}
                      </AppButton>
                    ) : null}
                    <AppButton
                      type="button"
                      data-testid="account-create-handoff"
                      variant={isEmbeddedBrowser ? "accent" : "quiet"}
                      size="md"
                      onClick={handleLater}
                      fullWidth
                      disabled={isStartingAuth || isCheckingAccount}
                    >
                      {isCheckingAccount
                        ? "準備しています…"
                        : isPreparingHandoff
                          ? "リンクを作っています..."
                          : "つづきのリンクを作る"}
                    </AppButton>
                  </>
                ) : (
                  <>
                    <AppButton
                      type="button"
                      data-testid="account-create-google"
                      onClick={() => {
                        void handleGoogleSignIn();
                      }}
                      variant="primary"
                      fullWidth
                      disabled={isStartingAuth || isCheckingAccount}
                    >
                      {isCheckingAccount
                        ? "準備しています…"
                        : isStartingGoogle
                          ? "Googleを開いています..."
                          : "Googleで続ける"}
                    </AppButton>
                    <AppButton
                      type="button"
                      data-testid="account-create-handoff"
                      onClick={handleLater}
                      variant="quiet"
                      size="md"
                      fullWidth
                    >
                      あとで
                    </AppButton>
                  </>
                )}
              </div>
            </>
          )}
        </AppCard>
      </div>
    </main>
  );
}

function createAuthCallbackUrl({ nextPath }: { nextPath: string }) {
  const origin =
    typeof window === "undefined" ? "" : window.location.origin;
  const callbackUrl = new URL("/auth/callback", origin);

  callbackUrl.searchParams.set("next", nextPath);
  return callbackUrl.toString();
}

function normalizeInternalReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "";
  }

  try {
    const parsed = new URL(value, "https://neteruneko.local");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "";
  }
}

function readSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const value = searchParams[key];
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function readInitialOnboardingSource(
  searchParams: Record<string, string | string[] | undefined>,
) {
  if (
    readSearchParam(searchParams, "ref") ||
    readSearchParam(searchParams, "referral") ||
    readSearchParam(searchParams, "invite")
  ) {
    return "referral" satisfies OnboardingSource;
  }

  return normalizeOnboardingSource(
    readSearchParam(searchParams, "src") ??
      readSearchParam(searchParams, "source") ??
      readSearchParam(searchParams, "utm_source"),
  );
}

function EnvironmentNotice({
  environment,
}: {
  environment: DisplayEnvironment;
}) {
  const isStandalone = environment === "standalone";

  return (
    <div style={isStandalone ? styles.environmentNote : styles.environmentWarning}>
      <p style={styles.environmentTitle}>
        {getDisplayEnvironmentLabel(environment)}で開いています
      </p>
      <p style={styles.environmentText}>
        {isStandalone
          ? "この中の写真と記録をアカウントに保存できます。"
          : "ホーム画面アプリで撮った写真を保存したい場合は、ホーム画面のねてるねこから開いてください。"}
      </p>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: APP_PAGE_BACKGROUND,
    backgroundSize: "var(--app-paper-background-size)",
    backgroundPosition: "var(--app-paper-background-position)",
    backgroundRepeat: "var(--app-paper-background-repeat)",
    color: "#2a2a28",
    fontFamily: "var(--font-ui)",
  },
  container: {
    width: "min(100%, 430px)",
    margin: "0 auto",
    padding: "28px 16px 120px",
    boxSizing: "border-box",
  },
  wordmarkHeader: {
    marginBottom: "18px",
    paddingTop: "calc(10px + env(safe-area-inset-top))",
  },
  card: {
    padding: "24px 20px 22px",
    background: "rgba(255,253,248,0.62)",
  },
  onboardingCard: {
    padding: "18px 4px 22px",
    border: "none",
    borderRadius: 0,
    background: "transparent",
    boxShadow: "none",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: APP_ACCENT,
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  title: {
    margin: "0 0 12px",
    color: "#2a2a28",
    fontSize: "20px",
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: "0.02em",
  },
  body: {
    margin: "0 0 20px",
    color: "#6a6a62",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.9,
    letterSpacing: 0,
    whiteSpace: "pre-line",
  },
  valueList: {
    display: "grid",
    gap: 0,
    margin: "0 0 18px",
    borderTop: "1px solid rgba(120,108,94,0.12)",
  },
  valueItem: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    minHeight: "40px",
    borderBottom: "1px solid rgba(120,108,94,0.12)",
    color: "#3f433d",
    fontSize: "13px",
    fontWeight: 500,
    padding: "0 2px",
  },
  valueDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: APP_ACCENT,
    flexShrink: 0,
  },
  environmentNote: {
    margin: "0 0 16px",
    border: "1px solid rgba(169,149,126,0.26)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.62)",
    padding: "12px",
  },
  environmentWarning: {
    margin: "0 0 16px",
    border: "1px solid rgba(216,151,88,0.35)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,246,234,0.82)",
    padding: "12px",
  },
  environmentTitle: {
    margin: "0 0 4px",
    color: "#2a2a28",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
  environmentText: {
    margin: 0,
    color: "#7d766e",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.75,
  },
  message: {
    margin: "0 0 14px",
    border: "1px solid rgba(120,108,94,0.12)",
    borderRadius: "var(--radius-lg)",
    background: "rgba(255,253,248,0.68)",
    color: "#746a5f",
    fontSize: "13px",
    fontWeight: 500,
    lineHeight: 1.75,
    padding: "11px 12px",
    boxShadow: "0 4px 12px rgba(90,76,60,0.025)",
  },
  authNote: {
    margin: "2px 0 16px",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.75,
  },
  connectedEmail: {
    margin: "0 0 18px",
    color: "#8a8a80",
    fontSize: "12px",
    fontWeight: 500,
    lineHeight: 1.5,
    wordBreak: "break-all",
  },
  actions: {
    display: "grid",
    gap: "9px",
  },
} satisfies Record<string, CSSProperties>;

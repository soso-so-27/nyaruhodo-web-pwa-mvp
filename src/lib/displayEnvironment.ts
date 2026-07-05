export type DisplayEnvironment = "standalone" | "browser" | "unknown";

export type EmbeddedBrowserInfo = {
  isEmbedded: boolean;
  label: string;
};

export function getDisplayEnvironment(): DisplayEnvironment {
  if (typeof window === "undefined") {
    return "unknown";
  }

  try {
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };

    if (
      window.matchMedia?.("(display-mode: standalone)").matches ||
      navigatorWithStandalone.standalone
    ) {
      return "standalone";
    }

    return "browser";
  } catch {
    return "unknown";
  }
}

export function getDisplayEnvironmentLabel(environment: DisplayEnvironment) {
  if (environment === "standalone") {
    return "ホーム画面アプリ";
  }

  if (environment === "browser") {
    return "Safari / Web";
  }

  return "確認中";
}

export function getEmbeddedBrowserInfo(): EmbeddedBrowserInfo {
  if (typeof window === "undefined") {
    return { isEmbedded: false, label: "" };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  if (userAgent.includes("line/") || userAgent.includes(" line")) {
    return { isEmbedded: true, label: "LINE" };
  }

  if (userAgent.includes("instagram")) {
    return { isEmbedded: true, label: "Instagram" };
  }

  if (userAgent.includes("fbav") || userAgent.includes("fban")) {
    return { isEmbedded: true, label: "Facebook" };
  }

  if (userAgent.includes("micromessenger")) {
    return { isEmbedded: true, label: "WeChat" };
  }

  if (userAgent.includes("twitter") || userAgent.includes("x-twitter")) {
    return { isEmbedded: true, label: "X" };
  }

  if (userAgent.includes("tiktok")) {
    return { isEmbedded: true, label: "TikTok" };
  }

  return { isEmbedded: false, label: "" };
}

export function isEmbeddedInAppBrowser() {
  return getEmbeddedBrowserInfo().isEmbedded;
}

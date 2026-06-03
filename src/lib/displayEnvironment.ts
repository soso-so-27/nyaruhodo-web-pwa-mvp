export type DisplayEnvironment = "standalone" | "browser" | "unknown";

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

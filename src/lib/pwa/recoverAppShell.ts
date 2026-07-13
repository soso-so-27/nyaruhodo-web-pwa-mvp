const APP_SHELL_CACHE_PREFIXES = [
  "neteruneko-static-",
  "neteruneko-runtime-",
] as const;
const AUTO_RECOVERY_KEY = "neteruneko_app_shell_auto_recovery";
const AUTO_RECOVERY_COOLDOWN_MS = 60_000;

export function isAppShellResourceError(error: Error) {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|CSS_CHUNK_LOAD_FAILED/i.test(
    `${error.name} ${error.message}`,
  );
}

export function recordAppRouteError(error: Error & { digest?: string }) {
  try {
    window.sessionStorage.setItem(
      "neteruneko_last_app_route_error",
      JSON.stringify({
        name: error.name,
        message: error.message.slice(0, 500),
        digest: error.digest ?? null,
        path: window.location.pathname,
        recordedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Diagnostics must not interfere with recovery.
  }
}

export async function recoverAppShell({ automatic = false } = {}) {
  if (automatic && !claimAutomaticRecovery()) {
    return false;
  }

  try {
    if ("caches" in window) {
      const names = await window.caches.keys();
      await Promise.all(
        names
          .filter((name) =>
            APP_SHELL_CACHE_PREFIXES.some((prefix) => name.startsWith(prefix)),
          )
          .map((name) => window.caches.delete(name)),
      );
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) =>
          registration.update().catch(() => undefined),
        ),
      );
    }
  } finally {
    window.location.reload();
  }

  return true;
}

function claimAutomaticRecovery() {
  try {
    const now = Date.now();
    const raw = window.sessionStorage.getItem(AUTO_RECOVERY_KEY);
    const previous = raw
      ? (JSON.parse(raw) as { path?: unknown; attemptedAt?: unknown })
      : null;

    if (
      previous?.path === window.location.pathname &&
      typeof previous.attemptedAt === "number" &&
      now - previous.attemptedAt < AUTO_RECOVERY_COOLDOWN_MS
    ) {
      return false;
    }

    window.sessionStorage.setItem(
      AUTO_RECOVERY_KEY,
      JSON.stringify({ path: window.location.pathname, attemptedAt: now }),
    );
    return true;
  } catch {
    return true;
  }
}

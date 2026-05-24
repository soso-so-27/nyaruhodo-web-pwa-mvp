import { STORAGE_KEYS } from "../storage";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_QUEUE_SIZE = 200;

type AnalyticsSession = {
  id: string;
  lastSeenAt: number;
};

export type ProductAnalyticsEvent = {
  name: string;
  occurred_at: string;
  anonymous_id: string;
  session_id: string;
  user_id?: string | null;
  local_cat_id?: string | null;
  route?: string;
  referrer?: string | null;
  source?: "sns" | "direct" | "pwa" | "unknown";
  properties?: Record<string, unknown>;
};

export function trackProductEvent(
  name: string,
  properties: Record<string, unknown> = {},
  options: {
    localCatId?: string | null;
    userId?: string | null;
  } = {},
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const event: ProductAnalyticsEvent = {
      name,
      occurred_at: new Date().toISOString(),
      anonymous_id: getOrCreateAnonymousId(),
      session_id: getOrCreateSessionId(),
      user_id: options.userId ?? null,
      local_cat_id: options.localCatId ?? null,
      route: window.location.pathname,
      referrer: document.referrer || null,
      source: getTrafficSource(),
      properties,
    };

    const queue = readAnalyticsEventQueue();
    const nextQueue = [...queue, event].slice(-MAX_QUEUE_SIZE);
    window.localStorage.setItem(
      STORAGE_KEYS.analyticsEventQueue,
      JSON.stringify(nextQueue),
    );
  } catch {
    // Analytics must never block the MVP experience.
  }
}

export function readAnalyticsEventQueue(): ProductAnalyticsEvent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.analyticsEventQueue);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getOrCreateAnonymousId() {
  const existing = window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId);
  if (existing) {
    return existing;
  }

  const nextId = createId();
  window.localStorage.setItem(STORAGE_KEYS.analyticsAnonymousId, nextId);
  return nextId;
}

function getOrCreateSessionId() {
  const now = Date.now();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.analyticsSession);
    const session = raw ? (JSON.parse(raw) as Partial<AnalyticsSession>) : null;
    if (
      session?.id &&
      typeof session.lastSeenAt === "number" &&
      now - session.lastSeenAt < SESSION_TIMEOUT_MS
    ) {
      const nextSession: AnalyticsSession = {
        id: session.id,
        lastSeenAt: now,
      };
      window.localStorage.setItem(
        STORAGE_KEYS.analyticsSession,
        JSON.stringify(nextSession),
      );
      return nextSession.id;
    }
  } catch {
    // Fall through and create a new session.
  }

  const nextSession: AnalyticsSession = {
    id: createId(),
    lastSeenAt: now,
  };
  window.localStorage.setItem(
    STORAGE_KEYS.analyticsSession,
    JSON.stringify(nextSession),
  );
  return nextSession.id;
}

function getTrafficSource(): ProductAnalyticsEvent["source"] {
  const params = new URLSearchParams(window.location.search);
  const source = params.get("source") || params.get("utm_source");
  if (source) {
    return source === "sns" ? "sns" : "unknown";
  }

  if (window.matchMedia?.("(display-mode: standalone)").matches) {
    return "pwa";
  }

  return document.referrer ? "unknown" : "direct";
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

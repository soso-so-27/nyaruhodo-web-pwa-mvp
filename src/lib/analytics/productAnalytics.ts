import { STORAGE_KEYS } from "../storage";
import { createBrowserSupabaseClient } from "../supabase/browser";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_QUEUE_SIZE = 200;
const FLUSH_BATCH_SIZE = 25;
const SOCIAL_SOURCE_VALUES = new Set([
  "sns",
  "instagram",
  "ig",
  "threads",
  "x",
  "twitter",
  "tiktok",
  "line",
]);
const ATTRIBUTION_PROPERTY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "campaign",
] as const;

let isFlushingAnalytics = false;

type AnalyticsSession = {
  id: string;
  lastSeenAt: number;
};

export type ProductAnalyticsEvent = {
  id?: string;
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
      id: createId(),
      name,
      occurred_at: new Date().toISOString(),
      anonymous_id: getOrCreateAnonymousId(),
      session_id: getOrCreateSessionId(),
      user_id: options.userId ?? null,
      local_cat_id: options.localCatId ?? null,
      route: window.location.pathname,
      referrer: document.referrer || null,
      source: getTrafficSource(),
      properties: {
        ...getAttributionProperties(),
        ...properties,
      },
    };

    const queue = readAnalyticsEventQueue();
    const nextQueue = [...queue, event].slice(-MAX_QUEUE_SIZE);
    window.localStorage.setItem(
      STORAGE_KEYS.analyticsEventQueue,
      JSON.stringify(nextQueue),
    );

    void flushProductAnalyticsEvents();
  } catch {
    // Analytics must never block the MVP experience.
  }
}

export async function flushProductAnalyticsEvents() {
  if (typeof window === "undefined" || isFlushingAnalytics) {
    return;
  }

  const supabase = createBrowserSupabaseClient();

  if (!supabase) {
    return;
  }

  const queue = readAnalyticsEventQueue();

  if (queue.length === 0) {
    return;
  }

  const batch = queue.slice(0, FLUSH_BATCH_SIZE);

  try {
    isFlushingAnalytics = true;

    const { error } = await supabase
      .from("product_analytics_events")
      .insert(batch.map(toAnalyticsRow));

    if (error) {
      return;
    }

    const currentQueue = readAnalyticsEventQueue();
    window.localStorage.setItem(
      STORAGE_KEYS.analyticsEventQueue,
      JSON.stringify(currentQueue.slice(batch.length)),
    );
  } catch {
    // Keep the local queue and retry later.
  } finally {
    isFlushingAnalytics = false;
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
    return SOCIAL_SOURCE_VALUES.has(source.toLowerCase()) ? "sns" : "unknown";
  }

  if (window.matchMedia?.("(display-mode: standalone)").matches) {
    return "pwa";
  }

  return document.referrer ? "unknown" : "direct";
}

function getAttributionProperties() {
  const params = new URLSearchParams(window.location.search);
  const properties: Record<string, string> = {};

  const sourceParam = params.get("source");
  if (sourceParam) {
    properties.source_param = sourceParam.slice(0, 160);
  }

  for (const key of ATTRIBUTION_PROPERTY_KEYS) {
    const value = params.get(key);
    if (value) {
      properties[key] = value.slice(0, 160);
    }
  }

  return properties;
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toAnalyticsRow(event: ProductAnalyticsEvent) {
  return {
    id: event.id ?? createId(),
    name: event.name,
    occurred_at: event.occurred_at,
    anonymous_id: event.anonymous_id,
    session_id: event.session_id,
    user_id: event.user_id ?? null,
    local_cat_id: event.local_cat_id ?? null,
    route: event.route ?? null,
    referrer: event.referrer ?? null,
    source: event.source ?? "unknown",
    properties: sanitizeProperties(event.properties ?? {}),
  };
}

function sanitizeProperties(properties: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (typeof value === "string" && value.length > 160) {
      sanitized[key] = value.slice(0, 160);
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

import { STORAGE_KEYS, readCachedJson, writeCachedJson } from "../storage";
import { getOrCreateAnonymousId } from "../identity/anonymousId";
import { createBrowserSupabaseClient } from "../supabase/browser";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_QUEUE_SIZE = 200;
const FLUSH_BATCH_SIZE = 25;
const SOCIAL_SOURCE_VALUES = new Set([
  "sns",
  "instagram",
  "instagram_story",
  "instagram_bio",
  "instagram_dm",
  "ig",
  "threads",
  "x",
  "twitter",
  "tiktok",
  "line",
  "referral",
]);
const ATTRIBUTION_PROPERTY_KEYS = [
  "src",
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

type AppEventSource =
  | "instagram"
  | "instagram_story"
  | "instagram_bio"
  | "instagram_dm"
  | "referral"
  | "direct"
  | "unknown";

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
    const propertiesForStorage = sanitizeProperties({
      ...getAttributionProperties(),
      ...properties,
    });
    const event: ProductAnalyticsEvent = {
      id: createId(),
      name,
      occurred_at: new Date().toISOString(),
      anonymous_id: getOrCreateAnonymousId(),
      session_id: getOrCreateSessionId(),
      user_id: options.userId ?? null,
      local_cat_id: options.localCatId ?? null,
      route: window.location.pathname,
      referrer: sanitizeReferrer(document.referrer),
      source: getTrafficSource(),
      properties: propertiesForStorage,
    };

    const queue = readAnalyticsEventQueue();
    const nextQueue = [...queue, event].slice(-MAX_QUEUE_SIZE);
    writeCachedJson(STORAGE_KEYS.analyticsEventQueue, nextQueue);

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

    await supabase.from("app_events").insert(batch.map(toAppEventRow));

    const currentQueue = readAnalyticsEventQueue();
    writeCachedJson(
      STORAGE_KEYS.analyticsEventQueue,
      currentQueue.slice(batch.length),
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
    const parsed = readCachedJson<unknown>(STORAGE_KEYS.analyticsEventQueue);
    return Array.isArray(parsed)
      ? parsed
          .map(sanitizeQueuedAnalyticsEvent)
          .filter((event): event is ProductAnalyticsEvent => Boolean(event))
      : [];
  } catch {
    return [];
  }
}

function sanitizeQueuedAnalyticsEvent(
  value: unknown,
): ProductAnalyticsEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const event = value as Partial<ProductAnalyticsEvent>;

  if (
    typeof event.name !== "string" ||
    typeof event.occurred_at !== "string" ||
    typeof event.anonymous_id !== "string" ||
    typeof event.session_id !== "string"
  ) {
    return null;
  }

  return {
    id: typeof event.id === "string" ? event.id : undefined,
    name: event.name,
    occurred_at: event.occurred_at,
    anonymous_id: event.anonymous_id,
    session_id: event.session_id,
    user_id: typeof event.user_id === "string" ? event.user_id : null,
    local_cat_id:
      typeof event.local_cat_id === "string" ? event.local_cat_id : null,
    route: typeof event.route === "string" ? event.route.slice(0, 160) : undefined,
    referrer:
      typeof event.referrer === "string"
        ? sanitizeReferrer(event.referrer)
        : null,
    source: isProductAnalyticsSource(event.source) ? event.source : "unknown",
    properties: sanitizeProperties(event.properties ?? {}),
  };
}

function isProductAnalyticsSource(
  value: unknown,
): value is ProductAnalyticsEvent["source"] {
  return (
    value === "sns" ||
    value === "direct" ||
    value === "pwa" ||
    value === "unknown"
  );
}

function getOrCreateSessionId() {
  const now = Date.now();

  try {
    const session =
      readCachedJson<Partial<AnalyticsSession>>(STORAGE_KEYS.analyticsSession);
    if (
      session?.id &&
      typeof session.lastSeenAt === "number" &&
      now - session.lastSeenAt < SESSION_TIMEOUT_MS
    ) {
      const nextSession: AnalyticsSession = {
        id: session.id,
        lastSeenAt: now,
      };
      writeCachedJson(STORAGE_KEYS.analyticsSession, nextSession);
      return nextSession.id;
    }
  } catch {
    // Fall through and create a new session.
  }

  const nextSession: AnalyticsSession = {
    id: createId(),
    lastSeenAt: now,
  };
  writeCachedJson(STORAGE_KEYS.analyticsSession, nextSession);
  return nextSession.id;
}

function getTrafficSource(): ProductAnalyticsEvent["source"] {
  const source = readAttributionSource().raw;
  if (source) {
    return SOCIAL_SOURCE_VALUES.has(source.trim().toLowerCase()) ? "sns" : "unknown";
  }

  if (window.matchMedia?.("(display-mode: standalone)").matches) {
    return "pwa";
  }

  return document.referrer ? "unknown" : "direct";
}

function getAppEventSource(): AppEventSource {
  return readAttributionSource().normalized;
}

function normalizeAppEventSource(source: string | null | undefined): AppEventSource {
  const normalized = source?.trim().toLowerCase();

  if (
    normalized === "instagram" ||
    normalized === "instagram_story" ||
    normalized === "instagram_bio" ||
    normalized === "instagram_dm" ||
    normalized === "referral"
  ) {
    return normalized;
  }

  if (normalized === "ig") {
    return "instagram";
  }

  if (normalized === "direct") {
    return "direct";
  }

  if (normalized === "unknown") {
    return "unknown";
  }

  if (!normalized) {
    return "direct";
  }

  return "unknown";
}

function getAttributionProperties() {
  const params = new URLSearchParams(window.location.search);
  const properties: Record<string, string> = {};
  const attribution = readAttributionSource();

  properties.source = attribution.normalized;

  if (attribution.raw) {
    properties.source_param = attribution.raw.slice(0, 160);
  }

  for (const key of ATTRIBUTION_PROPERTY_KEYS) {
    const value = params.get(key);
    if (value) {
      properties[key] = value.slice(0, 160);
    }
  }

  return properties;
}

function readAttributionSource(): {
  raw: string | null;
  normalized: AppEventSource;
} {
  const params = new URLSearchParams(window.location.search);
  if (params.has("ref") || params.has("referral") || params.has("invite")) {
    try {
      window.sessionStorage.setItem(STORAGE_KEYS.onboardingSource, "referral");
    } catch {
      // Attribution persistence is best-effort.
    }
    return { raw: "referral", normalized: "referral" };
  }

  const raw =
    params.get("src") ?? params.get("source") ?? params.get("utm_source");

  if (raw) {
    const normalized = normalizeAppEventSource(raw);
    try {
      window.sessionStorage.setItem(STORAGE_KEYS.onboardingSource, normalized);
    } catch {
      // Attribution persistence is best-effort.
    }
    return { raw, normalized };
  }

  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEYS.onboardingSource);
    if (stored) {
      return { raw: null, normalized: normalizeAppEventSource(stored) };
    }
  } catch {
    // Fall through.
  }

  return { raw: null, normalized: "direct" };
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

function toAppEventRow(event: ProductAnalyticsEvent) {
  const metadata = sanitizeProperties(event.properties ?? {});
  const source = getAnalyticsSource(metadata);

  return {
    id: event.id ?? createId(),
    event_name: event.name,
    source,
    anonymous_id: event.anonymous_id,
    user_id: event.user_id ?? null,
    session_id: event.session_id,
    submission_id: getString(metadata.submission_id),
    cat_id:
      getString(metadata.cat_id) ??
      getString(metadata.catId) ??
      event.local_cat_id ??
      null,
    photo_id: getString(metadata.photo_id),
    delivery_photo_id:
      getString(metadata.delivery_photo_id) ?? getString(metadata.source_photo_id),
    route: event.route ?? null,
    surface: getString(metadata.surface),
    is_in_app_browser: isInAppBrowser(),
    is_standalone_pwa: isStandalonePwa(),
    error_code: getString(metadata.error_code) ?? getString(metadata.error_type),
    error_message: sanitizeErrorMessage(getString(metadata.error_message)),
    metadata,
    created_at: event.occurred_at,
  };
}

function getAnalyticsSource(metadata: Record<string, unknown>): AppEventSource {
  const sourceFromUrl = getAppEventSource();
  const metadataSource = getString(metadata.source);

  if (!metadataSource) {
    return sourceFromUrl;
  }

  const normalized = normalizeAppEventSource(metadataSource);
  const raw = metadataSource.trim().toLowerCase();

  if (
    normalized !== "unknown" ||
    raw === "unknown" ||
    raw === "instagram" ||
    raw === "instagram_story" ||
    raw === "instagram_bio" ||
    raw === "instagram_dm" ||
    raw === "referral" ||
    raw === "ig" ||
    raw === "direct"
  ) {
    return normalized;
  }

  return sourceFromUrl;
}

function sanitizeProperties(properties: Record<string, unknown>) {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (isUnsafeMetadataKey(key)) {
      continue;
    }

    const sanitizedValue = sanitizeMetadataValue(key, value);
    if (sanitizedValue === undefined) {
      continue;
    }

    sanitized[key] = sanitizedValue;
  }

  return sanitized;
}

function isUnsafeMetadataKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("email") ||
    normalized.includes("name") ||
    normalized.includes("url") ||
    normalized.includes("signed") ||
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("storage_path") ||
    normalized.includes("path")
  );
}

function sanitizeMetadataValue(key: string, value: unknown) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    const normalizedKey = key.trim().toLowerCase();
    if (normalizedKey === "error_message") {
      return sanitizeErrorMessage(value);
    }

    if (isUnsafeMetadataString(value)) {
      return undefined;
    }

    return value.slice(0, 160);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return undefined;
}

function isUnsafeMetadataString(value: string) {
  const normalized = value.trim().toLowerCase();

  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("storage:") ||
    normalized.startsWith("storage://") ||
    normalized.includes("/storage/v1/object/") ||
    normalized.includes("token=") ||
    normalized.includes("expires=") ||
    normalized.includes("signature=") ||
    normalized.includes("x-amz-signature=")
  );
}

function sanitizeReferrer(referrer: string) {
  if (!referrer || isUnsafeMetadataString(referrer)) {
    return null;
  }

  return referrer.slice(0, 160);
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : null;
}

function sanitizeErrorMessage(message: string | null) {
  if (!message) {
    return null;
  }

  return message
    .replace(/https?:\/\/\S+/g, "[url]")
    .replace(/storage:\/\/\S+/g, "[storage]")
    .replace(/storage:[^\s)]+/g, "[storage]")
    .replace(/([?&](?:token|signature|expires|expires_at|expiresAt)=)[^&\s]+/gi, "$1[redacted]")
    .slice(0, 160);
}

function isStandalonePwa() {
  try {
    const navigatorWithStandalone = window.navigator as Navigator & {
      standalone?: boolean;
    };

    return Boolean(
      window.matchMedia?.("(display-mode: standalone)").matches ||
        navigatorWithStandalone.standalone,
    );
  } catch {
    return false;
  }
}

function isInAppBrowser() {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return (
    userAgent.includes("instagram") ||
    userAgent.includes("fbav") ||
    userAgent.includes("fban") ||
    userAgent.includes("line/") ||
    userAgent.includes("micromessenger")
  );
}

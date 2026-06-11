export const EVENING_DELIVERY_TRACE_STORAGE_KEY =
  "neteruneko_admin_evening_delivery_trace";

export type EveningDeliveryTraceEntry = {
  id: string;
  checkedAt: string;
  gate:
    | "no_pending_day"
    | "missing_target_or_cat"
    | "already_pending"
    | "missing_photo"
    | "photo_not_data"
    | "legacy_photo_not_data"
    | "exchange_started"
    | "exchange_completed";
  dateKey: string;
  hasTodayEntry: boolean;
  hasPendingDay: boolean;
  hasDeliveredPhoto: boolean;
  isAfterDeliveryTime: boolean;
  activeCatIdPresent: boolean;
  targetOwnPhotoIdPresent: boolean;
  directOwnPhotoFound: boolean;
  targetPhotoFallbackUsed: boolean;
  legacyFallbackUsed: boolean;
  legacyFallbackReason?: string;
  selectedPhotoSource: "direct" | "targetPhoto" | "legacy" | "none";
  selectedPhotoSrcKind?: "data" | "storage" | "http" | "other" | "empty";
  exchangeCalled: boolean;
  exchangeStatus?: number | null;
  exchangePhotoReceived?: boolean;
};

export function recordEveningDeliveryTrace(
  entry: Omit<EveningDeliveryTraceEntry, "id" | "checkedAt">,
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const entries = readEveningDeliveryTrace();
    entries.unshift({
      ...entry,
      id: `trace-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      checkedAt: new Date().toISOString(),
    });
    window.localStorage.setItem(
      EVENING_DELIVERY_TRACE_STORAGE_KEY,
      JSON.stringify(entries.slice(0, 20)),
    );
  } catch {
    // Delivery must never depend on debug trace persistence.
  }
}

export function readEveningDeliveryTrace(): EveningDeliveryTraceEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(EVENING_DELIVERY_TRACE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter(isEveningDeliveryTraceEntry).slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

function isEveningDeliveryTraceEntry(
  value: unknown,
): value is EveningDeliveryTraceEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<EveningDeliveryTraceEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.checkedAt === "string" &&
    typeof entry.gate === "string" &&
    typeof entry.dateKey === "string" &&
    typeof entry.hasTodayEntry === "boolean" &&
    typeof entry.hasPendingDay === "boolean" &&
    typeof entry.hasDeliveredPhoto === "boolean" &&
    typeof entry.isAfterDeliveryTime === "boolean" &&
    typeof entry.activeCatIdPresent === "boolean" &&
    typeof entry.targetOwnPhotoIdPresent === "boolean" &&
    typeof entry.directOwnPhotoFound === "boolean" &&
    typeof entry.targetPhotoFallbackUsed === "boolean" &&
    typeof entry.legacyFallbackUsed === "boolean" &&
    typeof entry.selectedPhotoSource === "string" &&
    typeof entry.exchangeCalled === "boolean"
  );
}

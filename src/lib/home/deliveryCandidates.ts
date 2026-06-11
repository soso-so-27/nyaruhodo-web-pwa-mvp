import {
  readBlockedExchangePhotoIds,
  type DeliverableSleepingPhotoInput,
  type ExchangePhoto,
  type ExchangePhotoPoolItem,
  type OwnSleepingPhoto,
} from "./sleepingPhotos";
import { createBrowserSupabaseClient } from "../supabase/browser";
import { STORAGE_KEYS } from "../storage";

type RemoteStockResponse = {
  photo?: ExchangePhotoPoolItem | null;
};

type SleepingExchangeResponse = {
  photo?: ExchangePhoto | null;
  source?: "remote" | "none";
  diagnostics?: SleepingDeliveryDiagnostics;
  httpStatus?: number | null;
  error?: string | null;
};

const MAX_BLOCKED_PHOTO_IDS = 100;

export type SleepingDeliveryDiagnostics = {
  source: "remote" | "none" | "error";
  availableCount: number;
  candidateCount: number;
  excludedCount: number;
  unusableCount: number;
  blockedCount: number;
  adminStockCount: number;
  userSharedCount: number;
  hiddenCount: number;
  reportedCount: number;
  totalSharedRows?: number;
  blockedRows?: number;
  storageExcludedRows?: number;
  deliverableRows?: number;
  dataImageDeliverableRows?: number;
  httpDeliverableRows?: number;
  storageRows?: number;
  rlsReadable: boolean;
  lastError?: string | null;
  checkedAt: string;
};

export async function createSleepingExchange({
  ownPhoto,
  triggerLabel,
  theme,
  category,
  seed,
  recipientCatId,
  preferredSourcePhotoId,
}: DeliverableSleepingPhotoInput & {
  ownPhoto: OwnSleepingPhoto;
  preferredSourcePhotoId?: string | null;
}): Promise<SleepingExchangeResponse | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch("/api/sleeping-delivery/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ownPhoto: {
          id: ownPhoto.id,
          catId: ownPhoto.catId,
          ownerCatId: ownPhoto.ownerCatId,
          src: ownPhoto.src,
          createdAt: ownPhoto.createdAt,
          triggerLabel: ownPhoto.triggerLabel,
          theme: ownPhoto.theme,
        },
        triggerLabel,
        theme,
        category,
        seed,
        recipientCatId,
        anonymousId: getOrCreateAnonymousId(),
        blockedPhotoIds: readBlockedExchangePhotoIdList(),
        preferredSourcePhotoId,
      }),
    });

    if (!response.ok) {
      const error = await readExchangeError(response);
      return {
        photo: null,
        source: "none",
        httpStatus: response.status,
        error,
      };
    }

    const body = (await response.json()) as SleepingExchangeResponse;
    return { ...body, httpStatus: response.status };
  } catch (error) {
    return {
      photo: null,
      source: "none",
      httpStatus: null,
      error: formatFetchFailure(error),
    };
  }
}

async function readExchangeError(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

function formatFetchFailure(error: unknown) {
  const name = error instanceof Error ? error.name : "Error";
  const message = error instanceof Error ? error.message : "fetch_failed";
  const online =
    typeof navigator === "undefined" ? "unknown" : String(navigator.onLine);
  const visibility =
    typeof document === "undefined" ? "unknown" : document.visibilityState;

  return `${name}: ${message}; online:${online}; visibility:${visibility}`;
}

export async function saveRemoteDeliveryStockPhoto(src: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const supabase = createBrowserSupabaseClient();

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    const response = await fetch("/api/sleeping-delivery/stock", {
      method: "POST",
      headers,
      body: JSON.stringify({ src }),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as RemoteStockResponse;

    return result.photo ?? null;
  } catch {
    return null;
  }
}

export async function readSleepingDeliveryDiagnostics() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const headers = new Headers({ "Content-Type": "application/json" });
    const supabase = createBrowserSupabaseClient();

    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
      }
    }

    const response = await fetch("/api/sleeping-delivery/diagnostics", {
      method: "POST",
      headers,
      body: JSON.stringify({
        anonymousId: getOrCreateAnonymousId(),
        blockedPhotoIds: readBlockedExchangePhotoIdList(),
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SleepingDeliveryDiagnostics;
  } catch {
    return null;
  }
}

function getOrCreateAnonymousId() {
  const existing = window.localStorage.getItem(STORAGE_KEYS.analyticsAnonymousId);

  if (existing) {
    return existing;
  }

  const nextId =
    globalThis.crypto?.randomUUID?.() ??
    `anonymous-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  window.localStorage.setItem(STORAGE_KEYS.analyticsAnonymousId, nextId);
  return nextId;
}

function readBlockedExchangePhotoIdList() {
  return [...readBlockedExchangePhotoIds()].slice(0, MAX_BLOCKED_PHOTO_IDS);
}

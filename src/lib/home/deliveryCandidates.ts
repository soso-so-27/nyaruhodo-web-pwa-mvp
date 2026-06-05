import {
  readBlockedExchangePhotoIds,
  type DeliverableSleepingPhotoInput,
  type ExchangePhoto,
  type ExchangePhotoPoolItem,
  type OwnSleepingPhoto,
} from "./sleepingPhotos";
import { createBrowserSupabaseClient } from "../supabase/browser";
import { STORAGE_KEYS } from "../storage";

type RemoteCandidateResponse = {
  photo?: ExchangePhotoPoolItem | null;
  source?: "remote" | "none";
};

type RemoteStockResponse = {
  photo?: ExchangePhotoPoolItem | null;
};

type SleepingExchangeResponse = {
  photo?: ExchangePhoto | null;
  source?: "remote" | "none";
  diagnostics?: SleepingDeliveryDiagnostics;
};

type RemoteCandidateResult = {
  photo: ExchangePhotoPoolItem | null;
  source?: "remote" | "none";
};

export type SleepingDeliveryDiagnostics = {
  source: "remote" | "none" | "error";
  availableCount: number;
  candidateCount: number;
  excludedCount: number;
  blockedCount: number;
  adminStockCount: number;
  userSharedCount: number;
  hiddenCount: number;
  reportedCount: number;
  rlsReadable: boolean;
  lastError?: string | null;
  checkedAt: string;
};

export async function selectDeliveryCandidate(
  input: DeliverableSleepingPhotoInput,
): Promise<ExchangePhotoPoolItem | null> {
  const remotePhoto = await fetchRemoteDeliveryCandidate(input);

  if (remotePhoto?.source === "remote" && remotePhoto.photo) {
    return remotePhoto.photo;
  }

  return null;
}

export async function createSleepingExchange({
  ownPhoto,
  triggerLabel,
  theme,
  category,
  seed,
  recipientCatId,
}: DeliverableSleepingPhotoInput & {
  ownPhoto: OwnSleepingPhoto;
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
        blockedPhotoIds: [...readBlockedExchangePhotoIds()],
      }),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SleepingExchangeResponse;
  } catch {
    return null;
  }
}

export async function saveRemoteDeliveryStockPhoto(src: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch("/api/sleeping-delivery/stock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    const response = await fetch("/api/sleeping-delivery/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anonymousId: getOrCreateAnonymousId(),
        blockedPhotoIds: [...readBlockedExchangePhotoIds()],
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

async function fetchRemoteDeliveryCandidate(
  input: DeliverableSleepingPhotoInput,
): Promise<RemoteCandidateResult | null> {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase
      ? await supabase.auth.getUser()
      : { data: { user: null } };
    const response = await fetch("/api/sleeping-delivery/candidate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...input,
        excludeUserId: data.user?.id ?? null,
        blockedPhotoIds: [...readBlockedExchangePhotoIds()],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json()) as RemoteCandidateResponse;

    return {
      photo: result.photo ?? null,
      source: result.source,
    };
  } catch {
    return null;
  }
}

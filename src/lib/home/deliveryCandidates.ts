import {
  readBlockedExchangePhotoIds,
  selectDeliverableSleepingPhoto,
  type DeliverableSleepingPhotoInput,
  type ExchangePhotoPoolItem,
} from "./sleepingPhotos";
import { createBrowserSupabaseClient } from "../supabase/browser";

type RemoteCandidateResponse = {
  photo?: ExchangePhotoPoolItem | null;
  source?: "remote" | "seed";
};

type RemoteStockResponse = {
  photo?: ExchangePhotoPoolItem | null;
};

type RemoteCandidateResult = {
  photo: ExchangePhotoPoolItem | null;
  source?: "remote" | "seed";
};

export async function selectDeliveryCandidate(
  input: DeliverableSleepingPhotoInput,
): Promise<ExchangePhotoPoolItem | null> {
  const remotePhoto = await fetchRemoteDeliveryCandidate(input);

  if (remotePhoto?.source === "remote" && remotePhoto.photo) {
    return remotePhoto.photo;
  }

  return selectDeliverableSleepingPhoto(input).photo ?? remotePhoto?.photo ?? null;
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

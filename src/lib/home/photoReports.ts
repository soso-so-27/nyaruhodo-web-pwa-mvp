import { getOrCreateAnonymousId } from "../identity/anonymousId";
import { createBrowserSupabaseClient } from "../supabase/browser";
import type {
  ExchangePhoto,
  ExchangePhotoReportReason,
} from "./sleepingPhotos";

export async function sendPhotoReport(
  photo: ExchangePhoto,
  reason: ExchangePhotoReportReason,
) {
  const headers = new Headers({ "content-type": "application/json" });
  const supabase = createBrowserSupabaseClient();

  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;

    if (accessToken) {
      headers.set("authorization", `Bearer ${accessToken}`);
    }
  }

  const response = await fetch("/api/reports", {
    method: "POST",
    headers,
    body: JSON.stringify({
      photoId: photo.id,
      sourcePhotoId: photo.sourcePhotoId ?? null,
      anonymousId: getReportAnonymousId(),
      reason,
    }),
  });
  const result = (await response.json().catch(() => null)) as {
    ok?: unknown;
  } | null;

  if (!response.ok || result?.ok !== true) {
    throw new Error(`Photo report failed with ${response.status}`);
  }
}

function getReportAnonymousId() {
  try {
    return getOrCreateAnonymousId();
  } catch {
    return `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

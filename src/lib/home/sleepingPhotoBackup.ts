import { getOrCreateAnonymousId } from "../identity/anonymousId";
import { ensureAnonymousSession } from "../auth/anonymousAuth";
import { createBrowserSupabaseClient } from "../supabase/browser";
import type { OwnSleepingPhoto } from "./sleepingPhotos";

export async function backupOwnSleepingPhotoMoment(photo: OwnSleepingPhoto) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await ensureAnonymousSession("backup");
    const supabase = createBrowserSupabaseClient();
    const { data } = supabase
      ? await supabase.auth.getSession()
      : { data: { session: null } };
    const accessToken = data.session?.access_token;
    await fetch("/api/sleeping-delivery/backup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        anonymousId: getOrCreateAnonymousId(),
        photo,
      }),
    });
  } catch {
    // Remote backup must never block the local sleeping-photo flow.
  }
}

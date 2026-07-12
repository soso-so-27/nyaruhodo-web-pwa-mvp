import { getOrCreateAnonymousId } from "../identity/anonymousId";
import { ensureAnonymousSession } from "../auth/anonymousAuth";
import { trackProductEvent } from "../analytics/productAnalytics";
import { createBrowserSupabaseClient } from "../supabase/browser";
import type { OwnSleepingPhoto } from "./sleepingPhotos";

const BACKUP_TIMEOUT_MS = 15_000;
const BACKUP_RETRY_DELAYS_MS = [0, 1_500, 4_000] as const;

export type SleepingPhotoBackupResult = {
  ok: boolean;
  status: number | null;
  error: string | null;
};

export async function backupOwnSleepingPhotoMoment(photo: OwnSleepingPhoto) {
  if (typeof window === "undefined") {
    return { ok: false, status: null, error: "window_unavailable" };
  }

  await ensureAnonymousSession("backup").catch(() => null);
  const supabase = createBrowserSupabaseClient();
  const { data } = supabase
    ? await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
    : { data: { session: null } };
  const accessToken = data.session?.access_token;
  let lastResult: SleepingPhotoBackupResult = {
    ok: false,
    status: null,
    error: "backup_failed",
  };

  for (const delay of BACKUP_RETRY_DELAYS_MS) {
    if (delay > 0) {
      await wait(delay);
    }

    lastResult = await sendBackupRequest({ photo, accessToken });
    if (lastResult.ok || !shouldRetryBackup(lastResult)) {
      break;
    }
  }

  if (!lastResult.ok) {
    trackProductEvent("sleeping_photo_backup_failed", {
      error_code: lastResult.error,
      http_status: lastResult.status,
      shared: photo.shared ?? photo.visibility === "shared",
    });
  }

  return lastResult;
}

async function sendBackupRequest({
  photo,
  accessToken,
}: {
  photo: OwnSleepingPhoto;
  accessToken?: string;
}): Promise<SleepingPhotoBackupResult> {
  const abortController = new AbortController();
  const timeoutId = window.setTimeout(
    () => abortController.abort("backup_timeout"),
    BACKUP_TIMEOUT_MS,
  );

  try {
    const response = await fetch("/api/sleeping-delivery/backup", {
      method: "POST",
      signal: abortController.signal,
      headers: {
        "content-type": "application/json",
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        anonymousId: getOrCreateAnonymousId(),
        photo: {
          id: photo.id,
          ownerCatId: photo.ownerCatId,
          catId: photo.catId,
          src: photo.src,
          state: photo.state,
          visibility: photo.visibility,
          deliveryStatus: photo.deliveryStatus,
          triggerLabel: photo.triggerLabel,
          theme: photo.theme,
          shared: photo.shared,
          createdAt: photo.createdAt,
          captureContext: photo.captureContext,
          sourceMomentId: photo.sourceMomentId,
        },
      }),
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    return {
      ok: response.ok && body?.ok === true,
      status: response.status,
      error:
        response.ok && body?.ok === true
          ? null
          : body?.error ?? `backup_http_${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: abortController.signal.aborted
        ? "backup_timeout"
        : error instanceof Error
          ? error.name
          : "backup_fetch_failed",
    };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function shouldRetryBackup(result: SleepingPhotoBackupResult) {
  return result.status === null || result.status === 429 || result.status >= 500;
}

function wait(delay: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}

import type { OnboardingProgress } from "./progress";
import {
  type OnboardingServerStage,
  type OnboardingSubmissionAdvanceInput,
  type OnboardingSubmissionStatus,
} from "./submissionContract";

const submissionSyncQueues = new Map<string, Promise<boolean>>();
const SHADOW_SYNC_TIMEOUT_MS = 4_000;

export function isOnboardingServerLedgerEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_SERVER_LEDGER !== "false";
}

export function queueOnboardingSubmissionShadowSync(
  progress: OnboardingProgress,
) {
  if (!isOnboardingServerLedgerEnabled() || !progress.resumeToken) {
    return Promise.resolve(false);
  }

  const input = toAdvanceInput(progress);
  const previous = submissionSyncQueues.get(progress.submissionId) ?? Promise.resolve(true);
  const next = previous
    .catch(() => false)
    .then(() => advanceOnboardingSubmission(input))
    .finally(() => {
      if (submissionSyncQueues.get(progress.submissionId) === next) {
        submissionSyncQueues.delete(progress.submissionId);
      }
    });
  submissionSyncQueues.set(progress.submissionId, next);
  return next;
}

export async function readServerOnboardingSubmission({
  resumeToken,
  submissionId,
}: {
  resumeToken: string;
  submissionId: string;
}) {
  const response = await fetch("/api/onboarding/submission", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ resumeToken, submissionId }),
  });

  if (!response.ok) {
    return null;
  }

  const body = (await response.json().catch(() => null)) as
    | { ok?: boolean; submission?: OnboardingSubmissionStatus }
    | null;
  return body?.ok ? (body.submission ?? null) : null;
}

export function getOnboardingExchangeLedgerInput(
  progress: OnboardingProgress | null,
) {
  if (
    !isOnboardingServerLedgerEnabled() ||
    !progress?.resumeToken ||
    !progress.ownPhoto
  ) {
    return null;
  }

  return {
    dateKey: progress.dateKey,
    journeyId: progress.journeyId ?? null,
    resumeToken: progress.resumeToken,
    source: progress.source,
    submissionId: progress.submissionId,
  };
}

async function advanceOnboardingSubmission(input: OnboardingSubmissionAdvanceInput) {
  const abortController = new AbortController();
  const timeoutId = globalThis.setTimeout(
    () => abortController.abort("onboarding_ledger_timeout"),
    SHADOW_SYNC_TIMEOUT_MS,
  );

  try {
    const response = await fetch("/api/onboarding/submission", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      keepalive: true,
      signal: abortController.signal,
      body: JSON.stringify(input),
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function toAdvanceInput(
  progress: OnboardingProgress,
): OnboardingSubmissionAdvanceInput {
  return {
    anonymousId: progress.anonymousId,
    dateKey: progress.dateKey,
    deliveryId: progress.deliveredPhoto?.id ?? null,
    ...(progress.journeyId ? { journeyId: progress.journeyId } : {}),
    ownPhotoId: progress.ownPhoto?.id ?? null,
    resumeToken: progress.resumeToken!,
    source: progress.source,
    sourcePhotoId: progress.deliveredPhoto?.sourcePhotoId ?? null,
    stage: mapProgressStage(progress.stage),
    submissionId: progress.submissionId,
  };
}

function mapProgressStage(
  stage: OnboardingProgress["stage"],
): OnboardingServerStage {
  if (stage === "submitted") {
    return "submitted";
  }

  if (stage === "arrived") {
    return "delivered";
  }

  if (stage === "album_created") {
    return "completed";
  }

  return "opened";
}

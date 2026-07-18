import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getOnboardingServerStageRank,
  type OnboardingServerStage,
  type OnboardingSubmissionAdvanceInput,
  type OnboardingSubmissionStatus,
} from "../onboarding/submissionContract";

type OnboardingSubmissionRow = {
  anonymous_id: string | null;
  completed_at: string | null;
  created_at: string;
  date_key: string;
  delivery_id: string | null;
  own_photo_id: string | null;
  resume_token_hash: string;
  source: string;
  source_photo_id: string | null;
  stage: OnboardingServerStage;
  stage_updated_at: string;
  submission_id: string;
  updated_at: string;
  user_id: string | null;
};

type LedgerResult =
  | { ok: true; status: OnboardingSubmissionStatus }
  | {
      ok: false;
      error: "conflict" | "forbidden" | "not_found" | "store_failed";
      code?: string;
    };

const SUBMISSION_SELECT =
  "anonymous_id, completed_at, created_at, date_key, delivery_id, own_photo_id, resume_token_hash, source, source_photo_id, stage, stage_updated_at, submission_id, updated_at, user_id" as const;
const MAX_CONCURRENT_UPDATE_RETRIES = 3;

export async function advanceOnboardingSubmission({
  input,
  supabase,
  userId,
}: {
  input: OnboardingSubmissionAdvanceInput;
  supabase: SupabaseClient;
  userId: string | null;
}): Promise<LedgerResult> {
  const existingResult = await readSubmissionRow(supabase, input.submissionId);

  if (existingResult.error) {
    return {
      ok: false,
      error: "store_failed",
      code: existingResult.error.code,
    };
  }

  if (!existingResult.data) {
    return insertSubmission({ input, supabase, userId });
  }

  return updateSubmission({
    existing: existingResult.data,
    input,
    supabase,
    userId,
  });
}

export async function readOnboardingSubmission({
  resumeToken,
  submissionId,
  supabase,
}: {
  resumeToken: string;
  submissionId: string;
  supabase: SupabaseClient;
}): Promise<LedgerResult> {
  const result = await readSubmissionRow(supabase, submissionId);

  if (result.error) {
    return { ok: false, error: "store_failed", code: result.error.code };
  }

  if (!result.data || !resumeTokenMatches(result.data, resumeToken)) {
    return { ok: false, error: "not_found" };
  }

  return { ok: true, status: toSubmissionStatus(result.data) };
}

async function insertSubmission({
  input,
  supabase,
  userId,
}: {
  input: OnboardingSubmissionAdvanceInput;
  supabase: SupabaseClient;
  userId: string | null;
}): Promise<LedgerResult> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("onboarding_submissions")
    .insert({
      anonymous_id: input.anonymousId,
      completed_at: input.stage === "completed" ? now : null,
      date_key: input.dateKey,
      delivery_id: input.deliveryId ?? null,
      own_photo_id: input.ownPhotoId ?? null,
      resume_token_hash: hashResumeToken(input.resumeToken),
      source: input.source,
      source_photo_id: input.sourcePhotoId ?? null,
      stage: input.stage,
      stage_updated_at: now,
      submission_id: input.submissionId,
      user_id: userId,
    })
    .select(SUBMISSION_SELECT)
    .single();

  if (error?.code === "23505") {
    const raced = await readSubmissionRow(supabase, input.submissionId);
    if (raced.data) {
      return updateSubmission({
        existing: raced.data,
        input,
        supabase,
        userId,
      });
    }
  }

  if (error || !data) {
    return { ok: false, error: "store_failed", code: error?.code };
  }

  return {
    ok: true,
    status: toSubmissionStatus(data as OnboardingSubmissionRow),
  };
}

async function updateSubmission({
  attempt = 0,
  existing,
  input,
  supabase,
  userId,
}: {
  attempt?: number;
  existing: OnboardingSubmissionRow;
  input: OnboardingSubmissionAdvanceInput;
  supabase: SupabaseClient;
  userId: string | null;
}): Promise<LedgerResult> {
  if (!resumeTokenMatches(existing, input.resumeToken)) {
    return { ok: false, error: "forbidden" };
  }

  if (
    existing.date_key !== input.dateKey ||
    hasConflictingValue(existing.own_photo_id, input.ownPhotoId) ||
    hasConflictingValue(existing.delivery_id, input.deliveryId) ||
    hasConflictingValue(existing.source_photo_id, input.sourcePhotoId) ||
    (existing.user_id && userId && existing.user_id !== userId)
  ) {
    return { ok: false, error: "conflict" };
  }

  const shouldAdvance =
    getOnboardingServerStageRank(input.stage) >
    getOnboardingServerStageRank(existing.stage);
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    anonymous_id: input.anonymousId ?? existing.anonymous_id,
    delivery_id: existing.delivery_id ?? input.deliveryId ?? null,
    own_photo_id: existing.own_photo_id ?? input.ownPhotoId ?? null,
    source_photo_id: existing.source_photo_id ?? input.sourcePhotoId ?? null,
    user_id: existing.user_id ?? userId,
  };

  if (shouldAdvance) {
    updates.stage = input.stage;
    updates.stage_updated_at = now;
  }

  if (input.stage === "completed" && !existing.completed_at) {
    updates.completed_at = now;
  }

  const { data, error } = await supabase
    .from("onboarding_submissions")
    .update(updates)
    .eq("submission_id", input.submissionId)
    .eq("resume_token_hash", existing.resume_token_hash)
    .eq("updated_at", existing.updated_at)
    .select(SUBMISSION_SELECT)
    .maybeSingle();

  if (error) {
    return { ok: false, error: "store_failed", code: error?.code };
  }

  if (!data) {
    if (attempt >= MAX_CONCURRENT_UPDATE_RETRIES) {
      return { ok: false, error: "store_failed", code: "concurrent_update" };
    }

    const raced = await readSubmissionRow(supabase, input.submissionId);
    if (raced.error || !raced.data) {
      return {
        ok: false,
        error: "store_failed",
        code: raced.error?.code ?? "concurrent_update_missing",
      };
    }

    return updateSubmission({
      attempt: attempt + 1,
      existing: raced.data,
      input,
      supabase,
      userId,
    });
  }

  return {
    ok: true,
    status: toSubmissionStatus(data as OnboardingSubmissionRow),
  };
}

function readSubmissionRow(supabase: SupabaseClient, submissionId: string) {
  return supabase
    .from("onboarding_submissions")
    .select(SUBMISSION_SELECT)
    .eq("submission_id", submissionId)
    .maybeSingle<OnboardingSubmissionRow>();
}

function hashResumeToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function resumeTokenMatches(row: OnboardingSubmissionRow, token: string) {
  const expected = Buffer.from(row.resume_token_hash, "hex");
  const actual = Buffer.from(hashResumeToken(token), "hex");

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function hasConflictingValue(
  existing: string | null,
  incoming: string | null | undefined,
) {
  return Boolean(existing && incoming && existing !== incoming);
}

function toSubmissionStatus(
  row: OnboardingSubmissionRow,
): OnboardingSubmissionStatus {
  return {
    completedAt: row.completed_at,
    createdAt: row.created_at,
    dateKey: row.date_key,
    deliveryId: row.delivery_id,
    ownPhotoId: row.own_photo_id,
    source: row.source,
    sourcePhotoId: row.source_photo_id,
    stage: row.stage,
    stageUpdatedAt: row.stage_updated_at,
    submissionId: row.submission_id,
    updatedAt: row.updated_at,
  };
}

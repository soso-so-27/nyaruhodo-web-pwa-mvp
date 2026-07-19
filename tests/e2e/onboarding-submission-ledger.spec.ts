import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

import { createOnboardingResumeToken } from "../../src/lib/onboarding/submissionContract";
import { queueOnboardingSubmissionShadowSync } from "../../src/lib/onboarding/submissionClient";
import {
  createOnboardingJourneySubmissionId,
  createOnboardingOwnPhotoId,
} from "../../src/lib/onboarding/journeyContract";

const catPhotoDataUrl = `data:image/jpeg;base64,${fs
  .readFileSync(path.resolve(process.cwd(), "tests/fixtures/cat-photo-letter.jpg"))
  .toString("base64")}`;

test.describe("onboarding submission ledger", () => {
  test("rejects a submission ID that belongs to another onboarding journey", async ({
    request,
  }) => {
    const journeyId = `onbj_${crypto.randomUUID()}`;
    const dateKey = getJstDateKey();
    const response = await request.put("/api/onboarding/submission", {
      data: {
        anonymousId: `journey-binding-${crypto.randomUUID()}`,
        dateKey,
        journeyId,
        ownPhotoId: createOnboardingOwnPhotoId(
          createOnboardingJourneySubmissionId(journeyId, dateKey),
        ),
        resumeToken: createOnboardingResumeToken(),
        source: "instagram_bio",
        stage: "submitted",
        submissionId: createOnboardingJourneySubmissionId(
          `onbj_${crypto.randomUUID()}`,
          dateKey,
        ),
      },
    });

    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: "invalid_submission",
    });
  });

  test("shadows only compact progress metadata from the browser", async () => {
    const originalFlag = process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_SERVER_LEDGER;
    const originalFetch = globalThis.fetch;
    const requests: Array<Record<string, unknown>> = [];
    process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_SERVER_LEDGER = "true";
    globalThis.fetch = async (_input, init) => {
      requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    try {
      const resumeToken = createOnboardingResumeToken();
      await queueOnboardingSubmissionShadowSync({
        version: 1,
        anonymousId: "compact-anonymous",
        dateKey: "2026-07-18",
        stage: "arrived",
        source: "instagram_bio",
        submissionId: "onboarding:compact-anonymous:2026-07-18",
        resumeToken,
        ownPhoto: {
          id: "compact-own",
          catId: "compact-cat",
          ownerCatId: "compact-cat",
          src: catPhotoDataUrl,
          state: "sleeping",
          visibility: "shared",
          deliveryStatus: "available",
          triggerLabel: "sleeping",
          theme: "sleeping",
          shared: true,
          createdAt: Date.now(),
        },
        selectedPhotoSrc: catPhotoDataUrl,
        deliveredPhoto: {
          id: "compact-delivery",
          sourcePhotoId: "compact-source",
          src: catPhotoDataUrl,
          title: "delivered",
          subtitle: "",
          triggerLabel: "sleeping",
          theme: "sleeping",
          deliveredAt: Date.now(),
        },
        updatedAt: Date.now(),
      });

      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual({
        anonymousId: "compact-anonymous",
        dateKey: "2026-07-18",
        deliveryId: "compact-delivery",
        ownPhotoId: "compact-own",
        resumeToken,
        source: "instagram_bio",
        sourcePhotoId: "compact-source",
        stage: "delivered",
        submissionId: "onboarding:compact-anonymous:2026-07-18",
      });
      expect(JSON.stringify(requests[0])).not.toContain("data:image");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalFlag === undefined) {
        delete process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_SERVER_LEDGER;
      } else {
        process.env.NEXT_PUBLIC_ENABLE_ONBOARDING_SERVER_LEDGER = originalFlag;
      }
    }
  });

  test("keeps stage progression monotonic, idempotent, and token protected", async ({
    request,
  }) => {
    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "Local Supabase service role is required.");
    if (!adminSupabase) return;

    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const anonymousId = `ledger-anon-${stamp}`;
    const submissionId = `onboarding:${anonymousId}:${getJstDateKey()}`;
    const resumeToken = createOnboardingResumeToken();
    const base = {
      anonymousId,
      dateKey: getJstDateKey(),
      ownPhotoId: `ledger-own-${stamp}`,
      resumeToken,
      source: "instagram_story",
      submissionId,
    };

    try {
      const submitted = await request.put("/api/onboarding/submission", {
        data: { ...base, stage: "submitted" },
      });
      expect(submitted.status()).toBe(200);
      await expect(submitted.json()).resolves.toMatchObject({
        ok: true,
        submission: {
          deliveryId: null,
          ownPhotoId: base.ownPhotoId,
          stage: "submitted",
          submissionId,
        },
      });

      const deliveryId = `ledger-delivery-${stamp}`;
      const sourcePhotoId = `ledger-source-${stamp}`;
      const delivered = await request.put("/api/onboarding/submission", {
        data: {
          ...base,
          deliveryId,
          sourcePhotoId,
          stage: "delivered",
        },
      });
      expect(delivered.status()).toBe(200);

      const staleRetry = await request.put("/api/onboarding/submission", {
        data: { ...base, source: "direct", stage: "submitted" },
      });
      expect(staleRetry.status()).toBe(200);
      await expect(staleRetry.json()).resolves.toMatchObject({
        submission: {
          deliveryId,
          sourcePhotoId,
          source: "instagram_story",
          stage: "delivered",
        },
      });

      const status = await request.post("/api/onboarding/submission", {
        data: { resumeToken, submissionId },
      });
      expect(status.status()).toBe(200);
      await expect(status.json()).resolves.toMatchObject({
        submission: { deliveryId, stage: "delivered" },
      });

      const wrongToken = await request.post("/api/onboarding/submission", {
        data: {
          resumeToken: createOnboardingResumeToken(),
          submissionId,
        },
      });
      expect(wrongToken.status()).toBe(404);

      const conflict = await request.put("/api/onboarding/submission", {
        data: {
          ...base,
          deliveryId: `different-${deliveryId}`,
          stage: "opened",
        },
      });
      expect(conflict.status()).toBe(409);

      const { count, error } = await adminSupabase
        .from("onboarding_submissions")
        .select("id", { count: "exact", head: true })
        .eq("submission_id", submissionId);
      expect(error).toBeNull();
      expect(count).toBe(1);
    } finally {
      await adminSupabase
        .from("onboarding_submissions")
        .delete()
        .eq("submission_id", submissionId);
    }
  });

  test("records delivered on the server even before the client saves arrived progress", async ({
    request,
  }) => {
    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "Local Supabase service role is required.");
    if (!adminSupabase) return;

    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const anonymousId = `ledger-exchange-anon-${stamp}`;
    const candidateId = `stock-sleeping-ledger-${stamp}`;
    const ownPhotoId = `ledger-own-${stamp}`;
    const sourceAnonymousId = `ledger-source-anon-${stamp}`;
    const dateKey = getJstDateKey();
    const submissionId = `onboarding:${anonymousId}:${dateKey}`;
    const resumeToken = createOnboardingResumeToken();

    try {
      const { error: candidateError } = await adminSupabase
        .from("cat_moments")
        .insert({
          anonymous_id: sourceAnonymousId,
          local_moment_id: candidateId,
          local_cat_id: `candidate-cat-${stamp}`,
          owner_cat_id: `candidate-cat-${stamp}`,
          photo_url: catPhotoDataUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          moderated_at: new Date().toISOString(),
          moderated_by: "e2e",
          metadata: { source: "e2e", pool_kind: "admin_stock" },
          captured_at: new Date(Date.now() - 60_000).toISOString(),
          created_at: new Date(Date.now() - 60_000).toISOString(),
        });
      expect(candidateError).toBeNull();

      const exchange = await request.post("/api/sleeping-delivery/exchange", {
        headers: {
          "x-forwarded-for": `2001:db8::${Date.now().toString(16)}`,
        },
        data: {
          ownPhoto: {
            id: ownPhotoId,
            catId: `own-cat-${stamp}`,
            ownerCatId: `own-cat-${stamp}`,
            src: catPhotoDataUrl,
            createdAt: Date.now(),
            shared: true,
          },
          triggerLabel: "sleeping",
          theme: "sleeping",
          category: "sleeping",
          seed: submissionId,
          deliveryDateKey: dateKey,
          recipientCatId: `own-cat-${stamp}`,
          anonymousId,
          preferredSourcePhotoId: candidateId,
          blockedPhotoIds: [],
          mode: "onboarding",
          onboardingSubmission: {
            dateKey,
            resumeToken,
            source: "direct",
            submissionId,
          },
        },
      });
      expect(exchange.status()).toBe(200);
      const exchangeBody = (await exchange.json()) as {
        diagnostics?: Record<string, unknown>;
        error?: string;
        photo?: { id?: string; sourcePhotoId?: string } | null;
      };
      expect(exchangeBody.photo, JSON.stringify(exchangeBody)).toBeTruthy();
      expect(exchangeBody.photo?.sourcePhotoId).toBe(candidateId);

      const status = await request.post("/api/onboarding/submission", {
        data: { resumeToken, submissionId },
      });
      expect(status.status()).toBe(200);
      await expect(status.json()).resolves.toMatchObject({
        submission: {
          deliveryId: exchangeBody.photo?.id,
          ownPhotoId,
          sourcePhotoId: candidateId,
          stage: "delivered",
        },
      });
    } finally {
      await adminSupabase
        .from("onboarding_submissions")
        .delete()
        .eq("submission_id", submissionId);
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("anonymous_id", anonymousId);
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", [candidateId, ownPhotoId]);
    }
  });

  test("keeps one own photo and one delivery when the same journey crosses browsers", async ({
    request,
  }) => {
    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "Local Supabase service role is required.");
    if (!adminSupabase) return;

    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const firstAnonymousId = `journey-first-${stamp}`;
    const secondAnonymousId = `journey-second-${stamp}`;
    const journeyId = `onbj_${crypto.randomUUID()}`;
    const dateKey = getJstDateKey();
    const submissionId = createOnboardingJourneySubmissionId(
      journeyId,
      dateKey,
    );
    const ownPhotoId = createOnboardingOwnPhotoId(submissionId);
    const resumeToken = createOnboardingResumeToken();
    const candidateId = `journey-stock-${stamp}`;

    const exchangeData = (anonymousId: string) => ({
      ownPhoto: {
        id: ownPhotoId,
        catId: `journey-cat-${stamp}`,
        ownerCatId: `journey-cat-${stamp}`,
        src: catPhotoDataUrl,
        createdAt: Date.now(),
        shared: true,
      },
      triggerLabel: "sleeping",
      theme: "sleeping",
      category: "sleeping",
      seed: submissionId,
      deliveryDateKey: dateKey,
      recipientCatId: `journey-cat-${stamp}`,
      anonymousId,
      preferredSourcePhotoId: candidateId,
      blockedPhotoIds: [],
      mode: "onboarding",
      onboardingSubmission: {
        dateKey,
        journeyId,
        resumeToken,
        source: "instagram_bio",
        submissionId,
      },
    });

    try {
      const { error: candidateError } = await adminSupabase
        .from("cat_moments")
        .insert({
          anonymous_id: `journey-source-${stamp}`,
          local_moment_id: candidateId,
          local_cat_id: `journey-source-cat-${stamp}`,
          owner_cat_id: `journey-source-cat-${stamp}`,
          photo_url: catPhotoDataUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "approved",
          moderated_at: new Date().toISOString(),
          moderated_by: "e2e",
          metadata: { source: "e2e", pool_kind: "admin_stock" },
          captured_at: new Date(Date.now() - 60_000).toISOString(),
          created_at: new Date(Date.now() - 60_000).toISOString(),
        });
      expect(candidateError).toBeNull();

      const first = await request.post("/api/sleeping-delivery/exchange", {
        headers: { "x-forwarded-for": `198.51.100.${Date.now() % 200}` },
        data: exchangeData(firstAnonymousId),
      });
      expect(first.status()).toBe(200);
      const firstBody = (await first.json()) as {
        photo?: { id?: string; sourcePhotoId?: string } | null;
      };
      expect(firstBody.photo?.sourcePhotoId).toBe(candidateId);

      const second = await request.post("/api/sleeping-delivery/exchange", {
        headers: { "x-forwarded-for": `203.0.113.${Date.now() % 200}` },
        data: exchangeData(secondAnonymousId),
      });
      expect(second.status()).toBe(200);
      const secondBody = (await second.json()) as {
        diagnostics?: { idempotentReplay?: boolean };
        photo?: { id?: string; sourcePhotoId?: string } | null;
      };
      expect(secondBody.photo?.id).toBe(firstBody.photo?.id);
      expect(secondBody.photo?.sourcePhotoId).toBe(candidateId);
      expect(secondBody.diagnostics?.idempotentReplay).toBe(true);

      const { data: ownRows, count: ownCount, error: ownError } =
        await adminSupabase
          .from("cat_moments")
          .select("id, anonymous_id, user_id", { count: "exact" })
          .contains("metadata", { onboarding_submission_id: submissionId });
      expect(ownError).toBeNull();
      expect(ownCount).toBe(1);
      expect(ownRows).toEqual([
        expect.objectContaining({
          anonymous_id: secondAnonymousId,
          user_id: null,
        }),
      ]);

      const {
        data: deliveryRows,
        count: deliveryCount,
        error: deliveryError,
      } = await adminSupabase
        .from("cat_moment_deliveries")
        .select("id, anonymous_id, user_id", { count: "exact" })
        .contains("metadata", { onboarding_submission_id: submissionId });
      expect(deliveryError).toBeNull();
      expect(deliveryCount).toBe(1);
      expect(deliveryRows).toEqual([
        expect.objectContaining({
          anonymous_id: secondAnonymousId,
          user_id: null,
        }),
      ]);
    } finally {
      await adminSupabase
        .from("onboarding_submissions")
        .delete()
        .eq("submission_id", submissionId);
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .contains("metadata", { onboarding_submission_id: submissionId });
      await adminSupabase
        .from("cat_moments")
        .delete()
        .in("local_moment_id", [candidateId, ownPhotoId]);
    }
  });

  test("does not regress when later stages arrive concurrently", async ({
    request,
  }) => {
    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "Local Supabase service role is required.");
    if (!adminSupabase) return;

    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const anonymousId = `ledger-race-anon-${stamp}`;
    const submissionId = `onboarding:${anonymousId}:${getJstDateKey()}`;
    const resumeToken = createOnboardingResumeToken();
    const deliveryId = `ledger-race-delivery-${stamp}`;
    const sourcePhotoId = `ledger-race-source-${stamp}`;
    const base = {
      anonymousId,
      dateKey: getJstDateKey(),
      deliveryId,
      ownPhotoId: `ledger-race-own-${stamp}`,
      resumeToken,
      source: "direct",
      sourcePhotoId,
      submissionId,
    };

    try {
      const submitted = await request.put("/api/onboarding/submission", {
        data: { ...base, deliveryId: null, sourcePhotoId: null, stage: "submitted" },
      });
      expect(submitted.status()).toBe(200);

      const [delivered, opened] = await Promise.all([
        request.put("/api/onboarding/submission", {
          data: { ...base, stage: "delivered" },
        }),
        request.put("/api/onboarding/submission", {
          data: { ...base, stage: "opened" },
        }),
      ]);
      expect(delivered.status()).toBe(200);
      expect(opened.status()).toBe(200);

      const status = await request.post("/api/onboarding/submission", {
        data: { resumeToken, submissionId },
      });
      expect(status.status()).toBe(200);
      await expect(status.json()).resolves.toMatchObject({
        submission: {
          deliveryId,
          sourcePhotoId,
          stage: "opened",
        },
      });
    } finally {
      await adminSupabase
        .from("onboarding_submissions")
        .delete()
        .eq("submission_id", submissionId);
    }
  });
});

function createAdminSupabaseClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getJstDateKey(now = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

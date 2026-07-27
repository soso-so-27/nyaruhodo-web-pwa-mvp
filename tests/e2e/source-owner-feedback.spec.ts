import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

import { createOnboardingResumeToken } from "../../src/lib/onboarding/submissionContract";

const photoDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XwZsWQAAAABJRU5ErkJggg==";

test.describe("source owner feedback", () => {
  test("requires an owner capability and does not treat kept status alone as selected", async ({
    request,
  }) => {
    const adminSupabase = createLocalAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "Local Supabase service role is required.");
    if (!adminSupabase) return;

    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const ownerAnonymousId = `feedback-owner-${stamp}`;
    const recipientAnonymousId = `feedback-recipient-${stamp}`;
    const submissionId = `onboarding:${ownerAnonymousId}:${getJstDateKey()}`;
    const resumeToken = createOnboardingResumeToken();
    const ownPhotoId = `feedback-own-${stamp}`;
    const localDeliveryId = `feedback-bundle-${stamp}-choice-1`;
    const bundleId = `feedback-bundle-${stamp}`;
    let sourceMomentId = "";

    try {
      const { data: moment, error: momentError } = await adminSupabase
        .from("cat_moments")
        .insert({
          anonymous_id: ownerAnonymousId,
          local_moment_id: ownPhotoId,
          local_cat_id: `feedback-cat-${stamp}`,
          owner_cat_id: `feedback-cat-${stamp}`,
          photo_url: photoDataUrl,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          metadata: {
            source: "e2e",
            onboarding_submission_id: submissionId,
          },
        })
        .select("id")
        .single();
      expect(momentError).toBeNull();
      sourceMomentId = moment?.id ?? "";
      expect(sourceMomentId).toBeTruthy();

      const { error: submissionError } = await adminSupabase
        .from("onboarding_submissions")
        .insert({
          anonymous_id: ownerAnonymousId,
          date_key: getJstDateKey(),
          own_photo_id: ownPhotoId,
          resume_token_hash: createHash("sha256")
            .update(resumeToken)
            .digest("hex"),
          source: "direct",
          stage: "submitted",
          submission_id: submissionId,
        });
      expect(submissionError).toBeNull();

      const { error: deliveryError } = await adminSupabase
        .from("cat_moment_deliveries")
        .insert({
          anonymous_id: recipientAnonymousId,
          local_delivery_id: localDeliveryId,
          source_moment_id: sourceMomentId,
          source_photo_id: ownPhotoId,
          photo_url: photoDataUrl,
          status: "kept",
          metadata: {
            bundle_id: bundleId,
            experience_version: "evening_choice_v1",
          },
        });
      expect(deliveryError).toBeNull();

      const deliveredResponse = await request.post(
        "/api/cat-moment-feedback",
        {
          data: {
            onboarding: { resumeToken, submissionId },
            sourceMomentIds: [],
          },
        },
      );
      expect(deliveredResponse.status()).toBe(200);
      expect(deliveredResponse.headers()["cache-control"]).toContain(
        "no-store",
      );
      await expect(deliveredResponse.json()).resolves.toEqual({
        ok: true,
        feedback: [
          {
            sourceMomentId,
            localPhotoId: ownPhotoId,
            state: "delivered",
          },
        ],
      });

      const { error: resolutionError } = await adminSupabase
        .from("evening_delivery_choice_resolutions")
        .insert({
          anonymous_id: recipientAnonymousId,
          bundle_id: bundleId,
          delivery_date_key: getJstDateKey(),
          outcome: "kept",
          selected_local_delivery_id: localDeliveryId,
        });
      expect(resolutionError).toBeNull();

      const selectedResponse = await request.post(
        "/api/cat-moment-feedback",
        {
          data: {
            onboarding: { resumeToken, submissionId },
            sourceMomentIds: [],
          },
        },
      );
      expect(selectedResponse.status()).toBe(200);
      const selectedPayload = await selectedResponse.json();
      expect(selectedPayload).toEqual({
        ok: true,
        feedback: [
          {
            sourceMomentId,
            localPhotoId: ownPhotoId,
            state: "selected",
          },
        ],
      });
      expect(JSON.stringify(selectedPayload)).not.toMatch(
        /anonymous|recipient|deliveryId|selectedAt|count/i,
      );

      const wrongTokenResponse = await request.post(
        "/api/cat-moment-feedback",
        {
          data: {
            onboarding: {
              resumeToken: createOnboardingResumeToken(),
              submissionId,
            },
            sourceMomentIds: [],
          },
        },
      );
      expect(wrongTokenResponse.status()).toBe(404);
    } finally {
      await adminSupabase
        .from("evening_delivery_choice_resolutions")
        .delete()
        .eq("bundle_id", bundleId);
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .eq("local_delivery_id", localDeliveryId);
      await adminSupabase
        .from("onboarding_submissions")
        .delete()
        .eq("submission_id", submissionId);
      if (sourceMomentId) {
        await adminSupabase
          .from("cat_moments")
          .delete()
          .eq("id", sourceMomentId);
      }
    }
  });

  test("returns feedback only for source moments owned by the authenticated user", async ({
    request,
  }) => {
    const clients = createLocalSupabaseClientsFromEnv();
    test.skip(!clients, "Local Supabase auth and service role are required.");
    if (!clients) return;

    const { adminSupabase, publicSupabase } = clients;
    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const password = `Password-${stamp}!`;
    const firstEmail = `feedback-first-${stamp}@example.com`;
    const secondEmail = `feedback-second-${stamp}@example.com`;
    const createdUserIds: string[] = [];
    const deliveryIds = [
      `feedback-auth-delivery-first-${stamp}`,
      `feedback-auth-delivery-second-${stamp}`,
    ];
    let firstMomentId = "";
    let secondMomentId = "";

    try {
      for (const email of [firstEmail, secondEmail]) {
        const { data, error } = await adminSupabase.auth.admin.createUser({
          email,
          email_confirm: true,
          password,
        });
        expect(error).toBeNull();
        expect(data.user?.id).toBeTruthy();
        createdUserIds.push(data.user?.id ?? "");
      }

      const { data: signedIn, error: signInError } =
        await publicSupabase.auth.signInWithPassword({
          email: firstEmail,
          password,
        });
      expect(signInError).toBeNull();
      const accessToken = signedIn.session?.access_token ?? "";
      expect(accessToken).toBeTruthy();

      const momentRows = await Promise.all(
        createdUserIds.map(async (userId, index) => {
          const localMomentId = `feedback-auth-own-${index}-${stamp}`;
          const { data, error } = await adminSupabase
            .from("cat_moments")
            .insert({
              user_id: userId,
              local_moment_id: localMomentId,
              local_cat_id: `feedback-auth-cat-${index}-${stamp}`,
              owner_cat_id: `feedback-auth-cat-${index}-${stamp}`,
              photo_url: photoDataUrl,
              state: "sleeping",
              visibility: "shared",
              delivery_status: "available",
              metadata: { source: "e2e" },
            })
            .select("id, local_moment_id")
            .single();
          expect(error).toBeNull();
          return data as { id: string; local_moment_id: string };
        }),
      );
      firstMomentId = momentRows[0].id;
      secondMomentId = momentRows[1].id;

      const { error: deliveryError } = await adminSupabase
        .from("cat_moment_deliveries")
        .insert(
          momentRows.map((moment, index) => ({
            anonymous_id: `feedback-auth-recipient-${index}-${stamp}`,
            local_delivery_id: deliveryIds[index],
            source_moment_id: moment.id,
            source_photo_id: moment.local_moment_id,
            photo_url: photoDataUrl,
            status: "delivered",
            metadata: { source: "e2e" },
          })),
        );
      expect(deliveryError).toBeNull();

      const response = await request.post("/api/cat-moment-feedback", {
        headers: { Authorization: `Bearer ${accessToken}` },
        data: {
          sourceMomentIds: [firstMomentId, secondMomentId],
        },
      });
      expect(response.status()).toBe(200);
      await expect(response.json()).resolves.toEqual({
        ok: true,
        feedback: [
          {
            sourceMomentId: firstMomentId,
            localPhotoId: momentRows[0].local_moment_id,
            state: "delivered",
          },
        ],
      });

      const localPhotoResponse = await request.post(
        "/api/cat-moment-feedback",
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          data: {
            localPhotoIds: momentRows.map((moment) => moment.local_moment_id),
          },
        },
      );
      expect(localPhotoResponse.status()).toBe(200);
      const localPhotoPayload = await localPhotoResponse.json();
      expect(localPhotoPayload).toEqual({
        ok: true,
        feedback: [
          {
            sourceMomentId: firstMomentId,
            localPhotoId: momentRows[0].local_moment_id,
            state: "delivered",
          },
        ],
      });
      expect(JSON.stringify(localPhotoPayload)).not.toMatch(
        /anonymous|recipient|deliveryId|selectedAt|count/i,
      );
    } finally {
      await adminSupabase
        .from("cat_moment_deliveries")
        .delete()
        .in("local_delivery_id", deliveryIds);
      if (firstMomentId || secondMomentId) {
        await adminSupabase
          .from("cat_moments")
          .delete()
          .in(
            "id",
            [firstMomentId, secondMomentId].filter(Boolean),
          );
      }
      for (const userId of createdUserIds.filter(Boolean)) {
        await adminSupabase.auth.admin.deleteUser(userId);
      }
    }
  });
});

function createLocalAdminSupabaseClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !serviceRoleKey ||
    !/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i.test(url)
  ) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function createLocalSupabaseClientsFromEnv() {
  const adminSupabase = createLocalAdminSupabaseClientFromEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!adminSupabase || !url || !anonKey) {
    return null;
  }

  return {
    adminSupabase,
    publicSupabase: createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
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

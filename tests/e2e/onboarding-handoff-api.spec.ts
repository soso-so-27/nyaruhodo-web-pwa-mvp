import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test.describe("onboarding handoff API", () => {
  test("keeps a handoff redeemable until it expires", async ({ request }) => {
    const createResponse = await request.post("/api/onboarding/handoff/create", {
      data: {
        source: "direct",
        payload: {
          version: 1,
          createdAt: new Date().toISOString(),
          source: "direct",
          onboardingProgress: null,
          onboardingCompleted: true,
          catProfiles: [{ id: "retry-cat", name: "むぎ" }],
          activeCatId: "retry-cat",
          ownSleepingPhotos: [],
          keptExchangePhotos: [],
          pendingReferralCode: null,
          session: null,
        },
      },
    });
    expect(createResponse.ok()).toBe(true);
    const created = (await createResponse.json()) as { token: string };

    const first = await request.post("/api/onboarding/handoff/redeem", {
      data: { token: created.token },
    });
    const second = await request.post("/api/onboarding/handoff/redeem", {
      data: { token: created.token },
    });

    expect(first.ok()).toBe(true);
    expect(second.ok()).toBe(true);
    await expect(second.json()).resolves.toMatchObject({
      ok: true,
      payload: { activeCatId: "retry-cat" },
    });
  });

  test("moves current onboarding rows to the restored browser identity", async ({
    request,
  }) => {
    const adminSupabase = createAdminSupabaseClientFromEnv();
    test.skip(!adminSupabase, "Local Supabase service role is required.");
    if (!adminSupabase) {
      return;
    }

    const stamp = `${Date.now()}-${crypto.randomUUID()}`;
    const sourceAnonymousId = `handoff-source-${stamp}`;
    const targetAnonymousId = `handoff-target-${stamp}`;
    const otherAnonymousId = `handoff-other-${stamp}`;
    const ownPhotoId = `handoff-own-${stamp}`;
    const deliveryId = `handoff-delivery-${stamp}`;
    const ownPhotoSrc = `storage:handoff-tests/${stamp}/own.jpg`;
    const deliveredPhotoSrc = `storage:handoff-tests/${stamp}/delivered.jpg`;

    try {
      const { error: ownInsertError } = await adminSupabase
        .from("cat_moments")
        .insert({
          anonymous_id: sourceAnonymousId,
          local_moment_id: ownPhotoId,
          local_cat_id: `cat-${stamp}`,
          owner_cat_id: `cat-${stamp}`,
          photo_url: ownPhotoSrc,
          state: "sleeping",
          visibility: "shared",
          delivery_status: "available",
          moderation_status: "pending",
          metadata: {},
        });
      expect(ownInsertError).toBeNull();

      const { error: deliveryInsertError } = await adminSupabase
        .from("cat_moment_deliveries")
        .insert({
          anonymous_id: sourceAnonymousId,
          local_delivery_id: deliveryId,
          source_photo_id: `source-${stamp}`,
          photo_url: deliveredPhotoSrc,
          status: "delivered",
          metadata: {},
        });
      expect(deliveryInsertError).toBeNull();

      const createResponse = await request.post("/api/onboarding/handoff/create", {
        data: {
          source: "instagram_bio",
          payload: {
            version: 1,
            createdAt: new Date().toISOString(),
            source: "instagram_bio",
            onboardingProgress: {
              version: 1,
              anonymousId: sourceAnonymousId,
              dateKey: "2026-07-16",
              stage: "opened",
              source: "instagram_bio",
              submissionId: `onboarding:${sourceAnonymousId}:2026-07-16`,
              ownPhoto: { id: ownPhotoId, src: ownPhotoSrc },
              deliveredPhoto: { id: deliveryId, src: deliveredPhotoSrc },
              isDeliveredPhotoKept: true,
              updatedAt: Date.now(),
            },
            onboardingCompleted: true,
            catProfiles: [],
            activeCatId: `cat-${stamp}`,
            ownSleepingPhotos: [],
            keptExchangePhotos: [],
            pendingReferralCode: null,
            session: null,
          },
        },
      });
      expect(createResponse.ok()).toBe(true);
      const created = (await createResponse.json()) as { token: string };

      const redeemResponse = await request.post("/api/onboarding/handoff/redeem", {
        data: {
          token: created.token,
          anonymousId: targetAnonymousId,
        },
      });
      expect(redeemResponse.ok()).toBe(true);

      const { data: movedOwnPhoto } = await adminSupabase
        .from("cat_moments")
        .select("anonymous_id")
        .eq("local_moment_id", ownPhotoId)
        .maybeSingle();
      const { data: movedDelivery } = await adminSupabase
        .from("cat_moment_deliveries")
        .select("anonymous_id")
        .eq("local_delivery_id", deliveryId)
        .maybeSingle();
      expect(movedOwnPhoto?.anonymous_id).toBe(targetAnonymousId);
      expect(movedDelivery?.anonymous_id).toBe(targetAnonymousId);

      const repeatedResponse = await request.post(
        "/api/onboarding/handoff/redeem",
        {
          data: {
            token: created.token,
            anonymousId: otherAnonymousId,
          },
        },
      );
      expect(repeatedResponse.ok()).toBe(true);

      const { data: retainedDelivery } = await adminSupabase
        .from("cat_moment_deliveries")
        .select("anonymous_id")
        .eq("local_delivery_id", deliveryId)
        .maybeSingle();
      expect(retainedDelivery?.anonymous_id).toBe(targetAnonymousId);
    } finally {
      await adminSupabase.from("cat_moment_deliveries").delete().eq(
        "local_delivery_id",
        deliveryId,
      );
      await adminSupabase
        .from("cat_moments")
        .delete()
        .eq("local_moment_id", ownPhotoId);
    }
  });
});

function createAdminSupabaseClientFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

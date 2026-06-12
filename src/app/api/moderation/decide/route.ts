import { NextResponse } from "next/server";

import {
  getAdminCapabilitiesForRequest,
  getAuthenticatedUserForRequest,
} from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

type DecideRequest = {
  momentId?: string;
  decision?: string;
};

const DECISIONS = new Set(["approved", "rejected"]);

export async function POST(request: Request) {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!capabilities.isAdmin) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as DecideRequest | null;
  const momentId = sanitizeId(body?.momentId);
  const decision = DECISIONS.has(body?.decision ?? "") ? body!.decision! : null;

  if (!momentId || !decision) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const user = await getAuthenticatedUserForRequest(request);
  const moderatedBy = user?.email ?? user?.id ?? "admin";
  const patch =
    decision === "approved"
      ? {
          moderation_status: "approved",
          moderated_at: new Date().toISOString(),
          moderated_by: moderatedBy,
        }
      : {
          moderation_status: "rejected",
          delivery_status: "hidden",
          moderated_at: new Date().toISOString(),
          moderated_by: moderatedBy,
        };

  const { error } = await supabase.from("cat_moments").update(patch).eq("id", momentId);

  if (error) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  return NextResponse.json({ ok: true });
}

function sanitizeId(value: string | undefined) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.length > 160 || /[\r\n]/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

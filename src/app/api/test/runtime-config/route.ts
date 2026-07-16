import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const supabaseOrigin = getOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL);

  if (
    !isLoopbackHostname(request.nextUrl.hostname) ||
    !isLoopbackOrigin(supabaseOrigin)
  ) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.json(
    {
      supabaseOrigin,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function isLoopbackHostname(hostname: string) {
  return (
    hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1"
  );
}

function isLoopbackOrigin(origin: string | null) {
  if (!origin) {
    return false;
  }

  try {
    return isLoopbackHostname(new URL(origin).hostname);
  } catch {
    return false;
  }
}

function getOrigin(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

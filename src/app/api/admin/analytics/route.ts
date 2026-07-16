import { NextResponse } from "next/server";

import { requireAdminAccess } from "../../../../lib/adminAccess";
import {
  buildAdminAnalytics,
  buildAnalyticsPeriodRange,
  isImpactEvent,
  readAnalyticsPeriod,
  type AdminAnalyticsEvent,
} from "../../../../lib/analytics/adminAnalytics";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const EVENT_QUERY_LIMIT = 5000;

export async function GET(request: Request) {
  const access = await requireAdminAccess(request);

  if (!access.allowed) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const supabase = createSupabaseAdminClient();

  if (!supabase) {
    return NextResponse.json(
      { error: "admin_config_missing" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const period = readAnalyticsPeriod(url.searchParams.get("period"));
  const range = buildAnalyticsPeriodRange(period);
  const { data, error } = await supabase
    .from("app_events")
    .select(
      "event_name, source, anonymous_id, user_id, session_id, submission_id, route, surface, is_in_app_browser, is_standalone_pwa, error_code, error_message, metadata, created_at",
    )
    .gte("created_at", range.from.toISOString())
    .lt("created_at", range.to.toISOString())
    .order("created_at", { ascending: false })
    .limit(EVENT_QUERY_LIMIT);

  if (error) {
    return NextResponse.json(
      { error: "analytics_query_failed" },
      { status: 500 },
    );
  }

  const events = ((data ?? []) as AdminAnalyticsEvent[]).filter((event) =>
    Boolean(event.event_name),
  );
  const summary = buildAdminAnalytics(events);

  return NextResponse.json({
    period,
    generatedAt: new Date().toISOString(),
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    totalEvents: events.length,
    eventLimitReached: events.length >= EVENT_QUERY_LIMIT,
    ...summary,
    recentErrors: events
      .filter(isImpactEvent)
      .slice(0, 30)
      .map(toSafeEvent),
    recentEvents: events.slice(0, 50).map(toSafeEvent),
  });
}

function toSafeEvent(event: AdminAnalyticsEvent) {
  return {
    createdAt: event.created_at,
    eventName: event.event_name,
    source: event.source ?? "unknown",
    route: event.route,
    surface: event.surface,
    errorCode: event.error_code,
    errorMessage: event.error_message,
    anonymousId: shortenId(event.anonymous_id),
    userId: shortenId(event.user_id),
    submissionId: shortenId(event.submission_id),
  };
}

function shortenId(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length <= 10 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

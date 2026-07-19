import { NextResponse } from "next/server";

import { requireAdminAccess } from "../../../../lib/adminAccess";
import {
  buildAdminAnalytics,
  buildAnalyticsPeriodRange,
  classifyAnalyticsIssues,
  isInternalAnalyticsEvent,
  readAnalyticsJourneyId,
  readAnalyticsAudience,
  readAnalyticsPeriod,
  type AdminAnalyticsEvent,
} from "../../../../lib/analytics/adminAnalytics";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const EVENT_QUERY_LIMIT = 5000;
const DIAGNOSTIC_EVENT_NAMES = [
  "image_load_completed",
  "photo_sw_cache_configured",
  "photo_sw_cache_hit",
] as const;

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
  const audience = readAnalyticsAudience(url.searchParams.get("audience"));
  const range = buildAnalyticsPeriodRange(period);
  const { data: linkedAdminRows, error: linkedAdminError } = await supabase
    .from("app_events")
    .select("anonymous_id")
    .eq("user_id", access.user.id)
    .not("anonymous_id", "is", null)
    .limit(1000);

  if (linkedAdminError) {
    return NextResponse.json(
      { error: "analytics_internal_identity_query_failed" },
      { status: 500 },
    );
  }

  const internalAnonymousIds = new Set(
    (linkedAdminRows ?? [])
      .map((row) => row.anonymous_id)
      .filter((value): value is string => Boolean(value)),
  );
  const requestingAnonymousId = readAnonymousIdHeader(request);
  if (requestingAnonymousId) {
    internalAnonymousIds.add(requestingAnonymousId);
  }

  const diagnosticFilter = `(${DIAGNOSTIC_EVENT_NAMES.map((name) => `"${name}"`).join(",")})`;
  const { data, error } = await supabase
    .from("app_events")
    .select(
      "event_name, source, anonymous_id, user_id, session_id, submission_id, route, surface, is_in_app_browser, is_standalone_pwa, error_code, error_message, metadata, created_at",
    )
    .gte("created_at", range.from.toISOString())
    .lt("created_at", range.to.toISOString())
    .not("event_name", "in", diagnosticFilter)
    .order("created_at", { ascending: false })
    .limit(EVENT_QUERY_LIMIT);

  if (error) {
    return NextResponse.json(
      { error: "analytics_query_failed" },
      { status: 500 },
    );
  }

  const readableEvents = ((data ?? []) as AdminAnalyticsEvent[]).filter((event) =>
    Boolean(event.event_name),
  );
  const directlyInternalEvents = readableEvents.filter((event) =>
    isInternalAnalyticsEvent(event, {
      adminUserId: access.user.id,
      internalAnonymousIds,
    }),
  );
  const internalJourneyIds = new Set(
    directlyInternalEvents
      .map(readAnalyticsJourneyId)
      .filter((value): value is string => Boolean(value)),
  );
  const directlyInternalEventSet = new Set(directlyInternalEvents);
  const internalEvents = readableEvents.filter(
    (event) => {
      if (directlyInternalEventSet.has(event)) {
        return true;
      }

      const journeyId = readAnalyticsJourneyId(event);
      return Boolean(journeyId && internalJourneyIds.has(journeyId));
    },
  );
  const internalEventSet = new Set(internalEvents);
  const productEvents = readableEvents.filter(
    (event) => !internalEventSet.has(event),
  );
  const events = audience === "internal" ? internalEvents : productEvents;
  const generatedAt = new Date();
  const summary = buildAdminAnalytics(events, generatedAt);
  const issues = classifyAnalyticsIssues(events);

  return NextResponse.json({
    period,
    audience,
    generatedAt: generatedAt.toISOString(),
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    totalEvents: events.length,
    eventLimitReached: readableEvents.length >= EVENT_QUERY_LIMIT,
    diagnosticEventsExcluded: true,
    audienceCounts: {
      productEvents: productEvents.length,
      internalEvents: internalEvents.length,
      internalActors: internalAnonymousIds.size,
    },
    ...summary,
    recentErrors: issues.incidents.actionable
      .slice(0, 30)
      .map((incident) => ({
        ...toSafeEvent(incident.representativeEvent),
        createdAt: incident.latestAt,
        eventName: incident.eventName,
        errorCode: incident.errorCode,
        incidentEvents: incident.events.length,
        incidentFirstAt: incident.firstAt,
      })),
    recentEvents: events.slice(0, 50).map(toSafeEvent),
  });
}

function readAnonymousIdHeader(request: Request) {
  const value = request.headers.get("x-analytics-anonymous-id")?.trim() ?? "";
  return value && value.length <= 128 && /^[a-zA-Z0-9-]+$/.test(value)
    ? value
    : null;
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
    journeyId: shortenId(readAnalyticsJourneyId(event)),
    submissionId: shortenId(event.submission_id),
  };
}

function shortenId(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length <= 10 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

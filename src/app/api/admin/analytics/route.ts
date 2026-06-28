import { NextResponse } from "next/server";

import { requireAdminAccess } from "../../../../lib/adminAccess";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";

export const dynamic = "force-dynamic";

const CARD_EVENTS = [
  "app_opened",
  "onboarding_intro_view",
  "onboarding_photo_submitted",
  "cat_name_prompt_view",
  "cat_name_entered",
  "cat_name_skipped",
  "onboarding_delivery_opened",
  "onboarding_album_prompt_view",
  "album_prompt_view_with_name",
  "album_prompt_view_without_name",
  "onboarding_google_continue_click",
  "onboarding_skip_click",
  "album_created_with_name",
  "album_created_without_name",
  "home_photo_submitted",
  "delivery_opened",
  "delivery_reveal_started",
  "delivery_reveal_completed",
  "delivery_reveal_photo_loaded",
  "delivery_reveal_photo_error",
  "delivery_reveal_skipped",
  "collection_view",
  "cat_album_created",
] as const;

const FUNNEL_EVENTS = [
  "onboarding_intro_view",
  "onboarding_photo_submitted",
  "cat_name_prompt_view",
  "onboarding_delivery_opened",
  "onboarding_album_prompt_view",
  "onboarding_google_continue_click",
  "onboarding_completed",
] as const;

const SOURCE_EVENTS = [
  "onboarding_intro_view",
  "onboarding_photo_submitted",
  "cat_name_prompt_view",
  "cat_name_entered",
  "cat_name_skipped",
  "onboarding_delivery_opened",
  "onboarding_album_prompt_view",
  "album_prompt_view_with_name",
  "album_prompt_view_without_name",
  "onboarding_google_continue_click",
  "onboarding_skip_click",
] as const;

const APP_KPI_EVENTS = [
  "home_view",
  "home_photo_submitted",
  "delivery_opened",
  "delivery_reveal_started",
  "delivery_reveal_completed",
  "delivery_reveal_photo_loaded",
  "delivery_reveal_photo_error",
  "delivery_reveal_skipped",
  "collection_view",
  "collection_sent_tab_view",
  "collection_received_tab_view",
  "cat_album_created",
  "album_created_with_name",
  "album_created_without_name",
] as const;

type PeriodKey = "today" | "yesterday" | "7d" | "28d";

type AppEventRow = {
  event_name: string;
  source: string | null;
  anonymous_id: string | null;
  user_id: string | null;
  session_id: string | null;
  submission_id: string | null;
  route: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
};

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
  const period = readPeriod(url.searchParams.get("period"));
  const range = buildPeriodRange(period);
  const { data, error } = await supabase
    .from("app_events")
    .select(
      "event_name, source, anonymous_id, user_id, session_id, submission_id, route, error_code, error_message, created_at",
    )
    .gte("created_at", range.from.toISOString())
    .lt("created_at", range.to.toISOString())
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return NextResponse.json(
      { error: "analytics_query_failed" },
      { status: 500 },
    );
  }

  const events = ((data ?? []) as AppEventRow[]).filter((event) =>
    Boolean(event.event_name),
  );

  return NextResponse.json({
    period,
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
    },
    cards: buildCards(events),
    funnel: buildEventCounts(events, FUNNEL_EVENTS),
    sourceBreakdown: buildSourceBreakdown(events),
    appKpis: buildEventCounts(events, APP_KPI_EVENTS),
    retention: buildRetention(events),
    recentErrors: events
      .filter((event) => event.event_name.endsWith("_error") || event.error_code)
      .slice(0, 30)
      .map(toSafeEvent),
    recentEvents: events.slice(0, 50).map(toSafeEvent),
  });
}

function buildCards(events: AppEventRow[]) {
  const counts = buildEventCountMap(events);
  const errorCount = events.filter(
    (event) => event.event_name.endsWith("_error") || event.error_code,
  ).length;

  return [
    ...CARD_EVENTS.map((eventName) => ({
      eventName,
      count: counts.get(eventName) ?? 0,
    })),
    { eventName: "error", count: errorCount },
  ];
}

function buildEventCounts(
  events: AppEventRow[],
  eventNames: readonly string[],
) {
  const counts = buildEventCountMap(events);

  return eventNames.map((eventName) => ({
    eventName,
    count: counts.get(eventName) ?? 0,
    users: countUniqueUsers(events.filter((event) => event.event_name === eventName)),
  }));
}

function buildSourceBreakdown(events: AppEventRow[]) {
  const sourceMap = new Map<string, Map<string, Set<string>>>();

  for (const event of events) {
    if (!SOURCE_EVENTS.includes(event.event_name as (typeof SOURCE_EVENTS)[number])) {
      continue;
    }

    const source = event.source ?? "unknown";
    const sourceEvents = sourceMap.get(source) ?? new Map<string, Set<string>>();
    const users = sourceEvents.get(event.event_name) ?? new Set<string>();
    const actorId = getActorId(event);

    if (actorId) {
      users.add(actorId);
    }

    sourceEvents.set(event.event_name, users);
    sourceMap.set(source, sourceEvents);
  }

  return [...sourceMap.entries()]
    .map(([source, sourceEvents]) => ({
      source,
      events: SOURCE_EVENTS.map((eventName) => ({
        eventName,
        users: sourceEvents.get(eventName)?.size ?? 0,
      })),
    }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

function buildRetention(events: AppEventRow[]) {
  const activeUsers = new Set<string>();
  const submitCountByActor = new Map<string, number>();
  const submitDaysByActor = new Map<string, Set<string>>();

  for (const event of events) {
    const actorId = getActorId(event);

    if (!actorId) {
      continue;
    }

    activeUsers.add(actorId);

    if (!isPhotoSubmitEvent(event.event_name)) {
      continue;
    }

    submitCountByActor.set(actorId, (submitCountByActor.get(actorId) ?? 0) + 1);
    const day = toJstDateKey(new Date(event.created_at));
    const days = submitDaysByActor.get(actorId) ?? new Set<string>();
    days.add(day);
    submitDaysByActor.set(actorId, days);
  }

  let d1ReturnSubmitters = 0;
  for (const days of submitDaysByActor.values()) {
    const sortedDays = [...days].sort();
    if (
      sortedDays.some((day, index) =>
        index > 0 ? isNextJstDay(sortedDays[index - 1]!, day) : false,
      )
    ) {
      d1ReturnSubmitters += 1;
    }
  }

  return {
    uniqueActiveUsers: activeUsers.size,
    repeatSubmitters: [...submitCountByActor.values()].filter((count) => count >= 2)
      .length,
    d1ReturnSubmitters,
  };
}

function buildEventCountMap(events: AppEventRow[]) {
  const counts = new Map<string, number>();

  for (const event of events) {
    counts.set(event.event_name, (counts.get(event.event_name) ?? 0) + 1);
  }

  return counts;
}

function countUniqueUsers(events: AppEventRow[]) {
  return new Set(events.map(getActorId).filter(Boolean)).size;
}

function toSafeEvent(event: AppEventRow) {
  return {
    createdAt: event.created_at,
    eventName: event.event_name,
    source: event.source ?? "unknown",
    route: event.route,
    errorCode: event.error_code,
    errorMessage: event.error_message,
    anonymousId: shortenId(event.anonymous_id),
    userId: shortenId(event.user_id),
    submissionId: shortenId(event.submission_id),
  };
}

function readPeriod(value: string | null): PeriodKey {
  return value === "yesterday" || value === "7d" || value === "28d"
    ? value
    : "today";
}

function buildPeriodRange(period: PeriodKey) {
  const now = new Date();
  const todayStart = getJstDayStart(now);

  if (period === "yesterday") {
    const from = addDays(todayStart, -1);
    return { from, to: todayStart };
  }

  if (period === "7d") {
    return { from: addDays(todayStart, -6), to: now };
  }

  if (period === "28d") {
    return { from: addDays(todayStart, -27), to: now };
  }

  return { from: todayStart, to: now };
}

function getJstDayStart(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = formatter.format(date).split("-").map(Number);

  return new Date(Date.UTC(year!, month! - 1, day!, -9, 0, 0, 0));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toJstDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isNextJstDay(previous: string, current: string) {
  const previousDate = new Date(`${previous}T00:00:00+09:00`);
  const currentDate = new Date(`${current}T00:00:00+09:00`);

  return currentDate.getTime() - previousDate.getTime() === 24 * 60 * 60 * 1000;
}

function isPhotoSubmitEvent(eventName: string) {
  return (
    eventName === "onboarding_photo_submitted" ||
    eventName === "home_photo_submitted" ||
    eventName === "photo_submitted"
  );
}

function getActorId(event: AppEventRow) {
  return event.user_id ? `user:${event.user_id}` : event.anonymous_id;
}

function shortenId(value: string | null) {
  if (!value) {
    return null;
  }

  return value.length <= 10 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

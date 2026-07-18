#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

import {
  buildAdminAnalytics,
  buildAnalyticsPeriodRange,
  classifyAnalyticsIssues,
  isInternalAnalyticsEvent,
  readAnalyticsAudience,
  readAnalyticsPeriod,
} from "../src/lib/analytics/adminAnalytics.ts";

const EVENT_QUERY_LIMIT = 5000;
const DIAGNOSTIC_EVENT_NAMES = [
  "image_load_completed",
  "photo_sw_cache_configured",
  "photo_sw_cache_hit",
];
const SUPPORTED_PERIODS = new Set([
  "launch",
  "60m",
  "today",
  "yesterday",
  "7d",
  "28d",
]);
const SUPPORTED_AUDIENCES = new Set(["product", "internal"]);

const args = readArgs(process.argv.slice(2));
const requestedPeriod = args.period ?? "launch";
const requestedAudience = args.audience ?? "product";

if (!SUPPORTED_PERIODS.has(requestedPeriod)) {
  fail(`unsupported period: ${requestedPeriod}`);
}
if (!SUPPORTED_AUDIENCES.has(requestedAudience)) {
  fail(`unsupported audience: ${requestedAudience}`);
}

const supabaseUrl = requiredEnv(
  "NEXT_PUBLIC_SUPABASE_URL",
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL,
);
const serviceRoleKey = requiredEnv(
  "SUPABASE_SERVICE_ROLE_KEY",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const supabaseHost = new URL(supabaseUrl).hostname.toLowerCase();

if (
  (supabaseHost === "localhost" || supabaseHost === "127.0.0.1") &&
  args["allow-local"] !== "true"
) {
  fail("refusing to label a local Supabase database as production");
}

const configuredAdminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(/[\s,;]+/)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const requestedAdminEmail = args["admin-email"]?.trim().toLowerCase();
const adminEmails = requestedAdminEmail
  ? [requestedAdminEmail]
  : configuredAdminEmails;

if (adminEmails.length === 0) {
  fail("ADMIN_EMAILS is not configured and --admin-email was not supplied");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const adminUser = await findAdminUser(supabase, adminEmails);

if (!adminUser) {
  fail("configured admin account was not found in auth.users");
}

const period = readAnalyticsPeriod(requestedPeriod);
const audience = readAnalyticsAudience(requestedAudience);
const generatedAt = new Date();
const range = buildAnalyticsPeriodRange(period, generatedAt);
const internalAnonymousIds = await readInternalAnonymousIds(
  supabase,
  adminUser.id,
);
const readableEvents = await readEvents(supabase, range);
const internalEvents = readableEvents.filter((event) =>
  isInternalAnalyticsEvent(event, {
    adminUserId: adminUser.id,
    internalAnonymousIds,
  }),
);
const internalEventSet = new Set(internalEvents);
const productEvents = readableEvents.filter(
  (event) => !internalEventSet.has(event),
);
const events = audience === "internal" ? internalEvents : productEvents;
const summary = buildAdminAnalytics(events, generatedAt);
const issues = classifyAnalyticsIssues(events);
const analytics = {
  schemaVersion: 1,
  generatedAt: generatedAt.toISOString(),
  period,
  audience,
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
};

if (args.output) {
  const outputPath = path.resolve(args.output);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(analytics, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      period,
      audience,
      generatedAt: analytics.generatedAt,
      operationalStatus: analytics.operationalStatus,
    })}\n`,
  );
} else {
  process.stdout.write(`${JSON.stringify(analytics, null, 2)}\n`);
}

async function findAdminUser(client, emails) {
  const emailSet = new Set(emails);
  const perPage = 1000;

  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });

    if (error) {
      fail(`admin identity query failed: ${error.code ?? "unknown"}`);
    }

    const user = (data.users ?? []).find((candidate) =>
      emailSet.has(candidate.email?.trim().toLowerCase() ?? ""),
    );

    if (user) {
      return user;
    }
    if ((data.users ?? []).length < perPage) {
      break;
    }
  }

  return null;
}

async function readInternalAnonymousIds(client, adminUserId) {
  const { data, error } = await client
    .from("app_events")
    .select("anonymous_id")
    .eq("user_id", adminUserId)
    .not("anonymous_id", "is", null)
    .limit(1000);

  if (error) {
    fail(`internal identity query failed: ${error.code ?? "unknown"}`);
  }

  return new Set(
    (data ?? [])
      .map((row) => row.anonymous_id)
      .filter((value) => typeof value === "string" && value.length > 0),
  );
}

async function readEvents(client, range) {
  const diagnosticFilter = `(${DIAGNOSTIC_EVENT_NAMES.map((name) => `"${name}"`).join(",")})`;
  const { data, error } = await client
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
    fail(`analytics query failed: ${error.code ?? "unknown"}`);
  }

  return (data ?? []).filter((event) => Boolean(event.event_name));
}

function toSafeEvent(event) {
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

function shortenId(value) {
  if (!value) {
    return null;
  }

  return value.length <= 10 ? value : `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function readArgs(values) {
  const result = {};

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (!value?.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const next = values[index + 1];

    if (next && !next.startsWith("--")) {
      result[key] = next;
      index += 1;
    } else {
      result[key] = "true";
    }
  }

  return result;
}

function requiredEnv(name, value) {
  const normalized = value?.trim();

  if (!normalized) {
    fail(`${name} is not configured`);
  }

  return normalized;
}

function fail(message) {
  process.stderr.write(`production analytics: ${message}\n`);
  process.exit(1);
}

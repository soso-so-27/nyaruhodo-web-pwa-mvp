import { expect, test } from "@playwright/test";

import {
  buildAdminAnalytics,
  buildAnalyticsPeriodRange,
  classifyAnalyticsIssues,
  isInternalAnalyticsEvent,
  PUBLIC_LAUNCH_AT_ISO,
  readAnalyticsPeriod,
  type AdminAnalyticsEvent,
} from "../../src/lib/analytics/adminAnalytics";

const BASE_TIME = Date.parse("2026-07-16T08:00:00.000Z");

test.describe("admin analytics logic", () => {
  test("counts an ordered launch funnel without double-counting aliases", () => {
    const events = [
      event("actor-a", "onboarding_intro_view", 0, { source: "instagram_bio" }),
      event("actor-a", "onboarding_intro_view", 1, { source: "instagram_bio" }),
      event("actor-a", "onboarding_photo_select_click", 2),
      event("actor-a", "onboarding_photo_submitted", 3),
      event("actor-a", "photo_submitted", 4),
      event("actor-a", "evening_delivery_reserved", 5),
      event("actor-a", "onboarding_delivery_arrived", 6),
      event("actor-a", "onboarding_delivery_opened", 7),
      event("actor-a", "onboarding_completed", 8),
      event("actor-b", "onboarding_intro_view", 0),
      event("actor-b", "onboarding_photo_select_click", 1),
      event("actor-c", "onboarding_delivery_arrived", 0),
      event("actor-d", "onboarding_intro_view", 0),
      event("actor-d", "onboarding_photo_submitted", 1),
    ];

    const result = buildAdminAnalytics(events);

    expect(result.funnel.map((step) => step.users)).toEqual([3, 2, 1, 1, 1, 1]);
    expect(result.funnel[1]).toMatchObject({
      previousUsers: 3,
      fromPreviousRate: 66.7,
    });
    expect(result.overview.find((item) => item.key === "first_photo")).toMatchObject({
      users: 2,
      events: 2,
    });
    expect(result.retention).toMatchObject({
      photoSubmitters: 2,
      repeatSubmitters: 0,
      returningDaySubmitters: 0,
    });
    expect(result.overview.find((item) => item.key === "evening_reserved")).toMatchObject({
      users: 1,
      events: 1,
    });
  });

  test("counts one saved photo once across related events", () => {
    const events = [
      event("actor-a", "onboarding_photo_submitted", 0, {
        submissionId: "same-photo",
      }),
      event("actor-a", "home_exchange_share_photo_confirmed", 1, {
        submissionId: "same-photo",
      }),
    ];

    expect(buildAdminAnalytics(events).retention).toMatchObject({
      photoSubmitters: 1,
      repeatSubmitters: 0,
      returningDaySubmitters: 0,
    });
  });

  test("uses source_param to distinguish Threads from untagged direct traffic", () => {
    const events = [
      event("threads-user", "onboarding_intro_view", 0, {
        source: "direct",
        metadata: { source_param: "threads" },
      }),
      event("direct-user", "onboarding_intro_view", 1, { source: "direct" }),
    ];

    expect(buildAdminAnalytics(events).sourceBreakdown).toEqual([
      {
        source: "threads",
        introUsers: 1,
        submittedUsers: 0,
        openedUsers: 0,
        reservedUsers: 0,
      },
      {
        source: "direct",
        introUsers: 1,
        submittedUsers: 0,
        openedUsers: 0,
        reservedUsers: 0,
      },
    ]);
  });

  test("stitches embedded and external browsers into one onboarding journey", () => {
    const journeyId = "onbj_00000000-0000-4000-8000-000000000001";
    const events = [
      event("line-browser", "onboarding_intro_view", 0, {
        source: "instagram_bio",
        metadata: {
          journey_id: journeyId,
          browser_context: "line",
        },
        inAppBrowser: true,
      }),
      event("safari-browser", "onboarding_photo_select_click", 1, {
        source: "instagram_bio",
        metadata: {
          journey_id: journeyId,
          browser_context: "browser",
        },
      }),
      event("safari-browser", "onboarding_photo_submitted", 2, {
        source: "instagram_bio",
        metadata: { journey_id: journeyId },
      }),
      event("safari-browser", "onboarding_delivery_arrived", 3, {
        source: "instagram_bio",
        metadata: { journey_id: journeyId },
      }),
      event("safari-browser", "onboarding_delivery_opened", 4, {
        source: "instagram_bio",
        metadata: { journey_id: journeyId },
      }),
    ];

    const result = buildAdminAnalytics(events);

    expect(result.funnel.slice(0, 5).map((step) => step.users)).toEqual([
      1, 1, 1, 1, 1,
    ]);
    expect(result.sourceBreakdown).toEqual([
      {
        source: "instagram_bio",
        introUsers: 1,
        submittedUsers: 1,
        openedUsers: 1,
        reservedUsers: 0,
      },
    ]);
  });

  test("groups impact events and privacy-safe environment labels", () => {
    const events = [
      event("actor-a", "photo_upload_error", 0, {
        errorCode: "onboarding_photo_save_failed",
        metadata: { device_os: "android", browser_context: "line" },
        inAppBrowser: true,
      }),
      event("actor-a", "photo_upload_error", 1, {
        errorCode: "onboarding_photo_save_failed",
        metadata: { device_os: "android", browser_context: "line" },
        inAppBrowser: true,
      }),
      event("actor-b", "evening_delivery_check_failed", 2, {
        metadata: { device_os: "ios", browser_context: "browser" },
      }),
    ];

    const result = buildAdminAnalytics(events);

    expect(result.overview.find((item) => item.key === "needs_attention")).toMatchObject({
      users: 2,
      events: 3,
    });
    expect(result.errorSummary[0]).toMatchObject({
      eventName: "photo_upload_error",
      errorCode: "onboarding_photo_save_failed",
      users: 1,
      events: 2,
    });
    expect(result.environment.devices).toEqual([
      { key: "android", users: 1 },
      { key: "ios", users: 1 },
    ]);
    expect(result.environment.contexts).toEqual([
      { key: "browser", users: 1 },
      { key: "line", users: 1 },
    ]);
  });

  test("collapses duplicate telemetry into logical incidents", () => {
    const events = [
      event("onboarding-user", "onboarding_delivery_error", 0, {
        errorCode: "onboarding_delivery_failed_after_photo_save",
      }),
      event("onboarding-user", "photo_upload_error", 0.01, {
        errorCode: "onboarding_delivery_failed_after_photo_save",
      }),
      event("evening-user", "evening_delivery_check_failed", 1),
      event("evening-user", "evening_delivery_check_timeout", 1.001),
      event("evening-user", "evening_delivery_check_failed", 1.002),
    ];

    const result = buildAdminAnalytics(
      events,
      new Date(BASE_TIME + 10 * 60_000),
    );

    expect(result.overview.find((item) => item.key === "needs_attention")).toMatchObject({
      users: 2,
      events: 2,
    });
    expect(result.errorSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: "onboarding_delivery_failure",
          incidents: 1,
          events: 2,
          users: 1,
        }),
        expect.objectContaining({
          eventName: "evening_delivery_check_failure",
          incidents: 1,
          events: 3,
          users: 1,
        }),
      ]),
    );
  });

  test("moves a user-visible recovery out of unresolved incidents", () => {
    const events = [
      event("recovered-user", "onboarding_delivery_error", 0, {
        errorCode: "onboarding_delivery_failed_after_photo_save",
      }),
      event("recovered-user", "photo_upload_error", 0.01, {
        errorCode: "onboarding_delivery_failed_after_photo_save",
      }),
      event("recovered-user", "onboarding_sleeping_photo_delivered", 0.05),
      event("recovered-user", "onboarding_delivery_arrived", 0.1),
      event("blocked-user", "onboarding_sleeping_photo_delivered", 1),
      event("blocked-user", "onboarding_delivery_blocked", 1.1, {
        metadata: { reason: "no_delivery_photo" },
      }),
    ];

    const issues = classifyAnalyticsIssues(events);
    const result = buildAdminAnalytics(
      events,
      new Date(BASE_TIME + 10 * 60_000),
    );

    expect(issues.incidents.recovered).toHaveLength(1);
    expect(issues.incidents.recovered[0]).toMatchObject({
      eventName: "onboarding_delivery_failure",
    });
    expect(issues.incidents.actionable).toHaveLength(1);
    expect(issues.incidents.actionable[0]).toMatchObject({
      eventName: "onboarding_delivery_failure",
    });
    expect(result.overview.find((item) => item.key === "needs_attention")).toMatchObject({
      users: 1,
      events: 1,
    });
  });

  test("uses action only for fresh or spreading unresolved incidents", () => {
    const events = [
      event("actor-a", "onboarding_delivery_blocked", 0, {
        metadata: { reason: "no_delivery_photo" },
      }),
    ];

    expect(
      buildAdminAnalytics(events, new Date(BASE_TIME + 20 * 60_000))
        .operationalStatus,
    ).toMatchObject({ level: "action", freshIncidents: 1 });
    expect(
      buildAdminAnalytics(events, new Date(BASE_TIME + 40 * 60_000))
        .operationalStatus,
    ).toMatchObject({ level: "watch", freshIncidents: 0 });
  });

  test("supports a rolling 60 minute launch window", () => {
    const now = new Date("2026-07-16T08:30:00.000Z");
    const range = buildAnalyticsPeriodRange("60m", now);

    expect(readAnalyticsPeriod("60m")).toBe("60m");
    expect(range.to.toISOString()).toBe("2026-07-16T08:30:00.000Z");
    expect(range.from.toISOString()).toBe("2026-07-16T07:30:00.000Z");
  });

  test("defaults to the public launch window", () => {
    const now = new Date("2026-07-17T13:30:00.000Z");
    const range = buildAnalyticsPeriodRange("launch", now);

    expect(readAnalyticsPeriod(null)).toBe("launch");
    expect(readAnalyticsPeriod("invalid")).toBe("launch");
    expect(range.from.toISOString()).toBe(PUBLIC_LAUNCH_AT_ISO);
    expect(range.to.toISOString()).toBe("2026-07-17T13:30:00.000Z");
  });

  test("separates internal traffic from product users", () => {
    const internalIds = new Set(["admin-browser"]);
    const context = {
      adminUserId: "admin-user",
      internalAnonymousIds: internalIds,
    };

    expect(
      isInternalAnalyticsEvent(
        event("admin-browser", "onboarding_intro_view", 0),
        context,
      ),
    ).toBe(true);
    expect(
      isInternalAnalyticsEvent(
        event("qa-reset", "onboarding_intro_view", 0, {
          metadata: { traffic_kind: "internal" },
        }),
        context,
      ),
    ).toBe(true);
    expect(
      isInternalAnalyticsEvent(
        event("public-user", "onboarding_intro_view", 0),
        context,
      ),
    ).toBe(false);
  });

  test("keeps only unresolved failures in needs-attention counts", () => {
    const events = [
      event("fallback-user", "anonymous_auth_failed", 0, {
        errorCode: "sign_in_failed",
        errorMessage: "Anonymous sign-ins are disabled",
      }),
      event("no-session", "cat_gallery_restore_failed", 1, {
        errorCode: "AuthSessionMissingError",
        metadata: { has_session: false },
      }),
      event("ios-browser", "app_error", 1.5, {
        errorCode: "TypeError",
        errorMessage:
          "undefined is not an object (evaluating window.webkit.messageHandlers)",
      }),
      event("recovered-user", "evening_delivery_check_timeout", 2, {
        errorCode: "timeout",
        sessionId: "delivery-session",
      }),
      event("recovered-user", "evening_delivery_check_succeeded", 2.1, {
        sessionId: "delivery-session",
      }),
      event("blocked-user", "photo_upload_error", 3, {
        errorCode: "decode_failed",
      }),
    ];

    const issues = classifyAnalyticsIssues(events);
    const result = buildAdminAnalytics(events);

    expect(issues.expected).toHaveLength(3);
    expect(issues.recovered).toHaveLength(1);
    expect(issues.actionable).toHaveLength(1);
    expect(result.overview.find((item) => item.key === "needs_attention")).toMatchObject({
      users: 1,
      events: 1,
    });
  });

  test("separates new onboarding, returning, and handoff funnels", () => {
    const journeyId = "onbj_11111111-1111-4111-8111-111111111111";
    const events = [
      event("new-user", "onboarding_intro_view", 0),
      event("new-user", "onboarding_photo_select_click", 1),
      event("new-user", "onboarding_photo_submitted", 2),
      event("new-user", "onboarding_delivery_arrived", 3),
      event("new-user", "onboarding_delivery_opened", 4),
      event("new-user", "onboarding_completed", 5),
      event("returning-user", "onboarding_completed", 0),
      event("returning-user", "evening_delivery_reserved", 1, {
        metadata: { journey_id: journeyId },
      }),
      event("returning-user", "evening_delivery_check_started", 2),
      event("returning-user", "evening_delivery_check_succeeded", 3),
      event("returning-user", "envelope_shown", 4, { route: "/home", surface: "home" }),
      event("returning-user", "delivery_opened", 5),
      event("handoff-user", "onboarding_external_browser_handoff_created", 0, {
        metadata: { journey_id: journeyId },
      }),
      event("handoff-user", "route_viewed", 1, {
        route: "/onboarding/continue",
        surface: "onboarding",
        metadata: { journey_id: journeyId },
      }),
      event("handoff-user", "onboarding_handoff_restored", 2, {
        metadata: { journey_id: journeyId },
      }),
    ];

    const result = buildAdminAnalytics(events);

    expect(result.newOnboardingFunnel.slice(0, 6).map((step) => step.users)).toEqual([
      1, 1, 1, 1, 1, 1,
    ]);
    expect(result.returningFunnel.map((step) => step.users)).toEqual([1, 1, 1, 1, 1]);
    expect(result.handoffFunnel.map((step) => step.users)).toEqual([1, 1, 1, 0]);
  });

  test("treats expired handoff followed by app progress as recovered", () => {
    const journeyId = "onbj_22222222-2222-4222-8222-222222222222";
    const events = [
      event("handoff-user", "onboarding_handoff_restore_failed", 0, {
        errorCode: "handoff_expired",
        errorMessage: "handoff_expired",
        metadata: { journey_id: journeyId, error: "handoff_expired" },
        route: "/onboarding/continue",
        surface: "onboarding",
      }),
      event("handoff-user", "home_viewed", 1, {
        route: "/home",
        surface: "home",
      }),
      event("handoff-user", "delivery_opened", 2),
    ];

    const issues = classifyAnalyticsIssues(events);
    const result = buildAdminAnalytics(events);

    expect(issues.recovered).toHaveLength(1);
    expect(issues.actionable).toHaveLength(0);
    expect(result.overview.find((item) => item.key === "needs_attention")).toMatchObject({
      users: 0,
      events: 0,
    });
  });
});

function event(
  actorId: string,
  eventName: string,
  minuteOffset: number,
  options: {
    source?: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
    inAppBrowser?: boolean;
    sessionId?: string;
    submissionId?: string;
    route?: string;
    surface?: string;
  } = {},
): AdminAnalyticsEvent {
  return {
    event_name: eventName,
    source: options.source ?? "direct",
    anonymous_id: actorId,
    user_id: null,
    session_id: options.sessionId ?? `session-${actorId}`,
    submission_id: options.submissionId ?? null,
    route: options.route ?? (eventName.startsWith("onboarding_") ? "/onboarding" : "/home"),
    surface: options.surface ?? (eventName.startsWith("onboarding_") ? "onboarding" : "home"),
    is_in_app_browser: options.inAppBrowser ?? false,
    is_standalone_pwa: false,
    error_code: options.errorCode ?? null,
    error_message: options.errorMessage ?? null,
    metadata: options.metadata ?? {},
    created_at: new Date(BASE_TIME + minuteOffset * 60_000).toISOString(),
  };
}

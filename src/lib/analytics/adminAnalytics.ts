export type AnalyticsPeriodKey =
  | "launch"
  | "60m"
  | "today"
  | "yesterday"
  | "7d"
  | "28d";
export type AnalyticsAudience = "product" | "internal";

export const PUBLIC_LAUNCH_AT_ISO = "2026-07-17T08:00:00.000Z";

export type AdminAnalyticsEvent = {
  event_name: string;
  source: string | null;
  anonymous_id: string | null;
  user_id: string | null;
  session_id: string | null;
  submission_id: string | null;
  route: string | null;
  surface: string | null;
  is_in_app_browser: boolean | null;
  is_standalone_pwa: boolean | null;
  error_code: string | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type AnalyticsOperationalLevel = "ok" | "watch" | "action";

type AnalyticsIssueIncident = {
  key: string;
  actorId: string | null;
  eventName: string;
  errorCode: string | null;
  events: AdminAnalyticsEvent[];
  firstAt: string;
  latestAt: string;
  representativeEvent: AdminAnalyticsEvent;
};

const ISSUE_DEDUP_WINDOW_MS = 15_000;
const ISSUE_RECOVERY_WINDOW_MS = 30 * 60_000;
const ACTION_WINDOW_MS = 30 * 60_000;
const SPREAD_WINDOW_MS = 60 * 60_000;

type EventDefinition = {
  key: string;
  label: string;
  eventNames: readonly string[];
  surface?: string;
  route?: string;
};

const LAUNCH_FUNNEL_STEPS: readonly EventDefinition[] = [
  {
    key: "intro",
    label: "オンボを見た",
    eventNames: ["onboarding_intro_view"],
  },
  {
    key: "photo_picker",
    label: "写真をえらび始めた",
    eventNames: ["onboarding_photo_select_click"],
  },
  {
    key: "first_photo",
    label: "最初の写真を保存した",
    eventNames: ["onboarding_photo_submitted"],
  },
  {
    key: "instant_arrival",
    label: "最初のねこだよりが届いた",
    eventNames: ["onboarding_delivery_arrived"],
  },
  {
    key: "instant_open",
    label: "最初のねこだよりを開いた",
    eventNames: ["onboarding_delivery_opened"],
  },
  {
    key: "onboarding_complete",
    label: "オンボを終えた",
    eventNames: ["onboarding_completed"],
  },
  {
    key: "second_prompt",
    label: "今夜の一枚を見た",
    eventNames: ["onboarding_second_photo_prompt_view"],
  },
  {
    key: "second_photo",
    label: "今夜の一枚を保存した",
    eventNames: ["onboarding_second_photo_submitted"],
  },
];

const OVERVIEW_METRICS: readonly EventDefinition[] = [
  LAUNCH_FUNNEL_STEPS[0]!,
  LAUNCH_FUNNEL_STEPS[2]!,
  LAUNCH_FUNNEL_STEPS[3]!,
  LAUNCH_FUNNEL_STEPS[4]!,
  LAUNCH_FUNNEL_STEPS[7]!,
];

const DELIVERY_HEALTH_METRICS: readonly EventDefinition[] = [
  {
    key: "evening_reserved",
    label: "20時便に写真を入れた",
    eventNames: ["home_exchange_share_photo_confirmed"],
  },
  {
    key: "evening_check_started",
    label: "20時便の確認を開始",
    eventNames: ["evening_delivery_check_started"],
  },
  {
    key: "evening_check_succeeded",
    label: "20時便が成立",
    eventNames: ["evening_delivery_check_succeeded"],
  },
  {
    key: "evening_check_failed",
    label: "20時便の確認失敗",
    eventNames: ["evening_delivery_check_failed"],
  },
  {
    key: "evening_check_timeout",
    label: "20時便の確認が長時間化",
    eventNames: ["evening_delivery_check_timeout"],
  },
  {
    key: "evening_envelope",
    label: "20時便の封筒を表示",
    eventNames: ["envelope_shown"],
    route: "/home",
  },
  {
    key: "evening_opened",
    label: "20時便を開封",
    eventNames: ["delivery_opened"],
  },
  {
    key: "evening_target_repaired",
    label: "夜便予約を自動修復",
    eventNames: ["evening_delivery_target_repaired"],
  },
];

const INSTALL_METRICS: readonly EventDefinition[] = [
  {
    key: "install_invitation",
    label: "アプリ追加案内を表示",
    eventNames: ["home_install_invitation_viewed"],
  },
  {
    key: "install_action",
    label: "追加手順へ進んだ",
    eventNames: ["home_install_primary_clicked"],
  },
  {
    key: "install_completed",
    label: "ブラウザが追加完了を通知",
    eventNames: ["home_install_completed"],
  },
  {
    key: "standalone_open",
    label: "PWAとして起動",
    eventNames: ["pwa_display_mode_detected"],
  },
];

const CANONICAL_PHOTO_SUBMIT_EVENTS = new Set([
  "onboarding_photo_submitted",
  "home_exchange_share_photo_confirmed",
  "home_exchange_share_photo_declined",
]);

const SOURCE_ORDER = [
  "instagram_bio",
  "instagram_story",
  "instagram_dm",
  "instagram",
  "threads",
  "referral",
  "direct",
  "unknown",
];

export function buildAdminAnalytics(
  events: AdminAnalyticsEvent[],
  now = new Date(),
) {
  const issues = classifyAnalyticsIssues(events);
  const unresolvedIncidents = issues.incidents.actionable;

  return {
    overview: [
      ...OVERVIEW_METRICS.map((definition) =>
        buildMetric(events, definition),
      ),
      {
        key: "needs_attention",
        label: "未解決の識別ID",
        events: unresolvedIncidents.length,
        users: countIncidentActors(unresolvedIncidents),
      },
    ],
    funnel: buildOrderedFunnel(events),
    sourceBreakdown: buildSourceBreakdown(events),
    deliveryHealth: DELIVERY_HEALTH_METRICS.map((definition) =>
      buildMetric(events, definition),
    ),
    installHealth: INSTALL_METRICS.map((definition) => {
      if (definition.key !== "standalone_open") {
        return buildMetric(events, definition);
      }

      const standaloneEvents = events.filter(
        (event) =>
          matchesDefinition(event, definition) &&
          (readMetadataString(event, "display_mode") === "standalone" ||
            event.is_standalone_pwa === true),
      );
      return buildMetricFromRows(definition, standaloneEvents);
    }),
    environment: buildEnvironmentBreakdown(events),
    retention: buildRetention(events),
    operationalStatus: buildOperationalStatus(unresolvedIncidents, now),
    errorSummary: buildIncidentSummary(unresolvedIncidents),
    issueSummary: {
      recovered: buildIncidentSummary(issues.incidents.recovered),
      expected: buildErrorSummary(issues.expected),
    },
  };
}

export function readAnalyticsAudience(value: string | null): AnalyticsAudience {
  return value === "internal" ? "internal" : "product";
}

export function readAnalyticsPeriod(value: string | null): AnalyticsPeriodKey {
  return value === "launch" ||
    value === "60m" ||
    value === "yesterday" ||
    value === "7d" ||
    value === "28d"
    ? value
    : value === "today"
      ? "today"
      : "launch";
}

export function buildAnalyticsPeriodRange(
  period: AnalyticsPeriodKey,
  now = new Date(),
) {
  if (period === "launch") {
    const launchAt = new Date(PUBLIC_LAUNCH_AT_ISO);
    return {
      from: launchAt.getTime() < now.getTime() ? launchAt : now,
      to: now,
    };
  }

  if (period === "60m") {
    return { from: new Date(now.getTime() - 60 * 60 * 1000), to: now };
  }

  const todayStart = getJstDayStart(now);

  if (period === "yesterday") {
    return { from: addDays(todayStart, -1), to: todayStart };
  }

  if (period === "7d") {
    return { from: addDays(todayStart, -6), to: now };
  }

  if (period === "28d") {
    return { from: addDays(todayStart, -27), to: now };
  }

  return { from: todayStart, to: now };
}

export function isImpactEvent(event: AdminAnalyticsEvent) {
  return Boolean(
    event.error_code ||
      event.event_name.endsWith("_error") ||
      event.event_name.endsWith("_failed") ||
      event.event_name.endsWith("_blocked") ||
      event.event_name.endsWith("_timeout") ||
      event.event_name === "anonymous_auth_unavailable" ||
      event.event_name === "exchange_rejected_expired",
  );
}

export function classifyAnalyticsIssues(events: AdminAnalyticsEvent[]) {
  const expected: AdminAnalyticsEvent[] = [];
  const incidentCandidates: AdminAnalyticsEvent[] = [];

  for (const event of events) {
    if (!isImpactEvent(event)) {
      continue;
    }

    if (isExpectedOperationalEvent(event)) {
      expected.push(event);
      continue;
    }

    incidentCandidates.push(event);
  }

  const incidents = buildIssueIncidents(incidentCandidates);
  const recoveredIncidents: AnalyticsIssueIncident[] = [];
  const actionableIncidents: AnalyticsIssueIncident[] = [];

  for (const incident of incidents) {
    if (isRecoveredOperationalIncident(incident, events)) {
      recoveredIncidents.push(incident);
    } else {
      actionableIncidents.push(incident);
    }
  }

  const sortLatestFirst = (
    a: AnalyticsIssueIncident,
    b: AnalyticsIssueIncident,
  ) => Date.parse(b.latestAt) - Date.parse(a.latestAt);
  recoveredIncidents.sort(sortLatestFirst);
  actionableIncidents.sort(sortLatestFirst);

  return {
    actionable: actionableIncidents.flatMap((incident) => incident.events),
    recovered: recoveredIncidents.flatMap((incident) => incident.events),
    expected,
    incidents: {
      actionable: actionableIncidents,
      recovered: recoveredIncidents,
    },
  };
}

export function isInternalAnalyticsEvent(
  event: AdminAnalyticsEvent,
  {
    adminUserId,
    internalAnonymousIds,
  }: {
    adminUserId: string;
    internalAnonymousIds: ReadonlySet<string>;
  },
) {
  return Boolean(
    event.route?.startsWith("/admin") ||
      readMetadataString(event, "traffic_kind") === "internal" ||
      event.user_id === adminUserId ||
      (event.anonymous_id && internalAnonymousIds.has(event.anonymous_id)),
  );
}

function isExpectedOperationalEvent(event: AdminAnalyticsEvent) {
  if (
    event.event_name === "app_error" &&
    event.error_message
      ?.toLowerCase()
      .includes("window.webkit.messagehandlers")
  ) {
    return true;
  }

  if (
    event.event_name === "cat_gallery_restore_failed" &&
    event.metadata?.has_session === false
  ) {
    return true;
  }

  return Boolean(
    event.event_name === "anonymous_auth_failed" &&
      event.error_code === "sign_in_failed" &&
      event.error_message
        ?.toLowerCase()
        .includes("anonymous sign-ins are disabled"),
  );
}

function buildIssueIncidents(events: AdminAnalyticsEvent[]) {
  const incidents: AnalyticsIssueIncident[] = [];
  const latestByGroup = new Map<string, AnalyticsIssueIncident>();
  const sortedEvents = [...events].sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
  );

  for (const event of sortedEvents) {
    const issue = readLogicalIssue(event);
    const actorId = getActorId(event);
    const actorKey =
      actorId ??
      event.session_id ??
      event.submission_id ??
      `unattributed:${event.route ?? "unknown"}`;
    const groupKey = `${actorKey}:${issue.key}`;
    const latest = latestByGroup.get(groupKey);
    const eventAt = Date.parse(event.created_at);
    const latestAt = latest ? Date.parse(latest.latestAt) : Number.NaN;

    if (
      latest &&
      Number.isFinite(eventAt) &&
      Number.isFinite(latestAt) &&
      eventAt - latestAt >= 0 &&
      eventAt - latestAt <= ISSUE_DEDUP_WINDOW_MS
    ) {
      latest.events.push(event);
      latest.latestAt = event.created_at;
      if (
        event.error_message ||
        !latest.representativeEvent.error_message
      ) {
        latest.representativeEvent = event;
      }
      continue;
    }

    const incident: AnalyticsIssueIncident = {
      key: issue.key,
      actorId,
      eventName: issue.eventName,
      errorCode: issue.errorCode,
      events: [event],
      firstAt: event.created_at,
      latestAt: event.created_at,
      representativeEvent: event,
    };
    incidents.push(incident);
    latestByGroup.set(groupKey, incident);
  }

  return incidents;
}

function readLogicalIssue(event: AdminAnalyticsEvent) {
  if (
    event.event_name === "onboarding_delivery_blocked" ||
    (event.error_code === "onboarding_delivery_failed_after_photo_save" &&
      (event.event_name === "onboarding_delivery_error" ||
        event.event_name === "photo_upload_error"))
  ) {
    return {
      key: "onboarding_delivery_failure",
      eventName: "onboarding_delivery_failure",
      errorCode:
        event.error_code ??
        readMetadataString(event, "reason") ??
        "delivery_blocked",
    };
  }

  if (
    event.event_name === "evening_delivery_check_failed" ||
    event.event_name === "evening_delivery_check_timeout"
  ) {
    return {
      key: "evening_delivery_check_failure",
      eventName: "evening_delivery_check_failure",
      errorCode: event.error_code,
    };
  }

  return {
    key: `${event.event_name}:${event.error_code ?? "none"}`,
    eventName: event.event_name,
    errorCode: event.error_code,
  };
}

function isRecoveredOperationalIncident(
  incident: AnalyticsIssueIncident,
  events: AdminAnalyticsEvent[],
) {
  const recoveryEvents = getRecoveryEventNames(incident.eventName);
  if (recoveryEvents.length === 0) {
    return false;
  }

  const actorId = incident.actorId;
  const occurredAt = Date.parse(incident.latestAt);
  if (!actorId || !Number.isFinite(occurredAt)) {
    return false;
  }

  return events.some((candidate) => {
    if (
      !recoveryEvents.includes(candidate.event_name) ||
      getActorId(candidate) !== actorId
    ) {
      return false;
    }

    const recoveredAt = Date.parse(candidate.created_at);
    const recoveryMs = recoveredAt - occurredAt;
    return recoveryMs >= 0 && recoveryMs <= ISSUE_RECOVERY_WINDOW_MS;
  });
}

function getRecoveryEventNames(eventName: string) {
  if (
    eventName === "onboarding_delivery_failure" ||
    eventName === "onboarding_delivery_blocked"
  ) {
    return [
      "onboarding_delivery_arrived",
      "onboarding_delivery_opened",
      "onboarding_completed",
    ];
  }

  if (
    eventName === "evening_delivery_check_failure" ||
    eventName === "evening_delivery_check_failed" ||
    eventName === "evening_delivery_check_timeout"
  ) {
    return [
      "evening_delivery_check_succeeded",
      "envelope_shown",
      "delivery_opened",
    ];
  }

  if (eventName === "delivery_reveal_photo_error") {
    return ["delivery_reveal_photo_rendered"];
  }

  if (eventName === "onboarding_handoff_restore_failed") {
    return ["onboarding_handoff_restored"];
  }

  if (eventName === "photo_upload_error") {
    return [
      "onboarding_photo_submitted",
      "home_exchange_share_photo_confirmed",
      "home_exchange_share_photo_declined",
    ];
  }

  return [];
}

function buildMetric(
  events: AdminAnalyticsEvent[],
  definition: EventDefinition,
) {
  return buildMetricFromRows(
    definition,
    events.filter((event) => matchesDefinition(event, definition)),
  );
}

function buildMetricFromRows(
  definition: EventDefinition,
  rows: AdminAnalyticsEvent[],
) {
  return {
    key: definition.key,
    label: definition.label,
    events: rows.length,
    users: countUniqueActors(rows),
  };
}

function matchesDefinition(
  event: AdminAnalyticsEvent,
  definition: EventDefinition,
) {
  return (
    definition.eventNames.includes(event.event_name) &&
    (!definition.surface || event.surface === definition.surface) &&
    (!definition.route || event.route === definition.route)
  );
}

function buildOrderedFunnel(events: AdminAnalyticsEvent[]) {
  const eventsByActor = new Map<string, AdminAnalyticsEvent[]>();

  for (const event of events) {
    const actorId = getActorId(event);
    if (!actorId) {
      continue;
    }

    const actorEvents = eventsByActor.get(actorId) ?? [];
    actorEvents.push(event);
    eventsByActor.set(actorId, actorEvents);
  }

  const usersByStep = LAUNCH_FUNNEL_STEPS.map(() => 0);

  for (const actorEvents of eventsByActor.values()) {
    const chronological = [...actorEvents].sort(
      (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
    );
    let nextStep = 0;

    for (const event of chronological) {
      if (nextStep >= LAUNCH_FUNNEL_STEPS.length) {
        break;
      }

      if (matchesDefinition(event, LAUNCH_FUNNEL_STEPS[nextStep]!)) {
        usersByStep[nextStep] += 1;
        nextStep += 1;
      }
    }
  }

  return LAUNCH_FUNNEL_STEPS.map((definition, index) => {
    const users = usersByStep[index] ?? 0;
    const previousUsers = index > 0 ? usersByStep[index - 1] ?? 0 : null;
    const startUsers = usersByStep[0] ?? 0;

    return {
      key: definition.key,
      label: definition.label,
      users,
      events: events.filter((event) => matchesDefinition(event, definition)).length,
      previousUsers,
      fromPreviousRate:
        previousUsers && previousUsers > 0
          ? Math.round((users / previousUsers) * 1000) / 10
          : null,
      fromStartRate:
        startUsers > 0 ? Math.round((users / startUsers) * 1000) / 10 : null,
    };
  });
}

function buildSourceBreakdown(events: AdminAnalyticsEvent[]) {
  const sources = new Set(events.map(readAnalyticsSource));

  return [...sources]
    .map((source) => {
      const sourceEvents = events.filter(
        (event) => readAnalyticsSource(event) === source,
      );

      return {
        source,
        introUsers: countDefinitionUsers(sourceEvents, LAUNCH_FUNNEL_STEPS[0]!),
        submittedUsers: countDefinitionUsers(
          sourceEvents,
          LAUNCH_FUNNEL_STEPS[2]!,
        ),
        openedUsers: countDefinitionUsers(sourceEvents, LAUNCH_FUNNEL_STEPS[4]!),
        secondPhotoUsers: countDefinitionUsers(
          sourceEvents,
          LAUNCH_FUNNEL_STEPS[7]!,
        ),
      };
    })
    .filter(
      (row) =>
        row.introUsers > 0 ||
        row.submittedUsers > 0 ||
        row.openedUsers > 0 ||
        row.secondPhotoUsers > 0,
    )
    .sort((a, b) => {
      const aIndex = SOURCE_ORDER.indexOf(a.source);
      const bIndex = SOURCE_ORDER.indexOf(b.source);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
    });
}

function readAnalyticsSource(event: AdminAnalyticsEvent) {
  const sourceParam = readMetadataString(event, "source_param")?.toLowerCase();
  if (sourceParam === "threads") {
    return "threads";
  }
  return event.source ?? "unknown";
}

function countDefinitionUsers(
  events: AdminAnalyticsEvent[],
  definition: EventDefinition,
) {
  return countUniqueActors(
    events.filter((event) => matchesDefinition(event, definition)),
  );
}

function buildEnvironmentBreakdown(events: AdminAnalyticsEvent[]) {
  return {
    devices: buildValueBreakdown(events, (event) =>
      readMetadataString(event, "device_os") ?? "unknown",
    ),
    contexts: buildValueBreakdown(events, (event) => {
      const storedContext = readMetadataString(event, "browser_context");
      if (storedContext) {
        return storedContext;
      }
      if (event.is_standalone_pwa === true) {
        return "standalone";
      }
      if (event.is_in_app_browser === true) {
        return "embedded_unknown";
      }
      if (event.is_standalone_pwa === false && event.is_in_app_browser === false) {
        return "browser";
      }
      return "unknown";
    }),
  };
}

function buildValueBreakdown(
  events: AdminAnalyticsEvent[],
  readValue: (event: AdminAnalyticsEvent) => string,
) {
  const actorsByValue = new Map<string, Set<string>>();

  for (const event of events) {
    const actorId = getActorId(event);
    if (!actorId) {
      continue;
    }

    const value = readValue(event);
    const actors = actorsByValue.get(value) ?? new Set<string>();
    actors.add(actorId);
    actorsByValue.set(value, actors);
  }

  return [...actorsByValue.entries()]
    .map(([key, actors]) => ({ key, users: actors.size }))
    .sort((a, b) => b.users - a.users || a.key.localeCompare(b.key));
}

function buildRetention(events: AdminAnalyticsEvent[]) {
  const submissionsByActor = new Map<string, Set<string>>();
  const submitDaysByActor = new Map<string, Set<string>>();

  for (const event of events) {
    const actorId = getActorId(event);
    if (!actorId) {
      continue;
    }

    if (!CANONICAL_PHOTO_SUBMIT_EVENTS.has(event.event_name)) {
      continue;
    }

    const submissionKey = readSubmissionKey(event);
    const submissions = submissionsByActor.get(actorId) ?? new Set<string>();
    submissions.add(submissionKey);
    submissionsByActor.set(actorId, submissions);

    const day = toJstDateKey(new Date(event.created_at));
    const days = submitDaysByActor.get(actorId) ?? new Set<string>();
    days.add(day);
    submitDaysByActor.set(actorId, days);
  }

  const returningDaySubmitters = [...submitDaysByActor.values()].filter(
    (days) => days.size >= 2,
  ).length;
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
    photoSubmitters: submissionsByActor.size,
    repeatSubmitters: [...submissionsByActor.values()].filter(
      (submissions) => submissions.size >= 2,
    ).length,
    returningDaySubmitters,
    d1ReturnSubmitters,
  };
}

function readSubmissionKey(event: AdminAnalyticsEvent) {
  const submissionId =
    event.submission_id ?? readMetadataString(event, "submission_id");
  return submissionId
    ? `submission:${submissionId}`
    : `event:${event.event_name}:${event.created_at}`;
}

function buildOperationalStatus(
  incidents: AnalyticsIssueIncident[],
  now: Date,
) {
  const nowMs = now.getTime();
  const freshIncidents = incidents.filter((incident) =>
    isWithinRecentWindow(incident.latestAt, nowMs, ACTION_WINDOW_MS),
  );
  const spreadGroups = new Map<string, Set<string>>();

  for (const incident of incidents) {
    if (
      !incident.actorId ||
      !isWithinRecentWindow(incident.latestAt, nowMs, SPREAD_WINDOW_MS)
    ) {
      continue;
    }

    const actors = spreadGroups.get(incident.key) ?? new Set<string>();
    actors.add(incident.actorId);
    spreadGroups.set(incident.key, actors);
  }

  const spreadIssueCount = [...spreadGroups.values()].filter(
    (actors) => actors.size >= 2,
  ).length;
  const level: AnalyticsOperationalLevel =
    freshIncidents.length > 0 || spreadIssueCount > 0
      ? "action"
      : incidents.length > 0
        ? "watch"
        : "ok";
  const latestAt = incidents.reduce<string | null>((latest, incident) => {
    if (!latest || Date.parse(incident.latestAt) > Date.parse(latest)) {
      return incident.latestAt;
    }
    return latest;
  }, null);

  return {
    level,
    unresolvedIncidents: incidents.length,
    affectedActors: countIncidentActors(incidents),
    freshIncidents: freshIncidents.length,
    spreadIssueCount,
    latestAt,
  };
}

function isWithinRecentWindow(value: string, nowMs: number, windowMs: number) {
  const eventMs = Date.parse(value);
  if (!Number.isFinite(eventMs)) {
    return false;
  }

  const ageMs = nowMs - eventMs;
  return ageMs >= -5 * 60_000 && ageMs <= windowMs;
}

function buildIncidentSummary(incidents: AnalyticsIssueIncident[]) {
  const groups = new Map<
    string,
    {
      eventName: string;
      errorCode: string | null;
      incidents: number;
      events: number;
      actors: Set<string>;
      latestAt: string;
    }
  >();

  for (const incident of incidents) {
    const key = `${incident.eventName}:${incident.errorCode ?? "none"}`;
    const current = groups.get(key) ?? {
      eventName: incident.eventName,
      errorCode: incident.errorCode,
      incidents: 0,
      events: 0,
      actors: new Set<string>(),
      latestAt: incident.latestAt,
    };
    current.incidents += 1;
    current.events += incident.events.length;
    if (incident.actorId) {
      current.actors.add(incident.actorId);
    }
    if (Date.parse(incident.latestAt) > Date.parse(current.latestAt)) {
      current.latestAt = incident.latestAt;
    }
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      eventName: group.eventName,
      errorCode: group.errorCode,
      incidents: group.incidents,
      events: group.events,
      users: group.actors.size,
      latestAt: group.latestAt,
    }))
    .sort(
      (a, b) =>
        b.users - a.users ||
        b.incidents - a.incidents ||
        Date.parse(b.latestAt) - Date.parse(a.latestAt),
    );
}

function buildErrorSummary(events: AdminAnalyticsEvent[]) {
  const groups = new Map<
    string,
    {
      eventName: string;
      errorCode: string | null;
      events: number;
      actors: Set<string>;
      latestAt: string;
    }
  >();

  for (const event of events) {
    const key = `${event.event_name}:${event.error_code ?? "none"}`;
    const current = groups.get(key) ?? {
      eventName: event.event_name,
      errorCode: event.error_code,
      events: 0,
      actors: new Set<string>(),
      latestAt: event.created_at,
    };
    current.events += 1;
    const actorId = getActorId(event);
    if (actorId) {
      current.actors.add(actorId);
    }
    if (Date.parse(event.created_at) > Date.parse(current.latestAt)) {
      current.latestAt = event.created_at;
    }
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      eventName: group.eventName,
      errorCode: group.errorCode,
      events: group.events,
      users: group.actors.size,
      latestAt: group.latestAt,
    }))
    .sort(
      (a, b) =>
        b.users - a.users ||
        b.events - a.events ||
        Date.parse(b.latestAt) - Date.parse(a.latestAt),
    );
}

function readMetadataString(event: AdminAnalyticsEvent, key: string) {
  const value = event.metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function countUniqueActors(events: AdminAnalyticsEvent[]) {
  return new Set(events.map(getActorId).filter(Boolean)).size;
}

function countIncidentActors(incidents: AnalyticsIssueIncident[]) {
  return new Set(
    incidents.map((incident) => incident.actorId).filter(Boolean),
  ).size;
}

function getActorId(event: AdminAnalyticsEvent) {
  return event.user_id ? `user:${event.user_id}` : event.anonymous_id;
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

import { DiagnosisResult } from "../../components/diagnose/DiagnosisResult";
import { decideCategories } from "../../core/logic/decision";
import { calculateScores } from "../../core/logic/scoring";
import type {
  BehaviorInput,
  CauseCategory,
  DiagnosisContext,
} from "../../core/types";
import type { CalendarContext } from "../../lib/calendarContext";
import { buildCalendarContext } from "../../lib/calendarContext";
import type { CatTypeKey } from "../../lib/diagnosisOnboarding/types";
import {
  getRecentEvents,
  insertDiagnosis,
  type RecentEvent,
} from "../../lib/supabase/queries";

type DiagnosePageProps = {
  searchParams: Promise<{
    input?: string;
    event_id?: string;
    local_cat_id?: string;
    onboarding_type_key?: string;
    onboarding_modifiers?: string;
  }>;
};

const fixedContext: DiagnosisContext = {
  history: [],
  environment: [],
};

const validInputs: BehaviorInput[] = [
  "meowing",
  "following",
  "restless",
  "low_energy",
  "fighting",
];

const categoryLabels: Record<CauseCategory, string> = {
  food: "\u3054\u98ef",
  play: "\u904a\u3073",
  social: "\u304b\u307e\u3063\u3066\u307b\u3057\u3044",
  stress: "\u30b9\u30c8\u30ec\u30b9",
  health: "\u4f53\u8abf",
};

const diagnosisSaveErrorMessage =
  "\u8a3a\u65ad\u7d50\u679c\u306e\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\n\u753b\u9762\u306e\u8868\u793a\u306f\u7d9a\u3051\u3089\u308c\u307e\u3059\u304c\u3001\u8a18\u9332\u306b\u306f\u6b8b\u3063\u3066\u3044\u306a\u3044\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059\u3002";

export default async function DiagnosePage({ searchParams }: DiagnosePageProps) {
  const params = await searchParams;
  const input = parseInput(params.input);
  const localCatId = params.local_cat_id ?? null;
  const onboardingTypeKey = parseOnboardingTypeKey(params.onboarding_type_key);
  const onboardingModifiers = parseOnboardingModifiers(
    params.onboarding_modifiers,
  );

  if (!input) {
    return (
      <DiagnosisResult
        resultText={"\u307e\u3060\u5224\u65ad\u3067\u304d\u307e\u305b\u3093"}
        reasons={[
          "\u6c17\u306b\u306a\u308b\u3053\u3068\u3092\u3082\u3046\u4e00\u5ea6\u9078\u3093\u3067\u304f\u3060\u3055\u3044",
        ]}
        categories={[]}
        diagnosisId={null}
        input={undefined}
        localCatId={localCatId}
      />
    );
  }

  const recentEvents = await getRecentEvents(localCatId);
  const calendarContext = buildCalendarContext();
  const diagnosisContext = buildDiagnosisContext(
    recentEvents,
    calendarContext.timeBand,
  );
  const scores = calculateScores(input, diagnosisContext);
  const onboardingAdjustment = applyOnboardingTypeAdjustment(
    scores,
    input,
    onboardingTypeKey,
  );
  const categories = decideCategories(scores);

  const diagnosis = params.event_id
    ? await insertDiagnosis({
        event_id: params.event_id,
        input_signal: input,
        scores,
        selected_categories: categories,
        primary_category: categories[0],
        secondary_category: categories[1] ?? null,
        context: diagnosisContext,
        calendarContext,
        localCatId,
        // TODO: Stabilize persistence with an API Route, Server Action,
        // or deduplication key to avoid duplicate rows during render/reload.
      })
    : null;

  if (!params.event_id) {
    console.warn("diagnosis not saved: missing event_id");
  }

  if (params.event_id && !diagnosis) {
    console.error("diagnosis save failed");
  }

  return (
    <DiagnosisResult
      resultText={formatResultText(categories)}
      reasons={formatReasons(
        input,
        calendarContext.timeBand,
        onboardingAdjustment?.reason,
        onboardingModifiers,
      )}
      categories={categories}
      diagnosisId={diagnosis?.id ?? null}
      input={input}
      localCatId={localCatId}
      persistenceMessage={
        params.event_id && !diagnosis ? diagnosisSaveErrorMessage : undefined
      }
    />
  );
}

function parseInput(input: string | undefined): BehaviorInput | undefined {
  return validInputs.includes(input as BehaviorInput)
    ? (input as BehaviorInput)
    : undefined;
}

function parseOnboardingTypeKey(
  typeKey: string | undefined,
): CatTypeKey | undefined {
  const legacyTypeMap: Record<string, CatTypeKey> = {
    play: "leone",
    food: "sole",
    social: "luna",
    stress: "aura",
    balanced: "stella",
  };
  const validTypeKeys: CatTypeKey[] = [
    "luce",
    "fiore",
    "leone",
    "nimbus",
    "sole",
    "luna",
    "stella",
    "aura",
  ];
  const migratedTypeKey = typeKey ? legacyTypeMap[typeKey] ?? typeKey : undefined;

  return validTypeKeys.includes(migratedTypeKey as CatTypeKey)
    ? (migratedTypeKey as CatTypeKey)
    : undefined;
}

function parseOnboardingModifiers(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((modifier) => modifier.trim())
    .filter(Boolean)
    .slice(0, 2);
}

function buildDiagnosisContext(
  recentEvents: RecentEvent[],
  timeBand: CalendarContext["timeBand"],
): DiagnosisContext {
  const lastFoodMinutes = getLastElapsedMinutes(recentEvents, isFoodEvent);
  const lastPlayMinutes = getLastElapsedMinutes(recentEvents, isPlayEvent);
  const time = mapTimeBandToDiagnosisTime(timeBand);

  if (lastFoodMinutes === undefined && lastPlayMinutes === undefined) {
    return {
      ...fixedContext,
      time,
    };
  }

  return {
    ...fixedContext,
    time,
    lastFoodMinutes,
    lastPlayMinutes,
  };
}

function mapTimeBandToDiagnosisTime(
  timeBand: CalendarContext["timeBand"],
): DiagnosisContext["time"] {
  if (timeBand === "night") {
    return "night";
  }

  if (timeBand === "late_night") {
    return "late_night";
  }

  if (timeBand === "early_morning" || timeBand === "morning") {
    return "morning";
  }

  return undefined;
}

function getLastElapsedMinutes(
  recentEvents: RecentEvent[],
  predicate: (event: RecentEvent) => boolean,
) {
  const event = recentEvents.find(predicate);

  if (!event) {
    return undefined;
  }

  const occurredAt = new Date(event.occurred_at).getTime();

  if (Number.isNaN(occurredAt)) {
    return undefined;
  }

  return Math.max(0, Math.floor((Date.now() - occurredAt) / 60000));
}

function isFoodEvent(event: RecentEvent) {
  return (
    event.signal === "after_food" ||
    event.label === "\u3054\u98ef\u305f\u3079\u305f"
  );
}

function isPlayEvent(event: RecentEvent) {
  return event.signal === "playing" || event.label === "\u904a\u3093\u3067\u308b";
}

function formatResultText(categories: CauseCategory[]) {
  const labels = categories.map((category) => categoryLabels[category]);

  if (labels.length === 1) {
    return `${labels[0]}\u306e\u53ef\u80fd\u6027\u304c\u9ad8\u3044\u3067\u3059`;
  }

  return `${labels.join("\u30fb")}\u306e\u53ef\u80fd\u6027\u304c\u3042\u308a\u307e\u3059`;
}

function formatReasons(
  input: BehaviorInput,
  timeBand: CalendarContext["timeBand"],
  onboardingReason?: string,
  onboardingModifiers: string[] = [],
) {
  const reasons: Record<BehaviorInput, string[]> = {
    meowing: [
      getMeowingTimeReason(timeBand),
      "鳴いているときは、ご飯やかまってほしい気持ちも重なることがあります",
    ],
    following: [
      "ついてくるときは、かまってほしい気持ちがあるかもしれません",
      "朝は、人との関わりが増えやすい時間です",
    ],
    restless: [
      "落ち着かない様子は、遊びたいときにも見られることがあります",
      "周囲の刺激で、少し緊張している可能性もあります",
    ],
    low_energy: [
      "元気がないときは、体調の変化を先に見ておくと安心です",
    ],
    fighting: [
      "ケンカは、緊張やストレスが高いときに起きることがあります",
    ],
  };

  const nextReasons = [...reasons[input]];

  if (onboardingReason) {
    nextReasons.push(onboardingReason);
  }

  const healthModifierReason = getHealthModifierReason(onboardingModifiers);

  if (healthModifierReason && input === "low_energy") {
    nextReasons.push(healthModifierReason);
  }

  return nextReasons.slice(0, 3);
}

function applyOnboardingTypeAdjustment(
  scores: Record<CauseCategory, number>,
  input: BehaviorInput,
  typeKey: CatTypeKey | undefined,
) {
  if (!typeKey || typeKey === "stella") {
    return null;
  }

  const adjustment = getOnboardingTypeAdjustment(input, typeKey);

  if (!adjustment) {
    return null;
  }

  scores[adjustment.category] += 0.5;

  return adjustment;
}

function getOnboardingTypeAdjustment(
  input: BehaviorInput,
  typeKey: Exclude<CatTypeKey, "stella">,
): { category: CauseCategory; reason: string } | null {
  if (
    ["luce", "fiore", "leone", "nimbus"].includes(typeKey) &&
    (input === "meowing" || input === "restless")
  ) {
    return {
      category: "play",
      reason:
        "これまでの回答では、遊びへの反応が少し出やすいようです。",
    };
  }

  if (typeKey === "sole" && input === "meowing") {
    return {
      category: "food",
      reason:
        "これまでの回答では、ごはんまわりに反応しやすい傾向がありそうです。",
    };
  }

  if (
    ["luce", "fiore", "sole", "luna"].includes(typeKey) &&
    (input === "following" || input === "meowing")
  ) {
    return {
      category: "social",
      reason:
        "これまでの回答では、人との距離に反応しやすい傾向がありそうです。",
    };
  }

  if (
    ["fiore", "nimbus", "luna", "aura"].includes(typeKey) &&
    (input === "restless" || input === "fighting")
  ) {
    return {
      category: "stress",
      reason:
        "これまでの回答では、環境の変化に反応しやすい傾向がありそうです。",
    };
  }

  return null;
}

function getHealthModifierReason(modifiers: string[]) {
  const healthModifiers = ["食欲ムラ", "トイレ変化注意", "体調変化出やすい"];

  if (!modifiers.some((modifier) => healthModifiers.includes(modifier))) {
    return null;
  }

  return "これまでの回答では、体調やトイレまわりも少し丁寧に見てあげるとよさそうです。";
}

function getMeowingTimeReason(timeBand: CalendarContext["timeBand"]) {
  if (timeBand === "night") {
    return "夜は、遊びたい気持ちが出やすいことがあります";
  }

  if (timeBand === "late_night") {
    return "夜遅い時間は、安心したくて鳴くことがあります";
  }

  if (timeBand === "early_morning" || timeBand === "morning") {
    return "朝は、ごはんやかまってほしい気持ちが出やすいことがあります";
  }

  if (timeBand === "evening") {
    return "夕方は、遊びやごはんを期待して鳴くことがあります";
  }

  return "日中は、かまってほしい気持ちで鳴くことがあります";
}

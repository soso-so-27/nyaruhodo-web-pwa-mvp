import type {
  OnboardingOptionDefinition,
  OnboardingQuestionDefinition,
  OnboardingZone,
  ScoreInput,
} from "./types";

function option(
  optionId: string,
  label: string,
  score: ScoreInput = {},
  modifierCandidates: string[] = [],
): OnboardingOptionDefinition {
  return { optionId, label, score, modifierCandidates };
}

function question(
  questionId: string,
  zone: OnboardingZone,
  text: string,
  options: OnboardingOptionDefinition[],
): OnboardingQuestionDefinition {
  return {
    questionId,
    zone,
    question: text,
    options,
    skippable: true,
  };
}

export const DIAGNOSIS_ONBOARDING_QUESTIONS = [
  question("q01_recent_behavior", "immediate", "最近、気になる行動はどれですか？", [
    option("meowing", "鳴いてる", { social: 2, food: 1, play: 1 }),
    option("following", "ついてくる", { social: 2 }, ["ひとり時間苦手"]),
    option("restless", "落ち着かない", { stress: 2, play: 1 }, [
      "音に敏感",
      "環境変化に敏感",
    ]),
    option("low_energy", "元気ない", { health: 2 }, ["体調変化出やすい"]),
    option("unknown", "よくわからない"),
  ]),
  question("q02_play_response", "immediate", "遊びにはどれくらい反応しますか？", [
    option("quick", "すぐ反応する", { play: 3 }, ["遊び不足で爆発"]),
    option("sometimes", "ときどき反応する", { play: 1, social: 1 }),
    option("rarely", "あまり反応しない", { stress: 1, health: 1 }, [
      "体調変化出やすい",
    ]),
    option("unknown", "わからない"),
  ]),
  question("q03_food_sensitivity", "immediate", "ごはんの時間に敏感ですか？", [
    option("very", "とても敏感", { food: 3 }, ["ごはん時間に敏感"]),
    option("somewhat", "少し敏感", { food: 2 }, ["ごはん時間に敏感"]),
    option("not_much", "あまり気にしない", { social: 1, play: 1 }),
    option("unknown", "わからない"),
  ]),
  question("q04_following", "type_accuracy", "家の中であとをついてくることはありますか？", [
    option("often", "よくある", { social: 3 }, ["ひとり時間苦手"]),
    option("sometimes", "ときどきある", { social: 2 }),
    option("rarely", "あまりない", { stress: 1 }, ["ひとり時間平気"]),
    option("unknown", "わからない"),
  ]),
  question("q05_zoomies", "type_accuracy", "急に走り回ることはありますか？", [
    option("often", "よくある", { play: 2, stress: 1 }, ["遊び不足で爆発"]),
    option("night", "夜によくある", { play: 2 }, ["夜に元気"]),
    option("rarely", "あまりない", { social: 1 }),
    option("unknown", "わからない"),
  ]),
  question("q06_night_activity", "type_accuracy", "夜に元気になることはありますか？", [
    option("often", "よくある", { play: 2, social: 1 }, ["夜に元気"]),
    option("sometimes", "ときどきある", { play: 1 }, ["夜に元気"]),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q07_food_interest", "type_accuracy", "ごはんの食いつきはどうですか？", [
    option("good", "いつもよい", { food: 2 }, ["ごはん時間に敏感"]),
    option("varies", "日によって変わる", { food: 1, health: 1 }, ["食欲ムラ"]),
    option("low", "あまりよくない", { health: 2 }, ["食欲ムラ"]),
    option("unknown", "わからない"),
  ]),
  question("q08_touch_preference", "type_accuracy", "なでられるのは好きそうですか？", [
    option("likes", "好きそう", { social: 2 }),
    option("depends", "気分による", { social: 1, stress: 1 }, ["甘えに波"]),
    option("dislikes", "あまり好きではなさそう", { stress: 2 }, [
      "音に敏感",
      "環境変化に敏感",
    ]),
    option("unknown", "わからない"),
  ]),
  question(
    "q09_environment_reaction",
    "type_accuracy",
    "いつもと違う音や環境に反応しやすいですか？",
    [
      option("very", "とても反応する", { stress: 3 }, [
        "音に敏感",
        "環境変化に敏感",
      ]),
      option("somewhat", "少し反応する", { stress: 2 }, ["音に敏感"]),
      option("rarely", "あまり気にしない", { social: 1 }, ["ひとり時間平気"]),
      option("unknown", "わからない"),
    ],
  ),
  question("q10_alone_time", "type_accuracy", "ひとりで過ごす時間は平気そうですか？", [
    option("fine", "平気そう", { stress: 1 }, ["ひとり時間平気"]),
    option("somewhat_bad", "少し苦手そう", { social: 2 }, ["ひとり時間苦手"]),
    option("bad", "かなり苦手そう", { social: 3, stress: 1 }, [
      "ひとり時間苦手",
    ]),
    option("unknown", "わからない"),
  ]),
  question("q11_settling", "type_accuracy", "落ち着くまでに時間がかかることはありますか？", [
    option("often", "よくある", { stress: 3 }, ["回復に時間がかかる"]),
    option("sometimes", "ときどきある", { stress: 2 }, ["回復に時間がかかる"]),
    option("rarely", "あまりない", { social: 1 }),
    option("unknown", "わからない"),
  ]),
  question("q12_grooming", "type_accuracy", "毛づくろいの様子で気になることはありますか？", [
    option("often", "よく毛づくろいしている", { stress: 1 }),
    option("increased", "増えた気がする", { stress: 2, health: 1 }, [
      "体調変化出やすい",
    ]),
    option("less", "少ない気がする", { health: 1 }, ["体調変化出やすい"]),
    option("unknown", "わからない"),
  ]),
  question("q13_toilet_change", "type_accuracy", "トイレの変化が気になることはありますか？", [
    option("often", "よく気になる", { health: 3 }, ["トイレ変化注意"]),
    option("sometimes", "ときどき気になる", { health: 2 }, ["トイレ変化注意"]),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q14_energy_level", "type_accuracy", "ふだんの元気さはどうですか？", [
    option("active", "よく動く", { play: 2 }),
    option("calm", "落ち着いている", { social: 1 }),
    option("low", "少し元気がない日がある", { health: 2 }, [
      "体調変化出やすい",
    ]),
    option("unknown", "わからない"),
  ]),
  question("q15_sleep_time", "type_accuracy", "寝ている時間は長い方ですか？", [
    option("long", "長い方だと思う", { health: 1 }),
    option("normal", "いつも通りだと思う", { social: 1 }),
    option("short", "短い気がする", { play: 1, stress: 1 }, ["夜に元気"]),
    option("unknown", "わからない"),
  ]),
  question("q16_active_time", "understanding", "元気になりやすい時間帯はありますか？", [
    option("morning", "朝が多い", { social: 1 }, ["朝に甘えやすい"]),
    option("evening", "夕方から夜が多い", { play: 2 }, ["夜に元気"]),
    option("varies", "日によって違う", { stress: 1 }, ["甘えに波"]),
    option("unknown", "わからない"),
  ]),
  question("q17_meal_interval", "understanding", "食事の間隔が空くと変化がありますか？", [
    option("very", "かなりある", { food: 3 }, ["ごはん時間に敏感"]),
    option("somewhat", "少しある", { food: 2 }),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q18_play_shortage", "understanding", "遊び足りないと変化が出ますか？", [
    option("yes", "出やすい", { play: 3 }, ["遊び不足で爆発"]),
    option("sometimes", "ときどき出る", { play: 2 }),
    option("no", "あまり出ない"),
    option("unknown", "わからない"),
  ]),
  question("q19_affection_style", "understanding", "甘え方に波はありますか？", [
    option("strong", "かなりある", { social: 2, stress: 1 }, ["甘えに波"]),
    option("some", "少しある", { social: 1 }, ["甘えに波"]),
    option("stable", "わりと安定している", { social: 1 }),
    option("unknown", "わからない"),
  ]),
  question("q20_noise_sensitivity", "understanding", "大きな音に驚きやすいですか？", [
    option("very", "とても驚きやすい", { stress: 3 }, ["音に敏感"]),
    option("somewhat", "少し驚きやすい", { stress: 2 }),
    option("rarely", "あまり気にしない"),
    option("unknown", "わからない"),
  ]),
  question("q21_toilet_detail", "understanding", "トイレ後の様子で気になることはありますか？", [
    option("yes", "ある", { health: 3 }, ["トイレ変化注意"]),
    option("sometimes", "ときどきある", { health: 2 }),
    option("no", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q22_health_signal", "understanding", "体調の変化が行動に出やすい方ですか？", [
    option("yes", "出やすい", { health: 3 }, ["体調変化出やすい"]),
    option("some", "少し出る", { health: 2 }),
    option("no", "あまり出ない"),
    option("unknown", "わからない"),
  ]),
  question("q23_family_relation", "understanding", "家族によって反応が変わりますか？", [
    option("yes", "よく変わる", { social: 2, stress: 1 }),
    option("some", "少し変わる", { social: 1 }),
    option("no", "あまり変わらない"),
    option("unknown", "わからない"),
  ]),
  question("q24_staying_home", "understanding", "留守番のあとに変化がありますか？", [
    option("yes", "出やすい", { social: 2, stress: 1 }, ["ひとり時間苦手"]),
    option("some", "少しある", { social: 1 }),
    option("no", "あまりない", {}, ["ひとり時間平気"]),
    option("unknown", "わからない"),
  ]),
  question("q25_photo_memory", "understanding", "写真やメモで残したい様子はありますか？", [
    option("often", "よくある", { social: 1, play: 1 }),
    option("sometimes", "ときどきある", { social: 1 }),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q26_rhythm", "understanding", "生活リズムに合わせて行動が変わりますか？", [
    option("yes", "変わりやすい", { food: 1, social: 1 }, ["ごはん時間に敏感"]),
    option("some", "少し変わる", { social: 1 }),
    option("no", "あまり変わらない"),
    option("unknown", "わからない"),
  ]),
  question("q27_stress_sign", "understanding", "ストレスっぽいサインは見えますか？", [
    option("often", "よく見える", { stress: 3 }, ["環境変化に敏感"]),
    option("sometimes", "ときどき見える", { stress: 2 }),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q28_recovery", "understanding", "一度落ち着かないとき、戻りやすいですか？", [
    option("quick", "戻りやすい", { social: 1 }),
    option("slow", "少し時間がかかる", { stress: 2 }, ["回復に時間がかかる"]),
    option("varies", "日による", { stress: 1 }, ["甘えに波"]),
    option("unknown", "わからない"),
  ]),
  question("q29_attention_sign", "understanding", "かまってほしい時のサインは分かりますか？", [
    option("clear", "わかりやすい", { social: 3 }),
    option("some", "少しわかる", { social: 2 }),
    option("hard", "まだわかりにくい", { stress: 1 }),
    option("unknown", "わからない"),
  ]),
  question("q30_common_trouble", "understanding", "よく困ることはありますか？", [
    option("meowing", "鳴き声で迷う", { social: 1, food: 1, play: 1 }),
    option("restless", "落ち着かなさで迷う", { stress: 2 }),
    option("health", "体調サインで迷う", { health: 2 }, ["体調変化出やすい"]),
    option("unknown", "まだわからない"),
  ]),
] as const satisfies OnboardingQuestionDefinition[];

export const ONBOARDING_QUESTIONS = DIAGNOSIS_ONBOARDING_QUESTIONS;
export const TOTAL_ONBOARDING_QUESTIONS = DIAGNOSIS_ONBOARDING_QUESTIONS.length;

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
    option("bad", "かなり苦手そう", { social: 3, stress: 1 }, ["ひとり時間苦手"]),
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
    option("normal", "あまり気にならない"),
    option("unknown", "わからない"),
  ]),
  question("q13_toilet_change", "type_accuracy", "トイレの様子に変化を感じることはありますか？", [
    option("yes", "ある", { health: 3 }, ["トイレ変化注意"]),
    option("sometimes", "ときどきある", { health: 2 }, ["トイレ変化注意"]),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q14_energy_level", "type_accuracy", "ふだんの元気さはどうですか？", [
    option("high", "元気いっぱい", { play: 2 }, ["遊び不足で爆発"]),
    option("normal", "ふつう"),
    option("varies", "元気に波がある", { health: 1, stress: 1 }, [
      "体調変化出やすい",
    ]),
    option("unknown", "わからない"),
  ]),
  question("q15_sleep_amount", "type_accuracy", "睡眠時間は多い方だと感じますか？", [
    option("much", "多い方", { health: 1 }, ["体調変化出やすい"]),
    option("normal", "ふつう"),
    option("little", "少ない方", { play: 1, stress: 1 }, ["夜に元気"]),
    option("unknown", "わからない"),
  ]),
  question("q16_active_time_band", "understanding", "元気になりやすい時間帯はありますか？", [
    option("morning", "朝", { social: 1, food: 1 }, ["朝に甘えやすい"]),
    option("daytime", "昼", { play: 1 }),
    option("night", "夜", { play: 2 }, ["夜に元気"]),
    option("unknown", "わからない"),
  ]),
  question(
    "q17_meal_interval_reaction",
    "understanding",
    "ごはんから時間が空くと、様子が変わりやすいですか？",
    [
      option("yes", "変わりやすい", { food: 3 }, ["ごはん時間に敏感"]),
      option("somewhat", "少し変わる", { food: 2 }, ["ごはん時間に敏感"]),
      option("rarely", "あまり変わらない"),
      option("unknown", "わからない"),
    ],
  ),
  question("q18_play_shortage", "understanding", "遊びの時間が少ない日は、様子が変わりますか？", [
    option("much", "かなり変わる", { play: 3 }, ["遊び不足で爆発"]),
    option("somewhat", "少し変わる", { play: 2 }, ["遊び不足で爆発"]),
    option("rarely", "あまり変わらない"),
    option("unknown", "わからない"),
  ]),
  question("q19_affection_style", "understanding", "甘え方に波はありますか？", [
    option("much", "かなりある", { social: 2, stress: 1 }, ["甘えに波"]),
    option("somewhat", "少しある", { social: 1 }, ["甘えに波"]),
    option("rarely", "あまりない", { social: 1 }),
    option("unknown", "わからない"),
  ]),
  question("q20_sound_sensitivity", "understanding", "大きな音や急な音にびっくりしやすいですか？", [
    option("yes", "しやすい", { stress: 3 }, ["音に敏感"]),
    option("somewhat", "少ししやすい", { stress: 2 }, ["音に敏感"]),
    option("rarely", "あまりしない"),
    option("unknown", "わからない"),
  ]),
  question("q21_litter_detail", "understanding", "トイレの回数や様子を気にして見ていますか？", [
    option("often", "よく見ている", { health: 1 }, ["トイレ変化注意"]),
    option("sometimes", "ときどき見ている", { health: 1 }),
    option("rarely", "あまり見ていない"),
    option("unknown", "わからない"),
  ]),
  question("q22_health_signals", "understanding", "体調の変化が行動に出やすいと感じますか？", [
    option("yes", "出やすい", { health: 3 }, ["体調変化出やすい"]),
    option("somewhat", "少し出る", { health: 2 }, ["体調変化出やすい"]),
    option("rarely", "あまり感じない"),
    option("unknown", "わからない"),
  ]),
  question("q23_family_reaction", "understanding", "家族の中で、反応が違う相手はいますか？", [
    option("yes", "いる", { social: 2 }, ["家族で反応が違う"]),
    option("somewhat", "少しいる", { social: 1 }, ["家族で反応が違う"]),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q24_after_absence", "understanding", "留守番のあと、甘えたり鳴いたりしますか？", [
    option("often", "よくある", { social: 3 }, ["留守番後に甘えやすい"]),
    option("sometimes", "ときどきある", { social: 2 }, ["留守番後に甘えやすい"]),
    option("rarely", "あまりない", {}, ["ひとり時間平気"]),
    option("unknown", "わからない"),
  ]),
  question("q25_photo_or_notes", "understanding", "写真やメモで残しておきたい行動はありますか？", [
    option("often", "よくある", { health: 1, stress: 1 }, ["体調変化出やすい"]),
    option("sometimes", "ときどきある", { social: 1 }),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q26_daily_rhythm", "understanding", "生活リズムが変わると、猫の様子も変わりますか？", [
    option("yes", "変わりやすい", { stress: 2, social: 1 }, ["環境変化に敏感"]),
    option("somewhat", "少し変わる", { stress: 1 }, ["環境変化に敏感"]),
    option("rarely", "あまり変わらない"),
    option("unknown", "わからない"),
  ]),
  question("q27_stress_signs", "understanding", "ストレスっぽいサインを感じることはありますか？", [
    option("often", "よくある", { stress: 3 }, ["環境変化に敏感", "音に敏感"]),
    option("sometimes", "ときどきある", { stress: 2 }),
    option("rarely", "あまりない"),
    option("unknown", "わからない"),
  ]),
  question("q28_recovery_speed", "understanding", "びっくりしたあと、戻るまでの時間はどうですか？", [
    option("quick", "すぐ戻る"),
    option("some_time", "少し時間がかかる", { stress: 1 }, ["回復に時間がかかる"]),
    option("long_time", "かなり時間がかかる", { stress: 2 }, ["回復に時間がかかる"]),
    option("unknown", "わからない"),
  ]),
  question("q29_attention_signs", "understanding", "かまってほしい時のサインは分かりやすいですか？", [
    option("clear", "分かりやすい", { social: 3 }),
    option("somewhat", "少し分かる", { social: 2 }),
    option("unclear", "分かりにくい", { stress: 1 }, ["甘えに波"]),
    option("unknown", "わからない"),
  ]),
  question("q30_common_concern", "understanding", "よくある困りごとはどれに近いですか？", [
    option("meowing", "鳴くこと", { social: 2, food: 1 }),
    option("restless", "落ち着かないこと", { stress: 2, play: 1 }, [
      "音に敏感",
      "環境変化に敏感",
    ]),
    option("food_or_toilet", "ごはんやトイレ", { food: 1, health: 2 }, [
      "食欲ムラ",
      "トイレ変化注意",
    ]),
    option("none", "特にない"),
  ]),
] satisfies OnboardingQuestionDefinition[];

export const ONBOARDING_QUESTIONS = DIAGNOSIS_ONBOARDING_QUESTIONS;

export const TOTAL_ONBOARDING_QUESTIONS = DIAGNOSIS_ONBOARDING_QUESTIONS.length;

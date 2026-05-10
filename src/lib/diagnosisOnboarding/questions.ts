export type AnswerOption = {
  label: string;
  scores: Partial<Record<"P" | "C" | "S" | "I" | "B" | "N", number>>;
  // 行動・時間情報
  peakTime?: "morning" | "afternoon" | "evening" | "night" | "random";
  foodSensitivity?: "high" | "medium" | "low";
  stressSensitivity?: "high" | "medium" | "low";
};

export type Question = {
  id: string;
  text: string; // 例：「ふだんの{name}は？」
  options: AnswerOption[];
};

// {name} はレンダリング時に猫の名前に置換する
export const QUESTIONS: Question[] = [
  // === STEP2：即判定3問 ===
  {
    id: "q1_activity",
    text: "ふだんの{name}は？",
    options: [
      { label: "よく動き回っている", scores: { P: 2 } },
      { label: "遊ぶときは遊ぶ、寝るときは寝る", scores: { P: 1, C: 1 } },
      { label: "だいたいどこかで寝ている", scores: { C: 2 } },
      { label: "気まぐれでよくわからない", scores: { P: 1, C: 1 } },
    ],
  },
  {
    id: "q2_social",
    text: "なでたとき、{name}はどうする？",
    options: [
      { label: "ゴロゴロしてもっと要求してくる", scores: { S: 2 } },
      { label: "しばらくは受け入れるが、そのうち去る", scores: { S: 1, I: 1 } },
      { label: "気分次第", scores: { S: 1, I: 1 } },
      { label: "さっと逃げる", scores: { I: 2 } },
    ],
  },
  {
    id: "q3_nervous",
    text: "知らない人が来たとき、{name}は？",
    options: [
      { label: "興味津々で近づいていく", scores: { B: 2 } },
      { label: "様子を見てから近づく", scores: { B: 1, N: 1 } },
      { label: "遠くから観察する", scores: { N: 1 } },
      { label: "すぐ隠れる", scores: { N: 2 } },
    ],
  },

  // === STEP4：精度アップ5問 ===
  {
    id: "q4_time",
    text: "{name}が一番元気な時間帯は？",
    options: [
      {
        label: "朝",
        scores: { P: 1 },
        peakTime: "morning",
      },
      {
        label: "昼",
        scores: { C: 1 },
        peakTime: "afternoon",
      },
      {
        label: "夕方〜夜",
        scores: { P: 1 },
        peakTime: "evening",
      },
      {
        label: "気まぐれ",
        scores: {},
        peakTime: "random",
      },
    ],
  },
  {
    id: "q5_play",
    text: "遊びに誘うと？",
    options: [
      { label: "すぐ全力で反応", scores: { P: 2 } },
      { label: "気分が乗ればやる", scores: { P: 1 } },
      { label: "ちょっとだけ付き合う", scores: { C: 1 } },
      { label: "基本乗り気じゃない", scores: { C: 2 } },
    ],
  },
  {
    id: "q6_food",
    text: "ごはんの時間、{name}は？",
    options: [
      {
        label: "時間前からアピールしてくる",
        scores: { P: 1 },
        foodSensitivity: "high",
      },
      {
        label: "時間になったら来る",
        scores: {},
        foodSensitivity: "medium",
      },
      {
        label: "あまり気にしていない",
        scores: { C: 1 },
        foodSensitivity: "low",
      },
    ],
  },
  {
    id: "q7_attach",
    text: "あなたがソファにいるとき、{name}は？",
    options: [
      { label: "必ず隣に来る", scores: { S: 2 } },
      { label: "近くにいるが触れない距離", scores: { S: 1 } },
      { label: "別の場所にいる", scores: { I: 2 } },
      { label: "気分次第", scores: { S: 1, I: 1 } },
    ],
  },
  {
    id: "q8_stress",
    text: "突然大きな音がしたとき、{name}は？",
    options: [
      {
        label: "ほとんど気にしない",
        scores: { B: 2 },
        stressSensitivity: "low",
      },
      {
        label: "一瞬反応するがすぐ戻る",
        scores: { B: 1 },
        stressSensitivity: "medium",
      },
      {
        label: "しばらくビクビクしている",
        scores: { N: 1 },
        stressSensitivity: "high",
      },
      {
        label: "どこかに隠れる",
        scores: { N: 2 },
        stressSensitivity: "high",
      },
    ],
  },
];

// 即判定用（最初の3問）
export const PROVISIONAL_QUESTIONS = QUESTIONS.slice(0, 3);
// 精度アップ用（残り5問）
export const REFINEMENT_QUESTIONS = QUESTIONS.slice(3);

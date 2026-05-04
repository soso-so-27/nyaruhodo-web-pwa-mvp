# 診断オンボーディングデータ活用監査

## 1. 現在保存しているデータ

診断オンボーディング v1 では、Q1〜Q15 までの回答後に `localStorage.cat_profiles` へ以下を保存している。

- `typeKey`
- `typeLabel`
- `typeScores`
- `modifiers`
- `onboarding.answers`
- `onboarding.answeredCount`
- `onboarding.skippedCount`
- `understanding.percent`
- `understanding.sourceBreakdown`

保存先は DB ではなく localStorage。`active_cat_id` には作成した猫の `id` を保存し、オンボーディング完了時に `onboarding_completed = true` を保存する。

## 2. 現在の利用箇所

| データ | 保存されているか | 読まれているか | 使われている画面/処理 | コメント |
|---|---|---|---|---|
| `typeKey` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | 読み戻して保持しているが、現状の `/home` や `/diagnose` の分岐には使っていない |
| `typeLabel` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | オンボーディング結果画面では表示する。ホームでは主表示に使っていない |
| `typeScores` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | 保持のみ。診断スコア補正には未使用 |
| `modifiers` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | 保持のみ。ホーム提案、診断理由、診断補正には未使用 |
| `onboarding.answers` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | 保持のみ。現状は再開・補正・分析には未使用 |
| `onboarding.answeredCount` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | 保持のみ。ホーム表示では `understanding.percent` 側を参照 |
| `onboarding.skippedCount` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | 保持のみ |
| `understanding.percent` | はい | はい | `/home` | `events` 件数ベースの理解度と比較し、大きい方をホーム表示に使う |
| `understanding.sourceBreakdown` | はい | はい | `homeInputHelpers.readStoredCatProfiles` | 保持のみ。内訳表示はまだない |
| `diagnosis_onboarding_home_hint` | はい | はい | `/home` | オンボーディング直後だけ、ホーム接続文として表示する |

### /diagnosis-onboarding

- `DIAGNOSIS_ONBOARDING_QUESTIONS` から Q1〜Q15 を表示する。
- `buildOnboardingResult(answers)` で `typeKey / typeLabel / typeScores / modifiers / understanding` を作る。
- `ホームで見る` で `cat_profiles` に保存し、`active_cat_id` を新しい猫へ切り替える。
- `diagnosis_onboarding_home_hint` を保存し、ホーム直後の接続文に使う。

### /home

- `cat_profiles` を読み、`activeCatProfile.understanding?.percent` を参照する。
- `recentEvents` 件数から計算した理解度と、オンボーディング由来理解度の大きい方を表示する。
- `typeKey / typeLabel / typeScores / modifiers / onboarding.answers` は読み戻しているが、ホームの「いまの猫」カードや `latest_hypothesis` の内容決定にはまだ使っていない。

### /diagnose

- `local_cat_id` に一致する `recentEvents` を取得し、直近のごはん・遊び、`calendar_context.timeBand` から診断 `context` を作る。
- `calculateScores(input, diagnosisContext)` と `decideCategories(scores)` で診断結果を決める。
- 現状、`cat_profiles` は読んでいないため、オンボーディングの `typeKey / typeScores / modifiers / answers` は診断スコアに反映されていない。

### latest_hypothesis

- 診断結果から `localStorage.latest_hypothesis` に保存する。
- `source / text / category / diagnosisId / localCatId / createdAt / expiresAt` を使う。
- オンボーディング由来の `typeKey / modifiers / understanding` は含めていない。

### いまの猫カード

- active cat の `recentEvents` から `buildDailyHintHypothesis(recentEvents)` で軽い見立てを出す。
- `current_cat_hint_suppression` による表示抑制と `hint_feedbacks` 保存はある。
- オンボーディング由来の `typeKey / typeScores / modifiers` はまだ使っていない。

### understanding 表示

- `events` 件数ベース: `core/understanding/understanding.ts` の `eventCount * 5`。
- オンボーディングベース: `diagnosisOnboarding/scoring.ts` の `answeredCount / 30 * 40`。
- `/home` では `Math.max(eventUnderstandingPercent, profileUnderstandingPercent)` を表示する。
- 現時点では `feedbacks` と `hint_feedbacks` の実件数を取り込んだ理解度再計算はしていない。

### scoring.ts

- `src/lib/diagnosisOnboarding/scoring.ts`: オンボーディング回答からタイプ、モディファイア、理解度を作る。
- `src/core/logic/scoring.ts`: 日々の診断スコアを作る。
- 2つの scoring は現時点で接続されていない。

## 3. 精度への活用状況

- `typeKey` は `/diagnose` のスコア補正に使われていない。
- `typeScores` は `/diagnose` に使われていない。
- `modifiers` は診断理由やホーム提案に使われていない。
- `onboarding.answers` は直接使われていない。
- `understanding.percent` はホーム表示に使われているが、診断スコアや提案ロジックには使われていない。

現状では、オンボーディングデータは「初回価値」「ホーム理解度」「猫プロフィールとしての保持」には効いている。一方で、日々の診断精度・ホーム提案・理由文への活用はまだ未接続。

## 4. 現時点の課題

- オンボーディング結果は理解度表示には反映されているが、診断スコアにはまだ反映されていない。
- `typeLabel` はオンボーディング結果画面の表示用に近く、日々の見立てには使われていない。
- `modifiers` は保存されているが、ホーム提案や診断理由の補足にはまだ使われていない。
- `onboarding.answers` は保存されているが、再開、差し替え、補正にはまだ使われていない。
- Q1〜Q15 はタイプ分類には使えるが、「その行動が出た時に何をすると収まるか」という日々の行動提案補正にはまだ粗い。
- `feedbacks / hint_feedbacks` は DB に保存されているが、anon select しない方針のため、MVP UI では理解度や補正へ戻せていない。

## 5. 安全な活用方針

オンボーディングデータは強い決定要因にせず、弱い補正として使う。

- 今の行動を主軸にする。
- `calendar_context` と直近イベントを次に見る。
- `typeKey / typeScores` は弱い補正に留める。
- `modifiers` は理由文や補足に使う。
- health は不安を煽らず、注意補足に留める。
- `feedbacks / hint_feedbacks` が増えたら、オンボーディングより実績を優先する。
- オンボーディング補正は「逆方向の決めつけ」には使わない。たとえば `typeKey = play` でも、`low_energy` の health 優先を弱めない。

## 6. 補正案

| 条件 | 反映先 | 補正案 | 注意 |
|---|---|---:|---|
| `typeKey = play` | `meowing / restless` | `play +0.5` | 遊びに関係しない入力では使わない |
| `typeKey = food` | `meowing` かつ食事間隔が長い | `food +0.5` | 食後すぐなら補正しない |
| `typeKey = social` | `following / meowing` | `social +0.5` | かまってほしい決めつけにしない |
| `typeKey = stress` | `restless / fighting` | `stress +0.5` | 不安を煽る文にはしない |
| `typeScores` の上位カテゴリ | 該当入力と矛盾しない時 | 最大 `+0.5` | `typeKey` と合わせて最大 `+1` まで |
| health 系 modifier | `low_energy` / トイレ・食欲文脈 | 理由文を丁寧にする | health スコアを安易に上げすぎない |
| `modifiers` に「夜に元気」 | 夜の `meowing / restless` | play 補足理由 | 時間帯文脈と一致する時だけ |
| `modifiers` に「ごはん時間に敏感」 | 食事間隔が長い `meowing` | food 補足理由 | 食事直後には使わない |

補正は最大でも `+1` 程度にする。今の行動、直近イベント、calendar_context と矛盾する補正はしない。オンボーディングだけで診断を決めない。

## 7. Q1〜Q15の質問レビュー

評価は 3 = 強い、2 = 中、1 = 弱い。

| 質問ID | 質問 | タイプ分類 | 診断補正 | 行動提案 | 改善コメント |
|---|---|---:|---:|---:|---|
| `q01_recent_behavior` | 最近、気になる行動はどれですか？ | 3 | 2 | 2 | 初回価値に強い。日々の診断入力とも近いが、単発の最近行動なので継続補正には弱めに扱う |
| `q02_play_response` | 遊びにはどれくらい反応しますか？ | 3 | 2 | 3 | play 補正と「まず遊ぶ」提案に効く。遊びで落ち着くかも聞けるとさらに強い |
| `q03_food_sensitivity` | ごはんの時間に敏感ですか？ | 3 | 2 | 3 | food 補正に効く。食事間隔や食後の変化と組み合わせると診断向き |
| `q04_following` | 家の中であとをついてくることはありますか？ | 3 | 2 | 2 | social 補正に効く。時間帯や留守番後かを聞けると提案精度が上がる |
| `q05_zoomies` | 急に走り回ることはありますか？ | 2 | 2 | 2 | play / stress の分岐に使える。発生タイミングを聞くとさらに診断に効く |
| `q06_night_activity` | 夜に元気になることはありますか？ | 2 | 2 | 2 | calendar_context と相性が良い。夜限定の補正として安全 |
| `q07_food_interest` | ごはんの食いつきはどうですか？ | 2 | 2 | 2 | food / health に効くが、health は不安を煽らない補足に留める |
| `q08_touch_preference` | なでられるのは好きそうですか？ | 2 | 1 | 2 | social / stress のタイプ理解には効く。診断補正には入力との一致条件が必要 |
| `q09_environment_reaction` | いつもと違う音や環境に反応しやすいですか？ | 3 | 2 | 2 | stress 補正に強い。環境変化の理由文に使いやすい |
| `q10_alone_time` | ひとりで過ごす時間は平気そうですか？ | 2 | 1 | 2 | social / stress の傾向理解に効く。留守番後の具体行動を聞くとより診断向き |
| `q11_settling` | 落ち着くまでに時間がかかることはありますか？ | 2 | 2 | 3 | stress 提案に強い。落ち着きやすい方法を追加で聞くと行動提案に直結する |
| `q12_grooming` | 毛づくろいの様子で気になることはありますか？ | 1 | 1 | 1 | health / stress の注意補足には使えるが、診断補正には慎重に扱う |
| `q13_toilet_change` | トイレの変化が気になることはありますか？ | 1 | 1 | 2 | health 注意補足に重要。ただし不安喚起を避け、行動提案は「少し見ておく」程度 |
| `q14_energy_level` | ふだんの元気さはどうですか？ | 2 | 2 | 2 | play / health の基礎値に使える。日内変動も聞けるとよい |
| `q15_sleep_time` | 寝ている時間は長い方ですか？ | 1 | 1 | 1 | 補助情報としては良いが、診断精度への直接寄与は弱め。時間帯や変化量の方が効く |

## 8. 追加・差し替え候補の質問

| questionId案 | 質問文 | 選択肢 | 効くカテゴリ補正 | 位置づけ |
|---|---|---|---|---|
| `qxx_meowing_timing` | 鳴くことが多いのはどんな時ですか？ | ごはん前 / 帰宅後 / 遊んでいない時 / 夜 / わからない | food, social, play, stress | Q1後の追加候補。meowing 診断に強く効く |
| `qxx_settles_with` | 気になる行動が出た時、落ち着きやすいのはどれですか？ | 遊ぶ / ごはんや水を見る / 声をかける / 静かにする / わからない | play, food, social, stress | Q11の後に追加候補。行動提案に直結 |
| `qxx_first_try` | 迷った時、先に反応しやすいのはどれですか？ | 遊び / ごはん / 近くにいる / 静かな場所 / まだわからない | play, food, social, stress | Q2〜Q3後に追加候補。ホーム提案にも効く |
| `qxx_night_trigger` | 夜に活発な時、きっかけになりやすいのはどれですか？ | 遊び足りない / ごはん前後 / 人が動いた時 / 物音 / わからない | play, food, social, stress | Q6の差し替え/追加候補。calendar_context と相性が良い |
| `qxx_after_absence_behavior` | 留守番のあと、出やすい様子はありますか？ | 鳴く / ついてくる / 走り回る / 落ち着かない / 特にない | social, play, stress | Q10またはQ24の補強候補。日常文脈に効く |
| `qxx_food_gap_behavior` | ごはんまで時間が空いた時、変わりやすい様子はありますか？ | 鳴く / そわそわする / ついてくる / あまり変わらない / わからない | food, social, stress | Q3/Q7の補強候補。食事間隔補正に効く |
| `qxx_play_gap_behavior` | 遊ぶ時間が少なかった日は、どんな様子が出やすいですか？ | 走る / 鳴く / ついてくる / 落ち着かない / あまり変わらない | play, social, stress | Q2/Q5の補強候補。行動提案に効く |
| `qxx_health_observation` | いつもと違う様子に気づくのはどんな時ですか？ | ごはん / トイレ / 元気さ / 毛づくろい / まだわからない | health | Q13/Q14/Q15の補強候補。不安を煽らず観察表現で扱う |
| `qxx_sound_context` | 音に反応するとき、どんな様子になりやすいですか？ | 隠れる / そわそわする / 鳴く / すぐ戻る / わからない | stress, social | Q9の追加候補。stress 理由文に使いやすい |
| `qxx_human_response` | 人がどうすると落ち着きやすいですか？ | 声をかける / 近くにいる / 少し距離を置く / 遊ぶ / わからない | social, stress, play | Q8/Q10の補強候補。CTA文言に直結 |

## 9. 次の実装候補

1. まず監査のみ
   - 今回の範囲。コード変更なし。
2. `typeKey` を `/diagnose` に弱く補正
   - `cat_profiles` を `/diagnose` 側で読めないため、まずは URL / localStorage / client wrapper のどこで渡すかを設計する。
   - 補正は最大 `+1` 程度。
3. `modifiers` を理由文に少し反映
   - 診断スコアより先に、理由文の補足として使う方が安全。
   - 例: 「夜に元気」の場合、夜の meowing/restless 理由に少し添える。
4. Q1〜Q15の一部質問を差し替え
   - 「何をすると収まるか」「いつ出るか」を聞く質問を入れると、行動提案に効きやすい。
5. Q16〜Q30に診断補正向け質問を追加
   - すぐ実装せず、Q1〜Q15の実利用データを見てからでよい。

## 10. 次の安全な一手

最初に実装するなら、`typeKey` を診断スコアに直接強く入れるより、`modifiers` を診断理由文の補足に弱く出すのが安全。

理由:

- 診断結果そのものを変えずに体験価値を出せる。
- 決めつけ感が出にくい。
- オンボーディングに答えた意味がユーザーに伝わる。
- 誤補正による診断精度低下のリスクが小さい。

その次に、`typeKey` / `typeScores` を `meowing`, `following`, `restless` など入力と一致する場面だけ `+0.5` 程度で補正する。

## やらないこと

- コード変更
- UI変更
- DB変更
- RLS変更
- migration作成
- E2E実行
- build実行
- typecheck実行

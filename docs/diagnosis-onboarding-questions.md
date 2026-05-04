# 診断オンボーディング質問定義

## 目的

診断オンボーディングは、猫のタイプを当てるためではなく、飼い主の迷いを減らすために「この子の傾向」を少しずつ見えるようにする入口とする。

診断は作業ではなく、「この子を知る体験」として設計する。

## 基本方針

- 全問スキップ可能
- いつでも結果を見ることができる
- 3問で即価値を出す
- 15問でタイプ精度を上げる
- 30問で理解度・モディファイアを強化する
- 不安を煽らない
- 医療っぽくしすぎない
- health はタイプにはせず、注意モディファイアに使う

## カテゴリ

- play
- food
- social
- stress
- health

## タイプ対応

- play → あそびハンター
- food → ごはんセンサー
- social → かまってレーダー
- stress → びっくりセンサー
- バランス型 → マイペース観察

health はタイプにしない。
health は注意モディファイアに使う。

## モディファイア候補

- 夜に元気
- 朝に甘えやすい
- ごはん時間に敏感
- 遊び不足で爆発
- 音に敏感
- 環境変化に敏感
- ひとり時間苦手
- ひとり時間平気
- 甘えに波
- 食欲ムラ
- トイレ変化注意
- 体調変化出やすい
- 回復に時間がかかる
- 家族で反応が違う
- 留守番後に甘えやすい

## スコア記法

各回答の `score` はカテゴリへの加点を表す。

例：

- score: social +2, food +1
- modifierCandidate: ひとり時間苦手

`modifierCandidate` は確定ではなく、複数回答の組み合わせで抽出する候補とする。

---

# Q1〜Q3 即価値ゾーン

3問だけでも、軽いタイプ傾向とホーム反映の材料を作る。

## Q1

questionId: q01_recent_behavior

質問: 最近、気になる行動はどれですか？

スキップ: 可

選択肢:

- 鳴いてる
  - score: social +2, food +1, play +1
  - modifierCandidate: なし
- ついてくる
  - score: social +2
  - modifierCandidate: ひとり時間苦手
- 落ち着かない
  - score: stress +2, play +1
  - modifierCandidate: 音に敏感 / 環境変化に敏感
- 元気ない
  - score: health +2
  - modifierCandidate: 体調変化出やすい
- よくわからない
  - score: なし
  - modifierCandidate: なし

## Q2

questionId: q02_play_response

質問: 遊びにはどれくらい反応しますか？

スキップ: 可

選択肢:

- すぐ反応する
  - score: play +3
  - modifierCandidate: 遊び不足で爆発
- ときどき反応する
  - score: play +1, social +1
  - modifierCandidate: なし
- あまり反応しない
  - score: stress +1, health +1
  - modifierCandidate: 体調変化出やすい
- わからない
  - score: なし
  - modifierCandidate: なし

## Q3

questionId: q03_food_sensitivity

質問: ごはんの時間に敏感ですか？

スキップ: 可

選択肢:

- とても敏感
  - score: food +3
  - modifierCandidate: ごはん時間に敏感
- 少し敏感
  - score: food +2
  - modifierCandidate: ごはん時間に敏感
- あまり気にしない
  - score: social +1, play +1
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

---

# Q4〜Q15 タイプ精度アップゾーン

Q1〜Q3の軽い傾向に、生活内の反応パターンを重ねる。

## Q4

questionId: q04_following

質問: 家の中であとをついてくることはありますか？

スキップ: 可

選択肢:

- よくある
  - score: social +3
  - modifierCandidate: ひとり時間苦手
- ときどきある
  - score: social +2
  - modifierCandidate: なし
- あまりない
  - score: stress +1
  - modifierCandidate: ひとり時間平気
- わからない
  - score: なし
  - modifierCandidate: なし

## Q5

questionId: q05_zoomies

質問: 急に走り回ることはありますか？

スキップ: 可

選択肢:

- よくある
  - score: play +2, stress +1
  - modifierCandidate: 遊び不足で爆発
- 夜によくある
  - score: play +2
  - modifierCandidate: 夜に元気
- あまりない
  - score: social +1
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q6

questionId: q06_night_activity

質問: 夜に元気になることはありますか？

スキップ: 可

選択肢:

- よくある
  - score: play +2, social +1
  - modifierCandidate: 夜に元気
- ときどきある
  - score: play +1
  - modifierCandidate: 夜に元気
- あまりない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q7

questionId: q07_food_interest

質問: ごはんの食いつきはどうですか？

スキップ: 可

選択肢:

- いつもよい
  - score: food +2
  - modifierCandidate: ごはん時間に敏感
- 日によって変わる
  - score: food +1, health +1
  - modifierCandidate: 食欲ムラ
- あまりよくない
  - score: health +2
  - modifierCandidate: 食欲ムラ
- わからない
  - score: なし
  - modifierCandidate: なし

## Q8

questionId: q08_touch_preference

質問: なでられるのは好きそうですか？

スキップ: 可

選択肢:

- 好きそう
  - score: social +2
  - modifierCandidate: なし
- 気分による
  - score: social +1, stress +1
  - modifierCandidate: 甘えに波
- あまり好きではなさそう
  - score: stress +2
  - modifierCandidate: 音に敏感 / 環境変化に敏感
- わからない
  - score: なし
  - modifierCandidate: なし

## Q9

questionId: q09_environment_reaction

質問: いつもと違う音や環境に反応しやすいですか？

スキップ: 可

選択肢:

- とても反応する
  - score: stress +3
  - modifierCandidate: 音に敏感 / 環境変化に敏感
- 少し反応する
  - score: stress +2
  - modifierCandidate: 音に敏感
- あまり気にしない
  - score: social +1
  - modifierCandidate: ひとり時間平気
- わからない
  - score: なし
  - modifierCandidate: なし

## Q10

questionId: q10_alone_time

質問: ひとりで過ごす時間は平気そうですか？

スキップ: 可

選択肢:

- 平気そう
  - score: stress +1
  - modifierCandidate: ひとり時間平気
- 少し苦手そう
  - score: social +2
  - modifierCandidate: ひとり時間苦手
- かなり苦手そう
  - score: social +3, stress +1
  - modifierCandidate: ひとり時間苦手
- わからない
  - score: なし
  - modifierCandidate: なし

## Q11

questionId: q11_settling

質問: 落ち着くまでに時間がかかることはありますか？

スキップ: 可

選択肢:

- よくある
  - score: stress +3
  - modifierCandidate: 回復に時間がかかる
- ときどきある
  - score: stress +2
  - modifierCandidate: 回復に時間がかかる
- あまりない
  - score: social +1
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q12

questionId: q12_grooming

質問: 毛づくろいの様子で気になることはありますか？

スキップ: 可

選択肢:

- よく毛づくろいしている
  - score: stress +1
  - modifierCandidate: なし
- 増えた気がする
  - score: stress +2, health +1
  - modifierCandidate: 体調変化出やすい
- あまり気にならない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q13

questionId: q13_toilet_change

質問: トイレの様子に変化を感じることはありますか？

スキップ: 可

選択肢:

- ある
  - score: health +3
  - modifierCandidate: トイレ変化注意
- ときどきある
  - score: health +2
  - modifierCandidate: トイレ変化注意
- あまりない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q14

questionId: q14_energy_level

質問: ふだんの元気さはどうですか？

スキップ: 可

選択肢:

- 元気いっぱい
  - score: play +2
  - modifierCandidate: 遊び不足で爆発
- ふつう
  - score: なし
  - modifierCandidate: なし
- 元気に波がある
  - score: health +1, stress +1
  - modifierCandidate: 体調変化出やすい
- わからない
  - score: なし
  - modifierCandidate: なし

## Q15

questionId: q15_sleep_amount

質問: 睡眠時間は多い方だと感じますか？

スキップ: 可

選択肢:

- 多い方
  - score: health +1
  - modifierCandidate: 体調変化出やすい
- ふつう
  - score: なし
  - modifierCandidate: なし
- 少ない方
  - score: play +1, stress +1
  - modifierCandidate: 夜に元気
- わからない
  - score: なし
  - modifierCandidate: なし

---

# Q16〜Q30 理解度・モディファイア強化ゾーン

タイプ確定よりも、ホーム提案、診断理由、理解度、モディファイア表示の質を上げる。

## Q16

questionId: q16_active_time_band

質問: 元気になりやすい時間帯はありますか？

スキップ: 可

選択肢:

- 朝
  - score: social +1, food +1
  - modifierCandidate: 朝に甘えやすい
- 昼
  - score: play +1
  - modifierCandidate: なし
- 夜
  - score: play +2
  - modifierCandidate: 夜に元気
- わからない
  - score: なし
  - modifierCandidate: なし

## Q17

questionId: q17_meal_interval_reaction

質問: ごはんから時間が空くと、様子が変わりやすいですか？

スキップ: 可

選択肢:

- 変わりやすい
  - score: food +3
  - modifierCandidate: ごはん時間に敏感
- 少し変わる
  - score: food +2
  - modifierCandidate: ごはん時間に敏感
- あまり変わらない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q18

questionId: q18_play_shortage

質問: 遊ぶ時間が少ない日は、様子が変わりますか？

スキップ: 可

選択肢:

- かなり変わる
  - score: play +3
  - modifierCandidate: 遊び不足で爆発
- 少し変わる
  - score: play +2
  - modifierCandidate: 遊び不足で爆発
- あまり変わらない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q19

questionId: q19_affection_style

質問: 甘え方に波はありますか？

スキップ: 可

選択肢:

- かなりある
  - score: social +2, stress +1
  - modifierCandidate: 甘えに波
- 少しある
  - score: social +1
  - modifierCandidate: 甘えに波
- あまりない
  - score: social +1
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q20

questionId: q20_sound_sensitivity

質問: 大きな音や急な音にびっくりしやすいですか？

スキップ: 可

選択肢:

- しやすい
  - score: stress +3
  - modifierCandidate: 音に敏感
- 少ししやすい
  - score: stress +2
  - modifierCandidate: 音に敏感
- あまりしない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q21

questionId: q21_litter_detail

質問: トイレの回数や様子を気にして見ていますか？

スキップ: 可

選択肢:

- よく見ている
  - score: health +1
  - modifierCandidate: トイレ変化注意
- ときどき見ている
  - score: health +1
  - modifierCandidate: なし
- あまり見ていない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q22

questionId: q22_health_signals

質問: 体調の変化が行動に出やすいと感じますか？

スキップ: 可

選択肢:

- 出やすい
  - score: health +3
  - modifierCandidate: 体調変化出やすい
- 少し出る
  - score: health +2
  - modifierCandidate: 体調変化出やすい
- あまり感じない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q23

questionId: q23_family_reaction

質問: 家族の中で、反応が違う相手はいますか？

スキップ: 可

選択肢:

- いる
  - score: social +2
  - modifierCandidate: 家族で反応が違う
- 少しいる
  - score: social +1
  - modifierCandidate: 家族で反応が違う
- あまりない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q24

questionId: q24_after_absence

質問: 留守番のあと、甘えたり鳴いたりしますか？

スキップ: 可

選択肢:

- よくある
  - score: social +3
  - modifierCandidate: 留守番後に甘えやすい
- ときどきある
  - score: social +2
  - modifierCandidate: 留守番後に甘えやすい
- あまりない
  - score: なし
  - modifierCandidate: ひとり時間平気
- わからない
  - score: なし
  - modifierCandidate: なし

## Q25

questionId: q25_photo_or_notes

質問: 写真やメモで残しておきたい行動はありますか？

スキップ: 可

選択肢:

- よくある
  - score: health +1, stress +1
  - modifierCandidate: 体調変化出やすい
- ときどきある
  - score: social +1
  - modifierCandidate: なし
- あまりない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q26

questionId: q26_daily_rhythm

質問: 生活リズムが変わると、猫の様子も変わりますか？

スキップ: 可

選択肢:

- 変わりやすい
  - score: stress +2, social +1
  - modifierCandidate: 環境変化に敏感
- 少し変わる
  - score: stress +1
  - modifierCandidate: 環境変化に敏感
- あまり変わらない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q27

questionId: q27_stress_signs

質問: ストレスっぽいサインを感じることはありますか？

スキップ: 可

選択肢:

- よくある
  - score: stress +3
  - modifierCandidate: 環境変化に敏感 / 音に敏感
- ときどきある
  - score: stress +2
  - modifierCandidate: なし
- あまりない
  - score: なし
  - modifierCandidate: なし
- わからない
  - score: なし
  - modifierCandidate: なし

## Q28

questionId: q28_recovery_speed

質問: びっくりしたあと、戻るまでの時間はどうですか？

スキップ: 可

選択肢:

- すぐ戻る
  - score: なし
  - modifierCandidate: なし
- 少し時間がかかる
  - score: stress +1
  - modifierCandidate: 回復に時間がかかる
- かなり時間がかかる
  - score: stress +2
  - modifierCandidate: 回復に時間がかかる
- わからない
  - score: なし
  - modifierCandidate: なし

## Q29

questionId: q29_attention_signs

質問: かまってほしい時のサインは分かりやすいですか？

スキップ: 可

選択肢:

- 分かりやすい
  - score: social +3
  - modifierCandidate: なし
- 少し分かる
  - score: social +2
  - modifierCandidate: なし
- 分かりにくい
  - score: stress +1
  - modifierCandidate: 甘えに波
- わからない
  - score: なし
  - modifierCandidate: なし

## Q30

questionId: q30_common_concern

質問: よくある困りごとはどれに近いですか？

スキップ: 可

選択肢:

- 鳴くこと
  - score: social +2, food +1
  - modifierCandidate: なし
- 落ち着かないこと
  - score: stress +2, play +1
  - modifierCandidate: 音に敏感 / 環境変化に敏感
- ごはんやトイレ
  - score: food +1, health +2
  - modifierCandidate: 食欲ムラ / トイレ変化注意
- 特にない
  - score: なし
  - modifierCandidate: なし

---

# モディファイア抽出条件案

MVPでは、回答内の `modifierCandidate` 出現回数と関連スコアを見て最大2つを表示する。

## 基本ルール

- 同じ modifierCandidate が2回以上出たら候補にする
- health 系は1回でも注意候補に入れてよいが、表示は不安を煽らない文言にする
- 同点の場合は Q1〜Q15 の回答を優先する
- 最大2つまで表示する

## health 系の扱い

health はタイプにはしない。

表示する場合も、以下のように弱く扱う。

- 食欲ムラがあるかもしれません
- トイレの変化は少し見ておくとよさそうです
- 体調の変化が行動に出ることがあるかもしれません

# 理解度への反映案

オンボーディング回答は最大40%として扱う。

MVP案：

- answeredCount / 30 × 40
- 小数点は四捨五入
- skippedCount は理解度に加算しない
- Q1〜Q3だけでも最大4%程度は入る

ただし表示では、数字よりも関係性メッセージを優先する。

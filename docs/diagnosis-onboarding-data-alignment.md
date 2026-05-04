# 診断オンボーディングと既存設計の整合性

## 目的

診断オンボーディングは、猫のタイプを当てるためではなく、飼い主の迷いを減らすための初期理解データを作るものとする。

## 基本思想

- タイプ = 猫のベース傾向
- モディファイア = 条件付き傾向
- 今の仮説 = 直近行動と文脈から毎回変わる見立て
- 行動提案 = ユーザーが次に迷わず動くためのもの

## 既存構造との関係

現在の主要データ：

- events
- diagnoses
- feedbacks
- hint_feedbacks
- localStorage cat_profiles
- latest_hypothesis
- active_cat_id

診断オンボーディング結果は、MVPでは cat_profiles に保存する。
DB変更はまだしない。

## MVP localStorage 方針

cat_profiles に以下を追加する想定。

- typeKey
- typeLabel
- typeScores
- modifiers
- onboarding
  - version
  - answeredCount
  - skippedCount
  - answers
  - completedAt
  - updatedAt
- understanding
  - percent
  - sourceBreakdown

例：

```json
{
  "id": "local-cat-xxx",
  "name": "ミケ",
  "typeKey": "play",
  "typeLabel": "あそびハンター",
  "typeScores": {
    "play": 8,
    "food": 3,
    "social": 4,
    "stress": 2,
    "health": 1
  },
  "modifiers": ["夜に元気", "遊び不足で爆発"],
  "onboarding": {
    "version": "diagnosis-v1",
    "answeredCount": 12,
    "skippedCount": 3,
    "answers": {},
    "completedAt": "ISO",
    "updatedAt": "ISO"
  },
  "understanding": {
    "percent": 42,
    "sourceBreakdown": {
      "onboarding": 16,
      "events": 18,
      "feedbacks": 8,
      "hintFeedbacks": 0
    }
  }
}
```

## 将来DB化方針

認証や外部テストが進んだ段階で、以下のDB化を検討する。

候補：

- cats
- cat_onboarding_sessions
- cat_onboarding_answers
- cat_trait_profiles
- cat_understanding_snapshots

ただし、認証なしMVPではまだ作らない。

## タイプとカテゴリの対応

既存カテゴリ：

- play
- food
- social
- stress
- health

タイプ対応：

- play → あそびハンター
- food → ごはんセンサー
- social → かまってレーダー
- stress → びっくりセンサー
- バランス型 → マイペース観察

health はタイプにしない。
health は注意モディファイアとして扱う。

health 系モディファイア例：

- 食欲ムラ
- トイレ変化注意
- 体調変化出やすい

## モディファイア方針

モディファイアは最大2つを基本表示とする。

例：

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

## 理解度の再設計

理解度は単純な events 数だけではなく、以下の合成にする。

MVP案：

- オンボーディング回答: 最大40%
- 日常記録 events: 最大30%
- 診断 feedbacks: 最大20%
- hint_feedbacks: 最大10%

例：

- 30問中12問回答 = 16%
- events 6件 = 18%
- feedbacks 2件 = 8%
- hint_feedbacks 0件 = 0%
- 合計 42%

表示上は数字だけを主役にしない。
「少しずつ見えてきました」などの関係性メッセージを主役にする。

## ホーム表示との整合性

ホームではタイプを主役にしすぎない。

表示例：

- ミケは、あそびハンターっぽい子です
- ミケは、遊びへの反応が出やすいかもしれません
- かなり見えてきました
- 理解度 42%

ホームの役割：

- 今日の猫を見る
- いまの提案を見る
- サッと記録する
- 気になる時に診断へ進む

## 診断結果との整合性

診断結果では、タイプを断定根拠にしない。

悪い例：

ミケはあそびハンターなので、遊びたいです。

良い例：

ミケは遊びに反応しやすい傾向があります。
さっきの様子から見ると、少し遊びたい気持ちかもしれません。

タイプは補正情報として使う。
直近行動と calendar_context を優先する。

## 今の仮説ロジック

今の仮説は以下で作る。

今の行動
× タイプ傾向
× 直前データ
× calendar_context
× feedbacks / hint_feedbacks
= 今の見立て

例：

鳴いてる
+ ごはんセンサー
+ 食事間隔が長い
→ ごはんが気になっているかもしれません

例：

鳴いてる
+ あそびハンター
+ 前回遊びから時間が空いている
→ 遊びたい気持ちかもしれません

## diagnoses との関係

diagnoses には、将来的に typeSnapshot / modifiersSnapshot / understandingSnapshot を context に含める可能性がある。

MVPではDBスキーマ変更せず、context JSON に必要最小限を入れる方針を検討する。

## feedbacks / hint_feedbacks との関係

feedbacks:

- 診断結果の resolved / unresolved
- 今の仮説の精度評価に使う

hint_feedbacks:

- いまの猫カードの accepted / rejected / dismissed
- ホーム提案の出し方に使う

将来的には、feedbacks / hint_feedbacks を理解度やタイプ補正に少し反映する。

## 実装前に決めること

- cat_profiles の最終型
- 理解度計算式
- Q1〜Q30 の質問ID
- 回答値とスコア対応
- タイプ決定ロジック
- モディファイア抽出ロジック
- ホーム表示ルール
- 診断結果への反映範囲
- DB化するタイミング

## 最初の実装範囲候補

最初に実装するなら以下まで。

- 名前入力
- Q1〜Q3
- 3問後の軽い結果
- cat_profiles への保存
- ホーム上部への軽い反映

Q4以降、DB保存、認証、catsテーブルは後回し。

## やらないこと

- コード変更
- UI実装
- DB変更
- RLS変更
- migration作成
- E2E実行
- build実行
- typecheck実行

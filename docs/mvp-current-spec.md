# にゃるほど Web/PWA MVP 現状仕様メモ

## 1. アプリの目的

にゃるほどは、猫の正解を断定するアプリではなく、飼い主の迷いを減らすための Web/PWA MVP です。

まずは日々の入力、診断、フィードバックを通じて「この子の傾向が少しずつ見えてくる」体験を作ります。

## 2. 現在実装済みの主要機能

- オンボーディング
- ホーム入力 UI
- 鳴いてる診断を含む診断画面
- 診断ロジックによるカテゴリ推定
- 診断結果表示
- 診断結果 CTA
- フィードバック保存
- `latest_hypothesis` のホーム表示
- 診断後 `latest_hypothesis` の3時間無効化
- ホーム入力時の `latest_hypothesis` 削除
- 理解度表示
- 理解度別のホーム文言切り替え
- 理解度71%以上での推測候補カード
- `events` 履歴に応じた推測候補生成
- Supabase 保存

## 3. ホーム画面の仕様

現状のタイトルは「ミケ」です。

ただし将来的には `cats` / `profiles` テーブル化により可変にする想定です。

ホームには以下の2セクションがあります。

- いまの様子
- 気になること

いまの様子:

- ねてる
- グルーミング
- 遊んでる
- ご飯たべた
- トイレした
- ゴロゴロしてる

気になること:

- 鳴いてる
- ついてくる
- 落ち着かない
- 元気ない
- ケンカしてる
- よくわからない

いまの様子は `events` に `current_state` として保存します。

気になることは `events` に `concern` として保存し、診断画面へ遷移します。

## 4. 診断画面の仕様

診断画面は `/diagnose?input=xxx` で表示します。

主な入力は以下です。

- `meowing`
- `following`
- `restless`
- `low_energy`
- `fighting`
- `unknown`

診断結果では以下を表示します。

- タイトル「診断結果」
- メイン結果
- 理由
- カテゴリ別 CTA
- サブ CTA
- 保存後メッセージ
- ホームに戻る導線

診断結果は `diagnoses` に保存されます。

`event_id` がない場合は診断 UI は表示しますが、診断保存はしません。

## 5. latest_hypothesis の仕様

`latest_hypothesis` は、診断結果表示時に `localStorage` に保存します。

診断由来の保存形式は以下です。

```ts
{
  source: "diagnosis",
  text: string,
  category: string,
  diagnosisId: string | null,
  createdAt: string,
  expiresAt: string
}
```

診断由来の `latest_hypothesis` は3時間で無効化します。

`expiresAt` が過去の場合、ホーム表示時に削除し、表示しません。

互換対応として、`source: "diagnosis"` かつ `expiresAt` がない場合は、`createdAt` から3時間経過していれば削除します。

ホームに表示される文言は以下です。

- さっきの様子から
- `text`

`latest_hypothesis` 表示中は、理解度別案内文と推測候補カードを表示しません。

## 6. localStorage の使用キー

確認済みキーは以下です。

- `latest_hypothesis`
- `onboarding_completed`
- `last_input_signal`
- `last_context`
- `last_primary_category`

`latest_hypothesis` は診断後・オンボーディング後の直近仮説表示に使います。

`last_*` 系キーは既存互換用です。`latest_hypothesis` に統一済みのため、将来的に削除候補です。

## 7. 理解度別UXの仕様

理解度は `events` 件数をもとに計算します。

現在は `events` 1件ごとに +5%、最大100%です。

これは MVP 用の簡易指標です。

将来的には `feedbacks`、カテゴリ別傾向、猫ごとの履歴を加味する想定です。

理解度別表示文言は以下です。

0〜30%:

- まずは、今日の様子を教えてください
- 少しずつ、この子の傾向が見えてきます

31〜70%:

- 少しずつ、傾向が見えてきました
- 気になる様子があれば、近いものを選んでください

71〜100%:

- 最近の様子から、先に候補を出せそうです
- 違っていたら、いつものように選び直してください

`latest_hypothesis` がある場合、理解度別案内文は非表示です。

## 8. 診断結果CTAの仕様

診断結果画面の CTA は主カテゴリに応じて変わります。

- `play`: 遊んでみた / まだ様子を見る
- `food`: ごはんを確認した / まだ様子を見る
- `social`: かまってみた / まだ様子を見る
- `stress`: 落ち着けるようにした / まだ様子を見る
- `health`: 体調を確認した / 記録だけする
- 不明: 様子を記録する / ホームに戻る

CTA 押下時は既存の `insertFeedback()` を使って `feedbacks` に保存します。

保存成功後は完了メッセージを表示します。

通常カテゴリ:

- 記録しました。
- また少し、この子の傾向が見えてきました。

`health` カテゴリ:

- 記録しました。
- 気になる様子が続くときは、早めに相談してください。

## 9. ホーム直近仮説CTAの仕様

ホームの `latest_hypothesis` カードにもカテゴリ別 CTA を表示します。

- `play`: 遊んでみた / まだ様子を見る
- `food`: ごはんを確認した / まだ様子を見る
- `social`: かまってみた / まだ様子を見る
- `stress`: 落ち着けるようにした / まだ様子を見る
- `health`: 体調を確認した / 記録だけする
- 不明: 様子を記録する / 閉じる

診断由来で `diagnosisId` がある場合、CTA 押下で `feedbacks` に保存します。

保存成功後は `latest_hypothesis` を削除し、カードを非表示にします。

`diagnosisId` がない仮説は DB 保存せず、閉じる扱いです。

## 10. 推測候補カードの仕様

推測候補カードの表示条件は以下です。

- 理解度71%以上
- `latest_hypothesis` が表示されていない
- ホーム通常入力 UI が表示されている

表示文言は以下です。

- この子の最近の記録から
- 最近の様子から、先に候補を出せそうです
- 違っていたら、いつものように選び直してください

候補は最大2件です。

候補生成は以下の仕様です。

- `events` の直近履歴から `concern` 系 `signal` を集計
- 対象 `signal` は `meowing` / `following` / `restless` / `low_energy` / `fighting` / `unknown`
- 頻度が高い順
- 同数の場合はより新しい入力を優先
- 候補が足りない場合は `meowing` / `following` で補完

候補文言と遷移は以下です。

- `meowing`: 鳴いてるかも → `/diagnose?input=meowing`
- `following`: ついてきてるかも → `/diagnose?input=following`
- `restless`: 落ち着かないかも → `/diagnose?input=restless`
- `low_energy`: 元気ないかも → `/diagnose?input=low_energy`
- `fighting`: ケンカしてるかも → `/diagnose?input=fighting`
- `unknown`: よくわからないかも → `/diagnose?input=unknown`

## 11. Supabase保存テーブル

現在の MVP テーブルは以下です。

- `events`
- `diagnoses`
- `feedbacks`

`events` は、ホームの「いまの様子」と「気になること」を保存します。

`diagnoses` は、診断ロジック実行結果を保存し、`event_id` に紐づきます。

`feedbacks` は、診断結果 CTA とホーム直近仮説 CTA を保存し、`diagnosis_id` に紐づきます。

RLS は以下の前提です。

- `events`: anon insert/select 許可
- `diagnoses`: anon insert 許可、select 不可
- `feedbacks`: anon insert 許可、select 不可

## 12. 現在変更しない前提のもの

- DB スキーマ
- RLS
- Supabase 権限
- `diagnoses` / `feedbacks` の select 不許可方針
- 診断ロジック本体
- 理解度計算ロジック本体
- オンボーディングの流れ
- `latest_hypothesis` の保存形式
- `latest_hypothesis` の3時間無効化
- ホーム入力時の `latest_hypothesis` 削除仕様
- `feedbacks` の保存仕様

## 13. 今後の候補タスク

- 実ブラウザで MVP 通し確認
- Supabase Table Editor で保存確認
- `latest_hypothesis` の期限切れ挙動確認
- `feedbacks` 保存失敗時の UI 確認
- 推測候補カードの実履歴反映確認
- 理解度計算を将来的に `events` 件数以外へ拡張
- `actions` テーブル追加検討
- `weights` テーブル追加検討
- `cats` / `profiles` テーブル追加検討
- RLS のユーザー単位制御
- PWA 設定
- Vercel 環境変数整理
- Expo React Native 移行を見据えた UI / core 分離の継続整理

## 本番Vercel確認結果

### 確認日

2026-05-02

### 本番URL

https://nyaruhodo-web-pwa-mvp.vercel.app

### 確認できたこと

- `/` が表示される
- `/home` が表示される
- `/diagnose?input=meowing` が表示される
- `/onboarding` が表示される
- `/home` から「鳴いてる」を押すと診断画面へ遷移する
- `events` に保存される
- `diagnoses` に保存される
- 診断結果表示後に `latest_hypothesis` が localStorage に保存される
- `/home` に戻ると直近仮説カードが表示される
- ホーム直近仮説CTAを押すと `feedbacks` に保存される
- 保存後に `latest_hypothesis` が localStorage から削除される

### 確認できた latest_hypothesis の形式

```json
{
  "source": "diagnosis",
  "text": "遊びたい可能性があります",
  "category": "play",
  "diagnosisId": "診断ID",
  "createdAt": "ISO文字列",
  "expiresAt": "ISO文字列"
}
```

### 判定

本番環境で、MVPの主要導線は正常に動作している。

確認済みの主要導線:

```text
/home から入力
↓
events 保存
↓
診断画面へ遷移
↓
diagnoses 保存
↓
latest_hypothesis 保存
↓
/home に直近仮説表示
↓
ホームCTA押下
↓
feedbacks 保存
↓
latest_hypothesis 削除
```

### 未確認・今後確認すること

- `expiresAt` を過去にした場合の本番での自動削除
- 複数カテゴリでのCTA文言確認
- 理解度71%以上での推測候補カード確認
- PWA設定確認
- Vercel Preview環境での動作確認

## PWA最低限対応・本番確認結果

### 確認日

2026-05-02

### 実装済み

- `src/app/manifest.ts` を追加
- `public/icons/icon-192.png` を追加
- `public/icons/icon-512.png` を追加
- `public/icons/icon-maskable-512.png` を追加
- `public/apple-touch-icon.png` を追加
- `src/app/layout.tsx` に metadata / viewport を追加

### manifest仕様

- `name`: にゃるほど
- `short_name`: にゃるほど
- `description`: 猫の様子から、飼い主の迷いを減らすアプリ
- `start_url`: /home
- `scope`: /
- `display`: standalone
- `background_color`: #fffaf3
- `theme_color`: #f4a261
- `lang`: ja

### icons

- `/icons/icon-192.png`
- `/icons/icon-512.png`
- `/icons/icon-maskable-512.png`
- `/apple-touch-icon.png`

### 本番確認結果

- `/manifest.webmanifest` が表示される
- アイコンURLが表示される
- モバイルでホーム画面に追加できる
- ホーム画面から起動できる

### まだ未対応

- Service Worker
- offline対応
- キャッシュ戦略
- push通知
- install prompt UI
- next-pwa / Workbox 導入

### 判定

PWAとして最低限の「ホーム画面に追加」は確認済み。

現時点では、オフライン対応やプッシュ通知は未実装。

## local_cat_id による猫ごとの履歴分離

### 実装日

2026-05-02

### 実装内容

- `events.local_cat_id` に localStorage の `active_cat_id` を保存する
- `diagnoses.local_cat_id` に診断対象の `active_cat_id` を保存する
- `feedbacks.local_cat_id` に診断または直近仮説の `active_cat_id` を保存する
- 診断URLには `local_cat_id` を query parameter として引き継ぐ
- `latest_hypothesis` には `localCatId` を保存する

### ホーム表示

- 理解度は、現在選択中の猫の `events.local_cat_id` に一致する events のみで計算する
- 推測候補は、現在選択中の猫の `events.local_cat_id` に一致する events のみで生成する
- 既存の `local_cat_id null` データは、現在選択中の猫の理解度・推測候補には含めない

### latest_hypothesis

- `latest_hypothesis.localCatId` が現在の `active_cat_id` と異なる場合、ホームでは表示しない
- 猫を切り替えた場合、別猫の仮説が混ざらないように `latest_hypothesis` を削除する

### まだ未対応

- `cats` テーブル
- 認証
- RLSのユーザー単位制御
- 複数端末同期
- 家族共有
- 既存 `local_cat_id null` データの移行

## local_cat_id による複数猫履歴分離・本番確認結果

### 確認日

2026-05-02

### 確認できたこと

- `cat_profiles` で複数猫を管理できる
- `active_cat_id` で現在選択中の猫を保持できる
- ホームで猫を切り替えられる
- `events.local_cat_id` に現在選択中の猫IDが保存される
- `diagnoses.local_cat_id` に現在選択中の猫IDが保存される
- `feedbacks.local_cat_id` に現在選択中の猫IDが保存される
- `むぎ` の `active_cat_id` と一致する保存行を確認済み
- 猫ごとに履歴を分けるための保存導線は動作している

### 現時点の判定

MVPとして、麦・雨・テスト猫で実利用テストするための最低限の履歴分離は動作している。

### 注意点

- 現在の `local_cat_id` は localStorage ベースのIDであり、正式な `cats.id` ではない
- 端末をまたいだ同期はまだできない
- 家族共有は未対応
- 認証は未対応
- RLSによるユーザー単位の分離は未対応
- 既存の `local_cat_id null` データは未分類として残っている
- 既存の `cat_id uuid` はまだ利用していない

### 今後の候補

- 猫ごとの記録表示
- 猫ごとの診断履歴表示
- `cats` テーブル設計
- 認証導入
- RLSのユーザー単位制御
- 複数端末同期
- 家族共有

## 「いまの猫」カード反応保存・抑制仕様

### 対象

ホームに表示される `いまの{猫名}` カード。

このカードは、active cat の recent events から軽い仮説を表示する。

### 保存先

`hint_feedbacks`

### 保存する feedback

- `accepted`
- `rejected`
- `dismissed`

### accepted

メインCTA押下時。

例:

- 3分だけ遊ぶ
- ごはんを確認する
- 声をかける
- 静かな場所にする
- 体調を確認する

保存内容:

- `feedback = accepted`
- `metadata.action = primary_cta`
- `metadata.primaryCta`
- `local_cat_id`
- `shown_category`
- `shown_signal`
- `understanding_percent`
- `source_event_ids`
- `calendar_context`
- `metadata.source = current_cat_card`
- `metadata.catName`
- `metadata.headline`

抑制:

- 同じ猫・同じカテゴリを3時間非表示

### rejected

「違うかも」押下時。

保存内容:

- `feedback = rejected`
- `metadata.action = rejected`
- `local_cat_id`
- `shown_category`
- `shown_signal`
- `understanding_percent`
- `source_event_ids`
- `calendar_context`
- `metadata.source = current_cat_card`
- `metadata.catName`
- `metadata.headline`

抑制:

- 同じ猫・同じカテゴリを当日中非表示

### dismissed

「あとで」押下時。

保存内容:

- `feedback = dismissed`
- `metadata.action = dismissed`
- `local_cat_id`
- `shown_category`
- `shown_signal`
- `understanding_percent`
- `source_event_ids`
- `calendar_context`
- `metadata.source = current_cat_card`
- `metadata.catName`
- `metadata.headline`

抑制:

- 同じ猫・同じカテゴリを3時間非表示

### localStorage 抑制仕様

key:

`current_cat_hint_suppression`

形式:

```json
[
  {
    "localCatId": "local-cat-...",
    "category": "play",
    "feedback": "rejected",
    "createdAt": "ISO文字列",
    "suppressUntil": "ISO文字列"
  }
]
```

抑制判定:

- `localCatId` が一致
- `category` が一致
- 現在時刻が `suppressUntil` より前

上記に一致する場合、`いまの{猫名}` カードは表示しない。

期限切れの抑制情報は読み込み時に削除する。

### 優先順位

ホーム上部の表示優先順位は以下。

1. `latest_hypothesis`
2. `いまの{猫名}` カード
3. 理解度別案内文
4. 通常入力UI

### 注意点

- 抑制は localStorage ベースであり、端末をまたいで同期しない
- `hint_feedbacks` は保存専用で、現時点では select しない
- RLSは anon insert のみ
- 診断スコアにはまだ反映しない
- AI学習にはまだ使わない
- `feedbacks` とは別テーブルとして扱う

### 今後の候補

- `rejected` が多いカテゴリの表示抑制をDBベースで行う
- `accepted` が多い仮説を優先表示する
- `dismissed` が多い時間帯では表示頻度を下げる
- `calendar_context` と組み合わせて時間帯別に調整する
- 診断ロジックへ弱く反映する

## 診断結果画面の反応UX・本番確認結果

### 確認日

2026-05-02

### 確認できたこと

- 診断結果画面のメインCTAを押すと `feedbacks` に `resolved` が保存される
- メインCTA押下後に「記録しました。 この子の傾向づくりに使います。」が表示される
- healthカテゴリでは「記録しました。 気になる様子が続くときは、早めに相談してください。」が表示される
- 「違うかも」を押すと `feedbacks` に `unresolved` が保存される
- 「違うかも」押下後に「ありがとう。 違ったことも記録しました。」が表示される
- `latest_hypothesis` 保存処理は維持されている
- `local_cat_id` は維持されている
- `calendar_context` は維持されている

### 現時点の判定

MVPとして、診断結果画面は「結果を読む画面」から「次の行動を決める画面」に近づいている。

診断結果に対するユーザー反応を `resolved / unresolved` として保存し、行動後の納得感を出す土台は動作している。

### 注意点

- 診断結果の `feedbacks` は、診断結果への反応として保存する
- 「いまの猫」カードの反応は `hint_feedbacks` に保存する
- `feedbacks` と `hint_feedbacks` は役割を分けている
- 診断スコアにはまだ反映していない
- AI学習にはまだ使っていない
- `diagnoses / feedbacks / hint_feedbacks` の select は現時点では許可していない

### 今後の候補

- `feedbacks.resolved` が多い診断パターンの優先
- `feedbacks.unresolved` が多い診断パターンの見直し
- 2候補表示の改善
- 診断理由文の精査
- 診断ロジックへの弱い補正
- 診断履歴画面の検討

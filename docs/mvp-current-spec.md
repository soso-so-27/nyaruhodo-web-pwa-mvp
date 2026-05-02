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

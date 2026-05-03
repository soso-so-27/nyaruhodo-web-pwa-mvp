# Decisions

This file records product, logic, UI, schema, and architecture decisions.

Any change to the agreed specification must be recorded here.

# 設計判断：MVPでは calendar_context jsonb で生活文脈を保存する

## 背景

猫の行動は、人間の生活リズムにも影響される。

平日/休日、曜日、時間帯、祝日などによって、飼い主の在宅状況や行動が変わり、猫の行動も変わる可能性がある。

## 判断

MVPでは、events と diagnoses に calendar_context jsonb を追加する。

追加対象：

- events.calendar_context
- diagnoses.calendar_context

## 理由

events に保存することで、日常ログにも生活文脈を残せる。

diagnoses に保存することで、診断時の生活文脈を診断データ側にも残せる。

jsonb にすることで、今後祝日・連休・時間帯などの項目を柔軟に増やせる。

## 想定する形式

```json
{
  "dayOfWeek": 0,
  "dayName": "Sunday",
  "dayType": "weekend",
  "isWeekend": true,
  "isHoliday": false,
  "holidayName": null,
  "timeBand": "morning"
}
```

## timeBand

- early_morning
- morning
- daytime
- evening
- night
- late_night

## dayType

- weekday
- weekend
- holiday

## 今回はまだやらないこと

- 診断スコア補正
- 祝日API連携
- Google Calendar連携
- ユーザー予定連携
- 外部ライブラリ追加
- 既存データ移行
- RLS変更

## 既存データの扱い

既存データは calendar_context null のまま残す。

新規データから保存する。

## 実装メモ

events.calendar_context に、ホームで保存された current_state / concern の生活文脈を保存する。

diagnoses.calendar_context に、診断保存時点の生活文脈を保存する。

現在は weekday / weekend / timeBand の保存が中心で、祝日判定は未対応とする。

祝日は `isHoliday: false`、`holidayName: null` として保存する。

calendar_context は診断スコア補正にはまだ使わない。

将来、平日/休日や時間帯ごとの傾向分析に使う。

## 2026-05-01

### Start With Web/PWA

Decision: Validate the MVP as a Next.js Web/PWA before native development.

Reason: Web/PWA is faster for MVP validation and can still support a future Expo React Native migration if logic and UI remain separated.

### Separate UI And Logic

Decision: Diagnosis logic, scoring, comprehension/confidence calculation, and shared types belong in `/core`.

Reason: This keeps the domain layer reusable for future native implementation and prevents UI components from becoming decision makers.

### Supabase Access Boundary

Decision: Supabase access must go through `/lib/supabase`.

Reason: A single access boundary keeps data access portable, testable, and easier to adapt.

### MVP Screen Scope

Decision: The MVP starts with only Home, meowing diagnosis flow, diagnosis result, and result feedback.

Reason: The first product risk is whether users can quickly input a concern and receive a useful interpretation.

### Home Is Input Only

Decision: Home contains only `いまの様子` and `気になること`.

Reason: Home should stay simple and focused. Action recommendations belong only on diagnosis result screens.

### Deterministic Diagnosis

Decision: Cause ranking is determined by deterministic scoring logic.

Reason: This keeps results explainable and stable. AI may help with wording but does not decide the category ranking.

### Health Override

Decision: Health-related flags prioritize `health`.

Reason: Health concerns should be handled conservatively and should not be hidden by ordinary scoring.

### Database Safety

Decision: DB migrations, RLS creation, SQL operations, and destructive changes require confirmation before execution.

Reason: Database changes can have durable effects. `supabase db reset` is prohibited.

### Memory Feedback Weights

Decision: Feedback is first reflected through in-memory category weights.

Reason: This lets the MVP feel slightly adaptive without introducing database persistence or complex learning logic. `resolved` adds 10 to the selected category weight, and `unresolved` subtracts 10.

### Elapsed Time Context

Decision: Diagnosis context can include `lastFoodMinutes` and `lastPlayMinutes` for core scoring.

Reason: Scenario tests need to distinguish recent food/play from long elapsed time without adding database persistence. Recent food reduces `food`, long elapsed time increases `food`, and recent play reduces `play`.

### Recent Events Context Fallback

Decision: Diagnosis pages may try to read recent `events` to derive `lastFoodMinutes` and `lastPlayMinutes`, but must fall back to fixed context if reads fail or no matching events exist.

Reason: MVP RLS currently allows anon insert only, so select is expected to fail until a later authenticated read policy is designed.

## 2026-05-02

# 設計判断：MVPでは local_cat_id で猫ごとの履歴を暫定分離する

## 背景

MVPでは localStorage ベースで複数猫プロフィールを管理している。

- `cat_profiles`
- `active_cat_id`

ただし、Supabase上の `events` / `diagnoses` / `feedbacks` はまだ猫ごとに分離されていない。

そのため、麦・雨・テスト猫で実利用すると履歴が混ざる。

## 判断

正式な `cats` テーブルはまだ作らない。

MVPでは、localStorage の `active_cat_id` を保存するために、各テーブルに `local_cat_id text` を追加する。

追加対象：

- `events.local_cat_id`
- `diagnoses.local_cat_id`
- `feedbacks.local_cat_id`

## 理由

既存DBには `cat_id uuid null` が存在するが、現在の `active_cat_id` は `local-cat-...` 形式の文字列であり、uuid型の `cat_id` にはそのまま保存できない。

そのため、正式な `cats` テーブル導入までは `local_cat_id text` を使う。

## やること

- `local_cat_id text null` を `events` / `diagnoses` / `feedbacks` に追加する
- 保存時に `active_cat_id` を `local_cat_id` として保存する
- `getRecentEvents` で `local_cat_id` を使って絞り込む
- 理解度と推測候補を猫ごとに分ける

## まだやらないこと

- `cats` テーブル追加
- `profiles` テーブル追加
- 認証追加
- 家族共有
- 複数端末同期
- RLSのユーザー単位制御
- 既存データ移行
- 既存 `cat_id uuid` の変更

## 既存データの扱い

既存の `local_cat_id null` のデータは移行せず、そのまま残す。

必要になれば後から「未分類データ」として扱う。

## 2026-05-03

# 設計判断：今日のヒントは理解度つき仮説として表示する

## 背景

ホームの「今日のヒント」は、単なる診断候補ショートカットではなく、飼い主の迷いを減らすための「まず試せる仮説」として扱う。

## 判断

`latest_hypothesis` がなく、active cat の `events` が3件以上ある場合、recent events から簡易的に推定カテゴリを作り、今日のヒントとして表示する。

表示優先順位は以下のまま維持する。

1. `latest_hypothesis`
2. 今日のヒント
3. 理解度別案内文

## 理由

「鳴いてるをみる」のような候補ショートカットだけでは、ユーザーが次に何をすればよいか分かりにくい。

理解度と仮説カテゴリを併せて表示することで、断定せずに「まず試せる候補」として提示できる。

## 最小実装

- active cat の recent events から、頻度と直近性で仮説カテゴリを決める
- `playing` / `meowing` は `play` として扱う
- `after_food` / `eating` は `food` として扱う
- `following` / `purring` は `social` として扱う
- `restless` / `fighting` は `stress` として扱う
- `low_energy` は `health` として扱う
- 今日のヒントCTAは `feedbacks` に保存しない

## まだやらないこと

- 診断スコア変更
- `calendar_context` を使った補正
- `feedbacks` への今日のヒント保存
- DB変更
- RLS変更
- AI推定

## 2026-05-03

# 設計判断：「今日のヒント」は「いまの{猫名}」カードとして扱う

## 背景

ホームの仮説カードは、診断結果ではなく、active cat の recent events から作る軽い仮説である。

「今日のヒント」という表現では汎用的なヒントに見えやすいため、猫ごとの現在感が伝わる「いまの{猫名}」として扱う。

## 判断

`latest_hypothesis` がなく、active cat の `events` が3件以上ある場合、「いまの{猫名}」カードを表示する。

このカードは診断結果ではなく、間違っていてもよい参考情報として扱う。

## 表示方針

- ラベルは `いまの{猫名}`
- headline は recent events からのカテゴリまたはsignal別仮説
- body は断定を避け、違っていたら下から選び直せることを伝える
- CTAはカテゴリまたはsignalに合わせる
- `違うかも` はDB保存せず、カードを閉じるだけにする

## 理由

にゃるほどの目的は猫の正解を断定することではなく、飼い主の迷いを減らすことである。

「いまの{猫名}」として表示することで、猫ごとの軽い仮説であることが伝わりやすくなる。

## 将来検討

`違うかも` は学習に重要な反応なので、将来的には `hint_feedbacks` テーブルで保存する方針を検討する。

ただし、現時点では `diagnosisId` を持たないため、既存の `feedbacks` には保存しない。

## 2026-05-03

# 設計判断：「いまの猫」カードの反応は hint_feedbacks に保存する

## 背景

「いまの{猫名}」カードは、診断結果ではなく、recent events からの軽い仮説である。

このカードに対する「違うかも」「試した」などの反応は、診断結果への `feedbacks` とは性質が違う。

## 判断

「いまの{猫名}」カードへの反応は、`feedbacks` ではなく `hint_feedbacks` に保存する。

## 理由

- `diagnosis_id` がない仮説にも反応を保存できる
- 診断結果へのフィードバックと混ざらない
- 将来的に「どの仮説が外れやすいか」を分析できる
- `local_cat_id` / `calendar_context` と合わせて、猫ごとの生活文脈を見られる

## まず保存するもの

- `local_cat_id`
- `shown_category`
- `shown_signal`
- `feedback`
- `understanding_percent`
- `source_event_ids`
- `calendar_context`
- `metadata`

## まだやらないこと

- 診断スコアへの反映
- AI学習
- 既存データ移行
- ユーザー認証
- RLSのユーザー単位制御
- select許可

## 2026-05-03

# 設計判断：診断画面の時間帯と反応後UXはユーザー目線に寄せる

## 背景

実利用で、昼でも夜寄りの理由が出る可能性と、診断結果画面でCTA押下後の次の行動が分かりづらいことが分かった。

また、UI上の「仮説」という言葉は開発者目線に見えやすい。

## 判断

- `calendar_context` の生成は `Asia/Tokyo` を明示する
- 診断用の時間帯も日本時間の `timeBand` から作る
- UI上では「仮説」ではなく「さっきの様子から」など自然な表現にする
- 診断結果CTA押下後は、保存完了だけでなく次に何をすればよいかを表示する

## まだやらないこと

- DB変更
- RLS変更
- 診断スコアの大幅変更
- `latest_hypothesis` の保存形式変更
- `feedbacks` / `hint_feedbacks` の保存仕様変更

## 2026-05-03

# 設計判断：MVP主要導線は Playwright E2E で確認する

## 背景

本番確認を毎回アドリブのブラウザ操作にすると、環境差や操作手順の揺れで確認が不安定になる。

MVPの主要導線は、ローカルで再現可能なE2Eとして残す。

## 判断

Playwright E2Eを導入し、今後のMVP主要導線確認には `npm run e2e` を使う。

## 現在確認している導線

- `/diagnose?input=meowing` が表示される
- 昼に `夜なので` が表示されない
- `今の仮説` が表示されない
- `/home` → `鳴いてる` → 診断 → メインCTA
- メインCTA後に `まずは試してみてください` が表示される
- `/home` → `鳴いてる` → 診断 → `違うかも`
- `違うかも` 後に `違ったことも記録しました` が表示される

## 注意点

- 現在はローカルChrome前提
- CI化する場合は、Playwright管理ブラウザやGitHub Actions設定を別途検討する
- 本番URL向けE2Eはまだ未実装

## まだやらないこと

- CI追加
- GitHub Actions追加
- 本番URL向けE2E追加

## 2026-05-03

# 設計判断：MVP画面を開発者UIから日常アプリUIへ寄せる

## 背景

実利用テスト前の確認で、ホームと診断結果画面が「動作確認の画面」に見えやすいことが分かった。

にゃるほどは猫の正解を断定するアプリではなく、飼い主の迷いを減らすアプリなので、ユーザーが日常的に開いたときに「今どこを見ればよいか」「次に何をすればよいか」が自然に分かる見せ方に寄せる。

## 判断

- ホーム上部は `今日の{猫名}` を主役にする
- 理解度は管理指標ではなく「この子のことが少しずつ分かってきた」感覚として表示する
- `いまの様子` / `気になること` は機能名だけでなく、問いかけとして見せる
- 診断結果画面は `診断結果` を補助ラベルにし、`さっきの様子から` を主見出しにする
- 主結果は `いま見えること` として表示し、猫名が分かる場合は猫名を添える
- 既存の保存仕様、診断ロジック、DB、RLSは変更しない

## まだやらないこと

- DB変更
- RLS変更
- 診断ロジック変更
- 保存仕様変更
- 下部ナビの本格実装
- 記録一覧画面
- 診断履歴画面

## 2026-05-03

# 設計判断：ホームは「今日の猫」アプリシェルとして扱う

## 背景

ホーム上部に猫追加や名前変更などの管理操作が並ぶと、日常的に触るアプリではなく、設定画面や開発者向け確認画面に見えやすい。

MVP実利用では、まず「今日の猫を見る」「見たままを記録する」「気になるときに診断する」が迷わず伝わることを優先する。

## 判断

- ホームの主役は `今日の{猫名}` にする
- 猫チップでの日常的な切り替えは上部に残す
- `猫を追加` / `名前を変更` はメイン上部から外し、ページ下部の `ねこの設定` に置く
- 下部ナビは新規ページを作らず、`今日` / `きろく` / `ねこ` のページ内スクロールとして扱う
- `きろく` は入力エリアへ、`ねこ` は `ねこの設定` へ移動する
- 診断結果画面はラベルを減らし、提案文と行動CTAを中心にする

## まだやらないこと

- 新規ページ追加
- 記録一覧画面
- 診断履歴画面
- cats テーブル追加
- 認証追加
- DB変更
- RLS変更
- 保存仕様変更

## 2026-05-03

# 設計判断：猫の管理操作は `/cats` に分離する

## 背景

ホーム上に猫追加や名前変更が残っていると、毎日見る「今日の猫」画面ではなく、管理画面や開発者向けUIに見えやすい。

## 判断

- `/home` は「今日の猫を見る」「サッと記録する」「気になる時に選ぶ」場所として扱う
- 猫チップでの猫切り替えだけを `/home` 上部に残す
- 猫追加・名前変更・猫一覧は `/cats` に移動する
- 下部ナビは `今日 -> /home`、`きろく -> /home#record`、`ねこ -> /cats` とする
- `/cats` でも同じ下部ナビを表示し、`ねこ` を active にする

## まだやらないこと

- `/record` ページ作成
- 設定ページ作成
- cats テーブル作成
- 認証追加
- DB変更
- RLS変更

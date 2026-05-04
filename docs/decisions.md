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

## 2026-05-03

# 下部ナビと画面構成の方針

## 現在の下部ナビ

### 今日

- `/home`
- 今日の猫を見る場所
- いまの提案を見る
- サッと今の様子を残す
- 気になることを選ぶ

### きろく

- 現在は `/home#record`
- まだ独立ページにはしない
- 今はホーム内の記録エリアへ移動するだけ
- 将来的には `/record` として、記録の本体に育てる可能性がある

### ねこ

- `/cats`
- 猫一覧、現在の猫、猫追加、名前変更を置く
- ホームから管理系UIを外すための受け皿
- 将来的には猫プロフィール、写真、誕生日、性別、体重、フード、かかりつけ病院などを置く

## ホームの役割

ホームは「今日の猫を見る場所」とする。

ホームに置くもの：

- 今日の{猫名}
- いまの提案
- さっきの様子から
- サッと残せる今の様子
- ちょっと気になることの入口
- 猫チップでの切り替え

ホームに置かないもの：

- 猫追加
- 名前変更
- 設定
- マイページ
- 管理系UI

## きろくの将来方針

ホームからインプットが消えるわけではない。

方針：

- ホーム = サッと残せる入口
- きろく/のこす = 詳しく残す本体

将来的に `きろく` または `のこす` に入る可能性があるもの：

- いまの様子
- 気になること
- ごはん
- トイレ
- 遊び
- 写真
- メモ
- 体重
- 通院
- 薬
- 吐いた/下痢/ケガなどのインシデント

ただし、MVPではまだ `/record` は作らない。

## ふりかえるの将来方針

現時点では下部ナビに出さない。

将来的に記録が溜まってきたら検討する。

入る可能性があるもの：

- 記録一覧
- カレンダー
- 最近の記録
- 週まとめ
- 診断履歴
- 体重グラフ
- 病院用レポート
- 思い出アルバム

## 設定/マイページの方針

現時点では作らない。

理由：

- 認証がまだない
- 課金がまだない
- 通知設定がまだない
- ユーザー管理より、猫の体験を優先するため

将来的に必要になったら、下部ナビではなく、右上アイコンまたは `ねこ` 内から入る。

将来入る可能性があるもの：

- アカウント
- ログイン
- 通知設定
- 家族共有
- プラン/課金
- データ管理
- お問い合わせ
- 利用規約
- プライバシーポリシー

## 判断方針

- ホームには毎日見るものだけ置く
- 管理操作はホームから外す
- 記録系が増えたら、ホームではなく `きろく/のこす` に逃がす
- ただしホームから最短インプットは消さない
- 設定/マイページは下部ナビに出さない
- 新規ページは必要になるまで増やさない

# 設計判断：ホームをプロフィールカードとアクションタイル中心に寄せる

## 背景

スマホアプリとして日常的に開いてもらうため、ホームは入力フォームではなく「今日の猫を見る場所」として見せる。

添付モックの方向性を参考にしつつ、にゃるほどのMVP仕様に合わせて、プロフィールカード、提案カード、アイコン付きアクションタイルの構成へ寄せる。

## 判断

ホーム上部は、猫の仮アイコン、猫名、関係性メッセージ、理解度のやわらかい表示、猫チップ切り替えをまとめたプロフィールカードとして扱う。

`latest_hypothesis` や `いまの{猫名}` カードは、診断結果の残りではなく、ホームの自然な提案カードとして見せる。

`いまどうしてる？` の選択肢は、フォームボタンではなくアイコン付きアクションタイルとして見せる。

下部ナビは現在の方針どおり、`今日` / `きろく` / `ねこ` を維持する。

## まだやらないこと

- `/record` ページ追加
- 診断履歴ページ追加
- マイページ追加
- 設定ページ追加
- 認証追加
- cats テーブル追加
- DB変更
- RLS変更

## 注意点

猫追加・名前変更はホームには戻さず、`/cats` に置く。

ホームは、毎日見るもの、サッと残すもの、気になるときの入口だけに絞る。

## 2026-05-03

# 設計判断：ホームには猫チップ切り替えだけを残す

## 背景

猫追加や名前変更は管理操作なので `/cats` に移したが、複数猫の実利用では、ホームで今見る猫を素早く切り替えられる必要がある。

## 判断

- `/home` 上部の `今日の{猫名}` 付近に猫チップ切り替えを残す
- 選択中の猫は濃いチップで示す
- `猫を追加` と `名前を変更` は `/home` には戻さず、引き続き `/cats` に置く
- `/cats` への導線は下部ナビの `ねこ` で維持する
## 2026-05-04

# 設計判断：診断オンボーディング v1 は localStorage の猫プロフィールへ保存する

## 背景

診断オンボーディングは、猫のタイプを断定するためではなく、飼い主の迷いを減らすための初期理解データを作る入口として扱う。

## 判断

MVP v1 では `/diagnosis-onboarding` を追加し、名前入力と Q1〜Q3 のみを実装する。
3問後の軽い結果は `buildOnboardingResult` で作り、`cat_profiles` の猫プロフィールに type / modifiers / onboarding / understanding を保存する。

## 理由

- 認証なしMVPでは cats テーブルをまだ作らない
- 3問だけで「この子を少し知れた」体験を出したい
- 保存先を既存の `cat_profiles` に寄せることで、`active_cat_id` と `/home` 表示につなげやすい
- DBスキーマやRLSを変えずに検証できる

## まだやらないこと

- Q4〜Q30 のUI実装
- Supabase保存
- cats テーブル作成
- 認証追加
- 診断スコアへの反映
- E2E追加
## 2026-05-04

# 設計判断：初回導線は診断オンボーディングを入口にする

## 背景

初回ユーザーには、使い方説明よりも「うちの猫、どんなタイプ？」という軽い体験から入ってもらう方が、にゃるほどの価値である「迷いを減らす」に近い。

## 判断

`onboarding_completed` が未設定または `true` 以外の場合、初回導線は `/diagnosis-onboarding` に誘導する。
`/diagnosis-onboarding` の `ホームで見る` で `cat_profiles` と `active_cat_id` を保存し、同時に `onboarding_completed = true` を保存する。

既存の `/onboarding` は削除せず、直接アクセスは残す。

## まだやらないこと

- 既存 `/onboarding` の削除
- Q4〜Q30 の画面実装
- DB保存
- cats テーブル作成
- 認証追加

## 2026-05-04

# 設計判断：診断オンボーディングは3問後に追加回答を主導線にする

## 背景

診断オンボーディングの3問後結果は「最初の手がかり」として表示するが、3問だけでホームへ進む導線が主役になると、まだ分かっていないのに完了した印象が出やすい。

## 判断

3問後の結果画面では `もう少し答えてみる` を主CTAにし、`ホームで見る` は副CTAとして残す。追加質問はまず Q4〜Q15 までを画面実装し、Q16〜Q30 は今回まだ実装しない。

## 理由

- 3問だけではタイプを確定せず、初期の手がかりとして扱う
- 追加で答えるほど傾向が見えてくる体験にする
- 途中でも `結果を見る` / `あとでホームへ` で離脱できるようにして、オンボーディングを重くしすぎない
- MVPでは localStorage の `cat_profiles` に answeredCount / skippedCount / understanding を保存し、DB変更はしない

## ホーム理解度との関係

ホームの理解度は events 件数だけでなく、cat_profiles に保存された onboarding 由来の understanding も参照する。これにより、3問以上回答した直後にホームで理解度が 0% のまま見える違和感を避ける。

## まだやらないこと

- Q16〜Q30 の画面実装
- Supabase 保存
- cats テーブル追加
- RLS 変更
- 診断スコアへの大幅反映

## 2026-05-04

# 設計判断：下部ナビと気になることタイルの視覚リズムを揃える

## 判断

下部ナビの `今` / `記` / `猫` の文字アイコンはプロトタイプ感が出やすいため、線画アイコンへ寄せる。`ちょっと気になる？` も3列×2行にし、通常記録タイルと視覚リズムを揃える。

## 現時点の扱い

- 今日: `/home`
- きろく: `/home#record`
- ねこ: `/cats`

`きろく` は現時点では `/home#record` のままにし、将来 `/record` に育てる前提とする。今回は `/record` ページは作らない。

## 2026-05-04

# 設計判断：下部ナビは一旦「今日 / ねこ」に絞る

## 判断

現時点では下部ナビを `今日` / `ねこ` の2つに絞る。`きろく` は独立した `/record` を作る段階で再追加を検討する。

## 理由

- ホームにはすでに最短の記録導線がある
- 現在の `きろく` は `/home#record` への移動だけで、独立タブとしての価値がまだ弱い
- 未完成タブ感を減らし、ホームを「今日の猫を見る場所」として軽くする
- 猫切り替えは日常操作なのでホームに残す
- 猫追加・名前変更は管理操作なので `/cats` に置く

## 2026-05-04

# 設計判断：猫切り替えはホーム見出しに折りたたむ

## 判断

ホーム上部では小見出しの `今日の猫` を出さず、`今日の{猫名}` を主見出しにする。猫が複数いる場合のみ見出しに小さな開閉アイコンを出し、タップしたときだけ猫チップ一覧を表示する。

## 理由

- 猫切り替えは日常操作だが、ホームの主役ではない
- 常時チップ一覧を出すと今日の猫カードの縦幅が増え、入力エリアまでの距離が伸びる
- 猫追加・名前変更は管理操作なので `/cats` に置き、ホームには戻さない
- ホームは `今日の{猫名}` から、提案と記録に自然につながる画面として扱う

## 2026-05-04

# 設計判断：iOS safe area もアプリ背景と一体化する

## 判断

`viewport-fit=cover` を設定し、`html` / `body` / PWA manifest のベース背景色をアプリ背景の `#f7f3ee` に統一する。`body` には `env(safe-area-inset-top)` の top padding を持たせ、iPhone の status bar 領域だけ白く残らないようにする。

## 理由

- iPhone 表示で status bar / safe area だけ白く見えると、Webページ感が強くなる
- 画面本体と上端背景を一体化し、PWAらしい見え方に寄せる
- カード配置や保存仕様には触れず、最上位背景だけを揃える

## 2026-05-04

# 設計判断：オンボーディング後と日常記録後のコピーを体験につなげる

## 判断

日常記録後の成功文言を、単なる保存完了ではなく「この子のことが少しずつ見えてくる」体験に接続する。診断オンボーディングからホームへ遷移した直後は、一度だけ軽い接続文を表示し、最初の回答がホームの記録体験につながったことを伝える。

複数猫がいる場合は、ホーム見出し付近に「猫名をタップして切り替え」を小さく表示し、猫切り替えの気づきを補助する。

15問回答後のオンボーディング結果は、断定を避けつつ「ここまで答えた報酬感」が出るように、少しだけ強い文言にする。

## 理由

- `今日の様子を記録しました。` だけだと事務的で、アプリ価値に接続しにくい
- 初回3問後にホームへ進んだとき、回答した意味がホームに残らないと体験が途切れる
- 多頭飼いでは、見出しタップで切り替えられることに気づきにくい可能性がある
- 15問後は、決めつけずに「少し深まった」感を出した方が継続しやすい

## まだやらないこと

- DB変更
- RLS変更
- Q16〜Q30の画面実装
- 診断ロジック変更
- 記録画面の追加

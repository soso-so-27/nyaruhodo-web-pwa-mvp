# Decisions

This file records product, logic, UI, schema, and architecture decisions.

Any change to the agreed specification must be recorded here.

## 2026-05-04

# 設計判断：/cats の管理要素は1カードにまとめて軽く見せる

## 判断

`/cats` では、いま見ている子・猫一覧・猫追加・名前変更を別々のカードに分けず、「一緒に暮らしている子」カード内にまとめる。

## 理由

現時点の `/cats` は猫プロフィール詳細ページではなく、猫の切り替え・追加・名前変更を行う軽い管理ページである。機能量に対してカードを分けすぎると設定画面感が強くなるため、1〜2カード構成にして「猫ごとの情報をまとめる場所」として見せる。

## 現時点の扱い

- ヘッダーは維持する
- 下の管理要素は「一緒に暮らしている子」カードへ集約する
- 猫追加・名前変更は小さめのアウトラインボタンとして並べる
- 猫追加・名前変更の処理は変更しない
- DB変更なし
- RLS変更なし

## 2026-05-04

# 設計判断：/cats は設定画面ではなく猫ごとの情報をまとめる場所として扱う

## 判断

`/cats` は、猫追加や名前変更だけの設定画面ではなく、一緒に暮らしている子の情報を見て管理する場所として扱う。

## 理由

ホームは「今日の猫を見る場所」として日常利用に集中させる。猫追加・名前変更などの管理操作は `/cats` に置きつつ、文言は管理画面っぽくしすぎず、「この子のことをまとめる場所」として伝える。

## 現時点の扱い

- ページ説明は「一緒に暮らしている子のことをここにまとめます。」
- 「いま見ている子」カードには、取れる場合だけ理解度を補助表示する
- 猫一覧は「一緒に暮らしている子」として表示する
- 名前変更は「名前を変える」「いま見ている子の呼び名を変えられます。」とする
- 猫追加・名前変更の処理は変更しない
- DB変更なし
- RLS変更なし

## 2026-05-04

# 設計判断：日常記録タイルは保存後に短時間だけ完了状態を出す

## 判断

ホームの「いまどうしてる？」タイルは、保存成功後に同じ猫・同じ signal のタイルを30分だけ完了状態として表示する。

## 理由

日常記録は義務ではなく、見たままを残す軽い体験として扱う。押したあとにタイルがすぐ通常状態へ戻ると、記録できた手応えやたまっていく感じが弱いため、DBは変えずに localStorage の一時状態で「残しました」を見せる。

## 現時点の扱い

- localStorage key は `recent_state_records`
- 保存内容は `localCatId / signal / label / createdAt / expiresAt`
- 期限は30分
- 同じ `localCatId + signal` の期限内データがある場合だけ完了表示にする
- 別猫の完了状態は混ぜない
- 期限切れデータは読み込み時に削除する
- `events` 保存仕様は変更しない
- DB変更なし
- RLS変更なし

## 2026-05-04

# 設計判断：診断画面の初期表示は提案と結果入力に集中させる

## 判断

診断画面では、初期表示で見える情報を「さっきの様子から」「提案文」「見立ての短文」「結果ボタン」に絞る。

## 理由

診断画面はロジック説明を読む場所ではなく、提案を試して結果を返す場所として扱う。理由文と第2候補を常時表示すると、ユーザーがまず何をすればよいかが弱くなるため、どちらも折りたたみ表示にする。

## 現時点の扱い

- 上部の説明文は削除する
- ホームに戻る導線は上部の1箇所にする
- 理由は「理由を見る」で開閉する
- 第2候補は「ほかの見方も見る」で開閉する
- `feedbacks` 保存仕様は変更しない
- `latest_hypothesis` / `post_diagnosis_feedback` の扱いは変更しない
- DB変更なし
- RLS変更なし

## 2026-05-04

# 設計判断：診断結果画面は提案文を主役にする

## 判断

診断結果画面では、`診断結果` ラベルや `いま見えること` の独立カードを弱め、提案文を最初に読ませる。

主な見立ては提案カード内の補足として表示し、その下に「試したあと、近い方を選んでください。」と結果ボタンを置く。

## 理由

ラベルとカードが多いと、ユーザーが「次に何をすればいいか」を読む前に構造理解が必要になる。

診断結果画面はロジック確認画面ではなく、提案を試して結果を返す画面として扱う。

## 現時点の扱い

- `meowing`: `落ち着いた / まだ鳴いてる`
- その他: `落ち着いた / まだ気になる`
- `health`: `少し落ち着いた / まだ気になる`
- 理由文は小カードを並べず、ひとつの説明文として表示する
- 第2候補は `ほかにも` の控えめな補足として残す
- `feedbacks` 保存仕様は変更しない
- DB変更なし
- RLS変更なし

## 2026-05-04

# 設計判断：診断結果の反応後はホームで一度だけ受け止める

## 判断

診断結果の結果ボタンで `feedbacks` 保存に成功した場合、`post_diagnosis_feedback` を localStorage に一時保存してから `/home` へ戻す。

ホームでは active cat と一致する場合だけ一度表示し、表示後に `post_diagnosis_feedback` を削除する。

## 理由

結果ボタン押下後に通常ホームだけへ戻ると、押した結果がどう扱われたか分かりにくい。

ホームは日常に戻る場所なので、長い確認画面は挟まず、短いフォロー文で「記録されたこと」と「次にできること」を伝える。

## 現時点の扱い

- `resolved`: 落ち着いたことを記録した旨を表示する
- `meowing` の `resolved`: 鳴きやんだことを記録した旨を表示する
- `unresolved`: まだ気になることを記録した旨を表示する
- `meowing` の `unresolved`: まだ鳴いていることを記録した旨を表示する
- `health` の `unresolved`: 無理に判断せず相談も考える文言にする
- 結果ボタン押下後は `latest_hypothesis` を削除する
- DB変更なし
- RLS変更なし

## 2026-05-04

# 設計判断：診断結果画面は試した結果を受け取る画面にする

## 判断

診断結果画面では、行動をCTAとして押させず、提案文として表示する。

提案文の下に「試したあと、教えてください。」を置き、結果ボタンで `resolved / unresolved` を保存する。

結果ボタン押下後は確認カードを挟まず `/home` へ戻し、対応済みの `latest_hypothesis` は削除する。

## 理由

「3分だけ遊んでみる」などの行動CTAは、押した時点で「これから試す」「もう試した」「解決した」の意味が曖昧になる。

診断画面は提案を出し、ユーザーが試した後の結果を返す画面にすることで、保存される `feedbacks` の意味を分かりやすくする。

## 現時点の扱い

- 鳴いてる場合は `鳴きやんだ / まだ鳴いてる`
- 通常カテゴリは `落ち着いた / まだ気になる`
- health は `少し落ち着いた / まだ気になる`
- `feedbacks` の保存値は既存通り `resolved / unresolved`
- DB変更なし
- RLS変更なし

## 2026-05-04

# 設計判断：診断結果のメインCTA後はホームへ戻す

## 判断

診断結果画面のメインCTAは、`feedbacks` に `resolved` を保存できたら、確認カードを挟まず `/home` へ戻す。

`違うかも` は現時点では従来通り、`unresolved` を保存したあとに「違ったことも記録しました」カードを表示する。

## 理由

診断結果画面は、気になる行動に対して次の一手を決めるための画面とする。

メインCTAを押した後にさらに「ホームで様子を見る」を押す必要があると、行動完了までのステップが長く見えるため、保存成功後はすぐホームへ戻す。

ホームに戻った後は、既存の `latest_hypothesis` 表示で、さっきの見立てを受けた文脈を維持する。

## まだやらないこと

- `feedbacks` 保存仕様変更
- `latest_hypothesis` 保存形式変更
- `違うかも` の即ホーム遷移
- DB変更
- RLS変更

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

## 2026-05-04

# 設計判断：診断結果とねこ画面のコピーを生活者目線に寄せる

## 判断

診断結果画面のラベルを、機能説明ではなく飼い主が読んで自然な言葉に寄せる。

- `まずはここから` は `いま見えること` とする
- `手がかり` は `そう見た理由` とする
- `まずは少しだけ` は `できそうなこと` とする

`違うかも` 後は、短い保存メッセージと次アクションカードが重複して見えないように、次アクションカード側へ文言を集約する。

`/cats` は管理画面ではなく、一緒に暮らしている子の情報をまとめる場所として表現する。

## まだやらないこと

- 診断ロジック変更
- feedbacks / hint_feedbacks の保存仕様変更
- DB変更
- RLS変更

## 2026-05-04

# 設計判断：オンボーディング傾向は診断で弱い補正に留める

## 判断

診断オンボーディングで保存した `typeKey` は、日々の診断で強い決定要因にせず、入力と矛盾しない場合だけ弱い補正として使う。

補正量は最大 `+0.5` 程度とし、今の行動、直近イベント、時間帯文脈を主軸にする。

## 現時点の扱い

- `play`: `meowing` / `restless` のとき `play` を少しだけ補正する
- `food`: `meowing` のとき `food` を少しだけ補正する
- `social`: `following` / `meowing` のとき `social` を少しだけ補正する
- `stress`: `restless` / `fighting` のとき `stress` を少しだけ補正する
- `balanced`: 補正しない

`modifiers` は現時点では強いスコア補正に使わず、health 系の注意補足に使える場合だけ控えめに扱う。

## まだやらないこと

- オンボーディングだけで診断結果を決めること
- health を `typeKey` として扱うこと
- DB変更
- RLS変更

## 2026-05-04

# 設計判断：再訪理由とデータ活用納得感は控えめな表示で補う

## 判断

MVP v0.2 では、新機能を増やさず、既存データを使った小さな文言で再訪理由とデータ活用納得感を補う。

ホームでは active cat の `events` を見て、今日の記録有無や前回記録を控えめに表示する。記録を義務にせず、「気づいたら足す」程度の文言に留める。

診断では、オンボーディング `typeKey` の弱補正が実際に効いた場合だけ、理由文に「これまでの回答では...」という一文を追加する。補正が効いていない場合は表示しない。

Q4〜Q15途中の離脱導線は、作業感を弱めるため `いま見えていることを見る` / `今日はここまで` とする。

## まだやらないこと

- DB変更
- RLS変更
- Q16〜Q30画面実装
- 診断ロジックの強い補正

## 2026-05-04

# 設計判断：オンボーディング直後の猫プロフィール反映を安定させる

## 判断

診断オンボーディング直後の `/home` では、localStorage の `cat_profiles` / `active_cat_id` を初期 state として読み、`cat_profiles.understanding.percent` を初回表示から理解度に反映する。

これにより、events がまだ0件でも、オンボーディング回答由来の理解度が 0% に戻って見える違和感を避ける。

名前入力は、入力中の値とオンボーディング内で使う確定名を分ける。trim 後に入力があれば必ずその名前を使い、デフォルト名 `ミケ` は本当に未入力の場合だけ使う。

## まだやらないこと

- cat_profiles のDB化
- localStorage key の変更
- DB変更
- RLS変更

## 2026-05-05

# 設計判断：MVPでは毛色別の標準アバターを使う

## 判断

Phase 2.5 として、写真アップロードや個別生成の前に、`cat_profiles[].appearance.coat` に応じた標準猫アバターを使う。

`/home` の猫カードでは、毛色別アバターをメインに表示し、いま/さいきんの代表 signal は右下の小さな状態バッジとして扱う。

## 理由

- 毛色選択だけでも「うちの子感」を少し上げられる
- 写真アップロードやStorage/DB化を急がず、MVPの軽さを維持できる
- 状態連動アイコンは残しつつ、猫そのものの見た目と状態を分けて見せられる

## まだやらないこと

- 写真アップロード
- OpenAI画像生成API利用
- 個別アバター生成
- 毛色別の状態アイコン大量生成
- DB変更
- RLS変更

# 標準猫アバターは action icon 寄せの線画候補を採用する

## 判断

毛色別の標準猫アバターは、比較候補のうち `pattern-c-action-icon-like` を採用する。
既存の「いまどうしてる？」タイルで使っている猫アイコンの雰囲気に寄せ、かわいいが目立ちすぎない線画メインの方向にする。

毛色は `cream` をやめ、`saba` を選択肢にする。
既存 localStorage に `cream` が残っている場合は、読み込み時に `saba` として扱う。

## 理由

- 既存のホームアクションタイルとトーンが揃う
- 猫カード内で主張しすぎず、淡いUIに馴染む
- `saba` / `gray` / `orange_tabby` / `black` / `white` / `calico` の差が小さくても分かる
- 写真生成や個別アバター生成の前に、MVPとして軽く「うちの子感」を出せる

## まだやらないこと

- 写真アップロード
- 個別アバター生成
- 毛色別の状態アイコン生成
- DB変更
- RLS変更

# ホーム猫カードのアバターは毛色別アバター + 毛色アクセントに戻し、状態バッジは使わない

## 判断

Phase 2.5 で選んだ毛色別標準アバターは、ホーム猫カードと `/cats` の主アバターとして使う。
一方で、状態バッジはホーム猫カードでは使わない。

`cat_profiles[].appearance.coat` の保存と `/cats` の毛色選択は維持する。
`appearance.coat` は、毛色別アバターの選択と背景色・枠線などの軽いアクセントに使う。

## 理由

- 毛色別アバターは「この子専用感」に効くため、メインアバターとして残す
- 状態バッジは小さく、意味が伝わりにくい
- メインアバターと状態バッジを同時に置くと、猫カードがごちゃついて見える
- 状態は「さいきんの猫」「いまの猫」「1日ミニマップ」で伝えた方が自然

## まだやらないこと

- 毛色別アバターの再生成
- 状態バッジの再設計
- 写真アップロード
- 個別アバター生成
- DB変更
- RLS変更

# 下部ナビを ほーむ / ねこ / いっしょ の3タブにする

## 判断

下部ナビを `ほーむ`、`ねこ`、`いっしょ` の3タブ構成にする。
`ほーむ` は既存の `/home`、`ねこ` は既存の `/cats`、`いっしょ` は新規 `/together` を指す。

`/together` は、猫単体のプロフィールではなく、ユーザーと active cat の関係を見る場所とする。
既存の `cat_profiles`、`active_cat_id`、active cat の `events` を使い、DB変更なしで関係まとめ、直近7日の記録日数、見た回数、最近の変化、関係スコア、バッジを表示する。

## 理由

- にゃるほどを単なる記録アプリではなく「自分と猫の関係が見えるアプリ」に寄せる
- `/home` は今日の猫を見る場所、`/cats` は猫の情報と管理、`/together` は関係とふりかえりの入口として役割を分ける
- 家族共有、思い出、週まとめ、受診レポート、Pro機能の将来導線を、いきなり実装せずにMVP表示で検証できる

## まだやらないこと

- DB変更
- RLS変更
- 認証
- 家族共有
- 写真アップロード
- 体重入力
- 課金
- AI要約
- 医療診断

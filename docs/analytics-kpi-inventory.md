# Analytics KPI Inventory v2.1

更新日: 2026-08-01
対象: 現行4匹ねこくじオンボの初動と、先行期の日次運用

## 1. 先に答える問い

初動では、次の順に答える。

1. bioから来た人が、2画面目のねこくじ説明まで進んだか
2. 保存前確認のあと、最初の写真を正式な `うちのこ` の1枚として保存できたか
3. 4匹を表示し、気になる1匹を大きく見て、確定または選ばず完了できたか
4. 最初の写真で、次の20時便を内部予約できたか
5. 20時に、再訪して確認を始めた人の4匹が成立したか
6. 翌日も写真を入れた人がいるか

管理画面: `/admin/analytics`

管理画面は60秒ごとに自動更新する。投稿直後は `直近60分`、当日全体は `きょう` を使う。率だけで判断せず、必ず人数と母数を一緒に見る。

## 2. 初回体験ファネル

管理画面の「写真先行オンボ」で、同じ人が期間内に順番どおり通過した人数を数える。
`onboarding_intro_view` は全体の入口として別に確認する。

| 順 | イベント | 意味 |
| --- | --- | --- |
| 1 | `onboarding_kuji_intro_view` | 2画面目のねこくじ説明を見た |
| 2 | `onboarding_photo_submitted` | 自分の写真を正式な `うちのこ` の1枚として保存した |
| 3 | `onboarding_preview_shown` | 4匹を表示した |
| 4 | `onboarding_delivery_choice_selected` | 気になる1匹を大きく見て選んだ |
| 5 | `onboarding_delivery_choice_saved` | 選んだ1匹をその日の `ねこだより` にした |

`onboarding_delivery_choice_skipped` は、4匹から1匹を選ばず正常に完了した人数として
ファネルの外へ併記する。`onboarding_completed` は、1匹の確定または選ばず完了のあとに
オンボを終えたことを確認する全体指標である。

保存前の詰まりを詳しく調べる場合だけ、`onboarding_photo_selected_for_review` と
`onboarding_photo_confirmed` を見る。前者はまだ正式保存前、後者は保存操作の確定である。
`onboarding_preview_shown`、選択、確定は `candidate_count=4` を確認する。

`photo_submitted` は `onboarding_photo_submitted` の汎用別名なので、継続回数には重ねて数えない。

次の20時便の予約は2枚目の入力ではなく、最初の写真保存時に内部で自動実行する。
`evening_delivery_reserved` はユーザー向けオンボの順序へ混ぜず、独立した成果線として見る。
1匹を選ぶ前の画面では20時便を約束しないが、内部予約の成立確認は継続する。

旧 `onboarding_delivery_arrived` / `onboarding_delivery_opened` の即時表示ファネルと、
`onboarding_second_photo_prompt_view` / `onboarding_second_photo_submitted` は過去記録としてだけ残す。

### 初回夜便ファネル

同じ利用者が、オンボで準備した次の20時便で1匹を確定するまでを次の順で数える。

| 順 | イベント | 意味 |
| --- | --- | --- |
| 1 | `evening_delivery_reserved` | 最初の写真で次の20時便を予約できた |
| 2 | `evening_delivery_check_started` | 対象時刻以降に20時便の確認を開始した |
| 3 | `evening_delivery_check_succeeded` | 20時便の4匹を準備・保存できた |
| 4 | `evening_delivery_choices_shown` | 4匹を表示した |
| 5 | `evening_delivery_choice_selected` | 気になる1匹を選んだ |
| 6 | `evening_delivery_choice_saved` | 選んだ1匹を `ねこだより` にした |

`evening_delivery_choice_skipped` と `evening_delivery_choice_auto_skipped` は、
1匹を残さず正常に解決した別結果として併記する。

同じ日付の対象がすでにある場合は、`evening_delivery_reservation_skipped` の
`reason=existing_target_preserved` が手順1の正常な別結果になる。新規 `reserved` だけを
写真保存人数と比較しない。`evening_delivery_target_repaired` まで進んだ予約欠けは回復済みとして分ける。

内部運用と管理画面の呼称は `次の20時便` に統一する。20:00より前の初回写真は当日、20:00以降は翌日の便を対象にする。

## 3. 初動で見る順序

### 投稿直後から15分

1. `Instagram bio` の入口人数が増えているか
2. ねこくじ説明から写真保存まで、どこで人数が止まっているか
3. 写真保存人数と4匹表示人数に未回復の差がないか
4. 4匹表示から、1匹確定または選ばず完了まで進めたか
5. `要確認` に同じエラーが複数人で出ていないか
6. iPhone / Android、Instagram内 / LINE内 / Safari・Chromeのどこで起きたか

入口が5人未満の間は率で良否を決めず、一人ずつの経路を見る。5人以上になったら、
写真保存率、4匹表示率、1匹確定・選ばず完了を補助線として使う。

### 19時まで

1. `次の20時便を予約した` と `既存対象を維持した` 人数を確認
2. 管理画面のモデレーションキューで pending を全件確認
3. 写真保存失敗、原本保全失敗、夜便予約の自動修復が増えていないか確認

モデレーション待ち件数は `app_events` ではなく、管理画面の実データを正とする。

### 20:00から20:15

1. `20時便の確認を開始` と `20時便が成立` の人数を比較
2. 失敗・長時間化が0か確認
3. 成立後に `4匹を表示` が増えるか確認
4. 1匹確定と選ばず完了を体験指標として見る。選ばないことだけでは障害と断定しない

画面を開かない人は20時便の確認自体が走らない。予約人数と開始人数の差は「未再訪」、開始人数と成立人数の差は「技術的な要確認」と分ける。

### 翌朝

1. `翌日も写真を入れた` 人数
2. 前夜の失敗が再訪時の自動修復で回復したか
3. PWAとして起動した人数

## 4. 止める判断

次は率に関係なくP0として公開を止め、個別確認する。

- 写真の消失、他人への誤配、共有範囲の誤りが1件でもある
- 保存確定前の正式保存、写真保存後の4匹取得不能、選択結果の不一致が1件でもある
- 写真読込または保存で、同じ停止エラーが別の2人に出る
- 内部の次回20時便予約が作られない、または既存対象が上書きされた
- 20時便の確認を開始した人に対し、再試行後も成立しない人がいる
- 操作不能や復帰不能の白画面がある

次は改善シグナルだが、単独では公開停止にしない。

- 写真選択後の離脱
- 4匹を表示したあと、1匹を選ばず正常に完了する
- 自動予約後、対象時刻に再訪しない
- アプリ追加案内を閉じる

## 5. 20時便の主要イベント

| イベント | 意味 |
| --- | --- |
| `evening_delivery_reserved` | オンボの最初の写真で次の20時便を予約した |
| `evening_delivery_reservation_skipped` | 既存の別予約を維持した、または補完期限を過ぎたため新しい予約を作らなかった |
| `evening_delivery_reservation_failed` | 初回写真の夜便予約を保存できなかった、または予約枠を利用できなかった |
| `home_exchange_share_photo_confirmed` | 共有する一枚を保存した |
| `evening_delivery_check_started` | 20時便の確認を開始した |
| `evening_delivery_check_succeeded` | 20時便の4匹を準備・保存できた |
| `evening_delivery_check_failed` | 確認または保存に失敗した |
| `evening_delivery_check_timeout` | 確認が長時間化した |
| `evening_delivery_target_repaired` | 軽量予約を再訪時に修復した |
| `evening_delivery_choices_shown` | 20時便の4匹を表示した |
| `evening_delivery_choice_selected` | 4匹から気になる1匹を選んだ |
| `evening_delivery_choice_saved` | 選んだ1匹を `ねこだより` にした |
| `evening_delivery_choice_skipped` | 1匹を選ばず正常に完了した |
| `evening_delivery_choice_auto_skipped` | 保存期限後に1匹を残さず自動で解決した |

オンボ起点の予約イベントには、最初の写真保存で作った正規の `submission_id` を共通で入れる。
`own_photo_id` を `submission_id` の代わりに使わない。`reservation_origin=onboarding_first_photo`、
`experience_version=onboarding_choice_v1`、対象日の `delivery_date_key` も確認に使う。

再開・再訪・端末間引き継ぎでは、対象便の翌日05:00まで、予約が欠けている場合だけ補完する。既存の別写真の予約は上書きしない。旧2枚目URLは現行導線へ静かに正規化し、旧プロンプトを成果として数えない。

## 6. 環境と流入

新規イベントには、個人を特定しない粗い分類だけを付ける。

- `device_os`: `ios` / `android` / `desktop` / `other`
- `browser_context`: `instagram` / `line` / `facebook` / `wechat` / `embedded_other` / `browser` / `standalone`
- `source`: `instagram_bio` / `instagram_story` / `instagram_dm` / `instagram` / `referral` / `direct` / `unknown`

User-Agent全文、写真URL、Storageパス、猫の名前、メール、位置情報は保存しない。

## 7. 継続の定義

- 利用した人: 期間内に何らかのイベントがある人
- 写真を入れた人: 初回写真またはホームの保存操作がある人
- 期間内に2枚以上: 同じ人に正規の写真保存操作が2回以上ある
- 翌日も写真を入れた: JSTで連続する2日に写真保存がある

ホームの共有保存は `home_exchange_share_photo_confirmed`、自分だけ保存は `home_exchange_share_photo_declined` を1操作として数える。

## 8. 既知の限界

- iOSは「ホーム画面に追加した瞬間」の完了イベントをWeb側で取得できない。後日の `standalone` 起動で確認する
- 旧イベントには `device_os` / `browser_context` がないため「不明・旧記録」になる
- 管理画面と読み取り専用スクリプトは1期間20,000件までページ取得する。上限到達警告が出た期間は全件集計と断定しない
- 匿名からGoogleログインへ切り替わる前後は、同じ人が別IDとして見える場合がある
- アナリティクス送信失敗は製品体験を止めず、ローカルキューから後で再送する

# Analytics KPI Inventory v2.0

更新日: 2026-07-16
対象: Instagram投稿3の初動と、先行期の日次運用

## 1. 先に答える問い

初動では、次の順に答える。

1. bioから来た人が、最初の写真を入れられたか
2. その場のねこだよりが、届いて開けたか
3. 次の20時便に向けた一枚を入れられたか
4. 20時に、対象者全員の便が成立したか
5. 翌日も写真を入れた人がいるか

管理画面: `/admin/analytics`

管理画面は60秒ごとに自動更新する。投稿直後は `直近60分`、当日全体は `きょう` を使う。率だけで判断せず、必ず人数と母数を一緒に見る。

## 2. 初回体験ファネル

同じ人が期間内に順番どおり通過した人数を数える。

| 順 | イベント | 意味 |
| --- | --- | --- |
| 1 | `onboarding_intro_view` | オンボの入口を見た |
| 2 | `onboarding_photo_select_click` | OSの写真選択を開いた |
| 3 | `onboarding_photo_submitted` | 最初の写真を保存できた |
| 4 | `onboarding_delivery_arrived` | 即時のねこだよりを用意できた |
| 5 | `onboarding_delivery_opened` | 即時便を開いた |
| 6 | `onboarding_completed` | 即時便を確認し、オンボを終えた |
| 7 | `onboarding_second_photo_prompt_view` | ホームで今夜の一枚を見た |
| 8 | `onboarding_second_photo_submitted` | 次の20時便に向けた一枚を保存した |

`photo_submitted` は `onboarding_photo_submitted` の汎用別名なので、継続回数には重ねて数えない。

## 3. 初動で見る順序

### 投稿直後から15分

1. `Instagram bio` のオンボ人数が増えているか
2. 写真選択から写真保存まで、どこで人数が落ちているか
3. 写真保存人数と即時便到着人数が一致しているか
4. `要確認` に同じエラーが複数人で出ていないか
5. iPhone / Android、Instagram内 / LINE内 / Safari・Chromeのどこで起きたか

入口が5人未満の間は率で良否を決めず、一人ずつの経路を見る。5人以上になったら、写真保存率と即時便到着率を補助線として使う。

### 19時まで

1. `今夜の一枚を保存した` 人数を確認
2. 管理画面のモデレーションキューで pending を全件確認
3. 写真保存失敗、原本保全失敗、夜便予約の自動修復が増えていないか確認

モデレーション待ち件数は `app_events` ではなく、管理画面の実データを正とする。

### 20:00から20:15

1. `20時便の確認を開始` と `20時便が成立` の人数を比較
2. 失敗・長時間化が0か確認
3. 成立後に `20時便の封筒を表示` が増えるか確認
4. 開封人数は体験指標として見る。未開封だけでは障害と断定しない

画面を開かない人は20時便の確認自体が走らない。予約人数と開始人数の差は「未再訪」、開始人数と成立人数の差は「技術的な要確認」と分ける。

### 翌朝

1. `翌日も写真を入れた` 人数
2. 前夜の失敗が再訪時の自動修復で回復したか
3. PWAとして起動した人数

## 4. 止める判断

次は率に関係なくP0として公開を止め、個別確認する。

- 写真の消失、他人への誤配、共有範囲の誤りが1件でもある
- 最初の写真保存または即時便で、同じ停止エラーが別の2人に出る
- 20時便の確認を開始した人に対し、再試行後も成立しない人がいる
- 操作不能や復帰不能の白画面がある

次は改善シグナルだが、単独では公開停止にしない。

- 写真選択後の離脱
- 即時便は届いたが開かない
- 2枚目を入れない
- アプリ追加案内を閉じる

## 5. 20時便の主要イベント

| イベント | 意味 |
| --- | --- |
| `home_exchange_share_photo_confirmed` | 共有する一枚を保存した |
| `evening_delivery_check_started` | 20時便の確認を開始した |
| `evening_delivery_check_succeeded` | 配達を保存できた |
| `evening_delivery_check_failed` | 確認または保存に失敗した |
| `evening_delivery_check_timeout` | 確認が長時間化した |
| `evening_delivery_target_repaired` | 軽量予約を再訪時に修復した |
| `envelope_shown` + `surface=home` | 20時便の封筒を表示した |
| `delivery_opened` | 20時便を開いた |

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
- 1期間5,000件を超えると管理画面に警告を出す。先行期の規模では十分だが、増加時はサーバ集計へ移す
- 匿名からGoogleログインへ切り替わる前後は、同じ人が別IDとして見える場合がある
- アナリティクス送信失敗は製品体験を止めず、ローカルキューから後で再送する

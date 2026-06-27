# Beta Release Readiness

ベータ版リンクを外部に渡す前の確認リスト。

## 1. 先に止めるべきリスク

- [ ] 写真表示が安定している
- [ ] Supabase の Free quota / Egress 制限が解除されている
- [ ] `npm run check:release` が通る
- [ ] `npm run typecheck` が通る
- [ ] `npm run build` が通る
- [ ] iPhone Safari とホーム画面 PWA で主要フローが通る

## 2. 写真と安全性

- [ ] `cat_moments` の共有プールが anon key で直接読めない
- [ ] `cat-photos` bucket が anon key で一覧取得できない
- [ ] Storage-backed photo は所有者または配達済みユーザーだけが表示できる
- [ ] 人の顔、住所、名前、画面スクショを避ける注意喚起が見える
- [ ] 届いた写真を「ねこだよりから外す」導線がある
- [ ] 通報後、ローカルで即時非表示になる
- [ ] 通報後、運営側で確認できる

## 3. 課金

- [ ] `ENABLE_BETA_SUPPORTER_BILLING=true` の時だけ checkout が出る
- [ ] Stripe は live key / live price / live webhook secret
- [ ] Checkout 完了後、βサポーター状態になる
- [ ] Customer Portal から解約できる
- [ ] 解約後も基本体験が制限されない
- [ ] `/commercial-transactions` と `/cancellation` の内容が現在の価格・導線と一致している

## 4. 初回体験

- [ ] 新規ユーザーでホームを開ける
- [ ] 猫登録が完了できる
- [ ] 写真を撮れる
- [ ] 写真を保存できる
- [ ] ねこだよりを開ける
- [ ] うちのこで写真を見られる
- [ ] うちのこ写真タブの写真をフルスクリーン表示できる
- [ ] 設定から問い合わせ・規約・プライバシーへ行ける

## 5. PWA / iPhone

- [ ] ホーム画面追加後に起動できる
- [ ] 起動用スプラッシュとホーム表示が混ざらない
- [ ] 朝・昼・夕方・夜の背景で文字と写真が読める
- [ ] カメラ起動範囲が意図したボタンだけになっている
- [ ] 下部ナビとコンテンツが被らない
- [ ] 既存ホーム画面アイコン更新時は、削除して再追加が必要な場合があることを案内できる

## 6. 配布運用

- [ ] 最初は 10〜30人の限定配布にする
- [ ] 配布相手と配布日を控える
- [ ] 問い合わせ導線を案内できる
- [ ] 写真が見えない場合の案内文を用意する
- [ ] 課金できない/解約したい場合の案内文を用意する
- [ ] 問題発生時に追加配布を止められる

## 7. 推奨順序

1. `npm run check:release:local`
2. `npm run typecheck`
3. `npm run build`
4. Supabase dashboard / `npm run check:release`
5. Stripe live checkout / portal test
6. iPhone 実機 PWA シナリオテスト
7. 10〜30人の限定リンク配布

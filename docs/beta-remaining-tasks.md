# Beta Remaining Tasks

ベータ版リンクを配布する前に残っている確認タスクのメモ。

## 優先度 高

- [ ] 本番/ベータ用の環境変数を揃える
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SITE_URL` または `NEXT_PUBLIC_APP_URL`
- [ ] `npm run check:release` を通す
- [ ] Supabase 側で写真表示と権限を確認する
  - `beta_participants` テーブルが参照できる
  - `cat_moments` の共有配信プールが anon key で直接読めない
  - `cat-photos` bucket が anon key で一覧取得できない
  - 実機で写真が安定して表示される
- [ ] iPhone 実機で主要フローを確認する
  - 初回起動
  - ホーム画面追加後の PWA 起動
  - 写真を撮る/保存する
  - ねこだよりを見る
  - うちのこで写真を見る
  - 設定/問い合わせ/法務ページへ進める

## 優先度 中

- [ ] Stripe live 環境の確認
  - Checkout が開く
  - 支払い後にベータサポーター状態になる
  - Customer Portal が開く
  - 解約後も基本体験が壊れない
  - `/commercial-transactions` と `/cancellation` の内容が現在の価格・運用と一致している
- [ ] 問い合わせ/通報/削除後の運用を確認する
  - ユーザーに見える文言
  - 管理側で確認できる内容
  - 問題発生時に配布を止める手順
- [ ] 小人数ベータ配布の運用を決める
  - 最初の配布人数
  - 配布先
  - フィードバックを受ける場所
  - 追加配布する判断基準

## 優先度 低

- [ ] 時間帯別の背景を実機で再確認する
  - 朝
  - 昼
  - 夕方
  - 夜
- [ ] PWA アイコン更新時の案内文を用意する
  - iOS はホーム画面アイコンのキャッシュが強いため、必要なら削除して再追加してもらう
- [ ] ベータ参加者向けの簡単な案内文を整える
  - 何を試してほしいか
  - 写真が見えない時の対処
  - 問い合わせ方法

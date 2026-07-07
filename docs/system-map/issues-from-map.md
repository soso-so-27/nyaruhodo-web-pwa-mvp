# issues-from-map.md — システム地図 成果物4（構造から見えた問題）

> 地図を描く過程で見えた**構造的問題**に限定（細部のコードレビュー指摘はしない）。
> 出典はコードのみ。深刻度 P0（公開前に塞ぐ）/ P1（早めに）/ P2（改善）。
> 作成: 2026-07-07 / 対象: HEAD ワークツリー。

---

## P0

### P0-1. 退会削除が一部テーブルを取りこぼす（削除経路の欠落）
- 出典: `src/app/api/account/delete-stored-data/route.ts:143-159`（削除ステップ一覧）
- 問題: `deleteStoredDataForUser` の削除対象に **`account_local_state`・`mikke_window_answers`・
  `product_analytics_events` が無い**。前2つは `user_id` を持ちうるテーブル
  （`supabase/migrations/20260622223000_create_account_local_state.sql:1`,
  `20260530233000_create_mikke_window_answers.sql:1`）。`product_analytics_events` は
  `app_events` と対で書かれる（`src/lib/analytics/productAnalytics.ts:124,131`）のに、退会では
  `app_events` だけ消して `product_analytics_events` を消していない（`route.ts:151`）。
- 事故: 「退会したのにアカウントに紐づくデータが残る」。退会の完全性・プラポリの削除約束に反する。
- 対処案: 削除ステップに3テーブルを追加（`user_id`/該当カラムで delete）。無いテーブルはコメントで明示。

### P0-2. cron schedule のタイムゾーンがUTCで、意図とずれうる
- 出典: `vercel.json:5`（`"schedule": "30 18 * * *"`）
- 問題: Vercel cronのcronはUTC。`30 18 * * *` は **03:30 JST** に発火する。handoff cleanupは
  期限切れ/redeem済みのGCなので実害は小さいが、「18:30に走る」という運用理解とコードが割れている。
- 事故: 運用者が「18:30 JSTに掃除される」と誤解し、審査時間帯（19:00-19:30 JST）前の状態を誤認。
- 対処案: 意図がJST 18:30なら `30 9 * * *`（UTC）に。現状UTC 18:30で正なら、その旨をコード近傍にコメント化。

---

## P1

### P1-1. 匿名IDの get-or-create が4箇所に重複実装（同じlocalStorageキーへの多重書き込み経路）
- 出典: `src/lib/analytics/productAnalytics.ts:210`, `src/lib/home/deliveryCandidates.ts:232`,
  `src/lib/home/sleepingPhotoBackup.ts:34`, `src/lib/home/mikkeWindowResults.ts:79`
- 問題: 全て同じキー `analytics_anonymous_id`（`storage/keys.ts:5`）を読むが、**生成ロジックが不一致**。
  productAnalyticsは `createId()`、deliveryCandidatesは `crypto.randomUUID() ?? "anonymous-..."`。
  初回にどれが最初に走るかで匿名IDの形式が変わる。
- 事故: 同一端末で分析用IDと配達用IDが食い違う競合はキー共有で回避されているが、
  片方の実装だけ変更するとID体系が静かに割れる。分析の名寄せ・配達の重複除外に影響。
- 対処案: `getOrCreateAnonymousId` を単一モジュールに集約し4箇所から参照。

### P1-2. `handoff/create` と `handoff/redeem` が無認証（token所持＝全権限）で、redeemがセッションを移送する
- 出典: `src/app/api/onboarding/handoff/create/route.ts:26`（認証チェックなし）、
  `src/app/api/onboarding/handoff/redeem/route.ts:16-42`（tokenのみ）、
  復元先で `setSession`（`src/lib/onboarding/handoff.ts:271-282`）
- 問題: handoff payloadは**匿名セッションのaccess/refreshトークンを含む**（`handoff.ts:41-44,152`）。
  createは誰でも呼べ、redeemはtoken一致だけで payload（=セッション）を返す。tokenはURLで運ばれる
  （`continueUrl=/onboarding/continue?handoff=...` `create/route.ts:92`）。redeemは1回限り
  （`redeem_count=0` 条件 `redeem/route.ts:97`）で緩和しているが、tokenが漏れた瞬間に
  匿名アカウントを奪える設計。
- 事故: continueURLがログ・共有・ブラウザ履歴に残ると、未redeemなら匿名セッションを乗っ取られる。
- 対処案: redeemを一度きり＋短TTL（現状24h `create/route.ts:19`）を短縮、URLはfragment化かワンタイム表示に。
  少なくとも「セッション同梱は `NEXT_PUBLIC_ANON_AUTH_ENABLED` 時のみ」であることを前提条件として固定。

### P1-3. `stock` と `diagnostics` は別々のフラグでゲートされ、認可の粒度が不揃い
- 出典: `src/lib/adminAccess.ts:33-34`（`testToolsEnabled`=ENABLE_TEST_TOOLS、
  `stockAdminEnabled`=ENABLE_STOCK_ADMIN）、`diagnostics/route.ts:28`, `stock/route.ts:37`
- 問題: 同じ「管理者向けツール」でも diagnostics=`ENABLE_TEST_TOOLS`、stock=`ENABLE_STOCK_ADMIN` と
  フラグが分かれ、`stock` は未設定時 **404**（`requireStockAdminAccess` `adminAccess.ts:52-59`）、
  `diagnostics` は **403**。moderation queue/decide はフラグ無しで `isAdmin` のみ。
  「管理API」の認可方式が3種類混在。
- 事故: 片方のフラグだけ本番でtrueにして片方を忘れる、ステータスコードの不一致で運用スクリプトが誤判定。
- 対処案: 管理APIの認可を1つの方針（isAdmin＋単一capabilityマップ）に寄せ、フラグ体系を文書化。

### P1-4. 破壊的な admin-secret タスクに rate limit が無い
- 出典: `src/app/api/admin/storage-hardening/backfill-cat-moments/route.ts:31`（POST・Storage upload/update）、
  `src/app/api/admin/onboarding-handoffs/cleanup/route.ts:105`（行delete）、
  認可は `authorizeAdminTaskRequest`（`src/lib/server/adminTaskAuth.ts`）のみ
- 問題: これらは1回ごとに最大250件をスキャンし、Storage/DBを書き換える破壊的操作だが
  rate limit が無い。シークレットが漏れた場合、連打で本番Storageを大量に書き換えられる。
  （backfillはlimit50/scan250で1回の影響は限定的だが回数無制限）
- 事故: シークレット漏洩時の被害増幅。cron以外からの誤爆連打。
- 対処案: admin-secretタスクにも簡易rate limit（他APIと同じ in-memory バケット）を付す。

---

## P2

### P2-1. `readFastCandidateMode`=`admin_storage` の緊急退避モードが分岐として常時生きている
- 出典: `src/app/api/sleeping-delivery/exchange/route.ts:1169-1177`, `readFastStockCandidateRows:1145`
- 問題: `SLEEPING_DELIVERY_FAST_CANDIDATES=admin_storage` のときだけ通る fast path（admin stock直配）が
  exchange内に二重の候補選定経路（fast path / tiered）として常在。通常運用では未設定（tiered）で、
  fast pathは6/11事故の退避用（コードにその旨のコメントは無い）。分岐が腐りやすい。
- 事故: 将来 tiered 側だけ改修して fast path を放置 → 緊急時に古い挙動で復帰。
- 対処案: fast path分岐に「退避モード・通常未使用」の明示コメント、または退避を別関数へ隔離。

### P2-2. `presence` の集計が全共有行を最大5000件メモリ読みして距離計算
- 出典: `src/app/api/presence/route.ts:61-110`（`PRESENCE_MAX_ROWS=5000` をページングで読み集計）
- 問題: 公開エンドポイント（無認証）が、キャッシュmiss時に cat_moments を最大5000行読み、
  アプリ側で distinct 猫数を数える。60分キャッシュ＋IP rate limitで緩和しているが、
  プール増大に対して線形にコスト増。SQLの集計に寄せていない。
- 事故: プール成長後、キャッシュ切れ時の遅延・DB負荷。
- 対処案: distinct集計をSQL側（count distinct）に移す。構造としてアプリ内全件走査を避ける。

### P2-3. cat_moments への書き込み経路が3つあり、metadata規約が各所にコピーされている
- 出典: exchange（`route.ts:312-334`）／backup（`backup/route.ts:127-148`）／stock（`stock/route.ts:142-165`）
- 問題: 同じ `cat_moments` insert を3ルートが各自持ち、`metadata.pool_kind`・`source`・
  `moderation_status` の設定を個別にハードコード。`readPoolKind` の後方互換（`admin-stock` 表記ゆれ）も
  exchange/diagnostics/presence の3ファイルに同一関数がコピーされている
  （`exchange route.ts:1635`, `diagnostics/route.ts:181`, `presence/route.ts:128`）。
- 事故: pool_kindの規約変更時に片方だけ直り、配達候補・診断・presenceで判定が割れる。
- 対処案: cat_moment insert と `readPoolKind` を共有ヘルパへ集約。

### P2-4. `mikke_window_answers` は旧「みっけ」機能の残存で、書き込み経路はあるが退会削除経路が無い
- 出典: 書き込み `src/lib/home/mikkeWindowResults.ts:35`、テーブル
  `supabase/migrations/20260530233000_create_mikke_window_answers.sql:1`、
  退会削除に不在（`delete-stored-data/route.ts:143-159`）
- 問題: 旧診断系（にゃるほど）の名残。まだ書き込みコードが生きているが、UIから到達するか不明瞭で、
  退会削除の対象にも入っていない（P0-1と重複するが、こちらは「デッド化しかけ機能＋削除欠落」の二重）。
- 事故: 使われていない機能がPIIを蓄積し、退会で消えない。
- 対処案: 機能の生死を確認 → 生きているなら削除経路に追加、死んでいるなら書き込み停止＋テーブルGC。

### P2-5. 旧診断ルート4本がリダイレクトで生存（デッドルートの温存）
- 出典: `src/app/diagnose/page.tsx:3`, `src/app/diagnosis-onboarding/page.tsx:3`,
  `src/app/together/page.tsx:3`, `src/app/torisetu/page.tsx:3`
- 問題: 旧「にゃるほど診断」時代のパスが単純リダイレクトとして残る。実害は小さいが、
  旧世界観の痕跡がURLとして生存し続ける。
- 事故: なし（軽微）。ただしdiagnosis系はP2-4の旧機能と同根で、掃除の判断を一括で行うべき対象。
- 対処案: リダイレクトの継続要否をまとめて判断（IG等の外部リンクが指していないか確認の上で整理）。

---

## 追補（2026-07-07・screen-flows.md 作成時に判明）

### 解消: P0-2（cron TZ）
`docs/PROD-OPERATIONS.md`「Cron time zone note」（2026-07-07追記）により、`30 18 * * *` = UTC
（JST 03:30）が**意図された深夜GC窓**であることが文書化された。運用理解とコードの乖離は解消。
→ P0-2 はクローズ（コード変更不要）。

### 追加 P1

**P1-5. 退会APIがUIから未配線（呼ばれない機能）**
- 出典: `src/lib/accountSync.ts:865`（`deleteAccountStoredData`）の呼び出しが
  `src/components` に**0件**（grep確認）。API `POST /api/account/delete-stored-data` と
  クライアント関数まで実装済みだが、どの画面からも遷移が存在しない。
- 事故: 「退会機能はある」と誤認したまま公開し、実際はユーザーが自力で退会できない。
  実装済みコードが未検証のまま腐る（Stripe解約→全削除→auth削除の重い経路が本番未通電）。
- 対処案: セルフサービス退会UIの配線（設定→確認→`deleteAccountStoredData`）。配線までは
  `/account-deletion` の案内が「問い合わせベース」であることを明示し続ける。

### 追加 P2

**P2-6. `/offline` が行き止まり（復帰導線ゼロ）**
- 出典: `src/app/offline/page.tsx`（href/router 0件）、到達は `public/sw.js:4` のfallbackのみ
- 事故: オフライン復帰後もユーザーが自力で戻れない（再読み込み頼み）。
- 対処案: 「ホームへもどる」1リンク（オンライン復帰検知でも可）。

**P2-7. `/onboarding` への内部導線がテスト用のみ（新規ユーザーの取りこぼし分岐）**
- 出典: 内部リンクは `SettingsPage.tsx:975`（`?test=1`）のみ。`/home` 側に未完了ユーザーを
  onboardingへ誘導する分岐が無い（`src/app/home/*.tsx` に onboarding 参照0件）。
- 事故: 外部リンクを経ずに `/home` を直接開いた新規ユーザー（検索・共有URL等）は、
  オンボーディングに一度も出会わずに空のホームから始まる。「どの分岐にも該当しない場合」の
  フォールバック先が未定義の典型。
- 対処案: home側で「初回状態（onboardingCompleted無し＋写真0）→ onboardingへの静かな案内」を検討。

**P2-8. 2枚目プロンプトの無反応分岐（サイレントno-op）**
- 出典: `OnboardingFlow.tsx:841-843`（`handleStartSecondPhoto` は `!isDeliveredPhotoKept` で
  無言のreturn）
- 事故: 条件が崩れた状態でボタンが表示されると、押しても何も起きないUIになる
  （現状は表示条件 `:145-149` が守っているが、フォールバック未定義のまま表示条件だけに依存）。
- 対処案: no-op分岐にトラッキングかdisabled表示を入れ、表示条件と実行条件の二重化を明示。

### 更新後サマリ

- P0: **1**（P0-1 退会削除の取りこぼし。P0-2はクローズ）
- P1: **5**（+P1-5 退会UI未配線）
- P2: **8**（+P2-6〜P2-8）
- 合計: **14（うちクローズ1）**

補足: これらは「地図を描いて初めて見えた構造」に限定。個別APIのバリデーション等の細部は
`feature-inventory.md` / `data-flows.md` の出典に委ね、ここには挙げていない。

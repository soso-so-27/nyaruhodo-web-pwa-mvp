# feature-inventory.md — システム地図 成果物1（機能一覧）

> 出典はコードのみ（docsは出典にしない）。全記述に `ファイル:行` を付す。
> 作成: 2026-07-07 / 対象コミット: HEAD（`d8bde81` 時点のワークツリー）。
> スコープ: `src/app/` のルート、`src/app/api/` のroute、cron/webhook、環境変数。

---

## 1. ページ一覧（`src/app/**/page.tsx`）

Next.js App Router。全ページ静的 or `force-dynamic`。認証は「ページ側で必須化しているか」を記す
（多くのページはクライアントでlocalStorage/セッションを見て描画を分岐するため、サーバ強制は少ない）。

| パス | 画面の役割 | 認証要否 | 本番到達性 | 出典 |
|---|---|---|---|---|
| `/` | ホーム（`HomePageContent` を描画。`/home` と同一の中身） | 不要（匿名可） | 到達可・`force-dynamic` | `src/app/page.tsx:1-7` |
| `/home` | ホーム本体（とる／とどく／ひらくのデスクモデル） | 不要（匿名可） | 到達可・`force-dynamic` | `src/app/home/page.tsx:1` 付近 |
| `/onboarding` | オンボーディング（初回の一枚→受信体験） | 不要 | 到達可 | `src/app/onboarding/page.tsx:1-3` |
| `/onboarding/continue` | 別端末/ログイン後のhandoff受け取り継続画面 | 不要（tokenで復元） | 到達可・client | `src/app/onboarding/continue/page.tsx:1-6` |
| `/collection` | 「ねこだより」まいにちボード（送った/届いた） | 不要 | 到達可 | `src/app/collection/page.tsx:1-2` |
| `/cats` | うちのこ（猫プロフィール・記録） | 不要 | 到達可 | `src/app/cats/page.tsx:1-2` |
| `/settings` | 設定（アカウント同期・通知・βサポーター・法務リンク） | 不要（機能は状態で分岐） | 到達可 | `src/app/settings/page.tsx:1-2` |
| `/beta-supporter` | βサポーター（応援課金の説明とStripe導線） | 不要（購入はログイン要） | 到達可 | `src/app/beta-supporter/page.tsx` |
| `/account/create` | Googleログイン/アカウント作成導線 | 不要（ログイン前提の画面） | 到達可・client | `src/app/account/create/page.tsx:1-6` |
| `/auth/callback` | OAuthコールバック処理 | 不要（トークン交換） | 到達可・client | `src/app/auth/callback/page.tsx:1-5` |
| `/account-deletion` | アカウント削除案内（法務） | 不要 | 到達可 | `src/app/account-deletion/page.tsx:1-2` |
| `/terms` `/privacy` `/commercial-transactions` `/cancellation` `/contact` | 法務文書（`LegalPage` の各エクスポート） | 不要 | 到達可 | `src/components/legal/LegalPage.tsx:355-408` |
| `/how-to-use` | 使い方 | 不要 | 到達可 | `src/app/how-to-use/page.tsx:4` |
| `/offline` | SWオフラインフォールバック | 不要 | 到達可 | `src/app/offline/page.tsx` |
| `/admin/analytics` | 管理: KPI/ファネル分析 | **管理者必須**（`requireAdminAccess`） | 到達可だが非管理者は拒否画面 | `src/app/admin/analytics/page.tsx:8-16` |
| `/admin/animation-preview` | 管理: 開封アニメのプレビュー | ページ内で管理判定 | 到達可 | `src/app/admin/animation-preview/page.tsx` |
| `/prototypes/taimen` | 対面表示プロトタイプ（静止比較） | 不要 | **本番で404**（`process.env.NODE_ENV === "production"` で `notFound()`） | `src/app/prototypes/layout.tsx:7-9` |
| `/together` | → `/collection` へ301相当リダイレクト | — | リダイレクトのみ | `src/app/together/page.tsx:3` |
| `/torisetu` | → `/cats` へリダイレクト | — | リダイレクトのみ | `src/app/torisetu/page.tsx:3` |
| `/diagnose` | → `/home` へリダイレクト（旧にゃるほど診断の名残） | — | リダイレクトのみ | `src/app/diagnose/page.tsx:3` |
| `/diagnosis-onboarding` | → `/cats` へリダイレクト（旧診断の名残） | — | リダイレクトのみ | `src/app/diagnosis-onboarding/page.tsx:3` |

- **ページ数: 24**（うち実体16・リダイレクト4・本番404ゲート1・法務は`LegalPage`共有）。
- リダイレクト4本（`/together` `/torisetu` `/diagnose` `/diagnosis-onboarding`）は旧「にゃるほど診断」時代の
  デッドルートを現行画面に振り替えている。出典: 各 `page.tsx` の `redirect(...)`。

---

## 2. API一覧（`src/app/api/**/route.ts`）

認可方式の凡例:
- **匿名可** = 認証なしでも成立（anonymousId等で識別）
- **Bearer/セッション** = `getAuthenticatedUserForRequest`（Authorizationヘッダのbearer or Supabaseサーバセッション）
- **admin** = `requireAdminAccess`/`getAdminCapabilitiesForRequest`（`ADMIN_EMAILS` 照合）＋フラグ
- **admin secret** = `authorizeAdminTaskRequest`（共有シークレット。ユーザ認証ではない）
- **署名検証** = Stripe webhook 署名

全route `export const dynamic = "force-dynamic"`。

| パス | メソッド | 役割 | 認可方式 | rate limit | 破壊/課金 | 出典 |
|---|---|---|---|---|---|---|
| `/api/sleeping-delivery/exchange` | POST | 20時の交換。自分の写真をプールに入れ、候補を1件配達 | 匿名可（userId or anonymousId 必須） | あり（identity単位＋オンボ例外はIP単位） | 自moment delete・delivery insert | `src/app/api/sleeping-delivery/exchange/route.ts:131,159,305,467` |
| `/api/sleeping-delivery/backup` | POST | 自分のねがおをプールに保全（storage化） | 匿名可（bearer優先・なければanonymousId） | あり（`checkExchangeRateLimit`） | user時に既存moment delete→insert | `src/app/api/sleeping-delivery/backup/route.ts:34,65,113,127` |
| `/api/sleeping-delivery/stock` | GET/POST | 管理ストック写真の一覧/追加 | **admin**＋`ENABLE_STOCK_ADMIN`（`requireStockAdminAccess`） | なし | cat_moments insert（admin_stock） | `src/app/api/sleeping-delivery/stock/route.ts:37,95,142` |
| `/api/sleeping-delivery/diagnostics` | POST | 配達プールの健全性診断（Tier別件数など） | **admin**＋`ENABLE_TEST_TOOLS`（`testToolsEnabled`） | なし | 読み取りのみ | `src/app/api/sleeping-delivery/diagnostics/route.ts:26-33` |
| `/api/photo-storage/signed-url` | POST | 1枚の署名URL発行（display/thumbnail） | 匿名可（bearer=自分の写真or配達済み／anonymousId=配達済みのみ） | なし | 読み取りのみ | `src/app/api/photo-storage/signed-url/route.ts:29,41,78,98` |
| `/api/photo-storage/signed-urls` | POST | 複数署名URLの一括発行（最大80） | 同上 | なし（件数上限80） | 読み取りのみ | `src/app/api/photo-storage/signed-urls/route.ts:31,52,110` |
| `/api/moderation/queue` | GET | 承認待ちmomentの一覧 | **admin**（`isAdmin`） | なし | 読み取りのみ | `src/app/api/moderation/queue/route.ts:24-29` |
| `/api/moderation/decide` | POST | approve/reject 判定 | **admin** | なし | cat_moments update（reject時hidden） | `src/app/api/moderation/decide/route.ts:19-21,65` |
| `/api/reports` | GET/POST | GET=通報一覧（admin）／POST=配達済み写真の通報 | GET:**admin** / POST:匿名可（配達実績検証） | なし | 2名通報で `delivery_status='reported'` に更新 | `src/app/api/reports/route.ts:22-27,50,139` |
| `/api/presence` | GET | 「今どれだけ猫がいるか」の匿名カウント（30未満は非表示） | 不要（公開） | あり（IP単位・60/分） | 読み取りのみ・5分キャッシュ | `src/app/api/presence/route.ts:37-58,165` |
| `/api/account/delete-stored-data` | POST | **退会**（全テーブル削除＋Storage削除＋Stripe解約＋auth user削除） | Bearer必須 | あり（user単位・10分） | 全面削除・Stripe解約 | `src/app/api/account/delete-stored-data/route.ts:34,53,143-159,178` |
| `/api/account/transfer-intent` | POST | 匿名→本アカウントへのStorage移送intent発行 | Bearer必須（匿名セッション限定） | なし | intent insert | `src/app/api/account/transfer-intent/route.ts:20,29,65` |
| `/api/account/copy-anonymous-storage` | POST | intentに基づき匿名Storageを本アカウントへコピー | Bearer必須（非匿名限定） | なし（件数160上限） | Storage copy・intent update | `src/app/api/account/copy-anonymous-storage/route.ts:30,39,143,168` |
| `/api/onboarding/handoff/create` | POST | オンボ状態＋写真をサーバに退避しtoken発行 | **なし（誰でも）** | なし（サイズ8MB/data URL 3MB上限） | Storage upload・handoff insert | `src/app/api/onboarding/handoff/create/route.ts:26,46,74` |
| `/api/onboarding/handoff/redeem` | POST | tokenでオンボ状態を復元（1回限り） | **なし（token所持=権限）** | なし（token形式検証） | handoff update・Storage削除 | `src/app/api/onboarding/handoff/redeem/route.ts:16,37,71,117` |
| `/api/billing/create-checkout-session` | POST | Stripe Checkout開始 | Bearer＋β参加者 | なし | Stripe customer/subscription作成 | `src/app/api/billing/create-checkout-session/route.ts:22,29,85` |
| `/api/billing/create-portal-session` | POST | Stripe顧客ポータル（解約） | Bearer＋現行サポーター | なし | Stripeポータル発行 | `src/app/api/billing/create-portal-session/route.ts:17,34,44` |
| `/api/billing/status` | GET | 課金状態の取得 | Bearer（未ログインでも200） | なし | 読み取りのみ | `src/app/api/billing/status/route.ts:12-37` |
| `/api/stripe/webhook` | POST | Stripe webhook（購読状態同期・支払失敗） | **署名検証**（`verifyStripeWebhookEvent`） | なし | subscriptions upsert | `src/app/api/stripe/webhook/route.ts:22,30,41-73` |
| `/api/beta/feedback` | POST | フィードバック/サポーターボイス投稿 | Bearer＋β参加者（voiceはサポーター） | あり（3/分・20/時・user単位） | beta_feedback insert | `src/app/api/beta/feedback/route.ts:54,63,76,88` |
| `/api/beta/capabilities` | GET | β能力（参加者/サポーター）取得 | Bearer（未ログインでも200） | なし | 読み取りのみ | `src/app/api/beta/capabilities/route.ts:7-10` |
| `/api/referrals/claim` | POST | 紹介コードのclaim | Bearer必須 | なし | referral_claims insert | `src/app/api/referrals/claim/route.ts:9-12,51` |
| `/api/referrals/me` | GET | 自分の紹介コード/実績取得（未ログインでも既定応答） | Bearer（未ログインでも200） | なし | code get-or-create | `src/app/api/referrals/me/route.ts:10-13,39` |
| `/api/admin/analytics` | GET | KPI集計 | **admin**（`requireAdminAccess`） | なし | 読み取りのみ | `src/app/api/admin/analytics/route.ts:3` |
| `/api/admin/capabilities` | GET | 管理能力フラグ取得 | 実質公開（結果で判定） | なし | 読み取りのみ | `src/app/api/admin/capabilities/route.ts:7-10` |
| `/api/admin/onboarding-handoffs/cleanup` | GET/POST | 期限切れhandoffのStorage/行GC（cron本体） | **admin secret**（`authorizeAdminTaskRequest`） | なし（limit上限250） | Storage削除・payload null・行delete | `src/app/api/admin/onboarding-handoffs/cleanup/route.ts:19-32,105` |
| `/api/admin/storage-hardening/backfill-cat-moments` | POST | data URL写真をStorage化するバックフィル | **admin secret** | なし（limit50/scan250） | cat_moments update・Storage upload | `src/app/api/admin/storage-hardening/backfill-cat-moments/route.ts:31,79,97` |

- **API数: 27**（GETのみ7・POSTのみ16・GET+POST併存4）。

---

## 3. バックグラウンド（cron / webhook）

| 種別 | 起動条件 | 対象 | 認可 | 出典 |
|---|---|---|---|---|
| cron | 毎日 **18:30 UTC**（`"30 18 * * *"`。JST 03:30） | `/api/admin/onboarding-handoffs/cleanup` | admin secret（Vercel cronは同シークレットで叩く想定） | `vercel.json:2-7` |
| webhook | Stripeイベント受信時 | `/api/stripe/webhook`（checkout完了・subscription CRUD・invoice失敗） | Stripe署名検証 | `src/app/api/stripe/webhook/route.ts:41-73` |

- **注意（後述 issues）**: cron scheduleは `30 18 * * *` = **UTC**。docsの想定JSTと解釈が割れうる（コードはUTC）。出典: `vercel.json:5`。
- Service Worker（`public/sw.js`）は push通知を実装していない。`message` イベントで写真キャッシュのpurge/configのみ処理。
  出典: `public/sw.js:58-89`。cron的な自走はなし。

---

## 4. フィーチャーフラグ・環境変数（`process.env.*`）

値は書かない（名前と役割のみ）。出典は代表箇所。

### 4.1 サーバ側（機密含む）

| 変数 | 役割（on/off・用途） | 出典 |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | admin Supabaseクライアントの有無を決める。未設定だと多数のAPIが503 | `src/lib/supabase/admin.ts:9` |
| `ADMIN_EMAILS` | 管理者判定のメール許可リスト。空だと管理系が `admin_config_missing` | `src/lib/adminAccess.ts:164` |
| `ENABLE_TEST_TOOLS` | 診断API等のテストツールを管理者に開放（`true`でon） | `src/lib/adminAccess.ts:33,171` |
| `ENABLE_STOCK_ADMIN` | ストック管理API（stock GET/POST）を開放（`true`でon） | `src/lib/adminAccess.ts:34,52` |
| `BETA_TESTER_EMAILS` | β参加者とみなすメール許可リスト | `src/lib/betaAccess.ts:104` |
| `SLEEPING_DELIVERY_FAST_CANDIDATES` | 配達候補モード。`admin_storage`で緊急退避モード、それ以外はTier型 | `src/app/api/sleeping-delivery/exchange/route.ts:1170` |
| `STRIPE_SECRET_KEY` | Stripe API有効化 | `src/lib/billing/stripe.ts:280` |
| `STRIPE_WEBHOOK_SECRET` | webhook署名検証の有効化 | `src/lib/billing/stripe.ts:284` |
| `STRIPE_PRICE_ID_BETA_SUPPORTER` | βサポーターの価格ID | `src/lib/billing/stripe.ts:73,82` |
| `STORAGE_HARDENING_SECRET` / `CRON_SECRET` / `ADMIN_TASK_SECRET` | admin secret系タスク（cleanup/backfill）の認可。いずれか設定で有効（フォールバック順） | `src/lib/server/adminTaskAuth.ts:5-7` |

### 4.2 公開（`NEXT_PUBLIC_*`）

| 変数 | 役割 | 出典 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ブラウザ/認証用Supabase接続 | `src/lib/supabase/config.ts:4-5` |
| `NEXT_PUBLIC_SITE_URL` | サイトの絶対URL基点（OG・共有URL・リダイレクト） | `src/lib/supabase/config.ts:15`, `src/app/layout.tsx:48` |
| `NEXT_PUBLIC_APP_URL` | 課金導線のbase URL算出 | `src/lib/billing/subscriptions.ts:248` |
| `NEXT_PUBLIC_ANON_AUTH_ENABLED` | **匿名Supabase認証**の有効化フラグ（`true`でon）。handoff/transfer系の前提 | `src/lib/auth/anonymousAuth.ts:27` |
| `NEXT_PUBLIC_ENABLE_SW_IMAGE_CACHE` | SWによる画像キャッシュの有効化 | `src/components/performance/PhotoSwCacheController.tsx:12` |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` / `NEXT_PUBLIC_COMMIT_SHA` | 設定画面のビルド識別表示 | `src/components/settings/SettingsPage.tsx:86-87` |

- **フラグ/環境変数: 約19**（機密系10・公開系9）。機能をon/offするフラグ性の強いものは
  `ENABLE_TEST_TOOLS` / `ENABLE_STOCK_ADMIN` / `NEXT_PUBLIC_ANON_AUTH_ENABLED` /
  `NEXT_PUBLIC_ENABLE_SW_IMAGE_CACHE` / `SLEEPING_DELIVERY_FAST_CANDIDATES` の5つ。

---

## サマリ（この文書分）

- ページ: **24**（実体16・リダイレクト4・本番404ゲート1・法務共有コンポーネント）
- API: **27**
- cron: **1**（handoff cleanup）／ webhook: **1**（Stripe）
- 環境変数/フラグ: **約20**（機能on/offフラグ性: 5）

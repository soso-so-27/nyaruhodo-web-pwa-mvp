# ねてるねこ 実装現状レポート

作成日: 2026-06-12  
対象リポジトリ: `web-pwa-mvp-agents-md-docs`  
注意: このレポートはコード読解に基づく現状整理です。リポジトリ内に `spec v1.2` という単一の仕様ファイルは見当たらないため、仕様差分はユーザー指定項目および現行の `AGENTS.md` / `docs/design/DESIGN-CANON.md` / 関連実装との突き合わせとして記録します。

## 0. 2026-07-04 本番Supabase security migration確認

2026-07-04に本番Supabase `nyaruhodo-mvp-test` / ref `fwqhpjumerbqufqgmibu` のmigration未適用を確認し、`20260702093000` 以降7本を `supabase db push --linked` で適用済み。

根拠: `docs/prod-migration-gap-2026-07-04.md`

| 項目 | 本番状態 | 根拠 |
| --- | --- | --- |
| S1: `cat_moments` anon direct insert封鎖 | 本番込みで検証済み | `20260702093000` 適用済み。anon direct insertはHTTP 401 / `42501 permission denied` |
| S2: admin guard | 本番コード上はfail closed。env `ADMIN_EMAILS` 未設定時は503、非adminは403 | `src/lib/adminAccess.ts` |
| S3: `cat_moment_deliveries` anon direct insert封鎖 | 本番込みで検証済み | `20260702113000` 適用済み。backup policy 0行。anon direct insertはHTTP 401 / RLS拒否 |
| S4: `moderation_status` filter | 本番DBにmigration適用済み。コード上は候補queryとdeliverability helperで `approved` 限定 | `docs/security-s4-extract-2026-07-02.md`, `src/app/api/sleeping-delivery/exchange/route.ts` |

注意:

- 過去配達履歴に、`pending` の `cat_moments` から配達された `cat_moment_deliveries` が16件ある。これは2026-06-05〜2026-06-11ごろの既存履歴であり、本タスクでは削除・更新していない。
- 既存default grantとして `TRUNCATE` 等の広い権限が残っている。直接insertはRLS/grantで塞がったが、grant全面整理は `docs/specs/grant-hardening-spec.md` の別タスク。
- GitHub Actions `.github/workflows/supabase-migrations.yml` を追加し、main push時にmigration適用とdry-run差分検知を行う。

## 0.1 2026-07-05 アカウント削除時の配達済みねがお保全

アカウントとデータ全体の削除時も、配達済みのねがおは受け取った側の記録として画像ごと残す方針に更新済み。

- `cat_moment_deliveries` は `photo_url` を持ち、表示/署名URL認可がdelivery行だけで成立するため、削除対象ユーザーの `cat_moments` は削除する方針。
- 削除対象ユーザー配下のStorage pathを参照する配達済みdeliveryは、削除前に `delivery-archive/` の中立pathへコピーし、`cat_moment_deliveries.photo_url` を差し替える。
- 差し替え完了後に、削除対象ユーザー配下のStorage objectを削除する。これにより、残る写真pathから削除済みユーザーidを逆引きできない。
- 手動削除runbookと削除案内文もこの方針に更新済み。

根拠: `src/app/api/account/delete-stored-data/route.ts`, `src/lib/accountDeletionStorage.ts`, `docs/runbooks/account-deletion.md`

## 1. 技術スタック・構成

### Next.js / ルーティング

- Next.js: `16.2.4`。根拠: `package.json`
- React: `19.2.5` / `react-dom 19.2.5`。根拠: `package.json`
- TypeScript: `6.0.3`。根拠: `package.json`
- ルーティング: App Router。`src/app/**/page.tsx` と `src/app/api/**/route.ts` を使用。`pages/` ディレクトリは該当コードなし。
- `proxy.ts` が Supabase セッション更新を全ページ/API系リクエストに適用。根拠: `proxy.ts`, `src/lib/supabase/proxy.ts`

### 主要依存パッケージ

| package | version | 用途 | 根拠 |
|---|---:|---|---|
| `next` | `16.2.4` | App Router / API routes / PWA manifest route | `package.json` |
| `react`, `react-dom` | `19.2.5` | UI | `package.json` |
| `@supabase/supabase-js` | `2.105.4` | Supabase Auth / DB / Storage client | `package.json`, `src/lib/supabase/*` |
| `@supabase/ssr` | `0.10.3` | Server/client cookie session integration | `package.json`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts` |
| `@playwright/test` | `1.59.1` | E2E / screenshot harness | `package.json`, `tests/e2e/*`, `tests/shots/*` |
| `typescript` | `6.0.3` | 型チェック | `package.json`, `tsconfig.json` |

Stripe SDK は入っていません。Stripe API は `fetch` と HMAC 検証で直接実装されています。根拠: `src/lib/billing/stripe.ts`

### ディレクトリ構成

| path | 役割 |
|---|---|
| `src/app/` | App Router のページ、API routes、manifest、layout |
| `src/components/home/` | ホーム UI、机モデル v3、旧ホーム、撮影/配達UI |
| `src/components/collection/` | アルバム「まいにち / うちのこ」画面 |
| `src/components/cats/` | 猫プロフィール管理 |
| `src/components/settings/` | 設定、管理パネル、同期、β、レポート表示 |
| `src/components/ui/` | 共通 UI、写真表示、アイコン、デザイントークン helper |
| `src/lib/home/` | 寝顔写真、20時配達、exchange client、配達トレース、pool guard |
| `src/lib/supabase/` | Supabase browser/server/admin/proxy/config |
| `src/lib/billing/` | Stripe checkout / portal / webhook / subscription persistence |
| `src/lib/analytics/` | product analytics queue and flush |
| `supabase/migrations/` | Postgres / Storage / RLS migration |
| `tests/e2e/` | Playwright E2E |
| `tests/shots/` | Playwright screenshot harness |
| `docs/` | 設計、運用、事故後対応、リリースチェック |

### 主要ルート

| route | 役割 | 根拠 |
|---|---|---|
| `/` | `/home` へリダイレクト | `src/app/page.tsx` |
| `/home` | ホーム / 撮影 / 20時配達 / 机モデル | `src/app/home/page.tsx`, `src/components/home/HomeInput.tsx` |
| `/collection` | アルバム | `src/app/collection/page.tsx`, `src/components/collection/CollectionPage.tsx` |
| `/cats` | 猫プロフィール | `src/app/cats/page.tsx`, `src/components/cats/CatsPage.tsx` |
| `/settings` | 設定 / 管理パネル | `src/app/settings/page.tsx`, `src/components/settings/SettingsPage.tsx` |
| `/onboarding` | 初回オンボーディング | `src/app/onboarding/page.tsx`, `src/components/onboarding/OnboardingFlow.tsx` |
| `/account/create` | Googleログイン/アカウント作成導線 | `src/app/account/create/page.tsx` |
| `/auth/callback` | Supabase OAuth callback | `src/app/auth/callback/page.tsx` |
| `/beta-supporter` | βサポーターページ | `src/app/beta-supporter/page.tsx` |
| `/how-to-use` | 使い方ページ | `src/app/how-to-use/page.tsx` |
| `/terms`, `/privacy`, `/contact`, `/cancellation`, `/commercial-transactions` | 法務 | `src/app/*/page.tsx`, `src/components/legal/LegalPage.tsx` |
| `/diagnose`, `/diagnosis-onboarding`, `/together`, `/torisetu` | 旧/関連導線。ページファイルは存在するためURL直打ち到達可能 | `src/app/diagnose/page.tsx`, `src/app/together/page.tsx`, `src/app/torisetu/page.tsx` |

### API routes

| route | 役割 | 根拠 |
|---|---|---|
| `POST /api/sleeping-delivery/exchange` | 寝顔交換本体。候補選定、冪等配達、配達記録作成 | `src/app/api/sleeping-delivery/exchange/route.ts` |
| `POST /api/sleeping-delivery/diagnostics` | 管理者向け候補診断 | `src/app/api/sleeping-delivery/diagnostics/route.ts` |
| `POST /api/sleeping-delivery/stock` | 管理者向け候補写真追加 | `src/app/api/sleeping-delivery/stock/route.ts` |
| `POST /api/photo-storage/signed-url` | Storage参照写真の署名URL発行 | `src/app/api/photo-storage/signed-url/route.ts` |
| `GET /api/presence` | 交換対象ユニーク猫数の集計 | `src/app/api/presence/route.ts` |
| `GET/POST /api/reports` | 写真通報の作成/管理者一覧 | `src/app/api/reports/route.ts` |
| `GET /api/admin/capabilities` | 管理者/テストツール権限 | `src/app/api/admin/capabilities/route.ts` |
| `GET /api/beta/capabilities`, `POST /api/beta/feedback` | β参加/フィードバック | `src/app/api/beta/*/route.ts` |
| `POST /api/billing/create-checkout-session`, `POST /api/billing/create-portal-session`, `GET /api/billing/status`, `POST /api/stripe/webhook` | βサポーター課金 | `src/app/api/billing/*`, `src/app/api/stripe/webhook/route.ts` |

`/api/sleeping-delivery/candidate` は現在の `src/app/api` には該当 route ファイルなし。旧経路は削除済みと判断できます。

### ホスティング・デプロイ構成

- Vercel想定。`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` を `next.config.ts` で public env に反映し、設定画面管理パネルに表示。根拠: `next.config.ts`, `src/components/settings/SettingsPage.tsx`
- `generateBuildId` は `build-${Date.now()}`。毎ビルドでIDが変わる。根拠: `next.config.ts`
- `vercel.json` は該当コードなし。
- `npm run build` は `next build`、`npm run start` は `next start`。根拠: `package.json`
- E2Eは dev server 用 `playwright.config.ts` と production server 用 `playwright.prod.config.ts` の両方あり。根拠: `playwright.config.ts`, `playwright.prod.config.ts`

## 2. データモデル

### DBと接続方法

- DB: Supabase Postgres。根拠: `supabase/migrations/*`, `src/lib/supabase/*`
- Browser client: `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`、PKCE、localStorage永続セッション。根拠: `src/lib/supabase/browser.ts`
- Server client: `@supabase/ssr` + cookies。根拠: `src/lib/supabase/server.ts`, `proxy.ts`
- Admin client: `SUPABASE_SERVICE_ROLE_KEY` がある場合のみ service role。根拠: `src/lib/supabase/admin.ts`

### テーブル/スキーマ

#### `cat_moments`

配達プール用の写真投稿。根拠: `supabase/migrations/20260602093000_create_cat_moment_tables.sql`

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid null references auth.users(id) on delete cascade`
- `anonymous_id text null`
- `local_moment_id text not null`
- `local_cat_id text not null`
- `owner_cat_id text not null`
- `photo_url text not null`
- `state text not null check state in ('sleeping')`
- `visibility text not null check visibility in ('private','shared')`
- `delivery_status text not null default 'available' check in ('available','hidden','reported')`
- `source_moment_id text null`
- `metadata jsonb not null default '{}'`, object constraint
- `captured_at timestamptz null`
- `created_at`, `updated_at`
- identity check: `user_id is not null or anonymous_id is not null`
- unique: `(user_id, local_moment_id)` where userあり、`(anonymous_id, local_moment_id)` where anonあり
- RLS: authenticatedは自己行CRUD、anonはinsertのみ。anon selectは `20260611173000_revoke_anon_cat_moments_select.sql` でrevoke済み。

#### `cat_moment_deliveries`

配達記録。根拠: `supabase/migrations/20260602093000_create_cat_moment_tables.sql`

- `id uuid primary key`
- `user_id uuid null references auth.users(id) on delete set null`
- `anonymous_id text null`
- `local_delivery_id text not null`
- `source_moment_id text null`
- `source_photo_id text null`
- `recipient_local_cat_id text null`
- `photo_url text not null`
- `status text not null default 'delivered' check in ('delivered','kept','dismissed','hidden','reported')`
- `metadata jsonb not null default '{}'`, object constraint
- `delivered_at`, `updated_at`
- identity check: `user_id is not null or anonymous_id is not null`
- unique: `(user_id, local_delivery_id)` and `(anonymous_id, local_delivery_id)`
- RLS: authenticated自己行CRUD、anon insertのみ。

#### Account sync tables

根拠: `supabase/migrations/20260524190000_create_account_sync_tables.sql`

- `profiles`: `id uuid references auth.users`, `display_name`, `created_at`, `updated_at`
- `cats`: `owner_user_id`, `local_cat_id`, `name`, `type_key`, `type_label`, `type_tagline`, `basic_info`, `appearance`, `axis_scores`, `activity_pattern`, `type_scores`, `modifiers`, `onboarding`, `understanding`, `avatar_storage_path`, `home_photo_storage_path`, `home_photo_position`, `metadata`, `local_created_at`, `local_updated_at`, `created_at`, `updated_at`
- `record_logs`: `user_id`, `cat_id`, `local_cat_id`, `local_record_id`, `record_type check ('yousu','mugi','reaction','photo')`, `value`, `label`, `metadata`, `occurred_at`, `created_at`
- `collection_photos`: `user_id`, `cat_id`, `local_cat_id`, `local_photo_id`, `slot_slug`, `group_id`, `storage_path`, `metadata`, `captured_at`, `created_at`
- `account_sync_state`: `user_id`, `last_pull_at`, `last_push_at`, `metadata`, `created_at`, `updated_at`
- RLS: authenticated自己行のみ。Storage bucket `cat-photos` も「第一パスセグメント = user id」の自己フォルダポリシー。

#### Analytics / beta / billing / reports / legacy

- `product_analytics_events`: `id`, `name`, `occurred_at`, `anonymous_id`, `session_id`, `user_id`, `local_cat_id`, `route`, `referrer`, `source check`, `properties`, `created_at`。anon/auth insert。根拠: `supabase/migrations/20260524152000_create_product_analytics_events.sql`
- `photo_reports`: `photo_id`, `source_photo_id`, `reporter_user_id`, `reporter_anonymous_id`, `reason check ('not_cat','uncomfortable','other')`, `metadata`, `created_at`。anon/authは全revoke、APIがadmin clientでinsert/read。根拠: `supabase/migrations/20260612093000_create_photo_reports.sql`, `src/app/api/reports/route.ts`
- `beta_feedback`: `user_id`, `category`, `message`, `kind`, `page`, `user_agent`, `status`, `created_at`。authenticated自己insert。根拠: `supabase/migrations/20260607090000_create_beta_feedback.sql`
- `subscriptions`: Stripe subscription状態。根拠: `supabase/migrations/20260607093000_create_subscriptions.sql`
- `beta_participants`: `email`, `status`, `note`, `invited_by`, timestamps。根拠: `supabase/migrations/20260607110000_create_beta_participants.sql`
- `mikke_window_answers` / `mikke_window_answer_counts`: 旧/関連「みっけ」集計。根拠: `supabase/migrations/20260530233000_create_mikke_window_answers.sql`
- `events`, `diagnoses`, `feedbacks`, `hint_feedbacks`: 旧にゃるほど診断系。根拠: `supabase/migrations/20260502033100_create_mvp_diagnosis_tables.sql`, `20260502043000_create_hint_feedbacks.sql`

### 写真保存先・パス規則・画像処理

- 端末側主保存: localStorage。主キー群は `src/lib/storage/keys.ts`。寝顔写真は `src/lib/home/sleepingPhotos.ts`、配達日は `neteruneko_evening_delivery_days`。根拠: `src/lib/storage/keys.ts`, `src/lib/home/sleepingPhotos.ts`, `src/lib/home/eveningDelivery.ts`
- Account sync時の写真: Supabase Storage bucket `cat-photos`、private、10MB、JPEG/PNG/WebP。パスはおおむね `${userId}/${catId}/${group}/${photoId}.${ext}`。根拠: `supabase/migrations/20260524190000_create_account_sync_tables.sql`, `src/lib/accountSync.ts`, `src/lib/photoStorage.ts`
- 管理候補写真: `admin-stock/sleeping/${localMomentId}.${ext}`。根拠: `src/app/api/sleeping-delivery/stock/route.ts`
- 画像処理:
  - 撮影/交換送信時に data URL を縮小・JPEG化する経路あり。根拠: `src/lib/home/useEveningDelivery.ts`
  - Storage表示時は `/api/photo-storage/signed-url` で署名URLを取得し、表示成功時にdata URLへ書き戻す callback あり。根拠: `src/components/ui/StoredPhotoImage.tsx`, `src/lib/home/eveningDelivery.ts`, `src/components/collection/CollectionPage.tsx`

### 認証方式

- Supabase Auth。Browser clientはPKCE + localStorage。根拠: `src/lib/supabase/browser.ts`
- Googleログインは Google Identity Services の ID token を Supabase `signInWithIdToken` へ渡す実装。根拠: `src/app/account/create/page.tsx`
- OAuth callback routeもあり、`exchangeCodeForSession` を実装。根拠: `src/app/auth/callback/page.tsx`
- 管理者判定は `ADMIN_EMAILS` / `ENABLE_TEST_TOOLS` / `ENABLE_STOCK_ADMIN`。根拠: `src/lib/adminAccess.ts`, `src/app/api/admin/capabilities/route.ts`

## 3. 配達モデルの実装

### 20時配達の判定ロジック

実装はサーバーcronではなく、クライアント時刻判定です。

- 撮影時に `recordEveningDeliveryTarget()` が `neteruneko_evening_delivery_days` に当日または翌日の target を保存。根拠: `src/lib/home/eveningDelivery.ts`
- 20時判定は `getJstDeliveryTime(dateKey)` / `getPendingEveningDeliveryDay(now)`。`EVENING_DELIVERY_HOUR = 20`。根拠: `src/lib/home/eveningDelivery.ts`
- `HomeInput` が `useEveningDelivery({ activeCatId, ownSleepingPhotos, tick })` を呼び、フック内で `Date.now()` または `tick` を使って pending 判定し、`/api/sleeping-delivery/exchange` をPOST。根拠: `src/components/home/HomeInput.tsx`, `src/lib/home/useEveningDelivery.ts`
- サーバー側 `/api/sleeping-delivery/exchange` は `deliveryDateKey` を受け取り、冪等キー作成・候補選定・配達記録作成を行うが、サーバー時刻で「20時以降か」を拒否する実装は見当たりません。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`

⚠️ 仕様差分 / リスク: 20時配達は端末がアプリを開く、またはホームが評価されることで発火します。サーバーcronやPushによる定刻配達は未実装です。

対応済み: `HomeInput` / `DayCycleIndicator` 周辺の hydration mismatch warning は、時刻依存のホーム本体をSSR/初回hydrationでは中立プレースホルダにし、マウント後の `tick` 確定後に描画する形で解消済みです。`useEveningDelivery` も `tick` 未確定時は配達判定を走らせません。根拠: `src/components/home/HomeInput.tsx`, `src/lib/home/useEveningDelivery.ts`, `tests/e2e/home-desk-model.spec.ts`

### クライアント時計依存

具体的な依存コードパス:

1. `Date.now()` / `tick` → `getJstDateKey()` / `getJstDeliveryTime()`。根拠: `src/lib/home/eveningDelivery.ts`, `src/lib/home/useEveningDelivery.ts`
2. `recordEveningDeliveryTarget()` は20時以降に撮った写真を翌日分にする。根拠: `src/lib/home/eveningDelivery.ts`
3. `autoOpenExpiredEveningDeliveries()` は翌朝5時以降に未開封配達をsystem open扱いにする。根拠: `src/lib/home/eveningDelivery.ts`
4. `HomeDeskModel` の背景光と17時一行も `now` に依存。根拠: `src/components/home/HomeDeskModel.tsx`

端末時刻を変えた場合の挙動:

- 端末時刻を20時以降に進めると、クライアントは配達可能と判定し exchange を呼べます。
- 端末時刻を20時前に戻すと、配達が未発火または待機表示のままになります。
- 端末時刻を翌朝5時以降に進めると、未開封配達は `openedBy: "system"` で自動開封され、ホームの今日状態からは消え、アルバム側で写真化されます。

ドキュメント化:

- 6/11事故後の時計/配達周りは `docs/2026-06-11-delivery-incident-postmortem.md` に一部記録あり。
- 端末時計依存そのものを仕様リスクとして体系化した単独ドキュメントは該当コードなし。

### 配達マッチング

`/api/sleeping-delivery/exchange` が server/admin client で `cat_moments` を読み、候補を選びます。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`

主な選定/除外:

- 対象: `visibility='shared'` かつ `delivery_status='available'` の `cat_moments`
- 既知テスト/不正/ブロック行を除外。根拠: `src/lib/home/deliveryPoolGuards.ts`
- 自分自身の写真、同じユーザー/anonymousId、同じ受け取り猫、blockedPhotoIds を除外。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`
- `SLEEPING_DELIVERY_FAST_CANDIDATES` 未設定時の fast path は `admin_storage`。admin stock (`local_moment_id like 'stock-sleeping-%'`) の storage ref を軽量に読む。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`, `docs/2026-06-11-delivery-incident-postmortem.md`
- full pool fallback は残るが、storage URLのユーザー共有候補は現状fast pathから外れやすい。診断APIにも `storageExcludedRows` がある。根拠: `src/app/api/sleeping-delivery/diagnostics/route.ts`

⚠️ 仕様差分 / リスク: 6/11事故対応後、速度優先の `admin_storage` fast path が本番デフォルトです。通常ユーザー共有 storage 候補の公平な復帰は `docs/2026-06-11-delivery-incident-postmortem.md` で設計提示済みですが、未実装です。

### 「その日に残した人に届く」の判定

- 日付境界はJST。`getJstDateKey()` がUTC timestampに9時間を足して `YYYY-MM-DD` を作る。根拠: `src/lib/home/eveningDelivery.ts`
- 20時前に撮ると当日配達対象、20時以降に撮ると翌日配達対象。根拠: `getEveningDeliveryTargetDateKey()`, `recordEveningDeliveryTarget()` in `src/lib/home/eveningDelivery.ts`
- サーバー側候補選定は「その日の投稿」限定ではなく、現在availableなプール全体から選びます。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`

⚠️ 仕様差分: 「その日に残した人に届く」を厳密に「当日投稿同士の交換」と読む場合、現実装は違います。受け取り側は当日targetが必要ですが、届ける写真候補はプール全体です。

### 供給不足時の挙動

- 候補がない場合、exchangeは `{ photo: null }` を返し、クライアントは `deliveredPhoto` を書き込まず待機を継続します。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`, `src/lib/home/useEveningDelivery.ts`
- 待機中は次回のeffect評価で再POST可能です。`pendingEveningDeliveryKeysRef` は失敗時に解除されます。根拠: `src/lib/home/useEveningDelivery.ts`
- admin stock / fallback candidate は実装あり。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`, `src/app/api/sleeping-delivery/stock/route.ts`
- サーバーcronによる再配達、キュー、リトライジョブは未実装 / 該当コードなし。

### 初回即時交換

実装済みです。

- オンボーディングで写真選択後、`deliverOwnSleepingPhoto()` が `createSleepingExchange()` を即時呼び出す。根拠: `src/components/onboarding/OnboardingFlow.tsx`
- これは20時を待たない即時交換です。
- 管理テストモードでは候補写真追加も可能。根拠: `src/components/onboarding/OnboardingFlow.tsx`, `src/app/api/sleeping-delivery/stock/route.ts`

## 4. モデレーション

### 19時モデレーションバッチ

未実装 / 該当コードなし。

- `vercel.json` なし。
- cron/scheduler route なし。
- `cat_moments` に `moderated_at` / `moderation_status` のような列なし。

### AIフィルタ

未実装 / 該当コードなし。

- 画像モデレーションAPI、OpenAI/Vision/外部AI moderationの呼び出しは見当たりません。
- `package.json` にAI moderation用依存なし。

### 通報機能

部分実装済み。

- state4の全画面ビューで「どこかのこ」のみ `…` メニューから通報可能。根拠: `src/components/home/HomeDeskModel.tsx`
- 理由は `not_cat`, `uncomfortable`, `other`。根拠: `src/app/api/reports/route.ts`
- 送信後、当該写真は端末側でブロックされ、state4スロットは空き表示になります。根拠: `src/components/home/HomeInput.tsx`, `src/components/home/HomeDeskModel.tsx`, `src/lib/home/sleepingPhotos.ts`
- `photo_reports` へ保存し、同一写真が2件以上報告されると `cat_moments.delivery_status='reported'` に更新。根拠: `src/app/api/reports/route.ts`, `supabase/migrations/20260612093000_create_photo_reports.sql`
- 管理パネルに通報一覧取得あり。根拠: `src/components/settings/SettingsPage.tsx`, `GET /api/reports`

### 未モデレーション写真が配達されうるか

はい、あり得ます。

- exchangeは `visibility='shared'` かつ `delivery_status='available'` を候補にします。事前モデレーション済みを示す条件はありません。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`
- 手動/事後の除外はあります: `hidden`, `reported`, hardcoded blocked rows, migrationsによる既知不良行のhide/delete。根拠: `src/lib/home/deliveryPoolGuards.ts`, `supabase/migrations/20260605002000_hide_invalid_sleeping_delivery_photos.sql`, `20260606113000_hide_red_blue_delivery_pool_rows.sql`

⚠️ 仕様差分: specが19時バッチまたはAIフィルタ後配達を要求する場合、現実装は未達です。

## 5. 画面実装の現状

### ホーム4状態サイクル

実装済み。ただし配達発火はクライアント時計依存です。

| state | 判定条件 | UI | 根拠 |
|---|---|---|---|
| state1 | `kind='before'` かつ今日配達対象 | 空フレーム + 手紙 | `src/lib/home/eveningDelivery.ts`, `src/components/home/HomeDeskModel.tsx` |
| state1b | `kind='before'` かつ20時後撮影で翌日扱い | 空フレーム + 閉じた手紙、翌日コピー | 同上 |
| state2 | `kind='waiting'` | 自分の写真 + 変化しない手紙、17-19:59は「もうすぐ、とどく」 | 同上 |
| state3 | `kind='delivered'` | 封蝋つき手紙、長押し開封 | 同上 |
| state4 | `kind='opened'` | 2タイル、全画面ビュー、通報/保存 | 同上 |

新旧ホーム切替:

- `NEXT_PUBLIC_HOME_DESK_MODEL` と端末localStorage override `neteruneko_home_desk_model`。根拠: `src/lib/home/homeDeskModelFlag.ts`
- 管理パネルで v3/旧ホームを切替可能。根拠: `src/components/settings/SettingsPage.tsx`

### 封筒開封3拍フロー

部分実装。

- state3は Pointer Events 長押し、`setPointerCapture`、`touchAction: none`、`userSelect: none`、`WebkitTouchCallout: none`。根拠: `src/components/home/HomeDeskModel.tsx`
- 写真レイヤーは `pointerdown` 後に `developPhotoMounted` でマウント。根拠: `src/components/home/HomeDeskModel.tsx`
- 現像ブラー/opacity遷移あり。根拠: `src/components/home/HomeDeskModel.tsx`
- 押し切り時に `onOpenDelivery()`、`markEveningDeliveryOpened(..., 'user')`。根拠: `src/components/home/HomeInput.tsx`, `src/lib/home/eveningDelivery.ts`
- 開封音候補1のみ実アセット。候補2/3は空文字。根拠: `src/lib/openSound.ts`, `public/sounds/open-paper-sound-1.mp3`

⚠️ 仕様差分: 「3拍」という概念はコード上で明示的な3段ステート名としては分離されていません。長押し現像→開封確定→state4表示として実装されています。

### アルバム「まいにち / うちのこ」

実装済み。

- scope tabs: `daily` = まいにち、`own` = うちのこ。根拠: `src/components/collection/CollectionPage.tsx`
- dailyは空の今日カードを作成、ownは該当groupがある場合のみ表示。根拠: `BoxOverview` in `src/components/collection/CollectionPage.tsx`
- 未開封配達はアルバム上で写真を表示せず、封筒ミニチュアを表示。根拠: `readUnopenedEveningDeliveryDateKeys()`, `AlbumSealedDeliveryMiniature()` in `src/components/collection/CollectionPage.tsx`
- 開封済み/自動開封済み配達のみ写真化。根拠: `readOpenedEveningDeliveryBoxPhotos()` in `src/components/collection/CollectionPage.tsx`

### オンボーディング7ステップ / PWAインストール誘導

部分実装。

- オンボーディングは `intro`, `saving`, `envelope`, `revealing`, `delivered`, `empty`, `kept` の状態機械。根拠: `src/components/onboarding/OnboardingFlow.tsx`
- 写真選択、即時exchange、封筒表示、開封、保存、完了は実装済み。根拠: `src/components/onboarding/OnboardingFlow.tsx`
- 「7ステップ」として明示された独立step配列やPWAインストール誘導stepは該当コードなし。
- PWA install hintはホーム側で `beforeinstallprompt` を拾う実装。根拠: `src/components/home/HomeInput.tsx`

⚠️ 仕様差分: spec v1.2が「オンボーディング7ステップ + PWAインストール誘導」を固定要求している場合、現実装は状態機械型で、インストール誘導はオンボーディング内ではありません。

### βサポーターページ(spec §11)

部分実装。

- `/beta-supporter` は存在。想い、ゆめリスト、免責、月額、Stripe導線、法務リンクあり。根拠: `src/app/beta-supporter/page.tsx`
- 設定にもβサポーター導線あり。根拠: `src/components/settings/SettingsPage.tsx`
- Stripe checkout / portal / webhook / subscription tableあり。根拠: `src/app/api/billing/*`, `src/app/api/stripe/webhook/route.ts`, `src/lib/billing/*`

⚠️ 仕様差分: ページ文面は指示された確定コピーから漢字多めに調整されています。「準備中です。」ブロック削除等は設定画面現状次第ですが、β周辺の情報は設定内にも残っています。

## 6. 既知課題の現在ステータス

### 1. 配達モデル導入前の過去日付が「おやすみ」と表示される件

修正済み寄り / 部分実装。

- `shouldShowOtherDeliverySlot()` と `firstEveningDeliveryTargetDateKey` により、初回配達target以前は「どこかのこ」スロットを出さない制御あり。根拠: `src/components/collection/CollectionPage.tsx`
- E2Eあり: `hides the other slot before the first evening delivery target day`。根拠: `tests/e2e/collection-album-flow.spec.ts`
- ただし、表示対象日で写真がない場合のプレースホルダー文言 `この日は おやすみ` は現存します。根拠: `src/components/collection/CollectionPage.tsx`

### 2. 空状態コピーのひらがな表記ゆれ

修正済み。

- `ねがおを入れると` は検索で該当コードなし。
- 現在は `ねがおをとると、ここに ならびます` / `ねがおをとると、よる8じに ここへ とどきます`。根拠: `src/components/collection/CollectionPage.tsx`

### 3. うちのこタブの空「きょう」セクション

修正済みと判断。

- `BoxOverview` は `activeScope === "daily"` のときだけ `createEmptyTodayAlbumGroup()` を作る。`own` では該当groupがなければ今日カードなし。根拠: `src/components/collection/CollectionPage.tsx`

### 4. クライアント時計依存

未修正。

- 実装は§3記載の通りクライアント時計依存。
- 事故後メモに関連記録はあるが、クライアント時計を信頼しない設計にはなっていません。根拠: `src/lib/home/eveningDelivery.ts`, `src/lib/home/useEveningDelivery.ts`, `docs/2026-06-11-delivery-incident-postmortem.md`
- `HomeInput` / `DayCycleIndicator` の hydration mismatch warning は対応済み。SSRでは時刻依存のホーム本体を確定せず、マウント後にクライアント側の `tick` で state 判定を確定します。17時/20時の境界更新は既存の1秒tickに加え、focus / visibilitychange 復帰時にも再評価されます。根拠: `src/components/home/HomeInput.tsx`, `tests/e2e/home-desk-model.spec.ts`

## 7. 計測イベント

### 計測基盤

- localStorage queue → Supabase `product_analytics_events` にbatch insert。根拠: `src/lib/analytics/productAnalytics.ts`, `supabase/migrations/20260524152000_create_product_analytics_events.sql`
- Queue max 200、flush batch 25。根拠: `src/lib/analytics/productAnalytics.ts`
- Supabase未設定時はローカルqueueに残る / flush不可。根拠: `src/lib/analytics/productAnalytics.ts`

### 実装されているイベント名

検索対象: `trackProductEvent("...")`

- `app_opened` / `pwa_display_mode_detected` / `route_viewed`。根拠: `src/components/analytics/AppAnalyticsTracker.tsx`
- `take_photo`
- `delivery_sent`
- `envelope_shown`
- `envelope_opened`
- `keep_tapped` 相当の保持系イベントはコード上では個別名の検索結果に出ていません。保持処理内に別名イベントがある可能性はありますが、トップレベル検索では未確認。
- `motif_state_shown`, `motif_tapped`, `subcopy_hidden_cohort`。旧ホーム/モチーフ系にも残存。根拠: `src/components/home/HomeInput.tsx`, `src/components/home/HomeDeskModel.tsx`
- `onboarding_sleeping_photo_delivered`, `onboarding_delivered_photo_confirmed`, `onboarding_test_candidate_added`。根拠: `src/components/onboarding/OnboardingFlow.tsx`
- `account_create_cta_viewed`, `account_create_cta_clicked`, `auth_google_started`, `auth_google_failed`。根拠: `src/app/account/create/page.tsx`, `src/app/auth/callback/page.tsx`
- `settings_account_sync_clicked`, `settings_account_sync_completed`, `settings_account_restore_clicked`, `settings_account_restore_cancelled`, `settings_account_restore_completed`, `settings_stock_photos_imported`。根拠: `src/components/settings/SettingsPage.tsx`

⚠️ 仕様差分: spec v1.2定義イベント全量との対応表は、spec v1.2ファイルがリポジトリ内に見当たらないため未確定です。

## 8. PWA・通知

### manifest / Service Worker

- manifest実装あり。根拠: `src/app/manifest.ts`, `src/app/layout.tsx`
- display: `standalone`, start_url: `/home`, iconsあり。根拠: `src/app/manifest.ts`
- Service Workerは未実装 / 該当コードなし。`navigator.serviceWorker` / `pushManager` の実装なし。`AGENTS.md` にも「manifest-only」と明記。

### プッシュ通知

未実装。

- `Notification.requestPermission()` はホームで呼ばれる。根拠: `src/components/home/HomeInput.tsx`
- Push Subscription、Service Worker push handler、20時配達通知送信は該当コードなし。
- App Badge API (`setAppBadge`, `clearAppBadge`) は実装あり。根拠: `src/lib/home/eveningDelivery.ts`, `src/lib/home/useEveningDelivery.ts`

### オフライン時の挙動

- Service Workerなしのため、初回/未キャッシュ状態でのオフライン起動は保証なし。
- localStorage内のdata URL写真は表示可能。
- storage参照写真は署名URLAPIが必要。ただし表示成功時にdata URLへ書き戻す処理があり、E2Eで「signed-url API 404でもアルバム表示」を検証。根拠: `src/components/ui/StoredPhotoImage.tsx`, `src/components/collection/CollectionPage.tsx`, `tests/e2e/collection-album-flow.spec.ts`

## 9. テスト

### Playwrightテスト一覧

| file | 検証内容 |
|---|---|
| `tests/e2e/admin-test-tool-guards.spec.ts` | 管理者/β/課金/Stripe webhook/test tools guard |
| `tests/e2e/cats-duplicate-name.spec.ts` | 猫名重複確認 |
| `tests/e2e/collection-album-flow.spec.ts` | アルバム、storage復元、offline writeback、未開封封筒、自動開封、旧storage URL、初回target以前表示 |
| `tests/e2e/home-day-cycle-indicator.spec.ts` | 旧ホームのday-cycle indicator、presence、サブコピー、wordmark、モバイル間隔 |
| `tests/e2e/home-desk-model.spec.ts` | 机モデル5状態、背景光、17時一行、長押し開封、habit/week1、全画面保存/通報、昨日ミニ、reduced motion |
| `tests/e2e/home-sleeping-exchange-flow.spec.ts` | 撮影→20時exchange→保持、匿名storage配達、20時後翌日扱い、日跨ぎ、missed delivery auto-open、legacy救済、iOS quota回帰 |
| `tests/e2e/onboarding-delivery-flow.spec.ts` | オンボーディング即時交換、明示keep、既存猫/名前入力/完了panel |
| `tests/e2e/sleeping-delivery-pool-guards.spec.ts` | pool guard、署名URL認可、exchange payload validation、storage auth、latency budget、冪等性、rate limit、test/debug row除外 |
| `tests/shots/home-desk-shots.spec.ts` | `npm run shots` 用スクリーンショット一式 |

### カバーされていない重要フロー

- 19時モデレーションバッチ: 実装なしのためテストなし。
- Push通知: 実装なしのためテストなし。
- 本番DBに対する実データの公平性/通常ユーザー共有storage候補の復帰: smoke/設計はあるが、現状デフォルトfast pathはadmin storage寄り。
- クライアント時計改ざん耐性: 時刻注入テストはあるが、サーバー側で不正な未来時刻を拒否するテスト/実装はなし。
- Stripe実課金の完全E2E: API guard/webhook signatureテストはあるが、Stripe外部サービスをまたぐ本番相当フローはローカルE2E外。

## 10. 運用・リスクメモ

### 環境変数・シークレット

値は記載しません。

| key | 用途 | 根拠 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | `src/lib/supabase/config.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | `src/lib/supabase/config.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | server/admin routes | `src/lib/supabase/admin.ts` |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | metadata / billing return URL | `src/app/layout.tsx`, `src/lib/billing/subscriptions.ts` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Identity Services | `src/app/account/create/page.tsx` |
| `ADMIN_EMAILS` | 管理者email allowlist | `src/lib/adminAccess.ts` |
| `ENABLE_TEST_TOOLS` | 管理テストツール有効化 | `src/lib/adminAccess.ts` |
| `ENABLE_STOCK_ADMIN` | stock candidate追加許可 | `src/lib/adminAccess.ts` |
| `BETA_TESTER_EMAILS` | β参加者env allowlist | `src/lib/betaAccess.ts` |
| `ENABLE_BETA_SUPPORTER_BILLING` | Stripe課金有効化 | `src/lib/billing/stripe.ts` |
| `STRIPE_SECRET_KEY` | Stripe API secret | `src/lib/billing/stripe.ts` |
| `STRIPE_PRICE_ID_BETA_SUPPORTER` | βサポーターprice | `src/lib/billing/stripe.ts` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook HMAC検証 | `src/lib/billing/stripe.ts` |
| `SLEEPING_DELIVERY_FAST_CANDIDATES` | exchange fast path mode | `src/app/api/sleeping-delivery/exchange/route.ts` |
| `NEXT_PUBLIC_HOME_DESK_MODEL` | ホームv3デフォルト | `src/lib/home/homeDeskModelFlag.ts` |
| `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` / `NEXT_PUBLIC_COMMIT_SHA` | 管理パネルcommit表示 | `next.config.ts`, `src/components/settings/SettingsPage.tsx` |
| `NODE_ENV` | production時debug制御など | `src/app/api/sleeping-delivery/exchange/route.ts` |

### ユーザー数増加時に詰まりそうな箇所

- `GET /api/presence` は最大5000行をページングしてアプリ側でdistinct集計。60分メモリcacheはあるが、多インスタンスでは共有されません。根拠: `src/app/api/presence/route.ts`
- exchange rate limit はインメモリMap。Vercel多インスタンスでは共有されません。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`
- exchange候補取得はfast pathで軽量化済みだが、full pool fallbackは最大160行を読む。通常ユーザーstorage候補の公平復帰は未実装。根拠: `src/app/api/sleeping-delivery/exchange/route.ts`, `docs/2026-06-11-delivery-incident-postmortem.md`
- 写真の主保存がlocalStorage。iOS quota対策はあるが、写真数増加で容量上限に当たりやすい。根拠: `src/lib/home/sleepingPhotos.ts`, `tests/e2e/home-sleeping-exchange-flow.spec.ts`
- `product_analytics_events` queueはlocalStorage最大200件、flush batch 25。Supabase未設定/失敗時は溜まり続けるが上限で古いものが落ちます。根拠: `src/lib/analytics/productAnalytics.ts`
- Supabase Storage bucketは10MB/object。根拠: `supabase/migrations/20260524190000_create_account_sync_tables.sql`

### TODO / FIXME / HACK

検索結果: TODO 2件、FIXME/HACK 0件。

- `src/components/home/HomeInput.tsx`: `// TODO: Supabase移行時はここを書き換え`
- `src/components/home/HomeInput.tsx`: `// TODO: Supabase移行時はここを書き換え`

## 追加の重要な仕様差分まとめ

- ⚠️ 20時配達はサーバーcronではなくクライアント起動/時計判定。
- ⚠️ 19時モデレーションバッチ、AIフィルタ、事前moderated条件は未実装。
- ⚠️ 候補選定は「当日投稿」限定ではなくavailable pool全体。
- ⚠️ admin storage fast pathが現状デフォルトで、通常ユーザー共有storage候補の公平復帰は未完了。
- ⚠️ Service Worker/Push通知は未実装。PWAはmanifest-only。
- ⚠️ オンボーディングは7ステップ固定ではなく状態機械。PWA install誘導はホーム側。
- 対応済み: ホーム状態判定の hydration mismatch warning は、時刻依存stateをhydration後に確定させる修正とE2E追加で解消済みです。

## ドキュメント所在一覧（2026-07-05時点）

日々の運用と計画の起点は ROADMAP.md。詳細は各文書へ。

本プロジェクトの確定判断はすべて上記docsにあり、会話ログへの依存はない。

| パス | 版 | 一行説明 |
| --- | --- | --- |
| `docs/MARKETING-CANON.md` | v0.2 | マーケティング判断、言葉遣い、投稿・LP表現の規範。 |
| `docs/MODERATION-CANON.md` | v1.0 | 写真配信・承認/除外・安全運用の規範。 |
| `docs/OPERATIONS-PLAYBOOK.md` | v1.0 | 日次運用、障害時確認、リリース運用の手順。 |
| `docs/BETA-LEARNING-PLAN.md` | v1.0 | β期間で何を学習し、何を合格線にするかの計画。 |
| `docs/ROADMAP.md` | v1.0 | 週次レビューで「今週」「来週」を更新する運転席の一枚。 |
| `docs/neteruneko-business-strategy-v1.2.md` | v1.2 | 事業方針、課金、フェーズ設計、現像/発送検討を含む戦略。 |
| `docs/july-campaign-copy-set-v1.2.md` | v1.2 | 7月キャンペーン用コピーセット。 |
| `docs/lp-copy-v1.0.md` | v1.0 | LPサービスサイト文言。実装はCodex残便5、公開はP3。 |
| `docs/specs/prod-migration-remediation-spec-v1.0.md` | v1.0 | 本番migration・remediation作業の実装仕様。 |
| `docs/specs/incident-and-legal-audit-spec-v1.0.md` | v1.0 | 2026-07-04 incident と法務棚卸の調査仕様。 |
| `docs/specs/account-deletion-preserve-delivered-spec-v1.0.md` | v1.0 | 退会時に受信済みねがおを保全する仕様。 |
| `docs/specs/opening-flow-inventory-spec-v1.0.md` | v1.0 | 開封フロー棚卸の調査仕様。 |
| `docs/opening-flow-inventory-2026-07.md` | 2026-07 | 開封まわり実装棚卸の成果物。 |
| `docs/specs/opening-flow-v2-spec-v1.0.md` | v1.0 | 開封フローv2「ひらくは静止、しまうが動く」の実装仕様。 |
| `docs/specs/ig-post-draft-skill-spec-v1.0.md` | v1.0 | Instagram投稿ドラフト生成skillの仕様。 |
| `docs/specs/grant-hardening-spec.md` | 起票済み | DB grant hardening の仕様。 |
| `docs/legal-docs-inventory-2026-07.md` | 2026-07 | 特商法、規約、プライバシー、削除案内の棚卸と追補反映状況。 |
| `docs/incident-20260704-bulk-delete.md` | 2026-07-05 | 2026-07-04 bulk delete incident の調査記録。 |
| `docs/PROD-OPERATIONS.md` | 2026-07-05 | 本番DB・Storage・migrationを扱う際の運用ルール。 |
| `docs/DEPLOY-CHECKLIST.md` | 2026-07-04 | 本番deploy前後のmigration・smoke確認チェックリスト。 |
| `docs/BACKLOG.md` | 2026-07-05 | P2系の散在タスクを一本化したバックログ箱。 |

取り込み待ち: なし。
# Current Home Opened-State Note (2026-07-06)

The canonical home opened-state spec is `docs/specs/opening-flow-v2.md`.
Opened home must render the normal `desk-home-frame`; `home-stamp-pair` and
`home-stamp-pair-stamp` must remain absent. Older StampPair/state4 wording in
historical sections below is not canonical.

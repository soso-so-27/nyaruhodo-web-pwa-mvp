# data-flows.md — システム地図 成果物2（データフロー図）

> 出典はコードのみ。実コードの関数・テーブル・バケット名で描く（概念図にしない）。
> バケットは全て `cat-photos`（`src/lib/photoStorage.ts:3` `CAT_PHOTOS_BUCKET`）。
> 作成: 2026-07-07。

---

## 1. 写真の一生

```mermaid
flowchart TD
  A["ねがおを とる / フォルダ選択<br/>OnboardingFlow・HomeInput"] --> B["localStorage 保存<br/>nyaruhodo_exchange_own_sleeping_photos<br/>(onboarding/handoff.ts:27)"]
  B --> C["POST /api/sleeping-delivery/exchange<br/>route.ts:131"]
  C --> D{"src が data URL か<br/>storage: パスか<br/>exchange route.ts:177-179"}
  D -- "data URL & admin可" --> E["uploadDataUrl → cat-photos<br/>{owner}/{cat}/sleeping/{id}.ext<br/>exchange route.ts:1325-1329"]
  D -- "storage:パス" --> F["validateOwnStoragePhotoPathAccess<br/>先頭セグメント=userId 検証<br/>photoStorageAuthorization.ts:17"]
  E --> G["cat_moments INSERT<br/>moderation_status='pending'<br/>visibility='shared' delivery_status='available'<br/>metadata.pool_kind='user_shared'<br/>exchange route.ts:312-334"]
  F --> G
  G --> H["管理審査 GET /api/moderation/queue<br/>pending & shared & available<br/>queue/route.ts:37-47"]
  H --> I{"POST /api/moderation/decide<br/>decide/route.ts:51-63"}
  I -- approved --> J["moderation_status='approved'<br/>moderated_at/by 記録"]
  I -- rejected --> K["moderation_status='rejected'<br/>delivery_status='hidden'"]
  J --> L["配達候補 readRemoteCandidateRows<br/>visibility=shared & available & approved<br/>exchange route.ts:1130-1140"]
  L --> M["cat_moment_deliveries INSERT<br/>source_moment_id/photo_url/status='delivered'<br/>exchange route.ts:467-488"]
  M --> N["受信表示: 署名URL付与<br/>attachTransientDeliverySignedUrl (10分)<br/>exchange route.ts:1051-1088"]
  M --> O["delivery_count++ (元momentの被配達数)<br/>incrementDeliveryCount exchange route.ts:1373"]
  N --> P{"通報 POST /api/reports<br/>reports/route.ts:50"}
  P -- "distinct 2名" --> Q["cat_moments delivery_status='reported'<br/>reports/route.ts:139-142"]
  M --> R["退会 POST /api/account/delete-stored-data"]
  R --> S["配達済み(delivered)を参照するStorageは<br/>archive経路へcopyして保全<br/>copyPreservedDeliveryPhotos delete route.ts:193-231"]
  R --> T["未配達の自分のStorage/行は全削除<br/>delete route.ts:143-159"]
```

要点（出典）:
- pendingデフォルトは exchange/backup/onboarding のinsert全てで一貫（`exchange route.ts:320`, `backup/route.ts:137`）。
  ただし admin stock のみ `approved` で入る（`stock/route.ts:152`）。
- rejectは投稿者の記録を消さない（`delivery_status='hidden'` にするだけ。行は残る。`decide/route.ts:58-62`）。
- 退会時、**配達済み写真は archive にコピーして受信者側に保全**、その参照を差し替える（`delete route.ts:210-214`）。

---

## 2. 20時の交換（exchange API内部）

```mermaid
flowchart TD
  A["POST /api/sleeping-delivery/exchange"] --> B["readExchangeRequest<br/>本文3MB上限・JSON検証 route.ts:579"]
  B --> C["validateExchangeRequest<br/>ID/テキスト長・createdAt範囲 route.ts:641"]
  C --> D["checkExchangeRateLimit<br/>identity単位 route.ts:159"]
  D --> E{"own photo storage: パス?"}
  E -- yes --> F["getAuthenticatedUserForRequest<br/>+ storage path 所有検証 route.ts:182-198"]
  E -- no --> G["userId or anonymousId 必須 route.ts:207"]
  F --> H["validateExchangeDeliveryDateKey<br/>route.ts:221,707"]
  G --> H
  H --> I{"mode='onboarding' かつ<br/>過去配達0件? route.ts:730-732"}
  I -- yes --> J["オンボ例外: IP単位3回/24h<br/>checkOnboardingExchangeExceptionLimit route.ts:763"]
  I -- no --> K["validateServerDeliveryDateKey<br/>19:55解禁・7日以内 (eveningDeliveryServer)"]
  J --> L["buildIdempotentDeliveryIds<br/>sha256(identity:dateKey) route.ts:875-921"]
  K --> L
  L --> M{"readExistingDelivery<br/>冪等: 既存があれば返す route.ts:253-291"}
  M -- 既存あり --> Z1["photo=既存 + 署名URL / idempotentReplay=true"]
  M -- なし --> N{"shouldAddOwnPhotoToPool?"}
  N -- yes --> O["自moment delete→insert (pending) route.ts:305-334"]
  N -- no --> P["候補選定へ"]
  O --> P
  P --> Q["readDeliveredSourceMomentIds<br/>二度配達しない除外集合 route.ts:346"]
  Q --> R{"fastCandidateMode<br/>= admin_storage? route.ts:363"}
  R -- yes --> S["readFastStockCandidateRows→selectFastStorageCandidate<br/>route.ts:377-384"]
  R -- no --> T["readRemoteCandidateRows→sortTieredCandidates<br/>Tier1(当日)→2(在庫)→3(admin) route.ts:389-408"]
  S --> U["selectCandidate: seed起点で走査 route.ts:1428"]
  T --> U
  U --> V{"selected?"}
  V -- no --> Z2["photo=null source=none + diagnostics"]
  V -- yes --> W["prepareExchangeDeliveryPhotoSrc<br/>data URL→delivery-cache/ に退避 route.ts:1339"]
  W --> X["cat_moment_deliveries INSERT<br/>delivery_tier/date_key記録 route.ts:467"]
  X -- "23505 unique" --> M
  X --> Y["incrementDeliveryCount + 署名URL付与 route.ts:543,559"]
```

要点（出典）:
- 冪等IDは新旧2系統（`buildIdempotentDeliveryId` sha256 と `buildLegacyIdempotentDeliveryId` 32bit hash）を両方照合（`route.ts:908-921`）。
- Tier判定: admin_stock=3、当日pool_date一致=1、それ以外=2（`getDeliveryTier route.ts:1417-1426`）。
- `mode='onboarding'` は20時前でも配達解禁されるが、過去配達0件＋IP 3回/24hの二重ガード（`route.ts:730-750`）。

---

## 3. identity（識別子のライフサイクル）

```mermaid
flowchart LR
  A["匿名ID<br/>localStorage: analytics_anonymous_id<br/>storage/keys.ts:5"] --> B["getOrCreateAnonymousId<br/>(4箇所に別実装)<br/>productAnalytics.ts:210 / deliveryCandidates.ts:232<br/>/ sleepingPhotoBackup.ts:34 / mikkeWindowResults.ts:79"]
  B --> C["exchange/backup/reports の anonymousId として送信"]
  A2["匿名Supabaseセッション(任意)<br/>NEXT_PUBLIC_ANON_AUTH_ENABLED=true<br/>anonymousAuth.ts:34 signInAnonymously"] --> D["handoff作成 createOnboardingHandoff<br/>onboarding/handoff.ts:53"]
  D --> E["POST /api/onboarding/handoff/create<br/>onboarding_handoffs INSERT + Storage退避<br/>token=onb_{uuid}_{hex} create/route.ts:199"]
  E --> F["別端末/ログイン後<br/>POST redeem (1回限り)<br/>redeem/route.ts:89-100"]
  F --> G["restoreOnboardingHandoffPayloadWithSession<br/>session.setSession で匿名セッション移転<br/>handoff.ts:266-284"]
  A2 --> H["POST /api/account/transfer-intent<br/>anonymous_storage_transfer_intents INSERT<br/>token=anon_tx_{hex} transfer-intent/route.ts:61"]
  H --> I["Googleログイン後 POST copy-anonymous-storage<br/>匿名Storage→{userId}/... へcopy<br/>copy-anonymous-storage/route.ts:137-152"]
  G --> J["Googleログイン auth/callback"]
  J --> K["userId 確定<br/>account_sync 各テーブルは owner_user_id/user_id で本人スコープ"]
  K --> L["退会 POST delete-stored-data<br/>auth.admin.deleteUser で認証情報も削除<br/>delete route.ts:178"]
```

要点（出典）:
- 匿名IDは**localStorageの `analytics_anonymous_id` を4関数が各自 get-or-create**（重複実装。後述 issues D2）。
- handoff token（`onb_...`）と transfer intent token（`anon_tx_...`）は別系統。前者はオンボ状態全体、後者はStorage移送のみ。
- 退会は auth user まで削除（`supabase.auth.admin.deleteUser` `delete route.ts:178`）＝匿名性の切断。

---

## 4. 課金（Stripe）

```mermaid
flowchart TD
  A["/beta-supporter で「応援する」"] --> B["POST /api/billing/create-checkout-session<br/>create-checkout-session/route.ts:22"]
  B --> C{"user & β参加者 & Stripe設定?"}
  C -- no --> C1["401/403/503"]
  C -- yes --> D["readLatestSubscriptionForUser<br/>既存active?→409 already_active route.ts:46-50"]
  D --> E["createStripeCustomer / 再利用<br/>route.ts:52-70"]
  E --> F["upsertCheckoutStartedSubscription<br/>subscriptions 行を先行upsert route.ts:72"]
  F --> G["createStripeCheckoutSession → session.url<br/>success/cancel は /settings route.ts:85-98"]
  G --> H["Stripe Checkout(外部)"]
  H --> I["POST /api/stripe/webhook (署名検証)<br/>webhook/route.ts:30"]
  I --> J{"event.type"}
  J -- checkout.session.completed --> K["upsertSubscriptionFromCheckoutSession"]
  J -- "subscription created/updated/deleted" --> L["upsertSubscriptionFromStripeSubscription"]
  J -- invoice.payment_failed --> M["markSubscriptionPaymentFailed"]
  K --> N["subscriptions テーブル (status/current_period_end/cancel_at_period_end)"]
  L --> N
  M --> N
  N --> O["GET /api/billing/status で表示<br/>status/route.ts:25-37"]
  P["解約: POST create-portal-session<br/>Stripe Customer Portal"] --> H
  Q["退会: delete-stored-data → cancelAccountDeletionStripeSubscriptions<br/>delete route.ts:103 + subscriptions行削除:150"] --> N
```

要点（出典）:
- Checkout開始時に `subscriptions` を先行upsert（`checkout_started`）、確定はwebhook（`webhook/route.ts:41-64`）。
- webhookは署名検証のみが門番（ユーザ認証なし。`webhook/route.ts:23,30`）。
- 退会フローは billing解約を最初に実行し、失敗したら削除を中断（`delete route.ts:103-116`）。

---

## 5. 画像配信（署名URL・SWキャッシュ階層）

```mermaid
flowchart TD
  A["表示要求 StoredPhotoImage 等"] --> B{"src が storage: パス?"}
  B -- no --> B1["data URL/http はそのまま表示"]
  B -- yes --> C["POST /api/photo-storage/signed-url(s)<br/>signed-url/route.ts:29"]
  C --> D{"認可 (bearer=自分or配達済み / anon=配達済みのみ)<br/>isAuthorizedStoragePhotoPath photoStorageAuthorization.ts:38"}
  D -- no --> D1["401/403"]
  D -- yes --> E["createSignedStorageUrl<br/>display=24h / thumbnail=transform width800 q75<br/>photoStorage.ts:145-163"]
  E --> F["ブラウザ fetch(signedUrl)"]
  F --> G{"NEXT_PUBLIC_ENABLE_SW_IMAGE_CACHE?<br/>PhotoSwCacheController.tsx:12"}
  G -- on --> H["sw.js が /storage/v1/object|render/sign/cat-photos/ を横取り<br/>sw.js:16-17"]
  H --> I{"PHOTO_IMAGE_CACHE hit?"}
  I -- hit --> J["キャッシュ返却 (TTL 7日 / 最大200件 / 50MB)<br/>sw.js:20-22"]
  I -- miss --> K["network→キャッシュ格納"]
  L["purge契機: 削除/通報/logout/退会/switch/機能off<br/>photoSwCache.ts:3-10"] --> M["postMessage NN_PHOTO_CACHE_PURGE(_ALL)<br/>sw.js:71-88"]
  M --> N["該当パス or 全キャッシュ削除"]
```

要点（出典）:
- 署名URLは display=`DISPLAY_SIGNED_URL_SECONDS`=24時間（`photoStorage.ts:6`）。exchange内の一時URLは10分（`exchange route.ts:117`）。
- SWキャッシュは**フラグoffなら完全に無効**（`PhotoSwCacheController` が config を送らない）。purge理由は7種（`photoSwCache.ts:3-10`）。

---

## 6. 計測（app_events / product_analytics_events）

```mermaid
flowchart LR
  A["trackProductEvent(name, props)<br/>productAnalytics.ts:60"] --> B["localStorage キュー<br/>analytics_event_queue (最大200)<br/>keys.ts:6"]
  B --> C["flushProductAnalyticsEvents (25件バッチ)<br/>productAnalytics.ts:101"]
  C --> D["product_analytics_events INSERT (browser anon)<br/>productAnalytics.ts:124"]
  D --> E["app_events INSERT (browser anon)<br/>productAnalytics.ts:131"]
  F["サーバ側イベント<br/>exchange: onboarding_exchange_exception_limited route.ts:825<br/>backup: sleeping_backup_storage_upload_failed backup/route.ts:314"] --> E
  E --> G["GET /api/admin/analytics が集計<br/>analytics/route.ts:113 app_events 読取"]
  G --> H["/admin/analytics 表示 (admin only)"]
  I["退会 delete-stored-data<br/>app_events を user_id で削除 delete route.ts:151"] --> E
```

PIIの有無に関する注記（出典）:
- クライアントイベントは `anonymous_id`（localStorage由来）・`user_id`・`route`・`referrer`・`properties` を持つ（`productAnalytics.ts:37-49`）。
  referrerは `sanitizeReferrer` で正規化、propertiesは `sanitizeProperties` を通す（`productAnalytics.ts:73,86`）。写真URLや本文は載せない設計。
- `anonymous_id` は端末識別子として準PII。**退会削除は `user_id` 一致行のみ**（`delete route.ts:151`）＝
  ログイン前に貯まった `anonymous_id` だけのイベントは退会後も残りうる（後述 issues D1）。
- サーバ側イベントはIPを生では入れず `hashText(ipKey)` 化（`exchange route.ts:818`）。

---

## テーブル・バケット参照インデックス（この文書で登場したもの）

- テーブル: `cat_moments` / `cat_moment_deliveries` / `cat_moment_cats` / `photo_reports` /
  `subscriptions` / `onboarding_handoffs` / `anonymous_storage_transfer_intents` /
  `product_analytics_events` / `app_events` / `beta_feedback` / `referral_codes` / `referral_claims` /
  `cats` / `record_logs` / `collection_photos` / `account_sync_state` /（詳細は data-inventory.md）
- バケット: `cat-photos`（単一）

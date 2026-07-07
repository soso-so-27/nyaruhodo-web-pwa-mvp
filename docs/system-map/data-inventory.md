# data-inventory.md — システム地図 成果物3-1（データ台帳）

> 全テーブル・Storageバケット/パス規約・localStorage/IndexedDBキーの一覧。
> 各項目に「個人情報を含むか」「削除経路があるか」を付す＝プライバシー対応・退会完全性の照合表。
> 出典はコードのみ。作成: 2026-07-07。
> 「退会削除」= `src/app/api/account/delete-stored-data/route.ts:143-159` の削除ステップに含まれるか。

---

## 1. テーブル（`supabase/migrations/`）

| テーブル | 主な内容 | PII | 退会削除 | 出典（作成migration） |
|---|---|---|---|---|
| `cat_moments` | 投稿ねがお（プール）。photo_url・pool_kind・moderation_status | **写真URL**（storage:/data:）・匿名/user id | ✅ `user_id`（`route.ts:146`）。※匿名分は残存 | `20260602093000_create_cat_moment_tables.sql:14` |
| `cat_moment_deliveries` | 配達済みねこだより。source/photo_url/status | 写真URL・匿名/user id | ✅ `user_id`（`:145`）。FKは`on delete set null`で保全 | 同上:65 |
| `cat_moment_cats` | moment↔猫の関連 | user id | ✅（`:144`） | `20260617093000_create_cat_moment_cats.sql:1` |
| `photo_reports` | 通報記録（reporter・reason） | reporter id（user/anon） | ✅ `reporter_user_id`（`:148`） | `20260612093000_create_photo_reports.sql:1` |
| `subscriptions` | Stripe購読状態 | user id・stripe customer id | ✅（`:150`）＋Stripe解約 | `20260607093000_create_subscriptions.sql:1` |
| `onboarding_handoffs` | オンボ状態退避（payload・token） | **セッショントークン・写真** | ⚠️ 退会では触らない。cron GCで期限切れを掃除 | `20260704150000_create_onboarding_handoffs.sql:1` |
| `anonymous_storage_transfer_intents` | 匿名→本アカのStorage移送intent | 匿名/target user id・パス | ⚠️ 退会削除に**不在**。TTL15分＋used_at | `20260707143000_...:1` |
| `product_analytics_events` | 詳細分析イベント | anonymous_id・user_id・route・referrer | ❌ **退会削除に不在**（app_eventsのみ削除） | `20260524152000_create_product_analytics_events.sql:5` |
| `app_events` | ローンチKPIイベント | anonymous_id・user_id（写真URL等は規約で禁止） | ✅ `user_id`（`:151`）。※匿名分残存 | `20260628120000_create_app_events.sql:5` |
| `beta_feedback` | フィードバック本文 | user id・自由入力message | ✅（`:156`） | `20260607090000_create_beta_feedback.sql:1` |
| `beta_participants` | β参加者 | メール相当 | ❌ 退会削除に不在（許可リスト運用） | `20260607110000_create_beta_participants.sql:1` |
| `referral_codes` | 紹介コード | user id | ✅（`:155`） | `20260625090000_create_referrals.sql:1` |
| `referral_claims` | 紹介claim | referrer/referred user id | ✅ or条件（`:152-154`） | 同上:11 |
| `cats` | 猫プロフィール（account sync） | 猫名・誕生日・owner id | ✅ `owner_user_id`（`:158`） | `20260524190000_create_account_sync_tables.sql:27` |
| `profiles` | ユーザプロフィール | user id | ❌ 退会削除に**不在**（auth削除に依存） | 同上:14 |
| `record_logs` | 記録ログ | user id・猫記録 | ✅（`:149`） | 同上:75 |
| `collection_photos` | コレクション写真 | user id・写真 | ✅（`:147`） | 同上:102 |
| `account_sync_state` | 同期状態 | user id | ✅（`:157`） | 同上:127 |
| `account_local_state` | 端末ローカル状態のサーバ退避 | user id | ❌ 退会削除に**不在** | `20260622223000_create_account_local_state.sql:1` |
| `mikke_window_answers` | 旧「みっけ」回答 | anonymous_id | ❌ 退会削除に**不在**（旧機能残存） | `20260530233000_create_mikke_window_answers.sql:1` |
| `events` / `diagnoses` / `feedbacks` / `hint_feedbacks` | 旧にゃるほど診断系（legacy） | anonymous_id等 | ❌ 退会削除に不在（legacy） | `20260502033100_...:6,21,37`, `20260502043000_...:5` |

- **退会で確実に消えるのは13テーブル**。**残存/不在は約10**（うち `product_analytics_events`・
  `account_local_state`・`mikke_window_answers`・`profiles` は user_id を持ちうるのに退会削除経路が無い＝issues P0-1）。
- 匿名IDのみの行（ログイン前データ）は全テーブルで退会削除の対象外（削除は `user_id` 基準）。

### auth削除による波及
- 退会は最後に `supabase.auth.admin.deleteUser`（`route.ts:178`）。`cat_moments.user_id` は
  `on delete cascade`（`20260602093000_...:16`）だが**退会では先に明示delete済み**。
  `cat_moment_deliveries.user_id` は `on delete set null`（同:67）＝配達済みは残り匿名化される（保全設計）。
- `profiles` 等をauth cascadeが消すかはFK定義次第（本台帳では明示deleteの有無で判定。cascade依存は脆い）。

---

## 2. Storage（バケット `cat-photos`・単一）

出典: `src/lib/photoStorage.ts:3`（`CAT_PHOTOS_BUCKET`）。バケット定義は
`20260524190000_create_account_sync_tables.sql:150` 付近（public/file_size_limit/mime）。
全てのパス規約は「先頭セグメント＝所有者」が認可の基礎（`isOwnStoragePath` `photoStorageAuthorization.ts:17`）。

| パス規約 | 用途 | PII | 削除経路 | 出典 |
|---|---|---|---|---|
| `{userId}/{catId}/sleeping/{momentId}.ext` | ログインユーザの自分ねがお | 写真 | ✅ 退会で prefix 一括list→remove（`delete route.ts:282-314`） | `exchange route.ts:1327` / `backup/route.ts:277` |
| `anonymous/{anonymousId}/sleeping/{id}.ext` | 匿名ユーザの自分ねがお | 写真 | ⚠️ 退会は`userId` prefixのみ。匿名分は残存 | `backup/route.ts:280-282` |
| `admin-stock/sleeping/{id}.ext` | 運営シード写真 | 写真（運営提供） | ❌ 個別削除経路なし（管理運用） | `stock/route.ts:222` |
| `delivery-cache/{momentId}.ext` | data URL配達物のStorage退避 | 写真 | ❌ 明示GC経路なし | `exchange route.ts:1361` |
| `handoffs/{token}/{index}.ext` | オンボ退避画像 | 写真 | ✅ redeem時＋cron cleanupで削除（`redeem/route.ts:117`, `cleanup/route.ts:68`） | `create/route.ts:133` |
| `anonymous/migrated/{id}.ext` | backfillでdata URL→Storage化 | 写真 | ❌ 明示GC経路なし | `backfill-cat-moments/route.ts:79` |
| `{userId}/archived-delivery/...`（archive path） | 退会時に配達済みを保全コピー | 写真 | 退会で元を消し archive を残す（受信者保全） | `accountDeletionStorage.ts` / `delete route.ts:193-231` |

- 削除経路が無いStorageパス: `admin-stock`（意図的）・`delivery-cache`・`anonymous/migrated`（GC未整備）。

---

## 3. localStorage キー（`src/lib/storage/keys.ts`）

PII観点で重要なものを中心に。全キーは `STORAGE_KEYS`（`keys.ts:1-28`）＋動的キー（`:30-44`）。

| キー | 内容 | PII | 出典 |
|---|---|---|---|
| `analytics_anonymous_id` | 匿名ID（分析・配達・通報で共用） | 準PII（端末識別） | `keys.ts:5` |
| `analytics_event_queue` | 未送信イベントキュー（最大200） | anonymous/user id・route | `keys.ts:6` |
| `analytics_session` | セッションID | 準PII | `keys.ts:7` |
| `cat_profiles` / `cat_profile`(legacy) | 猫プロフィール | 猫名・誕生日 | `keys.ts:10,22` |
| `neteruneko_cat_gallery_photos` | 猫ギャラリー写真 | **写真（data URL含む）** | `keys.ts:9` |
| `collection_photos` | コレクション写真 | 写真 | `keys.ts:11` |
| `neteruneko_omoide_memories` | 思い出便データ | 写真・日付 | `keys.ts:16` |
| `nyaruhodo_exchange_own_sleeping_photos`(動的) | 自分ねがおの端末保存 | 写真 | `onboarding/handoff.ts:27` |
| `neteruneko_onboarding_progress` / `_source` | オンボ進行・流入元 | source(utm等) | `keys.ts:24-25` |
| `neteruneko_pending_referral_code` | 保留中の紹介コード | 紹介コード | `keys.ts:26` |
| `onboarding_completed` | 完了フラグ | なし | `keys.ts:23` |
| 動的: `record_log_{catId}` `light_data_{catId}` `lock_data_{catId}` `discovery_log_{catId}` | 猫別記録 | 猫記録 | `keys.ts:30-44` |

- localStorageは端末内。退会APIはサーバのみ削除するため、**端末側キーはクライアント側のクリア処理に依存**
  （本台帳のスコープ外だが、退会完全性の観点で注記）。
- IndexedDB: `src/` に直接の `indexedDB` 利用は確認されず（写真は localStorage data URL と Storage が主）。
  SWの Cache Storage（`neteruneko-photo-images-v1` 等 `public/sw.js:5-6`）が画像の端末キャッシュ層。

---

## サマリ（この文書分）

- テーブル: **約23**（現行13＋legacy/旧機能約10）。退会削除に含まれるのは**13**。
- Storage: バケット**1**（`cat-photos`）／パス規約**7種**（削除経路ありは3種）。
- localStorageキー: **約28**（静的24＋動的4系）。
- **退会完全性の穴（削除経路なしでuser紐づきうる）**: `product_analytics_events`・`account_local_state`・
  `profiles`・`mikke_window_answers`（→ issues P0-1 / P2-4）。

---

## 2026-07-07 update: account deletion coverage

`src/app/api/account/delete-stored-data/route.ts` now explicitly deletes these
additional account-owned tables through the service-role account deletion API:

- `account_local_state` by `user_id`
- `product_analytics_events` by `user_id`
- `mikke_window_answers` by `user_id`
- `profiles` by `id`

The same route accepts the client-held `anonymousId` during account deletion.
Anonymous-era rows are deleted only when that anonymous id has a recorded contact
with the current user (`app_events`, `product_analytics_events`,
`mikke_window_answers`, or `referral_claims`). If no contact is found, the
anonymous cleanup is skipped and recorded in the API result. This prevents a
logged-in user from naming another user's anonymous id and deleting unrelated
anonymous data.

Storage cleanup also includes `anonymous/{anonymousId}/` when the anonymous id is
authorized by the same contact check. Admin stock, aggregate/reporting views,
handoff audit rows, and transfer-intent audit rows remain intentionally outside
the account-deletion route.

# Account DB Sync Design

## Purpose

Googleログイン後に、同じアカウントなら端末をまたいで猫データを復元できるようにする。

このフェーズの目的は「localStorage MVPを壊さず、ログインユーザー向けの同期先を用意する」こと。既存の匿名利用、診断、みっけ記録、コレクション体験はそのまま維持する。

## Non Goals

- 未ログインユーザーにログインを強制しない
- 既存の `events` / `diagnoses` / `feedbacks` / `hint_feedbacks` の保存仕様を変更しない
- 既存localStorageを即時DB移行しない
- 家族共有、課金、複数メンバー管理はまだ作らない
- Stripe連携、ネイティブアプリ課金、サブスクリプション管理はまだ作らない

## Current Local Data

| localStorage key | Meaning | DB sync target |
| --- | --- | --- |
| `cat_profiles` | 猫プロフィール、診断結果、写真参照 | `cats` |
| `active_cat_id` | 現在の猫 | sync state metadata or local only |
| `record_log_{catId}` | みっけ・おせわ・リアクション記録 | `record_logs` |
| `collection_photos` | コレクション写真 | `collection_photos` + Storage |
| `onboarding_completed` | 端末上の完了状態 | local only |
| `discovery_log_{catId}` | 発見カード既読 | later: sync state metadata |
| `home_visit_count` | ホームCTA表示制御 | local only |

## Tables

### `profiles`

Supabase Authユーザーに対応する最小プロフィール。

- `id`: `auth.users.id`
- `display_name`: 任意
- `created_at`, `updated_at`

### `cats`

ログインユーザーが所有する猫プロフィール。

- `owner_user_id`: 所有ユーザー
- `local_cat_id`: localStorageの猫IDとの対応
- `name`
- `type_key`, `type_label`, `type_tagline`
- `basic_info`, `appearance`, `axis_scores`, `activity_pattern`, `type_scores`, `modifiers`, `onboarding`, `understanding`
- `avatar_storage_path`, `home_photo_storage_path`, `home_photo_position`
- `metadata`

写真本体はDBにbase64で保存しない。Supabase Storageの `cat-photos` bucket に置き、DBにはstorage pathだけ持つ。

### `record_logs`

みっけ、おせわ、リアクションなどの時系列ログ。

- `record_type`: `yousu` / `mugi` / `reaction` / `photo`
- `value`: 記録値
- `label`: 表示名
- `metadata`: 拡張情報
- `occurred_at`: 実際に起きた日時
- `local_record_id`: localStorage側IDとの重複防止

### `collection_photos`

コレクションの各スロットに紐づく写真メタデータ。

- `slot_slug`: ポーズ・シーンのslug
- `storage_path`: Storage上の写真パス
- `local_photo_id`: localStorage側との重複防止

### `account_sync_state`

同期処理の状態管理。

- `last_pull_at`
- `last_push_at`
- `metadata`

## Storage

Bucket: `cat-photos`

Path convention:

```text
{user_id}/{cat_id}/avatar/{file_id}.jpg
{user_id}/{cat_id}/home/{file_id}.jpg
{user_id}/{cat_id}/collection/{slot_slug}/{file_id}.jpg
```

Storage RLSは「パスの先頭が `auth.uid()` と一致するものだけ」読み書き可能にする。

## RLS Principle

- `anon` には新規同期テーブルの権限を付与しない
- `authenticated` は自分の行だけ読める・書ける
- `record_logs` / `collection_photos` は `user_id = auth.uid()` かつ対象 `cat_id` が自分の猫であることを確認する
- 既存MVP用の匿名insertテーブルには触らない

## Sync Phases

### Phase 1: Schema and RLS

今回の対象。

- DB table作成
- Storage bucket作成
- RLS設定
- 既存MVPへの影響なし

### Phase 2: Logged-in Upload

ログイン済みユーザーに「この端末のデータをアカウントに保存」を提供する。

- `cat_profiles` を `cats` にupsert
- `record_log_{catId}` を `record_logs` にupsert
- 写真data URLをStorageへuploadしてpathを保存
- localStorageは消さない

### Phase 3: Empty Device Restore

新しい端末でログインしたときにDBからlocalStorageへ復元する。

- `cats` をlocalStorage形式に変換
- `record_logs` を `record_log_{catId}` に復元
- Storage URLを取得して写真表示

### Phase 4: Paid Retention

長期保存・容量・写真枚数を課金プラン設計に接続する。

## Open Decisions

- 写真の保存容量上限
- 無料プランで保持する写真枚数
- 退会時のデータ削除UX
- 家族共有をいつ追加するか
- ネイティブアプリ化後の課金導線をWeb Stripeに寄せるか


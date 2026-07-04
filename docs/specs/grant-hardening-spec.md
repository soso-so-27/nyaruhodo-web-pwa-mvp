# Grant Hardening Spec

日付: 2026-07-04
目的: Supabase本番DBに残っている広すぎるdefault grantを、安全に棚卸しして絞る。

## 背景

`docs/prod-migration-gap-2026-07-04.md` の本番検証で、S1/S3のanon direct insertは塞がった。

一方で、`information_schema.role_table_grants` 上は、過去migration由来で以下のような広いgrantが残っている。

- anon / authenticated に `TRUNCATE`
- anon / authenticated に `DELETE` / `UPDATE`
- service_role に `TRUNCATE`

RLSにより通常DMLは制限されるが、grantとして広い状態は公開前に整理したい。

## 今回やらないこと

このspecは起票のみ。2026-07-04のP0 migration修復では実装しない。

## 対象候補

- `cat_moments`
- `cat_moment_deliveries`
- `cat_moment_cats`
- `collection_photos`
- `cats`
- `record_logs`
- `photo_reports`
- `subscriptions`
- `app_events`
- `referral_codes`
- `referral_claims`
- `beta_participants`
- `beta_feedback`
- `onboarding_handoffs`
- legacy tables: `events`, `diagnoses`, `feedbacks`, `hint_feedbacks`, `mikke_window_answers`

## 方針

1. 全public tableについて、role別grantを棚卸しする。
2. API経路ごとに必要な権限を列挙する。
3. anon / authenticated は最小権限に絞る。
4. service_roleはAPIで必要な権限のみ残す。ただしservice_roleは運用API用なので、削りすぎて本番復旧経路を壊さない。
5. `TRUNCATE` は原則アプリroleから剥奪する。
6. RLS policyとgrantの両方で拒否されることを実弾テストで確認する。

## 受け入れ条件

- `information_schema.role_table_grants` の表がdocsに残る
- anon direct insert/update/delete/truncateが主要テーブルで拒否される
- authenticated userが自己行に必要な操作だけできる
- service_role API経路が壊れない
- E2E全件green
- 本番適用前にbackup確認済み

## 注意

grant変更は広範囲に影響する。1テーブルずつmigrationを分け、各migrationに対応するAPI/E2E確認を添えること。

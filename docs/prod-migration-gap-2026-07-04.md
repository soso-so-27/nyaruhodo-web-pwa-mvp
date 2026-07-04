# 本番Supabase migration gap調査 2026-07-04

対象 project: `nyaruhodo-mvp-test` / ref `fwqhpjumerbqufqgmibu`
確認日時: 2026-07-04 JST
操作区分: 本番Supabase。読み取り調査後、条件を満たしたためmigration適用を実施。

## 結論

本番は `20260628120000_create_app_events.sql` まで適用済みで、`20260702093000` 以降7本が未適用だった。

このため、調査開始時点では以下が本番未反映だった。

- S1: `cat_moments_insert_anonymous_backup` のdrop
- S3: `cat_moment_deliveries_insert_anonymous_backup` のdrop
- service_role grant復旧
- onboarding handoff用テーブル

2026-07-04に `supabase db push --linked` で未適用7本を適用した。

## タスクA: 未適用境界

実行:

```bash
npx supabase migration list --linked
```

境界:

| 状態 | migration |
| --- | --- |
| 適用済み最終 | `20260628120000_create_app_events.sql` |
| 未適用開始 | `20260702093000_revoke_anon_cat_moments_insert.sql` |

未適用だったmigration:

| version | name | 内容一行要約 | 破壊的操作 |
| --- | --- | --- | --- |
| `20260702093000` | `revoke_anon_cat_moments_insert` | `cat_moments_insert_anonymous_backup` policyをdropし、anon INSERTをrevoke | データ破壊なし。policy drop / revokeあり |
| `20260702113000` | `revoke_anon_cat_moment_deliveries_insert` | `cat_moment_deliveries_insert_anonymous_backup` policyをdrop | データ破壊なし。policy dropあり |
| `20260702114500` | `grant_service_role_cat_moment_tables` | `cat_moments` / `cat_moment_deliveries` にservice_role read/write grantを付与 | なし |
| `20260702115500` | `grant_service_role_photo_reports` | `photo_reports` にservice_role SELECT/INSERT grantを付与 | なし |
| `20260702120000` | `grant_service_role_api_tables` | billing / referrals / beta / analytics用のservice_role grantを付与 | なし |
| `20260704150000` | `create_onboarding_handoffs` | onboarding handoffテーブル作成、anon/authenticatedからrevoke、service_role grant | なし |
| `20260704162000` | `harden_onboarding_handoffs` | handoff TTL defaultを24hへ短縮 | なし |

S1関連パッチ:

- `20260702093000` が未適用リストに含まれていた。
- `20260702113000` も未適用で、S3も本番未反映だった。

手動適用の捻れ:

- `supabase migration list --linked` 上、remote-only migrationは見当たらなかった。
- dry-runの適用予定は未適用7本と一致した。

## タスクB: S1実効状態 調査開始時点

実行:

```sql
select relname, relrowsecurity from pg_class
where relname in ('cat_moments', 'cat_moment_deliveries');
```

結果:

| relname | relrowsecurity |
| --- | --- |
| `cat_moment_deliveries` | true |
| `cat_moments` | true |

RLS自体は有効だった。

匿名insert policy:

| table | policy | 状態 |
| --- | --- | --- |
| `cat_moments` | `cat_moments_insert_anonymous_backup` | 調査開始時点で生存 |
| `cat_moment_deliveries` | `cat_moment_deliveries_insert_anonymous_backup` | 調査開始時点で生存 |

判定:

- 調査開始時点では、RLSは有効だが、anon insert backup policyが両テーブルで生存していた。
- `cat_moments` はanonのINSERT grantも残っており、grant + policyの両方が開いていた。
- `cat_moment_deliveries` もanonのINSERT grantとpolicyが残っていた。

## 適用前提

バックアップ:

```bash
npx supabase backups list --project-ref fwqhpjumerbqufqgmibu -o json
```

結果:

- 最新物理バックアップ: `2026-07-03T23:24:37.932Z`
- status: `COMPLETED`
- PITR: `false`
- region: `ap-southeast-1`

dry-run:

```bash
npx supabase db push --linked --dry-run
```

結果:

```txt
Would push these migrations:
 • 20260702093000_revoke_anon_cat_moments_insert.sql
 • 20260702113000_revoke_anon_cat_moment_deliveries_insert.sql
 • 20260702114500_grant_service_role_cat_moment_tables.sql
 • 20260702115500_grant_service_role_photo_reports.sql
 • 20260702120000_grant_service_role_api_tables.sql
 • 20260704150000_create_onboarding_handoffs.sql
 • 20260704162000_harden_onboarding_handoffs.sql
```

破壊的データ操作:

- `drop table` / `drop column` / `truncate` / `delete from` は未適用7本に含まれない。
- `drop policy` はS1/S3の目的そのものとして含まれる。

## 適用

実行:

```bash
npx supabase db push --linked
```

適用されたmigration:

- `20260702093000`
- `20260702113000`
- `20260702114500`
- `20260702115500`
- `20260702120000`
- `20260704150000`
- `20260704162000`

適用後dry-run:

```txt
Remote database is up to date.
```

## 適用後検証

### (a) migration適用確認

```sql
select version from supabase_migrations.schema_migrations
where version in ('20260702113000', '20260702114500')
order by version;
```

結果:

| version |
| --- |
| `20260702113000` |
| `20260702114500` |

期待値どおり2行。

### (b) backup policy消滅

```sql
select policyname from pg_policies
where tablename = 'cat_moment_deliveries'
  and policyname = 'cat_moment_deliveries_insert_anonymous_backup';
```

結果: 0行。

追加確認:

```sql
select policyname, cmd, roles::text, qual, with_check
from pg_policies
where tablename in ('cat_moments', 'cat_moment_deliveries')
  and policyname like '%anonymous_backup%';
```

結果: 0行。

### (c) service role grant

```sql
select privilege_type from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'cat_moment_deliveries'
  and grantee = 'service_role'
order by privilege_type;
```

結果:

- `DELETE`
- `INSERT`
- `REFERENCES`
- `SELECT`
- `TRIGGER`
- `TRUNCATE`
- `UPDATE`

要求された `SELECT` / `INSERT` / `UPDATE` / `DELETE` は含まれている。

注意:

- 既存default grant由来で `REFERENCES` / `TRIGGER` / `TRUNCATE` も残っている。
- これは本タスクのスコープ外「デフォルトgrantの全面刈り込み」に該当するため、`docs/specs/grant-hardening-spec.md` に別タスクとして起票。

### (d) 非approved配達履歴の棚卸

指定SQLは現スキーマと列名が異なるため、実列に合わせて以下で確認した。

```sql
select count(*)::int as non_approved_delivery_count
from public.cat_moment_deliveries d
join public.cat_moments m on m.id::text = d.source_moment_id
where m.moderation_status is distinct from 'approved';
```

結果:

| non_approved_delivery_count |
| ---: |
| 16 |

内訳:

```sql
select m.moderation_status, d.status, count(*)::int as count
from public.cat_moment_deliveries d
join public.cat_moments m on m.id::text = d.source_moment_id
where m.moderation_status is distinct from 'approved'
group by m.moderation_status, d.status;
```

| moderation_status | status | count |
| --- | --- | ---: |
| `pending` | `delivered` | 16 |

補足:

- 対象は2026-06-05〜2026-06-11ごろの過去配達履歴。
- 本タスクでは削除・更新しない。
- 今後の候補選定は `moderation_status = 'approved'` に絞られるため、新規配達の防止はS4で担保される。

### anon直接insert 実弾テスト

anon keyでPostgRESTへ直接insertを実施。payloadは制約に合う最小JSON。

結果:

| table | HTTP | DB error | 判定 |
| --- | ---: | --- | --- |
| `cat_moments` | 401 | `42501 permission denied for table cat_moments` | 拒否 |
| `cat_moment_deliveries` | 401 | `42501 new row violates row-level security policy` | 拒否 |

## 残課題

1. 既存の非approved配達履歴が16件ある。
   - データ更新/削除は破壊的操作に該当しうるため、本タスクでは未実施。
2. anon/authenticated/service_roleに広いdefault grantが残っている。
   - `TRUNCATE` 等の剥奪は横断棚卸が必要。
   - `docs/specs/grant-hardening-spec.md` に別タスクとして起票。
3. Vercel自動deployとGitHub Actions migration適用の順序は、Vercel側の設定によっては完全には保証されない。
   - `docs/DEPLOY-CHECKLIST.md` に手動確認手順と順序を明記。

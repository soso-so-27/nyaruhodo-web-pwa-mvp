# Production operations rules

作成日: 2026-07-05

## 本番データ削除・大量更新の原則

本番データに対する `DELETE` / 大量 `UPDATE` / `TRUNCATE` / DDL は、事前報告と承認なしに実行しない。

実行前に必ず以下を共有する。

1. 対象project / branch / environment
2. 対象テーブル
3. 実行予定SQL
4. WHERE句
5. 事前 `select count(*)`
6. 対象サンプル数件
7. 副作用確認クエリ
8. Storage object への影響有無
9. バックアップ/PITR状態
10. ロールバック/復元方針

承認前に実行してよいのは読み取り専用SQLだけ。

## 写真・モデレーションデータの扱い

- 目視判断が必要な写真は、SQLで一括削除せず、管理キューで approve/reject する。
- テストデータに見える場合でも、写真内容を見ずに本番から大量削除しない。
- 孤児レコードや孤児Storage objectを見つけても、調査タスク内では削除しない。件数と条件を報告し、別タスクで扱う。

## Migration / deploy

コードデプロイ前に本番migrationが適用済みであることを確認する。

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

期待値:

```txt
Remote database is up to date.
```

未適用migrationがある場合は、内容に破壊的操作がないことを確認してから適用する。破壊的操作が含まれる場合は停止してレビューする。

## Incident record

本番DBに対して通常運用外の変更を行った場合、`docs/incident-*.md` に以下を残す。

- 実行時刻
- 実行者/経路
- 対象
- SQLまたは操作内容
- 件数
- 事前確認
- 事後確認
- 復元可能性
- 再発防止

## Weekly pool health check

Run this read-only query before public campaigns and at least weekly during beta:

```sql
select
  metadata->>'source' as src,
  moderation_status,
  state,
  count(*)
from cat_moments
group by 1, 2, 3
order by 4 desc;
```

Check three things:

1. `src = 'admin-stock'` with `moderation_status = 'approved'` has at least 1 row. This is the onboarding first-letter supply canary.
2. `moderation_status = 'pending'` is not piling up. Clear the moderation queue before campaigns so real user photos are not buried under test leftovers.
3. Code must treat admin stock consistently. Runtime selection uses `metadata.pool_kind = 'admin_stock'`; legacy/prod rows with `metadata.source = 'admin-stock'` are also treated as admin stock as a compatibility fallback.

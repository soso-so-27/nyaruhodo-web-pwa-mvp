# Deploy Checklist

最終更新: 2026-07-04

## 原則

本番反映は必ず次の順序で行う。

1. Supabase migrationを本番DBへ適用
2. migration差分がないことを確認
3. アプリコードをVercelへ反映
4. 本番スモークテスト

コードだけ先に本番へ出すと、RLS / grant / 新規テーブルが未反映の状態でAPIが動き、公開前セキュリティ修正が無効になる。

## GitHub Actions

`main` push時に `.github/workflows/supabase-migrations.yml` が以下を実行する。

1. Supabase CLIを使い、production projectへlink
2. `supabase db push --linked --yes`
3. `supabase db push --linked --dry-run`
4. dry-run結果が `Remote database is up to date.` でない場合はfail

必要なGitHub Secrets:

| secret | 用途 |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI認証 |
| `SUPABASE_DB_PASSWORD` | linked DBへのmigration適用 |

固定project ref:

| project | ref |
| --- | --- |
| `nyaruhodo-mvp-test` | `fwqhpjumerbqufqgmibu` |

## 手動デプロイ時の確認

### 1. migration差分確認

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

期待:

```txt
Remote database is up to date.
```

### 2. 本番バックアップ確認

```bash
npx supabase backups list --project-ref fwqhpjumerbqufqgmibu -o json
```

直近の `is_physical_backup: true` / `status: COMPLETED` を確認する。

### 3. migration適用

dry-runで未適用migrationが出た場合、破壊的操作がないことを確認してから:

```bash
npx supabase db push --linked
```

破壊的操作の例:

- `drop table`
- `drop column`
- `truncate`
- `delete from`
- 大量 `update`

該当する場合は、その場で止めて個別レビューする。

### 4. S1〜S4最小検証

```sql
select version from supabase_migrations.schema_migrations
where version in ('20260702093000', '20260702113000', '20260702114500');

select policyname from pg_policies
where tablename in ('cat_moments', 'cat_moment_deliveries')
  and policyname like '%anonymous_backup%';
```

期待:

- migration versionは3行
- anonymous backup policyは0行

### 5. anon直接insert拒否

anon keyで `cat_moments` / `cat_moment_deliveries` へ直接insertし、401/403系で拒否されることを確認する。

### 6. アプリスモーク

- 紹介リンクからオンボーディング開始
- 写真投入
- Googleなしの場合のつづきリンク作成
- ホーム追加後の復元
- 管理画面で候補写真承認
- 20時配達候補にapprovedだけが乗ること
- `/admin/analytics` がadmin以外に見えないこと

## 注意

VercelのGit連携が自動deployを即時開始する場合、GitHub Actionsのmigration完了より先にVercel build/deployが走る可能性がある。公開直前はGitHub Actionsの `Supabase migrations` 成功を確認してから本番URLを検証する。

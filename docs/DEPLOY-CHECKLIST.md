# Deploy Checklist

## デプロイ運用の段階ルール

### 段階0: 先行期（〜P3ローンチまで）**←現在**

- main直pushを継続してよい（ソロ・ユーザー30人規模・毎日目が届く前提）
- **19:00〜21:00 JSTはデプロイ禁止**（審査時間帯＋20時便＋開封の時間を守る）。
  デプロイは午前〜昼を基本とする
- 配達コア（とる／とどく／ひらく／モデレーション）に触れる変更は、
  push前に該当E2Eスペックをローカル実行する（全件でなく該当分のみで可）
- 週次レポートに「今週入れた変更」を1行ずつ記録する（障害時の即時参照用）
- DB削除・migration の既存ルール（PROD-OPERATIONS / migration before deploy）は従来通り

### 段階1: P3（一般公開）以降

- **main直push禁止。作業ブランチ → PR → マージ**に切り替える
  - PRの目的は承認ではなく「差分を一度立ち止まって見る儀式」と、
    CI（migration差分チェック・E2E）をマージ前に通す関所
  - Codexの成果物も同じ関所を通す
- Vercel preview デプロイで実機確認 → 問題なければマージ、の順に反転させる
- migrationを含むPRは、夜間・就寝前にマージしない。翌朝見届けられる時間帯にマージ
- 切り替え作業（P3準備タスクとして実施）:
  - GitHubブランチ保護ルール: mainへの直push禁止・CI必須化
  - CI: PR時にもmigration差分チェックとE2E（可能な範囲）を実行するよう workflow 拡張

### 段階2: 課金成長期（月次課金者が数十人を超えたら）

- staging環境（本番同型のSupabaseプロジェクト）を用意し、migrationは staging → 本番の二段
- 導入時期はROADMAPフェーズ2のゲート判断と同時に再検討（早すぎる導入は管理コスト先行）

### 原則（全段階共通）

- 守るのはpushの自由さではなく**関所の位置**。過去の事故
  （本番未適用migration・無承認削除・退会とStripeの断絶）はすべて
  「確認の関所が無い場所でDBが動いた」型であり、pushスタイルの問題ではない
- 新しい種類の破壊的操作を行う前は、必ず既存ルール（PROD-OPERATIONS）に立ち返る

## ローカル統合E2Eの復旧手順

- `supabase stop && supabase start` でローカルSupabaseを再起動する。
- `supabase status` の URL / anon key / service role key を `.env.local` に再同期する。
- Playwrightプリフライトがkey不一致を検出したら、E2Eは走らせず上記手順で直す。

## 統合E2Eの判定規則（P3準備）

- Supabase local起動込みのDB統合E2EをCIへ移した後は、「ローカルの赤=環境、CIの赤=本物」として扱う。

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

オンボーディングを変更した便は、公開案内前に `docs/onboarding-owner-final-test-checklist.md` の必須項目を実機で確認する。

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

# 作業指示: 本番Supabase migration未適用の調査・修復・検証（P0）

> 対象: Codex実装用。自己完結。
> 優先度: **P0（先行ユーザー受け入れのブロッカー）**
> 注意: **本番データベースに対する作業**。破壊的操作の前に必ず停止して報告すること。

---

## 0. 状況（確定した事実）

本番Supabase（project: nyaruhodo-mvp-test / main / PRODUCTION）で以下を確認済み:

1. migration `20260702113000` / `20260702114500` が `supabase_migrations.schema_migrations` に**存在しない**（未適用）
2. `cat_moment_deliveries` に policy `cat_moment_deliveries_insert_anonymous_backup` が**生存**
3. `cat_moment_deliveries` の grant: anon/authenticated に INSERT〜TRUNCATE までフル残存
4. `cat_moments` の grant: anon に INSERT/UPDATE/DELETE/TRUNCATE 等が残存（SELECTのみ無し）

推定: コードはデプロイ済みだが、ある時点以降のmigrationが本番に一切届いていない。
4のSELECT欠落から、初期のどこかまでは適用され、途中で止まったと見られる。
**S1〜S4のセキュリティパッチがローカル/E2Eでのみ有効で、本番では無効の可能性が高い。**

## 1. タスクA — 未適用境界の特定（読み取りのみ・安全）

1. `supabase migration list --linked` を実行し、ローカル `supabase/migrations/` と本番の差分全量を取得
2. CLI不可の場合はSQL Editorで:
   ```sql
   select version, name from supabase_migrations.schema_migrations
   order by version desc;
   ```
   をローカルのmigrationファイル一覧と突き合わせる
3. 成果物: `docs/prod-migration-gap-2026-07-04.md` に
   - 適用済み最終migration（境界線）
   - 未適用migrationの全リスト（version / name / 内容一行要約 / 破壊的操作の有無）
   - 特に **S1関連パッチmigrationが未適用リストに含まれるか** を明記

## 2. タスクB — S1実効状態の確認（読み取りのみ・安全）

```sql
select relname, relrowsecurity from pg_class
where relname in ('cat_moments', 'cat_moment_deliveries');

select policyname, cmd, roles::text, qual, with_check
from pg_policies where tablename = 'cat_moments';

select policyname, cmd, roles::text, qual, with_check
from pg_policies where tablename = 'cat_moment_deliveries';
```

判定を `docs/prod-migration-gap-2026-07-04.md` に追記:
- anonのINSERTを許すpolicyが生きているか（生きていればgrant+policy両開き＝実害あり）
- RLS自体が無効化されているテーブルがないか（`relrowsecurity = false` は即報告）

## 3. タスクC — 適用（ここから書き込み・条件付き）

**前提条件（すべて満たさない場合は停止して報告）:**
- タスクAの未適用リストに破壊的操作（drop table / drop column / truncate / delete from）を含む
  migrationが**ない**こと。あるものは個別に内容を報告し、指示を待つ
- 本番との手動適用の捻れ（ローカルに無いmigrationが本番にある等）が**ない**こと。
  あれば `supabase migration repair` が必要になるため、状況を報告して停止

**手順:**
1. Supabaseダッシュボードでバックアップ（PITR or 手動バックアップ）の存在を確認。
   直近バックアップが無ければ作成してから進む
2. `supabase db push --linked --dry-run` で適用予定を出力し、タスクAのリストと一致確認
3. `supabase db push --linked` で適用
4. 適用後検証（すべて期待値になること）:
   ```sql
   -- (a) 2本の適用確認 → 2行
   select version from supabase_migrations.schema_migrations
   where version in ('20260702113000', '20260702114500');

   -- (b) backup policy消滅 → 0行
   select policyname from pg_policies
   where tablename = 'cat_moment_deliveries'
     and policyname = 'cat_moment_deliveries_insert_anonymous_backup';

   -- (c) service role grant → SELECT/INSERT/UPDATE/DELETE の4行
   select privilege_type from information_schema.role_table_grants
   where table_name = 'cat_moment_deliveries' and grantee = 'service_role';

   -- (d) 非approved配達履歴の棚卸 → 0
   select count(*) from cat_moment_deliveries d
   join cat_moments m on m.id = d.cat_moment_id
   where m.moderation_status is distinct from 'approved';
   ```
5. 実弾テスト: anonキーで PostgREST に直接insertし、拒否されることを確認
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -X POST \
     "$SUPABASE_URL/rest/v1/cat_moment_deliveries" \
     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" -d '{}'
   # 期待: 401 or 403（201が返ったら失敗＝即報告）
   ```
   同様のテストを `cat_moments` にも実施
6. 本番アプリの回帰確認: 主要フロー（とる→モデレーション承認→8時配達候補に載る）が
   壊れていないことをスモーク確認（管理画面から1件の流れを目視）

## 4. タスクD — 再発防止（仕組み化）

原因の型: デプロイ（Vercel自動）とmigration適用（手動）が別系統で、後者が漏れた。

1. GitHub Actions に migration適用ジョブを追加:
   - main への push 時、Vercelビルドに**先行**して `supabase db push` を実行
     （確立済みパターン「migration before code deploy」の自動化）
   - `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` はGitHub Secretsで
2. 適用漏れ検知: CI に `supabase migration list --linked` の差分チェックを追加し、
   差分があればワークフローを fail させる
3. `docs/DEPLOY-CHECKLIST.md` を新設または更新（手動デプロイ時の確認手順を明文化）

## 5. スコープ外（本タスクでやらないこと）

- **デフォルトgrantの全面刈り込み**（anon/authenticatedからのTRUNCATE等の剥奪）。
  全テーブル横断の棚卸が必要なため、別タスクとして
  `docs/specs/grant-hardening-spec.md` の起票のみ行う（実装しない）
- RLS policyの新規追加・変更（既存migrationの適用のみ）

## 6. 完了条件

- [ ] `docs/prod-migration-gap-2026-07-04.md`（タスクA+Bの調査結果）
- [ ] 本番で検証クエリ (a)〜(d) が全て期待値
- [ ] anon直接insertの実弾テストが cat_moments / cat_moment_deliveries とも拒否
- [ ] CI migration自動適用+差分検知が main で動作
- [ ] `docs/DEPLOY-CHECKLIST.md` 反映
- [ ] STATUS_REPORT 更新（S1〜S4の状態を「本番込みで検証済み」に更新）
- [ ] grant-hardening-spec.md 起票

## 7. 報告フォーマット

完了時、以下を報告:
- コミットハッシュ
- タスクAで判明した境界線（どこから止まっていたか）と未適用本数
- 検証クエリ(a)〜(d)と実弾テストの結果
- タスクC前提条件で停止した場合はその内容

---
改訂履歴: v1.0 (2026-07-04) 初版

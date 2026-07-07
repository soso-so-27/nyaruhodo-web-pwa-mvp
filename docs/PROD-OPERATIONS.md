# Production operations rules

作成日: 2026-07-05

## 本番データ削除・大量更新の原則

**本節が削除・大量更新の承認手順の正**（恒久原則の一行はAGENTS.md「Operational discipline」、そこから本節が参照される）。

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

**正: `docs/DEPLOY-CHECKLIST.md`**（migration always precedes code deploy。恒久原則はAGENTS.md）。
確認コマンド・期待値・破壊的操作時の停止手順は DEPLOY-CHECKLIST「手動デプロイ時の確認」を参照し、
本書では重複させない（2026-07-07 一本化）。

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

## 配達保証・安全設計の原則（2026-07-07 正式収載）

旧「事業方針v2.0 §9 配達保証／§17 安全設計」はリポジトリ外の文書で原本が失われている。
spec-v1.3が依拠する原則を、ここに正式に収載する（docs監査 B10対応）。
内容の出典: `docs/specs/spec-v1.3.md` §1.2・§2.1・§3.1・§3.5 の記述と
`docs/MODERATION-CANON.md` §4.5 からの逆算復元（新規の発明は含まない）。

- **配達保証**: 候補は Tier1（当日の一般投稿）→ Tier2（過去在庫）→ Tier3（運営シード）の順で
  選び、フォールバックで一日一通を絶やさない。再配達・シードであることは
  レスポンス・UI・通知のいずれにも表出させない。
- **安全設計**: 新規投稿は `pending` デフォルトで、approveされるまで配達プールに乗らない。
  rejectは投稿者に通知せず、本人のアルバムからも奪わない。
- **運用指標**: 日次供給/需要比は `/api/sleeping-delivery/diagnostics` と下記の
  週次プールヘルスチェックで観測する。
- **人質回避**（損失煽り・引き止めの禁止）は `AGENTS.md`「Product principles」が正。
- 審査者向けの要約は `docs/MODERATION-CANON.md` §4.5。配達順序の実装詳細の正は
  `docs/specs/spec-v1.3.md` §3。

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

## Cron time zone note

Vercel cron schedules are written in UTC. The handoff cleanup schedule in
`vercel.json` is intentionally kept as `30 18 * * *`, which runs at JST 03:30.
This is the intended late-night garbage-collection window for expired or
redeemed onboarding handoffs.

# Incident: 2026-07-04 bulk delete investigation

作成日: 2026-07-05  
対象: Supabase production project `nyaruhodo-mvp-test` / ref `fwqhpjumerbqufqgmibu`  
調査範囲: 読み取りのみ。DBに対する `DELETE` / `UPDATE` / `INSERT` / DDL は実行していない。

## 要約

2026-07-04 に production の `cat_moments` から 1337 件が一括削除された。削除はリポジトリ内の migration / API / cleanup script ではなく、Supabase linked production DB に対する直接SQL実行だった可能性が最も高い。

削除条件として記録できるものは以下。

```sql
delete from cat_moments
where moderation_status = 'pending'
  and visibility = 'shared'
  and delivery_status = 'available'
  and (
    anonymous_id like 'rate-limit-%'
    or anonymous_id like 'guard-%'
    or anonymous_id like 'probe-%'
    or photo_url like 'data:image/%'
  );
```

事前確認として、対象 1337 件は `data:image/%` が主で、`probe-%` 系が 3 件含まれていた。`rate-limit-%` / `guard-%` 系は、上記の分類では `data:image/%` 側にも該当していたため、重複条件の中に含まれる。

## 事実経過

| 時刻/時期 | 事実 |
| --- | --- |
| 2026-06-05〜2026-06-11 | 過去配達履歴に、非approvedの可能性がある `cat_moment_deliveries` が存在していた。直近のmigration調査docでは `pending delivered 16件` と記録されている。 |
| 2026-07-04 | production migration未適用を確認し、S1/S3/S4関連migrationを `supabase db push --linked` で適用した。 |
| 2026-07-04 | pending旧データの整理として、上記条件で `cat_moments` 1337 件を直接削除した。レビュー側の事前合意工程である「管理キューで12件を目視して approve/reject」とは異なる運用だった。 |
| 2026-07-04 後続 | 管理キューの重複表示/重複判定問題が見つかり、`f96b0ad` と `e1d057c` で管理UIと重複moment判定を修正した。 |
| 2026-07-05 調査時点 | `pending/shared/available` は0件。現在の pending 104件は private または hidden で、通常の管理キュー対象ではない。 |

## 削除の実体

| 項目 | 調査結果 |
| --- | --- |
| 対象テーブル | `cat_moments` |
| 削除件数 | 1337件 |
| 経路 | production DBへの直接SQL実行と推定。repo内のmigration/API/cleanup scriptには、この1337件削除に一致する処理は見つからなかった。 |
| 削除条件 | `moderation_status='pending'` + `visibility='shared'` + `delivery_status='available'` + `anonymous_id` が probe/guard/rate-limit 系、または `photo_url like 'data:image/%'` |
| `cat_moment_deliveries` の同時削除 | 実施していない |
| Storage object の同時削除 | 実施していない |

### リポジトリ検索結果

確認コマンド:

```bash
rg -n 'delete from cat_moments|cat_moments.*delete|cleanup|bulk delete|moderation cleanup|pending旧|1337' src supabase scripts docs tests
git log --all -p --since="2026-07-03" -S "delete from cat_moments" -- src supabase scripts docs tests
```

結果:

- `supabase/migrations/20260602093000_create_cat_moment_tables.sql` に通常の own delete policy は存在する。
- E2E cleanup や account deletion cleanup の通常処理は存在する。
- 1337件のproduction pending旧データ削除に一致する migration / API route / cleanup script / commit diff は見つからなかった。

## 目視工程の有無

今回の 1337件削除について、削除前に対象写真を管理キューで1件ずつ目視した成果物・記録は確認できていない。

削除条件からは、対象の大半が `data:image/%` の旧・テスト系レコードで、production Storage上の実画像ではない可能性が高い。ただし、目視工程が省略されたこと自体は運用上の問題として記録する。

## 副作用調査

### 現在の `cat_moments` 全量

```sql
select moderation_status, count(*) from cat_moments group by 1;
```

| moderation_status | count |
| --- | ---: |
| approved | 66 |
| pending | 104 |
| rejected | 25 |

詳細:

| moderation_status | visibility | delivery_status | count |
| --- | --- | --- | ---: |
| pending | private | available | 97 |
| approved | shared | available | 64 |
| rejected | shared | hidden | 25 |
| pending | shared | hidden | 7 |
| approved | shared | hidden | 2 |

### 現在の `cat_moment_deliveries` 全量

```sql
select status, count(*) from cat_moment_deliveries group by 1;
```

| status | count |
| --- | ---: |
| delivered | 158 |
| kept | 12 |
| hidden | 6 |

### delivery参照の照合

`cat_moment_deliveries.source_moment_id` は旧データでは `cat_moments.id`、現行経路では `local_moment_id` を指す可能性があるため、両方で照合した。

```sql
select
  count(*) filter (where m_local.id is not null) as matched_local_moment_id,
  count(*) filter (where m_id.id is not null) as matched_uuid_id,
  count(*) filter (where m_local.id is null and m_id.id is null) as unmatched_either,
  count(*) as total_with_source
from cat_moment_deliveries d
left join cat_moments m_local on m_local.local_moment_id = d.source_moment_id
left join cat_moments m_id on m_id.id::text = d.source_moment_id
where d.source_moment_id is not null;
```

| matched_local_moment_id | matched_uuid_id | unmatched_either | total_with_source |
| ---: | ---: | ---: | ---: |
| 0 | 127 | 31 | 158 |

31件は現時点で `cat_moments.local_moment_id` / `cat_moments.id` のどちらにも照合できない。これらはすべて `delivered` で、時期は 2026-06-05〜2026-06-11 に集中している。

この31件が今回の1337件削除で発生したものか、2026-06-05〜2026-06-11の旧配達事故時点ですでに参照切れだったものかは、現在のDBだけでは断定できない。前回記録にあった `pending delivered 16件` と時期が一致するため、同じ旧履歴群に属する可能性が高い。

### 非approved配達の現在値

現存する `cat_moments.id` と照合できる範囲では、非approved配達は0件。

```sql
select count(*) as delivered_from_nonapproved
from cat_moment_deliveries d
join cat_moments m on m.id::text = d.source_moment_id
where m.moderation_status is distinct from 'approved';
```

| delivered_from_nonapproved |
| ---: |
| 0 |

### data URL / probe 系の現在値

```sql
select moderation_status, visibility, delivery_status, count(*)
from cat_moments
where photo_url like 'data:image/%'
group by 1,2,3;
```

| moderation_status | visibility | delivery_status | count |
| --- | --- | --- | ---: |
| pending | private | available | 81 |
| rejected | shared | hidden | 19 |
| pending | shared | hidden | 6 |
| approved | shared | available | 2 |
| approved | shared | hidden | 2 |

```sql
select count(*) as probe_or_guard_or_rate_moments
from cat_moments
where anonymous_id like 'rate-limit-%'
   or anonymous_id like 'guard-%'
   or anonymous_id like 'probe-%';
```

| probe_or_guard_or_rate_moments |
| ---: |
| 0 |

### Storage object

```sql
select bucket_id, count(*) as object_count,
       sum(coalesce(nullif(metadata->>'size','')::bigint,0)) as total_bytes
from storage.objects
group by bucket_id;
```

| bucket_id | object_count | total_bytes |
| --- | ---: | ---: |
| cat-photos | 175 | 67161155 |

Storage上には `probe` 系オブジェクトが3件残っている。現行 `cat_moments` / `cat_moment_deliveries` からは参照されていない。

| name | size | created_at |
| --- | ---: | --- |
| `probe-auth-anon-1781185100892/probe-cat/sleeping/probe-auth-1781185100892.jpg` | 516 | 2026-06-11 13:38:22.896797+00 |
| `probe-1781184420728/probe-cat/sleeping/probe-storage-1781184420727.jpg` | 516 | 2026-06-11 13:27:02.397782+00 |
| `probe-1781183182300/probe-cat/sleeping/probe-1781183182300.jpg` | 516 | 2026-06-11 13:06:23.932999+00 |

既知参照（`cat_moments.photo_url` / `cat_moment_deliveries.photo_url` / `collection_photos.storage_path` / `cats.avatar_storage_path` / `cats.home_photo_storage_path`）に照合できないStorage objectは105件、約55.2MB。ただしこれは今回の1337件削除だけで説明できる範囲ではなく、過去の写真保存・代表写真・とっておき移行・テスト投入などの履歴も含む可能性があるため、今回由来とは断定しない。

## 復元可能性

```bash
npx supabase backups list --project-ref fwqhpjumerbqufqgmibu -o json
```

結果:

- PITR: `false`
- latest physical backup: `2026-07-03T23:24:37.932Z`
- older completed physical backups: 2026-07-02〜2026-06-27

PITRが無効のため、削除直前の時点にピンポイント復元することはできない。2026-07-03 23:24 UTC の物理バックアップから別環境へ復元し、必要行だけ抽出して比較・再投入する可能性はある。ただし本番DB全体をその時点へ戻すと、2026-07-04以降の正当な変更も巻き戻るため、そのままの本番ロールバックは推奨しない。

復元可能期限はSupabase側の物理バックアップ保持期間に依存する。2026-07-05調査時点では、2026-06-27以降の物理バックアップが一覧に存在している。

## 結論

削除された1337件は、`cat_moments` の旧pending共有候補データで、条件上は主にdata URL旧データとprobe系テストデータだった。実行経路はDB直叩きSQLであり、レビュー側が想定していた「管理キューで12件を目視してapprove/reject」工程とは異なる。

現時点で通常の未審査キュー `pending/shared/available` は0件。現存する配達履歴について、現存momentと照合できる範囲の非approved配達は0件。一方、2026-06-05〜2026-06-11の旧配達履歴31件はsource momentと照合できず、今回の削除由来か旧事故由来かは現在DBだけでは断定できない。

## 再発防止

- 本番データの削除・大量更新は、実行前に必ず以下を報告し、承認を得てから実行する。
  - 対象テーブル
  - WHERE句
  - 事前 `select count(*)`
  - サンプル数件
  - 副作用確認クエリ
  - バックアップ/PITR状態
- 目視判断が必要な写真は、SQL削除ではなく管理キューでapprove/rejectする。
- SQLでの削除が必要な場合も、まずread-only reportを作り、レビュー後に別タスクで実行する。
- 孤児レコード・孤児Storage objectが見つかっても、同じ調査タスク内で削除しない。

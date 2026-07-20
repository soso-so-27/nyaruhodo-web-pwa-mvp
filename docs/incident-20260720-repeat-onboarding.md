# Incident: completed onboarding reopened on later visits

作成日: 2026-07-20

対象: Supabase production project `nyaruhodo-mvp-test` / ref `fwqhpjumerbqufqgmibu`

実行者/経路: Codex / Supabase CLI linked Management API

## 要約

完了済みユーザーが別日にSNSのオンボURLを開くと、オンボをもう一度開始できた。
その結果、同じ匿名識別IDから複数のオンボ写真が `cat_moments` に登録される事象を2件確認した。

原因は次の複合だった。

- 完了済みの再入場防止が `direct` / `referral` に限定され、Instagram系流入には適用されていなかった。
- 完了証跡の確認が当日分のprogressだけを読み、過去日の `opened` / `album_created` を見失っていた。
- 写真選択直前とexchange APIに、完了済みユーザーを止める独立した防御がなかった。

## 影響

- 影響した識別ID: 2 ID
- 追加登録された重複moment: 2行
- 重複momentから成立した配達: 0件
- Storage objectの削除・変更: 0件
- 元のオンボ写真・配達履歴の変更: 0件

対象行:

| id                                     | local_moment_id                                                   | 変更前                 |
| -------------------------------------- | ----------------------------------------------------------------- | ---------------------- |
| `bb7898c3-b3fa-4bee-9b36-ad780049806a` | `onboarding-c34bb1f3-d1c4-4fdb-a950-478dc6a03390-2026-07-19`      | `approved / available` |
| `e2e3f2a5-3072-4809-aee7-07cd20e0c5c2` | `onboarding-onbj_16c96d66-584a-4d2b-a398-11724a43eddf-2026-07-20` | `pending / available`  |

## 本番補正

実行時刻: 2026-07-20 23:46 JST

事前に対象ID・local moment ID・状態が完全一致すること、および
`cat_moment_deliveries.source_photo_id` に一致する配達が0件であることを確認した。

2行を同一トランザクションで次の状態へ変更した。

- `moderation_status = 'rejected'`
- `delivery_status = 'hidden'`
- `moderated_by = 'codex-p0-20260720'`
- `metadata.hidden_reason = 'duplicate_onboarding_completion'`
- metadataに変更前のmoderation / delivery statusを保存

各UPDATEは、ID・local moment ID・変更前状態・配達参照なしをWHERE条件に含めた。
どちらかの更新件数が1件でなければ例外で全体をロールバックする形で実行した。

事後確認では2行とも `rejected / hidden`、配達参照0件だった。

## 復元可能性

写真行とStorage objectは削除していない。metadataに保存した変更前状態を使い、
必要なら対象ID単位で `approved / available` または `pending / available` へ戻せる。

## 再発防止

1. UI初期表示時に、流入元を問わず過去日の完了証跡を確認してホームへ送る。
2. 写真pickerを開く直前にも完了状態を再確認する。
3. ブラウザ引継ぎ先が完了済みならオンボへ戻さずホームへ送る。
4. exchange APIで、同じuser IDまたはanonymous IDに過去の配達がある新しいオンボjourneyを409で拒否する。
5. 同じjourneyの冪等リプレイは従来どおり許可する。
6. 過去日完了・遅延復元・引継ぎ・サーバ拒否の回帰テストを追加する。

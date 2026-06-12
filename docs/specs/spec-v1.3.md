# ねてるねこ 実装仕様 spec v1.3.1

最終更新:2026-06-13
対象リポジトリ:`web-pwa-mvp-agents-md-docs`
参照資料:`docs/STATUS_REPORT.md`(2026-06-12)、`docs/2026-06-11-delivery-incident-postmortem.md`、事業方針 v2.0(§9 配達保証/§17 安全設計/§18 法務)

> **運用メモ:本仕様ファイルは `docs/specs/spec-v1.3.md` としてリポジトリにコミットすること。** 以後の仕様はすべて `docs/specs/` に置き、レポート作成時に参照可能にする。

---

# 0. 背景と目的

STATUS_REPORT により、事業方針の根幹である「20時配達」「配達前モデレーション」「配達プールの公平性」が実装上担保されていないことが確認された。本仕様は以下4点を実装し、公開ローンチの最低条件を満たすことを目的とする。

| # | 項目 | 種別 |
|---|------|------|
| ① | exchange API のサーバー時刻検証 | ローンチブロッカー |
| ② | 事前承認モデレーション(pending→approved) | ローンチブロッカー |
| ③ | 配達プール優先順位の方針§9準拠化+重複配達防止 | ローンチブロッカー |
| ④ | オンボーディング末尾:郵便受け(PWA)+ひかえ(同期)誘導 | フェーズ1改善 |

## 非スコープ(本仕様では実装しない)

- Service Worker / Push通知(方針上の意思決定待ち。現行の「開けたら届いている郵便受け」モデルを維持)
- AI画像フィルタ(②の人力承認制を先行。AIは後続バージョン)
- localStorage主保存からの脱却の本対応(④の同期誘導は緩和策であり、本対応はフェーズ3前に別仕様)
- 翌朝5時の自動開封ロジックの変更(現行維持)

## 実装順序

① → ② → ③ → ④ の順に実装し、各段階でテストを通すこと。①〜③はサーバー/DBの整合が連鎖するため順序を守る。

---

# 1. ① exchange API のサーバー時刻検証

## 1.1 現状の問題

`POST /api/sleeping-delivery/exchange` はクライアント申告の `deliveryDateKey` をそのまま受け入れ、サーバー時刻での検証がない(`src/app/api/sleeping-delivery/exchange/route.ts`)。端末時計を進めると20時前に配達を引き出せる。

## 1.2 要件

サーバー側で JST 現在時刻を取得し、以下をすべて検証する。検証はルートハンドラ冒頭、冪等キー処理より前に行う。

1. **形式検証**:`deliveryDateKey` は `YYYY-MM-DD` 形式。不正は `400`
2. **未来日の拒否**:`deliveryDateKey` > サーバーJST今日 は拒否
3. **当日20時の強制**:`deliveryDateKey` == サーバーJST今日 の場合、サーバーJST時刻が **19:55:00 以降**であること(端末時計の軽微なずれへの許容として5分のトレランスを持つ)。それ以前は拒否
4. **過去日の許容範囲**:`deliveryDateKey` < 今日 は **7日以内**のみ許容(取りこぼし救済・legacy救済の既存挙動を維持)。それより古い場合は拒否
5. **オンボーディング即時交換の例外**:リクエストに `mode: "onboarding"` が含まれる場合、上記3を免除する。ただし免除条件として、**当該 identity(user_id または anonymous_id)に `cat_moment_deliveries` の既存行が0件であること**をサーバーで確認する。1件でもあれば通常検証にフォールバックする(例外の悪用防止)

## 1.3 拒否時のレスポンス

- HTTP `422`、ボディ `{ error: "delivery_not_yet", serverDateKey: "YYYY-MM-DD" }`
- 過去日範囲外は `{ error: "delivery_window_expired" }`
- クライアント(`src/lib/home/useEveningDelivery.ts`)は `delivery_not_yet` を受けた場合、**エラーUIを出さず待機状態を維持**する(`pendingEveningDeliveryKeysRef` を解除し、次回evaluate時に再試行)。`delivery_window_expired` は当該dateKeyの追跡を終了する

## 1.4 JST算出の実装注意

- サーバーの `Date` から UTC+9 固定オフセットで算出してよい(JSTに夏時間なし)。既存の `getJstDateKey()` 相当のロジックをサーバー側ユーティリティとして `src/lib/home/eveningDelivery.ts` から分離するか、サーバー専用に新設すること(クライアントバンドルへの混入を避ける)

---

# 2. ② 事前承認モデレーション

## 2.1 方針(事業方針§17準拠)

- 新規投稿写真は承認されるまで配達プールに乗らない(**pending デフォルト**)
- 承認は管理パネルから人力で行う(19時モデレーションバッチの人力版。**ユーザーには一切見せない内部運用**)
- 却下された写真について、**投稿者への通知・表示変更は行わない**。投稿者自身の端末アルバムには従来どおり残る(本人の記録は奪わない)。単に配達プールから除外されるのみ

## 2.2 マイグレーション

`cat_moments` に以下を追加:

```sql
alter table cat_moments
  add column moderation_status text not null default 'pending'
    check (moderation_status in ('pending','approved','rejected')),
  add column moderated_at timestamptz null,
  add column moderated_by text null;
create index idx_cat_moments_moderation on cat_moments (moderation_status, delivery_status, visibility);
```

**バックフィル(同マイグレーション内):**

- `local_moment_id like 'stock-sleeping-%'`(admin stock)→ `approved`
- それ以外の既存行 → `pending` のまま(=既存ユーザー投稿は一度プールから外れる。ローンチ前に管理パネルから一括レビューする運用とする。③のTier3により配達自体は途切れない)

## 2.3 候補選定への組み込み

exchange の候補条件に `moderation_status = 'approved'` を追加する(③のクエリに統合)。診断API(`/api/sleeping-delivery/diagnostics`)にも moderation_status 別の件数を追加すること。

## 2.4 管理パネル(モデレーションキュー)

設定画面の管理パネル(`src/components/settings/SettingsPage.tsx`、`ADMIN_EMAILS` ゲート)に追加:

- **API**:
  - `GET /api/moderation/queue`:`moderation_status='pending'` の `cat_moments` を `created_at` 昇順で最大50件。写真は署名URLまたはdata URLで返す。admin clientで実行、管理者ゲート必須
  - `POST /api/moderation/decide`:`{ momentId, decision: 'approved' | 'rejected' }`。`moderated_at`/`moderated_by`(管理者email)を記録。`rejected` の場合は `delivery_status='hidden'` も同時に設定
- **UI**:写真サムネイル+承認/却下の2ボタンの簡素なリスト。1件ずつでよい(一括は不要)。pending件数バッジを管理パネル見出しに表示
- 既存の通報一覧(`GET /api/reports`)と同一セクションにまとめてよい

## 2.5 通報との関係

既存挙動(2件通報で `delivery_status='reported'`)は維持。承認済み写真が通報された場合も従来どおりプールから外れる。

---

# 3. ③ 配達プール優先順位・重複配達防止

## 3.1 方針(事業方針§9準拠)

候補選定の優先順位を以下の3段にする。現行の `admin_storage` fast path デフォルト(6/11事故の応急対応)を置き換える。

| Tier | 内容 | 定義 |
|------|------|------|
| 1 | 当日の便り | 一般ユーザー投稿のうち `pool_date` = 配達対象日 |
| 2 | 再配達 | 一般ユーザー投稿のうち過去の `pool_date`(受取人に未配達のもの) |
| 3 | 運営シード | admin stock(`local_moment_id like 'stock-sleeping-%'`) |

再配達・シードであることはレスポンス・UI・通知のいずれにも表出させない(方針§9-3)。

## 3.2 マイグレーション:`pool_date` 生成列

「20時以降に撮った写真は翌日分」という境界をサーバー側で確定するため、JSTに+4時間シフトした日付を生成列で持つ(19:59 JST→当日、20:00 JST→翌日):

```sql
alter table cat_moments
  add column pool_date date generated always as
    (((created_at at time zone 'UTC') + interval '13 hours')::date) stored;
create index idx_cat_moments_pool on cat_moments (pool_date, moderation_status, delivery_status, visibility);
```

※ 生成列の式はSupabase/Postgresで実際に適用できるか確認すること。通らない場合は、**BEFORE INSERT トリガーで通常カラム `pool_date date not null` を設定する方式**へフォールバックする。API/アプリ側でのinsert時設定は、`cat_moments` がクライアントからRLS経由で直接insertされるため不採用。どちらの方式でも、マイグレーション適用後にSQLレベルで境界テスト(19:59 JST→当日 / 20:00 JST→翌日)を検証する。

**配信負荷分散用カラム:**

```sql
alter table cat_moments add column delivery_count integer not null default 0;
```

配達確定時にインクリメントする(exchange route内、配達記録作成と同時)。

## 3.3 重複配達防止

**同一の受取人に、同一の `source_moment_id` を二度配達しない。**

- exchange はサーバー側で、受取人identity(user_id または anonymous_id)の `cat_moment_deliveries` から配達済み `source_moment_id` 一覧を取得し、候補から除外する
- インデックス追加:

```sql
create index idx_deliveries_user_source on cat_moment_deliveries (user_id, source_moment_id) where user_id is not null;
create index idx_deliveries_anon_source on cat_moment_deliveries (anonymous_id, source_moment_id) where anonymous_id is not null;
```

- 既存のクライアント側 `blockedPhotoIds` 除外は維持(防御の二重化)

## 3.4 候補選定クエリ

候補選定は2クエリ方式で実装する。まず受取人の配達済み `source_moment_id` 一覧を1クエリで取得し、その後の候補選定クエリで除外する。既存の冪等キー読み取りと統合可能なら統合してよい。単一クエリ案は不採用。

- 条件:`visibility='shared'` AND `delivery_status='available'` AND `moderation_status='approved'` AND 既存の除外(自分自身・同一identity・同一受取猫・blocked・pool guard)AND 重複配達除外(3.3)
- 並び:`tier ASC, delivery_count ASC, random()`
  - `tier` は `CASE WHEN local_moment_id like 'stock-sleeping-%' THEN 3 WHEN pool_date = :targetDate THEN 1 ELSE 2 END`
- 上位1件を配達

Storage参照候補(一般ユーザーのstorage ref写真)の安全な解決は、`docs/2026-06-11-delivery-incident-postmortem.md` に提示済みの公平復帰設計に従って実装すること。署名URL解決の失敗時は当該候補をスキップして次点に進む(配達全体を失敗させない)。

## 3.5 fast path 環境変数の扱い

- `SLEEPING_DELIVERY_FAST_CANDIDATES` のデフォルト挙動を本仕様のTier型クエリに変更する
- 値 `admin_storage` は**緊急ロールバック用**として残す(挙動は現行どおり)。コードコメントに「6/11事故対応の退避モード。通常運用では未設定」と明記
- `tests/e2e/sleeping-delivery-pool-guards.spec.ts` の latency budget テストは新クエリに対して維持・通過させること

## 3.6 診断APIの拡張

`/api/sleeping-delivery/diagnostics` に Tier別候補件数(tier1/tier2/tier3)、重複除外件数、moderation_status別件数を追加する。運用指標「日次供給/需要比」(方針§16)の観測に使う。

---

# 4. ④ オンボーディング末尾:郵便受け+ひかえ誘導

## 4.1 方針

オンボーディングの `kept`(完了)状態の後に、スキップ可能な2ステップを追加する。どちらも**強制しない・ブロックしない・急かさない**。完了パネルの世界観(静かな締め)を壊さないこと。

ステップ順:**(A) 郵便受けを置く(PWA)→ (B) ひかえをとる(同期)→ 完了**

## 4.2 ステップA:郵便受けを置く(PWAインストール)

**表示条件:**

- すでにstandalone表示(`display-mode: standalone`、既存の `pwa_display_mode_detected` 判定を流用)の場合は**ステップごとスキップ**
- それ以外は表示

**挙動(プラットフォーム分岐):**

- `beforeinstallprompt` が捕捉済み(Android/Chrome系):ボタンタップでネイティブインストールプロンプトを発火。ホーム側の既存捕捉ロジック(`src/components/home/HomeInput.tsx`)をオンボーディングからも利用できるよう、イベント捕捉を共有モジュールに分離する
- iOS Safari:インストール手順シートを表示(共有ボタン →「ホーム画面に追加」)。図解は静的でよい
- 上記いずれも不可(対応外ブラウザ):ステップごとスキップ

**確定コピー:**

- タイトル:`ゆうびんうけを おく`
- 本文:`ホームがめんに ねてるねこを おいておくと、よる8じの おてがみを うけとりやすくなります`
- 実行ボタン:`ゆうびんうけを おく`
- スキップ:`あとで`
- iOS手順シート見出し:`ゆうびんうけの おきかた`
- iOS手順本文:`したの 共有ボタンから「ホーム画面に追加」を えらんでください`

**ホーム側ヒントとの整理:**

- オンボーディングでインストール完了、またはstandalone検出済みの場合、ホーム側のinstall hintは表示しない
- 「あとで」を選んだ場合、ホーム側hintは従来どおり表示してよい(localStorageフラグ `neteruneko_onboarding_mailbox_skipped` を記録だけしておく)

## 4.3 ステップB:ひかえをとる(アカウント同期誘導)

**表示条件:**

- 既にログイン済み(Supabaseセッションあり)の場合はスキップ
- 未ログインの場合に表示

**挙動:**

- 実行ボタンで既存のGoogleログイン導線(`/account/create` 相当のフロー)へ。**オンボーディングのコンテキストを失わないよう、ログイン完了後はオンボーディング完了画面(またはホーム)へ戻す**
- ログイン完了時、既存のアカウント同期(account sync)を自動実行する(既存 `settings_account_sync_*` 相当の処理を呼ぶ。失敗してもオンボーディングは完了させ、エラーは静かにリトライキューへ)
- スキップ可能。スキップしてもいかなる機能制限も警告も出さない

**確定コピー:**

- タイトル:`ねがおの ひかえを とる`
- 本文:`Googleで ログインしておくと、ねがおの ひかえが のこります。けいたいを かえても、だいじょうぶ`
- 実行ボタン:`ログインして ひかえを とる`
- スキップ:`あとで`

**禁止事項(方針§10 人質回避原則):**

- 「消えてしまいます」「失われます」等の損失煽り文言は使わない。上記確定コピーから変更しないこと
- スキップ時の引き止めダイアログを出さない

## 4.4 状態機械への追加

`OnboardingFlow.tsx` の状態機械に `mailbox` / `backup` 状態を追加(`kept` → `mailbox` → `backup` → 完了)。スキップ条件成立時は当該状態を生成しない。既存のE2E(`onboarding-delivery-flow.spec.ts`)が壊れないよう、既存ステップのIDは変更しない。

---

# 5. 計測イベント(追加)

| イベント名 | 発火タイミング |
|---|---|
| `exchange_rejected_not_yet` | ①でサーバーが422 `delivery_not_yet` を返した(サーバー側でなくクライアント受信時に記録) |
| `moderation_decided` | ②で管理者が承認/却下した(properties: decision)※管理操作のため任意 |
| `delivery_tier_served` | 配達確定時、properties に tier(1/2/3)を記録(クライアント受信時、exchangeレスポンスにtierを含めて返す。**UIには表出させない**) |
| `onboarding_mailbox_shown` / `onboarding_mailbox_installed` / `onboarding_mailbox_skipped` | ④ステップA |
| `onboarding_backup_shown` / `onboarding_backup_started` / `onboarding_backup_completed` / `onboarding_backup_skipped` | ④ステップB |

既存イベントの変更・削除はなし。

---

# 6. マイグレーション一覧(適用順)

1. `cat_moments`: `moderation_status` / `moderated_at` / `moderated_by` 追加+バックフィル(§2.2)
2. `cat_moments`: `pool_date` 生成列+`delivery_count` 追加(§3.2)
3. `cat_moment_deliveries`: 重複防止インデックス2本(§3.3)

---

# 7. テスト要件

## ①

- サーバーJST 19:54 で当日dateKeyのexchange → 422 `delivery_not_yet`
- サーバーJST 19:55 / 20:00 で当日dateKey → 成功
- 未来dateKey → 拒否。8日前のdateKey → `delivery_window_expired`。7日前 → 成功
- `mode:"onboarding"` + 配達履歴0件 → 20時前でも成功。配達履歴1件以上 → 通常検証で拒否
- クライアントが `delivery_not_yet` を受けて待機継続し、エラーUIを出さないこと

## ②

- `pending` 写真が候補に選ばれないこと
- 承認 → 候補に入る。却下 → `delivery_status='hidden'` になり候補に入らない
- 管理者以外が moderation API にアクセス → 403(既存guard形式に準拠)
- バックフィル後、admin stockのみ `approved` であること

## ③

- Tier1候補がある日:一般ユーザー当日写真が admin stock より優先されること
- Tier1が空:Tier2(過去の一般ユーザー写真)が選ばれること
- Tier1/2が空:Tier3(admin stock)が選ばれること
- 同一受取人に同一 `source_moment_id` が二度配達されないこと(2回目のexchangeで別写真または `photo:null`)
- 19:59 JST投稿の `pool_date` が当日、20:00 JST投稿が翌日になること
- latency budgetテストの通過(既存基準を維持)

## ④

- standalone時:mailbox/backupいずれも条件次第でスキップされ、既存完了フローが変わらないこと
- `beforeinstallprompt` 捕捉時にプロンプト発火、未捕捉iOS UAで手順シート表示
- ログイン済みセッションで backup ステップが出ないこと
- 両ステップとも「あとで」で完了に到達できること
- 既存 `onboarding-delivery-flow.spec.ts` の全テストが引き続き通ること

---

# 8. ロールアウト手順

1. マイグレーション1〜3を適用(この時点でpendingバックフィルにより一般ユーザー候補が一時的にプールから外れるが、Tier3=admin stockで配達は継続する)
2. ①〜③をデプロイ
3. 管理パネルから既存pending写真を一括レビュー(人力)
4. 診断APIでTier別件数・重複除外の動作を確認
5. ④をデプロイ
6. `docs/STATUS_REPORT.md` の該当節(§3, §4, §5オンボーディング)を更新

---

# 9. 廃止・変更まとめ

- **変更**:`SLEEPING_DELIVERY_FAST_CANDIDATES` 未設定時のデフォルトが `admin_storage` → Tier型クエリに変更(§3.5)
- **変更**:exchange APIがサーバー時刻検証を行うようになる(①)。`deliveryDateKey` の信頼をクライアントからサーバーへ移管
- **追加**:`mode` フィールド(exchange payload)。未指定時は通常モード
- **廃止なし**:既存イベント・既存テーブル・既存ルートの削除はなし

---

# 10. Codexへの確認依頼事項(実装前に回答すること)

1. `pool_date` 生成列の式は本仕様§3.2で確定済み。Supabase/Postgresで生成列として通らない場合は、BEFORE INSERT トリガー方式へフォールバックする。
2. 重複配達除外は本仕様§3.4で2クエリ方式に確定済み。latency budget テストは維持する。
3. オンボーディング即時交換(`mode:"onboarding"`)の現在の呼び出し箇所は、`createSleepingExchange()` が送信直前に `getOrCreateAnonymousId()` を呼ぶため、anonymous_id未生成のままexchangeが呼ばれる通常ケースはない。追加対応不要。
4. 既存pending化バックフィル対象の一般ユーザー投稿件数は人間側でSQL実行する。実装はこれをブロックしない。

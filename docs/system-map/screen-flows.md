# screen-flows.md — システム地図 成果物5（画面遷移図）

> 出典はコードのみ（辺=リンク・router.push/replace・redirect・window.location）。全て `ファイル:行` 付き。
> 作成: 2026-07-07 / 最終更新: 2026-07-25（送信候補の管理を「うちのこ」写真詳細へ統合）。
> 図1=俯瞰、図2=オンボーディング詳細、図3=ホーム状態機械、図4=課金・退会。

---

## 1. 全画面遷移図（俯瞰）

凡例: 🟨=孤立（内部リンクからの入次数0。外部URL/SW/API経由でのみ到達）／🟥=行き止まり（画面内に他画面への遷移が無い）

```mermaid
flowchart TD
  classDef isolated fill:#fdf3d0,stroke:#b8962e
  classDef deadend fill:#fbdcd6,stroke:#a8584e
  classDef redirect fill:#eee,stroke:#999,stroke-dasharray:3

  ROOT["/ (＝homeと同内容)"] --- HOME["/home"]
  HOME <--> COLLECTION["/collection"]
  HOME <--> CATS["/cats"]
  COLLECTION <--> CATS
  HOME --> SETTINGS["/settings"]
  SETTINGS --> HOME
  SETTINGS --> ACCT["/account/create"]
  SETTINGS --> DELINFO["/account-deletion"]
  SETTINGS --> ADMIN_A["/admin/analytics"]
  SETTINGS --> OB_TEST["/onboarding?test=1"]
  SETTINGS --> HTU["/how-to-use"] --> SETTINGS
  SETTINGS --> LEGAL["/terms /privacy /commercial-transactions /contact /cancellation"]
  LEGAL --> SETTINGS
  DELINFO --> SETTINGS
  DELINFO --> CATS
  SETTINGS --> BETA["/beta-supporter"]
  BETA --> SETTINGS
  BETA --> LEGAL
  ADMIN_A <--> ADMIN_P["/admin/animation-preview"]
  ADMIN_P --> SETTINGS

  OB["/onboarding 🟨(通常導線は外部リンクのみ)"]:::isolated
  OB --> HOME
  OB --> SETTINGS
  OB --> ACCT
  ACCT --> HOME
  ACCT --> CATS
  ACCT -. "Google OAuth" .-> CB["/auth/callback"]
  CB --> HOME
  CB --> ACCT
  ACCT -. "handoff URL(API発行)" .-> OBC["/onboarding/continue 🟨"]:::isolated
  OBC --> HOME
  HOME -. "認証エラー" .-> ACCT

  NF["not-found"] --> HOME
  OFFLINE["/offline 🟨🟥 (SW fallbackのみ・リンク0)"]:::deadend
  PROTO["/prototypes/taimen 🟨🟥 (本番404・戻るリンク0)"]:::deadend
  LEGACY_SENT["/collection?manage=sent 🟨<br/>送信写真管理の互換URL"]:::isolated --> COLLECTION

  T["/together"]:::redirect --> COLLECTION
  TS["/torisetu"]:::redirect --> CATS
  DG["/diagnose"]:::redirect --> HOME
  DGO["/diagnosis-onboarding"]:::redirect --> CATS
```

### 辺の出典（主要なもの）

| 辺 | 出典 |
|---|---|
| home⇄collection⇄cats（下部ナビ3タブ） | `src/components/navigation/BottomNavigation.tsx:40-58` |
| home→settings | `src/components/home/HomeDeskModel.tsx:456` |
| home→cats / home→collection（stow後遷移） | `src/components/home/HomeInput.tsx:1729,1733` |
| home→/account/create?error=auth（認証エラー） | `HomeInput.tsx:573,599` |
| collection→cats / collection→home | `src/components/collection/CollectionPage.tsx:1309,1803` |
| cats→home | `src/components/cats/CatsPage.tsx:1317` |
| settings→各先（home/account/削除案内/admin/onboarding?test=1/how-to-use/法務5種/beta-supporter） | `SettingsPage.tsx:624,752,763,957,975,1069,1074,1079,1084,1089,1094,1147` |
| beta-supporter→settings・法務 | `beta-supporter/page.tsx:175,317-329` |
| 法務各ページ→settings（戻る） | `LegalPage.tsx:415` |
| how-to-use→settings | `how-to-use/page.tsx:8` |
| admin/analytics⇄animation-preview、preview→settings | `AdminAnalyticsClient.tsx:113`, `AdminAnimationPreviewClient.tsx:116,179` |
| onboarding→home（完了・保存しない・再開） | `src/components/onboarding/OnboardingFlow.tsx` |
| onboarding→settings（test tools時のみ） | `OnboardingFlow.tsx:1268` |
| account-deletion→cats（写真ごとの設定・削除） | `src/components/legal/LegalPage.tsx` |
| catsのねがお写真詳細→送信候補ON/OFF（画面内操作） | `CatsPage.tsx:handlePhotoSharingChange`, `PhotoFullscreenViewer` |
| 旧送信写真管理URL（通常導線なし） | `/collection?manage=sent`, `/collection?manage=sent&from=settings` |
| account/create→home / →cats?onboarding=1 | `account/create/page.tsx:573,635,625` |
| auth/callback→next(既定/home)+auth=google_success / →account/create?error=auth | `auth/callback/page.tsx:89-91,46,54,76,141,162-178` |
| onboarding/continue→/home?handoff=restored | `onboarding/continue/page.tsx:104-108` |
| handoff URL発行（→/onboarding/continue） | `api/onboarding/handoff/create/route.ts:92` |
| not-found→home | `src/app/not-found.tsx:17` |
| 旧4リダイレクト | `together/page.tsx:3`, `torisetu/page.tsx:3`, `diagnose/page.tsx:3`, `diagnosis-onboarding/page.tsx:3` |
| /（root）→新規はonboarding、完了・既存データありはhome | `src/app/page.tsx`, `src/app/EntryRouter.tsx` |

### 孤立・行き止まりの判定根拠

- **/offline**: ページ内にリンク・ボタン遷移なし（`offline/page.tsx` に href/router 0件）。到達はSWの
  オフラインfallbackのみ（`public/sw.js:4` `OFFLINE_URL`）。→ 🟨🟥
- **/prototypes/taimen**: 内部リンク0件・戻るリンクなし・本番は404（`prototypes/layout.tsx:7-9`）。→ 🟨🟥(dev専用)
- **/onboarding/continue**: 内部リンク0件。到達はAPI発行のcontinueUrlのみ（意図的な外部URL入口）。→ 🟨
- **/onboarding**: 新規端末でroot `/` を開いたときの通常入口。外部流入クエリも
  `EntryRouter` が保持して引き継ぐ。既存写真または猫プロフィールがある端末は
  完了マーカーがなくても `/home` を維持する。
- **/collection?manage=sent**: 以前の送信写真一覧を開く互換URL。設定や
  ねこだより本体からは案内せず、通常の管理は `うちのこ > 写真` のねがお詳細で
  写真ごとに行う。古いリンクや既存端末を急に壊さないため、URL自体は当面残す。→ 🟨
- **/auth/callback**: 全分岐が自動遷移（成功→next、失敗→account/create?error=auth）で滞留しない。行き止まりではない。

### ねこだより送信候補の管理

- 通常導線は `うちのこ > 写真 > ねがお写真詳細`。
- ねがおごとに「送る候補／送らない」を切り替える。同じ写真詳細で現在の状態を確認し、写真自体も削除できる。
- 通常追加した `この子の写真` は送信候補にならないため、切替を表示しない。
- `/settings` に送信写真の専用一覧は置かない。
- `/collection?manage=sent` は互換用に残すが、新しい導線や説明からは参照しない。
- 候補から外す操作は今後の配達を止める。すでに届いた写真は受け取った側に残る。

---

## 2. オンボーディング詳細図（分岐条件つき）

```mermaid
flowchart TD
  ROOT["/"] --> ENTRY_DECISION{"完了状態または<br/>既存の写真・猫情報があるか"}
  ENTRY_DECISION -- yes --> RHOME["/home"]
  ENTRY_DECISION -- no --> ENTRY["/onboarding<br/>流入クエリを保持"]

  ENTRY --> REPAIR["保存済み初回写真があれば夜便予約を修復"]
  REPAIR --> RESUME{"進行状態の復元<br/>resolveOnboardingResumeDecision"}
  RESUME -- "stage=album_created / opened" --> RHOME
  RESUME -- "stage=arrived+delivered" --> ENV
  RESUME -- "旧stage=name_pending" --> NORMALIZE["openedへ正規化"] --> RHOME
  RESUME -- "stage=submitted(+ownPhoto)" --> SAVING
  RESUME -- "completed(direct/referral)+実証あり" --> RHOME
  RESUME -- "completedだが実証なし→フラグ破棄" --> INTRO
  RESUME -- "進行なし" --> INTRO["intro"]

  INTRO -- "LINE/Instagramなどの<br/>アプリ内ブラウザ" --> EXTG["このブラウザで試す（主）<br/>Safari／Chromeでひらく（補助）"]
  EXTG -- "このブラウザで試す" --> INTRO
  EXTG -- "Safari／Chromeでひらく" --> HOFF["handoff URL発行"]
  HOFF --> CONT["/onboarding/continue"]
  CONT -- "復元成功" --> ENTRY
  INTRO -- "写真選択" --> SAVING["saving"]
  SAVING --> RESERVE["自分の写真を「うちのこ」へ保存<br/>直近の夜便へ自動予約<br/>20時前=当日 / 20時以降=翌日"]
  RESERVE -. "同じ便の既存targetは上書きしない<br/>予約日の翌朝05:00以降は修復しない" .-> RULE["recordOnboardingEveningDeliveryTarget"]
  RESERVE -- "4候補の取得成功" --> ENV["envelope"]
  RESERVE -- "候補なし/失敗" --> EMPTY["empty"]
  EMPTY -- "再試行" --> RESERVE
  EMPTY -- "通常→home / test tools→settings" --> RHOME

  ENV -- "ねこだよりをひらく" --> CHOICE["4匹から確認"]
  CHOICE -- "1匹を選んで保存" --> SERVER["APIで最初の結果を確定"]
  CHOICE -- "保存しない" --> SERVER
  SERVER -- "kept" --> KEPT["自分の写真→うちのこ<br/>選んだ猫→ねこだより"]
  SERVER -- "skipped" --> SKIPPED["自分の写真だけ→うちのこ"]
  KEPT --> RHOME
  SKIPPED --> RHOME

  LEGACY["互換入力のみ:<br/>next=second_photo / from=onboarding_second_photo"] -. "予約修復後、queryを除去" .-> RHOME
```

### 既存 `docs/onboarding-transition-map-2026-07-06.md` との照合（コードが正・mapの改訂必要箇所）

| # | map側の記述 | コードの現実 | 出典 |
|---|---|---|---|
| 1 | 2枚目予告と2枚目入力が現行フロー | Phase 1では初回写真を直近の夜便へ自動予約し、2枚目は要求しない | `OnboardingFlow.tsx:856-881`, `eveningDelivery.ts:189-225` |
| 2 | 完了後は保存方法選択へ進む | 実行環境にかかわらず `/home` へ直行する。Google保存は設定から任意で行う | `OnboardingFlow.tsx`, `SettingsPage.tsx` |
| 3 | Google成功: `/auth/callback` → `/cats?onboarding=1`（map:67-68,97） | callbackは `next`（既定 `/home`）へ `auth=google_success` 付きで戻るだけ。`/cats?onboarding=1` は account/create 側の分岐 | `auth/callback/page.tsx:89-91,162-168`, `account/create/page.tsx:625` |
| 4 | handoff復元後は `/home?handoff=restored` | 復元した初回写真から夜便予約も修復する。旧 `next=second_photo` は互換入力としてのみ残り、Home側で通常URLへ正規化する | `handoff.ts:423-435`, `HomeInput.tsx:406-424` |
| 5 | 再訪・復元経路（progress stageによる resume 分岐）がmapに無い | 初回写真があれば予約を冪等修復する。album_created/openedはhome、arrived→envelope、submitted→saving。旧name_pendingはopenedへ正規化してhomeへ進む | `OnboardingFlow.tsx`, `stateMachine.ts` |
| 6 | empty→「ホームへ」= /home のみ（map:77-78,89） | test tools有効時は /settings へ | `OnboardingFlow.tsx:1267-1272` |
| 7 | 初回写真の予約修復条件が未記載 | 同日既存targetを上書きせず、予約日の翌朝05:00以降は古い初回写真から修復しない | `eveningDelivery.ts:189-225` |

map §0の裁定（admin_stockのみ・seed分散・通常プール合流）はコードと一致（`exchange route.ts:396-401,1453-1455,312-334`）。

---

## 3. ホーム状態遷移図（state1〜4＋deliveryCheckState）

deskState対応: `getDeskState`（`HomeDeskModel.tsx`）= waiting→"2" / delivered→"3" / opened→"4" /
before→isTodayDelivery?"1":"1b"。EveningHomeState定義は `eveningDelivery.ts:30-54`。

```mermaid
stateDiagram-v2
  state "1: before(きょう分)" as S1
  state "1b: before(あした分)" as S1b
  state "2: waiting(おくった)" as S2
  state "3: delivered(封筒)" as S3
  state "4: opened" as S4

  [*] --> S1: 日付切替(dateKey更新)
  S1 --> S2: ねがおを とる<br/>(targetPhoto set)
  S1 --> S1b: 20時越え未投稿<br/>afterTodayDelivery (eveningDelivery.ts:35)
  S1b --> S2: きょうの写真を残す<br/>(翌日targetPhoto set)
  S2 --> S3: 20:00 JST 到達で exchange 評価<br/>useEveningDelivery(evaluate)<br/>成功で deliveredPhoto 格納
  S3 --> S4: タップでひらく (openedBy user)
  S3 --> S4: 翌朝5時 自動開封<br/>autoOpenExpiredEveningDeliveries<br/>(eveningDelivery.ts:210,306 / 期限=翌日05:00 :410-412)
  S4 --> S1: 翌日 dateKey 切替
  S1b --> S1: 翌日 dateKey 切替

  state "deliveryCheckState (useEveningDelivery.ts:42-43)" as CHK {
    idle --> checking: 20時評価開始 (:156)
    checking --> slow: タイマー経過 (:168-170)
    checking --> idle: 配達成立 (:252,303)
    checking --> failed: エラー (:142,199,265,281,332)
    slow --> failed: エラー
    slow --> idle: 成立
    failed --> checking: もう一度確認する(onRetry)<br/>(HomeDeskModel.tsx:1789-1795)
  }
```

- 表示コピー対応: checking中は「ねこだよりを確認しています…／もうすぐ、とどく」
  （`HomeDeskModel.tsx:1775-1778`）、slow/failedは再試行ボタン（`:1783-1797`）。
- late-sent / empty-after は state表示上のphase（20時以降にとった/とらなかった日の文言。
  `HomeDeskModel.tsx:1728-1756,1808-1814`）。
- 20時境界はサーバ側でも検証（exchange解禁 19:55:00、`eveningDeliveryServer` 経由。
  `exchange route.ts:221,760`）。

---

## 4. 課金・退会の遷移（画面×API対応）

```mermaid
flowchart TD
  SET["/settings βサポーター節<br/>SettingsPage.tsx:1147"] --> BETA["/beta-supporter"]
  BETA -- "応援する" --> CK["POST /api/billing/create-checkout-session<br/>beta-supporter/page.tsx:142"]
  CK -- "401 login_required" --> BETA_E1["未ログイン表示"]
  CK -- "403 beta_participant_required" --> BETA_E2["β外表示"]
  CK -- "409 already_active" --> BETA_E3["加入済み"]
  CK -- "200 session.url" --> STRIPE["Stripe Checkout(外部)"]
  STRIPE -- 成功 --> SSET["/settings?billing=success<br/>(checkout route.ts:89)"]
  STRIPE -- キャンセル --> CSET["/settings?billing=cancel<br/>(checkout route.ts:90)"]
  STRIPE -. webhook .-> WH["POST /api/stripe/webhook<br/>subscriptions upsert (webhook route.ts:41-73)"]
  WH --> STATUS["GET /api/billing/status<br/>settings/beta-supporterの表示に反映"]

  BETA -- "支払いを管理(サポーター時)<br/>beta-supporter/page.tsx:286-295,160" --> PORTAL["POST /api/billing/create-portal-session"]
  PORTAL -- "200 url" --> SPORTAL["Stripe Customer Portal(外部)"]
  SPORTAL -- return --> SET2["/settings (portal route.ts:45)"]

  DELINFO["/account-deletion(案内のみ)<br/>settings:763から"] -. "問い合わせ導線(手動運用)" .-> CONTACT["/contact"]
  DELAPI["POST /api/account/delete-stored-data<br/>(Stripe解約+全削除+auth削除)"]
  DELLIB["deleteAccountStoredData()<br/>accountSync.ts:865"] --> DELAPI
  NOTE1["⚠ UIからの呼び出し 0件<br/>(src/components に参照なし)"] -.-> DELLIB
```

- **退会のUI遷移は存在しない**: 退会APIとクライアント関数（`deleteAccountStoredData` `accountSync.ts:865`）は
  実装済みだが、`src/components` に呼び出しが無い（grep 0件）。現行の退会は
  `/account-deletion` の案内→問い合わせ→手動、が唯一の経路。

---

## サマリ（この文書分）

- 俯瞰図: ノード24ページ／孤立4（offline・prototypes・onboarding/continue・onboarding本体の通常導線）／
  行き止まり2（offline・prototypes/taimen）。
- オンボ詳細: 初回写真の夜便自動予約、resume/re-entry/handoff修復、完了後の環境別遷移、旧2枚目URLの互換正規化を反映。照合項目 **7件**（コードが正）。
- ホーム: 5状態＋checkサブ状態4、トリガー3種（とる/20時/翌朝5時）。
- 課金・退会: 画面×API対応6本。退会はAPIのみ存在しUI未配線（issues追補へ）。

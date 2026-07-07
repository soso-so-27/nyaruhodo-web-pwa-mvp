# screen-flows.md — システム地図 成果物5（画面遷移図）

> 出典はコードのみ（辺=リンク・router.push/replace・redirect・window.location）。全て `ファイル:行` 付き。
> 作成: 2026-07-07 / 対象: HEAD ワークツリー（`4efcab6` 時点）。
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
| onboarding→home（replace/push） | `OnboardingFlow.tsx:371,387,867,1272` |
| onboarding→settings（test tools時のみ） | `OnboardingFlow.tsx:1268` |
| onboarding→/account/create | `OnboardingFlow.tsx:392-395,858-864` |
| account/create→home / →cats?onboarding=1 | `account/create/page.tsx:573,635,625` |
| auth/callback→next(既定/home)+auth=google_success / →account/create?error=auth | `auth/callback/page.tsx:89-91,46,54,76,141,162-178` |
| onboarding/continue→/home?handoff=restored | `onboarding/continue/page.tsx:104-108` |
| handoff URL発行（→/onboarding/continue） | `api/onboarding/handoff/create/route.ts:92` |
| not-found→home | `src/app/not-found.tsx:17` |
| 旧4リダイレクト | `together/page.tsx:3`, `torisetu/page.tsx:3`, `diagnose/page.tsx:3`, `diagnosis-onboarding/page.tsx:3` |
| /（root）=home同内容（redirectではなく同コンポーネント） | `src/app/page.tsx:1-7`, `src/app/home/HomePageContent.tsx` |

### 孤立・行き止まりの判定根拠

- **/offline**: ページ内にリンク・ボタン遷移なし（`offline/page.tsx` に href/router 0件）。到達はSWの
  オフラインfallbackのみ（`public/sw.js:4` `OFFLINE_URL`）。→ 🟨🟥
- **/prototypes/taimen**: 内部リンク0件・戻るリンクなし・本番は404（`prototypes/layout.tsx:7-9`）。→ 🟨🟥(dev専用)
- **/onboarding/continue**: 内部リンク0件。到達はAPI発行のcontinueUrlのみ（意図的な外部URL入口）。→ 🟨
- **/onboarding**: 内部の通常導線が無い（settingsの `?test=1` はテスト用 `SettingsPage.tsx:975`）。
  `/home` 側に未完了ユーザーをonboardingへ誘導するコードは無い（`src/app/home/*.tsx` に onboarding 参照0件）。
  → 主入口は外部リンク（bio等）のみ。🟨
- **/auth/callback**: 全分岐が自動遷移（成功→next、失敗→account/create?error=auth）で滞留しない。行き止まりではない。

---

## 2. オンボーディング詳細図（分岐条件つき）

```mermaid
flowchart TD
  ENTRY["/onboarding 入口"] --> RESUME{"進行状態の復元<br/>resolveOnboardingProgress<br/>OnboardingFlow.tsx:350-376"}
  RESUME -- "stage=album_created" --> RHOME["replace /home<br/>:386-388"]
  RESUME -- "stage=opened" --> RACCT["replace /account/create?from=onboarding<br/>:391-396"]
  RESUME -- "stage=arrived+delivered" --> ENV
  RESUME -- "stage=name_pending(+delivered)" --> NAMING
  RESUME -- "stage=name_pending/submitted(+ownPhoto)" --> SAVING
  RESUME -- "completed(direct/referral)+実証あり" --> RHOME2["replace /home :357-372"]
  RESUME -- "completedだが実証なし→フラグ破棄" --> INTRO
  RESUME -- "進行なし" --> INTRO["intro"]

  INTRO -- "referral & アプリ内ブラウザ & 未dismiss<br/>shouldShowExternalBrowserGuide :1275-1279" --> EXTG["外部ブラウザ案内<br/>(URLコピー/このまま進む)"]
  EXTG --> INTRO
  INTRO -- "写真選択" --> SAVING["saving"]
  SAVING -- "exchange mode=onboarding 成功" --> ENV["envelope"]
  SAVING -- "候補なし/失敗" --> EMPTY["empty :688,721,1236"]
  EMPTY -- "handleGoHome: test時→/settings, 通常→/home :1267-1272" --> GOHOME["/home or /settings"]

  ENV -- "タップ handleOpenEnvelope :961" --> REV{"prefers-reduced-motion?<br/>:996-999"}
  REV -- yes --> DELIV
  REV -- no --> REVEAL["revealing (1150ms :89)"] --> DELIV["delivered"]

  DELIV -- "PWA設置案内の表示条件:<br/>kept && installPlatform有 && !embedded && !dismissed<br/>:150-156 (standalone/embeddedでは非表示 :224-226)" --> PWAG["インストール案内<br/>android=prompt() / iOS=手順 :870-894"]
  PWAG --> DELIV
  DELIV -- "つづける: 猫名未設定<br/>:823-836" --> NAMING["naming"]
  DELIV -- "つづける: 猫名設定済み<br/>:838" --> SPCHECK
  NAMING --> SPCHECK{"20時前?<br/>isBeforeJstHour(20) :145-149"}
  SPCHECK -- "yes → second_photo_prompt :795-797" --> SP["2枚目プロンプト"]
  SPCHECK -- no --> ACCT2["/account/create?from=onboarding"]
  SP -- "もう1枚: 埋め込みブラウザ<br/>:858-864" --> ACCT_SP["/account/create?…&next=second_photo<br/>(handoff経由で母艦へ)"]
  SP -- "もう1枚: 通常ブラウザ :867" --> HOME_SP["/home?from=onboarding_second_photo"]
  SP -- あとで --> ACCT2

  ACCT2 -- "Googleでつづける" --> OAUTH["signInWithOAuth<br/>redirectTo=/auth/callback?next=…"]
  OAUTH --> CB{"auth/callback<br/>page.tsx:26-92"}
  CB -- "code無 & link_identity中<br/>:33-41,145-153" --> FALLBACK["既存Googleへfallback再試行<br/>prompt=select_account :97-133"]
  FALLBACK --> OAUTH
  CB -- "code無(通常)/クライアント無/交換失敗" --> AERR["/account/create?error=auth<br/>:46,54,76,141"]
  CB -- "成功: 匿名Storage移送finalize後<br/>next(既定/home)+auth=google_success :80-91" --> NEXT["next先 (/account/create経由で<br/>/cats?onboarding=1 or /home<br/>account/create:625,635)"]

  ACCT2 -- "つづきのリンク(Googleなし/埋め込み)" --> HOFF["createOnboardingHandoff<br/>handoff.ts:53 → POST create"]
  HOFF --> CONT["/onboarding/continue?handoff=…"]
  CONT -- "アプリ内ブラウザで開いた<br/>continue/page.tsx:35,44" --> COPY["URLコピー案内のみ<br/>(この環境では復元しない)"]
  CONT -- "Safari/Chrome/PWA" --> REDEEM{"redeem (1回限り)"}
  REDEEM -- 成功 --> RESTORED["/home?handoff=restored<br/>(+&from=onboarding_second_photo) :104-108"]
  REDEEM -- "already_used & 端末に復元済み :90-97" --> RESTORED
  REDEEM -- "期限切れ/不明token" --> CERR["エラー表示(その場)"]
```

### 既存 `docs/onboarding-transition-map-2026-07-06.md` との照合（コードが正・mapの改訂必要箇所）

| # | map側の記述 | コードの現実 | 出典 |
|---|---|---|---|
| 1 | 順序が「delivered→2枚目予告→PWA案内→猫名判定→naming」（map:54-63） | 現行は「delivered（PWA案内はdelivered中に併出）→猫名判定→naming→**その後に**second_photo_prompt（20時前のみ）」。d8bde81 "Move second photo prompt after onboarding letter" で順序変更済み | `OnboardingFlow.tsx:823-838,795-797,145-156` |
| 2 | 2枚目導線は `/home?from=onboarding_second_photo` 直行のみ（map:93） | 埋め込みブラウザ時は `/account/create?…&next=second_photo` を経由（handoffで母艦に渡す。ace8081） | `OnboardingFlow.tsx:858-864` |
| 3 | Google成功: `/auth/callback` → `/cats?onboarding=1`（map:67-68,97） | callbackは `next`（既定 `/home`）へ `auth=google_success` 付きで戻るだけ。`/cats?onboarding=1` は account/create 側の分岐 | `auth/callback/page.tsx:89-91,162-168`, `account/create/page.tsx:625` |
| 4 | handoff復元後は `/home?handoff=restored`（map:75,99） | `next=second_photo` 引き継ぎ時は `&from=onboarding_second_photo` が付く | `continue/page.tsx:104-108` |
| 5 | 再訪・復元経路（progress stageによる resume 分岐）がmapに無い | album_created→/home、opened→/account/create、arrived→envelope、name_pending→naming/saving、submitted→saving、stale-completed→フラグ破棄しintro | `OnboardingFlow.tsx:350-438` |
| 6 | empty→「ホームへ」= /home のみ（map:77-78,89） | test tools有効時は /settings へ | `OnboardingFlow.tsx:1267-1272` |
| 7 | PWA案内の表示条件が「delivered内」とだけ（map:94） | 条件は kept && installPlatform有 && **!embedded** && !dismissed。standalone/embeddedではplatform自体を設定しない | `OnboardingFlow.tsx:150-156,224-226` |

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
- オンボ詳細: 分岐条件11種を辺ラベル化。既存mapとの乖離 **7件**（改訂リスト提示。コードが正）。
- ホーム: 5状態＋checkサブ状態4、トリガー3種（とる/20時/翌朝5時）。
- 課金・退会: 画面×API対応6本。退会はAPIのみ存在しUI未配線（issues追補へ）。

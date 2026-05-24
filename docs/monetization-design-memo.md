# Monetization Design Memo

Last updated: 2026-05-24

## 1. Goal

にゃるほどの事業ゴールは、猫を見かけた瞬間の小さな記録を習慣化し、その記録、写真、診断結果を「この子の大切な記録」として長く残したいユーザーが自然に有料プランへ進む状態を作ること。

最初から課金を迫るのではなく、以下の順で価値を育てる。

1. 猫を見たら開く
2. みっけ / おせわ / 写真を軽く残す
3. トリセツやコレクションに「たまった価値」が見える
4. 消したくない、残したい、もっと知りたいと思う
5. アカウント保存、有料プラン、長期保存へ進む

## 2. Core Monetization Hypothesis

課金理由は「AI診断がすごい」ではなく、「この子の記録をちゃんと残しておきたい」。

主な有料価値候補:

- 長期保存: 端末内だけでなく、アカウントに安全に残せる
- 写真保存: コレクション写真やホーム写真を多く残せる
- トリセツ拡張: 深掘り診断、追加カテゴリ、詳細なふりかえり
- ふりかえり: 月次まとめ、最近の変化、病院で説明しやすいメモ
- 共有: 家族と同じ猫の記録を見られる

初期の主軸は「長期保存 + トリセツ拡張 + 写真棚」。家族共有や病院レポートは強いが、初回課金理由にする前に継続利用と保存ニーズを確認する。

## 3. Product Loop

```
猫を見つける
  -> Homeでみっけする
  -> 記録がたまる
  -> Torisetu / Collection に変化が出る
  -> もっと残したくなる
  -> Account / Pro に進む
```

このループを壊すものは優先度を下げる。

- ホームの長い説明
- ホームの読み物化
- トリセツの入力画面化
- コレクションの知識棚化
- ねこタブの記録画面化

## 4. Page Roles Toward Monetization

### Home

Monetization role: 記録習慣を作る入口。

ここで課金を直接売りすぎない。まずは開く理由と記録する軽さを作る。

Should do:

- みっけ / おせわ / 写真をすぐ押せる
- おすすめは次の1アクションに寄せる
- たまった価値は短く示し、詳細はTorisetu / Collectionへ送る

Should avoid:

- 長文説明
- 課金訴求の常時表示
- トリセツの結果を読み込ませるUI

### Torisetu

Monetization role: 有料化の主な価値が見える棚。

無料でも少し育つ。有料で深く、長く、増える。

Should do:

- みっけから分かった特徴を見返せる
- 診断結果をカードとして見返せる
- 未開封の深掘り診断を並べる
- 「この子の理解が育っている」感を出す

Should avoid:

- 生ログ一覧を主役にする
- 説明文を増やしすぎる
- ホームのおすすめと同じカードを並べる

### Collection

Monetization role: 写真保存価値を作る棚。

写真が増えるほど消したくなくなる。将来の写真保存枠、長期保存、共有につながる。

Should do:

- 今日の見つけたい姿を出す
- 写真追加後に「見つけた」感を出す
- 共有したくなる見た目にする
- 空きスロットを「集めたい余白」として見せる

Should avoid:

- 知識説明を入れすぎる
- プロフィール編集を混ぜる

### Cats

Monetization role: 保存対象の猫を整える場所。

課金導線の主役ではないが、アカウント保存やプロフィール整備の入り口になる。

Should do:

- プロフィール管理に集中
- ホーム写真、アバター、基本情報を整える
- 設定への導線を置く

Should avoid:

- 毎日の記録
- トリセツ結果の表示
- コレクション管理

### Settings / Account

Monetization role: 保存と課金の信頼を担う場所。

Should do:

- アカウント接続状態を明確にする
- ベータ版と将来の有料プランを誠実に説明する
- データ削除やログアウトを分かりやすく置く

Should avoid:

- 「同期完了」「永久保存」など、未実装の保証を言う

## 5. Free / Paid Boundary Draft

### Free

- 猫プロフィール作成
- ホームでの基本みっけ / おせわ / 写真
- 基本トリセツ
- タイプ診断結果の閲覧
- 基本コレクション
- 端末内保存

### Paid Candidate

- アカウントへの長期保存
- 写真保存数の拡張
- 深掘り診断の追加解放
- 月次ふりかえり
- コレクション拡張
- 家族共有
- 病院用メモ / レポート

初期課金プランは「保存プラン」として見せるのが自然。診断単体の売り切りより、記録がたまった後のサブスクと相性がよい。

## 6. Schedule

### Phase 1: Role Fit and Free Loop

Target: 1 week

Goal: 猫を見たらHomeを開き、1つ残す体験を安定させる。

Tasks:

- Homeを即時アクションに集中させる
- Torisetuをナレッジ棚として整理する
- Collectionを写真棚として整理する
- Catsをプロフィール管理に限定する
- 不要な説明や重複コンテンツを削る

This is where page goals should be tightened first.

Exit criteria:

- 初見でHomeが「押す場所」に見える
- Torisetuが「たまった知識を見る場所」に見える
- Collectionが「写真を集める場所」に見える
- Catsが「管理場所」に見える

### Phase 2: Measurement and Demand Signals

Target: 1 week

Goal: 課金前に、継続利用と保存ニーズを測れる状態にする。

Tasks:

- 主要イベントの計測設計
- Home action click
- Torisetu open
- Collection photo add
- Account CTA click
- Settings account section view
- 「保存したい」意図のCTAを軽く置く

Exit criteria:

- D1 / D3 / D7 retentionを見られる
- Account CTAのクリック率を見られる
- Torisetu / Collection が再訪理由になっているか見られる

### Phase 3: Account Storage Foundation

Target: 1-2 weeks

Goal: 有料保存へ進める前に、無料アカウント保存の信頼を作る。

Tasks:

- Supabase Authログイン済みユーザーの状態整理
- localStorageデータのDB引き継ぎ設計
- cats / profiles / record logs / collection photos の最小DB設計
- 移行UX: 「この端末の猫を引き継ぐ」
- 移行後もlocalStorageを壊さない

Exit criteria:

- ログインしても猫データが消えない
- 端末データを明示的に引き継げる
- 保存状態がユーザーに分かる

### Phase 4: Pre-Paid Validation

Target: 1 week

Goal: 決済前に、どの有料価値が押されるか確認する。

Tasks:

- 「長く残す」CTA
- 「写真をもっと残す」CTA
- 「深掘り診断を増やす」CTA
- まだ課金せず、準備中 / 通知希望 / 興味ありで計測

Exit criteria:

- もっとも押される価値軸が分かる
- 課金文言で不信感が出ない
- 無料体験の邪魔をしない

### Phase 5: Paid MVP

Target: 2-3 weeks

Goal: 最小の有料プランを実装する。

Tasks:

- Stripe Checkout
- subscription status
- Supabase user / plan mapping
- free / paid limits
- Settingsのプラン表示
- 解約 / 問い合わせ導線
- 利用規約 / プライバシーポリシー確認

Exit criteria:

- 有料登録できる
- プラン状態が反映される
- 解約導線がある
- データ保存系の約束が実装内容と一致している

### Phase 6: Paid Retention

Target: ongoing

Goal: 支払い後も価値が増える状態を作る。

Tasks:

- 月次ふりかえり
- 新しい深掘り診断
- コレクション達成
- 写真の思い出化
- 家族共有
- 病院用レポート

Exit criteria:

- 有料ユーザーが翌月も開く理由がある
- トリセツ / コレクションが継続的に育つ

## 7. Metrics

### Activation

- cat profile created
- home photo set
- first mikke
- first care
- first collection photo

### Habit

- D1 / D3 / D7 return
- records per active cat per day
- days with at least one mikke
- time from app open to first action

### Value Proof

- Torisetu open after mikke
- Collection open after daily target
- diagnosis card opened
- locked diagnosis viewed
- account CTA clicked

### Monetization Intent

- account create CTA click
- long-term save CTA click
- photo storage CTA click
- deep diagnosis CTA click
- plan page view

## 8. Decision Rules

Use these rules before adding or changing features:

- If it increases daily capture, it belongs near Home.
- If it helps the user understand accumulated meaning, it belongs in Torisetu.
- If it makes photos worth saving, it belongs in Collection.
- If it improves identity/profile quality, it belongs in Cats.
- If it asks for trust, account, data, or payment, it belongs in Settings / Account.

Do not monetize before:

- Home is clearly useful without reading
- Torisetu has at least one meaningful result to protect
- Collection has photo value
- Account storage does not risk data loss

Do monetize when:

- Users have multiple days of records
- Users have photos or diagnosis results they would not want to lose
- Account CTA receives meaningful clicks
- The paid promise is implemented, not aspirational

## 9. Near-Term Task List

### Immediate

- Finish role cleanup on Home / Torisetu / Collection / Cats
- Keep copy short and action-oriented
- Make Home recommendation board mostly actionable
- Make Torisetu diagnosis/result cards feel like stored knowledge
- Make Collection photo addition feel rewarding

### Next

- Define event tracking names
- Define minimum DB schema for account storage
- Design localStorage -> DB migration UX
- Add pre-paid CTA experiments without Stripe

### Later

- Stripe subscription
- plan limits
- monthly summaries
- family sharing
- hospital report

## 10. Open Questions

- First paid promise: long-term save, photo storage, or deep diagnosis?
- Free photo limit: unlimited during beta or capped later?
- Deep diagnosis: subscription-only, credit-based, or free unlock by usage?
- Family sharing: part of first paid plan or later premium feature?
- How much data must exist before the user feels "I do not want to lose this"?

Current recommendation:

Start with free habit and account save. Validate paid intent with CTAs. Make the first paid plan about long-term preservation and expanded memory, not raw AI output.

## 11. SNS Diagnosis-Led Open Beta Strategy

### Assumption

初回流入はSNSの小規模公開を想定する。既存アカウントに約5,000フォロワーがいるが、現在は投稿頻度が高くないため、いきなり大規模ローンチではなく、小さなオープンβとして扱う。

入口はHomeではなく、タイプ診断にする。

Primary entry promise:

> うちの子、何タイプ？

Secondary promise:

> 写真といくつかの質問から、この子のトリセツを作ります。

### Why diagnosis first

SNSで最初に伝わりやすいのは「記録アプリ」より「診断」。診断は押す理由が明確で、猫の名前、写真、基本情報も「診断のため」として入力してもらいやすい。

ここでは離脱率をゼロにすることより、確度の高いユーザーを残すことを優先する。

High-intent signals:

- 猫の名前を入力する
- 写真を入れる
- 生年月日 / 性別 / 猫種を入れる
- 診断質問に答える
- 結果を保存する
- Homeで初回みっけをする

このユーザーは、将来の長期保存、深掘り診断、写真保存の有料候補になりやすい。

### Onboarding stance

診断前に情報を取る方針は維持する。

Current flow is directionally correct:

1. 名前
2. 写真
3. 毛色
4. 基本情報
5. 診断
6. 結果
7. コレクション予告
8. Home

Do not over-lighten the flow before validating. Instead, improve meaning and motivation:

- 名前: この子専用の診断を始める
- 写真: Home背景とプロフィールに使う
- 基本情報: 診断と今後のトリセツの手がかりになる
- 診断: タイプを知る
- 結果: この子のトリセツができる
- Home: みっけで育てる

### Current concern

診断前に写真と基本情報を求めるため、軽い興味層は落ちる可能性がある。これは許容する。ただし、どこで落ちているかは必ず計測する。

## 12. Login and Database Timing

### Short answer

- ログイン: 診断前には置かない。結果後またはHome到達後に任意で出す。
- DB: 実課金前には必須。オープンβ初期では、まず計測DBを優先し、アカウント保存DBは段階的に入れる。

### Login timing

現在、Google Authの入口はある。これを初回診断前に強制しない。

Recommended login timing:

1. 診断結果後
   - CTA: この子のトリセツを保存する
   - ただしスキップ可能

2. Homeで数回みっけ後
   - CTA: この子の記録を残しておく
   - 価値が発生してから出す

3. Settings
   - アカウント状態を確認できる場所として常設

Avoid:

- SNS流入直後のログイン強制
- 診断開始前のGoogleログイン要求
- 「同期完了」「ずっと保存」など、DB未実装の約束

### Database timing

DBは3段階で考える。

#### DB0: Funnel measurement before or at open beta

Goal: どこで落ちているかを見る。

Store:

- anonymous session id
- diagnosis started
- name step completed
- photo step completed / skipped
- basic info completed / skipped
- provisional result shown
- final result shown
- profile saved
- home reached
- first mikke
- first collection open
- account CTA clicked

Do not store full photos or sensitive profile data here unless privacy wording is ready.

Timing:

- SNSオープンβ前にできるのが理想
- ただし最初の数十人なら手動フィードバックでも代替可

#### DB1: Account-backed profile and diagnosis preservation

Goal: ログインした人の猫プロフィールと診断結果を残す。

Store:

- users / profiles
- cats
- diagnosis results
- basic cat profile
- record logs minimum

Photos:

- 最初はhomePhoto/avatarの扱いを慎重にする
- base64をDBに入れず、Storage設計を決める

Timing:

- オープンβで「残したい」反応が出た後
- または2回目のSNS告知前
- 実課金より前

#### DB2: Paid-ready persistence

Goal: 有料保存として約束できる状態にする。

Store:

- record logs
- collection photos
- torisetu results
- subscription status
- plan limits
- data deletion/export support

Timing:

- Stripe実装前に必須
- 有料CTAで需要が確認できてから

### Recommendation for this product

最初のSNS公開では、ログイン強制はしない。  
ただし、診断結果後に「この子のトリセツを保存する」を出し、Googleログインへ誘導する。

DBは、まずファネル計測を優先する。ユーザーの猫データの本保存は、オープンβで保存ニーズが見えてからDB1として実装する。  
ただし、SNS公開時点で「ユーザー入力データを運営側でも分析したい」なら、DB0は先に必要。

## 13. Open Beta Schedule for Diagnosis Entry

### Week 0: Strategy lock

Goal: 公開前に何を検証するか決める。

Decide:

- SNS入口コピー
- 診断前に取る情報
- 写真を必須にするか任意にするか
- 基本情報の任意/必須
- ログインCTAの表示タイミング
- 計測するイベント
- β成功条件

### Week 1: Onboarding meaning polish

Goal: 入力ステップの納得感を上げる。

Tasks:

- 名前、写真、基本情報のコピーを「診断の手がかり」に寄せる
- 写真は任意だが、入れる価値を伝える
- 基本情報は任意だが、診断/トリセツに効くと伝える
- 結果画面を「この子のトリセツができた」に寄せる
- HomeへのCTAを「みっけを始める」に寄せる

### Week 2: Open beta setup

Goal: 小規模公開できる状態にする。

Tasks:

- SNS投稿を3-5本準備
- 投稿用スクショ/短動画を準備
- βURLを `/diagnosis-onboarding` に寄せる
- フィードバック導線を用意
- DB0または手動計測のどちらで見るか決める
- アカウント保存CTAを確認

### Week 3-4: Small open beta

Goal: SNSで30-100人程度に使ってもらう。

Run:

- 投稿再開
- 診断入口を告知
- β版であることを明示
- 感想をDM/フォームで回収

Watch:

- diagnosis start
- profile save
- home reach
- first mikke
- day 1 return
- day 3 return
- account CTA click
- save intent

### Week 5: Funnel review

Goal: どこを改善すべきか判断する。

Decide:

- 写真ステップで落ちているか
- 基本情報で落ちているか
- 診断結果の納得感があるか
- Homeでみっけされているか
- Torisetu/Collectionが見られているか
- ログイン/保存CTAに反応があるか

### Week 6: Pre-paid CTA test

Goal: 実課金前に有料価値を確認する。

Test CTA:

- この子の記録を長く残す
- 写真をもっと残す
- 深掘り診断を増やす

No Stripe yet. Use waitlist / interest / preparation messaging.

## 14. Problems and Risks

### Acquisition

- SNSアカウントが休眠気味で、初回リーチが想定より低い可能性
- 「猫タイプ診断」がありふれて見える可能性
- 診断結果の名前や世界観が伝わらない可能性
- β版であることが弱いと、未完成感が不満になる可能性

### Onboarding funnel

- 写真入力で離脱する可能性
- 基本情報入力で離脱する可能性
- 診断までの到達に時間がかかる可能性
- 3問仮結果から追加5問に進まない可能性
- 結果後にHomeへ進まず離脱する可能性
- Homeへ進んでも、みっけの意味が伝わらない可能性

### Data and trust

- localStorageのみだと、ユーザーが入力したデータを失う可能性
- 写真や猫プロフィールを扱うため、保存/削除/利用目的の説明が必要
- DB未実装なのに「保存」と言いすぎると信頼を損なう
- ログイン済みでもDB移行が未実装だと、保存されたと誤解される
- データ削除、ログアウト、アカウント削除の扱いが未整理

### Login

- ログインを早く出すと診断開始前に離脱する
- ログインを遅く出すと、データ保存価値が伝わりにくい
- Googleログインだけでよいか未決定
- ログイン済みユーザーに何が守られているかを明確にする必要がある

### Database

- cat profile / diagnosis / record / collection photo のDB設計が未確定
- localStorageからDBへの移行UXが未確定
- 写真をbase64で扱い続けるとスケールしない
- Storage設計とコスト見積もりが未確定
- RLSとプライバシー設計が必要
- 既存anon insert構成との整合が必要

### Monetization

- 最初の有料価値が未確定
- 長期保存、写真保存、深掘り診断のどれが一番強いか未検証
- 価格が未定
- 無料枠の制限が未定
- 有料化が早すぎるとβ体験を壊す
- 有料化が遅すぎると保存価値の検証が遅れる

### Product value

- Homeの記録がTorisetu/Collectionへつながっている実感が弱い可能性
- Torisetuが「読む棚」としてまだ重く見える可能性
- Collectionが「写真を集めたい」気持ちを十分に作れていない可能性
- ねこタブとSettingsの役割が混ざる可能性

### Content

- タイプ診断の納得感が継続率に直結する
- 診断結果が抽象的すぎると保存したくならない
- 深掘り診断の品質が低いと有料価値にならない
- 論文/根拠ベースの表現と、やさしい猫アプリらしさのバランスが必要

### UX / UI

- PWAのインストール導線が弱い
- iOS PWAの表示不具合が再発する可能性
- 背景写真依存のUIは写真によって視認性が揺れる
- BottomNav / board / sheet の整合性を保つ必要がある
- 説明文が増えると、アプリの軽さが消える

### Operations

- βユーザーからの問い合わせ先が未整理
- フィードバック回収方法が未整理
- 不具合報告をどう管理するか未整理
- 公開後にどの指標を毎日見るか未整理
- プライバシーポリシー、利用規約、課金規約が必要になる

## 15. Questions to Decide

### Before open beta

1. 写真は診断前に強く促すが、完全任意でよいか？
2. 基本情報は任意のままでよいか？
3. 診断は3問仮結果 + 5問追加のままでよいか？
4. 診断結果後のCTAは「みっけを始める」か「トリセツを作る」か？
5. 診断結果後にログインCTAを出すか、Homeで数回使った後に出すか？
6. オープンβ前にDB0計測を入れるか、最初は手動フィードバックでよいか？
7. SNS投稿の主コピーは「うちの子、何タイプ？」でよいか？

### Before DB implementation

1. 最初にDB保存する対象は何か？
   - cat profile
   - diagnosis result
   - record log
   - collection photos
2. 写真はいつStorageに移すか？
3. localStorageのデータを自動移行するか、ユーザー確認後に移行するか？
4. 複数猫の扱いをDBでどう持つか？
5. RLSと削除導線をどこまで先に用意するか？

### Before monetization

1. 初回有料価値はどれか？
   - 長期保存
   - 写真保存
   - 深掘り診断
2. 無料枠の上限をどうするか？
3. 月額にするか、買い切り/診断単位にするか？
4. 最初の価格帯は300-500円でよいか？
5. Stripe前にどのCTAクリック率を合格ラインにするか？

## 16. Current Recommendation

1. SNS入口はタイプ診断で固定する。
2. 診断前に名前、写真、基本情報を取る方針を維持する。
3. ただし、各入力の理由を短く明確にする。
4. ログインは診断前に強制しない。結果後またはHome利用後に任意で出す。
5. DBは、まず計測用のDB0を検討する。ユーザーデータ本保存は、保存ニーズが見えた後にDB1として実装する。
6. 課金はStripeを急がず、長期保存 / 写真保存 / 深掘り診断のCTAで先に需要を見る。
7. 実課金は、DB保存が信頼できる状態になってから入れる。

## 17. Native App and Stripe Strategy

### Current stance

最初はPWA/Web + Stripeで課金検証する。ネイティブアプリ化は、PWAで継続率・保存ニーズ・課金意向が見えた後に検討する。

ネイティブ化した場合も、Stripe契約を無理にApp Store / Google Play課金へ移行しない。既存Stripeユーザーは、ログインすればそのまま有料権限を使えるようにする。

### Entitlement-first design

課金プロバイダではなく、利用権限を中心に設計する。

```
Stripe subscription
Apple IAP subscription
Google Play subscription
        ↓
entitlements
        ↓
long-term storage / photo storage / deep diagnosis
```

この設計なら、将来ネイティブアプリを出しても支払い元を複数持てる。ユーザーに見せるのは「どこで払ったか」ではなく「どの機能が使えるか」。

### Existing Stripe users after native launch

WebでStripe課金したユーザーは、そのままWeb決済ユーザーとして継続させる。

アプリ内表示の例:

```
プラン: 長期保存プラン
決済: Web決済
管理: Webのアカウントページ
```

やらないこと:

- Stripe契約を一斉キャンセルしてApp Storeで再契約させる
- 二重課金が起きる導線を作る
- DB上の利用権限を課金プロバイダに強く依存させる

### Native payment caution

iOS/Androidアプリ内でデジタル機能を販売する場合、原則としてApple IAP / Google Play Billingの扱いを確認する必要がある。ネイティブアプリから単純にStripeへ誘導すればよい、とは考えない。

特に注意すること:

- アプリ内で使うデジタル機能はIAP/Play Billingの対象になりやすい
- 外部決済リンクは国・ストア・エンタイトルメント・表示要件・手数料の影響を受ける
- ネイティブ化前に、Stripe継続・IAP追加・外部リンク利用のどれで進めるか再判断する

### Recommendation

当面は以下の順番で進める。

1. PWAで保存価値と課金意向を検証する
2. DBに`entitlements`相当の利用権限レイヤーを作る
3. StripeでWeb課金を開始する
4. ネイティブ化が必要になったら、IAP/Play Billing追加を検討する
5. 既存Stripeユーザーは移行せず、ログインによる有料権限確認で継続利用させる

この方針なら、短期の検証速度と、将来のネイティブ展開の両方を守れる。

## 18. Next Execution Order

ここからは、マネタイズそのものより先に「診断入口 → 保存したくなる → 残したい理由が見える」流れを固める。

### Step 1: Diagnosis-led entry polish

Goal: SNSから来た人が、自然に診断を最後まで進められる状態にする。

Tasks:

- `/diagnosis-onboarding` の入力理由を短く明確にする
- 写真・基本情報が診断とHome体験にどう使われるかを一言で伝える
- 診断結果画面を「保存したくなるトリセツの入口」として整える
- Homeへ進むCTAを「みっけ」体験につなげる

### Step 2: Funnel measurement design

Goal: どこで離脱し、どこで保存意向が生まれるかを見えるようにする。

Tasks:

- 計測イベント名を決める
- anonymous session id の扱いを決める
- DB0を入れるか、最初は手動フィードバックにするか決める
- SNS公開時に見る指標を固定する

Detailed design:

- `docs/analytics-event-design.md`

### Step 3: Account and DB1 design

Goal: ログイン後に「この子の記録が消えない」信頼を作る。

Tasks:

- cats / diagnosis_results / record_logs / collection_photos の最小DB設計
- localStorageからDBへの引き継ぎUX
- Storageへ写真を移すタイミング
- RLS / 削除導線 / プライバシー文言

### Step 4: Pre-paid CTA validation

Goal: Stripe実装前に、何に支払いたいかを確認する。

Tasks:

- 長期保存CTA
- 写真保存CTA
- 深掘り診断CTA
- それぞれのクリック率・反応を見る

### Step 5: Paid MVP

Goal: 検証済みの価値に対して、最小の有料プランを出す。

Tasks:

- Stripe Checkout
- subscription status
- entitlements
- Settingsのプラン表示
- 無料枠 / 有料枠
- 解約・問い合わせ・規約

### Immediate next task

次に触るべき実装は、Stripeではなくオンボーディング。

理由:

- SNS入口がタイプ診断で決まっている
- 診断前入力を維持する方針なので、入力理由の納得感が重要
- ここが弱いと、DBや課金以前に母数が残らない
- 診断結果が保存価値の最初の核になる

次の実装単位:

1. `/diagnosis-onboarding` のコピーと画面遷移を診断入口向けに整える
2. 診断結果を「トリセツに残る知識」として見せる
3. Homeへ進むCTAを「みっけ」に接続する
4. その後、計測イベント設計へ進む

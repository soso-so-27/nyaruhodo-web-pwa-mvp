# BRAND-GUIDELINE.md — ねてるねこ ブランドガイドライン v0.9

作成日: 2026-07-07
状態: ドラフト。最終確定は中西レビュー後に v1.0 とする。

この文書は、新しい制作物（投稿、LP、資料、グッズ、プレス、外部向け説明）を作る人が最初に読む入口である。詳細な正典は各CANONに置き、本書は索引と、制作時に迷いやすい判断だけを持つ。

## 0. 棚卸サマリー

| 領域 | 原典 | 本書での扱い |
|---|---|---|
| 発信の声、語彙、禁止表現 | `docs/MARKETING-CANON.md` | 対外発信の主正典。声・語彙・禁止表現はここに従う |
| 旧マーケ規範 | `docs/marketing/MARKETING-CANON.md` | 旧版。ルート直下の v0.2 を優先する |
| UIの静けさ、紙とインク、優先順位 | `docs/design/DESIGN-CANON.md` | デザイン正典。UI・資料の視覚判断の起点 |
| 色・影・角丸・書体トークン | `docs/design/neteruneko-design-tokens-v2.md`, `src/app/tokens.css` | 実装値は `src/app/tokens.css` を正とする |
| ホームの現行方向 | `docs/design/neteruneko-design-brief.md` | ホームの旧StampPair復帰禁止など、現行体験の守り |
| 審査と写真価値観 | `docs/MODERATION-CANON.md` | 写真の思想、配達可否、AI生成疑いの扱い |
| LPの外向き説明 | `docs/lp-copy-v1.0.md` | フック、ないものの宣言、OG方針 |
| 事故時の声 | `docs/OPERATIONS-PLAYBOOK.md` | ユーザー対応の声。規約を武器にしない |
| 収益原則 | `docs/neteruneko-business-strategy-v1.2.md` | 原本を人質にしない、広告を成長レバーにしない |
| 作らないもの、ホーム/まいにち原則 | `docs/specs/neteruneko-home-mainichi-v1.md`, `docs/ROADMAP.md` | feed/ランキング/ストリーク等の禁止、進行ゲート |

## 1. 一文の定義

ねてるねこは、ねこを大切にするアプリである。

一文の憲法:

> ねてるねこは、静かなアプリである。宣伝もまた、静かでなければならない。

制作物の判断に迷ったら、次の問いに戻る。

- その表現は、自分の猫を見る時間を増やすか
- その表現は、よその猫を消費物にしていないか
- その表現は、急がせたり、比べさせたり、数を誇ったりしていないか
- その表現は、プロダクトの静けさを壊していないか

## 2. 名前

### 基本表記

- 公開ブランド名は `ねてるねこ`。ひらがな固定。
- 文章の中では、原則としてカギ括弧を付けずに `ねてるねこ` と書く。
- アプリ名を英字にする必要がある場合の暫定表記は `neteruneko`。これは現行のファイル名、storage key、設計文書で使われている実態に合わせたもの。

### 旧名・技術名

- `にゃるほど` は旧プロダクト/旧設計文脈。現行ブランドのコピーには使わない。
- `nyaruhodo` は現在もリポジトリ名、Vercel URL、Supabase project、`nyaruhodo.jp` ドメインに残る技術・URL上の識別子。ブランド表記としては使わない。
- ドメインを示すときは `nyaruhodo.jp` のようにURLとして扱い、ブランド名の代替にしない。

### 未確定

- 英字ロゴや海外向け表記として `neteruneko` を正式採用するかは未確定。現時点では内部slugとして扱う。
- `ニャるほど` 表記は今回の棚卸では現行原典に見当たらず、旧名としても `にゃるほど` 表記が多い。

## 3. 声（Voice）

原典: `docs/MARKETING-CANON.md` §1。

ねてるねこの声は、宣言ではなく打ち明けである。主語は大きな会社ではなく、私、中西、あめとむぎの生活に近いところから出る。

守ること:

- 煽らない
- 数字を誇示しない
- broadcastしない
- 約束しすぎない
- 打ち明ける

### らしい一文 / らしくない一文

| らしい | らしくない |
|---|---|
| ねている姿を、一日一枚だけ置いておくアプリを作っています。 | 毎日投稿で猫好きとつながれる新感覚SNSです。 |
| よる8時に、一通だけ、どこかのねこがとどきます。 | 今すぐ登録して、限定配信を見逃さないでください。 |
| うまく撮れた日も、少しぶれた日も、暮らしのまま残します。 | 最高にかわいい写真だけを厳選してシェアできます。 |

## 4. 語彙

原典: `docs/MARKETING-CANON.md` §2、`docs/specs/neteruneko-home-mainichi-v1.md` §1。

| 使う | 避ける |
|---|---|
| ねがお | 寝顔写真、スリーピングショット |
| ねがおを とる | 撮影する、アップする、投稿する |
| ねこだより | 通知、配信、フィード |
| ひらく | 開封する、チェックする |
| とどく | 配信される、プッシュされる |
| おくった / とどいた | 送信済み / 受信済み |
| まいにち | フィード、タイムライン |
| うちのこ | ペットプロフィール、猫一覧 |

### ひらがなの使い方

- 体験の中心に近い動詞は開く: `とる`, `ひらく`, `とどく`, `のこす`。
- 法務、設定、管理画面では読みやすさを優先し、無理にひらがな化しない。
- `ねてるねこ` 画面は静かなひらがな寄りの例外としてよいが、診断、法律、支払い、削除は明確さを優先する。
- 「毎日」は頻度の押しつけに見えやすい。外向きには「一日一枚」を優先する。

## 5. 色と紙

原典: `docs/design/DESIGN-CANON.md`, `docs/design/neteruneko-design-tokens-v2.md`。実装値は `src/app/tokens.css` を正とする。

| token | 現行値 | 用途 |
|---|---|---|
| `--paper` | `#fbfaf7` | 紙の基底 |
| `--paper-warm` | `#f4f1ea` | 紙の温度、背景下地 |
| `--paper-card` | `#f1efe9` | カード・面 |
| `--ink` | `#3f3a33` | 主文字 |
| `--ink-soft` | `#8a847a` | 補助文字 |
| `--ink-faint` | `#b8b2a6` | さらに薄い文字 |
| `--line` | `#e3dfd5` | 線 |
| `--line-strong` | `#cfc7b9` | 強めの線 |
| `--seal` | `#a8584e` | 封蝋点、破壊的操作、強い注意の文字 |
| `--seal-soft` | `#d8a99b` | 封蝋の補助 |
| `--danger` | `#9e4a43` | 削除・危険系 |

### 用途

- UIの面は紙系で作る。色は写真が運ぶ。
- `--seal` は意味のある小さな印に使う。封蝋の点、未開封のしるし、危険/削除系の文字が主用途。
- `--seal` を塗りの主役にすると、世界が急に広告的・ゲーム的になるため避ける。
- 背景は `--app-paper-background` と `paper-grain-tile.webp` の紙質感を正とする。グラデーション単体では紙にしない。

## 6. 文字

原典: `docs/design/DESIGN-CANON.md`, `docs/design/neteruneko-design-tokens-v2.md`, `src/app/layout.tsx`, `src/app/tokens.css`。

現行実装:

- 表示用: `--font-display: var(--font-klee-one), "Klee One", sans-serif`
- UI本文: `--font-ui: var(--font-zen-kaku), "Zen Kaku Gothic New", -apple-system, "Hiragino Sans", sans-serif`
- 汎用sans: `--font-sans: -apple-system, "Hiragino Sans", sans-serif`
- local font: `klee-one-400/600-subset.woff2`, `zen-kaku-gothic-new-400/500-subset.woff2`

使い分け:

- 見出し、日付、短いラベル、封筒まわりの言葉は `--font-display` を使う。
- 設定、法務、説明文、管理画面は `--font-ui` を使う。
- 数字は誇示しない。必要な数値は情報として静かに置く。
- 太字で押さない。間、余白、字間、紙面の位置で強弱を作る。

注意:

- `docs/design/DESIGN-CANON.md` と `docs/design/neteruneko-design-tokens-v2.md` は「明朝+字間」を原則としているが、現行実装は `Klee One` と `Zen Kaku Gothic New` に寄っている。これは矛盾リストに残す。

## 7. 意匠モチーフ

### 封筒

封筒は、夜8時に一通だけとどく体験の器である。ホーム、オンボーディング、LP、PWAアイコンで使ってよい。

避けること:

- すべてのカードを封筒化する
- 常時通知や未読の圧にする
- 開封済みのものを通知カードに戻す

### 封蝋

封蝋色の点は「未開封のものがある」しるしである。数字、NEW、バッジに置き換えない。

避けること:

- 数字付きバッジ
- 目立たせるための赤丸化
- 重要でない飾りとしての乱用

### 和紙・紙

紙は背景であり、静けさである。飾りの模様ではなく、写真と文字を受ける地として使う。

### 消印

消印は現在、思い出便など一部specに残る語彙である。現行の主要ブランドモチーフとしては封筒・封蝋・紙を優先し、消印を広げる場合は個別レビューを必要とする。

### 切手

切手は有料/コスメティックや過去specに残る語彙だが、現行ホームの主導線では使わない。`StampPair` 復帰禁止は `docs/design/neteruneko-design-brief.md` のHard Noに従う。

## 8. 写真の思想

原典: `docs/MODERATION-CANON.md`, `docs/lp-copy-v1.0.md`, `docs/photo-domain-inventory.md`。

- 主役は実在の猫である。
- AI生成の疑いが強いものは配達対象にしない。
- 生活感、多少のブレ、暗さ、構図の乱れは味である。品評しない。
- 人の顔、個人情報、病気や怪我の不安、死を想起する要素は、受け取る一通として扱わない。
- 写真は売らない。広告素材にも使わない。宣伝・広報利用は個別同意が必要。
- OG画像や対外素材では、文脈なく一匹を代表にしない。封筒・封蝋・紙の意匠を優先する。
- 届いた写真を物販化しない。物販はうちのこ側の生成物に限る。

## 9. してはいけないこと

詳細は原典を参照する。本書では索引として列挙する。

### 発信・コピー

原典: `docs/MARKETING-CANON.md` §3。

- 緊急性、限定性、カウントダウンで急がせる
- フォロワー数、DL数、ランキング、再生数を誇示する
- 拡散、シェア、フォロー、いいねを依頼する
- 一生、最期、見送る、虹の橋など死を想起させる語を使う
- ストリーク、ポイント、ランクなどゲーム化の語を使う
- 絵文字を原則として使う
- 報酬型リファラルを想起させる

### プロダクト・体験

原典: `docs/specs/neteruneko-home-mainichi-v1.md`, `docs/design/DESIGN-CANON.md`, `docs/neteruneko-business-strategy-v1.2.md`。

- feed、フォロワー、ランキング、ストリーク、各種カウントを作る
- ホームをアルバムコラージュに戻す
- 開封済みねこだよりを通知カードに残す
- 原本を人質にする
- 減額保管プランを作る
- 広告を成長レバーにする
- 写真を売る、データを売る
- おわかれに商売を置く

### 視覚

原典: `docs/design/DESIGN-CANON.md`, `docs/design/neteruneko-design-tokens-v2.md`。

- UIの面を有彩色で塗る
- `--seal` を汎用アクセント色にする
- NEW、数字バッジ、派手な通知記号を使う
- 写真に過度な色補正やティントをかける
- 動きを内容そのものにする

## 10. 適用範囲と優先順位

本書は入口であり、最終正典ではない。詳細判断は以下を優先する。

1. 中西の明示判断
2. `docs/design/DESIGN-CANON.md`
3. `docs/MARKETING-CANON.md`
4. `docs/MODERATION-CANON.md`
5. `docs/OPERATIONS-PLAYBOOK.md`
6. `docs/neteruneko-business-strategy-v1.2.md`
7. `src/app/tokens.css`（実装上の色・書体・背景の現値）
8. focused spec / STATUS / ROADMAP
9. 旧 `にゃるほど` 系文書（参考のみ。現行ブランドを上書きしない）

改訂権限は中西のみ。制作物を作る人は、本書にない判断を新しく発明せず、必要なら矛盾・未決として記録する。

## 11. 矛盾・表記ゆれ（未修正）

今回の棚卸で見つけたもの。ここでは直さない。

1. `Shippori Mincho` という要求・会話上の前提に対し、現行実装は `Klee One` と `Zen Kaku Gothic New`。一方、`docs/design/DESIGN-CANON.md` と `docs/design/neteruneko-design-tokens-v2.md` は「明朝+字間」を原則としている。
2. `docs/design/neteruneko-design-tokens-v2.md` は `--font-serif` を定義しているが、現行 `src/app/tokens.css` には `--font-serif` がなく、実装側に一部 `var(--font-serif)` 参照が残る。
3. `--seal` は「点と文字だけ。面に塗らない」とされるが、実装内には `background: var(--seal)` や `color-mix(... var(--seal) ...)` の面利用が複数残る。
4. `docs/specs/neteruneko-home-mainichi-v1.md` は「手紙」という語を使わないとする一方、`docs/lp-copy-v1.0.md` では「一通」「封筒」文脈で手紙メタファーに近い説明を使う。現行の外向き語彙としては `ねこだより` と `一通` を優先する。
5. `docs/marketing/MARKETING-CANON.md` v0.1 と `docs/MARKETING-CANON.md` v0.2 が併存している。v0.2を優先するが、旧版が検索に引っかかる。
6. `にゃるほど` 系文書、`nyaruhodo` 系技術識別子、`ねてるねこ` ブランドが併存している。外向きブランドは `ねてるねこ` に固定する。
7. `FEATURE-IDEAS` というファイル名は今回の棚卸では見つからなかった。近い役割は `docs/ROADMAP.md`, `docs/decisions.md`, `docs/specs/neteruneko-home-mainichi-v1.md`, `docs/neteruneko-business-strategy-v1.2.md` に分散している。

## 12. 中西判断が必要な未決

1. 英字表記 `neteruneko` を公開ブランドとして正式採用するか、内部slugに留めるか。
2. `nyaruhodo.jp` とブランド名 `ねてるねこ` の関係を、外部資料でどう説明するか。
3. 明朝原則を復活させるのか、現行の `Klee One` をブランド書体として確定するのか。
4. `--seal` の面利用を全面禁止に戻すのか、CTAなどの例外をCANON化するのか。
5. `FEATURE-IDEAS` 相当の「作らないものリスト」をどのファイルに一本化するか。

---

改訂履歴:

- v0.9 (2026-07-07): 既存CANON、design docs、LP、運用、事業方針、実装トークンの棚卸から初版ドラフトを作成。

# Envelope Reveal Audit

Date: 2026-06-28

Scope: ねこだよりの封筒到着から開封、写真表示、とどいた保存まで。対象は主に初回オンボーディングの即時ねこだよりと、ホームの夜8時ねこだより。

## 対象ファイル

- `src/components/onboarding/OnboardingFlow.tsx`
  - 初回オンボーディングの写真送信、即時ねこだより到着、封筒表示、開封、アルバム保存。
- `src/components/home/HomeDeskModel.tsx`
  - ホーム上の夜8時ねこだより到着UI、封筒開封モーション、開封中の写真DOM表示。
- `src/components/home/HomeEnvelopeMotionArt.tsx`
  - ホーム用の封筒レイヤーアニメーション。Motion for Reactを使用。
- `src/components/home/homeEnvelopeMotionConfig.ts`
  - ホーム用封筒開封時間。現在 `HOME_ENVELOPE_OPEN_MS = 2200`。
- `src/components/home/HomeInput.tsx`
  - 夜8時ねこだよりを開いた後の保存、イベント計測、開封後オーバーレイ。
- `src/components/ui/StoredPhotoImage.tsx`
  - signed URL取得、画像fallback、画像load計測、signed URL再取得。
- `src/components/ui/PhotoTile.tsx`
  - 写真ボード/カード向けの `StoredPhotoImage` ラッパー。
- `src/app/api/photo-storage/signed-url/route.ts`
  - private storageの短命signed URL発行。匿名/ログイン状態の認可を確認。
- `src/lib/home/eveningDelivery.ts`
  - 夜8時ねこだよりのlocalStorage状態、opened/kept/delivered管理。
- `src/lib/home/useEveningDelivery.ts`
  - 20時到達、focus、visibilitychange、pageshowなどで配送確認。
- `src/lib/onboarding/progress.ts`
  - オンボーディングの状態復元。`submitted` / `arrived` / `opened` / `album_created`。
- `src/app/api/admin/analytics/route.ts`
  - 管理画面で拾うKPIイベント。

## A. 現在の状態遷移

### オンボーディング即時ねこだより

| 状態 | UI state / progress | 依存先 | 内容 |
| --- | --- | --- | --- |
| 到着前 | `intro` | URL `source`、`readCurrentOnboardingProgress()`、`localStorage` | 初回説明と写真選択CTA。`source`は計測用で、状態復元には使わない。 |
| 写真送信済み / 準備中 | `saving` + progress `submitted` | `saveSleepingPhotoWithFallback()`、`createSleepingExchange()`、`submissionId`、匿名ID、日付キー | 自分のねがおを保存し、即時ねこだより候補を取得。重複送信は `isSubmittingRef` と `submissionId` で抑制。 |
| 到着済み | `envelope` + progress `arrived` | `deliveredPhoto`、`setEveningDeliveredPhoto(dateKey, photo)`、`patchOnboardingProgress()` | 封筒と「ねこだよりを開く」ボタンを表示。写真本体はこの時点で `deliveredPhoto` として保持。 |
| 開封中 | `revealing` | `handleOpenEnvelope()` の `setTimeout(1400)`、`PhotoTile` | 開封ボタン後に写真フレームを表示。封筒の物理的なフラップ/カード分解はなく、1.4秒待って次状態へ移る。 |
| 開封済み | `delivered` + progress `opened` | `markEveningDeliveryOpened()`、`keepDeliveredPhotoForOnboarding()` | 届いた写真と自分の写真を並べる。`delivered` stateに入ると自動でアルバム保存を試みる。 |
| 写真読み込み中 | `PhotoTile` / `StoredPhotoImage` 内部状態 | signed URL API、fallback source queue | signed URL取得中は空フレーム/ぼかし状態。ロード成功で `image_load_completed`。 |
| 写真読み込み失敗 | `StoredPhotoImage` の `hasError` | signed URL retry、fallbackSrcs | signed URLを最大2回取り直し、それでも失敗したらfallback sourceへ進む。最終失敗時はメッセージfallback。 |
| とどいた保存済み | `isDeliveredPhotoKept = true` + progress `opened` | `keepExchangePhotoForAlbum()`、`keepExchangePhoto()`、`markEveningDeliveryKept()` | 届いたねこだよりを後から見返せるように保存。 |

### ホーム夜8時ねこだより

| 状態 | UI state | 依存先 | 内容 |
| --- | --- | --- | --- |
| 到着前 | `EveningHomeState.kind = "before"` | `readEveningDeliveryStore()`、JST date key | 今日のねがおがない、または20時前で対象がない状態。 |
| 待機中 | `kind = "waiting"` | `targetPhoto`、`recordEveningDeliveryTarget()` | 20時前に今日のねがおを入れている。待機文言を表示。 |
| 到着確認中 | `deliveryCheckState.state = "checking"` | `useEveningDelivery()` | app open / focus / visibilitychange / pageshow / 20時到達 / retryで `ensure`。 |
| 到着済み | `kind = "delivered"` | `setEveningDeliveredPhoto()` | ホーム上に封筒CTAを表示。 |
| 開封中 | `isEnvelopeOpening = true` | `HomeEnvelopeMotionArt`、CSS keyframes、`ENVELOPE_OPEN_MS` | 2200msの開封モーション。終了後に `onOpenDelivery()`。 |
| 開封済み | `kind = "opened"` + `openingEveningDelivery` overlay | `markEveningDeliveryKept()`、`keepExchangePhoto()` | 開封後オーバーレイで届いた写真を表示し、コレクションにも保存。 |
| 写真読み込み中/失敗 | `StoredPhotoImage` | `/api/photo-storage/signed-url` | signed URL取得、retry、fallbackを共通処理。 |

## B. 現在のアニメーション実装

### オンボーディング

- 実装: React state + CSS/inline style。Riveは未使用。
- 封筒: `OnboardingEnvelopeArt` の静的画像 `/illustrations/onboarding-envelope.png`。
- 開封処理:
  - `handleOpenEnvelope()` で `envelope_opened` と `onboarding_delivery_opened` を記録。
  - progressを `opened` にpatch。
  - `setState("revealing")`。
  - `1400ms` 後に `setState("delivered")`。
- レイヤー構造:
  - 封筒、フラップ、カード、写真は分離されていない。
  - 開封中は封筒が物理的に開くというより、写真フレーム状態へ切り替える。
- 押下反応:
  - ボタン押下で即stateは変わる。
  - ただし開封ボタン専用のdisabled/aria-busy/ref guardは見当たらない。
- 連打:
  - `handleOpenEnvelope()` 自体は `deliveredPhoto` 存在だけを見る。
  - React state変更後はボタンが消えるため大きく壊れにくいが、同一tickの連打に強い設計ではない。
- reduced motion:
  - 明示的な `prefers-reduced-motion` 分岐は見当たらない。

### ホーム夜8時便

- 実装: Motion for React + CSS keyframes。
- 封筒: `HomeEnvelopeMotionArt` がPNGレイヤーを重ねる。
  - shadow
  - back inner panel
  - photo card placeholder
  - open front pocket
  - top flap
  - closed envelope body
  - inner glow
  - wax seal intact / left / right / crumbs
  - paper motes
- 実写真:
  - Rive/画像アート内部ではなく、DOMの `StoredPhotoImage` を `data-develop-photo` レイヤーとして別表示。
  - 方針としては良いが、封筒アート内のplaceholderカードとDOM写真の主役化が少し二重になっている。
- duration:
  - `HOME_ENVELOPE_OPEN_MS = 2200`。
  - 目標の900〜1200msよりかなり長い。
- easing:
  - Motion: `[0.18, 0.92, 0.2, 1]` / `[0.24, 0.88, 0.32, 1]`
  - CSS: `cubic-bezier(0.18, 0.92, 0.2, 1)` など。
- 押下反応:
  - `.desk-envelope-home:active` で沈む反応あり。
  - `openDeliveredLetter()` は `isOpeningEnvelopeRef` で連打を抑制。
- reduced motion:
  - `usePrefersReducedMotion()` があり、reduce時は即 `onOpenDelivery()`。
  - `MotionConfig reducedMotion="user"` とCSS `@media (prefers-reduced-motion: reduce)` もあり。

## C. 画像読み込みとの関係

- 共通表示は `StoredPhotoImage`。
- signed URLは `/api/photo-storage/signed-url` から取得。
- signed URLは `DISPLAY_SIGNED_URL_SECONDS = 60 * 10` の短命URL。
- `StoredPhotoImage` はメモリ上の `signedUrlCache` / `signedUrlPromiseCache` を使い、5分の安全余白を引いて再取得する。
- img `onError` 時は、storage pathごとに最大2回signed URLを取り直す。
- fallback順:
  - オンボーディング: `displaySrc -> thumbnailSrc -> originalSrc -> src`
  - ホーム/コレクション: `getPhotoDetailSrc()` + `getPhotoFallbackSrcs()` で display/thumbnail/original/src 系を補完。
- 開封ボタン前に画像が必ずdecode済みか:
  - オンボーディング: いいえ。`envelope` stateでは写真を事前にDOM mountしていない。
  - ホーム: `usesEnvelopeHome` の場合、`deliveredPhoto && (developPhotoMounted || usesEnvelopeHome)` により、開封前からDOM上にpreload相当で写真が存在しうる。ただし「画像が読み込めたら開封開始」ではなく、演出とロードは完全には同期していない。
- 画像取得失敗時:
  - 直近修正によりsigned URL再取得とfallbackは改善済み。
  - ただし開封演出自体は失敗を待たないため、演出後にfallback表示へ落ちる可能性は残る。

## D. 計測

### 現在取れている主なイベント

- `envelope_shown`
  - オンボーディング到着時、ホーム開封オーバーレイ表示時。
- `envelope_opened`
  - オンボーディング開封ボタン押下、ホーム夜便開封。
- `onboarding_delivery_opened`
  - オンボーディングのねこだより開封。
- `delivery_opened`
  - ホーム夜便のねこだより開封。
- `onboarding_delivery_ready`
- `onboarding_delivery_arrived`
- `onboarding_sleeping_photo_delivered`
- `image_load_completed`
  - `StoredPhotoImage` の画像load成功。source kindとelapsed_msのみ。
- `photo_upload_error`
- `evening_delivery_check_started/succeeded/failed/timeout`
  - 夜8時配送確認。

### 足りない可能性があるイベント

- `delivery_reveal_started`
  - 開封演出開始。オンボーディング/ホーム共通で見たい。
- `delivery_reveal_completed`
  - 演出完了。duration実測も見たい。
- `delivery_reveal_photo_loaded`
  - 開封演出に使う主写真が表示可能になった時点。
- `delivery_reveal_photo_error`
  - 開封中/開封直後の主写真失敗。
- `delivery_reveal_skipped`
  - reduced motionや復元で演出を飛ばした場合。

現状の `image_load_completed` は汎用画像イベントなので、「開封体験の主写真が間に合ったか」は切り出して見づらいです。

## 欠点一覧

### P0

現時点で即時修正が必要なP0は見つかっていません。

- 開封ボタン連打はホーム側では `isOpeningEnvelopeRef` で抑制済み。
- signed URL期限切れ/失敗時の再取得は `StoredPhotoImage` 側で最大2回入っている。
- display/thumbnail/original/src fallbackは主要導線で入っている。

ただし、オンボーディング側の開封ボタンはホームほど明示的な連打guardがないため、P1として改善候補です。

### P1

1. ホーム開封時間が長い
   - 現在2200ms。目標の900〜1200msより長い。
   - 毎日見る体験としては「待たされている」感が出やすい。

2. オンボーディング開封は封筒体験として弱い
   - 静的封筒画像から写真フレームへ切り替えるだけに近い。
   - 「届いた」「開けた」「写真が出た」の差は文言に依存している。

3. 開封演出と画像ロードが分離しきれていない
   - 写真が表示可能な状態かどうかを待たずに開封が始まる。
   - Instagram内ブラウザでsigned URL取得が遅い時、演出後にfallbackが見えるリスクがある。

4. ホームのレイヤーが少し過多
   - 封筒レイヤー、placeholderカード、DOM写真、CSS keyframes、Motion keyframesが重なっている。
   - 体験の主役が「猫写真」より「封筒アニメーション」に寄る可能性がある。

5. reveal専用計測がない
   - 開封開始、演出完了、主写真load/errorが別イベントで見えない。
   - 改善後の体感差を数字で比較しづらい。

6. オンボーディング開封ボタンの押下中状態が薄い
   - disabled/aria-busy/ref guardが明確ではない。
   - 連打で大きく壊れにくいが、設計としては弱い。

### P2

1. reduced motionの体験差
   - ホームは対応あり。オンボーディングは明示対応が薄い。
   - reduce時に何を見せるかの仕様が未整理。

2. イベント命名が分散している
   - `envelope_opened`、`delivery_opened`、`onboarding_delivery_opened` が併存。
   - funnelには十分だが、開封演出改善のA/B比較には粒度不足。

3. 開封後の保存処理と演出完了が密結合気味
   - オンボーディングは `delivered` stateに入ると自動保存。
   - 体験上は自然だが、演出/保存/表示の失敗を個別に扱いにくい。

4. 世界観の細部
   - ホームは蝋が割れる、crumbs、motes、glowがあり、少し演出成分が多い。
   - 派手ではないが、「静か・余白・紙っぽい」方向に寄せるなら少し減らす余地がある。

## 理想仕様案

### 案A: 最小改善

内容:
- ホーム開封時間を1100〜1200msへ短縮。
- オンボーディング開封ボタンに `isOpening` guard、disabled、aria-busyを追加。
- 開封開始前に `StoredPhotoImage` を非表示/低opacityでmountしてsigned URLを先に取りに行く。
- reveal専用イベントを追加。
- fallbackはメッセージ直出しではなく、写真カードの紙placeholderを維持しつつthumbnail fallbackを優先。

評価:
- 実装難易度: 低
- 体験改善効果: 中
- 既存実装への影響: 低
- リスク: 低
- おすすめ度: 高

向いている状況:
- Instagram公開直後に、安全に「遅い/反応が弱い/写真が出ない感」を減らしたい場合。

### 案B: レイヤー改善

内容:
- 封筒、フラップ、白いカード、写真カードをDOM/CSSまたはMotion for Reactで明確にレイヤー分けする。
- 実写真はRive等に入れず、DOMの `StoredPhotoImage` として表示。
- タイムライン:
  - 0〜120ms: 封筒が少し沈む
  - 120〜420ms: フラップが開く
  - 360〜760ms: 中の白いカードが上にすべる
  - 650〜950ms: 写真がふわっと表示される
  - 950〜1100ms: 封筒が少し下がり、写真カードが主役になる
- オンボーディングとホームで同じRevealコンポーネントを使う。

評価:
- 実装難易度: 中
- 体験改善効果: 高
- 既存実装への影響: 中
- リスク: 中
- おすすめ度: 最も高い

向いている状況:
- 「ねこだよりを開ける」体験をアプリの核にしたい場合。
- Riveに依存せず、実写真ロード/fallback/計測を壊さずにリッチ化したい場合。

### 案C: Rive等を使う可能性

内容:
- Riveの役割は封筒線画、紙のフラップ、蝋封、柔らかい影までに限定する。
- 実写真はRive内部に入れず、DOMの `StoredPhotoImage` を上に重ねる。
- Rive state machineは `open` trigger程度にし、完了タイミングはDOM側でもtimeout/fallbackを持つ。
- Riveが読めない場合は案BのCSS/Motion実装にfallbackする。

評価:
- 実装難易度: 高
- 体験改善効果: 中〜高
- 既存実装への影響: 中〜高
- リスク: 高
- おすすめ度: 中

リスク:
- 過去のRive editor / agent操作で品質と再現性に課題が出ている。
- asset品質、runtime同期、fallback、テストが増える。
- 実写真をDOMに置く前提では、Rive単体で完結しない。

向いている状況:
- 封筒の紙質やフラップの細かい動きを、デザイナーがRiveで安定して管理できる状態になった後。

## 推奨方針

短期は案A、中期は案Bが良いです。

理由:
- 現在の一番大きな欠点は「写真ロードと開封演出の同期不足」と「ホーム開封2200msの長さ」です。
- これはRive導入より先に、DOM/Motion側の責務整理で改善できます。
- ねてるねこの世界観では、派手な演出より、押した瞬間の小さな反応、紙のめくれ、写真が主役になる速度の方が重要です。

## 今回すぐ直した箇所

なし。

P0は見つからなかったため、今回は棚卸ドキュメント作成のみに留めました。大幅改修、Rive導入、レイアウト変更、画像保存方式変更、signed URL認可方式変更は行っていません。

## 次にやるなら

1. `delivery_reveal_started/completed/photo_loaded/photo_error/skipped` を追加。
2. ホームの `HOME_ENVELOPE_OPEN_MS` を 1100〜1200msに短縮する試作。
3. オンボーディングに開封中guardとreduced motion分岐を追加。
4. `RevealPhoto` を先にmountして写真がready/fallbackableな状態で開封を始める。
5. 案Bの共通 `EnvelopeReveal` コンポーネントを試作し、オンボーディングとホームで統一する。

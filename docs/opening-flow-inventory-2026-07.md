# 開封まわり実装棚卸 2026-07

作成日: 2026-07-05  
範囲: ホーム「きょう」の20時前後、ねこだより到着、ひらく、開封後表示。  
制約: コード変更・削除なし。調査とこのドキュメント追加のみ。

## 0. 一言診断

現状の開封体験は「機能するが、開封セレモニーはほぼ無音に近い」。20時到着とタップ開封は成立しているが、過去に設計された長押し/封筒レイヤー/現像モーションは本番経路から外れ、現在は大きな封筒画像が短く消えて単写真オーバーレイへ移る。

## 1. 20時をまたぐ瞬間

### 実装の入口

- `src/components/home/HomeInput.tsx:393-428` がホームの時計 `tick` を更新する。通常は30秒間隔、19:58-20:01 JSTのみ1秒間隔になる。高解像度条件は `src/components/home/HomeInput.tsx:5361-5370`。
- `src/components/home/HomeInput.tsx:810-827` が `useEveningDelivery()` と `buildEveningHomeState()` をつなぎ、`eveningDelivery.refreshToken` と `homeNow` が変わるとホーム状態を再計算する。
- `src/lib/home/useEveningDelivery.ts:335-383` が到着確認のトリガーを持つ。`app_open`、`focus`、`pageshow`、`visibilitychange`、`state_change`、20時到達タイマー、手動retryで `ensureEveningDelivery()` を呼ぶ。
- `src/lib/home/useEveningDelivery.ts:371-380` の `getNextEveningDeliveryCheckDelay()` タイマーが、未配達の対象日について20:00 JST + 60msに `delivery_time_reached` を発火する。
- `src/lib/home/useEveningDelivery.ts:65-76` と `src/lib/home/eveningDelivery.ts:357-369` が「targetOwnPhotoIdあり、deliveredPhotoなし、skippedAtなし、now >= getJstDeliveryTime(dateKey)」を pending delivery とみなす。
- `src/lib/home/useEveningDelivery.ts:288-306` が交換成功時に `setEveningDeliveredPhoto()`、badge設定、refresh token更新、`delivery_sent` 計測を行う。
- `src/lib/home/eveningDelivery.ts:135-170` が `deliveredPhoto` と `deliveredAt` を localStorage store に保存し、`neteruneko_evening_delivery_updated` を dispatch する。

### 画面を開いたまま20時を迎える場合

20時前に対象写真が記録済みなら `waiting` のまま表示される。19:58-20:01は時計が1秒間隔で進み、別途 `useEveningDelivery` の20:00 + 60msタイマーで配送確認が走る。交換APIが成功すると localStorage に `deliveredPhoto` が入り、`refreshToken` と storage update event 経由で `EveningHomeState.kind = "delivered"` になり、ホームは状態3の封筒CTAへ切り替わる。

リアルタイム購読や常時ポーリングはない。20時ちょうどの画面変化は、クライアントタイマー + 交換API + localStorage更新で成立している。

### 20時以降に開いた場合

`useEveningDelivery()` の mount 時 `app_open`、および `state_change` effect が即時に `ensureEveningDelivery()` を走らせる。pending day があれば、同じ交換APIを経て `delivered` へ進む。すでに localStorage に `deliveredPhoto` がある場合は、`buildEveningHomeState()` が `findLatestVisibleDeliveredDay()` を通して即 `delivered` または `opened` を返す。

差として、開きっぱなしの場合は20:00直後に「少し時間がかかっています」などの checkStatus 表示を挟む可能性がある。20時以降の再訪では初期表示から即時判定されるため、交換が済んでいれば最初から到着済み、未交換なら起動直後の短い確認を経て到着済みに変わる。

### 5時自動開封

`src/lib/home/eveningDelivery.ts:209-233` が翌朝5:00 JST以降の未開封配送を `openedBy: "system"` として自動開封する。`buildEveningHomeState()` の先頭で呼ばれるため、朝5時以降に再訪すると未開封CTAではなく開封済み扱いになる。

## 2. ひらく操作

### 現在の操作

現行操作はタップ/クリック。長押しではない。

- `src/components/home/HomeDeskModel.tsx:359-399` の `openDeliveredLetter()` が開封処理本体。
- `src/components/home/HomeDeskModel.tsx:601-627` の `desk-open-letter` ボタンが `onClick={openDeliveredLetter}` を持つ。
- `src/components/home/HomeDeskModel.tsx:622-623` の className で開封中だけ `desk-letter-simple-opening` または `desk-letter-opening` が付く。
- `src/components/home/HomeDeskModel.tsx:626-627` には context menu 抑制のみあり、現行経路に `onPointerDown` / `onPointerUp` / `setPointerCapture` はない。
- `rg` 調査では本番 `src/components/home` に `setPointerCapture` は存在しない。長押しの pointer 実装は履歴と docs/design prototype に残るだけ。

### P0修正後と現在の差

過去の `09f4438 Fix desk home daylight and iOS opening hold` では、`setPointerCapture`、`preventDefault`、`stopPropagation`、`touchAction: none`、`developPhotoMounted` の遅延マウント、途中離脱時の rewind が入っていた。現行ファイルには以下だけが残る。

- `selectionLockedStage` の `userSelect: none`、`WebkitTouchCallout: none`、`touchAction: none` は `src/components/home/HomeDeskModel.tsx:632-640` や style 定義 `src/components/home/HomeDeskModel.tsx:2971-2990` 付近に残る。
- `developPhotoMounted` state は `src/components/home/HomeDeskModel.tsx:260` に残るが、simple reveal では `src/components/home/HomeDeskModel.tsx:380-382` の条件により通常マウントされない。
- `src/components/home/HomeDeskModel.tsx:677-712` の写真レイヤーは `!(usesEnvelopeHome && USE_SIMPLE_HOME_REVEAL)` で本番の封筒ホームから除外される。

## 3. ひらいた後の表示

### 状態遷移

- `src/components/home/homeEnvelopeMotionConfig.ts:1-3` は `HOME_ENVELOPE_OPEN_MS = 1150`、`HOME_REVEAL_MODE = "simple"`、`HOME_SIMPLE_REVEAL_COMMIT_MS = 180`。
- `src/components/home/HomeDeskModel.tsx:82-86` により、本番の `ENVELOPE_OPEN_MS` は180ms。
- タップ後、`delivery_reveal_started` を計測し、180ms後に `delivery_reveal_completed`、開封音リクエスト、`onOpenDelivery(eveningState)` が実行される。
- `src/components/home/HomeInput.tsx:1969-2001` の `handleOpenEveningDelivery()` が `setOpeningEveningDelivery(deliveryState)`、`keepExchangePhoto()`、`markEveningDeliveryKept()`、`envelope_opened`、`delivery_opened` を実行する。
- `markEveningDeliveryKept()` は `src/lib/home/eveningDelivery.ts:236-251` で `openedAt` と `keptAt` を同時に保存する。現行ホームでは `markEveningDeliveryOpened()` は直接使われない。

### 表示内容

ユーザー指示では「StampPair（自分のねがお大＋受信切手が右上に傾き）」とあるが、現行ホーム開封後オーバーレイは `StampPair` を使っていない。

- `src/components/ui/StampPair.tsx:34-148` に StampPair コンポーネントは存在する。大きい自分写真フレーム内の右上に `deliveredPhoto` stamp を `rotate(4deg)` で重ねる設計は `src/components/ui/StampPair.tsx:252-270`。
- ただし `rg "StampPair" src` では home/collection/cats からの利用は見つからず、定義のみ。
- 現行開封後表示は `src/components/home/HomeInput.tsx:3201-3252` の `EveningDeliveryOpening`。`state.deliveredPhoto` だけを単写真フレームで表示し、自分のねがお大 + 受信切手の組ではない。
- オーバーレイの表示アニメーションは `src/components/home/HomeInput.tsx:2502-2518` の `eveningOpeningOverlayIn` / `eveningOpeningStageIn` と、`src/components/home/HomeInput.tsx:7239-7246` の `exchangePhotoIn 360ms`。

### 写真が見える瞬間

simple reveal のため、封筒内に実写真はプリロード/現像表示されない。180ms後に全画面紙背景オーバーレイが出て、そこで `StoredPhotoImage` が表示される。写真自体には360msの fade/translate/軽いblur解除があるが、封筒から写真が出る連続運動ではない。

## 4. モーションの残骸

### 無効化/未使用に見えるもの

消してよさそうだが、この調査では消していない。

| 種別 | 場所 | 状態 |
| --- | --- | --- |
| 複層封筒モーション | `src/components/home/HomeEnvelopeMotionArt.tsx` | `HOME_REVEAL_MODE = "simple"` のため本番ホームでは表示されない。admin preview では利用あり。 |
| current reveal 用 CSS keyframes | `src/components/home/HomeDeskModel.tsx:968-984`, `1028-1139` | `desk-letter-opening` 用。simple 本番では通常付かない。 |
| develop photo layer | `src/components/home/HomeDeskModel.tsx:677-712`, `2689-2705`, `2971-2989` | simple 本番では条件でマウントされない。 |
| `developPhotoMounted` state | `src/components/home/HomeDeskModel.tsx:260`, `380-382` | simple 本番では基本 false のまま。 |
| `envelopeHomeArtOpen` style | `src/components/home/HomeDeskModel.tsx:2676-2682` | 現行JSXで利用箇所なし。 |
| `developPhotoRewinding` style | `src/components/home/HomeDeskModel.tsx:2981-2984` | 長押し中断用の名残。現行JSXでは利用箇所なし。 |
| `holdLabel` / `holdLabelActive` | `src/components/home/HomeDeskModel.tsx:2991-3002` | 長押し文言用の名残。現行JSXでは利用箇所なし。 |
| `arrivedLetterButton` | `src/components/home/HomeDeskModel.tsx:2942-2955` | 非 envelope home 分岐用。現行 `usesEnvelopeHome` は到着通知で true 固定に見えるため到達しにくい。 |
| Rive reference assets | `public/animations/reference/home-envelope-rive-*`, `public/animations/prototypes/*.riv` | 本番経路では未使用。handoff/admin/reference 用資産としては意味が残る。 |
| 旧監査docの古い数値 | `docs/envelope-reveal-audit.md:16`, `57`, `101` | `HOME_ENVELOPE_OPEN_MS = 2200` と記載。現行は1150ms、simple commitは180ms。 |

### 関連コミット要約

- `613d9c9 Refine beta readiness and nekodayori motion`: `docs/rich-motion-direction.md` を追加。Motion for Reactを主軸にし、Riveは素材品質/状態機械設計が先という方針、2600ms級の封筒開封タイムラインを定義。
- `09f4438 Fix desk home daylight and iOS opening hold`: 長押し開封を実装。`setPointerCapture`、pointer cancel/release、写真レイヤー遅延マウント、rewind、iOS向け選択抑制が入った。
- `0aba708 Refine home envelope delivery flow`: `HomeEnvelopeMotionArt.tsx` と12層PNG資産を追加し、Motion for React + CSS keyframes の複層封筒モーションへ移行。
- `accf97a Use simple home envelope reveal`: `HOME_REVEAL_MODE = "simple"` を追加し、本番ホームを静的封筒画像 + 短い fade out へ切り替え。複層モーションとDOM写真レイヤーは通常経路から外れた。
- `d7a587c` / `9884fa3` / `97517f6` / `7af0f47`: simple reveal の所要時間を短縮し、開封後オーバーレイのUI/タイミングを磨いた。現在は180ms commit + 360ms photo/stage in。

### 取りやめの技術的要因

コードとdocsから分かる範囲では、主因は「iPhone Safari/PWAで安全に成立させるにはレイヤー、pointer、画像ロード、状態遷移が重く複雑になりすぎたこと」。具体的には以下。

- 長押しは pointer capture、context menu抑制、selection抑制、touchAction、cancel/leave/rewind まで必要になり、iOS実機差分の影響を受けやすい。
- 複層封筒は Motion keyframes、CSS keyframes、PNG 12層、DOM実写真、placeholder card が重なり、実装面でも視覚面でも主役が猫写真から外れやすい。
- 開封演出と `StoredPhotoImage` の signed URL / fallback / decode は同期しておらず、演出後に写真が遅れて出るリスクが残る。
- `docs/rich-motion-direction.md` でも Rive/Lottie は素材品質と state machine 設計不足では失敗しやすいとされ、低スペック/iPhoneでは blur/filter を控える方針が記録されている。

## 5. spec乖離

| # | 種別 | spec / design | 現実装 | 根拠 |
| ---: | --- | --- | --- | --- |
| 1 | specにあるが実装にない | 開封は長押し。「おさえて ひらく」 | 現行はタップ/クリック | `docs/design/neteruneko-design-brief.md:20`, `src/components/home/HomeDeskModel.tsx:626` |
| 2 | specにあるが実装にない | おさえている間だけ写真が現像され、離すと閉じる | simple revealでは写真レイヤーをマウントしない | `docs/design/neteruneko-design-brief.md:20`, `src/components/home/HomeDeskModel.tsx:677-712` |
| 3 | specにあるが実装にない | state2の手紙が時刻に比例して満ちる | 現行は封筒静置 + 夕方コピー/背景変化。fillは削除済み | `docs/design/neteruneko-design-brief.md:43`, `09f4438` 差分 |
| 4 | specにあるが実装にある | 時間で暮れる背景 | 実装あり。`useDaylight` と背景画像切替 | `docs/design/neteruneko-design-brief.md:54`, `src/components/home/HomeDeskModel.tsx:1844-1881` |
| 5 | specにあるが実装に弱い | フル開封セレモニーは1日1回の到着時 | 到着時のみだが、現行は180msの簡略演出 | `docs/specs/neteruneko-home-mainichi-v1.md:75-77`, `src/components/home/homeEnvelopeMotionConfig.ts:1-3` |
| 6 | specにあるが実装にない | 開封後 state4 は2タイル等サイズ + どこかのこラベル | 開封直後は単写真オーバーレイ。ホーム背面は開封済み状態へ更新 | `docs/design/neteruneko-design-brief.md:45`, `src/components/home/HomeInput.tsx:3201-3252` |
| 7 | specにあるが実装にない | StampPair的な自分大 + 受信切手 | `StampPair` は定義のみでホーム開封後に未使用 | `src/components/ui/StampPair.tsx:34-148`, `rg "StampPair" src` |
| 8 | specにあるが実装と違う | Motion for React 2600ms封筒タイムライン | 本番は simple 180ms。Motion版はコンポーネント/admin previewに残存 | `docs/rich-motion-direction.md:63-72`, `src/components/home/homeEnvelopeMotionConfig.ts:1-3` |
| 9 | specにあるが実装に一部のみ | 写真カードは最初からDOMに存在させ開封後に実写真へつなぐ | current reveal用コードはあるが simple 本番では無効 | `docs/rich-motion-direction.md:95`, `src/components/home/HomeDeskModel.tsx:677-712` |
| 10 | 実装にあるがspecに薄い | 開封時に自動保存/kept扱い | タップ後即 `keepExchangePhoto()` と `markEveningDeliveryKept()` | `src/components/home/HomeInput.tsx:1969-1976` |
| 11 | 実装にあるがspecに薄い | app badge set/clear | 到着時 `setAppBadge(1)`、開封/kept/auto openでclear | `src/lib/home/useEveningDelivery.ts:288-289`, `src/lib/home/eveningDelivery.ts:190-191`, `236-251` |
| 12 | 実装にあるがspecに薄い | 配送確認ステータス checking/slow/failed/retry | 4秒slow判定と retry UI がある | `src/lib/home/useEveningDelivery.ts:52-56`, `134-164`, `src/components/home/HomeDeskModel.tsx:1778-1789` |
| 13 | 実装にあるがspecに薄い | 翌朝5時自動開封 | 仕様v1.3では現行維持対象だがホームspec本文には薄い | `docs/specs/spec-v1.3.md:27`, `src/lib/home/eveningDelivery.ts:209-233` |

## 6. 実機観察

物理 iPhone Safari/PWA での通し観察は、このCodex環境からは実施できなかった。スクリーンレコーディングも未取得。

代替として、Playwright mobile project で focused E2E を実行した。

```text
npx playwright test tests/e2e/home-desk-model.spec.ts -g "opens the delivered envelope after a tap animation" --project=mobile
結果: 1 passed
補足: ローカルSupabase未起動による 127.0.0.1:54321 fetch failed ログは出たが、対象テストはlocalStorage seedで開封体験を検証し成功。
```

観察できた事実は以下。

- 到着済み状態では `desk-open-letter` に静的封筒画像 `data-envelope-art="simple"` が表示され、Motion root は存在しない。
- タップ後250ms時点で封筒画像は消え、`evening-opening-pair` が表示される。
- 開封後オーバーレイには「ねこだより」見出し、届いた写真1枚、閉じるボタンが出る。テスト上は画像1要素を確認。
- 写真レイヤー `data-develop-photo="true"` は simple reveal では開封前後とも存在しない。

## 7. 消してよさそうな残骸リスト

消してよさそうだが、削除判断には admin preview / design handoff を使い続けるかの確認が必要。

- `src/components/home/HomeDeskModel.tsx` の `desk-letter-opening` 用 keyframes 一式。
- `src/components/home/HomeDeskModel.tsx` の `developPhotoMounted` と develop photo JSX/style。ただし current reveal 復活予定があるなら残す。
- `src/components/home/HomeDeskModel.tsx` の `developPhotoRewinding`、`holdLabel`、`holdLabelActive`。
- `src/components/home/HomeDeskModel.tsx` の `envelopeHomeArtOpen`。
- `src/components/home/HomeEnvelopeMotionArt.tsx` と `public/animations/reference/home-envelope-rive-layers-v2/`。ただし admin preview と将来再設計資料として残す価値はある。
- `docs/envelope-reveal-audit.md` の旧数値 `HOME_ENVELOPE_OPEN_MS = 2200` 記述。
- `docs/rich-motion-direction.md` の「現状2200ms」「2600msへ再調整」方針。履歴資料としては残せるが、現行仕様とは明確に違う。
- `src/components/ui/StampPair.tsx` は現行未使用に見えるが、再開設計で使う可能性が高いため削除候補というより「未接続コンポーネント」。

## 8. 設計再開に向けた足場

再設計で最初に決めるべき分岐は2つ。

1. 操作をタップのままにするか、長押しを復活するか。長押し復活なら pointer capture、iOS Safari、途中離脱、reduced motion、タップfallbackを仕様として先に固定する。
2. 開封後を `StampPair` に寄せるか、現行の単写真オーバーレイを磨くか。StampPairに戻すなら「自分のねがお大 + 受信切手」のDOMを開封前からどう準備するかが、写真ロード遅延とレイアウトシフト対策の中心になる。

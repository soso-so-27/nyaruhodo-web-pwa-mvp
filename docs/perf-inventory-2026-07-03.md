# Performance Inventory 2026-07-03

作成日: 2026-07-03
対象: `nyaruhodo-web-pwa-mvp`
目的: 写真パイプライン、描画、計測値の棚卸。製品コードは変更していない。

## 計測環境と前提

- OS: Windows / PowerShell / localhost `http://127.0.0.1:3000`
- Build: `npm run build` 実行済み。Next.js 16.2.9 / Turbopack。
- Server: `npm run start` を一時起動して Playwright / Lighthouse を実行。
- Playwright: iPhone 14 相当の viewport / UA。
- Lighthouse: `npx lighthouse@12.8.2`, mobile emulation, `--preset=perf`, `--throttling-method=simulate`。
- localStorage 実測: Codex/Playwright の localhost プロファイル上の実測。ユーザー本人の iPhone Safari / PWA 永続データではない。
- Performance タブ切替: Chrome DevTools Protocol の `Emulation.setCPUThrottlingRate(4)` と `Performance.getMetrics().ScriptDuration` で計測。

## A. 写真パイプラインの実態

### A-1. localStorage内の写真保存形態

Playwright の実測プロファイルで `/home` -> `/collection` -> `/cats` を開いた後の localStorage。

| key | bytes | data URL count | storage ref count | signed URL count |
| --- | ---: | ---: | ---: | ---: |
| `analytics_event_queue` | 7,478 | 0 | 0 | 0 |
| `cat_profiles` | 130 | 0 | 0 | 0 |
| `analytics_session` | 72 | 0 | 0 | 0 |
| `analytics_anonymous_id` | 36 | 0 | 0 | 0 |
| `active_cat_id` | 25 | 0 | 0 | 0 |
| `neteruneko_home_desk_state_shown:2026-07-03:1` | 1 | 0 | 0 | 0 |
| **合計** | **7,742** | **0** | **0** | **0** |

実データ上の補足:

- 新規の `catGalleryPhotos` は `id / catId / src / createdAt` のみを保持する。根拠: `src/lib/cats/catGalleryPhotos.ts:3-10`, `src/lib/cats/catGalleryPhotos.ts:29-44`。
- `catGalleryPhotos` の localStorage key は `neteruneko_cat_gallery_photos`。根拠: `src/lib/storage/keys.ts:9`。
- `ownSleepingPhotos` の localStorage key は `nyaruhodo_exchange_own_sleeping_photos`。根拠: `src/lib/home/sleepingPhotos.ts:134-135`。
- signed URL は `normalizePersistentPhotoSrc()` で永続保存から落とす。根拠: `src/lib/photoStorage.ts:55-77`。
- 既存 legacy 経路では `keptExchangePhotos` に data URL fallback を書くコードが残る。根拠: `src/lib/home/sleepingPhotos.ts:676-678`。

### A-2. 撮影時処理

| 系統 | 生成物 | サイズ / quality | 形式 | EXIF |
| --- | --- | --- | --- | --- |
| `ownSleepingPhotos` / ねがお | thumbnail | 長辺 512px / quality 0.72 | WebP | canvas 再エンコードで落ちる |
| `ownSleepingPhotos` / ねがお | display | 長辺 2048px / quality 0.84 | WebP | canvas 再エンコードで落ちる |
| `ownSleepingPhotos` / ねがお | exchange fallback | display が 1,900,000 chars 以下なら display、超過時は長辺 1200px / quality 0.8 | WebP | canvas 再エンコードで落ちる |
| `catGalleryPhotos` / とっておき | display | 長辺 2560px / quality 0.88 | JPEG | canvas 再エンコードで落ちる |
| 代表写真直接アップロード | avatar | 長辺 800px / default quality 0.85 | JPEG | canvas 再エンコードで落ちる |

根拠:

- ねがお variants: `src/components/home/HomeInput.tsx:5143-5150`。
- ねがお canvas encode: `src/components/home/HomeInput.tsx:5182-5214`。
- とっておき追加: `src/components/cats/CatsPage.tsx:922-933`。
- とっておき canvas encode: `src/components/cats/CatsPage.tsx:4346-4368`。
- 代表写真直接アップロード: `src/components/cats/CatsPage.tsx:859`。

### A-3. 各画面が使う src

| 画面 / 用途 | 優先順 | 根拠 |
| --- | --- | --- |
| ホーム写真カード | `displaySrc -> thumbnailSrc -> src` | `src/components/home/HomeDeskModel.tsx:1966-1973` |
| ホーム写真ビューア | `displaySrc -> originalSrc -> thumbnailSrc -> src` | `src/components/home/HomeDeskModel.tsx:1975-1982` |
| ホーム封筒開封中の写真 | `displaySrc -> originalSrc -> thumbnailSrc -> src`, `loading="eager"` | `src/components/home/HomeDeskModel.tsx:642-657` |
| アルバム月ボード / まいにち一覧 | `thumbnailSrc -> displaySrc -> src` | `src/components/collection/CollectionPage.tsx:4683-4691` |
| アルバム写真詳細 | `displaySrc -> originalSrc -> thumbnailSrc -> src` | `src/components/collection/CollectionPage.tsx:4695-4708` |
| うちのこ / この子のとっておき grid | ねがおは `thumbnailSrc -> displaySrc -> src`、とっておきは `src` | `src/components/cats/CatsPage.tsx:3506-3564` |
| うちのこ / 文箱 viewer | `displaySrc -> originalSrc -> thumbnailSrc -> src` | `src/components/home/OmoideMemoryViewer.tsx:86-93` |
| うちのこ / 年ごとの思い出 row | `thumbnailSrc -> displaySrc -> src` | `src/components/cats/CatsPage.tsx:3058-3062` |
| うちのこ / 足あと | 写真 entry は lens photo `src`、思い出 entry は `thumbnailSrc -> displaySrc -> src` | `src/lib/cats/footprints.ts:30-43`, `src/lib/cats/footprints.ts:62-71` |
| うちのこ / 基本 hero | `avatarDataUrl -> activeCoverPhoto.src -> coat avatar`。activeCoverPhoto はとっておき優先、なければ安定したねがお fallback | `src/components/cats/CatsPage.tsx:238-274` |
| 汎用 `PhotoTile` | 渡された `src` を `StoredPhotoImage` に渡す | `src/components/ui/PhotoTile.tsx:78-88` |

### A-4. signed URL API呼出回数、キャッシュ、有効期限

#### 実測

30枚の synthetic `ownSleepingPhotos` を localStorage に入れ、`storage:` 参照を使って `/collection` を表示した。

| 条件 | `/api/photo-storage/signed-url` 呼出 | unique `src` |
| --- | ---: | ---: |
| 初回 `/collection` 表示 | 12 | 6 |
| 同一 page context で `page.goto('/collection')` 再表示後累計 | 24 | 6 |

解釈:

- アルバム全30枚を一気に署名しているわけではなく、初期描画で mount された画像分だけ呼ばれている。
- `StoredPhotoImage` の module-level cache は同一 SPA セッション中は効くが、`page.goto` による document reload では JS module が再初期化され、再呼出しが発生する。
- 1画面内で同じ storage path が複数 mount されると、`signedUrlPromiseCache` により同一 promise に寄る。

#### 実装

- signed URL 発行秒数: `DISPLAY_SIGNED_URL_SECONDS = 600`。根拠: `src/lib/photoStorage.ts:5`。
- クライアントキャッシュ安全余白: `SIGNED_URL_CACHE_SAFETY_MS = 5 * 60 * 1000`。実効キャッシュは最大約5分。根拠: `src/components/ui/StoredPhotoImage.tsx:16-18`, `src/components/ui/StoredPhotoImage.tsx:486-494`。
- API route: `src/app/api/photo-storage/signed-url/route.ts`。

### A-5. `<img>` 属性の実態

`StoredPhotoImage` が全体の中心。

| 属性 | 実態 | 根拠 |
| --- | --- | --- |
| `loading` | inline data URL は `eager`、それ以外は default `lazy`。呼び元が `loading="eager"` を渡す箇所あり | `src/components/ui/StoredPhotoImage.tsx:276` |
| `decoding` | inline data URL は `sync`、それ以外は `async` | `src/components/ui/StoredPhotoImage.tsx:277` |
| `fetchpriority` | 指定なし | `src/components/ui/StoredPhotoImage.tsx:266-326` |
| `width` / `height` 属性 | 指定なし。CSS `width:100%`, `height:100%` のみ | `src/components/ui/StoredPhotoImage.tsx:309-310` |
| decode/表示演出 | 未load中は `filter: blur(14px) saturate(0.9)`、`transform: scale(1.018)` | `src/components/ui/StoredPhotoImage.tsx:313-317`, `src/components/ui/StoredPhotoImage.tsx:357-369` |
| load polling | 400ms interval、最大25回 = 最大約10秒 | `src/components/ui/StoredPhotoImage.tsx:217-235` |

## B. レンダリング

### B-6. `homeNow` / 時計 tick

- `HomeInput` は `setInterval(refreshTick, 1000)` で 1秒ごとに `setTick(Date.now())` を実行する。根拠: `src/components/home/HomeInput.tsx:367-377`。
- `const homeNow = isHomeClockReady ? tick : 0` として、`HomeInput` の render 内で複数の派生値に使われる。根拠: `src/components/home/HomeInput.tsx:290`。
- `homeNow` は `homeDateKey`, `useEveningDelivery`, `HomeDeskModel` props などに渡る。根拠: `src/components/home/HomeInput.tsx:723`, `src/components/home/HomeInput.tsx:787-807`, `src/components/home/HomeInput.tsx:2171-2203`。
- React Profiler UI はこの環境では直接接続していない。コード構造上は `tick` state が `HomeInput` 本体にあるため、1秒ごとに `HomeInput` 関数全体が再評価される。

### B-7. タブ切替の処理と localStorage 読込

実装:

- 下部ナビは Next `Link` で `/home`, `/collection`, `/cats` へ route 遷移する。根拠: `src/components/navigation/BottomNavigation.tsx:42-59`, `src/components/navigation/BottomNavigation.tsx:117-153`。
- View Transition 対応ブラウザでは `document.startViewTransition(() => router.push(item.href))` を使う。根拠: `src/components/navigation/BottomNavigation.tsx:94-106`。
- `collection` 押下時に sessionStorage `neteruneko_collection_nav_entry` を書く。根拠: `src/components/navigation/BottomNavigation.tsx:80-86`。

CPU 4x throttle での実測:

| 遷移 | wall time | ScriptDuration delta | JSON.parse calls | JSON.parse bytes | localStorage reads | localStorage bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/home -> /collection` | 2,154ms | 637ms | 72 | 32,819 | 40 | 13,313 |
| `/collection -> /cats` | 1,217ms | 247ms | 13 | 21,045 | 36 | 20,070 |
| `/cats -> /home` | 1,277ms | 231ms | 12 | 20,629 | 59 | 19,649 |

根拠箇所:

- `CollectionPage` は mount / 操作中に `readCatProfiles`, `readKeptExchangePhotos`, `collectionPhotos` の JSON parse を行う。例: `src/components/collection/CollectionPage.tsx:356`, `src/components/collection/CollectionPage.tsx:473`, `src/components/collection/CollectionPage.tsx:1172-1179`。
- `CatsPage` は render 中に `readOmoideMemoriesForCat`, `readOwnSleepingPhotoCount`, `readCatSleepingMilestones`, `createLocalLensPhotos` など localStorage 読みを行う。例: `src/components/cats/CatsPage.tsx:235-249`, `src/components/cats/CatsPage.tsx:3506-3527`。
- `HomeInput` は render / effects / helper で `readOwnSleepingPhotos`, `readCatProfiles`, `readCatGalleryPhotos` などを読む。例: `src/components/home/HomeInput.tsx:356`, `src/components/home/HomeInput.tsx:769-773`, `src/components/home/HomeInput.tsx:4966-5045`。

### B-8. アニメーション一覧

非コンポジタ寄り、または高コストになりやすいプロパティ。

| 箇所 | プロパティ | 根拠 |
| --- | --- | --- |
| `StoredPhotoImage` 現像 | `filter: blur(14px)`, `transition: filter 420ms`, `transform` | `src/components/ui/StoredPhotoImage.tsx:313-319`, `src/components/ui/StoredPhotoImage.tsx:357-369` |
| `OmoideMemoryViewer` 現像 | `filter: blur(14px)`, `opacity`, `transform` keyframes | `src/components/home/OmoideMemoryViewer.tsx:56-63` |
| まいにち貼り付け演出 | `filter: drop-shadow(...) saturate(...)` keyframes | `src/components/collection/CollectionPage.tsx:96-115` |
| Collection glass / overlay | `backdropFilter: blur(24px)` | `src/components/collection/CollectionPage.tsx:73` |
| Cats action buttons / overlays | 複数の `backdropFilter: blur(10px)` | `src/components/cats/CatsPage.tsx:4617-4731` |
| Home sheets / overlays | `backdropFilter: blur(16px〜28px)`, `boxShadow` 多用 | `src/components/home/HomeInput.tsx:5609`, `src/components/home/HomeInput.tsx:5843`, `src/components/home/HomeInput.tsx:6064`, `src/components/home/HomeInput.tsx:6221`, `src/components/home/HomeInput.tsx:7654` |
| Collection bundle | fixed `height` と `--mainichi-bundle-height` を使った積層表現 | `src/components/collection/CollectionPage.tsx:4031-4138`, `src/components/collection/CollectionPage.tsx:5688` |

### B-9. 背景の紙テクスチャ

実装:

- app 全体の紙背景は CSS variable `--app-paper-image` と `--app-paper-grain`。根拠: `src/app/tokens.css:24`, `src/app/tokens.css:32`。
- layout fallback も `generated-noon-paper.png` を使う。根拠: `src/app/layout.tsx:81`。
- Home desk は時刻 phase ごとに PNG 背景を切り替える。根拠: `src/components/home/HomeDeskModel.tsx:130-134`。
- `AppPaperTheme` も同じ PNG 群を使う。根拠: `src/components/ui/AppPaperTheme.tsx:6-10`。

ファイルサイズ:

| file | bytes |
| --- | ---: |
| `public/images/home-backgrounds/generated-dawn-paper.png` | 2,174,862 |
| `public/images/home-backgrounds/generated-morning-paper.png` | 2,331,080 |
| `public/images/home-backgrounds/generated-noon-paper.png` | 2,035,910 |
| `public/images/home-backgrounds/generated-evening-paper.png` | 2,581,447 |
| `public/images/home-backgrounds/generated-night-paper-v2.png` | 3,184,078 |
| `public/images/home-backgrounds/paper-grain.png` | 97,497 |
| `public/images/home/generated-envelope-wide-v2.png` | 998,560 |
| `public/splash/v6/apple-splash-1179-2556.png` | 1,185,897 |
| `public/illustrations/sleeping-cat-empty.png` | 406,942 |

## C. 計測値

### C-10. Lighthouse mobile

| route | Perf score | FCP | LCP | TBT | CLS | Speed Index | Total bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/home` | 64 | 779ms | 32,969ms | 313ms | 0 | 5,427ms | 7,811,146 |
| `/collection` | 65 | 771ms | 27,781ms | 375ms | 0 | 3,547ms | 6,087,149 |
| `/cats` | 73 | 772ms | 33,708ms | 180ms | 0 | 1,192ms | 6,226,907 |

Lighthouse network の上位画像転送:

| route | image transfer | top images |
| --- | ---: | --- |
| `/home` | 6,404,377 bytes | `generated-evening-paper.png` 2,582,283 / `generated-noon-paper.png` 2,036,746 / `apple-splash-1179-2556.png` 1,186,733 / `sleeping-cat-empty.png` 407,776 |
| `/collection` | 4,697,323 bytes | `generated-evening-paper.png` 2,582,283 / `generated-noon-paper.png` 2,036,746 |
| `/cats` | 4,879,983 bytes | `generated-evening-paper.png` 2,582,283 / `generated-noon-paper.png` 2,036,746 / `sample-cats/saba.png` 185,042 |

補足:

- Lighthouse は `generated-noon-paper.png` に対して WebP/AVIF 化で推定 1,944,619 bytes 削減、`sample-cats/saba.png` に対して 168,515 bytes 削減を出している。
- LCP は 27〜34秒と異常に遅い。画像背景の重さと LCP 候補の確定遅延が主因候補。

### C-11. Bundle / First Load JS

`npm run build` の出力は Next.js 16 / Turbopack 形式で、従来の `First Load JS` 列を表示しない。代替として `.next/server/app/*/page/build-manifest.json` と Lighthouse network を併記する。

Build manifest:

| route | JS files | manifest JS bytes |
| --- | ---: | ---: |
| `/home` | 5 | 456,626 |
| `/collection` | 5 | 456,626 |
| `/cats` | 5 | 456,626 |

Lighthouse network JS transfer:

| route | JS requests | JS transfer |
| --- | ---: | ---: |
| `/home` | 21 | 356,798 bytes |
| `/collection` | 21 | 337,280 bytes |
| `/cats` | 21 | 292,620 bytes |

`npm run build` 出力:

- `/home`: Dynamic server-rendered.
- `/collection`: Dynamic server-rendered.
- `/cats`: Static prerendered.

### C-12. Performance計測

CPU 4x throttle / CDP `ScriptDuration`:

| 遷移 | Scripting | 備考 |
| --- | ---: | --- |
| `/home -> /collection` | 637ms | JSON.parse 72回、32,819 bytes |
| `/collection -> /cats` | 247ms | JSON.parse 13回、21,045 bytes |
| `/cats -> /home` | 231ms | localStorage read 59回 |

現像アニメ中の frame sample:

- `/home` idle + image/develop transition 近傍で 2秒 RAF sample。
- frame count: 105
- 50ms超え long frame: 0
- max frame interval: 33.4ms
- avg frame interval: 19.1ms

補足:

- この sample は synthetic / localhost での軽い状態。実機 Safari での blur 現像、重い写真、背景PNGロード時とは別に見る必要がある。
- React Profiler の UI 計測は未実施。ただし `HomeInput` の `tick` state は 1秒ごとに本体再評価される構造。

## D. 所見

### D-13. 体感を削っている犯人候補トップ5

1. **紙背景PNGが大きすぎる**
   - `/home` で画像転送 6.4MB。`generated-evening-paper.png` 2.58MB、`generated-noon-paper.png` 2.04MB、`apple-splash` 1.19MB が初期表示に乗っている。
   - LCP が `/home` 32.97秒、`/cats` 33.71秒まで悪化。
   - 根拠: `src/components/home/HomeDeskModel.tsx:130-134`, `src/app/tokens.css:24`, Lighthouse network。

2. **`<img>` に width/height と fetchpriority がない**
   - `StoredPhotoImage` は CSS サイズだけで、HTML 属性の `width` / `height` / `fetchpriority` がない。
   - LCP 候補の優先度やレイアウト安定判断で損をしている可能性がある。
   - 根拠: `src/components/ui/StoredPhotoImage.tsx:266-326`。

3. **HomeInput の1秒 tick が広すぎる**
   - `setInterval(..., 1000)` が `HomeInput` の state を更新し、`homeNow` が複数の重い派生計算と props に流れる。
   - 時刻表示に必要な範囲以上に、ホーム全体が毎秒再評価される構造。
   - 根拠: `src/components/home/HomeInput.tsx:367-377`, `src/components/home/HomeInput.tsx:787-807`, `src/components/home/HomeInput.tsx:2171-2203`。

4. **タブ切替時の localStorage / JSON.parse が多い**
   - `/home -> /collection` で JSON.parse 72回、ScriptDuration 637ms。
   - データ層が localStorage 中心で、route mount 時に同期的に読む箇所が多い。
   - 根拠: 実測、`src/components/collection/CollectionPage.tsx:1172-1179`, `src/components/cats/CatsPage.tsx:3506-3527`, `src/components/home/HomeInput.tsx:4966-5045`。

5. **blur / backdrop-filter / drop-shadow 系の演出が多い**
   - 写真現像は `filter: blur(14px)`、文箱 viewer も blur keyframes、collection の貼り付け演出は drop-shadow filter。
   - 実測 localhost では 50ms 超え frame は出ていないが、iPhone Safari で写真枚数や背景PNGと重なると効く可能性が高い。
   - 根拠: `src/components/ui/StoredPhotoImage.tsx:313-319`, `src/components/home/OmoideMemoryViewer.tsx:56-63`, `src/components/collection/CollectionPage.tsx:96-115`。

## 補足: 改善を考える場合の優先順

このレポートでは実装しない。優先度だけ書く。

1. 背景PNGを WebP/AVIF 化し、phase 背景を初期表示で複数読まない。
2. LCP候補の画像に `fetchpriority="high"` と固定 `width/height` を付与する設計を検討する。
3. `homeNow` tick を「表示が必要な小コンポーネント」へ閉じ込める。
4. localStorage 読みを route mount ごとに再parseしないキャッシュ層へ寄せる。
5. blur現像を写真サイズ・端末・reduced motionで軽量化する。

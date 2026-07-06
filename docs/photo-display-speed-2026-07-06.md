# 写真表示速度の計測と改善 2026-07-06

## 対象

- ホーム（きょう）: 当日のねがお、ねこだより、思い出便の写真表示
- ねこだより（おくった / とどいた）: 一覧サムネイル群
- うちのこ > 写真: グリッド表示

Storage bucket は private のまま。public 化は行っていない。

## Part A: 計測と静的調査

### 段階別の現状

| 画面 | t1 signed URL 発行 | t2 画像ダウンロード | t3 decode / 描画 | 判定 |
|---|---:|---:|---:|---|
| ホーム | Storage パスの場合は `StoredPhotoImage` が必要時に発行。キャッシュヒット時は 0ms 扱い | 変換パラメータなし。保存済み display 画像をそのまま取得 | `decode()` / `onLoad` 待ち。紙色プレースホルダあり | URL 発行と転送量の複合 |
| ねこだより一覧 | 一覧表示前に batch preload。最大 80 paths / request。再表示はメモリキャッシュで 0ms 扱い | サムネがあれば thumbnail、なければ display 参照 | lazy / async / width-height 指定あり | 主犯は転送量寄り |
| うちのこ > 写真 | active lens の先頭 48 枚を batch preload。再表示はメモリキャッシュで 0ms 扱い | thumbnail 参照を優先。詳細は display | lazy / async / width-height 指定あり | 主犯は転送量寄り |

実ネットワークの t2/t3 数値は本番 Storage と端末状態に依存するため、この作業ではコード経路と E2E 上の URL 発行回数を固定した。4G 相当の実機 transfer / decode 計測は残確認。

### signed URL

| 項目 | 変更前 | 変更後 |
|---|---:|---:|
| 表示用 signed URL TTL | 600 秒 | 86,400 秒 |
| クライアントキャッシュ | TTL から 5 分引いた時点まで | TTL の 80% 時点まで |
| キャッシュ場所 | module scope memory | module scope memory |
| sessionStorage 保存 | なし | なし |
| batch API | API は存在。ただし内部で single signing ループ | Supabase `createSignedUrls()` で一括発行 |
| 1 セッション内の同一 path 再表示 | 発行が重複しうる | E2E で追加発行 0 を確認 |

### 一覧の batch preload

| 箇所 | preload 対象 |
|---|---|
| `CollectionPage` stored collection | 先頭 36 枚 |
| `CollectionPage` sleeping box | 先頭 18 枚 |
| `CollectionPage` other box | 先頭 18 枚 |
| `CatsPage` cat lens photos | 先頭 48 枚 |

### `<img>` 属性

- `StoredPhotoImage` は `loading` / `decoding` / `fetchPriority` を受け取る。
- 一覧系は `loading="lazy"` と `decoding="async"` が基本。
- data URL は即時表示のため `loading="eager"` 寄り。
- 今回、未指定時も `width=512` / `height=512` を付与し、CLS を抑える既定値を入れた。
- `PhotoTile` はサイズ別の intrinsic width / height を渡している。

### Image Transformation

当初の表示 URL は Supabase Storage の signed URL をそのまま使っており、`width` / `quality` の変換パラメータは付与していなかった。

本番 project は Pro plan で Image Transformation 有効と確認済みのため、B-2 を実装した。

- 一覧サムネイル: `width=400`, `quality=75`
- 全画面 / 表示用: plain signed URL のまま
- 原寸: plain signed URL のまま

`@supabase/storage-js` 2.105.4 の実装では、`createSignedUrl()` 単数は `transform` に対応しているが、`createSignedUrls()` 複数一括は `download` / `cacheNonce` のみで `transform` 非対応。そのため、thumbnail variant のみサーバ route 内で認可済み path を `Promise.all(createSignedUrl(..., { transform }))` で並列署名する。クライアントから見ると従来通り `/api/photo-storage/signed-urls` 1リクエストで済む。

spend cap や Transformation 枠超過で変換 URL が壊れた場合は、`StoredPhotoImage` の `onError` で plain signed URL に自動フォールバックする。フォールバック時は `photo_transform_fallback` を記録する。

## 犯人判定

今回の主犯候補は「signed URL の重複発行」と「変換なし display 画像の転送量」の複合。

B-1 により、同一セッション内の重複発行と一覧の逐次発行はかなり抑制された。B-2 により、`PhotoTile` 経由の一覧サムネイルは Storage 側の `width=400, quality=75` を使う。残る体感差は、全画面やホーム主役画像の display 転送量と decode が支配的になりやすい。

## Part B 実装内容

### B-1 signed URL キャッシュと一括発行

- `DISPLAY_SIGNED_URL_SECONDS` を 24 時間へ延長。
- クライアントの signed URL キャッシュ有効期限を TTL の 80% に変更。
- `/api/photo-storage/signed-urls` は認可判定後、authorized paths を Supabase `createSignedUrls()` で一括署名。
- URL 文字列は sessionStorage / localStorage に保存しない。
- private bucket 前提は維持。

### B-3 体感改善

- `StoredPhotoImage` の未指定 `width` / `height` を 512px に統一。
- 既存の紙色プレースホルダ、lazy / async decode、first-view の eager / high 指定を維持。
- 一覧系の `PhotoTile` 経由では引き続き aspect / intrinsic size が指定される。

### B-2 表示サイズ分離

実装済み。

- `PhotoTile` は `storageVariant="thumbnail"` を使う。
- thumbnail variant は `width=400`, `quality=75` の transformed signed URL を使う。
- display variant は plain signed URL のまま。
- thumbnail と display の signed URL cache は別キーに分離し、詳細表示が 400px URL を誤用しないようにした。
- thumbnail の読み込みに失敗した場合は plain signed URL に自動フォールバックする。
- fallback は `photo_transform_fallback` イベントで記録する。

コスト試算:

- 先行期 30人 × 毎日 1枚で月 900 オリジン画像規模。
- 無料枠 100 オリジン画像/月を超える前提なら、超過 800 枚程度。
- 目安を $5 / 1,000 と置くと、先行期は月 $4 前後。
- spend cap を維持する場合、枠超過時は plain signed URL fallback で表示を守る。
- spend cap を外す場合、月数ドルで一覧体感を優先する判断になる。

## before / after

| 観点 | before | after |
|---|---:|---:|
| signed URL TTL | 10 分 | 24 時間 |
| client refresh timing | TTL - 5 分 | TTL の 80% |
| batch route の signing | single signing loop | `createSignedUrls()` batch |
| 同一 path の SPA 再表示 | 再発行の可能性あり | E2E で追加発行 0 |
| 一覧サムネイル | plain display URL | transformed signed URL `width=400, quality=75` |
| 変換失敗時 | 表示不能リスク | plain signed URL に fallback |
| Storage public 化 | なし | なし |
| 変換パラメータ | なし | thumbnail のみあり |

## 確認結果

- `npm run typecheck`: OK
- `npx playwright test tests/e2e/sleeping-delivery-pool-guards.spec.ts --project=desktop --grep "display signed urls"`: OK
- `npx playwright test tests/e2e/collection-album-flow.spec.ts --project=mobile --grep "signed url"`: OK
- `npx playwright test tests/e2e/collection-album-flow.spec.ts --project=mobile --grep "thumbnail transform"`: OK

## 残確認

- 本番または preview の実データで、4G 相当のねこだより一覧スクロールを実機確認する。
- 本番の実画像で、thumbnail transformed URL と plain fallback の転送量 before / after を Network panel で再計測する。
- `photo_transform_fallback` が発生した場合は、spend cap / Transformation 枠超過 / 一時障害のどれかを確認する。

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

現時点の表示 URL は Supabase Storage の signed URL をそのまま使っており、`width` / `quality` の変換パラメータは付与していない。

Supabase Image Transformation が本番 project / plan で利用可能かはこの変更内では確定していないため、B-2 は未実装。利用可能と確認できた場合は、表示 URL の組み立てだけで以下へ寄せる余地がある。

- 一覧サムネイル / 切手: `width=400`, `quality=75`
- 全画面: `width=1200`, `quality=80`

利用できない場合は、アップロード時 thumbnail 生成の強化が代替案。ただし保存パイプライン変更になるため別 spec が安全。

## 犯人判定

今回の主犯候補は「signed URL の重複発行」と「変換なし display 画像の転送量」の複合。

B-1 により、同一セッション内の重複発行と一覧の逐次発行はかなり抑制された。残る体感差は、特にリモート画像の転送量と decode が支配的になりやすい。

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

未実装。理由は Supabase Image Transformation の本番利用可否が未確定で、URL 形式の安全確認なしに導入すると表示不能リスクがあるため。

## before / after

| 観点 | before | after |
|---|---:|---:|
| signed URL TTL | 10 分 | 24 時間 |
| client refresh timing | TTL - 5 分 | TTL の 80% |
| batch route の signing | single signing loop | `createSignedUrls()` batch |
| 同一 path の SPA 再表示 | 再発行の可能性あり | E2E で追加発行 0 |
| Storage public 化 | なし | なし |
| 変換パラメータ | なし | なし（次フェーズ候補） |

## 確認結果

- `npm run typecheck`: OK
- `npx playwright test tests/e2e/sleeping-delivery-pool-guards.spec.ts --project=desktop --grep "display signed urls"`: OK
- `npx playwright test tests/e2e/collection-album-flow.spec.ts --project=mobile --grep "signed url"`: OK

## 残確認

- 本番または preview の実データで、4G 相当のねこだより一覧スクロールを実機確認する。
- Supabase Image Transformation が `nyaruhodo.jp` の本番 Storage で利用可能か確認する。
- 利用可能なら B-2 を別差分で実装し、t2 転送量と decode を再計測する。

# 写真画質と原本保全 2026-07

更新日: 2026-07-15

## 1. 二つの保存物

- 画面表示用: 表示速度と通信量のために縮小・圧縮した画像。通常UIは必ずこちらを使う。
- 保管原本: ユーザーが選んだ `File` / `Blob` を再圧縮せず保存したもの。将来の現像・物販用で、通常UIには配信しない。

既存型の `originalSrc` は歴史的な名前であり、「表示候補のうち最も大きい画像」を指す場合がある。物販原本の所在を判定するときは、`photo_assets.original_storage_path` と `status = 'ready'` を正とする。

## 2. 表示解像度

| 用途 | 読み取り | 目安 |
|---|---|---:|
| 一覧・小タイル | thumbnail | 480〜800px |
| ねこだよりボード | thumbnail transform | 800px |
| ホームの今日の写真 | hero transform | 1440px / quality 84 |
| うちのこカバー | hero transform | 1440px / quality 84 |
| 詳細ビューア・crop編集 | display | 保存済み表示画像の最大サイズ |

新規取り込み時の表示画像は、寝顔・オンボが最大2048px、うちのこ写真とカバーが最大2560px、記録写真が最大1600px。小タイルには別のthumbnailを使い、大きな表示でthumbnailを引き伸ばさない。

Storage画像のtransform取得に失敗した場合は、同じStorageオブジェクトのdisplay URLへフォールバックする。届いた写真をオフライン表示用data URLへ変換しても、履歴の正本はStorage参照のまま維持し、data URLは `neteruneko_exchange_photo_offline_cache` に分離する。

## 3. 原本保全経路

対象入口:

- ホームの寝顔（共有・自分だけ）
- オンボーディング写真
- うちのこ写真
- 記録写真
- カバー写真

原本はまずIndexedDB `neteruneko-photo-originals` の `pending-originals` に保存する。通常アカウントでログイン済みなら、次の非公開Storageパスへアップロードし、`photo_assets` に寸法・byte数・MIME type・表示画像の参照を記録する。

```text
cat-photos/<user-id>/originals/<surface>/<YYYY>/<MM>/<asset-id>-<hash>.<ext>
```

未ログイン時は端末内キューに残し、ログイン・オンライン復帰・定期再試行でアップロードする。別アカウントでログインしたときに、所有者確定済みのキューを誤ってアップロードしない。

原本も既存の `cat-photos` 配下に置くため、日次の `cat-photos-backup` 差分コピーに含まれる。退会時は `photo_assets` 行とユーザーStorage prefixの双方を削除する。

## 4. 現像判定

`src/lib/printPhotoQuality.ts` で、原本のpixel寸法と裁ち落とし後の実寸からeffective DPIを計算する。

- 300dpi以上: ready
- 240〜299dpi: acceptable
- 180〜239dpi: warning
- 180dpi未満: insufficient

注文UIを実装するときは、表示用画像ではなく `photo_assets` の原本寸法をこの判定へ渡す。A4など大きい商品で不足する場合は、商品選択前に明示する。

## 5. デプロイと既存データ

`20260715090000_create_photo_assets.sql` を本番DBへ先に適用してから、アプリをデプロイする。migration未適用のままコードを先に出すと、原本Storageは保存できても台帳更新が失敗し、キューが残り続ける。

この対応以降に端末から選ばれた写真は原本保全の対象になる。すでに縮小画像しか残っていない過去写真から、失われたpixelを復元することはできない。過去写真についてはStorage上の最大画像を利用し、物販時に個別のDPI判定を行う。

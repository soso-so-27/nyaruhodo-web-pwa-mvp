# Photo Domain Inventory

公開前に、ねてるねこの写真まわりの役割が混ざらないように整理する。

## 写真系統

| 系統 | 入口 | 保存先 | 表示場所 | 同期対象 | 削除/管理導線 | ねこだより候補 |
| --- | --- | --- | --- | --- | --- | --- |
| ねがお | ホームの「ねがおをとる」、オンボーディングの「ねがおを1枚入れる」 | `nyaruhodo_exchange_own_sleeping_photos` / remote `cat_moments` | ホーム、ねこだよりの「おくった」、うちのこ写真、記念、足あと、年まとめ | 対象。`syncSleepingPhotos()` / `restoreSleepingPhotos()` | 寝顔ビューア側に削除/外す導線あり | 対象。明示的に入れた寝顔だけ |
| とどいた | 夜8時便、オンボーディング即時ねこだより | `nyaruhodo_exchange_kept_photos` / remote `cat_moment_deliveries` | ねこだよりの「とどいた」、うちのこ記録/思い出 | 対象。`syncSleepingPhotos()` / `restoreSleepingPhotos()` | 非表示/通報系の導線あり | 対象外。届いた写真であり、再配布候補ではない |
| この子の写真 | うちのこ > 写真 > 写真を追加 | `neteruneko_cat_gallery_photos` / remote `collection_photos` with `slot_slug="__cat_gallery"` | うちのこ > 写真、この子/ぜんぶ、代表写真選択 | 対象。`syncCatGalleryPhotos()` / `restoreCatGalleryPhotos()` | P1。現状は追加/表示が中心で、削除管理は未整理 | 対象外。寝顔以外も含むため交換候補にしない |
| 代表写真 | うちのこ > 基本 > 写真を選ぶ | `catProfiles[].avatarDataUrl` / remote `cats.avatar_storage_path` | うちのこページ上部、猫切り替え、プロフィール表示 | 対象。`syncCatProfile()` / `restoreCatProfiles()` | 「自動表示に戻す」あり。元写真削除との連動はP1 | 対象外 |
| テーマ別アルバム | `/collection` の各テーマ/カテゴリから写真追加 | `collection_photos` / remote `collection_photos` | `/collection` 側のテーマ別写真 | 対象。`syncCollectionPhotos()` / `restoreCollectionPhotos()` | 対象。写真詳細/スロット側から削除 | 対象外 |

## 現在の分離方針

- `ねがお` は、ねこだより交換の主役。交換候補になるのは `ownSleepingPhotos` として保存された写真だけ。
- `この子の写真` は、その子の写真置き場。寝顔以外も含むため、ねこだより交換候補には混ぜない。
- `代表写真` は見出し用の写真。写真そのものの置き場ではなく、プロフィール表示の設定。
- `テーマ別アルバム` は `/collection` のカテゴリ別写真。`この子の写真` とは今は統合しない。

## Internal reserved collection slot

- `slot_slug="__cat_gallery"` is reserved for syncing `catGalleryPhotos`.
- It is not a normal `/collection` category.
- Regular collection display, counts, push, and restore must exclude `__cat_gallery`.
- Cat gallery restore should read only `__cat_gallery` and write back to `neteruneko_cat_gallery_photos`.

## 今回のP0対応

- `catGalleryPhotos` を account sync snapshot に追加。
- `collection_photos` テーブルを再利用し、`slot_slug="__cat_gallery"` で通常collectionと分離。
- 通常の `restoreCollectionPhotos()` では `__cat_gallery` を除外。
- 通常の collection 表示、件数、push、restore から `__cat_gallery` を除外。
- `restoreCatGalleryPhotos()` で `neteruneko_cat_gallery_photos` に復元。
- 代表写真選択の文言を「ねがおから選ぶ」から「この子の写真から選ぶ」に寄せた。

## P1 / P2 TODO

- P1: `うちのこ > 写真` の詳細ビューから「この写真を削除」を追加する。
- P1: 代表写真に使われている `catGalleryPhoto` を削除した場合、自動表示へ戻すか確認する。
- P1: storage上の実ファイル削除方針を決める。公開前はlocal/remote rowの削除優先でよい。
- P1: `/collection` は「テーマ別アルバム」、`うちのこ > 写真` は「この子の写真」としてUI文言を継続的に分ける。
- P2: 将来的に `cat_gallery_photos` 専用テーブルを作るか検討する。現時点ではDB再設計しない。

# Photo Domain Inventory

公開前に、ねてるねこの写真まわりの役割が混ざらないように整理する。

## 写真系統

| 系統 | 入口 | 保存先 | 表示場所 | 同期対象 | 削除/管理導線 | ねこだより候補 |
| --- | --- | --- | --- | --- | --- | --- |
| ねがお | ホームの「ねがおをとる」、オンボーディングの「ねがおを1枚入れる」 | `nyaruhodo_exchange_own_sleeping_photos` / remote `cat_moments` | ホーム、ねこだよりの「おくった」、うちのこ写真、記念、足あと、年まとめ | 対象。`syncSleepingPhotos()` / `restoreSleepingPhotos()` | 寝顔ビューア側に削除/外す導線あり | 対象。明示的に入れた寝顔だけ |
| とどいた | 夜8時便、オンボーディング即時ねこだより | `nyaruhodo_exchange_kept_photos` / remote `cat_moment_deliveries` | ねこだよりの「とどいた」、うちのこ記録/思い出 | 対象。`syncSleepingPhotos()` / `restoreSleepingPhotos()` | 非表示/通報系の導線あり | 対象外。届いた写真であり、再配布候補ではない |
| この子の写真 | うちのこ > 写真 > 写真を残す、ホームの「この子の写真を残す」 | `neteruneko_cat_gallery_photos` / remote `collection_photos` with `slot_slug="__cat_gallery"` | うちのこ > 写真、この子/ぜんぶ、代表写真選択 | 対象。`syncCatGalleryPhotos()` / `restoreCatGalleryPhotos()` | 写真ビューアから「この写真を削除」。local/remote `__cat_gallery` row から消す | 対象外。寝顔以外も含むため交換候補にしない |
| 代表写真 | うちのこ > 基本 > 写真を選ぶ | `catProfiles[].avatarDataUrl` / remote `cats.avatar_storage_path` | うちのこページ上部、猫切り替え、プロフィール表示 | 対象。`syncCatProfile()` / `restoreCatProfiles()` | 「自動表示に戻す」あり。代表写真に使う `catGalleryPhoto` 削除時は自動表示へ戻す | 対象外 |
| テーマ別アルバム | `/collection` の各テーマ/カテゴリから写真追加 | `collection_photos` / remote `collection_photos` | `/collection` 側のテーマ別写真 | 対象。`syncCollectionPhotos()` / `restoreCollectionPhotos()` | 対象。写真詳細/スロット側から削除 | 対象外 |

## 現在の分離方針

- `ねがお` は、ねこだより交換の主役。交換候補になるのは `ownSleepingPhotos` として保存された写真だけ。
- `この子の写真` は、その子の写真置き場。寝顔以外も含むため、ねこだより交換候補には混ぜない。
- `代表写真` は見出し用の写真。写真そのものの置き場ではなく、プロフィール表示の設定。
- `テーマ別アルバム` は `/collection` のカテゴリ別写真。`この子の写真` とは今は統合しない。

## 画質 / localStorage 方針

- ねてるねこは原本保管アプリではない。元File/BlobやEXIFつき原本は保存しない。
- `ねがお` は canvas 再エンコード後、Storage用 display を長辺2048px / WebP quality 0.84、thumbnail を長辺512px / WebP quality 0.72 で作る。
- `この子の写真` は canvas 再エンコード後、Storage用 display を長辺2560px / JPEG quality 0.88 で作る。
- `この子の写真` は localStorage にbase64を残さないため、Storage参照を作れた場合だけ保存する。
- `catGalleryPhotos` のlocalStorageには `photoId`, `catId`, `createdAt`, `storage:` 参照だけを残す。
- `catGalleryPhotos` は公開初期の肥大化を避けるため、1匹あたり100枚まで保存する。
- `ownSleepingPhotos` はStorage参照を優先する。ただし匿名/未同期の既存フローでは、交換体験維持のため圧縮済みdata URL fallbackが残る可能性がある。
- `avatarDataUrl` はStorage参照を優先し、代表写真の直接アップロードではStorage参照を作れた場合だけ反映する。

## この子の写真の運用方針

- `この子の写真` は写真の原本保管アプリではなく、その子の写真をあとから見返す場所。
- `この子の写真` の画面には、毎日の `ねがお` (`ownSleepingPhotos`) と、ユーザーが明示的に残した写真 (`catGalleryPhotos`) の両方を並べる。
- `ねがお` は `catGalleryPhotos` へ自動コピーしない。`この子の写真を残す` で選んだ写真だけが `catGalleryPhotos` になる。
- `この子の写真` 100枚枠を消費するのは `catGalleryPhotos` だけ。`ねがお` は別の記録として `ownSleepingPhotos` にたまり、100日撮ってもこの枠は消費しない。
- 一括追加、自動バックアップ、無制限保存はしない。1枚ずつ選んで残す。
- 現時点では、猫ごとに100枚まで保存できる。
- 原本ではなく、スマホで見返しやすい表示サイズに整えてStorageへ保存する。
- `この子の写真` は `ねこだより` には使わない。
- 通常collectionとは分離し、`slot_slug="__cat_gallery"` を内部予約slotとして扱う。
- 将来的なプラン案: 無料/ベータは100枚/猫、有料では300枚以上/猫を検討する。
- 将来的な価値案: とっておき写真、年まとめ、グッズ作成、カレンダー/カード/小さな本などの物販導線を検討する。
- 将来的には、`ねがお` と `この子の写真` の両方から `とっておき` を選べる導線を検討する。
- 代表写真は、`この子の写真` と `ねがお` の両方から選べると自然。ただし、`ねがお` を代表写真にしても `catGalleryPhotos` へコピーしない。
- 基本タブ全体の情報設計は `docs/basic-info-stickiness-plan.md` にまとめる。

## Internal reserved collection slot

- `slot_slug="__cat_gallery"` is reserved for syncing `catGalleryPhotos`.
- It is not a normal `/collection` category.
- Regular collection display, counts, push, and restore must exclude `__cat_gallery`.
- Cat gallery restore should read only `__cat_gallery` and write back to `neteruneko_cat_gallery_photos`.

## Account reconnect / restore rule

- `この子の写真` UI displays both `ownSleepingPhotos` and `catGalleryPhotos`.
- `catGalleryPhotos` remains the manually saved photo domain, synced through `collection_photos.slot_slug="__cat_gallery"`.
- `ねがお` is not automatically copied into `catGalleryPhotos`, and it does not consume the 100-photo cat gallery limit.
- `この子の写真` syncs through `collection_photos.slot_slug="__cat_gallery"`.
- After Google reconnect, remote `__cat_gallery` rows should be merged back into local `neteruneko_cat_gallery_photos`.
- If remote `__cat_gallery` is empty, local `catGalleryPhotos` must not be cleared.
- `/cats` displays the merged photo lens (`ownSleepingPhotos` + restored `catGalleryPhotos`); remote `__cat_gallery` should be restored first rather than mixed into regular collection display.
- Empty states should explain that daily `ねがお` and photos saved via `この子の写真を残す` both appear in the photo lens, while only manually saved photos count toward the 100-photo gallery limit.
- Known account reconnect risk: Safari, PWA, and Instagram in-app browser can have separate browser storage. If `nyaruhodo_supabase_auth` is missing in the current context, the app may look disconnected even if another browser context is still connected.
- No silent sign-out path should clear account data during cat gallery restore. Explicit logout remains the settings `signOut()` action.

## 今回のP0対応

- `catGalleryPhotos` を account sync snapshot に追加。
- `collection_photos` テーブルを再利用し、`slot_slug="__cat_gallery"` で通常collectionと分離。
- 通常の `restoreCollectionPhotos()` では `__cat_gallery` を除外。
- 通常の collection 表示、件数、push、restore から `__cat_gallery` を除外。
- `restoreCatGalleryPhotos()` で `neteruneko_cat_gallery_photos` に復元。
- 代表写真選択は `この子の写真` と `ねがお` の両方を候補にできる。選んでも `catGalleryPhotos` にはコピーしない。

## P1 / P2 TODO

- Done: `うちのこ > 写真` の詳細ビューから「この写真を削除」を追加。
- Done: 代表写真に使われている `catGalleryPhoto` を削除した場合、自動表示へ戻す。
- P1: storage上の実ファイル削除方針を決める。公開前はlocal/remote rowの削除優先でよい。
- P1: 匿名/未同期の `ownSleepingPhotos` data URL fallback を完全にStorage参照へ寄せるか検討する。
- P1: 既存端末に残るlegacy `avatarDataUrl` / accountSync snapshot内のdata URLをStorage参照へ移行する方針を決める。
- P1: `/collection` は「テーマ別アルバム」、`うちのこ > 写真` は「この子の写真」としてUI文言を継続的に分ける。
- P2: 将来的に `cat_gallery_photos` 専用テーブルを作るか検討する。現時点ではDB再設計しない。

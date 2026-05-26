# Collection Share Feed Design

## Purpose

`/collection` の `シェア` は、写真を外部SNSへ即共有する場所ではなく、将来のアプリ内共有フィードへ伸ばすための面として扱う。

現在は「自分の一枚」と「次に撮る候補」を並べる。将来は同じ面に、共有された写真やおすすめ候補を混ぜられるようにする。

## Current MVP Scope

- Source: local `collection_photos`
- Visible item type: 自分の一枚 / 次に撮る候補
- Action: カードを開くと該当コレクション詳細へ戻る
- Empty state: コレクション写真追加へ戻す。候補がある場合は候補カードを表示する
- Do not imply public sharing is already live

## Future Feed Sources

| Source | Meaning | Example UI Label |
|---|---|---|
| `self_photo` | 自分のコレクション写真 | 自分 |
| `shared_photo` | 他ユーザーから共有された写真 | 共有はこれから |
| `suggested_candidate` | 今日撮ると良さそうな候補 | 撮る候補 |

## Data Shape Direction

```ts
type CollectionShareFeedItem = {
  id: string;
  itemType: "photo" | "suggestion";
  ownerScope: "self" | "shared" | "system";
  slotId?: string;
  slotSlug?: string;
  imageUrl?: string;
  ownerDisplayName?: string;
  badge: string;
  createdAt?: string;
};
```

The MVP keeps this local and minimal. When shared feed storage is added, the UI should be able to swap `buildCollectionShareFeed()` from localStorage-derived items to API/Supabase-derived items.

## Analytics

- `collection_share_tapped`: intent from a collection detail sheet
- `collection_share_feed_card_opened`: interest in feed content
- Future candidates:
  - `collection_shared_feed_viewed`
  - `collection_shared_photo_opened`
  - `collection_suggestion_opened`

## UX Rules

- Use small labels/chips, not long explanations.
- Keep the tab understandable as a future feed without promising public sharing.
- Use “シェア準備” while MVP only contains own photos and suggestions.
- Empty state must point back to adding photos.
- Feed cards should prioritize the photo and a short pose/scene label.

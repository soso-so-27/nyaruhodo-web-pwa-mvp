# photo-entry-redesign-and-p0 v1.0

作成日: 2026-07-10

## 便P0: 「自分だけ」のvisibility修正

目的: ホームのねがお投入確認で「自分だけ」を選んだ写真が、ねこだよりの審査・配達プールに混ざらないことを保証する。

## 仕様

- ホームUIで「自分だけ」を選んで「のこす」を押した写真は、localStorage の `nyaruhodo_exchange_own_sleeping_photos` に `shared: false` / `visibility: "private"` で保存する。
- 「自分だけ」の写真は、その日の20時便ターゲットに登録しない。
- backup API へ送る場合も `visibility: "private"` を維持する。
- backup API の `cat_moments.metadata.pool_kind` は、sharedの場合 `user_shared`、privateの場合 `user_private` とする。
- `visibility: "private"` の写真は、moderation queue と exchange candidate query のどちらにも入らない。
- 本番の既存行への遡及UPDATEは行わない。台帳表記の整合は今後の新規行から反映する。

## 受け入れ

- ホームUIから「自分だけ」→「のこす」後、該当エントリが `shared: false` / `visibility: "private"`。
- private保存時、`neteruneko_evening_delivery_days` に `targetOwnPhotoId` が作られない。
- `/api/sleeping-delivery/backup` にprivate photoをPOSTすると、DB上も `visibility: "private"` / `metadata.pool_kind: "user_private"`。
- moderation queue / exchange候補は `visibility: "shared"` のみを対象にする。

## 証跡

- UI→localStorage: `tests/e2e/home-sleeping-exchange-flow.spec.ts`
- API/DB: `tests/e2e/sleeping-delivery-pool-guards.spec.ts`
- 実装:
  - `src/components/home/HomeInput.tsx`
  - `src/lib/home/sleepingPhotos.ts`
  - `src/app/api/sleeping-delivery/backup/route.ts`

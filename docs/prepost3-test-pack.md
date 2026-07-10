# 投稿3前テスト強化パック

作成日: 2026-07-10

目的: 先行受け入れ前に、30人規模で折れやすい箇所、オンボ分岐の抜け、20時境界、再接続写真、軽量端末の表示負荷を機械で確認する。

## 1. 負荷スモーク

コマンド:

```bash
node scripts/prepost3-load-smoke.mjs --base-url=http://localhost:3000 --levels=30,60,120
```

Previewを叩く場合:

```bash
node scripts/prepost3-load-smoke.mjs --base-url=https://<preview-host> --levels=30,60,120
```

`npm run smoke:load:prepost3` はローカル既定値で走らせるショートカット。対象URLを指定する検証では、引数落ちを避けるため `node scripts/prepost3-load-smoke.mjs ...` を使う。

出力: `artifacts/prepost3-load-smoke/*.json`

対象:

- `/api/sleeping-delivery/exchange`: `debugDryRun=true`。DB書き込みなしで候補読み取りと選定経路の重さを見る。
- `/api/presence`: GET。
- `/api/photo-storage/signed-urls`: batch署名URL経路。権限確認を含む。
- `/api/sleeping-delivery/backup`: 既定は `invalid_photo` で安全に応答性だけを見る。

backupの実書き込みまで見る場合は、ローカル/Previewの捨て環境だけで以下を使う:

```bash
LOAD_SMOKE_ALLOW_BACKUP_WRITES=1 node scripts/prepost3-load-smoke.mjs --base-url=http://localhost:3000 --levels=30
```

判定:

- 30同時でネットワークエラー率 0。
- 30同時で `exchange-dry-run` p95 が 3秒未満なら先行30人規模はまず安全。
- 60/120で最初に折れたAPIを「120で最初に折れる箇所」として報告する。ここは修正判断用で、即ブロッカーとは限らない。
- `429` はrate limit由来なら想定内。想定外5xx/ネットワークエラーは要調査。

## 2. オンボ全分岐E2E

追加spec:

- `tests/e2e/onboarding-branch-matrix.spec.ts`

カバーする分岐:

- 通常Safari相当: Google + handoff が両方出る。
- LINE内ブラウザ: Googleを出さず、handoffを主導線にする。
- Instagram内ブラウザ: Googleを出さず、handoffを主導線にする。
- standalone PWA相当: Google + handoff が両方出る。
- 使用済みhandoff: ローカル復元済みならエラーで止めずにホームへ戻れる。

コマンド:

```bash
npx playwright test tests/e2e/onboarding-branch-matrix.spec.ts --project=mobile
```

既存の広いオンボ分岐は `tests/e2e/onboarding-delivery-flow.spec.ts` にあり、source/LINE/IG/referral/reset/handoff作成/20時前後ブリッジを引き続き担保する。

## 3. 20時・5時境界

追加spec:

- `tests/e2e/delivery-time-boundaries.spec.ts`

固定点:

- 19:54:59 JST: 当日便は `delivery_not_yet`
- 19:55:00 / 19:59:59 / 20:00:00 / 20:04:59 JST: 当日便OK
- 20:00:00 JST以降の新規撮影ターゲットは翌日
- 5時境界でJST date keyが壊れない

コマンド:

```bash
npx playwright test tests/e2e/delivery-time-boundaries.spec.ts --project=desktop
```

## 4. 復元・再接続の総合E2E

既存spec:

- `tests/e2e/home-day-cycle-indicator.spec.ts`
  - 空PWAでGoogle復元後、猫・cover・crop・storage photoが戻ることを確認。
- `tests/e2e/collection-album-flow.spec.ts`
  - 復元storage photoの一覧/詳細/署名URL variantを確認。
- `tests/e2e/photo-sources.spec.ts`
  - srcのみ/復元storage path/board/list/cover/detailの表示契約を確認。

コマンド例:

```bash
npx playwright test tests/e2e/home-day-cycle-indicator.spec.ts --project=mobile --grep "restores remote account photos"
npx playwright test tests/e2e/collection-album-flow.spec.ts --project=mobile --grep "restored storage"
npx playwright test tests/e2e/photo-sources.spec.ts --project=desktop
```

## 5. 軽量端末・アクセシビリティ機械監査

コマンド:

```bash
npm run audit:mobile:prepost3
```

Previewを叩く場合:

```bash
AUDIT_BASE_URL=https://<preview-host> npm run audit:mobile:prepost3
```

出力: `artifacts/prepost3-mobile-audit/*.json`

見るもの:

- `/home` `/onboarding` `/collection` の転送量上位リソース
- 横はみ出し
- 名前のないbutton
- `alt` 属性がないimg

この監査はPlaywrightのみで動く軽量版。正式なLighthouse/axeを追加する場合は、別便で依存追加とCI時間を判断する。

## 6. 推奨実行順

1. `npx playwright test tests/e2e/delivery-time-boundaries.spec.ts --project=desktop`
2. `npx playwright test tests/e2e/onboarding-branch-matrix.spec.ts --project=mobile`
3. `npx playwright test tests/e2e/photo-sources.spec.ts --project=desktop`
4. `npm run smoke:load:prepost3 -- --base-url=<target> --levels=30,60,120`
5. `npm run audit:mobile:prepost3`

## 7. 報告フォーマット

- 負荷: APIごとの p50 / p95 / errorRate / 120で最初に折れた箇所
- オンボ: matrix全緑か、フォールバックに落ちた分岐
- 時刻: 5境界全緑か
- 復元: 写真件数・variant・cover/cropが一致したか
- 軽量監査: 最大リソース上位3件、横はみ出し、無名button数、alt欠落数

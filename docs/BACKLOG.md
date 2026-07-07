# Backlog

- Tier2内の鮮度重み付け（撮影経過の弱い減衰・冬が来る前に） — 出典: 2026-07-07棚卸残 #10
- 投稿時の軽い猫検出「ねこが見つかりませんでした。このまま入れますか」（フェーズ2・AIパイプライン副産物） — 出典: 2026-07-07棚卸残 #10
- ブロック機能（この送り主から受け取らない・ストア配信要件） — 出典: 2026-07-07棚卸残 #10
- `--seal` の面利用を棚卸し、CANON例外にするか紙系へ戻すか決める — 出典: `docs/BRAND-GUIDELINE.md` v1.0 §11
- `手紙` / `一通` / `ねこだより` の外向き語彙ゆれを整理する — 出典: `docs/BRAND-GUIDELINE.md` v1.0 §11
- 旧 `docs/marketing/MARKETING-CANON.md` v0.1 の扱いをアーカイブ/削除/参照停止のどれかに決める — 出典: `docs/BRAND-GUIDELINE.md` v1.0 §11
- `FEATURE-IDEAS` 相当の「作らないものリスト」を一本化する — 出典: `docs/BRAND-GUIDELINE.md` v1.0 §11
- 実装内の未定義 `var(--font-serif)` 参照を現行書体トークンへ寄せる — 出典: `docs/BRAND-GUIDELINE.md` v1.0 §6

- grant hardening 本体 — 出典: `docs/specs/grant-hardening-spec.md`
- 未参照Storageオブジェクトの定期GC（105件棚卸済み） — 出典: `docs/incident-20260704-bulk-delete.md`
- 受信画像読み込み失敗時のグレースフルフォールバック表示 — 出典: `docs/opening-flow-inventory-2026-07.md`
- 孤児delivery 31件を踏んだ際のUI確認 — 出典: `docs/incident-20260704-bulk-delete.md`
- E2Eの networkidle 依存除去（既存4failの解消） — 出典: `docs/specs/incident-and-legal-audit-spec-v1.0.md`
- 【P3前ゲート】CI上でのSupabase local起動によるDB統合E2E実行 — 出典: `docs/specs/prod-migration-remediation-spec-v1.0.md`
- moderation cleanup恒久策（data URL/旧localStorage経路の監査） — 出典: `docs/incident-20260704-bulk-delete.md`
- 管理画面文言の日本語化（approve/reject→承認/除外） — 出典: `docs/incident-20260704-bulk-delete.md`
- セルフサービス退会UI（P3前） — 出典: `docs/legal-docs-inventory-2026-07.md`
- WebKit/Playwright環境整備 — 出典: `docs/specs/incident-and-legal-audit-spec-v1.0.md`
- 現像の印刷・発送手段調査＋住所PII法務追補（フェーズ1・business-strategy §8参照） — 出典: `docs/neteruneko-business-strategy-v1.2.md`
- rejected写真の同一localMomentId再送でpendingへ戻る審査ループ防止（再送時に既存rejectedを引き継ぐ案） — 出典: 2026-07-05コード監査 F1〜F4付帯
- 退会後Stripe webhookがsubscriptions行を復活させ得る件の確認（FK有無確認、auth user不在ならskip案） — 出典: 2026-07-05コード監査 F1〜F4付帯
- `toExchangePhotoFromDelivery` のtitle文字化け確認（実害なら修正、抽出時症状なら記録のみ） — 出典: 2026-07-05コード監査 F1〜F4付帯
- exchange冪等IDの旧32bit ID読み取りを削除（2026-07-13以降。実デプロイ日が遅れた場合はデプロイ日+8日以降） — 出典: 2026-07-05監査フォローアップ #4

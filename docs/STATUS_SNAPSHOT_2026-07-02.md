# STATUS SNAPSHOT 2026-07-02

対象リポジトリ: `nyaruhodo-web-pwa-mvp`

対象HEAD: `87067a7 Restore cat gallery photos after reconnect`

作成日: 2026-07-02

この文書は現状棚卸しです。コード実装は含みません。

## 1. 直近の実装履歴

### 直近20コミット

| ハッシュ | 日付 | 一行説明 |
| --- | --- | --- |
| `87067a7` | 2026-07-02 | Google再連携後に `catGalleryPhotos` を復元する処理を追加 |
| `c23c4db` | 2026-07-01 | 基本情報編集画面のデザインを再調整 |
| `b83893e` | 2026-07-01 | 基本情報編集画面のレイアウトを改善 |
| `76851a9` | 2026-07-01 | 基本情報に性格・ケアメモ系項目を追加 |
| `4d5bd57` | 2026-07-01 | 基本情報のラベルと方針を整理 |
| `007bbfc` | 2026-07-01 | `この子の写真` と `ねがお` の役割を分離 |
| `89134cd` | 2026-07-01 | `この子の写真` の上限・文言を整理 |
| `c57f8b7` | 2026-07-01 | 猫写真保存の画質・Storage参照方針を整理 |
| `aed55cb` | 2026-07-01 | ねがお追加後も `この子の写真` 導線を見えるように調整 |
| `6d0df65` | 2026-07-01 | `この子の写真` の追加・削除管理を改善 |
| `1c5a961` | 2026-07-01 | `__cat_gallery` を内部予約slotとして整理 |
| `54a4d17` | 2026-07-01 | `catGalleryPhotos` のアカウント同期を追加 |
| `7fb00b3` | 2026-07-01 | ねがお枚数の進捗表示を実データに合わせる |
| `2c97bf4` | 2026-07-01 | うちのこページで記念を足あとより上へ移動 |
| `b1ddb93` | 2026-07-01 | 記念UIのチェック表現を状態のしるしへ調整 |
| `31fd84d` | 2026-07-01 | `ピックアップ` などユーザー向けラベルを整理 |
| `b46be01` | 2026-07-01 | 年まとめのドリルダウンを改善 |
| `38dc493` | 2026-07-01 | 年まとめの統計を押せるようにする |
| `0624ed3` | 2026-07-01 | ねこだより月別表示をアクティブ猫にスコープ |
| `329c011` | 2026-07-01 | ねこだよりボードの初期月を現在月へ変更 |

### 未コミットの作業差分

この文書作成前の `git status --short` では、tracked file の変更は確認されませんでした。未追跡ファイルは複数あります。

主な未追跡グループ:

| 種別 | 内容 |
| --- | --- |
| Rive / 封筒アニメ調査系 | `docs/design/home-envelope-rive-*.md`, `public/animations/reference/*`, `public/animations/prototypes/*`, `scripts/*rive*.mjs` |
| 開封アニメ棚卸ドキュメント | `docs/envelope-reveal-audit.md` |
| 生成/検証ログ | `start-*.log`, `start-*.err.log` |
| artifacts | `artifacts/` |
| この文書 | `docs/STATUS_SNAPSHOT_2026-07-02.md` |

## 2. 機能の実装状態マトリクス

| 項目 | 状態 | 現状 | 該当ファイル |
| --- | --- | --- | --- |
| 長押し開封セレモニー | 部分実装 | Home側にはPointer/Touch系の対策や `touchAction` 系の処理が存在する。ただし本番ホーム夜8時便は直近で複雑な封筒開封から simple reveal に寄せており、「長押しセレモニー」としてiOS実機完了済みとはこの棚卸しでは確認できない。 | `src/components/home/HomeDeskModel.tsx`, `src/components/home/homeEnvelopeMotionConfig.ts`, `tests/e2e/home-desk-model.spec.ts`, `tests/e2e/home-sleeping-exchange-flow.spec.ts` |
| `とっておく` ボタン | 済 | ねこだより/思い出系の保存判断UIとして `とっておく` / `とっておいた` が存在する。仕様上はフルスクリーン写真ビュー・開封後判断画面側に置かれている。 | `src/components/home/HomeDeskModel.tsx`, `src/components/home/HomeInput.tsx`, `docs/specs/neteruneko-home-mainichi-v1.md` |
| 思い出便: 配信ポリシー | 部分実装 | 思い出便候補、頻度制御、休止/受け取らない制御が存在する。弔い/お別れ状態など将来状態との衝突抑制はTODOとして残っている。 | `src/lib/home/omoideDelivery.ts`, `src/components/home/HomeDeskModel.tsx`, `src/components/cats/CatsPage.tsx` |
| 思い出便: 封筒 | 部分実装 | ホーム上の通知/サブ通知として思い出便が出る実装がある。複雑な封筒演出の本番採用は現状抑制方向。 | `src/components/home/HomeDeskModel.tsx` |
| 思い出便: 全画面 | 部分実装 | `OmoideMemoryOverlay` 相当の全画面/オーバーレイ表示が存在する。 | `src/components/home/HomeDeskModel.tsx` |
| 思い出便: 文箱 | 部分実装 | うちのこ側に思い出便の文箱セクションが存在する。 | `src/components/cats/CatsPage.tsx`, `src/lib/home/omoideDelivery.ts` |
| 思い出便: 安全装置 | 部分実装 | 休止・受け取らない制御は存在する。弔い/お別れ状態との連動などは未完了。 | `src/lib/home/omoideDelivery.ts` |
| ねこタブ: 迎えた日ヒーロー | 部分実装 | 基本情報の `familySinceDate` と家族日数表示・記念表示に使われている。独立した大型ヒーロー体験として完了とは断定しない。 | `src/components/cats/CatsPage.tsx`, `src/lib/cats/celebrations.ts` |
| ねこタブ: むぎの日 / 今日の1件 | 部分実装 | ユーザー向けには `今日の1件` として整理済み。誕生日・思い出・記念などから候補を出すロジックがある。 | `src/lib/cats/pickup.ts`, `src/components/cats/CatsPage.tsx`, `tests/e2e/cat-pickup-logic.spec.ts` |
| ねこタブ: むぎとの日々 | 部分実装 | 足あと・記念・基本情報・写真・年まとめがある。体験全体としては継続整理中。 | `src/components/cats/CatsPage.tsx`, `src/lib/cats/footprints.ts`, `src/lib/cats/celebrations.ts` |
| ねこタブ: 年の畳み | 済 | 年まとめシート、写真/思い出/記念のドリルダウンが存在する。 | `src/components/cats/CatsPage.tsx`, `src/lib/cats/yearSummary.ts`, `tests/e2e/cat-year-summary-logic.spec.ts` |
| ねこタブ: 製本導線 | 未着手 | 将来の物販/小さな本/カレンダー方針はdocsにメモされているが、本番UIとしての製本導線は確認できない。 | `docs/photo-domain-inventory.md` |
| オンボーディング step 1: 初回説明/写真投入 | 済 | `/onboarding` で初回説明、写真投入、source付き導線が存在する。 | `src/components/onboarding/OnboardingFlow.tsx`, `src/lib/onboarding/progress.ts`, `tests/e2e/onboarding-delivery-flow.spec.ts` |
| オンボーディング step 2: 猫名/預かり | 済 | 写真投入後に猫名入力を任意で扱う状態が実装済み。 | `src/components/onboarding/OnboardingFlow.tsx` |
| オンボーディング step 3: 即時ねこだより/開封 | 済 | 到着、開封、開封済み復元、届いた写真保存がE2E対象。 | `src/components/onboarding/OnboardingFlow.tsx`, `tests/e2e/onboarding-delivery-flow.spec.ts` |
| オンボーディング step 4: アルバム作成/Google継続 | 済 | Googleで続ける/あとで、アルバム作成促進がある。 | `src/components/onboarding/OnboardingFlow.tsx`, `src/app/account/create/page.tsx` |
| 認証: アノンユーザーの配達プール直接アクセス | 済 | anonの `cat_moments` 直接selectはRLS migrationで閉じる方向。匿名オンボーディングはAPI経由の制御された経路で扱う。 | `supabase/migrations/20260611173000_revoke_anon_cat_moments_select.sql`, `src/app/api/sleeping-delivery/exchange/route.ts`, `src/app/api/photo-storage/signed-url/route.ts` |
| モデレーション | 部分実装 | 通報API、photo_reports、モデレーションqueue/decision API、settings内の管理パネルが存在する。完全自動審査や運用完備までは確認できない。 | `src/app/api/reports/route.ts`, `src/app/api/moderation/queue/route.ts`, `src/app/api/moderation/decide/route.ts`, `src/components/settings/SettingsPage.tsx`, `supabase/migrations/20260612093000_create_photo_reports.sql`, `supabase/migrations/20260613090000_spec_v1_3_delivery_moderation.sql` |
| データ層: localStorage依存 | 部分実装 | 多くのクライアント状態がlocalStorageに残る。account syncで一部Supabase同期されるが、完全DB化ではない。 | `src/lib/storage/keys.ts`, `src/lib/accountSync.ts`, `src/lib/home/sleepingPhotos.ts`, `src/lib/cats/catGalleryPhotos.ts`, `src/components/collection/CollectionPage.tsx` |
| データ層: Supabase | 部分実装 | ねがお/配達/collection/この子の写真同期/analytics/report/subscriptionなどはSupabaseに載っている。クライアントUI状態や一部legacy data URL fallbackは残る。 | `src/lib/accountSync.ts`, `src/app/api/sleeping-delivery/exchange/route.ts`, `src/app/api/photo-storage/signed-url/route.ts`, `src/app/api/admin/analytics/route.ts`, `supabase/migrations/*` |
| プッシュ通知 | 部分実装 | `Notification.requestPermission()` を使う許可導線はある。Web Push subscription、サーバー送信、VAPID、通知配信APIは確認できない。 | `src/components/home/HomeInput.tsx`, `src/components/pwa/ServiceWorkerRegistrar.tsx`, `public/sw.js` |

### localStorage依存箇所一覧

| ドメイン | 主なkey/内容 | 該当ファイル |
| --- | --- | --- |
| 猫プロフィール/アクティブ猫 | `cat_profiles`, `active_cat_id`, legacy `cat_profile` | `src/lib/storage/keys.ts`, `src/components/home/homeInputHelpers.ts`, `src/components/cats/CatsPage.tsx` |
| この子の写真 | `neteruneko_cat_gallery_photos` | `src/lib/cats/catGalleryPhotos.ts`, `src/lib/accountSync.ts` |
| 通常collection | `collection_photos` | `src/components/collection/CollectionPage.tsx`, `src/lib/accountSync.ts`, `src/lib/collection/dailyTarget.ts` |
| 自分のねがお | `nyaruhodo_exchange_own_sleeping_photos` | `src/lib/home/sleepingPhotos.ts`, `src/components/cats/CatsPage.tsx` |
| とどいたねこだより | `nyaruhodo_exchange_kept_photos` | `src/lib/home/sleepingPhotos.ts` |
| 夜8時便状態 | `neteruneko_evening_delivery_days` | `src/lib/home/eveningDelivery.ts` |
| 思い出便 | `neteruneko_omoide_memories`, `neteruneko_omoide_memory_controls` | `src/lib/home/omoideDelivery.ts` |
| オンボーディング | `neteruneko_onboarding_progress`, `onboarding_completed` | `src/lib/onboarding/progress.ts`, `src/components/onboarding/OnboardingFlow.tsx` |
| analytics | `analytics_anonymous_id`, `analytics_event_queue`, `analytics_session` | `src/lib/analytics/productAnalytics.ts` |
| 認証補助 | `auth_google_pending`, Supabase auth storage | `src/app/account/create/page.tsx`, `src/app/auth/callback/page.tsx`, `src/lib/supabase/browser.ts` |
| PWA/通知/安全確認 | install hint dismiss, notification permission event, sleeping safety accepted | `src/components/home/HomeInput.tsx` |
| 猫ごとの診断/記録/発見ログ | `getRecordLogKey`, `getLockDataKey`, `getDiscoveryLogKey`, `getLightDataKey` | `src/lib/storage/keys.ts`, `src/components/home/HomeInput.tsx` |
| referral | `neteruneko_pending_referral_code` | `src/lib/referrals/client.ts` |
| picker履歴 | cat pickup history | `src/lib/cats/pickup.ts` |

### Supabaseに載っている箇所一覧

| ドメイン | テーブル/ビュー/API | 該当ファイル |
| --- | --- | --- |
| ねがお/配達候補 | `cat_moments`, `cat_moment_deliveries` | `src/app/api/sleeping-delivery/exchange/route.ts`, `src/lib/accountSync.ts`, `src/lib/home/sleepingPhotoBackup.ts` |
| この子の写真同期 | `collection_photos.slot_slug="__cat_gallery"` | `src/lib/accountSync.ts`, `src/lib/collection/dailyTarget.ts` |
| 通常collection同期 | `collection_photos` with `slot_slug != "__cat_gallery"` | `src/lib/accountSync.ts`, `src/components/collection/CollectionPage.tsx` |
| 猫プロフィール | `cats.basic_info` 等 | `src/lib/accountSync.ts`, `src/components/cats/CatsPage.tsx` |
| analytics | `app_events`, analytics views | `src/lib/analytics/productAnalytics.ts`, `src/app/api/admin/analytics/route.ts`, `supabase/migrations/20260628120000_create_app_events.sql` |
| 通報/モデレーション | `photo_reports`, moderation APIs | `src/app/api/reports/route.ts`, `src/app/api/moderation/queue/route.ts`, `src/app/api/moderation/decide/route.ts` |
| サブスクリプション | `subscriptions` | `supabase/migrations/20260607093000_create_subscriptions.sql`, Stripe関連API |
| beta/referral/feedback | `beta_feedback`, `beta_participants`, `referrals`, `hint_feedbacks` | `supabase/migrations/*beta*`, `supabase/migrations/20260625090000_create_referrals.sql` |
| presence/diagnostics | `cat_moments` 読み取り系API | `src/app/api/presence/route.ts`, `src/app/api/sleeping-delivery/diagnostics/route.ts` |

## 3. テストの現状

### テスト数

| 種別 | ファイル数 | test数 | 備考 |
| --- | ---: | ---: | --- |
| Playwright E2E | 16 | 136 | `tests/e2e/*.spec.ts` |
| Playwright shots/visual | 2 | 11 | `tests/shots/*.spec.ts` |
| ユニット | 0 | 0 | 専用のunit test runner/scriptsは確認できない。ロジック系もPlaywright test runner内で実行されている。 |

合計: 18 spec files / 147 tests

### 最後に全部緑だった時点

この棚卸しではテストを実行していません。

直近作業で確認されているのは、2026-07-02時点で `npm run typecheck`, `npm run build`, `git diff --check` が通ったことです。`npm run e2e` 全件が最後に緑だった正確な時点は、このリポジトリ内の履歴だけでは確定できません。

### 実機でしか検証できない項目

| 項目 | 理由 |
| --- | --- |
| iPhone Instagram in-app browser の写真選択 | PlaywrightではInstagramアプリ内ブラウザ固有のファイル選択挙動を再現できない。 |
| iPhone Safari/PWA のStorage分離・再連携 | Safari/PWA/InstagramでlocalStorage/session扱いが異なる可能性がある。 |
| Google OAuth本番callback | 実際のGoogle/本番ドメイン/ブラウザ状態が必要。 |
| 長押し/Pointer capture/touch-actionの実機感 | iOS SafariのPointer/Touch挙動はdesktop Playwrightと差がある。 |
| 20時跨ぎの夜8時便 | 実時間、visibilitychange、focus、復帰挙動は実機確認が必要。 |
| Notification permission / Push | ブラウザ・PWA・OS許可状態に依存する。 |
| 大きな写真のメモリ/再エンコード | Instagram内ブラウザや古いiPhoneでのメモリ圧迫は実機でないと見えにくい。 |
| Stripe本番Checkout/Customer Portal | Live key、本番Webhook、本番Customer状態が必要。 |
| Supabase Storage/RLS本番policy | 実際の本番project policyとenvに依存する。 |

## 4. 既知の問題・TODO

### コード内 TODO/FIXME

| ファイル | 内容 |
| --- | --- |
| `src/components/home/HomeInput.tsx` | `// TODO: Supabase移行時はここを書き換え` |
| `src/components/home/HomeInput.tsx` | `// TODO: Supabase移行時はここを書き換え` |
| `src/lib/home/omoideDelivery.ts` | `// TODO: When farewell/memorial state exists, suppress celebratory memory` |

`FIXME` / `HACK` はコード内検索では確認されませんでした。

### docs内TODO

| ファイル | 内容 |
| --- | --- |
| `docs/photo-domain-inventory.md` | P1/P2 TODOとして、写真ドメイン・Storage実体削除・将来方針が残っている。 |
| `docs/public-launch-readiness-inventory.md` | 公開前棚卸のP1/P2 TODOが残っている。 |
| `docs/STATUS_REPORT.md` | 過去時点のTODO/FIXME棚卸が残っている。 |

### 動くが仮実装/制約が残る箇所

| 項目 | 現状 |
| --- | --- |
| localStorage依存 | 猫プロフィール、ねがお、とどいた写真、collection、オンボーディング、夜8時便、思い出便など多くがlocalStorage起点。account syncで一部Supabaseへ退避するが完全DB駆動ではない。 |
| `ownSleepingPhotos` legacy fallback | 初回体験維持のため、既存/匿名の圧縮済みdata URL fallbackが残り得る。新規 `catGalleryPhotos` はStorage参照方針。 |
| `catGalleryPhotos` sync | `collection_photos.slot_slug="__cat_gallery"` を内部予約slotとして利用する短期実装。通常collectionからは除外する必要がある。 |
| Storage実体削除 | `この子の写真` の削除はUI/同期上の削除中心。Storage実体削除は将来TODO扱い。 |
| Push通知 | 権限取得はあるが、Web Push subscription/server deliveryは未確認。 |
| 思い出便安全装置 | 休止/受け取らないはあるが、弔い/お別れ状態との連動抑制はTODO。 |
| モデレーション | 通報/queue/decisionは存在するが、完全な自動審査や運用手順は別途必要。 |
| 管理/テスト導線 | 設定画面・admin系に確認用導線があり、本番flag/admin guardの継続確認が必要。 |
| Rive/封筒アニメ資産 | 多数の未追跡Rive/アニメ検討ファイルがある。本番simple revealとは別の調査資産。 |
| Stripe本番 | Checkout到達は確認されたが、税設定・Webhook・Customer Portal・本番envは運用確認が必要。 |

## 5. リリースまでの距離（Codexの見立て）

以下は事実棚卸しに基づく見立てです。希望やロードマップではなく、「実ユーザーに小さく公開する」ために最低限リスクを下げる作業です。

### 最低限必要な残作業

| 優先度 | 残作業 | 根拠 |
| --- | --- | --- |
| P0 | 本番Supabase/Vercel envの最終確認 | Auth、Storage signed URL、Stripe、analytics、admin guardはenvに依存する。ローカルコードだけでは本番保証できない。 |
| P0 | iPhone Safari / Instagram in-app browserでオンボーディング完走 | 写真選択、Google継続、Storage、signed URL、PWA案内非表示は実機依存。 |
| P0 | `catGalleryPhotos` 再連携復元の実機確認 | 直近で再連携後の `この子の写真` 空表示を修正したため、local空/remoteあり、localあり/remote空、重複なしの確認が必要。 |
| P0 | `/admin/analytics` と非admin guard確認 | `app_events` を見る運用が公開直後の判断軸になる。非管理者に見えないことも公開前P0。 |
| P0 | Storage/RLS/signed URLの本番確認 | 猫写真を扱うため、private bucket、signed URL認可、anon直接select不可が本番で効いている必要がある。 |
| P0 | Stripe Liveの最終確認 | 本番Checkout、Webhook secret、Customer Portal、税表示、価格IDがLive envで一致している必要がある。 |
| P1 | `npm run e2e` 全件の現時点実行 | 現在の全件最終green時点が不明。リリース前に一度全件実行した方がよい。 |
| P1 | Storage実体削除の運用メモ | `この子の写真` 削除でStorage実体が残る可能性がある。公開直後は許容でも、問い合わせ/削除依頼対応手順が必要。 |
| P1 | Push通知の位置づけを明確化 | 現状は許可取得止まり。ユーザーに通知体験として期待させるならサーバーPushが必要。期待させないなら文言を抑える。 |
| P1 | モデレーション運用確認 | 通報/queueは存在するが、公開後に誰が見るか、問題写真をどう非表示にするかの運用確認が必要。 |
| P1 | legacy data URLの扱い | 新規方針はStorage参照だが、legacy data URL fallbackが残る。容量や同期上限の観点で移行方針を後続で決める必要がある。 |

### 小規模公開の見立て

コード上のP0穴は多く塞がっているが、実機・本番env・運用確認に依存する項目が残っています。

現状は「コードだけなら小規模公開の直前段階」に近い一方で、以下の確認なしに広く出すのは危険です。

- iPhone Instagram in-app browserでのオンボーディング完走
- 本番Storage signed URL/RLS確認
- 管理者analytics確認
- Stripe Live checkout/webhook確認
- `この子の写真` 再連携復元の本番相当確認

上記が通れば、まずは信頼できる少人数へのDMテスト、その後に小さなInstagramストーリー公開が現実的です。

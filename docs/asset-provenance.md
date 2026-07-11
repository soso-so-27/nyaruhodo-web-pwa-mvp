# Asset Provenance

> 初版: 2026-07-11  
> 目的: 画像・イラスト資産の生成元と用途を、後から確認できる状態に保つ。

## 運用ルール

生成アセットを追加するときは、コードへ接続するのと同じ変更便でこの原簿へ、モデル名、生成日、用途、プロンプト要約、配置先を記録する。モデル識別子がツールから開示されない場合は、推測せずその旨を記す。

## 2026-07-11 猫イラストテーマ候補

生成方法: Codex組み込みのOpenAI `image_gen`。個別のモデル識別子はツールから開示されていない。1024px以上の正方形画像を生成し、単色クロマキー除去後、用途別に640px・256px・192pxへ縮小してWebP化した。

共通条件: 透明背景、文字・透かしなし、中央配置、和紙に合う穏やかな配色（cream `#f4f1ea`、ink brown `#4a3f35`、muted red `#a8584e`）、静かな日本の文具意匠。ナビ・切替は96px縮小でも判別できる単純な輪郭を優先した。

| 生成日 | テーマ | 用途 | プロンプト要約 | 配置先 |
|---|---|---|---|---|
| 2026-07-11 | A 水彩 | ホーム空状態 | 円く眠る同じ茶白猫、水彩、淡いzzz、余白 | `public/illustrations/candidates/theme-a/home-empty-cat.webp` |
| 2026-07-11 | A 水彩 | きょうナビ | 写真枠の中で眠る同じ猫、極小水彩アイコン | `public/illustrations/candidates/theme-a/nav-today.webp` |
| 2026-07-11 | A 水彩 | うちのこナビ | 上から見た円い寝猫、極小水彩アイコン | `public/illustrations/candidates/theme-a/nav-uchinoko.webp` |
| 2026-07-11 | A 水彩 | 猫切替 | 重なる2匹の寝猫、同じ水彩筆致 | `public/illustrations/candidates/theme-a/cat-switcher.webp` |
| 2026-07-11 | B 線画・判子 | ホーム空状態 | 円く眠る猫、茶の単線、判子意匠、淡いzzz | `public/illustrations/candidates/theme-b/home-empty-cat.webp` |
| 2026-07-11 | B 線画・判子 | きょうナビ | 写真枠と円い寝猫、茶の単線、文字なし | `public/illustrations/candidates/theme-b/nav-today.webp` |
| 2026-07-11 | B 線画・判子 | うちのこナビ | 円くなる猫、茶の単線、文字なし | `public/illustrations/candidates/theme-b/nav-uchinoko.webp` |
| 2026-07-11 | B 線画・判子 | 猫切替 | 並んで眠る2匹、茶の単線、文字なし | `public/illustrations/candidates/theme-b/cat-switcher.webp` |
| 2026-07-11 | C 色鉛筆 | ホーム空状態 | 茶白猫の寝姿、絵本調の色鉛筆、淡いzzz | `public/illustrations/candidates/theme-c/home-empty-cat.webp` |
| 2026-07-11 | C 色鉛筆 | きょうナビ | 写真枠の中の寝猫、色鉛筆、文字なし | `public/illustrations/candidates/theme-c/nav-today.webp` |
| 2026-07-11 | C 色鉛筆 | うちのこナビ | 円くなる同じ猫、色鉛筆、文字なし | `public/illustrations/candidates/theme-c/nav-uchinoko.webp` |
| 2026-07-11 | C 色鉛筆 | 猫切替 | 重なる2匹の寝猫、色鉛筆、文字なし | `public/illustrations/candidates/theme-c/cat-switcher.webp` |

生成時、テーマB/Cの小アイコンに不要なzzz・装飾印が混入した初稿は不採用とし、「文字・睡眠記号・署名・小印なし」を明示して再生成した。テーマBホーム初稿の右下に生成された小さな署名風印は採用画像から除去した。

## 既存資産

| 資産群 | 由来 | 記録状況 |
|---|---|---|
| `public/illustrations/sleeping-cat-empty.*` | AI生成 | 詳細記録なし（2026-07以前） |
| `public/icons/bottom-nav-{today,mainichi,uchinoko}.*` | AI生成 | 詳細記録なし（2026-07以前） |
| `public/icons/cat-switch-generated.*` | AI生成 | 詳細記録なし（2026-07以前） |
| `public/icon-envelope-v2-*` | AI生成を含む封筒・封蝋系 | 詳細記録なし（2026-07以前） |
| `public/splash/startup-envelope-*` | AI生成・コード生成が混在 | 詳細記録なし（2026-07以前） |
| `public/animations/reference/home-envelope-rive-layers-v2/*` | 生成ラスタレイヤー | 詳細記録なし（2026-07以前） |

素材サイト、購入素材、外部配布元を示す記録は、2026-07-11の棚卸時点では確認できていない。

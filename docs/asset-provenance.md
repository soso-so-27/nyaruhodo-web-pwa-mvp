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

## 2026-07-11 テーマB詳細候補

生成方法は上記テーマ候補と同じCodex組み込みのOpenAI `image_gen`。単色クロマキー除去後、640×640の透過WebPへ整えた。全案とも単色`#4a3f35`を基準にし、線の太さ、閉じ方、寝姿、表情量、zzzの有無を意図的に振った。

| 生成日 | 候補 | 造形軸 | 配置先 |
|---|---|---|---|
| 2026-07-11 | b1 | 極細・一筆円・最小表情・zzzなし | `public/illustrations/candidates/theme-b-variants/b1.webp` |
| 2026-07-11 | b2 | 中線・一筆円・前足あり・zzzあり | `public/illustrations/candidates/theme-b-variants/b2.webp` |
| 2026-07-11 | b3 | 太い判子線・閉じた円・最小表情・zzzなし | `public/illustrations/candidates/theme-b-variants/b3.webp` |
| 2026-07-11 | b4 | 極細・複数スケッチ線・隙間のある円・zzzなし | `public/illustrations/candidates/theme-b-variants/b4.webp` |
| 2026-07-11 | b5 | 中線・頭を少し上げた丸まり・zzzあり | `public/illustrations/candidates/theme-b-variants/b5.webp` |
| 2026-07-11 | b6 | 太線・外形中心・頭を上げた丸まり・zzzなし | `public/illustrations/candidates/theme-b-variants/b6.webp` |
| 2026-07-11 | b7 | 極細・香箱・内側情報あり・zzzなし | `public/illustrations/candidates/theme-b-variants/b7.webp` |
| 2026-07-11 | b8 | 中線・香箱・緩いスケッチ・zzzあり | `public/illustrations/candidates/theme-b-variants/b8.webp` |
| 2026-07-11 | b9 | 太い判子線・横たわり・シルエット寄り・zzzなし | `public/illustrations/candidates/theme-b-variants/b9.webp` |
| 2026-07-11 | b10 | 中線・横たわり・表情と前足あり・zzzあり | `public/illustrations/candidates/theme-b-variants/b10.webp` |

SVG/CSS検証には、判子らしい太さと円い静けさが最も両立したb3を選定。`b3-ink.svg`へ単純化してトレースし、CSS maskとして描画することで線色を`--home-illustration-ink`へ接続した。これは当選決定ではなく、ambient追従が成立するかを見る技術検証である。

## 2026-07-11 テーマD シルエット候補

生成方法は上記と同じ。起動画面の和紙と封蝋を原点に、単色面の質、色、寝姿、白抜き線、zzzを振った。単色面のためCSS変数化との相性をテーマBより高く評価し、SVG/CSS検証の本命をd1へ移した。

| 生成日 | 候補 | 造形軸 | 配置先 |
|---|---|---|---|
| 2026-07-11 | d1 | 赤茶の朱肉かすれ・完全な円・白抜き最小線 | `public/illustrations/candidates/theme-d-silhouette/d1.webp` |
| 2026-07-11 | d2 | 赤茶の朱肉かすれ・頭の起伏・白抜き目 | `public/illustrations/candidates/theme-d-silhouette/d2.webp` |
| 2026-07-11 | d3 | 墨のリノカット・円い丸まり・zzzあり | `public/illustrations/candidates/theme-d-silhouette/d3.webp` |
| 2026-07-11 | d4 | 赤茶のリノカット・香箱・白抜き目耳 | `public/illustrations/candidates/theme-d-silhouette/d4.webp` |
| 2026-07-11 | d5 | 紙繊維が透ける薄墨・円い丸まり・zzzあり | `public/illustrations/candidates/theme-d-silhouette/d5.webp` |
| 2026-07-11 | d6 | 赤茶の薄墨・香箱・白抜き目 | `public/illustrations/candidates/theme-d-silhouette/d6.webp` |
| 2026-07-11 | d7 | 墨のフラットベタ・完全な円・比較基準 | `public/illustrations/candidates/theme-d-silhouette/d7.webp` |
| 2026-07-11 | d8 | 赤茶のフラットベタ・頭の起伏・白抜き目耳 | `public/illustrations/candidates/theme-d-silhouette/d8.webp` |
| 2026-07-11 | d9 | 紙より濃いクリーム・円・最小の墨線・zzzあり | `public/illustrations/candidates/theme-d-silhouette/d9.webp` |
| 2026-07-11 | d10 | 墨の木版かすれ・香箱・白抜き耳 | `public/illustrations/candidates/theme-d-silhouette/d10.webp` |

d1を`d1-ink.svg`へ単純化してトレースし、CSS maskの面色を`--home-illustration-ink`へ接続した。朝・昼・夕・夜の4時点で背景と面色が同時に変わることをスクリーンショットとE2Eで検証する。

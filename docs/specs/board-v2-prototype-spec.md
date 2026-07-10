# ねこだよりボード v2 プロトタイプ

> Final selection correction (2026-07-11): production uses the `current` placement algorithm with natural ratios, f3 frames, no date badges, and newest-first order. The v2 stacked placement was not selected.

ステータス: Deprecated（2026-07-10）。判定結果「原寸型 × f3 × 日付なし × 新しい順」を
本番のねこだよりへ移植済み。`/prototypes/board-v2` と `/admin/board-v2` は案内スタブのみ。
表示仕様の正は `CollectionPage` とする。
画面の器は `CollectionPage` をそのまま使い、プロトタイプでは写真ボードだけを
差し替える。月選択、面のタブ、紙背景、余白、下部ナビ、写真ビューアは本番と同一である。

## 比較するもの

- 配置: `v2`（新しい順に緩く積む）/ `現行`（比較用の整列）
- 写真の形: `crop`（同形・cover）/ `原寸`（naturalWidth / naturalHeightから
  実アスペクト比を使い、containで表示）
- 枠: `f1`（太い白枠とマステ）/ `f2`（細フチ）/ `f3`（ほぼ枠なし）
- 席順: `新しい順` / `明るい順`（16px canvasの平均輝度による実験）

画面上には比較UIを置かない。URLクエリで指定する。

`?mode=v2&layout=natural&frame=f3&order=brightest`

`mode=current` は差し替えを行わず、通常の `MainichiMonthBoard` を描画するため、
本番ページの基準線になる。原寸型はサイズ未取得時に正方形を確保し、取得後は
アニメーションなしで写真本来の比率に確定する。
輝度をCORS等で取得できない写真は、時系列順のままにする。

## 判定

実写真で `crop/原寸` と `f1/f2/f3` を比較し、写真の主役性、散らばりの風情、
縦横混在の静けさ、接地感、月初の少枚数で判断する。採用する組合せを一つ決めてから、
本番移植を別specで起票する。

## 対象外

- 本番のねこだよりのレイアウト変更
- うちのこ写真グリッドの棚型への変更（同じ週末便で別途判断）
- 写真のintrinsic dimensionsを保存形式へ追加すること

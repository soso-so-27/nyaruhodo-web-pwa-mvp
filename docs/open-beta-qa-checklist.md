# Open Beta QA Checklist

Last updated: 2026-05-24

目的は、SNSで小さく公開する前に「ユーザーが診断から入り、ホームで記録し、保存導線まで進めるか」と「その行動が計測できているか」を確認すること。

## 0. 前提

- Production URL: `https://nyaruhodo-web-pwa-mvp.vercel.app`
- Supabase SQL Editorで `public.product_analytics_events` を確認できること。
- 環境変数やsecretは表示しない。
- cat name, email, image data, free textはanalyticsに送らない。
- QAで実名の猫名を使っても、イベントには名前そのものは保存されない。

## 1. まず見るSQL

### 直近30分のイベント確認

```sql
select
  name,
  route,
  source,
  count(*)::int as count,
  max(created_at) as latest_created_at
from public.product_analytics_events
where created_at >= now() - interval '30 minutes'
group by name, route, source
order by latest_created_at desc;
```

### 最新イベント50件

IDやpropertiesは見ず、イベント名とrouteだけを見る。

```sql
select
  name,
  route,
  source,
  created_at
from public.product_analytics_events
where created_at >= now() - interval '30 minutes'
order by created_at desc
limit 50;
```

### Googleログインだけ確認

```sql
select
  name,
  count(*)::int as count,
  max(created_at) as latest_created_at
from public.product_analytics_events
where created_at >= now() - interval '3 hours'
  and name like 'auth_google%'
group by name
order by name;
```

### 診断完了だけ確認

```sql
select
  name,
  count(*)::int as count,
  max(created_at) as latest_created_at
from public.product_analytics_events
where created_at >= now() - interval '3 hours'
  and name in (
    'diagnosis_onboarding_started',
    'diagnosis_final_result_viewed',
    'diagnosis_result_saved',
    'diagnosis_onboarding_completed',
    'diagnosis_home_started'
  )
group by name
order by name;
```

## 2. 診断オンボーディングQA

### 操作

1. Freshに近い状態で `/` を開く。
2. `/diagnosis-onboarding` に入る。
3. 名前を入力する。
4. 写真を追加、またはスキップして毛色を選ぶ。
5. 基本情報を入力、またはスキップする。
6. 最初の3問に回答する。
7. 途中結果を見る。
8. 追加5問に回答する。
9. 最終結果を見る。
10. トリセツに残して次へ進む。
11. はじめる/みっけ開始で `/home` に戻る。

### 期待イベント

- `diagnosis_onboarding_started`
- `diagnosis_name_submitted`
- `diagnosis_photo_added` or `diagnosis_photo_skipped`
- `diagnosis_coat_selected` if photo skipped
- `diagnosis_basic_info_submitted` or `diagnosis_basic_info_skipped`
- `diagnosis_question_answered`
- `diagnosis_provisional_result_viewed`
- `diagnosis_refinement_started`
- `diagnosis_final_result_viewed`
- `diagnosis_collection_preview_viewed`
- `diagnosis_result_saved`
- `diagnosis_onboarding_completed`
- `diagnosis_home_started`
- `home_viewed`

### OK基準

- 最終的に `/home` が表示される。
- `cat_profiles` と `active_cat_id` が残る。
- 直近イベントに `diagnosis_onboarding_completed` がある。
- `diagnosis_question_answered` が8件前後入る。

## 3. ホームQA

### 操作

1. `/home` を開く。
2. 猫切り替えがある場合、左右スワイプまたは猫アイコンで切り替える。
3. `みっけ` を開く。
4. ようすを1つ記録する。
5. `おせわ` を開く。
6. してあげたことを1つ記録する。
7. 写真導線が出ている場合、写真追加を開く。

### 期待イベント

- `home_viewed`
- `home_cat_switched` if switched
- `home_recommendation_board_peeked`
- `home_recommendation_card_tapped`
- `home_mikke_opened`
- `home_mikke_recorded`
- `home_care_opened`
- `home_care_recorded`
- `home_photo_action_opened`
- `home_photo_added` if photo added

### OK基準

- 記録後にロック/カウントダウンが見える。
- localStorageの記録が消えない。
- `home_mikke_recorded` と `home_care_recorded` がDBに入る。

## 4. トリセツQA

### 操作

1. `/torisetu` を開く。
2. 発見/診断結果カードを開く。
3. 診断カードがある場合、開始する。
4. ロック中カードが表示されるか確認する。

### 期待イベント

- `torisetu_viewed`
- `torisetu_result_card_opened`
- `torisetu_diagnosis_card_started`
- `torisetu_diagnosis_completed` if completed
- `torisetu_locked_card_viewed`

### OK基準

- トリセツが「たまっていくナレッジ棚」に見える。
- ホームのおすすめカードと役割が重複しすぎていない。
- イベントが直近30分クエリに出る。

## 5. コレクションQA

### 操作

1. `/collection` を開く。
2. 今日の見つけたい姿を見る。
3. グループ/カテゴリを切り替える。
4. 空スロットまたは既存スロットを開く。
5. 写真追加を試す。
6. 見つけた表示/share導線を確認する。

### 期待イベント

- `collection_viewed`
- `collection_target_viewed`
- `collection_group_selected`
- `collection_slot_opened`
- `collection_photo_add_started`
- `collection_photo_added`
- `collection_pose_found`
- `collection_share_tapped`

### OK基準

- コレクションが「写真を集めたくなる棚」に見える。
- 空アイコン背景が重く見えない。
- 写真追加後に該当イベントが入る。

## 6. アカウント作成QA

### 操作

1. `/account/create` を開く。
2. 未ログイン時に「無料で保存する」を押す。
3. Googleログインを完了する。
4. `/home` に戻る。
5. 猫、写真、みっけ記録が残っているか見る。
6. ログイン済みで `/account/create` を開き、接続済み表示になるか確認する。

### 期待イベント

- `account_create_cta_viewed`
- `account_create_cta_clicked`
- `auth_google_started`
- `auth_google_succeeded`
- エラー時のみ `auth_google_failed`

### OK基準

- `auth_google_succeeded` がDBに入る。
- `cat_profiles`, `active_cat_id`, `record_log_*`, `collection_photos` が消えない。
- ログイン後に「保存完了」「同期済み」と言っていない。

## 7. PWA / 表示QA

### 操作

1. iPhone Safariで本番URLを開く。
2. ホーム画面に追加する。
3. PWAとして起動する。
4. ホーム、トリセツ、コレクション、ねこを順に開く。
5. 下部帯、横揺れ、SafeArea、BottomNav被りを見る。

### OK基準

- PWA起動時に不自然な下部帯がない。
- 主要操作がBottomNavに隠れない。
- ホーム背景写真が全画面に見える。
- タブ間のロード画面が統一されている。

## 8. オープンβ公開前チェック

### Product

- タイプ診断から自然に入れる。
- 診断結果がトリセツに残る。
- ホームは「見つけた瞬間に記録する場所」に見える。
- トリセツは「たまっていくナレッジ棚」に見える。
- コレクションは「写真を集めたくなる棚」に見える。
- ねこタブは「プロフィール管理」に集中している。

### Data

- `product_analytics_events` にイベントが入る。
- 診断完了ファネルがSQLで見られる。
- Googleログイン成功がSQLで見られる。
- 個人情報や画像データをanalyticsに送っていない。

### Release

- `npm run typecheck` が通る。
- `npm run build` が通る。
- `git status` がクリーン。
- 本番URLが200応答。
- PWA再追加後も表示が崩れない。

## 9. 迷ったときの判断

- 直す優先度が高い: 診断完了できない、ホームで記録できない、ログインでデータが消える、イベントが入らない。
- 次に高い: PWA表示崩れ、BottomNav被り、主要カードの誤タップ。
- 低い: 文言の細かい好み、カード順、ロック中カードの仮データ。


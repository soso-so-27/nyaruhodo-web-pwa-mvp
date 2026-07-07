# auth-matrix.md — システム地図 成果物3-3（認可マトリクス）

> API × 主体で「誰が何を呼べるか」。出典はコードのみ。作成: 2026-07-07。
> 主体: 匿名(未ログイン) / ログインユーザ / β参加者 / 現行サポーター / admin / admin-secret保持者 / Stripe / cron / 第三者。

凡例: ✅=呼べる / ⛔=拒否(4xx) / ⚙️=設定/フラグ依存 / —=対象外
判定関数: `getAuthenticatedUserForRequest`（`adminAccess.ts:103`）、`requireAdminAccess`（`:75`）、
`requireStockAdminAccess`（`:38`）、`getBetaCapabilitiesForRequest`（`betaAccess.ts:34`）、
`authorizeAdminTaskRequest`（`server/adminTaskAuth.ts:3`）、`verifyStripeWebhookEvent`（stripe署名）。

---

## 1. マトリクス

| API | 匿名 | ログイン | β参加者 | サポーター | admin | admin-secret | Stripe | cron | 出典 |
|---|---|---|---|---|---|---|---|---|---|
| exchange POST | ✅(anonId) | ✅ | — | — | ✅ | — | — | — | `exchange route.ts:200-212` |
| backup POST | ✅(anonId) | ✅ | — | — | ✅ | — | — | — | `backup route.ts:54-63` |
| photo-storage/signed-url(s) | ✅(配達済みのみ) | ✅(自分or配達済み) | — | — | ✅ | — | — | — | `signed-url route.ts:41-113` |
| presence GET | ✅ | ✅ | — | — | ✅ | — | — | — | `presence route.ts:37`（公開） |
| reports POST | ✅(配達実績検証) | ✅ | — | — | ✅ | — | — | — | `reports route.ts:66-80` |
| reports GET | ⛔403 | ⛔403 | ⛔ | ⛔ | ✅ | — | — | — | `reports route.ts:22-27` |
| moderation/queue GET | ⛔403 | ⛔403 | ⛔ | ⛔ | ✅ | — | — | — | `queue route.ts:24-29` |
| moderation/decide POST | ⛔403 | ⛔403 | ⛔ | ⛔ | ✅ | — | — | — | `decide route.ts:19-21` |
| sleeping-delivery/stock GET/POST | ⛔ | ⛔ | ⛔ | ⛔ | ✅＋⚙️`ENABLE_STOCK_ADMIN` | — | — | — | `stock route.ts:37,95` / `adminAccess.ts:38-72` |
| sleeping-delivery/diagnostics POST | ⛔403 | ⛔403 | ⛔ | ⛔ | ✅＋⚙️`ENABLE_TEST_TOOLS` | — | — | — | `diagnostics route.ts:26-33` |
| account/delete-stored-data POST | ⛔401 | ✅(自分) | — | — | ✅ | — | — | — | `delete route.ts:34-42` |
| account/transfer-intent POST | ⛔(匿名session必須) | ✅(匿名sessionのみ) | — | — | — | — | — | — | `transfer-intent route.ts:20,29` |
| account/copy-anonymous-storage POST | ⛔ | ✅(非匿名) | — | — | — | — | — | — | `copy-anonymous-storage route.ts:30,39` |
| onboarding/handoff/create POST | ✅(誰でも) | ✅ | — | — | ✅ | — | — | — | `create route.ts:26`（認証なし） |
| onboarding/handoff/redeem POST | ✅(token所持) | ✅ | — | — | ✅ | — | — | — | `redeem route.ts:16,37`（tokenのみ） |
| billing/create-checkout-session POST | ⛔401 | ⛔403(β外) | ✅ | ✅ | ✅(β扱い) | — | — | — | `checkout route.ts:22-33` |
| billing/create-portal-session POST | ⛔401 | ⛔404(非サポーター) | ⛔ | ✅ | — | — | — | — | `portal route.ts:17-41` |
| billing/status GET | ✅(未ログイン応答) | ✅ | ✅ | ✅ | ✅ | — | — | — | `status route.ts:12-23` |
| stripe/webhook POST | ⛔(署名必須) | ⛔ | — | — | — | — | ✅(署名) | — | `webhook route.ts:23,30` |
| beta/feedback POST | ⛔401 | ⛔403(β外) | ✅ | ✅(voice) | ✅ | — | — | — | `feedback route.ts:54-80` |
| beta/capabilities GET | ✅(未ログイン応答) | ✅ | ✅ | ✅ | ✅ | — | — | — | `capabilities route.ts:7-10` |
| referrals/claim POST | ⛔401 | ✅ | — | — | ✅ | — | — | — | `claim route.ts:9-12` |
| referrals/me GET | ✅(未ログイン応答) | ✅ | — | — | ✅ | — | — | — | `me route.ts:10-13` |
| admin/analytics GET | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | — | — | — | `admin/analytics route.ts:3`（`requireAdminAccess`） |
| admin/capabilities GET | ✅(結果で判定) | ✅ | ✅ | ✅ | ✅ | — | — | — | `admin/capabilities route.ts:7-10` |
| admin/onboarding-handoffs/cleanup GET/POST | ⛔ | ⛔ | ⛔ | ⛔ | ⛔(user認証では不可) | ✅ | — | ✅(secret経由) | `cleanup route.ts:28` / `adminTaskAuth.ts:24` |
| admin/storage-hardening/backfill POST | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ | ✅ | — | — | `backfill route.ts:32` / `adminTaskAuth.ts:24` |

---

## 2. 認可方式の分類（構造の把握）

コード上、認可の「門番」は**6系統**に分かれている:

1. **匿名可（identity任意）**: exchange・backup・reports(POST)・presence・signed-url・handoff・billing/beta/referrals のstatus/capabilities系。anonymousId or bearer or 未ログイン応答。
2. **ログイン必須（Bearer/セッション）**: account/delete・transfer-intent・copy・referrals/claim・billing系POST・feedback。
3. **β参加者/サポーター**: `getBetaCapabilitiesForRequest`（`betaAccess.ts:34`）。checkout・feedback。
4. **admin（メール照合）**: `requireAdminAccess`/`isAdmin`。moderation・reports(GET)・admin/analytics。
5. **admin＋フラグ**: stock(`ENABLE_STOCK_ADMIN`)・diagnostics(`ENABLE_TEST_TOOLS`)。
6. **admin-secret（共有シークレット・ユーザ認証ではない）**: cleanup・backfill。cron/手動叩き想定。
7. **署名検証**: stripe/webhook のみ。

第三者（無権限の攻撃者）は、匿名可カテゴリのAPIには到達できる。そこは各routeの
入力検証・rate limit・配達実績検証（reports）・token検証（handoff/redeem）で守る設計。

---

## 3. 構造的に目を引く非対称（詳細は issues-from-map.md）

- **管理APIの認可が3方式に割れている**: moderation=isAdminのみ / stock=isAdmin＋フラグ（未設定404）/
  diagnostics=isAdmin＋別フラグ（未設定403）/ cleanup・backfill=admin-secret（user認証不可）。
  → issues P1-3。
- **handoff create/redeem は無認証**（token所持＝権限）で、payloadに匿名セッショントークンを含む。
  → issues P1-2。
- **admin-secretタスクにrate limitが無い**（他の匿名可APIにはある）。→ issues P1-4。
- `admin/capabilities` は誰でも200で「自分が管理者か」を返す（`route.ts:7-10`）。管理者判定の
  存在は秘匿されない設計（機能フラグの露出。実害は小さいが認識しておくべき非対称）。

---

## サマリ（この文書分）

- API 27 × 主体9 のマトリクスを提示。
- 認可の門番は **7系統**（匿名可 / ログイン / β / admin / admin＋フラグ / admin-secret / 署名）。
- 認可の非対称が集中するのは**管理系**（3方式混在）と**handoff系**（無認証＋セッション同梱）。

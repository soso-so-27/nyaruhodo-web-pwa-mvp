"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "../../../lib/supabase/browser";
import { getOrCreateAnonymousId } from "../../../lib/identity/anonymousId";
import type {
  AnalyticsAudience,
  AnalyticsPeriodKey,
} from "../../../lib/analytics/adminAnalytics";

type Metric = {
  key: string;
  label: string;
  events: number;
  users: number;
};

type FunnelStep = Metric & {
  previousUsers: number | null;
  fromPreviousRate: number | null;
  fromStartRate: number | null;
};

type AnalyticsResponse = {
  period: AnalyticsPeriodKey;
  audience: AnalyticsAudience;
  generatedAt: string;
  range: { from: string; to: string };
  totalEvents: number;
  eventLimitReached: boolean;
  overview: Metric[];
  funnel: FunnelStep[];
  sourceBreakdown: Array<{
    source: string;
    introUsers: number;
    submittedUsers: number;
    openedUsers: number;
    secondPhotoUsers: number;
  }>;
  deliveryHealth: Metric[];
  installHealth: Metric[];
  environment: {
    devices: Array<{ key: string; users: number }>;
    contexts: Array<{ key: string; users: number }>;
  };
  retention: {
    photoSubmitters: number;
    repeatSubmitters: number;
    returningDaySubmitters: number;
    d1ReturnSubmitters: number;
  };
  errorSummary: Array<{
    eventName: string;
    errorCode: string | null;
    events: number;
    users: number;
    latestAt: string;
  }>;
  issueSummary: {
    recovered: IssueSummaryRow[];
    expected: IssueSummaryRow[];
  };
  diagnosticEventsExcluded: boolean;
  audienceCounts: {
    productEvents: number;
    internalEvents: number;
    internalActors: number;
  };
  recentErrors: SafeEvent[];
  recentEvents: SafeEvent[];
};

type IssueSummaryRow = {
  eventName: string;
  errorCode: string | null;
  events: number;
  users: number;
  latestAt: string;
};

type SafeEvent = {
  createdAt: string;
  eventName: string;
  source: string;
  route: string | null;
  surface: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  anonymousId: string | null;
  userId: string | null;
  submissionId: string | null;
};

const PERIODS: Array<{ key: AnalyticsPeriodKey; label: string }> = [
  { key: "launch", label: "公開後" },
  { key: "60m", label: "直近60分" },
  { key: "today", label: "きょう" },
  { key: "yesterday", label: "きのう" },
  { key: "7d", label: "7日" },
  { key: "28d", label: "28日" },
];

const AUDIENCES: Array<{ key: AnalyticsAudience; label: string }> = [
  { key: "product", label: "公開側" },
  { key: "internal", label: "内部・QA" },
];

const SOURCE_LABELS: Record<string, string> = {
  instagram_bio: "Instagram bio",
  instagram_story: "Instagram ストーリーズ",
  instagram_dm: "Instagram DM",
  instagram: "Instagram",
  referral: "紹介リンク",
  threads: "Threads",
  direct: "流入元不明（srcなし）",
  unknown: "流入元不明（旧記録）",
};

const ENVIRONMENT_LABELS: Record<string, string> = {
  ios: "iPhone / iPad",
  android: "Android",
  desktop: "PC",
  other: "その他",
  standalone: "ホーム画面アプリ",
  instagram: "Instagram内ブラウザ",
  line: "LINE内ブラウザ",
  facebook: "Facebook内ブラウザ",
  wechat: "WeChat内ブラウザ",
  embedded_other: "その他のアプリ内ブラウザ",
  embedded_unknown: "アプリ内ブラウザ（旧記録）",
  browser: "Safari / Chrome",
  unknown: "不明・旧記録",
};

const EVENT_LABELS: Record<string, string> = {
  app_error: "画面エラー",
  photo_upload_error: "写真の読み込み・保存失敗",
  onboarding_delivery_error: "最初のねこだより作成失敗",
  onboarding_delivery_blocked: "最初のねこだよりを用意できなかった",
  onboarding_handoff_restore_failed: "外部ブラウザへの引き継ぎ失敗",
  delivery_reveal_photo_error: "届いた写真の表示失敗",
  delivery_reveal_photo_rendered: "届いた写真を実表示",
  evening_delivery_check_failed: "20時便の確認失敗",
  evening_delivery_check_timeout: "20時便の確認が長時間化",
  exchange_rejected_expired: "20時便の受取期限超過",
  anonymous_auth_failed: "匿名認証失敗",
  anonymous_auth_unavailable: "匿名認証が無効",
  sleeping_photo_backup_failed: "投稿写真のバックアップ失敗",
  photo_original_preservation_failed: "原本写真の保全失敗",
  cat_gallery_restore_failed: "うちのこ写真の復元失敗",
};

export default function AdminAnalyticsClient() {
  const [period, setPeriod] = useState<AnalyticsPeriodKey>("launch");
  const [audience, setAudience] = useState<AnalyticsAudience>("product");
  const [refreshToken, setRefreshToken] = useState(0);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalytics() {
      setIsLoading(true);
      setError("");

      try {
        const headers = new Headers();
        const supabase = createBrowserSupabaseClient();
        const { data: sessionData } = supabase
          ? await supabase.auth.getSession()
          : { data: { session: null } };
        const accessToken = sessionData.session?.access_token;

        if (accessToken) {
          headers.set("Authorization", `Bearer ${accessToken}`);
        }
        headers.set("X-Analytics-Anonymous-Id", getOrCreateAnonymousId());

        const response = await fetch(
          `/api/admin/analytics?period=${period}&audience=${audience}`,
          {
            cache: "no-store",
            headers,
          },
        );

        if (!response.ok) {
          if (!isCancelled) {
            setData(null);
            setError(
              response.status === 403
                ? "管理者としてログインしたときだけ表示できます。"
                : "アナリティクスを読み込めませんでした。",
            );
          }
          return;
        }

        const body = (await response.json()) as AnalyticsResponse;
        if (!isCancelled) {
          setData(body);
        }
      } catch {
        if (!isCancelled) {
          setData(null);
          setError("アナリティクスを読み込めませんでした。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAnalytics();
    const refreshInterval = window.setInterval(loadAnalytics, 60_000);

    return () => {
      isCancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [audience, period, refreshToken]);

  const attentionMetric = data?.overview.find(
    (metric) => metric.key === "needs_attention",
  );
  const recoveredIssues = data?.issueSummary?.recovered ?? [];
  const expectedIssues = data?.issueSummary?.expected ?? [];

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.kicker}>運用</p>
          <h1 style={styles.title}>初動アナリティクス</h1>
          <p style={styles.intro}>
            投稿3の入口から、最初の一通と次の20時便までを識別IDとイベントで確認します。
          </p>
        </div>
        <nav style={styles.adminLinks} aria-label="管理画面">
          <a href="/admin/animation-preview" style={styles.adminLink}>
            開封確認
          </a>
          <a href="/admin/board-v2" style={styles.adminLink}>
            ねこだより確認
          </a>
        </nav>
      </header>

      <section style={styles.toolbar} aria-label="集計期間">
        <div style={styles.filterGroups}>
          <div style={styles.periodTabs} aria-label="集計対象">
            {AUDIENCES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setAudience(item.key)}
                aria-pressed={audience === item.key}
                style={{
                  ...styles.periodButton,
                  ...(audience === item.key ? styles.periodButtonActive : {}),
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div style={styles.periodTabs} aria-label="集計期間">
            {PERIODS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setPeriod(item.key)}
                aria-pressed={period === item.key}
                style={{
                  ...styles.periodButton,
                  ...(period === item.key ? styles.periodButtonActive : {}),
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.refreshGroup}>
          {data ? (
            <span style={styles.updatedAt}>
              {formatTime(data.generatedAt)}更新・60秒ごと
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setRefreshToken((value) => value + 1)}
            disabled={isLoading}
            style={styles.refreshButton}
          >
            {isLoading ? "更新中" : "更新"}
          </button>
        </div>
      </section>

      {isLoading && !data ? <p style={styles.stateText}>読み込み中...</p> : null}
      {error ? <p style={styles.errorText}>{error}</p> : null}

      {data ? (
        <>
          <Notice tone={data.audience === "product" ? "success" : "warning"}>
            {data.audience === "product"
              ? "公開側の記録です。数字は実人数ではなく、ログインIDまたは匿名ブラウザIDです。ブラウザを移ると同じ人でも別IDになります。"
              : "管理者端末、リセットURLの検証、管理画面だけを表示しています。"}
          </Notice>
          {data.audience === "product" ? (
            <Notice tone="warning">
              過去の匿名QAは自動判別できない場合があります。「公開後」を公開実績の基準にしてください。
            </Notice>
          ) : null}
          {data.eventLimitReached ? (
            <Notice tone="warning">
              5,000件の取得上限に達しています。この期間の数字は一部です。
            </Notice>
          ) : null}
          {attentionMetric && attentionMetric.users > 0 ? (
            <Notice tone="danger">
              要確認の記録が {attentionMetric.users} ID・{attentionMetric.events}
              イベントあります。下の「要確認」で同じ失敗が続いていないか確認してください。
            </Notice>
          ) : (
            <Notice tone="success">
              この期間に要確認の記録はありません。
            </Notice>
          )}

          <section style={styles.section} aria-labelledby="overview-title">
            <SectionHeading
              id="overview-title"
              title="いまの入口"
              note={`${formatRange(data.range.from, data.range.to)}・全 ${data.totalEvents.toLocaleString()} イベント`}
            />
            <div style={styles.metricGrid}>
              {data.overview.map((metric) => (
                <MetricCard
                  key={metric.key}
                  metric={metric}
                  tone={metric.key === "needs_attention" ? "danger" : "default"}
                />
              ))}
            </div>
          </section>

          <section style={styles.section} aria-labelledby="funnel-title">
            <SectionHeading
              id="funnel-title"
              title="最初の一通まで"
              note="同じ識別IDが、この期間内に順番どおり進んだ記録"
            />
            <AnalyticsTable
              columns={["段階", "識別ID", "前の段階から", "入口から"]}
              rows={data.funnel.map((step) => [
                step.label,
                `${step.users} ID`,
                step.previousUsers === null
                  ? "-"
                  : formatRate(step.fromPreviousRate, step.users, step.previousUsers),
                formatPercent(step.fromStartRate),
              ])}
            />
          </section>

          <section style={styles.section} aria-labelledby="delivery-title">
            <SectionHeading
              id="delivery-title"
              title="今夜の一通"
              note="20時以降は、開始した識別IDと成立した識別IDが一致するかを確認"
            />
            <div style={styles.metricGridCompact}>
              {data.deliveryHealth.map((metric) => (
                <MetricCard
                  key={metric.key}
                  metric={metric}
                  compact
                  tone={getDeliveryMetricTone(metric.key)}
                />
              ))}
            </div>
          </section>

          <section style={styles.twoColumnSection}>
            <div style={styles.column}>
              <SectionHeading
                id="environment-title"
                title="端末と入口"
                note="同じ人が複数環境で開くと、別の識別IDとして重複します"
              />
              <div style={styles.environmentGrid}>
                <BreakdownList
                  title="端末"
                  rows={data.environment.devices}
                />
                <BreakdownList
                  title="開いた場所"
                  rows={data.environment.contexts}
                />
              </div>
            </div>
            <div style={styles.column}>
              <SectionHeading
                id="install-title"
                title="アプリとして残す"
                note="iPhoneの追加完了は直接取得できないため、次回PWA起動で確認"
              />
              <div style={styles.metricGridCompact}>
                {data.installHealth.map((metric) => (
                  <MetricCard key={metric.key} metric={metric} compact />
                ))}
              </div>
            </div>
          </section>

          <section style={styles.section} aria-labelledby="source-title">
            <SectionHeading
              id="source-title"
              title="どこから来たか"
              note="URLのsrc記録です。Threads返信やコピーURLは、srcがなければ「流入元不明」になります"
            />
            {data.sourceBreakdown.length > 0 ? (
              <AnalyticsTable
                columns={["入口", "オンボ表示ID", "写真保存ID", "即時便開封ID", "今夜の一枚ID"]}
                rows={data.sourceBreakdown.map((row) => [
                  SOURCE_LABELS[row.source] ?? row.source,
                  `${row.introUsers} ID`,
                  `${row.submittedUsers} ID`,
                  `${row.openedUsers} ID`,
                  `${row.secondPhotoUsers} ID`,
                ])}
              />
            ) : (
              <p style={styles.emptyText}>この期間の流入はまだありません。</p>
            )}
          </section>

          <section style={styles.section} aria-labelledby="retention-title">
            <SectionHeading
              id="retention-title"
              title="写真をもう一度入れたか"
              note="活動しただけのIDは数えず、写真保存の記録だけを使用"
            />
            <div style={styles.metricGridCompact}>
              <MetricCard
                metric={{
                  key: "submitters",
                  label: "写真保存があるID",
                  users: data.retention.photoSubmitters,
                  events: 0,
                }}
                compact
              />
              <MetricCard
                metric={{
                  key: "repeat",
                  label: "期間内に2枚以上",
                  users: data.retention.repeatSubmitters,
                  events: 0,
                }}
                compact
              />
              <MetricCard
                metric={{
                  key: "returning-day",
                  label: "別の日にも保存",
                  users: data.retention.returningDaySubmitters,
                  events: 0,
                }}
                compact
              />
              <MetricCard
                metric={{
                  key: "d1",
                  label: "翌日も保存",
                  users: data.retention.d1ReturnSubmitters,
                  events: 0,
                }}
                compact
              />
            </div>
          </section>

          <section style={styles.section} aria-labelledby="errors-title">
            <SectionHeading
              id="errors-title"
              title="要確認"
              note="率より先に、同じエラーが複数の識別IDへ広がっていないかを見る"
            />
            {data.errorSummary.length > 0 ? (
              <>
                <AnalyticsTable
                  columns={["内容", "コード", "識別ID", "イベント", "最新"]}
                  rows={data.errorSummary.map((item) => [
                    getEventLabel(item.eventName),
                    item.errorCode ?? "-",
                    `${item.users} ID`,
                    `${item.events} 回`,
                    formatDate(item.latestAt),
                  ])}
                />
                <EventTable events={data.recentErrors} showError />
              </>
            ) : (
              <p style={styles.emptyText}>要確認の記録はありません。</p>
            )}
          </section>

          {recoveredIssues.length > 0 || expectedIssues.length > 0 ? (
            <section style={styles.section} aria-labelledby="operational-notes-title">
              <SectionHeading
                id="operational-notes-title"
                title="回復済み・想定内"
                note="利用上の失敗として数えず、運用記録として残しているもの"
              />
              <AnalyticsTable
                columns={["扱い", "内容", "識別ID", "イベント", "最新"]}
                rows={[
                  ...recoveredIssues.map((item) => [
                    "回復済み",
                    getEventLabel(item.eventName),
                    `${item.users} ID`,
                    `${item.events} 回`,
                    formatDate(item.latestAt),
                  ]),
                  ...expectedIssues.map((item) => [
                    "想定内",
                    getEventLabel(item.eventName),
                    `${item.users} ID`,
                    `${item.events} 回`,
                    formatDate(item.latestAt),
                  ]),
                ]}
              />
            </section>
          ) : null}

          <details style={styles.details}>
            <summary style={styles.summary}>直近の生イベントを見る</summary>
            <EventTable events={data.recentEvents} />
          </details>
        </>
      ) : null}
    </main>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const toneStyle =
    tone === "success"
      ? styles.noticeSuccess
      : tone === "danger"
        ? styles.noticeDanger
        : styles.noticeWarning;

  return <p style={{ ...styles.notice, ...toneStyle }}>{children}</p>;
}

function SectionHeading({
  id,
  title,
  note,
}: {
  id: string;
  title: string;
  note: string;
}) {
  return (
    <div style={styles.sectionHeading}>
      <h2 id={id} style={styles.sectionTitle}>
        {title}
      </h2>
      <p style={styles.sectionNote}>{note}</p>
    </div>
  );
}

function MetricCard({
  metric,
  compact = false,
  tone = "default",
}: {
  metric: Metric;
  compact?: boolean;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <article
      style={{
        ...styles.metricCard,
        ...(compact ? styles.metricCardCompact : {}),
        ...(tone === "danger"
          ? styles.metricCardDanger
          : tone === "warning"
            ? styles.metricCardWarning
            : tone === "success"
              ? styles.metricCardSuccess
              : {}),
      }}
    >
      <p style={styles.metricLabel}>{metric.label}</p>
      <p style={{ ...styles.metricValue, ...(compact ? styles.metricValueCompact : {}) }}>
        {metric.users.toLocaleString()}
        <span style={styles.metricUnit}>ID</span>
      </p>
      {metric.events > 0 ? (
        <p style={styles.metricDetail}>{metric.events.toLocaleString()}イベント</p>
      ) : null}
    </article>
  );
}

function BreakdownList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; users: number }>;
}) {
  return (
    <div style={styles.breakdown}>
      <h3 style={styles.breakdownTitle}>{title}</h3>
      {rows.length > 0 ? (
        <dl style={styles.breakdownList}>
          {rows.map((row) => (
            <div key={row.key} style={styles.breakdownRow}>
              <dt>{ENVIRONMENT_LABELS[row.key] ?? row.key}</dt>
              <dd style={styles.breakdownValue}>{row.users} ID</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p style={styles.emptyText}>まだ記録がありません。</p>
      )}
    </div>
  );
}

function AnalyticsTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: string[][];
}) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} style={styles.th}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0] ?? "row"}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} style={styles.td}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EventTable({
  events,
  showError = false,
}: {
  events: SafeEvent[];
  showError?: boolean;
}) {
  return (
    <AnalyticsTable
      columns={
        showError
          ? ["時刻", "内容", "コード", "メッセージ", "入口", "画面", "識別子"]
          : ["時刻", "イベント", "入口", "画面", "識別子", "submission"]
      }
      rows={events.map((event) => {
        const actor = event.userId ?? event.anonymousId ?? "-";
        const location = event.surface ?? event.route ?? "-";

        return showError
          ? [
              formatDate(event.createdAt),
              getEventLabel(event.eventName),
              event.errorCode ?? "-",
              event.errorMessage ?? "-",
              SOURCE_LABELS[event.source] ?? event.source,
              location,
              actor,
            ]
          : [
              formatDate(event.createdAt),
              event.eventName,
              SOURCE_LABELS[event.source] ?? event.source,
              location,
              actor,
              event.submissionId ?? "-",
            ];
      })}
    />
  );
}

function getDeliveryMetricTone(metricKey: string) {
  if (metricKey === "evening_check_failed") {
    return "danger" as const;
  }
  if (
    metricKey === "evening_target_repaired" ||
    metricKey === "evening_check_timeout"
  ) {
    return "warning" as const;
  }
  if (metricKey === "evening_check_succeeded") {
    return "success" as const;
  }
  return "default" as const;
}

function getEventLabel(eventName: string) {
  return EVENT_LABELS[eventName] ?? eventName;
}

function formatRate(rate: number | null, users: number, denominator: number) {
  if (rate === null) {
    return "-";
  }
  return `${rate}%（${users}/${denominator} ID）`;
}

function formatPercent(rate: number | null) {
  return rate === null ? "-" : `${rate}%`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRange(from: string, to: string) {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${formatter.format(new Date(from))} - ${formatter.format(new Date(to))}`;
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "28px 20px 64px",
    color: "#322b25",
    background: "#f6f3ed",
    fontFamily: "var(--font-zen-kaku), system-ui, sans-serif",
  },
  header: {
    maxWidth: 1180,
    margin: "0 auto 22px",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 18,
  },
  kicker: {
    margin: 0,
    color: "#a65045",
    fontSize: 13,
  },
  title: {
    margin: "3px 0 6px",
    fontSize: 30,
    lineHeight: 1.25,
    fontWeight: 600,
    letterSpacing: 0,
  },
  intro: {
    margin: 0,
    color: "#6f6258",
    fontSize: 14,
    lineHeight: 1.7,
  },
  adminLinks: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  adminLink: {
    color: "#705048",
    fontSize: 13,
    textDecoration: "underline",
    textUnderlineOffset: 4,
  },
  toolbar: {
    maxWidth: 1180,
    margin: "0 auto 18px",
    padding: "12px 0",
    borderTop: "1px solid rgba(74, 63, 53, 0.16)",
    borderBottom: "1px solid rgba(74, 63, 53, 0.16)",
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  filterGroups: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  periodTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  periodButton: {
    minHeight: 38,
    border: "1px solid rgba(74, 63, 53, 0.2)",
    borderRadius: 6,
    background: "transparent",
    padding: "7px 12px",
    font: "inherit",
    color: "#5d5148",
    cursor: "pointer",
  },
  periodButtonActive: {
    borderColor: "#7e4c43",
    color: "#fffaf5",
    background: "#7e4c43",
  },
  refreshGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  updatedAt: {
    color: "#786d64",
    fontSize: 12,
  },
  refreshButton: {
    minWidth: 64,
    minHeight: 38,
    border: "1px solid rgba(74, 63, 53, 0.28)",
    borderRadius: 6,
    background: "#fffdf9",
    color: "#4e433b",
    font: "inherit",
    fontSize: 13,
    cursor: "pointer",
  },
  stateText: {
    maxWidth: 1180,
    margin: "0 auto 16px",
  },
  errorText: {
    maxWidth: 1180,
    margin: "0 auto 16px",
    color: "#9d3028",
  },
  notice: {
    maxWidth: 1180,
    boxSizing: "border-box",
    margin: "0 auto 8px",
    padding: "10px 12px",
    borderLeft: "4px solid",
    fontSize: 13,
    lineHeight: 1.6,
  },
  noticeSuccess: {
    borderColor: "#52745d",
    color: "#3f5f49",
    background: "rgba(224, 236, 226, 0.62)",
  },
  noticeWarning: {
    borderColor: "#a57b35",
    color: "#72551f",
    background: "rgba(246, 233, 202, 0.62)",
  },
  noticeDanger: {
    borderColor: "#a84f45",
    color: "#84352e",
    background: "rgba(244, 221, 217, 0.68)",
  },
  section: {
    maxWidth: 1180,
    margin: "28px auto 0",
    paddingTop: 18,
    borderTop: "1px solid rgba(74, 63, 53, 0.18)",
  },
  twoColumnSection: {
    maxWidth: 1180,
    margin: "28px auto 0",
    paddingTop: 18,
    borderTop: "1px solid rgba(74, 63, 53, 0.18)",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
    gap: 28,
  },
  column: {
    minWidth: 0,
  },
  sectionHeading: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "4px 16px",
    marginBottom: 12,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 19,
    lineHeight: 1.4,
    fontWeight: 600,
    letterSpacing: 0,
  },
  sectionNote: {
    margin: 0,
    color: "#786d64",
    fontSize: 12,
    lineHeight: 1.6,
  },
  metricGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 8,
  },
  metricGridCompact: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
    gap: 8,
  },
  metricCard: {
    minHeight: 112,
    boxSizing: "border-box",
    border: "1px solid rgba(74, 63, 53, 0.16)",
    borderRadius: 6,
    background: "rgba(255, 253, 249, 0.78)",
    padding: 14,
  },
  metricCardCompact: {
    minHeight: 92,
    padding: 12,
  },
  metricCardDanger: {
    borderColor: "rgba(168, 79, 69, 0.48)",
    background: "rgba(250, 236, 232, 0.82)",
  },
  metricCardWarning: {
    borderColor: "rgba(165, 123, 53, 0.48)",
    background: "rgba(249, 240, 216, 0.82)",
  },
  metricCardSuccess: {
    borderColor: "rgba(82, 116, 93, 0.42)",
    background: "rgba(232, 241, 233, 0.82)",
  },
  metricLabel: {
    margin: 0,
    color: "#675c53",
    fontSize: 12,
    lineHeight: 1.5,
  },
  metricValue: {
    margin: "8px 0 0",
    fontSize: 32,
    lineHeight: 1,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  metricValueCompact: {
    fontSize: 25,
  },
  metricUnit: {
    marginLeft: 3,
    fontSize: 12,
    fontWeight: 500,
    color: "#6f6258",
  },
  metricDetail: {
    margin: "7px 0 0",
    color: "#887b70",
    fontSize: 11,
  },
  environmentGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 16,
  },
  breakdown: {
    minWidth: 0,
  },
  breakdownTitle: {
    margin: "0 0 7px",
    fontSize: 13,
    fontWeight: 600,
  },
  breakdownList: {
    margin: 0,
  },
  breakdownRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    padding: "7px 0",
    borderBottom: "1px solid rgba(74, 63, 53, 0.1)",
    color: "#5f554d",
    fontSize: 13,
  },
  breakdownValue: {
    margin: 0,
    fontVariantNumeric: "tabular-nums",
    fontWeight: 600,
  },
  tableWrap: {
    overflowX: "auto",
    border: "1px solid rgba(74, 63, 53, 0.14)",
    borderRadius: 6,
    background: "rgba(255, 253, 249, 0.54)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "9px 10px",
    textAlign: "left",
    borderBottom: "1px solid rgba(74, 63, 53, 0.2)",
    color: "#6f6258",
    background: "rgba(240, 235, 227, 0.68)",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "9px 10px",
    borderBottom: "1px solid rgba(74, 63, 53, 0.09)",
    whiteSpace: "nowrap",
    fontVariantNumeric: "tabular-nums",
  },
  emptyText: {
    margin: 0,
    padding: "12px 0",
    color: "#786d64",
    fontSize: 13,
  },
  details: {
    maxWidth: 1180,
    margin: "28px auto 0",
    paddingTop: 18,
    borderTop: "1px solid rgba(74, 63, 53, 0.18)",
  },
  summary: {
    marginBottom: 12,
    color: "#5f554d",
    fontSize: 14,
    cursor: "pointer",
  },
} satisfies Record<string, CSSProperties>;

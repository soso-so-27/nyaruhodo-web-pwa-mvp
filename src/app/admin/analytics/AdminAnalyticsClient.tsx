"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

type PeriodKey = "today" | "yesterday" | "7d" | "28d";

type AnalyticsResponse = {
  period: PeriodKey;
  cards: Array<{ eventName: string; count: number }>;
  funnel: Array<{ eventName: string; count: number; users: number }>;
  sourceBreakdown: Array<{
    source: string;
    events: Array<{ eventName: string; users: number }>;
  }>;
  appKpis: Array<{ eventName: string; count: number; users: number }>;
  retention: {
    uniqueActiveUsers: number;
    repeatSubmitters: number;
    d1ReturnSubmitters: number;
  };
  recentErrors: SafeEvent[];
  recentEvents: SafeEvent[];
};

type SafeEvent = {
  createdAt: string;
  eventName: string;
  source: string;
  route: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  anonymousId: string | null;
  userId: string | null;
  submissionId: string | null;
};

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "今日" },
  { key: "yesterday", label: "昨日" },
  { key: "7d", label: "直近7日" },
  { key: "28d", label: "直近28日" },
];

export default function AdminAnalyticsClient() {
  const [period, setPeriod] = useState<PeriodKey>("today");
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalytics() {
      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/admin/analytics?period=${period}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setData(null);
          setError(response.status === 403 ? "管理者のみ表示できます。" : "読み込めませんでした。");
          return;
        }

        const body = (await response.json()) as AnalyticsResponse;
        if (!isCancelled) {
          setData(body);
        }
      } catch {
        if (!isCancelled) {
          setData(null);
          setError("読み込めませんでした。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      isCancelled = true;
    };
  }, [period]);

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <p style={styles.kicker}>Admin</p>
        <h1 style={styles.title}>Analytics</h1>
        <div style={styles.periodTabs}>
          {PERIODS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPeriod(item.key)}
              style={{
                ...styles.periodButton,
                ...(period === item.key ? styles.periodButtonActive : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {isLoading ? <p style={styles.stateText}>読み込み中...</p> : null}
      {error ? <p style={styles.errorText}>{error}</p> : null}

      {data ? (
        <>
          <section style={styles.cardGrid}>
            {data.cards.map((card) => (
              <MetricCard
                key={card.eventName}
                label={card.eventName}
                value={card.count}
              />
            ))}
          </section>

          <section style={styles.cardGrid}>
            <MetricCard
              label="unique active users"
              value={data.retention.uniqueActiveUsers}
            />
            <MetricCard
              label="repeat submitters"
              value={data.retention.repeatSubmitters}
            />
            <MetricCard
              label="D1 return submitters"
              value={data.retention.d1ReturnSubmitters}
            />
          </section>

          <AnalyticsTable
            title="Funnel"
            columns={["event", "count", "users"]}
            rows={data.funnel.map((item) => [
              item.eventName,
              String(item.count),
              String(item.users),
            ])}
          />

          <AnalyticsTable
            title="Source"
            columns={["source", "intro", "submitted", "opened", "prompt", "google", "skip"]}
            rows={data.sourceBreakdown.map((item) => [
              item.source,
              ...item.events.map((event) => String(event.users)),
            ])}
          />

          <AnalyticsTable
            title="App KPI"
            columns={["event", "count", "users"]}
            rows={data.appKpis.map((item) => [
              item.eventName,
              String(item.count),
              String(item.users),
            ])}
          />

          <EventTable title="Recent Errors" events={data.recentErrors} showError />
          <EventTable title="Recent Events" events={data.recentEvents} />
        </>
      ) : null}
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article style={styles.metricCard}>
      <p style={styles.metricLabel}>{label}</p>
      <p style={styles.metricValue}>{value.toLocaleString()}</p>
    </article>
  );
}

function AnalyticsTable({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <section style={styles.panel}>
      <h2 style={styles.panelTitle}>{title}</h2>
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
              <tr key={`${title}-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td key={`${title}-${rowIndex}-${cellIndex}`} style={styles.td}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EventTable({
  title,
  events,
  showError = false,
}: {
  title: string;
  events: SafeEvent[];
  showError?: boolean;
}) {
  return (
    <AnalyticsTable
      title={title}
      columns={
        showError
          ? ["created", "event", "code", "message", "source", "route", "anon", "user"]
          : ["created", "event", "source", "route", "anon", "user", "submission"]
      }
      rows={events.map((event) =>
        showError
          ? [
              formatDate(event.createdAt),
              event.eventName,
              event.errorCode ?? "",
              event.errorMessage ?? "",
              event.source,
              event.route ?? "",
              event.anonymousId ?? "",
              event.userId ?? "",
            ]
          : [
              formatDate(event.createdAt),
              event.eventName,
              event.source,
              event.route ?? "",
              event.anonymousId ?? "",
              event.userId ?? "",
              event.submissionId ?? "",
            ],
      )}
    />
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px 20px 56px",
    color: "#322b25",
    fontFamily: "var(--font-zen-kaku), system-ui, sans-serif",
  },
  header: {
    maxWidth: 1080,
    margin: "0 auto 24px",
  },
  kicker: {
    margin: 0,
    color: "#a65045",
    fontSize: 13,
    letterSpacing: 0,
  },
  title: {
    margin: "4px 0 20px",
    fontSize: 34,
    fontWeight: 500,
    letterSpacing: 0,
  },
  periodTabs: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  periodButton: {
    border: "1px solid rgba(91, 74, 62, 0.24)",
    borderRadius: 999,
    background: "rgba(255, 252, 246, 0.62)",
    padding: "9px 16px",
    font: "inherit",
    color: "#5d5148",
    cursor: "pointer",
  },
  periodButtonActive: {
    borderColor: "#a65045",
    color: "#a65045",
    background: "rgba(255, 250, 244, 0.88)",
  },
  stateText: {
    maxWidth: 1080,
    margin: "0 auto 16px",
  },
  errorText: {
    maxWidth: 1080,
    margin: "0 auto 16px",
    color: "#a33b31",
  },
  cardGrid: {
    maxWidth: 1080,
    margin: "0 auto 16px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 10,
  },
  metricCard: {
    border: "1px solid rgba(91, 74, 62, 0.16)",
    borderRadius: 14,
    background: "rgba(255, 252, 246, 0.62)",
    padding: 16,
  },
  metricLabel: {
    margin: 0,
    fontSize: 12,
    color: "#6f6258",
    overflowWrap: "anywhere",
  },
  metricValue: {
    margin: "8px 0 0",
    fontSize: 28,
    lineHeight: 1,
    fontWeight: 500,
  },
  panel: {
    maxWidth: 1080,
    margin: "16px auto",
    border: "1px solid rgba(91, 74, 62, 0.16)",
    borderRadius: 16,
    background: "rgba(255, 252, 246, 0.62)",
    padding: 16,
  },
  panelTitle: {
    margin: "0 0 12px",
    fontSize: 20,
    fontWeight: 500,
  },
  tableWrap: {
    overflowX: "auto" as const,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    fontSize: 13,
  },
  th: {
    padding: "9px 8px",
    textAlign: "left" as const,
    borderBottom: "1px solid rgba(91, 74, 62, 0.18)",
    color: "#6f6258",
    fontWeight: 500,
    whiteSpace: "nowrap" as const,
  },
  td: {
    padding: "9px 8px",
    borderBottom: "1px solid rgba(91, 74, 62, 0.1)",
    whiteSpace: "nowrap" as const,
  },
} satisfies Record<string, CSSProperties>;

import { headers } from "next/headers";

import { requireAdminAccess } from "../../../lib/adminAccess";
import AdminAnalyticsClient from "./AdminAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const requestHeaders = await headers();
  const access = await requireAdminAccess(
    new Request("https://nyaruhodo.local/admin/analytics", {
      headers: requestHeaders,
    }),
  );

  if (!access.allowed) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: "48px 20px",
          color: "#322b25",
          fontFamily: "var(--font-zen-kaku), system-ui, sans-serif",
        }}
      >
        <section style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ margin: 0, color: "#a65045", fontSize: 13 }}>
            Admin
          </p>
          <h1 style={{ margin: "8px 0 12px", fontSize: 32, fontWeight: 500 }}>
            Analytics
          </h1>
          <p style={{ margin: 0, color: "#6f6258" }}>
            管理者のみ表示できます。
          </p>
        </section>
      </main>
    );
  }

  return <AdminAnalyticsClient />;
}

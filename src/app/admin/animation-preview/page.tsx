import { headers } from "next/headers";

import { requireAdminAccess } from "../../../lib/adminAccess";
import AdminAnimationPreviewClient from "./AdminAnimationPreviewClient";

export const dynamic = "force-dynamic";

export default async function AdminAnimationPreviewPage() {
  const requestHeaders = await headers();
  const access = await requireAdminAccess(
    new Request("https://nyaruhodo.local/admin/animation-preview", {
      headers: requestHeaders,
    }),
  );

  if (!access.allowed) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Animation Preview</h1>
        <p>管理者のみ表示できます。</p>
      </main>
    );
  }

  return <AdminAnimationPreviewClient />;
}

import { AdminAccessGate } from "../../../components/admin/AdminAccessGate";
import AdminAnimationPreviewClient from "./AdminAnimationPreviewClient";

export const dynamic = "force-dynamic";

export default function AdminAnimationPreviewPage() {
  return (
    <AdminAccessGate title="Animation Preview">
      <AdminAnimationPreviewClient />
    </AdminAccessGate>
  );
}

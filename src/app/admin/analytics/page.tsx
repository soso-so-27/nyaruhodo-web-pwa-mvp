import { AdminAccessGate } from "../../../components/admin/AdminAccessGate";
import AdminAnalyticsClient from "./AdminAnalyticsClient";

export const dynamic = "force-dynamic";

export default function AdminAnalyticsPage() {
  return (
    <AdminAccessGate title="Analytics">
      <AdminAnalyticsClient />
    </AdminAccessGate>
  );
}

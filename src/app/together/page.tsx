import { TogetherPage } from "../../components/together/TogetherPage";
import { getRecentEvents } from "../../lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function TogetherRoute() {
  const recentEvents = await getRecentEvents();

  return <TogetherPage recentEvents={recentEvents} />;
}

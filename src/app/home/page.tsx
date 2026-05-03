import { HomeInput } from "../../components/home/HomeInput";
import { getRecentEvents } from "../../lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recentEvents = await getRecentEvents();

  return <HomeInput recentEvents={recentEvents} />;
}

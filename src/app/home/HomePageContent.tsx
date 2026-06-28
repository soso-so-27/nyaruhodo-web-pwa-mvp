import { HomeInput } from "../../components/home/HomeInput";
import { getRecentEvents } from "../../lib/supabase/queries";

export async function HomePageContent() {
  const recentEvents = await getRecentEvents();

  return <HomeInput recentEvents={recentEvents} initialNow={Date.now()} />;
}

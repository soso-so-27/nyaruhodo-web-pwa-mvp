import { TorisetuPage } from "../../components/torisetu/TorisetuPage";
import { getRecentEvents } from "../../lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function Torisetu() {
  const recentEvents = await getRecentEvents();

  return <TorisetuPage recentEvents={recentEvents} />;
}

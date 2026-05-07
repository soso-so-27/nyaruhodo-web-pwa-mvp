import { CollectionPage } from "../../components/collection/CollectionPage";
import { getRecentEvents } from "../../lib/supabase/queries";

export const dynamic = "force-dynamic";

export default async function CollectionRoute() {
  const recentEvents = await getRecentEvents();

  return <CollectionPage recentEvents={recentEvents} />;
}

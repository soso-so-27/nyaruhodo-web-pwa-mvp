import { HomeInput } from "../../components/home/HomeInput";
import {
  calculateUnderstandingPercent,
  getUnderstandingMessage,
} from "../../core/understanding/understanding";
import { getRecentEvents } from "../../lib/supabase/queries";

export default async function HomePage() {
  const recentEvents = await getRecentEvents();
  const understandingPercent = calculateUnderstandingPercent(
    recentEvents.length,
  );
  const understandingMessage = getUnderstandingMessage(understandingPercent);

  return (
    <HomeInput
      recentEvents={recentEvents}
      understandingPercent={understandingPercent}
      understandingMessage={understandingMessage}
    />
  );
}

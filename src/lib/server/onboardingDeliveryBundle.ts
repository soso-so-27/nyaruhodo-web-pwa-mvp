import { createHash } from "node:crypto";

export const ONBOARDING_CHOICE_CAPABILITY = "onboarding_choice_v1" as const;
export const ONBOARDING_CHOICE_REQUESTED_COUNT = 4;

export function buildOnboardingJourneyDeliveryId({
  journeyId,
  deliveryDateKey,
}: {
  journeyId: string;
  deliveryDateKey: string;
}) {
  const digest = createHash("sha256")
    .update(`${journeyId}:${deliveryDateKey}`)
    .digest("hex")
    .slice(0, 24);

  return `delivered-onboarding-${deliveryDateKey}-${digest}`;
}

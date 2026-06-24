"use client";

import { useEffect } from "react";

import {
  capturePendingReferralFromLocation,
  claimPendingReferral,
} from "../../lib/referrals/client";

export function AppReferralTracker() {
  useEffect(() => {
    capturePendingReferralFromLocation();
    void claimPendingReferral();
  }, []);

  return null;
}

export const STORAGE_KEYS = {
  accountCreatePromptDismissed: "account_create_prompt_dismissed",
  activeCatId: "active_cat_id",
  analyticsAnonymousId: "analytics_anonymous_id",
  analyticsEventQueue: "analytics_event_queue",
  analyticsSession: "analytics_session",
  catProfiles: "cat_profiles",
  collectionPhotos: "collection_photos",
  currentCatHintSuppression: "current_cat_hint_suppression",
  diagnosisOnboardingHomeHint: "diagnosis_onboarding_home_hint",
  homeVisitCount: "home_visit_count",
  lastContext: "last_context",
  lastInputSignal: "last_input_signal",
  lastPrimaryCategory: "last_primary_category",
  latestHypothesis: "latest_hypothesis",
  legacyCatProfile: "cat_profile",
  onboardingCompleted: "onboarding_completed",
  postDiagnosisFeedback: "post_diagnosis_feedback",
} as const;

export function getDiscoveryLogKey(catId: string) {
  return `discovery_log_${catId}`;
}

export function getLightDataKey(catId: string) {
  return `light_data_${catId}`;
}

export function getLockDataKey(catId: string) {
  return `lock_data_${catId}`;
}

export function getRecordLogKey(catId: string) {
  return `record_log_${catId}`;
}

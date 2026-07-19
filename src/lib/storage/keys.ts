export const STORAGE_KEYS = {
  accountCreatePromptDismissed: "account_create_prompt_dismissed",
  accountRestorePromptDismissed: "account_restore_prompt_dismissed",
  activeCatId: "active_cat_id",
  analyticsAnonymousId: "analytics_anonymous_id",
  analyticsEventQueue: "analytics_event_queue",
  analyticsSession: "analytics_session",
  authGooglePending: "auth_google_pending",
  catGalleryPhotos: "neteruneko_cat_gallery_photos",
  catProfiles: "cat_profiles",
  collectionPhotos: "collection_photos",
  currentCatHintSuppression: "current_cat_hint_suppression",
  diagnosisOnboardingHomeHint: "diagnosis_onboarding_home_hint",
  homeVisitCount: "home_visit_count",
  eveningDeliveryDays: "neteruneko_evening_delivery_days",
  omoideMemories: "neteruneko_omoide_memories",
  omoideMemoryControls: "neteruneko_omoide_memory_controls",
  lastContext: "last_context",
  lastInputSignal: "last_input_signal",
  lastPrimaryCategory: "last_primary_category",
  latestHypothesis: "latest_hypothesis",
  legacyCatProfile: "cat_profile",
  onboardingCompleted: "onboarding_completed",
  onboardingJourney: "neteruneko_onboarding_journey",
  onboardingProgress: "neteruneko_onboarding_progress",
  onboardingSource: "neteruneko_onboarding_source",
  pendingReferralCode: "neteruneko_pending_referral_code",
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

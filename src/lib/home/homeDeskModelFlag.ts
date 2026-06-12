export const HOME_DESK_MODEL_ENABLED =
  process.env.NEXT_PUBLIC_HOME_DESK_MODEL === "1" ||
  process.env.NEXT_PUBLIC_HOME_DESK_MODEL === "true";

export const HOME_DESK_MODEL_OVERRIDE_STORAGE_KEY =
  "neteruneko_home_desk_model";

export function readHomeDeskModelOverride() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(HOME_DESK_MODEL_OVERRIDE_STORAGE_KEY);
    if (value === "1" || value === "true") {
      return true;
    }
    if (value === "0" || value === "false") {
      return false;
    }
  } catch {
    // Feature flag override is best-effort only.
  }

  return null;
}

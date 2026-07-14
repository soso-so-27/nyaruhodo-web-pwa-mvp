const AUTH_SESSION_ERROR_MARKERS = [
  "auth session missing",
  "auth_required",
  "invalid jwt",
  "jwt expired",
  "jwt malformed",
  "refresh token",
  "session_not_found",
  "token has expired",
  "token is expired",
] as const;

export function isAuthSessionError(value: unknown) {
  const message = getErrorMessage(value).toLowerCase();

  return AUTH_SESSION_ERROR_MARKERS.some((marker) => message.includes(marker));
}

export function hasAuthSessionError(values: readonly unknown[]) {
  return values.some(isAuthSessionError);
}

export function buildLoginRecoveryHref(returnTo: string) {
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : "/home";

  return `/account/create?returnTo=${encodeURIComponent(safeReturnTo)}`;
}

function getErrorMessage(value: unknown) {
  if (value instanceof Error) {
    return `${value.name} ${value.message}`;
  }

  if (
    value &&
    typeof value === "object" &&
    "message" in value &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return typeof value === "string" ? value : "";
}

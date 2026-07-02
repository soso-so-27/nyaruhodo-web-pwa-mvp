# review-extract-2-2026-07-02

Generated as UTF-8. No code values/secrets from env are included.

## a. src/lib/adminAccess.ts full text

[ADMIN_ENV_MARK] Review behavior when ADMIN_EMAILS / stock admin env are empty or unset.

```ts
import { createClient, type User } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "./supabase/config";
import { createServerSupabaseClient } from "./supabase/server";

export type AdminCapabilities = {
  isAdmin: boolean;
  testToolsEnabled: boolean;
  stockAdminEnabled: boolean;
};

export type AdminAccessResult =
  | {
      allowed: true;
      capabilities: AdminCapabilities;
      user: User;
    }
  | {
      allowed: false;
      capabilities: AdminCapabilities;
      status: 403 | 404 | 503;
      error: "admin_disabled" | "admin_config_missing" | "admin_required";
    };

export async function getAdminCapabilitiesForRequest(
  request: Request,
): Promise<AdminCapabilities> {
  const user = await getAuthenticatedUserForRequest(request);
  const isAdmin = isAdminUser(user);

  return {
    isAdmin,
    testToolsEnabled: isAdmin && isEnvFlagEnabled("ENABLE_TEST_TOOLS"),
    stockAdminEnabled: isAdmin && isEnvFlagEnabled("ENABLE_STOCK_ADMIN"),
  };
}

export async function requireStockAdminAccess(
  request: Request,
): Promise<AdminAccessResult> {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!hasAdminEmailConfig()) {
    return {
      allowed: false,
      capabilities,
      status: 503,
      error: "admin_config_missing",
    };
  }

  if (!isEnvFlagEnabled("ENABLE_STOCK_ADMIN")) {
    return {
      allowed: false,
      capabilities,
      status: 404,
      error: "admin_disabled",
    };
  }

  const user = await getAuthenticatedUserForRequest(request);

  if (!user || !capabilities.isAdmin) {
    return {
      allowed: false,
      capabilities,
      status: 403,
      error: "admin_required",
    };
  }

  return { allowed: true, capabilities, user };
}

export async function requireAdminAccess(
  request: Request,
): Promise<AdminAccessResult> {
  const capabilities = await getAdminCapabilitiesForRequest(request);

  if (!hasAdminEmailConfig()) {
    return {
      allowed: false,
      capabilities,
      status: 503,
      error: "admin_config_missing",
    };
  }

  const user = await getAuthenticatedUserForRequest(request);

  if (!user || !capabilities.isAdmin) {
    return {
      allowed: false,
      capabilities,
      status: 403,
      error: "admin_required",
    };
  }

  return { allowed: true, capabilities, user };
}

export async function getAuthenticatedUserForRequest(request: Request) {
  const bearerToken = getBearerToken(request);

  if (bearerToken) {
    const config = getSupabasePublicConfig();

    if (!config) {
      return null;
    }

    const supabase = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { data, error } = await supabase.auth.getUser(bearerToken);

    if (!error && data.user) {
      return data.user;
    }
  }

  const serverSupabase = await createServerSupabaseClient();

  if (!serverSupabase) {
    return null;
  }

  const { data, error } = await serverSupabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user ?? null;
}

function isAdminUser(user: User | null) {
  const email = user?.email?.trim().toLowerCase();

  if (!email) {
    return false;
  }

  return getAdminEmails().has(email);
}

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

function hasAdminEmailConfig() {
  return getAdminEmails().size > 0;
}

function getAdminEmails() {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function isEnvFlagEnabled(name: "ENABLE_TEST_TOOLS" | "ENABLE_STOCK_ADMIN") {
  return (process.env[name] ?? "").trim().toLowerCase() === "true";
}

```



### Codex self-note

- Check whether empty ADMIN_EMAILS fails closed for every admin-only route.

- Check whether stock/test-tool capabilities use a broader env than intended.

## b. cat_moment_deliveries RLS policies

### supabase/migrations/20260602093000_create_cat_moment_tables.sql

```sql
alter table public.cat_moment_deliveries enable row level security;

drop policy if exists "cat_moment_deliveries_select_own" on public.cat_moment_deliveries;

create policy "cat_moment_deliveries_select_own"
on public.cat_moment_deliveries
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "cat_moment_deliveries_insert_own" on public.cat_moment_deliveries;

create policy "cat_moment_deliveries_insert_own"
on public.cat_moment_deliveries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "cat_moment_deliveries_insert_anonymous_backup" on public.cat_moment_deliveries;

create policy "cat_moment_deliveries_insert_anonymous_backup"
on public.cat_moment_deliveries
for insert
to anon
with check (user_id is null and anonymous_id is not null);

drop policy if exists "cat_moment_deliveries_update_own" on public.cat_moment_deliveries;

create policy "cat_moment_deliveries_update_own"
on public.cat_moment_deliveries
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "cat_moment_deliveries_delete_own" on public.cat_moment_deliveries;

create policy "cat_moment_deliveries_delete_own"
on public.cat_moment_deliveries
for delete
to authenticated
using (user_id = auth.uid());
```



### Codex self-note

- cat_moment_deliveries still has an anonymous insert backup policy in the original migration; this extraction is for review, not changed here.

- Confirm production policy state after all migrations, not just file contents.

## c. exchange route deliverability helpers

[MODERATION_MARK] Review moderation_status handling in these helpers.

## isRowDeliverable

File: `src/app/api/sleeping-delivery/exchange/route.ts`

Lines: 1209-1218

[MODERATION_MARK]

```ts
function isRowDeliverable(
  row: RemoteCatMomentRow,
  {
    userId,
    anonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }
```



## isFastStockCandidateDeliverable

File: `src/app/api/sleeping-delivery/exchange/route.ts`

Lines: 1166-1175

[MODERATION_MARK]

```ts
function isFastStockCandidateDeliverable(
  row: FastStockCandidateRow,
  {
    userId,
    anonymousId,
    recipientCatId,
    excludePhotoId,
    blockedPhotoIds,
    deliveredSourceMomentIds,
  }
```



## getDeliveryTier

File: `src/app/api/sleeping-delivery/exchange/route.ts`

Lines: 1394-1405

[MODERATION_MARK]

```ts
function getDeliveryTier(
  row: RemoteCatMomentRow,
  input: Required<ExchangeRequest>,
): DeliveryTier {
  if (readPoolKind(row.metadata) === "admin_stock") {
    return 3;
  }

  return input.deliveryDateKey && row.pool_date === input.deliveryDateKey ? 1 : 2;
}


```



### Codex self-note

- Confirm every candidate path calls the same deliverability helpers before returning a photo.

- Confirm approved/default moderation states are intentional and do not allow legacy unmoderated rows unexpectedly.

## d. src/lib/photoStorageAuthorization.ts full text

[AUTHZ_MARK] Review path matching and ownership/delivered-photo checks.

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

import { toStoragePhotoUrl } from "./photoStorage";

const MAX_STORAGE_PATH_LENGTH = 512;
const MAX_ANONYMOUS_ID_LENGTH = 160;

export function isSafeStoragePath(path: string) {
  return (
    Boolean(path) &&
    path.length <= MAX_STORAGE_PATH_LENGTH &&
    !path.includes("\\") &&
    path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

export function isOwnStoragePath(path: string, userId: string) {
  return path.split("/")[0] === userId;
}

export function normalizeAnonymousId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const anonymousId = value.trim();
  if (!anonymousId || anonymousId.length > MAX_ANONYMOUS_ID_LENGTH) {
    return null;
  }

  return anonymousId;
}

export function getStoragePhotoUrlVariants(path: string) {
  return [toStoragePhotoUrl(path), `storage://${path}`];
}

export async function isAuthorizedStoragePhotoPath({
  storagePath,
  userId,
  anonymousId,
  hasDeliveredPhoto,
}: {
  storagePath: string;
  userId: string;
  anonymousId: string | null;
  hasDeliveredPhoto: (
    photoUrlVariants: string[],
    userId: string,
    anonymousId: string | null,
  ) => Promise<boolean>;
}) {
  if (!isSafeStoragePath(storagePath)) {
    return false;
  }

  if (isOwnStoragePath(storagePath, userId)) {
    return true;
  }

  return hasDeliveredPhoto(
    getStoragePhotoUrlVariants(storagePath),
    userId,
    anonymousId,
  );
}

export async function hasDeliveredStoragePhoto({
  supabase,
  photoUrlVariants,
  userId,
  anonymousId,
}: {
  supabase: SupabaseClient;
  photoUrlVariants: string[];
  userId: string;
  anonymousId: string | null;
}) {
  if (
    userId &&
    await hasDeliveredStoragePhotoForUser({
      supabase,
      photoUrlVariants,
      userId,
    })
  ) {
    return true;
  }

  if (!anonymousId) {
    return false;
  }

  const { data, error } = await supabase
    .from("cat_moment_deliveries")
    .select("id")
    .is("user_id", null)
    .eq("anonymous_id", anonymousId)
    .in("photo_url", photoUrlVariants)
    .limit(1);

  return !error && Array.isArray(data) && data.length > 0;
}

async function hasDeliveredStoragePhotoForUser({
  supabase,
  photoUrlVariants,
  userId,
}: {
  supabase: SupabaseClient;
  photoUrlVariants: string[];
  userId: string;
}) {
  const { data, error } = await supabase
    .from("cat_moment_deliveries")
    .select("id")
    .eq("user_id", userId)
    .in("photo_url", photoUrlVariants)
    .limit(1);

  return !error && Array.isArray(data) && data.length > 0;
}

```



### Codex self-note

- Check whether storage path normalization rejects traversal and signed/public URLs before authorization.

- Check that anonymous onboarding/delivery authorization cannot be widened by localStorage-only claims.

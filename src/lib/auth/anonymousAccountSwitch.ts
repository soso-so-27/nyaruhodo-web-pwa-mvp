"use client";

import {
  getStoragePhotoPath,
  toStoragePhotoUrl,
} from "../photoStorage";
import { createBrowserSupabaseClient } from "../supabase/browser";

const ANONYMOUS_STORAGE_TRANSFER_KEY =
  "neteruneko_anonymous_storage_transfer_pending";
const MAX_TRANSFER_PATHS = 160;

type PendingAnonymousStorageTransfer = {
  createdAt: string;
  fromUserId: string;
  paths: string[];
  transferToken: string;
};

type CopyAnonymousStorageResponse = {
  ok?: boolean;
  copied?: number;
  mappings?: Array<{ from: string; to: string }>;
  error?: string;
};

type TransferIntentResponse = {
  ok?: boolean;
  transferToken?: string;
  error?: string;
};

type StorageRefRewriteResult = {
  changed: boolean;
  value: unknown;
};

export async function prepareAnonymousStorageRefsForAccountSwitch() {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return { converted: 0, pendingPaths: 0 };
  }

  const { data } = await supabase.auth.getUser();
  const fromUserId = data.user?.id;
  if (!fromUserId) {
    return { converted: 0, pendingPaths: 0 };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const paths = collectLocalStoragePathsForUser(fromUserId);
  if (paths.length === 0) {
    window.localStorage.removeItem(ANONYMOUS_STORAGE_TRANSFER_KEY);
    return { converted: 0, pendingPaths: 0 };
  }

  if (!accessToken) {
    return {
      converted: 0,
      error: "anonymous_session_required",
      pendingPaths: paths.length,
    };
  }

  const pendingPaths = paths.slice(0, MAX_TRANSFER_PATHS);
  const transferIntent = await createAnonymousStorageTransferIntent({
    accessToken,
    paths: pendingPaths,
  });

  if (!transferIntent.transferToken) {
    return {
      converted: 0,
      error: transferIntent.error ?? "transfer_intent_failed",
      pendingPaths: pendingPaths.length,
    };
  }

  const pending: PendingAnonymousStorageTransfer = {
    createdAt: new Date().toISOString(),
    fromUserId,
    paths: pendingPaths,
    transferToken: transferIntent.transferToken,
  };

  window.localStorage.setItem(
    ANONYMOUS_STORAGE_TRANSFER_KEY,
    JSON.stringify(pending),
  );

  return { converted: 0, pendingPaths: pending.paths.length };
}

export async function finalizeAnonymousStorageTransfer() {
  const pending = readPendingTransfer();
  if (!pending) {
    return { copied: 0 };
  }

  const supabase = createBrowserSupabaseClient();
  const { data } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  const accessToken = data.session?.access_token;

  if (!accessToken) {
    return { copied: 0 };
  }

  const response = await fetchAnonymousStorageCopy({
    accessToken,
    fromUserId: pending.fromUserId,
    paths: pending.paths,
    transferToken: pending.transferToken,
  });

  if (!response) {
    return { copied: 0, error: "copy_request_failed" };
  }

  const result = (await response.json().catch(() => null)) as
    | CopyAnonymousStorageResponse
    | null;

  if (!response.ok || !result?.ok) {
    return { copied: 0, error: result?.error ?? "copy_failed" };
  }

  const mappings = new Map(
    (result.mappings ?? []).map((entry) => [entry.from, entry.to] as const),
  );

  rewriteLocalStorageStorageRefs(mappings);
  window.localStorage.removeItem(ANONYMOUS_STORAGE_TRANSFER_KEY);
  return { copied: result.copied ?? mappings.size };
}

async function fetchAnonymousStorageCopy({
  accessToken,
  fromUserId,
  paths,
  transferToken,
}: {
  accessToken: string;
  fromUserId: string;
  paths: string[];
  transferToken: string;
}) {
  try {
    return await fetch("/api/account/copy-anonymous-storage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fromUserId,
        paths,
        transferToken,
      }),
    });
  } catch {
    return null;
  }
}

async function createAnonymousStorageTransferIntent({
  accessToken,
  paths,
}: {
  accessToken: string;
  paths: string[];
}) {
  try {
    const response = await fetch("/api/account/transfer-intent", {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ paths }),
    });
    const result = (await response.json().catch(() => null)) as
      | TransferIntentResponse
      | null;

    if (!response.ok || !result?.ok || !result.transferToken) {
      return { error: result?.error ?? "transfer_intent_failed" };
    }

    return { transferToken: result.transferToken };
  } catch {
    return { error: "transfer_intent_request_failed" };
  }
}

function collectLocalStoragePathsForUser(userId: string) {
  const paths = new Set<string>();

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }

    collectStoragePaths(window.localStorage.getItem(key), userId, paths);
  }

  return Array.from(paths);
}

function collectStoragePaths(
  value: unknown,
  userId: string,
  paths: Set<string>,
) {
  if (typeof value === "string") {
    const storagePath = getStoragePhotoPath(value);
    if (storagePath?.split("/")[0] === userId) {
      paths.add(storagePath);
      return;
    }

    try {
      collectStoragePaths(JSON.parse(value), userId, paths);
    } catch {
      // Plain strings that are not storage refs are not relevant.
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectStoragePaths(item, userId, paths);
    }
    return;
  }

  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStoragePaths(item, userId, paths);
    }
  }
}

function rewriteLocalStorageStorageRefs(mappings: Map<string, string>) {
  if (mappings.size === 0) {
    return;
  }

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (!key) {
      continue;
    }

    const rawValue = window.localStorage.getItem(key);
    if (rawValue === null) {
      continue;
    }

    const direct = rewriteStorageRefString(rawValue, mappings);
    if (direct.changed) {
      window.localStorage.setItem(key, direct.value);
      continue;
    }

    try {
      const parsed = JSON.parse(rawValue);
      const rewritten = rewriteStorageRefs(parsed, mappings);
      if (rewritten.changed) {
        window.localStorage.setItem(key, JSON.stringify(rewritten.value));
      }
    } catch {
      // Non-JSON values are handled above.
    }
  }
}

function rewriteStorageRefs(
  value: unknown,
  mappings: Map<string, string>,
): StorageRefRewriteResult {
  if (typeof value === "string") {
    return rewriteStorageRefString(value, mappings);
  }

  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const rewritten = rewriteStorageRefs(item, mappings);
      changed ||= rewritten.changed;
      return rewritten.value;
    });

    return { changed, value: next };
  }

  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const rewritten = rewriteStorageRefs(item, mappings);
      changed ||= rewritten.changed;
      next[key] = rewritten.value;
    }

    return { changed, value: next };
  }

  return { changed: false, value };
}

function rewriteStorageRefString(value: string, mappings: Map<string, string>) {
  const storagePath = getStoragePhotoPath(value);
  if (!storagePath) {
    return { changed: false, value };
  }

  const nextPath = mappings.get(storagePath);
  if (!nextPath) {
    return { changed: false, value };
  }

  return { changed: true, value: toStoragePhotoUrl(nextPath) };
}

function readPendingTransfer() {
  try {
    const raw = window.localStorage.getItem(ANONYMOUS_STORAGE_TRANSFER_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as Partial<PendingAnonymousStorageTransfer>)
      : null;

    if (
      !parsed ||
      typeof parsed.fromUserId !== "string" ||
      !Array.isArray(parsed.paths)
    ) {
      return null;
    }

    return {
      createdAt:
        typeof parsed.createdAt === "string"
          ? parsed.createdAt
          : new Date().toISOString(),
      fromUserId: parsed.fromUserId,
      paths: parsed.paths.filter((path): path is string => typeof path === "string"),
      transferToken:
        typeof parsed.transferToken === "string" ? parsed.transferToken : "",
    } satisfies PendingAnonymousStorageTransfer;
  } catch {
    return null;
  }
}

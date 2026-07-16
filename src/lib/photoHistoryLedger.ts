import {
  readDurableClientValue,
  removeDurableClientValue,
  writeDurableClientValue,
} from "./storage/durableClientStore";

export type PhotoHistoryLedgerKind = "own" | "kept" | "gallery";

type PhotoHistoryLedgerEntry = {
  id: string;
  sourcePhotoId?: string;
  createdAt?: number;
  deliveredAt?: number;
  [key: string]: unknown;
};

const ledgerCache = new Map<PhotoHistoryLedgerKind, PhotoHistoryLedgerEntry[]>();
const ledgerWriteQueues = new Map<PhotoHistoryLedgerKind, Promise<void>>();
let ledgerGeneration = 0;

export function getPhotoHistoryLedgerGeneration() {
  return ledgerGeneration;
}

export async function hydratePhotoHistoryLedger(
  expectedGeneration = ledgerGeneration,
) {
  const hydratedEntries = await Promise.all(
    (["own", "kept", "gallery"] satisfies PhotoHistoryLedgerKind[]).map(async (kind) => {
      const entries = await readDurableClientValue<PhotoHistoryLedgerEntry[]>(
        getLedgerStorageKey(kind),
      );
      return [kind, normalizeLedgerEntries(entries)] as const;
    }),
  );

  if (expectedGeneration !== ledgerGeneration) {
    return;
  }

  for (const [kind, entries] of hydratedEntries) {
    ledgerCache.set(kind, entries);
  }
}

export function readCachedPhotoHistoryEntries<T extends PhotoHistoryLedgerEntry>(
  kind: PhotoHistoryLedgerKind,
) {
  return (ledgerCache.get(kind) ?? []) as T[];
}

export async function readPhotoHistoryEntries<T extends PhotoHistoryLedgerEntry>(
  kind: PhotoHistoryLedgerKind,
) {
  const entries = await readDurableClientValue<PhotoHistoryLedgerEntry[]>(
    getLedgerStorageKey(kind),
  );
  const normalized = normalizeLedgerEntries(entries);
  ledgerCache.set(kind, normalized);
  return normalized as T[];
}

export function upsertPhotoHistoryEntries<T extends PhotoHistoryLedgerEntry>(
  kind: PhotoHistoryLedgerKind,
  entries: T[],
  options?: { expectedGeneration?: number },
) {
  if (entries.length === 0) {
    return Promise.resolve();
  }

  return queueLedgerWrite(kind, async () => {
    if (
      options?.expectedGeneration !== undefined &&
      options.expectedGeneration !== ledgerGeneration
    ) {
      return;
    }

    const persisted = await readDurableClientValue<PhotoHistoryLedgerEntry[]>(
      getLedgerStorageKey(kind),
    );
    const merged = mergeLedgerEntries(normalizeLedgerEntries(persisted), entries);
    await writeDurableClientValue(getLedgerStorageKey(kind), merged);
    ledgerCache.set(kind, merged);
  });
}

export function removePhotoHistoryEntry(
  kind: PhotoHistoryLedgerKind,
  photo: Pick<PhotoHistoryLedgerEntry, "id" | "sourcePhotoId">,
) {
  const cached = ledgerCache.get(kind) ?? [];
  ledgerCache.set(
    kind,
    cached.filter((entry) => !hasMatchingLedgerIdentity(entry, photo)),
  );

  return queueLedgerWrite(kind, async () => {
    const persisted = await readDurableClientValue<PhotoHistoryLedgerEntry[]>(
      getLedgerStorageKey(kind),
    );
    const nextEntries = normalizeLedgerEntries(persisted).filter(
      (entry) => !hasMatchingLedgerIdentity(entry, photo),
    );
    await writeDurableClientValue(getLedgerStorageKey(kind), nextEntries);
    ledgerCache.set(kind, nextEntries);
  });
}

export async function clearPhotoHistoryLedger() {
  ledgerGeneration += 1;
  const pendingWrites = [...ledgerWriteQueues.values()];
  await Promise.all(pendingWrites.map((write) => write.catch(() => undefined)));
  ledgerCache.clear();
  ledgerWriteQueues.clear();

  await Promise.all(
    (["own", "kept", "gallery"] satisfies PhotoHistoryLedgerKind[]).map((kind) =>
      removeDurableClientValue(getLedgerStorageKey(kind)).catch(() => undefined),
    ),
  );
}

function queueLedgerWrite(
  kind: PhotoHistoryLedgerKind,
  write: () => Promise<void>,
) {
  const previous = ledgerWriteQueues.get(kind) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(write);
  ledgerWriteQueues.set(kind, next);

  return next.finally(() => {
    if (ledgerWriteQueues.get(kind) === next) {
      ledgerWriteQueues.delete(kind);
    }
  });
}

function getLedgerStorageKey(kind: PhotoHistoryLedgerKind) {
  return `photo-history:${kind}:v1`;
}

function normalizeLedgerEntries(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is PhotoHistoryLedgerEntry =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as PhotoHistoryLedgerEntry).id === "string" &&
        Boolean((entry as PhotoHistoryLedgerEntry).id),
    )
    .sort((first, second) => getLedgerTimestamp(second) - getLedgerTimestamp(first));
}

function mergeLedgerEntries(
  existingEntries: PhotoHistoryLedgerEntry[],
  incomingEntries: PhotoHistoryLedgerEntry[],
) {
  const merged: PhotoHistoryLedgerEntry[] = [];

  for (const entry of [...incomingEntries, ...existingEntries]) {
    const matchingIndex = merged.findIndex((candidate) =>
      hasMatchingLedgerIdentity(candidate, entry),
    );

    if (matchingIndex === -1) {
      merged.push(entry);
      continue;
    }

    merged[matchingIndex] = mergeLedgerEntryVersions(merged[matchingIndex], entry);
  }

  return merged.sort(
    (first, second) => getLedgerTimestamp(second) - getLedgerTimestamp(first),
  );
}

function hasMatchingLedgerIdentity(
  first: Pick<PhotoHistoryLedgerEntry, "id" | "sourcePhotoId">,
  second: Pick<PhotoHistoryLedgerEntry, "id" | "sourcePhotoId">,
) {
  return (
    first.id === second.id ||
    Boolean(
      first.sourcePhotoId &&
        second.sourcePhotoId &&
        first.sourcePhotoId === second.sourcePhotoId,
    )
  );
}

function mergeLedgerEntryVersions(
  preferred: PhotoHistoryLedgerEntry,
  fallback: PhotoHistoryLedgerEntry,
) {
  const merged = { ...fallback, ...preferred };

  for (const [key, value] of Object.entries(fallback)) {
    if (merged[key] === undefined || merged[key] === null || merged[key] === "") {
      merged[key] = value;
    }
  }

  return merged;
}

function getLedgerTimestamp(entry: PhotoHistoryLedgerEntry) {
  return entry.deliveredAt ?? entry.createdAt ?? 0;
}

const DURABLE_CLIENT_DB_NAME = "neteruneko-durable-state";
const DURABLE_CLIENT_DB_VERSION = 1;
const DURABLE_CLIENT_RECORD_STORE = "records";

type DurableClientRecord<T = unknown> = {
  key: string;
  value: T;
  updatedAt: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let activeDatabase: IDBDatabase | null = null;

export async function readDurableClientValue<T>(key: string) {
  const record = await runWithDurableClientDatabase((database) =>
    runDurableRequest<DurableClientRecord<T> | undefined>(
      database,
      "readonly",
      (store) => store.get(key),
    ),
  );

  return record?.value ?? null;
}

export async function writeDurableClientValue<T>(key: string, value: T) {
  await runWithDurableClientDatabase((database) =>
    runDurableRequest(
      database,
      "readwrite",
      (store) =>
        store.put({
          key,
          value,
          updatedAt: Date.now(),
        } satisfies DurableClientRecord<T>),
    ),
  );
}

export async function removeDurableClientValue(key: string) {
  await runWithDurableClientDatabase((database) =>
    runDurableRequest(database, "readwrite", (store) => store.delete(key)),
  );
}

export function clearDurableClientStore() {
  databasePromise?.then((database) => database.close()).catch(() => undefined);
  databasePromise = null;
  activeDatabase = null;

  return new Promise<void>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      resolve();
      return;
    }

    const request = indexedDB.deleteDatabase(DURABLE_CLIENT_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("durable_store_clear_failed"));
    request.onblocked = () => resolve();
  });
}

function openDurableClientDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexeddb_unavailable"));
      return;
    }

    const request = indexedDB.open(
      DURABLE_CLIENT_DB_NAME,
      DURABLE_CLIENT_DB_VERSION,
    );
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DURABLE_CLIENT_RECORD_STORE)) {
        database.createObjectStore(DURABLE_CLIENT_RECORD_STORE, {
          keyPath: "key",
        });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      activeDatabase = database;
      database.addEventListener("close", () => {
        forgetDurableClientDatabase(database);
      });
      database.onversionchange = () => {
        forgetDurableClientDatabase(database);
        database.close();
      };
      resolve(database);
    };
    request.onerror = () => {
      databasePromise = null;
      reject(request.error ?? new Error("durable_store_open_failed"));
    };
  });

  return databasePromise;
}

async function runWithDurableClientDatabase<T>(
  operation: (database: IDBDatabase) => Promise<T>,
) {
  const database = await openDurableClientDatabase();

  try {
    return await operation(database);
  } catch (error) {
    if (!isClosedDatabaseError(error)) {
      throw error;
    }

    invalidateDurableClientDatabase(database);
    return operation(await openDurableClientDatabase());
  }
}

function invalidateDurableClientDatabase(database: IDBDatabase) {
  forgetDurableClientDatabase(database);
  try {
    database.close();
  } catch {
    // The browser may already have closed this connection.
  }
}

function forgetDurableClientDatabase(database: IDBDatabase) {
  if (activeDatabase !== database) {
    return;
  }

  activeDatabase = null;
  databasePromise = null;
}

function isClosedDatabaseError(error: unknown) {
  const name =
    typeof DOMException !== "undefined" && error instanceof DOMException
      ? error.name
      : error instanceof Error
        ? error.name
        : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return Boolean(
    name === "InvalidStateError" ||
      name === "TransactionInactiveError" ||
      message.includes("database connection is closing") ||
      message.includes("database connection is closed") ||
      message.includes("database is closing") ||
      message.includes("database is closed"),
  );
}

function runDurableRequest<T = IDBValidKey>(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(DURABLE_CLIENT_RECORD_STORE, mode);
    const request = createRequest(transaction.objectStore(DURABLE_CLIENT_RECORD_STORE));
    let result = undefined as T;

    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () =>
      reject(request.error ?? new Error("durable_store_request_failed"));
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("durable_store_transaction_aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("durable_store_transaction_failed"));
  });
}

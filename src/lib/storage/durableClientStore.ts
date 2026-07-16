const DURABLE_CLIENT_DB_NAME = "neteruneko-durable-state";
const DURABLE_CLIENT_DB_VERSION = 1;
const DURABLE_CLIENT_RECORD_STORE = "records";

type DurableClientRecord<T = unknown> = {
  key: string;
  value: T;
  updatedAt: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;

export async function readDurableClientValue<T>(key: string) {
  const database = await openDurableClientDatabase();
  const record = await runDurableRequest<DurableClientRecord<T> | undefined>(
    database,
    "readonly",
    (store) => store.get(key),
  );

  return record?.value ?? null;
}

export async function writeDurableClientValue<T>(key: string, value: T) {
  const database = await openDurableClientDatabase();
  await runDurableRequest(
    database,
    "readwrite",
    (store) =>
      store.put({
        key,
        value,
        updatedAt: Date.now(),
      } satisfies DurableClientRecord<T>),
  );
}

export async function removeDurableClientValue(key: string) {
  const database = await openDurableClientDatabase();
  await runDurableRequest(database, "readwrite", (store) => store.delete(key));
}

export function clearDurableClientStore() {
  databasePromise?.then((database) => database.close()).catch(() => undefined);
  databasePromise = null;

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
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
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

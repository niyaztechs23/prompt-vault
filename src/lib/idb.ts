let dbPromise: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = new Promise((res, rej) => {
    const req = indexedDB.open('prompt-vault', 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('doc')) req.result.createObjectStore('doc'); };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error ?? new Error('IndexedDB unavailable'));
  });
  return dbPromise;
}
export async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction('doc', 'readonly').objectStore('doc').get(key);
    r.onsuccess = () => res(r.result as T | undefined); r.onerror = () => rej(r.error);
  });
}
export async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await open();
  return new Promise((res, rej) => {
    const r = db.transaction('doc', 'readwrite').objectStore('doc').put(value, key);
    r.onsuccess = () => res(); r.onerror = () => rej(r.error);
  });
}

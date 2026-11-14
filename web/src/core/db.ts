// One IndexedDB database for everything Stellar keeps in this browser:
//   files      the audio of songs added from this computer (key: song id)
//   tracks     their titles, lyrics and timing fixes (keyPath: id)
//   playlists  your own playlists (keyPath: id)
//   lyrics     your lyrics library, one sheet per song title and artist (keyPath: key)
export const DB = 'stellar', FILES = 'files', TRACKS = 'tracks', PLAYLISTS = 'playlists', LYRICS = 'lyrics';

let dbp: Promise<IDBDatabase> | null = null;
export function openDb(): Promise<IDBDatabase> {
  if (!dbp) dbp = new Promise<IDBDatabase>((res, rej) => {
    if (typeof indexedDB === 'undefined') return rej(new Error('no IndexedDB'));
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      const db = r.result, has = (n: string) => db.objectStoreNames.contains(n);
      if (!has(FILES)) db.createObjectStore(FILES);
      if (!has(TRACKS)) db.createObjectStore(TRACKS, { keyPath: 'id' });
      if (!has(PLAYLISTS)) db.createObjectStore(PLAYLISTS, { keyPath: 'id' });
      if (!has(LYRICS)) db.createObjectStore(LYRICS, { keyPath: 'key' });
    };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  dbp.catch(() => { dbp = null; });
  return dbp;
}
export function done(tx: IDBTransaction) { return new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); }
export function req<T>(r: IDBRequest<T>) { return new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
export async function getAll<T>(store: string): Promise<T[]> { const db = await openDb(); return (await req(db.transaction(store).objectStore(store).getAll())) as T[]; }
export async function putAll(store: string, items: object[]) { if (!items.length) return; const db = await openDb(), tx = db.transaction(store, 'readwrite'); for (const x of items) tx.objectStore(store).put(x); await done(tx); }
export async function del(store: string, key: string) { const db = await openDb(), tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); await done(tx); }
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

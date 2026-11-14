import { app, toast, uiSignal } from '../core/store';
import type { Meta, Track } from '../core/types';
import { FILES, TRACKS, done, newId, openDb, req } from '../core/db';

// Songs added from this computer are kept in the browser's IndexedDB (built for large files), with their
// lyrics, timing fixes and details, so the library is still there after a reload or a restart.
// A song restored from a backup is kept too before its file arrives: it waits as "file needed" until
// you open the folder that holds it.
interface Saved { id: string; name: string; artist: string; lrc: string; synced: boolean; meta?: Meta; fileName: string; type: string; size?: number; order: number; missing?: boolean }

export const isLocal = (t: Track) => !!(t.file || t.missing) && !t.sp && !t.spec && !t.url;

function snapshot(t: Track, order: number): Saved {
  const f = t.file;
  return { id: t.id!, name: t.name, artist: t.artist, lrc: t.lrc || '', synced: !!t.synced, meta: t.meta, fileName: f ? f.name : t.missing!.fileName, type: f ? f.type : '', size: f ? f.size : t.missing!.size, order, missing: !f };
}

let warned = false;
function storageProblem(e: unknown) {
  if (warned) return; warned = true;
  const full = (e as DOMException)?.name === 'QuotaExceededError';
  toast(full ? 'The browser has no more room to keep songs, so new ones will only last until you reload. Remove a few songs to free space.'
    : 'This browser is not letting Stellar keep songs (private window?), so added songs will only last until you reload.');
}

// Keep the audio itself; called when songs are added, or when a waiting song gets its file.
export async function storeSongs(list: Track[]) {
  const local = list.filter(isLocal); if (!local.length) return;
  for (const t of local) if (!t.id) t.id = newId();
  try {
    const db = await openDb(), tx = db.transaction([FILES, TRACKS], 'readwrite');
    const order = app.tracks.filter(isLocal);
    for (const t of local) { if (t.file) tx.objectStore(FILES).put(t.file, t.id!); tx.objectStore(TRACKS).put(snapshot(t, order.indexOf(t))); }
    await done(tx);
    if (navigator.storage && navigator.storage.persist) void navigator.storage.persist().catch(() => false);
  } catch (e) { storageProblem(e); }
}

export async function forgetSong(t: Track) {
  if (!t.id) return;
  try { const db = await openDb(), tx = db.transaction([FILES, TRACKS], 'readwrite'); tx.objectStore(FILES).delete(t.id); tx.objectStore(TRACKS).delete(t.id); await done(tx); } catch { /* nothing stored */ }
}

// Bring back last visit's songs, in their order. The audio is decoded only when a song is played.
export async function restoreSongs(): Promise<Track[]> {
  try {
    const db = await openDb();
    const saved = (await req(db.transaction(TRACKS).objectStore(TRACKS).getAll())) as Saved[];
    saved.sort((a, b) => a.order - b.order);
    const out: Track[] = [];
    for (const s of saved) {
      const blob = (await req(db.transaction(FILES).objectStore(FILES).get(s.id))) as Blob | undefined;
      const base = { id: s.id, name: s.name, artist: s.artist, lrc: s.lrc, synced: s.synced, meta: s.meta, buffer: null };
      if (blob) out.push({ ...base, file: blob instanceof File ? blob : new File([blob], s.fileName, { type: s.type }) });
      else if (s.missing) out.push({ ...base, missing: { fileName: s.fileName, size: s.size || 0 } });
    }
    return out;
  } catch { return []; }
}

// Lyrics, timing fixes and song details change over time; save them shortly after any change.
let timer: ReturnType<typeof setTimeout> | undefined, last = '';
function saveDetails() {
  const local = app.tracks.filter(isLocal).filter(t => t.id), snaps = local.map((t, i) => snapshot(t, i)), key = JSON.stringify(snaps);
  if (key === last) return; last = key;
  void openDb().then(async db => { const tx = db.transaction(TRACKS, 'readwrite'); for (const s of snaps) tx.objectStore(TRACKS).put(s); await done(tx); }).catch(storageProblem);
}
export function watchLibrary() { uiSignal.subscribe(() => { clearTimeout(timer); timer = setTimeout(saveDetails, 800); }); }

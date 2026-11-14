import { app, emit, toast } from '../core/store';
import type { Playlist, Track } from '../core/types';
import { PLAYLISTS, del, getAll, newId, putAll } from '../core/db';
import { lsGet, lsSet } from '../core/util';

// Your own playlists. A playlist holds song keys, so it can mix songs from this computer, songs whose
// file comes later (from a backup), demo songs and Spotify songs. When a Spotify song is replaced by
// your own file, the playlists follow it.
export const trackKey = (t: Track) => t.id ? 'id:' + t.id : t.sp ? t.sp.uri : t.spec || t.url ? 'demo:' + t.name : 'name:' + t.name;

export async function loadPlaylists() {
  try { app.lists = (await getAll<Playlist>(PLAYLISTS)).sort((a, b) => a.created - b.created); } catch { app.lists = []; }
  const last = lsGet('stellar-list'); app.listId = app.lists.some(l => l.id === last) ? last : null;
}
function store(l: Playlist) { void putAll(PLAYLISTS, [l]).catch(() => toast('This browser is not letting Stellar keep playlists (private window?).')); }
export const currentList = () => app.lists.find(l => l.id === app.listId) || null;

export function showList(id: string | null) { app.listId = id; lsSet('stellar-list', id || ''); emit(); }
export function createList(name?: string, keys: string[] = []): Playlist {
  let n = app.lists.length + 1; while (!name && app.lists.some(l => l.name === `Playlist ${n}`)) n++;
  const l: Playlist = { id: newId(), name: (name || `Playlist ${n}`).trim(), keys: [...new Set(keys)], created: Date.now() };
  app.lists.push(l); store(l); emit(); return l;
}
export function renameList(l: Playlist, name: string) { name = name.trim(); if (!name || name === l.name) return; l.name = name; store(l); emit(); }
export function deleteList(l: Playlist) {
  app.lists = app.lists.filter(x => x !== l); void del(PLAYLISTS, l.id).catch(() => {});
  if (app.listId === l.id) showList(null); else emit();
  toast(`Deleted the playlist ${l.name}. Its songs stay in your library.`);
}
export const inList = (l: Playlist, t: Track) => l.keys.includes(trackKey(t));
export function toggleInList(l: Playlist, t: Track) {
  const k = trackKey(t);
  if (l.keys.includes(k)) { l.keys = l.keys.filter(x => x !== k); toast(`Removed from ${l.name}`); } else { l.keys.push(k); toast(`Added to ${l.name}`); }
  store(l); emit();
}
export function moveInList(l: Playlist, t: Track, by: number) {
  const k = trackKey(t), i = l.keys.indexOf(k), j = i + by; if (i < 0 || j < 0 || j >= l.keys.length) return;
  l.keys.splice(i, 1); l.keys.splice(j, 0, k); store(l); emit();
}
// A song changed identity (a Spotify song now plays from your own file): keep it in every playlist.
export function rekey(from: string, to: string) {
  for (const l of app.lists) if (l.keys.includes(from)) { l.keys = [...new Set(l.keys.map(k => k === from ? to : k))]; store(l); }
}
// A song left the library entirely.
export function dropKey(k: string) { for (const l of app.lists) if (l.keys.includes(k)) { l.keys = l.keys.filter(x => x !== k); store(l); } }
export async function mergeLists(lists: Playlist[]) {
  let added = 0;
  for (const l of lists) {
    if (!l || !l.id || !Array.isArray(l.keys)) continue;
    const have = app.lists.find(x => x.id === l.id);
    if (have) { const before = have.keys.length; have.keys = [...new Set([...have.keys, ...l.keys])]; if (have.keys.length !== before) store(have); }
    else { const n: Playlist = { id: l.id, name: String(l.name || 'Playlist'), keys: [...new Set(l.keys.map(String))], created: +l.created || Date.now() }; app.lists.push(n); store(n); added++; }
  }
  app.lists.sort((a, b) => a.created - b.created); emit(); return added;
}

// The play order: the songs of the playlist on show, or every song.
export function queue(): number[] {
  const l = currentList(); if (!l) return app.tracks.map((_, i) => i);
  const at = new Map(app.tracks.map((t, i) => [trackKey(t), i]));
  return l.keys.map(k => at.get(k)).filter((i): i is number => i !== undefined);
}
// The next / previous song in that order. A song outside the playlist continues with the playlist's first song.
export function stepIndex(from: number, by: 1 | -1): number {
  const q = queue(), p = q.indexOf(from);
  if (p < 0) return by > 0 ? (q[0] ?? -1) : -1;
  return q[p + by] ?? -1;
}

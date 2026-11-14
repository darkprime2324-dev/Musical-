import { app, emit, uiSignal } from '../core/store';
import type { LyricsEntry, Track } from '../core/types';
import { LYRICS, del, getAll, putAll } from '../core/db';
import { lsGet, lsSet } from '../core/util';

// Your lyrics library: every lyric sheet Stellar has for a song (found on LRCLIB, opened from a .lrc file,
// pasted, written or tap-synced by you) is kept here by song title and artist, in this browser's
// IndexedDB. It does not depend on where the audio comes from: a song played from Spotify, from a file
// or from a backup on another computer finds the same lyrics again.

// Titles and artists compared loosely: case, accents, "(feat. ...)", "- Remastered" and punctuation ignored.
export function norm(s: string | undefined): string {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[([][^)\]]*(feat|ft\.|with |remaster|version|from |live|edit|mix)[^)\]]*[)\]]/g, ' ')
    .replace(/\s[-–]\s.*(remaster|version|live|edit|mono|stereo|mix).*$/, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
export const firstArtist = (a: string | undefined) => String(a || '').split(/\s*(?:,|&|·|\bfeat\.?|\bft\.?|\band\b|\/|;)\s*/i)[0];
export const songKey = (title: string, artist: string) => norm(title) + '|' + norm(firstArtist(artist));
const trackTitle = (t: Track) => t.meta?.title || t.name, trackArtist = (t: Track) => t.meta?.artist || t.artist || '';
export const trackSongKey = (t: Track) => songKey(trackTitle(t), trackArtist(t));
const trackDur = (t: Track) => t.buffer ? t.buffer.duration : t.sp ? t.sp.durationMs / 1000 : 0;

const lib = new Map<string, LyricsEntry>();
export const lyricsList = () => [...lib.values()].sort((a, b) => a.title.localeCompare(b.title));
export const lyricsCount = () => lib.size;
export const lyricsFor = (t: Track) => lib.get(trackSongKey(t));

// The demo songs carry their own lyrics; built-in lyrics are not part of your library.
const keepable = (t: Track) => !t.spec && !!t.meta && !!(t.lrc || '').trim() && !!norm(trackTitle(t));

export async function loadLyricsLibrary() {
  try { for (const e of await getAll<LyricsEntry>(LYRICS)) lib.set(e.key, e); } catch { /* storage unavailable */ }
  // Lyrics from before the library existed lived in localStorage under "stellar-lrc:title|artist|seconds".
  if (lsGet('stellar-lyrics-migrated')) return;
  const moved: LyricsEntry[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) || ''; if (!k.startsWith('stellar-lrc:')) continue;
      const [title, artist, sec] = k.slice(12).split('|'), lrc = localStorage.getItem(k) || '', key = songKey(title, artist);
      if (!lrc.trim() || !norm(title) || lib.has(key)) continue;
      const e = { key, title, artist, lrc, dur: +sec || 0, updated: Date.now() }; lib.set(key, e); moved.push(e);
    }
  } catch { /* storage unavailable */ }
  try { await putAll(LYRICS, moved); lsSet('stellar-lyrics-migrated', '1'); } catch { /* try again next visit */ }
}

// Keep a song's current lyrics. Returns true when something changed.
export function rememberLyrics(t: Track): boolean {
  if (!keepable(t)) return false;
  const key = trackSongKey(t), old = lib.get(key);
  if (old && old.lrc === t.lrc) return false;
  const e: LyricsEntry = { key, title: trackTitle(t), artist: trackArtist(t), lrc: t.lrc, dur: Math.round(trackDur(t) * 10) / 10 || old?.dur || 0, updated: Date.now() };
  lib.set(key, e); void putAll(LYRICS, [e]).catch(() => {});
  return true;
}
// Add sheets from a backup; a sheet already here wins unless the backup's copy is newer.
export async function mergeLyrics(list: LyricsEntry[]) {
  const fresh = list.filter(e => e && e.key && typeof e.lrc === 'string' && e.lrc.trim() && (!lib.has(e.key) || (e.updated || 0) > lib.get(e.key)!.updated));
  for (const e of fresh) lib.set(e.key, e);
  await putAll(LYRICS, fresh); return fresh.length;
}
export async function forgetLyrics(key: string) {
  lib.delete(key);
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i) || ''; if (k.startsWith('stellar-lrc:')) { const [ti, ar] = k.slice(12).split('|'); if (songKey(ti, ar) === key) localStorage.removeItem(k); } } } catch { /* storage unavailable */ }
  try { await del(LYRICS, key); } catch { /* not stored */ }
  emit();
}

// Whatever path lyrics take into a song (LRCLIB, a .lrc file, the Lyrics panel, tap-sync, auto-sync, a nudge),
// they reach the library shortly afterwards.
let timer: ReturnType<typeof setTimeout> | undefined;
export function watchLyrics() {
  uiSignal.subscribe(() => { clearTimeout(timer); timer = setTimeout(() => { let changed = false; for (const t of app.tracks) changed = rememberLyrics(t) || changed; if (changed) emit(); }, 1000); });
}

// A file name for downloading a sheet: "Title - Artist.lrc".
export const lrcFileName = (e: { title: string; artist: string }) => `${[e.title, e.artist].filter(Boolean).join(' - ').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'lyrics'}.lrc`;
export function download(name: string, text: string, type = 'text/plain') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
// Where a sheet came from, from the tags Stellar writes into it.
export function lyricsSource(lrc: string) {
  const timed = /\[\d+:\d/.test(lrc);
  const from = /\[by:LRCLIB/i.test(lrc) ? 'LRCLIB' : 'Yours';
  const fit = /tap-synced/.test(lrc) ? 'tap-synced' : /auto-synced/.test(lrc) ? 'auto-synced' : /\[offset:/i.test(lrc) ? 'nudged' : '';
  return { timed, label: [from, fit].filter(Boolean).join(', ') };
}

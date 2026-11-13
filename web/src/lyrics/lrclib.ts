import { app, emit, setSyncPill, toast } from '../core/store';
import type { LrclibRecord, Track } from '../core/types';
import { dur } from '../audio/engine';

// LRCLIB (lrclib.net) is a free, open database of synced lyrics. Lyrics are fetched when a song plays,
// never shipped with the app, and remembered per song in this browser.
const LRCLIB = 'https://lrclib.net/api', LRC_CLIENT = 'Stellar lyric player (github.com/darkprime2324-dev/Musical-)';
let onlineBlocked = false;

const cacheKey = (tr: Track) => 'stellar-lrc:' + [tr.meta?.title || tr.name, tr.meta?.artist || '', Math.round(tr.buffer ? tr.buffer.duration : tr.sp ? tr.sp.durationMs / 1000 : 0)].join('|').toLowerCase();
export function cacheGet(tr: Track) { try { return localStorage.getItem(cacheKey(tr)) || ''; } catch { return ''; } }
export function cacheSet(tr: Track | undefined, text: string) { if (!tr || tr.spec) return; try { localStorage.setItem(cacheKey(tr), text); } catch { /* storage unavailable */ } }

async function lrclib<T>(path: string, params: Record<string, string | number | undefined>): Promise<T | null> {
  const u = new URL(LRCLIB + path);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, String(v));
  const r = await fetch(u, { headers: { 'Lrclib-Client': LRC_CLIENT } });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('LRCLIB answered ' + r.status);
  return r.json() as Promise<T>;
}
export async function searchLyrics(title: string, artist: string): Promise<LrclibRecord[]> {
  let rs = artist ? await lrclib<LrclibRecord[]>('/search', { track_name: title, artist_name: artist }) : null;
  if (!rs || !rs.length) rs = await lrclib<LrclibRecord[]>('/search', { q: [title, artist].filter(Boolean).join(' ') });
  if ((!rs || !rs.length) && artist) rs = await lrclib<LrclibRecord[]>('/search', { q: title });
  return rs || [];
}
// Timed lyrics first, then the version whose length is closest to the song.
export function rankResults(rs: LrclibRecord[], duration: number) {
  return rs.filter(r => !r.instrumental && (r.syncedLyrics || r.plainLyrics))
    .map(r => ({ r, s: (r.syncedLyrics ? 0 : 1000) + Math.abs((r.duration || 0) - (duration || r.duration || 0)) }))
    .sort((a, b) => a.s - b.s).map(x => x.r);
}
export function lrcFromResult(r: LrclibRecord) {
  const head = `[ti:${r.trackName || ''}]\n[ar:${r.artistName || ''}]\n[al:${r.albumName || ''}]\n[by:LRCLIB #${r.id}]\n`;
  return head + (r.syncedLyrics || r.plainLyrics || '').replace(/\r/g, '');
}
export function blockedNotice(force = false) {
  if (onlineBlocked && !force) return; onlineBlocked = true;
  toast('Finding lyrics online is blocked inside this preview. Open the player from your GitHub Pages site or your computer to use it, or paste lyrics in the Lyrics panel.');
}

export async function autoFind(tr: Track): Promise<boolean> {
  const { title, artist, album } = tr.meta || { title: '', artist: '', album: '' };
  if (!title || onlineBlocked) return false;
  setSyncPill('Finding lyrics');
  try {
    let best: LrclibRecord | null = null;
    if (tr.sp) {
      // Spotify songs: ask for the exact release first (same title, artist, album and length).
      try { const gm = await lrclib<LrclibRecord>('/get', { track_name: title, artist_name: artist, album_name: album, duration: Math.round(tr.sp.durationMs / 1000) }); if (gm && !gm.instrumental && (gm.syncedLyrics || gm.plainLyrics)) best = gm; }
      catch (e) { if (e instanceof TypeError) throw e; }
    }
    if (!best || !best.syncedLyrics) best = rankResults(await searchLyrics(title, artist), dur())[0] || best;
    if (!best) { setSyncPill(''); toast(`No lyrics found online for ${title}. Paste them in the Lyrics panel.`); return false; }
    tr.lrc = lrcFromResult(best); tr.synced = false; cacheSet(tr, tr.lrc); setSyncPill(best.syncedLyrics ? '' : 'Lyrics without timings');
    toast(`Lyrics for ${best.trackName} found on LRCLIB${best.syncedLyrics ? ', with timings' : ' (no timings)'}`);
    return true;
  } catch (e) {
    setSyncPill('');
    if (e instanceof TypeError) blockedNotice(); else toast('Lyrics search failed: ' + (e as Error).message);
    return false;
  }
}

// The "Find lyrics online" panel.
export async function searchPanel() {
  const { title, artist } = app.query;
  if (!title.trim()) return toast('Type the song title first.');
  app.qState = 'searching'; app.qResults = null; emit();
  try {
    const rs = rankResults(await searchLyrics(title.trim(), artist.trim()), dur());
    app.qResults = rs.slice(0, 8); app.qState = rs.length ? 'idle' : 'none';
  } catch (e) {
    app.qState = 'idle'; app.qResults = null;
    if (e instanceof TypeError) blockedNotice(true); else toast('Lyrics search failed: ' + (e as Error).message);
  }
  emit();
}

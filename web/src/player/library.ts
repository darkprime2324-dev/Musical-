import { app, emit, lyricSignal, setSyncPill, toast } from '../core/store';
import { BUILTIN, DEMOS, S, save } from '../core/settings';
import type { Line, Track } from '../core/types';
import { hash } from '../core/util';
import { fx } from '../core/fx';
import { dur, ensureAC, now, play, seek, stopAll } from '../audio/engine';
import { renderDemo } from '../audio/demo';
import { parseLyrics } from '../lyrics/parse';
import { cleanTitle, readTags } from '../lyrics/tags';
import { autoFind, cacheGet, cacheSet, lrcFromResult } from '../lyrics/lrclib';
import { autoSync } from '../lyrics/autosync';
import { resetLyricAnim } from '../sky/lyrics';
import { spCurrent, spSaveLib } from '../spotify/spotify';
import { forgetSong, storeSongs } from './persist';
import { dropKey, rekey, stepIndex, trackKey } from './playlists';
import { firstArtist, lyricsFor, norm } from '../lyrics/store';
import { newId } from '../core/db';
import type { LrclibRecord } from '../core/types';

export const titleOf = (t: Track) => t.meta?.title || t.name;
export const artistOf = (t: Track) => t.meta?.artist || t.artist || '';
export const nameHue = (s: string) => Math.floor(hash([...String(s)].reduce((a, c) => a + c.charCodeAt(0), 0) * 0.37) * 360);
export const coverBackground = (t: { name: string; cover?: string; meta?: Track['meta'] }) => {
  if (t.cover) return `url("${t.cover}") center / cover`;
  const hh = nameHue(t.meta?.title || t.name);
  return `linear-gradient(135deg,hsl(${hh} 55% 42%),hsl(${(hh + 55) % 360} 60% 20%))`;
};

export function setLines(lines: Line[]) { app.lines = lines; resetLyricAnim(); lyricSignal.emit(); }
export function reparse() { const tr = app.tracks[app.cur]; if (tr) setLines(parseLyrics(tr.lrc || '', dur())); emit(); }

// Lyrics view background: the cover's average colour, or a hue from the title.
function setTint(t: Track) {
  app.lvTint = `hsla(${nameHue(titleOf(t))},45%,13%,.42)`;
  if (!t.cover) return;
  const img = new Image();
  img.onload = () => {
    try {
      const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d')!; x.drawImage(img, 0, 0, 8, 8);
      const d = x.getImageData(0, 0, 8, 8).data; let r = 0, gg = 0, bb = 0;
      for (let k = 0; k < d.length; k += 4) { r += d[k]; gg += d[k + 1]; bb += d[k + 2]; }
      const n = d.length / 4, f = 0.42;
      if (app.tracks[app.cur] === t) { app.lvTint = `rgba(${Math.round(r / n * f)},${Math.round(gg / n * f)},${Math.round(bb / n * f)},.5)`; emit(); }
    } catch { /* cross-origin image without permission */ }
  };
  img.crossOrigin = 'anonymous'; img.src = t.cover;
}

export async function selectTrack(i: number, autoplay: boolean): Promise<void> {
  if (i < 0 || i >= app.tracks.length) return;
  setSyncPill(''); app.qResults = null; app.qState = 'idle';
  stopAll(); app.cur = i; const tr = app.tracks[i]; app.playing = false; setTint(tr);
  app.buffer = null; setLines([]); fx.lastBeatT = -1; fx.intervals = [];
  app.lyricsDraft = tr.lrc || ''; emit();
  if (tr.missing) {
    setLines(parseLyrics(tr.lrc || lyricsFor(tr)?.lrc || '', 0)); emit();
    if (autoplay) toast(`The file for ${titleOf(tr)} is not in this browser yet. Open the folder that holds ${tr.missing.fileName} (Library, Open a music folder) and it is linked by itself.`);
    return;
  }
  if (tr.sp) {
    const st = spCurrent();
    app.playing = st.uri === tr.sp.uri && !st.paused;
    setLines(parseLyrics(tr.lrc || '', dur())); emit(); if (autoplay) play(); void afterLoad(tr, i); return;
  }
  if (!tr.buffer) {
    tr.loading = true; emit();
    try {
      if (tr.spec) tr.buffer = await renderDemo(tr.spec);
      else if (tr.url) { const r = await fetch(tr.url); if (!r.ok) throw new Error('missing'); tr.buffer = await ensureAC().decodeAudioData(await r.arrayBuffer()); }
      else tr.buffer = await ensureAC().decodeAudioData(await tr.file!.arrayBuffer());
    } catch {
      tr.loading = false;
      if (tr.url) { app.tracks.splice(i, 1); if (app.tracks.length) void selectTrack(Math.min(i, app.tracks.length - 1), autoplay); else { app.cur = -1; emit(); } return; }
      emit(); toast(`${tr.name} could not be played. Try an MP3, M4A, WAV or OGG file.`); return;
    }
    tr.loading = false; if (app.cur !== i) return;
  }
  app.buffer = tr.buffer; setLines(parseLyrics(tr.lrc || '', tr.buffer!.duration)); emit(); if (autoplay) play();
  void afterLoad(tr, i);
}

async function afterLoad(tr: Track, i: number) {
  if (tr.spec) return;
  if (!tr.meta) { const tags = tr.q ? { ...tr.q } : (tr.file ? await readTags(tr.file) : {}); tr.meta = { title: cleanTitle(tags.title || tr.name), artist: cleanTitle(tags.artist || ''), album: tags.album || '' }; }
  if (app.cur !== i) return;
  app.query = { title: tr.meta.title, artist: tr.meta.artist };
  if (!tr.lrc) { const c = cacheGet(tr); if (c) { tr.lrc = c; tr.synced = /auto-synced|\[offset:|tap-synced/.test(c); } }
  // Your lyrics library: the same song's lyrics from any earlier source. Timing fixes only carry over to a recording of the same length.
  if (!tr.lrc) { const e = lyricsFor(tr); if (e) { tr.lrc = e.lrc; tr.synced = /auto-synced|\[offset:|tap-synced/.test(e.lrc) && !!e.dur && Math.abs(e.dur - dur()) < 1; } }
  if (!tr.lrc) await autoFind(tr);
  if (app.cur !== i) return;
  if (tr.lrc) { setLines(parseLyrics(tr.lrc, dur())); app.lyricsDraft = tr.lrc; }
  emit();
  if (tr.lrc && !tr.synced && !tr.sp && S.autosync && /\[\d+:\d/.test(tr.lrc)) void autoSync(tr, false, true);
}

export function addDemos() {
  for (const d of [...BUILTIN.map(b => ({ ...b, spec: undefined })), ...DEMOS.map(d => ({ ...d, url: undefined, q: undefined }))])
    if (!app.tracks.some(t => t.name === d.name)) app.tracks.push({ name: d.name, artist: d.artist, lrc: d.lrc, spec: d.spec, url: d.url, q: d.q, buffer: null });
  emit();
}

export function enrich(list: Track[]) {
  for (const t of list) if (t.file) void readTags(t.file).then(tags => {
    if (tags.cover) t.cover = tags.cover;
    if (!t.meta) t.meta = { title: cleanTitle(tags.title || t.name), artist: cleanTitle(tags.artist || ''), album: tags.album || '' };
    if (app.tracks[app.cur] === t) setTint(t);
    emit();
  });
}
export function addSongFiles(files: File[]) { if (files.length) void addFiles(files); }

// Songs already in your library that are waiting for their audio: songs restored from a backup on another
// browser ("file needed"), and Spotify songs. A file you add takes their place, keeping lyrics and playlists.
const sameArtist = (a: string, b: string) => { const x = norm(firstArtist(a)), y = norm(firstArtist(b)); return !x || !y || x.includes(y) || y.includes(x); };
async function claim(files: File[]): Promise<Map<File, Track>> {
  const out = new Map<File, Track>(), waiting = app.tracks.filter(t => t.missing || t.sp); if (!waiting.length) return out;
  const taken = new Set<Track>();
  for (const f of files) {   // the very same file: name and size
    const t = waiting.find(w => !taken.has(w) && w.missing && w.missing.fileName === f.name && (!w.missing.size || w.missing.size === f.size));
    if (t) { out.set(f, t); taken.add(t); }
  }
  for (const f of files) {   // the same song: title (from the tags or the file name) and artist
    if (out.has(f)) continue;
    const tags = await readTags(f), raw = f.name.replace(/\.[^.]+$/, '').replace(/_+/g, ' ');
    if (tags.cover) URL.revokeObjectURL(tags.cover);
    const titles = new Set([tags.title, cleanTitle(f.name), ...raw.split(/\s[-–]\s/)].map(x => norm(x)).filter(Boolean));
    const t = waiting.find(w => !taken.has(w) && titles.has(norm(titleOf(w))) && sameArtist(tags.artist || raw, artistOf(w)));
    if (t) { out.set(f, t); taken.add(t); }
  }
  return out;
}
function adopt(t: Track, f: File, exact: boolean) {
  const before = trackKey(t), wasSp = !!t.sp;
  if (t.sp) { delete t.sp; if (!t.meta) t.meta = { title: t.name, artist: t.artist, album: '' }; }
  if (!exact) t.synced = false;   // a different recording: let auto-sync fit the timings again
  t.file = f; delete t.missing; t.buffer = null; if (!t.id) t.id = newId();
  rekey(before, trackKey(t));
  return wasSp;
}

// Songs from this computer, a folder or a drop, plus any .lrc files with the same name.
export async function addFiles(list: FileList | File[]) {
  const files = [...list], audioFiles = files.filter(f => /\.(mp3|m4a|aac|flac|wav|ogg|opus)$/i.test(f.name)), texts = files.filter(f => /\.(lrc|txt)$/i.test(f.name));
  if (!audioFiles.length && texts.length && app.tracks[app.cur]) { app.lyricsDraft = await texts[0].text(); applyLyrics(); return; }
  if (!audioFiles.length) return toast('No songs found there. Supported: MP3, M4A, AAC, FLAC, WAV, OGG, OPUS.');
  const base = (f: File) => (f.webkitRelativePath || f.name).replace(/\.[^.]+$/, '').toLowerCase(), lrcBy = new Map(texts.map(f => [base(f), f]));
  audioFiles.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name));
  const claimed = await claim(audioFiles), linked: Track[] = [], fresh: Track[] = [];
  let paired = 0, fromSp = 0;
  for (const f of audioFiles) {
    const l = lrcBy.get(base(f)), owner = claimed.get(f);
    if (owner) { if (adopt(owner, f, owner.missing?.fileName === f.name)) fromSp++; linked.push(owner); }
    const t = owner || { name: cleanTitle(f.name), artist: '', lrc: '', file: f, buffer: null } as Track;
    if (l) { t.lrc = await l.text(); t.synced = false; paired++; }
    if (!owner) fresh.push(t);
  }
  const first = app.tracks.length;
  app.tracks.push(...fresh);
  enrich([...linked, ...fresh]); void storeSongs([...linked, ...fresh]); if (fromSp) spSaveLib();
  app.sheet = null; emit();
  const parts = [fresh.length ? `Added ${fresh.length} song${fresh.length === 1 ? '' : 's'}` : '',
    linked.length ? `${linked.length} song${linked.length === 1 ? '' : 's'} already in your library now play${linked.length === 1 ? 's' : ''} from your file${linked.length === 1 ? '' : 's'}${fromSp ? ` (${fromSp} instead of Spotify)` : ''}` : '',
    paired ? `${paired} with their own lyrics file` : ''].filter(Boolean);
  toast(parts.join('; ') + '.');
  const cur = app.tracks[app.cur];
  if (fresh.length) void selectTrack(first, true);
  else if (cur && linked.includes(cur)) void selectTrack(app.cur, false);
}
export function removeTrack(i: number) {
  const [gone] = app.tracks.splice(i, 1); spSaveLib(); if (gone) { void forgetSong(gone); dropKey(trackKey(gone)); }
  if (i === app.cur) {
    stopAll(); app.buffer = null; setLines([]); app.cur = Math.min(app.cur, app.tracks.length - 1);
    if (app.cur >= 0) void selectTrack(app.cur, false); else { app.cur = -1; emit(); }
  } else if (i < app.cur) app.cur--;
  emit();
}

export function applyLyrics() {
  const tr = app.tracks[app.cur]; if (!tr) return toast('Add a song first.');
  tr.lrc = app.lyricsDraft; tr.synced = false; setLines(parseLyrics(tr.lrc, dur())); app.sheet = null; cacheSet(tr, tr.lrc); emit();
  toast(app.lines.length ? `Lyrics applied: ${app.lines.filter(l => l.text).length} lines` : 'No lyrics found. Paste some lines first.');
  if (app.lines.length && S.autosync && !tr.spec && /\[\d+:\d/.test(tr.lrc)) void autoSync(tr, false, true);
}
export function useResult(r: LrclibRecord) {
  const tr = app.tracks[app.cur]; if (!tr) return toast('Add a song first.');
  tr.lrc = lrcFromResult(r); tr.synced = false; cacheSet(tr, tr.lrc); app.lyricsDraft = tr.lrc; setLines(parseLyrics(tr.lrc, dur())); app.sheet = null; emit();
  toast(`Using lyrics from LRCLIB #${r.id}`);
  if (S.autosync && r.syncedLyrics) void autoSync(tr);
}
export function runAutoSync() {
  const tr = app.tracks[app.cur]; if (!tr) return toast('Add a song first.');
  if (tr.spec) return toast('The demo songs are generated in time with their lyrics already.');
  tr.lrc = app.lyricsDraft; app.sheet = null; emit(); void autoSync(tr);
}

// Shift every timestamp: positive ms makes the lyrics appear later. Kept as an [offset:] tag in the lyrics text.
export function nudge(ms: number) {
  const tr = app.tracks[app.cur]; if (!tr || !app.lines.length) return;
  const om = (tr.lrc || '').match(/\[offset:\s*([+-]?\d+)\s*\]/i), cur0 = om ? +om[1] : 0, next = cur0 - ms;
  tr.lrc = om ? tr.lrc.replace(om[0], `[offset:${next}]`) : `[offset:${next}]\n` + (tr.lrc || '');
  tr.synced = true; cacheSet(tr, tr.lrc); app.lyricsDraft = tr.lrc; setLines(parseLyrics(tr.lrc, dur())); emit();
  const d = -next / 1000;
  toast(d === 0 ? 'Lyrics back on their original timing' : `Lyrics ${Math.abs(d).toFixed(1)} s ${d > 0 ? 'later' : 'earlier'}  ([ and ] nudge by 0.1 s, { and } by 1 s)`);
}

// Tap-to-sync: tap once per line, or once per word, while the song plays.
const stamp = (t: number) => `[${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}]`;
const wstamp = (t: number) => stamp(t).replace('[', '<').replace(']', '>');
let syncStamps: { t: number; text: string; words?: { t: number; text: string }[] }[] = [];
const syncText = () => syncStamps.map(l => stamp(l.t) + (l.words ? l.words.map(w => wstamp(w.t) + w.text).join(' ') : l.text)).join('\n');
export function startSync(words: boolean) {
  const list = app.lyricsDraft.split(/\r?\n/).map(l => l.replace(/\[[^\]]*\]|<[^>]*>/g, '').trim()).filter(Boolean);
  if (!app.buffer && !(app.tracks[app.cur] && app.tracks[app.cur].sp)) return toast('Load a song first.');
  if (!list.length) return toast('Paste the lyrics first, one line per row.');
  app.tapSync = { active: true, words, list, i: 0, w: 0 }; syncStamps = []; app.sheet = null; setLines([]); emit();
  seek(0); play();
}
export function syncTap() {
  const s = app.tapSync; if (!s.active || s.i >= s.list.length) return;
  const t = now();
  if (!s.words) { syncStamps.push({ t, text: s.list[s.i] }); s.i++; }
  else {
    const ws = s.list[s.i].split(/\s+/);
    if (s.w === 0) syncStamps.push({ t, text: s.list[s.i], words: [] });
    syncStamps[syncStamps.length - 1].words!.push({ t, text: ws[s.w] }); s.w++;
    if (s.w >= ws.length) { s.i++; s.w = 0; }
  }
  setLines(parseLyrics(syncText(), dur()));
  if (s.i >= s.list.length) syncEnd(); else emit();
}
export function syncEnd() {
  const s = app.tapSync; if (!s.active) return;
  s.active = false; emit(); if (!syncStamps.length) return;
  const tr = app.tracks[app.cur]; tr.lrc = '[by:tap-synced]\n' + syncText(); tr.synced = true; cacheSet(tr, tr.lrc); app.lyricsDraft = tr.lrc;
  setLines(parseLyrics(tr.lrc, dur())); emit();
  toast(`Synced ${syncStamps.length} lines${s.words ? ' word by word' : ''}. Open Lyrics to copy the timed version.`);
}

export function setRoman(on: boolean) { S.roman = on; save(); reparse(); }
// Previous and next follow the playlist on show in the sidebar (or every song), skipping songs whose file is not here yet.
function step(by: 1 | -1) { let i = app.cur; for (let n = 0; n < app.tracks.length; n++) { i = stepIndex(i, by); if (i < 0 || !app.tracks[i].missing) return i; } return -1; }
export function prevTrack() { const i = step(-1); if (now() > 3 || i < 0) seek(0); else void selectTrack(i, true); }
export function nextTrack(auto = false) { const i = step(1); if (i >= 0) void selectTrack(i, true); else if (!auto) toast('This is the last song in the playlist.'); }
export function toggleFullscreen() {
  const w = document.getElementById('stageWrap');
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else if (w && w.requestFullscreen) w.requestFullscreen().catch(() => toast('Full screen is not available here.'));
  else toast('Full screen is not available here.');
}

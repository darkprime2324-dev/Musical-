import { app, curTrack, emit, setSyncPill, toast } from '../core/store';
import type { Track } from '../core/types';
import { dur } from '../audio/engine';
import { parseLyrics, toLrc } from './parse';
import { cacheSet } from './lrclib';
import { setLines } from '../player/library';

// Auto-sync: line the lyrics up with the singing in this exact recording.
// The song is filtered to the vocal range, its loudness followed in 150 ms windows to find where singing
// comes in, and the whole lyric sheet slid (up to 8 s either way) to where line starts land on vocal entries.
const onsetCache = new WeakMap<AudioBuffer, Float32Array>();
async function vocalOnsets(buf: AudioBuffer): Promise<Float32Array> {
  const hit = onsetCache.get(buf); if (hit) return hit;
  const sr = 11025, Off = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const oc = new Off(1, Math.ceil(buf.duration * sr), sr);
  const s = oc.createBufferSource(); s.buffer = buf;
  const hp1 = oc.createBiquadFilter(), hp2 = oc.createBiquadFilter(), lp = oc.createBiquadFilter();
  hp1.type = 'highpass'; hp2.type = 'highpass'; hp1.frequency.value = 280; hp2.frequency.value = 280; lp.type = 'lowpass'; lp.frequency.value = 3400;
  s.connect(hp1).connect(hp2).connect(lp).connect(oc.destination); s.start();
  const x = (await oc.startRendering()).getChannelData(0), hop = Math.round(sr / 100), n = Math.floor(x.length / hop), p = new Float64Array(n);
  for (let i = 0; i < n; i++) { let a = 0; for (let k = i * hop, end = k + hop; k < end; k++) a += x[k] * x[k]; p[i] = a / hop; }
  // Long enough to ignore drum hits and plucks, short enough to catch a vocal entry.
  const W = 15, e = new Float32Array(n); let run = 0;
  for (let i = 0; i < n + W; i++) { if (i < n) run += p[i]; if (i - W >= 0) run -= p[i - W]; const c = i - (W >> 1); if (c >= 0 && c < n) e[c] = Math.log(1e-9 + run / W); }
  const o = new Float32Array(n);
  for (let i = 3; i < n; i++) o[i] = Math.max(0, e[i] - Math.max(e[i - 1], e[i - 2], e[i - 3]));
  const sm = new Float32Array(n); let mean = 0;
  for (let i = 0; i < n; i++) { let a = 0, c = 0; for (let k = -2; k <= 2; k++) if (i + k >= 0 && i + k < n) { a += o[i + k]; c++; } sm[i] = a / c; mean += sm[i]; }
  mean /= n; let v = 0; for (let i = 0; i < n; i++) v += (sm[i] - mean) ** 2; const sd = Math.sqrt(v / n) || 1;
  for (let i = 0; i < n; i++) sm[i] = (sm[i] - mean) / sd;
  onsetCache.set(buf, sm); return sm;
}
function onsetScore(o: Float32Array, starts: number[], off: number) {
  let s = 0;
  for (const t of starts) { const f = Math.round((t + off) * 100); let m = -1; for (let k = f - 4; k <= f + 12; k++) if (k >= 0 && k < o.length && o[k] > m) m = o[k]; s += Math.max(-1, Math.min(m, 6)); }
  return s / starts.length;
}
// Applied only when the best shift clearly beats every other candidate, so an unclear match never makes things worse.
export function findOffset(o: Float32Array, starts: number[]) {
  const offs: number[] = [], sc: number[] = [];
  for (let k = -800; k <= 800; k++) { offs.push(k / 100); sc.push(onsetScore(o, starts, k / 100)); }
  const mean = sc.reduce((a, b) => a + b, 0) / sc.length, sd = Math.sqrt(sc.reduce((a, b) => a + (b - mean) ** 2, 0) / sc.length) || 1;
  let bi = 0; for (let i = 1; i < sc.length; i++) if (sc[i] > sc[bi]) bi = i;
  let si = -1; for (let i = 0; i < sc.length; i++) if (Math.abs(offs[i] - offs[bi]) > 0.3 && (si < 0 || sc[i] > sc[si])) si = i;
  return { offset: offs[bi], z: (sc[bi] - mean) / sd, lead: si < 0 ? 9 : (sc[bi] - sc[si]) / sd };
}

let syncRun = 0;
// auto: started by the app rather than the Auto-sync button, so it only speaks up when it changes something.
export async function autoSync(tr: Track | undefined, quiet = false, auto = false) {
  if (!tr || tr.spec) return;
  const buffer = app.buffer;
  if (!buffer) { if (!quiet && tr.sp) toast('Spotify audio cannot be analysed, so auto-sync is off for Spotify songs. Their lyrics are matched to the exact Spotify release; use [ and ] if one is off.'); return; }
  const run = ++syncRun, raw = parseLyrics(tr.lrc || '', dur(), true), sung = raw.filter(l => l.text);
  if (sung.length < 4) { if (auto) tr.synced = true; else if (!quiet) toast('Auto-sync needs timed lyrics with at least four lines.'); return; }
  setSyncPill('Syncing');
  const o = await vocalOnsets(buffer); if (run !== syncRun || curTrack() !== tr) return;
  const { offset, z, lead } = findOffset(o, sung.map(l => l.t));
  if (z < 3 || lead < 0.5) { tr.synced = true; setSyncPill('Sync: no clear match'); if (!quiet && !auto) toast('No clear match between these lyrics and the singing, so the timings were left as they were. Use [ and ] to nudge them.'); return; }
  if (Math.abs(offset) < 0.05) { tr.synced = true; setSyncPill('In sync', true); if (!quiet && !auto) toast('These lyrics already match this recording.'); return; }
  for (const l of raw) { l.t += offset; if (l.words) for (const w of l.words) { w.t += offset; w.end += offset; } }
  const meta = tr.lrc.match(/^\[(ti|ar|al):[^\]]*\]$/gim) || [], sign = offset >= 0 ? '+' : '-', src = (tr.lrc.match(/\[by:(?:[^\]]*?)(LRCLIB #\d+)/) || [, 'your lyrics'])[1];
  tr.lrc = toLrc(raw, meta, `[by:auto-synced to this recording ${sign}${Math.abs(offset).toFixed(2)} s, ${src}]`);
  tr.synced = true; cacheSet(tr, tr.lrc); app.lyricsDraft = tr.lrc; setLines(parseLyrics(tr.lrc, dur()));
  setSyncPill(`Synced ${sign}${Math.abs(offset).toFixed(2)} s`, true);
  if (!quiet) toast(`Auto-synced: lyrics moved ${Math.abs(offset).toFixed(2)} s ${offset < 0 ? 'earlier' : 'later'} to match this recording`);
  emit();
}

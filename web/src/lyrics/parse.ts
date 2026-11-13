import { app } from '../core/store';
import { S } from '../core/settings';
import type { Line, Word } from '../core/types';
import { now } from '../audio/engine';
import { capFirst, roman } from './roman';

export const LEAD = 0.25; // show each line a touch before it is sung, as karaoke players do

// LRC with [mm:ss.xx] line times, optional <mm:ss.xx> word times and an [offset:ms] tag.
// Plain lines without times are spread evenly across the song.
export function parseLyrics(text: string, duration: number, raw = false): Line[] {
  const out: Line[] = [], plain: string[] = [], re = /\[(\d+):(\d+(?:\.\d+)?)\]/g, wre = /<(\d+):(\d+(?:\.\d+)?)>\s*([^<]*)/g;
  const om = text.match(/\[offset:\s*([+-]?\d+)\s*\]/i), off = om ? +om[1] / 1000 : 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const stamps = [...rawLine.matchAll(re)]; let body = rawLine.replace(re, '').trim();
    if (!stamps.length) { if (body && !/^\[[a-z]+:.*\]$/i.test(body)) plain.push(body); continue; }
    let words: Word[] | null = null;
    if (/<\d+:\d/.test(body)) {
      const parts = [...body.matchAll(wre)].map(m => ({ t: +m[1] * 60 + +m[2], text: m[3].trim() })).filter(u => u.text);
      if (parts.length) {
        const ws: Word[] = [];
        parts.forEach((u, i) => {
          const end = i + 1 < parts.length ? parts[i + 1].t : u.t + 0.6, split = u.text.split(/\s+/);
          split.forEach((w, j) => ws.push({ t: u.t + (end - u.t) * j / split.length - off, end: u.t + (end - u.t) * (j + 1) / split.length - off, text: w }));
        });
        words = ws; body = ws.map(w => w.text).join(' ');
      } else body = body.replace(/<[^>]*>/g, '').trim();
    }
    for (const m of stamps) out.push({ t: +m[1] * 60 + +m[2] - off, end: 0, text: body, words: words && words.map(w => ({ ...w })) });
  }
  if (!out.length && plain.length) {
    const d = duration || plain.length * 4, a = d * 0.04, span = d * 0.9;
    plain.forEach((w, i) => out.push({ t: a + span * i / plain.length, end: 0, text: w, words: null }));
  }
  out.sort((x, y) => x.t - y.t);
  out.forEach((l, i) => {
    l.end = i + 1 < out.length ? out[i + 1].t : (duration || l.t + 4);
    if (l.words) l.words[l.words.length - 1].end = Math.min(l.words[l.words.length - 1].end, l.end);
  });
  if (S.roman && !raw) for (const l of out) {
    if (l.words) { for (const w of l.words) w.text = roman(w.text); if (l.words[0]) l.words[0].text = capFirst(l.words[0].text); l.text = l.words.map(w => w.text).join(' '); }
    else l.text = capFirst(roman(l.text));
  }
  return out;
}

export function lineAt(t: number) {
  const lines = app.lines; let idx = -1;
  for (let i = 0; i < lines.length; i++) { if (lines[i].t <= t + LEAD) idx = i; else break; }
  return idx;
}
// How long a line takes to sing, used when there are no word times.
export const spanOf = (l: Line) => Math.max(0.3, Math.min(l.end - l.t, 0.6 + l.text.length * 0.11) * 0.95);

// Rough syllable count: singing time follows syllables, not letters ("lights" is one beat, "neon" two).
export function syllables(w: string): number {
  if (/[ऀ-෿]/.test(w)) {
    // Indic scripts: each consonant or vowel letter starts a syllable unless a virama joins it to the next.
    const letters = (w.match(/[ऄ-हक़-ॡஅ-ஹఅ-హౘ-ౡಅ-ಹഅ-ഹ]/g) || []).length;
    const joins = (w.match(/[्்్್്]/g) || []).length;
    // Hindi drops the vowel of a word's final consonant ("pyaar", "dil"), so that letter adds no syllable.
    const hindiFinal = /[क-हक़-य़]़?$/.test(w) && letters - joins > 1 ? 1 : 0;
    return Math.max(1, letters - joins - hindiFinal);
  }
  const s = w.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return 1;
  let n = (s.match(/[aeiouy]+/g) || []).length;
  n += (s.match(/eo|ia|io|ua|uo/g) || []).length; // vowel pairs sung as two ("ne-on", "di-al")
  if (n > 1 && /[^aeiouy]e$/.test(s) && !/[^aeiouy]le$/.test(s)) n--; // silent final e ("time", "make")
  return Math.max(1, n);
}

// Start and end of every word on screen. Exact when the lyrics carry word times;
// otherwise the line's singing time is shared out by syllables, with a small gap between words.
export function wordTimes(l: Line): { t: number; end: number }[] {
  if (l.wt) return l.wt;
  const ws = l.text.split(/\s+/).filter(Boolean);
  if (l.words && l.words.length === ws.length) return (l.wt = l.words.map(w => ({ t: w.t, end: w.end })));
  const weights = ws.map(w => syllables(w) + 0.35), total = weights.reduce((a, b) => a + b, 0) || 1, span = spanOf(l);
  let acc = 0;
  return (l.wt = weights.map(w => { const t = l.t + span * acc / total; acc += w; return { t, end: l.t + span * acc / total }; }));
}

// The current line, and how many of its words have been sung.
export function lyricState(): [number, number] {
  const lines = app.lines; if (!lines.length) return [-1, 0];
  const t = now(), idx = lineAt(t); let wOn = 0;
  if (idx >= 0 && lines[idx].text) wOn = wordTimes(lines[idx]).filter(w => w.t <= t + 0.06).length;
  return [idx, wOn];
}

export const lrcTime = (t: number) => { const cs = Math.round(Math.max(0, t) * 100), m = Math.floor(cs / 6000), s = (cs % 6000) / 100; return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
export function toLrc(ls: Line[], meta: string[], by: string) {
  return [...meta, by, ...ls.map(l => `[${lrcTime(l.t)}]` + (l.words ? l.words.map(w => `<${lrcTime(w.t)}>` + w.text).join(' ') : l.text))].join('\n');
}

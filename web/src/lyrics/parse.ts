import { app } from '../core/store';
import { S } from '../core/settings';
import type { Line, Word } from '../core/types';
import { clamp } from '../core/util';
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

// The current line, and how many of its words have been sung.
export function lyricState(): [number, number] {
  const lines = app.lines; if (!lines.length) return [-1, 0];
  const t = now(), idx = lineAt(t); let wOn = 0;
  if (idx >= 0 && lines[idx].text) {
    const l = lines[idx];
    if (l.words) wOn = l.words.filter(w => w.t <= t + LEAD).length;
    else wOn = Math.ceil(clamp((t - l.t + LEAD) / spanOf(l), 0, 1) * l.text.split(/\s+/).length);
  }
  return [idx, wOn];
}

export const lrcTime = (t: number) => { const cs = Math.round(Math.max(0, t) * 100), m = Math.floor(cs / 6000), s = (cs % 6000) / 100; return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
export function toLrc(ls: Line[], meta: string[], by: string) {
  return [...meta, by, ...ls.map(l => `[${lrcTime(l.t)}]` + (l.words ? l.words.map(w => `<${lrcTime(w.t)}>` + w.text).join(' ') : l.text))].join('\n');
}

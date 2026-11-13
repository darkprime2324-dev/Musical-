import { g, W, H, LY, fontGen } from './canvas';
import { circle, sparkle } from './draw';
import { app } from '../core/store';
import { fx, fxParts } from '../core/fx';
import { CALM, HYPE, S } from '../core/settings';
import type { Line, Scene, StyleId } from '../core/types';
import { clamp, DISPLAY, easeInOut, easeOutBack, easeOutCubic, hash, MOON, MONO, RM, TAU, UIF, units } from '../core/util';
import { now } from '../audio/engine';
import { lineAt, spanOf } from '../lyrics/parse';
import { titleOf } from '../player/library';

// ---------- layout: where every word and letter of a line sits on the sky ----------
interface Ch { c: string; cx: number; y: number; w: number; i: number; wi: number }
interface Wd { text: string; x: number; cx: number; y: number; w: number; i: number; wi: number }
export interface Layout { size: number; chars: Ch[]; words: Wd[]; n: number; box: { x0: number; x1: number; y0: number; y1: number } }
export const layoutCache = new Map<string, Layout>();
const font = (size: number) => `500 ${size}px ${DISPLAY}`;

function wrapWords(words: string[], maxW: number): string[][] {
  const rows: string[][] = []; let cur: string[] = [];
  for (const w of words) { const t = [...cur, w].join(' '); if (g.measureText(t).width > maxW && cur.length) { rows.push(cur); cur = [w]; } else cur.push(w); }
  if (cur.length) rows.push(cur); return rows;
}
function getLayout(text: string, emph: boolean): Layout {
  const key = text + '|' + W + '|' + H + '|' + fontGen + '|' + LY.lyr.maxW + '|' + LY.lyr.y;
  const hit = layoutCache.get(key); if (hit) return hit;
  const { x, y, maxW: mw, maxH } = LY.lyr, maxW = mw * 0.9, words = text.split(/\s+/).filter(Boolean);
  let size = Math.min(72, maxW * 0.11, maxH / 3.6) * (emph ? 1.1 : 1), rows: string[][];
  for (;;) { g.font = font(size); rows = wrapWords(words, maxW); if ((rows.length <= 3 && rows.every(r => g.measureText(r.join(' ')).width <= maxW)) || size <= 14) break; size *= 0.92; }
  const lh = size * 1.32, y0 = y - (rows.length - 1) * lh / 2, chars: Ch[] = [], wordsOut: Wd[] = [];
  let gi = 0, wi = 0, x0min = Infinity, x1max = -Infinity;
  rows.forEach((row, ri) => {
    const rw = g.measureText(row.join(' ')).width, xs = x - rw / 2; x0min = Math.min(x0min, xs); x1max = Math.max(x1max, xs + rw); let xl = xs;
    row.forEach((w, j) => {
      const ww = g.measureText(w).width; wordsOut.push({ text: w, x: xl, cx: xl + ww / 2, y: y0 + ri * lh, w: ww, i: gi, wi });
      for (const c of units(w)) { const cw = g.measureText(c).width; chars.push({ c, cx: xl + cw / 2, y: y0 + ri * lh, w: cw, i: gi, wi }); xl += cw; gi++; }
      wi++; if (j < row.length - 1) { xl += g.measureText(' ').width; gi++; }
    });
    gi++;
  });
  const L: Layout = { size, chars, words: wordsOut, n: Math.max(1, gi - 1), box: { x0: x0min, x1: x1max, y0: y0 - size * 0.6, y1: y0 + (rows.length - 1) * lh + size * 0.6 } };
  if (layoutCache.size > 60) layoutCache.clear(); layoutCache.set(key, L); return L;
}
type K = (ch: { i: number; wi: number }) => number;
function kOf(line: Line, L: Layout, ch: { i: number; wi: number }, t: number, p: number) {
  if (line.words && line.words[ch.wi]) { const w = line.words[ch.wi]; return clamp((t - w.t) / Math.max(0.08, w.end - w.t), 0, 1); }
  return clamp(p * L.n - ch.i, 0, 1);
}
function wordStart(line: Line, L: Layout, w: number, span: number) { return line.words && line.words[w] ? line.words[w].t : line.t + span * ((L.words[w] ? L.words[w].i : 0) / L.n); }
function glyph(ch: Ch, x: number, y: number, sc: number, rot: number, fill: string, stroke: string | null, lw: number) {
  g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.scale(sc, sc);
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeText(ch.c, -ch.w / 2, 0); }
  g.fillStyle = fill; g.fillText(ch.c, -ch.w / 2, 0); g.restore();
}

// ---------- the line on screen, and the one fading out ----------
let curIdx = -2, curStart = 0, curStyle: Exclude<StyleId, 'auto'> = 'constellation';
let prev: { idx: number; line: Line; text: string; emph: boolean; start: number; style: Exclude<StyleId, 'auto'> } | null = null;
export const resetLyricAnim = () => { curIdx = -2; };
export const forceStyle = (s: StyleId) => { if (s !== 'auto') curStyle = s; };
function pickStyle(idx: number): Exclude<StyleId, 'auto'> {
  if (S.style !== 'auto') return S.style;
  const hype = fx.lvFast > 60 || /!/.test(app.lines[idx].text), arr = (hype ? HYPE : CALM) as Exclude<StyleId, 'auto'>[];
  return arr[Math.floor(hash(idx * 7.3 + 1) * arr.length)];
}

type StyleFn = (L: Layout, p: number, age: number, P: Scene, idx: number, K: K, line: Line, t: number, span: number, alphaMul: number) => void;

export function drawLyrics(P: Scene) {
  const lines = app.lines, t = now(), idx = lineAt(t), T = fx.T;
  if (idx !== curIdx) {
    prev = (curIdx >= 0 && lines[curIdx] && lines[curIdx].text) ? { idx: curIdx, line: lines[curIdx], text: lines[curIdx].text, emph: /!$/.test(lines[curIdx].text), start: T, style: curStyle } : null;
    curIdx = idx; curStart = T; if (idx >= 0) curStyle = pickStyle(idx);
  }
  g.textBaseline = 'middle'; g.textAlign = 'left'; g.lineJoin = 'round';
  if (prev) {
    const a = T - prev.start, fadeT = ['constellation', 'orbit', 'starmap'].includes(prev.style) ? 1.2 : 0.4, o = 1 - a / fadeT;
    if (o <= 0) prev = null;
    else {
      const L = getLayout(prev.text, prev.emph); g.font = font(L.size); const span = spanOf(prev.line);
      if (prev.style === 'constellation' || prev.style === 'orbit' || prev.style === 'starmap') STYLE_FNS[prev.style](L, 1, 99, P, prev.idx, () => 1, prev.line, 1e9, span, o * 0.6);
      else { g.globalAlpha = o * 0.8; for (const ch of L.chars) glyph(ch, ch.cx, ch.y - a * L.size * 1.2, 1, 0, P.lyr, null, 0); }
      g.globalAlpha = 1;
    }
  }
  const tr = app.tracks[app.cur];
  if (!app.buffer && !(tr && tr.sp)) return titleCard(P, tr ? titleOf(tr) : 'Stellar', tr && tr.loading ? 'Loading...' : 'Add a song from the playlist');
  if (idx < 0) return titleCard(P, tr ? titleOf(tr) : 'Stellar', !lines.length ? 'Open the lyrics panel to add the words' : (app.playing ? 'Lyrics start soon' : 'Press play'));
  const line = lines[idx]; if (!line.text) return;
  const emph = /!$/.test(line.text), L = getLayout(line.text, emph), age = T - curStart, span = spanOf(line), p = clamp((t - line.t) / span, 0, 1);
  g.font = font(L.size);
  const K: K = ch => kOf(line, L, ch, t, p);
  STYLE_FNS[curStyle](L, p, age, P, idx, K, line, t, span, 1);
  g.shadowBlur = 0; g.globalAlpha = 1; g.textAlign = 'left'; g.textBaseline = 'middle';
}

function titleCard(P: Scene, mainText: string, sub: string) {
  const { x, y, maxW } = LY.lyr, size = Math.min(54, maxW * 0.09);
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `500 ${size}px ${DISPLAY}`; const yy = y - size * 0.3 + Math.sin(fx.T * 1.2) * 2;
  g.shadowColor = P.accent; g.shadowBlur = 24; g.fillStyle = P.lyr; g.fillText(mainText, x, yy, maxW); g.shadowBlur = 0;
  g.font = `400 ${Math.max(12, size * 0.26)}px ${MONO}`; g.fillStyle = P.accent2; g.globalAlpha = 0.8; g.fillText(sub.toUpperCase().split('').join(' '), x, yy + size, maxW); g.globalAlpha = 1; g.textAlign = 'left';
}

// ---------- the eight styles ----------
const constellation: StyleFn = (L, _p, _age, P, idx, _K, line, t, span, alphaMul) => {
  const words = L.words, n = words.length; if (!n) return;
  const { x, y, maxW, maxH } = LY.lyr, col = P.lyr, T = fx.T;
  const pos = (w: number) => [x + (hash(idx * 53.7 + w * 7.1) - 0.5) * maxW * 0.62 + ((w + 0.5) / n - 0.5) * maxW * 0.3, y + (hash(idx * 91.3 + w * 3.3) - 0.5) * maxH * 0.85];
  let curW = -1; for (let w = 0; w < n; w++) if (wordStart(line, L, w, span) <= t) curW = w;
  const big = Math.min(60, L.size * 0.9), small = Math.max(11, L.size * 0.26);
  g.lineCap = 'round';
  for (let w = 0; w <= curW; w++) {
    const st = wordStart(line, L, w, span), a = clamp((t - st) / 0.3, 0, 1), [px, py] = pos(w);
    if (w > 0) { const [qx, qy] = pos(w - 1); g.strokeStyle = col; g.lineWidth = 0.9; g.globalAlpha = 0.5 * a * alphaMul; g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + (px - qx) * a, qy + (py - qy) * a); g.stroke(); }
    const isCur = w === curW, k = isCur ? 1 : clamp(1 - (t - wordStart(line, L, w + 1, span)) / 0.4, 0, 1), e = easeOutBack(a);
    const sz = small + (big - small) * k, r = (3.5 + 6.5 * k) * e * (1 + (isCur && !RM ? fx.pulse * 0.35 : 0));
    g.globalAlpha = alphaMul * (0.7 + 0.3 * k) * a; g.fillStyle = col; if (isCur) { g.shadowColor = col; g.shadowBlur = 18; }
    sparkle(px, py, r * 1.6, isCur && !RM ? T * 0.6 : 0); g.fill(); g.shadowBlur = 0;
    g.font = `${isCur ? 700 : 500} ${sz}px ${isCur ? DISPLAY : UIF}`; g.textAlign = 'left'; g.textBaseline = 'top';
    const tw = g.measureText(words[w].text).width, left = hash(w * 11.3 + idx) > 0.5;
    const lx = clamp(left ? px - tw - r - 6 : px + r + 6, x - maxW / 2, x + maxW / 2 - tw), ly = py + r * 0.4;
    g.fillStyle = isCur ? '#ffffff' : col; g.fillText(words[w].text, lx, ly);
  }
  g.globalAlpha = 1; g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 1;
};

const orbit: StyleFn = (L, _p, _age, P, idx, _K, line, t, span, alphaMul) => {
  const words = L.words, n = words.length; if (!n) return;
  const { x, y, maxW, maxH } = LY.lyr, T = fx.T;
  let curW = -1; for (let w = 0; w < n; w++) if (wordStart(line, L, w, span) <= t) curW = w;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let w = 0; w < curW; w++) {
    const st = wordStart(line, L, w, span), k = clamp((t - st) / 0.6, 0, 1), ring = curW - w, R = Math.min(maxW, maxH * 1.6) * (0.14 + ring * 0.065) * easeOutCubic(k), tilt = 0.42;
    const a0 = hash(idx * 13 + w * 3.7) * TAU, a = a0 + T * (0.35 / (1 + ring * 0.4)) * (w % 2 ? 1 : -1), px = x + Math.cos(a) * R, py = y + Math.sin(a) * R * tilt, front = Math.sin(a) > 0;
    g.strokeStyle = P.accent2; g.globalAlpha = alphaMul * 0.12; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, R, R * tilt, 0, 0, TAU); g.stroke();
    g.globalAlpha = alphaMul * (front ? 0.85 : 0.4); g.fillStyle = P.lyr; circle(px, py, 2 + (front ? 1 : 0)); g.font = `500 ${Math.max(11, L.size * 0.3)}px ${UIF}`; g.fillText(words[w].text, px, py - 12);
  }
  if (curW >= 0) {
    const st = wordStart(line, L, curW, span), a = clamp((t - st) / 0.35, 0, 1), e = easeOutBack(a), big = Math.min(72, L.size * 1.1);
    g.font = `700 ${big}px ${DISPLAY}`; g.shadowColor = P.accent; g.shadowBlur = 24 + fx.pulse * 20; g.globalAlpha = alphaMul * a;
    g.save(); g.translate(x, y); g.scale(e, e); g.fillStyle = '#fff'; g.fillText(words[curW].text, 0, 0); g.restore(); g.shadowBlur = 0;
    g.fillStyle = P.accent; g.globalAlpha = alphaMul * 0.9; sparkle(x, y - big * 0.75, 6 + fx.pulse * 5, T); g.fill();
  }
  g.globalAlpha = 1; g.textAlign = 'left';
};

const comet: StyleFn = (L, _p, _age, P, idx, K, line, t, span) => {
  g.textAlign = 'left'; g.textBaseline = 'middle';
  L.words.forEach((w, i) => {
    const st = wordStart(line, L, i, span), a = clamp((t - st) / 0.55, 0, 1); if (a <= 0) return; const e = easeOutCubic(a);
    const side = hash(idx * 3.1 + i * 9.7) > 0.5 ? 1 : -1, sx = w.cx + side * W * 0.7, sy = w.y - H * 0.5 * (hash(i * 2.2 + idx) - 0.3);
    const x = sx + (w.cx - sx) * e, y = sy + (w.y - sy) * e, sung = K(L.chars.find(c => c.wi === i) || { i: 0, wi: i }) > 0.5;
    if (a < 1) {
      const tl = (1 - e) * 220, dx = sx - w.cx, dy = sy - w.y, d = Math.hypot(dx, dy) || 1;
      const gr = g.createLinearGradient(x, y, x + dx / d * tl, y + dy / d * tl); gr.addColorStop(0, P.accent2 + 'cc'); gr.addColorStop(1, P.accent2 + '00');
      g.strokeStyle = gr; g.lineWidth = L.size * 0.5 * (1 - e) + 2; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx / d * tl, y + dy / d * tl); g.stroke();
      if (!RM && Math.random() < 0.5) fxParts.push({ x, y, vx: dx / d * 60 + (Math.random() - 0.5) * 40, vy: dy / d * 60 + (Math.random() - 0.5) * 40, life: 0, max: 0.5, s: 1.5, col: P.accent2 });
    }
    g.font = font(L.size); g.shadowColor = sung ? P.accent : P.accent2; g.shadowBlur = sung ? L.size * 0.4 : 8 * (1 - e); g.globalAlpha = 0.4 + 0.6 * e;
    g.fillStyle = sung ? '#fff' : P.lyr; g.fillText(w.text, x - w.w / 2, y); g.shadowBlur = 0;
  });
  g.globalAlpha = 1;
};

const supernova: StyleFn = (L, _p, age, P, idx, K) => {
  const cx = (L.box.x0 + L.box.x1) / 2, cy = (L.box.y0 + L.box.y1) / 2, D = 1.6, big = Math.max(W, H);
  if (age < D && !RM) {
    const k = age / D, ek = easeOutCubic(k); g.save(); g.globalCompositeOperation = 'lighter';
    if (age < 0.12) { g.fillStyle = '#ffffff'; g.globalAlpha = 0.85 * (1 - age / 0.12); g.fillRect(0, 0, W, H); }
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, big * (0.08 + 0.5 * ek)); core.addColorStop(0, '#ffffff'); core.addColorStop(0.15, P.accent); core.addColorStop(0.45, P.accent2 + '66'); core.addColorStop(1, P.accent + '00');
    g.fillStyle = core; g.globalAlpha = Math.pow(1 - k, 1.4); circle(cx, cy, big);
    g.strokeStyle = P.accent2; g.lineWidth = 2.5; g.globalAlpha = (1 - k) * 0.9; g.beginPath(); g.arc(cx, cy, big * 0.75 * ek + 10, 0, TAU); g.stroke();
    g.lineWidth = 1; g.globalAlpha = (1 - k) * 0.5; g.beginPath(); g.arc(cx, cy, big * 0.75 * ek * 0.7 + 6, 0, TAU); g.stroke();
    g.lineCap = 'round';
    for (let i = 0; i < 36; i++) {
      const a = i / 36 * TAU + hash(idx + i) * 0.17, len = (0.25 + 0.75 * hash(i * 3 + idx)) * big * 0.55, r0 = ek * len * 0.55, r1 = r0 + len * 0.45 * (1 - 0.6 * k);
      const gr = g.createLinearGradient(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); gr.addColorStop(0, (i % 3 ? P.accent : '#ffffff') + 'ff'); gr.addColorStop(1, P.accent2 + '00');
      g.strokeStyle = gr; g.lineWidth = i % 3 ? 2 : 4; g.globalAlpha = (1 - k) * (0.7 + 0.3 * hash(i * 7)); g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
    }
    g.restore();
    if (age < 0.25 && fxParts.length < 160) for (let i = 0; i < 6; i++) { const a = Math.random() * TAU, sp = 250 + Math.random() * 500; fxParts.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 0.9 + Math.random() * 0.6, s: 1.5 + Math.random() * 2.5, col: Math.random() < 0.5 ? '#ffffff' : P.accent }); }
  }
  for (const ch of L.chars) {
    const a = clamp((age - 0.1 - ch.i * 0.014) / 0.7, 0, 1); if (a <= 0) continue;
    const e = easeOutBack(a), px = cx + (ch.cx - cx) * e, py = cy + (ch.y - cy) * e, sung = K(ch) > 0.5;
    g.globalAlpha = a; if (sung) { g.shadowColor = P.accent; g.shadowBlur = L.size * 0.35; }
    glyph(ch, px, py, 0.4 + 0.6 * e, (1 - e) * (hash(ch.i + idx) - 0.5) * 3, sung ? '#fff' : P.lyr, null, 0); g.shadowBlur = 0;
  }
  g.globalAlpha = 1;
};

const starmap: StyleFn = (L, _p, age, P, idx, K, _line, _t, _span, alphaMul) => {
  const col = P.lyr; g.lineCap = 'round';
  const pts = L.chars.map(ch => [ch.cx, ch.y - L.size * 0.8 - (hash(ch.i * 1.3 + idx) - 0.5) * L.size * 0.6]);
  L.chars.forEach((ch, i) => {
    const a = clamp((age - i * 0.03) / 0.35, 0, 1); if (a <= 0) return; const [px, py] = pts[i], sung = K(ch) > 0.5;
    if (i > 0 && L.chars[i - 1].wi === ch.wi) { const [qx, qy] = pts[i - 1]; g.strokeStyle = col; g.globalAlpha = alphaMul * 0.4 * a; g.lineWidth = 0.8; g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + (px - qx) * a, qy + (py - qy) * a); g.stroke(); }
    else if (i > 0) { const [qx, qy] = pts[i - 1]; g.strokeStyle = col; g.globalAlpha = alphaMul * 0.18 * a; g.setLineDash([2, 6]); g.beginPath(); g.moveTo(qx, qy); g.lineTo(px, py); g.stroke(); g.setLineDash([]); }
    g.fillStyle = sung ? '#fff' : col; g.globalAlpha = alphaMul * a;
    const r = (1.5 + 1.5 * hash(i * 7 + idx) + (sung ? 1.5 : 0)) * easeOutBack(a);
    if (sung) { sparkle(px, py, r * 2.4, fx.T * 0.4); g.globalAlpha *= 0.5; g.fill(); g.globalAlpha = alphaMul * a; }
    circle(px, py, r);
    g.globalAlpha = alphaMul * a * (sung ? 1 : 0.75); glyph(ch, ch.cx, ch.y, 1, 0, sung ? '#fff' : col, null, 0);
  });
  g.globalAlpha = 1;
};

const eclipse: StyleFn = (L, _p, age, P, _idx, K) => {
  const bx0 = L.box.x0 - L.size, bx1 = L.box.x1 + L.size, cy = (L.box.y0 + L.box.y1) / 2;
  const ex = bx0 + (bx1 - bx0) * easeInOut(clamp(age / Math.max(0.8, L.chars.length * 0.06), 0, 1)), r = L.size * 0.7;
  for (const ch of L.chars) {
    const lit = ch.cx < ex - r * 0.3 ? 1 : 0.22, k = K(ch); g.globalAlpha = lit;
    if (lit > 0.5 && k > 0.5) { g.shadowColor = P.accent; g.shadowBlur = L.size * 0.3; }
    glyph(ch, ch.cx, ch.y, 1, 0, lit > 0.5 ? P.lyr : P.accent2, null, 0); g.shadowBlur = 0;
  }
  g.save(); g.globalCompositeOperation = 'lighter';
  const co = g.createRadialGradient(ex, cy, r, ex, cy, r * 2.2); co.addColorStop(0, P.accent + 'aa'); co.addColorStop(0.3, P.accent + '33'); co.addColorStop(1, P.accent + '00');
  g.fillStyle = co; g.globalAlpha = 0.9 + fx.pulse * 0.3; circle(ex, cy, r * 2.2); g.restore();
  g.fillStyle = '#000'; g.globalAlpha = 1; circle(ex, cy, r); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.globalAlpha = 0.9; g.beginPath(); g.arc(ex, cy, r, 0, TAU); g.stroke(); g.globalAlpha = 1;
};

const nebula: StyleFn = (L, _p, age, P, _idx, K) => {
  for (const ch of L.chars) {
    const a = clamp((age - ch.i * 0.02) / 1.1, 0, 1); if (a <= 0) continue;
    const e = easeOutCubic(a), k = K(ch), drift = RM ? 0 : Math.sin(fx.T * 0.8 + ch.i * 0.3) * L.size * 0.04;
    g.save(); g.translate(ch.cx, ch.y + drift); g.globalCompositeOperation = 'lighter';
    for (let j = 0; j < 3; j++) { g.globalAlpha = (0.12 + 0.1 * k) * e; g.shadowColor = j % 2 ? P.accent : P.accent2; g.shadowBlur = L.size * (0.9 - j * 0.25) * (1.2 - 0.5 * k); g.fillStyle = j % 2 ? P.accent : P.accent2; g.fillText(ch.c, -ch.w / 2, 0); }
    g.globalCompositeOperation = 'source-over'; g.shadowBlur = L.size * 0.2; g.shadowColor = '#fff'; g.globalAlpha = (0.25 + 0.75 * k) * e; g.fillStyle = k > 0.5 ? '#fff' : P.lyr; g.fillText(ch.c, -ch.w / 2, 0); g.restore();
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
};

const telemetry: StyleFn = (L, _p, age, P, idx, K, line, t) => {
  const size = Math.max(14, Math.min(L.size * 0.7, 40)), { x, y, maxW } = LY.lyr; g.font = `400 ${size}px ${MONO}`; g.textAlign = 'left'; g.textBaseline = 'middle';
  const rows = wrapWords(line.text.split(/\s+/), maxW * 0.86).map(r => r.join(' ')), lh = size * 1.5, y0 = y - (rows.length - 1) * lh / 2, shown = Math.floor(age * 30);
  let count = 0, cursor: [number, number] | null = null;
  rows.forEach((row, ri) => {
    const rx = x - maxW * 0.43, ry = y0 + ri * lh; g.fillStyle = P.accent2; g.globalAlpha = 0.6; g.fillText('>', rx - size * 1.2, ry); let cx = rx;
    for (const c of units(row)) {
      if (count > shown) break;
      const cw = g.measureText(c).width, sung = K({ i: count, wi: 0 }) > 0.5 && !line.words;
      g.globalAlpha = 1; g.fillStyle = sung ? P.accent : P.lyr; g.fillText(c, cx, ry); cx += cw; count++; cursor = [cx, ry];
    }
    count++;
  });
  if (cursor && Math.sin(fx.T * 8) > 0) { const [cxx, cyy] = cursor as [number, number]; g.fillStyle = P.accent; g.globalAlpha = 0.9; g.fillRect(cxx + 2, cyy - size * 0.5, size * 0.55, size); }
  const tt = Math.max(0, t), stamp = `T+${String(Math.floor(tt / 60)).padStart(2, '0')}:${(tt % 60).toFixed(1).padStart(4, '0')}`;
  g.font = `400 ${Math.max(10, size * 0.4)}px ${MONO}`; g.fillStyle = P.accent2; g.globalAlpha = 0.55;
  g.fillText(`${stamp}   LINE ${String(idx + 1).padStart(2, '0')}/${String(app.lines.length).padStart(2, '0')}   ${Math.round(60 / fx.beatInterval)} BPM   ${MOON.name.toUpperCase()}`, x - maxW * 0.43, y0 + rows.length * lh);
  g.globalAlpha = 1;
};

const STYLE_FNS: Record<Exclude<StyleId, 'auto'>, StyleFn> = { constellation, orbit, comet, supernova, starmap, eclipse, nebula, telemetry };

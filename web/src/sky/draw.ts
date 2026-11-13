import { g, W, H } from './canvas';
import { audio } from '../audio/engine';
import { app } from '../core/store';
import { fx, cam, mouse, stars, flares, shots, rings, type Particle } from '../core/fx';
import { CONST, CINE, S, type Constellation } from '../core/settings';
import type { Scene, SceneId } from '../core/types';
import { clamp, hash, MOON, MONO, RM, TAU, UIF } from '../core/util';

let mwC: HTMLCanvasElement | null = null, nebC: HTMLCanvasElement | null = null;
export const resetSkyCaches = () => { mwC = null; nebC = null; };
export let hoverConst: Constellation | null = null;

export function circle(x: number, y: number, r: number) { g.beginPath(); g.arc(x, y, Math.max(0.1, r), 0, TAU); g.fill(); }
export function sparkle(x: number, y: number, R: number, rot: number) {
  g.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, rad = i % 2 ? R * 0.28 : R; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  g.closePath();
}
// Parallax offset for a depth layer (0 far, 2 near) from the mouse and the camera drift.
function par(l: number): [number, number] { const k = [0.15, 0.3, 0.5][l]; return [-mouse.x * W * 0.08 * k * 4 - cam.x * k * 2, -mouse.y * H * 0.08 * k * 4 - cam.y * k * 2]; }

function skyGradient(P: Scene) { const s = g.createLinearGradient(0, 0, 0, H); s.addColorStop(0, P.bg[0]); s.addColorStop(0.6, P.bg[1]); s.addColorStop(1, P.bg[2]); g.fillStyle = s; g.fillRect(-W, -H, W * 3, H * 3); }

function drawStarfield(P: Scene, streak: number) {
  const lv = Math.min(1, fx.level / 100), T = fx.T;
  for (let l = 0; l < 3; l++) {
    const [ox, oy] = par(l); g.save(); g.translate(ox, oy);
    for (const s of stars) {
      if (s.l !== l) continue;
      const x = s.x * W, y = s.y * H, tw = 0.55 + 0.45 * Math.sin(T * s.sp + s.p), r = s.r * (1 + lv * 0.5 * (l === 2 ? 1 : 0.3));
      g.fillStyle = s.c < 0.12 ? '#cfe3ff' : s.c > 0.9 ? '#ffe0c0' : P.star; g.globalAlpha = tw * (l === 0 ? 0.5 : l === 1 ? 0.75 : 1);
      if (streak > 0.03 && l > 0) { const dx = x - W / 2, dy = y - H / 2; g.strokeStyle = g.fillStyle; g.lineWidth = r; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + dx * streak * 0.3, y + dy * streak * 0.3); g.stroke(); }
      if (l === 2 && s.r > 2.2) { sparkle(x, y, r * 3 * tw, T * 0.2 + s.p); g.globalAlpha *= 0.6; g.fill(); g.globalAlpha = tw; }
      circle(x, y, r);
    }
    g.restore();
  }
  g.globalAlpha = 1;
}

function milkyWay(P: Scene, alpha: number) {
  if (!CINE()) return;
  if (!mwC) {
    mwC = document.createElement('canvas'); const sw = Math.max(2, W >> 1), sh = Math.max(2, H >> 1); mwC.width = sw; mwC.height = sh;
    const c = mwC.getContext('2d')!; c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const t = i / 90, x = (t * 1.4 - 0.2) * sw, y = (0.65 - t * 0.5 + Math.sin(t * 9) * 0.05) * sh, r = (0.08 + hash(i * 3.3) * 0.12) * Math.max(sw, sh);
      const gr = c.createRadialGradient(x, y, 0, x, y, r), col = hash(i * 5.1) < 0.5 ? P.star : P.accent2;
      gr.addColorStop(0, col + '14'); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 14; i++) {
      const t = i / 14, x = (t * 1.3 - 0.15) * sw, y = (0.65 - t * 0.5 + Math.sin(t * 9 + 1) * 0.04) * sh, r = (0.03 + hash(i * 2.7) * 0.05) * Math.max(sw, sh);
      const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, '#00000055'); gr.addColorStop(1, '#00000000'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
  }
  const [ox, oy] = par(0); g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = alpha * (0.8 + 0.4 * Math.min(1, fx.mid / 90));
  g.translate(W / 2 + ox, H / 2 + oy); g.rotate(Math.sin(fx.T * 0.02) * 0.03); g.drawImage(mwC, -W / 2, -H / 2, W, H); g.restore();
}

function celestialGrid(P: Scene) {
  const [ox, oy] = par(1); g.save(); g.translate(W / 2 + ox, H / 2 + oy); g.rotate(fx.T * 0.004); g.strokeStyle = P.star; g.globalAlpha = 0.06; g.lineWidth = 1;
  const R = Math.max(W, H) * 0.9;
  for (let i = 1; i <= 5; i++) { g.beginPath(); g.ellipse(0, 0, R * i / 5, R * i / 5 * 0.45, 0, 0, TAU); g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI; g.beginPath(); g.moveTo(Math.cos(a) * R, Math.sin(a) * R * 0.45); g.lineTo(-Math.cos(a) * R, -Math.sin(a) * R * 0.45); g.stroke(); }
  g.globalAlpha = 0.1; g.setLineDash([4, 10]); g.beginPath(); g.ellipse(0, 0, R * 0.8, R * 0.8 * 0.45, 0.4, 0, TAU); g.stroke(); g.setLineDash([]);
  g.restore(); g.globalAlpha = 1;
}

function drawConstellations(P: Scene) {
  if (!S.lines) return;
  const [ox, oy] = par(1), sk = Math.max(W, H) * 1.5, rot = fx.T * 0.004, cr = Math.cos(rot), sr = Math.sin(rot);
  hoverConst = null;
  const mx = mouse.in ? (mouse.x + 0.5) * W : -1e9, my = (mouse.y + 0.5) * H;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  for (const c of CONST) {
    const bx = (c.px - 0.5) * sk, by = (c.py - 0.5) * sk, cx = W / 2 + ox + bx * cr - by * sr, cy = H / 2 + oy + bx * sr + by * cr, sc = c.s * Math.min(W, H) * 1.3;
    if (cx < -sc * 1.5 || cx > W + sc * 1.5 || cy < -sc * 1.5 || cy > H + sc * 1.5) continue;
    const pts = c.stars.map(s => { const lx = (s[0] - 0.5) * sc, ly = (s[1] - 0.5) * sc; return [cx + lx * cr - ly * sr, cy + lx * sr + ly * cr]; });
    const hov = Math.hypot(mx - cx, my - cy) < sc * 0.8; if (hov) hoverConst = c;
    const base = hov ? 0.9 : 0.3 + 0.2 * fx.pulse;
    g.strokeStyle = P.star; g.lineWidth = hov ? 1.2 : 0.8; g.globalAlpha = base * 0.7;
    g.beginPath(); for (const [a, b] of c.lines) { g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); } g.stroke();
    c.stars.forEach((s, i) => {
      const [x, y] = pts[i], r = 1 + s[2] * 2.2 + (hov ? 0.8 : 0), tw = 0.75 + 0.25 * Math.sin(fx.T * 2 + i + c.px * 10);
      g.fillStyle = P.star; g.globalAlpha = Math.min(1, base + 0.4) * tw;
      if (s[2] >= 0.9) { sparkle(x, y, r * 2.6, fx.T * 0.3); g.globalAlpha *= 0.5; g.fill(); g.globalAlpha = Math.min(1, base + 0.4) * tw; }
      circle(x, y, r);
      if (s[3] && S.names && (hov || s[2] >= 0.95)) { g.font = `500 10px ${UIF}`; g.globalAlpha = hov ? 0.8 : 0.4; g.fillText(s[3], x + 6, y - 6); }
    });
    if (S.names) { g.font = `500 11px ${MONO}`; g.textAlign = 'center'; g.globalAlpha = hov ? 0.95 : 0.28; g.fillStyle = P.accent; g.fillText(c.name.toUpperCase().split('').join(' '), cx, cy + sc * 0.62); g.textAlign = 'left'; }
  }
  g.restore(); g.globalAlpha = 1;
}

export function drawFlares(dt: number, P: Scene) {
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i]; f.life += dt; if (f.life > f.max) { flares.splice(i, 1); continue; }
    const [ox, oy] = par(f.l), k = f.life / f.max, a = Math.sin(k * Math.PI);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = a * 0.9; g.fillStyle = P.star; sparkle(f.x * W + ox, f.y * H + oy, f.r * (0.4 + k), k * 2); g.fill();
    g.globalAlpha = a * 0.35; circle(f.x * W + ox, f.y * H + oy, f.r * 1.5 * k); g.restore();
  }
}

function shootingStars(P: Scene) {
  const dt = fx.frameDt;
  fx.shotT -= dt;
  if (fx.shotT < 0 && !RM) { fx.shotT = 3 + Math.random() * 6; const a = 0.4 + Math.random() * 0.5; shots.push({ x: Math.random() * W * 0.8, y: Math.random() * H * 0.3, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0 }); }
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life > 0.7) { shots.splice(i, 1); continue; }
    const tx = s.x - s.vx / 900 * 160, ty = s.y - s.vy / 900 * 160, gr = g.createLinearGradient(s.x, s.y, tx, ty); gr.addColorStop(0, P.star); gr.addColorStop(1, P.star + '00');
    g.strokeStyle = gr; g.lineWidth = 1.6; g.lineCap = 'round'; g.globalAlpha = 1 - s.life / 0.7; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(tx, ty); g.stroke(); g.fillStyle = '#fff'; circle(s.x, s.y, 1.8);
  }
  g.globalAlpha = 1;
}

function drawRings(P: Scene) {
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i]; r.r += fx.frameDt * Math.max(W, H) * 0.6; r.a -= fx.frameDt; if (r.a <= 0) { rings.splice(i, 1); continue; }
    g.strokeStyle = P.accent; g.globalAlpha = clamp(r.a, 0, 1) * 0.35; g.lineWidth = 1; g.beginPath(); g.arc(W / 2, H / 2, r.r, 0, TAU); g.stroke();
  }
  g.globalAlpha = 1;
}

function drawViz(P: Scene) {
  const { freq, tdata } = audio, cx = W / 2, cy = H / 2, T = fx.T;
  if (S.viz === 'orbits') {
    g.save(); g.strokeStyle = P.accent2; g.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const bin0 = [2, 10, 30, 80][k], bin1 = [8, 28, 70, 160][k]; let v = 0;
      if (freq) { for (let i = bin0; i < bin1; i++) v += freq[i]; v /= (bin1 - bin0) * 255; }
      const R = Math.min(W, H) * (0.3 + k * 0.11) * (1 + v * 0.12), tilt = 0.5 + k * 0.1;
      g.globalAlpha = 0.08 + v * 0.35; g.beginPath(); g.ellipse(cx, cy, R, R * tilt, T * 0.03 * (k % 2 ? 1 : -1), 0, TAU); g.stroke();
      const a = T * (0.25 + k * 0.08) * (k % 2 ? 1 : -1), rot = T * 0.03 * (k % 2 ? 1 : -1), px = Math.cos(a) * R, py = Math.sin(a) * R * tilt;
      const x = cx + px * Math.cos(rot) - py * Math.sin(rot), y = cy + px * Math.sin(rot) + py * Math.cos(rot);
      g.fillStyle = k % 2 ? P.accent : P.accent2; g.globalAlpha = 0.5 + v * 0.5; circle(x, y, 1.6 + v * 3);
    }
    g.restore();
  } else if (S.viz === 'horizon') {
    const N = 64, bw = W / N; g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < N; i++) {
      const bin = Math.floor(1 + Math.pow(i / N, 1.5) * 160), v = freq ? freq[bin] / 255 : 0, h = v * H * 0.28;
      const gr = g.createLinearGradient(0, H - h, 0, H); gr.addColorStop(0, P.accent + '00'); gr.addColorStop(1, P.accent + '66'); g.fillStyle = gr; g.fillRect(i * bw, H - h, bw + 1, h);
    }
    g.restore();
  } else if (S.viz === 'wave' && tdata) {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineWidth = 1.2; g.strokeStyle = P.accent2; g.globalAlpha = 0.55; g.beginPath();
    for (let i = 0; i < 256; i++) { const x = i / 255 * W, y = H * 0.82 + ((app.playing ? tdata[i * 4] : 128) - 128) / 128 * H * 0.08; if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke(); g.restore();
  }
}

function drawMoon(P: Scene, x: number, y: number, r: number) {
  const gl = g.createRadialGradient(x, y, r * 0.9, x, y, r * 2.6); gl.addColorStop(0, P.accent + '33'); gl.addColorStop(1, P.accent + '00'); g.fillStyle = gl; circle(x, y, r * 2.6);
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
  const dark = '#0b0b14', light = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); light.addColorStop(0, '#fbfbf4'); light.addColorStop(1, '#c9cad8');
  g.fillStyle = dark; g.fillRect(x - r, y - r, r * 2, r * 2);
  const p = MOON.p, waxing = p < 0.5, k = Math.cos(p * TAU);
  g.fillStyle = light; g.fillRect(waxing ? x : x - r, y - r, r, r * 2);
  g.beginPath(); g.ellipse(x, y, Math.abs(k) * r, r, 0, 0, TAU); g.fillStyle = (waxing ? p < 0.25 : p > 0.75) ? dark : light; g.fill();
  g.globalAlpha = 0.18; g.fillStyle = '#6a6c80';
  for (const [cx, cy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.12], [0.05, 0.45, 0.2], [-0.45, 0.35, 0.09], [0.4, -0.4, 0.08]]) circle(x + cx * r, y + cy * r, cr * r);
  g.restore(); g.globalAlpha = 1;
}

function drawNebula(P: Scene) {
  if (!CINE()) return;
  if (!nebC) {
    nebC = document.createElement('canvas'); const sw = Math.max(2, W >> 1), sh = Math.max(2, H >> 1); nebC.width = sw; nebC.height = sh;
    const c = nebC.getContext('2d')!; c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70; i++) {
      const x = (0.2 + hash(i * 3.3) * 0.7) * sw, y = (0.15 + hash(i * 7.1) * 0.7) * sh, r = (0.08 + hash(i * 2.2) * 0.2) * Math.max(sw, sh), col = [P.accent, P.accent2, '#ffffff'][i % 3];
      const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col + (i % 3 === 2 ? '03' : '09')); gr.addColorStop(1, col + '00'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
  }
  const [ox, oy] = par(0); g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.6 + 0.3 * Math.min(1, fx.level / 100);
  g.translate(W / 2 + ox, H / 2 + oy); g.scale(1.1 + fx.pulse * 0.02, 1.1 + fx.pulse * 0.02); g.rotate(fx.T * 0.01); g.drawImage(nebC, -W / 2, -H / 2, W, H); g.restore();
}

function drawAurora(P: Scene) {
  g.save(); g.globalCompositeOperation = 'lighter'; const N = 110, lv = Math.min(1, fx.level / 90), sw = W / N * 2.2, T = fx.T;
  for (const [col, off, sp, base] of [[P.accent, 0, 1, 0.74], [P.accent2, 1.7, 0.7, 0.66]] as [string, number, number, number][]) {
    for (let i = 0; i <= N; i++) {
      const u = i / N, x = u * W;
      const h = H * (0.18 + 0.16 * Math.sin(u * 7 + T * 0.45 * sp + off) + 0.07 * Math.sin(u * 19 - T * 0.8 * sp + off * 2) + 0.04 * Math.sin(u * 41 + T * 1.3) + lv * 0.1);
      const by = H * base + Math.sin(u * 5 + T * 0.3 + off) * H * 0.03, gr = g.createLinearGradient(0, by - h, 0, by);
      gr.addColorStop(0, col + '00'); gr.addColorStop(0.55, col + '14'); gr.addColorStop(0.9, col + '30'); gr.addColorStop(1, col + '00');
      g.fillStyle = gr; g.globalAlpha = (0.55 + fx.pulse * 0.3) * (0.7 + 0.3 * Math.sin(u * 23 + T * 2)); g.fillRect(x - sw / 2, by - h, sw, h);
    }
  }
  g.restore(); g.globalAlpha = 1;
}

function drawPlanet(P: Scene, x: number, y: number, r: number) {
  g.save(); g.translate(x, y); g.rotate(-0.35); g.strokeStyle = P.accent2; g.globalAlpha = 0.6; g.lineWidth = r * 0.16; g.beginPath(); g.ellipse(0, 0, r * 1.9, r * 0.5, 0, Math.PI, TAU); g.stroke(); g.restore();
  const pg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); pg.addColorStop(0, '#e8dcff'); pg.addColorStop(0.5, P.accent); pg.addColorStop(1, '#120a2c'); g.globalAlpha = 1; g.fillStyle = pg; circle(x, y, r);
  g.save(); g.translate(x, y); g.rotate(-0.35); g.strokeStyle = P.accent2; g.globalAlpha = 0.85; g.lineWidth = r * 0.16; g.beginPath(); g.ellipse(0, 0, r * 1.9, r * 0.5, 0, 0, Math.PI); g.stroke(); g.restore(); g.globalAlpha = 1;
}

export const SCENE_DRAW: Record<SceneId, (P: Scene) => void> = {
  observatory(P) { skyGradient(P); milkyWay(P, 0.5); celestialGrid(P); drawStarfield(P, 0); drawConstellations(P); shootingStars(P); drawViz(P); drawRings(P); },
  nebula(P) { skyGradient(P); drawNebula(P); milkyWay(P, 0.3); drawStarfield(P, 0); drawConstellations(P); drawPlanet(P, W * 0.82, H * 0.22, Math.min(W, H) * 0.06); shootingStars(P); drawViz(P); drawRings(P); },
  aurora(P) {
    skyGradient(P); milkyWay(P, 0.25); drawStarfield(P, 0); drawAurora(P); drawConstellations(P); shootingStars(P); drawViz(P); drawRings(P);
    g.fillStyle = '#01040a'; g.beginPath(); g.moveTo(-10, H);
    for (let i = 0; i <= 30; i++) g.lineTo(i / 30 * W, H * (0.9 + 0.04 * Math.sin(i * 1.3) + 0.03 * Math.sin(i * 0.4 + 2)));
    g.lineTo(W + 10, H); g.closePath(); g.fill();
  },
  lunar(P) { skyGradient(P); milkyWay(P, 0.2); drawStarfield(P, 0); drawConstellations(P); drawMoon(P, W * 0.78, H * 0.26, Math.min(W, H) * 0.13); shootingStars(P); drawViz(P); drawRings(P); },
  warp(P) {
    skyGradient(P);
    const vg = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.5); vg.addColorStop(0, P.accent + '2a'); vg.addColorStop(1, P.accent + '00'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (!RM) for (const s of stars) {
      const dx = s.x - 0.5, dy = s.y - 0.5, sp = (0.02 + 0.12 * Math.min(1, fx.level / 90) + fx.drop * 0.6) * fx.frameDt * (1 + s.l);
      s.x += dx * sp; s.y += dy * sp;
      if (Math.abs(dx) > 0.52 || Math.abs(dy) > 0.52) { s.x = 0.5 + (Math.random() - 0.5) * 0.3; s.y = 0.5 + (Math.random() - 0.5) * 0.3; }
    }
    drawStarfield(P, 0.25 + Math.min(1, fx.level / 90) * 0.8 + fx.drop * 2); drawConstellations(P); drawViz(P); drawRings(P);
  },
};

export function drawParts(list: Particle[], dt: number) {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]; p.life += dt; if (p.life > p.max) { list.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; p.vy *= 0.985;
    g.globalAlpha = Math.min(1, (p.max - p.life) / 0.5); g.fillStyle = p.col; circle(p.x, p.y, p.s * (1 - p.life / p.max * 0.5));
  }
  g.globalAlpha = 1;
}

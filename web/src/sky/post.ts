import { canvas, g, W, H, DPR } from './canvas';
import { app } from '../core/store';
import { fx } from '../core/fx';
import { CINE, S, SCENES, PAL } from '../core/settings';
import type { Scene } from '../core/types';
import { clamp, DISPLAY, easeOutCubic, MOON, MONO, RM } from '../core/util';

// Cinematic finish: bloom from a blurred, darkened copy, a vignette and moving film grain.
let bA: HTMLCanvasElement | null = null, bB: HTMLCanvasElement | null = null, grainC: HTMLCanvasElement | null = null;
export function post(P: Scene) {
  if (!CINE()) return;
  const hasFilter = 'filter' in g;
  const sw = Math.max(2, W >> 2), sh = Math.max(2, H >> 2);
  if (!bA || !bB) { bA = document.createElement('canvas'); bB = document.createElement('canvas'); }
  if (bA.width !== sw || bA.height !== sh) { bA.width = sw; bA.height = sh; bB.width = Math.max(1, sw >> 2); bB.height = Math.max(1, sh >> 2); }
  const a = bA.getContext('2d')!, b = bB.getContext('2d')!;
  a.globalCompositeOperation = 'source-over'; a.globalAlpha = 1; if (hasFilter) a.filter = 'none'; a.clearRect(0, 0, sw, sh); a.drawImage(canvas, 0, 0, sw, sh);
  a.globalCompositeOperation = 'multiply'; a.drawImage(bA, 0, 0); a.globalCompositeOperation = 'source-over';
  b.clearRect(0, 0, bB.width, bB.height); b.drawImage(bA, 0, 0, bB.width, bB.height);
  if (hasFilter) a.filter = 'blur(2px)'; a.drawImage(bB, 0, 0, sw, sh); if (hasFilter) a.filter = 'none';
  g.save(); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + fx.pulse * 0.2 + fx.drop * 0.3; g.drawImage(bA, 0, 0, W, H);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
  if (!grainC) {
    grainC = document.createElement('canvas'); grainC.width = grainC.height = 160;
    const c = grainC.getContext('2d')!, im = c.createImageData(160, 160);
    for (let i = 0; i < im.data.length; i += 4) { const v = 100 + Math.random() * 90; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    c.putImageData(im, 0, 0);
  }
  if (!RM) { g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.07; const ox = Math.floor(Math.random() * 160), oy = Math.floor(Math.random() * 160); g.translate(-ox, -oy); g.fillStyle = g.createPattern(grainC, 'repeat')!; g.fillRect(0, 0, W + 160, H + 160); }
  g.restore();
  void P;
}

// Title card when a song starts from the top.
let intro = -1;
export function startIntro() { if (S.intro && !RM) intro = 0; }
export function drawIntro(dt: number) {
  if (intro < 0) return; intro += dt; const d = 3; if (intro > d) { intro = -1; return; }
  const tr = app.tracks[app.cur]; if (!tr) return;
  const P = PAL(), inA = easeOutCubic(clamp(intro / 0.5, 0, 1)), outA = clamp((d - intro) / 0.5, 0, 1), k = inA * outA;
  g.fillStyle = 'rgba(0,0,0,' + (0.6 * k) + ')'; g.fillRect(0, 0, W, H);
  const size = Math.min(64, W * 0.08), x = W / 2, y = H * 0.5; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${size}px ${DISPLAY}`; g.globalAlpha = k; g.shadowColor = P.accent; g.shadowBlur = 30; g.fillStyle = '#fff'; g.fillText(tr.name, x, y - size * 0.3, W * 0.9); g.shadowBlur = 0;
  g.font = `400 ${Math.max(12, size * 0.24)}px ${MONO}`; g.fillStyle = P.accent2;
  g.fillText(((tr.artist || '') + '   ·   ' + SCENES[S.scene].label + '   ·   ' + MOON.name).toUpperCase().split('').join(' '), x, y + size * 0.7, W * 0.9);
  g.strokeStyle = P.accent; g.lineWidth = 1; g.globalAlpha = k * 0.8; g.beginPath(); g.moveTo(x - W * 0.2 * inA, y + size * 1.2); g.lineTo(x + W * 0.2 * inA, y + size * 1.2); g.stroke(); g.globalAlpha = 1; g.textAlign = 'left';
}

import { app } from '../core/store';
import { fx, rings, flares, parts, stars, cam, mouse } from '../core/fx';
import { PAL, S } from '../core/settings';
import { RM, TAU } from '../core/util';
import { audio, now } from './engine';
import { W, H } from '../sky/canvas';

// Beat and drop detection from the playing audio: bass onsets for beats, a jump in loudness for drops.
export function analyse(dt: number) {
  const { analyser, freq, tdata } = audio;
  if (analyser && freq && tdata && app.playing) {
    analyser.getByteFrequencyData(freq); analyser.getByteTimeDomainData(tdata);
    let b = 0, m = 0, l = 0;
    for (let i = 1; i <= 6; i++) b += freq[i];
    for (let i = 8; i <= 70; i++) m += freq[i];
    for (let i = 0; i < 256; i++) l += freq[i];
    fx.bass = b / 6; fx.mid = m / 63; fx.level = l / 256;
  } else {
    fx.bass *= 0.9; fx.mid *= 0.9; fx.level *= 0.92;
    if (freq) for (let i = 0; i < freq.length; i++) freq[i] *= 0.9;
  }
  fx.bassAvg += (fx.bass - fx.bassAvg) * (1 - Math.exp(-dt * 1.5));
  fx.midAvg += (fx.mid - fx.midAvg) * (1 - Math.exp(-dt * 0.8));
  fx.lvFast += (fx.level - fx.lvFast) * (1 - Math.exp(-dt * 6));
  fx.lvSlow += (fx.level - fx.lvSlow) * (1 - Math.exp(-dt * 0.4));
  fx.pulse *= Math.exp(-dt * 6); fx.drop *= Math.exp(-dt * 1.4);
  if (!app.playing) return;
  const t = now();
  if (fx.bass > fx.bassAvg * 1.15 + 6 && fx.bass > 70 && t - fx.lastBeatT > 0.27) onBeat(t, 1, true);
  else if (fx.lastBeatT >= 0 && t - fx.lastBeatT > fx.beatInterval * 1.08 && fx.level > 25) onBeat(t - fx.lastBeatT > fx.beatInterval * 2.5 ? t : fx.lastBeatT + fx.beatInterval, 0.55, false);
  if (fx.T - audio.trackStartT > 3 && fx.lvFast > fx.lvSlow * 1.3 && fx.lvFast > 55 && fx.T - fx.lastDrop > 7) onDrop();
}

export function onBeat(t: number, strength: number, real: boolean) {
  if (real && fx.lastBeatT >= 0) {
    const iv = t - fx.lastBeatT;
    if (iv > 0.27 && iv < 1.2) { fx.intervals.push(iv); if (fx.intervals.length > 8) fx.intervals.shift(); const s = [...fx.intervals].sort((a, b) => a - b); fx.beatInterval = s[s.length >> 1]; }
  }
  fx.lastBeatT = t; fx.beatCount++; fx.pulse = Math.max(fx.pulse, strength);
  if (RM) return;
  const n = (S.parts === 'high' ? 2 : 1) + Math.round(strength * (S.parts === 'high' ? 3 : 1));
  for (let i = 0; i < n; i++) { const s = stars[Math.floor(Math.random() * stars.length)]; flares.push({ x: s.x, y: s.y, l: s.l, life: 0, max: 0.6 + Math.random() * 0.5, r: 6 + Math.random() * 10 * strength }); }
  if (strength > 0.9 && fx.beatCount % 4 === 0) rings.push({ r: 0, a: 1 });
}

function onDrop() {
  fx.lastDrop = fx.T; fx.drop = 1; cam.shake = RM ? 0 : 1;
  if (!RM) { rings.push({ r: 0, a: 1.2 }); for (let i = 0; i < 24; i++) spawnDust(); }
}
function spawnDust() {
  if (parts.length > 200) return;
  const P = PAL(), a = Math.random() * TAU, r = Math.min(W, H) * 0.1;
  parts.push({ x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, vx: Math.cos(a) * (200 + Math.random() * 300), vy: Math.sin(a) * (200 + Math.random() * 300), life: 0, max: 1.5, s: 1 + Math.random() * 2.5, col: Math.random() < 0.5 ? P.accent : P.accent2 });
}

export function updateCam(dt: number) {
  const on = S.cam && !RM, zt = on ? 1 + fx.pulse * 0.018 + fx.drop * 0.07 : 1;
  cam.z += (zt - cam.z) * (1 - Math.exp(-dt * 8)); cam.shake *= Math.exp(-dt * 5);
  mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3)); mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3));
  const sh = cam.shake * Math.min(W, H) * 0.012;
  cam.x = on ? Math.sin(fx.T * 0.3) * W * 0.006 + (Math.random() - 0.5) * sh : 0;
  cam.y = on ? Math.cos(fx.T * 0.23) * H * 0.005 + (Math.random() - 0.5) * sh : 0;
  cam.rot = on ? Math.sin(fx.T * 0.17) * 0.003 : 0;
}

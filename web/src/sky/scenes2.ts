import { g, W, H } from './canvas';
import { circle, drawRings, drawViz, shootingStars, skyGradient, sparkle } from './draw';
import { fx, mouse, stars } from '../core/fx';
import { CONST, S } from '../core/settings';
import type { Scene } from '../core/types';
import { hash, MONO, RM, TAU } from '../core/util';

// ---------- Black hole: event horizon, accretion disk, photon ring, gravitational lensing ----------
export function drawBlackHole(P: Scene) {
  skyGradient(P);
  const cx = W * 0.5 - mouse.x * W * 0.02, cy = H * 0.5 - mouse.y * H * 0.02, R = Math.min(W, H) * 0.12 * (1 + fx.pulse * 0.03);
  // Background stars, pushed outward near the hole as gravity bends their light; nothing shows through the horizon.
  for (const s of stars) {
    let x = s.x * W, y = s.y * H; const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
    if (d < R * 1.05) continue;
    const pushed = d + (R * R * 2.4) / d; x = cx + dx / d * pushed; y = cy + dy / d * pushed;
    const tw = 0.55 + 0.45 * Math.sin(fx.T * s.sp + s.p);
    g.globalAlpha = tw * (s.l === 0 ? 0.5 : s.l === 1 ? 0.75 : 1); g.fillStyle = P.star; circle(x, y, s.r * (d < R * 3 ? 1.4 : 1));
  }
  g.globalAlpha = 1;
  shootingStars(P);

  const tilt = 0.28, rx = R * 3.4, inner = R * 1.35, energy = 0.7 + 0.5 * fx.pulse + Math.min(1, fx.level / 255) * 0.6;
  const disk = (front: boolean) => {
    g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
    // A soft continuous band...
    for (let j = 0; j < 7; j++) {
      const r = inner + (rx - inner) * j / 6; g.globalAlpha = 0.07 * (1 - j / 8) * energy; g.lineWidth = (rx - inner) / 5; g.strokeStyle = j < 2 ? '#fff1d6' : P.accent;
      g.beginPath(); g.ellipse(cx, cy, r, r * tilt, 0, front ? 0 : Math.PI, front ? Math.PI : TAU); g.stroke();
    }
    // ...and streaks of hot gas orbiting faster near the hole. The side moving toward us is brighter.
    for (let k = 0; k < 240; k++) {
      const rr = inner + (rx - inner) * Math.pow(hash(k * 1.37), 1.3), speed = 2.4 / Math.pow(rr / R, 1.5), a = hash(k * 7.9) * TAU + (RM ? 0 : fx.T * speed), sa = Math.sin(a);
      if (front ? sa < 0 : sa >= 0) continue;
      const heat = 1 - (rr - inner) / (rx - inner), toward = 0.5 - 0.5 * Math.cos(a);
      g.globalAlpha = (0.2 + 0.8 * toward) * (0.35 + 0.65 * heat) * energy * 0.8;
      g.strokeStyle = heat > 0.65 ? '#fff4dc' : heat > 0.3 ? P.accent : P.accent2; g.lineWidth = 0.8 + heat * 2.4;
      g.beginPath(); g.ellipse(cx, cy, rr, rr * tilt, 0, a - 0.16, a); g.stroke();
    }
    g.restore(); g.globalAlpha = 1;
  };
  disk(false);
  // The far side of the disk, bent up and over the hole by gravity.
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let j = 0; j < 5; j++) {
    g.globalAlpha = (0.16 - j * 0.025) * energy; g.strokeStyle = j === 0 ? '#fff4dc' : P.accent; g.lineWidth = R * (0.06 + j * 0.07);
    g.beginPath(); g.ellipse(cx, cy, R * (1.55 + j * 0.06), R * (1.32 + j * 0.05), 0, Math.PI * 1.02, Math.PI * 1.98); g.stroke();
  }
  g.restore();
  // Event horizon and photon ring.
  g.globalAlpha = 1; g.fillStyle = '#000'; circle(cx, cy, R);
  g.save(); g.shadowColor = '#ffe2b0'; g.shadowBlur = R * 0.5; g.strokeStyle = '#fff6e6'; g.globalAlpha = 0.85; g.lineWidth = Math.max(1.2, R * 0.035);
  g.beginPath(); g.arc(cx, cy, R * 1.04, 0, TAU); g.stroke(); g.restore();
  disk(true);
  drawViz(P); drawRings(P);
}

// ---------- Planetarium dome: the sky turns overhead, a star projector and seats below ----------
export function drawDome(P: Scene) {
  skyGradient(P);
  const zx = W / 2 - mouse.x * W * 0.03, zy = H * 0.14 - mouse.y * H * 0.02, rot = RM ? 0 : fx.T * 0.025;
  // alt 0 is the zenith, 1 the dome's edge.
  const proj = (az: number, alt: number): [number, number] => [zx + Math.cos(az) * alt * W * 0.62, zy + alt * H * 0.5 + Math.sin(az) * alt * H * 0.42];
  // Coordinate grid painted on the dome.
  g.save(); g.strokeStyle = P.accent2; g.lineWidth = 1;
  for (let i = 1; i <= 5; i++) {
    const alt = i / 5; g.globalAlpha = i === 5 ? 0.16 : 0.07; g.setLineDash(i === 5 ? [] : [3, 9]);
    g.beginPath(); g.ellipse(zx, zy + alt * H * 0.5, alt * W * 0.62, alt * H * 0.42, 0, 0, TAU); g.stroke();
  }
  g.setLineDash([]); g.globalAlpha = 0.06;
  for (let m = 0; m < 12; m++) { const az = m / 12 * TAU + rot; g.beginPath(); for (let k = 0; k <= 20; k++) { const [x, y] = proj(az, k / 20); if (k) g.lineTo(x, y); else g.moveTo(x, y); } g.stroke(); }
  g.restore();
  // The projected stars.
  const lv = Math.min(1, fx.level / 100);
  for (const s of stars) {
    const alt = Math.sqrt(s.y), [x, y] = proj(s.x * TAU + rot, alt), tw = 0.55 + 0.45 * Math.sin(fx.T * s.sp + s.p);
    g.globalAlpha = tw * (s.l === 0 ? 0.55 : s.l === 1 ? 0.8 : 1); g.fillStyle = s.c < 0.12 ? '#cfe3ff' : s.c > 0.9 ? '#ffe0c0' : P.star;
    const r = s.r * (0.6 + 0.5 * alt) * (1 + lv * 0.3);
    if (s.l === 2 && s.r > 2.2) { sparkle(x, y, r * 3 * tw, fx.T * 0.2 + s.p); g.globalAlpha *= 0.6; g.fill(); g.globalAlpha = tw; }
    circle(x, y, r);
  }
  // Constellation figures turning with the sky.
  if (S.lines) {
    g.save(); g.lineCap = 'round';
    for (const c of CONST) {
      const caz = c.px * TAU + rot, calt = 0.22 + c.py * 0.6;
      const pts = c.stars.map(st => proj(caz + (st[0] - 0.5) * c.s * 2.2, Math.max(0.02, calt + (st[1] - 0.5) * c.s * 1.4)));
      g.strokeStyle = P.star; g.globalAlpha = 0.28 + 0.2 * fx.pulse; g.lineWidth = 0.8;
      g.beginPath(); for (const [a, b] of c.lines) { g.moveTo(pts[a][0], pts[a][1]); g.lineTo(pts[b][0], pts[b][1]); } g.stroke();
      g.fillStyle = P.star; g.globalAlpha = 0.85; for (const [x, y] of pts) circle(x, y, 1.6);
      if (S.names) { const [lx, ly] = proj(caz, calt + c.s * 0.9); g.font = `500 10px ${MONO}`; g.textAlign = 'center'; g.fillStyle = P.accent; g.globalAlpha = 0.35; g.fillText(c.name.toUpperCase(), lx, ly); g.textAlign = 'left'; }
    }
    g.restore();
  }
  g.globalAlpha = 1;
  shootingStars(P); drawViz(P); drawRings(P);
  // Light from the projector, pulsing with the music.
  const px = W / 2, py = H * 0.82, pr = Math.min(W, H) * 0.035;
  g.save(); g.globalCompositeOperation = 'lighter';
  const beam = g.createLinearGradient(px, py, px, zy); beam.addColorStop(0, P.accent + '40'); beam.addColorStop(1, P.accent + '00');
  g.fillStyle = beam; g.globalAlpha = 0.5 + fx.pulse * 0.5;
  g.beginPath(); g.moveTo(px - pr * 0.6, py - pr); g.lineTo(px - W * 0.35, zy); g.lineTo(px + W * 0.35, zy); g.lineTo(px + pr * 0.6, py - pr); g.closePath(); g.fill();
  g.restore();
  // Floor, a row of seats and the projector in silhouette.
  const floorY = H * 0.88, sil = '#020208';
  g.fillStyle = sil; g.beginPath(); g.moveTo(-10, H + 10); g.lineTo(-10, floorY + H * 0.03); g.quadraticCurveTo(W / 2, floorY - H * 0.02, W + 10, floorY + H * 0.03); g.lineTo(W + 10, H + 10); g.closePath(); g.fill();
  const seatW = Math.max(28, W / 26);
  for (let x = seatW * 0.2; x < W; x += seatW * 1.15) {
    if (Math.abs(x + seatW / 2 - px) < pr * 2.6) continue;
    const top = floorY - H * 0.035 + Math.abs(x - W / 2) / W * H * 0.02;
    g.beginPath(); g.moveTo(x, floorY + 6); g.lineTo(x, top + 8); g.quadraticCurveTo(x, top, x + 8, top); g.lineTo(x + seatW - 8, top); g.quadraticCurveTo(x + seatW, top, x + seatW, top + 8); g.lineTo(x + seatW, floorY + 6); g.closePath(); g.fill();
  }
  g.fillRect(px - pr * 0.18, py, pr * 0.36, floorY - py + 4);
  for (const ox of [-1, 1]) { circle(px + ox * pr * 1.05, py - pr * 0.55, pr); }
  g.globalAlpha = 0.35 + fx.pulse * 0.5; g.fillStyle = P.accent; for (const ox of [-1, 1]) circle(px + ox * pr * 1.05, py - pr * 0.55, pr * 0.18); g.globalAlpha = 1;
}

// ---------- Galaxy flythrough: rushing through the arms of a spiral galaxy ----------
const GN = 1700;
let gal: Float32Array | null = null, sprite: HTMLCanvasElement | null = null, camZ = 0;
const COLS = ['#fff2d0', '#9fc8ff', '#ffb0d8'];
function initGalaxy() {
  gal = new Float32Array(GN * 5);
  for (let i = 0; i < GN; i++) {
    const arm = i % 3, r = Math.pow(hash(i * 1.31), 0.55), ang = arm * TAU / 3 + r * 4.2 + (hash(i * 2.7) - 0.5) * 0.55 * (1 - r * 0.5);
    gal[i * 5] = Math.cos(ang) * r * 900; gal[i * 5 + 1] = (hash(i * 5.9) - 0.5) * 70 * (1 - r * 0.7); gal[i * 5 + 2] = Math.sin(ang) * r * 1800;
    gal[i * 5 + 3] = r < 0.18 ? 0 : hash(i * 3.3) < 0.6 ? 1 : 2; gal[i * 5 + 4] = 0.6 + hash(i * 8.8) * 1.6;
  }
  // The whole galaxy seen from afar, drawn once and shown at the vanishing point.
  sprite = document.createElement('canvas'); sprite.width = sprite.height = 512;
  const c = sprite.getContext('2d')!; c.globalCompositeOperation = 'lighter';
  const core = c.createRadialGradient(256, 256, 0, 256, 256, 90); core.addColorStop(0, '#fff6e0cc'); core.addColorStop(1, '#fff6e000'); c.fillStyle = core; c.beginPath(); c.arc(256, 256, 90, 0, TAU); c.fill();
  for (let i = 0; i < 2600; i++) {
    const arm = i % 3, r = Math.pow(hash(i * 4.1), 0.6), ang = arm * TAU / 3 + r * 4.2 + (hash(i * 6.3) - 0.5) * 0.6;
    const x = 256 + Math.cos(ang) * r * 240, y = 256 + Math.sin(ang) * r * 240 * 0.42;
    c.fillStyle = COLS[r < 0.2 ? 0 : i % 2 ? 1 : 2]; c.globalAlpha = 0.25 + 0.5 * (1 - r); c.beginPath(); c.arc(x, y, 0.6 + hash(i) * 1.2, 0, TAU); c.fill();
  }
}
export function drawGalaxy(P: Scene) {
  if (!gal) initGalaxy();
  skyGradient(P);
  const vx = W / 2 - mouse.x * W * 0.08, vy = H * 0.5 - mouse.y * H * 0.06, f = W * 0.7, depth = 1800;
  // Distant galaxy core at the vanishing point.
  const gs = Math.min(W, H) * (0.75 + fx.pulse * 0.04);
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 + Math.min(1, fx.level / 120) * 0.3; g.translate(vx, vy); g.rotate(RM ? 0 : fx.T * 0.01); g.drawImage(sprite!, -gs / 2, -gs / 2, gs, gs); g.restore();
  // Fly forward, faster when the music is loud and on drops.
  const speed = RM ? 0 : 70 + fx.level * 3 + fx.pulse * 60 + fx.drop * 900;
  camZ += speed * fx.frameDt;
  const camX = mouse.x * 200, camY = 30 + mouse.y * 80, streak = Math.min(0.5, speed / 1400);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let i = 0; i < GN; i++) {
    const zr = (((gal![i * 5 + 2] - camZ) % depth) + depth) % depth + 8;
    const sx = vx + (gal![i * 5] - camX) / zr * f, sy = vy + (gal![i * 5 + 1] - camY) / zr * f;
    if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue;
    const size = Math.min(4.5, gal![i * 5 + 4] * f / zr * 0.45), a = Math.min(1, (depth - zr) / 400) * Math.min(1, zr / 60);
    g.globalAlpha = a; g.fillStyle = g.strokeStyle = COLS[gal![i * 5 + 3]];
    if (streak > 0.06 && zr < 600) {
      const z2 = zr + speed * 0.06, x2 = vx + (gal![i * 5] - camX) / z2 * f, y2 = vy + (gal![i * 5 + 1] - camY) / z2 * f;
      g.lineWidth = size; g.beginPath(); g.moveTo(sx, sy); g.lineTo(x2, y2); g.stroke();
    } else circle(sx, sy, size);
  }
  g.restore(); g.globalAlpha = 1;
  shootingStars(P); drawViz(P); drawRings(P);
}

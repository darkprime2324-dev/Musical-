import { hash, TAU } from './util';

// Animation state shared by the audio analysis, the sky renderer and the lyrics view.
export const fx = {
  bass: 0, bassAvg: 0, mid: 0, midAvg: 0, level: 0, lvFast: 0, lvSlow: 0,
  pulse: 0, drop: 0, lastDrop: -99,
  lastBeatT: -1, intervals: [] as number[], beatInterval: 0.5, beatCount: 0,
  T: 0, frameDt: 0.016, shotT: 2,
};

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; s: number; col: string }
export const parts: Particle[] = [];
export const fxParts: Particle[] = [];
export const rings: { r: number; a: number }[] = [];
export const flares: { x: number; y: number; l: number; life: number; max: number; r: number }[] = [];
export const shots: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
export const cam = { z: 1, x: 0, y: 0, rot: 0, shake: 0 };
export const mouse = { x: 0, y: 0, tx: 0, ty: 0, in: false };

export interface Star { x: number; y: number; l: number; r: number; p: number; sp: number; c: number }
export const stars: Star[] = [];
for (let i = 0; i < 420; i++) {
  const l = i < 240 ? 0 : i < 360 ? 1 : 2;
  stars.push({ x: hash(i * 1.7), y: hash(i * 5.3), l, r: l === 0 ? 0.4 + hash(i * 9.1) * 0.7 : l === 1 ? 0.8 + hash(i * 9.1) * 0.9 : 1.3 + hash(i * 9.1) * 1.4, p: hash(i * 2.9) * TAU, sp: 0.6 + hash(i * 4.4) * 2, c: hash(i * 7.7) });
}

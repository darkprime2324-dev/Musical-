import { mouse } from '../core/fx';
import { resetSkyCaches } from './draw';
import { layoutCache } from './lyrics';

// The sky canvas and its size. Exported bindings are live: other modules always see current values.
export let canvas: HTMLCanvasElement = null!;
export let g: CanvasRenderingContext2D = null!;
export let W = 0, H = 0, DPR = 1;
export let LY = { wide: false, lyr: { x: 0, y: 0, maxW: 0, maxH: 0 }, R: 0 };
export let fontGen = 0;
export const bumpFonts = () => { fontGen++; layoutCache.clear(); };

function computeLayout() {
  const wide = W > H;
  LY = { wide, lyr: { x: W / 2, y: H * (wide ? 0.47 : 0.45), maxW: wide ? W * 0.74 : W - 36, maxH: H * 0.56 }, R: Math.min(W, H) * 0.18 };
  layoutCache.clear(); resetSkyCaches();
}
function resize() {
  const r = canvas.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1); W = Math.max(1, r.width); H = Math.max(1, r.height);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  computeLayout();
}

export function attachCanvas(el: HTMLCanvasElement): () => void {
  canvas = el; g = el.getContext('2d')!;
  const ro = new ResizeObserver(resize); ro.observe(el); resize();
  const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / W - 0.5; mouse.ty = (e.clientY - r.top) / H - 0.5; mouse.in = true; };
  const leave = () => { mouse.in = false; mouse.tx = 0; mouse.ty = 0; };
  el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
  return () => { ro.disconnect(); el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
}

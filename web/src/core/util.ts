export const TAU = Math.PI * 2;
export const RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const DISPLAY = '"Space Grotesk","Noto Sans Telugu","Inter",system-ui,sans-serif';
export const UIF = '"Inter","Noto Sans Telugu",system-ui,sans-serif';
export const MONO = '"Space Mono","Noto Sans Telugu",ui-monospace,Menlo,monospace';

// Scripts that shape letters together (Telugu, Devanagari, Tamil, Arabic...) are animated word by word,
// so conjuncts never break apart.
const COMPLEX = /[֐-ۿऀ-෿฀-໿က-႟ក-៿]/;
const SEG = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
export function units(s: string): string[] {
  if (COMPLEX.test(s)) return s.split(/(\s+)/).filter(Boolean).flatMap(p => /^\s+$/.test(p) ? [...p] : [p]);
  return SEG ? [...SEG.segment(s)].map(x => x.segment) : Array.from(s);
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const hash = (n: number) => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
export const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
export const easeInOut = (x: number) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

export const fmt = (s: number) => { s = Math.max(0, s || 0); return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };

export const lsGet = (k: string): string => { try { return localStorage.getItem(k) || ''; } catch { return ''; } };
export const lsSet = (k: string, v: string | null | undefined) => {
  try { if (v == null || v === '') localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* storage unavailable */ }
};

export const DOT = '·';

// Moon phase from the mean synodic month (reference new moon: 2000-01-06 18:14 UTC).
export const MOON = (() => {
  const days = (Date.now() / 86400000 - 10957.76) % 29.530588853;
  const p = (days < 0 ? days + 29.530588853 : days) / 29.530588853, lit = (1 - Math.cos(p * TAU)) / 2;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return { p, lit, name: names[Math.round(p * 8) % 8] };
})();

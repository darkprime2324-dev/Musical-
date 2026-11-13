import type { DemoSpec } from '../core/types';

// Original demo tracks, synthesized in the browser (pads, bass, drums and a lead over a four-chord loop).
export async function renderDemo(sp: DemoSpec): Promise<AudioBuffer> {
  const sr = 44100, beat = 60 / sp.bpm, bar = beat * 4, bars = sp.bars;
  const Off = window.OfflineAudioContext || (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const oc = new Off(1, Math.ceil(sr * (bars * bar + 1)), sr);
  const comp = oc.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  const master = oc.createGain(); master.gain.value = 0.55; master.connect(comp); comp.connect(oc.destination);
  const nb = oc.createBuffer(1, sr, sr), nd = nb.getChannelData(0); for (let i = 0; i < sr; i++) nd[i] = Math.random() * 2 - 1;
  const hz = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
  const pats = [[2, -1, 1, 0, 1, -1, 2, 3], [3, 2, -1, 1, 2, -1, 0, -1], [0, 1, 2, -1, 3, -1, 2, 1], [1, -1, 0, -1, 2, 1, 0, -1]];
  const kick = (t: number) => {
    const o = oc.createOscillator(), g = oc.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.4);
  };
  const noise = (t: number, type: BiquadFilterType, f: number, q: number, dec: number, vol: number) => {
    const s = oc.createBufferSource(); s.buffer = nb;
    const fl = oc.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = oc.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    s.connect(fl).connect(g).connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.02);
  };
  const tone = (t: number, len: number, f: number, type: OscillatorType, vol: number, cut: number) => {
    const o = oc.createOscillator(); o.type = type; o.frequency.value = f;
    const fl = oc.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = cut;
    const g = oc.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setTargetAtTime(vol * 0.5, t + 0.01, len * 0.4); g.gain.setTargetAtTime(0, t + len, 0.04);
    o.connect(fl).connect(g).connect(master); o.start(t); o.stop(t + len + 0.3);
  };
  const soft = sp.lead === 'triangle';
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, ch = sp.prog[b % 4], brk = sp.breaks.includes(b);
    for (const n of ch) for (const d of [-6, 6]) {
      const o = oc.createOscillator(); o.type = soft ? 'triangle' : 'sawtooth'; o.frequency.value = hz(n); o.detune.value = d;
      const fl = oc.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = brk ? sp.cut / 2 : sp.cut;
      const g = oc.createGain(), v = soft ? 0.08 : 0.045;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + 0.25); g.gain.setValueAtTime(v, t0 + bar - 0.15); g.gain.linearRampToValueAtTime(0, t0 + bar + 0.05);
      o.connect(fl).connect(g).connect(master); o.start(t0); o.stop(t0 + bar + 0.1);
    }
    if (b === 0) continue;
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat;
      if (!brk && b !== bars - 1) kick(t);
      if (!brk && (q === 1 || q === 3)) noise(t, 'bandpass', soft ? 1200 : 1800, 0.8, 0.18, soft ? 0.3 : 0.5);
      if (!brk) noise(t + beat / 2, 'highpass', 8000, 0.7, 0.05, soft ? 0.1 : 0.22);
    }
    if (!brk) for (let e = 0; e < 8; e++) tone(t0 + e * beat / 2, beat * 0.4, hz(sp.roots[b % 4] + (e % 4 === 3 ? 12 : 0)), soft ? 'sine' : 'square', soft ? 0.22 : 0.12, 500);
    if (b < bars - 2) {
      const pat = pats[b % 4];
      for (let e = 0; e < 8; e++) {
        const s = pat[e]; if (s < 0) continue;
        const n = s < 3 ? ch[s] + 12 : ch[0] + 24;
        tone(t0 + e * beat / 2, beat * 0.45, hz(n), (brk || soft) ? 'triangle' : 'square', brk ? 0.09 : (soft ? 0.1 : 0.06), 2600);
      }
    }
  }
  return oc.startRendering();
}

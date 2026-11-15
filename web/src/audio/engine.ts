import { app, emit } from '../core/store';
import { clamp } from '../core/util';
import { fx } from '../core/fx';
import { spNow, spPlay, spPause, spSeek } from '../spotify/spotify';
import { startIntro } from '../sky/post';
import { nextTrack, syncEnd } from '../player/library';

// Local songs and demos play through Web Audio, so the sky can analyse them.
// Spotify songs are played by Spotify; these functions hand over to the Spotify module for them.
export const audio = {
  ac: null as AudioContext | null,
  analyser: null as AnalyserNode | null,
  freq: null as Uint8Array<ArrayBuffer> | null,
  tdata: null as Uint8Array<ArrayBuffer> | null,
  src: null as AudioBufferSourceNode | null,
  startedAt: 0, offset: 0, trackStartT: 0,
};

export function ensureAC(): AudioContext {
  if (!audio.ac) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC(), an = ac.createAnalyser();
    an.fftSize = 1024; an.smoothingTimeConstant = 0.72; an.connect(ac.destination);
    audio.ac = ac; audio.analyser = an;
    audio.freq = new Uint8Array(an.frequencyBinCount); audio.tdata = new Uint8Array(an.fftSize);
  }
  return audio.ac;
}

const isSp = () => !!(app.tracks[app.cur] && app.tracks[app.cur].sp);
export const dur = () => isSp() ? app.tracks[app.cur].sp!.durationMs / 1000 : app.buffer ? app.buffer.duration : 0;
export const now = () => isSp() ? spNow() : app.playing && audio.ac ? Math.min(audio.ac.currentTime - audio.startedAt, dur()) : audio.offset;

export function play() {
  if (isSp()) { void spPlay(); return; }
  const buffer = app.buffer; if (!buffer) return;
  const ac = ensureAC(); void ac.resume();
  if (audio.offset >= dur() - 0.05) audio.offset = 0;
  if (audio.offset < 0.3) startIntro();
  const s = ac.createBufferSource(); s.buffer = buffer; s.connect(audio.analyser!);
  s.onended = () => {
    if (audio.src === s && app.playing) {
      app.playing = false; audio.offset = 0; audio.src = null; syncEnd(); emit();
      nextTrack(true);
    }
  };
  s.start(0, audio.offset); audio.src = s; audio.startedAt = ac.currentTime - audio.offset; app.playing = true; audio.trackStartT = fx.T;
  try { (navigator as Navigator & { wakeLock?: { request(t: string): Promise<unknown> } }).wakeLock?.request('screen').catch(() => {}); } catch { /* not supported */ }
  emit();
}
export function pause() {
  if (isSp()) { void spPause(); return; }
  if (!app.playing) return;
  audio.offset = now(); app.playing = false;
  const s = audio.src; audio.src = null; try { s?.stop(); } catch { /* already stopped */ }
  emit();
}
export function seek(t: number) {
  if (isSp()) { void spSeek(t); return; }
  const was = app.playing; if (was) pause();
  audio.offset = clamp(t, 0, dur()); fx.lastBeatT = -1;
  if (was) play(); else emit();
}
export function stopAll() { pause(); audio.offset = 0; }
export const togglePlay = () => app.playing ? pause() : play();

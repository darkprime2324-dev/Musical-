import { g, W, H, DPR } from './canvas';
import { SCENE_DRAW, drawFlares, drawParts, hoverConst } from './draw';
import { drawLyrics } from './lyrics';
import { post, drawIntro } from './post';
import { analyse, onBeat, updateCam } from '../audio/analysis';
import { now } from '../audio/engine';
import { app, lyricSignal } from '../core/store';
import { cam, fx, fxParts, parts, rings } from '../core/fx';
import { PAL, S } from '../core/settings';
import { MONO, RM } from '../core/util';
import { lyricState } from '../lyrics/parse';
import { spPoll } from '../spotify/spotify';

// Per-frame hooks for parts of the interface that show live numbers (time, seek bar, BPM).
const frameHooks = new Set<() => void>();
export function onFrame(fn: () => void) { frameHooks.add(fn); return () => { frameHooks.delete(fn); }; }

// When a new line or word starts: with no audio to analyse (Spotify songs), the singing drives the sky.
let lpState = '';
function lyricMoment(idx: number, wOn: number): boolean {
  const st = idx + ':' + wOn; if (st === lpState) return false;
  const [pi, pw] = lpState ? lpState.split(':').map(Number) : [-9, 0]; lpState = st;
  if (!app.playing || idx < 0 || RM) return false;
  const noAudio = !!(app.tracks[app.cur] && app.tracks[app.cur].sp) || fx.level < 8;
  if (pi !== idx) { if (noAudio) onBeat(now(), 1, false); rings.push({ r: 0, a: 0.9 }); return true; }
  if (wOn > pw && noAudio) onBeat(now(), 0.6, false);
  return wOn > pw;
}

let last = 0, running = false;
function frame(ts: number) {
  if (!running) return;
  const dt = Math.min(0.05, (ts - (last || ts)) / 1000); last = ts; fx.T += dt; fx.frameDt = dt;
  if (g) {
    analyse(dt); updateCam(dt); const P = PAL();
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.save(); g.translate(W / 2 + cam.x, H / 2 + cam.y); g.scale(cam.z, cam.z); g.rotate(cam.rot); g.translate(-W / 2, -H / 2);
    SCENE_DRAW[S.scene](P); drawFlares(dt, P); drawParts(parts, dt);
    g.restore();
    if (S.view !== 'list') drawLyrics(P);
    drawParts(fxParts, dt);
    if (hoverConst && !RM) { g.font = `400 11px ${MONO}`; g.fillStyle = P.accent; g.globalAlpha = 0.8; g.textAlign = 'right'; g.fillText(('constellation · ' + hoverConst.name).toUpperCase(), W - 16, H - 16); g.textAlign = 'left'; g.globalAlpha = 1; }
    post(P);
    if (!RM && fx.drop > 0.05) { g.globalAlpha = fx.drop * 0.3; g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (S.view !== 'list') drawIntro(dt);
  }
  const [idx, wOn] = lyricState(), moved = lyricMoment(idx, wOn);
  if (idx !== app.lyric.idx || wOn !== app.lyric.wOn) { app.lyric = { idx, wOn, moved }; lyricSignal.emit(); }
  frameHooks.forEach(f => f());
  void spPoll();
  requestAnimationFrame(frame);
}
export function startLoop() { if (running) return; running = true; requestAnimationFrame(frame); }
export function stopLoop() { running = false; }

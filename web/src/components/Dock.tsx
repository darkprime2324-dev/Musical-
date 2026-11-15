import { useEffect, useRef } from 'react';
import { app, emit, uiSignal, useSignal } from '../core/store';
import { S, SCENES, STYLES, save } from '../core/settings';
import type { SceneId } from '../core/types';
import { fmt } from '../core/util';
import { dur, now, seek, togglePlay } from '../audio/engine';
import { onFrame } from '../sky/loop';
import { forceStyle } from '../sky/lyrics';
import { nextTrack, prevTrack, setRoman } from '../player/library';
import { Chips } from './Chips';
import { IconNext, IconPlay, IconPrev } from './Icons';

export function Dock() {
  useSignal(uiSignal);
  const cur = useRef<HTMLSpanElement>(null), bar = useRef<HTMLInputElement>(null), dragging = useRef(false);
  // Time and seek bar update every frame without re-rendering React.
  useEffect(() => {
    let last = '';
    return onFrame(() => {
      const t = now(), s = fmt(t);
      if (s !== last && cur.current) { cur.current.textContent = s; last = s; }
      if (!dragging.current && bar.current) bar.current.value = String(t);
    });
  }, []);
  // Seek on release; while paused, follow the drag.
  useEffect(() => {
    const el = bar.current!;
    const down = () => { dragging.current = true; };
    const change = () => { dragging.current = false; seek(+el.value); };
    const input = () => { if (!app.playing) seek(+el.value); };
    el.addEventListener('pointerdown', down); el.addEventListener('change', change); el.addEventListener('input', input);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('change', change); el.removeEventListener('input', input); };
  }, []);
  const d = dur();
  return (
    <footer className="dock">
      <div className="transport gutter">
        <button className="ico" id="prevBtn" type="button" aria-label="Previous song" onClick={prevTrack}><IconPrev /></button>
        <button className="play" id="playBtn" type="button" aria-label={app.playing ? 'Pause' : 'Play'} onClick={togglePlay}><IconPlay playing={app.playing} /></button>
        <button className="ico" id="nextBtn" type="button" aria-label="Next song" onClick={() => nextTrack()}><IconNext /></button>
        <span className="time" id="curTime" ref={cur}>0:00</span>
        <input type="range" id="seek" ref={bar} min="0" max={String(d || 1)} step="0.01" defaultValue="0" aria-label="Song position" />
        <span className="time" id="durTime">{fmt(d)}</span>
      </div>
      <div className="looks gutter">
        <span className="label">View</span>
        <Chips id="viewChips" nowrap items={[['list', 'Lyrics'], ['sky', 'Sky']]} value={S.view} onPick={v => { S.view = v; }} />
        <button className="chip" id="engChip" type="button" aria-pressed={String(!!S.roman) as 'true' | 'false'} onClick={() => setRoman(!S.roman)}>English letters</button>
        <span className="sep" />
        <span className="label">Sky lyrics</span>
        <Chips id="styleChips" nowrap items={STYLES} value={S.style} onPick={v => { S.style = v; forceStyle(v); }} />
        <span className="sep" />
        <span className="label">Sky</span>
        <div className="row nowrap" id="swatches">
          {(Object.entries(SCENES) as [SceneId, typeof SCENES[SceneId]][]).map(([id, P]) => (
            <button key={id} type="button" className="swatch" data-id={id} title={P.label} aria-label={P.label} aria-pressed={String(id === S.scene) as 'true' | 'false'}
              style={{ background: `radial-gradient(circle at 35% 35%, ${P.accent} 0 18%, ${P.bg[1]} 20%, ${P.bg[0]})` }}
              onClick={() => { S.scene = id; save(); emit(); }} />
          ))}
        </div>
      </div>
    </footer>
  );
}

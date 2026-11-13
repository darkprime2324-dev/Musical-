import { useEffect, useRef, useState } from 'react';
import { app, uiSignal, useSignal } from '../core/store';
import { attachCanvas } from '../sky/canvas';
import { togglePlay } from '../audio/engine';
import { addFiles, syncEnd, syncTap, toggleFullscreen } from '../player/library';
import { LyricsView } from './LyricsView';

// Tap-to-sync bar: shows the next line (or the next word) to tap.
function TapSync() {
  useSignal(uiSignal);
  const s = app.tapSync, line = s.list[s.i] || '';
  return (
    <div className="sync gutter" id="sync" hidden={!s.active}>
      <div>
        <span className="label">Next line</span>
        <strong id="syncNext">
          {!s.words ? line : line.split(/\s+/).map((w, i) => (
            <span key={i} style={{ opacity: i < s.w ? 0.4 : 1, color: i === s.w ? 'var(--accent)' : undefined }}>{w + ' '}</span>
          ))}
        </strong>
      </div>
      <div className="row">
        <button className="btn primary tap" id="syncTap" type="button" onClick={syncTap}>{s.words ? 'Tap when this word is sung' : 'Tap when this line starts'}</button>
        <button className="btn" id="syncDone" type="button" onClick={syncEnd}>Finish</button>
      </div>
    </div>
  );
}

export function Stage() {
  const cv = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLElement>(null);
  const [drop, setDrop] = useState(false);
  useEffect(() => attachCanvas(cv.current!), []);
  return (
    <main className="stage" id="stageWrap" ref={wrap}
      onDragOver={e => { if ([...e.dataTransfer.types].includes('Files')) { e.preventDefault(); setDrop(true); } }}
      onDragLeave={e => { if (e.target === wrap.current || e.target === cv.current) setDrop(false); }}
      onDrop={e => { e.preventDefault(); setDrop(false); if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files); }}>
      <canvas id="stage" ref={cv} aria-label="Animated night sky with constellations and lyrics that follow the music" onClick={() => { if (!app.tapSync.active) togglePlay(); }} />
      <LyricsView />
      <TapSync />
      <div className="drop" id="dropHint" hidden={!drop}>Drop songs and .lrc files to add them</div>
      <div className="fsdock">
        <button className="btn" id="fsPlay" type="button" onClick={togglePlay}>Play / pause</button>
        <button className="btn" id="fsExit" type="button" onClick={toggleFullscreen}>Exit full screen</button>
      </div>
    </main>
  );
}

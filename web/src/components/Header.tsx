import { useEffect, useRef } from 'react';
import { app, curTrack, emit, openSheet, uiSignal, useSignal } from '../core/store';
import { fx } from '../core/fx';
import { MOON } from '../core/util';
import { onFrame } from '../sky/loop';
import { addSongFiles, titleOf, toggleFullscreen } from '../player/library';
import { isConnected, spLoadMyPlaylists } from '../spotify/spotify';
import { IconFull, IconLyrics, IconPlaylist, IconSettings } from './Icons';

export function Header() {
  useSignal(uiSignal);
  const bpm = useRef<HTMLSpanElement>(null), file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let last = '';
    return onFrame(() => {
      const b = app.playing && fx.intervals.length > 2 ? String(Math.round(60 / fx.beatInterval)).padStart(3, ' ') + ' BPM' : '--- BPM';
      if (b !== last && bpm.current) { bpm.current.textContent = b; bpm.current.classList.toggle('on', app.playing); last = b; }
    });
  }, []);
  const tr = curTrack();
  const title = !tr ? 'No song loaded' : tr.loading ? `Loading ${titleOf(tr)}` : titleOf(tr);
  const pill = app.syncPill;
  return (
    <header className="bar gutter">
      <div className="brand">Stellar<span>.</span></div>
      <div className="now">
        <b id="nowTitle">{title}</b>
        <span className="pill" id="bpm" ref={bpm}>--- BPM</span>
        <span className="pill moon" id="moonPill">{`${MOON.name} · ${Math.round(MOON.lit * 100)}% lit`}</span>
        <span className={'pill' + (pill.ok ? ' on' : '')} id="syncPill" hidden={!pill.text}>{pill.text}</span>
      </div>
      <button className="ico" id="plBtn" type="button" aria-label="Playlist" title="Playlist (L)"
        onClick={() => { openSheet('Playlist'); if (isConnected() && !app.sp.mine) void spLoadMyPlaylists(); }}><IconPlaylist /></button>
      <button className="ico" id="lyricsBtn" type="button" aria-label="Lyrics" title="Lyrics" onClick={() => openSheet('Lyrics')}><IconLyrics /></button>
      <button className="ico" id="fsBtn" type="button" aria-label="Full screen" title="Full screen (F)" onClick={toggleFullscreen}><IconFull /></button>
      <button className="ico" id="setBtn" type="button" aria-label="Settings" title="Settings" onClick={() => openSheet('Settings')}><IconSettings /></button>
      <input type="file" id="songFile" accept="audio/*" multiple hidden ref={file}
        onChange={e => { const files = [...(e.target.files || [])]; e.target.value = ''; addSongFiles(files); emit(); }} />
    </header>
  );
}

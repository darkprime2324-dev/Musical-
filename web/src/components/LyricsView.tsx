import { useEffect, useRef, type CSSProperties } from 'react';
import { app, curTrack, lyricSignal, openSheet, uiSignal, useSignal } from '../core/store';
import { fxParts } from '../core/fx';
import { PAL, S } from '../core/settings';
import { RM, TAU } from '../core/util';
import { canvas } from '../sky/canvas';
import { play, seek } from '../audio/engine';
import { artistOf, titleOf } from '../player/library';

// Sparks that fly off a word as it is sung.
function wordSparks(el: Element | undefined) {
  if (RM || !el || !canvas) return;
  const r = el.getBoundingClientRect(), c = canvas.getBoundingClientRect(), P = PAL();
  const x = r.left - c.left + r.width / 2, y = r.top - c.top + r.height / 2;
  for (let k = 0; k < (S.parts === 'high' ? 8 : 4) && fxParts.length < 220; k++) {
    const a = Math.random() * TAU, sp = 60 + Math.random() * 160;
    fxParts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.6 + Math.random() * 0.5, s: 1.2 + Math.random() * 2, col: Math.random() < 0.5 ? '#ffffff' : P.accent });
  }
}

// Spotify-style lyrics: the whole song, the current line lit word by word, auto-scrolling, click to seek.
export function LyricsView() {
  useSignal(uiSignal); useSignal(lyricSignal);
  const box = useRef<HTMLDivElement>(null), userScroll = useRef(0), prevIdx = useRef(-9);
  const on = S.view === 'list', lines = app.lines, t = curTrack(), { idx, wOn, moved } = app.lyric;

  useEffect(() => { prevIdx.current = -9; }, [lines]);
  useEffect(() => {
    const lv = box.current; if (!lv || !on) return;
    const els = lv.querySelectorAll<HTMLElement>('.ln');
    if (idx >= 0 && els[idx]) {
      if (moved && app.playing && wOn > 0) wordSparks(els[idx].querySelectorAll('.w')[wOn - 1]);
      if (prevIdx.current !== idx && performance.now() - userScroll.current > 3000) lv.scrollTo({ top: Math.max(0, els[idx].offsetTop - lv.clientHeight * 0.36), behavior: RM ? 'auto' : 'smooth' });
    } else if (idx < 0 && prevIdx.current !== idx && performance.now() - userScroll.current > 3000) lv.scrollTo({ top: 0, behavior: 'auto' });
    prevIdx.current = idx;
  }, [idx, wOn, on, lines, moved]);

  const lrc = t?.lrc || '', fromLrclib = /LRCLIB #\d+/.test(lrc), synced = /auto-synced[^\]]*/.exec(lrc);
  const noteUser = () => { userScroll.current = performance.now(); };
  return (
    <div className="lv" id="lyricView" hidden={!on} ref={box} style={{ '--lvbg': app.lvTint || undefined } as CSSProperties} onWheel={noteUser} onTouchMove={noteUser}>
      <div className="lv-inner" id="lvInner">
        <div className="lv-meta">
          {t ? [titleOf(t), artistOf(t)].filter(Boolean).join('  ·  ') : ''}
          {t?.sp && <>{'  ·  '}<a className="lv-sp" href={'https://open.spotify.com/track/' + t.sp.uri.split(':').pop()} target="_blank" rel="noopener">Listen on Spotify</a></>}
        </div>
        {!lines.length ? (
          <div className="lv-empty">
            {!t ? 'Add a song to get started.' : t.loading ? 'Loading the song...' : /Finding/.test(app.syncPill.text) ? 'Looking for lyrics...' : 'No lyrics for this song yet.'}
            {t && !t.loading && <button type="button" className="btn primary" onClick={() => openSheet('Lyrics')}>Find or paste lyrics</button>}
          </div>
        ) : (
          <>
            {lines.map((l, i) => (
              <button key={i} type="button" className={'ln' + (l.text ? '' : ' gap') + (i < idx ? ' past' : '') + (i === idx ? ' now' : '')}
                onClick={() => { userScroll.current = 0; seek(Math.max(0, l.t - 0.05)); if (!app.playing) play(); }}>
                {!l.text ? '♪ ♪ ♪' : l.text.split(/\s+/).map((w, j) => (
                  <span key={j}>{j > 0 && ' '}<span className={'w' + (i === idx && j < wOn ? ' on' : '')}>{w}</span></span>
                ))}
              </button>
            ))}
            <div className="lv-credit">{[fromLrclib ? 'Lyrics from LRCLIB' : 'Your lyrics', synced ? synced[0].replace(/,.*$/, '') : '', S.roman ? 'shown in English letters' : ''].filter(Boolean).join('  ·  ')}</div>
          </>
        )}
      </div>
    </div>
  );
}

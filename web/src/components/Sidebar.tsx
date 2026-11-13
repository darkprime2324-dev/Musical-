import { app, uiSignal, useSignal } from '../core/store';
import { fmt } from '../core/util';
import { artistOf, coverBackground, selectTrack, titleOf } from '../player/library';
import { IconPlus } from './Icons';

// "Your library": every song with its cover, artist and length. The playing song is highlighted.
export function Sidebar() {
  useSignal(uiSignal);
  return (
    <aside className="side" aria-label="Your library">
      <div className="side-head">
        <b>Your library</b>
        <button className="ico" id="sideAdd" type="button" aria-label="Add songs" title="Add songs" onClick={() => document.getElementById('songFile')?.click()}><IconPlus /></button>
      </div>
      <div className="side-list" id="sideList">
        {!app.tracks.length && <p className="hint" style={{ padding: 8 }}>No songs yet. Use + to add songs from this computer.</p>}
        {app.tracks.map((t, i) => (
          <button key={(t.sp?.uri || t.name) + i} type="button" className="st" aria-current={String(i === app.cur) as 'true' | 'false'} onClick={() => void selectTrack(i, true)}>
            <span className="cover" style={{ background: coverBackground(t) }}>{t.cover ? '' : titleOf(t).trim().charAt(0).toUpperCase()}</span>
            <span className="n">
              <span className="t">{(i === app.cur && app.playing ? '▶ ' : '') + titleOf(t)}</span>
              <span className="a">{artistOf(t) || (t.loading ? 'Loading' : ' ')}</span>
            </span>
            <span className="d">{t.buffer ? fmt(t.buffer.duration) : t.sp ? fmt(t.sp.durationMs / 1000) : ''}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

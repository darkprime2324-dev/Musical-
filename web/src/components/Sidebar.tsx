import { useEffect, useState } from 'react';
import { app, emit, openSheet, uiSignal, useSignal } from '../core/store';
import type { Track } from '../core/types';
import { fmt } from '../core/util';
import { artistOf, coverBackground, selectTrack, titleOf } from '../player/library';
import { createList, currentList, inList, moveInList, queue, showList, toggleInList, trackKey } from '../player/playlists';
import { IconPlus } from './Icons';

function SongMenu({ t, i, onClose }: { t: Track; i: number; onClose: () => void }) {
  const l = currentList();
  useEffect(() => {
    const off = (e: Event) => { if (!(e.target as Element).closest?.('.songmenu, .more')) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('pointerdown', off); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  return (
    <div className="songmenu" role="menu" aria-label={`${titleOf(t)} options`}>
      <span className="label">Add to playlist</span>
      {app.lists.map(p => (
        <button key={p.id} type="button" role="menuitemcheckbox" aria-checked={inList(p, t)} onClick={() => toggleInList(p, t)}>
          <span className="tick">{inList(p, t) ? '✓' : ''}</span>{p.name}
        </button>
      ))}
      <button type="button" role="menuitem" onClick={() => { const p = createList(undefined, [trackKey(t)]); showList(p.id); onClose(); }}><span className="tick">+</span>New playlist with this song</button>
      {l && inList(l, t) && <>
        <span className="label">{l.name}</span>
        <button type="button" role="menuitem" onClick={() => moveInList(l, t, -1)}><span className="tick">↑</span>Move up</button>
        <button type="button" role="menuitem" onClick={() => moveInList(l, t, 1)}><span className="tick">↓</span>Move down</button>
      </>}
      <span className="label">Song</span>
      <button type="button" role="menuitem" onClick={() => { onClose(); void selectTrack(i, false).then(() => openSheet('Lyrics')); }}><span className="tick">≡</span>Lyrics</button>
    </div>
  );
}

// "Your library": every song, or one of your playlists, with covers, artists and lengths. The playing song is highlighted.
export function Sidebar() {
  useSignal(uiSignal);
  const [menu, setMenu] = useState<string | null>(null);
  const l = currentList(), order = queue();
  return (
    <aside className="side" aria-label="Your library">
      <div className="side-head">
        <b>Your library</b>
        <button className="ico" id="sideAdd" type="button" aria-label="Add songs" title="Add songs" onClick={() => document.getElementById('songFile')?.click()}><IconPlus /></button>
      </div>
      <div className="side-lists" role="tablist" aria-label="Playlists">
        <button type="button" role="tab" className="chip" aria-selected={!l} aria-pressed={!l} onClick={() => showList(null)}>All songs</button>
        {app.lists.map(p => <button key={p.id} type="button" role="tab" className="chip" aria-selected={l === p} aria-pressed={l === p} onClick={() => showList(p.id)}>{p.name}</button>)}
        <button type="button" className="chip add" title="New playlist" aria-label="New playlist" onClick={() => { const p = createList(); showList(p.id); }}>+</button>
      </div>
      <div className="side-list" id="sideList">
        {!app.tracks.length && <p className="hint" style={{ padding: 8 }}>No songs yet. Use + to add songs from this computer.</p>}
        {l && !order.length && <p className="hint" style={{ padding: 8 }}>{l.name} is empty. Use the ⋯ button on any song in All songs to add it here.</p>}
        {order.map(i => {
          const t = app.tracks[i], k = trackKey(t);
          return (
            <div key={k + i} className="strow">
              <button type="button" className="st" aria-current={String(i === app.cur) as 'true' | 'false'} data-missing={t.missing ? 'true' : undefined} onClick={() => void selectTrack(i, true)}>
                <span className="cover" style={{ background: coverBackground(t) }}>{t.cover ? '' : titleOf(t).trim().charAt(0).toUpperCase()}</span>
                <span className="n">
                  <span className="t">{(i === app.cur && app.playing ? '▶ ' : '') + titleOf(t)}</span>
                  <span className="a">{t.missing ? 'File needed · ' + (artistOf(t) || t.missing.fileName) : (t.sp ? 'Spotify · ' : '') + (artistOf(t) || (t.loading ? 'Loading' : ' '))}</span>
                </span>
                <span className="d">{t.buffer ? fmt(t.buffer.duration) : t.sp ? fmt(t.sp.durationMs / 1000) : ''}</span>
              </button>
              <button type="button" className="more" aria-label={`More options for ${titleOf(t)}`} aria-haspopup="menu" aria-expanded={menu === k} onClick={() => { setMenu(menu === k ? null : k); emit(); }}>⋯</button>
              {menu === k && <SongMenu t={t} i={i} onClose={() => setMenu(null)} />}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

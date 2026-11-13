import { useEffect, useRef } from 'react';
import { app, emit, toast, uiSignal, useSignal } from '../core/store';
import { S, VIZ, save } from '../core/settings';
import { fmt } from '../core/util';
import { dur } from '../audio/engine';
import { parseLyrics } from '../lyrics/parse';
import { searchPanel } from '../lyrics/lrclib';
import { addDemos, addFiles, applyLyrics, coverBackground, removeTrack, runAutoSync, selectTrack, setRoman, startSync, useResult } from '../player/library';
import { isConnected, spClientId, spDisconnect, spImport, spLogin, spRedirect, spSaveClient } from '../spotify/spotify';
import { Chips } from './Chips';

const close = () => { app.sheet = null; emit(); };

function LyricsPanel({ show }: { show: boolean }) {
  const area = useRef<HTMLTextAreaElement>(null), lrcFile = useRef<HTMLInputElement>(null);
  useEffect(() => { if (show) area.current?.focus(); }, [show]);
  const copy = () => {
    const txt = app.lyricsDraft; if (!txt.trim()) return toast('Nothing to copy yet.');
    const fallback = () => { area.current?.select(); toast('Press Ctrl+C or Cmd+C to copy the selected lyrics.'); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => toast('Timed lyrics copied. Save them as a .lrc file next to the song.')).catch(fallback); else fallback();
  };
  return (
    <div id="panLyrics" hidden={!show}>
      <p className="hint">Lyrics for the current song. Songs you add get their lyrics from <b>LRCLIB</b>, a free open lyrics database, and are then auto-synced to your recording. Lines with timestamps like <code>[01:23.50]</code> sync exactly, and <code>&lt;01:23.90&gt;</code> tags inside a line time single words. Plain lines are spread evenly across the song, or use <b>Sync by tapping</b> to time them yourself while the song plays.</p>
      <div className="find">
        <div className="findrow">
          <input id="qTitle" type="text" placeholder="Song title" aria-label="Song title" value={app.query.title} onChange={e => { app.query.title = e.target.value; emit(); }} />
          <input id="qArtist" type="text" placeholder="Artist (optional)" aria-label="Artist" value={app.query.artist} onChange={e => { app.query.artist = e.target.value; emit(); }} />
          <button className="btn primary" id="qGo" type="button" onClick={() => void searchPanel()}>Find lyrics online</button>
        </div>
        <div className="tracks" id="qResults">
          {app.qState === 'searching' && <p className="hint">Searching LRCLIB...</p>}
          {app.qState === 'none' && <p className="hint">Nothing found. Try the title alone, or a different spelling.</p>}
          {app.qResults?.map(r => {
            const near = !!app.buffer && Math.abs((r.duration || 0) - dur()) < 3;
            return (
              <button key={r.id} type="button" className="tr" onClick={() => useResult(r)}>
                <div className="n"><b>{r.trackName}</b><small>{[r.artistName, r.albumName, r.duration ? fmt(r.duration) : '', near ? 'same length as your song' : ''].filter(Boolean).join(' · ')}</small></div>
                <span className={'badge' + (r.syncedLyrics ? ' ok' : '')}>{r.syncedLyrics ? 'Timed' : 'Text only'}</span>
              </button>
            );
          })}
        </div>
      </div>
      <textarea id="lyricsText" ref={area} spellCheck={false} aria-label="Lyrics text" value={app.lyricsDraft} onChange={e => { app.lyricsDraft = e.target.value; emit(); }} />
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" id="applyLyrics" type="button" onClick={applyLyrics}>Apply lyrics</button>
        <button className="btn" id="tapSync" type="button" onClick={() => startSync(false)}>Sync lines by tapping</button>
        <button className="btn" id="tapSyncWords" type="button" onClick={() => startSync(true)}>Sync every word</button>
        <button className="btn" id="lrcBtn" type="button" onClick={() => lrcFile.current?.click()}>Open .lrc file</button>
        <button className="btn" id="autoSyncBtn" type="button" onClick={runAutoSync}>Auto-sync to the audio</button>
        <button className="btn" id="copyLrc" type="button" onClick={copy}>Copy timed lyrics</button>
      </div>
      <p className="hint" style={{ marginTop: 10 }}>While a song plays, <code>[</code> and <code>]</code> shift all lyrics 0.1 s earlier or later, <code>{'{'}</code> and <code>{'}'}</code> by a full second. The shift is saved as an <code>[offset:]</code> line.</p>
      <input type="file" id="lrcFile" ref={lrcFile} accept=".lrc,.txt,text/plain" hidden onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { app.lyricsDraft = await f.text(); applyLyrics(); } }} />
    </div>
  );
}

function HelpList({ items }: { items: string[] }) {
  return <ol style={{ margin: '8px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>{items.map((t, i) => <li key={i}>{t}</li>)}</ol>;
}
function SpotifyStatus() {
  const st = app.sp.status, follow = 'Just play it in your Spotify app. Stellar follows along and adds each song with its lyrics as it comes on';
  if (st === 'reading') return <p className="hint" id="spStatus" aria-live="polite">Reading from Spotify...</p>;
  if (st === 'notYours') return (
    <p className="hint" id="spStatus" aria-live="polite"><b>This playlist belongs to someone else.</b> Since February 2026 Spotify only lets apps read playlists you own or collaborate on. Two easy ways:
      <HelpList items={[follow + '.', 'Or make a copy that is yours: in Spotify open the playlist, click a song, press Ctrl+A, right-click, Add to playlist, New playlist. It then appears under Your playlists below.']} /></p>
  );
  if (st === 'mix' || st === 'mixUnknown') return (
    <p className="hint" id="spStatus" aria-live="polite"><b>{st === 'mix' ? 'This is a Spotify-made mix (Daily Mix, Discover Weekly, Top 50, This Is...).' : 'Spotify would not share this list.'}</b> Spotify does not let apps read these lists. Two easy ways:
      <HelpList items={[follow + (isConnected() ? '.' : ' (connect Spotify in Settings first).'), "Or make it yours: in Spotify desktop open the mix, click a song, press Ctrl+A, right-click, Add to playlist, New playlist. Then paste that new playlist's link here."]} /></p>
  );
  return <p className="hint" id="spStatus" aria-live="polite"></p>;
}
function MyPlaylists() {
  const m = app.sp.mine;
  return (
    <div className="tracks" id="spMine">
      {m === 'loading' && <p className="hint">Loading your playlists...</p>}
      {m === 'none' && <p className="hint">You have no playlists of your own yet. Make one in Spotify and it shows up here.</p>}
      {Array.isArray(m) && <>
        <span className="label">Your playlists</span>
        {m.map(pl => {
          const img = (pl.images || []).slice(-1)[0], total = (pl.items || pl.tracks || {}).total;
          return (
            <button key={pl.id} type="button" className="st" onClick={() => void spImport('spotify:playlist:' + pl.id)}>
              <span className="cover" style={{ background: img ? `url("${img.url}") center / cover` : coverBackground({ name: pl.name }) }}>{img ? '' : (pl.name || '?').charAt(0).toUpperCase()}</span>
              <span className="n"><span className="t">{pl.name}</span><span className="a">{(total != null ? total + ' songs' : '') + (pl.collaborative ? ' · collaborative' : '')}</span></span>
            </button>
          );
        })}
      </>}
    </div>
  );
}

function PlaylistPanel({ show }: { show: boolean }) {
  const link = useRef<HTMLInputElement>(null), folder = useRef<HTMLInputElement>(null);
  useEffect(() => { folder.current?.setAttribute('webkitdirectory', ''); }, []);
  return (
    <div id="panPlaylist" hidden={!show}>
      <div className="find">
        <div className="findrow">
          <input id="spLink" ref={link} type="text" placeholder="Paste a Spotify playlist, album or song link" aria-label="Spotify link" onKeyDown={e => { if (e.key === 'Enter') void spImport(link.current!.value); }} />
          <button className="btn primary" id="spGo" type="button" onClick={() => void spImport(link.current!.value)}>Add from Spotify</button>
        </div>
        <SpotifyStatus />
        <MyPlaylists />
      </div>
      <p className="hint">Songs play in order and move to the next one automatically. Open a whole folder at once: a <code>.lrc</code> file with the same name as a song is used as its lyrics, and songs without one look theirs up on LRCLIB. You can also drop files onto the sky.</p>
      <div className="tracks" id="trackList">
        {!app.tracks.length && <p className="hint">No songs yet. Add songs from this device, or add the demo songs.</p>}
        {app.tracks.map((t, i) => {
          const ln = parseLyrics(t.lrc || '', 0).filter(l => l.text).length;
          return (
            <button key={(t.sp?.uri || t.name) + i} type="button" className="tr" aria-current={String(i === app.cur) as 'true' | 'false'} onClick={() => void selectTrack(i, true)}>
              <div className="n"><b>{(i === app.cur && app.playing ? '▶ ' : '') + t.name}</b><small>{(t.artist ? t.artist + ' · ' : '') + (ln ? `${ln} lyric lines` : 'no lyrics yet')}</small></div>
              <span role="button" tabIndex={0} className="rm" aria-label={`Remove ${t.name}`} onClick={e => { e.stopPropagation(); removeTrack(i); }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); removeTrack(i); } }}>Remove</span>
            </button>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="btn primary" id="addSongs" type="button" onClick={() => document.getElementById('songFile')?.click()}>Add songs</button>
        <button className="btn" id="addFolder" type="button" onClick={() => folder.current?.click()}>Open a music folder</button>
        <button className="btn" id="demoBtn" type="button" onClick={() => { const n = app.tracks.length; addDemos(); if (app.cur < 0 && app.tracks.length) void selectTrack(0, false); toast(app.tracks.length > n ? 'Demo songs added' : 'The demo songs are already in the playlist'); }}>Add demo songs</button>
        <input type="file" id="folderFile" ref={folder} multiple hidden onChange={e => { const f = e.target.files; if (f) void addFiles([...f]); e.target.value = ''; }} />
      </div>
    </div>
  );
}

function SettingsPanel({ show }: { show: boolean }) {
  const client = useRef<HTMLInputElement>(null);
  const fx: [keyof typeof S, string][] = [['lines', 'Constellations'], ['names', 'Star names'], ['cam', 'Camera drift'], ['intro', 'Song intro card']];
  return (
    <div id="panSettings" hidden={!show}>
      <div className="set">
        <span className="label">Spotify</span>
        <p className="hint" id="spConn">{app.sp.conn}</p>
        <div className="row">
          <button className="btn primary" id="spLogin" type="button" hidden={app.sp.connected} onClick={() => void spLogin()}>Connect Spotify</button>
          <button className="btn" id="spLogout" type="button" hidden={!app.sp.connected} onClick={spDisconnect}>Disconnect</button>
        </div>
        <details className="spsetup"><summary>One-time setup: your Spotify Client ID</summary>
          <ol className="hint">
            <li>Open <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a>, log in with your Spotify account and choose <b>Create app</b>.</li>
            <li>Any name and description. Under <b>Redirect URIs</b> add exactly <code id="spRedirect">{spRedirect()}</code>{' '}
              <button className="btn" id="spCopyRedirect" type="button" onClick={() => { const t = spRedirect(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('Redirect URI copied.')).catch(() => toast(t)); }}>Copy</button></li>
            <li>Tick <b>Web API</b> and <b>Web Playback SDK</b>, save, then copy the app's <b>Client ID</b> here.</li>
          </ol>
          <div className="findrow">
            <input id="spClient" ref={client} type="text" placeholder="Client ID" aria-label="Spotify Client ID" spellCheck={false} autoComplete="off" defaultValue={spClientId()} />
            <button className="btn" id="spClientSave" type="button" onClick={() => spSaveClient(client.current!.value)}>Save</button>
          </div>
        </details>
        <span className="label">Songs played in Spotify</span>
        <Chips id="followChips" items={[['on', 'Add them to my library'], ['off', 'Only follow my list']]} value={S.spFollowAll ? 'on' : 'off'} onPick={v => { S.spFollowAll = v === 'on'; }} />
        <span className="label">Visualizer</span>
        <Chips id="vizChips" items={VIZ} value={S.viz} onPick={v => { S.viz = v; }} />
        <span className="label">Sky</span>
        <div className="row" id="fxChips">
          {fx.map(([key, label]) => (
            <button key={key} type="button" className="chip" data-key={key} aria-pressed={String(!!S[key]) as 'true' | 'false'}
              onClick={() => { (S as unknown as Record<string, boolean>)[key] = !S[key]; save(); emit(); }}>{label}</button>
          ))}
        </div>
        <span className="label">Quality</span>
        <Chips id="qualChips" items={[['cine', 'Cinematic'], ['lite', 'Lite']]} value={S.quality} onPick={v => { S.quality = v; S.qualityAuto = false; S.qualityByApp = false; }} />
        <p className="hint" id="fpsNote">{app.fps ? `Running at ${app.fps} frames per second. ` : ''}{S.qualityByApp ? 'Stellar switched to Lite because the sky was running slowly on this computer. Choose Cinematic to switch back.' : S.qualityAuto ? 'Stellar switches to Lite by itself if this computer struggles.' : 'Automatic switching is off because you chose a quality.'}</p>
        <span className="label">Lyric letters</span>
        <Chips id="letterChips" items={[['orig', 'As written'], ['roman', 'English letters']]} value={S.roman ? 'roman' : 'orig'} onPick={v => setRoman(v === 'roman')} />
        <span className="label">Auto-sync to the audio</span>
        <Chips id="syncChips" items={[['on', 'On'], ['off', 'Off']]} value={S.autosync ? 'on' : 'off'} onPick={v => { S.autosync = v === 'on'; }} />
        <p className="hint" style={{ marginTop: 8 }}>Move the mouse to drift through the sky; hover a constellation to name it. Space plays and pauses, arrow keys skip 5 seconds, N and P change songs, F is full screen, L opens the playlist. Settings are remembered on this device.</p>
      </div>
    </div>
  );
}

export function Sheet() {
  useSignal(uiSignal);
  const which = app.sheet;
  return (
    <div className="sheet" id="sheet" hidden={!which} onClick={e => { if (e.target === e.currentTarget) close(); }}>
      <div className="card gutter" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
        <h2 id="sheetTitle">{(which || 'Lyrics') + ' '}<button className="btn" id="closeSheet" type="button" onClick={close}>Close</button></h2>
        <LyricsPanel show={which === 'Lyrics'} />
        <PlaylistPanel show={which === 'Playlist'} />
        <SettingsPanel show={which === 'Settings'} />
      </div>
    </div>
  );
}

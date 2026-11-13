import { useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Stage } from './components/Stage';
import { Dock } from './components/Dock';
import { Sheet } from './components/Sheet';
import { Toast } from './components/Toast';
import { app, emit, openSheet, toast } from './core/store';
import { bumpFonts } from './sky/canvas';
import { startLoop } from './sky/loop';
import { now, seek, togglePlay } from './audio/engine';
import { addDemos, enrich, nextTrack, nudge, prevTrack, selectTrack, toggleFullscreen } from './player/library';
import { restoreSongs, watchLibrary } from './player/persist';
import { spImport, spLoadMyPlaylists, spParseLink, spRestoreLib, spStart, isConnected } from './spotify/spotify';

let started = false;
async function boot() {
  if (started) return; started = true;
  spRestoreLib();
  const kept = await restoreSongs();
  if (kept.length) { app.tracks.push(...kept); enrich(kept); }
  addDemos(); void selectTrack(0, false); watchLibrary();
  if (kept.length) toast(`Welcome back: ${kept.length} song${kept.length === 1 ? '' : 's'} from your computer restored.`);
  void spStart();
  startLoop();
  if (document.fonts) {
    for (const f of ['40px "Space Grotesk"', '40px "Noto Sans Telugu"', '40px "Inter"']) document.fonts.load(f).then(bumpFonts).catch(() => {});
    void document.fonts.ready.then(bumpFonts);
  }
}

const typing = (t: EventTarget | null) => !!t && /^(TEXTAREA|INPUT)$/.test((t as HTMLElement).tagName);

export function App() {
  useEffect(() => {
    void boot();
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.key === 'ArrowRight') seek(now() + 5);
      else if (e.key === 'ArrowLeft') seek(now() - 5);
      else if (e.key === 'n') nextTrack();
      else if (e.key === 'p') prevTrack();
      else if (e.key === 'f') toggleFullscreen();
      else if (e.key === 'l') { openSheet('Playlist'); if (isConnected() && !app.sp.mine) void spLoadMyPlaylists(); }
      else if (e.key === 'Escape') { app.sheet = null; emit(); }
      else if (e.key === '[' || e.key === ']' || e.key === '{' || e.key === '}') nudge((e.key === '[' || e.key === '{' ? -1 : 1) * (e.shiftKey || e.key === '{' || e.key === '}' ? 1000 : 100));
    };
    // Paste a Spotify link anywhere on the page to import it.
    const onPaste = (e: ClipboardEvent) => {
      if (typing(e.target)) return;
      const t = e.clipboardData ? e.clipboardData.getData('text') : '';
      if (spParseLink(t)) { e.preventDefault(); void spImport(t); }
    };
    document.addEventListener('keydown', onKey); document.addEventListener('paste', onPaste);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('paste', onPaste); };
  }, []);

  return (
    <>
      <div className="app">
        <Header />
        <div className="body">
          <Sidebar />
          <Stage />
        </div>
        <Dock />
      </div>
      <Sheet />
      <Toast />
    </>
  );
}

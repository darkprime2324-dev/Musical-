import { useSyncExternalStore } from 'react';
import type { Line, LrclibRecord, Playlist, SheetName, SpotifyPlaylist, Track } from './types';

// The engine keeps its state in plain mutable objects (the canvas reads them 60 times a second).
// React components subscribe to small "signals" and re-render when the engine says something changed.
type Listener = () => void;
function signal() {
  let v = 0; const ls = new Set<Listener>();
  return {
    get: () => v,
    emit() { v++; ls.forEach(l => l()); },
    subscribe(l: Listener) { ls.add(l); return () => { ls.delete(l); }; },
  };
}
export type Signal = ReturnType<typeof signal>;
export const uiSignal = signal();      // library, panels, buttons, messages
export const lyricSignal = signal();   // the current line / word moved
export const useSignal = (s: Signal) => useSyncExternalStore(s.subscribe, s.get, s.get);
export const emit = () => uiSignal.emit();

export type SpStatus = '' | 'reading' | 'mix' | 'mixUnknown' | 'notYours';
export const app = {
  tracks: [] as Track[],
  lists: [] as Playlist[],     // your own playlists
  listId: null as string | null, // playlist shown in the sidebar and played in order; null = all songs
  cur: -1,
  lines: [] as Line[],
  buffer: null as AudioBuffer | null,
  playing: false,
  sheet: null as SheetName,
  lyricsDraft: '',
  query: { title: '', artist: '' },
  qResults: null as LrclibRecord[] | null,
  qState: 'idle' as 'idle' | 'searching' | 'none',
  syncPill: { text: '', ok: false },
  toast: '',
  lvTint: '',
  fps: 0,
  lyric: { idx: -1, wOn: 0, moved: false },
  tapSync: { active: false, words: false, list: [] as string[], i: 0, w: 0 },
  sp: { status: '' as SpStatus, mine: null as SpotifyPlaylist[] | 'loading' | 'none' | null, conn: 'Not connected', connected: false },
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  app.toast = msg; emit();
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { app.toast = ''; emit(); }, 3600);
}
export function setSyncPill(text: string, ok = false) { app.syncPill = { text, ok }; emit(); }
export function openSheet(which: SheetName) { app.sheet = which; emit(); }
export const curTrack = (): Track | undefined => app.tracks[app.cur];

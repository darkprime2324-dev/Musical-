import { app, emit, toast } from '../core/store';
import type { LyricsEntry, Meta, Playlist, SpotifyInfo, Track } from '../core/types';
import { download, lyricsList, mergeLyrics } from '../lyrics/store';
import { spSaveLib } from '../spotify/spotify';
import { isLocal, storeSongs } from './persist';
import { mergeLists, trackKey } from './playlists';

// A backup of your library in one small file: the song list, your playlists and your lyrics library.
// The audio stays in your music folder (it is big, and it is already on your computer). On another
// browser or computer, import the backup, then open the music folder: each song finds its file again.
// The file holds lyrics, so keep it private; do not commit it to the repository.
interface SongOut { key: string; title: string; artist: string; album: string; fileName?: string; size?: number; sp?: SpotifyInfo; cover?: string }
interface Backup { app: 'stellar'; version: 1; saved: string; songs: SongOut[]; playlists: Playlist[]; lyrics: LyricsEntry[] }

const metaOf = (t: Track): Meta => t.meta || { title: t.name, artist: t.artist, album: '' };
export function exportLibrary() {
  const songs: SongOut[] = [];
  for (const t of app.tracks) {
    const m = metaOf(t), base = { key: trackKey(t), title: m.title, artist: m.artist, album: m.album };
    if (isLocal(t)) songs.push({ ...base, fileName: t.file ? t.file.name : t.missing!.fileName, size: t.file ? t.file.size : t.missing!.size });
    else if (t.sp) songs.push({ ...base, sp: t.sp, cover: t.cover && /^https:/.test(t.cover) ? t.cover : undefined });
  }
  const b: Backup = { app: 'stellar', version: 1, saved: new Date().toISOString(), songs, playlists: app.lists, lyrics: lyricsList() };
  download(`stellar-library-${b.saved.slice(0, 10)}.json`, JSON.stringify(b, null, 1), 'application/json');
  toast(`Library saved: ${songs.length} songs, ${app.lists.length} playlists, ${b.lyrics.length} lyric sheets. Keep the file private; it holds lyrics.`);
}

export async function importLibrary(file: File) {
  let b: Backup;
  try { b = JSON.parse(await file.text()); if (b.app !== 'stellar' || !Array.isArray(b.songs)) throw new Error(); }
  catch { return toast('That is not a Stellar library file. Choose a stellar-library-....json saved from Library, Save a backup.'); }
  const have = new Set(app.tracks.map(trackKey)), waiting: Track[] = [];
  let sp = 0;
  for (const s of b.songs) {
    if (!s || !s.key || have.has(s.key)) continue;
    const meta = { title: String(s.title || ''), artist: String(s.artist || ''), album: String(s.album || '') }, base = { name: meta.title || s.fileName || 'Song', artist: meta.artist, lrc: '', buffer: null, meta };
    if (s.sp && s.sp.uri) { app.tracks.push({ ...base, sp: s.sp, cover: s.cover }); sp++; }
    else if (s.fileName && s.key.startsWith('id:')) { const t: Track = { ...base, id: s.key.slice(3), missing: { fileName: s.fileName, size: +(s.size || 0) } }; app.tracks.push(t); waiting.push(t); }
    have.add(s.key);
  }
  const lists = await mergeLists(b.playlists || []), lyr = await mergeLyrics(b.lyrics || []).catch(() => 0);
  if (sp) spSaveLib();
  void storeSongs(waiting); emit();
  toast(`Backup imported: ${waiting.length + sp} songs, ${lists} playlists, ${lyr} lyric sheets.` + (waiting.length ? ` Now open your music folder so the ${waiting.length} song${waiting.length === 1 ? '' : 's'} marked "file needed" find their files.` : ''));
}

// Songs in your library that have no audio here: files still to link, and songs that only play through Spotify.
export const waitingSongs = () => app.tracks.filter(t => t.missing || t.sp);
export function copyWaitingList() {
  const text = waitingSongs().map(t => { const m = metaOf(t); return [m.title, m.artist].filter(Boolean).join(' - ') + (t.missing ? `  (${t.missing.fileName})` : ''); }).join('\n');
  if (!text) return toast('Every song in your library has its own file.');
  const fallback = () => download('songs-to-find.txt', text);
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast('List copied: the songs that still need a file.')).catch(fallback); else fallback();
}

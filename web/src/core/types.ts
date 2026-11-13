export interface Word { t: number; end: number; text: string }
export interface Line { t: number; end: number; text: string; words: Word[] | null; wt?: { t: number; end: number }[] }

export interface DemoSpec {
  bpm: number; bars: number; prog: number[][]; roots: number[]; lead: 'square' | 'triangle'; cut: number; breaks: number[];
}
export interface Meta { title: string; artist: string; album: string }
export interface SpotifyInfo { uri: string; durationMs: number; album: string }

export interface Track {
  name: string;
  artist: string;
  lrc: string;
  buffer: AudioBuffer | null;
  spec?: DemoSpec;            // demo song synthesized in the browser
  url?: string;               // song published next to the page
  q?: Meta;                   // lookup hints for a built-in song
  file?: File;                // song added from this device
  cover?: string;             // object URL or Spotify image URL
  meta?: Meta;                // title / artist / album used for lyrics lookup
  sp?: SpotifyInfo;           // Spotify song (audio played by Spotify)
  loading?: boolean;
  synced?: boolean;           // timings already fitted, by auto-sync, tap-sync or a manual nudge
}

export interface Scene {
  label: string; bg: [string, string, string]; star: string; accent: string; accent2: string; lyr: string; grid?: boolean;
}

export type SheetName = 'Lyrics' | 'Playlist' | 'Settings' | null;
export type StyleId = 'auto' | 'constellation' | 'orbit' | 'comet' | 'supernova' | 'starmap' | 'eclipse' | 'nebula' | 'telemetry' | 'pulsar' | 'meteor' | 'signal';
export type SceneId = 'observatory' | 'nebula' | 'aurora' | 'lunar' | 'warp' | 'blackhole' | 'dome' | 'galaxy';

export interface LrclibRecord {
  id: number; trackName: string; artistName: string; albumName: string; duration: number;
  instrumental: boolean; plainLyrics: string | null; syncedLyrics: string | null;
}

export interface SpotifyImage { url: string; width?: number | null; height?: number | null }
export interface SpotifyTrack {
  name: string; uri: string; type?: string; is_local?: boolean; duration_ms: number;
  artists?: { name: string }[]; album?: { name: string; images?: SpotifyImage[] };
}
export interface SpotifyPlaylist {
  id: string; name: string; collaborative?: boolean; owner?: { id: string };
  images?: SpotifyImage[] | null; items?: { total?: number }; tracks?: { total?: number };
}

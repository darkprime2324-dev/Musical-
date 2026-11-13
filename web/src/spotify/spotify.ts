import { app, emit, openSheet, toast } from '../core/store';
import { S, save } from '../core/settings';
import type { SpotifyPlaylist, SpotifyTrack, Track } from '../core/types';
import { lsGet, lsSet } from '../core/util';
import { selectTrack } from '../player/library';

// Spotify: import playlists, play in the page (Premium) or follow playback in the Spotify app (any account).
// Official Web API with the PKCE login flow, so no secret lives in the page. Audio never passes through
// this page: Spotify plays it, the page reads the position and shows the lyrics.
const SP_SCOPES = 'streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private playlist-read-collaborative';
export const spRedirect = () => location.origin + location.pathname;

interface Auth { access: string; refresh: string; exp: number }
let spAuth: Auth | null = (() => { try { return JSON.parse(lsGet('stellar-sp-auth') || 'null') as Auth | null; } catch { return null; } })();
let spUser: { id: string; display_name?: string } | null = null;
interface SdkPlayer {
  connect(): Promise<boolean>; disconnect(): void; pause(): Promise<void>; resume(): Promise<void>; seek(ms: number): Promise<void>;
  getCurrentState(): Promise<SdkState | null>; addListener(ev: string, cb: (x: never) => void): void;
}
interface SdkTrack { uri: string; linked_from?: { uri: string | null } }
interface SdkState { position: number; paused: boolean; track_window: { current_track: SdkTrack } }
let spPlayer: SdkPlayer | null = null, spDevice: string | null = null, spSwitching = false, spLastPoll = 0, spFollowNoted = false;
let spState = { pos: 0, at: 0, paused: true, uri: '' };
const spTrack = (): Track | null => app.tracks[app.cur] && app.tracks[app.cur].sp ? app.tracks[app.cur] : null;
const b64url = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const isConnected = () => !!spAuth;

export function spParseLink(s: string) {
  const m = String(s || '').trim().match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(playlist|album|track)[/:]([A-Za-z0-9]{10,})/);
  return m ? { kind: m[1] as 'playlist' | 'album' | 'track', id: m[2] } : null;
}

export async function spLogin() {
  const id = lsGet('stellar-sp-client').trim();
  if (!id) { openSheet('Settings'); return toast('Paste your Spotify Client ID in Settings first (one-time setup).'); }
  if (window.top !== window.self) return toast('Spotify login cannot open inside this preview. Open your GitHub Pages site to connect Spotify.');
  if (!window.crypto || !crypto.subtle) return toast('Spotify login needs a secure page: open the player from your https GitHub Pages address.');
  const v = b64url(crypto.getRandomValues(new Uint8Array(48))), c = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
  lsSet('stellar-sp-verifier', v);
  const u = new URL('https://accounts.spotify.com/authorize');
  for (const [k, val] of Object.entries({ response_type: 'code', client_id: id, scope: SP_SCOPES, code_challenge_method: 'S256', code_challenge: c, redirect_uri: spRedirect() })) u.searchParams.set(k, val);
  try { location.assign(u.toString()); } catch { toast('This page cannot open the Spotify login. Use your GitHub Pages address instead.'); }
}
async function spTokenRequest(params: Record<string, string>) {
  const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) });
  const j = await r.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok) throw new Error(j.error_description || j.error || 'Spotify login failed');
  spAuth = { access: j.access_token!, refresh: j.refresh_token || spAuth?.refresh || '', exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000 };
  lsSet('stellar-sp-auth', JSON.stringify(spAuth));
}
export async function spStart() {
  const q = new URLSearchParams(location.search);
  if (q.has('code') || q.has('error')) {
    history.replaceState(null, '', spRedirect());
    if (q.has('error')) { toast(q.get('error') === 'access_denied' ? 'Spotify login was cancelled.' : 'Spotify login failed: ' + q.get('error')); return; }
    try { await spTokenRequest({ grant_type: 'authorization_code', code: q.get('code')!, redirect_uri: spRedirect(), client_id: lsGet('stellar-sp-client').trim(), code_verifier: lsGet('stellar-sp-verifier') }); lsSet('stellar-sp-verifier', ''); }
    catch (e) { toast((e as Error).message); return; }
    await spAfterLogin();
    const pending = lsGet('stellar-sp-pending'); lsSet('stellar-sp-pending', '');
    if (pending) void spImport(pending);
    return;
  }
  if (spAuth && !spUser) await spAfterLogin();
}
async function spToken() {
  if (!spAuth) throw new Error('not connected');
  if (Date.now() > spAuth.exp) await spTokenRequest({ grant_type: 'refresh_token', refresh_token: spAuth.refresh, client_id: lsGet('stellar-sp-client').trim() });
  return spAuth!.access;
}
class SpotifyError extends Error { constructor(msg: string, public status: number) { super(msg); } }
// Spotify limits how often an app may call it. When it answers 429 it says how long to wait (Retry-After);
// no request is sent before then, and the poller also slows down after repeated errors.
let backoffUntil = 0, pollFails = 0;
export const spWaitSeconds = () => Math.max(0, Math.ceil((backoffUntil - Date.now()) / 1000));
async function spApi<T>(path: string, opts: RequestInit = {}): Promise<T | null> {
  const url = path.startsWith('http') ? path : 'https://api.spotify.com/v1' + path;
  if (Date.now() < backoffUntil) throw new SpotifyError(`Spotify asked Stellar to slow down; try again in ${spWaitSeconds()} s.`, 429);
  const go = async () => fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + await spToken() } });
  let r = await go();
  if (r.status === 401 && spAuth && spAuth.refresh) { spAuth.exp = 0; r = await go(); }
  if (r.status === 429) { const ra = +(r.headers.get('Retry-After') || 0); backoffUntil = Date.now() + (ra > 0 ? ra : 5) * 1000; throw new SpotifyError(`Spotify asked Stellar to slow down; try again in ${spWaitSeconds()} s.`, 429); }
  if (r.status === 204 || r.status === 202) return null;
  const j = await r.json().catch(() => null) as (T & { error?: { message?: string } }) | null;
  if (!r.ok) throw new SpotifyError(j?.error?.message || ('Spotify answered ' + r.status), r.status);
  return j;
}
const status = (e: unknown) => (e as SpotifyError).status;

function paint() {
  app.sp.connected = !!spAuth;
  app.sp.conn = !spAuth ? 'Not connected' : !spUser ? 'Connecting' : `Connected as ${spUser.display_name || spUser.id}` + (spDevice ? ' · plays in this page' : ' · follows your Spotify app');
  emit();
}
export function spDisconnect() {
  spAuth = null; spUser = null; lsSet('stellar-sp-auth', '');
  if (spPlayer) { try { spPlayer.disconnect(); } catch { /* gone */ } spPlayer = null; spDevice = null; }
  app.sp.mine = null; paint(); toast('Disconnected from Spotify.');
}
async function spAfterLogin() {
  try { spUser = await spApi('/me'); }
  catch (e) {
    spUser = null;
    if (status(e) === 403) toast('Spotify refused the connection. Spotify developer apps now need the app owner to have Spotify Premium, and each person who uses it must be added under User Management (up to 5).');
    else toast('Spotify: ' + (e as Error).message);
    paint(); return;
  }
  paint(); void spLoadMyPlaylists();
  spInitPlayer().catch(() => { spPlayer = null; spDevice = null; paint(); });
}

function loadSdk(): Promise<void> {
  const w = window as unknown as { Spotify?: { Player: unknown }; onSpotifyWebPlaybackSDKReady?: () => void };
  return new Promise((res, rej) => {
    if (w.Spotify && w.Spotify.Player) return res();
    w.onSpotifyWebPlaybackSDKReady = res;
    const s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.onerror = () => rej(new Error('sdk')); document.head.appendChild(s);
  });
}
function spSetState(pos: number, paused: boolean, uri: string) {
  spState = { pos, at: performance.now(), paused, uri };
  const t = spTrack();
  if (t && t.sp!.uri === uri && app.playing !== !paused) { app.playing = !paused; emit(); }
  spFollow(uri);
}
const trackUri = (ct: SdkTrack) => (ct.linked_from && ct.linked_from.uri) || ct.uri;
async function spInitPlayer() {
  await loadSdk();
  const Player = (window as unknown as { Spotify: { Player: new (o: object) => SdkPlayer } }).Spotify.Player;
  const p = new Player({ name: 'Stellar lyric player', getOAuthToken: (cb: (t: string) => void) => { spToken().then(cb).catch(() => {}); }, volume: 0.8 });
  spPlayer = p;
  p.addListener('ready', (({ device_id }: { device_id: string }) => { spDevice = device_id; paint(); }) as (x: never) => void);
  p.addListener('not_ready', (() => { spDevice = null; paint(); }) as (x: never) => void);
  p.addListener('account_error', (() => { spPlayer = null; spDevice = null; paint(); }) as (x: never) => void);
  p.addListener('initialization_error', (() => { spPlayer = null; spDevice = null; paint(); }) as (x: never) => void);
  p.addListener('player_state_changed', ((st: SdkState | null) => { if (!st) return; spSetState(st.position / 1000, st.paused, trackUri(st.track_window.current_track)); }) as (x: never) => void);
  await p.connect();
}

export function spNow() {
  const t = spTrack(); if (!t || spState.uri !== t.sp!.uri) return 0;
  return Math.min(t.sp!.durationMs / 1000, spState.pos + (spState.paused ? 0 : (performance.now() - spState.at) / 1000));
}
function spFollowHint() {
  if (spFollowNoted) return; spFollowNoted = true;
  toast('Play, pause and skip in your Spotify app (phone or desktop). The lyrics here follow whatever Spotify is playing. Playing inside this page needs Spotify Premium.');
}
export async function spPlay() {
  const t = spTrack(); if (!t) return;
  if (!spAuth) { lsSet('stellar-sp-pending', ''); return spLogin(); }
  const same = spState.uri === t.sp!.uri, upNext = app.tracks.slice(app.cur).filter(x => x.sp).slice(0, 50).map(x => x.sp!.uri);
  const body = (b: object) => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  try {
    if (spDevice) {
      if (same && spPlayer) { await spPlayer.resume(); return; }
      await spApi('/me/player/play?device_id=' + encodeURIComponent(spDevice), body({ uris: upNext, position_ms: 0 }));
    } else await spApi('/me/player/play', body(same ? {} : { uris: upNext, position_ms: 0 }));
  } catch (e) {
    if (status(e) === 404) toast('Open Spotify on any device first, then press play again.');
    else if (status(e) === 403) spFollowHint(); else toast(status(e) === 429 ? (e as Error).message : 'Spotify: ' + (e as Error).message);
  }
}
export async function spPause() {
  if (spSwitching || !spTrack() || !spAuth) return;
  try { if (spPlayer && spDevice) await spPlayer.pause(); else await spApi('/me/player/pause', { method: 'PUT' }); }
  catch (e) { if (!spSwitching && (status(e) === 403 || status(e) === 404)) spFollowHint(); }
}
export async function spSeek(sec: number) {
  if (!spTrack() || !spAuth) return; const ms = Math.max(0, Math.round(sec * 1000));
  try { if (spPlayer && spDevice) await spPlayer.seek(ms); else await spApi('/me/player/seek?position_ms=' + ms, { method: 'PUT' }); spState.pos = ms / 1000; spState.at = performance.now(); }
  catch (e) { if (status(e) === 403 || status(e) === 404) spFollowHint(); }
}
// Follow mode: whatever Spotify plays (in this page or on any device) becomes the current song here.
function spFollow(uri: string) {
  const t = spTrack(); if (!uri || (t && t.sp!.uri === uri)) return;
  const i = app.tracks.findIndex(x => x.sp && x.sp.uri === uri); if (i < 0) return;
  spSwitching = true; try { void selectTrack(i, false); } finally { spSwitching = false; }
}
export const spCurrent = () => spState;
// How often to ask Spotify what is playing: every second while a Spotify song plays here,
// less often when idle, and backing off (up to 30 s) after errors.
function pollEvery() {
  if (spPlayer && spDevice) return 5000;
  const base = spTrack() ? (spState.paused ? 3000 : 1000) : (S.spFollowAll ? 4000 : 10000);
  return Math.min(30000, base * Math.pow(2, pollFails));
}
export async function spPoll() {
  if (!spAuth || document.hidden || Date.now() < backoffUntil || performance.now() - spLastPoll < pollEvery()) return;
  spLastPoll = performance.now();
  if (spPlayer && spDevice) {
    try { const st = await spPlayer.getCurrentState(); if (st) { spSetState(st.position / 1000, st.paused, trackUri(st.track_window.current_track)); return; } } catch { /* fall back to the API */ }
  }
  try {
    const p = await spApi<{ item: SpotifyTrack | null; progress_ms: number; is_playing: boolean; currently_playing_type: string }>('/me/player/currently-playing?additional_types=track');
    if (!p || !p.item || p.currently_playing_type !== 'track') { pollFails = 0; return; }
    pollFails = 0;
    if (!app.tracks.some(t => t.sp && t.sp.uri === p.item!.uri) && S.spFollowAll) { app.tracks.push(spMakeTrack(p.item)); spSaveLib(); emit(); }
    spSetState((p.progress_ms || 0) / 1000 + 0.15, !p.is_playing, p.item.uri);
  } catch (e) { if (status(e) !== 429) pollFails = Math.min(5, pollFails + 1); }
}

function spMakeTrack(t: SpotifyTrack): Track {
  const al = t.album || { name: '', images: [] }, img = (al.images || []).slice().sort((a, b) => Math.abs((a.width || 300) - 300) - Math.abs((b.width || 300) - 300))[0];
  const artist = (t.artists || []).map(a => a.name).join(', ');
  return { name: t.name, artist, lrc: '', buffer: null, cover: img ? img.url : '', sp: { uri: t.uri, durationMs: t.duration_ms, album: al.name || '' }, meta: { title: t.name, artist: t.artists?.[0]?.name || artist, album: al.name || '' } };
}
export function spSaveLib() { lsSet('stellar-sp-lib', JSON.stringify(app.tracks.filter(t => t.sp).map(t => ({ name: t.name, artist: t.artist, cover: t.cover, sp: t.sp, meta: t.meta })))); }
export function spRestoreLib() {
  try {
    const l = JSON.parse(lsGet('stellar-sp-lib') || '[]') as Track[];
    for (const x of l.reverse()) if (!app.tracks.some(t => t.sp && t.sp.uri === x.sp!.uri)) app.tracks.unshift({ ...x, lrc: '', buffer: null });
  } catch { /* nothing saved */ }
}

function nudgeFollow() { if (!S.spFollowAll) { S.spFollowAll = true; save(); } }
export async function spImport(link: string) {
  const ref = spParseLink(link);
  if (!ref) return toast('That does not look like a Spotify playlist, album or song link.');
  if (ref.kind === 'playlist' && /^37i9dQZ/.test(ref.id)) { app.sp.status = 'mix'; nudgeFollow(); emit(); return; }
  if (!spAuth) { lsSet('stellar-sp-pending', link); return spLogin(); }
  app.sp.status = 'reading'; emit();
  let items: SpotifyTrack[] = [], title = '';
  try {
    if (ref.kind === 'track') { const t = await spApi<SpotifyTrack>('/tracks/' + ref.id); if (t) { items = [t]; title = t.name; } }
    else if (ref.kind === 'album') {
      const a = await spApi<{ name: string; images: SpotifyTrack['album'] extends infer A ? A extends { images?: infer I } ? I : never : never; tracks: { items: SpotifyTrack[]; next: string | null } }>('/albums/' + ref.id);
      if (a) {
        title = a.name; let page: { items: SpotifyTrack[]; next: string | null } | null = a.tracks;
        while (page) { items.push(...page.items.map(t => ({ ...t, album: { name: a.name, images: a.images } }))); page = page.next ? await spApi(page.next) : null; }
      }
    } else {
      try { const meta = await spApi<{ name: string }>('/playlists/' + ref.id + '?fields=name'); title = meta?.name || 'Playlist'; } catch { title = 'Playlist'; }
      // Since February 2026 Spotify serves playlist contents from /items, and only for playlists the user owns or collaborates on.
      type Item = { is_local?: boolean; item?: SpotifyTrack; track?: SpotifyTrack };
      let page = await spApi<{ items: Item[]; next: string | null }>('/playlists/' + ref.id + '/items?limit=50&additional_types=track');
      while (page) {
        items.push(...(page.items || []).filter(x => x && !x.is_local).map(x => x.item || x.track).filter((t): t is SpotifyTrack => !!t && t.type === 'track' && !t.is_local && !!t.uri));
        page = page.next ? await spApi(page.next) : null;
      }
    }
  } catch (e) {
    app.sp.status = '';
    if (status(e) === 403 && ref.kind === 'playlist') { app.sp.status = 'notYours'; nudgeFollow(); emit(); return; }
    if (status(e) === 404) { app.sp.status = 'mixUnknown'; nudgeFollow(); emit(); return; }
    emit(); return toast(status(e) === 429 ? (e as Error).message : 'Spotify: ' + (e as Error).message);
  }
  const fresh: Track[] = [];
  for (const t of items) if (!app.tracks.some(x => x.sp && x.sp.uri === t.uri) && !fresh.some(x => x.sp!.uri === t.uri)) fresh.push(spMakeTrack(t));
  const added = fresh.length, at = app.tracks.filter(x => x.sp).length;
  app.tracks.splice(at, 0, ...fresh); if (app.cur >= at) app.cur += added;
  spSaveLib(); app.sp.status = ''; app.sheet = null; emit();
  toast(`${title}: ${added} song${added === 1 ? '' : 's'} added from Spotify. Lyrics load as each song plays.`);
  if (added) void selectTrack(at, false);
}

export async function spLoadMyPlaylists() {
  if (!spAuth) return;
  app.sp.mine = 'loading'; emit();
  const all: SpotifyPlaylist[] = [];
  try {
    let page = await spApi<{ items: SpotifyPlaylist[]; next: string | null }>('/me/playlists?limit=50');
    while (page && all.length < 300) { all.push(...(page.items || [])); page = page.next ? await spApi(page.next) : null; }
  } catch { app.sp.mine = null; emit(); return; }
  const mine = all.filter(pl => pl && (pl.collaborative || (pl.owner && spUser && pl.owner.id === spUser.id)));
  app.sp.mine = mine.length ? mine : 'none'; emit();
}

export const spClientId = () => lsGet('stellar-sp-client');
export function spSaveClient(v: string) {
  if (!/^[0-9a-f]{32}$/i.test(v.trim())) return toast('A Spotify Client ID is 32 letters and digits. Copy it from your app on developer.spotify.com.');
  lsSet('stellar-sp-client', v.trim()); toast('Client ID saved. Now connect Spotify.');
}
export const spHasUser = () => !!spUser;

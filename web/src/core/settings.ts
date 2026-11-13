import type { DemoSpec, Meta, Scene, SceneId, StyleId } from './types';

export const SCENES: Record<SceneId, Scene> = {
  observatory: { label: 'Observatory', bg: ['#000000', '#030207', '#07060d'], star: '#f3e9cf', accent: '#e9d8a6', accent2: '#bfae7e', lyr: '#f3e9cf', grid: true },
  nebula: { label: 'Nebula', bg: ['#03020c', '#0d0726', '#150a2a'], star: '#ffffff', accent: '#ff6fb5', accent2: '#5fe3ff', lyr: '#ffffff' },
  aurora: { label: 'Aurora', bg: ['#01050d', '#041224', '#071a30'], star: '#eaf6ff', accent: '#4dffb0', accent2: '#6ac8ff', lyr: '#eef8ff' },
  lunar: { label: 'Lunar', bg: ['#010103', '#06060c', '#0c0c16'], star: '#e8e8f0', accent: '#e4e6f5', accent2: '#8f95b8', lyr: '#f2f2fa' },
  warp: { label: 'Warp', bg: ['#000004', '#02021a', '#050530'], star: '#ffffff', accent: '#8c9bff', accent2: '#ff9bf5', lyr: '#ffffff' },
};

export const STYLES: [StyleId, string][] = [['auto', 'Auto mix'], ['constellation', 'Constellation'], ['orbit', 'Orbit'], ['comet', 'Comet'], ['supernova', 'Supernova'], ['starmap', 'Star map'], ['eclipse', 'Eclipse'], ['nebula', 'Nebula'], ['telemetry', 'Telemetry']];
export const CALM: StyleId[] = ['constellation', 'nebula', 'orbit', 'telemetry'];
export const HYPE: StyleId[] = ['comet', 'supernova', 'eclipse', 'starmap'];
export const VIZ: [string, string][] = [['orbits', 'Orbits'], ['horizon', 'Horizon'], ['wave', 'Waveform'], ['off', 'Off']];

// Constellations: local shapes (x right, y down), lines by index, named bright stars.
export interface Constellation { name: string; px: number; py: number; s: number; stars: [number, number, number, string?][]; lines: [number, number][] }
export const CONST: Constellation[] = [
  { name: 'Orion', px: 0.56, py: 0.62, s: 0.16, stars: [[0.30, 0.05, 1, 'Betelgeuse'], [0.0, 0.08, .8, 'Bellatrix'], [0.08, 0.42, .7, 'Mintaka'], [0.15, 0.45, .8, 'Alnilam'], [0.22, 0.48, .7, 'Alnitak'], [0.32, 0.85, .7, 'Saiph'], [0.02, 0.9, 1, 'Rigel'], [0.17, -0.12, .5]], lines: [[7, 0], [7, 1], [0, 4], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6]] },
  { name: 'Ursa Major', px: 0.2, py: 0.2, s: 0.2, stars: [[0, 0.05, .9, 'Dubhe'], [0.02, 0.3, .8, 'Merak'], [0.3, 0.33, .7], [0.28, 0.08, .6], [0.5, 0, .8, 'Alioth'], [0.68, -0.06, .8, 'Mizar'], [0.9, 0.02, .9, 'Alkaid']], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]] },
  { name: 'Cassiopeia', px: 0.72, py: 0.14, s: 0.15, stars: [[0, 0.2, .8, 'Caph'], [0.22, 0.4, .9, 'Schedar'], [0.45, 0.15, .8], [0.68, 0.35, .7, 'Ruchbah'], [0.9, 0.1, .6]], lines: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { name: 'Cygnus', px: 0.45, py: 0.3, s: 0.14, stars: [[0.5, 0, 1, 'Deneb'], [0.5, 0.4, .8, 'Sadr'], [0.95, 0.55, .7], [0.05, 0.3, .7], [0.52, 1.0, .6, 'Albireo']], lines: [[0, 1], [1, 2], [1, 3], [1, 4]] },
  { name: 'Lyra', px: 0.33, py: 0.44, s: 0.08, stars: [[0.3, 0, 1, 'Vega'], [0.25, 0.55, .6], [0.6, 0.62, .6], [0.42, 0.2, .5], [0.72, 0.28, .5]], lines: [[0, 3], [3, 1], [1, 2], [2, 4], [4, 3]] },
  { name: 'Scorpius', px: 0.82, py: 0.66, s: 0.14, stars: [[0, -0.1, .7], [0.05, 0.05, .7, 'Dschubba'], [0.02, 0.25, .6], [0.3, 0.3, 1, 'Antares'], [0.4, 0.48, .6], [0.5, 0.68, .6], [0.52, 0.9, .6], [0.62, 1.05, .6], [0.78, 1.08, .7], [0.92, 0.95, .8, 'Shaula'], [0.88, 0.86, .6]], lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]] },
  { name: 'Leo', px: 0.14, py: 0.62, s: 0.17, stars: [[0.1, 0.7, 1, 'Regulus'], [0.1, 0.45, .6], [0.15, 0.3, .8, 'Algieba'], [0.1, 0.15, .6], [0.22, 0.05, .6], [0.33, 0.1, .6], [0.65, 0.35, .7, 'Zosma'], [0.65, 0.6, .6], [1.0, 0.5, .8, 'Denebola']], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 8], [8, 7], [7, 0], [6, 7]] },
  { name: 'Crux', px: 0.6, py: 0.9, s: 0.07, stars: [[0.5, 0, .8], [0.5, 1, 1, 'Acrux'], [0, 0.55, .7], [1, 0.45, .8]], lines: [[0, 1], [2, 3]] },
];

// A song published next to the page; dropped quietly where the file is absent (e.g. GitHub Pages).
export const BUILTIN: { name: string; artist: string; url: string; lrc: string; q: Meta }[] = [
  { name: 'Yetu Pone', artist: 'Kaala Bhairava · Dear Comrade (2019)', url: 'songs/yetu-pone.mp3', lrc: '', q: { title: 'Yetu Pone', artist: 'Kaala Bhairava', album: 'Dear Comrade' } },
];

// Demo songs: music synthesized in the browser, lyrics written for this app.
const FAST: DemoSpec = { bpm: 120, bars: 24, prog: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], roots: [45, 41, 48, 43], lead: 'square', cut: 1400, breaks: [8, 9] };
const SLOW: DemoSpec = { bpm: 88, bars: 20, prog: [[62, 65, 69], [58, 62, 65], [53, 57, 60], [55, 59, 62]], roots: [38, 34, 41, 36], lead: 'triangle', cut: 900, breaks: [12, 13] };
export const DEMOS: { name: string; artist: string; spec: DemoSpec; lrc: string }[] = [
  { name: 'ఆకాశం (Aakasam)', artist: 'Stellar demo · Telugu', spec: FAST, lrc: `[00:02.00]<00:02.00>నక్షత్రాలు <00:03.00>మెరిసే <00:03.70>రాత్రి
[00:06.00]<00:06.00>నీ <00:06.30>కోసం <00:06.90>వెలిగే <00:07.60>దీపం
[00:10.00]చంద్రుడు నవ్వుతున్నాడు
[00:14.00]గాలిలో పాట వినిపిస్తోంది
[00:16.00]ఊపిరి బిగపట్టు...
[00:18.00]...ఇప్పుడు వదిలెయ్!
[00:20.00]ఎగిరిపో! ఎగిరిపో! ఆకాశం వైపు
[00:24.00]అలలపై తేలుతూ సముద్రం దాటి
[00:28.00]గట్టిగా పాడు, దాచుకోకు
[00:32.00]ఇక్కడే మన కలలు మొదలవుతాయి
[00:36.00]దారి చూపించు!
[00:40.00]తెల్లవారే వరకు ఆడు
[00:44.00]` },
  { name: 'వెన్నెల (Vennela)', artist: 'Stellar demo · Telugu', spec: SLOW, lrc: `[00:03.00]వెన్నెల కురిసే వేళ
[00:08.50]పూలు రాలే నిశ్శబ్దం
[00:14.00]పాత రాతిపై చంద్రకాంతి
[00:19.50]నేను ఒంటరిని కాదు ఎప్పుడూ
[00:25.00]
[00:27.70]కళ్ళు మూసుకో
[00:30.40]తారలను లెక్కపెట్టు
[00:33.10]ప్రతి కోరిక మనదే
[00:38.50]రాత్రంతా నిలబడు
[00:44.00]తెల్లవారు వెలుగు వచ్చేదాకా
[00:50.00]` },
  { name: 'Neon Sky', artist: 'Stellar demo', spec: FAST, lrc: `[00:02.00]<00:02.00>Turn <00:02.35>the <00:02.65>city <00:03.20>lights <00:03.80>up <00:04.20>high
[00:06.00]<00:06.00>Paint <00:06.40>the <00:06.70>night <00:07.20>in <00:07.60>neon <00:08.20>sky
[00:10.00]Every beat, a falling star
[00:14.00]I can hear you from afar
[00:16.00]Hold your breath...
[00:18.00]...and let it go!
[00:20.00]Jump! Jump! Hearts in motion
[00:24.00]Riding waves across the ocean
[00:28.00]Sing it loud, don't hold it in
[00:32.00]This is where our dreams begin
[00:36.00]Light the way!
[00:40.00]Dance until the break of day
[00:44.00]` },
  { name: 'Moonlit Shrine', artist: 'Stellar demo', spec: SLOW, lrc: `[00:03.00]Lanterns drift on quiet air
[00:08.50]Petals fall like whispered prayer
[00:14.00]Moonlight on the shrine's old stone
[00:19.50]I was never here alone
[00:25.00]
[00:27.70]Close your eyes
[00:30.40]Count the stars
[00:33.10]Every wish is ours
[00:38.50]Hold on through the night
[00:44.00]Till the morning paints it white
[00:50.00]` },
];

export interface Settings {
  style: StyleId; scene: SceneId; viz: string; cam: boolean; intro: boolean; names: boolean; lines: boolean;
  parts: 'high' | 'low'; quality: 'cine' | 'lite'; roman: boolean; autosync: boolean; spFollowAll: boolean;
  view: 'list' | 'sky'; viewVer?: number;
}
export const S: Settings = {
  style: 'auto', scene: 'observatory', viz: 'orbits', cam: true, intro: true, names: true, lines: true,
  parts: 'high', quality: 'cine', roman: false, autosync: true, spFollowAll: true, view: 'list',
};
try { Object.assign(S, JSON.parse(localStorage.getItem('stellar-lyrics') || '{}')); } catch { /* first visit */ }
if (!SCENES[S.scene]) S.scene = 'observatory';
if (S.viewVer !== 2) { S.view = 'list'; S.roman = true; S.viewVer = 2; }
export const save = () => { try { localStorage.setItem('stellar-lyrics', JSON.stringify(S)); } catch { /* storage unavailable */ } };
export const PAL = () => SCENES[S.scene];
export const CINE = () => S.quality === 'cine';

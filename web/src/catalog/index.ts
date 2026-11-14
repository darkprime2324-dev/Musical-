import type { Credit, Meta } from '../core/types';
import { LYRICS } from './lyrics';

// Free music built into Stellar, so the library is never empty. Every recording here is in the public
// domain (made before 1925, so its US copyright has expired) and is streamed from Wikimedia Commons,
// which allows any page to play it. The songs themselves are public domain too, so their lyrics can ship
// with the app. Lyrics were timed to these exact recordings with speech recognition (tools/align.py).
//
// Adding a song: it must be public domain or CC0/CC BY (recording AND words), hosted on Commons, with
// its file page linked in `page`. Never add lyrics that are still under copyright.
export interface CatalogSong { name: string; artist: string; url: string; alt: string; q: Meta; credit: Credit; lrc: string }

const C = 'https://upload.wikimedia.org/wikipedia/commons/';
const mp3 = (path: string) => `${C}transcoded/${path}/${path.split('/').pop()}.mp3`;

export const CATALOG: CatalogSong[] = [
  {
    name: 'Shine On, Harvest Moon', artist: 'Ada Jones & Billy Murray · 1909',
    url: mp3('6/6a/Ada_Jones_and_Billy_Murray_-_Shine_On%2C_Harvest_Moon.ogg'), alt: C + '6/6a/Ada_Jones_and_Billy_Murray_-_Shine_On%2C_Harvest_Moon.ogg',
    q: { title: 'Shine On, Harvest Moon', artist: 'Ada Jones & Billy Murray', album: '' },
    credit: { performer: 'Ada Jones and Billy Murray', year: '1909', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:Ada_Jones_and_Billy_Murray_-_Shine_On,_Harvest_Moon.ogg', lyrics: 'Jack Norworth & Nora Bayes, 1908 (public domain)' },
    lrc: LYRICS.harvest,
  },
  {
    name: 'Take Me Out to the Ball Game', artist: 'Edward Meeker · 1908',
    url: mp3('c/cd/MeekerBallGame.ogg'), alt: C + 'c/cd/MeekerBallGame.ogg',
    q: { title: 'Take Me Out to the Ball Game', artist: 'Edward Meeker', album: '' },
    credit: { performer: 'Edward Meeker', year: '1908', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:MeekerBallGame.ogg', lyrics: 'Jack Norworth, 1908 (public domain)' },
    lrc: LYRICS.ballgame,
  },
  {
    name: 'In the Good Old Summertime', artist: "John Philip Sousa's Band · 1905",
    url: mp3('b/b4/In_The_Good_Old_Summertime.ogg'), alt: C + 'b/b4/In_The_Good_Old_Summertime.ogg',
    q: { title: 'In the Good Old Summertime', artist: "John Philip Sousa's Band", album: '' },
    credit: { performer: "John Philip Sousa's Band", year: '1905', license: 'Public domain', page: 'https://commons.wikimedia.org/wiki/File:In_The_Good_Old_Summertime.ogg', lyrics: 'none, instrumental' },
    lrc: '[00:01.00]♪ Instrumental · the sky follows the band ♪',
  },
];

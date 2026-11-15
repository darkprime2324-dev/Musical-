import type { Credit, Meta } from '../core/types';
import { LYRICS } from './lyrics';

// Free music built into Stellar, so the library is never empty. Everything is streamed from Wikimedia
// Commons (which lets any page play and analyse it) and is free to use:
//   sing-along  public-domain recordings (before 1925) of public-domain songs, so their words can ship
//               here, timed to each recording word by word with speech recognition (tools/fit_lyrics.py)
//   ragtime     ragtime and marches: Scott Joplin's own piano roll and United States Marine Band
//               recordings (works of the US government are public domain)
//   classical   Musopen recordings, released into the public domain / CC0
//
// Adding a song: the recording AND the words must be public domain, CC0 or CC BY, hosted on Commons,
// with the licence copied from its file page. Never add lyrics that are still under copyright.
export type Group = 'sing' | 'ragtime' | 'classical';
export interface CatalogSong { name: string; artist: string; url: string; alt: string; q: Meta; credit: Credit; lrc: string; group: Group }
export const GROUPS: { id: Group; name: string }[] = [
  { id: 'sing', name: 'Sing-along' }, { id: 'ragtime', name: 'Ragtime & marches' }, { id: 'classical', name: 'Classical' },
];

const C = 'https://upload.wikimedia.org/wikipedia/commons/';
// A Commons file: its MP3 version first (plays in every browser), the original as the fallback.
function wm(dir: string, file: string) {
  const f = encodeURIComponent(file.replace(/ /g, '_')), orig = `${C}${dir}/${f}`;
  return { url: /\.mp3$/i.test(file) ? orig : `${C}transcoded/${dir}/${f}/${f}.mp3`, alt: orig, page: 'https://commons.wikimedia.org/wiki/File:' + f };
}
function sing(name: string, performer: string, year: string, lyrics: string, dir: string, file: string, lrc: string): CatalogSong {
  const w = wm(dir, file);
  return { name, artist: `${performer} · ${year}`, url: w.url, alt: w.alt, group: 'sing', lrc,
    q: { title: name, artist: performer, album: '' }, credit: { performer, year, license: 'Public domain', page: w.page, lyrics } };
}
function inst(group: Group, name: string, composer: string, performer: string, year: string, license: string, dir: string, file: string): CatalogSong {
  const w = wm(dir, file);
  return { name, artist: `${composer} · ${performer}`, url: w.url, alt: w.alt, group, lrc: `[00:01.00]♪ ${name} · ${composer} ♪`,
    q: { title: name, artist: composer, album: '' }, credit: { performer, year, license, page: w.page, lyrics: 'none, instrumental' } };
}

export const CATALOG: CatalogSong[] = [
  sing('Shine On, Harvest Moon', 'Ada Jones & Billy Murray', '1909', 'Jack Norworth & Nora Bayes, 1908 (public domain)', '6/6a', 'Ada Jones and Billy Murray - Shine On, Harvest Moon.ogg', LYRICS.harvest),
  sing('Take Me Out to the Ball Game', 'Edward Meeker', '1908', 'Jack Norworth, 1908 (public domain)', 'c/cd', 'MeekerBallGame.ogg', LYRICS.ballgame),
  inst('ragtime', 'In the Good Old Summertime', 'Ren Shields & George Evans', "John Philip Sousa's Band", '1905', 'Public domain', 'b/b4', 'In The Good Old Summertime.ogg'),
  inst("ragtime", "Maple Leaf Rag", "Scott Joplin", "Scott Joplin (piano roll)", "1916", "Public domain", "d/db", "Maple leaf rag - played by Scott Joplin 1916 V2.ogg"),
  inst("ragtime", "The Entertainer", "Scott Joplin", "James Brigham (piano)", "2018", "Public domain", "b/bd", "\"The Entertainer\" (1902), by Scott Joplin.mp3"),
  inst("ragtime", "Sunflower Slow Drag", "Scott Joplin & Scott Hayden", "United States Marine Band", "", "Public domain", "3/3d", "Scott Joplin's \"Sunflower Slow Drag\" performed by the United States Marine Band.oga"),
  inst("ragtime", "The Stars and Stripes Forever", "John Philip Sousa", "United States Marine Band", "2017", "Public domain", "e/ed", "Sousa's \"The Stars and Stripes Forever\" - United States Marine Band (2017).mp3"),
  inst("ragtime", "El Capitan", "John Philip Sousa", "United States Marine Band", "2010", "CC BY 3.0", "c/c5", "El Capitan - United States Marine Band.ogg"),
  inst("ragtime", "American Patrol", "Frank W. Meacham", "United States Marine Band", "2018", "Public domain", "8/85", "American Patrol Meacham United States Marine Band.ogg"),
  inst("ragtime", "The Glory of the Yankee Navy", "John Philip Sousa", "United States Marine Band", "1978", "Public domain", "6/63", "John Philip Sousa's \"The Glory of the Yankee Navy\" performed by the United States Marine Band in June 1978.oga"),
  inst("ragtime", "Rhapsody in Blue", "George Gershwin", "United States Marine Band, Bramwell Tovey (piano)", "2018", "Public domain", "c/cd", "US Marine Band Rhapsody in Blue.oga"),
  inst("classical", "In the Hall of the Mountain King", "Edvard Grieg", "Musopen Symphony Orchestra", "2012", "Public domain", "b/bb", "Musopen - In the Hall Of The Mountain King.ogg"),
  inst("classical", "Morning Mood", "Edvard Grieg", "Musopen Symphony Orchestra", "2012", "Public domain", "1/1a", "Musopen - Morning.ogg"),
  inst("classical", "Goldberg Variations: Aria", "J. S. Bach", "Musopen", "", "CC0", "a/af", "Bach, Goldberg Variations, Aria (Musopen version).ogg"),
  inst("classical", "The Marriage of Figaro: Overture", "W. A. Mozart", "Musopen Symphony Orchestra", "2012", "Public domain", "d/d2", "Mozart - Le nozze di Figaro, K492 - Overture (Musopen Symphony).flac"),
  inst("classical", "Symphony No. 40: Molto allegro", "W. A. Mozart", "Musopen Symphony Orchestra", "2012", "Public domain", "a/a8", "Mozart - Symphony No. 40 in G minor, K550 - I. Molto allegro (Musopen Symphony).flac"),
  inst("classical", "Vltava (The Moldau)", "Bed\u0159ich Smetana", "Musopen Symphony Orchestra", "2012", "Public domain", "3/39", "Smetana - M\u00e1 Vlast - Vltava (Musopen Symphony).flac"),
];

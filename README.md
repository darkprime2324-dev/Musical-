# Musical

Music projects, lyrics and the **Stellar** lyric player.

## Stellar: a planetarium lyric player

`app/musical-stage.html` is a single-file web app. Open it in a browser (Chrome, Edge, Firefox or Safari), add a song and its lyrics, and the words are animated across a night sky of real constellations, the Milky Way, tonight's moon phase, nebulae and auroras, all reacting to the music.

- **Free music built in**: 17 free-to-use pieces ready the moment the page opens: sing-along songs with word-synced lyrics, ragtime and marches, and classical, in ready-made playlists (see [Built-in music](#built-in-music-free-to-use)).
- **Your own music library, no account needed**: your songs, your playlists and your lyrics library live in your browser. Spotify is optional (see [Your own library](#your-own-library-no-spotify-needed)).
- **Spotify-style player**: a library sidebar with cover art read from your MP3s, and a Lyrics view where the whole song scrolls by itself, the current line lights up word by word, and clicking any line jumps the song there. The background takes its colour from the cover.
- **English letters** for Telugu and Hindi lyrics, on by default (toggle in the bottom bar).
- **Sky view** with eleven animated lyric styles. Pulsar, Meteor and Signal are timed to each word: a shock ring, a meteor strike or a spike on an oscilloscope trace lands the instant the word is sung. Also Constellation, Orbit, Comet, Supernova, Star map, Eclipse, Nebula, Telemetry.
- **Word timing**: when lyrics only time each line, words are timed by syllables ("lights" one beat, "neon" two, Telugu and Hindi included), so word-by-word effects follow the singing.
- **Skies**: Observatory, Nebula, Aurora, Lunar, Warp, Black hole (accretion disk, photon ring, lensed stars), Planetarium (a turning dome sky with projector and seats), Galaxy flythrough.
- **Lyrics**: fetched per song from LRCLIB and auto-synced to your recording; or paste plain text, `.lrc` with `[mm:ss.xx]` line times, or `<mm:ss.xx>` word times. Tap-to-sync times lyrics by hand.
- **Languages**: Telugu and other Indic scripts render with proper conjuncts (Noto Sans Telugu is loaded from Google Fonts).
- Two Telugu and two English demo songs are generated in the browser, so it works before you add anything.

Run it locally by opening the file, or serve the folder:

```bash
python3 -m http.server 8000
```

then open `http://localhost:8000/app/musical-stage.html`.

## Developing (Vite + React + TypeScript)

The player's source lives in `web/`. `app/musical-stage.html` is the **built output** (one self-contained HTML file, which is what GitHub Pages serves), so edit the source, not that file.

```bash
cd web
npm install
npm run dev        # live-reloading dev server
npm run build      # typecheck, then write ../app/musical-stage.html
```

Commit the rebuilt `app/musical-stage.html` with your source changes so the site updates.

| Folder | What's in it |
| --- | --- |
| `web/src/components/` | React interface: header, library sidebar, stage, lyrics view, bottom bar, panels |
| `web/src/sky/` | Canvas renderer: skies, constellations, the eight lyric styles, bloom and grain, frame loop |
| `web/src/audio/` | Web Audio playback, beat and drop detection, the synthesized demo songs |
| `web/src/lyrics/` | LRC parsing, English letters for Telugu and Hindi, MP3 tags, LRCLIB lookup, auto-sync, the lyrics library |
| `web/src/spotify/` | Spotify login (PKCE), playlist import, in-page player, follow mode |
| `web/src/player/` | The library: selecting songs, folders, tap-to-sync, nudging, playlists, backup, keeping songs in the browser |
| `web/src/catalog/` | The built-in public-domain songs and their timed lyrics |
| `web/src/core/` | Settings, shared state, types, helpers |

The engine keeps its state in plain objects that the canvas reads every frame; React components subscribe to small signals and re-render when the engine reports a change.

## Built-in music (free to use)

Stellar opens with 17 pieces already in the library, so there is always something to play. The chips under *Your library* (*Sing-along*, *Ragtime & marches*, *Classical*) are ready-made playlists of them; they can't be renamed or deleted, and your own playlists work alongside them.

| Playlist | Piece | Performer | Licence |
| --- | --- | --- | --- |
| Sing-along | Shine On, Harvest Moon | Ada Jones & Billy Murray, 1909 | Public domain; word-synced lyrics, with the recording's spoken scene |
| Sing-along | Take Me Out to the Ball Game | Edward Meeker, 1908 | Public domain; word-synced lyrics, with the Edison announcement |
| Ragtime & marches | In the Good Old Summertime | John Philip Sousa's Band, 1905 | Public domain |
| Ragtime & marches | Maple Leaf Rag | Scott Joplin's own piano roll, 1916 | Public domain |
| Ragtime & marches | The Entertainer | James Brigham, 2018 | Public domain |
| Ragtime & marches | Sunflower Slow Drag | United States Marine Band | Public domain |
| Ragtime & marches | The Stars and Stripes Forever | United States Marine Band, 2017 | Public domain |
| Ragtime & marches | El Capitan | United States Marine Band, 2010 | CC BY 3.0 |
| Ragtime & marches | American Patrol | United States Marine Band, 2018 | Public domain |
| Ragtime & marches | The Glory of the Yankee Navy | United States Marine Band, 1978 | Public domain |
| Ragtime & marches | Rhapsody in Blue | United States Marine Band, Bramwell Tovey (piano), 2018 | Public domain |
| Classical | In the Hall of the Mountain King · Morning Mood (Grieg) | Musopen Symphony Orchestra, 2012 | Public domain |
| Classical | Goldberg Variations: Aria (Bach) | Musopen | CC0 |
| Classical | The Marriage of Figaro: Overture · Symphony No. 40: Molto allegro (Mozart) | Musopen Symphony Orchestra, 2012 | Public domain |
| Classical | Vltava (Smetana) | Musopen Symphony Orchestra, 2012 | Public domain |

- **Free to use**: every recording is public domain, CC0 or CC BY, as stated on its Wikimedia Commons page. United States Marine Band recordings are works of the US government, so they are public domain. The sing-along songs and their words are from before 1925, which is why their lyrics can ship in this repository (`web/src/catalog/lyrics.ts`); no copyrighted lyrics are added.
- **Streamed, not stored**: the audio plays straight from Wikimedia Commons (MP3 first so every browser can play it, the original file as a fallback). It needs an internet connection and adds nothing to the repository. Beat-reactive visuals work because Commons allows any page to read the audio. Each piece shows its performer and licence under the lyrics.
- **Word-synced**: the sing-along lyrics were timed to these exact recordings with speech recognition, word by word (`tools/fit_lyrics.py`). The recordings include their original spoken parts, like the Edison announcement and the 1909 comedy dialogue, and the lyrics show those too.
- **Adding a piece**: the recording (and the words, for a song) must be public domain, CC0 or CC BY, and hosted on Commons; copy the licence from its file page into `web/src/catalog/index.ts`. Time a song's words with `python3 tools/fit_lyrics.py song.ogg words.txt -o song.lrc` and check the per-line report. Very old wax cylinders (1890s) are usually too noisy to time automatically; the report shows that.

## Your own library (no Spotify needed)

Spotify limits what apps can do: the app owner needs Premium, only your own playlists can be read, and its audio can't drive the visuals. Stellar's own library has none of those limits. Everything below works with no account and keeps working offline.

- **Songs**: add files or open a whole music folder. They are kept in the browser (IndexedDB), with full beat-reactive visuals and auto-sync.
- **Playlists**: the chips under *Your library* switch between *All songs* and your playlists; **+** makes a new one. Each song's **⋯** button adds it to a playlist, or moves it up and down inside one. On a phone, use Library (the list button, or `L`): choose a playlist, rename or delete it, and add songs with *Add to...*. Previous, next and auto-advance play in the order of the playlist on show.
- **Lyrics library**: every song's lyrics are kept by title and artist: found on LRCLIB, opened from a `.lrc` file, pasted, written by you, tap-synced or nudged. Any copy of the same song (another rip, a Spotify entry, the same file on another computer) finds them again without going online. Library -> *Lyrics library* lets you search, open, download as `.lrc` or delete them. A sheet's timing fixes only carry over to a recording of the same length; otherwise auto-sync fits it again.
- **Replace Spotify songs with your files**: songs imported from Spotify show as *Spotify* in the list. Open your music folder, and every file whose title and artist match (from its tags, or a file name like `Artist - Title.mp3`) takes that song's place. It keeps the lyrics and playlist spots, and plays from the file from then on. Library -> *Songs without a file here* -> *Copy the list of songs to find* gives you what's still missing.
- **Backup and other computers**: Library -> *Save a backup* writes `stellar-library-YYYY-MM-DD.json` with your song list, playlists and lyrics library (no audio). On another browser, *Import a backup*: songs show as *File needed* until you open the music folder, and then each one finds its file by name and size. The backup holds lyrics, so keep it private; `.gitignore` keeps `stellar-library-*.json` out of this repository.

## Spotify playlists (optional)

To leave Spotify, import your playlists once (below), then open your music folder as described above.


Paste a Spotify playlist, album or song link (Library -> *Spotify (optional)* -> *Add from Spotify*, or just paste anywhere on the page). Stellar reads the song list through Spotify's official Web API, shows the album covers, and loads each song's synced lyrics from LRCLIB, matched to the exact Spotify release by length.

- **Spotify Premium**: songs play inside the Stellar page (Spotify Web Playback SDK).
- **Any account**: play on your phone or the Spotify app; Stellar follows whatever Spotify is playing, switches songs with it and keeps the lyrics in time. It checks once a second while a Spotify song plays, less often when idle, and waits as long as Spotify asks whenever it says to slow down. Songs you play that aren't in your list are added automatically (Settings -> *Songs played in Spotify*).
- Spotify's audio can't be read by other apps, so the beat-reactive visuals and audio auto-sync apply to your own files only. `[` and `]` still nudge the lyrics.

**One-time setup (2 minutes)**
1. Open [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), log in with your Spotify account, choose **Create app**.
2. Under **Redirect URIs** add exactly `https://darkprime2324-dev.github.io/Musical-/app/musical-stage.html`.
3. Tick **Web API** and **Web Playback SDK**, save, and copy the **Client ID**.
4. In Stellar: Settings -> Spotify -> *One-time setup* -> paste the Client ID -> Save -> **Connect Spotify**.

**Spotify's rules for apps (since February 2026)**
- The person who created the Spotify app (step 1) needs **Spotify Premium**, or Spotify switches the app off. Up to 5 people can use it; add them under *User Management*.
- Apps can only read **playlists you own or collaborate on**. After connecting, Library -> *Spotify (optional)* lists them under *Your playlists*. For anyone else's playlist or a Spotify-made mix, either play it in Spotify and let Stellar follow, or save a copy (open it, Ctrl+A, right-click, Add to playlist, New playlist).
- Playing inside the page needs Premium; otherwise control playback from your Spotify app and the lyrics follow.
- The login uses PKCE, so there is no secret in the page. It does not work inside the claude.ai preview; use the GitHub Pages site.

## Lyrics library and perfect sync

Stellar never ships lyrics with the app. It gets them, per song, from **[LRCLIB](https://lrclib.net)**, a free and open database of time-synced lyrics that covers Telugu, Hindi, English and many other languages, and then fits them to your exact recording.

### Why lyrics drift, and how auto-sync fixes it

The same song exists in many versions: different rips, trims, intros and encoders. Lyrics timed against one version start early or late on another, usually by a fixed amount (Yetu Pone from a common MP3 site starts 1.09 s earlier than the release LRCLIB was timed on).

**Auto-sync** measures that shift from the audio itself: it filters the song to the vocal range, follows its loudness in 150 ms windows to find where the singing comes in, and slides the whole lyric sheet (up to 8 s either way) to the position where line starts land on vocal entries. It applies the shift only when that position clearly beats every other candidate; an unclear match leaves the timings alone, so it never makes them worse. Tested on Yetu Pone: it recovers deliberate 3 s and 6 s errors exactly, leaves already-correct lyrics unchanged, and refuses another song's timings.

### In the player

- **Add songs or open a whole folder.** A `.lrc` file with the same name as a song is used as its lyrics; songs without one are looked up on LRCLIB automatically (title and artist come from the file's tags).
- Lyrics are auto-synced to the recording when they arrive, and remembered in your browser.
- **Your songs stay.** Songs added from your computer are kept in the browser's own storage (IndexedDB) with their lyrics, timing fixes and covers, so the library is still there after a reload or restart. *Remove* deletes a song from storage too. Each browser keeps its own copy, and clearing the browser's site data clears it.
- **Smooth on any laptop.** If the sky runs below about 38 frames per second in Cinematic quality, Stellar switches to Lite once and says so; choosing a quality yourself turns this off. Settings shows the current frame rate.
- **Lyrics -> Find lyrics online** lists the matches with their length, so you can pick the version that fits your file.
- **Settings -> Lyric letters -> English letters** shows Telugu and Hindi lyrics in English letters (Aakaasham, Main ghar jaa rahaa hoon).
- Still off? `[` and `]` nudge by 0.1 s, `{` and `}` by 1 s. *Sync every word* lets you tap each word for true karaoke timing.

Online lookup works when you open the player from your computer (double-click `app/musical-stage.html`, or serve the folder). Inside the claude.ai preview the sandbox blocks outside sites; paste lyrics there instead.

### Build a lyrics library for a music folder

```bash
pip install numpy
python3 tools/lyrics_library.py ~/Music/Telugu
```

It needs `ffmpeg` installed. For each song it looks up LRCLIB, auto-syncs the lyrics with the same method as the player, and writes `<song>.lrc` next to it:

```
+  Yetu_Pone_-_SenSongsMp3.Co.mp3: Yetu Pone - Kaala Bhairava (timed, auto-synced -1.09 s)
```

Then open the folder in the player. `--force` redoes existing files, `--no-sync` keeps LRCLIB's timings as they are. Songs LRCLIB doesn't have can be timed with tap-to-sync, or with `tools/align.py` (speech recognition; `pip install faster-whisper`), and contributed back to LRCLIB so everyone gets them.

## Folders

| Folder | What goes in it |
| --- | --- |
| `app/` | The Stellar player |
| `projects/` | DAW session files (Ableton, FL Studio, Logic, Reaper, ...) |
| `stems/` | Exported stems and multitracks |
| `exports/` | Finished mixes and masters |
| `samples/` | Samples, loops and one-shots |
| `lyrics/` | Your own lyrics and `.lrc` files |
| `tools/` | `lyrics_library.py` (folder lyrics + auto-sync), `align.py` (speech-recognition timing), `fit_lyrics.py` (word timing for known lyrics) |
| `artwork/` | Cover art and visuals |

## Large files

Audio is stored with [Git LFS](https://git-lfs.com). Set it up once per machine:

```bash
git lfs install
```

`.wav`, `.mp3`, `.flac` and other audio files are then tracked by LFS automatically (see `.gitattributes`).

## Naming

`YYYY-MM-DD_song-name_v01.wav`, for example `2026-11-13_night-drive_v03.wav`.

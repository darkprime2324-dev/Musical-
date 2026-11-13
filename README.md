# Musical

Music projects, lyrics and the **Stellar** lyric player.

## Stellar: a planetarium lyric player

`app/musical-stage.html` is a single-file web app. Open it in a browser (Chrome, Edge, Firefox or Safari), add a song and its lyrics, and the words are animated across a night sky of real constellations, the Milky Way, tonight's moon phase, nebulae and auroras, all reacting to the music.

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
| `web/src/lyrics/` | LRC parsing, English letters for Telugu and Hindi, MP3 tags, LRCLIB lookup, auto-sync |
| `web/src/spotify/` | Spotify login (PKCE), playlist import, in-page player, follow mode |
| `web/src/player/` | The library: selecting songs, folders, tap-to-sync, nudging |
| `web/src/core/` | Settings, shared state, types, helpers |

The engine keeps its state in plain objects that the canvas reads every frame; React components subscribe to small signals and re-render when the engine reports a change.

## Spotify playlists

Paste a Spotify playlist, album or song link (Playlist -> *Add from Spotify*, or just paste anywhere on the page). Stellar reads the song list through Spotify's official Web API, shows the album covers, and loads each song's synced lyrics from LRCLIB, matched to the exact Spotify release by length.

- **Spotify Premium**: songs play inside the Stellar page (Spotify Web Playback SDK).
- **Any account**: play on your phone or the Spotify app; Stellar follows whatever Spotify is playing, switches songs with it and keeps the lyrics in time. Songs you play that aren't in your list are added automatically (Settings -> *Songs played in Spotify*).
- Spotify's audio can't be read by other apps, so the beat-reactive visuals and audio auto-sync apply to your own files only. `[` and `]` still nudge the lyrics.

**One-time setup (2 minutes)**
1. Open [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), log in with your Spotify account, choose **Create app**.
2. Under **Redirect URIs** add exactly `https://darkprime2324-dev.github.io/Musical-/app/musical-stage.html`.
3. Tick **Web API** and **Web Playback SDK**, save, and copy the **Client ID**.
4. In Stellar: Settings -> Spotify -> *One-time setup* -> paste the Client ID -> Save -> **Connect Spotify**.

**Spotify's rules for apps (since February 2026)**
- The person who created the Spotify app (step 1) needs **Spotify Premium**, or Spotify switches the app off. Up to 5 people can use it; add them under *User Management*.
- Apps can only read **playlists you own or collaborate on**. After connecting, the Playlist panel lists them under *Your playlists*. For anyone else's playlist or a Spotify-made mix, either play it in Spotify and let Stellar follow, or save a copy (open it, Ctrl+A, right-click, Add to playlist, New playlist).
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
| `tools/` | `lyrics_library.py` (folder lyrics + auto-sync), `align.py` (speech-recognition timing) |
| `artwork/` | Cover art and visuals |

## Large files

Audio is stored with [Git LFS](https://git-lfs.com). Set it up once per machine:

```bash
git lfs install
```

`.wav`, `.mp3`, `.flac` and other audio files are then tracked by LFS automatically (see `.gitattributes`).

## Naming

`YYYY-MM-DD_song-name_v01.wav`, for example `2026-11-13_night-drive_v03.wav`.

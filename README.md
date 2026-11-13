# Musical

Music projects, lyrics and the **Stellar** lyric player.

## Stellar: a planetarium lyric player

`app/musical-stage.html` is a single-file web app. Open it in a browser (Chrome, Edge, Firefox or Safari), add a song and its lyrics, and the words are animated across a night sky of real constellations, the Milky Way, tonight's moon phase, nebulae and auroras, all reacting to the music.

- **Spotify-style player**: a library sidebar with cover art read from your MP3s, and a Lyrics view where the whole song scrolls by itself, the current line lights up word by word, and clicking any line jumps the song there. The background takes its colour from the cover.
- **English letters** for Telugu and Hindi lyrics, on by default (toggle in the bottom bar).
- **Sky view** with animated lyric styles: Constellation, Orbit, Comet, Supernova, Star map, Eclipse, Nebula, Telemetry.
- **Skies**: Observatory, Nebula, Aurora, Lunar, Warp.
- **Lyrics**: fetched per song from LRCLIB and auto-synced to your recording; or paste plain text, `.lrc` with `[mm:ss.xx]` line times, or `<mm:ss.xx>` word times. Tap-to-sync times lyrics by hand.
- **Languages**: Telugu and other Indic scripts render with proper conjuncts (Noto Sans Telugu is loaded from Google Fonts).
- Two Telugu and two English demo songs are generated in the browser, so it works before you add anything.

Run it locally by opening the file, or serve the folder:

```bash
python3 -m http.server 8000
```

then open `http://localhost:8000/app/musical-stage.html`.

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

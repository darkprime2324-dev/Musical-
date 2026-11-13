# Musical

Music projects, lyrics and the **Stellar** lyric player.

## Stellar: a planetarium lyric player

`app/musical-stage.html` is a single-file web app. Open it in a browser (Chrome, Edge, Firefox or Safari), add a song and its lyrics, and the words are animated across a night sky of real constellations, the Milky Way, tonight's moon phase, nebulae and auroras, all reacting to the music.

- **Lyric styles**: Constellation, Orbit, Comet, Supernova, Star map, Eclipse, Nebula, Telemetry.
- **Skies**: Observatory, Nebula, Aurora, Lunar, Warp.
- **Lyrics**: paste plain text, `.lrc` with `[mm:ss.xx]` line times, or `<mm:ss.xx>` word times for exact karaoke. Tap-to-sync times plain lyrics while the song plays.
- **Languages**: Telugu and other Indic scripts render with proper conjuncts (Noto Sans Telugu is loaded from Google Fonts).
- Two Telugu and two English demo songs are generated in the browser, so it works before you add anything.

Run it locally by opening the file, or serve the folder:

```bash
python3 -m http.server 8000
```

then open `http://localhost:8000/app/musical-stage.html`.

## Syncing lyrics to a song exactly

From most to least accurate:

1. **Use an existing synced file.** [LRCLIB](https://lrclib.net) is a free, open database of timed lyrics for most film songs, Telugu included. Search the song there, download the `.lrc`, and open it in the player (Lyrics -> Open .lrc file). `lyrics/yetu-pone.lrc` came from there.
2. **Automatic alignment** with `tools/align.py`. It runs speech recognition on the song to find when each phrase is sung, then fits your lyric lines onto those phrases. Lyrics can be in any script. Needs `pip install faster-whisper` once.

   ```bash
   python3 tools/align.py song.mp3 lyrics.txt --language te -o lyrics/song.lrc
   ```
3. **Tap it in.** In the player, Lyrics -> *Sync lines by tapping* (tap once per line) or *Sync every word* (tap once per word, which gives true karaoke timing). Then *Copy timed lyrics* and save the text as a `.lrc` file.
4. **Nudge.** If the words are right but everything is early or late, press `[` or `]` while the song plays to shift all lyrics by 0.1 s (`{` and `}` for a second). The shift is saved as an `[offset:]` tag.

Word-level timing uses `<mm:ss.xx>` tags inside a line, for example
`[00:13.76]<00:13.76>Yetu <00:14.40>pone`. Lines without word tags spread the words evenly across the line's time.

## Folders

| Folder | What goes in it |
| --- | --- |
| `app/` | The Stellar player |
| `projects/` | DAW session files (Ableton, FL Studio, Logic, Reaper, ...) |
| `stems/` | Exported stems and multitracks |
| `exports/` | Finished mixes and masters |
| `samples/` | Samples, loops and one-shots |
| `lyrics/` | Lyrics and `.lrc` files |
| `artwork/` | Cover art and visuals |

## Large files

Audio is stored with [Git LFS](https://git-lfs.com). Set it up once per machine:

```bash
git lfs install
```

`.wav`, `.mp3`, `.flac` and other audio files are then tracked by LFS automatically (see `.gitattributes`).

## Naming

`YYYY-MM-DD_song-name_v01.wav`, for example `2026-11-13_night-drive_v03.wav`.

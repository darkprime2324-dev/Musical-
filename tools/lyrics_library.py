#!/usr/bin/env python3
"""Build a synced-lyrics library for a folder of songs.

For every audio file in the folder (and its subfolders) this script:

1. reads the song's title, artist, album and length (from its tags via ffprobe,
   or from the file name),
2. looks the song up on LRCLIB (https://lrclib.net), a free and open database of
   synced lyrics with Telugu, Hindi, English and many other songs,
3. picks the timed version whose length is closest to your file,
4. auto-syncs it to your exact recording (needs numpy): it finds where the
   voice comes in and shifts the whole lyric sheet to match, but only when the
   match is clear, so it never makes the timing worse,
5. writes `<song name>.lrc` next to the song.

Open the folder in the Stellar player (Playlist -> Open a music folder) and each
song plays with its lyrics.

Requirements: Python 3.8+, ffmpeg/ffprobe on the PATH, and `pip install numpy`
for auto-sync (without numpy the lyrics are saved exactly as LRCLIB has them).

Usage:

    python3 tools/lyrics_library.py ~/Music/Telugu
    python3 tools/lyrics_library.py ~/Music --force          # redo existing .lrc files
    python3 tools/lyrics_library.py ~/Music --no-sync        # skip auto-sync
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

AUDIO = {".mp3", ".m4a", ".aac", ".flac", ".wav", ".ogg", ".opus"}
API = "https://lrclib.net/api"
CLIENT = "Stellar lyrics library (github.com/darkprime2324-dev/Musical-)"
JUNK = re.compile(r"(mp3|\.co\b|\.com|\.in\b|\.net|www\.|kbps|songs?\.|naa ?songs|download|320|128)", re.I)


def clean(s):
    s = re.sub(r"\.(mp3|m4a|aac|flac|wav|ogg|opus)$", "", s or "", flags=re.I).replace("_", " ")
    parts = [re.sub(r"[(\[][^)\]]*(kbps|mp3|www|\.com|\.co)[^)\]]*[)\]]", "", p, flags=re.I).strip()
             for p in re.split(r"\s*(?:::|\||\s-\s|\s–\s)\s*", s)]
    parts = [p for p in parts if p and not JUNK.search(p)]
    return re.sub(r"\s{2,}", " ", parts[0] if parts else s).strip()


def probe(path):
    """Title, artist, album and duration from the file's tags."""
    out = {"title": "", "artist": "", "album": "", "duration": 0.0}
    if shutil.which("ffprobe"):
        try:
            j = json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration:format_tags",
                                           "-of", "json", str(path)], capture_output=True, text=True, timeout=60).stdout)
            fmt = j.get("format", {})
            tags = {k.lower(): v for k, v in (fmt.get("tags") or {}).items()}
            out.update(title=tags.get("title", ""), artist=tags.get("artist", ""), album=tags.get("album", ""),
                       duration=float(fmt.get("duration") or 0))
        except Exception:
            pass
    out["title"] = clean(out["title"] or path.stem)
    out["artist"] = clean(out["artist"])
    return out


def api(path, **params):
    q = urllib.parse.urlencode({k: v for k, v in params.items() if v})
    req = urllib.request.Request(f"{API}{path}?{q}", headers={"User-Agent": CLIENT, "Lrclib-Client": CLIENT})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def find(meta):
    rs = api("/search", track_name=meta["title"], artist_name=meta["artist"]) if meta["artist"] else None
    if not rs:
        rs = api("/search", q=f"{meta['title']} {meta['artist']}".strip())
    if not rs and meta["artist"]:
        rs = api("/search", q=meta["title"])
    rs = [r for r in (rs or []) if not r.get("instrumental") and (r.get("syncedLyrics") or r.get("plainLyrics"))]
    rs.sort(key=lambda r: (0 if r.get("syncedLyrics") else 1000) + abs((r.get("duration") or 0) - (meta["duration"] or r.get("duration") or 0)))
    return rs[0] if rs else None


# ---- auto-sync (same method as the player) ----
def vocal_onsets(path):
    import numpy as np
    sr, hop = 11025, 110
    pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(sr),
                          "-af", "highpass=f=280,highpass=f=280,lowpass=f=3400", "-f", "f32le", "-"],
                         capture_output=True, timeout=600).stdout
    x = np.frombuffer(pcm, dtype="<f4")
    n = len(x) // hop
    p = (x[: n * hop].reshape(n, hop).astype(np.float64) ** 2).mean(1)
    e = np.log(1e-9 + np.convolve(p, np.ones(15) / 15, "same"))  # 150 ms loudness
    o = np.zeros(n)
    o[3:] = np.maximum(0, e[3:] - np.maximum.reduce([e[2:-1], e[1:-2], e[:-3]]))
    o = np.convolve(o, np.ones(5) / 5, "same")
    return (o - o.mean()) / (o.std() + 1e-9)


def find_offset(o, starts):
    import numpy as np
    offs = np.arange(-800, 801) / 100
    sc = []
    for off in offs:
        s = 0.0
        for t in starts:
            f = int(round((t + off) * 100))
            seg = o[max(0, f - 4): max(0, f + 13)] if 0 <= f < len(o) else None
            s += float(np.clip(seg.max() if seg is not None and len(seg) else -1, -1, 6))
        sc.append(s / len(starts))
    sc = np.array(sc)
    sd = sc.std() or 1
    bi = int(sc.argmax())
    far = np.abs(offs - offs[bi]) > 0.3
    lead = (sc[bi] - sc[far].max()) / sd if far.any() else 9
    return float(offs[bi]), float((sc[bi] - sc.mean()) / sd), float(lead)


STAMP = re.compile(r"\[(\d+):(\d+(?:\.\d+)?)\]")
WORD = re.compile(r"<(\d+):(\d+(?:\.\d+)?)>")


def fmt(t):
    cs = round(max(0.0, t) * 100)
    return f"{cs // 6000:02d}:{(cs % 6000) / 100:05.2f}"


def shift(lrc, off):
    def line(m):
        return f"[{fmt(int(m[1]) * 60 + float(m[2]) + off)}]"

    def word(m):
        return f"<{fmt(int(m[1]) * 60 + float(m[2]) + off)}>"

    return "\n".join(WORD.sub(word, STAMP.sub(line, l)) for l in lrc.splitlines())


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("folder")
    ap.add_argument("--force", action="store_true", help="replace .lrc files that already exist")
    ap.add_argument("--no-sync", action="store_true", help="save lyrics exactly as LRCLIB has them")
    args = ap.parse_args()

    can_sync = not args.no_sync and shutil.which("ffmpeg")
    if can_sync:
        try:
            import numpy  # noqa: F401
        except ImportError:
            print("numpy not installed: saving lyrics without auto-sync (pip install numpy to enable it)", file=sys.stderr)
            can_sync = False

    songs = sorted(p for p in Path(args.folder).expanduser().rglob("*") if p.suffix.lower() in AUDIO)
    if not songs:
        sys.exit("no songs found")
    done = skipped = missing = 0
    for song in songs:
        out = song.with_suffix(".lrc")
        if out.exists() and not args.force:
            skipped += 1
            continue
        meta = probe(song)
        try:
            r = find(meta)
        except Exception as e:
            print(f"!  {song.name}: lookup failed ({e})")
            time.sleep(2)
            continue
        if not r:
            print(f"-  {song.name}: not found on LRCLIB as \"{meta['title']}\" {meta['artist']}")
            missing += 1
            continue
        lrc = r.get("syncedLyrics") or r.get("plainLyrics")
        note = "timed" if r.get("syncedLyrics") else "text only"
        if can_sync and r.get("syncedLyrics"):
            starts = [int(m[0]) * 60 + float(m[1]) for m in re.findall(r"^\[(\d+):(\d+(?:\.\d+)?)\]\s*\S", lrc, re.M)]
            if len(starts) >= 4:
                off, z, lead = find_offset(vocal_onsets(song), starts)
                if z >= 3 and lead >= 0.5 and abs(off) >= 0.05:
                    lrc = shift(lrc, off)
                    note += f", auto-synced {off:+.2f} s"
                elif z >= 3 and lead >= 0.5:
                    note += ", already in sync"
                else:
                    note += ", no clear match so timings kept"
        head = f"[ti:{r.get('trackName', '')}]\n[ar:{r.get('artistName', '')}]\n[al:{r.get('albumName', '')}]\n[by:LRCLIB #{r.get('id')}]\n"
        out.write_text(head + lrc.replace("\r", "").strip() + "\n", encoding="utf-8")
        print(f"+  {song.name}: {r.get('trackName')} - {r.get('artistName')} ({note})")
        done += 1
        time.sleep(0.3)
    print(f"\n{done} written, {skipped} already had lyrics, {missing} not found")


if __name__ == "__main__":
    main()

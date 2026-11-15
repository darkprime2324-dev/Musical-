#!/usr/bin/env python3
"""Time known lyrics to a recording, word by word, and write a .lrc file.

Unlike align.py (which only uses phrase timing, for lyrics in any script), this matches the
words themselves: speech recognition (faster-whisper) hears the song, the recognised words are
lined up with your lyric words in order (spelling differences and mishearings allowed), and the
words it missed are spread between their matched neighbours. Use it for English lyrics on clear
recordings; this is how the built-in public-domain songs (web/src/catalog) were timed.

Setup, once (needs ffmpeg):

    pip install faster-whisper numpy

Usage:

    python3 tools/fit_lyrics.py song.mp3 lyrics.txt -o song.lrc --title "Song" --artist "Singer"

lyrics.txt has one line per lyric line, as it should appear on screen. The report shows how many
words of each line were heard (e.g. 11/12); lines with few matches are worth checking by ear,
and a recording where most lines score low is too noisy to time this way.
"""
import argparse
import difflib
import json
import re
import subprocess
import sys


def hear(path, model_name):
    import numpy as np
    from faster_whisper import WhisperModel
    pcm = subprocess.run(["ffmpeg", "-v", "quiet", "-i", path, "-f", "s16le", "-ac", "1", "-ar", "16000", "-"],
                         capture_output=True, check=True).stdout
    audio = np.frombuffer(pcm, np.int16).astype(np.float32) / 32768
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    # No lyric prompt: prompting makes the model repeat the prompt instead of listening.
    segs, _ = model.transcribe(audio, language="en", word_timestamps=True, beam_size=5, condition_on_previous_text=False)
    return [{"t": w.start, "end": w.end, "w": w.word.strip()} for s in segs for w in (s.words or [])]


def fit(words, lines):
    norm = lambda w: re.sub(r"[^a-z0-9]", "", w.lower().replace("'", ""))
    lw = [(i, w) for i, l in enumerate(lines) for w in l.split()]
    a = [norm(w) for _, w in lw]
    vocab = set(a)
    b = [x if x in vocab else (difflib.get_close_matches(x, vocab, 1, 0.75) or [x])[0] for x in (norm(w["w"]) for w in words)]
    t = [None] * len(lw)
    for blk in difflib.SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            t[blk.a + k] = (words[blk.b + k]["t"], words[blk.b + k]["end"])
    anchors = [k for k, x in enumerate(t) if x]
    if not anchors:
        sys.exit("none of the lyric words were heard in the recording")
    for k in range(len(t)):
        if t[k]:
            continue
        prev = max((j for j in anchors if j < k), default=None)
        nxt = min((j for j in anchors if j > k), default=None)
        if prev is not None and nxt is not None:
            s = t[prev][1] + (k - prev) / (nxt - prev) * (t[nxt][0] - t[prev][1])
        elif prev is not None:
            s = t[prev][1] + 0.35 * (k - prev - 1)
        else:
            s = t[nxt][0] - 0.35 * (nxt - k)
        t[k] = (max(0.0, s), max(0.0, s) + 0.3)
    return lw, t, set(anchors)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("audio")
    ap.add_argument("lyrics")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--model", default="small.en", help="Whisper model (small.en is a good balance; medium.en is slower)")
    ap.add_argument("--title", default="")
    ap.add_argument("--artist", default="")
    ap.add_argument("--words", help="cache the recognised words in this JSON file (reused if it exists)")
    a = ap.parse_args()
    lines = [l.strip() for l in open(a.lyrics, encoding="utf-8") if l.strip()]
    try:
        words = json.load(open(a.words)) if a.words else None
    except OSError:
        words = None
    if words is None:
        words = hear(a.audio, a.model)
        if a.words:
            json.dump(words, open(a.words, "w"))
    lw, t, anchors = fit(words, lines)
    st = lambda s: f"{int(s // 60):02d}:{s % 60:05.2f}"
    rows = []
    for i, line in enumerate(lines):
        ks = [k for k, (li, _) in enumerate(lw) if li == i]
        rows.append(f"[{st(t[ks[0]][0])}]" + " ".join(f"<{st(t[k][0])}>{lw[k][1]}" for k in ks))
        print(f"{sum(k in anchors for k in ks):>2}/{len(ks):<2} {st(t[ks[0]][0])} {line}")
    end = max(w["end"] for w in words) + 1.5
    head = [f"[ti:{a.title}]", f"[ar:{a.artist}]", "[by:timed with speech recognition (tools/fit_lyrics.py)]"]
    open(a.out, "w", encoding="utf-8").write("\n".join(head + rows + [f"[{st(end)}]"]) + "\n")
    print(f"heard {len(anchors)}/{len(lw)} lyric words; wrote {a.out}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Time lyrics to a song automatically and write a word-synced .lrc file.

Runs speech recognition (faster-whisper) on the song to find when each sung
phrase starts and ends, then fits your lyric lines onto those phrases in order,
so the lyrics can be in any script (romanized Telugu works fine) because only
the timing is used, never the recognised text.

Setup, once:

    pip install faster-whisper

Usage:

    python3 tools/align.py song.mp3 lyrics.txt -o lyrics/song.lrc
    python3 tools/align.py song.mp3 lyrics.txt --language te --model small

Then open the .lrc file in the Stellar player (Lyrics -> Open .lrc file).
Lines that end up a little off can be fixed with tap-to-sync or the [ ] keys.
"""
import argparse
import sys


def stamp(t, word=False):
    m, s = divmod(max(0.0, t), 60)
    txt = f"{int(m):02d}:{s:05.2f}"
    return f"<{txt}>" if word else f"[{txt}]"


def transcribe(path, model_name, language):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device="auto", compute_type="int8")
    segments, info = model.transcribe(path, language=language, word_timestamps=True, vad_filter=True)
    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append((w.start, w.end))
    print(f"recognised {len(words)} sung words, language {info.language}", file=sys.stderr)
    return words


def phrases(words, gap=0.7):
    """Group recognised words into phrases separated by pauses."""
    out = []
    for start, end in words:
        if out and start - out[-1][1] <= gap:
            out[-1][1] = end
            out[-1][2] += 1
        else:
            out.append([start, end, 1])
    return out


def fit(lines, phr):
    """Assign lyric lines to phrases in order so that long lines get long phrases.

    Dynamic programming over (line index, phrase index); each line takes one or
    more consecutive phrases, or shares a phrase with the previous line.
    """
    import math
    weights = [max(1, len(l.replace(" ", ""))) for l in lines]
    total_w = sum(weights)
    total_t = sum(p[1] - p[0] for p in phr) or 1.0
    n, m = len(lines), len(phr)
    INF = float("inf")
    cost = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[None] * (m + 1) for _ in range(n + 1)]
    cost[0][0] = 0.0
    for i in range(1, n + 1):
        expect = weights[i - 1] / total_w * total_t
        for j in range(1, m + 1):
            # line i takes phrases k..j (k>=1), or shares phrase j with line i-1 (k = j and cost from [i-1][j])
            for k in range(max(1, j - 4), j + 1):
                span = phr[j - 1][1] - phr[k - 1][0]
                c = cost[i - 1][k - 1] + abs(math.log((span + 0.3) / (expect + 0.3)))
                if c < cost[i][j]:
                    cost[i][j], back[i][j] = c, (k, False)
            if cost[i - 1][j] + 1.5 < cost[i][j]:
                cost[i][j], back[i][j] = cost[i - 1][j] + 1.5, (j, True)
    # best end
    j = min(range(1, m + 1), key=lambda jj: cost[n][jj] + 0.4 * (m - jj))
    result = [None] * n
    i = n
    while i > 0:
        k, shared = back[i][j]
        result[i - 1] = (phr[k - 1][0], phr[j - 1][1])
        j = j if shared else k - 1
        i -= 1
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("song")
    ap.add_argument("lyrics", help="text file, one lyric line per row; blank rows mark instrumental gaps")
    ap.add_argument("-o", "--out", help="output .lrc path (default: print)")
    ap.add_argument("--language", default=None, help="language code such as te, hi, ta, en (default: auto)")
    ap.add_argument("--model", default="small", help="faster-whisper model: tiny, base, small, medium, large-v3")
    args = ap.parse_args()

    raw = open(args.lyrics, encoding="utf-8").read().splitlines()
    lines = [l.strip() for l in raw if l.strip()]
    if not lines:
        sys.exit("no lyric lines found")
    words = transcribe(args.song, args.model, args.language)
    if not words:
        sys.exit("no singing recognised; try --model medium or a cleaner audio file")
    phr = phrases(words)
    spans = fit(lines, phr)

    out = ["[by:tools/align.py (automatic alignment; check with tap-to-sync)]"]
    for line, (start, end) in zip(lines, spans):
        ws = line.split()
        dur = max(0.2, end - start)
        per = dur / max(1, len(ws))
        tagged = " ".join(stamp(start + i * per, word=True) + w for i, w in enumerate(ws))
        out.append(stamp(start) + tagged)
    text = "\n".join(out) + "\n"
    if args.out:
        open(args.out, "w", encoding="utf-8").write(text)
        print(f"wrote {args.out} ({len(lines)} lines)", file=sys.stderr)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()

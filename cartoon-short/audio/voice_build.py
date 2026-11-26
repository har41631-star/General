"""Narration for the bridge short with Kokoro TTS, fitted to the picture's fixed timeline.

The picture (story.ts / cast.ts) was timed to the original author's recording, which is not in the template, so
each phrase here is synthesized on its own and placed in its slot: `start` aligned phrases begin at t0, `end`
aligned ones finish at t1 (used where a word must land on an on-screen event: "snaps" on the bolt at 34.62 s,
"step" on the third hammer blow at 61.69 s). A phrase that would overrun its slot is sped up (max 1.4x).

Kokoro gives no word timings, so words.json is estimated: each phrase's voiced span is split across its words in
proportion to their letter counts. mix.py only uses it to duck the music under speech, so this is accurate enough.

usage: python3 audio/voice_build.py [--voice af_heart] [--models DIR]
writes voice/voice.wav (48 kHz mono, exactly 67.5 s), voice/words.json, voice/phrases.json
"""
import argparse, json, os, re
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
DUR = 2025 / 30

# (text, t0, t1, align): the phrase must sit inside [t0, t1]
PHRASES = [
    ("Seventy-four soldiers knocked down an iron bridge just by walking across it.", 0.20, 4.25, "start"),
    ("It's eighteen thirty-one, and the brand new bridge over the river is the pride of the whole town.", 4.55, 9.30, "start"),
    ("The men are marching home four across, every boot hitting the planks at the exact same moment.", 9.60, 14.70, "start"),
    ("Halfway over, the bridge starts bouncing under their feet.", 14.95, 17.60, "start"),
    ("A normal person would slow down,", 17.70, 19.35, "start"),
    ("but these guys think it's hilarious.", 19.45, 21.38, "start"),
    ("Somebody starts whistling a marching tune,", 21.55, 23.55, "start"),
    ("and the whole column stomps along to it, a little harder every step.", 23.65, 27.35, "start"),
    ("The bounce gets bigger, the chains start groaning,", 27.55, 29.95, "start"),
    ("and nobody wants to be the one who breaks step.", 30.15, 32.80, "start"),
    ("Then,", 33.00, 33.60, "start"),
    ("a single bolt snaps,", 33.70, 34.80, "end"),
    ("and the whole end of the bridge drops into the river.", 34.95, 37.65, "start"),
    ("Luckily, the river was only two feet deep.", 38.00, 40.25, "start"),
    ("Unluckily, the river was only two feet deep.", 40.55, 43.30, "start"),
    ("You see, every bridge has a rhythm it naturally likes to sway at.", 43.60, 46.90, "start"),
    ("Ever pushed a kid on a swing?", 47.15, 48.65, "start"),
    ("Each push is tiny, but if they all land at just the right moment, the swing goes higher and higher.", 48.85, 53.90, "start"),
    ("Seventy-four men stepping together were pushing that bridge like a swing.", 54.15, 57.70, "start"),
    ("Nobody died, but the army made a rule:", 57.85, 59.95, "start"),
    ("never cross a bridge in step.", 60.05, 61.95, "end"),
    ("So now, the best drilled soldiers in the world cross every bridge like a crowd of tourists.", 62.30, 67.20, "start"),
]
BASE_SPEED, MAX_SPEED = 1.08, 1.4


def voiced_span(x, sr, thr_db=-38):
    """first/last sample above the threshold (20 ms frames), as seconds"""
    hop = int(0.02 * sr)
    n = len(x) // hop
    e = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(e / (e.max() + 1e-12))
    on = np.where(db > thr_db)[0]
    return (on[0] * hop / sr, (on[-1] + 1) * hop / sr) if len(on) else (0, len(x) / sr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--models", default=os.environ.get("KOKORO_DIR", "."))
    a = ap.parse_args()
    k = Kokoro(os.path.join(a.models, "kokoro-v1.0.onnx"), os.path.join(a.models, "voices-v1.0.bin"))
    out = np.zeros(int(round(DUR * SR)), np.float32)
    words, log = [], []
    for text, t0, t1, align in PHRASES:
        slot = t1 - t0
        speed = BASE_SPEED
        for _ in range(4):  # natural duration at this speed, then refit
            y, sr = k.create(text, voice=a.voice, speed=speed, lang="en-us", trim=True)
            d = len(y) / sr
            if d <= slot or speed >= MAX_SPEED:
                break
            speed = min(MAX_SPEED, speed * d / slot * 1.01)
        y = resample_poly(y, SR, sr).astype(np.float32)
        d = len(y) / SR
        start = t0 if align == "start" else max(t0, t1 - d)
        i0 = int(round(start * SR))
        seg = y[: max(0, len(out) - i0)]
        out[i0:i0 + len(seg)] += seg
        v0, v1 = voiced_span(y, SR)
        toks = re.findall(r"[A-Za-z0-9'\-]+", text)
        wts = np.array([max(2, len(re.sub(r"[^A-Za-z0-9]", "", w))) + 1.5 for w in toks], float)
        edges = start + v0 + (v1 - v0) * np.concatenate([[0], np.cumsum(wts) / wts.sum()])
        words += [{"w": w, "s": round(float(edges[j]), 3), "e": round(float(edges[j + 1]), 3)} for j, w in enumerate(toks)]
        log.append({"text": text, "start": round(start, 3), "end": round(start + d, 3), "slot": [t0, t1], "speed": round(speed, 3),
                    "overrun": round(max(0, start + d - t1), 3)})
        print(f"{start:6.2f}-{start + d:6.2f}  x{speed:.2f}  {'OVER ' if start + d > t1 + 0.02 else ''}{text}")
    pk = np.abs(out).max()
    out *= 10 ** (-3 / 20) / pk  # peak -3 dBFS; mix.py sets the voice gain from loudness
    os.makedirs(os.path.join(ROOT, "voice"), exist_ok=True)
    sf.write(os.path.join(ROOT, "voice", "voice.wav"), out, SR, subtype="PCM_16")
    json.dump(words, open(os.path.join(ROOT, "voice", "words.json"), "w"), indent=1)
    json.dump({"voice": a.voice, "phrases": log}, open(os.path.join(ROOT, "voice", "phrases.json"), "w"), indent=1)
    print("voice.wav", len(out) / SR, "s,", len(words), "words")


if __name__ == "__main__":
    main()

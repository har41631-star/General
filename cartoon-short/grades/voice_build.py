"""Voices for "Who Got the Better Grades?" (Synaptic Recall) with Kokoro TTS.

Unlike the bridge short, the picture is timed TO the voice: phrases are laid end to end with the gap given before
each one, and timeline.json (id -> start/end) drives every shot in src/videos/grades/story.ts.

usage: python3 grades/voice_build.py --models DIR [--narrator af_heart] [--leo am_puck] [--doc bm_george]
writes grades/voice/voice.wav (48 kHz mono), words.json, timeline.json
"""
import argparse, json, os, re
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 48000
TAIL = 4.2  # end card after the last line (s)

# (id, speaker, gap before in s, text). Speakers: N = narrator, L = Leo, D = Dr. Synapse.
LINES = [
    ("hook1", "N", 0.35, "Two students. Same college. Same pre-med track."),
    ("hook2", "N", 0.25, "Who do you think ended up with the better grades?"),
    ("m1", "N", 0.95, "This is Marcus."),
    ("m2", "N", 0.2, "Marcus is smart. Top of his high school class."),
    ("m3", "N", 0.25, "In college, his plan was simple: outwork everyone."),
    ("m4", "N", 0.3, "He re-read every lecture. Highlighted every line."),
    ("m5", "N", 0.2, "Rewrote his notes..."),
    ("m6", "N", 0.35, "three times."),
    ("l1", "N", 0.7, "And this is Leo."),
    ("l2", "N", 0.2, "Leo is... not that kid. Honestly? He's average."),
    ("l3", "N", 0.2, "He forgets stuff. A lot."),
    ("l4", "N", 1.05, "But Leo knew one thing about himself."),
    ("l5", "N", 0.2, "If he was gonna remember anything, he needed a better system. Not more hours."),
    ("a1", "N", 0.45, "So after every lecture, he dropped it into Synaptic Recall."),
    ("a2", "D", 0.3, "Send me your lecture, and I'll turn it into a story and an Anki deck!"),
    ("a3", "N", 0.35, "Then he'd just quiz himself. A little every day."),
    ("a4", "N", 0.25, "On the bus."),
    ("a5", "N", 0.3, "In line for lunch."),
    ("a6", "N", 0.3, "Then he went and lived his life."),
    ("c1", "N", 0.7, "Meanwhile, Marcus had a problem. He'd read everything."),
    ("c2", "N", 0.2, "But when he closed the book..."),
    ("c3", "N", 0.55, "it was gone."),
    ("c4", "N", 0.45, "Leo's brain? Everything had a shelf."),
    ("e1", "N", 0.65, "Then came the M-Cat. Same exam. Same question."),
    ("e2", "N", 0.35, "One of them had seen it a hundred times."),
    ("e3", "N", 0.2, "The other had actually practiced remembering it."),
    ("r1", "N", 0.7, "If you guessed Leo..."),
    ("r2", "N", 0.3, "you were right."),
    ("r3", "N", 0.35, "Not because he was smarter. Because he knew his tools."),
    ("b1", "L", 0.8, "Bro. Stop re-reading. Try this."),
    ("w1", "D", 1.6, "Work hard. But work smart!"),
    ("end", "N", 0.45, "Synaptic Recall. Turn your lectures into stories and Anki decks."),
]
SPEED = {"N": 1.05, "L": 1.08, "D": 1.0}


def voiced_span(x, sr, thr_db=-38):
    hop = int(0.02 * sr)
    n = len(x) // hop
    e = np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(e / (e.max() + 1e-12))
    on = np.where(db > thr_db)[0]
    return (on[0] * hop / sr, (on[-1] + 1) * hop / sr) if len(on) else (0, len(x) / sr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default=os.environ.get("KOKORO_DIR", "."))
    ap.add_argument("--narrator", default="af_heart")
    ap.add_argument("--leo", default="am_puck")
    ap.add_argument("--doc", default="bm_george")
    a = ap.parse_args()
    voice = {"N": a.narrator, "L": a.leo, "D": a.doc}
    k = Kokoro(os.path.join(a.models, "kokoro-v1.0.onnx"), os.path.join(a.models, "voices-v1.0.bin"))
    clips, t = [], 0.0
    for lid, spk, gap, text in LINES:
        y, sr = k.create(text, voice=voice[spk], speed=SPEED[spk], lang="en-us", trim=True)
        y = resample_poly(y, SR, sr).astype(np.float32)
        v0, v1 = voiced_span(y, SR)
        y = y[int(v0 * SR):int(v1 * SR) + int(0.03 * SR)]  # trim to the voiced span so gaps are exact
        t += gap
        clips.append((lid, spk, text, t, y))
        t += len(y) / SR
    dur = t + TAIL
    out = np.zeros(int(np.ceil(dur * 30)) * SR // 30, np.float32)
    words, tl = [], []
    for lid, spk, text, st, y in clips:
        i0 = int(round(st * SR))
        out[i0:i0 + len(y)] += y[: len(out) - i0]
        d = len(y) / SR
        toks = re.findall(r"[A-Za-z0-9'\-]+", text)
        wts = np.array([max(2, len(re.sub(r"[^A-Za-z0-9]", "", w))) + 1.5 for w in toks], float)
        edges = st + d * np.concatenate([[0], np.cumsum(wts) / wts.sum()])
        wl = [{"w": w, "s": round(float(edges[j]), 3), "e": round(float(edges[j + 1]), 3)} for j, w in enumerate(toks)]
        words += wl
        tl.append({"id": lid, "spk": spk, "text": text, "s": round(st, 3), "e": round(st + d, 3), "words": wl})
        print(f"{st:6.2f}-{st + d:6.2f} {spk} {lid:5s} {text}")
    out *= 10 ** (-3 / 20) / np.abs(out).max()
    od = os.path.join(HERE, "voice")
    os.makedirs(od, exist_ok=True)
    sf.write(os.path.join(od, "voice.wav"), out, SR, subtype="PCM_16")
    json.dump(words, open(os.path.join(od, "words.json"), "w"), indent=1)
    frames = len(out) * 30 // SR
    json.dump({"fps": 30, "frames": int(frames), "dur": frames / 30, "voices": voice, "lines": tl},
              open(os.path.join(od, "timeline.json"), "w"), indent=1)
    print(f"total {frames / 30:.2f} s = {frames} frames")


if __name__ == "__main__":
    main()

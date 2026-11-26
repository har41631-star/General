"""Build the voiceover and word timings from script.json.

Usage: python3 tools/tts.py [--voice af_heart] [--models DIR]
Writes audio/vo.wav and build/timings.json.
"""
import argparse, json, re, os
import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument("--voice")
ap.add_argument("--models", default=os.environ.get("KOKORO_DIR", ""))
args = ap.parse_args()

cfg = json.load(open(os.path.join(ROOT, "script.json")))
voice = args.voice or cfg["voice"]
mdir = args.models
k = Kokoro(os.path.join(mdir, "kokoro-v1.0.onnx"), os.path.join(mdir, "voices-v1.0.bin"))
SR = 24000


def parse(text):
    """-> list of tokens {show, say, key, chunk, punct}"""
    toks = []
    for ci, chunk in enumerate(text.split("|")):
        for raw in re.findall(r"\S*\{[^}]*\}\S*|\S+", chunk):
            m = re.match(r"^(\*?)([^{*]+?)(\*?)([.,!?]*)(\{([^}]*)\})?([.,!?]*)$", raw)
            key = bool(m.group(1))
            show = m.group(2)
            punct = (m.group(4) or "") + (m.group(7) or "")
            say = m.group(6) if m.group(6) else show
            toks.append(dict(show=show + punct, say=say + punct, key=key, chunk=ci,
                             punct=punct))
    return toks


def nphon(word):
    p = k.tokenizer.phonemize(re.sub(r"[.,!?]", "", word), "en-us")
    return max(2, len(re.sub(r"\s", "", p)))


def frame_rms(audio):
    hop = int(0.01 * SR)
    n = len(audio) // hop
    rms = np.array([np.sqrt(np.mean(audio[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    thr = max(0.012, 0.08 * np.percentile(rms, 90))
    return rms < thr, n


def runs_of(sil, n, min_frames=3):
    runs, i = [], 0
    while i < n:
        if sil[i]:
            j = i
            while j < n and sil[j]:
                j += 1
            if j - i >= min_frames:
                runs.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return runs


def align(toks, audio):
    """Give each token t0/t1 (seconds, relative to the line audio)."""
    sil, n = frame_rms(audio)
    nz = np.where(~sil)[0]
    sp0, sp1 = (nz[0] * 0.01, (nz[-1] + 1) * 0.01) if len(nz) else (0, n * 0.01)
    runs = [r for r in runs_of(sil, n) if r[0] > sp0 and r[1] < sp1]
    w = [sum(nphon(x) for x in tk["say"].split()) for tk in toks]
    # expected boundaries, proportional over the whole spoken span
    cum = np.cumsum(w) / sum(w)
    bounds = []  # (token index after which a boundary falls, start, end of pause)
    for i, tk in enumerate(toks[:-1]):
        if not tk["punct"]:
            continue
        exp = sp0 + (sp1 - sp0) * cum[i]
        best, bs = None, 1e9
        for r in runs:
            c = (r[0] + r[1]) / 2
            if abs(c - exp) > 0.35:
                continue
            score = abs(c - exp) - 0.6 * (r[1] - r[0])
            if score < bs:
                best, bs = r, score
        bounds.append((i, best if best else (exp, exp)))
    segs, prev, s0 = [], 0, sp0
    for i, (a, b) in bounds:
        segs.append((list(range(prev, i + 1)), s0, a))
        prev, s0 = i + 1, b
    segs.append((list(range(prev, len(toks))), s0, sp1))
    for g, a, b in segs:
        tot = sum(w[i] for i in g)
        c = a
        for i in g:
            d = (b - a) * w[i] / tot
            toks[i]["t0"], toks[i]["t1"] = c, c + d
            c += d


out_audio = [np.zeros(int(cfg["lead_in"] * SR), dtype=np.float32)]
t = cfg["lead_in"]
lines = []
for line in cfg["lines"]:
    if line["gap"]:
        out_audio.append(np.zeros(int(line["gap"] * SR), dtype=np.float32))
        t += line["gap"]
    toks = parse(line["text"])
    spoken = " ".join(tk["say"] for tk in toks)
    audio, sr = k.create(spoken, voice=voice, speed=cfg["speed"], lang="en-us")
    assert sr == SR
    audio = audio.astype(np.float32)
    dur = len(audio) / SR
    align(toks, audio)
    for tk in toks:
        tk["t0"], tk["t1"] = round(t + tk["t0"], 3), round(t + tk["t1"], 3)
    lines.append(dict(id=line["id"], t0=round(t, 3), t1=round(t + dur, 3),
                      words=[dict(w=tk["show"], k=tk["key"], c=tk["chunk"],
                                  t0=tk["t0"], t1=tk["t1"]) for tk in toks]))
    out_audio.append(audio)
    t += dur
    print(f"{line['id']:6s} {lines[-1]['t0']:6.2f} -> {lines[-1]['t1']:6.2f}  {spoken}")

out_audio.append(np.zeros(int(cfg["tail"] * SR), dtype=np.float32))
t += cfg["tail"]
vo = np.concatenate(out_audio)
os.makedirs(os.path.join(ROOT, "audio"), exist_ok=True)
os.makedirs(os.path.join(ROOT, "build"), exist_ok=True)
sf.write(os.path.join(ROOT, "audio", "vo.wav"), vo, SR)
json.dump(dict(duration=round(t, 3), voice=voice, lines=lines),
          open(os.path.join(ROOT, "build", "timings.json"), "w"), indent=1)
print("total", round(t, 2), "s")

"""Synthesize the music bed + SFX from build/cues.json and mix with the voiceover.

python3 tools/audio.py            -> audio/music.wav, audio/sfx.wav, audio/mix.wav, audio/mix_novo.wav
Everything here is generated from scratch (no samples), so it is free to use.
"""
import json, os, subprocess
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

import sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = sys.argv[sys.argv.index("--build") + 1] if "--build" in sys.argv else "build"
SR = 48000
T = json.load(open(os.path.join(ROOT, BUILD, "timings.json")))
CUES = json.load(open(os.path.join(ROOT, BUILD, "cues.json")))
DUR = T["duration"]
N = int(DUR * SR) + SR
rng = np.random.default_rng(3)
LINE = {l["id"]: l for l in T["lines"]}


def cue_t(kind):
    return [c for c in CUES if c["type"] == kind]


def tt(n):
    return np.arange(int(n * SR)) / SR


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def add(buf, sig, t, g=1.0):
    i = int(t * SR)
    if i < 0:
        sig = sig[-i:]
        i = 0
    j = min(len(buf), i + len(sig))
    if j > i:
        buf[i:j] += sig[: j - i] * g


def noise(d):
    return rng.standard_normal(int(d * SR))


# ---------------------------------------------------------------- drums / synths
def kick(g=1.0):
    t = tt(0.45)
    f = 48 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.22)
    s += 0.25 * hp(noise(0.45), 2500) * np.exp(-t / 0.006)
    return np.tanh(1.6 * s) * g


def clap():
    t = tt(0.3)
    n = bp(noise(0.3), 900, 5000)
    env = np.exp(-t / 0.09)
    for k in (0.0, 0.011, 0.022):
        env += 0.8 * np.exp(-np.clip(t - k, 0, None) / 0.006) * (t >= k)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    return 0.6 * n * env / 2 + 0.35 * tone


def hat(open_=False):
    d = 0.25 if open_ else 0.06
    t = tt(d)
    return hp(noise(d), 7000, 4) * np.exp(-t / (0.08 if open_ else 0.014))


def bass808(freq, d):
    t = tt(d)
    f = freq * (1 + 0.6 * np.exp(-t / 0.03))
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.minimum(1, t / 0.005) * np.exp(-t / 0.9)
    return np.tanh(2.2 * np.sin(ph) * env) * 0.9


def saw(freq, d, detune=0.0):
    t = tt(d)
    ph = (freq * (1 + detune) * t) % 1.0
    return 2 * ph - 1


def pad(freqs, d):
    L = np.zeros(int(d * SR))
    R = np.zeros(int(d * SR))
    for f in freqs:
        L += saw(f, d, -0.006) + saw(f, d, 0.004)
        R += saw(f, d, 0.006) + saw(f, d, -0.003)
    t = tt(d)
    env = np.minimum(1, t / 0.35) * np.minimum(1, (d - t) / 0.3)
    return lp(L, 900) * env / len(freqs), lp(R, 900) * env / len(freqs)


def pluck(freq):
    t = tt(0.32)
    s = saw(freq, 0.32) * 0.6 + np.sign(np.sin(2 * np.pi * freq * t)) * 0.4
    return lp(s, 2600) * np.exp(-t / 0.09)


# ---------------------------------------------------------------- music bed
def music():
    L = np.zeros(N)
    R = np.zeros(N)
    M = np.zeros(N)  # mono drums/bass
    drop = cue_t("drop")[0]["t"] + 0.12
    t_fail = cue_t("fail")[0]["t"]
    t_pass = cue_t("pass")[0]["t"]
    B = 60 / 140
    S = B / 4
    BAR = 4 * B
    prog = [  # chord, 808 root
        ([146.83, 174.61, 220.00], 73.42),   # Dm
        ([116.54, 146.83, 174.61], 58.27),   # Bb
        ([98.00, 116.54, 146.83], 49.00),    # Gm
        ([110.00, 138.59, 164.81], 55.00),   # A
    ]
    k_main = [0, 7, 10]
    k_alt = [0, 3, 10, 13]
    first_bar = int(np.floor(-drop / BAR))
    last_bar = int(np.ceil((DUR - drop) / BAR))
    K, C, H, H2 = kick(), clap(), hat(), hat(True)
    for b in range(first_bar, last_bar + 1):
        t0 = drop + b * BAR
        chord, root = prog[b % 4]
        intro = t0 < drop - 0.01
        outro = t0 >= t_pass - 0.01
        # pad (everywhere, quieter in main)
        if t0 + BAR > 0:
            pl, pr = pad([f * 2 for f in chord] if not intro else chord, BAR + 0.3)
            g = 0.26 if intro or outro else 0.14
            add(L, pl, t0, g)
            add(R, pr, t0, g)
        for st in range(16):
            ts = t0 + st * S
            if ts < 0 or ts > DUR:
                continue
            in_break = t_fail - 0.02 <= ts < drop - 0.01
            if in_break:
                continue
            if intro:
                if st in (0, 8):
                    add(M, K, ts, 0.8)
                if st % 2 == 0:
                    add(M, lp(H, 9000), ts, 0.13 + 0.05 * (ts / max(drop, 1)))
                if st % 4 == 2:
                    add(L, pluck(chord[st // 4 % 3] * 4), ts, 0.07)
                    add(R, pluck(chord[(st // 4 + 1) % 3] * 4), ts, 0.07)
                continue
            if outro:
                if ts < t_pass + 0.05:
                    continue
                if st == 0:
                    add(M, K, ts, 0.45)
                if st % 4 == 2:
                    add(L, pluck(chord[st // 4 % 3] * 4), ts, 0.045)
                    add(R, pluck(chord[(st // 4 + 1) % 3] * 4), ts, 0.045)
                continue
            kp = k_alt if b % 2 else k_main
            if st in kp:
                add(M, K, ts, 0.95)
            if st == 8:
                add(M, C, ts, 0.55)
            if st % 2 == 0:
                add(M, H, ts, 0.12 if st % 4 == 0 else 0.08)
            if b % 2 == 1 and st >= 12:
                add(M, H, ts, 0.09)
                add(M, H, ts + S / 2, 0.07)
            if st == 14 and b % 4 == 3:
                add(M, H2, ts, 0.10)
            if st in (0,) or (b % 2 and st == 10):
                add(M, bass808(root, BAR * (0.62 if st == 0 else 0.35)), ts, 0.55)
            add(L if st % 2 else R, pluck(chord[st % 3] * (4 if st % 8 < 4 else 8)), ts, 0.035)
    # crash at the drop and at mission passed
    for tc in (drop, t_pass):
        c = hp(noise(1.2), 5000) * np.exp(-tt(1.2) / 0.3)
        add(M, c, tc, 0.07)
    # fade out tail
    fo = int((DUR - 2.4) * SR)
    env = np.ones(N)
    env[fo:] = np.linspace(1, 0, N - fo) ** 1.5
    stereo = np.stack([L + M, R + M], 1) * env[:, None]
    return stereo / (np.max(np.abs(stereo)) + 1e-9) * 0.9


# ---------------------------------------------------------------- SFX
def whoosh(d=0.45, up=1.0):
    n = noise(d)
    t = tt(d)
    lo, mid, hi = bp(n, 150, 700), bp(n, 600, 2500), bp(n, 2000, 8000)
    x = t / d
    w_lo = np.clip(1 - 2 * x, 0, 1)
    w_mid = 1 - np.abs(2 * x - 1)
    w_hi = np.clip(2 * x - 1, 0, 1) if up > 0 else np.clip(1 - 2 * x, 0, 1)
    s = lo * w_lo + mid * w_mid * 1.2 + hi * w_hi * 0.8
    env = np.sin(np.pi * np.clip(x, 0, 1)) ** 1.5
    return s * env * 0.5


def blip(f0=700, f1=1100, d=0.07):
    t = tt(d)
    f = f0 + (f1 - f0) * t / d
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (d / 3))


def tick(p=1.0):
    t = tt(0.03)
    return np.sin(2 * np.pi * 2400 * p * t) * np.exp(-t / 0.005)


def keyclick():
    d = 0.03
    return bp(noise(d), 1800, 6000) * np.exp(-tt(d) / 0.004) * (0.7 + 0.6 * rng.random())


def mouse():
    s = np.zeros(int(0.08 * SR))
    for k, g in ((0, 1.0), (0.045, 0.6)):
        add(s, bp(noise(0.02), 2000, 7000) * np.exp(-tt(0.02) / 0.002), k, g)
    return s


def thump(f=70, d=0.35):
    t = tt(d)
    ff = f + 80 * np.exp(-t / 0.02)
    return np.tanh(2 * np.sin(2 * np.pi * np.cumsum(ff) / SR) * np.exp(-t / (d / 3))) + \
        0.5 * lp(noise(d), 1200) * np.exp(-t / 0.03)


def boom(d=1.4):
    t = tt(d)
    f = 34 + 60 * np.exp(-t / 0.08)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    s += 0.6 * lp(noise(d), 400) * np.exp(-t / 0.18)
    return np.tanh(1.8 * s)


def bell(f, d=0.9):
    t = tt(d)
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (d / (1 + m))) for m, a in ((1, 1), (2.01, .4), (3.0, .2), (4.2, .1)))
    return s * np.minimum(1, t / 0.003)


def error_tone():
    out = np.zeros(int(0.8 * SR))
    for k, f in ((0, 220), (0.16, 174.6)):
        t = tt(0.3)
        s = lp(saw(f, 0.3) + saw(f * 1.01, 0.3), 1800) * np.exp(-t / 0.12)
        add(out, s, k, 0.5)
    return out


def success():
    out = np.zeros(int(2.0 * SR))
    for i, f in enumerate((523.25, 659.25, 783.99, 1046.5)):
        add(out, bell(f, 1.4), i * 0.07, 0.35)
    add(out, hp(noise(1.6), 6000) * np.exp(-tt(1.6) / 0.5), 0.05, 0.08)
    return out


def scrub(d):
    t = tt(d)
    f = 300 + 900 * (0.5 + 0.5 * np.sin(2 * np.pi * 6.3 * t) * np.sin(2 * np.pi * 1.7 * t + 1))
    ph = np.cumsum(f) / SR
    s = (2 * (ph % 1) - 1)
    s = bp(s + 0.6 * noise(d), 400, 3500)
    gate = (np.sin(2 * np.pi * 22 * t) > -0.3).astype(float)
    return lp(gate, 200) * s * np.minimum(1, t / 0.05) * np.minimum(1, (d - t) / 0.08) * 0.35


def scan(d, p=1.0):
    t = tt(d)
    f = (380 + 520 * t / d) * p
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.1
    env = np.minimum(1, t / 0.1) * np.minimum(1, (d - t) / 0.15)
    out = s * env
    for k in np.arange(0, d, 0.06):
        add(out, tick(1.3), k, 0.15)
    return out


def riser(d):
    t = tt(d)
    x = t / d
    n = noise(d)
    s = bp(n, 800, 6000) * x ** 2.5
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * x ** 2) / SR) * 0.15 * x ** 2
    return (s * 0.5 + tone)


def counter(d):
    out = np.zeros(int((d + 0.05) * SR))
    for k in np.arange(0, d, 0.035):
        add(out, tick(1.6 + k), k, 0.35)
    return out


def sfx_track():
    S = np.zeros(N)
    for c in CUES:
        g = c.get("g", 1.0)
        p = c.get("p", 1.0)
        t = c["t"]
        k = c["type"]
        if k == "whoosh":
            add(S, whoosh(0.5), t - 0.08, 0.55 * g)
        elif k == "swoosh":
            add(S, whoosh(0.3), t - 0.03, 0.35 * g)
        elif k == "pop":
            add(S, blip(600 * p, 1000 * p, 0.07), t, 0.22 * g)
        elif k == "tick":
            add(S, tick(p), t, 0.35 * g)
        elif k == "type":
            add(S, keyclick(), t, 0.5 * g)
        elif k == "click":
            add(S, mouse(), t, 0.7 * g)
        elif k == "stamp":
            add(S, thump(70, 0.35), t, 0.6 * g)
        elif k == "fail":
            add(S, error_tone(), t, 0.2)
            add(S, boom(1.6), t, 0.4)
        elif k == "pass":
            add(S, success(), t, 0.22)
            add(S, boom(1.4), t, 0.22)
        elif k == "boom":
            add(S, boom(1.2), t, 0.6 * g)
        elif k == "ding":
            add(S, bell(880 * p, 0.6), t, 0.12)
        elif k == "check":
            add(S, bell(1320, 0.4), t, 0.10)
            add(S, tick(1.2), t, 0.2)
        elif k == "scrub":
            add(S, scrub(c["dur"]), t, 0.5)
        elif k == "scan":
            add(S, scan(c["dur"], p), t, 0.45 * g)
        elif k == "count":
            add(S, counter(c["dur"]), t, 0.5)
        elif k == "drop":
            fail_t = cue_t("fail")[0]["t"]
            r0 = fail_t + 0.35
            add(S, riser(t + 0.12 - r0), r0, 0.28)
            add(S, boom(1.0), t + 0.12, 0.2)
    return S


def load_vo():
    tmp = os.path.join(ROOT, BUILD, "vo48.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", (os.path.join(ROOT, BUILD, "vo.wav") if os.path.exists(os.path.join(ROOT, BUILD, "vo.wav")) else os.path.join(ROOT, "audio/vo.wav")), "-ar", str(SR), "-ac", "1", tmp], check=True)
    v, _ = sf.read(tmp)
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    return out


def envelope(x, att=0.01, rel=0.25):
    blk = 480
    nb = len(x) // blk + 1
    m = np.array([np.abs(x[i * blk:(i + 1) * blk]).max() if i * blk < len(x) else 0.0 for i in range(nb)])
    ka, kr = np.exp(-blk / (att * SR)), np.exp(-blk / (rel * SR))
    out, e = np.zeros(nb), 0.0
    for i, v in enumerate(m):
        e = v + (e - v) * (ka if v > e else kr)
        out[i] = e
    return np.repeat(out, blk)[: len(x)]


if __name__ == "__main__":
    os.makedirs(os.path.join(ROOT, "audio"), exist_ok=True)
    mus = music()
    sfx = sfx_track()
    vo = load_vo()
    venv = envelope(vo)
    duck = 1 - 0.6 * np.clip(venv / 0.05, 0, 1)
    duck = lp(duck, 8, 1)
    sf.write(os.path.join(ROOT, BUILD, "music.wav"), mus, SR)
    sf.write(os.path.join(ROOT, BUILD, "sfx.wav"), sfx, SR)
    L = int(DUR * SR)
    sduck = 1 - 0.5 * np.clip(venv / 0.05, 0, 1)
    sduck = lp(sduck, 20, 1)
    m_vo = mus[:L] * (0.30 * duck[:L])[:, None] + (sfx[:L] * 0.7 * sduck[:L])[:, None] + (vo[:L] * 1.0)[:, None]
    m_novo = mus[:L] * 0.5 + (sfx[:L] * 0.9)[:, None]
    for name, m in (("mix", m_vo), ("mix_novo", m_novo)):
        m = np.tanh(m * 1.1) / np.tanh(1.1)
        sf.write(os.path.join(ROOT, BUILD, f"{name}_raw.wav"), m.astype(np.float32), SR)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", os.path.join(ROOT, BUILD, f"{name}_raw.wav"),
                        "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", str(SR), os.path.join(ROOT, BUILD, f"{name}.wav")], check=True)
    print("audio ok", DUR)

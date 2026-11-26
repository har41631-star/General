"""Sound for "Who Got the Better Grades?": an original playful score + synthesized SFX on the picture's beats, mixed
under the three voices. Built on the bridge short's own DSP kit (audio/dsp.py, instruments.py, sfx_gen.py): no samples.

Every time comes from grades/voice/timeline.json with the same formulas as src/videos/grades/story.ts, so a new
voice take re-times the sound too. Standard mix (skill rule): music +3 dB vs the old default, SFX -6 dB, voice gain only.

usage: python3 grades/audio.py      -> grades/audio/mix.wav (+ stems), 48 kHz stereo, exactly the picture's length
"""
import json, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), "audio"))
from dsp import SR, ns, tt, rng, dbg, lp, hp, bp, pan, st, place, fades, widen, make_ir, convolve_st, integrated, true_peak, read_wav, write_wav, phase, modal, colored  # noqa: E402
import instruments as I  # noqa: E402
import sfx_gen as G  # noqa: E402

TL = json.load(open(os.path.join(HERE, "voice", "timeline.json")))
LN = {l["id"]: l for l in TL["lines"]}
S = lambda i: LN[i]["s"]
E = lambda i: LN[i]["e"]
W = lambda i, k: LN[i]["words"][min(k, len(LN[i]["words"]) - 1)]["s"]
DUR = TL["frames"] / 30
N = ns(DUR)
R = rng(7)
F = I.m2f

# ---------------- picture beats (mirrors story.ts) ----------------
SPLIT_END = S("m1") - 0.25
M4 = S("m4") - 0.1
HIGH = W("m4", 4) - 0.1
NOTES = S("m5") - 0.12
LEO_LEC = S("l1") - 0.2
HALL = S("l3") - 0.1
BONK = E("l3") + 0.15
THINK = S("l4") + 0.75
BULB = W("l5", 9)
LAPTOP = S("a1") - 0.1
DROP = W("a1", 5)
DOC_IN = S("a2") - 0.3
READY = W("a2", 10) - 0.1
QUIZ = S("a3") - 0.1
BUS = S("a4") - 0.05
LUNCH = S("a5") - 0.05
LIFE = S("a6") - 0.05
LIB = S("c1") - 0.15
CLOSE = W("c2", 3)
BUCKET = S("c3") - 0.2
SHELF0 = S("c4") - 0.1
SHELF = W("c4", 5)
EXAM = S("e1") - 0.15
BLANK = W("e2", 5)
RECALL = W("e3", 3)
REVEAL = S("r1") - 0.15
YAY = S("r2")
TOOLS = S("r3") - 0.1
BENCH = S("b1") - 0.3
SKIP = S("w1") - 0.75
END = S("end") - 0.3

music = np.zeros((2, N))
sfx = np.zeros((2, N))


def m(x, t, g=0.0, p=0.0):
    place(music, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(g))


def s(x, t, g=0.0, p=0.0):
    place(sfx, pan(x, p) if np.ndim(x) == 1 else x, t, dbg(g))


# ================================================================ score
CH = {  # chord tones (midi) for comping, root for the bass
    "F": ([65, 69, 72], 41), "Bb": ([65, 70, 74], 46), "C": ([64, 67, 72], 48), "C7": ([64, 70, 72], 48), "Dm": ([65, 69, 74], 50),
    "Gm": ([67, 70, 74], 43), "Am": ([64, 69, 72], 45), "A7": ([61, 64, 67], 45), "E": ([64, 68, 71], 40), "Eb": ([67, 70, 75], 51),
}


def groove(t0, t1, prog, bpm, vel=0.6, swing=0.0, comp=True, bassv=0.8, brush=True, beats=4, mel=None, mel_inst="glock", stop_at=None):
    """pizzicato bass on 1/3, chord stabs on 2/4 (or off-beats), soft brushes; prog = chords per bar, looped"""
    q = 60.0 / bpm
    bar = 0
    t = t0
    while t < t1 - 0.05:
        ch = prog[bar % len(prog)]
        tones, root = CH[ch]
        for b in range(beats):
            tb = t + b * q + (swing * q if b % 2 else 0)
            if tb >= t1 or (stop_at and stop_at[0] <= tb < stop_at[1]):
                continue
            if b % 2 == 0:
                m(I.pluck(F(root + (0 if b == 0 else 7)), 0.85 * bassv, R, dur=0.7, bright=0.3), tb, -2, -0.15)
            elif comp:
                for k, n in enumerate(tones):
                    m(I.pluck(F(n), 0.45 * vel, R, dur=0.45, bright=0.7), tb + 0.008 * k, -6, 0.25 - 0.2 * k)
            if brush:
                m(I.brush(0.55 if b % 2 else 0.35, R, swish=(b % 2 == 1)), tb, -12, 0.3)
        if mel:
            for (beat, length, note) in mel(bar):
                tb = t + beat * q
                if t0 <= tb < t1 and not (stop_at and stop_at[0] <= tb < stop_at[1]):
                    x = {"glock": lambda f: I.glock(f, 0.6, R, dur=1.2), "mbox": lambda f: I.musicbox(f, 0.6, R, dur=1.2),
                         "vibes": lambda f: I.vibes(f, 0.55, R, dur=max(0.6, length * q + 0.4))}[mel_inst](F(note))
                    m(x, tb, -7, -0.2)
        t += beats * q
        bar += 1


def padsec(t0, t1, chords, vel=0.45, g=-8, warm=900):
    seg = (t1 - t0) / len(chords)
    for i, ch in enumerate(chords):
        tones, root = CH[ch]
        m(I.pad([F(n - 12) for n in tones] + [F(root)], seg + 0.2, vel, R, att=0.4, rel=0.8, warm=warm), t0 + i * seg, g)


def arp(t0, notes, step, inst="mbox", g=-6, p=0.0):
    for i, n in enumerate(notes):
        x = I.musicbox(F(n), 0.6, R, dur=1.0) if inst == "mbox" else I.glock(F(n), 0.6, R, dur=1.0) if inst == "glock" else I.vibes(F(n), 0.5, R, dur=1.0)
        m(x, t0 + i * step, g, p)


# hook: curious pizzicato vamp, a question motif, unresolved C7 into the flash
q_mel = lambda bar: [(0, 1, 72), (1, 0.5, 74), (1.5, 0.5, 76), (2, 1, 77), (3, 1, 79)] if bar % 2 == 0 else [(0, 1, 77), (1, 1, 74), (2, 2, 79)]
groove(0.15, SPLIT_END - 0.15, ["F", "Dm", "Bb", "C7"], 112, mel=q_mel)
m(I.triangle(0.5, R, dur=1.4), SPLIT_END, -8)
# Marcus: determined, straight (brisk snare ticks, vibes line)
mar_mel = lambda bar: [(0, 2, 69), (2, 1, 72), (3, 1, 74)] if bar % 2 == 0 else [(0, 3, 77), (3, 1, 76)]
groove(SPLIT_END + 0.05, M4 - 0.1, ["Dm", "Bb", "Gm", "A7"], 112, brush=False, mel=mar_mel, mel_inst="vibes")
for k in range(int((M4 - SPLIT_END) / (60 / 112))):
    m(I.snare(0.35, R, tune=1.3), SPLIT_END + k * 60 / 112 + (30 / 112), -16, 0.2)
# 3 a.m.: tired, slow pad in D minor, sparse plucks
padsec(M4, LEO_LEC - 0.1, ["Dm", "Gm", "Dm", "A7"], 0.4, -10, 700)
for k, n in enumerate([62, 65, 69, 65, 62, 65, 69, 72, 69, 65]):
    m(I.pluck(F(n), 0.45, R, dur=0.9, bright=0.3), M4 + 0.4 + k * 0.55, -10, -0.2)
# Leo: goofy, swung, music box; drops out for the bonk
leo_mel = lambda bar: [(0, 0.5, 72), (0.75, 0.5, 74), (1.5, 0.5, 77), (2.5, 1, 74)] if bar % 2 == 0 else [(0, 0.5, 79), (1, 0.5, 77), (2, 1, 72)]
groove(LEO_LEC, THINK - 0.1, ["F", "Bb", "F", "C"], 108, swing=0.16, mel=leo_mel, mel_inst="mbox", stop_at=(BONK - 0.05, BONK + 0.9))
# the idea + the app: warm pad, then sparkle when Dr. Synapse appears
padsec(THINK, LAPTOP, ["Bb", "F", "C"], 0.4, -10)
arp(BULB, [72, 76, 79, 84], 0.07, "glock", -6)
groove(LAPTOP, QUIZ - 0.05, ["F", "Am", "Bb", "C"], 112, vel=0.5, brush=True, comp=True)
arp(DOC_IN - 0.1, [72, 74, 76, 77, 79, 81, 84, 86, 88], 0.035, "mbox", -5)
arp(READY, [79, 84, 88], 0.09, "glock", -5)
# montage: upbeat
mon_mel = lambda bar: [(0, 0.5, 77), (0.5, 0.5, 79), (1, 1, 81), (2, 0.5, 79), (2.5, 0.5, 77), (3, 1, 74)] if bar % 2 == 0 else [(0, 1, 72), (1, 1, 74), (2, 2, 77)]
groove(QUIZ, LIB - 0.1, ["F", "C", "Dm", "Bb"], 120, mel=mon_mel, mel_inst="glock")
# the cracks: minor, sparse; "gone" falls away; the shelf resolves warm
padsec(LIB, BUCKET, ["Dm", "Gm", "A7"], 0.38, -11, 650)
for k in range(6):
    m(I.pluck(F([50, 53, 57, 53, 50, 45][k]), 0.5, R, dur=1.0, bright=0.2), LIB + 0.5 + k * 0.75, -9)
arp(BUCKET + 0.1, [84, 81, 77, 74, 72, 69, 65], 0.12, "mbox", -7)
padsec(SHELF0, EXAM - 0.05, ["F", "Bb"], 0.42, -10)
arp(SHELF, [77, 81, 84], 0.08, "glock", -6)
# the exam: ticking ostinato in D minor, building; a bright hit on the recall
q_ex = 60 / 126
k = 0
while EXAM + k * q_ex < REVEAL - 0.1:
    tb = EXAM + k * q_ex
    build = (tb - EXAM) / (REVEAL - EXAM)
    m(I.pluck(F([38, 38, 45, 38][k % 4]), 0.6 + 0.3 * build, R, dur=0.4, bright=0.2), tb, -5)
    if k % 2 == 1:
        m(I.pluck(F([62, 65][k // 2 % 2]), 0.4 + 0.3 * build, R, dur=0.3, bright=0.6), tb, -9, 0.3)
    k += 1
padsec(EXAM, RECALL, ["Dm", "Dm", "A7"], 0.35 + 0.0, -13, 600)
arp(RECALL - 0.05, [74, 77, 81, 86], 0.06, "glock", -4)
padsec(RECALL, REVEAL, ["F"], 0.4, -11)
# the reveal: fanfare on "you were right", then a bright groove
for i, (dt, n, d) in enumerate([(0, 60, 0.2), (0.2, 65, 0.2), (0.4, 69, 0.2), (0.6, 72, 0.9)]):
    m(I.brass(F(n), d, 0.8, R, kind="horn"), YAY - 0.05 + dt, -8, 0.1)
m(I.cymbal(0.5, R, dur=2.2), YAY + 0.55, -12)
groove(YAY + 0.6, BENCH - 0.1, ["F", "Bb", "C", "F"], 120, mel=mon_mel, mel_inst="vibes")
# the bench: soft, warm
padsec(BENCH, SKIP, ["Bb", "F"], 0.4, -11)
for k, n in enumerate([69, 72, 77, 76, 72]):
    m(I.vibes(F(n), 0.45, R, dur=1.2), BENCH + 0.3 + k * 0.55, -10)
# ceremony + end card: the theme, full and warm, final chord rings out
end_mel = lambda bar: [(0, 1, 72), (1, 0.5, 74), (1.5, 0.5, 76), (2, 1, 77), (3, 1, 81)] if bar % 2 == 0 else [(0, 2, 79), (2, 2, 77)]
groove(SKIP + 0.1, DUR - 2.4, ["F", "Dm", "Bb", "C"], 112, mel=end_mel, mel_inst="glock")
padsec(SKIP + 0.1, DUR - 2.4, ["F", "Dm", "Bb", "C"], 0.35, -13)
tones, root = CH["F"]
for n in tones + [root + 12, 77]:
    m(I.vibes(F(n), 0.5, R, dur=2.6), DUR - 2.4, -8)
m(I.pluck(F(root - 12), 0.8, R, dur=2.0, bright=0.2), DUR - 2.4, -3)
m(I.triangle(0.45, R, dur=2.0), DUR - 2.4, -10)

# ================================================================ SFX
def blip(f0=600, f1=1400, dur=0.12, vel=1.0):
    t = tt(dur)
    f = f0 + (f1 - f0) * np.sqrt(np.clip(t / dur, 0, 1))
    return fades(np.sin(phase(f)) * np.exp(-t / (dur * 0.5)) * vel, 0.001, 0.02)


def boing(dur=0.6, f=220):
    t = tt(dur)
    fr = f * (1 + 0.5 * np.exp(-t / 0.08)) * (1 + 0.06 * np.sin(2 * np.pi * 18 * t) * np.exp(-t / 0.3))
    return fades(np.sin(phase(fr)) * np.exp(-t / 0.22), 0.001, 0.05)


def tick(vel=1.0, f=2600):
    t = tt(0.05)
    return modal(0.05, [(f, 1.0, 0.006), (f * 1.7, 0.5, 0.004)], R) * vel + bp(R.standard_normal(len(t)), 2000, 7000) * np.exp(-t / 0.002) * 0.3 * vel


def marker(dur=0.22):
    t = tt(dur)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.8
    return bp(R.standard_normal(len(t)), 1800, 6500) * e * 0.5 + np.sin(phase(1100 + 300 * t)) * e * 0.04


def scribble(dur=0.6):
    t = tt(dur)
    e = (0.5 + 0.5 * np.sin(2 * np.pi * 9 * t + 1.0) ** 2) * np.minimum(1, t / 0.02) * np.minimum(1, (dur - t) / 0.05)
    return bp(R.standard_normal(len(t)), 2500, 8000) * e * 0.35


def drip():
    t = tt(0.18)
    return np.sin(phase(1300 - 3000 * t)) * np.exp(-t / 0.04) * 0.6


def chime(notes, step=0.07, g=0.6):
    out = np.zeros(ns(step * len(notes) + 1.2))
    for i, n in enumerate(notes):
        x = I.glock(F(n), g, R, dur=1.0)
        out[ns(i * step): ns(i * step) + len(x)] += x[: len(out) - ns(i * step)]
    return out


def card_pop(t):
    s(blip(500, 1200, 0.1), t, -10)
    s(G.whoosh(0.25, R, peak=0.08, f_lo=900, f_hi=3500, tail=0.08), t - 0.05, -14)


def card_flip(t, correct=True):
    s(G.whoosh(0.18, R, peak=0.06, f_lo=1500, f_hi=4500, tail=0.05), t - 0.06, -12)
    if correct:
        s(chime([84, 91], 0.08), t + 0.1, -8)


def whoosh_cut(t, g=-12):
    s(G.whoosh(0.5, R, peak=0.3, tail=0.12), t - 0.3, g)


# hook
for t, p in [(W("hook2", 3), -0.3), (W("hook2", 4) + 0.1, 0.3)]:
    s(blip(500, 1300, 0.14), t, -6, p)
s(G.bird_chirps(SPLIT_END, R, density=0.25), 0, -30)
whoosh_cut(SPLIT_END, -8)
s(blip(400, 900, 0.18), S("m1") - 0.1, -12)  # name card
s(blip(400, 900, 0.18), S("l1") - 0.1, -12)
s(blip(700, 1500, 0.12), W("m3", 0) + 0.1, -9)  # badge
s(blip(700, 1500, 0.12), S("a3") + 0.2, -9)
# 3 a.m.: clock ticks, can, highlighter strokes, scribbling, x3
for k in range(int((HIGH - M4) / 0.5) + 1):
    s(tick(0.9 if k % 2 else 0.7, 2400 if k % 2 else 2900), M4 + k * 0.5, -10)
s(G.crickets(LEO_LEC - M4, R), M4, -30)
for k in range(int((NOTES - HIGH) / 0.3)):
    s(marker(0.2), HIGH + 0.05 + k * 0.3, -14, -0.1)
s(scribble(S("m6") - NOTES - 0.1), NOTES + 0.05, -14)
s(blip(300, 900, 0.16), S("m6"), -6)
s(G.wood_crack(R) * 0.3, S("m6"), -14)
# lecture: murmur, ?-pops
for k in range(6):  # a quiet lecture-hall murmur: a few far voices
    s(G.babble(BONK - LEO_LEC - 2.0, R, R.uniform(110, 220), R.uniform(0.95, 1.15), R.uniform(3.6, 4.8), R.uniform(0.5, 0.7), fmax=3400), LEO_LEC, -34, R.uniform(-0.8, 0.8))
for i in range(2):
    s(blip(520, 1250, 0.12), W("l2", 5) + 0.15 + i * 0.35, -9, -0.2 + 0.4 * i)
# hallway: footsteps, the bonk, stars
for k in range(int((BONK - HALL) / 0.38)):
    s(G.stroll_step(R, 0.6), HALL + 0.05 + k * 0.38, -14, -0.2 + 0.03 * k)
s(G.hammer_hit(R, 0.9), BONK, -6)
s(boing(0.7, 180), BONK + 0.02, -8)
for k in range(6):
    s(I.glock(F([96, 100, 103][k % 3]), 0.35, R, dur=0.4), BONK + 0.35 + k * 0.13, -14, 0.2)
# lightbulb, laptop, Dr. Synapse
s(chime([88, 96], 0.06), BULB, -7)
whoosh_cut(LAPTOP, -14)
s(G.whoosh(0.6, R, peak=0.45, f_lo=600, f_hi=2600, tail=0.1), DROP - 0.6, -12)
s(blip(300, 700, 0.12), DROP, -8)
s(boing(0.45, 300), DOC_IN, -9)
s(G.whoosh(0.4, R, peak=0.1, f_lo=1200, f_hi=6000, tail=0.15), DOC_IN - 0.05, -10)
s(chime([84, 88, 91, 96], 0.05), READY, -8)
# flashcards: pops, flips, correct chimes
card_pop(S("a3") + 0.15); card_flip(W("a3", 5))
card_pop(S("a4") + 0.05); card_flip(S("a4") + 0.55)
card_pop(S("a5") + 0.05); card_flip(S("a5") + 0.6)
# bus rumble, cafeteria
t_bus = tt(LUNCH - BUS)
s(lp(colored(len(t_bus), R, 1.2), 180) * 0.6 * (0.8 + 0.2 * np.sin(2 * np.pi * 0.7 * t_bus)), BUS, -16)
for k in range(8):  # cafeteria chatter
    s(G.babble(LIB - LUNCH - 0.2, R, R.uniform(110, 230), R.uniform(0.95, 1.15), R.uniform(3.6, 4.8), R.uniform(0.55, 0.8), fmax=3400), LUNCH, -30, R.uniform(-0.9, 0.9))
for k in range(10):
    s(G.clink(R) * 0.5, LUNCH + 0.15 + k * 0.33 * (1 + 0.2 * np.sin(k)), -22, 0.4 * np.sin(k * 1.7))
# library: night, book thump
s(G.crickets(BUCKET - LIB, R), LIB, -30)
s(G.hammer_hit(R, 0.35) * 0.6, CLOSE + 0.25, -10)
s(G.wood_crack(R) * 0.3, CLOSE + 0.25, -10)
# the bucket: drips, paper falling; the shelf: box slides in, clunk
for k in range(9):
    s(drip(), BUCKET + 0.1 + k * 0.17, -10, -0.3 + 0.07 * k)
for i in range(4):
    s(G.whoosh(0.35, R, peak=0.1, f_lo=1500, f_hi=4000, tail=0.15), BUCKET + 0.15 + i * 0.3, -18)
s(G.whoosh(0.6, R, peak=0.45, f_lo=300, f_hi=1200, tail=0.1), SHELF - 0.55, -14)
s(G.hammer_hit(R, 0.4), SHELF, -12)
# exam: clock ticks, gulp/blank, recall sparkle
whoosh_cut(EXAM, -12)
for k in range(int((REVEAL - EXAM) / 0.5)):
    s(tick(0.8, 2500 + 400 * (k % 2)), EXAM + k * 0.5, -13)
s(scribble(1.0), RECALL + 0.5, -16, 0.2)
s(blip(900, 300, 0.25), BLANK, -9)  # the blank: a falling blip
s(G.whoosh(0.4, R, peak=0.08, f_lo=2000, f_hi=8000, tail=0.2), RECALL - 0.1, -9)
card_pop(RECALL - 0.05); card_flip(RECALL + 0.35)
# the reveal: party poppers, cheer
for p in (-0.5, 0.5):
    s(bp(R.standard_normal(ns(0.15)), 800, 6000) * np.exp(-tt(0.15) / 0.03), YAY + 0.02, -6, p)
s(G.whoa(R, dur=0.45), YAY + 0.1, -16)
s(blip(700, 1500, 0.12), YAY - 0.05, -9)
# bench, time skip, ceremony applause, end card
whoosh_cut(BENCH, -14)
s(G.whoosh(1.0, R, peak=0.7, f_lo=300, f_hi=4000, tail=0.2), SKIP - 0.7, -6)
app_d = END - SKIP + 1.5
env = np.clip(tt(app_d) / 0.6, 0, 1) * np.clip((app_d - tt(app_d)) / 1.2, 0, 1)
s(G.applause(app_d, R, people=40, env=env), SKIP + 0.2, -18)
s(G.whoosh(0.7, R, peak=0.5, f_lo=400, f_hi=3000, tail=0.2), END - 0.4, -10)
s(chime([77, 81, 84, 89], 0.08), END + 0.6, -8)

# ================================================================ mix
def read_voice():
    x, sr = read_wav(os.path.join(HERE, "voice", "voice.wav"))
    assert sr == SR, sr
    v = x[0] if x.shape[0] == 1 else x.mean(0)
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    return st(out)


def duck_env():
    """music dips -3 dB under speech (keyed from the word times, 70 ms attack / 450 ms release)"""
    g = np.zeros(N)
    for l in TL["lines"]:
        a, b = ns(l["s"] - 0.08), ns(l["e"] + 0.12)
        g[max(0, a):min(N, b)] = 1
    k = np.exp(-np.arange(ns(0.45)) / ns(0.12))
    from scipy.signal import fftconvolve
    sm = np.clip(fftconvolve(g, k / k.sum(), mode="same"), 0, 1)
    return dbg(-3.0 * sm)


voice = read_voice()
ir = make_ir(0.9, 3)
music_w = convolve_st(music, ir) * 0.25 + music
sfx_w = convolve_st(sfx, ir) * 0.15 + sfx
music_w = music_w[:, :N] * duck_env()[None, :]
sfx_w = sfx_w[:, :N]
# levels relative to the voice (LU): music sits ~10 LU under, SFX ~12 under (the -6 dB SFX rule)
lv = integrated(voice)
music_w *= dbg((lv - 10.0) - integrated(music_w))
sfx_w *= dbg((lv - 12.0) - integrated(sfx_w))
mix = voice + music_w + sfx_w
mix *= dbg(-15.0 - integrated(mix))
# look-ahead peak limiter to -1.2 dBFS (4x oversampled peak estimate)
from scipy.signal import resample_poly
ceil = dbg(-1.4)
pk = np.abs(resample_poly(mix, 4, 1, axis=1)).max(0).reshape(-1, 4).max(1)[:N]
need = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
from scipy.ndimage import minimum_filter1d, uniform_filter1d
g = minimum_filter1d(need, ns(0.006))
g = uniform_filter1d(g, ns(0.004))
g = np.minimum(g, minimum_filter1d(need, ns(0.002)))
mix *= g[None, :]
fade = np.ones(N); fade[-ns(0.8):] = np.linspace(1, 0, ns(0.8)) ** 2
mix *= fade[None, :]
od = os.path.join(HERE, "audio")
os.makedirs(od, exist_ok=True)
write_wav(os.path.join(od, "mix.wav"), mix)
write_wav(os.path.join(od, "stem_music.wav"), music_w)
write_wav(os.path.join(od, "stem_sfx.wav"), sfx_w)
write_wav(os.path.join(od, "mix_novoice.wav"), (music_w + sfx_w) * dbg(-15.0 - integrated(mix * 0 + voice + music_w + sfx_w)) * g[None, :] * fade[None, :])
print(f"mix {N / SR:.2f} s  I {integrated(mix):.1f} LUFS  TP {true_peak(mix):.1f} dBTP  "
      f"voice {integrated(voice):.1f}  music {integrated(music_w):.1f}  sfx {integrated(sfx_w):.1f}")

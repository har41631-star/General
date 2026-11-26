// "Who Got the Better Grades?" — the shot plan. Every shot is timed to the voice (grades/voice/timeline.json: line id ->
// start / end / word times), so re-recording the voice re-times the picture. Camera grammar from the bridge short:
// hard cuts between shots, smootherstep glides of 18-40 f inside a shot, every hold creeps in, flip-sign kicks on
// impacts, rolls of ~4 deg on punch words.
import TL from "../../../grades/voice/timeline.json";
import * as THREE from "three";
import { Outfit, Expr, FrontOpts, Pen, fxBurst, fxStars, fxNote } from "./toon";
import { CamInfo, Stage, person, doc, blob, lidAt, hh, q, FxPlace } from "./cards";
import { SETS, SetName } from "./sets";
import { flashTex, examTex, factTex } from "./tex";

export const FPS = 30;
export const TOTAL: number = TL.frames;
type Line = { id: string; s: number; e: number; words: { w: string; s: number; e: number }[] };
const LINES: Record<string, Line> = Object.fromEntries((TL.lines as Line[]).map((l) => [l.id, l]));
/** start / end of a voice line (s) */
export const S = (id: string) => LINES[id].s;
export const E = (id: string) => LINES[id].e;
/** start of word k of a line (s) */
export const Wd = (id: string, k: number) => LINES[id].words[Math.min(k, LINES[id].words.length - 1)].s;
/** speaking amount 0..1 for a talking mouth: open on word vowels, closed between words */
export const talkAt = (id: string, t: number) => {
  const l = LINES[id];
  if (t < l.s || t > l.e) return 0;
  const w = l.words.find((x) => t >= x.s && t < x.e);
  if (!w) return 0;
  const u = (t - w.s) / Math.max(0.05, w.e - w.s), syl = Math.max(1, Math.round((w.e - w.s) / 0.17));
  return q(Math.abs(Math.sin(Math.PI * u * syl)), 4);
};

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
/** springy pop 0 -> 1 with a small overshoot, over `dur` s */
export const pop = (t: number, t0: number, dur = 0.28) => {
  const u = (t - t0) / dur;
  if (u <= 0) return 0;
  if (u >= 1.6) return 1;
  return 1 + Math.exp(-4 * u) * Math.sin(u * 6.5 - Math.PI / 2) * (u < 0.25 ? 1 : 1);
};

// ---------------- cast ----------------
export const MARCUS: Outfit = { jacket: "#3c5a8c", pants: "#3b3f52", boots: "#2b2b33", hat: "hair", hair: "#3a2a20", style: "neat", glasses: "#1c1420", skin: "#f5c9a0" };
export const MARCUS_NIGHT: Outfit = { ...MARCUS, bags: true };
export const LEO: Outfit = { jacket: "#f08a2c", hood: "#ffe2c0", pants: "#3b5b9a", boots: "#f4f1ea", hat: "hair", hair: "#6b3f22", style: "messy", headphones: "#2fbf9f", skin: "#ecd0b6" };
const LEO_BARE: Outfit = { ...LEO, headphones: undefined };
const coat = (o: Outfit): Outfit => ({ ...o, coat: true, headphones: undefined, jacket: o === LEO ? "#7fb2e6" : "#3c5a8c", hood: undefined });
const STUDENTS: Outfit[] = [
  { jacket: "#5d7a3a", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#2a201a", skin: "#c99067" },
  { jacket: "#c25a7a", pants: "#2f3550", boots: "#2b2b33", hat: "hair", hair: "#8a4a2a", style: "bun", skin: "#ffe2c2" },
  { jacket: "#2f5f6a", pants: "#4a3f52", boots: "#2b2b33", hat: "hair", hair: "#1a1a1a", skin: "#f5c9a0" },
  { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#4a3426", hat: "hair", hair: "#d9a441", style: "bun", skin: "#ecd0b6" },
  { jacket: "#b5653f", pants: "#2f3550", boots: "#2b2b33", hat: "cap", cap: "#3f6fb5", skin: "#c99067" },
  { jacket: "#3f6fb5", pants: "#3b3f52", boots: "#2b2b33", hat: "hair", hair: "#5a3b2a", skin: "#f5c9a0" },
];

// ---------------- shots ----------------
export type Light = "day" | "night" | "golden" | "stage" | "brain";
export type Key = { t: number; dur?: number; pos: [number, number, number]; look: [number, number, number]; fov?: number; roll?: number; push?: number };
export type Shot = {
  id: number; a: number; b: number; set: SetName; light: Light;
  cam: Key[]; dof: number | ((t: number) => number); focus?: (t: number) => [number, number, number];
  cast: (t: number, c: CamInfo, out: Stage) => void;
  sun?: [number, number]; // camera-relative sun az / el (deg)
  kicks?: number[];
};
const f = (s: number) => Math.round(s * FPS);
const O = (set: SetName, x: number, y: number, z: number): [number, number, number] => [SETS[set] + x, y, z];

// helpers for staging
const sitM = (c: CamInfo, out: Stage, set: SetName, x: number, y: number, z: number, fo: FrontOpts, o: Outfit = MARCUS, i = 1) =>
  out.places.push(person(c, i, o, o === MARCUS ? "M" : o.bags ? "Mn" : o.coat ? "Mc" : "M?", SETS[set] + x, y, z, { mode: "sit", ...fo }));
const sitL = (c: CamInfo, out: Stage, set: SetName, x: number, y: number, z: number, fo: FrontOpts, o: Outfit = LEO, i = 2, mirror = false) =>
  out.places.push(person(c, i, o, o === LEO ? "L" : o.coat ? "Lc" : "Lb", SETS[set] + x, y, z, { mode: "sit", ...fo }, { mirror }));
const fx = (out: Stage, p: FxPlace) => out.fx.push(p);
const qmark = (p: Pen) => {
  p.g.font = "700 300px Fredoka"; p.g.textAlign = "center"; p.g.textBaseline = "middle";
  p.g.lineWidth = 34; p.g.strokeStyle = "#1c1420"; p.g.lineJoin = "round"; p.g.strokeText("?", 150, 170);
  p.g.fillStyle = "#ffd84a"; p.g.fillText("?", 150, 170);
};
const texCard = (tex: THREE.Texture) => (p: Pen) => { const im = tex.image as HTMLCanvasElement; p.g.drawImage(im, 0, 0, p.g.canvas.width / p.g.getTransform().a, p.g.canvas.height / p.g.getTransform().d); };
/** a flashcard pop + flip (front -> back at tFlip) */
const flashcard = (out: Stage, t: number, t0: number, tFlip: number, x: number, y: number, z: number, w = 0.5, check = true) => {
  const s = pop(t, t0, 0.3);
  if (s <= 0.01) return;
  const fl = t < tFlip ? 1 : clamp01((t - tFlip) / 0.12), sx = t < tFlip - 0.12 ? 1 : t < tFlip ? clamp01((tFlip - t) / 0.12) : fl;
  const back = t >= tFlip;
  fx(out, { key: `flash${back}`, cw: 768, ch: 480, draw: texCard(flashTex(!back)), x, y, z, w: w * s * Math.max(0.04, sx), h: w * 0.625 * s, rot: 0.04 * Math.sin(t * 2) });
  if (back && check) {
    const u = pop(t, tFlip + 0.1, 0.25);
    fx(out, { key: "check", cw: 256, ch: 256, draw: checkMark, x: x + w * 0.42, y: y + w * 0.3, z: z + 0.01, w: 0.18 * u, h: 0.18 * u });
  }
};
const checkMark = (p: Pen) => { p.ell(128, 128, 110, 110, "#2fb36a", 16); p.stroke([[70, 132], [112, 172], [186, 88]], 26, "#ffffff"); };
const bulb = (p: Pen) => {
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; p.stroke([[200 + 120 * Math.cos(a), 170 + 120 * Math.sin(a)], [200 + 170 * Math.cos(a), 170 + 170 * Math.sin(a)]], 14, "#ffd84a"); }
  p.ell(200, 170, 82, 86, "#fff3a0", 12);
  p.poly([[160, 245], [240, 245], [232, 300], [168, 300]], "#b8bfc9", 10);
  p.stroke([[180, 190], [200, 215], [220, 190]], 8, "#e0a020");
};
const sweat = (p: Pen) => p.poly([[60, 10], [100, 90], [60, 120], [20, 90]], "#9fd4ff", 8);
const confetti = (out: Stage, t: number, t0: number, cx: number, cy: number, cz: number, n = 26, spread = 2.4) => {
  if (t < t0) return;
  const cols = ["#ff5d8f", "#ffd84a", "#4fc3f7", "#7ed957", "#b57bff", "#ff9f43"];
  for (let i = 0; i < n; i++) {
    const age = t - t0 - hh(i, 3) * 0.6;
    if (age < 0) continue;
    const x = cx + (hh(i) - 0.5) * spread + 0.15 * Math.sin(age * 3 + i), y = cy + 1.6 - age * (0.55 + 0.4 * hh(i, 2)), z = cz + (hh(i, 4) - 0.5) * 0.8;
    if (y < 0.05) continue;
    const col = cols[i % 6], sp = q((age * (2 + 3 * hh(i, 5))) % (Math.PI * 2), 8);
    fx(out, { key: `conf${col}${sp}`, cw: 64, ch: 96, draw: (p) => { p.g.save(); p.g.translate(32, 48); p.g.scale(Math.cos(sp), 1); p.g.fillStyle = col; p.g.fillRect(-24, -36, 48, 72); p.g.restore(); }, x, y, z, w: 0.05, h: 0.075, rot: sp });
  }
};
/** talking face for a front card: open / closed mouth from the voice words */
const talkExpr = (id: string, t: number, open: Expr, shut: Expr): Expr => (talkAt(id, t) > 0.45 ? open : shut);

// ---------------- the shot list ----------------
const T0 = { m: S("m1") - 0.25 };
export const SHOTS: Shot[] = [];
const add = (sh: Omit<Shot, "id" | "a" | "b"> & { from: number; to: number }) => {
  const { from, to, ...rest } = sh;
  SHOTS.push({ ...rest, id: SHOTS.length + 1, a: f(from), b: f(to) } as Shot);
};

// 1 — split-screen hook (two cameras, see SPLIT in Grades.tsx): top = Marcus at his desk, bottom = Leo on the beanbag
add({ from: 0, to: T0.m, set: "dorm", light: "day", dof: 10, sun: [55, 35],
  cam: [{ t: 0, pos: O("dorm", -2.2, 1.4, 1.25), look: O("dorm", -2.4, 1.05, -1.5), fov: 62, push: 0.0022 }],
  focus: () => O("dorm", -2.4, 1.28, -1.55),
  cast: (t, c, out) => {
    sitM(c, out, "dorm", -2.4, 0.42, -1.55, { expr: t > Wd("hook2", 3) ? "focus" : "stern", prop: "highlighter", blink: lidAt(t, 1), look: t > Wd("hook2", 3) ? 0 : -1 });
    const s = pop(t, Wd("hook2", 3), 0.3);
    if (s > 0) fx(out, { key: "q", cw: 300, ch: 340, draw: qmark, x: SETS.dorm - 2.05, y: 1.75, z: -1.4, w: 0.28 * s, h: 0.32 * s, rot: 0.15 });
  } });
// split bottom half: an extra shot that only the split view uses (id 2)
add({ from: 0, to: 0, set: "dorm", light: "day", dof: 10, sun: [55, 35],
  cam: [{ t: 0, pos: O("dorm", 1.3, 0.95, 1.4), look: O("dorm", 1.25, 0.75, -0.9), fov: 64, push: 0.0022 }],
  focus: () => O("dorm", 1.25, 0.9, -0.85),
  cast: (t, c, out) => {
    sitL(c, out, "dorm", 1.25, 0.05, -0.75, { expr: t > Wd("hook2", 4) ? "smirk" : "smile_closed", prop: "chips", blink: lidAt(t, 2) });
    const s = pop(t, Wd("hook2", 4) + 0.1, 0.3);
    if (s > 0) fx(out, { key: "q", cw: 300, ch: 340, draw: qmark, x: SETS.dorm + 1.6, y: 1.25, z: -0.75, w: 0.26 * s, h: 0.3 * s, rot: -0.15 });
  } });
// 3 — "This is Marcus. Marcus is smart... outwork everyone."
add({ from: T0.m, to: S("m4") - 0.1, set: "dorm", light: "day", dof: 12, sun: [50, 35],
  cam: [
    { t: 0, pos: O("dorm", -2.0, 1.45, 1.6), look: O("dorm", -2.5, 1.25, -1.6), fov: 40, push: 0.0018 },
    { t: S("m2") + 0.6 - T0.m, dur: 30, pos: O("dorm", -2.9, 1.7, 1.3), look: O("dorm", -3.1, 1.6, -1.8), fov: 40, push: 0.0015 },
    { t: S("m3") - T0.m, dur: 22, pos: O("dorm", -2.35, 1.3, 0.35), look: O("dorm", -2.4, 1.22, -1.55), fov: 40, roll: 0.07, push: 0.004 },
  ],
  focus: (t) => (t > S("m2") + 0.9 && t < S("m3") ? O("dorm", -3.2, 1.9, -2.3) : O("dorm", -2.4, 1.3, -1.55)),
  cast: (t, c, out) => {
    const e: Expr = t < S("m2") ? "smile" : t < S("m3") ? "smile_closed" : "focus";
    sitM(c, out, "dorm", -2.4, 0.42, -1.55, { expr: e, blink: lidAt(t, 1, [S("m2"), S("m3")]), wave: t > S("m1") && t < S("m1") + 0.8 ? q(Math.sin((t - S("m1")) * 14), 10) : undefined, prop: t > S("m3") ? "highlighter" : null });
  } });
// 4 — 3 a.m. clock, tilt down to Marcus re-reading with energy drinks
add({ from: S("m4") - 0.1, to: Wd("m4", 4) - 0.1, set: "dorm", light: "night", dof: 9, sun: [-60, 30],
  cam: [
    { t: 0, pos: O("dorm", -2.4, 2.35, -0.6), look: O("dorm", -2.45, 2.45, -2.58), fov: 30, push: 0.002 },
    { t: 0.55, dur: 26, pos: O("dorm", -2.2, 1.55, 0.45), look: O("dorm", -2.4, 1.15, -1.5), fov: 38, push: 0.002 },
  ],
  focus: (t) => (t < S("m4") + 0.6 ? O("dorm", -2.45, 2.45, -2.58) : O("dorm", -2.4, 1.28, -1.55)),
  cast: (t, c, out) => sitM(c, out, "dorm", -2.4, 0.42, -1.55, { expr: "tired", prop: "can", blink: lidAt(t, 1) }, MARCUS_NIGHT) });
// 5 — "Highlighted every line." high angle on the open book going yellow
add({ from: Wd("m4", 4) - 0.1, to: S("m5") - 0.12, set: "dorm", light: "night", dof: 8, sun: [-60, 40],
  cam: [{ t: 0, pos: O("dorm", -2.35, 2.05, -0.15), look: O("dorm", -2.4, 0.85, -1.05), fov: 40, push: 0.0025 }],
  focus: () => O("dorm", -2.4, 0.8, -0.95),
  cast: (t, c, out) => {
    sitM(c, out, "dorm", -2.4, 0.42, -1.55, { expr: "focus", prop: "highlighter", blink: lidAt(t, 1) }, MARCUS_NIGHT);
    const k = q(clamp01((t - (Wd("m4", 4) - 0.1)) / (S("m5") - Wd("m4", 4) - 0.1)), 30);
    fx(out, { key: `page${k}`, cw: 640, ch: 420, draw: (p) => openBook(p, k), x: SETS.dorm - 2.4, y: 0.767, z: -0.92, w: 0.56, h: 0.37, flat: true });
  } });
// 6 — "Rewrote his notes... three times."
add({ from: S("m5") - 0.12, to: S("l1") - 0.2, set: "dorm", light: "night", dof: 11, sun: [-55, 35], kicks: [S("m6")],
  cam: [
    { t: 0, pos: O("dorm", -1.9, 1.3, 0.9), look: O("dorm", -2.4, 1.05, -1.4), fov: 42, push: 0.0018 },
    { t: S("m6") - S("m5") + 0.12, dur: 18, pos: O("dorm", -2.25, 1.28, 0.25), look: O("dorm", -2.4, 1.2, -1.5), fov: 40, roll: -0.07, push: 0.005 },
  ],
  focus: () => O("dorm", -2.4, 1.28, -1.55),
  cast: (t, c, out) => {
    sitM(c, out, "dorm", -2.4, 0.42, -1.55, { expr: t < S("m6") ? "tired" : "dazed", prop: "pen", blink: lidAt(t, 1, [S("m6")]) }, MARCUS_NIGHT);
    for (let i = 0; i < 3; i++) fx(out, { key: `nb${i}`, cw: 300, ch: 400, draw: (p) => notebook(p, i), x: SETS.dorm - 2.75 + i * 0.3, y: 0.765 + i * 0.002, z: -0.9, w: 0.24, h: 0.32, flat: true, rot: (i - 1) * 0.15 });
    const s = pop(t, S("m6"), 0.25);
    if (s > 0) fx(out, { key: "x3", cw: 400, ch: 300, draw: x3, x: SETS.dorm - 2.05, y: 1.52, z: -1.3, w: 0.36 * s, h: 0.31 * s, rot: -0.12 });
  } });
// 7 — "And this is Leo." lecture hall, Leo CU
const LEO_LEC: [number, number, number] = [0.8, 0.35 + 0.36, -2.55];
const lectureExtras = (t: number, c: CamInfo, out: Stage) => {
  const spots: [number, number, number][] = [[-0.7, 0.36, -1.15], [2.3, 0.36, -1.15], [-0.6, 0.71, -2.55], [2.2, 0.71, -2.55], [0.0, 1.06, -3.95], [1.5, 1.06, -3.95], [-1.9, 0.36, -1.15]];
  spots.forEach(([x, y, z], i) => out.places.push(person(c, 10 + i, STUDENTS[i % 6], `st${i % 6}`, SETS.lecture + x, y, z, { mode: "sit", expr: (["neutral", "focus", "smile", "tired"] as Expr[])[i % 4], blink: lidAt(t, 10 + i), look: 0 })));
};
add({ from: S("l1") - 0.2, to: Wd("l2", 1) - 0.05, set: "lecture", light: "day", dof: 12, sun: [40, 40],
  cam: [{ t: 0, pos: O("lecture", 0.95, 1.55, -0.05), look: O("lecture", 0.8, 1.35, -2.55), fov: 40, push: 0.0024 }],
  focus: () => O("lecture", ...LEO_LEC).map((v, i) => (i === 1 ? v + 0.86 : v)) as [number, number, number],
  cast: (t, c, out) => { lectureExtras(t, c, out); sitL(c, out, "lecture", LEO_LEC[0], LEO_LEC[1], LEO_LEC[2], { expr: t < S("l1") + 0.4 ? "smile" : "smile_closed", blink: lidAt(t, 2), wave: t > S("l1") && t < S("l1") + 0.9 ? q(Math.sin((t - S("l1")) * 14), 10) : undefined }, LEO_BARE); } });
// 8 — the slide (reverse insert)
add({ from: Wd("l2", 1) - 0.05, to: Wd("l2", 5) - 0.05, set: "lecture", light: "day", dof: 0, sun: [30, 40],
  cam: [{ t: 0, pos: O("lecture", 0, 2.75, -0.6), look: O("lecture", 0, 2.75, 4.1), fov: 44, push: 0.003 }],
  cast: () => undefined });
// 9 — "Honestly? He's average." Leo scratching his head
add({ from: Wd("l2", 5) - 0.05, to: S("l3") - 0.1, set: "lecture", light: "day", dof: 12, sun: [40, 40],
  cam: [{ t: 0, pos: O("lecture", 1.2, 1.6, 0.3), look: O("lecture", 0.8, 1.35, -2.55), fov: 38, push: 0.003, roll: 0.05 }],
  focus: () => [SETS.lecture + 0.8, 1.57, -2.55],
  cast: (t, c, out) => {
    lectureExtras(t, c, out);
    sitL(c, out, "lecture", LEO_LEC[0], LEO_LEC[1], LEO_LEC[2], { expr: "confused", blink: lidAt(t, 2), wave: q(0.5 + 0.25 * Math.sin(t * 9), 10), look: -1 }, LEO_BARE);
    for (let i = 0; i < 2; i++) { const s = pop(t, Wd("l2", 5) + 0.15 + i * 0.35, 0.25); if (s > 0) fx(out, { key: "q", cw: 300, ch: 340, draw: qmark, x: SETS.lecture + 0.45 + i * 0.6, y: 1.95 + i * 0.12, z: -2.45, w: 0.24 * s, h: 0.27 * s, rot: (i ? -1 : 1) * 0.2 }); }
  } });
// 10 — "He forgets stuff. A lot." walks into a door
const BONK = E("l3") + 0.15;
add({ from: S("l3") - 0.1, to: S("l4") + 0.75, set: "hall", light: "day", dof: 6, sun: [60, 35], kicks: [BONK],
  cam: [
    { t: 0, pos: O("hall", 0.1, 1.3, 2.4), look: O("hall", 0.35, 1.05, -1.5), fov: 46, push: 0.0008 },
    { t: 0.35, dur: 34, pos: O("hall", 1.55, 1.3, 2.4), look: O("hall", 1.85, 1.05, -1.5), fov: 46, push: 0.0008 },
    { t: BONK - S("l3") + 0.15, dur: 20, pos: O("hall", 1.75, 1.05, 1.5), look: O("hall", 2.0, 0.85, -1.4), fov: 44, push: 0.002 },
  ],
  focus: () => O("hall", 1.9, 1.2, -1.45),
  cast: (t, c, out) => {
    const x = Math.min(2.1, -0.25 + (t - (S("l3") - 0.1)) * 1.3), z = -1.45;
    if (t < BONK) {
      out.places.push(person(c, 2, LEO, "L", SETS.hall + x, 0, z, {}, { side: { mode: "march", phase: q(((t * 1.6) % 1), 60), expr: "smile", stomp: 0.55, stride: 0.75, blink: lidAt(t, 2) } }));
      fx(out, { key: "phoneS", cw: 120, ch: 200, draw: phoneSide, x: SETS.hall + x + 0.2, y: 1.38, z: z + 0.02, w: 0.07, h: 0.12, yaw: 0 });
    } else if (t < BONK + 0.3) {
      out.places.push(person(c, 2, LEO, "L", SETS.hall + 2.02, 0, z, {}, { side: { mode: "stand", expr: "shock", blink: 0 } }));
      const u = (t - BONK) / 0.3;
      fx(out, { key: `burst${q(u, 20)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 20)), x: SETS.hall + 2.3, y: 1.45, z: -1.35, w: 0.7, h: 0.7 });
    } else {
      const up = t > S("l4") + 0.15;
      out.places.push(person(c, 2, LEO, "L", SETS.hall + 1.85, 0, z, { mode: up ? "stand" : "sit", expr: up ? "smile_closed" : "dazed", blink: up ? lidAt(t, 2) : 0 }));
      if (!up) { const u = q(((t - BONK) * 1.4) % 1, 30); fx(out, { key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x: SETS.hall + 1.85, y: 1.08, z: z + 0.05, w: 0.6, h: 0.3 }); }
      blob(out, SETS.hall + 1.85, 0, z);
    }
  } });
// 11 — "But Leo knew one thing about himself... a better system. Not more hours." (evening, beanbag, lightbulb)
add({ from: S("l4") + 0.75, to: S("a1") - 0.1, set: "dorm", light: "golden", dof: 11, sun: [70, 22],
  cam: [
    { t: 0, pos: O("dorm", 1.0, 1.05, 1.9), look: O("dorm", 1.25, 0.8, -0.9), fov: 40, push: 0.0016 },
    { t: Wd("l5", 9) - S("l4") - 0.75, dur: 20, pos: O("dorm", 1.15, 1.05, 0.9), look: O("dorm", 1.25, 1.0, -0.9), fov: 40, push: 0.003, roll: 0.06 },
  ],
  focus: () => O("dorm", 1.25, 0.95, -0.85),
  cast: (t, c, out) => {
    const b = Wd("l5", 9);
    sitL(c, out, "dorm", 1.25, 0.05, -0.75, { expr: t < b ? "focus" : "grin", look: t < b ? 1 : 0, blink: lidAt(t, 2, [b]) });
    const s = pop(t, b - 0.05, 0.3);
    if (s > 0) fx(out, { key: "bulb", cw: 400, ch: 320, draw: bulb, x: SETS.dorm + 1.3, y: 1.45, z: -0.8, w: 0.42 * s, h: 0.34 * s });
  } });
// 12 — "So after every lecture, he dropped it into Synaptic Recall." laptop, file drops in
const DROP = Wd("a1", 5);
add({ from: S("a1") - 0.1, to: S("a2") - 0.35, set: "dorm", light: "golden", dof: 9, sun: [60, 25],
  cam: [
    { t: 0, pos: O("dorm", 2.05, 1.3, 0.55), look: O("dorm", 3.0, 1.0, -1.3), fov: 40, push: 0.0015 },
    { t: DROP - S("a1") + 0.25, dur: 34, pos: O("dorm", 2.5, 1.06, -0.4), look: O("dorm", 2.76, 0.93, -1.2), fov: 36, push: 0.0025 },
  ],
  focus: (t) => (t < DROP + 0.4 ? O("dorm", 3.1, 1.2, -1.4) : O("dorm", 2.76, 0.92, -1.2)),
  cast: (t, c, out) => {
    sitL(c, out, "dorm", 3.32, 0.42, -1.6, { expr: t < DROP ? "smile" : "smile_closed", look: -1, blink: lidAt(t, 2) });
    if (t > DROP - 0.6 && t < DROP + 0.05) {
      const u = clamp01((t - (DROP - 0.6)) / 0.65);
      fx(out, { key: "pdf", cw: 200, ch: 260, draw: pdfIcon, x: SETS.dorm + 2.76 + (1 - u) * 0.15, y: 1.55 - 0.6 * u * u, z: -1.12, w: 0.14, h: 0.18, rot: (1 - u) * 0.6 });
    }
  } });
// 13 — Dr. Synapse pops out of the laptop: "Send me your lecture, and I'll turn it into a story and an Anki deck!"
const DOC_IN = S("a2") - 0.3;
add({ from: S("a2") - 0.35, to: S("a3") - 0.1, set: "dorm", light: "golden", dof: 10, sun: [60, 28],
  cam: [
    { t: 0, pos: O("dorm", 2.35, 1.12, -0.05), look: O("dorm", 2.55, 1.0, -1.2), fov: 40, push: 0.0008 },
    { t: 0.5, dur: 26, pos: O("dorm", 2.0, 1.25, 0.85), look: O("dorm", 2.7, 1.05, -1.2), fov: 40, push: 0.0018 },
  ],
  focus: () => O("dorm", 2.4, 1.15, -1.0),
  cast: (t, c, out) => {
    const shock = t < S("a2") + 0.6;
    sitL(c, out, "dorm", 3.32, 0.42, -1.6, { expr: shock ? "shock" : talkAt("a2", t) > 0 ? "grin" : "laugh", look: -1, blink: shock ? 0 : lidAt(t, 2, [S("a2") + 0.6]) });
    const s = pop(t, DOC_IN, 0.35);
    if (t < DOC_IN + 0.3) { const u = clamp01((t - DOC_IN + 0.05) / 0.35); fx(out, { key: `burst${q(u, 20)}p`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 20), "#ff9fc8"), x: SETS.dorm + 2.7, y: 1.0, z: -1.05, w: 0.8, h: 0.8 }); }
    if (s > 0.01) {
      const point = t > Wd("a2", 10) - 0.2 && t < E("a2") ? 1 : undefined;
      out.places.push(doc(c, SETS.dorm + 2.38, 0.75, -0.98, { talk: talkAt("a2", t), wave: t < S("a2") + 1.0 ? q(Math.sin(t * 12), 10) : undefined, point, mood: t > E("a2") ? "wink" : "happy", blink: lidAt(t, 30), look: point ? -1 : 0, hop: t < DOC_IN + 0.5 ? 40 * Math.sin(clamp01((t - DOC_IN) / 0.5) * Math.PI) : 0 }, 0.36 * s));
      blob(out, SETS.dorm + 2.38, 0.75, -0.98, 0.7);
    }
  } });
// 14 — "Then he'd just quiz himself. A little every day." beanbag + phone + flashcard
add({ from: S("a3") - 0.1, to: S("a4") - 0.05, set: "dorm", light: "golden", dof: 11, sun: [70, 22],
  cam: [{ t: 0, pos: O("dorm", 1.05, 1.15, 1.35), look: O("dorm", 1.25, 0.95, -0.85), fov: 40, push: 0.0024 }],
  focus: () => O("dorm", 1.25, 0.95, -0.85),
  cast: (t, c, out) => {
    sitL(c, out, "dorm", 1.25, 0.05, -0.75, { expr: t < Wd("a3", 5) ? "focus" : "smile_closed", prop: "phone", blink: lidAt(t, 2) });
    flashcard(out, t, S("a3") + 0.15, Wd("a3", 5), SETS.dorm + 1.25, 1.36, -0.6, 0.52);
  } });
// 15 — "On the bus."
add({ from: S("a4") - 0.05, to: S("a5") - 0.05, set: "bus", light: "day", dof: 10, sun: [50, 30],
  cam: [{ t: 0, pos: O("bus", 0.35, 1.2, 1.5), look: O("bus", 0, 1.0, -0.95), fov: 42, push: 0.0028 }],
  focus: () => O("bus", 0, 1.3, -0.95),
  cast: (t, c, out) => {
    sitL(c, out, "bus", 0, 0.42, -0.95, { expr: "smile_closed", prop: "phone", blink: lidAt(t, 2) });
    out.places.push(person(c, 21, STUDENTS[2], "st2", SETS.bus - 1.6, 0.42, -0.95, { mode: "sit", expr: "tired", blink: 1 }));
    flashcard(out, t, S("a4") + 0.05, S("a4") + 0.55, SETS.bus + 0.05, 1.62, -0.8, 0.42, true);
  } });
// 16 — "In line for lunch."
add({ from: S("a5") - 0.05, to: S("a6") - 0.05, set: "cafe", light: "day", dof: 9, sun: [45, 35],
  cam: [{ t: 0, pos: O("cafe", 0.3, 1.55, 1.7), look: O("cafe", -0.4, 1.3, -1.8), fov: 44, push: 0.0024 }],
  focus: () => O("cafe", -0.4, 1.45, -1.8),
  cast: (t, c, out) => {
    [-2.5, -1.45, 0.6, 1.6].forEach((x, i) => { out.places.push(person(c, 30 + i, STUDENTS[(i + 1) % 6], `st${(i + 1) % 6}`, SETS.cafe + x, 0, -1.85 - (i % 2) * 0.1, { mode: "stand", expr: (["neutral", "smile", "tired", "smile_closed"] as Expr[])[i], prop: "tray", blink: lidAt(t, 30 + i) })); blob(out, SETS.cafe + x, 0, -1.85); });
    out.places.push(person(c, 2, LEO, "L", SETS.cafe - 0.4, 0, -1.75, { mode: "stand", expr: "smile_closed", prop: "phone", blink: lidAt(t, 2) }));
    blob(out, SETS.cafe - 0.4, 0, -1.75);
    flashcard(out, t, S("a5") + 0.05, S("a5") + 0.6, SETS.cafe - 0.35, 2.02, -1.6, 0.46);
  } });
// 17 — "Then he went and lived his life."
add({ from: S("a6") - 0.05, to: S("c1") - 0.15, set: "cafe", light: "day", dof: 9, sun: [55, 35],
  cam: [{ t: 0, pos: O("cafe", 3.0, 1.35, 2.9), look: O("cafe", 3.1, 1.0, -0.7), fov: 46, push: 0.0024 }],
  focus: () => O("cafe", 3.1, 1.2, -0.85),
  cast: (t, c, out) => {
    const laugh = Math.sin(t * 5) > -0.2;
    sitL(c, out, "cafe", 3.1, 0.38, -0.95, { expr: laugh ? "laugh" : "grin", prop: "icecream", blink: lidAt(t, 2) });
    out.places.push(person(c, 40, STUDENTS[0], "st0", SETS.cafe + 2.5, 0.38, -0.75, { mode: "sit", expr: laugh ? "grin" : "laugh", blink: lidAt(t, 40) }));
    out.places.push(person(c, 41, STUDENTS[3], "st3", SETS.cafe + 3.7, 0.38, -0.75, { mode: "sit", expr: "laugh", blink: lidAt(t, 41) }));
  } });
// 18 — library, 2 a.m.: "Meanwhile, Marcus had a problem. He'd read everything. But when he closed the book..."
const CLOSE = Wd("c2", 3);
add({ from: S("c1") - 0.15, to: S("c3") - 0.2, set: "library", light: "night", dof: 11, sun: [-45, 35],
  cam: [
    { t: 0, pos: O("library", 0.4, 1.6, 1.8), look: O("library", 0, 1.1, -1.2), fov: 42, push: 0.0014 },
    { t: S("c2") - S("c1") + 0.15, dur: 26, pos: O("library", 0.15, 1.35, 0.45), look: O("library", 0, 1.0, -1.1), fov: 40, push: 0.003 },
  ],
  focus: (t) => (t < S("c2") ? O("library", 0, 1.28, -1.55) : O("library", 0, 0.9, -1.0)),
  cast: (t, c, out) => {
    const twitch = Math.floor(t * 30) % 11 < 2 && t < S("c2");
    sitM(c, out, "library", 0, 0.42, -1.6, { expr: t > CLOSE + 0.1 ? "nervous" : twitch ? "dazed" : "tired", blink: twitch ? 0.5 : lidAt(t, 1), headTilt: twitch ? 3 : 0 }, MARCUS_NIGHT);
  } });
// 19 — "...it was gone." Marcus's leaky bucket
add({ from: S("c3") - 0.2, to: S("c4") - 0.1, set: "brain", light: "brain", dof: 8, sun: [45, 40],
  cam: [{ t: 0, pos: O("brain", -2.85, 1.35, 1.6), look: O("brain", -3.2, 0.75, -1.2), fov: 44, push: 0.003 }],
  focus: () => O("brain", -3.2, 0.7, -1.2),
  cast: (t, c, out) => {
    const t0 = S("c3") - 0.2, facts = ["Glycolysis", "Krebs Cycle", "Enzymes", "Genetics"];
    facts.forEach((l, i) => {
      const leave = t0 + 0.15 + i * 0.3, age = t - leave;
      const inside = age < 0;
      const x = SETS.brain - 3.2 + (i - 1.5) * 0.28, y = inside ? 1.12 + 0.05 * (i % 2) : 0.3 - age * 1.6, z = -1.2 + (inside ? 0 : 0.85);
      if (!inside && y < -0.3) return;
      fx(out, { key: `fact${l}`, cw: 512, ch: 256, draw: texCard(factTex(l)), x: inside ? x : SETS.brain - 3.2 + (i - 1.5) * 0.45, y: inside ? y : Math.max(0.12, y), z, w: 0.38, h: 0.19, rot: inside ? (i - 1.5) * 0.25 : age * 3 * (i % 2 ? 1 : -1), soft: !inside, yaw: undefined });
    });
    for (let k = 0; k < 6; k++) {
      const age = ((t * 1.3 + k * 0.37) % 1), x = SETS.brain - 3.2 + [-0.55, -0.2, 0.25, 0.5, -0.4, 0.1][k], y = 0.35 - age * 0.35;
      fx(out, { key: "drop", cw: 120, ch: 130, draw: sweat, x, y, z: -0.5, w: 0.06, h: 0.065 });
    }
  } });
// 20 — "Leo's brain? Everything had a shelf." Dr. Synapse files the last box
const SHELF = Wd("c4", 5);
add({ from: S("c4") - 0.1, to: S("e1") - 0.15, set: "brain", light: "brain", dof: 7, sun: [40, 40],
  cam: [{ t: 0, pos: O("brain", 2.55, 1.55, 2.9), look: O("brain", 3.0, 1.15, -2.0), fov: 44, push: 0.0024 }],
  focus: () => O("brain", 2.6, 1.2, -1.6),
  cast: (t, c, out) => {
    const placed = t > SHELF;
    out.places.push(doc(c, SETS.brain + 2.25, 0, -1.55, { mood: placed ? (t > SHELF + 0.6 ? "wink" : "proud") : "happy", wave: placed ? undefined : 0.9, point: placed ? 0.6 : undefined, blink: lidAt(t, 30), hop: placed && t < SHELF + 0.4 ? 30 * Math.sin(((t - SHELF) / 0.4) * Math.PI) : 0 }, 0.62));
    blob(out, SETS.brain + 2.25, 0, -1.55, 1.2);
  } });
// 21 — the exam: "Then came the M-Cat. Same exam. Same question."
const examExtras = (t: number, c: CamInfo, out: Stage) => {
  let i = 0;
  for (let r = 0; r < 4; r++) for (const x of [-3, -1, 1, 3]) {
    if (r === 0 && (x === -1 || x === 1)) continue;
    out.places.push(person(c, 50 + i, STUDENTS[i % 6], `st${i % 6}`, SETS.exam + x, 0.42, -1.05 - r * 1.6 - 0.45, { mode: "sit", expr: (["focus", "nervous", "tired", "focus"] as Expr[])[i % 4], blink: lidAt(t, 50 + i), look: 0 }));
    i++;
  }
};
add({ from: S("e1") - 0.15, to: S("e2") - 0.1, set: "exam", light: "day", dof: 4, sun: [35, 45],
  cam: [
    { t: 0, pos: O("exam", 0, 2.9, 3.4), look: O("exam", 0, 0.9, -3.0), fov: 50, push: 0.0012 },
    { t: Wd("e1", 4) - S("e1") + 0.15, dur: 30, pos: O("exam", 0, 1.75, 1.3), look: O("exam", 0, 1.05, -1.5), fov: 46, push: 0.0018 },
  ],
  focus: () => O("exam", 0, 1.2, -1.5),
  cast: (t, c, out) => {
    examExtras(t, c, out);
    sitM(c, out, "exam", -1, 0.42, -1.5, { expr: "nervous", prop: "pen", blink: lidAt(t, 1) });
    sitL(c, out, "exam", 1, 0.42, -1.5, { expr: "focus", prop: "pen", blink: lidAt(t, 2) }, LEO_BARE);
  } });
// 22 — "One of them had seen it a hundred times." Marcus blanks
add({ from: S("e2") - 0.1, to: S("e3") - 0.1, set: "exam", light: "day", dof: 13, sun: [35, 40],
  cam: [{ t: 0, pos: O("exam", -0.85, 1.35, 0.75), look: O("exam", -1.05, 1.25, -1.5), fov: 40, push: 0.0028 }],
  focus: () => O("exam", -1, 1.28, -1.5),
  cast: (t, c, out) => {
    sitM(c, out, "exam", -1, 0.42, -1.5, { expr: t < Wd("e2", 5) ? "nervous" : "shock", prop: "pen", blink: lidAt(t, 1, [Wd("e2", 5)]) });
    const s = pop(t, S("e2") + 0.2, 0.3);
    if (s > 0) fx(out, { key: `think${t < Wd("e2", 5)}`, cw: 520, ch: 420, draw: (p) => thought(p, t < Wd("e2", 5)), x: SETS.exam - 1.3, y: 1.7, z: -1.3, w: 0.42 * s, h: 0.34 * s });
    for (let k = 0; k < 2; k++) { const u = ((t * 1.2 + k * 0.5) % 1); fx(out, { key: "sweat", cw: 120, ch: 130, draw: sweat, x: SETS.exam - 1 + (k ? 0.22 : -0.2), y: 1.45 - u * 0.25, z: -1.4, w: 0.05, h: 0.055 }); }
    fx(out, { key: "exam", cw: 768, ch: 1000, draw: texCard(examTex()), x: SETS.exam - 1.0, y: 0.73, z: -1.0, w: 0.26, h: 0.34, flat: true, rot: 0.1 });
  } });
// 23 — "The other had actually practiced remembering it." Leo's flashcard flashes in his memory
const RECALL = Wd("e3", 3);
add({ from: S("e3") - 0.1, to: S("r1") - 0.15, set: "exam", light: "day", dof: 13, sun: [40, 40],
  cam: [{ t: 0, pos: O("exam", 1.15, 1.35, 0.75), look: O("exam", 1.05, 1.25, -1.5), fov: 40, push: 0.0028 }],
  focus: () => O("exam", 1, 1.28, -1.5),
  cast: (t, c, out) => {
    sitL(c, out, "exam", 1, 0.42, -1.5, { expr: t < RECALL ? "focus" : "smirk", prop: "pen", blink: lidAt(t, 2, [RECALL]) }, LEO_BARE);
    if (t > RECALL - 0.1) {
      const u = clamp01((t - RECALL + 0.1) / 0.4);
      fx(out, { key: `burstf${q(u, 20)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 20), "#fff3b0", 12), x: SETS.exam + 1.3, y: 1.68, z: -1.35, w: 0.8, h: 0.8 });
      flashcard(out, t, RECALL - 0.05, RECALL + 0.35, SETS.exam + 1.3, 1.68, -1.3, 0.4);
    }
    fx(out, { key: "exam", cw: 768, ch: 1000, draw: texCard(examTex()), x: SETS.exam + 1.0, y: 0.73, z: -1.0, w: 0.26, h: 0.34, flat: true, rot: -0.1 });
  } });
// 24 — "If you guessed Leo... you were right." acceptance on the laptop (overlay card in Grades.tsx)
add({ from: S("r1") - 0.15, to: S("r3") - 0.1, set: "dorm", light: "night", dof: 10, sun: [60, 30],
  cam: [
    { t: 0, pos: O("dorm", 2.5, 1.06, -0.4), look: O("dorm", 2.76, 0.93, -1.2), fov: 36, push: 0.002 },
    { t: S("r2") - S("r1") + 0.1, dur: 22, pos: O("dorm", 2.2, 1.3, 0.7), look: O("dorm", 2.95, 1.1, -1.3), fov: 42, push: 0.0015 },
  ],
  focus: (t) => (t < S("r2") ? O("dorm", 2.76, 0.92, -1.2) : O("dorm", 3.3, 1.25, -1.5)),
  cast: (t, c, out) => {
    const yay = t > S("r2");
    sitL(c, out, "dorm", 3.32, 0.42, -1.6, { expr: yay ? "laugh" : "shock", look: yay ? 0 : -1, wave: yay ? q(Math.sin(t * 13), 10) : undefined, blink: yay ? lidAt(t, 2) : 0 });
    confetti(out, t, S("r2") + 0.05, SETS.dorm + 2.9, 1.0, -1.1, 30, 1.8);
  } });
// 25 — "Not because he was smarter. Because he knew his tools."
add({ from: S("r3") - 0.1, to: S("b1") - 0.3, set: "dorm", light: "night", dof: 10, sun: [55, 30],
  cam: [
    { t: 0, pos: O("dorm", 2.15, 1.4, 2.3), look: O("dorm", 2.2, 1.15, -0.8), fov: 42, push: 0.0016 },
    { t: Wd("r3", 5) - S("r3") + 0.1, dur: 24, pos: O("dorm", 2.2, 1.4, 1.9), look: O("dorm", 2.2, 1.2, -0.8), fov: 40, push: 0.0025, roll: 0.06 },
  ],
  focus: () => O("dorm", 2.0, 1.4, -0.6),
  cast: (t, c, out) => {
    const tools = t > Wd("r3", 7);
    out.places.push(person(c, 2, LEO, "L", SETS.dorm + 2.0, 0, -0.6, { mode: "stand", expr: tools ? "smirk" : "smile_closed", prop: tools ? "phoneOut" : "phone", blink: lidAt(t, 2, [Wd("r3", 7)]) }));
    blob(out, SETS.dorm + 2.0, 0, -0.6);
    out.places.push(doc(c, SETS.dorm + 2.62, 0.75, -1.12, { mood: tools ? "proud" : "happy", wave: tools ? q(Math.sin(t * 10), 10) : undefined, blink: lidAt(t, 30) }, 0.28));
  } });
// 26 — the bench: "Bro. Stop re-reading. Try this."
add({ from: S("b1") - 0.3, to: S("w1") - 0.75, set: "hall", light: "day", dof: 10, sun: [50, 35],
  cam: [{ t: 0, pos: O("hall", -5.12, 1.25, 1.75), look: O("hall", -5.12, 0.98, -1.55), fov: 48, push: 0.002 }],
  focus: () => O("hall", -5.1, 1.3, -1.55),
  cast: (t, c, out) => {
    const smile = t > E("b1") + 0.15;
    sitM(c, out, "hall", -5.55, 0.46, -1.6, { expr: smile ? "smile" : "tired", look: t > Wd("b1", 3) ? 1 : 0, blink: lidAt(t, 1, [E("b1") + 0.15]) }, MARCUS_NIGHT);
    sitL(c, out, "hall", -4.7, 0.46, -1.6, { expr: talkExpr("b1", t, "relief_open", "smile"), prop: t > Wd("b1", 3) ? "phoneOut" : "phone", look: 1, blink: lidAt(t, 2) }, LEO, 2, true);
  } });
// 27 — white coat ceremony: Dr. Synapse: "Work hard. But work smart!"
add({ from: S("w1") - 0.75, to: S("end") - 0.3, set: "stage", light: "stage", dof: 8, sun: [30, 40],
  cam: [
    { t: 0, pos: O("stage", 0, 1.8, 4.2), look: O("stage", 0, 1.6, -1.3), fov: 46, push: 0.0018 },
    { t: S("w1") - S("w1") + 0.75 + 1.0, dur: 26, pos: O("stage", 0, 1.55, 2.6), look: O("stage", 0, 1.45, -1.2), fov: 44, push: 0.002 },
  ],
  focus: () => O("stage", 0, 1.6, -1.2),
  cast: (t, c, out) => {
    out.places.push(person(c, 1, coat(MARCUS), "Mc", SETS.stage - 0.72, 0.8, -1.6, { mode: "stand", expr: "grin", prop: "diploma", blink: lidAt(t, 1) }));
    out.places.push(person(c, 2, coat(LEO), "Lc", SETS.stage + 0.72, 0.8, -1.6, { mode: "stand", expr: "laugh", wave: q(Math.sin(t * 9), 10), blink: lidAt(t, 2) }));
    blob(out, SETS.stage - 0.72, 0.8, -1.6); blob(out, SETS.stage + 0.72, 0.8, -1.6);
    out.places.push(doc(c, SETS.stage, 0.8, -1.0, { talk: talkAt("w1", t), mood: t > E("w1") ? "wink" : "proud", wave: t > E("w1") ? q(Math.sin(t * 10), 10) : undefined, blink: lidAt(t, 30) }, 0.5));
    blob(out, SETS.stage, 0.8, -1.0, 0.9);
    confetti(out, t, S("w1") - 0.6, SETS.stage, 1.6, -1.2, 40, 3.2);
  } });

// ---------------- 2D props drawn on cards ----------------
function openBook(p: Pen, k: number) {
  const g = p.g;
  for (const s of [0, 1]) {
    g.fillStyle = "#fbf6e6"; g.fillRect(20 + s * 300, 20, 290, 380);
    g.strokeStyle = "#1c1420"; g.lineWidth = 10; g.strokeRect(20 + s * 300, 20, 290, 380);
    for (let i = 0; i < 12; i++) {
      const y = 55 + i * 28, x0 = 40 + s * 300, len = 240 - ((i * 37) % 60);
      const line = (s * 12 + i) / 24;
      if (line < k) { g.fillStyle = "rgba(255,226,40,0.95)"; g.fillRect(x0 - 4, y - 11, len + 8, 22); }
      g.fillStyle = "#6a6f7c"; g.fillRect(x0, y - 3, len, 6);
    }
  }
}
function notebook(p: Pen, i: number) {
  const g = p.g, c = ["#2e6db4", "#c0392b", "#3c9a5f"][i];
  g.fillStyle = c; g.fillRect(10, 10, 280, 380); g.strokeStyle = "#1c1420"; g.lineWidth = 10; g.strokeRect(10, 10, 280, 380);
  g.fillStyle = "#fbf6e6"; g.fillRect(50, 60, 200, 90); g.strokeRect(50, 60, 200, 90);
  g.font = "700 60px Fredoka"; g.fillStyle = "#1c1420"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(`v${i + 1}`, 150, 106);
}
function x3(p: Pen) {
  p.g.font = "700 250px Fredoka"; p.g.textAlign = "center"; p.g.textBaseline = "middle"; p.g.lineJoin = "round";
  p.g.lineWidth = 30; p.g.strokeStyle = "#1c1420"; p.g.strokeText("×3", 200, 160); p.g.fillStyle = "#ff5d8f"; p.g.fillText("×3", 200, 160);
}
function phoneSide(p: Pen) { p.poly([[20, 10], [100, 10], [100, 190], [20, 190]], "#2b2f3a", 10); }
function pdfIcon(p: Pen) {
  p.poly([[20, 10], [140, 10], [180, 50], [180, 250], [20, 250]], "#ffffff", 10);
  p.poly([[40, 150], [160, 150], [160, 210], [40, 210]], "#d9534f", 0);
  p.g.font = "700 48px Inter"; p.g.fillStyle = "#fff"; p.g.textAlign = "center"; p.g.textBaseline = "middle"; p.g.fillText("PDF", 100, 182);
}
function thought(p: Pen, page: boolean) {
  for (const [x, y, r] of [[420, 380, 18], [450, 340, 26]]) p.ell(x, y, r, r, "#ffffff", 8);
  p.ell(240, 170, 225, 150, "#ffffff", 10);
  if (page) {
    p.poly([[110, 70], [370, 70], [370, 270], [110, 270]], "#fbf6e6", 8);
    for (let i = 0; i < 6; i++) { p.g.fillStyle = "rgba(255,226,40,0.9)"; p.g.fillRect(130, 95 + i * 30, 220, 18); p.g.fillStyle = "#6a6f7c"; p.g.fillRect(135, 101 + i * 30, 200, 6); }
  } else {
    p.g.font = "700 200px Fredoka"; p.g.textAlign = "center"; p.g.textBaseline = "middle"; p.g.lineWidth = 22; p.g.strokeStyle = "#1c1420"; p.g.lineJoin = "round";
    p.g.strokeText("?", 240, 180); p.g.fillStyle = "#c9ccd2"; p.g.fillText("?", 240, 180);
  }
}
export { fxNote };

// ---------------- camera ----------------
export type Cam = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number };
const lerp3 = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i] - v) * k);
export const camAt = (sh: Shot, fr: number): Cam => {
  const t = fr / FPS, t0 = sh.a / FPS, keys = sh.cam;
  const st = (k: Key) => ({ pos: k.pos as number[], look: k.look as number[], fov: k.fov ?? 40, roll: k.roll ?? 0 });
  // creeping push toward the look point since the key took over
  const pushed = (k: Key, since: number) => {
    const s = st(k), d = Math.max(0, since) * FPS * (k.push ?? 0.002);
    return { ...s, pos: lerp3(s.pos, s.look, Math.min(0.5, d)) };
  };
  let cur = pushed(keys[0], t - t0);
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], kt = t0 + k.t, dur = (k.dur ?? 24) / FPS;
    if (t < kt) break;
    const nxt = pushed(k, t - kt - dur * 0.5), u = glide((t - kt) / dur);
    cur = { pos: lerp3(cur.pos, nxt.pos, u), look: lerp3(cur.look, nxt.look, u), fov: cur.fov + (nxt.fov - cur.fov) * u, roll: cur.roll + (nxt.roll - cur.roll) * u };
  }
  // impact kicks: 7 frames, sign flips every frame, decaying
  let kx = 0, ky = 0;
  for (const kt of sh.kicks ?? []) {
    const n = Math.round((t - kt) * FPS);
    if (n >= 0 && n < 7) { const a = 0.035 * (1 - n / 7) * (n % 2 ? -1 : 1); kx += a; ky += a * 0.6; }
  }
  return { pos: new THREE.Vector3(cur.pos[0] + kx, cur.pos[1] + ky, cur.pos[2]), look: new THREE.Vector3(cur.look[0] + kx, cur.look[1] + ky, cur.look[2]), fov: cur.fov, roll: cur.roll };
};
export const shotAt = (fr: number) => SHOTS.find((s) => s.id !== 2 && fr >= s.a && fr < s.b) ?? SHOTS[SHOTS.length - 1];
/** the split-screen hook runs to the end of shot 1 */
export const SPLIT_END = SHOTS[0].b;
/** white flashes (start frames): after the hook, into the time skip */
export const FLASHES = [SHOTS[0].b, f(S("w1") - 0.75)];
/** the end card covers everything from here (Grades.tsx); 3D stops rendering once it is opaque */
export const ENDCARD = f(S("end") - 0.3);
export const dofAt = (sh: Shot, fr: number) => (typeof sh.dof === "number" ? sh.dof : sh.dof(fr / FPS));

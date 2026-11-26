// The nine interior sets of the grades short, each a three-sided room (open toward +z, where the cameras stand) at its
// own origin on the x axis, built from boxes / planes / cylinders with painted canvas textures and the bridge short's
// two-tone shading (so the world ink pass outlines them the same way). Dynamic bits (screens, clock, bus scenery,
// highlighted page) are exposed as handles the world poses per frame.
import * as THREE from "three";
import { twoTone } from "../bridge/shade";
import {
  wallTex, woodTex, tileTex, carpetTex, spinesTex, curtainTex, lockerTex, brainTex, windowTex, sceneryTex, signTex, clockTex,
  slideTex, appTex, boxTex, ctex,
} from "./tex";

export const SETS = { dorm: 0, lecture: 50, hall: 100, bus: 150, cafe: 200, library: 250, brain: 300, exam: 350, stage: 400 } as const;
export type SetName = keyof typeof SETS;

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const matCache = new Map<string, THREE.Material>();
/** two-tone lit material; a texture is cloned per repeat so shared images can tile differently */
export const lit = (col: string, tex?: THREE.Texture, ru = 1, rv = 1, key = "") => {
  const k = `${col}|${tex?.uuid ?? ""}|${ru}|${rv}|${key}`;
  let m = matCache.get(k) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    let map: THREE.Texture | null = null;
    if (tex) { map = tex.clone(); map.repeat.set(ru, rv); map.needsUpdate = true; }
    m = twoTone(new THREE.MeshLambertMaterial({ color: col, map }));
    matCache.set(k, m);
  }
  return m;
};
/** self-lit (screens, windows, lamp bulbs, signs that must stay readable) */
export const glow = (tex: THREE.Texture | null, col = "#ffffff", k = 1) => {
  const m = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(col).multiplyScalar(k), toneMapped: true });
  return m;
};

export class Builder {
  root = new THREE.Group();
  constructor(parent: THREE.Object3D, public ox: number) { this.root.position.set(ox, 0, 0); parent.add(this.root); }
  add<T extends THREE.Object3D>(o: T, cast = true, recv = true) {
    o.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = cast; c.receiveShadow = recv; } });
    this.root.add(o); return o;
  }
  box(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, ry = 0, cast = true) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.rotation.y = ry;
    return this.add(o, cast);
  }
  /** box with a separate material on its +z face (book spines, labels, screens) */
  boxFace(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, front: THREE.Material, ry = 0) {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [m, m, m, m, front, m]); o.position.set(x, y + h / 2, z); o.rotation.y = ry;
    return this.add(o);
  }
  plane(w: number, h: number, x: number, y: number, z: number, m: THREE.Material, ry = 0, rx = 0, cast = false) {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0, "YXZ");
    return this.add(o, cast);
  }
  cyl(rt: number, rb: number, h: number, x: number, y: number, z: number, m: THREE.Material, seg = 24, open = false) {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m); o.position.set(x, y + h / 2, z);
    return this.add(o);
  }
  ball(r: number, sx: number, sy: number, sz: number, x: number, y: number, z: number, m: THREE.Material) {
    const o = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), m); o.scale.set(sx, sy, sz); o.position.set(x, y, z);
    return this.add(o);
  }
  /** three walls + floor + ceiling; walls/ceiling never cast shadows (the key light comes in through the open side) */
  room(w: number, d: number, h: number, wall: THREE.Material, floor: THREE.Material, ceil?: THREE.Material, sideWall?: THREE.Material) {
    this.plane(w, d + 6, 0, 0, 3, floor, 0, -Math.PI / 2);
    this.plane(w, h, 0, h / 2, -d / 2, wall);
    this.plane(d + 6, h, -w / 2, h / 2, 3, sideWall ?? wall, Math.PI / 2);
    this.plane(d + 6, h, w / 2, h / 2, 3, sideWall ?? wall, -Math.PI / 2);
    if (ceil) this.plane(w, d + 6, 0, h, 3, ceil, 0, Math.PI / 2);
    // skirting board
    this.box(w, 0.12, 0.04, 0, 0, -d / 2 + 0.02, lit("#f3efe6"), 0, false);
  }
  desk(x: number, z: number, w = 1.3, d = 0.65, h = 0.75, top = "#b07a4a", ry = 0) {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const m = lit(top), lm = lit("#4a4550");
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), m); t.position.y = h - 0.03; g.add(t);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, h - 0.06, 0.06), lm); l.position.set(sx * (w / 2 - 0.06), (h - 0.06) / 2, sz * (d / 2 - 0.06)); g.add(l); }
    const p = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, 0.35, 0.03), m); p.position.set(0, h - 0.25, d / 2 - 0.05); g.add(p);
    return this.add(g);
  }
  books(x: number, y: number, z: number, n: number, seed: number, w = 0.32, ry = 0) {
    const cols = ["#c0392b", "#2e6db4", "#e3a72f", "#3c9a5f", "#7b4fa0", "#e8e1cf", "#1f3b5a", "#d35f8d"];
    let yy = y;
    for (let i = 0; i < n; i++) {
      const h = 0.05 + ((i * 37 + seed * 13) % 5) * 0.012, r = (((i * 53 + seed * 7) % 9) - 4) * 0.03;
      const b = this.box(w * (0.85 + ((i + seed) % 3) * 0.08), h, w * 0.72, x + r * 0.3, yy, z, lit(cols[(i + seed) % cols.length]), ry + r);
      b.castShadow = true; yy += h;
    }
    return yy;
  }
  lamp(x: number, y: number, z: number, col = "#2f6f5a", bulb = true) {
    const m = lit(col);
    this.cyl(0.1, 0.12, 0.03, x, y, z, m);
    this.cyl(0.015, 0.015, 0.38, x, y, z, lit("#3a3a40"));
    const sh = this.cyl(0.05, 0.16, 0.14, x, y + 0.36, z, m, 24, true); sh.material = m; (sh.material as THREE.Material).side = THREE.DoubleSide;
    if (bulb) this.ball(0.06, 1, 1, 1, x, y + 0.38, z, glow(null, "#fff1c4", 2.2));
  }
  /** framed picture / sign on a wall plane at z (facing +z) or on a side wall (ry) */
  frame(w: number, h: number, x: number, y: number, z: number, tex: THREE.Texture, ry = 0, selfLit = false) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    const f = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), lit("#2a2230")); g.add(f);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), selfLit ? glow(tex) : lit("#ffffff", tex)); p.position.z = 0.025; g.add(p);
    this.add(g, false);
    return p;
  }
}

export type Handles = {
  dormClock: THREE.Mesh; dormWin: THREE.Mesh; libClock: THREE.Mesh; examClock: THREE.Mesh; laptop: THREE.Mesh; scenery: THREE.Texture;
  bookPage: THREE.Mesh; docBox: THREE.Object3D; bucketFacts: THREE.Object3D[]; examPaper: THREE.Mesh[];
};

export function buildSets(parent: THREE.Object3D): Handles {
  const H = {} as Handles;
  // ================= DORM =================
  {
    const b = new Builder(parent, SETS.dorm);
    b.room(8, 5.2, 3, lit("#ffffff", wallTex("#b9c6dc"), 2, 1), lit("#ffffff", woodTex("#c68f5c"), 3, 3), lit("#efe7dc"));
    b.plane(4, 3, 2, 1.5, -2.595, lit("#ffffff", wallTex("#f3c88f", "L"), 1, 1)); // Leo's half: warm wall
    b.plane(8, 0.05, 0, 0.003, 0.2, lit("#e9e2d3"), 0, -Math.PI / 2); // tape line down the middle
    // window
    b.box(1.6, 1.4, 0.1, 0, 1.2, -2.62, lit("#f4f1ea"), 0, false);
    H.dormWin = b.plane(1.4, 1.2, 0, 1.9, -2.55, glow(windowTex(false), "#ffffff", 0.95));
    b.box(1.8, 0.06, 0.22, 0, 1.17, -2.5, lit("#f4f1ea"));
    // Marcus: desk, books, lamp, cans, shelf, certificate, clock, sticky notes
    b.desk(-2.4, -1.1, 1.5, 0.7);
    b.books(-3.0, 0.75, -1.05, 9, 1); b.books(-1.75, 0.75, -1.0, 6, 4, 0.28, 0.2);
    b.lamp(-2.05, 0.75, -1.3);
    for (const [x, z] of [[-1.72, -0.95], [-1.6, -1.05], [-1.82, -1.12], [-1.5, -0.9]]) b.cyl(0.035, 0.035, 0.13, x, 0.75, z, lit("#2fd17a"));
    b.boxFace(1.2, 2.1, 0.36, -3.3, 0, -2.38, lit("#7a4a2a"), lit("#ffffff", spinesTex("dormM")));
    b.cyl(0.07, 0.11, 0.06, -3.3, 2.1, -2.38, lit("#d9b13b")); b.cyl(0.03, 0.03, 0.14, -3.3, 2.16, -2.38, lit("#d9b13b")); b.ball(0.11, 1.3, 0.9, 1, -3.3, 2.37, -2.38, lit("#e8c45a"));
    b.frame(0.9, 0.62, -1.75, 2.15, -2.58, signTex("valedict", ["Valedictorian", "Ridgeview High"], "#fbf6e6", "#2e4a8a", 1024, 700, 120));
    H.dormClock = b.frame(0.42, 0.42, -2.45, 2.45, -2.58, clockTex(3, 0), 0, true);
    const notes = ["#ffe86b", "#ff9fc3", "#9fe0ff", "#b8f28c"];
    for (let i = 0; i < 9; i++) b.plane(0.16, 0.16, -2.95 + (i % 5) * 0.27 + (i > 4 ? 0.12 : 0), 1.35 + (i > 4 ? 0.25 : 0), -2.585, lit(notes[i % 4]), 0, 0).rotation.z = ((i * 7) % 5 - 2) * 0.06;
    // Leo: beanbag, poster, fridge, desk + laptop
    b.ball(0.62, 1.05, 0.55, 1, 1.25, 0.32, -1.6, lit("#ff8a3d"));
    b.frame(0.75, 1.0, 1.4, 1.75, -2.58, signTex("poster", ["LO-FI", "beats to", "chill to"], "#3d2b6b", "#ffd36b", 600, 800, 130));
    b.box(0.6, 0.85, 0.6, 3.55, 0, -2.2, lit("#e9edf2")); b.box(0.04, 0.3, 0.03, 3.3, 0.45, -1.88, lit("#9aa3ad"));
    b.desk(2.75, -1.15, 1.3, 0.65, 0.75, "#9b6b8e");
    b.box(0.38, 0.02, 0.27, 2.75, 0.75, -1.1, lit("#c9ccd2"), -0.35);
    const lap = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.26), glow(appTex(0), "#ffffff", 0.95));
    const lapBack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.015), lit("#c9ccd2"));
    const lg = new THREE.Group(); lg.position.set(2.75 + 0.045, 0.9, -1.1 - 0.125); lg.rotation.set(-0.15, -0.35, 0, "YXZ");
    lap.position.z = 0.009; lg.add(lapBack, lap); b.add(lg);
    H.laptop = lap;
    b.books(3.2, 0.75, -1.3, 2, 6, 0.25);
    b.plane(2.2, 1.4, 0.8, 0.004, -0.3, lit("#ffffff", carpetTex("#5fb3a6")), 0, -Math.PI / 2);
  }
  // ================= LECTURE HALL =================
  {
    const b = new Builder(parent, SETS.lecture);
    b.room(12, 10, 5, lit("#ffffff", wallTex("#e8d6b8"), 3, 1), lit("#ffffff", carpetTex("#5b6e9c"), 4, 4), lit("#efe7dc"));
    for (let r = 0; r < 4; r++) {
      const y = r * 0.35, z = -1.2 - r * 1.4;
      if (r) b.box(12, y, 1.4, 0, 0, z - 0.05, lit("#ffffff", carpetTex("#55679a"), 4, 1));
      b.box(11.5, 0.08, 0.45, 0, y + 0.72, z + 0.45, lit("#b98a5c"));
      b.box(11.5, 0.5, 0.05, 0, y + 0.22, z + 0.66, lit("#a8794e"));
    }
    // the front of the room (behind the lecturer's camera): wall + projector slide, facing the students
    b.plane(12, 5, 0, 2.5, 4.2, lit("#ffffff", wallTex("#e8d6b8"), 3, 1), Math.PI);
    b.box(4.6, 3.0, 0.08, 0, 1.25, 4.15, lit("#2a2230"), 0, false);
    b.plane(4.4, 2.8, 0, 2.75, 4.1, glow(slideTex(), "#ffffff", 0.95), Math.PI);
    b.frame(1.6, 0.5, 2.5, 4.2, -4.98, signTex("bio", ["BIO 201"], "#2e4a8a", "#ffffff", 800, 250, 150));
  }
  // ================= HALLWAY =================
  {
    const b = new Builder(parent, SETS.hall);
    b.room(18, 4, 3.2, lit("#ffffff", wallTex("#e6dccb"), 4, 1), lit("#ffffff", tileTex("#e9e4d6", "#cfd6cf"), 9, 3), lit("#efe7dc"));
    b.plane(16, 1.9, 0, 0.95, -1.98, lit("#ffffff", lockerTex(), 8, 1));
    // the open door Leo walks into (hinged on the lockers, sticking out into the corridor)
    {
      const door = new THREE.Group(); door.position.set(2.05, 0, -1.98); door.rotation.y = 0.55; // swung open toward the camera
      const pnl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.15, 0.95), lit("#b5793f")); pnl.position.set(0, 1.075, 0.475); door.add(pnl);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.32), glow(null, "#cfe7ff", 0.9)); win.position.set(0, 1.55, 0.5); door.add(win);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), lit("#d9b13b")); knob.position.set(-0.05, 1.0, 0.82); door.add(knob);
      b.add(door);
      b.box(1.0, 2.25, 0.06, 2.55, 0, -1.99, lit("#3a2a20"), 0, false); // the doorway behind it
    }
    // bench + noticeboard for the ending
    b.box(1.9, 0.08, 0.45, -5.2, 0.42, -1.55, lit("#b07a4a")); for (const sx of [-0.8, 0.8]) b.box(0.08, 0.42, 0.4, -5.2 + sx, 0, -1.55, lit("#4a4550"));
    b.frame(1.5, 0.9, -5.2, 2.45, -1.97, signTex("notice", ["NOTICES", "Study group · Thu 7pm"], "#c9a27a", "#2a1a10", 1024, 600, 120));
  }
  // ================= BUS =================
  {
    const b = new Builder(parent, SETS.bus);
    b.room(10, 2.6, 2.4, lit("#ffffff", wallTex("#e8e2d6"), 3, 1), lit("#6b6f7a"), lit("#efe9de"), lit("#d9d2c5"));
    b.plane(10, 0.9, 0, 0.45, -1.29, lit("#cfc6b6"));
    const sc = sceneryTex().clone(); sc.wrapS = THREE.RepeatWrapping; sc.repeat.set(2.4, 1); sc.needsUpdate = true; H.scenery = sc;
    b.plane(10, 0.95, 0, 1.42, -1.28, glow(sc, "#ffffff", 0.95));
    for (let i = -3; i <= 3; i++) b.box(0.09, 1.0, 0.06, i * 1.45, 0.92, -1.26, lit("#3a3d47"), 0, false);
    b.box(10, 0.07, 0.08, 0, 0.9, -1.25, lit("#3a3d47")); b.box(10, 0.07, 0.08, 0, 1.9, -1.25, lit("#3a3d47"));
    for (const x of [-2.4, -0.8, 0.8, 2.4]) {
      b.box(1.0, 0.12, 0.5, x, 0.42, -0.95, lit("#2e5fa8")); b.box(1.0, 0.6, 0.1, x, 0.5, -1.18, lit("#2e5fa8"));
      b.box(0.9, 0.08, 0.4, x, 0.0, -0.95, lit("#4a4550"));
    }
    for (const x of [-1.6, 1.6]) b.cyl(0.03, 0.03, 2.4, x, 0, 0.25, lit("#f2c12e"));
    b.cyl(0.025, 0.025, 10, 0, 2.15, 0.25, lit("#f2c12e")).rotation.z = Math.PI / 2;
  }
  // ================= CAFETERIA =================
  {
    const b = new Builder(parent, SETS.cafe);
    b.room(12, 7, 3.2, lit("#ffffff", wallTex("#9fd3c7"), 3, 1), lit("#ffffff", tileTex("#f1ece0", "#e3b9a3"), 6, 4), lit("#efe7dc"));
    b.box(6.5, 0.95, 0.8, -1.2, 0, -2.9, lit("#b8bfc9"));
    b.box(6.5, 0.04, 0.85, -1.2, 0.95, -2.9, lit("#d8dde4"));
    b.box(6.4, 0.03, 0.35, -1.2, 1.4, -2.75, glow(null, "#dff3ff", 0.55), 0, false);
    const foods = ["#e0a040", "#c0392b", "#7fbf4f", "#f4e3b0", "#d35f8d", "#e3a72f"];
    for (let i = 0; i < 6; i++) { b.box(0.8, 0.08, 0.45, -3.6 + i * 0.95, 0.95, -2.95, lit("#9aa3ad")); b.ball(0.16, 1.8, 0.55, 1, -3.6 + i * 0.95, 1.06, -2.95, lit(foods[i])); }
    b.frame(2.6, 1.0, -1.2, 2.45, -3.48, signTex("menu", ["MENU", "Pasta · Tacos · Salad"], "#2b3a33", "#fff4c2", 1024, 400, 130), 0, true);
    b.cyl(0.55, 0.55, 0.05, 3.1, 0.72, -0.3, lit("#f4efe3")); b.cyl(0.06, 0.08, 0.72, 3.1, 0, -0.3, lit("#4a4550"));
    b.frame(1.4, 0.9, 3.4, 2.1, -3.48, signTex("pizza", ["Taco", "Tuesday!"], "#ff8a3d", "#ffffff", 800, 520, 150));
  }
  // ================= LIBRARY (night) =================
  {
    const b = new Builder(parent, SETS.library);
    b.room(10, 6, 4, lit("#ffffff", wallTex("#6a4c70"), 3, 1), lit("#ffffff", woodTex("#8a5a3a"), 4, 3), lit("#4a3650"), lit("#ffffff", wallTex("#6a4c70"), 2, 1));
    for (const x of [-3.3, 0, 3.3]) b.boxFace(3.2, 3.3, 0.45, x, 0, -2.75, lit("#5a3420"), lit("#ffffff", spinesTex(`lib${x}`, 5, "#5a3420")));
    b.box(4.4, 0.08, 1.3, 0, 0.74, -0.9, lit("#7a4a2a")); for (const sx of [-2, 2]) b.box(0.12, 0.74, 1.1, sx, 0, -0.9, lit("#5a3420"));
    for (const x of [-1.4, 1.5]) { b.box(0.36, 0.04, 0.16, x, 0.82, -1.25, lit("#d9b13b")); b.cyl(0.02, 0.02, 0.3, x, 0.82, -1.3, lit("#d9b13b")); b.box(0.42, 0.1, 0.18, x, 1.08, -1.25, glow(null, "#3fa46a", 0.9)); b.box(0.36, 0.03, 0.12, x, 1.06, -1.2, glow(null, "#fff1c4", 2.0)); }
    b.books(-0.85, 0.78, -1.05, 14, 2, 0.34); b.books(0.85, 0.78, -1.0, 11, 5, 0.32, 0.15); b.books(-1.55, 0.78, -0.7, 5, 7, 0.3, -0.3);
    H.libClock = b.frame(0.5, 0.5, 3.4, 3.55, -2.48, clockTex(2, 0, "lib"), 0, true);
    for (const z of [-1.2, 1.4]) b.plane(1.2, 1.8, -4.98, 2.0, z, glow(windowTex(true), "#ffffff", 0.9), Math.PI / 2);
    // the open book Marcus closes (cover rotates on a hinge)
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.46), lit("#f6efdc"));
    const pg = new THREE.Group(); pg.position.set(0, 0.79, -0.95); page.position.x = 0.17; pg.add(page); b.add(pg);
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.46), lit("#c0392b")); left.position.set(-0.17, 0.79, -0.95); b.add(left);
    H.bookPage = page;
  }
  // ================= INSIDE THE BRAIN =================
  {
    const b = new Builder(parent, SETS.brain);
    b.room(14, 7, 5, lit("#ffffff", brainTex(), 3, 1.2), lit("#ffffff", brainTex(), 4, 3, "floor"), lit("#ffffff", brainTex(), 3, 2, "ceil"));
    // Marcus's leaky bucket (left)
    const bucketM = lit("#ffffff", ctex("bucket", 512, 256, (g) => {
      g.fillStyle = "#9aa7b4"; g.fillRect(0, 0, 512, 256);
      for (let x = 0; x < 512; x += 64) { g.fillStyle = "rgba(255,255,255,0.18)"; g.fillRect(x, 0, 10, 256); }
      g.fillStyle = "#1c1420"; for (const [x, y, r] of [[60, 190, 16], [180, 120, 12], [300, 205, 18], [420, 150, 13], [250, 70, 10], [470, 220, 11]]) { g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "#fbf6e6"; g.fillRect(160, 20, 190, 60); g.strokeStyle = "#1c1420"; g.lineWidth = 6; g.strokeRect(160, 20, 190, 60);
      g.font = "700 44px Fredoka"; g.fillStyle = "#1c1420"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("MARCUS", 255, 52);
    }));
    b.cyl(0.75, 0.6, 1.1, -3.2, 0, -1.2, bucketM, 32, true);
    b.cyl(0.6, 0.6, 0.02, -3.2, 0.01, -1.2, lit("#7d8794"));
    H.bucketFacts = [];
    // Leo's tidy shelf (right) with labelled boxes
    const sx0 = 3.2, sz = -2.2;
    b.box(2.6, 0.08, 0.5, sx0, 0, sz, lit("#a8693a")); b.box(2.6, 0.08, 0.5, sx0, 2.3, sz, lit("#a8693a"));
    for (const y of [0.78, 1.55]) b.box(2.6, 0.06, 0.5, sx0, y, sz, lit("#a8693a"));
    for (const x of [-1.3, 0, 1.3]) b.box(0.08, 2.38, 0.5, sx0 + x, 0, sz, lit("#8a5530"));
    b.box(2.6, 2.38, 0.04, sx0, 0, sz - 0.25, lit("#7a4a2a"));
    const labels: [string, string][] = [["Glycolysis", "#ffd36b"], ["Krebs Cycle", "#9fe0ff"], ["Enzymes", "#b8f28c"], ["Genetics", "#ff9fc3"], ["Hormones", "#d6b8ff"], ["Physics", "#ffb86b"]];
    labels.forEach(([l, c], i) => {
      if (i === 0) return; // the first one is carried in by Dr. Synapse
      const col = i % 2, row = Math.floor(i / 2);
      b.boxFace(1.0, 0.62, 0.42, sx0 - 0.65 + col * 1.3, 0.08 + (2 - row) * 0.77 - (row === 2 ? 0 : 0), sz, lit(c), lit("#ffffff", boxTex(l, c)));
    });
    const carry = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.62, 0.42), [lit("#ffd36b"), lit("#ffd36b"), lit("#ffd36b"), lit("#ffd36b"), lit("#ffffff", boxTex("Glycolysis", "#ffd36b")), lit("#ffd36b")]);
    carry.castShadow = true; carry.receiveShadow = true; b.root.add(carry); H.docBox = carry;
    b.frame(1.2, 0.5, sx0, 2.75, -2.48, signTex("leolabel", ["LEO"], "#fbf6e6", "#1c1420", 600, 250, 150));
  }
  // ================= EXAM HALL =================
  {
    const b = new Builder(parent, SETS.exam);
    b.room(16, 12, 5, lit("#ffffff", wallTex("#cfd8e6"), 4, 1), lit("#ffffff", woodTex("#d39b62"), 5, 5), lit("#efe7dc"));
    H.examClock = b.frame(0.9, 0.9, 0, 3.7, -5.97, clockTex(9, 0, "exam"), 0, true);
    b.frame(4.2, 0.8, 0, 2.5, -5.97, signTex("examsign", ["EXAM IN PROGRESS", "Quiet please"], "#c0353a", "#ffffff", 1400, 300, 120));
    for (const x of [-5.5, 5.5]) b.plane(2.2, 1.6, x, 3.3, -5.97, glow(windowTex(false), "#ffffff", 0.85));
    H.examPaper = [];
    for (let r = 0; r < 4; r++) for (const x of [-3, -1, 1, 3]) {
      const z = -1.05 - r * 1.6;
      b.desk(x, z, 0.75, 0.55, 0.72, "#c8a070");
      const p = b.plane(0.26, 0.34, x, 0.725, z + 0.02, lit("#fbfaf4"), 0, -Math.PI / 2); p.rotation.z = 0.1;
    }
  }
  // ================= CEREMONY STAGE =================
  {
    const b = new Builder(parent, SETS.stage);
    b.room(14, 9, 6, lit("#ffffff", curtainTex("#a5253a"), 6, 1), lit("#ffffff", woodTex("#b97a45"), 4, 4), lit("#3a2632"), lit("#ffffff", curtainTex("#8e1f32"), 4, 1));
    b.box(14, 0.8, 5, 0, 0, -2.0, lit("#ffffff", woodTex("#c48650"), 4, 2));
    b.box(14, 0.8, 0.05, 0, 0, 0.52, lit("#3a2632"));
    b.frame(7.5, 1.3, 0, 4.2, -4.4, signTex("banner", ["RIDGEVIEW SCHOOL OF MEDICINE", "White Coat Ceremony"], "#1f3b6a", "#ffe08a", 2048, 360, 120, "#e8c45a"), 0, true);
    b.box(0.8, 1.15, 0.55, -3.2, 0.8, -1.8, lit("#5a3420")); b.cyl(0.18, 0.18, 0.02, -3.2, 1.6, -1.52, lit("#e8c45a")).rotation.x = Math.PI / 2;
    for (const x of [-5.2, 5.2]) { b.cyl(0.22, 0.16, 0.5, x, 0.8, -2.6, lit("#d9b13b")); b.ball(0.38, 1, 0.8, 1, x, 1.5, -2.6, lit("#4f9a4a")); }
  }
  return H;
}

export const V3 = V;

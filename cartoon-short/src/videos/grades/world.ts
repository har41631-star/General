// One three.js world holding all nine sets; update(id, frame, camera) poses the camera, the camera-relative key light
// (frozen per shot, as in the bridge short), the two-tone / card uniforms, the dynamic props and the cast.
import * as THREE from "three";
import { TONE, CHAR, untone } from "../bridge/shade";
import { LIGHTS } from "../bridge/lights";
import { NOINK } from "../bridge/ink";
import { Pool, Actor, Fx, CamInfo, Stage } from "./cards";
import { buildSets, Handles } from "./sets";
import { SHOTS, Shot, camAt, FPS, S, E, Wd, clamp01, smooth, Light } from "./story";
import { appTex, clockTex, acceptTex, windowTex } from "./tex";

type C3 = [number, number, number];
type Rig = { lit: C3; shade: C3; lift: C3; lambert: number; sideK: number; term: number; charTint: C3; charShade: number; charGrad: number; bodyGrad: number; sideTint: C3; sunI: number; bounce: C3; sat: number; bg: string };
const D = LIGHTS.day, G = LIGHTS.golden;
const RIGS: Record<Light, Rig> = {
  day: { lit: [1.5, 1.44, 1.3], shade: [0.42, 0.41, 0.52], lift: [0.05, 0.06, 0.11], lambert: D.lambert, sideK: D.sideK, term: D.term, charTint: D.charTint, charShade: D.charShade, charGrad: D.charGrad, bodyGrad: D.bodyGrad, sideTint: D.sideTint, sunI: D.sunI, bounce: [0, 0, 0], sat: 1.06, bg: "#cfe3f2" },
  golden: { lit: [1.5, 1.08, 0.72], shade: [0.3, 0.27, 0.48], lift: [0.05, 0.05, 0.14], lambert: 0.35, sideK: 0.84, term: 0.12, charTint: [1.0, 0.88, 0.74], charShade: 0.88, charGrad: 0.09, bodyGrad: 0.22, sideTint: G.sideTint, sunI: 3, bounce: [0.03, 0.015, 0], sat: 1.08, bg: "#f0c49a" },
  night: { lit: [1.42, 1.12, 0.78], shade: [0.17, 0.18, 0.38], lift: [0.04, 0.05, 0.15], lambert: 0.4, sideK: 0.82, term: 0.12, charTint: [1.0, 0.84, 0.72], charShade: 0.84, charGrad: 0.11, bodyGrad: 0.26, sideTint: [0.78, 0.78, 0.98], sunI: 3, bounce: [0.02, 0.01, 0.02], sat: 1.06, bg: "#1b1d3a" },
  stage: { lit: [1.55, 1.25, 0.95], shade: [0.26, 0.2, 0.42], lift: [0.05, 0.04, 0.14], lambert: 0.35, sideK: 0.84, term: 0.12, charTint: [1.0, 0.92, 0.84], charShade: 0.88, charGrad: 0.08, bodyGrad: 0.2, sideTint: [0.86, 0.82, 0.98], sunI: 3, bounce: [0.03, 0.01, 0.01], sat: 1.08, bg: "#2a1a28" },
  brain: { lit: [1.5, 1.38, 1.38], shade: [0.46, 0.32, 0.5], lift: [0.06, 0.04, 0.1], lambert: 0.35, sideK: 0.84, term: 0.18, charTint: [1.0, 0.95, 0.95], charShade: 0.88, charGrad: 0.07, bodyGrad: 0.2, sideTint: [0.95, 0.88, 0.96], sunI: 3, bounce: [0, 0, 0], sat: 1.04, bg: "#f07aa8" },
};
export const gradeLight = (l: Light): "day" | "golden" => (l === "day" || l === "brain" ? "day" : "golden");

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export class World {
  root = new THREE.Group();
  private H: Handles;
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private sun = new THREE.DirectionalLight("#fff3e0", 3);
  private hemi = new THREE.HemisphereLight("#dcecff", "#b49a78", 0.5);
  private frustum = new THREE.Frustum(); private m4 = new THREE.Matrix4(); private sph = new THREE.Sphere(); private v = V();
  private appState = -1; private clockKey = "";
  constructor() {
    this.H = buildSets(this.root);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.root.add(this.sun, this.sun.target, this.hemi);
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  /** pose everything for shot `sh` at frame fr; returns the camera's look point (default lens focus) */
  update(sh: Shot, fr: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = fr / FPS, R = RIGS[sh.light];
    const c = camAt(sh, fr);
    cam.position.copy(c.pos); cam.up.set(0, 1, 0); cam.lookAt(c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.05; cam.far = 200; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    cam.layers.enable(NOINK);
    scene.background = untone(R.bg);
    // ---- key light: camera-relative az / el, frozen per shot (from the shot's first camera key) ----
    const k0 = sh.cam[0], fwd = V(k0.look[0] - k0.pos[0], 0, k0.look[2] - k0.pos[2]).normalize();
    const [az, el] = (sh.sun ?? [55, 35]).map((d) => (d * Math.PI) / 180);
    const back = fwd.clone().negate(), right = V(-fwd.z, 0, fwd.x);
    // az measured from "behind the camera" toward screen right: 0 = front light, 90 = from the right
    const hz = back.clone().multiplyScalar(Math.cos(az)).add(right.clone().multiplyScalar(Math.sin(az)));
    const sunDir = V(hz.x * Math.cos(el), Math.sin(el), hz.z * Math.cos(el)).normalize();
    const focus = c.look.clone();
    this.sun.position.copy(focus).addScaledVector(sunDir, 40); this.sun.target.position.copy(focus);
    this.sun.intensity = R.sunI;
    const sc = this.sun.shadow.camera, Rr = 7;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 5; sc.far = 90; sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.02;
    TONE.uLitCol.value.set(...R.lit); TONE.uShadeCol.value.set(...R.shade); TONE.uShadeLift.value.set(...R.lift);
    TONE.uLambert.value = R.lambert; TONE.uSideK.value = R.sideK; TONE.uTerm.value = R.term; TONE.uBounce.value.set(...R.bounce); TONE.uSat.value = R.sat;
    CHAR.uCharTint.value.set(...R.charTint); CHAR.uCharShade.value = R.charShade; CHAR.uGrad.value = R.charGrad;
    CHAR.uBodyGrad.value = R.bodyGrad; CHAR.uSideTint.value.set(...R.sideTint);
    // ---- dynamic props ----
    this.props(sh, t);
    // ---- cast + effects ----
    const rightV = V().setFromMatrixColumn(cam.matrixWorld, 0);
    const ci: CamInfo = { pos: cam.position, right: rightV, sun: sunDir, night: sh.light === "night" };
    const st: Stage = { places: [], fx: [] };
    sh.cast(t, ci, st);
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const s2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * s2, p.z), 2.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -s2 : s2, s2, s2);
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (p.w <= 0.001 || p.h <= 0.001) continue;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else if (p.yaw !== undefined) e.mesh.rotation.set(0, p.yaw, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }

  private props(sh: Shot, t: number) {
    const H = this.H;
    // laptop screen: app (empty -> file -> ready), then the acceptance letter
    let st = 0;
    if (t >= Wd("a1", 5)) st = 1;
    if (t >= Wd("a2", 10) - 0.1) st = 2;
    if (t >= S("r1") - 0.2) st = 3;
    if (st !== this.appState) {
      const m = H.laptop.material as THREE.MeshBasicMaterial;
      m.map = st === 3 ? acceptTex() : appTex(st as 0 | 1 | 2); m.needsUpdate = true; this.appState = st;
    }
    // clocks creep
    const min = Math.floor(Math.max(0, t - S("m4")) * 2) % 60, emin = Math.floor(Math.max(0, t - S("e1")) * 3) % 60;
    const ck = `${min}|${emin}`;
    if (ck !== this.clockKey) {
      (H.dormClock.material as THREE.MeshBasicMaterial).map = clockTex(3, min); (H.dormClock.material as THREE.Material).needsUpdate = true;
      (H.examClock.material as THREE.MeshBasicMaterial).map = clockTex(9, 10 + emin, "exam"); (H.examClock.material as THREE.Material).needsUpdate = true;
      this.clockKey = ck;
    }
    // the dorm window follows the time of day
    const wm = H.dormWin.material as THREE.MeshBasicMaterial, wt = windowTex(sh.light === "night");
    if (wm.map !== wt) { wm.map = wt; wm.needsUpdate = true; }
    // bus scenery scrolls past
    H.scenery.offset.x = -t * 0.32;
    // library book: the right page swings shut onto the left cover on "closed"
    const close = smooth(clamp01((t - Wd("c2", 3)) / 0.3));
    const pg = H.bookPage.parent!;
    pg.rotation.z = close * Math.PI * 0.98;
    // Dr. Synapse's box: carried overhead, then slid into the top-left cubby on "shelf"
    // (the box lives in the brain set's local space)
    const slot = V(3.2 - 0.65, 1.93, -2.2), hold = V(2.25, 1.2, -1.4);
    const u = smooth(clamp01((t - (Wd("c4", 5) - 0.55)) / 0.55));
    H.docBox.position.copy(hold).lerp(slot, u);
    H.docBox.visible = t > S("c4") - 0.5 && t < E("c4") + 5;
  }
}

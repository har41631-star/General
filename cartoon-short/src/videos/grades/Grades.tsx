// "Who Got the Better Grades?" — a Synaptic Recall story short in the cartoon-3D style of the bridge short: the same post
// chain (ink -> lens blur -> bloom -> neutral tone map -> grade, MSAA 4), flat lit character cards, painted sets.
// On top: the hook's stacked split screen (two cameras), white flashes, the script's on-screen text cards and the
// end card. Frames are pure functions of the frame number.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AbsoluteFill, continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { InkPass, noInkFallback } from "../bridge/ink";
import { LensBlur } from "../bridge/lensblur";
import { GradeEffect, GRADES, gradeFor } from "../bridge/grade";
import { World, gradeLight } from "./world";
import { SHOTS, TOTAL, FPS, shotAt, SPLIT_END, FLASHES, ENDCARD, dofAt, S, E, Wd, pop } from "./story";
import { loadFonts, FONT } from "./tex";
import { Pen, drSynapse } from "./toon";

export const GRADES_FRAMES = TOTAL;
/** optional link on the end card: set it here (left empty, nothing is shown) */
export const PRODUCT_URL = "";

const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.45, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.6 });
  const mip = b.mipmapBlurPass, setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};
const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ id: number; world: World }> = ({ id, world }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 24, nearScale: 1.2 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(GRADES.day, 1),
  }), [camera, scene]);
  // R3F's dispose={null} overwrites the instance method, so free the pass through its prototype
  useEffect(() => () => InkPass.prototype.dispose.call(fx.ink), [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      <primitive object={fx.ink} dispose={null} />
      <primitive object={fx.lens.pre} dispose={null} />
      <primitive object={fx.lens.main} dispose={null} />
      <primitive object={fx.bloom} dispose={null} />
      <primitive object={fx.tone} dispose={null} />
      <primitive object={fx.grade} dispose={null} />
    </EffectComposer>
  ), [fx]);
  const sh = SHOTS[id - 1], cam = camera as THREE.PerspectiveCamera;
  const target = world.update(sh, f, cam, scene);
  noInkFallback(world.root);
  cam.getWorldDirection(fwd);
  if (sh.focus) fpt.set(...sh.focus(f / FPS)); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = dofAt(sh, f);
  gradeFor(fx.grade, gradeLight(sh.light));
  return (<><primitive object={world.root} dispose={null} />{post}</>);
};

const View: React.FC<{ id: number; world: World; top?: number }> = ({ id, world, top = 0 }) => (
  <AbsoluteFill style={{ top, height: 1920 }}>
    <ThreeCanvas width={1080} height={1920} shadows gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 40, near: 0.05, far: 200 }}>
      <Inner id={id} world={world} />
    </ThreeCanvas>
  </AbsoluteFill>
);

// ---------------- 2D overlays ----------------
const outline = (w: number, col = "#1c1420") => ({ WebkitTextStroke: `${w}px ${col}`, paintOrder: "stroke fill" as const });
const Card: React.FC<{ f: number; a: number; b: number; y: number; children: React.ReactNode; rot?: number }> = ({ f, a, b, y, children, rot = -2 }) => {
  if (f < a || f >= b) return null;
  const s = pop(f / FPS, a / FPS, 0.3), out = Math.min(1, (b - f) / 5);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, display: "flex", justifyContent: "center", transform: `scale(${s * out}) rotate(${rot}deg)`, transformOrigin: "50% 50%" }}>
      {children}
    </div>
  );
};
const Title: React.FC<{ text: string; size?: number; color?: string }> = ({ text, size = 104, color = "#ffffff" }) => (
  <div style={{ fontFamily: FONT.title, fontWeight: 700, fontSize: size, color, textAlign: "center", lineHeight: 1.02, padding: "0 60px", ...outline(size * 0.2), filter: "drop-shadow(0 10px 0 rgba(28,20,32,0.35))" }}>{text}</div>
);
const Badge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 22, background: "#fffaf0", border: "10px solid #1c1420", borderRadius: 44, padding: "22px 44px", boxShadow: "0 14px 0 rgba(28,20,32,0.35)" }}>
    <ClockIcon color={color} />
    <div style={{ fontFamily: FONT.title, fontWeight: 600, fontSize: 64, color: "#1c1420" }}>{label}</div>
    <div style={{ fontFamily: FONT.title, fontWeight: 700, fontSize: 76, color }}>{value}</div>
  </div>
);
const ClockIcon: React.FC<{ color: string }> = ({ color }) => (
  <svg width="78" height="78" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill={color} stroke="#1c1420" strokeWidth="9" />
    <path d="M50 26 V52 L66 62" stroke="#1c1420" strokeWidth="9" strokeLinecap="round" fill="none" /></svg>
);
const Accepted: React.FC = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 26, background: "#ffffff", border: "10px solid #1c1420", borderRadius: 48, padding: "26px 40px", boxShadow: "0 14px 0 rgba(28,20,32,0.35)", maxWidth: 940 }}>
    <svg width="110" height="110" viewBox="0 0 100 100" style={{ flex: "none" }}><circle cx="50" cy="50" r="44" fill="#2fb36a" stroke="#1c1420" strokeWidth="7" />
      <path d="M28 52 L44 68 L74 36" stroke="#fff" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
    <div style={{ fontFamily: FONT.title, color: "#1c1420", lineHeight: 1.05 }}>
      <div style={{ fontWeight: 700, fontSize: 66 }}>Leo: Accepted</div>
      <div style={{ fontWeight: 600, fontSize: 44, color: "#1f3b6a" }}>Ridgeview School of Medicine</div>
    </div>
  </div>
);

/** the brain mascot drawn by the same toon code as the 3D cards (so it matches) */
const DocCanvas: React.FC<{ f: number; size: number }> = ({ f, size }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const t = f / FPS, wave = Math.round(Math.sin(t * 9) * 10) / 10, blink = Math.floor(f % 75) < 4 ? 1 : 0;
  useLayoutEffect(() => {
    const cv = ref.current!, g = cv.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
    g.setTransform(cv.width / 600, 0, 0, cv.width / 600, 0, -150 * (cv.width / 600));
    drSynapse(new Pen(g), { wave, blink, mood: "happy", hop: 12 * Math.max(0, Math.sin(t * 4)) });
  }, [wave, blink, t]);
  return <canvas ref={ref} width={size} height={Math.round(size * (850 / 600))} style={{ width: size, height: Math.round(size * (850 / 600)) }} />;
};
const EndCard: React.FC<{ f: number }> = ({ f }) => {
  const a = Math.min(1, (f - ENDCARD) / 9);
  const t = (f - ENDCARD) / FPS;
  const s1 = pop(t, 0.15, 0.35), s2 = pop(t, 0.45, 0.35), s3 = pop(t, 0.8, 0.35);
  return (
    <AbsoluteFill style={{ opacity: a, background: "radial-gradient(ellipse at 50% 38%, #3a1830 0%, #171717 55%, #111111 100%)", alignItems: "center" }}>
      <div style={{ marginTop: 300, transform: `scale(${s1})` }}><DocCanvas f={f} size={640} /></div>
      <div style={{ transform: `scale(${s2})`, marginTop: 10, fontFamily: FONT.ui, fontWeight: 700, fontSize: 112, color: "#f5f5f5", letterSpacing: -2 }}>Synaptic Recall</div>
      <div style={{ transform: `scale(${s3})`, marginTop: 28, fontFamily: FONT.title, fontWeight: 600, fontSize: 62, color: "#ff8cc0", textAlign: "center", lineHeight: 1.15, padding: "0 90px" }}>
        Turn your lectures into stories &amp; Anki decks
      </div>
      {PRODUCT_URL ? <div style={{ marginTop: 50, fontFamily: FONT.ui, fontWeight: 600, fontSize: 54, color: "#cfcfcf", transform: `scale(${s3})` }}>{PRODUCT_URL}</div> : null}
    </AbsoluteFill>
  );
};

export const GradesShort: React.FC = () => {
  const f = useCurrentFrame();
  const world = useMemo(() => new World(), []);
  const world2 = useMemo(() => new World(), []); // the split screen's second camera needs its own scene graph
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("grades fonts"));
  useEffect(() => { loadFonts().then(() => { setReady(true); continueRender(handle); }); }, [handle]);
  if (!ready) return null;
  const debugShot = (getInputProps() as { shot?: number }).shot;
  const split = f < SPLIT_END && !debugShot;
  const endOpaque = f >= ENDCARD + 9;
  const sh = debugShot ? SHOTS[debugShot - 1] : shotAt(f);
  let flash = 0;
  for (const a of FLASHES) if (f >= a && f < a + 5) flash = [1, 0.8, 0.55, 0.3, 0.12][f - a];
  const fr = (s: number) => Math.round(s * FPS);
  return (
    <AbsoluteFill style={{ background: "#111" }}>
      {endOpaque ? null : split ? (
        <>
          <AbsoluteFill style={{ height: 960, overflow: "hidden" }}><View id={1} world={world} top={-480} /></AbsoluteFill>
          <AbsoluteFill style={{ top: 960, height: 960, overflow: "hidden" }}><View id={2} world={world2} top={-480} /></AbsoluteFill>
          <AbsoluteFill style={{ top: 952, height: 16, background: "#1c1420" }} />
          <AbsoluteFill style={{ top: 955, height: 10, background: "#fffaf0" }} />
        </>
      ) : <View id={sh.id} world={world} />}
      {/* on-screen text from the script */}
      <Card f={f} a={fr(S("hook2") - 0.1)} b={SPLIT_END} y={850}><Title text="Who got the better grades?" size={110} /></Card>
      <Card f={f} a={split ? 10 ** 9 : fr(S("m1") - 0.1)} b={fr(E("m1") + 0.6)} y={260}><Title text="Marcus" size={130} color="#9fc0ff" /></Card>
      <Card f={f} a={fr(Wd("m3", 0) + 0.1)} b={fr(S("m4") - 0.1)} y={240}><Badge label="Study time:" value="14 hrs/day" color="#ff5d5d" /></Card>
      <Card f={f} a={fr(S("l1") - 0.1)} b={fr(E("l1") + 0.6)} y={260}><Title text="Leo" size={130} color="#ffb36b" /></Card>
      <Card f={f} a={fr(S("a3") + 0.2)} b={fr(S("a4") - 0.05)} y={1560} rot={2}><Badge label="Study time:" value="~2 hrs/day" color="#2fb36a" /></Card>
      <Card f={f} a={fr(S("r2") - 0.05)} b={fr(S("r3") - 0.1)} y={250}><Accepted /></Card>
      {flash > 0 && <AbsoluteFill style={{ background: "#ffffff", opacity: flash }} />}
      {f >= ENDCARD && <EndCard f={f} />}
    </AbsoluteFill>
  );
};

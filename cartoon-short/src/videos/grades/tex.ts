// Painted textures (walls, floors, shelves, curtains, windows) and in-world screens / paper (the Synaptic Recall app,
// the enzyme slide, flashcards, the exam question, the acceptance letter, signs). All Canvas2D, cached by key.
import * as THREE from "three";
import { staticFile } from "remotion";

export const rng = (seed: number) => {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
};
const hash = (k: string) => { let h = 7; for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) % 100003; return h; };
const cache = new Map<string, THREE.CanvasTexture>();
export const ctex = (key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, repeat = true) => {
  let t = cache.get(key);
  if (!t) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    draw(cv.getContext("2d")!, rng(hash(key)));
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    cache.set(key, t);
  }
  return t;
};

// ---------------- fonts ----------------
export const FONT = { title: "Fredoka", ui: "Inter" };
let fontsP: Promise<void> | null = null;
export const loadFonts = () => {
  if (!fontsP) {
    const faces: [string, string, string][] = [
      ["Fredoka", "600", "fredoka-latin-600-normal.woff2"], ["Fredoka", "700", "fredoka-latin-700-normal.woff2"],
      ["Inter", "400", "inter-latin-400-normal.woff2"], ["Inter", "500", "inter-latin-500-normal.woff2"],
      ["Inter", "600", "inter-latin-600-normal.woff2"], ["Inter", "700", "inter-latin-700-normal.woff2"],
    ];
    fontsP = Promise.all(faces.map(([fam, wt, file]) => new FontFace(fam, `url(${staticFile(`grades/fonts/${file}`)})`, { weight: wt }).load()
      .then((f) => { (document.fonts as unknown as Set<FontFace>).add(f); }))).then(() => undefined);
  }
  return fontsP;
};

// ---------------- helpers ----------------
const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
};
const INKC = "#1c1420";
const text = (g: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, col: string, weight = 600, font = FONT.title, align: CanvasTextAlign = "center") => {
  g.font = `${weight} ${size}px ${font}`; g.fillStyle = col; g.textAlign = align; g.textBaseline = "middle"; g.fillText(s, x, y);
};
const shadeHex = (c: string, k: number) => {
  const n = parseInt(c.slice(1), 16), f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, "0");
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`;
};
const mottle = (g: CanvasRenderingContext2D, r: () => number, w: number, h: number, n: number, a: number, light = "255,255,255", dark = "40,20,60") => {
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, s = 6 + r() * 40;
    g.fillStyle = `rgba(${r() < 0.5 ? light : dark},${(a * r()).toFixed(3)})`;
    g.beginPath(); g.ellipse(x, y, s, s * (0.5 + r()), r() * 3, 0, Math.PI * 2); g.fill();
  }
};

// ---------------- surfaces ----------------
export const wallTex = (col: string, key = "") => ctex(`wall${col}${key}`, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  mottle(g, r, 512, 512, 260, 0.05);
  for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(255,255,255,${0.025 * r()})`; g.fillRect(r() * 512, 0, 2 + r() * 6, 512); }
});
export const woodTex = (col = "#c98a52") => ctex(`wood${col}`, 512, 512, (g, r) => {
  const n = 6, ph = 512 / n;
  for (let i = 0; i < n; i++) {
    g.fillStyle = shadeHex(col, 0.9 + 0.2 * r()); g.fillRect(0, i * ph, 512, ph);
    for (let k = 0; k < 14; k++) { g.strokeStyle = `rgba(90,50,20,${0.08 + 0.1 * r()})`; g.lineWidth = 1 + r() * 2; const y = i * ph + r() * ph; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(170, y + 4 * (r() - 0.5), 340, y + 4 * (r() - 0.5), 512, y); g.stroke(); }
    g.fillStyle = "rgba(40,20,10,0.75)"; g.fillRect(0, i * ph, 512, 3);
    const off = r() * 512; g.fillRect(off, i * ph, 3, ph);
  }
});
export const tileTex = (a = "#e9e4d6", b = "#c9d6d2") => ctex(`tile${a}${b}`, 512, 512, (g, r) => {
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? a : b; g.fillRect(x * 128, y * 128, 128, 128); }
  mottle(g, r, 512, 512, 120, 0.04);
  g.strokeStyle = "rgba(60,50,60,0.45)"; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, 512); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(512, i * 128); g.stroke(); }
});
export const carpetTex = (col: string) => ctex(`carpet${col}`, 512, 512, (g, r) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(${r() < 0.5 ? "255,255,255" : "0,0,0"},${0.05 * r()})`; g.fillRect(r() * 512, r() * 512, 2, 2); }
  g.strokeStyle = "rgba(255,255,255,0.06)"; g.lineWidth = 10;
  for (let i = -512; i < 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 512, 512); g.stroke(); }
});
/** bookshelf front: wooden frame, 4 shelves of coloured spines */
export const spinesTex = (seed: string, rows = 4, frame = "#7a4a2a") => ctex(`spines${seed}${rows}`, 512, 768, (g, r) => {
  g.fillStyle = frame; g.fillRect(0, 0, 512, 768);
  const cols = ["#c0392b", "#2e6db4", "#e3a72f", "#3c9a5f", "#7b4fa0", "#e8e1cf", "#1f3b5a", "#d35f8d", "#55a3a8", "#a8552c"];
  const rh = 768 / rows;
  for (let k = 0; k < rows; k++) {
    const y0 = k * rh + 14, y1 = (k + 1) * rh - 6;
    g.fillStyle = "#3a2416"; g.fillRect(14, y0, 484, y1 - y0);
    let x = 18;
    while (x < 490) {
      const w = 14 + r() * 26, h = (y1 - y0) * (0.62 + 0.36 * r()), c = cols[Math.floor(r() * cols.length)];
      if (x + w > 494) break;
      const lean = r() < 0.08;
      g.save(); g.translate(x, y1); if (lean) g.rotate(0.12);
      g.fillStyle = c; g.fillRect(0, -h, w, h);
      g.fillStyle = "rgba(255,255,255,0.35)"; g.fillRect(3, -h + 10, w - 6, 3); g.fillRect(3, -h * 0.25, w - 6, 3);
      g.strokeStyle = INKC; g.lineWidth = 2.5; g.strokeRect(0, -h, w, h);
      g.restore();
      x += w + (lean ? 6 : 0.5);
    }
    g.fillStyle = shadeHex(frame, 1.15); g.fillRect(0, y1, 512, 8);
  }
  g.strokeStyle = INKC; g.lineWidth = 6; g.strokeRect(3, 3, 506, 762);
});
export const curtainTex = (col: string) => ctex(`curtain${col}`, 512, 512, (g) => {
  for (let x = 0; x < 512; x++) {
    const v = 0.72 + 0.28 * Math.sin((x / 512) * Math.PI * 2 * 7) ** 2;
    g.fillStyle = shadeHex(col, v); g.fillRect(x, 0, 1, 512);
  }
});
export const lockerTex = () => ctex("locker", 512, 512, (g) => {
  for (let i = 0; i < 4; i++) {
    const x = i * 128;
    g.fillStyle = i % 2 ? "#4f7fae" : "#5a8bba"; g.fillRect(x, 0, 128, 512);
    g.strokeStyle = INKC; g.lineWidth = 5; g.strokeRect(x + 3, 3, 122, 506);
    g.fillStyle = "rgba(20,30,50,0.55)";
    for (let k = 0; k < 5; k++) g.fillRect(x + 34, 40 + k * 14, 60, 6);
    g.fillStyle = "#c9ccd2"; g.fillRect(x + 100, 230, 10, 40); g.strokeRect(x + 100, 230, 10, 40);
  }
});
export const brainTex = () => ctex("brainwall", 512, 512, (g, r) => {
  g.fillStyle = "#f07aa8"; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = i % 3 ? "rgba(178,40,104,0.75)" : "rgba(255,190,215,0.55)"; g.lineWidth = i % 3 ? 7 : 5; g.lineCap = "round";
    let x = r() * 512, y = r() * 512; g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { const nx = x + (r() - 0.5) * 150, ny = y + (r() - 0.5) * 150; g.quadraticCurveTo((x + nx) / 2 + (r() - 0.5) * 80, (y + ny) / 2 + (r() - 0.5) * 80, nx, ny); x = nx; y = ny; }
    g.stroke();
  }
});
/** window glass: day sky with campus trees, or night sky with a moon */
export const windowTex = (night: boolean) => ctex(`window${night}`, 512, 512, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 512);
  if (night) { gr.addColorStop(0, "#141c46"); gr.addColorStop(1, "#3b3f7a"); } else { gr.addColorStop(0, "#5d9ae0"); gr.addColorStop(1, "#bcd7f2"); }
  g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  if (night) {
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,230,${0.4 + 0.6 * r()})`; g.fillRect(r() * 512, r() * 300, 3, 3); }
    g.fillStyle = "#fff6c8"; g.beginPath(); g.arc(380, 120, 52, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#2a2f66"; g.beginPath(); g.arc(404, 106, 46, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = "#ffffff"; for (const [x, y, s] of [[120, 110, 50], [170, 95, 60], [220, 115, 45], [380, 170, 40], [420, 160, 50]]) { g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill(); }
  }
  const tree = night ? "#1e2a3a" : "#4f9a4a", bld = night ? "#2a2c4e" : "#d8a878";
  g.fillStyle = bld; g.fillRect(60, 330, 180, 182); g.fillRect(300, 300, 150, 212);
  g.fillStyle = night ? "#ffd86b" : "#7fb2e6";
  for (let y = 350; y < 500; y += 46) for (let x = 80; x < 220; x += 44) if (!night || r() < 0.4) g.fillRect(x, y, 22, 26);
  for (let y = 320; y < 500; y += 46) for (let x = 318; x < 440; x += 44) if (!night || r() < 0.4) g.fillRect(x, y, 22, 26);
  g.fillStyle = tree;
  for (const [x, s] of [[30, 90], [255, 110], [480, 100], [150, 70]]) { g.beginPath(); g.arc(x, 470, s, 0, Math.PI * 2); g.fill(); }
});
/** a long scenery strip for the bus windows (scrolled by texture offset) */
export const sceneryTex = () => ctex("scenery", 1024, 256, (g, r) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, "#6aa6e6"); gr.addColorStop(1, "#cfe3f5");
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 256);
  for (let i = 0; i < 9; i++) {
    const x = i * 118 + r() * 40, w = 70 + r() * 60, h = 70 + r() * 110;
    g.fillStyle = ["#e0a77a", "#c97a6a", "#e9d49a", "#9ab0c9"][i % 4]; g.fillRect(x, 256 - 40 - h, w, h);
    g.strokeStyle = INKC; g.lineWidth = 4; g.strokeRect(x, 256 - 40 - h, w, h);
    g.fillStyle = "#7fb2e6"; for (let y = 256 - 30 - h; y < 210; y += 30) for (let xx = x + 10; xx < x + w - 15; xx += 26) g.fillRect(xx, y, 14, 16);
  }
  g.fillStyle = "#57a14d";
  for (let i = 0; i < 16; i++) { const x = i * 66 + r() * 30; g.beginPath(); g.arc(x, 215, 26 + r() * 20, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = "#6b6f7a"; g.fillRect(0, 226, 1024, 30);
});

// ---------------- paper / signs ----------------
/** a framed sign / poster: title lines on a coloured board */
export const signTex = (key: string, lines: string[], bg: string, fg: string, w = 1024, h = 512, size = 110, border = INKC) => ctex(`sign${key}`, w, h, (g) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = border; g.lineWidth = Math.max(10, w / 60); g.strokeRect(0, 0, w, h);
  const lh = size * 1.15, y0 = h / 2 - ((lines.length - 1) * lh) / 2;
  lines.forEach((s, i) => text(g, s, w / 2, y0 + i * lh, i === 0 ? size : size * 0.62, fg, 700));
}, false);
export const clockTex = (hr: number, min: number, key = "") => ctex(`clock${hr}:${min}${key}`, 256, 256, (g) => {
  g.fillStyle = "#fbf8ef"; g.beginPath(); g.arc(128, 128, 118, 0, Math.PI * 2); g.fill();
  g.strokeStyle = INKC; g.lineWidth = 14; g.stroke();
  g.fillStyle = INKC;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(128 + 92 * Math.sin(a) - 4, 128 - 92 * Math.cos(a) - 4, 8, 8); }
  const ha = ((hr % 12) + min / 60) / 12 * Math.PI * 2, ma = (min / 60) * Math.PI * 2;
  g.lineCap = "round"; g.lineWidth = 12; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 55 * Math.sin(ha), 128 - 55 * Math.cos(ha)); g.stroke();
  g.lineWidth = 8; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 85 * Math.sin(ma), 128 - 85 * Math.cos(ma)); g.stroke();
  g.fillStyle = "#e5478f"; g.beginPath(); g.arc(128, 128, 10, 0, Math.PI * 2); g.fill();
}, false);
/** the projector slide nobody can follow: glycolysis enzymes */
export const slideTex = () => ctex("slide", 1024, 640, (g, r) => {
  g.fillStyle = "#fdfdfb"; g.fillRect(0, 0, 1024, 640);
  g.fillStyle = "#2e4a8a"; g.fillRect(0, 0, 1024, 96);
  text(g, "Glycolysis: Enzyme Regulation", 512, 50, 52, "#ffffff", 700);
  const names = ["Hexokinase", "PGI", "PFK-1", "Aldolase", "TPI", "GAPDH", "PGK", "PGM", "Enolase", "Pyruvate kinase"];
  names.forEach((n, i) => {
    const x = 70 + (i % 5) * 190, y = 170 + Math.floor(i / 5) * 210;
    g.fillStyle = ["#ffe4a3", "#cfe8ff", "#ffd1dc", "#d9f2d0"][i % 4]; rr(g, x, y, 160, 64, 10); g.fill();
    g.strokeStyle = INKC; g.lineWidth = 4; g.stroke();
    text(g, n, x + 80, y + 32, n.length > 9 ? 22 : 28, INKC, 600, FONT.ui);
    if (i % 5 < 4) { g.beginPath(); g.moveTo(x + 165, y + 32); g.lineTo(x + 185, y + 32); g.stroke(); }
    for (let k = 0; k < 3; k++) { g.fillStyle = "#8a8f9c"; g.fillRect(x + 6, y + 82 + k * 18, 120 + r() * 30, 7); }
  });
  g.strokeStyle = "#c0353a"; g.lineWidth = 5;
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(100 + r() * 800, 150 + r() * 400); g.bezierCurveTo(r() * 1024, r() * 640, r() * 1024, r() * 640, 100 + r() * 800, 150 + r() * 400); g.stroke(); }
}, false);
/** a flashcard, front (question) or back (answer) */
export const flashTex = (front: boolean) => ctex(`flash${front}`, 768, 480, (g) => {
  g.fillStyle = front ? "#ffffff" : "#fff4d6"; rr(g, 8, 8, 752, 464, 36); g.fill();
  g.strokeStyle = INKC; g.lineWidth = 14; g.stroke();
  g.fillStyle = "#e5478f"; rr(g, 40, 36, 150, 50, 20); g.fill();
  text(g, front ? "ANKI" : "ANSWER", 115, 62, 28, "#ffffff", 700);
  if (front) { text(g, "Rate-limiting enzyme", 384, 210, 62, INKC, 700); text(g, "of glycolysis?", 384, 290, 62, INKC, 700); }
  else { text(g, "PFK-1", 384, 230, 130, "#2e6db4", 700); text(g, "phosphofructokinase-1", 384, 340, 40, "#555", 600); }
}, false);
/** the exam question sheet */
export const examTex = () => ctex("exam", 768, 1000, (g) => {
  g.fillStyle = "#fbfaf4"; g.fillRect(0, 0, 768, 1000);
  g.strokeStyle = INKC; g.lineWidth = 12; g.strokeRect(6, 6, 756, 988);
  text(g, "Question 14", 60, 90, 54, INKC, 700, FONT.title, "left");
  ["Which enzyme catalyzes the", "rate-limiting step of", "glycolysis?"].forEach((s, i) => text(g, s, 60, 190 + i * 62, 46, INKC, 600, FONT.title, "left"));
  ["A  Hexokinase", "B  Aldolase", "C  PFK-1", "D  Enolase"].forEach((s, i) => {
    g.strokeStyle = INKC; g.lineWidth = 6; g.beginPath(); g.arc(90, 470 + i * 110, 30, 0, Math.PI * 2); g.stroke();
    text(g, s, 140, 470 + i * 110, 46, INKC, 600, FONT.title, "left");
  });
}, false);
/** acceptance letter on a laptop screen */
export const acceptTex = () => ctex("accept", 1280, 800, (g) => {
  g.fillStyle = "#f4f6fb"; g.fillRect(0, 0, 1280, 800);
  g.fillStyle = "#1f3b6a"; g.fillRect(0, 0, 1280, 150);
  text(g, "Ridgeview School of Medicine", 640, 78, 64, "#ffffff", 700);
  text(g, "Congratulations, Leo!", 640, 300, 92, "#1f3b6a", 700);
  text(g, "You have been accepted.", 640, 420, 64, "#333a48", 600);
  g.fillStyle = "#2fb36a"; rr(g, 470, 540, 340, 110, 30); g.fill();
  text(g, "Accept offer", 640, 596, 48, "#ffffff", 700);
}, false);
/** a labelled storage box (Leo's brain shelf) */
export const boxTex = (label: string, col: string) => ctex(`box${label}`, 512, 384, (g) => {
  g.fillStyle = col; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = INKC; g.lineWidth = 12; g.strokeRect(6, 6, 500, 372);
  g.fillStyle = "#fffaf0"; rr(g, 60, 120, 392, 150, 18); g.fill(); g.lineWidth = 6; g.stroke();
  text(g, label, 256, 196, label.length > 10 ? 50 : 64, INKC, 700);
}, false);
/** fact scrap leaking out of Marcus's bucket */
export const factTex = (label: string) => ctex(`fact${label}`, 512, 256, (g) => {
  g.fillStyle = "#fff8c9"; rr(g, 8, 8, 496, 240, 24); g.fill();
  g.strokeStyle = INKC; g.lineWidth = 10; g.stroke();
  g.fillStyle = "rgba(255,230,60,0.85)"; g.fillRect(40, 100, 432, 56);
  text(g, label, 256, 128, label.length > 11 ? 52 : 64, INKC, 700);
}, false);

// ---------------- the Synaptic Recall app (replica of the upload page) ----------------
/** state: 0 = empty upload page, 1 = lecture file dropped in, 2 = story + Anki deck ready */
export const appTex = (state: 0 | 1 | 2) => ctex(`app${state}`, 1600, 1000, (g) => {
  const W = 1600, H = 1000;
  g.fillStyle = "#171717"; g.fillRect(0, 0, W, H);
  // sidebar
  g.fillStyle = "#121212"; g.fillRect(0, 0, 330, H);
  g.fillStyle = "#2a2a2a"; g.fillRect(329, 0, 2, H);
  brainIcon(g, 48, 62, 26);
  text(g, "Synaptic Recall", 90, 62, 30, "#f2f2f2", 600, FONT.ui, "left");
  g.fillStyle = "#262626"; rr(g, 20, 120, 290, 62, 12); g.fill();
  g.fillStyle = "#e5478f"; rr(g, 38, 136, 30, 30, 8); g.fill(); text(g, "+", 53, 150, 28, "#fff", 700, FONT.ui);
  text(g, "Upload a lecture", 84, 152, 24, "#f2f2f2", 500, FONT.ui, "left");
  text(g, "STUDY", 30, 225, 16, "#8a8a8a", 600, FONT.ui, "left");
  ["Dashboard", "Stories", "Anki Decks", "Exams"].forEach((s, i) => text(g, s, 70, 275 + i * 58, 24, "#e6e6e6", 500, FONT.ui, "left"));
  text(g, "ACCOUNT", 30, 520, 16, "#8a8a8a", 600, FONT.ui, "left");
  ["Plan & Billing", "Refer a Friend", "How It Works", "My Progress"].forEach((s, i) => text(g, s, 70, 570 + i * 58, 24, "#e6e6e6", 500, FONT.ui, "left"));
  // mode cards
  const cards: [string, string, string, boolean][] = [["Story", "To understand it", "#e0a050", true], ["Anki", "To memorize it", "#6f8ff0", true], ["Exam", "To apply it", "#777", false]];
  cards.forEach(([t, sub, c, on], i) => {
    const x = 400 + i * 380, y = 70;
    g.fillStyle = on ? "#1f1c18" : "#1b1b1b"; rr(g, x, y, 350, 120, 16); g.fill();
    g.strokeStyle = on ? c : "#333"; g.lineWidth = 3; g.stroke();
    g.fillStyle = on ? c : "#1b1b1b"; rr(g, x + 26, y + 44, 32, 32, 8); g.fill(); if (!on) { g.strokeStyle = "#555"; g.stroke(); }
    if (on) { g.strokeStyle = "#111"; g.lineWidth = 5; g.beginPath(); g.moveTo(x + 33, y + 60); g.lineTo(x + 40, y + 68); g.lineTo(x + 52, y + 52); g.stroke(); }
    text(g, t, x + 84, y + 46, 34, on ? "#f2f2f2" : "#777", 600, FONT.ui, "left");
    text(g, sub, x + 84, y + 84, 22, on ? c : "#666", 500, FONT.ui, "left");
  });
  // upload box
  g.setLineDash([10, 8]); g.strokeStyle = "#3a3a3a"; g.lineWidth = 3; rr(g, 400, 230, 1110, 720, 18); g.stroke(); g.setLineDash([]);
  g.strokeStyle = "#444"; rr(g, 440, 268, 260, 60, 12); g.stroke(); text(g, "Choose your field  ⌄", 570, 298, 22, "#ddd", 500, FONT.ui);
  if (state === 0) {
    g.strokeStyle = "#d8d8d8"; g.lineWidth = 7; g.lineCap = "round";
    g.beginPath(); g.moveTo(955, 470); g.lineTo(955, 400); g.moveTo(925, 430); g.lineTo(955, 400); g.lineTo(985, 430); g.moveTo(905, 455); g.lineTo(905, 490); g.lineTo(1005, 490); g.lineTo(1005, 455); g.stroke();
    text(g, "Upload your lecture", 955, 570, 64, "#f4f4f4", 600, FONT.ui);
    text(g, "PDF or PowerPoint  ·  up to 500 MB", 955, 635, 24, "#9a9a9a", 400, FONT.ui);
    g.fillStyle = "#f6f6f6"; rr(g, 740, 690, 200, 70, 35); g.fill(); text(g, "Choose file", 840, 726, 24, "#111", 600, FONT.ui);
    g.fillStyle = "#222"; rr(g, 960, 690, 200, 70, 35); g.fill(); g.strokeStyle = "#444"; g.stroke(); text(g, "Paste text", 1060, 726, 24, "#eee", 600, FONT.ui);
  } else if (state === 1) {
    g.fillStyle = "#232323"; rr(g, 700, 470, 510, 120, 18); g.fill(); g.strokeStyle = "#444"; g.stroke();
    g.fillStyle = "#d9534f"; rr(g, 725, 492, 60, 76, 8); g.fill(); text(g, "PDF", 755, 530, 20, "#fff", 700, FONT.ui);
    text(g, "Lecture_07_Glycolysis.pdf", 810, 515, 26, "#f2f2f2", 600, FONT.ui, "left");
    g.fillStyle = "#333"; rr(g, 810, 548, 370, 14, 7); g.fill();
    g.fillStyle = "#e5478f"; rr(g, 810, 548, 250, 14, 7); g.fill();
    text(g, "Making your story and Anki deck…", 955, 680, 30, "#bbbbbb", 500, FONT.ui);
  } else {
    const done: [string, string, string][] = [["Story", "Ready to read", "#e0a050"], ["Anki deck", "Ready to review", "#6f8ff0"]];
    done.forEach(([t, sub, c], i) => {
      const x = 520 + i * 450, y = 420;
      g.fillStyle = "#1f1f1f"; rr(g, x, y, 410, 260, 22); g.fill(); g.strokeStyle = c; g.lineWidth = 4; g.stroke();
      g.fillStyle = c; g.beginPath(); g.arc(x + 70, y + 80, 34, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "#111"; g.lineWidth = 8; g.beginPath(); g.moveTo(x + 54, y + 80); g.lineTo(x + 66, y + 93); g.lineTo(x + 88, y + 66); g.stroke();
      text(g, t, x + 40, y + 160, 40, "#f4f4f4", 600, FONT.ui, "left");
      text(g, sub, x + 40, y + 210, 26, c, 500, FONT.ui, "left");
    });
  }
}, false);
/** small pink brain logo with glasses (sidebar / phone icon) */
export const brainIcon = (g: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  g.fillStyle = "#ec4f95"; g.beginPath(); g.ellipse(x, y, s, s * 0.85, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "#8f1d55"; g.lineWidth = s * 0.12; g.beginPath(); g.moveTo(x - s * 0.5, y - s * 0.4); g.quadraticCurveTo(x, y - s * 0.75, x + s * 0.5, y - s * 0.4); g.stroke();
  g.fillStyle = "#fff"; g.strokeStyle = "#111"; g.lineWidth = s * 0.12;
  for (const k of [-1, 1]) { g.beginPath(); g.arc(x + k * s * 0.36, y + s * 0.08, s * 0.3, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.fillStyle = "#e9e9ef"; g.beginPath(); g.ellipse(x, y + s * 0.55, s * 0.55, s * 0.18, 0, 0, Math.PI * 2); g.fill();
};

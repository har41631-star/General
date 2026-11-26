/* OnyxClip promo v2 — beat-for-beat on the reference "YOUR FIRST CLIP" timeline.
   Scene times (REF) are the reference video's own timestamps; spoken keywords come from timings. */
const T = window.TIMINGS;
const DUR = T.duration;
const LINE = Object.fromEntries(T.lines.map(l => [l.id, l]));
const norm = s => s.toLowerCase().replace(/[^a-z0-9.']/g, '');
function wt(id, word, end) {
  const w = LINE[id].words.find(w => norm(w.w).startsWith(word));
  if (!w) throw new Error('no word ' + id + ':' + word);
  return end ? w.t1 : w.t0;
}
const $ = s => document.querySelector(s);
const el = (tag, cls, css, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = p => 1 - Math.pow(1 - clamp(p), 3);
const lerp = (a, b, p) => a + (b - a) * p;
const CUES = [];
const cue = (type, t, o = {}) => CUES.push({ type, t: +t.toFixed(3), ...o });

// reference timeline (seconds)
const REF = { fail: 3.4, failOut: 4.4, mine: 4.8, s1: 7.0, pE: 8.0, pEflat: 11.3, s2: 13.4, wheel: 14.0, wheelOut: 19.55,
  s3: 19.75, pI: 20.5, s4: 24.75, pK: 25.45, made: 28.8, pass: 31.55, card: 32.85 };

/* ---------- map ---------- */
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const R = rng(11);
const MW = 3600, MH = 4000;
const cols = [], rows = [];
for (let x = -60; x < MW + 320; x += 300 + Math.floor(R() * 50)) cols.push(x);
for (let y = -40; y < MH + 320; y += 292 + Math.floor(R() * 50)) rows.push(y);
(function drawMap() {
  const c = $('#map').getContext('2d');
  c.fillStyle = '#07090e'; c.fillRect(0, 0, MW, MH);
  const SW = 34;
  const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
  for (let i = 0; i < cols.length - 1; i++) for (let j = 0; j < rows.length - 1; j++) {
    const x = cols[i] + SW / 2, y = rows[j] + SW / 2, w = cols[i + 1] - cols[i] - SW, h = rows[j + 1] - rows[j] - SW;
    if (R() < 0.11) { c.fillStyle = '#0b1830'; rr(x, y, w, h, 14); c.fill(); c.strokeStyle = 'rgba(79,134,255,.10)'; c.lineWidth = 2; c.stroke(); continue; }
    c.fillStyle = '#0e121a'; rr(x, y, w, h, 12); c.fill(); c.strokeStyle = '#151b27'; c.lineWidth = 2; c.stroke();
    const nx = 1 + Math.floor(R() * 3), ny = 1 + Math.floor(R() * 3);
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
      if (R() < 0.35) continue;
      const lw = w / nx, lh = h / ny, g = 10, shade = 17 + Math.floor(R() * 9);
      c.fillStyle = `rgb(${shade - 4},${shade},${shade + 9})`; rr(x + a * lw + g, y + b * lh + g, lw - 2 * g, lh - 2 * g, 6); c.fill();
    }
  }
  c.strokeStyle = '#111622'; c.lineWidth = 2; c.setLineDash([22, 18]);
  for (const x of cols) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, MH); c.stroke(); }
  for (const y of rows) { c.beginPath(); c.moveTo(0, y); c.lineTo(MW, y); c.stroke(); }
})();

/* ---------- route ---------- */
const P = (ci, ri) => [cols[ci], rows[ri]];
const WAY = [
  { p: P(4, 11), node: 'start' }, { p: P(4, 9), node: 1, lbl: 'PASTE' }, { p: P(7, 9) }, { p: P(7, 7), node: 2, lbl: 'HUNT' },
  { p: P(4, 7) }, { p: P(4, 5), node: 3, lbl: 'WATCH' }, { p: P(7, 5) }, { p: P(7, 3), node: 4, lbl: 'SCORE' },
  { p: P(5, 3) }, { p: P(5, 2), node: 'done', lbl: 'DONE' },
];
let acc = 0;
WAY.forEach((w, i) => { if (i) { const [a, b] = WAY[i - 1].p; acc += Math.hypot(w.p[0] - a, w.p[1] - b); } w.len = acc; });
const ROUTE_LEN = acc;
const nodeLen = n => WAY.find(w => w.node === n).len;
const nodePos = n => WAY.find(w => w.node === n).p;
const d = 'M' + WAY.map(w => w.p.join(' ')).join(' L');
const svg = $('#routesvg');
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
const wdefs = sv('defs', {});
const rmask = sv('mask', { id: 'routeMask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: MW, height: MH }, wdefs);
const maskPath = sv('path', { d, fill: 'none', stroke: '#fff', 'stroke-width': 40, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': ROUTE_LEN, 'stroke-dashoffset': ROUTE_LEN }, rmask);
const dashed = sv('path', { d, fill: 'none', stroke: '#6f9bff', 'stroke-opacity': .8, 'stroke-width': 9, 'stroke-dasharray': '24 18', 'stroke-linejoin': 'round', opacity: 0, mask: 'url(#routeMask)' });
const solids = [[46, .10], [24, .28], [10, 1]].map(([w, o]) => sv('path', { d, fill: 'none', stroke: w === 10 ? '#7fa6ff' : '#4f86ff', 'stroke-opacity': o, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': ROUTE_LEN, 'stroke-dashoffset': ROUTE_LEN }));
// wrong route (MISSION FAILED): start -> right -> up -> dead end next to node 1
const [sx, sy] = nodePos('start');
const failD = `M${sx} ${sy} L${cols[6]} ${sy} L${cols[6]} ${rows[9]} L${cols[5]} ${rows[9]}`;
const failPath = sv('path', { d: failD, fill: 'none', stroke: '#ff3d57', 'stroke-width': 10, 'stroke-dasharray': '24 16', 'stroke-linecap': 'round', opacity: 0 });
const failX = sv('g', { opacity: 0, transform: `translate(${cols[5]} ${rows[9]})` });
sv('path', { d: 'M-46 -46 L46 46 M46 -46 L-46 46', stroke: '#ff3d57', 'stroke-width': 17, 'stroke-linecap': 'round' }, failX);
function starPath(R1, R2) { let s = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? R2 : R1, a = -Math.PI / 2 + i * Math.PI / 5; s += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1); } return s + 'Z'; }
const NODES = {};
WAY.filter(w => w.node).forEach(w => {
  const g = sv('g', { transform: `translate(${w.p[0]} ${w.p[1]})` });
  const inner = sv('g', {}, g);
  const halo = sv('circle', { r: 58, fill: 'none', stroke: '#4f86ff', 'stroke-width': 4, opacity: 0 }, inner);
  const ring = sv('circle', { r: 56, fill: 'none', stroke: '#4f86ff', 'stroke-width': 3, 'stroke-opacity': .5 }, inner);
  const disc = sv('circle', { r: 38, fill: '#0b0f17', stroke: '#4f86ff', 'stroke-width': 6 }, inner);
  let txt;
  if (w.node === 'start') txt = sv('path', { d: 'M-10 -15 L16 0 L-10 15 Z', fill: '#9dbbff' }, inner);
  else if (w.node === 'done') txt = sv('path', { d: starPath(22, 10), fill: '#9dbbff' }, inner);
  else { txt = sv('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#9dbbff', 'font-family': 'Inter', 'font-weight': 800, 'font-size': 36 }, inner); txt.textContent = w.node; }
  const check = sv('path', { d: 'M-14 1 L-4 11 L15 -10', fill: 'none', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, inner);
  const lbl = sv('text', { y: 92, 'text-anchor': 'middle', fill: '#8fa9e8', 'font-family': 'JetBrains Mono', 'font-weight': 700, 'font-size': 24, 'letter-spacing': 4 }, inner);
  lbl.textContent = w.node === 'start' ? 'START' : w.lbl;
  NODES[w.node] = { g, inner, halo, disc, txt, check, ring, len: w.len };
  inner.style.opacity = 0;
});

/* ---------- camera ---------- */
const cam = { x: 0, y: 0, zoom: 0.85, rot: -12, tilt: 32 };
const world = $('#world');
const applyCam = () => { world.style.transform = `translate(540px,960px) rotateX(${cam.tilt}deg) rotate(${cam.rot}deg) scale(${cam.zoom}) translate(${-cam.x}px,${-cam.y}px)`; };
const bbox = (() => { const xs = WAY.map(w => w.p[0]), ys = WAY.map(w => w.p[1]); return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 }; })();
const overview = { x: bbox.cx, y: bbox.cy - 40, zoom: 0.5, rot: 0, tilt: 10 };
const focus = (n, zoom, rot, dy = 0, tilt = 18) => { const [x, y] = nodePos(n); return { x, y: y - dy / zoom, zoom, rot, tilt }; };
Object.assign(cam, { x: bbox.cx + 140, y: bbox.cy + 420, zoom: 0.85, rot: -12, tilt: 32 });
const rp = { v: 0 };

/* ---------- clip card (OnyxClip output) ---------- */
function clipEl({ img, title, cap, w, h, radius = 24, wm = 'OnyxClip' }) {
  const e = el('div', 'clip', `width:${w}px;height:${h}px;border-radius:${radius}px`);
  e.appendChild(el('div', 'bg', `background-image:url(${img})`));
  const strip = el('div', 'strip', `top:${0.27 * h}px;height:${w / 1.86}px;background-image:url(${img})`);
  strip.appendChild(el('div', 'play'));
  e.appendChild(strip);
  e.appendChild(el('div', 'wm', `top:${0.07 * h}px;font-size:${w * 0.045}px`, wm));
  e.appendChild(el('div', 'ttl', `top:${0.115 * h}px;font-size:${w * 0.07}px`, title));
  const c = el('div', 'cap', `top:${0.755 * h}px;font-size:${w * 0.09}px`, cap);
  e.appendChild(c);
  e._cap = c; e._strip = strip;
  return e;
}
const FOOT = i => `../assets/foot${i}.jpg`;

/* ---------- A: hook cards (positions from the reference frame) ---------- */
const HOOK = [
  { f: 2, name: 'Podcast', dur: '2:14:08', x: 40, y: 286, r: -6 },
  { f: 3, name: 'Stream', dur: '6:02:51', x: 700, y: 330, r: 7 },
  { f: 4, name: 'MMA vlog', dur: '48:37', x: 36, y: 1030, r: 5 },
  { f: 1, name: 'Interview', dur: '1:31:20', x: 372, y: 1150, r: -3 },
  { f: 2, name: 'Reaction', dur: '4:47:02', x: 690, y: 1010, r: 8 },
].map((c, i) => {
  const e = el('div', 'lcard', `left:${c.x}px;top:${c.y}px`);
  e.innerHTML = `<div class="img" style="background-image:url(${FOOT(c.f)})"><div class="badge">VIDEO</div><div class="dur">${c.dur}</div><div class="name">${c.name}</div></div>`;
  $('#hook').appendChild(e); e._r = c.r; e._i = i;
  return e;
});

/* ---------- G: moments wheel ---------- */
const wheel = $('#wheel');
const WR0 = 132, WR1 = 410;
const KINDS = ['FUNNY', 'EMOTIONAL', 'HYPE', 'BANTER', 'PAYOFFS'];
const WIMG = [1, 2, 3, 4, 1];
const wdef = sv('defs', {}, wheel);
const WEDGES = KINDS.map((k, i) => {
  const mid = -90 + i * 72, a0 = (mid - 34) * Math.PI / 180, a1 = (mid + 34) * Math.PI / 180, m = mid * Math.PI / 180;
  const p = (r, a) => `${(r * Math.cos(a)).toFixed(1)} ${(r * Math.sin(a)).toFixed(1)}`;
  const path = `M${p(WR0, a0)} L${p(WR1, a0)} A${WR1} ${WR1} 0 0 1 ${p(WR1, a1)} L${p(WR0, a1)} A${WR0} ${WR0} 0 0 0 ${p(WR0, a0)} Z`;
  const cp = sv('clipPath', { id: 'wc' + i }, wdef); sv('path', { d: path }, cp);
  const g = sv('g', {}, wheel);
  const cx = Math.cos(m) * (WR0 + WR1) / 2, cy = Math.sin(m) * (WR0 + WR1) / 2;
  sv('image', { href: FOOT(WIMG[i]), x: cx - 300, y: cy - 165, width: 600, height: 330, preserveAspectRatio: 'xMidYMid slice', 'clip-path': `url(#wc${i})` }, g);
  const dim = sv('path', { d: path, fill: 'rgba(6,8,12,.62)' }, g);
  const glow = sv('path', { d: path, fill: 'none', stroke: '#4f86ff', 'stroke-width': 22, 'stroke-opacity': 0, 'stroke-linejoin': 'round' }, g);
  const edge = sv('path', { d: path, fill: 'none', stroke: '#33405c', 'stroke-width': 4, 'stroke-linejoin': 'round' }, g);
  const lx = Math.cos(m) * 300, ly = Math.sin(m) * 300 + (i === 0 ? -40 : 0);
  const lg = sv('g', { transform: `translate(${lx.toFixed(1)} ${ly.toFixed(1)})` }, g);
  const tw = k.length * 15 + 30;
  const lr = sv('rect', { x: -tw / 2, y: -20, width: tw, height: 40, rx: 9, fill: 'rgba(0,0,0,.7)' }, lg);
  const lt = sv('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#fff', 'font-family': 'JetBrains Mono', 'font-weight': 800, 'font-size': 22 }, lg);
  lt.textContent = k;
  return { g, dim, glow, edge, lr, lt, mid: m };
});
sv('circle', { r: WR0 - 8, fill: '#0b0f17', stroke: '#33405c', 'stroke-width': 5 }, wheel);
const wl = sv('text', { y: -40, 'text-anchor': 'middle', fill: '#8a93a6', 'font-family': 'JetBrains Mono', 'font-weight': 700, 'font-size': 20, 'letter-spacing': 3 }, wheel); wl.textContent = 'MOMENTS';
const wcount = sv('text', { y: 30, 'text-anchor': 'middle', fill: '#4f86ff', 'font-family': 'Inter', 'font-weight': 900, 'font-size': 76 }, wheel); wcount.textContent = '0/5';
const spark = sv('circle', { r: 60, fill: 'none', stroke: '#9dbbff', 'stroke-width': 4, 'stroke-dasharray': '3 14', opacity: 0 }, wheel);

/* ---------- I: watch panels ---------- */
const TILE_POS = [[0, 0], [324, 0], [648, 0], [162, 186], [486, 186]];
const TILES = TILE_POS.map(([x, y], i) => {
  const t = el('div', 'tile', `left:${x}px;top:${y}px;width:290px;height:163px;background-image:url(${FOOT([1, 2, 3, 4, 2][i])})`);
  t.innerHTML = `<div class="rec">● SCAN</div><div class="nm">PART ${i + 1}/5</div>`;
  $('#itiles').appendChild(t);
  t._rec = t.querySelector('.rec');
  return t;
});
const TAGC = ['#9dbbff', '#ffd83d', '#3ddc84', '#ff8fa3', '#c9a6ff'];
const ILINES = [[1, 'good posture, good what?'], [4, "let's set a fight"], [2, 'when you started'], [5, 'I get you one'], [3, 'denied a visa three times'],
  [1, 'good position'], [4, "let's set up a fight for you"], [2, 'three times?!'], [5, 'you get me an india visa'], [3, 'in MMA'], [1, 'good what?'], [4, 'tag team fight']];
const iInner = el('div', '', 'position:absolute;left:0;right:0;top:0');
$('#ilines').appendChild(iInner);
const IROWS = ILINES.map(([p, s], i) => { const r = el('div', '', `position:absolute;left:0;top:${i * 32}px;white-space:nowrap;opacity:0`, `<span class="tag" style="background:${TAGC[p - 1]}">P${p}</span>${s}`); iInner.appendChild(r); return r; });

/* ---------- K: virality chart ---------- */
const kc = $('#kchart');
const KW = 940, KH = 440, KB = 0.66 * KH;
const KR = rng(31);
const kpts = [];
for (let i = 0; i <= 220; i++) {
  const x = i / 220;
  let v = 6 * Math.sin(i * 0.33) + 7 * (KR() - 0.5) + 8 * Math.sin(i * 0.09);
  v += 150 * Math.exp(-Math.pow((x - 0.78) / 0.055, 2)) + 40 * Math.exp(-Math.pow((x - 0.7) / 0.05, 2));
  kpts.push([x * KW, KB - 18 - v * 1.45]);
}
const kline = 'M' + kpts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
const kdefs = sv('defs', {}, kc);
kdefs.innerHTML = `<linearGradient id="kag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f86ff" stop-opacity=".4"/><stop offset="1" stop-color="#4f86ff" stop-opacity="0"/></linearGradient><clipPath id="kclip"><rect id="kclipr" x="0" y="0" width="0" height="${KH}"/></clipPath>`;
sv('line', { x1: 0, x2: KW, y1: KB, y2: KB, stroke: '#55607a', 'stroke-width': 2, 'stroke-dasharray': '8 8' }, kc);
const kt = sv('text', { x: 4, y: KB + 30, fill: '#6f7a8f', 'font-family': 'JetBrains Mono', 'font-size': 19, 'letter-spacing': 2 }, kc); kt.textContent = 'TYPICAL MOMENT';
const kg = sv('g', { 'clip-path': 'url(#kclip)' }, kc);
sv('path', { d: kline + ` L${KW} ${KH} L0 ${KH} Z`, fill: 'url(#kag)' }, kg);
sv('path', { d: kline, fill: 'none', stroke: '#8fb0ff', 'stroke-width': 6, 'stroke-linejoin': 'round' }, kg);
const khead = sv('circle', { r: 11, fill: '#fff', stroke: '#4f86ff', 'stroke-width': 5, opacity: 0 }, kc);
const kbox = sv('g', { opacity: 0 }, kc);
const bx0 = 0.6 * KW, bx1 = 0.96 * KW, by0 = 20, by1 = KB + 12;
sv('rect', { x: bx0, y: by0, width: bx1 - bx0, height: by1 - by0, fill: 'rgba(79,134,255,.08)', stroke: '#9dbbff', 'stroke-width': 4, 'stroke-dasharray': '12 9' }, kbox);
const ks = sv('text', { x: bx1 - 14, y: by0 + 40, 'text-anchor': 'end', fill: '#9dbbff', 'font-family': 'Inter', 'font-weight': 900, 'font-size': 36 }, kbox); ks.textContent = 'SAVED';

/* ---------- L: the clip it made ---------- */
const phone = clipEl({ img: FOOT(1), title: 'Good Posture, Good What?', cap: 'Good', w: 440, h: 782, radius: 44 });
phone.style.border = '3px solid #2f3a52';
phone.style.boxShadow = '0 40px 90px rgba(0,0,0,.7), 0 0 60px rgba(79,134,255,.25)';
const pbar = el('div', '', 'position:absolute;left:0;bottom:0;height:7px;width:0;background:var(--accent)');
phone.appendChild(pbar);
$('#pL').appendChild(phone);

/* ---------- captions ---------- */
const CHUNKS = [];
T.lines.forEach((line, li) => {
  const groups = {};
  line.words.forEach(w => (groups[w.c] = groups[w.c] || []).push(w));
  Object.values(groups).forEach(ws => CHUNKS.push({ li, ws, t0: ws[0].t0 - 0.06 }));
});
CHUNKS.forEach((c, i) => {
  const next = CHUNKS[i + 1];
  const lineEnd = T.lines[c.li].words.at(-1).t1;
  if (next && next.li === c.li) c.t1 = next.t0;
  else c.t1 = next ? Math.min(lineEnd + 0.45, next.t0 - 0.02) : Math.min(DUR, lineEnd + 0.6);
  c.el = el('div', 'chunk');
  c.wel = c.ws.map(w => { const s = el('span', 'word' + (w.k ? ' key' : ''), '', w.w.replace(/[.,]$/, m => w.k ? '' : m)); c.el.appendChild(s); return s; });
  $('#captions').appendChild(c.el);
});

/* ---------- grain ---------- */
(function () {
  const g = $('#grain'), c = g.getContext('2d'), id = c.createImageData(540, 960), r = rng(99);
  for (let i = 0; i < id.data.length; i += 4) { const v = r() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  c.putImageData(id, 0, 0);
  g.style.width = '1180px'; g.style.height = '2020px'; g.style.left = '-50px'; g.style.top = '-50px';
})();

/* ===================== TIMELINE ===================== */
const tl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
const at = (t, target, vars) => tl.to(target, { duration: 0.35, ...vars }, t);
const from = (t, target, f, v) => tl.fromTo(target, f, { duration: 0.35, ...v }, t);
const slam = (t, sel) => { from(t, sel, { opacity: 0, scale: 1.7, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.28, ease: 'power4.out' }); from(t + 0.05, '#flash', { opacity: 0.55 }, { opacity: 0, duration: 0.45, ease: 'power2.out' }); };
const camTo = (t, v, dur = 0.7, e = 'power3.inOut', g = 1) => { tl.to(cam, { ...v, duration: dur, ease: e }, t); cue('whoosh', t, { g }); };
const panelIn = (t, sel, f = {}) => { from(t, sel, { opacity: 0, y: 110, scale: 0.9, rotationX: 28, rotationZ: -6, ...f }, { opacity: 1, y: 0, scale: 1, rotationX: 0, rotationZ: 0, duration: 0.5, ease: 'back.out(1.3)' }); cue('swoosh', t); };
const panelOut = (t, sel) => at(t, sel, { opacity: 0, y: -80, scale: 0.95, filter: 'blur(6px)', duration: 0.26, ease: 'power2.in' });
const nodePop = (t, n, op = 1) => from(t, NODES[n].inner, { opacity: 0, scale: 0 }, { opacity: op, scale: 1, duration: 0.35, ease: 'back.out(2.2)', svgOrigin: '0 0' });
const halo = (t, n) => from(t, NODES[n].halo, { attr: { opacity: 1, r: 40 } }, { attr: { opacity: 0, r: 130 }, duration: 0.8, ease: 'power2.out' });

/* A — hook (visible from frame 0, like the reference) */
HOOK.forEach((c, i) => tl.fromTo(c, { opacity: 1, rotate: c._r, scale: 1.06 }, { opacity: 1, rotate: c._r, scale: 1, duration: 0.4 }, 0));
tl.fromTo('#bigFirst', { opacity: 1, scale: 1.1 }, { opacity: 1, scale: 1, duration: 0.35 }, 0);
tl.fromTo('#hookPlay', { opacity: 1, x: 410, y: 893, scale: 1 }, { opacity: 1, x: 410, y: 990, scale: 0.32, duration: 0.6, ease: 'power3.inOut' }, 0.05);
at(2.4, '#hookPlay', { opacity: 0, duration: 0.6 });
cue('boom', 0.02, { g: 0.6 });
tl.to(cam, { rot: -4, x: '+=90', y: '-=150', duration: REF.fail, ease: 'none' }, 0);
[1, 2, 3, 4, 'done'].forEach((n, i) => nodePop(2.45 + i * 0.06, n, 0.45));
nodePop(2.45, 'start', 0.45);
from(2.9, '#mission', { opacity: 0, y: -30 }, { opacity: 1, y: 0, duration: 0.45 });
cue('tick', wt('hook', 'clip'), { p: 1.2 }); cue('tick', wt('hook', 'ai'), { p: 1.4 });

/* B — mission failed */
HOOK.forEach((c, i) => at(REF.fail - 0.12 + 0.015 * i, c, { opacity: 0, x: (i % 2 ? 1 : -1) * 700, y: i < 2 ? -420 : 420, rotate: c._r * 4, filter: 'blur(10px)', duration: 0.26, ease: 'power2.in' }));
at(REF.fail - 0.08, '#bigFirst', { opacity: 0, scale: 0.85, filter: 'blur(10px)', duration: 0.2, ease: 'power2.in' });
cue('whoosh', REF.fail - 0.1, { g: 0.7 });
slam(REF.fail, '#bigFail'); cue('fail', REF.fail);
from(REF.fail, '#tint', { opacity: 0 }, { opacity: 0.35, duration: 0.15 });
camTo(REF.fail - 0.1, { x: cols[5] - 40, y: rows[9] - 280 / 0.95, zoom: 0.95, rot: 4, tilt: 20 }, 0.55, 'power3.out', 0.4);
tl.set(failPath, { attr: { opacity: 1 } }, REF.fail + 0.05);
from(REF.fail + 0.05, failPath, { attr: { 'stroke-dashoffset': 1400 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.6, ease: 'power2.out' });
from(REF.fail + 0.6, failX, { attr: { opacity: 0 } }, { attr: { opacity: 1 }, duration: 0.1 });
cue('stamp', REF.fail + 0.62, { g: 0.6 });
at(REF.failOut, '#bigFail', { opacity: 0, skewX: -20, x: -120, filter: 'blur(12px)', duration: 0.3, ease: 'power3.in' });

/* C — here's mine: route reveal + pull back */
const tM = REF.mine;
at(tM - 0.1, '#tint', { opacity: 0, duration: 0.4 });
at(tM - 0.05, [failPath, failX], { attr: { opacity: 0 }, duration: 0.3 });
cue('drop', tM - 0.08);
tl.set(dashed, { attr: { opacity: 1 } }, tM);
tl.to(maskPath, { attr: { 'stroke-dashoffset': 0 }, duration: 1.5, ease: 'power2.inOut' }, tM);
cue('scan', tM + 0.05, { dur: 1.4, p: 1.2, g: 0.6 });
[1, 2, 3, 4, 'done', 'start'].forEach(n => tl.to(NODES[n].inner, { opacity: 1, duration: 0.3 }, tM + 0.2));
camTo(tM, { ...overview, rot: -7, tilt: 14 }, 1.5, 'power2.inOut');
tl.to(cam, { rot: 4, duration: REF.s1 - tM - 1.5, ease: 'none' }, tM + 1.5);
from(wt('mine', 'clip'), NODES.done.halo, { attr: { opacity: 1, r: 40 } }, { attr: { opacity: 0, r: 150 }, duration: 0.8 });
cue('ding', wt('mine', 'clip'), { p: 1.5 });

/* D — step one: dive to node 1 */
camTo(REF.s1, focus(1, 1.45, -8, 0, 14), 0.65);
tl.to(rp, { v: nodeLen(1), duration: 0.6, ease: 'power2.inOut' }, REF.s1);
halo(REF.s1 + 0.6, 1); cue('ding', REF.s1 + 0.6, { p: 1.06 });

/* E — paste link + checks */
camTo(REF.pE - 0.05, focus(1, 0.92, -6, 330, 22), 0.6, 'power3.inOut', 0.4);
from(REF.pE, '#pE', { opacity: 0, y: 160, scale: 0.85, rotationX: 40, rotationZ: -10 }, { opacity: 1, y: 0, scale: 0.95, rotationX: 16, rotationZ: -4, duration: 0.55, ease: 'back.out(1.2)' });
cue('swoosh', REF.pE);
tl.to('#pE', { rotationX: 0, rotationZ: 0, scale: 1, y: -90, duration: 0.5, ease: 'power3.inOut' }, REF.pEflat);
const URL = 'youtube.com/watch?v=n3on-mma';
const typeA = wt('open', 'paste') + 0.02, typeB = wt('open', 'link') + 0.25;
for (let i = 0; i < URL.length; i += 2) cue('type', lerp(typeA, typeB, i / URL.length), { g: 0.35 });
const ELINES = [['#e2', 11.0], ['#e3', 11.45], ['#e4', 11.65], ['#e5', 11.95], ['#e6', 12.25], ['#e7', 12.55], ['#e8', 12.9]];
ELINES.forEach(([s, t], i) => { from(t, s, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.15 }); cue('tick', t, { g: 0.5, p: 1 + i * 0.05 }); });
cue('ding', 12.9, { p: 1.3 });
panelOut(REF.s2 - 0.1, '#pE');

/* F — step two */
camTo(REF.s2, { x: (cols[4] + cols[7]) / 2, y: rows[9] - 220, zoom: 0.75, rot: 3, tilt: 16 }, 0.6);
tl.to(rp, { v: nodeLen(2), duration: 0.6, ease: 'power2.inOut' }, REF.s2);
halo(REF.s2 + 0.58, 2); cue('ding', REF.s2 + 0.58, { p: 1.12 });

/* G — moments wheel */
from(REF.wheel, '#wheelWrap', { opacity: 0, scale: 0.5, rotation: -40 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.55, ease: 'back.out(1.3)' });
cue('swoosh', REF.wheel);
tl.to(cam, { rot: -3, duration: REF.wheelOut - REF.wheel, ease: 'none' }, REF.wheel);
const LIT = [wt('k1', 'funny'), wt('k2', 'emotional'), wt('k3', 'hype'), wt('k45', 'banter'), wt('k45', 'big')];
from(15.45, spark, { attr: { opacity: 1, r: 40 } }, { attr: { opacity: 0, r: 125 }, duration: 0.6, ease: 'power2.out' });
cue('tick', 15.45, { p: 1.6 });
WEDGES.forEach((w, i) => {
  const t = LIT[i] - 0.03;
  tl.to(w.dim, { attr: { fill: 'rgba(6,8,12,0)' }, duration: 0.2 }, t);
  tl.to(w.glow, { attr: { 'stroke-opacity': 0.35 }, duration: 0.2 }, t);
  tl.to(w.edge, { attr: { stroke: '#7fa6ff', 'stroke-width': 7 }, duration: 0.2 }, t);
  tl.to(w.lr, { attr: { fill: '#4f86ff' }, duration: 0.15 }, t);
  tl.fromTo(w.g, { x: 0, y: 0 }, { x: Math.cos(w.mid) * 16, y: Math.sin(w.mid) * 16, duration: 0.3, ease: 'back.out(3)' }, t);
  cue('check', t);
});
tl.fromTo('#wheelWrap', { filter: 'drop-shadow(0 0 0px rgba(79,134,255,0))' }, { filter: 'drop-shadow(0 0 40px rgba(79,134,255,.6))', duration: 0.3 }, LIT[4] + 0.3);
at(REF.wheelOut, '#wheelWrap', { opacity: 0, scale: 0.6, rotation: 30, duration: 0.3, ease: 'power2.in' });

/* H — step three */
camTo(REF.s3, focus(3, 1.35, 6, 0, 14), 0.6);
tl.to(rp, { v: nodeLen(3), duration: 0.6, ease: 'power2.inOut' }, REF.s3);
halo(REF.s3 + 0.58, 3); cue('ding', REF.s3 + 0.58, { p: 1.18 });

/* I — watches the whole video at once */
camTo(REF.pI - 0.05, focus(3, 0.92, 4, 330, 22), 0.6, 'power3.inOut', 0.4);
panelIn(REF.pI, '#pI'); panelIn(REF.pI + 0.15, '#pI2');
const CMD = 'watch n3on-trains-mma --whole-video';
const cmdA = 20.85, cmdB = 21.45;
for (let i = 0; i < CMD.length; i += 3) cue('type', lerp(cmdA, cmdB, i / CMD.length), { g: 0.3 });
from(21.5, '#icmd2', { opacity: 0 }, { opacity: 1, duration: 0.1 });
[21.55, 21.65, 21.75, 22.0, 22.1].forEach((t, i) => { from(t, TILES[i], { opacity: 0, scale: 0.6, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 0.3, ease: 'back.out(2)' }); cue('pop', t, { g: 0.45, p: 1 + i * 0.1 }); });
IROWS.forEach((r, i) => { const t = 22.85 + i * 0.13; from(t, r, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.12 }); });
tl.to(iInner, { y: -(ILINES.length - 8) * 32, duration: 0.9, ease: 'none' }, 23.6);
cue('count', 22.65, { dur: 1.8 });
at(24.0, ['#pI', '#pI2'], { y: -50, duration: 0.4, ease: 'power2.inOut' });
panelOut(REF.s4 - 0.1, ['#pI', '#pI2']);

/* J — step four */
camTo(REF.s4, focus(4, 1.25, -5, 0, 14), 0.6);
tl.to(rp, { v: nodeLen(4), duration: 0.6, ease: 'power2.inOut' }, REF.s4);
halo(REF.s4 + 0.58, 4); cue('ding', REF.s4 + 0.58, { p: 1.24 });

/* K — when a moment explodes */
camTo(REF.pK - 0.05, focus(4, 0.92, -3, 330, 22), 0.6, 'power3.inOut', 0.4);
panelIn(REF.pK, '#pK'); panelIn(REF.pK + 0.12, '#pK2');
const kA = 25.55, kSpike = wt('spike', 'explodes');
tl.fromTo('#kclipr', { attr: { width: 0 } }, { attr: { width: 0.6 * KW }, duration: kSpike - 0.15 - kA, ease: 'none' }, kA);
tl.to('#kclipr', { attr: { width: 0.84 * KW }, duration: 0.4, ease: 'power1.in' }, kSpike - 0.15);
tl.to('#kclipr', { attr: { width: KW }, duration: 0.6, ease: 'power1.out' }, kSpike + 0.25);
cue('scan', kA, { dur: kSpike + 0.85 - kA, p: 1.4, g: 0.7 });
cue('boom', kSpike + 0.12, { g: 0.35 });
tl.to('#pK', { scale: 1.05, x: -24, duration: 0.5, ease: 'power2.out' }, kSpike - 0.1);
tl.to('#pK', { scale: 1, x: 0, duration: 0.4, ease: 'power2.inOut' }, 27.35);
const tSaved = wt('spike', 'scores') - 0.15;
from(tSaved, kbox, { opacity: 0, scale: 1.25 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)', svgOrigin: `${(bx0 + bx1) / 2} ${(by0 + by1) / 2}` });
cue('stamp', tSaved, { g: 0.7 });
[['#k1', tSaved + 0.05], ['#k2', wt('spike', 'moment', false) + 0.0], ['#k3', wt('spike', 'edits')]].forEach(([s, t]) => { from(t, s, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: 0.15 }); cue('check', t); });
panelOut(REF.made - 0.08, ['#pK', '#pK2']);

/* L — the clip it made */
camTo(REF.made - 0.05, focus('done', 1.05, 3, 120, 18), 0.6);
tl.to(rp, { v: ROUTE_LEN, duration: 0.5, ease: 'power2.inOut' }, REF.made - 0.05);
halo(REF.made + 0.3, 'done');
from(REF.made + 0.05, '#pL', { opacity: 0, scale: 0.22, y: -300 }, { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: 'power3.out' });
cue('pop', REF.made + 0.4, { p: 0.9 });
from(REF.made + 0.3, '#madeTag', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 });
const tWork = wt('made', 'work');
tl.fromTo('#atwork', { maxWidth: 0 }, { maxWidth: 440, duration: 0.3, ease: 'power2.out' }, tWork - 0.05);
cue('stamp', tWork, { g: 0.6 });

/* M — mission passed */
const tP = REF.pass;
at(tP, '#pL', { y: -220, scale: 0.78, opacity: 0, filter: 'blur(6px)', duration: 0.4, ease: 'power2.in' });
at(tP, '#madeTag', { opacity: 0, duration: 0.25 });
slam(tP, '#bigPass'); cue('pass', tP);
camTo(tP + 0.05, { ...overview, zoom: 0.52, rot: -4 }, 0.5, 'power3.out', 0.3);
tl.to(cam, { rot: 3, zoom: 0.5, duration: DUR - tP - 0.6, ease: 'none' }, tP + 0.55);

/* N — linked in bio */
from(REF.card, '#pN', { opacity: 0, y: 50, scale: 0.92 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(1.6)' });
cue('swoosh', REF.card);
const tLinked = wt('bio', 'linked');
from(tLinked, '#nPill', { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(3)' });
cue('ding', tLinked, { p: 1.8 });
tl.fromTo('#pN', { boxShadow: '0 0 0 rgba(79,134,255,0)' }, { boxShadow: '0 0 60px rgba(79,134,255,.55)', duration: 0.3 }, wt('bio', 'bio'));
tl.to('#stage', { opacity: 0, duration: 0.25, ease: 'power1.in' }, DUR - 0.25);
tl.set({}, {}, DUR);

/* ===================== per-frame derived state ===================== */
const STEP_AT = [REF.s1, REF.s2 + 0.05, 19.6, 24.6];
const fmt = n => Math.round(n).toLocaleString('en-US');
const ICOUNT = [[22.6, 0], [22.95, 1213], [23.45, 3772], [23.95, 4618], [24.45, 4822]];
function keyed(t, K) { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t <= K[i][0]) return lerp(K[i - 1][1], K[i][1], ease((t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]))); return K.at(-1)[1]; }
function kPointAt(x) { const i = clamp(Math.round(x / KW * 220), 0, 220); return kpts[i]; }

function update(t) {
  applyCam();
  solids.forEach(p => p.setAttribute('stroke-dashoffset', ROUTE_LEN - rp.v));
  for (const [k, n] of Object.entries(NODES)) {
    const reached = k !== 'start' && rp.v >= n.len - 2;
    n.disc.setAttribute('fill', reached ? '#4f86ff' : '#0b0f17');
    n.check.setAttribute('opacity', reached && k !== 'done' ? 1 : 0);
    n.txt.setAttribute('opacity', reached && k !== 'done' ? 0 : 1);
    if (k === 'done') n.txt.setAttribute('fill', reached ? '#fff' : '#9dbbff');
  }
  $('#progress').style.width = (100 * t / DUR) + '%';
  let step = 0; STEP_AT.forEach((st, i) => { if (t >= st) step = i + 1; });
  const done = t >= 28.9;
  $('#stepk').textContent = done ? 'COMPLETE' : 'STEP';
  $('#stepn').textContent = (done ? 4 : step) + '/4';
  document.querySelectorAll('#mission .dashes span').forEach((s, i) => s.classList.toggle('on', i < (done ? 4 : step)));
  HOOK.forEach((c, i) => { c.style.translate = `0 ${Math.sin(t * 2.1 + i * 1.7) * 10}px`; });
  // E typing
  const typed = Math.round(URL.length * clamp((t - typeA) / (typeB - typeA)));
  $('#eurl').textContent = URL.slice(0, typed);
  $('#ecur').style.opacity = t > 11.0 ? 0 : (Math.floor(t * 4) % 2 || (typed > 0 && typed < URL.length) ? 1 : 0);
  // G count
  wcount.textContent = LIT.filter(x => t >= x - 0.03).length + '/5';
  // I typing, tiles, counter
  const ct = Math.round(CMD.length * clamp((t - cmdA) / (cmdB - cmdA)));
  $('#icmd').textContent = CMD.slice(0, ct);
  $('#icur').style.opacity = t > 21.5 ? 0 : (Math.floor(t * 4) % 2 || (ct > 0 && ct < CMD.length) ? 1 : 0);
  TILES.forEach((tile, i) => { tile._rec.style.opacity = 0.55 + 0.45 * Math.sin(t * 9 + i); });
  $('#icount').textContent = fmt(keyed(t, ICOUNT));
  // K line head
  const cw = +$('#kclipr').getAttribute('width');
  if (cw > 2 && cw < KW - 1) { const [hx, hy] = kPointAt(cw); khead.setAttribute('cx', hx); khead.setAttribute('cy', hy); khead.setAttribute('opacity', 1); }
  else khead.setAttribute('opacity', 0);
  // L phone playback
  const pp = clamp((t - (REF.made + 0.5)) / (REF.pass - REF.made - 0.5));
  pbar.style.width = (pp * 100) + '%';
  phone._strip.style.transform = `scale(${1 + 0.07 * pp})`;
  phone._cap.innerHTML = t < REF.made + 1.05 ? 'Good' : 'Good <b>What?</b>';
  phone._cap.style.transform = `scale(${1 + 0.18 * Math.exp(-Math.max(0, t - (REF.made + 1.05)) / 0.07) * (t >= REF.made + 1.05 ? 1 : 0)})`;
  // shake on the two big slams
  const s1 = t - REF.fail, s2 = t - REF.pass;
  const sh = (s1 > 0 && s1 < 0.45 ? (1 - s1 / 0.45) * 16 : 0) + (s2 > 0 && s2 < 0.3 ? (1 - s2 / 0.3) * 8 : 0);
  $('#stage').style.translate = sh ? `${Math.sin(t * 97) * sh}px ${Math.cos(t * 83) * sh}px` : '0 0';
  const f = Math.round(t * 30);
  $('#grain').style.transform = `translate(${(f * 37) % 50 - 25}px, ${(f * 53) % 50 - 25}px)`;
  CHUNKS.forEach(c => {
    if (!(t >= c.t0 && t < c.t1)) { c.el.style.opacity = 0; return; }
    const a = clamp((t - c.t0) / 0.08);
    c.el.style.opacity = a;
    c.el.style.transform = `translateY(${(1 - a) * 16}px)`;
    c.ws.forEach((w, i) => {
      const on = t >= w.t0, s = c.wel[i];
      s.classList.toggle('on', on);
      const bump = on ? Math.exp(-(t - w.t0) / 0.07) * (w.k ? 0.16 : 0.06) : 0;
      s.style.transform = `scale(${1 + bump})`;
    });
  });
}

window.__seek = t => { tl.seek(Math.min(t, DUR - 0.0001), false); update(t); };
window.__duration = DUR;
window.__cues = CUES.sort((a, b) => a.t - b.t);
Promise.all([document.fonts.ready]).then(async () => {
  await Promise.all([1, 2, 3, 4].map(i => { const im = new Image(); im.src = FOOT(i); return im.decode(); }));
  await document.fonts.load('italic 900 100px InterX');
  await document.fonts.load('800 50px Archivo');
  window.__seek(0);
  window.__ready = true;
});

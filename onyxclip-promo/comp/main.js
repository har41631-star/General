/* OnyxClip promo — deterministic timeline. window.__seek(t) renders time t. */
const T = window.TIMINGS;
const DUR = T.duration;
const LINE = Object.fromEntries(T.lines.map(l => [l.id, l]));
const norm = s => s.toLowerCase().replace(/[^a-z0-9.']/g, '');
function wt(id, word, end) {
  const w = LINE[id].words.find(w => norm(w.w).startsWith(word));
  if (!w) throw new Error('no word ' + id + ':' + word);
  return end ? w.t1 : w.t0;
}
const LS = id => LINE[id].t0, LE = id => LINE[id].words.at(-1).t1;
const $ = s => document.querySelector(s);
const el = (tag, cls, css, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (css) e.style.cssText = css; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = p => 1 - Math.pow(1 - clamp(p), 3);
const lerp = (a, b, p) => a + (b - a) * p;

/* ---------- sound cues (collected for the audio mix) ---------- */
const CUES = [];
const cue = (type, t, o = {}) => CUES.push({ type, t: +t.toFixed(3), ...o });

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
    const kind = R();
    if (kind < 0.11) { // park
      c.fillStyle = '#0b1830'; rr(x, y, w, h, 14); c.fill();
      c.strokeStyle = 'rgba(79,134,255,.10)'; c.lineWidth = 2; c.stroke();
      continue;
    }
    c.fillStyle = '#0e121a'; rr(x, y, w, h, 12); c.fill();
    c.strokeStyle = '#151b27'; c.lineWidth = 2; c.stroke();
    // lots
    const nx = 1 + Math.floor(R() * 3), ny = 1 + Math.floor(R() * 3);
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
      if (R() < 0.35) continue;
      const lw = w / nx, lh = h / ny, g = 10;
      const shade = 17 + Math.floor(R() * 9);
      c.fillStyle = `rgb(${shade - 4},${shade},${shade + 9})`;
      rr(x + a * lw + g, y + b * lh + g, lw - 2 * g, lh - 2 * g, 6); c.fill();
    }
  }
  // street centre lines
  c.strokeStyle = '#111622'; c.lineWidth = 2; c.setLineDash([22, 18]);
  for (const x of cols) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, MH); c.stroke(); }
  for (const y of rows) { c.beginPath(); c.moveTo(0, y); c.lineTo(MW, y); c.stroke(); }
  c.setLineDash([]);
})();

/* ---------- route ---------- */
const P = (ci, ri) => [cols[ci], rows[ri]];
const WAY = [
  { p: P(4, 11), node: 'start' },
  { p: P(4, 9), node: 1, lbl: 'PASTE' },
  { p: P(7, 9) },
  { p: P(7, 7), node: 2, lbl: 'SCAN' },
  { p: P(4, 7) },
  { p: P(4, 5), node: 3, lbl: 'SCORE' },
  { p: P(7, 5) },
  { p: P(7, 3), node: 4, lbl: 'CUT' },
  { p: P(5, 3) },
  { p: P(5, 2), node: 'done', lbl: 'DONE' },
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
const dashed = sv('path', { d, fill: 'none', stroke: '#6f9bff', 'stroke-opacity': .75, 'stroke-width': 9, 'stroke-dasharray': '24 18', 'stroke-linejoin': 'round', opacity: 0, mask: 'url(#routeMask)' });
const solids = [[46, .10], [24, .28], [10, 1]].map(([w, o]) => sv('path', { d, fill: 'none', stroke: w === 10 ? '#7fa6ff' : '#4f86ff', 'stroke-opacity': o, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': ROUTE_LEN, 'stroke-dashoffset': ROUTE_LEN }));
// red failure path near the start
const [sx, sy] = nodePos('start');
const failD = `M${sx} ${sy} L${sx} ${rows[10]} L${cols[5]} ${rows[10]} L${cols[5]} ${rows[10] + 170}`;
const failPath = sv('path', { d: failD, fill: 'none', stroke: '#ff3d57', 'stroke-width': 9, 'stroke-dasharray': '24 16', 'stroke-linecap': 'round', opacity: 0 });
const failX = sv('g', { opacity: 0, transform: `translate(${cols[5]} ${rows[10] + 200})` });
sv('path', { d: 'M-42 -42 L42 42 M42 -42 L-42 42', stroke: '#ff3d57', 'stroke-width': 16, 'stroke-linecap': 'round' }, failX);
const NODES = {};
WAY.filter(w => w.node).forEach(w => {
  const g = sv('g', { transform: `translate(${w.p[0]} ${w.p[1]})` });
  const inner = sv('g', {}, g);
  const halo = sv('circle', { r: 58, fill: 'none', stroke: '#4f86ff', 'stroke-width': 4, opacity: 0 }, inner);
  const disc = sv('circle', { r: 36, fill: '#0b0f17', stroke: '#4f86ff', 'stroke-width': 6 }, inner);
  let txt;
  if (w.node === 'start') {
    txt = sv('path', { d: 'M-10 -15 L16 0 L-10 15 Z', fill: '#9dbbff' }, inner);
  } else if (w.node === 'done') {
    txt = sv('path', { d: starPath(22, 10), fill: '#9dbbff' }, inner);
  } else {
    txt = sv('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: '#9dbbff', 'font-family': 'Inter', 'font-weight': 800, 'font-size': 34 }, inner);
    txt.textContent = w.node;
  }
  const check = sv('path', { d: 'M-14 1 L-4 11 L15 -10', fill: 'none', stroke: '#fff', 'stroke-width': 7, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0 }, inner);
  const lbl = sv('text', { y: 82, 'text-anchor': 'middle', fill: '#8fa9e8', 'font-family': 'JetBrains Mono', 'font-weight': 700, 'font-size': 24, 'letter-spacing': 4 }, inner);
  lbl.textContent = w.node === 'start' ? 'START' : w.lbl;
  NODES[w.node] = { g, inner, halo, disc, txt, check, len: w.len };
  inner.style.opacity = 0;
});
function starPath(R1, R2) { let s = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? R2 : R1, a = -Math.PI / 2 + i * Math.PI / 5; s += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1); } return s + 'Z'; }

/* camera */
const cam = { x: 0, y: 0, zoom: 0.8, rot: -10, tilt: 30 };
const world = $('#world');
function applyCam() {
  world.style.transform = `translate(540px,960px) rotateX(${cam.tilt}deg) rotate(${cam.rot}deg) scale(${cam.zoom}) translate(${-cam.x}px,${-cam.y}px)`;
}
const bbox = (() => { const xs = WAY.map(w => w.p[0]), ys = WAY.map(w => w.p[1]); return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2 }; })();
const stepView = (n, rot) => { const [x, y] = nodePos(n); const z = 0.92; return { x: x + 0, y: y - 330 / z, zoom: z, rot, tilt: 22 }; };
const overview = { x: bbox.cx, y: bbox.cy - 60, zoom: 0.5, rot: 0, tilt: 8 };
Object.assign(cam, { x: bbox.cx + 120, y: bbox.cy + 500, zoom: 0.78, rot: -12, tilt: 32 });
const rp = { v: 0 };

/* ---------- vertical clip builder (OnyxClip output look) ---------- */
function clipEl(o) {
  const { img, title, cap, w, h, radius = 24, wm = 'OnyxClip' } = o;
  const e = el('div', 'clip', `width:${w}px;height:${h}px;border-radius:${radius}px`);
  e.appendChild(el('div', 'bg', `background-image:url(${img})`));
  const sh = w / 1.86;
  const strip = el('div', 'strip', `top:${0.27 * h}px;height:${sh}px;background-image:url(${img})`);
  strip.appendChild(el('div', 'play'));
  e.appendChild(strip);
  e.appendChild(el('div', 'wm', `top:${0.07 * h}px;font-size:${w * 0.045}px`, wm));
  e.appendChild(el('div', 'ttl', `top:${0.115 * h}px;font-size:${w * 0.07}px`, title));
  const c = el('div', 'cap', `top:${0.755 * h}px;font-size:${w * 0.082}px`, cap);
  e.appendChild(c);
  e._cap = c; e._strip = strip;
  return e;
}
const CLIPS = [
  { s: 76, img: '../assets/foot1.jpg', title: 'Good Posture, Good What?', cap: 'Good <b>What?</b>', name: 'Good posture, good position… in MMA', from: '4:40', why: 'Funny misunderstanding with a punchline', top: true },
  { s: 75, img: '../assets/foot2.jpg', title: 'Denied A Visa To India Three Times', cap: 'When You <b>Started</b>', name: 'Denied an India visa three times', from: '23:08', why: 'Emotional reveal with clear payoff' },
  { s: 74, img: '../assets/foot3.jpg', title: 'Let’s Set Up A Fight For You', cap: 'Let’s Set A <b>Fight</b>', name: 'Setting up a tag team fight', from: '22:03', why: 'Fun banter with a bold proposal' },
  { s: 71, img: '../assets/foot4.jpg', title: 'You Get Me An India Visa, I Get You One', cap: 'I Get <b>You One</b>', name: 'Visa swap deal: India visa for American visa', from: '23:34', why: 'Funny deal ends on a punchline' },
];

/* ---------- build: hook cards ---------- */
const HOOK = [
  { img: 'foot2', chip: 'PODCAST', dur: '2:14:08', x: 36, y: 290, r: -7 },
  { img: 'foot3', chip: 'STREAM', dur: '6:02:51', x: 714, y: 330, r: 6 },
  { img: 'foot4', chip: 'VLOG', dur: '48:37', x: 40, y: 1080, r: 5 },
  { img: 'foot1', chip: 'INTERVIEW', dur: '1:31:20', x: 388, y: 1160, r: -3 },
  { img: 'foot2', chip: 'STREAM', dur: '4:47:02', x: 716, y: 1060, r: 8 },
].map((c, i) => {
  const e = el('div', 'vcard', `left:${c.x}px;top:${c.y}px;width:${i === 3 ? 300 : 330}px`);
  e.innerHTML = `<div class="img" style="background-image:url(../assets/${c.img}.jpg)"><div class="chip">${c.chip}</div><div class="dur">${c.dur}</div></div><div class="meta">long video<span></span></div>`;
  $('#hook').appendChild(e); e._r = c.r; e._i = i;
  return e;
});

/* ---------- build: step 2 waveform + transcript ---------- */
const MOMENTS = [0.06, 0.155, 0.30, 0.43, 0.57, 0.735, 0.771, 0.786, 0.90];
const wave = $('#p2wave');
const WR = rng(5);
const WBARS = 112;
for (let i = 0; i < WBARS; i++) {
  const x = i / WBARS;
  let h = 18 + WR() * 34;
  for (const m of MOMENTS) h += 46 * Math.exp(-Math.pow((x - m) / 0.018, 2));
  sv('rect', { x: i * 8, y: 100 - Math.min(96, h) / 2 - 20 + 20, width: 5, height: Math.min(96, h), rx: 2.5, fill: '#2a3347', class: 'wb' }, wave);
}
const scanTint = sv('rect', { x: 0, y: 0, width: 0, height: 130, fill: 'rgba(79,134,255,.10)' }, wave);
const pins = MOMENTS.map(m => { const g = sv('g', { transform: `translate(${m * 892} 6)`, opacity: 0 }, wave); sv('path', { d: 'M-11 0 L11 0 L0 16 Z', fill: '#4f86ff' }, g); sv('line', { x1: 0, y1: 16, x2: 0, y2: 120, stroke: '#4f86ff', 'stroke-width': 2, 'stroke-dasharray': '4 4' }, g); return g; });
const playhead = sv('line', { x1: 0, y1: 0, x2: 0, y2: 130, stroke: '#fff', 'stroke-width': 4 }, wave);
const TLINES = [
  ['00:14'], ['04:40', 'Good posture, good what?', 'PUNCHLINE'], ['09:52'], ['15:31'],
  ['22:03', 'Let’s set up a fight for you', 'BANTER'], ['23:08', 'Denied a visa to India three times', 'PAYOFF'],
  ['23:34', 'You get me an India visa, I get you one', 'PUNCHLINE'], ['27:45'],
];
const tl_rows = $('#p2lines');
const tinner = el('div', '', 'position:absolute;left:0;right:0;top:0');
tl_rows.appendChild(tinner);
const TROWS = TLINES.map((l, i) => {
  const r = el('div', '', `position:absolute;left:0;right:0;top:${i * 62}px;height:54px;border-radius:12px;display:flex;align-items:center;gap:20px;padding:0 16px;border:2px solid transparent`);
  r.innerHTML = `<span class="mono" style="font-size:20px;color:#5f697d;width:72px">${l[0]}</span>` +
    (l[1] ? `<span style="font:600 25px var(--sans);color:#dfe4ee;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l[1]}</span><span class="tg mono" style="font-size:16px;font-weight:700;letter-spacing:.1em;background:var(--accent);color:#fff;padding:4px 10px;border-radius:7px;opacity:0">${l[2]}</span>`
      : `<span style="flex:1;display:flex;gap:10px"><i style="height:14px;border-radius:7px;background:#1f2636;width:${120 + (i * 53) % 140}px"></i><i style="height:14px;border-radius:7px;background:#1f2636;width:${90 + (i * 71) % 120}px"></i><i style="height:14px;border-radius:7px;background:#1f2636;width:${60 + (i * 37) % 90}px"></i></span>`);
  tinner.appendChild(r); r._real = !!l[1]; r._tag = r.querySelector('.tg');
  return r;
});

/* ---------- build: step 3 chart + rank rows ---------- */
const chart = $('#p3chart');
const CW = 920, CH = 300, PADB = 26;
const ys = s => CH - PADB - (s / 100) * (CH - PADB - 18);
const SP = [[0.06, 58], [0.155, 76], [0.30, 63], [0.43, 60], [0.57, 66], [0.735, 74], [0.771, 75], [0.786, 71], [0.90, 62]];
const CR = rng(23);
let pts = [];
for (let i = 0; i <= 200; i++) {
  const x = i / 200;
  let v = 30 + 6 * Math.sin(i * 0.37) + 5 * (CR() - 0.5) * 2;
  for (const [c, s] of SP) v += (s - 30) * Math.exp(-Math.pow((x - c) / 0.011, 2));
  pts.push([x * CW, ys(v)]);
}
const lineD = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L');
const defs = sv('defs', {}, chart);
defs.innerHTML = `<linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f86ff" stop-opacity=".45"/><stop offset="1" stop-color="#4f86ff" stop-opacity="0"/></linearGradient><clipPath id="cclip"><rect id="cclipr" x="0" y="0" width="0" height="${CH}"/></clipPath>`;
sv('line', { x1: 0, x2: CW, y1: ys(40), y2: ys(40), stroke: '#55607a', 'stroke-width': 2, 'stroke-dasharray': '8 8' }, chart);
const typ = sv('text', { x: 6, y: ys(40) - 12, fill: '#6f7a8f', 'font-family': 'JetBrains Mono', 'font-size': 18, 'letter-spacing': 2 }, chart); typ.textContent = 'TYPICAL MOMENT';
const cg = sv('g', { 'clip-path': 'url(#cclip)' }, chart);
sv('path', { d: lineD + ` L${CW} ${CH - PADB} L0 ${CH - PADB} Z`, fill: 'url(#ag)' }, cg);
sv('path', { d: lineD, fill: 'none', stroke: '#7fa6ff', 'stroke-width': 5, 'stroke-linejoin': 'round' }, cg);
const topX = 0.155 * CW, topY = ys(76);
const cutG = sv('g', { opacity: 0 }, chart);
sv('line', { x1: topX, x2: topX, y1: topY, y2: CH - PADB, stroke: '#ff3d57', 'stroke-width': 3, 'stroke-dasharray': '6 6' }, cutG);
const cutTag = sv('g', { transform: `translate(${topX + 16} ${topY - 6})` }, cutG);
sv('rect', { x: 0, y: -22, width: 104, height: 38, rx: 8, fill: '#ff3d57' }, cutTag);
const ct = sv('text', { x: 52, y: 4, 'text-anchor': 'middle', fill: '#fff', 'font-family': 'Inter', 'font-weight': 800, 'font-size': 21 }, cutTag); ct.textContent = '✂ CUT';
const dot = sv('circle', { cx: topX, cy: topY, r: 11, fill: '#fff', stroke: '#4f86ff', 'stroke-width': 5, opacity: 0 }, chart);
const xl = sv('text', { x: 0, y: CH - 2, fill: '#5f697d', 'font-family': 'JetBrains Mono', 'font-size': 16 }, chart); xl.textContent = '0:00';
const xr = sv('text', { x: CW, y: CH - 2, 'text-anchor': 'end', fill: '#5f697d', 'font-family': 'JetBrains Mono', 'font-size': 16 }, chart); xr.textContent = 'END';

const ROWY = k => 1036 + k * 94;
const INIT_SLOT = [2, 3, 1, 0]; // clip index -> initial slot (shuffled)
const RROWS = CLIPS.map((c, i) => {
  const r = el('div', '', `position:absolute;left:0;width:980px;height:84px;top:${ROWY(INIT_SLOT[i])}px;border-radius:18px;border:2px solid ${c.top ? 'rgba(79,134,255,.6)' : '#243047'};background:rgba(12,15,22,.96);display:flex;align-items:center;gap:20px;padding:0 18px;opacity:0;box-shadow:0 14px 30px rgba(0,0,0,.45)`);
  r.innerHTML = `<div class="score">${c.s}</div><div style="width:112px;height:63px;border-radius:10px;background:url(${c.img}) center/cover;flex:none"></div>
    <div style="flex:1;min-width:0"><div style="font:700 25px var(--sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.name}</div><div style="font:500 18px var(--sans);color:#7d879b;margin-top:4px">${c.why}</div></div>
    ${c.top ? '<span class="pill top">Top clip</span>' : ''}`;
  $('#p3rows').appendChild(r);
  return r;
});

/* ---------- build: step 4 phone ---------- */
const phone = clipEl({ img: CLIPS[0].img, title: CLIPS[0].title, cap: CLIPS[0].cap, w: 444, h: 790, radius: 44 });
phone.style.border = '3px solid #2f3a52';
phone.style.boxShadow = '0 40px 90px rgba(0,0,0,.7), 0 0 50px rgba(79,134,255,.18)';
$('#p4phone').appendChild(phone);
const phTtl = phone.querySelector('.ttl'), phWm = phone.querySelector('.wm'), phCap = phone._cap, phBg = phone.querySelector('.bg');

/* ---------- build: payoff grid ---------- */
const GRID = CLIPS.map((c, i) => {
  const wrap = el('div', '', `position:absolute;left:${i * 240}px;top:0;width:224px;opacity:0`);
  const ce = clipEl({ img: c.img, title: c.title, cap: c.cap, w: 224, h: 398, radius: 18 });
  ce.style.position = 'relative'; ce.style.border = '1.5px solid #2a3346';
  wrap.appendChild(ce);
  wrap.appendChild(el('div', '', 'margin-top:14px;font:700 20px var(--sans);line-height:1.25;height:50px;overflow:hidden', c.name));
  wrap.appendChild(el('div', '', 'margin-top:6px;font:500 16px var(--sans);color:#8a93a6', 'From ' + c.from));
  wrap.appendChild(el('div', '', 'margin-top:12px;display:flex;align-items:center;gap:10px',
    `<div class="score" style="width:46px;height:46px;font-size:19px">${c.s}</div><span style="font:500 15px var(--sans);color:#aab2c2">Virality score</span>${c.top ? '<span class="pill top" style="font-size:13px;padding:2px 8px">Top clip</span>' : ''}`));
  wrap.appendChild(el('div', '', 'margin-top:10px;font:500 14px var(--sans);color:#7d879b;line-height:1.3', c.why));
  $('#p5grid').appendChild(wrap);
  return wrap;
});
$('#p5grid').appendChild(el('div', 'mono', 'position:absolute;left:0;right:0;top:672px;text-align:center;font-size:20px;letter-spacing:.2em;color:#5f697d', '+ 5 MORE CLIPS BELOW'));

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
  else c.t1 = next ? Math.min(lineEnd + 0.45, next.t0 - 0.02) : DUR;
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
const from = (t, target, fromVars, toVars) => tl.fromTo(target, fromVars, { duration: 0.35, ...toVars }, t);
const slam = (t, sel) => {
  from(t, sel, { opacity: 0, scale: 1.7, filter: 'blur(14px)' }, { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.28, ease: 'power4.out' });
  from(t + 0.05, '#flash', { opacity: 0.55 }, { opacity: 0, duration: 0.45, ease: 'power2.out' });
};
const panelIn = (t, sel, dy = 90) => { from(t, sel, { opacity: 0, y: dy, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 0.42, ease: 'back.out(1.4)' }); cue('swoosh', t); };
const panelOut = (t, sel) => at(t, sel, { opacity: 0, y: -70, scale: 0.96, filter: 'blur(6px)', duration: 0.26, ease: 'power2.in' });
const camTo = (t, v, dur = 0.7, e = 'power3.inOut') => { tl.to(cam, { ...v, duration: dur, ease: e }, t); cue('whoosh', t); };

/* HOOK */
const tH = 0.05;
HOOK.forEach((c, i) => from(tH + 0.08 * i, c, { opacity: 0, scale: 0.6, rotate: c._r * 3, y: 60 }, { opacity: 1, scale: 1, rotate: c._r, y: 0, duration: 0.5, ease: 'back.out(1.6)' }));
HOOK.forEach((c, i) => cue('pop', tH + 0.08 * i, { g: 0.5 }));
slam(0.12, '#bigFirst'); cue('boom', 0.12, { g: 0.7 });
from(0.4, '#hookPlay', { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' });
tl.to(cam, { rot: -4, x: '+=80', y: '-=160', duration: 2.4, ease: 'none' }, 0);
const tClip = wt('hook', 'clipping');
at(tClip, '#hookPlay', { scale: 1.25, duration: 0.12, ease: 'power2.out' });
at(tClip + 0.12, '#hookPlay', { scale: 1, duration: 0.2 });
cue('tick', tClip);

/* FAIL */
const tF = LS('fail') - 0.08;
HOOK.forEach((c, i) => at(tF + 0.02 * i, c, { opacity: 0, x: (c._i % 2 ? 1 : -1) * 420, rotate: c._r * 4, filter: 'blur(8px)', duration: 0.35, ease: 'power2.in' }));
at(tF, '#bigFirst', { opacity: 0, scale: 0.8, filter: 'blur(10px)', duration: 0.25, ease: 'power2.in' });
at(tF, '#hookPlay', { opacity: 0, scale: 0.5, duration: 0.2 });
camTo(tF, { x: sx + 160, y: sy - 520, zoom: 0.95, rot: 6, tilt: 26 }, 0.8);
panelIn(tF + 0.15, '#p0');
const tScrub = wt('fail', 'scrub'), tHour = wt('fail', 'hour'), tTab = wt('fail', 'tab');
cue('scrub', tScrub, { dur: tTab - tScrub });
from(tTab, '#tabClosed', { opacity: 0, scale: 2.2, rotate: -20 }, { opacity: 1, scale: 1, rotate: -8, duration: 0.18, ease: 'power4.in' });
cue('stamp', tTab + 0.16);
const tFail = LE('fail') + 0.1;
at(tFail, '#p0', { scaleY: 0.01, scaleX: 1.04, opacity: 0, duration: 0.2, ease: 'power3.in' });
at(tFail, '#tabClosed', { opacity: 0, scale: 0.6, duration: 0.2, ease: 'power3.in' });
slam(tFail + 0.18, '#bigFail'); cue('fail', tFail + 0.18);
from(tFail + 0.18, '#tint', { opacity: 0 }, { opacity: 1, duration: 0.15 });
tl.to(failPath, { attr: { opacity: 1 }, duration: 0.01 }, tFail + 0.25);
from(tFail + 0.25, failPath, { attr: { 'stroke-dashoffset': 900 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.6, ease: 'power2.out' });
from(tFail + 0.7, failX, { attr: { opacity: 0 } }, { attr: { opacity: 1 }, duration: 0.12 });

/* ROUTE */
const tR = LS('route') - 0.18;
at(tR, '#bigFail', { opacity: 0, skewX: -25, x: -140, filter: 'blur(12px)', duration: 0.3, ease: 'power3.in' });
at(tR, '#tint', { opacity: 0, duration: 0.4 });
at(tR, [failPath, failX], { attr: { opacity: 0 }, duration: 0.3 });
camTo(tR, overview, 0.95);
cue('drop', tR + 0.2);
at(tR + 0.3, dashed, { attr: { opacity: 1 }, duration: 0.2 });
tl.to(maskPath, { attr: { 'stroke-dashoffset': 0 }, duration: 1.25, ease: 'power2.inOut' }, tR + 0.35);
cue('scan', tR + 0.35, { dur: 1.2, p: 1.2, g: 0.6 });
from(tR + 0.2, '#mission', { opacity: 0, y: -40 }, { opacity: 1, y: 0, duration: 0.45 });
from(tR + 0.35, NODES.start.inner, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)', svgOrigin: '0 0' });
cue('pop', tR + 0.35);
const tMy = wt('route', 'my');
from(tMy, NODES.start.halo, { attr: { opacity: 1, r: 40 } }, { attr: { opacity: 0, r: 110 }, duration: 0.8, ease: 'power2.out' });
tl.to(rp, { v: 120, duration: 0.6 }, tMy);
const tFour = wt('route', 'four');
[1, 2, 3, 4, 'done'].forEach((n, i) => {
  from(tFour - 0.05 + i * 0.1, NODES[n].inner, { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2.2)', svgOrigin: '0 0' });
  cue('tick', tFour - 0.05 + i * 0.1, { g: 0.7, p: 1 + i * 0.12 });
});

/* STEPS: camera + route progress */
const STEPS = [
  { id: 's1', n: 1, rot: -6 }, { id: 's2', n: 2, rot: 5 }, { id: 's3', n: 3, rot: -5 }, { id: 's4', n: 4, rot: 5 },
];
STEPS.forEach(s => {
  const t = LS(s.id) - 0.06;
  camTo(t, stepView(s.n, s.rot), 0.75);
  tl.to(rp, { v: nodeLen(s.n), duration: 0.75, ease: 'power2.inOut' }, t);
  cue('ding', t + 0.72, { p: 1 + s.n * 0.06 });
  from(t + 0.7, NODES[s.n].halo, { attr: { opacity: 1, r: 40 } }, { attr: { opacity: 0, r: 120 }, duration: 0.8, ease: 'power2.out' });
});

/* S1 — paste the link */
const t1 = LS('s1');
panelIn(t1 + 0.18, '#p1');
const tPaste = wt('s1', 'paste'), tLink = wt('s1', 'link');
const URL = 'youtube.com/watch?v=n3on-mma';
const typeA = tPaste + 0.05, typeB = tLink + 0.2;
for (let i = 0; i < URL.length; i += 2) cue('type', lerp(typeA, typeB, i / URL.length), { g: 0.35 });
from(typeB + 0.05, '#p1prev', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 });
const tBtn = LE('s1') + 0.05;
at(tBtn, '#p1btn', { scale: 0.92, duration: 0.08, ease: 'power2.in' });
at(tBtn + 0.08, '#p1btn', { scale: 1, duration: 0.2, ease: 'back.out(3)' });
cue('click', tBtn + 0.06);
from(tBtn + 0.14, '#p1proc', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.25 });
panelOut(LS('s2') - 0.1, '#p1');

/* S2 — watch + read */
const t2 = LS('s2');
panelIn(t2 + 0.18, '#p2');
const scanA = wt('s2', 'watches') - 0.1, scanB = wt('s2', 'and') + 0.15;
cue('scan', scanA, { dur: scanB - scanA });
MOMENTS.forEach((m, i) => { const tt = lerp(scanA, scanB, m); from(tt, pins[i], { attr: { opacity: 0 } }, { attr: { opacity: 1 }, duration: 0.08 }); cue('tick', tt, { g: 0.5, p: 1.3 + i * 0.05 }); });
const readA = wt('s2', 'reads') - 0.1, readB = LE('s2') + 0.05;
tl.to(tinner, { y: -2 * 62, duration: readB - (scanA + 0.2), ease: 'none' }, scanA + 0.2);
TROWS.forEach((r, i) => {
  const tt = lerp(readA - 0.6, readB, i / (TROWS.length - 1));
  if (r._real) {
    tl.to(r, { borderColor: 'rgba(79,134,255,.8)', backgroundColor: 'rgba(79,134,255,.13)', duration: 0.15 }, tt);
    from(tt + 0.05, r._tag, { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2)' });
    cue('pop', tt + 0.05, { g: 0.45 });
  } else {
    tl.fromTo(r, { backgroundColor: 'rgba(255,255,255,0.06)' }, { backgroundColor: 'rgba(255,255,255,0)', duration: 0.35 }, tt);
  }
});
panelOut(LS('s3') - 0.1, '#p2');

/* S3 — virality score + best first */
const t3 = LS('s3');
panelIn(t3 + 0.18, '#p3');
const drawA = wt('s3', 'every') - 0.05, drawB = wt('s3', 'score') + 0.1;
tl.fromTo('#cclipr', { attr: { width: 0 } }, { attr: { width: CW }, duration: drawB - drawA, ease: 'none' }, drawA);
cue('scan', drawA, { dur: drawB - drawA, p: 1.4 });
const tTop = lerp(drawA, drawB, 0.155);
from(tTop, dot, { attr: { opacity: 0, r: 2 } }, { attr: { opacity: 1, r: 11 }, duration: 0.2 });
const tVir = wt('s3', 'virality');
from(tVir, cutG, { attr: { opacity: 0 } }, { attr: { opacity: 1 }, duration: 0.12 });
from(tVir, cutTag, { scale: 0.3 }, { scale: 1, duration: 0.3, ease: 'back.out(3)', svgOrigin: `${topX + 16} ${topY - 6}` });
cue('stamp', tVir, { g: 0.5 });
cue('count', tVir - 0.1, { dur: 0.6 });
from(wt('s3', 'score') + 0.15, '#p3top', { opacity: 0, scale: 0.5 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(2.5)' });
const tRows = LE('s3') - 0.1;
RROWS.forEach((r, i) => { from(tRows + INIT_SLOT[i] * 0.06, r, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.3 }); cue('pop', tRows + INIT_SLOT[i] * 0.06, { g: 0.35 }); });
const tBest = wt('s3b', 'best');
RROWS.forEach((r, i) => tl.to(r, { top: ROWY(i), duration: 0.5, ease: 'power3.inOut' }, tBest + 0.05));
cue('whoosh', tBest + 0.05, { g: 0.6 });
from(wt('s3b', 'first'), '#p3sortlbl', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.25 });
tl.fromTo(RROWS[0], { boxShadow: '0 0 0 rgba(79,134,255,0)' }, { boxShadow: '0 0 40px rgba(79,134,255,.55)', duration: 0.3 }, wt('s3b', 'first'));
cue('ding', wt('s3b', 'first'), { p: 1.5 });
const t3out = LS('s4') - 0.1;
panelOut(t3out, '#p3');
at(t3out, [...RROWS, '#p3sortlbl'], { opacity: 0, y: -40, duration: 0.25, ease: 'power2.in' });

/* S4 — cut vertical, captions, ready */
const t4 = LS('s4');
panelIn(t4 + 0.18, '#p4raw', 60);
from(t4 + 0.3, '#p4checks', { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.3 });
const tCut = wt('s4', 'cut'), tVert = wt('s4', 'vertical'), tCap = wt('s4', 'captions'), tPost = wt('s4', 'post');
from(tCut - 0.1, '#p4arrow', { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 0.25 });
// phone starts as a 16:9 strip and opens to 9:16
const stripTop = 0.27 * 790, stripH = 444 / 1.86;
tl.set('#p4phone', { opacity: 1 }, tCut);
from(tCut, phone, { clipPath: `inset(${stripTop}px 0px ${790 - stripTop - stripH}px 0px round 18px)`, x: -60, scale: 0.9 },
  { clipPath: `inset(${stripTop}px 0px ${790 - stripTop - stripH}px 0px round 18px)`, x: 0, scale: 1, duration: 0.3 });
tl.to(phone, { clipPath: 'inset(0px 0px 0px 0px round 44px)', duration: 0.45, ease: 'power3.inOut' }, tVert);
cue('whoosh', tVert, { g: 0.6, p: 1.3 });
from(tVert, [phBg], { opacity: 0 }, { opacity: 1, duration: 0.4 });
from(tVert + 0.2, [phWm, phTtl], { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.3 });
from(tCap, phCap, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.25, ease: 'back.out(2.5)' });
from(tPost, '#p4ready', { opacity: 0, y: 30, scale: 0.7 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, ease: 'back.out(2.5)' });
[[tVert, '#chk1'], [tCap, '#chk2'], [tPost, '#chk3']].forEach(([t, s]) => cue('check', t));
const t4out = LS('pay') - 0.1;
at(t4out, ['#p4raw', '#p4arrow', '#p4checks', '#p4phone', '#p4ready'], { opacity: 0, y: -60, filter: 'blur(6px)', duration: 0.26, ease: 'power2.in' });

/* PAYOFF — Your 9 clips */
const t5 = LS('pay') - 0.06;
camTo(t5, (() => { const [x, y] = nodePos('done'); return { x, y: y - 330 / 0.92, zoom: 0.92, rot: -4, tilt: 22 }; })(), 0.75);
tl.to(rp, { v: ROUTE_LEN, duration: 0.75, ease: 'power2.inOut' }, t5);
panelIn(t5 + 0.12, '#p5');
const tNine = wt('pay', 'nine');
GRID.forEach((g, i) => { from(tNine + 0.05 + i * 0.09, g, { opacity: 0, y: 50, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.6)' }); cue('pop', tNine + 0.05 + i * 0.09, { g: 0.45, p: 1 + i * 0.08 }); });
cue('count', tNine - 0.25, { dur: 0.3 });
const tNever = wt('pay', 'never'), tEd = wt('pay', 'editor');
from(tNever - 0.3, '#cursor', { opacity: 0, x: 700, y: 1250 }, { opacity: 1, x: 880, y: 495, duration: 0.65, ease: 'power3.inOut' });
const tDl = tEd - 0.1;
at(tDl, '#p5dl', { scale: 0.92, duration: 0.08, ease: 'power2.in' });
at(tDl + 0.08, '#p5dl', { scale: 1, duration: 0.2, ease: 'back.out(3)' });
at(tDl, '#cursor', { scale: 0.85, duration: 0.08 }); at(tDl + 0.08, '#cursor', { scale: 1, duration: 0.15 });
cue('click', tDl + 0.04);
from(tDl + 0.15, '#p5toast', { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.25 });
from(tEd + 0.1, '#p5stamp', { opacity: 0, scale: 2, rotate: -14 }, { opacity: 1, scale: 1, rotate: -4, duration: 0.2, ease: 'power4.in' });
cue('stamp', tEd + 0.28, { g: 0.8 });

/* PASS */
const tP = LS('pass') - 0.12;
at(tP - 0.32, ['#p5', '#cursor', '#p5stamp'], { opacity: 0, scale: 0.85, filter: 'blur(8px)', duration: 0.28, ease: 'power2.in' });
camTo(tP - 0.28, { ...overview, zoom: 0.52, rot: -3 }, 0.9);
slam(tP - 0.1, '#bigPass'); cue('pass', tP - 0.1);
from(tP + 0.05, NODES.done.halo, { attr: { opacity: 1, r: 40 } }, { attr: { opacity: 0, r: 150 }, duration: 1, ease: 'power2.out' });
tl.to(cam, { zoom: 0.5, rot: 0, duration: DUR - tP - 1, ease: 'none' }, tP + 0.9);

/* CTA */
const tC = LS('cta') - 0.15;
at(tC, '#bigPass', { y: -330, scale: 0.78, duration: 0.5, ease: 'power3.inOut' });
panelIn(tC + 0.1, '#cta', 120);
const tFree = wt('cta', 'free');
from(tFree, '#ctaFree', { scale: 0.4 }, { scale: 1, duration: 0.3, ease: 'back.out(3)' });
cue('pop', tFree, { p: 1.4 });
const tUrl = wt('cta', 'onyxclip');
tl.fromTo('#ctaLink', { boxShadow: '0 0 30px rgba(79,134,255,.3)', scale: 1 }, { boxShadow: '0 0 70px rgba(79,134,255,.8)', scale: 1.04, duration: 0.2 }, tUrl);
at(tUrl + 0.2, '#ctaLink', { scale: 1, duration: 0.3 });
cue('ding', tUrl, { p: 1.8 });
from(tUrl + 0.3, '#ctaBio', { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3 });
tl.to('#stage', { opacity: 0.0, duration: 0.35, ease: 'power1.in' }, DUR - 0.35);
tl.set({}, {}, DUR);

/* ===================== per-frame derived state ===================== */
const stepTimes = STEPS.map(s => LS(s.id) - 0.06 + 0.4);
const p0img = $('#p0img'), p0fill = $('#p0fill'), p0head = $('#p0head'), p0time = $('#p0time');
const FEET = ['foot1', 'foot2', 'foot3', 'foot4'].map(f => `url(../assets/${f}.jpg)`);
function hms(s) { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}`; }

function update(t) {
  applyCam();
  // route draw
  solids.forEach(p => p.setAttribute('stroke-dashoffset', ROUTE_LEN - rp.v));
  for (const [k, n] of Object.entries(NODES)) {
    const reached = k !== 'start' && rp.v >= n.len - 2 && t > LS('route') + 1;
    n.disc.setAttribute('fill', reached ? '#4f86ff' : '#0b0f17');
    n.check.setAttribute('opacity', reached && k !== 'done' ? 1 : 0);
    n.txt.setAttribute('opacity', reached && k !== 'done' ? 0 : 1);
    if (k === 'done') n.txt.setAttribute('fill', reached ? '#fff' : '#9dbbff');
  }
  // HUD
  $('#progress').style.width = (100 * t / DUR) + '%';
  let step = 0; stepTimes.forEach((st, i) => { if (t >= st) step = i + 1; });
  const done = t >= LS('pass') - 0.05;
  $('#stepk').textContent = done ? 'COMPLETE' : 'STEP';
  $('#stepn').textContent = (done ? 4 : step) + '/4';
  document.querySelectorAll('#mission .dashes span').forEach((s, i) => s.classList.toggle('on', i < (done ? 4 : step)));
  // hook bob
  HOOK.forEach((c, i) => { c.style.translate = `0 ${Math.sin(t * 2.1 + i * 1.7) * 10}px`; });
  // scrubbing player
  const sA = LS('fail'), sB = wt('fail', 'tab');
  const sp = clamp((t - sA) / (sB - sA));
  const ph = clamp(0.45 + 0.32 * Math.sin(t * 5.3) + 0.14 * Math.sin(t * 13.1 + 1), 0.02, 0.98);
  p0fill.style.width = (900 * ph) + 'px'; p0head.style.left = (30 + 900 * ph - 12) + 'px';
  p0img.style.backgroundImage = FEET[Math.floor(ph * 3.99)];
  const scrubbed = t < wt('fail', 'scrub') ? 0 : lerp(0, 3707, ease((t - wt('fail', 'scrub')) / (wt('fail', 'hour', true) - wt('fail', 'scrub') + 0.3)));
  p0time.textContent = hms(scrubbed);
  // typing
  const typed = Math.round(URL.length * clamp((t - typeA) / (typeB - typeA)));
  $('#p1url').textContent = URL.slice(0, typed);
  $('#p1ph').style.display = typed ? 'none' : '';
  $('#p1caret').style.opacity = (t > typeB + 0.3) ? 0 : (Math.floor(t * 4) % 2 || typed < URL.length ? 1 : 0);
  // scan
  const scanP = clamp((t - scanA) / (scanB - scanA));
  playhead.setAttribute('x1', scanP * 892); playhead.setAttribute('x2', scanP * 892);
  scanTint.setAttribute('width', scanP * 892);
  wave.querySelectorAll('.wb').forEach((b, i) => b.setAttribute('fill', i / WBARS < scanP ? '#5d7fd0' : '#2a3347'));
  $('#p2pct').textContent = Math.round(scanP * 100);
  $('#p2count').textContent = MOMENTS.filter(m => scanP >= m).length;
  // score count
  const sc = Math.round(76 * ease((t - (tVir - 0.1)) / 0.6));
  $('#p3score').textContent = t < tVir - 0.1 ? 0 : sc;
  // checks
  [[tVert, '#chk1'], [tCap, '#chk2'], [tPost, '#chk3']].forEach(([tt, s]) => $(s).classList.toggle('on', t >= tt));
  // nine count
  $('#p5n').textContent = t < tNine - 0.25 ? 0 : Math.round(9 * ease((t - tNine + 0.25) / 0.3));
  // shake on fail
  const fs = t - (tFail + 0.18);
  const shake = fs > 0 && fs < 0.45 ? (1 - fs / 0.45) * 16 : 0;
  const ps = t - (tP - 0.1);
  const shake2 = ps > 0 && ps < 0.3 ? (1 - ps / 0.3) * 8 : 0;
  const sh = shake + shake2;
  $('#stage').style.translate = sh ? `${Math.sin(t * 97) * sh}px ${Math.cos(t * 83) * sh}px` : '0 0';
  // grain
  const f = Math.round(t * 30);
  $('#grain').style.transform = `translate(${(f * 37) % 50 - 25}px, ${(f * 53) % 50 - 25}px)`;
  // captions
  CHUNKS.forEach(c => {
    const vis = t >= c.t0 && t < c.t1;
    if (!vis) { c.el.style.opacity = 0; return; }
    const a = clamp((t - c.t0) / 0.08);
    c.el.style.opacity = a;
    c.el.style.transform = `translateY(${(1 - a) * 16}px)`;
    c.ws.forEach((w, i) => {
      const on = t >= w.t0;
      const s = c.wel[i];
      s.classList.toggle('on', on);
      const dt = t - w.t0;
      const bump = on ? Math.exp(-dt / 0.07) * (w.k ? 0.16 : 0.06) : 0;
      s.style.transform = `scale(${1 + bump})`;
    });
  });
}

window.__seek = t => { tl.seek(Math.min(t, DUR - 0.0001), false); update(t); };
window.__duration = DUR;
window.__cues = CUES.sort((a, b) => a.t - b.t);
Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => { }))]).then(async () => {
  const imgs = ['foot1', 'foot2', 'foot3', 'foot4'].map(f => { const i = new Image(); i.src = `../assets/${f}.jpg`; return i.decode(); });
  await Promise.all(imgs);
  await document.fonts.load('italic 900 100px InterX');
  await document.fonts.load('800 50px Archivo');
  window.__seek(0);
  window.__ready = true;
});

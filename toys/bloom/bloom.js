import '../../src/styles/base.css';
import './bloom.css';
import { createCanvas } from '../../src/lib/canvas.js';
import { createPointer } from '../../src/lib/pointer.js';
import { detectDevice } from '../../src/lib/device.js';

// "Click-to-bloom": each tap drops a blooming flower or an expanding ripple.
// Blooms animate on a live layer; when one finishes growing it is baked into an
// offscreen composition canvas, so taps accumulate into a lasting, layered
// painting rather than fading away. Drag to paint a ribbon of blooms, hold to
// pile them up.

const device = detectDevice();

const canvas = document.getElementById('c');
const pointer = createPointer(canvas);

// ---- composition layer (the painting that builds up) ----
let comp, compCtx;

function buildComp(view) {
  comp = document.createElement('canvas');
  comp.width = canvas.width; // device px (set by the resize helper)
  comp.height = canvas.height;
  compCtx = comp.getContext('2d');
  compCtx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0); // draw in CSS px
  compCtx.fillStyle = '#0a0014';
  compCtx.fillRect(0, 0, view.W, view.H);
}

const view = createCanvas(canvas, { onResize: buildComp });
const ctx = view.ctx;

// ---- bloom pool (no per-frame allocation) ----
const POOL = 320;
const bx = new Float32Array(POOL);
const by = new Float32Array(POOL);
const bage = new Float32Array(POOL);
const blife = new Float32Array(POOL);
const bmax = new Float32Array(POOL);
const bhue = new Float32Array(POOL);
const brot = new Float32Array(POOL);
const bspin = new Float32Array(POOL);
const balpha = new Float32Array(POOL);
const bpetals = new Uint8Array(POOL);
const btype = new Uint8Array(POOL); // 0 flower, 1 ripple

const active = []; // indices currently animating
const free = [];
for (let k = 0; k < POOL; k++) free.push(k);

// ---- controls ----
let sizeScale = 1.0;
let rate = 50;
let compFade = 0; // 0 = keep forever
const SIZE_BASE = device.pick(46, 64);

let baseHue = Math.random() * 360;

function spawnBloom(px, py) {
  let idx;
  if (free.length > 0) {
    idx = free.pop();
  } else {
    // pool full: bake the oldest into the composition and reuse it
    idx = active.shift();
    bake(idx);
  }
  bx[idx] = px;
  by[idx] = py;
  bage[idx] = 0;
  blife[idx] = 30 + Math.random() * 18;
  bmax[idx] = SIZE_BASE * (0.7 + Math.random() * 0.7) * sizeScale;
  bhue[idx] = (baseHue + (Math.random() - 0.5) * 50 + 360) % 360;
  brot[idx] = Math.random() * Math.PI * 2;
  bspin[idx] = (Math.random() - 0.5) * 0.8;
  balpha[idx] = 0.5;
  bpetals[idx] = 5 + ((Math.random() * 4) | 0);
  btype[idx] = Math.random() < 0.62 ? 0 : 1;
  active.push(idx);
}

function drawBloom(c, idx, prog) {
  const ease = 1 - Math.pow(1 - prog, 3); // easeOutCubic
  const R = bmax[idx] * ease;
  const a = balpha[idx];
  c.save();
  c.translate(bx[idx], by[idx]);
  c.rotate(brot[idx] + prog * bspin[idx]);
  c.globalCompositeOperation = 'lighter';

  if (btype[idx] === 0) {
    // flower: radiating petals + bright core
    const petals = bpetals[idx];
    for (let p = 0; p < petals; p++) {
      const ang = (p / petals) * Math.PI * 2;
      const hue = (bhue[idx] + p * 4) % 360;
      c.fillStyle = `hsla(${hue}, 100%, 62%, ${a})`;
      c.beginPath();
      c.ellipse(Math.cos(ang) * R * 0.5, Math.sin(ang) * R * 0.5, R * 0.5, R * 0.22, ang, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = `hsla(${bhue[idx]}, 100%, 82%, ${a})`;
    c.beginPath();
    c.arc(0, 0, R * 0.18, 0, Math.PI * 2);
    c.fill();
  } else {
    // ripple: a couple of expanding rings
    c.lineWidth = Math.max(1, R * 0.08);
    c.strokeStyle = `hsla(${bhue[idx]}, 100%, 62%, ${a})`;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = Math.max(1, R * 0.045);
    c.strokeStyle = `hsla(${(bhue[idx] + 40) % 360}, 100%, 72%, ${a * 0.7})`;
    c.beginPath();
    c.arc(0, 0, R * 0.62, 0, Math.PI * 2);
    c.stroke();
  }
  c.restore();
}

function bake(idx) {
  drawBloom(compCtx, idx, 1); // stamp the full bloom into the painting
}

// ---- spawning gestures ----
let lastX = 0;
let lastY = 0;
let sinceSpawn = 0;

function spacingPx() {
  return 60 - (rate / 100) * 50; // higher rate -> denser ribbon
}
function holdInterval() {
  return Math.round(20 - (rate / 100) * 16); // higher rate -> faster fountain
}

// Discrete taps/clicks always register, even very fast ones.
canvas.addEventListener('pointerdown', (e) => {
  spawnBloom(e.clientX, e.clientY);
  lastX = e.clientX;
  lastY = e.clientY;
  sinceSpawn = 0;
});

function spawnDuringInteraction() {
  if (!pointer.active) {
    sinceSpawn = 0;
    return;
  }
  const dx = pointer.x - lastX;
  const dy = pointer.y - lastY;
  if (dx * dx + dy * dy > spacingPx() * spacingPx()) {
    spawnBloom(pointer.x, pointer.y);
    lastX = pointer.x;
    lastY = pointer.y;
    sinceSpawn = 0;
  } else if (++sinceSpawn >= holdInterval()) {
    spawnBloom(pointer.x, pointer.y);
    lastX = pointer.x;
    lastY = pointer.y;
    sinceSpawn = 0;
  }
}

function frame() {
  baseHue = (baseHue + 0.4) % 360;
  spawnDuringInteraction();

  // composite the baked painting, full device-pixel resolution
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(comp, 0, 0);
  ctx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0);

  // update + draw live blooms; bake finished ones
  let w = 0;
  for (let r = 0; r < active.length; r++) {
    const idx = active[r];
    bage[idx] += 1;
    if (bage[idx] >= blife[idx]) {
      bake(idx);
      free.push(idx);
    } else {
      drawBloom(ctx, idx, bage[idx] / blife[idx]);
      active[w++] = idx;
    }
  }
  active.length = w;

  // optional slow fade of the composition so it can stay fresh
  if (compFade > 0) {
    compCtx.globalCompositeOperation = 'source-over';
    compCtx.fillStyle = `rgba(10, 0, 20, ${compFade / 1000})`;
    compCtx.fillRect(0, 0, view.W, view.H);
  }

  requestAnimationFrame(frame);
}
frame();

// ---- HUD ----

const hintEl = document.getElementById('hint');
let hinted = false;
canvas.addEventListener(
  'pointerdown',
  () => {
    if (hinted) return;
    hinted = true;
    setTimeout(() => {
      hintEl.style.opacity = '0';
    }, 2500);
  },
  { once: true }
);

// Touch only: kill the long-press context menu so holding to pile never opens one.
if (device.touchPrimary) {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- controls ----

const sizeEl = document.getElementById('size');
const rateEl = document.getElementById('rate');
const fadeEl = document.getElementById('fade');

sizeEl.addEventListener('input', (e) => {
  sizeScale = parseInt(e.target.value, 10) / 100;
  document.getElementById('vSize').textContent = sizeScale.toFixed(1);
});
rateEl.addEventListener('input', (e) => {
  rate = parseInt(e.target.value, 10);
  document.getElementById('vRate').textContent = String(rate);
});
fadeEl.addEventListener('input', (e) => {
  compFade = parseInt(e.target.value, 10);
  document.getElementById('vFade').textContent = String(compFade);
});

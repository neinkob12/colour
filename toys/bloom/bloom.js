import '../../src/styles/base.css';
import './bloom.css';
import { createCanvas } from '../../src/lib/canvas.js';
import { createPointer } from '../../src/lib/pointer.js';
import { detectDevice } from '../../src/lib/device.js';

// "Click-to-bloom": each tap drops a Flower-of-Life motif (an overlapping-circle
// sacred-geometry lattice). Blooms animate on a live layer; when one finishes
// growing it is baked into an offscreen composition canvas, so taps accumulate
// into a lasting, layered painting. Drag to paint a ribbon of motifs, hold to
// pile them up. The composition can slowly fade over time (fade control).

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

// Flower of Life lattice: triangular-lattice centers within 2 units of the
// origin (the classic 19-circle motif), in units of one circle radius. The
// petal/vesica pattern is formed purely by these overlapping circles; no outer
// bounding circle is ever drawn.
const LOX = [];
const LOY = [];
const LDIST = [];
(() => {
  const h = Math.sqrt(3) / 2;
  for (let j = -3; j <= 3; j++) {
    for (let i = -3; i <= 3; i++) {
      const x = i + j * 0.5;
      const y = j * h;
      if (x * x + y * y <= 4.0001) {
        LOX.push(x);
        LOY.push(y);
        LDIST.push(Math.sqrt(x * x + y * y));
      }
    }
  }
})();

const active = []; // indices currently animating
const free = [];
for (let k = 0; k < POOL; k++) free.push(k);

// ---- controls ----
let sizeScale = 1.0;
let rate = 50;
const SIZE_BASE = device.pick(46, 64);

// Time-based exponential fade so decay is framerate-independent and reads as a
// smooth, slow decay. The slider maps to a half-life (30s slow .. 1.5s quick);
// 0 means never fade.
let fadeK = 0; // decay rate (1/s)
let lastT = performance.now();
function setFade(v) {
  const label = document.getElementById('vFade');
  if (v <= 0) {
    fadeK = 0;
    label.textContent = 'off';
  } else {
    const halfLife = 30 * Math.pow(0.05, (v - 1) / 39);
    fadeK = Math.LN2 / halfLife;
    label.textContent = halfLife.toFixed(1) + 's';
  }
}
setFade(12);

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
  active.push(idx);
}

function drawBloom(c, idx, prog) {
  const ease = 1 - Math.pow(1 - prog, 3); // easeOutCubic
  const r = bmax[idx] * ease * 0.3; // circle radius; the motif spans ~4r
  if (r < 0.4) {
    return;
  }
  const a = balpha[idx];
  c.save();
  c.translate(bx[idx], by[idx]);
  c.rotate(brot[idx] + prog * bspin[idx]);
  c.globalCompositeOperation = 'lighter';
  c.lineWidth = Math.max(1, r * 0.07);

  // Flower of Life: overlapping circles whose vesica overlaps form the petal
  // lattice. Hue drifts outward by ring. No outer bounding circle.
  for (let p = 0; p < LOX.length; p++) {
    const hue = (bhue[idx] + LDIST[p] * 26) % 360;
    c.strokeStyle = `hsla(${hue}, 100%, 64%, ${a})`;
    c.beginPath();
    c.arc(LOX[p] * r, LOY[p] * r, r, 0, Math.PI * 2);
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
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  if (dt > 0.05) dt = 0.05; // clamp big gaps (e.g. returning to a backgrounded tab)

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

  // time-based exponential fade of the composition (framerate-independent)
  if (fadeK > 0) {
    const alpha = 1 - Math.exp(-fadeK * dt);
    compCtx.globalCompositeOperation = 'source-over';
    compCtx.fillStyle = `rgba(10, 0, 20, ${alpha})`;
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
  setFade(parseInt(e.target.value, 10));
});

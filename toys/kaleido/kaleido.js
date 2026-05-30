import '../../src/styles/base.css';
import './kaleido.css';
import { createCanvas } from '../../src/lib/canvas.js';
import { createPointer } from '../../src/lib/pointer.js';
import { detectDevice } from '../../src/lib/device.js';

// "Kaleidoscope mirror": the user draws into an accumulation buffer held in a
// static frame. Every drawn segment is replicated across N rotational sectors
// and their mirror reflections (dihedral symmetry). Each frame the whole buffer
// is drawn rotated by a slowly advancing angle, so the pattern spins. Pointer
// input is mapped back through the current rotation so strokes land under the
// finger. Trails fade slowly so the pattern keeps evolving.

const device = detectDevice();

const canvas = document.getElementById('c');
const pointer = createPointer(canvas);

const LW = device.pick(2.5, 3.5); // brush width

// ---- accumulation buffer (the static-frame drawing) ----
let acc, accCtx;

function buildAcc(view) {
  acc = document.createElement('canvas');
  acc.width = canvas.width; // device px
  acc.height = canvas.height;
  accCtx = acc.getContext('2d');
  accCtx.setTransform(view.DPR, 0, 0, view.DPR, 0, 0); // draw in CSS px
  accCtx.lineCap = 'round';
  accCtx.lineJoin = 'round';
  accCtx.fillStyle = '#0a0014';
  accCtx.fillRect(0, 0, view.W, view.H);
}

const view = createCanvas(canvas, { onResize: buildAcc });
const ctx = view.ctx;

// ---- controls ----
let sym = 6; // mirror count
let spinSpeed = (30 / 100) * 0.012;
let fadeAmt = 8;

let angle = 0; // global rotation
let hue = Math.random() * 360;

// Replicate one segment (coords relative to center) across the symmetry group.
function drawSym(ax, ay, bx, by) {
  const cx = view.W / 2;
  const cy = view.H / 2;
  const step = (Math.PI * 2) / sym;
  hue = (hue + 1.6) % 360;
  accCtx.globalCompositeOperation = 'lighter';
  accCtx.strokeStyle = `hsla(${hue}, 100%, 62%, 0.85)`;
  accCtx.lineWidth = LW;

  for (let k = 0; k < sym; k++) {
    const a = k * step;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // rotation copy and mirror copy (flip y before rotating)
    for (let m = 1; m >= -1; m -= 2) {
      const ya = ay * m;
      const yb = by * m;
      accCtx.beginPath();
      accCtx.moveTo(cx + ax * ca - ya * sa, cy + ax * sa + ya * ca);
      accCtx.lineTo(cx + bx * ca - yb * sa, cy + bx * sa + yb * ca);
      accCtx.stroke();
    }
  }
}

// Map a screen point into the static buffer frame, relative to center.
function toAccRel(sx, sy) {
  const dx = sx - view.W / 2;
  const dy = sy - view.H / 2;
  const c = Math.cos(-angle);
  const s = Math.sin(-angle);
  return [dx * c - dy * s, dx * s + dy * c];
}

let wasDrawing = false;
let lastAx = 0;
let lastAy = 0;

function input() {
  // Draw while the pointer is pressed: mouse button, or a finger on touch.
  const drawing = pointer.isTouch ? pointer.active : pointer.down;
  if (!drawing) {
    wasDrawing = false;
    return;
  }
  const rel = toAccRel(pointer.x, pointer.y);
  if (!wasDrawing) {
    lastAx = rel[0];
    lastAy = rel[1];
    wasDrawing = true;
    drawSym(rel[0], rel[1], rel[0], rel[1]); // a tap leaves a dot
    return;
  }
  drawSym(lastAx, lastAy, rel[0], rel[1]);
  lastAx = rel[0];
  lastAy = rel[1];
}

function frame() {
  input();
  angle += spinSpeed;

  // slow fade of the buffer so the pattern keeps evolving
  if (fadeAmt > 0) {
    accCtx.globalCompositeOperation = 'source-over';
    accCtx.fillStyle = `rgba(10, 0, 20, ${fadeAmt / 2000})`;
    accCtx.fillRect(0, 0, view.W, view.H);
  }

  // display: clear, then draw the buffer rotated about center (device px)
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, cw, ch);
  ctx.save();
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(angle);
  ctx.drawImage(acc, -cw / 2, -ch / 2);
  ctx.restore();

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

if (device.touchPrimary) {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- controls ----

const symEl = document.getElementById('sym');
const spinEl = document.getElementById('spin');
const fadeEl = document.getElementById('fade');

symEl.addEventListener('input', (e) => {
  sym = parseInt(e.target.value, 10);
  document.getElementById('vSym').textContent = String(sym);
});
spinEl.addEventListener('input', (e) => {
  const v = parseInt(e.target.value, 10);
  spinSpeed = (v / 100) * 0.012;
  document.getElementById('vSpin').textContent = String(v);
});
fadeEl.addEventListener('input', (e) => {
  fadeAmt = parseInt(e.target.value, 10);
  document.getElementById('vFade').textContent = String(fadeAmt);
});

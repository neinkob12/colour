import '../../src/styles/base.css';
import './bounce.css';
import { createCanvas } from '../../src/lib/canvas.js';
import { createPointer } from '../../src/lib/pointer.js';
import { detectDevice } from '../../src/lib/device.js';

// "Bouncing color physics": drag to fling a glowing ball. Balls bounce off the
// walls with restitution and collide with one another via real mass-weighted
// elastic impulses, leaving glowing trails (the slowly fading background).

const device = detectDevice();

const canvas = document.getElementById('c');
const view = createCanvas(canvas);
const ctx = view.ctx;

// pressed = dragging to aim: mouse button on desktop, a finger on touch.
const pointer = createPointer(canvas);

const MAX = device.pick(55, 130); // ball cap (dialed down on low-power)
const LAUNCH_SCALE = 0.16;
const MAX_LAUNCH = 32;

// ---- ball arrays ----
const bx = new Float32Array(MAX);
const by = new Float32Array(MAX);
const bvx = new Float32Array(MAX);
const bvy = new Float32Array(MAX);
const br = new Float32Array(MAX);
const bmass = new Float32Array(MAX);
const bhue = new Float32Array(MAX);
let n = 0;

// ---- controls ----
let gravity = 0.24;
let restitution = 0.95;
let trailAlpha = 0.1;

let baseHue = Math.random() * 360;

function launch(px, py, dx, dy) {
  let idx;
  if (n < MAX) {
    idx = n++;
  } else {
    // drop the oldest ball to make room
    bx.copyWithin(0, 1);
    by.copyWithin(0, 1);
    bvx.copyWithin(0, 1);
    bvy.copyWithin(0, 1);
    br.copyWithin(0, 1);
    bmass.copyWithin(0, 1);
    bhue.copyWithin(0, 1);
    idx = MAX - 1;
  }
  let vx = dx * LAUNCH_SCALE;
  let vy = dy * LAUNCH_SCALE;
  const sp = Math.hypot(vx, vy);
  if (sp > MAX_LAUNCH) {
    vx = (vx / sp) * MAX_LAUNCH;
    vy = (vy / sp) * MAX_LAUNCH;
  }
  const r = (device.pick(8, 9) + Math.random() * 9) * device.pick(0.85, 1);
  bx[idx] = px;
  by[idx] = py;
  bvx[idx] = vx;
  bvy[idx] = vy;
  br[idx] = r;
  bmass[idx] = r * r;
  bhue[idx] = baseHue;
}

function physics() {
  const W = view.W;
  const H = view.H;

  for (let i = 0; i < n; i++) {
    bvy[i] += gravity;
    bx[i] += bvx[i];
    by[i] += bvy[i];

    const r = br[i];
    if (bx[i] < r) {
      bx[i] = r;
      bvx[i] = -bvx[i] * restitution;
    } else if (bx[i] > W - r) {
      bx[i] = W - r;
      bvx[i] = -bvx[i] * restitution;
    }
    if (by[i] < r) {
      by[i] = r;
      bvy[i] = -bvy[i] * restitution;
    } else if (by[i] > H - r) {
      by[i] = H - r;
      bvy[i] = -bvy[i] * restitution;
    }
  }

  // ball-ball collisions (a couple of iterations for stability)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = bx[j] - bx[i];
        const dy = by[j] - by[i];
        const minD = br[i] + br[j];
        const d2 = dx * dx + dy * dy;
        if (d2 >= minD * minD || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const m1 = bmass[i];
        const m2 = bmass[j];

        // separate the overlap, mass-weighted
        const overlap = minD - d;
        const t = m1 + m2;
        bx[i] -= nx * overlap * (m2 / t);
        by[i] -= ny * overlap * (m2 / t);
        bx[j] += nx * overlap * (m1 / t);
        by[j] += ny * overlap * (m1 / t);

        // resolve velocity along the normal if approaching
        const rvx = bvx[j] - bvx[i];
        const rvy = bvy[j] - bvy[i];
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const imp = (-(1 + restitution) * vn) / (1 / m1 + 1 / m2);
          const ix = imp * nx;
          const iy = imp * ny;
          bvx[i] -= ix / m1;
          bvy[i] -= iy / m1;
          bvx[j] += ix / m2;
          bvy[j] += iy / m2;
        }
      }
    }
  }
}

// ---- aiming (drag to launch) ----
let aiming = false;
let anchorX = 0;
let anchorY = 0;
let curX = 0;
let curY = 0;

function handleAim() {
  const pressed = pointer.isTouch ? pointer.active : pointer.down;
  if (pressed) {
    if (!aiming) {
      aiming = true;
      anchorX = pointer.x;
      anchorY = pointer.y;
    }
    curX = pointer.x;
    curY = pointer.y;
  } else if (aiming) {
    aiming = false;
    launch(anchorX, anchorY, curX - anchorX, curY - anchorY);
  }
}

function draw() {
  const W = view.W;
  const H = view.H;

  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(10, 0, 20, ${trailAlpha})`;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const h = bhue[i];
    const r = br[i];
    // halo
    ctx.fillStyle = `hsla(${h}, 100%, 55%, 0.12)`;
    ctx.beginPath();
    ctx.arc(bx[i], by[i], r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = `hsla(${h}, 100%, 60%, 0.5)`;
    ctx.beginPath();
    ctx.arc(bx[i], by[i], r, 0, Math.PI * 2);
    ctx.fill();
    // bright core
    ctx.fillStyle = `hsla(${h}, 100%, 86%, 0.6)`;
    ctx.beginPath();
    ctx.arc(bx[i], by[i], r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  // aim guide while dragging
  if (aiming) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `hsla(${baseHue}, 100%, 70%, 0.5)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(anchorX, anchorY);
    ctx.lineTo(curX, curY);
    ctx.stroke();
    ctx.fillStyle = `hsla(${baseHue}, 100%, 70%, 0.5)`;
    ctx.beginPath();
    ctx.arc(anchorX, anchorY, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function loop() {
  baseHue = (baseHue + 0.5) % 360;
  handleAim();
  physics();
  draw();
  requestAnimationFrame(loop);
}
loop();

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

const gravEl = document.getElementById('grav');
const bounceEl = document.getElementById('bounce');
const trailEl = document.getElementById('trail');

gravEl.addEventListener('input', (e) => {
  gravity = (parseInt(e.target.value, 10) / 100) * 0.6;
  document.getElementById('vGrav').textContent = gravity.toFixed(2);
});
bounceEl.addEventListener('input', (e) => {
  restitution = 0.5 + (parseInt(e.target.value, 10) / 100) * 0.5;
  document.getElementById('vBounce').textContent = restitution.toFixed(2);
});
trailEl.addEventListener('input', (e) => {
  trailAlpha = parseInt(e.target.value, 10) / 100;
  document.getElementById('vTrail').textContent = trailAlpha.toFixed(2);
});

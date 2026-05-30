import '../../src/styles/base.css';
import './swarm.css';
import { createCanvas } from '../../src/lib/canvas.js';
import { createPointer } from '../../src/lib/pointer.js';
import { detectDevice } from '../../src/lib/device.js';

const device = detectDevice();

const canvas = document.getElementById('c');
const view = createCanvas(canvas);
const ctx = view.ctx;

// pointer.active = attract (mouse hover / one finger).
// pointer.down   = scatter (mouse button / two-finger hold).
const pointer = createPointer(canvas);

// Dialed-down defaults on phones / low-power devices, not shrunk desktop ones.
const COUNT_DEFAULT = device.pick(900, 2200);
const COUNT_MAX = device.pick(2800, 5000);

// boid array stored as flat typed arrays for speed
let N = COUNT_DEFAULT;
let px, py, vx, vy;

function initBoids(n) {
  N = n;
  px = new Float32Array(N);
  py = new Float32Array(N);
  vx = new Float32Array(N);
  vy = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    px[i] = Math.random() * view.W;
    py[i] = Math.random() * view.H;
    const a = Math.random() * Math.PI * 2;
    const s = 0.5 + Math.random();
    vx[i] = Math.cos(a) * s;
    vy[i] = Math.sin(a) * s;
  }
}
initBoids(N);

// spatial grid for neighbor lookups
const CELL = 60;
const grid = new Map();
function key(cx, cy) {
  return cx * 100000 + cy;
}

let trailAlpha = 0.1;
let chaos = 0.5;
let hueShift = 0;

const MAX_SPEED = 3.4;
const NEIGHBOR = 42;
const NEIGHBOR2 = NEIGHBOR * NEIGHBOR;

function step() {
  const W = view.W;
  const H = view.H;

  // rebuild grid
  grid.clear();
  for (let i = 0; i < N; i++) {
    const cx = Math.floor(px[i] / CELL);
    const cy = Math.floor(py[i] / CELL);
    const k = key(cx, cy);
    let arr = grid.get(k);
    if (!arr) {
      arr = [];
      grid.set(k, arr);
    }
    arr.push(i);
  }

  for (let i = 0; i < N; i++) {
    const x = px[i];
    const y = py[i];
    let ax = 0;
    let ay = 0; // alignment
    let cxs = 0;
    let cys = 0; // cohesion
    let sx = 0;
    let sy = 0; // separation
    let count = 0;

    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);

    for (let ox = -1; ox <= 1; ox++) {
      for (let oy = -1; oy <= 1; oy++) {
        const arr = grid.get(key(gx + ox, gy + oy));
        if (!arr) continue;
        for (let j = 0; j < arr.length; j++) {
          const n = arr[j];
          if (n === i) continue;
          const dx = px[n] - x;
          const dy = py[n] - y;
          const d2 = dx * dx + dy * dy;
          if (d2 < NEIGHBOR2 && d2 > 0.0001) {
            ax += vx[n];
            ay += vy[n];
            cxs += px[n];
            cys += py[n];
            const inv = 1 / d2;
            sx -= dx * inv * 60;
            sy -= dy * inv * 60;
            count++;
          }
        }
      }
    }

    let fx = 0;
    let fy = 0;
    if (count > 0) {
      ax /= count;
      ay /= count;
      const al = Math.hypot(ax, ay) || 1;
      fx += (ax / al) * 0.55;
      fy += (ay / al) * 0.55;

      cxs = cxs / count - x;
      cys = cys / count - y;
      const cl = Math.hypot(cxs, cys) || 1;
      fx += (cxs / cl) * 0.25;
      fy += (cys / cl) * 0.25;

      fx += sx * 0.02;
      fy += sy * 0.02;
    }

    // pointer interaction: attract toward, scatter away
    const mdx = pointer.x - x;
    const mdy = pointer.y - y;
    const md = Math.hypot(mdx, mdy) || 1;
    if (pointer.active) {
      if (pointer.down) {
        if (md < 260) {
          const force = (1 - md / 260) * 4.2;
          fx -= (mdx / md) * force;
          fy -= (mdy / md) * force;
        }
      } else {
        const force = Math.min(1, 220 / md) * 0.9;
        fx += (mdx / md) * force;
        fy += (mdy / md) * force;
      }
    }

    // wander / chaos
    if (chaos > 0) {
      fx += (Math.random() - 0.5) * chaos * 1.6;
      fy += (Math.random() - 0.5) * chaos * 1.6;
    }

    vx[i] += fx * 0.16;
    vy[i] += fy * 0.16;

    const sp = Math.hypot(vx[i], vy[i]);
    if (sp > MAX_SPEED) {
      vx[i] = (vx[i] / sp) * MAX_SPEED;
      vy[i] = (vy[i] / sp) * MAX_SPEED;
    }

    px[i] += vx[i];
    py[i] += vy[i];

    // wrap edges
    if (px[i] < -5) px[i] = W + 5;
    else if (px[i] > W + 5) px[i] = -5;
    if (py[i] < -5) py[i] = H + 5;
    else if (py[i] > H + 5) py[i] = -5;
  }
}

function draw() {
  const W = view.W;
  const H = view.H;

  // fade for trails
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(10, 0, 20, ${trailAlpha})`;
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  hueShift = (hueShift + 0.3) % 360;

  for (let i = 0; i < N; i++) {
    const sp = Math.hypot(vx[i], vy[i]);
    const hue = ((sp / MAX_SPEED) * 200 + hueShift + (px[i] + py[i]) * 0.05) % 360;
    const len = 2 + sp * 2.5;
    const a = Math.atan2(vy[i], vx[i]);
    const tx = px[i] - Math.cos(a) * len;
    const ty = py[i] - Math.sin(a) * len;

    ctx.strokeStyle = `hsla(${hue}, 100%, 62%, 0.9)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(px[i], py[i]);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }
}

function loop() {
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// ---- HUD ----

const hintEl = document.getElementById('hint');
hintEl.textContent = device.touchPrimary
  ? 'one finger follows · two fingers scatter'
  : 'move · hold to scatter';

// fade the hint after the first interaction
let hinted = false;
function fadeHint() {
  if (hinted) return;
  hinted = true;
  setTimeout(() => {
    hintEl.style.opacity = '0';
  }, 2500);
}
canvas.addEventListener('pointermove', fadeHint, { once: true });
canvas.addEventListener('pointerdown', fadeHint, { once: true });

// ---- controls ----

const countEl = document.getElementById('count');
const trailEl = document.getElementById('trail');
const chaosEl = document.getElementById('chaos');

// Apply device-aware count range before wiring up.
countEl.max = String(COUNT_MAX);
countEl.value = String(COUNT_DEFAULT);
document.getElementById('vCount').textContent = String(COUNT_DEFAULT);

countEl.addEventListener('input', (e) => {
  document.getElementById('vCount').textContent = e.target.value;
  initBoids(parseInt(e.target.value, 10));
});
trailEl.addEventListener('input', (e) => {
  trailAlpha = parseInt(e.target.value, 10) / 100;
  document.getElementById('vTrail').textContent = trailAlpha.toFixed(2);
});
chaosEl.addEventListener('input', (e) => {
  chaos = parseInt(e.target.value, 10) / 100;
  document.getElementById('vChaos').textContent = chaos.toFixed(2);
});

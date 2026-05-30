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
// pointer.down   = scatter (mouse button / touch long-press).
const pointer = createPointer(canvas);

// Mobile-only zoom-out: run the sim in a larger virtual world and draw it
// scaled to fit, so more of the flock fits on a small screen. Particle line
// width and streak length stay in screen pixels (see draw), so particles keep
// their size instead of shrinking to specks. ZOOM = 1 on desktop makes every
// expression below identical to the original math.
const ZOOM = device.touchPrimary ? 0.7 : 1;

// Dialed-down defaults on phones / low-power devices, not shrunk desktop ones.
const COUNT_DEFAULT = device.pick(900, 2200);
const COUNT_MAX = device.pick(2800, 5000);

// boid array stored as flat typed arrays for speed. Allocated once at the max
// so the flock count can ease up and down without reallocating.
const CAP = COUNT_MAX;
const px = new Float32Array(CAP);
const py = new Float32Array(CAP);
const vx = new Float32Array(CAP);
const vy = new Float32Array(CAP);

function spawn(i) {
  px[i] = Math.random() * (view.W / ZOOM);
  py[i] = Math.random() * (view.H / ZOOM);
  const a = Math.random() * Math.PI * 2;
  const s = 0.5 + Math.random();
  vx[i] = Math.cos(a) * s;
  vy[i] = Math.sin(a) * s;
}
for (let i = 0; i < CAP; i++) spawn(i);

// Live (eased) values and their slider targets.
let count = COUNT_DEFAULT; // active boids this frame
let countF = COUNT_DEFAULT; // eased float toward targetCount
let targetCount = COUNT_DEFAULT;

let trailAlpha = 0.1;
let targetTrail = 0.1;

let chaos = 0.5;
let targetChaos = 0.5;

const EASE = 0.1; // per-frame lerp toward slider targets

// spatial grid for neighbor lookups
const CELL = 60;
const grid = new Map();
function key(cx, cy) {
  return cx * 100000 + cy;
}

let hueShift = 0;

const MAX_SPEED = 3.4;
const NEIGHBOR = 42;
const NEIGHBOR2 = NEIGHBOR * NEIGHBOR;

function easeControls() {
  trailAlpha += (targetTrail - trailAlpha) * EASE;
  chaos += (targetChaos - chaos) * EASE;

  countF += (targetCount - countF) * EASE;
  // Snap the last fraction so we actually reach the target.
  if (Math.abs(targetCount - countF) < 1) countF = targetCount;
  const nc = Math.round(countF);
  if (nc > count) {
    for (let i = count; i < nc; i++) spawn(i); // fresh boids join gradually
  }
  count = nc;
}

function step() {
  const WW = view.W / ZOOM;
  const HH = view.H / ZOOM;

  // rebuild grid
  grid.clear();
  for (let i = 0; i < count; i++) {
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

  for (let i = 0; i < count; i++) {
    const x = px[i];
    const y = py[i];
    let ax = 0;
    let ay = 0; // alignment
    let cxs = 0;
    let cys = 0; // cohesion
    let sx = 0;
    let sy = 0; // separation
    let neighbors = 0;

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
            neighbors++;
          }
        }
      }
    }

    let fx = 0;
    let fy = 0;
    if (neighbors > 0) {
      ax /= neighbors;
      ay /= neighbors;
      const al = Math.hypot(ax, ay) || 1;
      fx += (ax / al) * 0.55;
      fy += (ay / al) * 0.55;

      cxs = cxs / neighbors - x;
      cys = cys / neighbors - y;
      const cl = Math.hypot(cxs, cys) || 1;
      fx += (cxs / cl) * 0.25;
      fy += (cys / cl) * 0.25;

      fx += sx * 0.02;
      fy += sy * 0.02;
    }

    // pointer interaction: attract toward, scatter away. Distances are measured
    // in screen pixels (positions scaled by ZOOM) so the interaction radius
    // feels the same regardless of the mobile zoom-out. Direction is a unit
    // vector, so it is identical in world and screen space.
    const sxp = x * ZOOM;
    const syp = y * ZOOM;
    const mdx = pointer.x - sxp;
    const mdy = pointer.y - syp;
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

    // wrap edges (world space)
    if (px[i] < -5) px[i] = WW + 5;
    else if (px[i] > WW + 5) px[i] = -5;
    if (py[i] < -5) py[i] = HH + 5;
    else if (py[i] > HH + 5) py[i] = -5;
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

  for (let i = 0; i < count; i++) {
    const sp = Math.hypot(vx[i], vy[i]);
    const hue = ((sp / MAX_SPEED) * 200 + hueShift + (px[i] + py[i]) * 0.05) % 360;
    const len = 2 + sp * 2.5; // streak length kept in screen px (constant size)
    const a = Math.atan2(vy[i], vx[i]);

    // world -> screen for position; streak drawn in screen px.
    const sX = px[i] * ZOOM;
    const sY = py[i] * ZOOM;

    ctx.strokeStyle = `hsla(${hue}, 100%, 62%, 0.9)`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(sX, sY);
    ctx.lineTo(sX - Math.cos(a) * len, sY - Math.sin(a) * len);
    ctx.stroke();
  }
}

function loop() {
  easeControls();
  step();
  draw();
  requestAnimationFrame(loop);
}
loop();

// ---- HUD ----

const hintEl = document.getElementById('hint');
hintEl.textContent = device.touchPrimary
  ? 'hold to scatter'
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

// Touch only: kill the long-press context menu so scatter never pops a menu.
// Desktop right-click is left untouched.
if (device.touchPrimary) {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- controls ----

const countEl = document.getElementById('count');
const trailEl = document.getElementById('trail');
const chaosEl = document.getElementById('chaos');

// Apply device-aware count range before wiring up.
countEl.max = String(COUNT_MAX);
countEl.value = String(COUNT_DEFAULT);
document.getElementById('vCount').textContent = String(COUNT_DEFAULT);

// Sliders set targets; the toy eases toward them each frame (see easeControls).
countEl.addEventListener('input', (e) => {
  document.getElementById('vCount').textContent = e.target.value;
  targetCount = parseInt(e.target.value, 10);
});
trailEl.addEventListener('input', (e) => {
  targetTrail = parseInt(e.target.value, 10) / 100;
  document.getElementById('vTrail').textContent = targetTrail.toFixed(2);
});
chaosEl.addEventListener('input', (e) => {
  targetChaos = parseInt(e.target.value, 10) / 100;
  document.getElementById('vChaos').textContent = targetChaos.toFixed(2);
});

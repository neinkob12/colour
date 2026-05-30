import '../../src/styles/base.css';
import './warp.css';
import { createCanvas } from '../../src/lib/canvas.js';
import { createPointer } from '../../src/lib/pointer.js';
import { detectDevice } from '../../src/lib/device.js';

// "Force-field warp": a lattice of spring-tethered particles. Dragging opens a
// gravity well that bends the field toward the pointer; pressing fires an
// expanding shockwave ring that ripples outward. Under-damped springs let the
// field overshoot and oscillate, so warps keep rippling instead of snapping
// back once. Color brightens with displacement, so the lattice rests dark and
// lights up where it bends.

const device = detectDevice();

const canvas = document.getElementById('c');

// pointer.active = gravity well (drag), pointer.down = blast (button/long-press)
const pointer = createPointer(canvas);

// ---- tunables ----
const SPRING = 0.05; // pull back toward home
const DAMPING = 0.9; // < 1 so the field oscillates and ripples
const WELL_R = device.pick(150, 200); // gravity-well radius (px)
const RING_SPEED = device.pick(7, 9); // shockwave expansion (px/frame)
const RING_W = device.pick(34, 30); // shockwave ring thickness (px)
const BLAST_INTERVAL = 9; // frames between rings while held

let cols = device.pick(30, 60); // grid columns (slider-controlled)
let pull = 3.0; // gravity-well strength
let blast = 8.0; // shockwave strength

// ---- particle lattice (rebuilt on resize / grid change) ----
let rows = 0;
let N = 0;
let hx, hy, x, y, vx, vy; // home pos, current pos, velocity

function build(view) {
  const W = view.W;
  const H = view.H;
  rows = Math.max(2, Math.round((cols * H) / W));
  N = cols * rows;
  hx = new Float32Array(N);
  hy = new Float32Array(N);
  x = new Float32Array(N);
  y = new Float32Array(N);
  vx = new Float32Array(N);
  vy = new Float32Array(N);
  const sx = W / cols;
  const sy = H / rows;
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const px = (c + 0.5) * sx;
      const py = (r + 0.5) * sy;
      hx[i] = px;
      hy[i] = py;
      x[i] = px;
      y[i] = py;
      i++;
    }
  }
}

const view = createCanvas(canvas, { onResize: build });
const ctx = view.ctx;

// ---- shockwave ring pool ----
const MAX_RINGS = 16;
const rcx = new Float32Array(MAX_RINGS);
const rcy = new Float32Array(MAX_RINGS);
const rt = new Float32Array(MAX_RINGS); // age in frames
const rstr = new Float32Array(MAX_RINGS);
const ralive = new Uint8Array(MAX_RINGS);

function spawnRing(px, py, str) {
  for (let k = 0; k < MAX_RINGS; k++) {
    if (!ralive[k]) {
      rcx[k] = px;
      rcy[k] = py;
      rt[k] = 0;
      rstr[k] = str;
      ralive[k] = 1;
      return;
    }
  }
}

let hue = Math.random() * 360;
let blastTimer = 0;

function update() {
  const W = view.W;
  const H = view.H;
  const maxR = Math.hypot(W, H) + RING_W * 3;

  // blast: spawn shockwave rings on press and repeatedly while held
  if (pointer.active && pointer.down) {
    if (blastTimer <= 0) {
      spawnRing(pointer.x, pointer.y, blast);
      blastTimer = BLAST_INTERVAL;
    }
    blastTimer--;
  } else {
    blastTimer = 0;
  }

  // age rings
  for (let k = 0; k < MAX_RINGS; k++) {
    if (!ralive[k]) continue;
    rt[k]++;
    if (rt[k] * RING_SPEED > maxR) ralive[k] = 0;
  }

  const well = pointer.active && !pointer.down;
  const px = pointer.x;
  const py = pointer.y;
  const twoRW2 = 2 * RING_W * RING_W;

  for (let i = 0; i < N; i++) {
    let fx = (hx[i] - x[i]) * SPRING;
    let fy = (hy[i] - y[i]) * SPRING;

    // gravity well
    if (well) {
      const dx = px - x[i];
      const dy = py - y[i];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < WELL_R && d > 0.001) {
        const f = (pull * (1 - d / WELL_R)) / d;
        fx += dx * f;
        fy += dy * f;
      }
    }

    // shockwave rings push outward as their front passes
    for (let k = 0; k < MAX_RINGS; k++) {
      if (!ralive[k]) continue;
      const dx = x[i] - rcx[k];
      const dy = y[i] - rcy[k];
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      const ringR = rt[k] * RING_SPEED;
      const diff = d - ringR;
      const prox = Math.exp(-(diff * diff) / twoRW2);
      const inten = rstr[k] / (1 + rt[k] * 0.04);
      const f = (prox * inten) / d;
      fx += dx * f;
      fy += dy * f;
    }

    vx[i] = (vx[i] + fx) * DAMPING;
    vy[i] = (vy[i] + fy) * DAMPING;
    x[i] += vx[i];
    y[i] += vy[i];
  }
}

function draw() {
  const W = view.W;
  const H = view.H;

  // fade for motion trails
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = 'rgba(10, 0, 20, 0.32)';
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  hue = (hue + 0.25) % 360;

  // faint mesh lines (rows then columns) to show the bend
  ctx.lineWidth = 1;
  ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.12)`;
  for (let r = 0; r < rows; r++) {
    ctx.beginPath();
    const base = r * cols;
    ctx.moveTo(x[base], y[base]);
    for (let c = 1; c < cols; c++) {
      const i = base + c;
      ctx.lineTo(x[i], y[i]);
    }
    ctx.stroke();
  }
  for (let c = 0; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(x[c], y[c]);
    for (let r = 1; r < rows; r++) {
      const i = r * cols + c;
      ctx.lineTo(x[i], y[i]);
    }
    ctx.stroke();
  }

  // glowing vertex dots, brightness + size + hue by displacement
  for (let i = 0; i < N; i++) {
    const ddx = x[i] - hx[i];
    const ddy = y[i] - hy[i];
    const disp = Math.sqrt(ddx * ddx + ddy * ddy);
    let glow = disp / 45;
    if (glow > 1) glow = 1;
    const h = (hue + disp * 1.6 + (hx[i] + hy[i]) * 0.04) % 360;
    const rad = 1.1 + glow * 3.2;
    ctx.fillStyle = `hsla(${h}, 100%, ${50 + glow * 18}%, ${0.35 + glow * 0.6})`;
    ctx.beginPath();
    ctx.arc(x[i], y[i], rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
loop();

// ---- HUD ----

const hintEl = document.getElementById('hint');

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

// Touch only: kill the long-press context menu so "blast" never opens a menu.
if (device.touchPrimary) {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- controls ----

const gridEl = document.getElementById('grid');
const pullEl = document.getElementById('pull');
const blastEl = document.getElementById('blast');

// device-aware defaults
gridEl.value = String(cols);
document.getElementById('vGrid').textContent = String(cols);

gridEl.addEventListener('input', (e) => {
  cols = parseInt(e.target.value, 10);
  document.getElementById('vGrid').textContent = String(cols);
  build(view);
});
pullEl.addEventListener('input', (e) => {
  pull = (parseInt(e.target.value, 10) / 100) * 6;
  document.getElementById('vPull').textContent = pull.toFixed(1);
});
blastEl.addEventListener('input', (e) => {
  blast = (parseInt(e.target.value, 10) / 100) * 16;
  document.getElementById('vBlast').textContent = blast.toFixed(1);
});

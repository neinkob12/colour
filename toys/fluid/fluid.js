import '../../src/styles/base.css';
import './fluid.css';
import { createCanvas } from '../../src/lib/canvas.js';
import { createPointer } from '../../src/lib/pointer.js';
import { detectDevice } from '../../src/lib/device.js';
import { hslToRgb } from '../../src/lib/color.js';

// "Fluid you stir": a grid-based stable-fluids dye simulation.
// A velocity grid is advected and made divergence-free with a bounded Jacobi
// pressure solve; three dye channels (R/G/B) are advected through it so that
// differently-hued streams genuinely add and bleed where they collide. The
// grid is rendered into a tiny offscreen canvas and scaled up, so render cost
// is tied to grid size, not screen pixels. Trails fade via dye dissipation.

const device = detectDevice();

const canvas = document.getElementById('c');

// pointer.active = stir/drag, pointer.down = pour (mouse button / long-press).
const pointer = createPointer(canvas);

// Dialed-down defaults on phones / low-power devices (genuine, not shrunk).
const LONG_AXIS = device.pick(88, 160); // grid cells on the longer screen edge
const ITERS = device.pick(10, 14); // Jacobi pressure iterations
const SPLAT_R = device.pick(4, 6); // injection kernel radius in cells

const VEL_DECAY = 0.998;
const SIGMA = SPLAT_R * 0.5 + 0.4;
const BLOOM = device.pick(5, 9); // glow blur radius in px

// ---- simulation buffers (rebuilt on resize) ----
let gw = 0;
let gh = 0;
let vx, vy, vx0, vy0, pr, divg, dr, dg, db, dr0, dg0, db0;
let off, offCtx, offImg, offData;

function build(view) {
  const W = view.W;
  const H = view.H;
  if (W >= H) {
    gw = LONG_AXIS;
    gh = Math.max(16, Math.round((LONG_AXIS * H) / W));
  } else {
    gh = LONG_AXIS;
    gw = Math.max(16, Math.round((LONG_AXIS * W) / H));
  }
  const n = gw * gh;
  vx = new Float32Array(n);
  vy = new Float32Array(n);
  vx0 = new Float32Array(n);
  vy0 = new Float32Array(n);
  pr = new Float32Array(n);
  divg = new Float32Array(n);
  dr = new Float32Array(n);
  dg = new Float32Array(n);
  db = new Float32Array(n);
  dr0 = new Float32Array(n);
  dg0 = new Float32Array(n);
  db0 = new Float32Array(n);

  off = document.createElement('canvas');
  off.width = gw;
  off.height = gh;
  offCtx = off.getContext('2d');
  offImg = offCtx.createImageData(gw, gh);
  offData = offImg.data;
  for (let i = 0; i < n; i++) offData[i * 4 + 3] = 255; // opaque
}

const view = createCanvas(canvas, { onResize: build });
const ctx = view.ctx;

// ---- controls (set targets directly; fluid params are not jarring) ----
let flow = 2.0; // velocity injection scale
let dyeFade = 0.985; // per-frame dye multiply (slow trail fade)
let hueSpeed = 0.8; // degrees per frame the injected hue rotates
let hue = Math.random() * 360;

// ---- pointer / injection state ----
let wasActive = false;
let prevGx = 0;
let prevGy = 0;

function inject() {
  if (!pointer.active) {
    wasActive = false;
    return;
  }
  const W = view.W;
  const H = view.H;
  const gxf = (pointer.x / W) * gw;
  const gyf = (pointer.y / H) * gh;
  if (!wasActive) {
    prevGx = gxf;
    prevGy = gyf;
    wasActive = true;
  }
  const dvx = gxf - prevGx;
  const dvy = gyf - prevGy;
  prevGx = gxf;
  prevGy = gyf;

  hue = (hue + hueSpeed) % 360;
  const rgb = hslToRgb(hue / 360, 1, 0.55);
  const cr = rgb[0];
  const cg = rgb[1];
  const cb = rgb[2];

  const speed = Math.hypot(dvx, dvy);
  const dyeAmt = 0.2 + Math.min(speed * 0.9, 1.4);
  const pouring = pointer.down;

  const cx = Math.round(gxf);
  const cy = Math.round(gyf);
  const twoSig2 = 2 * SIGMA * SIGMA;
  const FORCE = 3; // base amplifier so dragging really shoves the fluid

  for (let oy = -SPLAT_R; oy <= SPLAT_R; oy++) {
    const gy = cy + oy;
    if (gy < 1 || gy >= gh - 1) continue;
    for (let ox = -SPLAT_R; ox <= SPLAT_R; ox++) {
      const gx = cx + ox;
      if (gx < 1 || gx >= gw - 1) continue;
      const fall = Math.exp(-(ox * ox + oy * oy) / twoSig2);
      const id = gx + gy * gw;
      vx[id] += dvx * flow * FORCE * fall;
      vy[id] += dvy * flow * FORCE * fall;
      if (pouring) {
        // pour also shoves fluid radially outward from the point
        vx[id] += ox * 0.9 * fall;
        vy[id] += oy * 0.9 * fall;
      }
      const amt = (pouring ? dyeAmt * 4 + 0.8 : dyeAmt) * fall;
      dr[id] += cr * amt;
      dg[id] += cg * amt;
      db[id] += cb * amt;
    }
  }
}

// Semi-Lagrangian advection: backtrace through velocity (u, v).
function advect(d, d0, u, v, dt) {
  const w = gw;
  const h = gh;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const id = x + y * w;
      let fx = x - dt * u[id];
      let fy = y - dt * v[id];
      if (fx < 0.5) fx = 0.5;
      else if (fx > w - 1.5) fx = w - 1.5;
      if (fy < 0.5) fy = 0.5;
      else if (fy > h - 1.5) fy = h - 1.5;
      const i0 = fx | 0;
      const j0 = fy | 0;
      const i1 = i0 + 1;
      const j1 = j0 + 1;
      const s1 = fx - i0;
      const s0 = 1 - s1;
      const t1 = fy - j0;
      const t0 = 1 - t1;
      const a = i0 + j0 * w;
      const bb = i0 + j1 * w;
      const c = i1 + j0 * w;
      const e = i1 + j1 * w;
      d[id] = s0 * (t0 * d0[a] + t1 * d0[bb]) + s1 * (t0 * d0[c] + t1 * d0[e]);
    }
  }
}

function setBndVel() {
  const w = gw;
  const h = gh;
  for (let x = 0; x < w; x++) {
    const t = x;
    const b = x + (h - 1) * w;
    vx[t] = 0;
    vy[t] = 0;
    vx[b] = 0;
    vy[b] = 0;
  }
  for (let y = 0; y < h; y++) {
    const l = y * w;
    const r = w - 1 + y * w;
    vx[l] = 0;
    vy[l] = 0;
    vx[r] = 0;
    vy[r] = 0;
  }
}

function project() {
  const w = gw;
  const h = gh;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const id = x + y * w;
      divg[id] = -0.5 * (vx[id + 1] - vx[id - 1] + vy[id + w] - vy[id - w]);
      pr[id] = 0;
    }
  }
  for (let k = 0; k < ITERS; k++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const id = x + y * w;
        pr[id] = (divg[id] + pr[id - 1] + pr[id + 1] + pr[id - w] + pr[id + w]) * 0.25;
      }
    }
  }
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const id = x + y * w;
      vx[id] -= 0.5 * (pr[id + 1] - pr[id - 1]);
      vy[id] -= 0.5 * (pr[id + w] - pr[id - w]);
    }
  }
  setBndVel();
}

function render() {
  const n = gw * gh;
  const data = offData;
  for (let i = 0; i < n; i++) {
    let R = dr[i] * 255;
    let G = dg[i] * 255;
    let B = db[i] * 255;
    if (R > 255) R = 255;
    if (G > 255) G = 255;
    if (B > 255) B = 255;
    const j = i * 4;
    data[j] = R;
    data[j + 1] = G;
    data[j + 2] = B;
  }
  offCtx.putImageData(offImg, 0, 0);

  const W = view.W;
  const H = view.H;

  // solid dark ink background
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#0a0014';
  ctx.fillRect(0, 0, W, H);

  // glowing dye added over the background
  ctx.imageSmoothingEnabled = true;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(off, 0, 0, W, H);

  // soft bloom: a blurred additive pass for the glow
  ctx.filter = `blur(${BLOOM}px)`;
  ctx.globalAlpha = 0.6;
  ctx.drawImage(off, 0, 0, W, H);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function frame() {
  inject();

  // velocity self-advection
  vx0.set(vx);
  vy0.set(vy);
  advect(vx, vx0, vx0, vy0, 1);
  advect(vy, vy0, vx0, vy0, 1);
  setBndVel();

  project();

  // dye advection through the divergence-free velocity field
  dr0.set(dr);
  dg0.set(dg);
  db0.set(db);
  advect(dr, dr0, vx, vy, 1);
  advect(dg, dg0, vx, vy, 1);
  advect(db, db0, vx, vy, 1);

  // dissipate (slow trail fade) and decay currents
  const n = gw * gh;
  for (let i = 0; i < n; i++) {
    vx[i] *= VEL_DECAY;
    vy[i] *= VEL_DECAY;
    dr[i] *= dyeFade;
    dg[i] *= dyeFade;
    db[i] *= dyeFade;
  }

  render();
  requestAnimationFrame(frame);
}
frame();

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

// Touch only: kill the long-press context menu so "pour" never opens a menu.
if (device.touchPrimary) {
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---- controls ----

const flowEl = document.getElementById('flow');
const fadeEl = document.getElementById('fade');
const hueEl = document.getElementById('hue');

flowEl.addEventListener('input', (e) => {
  flow = parseInt(e.target.value, 10) / 100;
  document.getElementById('vFlow').textContent = flow.toFixed(2);
});
fadeEl.addEventListener('input', (e) => {
  const v = parseInt(e.target.value, 10);
  dyeFade = 1 - v / 1000;
  document.getElementById('vFade').textContent = (v / 1000).toFixed(3);
});
hueEl.addEventListener('input', (e) => {
  hueSpeed = parseInt(e.target.value, 10) / 100;
  document.getElementById('vHue').textContent = hueSpeed.toFixed(2);
});

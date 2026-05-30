// Full-screen canvas with device-pixel-ratio handling, capped at 2 so high-DPI
// phones do not get murdered. Returns a view object whose W/H/DPR stay current
// across resizes; read them into locals at the top of each frame in hot loops.

export function createCanvas(canvas, { onResize } = {}) {
  const ctx = canvas.getContext('2d');
  const view = { ctx, W: 0, H: 0, DPR: 1 };

  function resize() {
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;

    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    // Draw in CSS pixels; the DPR scale maps to device pixels.
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    view.W = W;
    view.H = H;
    view.DPR = DPR;

    if (onResize) onResize(view);
  }

  resize();
  window.addEventListener('resize', resize);

  view.destroy = () => window.removeEventListener('resize', resize);
  return view;
}

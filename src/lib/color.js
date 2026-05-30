// Small color helpers shared across toys. The house style is glowing, saturated
// HSL on dark backgrounds, so most toys think in hue + alpha.

export function hsla(h, s, l, a) {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

export function hsl(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Normalize any hue into [0, 360).
export function wrapHue(h) {
  return ((h % 360) + 360) % 360;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// HSL -> RGB, all inputs and outputs in 0..1. Returns [r, g, b].
// Useful when a toy needs to write color into a numeric buffer (e.g. a dye
// field) rather than a CSS string.
export function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

// Shared signature hues for cohesion across toys (magenta + cyan + violet).
export const PALETTE = {
  glow: 320, // hot magenta/pink
  glow2: 188, // cyan
  glow3: 276, // violet
};

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

// Shared signature hues for cohesion across toys (magenta + cyan + violet).
export const PALETTE = {
  glow: 320, // hot magenta/pink
  glow2: 188, // cyan
  glow3: 276, // violet
};

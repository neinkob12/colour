// Device capability detection. Toys use this to pick dialed-down defaults on
// phones and low-power machines instead of shrinking the desktop numbers.

export function detectDevice() {
  const mql = (q) => (window.matchMedia ? window.matchMedia(q).matches : false);

  const coarsePointer = mql('(pointer: coarse)');
  const noHover = mql('(hover: none)');
  const reducedMotion = mql('(prefers-reduced-motion: reduce)');

  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4; // GB, Chrome only
  const minEdge = Math.min(window.innerWidth, window.innerHeight);

  // Treat as a phone/tablet when touch is the primary input.
  const touchPrimary = coarsePointer && noHover;

  // Low power: phones, small screens, or clearly weak hardware.
  const lowPower =
    touchPrimary ||
    minEdge < 680 ||
    cores <= 4 ||
    memory <= 2 ||
    reducedMotion;

  return {
    touchPrimary,
    coarsePointer,
    reducedMotion,
    cores,
    memory,
    lowPower,
    tier: lowPower ? 'low' : 'high',
    // Pick between a low-power value and a full-power value.
    pick(low, high) {
      return lowPower ? low : high;
    },
  };
}

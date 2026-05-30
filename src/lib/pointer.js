// Unified mouse + touch pointer state, built on Pointer Events so both share one
// code path. Attach to the canvas (not window) so HUD controls do not drive the
// toy. Read the returned `state` object every frame.
//
// Interaction model shared across toys:
//   state.x, state.y   primary position (averaged across active touches)
//   state.active       interacting at all (mouse over, or a finger down)
//   state.down         secondary "press" gesture
//                        - mouse:  a button is held
//                        - touch:  a long-press (hold roughly in place) is held.
//                          Once engaged it stays down until release, and the
//                          finger can drag the point around (mirrors a desktop
//                          press-and-move). A quick tap or a drag never engages.
//   state.count        number of active pointers (fingers); mouse: 1 while held
//   state.isTouch      last interaction came from touch/pen, not mouse

const LONGPRESS_MS = 350; // hold this long to engage the touch "press"
const MOVE_TOL = 12; // px of travel before a hold is treated as a drag instead

export function createPointer(target) {
  const state = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    active: false,
    down: false,
    count: 0,
    isTouch: false,
  };

  const points = new Map(); // pointerId -> { x, y }

  // Long-press tracking (touch only).
  let lpTimer = null;
  let lpStartX = 0;
  let lpStartY = 0;
  let lpEngaged = false;

  function cancelLongPress() {
    if (lpTimer !== null) {
      clearTimeout(lpTimer);
      lpTimer = null;
    }
    lpEngaged = false;
    state.down = false;
  }

  function recompute() {
    state.count = points.size;
    if (points.size > 0) {
      let sx = 0;
      let sy = 0;
      for (const p of points.values()) {
        sx += p.x;
        sy += p.y;
      }
      state.x = sx / points.size;
      state.y = sy / points.size;
    }
  }

  function onDown(e) {
    state.isTouch = e.pointerType !== 'mouse';
    points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    recompute();
    state.active = true;

    if (!state.isTouch) {
      // Mouse: a held button is the press. Unchanged from before.
      state.down = true;
    } else if (points.size === 1) {
      // Touch: start the long-press timer. Engages only if the finger stays
      // roughly still for LONGPRESS_MS.
      lpStartX = e.clientX;
      lpStartY = e.clientY;
      lpEngaged = false;
      if (lpTimer !== null) clearTimeout(lpTimer);
      lpTimer = setTimeout(() => {
        lpTimer = null;
        if (points.size === 1) {
          state.down = true;
          lpEngaged = true;
        }
      }, LONGPRESS_MS);
    } else {
      // A second finger landed: ambiguous, so no scatter.
      cancelLongPress();
    }

    if (state.isTouch && e.cancelable) e.preventDefault();
  }

  function onMove(e) {
    state.isTouch = e.pointerType !== 'mouse';
    if (points.has(e.pointerId)) {
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      recompute();
      // Before the hold engages, too much travel means it is a drag, not a
      // hold, so it should never scatter. After it engages, the finger is free
      // to drag the scatter point around.
      if (state.isTouch && !lpEngaged && points.size === 1 && lpTimer !== null) {
        const dx = e.clientX - lpStartX;
        const dy = e.clientY - lpStartY;
        if (dx * dx + dy * dy > MOVE_TOL * MOVE_TOL) {
          clearTimeout(lpTimer);
          lpTimer = null;
        }
      }
    } else if (e.pointerType === 'mouse') {
      // Hover with no button held still attracts.
      state.x = e.clientX;
      state.y = e.clientY;
      state.active = true;
    }
    if (state.isTouch && e.cancelable) e.preventDefault();
  }

  function onUp(e) {
    points.delete(e.pointerId);
    recompute();
    if (e.pointerType === 'mouse') {
      state.down = false;
    } else {
      cancelLongPress();
      if (points.size === 0) state.active = false;
    }
  }

  function onLeave(e) {
    if (e.pointerType === 'mouse') {
      state.active = false;
      state.down = false;
    }
  }

  target.addEventListener('pointerdown', onDown);
  target.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  target.addEventListener('pointerleave', onLeave);

  state.destroy = () => {
    cancelLongPress();
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    target.removeEventListener('pointerleave', onLeave);
  };

  return state;
}

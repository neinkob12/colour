// Unified mouse + touch pointer state, built on Pointer Events so both share one
// code path. Attach to the canvas (not window) so HUD controls do not drive the
// toy. Read the returned `state` object every frame.
//
// Interaction model shared across toys:
//   state.x, state.y   primary position (averaged across active touches)
//   state.active       interacting at all (mouse over, or a finger down)
//   state.down         secondary "press" gesture
//                        - mouse:  a button is held
//                        - touch:  two or more fingers are down (two-finger hold)
//   state.count        number of active pointers (fingers); mouse: 1 while held
//   state.isTouch      last interaction came from touch/pen, not mouse

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
    // Mouse: a held button is the "press". Touch: pressing comes from a second
    // finger, handled via state.count below.
    state.down = state.isTouch ? points.size >= 2 : true;
    if (e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
  }

  function onMove(e) {
    state.isTouch = e.pointerType !== 'mouse';
    if (points.has(e.pointerId)) {
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      recompute();
    } else if (e.pointerType === 'mouse') {
      // Hover with no button held still attracts.
      state.x = e.clientX;
      state.y = e.clientY;
      state.active = true;
    }
    if (e.pointerType !== 'mouse' && e.cancelable) e.preventDefault();
  }

  function onUp(e) {
    points.delete(e.pointerId);
    recompute();
    if (e.pointerType === 'mouse') {
      state.down = false;
    } else {
      state.down = points.size >= 2;
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
    target.removeEventListener('pointerdown', onDown);
    target.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    target.removeEventListener('pointerleave', onLeave);
  };

  return state;
}

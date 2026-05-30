# Claude Code Instructions

## Before doing anything

Read `TECH_STACK.md` and `PROJECT_PLAN.md` first. TECH_STACK.md defines the tools and conventions. PROJECT_PLAN.md defines what gets built in which phase. Follow both. Do not build anything outside the current phase.

## What this project is

A collection of colorful, interactive, psychedelic "art toys" on one website. Each toy is a full-screen HTML5 canvas experience controlled by mouse or touch. A landing page links to all of them. Vivid, trippy, motion-heavy, dark backgrounds with glowing color. The point is delight, not utility.

## House rules

- This is vanilla JavaScript with Vite. Do NOT add React, Vue, Svelte, or any UI framework. Do NOT add TypeScript unless I explicitly ask.
- No backend, no database, no auth, no API calls. These toys run entirely client-side. If you think you need a server, stop and ask first.
- Reach for a dependency only when it clearly earns its place. Default to writing the canvas logic yourself. If you do add a library, update TECH_STACK.md in the same change and note why.
- Each toy lives in its own page/module and shares the common layout and styling. Shared logic goes in a `/lib` folder. Do not create `/utils`, `/services`, or `/types` folders.
- Keep per-toy files self-contained. One toy's code should not import another toy's internals.
- Every toy must work on both mouse and touch, and must be responsive. Mobile is a first-class target, not an afterthought.

## Performance

- These are animation-heavy canvas toys. Watch the per-frame cost. Use `requestAnimationFrame`, cap device pixel ratio at 2, and avoid per-frame allocations in hot loops.
- Mobile and low-power devices get dialed-down defaults (fewer particles, simpler effects), not the desktop settings shrunk down. Detect and adapt.

## Communication

- Be direct. Push back when something seems off rather than agreeing.
- Do not use em dashes.
- When uncertain, ask one focused question rather than guessing.
- Confirm structural decisions with me before creating a pile of files.

---

## Project conventions established in Phase 1

These are decisions made while building the foundation. Follow them in later phases.

### Directory layout

```
index.html              landing page (loads src/landing.js)
vite.config.js          add one input line per new toy
src/
  styles/base.css       shared color + type system, HUD + control components
  styles/landing.css    landing-page-only styles
  landing.js            landing-page entry
  lib/                  shared helpers, imported by every toy
    canvas.js           full-screen canvas + DPR resize (cap 2)
    pointer.js          unified mouse + touch pointer state
    device.js           device capability / low-power detection
    color.js            small color helpers (hsl strings, hue wrap)
toys/
  swarm/
    index.html          page entry, route /toys/swarm/
    swarm.js            toy module (imports base.css + lib)
    swarm.css           toy-only styles
```

To add a toy: create `toys/<name>/{index.html,<name>.js,<name>.css}`, add an
`input` line in `vite.config.js`, and flip its landing card to clickable.

### Interaction conventions

- Pointer input goes through `src/lib/pointer.js`, attached to the canvas so HUD
  controls do not drive the toy.
- Mouse: hover/move is the primary "attract"-style gesture, button-down is the
  secondary "press"-style gesture.
- Touch: one finger is the primary gesture. The secondary gesture is a
  **two-finger hold** (add a second finger, release to resume). This is the
  standard mobile pattern for this project, chosen in Phase 1 for Swarm's
  scatter and meant to carry forward to later toys.

### Performance conventions

- Low-power / touch devices get smaller defaults and lower slider ceilings via
  `src/lib/device.js`, not the desktop numbers scaled down.

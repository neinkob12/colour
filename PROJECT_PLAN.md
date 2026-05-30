# Project Plan

A site of six interactive canvas art toys with a landing page that links to them all. Built and deployed incrementally, one toy per session after the foundation is set. Each phase below is roughly one Claude Code session. Do not jump ahead. Finishing a phase cleanly beats half-building three.

## The toys

1. **Swarm** (already built in chat, code provided). Flocking boids chase the cursor, scatter on press, color by velocity, slow hue cycling. The reference implementation to port.
2. **Fluid you stir.** Glowing ink that follows pointer drags. Colors bleed and mix where currents collide. Trails fade slowly. The payoff is painting with motion.
3. **Force-field warp.** A grid of particles at rest. Drag to create gravity wells and explosions that ripple outward and warp the field. Color shifts with displacement.
4. **Click-to-bloom canvas.** Each tap drops a blooming flower or expanding ripple of color. Builds up into a layered composition.
5. **Kaleidoscope mirror.** Whatever you draw is mirrored into symmetric, rotating patterns. Symmetry count adjustable.
6. **Bouncing color physics.** Drag to launch colorful balls that bounce, collide, and leave glowing trails.

## Shared design language

Dark backgrounds, glowing saturated color, motion-heavy, psychedelic. Every toy: full-screen canvas, minimal HUD, works on mouse and touch, responsive, performance-aware. The landing page and the toys should feel like one cohesive thing, not six unrelated demos.

---

## Phase 1: Foundation, Swarm, deploy (FIRST SESSION)

The only phase to work on right now.

In scope:
- Vite project skeleton structured to scale to six toy pages plus a landing page. Confirm the structure before creating files.
- Shared layout, base stylesheet with the common color and type system, and `/lib` helpers (canvas/DPR resize, pointer-touch normalization, device capability detection).
- Landing page: a grid of six cards, one per toy. Swarm is clickable; the other five are marked "coming soon" and non-clickable. Styled to match the psychedelic aesthetic.
- Port the provided Swarm code into its own page within the structure.
- Make Swarm fully mobile-ready: touch support, responsive sizing, and reduced particle defaults on small or low-power devices. Resolve the touch-scatter gesture (see open question below).
- Set up Vercel deploy. Confirm the live URL works on desktop and a phone.

Not in scope: toys 2 through 6 beyond their "coming soon" cards. No stubbing their logic.

Open question to resolve this phase: on desktop, a single pointer attracts the swarm and pressing scatters it. On touch, a single finger is already the attract gesture, so press-to-scatter conflicts. Propose a touch gesture for scatter (long-press, two-finger tap, or a dedicated on-screen toggle) and confirm before implementing. Whatever is chosen sets the mobile interaction pattern for later toys, so choose deliberately.

> Phase 1 resolution: **two-finger hold** scatters. One finger attracts, a second
> finger scatters, releasing resumes attract. Chosen as a momentary gesture that
> mirrors desktop hold-to-scatter and carries forward to later toys.

## Phase 2: Fluid you stir

Build toy 2 as its own page. Flip its landing card from "coming soon" to clickable. Reuse the shared lib and layout. Mobile and touch from the start.

## Phase 3: Force-field warp

Build toy 3. Same pattern. This one risks getting repetitive fast, so put effort into the variety of the ripple and warp behavior, not just the initial push.

## Phase 4: Click-to-bloom canvas

Build toy 4. Same pattern. Consider letting blooms accumulate into a saveable composition later, but not required.

## Phase 5: Kaleidoscope mirror

Build toy 5. Same pattern. Adjustable symmetry count as a control.

## Phase 6: Bouncing color physics

Build toy 6. Same pattern. Real collision and bounce, glowing trails.

## Phase 7: Polish pass

Once all six exist: consistency review across toys, landing page refinement, shared controls and feel, performance check on a real mid-range phone, and any transitions between landing and toys. This is where it stops being six demos and becomes one polished site.

---

## Rules across all phases

- One toy per session. Finish and deploy before starting the next.
- Every toy ships mobile-ready and responsive in the same session it is built. Do not defer mobile to a cleanup phase.
- Keep toys self-contained. Shared code goes in `/lib`, never cross-imported between toys.
- Watch per-frame performance. Mobile gets dialed-down defaults, not shrunk desktop settings.
- Update the landing card from "coming soon" to clickable in the same session the toy is built.

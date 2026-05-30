# Tech Stack

This project is a static, client-side site of interactive canvas art toys. The stack is deliberately minimal. There is no backend, no database, and no auth, because nothing here needs them.

## Core

- **Build tool: Vite.** Fast dev server with hot reload, near-zero config, and a clean static build for deploy. Multi-page setup (one HTML entry per toy plus the landing page).
- **Language: Vanilla JavaScript (ES modules).** No framework. The toys are self-contained canvas programs; a UI framework would add weight and indirection for no benefit. No TypeScript unless explicitly requested.
- **Rendering: HTML5 Canvas 2D.** Every toy draws to a `<canvas>`. Reach for WebGL only if a specific toy genuinely cannot hit framerate on 2D, and flag that decision before doing it.
- **Styling: Plain CSS.** Shared variables and layout in one base stylesheet. Per-toy CSS only when a toy needs it. No Tailwind, no CSS-in-JS.

## Structure

- `index.html` plus the landing page code: the grid of toy cards.
- One entry per toy, each its own page importing its own module.
- `/lib`: shared helpers used across toys (canvas resize and DPR handling, pointer/touch normalization, device capability detection, color helpers).
- Shared layout and styling live in common files, not duplicated per toy.

## Deployment

- **Vercel.** Connect the git repo, Vercel auto-builds the Vite project and serves the static output. Pushes to the main branch redeploy automatically. Free tier is sufficient.

## Conventions

- ES modules throughout. No bundler config beyond what Vite gives by default.
- Pointer input is normalized so mouse and touch share one code path per toy wherever possible.
- Device pixel ratio capped at 2 to avoid murdering performance on high-DPI phones.
- Animation via `requestAnimationFrame`, never `setInterval`.

---

## Adding new tools

This stack is the default. If a project genuinely needs something not on this list (a specific easing library, a noise generator, a small math helper, etc.), just add it. No need to ask first. But:

- Update this file when you do, so the next Claude Code session knows.
- Briefly note why it was added.
- Don't replace existing tools without flagging it to the user first.
- Adding a UI framework, a backend, a database, or a build system swap is NOT a minor addition. Flag those before doing anything.

---

## Dependencies added so far

- **vite** (devDependency) — build tool and dev server. Added in Phase 1.

No runtime dependencies. All canvas logic is hand-written.

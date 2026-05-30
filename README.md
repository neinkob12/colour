# colour

A collection of colourful, interactive, psychedelic canvas art toys. Vanilla JS + Vite, no framework, fully client-side.

## Develop

```bash
npm install
npm run dev      # start the dev server (hot reload)
npm run build    # static production build into dist/
npm run preview  # serve the production build locally
```

Open the dev server URL, then visit `/` for the landing page or `/toys/swarm/`
for the Swarm toy.

## Toys

| # | Toy | Status |
|---|-----|--------|
| 1 | Swarm — it follows you | live |
| 2 | Fluid — stir the ink | coming soon |
| 3 | Warp — bend the field | coming soon |
| 4 | Bloom — tap to grow | coming soon |
| 5 | Kaleido — mirror world | coming soon |
| 6 | Bounce — launch & collide | coming soon |

## Structure

See `CLAUDE.md` for the directory layout and conventions, `TECH_STACK.md` for
the stack, and `PROJECT_PLAN.md` for the phase-by-phase build plan.

## Deploy (Vercel)

This is a static Vite multi-page build. On Vercel, import the git repo and keep
the auto-detected settings:

- Framework preset: **Vite**
- Build command: `npm run build`
- Output directory: `dist`

Pushes to the production branch redeploy automatically. No environment variables
or server config are needed.

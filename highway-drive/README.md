# Highway Drive — Aldmere

A browser-based, installable driving game built around the supplied Highway Drive v2.1 brief. TypeScript, Vite and Three.js; no downloaded 3D models, accounts, trackers, ads, or runtime CDN dependencies.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Open the printed local URL. Use landscape on mobile. On desktop, use **WASD** or arrow keys; Space brakes. On touch devices, use the on-screen steering, brake and drive controls. The first interaction starts Web Audio.

## Production build

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

The static production output is `dist/`. It can be deployed to GitHub Pages, Cloudflare Pages or Netlify. The included service worker caches the application shell and same-origin build assets for repeat/offline launches.

## Included systems

- Three.js 3D chase-camera scene and procedurally generated roadside environment
- Continuous 118 km ring route with authored named places and three regional identities
- Eight normalised biome weights, climate/elevation model and region interpolation
- Fixed 60 Hz arcade vehicle simulation, keyboard, touch and browser gamepad input
- Relaxed/realistic grip, lane assist, auto-throttle and local settings persistence
- Dynamic day/night colour, climate-dependent weather state, synthesised engine and wind
- HUD, pause/settings, photo-view toggle, performance overlay (`P`), responsive mobile controls
- PWA manifest/service worker, unit tests, TypeScript strict checking

## Engineering notes and honest release status

This repository is a complete runnable game codebase, not a visual mock-up. It is **not yet a verified production release** against every acceptance criterion in the v2.1 brief. In particular, the current build uses a lightweight procedural scene and a simplified analytic route; the authored 20–25 segment library, full raycast suspension, production-grade traffic, terrain shader/material blending, worker-based chunk streaming, complete weather particle effects, recorded licensed ambience, photo export, localisation, and measured device performance gates remain implementation work. Multiplayer remains intentionally deferred as specified by the brief. Do not advertise the 30/60 fps or sub-5-second targets until tested on physical devices.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Accelerate | W / ↑ | Drive |
| Brake | S / ↓ / Space | Brake |
| Steer | A/D or ←/→ | Left/right |
| Pause | Escape | Pause |
| Debug overlay | P | — |

## Privacy and licensing

No telemetry or account system is included. Settings are stored locally. Engine and wind are synthesised in-browser. No third-party sound recordings are shipped, so there are no unverified audio licences in this build. The Google Fonts import in `src/ui/styles.css` is an optional design convenience; remove it and use the system font stack for a fully self-hosted strict-CSP deployment. Before public release, add the final CSP headers, audit dependencies, validate service-worker update behaviour, and complete the asset/audio licence register.

## Project layout

- `src/main.ts` — application state, UI and game loop
- `src/world/` — route, climate field and Three.js world
- `src/vehicle/` — fixed-step arcade vehicle dynamics
- `src/systems/` — local persistence and procedural audio
- `src/ui/` — responsive HUD and menu styling
- `tests/` — deterministic world and vehicle tests
- `public/` — PWA manifest, icon and service worker

## Deployment

For a project hosted at a repository subpath on GitHub Pages, set Vite's `base` in `vite.config.ts` to `'/REPOSITORY_NAME/'` before building. For a custom root deployment, the current relative base is suitable. Configure hosting headers for HTTPS, HSTS and a restrictive Content Security Policy; avoid `unsafe-eval` and third-party script sources.

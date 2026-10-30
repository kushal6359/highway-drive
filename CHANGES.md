# Fixes in this revision

Found by reading the code, then confirmed in headless Chromium against the original where noted.

## Game-breaking
- **Touch controls did nothing.** `pollInput()` rewrote steer/throttle/brake from the keyboard every frame, wiping on-screen button state. Touch and keyboard state are now separate and merged.
- **Touch controls never appeared on most phones.** They were gated on `max-width:700px`; a landscape phone is ~844 px wide. Now also shown for `(pointer:coarse)`.
- **Steering was mirrored.** The code treated +X as the driver's right, but facing +Z in three.js the right hand is −X. Lateral/steer are now consistently right-positive; `offsetFromRoute()` centralises the maths.
- **The "118 km" route was ~17 km of road.** Position was interpolated between anchors by `distance` fraction, so the scenery crawled and stopped at every anchor, with sharp heading kinks. Replaced with a closed cubic B-spline parametrised by true arc length (1 m driven = 1 m of road, smooth heading, 2.2 km minimum radius, exact lap seam).
- **No ground, and props floated.** There was no terrain, and trees sat at y=0 while the road climbs 1.85 km. Added a climate-tinted terrain ribbon following the road; props sit at road elevation.
- **Road was 360 huge boxes on straight chords.** Now ~29k instanced segments in culled chunks (a handful of draw calls per frame).
- **Traffic was glued to the player.** Positions were `offset + playerDistance`, so cars never got nearer. Now deterministic cars recycled around the player, same-direction and oncoming, honouring the Drive-side setting.
- **A tap on steer drifted the car sideways forever** (heading never recentred, and the car never visibly yawed). Steering now sets a target yaw and self-aligns; the car yaws visibly.

## Settings / UI
- Saving untouched settings silently set Traffic to "Empty road" (default 18 matched no option, so the select was blank).
- "Empty road" and 0 volume could not persist (`Number(x)||18`, `||0`); a missing volume loaded as muted. Storage now validates every field.
- Minimal HUD hid the speedometer and the Pause button (the only way to open the menu on touch). It now hides only secondary items.
- Photo mode could not be exited by touch. Tap the view or press Escape.
- The game claimed arrow/space/WASD keys even in menus, breaking keyboard use of settings controls. Only while driving now.
- Camera and Drive-side settings were saved but ignored; both now work. Weather now affects fog distance.
- Engine/wind kept sounding while paused; audio now suspends. Exit-to-title resets the car and camera.
- Sky brightness peaked at dawn and was darkest at dusk (sin vs −cos); now brightest at noon, darkest at midnight, with matching light levels.

## Build / PWA / CI
- CI used `cache: npm` with no lockfile committed, which fails `setup-node`. Removed (run `npm install` once and commit `package-lock.json`, then re-add it).
- Service worker was cache-first for everything including `index.html` (users stuck on old builds) and was registered in dev (stale modules). Now network-first for pages, production-only, and dev unregisters old workers.
- `tsconfig` listed both `DOM` and `WebWorker` libs, which conflict. Removed `WebWorker`.
- README claimed a Google Fonts import that does not exist; docs said "local right is +X" (the cause of the mirrored steering). Corrected.

## Not done (still listed as future work in the README)
Traffic collision/car-following, weather particles, terrain relief, authored segments, recorded audio, device performance measurements.

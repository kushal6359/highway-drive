# Architecture

## Runtime flow

`main.ts` owns the application lifecycle and a 60 Hz accumulator. Input is sampled once per render frame; the vehicle is stepped at a fixed timestep; rendering interpolates visually through Three.js. World systems are pure functions of route distance and elapsed time where practical.

## Coordinate convention

The road's forward vector is `(sin(heading), 0, cos(heading))`; heading increases toward +X. three.js is right-handed, so a driver facing +Z has their **right hand on world −X**. Vehicle `lateral` is therefore *right-positive* (negative = left), and world positions for a lateral offset must come from `offsetFromRoute()` rather than hand-rolled sin/cos. Steering input and `heading` are right-positive too.

Route distance is true arc length along a closed cubic B-spline (`world/route.ts`), wrapped by `ROUTE_LENGTH`; world consumers should use `routeAt()` rather than accumulating large absolute coordinates. The circuit spans roughly ±15 km, which float32 handles without jitter; a floating-origin/chunk-rebase implementation is still required before extending to a genuinely endless procedural road.

## World rendering

`world/scene.ts` precomputes one frame (position, yaw, pitch) per 20 m road segment and builds instanced meshes in 128-segment chunks for the deck, lane markings and a climate-tinted terrain ribbon, plus instanced props. Chunks carry bounding spheres, so only the stretch around the player is drawn. The fog colour equals the sky colour so distant geometry fades seamlessly.

## Climate

`climateAt(distance)` derives elevation, regional identity and eight biome weights. The weights are normalised to sum to one. Visual and audio consumers should blend from these weights rather than branch on region boundaries.

## Extension points

- Replace the current road and roadside population with worker-generated pooled chunks.
- Add a road-surface query and four wheel raycasts to `vehicle/physics.ts`.
- Replace the recycled ambient traffic in `world/traffic.ts` with agents driven by IDM/MOBIL-style rules and collision.
- Replace the simplified sky/weather state with resident shader variants and crossfaded audio beds.
- Keep all persistent data schema-versioned and validated in `systems/storage.ts`.

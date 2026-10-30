# Architecture

## Runtime flow

`main.ts` owns the application lifecycle and a 60 Hz accumulator. Input is sampled once per render frame; the vehicle is stepped at a fixed timestep; rendering interpolates visually through Three.js. World systems are pure functions of route distance and elapsed time where practical.

## Coordinate convention

The road's forward vector is `(sin(heading), 0, cos(heading))`. Route distance is wrapped by `ROUTE_LENGTH`; world consumers should use `routeAt()` rather than accumulating large absolute coordinates. A floating-origin/chunk-rebase implementation is still required before extending the circuit to a genuinely endless procedural road.

## Climate

`climateAt(distance)` derives elevation, regional identity and eight biome weights. The weights are normalised to sum to one. Visual and audio consumers should blend from these weights rather than branch on region boundaries.

## Extension points

- Replace the current road and roadside population with worker-generated pooled chunks.
- Add a road-surface query and four wheel raycasts to `vehicle/physics.ts`.
- Add deterministic traffic agents driven by IDM/MOBIL-style rules.
- Replace the simplified sky/weather state with resident shader variants and crossfaded audio beds.
- Keep all persistent data schema-versioned and validated in `systems/storage.ts`.

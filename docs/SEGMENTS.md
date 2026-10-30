# Adding an authored road segment

1. Give the segment a stable ID, region affinity, nominal length, entry/exit curvature and required neighbour tags.
2. Define a deterministic placement recipe from `(worldSeed, segmentIndex)`; never call `Math.random()` in world generation.
3. Place the segment on the route frame returned by `routeAt(distance)`. The local forward axis is +Z; a driver's right hand is local −X (three.js is right-handed). Use `offsetFromRoute(point, lateral)` for sideways placement (positive = right of the road).
4. Read the continuous climate weights for terrain colour, flora density, surface edge and audio. Do not branch on a hard region boundary for material selection.
5. Add silhouette landmarks before small props. Keep the road corridor clear and preserve sight distance.
6. Add a transition test seed and a Low-quality fallback. Avoid first-use shader compilation during play.
7. Add any audio file to `audio-licences.csv` before it is referenced by runtime code.
8. Check mobile draw calls, memory and frame pacing; then add a screenshot and a short playtest note.

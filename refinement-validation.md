# Local refinement validation — 25 September 2026

Local preview: http://127.0.0.1:4173/. This report records validation completed before publication.

## Behavior and views

- Selecting Row starts repeated paired strokes after a short preparation. Pause finishes the active stroke, clears pending strokes and leaves Row selected. Resume retains Row. Manual oar input takes over; steering remains available during the automatic rhythm.
- Motor releases the hands, lifts the blades and parks the same two oars lengthwise alongside the hull. Coasting without an active stroke does not animate rowing.
- Standard and High share the existing physics, stroke clock, controls and cameras. Live quality switches retained position, distance, mode, camera and automatic rowing. No duplicate paddles appeared.
- Inspected Follow, On the bow and Overhead under Golden hour, Morning mist and Blue hour. The final near-tree supports no longer appear as plain green ellipsoids above the leaves. Distant vegetation remains a simplified procedural approximation.
- At approximately 4.5 knots, the existing wake is visible behind the stern in Follow and Overhead. It uses surface-normal disturbance, fades with speed and distance, and adds no bright foam trail or extra reflection blur.
- Checked the 390 × 844 phone layout: no horizontal overflow; touch rowing, steering, pause/resume and High switching worked. This is a browser viewport check, not a physical-phone performance benchmark.

## Measured rendering work

Final desktop samples: 1280 × 720 viewport, rendering pixel ratio 1.50, Golden hour, default Follow framing, stationary Motor at the landing (z = 0; x drifted from 0.05 to 0.15 m between captures). Each sample averages 60 frames. Ambient wildlife and traffic continue moving, so these are representative snapshots, not identical-time benchmark runs.

| Preset / pass | Draw calls | Triangles | CPU submission time |
| --- | ---: | ---: | ---: |
| Standard main | 337 | 1,587,101 | 2.74 ms |
| Standard reflection | 336 | 1,490,301 | 2.82 ms |
| Standard shadow | 134 | 1,028,837 | 0.69 ms |
| Standard total | 807 | 4,106,239 | 6.25 ms |
| High main | 325 | 983,287 | 7.34 ms |
| High reflection | 313 | 633,827 | 3.65 ms |
| High shadow | 100 | 360,543 | 1.43 ms |
| High total | 738 | 1,977,657 | 12.42 ms |

Both samples reported 60 fps locally. High still takes more CPU submission time despite fewer submitted triangles. Its materials, detailed subjects, larger reflection and shadow targets also cost more than Standard. These are not GPU timings or a promise of equivalent performance on other hardware.

The previous renderer counter omitted some nested/shadow work, so its approximately 2.2M-triangle / 663-draw reading is not directly comparable with the new totals. The new `data-render-passes` counter includes main, reflection and shadow work exactly once.

Deterministic geometry checks show the High forest uses 656,544 triangles in the main scene and 437,056 in its simplified reflection before camera culling: approximately 33% fewer. Near/mid foliage stays at 108/44 cards per tree. Four detailed traffic passengers can be replaced in the reflection with a net saving of 150,712 triangles. Crocodile batching reduces each detailed animal from 16 to 9 meshes without changing its 17,132 triangles, articulation or silhouette.

## Checks

- All 51 physics, traffic, rowing, human-rig, control and render-profile tests pass. All application modules pass syntax checks. The final crocodile-only change also passed the six fauna tests and unchanged-geometry checks across 80 animated poses.
- Rig tests check actual oar grips, blade recovery clearance and planted feet through paired/single strokes, mode transitions and repeated graphics changes. The final 0.9-second preparation measured under 1 mm grip error at the first automatic power stroke.
- Forest support coverage checks pass for 30,240 sampled points across near/mid geometry, above/below views and wind offsets. Reflection restoration, Standard fallback and failed-load cleanup checks pass.
- Reflection-hook tests cover 20 quality cycles and three exception paths. Boat material/geometry restoration survives 40 toggles. Pass-accounting tests cover nested renders and failures.
- No runtime or shader-compilation failures observed. The browser reports a non-fatal Three.js environment-map shader warning about tiny floating-point constants.

Standard remains the default on every fresh load. High is selected through More → Graphics → High. No unrelated project, domain or deployment was modified.

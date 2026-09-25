# High Graphics artistic review — 25 September 2026

This report records local validation before release. Run `node server.mjs` and open http://127.0.0.1:4173/. The previous cinematic review remains a historical record; this report concerns the subsequent artistic refinement.

## Matched visual evidence

Open [the comparison gallery](artifacts/artistic-review/index.html), or compare the original browser captures directly:

| View | Before | After |
| --- | --- | --- |
| Golden hour, Follow | [Before](artifacts/artistic-review/before-golden.jpg) | [After](artifacts/artistic-review/after-golden.jpg) |
| Golden hour, Bow | [Before](artifacts/artistic-review/before-bow.jpg) | [After](artifacts/artistic-review/after-bow.jpg) |
| Golden hour, Overhead | [Before](artifacts/artistic-review/before-overhead.jpg) | [After](artifacts/artistic-review/after-overhead.jpg) |
| Morning, Follow | [Before](artifacts/artistic-review/before-morning.jpg) | [After](artifacts/artistic-review/after-morning.jpg) |
| Developed Storm, Follow | [Before](artifacts/artistic-review/before-storm.jpg) | [After](artifacts/artistic-review/after-storm.jpg) |
| Moonlit Night, Follow | [Before](artifacts/artistic-review/before-night.jpg) | [After](artifacts/artistic-review/after-night.jpg) |

The baseline was copied before this pass began. An ignored local review server serves that frozen copy and the current application with the same visible review controls. It fixes the player at x=0, z=0, heading=0.13, simulation time=42 s and identical camera position/target arrays. Captures use a 1280 × 720 CSS viewport and 1280 × 720 drawing buffer, with native DPR 1. The interface is hidden through the existing H control. These JPEG screenshots have not been retouched. Traffic can differ because its independent routes run while each scene loads; these are matched camera/light/resolution comparisons, not identical traffic snapshots. The fixture is outside `dist/` and is not deployed.

## Artistic changes

- Built and inspected one complete shoreline section before applying it along the route. Three different mangrove growth habits vary trunk lean, branching, root curvature and crown spread. Shoreline foliage now connects selected trunks to damp mud without entering the navigable river. Root ankles emerge and bury at varied depths; the foreground uses irregular planting patches, supported leaves and debris, with cheaper overlapping forest silhouettes inland.
- Warm directional Golden-hour light contrasts with cooler fill; near-bank detail stays clearer than the distant atmosphere. Two cloud decks vary depth and illumination. Mist gathers in low patches. Moonlit Night has a restrained sky, one coherent moon/reflection direction and localized warm illumination from the boat's existing lamp.
- Six varied travelling wave components replace High's regular wave bands. A dense local water mesh resolves actual bow, side and stern displacement while remaining coarse offshore. CPU contact heights, vertex displacement and analytic normals share the same base and vessel fields, including reverse travel and traffic. Paddle contacts produce directional decaying packets; rain rings now come from actual falling drops, with varied lifetimes and moving rain patches instead of a persistent grid of identical rings.
- The boat retains its silhouette and dimensions but gains a closed 26 mm canopy shell, shaded underside, shaped cloth edges, seams and tension folds. Roughly 60 fitted deck boards introduce bevelled joints, staggered ends and restrained grain. Clothing has more volume and wrist twist is distributed through the forearms while preserving the exact hand targets, planted feet and shared oars.

## Motion and regression checks

Automatic Row, Pause/coast, Resume, Motor parking and all three cameras were exercised through the existing UI. Pausing finished the current stroke: subsequent diagnostics reported rest/active=false while the boat still coasted at 0.164 m/s. Motor settled to park=1 with exactly two paddles. High → Standard → High during the active journey retained Row, automatic cruise and the Follow camera; transition distances advanced from 128.74 m to 142.74 m without resetting. Live hand-target error stayed at numerical precision. [Rowing in motion](artifacts/artistic-review/rowing-live.jpg) shows the shared oars and spreading wake.

Golden hour, Morning, developed Storm and Moonlit Night were inspected, as were Bow and Overhead. Nearby boat/shoreline reflections and supporting vegetation remained present. No missing production assets or shader/runtime errors remained in the final scene. Standard restoration, the phone advisory and failure paths remain covered by existing tests; this pass was not tested on a physical phone.

The final pass also aligns passing vessels to the shared water height and damped surface tilt without changing their routes, speed, horizontal heading or passenger placement. Tests cover four cardinal headings, 30/60 Hz damping, pause stability and exact restoration of the original Standard motion. Matched [before](artifacts/artistic-review/before-standard.jpg) / [after](artifacts/artistic-review/after-standard.jpg) Standard captures retain the original player, forest, light and water appearance; ambient traffic differs. The field guide's mangrove, crocodile and expanded kingfisher images loaded successfully, and both bird recordings loaded after enabling sound. Mute was restored afterward.

All 89 automated tests pass across the existing suite and the added boat/water checks. Water tests differentiate the wake numerically at 840 forward/reverse samples and compare the CPU function with the actual scalar GLSL body. Integration tests exercise current wind/player/traffic contact heights, reverse travel and immediate traffic removal; 24 quality cycles each for desktop and phone restore byte-exact Standard geometry/heights, correct ripple limits and the same cached High mesh. Boat tests check bounded canopy thickness, fitted deck boards, lamp restoration, animated fabric and working-oar references. Application syntax and whitespace checks pass.

## Rendering cost and limitations

Measurements use the same Windows laptop as the previous review: Ryzen 7 8840HS with integrated Radeon 780M, ANGLE/Direct3D 11, Chrome 153. GPU execution timings are not available here; per-pass milliseconds below are **CPU submission times**, not GPU cost. Frame pacing comes from browser animation-frame intervals, including normal rendering and simulation work. It excludes initial asset loading and shader warm-up. No performance claim is made for untested hardware.

Final measurements are recorded in [measurements.json](artifacts/artistic-review/measurements.json).

The final moving Golden-hour run, including surface-following traffic, used a **1920 × 1080 viewport and drawing buffer, DPR 1**. Over 3,600 measured frames / 88.47 seconds it averaged **40.69 FPS**. Median interval was 17.0 ms, 95th percentile 33.6 ms, maximum 51.0 ms; 12 intervals exceeded 50 ms and none exceeded 100 ms. The last rolling reading was 33 FPS in a busier part of the creek. Instantaneous rates vary with nearby vegetation and traffic; this is not a 60 FPS claim. The six stationary art-comparison views at native 1280 × 720 reported 56–60 FPS.

An earlier extended run of the same art, before the final passing-boat alignment adjustment, measured 4,200 frames / 104.71 seconds at 40.11 FPS, with a 33.6 ms 95th percentile and 66.8 ms maximum. It progressed to z=−238 m with no interval above 100 ms. Both runs exclude loading/initial shader warm-up and show occasional longer frames rather than recurring long freezes.

The frozen original averaged **47.27 FPS** over 6,000 frames / 126.94 seconds at the same native 1080p resolution, start pose, Golden-hour preset, Follow camera and gentle-cruise controls. Its median was 16.8 ms, 95th percentile 33.5 ms and maximum 34.4 ms, with no intervals above 50 ms. It ran farther (z=−287 m), so the two averages are comparable route samples, not an identical-frame benchmark. The new art is slower and has occasional longer frames; no recurring long freezes were observed.

At the identical stationary Follow camera, native 1920 × 1080, the 60-frame submission samples were:

| Pass | Before calls / triangles | After calls / triangles | Before CPU | After CPU |
| --- | ---: | ---: | ---: | ---: |
| Main | 351 / 1,137,223 | 351 / 1,264,411 | 10.23 ms | 10.17 ms |
| Reflection | 320 / 597,493 | 323 / 641,805 | 6.11 ms | 8.80 ms |
| Shadow | 105 / 405,099 | 107 / 475,823 | 1.72 ms | 1.40 ms |
| Post | 4 / 4 | 4 / 4 | 0.08 ms | 0.08 ms |
| Total | 780 / 2,139,819 | 785 / 2,382,043 | 18.14 ms | 20.45 ms |

The corresponding rolling frame-rate readings were 50 FPS before and 44 FPS after. Small traffic/shadow-count differences remain even with the fixed camera. CPU samples are noisy and cannot isolate GPU effect costs: notably, 0.08 ms post submission does not mean the post-processing GPU work is free. The added scene detail has a measurable cost; it was retained for the visible silhouette, construction and water improvements within the requested integrated-GPU range.

High retains a 1536px reflection target, 3072px shadow target and full scene resolution. Reflection instance compaction removes invisible foliage and uses simpler roots/crowns; nearby low planting keeps a cheap reflection LOD. Small boat trim adds no extra shadow work beyond the existing fenders. The local water mesh has 131,072 triangles, with most detail concentrated within 58 m of the player. New forest geometry raises its pre-frustum main budget from about 879k to 982k triangles, while maintaining 114 forest draw calls. Reflected forest culling in the test Follow view saves about 368k submitted triangles.

This is still authored procedural real-time artwork. Leaves, clouds and wildlife remain stylized at close range; there is no volumetric cloud transport, bulk fluid simulation, caustics or physically complete wake persistence. The analytic wake follows the vessel rather than retaining a full historical fluid trail. Cached environment maps do not regenerate as clouds drift. The added point lamp uses no shadows, so its short-range light is an approximation. Screenshots alone cannot establish motion quality; the local preview is the place to judge that.

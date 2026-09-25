# High Graphics cinematic review — 25 September 2026

Local preview: http://127.0.0.1:4173/. This report records the earlier cinematic pass before release; the subsequent artistic refinement is documented in artistic-validation.md.

## Finished views

Captured through the existing Hide interface control, using the same Follow camera, stationary boat at the landing, and manual lighting choices. Ambient vessels, wildlife, surface motion and weather continue between captures. Screenshots are direct browser JPEG captures, without image editing.

- [Golden hour](artifacts/cinematic-review/golden-hour.jpg)
- [Morning](artifacts/cinematic-review/morning.jpg)
- [Storm](artifacts/cinematic-review/storm.jpg)
- [Moonlit Night](artifacts/cinematic-review/moonlit-night.jpg)
- [Phone warning, simulated](artifacts/cinematic-review/phone-warning.jpg)

The gallery uses a 1600 × 900 scene viewport. The browser's capture surface may crop its outer edge; all four use the same framing and capture size. Separate performance measurement below uses a full 1920 × 1080 drawing buffer. Raw scene diagnostics accompany the captures in [render-measurements.json](artifacts/cinematic-review/render-measurements.json).

## What changed

- Continuous terrain extends inland behind the original banks. Supporting trees, irregular overlapping leaf clusters, undergrowth and partially buried debris connect the canopy to the mud. One complete section was inspected in Follow, On the bow and Overhead before enabling the treatment throughout the creek. Root positions, river boundaries and navigation remain unchanged.
- Five coordinated High light states include the existing three choices plus Storm and Moonlit Night. The shared weather state drives foliage, rain, cloud/mist drift, wave strength, wet surfaces, lightning illumination and weather audio. Wetting and drying take time. Night and Blue hour preserve readable boat and bank detail.
- Full-resolution HDR rendering adds restrained contact shading, occluded directional shafts, selective highlight bloom and filmic tone mapping. The HTML interface stays outside post-processing. High keeps the requested display resolution, capped at DPR 2, without frame-rate-driven downscaling.
- Water retains its turbid estuary appearance, filtered live reflections and single existing velocity-driven wake. Wind and buoyancy share the same wave amplitude. Real blade contacts still emit the oar ripples and pooled splashes; recovery does not invent underwater contacts. Rain adds localized surface contacts.
- The existing skinned boatman gains coordinated hip movement and planted-leg solving, with the same real oars and shared stroke clock. Clothing volume, wood, cloth, rubber, rope, painted surfaces and wetness response are separated. Perched birds and swimming crocodiles use their actual perch/water contact planes.
- The bow camera clears the pennant, transitions aim smoothly, and avoids passing through the roof. Night identity text remains readable. Hide interface's return button fades while idle and returns on pointer/touch movement or keyboard focus; H still restores controls.

## Browser checks completed

- Ran the existing `node server.mjs` launch workflow; no build or dependency installation was needed.
- Inspected Golden hour, Morning, Blue hour, developed Storm and Moonlit Night. Rain reached full strength, wetness rose gradually to 1, storm strike counters advanced, and surfaces then dried gradually after changing conditions. Verified no unexpected shader or runtime errors in the finished app.
- Inspected the finished scene in all three camera modes and while moving between them. Main and reflected foliage remained visible after reflection-instance culling; nearby boat details and the forest silhouette remained intact with the final reflection/shadow targets.
- Completed a representative journey past z = −205 m, crossing multiple forest sections. Automatic Row, steering during automatic rowing, manual Q takeover, Pause, Resume, coast, and Motor stowing worked. Paused/coasting diagnostics showed `active:false`; Motor settled with `park:1`, `paddles:2`, and no active rowing.
- Switched High → Standard → High during the active journey around z = −124 to −126 m. Mode remained Row, cruise remained enabled, camera remained Follow, and distance advanced from about 128.6 to 129.6 m instead of resetting. Oar contact remained tied to the current stroke.
- Tested nature-sound enable/mute; both licensed recordings loaded after the gesture. Weather audio uses the same master gain. Automated audio checks separately cover delayed thunder, silence while muted, and no AudioContext creation before consent. This is not an acoustic quality comparison on external speakers.
- Reopened the field guide and expanded the white-throated kingfisher entry. Its photograph and the mangrove/crocodile photographs completed loading; unopened bird entries retain their existing lazy-loading behavior and attribution.
- At 390 × 844, a temporary local fixture supplied the phone flag while preserving the production warning/control code. The exact warning fit, Standard remained active with no High resources constructed before a choice, Keep Standard worked, retry did not repeat the warning during that visit, and a fresh tab's Continue with High loaded High. A narrow desktop fixture still reported `phone:false`. No physical phone was tested.
- Temporary local fixtures deliberately returned 404 for High bark maps and simulated unavailable HDR capability. Both left Standard available with an explanation. The deliberate 404s are expected test failures, not broken production paths.
- Used the real `WEBGL_lose_context` extension through temporary visible test controls while rowing. The interrupted journey paused, recovery resumed it in Standard without resetting position/mode, profiling rebound to Three's restored shadow object, and High loaded successfully afterward. Test controls and forced errors are served only by an ignored development fixture, never by `dist/`.

## Actual rendering measurements

Windows laptop: AMD Ryzen 7 8840HS with integrated Radeon 780M; browser reports AMD Radeon(TM) Graphics through ANGLE / Direct3D 11, driver 32.0.31019.2002. Browser user agent reports Chrome 153.0.0.0. These are integrated laptop graphics, not a discrete desktop GPU benchmark.

Final High Golden-hour sample, normal Follow view at the landing, 1920 × 1080 scene buffer, 60-frame pass averages:

| Pass | Draw calls | Triangles | CPU submission |
| --- | ---: | ---: | ---: |
| Main | 351 | 1,137,223 | 11.77 ms |
| Reflection | 320 | 597,673 | 8.91 ms |
| Shadow | 104 | 404,267 | 2.06 ms |
| Post | 4 | 4 | 0.09 ms |
| Total | 779 | 2,139,167 | 22.83 ms |

Observed frame rate in this final sample was **40 FPS**. The earlier 2048px reflection / 4096px shadow budget measured 35–38 FPS in the four 1080p lighting samples. Ambient traffic and wildlife vary, so these are representative samples rather than a controlled identical-frame speedup claim. The final targets are 1536px reflections and 3072px shadows; main scene resolution remains unchanged. The 68 m stabilized shadow volume resolves about 2.2 cm per texel.

CPU submission timings are **not GPU execution times**. In particular, the small post CPU number does not mean its GPU work is free. This machine did not reach the approximate 60 FPS High target at 1080p; capable discrete graphics and physical phones remain untested. Standard remains the default for lighter hardware.

The final reflected forest sample culled 2,175 of 3,728 candidate instances and avoided submitting 348,522 triangles. This excludes existing renderer-level frustum culling and is not itself an FPS claim. Main matrices and foliage geometry are unchanged by reflection compaction. Enclosed support cores no longer cast redundant shadows; actual canopy shadow geometry remains.

## Automated and failure coverage

All **72 automated tests passed**, including existing physics, traffic, rowing and propulsion behavior, exact hand/foot contact, forest terrain continuity and reflection restoration, five-state weather/wetting/audio, phone detection, exclusive pass profiling, and HDR/post failure fallback. Application module syntax and whitespace checks passed.

Additional checks validate original shadow hooks after context restoration, missing float support, oversized targets, incomplete framebuffers, thrown target allocations, and failed post shaders. Unsupported post falls back to direct rendering at the current scene resolution; unsupported High sky lighting leaves Standard selected before expensive assets load.

The scene remains a procedural, painterly real-time interpretation. It does not simulate full fluid dynamics or volumetric cloud transport. Cached environmental lighting follows the selected weather preset; slowly drifting visible clouds do not rebuild the lighting probes every frame. Screenshots cannot establish motion quality or performance on other hardware.

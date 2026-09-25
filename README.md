# Into Bhitarkanika

A self-contained Three.js riverboat experience, set in an artistic interpretation of the mangrove creeks of Bhitarkanika, Odisha.

**Live site:** [into-bhitarkanika.github.io](https://into-bhitarkanika.github.io/)

## Run

Requires Node.js 20 or newer. No dependency installation or build is required.

```sh
npm start
```

Open http://127.0.0.1:4173/. The server binds only to your computer. The complete static application is in `dist/`; it can also be served by any static host. Three.js r183.2 and its water normal map are included locally.

## GitHub Pages

The canonical repository is [into-bhitarkanika/into-bhitarkanika.github.io](https://github.com/into-bhitarkanika/into-bhitarkanika.github.io), and its independent organization site is [https://into-bhitarkanika.github.io/](https://into-bhitarkanika.github.io/).

The [Pages workflow](.github/workflows/pages.yml) publishes `dist/` when `main` is updated in that canonical repository. It can also be run from **Actions → Deploy GitHub Pages → Run workflow** on its `main` branch. The deployment job is restricted to that exact repository and branch, so copies and forks cannot deploy through this workflow. In the canonical repository's **Settings → Pages**, **GitHub Actions** is the publishing source. The deployment's `github-pages` environment shows the live URL.

[Kenshi0905/into-bhitarkanika](https://github.com/Kenshi0905/into-bhitarkanika) is a source mirror with GitHub Pages disabled.

There is no build or dependency installation step. Application modules, textures, and recordings use relative paths. Only `dist/` is uploaded; development scripts and research notes remain in the repository. GitHub Pages serves the site publicly.

## Controls

- **W / S** or **up / down**: accelerate / reverse.
- **A / D** or **left / right**: steer.
- **R**: switch between motor and rowing.
- Hold **Q / E** for the left / right oar. Hold **Space** or **W** to row both oars, or tap for one complete stroke. **Space** brakes in motor mode.
- **C**: trailing, bow, and overhead cameras.
- **H**: hide or restore the interface.
- Drag the scene to look around; scroll or pinch to zoom.
- Selecting **Row** starts gentle repeating strokes. **Play / Pause** pauses or resumes the selected mode without switching it. Steering remains available during automatic rowing; manual oar or braking input takes over until Play is selected again. In Motor, Play starts the gentle creek cruise and manual navigation cancels it.
- **More** contains graphics, camera, lighting, hide interface, reset and help. Lighting cycles Golden hour, Morning mist and Blue hour; High adds Storm and Moonlit Night to the same manual control. Weather never forces an automatic time cycle.
- The sound button enables two real, licensed kingfisher recordings with spatial positioning, plus synthesized wind and water. High's storms add rain and delayed thunder through the same mute control. Daytime kingfisher calls are quiet during heavy rain and Moonlit Night. Calls are intermittent; audio starts only after a click.
- Touch devices get on-screen steering, throttle and rowing controls, with a compact retained minimap.
- **Field guide** opens facts about the wetland, crocodiles and five bird species, with research links, audio previews and recording attribution. The journey pauses while the guide is open.

## Water and motion

The water renders an actual mirrored view of the scene into a 1024px reflection target (512px on phones). It combines four scales of scrolling surface detail with three travelling waves, analytic wave derivatives, Fresnel reflection, and sunlight. The player and passing boats create wakes; oar strokes and swimming crocodiles emit expanding, decaying ripples.

Boat handling uses fixed-step integration, forward and lateral drag, speed-dependent rudder authority, smooth catch/power/recovery rowing cycles, and damped buoyancy. Paired strokes synchronize, while individual oars apply gradual opposing turns. Rendered position is interpolated between simulation steps. Collision samples protect the bow, centre, and stern against both banks. This is a real-time visual and handling approximation, not a computational fluid dynamics model. Bulk fluid flow, refraction and coupled turbulence are not simulated.

Selecting **Row** prepares the boatman at the stern and starts a repeating rhythm through the existing rowing simulation. Automatic and manual input share the same stroke scheduler, so they cannot overlap. Pause lets the active stroke finish and clears queued strokes; Resume retains Row. Both graphics presets share one pair of working oars and the simulation's catch, power, release and recovery clock. Articulated arms follow the handles, feet stay planted, and ripples originate at each blade's actual water contact. High connects the shoulders, elbows, wrists, spine and hips, with leg posing that keeps each sole's position and orientation planted while weight shifts. Small pooled droplets appear only at actual blade contact. Switching to Motor smoothly lifts the blades, releases the handles and parks the same oars lengthwise alongside the gunwales. Coasting does not keep the character rowing. Graphics changes preserve the current stroke, boat position and journey.

The environment includes mangroves with individual folded leaves, irregular branches, tapered prop roots, breathing roots, moving foliage, textured wet banks, a wooden landing, five basking crocodiles, and three swimming crocodiles with articulated tails. Crocodiles are ambient wildlife; there is no combat or animal interaction.

Twenty-two modelled birds represent white-throated, common and black-capped kingfishers, little egrets and Brahminy kites. All five species are documented in Bhitarkanika. Calls are assigned only to the two species with licensed recordings. The recordings were not made in the park; provenance is disclosed in the field guide and [research notes](birds-research.md).

Three passenger boats and an occasional police patrol travel the creek, slow down and steer around nearby vessels. The patrol and routes are fictional ambient traffic. Water shows each vessel's wake, and the minimap marks them. In High, their height and damped tilt follow the same water surface as the player while their routes and passenger positions remain unchanged.

Standard's dense forest uses six overlapping depth bands of opaque, leaf-textured canopy volumes and dark undergrowth behind the detailed shoreline trees. These inexpensive shapes remain three-dimensional from overhead and in reflections. Distant individual-leaf crowns switch to simpler volumes with hysteresis to prevent repeated switching; distant roots and forest sections are culled. Instancing batches repeated geometry. Standard uses reduced foliage, 512px reflections and 1024px shadows on phones, including landscape phones; only Standard adapts scene resolution on slower devices.

The route is approximately 1.2 km and is designed for exploration; it is not a reconstruction of surveyed geography. Desktop graphics hardware is recommended. A WebGL 2 browser and hardware acceleration are required.

## Graphics modes

Every visit starts in **Standard**, keeping the lightweight forest and wildlife. **More → Graphics → High** loads the additional local models, textures, sky, weather and post-processing modules on demand, with visible progress and the option to return to Standard. High is designed for capable desktops and laptops, including high-density displays: its scene pixel ratio follows the display up to a cap of 2 and is not automatically lowered when frame rate drops. The HTML interface stays at the browser's native display resolution. High is original real-time artwork inspired by Bhitarkanika, not a claim of photorealism or surveyed reconstruction.

Before loading High on a detected phone, the graphics panel shows: “High Graphics is designed for desktops and laptops. On phones, visuals and performance may vary, and your device may get warm. Standard is recommended.” Choose **Continue with High** or **Keep Standard**. Either choice acknowledges the advice once for the current tab session; it does not repeatedly interrupt that visit, and switching back remains available. Detection uses device and input signals, not just a narrow desktop window. The graphics choice itself resets to Standard on reload.

High adds layered procedural skies and matching environmental lighting, height-aware creek haze, 1536px water reflections, and up to 3072px shadows within hardware limits. Five manual presets coordinate the visible sky, key light, fog, water tint and cached environment: warm Golden hour, soft Morning mist, readable Blue hour, wind-driven Storm, and Moonlit Night with an aligned moon and restrained stars. Five environment maps are prepared once when High loads; cloud movement does not regenerate them every frame.

Storm drives local rain streaks, bounded instanced water-contact rings and occasional lightning that illuminates both the sky and the scene. One shared wind state moves foliage, cloud layers, low haze, rain, canvas slack and the water surface. Surface waves and boat buoyancy use the same water-height function. Materials wet gradually during rain and dry gradually after it, with different responses for wood, cloth, rope, rubber, paint, leaves, skin and wildlife. Rain stays outside the player's covered canopy, surface rings avoid the boat footprint, and rain geometry is omitted from the reflection pass. Synthesized rain and delayed thunder follow the existing sound toggle and browser audio restrictions.

- People use an anatomical rig with separate, authored collared shirts and trousers, modeled folds and cuffs, skin and fabric maps, hair, and sandals. Skin and fabric retain readable albedo under the scene's ambient light. The boatman's coordinated hip, torso and shoulder motion follows the working oars, with fingers curled around the handles and fixed sole contacts maintained through the weight shift. Seated traffic passengers face inward with their feet and seat fitted to the existing benches. Resting and idle poses retain planted feet.
- Boat construction includes a 26 mm cloth canopy shell with a shaded underside, rolled edges, tension folds and sewn seams; about 60 fitted, staggered deck boards have bevelled joints and varied grain. Wind moves the slack cloth between anchored supports. Rubber, rope, paint and timber retain distinct roughness and wetness. The existing lamp gently lights the interior at night. Dimensions, seating, sole contacts and the shared working oars remain intact; forearm twist is distributed without moving the hand targets.
- High water combines six irregular travelling components with coherent directional, scale and amplitude variation. A denser local mesh visibly displaces at the bow, hull shoulders and spreading stern wake, becoming coarse offshore. Analytical gradients, buoyancy and actual blade contacts use the same base and vessel displacement fields, including reverse travel and traffic. Real paddle contacts seed directional, decaying ripple packets; actual falling drops seed transient rain rings. The reflection target remains 1536px, with filtered distant detail and nearby shoreline reflections.
- Three mangrove growth habits vary lean, age, trunk division, crown spread and curved branching roots. Grounded low/middle foliage patches connect selected trunks to irregular damp silt, partly buried debris and root ankles. They retain openings and stay outside the existing waterway. Continuous inland terrain and economical background silhouettes support density. Mipmaps and connected leaf coverage limit sparkle; selective leaf transmission follows real incident light and its shadows. Reflections use simpler trunks, fewer leaf cards and coarse nearby roots, plus per-instance reflected-camera culling. Fine roots, debris and distant shadow casters are omitted where they cannot improve the image, then main-view geometry and visibility are restored exactly.

High modules are separated into `high-graphics.js`, `high-fauna.js`, `high-forest.js`, `high-boat.js`, `high-sky.js`, `high-atmosphere.js`, `high-weather.js`, and `high-post.js`. Materials and assets are cached for repeat switching; Standard restores its original materials, models, shader hooks and environment. Quality changes retain the journey, mode, cruise setting and selected camera. Follow, On the bow and Overhead retain their framing and controls.

High's small, dependency-free post-processing pipeline retains the full scene resolution and adds four passes: selective bright-highlight extraction, two quarter-resolution highlight blurs, and one full-resolution composite. The composite applies restrained depth-contact shading, light shafts sampled against actual scene depth, and a gentle filmic grade with tone mapping applied once. The main image is never blurred; there is no depth-of-field or motion blur. The interface does not pass through these effects.

Unsupported HDR capability is detected before High assets load, leaving Standard available. Failed High asset loading restores Standard and allows retry. Unsupported render-target sizes, framebuffer failures or a failed post-processing shader fall back to direct rendering at the current scene resolution. A lost graphics context pauses the journey; when the browser restores it, the application releases the old High resources and returns to Standard while retaining journey state. The recovery message provides a reload option if the browser cannot reconnect.

Shadows use a tighter, texel-stabilized light volume, soft filtering, restrained surface bump maps, and updates synchronized to moving geometry.

## References and assets

- [Bhitarkanika boat service on Google Maps](https://www.google.com/maps/search/Bhitarkanika+National+Park+boating/): visual reference for muddy tidal water, banks, mangrove foliage and roots. Google Maps images are not redistributed or used as textures.
- [Odisha Tourism — Bhitarkanika Nature Camps](https://odishatourism.gov.in/content/tourism/en/experience/activities/boat-riding/bhitarkanika-nature-camps.html): setting, boating, mangroves, and saltwater crocodiles.
- [Meng To — Sakura River Valley](https://valley.mengto.here.now/): inspiration for the trailing camera, contemplative atmosphere, and reflective water. No source or assets copied.
- [Three.js](https://threejs.org/): r183.2, MIT licence in `dist/vendor/LICENSE-three.txt`. Water normal map from [the official Three.js examples](https://threejs.org/examples/textures/waternormals.jpg).
- Standard models and canvas material textures are generated in code. High adds a CC0 MakeHuman anatomical mesh/rig, skin and authored clothing, photographed Poly Haven bark, procedural skies and enhanced wildlife. Sources, authors, licenses and adaptations are in `dist/assets/high/{fauna,forest,sky}/CREDITS.md`; the retained, credited HDR file is a prior asset and is no longer loaded. Boat material maps, skies and cached environment lighting are generated locally when High loads. Typefaces: DM Sans and Libre Caslon Display, loaded through Google Fonts with local system-font fallbacks.
- Bird recordings: Shajiarikkad's white-throated kingfisher (CC BY-SA 3.0) and Marie-Lan Taÿ Pamart's common kingfisher (CC BY-SA 4.0). Full links, locations, playback adjustments and licenses are in `dist/assets/audio-credits.json` and the field guide. Audio files retain their individual Creative Commons licenses.
- Field-note photographs: seven local Wikimedia Commons images with individual attribution and license links beneath each image; full source metadata and adaptations are in `dist/assets/field-guide/CREDITS.md`. The mangrove and crocodile photos document Bhitarkanika; the bird photographs are labeled species references with their actual locations. Photos load only after opening the guide and expanding a species.

## Verification

`npm test` runs 89 tests across physics, traffic, rowing, water, boat construction, the human rig, forest, weather/audio, propulsion controls, device detection, render profiling and post-processing. They cover automatic/manual arbitration, pause/resume, blade clearance, palm contact, planted feet, exact Standard restoration, full-hull bank collisions, frame-rate independence, CPU/shader wave and wake agreement, differentiated wake normals, terrain-grounded planting, reflection restoration, wetting/drying, spatial rain, shared light directions, audio mute restrictions, phone detection and rendering fallbacks. `npm run check` checks application module syntax. The latest matched images and measured limitations are documented in [artistic-validation.md](artistic-validation.md).

The scene canvas exposes `data-render-passes` with a rolling 60-frame average of main-view, reflection, shadow and post-processing draws, triangles and CPU submission time. Counts include nested renders and shadows exactly once. Submission timings are **not GPU timings** and frame rates depend on device, camera, resolution and nearby traffic. Browser validation uses ordinary camera framing and the existing controls; a phone-sized browser viewport is not a physical-phone performance test. Live measurements and screenshot findings belong in the separate validation report rather than serving as a universal performance promise.

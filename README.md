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
- **More** contains graphics, camera, lighting, hide interface, reset and help. Lighting cycles golden hour, morning mist and blue hour.
- The sound button enables two real, licensed kingfisher recordings with spatial positioning, plus synthesized wind and water. Calls are intermittent. Audio starts only after a click.
- Touch devices get on-screen steering, throttle and rowing controls, with a compact retained minimap.
- **Field guide** opens facts about the wetland, crocodiles and five bird species, with research links, audio previews and recording attribution. The journey pauses while the guide is open.

## Water and motion

The water renders an actual mirrored view of the scene into a 1024px reflection target (512px on phones). It combines four scales of scrolling surface detail with three travelling waves, analytic wave derivatives, Fresnel reflection, and sunlight. The player and passing boats create wakes; oar strokes and swimming crocodiles emit expanding, decaying ripples.

Boat handling uses fixed-step integration, forward and lateral drag, speed-dependent rudder authority, smooth catch/power/recovery rowing cycles, and damped buoyancy. Paired strokes synchronize, while individual oars apply gradual opposing turns. Rendered position is interpolated between simulation steps. Collision samples protect the bow, centre, and stern against both banks. This is a real-time visual and handling approximation, not a computational fluid dynamics model. Refraction, full fluid displacement, and complex hydrodynamic interactions are not simulated.

Selecting **Row** prepares the boatman at the stern and starts a repeating rhythm through the existing rowing simulation. Automatic and manual input share the same stroke scheduler, so they cannot overlap. Pause lets the active stroke finish and clears queued strokes; Resume retains Row. Both graphics presets share one pair of working oars and the simulation's catch, power, release and recovery clock. Articulated arms follow the handles, feet stay planted, and ripples originate at each blade's actual water contact. High adds anatomical hand and shoulder posing and small pooled droplets. Switching to Motor smoothly lifts the blades, releases the handles and parks the same oars lengthwise alongside the gunwales. Coasting does not keep the character rowing. Graphics changes preserve the current stroke, boat position and journey.

The environment includes mangroves with individual folded leaves, irregular branches, tapered prop roots, breathing roots, moving foliage, textured wet banks, a wooden landing, five basking crocodiles, and three swimming crocodiles with articulated tails. Crocodiles are ambient wildlife; there is no combat or animal interaction.

Twenty-two modelled birds represent white-throated, common and black-capped kingfishers, little egrets and Brahminy kites. All five species are documented in Bhitarkanika. Calls are assigned only to the two species with licensed recordings. The recordings were not made in the park; provenance is disclosed in the field guide and [research notes](birds-research.md).

Three passenger boats and an occasional police patrol travel the creek, slow down and steer around nearby vessels. The patrol and routes are fictional ambient traffic. Water shows each vessel's wake, and the minimap marks them.

The dense forest uses six overlapping depth bands of opaque, leaf-textured canopy volumes and dark undergrowth behind the detailed shoreline trees. These inexpensive shapes remain three-dimensional from overhead and in reflections. Distant individual-leaf crowns switch to simpler volumes with hysteresis to prevent repeated switching; distant roots and forest sections are culled. Instancing batches repeated geometry. Phones, including landscape phones, use reduced foliage, 512px reflections and 1024px shadows; resolution adapts on slower devices.

The route is approximately 1.2 km and is designed for exploration; it is not a reconstruction of surveyed geography. Desktop graphics hardware is recommended. A WebGL 2 browser and hardware acceleration are required.

## Graphics modes

Every visit starts in **Standard**, keeping the lightweight forest and wildlife. **More → Graphics → High** loads the additional local assets on demand, with visible progress and the option to return to Standard. No High-mode module or texture loads during an ordinary Standard visit.

High adds layered procedural skies and matching environmental lighting, height-aware creek haze, 2048px water reflections, and 4096px shadows. Golden hour, morning mist and blue hour each have a coherent sky, visible sun, direct light, fog and cached environment. Blue hour places the sun below the horizon. High requires more graphics memory and processing power. Scene detail and render resolution still adapt; this is a real-time interpretation rather than a claim of photorealism. The graphics choice resets to Standard on reload.

- People use an anatomical rig with separate, authored collared shirts and trousers, modeled folds and cuffs, skin and fabric maps, hair, and sandals. Skin and fabric retain readable albedo under the scene's ambient light. The boatman's shoulders, elbows, palms and torso follow the working oars, with fingers curled around the handles. Posed soles meet the decks; seated traffic passengers face inward with their feet and seat fitted to the existing benches. Restrained idle movement leaves planted legs fixed.
- Boat materials use filtered timber grain and varied boards, matte canvas with a shallow sag between its existing ribs, rubber tires, fine seams, and rope detail. Small contact shadows ground seats, supports and feet. Original boat dimensions and seating remain intact.
- Water gains coherent surface detail, rough filtered live reflections, moving sediment variation, restrained sun highlights, and hull contact. Reflection strength depends on viewing angle, while normal-dependent illumination retains ripple shading from Overhead. High's single existing wake field follows actual signed velocity and the 15 m hull, including reverse travel. Broader stern disturbance and bow shoulders fade with speed and distance without a bright foam trail.
- Forest crowns use smaller overlapping twig clusters with recessed interior supports, matte leaf shading, photographed bark, wet silt, and cheaper geometry with distance. Mipmaps and neutral material tints prevent excessive sparkle and compounded darkening. Distant silhouettes use smooth canopy aggregates while dropping individual leaf cards. Root feet and tidal silt darken gradually at the waterline. Reflections temporarily use fewer leaf cards, simpler trunks and nearby coarse prop roots, then restore the main view exactly.

High modules are separated into `high-graphics.js`, `high-fauna.js`, `high-forest.js`, `high-boat.js`, `high-sky.js`, and `high-atmosphere.js`. Materials and assets are cached for repeat switching; Standard restores its original materials, models and environment. Quality changes retain the journey, mode, cruise setting and selected camera. Follow, On the bow and Overhead keep their existing camera behavior. A failed High asset load restores Standard and permits retry. No postprocessing dependency, depth-of-field blur or motion blur is added.

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

`npm test` runs the physics, traffic, rowing, human rig, propulsion control and render-profile tests. They cover automatic/manual arbitration, pause/resume, blade clearance, palm contact, planted feet, quality transitions, full-hull bank collisions, traffic stability, frame-rate independence and exclusive pass accounting. `npm run check` checks application module syntax.

The scene canvas exposes `data-render-passes` with a rolling 60-frame average of main-view, reflection and shadow draws, triangles and CPU submission time. Counts include nested renders and shadows exactly once. Submission timings are **not GPU timings** and frame rates depend on device, camera, resolution and nearby traffic. Browser validation uses ordinary camera framing and the existing controls; a phone-sized browser viewport is not a physical-phone performance test.

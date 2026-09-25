# Into Bhitarkanika

A self-contained Three.js riverboat experience, set in an artistic interpretation of the mangrove creeks of Bhitarkanika, Odisha.

## Run

Requires Node.js 20 or newer. No dependency installation or build is required.

```sh
npm start
```

Open http://127.0.0.1:4173/. The server binds only to your computer. The complete static application is in `dist/`; it can also be served by any static host. Three.js r183.2 and its water normal map are included locally.

## GitHub Pages

The [Pages workflow](.github/workflows/pages.yml) publishes `dist/` whenever `main` is updated. It can also be run from **Actions → Deploy GitHub Pages → Run workflow** on `main`. In the repository's **Settings → Pages**, choose **GitHub Actions** as the publishing source. The deployment's `github-pages` environment shows the live URL.

There is no build or dependency installation step. Application modules, textures, and recordings use relative paths, so the site works under a repository path such as `/into-bhitarkanika/`. Only `dist/` is uploaded; development scripts and research notes remain in the repository. GitHub Pages serves the site publicly.

## Controls

- **W / S** or **up / down**: accelerate / reverse.
- **A / D** or **left / right**: steer.
- **R**: switch between motor and rowing.
- **Q / E**: left / right oar. **Space** rows both oars, or brakes in motor mode.
- **C**: trailing, bow, and overhead cameras.
- **H**: hide or restore the interface.
- Drag the scene to look around; scroll or pinch to zoom.
- The play button starts a gentle cruise along the designed creek. Manual navigation cancels it.
- **More** contains camera, lighting, hide interface, reset and help. Lighting cycles golden hour, morning mist and blue hour.
- The sound button enables two real, licensed kingfisher recordings with spatial positioning, plus synthesized wind and water. Calls are intermittent. Audio starts only after a click.
- Touch devices get on-screen steering, throttle and rowing controls, with a compact retained minimap.
- **Field guide** opens facts about the wetland, crocodiles and five bird species, with research links, audio previews and recording attribution. The journey pauses while the guide is open.

## Water and motion

The water renders an actual mirrored view of the scene into a 1024px reflection target (512px on phones). It combines four scales of scrolling surface detail with three travelling waves, analytic wave derivatives, Fresnel reflection, and sunlight. The player and passing boats create wakes; oar strokes and swimming crocodiles emit expanding, decaying ripples.

Boat handling uses fixed-step integration, forward and lateral drag, speed-dependent rudder authority, independent rowing impulses, and damped buoyancy. Collision samples protect the bow, centre, and stern against both banks. This is a real-time visual and handling approximation, not a computational fluid dynamics model. Refraction, full fluid displacement, and complex hydrodynamic interactions are not simulated.

The environment includes mangroves with individual folded leaves, irregular branches, tapered prop roots, breathing roots, moving foliage, textured wet banks, a wooden landing, five basking crocodiles, and three swimming crocodiles with articulated tails. Crocodiles are ambient wildlife; there is no combat or animal interaction.

Twenty-two modelled birds represent white-throated, common and black-capped kingfishers, little egrets and Brahminy kites. All five species are documented in Bhitarkanika. Calls are assigned only to the two species with licensed recordings. The recordings were not made in the park; provenance is disclosed in the field guide and [research notes](birds-research.md).

Three passenger boats and an occasional police patrol travel the creek, slow down and steer around nearby vessels. The patrol and routes are fictional ambient traffic. Water shows each vessel's wake, and the minimap marks them.

The dense forest uses six overlapping depth bands of opaque, leaf-textured canopy volumes and dark undergrowth behind the detailed shoreline trees. These inexpensive shapes remain three-dimensional from overhead and in reflections. Distant individual-leaf crowns switch to simpler volumes with hysteresis to prevent repeated switching; distant roots and forest sections are culled. Instancing batches repeated geometry. Phones, including landscape phones, use reduced foliage, 512px reflections and 1024px shadows; resolution adapts on slower devices.

The route is approximately 1.2 km and is designed for exploration; it is not a reconstruction of surveyed geography. Desktop graphics hardware is recommended. A WebGL 2 browser and hardware acceleration are required.

## References and assets

- [Bhitarkanika boat service on Google Maps](https://www.google.com/maps/search/Bhitarkanika+National+Park+boating/): visual reference for muddy tidal water, banks, mangrove foliage and roots. Google Maps images are not redistributed or used as textures.
- [Odisha Tourism — Bhitarkanika Nature Camps](https://odishatourism.gov.in/content/tourism/en/experience/activities/boat-riding/bhitarkanika-nature-camps.html): setting, boating, mangroves, and saltwater crocodiles.
- [Meng To — Sakura River Valley](https://valley.mengto.here.now/): inspiration for the trailing camera, contemplative atmosphere, and reflective water. No source or assets copied.
- [Three.js](https://threejs.org/): r183.2, MIT licence in `dist/vendor/LICENSE-three.txt`. Water normal map from [the official Three.js examples](https://threejs.org/examples/textures/waternormals.jpg).
- Boat, environment, wildlife, and canvas material textures are generated in code. Typefaces: DM Sans and Libre Caslon Display, loaded through Google Fonts with local system-font fallbacks.
- Bird recordings: Shajiarikkad's white-throated kingfisher (CC BY-SA 3.0) and Marie-Lan Taÿ Pamart's common kingfisher (CC BY-SA 4.0). Full links, locations, playback adjustments and licenses are in `dist/assets/audio-credits.json` and the field guide. Audio files retain their individual Creative Commons licenses.

## Verification

`npm test` runs ten tests covering player physics, rowing, full-hull bank collisions, traffic stability, avoidance and frame-rate independence. `npm run check` checks application syntax. Browser verification covers rendering, cruising, rowing, camera changes, atmosphere, decoded bird recordings, the guide, reset and responsive layouts.

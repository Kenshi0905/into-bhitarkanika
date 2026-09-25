# Into Bhitarkanika

A self-contained Three.js riverboat experience, set in an artistic interpretation of the mangrove creeks of Bhitarkanika, Odisha.

## Run

Requires Node.js 20 or newer. No dependency installation or build is required.

```sh
npm start
```

Open http://127.0.0.1:4173/. The server binds only to your computer. The complete static application is in `dist/`; it can also be served by any static host. Three.js r183.2 and its water normal map are included locally.

## Controls

- **W / S** or **up / down**: accelerate / reverse.
- **A / D** or **left / right**: steer.
- **R**: switch between motor and rowing.
- **Q / E**: left / right oar. **Space** rows both oars, or brakes in motor mode.
- **C**: trailing, bow, and overhead cameras.
- **H**: hide or restore the interface.
- Drag the scene to look around; scroll to zoom.
- **Let it drift** follows the designed creek. Steering or moving manually cancels it.
- The time button cycles golden hour, morning mist, and blue hour.
- Nature sounds are synthesized locally and require a click to enable.
- Touch devices get on-screen steering and rowing controls.

## Water and motion

The water renders an actual mirrored view of the scene into a 1024px reflection target. It combines four scrolling samples of the Three.js water normal texture with three travelling surface waves, analytic wave derivatives, Fresnel reflection, and sunlight. Boat speed creates a V wake and stern turbulence; oar strokes and swimming crocodiles emit expanding, decaying ripples.

Boat handling uses fixed-step integration, forward and lateral drag, speed-dependent rudder authority, independent rowing impulses, and damped buoyancy. Collision samples protect the bow, centre, and stern against both banks. This is a real-time visual and handling approximation, not a computational fluid dynamics model. Refraction, full fluid displacement, and complex hydrodynamic interactions are not simulated.

The environment includes instanced mangroves, prop roots, breathing roots, moving foliage, birds, a wooden landing, five basking crocodiles, and three swimming crocodiles with articulated tails. Crocodiles are ambient wildlife; there is no combat or animal interaction.

The route is approximately 1.2 km and is designed for exploration; it is not a reconstruction of surveyed geography. Desktop graphics hardware is recommended. A WebGL 2 browser and hardware acceleration are required.

## References and assets

- [Bhitarkanika boat service on Google Maps](https://www.google.com/maps/search/Bhitarkanika+National+Park+boating/): visual reference for muddy tidal water, banks, mangrove foliage and roots. Google Maps images are not redistributed or used as textures.
- [Odisha Tourism — Bhitarkanika Nature Camps](https://odishatourism.gov.in/content/tourism/en/experience/activities/boat-riding/bhitarkanika-nature-camps.html): setting, boating, mangroves, and saltwater crocodiles.
- [Meng To — Sakura River Valley](https://valley.mengto.here.now/): inspiration for the trailing camera, contemplative atmosphere, and reflective water. No source or assets copied.
- [Three.js](https://threejs.org/): r183.2, MIT licence in `dist/vendor/LICENSE-three.txt`. Water normal map from [the official Three.js examples](https://threejs.org/examples/textures/waternormals.jpg).
- Boat, environment, wildlife, and canvas material textures are generated in code. Typefaces: DM Sans and Libre Caslon Display, loaded through Google Fonts with local system-font fallbacks.

## Verification

`npm test` checks acceleration, coasting, braking, reverse, rudder response, rowing cooldown/torque, full-hull bank collisions, integration stability, and reset. `npm run check` checks application syntax. Browser verification covers rendering, cruising, rowing, camera changes, atmosphere, sounds, reset, and responsive layouts.

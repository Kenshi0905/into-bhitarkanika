# Bhitarkanika birds, field guide and audio

Checked 25 September 2026. Scene geography/animal placements are an artistic interpretation, not a survey or map.

## Species provenance

- Gopi, G.V. and Pandav, B. (2007), *Conservation of Avifauna of Bhitarkanika Mangroves, India*, Zoos' Print Journal 22(10), 2839–2847. DOI: https://doi.org/10.11609/JoTT.ZPJ.1716.2839-47 . Author-uploaded full paper: https://www.researchgate.net/publication/261207818_Conservation_of_Avifauna_of_Bhitarkanika_Mangroves_India . Their 2004–2006 field survey documents all five modelled bird species: Little Egret (Egretta garzetta, resident breeder), Brahminy Kite (Haliastur indus), Small Blue/Common Kingfisher (Alcedo atthis), White-breasted/White-throated Kingfisher (Halcyon smyrnensis), Black-capped Kingfisher (Halcyon pileata). This primary research is used for occurrence, not a current abundance claim.
- National CAMPA, Bhitarkanika Odisha site section: https://nationalcampa.nic.in/dashboard/schemesPDF/66a8d9d2cba61.pdf . Confirms the sympatric occurrence of seven kingfisher species including all three in this scene.
- Government of India Gazette, 2024 notification: https://egazette.gov.in/WriteReadData/2024/259319.pdf . Also identifies Brahminy kite and Crocodylus porosus in the protected area.

## Short factual text

- Ramsar site 1205: https://rsis.ramsar.org/ris/1205 and its information sheet https://rsis.ramsar.org/RISapp/files/RISrep/IN1205RIS.pdf . Used for delta location, 2002 designation, twice-daily tides, fish nursery and sediment/leaf input. Avoided historical population numbers as present-day estimates.
- NOAA: https://oceanservice.noaa.gov/facts/mangroves.html . Used for prop roots, sediment trapping, coastal protection and fish shelter.
- Odisha Tourism: https://odishatourism.gov.in/content/tourism/en/experience/activities/boat-riding/bhitarkanika-nature-camps.html . Used for saltwater crocodiles and their ecological role. Avoided reproducing the site's globally misleading endangered classification.

## Local audio files and licenses

Full machine-readable attribution is in dist/assets/audio-credits.json and visible in the field guide.

1. **White-throated kingfisher**: https://commons.wikimedia.org/wiki/File:W.B.Kingfisher.ogg . Shajiarikkad, 20 August 2012, CC BY-SA 3.0, location unspecified. Downloaded original Ogg (100,371 bytes).
2. **Common kingfisher flight call**: https://commons.wikimedia.org/wiki/File:Alcedo_atthis_-_Common_Kingfisher_XC476785.mp3 . Marie-Lan Taÿ Pamart, 25 May 2019, Trilbardou France, XC476785, CC BY-SA 4.0. Downloaded original MP3 (723,155 bytes).

Files are unchanged from Commons. Playback uses a short faded excerpt, adjusted gain and spatial panning. Those playback adaptations retain each recording's license. These are genuine field recordings of species occurring in Bhitarkanika, **not recordings from Bhitarkanika**. Wind and water are synthesized and labelled accordingly. Egrets, Brahminy kites and black-capped kingfishers have no assigned calls rather than playing misidentified audio for those models. A third possible little-egret call was researched but its download was rate-limited and it is not included or claimed.

Audio is lazy-loaded only after a sound-button gesture, with load/decode failures isolated per recording. Birds make intermittent calls with long gaps, their source positions follow the model and listener orientation follows the camera. Older browsers without Ogg support can still play the common-kingfisher MP3.

## Integration

- `buildBirds(scene)` from `dist/birds.js` returns `{ birds, update(t, boatPosition) }`. Call update before audio each frame. Each entry has a live Vector3 `position`, string `species`, and Three.js `mesh`.
- `createNatureAudio()` from `dist/nature-audio.js` returns `{ async setEnabled(boolean), splash(), update(t, camera, birds), dispose() }`.
- `renderFieldGuide(container)` from `dist/field-guide.js` fills container contents and returns `{ stopAudio() }`; call stopAudio when closing the sidebar. Exports `facts`, `species`, `audioCredits` too.
- Remove old generic birds from buildWorld to avoid duplicate flocks.

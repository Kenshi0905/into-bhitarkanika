const SOURCES = {
  ramsar: { label: 'Ramsar wetland record', url: 'https://rsis.ramsar.org/ris/1205' },
  tide: { label: 'Ramsar information sheet', url: 'https://rsis.ramsar.org/RISapp/files/RISrep/IN1205RIS.pdf' },
  survey: { label: 'Bhitarkanika bird survey · Gopi & Pandav', url: 'https://doi.org/10.11609/JoTT.ZPJ.1716.2839-47' },
  roots: { label: 'NOAA · Mangrove forests', url: 'https://oceanservice.noaa.gov/facts/mangroves.html' },
  wildlife: { label: 'Odisha Tourism · Bhitarkanika', url: 'https://odishatourism.gov.in/content/tourism/en/experience/activities/boat-riding/bhitarkanika-nature-camps.html' },
};
export const facts = [
  { title: 'A forest between river and sea', text: 'Bhitarkanika lies in the Brahmani–Baitarani delta in Kendrapara, Odisha. Its mangroves became a Ramsar Wetland of International Importance in 2002.', source: SOURCES.ramsar },
  { title: 'The tide shapes everything', text: 'The creeks rise and fall with the tide twice a day. River silt and fallen mangrove leaves help make these sheltered waters a nursery for fish and other aquatic life.', source: SOURCES.tide },
  { title: 'Roots that hold a coastline', text: 'Mangrove roots slow tidal water, trap sediment and offer shelter to young fish. Some species stand on arching prop roots, adapted to the changing water level.', source: SOURCES.roots },
  { title: 'Saltwater crocodile', scientific: 'Crocodylus porosus', photo: 'saltwater-crocodile', text: 'Bhitarkanika is an important stronghold for the saltwater, or estuarine, crocodile. Look along the muddy creek banks and for eyes just above the water. This is the ecosystem’s apex predator.', source: SOURCES.wildlife },
];
export const species = [
  { id: 'white-throated-kingfisher', name: 'White-throated kingfisher', scientific: 'Halcyon smyrnensis', color: '#4ab2c8', note: 'Chestnut head, white throat, bright blue wings and a red bill. Watch the low branches above the creek.', audio: 'white-throated-kingfisher' },
  { id: 'common-kingfisher', name: 'Common kingfisher', scientific: 'Alcedo atthis', color: '#47bbad', note: 'A small flash of blue and orange, flying low over the water. Its sharp flight call is part of the soundscape.', audio: 'common-kingfisher' },
  { id: 'black-capped-kingfisher', name: 'Black-capped kingfisher', scientific: 'Halcyon pileata', color: '#7199d8', note: 'Look for a black cap, white collar and cobalt wings. This species is recorded in Bhitarkanika’s mangrove forests.' },
  { id: 'little-egret', name: 'Little egret', scientific: 'Egretta garzetta', color: '#eeeedd', note: 'White plumage, slender dark legs and yellow feet. Little egrets are among the waterbirds that breed in Bhitarkanika’s heronry.' },
  { id: 'brahminy-kite', name: 'Brahminy kite', scientific: 'Haliastur indus', color: '#c58354', note: 'Chestnut wings and a white head. Look higher above the creek for its broad-winged silhouette.' },
];
export const audioCredits = [
  { id: 'white-throated-kingfisher', title: 'White-throated kingfisher call', author: 'Shajiarikkad', file: './assets/audio/white-throated-kingfisher.ogg', source: 'https://commons.wikimedia.org/wiki/File:W.B.Kingfisher.ogg', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', location: 'Recording location not specified by the contributor.', changes: 'Original audio file; volume, spatial panning and fades applied during playback.' },
  { id: 'common-kingfisher', title: 'Common kingfisher flight call', author: 'Marie-Lan Taÿ Pamart', file: './assets/audio/common-kingfisher.mp3', source: 'https://commons.wikimedia.org/wiki/File:Alcedo_atthis_-_Common_Kingfisher_XC476785.mp3', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', location: 'Recorded in Trilbardou, France, 25 May 2019 (XC476785).', changes: 'Original audio file; volume, spatial panning and fades applied during playback.' },
];
export const photoCredits = [
  { id: 'mangrove-creek', title: 'Mangrove Bhitarkanika 1.jpg', author: 'Shubhamg81095', height: 540, location: 'Bhitarkanika, Odisha', alt: 'Dense mangrove foliage and upright breathing roots beside a muddy tidal creek in Bhitarkanika.', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { id: 'saltwater-crocodile', title: 'Saltwater Crocodile at Bhitarkanika National Park, Odisha, India.jpg', author: 'Bodhan nayek', height: 638, location: 'Bhitarkanika, Odisha', alt: 'A large saltwater crocodile resting on a muddy bank beneath mangrove trees in Bhitarkanika.', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { id: 'white-throated-kingfisher', title: 'White-throated-Kingfisher.jpg', author: 'Mildeep', height: 640, location: 'Species reference · Nepal', alt: 'Two white-throated kingfishers with chestnut heads, red bills and bright turquoise wings perched on a branch.', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { id: 'common-kingfisher', title: 'Common kingfisher (Alcedo atthis bengalensis) with fish.jpg', author: 'Charles J. Sharp', height: 640, location: 'Species reference · Uttar Pradesh, India', alt: 'A common kingfisher with a blue head and orange breast holds a small fish while perched among reeds.', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { id: 'black-capped-kingfisher', title: 'Black Capped Kingfisher.jpg', author: 'Sumeet Moghe', height: 639, location: 'Species reference · Goa, India', alt: 'A black-capped kingfisher perched on a stump, showing its black head, white collar, red bill and blue wings.', license: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  { id: 'little-egret', title: 'Little egret (Egretta garzetta).jpg', author: 'Hobbyfotowiki', height: 638, location: 'Species reference · Le Teich, France', alt: 'A white little egret bends its slender black bill toward the water while wading on dark legs.', license: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { id: 'brahminy-kite', title: 'Brahminy kite (Haliastur indus), Kuakata Eco-Park.jpg', author: 'Md shahanshah bappy', height: 592, location: 'Species reference · Kuakata, Bangladesh', alt: 'A Brahminy kite in flight with a white head, chestnut wings and dark outer flight feathers.', license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/' },
].map(photo => ({ ...photo, width: 960, file: `./assets/field-guide/${photo.id}.jpg`, source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.title.replaceAll(' ', '_'))}` }));
const link = (url, label) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
function photograph(id) {
  const photo = photoCredits.find(item => item.id === id);
  if (!photo) return '';
  return `<figure class="guide-photo"><div class="guide-photo-media" style="aspect-ratio:${photo.width}/${photo.height}"><img data-src="${photo.file}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async" alt="${photo.alt}"><span class="guide-photo-error" hidden>Photo unavailable. View the original below.</span></div><figcaption><span class="guide-photo-location">${photo.location}</span><span class="guide-photo-credit">${link(photo.source, `Photo: ${photo.author}`)} · ${link(photo.licenseUrl, photo.license)}</span></figcaption></figure>`;
}
export function renderFieldGuide(container) {
  container.innerHTML = `
    <p class="guide-intro">A few things to notice as you follow the creek.</p>
    ${photograph('mangrove-creek')}
    <section class="guide-section" aria-labelledby="guide-landscape-heading">
      <h3 id="guide-landscape-heading">The mangroves</h3>
      ${facts.map(f => `<article class="guide-fact"><h4>${f.title}</h4>${f.scientific ? `<i class="guide-scientific">${f.scientific}</i>` : ''}${f.photo ? photograph(f.photo) : ''}<p>${f.text}</p><small class="guide-source">${link(f.source.url, f.source.label)}</small></article>`).join('')}
    </section>
    <section class="guide-section" aria-labelledby="guide-birds-heading">
      <h3 id="guide-birds-heading">Birds along the creek</h3>
      ${species.map(s => `<details class="guide-species"><summary><span class="guide-bird-dot" style="background:${s.color}" aria-hidden="true"></span>${s.name}</summary><i class="guide-scientific">${s.scientific}</i>${photograph(s.id)}<p>${s.note}</p></details>`).join('')}
      <small class="guide-source">All five species are recorded in the ${link(SOURCES.survey.url, 'Bhitarkanika field survey')}.</small>
    </section>
    <details class="guide-credits guide-section"><summary>Photos, sounds & credits</summary>
      <p>The mangrove and crocodile photographs were taken in Bhitarkanika. Bird photographs show the same species in other locations, noted beneath each image.</p>
      <p>Photographs are reduced-size Wikimedia Commons previews, with no crop or recoloring. Each retains the license linked beneath it. ${link('./assets/field-guide/CREDITS.md', 'Full photograph credits')}</p>
      <p>Real field recordings of species found here, set among a soft wind and water soundscape. These recordings were not made in Bhitarkanika.</p>
      ${audioCredits.map(c => `<article class="guide-audio-credit"><h4>${c.title}</h4><p>Recorded by ${c.author}. ${c.location}</p><audio controls preload="none" src="${c.file}" aria-label="Listen to ${c.title}" style="width:100%;height:36px"></audio><small>${link(c.source, 'Original recording')} · ${link(c.licenseUrl, c.license)}<br>${c.changes}</small></article>`).join('')}
      <p class="guide-source">Wind, water, models and the navigable creek are a creative interpretation. The field recordings retain their respective Creative Commons licenses.</p>
    </details>`;
  const previews = [...container.querySelectorAll('audio')];
  for (const preview of previews) preview.addEventListener('play', () => previews.forEach(other => { if (other !== preview) other.pause(); }));
  const dialog = container.closest('dialog');
  function loadImages() {
    if (dialog && !dialog.open) return;
    for (const image of container.querySelectorAll('img[data-src]')) {
      const details = image.closest('details');
      if (details && !details.open) continue;
      image.src = image.dataset.src;
      delete image.dataset.src;
    }
  }
  for (const image of container.querySelectorAll('.guide-photo img')) {
    image.addEventListener('load', () => image.classList.add('is-loaded'), { once: true });
    image.addEventListener('error', () => { image.hidden = true; image.nextElementSibling.hidden = false; }, { once: true });
  }
  for (const details of container.querySelectorAll('.guide-species')) details.addEventListener('toggle', () => { if (details.open) loadImages(); });
  return { loadImages, stopAudio() { previews.forEach(preview => preview.pause()); } };
}

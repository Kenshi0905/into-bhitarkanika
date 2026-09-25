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
  { title: 'Saltwater crocodile', scientific: 'Crocodylus porosus', text: 'Bhitarkanika is an important stronghold for the saltwater, or estuarine, crocodile. Look along the muddy creek banks and for eyes just above the water. This is the ecosystem’s apex predator.', source: SOURCES.wildlife },
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
const link = (url, label) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
export function renderFieldGuide(container) {
  container.innerHTML = `
    <p class="guide-intro">A few things to notice as you follow the creek.</p>
    <section class="guide-section" aria-labelledby="guide-landscape-heading">
      <h3 id="guide-landscape-heading">The mangroves</h3>
      ${facts.map(f => `<article class="guide-fact"><h4>${f.title}</h4>${f.scientific ? `<i class="guide-scientific">${f.scientific}</i>` : ''}<p>${f.text}</p><small class="guide-source">${link(f.source.url, f.source.label)}</small></article>`).join('')}
    </section>
    <section class="guide-section" aria-labelledby="guide-birds-heading">
      <h3 id="guide-birds-heading">Birds along the creek</h3>
      ${species.map(s => `<details class="guide-species"><summary><span class="guide-bird-dot" style="background:${s.color}" aria-hidden="true"></span>${s.name}</summary><i class="guide-scientific">${s.scientific}</i><p>${s.note}</p></details>`).join('')}
      <small class="guide-source">All five species are recorded in the ${link(SOURCES.survey.url, 'Bhitarkanika field survey')}.</small>
    </section>
    <details class="guide-credits guide-section"><summary>Sounds & credits</summary>
      <p>Real field recordings of species found here, set among a soft wind and water soundscape. These recordings were not made in Bhitarkanika.</p>
      ${audioCredits.map(c => `<article class="guide-audio-credit"><h4>${c.title}</h4><p>Recorded by ${c.author}. ${c.location}</p><audio controls preload="none" src="${c.file}" aria-label="Listen to ${c.title}" style="width:100%;height:36px"></audio><small>${link(c.source, 'Original recording')} · ${link(c.licenseUrl, c.license)}<br>${c.changes}</small></article>`).join('')}
      <p class="guide-source">Wind, water, models and the navigable creek are a creative interpretation. The field recordings retain their respective Creative Commons licenses.</p>
    </details>`;
  const previews = [...container.querySelectorAll('audio')];
  for (const preview of previews) preview.addEventListener('play', () => previews.forEach(other => { if (other !== preview) other.pause(); }));
  return { stopAudio() { previews.forEach(preview => preview.pause()); } };
}

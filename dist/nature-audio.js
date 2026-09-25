const RECORDINGS = [
  { species: 'white-throated-kingfisher', url: './assets/audio/white-throated-kingfisher.ogg', volume: .22 },
  { species: 'common-kingfisher', url: './assets/audio/common-kingfisher.mp3', volume: .30 },
];

export function createNatureAudio() {
  let context, master, air, water, enabled = false, loadPromise, nextCall = 0, lastTime = 0, disposed = false;
  const recordings = [], voices = new Set(), noiseSources = [];
  let randomState = 74619;
  const random = () => { randomState = (randomState * 1664525 + 1013904223) >>> 0; return randomState / 4294967296; };
  function loadRecordings() {
    return Promise.allSettled(RECORDINGS.filter(item => !recordings.some(r => r.species === item.species)).map(async item => {
      const response = await fetch(new URL(item.url, import.meta.url));
      if (!response.ok) throw new Error('Bird recording could not load.');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (!disposed) recordings.push({ ...item, buffer });
    }));
  }
  function build() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Nature audio is unavailable in this browser.');
    context = new AudioContext(); master = context.createGain(); master.gain.value = 0;
    const compressor = context.createDynamicsCompressor(); compressor.threshold.value = -14; compressor.ratio.value = 3;
    master.connect(compressor); compressor.connect(context.destination);
    // Only wind and water are synthesized. Every bird voice uses an attributed field recording.
    const buffer = context.createBuffer(1, context.sampleRate * 5, context.sampleRate), samples = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < samples.length; i++) { brown = (brown + (random() * 2 - 1) * .035) / 1.035; samples[i] = brown * 3; }
    function ambience(frequency, gain) {
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), level = context.createGain();
      source.buffer = buffer; source.loop = true; filter.type = 'lowpass'; filter.frequency.value = frequency; level.gain.value = gain;
      source.connect(filter); filter.connect(level); level.connect(master); source.start(); noiseSources.push(source); return level;
    }
    air = ambience(900, .075); water = ambience(360, .06);
    loadPromise = loadRecordings();
  }
  function stopCalls() { for (const voice of voices) { try { voice.source.stop(); } catch {} } voices.clear(); }
  function setPoint(panner, p) {
    if (panner.positionX) { panner.positionX.value = p.x; panner.positionY.value = p.y; panner.positionZ.value = p.z; }
    else panner.setPosition(p.x, p.y, p.z);
  }
  function play(recording, bird) {
    const source = context.createBufferSource(), gain = context.createGain(), panner = context.createPanner(), now = context.currentTime;
    source.buffer = recording.buffer; panner.panningModel = 'HRTF'; panner.distanceModel = 'inverse'; panner.refDistance = 25; panner.maxDistance = 220; panner.rolloffFactor = 1.4;
    setPoint(panner, bird.position); const duration = Math.min(recording.buffer.duration, 12);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(recording.volume, now + .65);
    gain.gain.setValueAtTime(recording.volume, now + Math.max(.7, duration - 1)); gain.gain.linearRampToValueAtTime(0, now + duration);
    source.connect(gain); gain.connect(panner); panner.connect(master);
    const voice = { source, panner, bird }; voices.add(voice);
    source.onended = () => { voices.delete(voice); source.disconnect(); gain.disconnect(); panner.disconnect(); };
    source.start(now, 0, duration);
  }
  const visibility = () => { if (context) { if (document.hidden) context.suspend().catch(() => {}); else if (enabled) context.resume().catch(() => {}); } };
  document.addEventListener('visibilitychange', visibility);
  return {
    async setEnabled(value) {
      if (disposed) return false;
      enabled = Boolean(value);
      if (!enabled) {
        if (master) { master.gain.cancelScheduledValues(context.currentTime); master.gain.setTargetAtTime(0, context.currentTime, .1); stopCalls(); }
        return false;
      }
      if (!context) build();
      if (!loadPromise) loadPromise = loadRecordings();
      await context.resume();
      // Fetch/decode finishes independently: ambience responds immediately to the user's gesture.
      if (enabled) { master.gain.setTargetAtTime(.62, context.currentTime, .3); nextCall = lastTime + 1.4; }
      await loadPromise;
      if (!recordings.length && enabled) {
        enabled = false;
        loadPromise = null;
        master.gain.setTargetAtTime(0, context.currentTime, .1);
        throw new Error('Bird recordings could not load. Please check your connection and try again.');
      }
      return enabled;
    },
    splash() {
      if (!enabled || !context || !water) return;
      const now = context.currentTime; water.gain.cancelScheduledValues(now); water.gain.setValueAtTime(.20, now); water.gain.exponentialRampToValueAtTime(.045, now + .7);
    },
    update(t, camera, birds = []) {
      lastTime = t;
      if (!enabled || !context || context.state !== 'running' || !camera) return;
      const listener = context.listener, p = camera.position, e = camera.matrixWorld.elements;
      if (listener.positionX) {
        listener.positionX.value = p.x; listener.positionY.value = p.y; listener.positionZ.value = p.z;
        listener.forwardX.value = -e[8]; listener.forwardY.value = -e[9]; listener.forwardZ.value = -e[10];
        listener.upX.value = e[4]; listener.upY.value = e[5]; listener.upZ.value = e[6];
      } else { listener.setPosition(p.x, p.y, p.z); listener.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]); }
      air.gain.setTargetAtTime(.045 + (Math.sin(t * .21) + 1) * .018, context.currentTime, .8);
      for (const voice of voices) setPoint(voice.panner, voice.bird.position);
      if (t < nextCall || !recordings.length || voices.size) return;
      const candidates = birds.filter(b => recordings.some(r => r.species === b.species) && Math.hypot(b.position.x - p.x, b.position.z - p.z) < 190);
      candidates.sort((a, b) => a.position.distanceToSquared(p) - b.position.distanceToSquared(p));
      if (candidates.length) { const bird = candidates[Math.floor(random() * Math.min(3, candidates.length))]; play(recordings.find(r => r.species === bird.species), bird); }
      nextCall = t + 27 + random() * 22;
    },
    dispose() { disposed = true; enabled = false; stopCalls(); document.removeEventListener('visibilitychange', visibility); noiseSources.forEach(source => source.stop()); if (context) context.close().catch(() => {}); },
    getStatus() { return { enabled, loadedRecordings: recordings.length, activeVoices: voices.size }; },
  };
}

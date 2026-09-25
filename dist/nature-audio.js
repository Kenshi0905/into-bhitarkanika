const RECORDINGS = [
  { species: 'white-throated-kingfisher', url: './assets/audio/white-throated-kingfisher.ogg', volume: .22 },
  { species: 'common-kingfisher', url: './assets/audio/common-kingfisher.mp3', volume: .30 },
];

export function createNatureAudio() {
  let context, master, air, water, rain, rumbleBuffer, enabled = false, loadPromise, nextCall = 0, lastTime = 0, disposed = false, pendingThunder = null;
  const recordings = [], voices = new Set(), weatherVoices = new Set(), noiseSources = [];
  let weather = { rain: 0, strength: 0, preset: 0, strikes: 0 };
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
    // Wind, water, rain and thunder are synthesized. Bird voices remain the
    // attributed field recordings; weather never starts an AudioContext.
    const buffer = context.createBuffer(1, context.sampleRate * 5, context.sampleRate), samples = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < samples.length; i++) { brown = (brown + (random() * 2 - 1) * .035) / 1.035; samples[i] = brown * 3; }
    rumbleBuffer = buffer;
    function ambience(frequency, gain, sourceBuffer = buffer, type = 'lowpass') {
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), level = context.createGain();
      source.buffer = sourceBuffer; source.loop = true; filter.type = type; filter.frequency.value = frequency; level.gain.value = gain;
      source.connect(filter); filter.connect(level); level.connect(master); source.start(); noiseSources.push(source); return level;
    }
    air = ambience(900, .075); water = ambience(360, .06);
    const rainBuffer=context.createBuffer(1,context.sampleRate*5,context.sampleRate),rainSamples=rainBuffer.getChannelData(0);
    for(let i=0;i<rainSamples.length;i++)rainSamples[i]=(random()*2-1)*.52;
    rain=ambience(1700,0,rainBuffer,'bandpass');
    loadPromise = loadRecordings();
  }
  function stopCalls() { for (const voice of voices) { try { voice.source.stop(); } catch {} } voices.clear();for(const voice of weatherVoices){try{voice.stop();}catch{}}weatherVoices.clear();pendingThunder=null; }
  function thunder(){
    if(!enabled||context?.state!=='running')return;
    const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain(),now=context.currentTime;
    source.buffer=rumbleBuffer;filter.type='lowpass';filter.frequency.value=155;gain.gain.value=0;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.40,now+.22);gain.gain.exponentialRampToValueAtTime(.07,now+1.8);gain.gain.exponentialRampToValueAtTime(.001,now+4.4);
    source.connect(filter);filter.connect(gain);gain.connect(master);weatherVoices.add(source);
    source.onended=()=>{weatherVoices.delete(source);source.disconnect();filter.disconnect();gain.disconnect();};source.start(now,0,4.5);
  }
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
    setWeather(state){
      const strikes=state?.strikes??weather.strikes;
      if(strikes>weather.strikes&&enabled&&context?.state==='running')pendingThunder=context.currentTime+1.7+random()*1.4;
      weather={rain:state?.rain??0,strength:state?.wind?.strength??0,preset:state?.preset??0,strikes};
      if(weather.rain<.01&&weather.preset!==3)pendingThunder=null;
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
      air.gain.setTargetAtTime(.045 + (Math.sin(t * .21) + 1) * .018+weather.strength*weather.rain*.14, context.currentTime, .8);
      rain.gain.setTargetAtTime(weather.rain*.36,context.currentTime,.6);
      if(pendingThunder!==null&&context.currentTime>=pendingThunder){pendingThunder=null;thunder();}
      for (const voice of voices) setPoint(voice.panner, voice.bird.position);
      if (t < nextCall || !recordings.length || voices.size) return;
      // The existing kingfisher recordings are daytime calls. At night, leave
      // the creek to wind and water instead of inventing an unrelated species.
      if(weather.rain>.55||weather.preset===4){nextCall=t+18+random()*12;return;}
      const candidates = birds.filter(b => recordings.some(r => r.species === b.species) && Math.hypot(b.position.x - p.x, b.position.z - p.z) < 190);
      candidates.sort((a, b) => a.position.distanceToSquared(p) - b.position.distanceToSquared(p));
      if (candidates.length) { const bird = candidates[Math.floor(random() * Math.min(3, candidates.length))]; play(recordings.find(r => r.species === bird.species), bird); }
      nextCall = t + 27 + random() * 22;
    },
    dispose() { disposed = true; enabled = false; stopCalls(); document.removeEventListener('visibilitychange', visibility); noiseSources.forEach(source => source.stop()); if (context) context.close().catch(() => {}); },
    getStatus() { return { enabled, loadedRecordings: recordings.length, activeVoices: voices.size,activeWeatherVoices:weatherVoices.size,rain:weather.rain }; },
  };
}

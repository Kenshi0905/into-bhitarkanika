import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const threeURL=new URL('./dist/vendor/three.module.js',import.meta.url).href;
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const load=async(name,replacements={})=>{
 let text=(await readFile(new URL(`./dist/${name}`,import.meta.url),'utf8')).replaceAll("from 'three'",`from '${threeURL}'`);
 for(const [from,to] of Object.entries(replacements))text=text.replaceAll(`'${from}'`,`'${to}'`);
 return import(moduleURL(text));
};
const T=await import(threeURL);
const {createClimateState,createHighWeather,rainDensityAt}=await load('high-weather.js',{'./channel.js':new URL('./dist/channel.js',import.meta.url).href});
const {createHighAtmosphere,weatherMaterialProfile}=await load('high-atmosphere.js');
const {getHighLighting,skyUniforms,HIGH_SKY_PRESETS}=await load('high-sky.js');

test('weather storm wets gradually, flashes occasionally, then dries without resetting the journey clock',()=>{
 const climate=createClimateState();climate.setEnabled(true);climate.setLighting(3);
 let flashes=0;
 for(let i=0;i<2400;i++){const s=climate.update(i/60,1/60);if(s.flash>.5)flashes++;assert.ok(s.wind.strength>=0&&s.wind.strength<=1);assert.ok(Math.abs(Math.hypot(s.wind.x,s.wind.z)-1)<1e-12);}
 const storm=climate.getState();assert.ok(storm.rain>.99);assert.ok(storm.wetness>.96);assert.ok(flashes>0);assert.ok(storm.strikes>=1&&storm.strikes<=3);
 const wet=storm.wetness,clock=storm.time,strikes=storm.strikes;
 climate.setLighting(0);climate.update(40,1/60);assert.ok(climate.getState().wetness>=wet-.001);assert.equal(climate.getState().flash,0);
 for(let i=0;i<3600;i++)climate.update(40+i/60,1/60);
 const dry=climate.getState();assert.ok(dry.rain<.0001);assert.ok(dry.wetness<.64&&dry.wetness>.50);assert.ok(dry.time>clock);assert.equal(dry.strikes,strikes);
 climate.setEnabled(false);assert.equal(dry.wind.strength,0);assert.equal(dry.rain,0);assert.equal(dry.flash,0);
});

test('all five skies share the visible disk direction with their actual key light',()=>{
 assert.equal(HIGH_SKY_PRESETS.length,5);
 for(let index=0;index<5;index++){
  const p=getHighLighting(index),u=skyUniforms(index),d=new T.Vector3(...p.direction).normalize();assert.ok(d.distanceTo(u.sun.value)<1e-12);
  assert.ok(p.ambient>.4);assert.ok(Number.isFinite(p.exposure));assert.ok(p.sunPower>0);assert.ok(p.waterColor.startsWith('#'));
 }
 assert.equal(skyUniforms(4).moon.value,1);assert.equal(skyUniforms(3).sunRadiance.value,0);assert.ok(skyUniforms(4).stars.value>.5);
 const night=getHighLighting(4),gold=getHighLighting(0);
 assert.ok(night.ambient<gold.ambient);assert.ok(night.waterLight<.5);assert.ok(new T.Vector3(...night.direction).normalize().y<.16,'moon should enter the normal Follow horizon');
 const nightHorizon=skyUniforms(4).horizon.value,goldHorizon=skyUniforms(0).horizon.value;
 assert.ok(nightHorizon.r+nightHorizon.g+nightHorizon.b<(goldHorizon.r+goldHorizon.g+goldHorizon.b)*.12,'moonlit sky has a distinct luminance hierarchy');
});

test('rain varies across the creek and its patches advect in the actual shared wind',()=>{
 const wind={x:.6,z:.8,strength:.9},values=[];
 for(let x=-120;x<=120;x+=20)for(let z=-120;z<=120;z+=20)values.push(rainDensityAt(x,z,10,wind));
 assert.ok(Math.max(...values)-Math.min(...values)>.65);assert.ok(values.every(v=>v>=.09&&v<=1));
 const travel=7*(1.1+wind.strength*2.1),before=rainDensityAt(24,-51,10,wind),after=rainDensityAt(24+wind.x*travel,-51+wind.z*travel,17,wind);
 assert.ok(Math.abs(before-after)<1e-12);
});

test('weather geometry stays bounded, follows actual water height and restores reflection visibility',()=>{
 const scene=new T.Scene(),boat=new T.Group();scene.add(boat);const weather=createHighWeather({scene,craft:{boat},waterHeight:()=>2});
 weather.setEnabled(true);weather.setLighting(3);const camera=new T.PerspectiveCamera();camera.position.set(0,10,15);
 for(let i=0;i<900;i++)weather.update(i/60,1/60,boat.position,camera);
 const group=scene.getObjectByName('High local rain and surface contact'),rings=scene.getObjectByName('Rain contacts on estuary surface');assert.equal(group.visible,true);assert.equal(rings.count,112);
 const matrix=new T.Matrix4();for(let i=0;i<rings.count;i++){rings.getMatrixAt(i,matrix);assert.ok(Math.abs(matrix.elements[13]-2.018)<1e-5);assert.ok(matrix.elements.every(Number.isFinite));}
 const energy=Array.from(rings.geometry.attributes.energy.array);assert.ok(Math.max(...energy)-Math.min(...energy)>.25);
 const streaks=group.children[0].geometry.attributes.rainOpacity.array;assert.ok(Math.max(...streaks)-Math.min(...streaks)>.25);
 assert.ok(weather.getStats().activeContacts>0&&weather.getStats().activeContacts<112);
 assert.equal(weather.getStats().drawCalls,2);weather.beginReflection();weather.beginReflection();assert.equal(group.visible,false);weather.endReflection();assert.equal(group.visible,false);weather.endReflection();assert.equal(group.visible,true);
 weather.beginReflection();weather.setEnabled(false);weather.endReflection();assert.equal(group.visible,false);
 weather.dispose();weather.dispose();assert.equal(scene.getObjectByName(group.name),undefined);
});

test('wetness patches distinct material responses and restores Standard shader hooks exactly',()=>{
 const scene=new T.Scene(),material=new T.MeshStandardMaterial({color:0x725536,roughness:.9}),geometry=new T.BoxGeometry(),mesh=new T.Mesh(geometry,material);material.userData.weatherSurface='wood';scene.add(mesh);
 let called=0;const compile=material.onBeforeCompile=function(){called++;};const key=material.customProgramCacheKey;const defines=material.defines,dither=material.dithering,color=material.color.clone();
 const atmosphere=createHighAtmosphere({scene});atmosphere.setEnabled(true);atmosphere.setWeather({wetness:.73,wind:{x:1,z:0,strength:.9},time:10});
 const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader,null);
 assert.equal(called,1);assert.equal(shader.uniforms.bhitarWetness.value,.73);assert.match(shader.fragmentShader,/roughnessFactor=mix/);assert.match(shader.fragmentShader,/bhitarWetness\*0.1700/);assert.ok(material.color.equals(color));assert.equal(material.roughness,.9);
 const cloth=new T.MeshStandardMaterial();cloth.userData.weatherSurface='cloth';assert.ok(weatherMaterialProfile(cloth).roughness>weatherMaterialProfile(material).roughness);
 atmosphere.setEnabled(false);assert.equal(material.onBeforeCompile,compile);assert.equal(material.customProgramCacheKey,key);assert.deepEqual(material.defines,defines);assert.equal(material.dithering,dither);
 atmosphere.setEnabled(true);assert.notEqual(material.onBeforeCompile,compile);atmosphere.dispose();assert.equal(material.onBeforeCompile,compile);assert.equal(material.customProgramCacheKey,key);
 geometry.dispose();material.dispose();cloth.dispose();
});

test('weather audio respects gesture creation, master mute and delayed thunder',async()=>{
 const previous={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch};let contexts=0,context;
 const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},exponentialRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
 const node=()=>({connect(){},disconnect(){}});
 class FakeAudioContext{
  constructor(){contexts++;context=this;this.currentTime=0;this.sampleRate=100;this.state='suspended';this.destination=node();this.listener={positionX:param(),positionY:param(),positionZ:param(),forwardX:param(),forwardY:param(),forwardZ:param(),upX:param(),upY:param(),upZ:param()};}
  createGain(){return {...node(),gain:param()};}createDynamicsCompressor(){return {...node(),threshold:param(),ratio:param()};}createBiquadFilter(){return {...node(),frequency:param()};}
  createBuffer(c,n){return {getChannelData:()=>new Float32Array(n),duration:n/100};}
  createBufferSource(){return {...node(),start(){},stop(){this.onended?.();}};}
  decodeAudioData(){return Promise.resolve({duration:3});}resume(){this.state='running';return Promise.resolve();}suspend(){this.state='suspended';return Promise.resolve();}close(){this.state='closed';return Promise.resolve();}
 }
 try{
  globalThis.window={AudioContext:FakeAudioContext};globalThis.document={hidden:false,addEventListener(){},removeEventListener(){}};globalThis.fetch=async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(4)});
  const {createNatureAudio}=await import('./dist/nature-audio.js');const audio=createNatureAudio();
  audio.setWeather({rain:1,preset:3,strikes:1,wind:{strength:.9}});assert.equal(contexts,0);
  await audio.setEnabled(true);assert.equal(contexts,1);const camera=new T.PerspectiveCamera();camera.updateMatrixWorld();
  audio.setWeather({rain:1,preset:3,strikes:2,wind:{strength:.9}});audio.update(1,camera);assert.equal(audio.getStatus().activeWeatherVoices,0);
  context.currentTime=5;audio.update(5,camera);assert.equal(audio.getStatus().activeWeatherVoices,1);
  await audio.setEnabled(false);assert.equal(audio.getStatus().activeWeatherVoices,0);audio.setWeather({rain:1,preset:3,strikes:3,wind:{strength:.9}});context.currentTime=10;audio.update(10,camera);assert.equal(audio.getStatus().activeWeatherVoices,0);
  audio.dispose();assert.equal(context.state,'closed');
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});

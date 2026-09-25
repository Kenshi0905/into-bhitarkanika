import * as T from 'three';
import { buildWorld, buildSky, center, width } from './world.js';
import { buildBoat } from './boat.js';
import { buildWater, waveHeight } from './water.js';
import { BoatPhysics } from './physics.js';
import { createWildlife } from './wildlife.js';
import { createTraffic } from './traffic.js';
import { buildBirds } from './birds.js';
import { createNatureAudio } from './nature-audio.js';
import { renderFieldGuide } from './field-guide.js';

const $ = id => document.getElementById(id), canvas = $('scene');
const state = { mode:'motor', cruise:false, camera:0, sound:false, hidden:false, timeIndex:0, paused:false };
const keys = new Set(), physics = new BoatPhysics(), audio = createNatureAudio();
let renderer;
try { renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'}); }
catch (error) { $('loading').hidden=true; $('error').hidden=false; throw error; }
let pixelRatio = Math.min(devicePixelRatio, innerWidth<760?1.35:1.6);
renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true; renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=true; renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene(); scene.fog=new T.FogExp2(0xc5c8b4,.004);
const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.15,2600);
const hemi=new T.HemisphereLight(0xc6dce1,0x4d5136,1.85); scene.add(hemi);
const sun=new T.DirectionalLight(0xffd8a0,3.1); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-68,right:68,top:68,bottom:-68,near:1,far:430});
sun.shadow.bias=-.00025; sun.shadow.normalBias=.03; scene.add(sun,sun.target);
const sky=buildSky(scene), world=buildWorld(scene), craft=buildBoat(scene), water=buildWater(scene,sky.uniforms.sun.value);
const wildlife=createWildlife(scene), traffic=createTraffic(scene), birds=buildBirds(scene), boat=craft.boat;
const guide=renderFieldGuide($('guide-content'));
let time=0, accumulator=0, frame=0, noticeUntil=0, lastCollision=-10, previousFrame=performance.now(), frameAverage=.016;
let orbitYaw=.42, orbitPitch=.29, distance=26, boatY=0, verticalVelocity=0, leftStroke=-10, rightStroke=-10, strokeCount=0;
const look=new T.Vector3(), desired=new T.Vector3(), up=new T.Vector3(0,1,0), pointers=new Map();
let pinchDistance=0; camera.position.set(12,10,25);
const map=$('minimap').getContext('2d');
const icons={motor:'<path d="M5 14h14l-3 5H8zM7 14V8h10v6M10 8V4h4v4M3 22q3-2 6 0t6 0t6 0"/>',row:'<path d="m5 3 12 14m-1-2 5 5-3 2-4-5M19 3 7 17m1-2-5 5 3 2 4-5"/>',play:'<path d="m8 5 11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>'};
function notice(text){$('notice').textContent=text;$('notice').classList.add('visible');noticeUntil=time+3;}
function setMore(open){$('more-panel').hidden=!open;$('more-button').setAttribute('aria-expanded',String(open));}
function updateUI(){
  const row=state.mode==='row'; $('mode-label').textContent=row?'Row':'Motor';$('mode-icon').innerHTML=icons[state.mode];
  $('mode-button').setAttribute('aria-label',row?'Rowing mode. Switch to motor':'Motor mode. Switch to rowing');
  $('cruise-button').setAttribute('aria-pressed',String(state.cruise));$('cruise-button').setAttribute('aria-label',state.cruise?'Stop gentle cruise':'Start gentle cruise');
  $('cruise-button').querySelector('svg').innerHTML=state.cruise?icons.pause:icons.play;
  $('touch-row').hidden=!row;$('touch-forward').hidden=row;craft.oars.forEach(o=>o.visible=row);
  $('camera-label').textContent=['Follow','On the bow','Overhead'][state.camera];
}
function cancelCruise(){if(state.cruise){state.cruise=false;updateUI();}}
function setMode(mode){keys.clear();state.mode=mode;cancelCruise();updateUI();const touch=matchMedia('(pointer:coarse),(max-width:700px)').matches;notice(mode==='row'?(touch?'Hold the oar button to row.':'Q / E to row, or Space for both oars.'):(touch?'Hold the arrows to move and steer.':'W / S to move · A / D to steer'));}
function stroke(side){
  if(state.paused||state.mode!=='row'||!physics.row(side,time))return;
  strokeCount++;canvas.dataset.strokes=strokeCount;const sign=side===0?-1:1;
  if(side===0)leftStroke=time;else rightStroke=time;
  const p=new T.Vector3(sign*4.2,0,-4).applyAxisAngle(up,physics.heading);water.ripple(physics.x+p.x,physics.z+p.z,time,1.25);audio.splash();
}
function cycleCamera(){state.camera=(state.camera+1)%3;orbitYaw=state.camera===2?.55:.42;orbitPitch=.29;updateUI();notice(['Following the boat','On the bow','Above the mangroves'][state.camera]);}
function hideUI(){setMore(false);state.hidden=!state.hidden;document.body.classList.toggle('hidden-ui',state.hidden);$('show-button').hidden=!state.hidden;}
const times=[
  {name:'Golden hour',top:'#86afbd',horizon:'#e6d9b8',fog:'#c5c8b4',sun:'#ffdaa9',power:3.1,ambient:1.85,exposure:1.15,dir:[-.45,.29,-.85]},
  {name:'Morning mist',top:'#82aab7',horizon:'#d1ddd4',fog:'#b7c9c0',sun:'#e9efe1',power:2.05,ambient:1.75,exposure:1.12,dir:[-.5,.22,-.7]},
  {name:'Blue hour',top:'#304969',horizon:'#c4a6a0',fog:'#667f80',sun:'#ddbcad',power:1.1,ambient:.95,exposure:1.1,dir:[-.5,.12,-.7]},
];
function applyLight(){const p=times[state.timeIndex];$('time-label').textContent=p.name;sky.uniforms.top.value.set(p.top);sky.uniforms.horizon.value.set(p.horizon);sky.uniforms.sun.value.set(...p.dir).normalize();scene.fog.color.set(p.fog);scene.fog.density=state.timeIndex===1?.0065:.004;sun.color.set(p.sun);sun.intensity=p.power;hemi.intensity=p.ambient;water.uniforms.sunColor.value.set(p.sun);water.uniforms.sunDirection.value.copy(sky.uniforms.sun.value);renderer.toneMappingExposure=p.exposure;}
function changeTime(){state.timeIndex=(state.timeIndex+1)%times.length;applyLight();notice(times[state.timeIndex].name);}
function reset(){keys.clear();physics.reset();leftStroke=rightStroke=-10;boatY=verticalVelocity=0;state.cruise=false;state.camera=0;orbitYaw=.42;orbitPitch=.29;distance=26;water.uniforms.ripples.value.forEach(r=>r.z=-100);updateUI();setMore(false);notice('Back at the landing.');}
async function toggleAudio(){
  const button=$('sound-button');button.disabled=true;
  try{state.sound=await audio.setEnabled(!state.sound);button.setAttribute('aria-pressed',String(state.sound));button.setAttribute('aria-label',state.sound?'Mute nature sounds':'Enable nature sounds');button.querySelector('svg').innerHTML=state.sound?'<path d="m11 4-6 5H2v6h3l6 5zM16 8q5 4 0 8m3-11q8 7 0 14"/>':'<path d="m11 4-6 5H2v6h3l6 5zM16 9l5 6m0-6-5 6"/>';notice(state.sound?'Listen for the kingfishers.':'Sound off.');}
  catch(error){state.sound=false;notice('Bird recordings couldn’t load. Try sound again.');console.warn(error.message);}
  finally{button.disabled=false;}
}
function openDialog(id){keys.clear();setMore(false);state.paused=true;$(id).showModal();if(id==='field-guide')$('guide-button').setAttribute('aria-expanded','true');}
for(const id of ['help-dialog','field-guide']){
  $(id).addEventListener('close',()=>{state.paused=false;keys.clear();if(id==='field-guide'){guide.stopAudio();$('guide-button').setAttribute('aria-expanded','false');}});
  $(id).addEventListener('click',event=>{if(event.target!==$(id))return;const r=$(id).getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$(id).close();});
}
$('mode-button').onclick=()=>setMode(state.mode==='motor'?'row':'motor');
$('cruise-button').onclick=()=>{if(state.mode==='row')setMode('motor');state.cruise=!state.cruise;updateUI();notice(state.cruise?'Gentle cruise. Steer to take the helm.':'You have the helm.');};
$('camera-button').onclick=cycleCamera;$('time-button').onclick=changeTime;$('sound-button').onclick=toggleAudio;$('hide-button').onclick=hideUI;$('show-button').onclick=hideUI;$('reset-button').onclick=reset;
$('more-button').onclick=()=>setMore($('more-panel').hidden);$('help-button').onclick=()=>openDialog('help-dialog');$('close-help').onclick=()=>$('help-dialog').close();
$('guide-button').onclick=()=>openDialog('field-guide');$('close-guide').onclick=()=>$('field-guide').close();$('reload-button').onclick=()=>location.reload();
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.bottom'))setMore(false);});
document.addEventListener('keydown',event=>{if(event.code==='Escape')setMore(false);});
const controlled=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
addEventListener('keydown',event=>{
  if(state.paused||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  if(controlled.has(event.code)){if(event.code==='Space'&&event.target.closest('button'))return;event.preventDefault();keys.add(event.code);cancelCruise();if(state.mode==='row'&&!event.repeat){if(event.code==='KeyQ')stroke(0);if(event.code==='KeyE')stroke(1);if(event.code==='Space'){stroke(0);stroke(1);}}}
  if(event.repeat)return;if(event.code==='KeyR')setMode(state.mode==='motor'?'row':'motor');if(event.code==='KeyC')cycleCamera();if(event.code==='KeyH')hideUI();if(event.key==='?')openDialog('help-dialog');
});
addEventListener('keyup',event=>keys.delete(event.code));addEventListener('blur',()=>{keys.clear();pointers.clear();pinchDistance=0;});
document.addEventListener('visibilitychange',()=>{keys.clear();pointers.clear();previousFrame=performance.now();});
function pointerGap(){const p=[...pointers.values()];return p.length>=2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;}
canvas.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);pinchDistance=pointerGap();canvas.focus({preventScroll:true});});
canvas.addEventListener('pointermove',event=>{const previous=pointers.get(event.pointerId);if(!previous)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size>1){const gap=pointerGap();if(pinchDistance>0&&gap>0)distance=T.MathUtils.clamp(distance*pinchDistance/gap,15,55);pinchDistance=gap;}else{orbitYaw-=(event.clientX-previous.x)*.006;orbitPitch=T.MathUtils.clamp(orbitPitch+(event.clientY-previous.y)*.004,.07,.95);}});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{pointers.delete(event.pointerId);pinchDistance=pointerGap();});
canvas.addEventListener('wheel',event=>{event.preventDefault();distance=T.MathUtils.clamp(distance+event.deltaY*.022,15,55);},{passive:false});
$('touch-row').dataset.key='Space';
for(const button of document.querySelectorAll('[data-key]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(button.dataset.key);cancelCruise();if(button.dataset.key==='Space'){stroke(0);stroke(1);}});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(button.dataset.key));
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();$('error-message').textContent='The graphics connection was interrupted. Reload to return to the creek.';$('error').hidden=false;});
function getInput(){
  let throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
  if(state.cruise){const target=physics.z-30,angle=Math.atan2(physics.x-center(target),30);const delta=T.MathUtils.euclideanModulo(angle-physics.heading+Math.PI,Math.PI*2)-Math.PI;steer=T.MathUtils.clamp(delta*2.8,-1,1);throttle=physics.speed<2.3?.7:.2;if(physics.z<-1000){cancelCruise();notice('End of the creek. Turn around or start again.');throttle=0;}}
  if(state.mode==='row'){if(keys.has('KeyQ'))stroke(0);if(keys.has('KeyE'))stroke(1);if(keys.has('Space')||throttle>0){stroke(0);stroke(1);}}
  return {mode:state.mode,throttle,steer,brake:state.mode==='motor'?keys.has('Space'):throttle<0};
}
function drawMap(){
  const w=240,h=170,cz=physics.z-60,mx=x=>120+(x-center(cz))*.6,my=z=>85+(z-cz)*.38;map.clearRect(0,0,w,h);map.lineWidth=1;map.strokeStyle='#d2dfc810';
  for(let x=0;x<w;x+=30){map.beginPath();map.moveTo(x,0);map.lineTo(x,h);map.stroke();}for(let y=0;y<h;y+=30){map.beginPath();map.moveTo(0,y);map.lineTo(w,y);map.stroke();}
  map.beginPath();for(let z=cz-240;z<=cz+240;z+=8)map.lineTo(mx(center(z)-width(z)),my(z));for(let z=cz+240;z>=cz-240;z-=8)map.lineTo(mx(center(z)+width(z)),my(z));map.closePath();map.fillStyle='#c5d6bd2a';map.fill();map.strokeStyle='#d3ddc150';map.stroke();
  for(const vessel of traffic.vessels){map.fillStyle=vessel.kind==='police'?'#b1d5dfaa':'#d1dbc786';map.beginPath();map.arc(mx(vessel.x),my(vessel.z),2,0,Math.PI*2);map.fill();}
  map.save();map.translate(mx(physics.x),my(physics.z));map.rotate(-physics.heading);map.fillStyle='#f5d692';map.beginPath();map.moveTo(0,-7);map.lineTo(4,5);map.lineTo(0,3);map.lineTo(-4,5);map.closePath();map.fill();map.restore();
}
function animate(){
  requestAnimationFrame(animate);const now=performance.now(),rawDelta=(now-previousFrame)/1000;previousFrame=now;if(document.hidden)return;const dt=Math.min(rawDelta,.05);frameAverage=frameAverage*.97+rawDelta*.03;
  if(!state.paused){time+=dt;accumulator+=dt;const input=getInput();while(accumulator>=1/60){physics.step(1/60,input,time);accumulator-=1/60;}}
  boat.position.set(physics.x,boatY,physics.z);boat.rotation.y=physics.heading;
  const targetY=waveHeight(physics.x,physics.z,time);verticalVelocity+=(targetY-boatY)*16*dt-verticalVelocity*5.5*dt;boatY+=verticalVelocity*dt;boat.position.y=boatY;
  const fx=-Math.sin(physics.heading),fz=-Math.cos(physics.heading),pitch=(waveHeight(physics.x+fx*5,physics.z+fz*5,time)-waveHeight(physics.x-fx*5,physics.z-fz*5,time))/10;
  boat.rotation.x=T.MathUtils.damp(boat.rotation.x,-pitch,3,dt);boat.rotation.z=T.MathUtils.damp(boat.rotation.z,(waveHeight(physics.x+2,physics.z,time)-waveHeight(physics.x-2,physics.z,time))/4-physics.yawVelocity*physics.speed*.022,3,dt);
  for(let i=0;i<2;i++){const age=time-(i===0?leftStroke:rightStroke),s=i===0?-1:1,phase=T.MathUtils.clamp(age/.8,0,1);craft.oars[i].rotation.y=s*(-.55+phase*1.1);craft.oars[i].rotation.z=s*(age<.55?-Math.sin(phase*Math.PI)*.13:age<.8?.22:.16);}craft.wheel.rotation.z=-physics.yawVelocity*2;
  if(physics.collided&&time-lastCollision>5){notice('Shallow water. Ease back toward the creek.');lastCollision=time;}
  const h=physics.heading+orbitYaw;let camD=distance*(camera.aspect<1?1.35:1),camY=3+Math.sin(orbitPitch)*camD;
  if(state.camera===1){desired.set(physics.x+fx*5.5,2.3+boatY,physics.z+fz*5.5);look.set(physics.x-Math.sin(h)*40,3.1,physics.z-Math.cos(h)*40);}else{if(state.camera===2){camD=distance*1.3;camY=42;}desired.set(physics.x+Math.sin(h)*camD,camY+boatY,physics.z+Math.cos(h)*camD);look.set(physics.x+fx*6,1.5,physics.z+fz*6);}
  camera.position.lerp(desired,1-Math.exp(-dt*3.5));camera.lookAt(look);camera.updateMatrixWorld();
  sun.position.copy(sky.uniforms.sun.value).multiplyScalar(250).add(new T.Vector3(physics.x,0,physics.z));sun.target.position.set(physics.x,0,physics.z);sky.sky.position.copy(camera.position);sky.uniforms.time.value=time;
  world.update(time,boat.position);wildlife.update(time,boat.position,water);birds.update(time,boat.position);traffic.update(time,state.paused?0:dt,physics);water.setTraffic(traffic.vessels);water.update(time,boat.position,physics.heading,physics.speed);audio.update(time,camera,birds.birds);
  if(frame%12===0){$('speed').textContent=(Math.abs(physics.speed)*1.94384).toFixed(1);$('distance').textContent=Math.floor(physics.distance);$('heading-label').textContent=Math.cos(physics.heading)>0?'NORTHBOUND':'SOUTHBOUND';drawMap();const sound=audio.getStatus?.();Object.assign(canvas.dataset,{speed:physics.speed.toFixed(3),position:`${physics.x.toFixed(2)},${physics.z.toFixed(2)}`,heading:physics.heading.toFixed(3),fps:(1/frameAverage).toFixed(0),triangles:renderer.info.render.triangles,mode:state.mode,camera:state.camera,traffic:traffic.vessels.length,birds:birds.birds.length,audioLoaded:sound?.loadedRecordings??0,audioVoices:sound?.activeVoices??0,quality:pixelRatio.toFixed(2)});}
  // Reduce only rendering resolution on slower devices; handling still runs at a fixed step.
  if(frame>180&&frame%240===0&&frameAverage>.037&&pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);}
  if(time>noticeUntil)$('notice').classList.remove('visible');if(frame%4===0)renderer.shadowMap.needsUpdate=true;renderer.render(scene,camera);if(frame===2){$('loading').classList.add('done');canvas.dataset.ready='true';}frame++;
}
applyLight();updateUI();animate();

import * as T from 'three';
import { buildWorld, buildSky, center, width } from './world.js';
import { buildBoat } from './boat.js';
import { buildWater } from './water.js';
import { BoatPhysics } from './physics.js';
import { createWildlife } from './wildlife.js';
import { createTraffic } from './traffic.js';
import { buildBirds } from './birds.js';
import { createNatureAudio } from './nature-audio.js';
import { renderFieldGuide } from './field-guide.js';
import { PropulsionControls } from './propulsion-controls.js';
import { createRenderProfile } from './render-profile.js';
import { isPhoneDevice,readDeviceProfile } from './device-profile.js';

const $ = id => document.getElementById(id), canvas = $('scene');
const state = { mode:'motor', cruise:false, camera:0, sound:false, hidden:false, timeIndex:0, paused:false, graphics:'standard' };
const keys = new Set(), physics = new BoatPhysics(), audio = createNatureAudio();
const propulsion=new PropulsionControls(state,physics);
const mobileGraphics=matchMedia('(pointer:coarse),(max-width:760px)').matches;
const deviceProfile=readDeviceProfile(),phoneDevice=isPhoneDevice(deviceProfile);
let phoneAdviceSeen=false;try{phoneAdviceSeen=sessionStorage.getItem('bhitar-high-advice')==='seen';}catch{}
let renderer;
try { renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'}); }
catch (error) { $('loading').hidden=true; $('error').hidden=false; throw error; }
let pixelRatio = Math.min(devicePixelRatio, mobileGraphics?1.35:1.6);
renderer.setPixelRatio(pixelRatio); renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true; renderer.shadowMap.autoUpdate=false; renderer.shadowMap.needsUpdate=true; renderer.shadowMap.type=T.PCFShadowMap;
renderer.toneMapping=T.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15; renderer.outputColorSpace=T.SRGBColorSpace;
const renderProfile=createRenderProfile(renderer);
const gl=renderer.getContext(),debugRenderer=gl.getExtension('WEBGL_debug_renderer_info');
canvas.dataset.device=JSON.stringify({phone:phoneDevice,browser:deviceProfile.userAgent,gpu:debugRenderer?gl.getParameter(debugRenderer.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),maxTextureSize:renderer.capabilities.maxTextureSize});
const scene=new T.Scene(); scene.fog=new T.FogExp2(0xc5c8b4,.004);
const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.15,2600);
const hemi=new T.HemisphereLight(0xc6dce1,0x4d5136,1.85); scene.add(hemi);
const sun=new T.DirectionalLight(0xffd8a0,3.1); sun.castShadow=true; const shadowSize=mobileGraphics?1024:2048; sun.shadow.mapSize.set(shadowSize,shadowSize);
Object.assign(sun.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:100,far:340});
sun.shadow.bias=-.00008; sun.shadow.normalBias=.012;sun.shadow.radius=2;scene.add(sun,sun.target);
const sky=buildSky(scene), world=buildWorld(scene), craft=buildBoat(scene), water=buildWater(scene,sky.uniforms.sun.value);
const wildlife=createWildlife(scene), traffic=createTraffic(scene), birds=buildBirds(scene), boat=craft.boat;
const guide=renderFieldGuide($('guide-content'));
let time=0, accumulator=0, frame=0, noticeUntil=0, lastCollision=-10, previousFrame=performance.now(), frameAverage=.016;
let orbitYaw=.42, orbitPitch=.29, distance=26, boatY=0, verticalVelocity=0, strokeCount=0;
let highGraphics=null,highLoading=null,requestedGraphics='standard',graphicsRequest=0;
let climate=null,lightProfile=null,baseSunPower=3.1,baseAmbient=1.85,contextLost=false,contextEpoch=0,retiringLoad=null;
const drawingSize=new T.Vector2(),cameraTarget=new T.Vector3(0,1.5,-6),cameraBoatLocal=new T.Vector3();
const waterHeight=(x,z,t)=>water.heightAt(x,z,t);
const previousPose={x:physics.x,z:physics.z,heading:physics.heading},motion={...previousPose};
const shadowRight=new T.Vector3(),shadowUp=new T.Vector3(),shadowAnchor=new T.Vector3(),sunOffset=new T.Vector3();
const look=new T.Vector3(), desired=new T.Vector3(), up=new T.Vector3(0,1,0), pointers=new Map();
let pinchDistance=0; camera.position.set(12,10,25);
const map=$('minimap').getContext('2d');
const icons={motor:'<path d="M5 14h14l-3 5H8zM7 14V8h10v6M10 8V4h4v4M3 22q3-2 6 0t6 0t6 0"/>',row:'<path d="m5 3 12 14m-1-2 5 5-3 2-4-5M19 3 7 17m1-2-5 5 3 2 4-5"/>',play:'<path d="m8 5 11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>'};
function notice(text){$('notice').textContent=text;$('notice').classList.add('visible');noticeUntil=time+3;}
function setMore(open){$('more-panel').hidden=!open;$('more-button').setAttribute('aria-expanded',String(open));}
function updateUI(){
  const row=state.mode==='row'; $('mode-label').textContent=row?'Row':'Motor';$('mode-icon').innerHTML=icons[state.mode];
  $('mode-button').setAttribute('aria-label',row?'Rowing mode. Switch to motor':'Motor mode. Switch to rowing');
  $('cruise-button').setAttribute('aria-pressed',String(state.cruise));$('cruise-button').setAttribute('aria-label',row?(state.cruise?'Pause rowing':'Resume rowing'):(state.cruise?'Stop gentle cruise':'Start gentle cruise'));
  $('cruise-button').title=row?'Pause / resume rowing':'Gentle cruise';
  $('cruise-button').querySelector('svg').innerHTML=state.cruise?icons.pause:icons.play;
  $('touch-row').hidden=!row;$('touch-forward').hidden=row;
  $('camera-label').textContent=['Follow','On the bow','Overhead'][state.camera];
}
function cancelCruise(){if(state.cruise){state.cruise=false;updateUI();}}
function setMode(mode){keys.clear();propulsion.select(mode);updateUI();canvas.focus({preventScroll:true});const touch=matchMedia('(pointer:coarse),(max-width:700px)').matches;notice(mode==='row'?'A gentle rhythm. Pause to drift; steer any time.':(touch?'Hold the arrows to move and steer.':'W / S to move · A / D to steer'));}
function strokeEffect(side){
  strokeCount++;canvas.dataset.strokes=strokeCount;
}
function cycleCamera(){state.camera=(state.camera+1)%3;orbitYaw=state.camera===2?.55:.42;orbitPitch=.29;updateUI();notice(['Following the boat','On the bow','Above the mangroves'][state.camera]);}
let revealTimer;
function revealControls(){if(!state.hidden)return;document.body.classList.remove('cinematic-idle');clearTimeout(revealTimer);revealTimer=setTimeout(()=>document.body.classList.add('cinematic-idle'),2800);}
function hideUI(){setMore(false);state.hidden=!state.hidden;document.body.classList.toggle('hidden-ui',state.hidden);$('show-button').hidden=!state.hidden;clearTimeout(revealTimer);document.body.classList.remove('cinematic-idle');if(state.hidden)revealControls();}
addEventListener('pointermove',revealControls,{passive:true});addEventListener('pointerdown',revealControls,{passive:true});
const times=[
  {name:'Golden hour',top:'#86afbd',horizon:'#e6d9b8',fog:'#c5c8b4',sun:'#ffdaa9',power:3.1,ambient:1.85,exposure:1.15,dir:[-.45,.29,-.85]},
  {name:'Morning mist',top:'#82aab7',horizon:'#d1ddd4',fog:'#b7c9c0',sun:'#e9efe1',power:2.05,ambient:1.75,exposure:1.12,dir:[-.5,.22,-.7]},
  {name:'Blue hour',top:'#304969',horizon:'#c4a6a0',fog:'#667f80',sun:'#ddbcad',power:1.1,ambient:.95,exposure:1.1,dir:[-.5,.12,-.7]},
];
function applyLight(){
  document.body.classList.toggle('night-light',state.timeIndex===2||state.timeIndex===4);
  const p=times[state.timeIndex]??times[0],q=state.graphics==='high'?highGraphics?.getLighting(state.timeIndex,p):null;lightProfile=q;
  $('time-label').textContent=state.timeIndex===3?'Storm':state.timeIndex===4?'Moonlit Night':p.name;sky.uniforms.top.value.set(p.top);sky.uniforms.horizon.value.set(p.horizon);sky.uniforms.sun.value.set(...(q?.direction??p.dir)).normalize();
  scene.fog.color.set(q?.fog??p.fog);scene.fog.density=q?.fogDensity??(state.timeIndex===1?.0065:.004);
  sun.color.set(q?.sunColor??p.sun);sun.intensity=q?.sunPower??p.power;hemi.intensity=q?.ambient??p.ambient;
  baseSunPower=sun.intensity;baseAmbient=hemi.intensity;
  hemi.color.set(q?.hemiSky??0xc6dce1);hemi.groundColor.set(q?.hemiGround??0x4d5136);
  sun.shadow.bias=q?.shadowBias??-.00008;sun.shadow.normalBias=q?.normalBias??.012;
  water.uniforms.sunColor.value.set(q?.sunColor??p.sun);water.uniforms.sunDirection.value.copy(sky.uniforms.sun.value);
  water.setLighting?.(q);
  renderer.toneMappingExposure=q?.exposure??p.exposure;highGraphics?.setLighting(state.timeIndex,p,sky.uniforms.sun.value);
  renderer.shadowMap.needsUpdate=true;renderProfile.reset();
}
function changeTime(){state.timeIndex=(state.timeIndex+1)%(state.graphics==='high'?5:3);applyLight();notice($('time-label').textContent);}
function reset(){keys.clear();physics.reset();propulsion.reset();craft.rowingVisual.reset();accumulator=0;Object.assign(previousPose,{x:physics.x,z:physics.z,heading:physics.heading});Object.assign(motion,previousPose);boatY=verticalVelocity=0;state.camera=0;orbitYaw=.42;orbitPitch=.29;distance=26;water.uniforms.ripples.value.forEach(r=>r.z=-100);renderProfile.reset();updateUI();setMore(false);notice('Back at the landing.');}

function applyGraphics(mode){
  const high=mode==='high',changed=state.graphics!==mode;state.graphics=mode;
  if(!high&&state.timeIndex>2)state.timeIndex=state.timeIndex===4?2:1;
  if(changed){
    highGraphics?.setEnabled(high);water.setQuality(high);
    // The 68 m stabilized shadow volume resolves deck contacts at ~2.2 cm.
    // Spend the saved fill rate on near foliage and the full-resolution image.
    const size=Math.min(high?3072:shadowSize,renderer.capabilities.maxTextureSize);sun.shadow.mapSize.set(size,size);sun.shadow.map?.dispose();sun.shadow.map=null;
    sun.shadow.radius=high?2.5:2;pixelRatio=Math.min(devicePixelRatio,high?2:mobileGraphics?1.35:1.6);
    renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);frameAverage=.016;
    renderer.getDrawingBufferSize(drawingSize);highGraphics?.setSize(drawingSize.x,drawingSize.y);
  }
  if(!high){climate=null;water.setWeather?.(null);audio.setWeather?.(null);}
  $('graphics-label').textContent=high?'High':'Standard';
  $('graphics-standard').setAttribute('aria-pressed',String(!high));$('graphics-high').setAttribute('aria-pressed',String(high));
  // These diagnostics make quality transitions inspectable without exposing scene internals.
  canvas.dataset.graphics=mode;canvas.dataset.graphicsTransition=JSON.stringify({position:[physics.x,physics.z],camera:state.camera,mode:state.mode,distance:physics.distance,cruise:state.cruise});applyLight();
}
water.setPassHooks({
  beforeReflection(context){if(state.graphics==='high')highGraphics?.beginReflection(context);},
  afterReflection(){if(state.graphics==='high')highGraphics?.endReflection();}
});
async function selectGraphics(mode){
  if(contextLost)return;
  if(mode==='high'&&retiringLoad){$('graphics-status').textContent='Finishing graphics recovery. Standard is ready; High will be available shortly.';return;}
  if(mode==='high'&&phoneDevice&&!phoneAdviceSeen){$('phone-high-warning').hidden=false;$('graphics-options').hidden=true;$('graphics-status').textContent='';return;}
  $('phone-high-warning').hidden=true;$('graphics-options').hidden=false;
  requestedGraphics=mode;const request=++graphicsRequest;
  if(mode==='standard'){
    applyGraphics(mode);$('graphics-progress').hidden=true;$('graphics-status').textContent='Standard is ready. Lightweight graphics for every visit.';
    if($('graphics-dialog').open)$('graphics-dialog').close();canvas.focus({preventScroll:true});return;
  }
  try{
    if(renderer.capabilities.maxTextureSize<2048)throw new Error('High requires 2048-pixel render targets.');
    if(!renderer.extensions.has('EXT_color_buffer_float')){
      $('graphics-progress').hidden=true;$('graphics-status').textContent='High needs HDR lighting support that this browser cannot provide. Standard is ready.';requestedGraphics='standard';return;
    }
    $('graphics-progress').hidden=false;
    if(!highGraphics){
      const epoch=contextEpoch;
      if(!highLoading)highLoading=(async()=>{
        const {loadHighGraphics}=await import('./high-graphics.js');
        return loadHighGraphics({scene,renderer,sky,world,craft,birds,wildlife,traffic,waterHeight,isCurrent:()=>epoch===contextEpoch&&!contextLost,onProgress:(message,value)=>{
          if(requestedGraphics!=='high')return;$('graphics-status').textContent=message+'…';$('graphics-progress').value=value;
        }});
      })();
      const prepared=await highLoading;if(epoch!==contextEpoch){prepared.dispose();return;}highGraphics=prepared;
    }
    if(requestedGraphics!=='high'||request!==graphicsRequest)return;
    applyGraphics('high');highGraphics.update(time,0,boat.position,camera);
    $('graphics-status').textContent='Preparing the scene…';$('graphics-progress').value=.96;
    await renderer.compileAsync(scene,camera);
    if(requestedGraphics!=='high'||request!==graphicsRequest)return;
    $('graphics-progress').hidden=true;$('graphics-status').textContent='High is ready.';
    if($('graphics-dialog').open)$('graphics-dialog').close();canvas.focus({preventScroll:true});notice('High graphics · a closer look at the creek');
  }catch(error){
    highLoading=null;if(requestedGraphics==='high'&&request===graphicsRequest){applyGraphics('standard');requestedGraphics='standard';$('graphics-progress').hidden=true;$('graphics-status').textContent='High could not finish loading. Standard is still available. Try High again.';}
    console.warn('High graphics could not load:',error);
  }
}
async function toggleAudio(){
  const button=$('sound-button');button.disabled=true;
  try{state.sound=await audio.setEnabled(!state.sound);button.setAttribute('aria-pressed',String(state.sound));button.setAttribute('aria-label',state.sound?'Mute nature sounds':'Enable nature sounds');button.querySelector('svg').innerHTML=state.sound?'<path d="m11 4-6 5H2v6h3l6 5zM16 8q5 4 0 8m3-11q8 7 0 14"/>':'<path d="m11 4-6 5H2v6h3l6 5zM16 9l5 6m0-6-5 6"/>';notice(state.sound?'Listen for the kingfishers.':'Sound off.');}
  catch(error){state.sound=false;notice('Bird recordings couldn’t load. Try sound again.');console.warn(error.message);}
  finally{button.disabled=false;}
}
function openDialog(id){keys.clear();setMore(false);$('notice').classList.remove('visible');state.paused=true;$(id).showModal();if(id==='field-guide'){$('guide-button').setAttribute('aria-expanded','true');guide.loadImages?.();}}
for(const id of ['help-dialog','field-guide','graphics-dialog']){
  $(id).addEventListener('close',()=>{state.paused=false;keys.clear();if(id==='field-guide'){guide.stopAudio();$('guide-button').setAttribute('aria-expanded','false');}});
  $(id).addEventListener('click',event=>{if(event.target!==$(id))return;const r=$(id).getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$(id).close();});
}
$('mode-button').onclick=()=>setMode(state.mode==='motor'?'row':'motor');
$('cruise-button').onclick=()=>{keys.clear();propulsion.toggle();updateUI();canvas.focus({preventScroll:true});notice(state.mode==='row'?(state.cruise?'A gentle rowing rhythm.':'Finishing the stroke, then drifting.'):(state.cruise?'Gentle cruise. Steer to take the helm.':'You have the helm.'));};
$('camera-button').onclick=cycleCamera;$('time-button').onclick=changeTime;$('sound-button').onclick=toggleAudio;$('hide-button').onclick=hideUI;$('show-button').onclick=hideUI;$('reset-button').onclick=reset;
$('more-button').onclick=()=>setMore($('more-panel').hidden);$('help-button').onclick=()=>openDialog('help-dialog');$('close-help').onclick=()=>$('help-dialog').close();
$('guide-button').onclick=()=>openDialog('field-guide');$('close-guide').onclick=()=>$('field-guide').close();$('reload-button').onclick=()=>location.reload();
$('graphics-button').onclick=()=>openDialog('graphics-dialog');$('close-graphics').onclick=()=>$('graphics-dialog').close();
$('graphics-standard').onclick=()=>selectGraphics('standard');$('graphics-high').onclick=()=>selectGraphics('high');
function acknowledgePhoneAdvice(){phoneAdviceSeen=true;try{sessionStorage.setItem('bhitar-high-advice','seen');}catch{}}
$('phone-high-continue').onclick=()=>{acknowledgePhoneAdvice();selectGraphics('high');};
$('phone-high-standard').onclick=()=>{acknowledgePhoneAdvice();selectGraphics('standard');};
document.addEventListener('pointerdown',event=>{if(!event.target.closest('.bottom'))setMore(false);});
document.addEventListener('keydown',event=>{if(event.code==='Escape')setMore(false);});
const controlled=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
addEventListener('keydown',event=>{
  if(state.paused||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;
  if(controlled.has(event.code)){if(event.code==='Space'&&event.target.closest('button'))return;event.preventDefault();keys.add(event.code);if(!event.repeat){propulsion.manual(event.code);updateUI();}}
  if(event.repeat)return;if(event.code==='KeyR')setMode(state.mode==='motor'?'row':'motor');if(event.code==='KeyC')cycleCamera();if(event.code==='KeyH')hideUI();if(event.key==='?')openDialog('help-dialog');
});
addEventListener('keyup',event=>keys.delete(event.code));addEventListener('blur',()=>{keys.clear();physics.cancelRowing();pointers.clear();pinchDistance=0;});
document.addEventListener('visibilitychange',()=>{keys.clear();pointers.clear();previousFrame=performance.now();});
function pointerGap(){const p=[...pointers.values()];return p.length>=2?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0;}
canvas.addEventListener('pointerdown',event=>{pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});canvas.setPointerCapture(event.pointerId);pinchDistance=pointerGap();canvas.focus({preventScroll:true});});
canvas.addEventListener('pointermove',event=>{const previous=pointers.get(event.pointerId);if(!previous)return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size>1){const gap=pointerGap();if(pinchDistance>0&&gap>0)distance=T.MathUtils.clamp(distance*pinchDistance/gap,15,55);pinchDistance=gap;}else{orbitYaw-=(event.clientX-previous.x)*.006;orbitPitch=T.MathUtils.clamp(orbitPitch+(event.clientY-previous.y)*.004,.07,.95);}});
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{pointers.delete(event.pointerId);pinchDistance=pointerGap();});
canvas.addEventListener('wheel',event=>{event.preventDefault();distance=T.MathUtils.clamp(distance+event.deltaY*.022,15,55);},{passive:false});
$('touch-row').dataset.key='Space';
for(const button of document.querySelectorAll('[data-key]')){
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);keys.add(button.dataset.key);propulsion.manual(button.dataset.key);updateUI();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>keys.delete(button.dataset.key));
}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(state.graphics==='high'){pixelRatio=Math.min(devicePixelRatio,2);renderer.setPixelRatio(pixelRatio);}renderer.setSize(innerWidth,innerHeight);renderer.getDrawingBufferSize(drawingSize);highGraphics?.setSize(drawingSize.x,drawingSize.y);});
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();contextLost=true;contextEpoch++;graphicsRequest++;keys.clear();audio.setWeather?.(null);if(highLoading&&!highGraphics){retiringLoad=highLoading.catch(()=>{});retiringLoad.finally(()=>{retiringLoad=null;$('graphics-high').disabled=contextLost;});}$('graphics-high').disabled=true;$('graphics-progress').hidden=true;$('error-message').textContent='The graphics connection was interrupted. Your journey is paused while it reconnects. Reload if it does not recover.';$('error').hidden=false;});
canvas.addEventListener('webglcontextrestored',()=>{highGraphics?.dispose();highGraphics=null;highLoading=null;requestedGraphics='standard';contextLost=false;previousFrame=performance.now();renderProfile.rebind();applyGraphics('standard');$('graphics-high').disabled=Boolean(retiringLoad);$('error').hidden=true;notice('Graphics restored in Standard. Your journey is ready.');});
function getInput(){
  let throttle=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),steer=(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0);
  if(state.cruise){const target=physics.z-30,angle=Math.atan2(physics.x-center(target),30);const delta=T.MathUtils.euclideanModulo(angle-physics.heading+Math.PI,Math.PI*2)-Math.PI;if(!steer)steer=T.MathUtils.clamp(delta*2.8,-1,1);if(state.mode==='motor')throttle=physics.speed<2.3?.7:.2;if(physics.z<-1000){cancelCruise();physics.rowing.pending=0;notice('End of the creek. Turn around or start again.');throttle=0;}}
  return {mode:state.mode,throttle,steer,brake:state.mode==='motor'?keys.has('Space'):throttle<0,rowLeft:keys.has('KeyQ'),rowRight:keys.has('KeyE'),rowBoth:keys.has('Space')||throttle>0};
}
function drawMap(){
  const w=240,h=170,cz=physics.z-60,mx=x=>120+(x-center(cz))*.6,my=z=>85+(z-cz)*.38;map.clearRect(0,0,w,h);map.lineWidth=1;map.strokeStyle='#d2dfc810';
  for(let x=0;x<w;x+=30){map.beginPath();map.moveTo(x,0);map.lineTo(x,h);map.stroke();}for(let y=0;y<h;y+=30){map.beginPath();map.moveTo(0,y);map.lineTo(w,y);map.stroke();}
  map.beginPath();for(let z=cz-240;z<=cz+240;z+=8)map.lineTo(mx(center(z)-width(z)),my(z));for(let z=cz+240;z>=cz-240;z-=8)map.lineTo(mx(center(z)+width(z)),my(z));map.closePath();map.fillStyle='#c5d6bd2a';map.fill();map.strokeStyle='#d3ddc150';map.stroke();
  for(const vessel of traffic.vessels){map.fillStyle=vessel.kind==='police'?'#b1d5dfaa':'#d1dbc786';map.beginPath();map.arc(mx(vessel.x),my(vessel.z),2,0,Math.PI*2);map.fill();}
  map.save();map.translate(mx(physics.x),my(physics.z));map.rotate(-physics.heading);map.fillStyle='#f5d692';map.beginPath();map.moveTo(0,-7);map.lineTo(4,5);map.lineTo(0,3);map.lineTo(-4,5);map.closePath();map.fill();map.restore();
}
function animate(){
  requestAnimationFrame(animate);const now=performance.now(),rawDelta=(now-previousFrame)/1000;previousFrame=now;if(document.hidden||contextLost)return;const dt=Math.min(rawDelta,.05);frameAverage=frameAverage*.97+rawDelta*.03;
  if(state.graphics==='high'){climate=highGraphics?.advanceWeather(time,state.paused?0:dt,boat.position,camera);water.setWeather?.(climate);audio.setWeather?.(climate);sun.intensity=baseSunPower+(climate?.flash??0)*9;hemi.intensity=baseAmbient+(climate?.flash??0)*1.9;}
  if(!state.paused){time+=dt;accumulator+=dt;const input=getInput();while(accumulator>=1/60){Object.assign(previousPose,{x:physics.x,z:physics.z,heading:physics.heading});propulsion.update(1/60);physics.step(1/60,input,time);for(let side=0;side<2;side++)if(physics.rowStarted&(1<<side))strokeEffect(side);accumulator-=1/60;}}
  const blend=accumulator*60;for(const key of ['x','z','heading'])motion[key]=T.MathUtils.lerp(previousPose[key],physics[key],blend);
  boat.position.set(motion.x,boatY,motion.z);boat.rotation.y=motion.heading;
  // Publish the current High vessel field before buoyancy and blade contacts
  // sample it, so geometry, normals and contact heights use one water surface.
  if(state.graphics==='high'){traffic.update(time,state.paused?0:dt,physics);water.setTraffic(traffic.vessels);water.update(time,boat.position,motion.heading,physics.speed);traffic.followSurface(time,state.paused?0:dt,waterHeight);}
  const targetY=waterHeight(motion.x,motion.z,time);verticalVelocity+=(targetY-boatY)*16*dt-verticalVelocity*5.5*dt;boatY+=verticalVelocity*dt;boat.position.y=boatY;
  const fx=-Math.sin(motion.heading),fz=-Math.cos(motion.heading),pitch=(waterHeight(motion.x+fx*5,motion.z+fz*5,time)-waterHeight(motion.x-fx*5,motion.z-fz*5,time))/10;
  boat.rotation.x=T.MathUtils.damp(boat.rotation.x,-pitch,3,dt);boat.rotation.z=T.MathUtils.damp(boat.rotation.z,(waterHeight(motion.x+2,motion.z,time)-waterHeight(motion.x-2,motion.z,time))/4-physics.yawVelocity*physics.speed*.022,3,dt);
  craft.rowingVisual.update({time,dt:state.paused?0:dt,mode:state.mode,rowing:physics.rowing,interpolation:accumulator,high:state.graphics==='high',waterHeight,onContact:(x,z,strength,side,entry,travel)=>{water.ripple(x,z,time,strength,travel);if(entry)audio.splash();}});craft.wheel.rotation.z=-physics.yawVelocity*2;
  if(physics.collided&&time-lastCollision>5){notice('Shallow water. Ease back toward the creek.');lastCollision=time;}
  const h=motion.heading+orbitYaw;let camD=distance*(camera.aspect<1?1.35:1),camY=3+Math.sin(orbitPitch)*camD;
  if(state.camera===1){desired.set(motion.x+fx*5.5,2.3+boatY,motion.z+fz*5.5);look.set(motion.x-Math.sin(h)*40,3.1,motion.z-Math.cos(h)*40);}else{if(state.camera===2){camD=distance*1.3;camY=42;}desired.set(motion.x+Math.sin(h)*camD,camY+boatY,motion.z+Math.cos(h)*camD);look.set(motion.x+fx*6,1.5,motion.z+fz*6);}
  // Keep all three established views, with a smooth aim transition and a safe
  // bank/roof clearance when orbiting. Bow looks from just ahead of the pennant.
  if(state.camera===1){desired.x=motion.x+fx*7.75;desired.z=motion.z+fz*7.75;desired.y=2.55+boatY;}
  const bankDistance=Math.abs(desired.x-center(desired.z))-width(desired.z);
  if(bankDistance>0)desired.y=Math.max(desired.y,2.4+Math.min(bankDistance*.15,3));
  boat.updateMatrixWorld(true);cameraBoatLocal.copy(camera.position);boat.worldToLocal(cameraBoatLocal);
  if(Math.abs(cameraBoatLocal.x)<2.65&&cameraBoatLocal.z> -4.8&&cameraBoatLocal.z<5.3&&desired.y<4.75+boatY)desired.y=4.75+boatY;
  camera.position.lerp(desired,1-Math.exp(-dt*3.5));camera.position.y=Math.max(camera.position.y,waterHeight(camera.position.x,camera.position.z,time)+.65);
  cameraBoatLocal.copy(camera.position);boat.worldToLocal(cameraBoatLocal);
  if(Math.abs(cameraBoatLocal.x)<2.35&&cameraBoatLocal.z> -4.15&&cameraBoatLocal.z<4.9&&cameraBoatLocal.y<4.35){cameraBoatLocal.y=4.35;boat.localToWorld(cameraBoatLocal);camera.position.copy(cameraBoatLocal);}
  cameraTarget.lerp(look,1-Math.exp(-dt*4.2));camera.lookAt(cameraTarget);camera.updateMatrixWorld();
  // Quantize in light-space, so a moving camera cannot make shadow texels crawl.
  shadowRight.crossVectors(up,sky.uniforms.sun.value).normalize();shadowUp.crossVectors(sky.uniforms.sun.value,shadowRight).normalize();
  shadowAnchor.set(motion.x,0,motion.z);const texel=68/sun.shadow.mapSize.x;
  const sx=shadowAnchor.dot(shadowRight),sy=shadowAnchor.dot(shadowUp);
  shadowAnchor.addScaledVector(shadowRight,Math.round(sx/texel)*texel-sx).addScaledVector(shadowUp,Math.round(sy/texel)*texel-sy);
  sun.position.copy(sunOffset.copy(sky.uniforms.sun.value).multiplyScalar(250)).add(shadowAnchor);sun.target.position.copy(shadowAnchor);sky.sky.position.copy(camera.position);sky.uniforms.time.value=time;
  world.update(time,boat.position);wildlife.update(time,boat.position,water);birds.update(time,boat.position);if(state.graphics!=='high'){traffic.update(time,state.paused?0:dt,physics);water.setTraffic(traffic.vessels);water.update(time,boat.position,physics.heading,physics.speed);}audio.update(time,camera,birds.birds);
  if(state.graphics==='high')highGraphics?.update(time,state.paused?0:dt,boat.position,camera);
  if(frame%12===0){$('speed').textContent=(Math.abs(physics.speed)*1.94384).toFixed(1);$('distance').textContent=Math.floor(physics.distance);$('heading-label').textContent=Math.cos(physics.heading)>0?'NORTHBOUND':'SOUTHBOUND';drawMap();const sound=audio.getStatus?.();Object.assign(canvas.dataset,{speed:physics.speed.toFixed(3),position:`${physics.x.toFixed(2)},${physics.z.toFixed(2)}`,heading:physics.heading.toFixed(3),fps:(1/frameAverage).toFixed(0),triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,programs:renderer.info.programs.length,forest:JSON.stringify(world.getStats?.()??{}),mode:state.mode,camera:state.camera,rowing:JSON.stringify(craft.rowingVisual.getStats()),rowingAges:JSON.stringify(physics.rowing.ages),traffic:traffic.vessels.length,birds:birds.birds.length,audioLoaded:sound?.loadedRecordings??0,audioVoices:sound?.activeVoices??0,quality:pixelRatio.toFixed(2)});}
  // Reduce only rendering resolution on slower devices; handling still runs at a fixed step.
  if(state.graphics==='standard'&&frame>180&&frame%240===0&&frameAverage>.037&&pixelRatio>1){pixelRatio=Math.max(1,pixelRatio-.15);renderer.setPixelRatio(pixelRatio);renderer.setSize(innerWidth,innerHeight);}
  if(time>noticeUntil)$('notice').classList.remove('visible');renderer.shadowMap.needsUpdate=true;renderProfile.begin();
  try{if(state.graphics==='high')highGraphics.render(scene,camera,sky.uniforms.sun.value,renderProfile);else renderer.render(scene,camera);}catch(error){if(contextLost)return;console.error('High rendering could not continue',error);requestedGraphics='standard';graphicsRequest++;$('graphics-progress').hidden=true;$('graphics-status').textContent='High could not continue. Standard is ready.';applyGraphics('standard');notice('High could not continue. Standard is ready.');}finally{renderProfile.end();}
  if(frame%30===0){canvas.dataset.renderPasses=JSON.stringify(renderProfile.getStats());canvas.dataset.weather=JSON.stringify(climate?{preset:climate.preset,rain:climate.rain,wetness:climate.wetness,flash:climate.flash,strikes:climate.strikes,wind:climate.wind}:null);canvas.dataset.highStats=JSON.stringify(highGraphics?.getStats()??{});}
  if(frame===2){$('loading').classList.add('done');canvas.dataset.ready='true';canvas.dataset.graphics=state.graphics;}frame++;
}
applyLight();updateUI();animate();

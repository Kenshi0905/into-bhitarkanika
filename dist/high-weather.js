import * as T from 'three';
import {center,width} from './channel.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const approach=(value,target,rate,dt)=>value+(target-value)*(1-Math.exp(-rate*dt));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};

// Broad rain cells cross the creek in the shared wind. Individual streaks and
// their water impacts sample the same field instead of forming a screen overlay.
export function rainDensityAt(x,z,time,wind){
 const travel=time*(1.1+(wind?.strength??0)*2.1),px=(x-(wind?.x??.6)*travel)*.052,pz=(z-(wind?.z??.8)*travel)*.052;
 const field=.5+.28*Math.sin(px*.72+Math.sin(pz*.43))+.22*Math.sin(pz*1.19-px*.24+1.7);
 return .09+.91*smooth(.25,.80,field);
}

// The same bounded climate clock drives rain, leaf motion, buoyancy, shader
// wetting, sky flash and audio. No simulation state or voyage state lives here.
export function createClimateState(seed=43091){
 let enabled=false,preset=0,rain=0,wetness=0,strength=.24,untilStrike=10,flashAge=10,strikes=0;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const state={wind:{x:.6247,z:.7809,strength:0,gust:0},rain:0,wetness:0,flash:0,time:0,preset:0,strikes:0};
 return {
  setEnabled(value){enabled=Boolean(value);if(!enabled){state.rain=0;state.flash=0;state.wind.strength=0;}},
  setLighting(index){const next=Math.max(0,Math.min(4,index|0));if(next===3&&preset!==3)untilStrike=8+random()*6;preset=next;state.preset=preset;if(preset!==3)flashAge=10;},
  update(time,dt){
   dt=clamp(dt,0,.1);state.time=Number.isFinite(time)?time:state.time+dt;
   if(!enabled)return state;
   const storm=preset===3,gust=.5+.28*Math.sin(state.time*.63)+.15*Math.sin(state.time*1.71+1.8)+.07*Math.sin(state.time*.19);
   rain=approach(rain,storm?1:0,storm?.58:.9,dt);
   strength=approach(strength,storm?.79+gust*.18:([.27,.18,.24,.9,.21][preset]+gust*.07),.8,dt);
   wetness=clamp(wetness+dt*(rain*.045-(1-rain)*.007));
   flashAge+=dt;
   if(storm&&rain>.7){untilStrike-=dt;if(untilStrike<=0){strikes++;flashAge=0;untilStrike=19+random()*22;}}
   const flash=storm?Math.exp(-flashAge*flashAge/0.010)+.58*Math.exp(-Math.pow((flashAge-.19)/.045,2)):0;
   const angle=.90+Math.sin(state.time*.047)*.17;
   state.wind.x=Math.cos(angle);state.wind.z=Math.sin(angle);state.wind.strength=clamp(strength);state.wind.gust=clamp(gust);
   state.rain=rain;state.wetness=wetness;state.flash=clamp(flash);state.strikes=strikes;
   return state;
  },
  getState(){return state;}
 };
}

export function createHighWeather(context){
 const {scene,craft}=context,climate=createClimateState(),group=new T.Group();
 group.name='High local rain and surface contact';group.visible=false;scene.add(group);
 const count=840,splashCount=112,positions=new Float32Array(count*6),opacities=new Float32Array(count*2),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 geometry.setAttribute('rainOpacity',new T.BufferAttribute(opacities,1).setUsage(T.DynamicDrawUsage));
 const rainMaterial=new T.LineBasicMaterial({name:'Wind-driven rain',color:0xc0d1d7,transparent:true,opacity:0,depthWrite:false,fog:true});
 rainMaterial.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float rainOpacity;varying float vRainOpacity;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRainOpacity=rainOpacity;');
  shader.fragmentShader='varying float vRainOpacity;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=vRainOpacity;');
 };
 rainMaterial.customProgramCacheKey=()=> 'spatial-estuary-rain-v1';
 const rainMesh=new T.LineSegments(geometry,rainMaterial);rainMesh.frustumCulled=false;rainMesh.renderOrder=8;group.add(rainMesh);
 let seed=97823;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const drops=Array.from({length:count},()=>({x:(random()-.5)*94,z:(random()-.5)*94,y:random()*32,length:.18+random()*.94,speed:.69+random()*.59,opacity:.32+random()*.68}));
 const splashMaterial=new T.ShaderMaterial({name:'Rain water-contact rings',transparent:true,depthWrite:false,side:T.DoubleSide,uniforms:{rain:{value:0}},
  vertexShader:'varying vec2 uvRain;varying float rainAge,rainEnergy;attribute float age,energy;void main(){uvRain=uv;rainAge=age;rainEnergy=energy;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec2 uvRain;varying float rainAge,rainEnergy;uniform float rain;void main(){float r=length(uvRain-.5)*2.;float ring=1.-smoothstep(.027,.085,abs(r-.71));ring+=.24*(1.-smoothstep(.028,.075,abs(r-.39)))*(1.-rainAge);float fade=smoothstep(0.,.12,rainAge)*(1.-rainAge)*(1.-smoothstep(.75,1.,rainAge));float alpha=ring*fade*rain*rainEnergy*.37;if(alpha<.004)discard;gl_FragColor=vec4(.56,.70,.74,alpha);#include <tonemapping_fragment>\n#include <colorspace_fragment>}'.replace(';#include',';\n#include')});
 const splashGeometry=new T.PlaneGeometry(1,1),ages=new T.InstancedBufferAttribute(new Float32Array(splashCount),1).setUsage(T.DynamicDrawUsage),energies=new T.InstancedBufferAttribute(new Float32Array(splashCount),1).setUsage(T.DynamicDrawUsage);splashGeometry.setAttribute('age',ages);splashGeometry.setAttribute('energy',energies);
 const splashes=new T.InstancedMesh(splashGeometry,splashMaterial,splashCount);splashes.name='Rain contacts on estuary surface';splashes.frustumCulled=false;splashes.renderOrder=9;splashes.instanceMatrix.setUsage(T.DynamicDrawUsage);group.add(splashes);
 const contacts=Array.from({length:splashCount},()=>({x:0,z:0,age:1,life:1,radius:.3,stretch:1,energy:0})),dummy=new T.Object3D();dummy.rotation.x=-Math.PI/2;
 let enabled=false,disposed=false,reflectionDepth=0,priorVisible=false,lastOrigin=null,contactCursor=0,activeContacts=0;
 const height=(x,z,t)=>context.waterHeight?.(x,z,t)??climate.getState().waterHeight?.(x,z,t)??0;
 function newContact(x,z,patch,origin){
  if(Math.abs(x-center(z))>width(z)-1.5)return;
  const hull=craft?.boat?.position??origin,angle=craft?.boat?.rotation.y??0,dx=x-hull.x,dz=z-hull.z;
  const localX=dx*Math.cos(angle)-dz*Math.sin(angle),localZ=dx*Math.sin(angle)+dz*Math.cos(angle);
  if(Math.abs(localX)<2.5&&Math.abs(localZ)<8.1)return;
  if(random()>patch*.74)return;
  for(let search=0;search<splashCount;search++){
   const c=contacts[contactCursor];contactCursor=(contactCursor+1)%splashCount;if(c.age<1)continue;
   c.x=x;c.z=z;c.age=0;c.life=.28+random()*.78;c.radius=.18+random()*.48;c.stretch=.8+random()*.4;c.energy=patch*(.55+random()*.45);return;
  }
 }
 return {
  setEnabled(value){if(disposed)return;enabled=Boolean(value);climate.setEnabled(enabled);group.visible=enabled&&!reflectionDepth;},
  setLighting(index){climate.setLighting(index);},
  update(time,dt,boatPosition,camera){
   const state=climate.update(time,dt);if(!enabled)return;
   const origin=boatPosition??camera.position;const rain=state.rain;
   group.visible=rain>.005&&!reflectionDepth;rainMaterial.opacity=rain*.48;splashMaterial.uniforms.rain.value=rain;
   if(rain<.005)return;
   const teleport=lastOrigin&&Math.hypot(lastOrigin.x-origin.x,lastOrigin.z-origin.z)>20;
   if(!lastOrigin)lastOrigin={x:origin.x,z:origin.z};
   const moveX=origin.x-lastOrigin.x,moveZ=origin.z-lastOrigin.z;lastOrigin.x=origin.x;lastOrigin.z=origin.z;
   const vx=state.wind.x*state.wind.strength*6.8,vz=state.wind.z*state.wind.strength*6.8,fall=18.5;
   const hull=craft?.boat,heading=hull?.rotation.y??0,cos=Math.cos(heading),sin=Math.sin(heading);
   for(let i=0;i<count;i++){
    const d=drops[i];d.x+=vx*dt-moveX;d.z+=vz*dt-moveZ;d.y-=fall*d.speed*dt;
    if(d.y<0){const impactX=origin.x+d.x,impactZ=origin.z+d.z;newContact(impactX,impactZ,rainDensityAt(impactX,impactZ,time,state.wind),origin);d.y+=32;d.x=(random()-.5)*94;d.z=(random()-.5)*94;}
    if(d.x>47)d.x-=94;if(d.x< -47)d.x+=94;if(d.z>47)d.z-=94;if(d.z< -47)d.z+=94;
    const x=origin.x+d.x,z=origin.z+d.z,j=i*6;let y=height(x,z,time)+d.y;
    if(hull){
     const dx=x-hull.position.x,dz=z-hull.position.z,lx=dx*cos-dz*sin,lz=dx*sin+dz*cos;
     if(Math.abs(lx)<2.15&&lz> -3.9&&lz<4.7&&y<hull.position.y+3.39+.52*Math.cos(lx/4.25*Math.PI)){d.y+=32;y+=32;}
    }
    positions[j]=x;positions[j+1]=y;positions[j+2]=z;
    positions[j+3]=x-vx*d.length/(fall*d.speed);positions[j+4]=y+d.length;positions[j+5]=z-vz*d.length/(fall*d.speed);
    const nearbyFade=smooth(1.4,7,Math.hypot(x-camera.position.x,z-camera.position.z)),patch=rainDensityAt(x,z,time,state.wind);
    opacities[i*2]=patch*d.opacity*nearbyFade;opacities[i*2+1]=opacities[i*2]*.22;
   }
   geometry.attributes.position.needsUpdate=true;geometry.attributes.rainOpacity.needsUpdate=true;activeContacts=0;
   for(let i=0;i<splashCount;i++){
    const c=contacts[i];c.age=Math.min(1,c.age+dt/c.life);if(teleport||Math.hypot(c.x-origin.x,c.z-origin.z)>65)c.age=1;
    if(c.age<1)activeContacts++;
    const radius=.045+c.age*c.radius;dummy.position.set(c.x,height(c.x,c.z,time)+.018,c.z);dummy.scale.set(radius*c.stretch,radius,1);dummy.updateMatrix();splashes.setMatrixAt(i,dummy.matrix);ages.setX(i,c.age);energies.setX(i,c.energy);
   }
   ages.needsUpdate=true;energies.needsUpdate=true;splashes.instanceMatrix.needsUpdate=true;
  },
  getState(){return climate.getState();},
  getStats(){return {rainStreaks:enabled&&climate.getState().rain>.005?count:0,splashInstances:enabled&&climate.getState().rain>.005?splashCount:0,activeContacts,spatialRain:true,drawCalls:enabled&&climate.getState().rain>.005?2:0};},
  beginReflection(){if(reflectionDepth++===0){priorVisible=group.visible;group.visible=false;}},
  endReflection(){if(reflectionDepth>0&&--reflectionDepth===0)group.visible=enabled&&priorVisible;},
  dispose(){if(disposed)return;this.setEnabled(false);disposed=true;group.removeFromParent();geometry.dispose();rainMaterial.dispose();splashGeometry.dispose();splashMaterial.dispose();}
 };
}

import * as T from 'three';
import { Water } from './vendor/Water.js';
import {ESTUARY_GLSL,sampleEstuary,sampleLaunchWake,nearWaterAxis} from './water-motion.js';

// Buoyancy and vertex displacement share this low-amplitude tidal wave field.
export function waveHeight(x,z,t,wind=1){return wind*(.043*Math.sin(x*.24+z*.16+t*.9)+.025*Math.sin(x*-.43+z*.3-t*1.2)+.012*Math.sin(x*.87+z*.59+t*1.7));}
export function buildWater(scene,sun){
 const mobile=typeof matchMedia==='function'&&matchMedia('(pointer: coarse), (max-width: 760px)').matches;
 const normal=new T.TextureLoader().load('./assets/waternormals.jpg');normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.anisotropy=8;
 const reflectionSize=mobile?512:1024;
 const water=new Water(new T.PlaneGeometry(2400,2400,mobile?144:220,mobile?144:220),{textureWidth:reflectionSize,textureHeight:reflectionSize,waterNormals:normal,sunDirection:sun,sunColor:0xffe7bb,waterColor:0x354337,distortionScale:1.35,fog:true});water.rotation.x=-Math.PI/2;
 const m=water.material;m.uniforms.size.value=1;
 m.uniforms.boatPosition={value:new T.Vector2()};m.uniforms.boatDirection={value:new T.Vector2(0,-1)};m.uniforms.boatSpeed={value:0};m.uniforms.wind={value:1};m.uniforms.ripples={value:Array.from({length:32},()=>new T.Vector4(0,0,-100,0))};
 m.uniforms.rippleDirections={value:Array.from({length:32},()=>new T.Vector4(1,0,0,0))};m.uniforms.keyGlint={value:.55};
 m.uniforms.highQuality={value:0};m.uniforms.boatSignedSpeed={value:0};m.uniforms.reflectionTexel={value:1/reflectionSize};
 m.uniforms.windDirection={value:new T.Vector2(.8,-.6)};m.uniforms.rainAmount={value:0};m.uniforms.lightning={value:0};m.uniforms.waterTint={value:new T.Color('#718578')};m.uniforms.waterLight={value:1};
 m.uniforms.trafficPositions={value:Array.from({length:4},()=>new T.Vector4(0,0,0,0))};m.uniforms.trafficDirections={value:Array.from({length:4},()=>new T.Vector2(0,-1))};
 m.vertexShader=m.vertexShader.replace('void main() {',`uniform float wind,highQuality,boatSignedSpeed;uniform vec2 windDirection,boatPosition,boatDirection;uniform vec4 trafficPositions[4];uniform vec2 trafficDirections[4];${ESTUARY_GLSL}
 void main() {vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.);
 if(highQuality>.5){p.z+=estuaryField(wp.xz,time,wind,windDirection).z+launchWake(wp.xz,boatPosition,boatDirection,boatSignedSpeed,15.,time).z;
 for(int i=0;i<4;i++){vec4 v=trafficPositions[i];p.z+=launchWake(wp.xz,v.xy,trafficDirections[i],v.z,v.w,time).z;}}
 else p.z+=wind*(.043*sin(wp.x*.24+wp.z*.16+time*.9)+.025*sin(wp.x*-.43+wp.z*.3-time*1.2)+.012*sin(wp.x*.87+wp.z*.59+time*1.7));`).replaceAll('vec4( position, 1.0 )','vec4( p, 1.0 )');
 m.fragmentShader=m.fragmentShader.replace('uniform float size;',`uniform float size;uniform vec2 boatPosition;uniform vec2 boatDirection;uniform float boatSpeed;uniform vec4 ripples[32],rippleDirections[32];uniform float wind;uniform vec4 trafficPositions[4];uniform vec2 trafficDirections[4];uniform float highQuality;uniform float boatSignedSpeed;uniform float reflectionTexel;uniform vec2 windDirection;uniform float rainAmount,lightning,waterLight,keyGlint;uniform vec3 waterTint;
 ${ESTUARY_GLSL}
 // Kelvin arms and propeller wash stay attached to each moving vessel.
 vec3 vesselWake(vec2 p,vec2 origin,vec2 direction,float speed,float hullLength){
  if(speed<.04)return vec3(0.);
  vec2 delta=p-origin,perpendicular=vec2(direction.y,-direction.x);float aft=-dot(delta,direction),across=dot(delta,perpendicular),crosswise=abs(across);
  float stern=hullLength*.38,width=hullLength*.12+max(aft-stern,0.)*.32;
  float envelope=exp(-pow((crosswise-width)*1.7,2.))*smoothstep(stern-1.,stern+2.5,aft)*exp(-max(aft-stern,0.)*.065)*clamp(speed*.24,0.,1.);
  float phase=crosswise*8.-aft*2.2-time*4.;vec2 derivative=perpendicular*sign(across)*cos(phase)*envelope*.19;
  float churn=exp(-crosswise*crosswise*.7)*smoothstep(stern,stern+2.,aft)*exp(-max(aft-stern-2.,0.)*.17)*clamp(speed*.2,0.,1.);
  derivative+=perpendicular*sin(aft*9.+time*5.)*churn*.045;
  return vec3(derivative,envelope*(.10+.09*sin(phase))+churn*.2);
 }
 vec3 hullContact(vec2 p,vec2 origin,vec2 direction,float hullLength,float speed){
  vec2 d=p-origin,side=vec2(direction.y,-direction.x);
  float along=dot(d,direction),across=dot(d,side);
  if(abs(along)>hullLength*.51||abs(across)>hullLength*.12+1.)return vec3(0.);
  float extent=1.-smoothstep(hullLength*.47,hullLength*.51,abs(along));
  float section=pow(max(0.,sin(clamp(along/hullLength+.5,0.,1.)*3.14159265)),.48);
  float edge=abs(across)-(hullLength*.107*section+.025),meniscus=exp(-abs(edge)*8.)*extent;
  vec2 slope=side*sign(across)*cos(edge*16.-time*1.7+along*.6)*meniscus*(.012+min(abs(speed),3.)*.009);
  return vec3(slope,meniscus);
 }`);
 m.fragmentShader=m.fragmentShader.replace(/vec4 getNoise\( vec2 uv \) \{[\s\S]*?return noise \* 0.5 - 1.0;\s*\}/,`vec4 getNoise(vec2 uv){
  vec4 result=vec4(0.);
  if(highQuality>.5){
   vec2 drift=windDirection*time*.0062*wind;
   uv+=vec2(sin(uv.y*.045+time*.018),cos(uv.x*.032-uv.y*.019+time*.012))*.7;
   vec2 turn=mat2(.819,-.574,.574,.819)*uv,crossflow=mat2(.309,.951,-.951,.309)*uv;
   vec4 broad=texture2D(normalSampler,uv*.027+drift*.5);
   vec4 middle=texture2D(normalSampler,turn*.073-drift*.83);
   vec4 fine=texture2D(normalSampler,crossflow*.167+drift*1.2);
   vec4 capillary=texture2D(normalSampler,turn*.397-drift*1.91);
   result=(broad*.24+middle*.38+fine*.31+capillary*.07)*2.-1.;
  }else{
  vec2 drift=vec2(time*.006,-time*.004);
  vec4 broad=texture2D(normalSampler,uv*.026+drift*.55);
  vec4 medium=texture2D(normalSampler,uv*.067-vec2(drift.y,drift.x));
  vec4 fine=texture2D(normalSampler,uv*.19+drift*1.4);
  vec4 capillary=texture2D(normalSampler,uv*.43-vec2(drift.x*.6,drift.y*1.7));
   result=(broad*.44+medium*.3+fine*.18+capillary*.08)*2.-1.;
  }
  return result;
 }`);
 m.fragmentShader=m.fragmentShader.replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',`
 vec2 p=worldPosition.xz;
 vec2 derivative=wind*(.043*vec2(.24,.16)*cos(p.x*.24+p.y*.16+time*.9)+.025*vec2(-.43,.3)*cos(p.x*-.43+p.y*.3-time*1.2)+.012*vec2(.87,.59)*cos(p.x*.87+p.y*.59+time*1.7));
 if(highQuality>.5)derivative=estuaryField(p,time,wind,windDirection).xy;
 float foam=0.;
 for(int i=0;i<32;i++){
  if(highQuality<.5&&i>=16)continue;
  float age=time-ripples[i].z;if(age<0.||age>10.||ripples[i].w<=0.)continue;
  vec2 delta=p-ripples[i].xy;float d=length(delta),radius=age*1.2;
  if(highQuality>.5){
   vec4 shape=rippleDirections[i];vec2 direction=shape.xy,side=vec2(-direction.y,direction.x);
   float stretch=1.+shape.z*.64*exp(-age*.65),along=dot(delta,direction)/stretch,across=dot(delta,side);
   float r=length(vec2(along,across)),speed=1.05+shape.w*.17,travel=age*speed;
   float spread=.15+age*.105,wave=r-travel;
   float envelope=exp(-wave*wave/(spread*spread))*exp(-age*.46)*ripples[i].w;
   float residual=exp(-pow((r-travel*.73)/(spread*.80),2.))*exp(-age*.69)*ripples[i].w*.35;
   vec2 slope=(direction*along/stretch+side*across)/max(r,.001);
   derivative+=slope*(sin(wave*14.)*envelope*.24+sin((r-travel*.73)*17.)*residual*.15);
   continue;
  }
  float envelope=exp(-pow((d-radius)*2.8,2.))*exp(-age*.55)*ripples[i].w;
  derivative+=normalize(delta+vec2(.0001))*sin((d-radius)*15.)*envelope*.19;foam+=envelope*.055;
 }
 float contactShade=0.;
 vec3 wake=highQuality>.5?launchWake(p,boatPosition,boatDirection,boatSignedSpeed,15.,time):vesselWake(p,boatPosition,boatDirection,boatSpeed,11.);derivative+=wake.xy;if(highQuality<.5)foam+=wake.z;
 for(int i=0;i<4;i++){vec4 vessel=trafficPositions[i];vec3 trafficWake=highQuality>.5?launchWake(p,vessel.xy,trafficDirections[i],vessel.z,vessel.w,time):vesselWake(p,vessel.xy,trafficDirections[i],vessel.z,vessel.w);derivative+=trafficWake.xy;if(highQuality<.5)foam+=trafficWake.z;}
 if(highQuality>.5){
  vec3 contact=hullContact(p,boatPosition,boatDirection,15.,boatSpeed);derivative+=contact.xy;contactShade=contact.z;
  for(int i=0;i<4;i++){vec4 vessel=trafficPositions[i];if(vessel.w<=0.)continue;vec3 other=hullContact(p,vessel.xy,trafficDirections[i],vessel.w,vessel.z);derivative+=other.xy;contactShade=max(contactShade,other.z);}
  float resolved=1.-smoothstep(.14,1.4,length(fwidth(p)));
  // Individual drops create transient contacts in the atmosphere pool. The
  // water only adds fine roughness beneath those same moving rain patches.
  if(rainAmount>.01){float strength=max(0.,(wind-.83)/.80);
   vec2 rainCell=(p-windDirection*time*(1.1+strength*2.1))*.052;
   float rainField=.5+.28*sin(rainCell.x*.72+sin(rainCell.y*.43))+.22*sin(rainCell.y*1.19-rainCell.x*.24+1.7);
   float rainPatch=.09+.91*smoothstep(.25,.8,rainField);
   derivative+=noise.xy*.045*rainAmount*rainPatch*resolved;
  }
 }
 // Normal-map red/green are horizontal slopes; blue is height, not a second slope.
 float detailFade=mix(1.,.55,smoothstep(40.,210.,length(eye.xz-p)));
 float normalStrength=mix(.19,.27,highQuality);
 vec3 surfaceNormal=normalize(vec3(noise.x*normalStrength*detailFade-derivative.x,1.0,noise.y*normalStrength*detailFade-derivative.y));`);
 m.fragmentShader=m.fragmentShader.replace('sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );','sunLight( surfaceNormal, eyeDirection, mix(170.,190.,highQuality), mix(1.65,keyGlint,highQuality), 0.45, diffuseLight, specularLight );');
 m.fragmentShader=m.fragmentShader.replace('float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );',`if(highQuality>.5){
  // Integrate a small directional reflection lobe for a rough water surface.
  // This is material roughness in the live reflection, not a screen-space blur.
  vec2 reflectedUV=mirrorCoord.xy/mirrorCoord.w+distortion;
  float footprint=reflectionTexel*(2.2+1.8*smoothstep(22.,130.,distance));
  vec2 spreadA=vec2(footprint,footprint*.31),spreadB=vec2(-footprint*.23,footprint*.68);
  reflectionSample=reflectionSample*.20+
   (texture2D(mirrorSampler,reflectedUV+spreadA).rgb+texture2D(mirrorSampler,reflectedUV-spreadA).rgb+
    texture2D(mirrorSampler,reflectedUV+spreadB).rgb+texture2D(mirrorSampler,reflectedUV-spreadB).rgb)*.15+
   (texture2D(mirrorSampler,reflectedUV+spreadA*.71+spreadB).rgb+texture2D(mirrorSampler,reflectedUV-spreadA*.71-spreadB).rgb)*.10;
 }
 float theta = max( dot( eyeDirection, surfaceNormal ), 0.0 );`);
 m.fragmentShader=m.fragmentShader.replace('float rf0 = 0.02;','float rf0 = 0.035;');
 m.fragmentShader=m.fragmentShader.replace('vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;','vec3 scatter = (.48 + .52 * max(0., dot(surfaceNormal, eyeDirection))) * waterColor;');
 m.fragmentShader=m.fragmentShader.replace('vec3 albedo = mix(',`if(highQuality>.5){
  vec2 siltFlow=p+vec2(time*.035,-time*.054);
  float silt=.50+.24*sin(siltFlow.x*.037+sin(siltFlow.y*.029)*1.6)+.16*cos(siltFlow.y*.061-siltFlow.x*.018);
  float eddy=.5+.5*sin(siltFlow.x*.19+sin(siltFlow.y*.093)*1.7);
  // Suspended silt is lit through the water volume. A rough interface reduces
  // coherent mirror energy; normal-incidence Fresnel is water's real ~2 percent.
  float sediment=.93+.07*sin(siltFlow.x*.085+siltFlow.y*.052+eddy*3.);
  scatter=mix(waterColor*vec3(1.30,1.16,.90),vec3(.061,.068,.048),.18+silt*.5)*(.90+silt*.15+eddy*.055)*sediment;
  scatter*=mix(vec3(1.),waterTint*2.3,.30);
  float fresnel=.02037+.97963*pow(1.-theta,5.);
  reflectance=fresnel*(.74-.12*(1.-theta));
 }
 vec3 albedo = mix(`);
 m.fragmentShader=m.fragmentShader.replace('vec3 outgoingLight = albedo;',`vec3 outgoingLight = mix(albedo, vec3(.53,.59,.49), clamp(foam*(.75+noise.x*.4),0.,.36));
 if(highQuality>.5){
  float daylight=waterLight+lightning*.75;
  // Normal-dependent entry light keeps small waves and wakes readable from
  // overhead, where physically low Fresnel otherwise makes the river look flat.
  float rippleLight=clamp(1.+1.45*(dot(surfaceNormal,sunDirection)-sunDirection.y),.66,1.34);
  vec3 bodyLight=scatter*(.70+.30*getShadowMask())*daylight*rippleLight;
  outgoingLight=bodyLight*(1.-reflectance)+(reflectionSample+specularLight)*reflectance;
  outgoingLight=mix(outgoingLight,vec3(.31,.34,.27)*daylight,clamp(foam*.62,0.,.12));
  outgoingLight*=1.-contactShade*.15;
 }`);
 scene.add(water);let slot=0,highEnabled=false,highGeometry=null;
 const originalGeometry=water.geometry,heightSample={},wakeSample={};
 function prepareNearSurface(){
  const axis=nearWaterAxis(),count=axis.length,geometry=new T.PlaneGeometry(1,1,count-1,count-1),position=geometry.attributes.position;
  for(let y=0;y<count;y++)for(let x=0;x<count;x++)position.setXYZ(y*count+x,axis[x],-axis[y],0);
  position.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.name='Dense local estuary surface';return geometry;
 }
 return {water,uniforms:m.uniforms,
  setPassHooks(hooks){water.setPassHooks(hooks);},
  setLighting(profile){m.uniforms.waterTint.value.set(profile?.waterColor??'#718578');m.uniforms.waterLight.value=profile?.waterLight??(profile?.moon?.85:profile?.name==='Blue hour'?.95:1.08);m.uniforms.keyGlint.value=profile?.moon?2.7:Math.max(.16,(profile?.sunPower??3.1)*.19);},
  setWeather(climate){m.uniforms.wind.value=climate?.wind?.strength!=null?.83+climate.wind.strength*.80:1;m.uniforms.windDirection.value.set(climate?.wind?.x??.8,climate?.wind?.z??-.6).normalize();m.uniforms.rainAmount.value=climate?.rain??0;m.uniforms.lightning.value=climate?.flash??0;},
  setQuality(high){highEnabled=Boolean(high);const size=high?1536:reflectionSize;water.setReflectionSize(size);normal.anisotropy=high?16:8;m.uniforms.distortionScale.value=high?1.85:1.35;m.uniforms.highQuality.value=high?1:0;m.uniforms.reflectionTexel.value=1/size;if(high&&!highGeometry)highGeometry=prepareNearSurface();water.geometry=high?highGeometry:originalGeometry;if(!high){water.position.set(0,0,0);slot%=16;}},
  heightAt(x,z,t){
   if(!highEnabled)return waveHeight(x,z,t);
   const u=m.uniforms,origin=u.boatPosition.value,direction=u.boatDirection.value;
   let height=sampleEstuary(x,z,t,u.wind.value,u.windDirection.value.x,u.windDirection.value.y,heightSample).height;
   height+=sampleLaunchWake(x,z,origin.x,origin.y,direction.x,direction.y,u.boatSignedSpeed.value,15,t,wakeSample).height;
   for(let i=0;i<4;i++){const vessel=u.trafficPositions.value[i],heading=u.trafficDirections.value[i];if(vessel.w>0)height+=sampleLaunchWake(x,z,vessel.x,vessel.y,heading.x,heading.y,vessel.z,vessel.w,t,wakeSample).height;}
   return height;
  },
  ripple(x,z,t,power=1,contact){m.uniforms.ripples.value[slot].set(x,z,t,power);const vx=contact?.x??1,vz=contact?.z??0,length=Math.hypot(vx,vz)||1;m.uniforms.rippleDirections.value[slot].set(vx/length,vz/length,contact?.entry?1:0,Math.sin(x*19.17+z*3.89)*.5+.5);slot=(slot+1)%(highEnabled?32:16);},
  setTraffic(vessels=[]){for(let i=0;i<4;i++){const v=vessels[i];if(v){m.uniforms.trafficPositions.value[i].set(v.x,v.z,Math.abs(v.speed),v.length||9);m.uniforms.trafficDirections.value[i].set(-Math.sin(v.heading),-Math.cos(v.heading));}else m.uniforms.trafficPositions.value[i].set(0,0,0,0);}},
  update(t,p,heading,speed){m.uniforms.time.value=t;m.uniforms.boatPosition.value.set(p.x,p.z);m.uniforms.boatDirection.value.set(-Math.sin(heading),-Math.cos(heading));m.uniforms.boatSpeed.value=Math.abs(speed);m.uniforms.boatSignedSpeed.value=speed;if(highEnabled)water.position.set(p.x,0,p.z);}
 };
}

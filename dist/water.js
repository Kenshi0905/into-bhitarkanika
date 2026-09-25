import * as T from 'three';
import { Water } from './vendor/Water.js';

// Buoyancy and vertex displacement share this low-amplitude tidal wave field.
export function waveHeight(x,z,t,wind=1){return wind*(.043*Math.sin(x*.24+z*.16+t*.9)+.025*Math.sin(x*-.43+z*.3-t*1.2)+.012*Math.sin(x*.87+z*.59+t*1.7));}
export function buildWater(scene,sun){
 const mobile=typeof matchMedia==='function'&&matchMedia('(pointer: coarse), (max-width: 760px)').matches;
 const normal=new T.TextureLoader().load('./assets/waternormals.jpg');normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.anisotropy=8;
 const reflectionSize=mobile?512:1024;
 const water=new Water(new T.PlaneGeometry(2400,2400,mobile?144:220,mobile?144:220),{textureWidth:reflectionSize,textureHeight:reflectionSize,waterNormals:normal,sunDirection:sun,sunColor:0xffe7bb,waterColor:0x354337,distortionScale:1.35,fog:true});water.rotation.x=-Math.PI/2;
 const m=water.material;m.uniforms.size.value=1;
 m.uniforms.boatPosition={value:new T.Vector2()};m.uniforms.boatDirection={value:new T.Vector2(0,-1)};m.uniforms.boatSpeed={value:0};m.uniforms.wind={value:1};m.uniforms.ripples={value:Array.from({length:16},()=>new T.Vector4(0,0,-100,0))};
 m.uniforms.highQuality={value:0};m.uniforms.boatSignedSpeed={value:0};m.uniforms.reflectionTexel={value:1/reflectionSize};
 m.uniforms.trafficPositions={value:Array.from({length:4},()=>new T.Vector4(0,0,0,0))};m.uniforms.trafficDirections={value:Array.from({length:4},()=>new T.Vector2(0,-1))};
 m.vertexShader=m.vertexShader.replace('void main() {',`uniform float wind;void main() { vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.);p.z+=wind*(.043*sin(wp.x*.24+wp.z*.16+time*.9)+.025*sin(wp.x*-.43+wp.z*.3-time*1.2)+.012*sin(wp.x*.87+wp.z*.59+time*1.7));`).replaceAll('vec4( position, 1.0 )','vec4( p, 1.0 )');
 m.fragmentShader=m.fragmentShader.replace('uniform float size;',`uniform float size;uniform vec2 boatPosition;uniform vec2 boatDirection;uniform float boatSpeed;uniform vec4 ripples[16];uniform float wind;uniform vec4 trafficPositions[4];uniform vec2 trafficDirections[4];uniform float highQuality;uniform float boatSignedSpeed;uniform float reflectionTexel;
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
 // High uses one continuous bow/stern wave field, driven by signed velocity.
 // The launch is 15 m long: its stern lies at 7.5 m, not at the old 6 m origin.
 vec3 naturalWake(vec2 p,vec2 origin,vec2 direction,float velocity,float hullLength){
  float speed=abs(velocity);if(speed<.035)return vec3(0.);
  if(velocity<0.)direction=-direction;
  vec2 delta=p-origin,side=vec2(direction.y,-direction.x);
  float aft=-dot(delta,direction),across=dot(delta,side),crosswise=abs(across),stern=hullLength*.49;
  float strength=smoothstep(.035,.65,speed)*min(speed/2.315,1.4),trailLength=14.+speed*18.;
  vec2 slope=vec2(0.);
  // Gentle displacement curls around the bow shoulders; it produces no foam.
  float fore=-aft,bow=hullLength*.485;
  if(fore>bow-2.3&&fore<bow+1.1&&crosswise<2.7){
   float bowEdge=.14+max(bow-fore,0.)*.72;
   float shoulder=exp(-pow((crosswise-bowEdge)/.51,2.))*exp(-pow((fore-bow+.5)/1.05,2.))*strength;
   slope+=(direction*.63+side*sign(across))*(.065+.018*sin((fore-crosswise)*2.7-time*1.8))*shoulder;
  }
  if(aft<stern-.7||aft>stern+trailLength)return vec3(slope,0.);
  float run=max(0.,aft-stern),edge=.44+run*.34,band=.70+run*.032;
  if(crosswise>edge+band*3.)return vec3(slope,0.);
  float start=smoothstep(stern-.7,stern+2.0,aft);
  float fade=exp(-run/(13.+speed*9.))*(1.-smoothstep(trailLength*.62,trailLength,run))*strength;
  float arm=exp(-pow((crosswise-edge)/band,2.))*start*fade;
  float phase=(crosswise-edge)*2.1-run*.28-time*(1.35+speed*.25);
  slope+=(side*sign(across)+direction*.47)*(cos(phase)*.27+cos(phase*.58+.7)*.055)*arm;
  float centre=exp(-pow(across/(.78+run*.085),2.))*start*fade;
  slope+=(direction*sin(run*1.1-time*2.05)*.16+side*sin(across*2.1+run*.73-time*1.4)*.07)*centre;
  return vec3(slope,0.);
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
   vec2 drift=vec2(time*.0047,-time*.0031);
   uv+=vec2(sin(uv.y*.045+time*.018),cos(uv.x*.032-uv.y*.019+time*.012))*.7;
   vec2 turn=mat2(.819,-.574,.574,.819)*uv,crossflow=mat2(.309,.951,-.951,.309)*uv;
   vec4 broad=texture2D(normalSampler,uv*.017+drift*.5);
   vec4 middle=texture2D(normalSampler,turn*.053-drift*.83);
   vec4 fine=texture2D(normalSampler,crossflow*.147+drift*1.2);
   vec4 capillary=texture2D(normalSampler,turn*.371-drift*1.91);
   result=(broad*.50+middle*.36+fine*.12+capillary*.02)*2.-1.;
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
 float foam=0.;
 for(int i=0;i<16;i++){
  float age=time-ripples[i].z;if(age<0.||age>10.||ripples[i].w<=0.)continue;
  vec2 delta=p-ripples[i].xy;float d=length(delta),radius=age*1.2;
  float envelope=exp(-pow((d-radius)*2.8,2.))*exp(-age*.55)*ripples[i].w;
  derivative+=normalize(delta+vec2(.0001))*sin((d-radius)*15.)*envelope*.19;foam+=envelope*.055;
 }
 float contactShade=0.;
 vec3 wake=highQuality>.5?naturalWake(p,boatPosition,boatDirection,boatSignedSpeed,15.):vesselWake(p,boatPosition,boatDirection,boatSpeed,11.);derivative+=wake.xy;foam+=wake.z;
 for(int i=0;i<4;i++){vec4 vessel=trafficPositions[i];vec3 trafficWake=highQuality>.5?naturalWake(p,vessel.xy,trafficDirections[i],vessel.z,vessel.w):vesselWake(p,vessel.xy,trafficDirections[i],vessel.z,vessel.w);derivative+=trafficWake.xy;foam+=trafficWake.z;}
 if(highQuality>.5){
  vec3 contact=hullContact(p,boatPosition,boatDirection,15.,boatSpeed);derivative+=contact.xy;contactShade=contact.z;
  for(int i=0;i<4;i++){vec4 vessel=trafficPositions[i];if(vessel.w<=0.)continue;vec3 other=hullContact(p,vessel.xy,trafficDirections[i],vessel.w,vessel.z);derivative+=other.xy;contactShade=max(contactShade,other.z);}
  float resolved=1.-smoothstep(.14,1.4,length(fwidth(p)));
  float flow=.79+.21*sin(p.x*.041+p.y*.023-time*.08);
  derivative+=wind*resolved*flow*(vec2(.92,.39)*cos(dot(p,vec2(.92,.39))*2.1-time*.77+sin(p.y*.035)*.6)*.026+vec2(-.31,.95)*cos(dot(p,vec2(-.31,.95))*3.6+time*1.12)*.012);
 }
 // Normal-map red/green are horizontal slopes; blue is height, not a second slope.
 float detailFade=mix(1.,.55,smoothstep(40.,210.,length(eye.xz-p)));
 float normalStrength=mix(.19,.22,highQuality);
 vec3 surfaceNormal=normalize(vec3(noise.x*normalStrength*detailFade-derivative.x,1.0,noise.y*normalStrength*detailFade-derivative.y));`);
 m.fragmentShader=m.fragmentShader.replace('sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );','sunLight( surfaceNormal, eyeDirection, mix(170.,230.,highQuality), mix(1.65,.32,highQuality), 0.45, diffuseLight, specularLight );');
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
  scatter=mix(waterColor*vec3(1.30,1.16,.90),vec3(.061,.068,.048),.18+silt*.5)*(.90+silt*.15+eddy*.055);
  float fresnel=.02037+.97963*pow(1.-theta,5.);
  reflectance=fresnel*(.74-.12*(1.-theta));
 }
 vec3 albedo = mix(`);
 m.fragmentShader=m.fragmentShader.replace('vec3 outgoingLight = albedo;',`vec3 outgoingLight = mix(albedo, vec3(.53,.59,.49), clamp(foam*(.75+noise.x*.4),0.,.36));
 if(highQuality>.5){
  float daylight=mix(.60,1.,smoothstep(.11,.25,sunDirection.y));
  // Normal-dependent entry light keeps small waves and wakes readable from
  // overhead, where physically low Fresnel otherwise makes the river look flat.
  float rippleLight=clamp(1.+1.45*(dot(surfaceNormal,sunDirection)-sunDirection.y),.66,1.34);
  vec3 bodyLight=scatter*(.70+.30*getShadowMask())*daylight*rippleLight;
  outgoingLight=bodyLight*(1.-reflectance)+(reflectionSample+specularLight)*reflectance;
  outgoingLight=mix(outgoingLight,vec3(.31,.34,.27)*daylight,clamp(foam*.62,0.,.12));
  outgoingLight*=1.-contactShade*.15;
 }`);
 scene.add(water);let slot=0;
 return {water,uniforms:m.uniforms,
  setPassHooks(hooks){water.setPassHooks(hooks);},
  setQuality(high){const size=high?2048:reflectionSize;water.setReflectionSize(size);normal.anisotropy=high?16:8;m.uniforms.distortionScale.value=high?1.65:1.35;m.uniforms.highQuality.value=high?1:0;m.uniforms.reflectionTexel.value=1/size;},
  ripple(x,z,t,power=1){m.uniforms.ripples.value[slot].set(x,z,t,power);slot=(slot+1)%16;},
  setTraffic(vessels=[]){for(let i=0;i<4;i++){const v=vessels[i];if(v){m.uniforms.trafficPositions.value[i].set(v.x,v.z,Math.abs(v.speed),v.length||9);m.uniforms.trafficDirections.value[i].set(-Math.sin(v.heading),-Math.cos(v.heading));}else m.uniforms.trafficPositions.value[i].set(0,0,0,0);}},
  update(t,p,heading,speed){m.uniforms.time.value=t;m.uniforms.boatPosition.value.set(p.x,p.z);m.uniforms.boatDirection.value.set(-Math.sin(heading),-Math.cos(heading));m.uniforms.boatSpeed.value=Math.abs(speed);m.uniforms.boatSignedSpeed.value=speed;}
 };
}

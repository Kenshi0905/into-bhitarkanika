import * as T from 'three';
import { Water } from './vendor/Water.js';

// Buoyancy and vertex displacement share this low-amplitude tidal wave field.
export function waveHeight(x,z,t,wind=1){return wind*(.043*Math.sin(x*.24+z*.16+t*.9)+.025*Math.sin(x*-.43+z*.3-t*1.2)+.012*Math.sin(x*.87+z*.59+t*1.7));}
export function buildWater(scene,sun){
 const mobile=typeof matchMedia==='function'&&matchMedia('(max-width: 760px)').matches;
 const normal=new T.TextureLoader().load('./assets/waternormals.jpg');normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.anisotropy=8;
 const reflectionSize=mobile?512:1024;
 const water=new Water(new T.PlaneGeometry(2400,2400,mobile?144:220,mobile?144:220),{textureWidth:reflectionSize,textureHeight:reflectionSize,waterNormals:normal,sunDirection:sun,sunColor:0xffe7bb,waterColor:0x354337,distortionScale:1.35,fog:true});water.rotation.x=-Math.PI/2;
 const m=water.material;m.uniforms.size.value=1;
 m.uniforms.boatPosition={value:new T.Vector2()};m.uniforms.boatDirection={value:new T.Vector2(0,-1)};m.uniforms.boatSpeed={value:0};m.uniforms.wind={value:1};m.uniforms.ripples={value:Array.from({length:16},()=>new T.Vector4(0,0,-100,0))};
 m.uniforms.trafficPositions={value:Array.from({length:4},()=>new T.Vector4(0,0,0,0))};m.uniforms.trafficDirections={value:Array.from({length:4},()=>new T.Vector2(0,-1))};
 m.vertexShader=m.vertexShader.replace('void main() {',`uniform float wind;void main() { vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.);p.z+=wind*(.043*sin(wp.x*.24+wp.z*.16+time*.9)+.025*sin(wp.x*-.43+wp.z*.3-time*1.2)+.012*sin(wp.x*.87+wp.z*.59+time*1.7));`).replaceAll('vec4( position, 1.0 )','vec4( p, 1.0 )');
 m.fragmentShader=m.fragmentShader.replace('uniform float size;',`uniform float size;uniform vec2 boatPosition;uniform vec2 boatDirection;uniform float boatSpeed;uniform vec4 ripples[16];uniform float wind;uniform vec4 trafficPositions[4];uniform vec2 trafficDirections[4];
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
 }`);
 m.fragmentShader=m.fragmentShader.replace(/vec4 getNoise\( vec2 uv \) \{[\s\S]*?return noise \* 0.5 - 1.0;\s*\}/,`vec4 getNoise(vec2 uv){
  vec2 drift=vec2(time*.006,-time*.004);
  vec4 broad=texture2D(normalSampler,uv*.026+drift*.55);
  vec4 medium=texture2D(normalSampler,uv*.067-vec2(drift.y,drift.x));
  vec4 fine=texture2D(normalSampler,uv*.19+drift*1.4);
  vec4 capillary=texture2D(normalSampler,uv*.43-vec2(drift.x*.6,drift.y*1.7));
  return (broad*.44+medium*.3+fine*.18+capillary*.08)*2.-1.;
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
 vec3 wake=vesselWake(p,boatPosition,boatDirection,boatSpeed,11.);derivative+=wake.xy;foam+=wake.z;
 for(int i=0;i<4;i++){vec4 vessel=trafficPositions[i];vec3 trafficWake=vesselWake(p,vessel.xy,trafficDirections[i],vessel.z,vessel.w);derivative+=trafficWake.xy;foam+=trafficWake.z;}
 // Normal-map red/green are horizontal slopes; blue is height, not a second slope.
 float detailFade=mix(1.,.55,smoothstep(40.,210.,length(eye.xz-p)));
 vec3 surfaceNormal=normalize(vec3(noise.x*.19*detailFade-derivative.x,1.0,noise.y*.19*detailFade-derivative.y));`);
 m.fragmentShader=m.fragmentShader.replace('sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );','sunLight( surfaceNormal, eyeDirection, 170.0, 1.65, 0.45, diffuseLight, specularLight );');
 m.fragmentShader=m.fragmentShader.replace('float rf0 = 0.02;','float rf0 = 0.035;');
 m.fragmentShader=m.fragmentShader.replace('vec3 scatter = max( 0.0, dot( surfaceNormal, eyeDirection ) ) * waterColor;','vec3 scatter = (.48 + .52 * max(0., dot(surfaceNormal, eyeDirection))) * waterColor;');
 m.fragmentShader=m.fragmentShader.replace('vec3 outgoingLight = albedo;','vec3 outgoingLight = mix(albedo, vec3(.53,.59,.49), clamp(foam*(.75+noise.x*.4),0.,.36));');
 scene.add(water);let slot=0;
 return {water,uniforms:m.uniforms,
  ripple(x,z,t,power=1){m.uniforms.ripples.value[slot].set(x,z,t,power);slot=(slot+1)%16;},
  setTraffic(vessels=[]){for(let i=0;i<4;i++){const v=vessels[i];if(v){m.uniforms.trafficPositions.value[i].set(v.x,v.z,Math.abs(v.speed),v.length||9);m.uniforms.trafficDirections.value[i].set(-Math.sin(v.heading),-Math.cos(v.heading));}else m.uniforms.trafficPositions.value[i].set(0,0,0,0);}},
  update(t,p,heading,speed){m.uniforms.time.value=t;m.uniforms.boatPosition.value.set(p.x,p.z);m.uniforms.boatDirection.value.set(-Math.sin(heading),-Math.cos(heading));m.uniforms.boatSpeed.value=Math.abs(speed);}
 };
}

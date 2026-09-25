import * as T from 'three';
import { Water } from './vendor/Water.js';

// The same analytic wave field drives the rendered surface and hull buoyancy.
export function waveHeight(x,z,t,wind=1){return wind*(.055*Math.sin(x*.24+z*.16+t*1.2)+.035*Math.sin(x*-.43+z*.3-t*1.55)+.019*Math.sin(x*.87+z*.59+t*2.1));}
export function buildWater(scene,sun){
 const normal=new T.TextureLoader().load('./assets/waternormals.jpg');normal.wrapS=normal.wrapT=T.RepeatWrapping;normal.anisotropy=8;
 const water=new Water(new T.PlaneGeometry(2400,2400,220,220),{textureWidth:1024,textureHeight:1024,waterNormals:normal,sunDirection:sun,sunColor:0xffe7bb,waterColor:0x283c2d,distortionScale:1.8,fog:true});water.rotation.x=-Math.PI/2;
 const m=water.material;m.uniforms.size.value=5;
 m.uniforms.boatPosition={value:new T.Vector2()};m.uniforms.boatDirection={value:new T.Vector2(0,-1)};m.uniforms.boatSpeed={value:0};m.uniforms.wind={value:1};m.uniforms.ripples={value:Array.from({length:16},()=>new T.Vector4(0,0,-100,0))};
 m.vertexShader=m.vertexShader.replace('void main() {',`uniform float wind;void main() { vec3 p=position;vec4 wp=modelMatrix*vec4(p,1.);p.z+=wind*(.055*sin(wp.x*.24+wp.z*.16+time*1.2)+.035*sin(wp.x*-.43+wp.z*.3-time*1.55)+.019*sin(wp.x*.87+wp.z*.59+time*2.1));`).replaceAll('vec4( position, 1.0 )','vec4( p, 1.0 )');
 m.fragmentShader=m.fragmentShader.replace('uniform float size;',`uniform float size;uniform vec2 boatPosition;uniform vec2 boatDirection;uniform float boatSpeed;uniform vec4 ripples[16];uniform float wind;`);
 m.fragmentShader=m.fragmentShader.replace('vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',`
 vec2 p=worldPosition.xz;vec2 derivative=wind*(.055*vec2(.24,.16)*cos(p.x*.24+p.y*.16+time*1.2)+.035*vec2(-.43,.3)*cos(p.x*-.43+p.y*.3-time*1.55)+.019*vec2(.87,.59)*cos(p.x*.87+p.y*.59+time*2.1));
 float foam=0.;
 for(int i=0;i<16;i++){float age=time-ripples[i].z;vec2 delta=p-ripples[i].xy;float d=length(delta);float radius=age*1.1;float envelope=exp(-pow((d-radius)*2.5,2.))*exp(-age*.45)*step(0.,age)*ripples[i].w;derivative+=normalize(delta+vec2(.0001))*sin((d-radius)*14.)*envelope*.25;foam+=envelope*.15;}
 vec2 delta=p-boatPosition;float aft=-dot(delta,boatDirection);float crosswise=abs(dot(delta,vec2(boatDirection.y,-boatDirection.x)));float wakeWidth=1.8+max(aft-3.,0.)*.28;float wake=exp(-pow((crosswise-wakeWidth)*1.5,2.))*smoothstep(2.,7.,aft)*exp(-max(aft-6.,0.)*.055)*clamp(boatSpeed*.22,0.,1.);
 derivative+=vec2(boatDirection.y,-boatDirection.x)*sign(dot(delta,vec2(boatDirection.y,-boatDirection.x)))*cos(crosswise*7.-aft*1.7-time*4.)*wake*.23;
 foam+=wake*(.2+.2*sin(aft*3.-time*4.));
 float churn=exp(-crosswise*crosswise*.6)*smoothstep(5.,9.,aft)*exp(-max(aft-7.,0.)*.14)*clamp(boatSpeed*.18,0.,1.);foam+=churn*.27;
 vec3 surfaceNormal=normalize(vec3(noise.x*.32-derivative.x,1.0,noise.z*.32-derivative.y));`);
 m.fragmentShader=m.fragmentShader.replace('vec3 outgoingLight = albedo;','vec3 outgoingLight = mix(albedo, vec3(.65,.72,.60), clamp(foam,0.,.55));');
 scene.add(water);let slot=0;
 return {water,uniforms:m.uniforms,ripple(x,z,t,power=1){m.uniforms.ripples.value[slot].set(x,z,t,power);slot=(slot+1)%16;},update(t,p,heading,speed){m.uniforms.time.value=t;m.uniforms.boatPosition.value.set(p.x,p.z);m.uniforms.boatDirection.value.set(-Math.sin(heading),-Math.cos(heading));m.uniforms.boatSpeed.value=Math.abs(speed);}};
}

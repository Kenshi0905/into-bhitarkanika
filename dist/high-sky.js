import * as T from 'three';

// One radiance description owns the visible sky, cached environment and key
// light. Preset indexes 0–2 intentionally preserve the original controls.
export const HIGH_SKY_PRESETS = [
 {name:'Golden hour',direction:[-.28,.34,-.85],top:'#4c769a',horizon:'#dbaa79',ground:'#52645e',cloud:'#e9bc86',cloudShade:'#61728c',radiance:1.06,cloudCover:.48,cloudDepth:1.08,sunRadiance:9,aureole:.18,environment:.38,
  sunColor:'#ffd19a',sunPower:3.85,ambient:.97,hemiSky:'#bed6ec',hemiGround:'#5b6962',exposure:1.06,fog:'#aebcaf',fogDensity:.0016,shaftStrength:.24,bloomStrength:.11,gradeWarmth:.70,moon:0,stars:0,water:'#45564a',waterLight:1.04},
 {name:'Morning mist',direction:[-.25,.40,-.70],top:'#92b9cc',horizon:'#dae2d1',ground:'#77887a',cloud:'#eee9d6',cloudShade:'#9ab4bb',radiance:1.18,cloudCover:.52,sunRadiance:6,aureole:.15,environment:.42,
  sunColor:'#f3e8ca',sunPower:2.25,ambient:1.31,hemiSky:'#c1dbe4',hemiGround:'#6c7e68',exposure:1.09,fog:'#bacdc7',fogDensity:.00355,shaftStrength:.105,bloomStrength:.095,moon:0,stars:0,water:'#486059'},
 {name:'Blue hour',direction:[-.5,.16,-.7],top:'#324c77',horizon:'#9b9aad',ground:'#42565d',cloud:'#969db5',cloudShade:'#566783',radiance:.95,cloudCover:.49,sunRadiance:0,aureole:0,environment:.67,
  sunColor:'#bacbe5',sunPower:.44,ambient:1.37,hemiSky:'#a8bddc',hemiGround:'#697b79',exposure:1.22,fog:'#6b8196',fogDensity:.00255,shaftStrength:0,bloomStrength:.075,moon:0,stars:.08,water:'#3c5866'},
 {name:'Storm',direction:[-.36,.68,-.66],top:'#536372',horizon:'#9facac',ground:'#4a5d56',cloud:'#a9b7bc',cloudShade:'#445465',radiance:.95,cloudCover:.98,sunRadiance:0,aureole:0,environment:.60,
  sunColor:'#c1d6e3',sunPower:.86,ambient:1.54,hemiSky:'#bdcbd9',hemiGround:'#64776b',exposure:1.12,fog:'#819798',fogDensity:.00385,shaftStrength:0,bloomStrength:.095,moon:0,stars:0,water:'#3b5155'},
 {name:'Moonlit Night',direction:[-.25,.115,-.96],top:'#101b2e',horizon:'#26394f',ground:'#1e2c37',cloud:'#536780',cloudShade:'#27374e',radiance:.53,cloudCover:.22,cloudDepth:.75,sunRadiance:4.1,aureole:.022,environment:.32,
  sunColor:'#d4e1f4',sunPower:.68,ambient:.62,hemiSky:'#91abc7',hemiGround:'#4a5e69',exposure:1.08,fog:'#263e52',fogDensity:.00165,shaftStrength:.025,bloomStrength:.065,gradeWarmth:0,moon:1,stars:.72,water:'#263f4e',waterLight:.36}
];
const indexOf=index=>Math.max(0,Math.min(HIGH_SKY_PRESETS.length-1,index|0));

export function getHighLighting(index){
 const p=HIGH_SKY_PRESETS[indexOf(index)];
 return {name:p.name,sunColor:p.sunColor,sunPower:p.sunPower,ambient:p.ambient,hemiSky:p.hemiSky,hemiGround:p.hemiGround,exposure:p.exposure,fog:p.fog,fogDensity:p.fogDensity,
  direction:[...p.direction],shadowBias:-.000055,normalBias:.008,shaftStrength:p.shaftStrength,bloomStrength:p.bloomStrength,gradeWarmth:p.gradeWarmth,water:p.water,waterColor:p.water,waterLight:p.waterLight,moon:p.moon};
}
export function skyUniforms(index){
 const p=HIGH_SKY_PRESETS[indexOf(index)];
 return {top:{value:new T.Color(p.top)},horizon:{value:new T.Color(p.horizon)},ground:{value:new T.Color(p.ground)},cloud:{value:new T.Color(p.cloud)},cloudShade:{value:new T.Color(p.cloudShade)},sunColor:{value:new T.Color(p.sunColor)},sun:{value:new T.Vector3(...p.direction).normalize()},radiance:{value:p.radiance},cloudCover:{value:p.cloudCover},cloudDepth:{value:p.cloudDepth??(index===3?1.55:.88)},sunRadiance:{value:p.sunRadiance},aureole:{value:p.aureole},moon:{value:p.moon},stars:{value:p.stars},drift:{value:new T.Vector2()},flash:{value:0}};
}
export const highSkyFragment=`
 varying vec3 direction;
 uniform vec3 top,horizon,ground,cloud,cloudShade,sunColor,sun;
 uniform float radiance,cloudCover,cloudDepth,sunRadiance,aureole,moon,stars,flash;
 uniform vec2 drift;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 float cloudNoise(vec2 p){float n=noise(p)*.54;p=mat2(1.66,1.19,-1.19,1.66)*p+4.2;n+=noise(p)*.28;p=mat2(1.77,1.08,-1.08,1.77)*p+7.1;n+=noise(p)*.13;n+=noise(p*2.1)*.05;return n;}
 void main(){
  vec3 d=normalize(direction);float altitude=max(d.y,0.);
  float optical=1.-exp(-altitude*3.7);vec3 color=mix(horizon,top,optical)*radiance;
  float mu=max(dot(d,sun),0.),above=smoothstep(-.025,.045,d.y);
  color+=sunColor*aureole*(pow(mu,19.)+.16*pow(mu,3.))*above;
  // Two projected decks have distinct scale, shape, drift and optical depth.
  // Density samples toward the real key direction shade interiors, while thin
  // edges remain backlit. This replaces the old nearly uniform cloud sheet.
  vec2 lowerPlane=d.xz/max(d.y+.075,.075),upperPlane=d.xz/max(d.y+.20,.20);
  vec2 uv=lowerPlane*vec2(.39,.56)+vec2(3.8,-2.4)+drift;
  float formation=cloudNoise(uv*.32+vec2(7.7,-4.8));
  uv+=vec2(noise(uv*.71),noise(uv*.71+5.2))*.38;
  float field=cloudNoise(uv),edge=.59-cloudCover*.25+(formation-.48)*.18;
  float density=max(0.,field-edge)*7.5*cloudDepth;
  float lower=(1.-exp(-density*2.7))*smoothstep(.006,.105,d.y);
  float towardKey=max(0.,cloudNoise(uv+sun.xz*.28)-edge)*5.8;
  float selfShade=1.-exp(-(density*.65+towardKey*.50));
  float rim=pow(max(0.,1.-density),3.)*smoothstep(.02,.17,density)*pow(mu,7.);
  vec3 cloudLight=mix(cloud,cloudShade,selfShade*.84)*radiance;
  cloudLight+=sunColor*(aureole*.62*rim+.018*pow(mu,4.))*(1.-moon*.85);
  // Far cloud decks soften toward the horizon without obscuring the nearby
  // lower billows. Clear intervals retain a cooler blue sky above warm light.
  float upper=cloudNoise(upperPlane*vec2(.27,.12)+vec2(-8.1,7.3)+drift*.34);
  float veil=smoothstep(.53-cloudCover*.13,.73,upper)*.39*smoothstep(.00,.12,d.y);
  vec3 upperLight=mix(cloud,cloudShade,.23)*radiance;
  color=mix(color,upperLight,veil);
  float horizonVeil=(1.-smoothstep(.015,.19,d.y))*.25;
  cloudLight=mix(cloudLight,horizon*radiance,horizonVeil);
  color=mix(color,cloudLight,lower);
  float coverage=lower+(1.-lower)*veil;
  if(stars>.001){
   vec2 angles=vec2(atan(d.z,d.x)*.15915494,asin(clamp(d.y,-1.,1.))*.31830989),grid=angles*vec2(1100.,550.);
   vec2 cell=floor(grid),offset=fract(grid)-vec2(.18+.64*hash(cell+3.),.18+.64*hash(cell+7.));
   float star=1.-smoothstep(.025,.19,length(offset)),selected=step(.996,hash(cell));
   color+=vec3(.62,.74,1.)*star*selected*stars*smoothstep(.12,.65,d.y)*(1.-coverage)*1.7;
  }
  float disk=smoothstep(.99989,.999955,dot(d,sun));
  if(moon>.5){
   vec3 right=normalize(cross(sun,vec3(0.,1.,0.))),up=normalize(cross(right,sun));
   vec2 lunar=vec2(dot(d,right),dot(d,up))*180.;
   disk*=.79+.12*noise(lunar*4.+2.)+.09*noise(lunar*9.-3.);
  }
  color+=sunColor*sunRadiance*disk*above*(1.-coverage*.91);
  color+=vec3(.54,.64,.79)*flash*(.14+.72*coverage)*above;
  color=mix(ground*radiance*.55,color,smoothstep(-.065,.012,d.y));
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`;

export async function buildHighSky({scene,renderer,sky,onProgress=()=>{}}){
 const geometry=new T.SphereGeometry(1800,32,16),materials=[],environments=[];
 const capture=new T.Scene(),probe=new T.Mesh(geometry);probe.frustumCulled=false;capture.add(probe);
 const pmrem=new T.PMREMGenerator(renderer);
 try{
  for(let index=0;index<HIGH_SKY_PRESETS.length;index++){
   onProgress(`Preparing ${HIGH_SKY_PRESETS[index].name.toLowerCase()} light`);
   const material=new T.ShaderMaterial({name:`High ${HIGH_SKY_PRESETS[index].name} sky`,side:T.BackSide,depthWrite:false,fog:false,uniforms:skyUniforms(index),vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:highSkyFragment});
   materials.push(material);probe.material=material;
   // All five environments are cached once; cloud drift never regenerates PMREM.
   environments.push(pmrem.fromScene(capture,0,.1,2200,{size:128}));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }catch(error){materials.forEach(m=>m.dispose());environments.forEach(e=>e.dispose());geometry.dispose();throw error;}
 finally{pmrem.dispose();}
 const dome=new T.Mesh(geometry,materials[0]);dome.name='High layered estuary sky';dome.frustumCulled=false;dome.visible=false;dome.renderOrder=100;scene.add(dome);
 let enabled=false,original=null,lightingIndex=0,disposed=false,weather=null,lastTime=0;
 const applyEnvironment=()=>{dome.material=materials[lightingIndex];if(enabled){scene.environment=environments[lightingIndex].texture;scene.environmentIntensity=HIGH_SKY_PRESETS[lightingIndex].environment;scene.environmentRotation.set(0,0,0);}};
 return {
  setEnabled(value){
   if(disposed)return;value=Boolean(value);if(value===enabled)return;enabled=value;dome.visible=value;
   if(value){original={visible:sky.sky.visible,environment:scene.environment,intensity:scene.environmentIntensity,rotation:scene.environmentRotation.clone()};sky.sky.visible=false;applyEnvironment();}
   else if(original){sky.sky.visible=original.visible;scene.environment=original.environment;scene.environmentIntensity=original.intensity;scene.environmentRotation.copy(original.rotation);original=null;}
  },
  setLighting(index){lightingIndex=indexOf(index);applyEnvironment();},
  setWeather(value){weather=value;},
  update(t,camera){
   dome.position.copy(camera.position);const dt=Math.max(0,Math.min(.1,t-lastTime));lastTime=t;
   if(!enabled)return;const u=dome.material.uniforms,w=weather?.wind;
   u.drift.value.x+=dt*(w?.x??.6)*(.0012+(w?.strength??.3)*.0018);
   u.drift.value.y+=dt*(w?.z??.8)*(.0012+(w?.strength??.3)*.0018);
   u.flash.value=weather?.flash??0;
  },
  getStats(){return {type:'procedural',preset:HIGH_SKY_PRESETS[lightingIndex].name,cachedEnvironments:environments.length,cubeFaceSize:128};},
  dispose(){if(disposed)return;this.setEnabled(false);disposed=true;dome.removeFromParent();geometry.dispose();materials.forEach(m=>m.dispose());environments.forEach(e=>e.dispose());}
 };
}

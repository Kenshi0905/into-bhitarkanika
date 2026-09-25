import * as T from 'three';

// High's sky, diffuse fill, sun and reflections share one lighting description.
// The visible dome and cached PMREM use precisely the same radiance shader.
const PRESETS=[
 {name:'Golden hour',direction:[-.28,.39,-.85],top:'#78aaba',horizon:'#d6ceaf',ground:'#60796d',cloud:'#d1d3c8',cloudShade:'#809b9e',radiance:1.22,cloudCover:.46,sunRadiance:8,aureole:.21,environment:.38,
  sunColor:'#ffdaa9',sunFactor:.97,ambientFactor:.55,hemiSky:'#bdd1d4',hemiGround:'#3e4d40',exposureFactor:.91,fog:'#bec7b5',fogDensity:.00235},
 {name:'Morning mist',direction:[-.25,.40,-.70],top:'#8eafbb',horizon:'#ccd9d0',ground:'#71897c',cloud:'#d8e1d9',cloudShade:'#9db5b1',radiance:1.15,cloudCover:.55,sunRadiance:5,aureole:.13,environment:.34,
  sunColor:'#eef1df',sunFactor:.84,ambientFactor:.60,hemiSky:'#c5d9d7',hemiGround:'#495b4c',exposureFactor:.94,fog:'#bfcec5',fogDensity:.00415},
 {name:'Blue hour',direction:[-.5,-.045,-.7],top:'#203a63',horizon:'#71839f',ground:'#273d4a',cloud:'#7c8ca7',cloudShade:'#344d70',radiance:.76,cloudCover:.48,sunRadiance:0,aureole:0,environment:.58,
  sunColor:'#a5bbd4',sunFactor:.055,ambientFactor:.77,hemiSky:'#9aadc7',hemiGround:'#34464d',exposureFactor:1.00,fog:'#536d81',fogDensity:.0025}
];
const defaults=[{power:3.1,ambient:1.85,exposure:1.15},{power:2.05,ambient:1.75,exposure:1.12},{power:1.1,ambient:.95,exposure:1.1}];

export function getHighLighting(index,p=defaults[index]||defaults[0]){
 const i=Math.max(0,Math.min(2,index|0)),profile=PRESETS[i],base=defaults[i];
 return {sunColor:profile.sunColor,sunPower:(p.power??base.power)*profile.sunFactor,ambient:(p.ambient??base.ambient)*profile.ambientFactor,
  hemiSky:profile.hemiSky,hemiGround:profile.hemiGround,exposure:(p.exposure??base.exposure)*profile.exposureFactor,fog:profile.fog,fogDensity:profile.fogDensity,
  direction:[...profile.direction],shadowBias:-.000055,normalBias:.008};
}

export function skyUniforms(index){
 const p=PRESETS[index];return {top:{value:new T.Color(p.top)},horizon:{value:new T.Color(p.horizon)},ground:{value:new T.Color(p.ground)},cloud:{value:new T.Color(p.cloud)},cloudShade:{value:new T.Color(p.cloudShade)},sunColor:{value:new T.Color(p.sunColor)},sun:{value:new T.Vector3(...p.direction).normalize()},radiance:{value:p.radiance},cloudCover:{value:p.cloudCover},sunRadiance:{value:p.sunRadiance},aureole:{value:p.aureole}};
}

export const highSkyFragment=`
 varying vec3 direction;
 uniform vec3 top,horizon,ground,cloud,cloudShade,sunColor,sun;
 uniform float radiance,cloudCover,sunRadiance,aureole;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
 float cloudNoise(vec2 p){float n=noise(p)*.53;p=mat2(1.66,1.19,-1.19,1.66)*p+4.2;n+=noise(p)*.28;p=mat2(1.77,1.08,-1.08,1.77)*p+7.1;n+=noise(p)*.13;return n;}
 void main(){
  vec3 d=normalize(direction);float altitude=max(d.y,0.);
  // A long, smooth optical path at the horizon desaturates the sky there.
  float optical=1.-exp(-altitude*3.6);vec3 color=mix(horizon,top,optical)*radiance;
  float mu=max(dot(d,sun),0.);float above=smoothstep(-.025,.045,d.y);
  color+=sunColor*aureole*(pow(mu,18.)+.16*pow(mu,3.))*above;
  // Two coherent cloud scales on an elevated layer. High-frequency noise is
  // deliberately absent; silhouettes stay stable in both the view and water.
  vec2 plane=d.xz/max(d.y+.12,.10);vec2 uv=plane*.59+vec2(3.4,-1.8);
  float broad=cloudNoise(uv),detail=noise(uv*3.1+vec2(5.7,2.1));
  float field=broad*.88+detail*.12;
  float coverage=smoothstep(.59-cloudCover*.18,.75-cloudCover*.16,field)*smoothstep(.01,.17,d.y);
  float rim=smoothstep(.47,.68,field);
  vec3 cloudLight=mix(cloud,cloudShade,rim*.50)*radiance;
  cloudLight+=sunColor*aureole*.34*pow(mu,9.);
  color=mix(color,cloudLight,coverage*.73);
  // The small sun is at exactly the direction used by the directional light.
  float disk=smoothstep(.99993,.999975,dot(d,sun));
  color+=sunColor*sunRadiance*disk*above*(1.-coverage*.86);
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
  for(let index=0;index<PRESETS.length;index++){
   onProgress(`Preparing ${PRESETS[index].name.toLowerCase()} light`);
   const material=new T.ShaderMaterial({name:`High ${PRESETS[index].name} sky`,side:T.BackSide,depthWrite:false,fog:false,uniforms:skyUniforms(index),vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:highSkyFragment});
   materials.push(material);probe.material=material;
   // 128-pixel cube faces are ample for rough cloth/wood/foliage lighting. Three
   // environments are generated once, then preset switches cost no render pass.
   environments.push(pmrem.fromScene(capture,0,.1,2200,{size:128}));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }catch(error){materials.forEach(m=>m.dispose());environments.forEach(e=>e.dispose());geometry.dispose();throw error;}
 finally{pmrem.dispose();}
 const dome=new T.Mesh(geometry,materials[0]);dome.name='High layered estuary sky';dome.frustumCulled=false;dome.visible=false;dome.renderOrder=100;scene.add(dome);
 let enabled=false,original=null,lightingIndex=0,disposed=false;
 const applyEnvironment=()=>{dome.material=materials[lightingIndex];if(enabled){scene.environment=environments[lightingIndex].texture;scene.environmentIntensity=PRESETS[lightingIndex].environment;scene.environmentRotation.set(0,0,0);}};
 return {
  setEnabled(value){
   if(disposed)return;value=Boolean(value);if(value===enabled)return;enabled=value;dome.visible=value;
   if(value){original={visible:sky.sky.visible,environment:scene.environment,intensity:scene.environmentIntensity,rotation:scene.environmentRotation.clone()};sky.sky.visible=false;applyEnvironment();}
   else if(original){sky.sky.visible=original.visible;scene.environment=original.environment;scene.environmentIntensity=original.intensity;scene.environmentRotation.copy(original.rotation);original=null;}
  },
  setLighting(index){lightingIndex=Math.max(0,Math.min(2,index|0));applyEnvironment();},
  update(t,camera){dome.position.copy(camera.position);},
  getStats(){return {type:'procedural',preset:PRESETS[lightingIndex].name,cachedEnvironments:environments.length,cubeFaceSize:128};},
  dispose(){if(disposed)return;this.setEnabled(false);disposed=true;dome.removeFromParent();geometry.dispose();materials.forEach(m=>m.dispose());environments.forEach(e=>e.dispose());}
 };
}

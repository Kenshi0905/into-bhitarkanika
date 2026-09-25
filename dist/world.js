import * as T from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import {center,width} from './channel.js';
export {center,width} from './channel.js';
let seed=87234;
export const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
export const range=(a,b)=>a+(b-a)*random();
const V=(x,y,z)=>new T.Vector3(x,y,z);
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
const smallScreen=()=>typeof matchMedia==='function'&&matchMedia('(max-width: 760px)').matches;
export function mesh(geo,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function bar(a,b,r,material,parent,r2=r){const delta=b.clone().sub(a);const m=mesh(new T.CylinderGeometry(r2,r,delta.length(),7),material,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return m;}

export function texture(type){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 const base=type==='wood'?[119,77,43]:type==='bark'?[100,94,75]:type==='mud'?[99,88,65]:[186,167,114];
 const im=g.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const i=(y*512+x)*4;let n=range(-12,12);
  if(type==='wood')n+=Math.sin(y*.5+Math.sin(x*.02)*2)*10+Math.sin(y*.12)*8;
  if(type==='bark'){const groove=Math.sin(x*.23+Math.sin(y*.013)*1.8+Math.sin(y*.046)*.7);n+=groove*18-Math.pow(Math.max(0,groove),12)*26+Math.sin(x*.071+y*.004)*9;}
  if(type==='mud')n+=Math.sin(x*.018+Math.sin(y*.027)*2)*7+Math.sin(y*.041+x*.013)*5+Math.sin(x*.13+y*.17)*3;
  if(type==='canvas')n+=((x%4<2?1:-1)+(y%4<2?1:-1))*7;
  for(let k=0;k<3;k++)im.data[i+k]=base[k]+n;im.data[i+3]=255;
 }g.putImageData(im,0,0);
 if(type==='wood'){g.strokeStyle='#33231560';g.lineWidth=3;for(let y=0;y<512;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}for(let n=0;n<250;n++){g.strokeStyle=`rgba(37,26,11,${range(.03,.17)})`;const y=range(0,512),x=range(0,512);g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+30,y+2,x+90,y-1,x+150,y);g.stroke();}}
 if(type==='mud')for(let i=0;i<1800;i++){const x=range(0,512),y=range(0,512),r=range(.4,1.8);g.fillStyle=i%4?'#342f2328':'#c1ad7440';g.beginPath();g.ellipse(x,y,r*1.7,r,range(0,3.14),0,6.29);g.fill();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;
}

function leafTexture(){
 const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');
 const fill=g.createLinearGradient(0,0,128,0);fill.addColorStop(0,'#859657');fill.addColorStop(.43,'#c2cc89');fill.addColorStop(.5,'#d5d59c');fill.addColorStop(.56,'#a1b678');fill.addColorStop(1,'#6c8450');g.fillStyle=fill;g.fillRect(0,0,128,128);
 g.strokeStyle='#e1dc9b70';g.lineWidth=1.2;g.beginPath();g.moveTo(64,0);g.lineTo(64,128);g.stroke();g.lineWidth=.65;
 for(let i=0;i<9;i++){const y=14+i*12;for(const side of [-1,1]){g.beginPath();g.moveTo(64,y);g.quadraticCurveTo(64+side*24,y-10,64+side*57,y-20);g.stroke();}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}

// Individual folded, pointed leaves form a volume, with no stacked foliage cards.
function leafCluster(count){
 const positions=[],uvs=[],colors=[],indices=[];const rot=new T.Quaternion(),c=new T.Color();
 const template=[V(0,-.5,0),V(-.22,-.12,0),V(0,0,.07),V(.22,-.12,0),V(-.17,.27,.005),V(.17,.27,.005),V(0,.5,.015)];
 const tex=[[.5,0],[0,.38],[.5,.5],[1,.38],[.12,.77],[.88,.77],[.5,1]];
 const faces=[0,1,2,0,2,3,1,4,2,3,2,5,4,6,2,5,2,6];
 for(let i=0;i<count;i++){
  const a=range(0,6.28),r=Math.pow(random(),.4)*2.2,y=range(-.95,1.05)*Math.sqrt(Math.max(.12,1-r*r/5.3));
  const origin=V(Math.cos(a)*r,y,Math.sin(a)*r),scale=range(.55,1.05);
  rot.setFromEuler(new T.Euler(range(.5,2.2),a+range(-1,1),range(-.8,.8)));
  c.setHSL(range(.22,.28),range(.23,.38),range(.61,.88));const offset=positions.length/3;
  template.forEach((v,j)=>{const p=v.clone().multiplyScalar(scale).applyQuaternion(rot).add(origin);positions.push(p.x,p.y,p.z);uvs.push(...tex[j]);const shade=.8+Math.max(y,0)*.2;colors.push(c.r*shade,c.g*shade,c.b*shade);});faces.forEach(f=>indices.push(offset+f));
 }
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function treeGeometry(bark,variant){
 const branches=new T.Group(),crowns=[],rootParts=[];const lean=variant?.72:-.43;
 const path=[V(0,0,0),V(lean*.2,1.6,.12),V(lean*.6,3.8,-.17),V(lean,5.5,.22)];
 for(let j=0;j<3;j++)bar(path[j],path[j+1],.35-j*.07,bark,branches,.26-j*.065);
 for(let i=0;i<5;i++){
  const a=i/5*6.28+range(-.35,.35),radius=range(1.8,3.4),height=range(5.7,8.7);
  const start=path[1+(i%2)].clone(),fork=V(Math.cos(a)*radius*.6+lean,4.9+range(-.5,.8),Math.sin(a)*radius*.5),end=V(Math.cos(a)*radius+lean,height,Math.sin(a)*radius);
  bar(start,fork,.14,bark,branches,.09);bar(fork,end,.09,bark,branches,.035);crowns.push(end);
  for(const s of [-1,1]){const tip=end.clone().add(V(Math.cos(a+s)*range(.9,1.8),range(-.2,.4),Math.sin(a+s)*range(.9,1.8)));bar(fork.clone().lerp(end,.72),tip,.036,bark,branches,.012);}
 }
 branches.updateMatrixWorld(true);const branchParts=branches.children.map(m=>{const geo=m.geometry.clone().applyMatrix4(m.matrixWorld);m.geometry.dispose();return geo;});
 const trunk=mergeGeometries(branchParts);branchParts.forEach(g=>g.dispose());
 for(let i=0;i<8;i++){
  const a=i/8*6.28+range(-.23,.23),reach=range(1.8,3.5),h=range(1.5,3.3);
  const points=[V(lean*.2,h,0),V(Math.cos(a)*reach*.26,h*.65,Math.sin(a)*reach*.22),V(Math.cos(a)*reach*.72,.3,Math.sin(a)*reach*.64),V(Math.cos(a)*reach,-.65,Math.sin(a)*reach)];
  const geo=new T.TubeGeometry(new T.CatmullRomCurve3(points),7,range(.075,.12),5,false);const pos=geo.attributes.position;
  // Tapering prevents every stilt root from reading as the same bent pipe.
  for(let j=0;j<pos.count;j++){const y=pos.getY(j);const taper=.55+.45*T.MathUtils.clamp((y+.65)/(h+.65),0,1);const ring=Math.floor(j/6)/7,axis=new T.CatmullRomCurve3(points).getPointAt(ring);pos.setXYZ(j,axis.x+(pos.getX(j)-axis.x)*taper,y,axis.z+(pos.getZ(j)-axis.z)*taper);}
  geo.computeVertexNormals();rootParts.push(geo);
 }
 const roots=mergeGeometries(rootParts);rootParts.forEach(g=>g.dispose());return {trunk,roots,crowns};
}

export function buildWorld(scene){
 const mobile=smallScreen(),groundMap=texture('mud');groundMap.repeat.set(22,205);
 const ground=mat(0xc1b199,{map:groundMap,bumpMap:groundMap,bumpScale:.16,vertexColors:true}),barkMap=texture('bark');barkMap.repeat.set(1,2);
 const bark=mat(0xa9a18b,{map:barkMap,bumpMap:barkMap,bumpScale:.085});
 // Navigable edge stays identical to the collision channel. Wet bank colors reveal the tide line.
 for(const side of [-1,1]){
  const pos=[],uv=[],idx=[],colors=[];const N=400,M=20,c=new T.Color();
  for(let i=0;i<=N;i++){const z=240-i*3.5;for(let j=0;j<=M;j++){
   const d=Math.pow(j/M,1.7)*135,edge=center(z)+side*width(z),x=edge+side*d;
   const y=j===0?-.7:Math.min(2.25,d*.16)-.25+Math.sin(z*.13+d*.15)*.23+range(-.10,.10);pos.push(x,y,z);uv.push(j/M,i/N);
   const wet=T.MathUtils.smoothstep(y,-.15,1.4);c.setRGB(.34+wet*.51,.34+wet*.44,.28+wet*.34);c.multiplyScalar(.94+Math.sin(z*.19+d*.72)*.06);colors.push(c.r,c.g,c.b);
  }}
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*(M+1)+j,b=a+M+1;idx.push(a,b,a+1,b,b+1,a+1);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(idx);geo.computeVertexNormals();const land=mesh(geo,ground,scene);land.material.side=T.DoubleSide;land.castShadow=false;
 }
 const variants=[treeGeometry(bark,0),treeGeometry(bark,1)],leafGeo=leafCluster(mobile?56:82),breeze={value:0};
 const leafMaterial=mat(0xffffff,{map:leafTexture(),vertexColors:true,side:T.DoubleSide,roughness:.72});
 leafMaterial.onBeforeCompile=shader=>{
  shader.uniforms.breezeTime=breeze;shader.vertexShader='uniform float breezeTime;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
   vec3 worldLeaf=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;
   float leafFlex=clamp(position.y*.3+.55,.1,1.);
   transformed.x+=sin(worldLeaf.x*.43+worldLeaf.z*.25+breezeTime*.9)*.085*leafFlex;
   transformed.z+=sin(worldLeaf.z*.32+breezeTime*.67)*.055*leafFlex;`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`outgoingLight+=diffuseColor.rgb*vec3(.08,.105,.035)*(1.-abs(dot(normal,geometryViewDir)));\n#include <opaque_fragment>`);
 };
 const dummy=new T.Object3D(),color=new T.Color();const chunkCount=12,treesPerChunk=mobile?46:62;
 const sections=Array.from({length:chunkCount},(_,i)=>{const group=new T.Group();group.userData.centerZ=169-i*112;scene.add(group);return group;});
 // Short forest sections can be culled independently in both the view and reflection.
 for(let chunk=0;chunk<chunkCount;chunk++)for(let variant=0;variant<2;variant++){
  const g=variants[variant],count=treesPerChunk/2,trunks=new T.InstancedMesh(g.trunk,bark,count),roots=new T.InstancedMesh(g.roots,bark,count),leaves=new T.InstancedMesh(leafGeo,leafMaterial,count*5);
  for(let i=0;i<count;i++){
   const side=(i+variant)%2?1:-1,z=225-(chunk+random())*112,offset=i<Math.ceil(count*.64)?range(2,15):range(15,55),x=center(z)+side*(width(z)+offset);
   const sy=range(.72,1.62),sx=range(.9,1.5),yaw=range(0,6.28);dummy.position.set(x,offset<8?.05:1.1,z);dummy.scale.set(sx,sy,sx);dummy.rotation.set(range(-.04,.04),yaw,range(-.095,.095));dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);roots.setMatrixAt(i,dummy.matrix);
   for(let j=0;j<g.crowns.length;j++){const p=g.crowns[j].clone().applyMatrix4(dummy.matrix);const m=new T.Matrix4().compose(p,new T.Quaternion().setFromEuler(new T.Euler(range(-.2,.2),yaw+j,range(-.14,.14))),V(sx*range(.95,1.45),sy*range(1.1,1.65),sx*range(.95,1.45)));leaves.setMatrixAt(i*5+j,m);color.setHSL(range(.23,.29),range(.20,.35),range(.46,.67));leaves.setColorAt(i*5+j,color);}
  }
  trunks.castShadow=roots.castShadow=leaves.castShadow=true;leaves.receiveShadow=trunks.receiveShadow=roots.receiveShadow=true;trunks.computeBoundingSphere();roots.computeBoundingSphere();leaves.computeBoundingSphere();sections[chunk].add(trunks,roots,leaves);
 }
 // Fine breathing roots and scattered fallen twigs break up the wet mud.
 const rootGeo=new T.CylinderGeometry(.012,.067,1,4),twigGeo=new T.CylinderGeometry(.024,.046,1,4);
 for(let chunk=0;chunk<chunkCount;chunk++){
  const count=mobile?210:340,pneumatophores=new T.InstancedMesh(rootGeo,bark,count),twigs=new T.InstancedMesh(twigGeo,bark,22);
  for(let i=0;i<count;i++){const z=225-(chunk+random())*112,side=i%2?1:-1,d=range(.3,7);dummy.position.set(center(z)+side*(width(z)+d),.02+d*.06,z);dummy.scale.set(1,range(.25,.9),1);dummy.rotation.set(range(-.3,.3),0,range(-.3,.3));dummy.updateMatrix();pneumatophores.setMatrixAt(i,dummy.matrix);}
  for(let i=0;i<22;i++){const z=225-(chunk+random())*112,side=i%2?1:-1,d=range(2,7);dummy.position.set(center(z)+side*(width(z)+d),d*.1,z);dummy.scale.set(1,range(.6,2.5),1);dummy.rotation.set(Math.PI*.5,range(0,6.28),range(-.2,.2));dummy.updateMatrix();twigs.setMatrixAt(i,dummy.matrix);}
  pneumatophores.receiveShadow=true;twigs.receiveShadow=true;sections[chunk].add(pneumatophores,twigs);
  const shrubCount=mobile?30:46,bushes=new T.InstancedMesh(leafGeo,leafMaterial,shrubCount);
  for(let i=0;i<shrubCount;i++){const z=225-(chunk+random())*112,side=i%2?1:-1;dummy.position.set(center(z)+side*(width(z)+range(3,18)),range(1.5,2.8),z);dummy.scale.set(range(.75,1.2),range(.7,1.2),range(.75,1.2));dummy.rotation.set(0,range(0,6.28),range(-.2,.2));dummy.updateMatrix();bushes.setMatrixAt(i,dummy.matrix);color.setHSL(.25,.36,range(.45,.64));bushes.setColorAt(i,color);}bushes.castShadow=bushes.receiveShadow=true;bushes.computeBoundingSphere();sections[chunk].add(bushes);
 }
 const dock=new T.Group(),wood=mat(0x9b8060,{map:texture('wood')});const dz=26,dx=center(dz)+width(dz)-3;dock.position.set(dx,.5,dz);
 for(let i=0;i<15;i++)mesh(new T.BoxGeometry(8,.17,.45),wood,dock,2,.4,i*.51-3.6);
 for(const x of [-1,5])for(const z of [-3.7,3.7])bar(V(x,-1,z),V(x,1.3,z),.16,bark,dock);scene.add(dock);
 return {update(t,position){breeze.value=t;if(position)for(const section of sections)section.visible=Math.abs(section.userData.centerZ-position.z)<(mobile?410:510);}};
}

export function buildSky(scene){
 const uniforms={top:{value:new T.Color('#7fa5ac')},horizon:{value:new T.Color('#f0d4a5')},sun:{value:V(-.45,.27,-.85).normalize()},time:{value:0}};
 const sky=mesh(new T.SphereGeometry(1800,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,vertexShader:`varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vWorld;uniform vec3 top;uniform vec3 horizon;uniform vec3 sun;uniform float time;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float a=.5,v=0.;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+.7;a*=.5;}return v;}
 void main(){vec3 d=normalize(vWorld);float h=max(d.y,0.);vec3 c=mix(horizon,top,pow(h,.4));float s=max(dot(d,sun),0.);c+=vec3(1.,.65,.29)*pow(s,9.)*.14;c+=vec3(1.,.76,.39)*pow(s,120.)*.2;c+=vec3(1.,.91,.69)*smoothstep(.99972,.9999,s)*2.;vec2 p=d.xz/(max(d.y,.07))*1.35;float cloud=fbm(p+vec2(time*.0012,0.));float wisps=fbm(p*vec2(.7,3.4)+vec2(time*.002,.8));float mask=(smoothstep(.51,.75,cloud)*.28+smoothstep(.57,.77,wisps)*.16)*smoothstep(.015,.2,h);vec3 cloudColor=mix(vec3(.81,.86,.83),vec3(1.,.86,.64),pow(s,6.));c=mix(c,cloudColor,mask);gl_FragColor=vec4(c,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>}`,fog:false}),scene);sky.castShadow=sky.receiveShadow=false;return {sky,uniforms};
}

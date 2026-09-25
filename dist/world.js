import * as T from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';
import {center,width} from './channel.js';
export {center,width} from './channel.js';
let seed=87234;
export const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
export const range=(a,b)=>a+(b-a)*random();
const V=(x,y,z)=>new T.Vector3(x,y,z);
const mat=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
export function mesh(geo,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
export function bar(a,b,r,material,parent,r2=r){const delta=b.clone().sub(a);const m=mesh(new T.CylinderGeometry(r2,r,delta.length(),7),material,parent);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());return m;}
export function texture(type){
 const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
 const base=type==='wood'?[119,77,43]:type==='bark'?[99,97,73]:type==='mud'?[100,94,67]:[186,167,114];
 const im=g.createImageData(512,512);
 for(let y=0;y<512;y++)for(let x=0;x<512;x++){const i=(y*512+x)*4;let n=range(-17,17);if(type==='wood')n+=Math.sin(y*.5+Math.sin(x*.02)*2)*10+Math.sin(y*.12)*8;if(type==='bark')n+=Math.sin(x*.3+Math.sin(y*.03))*16;if(type==='canvas')n+=((x%4<2?1:-1)+(y%4<2?1:-1))*7;for(let k=0;k<3;k++)im.data[i+k]=base[k]+n;im.data[i+3]=255;}g.putImageData(im,0,0);
 if(type==='wood'){g.strokeStyle='#33231560';g.lineWidth=3;for(let y=0;y<512;y+=64){g.beginPath();g.moveTo(0,y);g.lineTo(512,y);g.stroke();}for(let n=0;n<250;n++){g.strokeStyle=`rgba(37,26,11,${range(.03,.17)})`;const y=range(0,512),x=range(0,512);g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+30,y+2,x+90,y-1,x+150,y);g.stroke();}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=8;return t;
}

function foliageTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');
 for(let i=0;i<88;i++){const a=range(0,6.28),r=Math.sqrt(random())*112,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r*.82;g.save();g.translate(x,y);g.rotate(a+range(-1,1));const grad=g.createLinearGradient(-12,0,12,0);grad.addColorStop(0,'#657440');grad.addColorStop(.5,'#dae0ac');grad.addColorStop(1,'#95a864');g.fillStyle=grad;g.beginPath();g.ellipse(0,0,range(5,9),range(12,23),0,0,Math.PI*2);g.fill();g.strokeStyle='#e4e6bc66';g.lineWidth=.8;g.beginPath();g.moveTo(0,-15);g.lineTo(0,15);g.stroke();g.restore();}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}
function leafCluster(){
 const parts=[];
 for(let i=0;i<42;i++){
  const a=range(0,Math.PI*2),rad=Math.pow(random(),.5)*2.7;
  const leaf=new T.PlaneGeometry(range(1.7,2.8),range(1.5,2.6));leaf.rotateX(range(-1.5,1.5));leaf.rotateY(a);leaf.rotateZ(range(-1,1));leaf.translate(Math.cos(a)*rad,range(-1.7,1.7)*(1-rad/5),Math.sin(a)*rad);parts.push(leaf);
 }
 const merged=mergeGeometries(parts);parts.forEach(p=>p.dispose());return merged;
}
export function buildWorld(scene){
 const groundMap=texture('mud');groundMap.repeat.set(18,160);
 const ground=mat(0x9d9779,{map:groundMap}),bark=mat(0xaba48e,{map:texture('bark')});
 const mud=mat(0x65583b,{map:groundMap});
 // Fine, irregular tidal banks. The navigable centre is shared with the boat collision model.
 for(const side of [-1,1]){
  const pos=[],uv=[],idx=[];const N=400,M=12;
  for(let i=0;i<=N;i++){const z=240-i*3.5;for(let j=0;j<=M;j++){const d=j/M*135;const edge=center(z)+side*width(z);const x=edge+side*d;const y=j===0?-.7:Math.min(2.25,d*.16)-.25+Math.sin(z*.13+d*.15)*.23+range(-.12,.12);pos.push(x,y,z);uv.push(j/M,i/N);}}
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*(M+1)+j,b=a+M+1;idx.push(a,b,a+1,b,b+1,a+1);}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(idx);geo.computeVertexNormals();const land=mesh(geo,ground,scene);land.material.side=T.DoubleSide;land.castShadow=false;
 }
 // Shared geometries keep hundreds of mangroves affordable in the reflection pass.
 const trunkParts=[],rootParts=[],crowns=[];const temp=new T.Group();
 for(let i=0;i<6;i++){const a=i/6*Math.PI*2;const end=V(Math.cos(a)*range(1.7,3.1),range(4.8,8.5),Math.sin(a)*range(1.7,3.1));bar(V(0,2.7,0),end,.14,bark,temp,.055);crowns.push(end);}
 bar(V(0,0,0),V(.2,5.7,.1),.28,bark,temp,.13);
 temp.updateMatrixWorld(true);for(const m of temp.children){trunkParts.push(m.geometry.clone().applyMatrix4(m.matrixWorld));m.geometry.dispose();}
 const trunkGeo=mergeGeometries(trunkParts);trunkParts.forEach(p=>p.dispose());temp.clear();
 for(let i=0;i<9;i++){const a=i/9*Math.PI*2;const path=new T.CatmullRomCurve3([V(0,2.6,0),V(Math.cos(a)*.8,1.4,Math.sin(a)*.8),V(Math.cos(a)*2,.4,Math.sin(a)*2),V(Math.cos(a)*2.6,-.6,Math.sin(a)*2.6)]);rootParts.push(new T.TubeGeometry(path,7,.08,5,false));}
 const rootsGeo=mergeGeometries(rootParts);rootParts.forEach(p=>p.dispose());const leafGeo=leafCluster();
 const treeCount=920,canopies=treeCount*crowns.length;
 const leafMaterial=mat(0xffffff,{map:foliageTexture(),alphaTest:.46,side:T.DoubleSide});
 const breeze={value:0};
 leafMaterial.onBeforeCompile=shader=>{shader.uniforms.breezeTime=breeze;shader.vertexShader='uniform float breezeTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>\nvec3 worldLeaf=(modelMatrix*instanceMatrix*vec4(position,1.)).xyz;transformed.x+=sin(worldLeaf.x*.22+worldLeaf.z*.17+breezeTime*.85)*.09;transformed.z+=sin(worldLeaf.z*.19+breezeTime*.7)*.06;`);};
 const trunks=new T.InstancedMesh(trunkGeo,bark,treeCount),roots=new T.InstancedMesh(rootsGeo,bark,treeCount),leaves=new T.InstancedMesh(leafGeo,leafMaterial,canopies);
 const dummy=new T.Object3D(),color=new T.Color();
 for(let i=0;i<treeCount;i++){
  const side=i%2?1:-1,z=range(-1110,225),offset=i<380?range(2,12):range(12,64);const x=center(z)+side*(width(z)+offset);const sy=range(.65,1.65),sx=range(.9,1.7),yaw=range(0,6.28);dummy.position.set(x,offset<8?.15:1.4,z);dummy.scale.set(sx,sy,sx);dummy.rotation.set(0,yaw,range(-.07,.07));dummy.updateMatrix();trunks.setMatrixAt(i,dummy.matrix);roots.setMatrixAt(i,dummy.matrix);
  for(let j=0;j<crowns.length;j++){const p=crowns[j].clone().applyMatrix4(dummy.matrix);const m=new T.Matrix4().compose(p,new T.Quaternion().setFromAxisAngle(V(0,1,0),yaw+j),V(sx*range(1,1.5),sy*range(.8,1.2),sx*range(1,1.5)));leaves.setMatrixAt(i*6+j,m);color.setHSL(range(.215,.285),range(.25,.44),range(.30,.52));leaves.setColorAt(i*6+j,color);}
 }
 trunks.castShadow=roots.castShadow=leaves.castShadow=true;leaves.receiveShadow=trunks.receiveShadow=true;scene.add(trunks,roots,leaves);
 // Pneumatophores: the thin breathing roots characteristic of a tidal mangrove bank.
 const pneumatophores=new T.InstancedMesh(new T.CylinderGeometry(.023,.085,1,4),bark,4800);
 for(let i=0;i<4800;i++){const z=range(-1120,225),side=i%2?1:-1,d=range(.1,7);dummy.position.set(center(z)+side*(width(z)+d),.02+d*.05,z);dummy.scale.set(1,range(.3,1.1),1);dummy.rotation.set(range(-.3,.3),0,range(-.3,.3));dummy.updateMatrix();pneumatophores.setMatrixAt(i,dummy.matrix);}scene.add(pneumatophores);
 // Low shoreline shrubs add a second scale of foliage below the canopy.
 const bushes=new T.InstancedMesh(leafGeo,leafMaterial,1100);
 for(let i=0;i<1100;i++){const z=range(-1130,225),side=i%2?1:-1;dummy.position.set(center(z)+side*(width(z)+range(2,18)),range(1,2.7),z);dummy.scale.setScalar(range(.5,1));dummy.rotation.set(0,range(0,6.28),0);dummy.updateMatrix();bushes.setMatrixAt(i,dummy.matrix);color.setHSL(.24,.4,range(.32,.5));bushes.setColorAt(i,color);}bushes.castShadow=true;scene.add(bushes);
 // A quiet timber landing marks the starting point.
 const dock=new T.Group(),wood=mat(0x9b8060,{map:texture('wood')});const dz=26,dx=center(dz)+width(dz)-3;dock.position.set(dx,.5,dz);
 for(let i=0;i<15;i++)mesh(new T.BoxGeometry(8,.17,.45),wood,dock,2,.4,i*.51-3.6);
 for(const x of [-1,5])for(const z of [-3.7,3.7])bar(V(x,-1,z),V(x,1.3,z),.16,bark,dock);scene.add(dock);
 const birds=[];const birdMat=mat(0xf0eee0);const wingGeo=new T.BufferGeometry();wingGeo.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1.4,.15,-.35,.4,0,.35],3));wingGeo.computeVertexNormals();birdMat.side=T.DoubleSide;
 for(let i=0;i<15;i++){const b=new T.Group();const l=mesh(wingGeo,birdMat,b),r=mesh(wingGeo,birdMat,b);r.scale.x=-1;mesh(new T.SphereGeometry(.16,6,4),birdMat,b).scale.set(.6,.8,2.8);b.position.set(range(-40,40),range(15,30),range(-380,60));b.userData={left:l,right:r,seed:range(0,20),x:b.position.x,z:b.position.z};birds.push(b);scene.add(b);}
 return {birds,update(t){breeze.value=t;for(const b of birds){b.position.x=b.userData.x+Math.sin(t*.05+b.userData.seed)*25;b.position.z=b.userData.z+Math.sin(t*.025+b.userData.seed)*65;b.rotation.y=Math.cos(t*.05+b.userData.seed)*.3;b.userData.left.rotation.z=Math.sin(t*3+b.userData.seed)*.4;b.userData.right.rotation.z=-Math.sin(t*3+b.userData.seed)*.4;}}};
}

export function buildSky(scene){
 const uniforms={top:{value:new T.Color('#7fa5ac')},horizon:{value:new T.Color('#f0d4a5')},sun:{value:V(-.45,.27,-.85).normalize()},time:{value:0}};
 const sky=mesh(new T.SphereGeometry(1800,32,16),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms,vertexShader:`varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vWorld;uniform vec3 top;uniform vec3 horizon;uniform vec3 sun;uniform float time;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float a=.5,v=0.;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+.7;a*=.5;}return v;}
 void main(){vec3 d=normalize(vWorld);float h=max(d.y,0.);vec3 c=mix(horizon,top,pow(h,.55));float s=max(dot(d,sun),0.);c+=vec3(1.,.68,.29)*pow(s,22.)*.3;c+=vec3(1.,.87,.52)*smoothstep(.9995,.99985,s)*2.;vec2 p=d.xz/(max(d.y,.035))*1.4;float cloud=fbm(p+vec2(time*.002,0.));float mask=smoothstep(.51,.76,cloud)*smoothstep(0.,.12,h);c=mix(c,vec3(.94,.9,.8),mask*.44);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,fog:false}),scene);sky.castShadow=sky.receiveShadow=false;return {sky,uniforms};
}



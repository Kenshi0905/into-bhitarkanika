import * as T from 'three';
import {mesh,bar,texture} from './world.js';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';
import {createStandardBoatman,createRowingVisual} from './rowing-visual.js';
import {SCULLING} from './rowing-motion.js';
const V=(x,y,z)=>new T.Vector3(x,y,z);

// Keep animated groups in place; combine only their immutable mesh children.
// Local transforms are baked once, reducing repeated draws in shadows and reflections.
function batchStaticParts(group,animated){
 const buckets=new Map();
 for(const child of [...group.children]){
  if(child.userData.rowingVisual)continue;
  if(child.isGroup){batchStaticParts(child,animated);continue;}
  if(!child.isMesh||animated.has(child)||Array.isArray(child.material))continue;
  const key=`${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:${child.visible}:${child.renderOrder}`;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(child);
 }
 for(const parts of buckets.values()){
  if(parts.length<2)continue;
  const geometries=parts.map(part=>{part.updateMatrix();return part.geometry.clone().applyMatrix4(part.matrix);});
  const geometry=mergeGeometries(geometries,false);
  geometries.forEach(g=>g.dispose());
  if(!geometry)continue;
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const first=parts[0],merged=new T.Mesh(geometry,first.material);
  merged.name='Static boat details';merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;merged.visible=first.visible;merged.renderOrder=first.renderOrder;
  group.add(merged);
  for(const part of parts){group.remove(part);part.geometry.dispose();}
 }
}
export function buildBoat(scene){
 const boat=new T.Group();scene.add(boat);const woodMap=texture('wood');woodMap.repeat.set(1,2);
 const wood=new T.MeshStandardMaterial({color:0x9d6434,map:woodMap,roughness:.72,bumpMap:woodMap,bumpScale:.012});
 const dark=new T.MeshStandardMaterial({color:0x302a20,map:woodMap,roughness:.7});
 const paint=new T.MeshStandardMaterial({color:0x274e48,map:woodMap,roughness:.68});
 const cream=new T.MeshStandardMaterial({color:0xddd9b9,roughness:.82});
 const brass=new T.MeshStandardMaterial({color:0xa39668,metalness:.7,roughness:.35});
 const orange=new T.MeshStandardMaterial({color:0xbf522b,roughness:.8});
 const rubber=new T.MeshStandardMaterial({color:0x191d1b,roughness:.95});
 // Stable tags let High substitute surfaces without rebuilding the craft.
 for(const [surface,material] of Object.entries({wood,dark,paint,cream,brass,orange,rubber}))material.userData.boatSurface=surface;
 // Lofted wooden hull: sharp raised bow, rounded bilge, and a narrow keel.
 const pos=[],uv=[],idx=[],rings=44,sides=24;
 for(let i=0;i<=rings;i++){const t=i/rings,z=(t-.5)*15;const w=1.85*Math.pow(Math.sin(Math.PI*t),.48)+.035;for(let j=0;j<=sides;j++){const a=j/sides*Math.PI;const x=-Math.cos(a)*w,y=.83-Math.sin(a)*1.65+Math.pow(Math.abs(t-.5)*2,5)*.6;pos.push(x,y,z);uv.push(j/sides*2,t*3);}}
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;idx.push(a,a+1,b,b,a+1,b+1);}const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(pos,3));hull.setAttribute('uv',new T.Float32BufferAttribute(uv,2));hull.setIndex(idx);hull.computeVertexNormals();paint.side=T.DoubleSide;mesh(hull,paint,boat);
 const deckShape=new T.Shape();for(let i=0;i<=44;i++){const t=i/44,z=(t-.5)*15,w=1.79*Math.pow(Math.sin(Math.PI*t),.48)+.025;if(i===0)deckShape.moveTo(w,z);else deckShape.lineTo(w,z);}for(let i=44;i>=0;i--){const t=i/44,z=(t-.5)*15,w=1.79*Math.pow(Math.sin(Math.PI*t),.48)+.025;deckShape.lineTo(-w,z);}const deck=mesh(new T.ShapeGeometry(deckShape),wood,boat,0,.73,0);deck.rotation.x=-Math.PI/2;
 for(const s of [-1,1]){
  const points=[];for(let i=0;i<=44;i++){const t=i/44;points.push(V(s*(1.87*Math.pow(Math.sin(Math.PI*t),.48)+.025),.9+Math.pow(Math.abs(t-.5)*2,5)*.6,(t-.5)*15));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),50,.07,7,false),cream,boat);
  for(const z of [-4.7,-2.8,0,2.8,4.7]){const tire=mesh(new T.TorusGeometry(.28,.075,7,16),rubber,boat,s*1.87,.46,z);tire.rotation.y=Math.PI/2;bar(V(s*1.83,.85,z),V(s*1.9,.45,z),.018,cream,boat);}
  for(let z=-4.9;z<=4.5;z+=1.6){bar(V(s*1.65,.8,z),V(s*1.65,1.5,z),.035,wood,boat);}bar(V(s*1.65,1.48,-4.9),V(s*1.65,1.48,4.7),.045,wood,boat);
 }
 // Local river-launch canopy: open sides, shallow rounded cream canvas roof.
 const canvasMap=texture('canvas');canvasMap.repeat.set(3,5);const canvas=new T.MeshStandardMaterial({color:0xf3ead0,map:canvasMap,bumpMap:canvasMap,bumpScale:.003,roughness:.94,side:T.DoubleSide,shadowSide:T.FrontSide});
 canvas.userData.boatSurface='canvas';
 const roofP=[],roofUv=[],roofI=[];for(let j=0;j<=16;j++)for(let i=0;i<=24;i++){const x=(i/24-.5)*4.25,z=(j/16-.5)*8.6+.4,y=3.37+.52*Math.cos(x/4.25*Math.PI);roofP.push(x,y,z);roofUv.push(i/24,j/16);}for(let j=0;j<16;j++)for(let i=0;i<24;i++){const a=j*25+i;roofI.push(a,a+25,a+1,a+1,a+25,a+26);}const roofGeo=new T.BufferGeometry();roofGeo.setAttribute('position',new T.Float32BufferAttribute(roofP,3));roofGeo.setAttribute('uv',new T.Float32BufferAttribute(roofUv,2));roofGeo.setIndex(roofI);roofGeo.computeVertexNormals();mesh(roofGeo,canvas,boat);
 for(const z of [-3.9,-1.8,.4,2.6,4.7]){const points=[];for(let i=0;i<=16;i++){const x=(i/16-.5)*4.18;points.push(V(x,3.32+.52*Math.cos(x/4.25*Math.PI),z));}mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.036,6,false),wood,boat);for(const s of [-1,1])bar(V(s*1.66,.83,z),V(s*1.95,3.4,z),.042,wood,boat);}
 for(const s of [-1,1]){mesh(new T.BoxGeometry(.055,.25,8.65),canvas,boat,s*2.11,3.25,.4);mesh(new T.BoxGeometry(.47,.18,6.8),wood,boat,s*1.19,1.14,.4);for(const z of [-2.4,.4,3.2])mesh(new T.BoxGeometry(.12,.45,.16),wood,boat,s*1.19,.95,z);}
 for(let z=-3;z<=3;z+=1.5){const jacket=mesh(new T.BoxGeometry(.39,.5,.14),orange,boat,-1.15,1.54,z);jacket.rotation.z=.15;bar(V(-1.13,1.75,z),V(-1.13,1.36,z),.018,cream,boat);}
 // Foredeck, helm, brass fittings, rope coils, bow pennant.
 const helm=mesh(new T.BoxGeometry(.8,.7,.5),paint,boat,0,1.2,-4.9);const wheel=mesh(new T.TorusGeometry(.28,.027,6,20),dark,boat,0,1.7,-4.63);wheel.rotation.x=-.5;for(let a=0;a<6;a++){const angle=a*Math.PI/3;bar(V(0,1.7,-4.63),V(Math.cos(angle)*.28,1.7+Math.sin(angle)*.25,-4.63-Math.sin(angle)*.13),.018,brass,boat);}for(const z of [-6.4,6]){bar(V(0,.8,z),V(0,1.14,z),.05,brass,boat);bar(V(-.19,1.12,z),V(.19,1.12,z),.04,brass,boat);}
 for(let i=0;i<5;i++){const rope=mesh(new T.TorusGeometry(.24+i*.045,.022,5,28),cream,boat,.55,.79,-5.8);rope.rotation.x=Math.PI/2;}
 bar(V(0,1.15,-7.1),V(0,2.6,-7.1),.023,wood,boat);const flagGeo=new T.BufferGeometry();flagGeo.setAttribute('position',new T.Float32BufferAttribute([0,2.6,-7.1,.68,2.35,-7.1,0,2.1,-7.1],3));flagGeo.computeVertexNormals();const flagMat=orange.clone();flagMat.side=T.DoubleSide;mesh(flagGeo,flagMat,boat);
 const lampMat=new T.MeshStandardMaterial({color:0xffde91,emissive:0xffb643,emissiveIntensity:.4});mesh(new T.SphereGeometry(.12,12,8),lampMat,boat,0,3.3,-3.7);
 const life=mesh(new T.TorusGeometry(.36,.11,8,24),orange,boat,1.72,2.1,3.6);life.rotation.y=Math.PI/2;
 // One shared stern station leaves room for both sculling handles and planted feet.
 const person=new T.Group();person.position.fromArray(SCULLING.station);person.userData.rowingVisual=true;boat.add(person);
 const skin=new T.MeshStandardMaterial({color:0x8f593c,roughness:.85}),shirt=new T.MeshStandardMaterial({color:0xd3c7ab,roughness:1}),trousers=new T.MeshStandardMaterial({color:0x3b5351,roughness:1});
 const standardHuman=createStandardBoatman(person,{skin,shirt,trousers,cream});
 batchStaticParts(boat,new Set([wheel]));
 const craft={boat,person,wheel,standardHuman};craft.rowingVisual=createRowingVisual(craft,scene);return craft;
}


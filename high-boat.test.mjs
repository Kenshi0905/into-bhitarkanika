import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';

const root=new URL('./dist/',import.meta.url),threeURL=new URL('vendor/three.module.js',root).href,T=await import(threeURL);
registerHooks({resolve(specifier,context,next){return next(specifier==='three'?threeURL:specifier,context);}});
const {createHighBoat,createCanopyShell,createDeckBoards,canopySurface}=await import('./dist/high-boat.js');
const {buildBoat}=await import('./dist/boat.js');

const noop=()=>{},context=new Proxy({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createLinearGradient:()=>({addColorStop:noop})},{get:(object,key)=>object[key]??noop,set:(object,key,value)=>(object[key]=value,true)});
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>context})};
const finite=geometry=>Object.values(geometry.attributes).every(a=>a.array.every(Number.isFinite));

test('High canopy has supported top, underside and thickness within the original launch dimensions',()=>{
 const geometry=createCanopyShell(),p=geometry.attributes.position,n=geometry.attributes.normal;
 assert.ok(finite(geometry));geometry.computeBoundingBox();
 assert.ok(geometry.boundingBox.min.x>=-2.15&&geometry.boundingBox.max.x<=2.15);
 assert.ok(geometry.boundingBox.min.z>=-3.93&&geometry.boundingBox.max.z<=4.73);
 assert.ok(geometry.boundingBox.max.y<3.91&&geometry.boundingBox.min.y>3.10);
 const sheetCount=41*49;let underside=0,top=0;
 for(let i=0;i<sheetCount;i++){
  assert.ok(Math.abs(p.getY(i)-p.getY(i+sheetCount)-.026)<1e-6);
  if(n.getY(i)>.8)top++;if(n.getY(i+sheetCount)<-.8)underside++;
 }
 assert.ok(top>sheetCount*.8&&underside>sheetCount*.8);
 for(const z of [-3.9,-1.8,.4,2.6,4.7])assert.ok(Math.abs(canopySurface(0,z)-(3.89-.007))<.001);
 assert.ok(canopySurface(0,-2.85)<canopySurface(0,-1.8)-.02,'fabric relaxes between supports rather than looking like an extruded board');
 geometry.dispose();
});

test('deck planks form one fitted surface with bevels, staggered ends and varied timber tone',()=>{
 const geometry=createDeckBoards(),p=geometry.attributes.position,n=geometry.attributes.normal,colours=geometry.attributes.color;
 assert.ok(finite(geometry));assert.ok(geometry.userData.deckBoards>=50&&geometry.userData.deckBoards<=70);
 let top=0,bevel=0;const tones=new Set(),ends=new Set();
 for(let i=0;i<p.count;i++){
  const z=p.getZ(i),half=1.79*Math.pow(Math.max(0,Math.sin(Math.PI*(z/15+.5))),.48)+.025;
  assert.ok(Math.abs(p.getX(i))<=half+.001&&Math.abs(z)<=7.5001);
  assert.ok(p.getY(i)>=.7239&&p.getY(i)<=.7301);
  if(p.getY(i)>.7299)top++;else bevel++;
  tones.add(colours.getX(i).toFixed(3));ends.add(z.toFixed(2));
 }
 assert.ok(top>100&&bevel>100);assert.ok(tones.size>25&&ends.size>30);
 for(let i=0;i<geometry.index.count;i+=3){
  const face=[0,1,2].map(offset=>geometry.index.getX(i+offset));
  if(face.every(j=>p.getY(j)>.7299))for(const j of face)assert.ok(n.getY(j)>.999,'broad board faces stay flat-lit rather than acquiring thin-edge normals');
 }
 geometry.dispose();
});

test('High construction stays batched, preserves working oars, and restores exact Standard references',async()=>{
 const craft=buildBoat(new T.Scene()),before=[];
 craft.boat.traverse(object=>before.push({object,geometry:object.geometry,material:object.material,visible:object.visible}));
 const oars=[];craft.rowingVisual.group.traverse(object=>{if(object.isMesh)oars.push({object,geometry:object.geometry,material:object.material});});
 const high=await createHighBoat({craft,traffic:{vessels:[]},renderer:{capabilities:{getMaxAnisotropy:()=>8}}});
 const stats=high.getStats();assert.equal(stats.detailDraws,5);assert.equal(stats.detailShadowDraws,1);assert.equal(stats.detailReflectionDraws,1);
 for(let cycle=0;cycle<30;cycle++){
  high.setEnabled(true);
  for(const {object,geometry,material} of before){
   const changed=object===craft.boat.children.find(o=>o.material?.name==='High wood')||material?.userData.boatSurface==='canvas';
   if(changed){assert.ok(object.geometry!==geometry);assert.ok(finite(object.geometry));}
  }
  for(const saved of oars){assert.ok(saved.object.geometry===saved.geometry);assert.ok(saved.object.material===saved.material);}
  high.beginReflection();high.endReflection();high.setEnabled(false);
  for(const saved of before){assert.ok(saved.object.geometry===saved.geometry);assert.ok(saved.object.material===saved.material);assert.equal(saved.object.visible,saved.visible);}
 }
 high.setEnabled(true);const roof=craft.boat.children.find(o=>o.material?.name==='High canvas'),wood=craft.boat.children.find(o=>o.material?.name==='High wood');
 const roofRest=roof.geometry.attributes.position.array.slice(),deckRest=wood.geometry.attributes.position.array.slice();let motion=0;
 for(let frame=0;frame<120;frame++){
  high.update(frame/60,1/60,{wind:{x:.6,z:.8,strength:1}});
  const p=roof.geometry.attributes.position;
  for(let i=0;i<p.count;i++)motion=Math.max(motion,Math.abs(p.getY(i)-roofRest[i*3+1]));
  assert.ok(finite(roof.geometry));assert.deepEqual(wood.geometry.attributes.position.array,deckRest);
 }
 assert.ok(motion>.004&&motion<.01);high.dispose();high.dispose();
 for(const saved of before){assert.ok(saved.object.geometry===saved.geometry);assert.ok(saved.object.material===saved.material);}
});

test('existing cabin lamp reveals the night interior with no day light or Standard changes',async()=>{
 const craft=buildBoat(new T.Scene()),lamp=craft.boat.children.find(o=>o.geometry?.type==='SphereGeometry'&&o.position.distanceTo(new T.Vector3(0,3.3,-3.7))<.01);
 const original=lamp.material,geometry=lamp.geometry,emissive=original.emissive.clone(),intensity=original.emissiveIntensity;
 const high=await createHighBoat({craft,traffic:{vessels:[]},renderer:{capabilities:{getMaxAnisotropy:()=>8}}});
 const light=craft.boat.getObjectByName('High existing cabin lamp light');assert.ok(light?.isPointLight);assert.equal(light.castShadow,false);assert.equal(light.decay,2);assert.equal(light.distance,9);assert.ok(light.position.equals(lamp.position));
 assert.equal(light.visible,false);assert.equal(light.intensity,0);
 high.setEnabled(true);const lens=lamp.material;let disposed=false;lens.addEventListener('dispose',()=>{disposed=true;});
 for(let repeat=0;repeat<4;repeat++){
  high.update(10,0,{preset:4});assert.equal(light.intensity,8);assert.ok(lens.emissiveIntensity>1);assert.ok(lens.emissive.equals(light.color));
  high.beginReflection();high.endReflection();assert.equal(light.intensity,8);assert.equal(high.getStats().detailDraws,5);
  high.update(10,0,{preset:2});assert.ok(light.intensity>0&&light.intensity<2);
  for(const preset of [0,1,3]){high.update(10,0,{preset});assert.equal(light.intensity,0);assert.ok(lens.emissiveIntensity<.1);}
  high.setEnabled(false);assert.equal(light.visible,false);assert.equal(light.intensity,0);assert.equal(lamp.material,original);assert.equal(lamp.geometry,geometry);assert.ok(original.emissive.equals(emissive));assert.equal(original.emissiveIntensity,intensity);
  high.setEnabled(true);
 }
 high.dispose();assert.equal(craft.boat.getObjectByName(light.name),undefined);assert.equal(lamp.material,original);assert.equal(lamp.geometry,geometry);assert.equal(disposed,true);
});

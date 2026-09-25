import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Exercise the same local Three.js build used by the browser, without WebGL.
const threeURL=new URL('./dist/vendor/three.module.js',import.meta.url).href;
// Resolve only the browser import-map entries; this also works in Node 20.
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const resolveThree=source=>source.replaceAll("from 'three'",`from '${threeURL}'`);
const utilsURL=moduleURL(resolveThree(await readFile(new URL('./dist/vendor/BufferGeometryUtils.js',import.meta.url),'utf8')));
const faunaURL=moduleURL(resolveThree(await readFile(new URL('./dist/high-fauna.js',import.meta.url),'utf8')).replace("'./vendor/BufferGeometryUtils.js'",`'${utilsURL}'`));
const visualURL=moduleURL(resolveThree(await readFile(new URL('./dist/rowing-visual.js',import.meta.url),'utf8')).replace("'./rowing-motion.js'",`'${new URL('./dist/rowing-motion.js',import.meta.url).href}'`));
const T=await import(threeURL);
const {createRowingRig,poseHuman,fitHumanToDeck,posedContact,createFaunaDetailController,refineClothingGeometry,alignHighWildlife}=await import(faunaURL);
const {createRowingVisual}=await import(visualURL);
const {RowingCycle}=await import('./dist/rowing.js');
const {createTraffic}=await import('./dist/traffic.js');
const spec=JSON.parse(await readFile(new URL('./dist/assets/high/fauna/boatman.json',import.meta.url),'utf8'));
const file=await readFile(new URL('./dist/assets/high/fauna/boatman.bin',import.meta.url));
const buffer=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);

function boatman(){
 const geometry=new T.BufferGeometry();
 for(const [name,a] of Object.entries(spec.attributes)){
  const Typed=a.type==='f'?Float32Array:a.type==='H'?Uint16Array:Uint32Array;
  const attribute=new T.BufferAttribute(new Typed(buffer,a.offset,a.length),a.itemSize);
  if(name==='index')geometry.setIndex(attribute);else geometry.setAttribute(name,attribute);
 }
 const material=new T.MeshStandardMaterial(),mesh=new T.SkinnedMesh(geometry,Array(5).fill(material));
 const bones=spec.bones.map(b=>{const bone=new T.Bone();bone.name=b.name;bone.position.fromArray(b.position);return bone;});
 spec.bones.forEach((b,i)=>{if(b.parent>=0){bones[i].position.sub(new T.Vector3(...spec.bones[b.parent].position));bones[b.parent].add(bones[i]);}else mesh.add(bones[i]);});
 mesh.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));
 const named=Object.fromEntries(bones.map(b=>[b.name,b])),holder=new T.Group();holder.add(mesh);poseHuman(mesh,named,false);
 const scene=new T.Scene(),boat=new T.Group(),person=new T.Group();person.position.set(0,.79,5.42);boat.add(person);scene.add(boat);person.add(holder);
 fitHumanToDeck(mesh,holder,spec.contacts,-.06);
 const craft={boat,person,standardHuman:{update(){}}};craft.rowingVisual=createRowingVisual(craft,scene);
 return {craft,mesh,holder,named,rig:createRowingRig(mesh,named,holder,craft,spec),rowing:new RowingCycle()};
}

test('High boatman grips real oars through paired and single strokes on a rolling boat',()=>{
 const {craft,mesh,holder,rig,rowing}=boatman();
 const initialFeet=posedContact(mesh,spec.contacts.feet).min+holder.position.y;
 assert.ok(Math.abs(initialFeet+.06)<1e-6);
 let checks=0,maxHandError=0,maxFootError=0,maxContactStep=0,maxForearmTurn=0,previous=null,previousBlend=0;
 const phases=new Set();
 // Leave time for the gentle equip motion, then measure over 500 held frames.
 for(let i=0;i<780;i++){
  const time=i/60,input=i<220?{rowBoth:true}:i<440?{rowLeft:true}:i<630?{rowRight:true}:{};
  rowing.step(1/60,input);
  craft.boat.position.set(Math.sin(time)*20,Math.sin(time*.6)*.008,time*2);
  craft.boat.rotation.set(Math.sin(time*.8)*.012,time*.22,Math.cos(time*.6)*.018);
  craft.rowingVisual.update({time,dt:1/60,mode:i<690?'row':'motor',rowing,high:true,waterHeight:(x,z)=>Math.sin(x*.12+time)*.013+Math.cos(z*.11-time)*.01});
  rig.update(time);const hands=rig.getContacts(),pose=craft.rowingVisual.pose;
  for(const side of ['L','R'])maxForearmTurn=Math.max(maxForearmTurn,mesh.getObjectByName(`lowerarm02.${side}`).quaternion.angleTo(new T.Quaternion()));
  if(pose.blend>.9999){
   for(let side=0;side<2;side++)maxHandError=Math.max(maxHandError,hands[side].distanceTo(pose.hands[side]));
   if(previousBlend>.9999)maxContactStep=Math.max(maxContactStep,hands[0].distanceTo(previous[0]),hands[1].distanceTo(previous[1]));
   for(let hand=0;hand<2;hand++)for(let finger=2;finger<=5;finger++){
    const point=mesh.getObjectByName(`Finger contact ${hand===0?'L':'R'}${finger}`).getWorldPosition(new T.Vector3());
    craft.person.worldToLocal(point);point.sub(pose.hands[hand]);point.addScaledVector(pose.gripDirections[hand],-point.dot(pose.gripDirections[hand]));
    // Bone centers remain outside the wood; the surrounding finger surface
    // meets the 35 mm shaft instead of floating above it or piercing its axis.
    assert.ok(point.length()>.036&&point.length()<.055);
   }
   assert.ok(Math.abs(pose.highHandError-Math.max(...hands.map((p,s)=>p.distanceTo(pose.hands[s]))))<1e-9);
   checks++;phases.add(pose.phase);
  }
  maxFootError=Math.max(maxFootError,Math.abs(posedContact(mesh,spec.contacts.feet).min+holder.position.y-initialFeet));
  previous=hands;previousBlend=pose.blend;
 }
 assert.ok(checks>500);
 assert.deepEqual([...phases].sort(),['catch','power','recovery','release','rest']);
 assert.ok(maxHandError<.002,`grip error ${maxHandError} m`);
 assert.ok(maxFootError<.0001,`sole movement ${maxFootError} m`);
 assert.ok(maxContactStep<.04,`oar restart jump ${maxContactStep} m`);
 assert.ok(maxForearmTurn>.03&&maxForearmTurn<1.1,'the forearm shares a bounded portion of the real wrist pronation');
});

test('resuming the detailed rig consumes the live shared stroke without pose accumulation',()=>{
 const {craft,mesh,rig,rowing}=boatman();
 for(let i=0;i<250;i++){
  const time=i/60;rowing.step(1/60,{rowBoth:true});craft.rowingVisual.update({time,dt:1/60,mode:'row',rowing,high:true});
  // Stand in for High being disabled while the shared physical stroke advances.
  if(i<85||i>=220)rig.update(time);
  if(i>=220)for(const [side,contact] of rig.getContacts().entries())assert.ok(contact.distanceTo(craft.rowingVisual.pose.hands[side])<.002);
 }
 const saved=mesh.skeleton.bones.map(b=>b.quaternion.clone()),contacts=rig.getContacts();
 for(let i=0;i<20;i++)rig.update(249/60);
 mesh.skeleton.bones.forEach((bone,i)=>assert.ok(bone.quaternion.angleTo(saved[i])<1e-6));
 rig.getContacts().forEach((p,i)=>assert.ok(p.distanceTo(contacts[i])<1e-9));
});

test('rowing transfers weight through hips while both ankle contacts stay fixed in three dimensions',t=>{
 const {craft,mesh,named,rig,rowing}=boatman(),rootStart=named.root.position.clone();
 const feet=['L','R'].map(side=>mesh.worldToLocal(named[`foot.${side}`].getWorldPosition(new T.Vector3())));
 let movement=0,footError=0,gripError=0;
 for(let i=0;i<420;i++){
  const time=i/60;rowing.step(1/60,i<210?{rowBoth:true}:{rowLeft:true});
  craft.rowingVisual.update({time,dt:1/60,mode:'row',rowing,high:true});rig.update(time);
  movement=Math.max(movement,named.root.position.distanceTo(rootStart));
  for(const [index,side] of ['L','R'].entries())footError=Math.max(footError,mesh.worldToLocal(named[`foot.${side}`].getWorldPosition(new T.Vector3())).distanceTo(feet[index]));
  if(craft.rowingVisual.pose.blend>.9999)gripError=Math.max(gripError,craft.rowingVisual.pose.highHandError);
 }
 t.diagnostic(`Pelvis travel ${(movement*1000).toFixed(2)} mm; ankle drift ${(footError*1000).toFixed(4)} mm; hand error ${(gripError*1000).toFixed(4)} mm.`);
 assert.ok(movement>.002);assert.ok(footError<.0001);assert.ok(gripError<.002);
});

test('garment ease preserves original topology, authored weights, and sole contacts',()=>{
 const {mesh}=boatman(),geometry=mesh.geometry.clone(),before=geometry.attributes.position.array.slice(),weights=geometry.attributes.skinWeight.array.slice();
 refineClothingGeometry(geometry,spec.groups);
 let maxDistance=0,changed=0;
 for(let i=0;i<geometry.attributes.position.count;i++){
  const distance=Math.hypot(...[0,1,2].map(axis=>geometry.attributes.position.array[i*3+axis]-before[i*3+axis]));
  maxDistance=Math.max(maxDistance,distance);if(distance>1e-7)changed++;
 }
 assert.ok(changed>2000&&maxDistance>.012&&maxDistance<.022);assert.deepEqual(geometry.attributes.skinWeight.array,weights);
 assert.equal(geometry.index.count,mesh.geometry.index.count);
 for(const i of spec.contacts.feet)for(let axis=0;axis<3;axis++)assert.equal(geometry.attributes.position.array[i*3+axis],before[i*3+axis]);
 const skin=spec.groups.find(group=>group.materialIndex===0);
 for(let n=skin.start;n<skin.start+skin.count;n++){const i=geometry.index.getX(n);for(let axis=0;axis<3;axis++)assert.equal(geometry.attributes.position.array[i*3+axis],before[i*3+axis]);}
 const once=geometry.attributes.position.array.slice();refineClothingGeometry(geometry,spec.groups);assert.deepEqual(geometry.attributes.position.array,once);
});

test('High wildlife detail meets existing perches and the shared water field without changing source routes',()=>{
 const parent=new T.Group(),detail=new T.Group();parent.add(detail);parent.position.set(12,3,-44);parent.rotation.y=Math.PI/2+.08;parent.scale.setScalar(1.18);
 const bird={mesh:parent,home:new T.Vector3(12,3,-44),side:1,flight:false,species:'white-throated-kingfisher'},saved=parent.position.clone();
 alignHighWildlife({kind:'bird',source:bird,detail},4,{});
 const foot=detail.localToWorld(new T.Vector3(0,.006,-.035)),dx=-.7,dz=-.2,u=T.MathUtils.clamp(((foot.x-12)*dx+(foot.z+44)*dz)/(dx*dx+dz*dz),0,1);
 assert.ok(Math.abs(foot.y-(3-.04+u*.06+.032))<1e-6);assert.ok(parent.position.equals(saved));
 parent.position.set(5,-.286,-30);parent.rotation.set(0,.2,0);parent.scale.setScalar(1.08);
 const source={swims:true,group:parent},before=parent.matrix.clone(),climate={waterHeight:(x,z,t)=>.014*Math.sin(x*.2+t)+.009*Math.cos(z*.3-t)};
 alignHighWildlife({kind:'croc',source,detail},5,climate);const height=climate.waterHeight(5,-30,5);
 assert.ok(Math.abs(parent.position.y+detail.position.y*1.08-(height-.27))<1e-9);assert.ok(Math.abs(detail.rotation.x)<.018);
 assert.equal(parent.position.y,-.286);assert.equal(source.swims,true);assert.ok(parent.matrix.equals(before));
});

test('both physical blades clear the moving water throughout feathered recovery',()=>{
 const {craft,rowing}=boatman(),oars=craft.rowingVisual.group.children.filter(o=>o.name.endsWith('working oar'));
 assert.equal(oars.length,2,'one shared pair must serve both graphics presets');
 const point=new T.Vector3();let checked=0,clearance=Infinity;
 for(let frame=0;frame<300;frame++){
  const time=frame/60,waterHeight=(x,z)=>.015*Math.sin(x*.2+time)+.013*Math.cos(z*.23-time);
  rowing.step(1/60,{rowBoth:true});craft.boat.position.set(0,Math.sin(time)*.015,time);
  craft.boat.rotation.set(Math.sin(time*.8)*.015,.13+time*.12,Math.cos(time*.6)*.018);
  craft.rowingVisual.update({time,dt:1/60,mode:'row',rowing,high:frame%120>60,waterHeight});
  if(frame<100||craft.rowingVisual.pose.phase!=='recovery')continue;
  for(const oar of oars){
   const blade=oar.children.find(o=>o.isGroup).children[0],positions=blade.geometry.attributes.position;
   for(let i=0;i<positions.count;i++){
    point.fromBufferAttribute(positions,i);blade.localToWorld(point);clearance=Math.min(clearance,point.y-waterHeight(point.x,point.z));checked++;
   }
  }
 }
 assert.ok(checked>500);assert.ok(clearance>.005,`recovery blade entered the water: ${clearance} m`);
});

test('taking up and stowing the real oars keeps targets within reach and feet planted',t=>{
 const {craft,mesh,holder,named,rig,rowing}=boatman();
 const initialFeet=posedContact(mesh,spec.contacts.feet).min+holder.position.y;
 const bind=Object.fromEntries(spec.bones.map(b=>[b.name,new T.Vector3(...b.position)]));
 let checked=0,minReachMargin=Infinity,minElbow=Infinity,maxElbow=0,maxHandStep=0,previous=null,worstStep=null,previousBones=null;
 for(let i=0;i<600;i++){
  const time=i/60,mode=i<25||i>=195&&i<265||i>=415&&i<450?'motor':'row';
  rowing.step(1/60,mode==='row'?{rowBoth:true}:{});
  craft.boat.position.set(Math.sin(time)*3,Math.sin(time)*.012,time);
  craft.boat.rotation.set(Math.sin(time*.6)*.012,time*.2,Math.cos(time*.9)*.018);
  craft.rowingVisual.update({time,dt:1/60,mode,rowing,high:true,waterHeight:(x,z)=>Math.sin(x*.12+time)*.013+Math.cos(z*.11-time)*.01});
  rig.update(time);const pose=craft.rowingVisual.pose;
  const hands=rig.getContacts();if(previous)for(let side=0;side<2;side++){const step=hands[side].distanceTo(previous[side]);if(step>maxHandStep){maxHandStep=step;worstStep={frame:i,mode,blend:pose.blend,side,phase:pose.phase,bones:mesh.skeleton.bones.map((b,j)=>({name:b.name,angle:b.quaternion.angleTo(previousBones[j])*180/Math.PI})).sort((a,b)=>b.angle-a.angle).slice(0,4)};}}previous=hands;previousBones=mesh.skeleton.bones.map(b=>b.quaternion.clone());
  assert.ok(Math.abs(posedContact(mesh,spec.contacts.feet).min+holder.position.y-initialFeet)<.0001);
  if(pose.blend<=.1)continue;
  for(const side of ['L','R']){
   const shoulder=named[`upperarm01.${side}`].getWorldPosition(new T.Vector3()),elbow=named[`lowerarm01.${side}`].getWorldPosition(new T.Vector3()),wrist=named[`wrist.${side}`].getWorldPosition(new T.Vector3());
   const angle=shoulder.sub(elbow).angleTo(wrist.sub(elbow))*180/Math.PI;minElbow=Math.min(minElbow,angle);maxElbow=Math.max(maxElbow,angle);
   assert.ok(angle>20&&angle<178,`elbow folded or locked at ${angle} degrees`);
  }
  // Once Motor has released the grip there is no requirement to reach an oar
  // that is being lifted away. Actual hand continuity is checked above instead.
  if(mode==='motor'&&pose.blend<.92)continue;
  // During equip/release the hands deliberately blend away from the handles.
  // Check the target against the complete reach pose, including its clavicle,
  // rather than against a shoulder that is already relaxing toward idle.
  const transitionBlend=pose.blend;pose.blend=1;rig.update(time);
  for(const [index,side] of ['L','R'].entries()){
   const shoulder=craft.person.worldToLocal(named[`upperarm01.${side}`].getWorldPosition(new T.Vector3()));
   const armLength=bind[`upperarm01.${side}`].distanceTo(bind[`lowerarm01.${side}`])+bind[`lowerarm01.${side}`].distanceTo(bind[`wrist.${side}`]);
   // The anatomical wrist-to-palm contact contributes at most 75 mm of reach.
   const margin=armLength+.075-shoulder.distanceTo(pose.hands[index]);minReachMargin=Math.min(minReachMargin,margin);
   checked++;
  }
  pose.blend=transitionBlend;rig.update(time);
 }
 assert.ok(checked>700);t.diagnostic(`Minimum held/equipping target reach margin ${(minReachMargin*1000).toFixed(1)} mm; actual elbows ${minElbow.toFixed(1)}–${maxElbow.toFixed(1)} degrees; hand step ${(maxHandStep*1000).toFixed(1)} mm/frame.`);
 assert.ok(minReachMargin>=-.002,`unreachable handle while taking up/releasing: margin ${minReachMargin} m`);
 assert.ok(maxHandStep<.05,`hands snapped during equip or park: ${maxHandStep} m/frame, ${JSON.stringify(worstStep)}`);
});

function detailFixture(){
 const {craft,mesh,holder}=boatman(),scene=new T.Scene();
 const original=new T.Group();original.visible=true;craft.person.add(original);
 const contact=new T.Mesh(new T.PlaneGeometry(.2,.3),new T.MeshBasicMaterial());contact.userData.skipHighReflection=true;holder.add(contact);
 const hiddenFine=contact.clone();hiddenFine.visible=false;holder.add(hiddenFine);
 const human={holder,mesh,originals:[{o:original,visible:true}]};
 // The geometry fixture needs only the police label's two canvas draw methods.
 const previousDocument=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})};
 let traffic;try{traffic=createTraffic(scene);}finally{if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
 const crew=traffic.vessels.map(vessel=>{
  const group=new T.Group(),people=[],swaps=[];group.visible=false;vessel.group.add(group);
  for(const object of vessel.group.children){
   const ranges=object.userData.crewRanges;if(!ranges)continue;
   const standard=object.geometry,high=standard.clone(),indices=[];
   for(let i=0;i<standard.attributes.position.count;i++)if(!ranges.some(([start,count])=>i>=start&&i<start+count))indices.push(i);
   high.setIndex(indices);swaps.push({mesh:object,standard,high});
  }
  for(const person of vessel.people){const copy=mesh.clone();copy.castShadow=true;group.add(copy);people.push({mesh:copy});}
  return {vessel,group,swaps,people,active:false};
 });
 const replacements=['bird','croc'].map(kind=>{
  const parent=new T.Group(),detail=new T.Group(),simple=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial());scene.add(parent);parent.add(simple,detail);
  const part=simple.clone();part.castShadow=true;detail.add(part);detail.visible=false;
  return {kind,detail,originals:[{o:simple,visible:true}],active:false};
 });
 const controller=createFaunaDetailController({craft,human,replacements,crew});
 return {craft,human,crew,replacements,controller,contact,hiddenFine};
}

test('detailed traffic is limited by distance, with hysteresis and the original silhouettes retained',t=>{
 const {crew,replacements,controller}=detailFixture();
 for(const [i,record] of crew.entries())record.vessel.group.position.set(0,0,32+i*27);
 replacements[0].detail.parent.position.set(0,0,48);replacements[1].detail.parent.position.set(0,0,75);
 controller.setEnabled(true);
 assert.equal(crew[0].active,true);assert.ok(crew.slice(1).every(record=>!record.active));
 for(const record of crew.slice(1))for(const swap of record.swaps)assert.equal(swap.mesh.geometry,swap.standard);
 const before=controller.getStats();assert.equal(before.detailedPeople,1+crew[0].people.length);
 assert.equal(before.reflectedDetailedPeople,1);assert.ok(before.reflectionCrewTrianglesSaved>100000);
 t.diagnostic(`At 32 m: reflection replaces ${crew[0].people.length} detailed people and saves ${before.reflectionCrewTrianglesSaved} triangles after counting the Standard fallback.`);
 crew[0].vessel.group.position.z=52;controller.update();assert.equal(crew[0].active,true);
 crew[0].vessel.group.position.z=57;controller.update();assert.equal(crew[0].active,false);
 crew[0].vessel.group.position.z=50;controller.update();assert.equal(crew[0].active,false);
 crew[0].vessel.group.position.z=45;controller.update();assert.equal(crew[0].active,true);
 assert.ok(crew[0].people.every(p=>!p.mesh.castShadow),'distant detailed people need no expensive shadow pass');
 crew[0].vessel.group.position.z=30;controller.update();assert.ok(crew[0].people.every(p=>p.mesh.castShadow));
 controller.setEnabled(false);assert.ok(replacements.every(item=>!item.active&&item.originals.every(({o,visible})=>o.visible===visible)));
});

test('reflection simplification restores the main view and exact Standard geometry through repeated toggles',()=>{
 const {human,crew,replacements,controller,contact,hiddenFine}=detailFixture();
 for(const record of crew)record.vessel.group.position.set(0,0,35);
 replacements[0].detail.parent.position.z=35;replacements[1].detail.parent.position.z=65;
 for(let cycle=0;cycle<40;cycle++){
  controller.setEnabled(true);controller.beginReflection();controller.beginReflection();
  assert.equal(human.holder.visible,true,'the nearby boatman silhouette stays detailed');
  assert.equal(contact.visible,false);assert.equal(hiddenFine.visible,false);
  for(const record of crew){assert.equal(record.active,true);assert.equal(record.group.visible,false);for(const swap of record.swaps)assert.equal(swap.mesh.geometry,swap.standard);}
  assert.ok(replacements.every(item=>item.active&&!item.detail.visible&&item.originals[0].o.visible));
  // A thrown reflection render is followed by the caller's finally hook.
  try{throw new Error('synthetic reflection failure');}catch{}finally{controller.endReflection();}
  controller.endReflection();assert.equal(contact.visible,true);assert.equal(hiddenFine.visible,false);
  for(const record of crew){assert.equal(record.group.visible,true);for(const swap of record.swaps)assert.equal(swap.mesh.geometry,swap.high);}
  assert.ok(replacements.every(item=>item.detail.visible&&!item.originals[0].o.visible));
  controller.beginReflection();controller.setEnabled(false);controller.endReflection();
  assert.equal(human.holder.visible,false);assert.equal(human.originals[0].o.visible,true);
  for(const record of crew){assert.equal(record.active,false);assert.equal(record.group.visible,false);for(const swap of record.swaps)assert.equal(swap.mesh.geometry,swap.standard);}
  controller.beginReflection();controller.endReflection();assert.equal(contact.visible,true);
 }
});

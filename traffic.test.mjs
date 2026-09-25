import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficState,stepTraffic,createTraffic} from './dist/traffic.js';
import {center,width} from './dist/channel.js';
import * as T from './dist/vendor/three.module.js';

test('traffic follows both lanes and stays in the channel for a long journey',()=>{
 const vessels=createTrafficState(),player={x:0,z:0,heading:0,speed:0};
 const start=vessels.map(v=>v.z);
 for(let i=0;i<36000;i++){stepTraffic(vessels,1/30,player,i/30);for(const v of vessels){assert.ok(Number.isFinite(v.heading));assert.ok(Math.abs(v.x-center(v.z))<width(v.z)-4);assert.ok(v.speed>=0&&v.speed<=v.cruise+.001);}}
 assert.equal(vessels.length,4);assert.equal(vessels.filter(v=>v.kind==='police').length,1);assert.ok(vessels.some((v,i)=>Math.abs(v.z-start[i])>50));
});

test('approaching traffic yields and passes a stopped player in its lane',()=>{
 const vessels=createTrafficState().slice(0,1),v=vessels[0];
 v.z=-55;v.x=center(-55)-9;
 const player={x:center(0)-9,z:0,heading:Math.PI,speed:0};
 let minDistance=Infinity;
 for(let i=0;i<6000;i++){stepTraffic(vessels,1/60,player,i/60);minDistance=Math.min(minDistance,Math.hypot(v.x-player.x,v.z-player.z));}
 assert.ok(minDistance>5.8,`minimum separation ${minDistance}`);assert.ok(v.z>10,'boat eventually passes instead of remaining stuck');
});

test('a boat yields to a broadside player and keeps a safe hull gap',()=>{
 const vessels=createTrafficState().slice(0,1),v=vessels[0];v.z=-50;v.x=center(-50)-9;
 const player={x:-9,z:0,heading:Math.PI/2,speed:0};
 for(let i=0;i<7000;i++){stepTraffic(vessels,1/60,player,i/60);const xGap=Math.abs(v.x-player.x),zGap=Math.abs(v.z-player.z);assert.ok(xGap>9.2||zGap>7.1,`overlap at ${xGap}, ${zGap}`);}
 assert.ok(v.z>8);
});

test('traffic is stable across 30 Hz and 60 Hz updates',()=>{
 const a=createTrafficState(),b=createTrafficState(),player={x:-9,z:0,heading:Math.PI,speed:0};
 for(let i=0;i<30*70;i++)stepTraffic(a,1/30,player,i/30);
 for(let i=0;i<60*70;i++)stepTraffic(b,1/60,player,i/60);
 for(let i=0;i<a.length;i++){assert.ok(Math.hypot(a[i].x-b[i].x,a[i].z-b[i].z)<.75);}
});

function renderedTraffic(t){
 const prior=globalThis.document;
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({fillRect(){},fillText(){}})})};
 let traffic;try{traffic=createTraffic(new T.Scene());}finally{globalThis.document=prior;}
 t.after(()=>{
  const geometries=new Set(),materials=new Set(),textures=new Set();
  for(const v of traffic.vessels)v.group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material){for(const material of Array.isArray(object.material)?object.material:[object.material])materials.add(material);}});
  for(const material of materials){if(material.map)textures.add(material.map);material.dispose();}for(const geometry of geometries)geometry.dispose();for(const texture of textures)texture.dispose();
 });
 return traffic;
}
const navigationSnapshot=traffic=>JSON.stringify(traffic.vessels.map(({group,...navigation})=>navigation));

test('High ambient boats settle onto the sampled plane at every heading without changing navigation or passenger placement',t=>{
 const traffic=renderedTraffic(t),headings=[0,Math.PI/2,Math.PI,-Math.PI/2];
 const plane=(x,z)=>.13+.014*(x-20)-.021*(z+450);
 for(const [i,v] of traffic.vessels.entries()){v.x=20+i*12;v.z=-450+i*17;v.heading=headings[i];}
 const navigation=navigationSnapshot(traffic),passengers=traffic.vessels.map(v=>{
  const passenger=new T.Group();passenger.position.set(.6,.69,-2.3);passenger.rotation.y=.3;v.group.add(passenger);return passenger;
 });
 for(let frame=0;frame<240;frame++){
  const time=frame/60;
  traffic.update(time,0,null); // Standard writes a fresh pose before every High override.
  const children=traffic.vessels.flatMap(v=>v.group.children.map(object=>({object,position:object.position.clone(),quaternion:object.quaternion.clone(),scale:object.scale.clone()})));
  traffic.followSurface(time,1/60,plane);
  for(const saved of children){assert.ok(saved.object.position.equals(saved.position));assert.ok(saved.object.quaternion.equals(saved.quaternion));assert.ok(saved.object.scale.equals(saved.scale));}
 }
 assert.equal(navigationSnapshot(traffic),navigation);
 for(const [i,v] of traffic.vessels.entries()){
  const g=v.group;g.updateMatrixWorld(true);assert.equal(g.rotation.order,'XYZ');assert.equal(g.position.x,v.x);assert.equal(g.position.z,v.z);assert.equal(g.position.y,plane(v.x,v.z));
  const bow=new T.Vector3(0,0,-1).applyQuaternion(g.quaternion),heading=Math.atan2(-bow.x,-bow.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(heading-v.heading),Math.cos(heading-v.heading)))<1e-12,'the projected bow keeps its actual navigation heading');
  for(const local of [[0,0,-v.length*.4],[0,0,v.length*.4],[v.width*.42,0,0],[-v.width*.42,0,0]]){
   const contact=g.localToWorld(new T.Vector3(...local));assert.ok(Math.abs(contact.y-plane(contact.x,contact.z))<1e-6,'fore/aft and port/starboard contact points share the actual water plane');
  }
  const localAgain=g.worldToLocal(passengers[i].getWorldPosition(new T.Vector3()));assert.ok(localAgain.distanceTo(new T.Vector3(.6,.69,-2.3))<1e-12,'the passenger remains fixed relative to the launch');
 }
});

test('High pitch and roll damp over time independently of Standard rewrites and frame rate',t=>{
 const a=renderedTraffic(t),b=renderedTraffic(t),plane=(x,z)=>.04*x-.06*z;
 const targetNormal=new T.Vector3(-.04,1,.06).normalize();
 a.update(0,0,null);a.followSurface(0,1/60,plane);
 const firstUp=new T.Vector3(0,1,0).applyQuaternion(a.vessels[0].group.quaternion),targetAngle=new T.Vector3(0,1,0).angleTo(targetNormal);
 assert.ok(firstUp.angleTo(new T.Vector3(0,1,0))>0&&firstUp.angleTo(new T.Vector3(0,1,0))<targetAngle*.15,'a first frame approaches the plane smoothly');
 const frozen=a.vessels.map(v=>v.group.quaternion.clone());a.update(0,0,null);a.followSurface(0,0,plane);
 a.vessels.forEach((v,i)=>assert.ok(v.group.quaternion.angleTo(frozen[i])<1e-7,'paused damping must preserve the previous High orientation'));
 // Restart these independent High streams after a gap, then give both three
 // seconds of exactly the same stationary surface at two update frequencies.
 for(let frame=0;frame<90;frame++){const time=10+frame/30;a.update(time,0,null);a.followSurface(time,1/30,plane);}
 for(let frame=0;frame<180;frame++){const time=10+frame/60;b.update(time,0,null);b.followSurface(time,1/60,plane);}
 for(let i=0;i<a.vessels.length;i++){
  assert.ok(a.vessels[i].group.quaternion.angleTo(b.vessels[i].group.quaternion)<1e-7);
  assert.ok(new T.Vector3(0,1,0).applyQuaternion(a.vessels[i].group.quaternion).angleTo(targetNormal)<1e-6);
 }
});

test('the next Standard update restores the original bob and rotation exactly after following High water',t=>{
 const traffic=renderedTraffic(t),time=7.25;
 traffic.update(time,0,null);
 const navigation=navigationSnapshot(traffic),original=traffic.vessels.map(v=>({position:v.group.position.clone(),rotation:v.group.rotation.clone(),quaternion:v.group.quaternion.clone()}));
 traffic.followSurface(time,.1,(x,z)=>.7+.025*x-.012*z);
 assert.ok(traffic.vessels.some((v,i)=>Math.abs(v.group.position.y-original[i].position.y)>.3));
 traffic.update(time,0,null);
 for(const [i,v] of traffic.vessels.entries()){
  assert.ok(v.group.position.equals(original[i].position));assert.ok(v.group.rotation.equals(original[i].rotation));assert.ok(v.group.quaternion.equals(original[i].quaternion));
 }
 assert.equal(navigationSnapshot(traffic),navigation);
});

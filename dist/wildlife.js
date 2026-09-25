import * as T from 'three';
import {mesh,bar} from './world.js';
import {center,width} from './channel.js';
const V=(x,y,z)=>new T.Vector3(x,y,z);
export function createWildlife(scene){
 const hide=new T.MeshStandardMaterial({color:0x4a4b35,roughness:.93}),ridge=new T.MeshStandardMaterial({color:0x343b2b,roughness:.96}),belly=new T.MeshStandardMaterial({color:0x898264,roughness:.93}),eye=new T.MeshStandardMaterial({color:0x9a923e,roughness:.25}),black=new T.MeshStandardMaterial({color:0x101611});
 function crocodile(){
  const g=new T.Group();
  mesh(new T.SphereGeometry(1,16,10),hide,g,0,.27,.1).scale.set(.53,.28,1.45);
  mesh(new T.SphereGeometry(1,12,8),belly,g,0,.14,-.1).scale.set(.46,.15,1.35);
  mesh(new T.SphereGeometry(1,12,8),hide,g,0,.22,-1.37).scale.set(.4,.2,.55);
  mesh(new T.SphereGeometry(1,12,7),hide,g,0,.15,-2.02).scale.set(.27,.13,.63);
  mesh(new T.SphereGeometry(1,12,7),belly,g,0,.075,-2.07).scale.set(.27,.055,.6);
  for(const s of [-1,1]){
   mesh(new T.SphereGeometry(.13,8,6),hide,g,s*.26,.39,-1.47);
   mesh(new T.SphereGeometry(.055,8,6),eye,g,s*.295,.425,-1.54);
   mesh(new T.SphereGeometry(.026,6,4),black,g,s*.31,.433,-1.578).scale.set(.45,1,1);
   mesh(new T.SphereGeometry(.032,6,4),black,g,s*.13,.245,-2.48);
   for(const z of [-.72,.87]){bar(V(s*.32,.2,z),V(s*.72,.12,z+.13),.11,hide,g,.13);bar(V(s*.72,.12,z+.13),V(s*.67,.045,z+.45),.08,hide,g,.06);for(let j=0;j<3;j++)bar(V(s*.67,.045,z+.42),V(s*(.62+j*.075),.035,z+.66),.025,belly,g,.015);}
  }
  // Armoured scutes in four uneven rows, visible above the surface when swimming.
  for(let j=0;j<13;j++)for(let i=0;i<4;i++){const z=-1.05+j*.18,x=(i-1.5)*.18,y=.44+Math.sqrt(Math.max(0,1-(x/.58)**2))*.1;const scale=mesh(new T.BoxGeometry(.14,.065,.14),ridge,g,x,y,z);scale.rotation.y=.2;}
  const tail=new T.Group();tail.position.set(0,.21,1.18);g.add(tail);const joints=[];let parent=tail;
  for(let i=0;i<6;i++){const joint=new T.Group();joint.position.z=i? .42:0;parent.add(joint);const r=.31*(1-i/6)+.025;mesh(new T.SphereGeometry(1,8,6),hide,joint,0,0,.24).scale.set(r,r*.62,.4);for(const s of [-1,1])mesh(new T.ConeGeometry(.07*(1-i/7),.13*(1-i/7),4),ridge,joint,s*r*.5,r*.52,.22);joints.push(joint);parent=joint;}
  return {group:g,joints};
 }
 const animals=[];
 for(const [z,side,scale] of [[-44,-1,1.15],[-96,1,.9],[-270,-1,1.2],[-550,1,1.05],[-760,-1,1]]){
  const c=crocodile();c.group.position.set(center(z)+side*(width(z)+3.2),.2,z);c.group.rotation.y=side*1.02;c.group.scale.setScalar(scale);c.swims=false;scene.add(c.group);animals.push(c);
 }
 for(const [z,side] of [[-32,1],[-190,-1],[-480,1]]){const c=crocodile();c.group.scale.setScalar(1.08);c.baseZ=z;c.side=side;c.swims=true;c.phase=Math.abs(z)*.1;scene.add(c.group);animals.push(c);}
 let nextRipple=0;
 return {animals,update(t,boat,water){let nearest=Infinity,swimming=false;
  for(const c of animals){if(c.swims){const z=c.baseZ+Math.sin(t*.021+c.phase)*22;const x=center(z)+c.side*(width(z)-8)+Math.sin(t*.047+c.phase)*2.5;c.group.position.set(x,-.3+Math.sin(t*1.1+c.phase)*.015,z);c.group.rotation.y=Math.cos(t*.021+c.phase)>0?Math.PI:0;c.group.rotation.y+=Math.sin(t*.047+c.phase)*.12;c.joints.forEach((j,i)=>j.rotation.y=Math.sin(t*1.7+c.phase-i*.58)*.11);if(t>nextRipple)water.ripple(x,z,t,.24);}const d=Math.hypot(c.group.position.x-boat.x,c.group.position.z-boat.z);if(d<nearest){nearest=d;swimming=c.swims;}}
  if(t>nextRipple)nextRipple=t+1.9;
  return {near:nearest<48,distance:nearest,swimming};
 }};
}

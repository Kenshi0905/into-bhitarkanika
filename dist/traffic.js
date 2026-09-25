import * as T from './vendor/three.module.js';
import {center,width} from './channel.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const ease=(from,to,rate,dt)=>from+(to-from)*(1-Math.exp(-rate*dt));
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const channelSlope=z=>(center(z+1)-center(z-1))*.5;
const laneX=(z,direction)=>center(z)-direction*9;
const routeHeading=(z,direction)=>Math.atan2(-channelSlope(z)*direction,-direction);
const NORTH_END=-1320,SOUTH_END=430;

// Route data is separate from rendering so yielding and bank clearance can be tested.
export function createTrafficState(){
 return [
  {kind:'excursion',direction:1,z:-92,cruise:1.65,variant:0},
  {kind:'excursion',direction:-1,z:-225,cruise:1.9,variant:1},
  {kind:'excursion',direction:-1,z:-690,cruise:1.5,variant:2},
  {kind:'police',direction:1,z:-485,cruise:2.6,variant:3},
 ].map((v,i)=>({...v,x:laneX(v.z,v.direction),heading:routeHeading(v.z,v.direction),speed:v.cruise,length:v.kind==='police'?10.6:10,width:3.4,dodge:0,dodgeUntil:-1,phase:i*1.71}));
}

export function stepTraffic(vessels,dt,player,time=0){
 dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
 if(!dt)return;
 // Every vessel reads the same snapshot; the order of the fleet never changes right of way.
 const obstacles=vessels.map(v=>({x:v.x,z:v.z,heading:v.heading,speed:v.speed,length:v.length,width:v.width,source:v}));
 if(player&&Number.isFinite(player.x)&&Number.isFinite(player.z))obstacles.push({...player,length:15,width:4.3,source:null});
 for(const v of vessels){
  let targetX=laneX(v.z,v.direction),targetSpeed=v.cruise;
  const channelMin=center(v.z)-width(v.z)+4.7,channelMax=center(v.z)+width(v.z)-4.7;
  for(const o of obstacles){
   if(o.source===v)continue;
   const ahead=(o.z-v.z)*v.direction,distance=Math.hypot(o.x-v.x,o.z-v.z);
   if(distance>82||ahead<-(v.length+o.length)*.55)continue;
   const oHeading=o.heading||0,oSpeed=o.speed||0;
   // Oriented hull extents account for a player stopped sideways across the creek.
   const halfX=Math.abs(Math.sin(oHeading))*o.length*.5+Math.abs(Math.cos(oHeading))*o.width*.5;
   const halfZ=Math.abs(Math.cos(oHeading))*o.length*.5+Math.abs(Math.sin(oHeading))*o.width*.5;
   const clearanceX=halfX+v.width*.5+2.2,clearanceZ=halfZ+v.length*.5+2.2;
   const prediction=clamp(ahead/(v.cruise+Math.max(.1,Math.cos(oHeading)*v.direction*oSpeed)),0,8);
   const otherX=o.x-Math.sin(oHeading)*oSpeed*prediction;
   const lateral=Math.abs(v.x-o.x);
   const predictedLateral=Math.abs(targetX-otherX);
   if((predictedLateral<clearanceX+2||lateral<clearanceX)&&ahead<64){
    if(time>v.dodgeUntil){
     // Prefer our own outside lane, but choose the opposite gap if the bank blocks it.
     const preferred=Math.sign(v.x-o.x)||-v.direction;
     const rightSpace=channelMax-(o.x+clearanceX),leftSpace=(o.x-clearanceX)-channelMin;
     v.dodge=preferred>0?(rightSpace>0?1:-1):(leftSpace>0?-1:1);
    }
    v.dodgeUntil=time+7;
    targetX=clamp(o.x+v.dodge*(clearanceX+1.2),channelMin,channelMax);
    if(lateral<clearanceX+.5){
     const brakingDistance=Math.max(0,ahead-clearanceZ);
     targetSpeed=Math.min(targetSpeed,v.cruise*clamp(brakingDistance/24,0,1));
    }
   }
  }
  const oldX=v.x,oldZ=v.z;
  const speedRate=targetSpeed<v.speed?2.3:.38;
  v.speed=ease(v.speed,targetSpeed,speedRate,dt);
  const nominalZ=v.z+v.direction*v.speed*dt/Math.sqrt(1+channelSlope(v.z)**2);
  const shiftedTarget=targetX+center(nominalZ)-center(v.z);
  let nextX=v.x+clamp((shiftedTarget-v.x)*.5,-1.05,1.05)*dt;
  let nextZ=nominalZ;
  // A yielding launch holds short instead of crossing a stopped player's long hull.
  for(const o of obstacles){
   if(o.source===v)continue;
   const h=o.heading||0;
   const clearX=Math.abs(Math.sin(h))*o.length*.5+Math.abs(Math.cos(h))*o.width*.5+v.width*.5+1;
   const clearZ=Math.abs(Math.cos(h))*o.length*.5+Math.abs(Math.sin(h))*o.width*.5+v.length*.5+1;
   const before=(o.z-v.z)*v.direction,after=(o.z-nextZ)*v.direction;
   if(before>0&&Math.abs(nextX-o.x)<clearX&&after<clearZ){nextZ=v.z;v.speed=0;}
  }
  v.z=nextZ;
  v.x=clamp(nextX,center(v.z)-width(v.z)+4.7,center(v.z)+width(v.z)-4.7);
  // Curvature-aligned heading plus a gentle avoidance turn; a stopped boat keeps its bow forward.
  const lateralVelocity=(v.x-oldX)/dt,forwardVelocity=(v.z-oldZ)/dt;
  const route=routeHeading(v.z,v.direction);
  const motion=Math.abs(forwardVelocity)>.25?Math.atan2(-lateralVelocity,-forwardVelocity):route;
  const goal=route+clamp(angleDelta(route,motion),-.43,.43);
  v.heading+=angleDelta(v.heading,goal)*(1-Math.exp(-dt*1.1));
  if(v.z<NORTH_END||v.z>SOUTH_END){
   const resetZ=v.direction===1?NORTH_END+8:SOUTH_END-8;
   // Endpoint recycling is well outside the playable bounds and never near the player.
   if(!player||Math.abs(resetZ-player.z)>180){v.z=resetZ;v.x=laneX(resetZ,v.direction);v.heading=routeHeading(resetZ,v.direction);v.dodgeUntil=-1;}
   else {v.direction*=-1;v.heading=routeHeading(v.z,v.direction);}
  }
 }
}

function mergeParts(parts){
 const count=parts.reduce((sum,g)=>sum+(g.index?g.index.count:g.attributes.position.count),0);
 const positions=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2);
 let offset=0;
 for(const part of parts){const g=part.index?part.toNonIndexed():part;positions.set(g.attributes.position.array,offset*3);normals.set(g.attributes.normal.array,offset*3);if(g.attributes.uv)uvs.set(g.attributes.uv.array,offset*2);offset+=g.attributes.position.count;if(g!==part)g.dispose();part.dispose();}
 const merged=new T.BufferGeometry();merged.setAttribute('position',new T.BufferAttribute(positions,3));merged.setAttribute('normal',new T.BufferAttribute(normals,3));merged.setAttribute('uv',new T.BufferAttribute(uvs,2));merged.computeBoundingSphere();return merged;
}

function createBuilder(group){
 const buckets=new Map(),up=new T.Vector3(0,1,0);
 function add(geometry,material,x=0,y=0,z=0,rx=0,ry=0,rz=0){geometry.rotateX(rx);geometry.rotateY(ry);geometry.rotateZ(rz);geometry.translate(x,y,z);if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(geometry);}
 function box(w,h,d,material,x,y,z,rx=0,ry=0,rz=0){add(new T.BoxGeometry(w,h,d),material,x,y,z,rx,ry,rz);}
 function bar(a,b,r,material){const delta=new T.Vector3(...b).sub(new T.Vector3(...a));const geometry=new T.CylinderGeometry(r,r,delta.length(),6);geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(up,delta.normalize()));add(geometry,material,(a[0]+b[0])*.5,(a[1]+b[1])*.5,(a[2]+b[2])*.5);}
 function finish(){for(const [material,geometries] of buckets){const m=new T.Mesh(mergeParts(geometries),material);m.castShadow=true;m.receiveShadow=true;group.add(m);}}
 return {add,box,bar,finish};
}

function hullGeometry(length,beam){
 const positions=[],uv=[],indices=[],rings=28,sides=14;
 const hullWidth=t=>beam*.5*(.02+Math.pow(Math.sin(Math.PI*t*.91),.58));
 for(let i=0;i<=rings;i++){const t=i/rings,z=(t-.5)*length,w=hullWidth(t);for(let j=0;j<=sides;j++){const a=j/sides*Math.PI;positions.push(-Math.cos(a)*w,.65-Math.sin(a)*1.4+Math.pow(1-t,8)*.38,z);uv.push(j/sides,t);}}
 for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}
 const hull=new T.BufferGeometry();hull.setAttribute('position',new T.Float32BufferAttribute(positions,3));hull.setAttribute('uv',new T.Float32BufferAttribute(uv,2));hull.setIndex(indices);hull.computeVertexNormals();
 const outline=new T.Shape();for(let i=0;i<=rings;i++){const t=i/rings,x=hullWidth(t)*.95,z=(t-.5)*length;if(i===0)outline.moveTo(x,z);else outline.lineTo(x,z);}for(let i=rings;i>=0;i--){const t=i/rings;outline.lineTo(-hullWidth(t)*.95,(t-.5)*length);}outline.closePath();const deck=new T.ShapeGeometry(outline);deck.rotateX(-Math.PI/2);deck.rotateY(Math.PI);deck.translate(0,.68,0);deck.computeVertexNormals();
 return {hull,deck,hullWidth};
}

function curvedRoof(length,beam){
 const p=[],uv=[],indices=[],n=14;
 for(let z=0;z<=1;z++)for(let i=0;i<=n;i++){const x=(i/n-.5)*beam;p.push(x,2.85+.34*Math.cos(x/beam*Math.PI),(z-.5)*length+.2);uv.push(i/n,z);}
 for(let i=0;i<n;i++)indices.push(i,i+1,i+n+1,i+1,i+n+2,i+n+1);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}

function labelTexture(){
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#e3e6dd';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#183f58';ctx.font='bold 80px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('POLICE',256,68);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=4;return t;
}

function buildVessel(v,shared){
 const group=new T.Group();group.name=v.kind==='police'?'Ambient police patrol':'Local excursion launch';
 const b=createBuilder(group),police=v.kind==='police';
 const colors=[0x667f72,0x436772,0x9b6748];
 const paint=new T.MeshStandardMaterial({color:police?0xdce2d8:colors[v.variant],roughness:.62,side:T.DoubleSide});
 const trim=police?shared.navy:shared.cream,roof=police?shared.cream:shared.canvas;
 const {hull,deck,hullWidth}=hullGeometry(v.length,v.width);
 b.add(hull,paint);b.add(deck,shared.wood);
 for(const side of [-1,1]){
  for(let i=0;i<28;i++){const a=i/28,z0=(a-.5)*v.length,c=(i+1)/28,z1=(c-.5)*v.length;b.bar([side*hullWidth(a),.73+Math.pow(1-a,8)*.38,z0],[side*hullWidth(c),.73+Math.pow(1-c,8)*.38,z1],.055,trim);}
  for(const z of [-2.5,2.5])b.add(new T.TorusGeometry(.25,.07,6,12),shared.rubber,side*1.67,.40,z,0,Math.PI/2);
  b.box(.38,.15,4.8,shared.wood,side*1.05,.97,.7);
  b.bar([side*1.48,.7,-2.8],[side*1.48,1.25,-2.8],.035,trim);b.bar([side*1.48,.7,3],[side*1.48,1.25,3],.035,trim);b.bar([side*1.48,1.25,-2.8],[side*1.48,1.25,3],.032,trim);
 }
 if(police){
  b.box(2.95,1.35,3.7,shared.cream,0,1.4,-.5);
  b.box(2.63,.65,.025,shared.glass,0,1.8,-2.365);
  b.box(3.24,.13,4.12,shared.cream,0,2.14,-.5);
  for(const side of [-1,1]){
   b.box(.025,.57,1.12,shared.glass,side*1.49,1.79,-1.52);
   b.box(.025,.57,1.06,shared.glass,side*1.49,1.79,-.2);
   b.box(.03,.22,3.6,shared.navy,side*1.49,1.25,-.5);
   b.box(.03,.38,.7,shared.wood,side*1.49,1.78,1.00);
  }
  b.bar([0,2.15,.4],[0,3.1,.4],.035,shared.navy);
  b.box(.7,.11,.27,shared.navy,0,2.27,-.8);
  const lamp=new T.Mesh(new T.CylinderGeometry(.15,.17,.22,10),new T.MeshStandardMaterial({color:0x5788b5,emissive:0x3c6491,emissiveIntensity:.3,roughness:.3}));lamp.position.set(0,2.42,-.8);group.add(lamp);group.userData.lamp=lamp;
  const labelMat=new T.MeshStandardMaterial({map:shared.label,roughness:.8});for(const side of [-1,1]){const label=new T.Mesh(new T.PlaneGeometry(2.2,.55),labelMat);label.position.set(side*1.514,1.30,-.5);label.rotation.y=side*Math.PI/2;group.add(label);}
 }else{
  b.add(curvedRoof(6.6,3.62),roof);
  for(const side of [-1,1])for(const z of [-2.7,.2,3.1])b.bar([side*1.45,.7,z],[side*1.65,2.87,z],.034,shared.wood);
  for(const side of [-1,1])b.box(.04,.17,6.6,roof,side*1.79,2.82,.2);
  b.box(.65,.7,.40,paint,0,1.05,-3.2);
  b.add(new T.TorusGeometry(.22,.025,5,16),shared.rubber,0,1.58,-2.98,-.3);
 }
 // Fenders, life ring, cleats and passengers give a readable scale at river distance.
 b.add(new T.TorusGeometry(.30,.09,7,18),shared.orange,1.73,police?.98:1.8,2.1,0,Math.PI/2);
 for(const z of [-4.25,4]){b.bar([-.16,.87,z],[.16,.87,z],.045,trim);b.bar([0,.7,z],[0,.87,z],.035,trim);}
 function person(x,z,seated,uniform=false){const base=.69;const shirt=uniform?shared.khaki:shared.shirts[v.variant%3];b.add(new T.CapsuleGeometry(.16,.31,3,6),shirt,x,base+(seated?.8:1.1),z);b.add(new T.SphereGeometry(.145,8,6),shared.skin,x,base+(seated?1.22:1.53),z);for(const side of [-1,1])b.bar([x+side*.10,base+(seated?.7:.85),z],[x+side*.1,base+(seated?.3:.1),z-.07],.065,shared.navy);b.add(new T.CylinderGeometry(.23,.23,.05,10),uniform?shared.khaki:shared.cream,x,base+(seated?1.37:1.68),z);}
 if(police){person(-.65,2.3,false,true);person(.65,2.6,true,true);}else{person(.62,-3.05,false);person(-1,1.35,true);person(1,.1,true);if(v.variant===0)person(-1,-.6,true);}
 b.finish();
 const motor=new T.Group();motor.position.set(0,.25,v.length*.5-.12);group.add(motor);const cover=new T.Mesh(new T.BoxGeometry(.66,.6,.55),shared.rubber);cover.position.y=.35;motor.add(cover);const shaft=new T.Mesh(new T.BoxGeometry(.13,.85,.14),shared.navy);shaft.position.y=-.18;motor.add(shaft);group.userData.motor=motor;
 return group;
}

export function createTraffic(scene){
 const material=(color,roughness=.83)=>new T.MeshStandardMaterial({color,roughness});
 const shared={wood:material(0x755239),cream:material(0xe3dfc8),canvas:material(0xcac3a0,.95),navy:material(0x254c5e,.64),rubber:material(0x202724),orange:material(0xcb7046),skin:material(0x966347),khaki:material(0xaaa182),shirts:[material(0xc9c4ac),material(0xa4b6b4),material(0xb5ac91)],glass:new T.MeshStandardMaterial({color:0x355966,metalness:.15,roughness:.2}),label:labelTexture()};
 shared.canvas.side=T.DoubleSide;
 const vessels=createTrafficState();
 for(const v of vessels){v.group=buildVessel(v,shared);v.group.position.set(v.x,0,v.z);v.group.rotation.y=v.heading;scene.add(v.group);}
 return {vessels,update(t,dt,player){
  stepTraffic(vessels,dt,player,t);
  for(const v of vessels){const g=v.group;g.position.set(v.x,.045*Math.sin(t*1.25+v.z*.14)+.02*Math.sin(t*1.7+v.x*.3),v.z);g.rotation.set(.010*Math.sin(t*1.45+v.phase),v.heading,.013*Math.sin(t*1.3+v.phase));g.userData.motor.rotation.y=Math.sin(t*1.4+v.phase)*.055;g.userData.motor.rotation.z=Math.sin(t*21+v.phase)*.009*v.speed;if(g.userData.lamp)g.userData.lamp.material.emissiveIntensity=.20+Math.pow(Math.max(0,Math.sin(t*.7)),12)*.65;}
 }};
}

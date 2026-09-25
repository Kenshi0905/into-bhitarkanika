import * as T from 'three';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// This module and its CC0 human mesh are requested only after selecting High.
// Detailed animals replace the existing meshes locally, preserving their routes,
// species, water interactions, and the inexpensive Standard representation.
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const asset=name=>new URL(`./assets/high/fauna/${name}`,import.meta.url).href;
const nextPaint=()=>new Promise(resolve=>setTimeout(resolve,0));
let seed=37119;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

function surface(kind,size=512){
 const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');
 if(kind==='scales'){
  x.fillStyle='#3c4431';x.fillRect(0,0,size,size);
  for(let row=-1;row<25;row++)for(let col=-1;col<20;col++){
   const px=(col+(row%2)*.5)*28,py=row*23,shade=75+Math.floor(random()*42);
   x.fillStyle=`rgb(${shade},${shade+5},${shade*.72})`;x.beginPath();
   x.roundRect(px+1,py+1,26,21,5);x.fill();x.strokeStyle='rgba(24,28,18,.65)';x.lineWidth=1.4;x.stroke();
   x.strokeStyle='rgba(190,182,130,.30)';x.beginPath();x.moveTo(px+6,py+5);x.lineTo(px+21,py+5);x.stroke();
   for(let j=0;j<5;j++){x.fillStyle='rgba(25,30,20,.20)';x.fillRect(px+4+random()*17,py+4+random()*13,1,1);}
  }
 }else if(kind==='feather'){
  x.clearRect(0,0,size,size);const grad=x.createLinearGradient(0,0,size,0);grad.addColorStop(0,'#858585');grad.addColorStop(.49,'#f7f7f7');grad.addColorStop(.54,'#c1c1c1');grad.addColorStop(1,'#aaaaaa');
  x.fillStyle=grad;x.beginPath();x.moveTo(size*.50,0);x.bezierCurveTo(size*.1,size*.22,size*.03,size*.76,size*.46,size);x.bezierCurveTo(size*.9,size*.76,size*.91,size*.22,size*.50,0);x.fill();
  x.globalCompositeOperation='source-atop';x.strokeStyle='rgba(20,20,20,.23)';x.lineWidth=1;
  for(let y=20;y<size;y+=5){x.beginPath();x.moveTo(size*.5,y);x.lineTo(size*.10,y-45);x.moveTo(size*.5,y);x.lineTo(size*.90,y-45);x.stroke();}
  x.strokeStyle='rgba(250,250,250,.6)';x.lineWidth=2;x.beginPath();x.moveTo(size*.5,9);x.lineTo(size*.5,size);x.stroke();
 }else{
  x.fillStyle='#bcbcb7';x.fillRect(0,0,size,size);
  for(let i=0;i<size;i+=3){x.fillStyle=i%2?'#9b9c98':'#d8d8d0';x.fillRect(i,0,1,size);x.fillStyle='rgba(60,60,50,.12)';x.fillRect(0,i,size,1);}
 }
 const texture=new T.CanvasTexture(c);texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;return texture;
}
function tint(geometry,color){
 const g=geometry.index?geometry.toNonIndexed():geometry.clone(),c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);
 for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}
 g.setAttribute('color',new T.BufferAttribute(a,3));return g;
}
function ellipse(parts,color,p,s){const g=new T.SphereGeometry(1,24,14);g.scale(...s);g.translate(...p);parts.push(tint(g,color));g.dispose();}
function link(parts,color,a,b,r=.02,r2=r){const av=V(...a),bv=V(...b),d=bv.clone().sub(av);const g=new T.CylinderGeometry(r2,r,d.length(),9);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());parts.push(tint(g,color));g.dispose();}
function merge(parts,material,parent,name){if(!parts.length)return null;const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometry.computeBoundingSphere();const m=new T.Mesh(geometry,material);m.name=name;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function feather(length,width,color,position,rotation=0,camber=.016){
 const p=[],uv=[],ix=[],rows=10;
 for(let i=0;i<=rows;i++){const t=i/rows,w=width*Math.pow(Math.sin(Math.PI*t),.65);for(let j=0;j<3;j++){const s=j-1;p.push(s*w,Math.sin(t*Math.PI)*camber+(1-Math.abs(s))*camber,t*length);uv.push(j/2,1-t);}}
 for(let i=0;i<rows;i++)for(let j=0;j<2;j++){const a=i*3+j;ix.push(a,a+3,a+1,a+1,a+3,a+4);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();g.rotateY(rotation);g.translate(...position);const result=tint(g,color);g.dispose();return result;
}
function birdTemplate(species,flight,materials){
 const group=new T.Group(),plume=[],bare=[],feathers=[],white=0xefeee4,dark=0x1d2728;
 const egret=species==='little-egret',kite=species==='brahminy-kite',common=species==='common-kingfisher',capped=species==='black-capped-kingfisher';
 let wingY,wingZ,span,wingColor,bodyColor;
 if(egret){
  bodyColor=white;ellipse(plume,white,[0,.70,.10],[.225,.27,.46]);
  const neck=(flight?[[0,.86,-.18],[0,1.02,-.36],[0,1.18,-.24],[0,1.3,-.43]]:[[0,.81,-.15],[0,1.06,-.31],[0,1.32,-.17],[0,1.53,-.34]]).map(p=>V(...p));
  const g=new T.TubeGeometry(new T.CatmullRomCurve3(neck),32,.052,10,false);plume.push(tint(g,white));g.dispose();const h=neck.at(-1);
  ellipse(plume,white,h.toArray(),[.085,.108,.156]);link(bare,0x343c37,[0,h.y-.012,h.z-.09],[0,h.y-.027,h.z-.40],.028,.001);
  for(const s of [-1,1]){
   ellipse(bare,0xc6bd57,[s*.079,h.y+.02,h.z-.074],[.018,.020,.018]);ellipse(bare,0x111a18,[s*.091,h.y+.021,h.z-.079],[.006,.011,.01]);
   if(flight){link(bare,0x353c31,[s*.10,.59,.23],[s*.1,.49,.94],.014,.01);for(let toe=-1;toe<=1;toe++)link(bare,0xb4aa3c,[s*.1,.49,.94],[s*.1+toe*.05,.47,1.09],.011,.004);}
   else{link(bare,0x343e31,[s*.09,.62,.07],[s*.11,.32,.027],.019,.014);ellipse(bare,0x343e31,[s*.11,.32,.027],[.02,.026,.025]);link(bare,0x343e31,[s*.11,.32,.027],[s*.11,.035,.05],.013,.01);for(let toe=-1;toe<=1;toe++)link(bare,0xbbaf3e,[s*.11,.035,.05],[s*.11+toe*.065,.016,-.12],.011,.003);link(bare,0xbbaf3e,[s*.11,.035,.05],[s*.13,.016,.15],.01,.003);}
   // Fine nape plumes and a loose breast mantle are visible in the close LOD.
   feathers.push(feather(.24,.016,white,[s*.026,h.y+.07,h.z+.08],s*.15,.035));
  }
  wingY=.84;wingZ=.025;span=.91;wingColor=white;
 }else if(kite){
  bodyColor=0x9c5936;ellipse(plume,bodyColor,[0,0,.04],[.195,.165,.36]);ellipse(plume,white,[0,.08,-.30],[.127,.13,.225]);
  ellipse(plume,white,[0,.12,-.46],[.105,.105,.132]);link(bare,0x736a4c,[0,.08,-.5],[0,.055,-.63],.035,.01);link(bare,0x383b31,[0,.055,-.63],[0,.018,-.61],.011,.004);
  for(const s of [-1,1]){ellipse(bare,0x4e3930,[s*.092,.14,-.49],[.021,.024,.022]);ellipse(bare,dark,[s*.106,.14,-.501],[.009,.014,.015]);link(bare,0xc2a157,[s*.07,-.1,.08],[s*.09,-.21,.22],.026,.017);for(let toe=-1;toe<=1;toe++)link(bare,0x403c2e,[s*.09,-.21,.22],[s*.09+toe*.026,-.23,.29],.011,.004);}
  wingY=.035;wingZ=0;span=1.10;wingColor=0x9d623d;
 }else{
  bodyColor=common?0x168f9d:capped?0x306cb9:0x168ea7;const head=common?0x258b8f:capped?0x15222a:0x76472e;
  ellipse(plume,bodyColor,[0,.225,.06],[.157,.191,.285]);ellipse(plume,common?0xd49449:capped?0xcab492:white,[0,.215,-.13],[.119,.17,.145]);
  ellipse(plume,head,[0,.437,-.143],[.163,.145,.179]);
  if(capped)ellipse(plume,white,[0,.315,-.136],[.161,.057,.14]);
  for(const s of [-1,1]){
   if(common){ellipse(plume,0xf0ded0,[s*.139,.401,-.081],[.028,.032,.065]);ellipse(plume,0xe2a264,[s*.148,.425,-.118],[.023,.03,.055]);}
   ellipse(bare,0x151d1b,[s*.152,.472,-.185],[.021,.024,.025]);ellipse(bare,0xdddace,[s*.166,.48,-.192],[.006,.006,.007]);
   link(bare,0xa55336,[s*.065,.1,.075],[s*.065,.015,.0],.019,.012);for(let toe=-1;toe<=1;toe++)link(bare,0xac623f,[s*.065,.015,.0],[s*.065+toe*.028,.0,-.07],.009,.003);
   for(let dot=0;dot<8;dot++)ellipse(plume,common?0x93cdc1:bodyColor,[s*(.075+(dot%3)*.023),.546-(dot%3)*.015,-.145+Math.floor(dot/3)*.044],[.009,.006,.014]);
  }
  // Upper and lower mandibles form a long tapered, flattened dagger bill.
  const billColor=common?0x293830:0xc35938;link(bare,billColor,[0,.425,-.27],[0,.415,common?-.59:-.64],.038,.0015);link(bare,common?0x313c2d:0x893c2b,[0,.397,-.28],[0,.410,common?-.584:-.632],.023,.001);
  wingY=.29;wingZ=.07;span=common?.39:.50;wingColor=bodyColor;
 }
 const tailStart=egret?[0,.68,.31]:kite?[0,-.015,.25]:[0,.17,.21];
 for(let i=0;i<7;i++)feathers.push(feather(egret?.36:kite?.46:.31,egret?.035:kite?.047:.02,bodyColor,[tailStart[0]+(i-3)*.022,tailStart[1]+Math.sin(i)*.003,tailStart[2]],(i-3)*.052));
 const wings=[];
 for(const side of [-1,1]){
  const wing=new T.Group();wing.name=side<0?'wing-left':'wing-right';wing.position.set(0,wingY,wingZ);wing.scale.x=side;group.add(wing);wings.push(wing);const f=[];
  if(flight){
   // Individually curved primary feathers fan out at the wingtip; secondaries overlap.
   for(let i=0;i<11;i++){const u=i/10;f.push(feather((egret?.36:kite?.44:.22)*(1-.22*u),span*.070,kite?(i>6?0x382f26:wingColor):wingColor,[span*(.20+.65*u),.008,u*.06],-Math.PI*.10-u*.44,.018));}
   for(let i=0;i<9;i++){const u=i/8;f.push(feather(span*(.43-.19*u),span*.063,kite?0x3c3228:wingColor,[span*(.73+.24*u),.002,.03+u*.025],-Math.PI*(.40-.16*u),.014));}
   for(let row=0;row<3;row++)for(let i=0;i<10;i++){const u=i/10;f.push(feather(span*.22,span*.062,new T.Color(wingColor).multiplyScalar(1+(row-1)*.045),[span*(.07+.77*u),.022+row*.008,-.10+row*.06],-.10-u*.25,.014));}
  }else{
   wing.position.set(side*(egret?.14:.092),wingY-(egret?.17:.045),wingZ-.07);wing.rotation.y=side*.13;wing.rotation.z=side*(egret?.3:.17);
   for(let i=0;i<12;i++){const u=i/11;f.push(feather(egret?.50:.35,egret?.030:.020,wingColor,[u*(egret?.085:.04),-.01+Math.sin(u*Math.PI)*.02,u*.008],.08+u*.23,.025));}
   for(let i=0;i<8;i++)f.push(feather(egret?.29:.19,egret?.039:.024,new T.Color(wingColor).multiplyScalar(1.06),[i*.008,.025,-.01],.05+i*.025,.025));
  }
  merge(f,materials.feathers,wing,'Layered wing feathers');
 }
 for(let i=0;i<12;i++)feathers.push(feather(egret?.19:.13,egret?.023:.014,bodyColor,[(i%3-1)*.06,egret?.91:.38,(egret?.13:.08)+Math.floor(i/3)*.05],(i%3-1)*.18,.023));
 merge(plume,materials.plumage,group,'Sculpted plumage');merge(bare,materials.bare,group,'Bill, eyes and articulated feet');merge(feathers,materials.feathers,group,'Tail and contour feathers');
 return group;
}

function loft(rings,sides=28){
 const p=[],uv=[],ix=[];
 rings.forEach(([z,w,h,cy],r)=>{for(let s=0;s<=sides;s++){const a=s/sides*Math.PI*2;p.push(Math.cos(a)*w,Math.sin(a)*h+cy,z);uv.push(s/sides*2,r/(rings.length-1)*4);}});
 for(let r=0;r<rings.length-1;r++)for(let s=0;s<sides;s++){const a=r*(sides+1)+s,b=a+sides+1;ix.push(a,a+1,b,b,a+1,b+1);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return g;
}
function crocodileTemplate(materials){
 const group=new T.Group(),bodyParts=[],bare=[],armour=[];const skin=0xffffff;
 bodyParts.push(tint(loft([[-1.62,.23,.16,.23],[-1.3,.37,.2,.25],[-.9,.45,.23,.25],[-.4,.56,.29,.25],[.2,.57,.28,.24],[.7,.47,.25,.24],[1.18,.34,.19,.22],[1.47,.24,.16,.22]]),skin));
 bodyParts.push(tint(loft([[-2.68,.09,.055,.17],[-2.60,.19,.07,.17],[-2.37,.235,.08,.19],[-2.05,.265,.095,.21],[-1.77,.32,.12,.24],[-1.52,.38,.175,.25],[-1.28,.35,.15,.26]]),skin));
 const jaw=new T.Group();jaw.name='lower-jaw';jaw.position.set(0,.105,-1.29);group.add(jaw);const jawParts=[];
 jawParts.push(tint(loft([[-1.34,.08,.025,0],[-1.23,.18,.037,0],[-.92,.23,.038,.008],[-.50,.29,.045,.02],[0,.33,.055,.045]]),0x96967b));merge(jawParts,materials.hide,jaw,'Lower mandible');
 for(const s of [-1,1]){
  ellipse(bodyParts,skin,[s*.258,.39,-1.54],[.125,.1,.19]);ellipse(bare,0x938a38,[s*.302,.42,-1.60],[.055,.043,.046]);ellipse(bare,0x0e1815,[s*.329,.428,-1.619],[.012,.033,.019]);ellipse(bare,0xcfca93,[s*.337,.438,-1.627],[.006,.007,.006]);
  ellipse(bodyParts,0xd6d1aa,[s*.13,.225,-2.51],[.061,.035,.065]);ellipse(bare,0x1b211a,[s*.129,.251,-2.525],[.026,.014,.029]);
  for(let i=0;i<17;i++){const z=-2.48+i*.063,x=s*(.18+(z+2.48)*.125);const tooth=new T.ConeGeometry(i%3===0?.016:.010,i%3===0?.069:.043,7);tooth.rotateX(Math.PI);tooth.translate(x,.107,z);bare.push(tint(tooth,0xc9c4a0));tooth.dispose();}
  for(const z of [-.77,.80]){
   const hip=[s*.37,.23,z],elbow=[s*.73,.13,z+.11],ankle=[s*.77,.064,z+.47];
   link(bodyParts,skin,hip,elbow,.105,.13);ellipse(bodyParts,skin,elbow,[.13,.10,.13]);link(bodyParts,skin,elbow,ankle,.08,.055);ellipse(bodyParts,skin,ankle,[.14,.047,.17]);
   for(let toe=0;toe<4;toe++){const tip=[s*(.68+toe*.065),.046,z+.71+(toe===1?.025:0)];link(bodyParts,0xcac3a0,ankle,tip,.027,.012);link(bare,0x494c37,tip,[tip[0],.025,tip[2]+.07],.013,.001);}
  }
 }
 for(let row=0;row<16;row++)for(let col=0;col<6;col++){
  const z=-1.09+row*.149,x=(col-2.5)*.147,bodyWidth=.54-Math.abs(z-.15)*.07;
  if(Math.abs(x)>bodyWidth)continue;
  const y=.25+.28*Math.sqrt(Math.max(0,1-(x/bodyWidth)**2));const g=new T.ConeGeometry(.075,.064+(col===2||col===3?.035:0),4);g.rotateY(Math.PI/4);g.scale(1,.75,1.18);g.translate(x,y,z);armour.push(tint(g,0x66704f));g.dispose();
 }
 // Neck shields have the small paired ridges characteristic of crocodilians.
 for(const s of [-1,1])for(let i=0;i<5;i++){const g=new T.ConeGeometry(.058,.08,4);g.scale(1,.7,1.7);g.translate(s*.15,.42,-1.5+i*.15);armour.push(tint(g,0x697451));g.dispose();}
 merge([...bodyParts,...armour],materials.hide,group,'Scaled body and limbs');merge(bare,materials.bare,group,'Eyes, nostrils, teeth and claws');
 const root=new T.Group();root.position.set(0,.21,1.18);group.add(root);let parent=root;
 for(let i=0;i<6;i++){
  const joint=new T.Group();joint.name=`tail-${i}`;joint.position.z=i?.42:0;parent.add(joint);const r=.31*(1-i/6)+.025,parts=[],ridges=[];
  parts.push(tint(loft([[-.07,r,r*.58,0],[.16,r*.94,r*.63,0],[.42,r*.68,r*.48,0],[.49,r*.56,r*.41,0]],20),skin));
  for(let j=0;j<3;j++)for(const s of i<3?[-1,1]:[0]){const g=new T.ConeGeometry(.056*(1-i*.11),.15*(1-i*.1),4);g.scale(.8,1,1.6);g.translate(s*r*.51,r*.56,.04+j*.14);ridges.push(tint(g,0x586145));g.dispose();}
  merge([...parts,...ridges],materials.hide,joint,'Articulated scale plates');parent=joint;
 }
 return group;
}

// Pose in anatomical joint space. Targets are in model coordinates so the same
// relaxed stance works after the character is placed on a moving vessel.
function aimJoint(mesh,named,boneName,tipName,target){
 const bone=named[boneName],tip=named[tipName];if(!bone||!tip)return;
 mesh.updateWorldMatrix(true,true);
 const start=bone.getWorldPosition(V()),current=tip.getWorldPosition(V()).sub(start),goal=mesh.localToWorld(V(...target)).sub(start);
 const parentRotation=bone.parent.getWorldQuaternion(new T.Quaternion()).invert();current.applyQuaternion(parentRotation).normalize();goal.applyQuaternion(parentRotation).normalize();
 bone.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(current,goal));
 mesh.updateWorldMatrix(true,true);
}
function jointPosition(mesh,named,name){mesh.updateWorldMatrix(true,true);return mesh.worldToLocal(named[name].getWorldPosition(V()));}
export function poseHuman(mesh,named,seated=false){
 // Reset cloned skeletons to the authored bind pose before applying a new pose.
 for(const bone of Object.values(named))bone.quaternion.identity();
 for(const side of ['L','R']){
  const sign=side==='L'?1:-1;
  const shoulder=jointPosition(mesh,named,`upperarm01.${side}`),elbow=jointPosition(mesh,named,`lowerarm01.${side}`),wrist=jointPosition(mesh,named,`wrist.${side}`);
  const upperLength=shoulder.distanceTo(elbow),lowerLength=elbow.distanceTo(wrist);
  const elbowTarget=V(sign*(seated?.24:.225),shoulder.y-upperLength*.98,seated?.15:.025);
  aimJoint(mesh,named,`upperarm01.${side}`,`lowerarm01.${side}`,elbowTarget.toArray());
  const posedElbow=jointPosition(mesh,named,`lowerarm01.${side}`);
  const wristTarget=V(sign*(seated?.17:.24),posedElbow.y-lowerLength*(seated?.44:.98),seated?.31:.055);
  aimJoint(mesh,named,`lowerarm01.${side}`,`wrist.${side}`,wristTarget.toArray());
  const posedWrist=jointPosition(mesh,named,`wrist.${side}`);
  aimJoint(mesh,named,`wrist.${side}`,`finger3-1.${side}`,[posedWrist.x,posedWrist.y-.095,posedWrist.z+(seated?.055:.015)]);
  const hip=jointPosition(mesh,named,`upperleg01.${side}`),knee=jointPosition(mesh,named,`lowerleg01.${side}`),foot=jointPosition(mesh,named,`foot.${side}`);
  const thigh=hip.distanceTo(knee),shin=knee.distanceTo(foot);
  aimJoint(mesh,named,`upperleg01.${side}`,`lowerleg01.${side}`,[sign*.12,seated?hip.y-.035:hip.y-thigh,seated?hip.z+thigh:hip.z+.012]);
  const posedKnee=jointPosition(mesh,named,`lowerleg01.${side}`);
  aimJoint(mesh,named,`lowerleg01.${side}`,`foot.${side}`,[sign*.12,posedKnee.y-shin,posedKnee.z+(seated?-.035:-.02)]);
  const posedFoot=jointPosition(mesh,named,`foot.${side}`);
  aimJoint(mesh,named,`foot.${side}`,`toe2-1.${side}`,[posedFoot.x,posedFoot.y-.058,posedFoot.z+.155]);
 }
 mesh.updateWorldMatrix(true,true);mesh.updateMatrixWorld(true);mesh.skeleton.update();
}
export function posedContact(mesh,indices){
 mesh.updateWorldMatrix(true,true);mesh.updateMatrixWorld(true);mesh.skeleton.update();let min=Infinity,max=-Infinity;const p=V();
 for(const i of indices){p.fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,p);min=Math.min(min,p.y);max=Math.max(max,p.y);}
 return {min,max};
}
export function fitHumanToDeck(mesh,holder,contacts,deckY,seatY=null){
 const feet=posedContact(mesh,contacts.feet),scale=holder.scale.y;
 if(seatY===null)holder.position.y=deckY-feet.min*scale;
 else{
  const named=Object.fromEntries(mesh.skeleton.bones.map(b=>[b.name,b]));
  // Low river-launch benches require a raised knee and a relaxed forward shin,
  // not a ninety-degree pose whose feet cut through the deck.
  for(let iteration=0;iteration<4;iteration++){
   holder.position.y=seatY-posedContact(mesh,contacts.seat).min*scale;
   for(const side of ['L','R']){
    const hip=jointPosition(mesh,named,`upperleg01.${side}`),knee=jointPosition(mesh,named,`lowerleg01.${side}`),foot=jointPosition(mesh,named,`foot.${side}`);
    const l1=hip.distanceTo(knee),l2=knee.distanceTo(foot),bottom=posedContact(mesh,contacts[side==='L'?'leftFoot':'rightFoot']).min;
    const target=V(hip.x,foot.y+(deckY-holder.position.y)/scale-bottom,hip.z+.41);
    const dy=target.y-hip.y,dz=target.z-hip.z,d=Math.hypot(dy,dz),a=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-a*a));
    const kneeTarget=V(hip.x,hip.y+dy/d*a+dz/d*height,hip.z+dz/d*a-dy/d*height);
    aimJoint(mesh,named,`upperleg01.${side}`,`lowerleg01.${side}`,kneeTarget.toArray());
    aimJoint(mesh,named,`lowerleg01.${side}`,`foot.${side}`,target.toArray());
    const posedFoot=jointPosition(mesh,named,`foot.${side}`);
    aimJoint(mesh,named,`foot.${side}`,`toe2-1.${side}`,[posedFoot.x,posedFoot.y-.058,posedFoot.z+.155]);
   }
  }
  holder.position.y=seatY-posedContact(mesh,contacts.seat).min*scale;
 }
 mesh.updateWorldMatrix(true,true);mesh.updateMatrixWorld(true);mesh.skeleton.update();mesh.computeBoundingSphere();mesh.boundingSphere.radius*=1.18;mesh.frustumCulled=true;
}

function prepareClothingAlbedo(map){
 // The outfit's diffuse contains baked dark studio lighting. Lift that lighting
 // once in albedo space, retaining the authored seams/folds and real scene shadows.
 const image=map.image,canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d');context.drawImage(image,0,0);const pixels=context.getImageData(0,0,canvas.width,canvas.height);
 for(let i=0;i<pixels.data.length;i+=4)for(let c=0;c<3;c++)pixels.data[i+c]=Math.round(255*(.04+.90*Math.pow(pixels.data[i+c]/255,.48)));
 context.putImageData(pixels,0,0);map.image=canvas;map.needsUpdate=true;
}

function addFootContacts(mesh,holder,contacts,deckY){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const context=canvas.getContext('2d');
 const gradient=context.createRadialGradient(32,32,5,32,32,32);gradient.addColorStop(0,'rgba(255,255,255,.25)');gradient.addColorStop(.50,'rgba(255,255,255,.17)');gradient.addColorStop(1,'rgba(255,255,255,0)');
 context.fillStyle=gradient;context.fillRect(0,0,64,64);const texture=new T.CanvasTexture(canvas);
 const material=new T.MeshBasicMaterial({color:0x112018,map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 mesh.updateMatrixWorld(true);mesh.skeleton.update();
 for(const foot of ['leftFoot','rightFoot']){
  const bounds=new T.Box3(),point=V();for(const i of contacts[foot]){point.fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,point);bounds.expandByPoint(point);}
  const center=bounds.getCenter(V()),size=bounds.getSize(V());
  const patch=new T.Mesh(new T.PlaneGeometry(size.x*1.45,size.z*1.18),material);patch.name='Soft sandal contact';patch.userData.skipHighReflection=true;patch.rotation.x=-Math.PI/2;
  patch.position.set(center.x,(deckY+.002-holder.position.y)/holder.scale.y,center.z);holder.add(patch);
 }
 return texture;
}

export function createRowingRig(mesh,named,holder,craft,spec){
 const rest=new Map(mesh.skeleton.bones.map(b=>[b,b.quaternion.clone()]));
 const bind=Object.fromEntries(spec.bones.map(b=>[b.name,V(...b.position)]));
 const arms=['L','R'].map((side,index)=>{
  const wrist=named[`wrist.${side}`],forward=bind[`finger3-1.${side}`].clone().sub(bind[`wrist.${side}`]);
  const width=bind[`finger2-1.${side}`].clone().sub(bind[`finger5-1.${side}`]).normalize();forward.addScaledVector(width,-forward.dot(width)).normalize();
  const normal=width.clone().cross(forward).normalize(),frame=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(width,forward,normal));
  const grip=new T.Object3D();grip.name=`Rowing palm contact ${side}`;wrist.add(grip);
  // The marker describes the same anatomical palm point while idle, too. Leaving
  // it at the wrist until the first stroke reports a spurious 79 mm contact jump.
  const radius=craft.rowingVisual?.pose?.gripRadii?.[index]||.026;
  grip.position.copy(forward).multiplyScalar(.062).addScaledVector(normal,-(side==='L'?1:-1)*(radius+.014));
  const tips={};for(let finger=1;finger<=5;finger++){
   const last=named[`finger${finger}-3.${side}`];if(!last)continue;
   const tip=new T.Object3D();tip.name=`Finger contact ${side}${finger}`;tip.position.copy(bind[last.name]).sub(bind[`finger${finger}-2.${side}`]).normalize().multiplyScalar(finger===1?.017:.016);last.add(tip);tips[finger]=tip;
  }
  return {side,index,sign:side==='L'?1:-1,grip,tips,width,forward,normal,frameInverse:frame.invert(),
   upper:bind[`upperarm01.${side}`].distanceTo(bind[`lowerarm01.${side}`]),lower:bind[`lowerarm01.${side}`].distanceTo(bind[`wrist.${side}`])};
 });
 const inverseMesh=new T.Matrix4(),inverseMeshRotation=new T.Quaternion(),contacts=[V(),V()];let lastTime=0;
 const bonePoint=bone=>{bone.updateWorldMatrix(true,false);return V().setFromMatrixPosition(bone.matrixWorld).applyMatrix4(inverseMesh);};
 function aim(bone,tip,target){
  const origin=bonePoint(bone),current=bonePoint(tip).sub(origin).normalize(),goal=target.clone().sub(origin).normalize();
  const parentRotation=bone.parent.getWorldQuaternion(new T.Quaternion()).premultiply(inverseMeshRotation).invert();
  current.applyQuaternion(parentRotation);goal.applyQuaternion(parentRotation);bone.quaternion.premultiply(new T.Quaternion().setFromUnitVectors(current,goal));bone.updateMatrixWorld(true);
 }
 function apply(t){
  lastTime=t;const pose=craft.rowingVisual?.pose,blend=T.MathUtils.clamp(pose?.blend||0,0,1);
  for(const [bone,q] of rest)bone.quaternion.copy(q);
  named.head.rotation.y=Math.sin(t*.23)*.065*(1-blend);named.neck01.rotation.x=Math.sin(t*.36)*.012*(1-blend);named.spine02.rotation.x=Math.sin(t*1.3)*.004;
  if(blend<=.0001){if(pose)pose.highHandError=null;mesh.updateMatrixWorld(true);return;}
  const lean=pose.torsoLean||0,twist=pose.torsoTwist||0;
  // A slight bend at the lower back keeps the parked far hand reachable during
  // one-sided strokes and a rolling hull; knees and soles remain planted.
  const farHand=Math.max(pose.hands?.[0]?.z||0,pose.hands?.[1]?.z||0);
  named.spine05.rotation.x+=T.MathUtils.smoothstep(farHand,.27,.48)*.065;
  named.spine03.rotation.x+=lean*.42;named.spine02.rotation.x+=lean*.36;named.spine01.rotation.x+=lean*.22;
  named.spine02.rotation.y+=twist*.65;named.spine01.rotation.y+=twist*.35;
  named.neck01.rotation.x-=lean*.25;named.head.rotation.x=.035;
  mesh.updateWorldMatrix(true,true);mesh.updateMatrixWorld(true);inverseMesh.copy(mesh.matrixWorld).invert();mesh.getWorldQuaternion(inverseMeshRotation).invert();
  for(const arm of arms){
   const {side,index,sign}=arm;if(!pose.hands?.[index])continue;
   const handle=pose.hands[index].clone().sub(holder.position).divide(holder.scale);
   const radius=pose.gripRadii?.[index]||.026;
   const shaft=(pose.gripDirections?.[index]||V(sign,-.3,0)).clone().normalize();
   const width=shaft.clone().negate(),forward=V(0,0,1).addScaledVector(width,-width.z).normalize();
   const normal=width.clone().cross(forward).normalize(),up=normal.clone().multiplyScalar(sign);
   const target=handle.clone().addScaledVector(forward,-.062).addScaledVector(up,radius+.014);
   const shoulder=named[`upperarm01.${side}`],elbow=named[`lowerarm01.${side}`],wrist=named[`wrist.${side}`];
   // The shoulder girdle follows a forward reach. Rotating the real clavicle
   // advances the shoulder naturally without changing the arm's bone lengths.
   const reach=T.MathUtils.smoothstep(handle.z,.16,.50),protraction=reach*.54;
   named[`clavicle.${side}`].rotation.y=-sign*protraction;
   // A raised handle subtly raises its shoulder; recovery lowers it again.
   const elevation=T.MathUtils.smoothstep(handle.y,1.10,1.36)*.035;
   named[`clavicle.${side}`].rotation.z=sign*(elevation-protraction*.23);
   named[`clavicle.${side}`].updateMatrixWorld(true);
   const origin=bonePoint(shoulder),direction=target.clone().sub(origin),actualDistance=direction.length(),d=Math.max(.035,Math.min(actualDistance,arm.upper+arm.lower-.002));direction.normalize();
   const along=(arm.upper*arm.upper-arm.lower*arm.lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,arm.upper*arm.upper-along*along));
   // Let the elbow open on the reach, then tuck alongside the torso on the pull.
   // Only the bend plane changes: bone lengths and the shaft targets stay exact.
   const pole=V(sign*(.70+.30*reach),.025+.055*reach,-.42+.12*reach);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
   const elbowTarget=origin.clone().addScaledVector(direction,along).addScaledVector(pole,height);
   aim(shoulder,elbow,elbowTarget);aim(elbow,wrist,target);
   const targetFrame=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(width,forward,normal));
   const desired=targetFrame.multiply(arm.frameInverse),parentRotation=wrist.parent.getWorldQuaternion(new T.Quaternion()).premultiply(inverseMeshRotation).invert();
   wrist.quaternion.copy(parentRotation.multiply(desired));wrist.updateMatrixWorld(true);
   // A marker through the palm's anatomical frame follows the actual shaft;
   // fingers curl over that shaft instead of rotating a mitten around the wrist.
   arm.grip.position.copy(arm.forward).multiplyScalar(.062).addScaledVector(arm.normal,-sign*(radius+.014));
   for(let finger=2;finger<=5;finger++){
    const mcp=named[`finger${finger}-1.${side}`],pip=named[`finger${finger}-2.${side}`],dip=named[`finger${finger}-3.${side}`];
    const base=bonePoint(mcp),axial=base.clone().sub(handle).dot(width),axisCenter=handle.clone().addScaledVector(width,axial),radial=base.clone().sub(axisCenter);
    let angle=Math.atan2(radial.dot(up),radial.dot(forward));const r=radius+.011;
    for(const [bone,tip,arc] of [[mcp,pip,.57],[pip,dip,.60],[dip,arm.tips[finger],.45]]){
     angle-=arc;const point=axisCenter.clone().addScaledVector(forward,Math.cos(angle)*r).addScaledVector(up,Math.sin(angle)*r);aim(bone,tip,point);
    }
   }
   const thumb=named[`finger1-1.${side}`],thumb2=named[`finger1-2.${side}`],thumb3=named[`finger1-3.${side}`];
   const thumbSide=handle.clone().addScaledVector(width,.040).addScaledVector(forward,-radius*.65).addScaledVector(up,radius*.75);
   aim(thumb,thumb2,thumbSide);aim(thumb2,thumb3,handle.clone().addScaledVector(width,.031).addScaledVector(up,-radius*.28));
   aim(thumb3,arm.tips[1],handle.clone().addScaledVector(width,.018).addScaledVector(forward,radius*.4).addScaledVector(up,-radius*.6));
  }
  // The mode transition blends from the saved relaxed pose. Its phase and hand
  // targets always come from the shared physical stroke, including a quality switch.
  if(blend<.9999){const targetRotation=new T.Quaternion();for(const [bone,q] of rest){targetRotation.copy(bone.quaternion);bone.quaternion.copy(q).slerp(targetRotation,blend);}}
  mesh.updateMatrixWorld(true);mesh.skeleton.update();
  pose.highHandError=0;
  for(const arm of arms){const contact=bonePoint(arm.grip).multiply(holder.scale).add(holder.position);pose.highHandError=Math.max(pose.highHandError,contact.distanceTo(pose.hands[arm.index]));}
 }
 return {update:apply,getContacts(){
  mesh.updateWorldMatrix(true,true);mesh.updateMatrixWorld(true);inverseMesh.copy(mesh.matrixWorld).invert();
  for(const arm of arms)contacts[arm.index].copy(bonePoint(arm.grip)).multiply(holder.scale).add(holder.position);
  return contacts.map(v=>v.clone());
 },get time(){return lastTime;}};
}

async function createBoatman(craft,materials,renderer){
 const loadedTextures=[];let createdGeometry=null,createdMesh=null,createdHolder=null;
 try{
 const loaded=await Promise.allSettled([fetch(asset('boatman.json')),fetch(asset('boatman.bin')),new T.TextureLoader().loadAsync(asset('boatman-skin.webp')),new T.TextureLoader().loadAsync(asset('boatman-clothes.webp')),new T.TextureLoader().loadAsync(asset('boatman-clothes-normal.webp'))]);
 if(loaded.some(r=>r.status==='rejected')){for(const resource of loaded.slice(2))if(resource.status==='fulfilled')resource.value.dispose();throw new Error('The detailed boatman could not load.');}
 const [response,binary,skinMap,clothesMap,clothesNormal]=loaded.map(r=>r.value);
 if(!response.ok||!binary.ok){skinMap.dispose();clothesMap.dispose();clothesNormal.dispose();throw new Error('The detailed boatman could not load.');}
 loadedTextures.push(skinMap,clothesMap,clothesNormal);
 const spec=await response.json(),buffer=await binary.arrayBuffer();skinMap.colorSpace=T.SRGBColorSpace;skinMap.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());clothesMap.colorSpace=T.SRGBColorSpace;prepareClothingAlbedo(clothesMap);clothesMap.anisotropy=clothesNormal.anisotropy=skinMap.anisotropy;
 const geometry=createdGeometry=new T.BufferGeometry();for(const [name,a] of Object.entries(spec.attributes)){
  const Typed=a.type==='f'?Float32Array:a.type==='H'?Uint16Array:Uint32Array;const attribute=new T.BufferAttribute(new Typed(buffer,a.offset,a.length),a.itemSize);
  if(name==='index')geometry.setIndex(attribute);else geometry.setAttribute(name,attribute);
 }
 geometry.computeVertexNormals();for(const g of spec.groups)geometry.addGroup(g.start,g.count,g.materialIndex);
 const skin=new T.MeshPhysicalMaterial({color:0xeee4d8,map:skinMap,roughness:.77,metalness:0,clearcoat:0,specularIntensity:.3});
 const fabric=materials.fabric;const shirt=new T.MeshStandardMaterial({color:0xe8dbc0,map:clothesMap,normalMap:clothesNormal,normalScale:new T.Vector2(.42,.42),roughness:.94});
 const trousers=new T.MeshStandardMaterial({color:0x738477,map:clothesMap,normalMap:clothesNormal,normalScale:new T.Vector2(.40,.40),roughness:.92});const shoes=new T.MeshStandardMaterial({color:0x382d25,roughness:.91,side:T.DoubleSide});const hair=new T.MeshStandardMaterial({color:0x282721,roughness:.88});
 const mesh=createdMesh=new T.SkinnedMesh(geometry,[skin,shirt,trousers,shoes,hair]);mesh.name='MakeHuman sculpted and rigged boatman';mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 const bones=spec.bones.map(b=>{const bone=new T.Bone();bone.name=b.name;bone.position.fromArray(b.position);return bone;});
 spec.bones.forEach((b,i)=>{if(b.parent>=0){bones[i].position.sub(V(...spec.bones[b.parent].position));bones[b.parent].add(bones[i]);}else mesh.add(bones[i]);});
 mesh.updateMatrixWorld(true);mesh.bind(new T.Skeleton(bones));const named=Object.fromEntries(bones.map(b=>[b.name,b]));
 // The original mesh has anatomically authored weights; relaxed shoulder poses
 // and breathing animate through its skeleton, never by wobbling rigid parts.
 poseHuman(mesh,named);
 const holder=createdHolder=new T.Group();holder.name='High boatman';holder.add(mesh);holder.visible=false;craft.person.add(holder);
 const hat=new T.Group();hat.name='Sun hat';const hatMaterial=new T.MeshStandardMaterial({color:0xc4b693,map:fabric,roughness:.96});
 const brim=new T.Mesh(new T.CylinderGeometry(.225,.233,.014,48),hatMaterial),crown=new T.Mesh(new T.SphereGeometry(.155,32,18,0,Math.PI*2,0,Math.PI/2),hatMaterial);brim.position.y=.10;crown.position.y=.10;crown.scale.y=.55;hat.add(brim,crown);
 hat.position.set(0,.055,-.011);named.head.add(hat);hat.traverse(o=>{if(o.isMesh)o.castShadow=true;});
 // The basemesh eyelids are open; insert sclera and irises at authored eye joints.
 const eyeWhite=new T.MeshStandardMaterial({color:0xbeb8a4,roughness:.36}),eyeIris=new T.MeshStandardMaterial({color:0x30231a,roughness:.27});
 for(const suffix of ['L','R']){const bone=named[`eye.${suffix}`];if(!bone)continue;const eyeball=new T.Mesh(new T.SphereGeometry(.0118,16,12),eyeWhite);eyeball.userData.skipHighReflection=true;bone.add(eyeball);const iris=new T.Mesh(new T.SphereGeometry(.0052,12,8),eyeIris);iris.userData.skipHighReflection=true;iris.position.z=.0105;iris.scale.z=.4;bone.add(iris);}
 fitHumanToDeck(mesh,holder,spec.contacts,.73-craft.person.position.y);
 const contactTexture=addFootContacts(mesh,holder,spec.contacts,.73-craft.person.position.y);loadedTextures.push(contactTexture);
 const rowingRig=createRowingRig(mesh,named,holder,craft,spec);
 const originals=craft.person.children.filter(o=>o!==holder).map(o=>({o,visible:o.visible}));
 return {holder,originals,mesh,update(t){rowingRig.update(t);},rowingRig,materials:[skin,shirt,trousers,shoes,hair,hatMaterial,eyeWhite,eyeIris],texture:skinMap,textures:[skinMap,clothesMap,clothesNormal,contactTexture],contacts:spec.contacts};
 }catch(error){
  const geometries=new Set(createdGeometry?[createdGeometry]:[]),mats=new Set();
  createdMesh?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});
  createdHolder?.removeFromParent();geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());loadedTextures.forEach(t=>t.dispose());createdMesh?.skeleton?.dispose();throw error;
 }
}

function createTrafficPeople(traffic,human){
 const records=[];
 for(const vessel of traffic?.vessels||[]){
  const group=new T.Group();group.name='High traffic passengers';group.visible=false;
  const swaps=[];
  // Crew triangle ranges were recorded while Standard batches were assembled.
  // Only High allocates alternate index buffers; all boat details remain intact.
  for(const mesh of vessel.group.children){
   const ranges=mesh.userData.crewRanges;if(!ranges?.length)continue;
   const standard=mesh.geometry,high=standard.clone(),indices=[];let range=0;
   for(let i=0;i<standard.attributes.position.count;i++){
    while(range<ranges.length&&i>=ranges[range][0]+ranges[range][1])range++;
    if(range===ranges.length||i<ranges[range][0])indices.push(i);
   }
   high.setIndex(indices);swaps.push({mesh,standard,high});
  }
  const people=[];
  for(const [i,p] of (vessel.people||[]).entries()){
   const mesh=human.mesh.clone(true),bones=human.mesh.skeleton.bones.map(b=>mesh.getObjectByName(b.name));
   const skeleton=new T.Skeleton(bones,human.mesh.skeleton.boneInverses.map(m=>m.clone()));
   mesh.bind(skeleton,human.mesh.bindMatrix.clone());mesh.frustumCulled=true;
   mesh.material=[...human.mesh.material];mesh.material[1]=human.mesh.material[1].clone();mesh.material[1].color.set(p.uniform?0xa69b72:[0xc3b79d,0x839d99,0xa88e70][i%3]);
   const holder=new T.Group();holder.rotation.y=p.seated?(p.x<0?Math.PI/2:-Math.PI/2):Math.PI;holder.position.set(p.x,p.y,p.z);holder.scale.setScalar(i%2?.96:1);holder.add(mesh);group.add(holder);
   const named=Object.fromEntries(bones.map(b=>[b.name,b]));
   poseHuman(mesh,named,p.seated);
   if(p.uniform){const hat=mesh.getObjectByName('Sun hat');if(hat)hat.scale.set(.86,.5,.86);}
   fitHumanToDeck(mesh,holder,human.contacts,.69,p.seated?1.045:null);
   people.push({mesh,named,holder,seated:p.seated});
  }
  vessel.group.add(group);records.push({vessel,group,swaps,people,active:false});
 }
 return records;
}
function showTraffic(record,on){
 if(record.active===on)return;record.active=on;record.group.visible=on;
 for(const swap of record.swaps)swap.mesh.geometry=on?swap.high:swap.standard;
}

// Keep the same inexpensive silhouettes outside the useful range of the detailed
// models. Reflections use a shorter range, without changing any main-view state.
export function createFaunaDetailController({craft,human,replacements,crew}){
 const ranges={bird:52,croc:88,crew:46},reflectionRanges={bird:24,croc:56,crew:28};
 const shadowRanges={bird:24,croc:60,crew:38};
 const fine=[],shadowRecords=[];let enabled=false,reflectionRestore=null;
 const distanceSquared=object=>{const p=object.position,b=craft.boat.position;return (p.x-b.x)**2+(p.z-b.z)**2;};
 const addShadows=(root,kind,position)=>{
  const casters=[];root.traverse(o=>{if(o.isMesh&&o.castShadow)casters.push(o);});
  shadowRecords.push({kind,position,casters,casting:true});
 };
 for(const item of replacements)addShadows(item.detail,item.kind,item.detail.parent);
 for(const record of crew)addShadows(record.group,'crew',record.vessel.group);
 for(const root of [human.holder,...crew.map(record=>record.group)])root.traverse(o=>{if(o.userData.skipHighReflection)fine.push(o);});
 function show(item,on){if(item.active===on)return;item.active=on;item.detail.visible=on;for(const {o,visible} of item.originals)o.visible=on?false:visible;}
 function endReflection(){
  if(!reflectionRestore)return;
  for(let i=reflectionRestore.length-1;i>=0;i--){const [object,key,value]=reflectionRestore[i];object[key]=value;}
  reflectionRestore=null;
 }
 function update(){
  endReflection();if(!enabled)return;
  for(const item of replacements){const range=ranges[item.kind]+(item.active?10:0);show(item,distanceSquared(item.detail.parent)<range*range);}
  for(const record of crew){const range=ranges.crew+(record.active?10:0);showTraffic(record,distanceSquared(record.vessel.group)<range*range);}
  for(const record of shadowRecords){
   const range=shadowRanges[record.kind]+(record.casting?6:0),casting=distanceSquared(record.position)<range*range;
   if(casting===record.casting)continue;record.casting=casting;for(const mesh of record.casters)mesh.castShadow=casting;
  }
 }
 function beginReflection(){
  if(!enabled||reflectionRestore)return;reflectionRestore=[];
  const change=(object,key,value)=>{if(object[key]===value)return;reflectionRestore.push([object,key,object[key]]);object[key]=value;};
  for(const item of replacements){
   if(!item.active||distanceSquared(item.detail.parent)<reflectionRanges[item.kind]**2)continue;
   change(item.detail,'visible',false);for(const {o,visible} of item.originals)change(o,'visible',visible);
  }
  for(const record of crew){
   if(!record.active||distanceSquared(record.vessel.group)<reflectionRanges.crew**2)continue;
   change(record.group,'visible',false);for(const swap of record.swaps)change(swap.mesh,'geometry',swap.standard);
  }
  for(const object of fine)change(object,'visible',false);
 }
 function meshTriangles(mesh){const g=mesh.geometry;return g?(g.index?.count??g.attributes.position?.count??0)/3:0;}
 function groupTriangles(root){let count=0;root.traverseVisible(o=>{if(o.isMesh)count+=meshTriangles(o);});return count;}
 function getStats(){
  const activeCrew=crew.filter(record=>record.active),reflectedCrew=activeCrew.filter(record=>distanceSquared(record.vessel.group)<reflectionRanges.crew**2);
  let reflectionCrewTrianglesSaved=0;
  for(const record of activeCrew){
   if(reflectedCrew.includes(record))continue;
   // The fallback still draws the original batched people: subtract that cost.
   const fallback=record.swaps.reduce((sum,s)=>(sum+(s.standard.index?.count??s.standard.attributes.position.count)-(s.high.index?.count??s.high.attributes.position.count)),0)/3;
   reflectionCrewTrianglesSaved+=groupTriangles(record.group)-fallback;
  }
  return {enabled,detailedBirds:replacements.filter(i=>i.kind==='bird'&&i.active).length,detailedCrocodiles:replacements.filter(i=>i.kind==='croc'&&i.active).length,
   detailedPeople:enabled?1+activeCrew.reduce((n,r)=>n+r.people.length,0):0,
   reflectedDetailedPeople:enabled?1+reflectedCrew.reduce((n,r)=>n+r.people.length,0):0,
   skinnedTriangles:enabled?meshTriangles(human.mesh)+activeCrew.reduce((n,r)=>n+r.people.reduce((m,p)=>m+meshTriangles(p.mesh),0),0):0,
   reflectionCrewTrianglesSaved:Math.max(0,reflectionCrewTrianglesSaved),ranges:{...ranges},reflectionRanges:{...reflectionRanges}};
 }
 return {update,beginReflection,endReflection,getStats,
  setEnabled(value){
   endReflection();enabled=Boolean(value);human.holder.visible=enabled;for(const {o,visible} of human.originals)o.visible=enabled?false:visible;
   if(enabled)update();else{replacements.forEach(item=>show(item,false));crew.forEach(record=>showTraffic(record,false));}
  }
 };
}

export async function createHighFauna({scene,craft,birds,wildlife,traffic,renderer,onProgress=()=>{}}){
 seed=37119;onProgress('Preparing detailed wildlife');
 const scaleMap=surface('scales'),featherMap=surface('feather'),fabric=surface('fabric',256);scaleMap.anisotropy=8;fabric.repeat.set(7,7);
 const materials={
  feathers:new T.MeshStandardMaterial({map:featherMap,vertexColors:true,roughness:.84,side:T.DoubleSide,alphaTest:.45,alphaToCoverage:true}),
  plumage:new T.MeshStandardMaterial({vertexColors:true,roughness:.87}),
  bare:new T.MeshStandardMaterial({vertexColors:true,roughness:.52}),
  hide:new T.MeshStandardMaterial({map:scaleMap,bumpMap:scaleMap,bumpScale:.012,vertexColors:true,roughness:.84}),fabric
 };
 const replacements=[],ownedRoots=[],templates=new Map();let human=null,enabled=false,crew=[],lastUpdateTime=0;
 try{
  for(let i=0;i<birds.birds.length;i++){
   const bird=birds.birds[i],key=bird.species+bird.flight;
   if(!templates.has(key)){templates.set(key,birdTemplate(bird.species,bird.flight,materials));await nextPaint();}
   const detail=templates.get(key).clone(true);detail.name=`High ${bird.species}`;detail.visible=false;
   const originals=bird.mesh.children.map(o=>({o,visible:o.visible}));bird.mesh.add(detail);ownedRoots.push(detail);
   replacements.push({kind:'bird',source:bird,detail,originals,highWings:[detail.getObjectByName('wing-left'),detail.getObjectByName('wing-right')],active:false});
  }
  onProgress('Adding scales, feathers and movement');await nextPaint();
  const croc=crocodileTemplate(materials);templates.set('crocodile',croc);
  for(const animal of wildlife.animals){const detail=croc.clone(true);detail.name='High saltwater crocodile';detail.visible=false;const originals=animal.group.children.map(o=>({o,visible:o.visible}));animal.group.add(detail);ownedRoots.push(detail);replacements.push({kind:'croc',source:animal,detail,originals,tail:Array.from({length:6},(_,i)=>detail.getObjectByName(`tail-${i}`)),jaw:detail.getObjectByName('lower-jaw'),active:false});}
  onProgress('Loading the detailed boatman');await nextPaint();human=await createBoatman(craft,materials,renderer);ownedRoots.push(human.holder);
  crew=createTrafficPeople(traffic,human);crew.forEach(record=>ownedRoots.push(record.group));
  onProgress('Wildlife ready');
 }catch(error){
  const geometries=new Set(),failedMaterials=new Set(),failedTextures=new Set([scaleMap,featherMap,fabric]),skeletons=new Set();
  for(const root of [...ownedRoots,...templates.values()])root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.skeleton)skeletons.add(o.skeleton);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){failedMaterials.add(m);if(m.map)failedTextures.add(m.map);if(m.normalMap)failedTextures.add(m.normalMap);}});
  for(const root of ownedRoots)root.removeFromParent();for(const record of crew)record.swaps.forEach(s=>geometries.add(s.high));
  for(const m of Object.values(materials))if(m.isMaterial)failedMaterials.add(m);
  geometries.forEach(g=>g.dispose());failedMaterials.forEach(m=>m.dispose());failedTextures.forEach(t=>t.dispose());skeletons.forEach(s=>s.dispose());throw error;
 }
 const detailController=createFaunaDetailController({craft,human,replacements,crew});
 function update(t,dt){
  lastUpdateTime=t;
  if(!enabled)return;
  detailController.update();
  for(const item of replacements){
   const parent=item.detail.parent;if(!item.active)continue;
   if(item.kind==='bird'&&item.source.flight){item.highWings.forEach((wing,i)=>{wing.rotation.z=item.source.wings[i].rotation.z;});}
   if(item.kind==='croc'){item.tail.forEach((tail,i)=>tail.rotation.copy(item.source.joints[i].rotation));if(!item.source.swims)item.jaw.rotation.x=Math.max(0,Math.sin(t*.07+parent.position.z))*.035;}
  }
  human.update(t,dt);
  for(const record of crew){if(record.active)for(const [i,person] of record.people.entries()){person.named.head.rotation.y=Math.sin(t*.23+i*1.8)*.1;person.named.spine02.rotation.x=Math.sin(t*1.2+i)*.004;}}
 }
 return {
  setEnabled(value){enabled=Boolean(value);detailController.setEnabled(enabled);if(!enabled){if(craft.rowingVisual?.pose)craft.rowingVisual.pose.highHandError=null;}else update(lastUpdateTime,0);},
  update,
  beginReflection:detailController.beginReflection,endReflection:detailController.endReflection,getStats:detailController.getStats,
  dispose(){this.setEnabled(false);const geometries=new Set(),mats=new Set(),textures=new Set([scaleMap,featherMap,fabric,...human.textures]);for(const root of ownedRoots){root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])mats.add(m);});root.removeFromParent();}geometries.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());human.mesh.skeleton.dispose();for(const record of crew){record.swaps.forEach(s=>s.high.dispose());record.people.forEach(p=>p.mesh.skeleton.dispose());}},
 };
}

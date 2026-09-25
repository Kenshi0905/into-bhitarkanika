import * as T from 'three';
import {RowingPresentation,SCULLING} from './rowing-motion.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0);
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);};
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
function segment(material,parent,radius){return mesh(new T.CylinderGeometry(radius*.9,radius,1,8),material,parent);}
function placeSegment(object,a,b){object.position.copy(a).add(b).multiplyScalar(.5);const d=b.clone().sub(a);object.scale.y=d.length();object.quaternion.setFromUnitVectors(Y,d.normalize());}
function elbowPosition(shoulder,hand,side){
  const d=hand.clone().sub(shoulder),length=Math.max(.01,d.length()),a=.305,b=.295;
  d.divideScalar(length);const along=(a*a-b*b+Math.min(length,a+b-.001)**2)/(2*Math.min(length,a+b-.001));
  const pole=V(side,-.35,-.12).addScaledVector(d,-V(side,-.35,-.12).dot(d)).normalize();
  return shoulder.clone().addScaledVector(d,along).addScaledVector(pole,Math.sqrt(Math.max(.002,a*a-along*along)));
}

// The lightweight avatar keeps the original silhouette and colors, with real arm joints.
export function createStandardBoatman(person,{skin,shirt,trousers,cream}){
  const root=new T.Group();root.name='Standard articulated boatman';root.userData.rowingVisual=true;person.add(root);
  const upper=new T.Group();upper.position.y=.88;root.add(upper);
  mesh(new T.CapsuleGeometry(.22,.42,5,8),shirt,upper,0,.17,0);
  const head=new T.Group();upper.add(head);head.position.set(0,.73,0);
  mesh(new T.SphereGeometry(.18,10,8),skin,head);
  mesh(new T.CylinderGeometry(.33,.33,.045,16),cream,head,0,.16,0);
  mesh(new T.SphereGeometry(.23,12,8,0,Math.PI*2,0,Math.PI/2),cream,head,0,.16,0);
  const arms=[],legs=[];
  for(const sign of [1,-1]){
    const arm={sign,upper:segment(skin,root,.063),lower:segment(skin,root,.059),hand:mesh(new T.SphereGeometry(.066,8,6),skin,root)};arm.hand.scale.set(.72,1,1.13);arms.push(arm);
    const leg={sign,upper:segment(trousers,root,.085),lower:segment(trousers,root,.08),foot:mesh(new T.BoxGeometry(.16,.08,.27),trousers,root,sign*.13,-.02,.065)};legs.push(leg);
  }
  const idleHands=[V(.29,.84,-.18),V(-.29,.84,-.18)];
  return {root,update(time,pose){
    upper.rotation.x=pose.torsoLean;upper.rotation.z=pose.torsoTwist*.2;head.rotation.y=Math.sin(time*.23)*.04;
    upper.updateMatrix();
    for(let i=0;i<arms.length;i++){
      const arm=arms[i],shoulder=V(arm.sign*.22,.42,0).applyMatrix4(upper.matrix);
      const hand=idleHands[i].clone().lerp(pose.hands[i],pose.blend),elbow=elbowPosition(shoulder,hand,arm.sign);
      placeSegment(arm.upper,shoulder,elbow);placeSegment(arm.lower,elbow,hand);arm.hand.position.copy(hand);
      arm.hand.quaternion.setFromUnitVectors(Y,pose.gripDirections[i]);
    }
    for(let i=0;i<legs.length;i++){
      const leg=legs[i],lift=(i===0?Math.max(0,Math.sin(pose.step*Math.PI*2)):Math.max(0,-Math.sin(pose.step*Math.PI*2)))*.07*pose.stepping;
      const foot=V(leg.sign*.13,.02+lift,0),hip=V(leg.sign*.1,.86,0),knee=V(leg.sign*.13,.43+lift*.5,.015);
      placeSegment(leg.upper,hip,knee);placeSegment(leg.lower,knee,foot);leg.foot.position.y=-.02+lift;
    }
  }};
}

export function createRowingVisual(craft,scene){
  const {boat,person,standardHuman}=craft,clock=new RowingPresentation();
  const group=new T.Group();group.name='Shared working oars';group.userData.rowingVisual=true;boat.add(group);
  const wood=new T.MeshStandardMaterial({color:0x80633e,roughness:.86}),grip=new T.MeshStandardMaterial({color:0x4e3a26,roughness:.92});
  const oars=[];
  for(const sign of [-1,1]){
    const root=new T.Group();root.name=sign<0?'Port working oar':'Starboard working oar';group.add(root);
    const shaft=mesh(new T.CylinderGeometry(.027,.031,3.82,10),wood,root,.66,0,0);shaft.rotation.z=-Math.PI/2;
    const bladeGroup=new T.Group();root.add(bladeGroup);
    const blade=mesh(new T.BoxGeometry(.73,.245,.048,3,1,1),wood,bladeGroup,SCULLING.blade,0,0);
    // The handle is part of this shaft, never an independently animated prop.
    const handle=mesh(new T.CylinderGeometry(.035,.035,.22,10),grip,root,-SCULLING.handle+.04,0,0);handle.rotation.z=-Math.PI/2;
    const collar=mesh(new T.TorusGeometry(.064,.013,5,12),grip,group,sign*SCULLING.pivotX,SCULLING.pivotY,SCULLING.pivotZ);collar.rotation.y=Math.PI/2;
    root.position.set(sign*SCULLING.pivotX,SCULLING.pivotY,SCULLING.pivotZ);
    oars.push({root,bladeGroup,sign,tip:V(),lastTip:V(),hasTip:false,previousWet:false,lastRipple:-10});
    // Short braces carry the stern rowlocks from the existing raised gunwale.
    for(const z of [SCULLING.pivotZ-.18,SCULLING.pivotZ+.18]){
      const brace=segment(grip,group,.022);placeSegment(brace,V(sign*1.10,.90,z),V(sign*SCULLING.pivotX,SCULLING.pivotY,SCULLING.pivotZ));
    }
  }
  const pose={blend:0,active:false,phase:'rest',progress:0,torsoLean:0,torsoTwist:0,step:0,stepping:0,hands:[V(),V()],gripDirections:[V(1,0,0),V(-1,0,0)],gripRadii:[.035,.035]};
  const particles=new T.InstancedMesh(new T.SphereGeometry(.023,5,4),new T.MeshBasicMaterial({color:0xb9c5ba,transparent:true,opacity:.6,depthWrite:false}),32);
  particles.name='Oar droplets';particles.frustumCulled=false;particles.visible=false;scene.add(particles);
  const drops=Array.from({length:32},()=>({life:0,p:V(),v:V()})),dummy=new T.Object3D();let nextDrop=0,contacts=0;
  function splash(point,side){for(let i=0;i<3;i++){const d=drops[nextDrop++%drops.length];d.life=.28+i*.025;d.p.copy(point);d.v.set((side===0?-1:1)*(.12+i*.035),.4+i*.12,(i-1)*.19);}}
  function update({time,dt,mode,rowing,interpolation=0,high=false,waterHeight=()=>0,onContact=()=>{}}){
    clock.update(dt,mode,rowing.ages,interpolation);
    Object.assign(pose,{blend:smooth(clock.equipment),active:clock.active,phase:clock.phase,progress:clock.progress,torsoLean:clock.torsoLean*clock.equipment,torsoTwist:clock.torsoTwist*clock.equipment,step:0,stepping:0});
    boat.updateMatrixWorld(true);group.visible=true;
    for(let side=0;side<2;side++){
      const o=oars[side],p=clock.sides[side],equipped=smooth(clock.equipment),park=smooth(clock.park),sweep=p.sweep*equipped;
      const pivot=V(o.sign*SCULLING.pivotX,SCULLING.pivotY,SCULLING.pivotZ);
      // Solve the blade's waterline in boat coordinates, including hull roll/pitch.
      let drop=.4,dir=V();
      for(let iteration=0;iteration<2;iteration++){
        dir.set(o.sign*Math.cos(sweep)*Math.cos(drop),-Math.sin(drop),Math.sin(sweep)*Math.cos(drop));
        const sample=boat.localToWorld(pivot.clone().addScaledVector(dir,SCULLING.blade));sample.y=waterHeight(sample.x,sample.z,time)+T.MathUtils.lerp(.52,p.height,equipped);
        const local=boat.worldToLocal(sample);drop=Math.asin(T.MathUtils.clamp((pivot.y-local.y)/SCULLING.blade,-.9,.9));
      }
      dir.set(o.sign*Math.cos(sweep)*Math.cos(drop),-Math.sin(drop),Math.sin(sweep)*Math.cos(drop));
      // The same pair parks longitudinally outside the gunwales. Clear the rim
      // on the way across; keep the rowlocks on their fixed mounting braces.
      const rowingYaw=Math.atan2(dir.z,Math.abs(dir.x)),parkYaw=T.MathUtils.lerp(rowingYaw,-Math.PI/2,park),parkDrop=drop*(1-park);
      dir.set(o.sign*Math.cos(parkYaw)*Math.cos(parkDrop),-Math.sin(parkDrop),Math.sin(parkYaw)*Math.cos(parkDrop));
      pivot.x=o.sign*T.MathUtils.lerp(SCULLING.pivotX,2.15,park);
      pivot.y=T.MathUtils.lerp(SCULLING.pivotY,1.12,park)+Math.sin(park*Math.PI)*.70;
      pivot.z=T.MathUtils.lerp(SCULLING.pivotZ,3.60,park);
      // Give both shafts the same upright blade frame. A shortest-arc rotation
      // alone twists the port blade, leaving its edge submerged on recovery.
      const boatOrientation=boat.getWorldQuaternion(new T.Quaternion()),vertical=Y.clone().applyQuaternion(boatOrientation.clone().invert());
      vertical.addScaledVector(dir,-vertical.dot(dir)).normalize();const lateral=dir.clone().cross(vertical).normalize();
      o.root.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(dir,vertical,lateral));o.bladeGroup.rotation.x=p.feather*Math.PI*.5;o.root.position.copy(pivot);o.root.updateMatrixWorld(true);
      const handIndex=side===0?1:0,handle=o.root.localToWorld(V(-SCULLING.handle,0,0));pose.hands[handIndex].copy(person.worldToLocal(handle));
      const orientation=boat.getWorldQuaternion(new T.Quaternion()),inverse=person.getWorldQuaternion(new T.Quaternion()).invert();pose.gripDirections[handIndex].copy(dir).applyQuaternion(orientation).applyQuaternion(inverse).normalize();
      o.tip.copy(o.root.localToWorld(V(SCULLING.blade,0,0)));
      const surface=waterHeight(o.tip.x,o.tip.z,time),wet=equipped>.92&&p.active&&o.tip.y<surface+.045;
      if(dt>0&&wet&&(!o.previousWet||time-o.lastRipple>(high?.16:.27))){
        const entry=!o.previousWet,travel={x:o.hasTip?o.tip.x-o.lastTip.x:0,z:o.hasTip?o.tip.z-o.lastTip.z:1,entry};onContact(o.tip.x,o.tip.z,entry?.34:.16,side,entry,travel);o.lastRipple=time;contacts++;
        if(high&&(entry||p.phase==='power')){const at=o.tip.clone();at.y=surface+.015;splash(at,side);}
      }
      o.previousWet=wet;
      if(dt>0){o.lastTip.copy(o.tip);o.hasTip=true;}
    }
    standardHuman.update(time,pose);
    let visibleDrops=false;
    drops.forEach((d,i)=>{if(dt>0){d.life=Math.max(0,d.life-dt);if(d.life>0){d.v.y-=2.8*dt;d.p.addScaledVector(d.v,dt);}}const visible=high&&d.life>0;visibleDrops||=visible;dummy.position.copy(d.p);dummy.scale.setScalar(visible?Math.min(1,d.life*10):0);dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);});
    particles.visible=visibleDrops;particles.instanceMatrix.needsUpdate=true;
  }
  return {group,pose,update,getStats(){return {phase:pose.phase,active:pose.active,blend:pose.blend,contacts,paddles:group.visible?2:0,park:clock.park,station:clock.station,handError:pose.highHandError??pose.handError??null,bladePositions:oars.map(o=>o.tip.toArray())};},reset(){clock.reset();drops.forEach(d=>d.life=0);contacts=0;oars.forEach(o=>{o.previousWet=false;o.hasTip=false;o.lastRipple=-10;});}};
}

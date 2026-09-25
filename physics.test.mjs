import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoatPhysics} from './dist/physics.js';
import {RowingCycle,ROWING,oarPose} from './dist/rowing.js';
import {center,width} from './dist/channel.js';
const input={mode:'motor',throttle:0,steer:0,brake:false};
function run(p,seconds,controls,dt=1/60){for(let i=0;i<Math.round(seconds/dt);i++)p.step(dt,{...input,...controls},i*dt);}
test('motor accelerates, coasts with drag, and brakes',()=>{const p=new BoatPhysics();run(p,5,{throttle:1});assert.ok(p.speed>2);assert.ok(p.z<-5);const speed=p.speed;run(p,1,{});assert.ok(p.speed>0&&p.speed<speed);run(p,3,{brake:true});assert.ok(Math.abs(p.speed)<.03);});
test('rudder turns a moving boat; reverse moves astern',()=>{const p=new BoatPhysics();run(p,3,{throttle:1});const heading=p.heading;run(p,2,{throttle:1,steer:1});assert.ok(p.heading>heading+.1);p.reset();run(p,3,{throttle:-1});assert.ok(p.z>1);});
test('a rowing tap queues a stroke without a velocity or yaw impulse',()=>{
 const p=new BoatPhysics();
 assert.equal(p.row(0),true);
 assert.equal(p.row(0),false);
 assert.equal(p.vx,0);assert.equal(p.vz,0);assert.equal(p.yawVelocity,0);
 run(p,.1,{mode:'row'});
 assert.equal(p.speed,0);assert.equal(p.yawVelocity,0);
 let lastSpeed=0,maxChange=0;
 for(let i=0;i<60;i++){
  p.step(1/60,{...input,mode:'row'},.1+i/60);
  maxChange=Math.max(maxChange,Math.abs(p.speed-lastSpeed));lastSpeed=p.speed;
 }
 assert.ok(p.speed>.3,'the power phase must propel the boat');
 assert.ok(maxChange<.021,'stroke work must be distributed over the pull');
 assert.ok(p.yawVelocity<0,'the left oar must create a gentle turn');
 assert.equal(p.row(0),false,'recovery must finish before another stroke');
 run(p,.3,{mode:'row'});
 assert.equal(p.row(0),true);
});
test('paired strokes stay synchronized and produce no alternating yaw',()=>{
 const p=new BoatPhysics(),initialHeading=p.heading;
 for(let i=0;i<1200;i++){
  p.step(1/60,{...input,mode:'row',rowBoth:true},i/60);
  assert.equal(p.rowing.ages[0],p.rowing.ages[1]);
  assert.equal(p.yawVelocity,0);
 }
 assert.equal(p.heading,initialHeading);assert.ok(p.speed>1.8);assert.ok(p.z<-25);
});
test('switching from a single oar to a pair waits for recovery and synchronizes',()=>{
 const p=new BoatPhysics();p.row(0);run(p,.3,{mode:'row'});p.rowBoth();
 let pairStarted=false;
 for(let i=0;i<100;i++){
  p.step(1/60,{...input,mode:'row',rowBoth:true},.3+i/60);
  assert.notEqual(p.rowStarted,2,'the other oar must not start alone during resynchronization');
  if(p.rowStarted===3){pairStarted=true;assert.equal(p.rowing.ages[0],p.rowing.ages[1]);break;}
 }
 assert.equal(pairStarted,true);
});
test('each single oar gives a smooth, stable turn in the opposite direction',()=>{
 const left=new BoatPhysics(),right=new BoatPhysics();
 run(left,8,{mode:'row',rowLeft:true});run(right,8,{mode:'row',rowRight:true});
 assert.ok(left.heading<.13-.15);assert.ok(right.heading>.13+.15);
 assert.ok(Math.abs((left.heading-.13)+(right.heading-.13))<1e-10);
 assert.ok(Math.abs(left.speed-right.speed)<1e-10);
 assert.ok(Math.abs(left.yawVelocity)<.1&&Math.abs(right.yawVelocity)<.1);
});
test('stroke work and cooldown timing are independent of time-step partitions',()=>{
 function strokes(steps){const r=new RowingCycle();let speed=0,yaw=0;for(const dt of steps){const force=r.step(dt,{rowBoth:true});speed+=force.speed;yaw+=force.yaw;}return {r,speed,yaw};}
 const a=strokes(Array(840).fill(1/60)),b=strokes(Array(420).fill(1/30));
 const uneven=[];let remaining=14,index=0;
 while(remaining>1e-9){const dt=Math.min([.011,.037,.02,.08][index++%4],remaining);uneven.push(dt);remaining-=dt;}
 const c=strokes(uneven);
 for(const result of [a,b,c]){
  assert.equal(result.r.strokeCount,20);assert.equal(result.yaw,0);
  assert.ok(Math.abs(result.speed-20*ROWING.speedPerOar)<1e-9);
  assert.deepEqual(result.r.ages,[-1,-1]);
 }
 const slow=new BoatPhysics(),fast=new BoatPhysics();
 run(slow,14,{mode:'row',rowBoth:true},1/30);run(fast,14,{mode:'row',rowBoth:true},1/120);
 assert.ok(Math.abs(slow.speed-fast.speed)<.02);assert.ok(Math.abs(slow.z-fast.z)<.12);
});
test('oars lift and recover continuously without snapping between strokes',()=>{
 const boundaries=[0,ROWING.catch,ROWING.catch+ROWING.power,ROWING.catch+ROWING.power+ROWING.release,ROWING.duration];
 for(const side of [0,1])for(const boundary of boundaries){
  const before=oarPose(boundary-1e-6,side),after=oarPose(boundary+1e-6,side);
  assert.ok(Math.abs(before.yaw-after.yaw)<1e-5);
  assert.ok(Math.abs(before.roll-after.roll)<1e-5);
 }
 const idle=oarPose(-1,0),end=oarPose(ROWING.duration,0);
 assert.deepEqual(idle,end);
 assert.equal(oarPose(ROWING.catch+.3,0).submerged,true);
 assert.equal(oarPose(ROWING.duration-.2,0).submerged,false);
 for(const side of [0,1]){
  const tipX=side===0?-2.9:2.9;
  const start=oarPose(ROWING.catch,side),finish=oarPose(ROWING.catch+ROWING.power,side);
  const tipZ=pose=>-Math.sin(pose.yaw)*tipX+Math.cos(pose.yaw)*.1;
  assert.ok(tipZ(finish)>tipZ(start),'a submerged blade must move toward the stern to propel the bow forward');
 }
});
test('paused simulation freezes stroke phase; cancellation clears queued and active strokes',()=>{
 const p=new BoatPhysics();p.rowBoth();run(p,.4,{mode:'row'});
 const ages=[...p.rowing.ages],speed=p.speed;
 p.step(0,{...input,mode:'row',rowBoth:true},1000);
 assert.deepEqual(p.rowing.ages,ages);assert.equal(p.speed,speed);assert.equal(p.rowStarted,0);
 p.rowBoth();p.cancelRowing();
 assert.deepEqual(p.rowing.ages,[-1,-1]);assert.equal(p.rowing.pending,0);
 run(p,.4,{mode:'row'});assert.ok(p.speed<speed);assert.equal(p.rowing.strokeCount,0);
 p.rowBoth();p.step(1/60,input,0);assert.equal(p.rowing.pending,0);
 run(p,.4,{mode:'row'});assert.equal(p.rowing.strokeCount,0,'switching modes must not replay queued strokes');
});
test('bank collision keeps the full length of the hull in the channel',()=>{const p=new BoatPhysics();p.x=width(0)+10;p.heading=Math.PI/2;p.vx=5;p.step(1/60,input,0);for(const o of [-5.5,0,5.5]){const px=p.x-Math.sin(p.heading)*o,pz=p.z-Math.cos(p.heading)*o;assert.ok(Math.abs(px-center(pz))<=width(pz)-2.8+.1);}assert.ok(p.collided);});
test('simulation is stable across 30 and 60 Hz integration',()=>{const a=new BoatPhysics(),b=new BoatPhysics();run(a,4,{throttle:1},1/60);run(b,4,{throttle:1},1/30);assert.ok(Math.abs(a.z-b.z)<.3);assert.ok(Math.abs(a.speed-b.speed)<.06);});
test('reset clears momentum, travel, and stroke cooldowns',()=>{const p=new BoatPhysics();run(p,5,{throttle:1,steer:1});p.row(0,10);p.reset();assert.equal(p.distance,0);assert.equal(p.vx,0);assert.equal(p.vz,0);assert.equal(p.z,0);assert.equal(p.row(0,0),true);});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoatPhysics} from './dist/physics.js';
import {ROWING} from './dist/rowing.js';
import {RowingPresentation, strokePresentation} from './dist/rowing-motion.js';

const DT = 1 / 60;
const controls = overrides => Object.freeze({mode:'row',throttle:0,steer:0,brake:false,...overrides});
const snapshot = presentation => structuredClone({
  active:presentation.active,phase:presentation.phase,progress:presentation.progress,
  equipment:presentation.equipment,station:presentation.station,
  torsoLean:presentation.torsoLean,torsoTwist:presentation.torsoTwist,
  sides:presentation.sides.map(({sweep,height,feather,phase,active,progress}) => ({sweep,height,feather,phase,active,progress})),
});

function tick(physics,presentation,input,frame,dt=DT){
  physics.step(dt,input,frame*DT);
  presentation.update(dt,input.mode,physics.rowing.ages);
}

function assertContinuous(before,after,label){
  // These bounds permit the fastest intended catch at 60 Hz, but reject a
  // visible snap across a significant part of the oar's range in one frame.
  assert.ok(Math.abs(after.sweep-before.sweep)<.04,`${label}: sweep snapped`);
  assert.ok(Math.abs(after.height-before.height)<.065,`${label}: blade height snapped`);
  assert.ok(Math.abs(after.feather-before.feather)<.23,`${label}: feather snapped`);
}

test('stroke poses are continuous at catch, power, release, recovery and rest',()=>{
  const boundaries=[0,ROWING.catch,ROWING.catch+ROWING.power,ROWING.catch+ROWING.power+ROWING.release,ROWING.duration];
  for(const side of [0,1])for(const boundary of boundaries){
    const before=strokePresentation(boundary-1e-6,side),after=strokePresentation(boundary+1e-6,side);
    for(const channel of ['sweep','height','feather']){
      assert.ok(Math.abs(before[channel]-after[channel])<.0001,`${channel} discontinuous at age ${boundary}`);
    }
  }
  const catchPose=strokePresentation(ROWING.catch*.5,0);
  const power=strokePresentation(ROWING.catch+ROWING.power*.5,0);
  const release=strokePresentation(ROWING.catch+ROWING.power+ROWING.release*.5,0);
  const recovery=strokePresentation(ROWING.duration-ROWING.recovery*.5,0);
  assert.deepEqual([catchPose.phase,power.phase,release.phase,recovery.phase],['catch','power','release','recovery']);
  assert.ok(power.height<0,'the power stroke must engage the water');
  assert.ok(recovery.height>0&&recovery.feather===1,'recovery must lift and feather the blade');
  assert.ok(strokePresentation(-1,0).active===false&&strokePresentation(ROWING.duration,0).active===false);
});

test('the presentation reads real stroke ages, including catch before the boat moves',()=>{
  const stopped=new BoatPhysics(),coasting=new BoatPhysics(),a=new RowingPresentation(),b=new RowingPresentation();
  coasting.vx=-Math.sin(coasting.heading)*5;coasting.vz=-Math.cos(coasting.heading)*5;coasting.speed=5;
  const input=controls({rowBoth:true});
  for(let frame=0;frame<210;frame++){
    tick(stopped,a,input,frame);tick(coasting,b,input,frame);
    assert.deepEqual(snapshot(a),snapshot(b),'boat speed must not change the rowing cadence');
    if(frame===0){assert.equal(stopped.speed,0);assert.equal(a.active,true);assert.equal(a.phase,'catch');}
  }
  assert.ok(Math.abs(stopped.speed-coasting.speed)>.1,'the comparison must contain genuinely different boat speeds');
});

test('rendering rowing at extra frame rates does not change forces, controls or simulation state',()=>{
  const reference=new BoatPhysics(),rendered=new BoatPhysics(),presentation=new RowingPresentation();
  for(let frame=0;frame<600;frame++){
    const input=controls(frame<180?{rowBoth:true}:frame<300?{mode:'motor',throttle:.7,steer:.15}:frame<450?{rowLeft:true}:frame<480?{}:{rowBoth:true});
    reference.step(DT,input,frame*DT);rendered.step(DT,input,frame*DT);
    const before=structuredClone(rendered);
    const ages=Object.freeze([...rendered.rowing.ages]);
    for(let render=0;render<3;render++)presentation.update(DT/3,input.mode,ages,render*DT/3);
    assert.deepEqual(structuredClone(rendered),before,'rendering must not mutate the simulation or queue strokes');
    assert.deepEqual(rendered,reference,'presentation must not change propulsion, steering, timing or travel');
  }
});

test('a full simulated stroke moves continuously through all four phases',()=>{
  const physics=new BoatPhysics(),presentation=new RowingPresentation(),phases=new Set();
  physics.rowBoth();
  for(let frame=0;frame<Math.ceil(ROWING.duration/DT)+8;frame++){
    const before=snapshot(presentation);tick(physics,presentation,controls(),frame);
    phases.add(presentation.phase);
    for(const side of [0,1])assertContinuous(before.sides[side],presentation.sides[side],`side ${side}, frame ${frame}`);
  }
  for(const phase of ['catch','power','release','recovery','rest'])assert.ok(phases.has(phase),`${phase} must be displayed`);
  assert.equal(presentation.active,false);
});

test('a single-oar stroke joins a queued pair only after recovery, without a pose snap',()=>{
  const physics=new BoatPhysics(),presentation=new RowingPresentation();
  physics.row(0);
  for(let frame=0;frame<18;frame++)tick(physics,presentation,controls(),frame);
  physics.rowBoth();let pairStarted=false;
  for(let frame=18;frame<140;frame++){
    const before=snapshot(presentation);tick(physics,presentation,controls({rowBoth:true}),frame);
    for(const side of [0,1])assertContinuous(before.sides[side],presentation.sides[side],`queued pair side ${side}, frame ${frame}`);
    if(physics.rowStarted===3){
      pairStarted=true;assert.equal(presentation.sides[0].active,true);assert.equal(presentation.sides[1].active,true);
      assert.equal(presentation.sides[0].phase,presentation.sides[1].phase);
      assert.equal(presentation.sides[0].progress,presentation.sides[1].progress);break;
    }
    assert.equal(presentation.sides[1].active,false,'a queued partner must not move ahead of the real paired stroke');
  }
  assert.equal(pairStarted,true,'the pair must eventually begin');
});

test('cancel then restart preserves blade position and feather continuity',()=>{
  const physics=new BoatPhysics(),presentation=new RowingPresentation();physics.rowBoth();
  for(let frame=0;frame<24;frame++)tick(physics,presentation,controls(),frame);
  assert.equal(presentation.phase,'power');
  tick(physics,presentation,controls({mode:'motor'}),24);
  const before=snapshot(presentation);
  assert.equal(before.active,false);physics.rowBoth();
  tick(physics,presentation,controls(),25);
  assert.equal(presentation.phase,'catch');
  for(const side of [0,1])assertContinuous(before.sides[side],presentation.sides[side],`restart side ${side}`);
});

test('paused simulation time freezes the presentation and the real stroke ages',()=>{
  const physics=new BoatPhysics(),presentation=new RowingPresentation();physics.rowBoth();
  for(let frame=0;frame<25;frame++)tick(physics,presentation,controls(),frame);
  const before=snapshot(presentation),ages=[...physics.rowing.ages],position=[physics.x,physics.z];
  for(let frame=0;frame<240;frame++)tick(physics,presentation,controls({rowBoth:true}),frame+25,0);
  assert.deepEqual(snapshot(presentation),before);
  assert.deepEqual(physics.rowing.ages,ages);assert.deepEqual([physics.x,physics.z],position);
});

test('coasting without an active stroke never invents a rowing animation',()=>{
  const physics=new BoatPhysics(),presentation=new RowingPresentation();
  physics.vz=-2;physics.speed=2;
  for(let frame=0;frame<120;frame++){
    tick(physics,presentation,controls(),frame);
    assert.equal(presentation.active,false);assert.equal(presentation.phase,'rest');
    assert.ok(presentation.sides.every(side=>!side.active&&side.height>0));
  }
  assert.ok(physics.distance>1,'the boat should really be coasting during this check');
  assert.equal(physics.rowing.strokeCount,0);
});

test('switching to motor lifts and feathers both oars before settling',()=>{
  const physics=new BoatPhysics(),presentation=new RowingPresentation();physics.rowBoth();
  for(let frame=0;frame<30;frame++)tick(physics,presentation,controls(),frame);
  assert.equal(presentation.phase,'power');
  for(let frame=30;frame<210;frame++){
    const before=snapshot(presentation);tick(physics,presentation,controls({mode:'motor'}),frame);
    assert.equal(presentation.active,false);
    for(const side of [0,1]){
      const after=presentation.sides[side];
      assert.ok(after.height>=before.sides[side].height,'cancellation must lift the blade');
      assert.ok(after.feather>=before.sides[side].feather,'cancellation must feather the blade');
    }
  }
  assert.equal(presentation.phase,'rest');assert.equal(presentation.station,0);assert.equal(presentation.equipment,0);
  assert.ok(presentation.sides.every(side=>side.height>.21&&side.feather>.99&&Math.abs(side.sweep)<.001));
  assert.deepEqual(physics.rowing.ages,[-1,-1]);assert.equal(physics.rowing.pending,0);
});

test('replacing a rendering consumer mid-stroke retains phase and current simulation age',()=>{
  // Quality is intentionally outside this pure module: either renderer consumes
  // the same presentation. This exercises that contract, not the browser UI.
  const physics=new BoatPhysics(),presentation=new RowingPresentation();physics.rowBoth();
  for(let frame=0;frame<24;frame++)tick(physics,presentation,controls(),frame);
  const before=snapshot(presentation);
  let consume=pose=>({phase:pose.phase,progress:pose.progress,oars:pose.sides.map(side=>side.sweep)});
  const standard=consume(presentation);
  consume=pose=>({phase:pose.phase,progress:pose.progress,oars:pose.sides.map(side=>side.sweep),station:pose.station});
  const high=consume(presentation);
  assert.equal(high.phase,standard.phase);assert.equal(high.progress,standard.progress);assert.deepEqual(high.oars,standard.oars);
  assert.deepEqual(snapshot(presentation),before,'replacing the pose consumer must not reset the shared presentation');
  tick(physics,presentation,controls(),24);
  assert.equal(presentation.phase,'power');assert.ok(presentation.progress>before.progress);
});

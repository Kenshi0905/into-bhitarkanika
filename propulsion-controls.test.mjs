import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoatPhysics} from './dist/physics.js';
import {ROWING} from './dist/rowing.js';
import {PropulsionControls} from './dist/propulsion-controls.js';

const DT=1/60;
function voyage(){
  const state={mode:'motor',cruise:false,graphics:'standard'},physics=new BoatPhysics();
  const controls=new PropulsionControls(state,physics),starts=[];
  let time=0;
  function tick(input={}){
    time+=DT;
    controls.update(DT);
    physics.step(DT,{mode:state.mode,throttle:0,steer:0,brake:false,...input},time);
    if(physics.rowStarted)starts.push({time,sides:physics.rowStarted,ages:[...physics.rowing.ages]});
  }
  function advance(seconds,input={}){for(let frame=0;frame<Math.round(seconds/DT);frame++)tick(input);}
  return {state,physics,controls,starts,tick,advance};
}

test('selecting Row automatically starts repeated paired strokes, separated by recovery and rest',()=>{
  const v=voyage();v.controls.select('row');
  assert.equal(v.state.mode,'row');assert.equal(v.state.cruise,true);
  v.advance(.5);assert.equal(v.physics.rowing.strokeCount,0,'allow the rower time to prepare');
  v.advance(5.5);
  assert.ok(v.starts.length>=3,'automatic rowing must continue without held keys');
  for(let i=0;i<v.starts.length;i++){
    assert.equal(v.starts[i].sides,3,'both oars start together');
    assert.equal(v.starts[i].ages[0],v.starts[i].ages[1]);
    if(i)assert.ok(v.starts[i].time-v.starts[i-1].time>ROWING.duration+.3,'each stroke includes a distinct rest');
  }
  assert.ok(v.physics.distance>1,'automatic strokes must actually propel the boat');
});

test('Pause finishes the current stroke, removes an extra queued stroke and then coasts',()=>{
  const v=voyage();v.controls.select('row');v.advance(1.1);
  assert.ok(v.physics.rowing.ages.every(age=>age>ROWING.catch&&age<ROWING.catch+ROWING.power));
  // An input queued immediately before Pause must not survive that decision.
  v.physics.rowBoth();const ages=[...v.physics.rowing.ages],count=v.physics.rowing.strokeCount;
  v.controls.toggle();
  assert.equal(v.state.cruise,false);assert.equal(v.state.mode,'row');
  assert.deepEqual(v.physics.rowing.ages,ages,'Pause must not teleport the active blades to rest');
  assert.equal(v.physics.rowing.pending,0);
  v.advance(3);
  assert.equal(v.physics.rowing.strokeCount,count);assert.deepEqual(v.physics.rowing.ages,[-1,-1]);
  assert.ok(v.physics.speed>0,'pausing the rowing rhythm should allow the boat to coast');
});

test('Resume keeps Row selected and restarts the paired rhythm without holding an input',()=>{
  const v=voyage();v.controls.select('row');v.advance(1);v.controls.toggle();v.advance(2);
  const count=v.physics.rowing.strokeCount;
  v.controls.toggle();assert.equal(v.state.mode,'row');assert.equal(v.state.cruise,true);
  v.advance(3);
  assert.ok(v.physics.rowing.strokeCount>=count+4);
  assert.ok(v.starts.every(start=>start.sides===3));
});

test('manual input during preparation takes over immediately and leaves no delayed automatic pair',()=>{
  const v=voyage();v.controls.select('row');v.advance(.6);
  v.controls.manual('KeyQ');v.tick();
  assert.equal(v.state.cruise,false);assert.equal(v.physics.rowStarted,1);
  v.advance(4);
  assert.equal(v.physics.rowing.strokeCount,1);assert.equal(v.physics.rowing.pending,0);
  assert.deepEqual(v.physics.rowing.ages,[-1,-1]);
});

test('a manual held oar takes over after the current pair without overlapping or retaining auto requests',()=>{
  const v=voyage();v.controls.select('row');v.advance(1.1);
  const activeAges=[...v.physics.rowing.ages];
  v.controls.manual('KeyQ');assert.equal(v.state.cruise,false);
  assert.deepEqual(v.physics.rowing.ages,activeAges);
  const priorStarts=v.starts.length;
  for(let frame=0;frame<120&&v.starts.length===priorStarts;frame++)v.tick({rowLeft:true});
  assert.equal(v.starts.length,priorStarts+1);
  assert.equal(v.starts.at(-1).sides,1,'the next stroke must respect the manual left-oar input');
  assert.equal(v.physics.rowing.ages[1],-1,'the old paired request must not restart the other oar');
  v.advance(4);
  assert.equal(v.physics.rowing.strokeCount,3);assert.equal(v.physics.rowing.pending,0);
});

test('repeated paired requests during a single stroke produce one synchronized pair after recovery',()=>{
  const v=voyage();v.controls.select('row');v.controls.manual('KeyQ');v.advance(.3);
  for(let repeat=0;repeat<40;repeat++)v.controls.manual('Space');
  v.advance(4);
  assert.deepEqual(v.starts.map(start=>start.sides),[1,3]);
  assert.ok(v.starts[1].time-v.starts[0].time>=ROWING.duration-DT);
  assert.equal(v.starts[1].ages[0],v.starts[1].ages[1]);
  assert.equal(v.physics.rowing.strokeCount,3,'key repeats must not queue an unbounded series');
});

test('steering while automatically rowing preserves the rhythm and changes heading',()=>{
  const straight=voyage(),turning=voyage();
  straight.controls.select('row');turning.controls.select('row');
  turning.controls.manual('KeyA');assert.equal(turning.state.cruise,true);
  for(let frame=0;frame<360;frame++){straight.tick();turning.tick({steer:1});}
  assert.deepEqual(turning.starts,straight.starts,'steering should not interrupt or retrigger the rowing clock');
  assert.ok(Math.abs(turning.physics.heading-straight.physics.heading)>.1);
});

test('braking takes over from auto-row and does not start another stroke',()=>{
  const v=voyage();v.controls.select('row');v.advance(1.1);
  const count=v.physics.rowing.strokeCount;
  v.controls.manual('ArrowDown');v.advance(3,{brake:true});
  assert.equal(v.state.cruise,false);assert.equal(v.physics.rowing.strokeCount,count);
  assert.deepEqual(v.physics.rowing.ages,[-1,-1]);assert.equal(v.physics.rowing.pending,0);
  assert.ok(Math.abs(v.physics.speed)<.03);
});

test('changing the rendering preset preserves the real ongoing stroke and following schedule',()=>{
  // Browser integration owns rendering. The scheduler consumes the same shared
  // state through a preset change; it must not make quality part of propulsion.
  const reference=voyage(),changed=voyage();reference.controls.select('row');changed.controls.select('row');
  for(let frame=0;frame<360;frame++){
    if(frame===70||frame===190)changed.state.graphics=frame===70?'high':'standard';
    reference.tick();changed.tick();
    assert.deepEqual(changed.physics,reference.physics);
  }
  assert.deepEqual(changed.starts,reference.starts);
});

test('Motor cancels active and queued rowing, and its cruise setting cannot auto-row',()=>{
  const v=voyage();v.controls.select('row');v.advance(1.1);v.physics.rowBoth();
  v.controls.select('motor');
  assert.equal(v.state.cruise,false);assert.deepEqual(v.physics.rowing.ages,[-1,-1]);assert.equal(v.physics.rowing.pending,0);
  v.controls.toggle();assert.equal(v.state.cruise,true);assert.equal(v.state.mode,'motor');
  v.advance(5,{throttle:.5});assert.equal(v.physics.rowing.strokeCount,0);
  assert.ok(v.physics.distance>1);
  v.controls.manual('KeyA');assert.equal(v.state.cruise,false,'manual motor controls take over from cruise');
});

test('a voyage reset starts in a paused rhythm without old pending work',()=>{
  const v=voyage();v.controls.select('row');v.advance(1.1);v.physics.rowBoth();
  v.physics.reset();v.controls.reset();v.advance(4);
  assert.equal(v.state.cruise,false);assert.equal(v.physics.rowing.strokeCount,0);assert.equal(v.physics.rowing.pending,0);
  v.controls.toggle();v.advance(1);assert.equal(v.physics.rowing.strokeCount,2);
});

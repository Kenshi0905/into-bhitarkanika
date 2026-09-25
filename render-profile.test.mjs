import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRenderProfile} from './dist/render-profile.js';

function withRenderer(run){
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'performance');
  let clock=0;
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock}});
  const renderer={
    info:{autoReset:true,render:{calls:0,triangles:0},reset(){this.render.calls=0;this.render.triangles=0;}},
    render(scene,camera){assert.equal(this,renderer);return scene(camera);},
    shadowMap:{render(pass){assert.equal(this,renderer.shadowMap);return pass();}},
  };
  const submit=(calls,triangles,cpuMs)=>{renderer.info.render.calls+=calls;renderer.info.render.triangles+=triangles;clock+=cpuMs;};
  const profile=createRenderProfile(renderer);
  const frame=scene=>{profile.begin();try{return renderer.render(scene,'camera');}finally{profile.end();}};
  try{return run({renderer,submit,profile,frame});}
  finally{Object.defineProperty(globalThis,'performance',descriptor);}
}
const pass=(calls,triangles,cpuMs)=>({calls,triangles,cpuMs});

test('context recovery rebinds the replaced shadow object and disables new auto-reset',()=>withRenderer(({renderer,submit,profile,frame})=>{
 frame(()=>submit(100,10000,20));
 renderer.shadowMap={render(fn){return fn();}};renderer.info.autoReset=true;profile.rebind();assert.equal(profile.getStats(),null);assert.equal(renderer.info.autoReset,false);
 frame(()=>{renderer.shadowMap.render(()=>submit(2,90,.4));submit(3,80,.6);});
 assert.deepEqual(profile.getStats().shadow,pass(2,90,.4));assert.deepEqual(profile.getStats().main,pass(3,80,.6));
}));

test('post work is separate from main, reflection and shadows and restores after failure',()=>withRenderer(({renderer,submit,profile})=>{
 profile.begin();renderer.render(()=>submit(3,500,2));
 profile.post(()=>{renderer.render(()=>submit(1,1,.1));renderer.render(()=>submit(1,1,.2));});
 assert.throws(()=>profile.post(()=>{throw new Error('post failed');}),/post failed/);
 renderer.render(()=>submit(2,200,1));profile.end();
 assert.deepEqual(profile.getStats().main,pass(5,700,3));assert.deepEqual(profile.getStats().post,pass(2,2,.3));
 assert.deepEqual(profile.getStats().reflection,pass(0,0,0));assert.deepEqual(profile.getStats().total,pass(7,702,3.3));
}));

test('one main render records actual submitted work and preserves arguments and return values',()=>withRenderer(({renderer,submit,profile,frame})=>{
  assert.equal(renderer.info.autoReset,false);assert.equal(profile.getStats(),null);
  const output=frame(camera=>{assert.equal(camera,'camera');submit(7,2300,4.25);return 'rendered';});
  assert.equal(output,'rendered');const stats=profile.getStats();
  assert.deepEqual(stats.main,pass(7,2300,4.25));assert.deepEqual(stats.reflection,pass(0,0,0));assert.deepEqual(stats.shadow,pass(0,0,0));
  assert.deepEqual(stats.total,pass(7,2300,4.25));assert.equal(stats.samples,1);
  assert.match(stats.timing,/CPU.*not GPU/);
}));

test('reflection and both shadow passes are counted once with exclusive CPU time',()=>withRenderer(({renderer,submit,profile,frame})=>{
  frame(()=>{
    submit(2,200,1);
    renderer.shadowMap.render(()=>submit(3,900,2));
    renderer.render(()=>{
      submit(4,1200,3);
      renderer.shadowMap.render(()=>submit(5,1500,4));
      submit(1,100,1);
    });
    submit(6,1800,5);
  });
  const stats=profile.getStats();
  assert.deepEqual(stats.main,pass(8,2000,6));assert.deepEqual(stats.reflection,pass(5,1300,4));
  assert.deepEqual(stats.shadow,pass(8,2400,6));assert.deepEqual(stats.total,pass(21,5700,16));
  assert.equal(stats.total.calls,renderer.info.render.calls);assert.equal(stats.total.triangles,renderer.info.render.triangles);
}));

test('multiple reflection renders are additive and do not absorb surrounding main work',()=>withRenderer(({renderer,submit,profile,frame})=>{
  frame(()=>{
    submit(1,100,1);
    renderer.render(()=>submit(2,300,2));
    submit(3,600,3);
    renderer.render(()=>{submit(4,1000,4);renderer.shadowMap.render(()=>submit(5,1500,5));});
    submit(6,2100,6);
  });
  const stats=profile.getStats();
  assert.deepEqual(stats.main,pass(10,2800,10));assert.deepEqual(stats.reflection,pass(6,1300,6));
  assert.deepEqual(stats.shadow,pass(5,1500,5));assert.deepEqual(stats.total,pass(21,5600,21));
}));

test('a render nested inside a reflection is counted once rather than double-counted as reflection work',()=>withRenderer(({renderer,submit,profile,frame})=>{
  frame(()=>{
    submit(2,200,2);
    renderer.render(()=>{
      submit(3,300,3);
      renderer.render(()=>{submit(5,500,5);renderer.shadowMap.render(()=>submit(7,700,7));});
      submit(11,1100,11);
    });
    submit(13,1300,13);
  });
  const stats=profile.getStats();
  assert.deepEqual(stats.main,pass(15,1500,15));
  assert.deepEqual(stats.reflection,pass(19,1900,19));assert.deepEqual(stats.shadow,pass(7,700,7));
  assert.deepEqual(stats.total,pass(41,4100,41));
}));

test('work outside a profiled frame is ignored, and each begin resets stale renderer counters',()=>withRenderer(({renderer,submit,profile,frame})=>{
  renderer.render(()=>{submit(80,8000,8);renderer.shadowMap.render(()=>submit(20,2000,2));});
  assert.equal(profile.getStats(),null);
  frame(()=>submit(4,400,4));
  assert.deepEqual(profile.getStats().total,pass(4,400,4));
  renderer.render(()=>submit(100,10000,10));
  assert.deepEqual(profile.getStats().total,pass(4,400,4));
  frame(()=>submit(6,600,6));
  assert.deepEqual(profile.getStats().total,pass(5,500,5));
  assert.equal(renderer.info.render.calls,6);assert.equal(renderer.info.render.triangles,600);
}));

test('reset discards historical samples and the next frame has independent counters and timings',()=>withRenderer(({renderer,submit,profile,frame})=>{
  frame(()=>{submit(12,1200,12);renderer.render(()=>submit(8,800,8));});
  profile.reset();assert.equal(profile.getStats(),null);
  frame(()=>{submit(3,300,3);renderer.shadowMap.render(()=>submit(2,200,2));});
  const stats=profile.getStats();assert.equal(stats.samples,1);
  assert.deepEqual(stats.main,pass(3,300,3));assert.deepEqual(stats.reflection,pass(0,0,0));
  assert.deepEqual(stats.shadow,pass(2,200,2));assert.deepEqual(stats.total,pass(5,500,5));
}));

test('the rolling average retains only the most recent sixty frames',()=>withRenderer(({submit,profile,frame})=>{
  for(let i=0;i<60;i++)frame(()=>submit(100,10000,10));
  for(let i=0;i<60;i++)frame(()=>submit(4,400,2));
  const stats=profile.getStats();assert.equal(stats.samples,60);assert.deepEqual(stats.total,pass(4,400,2));
}));

test('render failures preserve submitted counts and unwind nesting before the next frame',()=>withRenderer(({renderer,submit,profile,frame})=>{
  const failure=new Error('mock draw failed');
  assert.throws(()=>frame(()=>{
    submit(2,200,2);
    renderer.render(()=>{submit(3,300,3);renderer.shadowMap.render(()=>{submit(5,500,5);throw failure;});});
  }),error=>error===failure);
  assert.deepEqual(profile.getStats().main,pass(2,200,2));assert.deepEqual(profile.getStats().reflection,pass(3,300,3));
  assert.deepEqual(profile.getStats().shadow,pass(5,500,5));assert.deepEqual(profile.getStats().total,pass(10,1000,10));
  profile.reset();frame(()=>submit(7,700,7));
  assert.deepEqual(profile.getStats().main,pass(7,700,7));assert.deepEqual(profile.getStats().reflection,pass(0,0,0));
}));

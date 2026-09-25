import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BoatPhysics} from './dist/physics.js';
import {center,width} from './dist/channel.js';
const input={mode:'motor',throttle:0,steer:0,brake:false};
function run(p,seconds,controls,dt=1/60){for(let t=0;t<seconds;t+=dt)p.step(dt,{...input,...controls},t);}
test('motor accelerates, coasts with drag, and brakes',()=>{const p=new BoatPhysics();run(p,5,{throttle:1});assert.ok(p.speed>2);assert.ok(p.z<-5);const speed=p.speed;run(p,1,{});assert.ok(p.speed>0&&p.speed<speed);run(p,3,{brake:true});assert.ok(Math.abs(p.speed)<.03);});
test('rudder turns a moving boat; reverse moves astern',()=>{const p=new BoatPhysics();run(p,3,{throttle:1});const heading=p.heading;run(p,2,{throttle:1,steer:1});assert.ok(p.heading>heading+.1);p.reset();run(p,3,{throttle:-1});assert.ok(p.z>1);});
test('rowing is stroke limited, and each oar produces opposite torque',()=>{const p=new BoatPhysics();assert.equal(p.row(0,0),true);assert.equal(p.row(0,.2),false);assert.ok(p.yawVelocity<0);assert.equal(p.row(1,0),true);assert.ok(Math.abs(p.yawVelocity)<1e-8);assert.equal(p.row(0,.84),true);run(p,1,{mode:'row'});assert.ok(p.z<-.3);});
test('bank collision keeps the full length of the hull in the channel',()=>{const p=new BoatPhysics();p.x=width(0)+10;p.heading=Math.PI/2;p.vx=5;p.step(1/60,input,0);for(const o of [-5.5,0,5.5]){const px=p.x-Math.sin(p.heading)*o,pz=p.z-Math.cos(p.heading)*o;assert.ok(Math.abs(px-center(pz))<=width(pz)-2.8+.1);}assert.ok(p.collided);});
test('simulation is stable across 30 and 60 Hz integration',()=>{const a=new BoatPhysics(),b=new BoatPhysics();run(a,4,{throttle:1},1/60);run(b,4,{throttle:1},1/30);assert.ok(Math.abs(a.z-b.z)<.3);assert.ok(Math.abs(a.speed-b.speed)<.06);});
test('reset clears momentum, travel, and stroke cooldowns',()=>{const p=new BoatPhysics();run(p,5,{throttle:1,steer:1});p.row(0,10);p.reset();assert.equal(p.distance,0);assert.equal(p.vx,0);assert.equal(p.vz,0);assert.equal(p.z,0);assert.equal(p.row(0,0),true);});

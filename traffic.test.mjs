import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrafficState,stepTraffic} from './dist/traffic.js';
import {center,width} from './dist/channel.js';

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

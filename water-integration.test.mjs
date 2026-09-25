import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {sampleEstuary,sampleLaunchWake} from './dist/water-motion.js';

// Use the app's actual Three build and Water object. Only image I/O is replaced;
// these tests exercise scene geometry, quality state and contacts without a GPU.
const threeURL=new URL('./dist/vendor/three.module.js',import.meta.url).href,T=await import(threeURL);
registerHooks({resolve(specifier,context,next){return next(specifier==='three'?threeURL:specifier,context);}});
const {buildWater,waveHeight}=await import('./dist/water.js');

function fixture(t,mobile=false){
  t.mock.method(T.TextureLoader.prototype,'load',()=>new T.Texture());
  const prior=globalThis.matchMedia;globalThis.matchMedia=()=>({matches:mobile});
  const scene=new T.Scene(),system=buildWater(scene,new T.Vector3(.4,.8,.2).normalize());
  const geometries=new Set([system.water.geometry]);
  t.after(()=>{
    globalThis.matchMedia=prior;
    for(const geometry of geometries)geometry.dispose();
    system.water.material.uniforms.normalSampler.value.dispose();system.water.disposeReflection();system.water.material.dispose();
  });
  return {system,scene,geometries};
}
function wake(vessel,x,z,time){return sampleLaunchWake(x,z,vessel.x,vessel.z,-Math.sin(vessel.heading),-Math.cos(vessel.heading),vessel.speed,vessel.length,time).height;}
function vesselPoint(vessel,along,cross){
  const reverse=vessel.speed<0?-1:1,dx=-Math.sin(vessel.heading)*reverse,dz=-Math.cos(vessel.heading)*reverse;
  return {x:vessel.x+dx*along+dz*cross,z:vessel.z+dz*along-dx*cross};
}
function close(actual,expected,message){assert.ok(Math.abs(actual-expected)<1e-12,`${message}: ${actual} != ${expected}`);}

test('High contact height follows the current wind, moving player and four traffic wakes together',t=>{
  const {system,geometries}=fixture(t);system.setQuality(true);geometries.add(system.water.geometry);
  let strongestPlayer=0,strongestTraffic=0,currentPoseChange=0;
  for(let frame=0;frame<18;frame++){
    const time=41+frame*.23,player={x:12+frame*.7,z:-420-frame*.9,heading:.37+frame*.019,speed:frame%2?-1.7:2.315,length:15};
    const vessels=Array.from({length:4},(_,i)=>({x:player.x+(i-1.3)*3.8,z:player.z+(i-1.5)*8,heading:-.4+i*.19+frame*.027,speed:1.1+i*.35,length:7+i*1.3}));
    const climate={wind:{x:.6+frame*.03,z:-.85+frame*.009,strength:.2+frame*.043},rain:.4,flash:0};
    const wind=.83+climate.wind.strength*.8,directionLength=Math.hypot(climate.wind.x,climate.wind.z);
    const base=(x,z)=>sampleEstuary(x,z,time,wind,climate.wind.x/directionLength,climate.wind.z/directionLength).height;
    const bow=vesselPoint(player,player.length*.485,0),oldPoseHeight=system.heightAt(bow.x,bow.z,time);
    system.setWeather(climate);system.setTraffic(vessels);system.update(time,{x:player.x,y:.2,z:player.z},player.heading,player.speed);
    currentPoseChange=Math.max(currentPoseChange,Math.abs(oldPoseHeight-system.heightAt(bow.x,bow.z,time)));
    const points=[bow,{x:player.x,z:player.z},...vessels.flatMap(v=>[vesselPoint(v,v.length*.485,0),vesselPoint(v,-v.length*.485-5,2.45)])];
    for(const {x,z} of points){
      const own=wake(player,x,z,time),traffic=vessels.reduce((sum,vessel)=>sum+wake(vessel,x,z,time),0);
      close(system.heightAt(x,z,time),base(x,z)+own+traffic,'combined current surface');
      strongestPlayer=Math.max(strongestPlayer,Math.abs(own));strongestTraffic=Math.max(strongestTraffic,Math.abs(traffic));
    }
    assert.deepEqual(system.water.position.toArray(),[player.x,0,player.z]);
    // Removing traffic must remove its sampled wake immediately, without a
    // render call or another boat update to clear stale vessel uniforms.
    system.setTraffic([]);
    for(const {x,z} of points)close(system.heightAt(x,z,time),base(x,z)+wake(player,x,z,time),'cleared traffic surface');
    assert.ok(system.uniforms.trafficPositions.value.every(v=>v.w===0));
  }
  assert.ok(strongestPlayer>.08&&strongestTraffic>.04&&currentPoseChange>.02,'fixtures must exercise material wake contributions and changed poses');
});

for(const mobile of [false,true])test(`${mobile?'Phone':'Desktop'} quality cycles restore Standard geometry and ring size while reusing bounded High geometry`,t=>{
  const {system,scene,geometries}=fixture(t,mobile),mesh=system.water,original=mesh.geometry,material=mesh.material;
  const position=original.attributes.position,originalBytes=Buffer.from(new Uint8Array(position.array.buffer));
  const ripples=system.uniforms.ripples.value,directions=system.uniforms.rippleDirections.value,normal=system.uniforms.normalSampler.value;
  const standardSize=mobile?512:1024,geometryIds=new Set([original.uuid]);
  let cached=null,cursor=0,stamp=100;
  function emit(count,ring){
    const touched=new Set();
    for(let i=0;i<count;i++){
      stamp++;system.ripple(stamp,-stamp,stamp,.7,{x:3,z:4,entry:i%2===0});
      const index=ripples.findIndex(value=>value.x===stamp);
      assert.equal(index,cursor,'the active preset must use its own bounded ripple ring');touched.add(index);
      assert.deepEqual(ripples[index].toArray(),[stamp,-stamp,stamp,.7]);
      close(directions[index].x,.6,'ripple x direction');close(directions[index].y,.8,'ripple z direction');
      cursor=(cursor+1)%ring;
    }
    return touched;
  }
  assert.equal(emit(20,16).size,16);assert.ok(ripples.slice(16).every(value=>value.z===-100));
  for(let cycle=0;cycle<24;cycle++){
    system.setQuality(true);
    if(!cached){cached=mesh.geometry;geometries.add(cached);}
    assert.ok(mesh.geometry===cached&&cached!==original);geometryIds.add(mesh.geometry.uuid);
    assert.equal(cached.attributes.position.count,257*257);assert.equal(cached.index.count/3,131072);
    assert.deepEqual(cached.boundingBox.min.toArray(),[-1200,-1200,0]);assert.deepEqual(cached.boundingBox.max.toArray(),[1200,1200,0]);
    assert.ok(Number.isFinite(cached.boundingSphere.radius)&&cached.boundingSphere.radius<1700);
    system.setWeather({wind:{x:.3,z:.8,strength:.9},rain:.8,flash:.2});
    system.update(80+cycle,{x:cycle*4+3,y:1.3,z:-400-cycle*7},.7,2);
    assert.deepEqual(mesh.position.toArray(),[cycle*4+3,0,-400-cycle*7]);
    assert.equal(system.uniforms.highQuality.value,1);assert.equal(normal.anisotropy,16);close(system.uniforms.reflectionTexel.value,1/1536,'High reflection resolution');
    assert.equal(emit(35,32).size,32);
    const upperHalf=ripples.slice(16).map(value=>value.toArray());
    system.setQuality(false);system.setWeather(null);cursor%=16;
    assert.ok(mesh.geometry===original&&original.attributes.position===position);
    assert.equal(Buffer.compare(originalBytes,Buffer.from(position.array.buffer)),0,'Standard vertex bytes survive every High cycle');
    assert.deepEqual(mesh.position.toArray(),[0,0,0]);assert.equal(mesh.rotation.x,-Math.PI/2);
    assert.equal(system.uniforms.highQuality.value,0);assert.equal(normal.anisotropy,8);close(system.uniforms.reflectionTexel.value,1/standardSize,'Standard reflection resolution');
    assert.equal(system.uniforms.distortionScale.value,1.35);assert.equal(system.uniforms.wind.value,1);assert.equal(system.uniforms.rainAmount.value,0);
    system.setTraffic([{x:10,z:-400,heading:0,speed:2.315,length:15}]);
    system.update(90+cycle,{x:39,y:.3,z:-490},.4,-1.9);
    assert.deepEqual(mesh.position.toArray(),[0,0,0],'Standard keeps its original fixed water transform');
    for(const [x,z] of [[10,-407.275],[39,-490],[-.4,0],[127,-901]])close(system.heightAt(x,z,90+cycle),waveHeight(x,z,90+cycle),'unchanged Standard surface');
    assert.equal(emit(19,16).size,16);assert.deepEqual(ripples.slice(16).map(value=>value.toArray()),upperHalf,'Standard never writes the inactive upper half');
    assert.ok(system.uniforms.ripples.value===ripples&&system.uniforms.rippleDirections.value===directions);
    assert.ok(mesh.material===material);assert.equal(scene.children.length,1);
  }
  system.setQuality(true);assert.ok(mesh.geometry===cached);assert.equal(geometryIds.size,2,'one original geometry and one cached High geometry across repeated switches');
});

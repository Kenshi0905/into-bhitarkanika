import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleEstuary,sampleLaunchWake,nearWaterAxis,ESTUARY_WAVES,ESTUARY_GLSL} from './dist/water-motion.js';

// Evaluate the actual scalar GLSL wake body using JS scalar built-ins. This
// catches CPU/shader drift without duplicating a third copy of the wake maths.
const scalarBody=ESTUARY_GLSL.match(/vec3 launchWakeLocal\([^)]*\)\{([\s\S]*?)\n\}\n\/\/ The same field/)[1].replace(/\bfloat\b/g,'let');
const derivativeBody=ESTUARY_GLSL.match(/float wakeSmoothDerivative\([^)]*\)\{([^}]+)\}/)[1].replace(/\bfloat\b/g,'let');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smoothstep=(a,b,x)=>{const v=clamp((x-a)/(b-a),0,1);return v*v*(3-2*v);};
const wakeSmoothDerivative=new Function('clamp','a','b','x',derivativeBody).bind(null,clamp);
const shaderLocal=new Function('abs','sign','min','max','pow','sin','cos','exp','smoothstep','wakeSmoothDerivative','vec3','along','cross','speed','hullLength','t',scalarBody)
  .bind(null,Math.abs,Math.sign,Math.min,Math.max,Math.pow,Math.sin,Math.cos,Math.exp,smoothstep,wakeSmoothDerivative,(...v)=>v);

function wakeSamples(){
  const samples=[];
  for(let i=0;i<840;i++){
    const f=(i*.61803398875)%1,g=(i*.41421356237+.07)%1,length=7+(i%4)*2.67,speed=.055+(i%11)*.27,reach=19+speed*19;
    let along,cross;
    if(i%4===0){along=length*.485-2.8+f*4;cross=.07+g*3.02;}
    else if(i%4===1){along=length*(-.43+f*.86);cross=length*.107*Math.pow(Math.cos(along/length*Math.PI),.48)-.28+g*.75;}
    else{
      let r=-.34+f*reach*.99;if(Math.abs(r)<.01)r=.013;
      along=-length*.485-r;
      cross=i%4===2?(.85+Math.max(r,0)*.087)*(.05+g*.9):.8+Math.max(r,0)*.33+(.56+Math.max(r,0)*.041)*(g*3-1.5);
    }
    if(i%3)cross=-cross;
    const yaw=i*.137,dx=Math.cos(yaw),dz=Math.sin(yaw),sx=dz,sz=-dx,ox=21.3,oz=-470.7;
    const velocity=i%2?-speed:speed,reverse=velocity<0?-1:1;
    samples.push({x:ox+dx*along+sx*cross,z:oz+dz*along+sz*cross,ox,oz,dx:dx*reverse,dz:dz*reverse,velocity,length,t:i*.73,along,cross});
  }
  return samples;
}

test('High wave normals agree with the displacement used for buoyancy across the route',()=>{
  let worst=0,maxHeight=0,maxSlope=0;
  for(let i=0;i<450;i++){
    const x=Math.sin(i*17.9)*240,z=-i*3.7,t=i*.193,wind=.9+(i%7)*.1,a=i*.072,wx=Math.cos(a),wz=Math.sin(a),h=.0001;
    const field=sampleEstuary(x,z,t,wind,wx,wz);
    const dx=(sampleEstuary(x+h,z,t,wind,wx,wz).height-sampleEstuary(x-h,z,t,wind,wx,wz).height)/(2*h);
    const dz=(sampleEstuary(x,z+h,t,wind,wx,wz).height-sampleEstuary(x,z-h,t,wind,wx,wz).height)/(2*h);
    worst=Math.max(worst,Math.abs(dx-field.dx),Math.abs(dz-field.dz));maxHeight=Math.max(maxHeight,Math.abs(field.height));maxSlope=Math.max(maxSlope,Math.hypot(field.dx,field.dz));
  }
  assert.ok(worst<1e-7,`normal/displacement error ${worst}`);assert.ok(maxHeight<.15);assert.ok(maxSlope<.20);
});
test('the estuary stays temporally continuous and calm without locking waves to one direction',()=>{
  assert.ok(new Set(ESTUARY_WAVES.map(w=>w[3])).size>=6);
  let maxStep=0;
  for(let i=0;i<900;i++){
    const t=i/60,a=sampleEstuary(-12,-480,t,1.45),b=sampleEstuary(-12,-480,t+1/120,1.45);
    maxStep=Math.max(maxStep,Math.abs(a.height-b.height));
    assert.deepEqual(sampleEstuary(20,-200,t,0),{height:0,dx:0,dz:0});
  }
  assert.ok(maxStep<.003,`120Hz height step ${maxStep}`);
  for(const wave of ESTUARY_WAVES)for(const value of wave)assert.ok(ESTUARY_GLSL.includes(value.toFixed(8)));
});
test('near-water tessellation resolves the bow and remains symmetric and bounded offshore',()=>{
  const axis=nearWaterAxis();assert.equal(axis.length,257);assert.equal(axis[0],-1200);assert.equal(axis.at(-1),1200);
  let near=0;for(let i=1;i<axis.length;i++){
    assert.ok(Number.isFinite(axis[i])&&axis[i]>axis[i-1]);
    assert.ok(Math.abs(axis[i]+axis[axis.length-1-i])<1e-9);
    if(Math.abs(axis[i])<58&&Math.abs(axis[i-1])<58){assert.ok(axis[i]-axis[i-1]<.64);near++;}
  }
  assert.ok(near>180);assert.ok((axis.length-1)**2*2<140000);
});
test('wake normals differentiate the displaced bow, hull, centre and stern arms in either direction',()=>{
  let worst=0;
  for(const p of wakeSamples()){
    const sample=(x,z)=>sampleLaunchWake(x,z,p.ox,p.oz,p.dx,p.dz,p.velocity,p.length,p.t);
    const h=1e-5,value=sample(p.x,p.z),dx=(sample(p.x+h,p.z).height-sample(p.x-h,p.z).height)/(2*h),dz=(sample(p.x,p.z+h).height-sample(p.x,p.z-h).height)/(2*h);
    const error=Math.max(Math.abs(dx-value.dx),Math.abs(dz-value.dz));worst=Math.max(worst,error);
    assert.ok(error<2e-8,`wake derivative error ${error} at along ${p.along}, cross ${p.cross}`);
    assert.ok(Math.abs(value.height)<.14);assert.ok(Math.hypot(value.dx,value.dz)<.6);
  }
  const centre=sampleLaunchWake(0,15,0,0,0,-1,2.315,15,0);
  assert.ok(centre.dx>.0118&&centre.dx<.012);assert.ok(centre.dz<-.0077&&centre.dz>-.0078);
  assert.ok(worst<2e-8);
});
test('the CPU contact height and analytic normals match the actual scalar GLSL field',()=>{
  for(const p of wakeSamples()){
    const value=sampleLaunchWake(p.x,p.z,p.ox,p.oz,p.dx,p.dz,p.velocity,p.length,p.t),reverse=p.velocity<0?-1:1,dx=p.dx*reverse,dz=p.dz*reverse;
    const local=shaderLocal(p.along,p.cross,Math.abs(p.velocity),p.length,p.t),gx=dx*local[0]+dz*local[1],gz=dz*local[0]-dx*local[1];
    assert.ok(Math.abs(value.height-local[2])<1e-12);assert.ok(Math.abs(value.dx-gx)<1e-12);assert.ok(Math.abs(value.dz-gz)<1e-12);
  }
});
test('wake displacement keeps its existing scale, reverse symmetry and stationary limits',()=>{
  const out={height:99,dx:99,dz:99};
  for(const speed of [0,.034,-.034]){
    assert.equal(sampleLaunchWake(0,-7.275,0,0,0,-1,speed,15,0,out),out);
    assert.deepEqual(out,{height:0,dx:0,dz:0});
  }
  assert.deepEqual(sampleLaunchWake(0,0,0,0,0,-1,2.315,0,0),{height:0,dx:0,dz:0});
  assert.ok(Object.values(sampleLaunchWake(1000,1000,0,0,0,-1,2.315,15,0)).every(value=>value===0));
  const fixtures=[[0,-7.275,.083],[2,11,.044134226458069165],[0,15,.003299730912577943],[3.35,15,-.0018653619902454074]];
  for(const [x,z,height] of fixtures){
    const forward=sampleLaunchWake(x,z,0,0,0,-1,2.315,15,0),reverse=sampleLaunchWake(x,z,0,0,0,1,-2.315,15,0);
    assert.ok(Math.abs(forward.height-height)<1e-12);
    for(const key of ['height','dx','dz'])assert.ok(Math.abs(reverse[key]-forward[key])<1e-15);
  }
});

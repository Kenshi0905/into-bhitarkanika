import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const threeURL=new URL('./dist/vendor/three.module.js',import.meta.url).href;
const T=await import(threeURL),source=(await readFile(new URL('./dist/high-post.js',import.meta.url),'utf8')).replace("from 'three'",`from '${threeURL}'`);
const {createHighPost}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function fixture(options={}){
 const scene=new T.Scene();scene.name='Main fixture';
 const camera=new T.PerspectiveCamera(48,16/9,.15,2600);camera.position.set(12,10,25);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const originalTarget={name:'Caller framebuffer'},events=[],gl={MAX_RENDERBUFFER_SIZE:1,FRAMEBUFFER:2,FRAMEBUFFER_COMPLETE:3};
 let target=originalTarget,checks=0,postDraws=0,allocations=0,handlerCalls=0;
 gl.getParameter=()=>options.renderbufferLimit??8192;
 gl.checkFramebufferStatus=()=>{checks++;return checks===options.badFramebuffer?0:gl.FRAMEBUFFER_COMPLETE;};
 const handler=()=>handlerCalls++;
 const renderer={
  extensions:{has:()=>options.float!==false},capabilities:{maxTextureSize:options.textureLimit??8192,maxSamples:4},
  debug:{checkShaderErrors:false,onShaderError:handler},toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1.15,
  getContext:()=>gl,getRenderTarget:()=>target,
  setRenderTarget(value){
   if(value!==originalTarget){allocations++;if(allocations===options.throwAllocation)throw new Error('Target allocation failed');}
   target=value;
  },
  render(value){
   const isMain=value===scene;events.push({main:isMain,target,tone:this.toneMapping});
   if(isMain&&options.throwScene)throw new Error('Scene failure');
   if(!isMain){postDraws++;if(postDraws===options.badShader)this.debug.onShaderError?.(gl,{},null,null);if(postDraws===options.throwPost)throw new Error('Post failure');}
  },
  setPixelRatio(){throw new Error('Post must not alter scene resolution');},
 };
 const post=createHighPost(renderer),draw=()=>post.render(scene,camera,new T.Vector3(-.3,.4,-.8).normalize());
 return {post,renderer,scene,camera,events,draw,originalTarget,handler,stats:()=>({checks,postDraws,allocations,handlerCalls})};
}

test('supported post retains full resolution, four passes, caller target and tone mapping',()=>{
 const f=fixture();f.post.setSize(2560,1440);f.draw();
 assert.equal(f.events.length,5);assert.equal(f.events[0].main,true);
 assert.equal(f.events[0].target.width,2560);assert.equal(f.events[0].target.height,1440);
 assert.equal(f.events[1].target.width,640);assert.equal(f.events[1].target.height,360);
 assert.equal(f.events.at(-1).target,f.originalTarget);assert.ok(f.events.every(e=>e.tone===T.NoToneMapping));
 assert.equal(f.renderer.getRenderTarget(),f.originalTarget);assert.equal(f.renderer.toneMapping,T.ACESFilmicToneMapping);
 assert.equal(f.stats().checks,3);f.draw();assert.equal(f.stats().checks,3,'validate only after allocation, not every frame');
 assert.equal(f.post.getStats().passes,4);assert.equal(f.post.getStats().reason,null);
 f.post.dispose();f.post.dispose();
});

test('missing float support directly renders without creating HDR work',()=>{
 const f=fixture({float:false});f.post.setSize(2560,1440);f.draw();
 assert.equal(f.events.length,1);assert.equal(f.events[0].target,f.originalTarget);
 assert.equal(f.events[0].tone,T.ACESFilmicToneMapping);assert.equal(f.stats().checks,0);
 assert.equal(f.post.getStats().passes,0);assert.match(f.post.getStats().reason,/HDR targets unavailable/);
});

test('oversized HDR targets fall back without reducing scene DPR and recover after a valid resize',()=>{
 for(const options of [{textureLimit:2048},{renderbufferLimit:2048}]){
  const f=fixture(options);f.post.setSize(2880,1800);f.draw();
  assert.equal(f.stats().allocations,0);assert.equal(f.events.length,1);assert.equal(f.post.supported,false);
  assert.match(f.post.getStats().reason,/2880 × 1800 exceeds the 2048px/);
  assert.equal(f.events[0].tone,T.ACESFilmicToneMapping);
  f.post.setSize(1920,1080);f.draw();assert.equal(f.post.supported,true);assert.equal(f.post.getStats().width,1920);assert.equal(f.post.getStats().passes,4);
 }
});

test('incomplete framebuffers and thrown allocations produce a same-frame direct image',()=>{
 for(const options of [{badFramebuffer:2},{throwAllocation:1}]){
  const f=fixture(options);f.post.setSize(1920,1080);f.draw();
  assert.equal(f.events.length,1);assert.equal(f.events[0].main,true);assert.equal(f.events[0].target,f.originalTarget);
  assert.equal(f.events[0].tone,T.ACESFilmicToneMapping);assert.equal(f.post.supported,false);
  assert.match(f.post.getStats().reason,/HDR (framebuffer unavailable|target allocation failed)/);
  const before=f.stats().allocations;f.draw();assert.equal(f.stats().allocations,before,'do not retry a broken allocation every frame');
  f.post.setSize(1280,720);f.draw();assert.equal(f.post.supported,true,'a new target size can recover the allocation');
 }
});

test('post shader failures restore the existing diagnostic hook and redraw directly',()=>{
 const f=fixture({badShader:2});f.post.setSize(1920,1080);f.draw();
 assert.equal(f.stats().handlerCalls,1);assert.equal(f.renderer.debug.onShaderError,f.handler);assert.equal(f.renderer.debug.checkShaderErrors,false);
 assert.equal(f.events.filter(e=>e.main).length,2);assert.equal(f.events.at(-1).target,f.originalTarget);
 assert.equal(f.events.at(-1).tone,T.ACESFilmicToneMapping);assert.match(f.post.getStats().reason,/Post-processing shader unavailable/);
 const count=f.stats().postDraws;f.draw();assert.equal(f.stats().postDraws,count,'retain direct rendering after a failed shader');
});

test('post exceptions recover while unrelated scene failures remain visible to the app',()=>{
 const post=fixture({throwPost:2});post.post.setSize(1280,720);post.draw();
 assert.equal(post.events.at(-1).main,true);assert.match(post.post.getStats().reason,/Post-processing could not continue/);
 assert.equal(post.renderer.debug.onShaderError,post.handler);
 const scene=fixture({throwScene:true});scene.post.setSize(1280,720);assert.throws(scene.draw,/Scene failure/);
 assert.equal(scene.renderer.getRenderTarget(),scene.originalTarget);assert.equal(scene.renderer.toneMapping,T.ACESFilmicToneMapping);
 assert.equal(scene.post.supported,true,'a scene error must not be misclassified as a post capability failure');
});

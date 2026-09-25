// Per-pass submission counts and CPU submission time. These are not GPU timings.
// Three's normal auto-reset hides shadow work and nested reflection renders.
export function createRenderProfile(renderer) {
  const originalRender=renderer.render;let originalShadow=renderer.shadowMap.render,boundShadow=renderer.shadowMap;
  renderer.info.autoReset=false;
  let active=false,depth=0,frame=null,last=null,samples=[],postActive=false;
  const empty=()=>({calls:0,triangles:0,cpuMs:0});
  const count=()=>({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
  const snapshot=p=>({...p});
  const add=(out,start,ms,exclude=[])=>{
    const end=count();out.calls+=end.calls-start.calls;out.triangles+=end.triangles-start.triangles;out.cpuMs+=ms;
    for(const p of exclude){out.calls-=p.calls;out.triangles-=p.triangles;out.cpuMs-=p.cpuMs;}
  };
  function shadowRender(...args){
    if(!active)return originalShadow.apply(this,args);
    const before=count(),start=performance.now();
    try{return originalShadow.apply(this,args);}finally{add(frame.shadow,before,performance.now()-start);}
  }
  renderer.shadowMap.render=shadowRender;
  renderer.render=function(...args){
    if(!active)return originalRender.apply(this,args);
    const nested=depth++>0,before=count(),shadow=snapshot(frame.shadow),reflection=snapshot(frame.reflection),start=performance.now();
    try{return originalRender.apply(this,args);}finally{
      depth--;const shadowDelta={};for(const key of ['calls','triangles','cpuMs'])shadowDelta[key]=frame.shadow[key]-shadow[key];
      const exclude=[shadowDelta];
      const delta={};for(const key of ['calls','triangles','cpuMs'])delta[key]=frame.reflection[key]-reflection[key];exclude.push(delta);
      add(postActive?frame.post:nested?frame.reflection:frame.main,before,performance.now()-start,exclude);
    }
  };
  return {
    begin(){renderer.info.reset();frame={main:empty(),reflection:empty(),shadow:empty(),post:empty()};active=true;},
    post(fn){const previous=postActive;postActive=true;try{return fn();}finally{postActive=previous;}},
    rebind(){if(renderer.shadowMap!==boundShadow){boundShadow=renderer.shadowMap;originalShadow=boundShadow.render;boundShadow.render=shadowRender;}renderer.info.autoReset=false;samples=[];last=null;},
    end(){active=false;last=frame;samples.push(frame);if(samples.length>60)samples.shift();},
    reset(){samples=[];last=null;},
    getStats(){
      if(!last)return null;
      const result={samples:samples.length,timing:'CPU submission, not GPU',total:empty()};
      for(const pass of ['main','reflection','shadow','post']){
        const value=empty();for(const sample of samples)for(const key of ['calls','triangles','cpuMs'])value[key]+=sample[pass][key]/samples.length;
        value.calls=Math.round(value.calls);value.triangles=Math.round(value.triangles);value.cpuMs=+value.cpuMs.toFixed(2);result[pass]=value;
        for(const key of ['calls','triangles','cpuMs'])result.total[key]+=value[key];
      }
      result.total.cpuMs=+result.total.cpuMs.toFixed(2);return result;
    }
  };
}

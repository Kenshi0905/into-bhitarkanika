import * as T from 'three';

// One full-resolution HDR scene, two quarter-resolution highlight passes, and
// one crisp composite. The HTML interface never passes through this pipeline.
export function createHighPost(renderer){
  const supported=renderer.extensions.has('EXT_color_buffer_float');
  if(!supported)return {supported:false,reason:'HDR targets unavailable',setSize(){},setLighting(){},render(scene,camera){renderer.render(scene,camera);},getStats(){return {supported:false,passes:0,reason:'HDR targets unavailable',mode:'direct'};},dispose(){}};
  const gl=renderer.getContext(),targetLimit=Math.min(renderer.capabilities.maxTextureSize,gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:true,samples:Math.min(2,renderer.capabilities.maxSamples)});
  target.texture.name='High linear scene';target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);
  const glowA=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType,depthBuffer:false}),glowB=glowA.clone();
  const screenScene=new T.Scene(),screenCamera=new T.OrthographicCamera(-1,1,1,-1,0,1);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
  const vertex='varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position,1.);}';
  const common={vertexShader:vertex,depthWrite:false,depthTest:false,toneMapped:false};
  const extract=new T.ShaderMaterial({...common,uniforms:{source:{value:target.texture}},fragmentShader:`varying vec2 vUv;uniform sampler2D source;
    void main(){vec3 c=texture2D(source,vUv).rgb;float l=dot(c,vec3(.2126,.7152,.0722));float a=smoothstep(1.5,3.4,l);gl_FragColor=vec4(c*a,1.);}`});
  const blur=new T.ShaderMaterial({...common,uniforms:{source:{value:glowA.texture},stepUV:{value:new T.Vector2()}},fragmentShader:`varying vec2 vUv;uniform sampler2D source;uniform vec2 stepUV;
    void main(){vec3 c=texture2D(source,vUv).rgb*.227027;c+=(texture2D(source,vUv+stepUV*1.384615).rgb+texture2D(source,vUv-stepUV*1.384615).rgb)*.316216;c+=(texture2D(source,vUv+stepUV*3.230769).rgb+texture2D(source,vUv-stepUV*3.230769).rgb)*.07027;gl_FragColor=vec4(c,1.);}`});
  const composite=new T.ShaderMaterial({...common,uniforms:{source:{value:target.texture},bloom:{value:glowA.texture},depthMap:{value:target.depthTexture},pixel:{value:new T.Vector2()},sunUV:{value:new T.Vector2()},sunVisible:{value:0},sunTint:{value:new T.Color()},shaftStrength:{value:0},bloomStrength:{value:.035},exposure:{value:1},nearClip:{value:.15},farClip:{value:2600},gradeWarmth:{value:0}},fragmentShader:`
    varying vec2 vUv;uniform sampler2D source,bloom,depthMap;uniform vec2 pixel,sunUV;uniform vec3 sunTint;
    uniform float sunVisible,shaftStrength,bloomStrength,exposure,nearClip,farClip,gradeWarmth;
    float distanceAt(vec2 uv){float d=texture2D(depthMap,uv).x;return nearClip*farClip/(farClip+d*(nearClip-farClip));}
    vec3 aces(vec3 c){return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
    void main(){
      vec3 color=texture2D(source,vUv).rgb;float depth=texture2D(depthMap,vUv).r;
      // Restrained depth contact shading only within local discontinuities.
      // Distance gating avoids outlining trees against sky or blurring geometry.
      if(depth<.99999){float z=distanceAt(vUv),occlusion=0.;
        for(int i=0;i<6;i++){float a=float(i)*1.04719755;vec2 d=vec2(cos(a),sin(a))*pixel*clamp(70./max(z,1.),1.0,5.0);float dz=z-distanceAt(vUv+d);
          occlusion+=smoothstep(.045,.22,dz)*(1.-smoothstep(.25,1.3,dz));}
        color*=1.-occlusion*(.085/6.);}
      // Radial integration samples real scene depth: banks, leaves and the boat
      // occlude the shafts. The mask moves with the projected key light.
      if(sunVisible>.001&&shaftStrength>.001){vec2 delta=(sunUV-vUv)*.055;vec2 uv=vUv;float shafts=0.,weight=1.;
        for(int i=0;i<16;i++){uv+=delta;float inside=step(0.,uv.x)*step(0.,uv.y)*step(uv.x,1.)*step(uv.y,1.);
          float sky=step(.999997,texture2D(depthMap,clamp(uv,vec2(0.),vec2(1.))).r);
          float glow=exp(-dot(uv-sunUV,uv-sunUV)*9.);shafts+=sky*inside*glow*weight;weight*=.92;}
        color+=sunTint*shafts*.004*shaftStrength*sunVisible*(1.-smoothstep(.55,1.2,length(vUv-sunUV)));}
      color+=texture2D(bloom,vUv).rgb*bloomStrength;
      // Gentle warm highlights / cool shaded mids; a lifted toe retains night
      // foliage. This does not alter the UI or apply blur to the main image.
      float l=dot(color,vec3(.2126,.7152,.0722));color*=mix(vec3(.975,1.,1.025),vec3(1.026,1.004,.974),smoothstep(.1,.8,l)*gradeWarmth);
      color=aces(max(color,vec3(0.))*exposure);color=mix(color*12.92,1.055*pow(max(color,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),color));
      gl_FragColor=vec4(color,1.);
    }`});
  const triangle=new T.Mesh(geometry,extract);triangle.frustumCulled=false;screenScene.add(triangle);
  const sunPosition=new T.Vector3(),viewDirection=new T.Vector3();let width=1,height=1,profile={},sizeReason=null,failureReason=null,failureKind=null,validate=true,disposed=false;
  const reason=()=>sizeReason||failureReason;
  function releaseTargets(){target.dispose();glowA.dispose();glowB.dispose();}
  function fail(message,kind){failureReason=message;failureKind=kind;releaseTargets();}
  function validateTargets(){
    if(!validate)return !reason();
    validate=false;
    try{
      for(const destination of [target,glowA,glowB]){
        renderer.setRenderTarget(destination);
        if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){fail('HDR framebuffer unavailable; using direct rendering.','framebuffer');return false;}
      }
      return true;
    }catch(error){fail('HDR target allocation failed; using direct rendering.','framebuffer');return false;}
  }
  function draw(material,destination){
    triangle.material=material;renderer.setRenderTarget(destination);
    // Three reports failed links through this callback instead of throwing.
    // Scope interception to our own fullscreen passes: scene/material failures
    // continue to the application's existing fallback, and its handler survives.
    const debug=renderer.debug,priorHandler=debug?.onShaderError,priorCheck=debug?.checkShaderErrors;let shaderFailed=false;
    if(debug){debug.checkShaderErrors=true;debug.onShaderError=(...args)=>{shaderFailed=true;priorHandler?.(...args);};}
    try{renderer.render(screenScene,screenCamera);}
    finally{if(debug){debug.onShaderError=priorHandler;debug.checkShaderErrors=priorCheck;}}
    if(shaderFailed)throw new Error('Post-processing shader unavailable; using direct rendering.');
  }
  return {get supported(){return !disposed&&!reason();},get reason(){return reason();},
    setSize(w,h){
      if(disposed)return;
      const nextWidth=Math.max(1,Math.floor(w)),nextHeight=Math.max(1,Math.floor(h)),changed=width!==nextWidth||height!==nextHeight;
      width=nextWidth;height=nextHeight;
      sizeReason=!Number.isFinite(width)||!Number.isFinite(height)||width>targetLimit||height>targetLimit?`HDR target ${width} × ${height} exceeds the ${targetLimit}px graphics limit; using direct rendering.`:null;
      if(sizeReason){releaseTargets();validate=true;return;}
      if(changed&&failureKind==='framebuffer'){failureReason=null;failureKind=null;}
      if(failureReason)return;
      target.setSize(width,height);glowA.setSize(Math.max(1,width>>2),Math.max(1,height>>2));glowB.setSize(glowA.width,glowA.height);composite.uniforms.pixel.value.set(1/width,1/height);validate=true;
    },
    setLighting(value){profile=value??{};composite.uniforms.shaftStrength.value=profile.shaftStrength??.35;composite.uniforms.bloomStrength.value=profile.bloomStrength??.035;composite.uniforms.gradeWarmth.value=profile.gradeWarmth??.7;},
    render(scene,camera,lightDirection,renderProfile){
      if(disposed||reason()){renderer.render(scene,camera);return;}
      const originalTarget=renderer.getRenderTarget(),originalTone=renderer.toneMapping;
      let fallback=false;
      try{
        if(!validateTargets()){fallback=true;}
        else{
        // Tone mapping happens once, after the selective HDR highlights.
        renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(target);renderer.render(scene,camera);
        composite.uniforms.exposure.value=renderer.toneMappingExposure;composite.uniforms.nearClip.value=camera.near;composite.uniforms.farClip.value=camera.far;
        sunPosition.copy(camera.position).addScaledVector(lightDirection,1000).project(camera);composite.uniforms.sunUV.value.set(sunPosition.x*.5+.5,sunPosition.y*.5+.5);
        camera.getWorldDirection(viewDirection);composite.uniforms.sunVisible.value=T.MathUtils.smoothstep(viewDirection.dot(lightDirection),.05,.35);
        composite.uniforms.sunTint.value.set(profile.sunColor??'#ffe0b8');
        const post=()=>{draw(extract,glowA);blur.uniforms.source.value=glowA.texture;blur.uniforms.stepUV.value.set(1/glowA.width,0);draw(blur,glowB);blur.uniforms.source.value=glowB.texture;blur.uniforms.stepUV.value.set(0,1/glowB.height);draw(blur,glowA);draw(composite,originalTarget);};
        try{if(renderProfile)renderProfile.post(post);else post();}
        catch(error){fail(error.message?.startsWith('Post-processing shader')?error.message:'Post-processing could not continue; using direct rendering.','post');fallback=true;}
        }
      }finally{renderer.setRenderTarget(originalTarget);renderer.toneMapping=originalTone;}
      // Redraw at the caller's unchanged resolution and normal tone mapping in
      // this same frame. A failed post pass must never leave a black canvas.
      if(fallback)renderer.render(scene,camera);
    },
    getStats(){return {supported:!disposed&&!reason(),passes:disposed||reason()?0:4,reason:reason(),mode:disposed||reason()?'direct':'hdr',width,height,bloomWidth:glowA.width,bloomHeight:glowA.height,samples:target.samples};},
    dispose(){if(disposed)return;disposed=true;releaseTargets();geometry.dispose();extract.dispose();blur.dispose();composite.dispose();}
  };
}

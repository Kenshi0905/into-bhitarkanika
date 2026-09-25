import * as T from 'three';

// Height-aware haze uses each surface's real depth, including the reflected scene.
// Shader variants are cached; Standard keeps its original shader and material state.
export function createHighAtmosphere({scene}){
  const patches=new Map(),density={value:.00085},cameraHeight={value:10};
  let enabled=false;
  function install(material){
    if(!(material?.isMeshStandardMaterial||material?.isMeshLambertMaterial)||patches.has(material))return;
    const original={compile:material.onBeforeCompile,key:material.customProgramCacheKey,defines:{...material.defines},dithering:material.dithering};
    patches.set(material,original);
    material.onBeforeCompile=function(shader,renderer){
      original.compile.call(this,shader,renderer);
      if(!this.defines?.BHITARKANIKA_HIGH_HAZE)return;
      shader.uniforms.bhitarHazeDensity=density;shader.uniforms.bhitarCameraHeight=cameraHeight;
      shader.vertexShader='varying float vBhitarHeight;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>
        vec4 bhitarWorld=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          bhitarWorld=instanceMatrix*bhitarWorld;
        #endif
        vBhitarHeight=(modelMatrix*bhitarWorld).y;`);
      shader.fragmentShader='varying float vBhitarHeight;uniform float bhitarHazeDensity;uniform float bhitarCameraHeight;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',T.ShaderChunk.fog_fragment.replace(
        'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
        `float nearClearance=max(vFogDepth-28.0,0.0);
         float lowAir=.35*exp(-max(bhitarCameraHeight,0.0)*.09)+.65*exp(-max(vBhitarHeight,0.0)*.09);
         float creekHaze=min(.18,1.0-exp(-nearClearance*bhitarHazeDensity*lowAir));
         fogFactor=1.0-(1.0-fogFactor)*(1.0-creekHaze);
         gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);`
      ));
    };
    material.customProgramCacheKey=function(){return original.key.call(this)+'|creek-atmosphere:'+Boolean(this.defines?.BHITARKANIKA_HIGH_HAZE);};
  }
  return {
    setEnabled(value){
      enabled=Boolean(value);
      if(enabled)scene.traverse(object=>{if(object.material)for(const m of Array.isArray(object.material)?object.material:[object.material])install(m);});
      for(const [material,original] of patches){
        const current=Boolean(material.defines?.BHITARKANIKA_HIGH_HAZE);if(current===enabled)continue;
        material.defines={...original.defines,...(enabled?{BHITARKANIKA_HIGH_HAZE:1}:{})};material.dithering=enabled?true:original.dithering;material.needsUpdate=true;
      }
    },
    setLighting(index){density.value=index===1?.0021:index===2?.0008:.00085;},
    update(time,camera){cameraHeight.value=camera.position.y;},
    dispose(){this.setEnabled(false);for(const [material,original] of patches){material.onBeforeCompile=original.compile;material.customProgramCacheKey=original.key;material.defines=original.defines;material.dithering=original.dithering;material.needsUpdate=true;}patches.clear();}
  };
}

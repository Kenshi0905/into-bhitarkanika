import * as T from 'three';

// Height-aware haze uses each surface's real depth, including the reflected scene.
// Shader variants are cached; Standard keeps its original shader and material state.
export function weatherMaterialProfile(material){
  const hint=String(material.userData?.weatherSurface??material.userData?.boatSurface??material.name??'').toLowerCase();
  let kind=hint;
  if(/canvas|shirt|trouser|cloth|fabric|hat/.test(hint))kind='cloth';
  else if(/wood|dark|timber/.test(hint))kind='wood';
  else if(/leaf|leaves|foliage/.test(hint)||material.alphaTest>.2)kind='leaf';
  else if(/bark|root/.test(hint))kind='bark';
  const values={wood:[.47,.17],cloth:[.78,.13],rope:[.84,.17],rubber:[.82,.055],paint:[.35,.06],skin:[.53,.03],feathers:[.61,.08],hide:[.44,.08],leaf:[.43,.085],bark:[.60,.14]};
  const [roughness,darken]=values[kind]??[.66,.065];return {kind,roughness,darken};
}

export function createHighAtmosphere({scene}){
  const patches=new Map(),density={value:.00085},cameraHeight={value:10},wetness={value:0},wind={value:new T.Vector2()},clock={value:0};
  let enabled=false;
  function install(material){
    if(!(material?.isMeshStandardMaterial||material?.isMeshLambertMaterial)||patches.has(material))return;
    const original={compile:material.onBeforeCompile,key:material.customProgramCacheKey,defines:{...material.defines},hadDefines:material.defines!==undefined,dithering:material.dithering};
    const surface=weatherMaterialProfile(material);
    patches.set(material,original);
    material.onBeforeCompile=function(shader,renderer){
      original.compile.call(this,shader,renderer);
      if(!this.defines?.BHITARKANIKA_HIGH_HAZE)return;
      shader.uniforms.bhitarHazeDensity=density;shader.uniforms.bhitarCameraHeight=cameraHeight;shader.uniforms.bhitarWetness=wetness;shader.uniforms.bhitarWind=wind;shader.uniforms.bhitarWeatherTime=clock;
      shader.vertexShader='varying float vBhitarHeight;varying vec2 vBhitarWeatherXZ;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>',`#include <fog_vertex>
        vec4 bhitarWorld=vec4(transformed,1.0);
        #ifdef USE_INSTANCING
          bhitarWorld=instanceMatrix*bhitarWorld;
        #endif
        vec3 bhitarPosition=(modelMatrix*bhitarWorld).xyz;
        vBhitarHeight=bhitarPosition.y;vBhitarWeatherXZ=bhitarPosition.xz;`);
      shader.fragmentShader='varying float vBhitarHeight;varying vec2 vBhitarWeatherXZ;uniform float bhitarHazeDensity;uniform float bhitarCameraHeight;uniform float bhitarWetness;uniform vec2 bhitarWind;uniform float bhitarWeatherTime;\n'+shader.fragmentShader;
      if(material.isMeshStandardMaterial){
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
         diffuseColor.rgb*=1.0-bhitarWetness*${surface.darken.toFixed(4)};`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
         float bhitarWetExposure=.48+.52*clamp(inverseTransformDirection(normal,viewMatrix).y,0.0,1.0);
         roughnessFactor=mix(roughnessFactor,min(roughnessFactor,${surface.roughness.toFixed(4)}),bhitarWetness*bhitarWetExposure);`);
      }
      shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',T.ShaderChunk.fog_fragment.replace(
        'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );',
        `float nearClearance=max(vFogDepth-34.0,0.0);
         float lowAir=.25*exp(-max(bhitarCameraHeight,0.0)*.16)+.75*exp(-max(vBhitarHeight,0.0)*.34);
         vec2 mistTravel=vBhitarWeatherXZ*.018-bhitarWind*bhitarWeatherTime*.009;
         float pocket=.5+.29*sin(mistTravel.x*.74+sin(mistTravel.y*.39))+.21*sin(mistTravel.y*1.13-mistTravel.x*.28+1.7);
         float driftLayer=.08+1.62*smoothstep(.41,.77,pocket);
         float creekHaze=min(.30,1.0-exp(-nearClearance*bhitarHazeDensity*lowAir*driftLayer));
         fogFactor=1.0-(1.0-fogFactor)*(1.0-creekHaze);
         gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,fogFactor);`
      ));
    };
    material.customProgramCacheKey=function(){return original.key.call(this)+'|creek-atmosphere-v3:'+Boolean(this.defines?.BHITARKANIKA_HIGH_HAZE)+':'+surface.kind+':'+surface.roughness;};
    original.highCompile=material.onBeforeCompile;original.highKey=material.customProgramCacheKey;
  }
  return {
    setEnabled(value){
      enabled=Boolean(value);
      if(enabled)scene.traverse(object=>{if(object.material)for(const m of Array.isArray(object.material)?object.material:[object.material])install(m);});
      for(const [material,original] of patches){
        const current=Boolean(material.defines?.BHITARKANIKA_HIGH_HAZE);if(current===enabled)continue;
        if(enabled)material.defines={...original.defines,BHITARKANIKA_HIGH_HAZE:1};
        else if(original.hadDefines)material.defines=original.defines;else delete material.defines;
        material.onBeforeCompile=enabled?original.highCompile:original.compile;material.customProgramCacheKey=enabled?original.highKey:original.key;
        material.dithering=enabled?true:original.dithering;material.needsUpdate=true;
      }
    },
    setLighting(index){density.value=[.00155,.0040,.00070,.0028,.00040][index]??.00155;},
    setWeather(state){wetness.value=state?.wetness??0;wind.value.set((state?.wind?.x??0)*(state?.wind?.strength??0),(state?.wind?.z??0)*(state?.wind?.strength??0));clock.value=state?.time??0;},
    update(time,camera){cameraHeight.value=camera.position.y;},
    getStats(){return {patchedMaterials:patches.size,wetness:wetness.value};},
    dispose(){this.setEnabled(false);for(const [material,original] of patches){material.onBeforeCompile=original.compile;material.customProgramCacheKey=original.key;if(original.hadDefines)material.defines=original.defines;else delete material.defines;material.dithering=original.dithering;material.needsUpdate=true;}patches.clear();}
  };
}

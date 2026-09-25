import * as T from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Deterministic mipmapped textures are made only when High loads. Each tile
// describes metres of material, independent of the original hull/deck/rail UVs.
const TAU=Math.PI*2;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function surfaces(renderer){
 const textures=[],anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 function make(kind,height=false){
  const size=kind==='contact'?128:512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'),pixels=context.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=x/size,v=y/size,index=(y*size+x)*4;let value,red,green,blue;
   if(kind==='contact'){
    value=255;red=green=blue=255;
   }else if(kind==='wood'){
    // Fine low-contrast fibres instead of regular dark growth-ring stripes.
    const bend=Math.sin(u*TAU)*.018+Math.sin(u*TAU*3+v*TAU)*.006;
    const rings=Math.sin((v+bend)*TAU*37+Math.sin(u*TAU*2)*1.4),fibre=Math.sin((v+bend*.63)*TAU*113);
    const growth=Math.pow(Math.max(0,rings),11),variation=Math.sin(v*TAU*3+Math.sin(u*TAU)*.5);
    value=144-growth*12+fibre*4+variation*5;
    red=145-growth*7+variation*4+fibre;green=105-growth*6+variation*3+fibre;blue=70-growth*4+variation*2+fibre*.6;
   }else if(kind==='canvas'){
    const warp=Math.cos(u*TAU*128),weft=Math.cos(v*TAU*128),over=Math.cos(u*TAU*64)*Math.cos(v*TAU*64);
    value=150+warp*22+weft*22+over*8;red=green=blue=223+warp*3+weft*3+over;
   }else{
    const grain=Math.sin(u*TAU*71+Math.sin(v*TAU*13))*Math.sin(v*TAU*87);
    value=150+grain*13;red=green=blue=220+grain*5;
   }
   pixels.data[index]=height?value:red;pixels.data[index+1]=height?value:green;pixels.data[index+2]=height?value:blue;
   pixels.data[index+3]=kind==='contact'?255*Math.max(0,1-Math.hypot(u*2-1,v*2-1))**2:255;
  }
  context.putImageData(pixels,0,0);
  const texture=new T.CanvasTexture(canvas);texture.name='High boat '+kind+' '+(height?'height':'albedo');
  texture.colorSpace=height?T.NoColorSpace:T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.anisotropy=anisotropy;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;textures.push(texture);return texture;
 }
 return {wood:make('wood'),woodHeight:make('wood',true),canvas:make('canvas'),canvasHeight:make('canvas',true),rubber:make('rubber'),rubberHeight:make('rubber',true),contact:make('contact'),dispose(){textures.forEach(t=>t.dispose());}};
}

function physicalMapping(material,kind,underCanopy=false){
 const scale=kind==='wood'?'.25, 1.0':kind==='canvas'?'3.125, 3.125':'2.0, 2.0';
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBoatSurfacePosition; varying vec3 vBoatSurfaceNormal;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvBoatSurfacePosition=position; vBoatSurfaceNormal=normal;');
  shader.fragmentShader='varying vec3 vBoatSurfacePosition; varying vec3 vBoatSurfaceNormal;\n'+
   'vec2 boatMaterialUV(){\n vec3 n=abs(vBoatSurfaceNormal); vec3 p=vBoatSurfacePosition;\n'+
   ' vec2 projected=n.y>n.x&&n.y>n.z?p.zx:(n.x>n.z?p.zy:p.xy);\n vec2 uv=projected*vec2('+scale+');\n'+
   (kind==='wood'?' if(n.y>.8){float board=floor((p.x+.035)/.275);uv+=vec2(fract(sin(board*37.17+9.8)*182.37)*2.3,fract(sin(board*15.87+1.4)*281.9));}\n':'')+
   ' return uv;\n}\n'+shader.fragmentShader;
  for(const name of ['map_fragment','bumpmap_pars_fragment','roughnessmap_fragment']){
   shader.fragmentShader=shader.fragmentShader.replace('#include <'+name+'>',T.ShaderChunk[name].replaceAll('vMapUv','boatMaterialUV()').replaceAll('vBumpMapUv','boatMaterialUV()').replaceAll('vRoughnessMapUv','boatMaterialUV()'));
  }
  const finish=kind==='wood'?`
   if(abs(vBoatSurfaceNormal.y)>.95&&vBoatSurfacePosition.y>.65&&vBoatSurfacePosition.y<.77){
    float plank=(vBoatSurfacePosition.x+.035)/.275,board=floor(plank);
    float tone=.95+.09*fract(sin(board*37.17+9.8)*182.37);
    float edge=min(fract(plank),1.-fract(plank))*.275;
    float join=1.-smoothstep(.0011,.0011+max(fwidth(vBoatSurfacePosition.x),.0003),edge);
    diffuseColor.rgb*=tone*(1.-join*.16);
   }`:kind==='canvas'?`
   float clothVariation=.974+.018*sin(vBoatSurfacePosition.z*.71+vBoatSurfacePosition.x*.39)+.009*cos(vBoatSurfacePosition.z*1.61-vBoatSurfacePosition.x*.72);
   float hemWeather=smoothstep(1.72,2.12,abs(vBoatSurfacePosition.x))*.047;
   diffuseColor.rgb*=clothVariation-hemWeather;`:'';
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+finish);
  if(underCanopy&&kind==='wood'){
   // Approximate only the portion of diffuse skylight occluded by the existing
   // canopy. Direct sun and its real shadow map remain untouched. Open sides
   // retain fill, while central boards no longer receive a full open-sky dome.
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
    float coverAcross=1.-smoothstep(1.05,2.10,abs(vBoatSurfacePosition.x));
    float coverAlong=smoothstep(-4.40,-3.15,vBoatSurfacePosition.z)*(1.-smoothstep(3.75,5.10,vBoatSurfacePosition.z));
    float coverHeight=1.-smoothstep(1.75,3.32,vBoatSurfacePosition.y);
    reflectedLight.indirectDiffuse*=1.-.23*coverAcross*coverAlong*coverHeight;`);
  }
 };
 material.customProgramCacheKey=()=> 'bhitarkanika-boat-metres-'+kind+'-'+underCanopy+'-v3';
}

function fineDetails(materials){
 const group=new T.Group();group.name='High boat joinery and soft fenders';group.visible=false;
 const buckets=new Map();
 function add(geometry,material){if(!buckets.has(material))buckets.set(material,[]);buckets.get(material).push(geometry);}
 function curve(points,radius,material,segments=36){add(new T.TubeGeometry(new T.CatmullRomCurve3(points),segments,radius,5,false),material);}
 function box(size,point,material){const g=new T.BoxGeometry(...size);g.translate(...point);add(g,material);}
 // Board joins are subpixel-filtered material detail, not raised stripes or
 // repeated cross-marks. Only construction seams and existing fittings add mesh.
 // Sewn seams and edge cord follow the existing rounded canopy.
 const roofY=x=>3.37+.52*Math.cos(x/4.25*Math.PI);
 for(const z of [-3.86,-1.76,.4,2.55,4.67]){
  const points=Array.from({length:25},(_,i)=>{const x=(i/24-.5)*4.22;return V(x,roofY(x)+.008,z);});
  curve(points,.0035,materials.hem,28);
 }
 for(const side of [-1,1]){
  curve([V(side*2.125,3.37,-3.9),V(side*2.125,3.368,.4),V(side*2.125,3.37,4.7)],.011,materials.hem,18);
  // Narrow rubbing strakes reveal assembled planks without altering the hull.
  for(const angle of [.29,.44]){
   const points=[];for(let i=1;i<44;i++){
    const t=i/44,w=1.85*Math.pow(Math.sin(Math.PI*t),.48)+.035;
    points.push(V(side*(Math.cos(angle)*w+.004),.83-Math.sin(angle)*1.65+Math.pow(Math.abs(t-.5)*2,5)*.6,(t-.5)*15));
   }
   curve(points,.009,materials.strake,52);
  }
  for(const z of [-4.7,-2.8,0,2.8,4.7]){
   const tire=new T.TorusGeometry(.28,.075,12,36);tire.rotateY(Math.PI/2);tire.translate(side*1.87,.46,z);add(tire,materials.rubber);
   for(const r of [.247,.315]){const rib=new T.TorusGeometry(r,.004,4,32);rib.rotateY(Math.PI/2);rib.translate(side*1.934,.46,z);add(rib,materials.rubber);}
   const a=V(side*1.83,.86,z),b=V(side*1.9,.45,z),axis=b.clone().sub(a),perp=V(0,0,1),other=axis.clone().normalize().cross(perp);
   const points=Array.from({length:33},(_,i)=>{const t=i/32;return a.clone().addScaledVector(axis,t).addScaledVector(perp,Math.cos(t*TAU*5)*.014).addScaledVector(other,Math.sin(t*TAU*5)*.014);});
   curve(points,.005,materials.rope,40);
  }
  for(const z of [-2.97,3.77])box([.465,.008,.013],[side*1.19,1.235,z],materials.strake);
 }
 for(const [material,geometries] of buckets){const g=mergeGeometries(geometries,false);geometries.forEach(part=>part.dispose());if(!g)continue;g.computeBoundingSphere();const m=new T.Mesh(g,material);
  // Millimetre-wide cords and seams are smaller than a shadow texel. Their
  // normal shading stays in the main view; only full fenders cast extra shadows.
  m.castShadow=material===materials.rubber;m.userData.reflectionEssential=material===materials.rubber;m.receiveShadow=true;group.add(m);
 }
 return group;
}

function supportContacts(material){
 const positions=[],uvs=[],indices=[],deckWidth=z=>1.79*Math.pow(Math.sin(Math.PI*(z/15+.5)),.48)+.025;
 function patch(x,z,rx,rz){
  // Only surfaces actually over the deck receive a contact patch. Clip the
  // outside rim against its curved edge so nothing hangs over the water.
  if(Math.abs(x)>=deckWidth(z)-.008)return;
  const first=positions.length/3;positions.push(x,.737,z);uvs.push(.5,.5);
  for(let i=0;i<=20;i++){
   const angle=i/20*TAU,dx=Math.cos(angle)*rx,dz=Math.sin(angle)*rz;
   const half=deckWidth(z+dz)-.008,px=Math.max(-half,Math.min(half,x+dx));
   positions.push(px,.737,z+dz);uvs.push(.5+(px-x)/rx*.5,.5+dz/rz*.5);
   if(i>0)indices.push(first,first+i+1,first+i);
  }
 }
 for(const side of [-1,1]){
  for(const z of [-3.9,-1.8,.4,2.6,4.7])patch(side*1.66,z,.17,.17);
  for(const z of [-2.4,.4,3.2])patch(side*1.19,z,.17,.20);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const mesh=new T.Mesh(geometry,material);mesh.name='Soft support and bench contacts';mesh.castShadow=false;return mesh;
}

export async function createHighBoat({craft,traffic,renderer,onProgress=()=>{}}){
 onProgress('Refining timber, canvas and boat fittings');
 const maps=surfaces(renderer),ownedMaterials=new Set(),materialsByOriginal=new Map(),swaps=[],visibility=[],geometrySwaps=[];
 function replacement(original,kind,player=false){
  if(materialsByOriginal.has(original))return materialsByOriginal.get(original);
  const material=original.clone();material.name='High '+kind;material.map=null;material.bumpMap=null;material.roughnessMap=null;material.metalness=0;material.envMapIntensity=.55;
  if(kind==='wood'||kind==='dark'){
   material.map=maps.wood;material.bumpMap=maps.woodHeight;material.bumpScale=.0018;material.roughness=.83;
   material.color.set(kind==='dark'?0x605148:0xffffff);physicalMapping(material,'wood',player);
  }else if(kind==='paint'){
   material.bumpMap=maps.woodHeight;material.bumpScale=.0011;material.roughness=.69;physicalMapping(material,'wood',player);
  }else if(kind==='canvas'){
   material.color.set(0xbdb69e);material.map=maps.canvas;material.bumpMap=maps.canvasHeight;material.bumpScale=.00028;material.roughness=.97;material.envMapIntensity=.20;material.shadowSide=T.FrontSide;physicalMapping(material,'canvas');
  }else if(kind==='rubber'){
   material.color.set(0x282b28);material.map=maps.rubber;material.bumpMap=maps.rubberHeight;material.bumpScale=.0025;material.roughness=.94;material.envMapIntensity=.18;physicalMapping(material,'rubber');
  }else if(kind==='brass'){
   material.color.set(0xa19871);material.metalness=.62;material.roughness=.51;
  }else if(kind==='cream'){material.color.set(0xd2cfb9);material.roughness=.84;}
  else if(kind==='orange'){material.roughness=.89;material.color.set(0xbb6242);}
  ownedMaterials.add(material);materialsByOriginal.set(original,material);return material;
 }
 function collect(root,player){
  for(const object of root.children){
   if(object===craft.person||object===craft.rowingVisual||object.userData.rowingVisual)continue;
   if(object.isGroup){collect(object,player);continue;}
   if(!object.isMesh||Array.isArray(object.material))continue;
   const original=object.material;let kind=original.userData.boatSurface;
   if(!kind&&!player){
    const hex=original.color?.getHex();
    kind=({[0x755239]:'wood',[0xcac3a0]:'canvas',[0x202724]:'rubber',[0xe3dfc8]:'cream',[0x667f72]:'paint',[0x436772]:'paint',[0x9b6748]:'paint',[0xdce2d8]:'paint'})[hex];
   }
   if(!kind)continue;
   if(player&&kind==='canvas'){
    const originalGeometry=object.geometry,high=originalGeometry.clone(),position=high.attributes.position;
    const ribs=[-3.9,-1.8,.4,2.6,4.7];
    for(let i=0;i<position.count;i++){
     const x=position.getX(i),y=position.getY(i),z=position.getZ(i),roof=3.37+.52*Math.cos(x/4.25*Math.PI);
     if(Math.abs(x)>2.126||Math.abs(y-roof)>.004)continue;
     const panel=ribs.findIndex((rib,j)=>j<ribs.length-1&&z>=rib&&z<=ribs[j+1]);if(panel<0)continue;
     const t=(z-ribs[panel])/(ribs[panel+1]-ribs[panel]);
     const tension=Math.sin(Math.PI*t)**2*Math.max(0,1-(x/2.125)**2);
     position.setY(i,y-.024*tension*(.8+.2*Math.cos(x*2.1+z*.32)));
    }
    high.computeVertexNormals();high.computeBoundingSphere();geometrySwaps.push({object,standard:originalGeometry,high});
   }
   if(player&&kind==='rubber'){visibility.push({object,visible:object.visible});continue;}
   swaps.push({object,original,high:replacement(original,kind,player)});
  }
 }
 collect(craft.boat,true);for(const vessel of traffic?.vessels??[])collect(vessel.group,false);
 const material=(color,roughness=.88)=>{const m=new T.MeshStandardMaterial({color,roughness});ownedMaterials.add(m);return m;};
 const tireSource=material(0x282b28);
 const details=fineDetails({hem:material(0xaaa38e),strake:material(0x384a3d),rope:material(0xa9a084),rubber:replacement(tireSource,'rubber')});
 const contactMaterial=new T.MeshBasicMaterial({color:0x293326,map:maps.contact,transparent:true,opacity:.16,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});ownedMaterials.add(contactMaterial);details.add(supportContacts(contactMaterial));
 craft.boat.add(details);let enabled=false,disposed=false,reflectionVisibility=null;
 return {
  setEnabled(value){if(disposed)return;this.endReflection();enabled=Boolean(value);for(const item of swaps)item.object.material=enabled?item.high:item.original;for(const item of geometrySwaps)item.object.geometry=enabled?item.high:item.standard;for(const item of visibility)item.object.visible=enabled?false:item.visible;details.visible=enabled;},
  update(){},
  beginReflection(){if(!enabled||reflectionVisibility)return;reflectionVisibility=details.children.filter(o=>!o.userData.reflectionEssential).map(o=>[o,o.visible]);for(const [o] of reflectionVisibility)o.visible=false;},
  endReflection(){if(!reflectionVisibility)return;for(const [o,visible] of reflectionVisibility)o.visible=visible;reflectionVisibility=null;},
  getStats(){return {surfaces:swaps.length,detailDraws:details.children.length,detailShadowDraws:details.children.filter(o=>o.castShadow).length,detailReflectionDraws:details.children.filter(o=>o.userData.reflectionEssential).length};},
  dispose(){if(disposed)return;this.setEnabled(false);disposed=true;details.removeFromParent();details.traverse(o=>o.geometry?.dispose());geometrySwaps.forEach(item=>item.high.dispose());ownedMaterials.forEach(m=>m.dispose());maps.dispose();},
 };
}

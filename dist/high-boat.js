import * as T from 'three';
import {mergeGeometries} from './vendor/BufferGeometryUtils.js';

// Deterministic mipmapped textures are made only when High loads. Each tile
// describes metres of material, independent of the original hull/deck/rail UVs.
const TAU=Math.PI*2;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const RIBS=[-3.9,-1.8,.4,2.6,4.7];
const hash=n=>{const a=Math.sin(n*127.1+43.17)*43758.5453;return a-Math.floor(a);};
const smoothNoise=(u,v)=>{
 const x=Math.floor(u),y=Math.floor(v),a=u-x,b=v-y,s=a*a*(3-2*a),t=b*b*(3-2*b);
 return T.MathUtils.lerp(T.MathUtils.lerp(hash(x+y*57),hash(x+1+y*57),s),T.MathUtils.lerp(hash(x+(y+1)*57),hash(x+1+(y+1)*57),s),t);
};

function coloredGeometry(positions,uvs,indices,colors){
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

export function canopySurface(x,z){
 const panel=Math.max(0,Math.min(3,RIBS.findIndex((rib,i)=>i<4&&z>=rib&&z<=RIBS[i+1]))),u=T.MathUtils.clamp((z-RIBS[panel])/(RIBS[panel+1]-RIBS[panel]),0,1);
 const across=Math.max(0,1-(x/2.125)**2),slack=Math.sin(Math.PI*u)**2*across;
 const distance=Math.min(...RIBS.map(r=>Math.abs(z-r)));
 const seam=Math.exp(-(((distance-.035)/.024)**2))*.007*across;
 // Tension gathers at sewn joins and the side bindings. Keep the original
 // shallow arch and silhouette; broad folds reveal how the cloth is supported.
 const fold=Math.sin(x*7.2+z*.82)*.0035*Math.exp(-(((Math.abs(x)-1.78)/.29)**2))*Math.sin(Math.PI*u);
 return 3.37+.52*Math.cos(x/4.25*Math.PI)-.046*slack*(.78+.22*Math.cos(x*1.4+z*.21))+seam-.007*across+fold;
}

export function createCanopyShell(){
 const p=[],uv=[],ix=[],c=[],across=40,along=48;
 const vertex=(x,y,z,shade=1)=>{const i=p.length/3;p.push(x,y,z);uv.push(x,z);c.push(shade,shade,shade);return i;};
 function sheet(bottom){
  const start=p.length/3;
  for(let j=0;j<=along;j++)for(let i=0;i<=across;i++){
   const x=(i/across-.5)*4.25,z=-3.9+j/along*8.6;vertex(x,canopySurface(x,z)-(bottom?.026:0),z,bottom?.77:1);
  }
  for(let j=0;j<along;j++)for(let i=0;i<across;i++){
   const a=start+j*(across+1)+i,b=a+across+1;
   ix.push(...(bottom?[a,a+1,b,a+1,b+1,b]:[a,b,a+1,a+1,b,b+1]));
  }
 }
 sheet(false);sheet(true);
 function rim(a,b,steps){
  const start=p.length/3;
  for(let i=0;i<=steps;i++){const t=i/steps,x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t),y=canopySurface(x,z);vertex(x,y,z,.91);vertex(x,y-.026,z,.68);}
  for(let i=0;i<steps;i++){const a=start+i*2;ix.push(a,a+1,a+2,a+2,a+1,a+3);}
 }
 rim([-2.125,-3.9],[2.125,-3.9],across);rim([2.125,4.7],[-2.125,4.7],across);
 rim([-2.125,4.7],[-2.125,-3.9],along);rim([2.125,-3.9],[2.125,4.7],along);
 // Replace the two box-shaped valances with a curved binding section. This
 // keeps their original width, depth and support positions, without an extra
 // sheet fighting the old surface or a heavy board-like edge under the roof.
 const cross=[[-.0275,.0],[-.023,.012],[.023,.012],[.0275,0],[.0275,-.213],[.021,-.235],[-.021,-.235],[-.0275,-.213],[-.0275,0]];
 for(const side of [-1,1]){
  const start=p.length/3;
  for(let j=0;j<=along;j++){
   const z=-3.925+j/along*8.65,soft=Math.sin(z*1.41+.6)*.006+Math.sin(z*3.7)*.003;
   for(const [dx,dy] of cross){const gather=Math.sin(z*5.1+side)*.006*T.MathUtils.smoothstep(-dy,.03,.20);vertex(side*2.11+dx+side*gather,3.363+dy+soft*T.MathUtils.smoothstep(-dy,.03,.20),z,dy<-.19?.81:.91);}
  }
  for(let j=0;j<along;j++)for(let k=0;k<cross.length-1;k++){const a=start+j*cross.length+k,b=a+cross.length;ix.push(a,b,a+1,a+1,b,b+1);}
 }
 const geometry=coloredGeometry(p,uv,ix,c);geometry.userData.canopyShell=true;return geometry;
}

const deckOutline=()=>{
 const points=[];for(let i=0;i<=44;i++){const t=i/44;points.push([1.79*Math.pow(Math.sin(Math.PI*t),.48)+.025,(t-.5)*15]);}
 for(let i=44;i>=0;i--){const t=i/44;points.push([-1.79*Math.pow(Math.sin(Math.PI*t),.48)-.025,(t-.5)*15]);}return points;
};
function clipPolygon(points,axis,value,greater){
 const result=[];for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],insideA=greater?a[axis]>=value:a[axis]<=value,insideB=greater?b[axis]>=value:b[axis]<=value;
  if(insideA)result.push(a);
  if(insideA!==insideB){const t=(value-a[axis])/(b[axis]-a[axis]);result.push([T.MathUtils.lerp(a[0],b[0],t),T.MathUtils.lerp(a[1],b[1],t)]);}
 }return result;
}

export function createDeckBoards(){
 const p=[],uv=[],ix=[],c=[],outline=deckOutline();let boards=0;
 for(let column=-7;column<=6;column++){
  const left=column*.275-.035+.0014,right=(column+1)*.275-.035-.0014,offset=hash(column+71)*3.15;
  for(let segment=-1;segment<5;segment++){
   const near=-7.5+segment*3.7+offset+.0015,far=near+3.697;
   let polygon=outline;for(const [axis,value,greater] of [[0,left,true],[0,right,false],[1,near,true],[1,far,false]])polygon=clipPolygon(polygon,axis,value,greater);
   if(polygon.length<3)continue;
   const centre=polygon.reduce((v,q)=>[v[0]+q[0]/polygon.length,v[1]+q[1]/polygon.length],[0,0]);
   const seed=hash(column*31+segment*17+40),shade=.83+seed*.27;
   const colour=new T.Color().setRGB(shade*(1+(seed-.5)*.055),shade,shade*(1-(seed-.5)*.065));
   const start=p.length/3;
   // A six-millimetre bevel is actual geometry: the narrow edge catches grazing
   // light, while the central board stays at the existing 0.73 m deck contact.
   for(const ring of [0,1])for(const q of polygon){
    const x=ring?T.MathUtils.lerp(q[0],centre[0],.014):q[0],z=ring?T.MathUtils.lerp(q[1],centre[1],.014):q[1];
    p.push(x,ring?.73:.724,z);uv.push(z*.25+seed*4,x+seed);c.push(colour.r*(ring?1:.70),colour.g*(ring?1:.70),colour.b*(ring?1:.70));
   }
   const count=polygon.length;
   for(let n=0;n<count;n++){const a=start+n,b=start+(n+1)%count;ix.push(a,a+count,b,b,a+count,b+count);}
   const topStart=p.length/3;
   for(let n=0;n<count;n++){const i=start+count+n;p.push(...p.slice(i*3,i*3+3));uv.push(...uv.slice(i*2,i*2+2));c.push(...c.slice(i*3,i*3+3));}
   for(let n=1;n<count-1;n++)ix.push(topStart,topStart+n+1,topStart+n);
   boards++;
  }
 }
 const geometry=coloredGeometry(p,uv,ix,c);geometry.userData.deckBoards=boards;return geometry;
}

export function replaceDeckSurface(original){
 const source=original.index?original.toNonIndexed():original.clone(),position=source.attributes.position,kept=[];
 for(let i=0;i<position.count;i+=3){
  const isDeck=[i,i+1,i+2].every(n=>Math.abs(position.getY(n)-.73)<.00001);
  if(!isDeck)kept.push(i,i+1,i+2);
 }
 const remainder=new T.BufferGeometry();
 for(const [name,attribute] of Object.entries(source.attributes)){
  if(name==='color')continue;
  const values=[];for(const i of kept)for(let n=0;n<attribute.itemSize;n++)values.push(attribute.array[i*attribute.itemSize+n]);
  remainder.setAttribute(name,new T.Float32BufferAttribute(values,attribute.itemSize));
 }
 remainder.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(kept.length*3).fill(1),3));
 const boards=createDeckBoards(),flatBoards=boards.toNonIndexed(),result=mergeGeometries([remainder,flatBoards],false);
 result.userData.deckBoards=boards.userData.deckBoards;result.computeBoundingSphere();
 source.dispose();remainder.dispose();boards.dispose();flatBoards.dispose();return result;
}
function surfaces(renderer){
 const textures=[],anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
 function make(kind,height=false,roughness=false){
  const size=kind==='contact'?128:kind==='wood'?1024:512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'),pixels=context.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const u=x/size,v=y/size,index=(y*size+x)*4;let value,red,green,blue;
   if(kind==='contact'){
    value=255;red=green=blue=255;
   }else if(kind==='wood'){
    const broad=smoothNoise(u*5,v*9),fine=smoothNoise(u*37,v*89);
    const bend=Math.sin(u*TAU)*.018+Math.sin(u*TAU*3+v*TAU)*.009+(broad-.5)*.014;
    const rings=Math.sin((v+bend)*TAU*37+Math.sin(u*TAU*2)*1.4),fibre=Math.sin((v+bend*.63)*TAU*113);
    const growth=Math.pow(Math.max(0,rings),9),variation=Math.sin(v*TAU*3+Math.sin(u*TAU)*.5)+(broad-.5)*1.5;
    const pore=Math.pow(Math.max(0,fine-.61)*2.56,2.2);
    value=146-growth*15+fibre*3+variation*6-pore*13;
    red=151-growth*15+variation*10+fibre*1.4-pore*16;green=110-growth*12+variation*8+fibre-pore*13;blue=73-growth*8+variation*5+fibre*.7-pore*9;
    if(roughness)value=219-growth*18+variation*8+fine*9;
   }else if(kind==='canvas'){
    // A 0.8 m tile: coarse woven canvas, with yarn slubs and broad wash/weather
    // variation that remains legible after mipmapping in the Follow camera.
    const warp=Math.cos(u*TAU*64),weft=Math.cos(v*TAU*64),over=Math.cos(u*TAU*32)*Math.cos(v*TAU*32);
    const wash=Math.sin(u*TAU*2+Math.cos(v*TAU)*.8)*Math.cos(v*TAU*3)*3.2,slub=smoothNoise(u*12,v*18)*4;
    value=150+warp*19+weft*19+over*8;red=231+warp*3+weft*3+over+wash+slub;green=red-2;blue=red-7;
   }else{
    const grain=Math.sin(u*TAU*71+Math.sin(v*TAU*13))*Math.sin(v*TAU*87);
    value=150+grain*13;red=green=blue=220+grain*5;
   }
   pixels.data[index]=height||roughness?value:red;pixels.data[index+1]=height||roughness?value:green;pixels.data[index+2]=height||roughness?value:blue;
   pixels.data[index+3]=kind==='contact'?255*Math.max(0,1-Math.hypot(u*2-1,v*2-1))**2:255;
  }
  context.putImageData(pixels,0,0);
  const texture=new T.CanvasTexture(canvas);texture.name='High boat '+kind+' '+(height?'height':'albedo');
  texture.colorSpace=height||roughness?T.NoColorSpace:T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;
  texture.anisotropy=anisotropy;texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;textures.push(texture);return texture;
 }
 return {wood:make('wood'),woodHeight:make('wood',true),woodRoughness:make('wood',false,true),canvas:make('canvas'),canvasHeight:make('canvas',true),rubber:make('rubber'),rubberHeight:make('rubber',true),contact:make('contact'),dispose(){textures.forEach(t=>t.dispose());}};
}

function physicalMapping(material,kind,underCanopy=false){
 const timber=kind==='wood'||kind==='paint',scale=timber?'.25, 1.0':kind==='canvas'?'1.25, 1.25':'2.0, 2.0';
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBoatSurfacePosition; varying vec3 vBoatSurfaceNormal;')
   .replace('#include <begin_vertex>','#include <begin_vertex>\nvBoatSurfacePosition=position; vBoatSurfaceNormal=normal;');
  shader.fragmentShader='varying vec3 vBoatSurfacePosition; varying vec3 vBoatSurfaceNormal;\n'+
   'vec2 boatMaterialUV(){\n vec3 n=abs(vBoatSurfaceNormal); vec3 p=vBoatSurfacePosition;\n'+
   ' vec2 projected=n.y>n.x&&n.y>n.z?p.zx:(n.x>n.z?p.zy:p.xy);\n vec2 uv=projected*vec2('+scale+');\n'+
   (timber?' if(n.y>.8){float board=floor((p.x+.035)/.275);uv+=vec2(fract(sin(board*37.17+9.8)*182.37)*2.3,fract(sin(board*15.87+1.4)*281.9));}\n':'')+
   ' return uv;\n}\n'+shader.fragmentShader;
  for(const name of ['map_fragment','bumpmap_pars_fragment','roughnessmap_fragment']){
   shader.fragmentShader=shader.fragmentShader.replace('#include <'+name+'>',T.ShaderChunk[name].replaceAll('vMapUv','boatMaterialUV()').replaceAll('vBumpMapUv','boatMaterialUV()').replaceAll('vRoughnessMapUv','boatMaterialUV()'));
  }
  const finish=kind==='wood'?`
   if(abs(vBoatSurfaceNormal.y)>.95&&vBoatSurfacePosition.y>.65&&vBoatSurfacePosition.y<.77){
    float plank=(vBoatSurfacePosition.x+.035)/.275,board=floor(plank);
    float tone=.96+.075*fract(sin(board*37.17+9.8)*182.37);
    float edge=min(fract(plank),1.-fract(plank))*.275;
    float join=1.-smoothstep(.0011,.0011+max(fwidth(vBoatSurfacePosition.x),.0003),edge);
    diffuseColor.rgb*=tone*(1.-join*.12);
   }`:kind==='canvas'?`
   float clothVariation=.955+.032*sin(vBoatSurfacePosition.z*.71+vBoatSurfacePosition.x*.39)+.019*cos(vBoatSurfacePosition.z*1.61-vBoatSurfacePosition.x*.72);
   float hemWeather=smoothstep(1.68,2.12,abs(vBoatSurfacePosition.x))*.08;
   float ribDistance=min(min(abs(vBoatSurfacePosition.z+3.9),abs(vBoatSurfacePosition.z+1.8)),min(abs(vBoatSurfacePosition.z-.4),min(abs(vBoatSurfacePosition.z-2.6),abs(vBoatSurfacePosition.z-4.7))));
   float sewnBand=1.-smoothstep(.012,.042+fwidth(vBoatSurfacePosition.z),ribDistance);
   diffuseColor.rgb*=clothVariation-hemWeather-sewnBand*.055;`:kind==='paint'?`
   float waterLine=exp(-pow((vBoatSurfacePosition.y-.14)*7.,2.));
   float rubbing=pow(max(0.,sin(vBoatSurfacePosition.z*2.7+vBoatSurfacePosition.x*.62)),8.);
   diffuseColor.rgb*=1.-waterLine*.045;
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.11,rubbing*.08);`:'';
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+finish);
  // Broad finish variation is legible in grazing light, with filtered fibre
  // relief underneath. Painted wood is smoother than bare deck boards; neither
  // should shine with the constant plastic gloss of a single roughness value.
  if(timber)shader.fragmentShader=shader.fragmentShader.replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nfloat finishGrain=sin(vBoatSurfacePosition.z*.79+sin(vBoatSurfacePosition.x*7.)*.24); roughnessFactor=clamp(roughnessFactor+finishGrain*.035,.46,.96);');
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
 material.customProgramCacheKey=()=> 'bhitarkanika-boat-metres-'+kind+'-'+underCanopy+'-v5';
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
 for(const z of RIBS){
  const points=Array.from({length:33},(_,i)=>{const x=(i/32-.5)*4.22;return V(x,canopySurface(x,z)+.005,z);});
  curve(points,.008,materials.hem,40);
 }
 for(const side of [-1,1]){
  curve([V(side*2.118,3.369,-3.9),V(side*2.118,3.368,.4),V(side*2.118,3.369,4.7)],.019,materials.hem,28);
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
  material.userData.weatherSurface=({dark:'wood',canvas:'cloth',cream:'paint',orange:'paint',brass:'paint'})[kind]||kind;
  if(kind==='wood'||kind==='dark'){
   material.map=maps.wood;material.bumpMap=maps.woodHeight;material.roughnessMap=maps.woodRoughness;material.bumpScale=.0024;material.roughness=.94;material.vertexColors=true;
   material.color.set(kind==='dark'?0x605148:0xffffff);physicalMapping(material,'wood',player);
  }else if(kind==='paint'){
   material.bumpMap=maps.woodHeight;material.bumpScale=.0011;material.roughness=.62;material.envMapIntensity=.72;physicalMapping(material,'paint',player);
  }else if(kind==='canvas'){
   material.color.set(0xe0d4b1);material.map=maps.canvas;material.bumpMap=maps.canvasHeight;material.bumpScale=.0015;material.roughness=.94;material.envMapIntensity=.28;material.vertexColors=true;material.shadowSide=T.FrontSide;physicalMapping(material,'canvas');
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
    const high=createCanopyShell();geometrySwaps.push({object,standard:object.geometry,high,kind:'roof',rest:new Float32Array(high.attributes.position.array)});
   }
   if(player&&kind==='wood'){
    const high=replaceDeckSurface(object.geometry);geometrySwaps.push({object,standard:object.geometry,high,kind:'deck'});
   }
   if(player&&kind==='rubber'){visibility.push({object,visible:object.visible});continue;}
   swaps.push({object,original,high:replacement(original,kind,player)});
  }
 }
 collect(craft.boat,true);for(const vessel of traffic?.vessels??[])collect(vessel.group,false);
 // Illuminate the existing hanging lamp rather than lifting the whole night
 // scene. Its lens keeps the original mesh, position and Standard material.
 const lamp=craft.boat.children.find(object=>object.isMesh&&object.geometry?.type==='SphereGeometry'&&object.position.distanceTo(V(0,3.3,-3.7))<.01&&object.material?.emissive);
 let lampLight=null,lampMaterial=null,lampPreset=0;
 if(lamp){
  lampMaterial=lamp.material.clone();lampMaterial.name='High existing cabin lamp lens';lampMaterial.emissive.set(0xffcb89);lampMaterial.emissiveIntensity=.08;
  ownedMaterials.add(lampMaterial);swaps.push({object:lamp,original:lamp.material,high:lampMaterial});
  lampLight=new T.PointLight(0xffcb89,0,9,2);lampLight.name='High existing cabin lamp light';lampLight.position.copy(lamp.position);lampLight.castShadow=false;lampLight.visible=false;craft.boat.add(lampLight);
 }
 const material=(color,roughness=.88,surface='wood')=>{const m=new T.MeshStandardMaterial({color,roughness});m.userData.weatherSurface=surface;ownedMaterials.add(m);return m;};
 const tireSource=material(0x282b28);
 const details=fineDetails({hem:material(0xaaa38e,.96,'cloth'),strake:material(0x384a3d,.72,'paint'),rope:material(0xa9a084,.97,'rope'),rubber:replacement(tireSource,'rubber')});
 const contactMaterial=new T.MeshBasicMaterial({color:0x293326,map:maps.contact,transparent:true,opacity:.16,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});ownedMaterials.add(contactMaterial);details.add(supportContacts(contactMaterial));
 craft.boat.add(details);let enabled=false,disposed=false,reflectionVisibility=null;
 const illuminateLamp=()=>{
  if(!lampLight)return;const amount=lampPreset===4?1:lampPreset===2?.24:0;
  lampLight.visible=enabled;lampLight.intensity=enabled?8*amount:0;
  lampMaterial.emissiveIntensity=.08+amount*1.42;
 };
 return {
  setEnabled(value){if(disposed)return;this.endReflection();enabled=Boolean(value);for(const item of swaps)item.object.material=enabled?item.high:item.original;for(const item of geometrySwaps)item.object.geometry=enabled?item.high:item.standard;for(const item of visibility)item.object.visible=enabled?false:item.visible;details.visible=enabled;illuminateLamp();},
  update(time,dt,climate){
   if(!enabled)return;
   lampPreset=climate?.preset??0;illuminateLamp();
   if(!dt)return;
   const wind=climate?.wind,strength=T.MathUtils.clamp(wind?.strength||0,0,1.5),ribs=RIBS;
   for(const item of geometrySwaps){
    if(item.kind!=='roof')continue;
    const position=item.high.attributes.position;
    for(let i=0;i<position.count;i++){
     const x=item.rest[i*3],y=item.rest[i*3+1],z=item.rest[i*3+2];
     const panel=ribs.findIndex((rib,j)=>j<ribs.length-1&&z>=rib&&z<=ribs[j+1]);if(panel<0)continue;
     const slack=Math.sin(Math.PI*(z-ribs[panel])/(ribs[panel+1]-ribs[panel]))**2*Math.max(0,1-(x/2.125)**2);
     position.setY(i,y+slack*strength*.009*Math.sin(time*2.2+z*.84+x*(wind?.x||.3)));
    }
    position.needsUpdate=true;item.high.computeVertexNormals();
   }
  },
  beginReflection(){if(!enabled||reflectionVisibility)return;reflectionVisibility=details.children.filter(o=>!o.userData.reflectionEssential).map(o=>[o,o.visible]);for(const [o] of reflectionVisibility)o.visible=false;},
  endReflection(){if(!reflectionVisibility)return;for(const [o,visible] of reflectionVisibility)o.visible=visible;reflectionVisibility=null;},
  getStats(){return {surfaces:swaps.length,deckBoards:geometrySwaps.find(o=>o.kind==='deck')?.high.userData.deckBoards??0,canopyTriangles:geometrySwaps.find(o=>o.kind==='roof')?.high.index.count/3,detailDraws:details.children.length,detailShadowDraws:details.children.filter(o=>o.castShadow).length,detailReflectionDraws:details.children.filter(o=>o.userData.reflectionEssential).length,lampIntensity:lampLight?.intensity??0};},
  dispose(){if(disposed)return;this.setEnabled(false);disposed=true;lampLight?.removeFromParent();lampLight?.dispose();details.removeFromParent();details.traverse(o=>o.geometry?.dispose());geometrySwaps.forEach(item=>item.high.dispose());ownedMaterials.forEach(m=>m.dispose());maps.dispose();},
 };
}

// A small, irregular wave spectrum shared by buoyancy and the High water shader.
// Fixed propagation directions avoid rotating an entire kilometre of water when
// a gust changes direction; wind changes the energy of each travelling component.
export const ESTUARY_WAVES = [
  [.032, .24, .71, .38, 1.7],
  [.024, .41, .94, 1.87, 4.1],
  [.015, .73, 1.27, -.89, .3],
  [.0085, 1.31, 1.59, 2.48, 3.2],
  [.0045, 2.17, 1.91, -1.32, 5.3],
  [.0025, 3.49, 2.23, .94, 2.6]
];
export function sampleEstuary(x,z,time,wind=1,windX=.62,windZ=.78,out={}){
  let height=0,dx=0,dz=0;
  for(const [amplitude,k,omega,angle,offset] of ESTUARY_WAVES){
    const ax=Math.cos(angle),az=Math.sin(angle),response=.76+.24*Math.abs(ax*windX+az*windZ);
    const slow=x*.017-z*.012+offset+time*.043;
    const envelope=.80+.20*Math.sin(x*.009+z*.014+offset*1.73-time*.027);
    const phase=(x*ax+z*az)*k-time*omega+offset+Math.sin(slow)*.67;
    const value=amplitude*wind*response,sine=Math.sin(phase),cosine=Math.cos(phase);
    const e=Math.cos(x*.009+z*.014+offset*1.73-time*.027)*.20;
    height+=value*envelope*sine;
    dx+=value*(e*.009*sine+envelope*cosine*(ax*k+Math.cos(slow)*.67*.017));
    dz+=value*(e*.014*sine+envelope*cosine*(az*k-Math.cos(slow)*.67*.012));
  }
  out.height=height;out.dx=dx;out.dz=dz;return out;
}
function smooth(a,b,x){const v=Math.max(0,Math.min(1,(x-a)/(b-a)));return v*v*(3-2*v);}
function smoothDerivative(a,b,x){const v=Math.max(0,Math.min(1,(x-a)/(b-a)));return 6*v*(1-v)/(b-a);}
// The CPU contact surface and the GLSL wake below use the same local field.
// Derivatives include the widening arms, taper, hull shape and centre phase;
// they are analytic, so the fragment shader never resamples nearby points.
export function sampleLaunchWake(x,z,originX,originZ,directionX,directionZ,velocity,hullLength,time,out={}){
  out.height=0;out.dx=0;out.dz=0;
  const speed=Math.abs(velocity);if(speed<.035||hullLength<1)return out;
  if(velocity<0){directionX=-directionX;directionZ=-directionZ;}
  const sideX=directionZ,sideZ=-directionX,deltaX=x-originX,deltaZ=z-originZ;
  const along=deltaX*directionX+deltaZ*directionZ,cross=deltaX*sideX+deltaZ*sideZ,across=Math.abs(cross),crossSign=Math.sign(cross);
  const strength=smooth(.035,.75,speed)*Math.min(speed/2.315,1.35);
  let height=0,alongSlope=0,crossSlope=0;
  const bow=hullLength*.485,q=along-bow+across*.63;
  if(along>bow-3.2&&along<bow+1.6&&across<3.2){
    const h=.083*strength*Math.exp(-q*q/.27)*Math.exp(-cross*cross*.19);
    height+=h;alongSlope+=h*(-2*q/.27);crossSlope+=h*((-2*q/.27)*crossSign*.63-cross*.38);
  }
  if(Math.abs(along)<hullLength*.46&&across<3){
    const angle=along/hullLength*3.14159265,cosine=Math.cos(angle),section=Math.max(.01,cosine);
    const hull=hullLength*.107*Math.pow(section,.48),hullSlope=cosine>.01?-.107*.48*3.14159265*Math.sin(angle)*Math.pow(section,-.52):0;
    const edge=across-hull-.1,gate=1-smooth(hullLength*.36,hullLength*.46,Math.abs(along));
    const gateSlope=-smoothDerivative(hullLength*.36,hullLength*.46,Math.abs(along))*Math.sign(along),base=.016*strength*Math.exp(-edge*edge/.15);
    height+=base*gate;alongSlope+=base*(gateSlope+gate*2*edge*hullSlope/.15);crossSlope+=base*gate*(-2*edge/.15)*crossSign;
  }
  const run=-along-hullLength*.485,reach=19+speed*19;
  if(run>=-.4&&run<=reach){
    const r=Math.max(run,0),rSlope=run>0?1:0,edge=.8+r*.33,band=.56+r*.041,offset=across-edge;
    if(across<=edge+band*3.4){
      const gate=smooth(-.4,1.7,run),gateSlope=smoothDerivative(-.4,1.7,run),decay=18+speed*9;
      const fadeGate=1-smooth(reach*.72,reach,r),fadeExp=Math.exp(-r/decay),fade=fadeExp*fadeGate;
      const fadeSlope=fadeExp*(-fadeGate/decay-smoothDerivative(reach*.72,reach,r));
      const weight=gate*fade,weightSlope=gateSlope*fade+gate*fadeSlope*rSlope;
      const denominator=1+r*.021,frequency=2.9/denominator,frequencySlope=-2.9*.021/(denominator*denominator);
      const phase=offset*frequency-r*.22+Math.sin(r*.29-time*1.7)*.12;
      const phaseSlope=-.33*frequency+offset*frequencySlope-.22+Math.cos(r*.29-time*1.7)*.0348;
      const band2=band*band,arm=Math.exp(-offset*offset/band2),armSlope=arm*(.66*offset/band2+.082*offset*offset/(band2*band));
      const crest=.070*strength,phaseCos=Math.cos(phase),phaseSin=Math.sin(phase);
      height+=crest*arm*weight*phaseCos;
      alongSlope-=crest*((armSlope*rSlope*weight+arm*weightSlope)*phaseCos-arm*weight*phaseSin*phaseSlope*rSlope);
      crossSlope+=crest*arm*weight*crossSign*(-2*offset/band2*phaseCos-frequency*phaseSin);
      const width=.85+r*.087,width2=width*width,centre=Math.exp(-cross*cross/width2),centreSlope=centre*.174*cross*cross/(width2*width);
      const centrePhase=r*1.16-time*1.9+Math.sin(cross*1.8),centreSin=Math.sin(centrePhase),centreCos=Math.cos(centrePhase),centreAmplitude=.009*strength;
      height+=centreAmplitude*centre*weight*centreSin;
      alongSlope-=centreAmplitude*((centreSlope*rSlope*weight+centre*weightSlope)*centreSin+centre*weight*centreCos*1.16*rSlope);
      crossSlope+=centreAmplitude*centre*weight*(-2*cross/width2*centreSin+centreCos*Math.cos(cross*1.8)*1.8);
    }
  }
  out.height=height;out.dx=directionX*alongSlope+sideX*crossSlope;out.dz=directionZ*alongSlope+sideZ*crossSlope;return out;
}
const number=value=>Number(value).toFixed(8);
export const ESTUARY_GLSL=`
vec3 estuaryComponent(vec2 p,float t,float wind,vec2 windDirection,vec4 wave,float offset){
 vec2 direction=vec2(cos(wave.w),sin(wave.w));
 float slow=dot(p,vec2(.017,-.012))+offset+t*.043;
 float envelopePhase=dot(p,vec2(.009,.014))+offset*1.73-t*.027;
 float envelope=.80+.20*sin(envelopePhase);
 float phase=dot(p,direction)*wave.y-t*wave.z+offset+sin(slow)*.67;
 float value=wave.x*wind*(.76+.24*abs(dot(direction,windDirection)));
 vec2 gradient=value*(cos(envelopePhase)*.20*vec2(.009,.014)*sin(phase)+envelope*cos(phase)*(direction*wave.y+cos(slow)*.67*vec2(.017,-.012)));
 return vec3(gradient,value*envelope*sin(phase));
}
vec3 estuaryField(vec2 p,float t,float wind,vec2 windDirection){
 vec3 result=vec3(0.);
 ${ESTUARY_WAVES.map(([a,k,w,angle,offset])=>`result+=estuaryComponent(p,t,wind,windDirection,vec4(${[a,k,w,angle].map(number).join(',')}),${number(offset)});`).join('\n ')}
 return result;
}
float wakeSmoothDerivative(float a,float b,float x){float v=clamp((x-a)/(b-a),0.,1.);return 6.*v*(1.-v)/(b-a);}
// Local along/cross derivatives match sampleLaunchWake, including envelope
// changes. Keep this scalar field synchronized with the CPU contact surface.
vec3 launchWakeLocal(float along,float cross,float speed,float hullLength,float t){
 float across=abs(cross),crossSign=sign(cross),strength=smoothstep(.035,.75,speed)*min(speed/2.315,1.35);
 float height=0.,alongSlope=0.,crossSlope=0.;
 // A rounded bow shoulder pushes outwards around the existing tapered hull.
 float bow=hullLength*.485,q=along-bow+across*.63;
 if(along>bow-3.2&&along<bow+1.6&&across<3.2){
  float h=.083*strength*exp(-q*q/.27)*exp(-cross*cross*.19);
  height+=h;alongSlope+=h*(-2.*q/.27);crossSlope+=h*((-2.*q/.27)*crossSign*.63-cross*.38);
 }
 // Low lateral displacement hugs the sides, fading before bow and stern.
 if(abs(along)<hullLength*.46&&across<3.){
  float angle=along/hullLength*3.14159265,cosine=cos(angle),section=max(.01,cosine);
  float hull=hullLength*.107*pow(section,.48),hullSlope=cosine>.01?-.107*.48*3.14159265*sin(angle)*pow(section,-.52):0.;
  float edge=across-hull-.1,gate=1.-smoothstep(hullLength*.36,hullLength*.46,abs(along));
  float gateSlope=-wakeSmoothDerivative(hullLength*.36,hullLength*.46,abs(along))*sign(along),base=.016*strength*exp(-edge*edge/.15);
  height+=base*gate;alongSlope+=base*(gateSlope+gate*2.*edge*hullSlope/.15);crossSlope+=base*gate*(-2.*edge/.15)*crossSign;
 }
 float run=-along-hullLength*.485,reach=19.+speed*19.;
 if(run<-.4||run>reach)return vec3(alongSlope,crossSlope,height);
 float r=max(run,0.),rSlope=run>0.?1.:0.,edge=.8+r*.33,band=.56+r*.041,offset=across-edge;
 if(across>edge+band*3.4)return vec3(alongSlope,crossSlope,height);
 float gate=smoothstep(-.4,1.7,run),gateSlope=wakeSmoothDerivative(-.4,1.7,run),decay=18.+speed*9.;
 float fadeGate=1.-smoothstep(reach*.72,reach,r),fadeExp=exp(-r/decay),fade=fadeExp*fadeGate;
 float fadeSlope=fadeExp*(-fadeGate/decay-wakeSmoothDerivative(reach*.72,reach,r));
 float weight=gate*fade,weightSlope=gateSlope*fade+gate*fadeSlope*rSlope;
 float denominator=1.+r*.021,frequency=2.9/denominator,frequencySlope=-2.9*.021/(denominator*denominator);
 float phase=offset*frequency-r*.22+sin(r*.29-t*1.7)*.12;
 float phaseSlope=-.33*frequency+offset*frequencySlope-.22+cos(r*.29-t*1.7)*.0348;
 float band2=band*band,arm=exp(-offset*offset/band2),armSlope=arm*(.66*offset/band2+.082*offset*offset/(band2*band));
 float crest=.070*strength,phaseCos=cos(phase),phaseSin=sin(phase);
 height+=crest*arm*weight*phaseCos;
 alongSlope-=crest*((armSlope*rSlope*weight+arm*weightSlope)*phaseCos-arm*weight*phaseSin*phaseSlope*rSlope);
 crossSlope+=crest*arm*weight*crossSign*(-2.*offset/band2*phaseCos-frequency*phaseSin);
 // Fine interference in the disturbed centre stays below the wave shoulders.
 float width=.85+r*.087,width2=width*width,centre=exp(-cross*cross/width2),centreSlope=centre*.174*cross*cross/(width2*width);
 float centrePhase=r*1.16-t*1.9+sin(cross*1.8),centreSin=sin(centrePhase),centreCos=cos(centrePhase),centreAmplitude=.009*strength;
 height+=centreAmplitude*centre*weight*centreSin;
 alongSlope-=centreAmplitude*((centreSlope*rSlope*weight+centre*weightSlope)*centreSin+centre*weight*centreCos*1.16*rSlope);
 crossSlope+=centreAmplitude*centre*weight*(-2.*cross/width2*centreSin+centreCos*cos(cross*1.8)*1.8);
 return vec3(alongSlope,crossSlope,height);
}
// The same field displaces near-water vertices and shades their slopes. Bow,
// shoulders and stern arms form one wake; there is no separate white wake mesh.
vec3 launchWake(vec2 p,vec2 origin,vec2 direction,float velocity,float hullLength,float t){
 float speed=abs(velocity);if(speed<.035||hullLength<1.)return vec3(0.);
 if(velocity<0.)direction=-direction;
 vec2 side=vec2(direction.y,-direction.x),delta=p-origin;
 vec3 local=launchWakeLocal(dot(delta,direction),dot(delta,side),speed,hullLength,t);
 return vec3(direction*local.x+side*local.y,local.z);
}`;

// Dense near the boat, economical at the fog horizon; no resolution scaling.
export function nearWaterAxis(){
  const values=[],outer=[];
  for(let i=1;i<=36;i++)outer.push(58+.7*i+1116.8*Math.pow(i/36,2.4));
  for(let i=outer.length-1;i>=0;i--)values.push(-outer[i]);
  for(let i=0;i<=184;i++)values.push(-58+116*i/184);
  values.push(...outer);
  return values;
}

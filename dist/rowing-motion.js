import {ROWING, oarPose} from './rowing.js';

const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
export const SCULLING=Object.freeze({station:[0,.79,5.42],pivotX:1.48,pivotY:1.32,pivotZ:5.65,handle:1.25,blade:2.55,sweep:.22});

// The animation reads the simulation clock; it never applies a force or starts a stroke.
export function strokePresentation(age,side){
  const physical=oarPose(age,side),sign=side===0?-1:1;
  const sweep=-physical.yaw/sign*SCULLING.sweep/.55;
  let height=.22,feather=1;
  if(physical.phase==='catch'){const t=smooth(age/ROWING.catch);height=.22-.28*t;feather=1-t;}
  if(physical.phase==='power'){const t=(age-ROWING.catch)/ROWING.power;height=-.06-.035*Math.sin(t*Math.PI);feather=0;}
  if(physical.phase==='release'){const t=smooth((age-ROWING.catch-ROWING.power)/ROWING.release);height=-.06+.28*t;feather=t;}
  return {sweep:physical.phase==='rest'?-SCULLING.sweep:sweep,height,feather,phase:physical.phase,active:physical.phase!=='rest',progress:age<0?0:clamp(age/ROWING.duration)};
}

export class RowingPresentation {
  constructor(){this.reset();}
  reset(){this.equipment=0;this.station=0;this.park=1;this.sides=[0,1].map(side=>({...strokePresentation(-1,side)}));this.active=false;this.phase='rest';this.progress=0;this.torsoLean=0;this.torsoTwist=0;}
  update(dt,mode,ages,interpolation=0){
    dt=Math.max(0,Math.min(dt,.05));const row=mode==='row';
    const approach=(a,b,rate)=>a+(b-a)*(1-Math.exp(-dt*rate));
    // Hands take up the handles smoothly; feet stay at the fixed stern station.
    this.station=approach(this.station,row?1:0,row?9:5);
    if(Math.abs(this.station-(row?1:0))<.0001)this.station=row?1:0;
    // Unship the parked oars before taking their handles. When leaving Row,
    // release the grip and lift the blades before rotating them alongside.
    const canPark=!row&&this.equipment<.08&&this.sides.every(p=>p.height>.15);
    this.park=approach(this.park,row?0:canPark?1:this.park,row?10:5);
    if(this.park<.001)this.park=0;if(this.park>.999)this.park=1;
    const equipped=row?smooth((this.station-.25)/.65)*(1-smooth(this.park/.18)):0;
    this.equipment=approach(this.equipment,equipped,row?5:4);
    if(!row&&this.equipment<.0001)this.equipment=0;
    this.active=false;let age=-1;
    for(let side=0;side<2;side++){
      const currentAge=row&&ages[side]>=0?Math.min(ROWING.duration-1e-7,ages[side]+interpolation):-1;
      const next=strokePresentation(currentAge,side),p=this.sides[side];
      if(next.active){
        if(next.phase==='catch'){
          if(!p.active||p.phase!=='catch'){p.catchSweep=p.sweep;p.catchHeight=p.height;p.catchFeather=p.feather;}
          const catchBlend=smooth(currentAge/ROWING.catch);
          next.sweep+=(p.catchSweep-next.sweep)*(1-catchBlend);next.height+=(p.catchHeight-.22)*(1-catchBlend);next.feather+=(p.catchFeather-1)*(1-catchBlend);
        }
        Object.assign(p,next);this.active=true;age=Math.max(age,currentAge);
      }
      else{
        // Cancellation lifts the blade immediately and feathers it before parking.
        p.height=approach(p.height,.22,16);p.feather=approach(p.feather,1,13);
        p.sweep=approach(p.sweep,row?-SCULLING.sweep:0,p.height>.15?8:2);p.active=false;p.phase=p.height<.20?'settling':'rest';p.progress=0;
      }
    }
    const primary=this.sides.find(p=>p.active);
    this.phase=primary?.phase??(this.sides.some(p=>p.phase==='settling')?'settling':'rest');this.progress=primary?.progress??0;
    const reach=primary?(.5-primary.sweep/(SCULLING.sweep*2)):0;
    this.torsoLean=approach(this.torsoLean,primary?-.035+.19*reach:row?.13:0,14);
    this.torsoTwist=approach(this.torsoTwist,(this.sides[0].sweep-this.sides[1].sweep)*.16,12);
    return this;
  }
}

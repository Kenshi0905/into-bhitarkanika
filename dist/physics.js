import {center,width} from './channel.js';
export class BoatPhysics {
 constructor(){this.reset();}
 reset(){this.x=0;this.z=0;this.heading=.13;this.vx=0;this.vz=0;this.yawVelocity=0;this.speed=0;this.distance=0;this.collided=false;this.rowCooldown=[0,0];}
 row(side,time){if(time<this.rowCooldown[side])return false;this.rowCooldown[side]=time+.83;const impulse=.30;this.vx-=Math.sin(this.heading)*impulse;this.vz-=Math.cos(this.heading)*impulse;this.yawVelocity+=side===0?-.055:.055;return true;}
 step(dt,input,time){
  const fx=-Math.sin(this.heading),fz=-Math.cos(this.heading),rx=Math.cos(this.heading),rz=-Math.sin(this.heading);
  let forward=this.vx*fx+this.vz*fz,lateral=this.vx*rx+this.vz*rz;
  const throttle=input.mode==='motor'?input.throttle:0;
  // Directional drag, mass/inertia, a weak tidal current, and rudder authority with speed.
  forward+=(throttle*1.12-forward*.11-forward*Math.abs(forward)*.055)*dt;
  lateral*=Math.exp(-2.6*dt);
  if(input.brake)forward*=Math.exp(-1.8*dt);
  const turn=input.steer*Math.min(Math.abs(forward)/2.4,1)*.33*Math.sign(forward||1);
  this.yawVelocity+=(turn-this.yawVelocity)*Math.min(dt*2,1);
  this.heading+=this.yawVelocity*dt;
  this.vx=fx*forward+rx*lateral;this.vz=fz*forward+rz*lateral;
  const oldX=this.x,oldZ=this.z;this.x+=this.vx*dt+Math.sin(time*.08)*.008*dt;this.z+=this.vz*dt;
  this.collided=false;
  // Three samples protect the long hull, not only its centre. Bank contact removes inward velocity.
  for(const offset of [-5.5,0,5.5]){const px=this.x+fx*offset,pz=this.z+fz*offset,edge=width(pz)-2.8,c=center(pz),over=Math.abs(px-c)-edge;if(over>0){const side=Math.sign(px-c);this.x-=side*over;this.vx-=side*Math.max(0,this.vx*side)*.9;this.vz*=.97;this.yawVelocity*=.5;this.collided=true;}}
  if(this.z < -1050 || this.z>160){this.z=Math.max(-1050,Math.min(160,this.z));this.vz=0;this.collided=true;}
  this.speed=forward;this.distance+=Math.hypot(this.x-oldX,this.z-oldZ);
 }
}

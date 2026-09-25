// UI intent feeds the existing RowingCycle. It never creates forces or a second
// animation clock. A single scheduler arbitrates automatic and manual strokes.
export const AUTO_ROW=Object.freeze({prepare:.9,rest:.48});
const oarKeys=new Set(['KeyQ','KeyE','Space','KeyW','ArrowUp']);
const brakeKeys=new Set(['KeyS','ArrowDown']);
export class PropulsionControls {
  constructor(state,physics){this.state=state;this.physics=physics;this.wait=AUTO_ROW.prepare;}
  select(mode){
    this.physics.cancelRowing();this.state.mode=mode;
    this.state.cruise=mode==='row';this.wait=AUTO_ROW.prepare;
  }
  toggle(){
    this.state.cruise=!this.state.cruise;
    // Let a current stroke finish, but remove any request for an extra stroke.
    if(this.state.mode==='row')this.physics.rowing.pending=0;
    this.wait=this.state.cruise?AUTO_ROW.prepare:AUTO_ROW.rest;
  }
  manual(code){
    if(this.state.mode==='motor'||oarKeys.has(code)||brakeKeys.has(code)){
      this.state.cruise=false;this.physics.rowing.pending=0;this.wait=AUTO_ROW.rest;
    }
    // Rowing steering may be used while automatic paired strokes continue.
    // An oar/brake input takes the helm until Play is selected again.
    if(this.state.mode==='row'){
      if(code==='KeyQ')this.physics.row(0);
      else if(code==='KeyE')this.physics.row(1);
      else if(code==='Space'||code==='KeyW'||code==='ArrowUp')this.physics.rowBoth();
    }
  }
  update(dt){
    if(this.state.mode!=='row'||!this.state.cruise)return;
    const cycle=this.physics.rowing;
    if(cycle.ages.some(age=>age>=0)||cycle.pending){this.wait=AUTO_ROW.rest;return;}
    this.wait=Math.max(0,this.wait-dt);
    if(this.wait===0){this.physics.rowBoth();this.wait=AUTO_ROW.rest;}
  }
  reset(){this.state.cruise=false;this.wait=AUTO_ROW.prepare;}
}

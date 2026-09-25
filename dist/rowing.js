// A stroke is driven by simulation time, never by keyboard repeats or render frames.
export const ROWING = Object.freeze({
  catch: .14,
  power: .7,
  release: .14,
  recovery: .42,
  duration: 1.4,
  speedPerOar: .42,
  yawPerOar: .12,
});

const EPSILON = 1e-9;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

// Integral of a sin-squared force envelope. Taking its difference over a time
// interval gives identical stroke work even when a frame crosses a phase boundary.
function work(age) {
  const t = clamp((age - ROWING.catch) / ROWING.power);
  return t - Math.sin(t * Math.PI * 2) / (Math.PI * 2);
}

export function oarPose(age, side) {
  const sign = side === 0 ? -1 : 1;
  let sweep = -.55, lift = .2, phase = 'rest';
  if (age >= 0 && age < ROWING.duration) {
    if (age < ROWING.catch) {
      phase = 'catch';
      lift = .2 - .26 * smooth(age / ROWING.catch);
    } else if (age < ROWING.catch + ROWING.power) {
      phase = 'power';
      const t = (age - ROWING.catch) / ROWING.power;
      sweep = -.55 + 1.1 * work(age);
      lift = -.06 - .025 * Math.sin(t * Math.PI);
    } else if (age < ROWING.catch + ROWING.power + ROWING.release) {
      phase = 'release';
      sweep = .55;
      lift = -.06 + .26 * smooth((age - ROWING.catch - ROWING.power) / ROWING.release);
    } else {
      phase = 'recovery';
      sweep = .55 - 1.1 * smooth((age - ROWING.catch - ROWING.power - ROWING.release) / ROWING.recovery);
    }
  }
  // The bow faces -Z: the submerged blade must travel aft (+Z) on the pull.
  return { yaw: -sign * sweep, roll: sign * lift, submerged: phase === 'power', phase };
}

export class RowingCycle {
  constructor() { this.reset(); }

  reset() {
    this.ages = [-1, -1];
    this.pending = 0;
    this.started = 0;
    this.strokeCount = 0;
  }

  request(side) {
    if (side !== 0 && side !== 1) return false;
    const bit = 1 << side;
    if (this.ages[side] >= 0 || (this.pending & bit)) return false;
    this.pending |= bit;
    return true;
  }

  requestBoth() {
    if (this.pending === 3) return false;
    // Queue the pair as a unit: a late second oar cannot start out of phase.
    this.pending = 3;
    return true;
  }

  pose(side, interpolationSeconds = 0) {
    const age = this.ages[side];
    return oarPose(age < 0 ? -1 : Math.min(age + Math.max(0, interpolationSeconds), ROWING.duration), side);
  }

  step(dt, input = {}) {
    this.started = 0;
    const result = { speed: 0, yaw: 0 };
    if (!(dt > 0) || !Number.isFinite(dt)) return result;
    const held = input.rowBoth ? 3 : (input.rowLeft ? 1 : 0) | (input.rowRight ? 2 : 0);
    let remaining = dt;
    while (remaining > EPSILON) {
      const requested = held | this.pending;
      const paired = held === 3 || this.pending === 3;
      let start = 0;
      if (paired) {
        if (this.ages[0] < 0 && this.ages[1] < 0) start = 3;
      } else {
        for (let side = 0; side < 2; side++) {
          const bit = 1 << side;
          if ((requested & bit) && this.ages[side] < 0) start |= bit;
        }
      }
      for (let side = 0; side < 2; side++) {
        if (!(start & (1 << side))) continue;
        this.ages[side] = 0;
        this.strokeCount++;
      }
      this.pending &= ~start;
      this.started |= start;
      let slice = remaining;
      for (const age of this.ages) if (age >= 0) slice = Math.min(slice, ROWING.duration - age);
      for (let side = 0; side < 2; side++) {
        const age = this.ages[side];
        if (age < 0) continue;
        const end = age + slice;
        const force = work(end) - work(age);
        result.speed += force * ROWING.speedPerOar;
        result.yaw += force * ROWING.yawPerOar * (side === 0 ? -1 : 1);
        this.ages[side] = end >= ROWING.duration - EPSILON ? -1 : end;
      }
      remaining -= slice;
    }
    return result;
  }
}

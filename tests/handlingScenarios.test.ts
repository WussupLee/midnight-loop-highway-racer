import { describe, expect, it } from 'vitest';
import { createVehicleState, stepVehicle } from '../src/game/vehicle';
import { roadCenterX, roadHeading } from '../src/game/world';
import { createDriftState, updateDrift } from '../src/game/drift';

const idle = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
function atSpeed(mph: number) {
  const state = createVehicleState(), speed = mph / 2.236936;
  state.vx = Math.sin(state.yaw) * speed; state.vz = Math.cos(state.yaw) * speed;
  state.speedMps = state.longitudinalSpeed = speed; state.speedMph = mph;
  return state;
}
describe('repeatable highway driving scenarios', () => {
  it.each([60, 100, 140])('settles a %i MPH alternating slalom without a spin', mph => {
    const state = atSpeed(mph);
    for (let tick = 0; tick < 720; tick++) {
      const t = tick / 120;
      const steer = t < 4 ? Math.sin(t * Math.PI * 2) * .65 : 0;
      stepVehicle(state, { ...idle, throttle: .55, steer }, 1 / 120);
      expect(Math.abs(state.yaw - roadHeading(state.z))).toBeLessThan(.5);
      expect(Math.abs(state.x - roadCenterX(state.z))).toBeLessThan(10);
    }
    expect(Math.abs(state.yawRate)).toBeLessThan(.08);
    expect(Number.isFinite(state.rpm)).toBe(true);
  });
  it('accelerates from 60 to 100 MPH without nitrous and restores speed after braking', () => {
    const state = atSpeed(60);
    let ticks = 0;
    while (state.speedMph < 100 && ticks < 1200) { stepVehicle(state, { ...idle, throttle: 1 }, 1 / 120); ticks++; }
    expect(ticks / 120).toBeLessThan(8);
    for (let i = 0; i < 60; i++) stepVehicle(state, { ...idle, brake: 1 }, 1 / 120);
    const slow = state.speedMps;
    for (let i = 0; i < 240; i++) stepVehicle(state, { ...idle, throttle: 1 }, 1 / 120);
    expect(state.speedMps).toBeGreaterThan(slow + 5);
  });
  it.each([60, 100, 140])('keeps a %i MPH handbrake transition finite and preserves points as pending', mph => {
    const state = atSpeed(mph);
    let drift = createDriftState(), peakAngle = 0, seenActive = false;
    for (let tick = 0; tick < 100; tick++) {
      const handbrake = tick < 65;
      const result = stepVehicle(state, { ...idle, throttle: .6, steer: handbrake ? .6 : -.25, handbrake }, 1 / 120);
      const update = updateDrift(drift, { ...state, handbrake, now: tick / 120, dt: 1 / 120, multiplier: 1, invalidated: result.barrierImpact > 0 });
      drift = update.state;
      seenActive ||= drift.active;
      peakAngle = Math.max(peakAngle, drift.angleDeg);
      expect(update.scoreDelta).toBe(0);
      expect(Number.isFinite(state.x + state.z + state.yaw + state.rpm)).toBe(true);
    }
    expect(seenActive).toBe(true);
    expect(peakAngle).toBeGreaterThan(3.5);
  });
});

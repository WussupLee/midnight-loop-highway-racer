import { describe, expect, it } from 'vitest';
import { createVehicleState, stepVehicle } from '../src/game/vehicle';

function drive(mph: number, steer: number, heldSeconds: number, handbrake = false, hz = 120) {
  const state = createVehicleState();
  state.x = 0; state.yaw = 0; state.vx = 0; state.vz = mph / 2.236936;
  for (let tick = 0; tick < hz / 2; tick++) stepVehicle(state, {
    throttle: .6, brake: 0, steer: tick < heldSeconds * hz ? steer : 0,
    handbrake: handbrake && tick < heldSeconds * hz, boost: false,
  }, 1 / hz);
  return state;
}

describe('small driver corrections', () => {
  // Reference measurements from the previous model, same 150 ms / 70% input at 120 Hz.
  it.each([[60, .60537], [100, .57600], [140, .46923]])('makes a %i MPH tap useful without a large handling change', (mph, oldTravel) => {
    const left = drive(mph, .7, .15), right = drive(mph, -.7, .15);
    expect(left.x).toBeGreaterThan(oldTravel * 1.10);
    expect(left.x).toBeLessThan(oldTravel * 1.22);
    expect(right.x).toBeCloseTo(-left.x, 5);
    expect(Math.abs(left.yawRate)).toBeLessThan(.1);
    expect(left.driftBlend).toBe(0);
  });
  it.each([60, 100, 140])('keeps a brief %i MPH handbrake touch from committing a full slide', mph => {
    const tap = drive(mph, .7, .1, true), held = drive(mph, .7, .5, true);
    expect(tap.driftBlend).toBeLessThan(.22);
    expect(Math.abs(tap.yawRate)).toBeLessThan(.04);
    expect(held.driftBlend).toBeGreaterThan(.8);
    expect(held.yawRate).toBeGreaterThan(.4);
    expect(held.yawRate).toBeLessThan(.7);
  });
  it('tames a held high-speed drift while preserving deliberate rotation', () => {
    const slide = drive(140, .7, .5, true);
    expect(slide.yawRate).toBeLessThan(.64948 * .8);
    expect(slide.yaw).toBeGreaterThan(.12);
  });
  it('keeps tap distance consistent at 60 and 120 Hz simulation steps', () => {
    for (const mph of [60, 100, 140]) {
      const fine = drive(mph, .7, .15), coarse = drive(mph, .7, .15, false, 60);
      expect(Math.abs(fine.x - coarse.x)).toBeLessThan(.1);
    }
  });
});

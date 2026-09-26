import { describe, expect, it } from 'vitest';
import { carContact, type CarFootprint } from '../src/game/contact';
import { collisionOutcome, createVehicleState, HANDLING, stepVehicle } from '../src/game/vehicle';
import { roadCenterX, roadHeading, VEHICLE_ROAD_EDGE } from '../src/game/world';

const traffic: CarFootprint = { x: 0, z: 0, yaw: 0, vx: 0, vz: 30, halfWidth: .81, halfLength: 2 };

describe('run-ending impacts', () => {
  it.each([true, false])('ends a highway rear-end collision even with effectsReady=%s', effectsReady => {
    // 120 mph player hitting traffic moving at 67 mph.
    const hit = carContact({ ...traffic, z: -3.9, vz: 120 / 2.236936 }, traffic, 1 / 120)!;
    expect(hit.scrape).toBe(false);
    expect(collisionOutcome(hit.closingSpeed, effectsReady)).toBe('crash');
  });

  it('keeps a fast shallow side scrape survivable', () => {
    const hit = carContact({ ...traffic, x: 1.55, vx: -2, vz: 70 }, traffic)!;
    expect(hit.scrape).toBe(true);
    expect(collisionOutcome(hit.closingSpeed, true)).toBe('contact');
    expect(collisionOutcome(hit.closingSpeed, false)).toBe('silent');
  });

  it('allows a moderate bump and crashes exactly at the hard-impact threshold', () => {
    expect(collisionOutcome(15, true)).toBe('contact');
    expect(collisionOutcome(HANDLING.fatalClosingSpeed - .01, true)).toBe('contact');
    expect(collisionOutcome(HANDLING.fatalClosingSpeed, false)).toBe('crash');
  });

  it('ends a hard wall impact during an earlier contact cooldown', () => {
    const state = createVehicleState();
    const heading = roadHeading(state.z);
    state.x = roadCenterX(state.z) + VEHICLE_ROAD_EDGE - .01;
    state.yaw = heading + .7;
    state.vx = Math.sin(state.yaw) * 60;
    state.vz = Math.cos(state.yaw) * 60;
    state.collisionCooldown = .3;
    const result = stepVehicle(state, { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false }, 1 / 120);
    expect(state.collisionCooldown).toBeGreaterThan(0);
    expect(collisionOutcome(result.barrierImpact, state.collisionCooldown <= 0)).toBe('crash');
  });

  it('ends a swept high-speed impact that crosses the whole car in one tick', () => {
    const hit = carContact({ ...traffic, z: 5, vz: 1400 }, traffic, 1 / 120)!;
    expect(collisionOutcome(hit.closingSpeed, false)).toBe('crash');
  });
});

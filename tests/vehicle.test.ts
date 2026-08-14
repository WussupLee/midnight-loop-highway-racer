import { describe, expect, it } from 'vitest';
import { CHASE_FOV_BASE, CHASE_FOV_SPEED_GAIN, cinematicEase } from '../src/game/visuals';
import { createVehicleState, digitalSteer, speedSensitiveSteer, stepVehicle, torqueAtRpm } from '../src/game/vehicle';
import { roadCenterX, roadHeading } from '../src/game/world';

const idleInput = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };

function setRoadSpeed(state: ReturnType<typeof createVehicleState>, longitudinal: number, lateral = 0): void {
  const sin = Math.sin(state.yaw);
  const cos = Math.cos(state.yaw);
  state.vx = sin * longitudinal + cos * lateral;
  state.vz = cos * longitudinal - sin * lateral;
  state.longitudinalSpeed = longitudinal;
  state.lateralSpeed = lateral;
  state.speedMps = Math.hypot(longitudinal, lateral);
  state.speedMph = state.speedMps * 2.236936;
}

describe('vehicle systems', () => {
  it('eases the run-opening camera cleanly into and out of its chase handoff', () => {
    expect(cinematicEase(0)).toBe(0);
    expect(cinematicEase(1)).toBe(1);
    expect(cinematicEase(.5)).toBeCloseTo(.5, 8);
    expect(cinematicEase(.1)).toBeLessThan(.1);
    expect(cinematicEase(.9)).toBeGreaterThan(.9);
  });

  it('keeps the revised chase-camera FOV closer across the speed range', () => {
    expect(CHASE_FOV_BASE).toBe(62);
    expect(CHASE_FOV_BASE + CHASE_FOV_SPEED_GAIN).toBe(80);
  });
  it('uses a shaped torque curve', () => {
    expect(torqueAtRpm(4700)).toBeGreaterThan(torqueAtRpm(1800));
    expect(torqueAtRpm(4700)).toBeGreaterThan(torqueAtRpm(7200));
  });

  it('reduces maximum steering angle at freeway speed', () => {
    expect(speedSensitiveSteer(10)).toBeGreaterThan(speedSensitiveSteer(70) * 2);
  });

  it('maps digital steering to the visible chase-camera direction', () => {
    expect(digitalSteer(false, true)).toBe(-1);
    expect(digitalSteer(true, false)).toBe(1);
    expect(digitalSteer(true, true)).toBe(0);
  });

  it('keeps ordinary high-speed steering below the handbrake yaw envelope', () => {
    const stable = createVehicleState();
    const drifting = createVehicleState();
    for (let i = 0; i < 180; i += 1) {
      stepVehicle(stable, { ...idleInput, throttle: 1, steer: -1 }, 1 / 120);
      stepVehicle(drifting, { ...idleInput, throttle: 1, steer: -1, handbrake: true }, 1 / 120);
    }
    expect(Math.abs(stable.yawRate)).toBeLessThan(1);
    expect(Math.abs(drifting.yawRate)).toBeGreaterThan(Math.abs(stable.yawRate));
  });

  it('accelerates through applied drivetrain force and produces real RPM/gear telemetry', () => {
    const state = createVehicleState();
    const initialSpeed = state.speedMps;
    for (let i = 0; i < 240; i += 1) stepVehicle(state, { ...idleInput, throttle: 1 }, 1 / 120);
    expect(state.speedMps).toBeGreaterThan(initialSpeed);
    expect(state.forceLongitudinal).toBeGreaterThan(0);
    expect(state.rpm).toBeGreaterThanOrEqual(900);
    expect(state.gear).toBeGreaterThanOrEqual(1);
  });

  it('recovers speed promptly after a service-braking pass setup', () => {
    const state = createVehicleState();
    for (let frame = 0; frame < 72; frame += 1) stepVehicle(state, { ...idleInput, brake: .8 }, 1 / 120);
    const speedAfterBraking = state.speedMps;
    for (let frame = 0; frame < 180; frame += 1) stepVehicle(state, { ...idleInput, throttle: 1 }, 1 / 120);
    expect(state.speedMps - speedAfterBraking).toBeGreaterThan(5);
  });

  it('braking reduces road speed and handbrake reduces rear stability', () => {
    const braking = createVehicleState();
    const start = braking.speedMps;
    for (let i = 0; i < 120; i += 1) stepVehicle(braking, { ...idleInput, brake: 1 }, 1 / 120);
    expect(braking.speedMps).toBeLessThan(start);

    const sliding = createVehicleState();
    for (let i = 0; i < 90; i += 1) stepVehicle(sliding, { ...idleInput, steer: 1, handbrake: true }, 1 / 120);
    expect(Number.isFinite(sliding.rearSlip)).toBe(true);
    expect(Math.abs(sliding.yawRate)).toBeGreaterThan(.02);
  });

  it('stabilizes service braking without stealing the handbrake drift role', () => {
    const service = createVehicleState();
    const handbrake = createVehicleState();
    setRoadSpeed(service, 56, 4);
    setRoadSpeed(handbrake, 56, 4);
    service.yawRate = .32;
    handbrake.yawRate = .32;
    for (let frame = 0; frame < 120; frame += 1) {
      stepVehicle(service, { ...idleInput, brake: 1 }, 1 / 120);
      stepVehicle(handbrake, { ...idleInput, steer: .35, handbrake: true }, 1 / 120);
    }
    expect(service.speedMps).toBeLessThan(50);
    expect(Math.abs(service.yawRate)).toBeLessThan(.16);
    expect(Math.abs(service.lateralSpeed)).toBeLessThan(4);
    expect(Math.abs(handbrake.yawRate)).toBeGreaterThan(Math.abs(service.yawRate) * 2);
  });

  it('keeps a full keyboard highway swerve inside a recoverable yaw envelope', () => {
    const state = createVehicleState();
    setRoadSpeed(state, 65);
    let peakYaw = 0;
    for (let frame = 0; frame < 60; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .65, steer: 1 }, 1 / 120);
      peakYaw = Math.max(peakYaw, Math.abs(state.yawRate));
    }
    for (let frame = 0; frame < 60; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .65, steer: -1 }, 1 / 120);
      peakYaw = Math.max(peakYaw, Math.abs(state.yawRate));
    }
    for (let frame = 0; frame < 120; frame += 1) stepVehicle(state, idleInput, 1 / 120);
    expect(peakYaw).toBeLessThan(.55);
    expect(Math.abs(state.yawRate)).toBeLessThan(.12);
    expect(Number.isFinite(state.lateralSpeed)).toBe(true);
  });

  it('settles the rear axle quickly when reversing a high-speed swerve', () => {
    const state = createVehicleState();
    setRoadSpeed(state, 65);
    for (let frame = 0; frame < 48; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .7, steer: 1 }, 1 / 120);
    }
    for (let frame = 0; frame < 48; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .7, steer: -1 }, 1 / 120);
    }
    expect(Math.abs(state.yawRate)).toBeLessThan(.34);
    expect(Math.abs(state.lateralSpeed)).toBeLessThan(4.8);
    expect(Math.abs(state.rearSlip)).toBeLessThan(.09);
  });

  it('suppresses pendulum yaw during a 150 mph left-right transition', () => {
    const state = createVehicleState();
    setRoadSpeed(state, 67);
    let peakRearSlip = 0;
    for (let frame = 0; frame < 42; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .7, steer: 1 }, 1 / 120);
      peakRearSlip = Math.max(peakRearSlip, Math.abs(state.rearSlip));
    }
    for (let frame = 0; frame < 42; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .7, steer: -1 }, 1 / 120);
      peakRearSlip = Math.max(peakRearSlip, Math.abs(state.rearSlip));
    }
    expect(Math.abs(state.yawRate)).toBeLessThan(.24);
    expect(peakRearSlip).toBeLessThan(.085);
  });

  it('changes lateral direction promptly when keyboard steering reverses at 150 mph', () => {
    const state = createVehicleState();
    setRoadSpeed(state, 67);
    for (let frame = 0; frame < 42; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .7, steer: 1 }, 1 / 120);
    }
    const reversalOffset = state.x - roadCenterX(state.z);
    let maximumOldDirectionTravel = 0;
    for (let frame = 0; frame < 54; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .7, steer: -1 }, 1 / 120);
      const roadOffset = state.x - roadCenterX(state.z);
      maximumOldDirectionTravel = Math.max(maximumOldDirectionTravel, roadOffset - reversalOffset);
    }
    expect(maximumOldDirectionTravel).toBeLessThan(1.8);
    expect(state.steering).toBeLessThan(-.45);
    expect(Math.abs(state.lateralSpeed)).toBeLessThan(4.5);
  });

  it('makes the road-frame velocity follow a reversed command at 150 mph', () => {
    const state = createVehicleState();
    setRoadSpeed(state, 67);
    for (let frame = 0; frame < 38; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .65, steer: 1 }, 1 / 120);
    }
    for (let frame = 0; frame < 48; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .65, steer: -1 }, 1 / 120);
    }
    const heading = roadHeading(state.z);
    const roadLateralSpeed = state.vx * Math.cos(heading) - state.vz * Math.sin(heading);
    expect(roadLateralSpeed).toBeLessThan(0);
    expect(Math.abs(state.rearSlip)).toBeLessThan(.085);
  });

  it('builds useful lateral speed quickly for a dense-traffic lane change', () => {
    const state = createVehicleState();
    setRoadSpeed(state, 45);
    for (let frame = 0; frame < 72; frame += 1) {
      stepVehicle(state, { ...idleInput, throttle: .65, steer: 1 }, 1 / 120);
    }
    const heading = roadHeading(state.z);
    const roadLateralSpeed = state.vx * Math.cos(heading) - state.vz * Math.sin(heading);
    expect(roadLateralSpeed).toBeGreaterThan(2.7);
    expect(Math.abs(state.yawRate)).toBeLessThan(.5);
  });
});

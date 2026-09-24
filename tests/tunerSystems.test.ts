import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { animateWheels, isolateBody, rigImportedWheels } from '../src/game/wheelRig';
import { carContact, type CarFootprint } from '../src/game/contact';
import { createDriftState, updateDrift, type DriftInput } from '../src/game/drift';
import { ScoreLedger } from '../src/game/scoreLedger';
import { dialAngle, dampNeedle, RPM_DIAL, SPEED_DIAL } from '../src/game/instruments';
import { applyCollisionImpulse, createVehicleState, HANDLING, stepVehicle } from '../src/game/vehicle';

describe('authored wheel assemblies', () => {
  it('keeps all four actual GLB hubs fixed through spin, steering, reverse, and body lean', async () => {
    const nodeFs = 'node:fs';
    const { readFileSync } = await import(nodeFs) as { readFileSync(path: URL): Uint8Array };
    const file = readFileSync(new URL('../public/models/kitsune-r-spec.glb', import.meta.url));
    const asset = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, '');
    const root = new THREE.Group(); root.add(asset.scene); root.scale.setScalar(1.12);
    const rigs = rigImportedWheels(root);
    expect(rigs).toHaveLength(4);
    expect(rigs.filter(r => r.front)).toHaveLength(2);
    const body = isolateBody(root, rigs.map(r => r.hub));
    const centers = rigs.map(r => r.hub.getWorldPosition(new THREE.Vector3()));
    for (let frame = 0; frame < 240; frame++) {
      body.rotation.set(.04, 0, .06);
      animateWheels(rigs, frame < 120 ? 35 : -35, Math.sin(frame) * .4, false, 1 / 60, root.scale.x);
      root.updateMatrixWorld(true);
      rigs.forEach((rig, i) => {
        expect(rig.hub.getWorldPosition(new THREE.Vector3()).distanceTo(centers[i])).toBeLessThan(1e-6);
        const bounds = new THREE.Box3().setFromObject(rig.spin);
        expect(bounds.getCenter(new THREE.Vector3()).distanceTo(centers[i])).toBeLessThan(.04);
        expect(rig.radius).toBeGreaterThan(.20);
        expect(rig.radius).toBeLessThan(.40);
        expect(rig.meshes.length).toBeGreaterThanOrEqual(2);
      });
    }
  });
});

const car = (changes: Partial<CarFootprint> = {}): CarFootprint => ({ x: 0, z: 0, yaw: 0, halfWidth: .81, halfLength: 2, vx: 0, vz: 50, ...changes });
describe('forgiving oriented contacts', () => {
  it('does not mistake a fast shallow side scrape for a fatal impact', () => {
    const hit = carContact(car({ x: 1.55, vx: -2, vz: 70 }), car({ vz: 20 }));
    expect(hit?.scrape).toBe(true);
    expect(hit?.closingSpeed).toBeCloseTo(2);
    expect(hit!.closingSpeed).toBeLessThan(HANDLING.fatalClosingSpeed);
  });
  it('distinguishes moderate and extreme rear impacts by relative velocity', () => {
    expect(carContact(car({ z: -3.8, vz: 65 }), car())!.closingSpeed).toBe(15);
    expect(carContact(car({ z: -3.8, vz: 85 }), car())!.closingSpeed).toBe(35);
  });
  it('detects a fast swept crossing and rejects non-overlapping oriented cars', () => {
    expect(carContact(car({ z: 5, vz: 1400 }), car({ vz: 0 }), 1 / 120)).not.toBeNull();
    expect(carContact(car({ x: 4, yaw: .5 }), car())).toBeNull();
  });
  it('resolves contacts deterministically without imparting random spin', () => {
    const a = createVehicleState(), b = createVehicleState();
    applyCollisionImpulse(a, 1, 0, 3, true, .2);
    applyCollisionImpulse(b, 1, 0, 3, true, .2);
    expect(a).toEqual(b);
    expect(Math.abs(a.yawRate)).toBeLessThanOrEqual(.1);
  });
});

const sliding: DriftInput = { speedMps: 42, longitudinalSpeed: 38, lateralSpeed: 11, yawRate: .62, handbrake: true, now: 0, dt: 1 / 120, multiplier: 2 };
function establishDrift() {
  let state = createDriftState();
  for (let i = 0; i < 120; i++) state = updateDrift(state, { ...sliding, now: i / 120 }).state;
  return state;
}
describe('drift banking and score accounting', () => {
  it('sustains after releasing the handbrake and never pays during the slide', () => {
    const state = establishDrift();
    const update = updateDrift(state, { ...sliding, handbrake: false });
    expect(update.state.active).toBe(true);
    expect(update.state.points).toBeGreaterThan(state.points);
    expect(update.scoreDelta).toBe(0);
    expect(update.completedPoints).toBe(0);
  });
  it('loses pending points on contact, spins, or reverse before it can bank', () => {
    for (const input of [{ invalidated: true }, { longitudinalSpeed: -38 }, { lateralSpeed: 80 }]) {
      const result = updateDrift(establishDrift(), { ...sliding, ...input });
      expect(result.completedPoints).toBe(0);
      expect(result.state.active).toBe(false);
    }
  });
  it('allows a brief transition and banks exactly once after .35s of recovery', () => {
    let state = establishDrift();
    const settled = { ...sliding, handbrake: false, lateralSpeed: 0, yawRate: 0 };
    for (let i = 0; i < 12; i++) state = updateDrift(state, settled).state;
    expect(state.active).toBe(true);
    state = updateDrift(state, { ...sliding, handbrake: false }).state;
    const expected = Math.round(state.points + state.pendingPoints);
    let paid = 0, count = 0;
    for (let i = 0; i < 120; i++) {
      const update = updateDrift(state, settled); state = update.state;
      paid += update.completedPoints; if (update.completedPoints) count++;
    }
    expect(paid).toBe(expected); expect(count).toBe(1);
  });
  it('reconciles category totals, rejects duplicates, and resets between runs', () => {
    const ledger = new ScoreLedger();
    ledger.award('p:1', 'pass', 400, 1.35);
    ledger.award('d:1', 'draft', 420, 1.35);
    ledger.award('p:1', 'pass', 400, 8);
    expect(ledger.total).toBe(1107);
    expect(Object.values(ledger.totals).reduce((a,b) => a+b,0)).toBe(ledger.total);
    ledger.reset(); expect(ledger.total).toBe(0);
    expect(ledger.award('p:1', 'pass', 100)).toBe(100);
  });
});

describe('calibrated instruments and drivetrain', () => {
  it('uses the same scale at every major mark, including 7800 versus 8000 RPM', () => {
    for (const dial of [SPEED_DIAL, RPM_DIAL]) {
      for (let v = 0; v <= dial.max; v += dial.major) expect(dialAngle(v, dial)).toBeCloseTo(dial.start + v / dial.max * dial.sweep);
    }
    expect(dialAngle(7800, RPM_DIAL)).toBeLessThan(dialAngle(8000, RPM_DIAL));
    expect(dialAngle(-1, SPEED_DIAL)).toBe(SPEED_DIAL.start);
    expect(dialAngle(999, SPEED_DIAL)).toBe(130);
  });
  it('needle damping is independent of display refresh rate', () => {
    let a = 0, b = 0;
    for (let i = 0; i < 30; i++) a = dampNeedle(a, 100, 1 / 30);
    for (let i = 0; i < 120; i++) b = dampNeedle(b, 100, 1 / 120);
    expect(a).toBeCloseTo(b, 8);
  });
  it('preserves grip transition continuity after a handbrake release', () => {
    const state = createVehicleState();
    const input = { throttle: .5, brake: 0, steer: .5, handbrake: true, boost: false };
    for (let i = 0; i < 40; i++) stepVehicle(state, input, 1 / 120);
    const blend = state.driftBlend;
    stepVehicle(state, { ...input, handbrake: false }, 1 / 120);
    expect(state.driftBlend).toBeGreaterThan(blend - .03);
    expect(state.driftBlend).toBeGreaterThan(.5);
  });
});

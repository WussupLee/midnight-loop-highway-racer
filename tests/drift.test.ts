import { describe, expect, it } from 'vitest';
import { bankDriftScore, createDriftState, updateDrift } from '../src/game/drift';

describe('drift scoring', () => {
  it('does not score straight handbrake braking', () => {
    const update = updateDrift(createDriftState(), {
      speedMps: 38, longitudinalSpeed: 38, lateralSpeed: .2, yawRate: .03,
      handbrake: true, now: 1, dt: 1 / 60, multiplier: 1,
    });
    expect(update.state.active).toBe(false);
    expect(update.scoreDelta).toBe(0);
  });

  it('scores an established, physically curved handbrake slide', () => {
    let state = createDriftState();
    let total = 0;
    for (let frame = 0; frame < 90; frame += 1) {
      const update = updateDrift(state, {
        speedMps: 42, longitudinalSpeed: 38, lateralSpeed: 11, yawRate: .62,
        handbrake: true, now: frame / 60, dt: 1 / 60, multiplier: 1.5,
      });
      state = update.state;
      total += update.scoreDelta;
    }
    expect(state.active).toBe(true);
    expect(state.angleDeg).toBeGreaterThan(10);
    expect(state.radiusM).toBeGreaterThan(5);
    expect(total).toBeGreaterThan(90);
  });

  it('starts awarding a deliberate drift within a quarter second', () => {
    let state = createDriftState();
    let total = 0;
    for (let frame = 0; frame < 14; frame += 1) {
      const update = updateDrift(state, {
        speedMps: 40, longitudinalSpeed: 37, lateralSpeed: 9, yawRate: .52,
        handbrake: true, now: frame / 60, dt: 1 / 60, multiplier: 1,
      });
      state = update.state;
      total += update.scoreDelta;
    }
    expect(state.duration).toBeGreaterThan(.2);
    expect(total).toBeGreaterThan(0);
  });

  it('recognizes a shallow handbrake rotation before the car is fully sideways', () => {
    let state = createDriftState();
    let total = 0;
    for (let frame = 0; frame < 8; frame += 1) {
      const update = updateDrift(state, {
        speedMps: 38, longitudinalSpeed: 37.5, lateralSpeed: 3.2, yawRate: .12,
        handbrake: true, now: frame / 60, dt: 1 / 60, multiplier: 1,
      });
      state = update.state;
      total += update.scoreDelta;
    }
    expect(state.active).toBe(true);
    expect(state.angleDeg).toBeLessThan(7);
    expect(total).toBeGreaterThan(0);
  });

  it('commits one completion bonus after a sustained drift ends', () => {
    let state = createDriftState();
    for (let frame = 0; frame < 100; frame += 1) {
      state = updateDrift(state, {
        speedMps: 44, longitudinalSpeed: 39, lateralSpeed: -13, yawRate: -.7,
        handbrake: true, now: frame / 60, dt: 1 / 60, multiplier: 1,
      }).state;
    }
    const ending = updateDrift(state, {
      speedMps: 40, longitudinalSpeed: 40, lateralSpeed: 1, yawRate: .03,
      handbrake: false, now: 2, dt: 1 / 60, multiplier: 1,
    });
    expect(ending.completedPoints).toBeGreaterThanOrEqual(90);
    expect(ending.state.active).toBe(false);
    const next = updateDrift(ending.state, {
      speedMps: 40, longitudinalSpeed: 40, lateralSpeed: 1, yawRate: .03,
      handbrake: false, now: 2.1, dt: 1 / 60, multiplier: 1,
    });
    expect(next.completedPoints).toBe(0);
  });

  it('banks a completed drift into the overall run score once', () => {
    const banked = bankDriftScore(1250, 387.4);
    expect(banked).toEqual({ total: 1637, added: 387 });
    expect(bankDriftScore(banked.total, 0)).toEqual({ total: 1637, added: 0 });
  });
});

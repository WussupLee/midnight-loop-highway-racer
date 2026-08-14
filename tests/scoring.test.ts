import { describe, expect, it } from 'vitest';
import { NearMissTracker, addToCombo, breakCombo, calculateHighSpeedScore, calculateNearMissScore, createCombo, isThreadNeedlePair, speedRiskMultiplier, tickCombo } from '../src/game/scoring';

function passSamples(id: number, clearance: number) {
  const halfWidth = .95;
  const trafficX = halfWidth * 2 + clearance;
  const base = {
    id, playerX: 0, playerHalfWidth: halfWidth, playerHalfLength: 2.2,
    playerSpeed: 56, trafficX, trafficHalfWidth: halfWidth, trafficHalfLength: 2.2,
    trafficSpeed: 25, collided: false,
  };
  return [
    { ...base, now: 0, playerZ: 0, trafficZ: 20 },
    { ...base, now: .38, playerZ: 18, trafficZ: 20 },
    { ...base, now: .56, playerZ: 27, trafficZ: 20 },
  ];
}

describe('near-miss scoring', () => {
  it('rewards a complete close pass only after longitudinal clearance', () => {
    const tracker = new NearMissTracker();
    const samples = passSamples(11, .42);
    expect(tracker.sample(samples[0])).toBeNull();
    expect(tracker.sample(samples[1])).toBeNull();
    const event = tracker.sample(samples[2]);
    expect(event).not.toBeNull();
    expect(event?.perfect).toBe(true);
    expect(event?.points).toBeGreaterThan(700);
  });

  it('rejects a distant pass', () => {
    const tracker = new NearMissTracker();
    let event = null;
    for (const sample of passSamples(12, 2.8)) event = tracker.sample(sample);
    expect(event).toBeNull();
  });

  it('prevents the same traffic identity from scoring twice', () => {
    const tracker = new NearMissTracker();
    const first = passSamples(13, .7).map((sample) => tracker.sample(sample));
    expect(first[2]).not.toBeNull();
    const second = passSamples(13, .3).map((sample) => tracker.sample({ ...sample, now: sample.now + 2 }));
    expect(second.every((value) => value === null)).toBe(true);
  });

  it('invalidates a candidate that makes contact', () => {
    const tracker = new NearMissTracker();
    const samples = passSamples(14, .24);
    tracker.sample(samples[0]);
    tracker.sample({ ...samples[1], collided: true });
    expect(tracker.sample(samples[2])).toBeNull();
  });

  it('makes a 0.5 m pass substantially more valuable than a 2 m pass', () => {
    const close = calculateNearMissScore(.5, 56, 28, 1);
    const far = calculateNearMissScore(2, 56, 28, 1);
    expect(close).toBeGreaterThan(far * 3);
  });

  it('recognizes opposite-side passes from the same overlap window as Thread the Needle', () => {
    const first = { id: 1, time: 1, overlapAt: .5, clearance: .3, playerSpeed: 55, relativeSpeed: 25, side: 'left' as const, perfect: true, points: 1000 };
    const second = { ...first, id: 2, time: 1.8, overlapAt: 1.08, side: 'right' as const };
    expect(isThreadNeedlePair(first, second)).toBe(true);
    expect(isThreadNeedlePair(first, { ...second, overlapAt: 1.3 })).toBe(false);
  });

  it('raises the risk multiplier and continuous score above 100 mph', () => {
    expect(speedRiskMultiplier(99)).toBe(1);
    expect(speedRiskMultiplier(125)).toBeGreaterThan(speedRiskMultiplier(105));
    expect(speedRiskMultiplier(165)).toBe(2);
    expect(calculateHighSpeedScore(99, 1, 2)).toBe(0);
    expect(calculateHighSpeedScore(150, 1, 2)).toBeGreaterThan(calculateHighSpeedScore(105, 1, 2));
  });
});

describe('combo state', () => {
  it('builds inside the timing window and expires outside it', () => {
    let combo = createCombo();
    combo = addToCombo(combo, 1);
    const firstMultiplier = combo.multiplier;
    combo = addToCombo(combo, 2);
    expect(combo.multiplier).toBeGreaterThan(firstMultiplier);
    combo = tickCombo(combo, 5);
    expect(combo.multiplier).toBeGreaterThan(1);
    combo = tickCombo(combo, 6.3);
    expect(combo.multiplier).toBe(1);
    expect(combo.chain).toBe(0);
  });

  it('resets on a major collision and heavily reduces on a scrape', () => {
    let combo = createCombo();
    for (let i = 0; i < 6; i += 1) combo = addToCombo(combo, i * .2);
    const scraped = breakCombo(combo, true);
    expect(scraped.multiplier).toBeLessThan(combo.multiplier);
    expect(scraped.expiresAt).toBe(combo.expiresAt);
    expect(breakCombo(combo, false).multiplier).toBe(1);
  });
});

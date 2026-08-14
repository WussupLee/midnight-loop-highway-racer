import { describe, expect, it } from 'vitest';
import { TRAFFIC_HEADLIGHT_POOL_LENGTH, TRAFFIC_HEADLIGHT_POOL_WIDTH, TRAFFIC_SIGNAL_LEAD_TIME, TRAFFIC_SPAWN_ARCHETYPES, classifyTrafficImpact, initialTrafficPlacement, maximumOccupiedLanesInBand, projectedCollisionFootprint, smoothLaneChange, smoothLaneChangeRate } from '../src/game/traffic';
import { LANE_WIDTH } from '../src/game/world';

describe('traffic formation planning', () => {
  it('keeps at least two lanes open in every opening traffic wave', () => {
    const placements = Array.from({ length: 45 }, (_, index) => {
      const placement = initialTrafficPlacement(index);
      return { lanePosition: placement.lane, z: placement.z };
    });
    expect(maximumOccupiedLanesInBand(placements, 24)).toBeLessThanOrEqual(3);
    expect(new Set(placements.map((item) => item.lanePosition)).size).toBe(5);
  });

  it('can reserve a clear cinematic opening without changing lane formations', () => {
    const normal = initialTrafficPlacement(4);
    const cinematic = initialTrafficPlacement(4, 120);
    expect(cinematic.lane).toBe(normal.lane);
    expect(cinematic.z - normal.z).toBe(120);
  });

  it('frames the cinematic with staggered traffic only in the outside lanes', () => {
    const tableau = Array.from({ length: 4 }, (_, index) => initialTrafficPlacement(index, 120));
    expect(new Set(tableau.map((item) => item.lane))).toEqual(new Set([0, 4]));
    expect(tableau.every((item, index) => index < 2 || item.z >= 118)).toBe(true);
  });

  it('detects a five-wide wall for regression coverage', () => {
    const wall = Array.from({ length: 5 }, (_, lane) => ({ lanePosition: lane, z: 100 + lane * .5 }));
    expect(maximumOccupiedLanesInBand(wall, 24)).toBe(5);
  });

  it('uses the compact body in place of the removed tall-hood sedan', () => {
    expect(TRAFFIC_SPAWN_ARCHETYPES).not.toContain('sedan');
    expect(TRAFFIC_SPAWN_ARCHETYPES.filter((type) => type === 'compact')).toHaveLength(4);
  });

  it('does not spawn any tall ordinary traffic body', () => {
    expect(TRAFFIC_SPAWN_ARCHETYPES).not.toContain('van');
    expect(TRAFFIC_SPAWN_ARCHETYPES).not.toContain('suv');
    expect(TRAFFIC_SPAWN_ARCHETYPES).not.toContain('pickup');
  });

  it('projects traffic headlights across multiple lanes and far ahead', () => {
    expect(TRAFFIC_HEADLIGHT_POOL_WIDTH).toBeCloseTo(8.4 * 3, 6);
    expect(TRAFFIC_HEADLIGHT_POOL_WIDTH).toBeGreaterThan(LANE_WIDTH * 6);
    expect(TRAFFIC_HEADLIGHT_POOL_LENGTH).toBeGreaterThan(32);
  });

  it('signals before moving and eases a lane change to rest at both ends', () => {
    expect(TRAFFIC_SIGNAL_LEAD_TIME).toBeGreaterThanOrEqual(1);
    expect(smoothLaneChange(0)).toBe(0);
    expect(smoothLaneChange(1)).toBe(1);
    expect(smoothLaneChangeRate(0)).toBe(0);
    expect(smoothLaneChangeRate(1)).toBe(0);
    expect(smoothLaneChange(.5)).toBeCloseTo(.5, 6);
    expect(smoothLaneChangeRate(.5)).toBeGreaterThan(1);
  });

  it('treats a shallow high-speed side graze as a survivable scrape', () => {
    const impact = classifyTrafficImpact({
      overlapX: .045,
      overlapZ: 1.25,
      relativeForwardSpeed: 44,
      relativeLateralSpeed: 1.4,
    });
    expect(impact.scrape).toBe(true);
    expect(impact.severity).toBeLessThan(26);
  });

  it('keeps a direct high-relative-speed rear impact severe', () => {
    const impact = classifyTrafficImpact({
      overlapX: 1.1,
      overlapZ: .24,
      relativeForwardSpeed: 40,
      relativeLateralSpeed: 0,
    });
    expect(impact.scrape).toBe(false);
    expect(impact.severity).toBeGreaterThan(36);
  });

  it('expands a rotated collision footprint so drifted corners cannot clip through traffic', () => {
    const straight = projectedCollisionFootprint(.81, 2, 0);
    const sideways = projectedCollisionFootprint(.81, 2, Math.PI / 2);
    expect(straight.halfWidth).toBeCloseTo(.81, 6);
    expect(sideways.halfWidth).toBeCloseTo(2, 6);
    expect(sideways.halfLength).toBeCloseTo(.81, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { createTunnelArchGeometry, highwayChunkStartFor } from '../src/game/world';

describe('highway restart coverage', () => {
  it('rebuilds the starting line with road behind and far ahead', () => {
    const startZ = highwayChunkStartFor(16);
    expect(startZ).toBe(-300);
    expect(startZ).toBeLessThan(16);
    expect(startZ + 28 * 150).toBeGreaterThan(16);
  });

  it('can rebuild around a long-run position without leaving a gap', () => {
    const playerZ = 2819;
    const startZ = highwayChunkStartFor(playerZ);
    expect(startZ).toBeLessThanOrEqual(playerZ - 300);
    expect(startZ + 28 * 150).toBeGreaterThan(playerZ);
  });
});

describe('tunnel geometry', () => {
  it('builds a wide elliptical arch with road-level sides and a raised crown', () => {
    const geometry = createTunnelArchGeometry(150, 12.9, 6.8, 24);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    expect(bounds.min.x).toBeCloseTo(-12.9, 4);
    expect(bounds.max.x).toBeCloseTo(12.9, 4);
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expect(bounds.max.y).toBeCloseTo(6.8, 4);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(150, 4);
    geometry.dispose();
  });
});

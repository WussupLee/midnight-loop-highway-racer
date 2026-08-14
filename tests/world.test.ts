import { describe, expect, it } from 'vitest';
import { highwayChunkStartFor } from '../src/game/world';

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

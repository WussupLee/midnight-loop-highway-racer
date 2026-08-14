import { describe, expect, it } from 'vitest';
import { createTunnelArchGeometry, highwayChunkStartFor, highwaySignDescriptor, highwaySignIndex, OUTER_EDGE_LINE_SEGMENT_LENGTH, ROAD_MARK_SPACING, TUNNEL_AMBIENT_COLOR, TUNNEL_CEILING_LIGHT_COLOR, TUNNEL_CEILING_LIGHT_HEIGHT } from '../src/game/world';

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

  it('keeps warm fixtures near the crown while using separate blue-green illumination', () => {
    expect(TUNNEL_CEILING_LIGHT_COLOR).toBe(0xffa64b);
    expect(TUNNEL_AMBIENT_COLOR).toBe(0x36c9c1);
    expect(TUNNEL_CEILING_LIGHT_HEIGHT).toBeGreaterThan(6);
    expect(TUNNEL_CEILING_LIGHT_HEIGHT).toBeLessThan(6.8);
  });
});

describe('highway lane markings', () => {
  it('keeps both outer shoulder lines visually continuous', () => {
    expect(OUTER_EDGE_LINE_SEGMENT_LENGTH).toBeGreaterThan(ROAD_MARK_SPACING);
  });
});

describe('highway exit signage', () => {
  it('starts at exit 50 and increases deterministically at every later sign', () => {
    const signs = Array.from({ length: 12 }, (_, index) => highwaySignDescriptor(index));
    expect(signs[0].exitNumber).toBe(50);
    for (let index = 1; index < signs.length; index += 1) {
      expect(signs[index].exitNumber).toBeGreaterThan(signs[index - 1].exitNumber);
      expect(signs[index].exitNumber - signs[index - 1].exitNumber).toBeLessThanOrEqual(3);
    }
  });

  it('places the first forward sign in chunk 2 and then every seven chunks', () => {
    expect(highwaySignIndex(-2)).toBeNull();
    expect(highwaySignIndex(2)).toBe(0);
    expect(highwaySignIndex(9)).toBe(1);
    expect(highwaySignIndex(16)).toBe(2);
    expect(highwaySignIndex(8)).toBeNull();
  });

  it('varies street names and sign sides without changing between runs', () => {
    const signs = Array.from({ length: 12 }, (_, index) => highwaySignDescriptor(index));
    expect(new Set(signs.map((sign) => sign.streetName)).size).toBeGreaterThan(4);
    expect(new Set(signs.map((sign) => sign.side))).toEqual(new Set(['left', 'right']));
    expect(highwaySignDescriptor(5)).toEqual(highwaySignDescriptor(5));
  });
});

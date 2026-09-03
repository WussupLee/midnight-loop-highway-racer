import { describe, expect, it } from 'vitest';
import { configureRoadRoute, createTunnelArchGeometry, getRoadRouteSeed, HIGHWAY_CHUNK_LENGTH, highwayChunkStartFor, highwaySignDescriptor, highwaySignIndex, isTunnelChunkNumber, OUTER_EDGE_LINE_SEGMENT_LENGTH, ROAD_CURVE_CELL_LENGTH, ROAD_MARK_SPACING, roadCenterX, roadHeading, TUNNEL_AMBIENT_COLOR, TUNNEL_CEILING_LIGHT_COLOR, TUNNEL_CEILING_LIGHT_HEIGHT, TUNNEL_CONDUIT_COUNT, TUNNEL_PANEL_SPACING, TUNNEL_UNIFORM_FILL_INTENSITY, TUNNEL_VENT_SPACING, TUNNEL_ZONE_CHUNKS, tunnelAcousticAmount, tunnelWallDetailPlan } from '../src/game/world';

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

describe('randomized gradual freeway curves', () => {
  it('recreates the same route from one seed and a different route from another', () => {
    configureRoadRoute(12051);
    const first = Array.from({ length: 50 }, (_, index) => roadCenterX(index * 120));
    configureRoadRoute(12051);
    const replay = Array.from({ length: 50 }, (_, index) => roadCenterX(index * 120));
    configureRoadRoute(77291);
    const alternate = Array.from({ length: 50 }, (_, index) => roadCenterX(index * 120));
    expect(replay).toEqual(first);
    expect(alternate).not.toEqual(first);
    expect(getRoadRouteSeed()).toBe(77291);
    configureRoadRoute(481516);
  });

  it('mixes gradual and sharper transitions while staying freeway-safe', () => {
    configureRoadRoute(12051);
    const samples = Array.from({ length: 3600 }, (_, index) => index * 5);
    const curvedHeadings = samples.map((z) => Math.abs(roadHeading(z))).filter((heading) => heading > .004);
    expect(samples.some((z) => Math.abs(roadCenterX(z)) > 5)).toBe(true);
    expect(curvedHeadings.some((heading) => heading < .055)).toBe(true);
    expect(curvedHeadings.some((heading) => heading > .09)).toBe(true);
    expect(Math.max(...curvedHeadings)).toBeLessThan(8.2 * Math.PI / 180);
    for (let cell = 0; cell < 18; cell += 1) {
      const recoveryZ = (cell + 1) * ROAD_CURVE_CELL_LENGTH - 55;
      expect(Math.abs(roadHeading(recoveryZ))).toBeLessThan(.002);
    }
    configureRoadRoute(481516);
  });

  it('guarantees a visible bend early in every run', () => {
    for (const seed of [1, 17, 12051, 77291, 481516, 2147483646]) {
      configureRoadRoute(seed);
      const openingHeadings = Array.from({ length: 140 }, (_, index) => Math.abs(roadHeading(index * 5)));
      expect(Math.max(...openingHeadings)).toBeGreaterThan(.025);
      expect(Array.from({ length: 7 }, (_, chunk) => isTunnelChunkNumber(chunk)).some(Boolean)).toBe(false);
    }
    configureRoadRoute(481516);
  });
});

describe('tunnel geometry', () => {
  it('fades tunnel acoustics in at the portals and holds them through the interior', () => {
    configureRoadRoute(481516);
    const entranceChunk = Array.from({ length: TUNNEL_ZONE_CHUNKS }, (_, chunk) => chunk)
      .find((chunk) => isTunnelChunkNumber(chunk))!;
    const entranceZ = entranceChunk * HIGHWAY_CHUNK_LENGTH;
    expect(tunnelAcousticAmount(entranceZ - .1)).toBe(0);
    expect(tunnelAcousticAmount(entranceZ)).toBe(0);
    expect(tunnelAcousticAmount(entranceZ + 16)).toBeCloseTo(.5);
    expect(tunnelAcousticAmount(entranceZ + 32)).toBe(1);
  });

  it('varies tunnel spacing and length reproducibly with the route seed', () => {
    configureRoadRoute(12051);
    const first = Array.from({ length: 96 }, (_, chunk) => isTunnelChunkNumber(chunk));
    configureRoadRoute(12051);
    expect(Array.from({ length: 96 }, (_, chunk) => isTunnelChunkNumber(chunk))).toEqual(first);
    configureRoadRoute(77291);
    expect(Array.from({ length: 96 }, (_, chunk) => isTunnelChunkNumber(chunk))).not.toEqual(first);

    configureRoadRoute(12051);
    const tunnelRuns: number[] = [];
    for (let chunk = 0; chunk < first.length; chunk += 1) {
      if (!first[chunk]) continue;
      let length = 0;
      while (chunk < first.length && first[chunk]) {
        length += 1;
        chunk += 1;
      }
      tunnelRuns.push(length);
    }
    expect(new Set(tunnelRuns).size).toBeGreaterThan(1);
    configureRoadRoute(481516);
  });
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
    expect(TUNNEL_UNIFORM_FILL_INTENSITY).toBeGreaterThan(.7);
    expect(Array.from({ length: TUNNEL_ZONE_CHUNKS }, (_, chunk) => isTunnelChunkNumber(chunk)).some(Boolean)).toBe(true);
  });

  it('layers frequent constructed wall panels, vents, conduits, and service boxes', () => {
    const details = tunnelWallDetailPlan(150);
    expect(TUNNEL_PANEL_SPACING).toBeLessThanOrEqual(10);
    expect(TUNNEL_VENT_SPACING).toBeLessThanOrEqual(30);
    expect(details.panelCountPerSide).toBeGreaterThanOrEqual(15);
    expect(details.seamCountPerSide).toBe(details.panelCountPerSide + 1);
    expect(details.ventCountPerSide).toBeGreaterThanOrEqual(5);
    expect(details.slatsPerVent).toBeGreaterThanOrEqual(5);
    expect(details.serviceBoxCountPerSide).toBeGreaterThanOrEqual(3);
    expect(details.conduitCount).toBe(TUNNEL_CONDUIT_COUNT);
    expect(details.conduitCount).toBeGreaterThanOrEqual(4);
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

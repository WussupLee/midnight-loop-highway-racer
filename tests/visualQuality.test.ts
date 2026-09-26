import { expect, it } from 'vitest';
import { measurePixels, qualityFailures } from './visual/metrics';
const rect = { x: 0, y: 0, width: 64, height: 64 };
function sample(body = 128, start = 16, end = 48) {
  const fg = { width: 64, height: 64, data: new Uint8Array(64 * 64 * 4).fill(8) };
  const bg = { ...fg, data: fg.data.slice() }, mask = { ...fg, data: new Uint8Array(fg.data.length) };
  for (let y = start; y < end; y++) for (let x = start; x < end; x++) for (let c = 0; c < 3; c++) {
    const i = (y * 64 + x) * 4 + c; fg.data[i] = body; mask.data[i] = 255;
  }
  return { fg, bg, mask };
}
function check(s: ReturnType<typeof sample>) { return qualityFailures(measurePixels(s.fg, s.bg, s.mask, rect, rect), rect, 64); }
it('accepts visible bodywork with clear framing', () => expect(check(sample())).toEqual([]));
it('rejects a dark car even when a few headlights are bright', () => {
  const s = sample(8); s.fg.data.fill(255, (20 * 64 + 20) * 4, (20 * 64 + 28) * 4);
  expect(check(s)).toContain('body loses contrast against background');
});
it('rejects excessive zoom and clipping', () => expect(check(sample(128, 0, 64))).toContain('vehicle outside preview opening'));
it('rejects a vehicle too small to inspect', () => expect(check(sample(128, 30, 34))).toContain('missing or tiny vehicle'));
it('rejects blown-out bodywork', () => expect(check(sample(255))).toContain('body highlights overexposed'));

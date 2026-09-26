interface Pixels { width: number; height: number; data: Uint8Array }
interface Rect { x: number; y: number; width: number; height: number }
const linear = (value: number) => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; };
const luminance = (data: Uint8Array, i: number) => .2126 * linear(data[i]) + .7152 * linear(data[i + 1]) + .0722 * linear(data[i + 2]);

export function measurePixels(fg: Pixels, bg: Pixels, mask: Pixels, rect: Rect, viewport: { width: number; height: number }) {
  if ([bg, mask].some(image => image.width !== fg.width || image.height !== fg.height)) throw new Error('Mismatched captures');
  let minX = fg.width, maxX = 0, minY = fg.height, maxY = 0, visible = 0, count = 0, clipped = 0;
  const contrasts: number[] = [], lights: number[] = [];
  for (let y = 0; y < fg.height; y++) for (let x = 0; x < fg.width; x++) {
    const i = (y * fg.width + x) * 4;
    if (mask.data[i] < 200) continue;
    count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    const a = luminance(fg.data, i), b = luminance(bg.data, i);
    const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    contrasts.push(ratio); lights.push(a);
    if (a > .9) clipped++;
    if (ratio >= 1.3 && Math.abs(a - b) >= .025) visible++;
  }
  contrasts.sort((a, b) => a - b); lights.sort((a, b) => a - b);
  const scale = fg.width / viewport.width;
  return { count, minX: minX / scale, maxX: maxX / scale, minY: minY / scale, maxY: maxY / scale,
    widthFraction: (maxX - minX) / scale / rect.width,
    medianContrast: contrasts[Math.floor(count / 2)] ?? 0, medianLuminance: lights[Math.floor(count / 2)] ?? 0,
    visibleFraction: count ? visible / count : 0, clippedFraction: count ? clipped / count : 0 };
}

/** Art-direction guardrails, not text/WCAG contrast claims. Majority body visibility beats bright lamps. */
export function qualityFailures(m: ReturnType<typeof measurePixels>, rect: Rect, height: number) {
  const failures: string[] = [];
  if (m.count <= 500) failures.push('missing or tiny vehicle');
  if (m.minX <= rect.x + 8 || m.maxX >= rect.x + rect.width - 8 || m.minY <= Math.max(0, rect.y) + 8 || m.maxY >= Math.min(height, rect.y + rect.height) - 8) failures.push('vehicle outside preview opening');
  if (m.widthFraction <= .24 || m.widthFraction >= .86) failures.push('vehicle zoom outside readable range');
  if (m.medianContrast <= 1.45 || m.medianLuminance <= .055 || m.visibleFraction <= .55) failures.push('body loses contrast against background');
  if (m.clippedFraction >= .2) failures.push('body highlights overexposed');
  return failures;
}

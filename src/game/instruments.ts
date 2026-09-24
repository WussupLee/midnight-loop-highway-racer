export interface DialDefinition { max: number; major: number; minor: number; start: number; sweep: number; label: string; redline?: number }
export const SPEED_DIAL: DialDefinition = { max: 220, major: 20, minor: 5, start: -130, sweep: 260, label: 'MPH' };
export const RPM_DIAL: DialDefinition = { max: 8000, major: 1000, minor: 250, start: -130, sweep: 260, label: 'RPM ×1000', redline: 7200 };
export function dialAngle(value: number, dial: DialDefinition): number {
  return dial.start + Math.max(0, Math.min(1, value / dial.max)) * dial.sweep;
}
export function dampNeedle(current: number, target: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) * 18));
}
export function dialMarkup(dial: DialDefinition, needleId: string): string {
  const point = (radius: number, angle: number) => {
    const radians = angle * Math.PI / 180;
    return `${(120 + Math.sin(radians) * radius).toFixed(2)},${(120 - Math.cos(radians) * radius).toFixed(2)}`;
  };
  let ticks = '';
  for (let value = 0; value <= dial.max; value += dial.minor) {
    const angle = dialAngle(value, dial), major = value % dial.major === 0;
    const color = dial.redline !== undefined && value >= dial.redline ? '#ec6044' : '#e7e1ce';
    ticks += `<polyline points="${point(major ? 89 : 95, angle)} ${point(102, angle)}" stroke="${color}" stroke-width="${major ? 2 : .8}"/>`;
    if (major) ticks += `<text x="${point(76, angle).split(',')[0]}" y="${point(76, angle).split(',')[1]}" fill="${color}" class="dial-number">${dial.max === 8000 ? value / 1000 : value}</text>`;
  }
  return `<svg viewBox="0 0 240 240" class="instrument-face" aria-hidden="true"><circle cx="120" cy="120" r="116" class="dial-bezel"/><circle cx="120" cy="120" r="109" class="dial-face"/>${ticks}<text x="120" y="155" class="dial-unit">${dial.label}</text><text x="120" y="67" class="dial-brand">MIDNIGHT</text><g id="${needleId}" style="transform-origin:120px 120px;transform:rotate(${dial.start}deg)"><path d="M117 138 L118.5 29 L120 21 L121.5 29 L123 138Z" fill="#f56d40"/><path d="M119 40 L120 24 L121 40" fill="#fff1c9"/></g><circle cx="120" cy="120" r="10" fill="#161817" stroke="#888b7e"/><circle cx="120" cy="120" r="4" fill="#363930"/></svg>`;
}

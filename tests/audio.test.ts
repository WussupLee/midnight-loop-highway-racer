import { describe, expect, it } from 'vitest';
import { resolveMusicUrl, speedAudioProfile } from '../src/game/audio';

describe('hosted music path', () => {
  it('keeps the soundtrack inside a GitHub Pages repository subpath', () => {
    expect(resolveMusicUrl('https://wussuplee.github.io/midnight-loop-highway-racer/'))
      .toBe('https://wussuplee.github.io/midnight-loop-highway-racer/audio/midnight-loop-background.mp3');
  });

  it('also resolves correctly from the local development root', () => {
    expect(resolveMusicUrl('http://127.0.0.1:4175/'))
      .toBe('http://127.0.0.1:4175/audio/midnight-loop-background.mp3');
  });
});

describe('speed-dependent atmosphere', () => {
  it('keeps low-speed music full while building wind and removing bass only at high speed', () => {
    const citySpeed = speedAudioProfile(65);
    const highwaySpeed = speedAudioProfile(110);
    const extremeSpeed = speedAudioProfile(165);
    expect(citySpeed.wind).toBe(0);
    expect(citySpeed.musicHighpassHz).toBe(20);
    expect(highwaySpeed.wind).toBeGreaterThan(0);
    expect(highwaySpeed.musicHighpassHz).toBeGreaterThan(20);
    expect(extremeSpeed.wind).toBeGreaterThan(highwaySpeed.wind);
    expect(extremeSpeed.musicHighpassHz).toBeGreaterThanOrEqual(600);
  });
});

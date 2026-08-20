import { describe, expect, it } from 'vitest';
import { resolveMusicUrl, resolveTrafficHornUrl, speedAudioProfile, trafficPassProfile } from '../src/game/audio';

describe('hosted music path', () => {
  it('keeps the soundtrack inside a GitHub Pages repository subpath', () => {
    expect(resolveMusicUrl('https://wussuplee.github.io/midnight-loop-highway-racer/'))
      .toBe('https://wussuplee.github.io/midnight-loop-highway-racer/audio/midnight-loop-background.mp3');
  });

  it('also resolves correctly from the local development root', () => {
    expect(resolveMusicUrl('http://127.0.0.1:4175/'))
      .toBe('http://127.0.0.1:4175/audio/midnight-loop-background.mp3');
  });

  it('keeps the recorded traffic horn inside the active deployment path', () => {
    expect(resolveTrafficHornUrl('https://wussuplee.github.io/midnight-loop-highway-racer/'))
      .toBe('https://wussuplee.github.io/midnight-loop-highway-racer/audio/traffic-car-horn.ogg');
  });
});

describe('speed-dependent atmosphere', () => {
  it('removes music bass below 95 mph and restores it above that threshold', () => {
    const citySpeed = speedAudioProfile(65);
    const thresholdSpeed = speedAudioProfile(95);
    const highwaySpeed = speedAudioProfile(110);
    const extremeSpeed = speedAudioProfile(165);
    expect(citySpeed.wind).toBe(0);
    expect(citySpeed.musicHighpassHz).toBe(620);
    expect(thresholdSpeed.musicHighpassHz).toBe(620);
    expect(highwaySpeed.wind).toBeGreaterThan(0);
    expect(highwaySpeed.musicHighpassHz).toBe(20);
    expect(extremeSpeed.wind).toBeGreaterThan(highwaySpeed.wind);
    expect(extremeSpeed.musicHighpassHz).toBe(20);
  });

  it('keeps every completed pass audible and strengthens close fast passes', () => {
    const distantSlowPass = trafficPassProfile(1, 14.5);
    const closeFastPass = trafficPassProfile(32, 2.2);
    expect(distantSlowPass.airGain).toBeGreaterThanOrEqual(.11);
    expect(distantSlowPass.bodyGain).toBeGreaterThanOrEqual(.045);
    expect(closeFastPass.airGain).toBeGreaterThan(distantSlowPass.airGain);
    expect(closeFastPass.bodyGain).toBeGreaterThan(distantSlowPass.bodyGain);
    expect(closeFastPass.duration).toBeLessThan(distantSlowPass.duration);
  });
});

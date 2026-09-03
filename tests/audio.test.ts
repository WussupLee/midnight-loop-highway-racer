import { describe, expect, it } from 'vitest';
import {
  SOUND_FILES,
  enginePlaybackRate,
  resolveMusicUrl,
  resolveSoundUrl,
  resolveTrafficHornUrl,
  speedAudioProfile,
  tireAudioProfile,
  trafficPassProfile,
} from '../src/game/audio';

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

  it('resolves every replacement recording relative to the active deployment', () => {
    for (const sound of Object.keys(SOUND_FILES) as Array<keyof typeof SOUND_FILES>) {
      expect(resolveSoundUrl(sound, 'https://example.com/racer/'))
        .toBe(`https://example.com/racer/audio/${SOUND_FILES[sound]}`);
    }
  });
});

describe('sample-driven vehicle mix', () => {
  it('tracks engine RPM continuously and clamps playback outside the rev range', () => {
    expect(enginePlaybackRate(900)).toBeCloseTo(.78);
    expect(enginePlaybackRate(7800)).toBeCloseTo(2.33);
    expect(enginePlaybackRate(4800)).toBeGreaterThan(enginePlaybackRate(2200));
    expect(enginePlaybackRate(-100)).toBeCloseTo(.78);
    expect(enginePlaybackRate(12000)).toBeCloseTo(2.33);
  });

  it('layers a stronger screech over scrub for a fast handbrake drift', () => {
    const rolling = tireAudioProfile(.04, 32, false, 0);
    const braking = tireAudioProfile(.08, 32, false, 1);
    const drifting = tireAudioProfile(.82, 32, true, 0);
    expect(rolling.scrub).toBe(0);
    expect(braking.scrub).toBeGreaterThan(rolling.scrub);
    expect(drifting.scrub).toBeGreaterThan(braking.scrub);
    expect(drifting.screech).toBeGreaterThan(drifting.scrub);
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

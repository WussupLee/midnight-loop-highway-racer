import { describe, expect, it } from 'vitest';
import {
  ENGINE_OPTIONS,
  SOUND_FILES,
  enginePlaybackRate,
  engineVolumeProfile,
  isEngineOption,
  resolveMusicUrl,
  resolveSoundUrl,
  resolveTrafficHornUrl,
  speedAudioProfile,
  tireAudioProfile,
  trafficPassProfile,
  tunnelMixProfile,
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
    expect(enginePlaybackRate(900)).toBeCloseTo(.7);
    expect(enginePlaybackRate(7800)).toBeCloseTo(1.48);
    expect(enginePlaybackRate(4800)).toBeGreaterThan(enginePlaybackRate(2200));
    expect(enginePlaybackRate(-100)).toBeCloseTo(.7);
    expect(enginePlaybackRate(12000)).toBeCloseTo(1.48);
  });

  it('provides three validated engine choices with distinct rising pitch curves', () => {
    expect(ENGINE_OPTIONS).toEqual(['street-sedan', '4age-intake', '4age-exhaust', 'performance-gt', 'track-high-rev']);
    for (const option of ENGINE_OPTIONS) {
      expect(isEngineOption(option)).toBe(true);
      expect(enginePlaybackRate(7800, option)).toBeGreaterThan(enginePlaybackRate(900, option));
    }
    expect(isEngineOption('diesel-truck')).toBe(false);
    expect(new Set(ENGINE_OPTIONS.map(option => enginePlaybackRate(7800, option))).size).toBe(5);
    expect(enginePlaybackRate(7800, 'track-high-rev')).toBeGreaterThan(enginePlaybackRate(7800, 'performance-gt'));
  });

  it('makes throttle and rising RPM clearly louder than idle', () => {
    const idle = engineVolumeProfile(900, 0);
    const cruising = engineVolumeProfile(3200, .28);
    const accelerating = engineVolumeProfile(6200, 1);
    expect(idle).toBeGreaterThanOrEqual(.1);
    expect(cruising).toBeGreaterThan(idle);
    expect(accelerating).toBeGreaterThan(cruising * 2);
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
    expect(citySpeed.wind).toBeGreaterThan(0);
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
    expect(distantSlowPass.airGain).toBeGreaterThanOrEqual(.2);
    expect(distantSlowPass.bodyGain).toBeGreaterThanOrEqual(.1);
    expect(closeFastPass.airGain).toBeGreaterThan(distantSlowPass.airGain);
    expect(closeFastPass.bodyGain).toBeGreaterThan(distantSlowPass.bodyGain);
    expect(closeFastPass.duration).toBeLessThan(distantSlowPass.duration);
  });
});

describe('tunnel acoustics', () => {
  it('adds filtered reflections and low-mid body while suppressing exterior ambience', () => {
    const openRoad = tunnelMixProfile(0);
    const tunnel = tunnelMixProfile(1);
    expect(openRoad.earlyReflectionGain).toBe(0);
    expect(openRoad.reverbGain).toBe(0);
    expect(tunnel.dryGain).toBeGreaterThan(openRoad.dryGain);
    expect(tunnel.earlyReflectionGain).toBeGreaterThan(0);
    expect(tunnel.reverbGain).toBeGreaterThan(tunnel.earlyReflectionGain);
    expect(tunnel.lowMidBodyGain).toBeGreaterThan(0);
    expect(tunnel.reflectionLowpassHz).toBeLessThan(openRoad.reflectionLowpassHz);
    expect(tunnel.exteriorAmbience).toBeLessThan(.2);
    expect(tunnel.windExposure).toBeLessThan(openRoad.windExposure);
  });

  it('clamps invalid enclosure values', () => {
    expect(tunnelMixProfile(-2)).toEqual(tunnelMixProfile(0));
    expect(tunnelMixProfile(4)).toEqual(tunnelMixProfile(1));
  });
});

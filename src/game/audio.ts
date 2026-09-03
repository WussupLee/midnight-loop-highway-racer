import type { VehicleState } from './vehicle';

export const SOUND_FILES = {
  engineStreetSedan: 'engine-street-sedan.mp3',
  engine4ageIntake: 'engine-4age-intake.mp3',
  engine4ageExhaust: 'engine-4age-exhaust.mp3',
  enginePerformanceGt: 'engine-performance-gt.wav',
  engineTrackHighRev: 'engine-track-high-rev.wav',
  engineStart: 'engine-start.wav',
  tireScreech: 'tire-screech.ogg',
  tireScrub: 'tire-scrub.ogg',
  tireSqueakAlt: 'tire-squeak-alt.mp3',
  roadRoll: 'road-roll.ogg',
  windLoop: 'wind-loop.ogg',
  cityNight: 'city-night-loop.mp3',
  boostLaunch: 'boost-launch.mp3',
  boostWhoosh: 'boost-whoosh.ogg',
  trafficPass: 'traffic-car-pass.ogg',
  trafficHorn: 'traffic-car-horn.ogg',
  crashBody: 'crash-body.ogg',
  crashMetalHeavy: 'crash-metal-heavy.ogg',
  crashMetalSheet: 'crash-metal-sheet.ogg',
  crashDebris: 'crash-debris.ogg',
  gearShift: 'gear-shift-clunk.ogg',
  uiClick: 'ui-click.ogg',
  rewardNearMiss: 'reward-near-miss.ogg',
  rewardPerfect: 'reward-perfect.ogg',
  rewardDrift: 'reward-drift.ogg',
} as const;

type SoundId = keyof typeof SOUND_FILES;

export const ENGINE_OPTIONS = ['street-sedan', '4age-intake', '4age-exhaust', 'performance-gt', 'track-high-rev'] as const;
export type EngineOption = typeof ENGINE_OPTIONS[number];

const ENGINE_SOUND_IDS: Record<EngineOption, SoundId> = {
  'street-sedan': 'engineStreetSedan',
  '4age-intake': 'engine4ageIntake',
  '4age-exhaust': 'engine4ageExhaust',
  'performance-gt': 'enginePerformanceGt',
  'track-high-rev': 'engineTrackHighRev',
};

const ENGINE_PROFILE = {
  'street-sedan': { rateFloor: .7, rateRange: .78, toneBase: 1850, toneRange: 3300, throttleTone: 1450, trim: 1.04 },
  '4age-intake': { rateFloor: .66, rateRange: .94, toneBase: 2350, toneRange: 3300, throttleTone: 1450, trim: .86 },
  '4age-exhaust': { rateFloor: .68, rateRange: .88, toneBase: 2050, toneRange: 3300, throttleTone: 1450, trim: .78 },
  'performance-gt': { rateFloor: .72, rateRange: .72, toneBase: 2150, toneRange: 2850, throttleTone: 1050, trim: .9 },
  'track-high-rev': { rateFloor: .62, rateRange: 1.04, toneBase: 2750, toneRange: 3900, throttleTone: 1700, trim: .84 },
} as const satisfies Record<EngineOption, {
  rateFloor: number;
  rateRange: number;
  toneBase: number;
  toneRange: number;
  throttleTone: number;
  trim: number;
}>;

export function isEngineOption(value: string | null): value is EngineOption {
  return ENGINE_OPTIONS.includes(value as EngineOption);
}

export function resolveMusicUrl(baseUri: string): string {
  return new URL('audio/midnight-loop-background.mp3', baseUri).href;
}

export function resolveSoundUrl(sound: SoundId, baseUri: string): string {
  return new URL(`audio/${SOUND_FILES[sound]}`, baseUri).href;
}

export function resolveTrafficHornUrl(baseUri: string): string {
  return resolveSoundUrl('trafficHorn', baseUri);
}

export function enginePlaybackRate(rpm: number, option: EngineOption = 'street-sedan'): number {
  const normalized = Math.min(1, Math.max(0, (rpm - 900) / 6900));
  const profile = ENGINE_PROFILE[option];
  return profile.rateFloor + normalized * profile.rateRange;
}

export function engineVolumeProfile(rpm: number, throttle: number, coasting = false): number {
  const normalizedRpm = Math.min(1, Math.max(0, (rpm - 900) / 6900));
  const normalizedThrottle = Math.min(1, Math.max(0, throttle));
  return .105 + normalizedThrottle * .285 + normalizedRpm * .055 + (coasting ? .018 : 0);
}

export function speedAudioProfile(speedMph: number): { wind: number; musicHighpassHz: number } {
  const wind = Math.min(1, Math.max(0, (speedMph - 36) / 124));
  const bassReturn = Math.min(1, Math.max(0, (speedMph - 95) / 14));
  const smoothBassReturn = bassReturn * bassReturn * (3 - 2 * bassReturn);
  return {
    wind: Math.pow(wind, 1.35),
    musicHighpassHz: 20 + (1 - smoothBassReturn) * 600,
  };
}

export function tireAudioProfile(
  tireSlip: number,
  speedMps: number,
  handbrakeActive: boolean,
  brake: number,
): { scrub: number; screech: number } {
  const speed = Math.min(1, Math.max(0, (speedMps - 4) / 36));
  const slip = Math.max(0, tireSlip - .055);
  const handbrake = handbrakeActive ? Math.min(1, speedMps / 18) : 0;
  const serviceBrake = brake * Math.min(1, speedMps / 28);
  return {
    scrub: Math.min(1, (slip * .72 + handbrake * .42 + serviceBrake * .16) * speed),
    screech: Math.min(1, (Math.max(0, slip - .18) * .9 + handbrake * .66 + Math.max(0, serviceBrake - .62) * .3) * speed),
  };
}

export function trafficPassProfile(relativeSpeed: number, lateralDistance: number): { duration: number; airGain: number; bodyGain: number } {
  const speed = Math.min(1, Math.max(0, (relativeSpeed - .5) / 34));
  const proximity = 1 - Math.min(1, Math.max(0, (lateralDistance - 1.8) / 13));
  return {
    duration: .82 - speed * .31,
    airGain: .2 + speed * .21 + proximity * .14,
    bodyGain: .11 + speed * .13 + proximity * .09,
  };
}

export interface TunnelMixProfile {
  dryGain: number;
  earlyReflectionGain: number;
  reverbGain: number;
  lowMidBodyGain: number;
  exteriorAmbience: number;
  windExposure: number;
  reflectionLowpassHz: number;
}

export function tunnelMixProfile(amount: number): TunnelMixProfile {
  const enclosed = Math.min(1, Math.max(0, amount));
  return {
    dryGain: 1 + enclosed * .12,
    earlyReflectionGain: enclosed * .14,
    reverbGain: enclosed * .23,
    lowMidBodyGain: enclosed * .11,
    exteriorAmbience: 1 - enclosed * .9,
    windExposure: 1 - enclosed * .42,
    reflectionLowpassHz: 5200 - enclosed * 1700,
  };
}

interface PlayOptions {
  volume: number;
  rate?: number;
  pan?: number;
  delay?: number;
  duration?: number;
  offset?: number;
  filterType?: BiquadFilterType;
  filterHz?: number;
  filterQ?: number;
  attack?: number;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private effectsDryGain: GainNode | null = null;
  private tunnelEarlyGain: GainNode | null = null;
  private tunnelReverbGain: GainNode | null = null;
  private tunnelLowMidGain: GainNode | null = null;
  private tunnelReflectionLowpass: BiquadFilterNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private musicHighpass: BiquadFilterNode | null = null;
  private buffers = new Map<SoundId, AudioBuffer>();
  private assetPromise: Promise<void> | null = null;

  private engineSources: AudioBufferSourceNode[] = [];
  private engineFilters: BiquadFilterNode[] = [];
  private engineGains: GainNode[] = [];
  private engineOption: EngineOption = 'street-sedan';
  private roadSource: AudioBufferSourceNode | null = null;
  private roadFilter: BiquadFilterNode | null = null;
  private roadGain: GainNode | null = null;
  private citySource: AudioBufferSourceNode | null = null;
  private cityFilter: BiquadFilterNode | null = null;
  private cityGain: GainNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private boostSource: AudioBufferSourceNode | null = null;
  private boostFilter: BiquadFilterNode | null = null;
  private boostGain: GainNode | null = null;
  private tireScrubSource: AudioBufferSourceNode | null = null;
  private tireScrubFilter: BiquadFilterNode | null = null;
  private tireScrubGain: GainNode | null = null;
  private tireScreechSource: AudioBufferSourceNode | null = null;
  private tireScreechFilter: BiquadFilterNode | null = null;
  private tireScreechGain: GainNode | null = null;

  private muted = false;
  private lastThrottle = 0;
  private lastBrake = 0;
  private lastBoostActive = false;
  private lastHornAt = -10;
  private nextDriftAccentAt = -1;
  private shiftDuckUntil = -1;

  setEngineOption(option: EngineOption, preview = false): void {
    this.engineOption = option;
    if (!preview) return;
    this.playBuffer(ENGINE_SOUND_IDS[option], {
      volume: .24,
      rate: enginePlaybackRate(3900, option),
      duration: 1.05,
      offset: .12,
      filterType: 'lowpass',
      filterHz: ENGINE_PROFILE[option].toneBase + 2500,
      attack: .035,
    });
  }

  getEngineOption(): EngineOption { return this.engineOption; }

  async start(playIgnition = false): Promise<void> {
    if (this.context) {
      await this.context.resume();
      await this.playMusic();
      await this.assetPromise;
      if (playIgnition) this.playBuffer('engineStart', { volume: .32, filterType: 'lowpass', filterHz: 4200 });
      return;
    }

    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = .72;
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = .003;
    compressor.release.value = .18;
    this.master.connect(compressor).connect(this.context.destination);
    this.setupTunnelAcoustics();

    this.music = new Audio(resolveMusicUrl(document.baseURI));
    this.music.loop = true;
    this.music.preload = 'auto';
    this.music.volume = 1;
    const musicSource = this.context.createMediaElementSource(this.music);
    this.musicHighpass = this.context.createBiquadFilter();
    this.musicHighpass.type = 'highpass';
    this.musicHighpass.frequency.value = 20;
    this.musicHighpass.Q.value = .58;
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = .31;
    musicSource.connect(this.musicHighpass).connect(this.musicGain).connect(this.master);

    // Keep playback inside the initiating click; browsers may reject it after
    // the asynchronous sample fetches complete.
    const musicPlayback = this.playMusic();
    this.assetPromise = this.loadAssets().then(() => this.startContinuousLayers());
    await Promise.all([musicPlayback, this.assetPromise]);
    if (playIgnition) this.playBuffer('engineStart', { volume: .32, filterType: 'lowpass', filterHz: 4200 });
  }

  private createTunnelImpulse(durationSeconds = 2.7): AudioBuffer | null {
    if (!this.context) return null;
    const sampleRate = this.context.sampleRate;
    const frameCount = Math.floor(sampleRate * durationSeconds);
    const impulse = this.context.createBuffer(2, frameCount, sampleRate);
    let randomState = 0x517cc1b7;
    const random = (): number => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 4294967296 * 2 - 1;
    };

    for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
      const data = impulse.getChannelData(channel);
      let coloredNoise = 0;
      for (let frame = 0; frame < frameCount; frame += 1) {
        const time = frame / sampleRate;
        coloredNoise = coloredNoise * .82 + random() * .18;
        const decay = Math.exp(-time * 2.35);
        const density = Math.min(1, time * 38);
        data[frame] = coloredNoise * decay * density * .68;
      }
      const taps = channel === 0
        ? [[.021, .72], [.049, .46], [.083, .31], [.137, .2]]
        : [[.028, .68], [.057, .43], [.096, .29], [.151, .18]];
      for (const [time, gain] of taps) data[Math.floor(time * sampleRate)] += gain;
    }
    return impulse;
  }

  private setupTunnelAcoustics(): void {
    if (!this.context || !this.master) return;
    this.effectsBus = this.context.createGain();
    this.effectsDryGain = this.context.createGain();
    this.effectsBus.connect(this.effectsDryGain).connect(this.master);

    this.tunnelEarlyGain = this.context.createGain();
    this.tunnelEarlyGain.gain.value = 0;
    for (const reflection of [{ delay: .026, pan: -.72, gain: .72 }, { delay: .061, pan: .68, gain: .48 }]) {
      const delay = this.context.createDelay(.12);
      delay.delayTime.value = reflection.delay;
      const filter = this.context.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 720;
      filter.Q.value = .46;
      const gain = this.context.createGain();
      gain.gain.value = reflection.gain;
      const pan = this.context.createStereoPanner();
      pan.pan.value = reflection.pan;
      this.effectsBus.connect(delay).connect(filter).connect(gain).connect(pan).connect(this.tunnelEarlyGain);
    }
    this.tunnelEarlyGain.connect(this.master);

    const convolver = this.context.createConvolver();
    convolver.normalize = true;
    convolver.buffer = this.createTunnelImpulse();
    this.tunnelReflectionLowpass = this.context.createBiquadFilter();
    this.tunnelReflectionLowpass.type = 'lowpass';
    this.tunnelReflectionLowpass.frequency.value = 5200;
    this.tunnelReflectionLowpass.Q.value = .42;
    const lowMidPeak = this.context.createBiquadFilter();
    lowMidPeak.type = 'peaking';
    lowMidPeak.frequency.value = 320;
    lowMidPeak.Q.value = .88;
    lowMidPeak.gain.value = 4.2;
    this.tunnelReverbGain = this.context.createGain();
    this.tunnelReverbGain.gain.value = 0;
    this.effectsBus.connect(convolver).connect(this.tunnelReflectionLowpass).connect(lowMidPeak).connect(this.tunnelReverbGain).connect(this.master);

    const lowMidBody = this.context.createBiquadFilter();
    lowMidBody.type = 'bandpass';
    lowMidBody.frequency.value = 315;
    lowMidBody.Q.value = .72;
    this.tunnelLowMidGain = this.context.createGain();
    this.tunnelLowMidGain.gain.value = 0;
    this.effectsBus.connect(lowMidBody).connect(this.tunnelLowMidGain).connect(this.master);
  }

  private async loadAssets(): Promise<void> {
    if (!this.context) return;
    await Promise.all((Object.keys(SOUND_FILES) as SoundId[]).map(async (sound) => {
      try {
        const response = await fetch(resolveSoundUrl(sound, document.baseURI), { cache: 'force-cache' });
        if (!response.ok || !this.context) return;
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(sound, buffer);
      } catch {
        // A missing optional layer should never interrupt a run. Other loaded
        // recordings continue to provide the mix.
      }
    }));
  }

  private makeLoop(sound: SoundId, destination: AudioNode, startOffset = 0): AudioBufferSourceNode | null {
    if (!this.context) return null;
    const buffer = this.buffers.get(sound);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    if (buffer.duration > .18) {
      source.loopStart = Math.min(startOffset, buffer.duration - .12);
      source.loopEnd = Math.max(source.loopStart + .08, buffer.duration - .04);
    }
    source.connect(destination);
    source.start(this.context.currentTime, Math.min(startOffset, Math.max(0, buffer.duration - .05)));
    return source;
  }

  private startContinuousLayers(): void {
    if (!this.context || !this.master || !this.effectsBus || this.engineSources.length) return;

    for (const option of ENGINE_OPTIONS) {
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1750;
      filter.Q.value = .42;
      const gain = this.context.createGain();
      gain.gain.value = 0;
      filter.connect(gain).connect(this.effectsBus);
      const source = this.makeLoop(ENGINE_SOUND_IDS[option], filter, .08);
      if (source) {
        this.engineSources.push(source);
        this.engineFilters.push(filter);
        this.engineGains.push(gain);
      }
    }

    this.roadFilter = this.context.createBiquadFilter();
    this.roadFilter.type = 'lowpass';
    this.roadFilter.frequency.value = 620;
    this.roadFilter.Q.value = .62;
    this.roadGain = this.context.createGain();
    this.roadGain.gain.value = 0;
    this.roadFilter.connect(this.roadGain).connect(this.effectsBus);
    // The source recording includes a long steady asphalt section after its
    // start-up; looping inside it avoids replaying the ignition each cycle.
    this.roadSource = this.makeLoop('roadRoll', this.roadFilter, 22);
    if (this.roadSource?.buffer && this.roadSource.buffer.duration > 41) this.roadSource.loopEnd = 40;

    this.cityFilter = this.context.createBiquadFilter();
    this.cityFilter.type = 'lowpass';
    this.cityFilter.frequency.value = 2450;
    this.cityFilter.Q.value = .35;
    this.cityGain = this.context.createGain();
    this.cityGain.gain.value = 0;
    this.cityFilter.connect(this.cityGain).connect(this.master);
    this.citySource = this.makeLoop('cityNight', this.cityFilter, .35);

    this.windFilter = this.context.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 1250;
    this.windFilter.Q.value = .48;
    this.windGain = this.context.createGain();
    this.windGain.gain.value = 0;
    this.windFilter.connect(this.windGain).connect(this.master);
    this.windSource = this.makeLoop('windLoop', this.windFilter);

    this.boostFilter = this.context.createBiquadFilter();
    this.boostFilter.type = 'bandpass';
    this.boostFilter.frequency.value = 1900;
    this.boostFilter.Q.value = .65;
    this.boostGain = this.context.createGain();
    this.boostGain.gain.value = 0;
    this.boostFilter.connect(this.boostGain).connect(this.effectsBus);
    this.boostSource = this.makeLoop('windLoop', this.boostFilter, .41);

    this.tireScrubFilter = this.context.createBiquadFilter();
    this.tireScrubFilter.type = 'bandpass';
    this.tireScrubFilter.frequency.value = 1850;
    this.tireScrubFilter.Q.value = 1.45;
    this.tireScrubGain = this.context.createGain();
    this.tireScrubGain.gain.value = 0;
    this.tireScrubFilter.connect(this.tireScrubGain).connect(this.effectsBus);
    this.tireScrubSource = this.makeLoop('tireScrub', this.tireScrubFilter, 1.7);

    this.tireScreechFilter = this.context.createBiquadFilter();
    this.tireScreechFilter.type = 'bandpass';
    this.tireScreechFilter.frequency.value = 2450;
    this.tireScreechFilter.Q.value = 1.7;
    this.tireScreechGain = this.context.createGain();
    this.tireScreechGain.gain.value = 0;
    this.tireScreechFilter.connect(this.tireScreechGain).connect(this.effectsBus);
    this.tireScreechSource = this.makeLoop('tireScreech', this.tireScreechFilter, .08);
  }

  private async playMusic(): Promise<void> {
    if (!this.music || !this.music.paused) return;
    if (this.music.readyState === HTMLMediaElement.HAVE_NOTHING) this.music.load();
    try { await this.music.play(); } catch { /* A later Start/Resume interaction retries playback. */ }
  }

  pauseMusic(): void { this.music?.pause(); }

  stopMusic(): void {
    if (!this.music) return;
    this.music.pause();
    this.music.currentTime = 0;
  }

  getMusicState(): { loaded: boolean; playing: boolean; muted: boolean; currentTime: number } {
    return {
      loaded: Boolean(this.music && this.music.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA),
      playing: Boolean(this.music && !this.music.paused),
      muted: this.muted,
      currentTime: this.music?.currentTime ?? 0,
    };
  }

  update(state: VehicleState, _dt: number, running: boolean, tunnelAmount = 0): void {
    if (!this.context) return;
    const now = this.context.currentTime;
    const rpm = Math.min(1, Math.max(0, (state.rpm - 900) / 6900));
    const rolling = Math.min(1, state.speedMps / 58);
    const shifting = now < this.shiftDuckUntil ? .46 : 1;
    const coast = state.throttle < .09 && state.speedMps > 8 ? 1 : 0;
    const run = running ? 1 : 0;
    const tunnel = tunnelMixProfile(tunnelAmount);
    this.effectsDryGain?.gain.setTargetAtTime(tunnel.dryGain, now, .18);
    this.tunnelEarlyGain?.gain.setTargetAtTime(run * tunnel.earlyReflectionGain, now, .24);
    this.tunnelReverbGain?.gain.setTargetAtTime(run * tunnel.reverbGain, now, .32);
    this.tunnelLowMidGain?.gain.setTargetAtTime(run * tunnel.lowMidBodyGain, now, .22);
    this.tunnelReflectionLowpass?.frequency.setTargetAtTime(tunnel.reflectionLowpassHz, now, .28);

    const engineLevel = engineVolumeProfile(state.rpm, state.throttle, coast > 0);
    for (let index = 0; index < this.engineSources.length; index += 1) {
      const option = ENGINE_OPTIONS[index];
      const selected = option === this.engineOption ? 1 : 0;
      const profile = ENGINE_PROFILE[option];
      this.engineSources[index].playbackRate.setTargetAtTime(enginePlaybackRate(state.rpm, option), now, .055);
      this.engineFilters[index].frequency.setTargetAtTime(
        profile.toneBase + rpm * profile.toneRange + state.throttle * profile.throttleTone,
        now,
        .06,
      );
      this.engineGains[index].gain.setTargetAtTime(
        run * shifting * selected * profile.trim * engineLevel,
        now,
        selected ? (state.throttle > .2 ? .045 : .09) : .12,
      );
    }

    const speedAudio = speedAudioProfile(state.speedMph);
    this.windFilter?.frequency.setTargetAtTime(920 + speedAudio.wind * 1900, now, .14);
    this.windFilter?.Q.setTargetAtTime(.43 + speedAudio.wind * .36, now, .17);
    this.windGain?.gain.setTargetAtTime(run * tunnel.windExposure * speedAudio.wind * (.035 + speedAudio.wind * .105), now, .16);
    this.musicHighpass?.frequency.setTargetAtTime(running ? speedAudio.musicHighpassHz : 20, now, .45);

    this.roadSource?.playbackRate.setTargetAtTime(.84 + rolling * .34, now, .16);
    this.roadFilter?.frequency.setTargetAtTime(320 + rolling * 520, now, .18);
    this.roadGain?.gain.setTargetAtTime(run * (.012 + rolling * .072), now, .13);
    this.cityFilter?.frequency.setTargetAtTime(2450 - speedAudio.wind * 650, now, .5);
    this.cityGain?.gain.setTargetAtTime(run * tunnel.exteriorAmbience * (.022 - speedAudio.wind * .007), now, .8);

    const tires = tireAudioProfile(state.tireSlip, state.speedMps, state.handbrakeActive, state.brake);
    this.tireScrubSource?.playbackRate.setTargetAtTime(.82 + rolling * .24 + tires.scrub * .13, now, .055);
    this.tireScrubFilter?.frequency.setTargetAtTime(1350 + rolling * 780 + tires.scrub * 420, now, .07);
    this.tireScrubGain?.gain.setTargetAtTime(run * tires.scrub * .345, now, .035);
    this.tireScreechSource?.playbackRate.setTargetAtTime(.88 + rolling * .18 + tires.screech * .12, now, .04);
    this.tireScreechFilter?.frequency.setTargetAtTime(2050 + rolling * 850 + tires.screech * 310, now, .055);
    this.tireScreechGain?.gain.setTargetAtTime(run * tires.screech * .425, now, .025);
    if (running && tires.screech > .18 && now >= this.nextDriftAccentAt) {
      const intensity = Math.min(1, tires.screech);
      this.playBuffer('tireSqueakAlt', {
        volume: .035 + intensity * .065,
        rate: .88 + Math.random() * .26,
        pan: (Math.random() - .5) * .42,
        offset: Math.random() * .42,
        duration: .32 + Math.random() * .36,
        filterType: 'bandpass',
        filterHz: 1750 + Math.random() * 1150,
        filterQ: .75 + Math.random() * .55,
        attack: .018 + Math.random() * .025,
      });
      this.nextDriftAccentAt = now + .48 + Math.random() * .64;
    }
    if (tires.screech <= .08) this.nextDriftAccentAt = Math.min(this.nextDriftAccentAt, now + .12);

    const boost = run && state.boostActive ? 1 : 0;
    this.boostFilter?.frequency.setTargetAtTime(1450 + rpm * 1850, now, .055);
    this.boostSource?.playbackRate.setTargetAtTime(1.02 + rpm * .35, now, .06);
    this.boostGain?.gain.setTargetAtTime(boost * .215, now, state.boostActive ? .025 : .09);
    if (running && state.boostActive && !this.lastBoostActive) {
      this.playBuffer('boostLaunch', { volume: .27, filterType: 'lowpass', filterHz: 5200, attack: .008 });
      this.playBuffer('boostWhoosh', { volume: .2, rate: 1.08, filterType: 'bandpass', filterHz: 1850, filterQ: .6, attack: .01 });
    }
    if (running && this.lastThrottle > .72 && state.throttle < .14 && state.rpm > 3600) {
      this.playBuffer('boostWhoosh', { volume: .08, rate: 1.35, duration: .22, offset: .08, filterType: 'highpass', filterHz: 1500, attack: .006 });
    }
    if (running && this.lastBrake < .58 && state.brake >= .58 && state.speedMps > 16) {
      this.playBuffer('gearShift', { volume: .055, rate: .82, duration: .18, filterType: 'lowpass', filterHz: 1250, attack: .004 });
    }
    this.lastThrottle = state.throttle;
    this.lastBrake = state.brake;
    this.lastBoostActive = running && state.boostActive;
  }

  gearShift(fromGear = 1, toGear = 2, rpm = 5000): void {
    if (!this.context) return;
    const upshift = toGear > fromGear;
    this.shiftDuckUntil = this.context.currentTime + (upshift ? .14 : .1);
    this.playBuffer('gearShift', {
      volume: upshift ? .14 : .1,
      rate: .88 + Math.min(1, rpm / 7800) * .2 + (upshift ? 0 : -.08),
      filterType: 'lowpass',
      filterHz: upshift ? 3100 : 2200,
      attack: .003,
    });
  }

  nearMiss(perfect = false): void {
    this.playBuffer(perfect ? 'rewardPerfect' : 'rewardNearMiss', {
      volume: perfect ? .16 : .115,
      rate: perfect ? 1.08 : 1.02,
      filterType: 'highpass',
      filterHz: 330,
      attack: .005,
    });
  }

  threadNeedle(): void {
    this.playBuffer('rewardPerfect', { volume: .19, rate: 1.16, pan: -.16, filterType: 'highpass', filterHz: 280, attack: .004 });
    this.playBuffer('rewardNearMiss', { volume: .11, rate: 1.42, pan: .2, delay: .075, filterType: 'highpass', filterHz: 520, attack: .004 });
  }

  driftBonus(): void {
    this.playBuffer('rewardDrift', { volume: .15, rate: .96, filterType: 'highpass', filterHz: 220, attack: .006 });
    this.playBuffer('rewardNearMiss', { volume: .065, rate: 1.24, delay: .055, pan: .12, filterType: 'highpass', filterHz: 540, attack: .004 });
  }

  collision(severity: number, scrape = false): void {
    const strength = Math.min(1, Math.max(.12, severity / 36));
    if (scrape) {
      this.playBuffer('crashMetalSheet', { volume: .12 + strength * .16, rate: .78 + Math.random() * .16, duration: .34 + strength * .28, filterType: 'bandpass', filterHz: 1850, filterQ: .72, attack: .003 });
      this.playBuffer('crashDebris', { volume: .05 + strength * .07, rate: 1.18, delay: .05, duration: .28, filterType: 'highpass', filterHz: 900, attack: .003 });
      return;
    }
    this.playBuffer('crashBody', { volume: .17 + strength * .25, rate: .88 + strength * .12, filterType: 'lowpass', filterHz: 3900, attack: .002 });
    this.playBuffer('crashMetalHeavy', { volume: .09 + strength * .19, rate: .82 + Math.random() * .22, delay: .018, filterType: 'bandpass', filterHz: 1120 + strength * 840, filterQ: .55, attack: .002 });
  }

  trafficPass(side: number, relativeSpeed: number, lateralDistance = 4): void {
    if (!this.context || !this.master || relativeSpeed < .5) return;
    const buffer = this.buffers.get('trafficPass');
    if (!buffer) return;
    const now = this.context.currentTime;
    const profile = trafficPassProfile(relativeSpeed, lateralDistance);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const startRate = 1.08 + Math.min(.48, relativeSpeed * .011);
    source.playbackRate.setValueAtTime(startRate, now);
    source.playbackRate.exponentialRampToValueAtTime(Math.max(.68, startRate * .7), now + profile.duration);
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200 + Math.min(1200, relativeSpeed * 20), now);
    filter.frequency.exponentialRampToValueAtTime(720, now + profile.duration);
    filter.Q.value = .5;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.airGain, now + profile.duration * .37);
    gain.gain.exponentialRampToValueAtTime(.0001, now + profile.duration);
    const pan = this.context.createStereoPanner();
    pan.pan.setValueAtTime(Math.sign(side) * .94, now);
    pan.pan.linearRampToValueAtTime(Math.sign(side) * .24, now + profile.duration);
    source.connect(filter).connect(gain).connect(pan).connect(this.effectsBus ?? this.master);
    const offset = Math.min(Math.max(0, buffer.duration - profile.duration * startRate - .05), buffer.duration * .42);
    source.start(now, offset, Math.min(buffer.duration - offset, profile.duration * startRate));
    source.stop(now + profile.duration + .04);

    this.playBuffer('boostWhoosh', {
      volume: profile.bodyGain,
      rate: 1.04 + Math.min(.4, relativeSpeed * .01),
      pan: Math.sign(side) * .7,
      duration: profile.duration,
      filterType: 'highpass',
      filterHz: 760 + Math.min(980, relativeSpeed * 22),
      filterQ: .46,
      attack: profile.duration * .24,
    });
    this.playBuffer('windLoop', {
      volume: profile.bodyGain * .62,
      rate: 1.18 + Math.min(.34, relativeSpeed * .008),
      pan: Math.sign(side) * .48,
      duration: profile.duration * .88,
      offset: .12,
      filterType: 'bandpass',
      filterHz: 1850 + Math.min(1450, relativeSpeed * 28),
      filterQ: .58,
      attack: profile.duration * .3,
    });
    if (relativeSpeed > 8 && now - this.lastHornAt > 1.35 && Math.random() < .18) {
      this.lastHornAt = now;
      this.playBuffer('trafficHorn', { volume: .16, rate: .98 + Math.min(.08, relativeSpeed * .0016), pan: Math.sign(side) * .66, filterType: 'lowpass', filterHz: 3250, attack: .012 });
    }
  }

  crash(severity: number): void {
    const strength = Math.min(1, Math.max(.35, severity / 68));
    this.playBuffer('crashBody', { volume: .34 + strength * .2, rate: .82 + strength * .12, filterType: 'lowpass', filterHz: 4400, attack: .002 });
    this.playBuffer('crashMetalHeavy', { volume: .23 + strength * .18, rate: .76 + Math.random() * .18, delay: .016, filterType: 'bandpass', filterHz: 980, filterQ: .48, attack: .002 });
    this.playBuffer('crashMetalSheet', { volume: .16 + strength * .12, rate: .9 + Math.random() * .18, delay: .048, filterType: 'highpass', filterHz: 740, filterQ: .6, attack: .002 });
    this.playBuffer('crashDebris', { volume: .12 + strength * .09, rate: 1.02, delay: .11, filterType: 'highpass', filterHz: 1350, attack: .003 });
  }

  ui(): void {
    this.playBuffer('uiClick', { volume: .105, rate: .98 + Math.random() * .06, filterType: 'highpass', filterHz: 260, attack: .002 });
  }

  private playBuffer(sound: SoundId, options: PlayOptions): void {
    if (!this.context || !this.master) return;
    const buffer = this.buffers.get(sound);
    if (!buffer) return;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = Math.max(.25, options.rate ?? 1);
    const filter = this.context.createBiquadFilter();
    filter.type = options.filterType ?? 'allpass';
    filter.frequency.value = options.filterHz ?? 1000;
    filter.Q.value = options.filterQ ?? .7;
    const gain = this.context.createGain();
    const pan = this.context.createStereoPanner();
    pan.pan.value = Math.min(1, Math.max(-1, options.pan ?? 0));
    source.connect(filter).connect(gain).connect(pan).connect(this.effectsBus ?? this.master);

    const startAt = this.context.currentTime + (options.delay ?? 0);
    const offset = Math.min(Math.max(0, options.offset ?? 0), Math.max(0, buffer.duration - .01));
    const rate = source.playbackRate.value;
    const available = Math.max(.02, (buffer.duration - offset) / rate);
    const audibleDuration = Math.min(available, options.duration ?? available);
    const attack = Math.min(audibleDuration * .45, options.attack ?? .006);
    gain.gain.setValueAtTime(.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, options.volume), startAt + Math.max(.001, attack));
    gain.gain.exponentialRampToValueAtTime(.0001, startAt + audibleDuration);
    source.start(startAt, offset, Math.min(buffer.duration - offset, audibleDuration * rate));
    source.stop(startAt + audibleDuration + .025);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : .72, this.context.currentTime, .035);
    return this.muted;
  }
}

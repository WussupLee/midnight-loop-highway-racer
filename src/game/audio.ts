import type { VehicleState } from './vehicle';

export function resolveMusicUrl(baseUri: string): string {
  return new URL('audio/midnight-loop-background.mp3', baseUri).href;
}

export function speedAudioProfile(speedMph: number): { wind: number; musicHighpassHz: number } {
  const wind = Math.min(1, Math.max(0, (speedMph - 68) / 102));
  const filterProgress = Math.min(1, Math.max(0, (speedMph - 95) / 70));
  const smoothFilter = filterProgress * filterProgress * (3 - 2 * filterProgress);
  return {
    wind: Math.pow(wind, 1.35),
    musicHighpassHz: 20 + smoothFilter * 600,
  };
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineA: OscillatorNode | null = null;
  private engineB: OscillatorNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private tireGain: GainNode | null = null;
  private tireTone: OscillatorNode | null = null;
  private tireToneGain: GainNode | null = null;
  private roadGain: GainNode | null = null;
  private brakeGain: GainNode | null = null;
  private boostGain: GainNode | null = null;
  private boostBassGain: GainNode | null = null;
  private boostFilter: BiquadFilterNode | null = null;
  private boostBassFilter: BiquadFilterNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicGain: GainNode | null = null;
  private musicHighpass: BiquadFilterNode | null = null;
  private muted = false;
  private lastThrottle = 0;
  private lastBoostActive = false;
  private lastHornAt = -10;

  async start(): Promise<void> {
    if (this.context) {
      await this.context.resume();
      await this.playMusic();
      return;
    }
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = .68;
    this.master.connect(this.context.destination);

    // Resolve against the current document directory, not the domain root.
    // This works at localhost and under the GitHub Pages repository subpath.
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
    this.musicGain.gain.value = .34;
    musicSource.connect(this.musicHighpass).connect(this.musicGain).connect(this.master);
    // Invoke play while the Start Run click still owns browser user activation;
    // the rest of the procedural audio graph can finish constructing after it.
    const musicPlayback = this.playMusic();

    const engineFilter = this.context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 1550;
    engineFilter.Q.value = 1.2;
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;
    this.engineA = this.context.createOscillator();
    this.engineA.type = 'sawtooth';
    this.engineB = this.context.createOscillator();
    this.engineB.type = 'triangle';
    const aGain = this.context.createGain(); aGain.gain.value = .1;
    const bGain = this.context.createGain(); bGain.gain.value = .2;
    this.engineA.connect(aGain).connect(engineFilter);
    this.engineB.connect(bGain).connect(engineFilter);
    engineFilter.connect(this.engineGain).connect(this.master);
    this.engineA.start(); this.engineB.start();

    const noiseBuffer = this.createNoise(3);
    const windSource = this.context.createBufferSource();
    windSource.buffer = noiseBuffer; windSource.loop = true;
    this.windFilter = this.context.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 1100; this.windFilter.Q.value = .5;
    this.windGain = this.context.createGain(); this.windGain.gain.value = 0;
    windSource.connect(this.windFilter).connect(this.windGain).connect(this.master); windSource.start();
    const tireSource = this.context.createBufferSource(); tireSource.buffer = noiseBuffer; tireSource.loop = true;
    const tireFilter = this.context.createBiquadFilter(); tireFilter.type = 'bandpass'; tireFilter.frequency.value = 2100; tireFilter.Q.value = 2.4;
    this.tireGain = this.context.createGain(); this.tireGain.gain.value = 0;
    tireSource.connect(tireFilter).connect(this.tireGain).connect(this.master); tireSource.start();
    this.tireTone = this.context.createOscillator(); this.tireTone.type = 'triangle'; this.tireTone.frequency.value = 720;
    const tireToneFilter = this.context.createBiquadFilter(); tireToneFilter.type = 'bandpass'; tireToneFilter.frequency.value = 980; tireToneFilter.Q.value = 2.8;
    this.tireToneGain = this.context.createGain(); this.tireToneGain.gain.value = 0;
    this.tireTone.connect(tireToneFilter).connect(this.tireToneGain).connect(this.master); this.tireTone.start();

    const roadSource = this.context.createBufferSource(); roadSource.buffer = noiseBuffer; roadSource.loop = true;
    const roadFilter = this.context.createBiquadFilter(); roadFilter.type = 'lowpass'; roadFilter.frequency.value = 430; roadFilter.Q.value = .7;
    this.roadGain = this.context.createGain(); this.roadGain.gain.value = 0;
    roadSource.connect(roadFilter).connect(this.roadGain).connect(this.master); roadSource.start();

    const brakeSource = this.context.createBufferSource(); brakeSource.buffer = noiseBuffer; brakeSource.loop = true;
    const brakeFilter = this.context.createBiquadFilter(); brakeFilter.type = 'bandpass'; brakeFilter.frequency.value = 2850; brakeFilter.Q.value = 3.8;
    this.brakeGain = this.context.createGain(); this.brakeGain.gain.value = 0;
    brakeSource.connect(brakeFilter).connect(this.brakeGain).connect(this.master); brakeSource.start();

    const boostSource = this.context.createBufferSource(); boostSource.buffer = noiseBuffer; boostSource.loop = true;
    this.boostFilter = this.context.createBiquadFilter(); this.boostFilter.type = 'bandpass'; this.boostFilter.frequency.value = 1850; this.boostFilter.Q.value = .72;
    this.boostGain = this.context.createGain(); this.boostGain.gain.value = 0;
    boostSource.connect(this.boostFilter).connect(this.boostGain).connect(this.master); boostSource.start();
    const boostBassSource = this.context.createBufferSource(); boostBassSource.buffer = noiseBuffer; boostBassSource.loop = true;
    this.boostBassFilter = this.context.createBiquadFilter(); this.boostBassFilter.type = 'lowpass'; this.boostBassFilter.frequency.value = 185; this.boostBassFilter.Q.value = 1.15;
    this.boostBassGain = this.context.createGain(); this.boostBassGain.gain.value = 0;
    boostBassSource.connect(this.boostBassFilter).connect(this.boostBassGain).connect(this.master); boostBassSource.start();

    await musicPlayback;
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

  private createNoise(seconds: number): AudioBuffer {
    const context = this.context!;
    const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * .82 + white * .18;
      data[i] = last;
    }
    return buffer;
  }

  update(state: VehicleState, dt: number, running: boolean): void {
    if (!this.context || !this.engineGain || !this.engineA || !this.engineB || !this.windGain || !this.windFilter || !this.tireGain || !this.tireTone || !this.tireToneGain || !this.roadGain || !this.brakeGain || !this.boostGain || !this.boostBassGain || !this.boostFilter || !this.boostBassFilter) return;
    const now = this.context.currentTime;
    const fundamental = 31 + state.rpm / 52;
    this.engineA.frequency.setTargetAtTime(fundamental, now, .025);
    this.engineB.frequency.setTargetAtTime(fundamental * 1.98, now, .035);
    this.engineGain.gain.setTargetAtTime(running ? .15 + state.throttle * .15 + (state.boostActive ? .055 : 0) : .035, now, state.throttle > .2 ? .035 : .085);
    const speedAudio = speedAudioProfile(state.speedMph);
    this.windFilter.frequency.setTargetAtTime(900 + speedAudio.wind * 1500, now, .16);
    this.windFilter.Q.setTargetAtTime(.48 + speedAudio.wind * .42, now, .18);
    this.windGain.gain.setTargetAtTime(running ? speedAudio.wind * .38 : 0, now, .12);
    this.musicHighpass?.frequency.setTargetAtTime(running ? speedAudio.musicHighpassHz : 20, now, .45);
    const handbrakeBite = state.handbrakeActive && state.speedMps > 17 ? .34 : 0;
    const squeal = (Math.max(0, state.tireSlip - .13) + handbrakeBite) * Math.min(1, state.speedMps / 24);
    this.tireGain.gain.setTargetAtTime(running ? Math.min(.34, squeal * .26) : 0, now, .028);
    this.tireTone.frequency.setTargetAtTime(620 + Math.min(760, state.speedMps * 8 + state.tireSlip * 250), now, .045);
    this.tireToneGain.gain.setTargetAtTime(running ? Math.min(.055, squeal * .043) : 0, now, .025);
    const rolling = Math.min(1, state.speedMps / 58);
    this.roadGain.gain.setTargetAtTime(running ? .018 + rolling * .085 : 0, now, .12);
    this.brakeGain.gain.setTargetAtTime(running ? state.brake * rolling * .075 : 0, now, .035);
    const boostLevel = running && state.boostActive ? 1 : 0;
    this.boostFilter.frequency.setTargetAtTime(1450 + state.rpm * .11, now, .06);
    this.boostBassFilter.frequency.setTargetAtTime(155 + state.throttle * 65, now, .08);
    this.boostGain.gain.setTargetAtTime(boostLevel * .145, now, state.boostActive ? .025 : .075);
    this.boostBassGain.gain.setTargetAtTime(boostLevel * .105, now, state.boostActive ? .035 : .11);
    if (running && state.boostActive && !this.lastBoostActive) {
      this.noiseHit(.17, 135, .24);
      this.noiseHit(.1, 1250, .18);
      this.tone(47, .09, .28, 'sawtooth', .62);
    }
    if (running && this.lastThrottle > .72 && state.throttle < .14 && state.rpm > 3600) {
      this.tone(74 + state.rpm / 125, .027, .07, 'square', .42);
    }
    this.lastThrottle = state.throttle;
    this.lastBoostActive = running && state.boostActive;
  }

  gearShift(): void { this.tone(92, .045, .08, 'sawtooth'); }
  nearMiss(perfect = false): void {
    this.tone(perfect ? 880 : 660, .06, .17, 'sine', perfect ? 1.7 : 1.35);
    this.noiseHit(.018, 3800, .12);
  }
  threadNeedle(): void { this.tone(523, .055, .26, 'triangle', 2); setTimeout(() => this.tone(784, .05, .2, 'sine', 1.25), 70); }
  driftBonus(): void { this.tone(392, .045, .18, 'triangle', 1.5); setTimeout(() => this.tone(587, .035, .16, 'sine', 1.2), 65); }
  collision(severity: number): void { this.noiseHit(Math.min(.32, .08 + severity * .004), 170 + severity * 5, .25); this.tone(48, Math.min(.25, severity * .004), .22, 'sawtooth', .45); }
  trafficPass(side: number, relativeSpeed: number): void {
    if (!this.context || !this.master || relativeSpeed < 4) return;
    const now = this.context.currentTime;
    const duration = Math.max(.15, Math.min(.42, .5 - relativeSpeed * .008));
    const source = this.context.createBufferSource();
    source.buffer = this.createNoise(duration + .04);
    const filter = this.context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.setValueAtTime(720, now); filter.frequency.exponentialRampToValueAtTime(2100, now + duration * .5); filter.frequency.exponentialRampToValueAtTime(480, now + duration);
    const gain = this.context.createGain(); gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(Math.min(.24, .055 + relativeSpeed * .0035), now + duration * .35); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    const pan = this.context.createStereoPanner(); pan.pan.setValueAtTime(Math.sign(side) * .72, now); pan.pan.linearRampToValueAtTime(Math.sign(side) * .28, now + duration);
    source.connect(filter).connect(gain).connect(pan).connect(this.master);
    const bodyFilter = this.context.createBiquadFilter(); bodyFilter.type = 'lowpass'; bodyFilter.frequency.value = 390 + Math.min(420, relativeSpeed * 9); bodyFilter.Q.value = .7;
    const bodyGain = this.context.createGain(); bodyGain.gain.setValueAtTime(.0001, now); bodyGain.gain.exponentialRampToValueAtTime(Math.min(.12, .025 + relativeSpeed * .0017), now + duration * .42); bodyGain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    const bodyPan = this.context.createStereoPanner(); bodyPan.pan.setValueAtTime(Math.sign(side) * .58, now); bodyPan.pan.linearRampToValueAtTime(0, now + duration);
    source.connect(bodyFilter).connect(bodyGain).connect(bodyPan).connect(this.master);
    source.start(now); source.stop(now + duration + .03);
    if (relativeSpeed > 8 && now - this.lastHornAt > 1.35 && Math.random() < .18) {
      this.lastHornAt = now;
      this.trafficHorn(side, relativeSpeed);
    }
  }

  private trafficHorn(side: number, relativeSpeed: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const duration = .16 + Math.min(.12, relativeSpeed * .0025);
    const pan = this.context.createStereoPanner();
    pan.pan.setValueAtTime(Math.sign(side) * .7, now);
    pan.pan.linearRampToValueAtTime(Math.sign(side) * .35, now + duration);
    const hornGain = this.context.createGain();
    hornGain.gain.setValueAtTime(.0001, now);
    hornGain.gain.exponentialRampToValueAtTime(.085, now + .018);
    hornGain.gain.setValueAtTime(.085, now + duration * .68);
    hornGain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    hornGain.connect(pan).connect(this.master);
    for (const [frequency, volume] of [[392, .72], [493.9, .42]] as const) {
      const oscillator = this.context.createOscillator();
      const partialGain = this.context.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.linearRampToValueAtTime(frequency * .985, now + duration);
      partialGain.gain.value = volume;
      oscillator.connect(partialGain).connect(hornGain);
      oscillator.start(now);
      oscillator.stop(now + duration + .02);
    }
  }
  crash(severity: number): void {
    this.noiseHit(Math.min(.58, .34 + severity * .003), 105, .58);
    this.noiseHit(Math.min(.42, .2 + severity * .002), 720, .42);
    this.noiseHit(.23, 2450, .34);
    this.noiseHit(.13, 6100, .2);
    setTimeout(() => this.noiseHit(.17, 1750, .3), 42);
    setTimeout(() => this.noiseHit(.1, 3900, .22), 96);
  }
  ui(): void { this.tone(410, .035, .055, 'square', 1.3); }

  private tone(frequency: number, volume: number, duration: number, type: OscillatorType, endRatio = .7): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * endRatio), now + duration);
    gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain).connect(this.master); oscillator.start(now); oscillator.stop(now + duration + .02);
  }

  private noiseHit(volume: number, frequency: number, duration: number): void {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    const source = this.context.createBufferSource(); source.buffer = this.createNoise(Math.max(.08, duration));
    const filter = this.context.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .8;
    const gain = this.context.createGain(); gain.gain.setValueAtTime(volume, now); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(gain).connect(this.master); source.start(now); source.stop(now + duration + .02);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted ? 0 : .68, this.context.currentTime, .035);
    return this.muted;
  }
}

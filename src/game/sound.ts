import {
  AmbientCueId,
  AmbientSoundscapeProfile,
  AudioChannelVolumes,
  WeatherMode,
  resolveJakartaAmbientProfile,
} from './rules';

export type AudioChannel = 'sfx' | 'radio' | 'ambience';

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  private channelVolumes: AudioChannelVolumes = {
    master: 1,
    sfx: 1,
    radio: 0.85,
    ambience: 0.9,
  };

  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private engineRunning: boolean = false;

  private ambientNoiseBuffer: AudioBuffer | null = null;
  private ambientBedSource: AudioBufferSourceNode | null = null;
  private ambientBedFilter: BiquadFilterNode | null = null;
  private ambientBedGain: GainNode | null = null;
  private ambientLfoOsc: OscillatorNode | null = null;
  private ambientLfoGain: GainNode | null = null;
  private ambientRunning: boolean = false;
  private currentAmbientProfile: AmbientSoundscapeProfile | null = null;
  private userUnlocked: boolean = false;

  private driftOsc: OscillatorNode | null = null;
  private driftFilter: BiquadFilterNode | null = null;
  private driftGain: GainNode | null = null;
  private driftRunning: boolean = false;
  private inVehicleCabin: boolean = false;

  public getChannelVolumes(): AudioChannelVolumes {
    return { ...this.channelVolumes };
  }

  public setChannelVolumes(next: Partial<AudioChannelVolumes>): AudioChannelVolumes {
    const clamp = (v: number | undefined, fallback: number) =>
      typeof v === 'number' && Number.isFinite(v)
        ? Math.max(0, Math.min(1, v))
        : fallback;

    this.channelVolumes = {
      master: clamp(next.master, this.channelVolumes.master),
      sfx: clamp(next.sfx, this.channelVolumes.sfx),
      radio: clamp(next.radio, this.channelVolumes.radio),
      ambience: clamp(next.ambience, this.channelVolumes.ambience),
    };

    if (this.ctx && this.ambientBedGain && this.currentAmbientProfile && this.ambientRunning) {
      const target = Math.max(
        0.0001,
        this.currentAmbientProfile.bedGain * this.getChannelGain('ambience')
      );
      this.ambientBedGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.12);
    }

    return this.getChannelVolumes();
  }

  private getChannelGain(channel: AudioChannel): number {
    if (this.muted) return 0;
    return this.channelVolumes.master * this.channelVolumes[channel];
  }

  public unlockAudio(): void {
    this.userUnlocked = true;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || !this.userUnlocked || typeof window === 'undefined') {
      return null;
    }
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getOrCreatePinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.ambientNoiseBuffer && this.ambientNoiseBuffer.sampleRate === ctx.sampleRate) {
      return this.ambientNoiseBuffer;
    }
    const durationSec = 2.5;
    const bufferSize = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.153852;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }
    this.ambientNoiseBuffer = buffer;
    return buffer;
  }

  public getCurrentAmbientProfile(): AmbientSoundscapeProfile | null {
    return this.currentAmbientProfile;
  }

  public updateAmbientSoundscape(
    districtId: string,
    weatherMode: WeatherMode,
    active: boolean,
    cycleStep: number = 0,
    triggerCue: boolean = false
  ): AmbientSoundscapeProfile {
    const profile = resolveJakartaAmbientProfile(
      districtId,
      weatherMode,
      cycleStep
    );
    this.currentAmbientProfile = profile;

    if (!active || this.muted) {
      this.stopAmbientSoundscape(this.muted);
      return profile;
    }

    const ctx = this.ensureContext();
    if (!ctx) return profile;

    const ambMult = this.getChannelGain('ambience');
    if (ambMult <= 0.001) {
      this.stopAmbientSoundscape(false);
      return profile;
    }

    try {
      const now = ctx.currentTime;
      if (
        !this.ambientRunning ||
        !this.ambientBedSource ||
        !this.ambientBedFilter ||
        !this.ambientBedGain ||
        !this.ambientLfoOsc ||
        !this.ambientLfoGain
      ) {
        const noiseBuffer = this.getOrCreatePinkNoiseBuffer(ctx);
        const source = ctx.createBufferSource();
        source.buffer = noiseBuffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type =
          profile.primaryBed === 'monsoon_downpour' ? 'bandpass' : 'lowpass';
        filter.Q.setValueAtTime(0.85, now);
        filter.frequency.setValueAtTime(profile.bedFilterHz, now);

        const lfoOsc = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfoOsc.type = 'sine';
        lfoOsc.frequency.setValueAtTime(profile.lfoRateHz, now);
        lfoGain.gain.setValueAtTime(profile.bedFilterHz * 0.25, now);

        const bedGain = ctx.createGain();
        bedGain.gain.setValueAtTime(0.0001, now);

        lfoOsc.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        source.connect(filter);
        filter.connect(bedGain);
        bedGain.connect(ctx.destination);

        source.start(now);
        lfoOsc.start(now);

        this.ambientBedSource = source;
        this.ambientBedFilter = filter;
        this.ambientBedGain = bedGain;
        this.ambientLfoOsc = lfoOsc;
        this.ambientLfoGain = lfoGain;
        this.ambientRunning = true;
      }

      const desiredFilterType: BiquadFilterType =
        profile.primaryBed === 'monsoon_downpour' ? 'bandpass' : 'lowpass';
      if (this.ambientBedFilter.type !== desiredFilterType) {
        this.ambientBedFilter.type = desiredFilterType;
      }

      this.ambientBedFilter.frequency.setTargetAtTime(
        profile.bedFilterHz,
        now,
        0.45
      );
      this.ambientLfoOsc.frequency.setTargetAtTime(
        profile.lfoRateHz,
        now,
        0.45
      );
      this.ambientLfoGain.gain.setTargetAtTime(
        profile.bedFilterHz * 0.24,
        now,
        0.45
      );
      this.ambientBedGain.gain.setTargetAtTime(
        Math.max(
          0.0001,
          profile.bedGain * ambMult * (this.inVehicleCabin ? 0.52 : 1.0)
        ),
        now,
        0.55
      );

      if (triggerCue) {
        this.triggerAmbientCue(profile.activeCue);
      }
    } catch {
      // Ignore Web Audio errors on locked contexts
    }

    return profile;
  }

  public stopAmbientSoundscape(immediate: boolean = false) {
    if (!this.ambientRunning || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.ambientBedGain) {
        if (immediate) {
          this.ambientBedGain.gain.cancelScheduledValues(now);
          this.ambientBedGain.gain.setValueAtTime(0.0001, now);
        } else {
          this.ambientBedGain.gain.setTargetAtTime(0.0001, now, 0.08);
        }
      }

      const source = this.ambientBedSource;
      const filter = this.ambientBedFilter;
      const gain = this.ambientBedGain;
      const lfoOsc = this.ambientLfoOsc;
      const lfoGain = this.ambientLfoGain;

      this.ambientBedSource = null;
      this.ambientBedFilter = null;
      this.ambientBedGain = null;
      this.ambientLfoOsc = null;
      this.ambientLfoGain = null;
      this.ambientRunning = false;

      const stopAt = immediate ? now + 0.02 : now + 0.18;
      source?.stop(stopAt);
      lfoOsc?.stop(stopAt);

      window.setTimeout(() => {
        try {
          source?.disconnect();
          lfoOsc?.disconnect();
          lfoGain?.disconnect();
          filter?.disconnect();
          gain?.disconnect();
        } catch {
          // Ignore already disconnected nodes
        }
      }, immediate ? 40 : 220);
    } catch {
      this.ambientRunning = false;
    }
  }

  public triggerAmbientCue(cue: AmbientCueId) {
    if (this.muted) return;
    const ambMult = this.getChannelGain('ambience');
    if (ambMult <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (cue === 'distant_traffic') {
        const isBusHorn = Math.random() > 0.45;
        const baseA = isBusHorn ? 196 : 340;
        const baseB = isBusHorn ? 247 : 425;
        this.scheduleMuffledHorn(ctx, now + 0.05, baseA, baseB, 0.14, 0.018 * ambMult);
        this.scheduleMuffledHorn(ctx, now + 0.25, baseA, baseB, 0.22, 0.02 * ambMult);
      } else if (cue === 'street_vendor_tektek') {
        const pattern = [
          { offset: 0.04, freq: 860, vol: 0.024 },
          { offset: 0.18, freq: 880, vol: 0.022 },
          { offset: 0.42, freq: 1120, vol: 0.026 },
          { offset: 0.56, freq: 860, vol: 0.02 },
        ];
        for (const tap of pattern) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(tap.freq, now + tap.offset);
          osc.frequency.exponentialRampToValueAtTime(
            tap.freq * 0.68,
            now + tap.offset + 0.065
          );
          gain.gain.setValueAtTime(0.0001, now + tap.offset);
          gain.gain.linearRampToValueAtTime(tap.vol * ambMult, now + tap.offset + 0.008);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + tap.offset + 0.07);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + tap.offset);
          osc.stop(now + tap.offset + 0.075);
        }
      } else if (cue === 'prayer_call_echo') {
        this.playTone(74, 0.34, 'sine', 0.032, 0.62, 'ambience');
        this.playTone(76, 0.28, 'sine', 0.024, 0.65, 'ambience');

        const notes = [
          { offset: 0.22, freq: 293.66, dur: 0.55 },
          { offset: 0.72, freq: 311.13, dur: 0.45 },
          { offset: 1.12, freq: 369.99, dur: 0.75 },
          { offset: 1.82, freq: 392.0, dur: 0.9 },
        ];
        for (const n of notes) {
          const osc = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(n.freq, now + n.offset);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(900, now + n.offset);

          gain.gain.setValueAtTime(0.0001, now + n.offset);
          gain.gain.linearRampToValueAtTime(0.02 * ambMult, now + n.offset + 0.14);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + n.offset + n.dur);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + n.offset);
          osc.stop(now + n.offset + n.dur + 0.04);
        }
      } else if (cue === 'harbor_foghorn_gulls') {
        this.scheduleMuffledHorn(ctx, now + 0.05, 98, 147, 0.85, 0.026 * ambMult);
        window.setTimeout(() => {
          this.playTone(1480, 0.24, 'sine', 0.014, 0.76, 'ambience');
        }, 480);
      } else if (cue === 'monsoon_rain_thunder') {
        this.playTone(58, 0.65, 'triangle', 0.036, 0.48, 'ambience');
        window.setTimeout(() => {
          this.playTone(44, 0.75, 'sine', 0.032, 0.55, 'ambience');
        }, 220);
      } else if (cue === 'mrt_chime_station') {
        const chimeNotes = [523.25, 659.25, 783.99];
        chimeNotes.forEach((freq, idx) => {
          const t0 = now + idx * 0.22;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.linearRampToValueAtTime(0.02 * ambMult, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.36);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.38);
        });
      } else if (cue === 'night_cicada_neon') {
        for (let i = 0; i < 3; i++) {
          const t0 = now + i * 0.14;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2950 + (i % 2) * 180, t0);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.linearRampToValueAtTime(0.011 * ambMult, t0 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.09);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.1);
        }
      }
    } catch {
      // Ignore Web Audio errors on locked contexts
    }
  }

  private scheduleMuffledHorn(
    ctx: AudioContext,
    startTime: number,
    freqA: number,
    freqB: number,
    duration: number,
    volume: number
  ) {
    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscA.type = 'sawtooth';
    oscB.type = 'triangle';
    oscA.frequency.setValueAtTime(freqA, startTime);
    oscB.frequency.setValueAtTime(freqB, startTime);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(Math.max(0.0002, volume), startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    oscA.start(startTime);
    oscB.start(startTime);
    oscA.stop(startTime + duration + 0.02);
    oscB.stop(startTime + duration + 0.02);
  }

  public updateEngineAudio(
    speedRatio: number,
    isDriving: boolean,
    isAircraft: boolean,
    nitroActive: boolean,
    active: boolean
  ) {
    const sfxMult = this.getChannelGain('sfx');
    if (!active || !isDriving || this.muted || sfxMult <= 0.001) {
      this.stopEngineAudio(this.muted);
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (
        !this.engineRunning ||
        !this.engineOsc ||
        !this.engineSubOsc ||
        !this.engineFilter ||
        !this.engineGain
      ) {
        this.engineOsc = ctx.createOscillator();
        this.engineSubOsc = ctx.createOscillator();
        this.engineFilter = ctx.createBiquadFilter();
        this.engineGain = ctx.createGain();

        this.engineOsc.type = isAircraft ? 'triangle' : 'sawtooth';
        this.engineSubOsc.type = 'triangle';

        this.engineFilter.type = 'lowpass';
        this.engineFilter.Q.setValueAtTime(1.8, now);
        this.engineFilter.frequency.setValueAtTime(200, now);

        this.engineGain.gain.setValueAtTime(0.0001, now);

        this.engineOsc.connect(this.engineFilter);
        this.engineSubOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(ctx.destination);

        this.engineOsc.start(now);
        this.engineSubOsc.start(now);
        this.engineRunning = true;
      }

      const desiredType: OscillatorType = isAircraft ? 'triangle' : 'sawtooth';
      if (this.engineOsc.type !== desiredType) {
        this.engineOsc.type = desiredType;
      }

      const sr = Math.max(0, Math.min(1.4, speedRatio));
      const baseFreq = isAircraft
        ? 54 + sr * 52 + (nitroActive ? 22 : 0)
        : 42 + sr * 76 + (nitroActive ? 26 : 0);
      const cutoff = 180 + sr * 520 + (nitroActive ? 240 : 0);
      const gainTarget =
        (0.02 + Math.min(1, sr) * 0.028 + (nitroActive ? 0.012 : 0)) * sfxMult;

      this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
      this.engineGain.gain.setTargetAtTime(Math.max(0.0001, gainTarget), now, 0.09);
    } catch {
      // Ignore Web Audio errors on locked contexts
    }
  }

  public stopEngineAudio(immediate: boolean = false) {
    if (!this.engineRunning || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      if (this.engineGain) {
        if (immediate) {
          this.engineGain.gain.cancelScheduledValues(now);
          this.engineGain.gain.setValueAtTime(0.0001, now);
        } else {
          this.engineGain.gain.setTargetAtTime(0.0001, now, 0.04);
        }
      }
      const osc = this.engineOsc;
      const subOsc = this.engineSubOsc;
      const filter = this.engineFilter;
      const gain = this.engineGain;

      this.engineOsc = null;
      this.engineSubOsc = null;
      this.engineFilter = null;
      this.engineGain = null;
      this.engineRunning = false;

      const stopAt = immediate ? now + 0.02 : now + 0.14;
      osc?.stop(stopAt);
      subOsc?.stop(stopAt);
      window.setTimeout(() => {
        try {
          osc?.disconnect();
          subOsc?.disconnect();
          filter?.disconnect();
          gain?.disconnect();
        } catch {
          // Ignore already disconnected nodes
        }
      }, immediate ? 40 : 180);
    } catch {
      this.engineRunning = false;
    }
  }

  public playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume: number = 0.12,
    pitchSlide: number = 1.0,
    channel: AudioChannel = 'sfx'
  ) {
    const chMult = this.getChannelGain(channel);
    if (chMult <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const variance = 1 + (Math.random() - 0.5) * 0.12;

      osc.type = type;
      osc.frequency.setValueAtTime(freq * variance, now);
      if (pitchSlide !== 1.0) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(30, freq * pitchSlide),
          now + duration
        );
      }

      const scaledVol = Math.max(0.0015, volume * chMult);
      gain.gain.setValueAtTime(scaledVol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Ignore audio errors on locked contexts
    }
  }

  public playHorn() {
    this.playTone(392, 0.14, 'sawtooth', 0.1, 1.0, 'sfx');
    this.playTone(493.88, 0.14, 'triangle', 0.09, 1.0, 'sfx');
    window.setTimeout(() => {
      this.playTone(392, 0.2, 'sawtooth', 0.11, 0.98, 'sfx');
      this.playTone(493.88, 0.2, 'triangle', 0.09, 0.98, 'sfx');
    }, 150);
  }

  public playShoot(
    weapon:
      | 'fist'
      | 'golok'
      | 'pistol'
      | 'rifle'
      | 'mercon'
      | 'pasopati'
      | 'gatotkaca'
  ) {
    if (weapon === 'fist') {
      this.playTone(130, 0.09, 'triangle', 0.15, 0.5, 'sfx');
    } else if (weapon === 'golok') {
      this.playTone(320, 0.12, 'sawtooth', 0.14, 0.35, 'sfx');
    } else if (weapon === 'pistol') {
      this.playTone(240, 0.14, 'sawtooth', 0.18, 0.25, 'sfx');
    } else if (weapon === 'mercon') {
      this.playTone(90, 0.38, 'sawtooth', 0.24, 0.22, 'sfx');
      setTimeout(() => this.playTone(65, 0.32, 'square', 0.2, 0.4, 'sfx'), 80);
    } else if (weapon === 'pasopati') {
      this.playTone(680, 0.18, 'sine', 0.2, 0.45, 'sfx');
      setTimeout(() => this.playTone(420, 0.22, 'triangle', 0.16, 1.5, 'sfx'), 55);
    } else if (weapon === 'gatotkaca') {
      this.playTone(840, 0.22, 'sawtooth', 0.22, 0.3, 'sfx');
      setTimeout(() => this.playTone(110, 0.34, 'sine', 0.22, 0.5, 'sfx'), 45);
    } else {
      this.playTone(290, 0.09, 'square', 0.15, 0.3, 'sfx');
    }
  }

  public playRadioBeat(
    station:
      | 'prambors'
      | 'koplo'
      | 'synth_scbd'
      | 'indie_senopati'
      | 'berita_kriminal',
    step: number
  ) {
    if (this.muted || this.getChannelGain('radio') <= 0.001) return;
    if (station === 'prambors') {
      const leadNotes = [261.6, 329.6, 392.0, 523.2, 440.0, 392.0, 329.6, 293.7];
      const bassNotes = [130.8, 130.8, 164.8, 164.8, 174.6, 174.6, 196.0, 146.8];
      const idx = step % leadNotes.length;
      this.playTone(bassNotes[idx], 0.18, 'triangle', 0.032, 0.98, 'radio');
      this.playTone(leadNotes[idx], 0.13, 'sine', 0.028, 1.01, 'radio');
      if (step % 2 === 1) {
        this.playTone(880, 0.04, 'triangle', 0.012, 0.7, 'radio');
      }
    } else if (station === 'koplo') {
      const bassNotes = [110.0, 146.8, 110.0, 164.8, 130.8, 146.8, 196.0, 146.8];
      const melodyNotes = [220.0, 293.6, 329.6, 293.6, 261.6, 293.6, 392.0, 329.6];
      const idx = step % bassNotes.length;
      this.playTone(bassNotes[idx], 0.16, 'sine', 0.042, 0.72, 'radio');
      if (step % 2 === 0) {
        this.playTone(95, 0.11, 'triangle', 0.035, 0.45, 'radio');
      }
      this.playTone(melodyNotes[idx], 0.14, 'triangle', 0.025, 0.96, 'radio');
    } else if (station === 'synth_scbd') {
      const arpNotes = [110.0, 164.8, 220.0, 261.6, 329.6, 261.6, 220.0, 196.0];
      const padNotes = [110.0, 110.0, 130.8, 130.8, 146.8, 146.8, 164.8, 130.8];
      const idx = step % arpNotes.length;
      this.playTone(padNotes[idx], 0.24, 'sawtooth', 0.022, 1.0, 'radio');
      this.playTone(arpNotes[idx], 0.15, 'triangle', 0.026, 1.02, 'radio');
      if (step % 4 === 0) {
        this.playTone(68, 0.14, 'sine', 0.038, 0.55, 'radio');
      }
    } else if (station === 'indie_senopati') {
      const chordNotes = [293.66, 369.99, 440.0, 554.37, 493.88, 440.0, 369.99, 329.63];
      const warmBass = [146.83, 146.83, 123.47, 123.47, 164.81, 164.81, 110.0, 110.0];
      const idx = step % chordNotes.length;
      this.playTone(warmBass[idx], 0.21, 'sine', 0.034, 0.99, 'radio');
      this.playTone(chordNotes[idx], 0.18, 'triangle', 0.026, 1.0, 'radio');
      if (step % 4 === 2) {
        this.playTone(chordNotes[idx] * 1.5, 0.09, 'sine', 0.015, 0.95, 'radio');
      }
    } else if (station === 'berita_kriminal') {
      // Tactical police dispatch & news ticker pulse
      const morseFreqs = [784.0, 784.0, 987.77, 659.25, 784.0, 587.33, 659.25, 880.0];
      const idx = step % morseFreqs.length;
      this.playTone(110.0, 0.14, 'triangle', 0.025, 0.96, 'radio');
      if (step % 2 === 0) {
        this.playTone(morseFreqs[idx], 0.07, 'sine', 0.02, 1.0, 'radio');
      }
      if (step % 8 === 0) {
        this.playTone(1318.5, 0.06, 'sine', 0.018, 1.02, 'radio');
      }
    }
  }

  public playHit(heavy: boolean = false) {
    if (heavy) {
      this.playTone(95, 0.22, 'sawtooth', 0.22, 0.35, 'sfx');
    } else {
      this.playTone(180, 0.08, 'triangle', 0.14, 0.6, 'sfx');
    }
  }

  public playPickup() {
    this.playTone(520, 0.1, 'sine', 0.14, 1.45, 'sfx');
    setTimeout(() => this.playTone(780, 0.14, 'sine', 0.14, 1.2, 'sfx'), 70);
  }

  public playVehicleDoor() {
    this.playTone(160, 0.14, 'triangle', 0.16, 1.35, 'sfx');
  }

  public playCharacterSwitchBoom(stage: 1 | 2 | 3) {
    if (stage === 1) {
      this.playTone(110, 0.24, 'sawtooth', 0.18, 0.6, 'sfx');
      setTimeout(() => this.playTone(220, 0.14, 'sine', 0.12, 1.3, 'sfx'), 80);
    } else if (stage === 2) {
      this.playTone(165, 0.22, 'triangle', 0.16, 1.25, 'sfx');
    } else {
      this.playTone(330, 0.18, 'sine', 0.18, 0.5, 'sfx');
      setTimeout(() => this.playTone(520, 0.22, 'triangle', 0.15, 1.1, 'sfx'), 90);
    }
  }

  public playPoliceSiren() {
    this.playTone(620, 0.22, 'sine', 0.055, 1.42, 'sfx');
    setTimeout(() => this.playTone(880, 0.22, 'sine', 0.055, 0.7, 'sfx'), 210);
  }

  public playNitroBoost() {
    this.playTone(140, 0.35, 'sawtooth', 0.16, 2.2, 'sfx');
  }

  public playCashRegister() {
    this.playTone(880, 0.08, 'sine', 0.14, 1.15, 'sfx');
    setTimeout(() => this.playTone(1174, 0.16, 'sine', 0.15, 1.05, 'sfx'), 75);
  }

  public playMissionFanfare() {
    this.playTone(440, 0.15, 'triangle', 0.16, 1.0, 'sfx');
    setTimeout(() => this.playTone(554, 0.15, 'triangle', 0.16, 1.0, 'sfx'), 120);
    setTimeout(() => this.playTone(659, 0.3, 'triangle', 0.18, 1.05, 'sfx'), 240);
  }

  public setVehicleCabinMuffle(inCabin: boolean): void {
    if (this.inVehicleCabin === inCabin) return;
    this.inVehicleCabin = inCabin;
    if (this.ctx && this.ambientBedFilter && this.ambientBedGain && this.currentAmbientProfile && this.ambientRunning) {
      const now = this.ctx.currentTime;
      const ambMult = this.getChannelGain('ambience');
      const baseHz = this.currentAmbientProfile.bedFilterHz;
      this.ambientBedFilter.frequency.setTargetAtTime(
        inCabin ? Math.min(380, baseHz * 0.45) : baseHz,
        now,
        0.22
      );
      this.ambientBedGain.gain.setTargetAtTime(
        Math.max(0.0001, this.currentAmbientProfile.bedGain * ambMult * (inCabin ? 0.52 : 1.0)),
        now,
        0.22
      );
    }
  }

  public syncSpatialListenerPose(pose: {
    x: number;
    y: number;
    z: number;
    forwardX: number;
    forwardY: number;
    forwardZ: number;
    upX: number;
    upY: number;
    upZ: number;
  }): void {
    if (!this.ctx || this.muted) return;
    try {
      const listener = this.ctx.listener;
      const now = this.ctx.currentTime;
      if (listener.positionX && listener.forwardX && listener.upX) {
        listener.positionX.setValueAtTime(pose.x, now);
        listener.positionY.setValueAtTime(pose.y, now);
        listener.positionZ.setValueAtTime(pose.z, now);
        listener.forwardX.setValueAtTime(pose.forwardX, now);
        listener.forwardY.setValueAtTime(pose.forwardY, now);
        listener.forwardZ.setValueAtTime(pose.forwardZ, now);
        listener.upX.setValueAtTime(pose.upX, now);
        listener.upY.setValueAtTime(pose.upY, now);
        listener.upZ.setValueAtTime(pose.upZ, now);
      } else if (typeof listener.setPosition === 'function') {
        listener.setPosition(pose.x, pose.y, pose.z);
        listener.setOrientation(
          pose.forwardX,
          pose.forwardY,
          pose.forwardZ,
          pose.upX,
          pose.upY,
          pose.upZ
        );
      }
    } catch {
      // Ignore Web Audio listener update errors
    }
  }

  public playHrtf3DTone(opts: {
    x: number;
    y: number;
    z: number;
    freq: number;
    duration: number;
    type: OscillatorType;
    volume: number;
    pitchSlide: number;
    refDistance?: number;
    maxDistance?: number;
    channel?: AudioChannel;
  }): void {
    const channel = opts.channel ?? 'sfx';
    const chMult = this.getChannelGain(channel);
    if (chMult <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = opts.type;
      osc.frequency.setValueAtTime(opts.freq, now);
      if (opts.pitchSlide !== 1.0) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(30, opts.freq * opts.pitchSlide),
          now + opts.duration
        );
      }

      const scaledVol = Math.max(0.001, opts.volume * chMult);
      gain.gain.setValueAtTime(scaledVol, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + opts.duration);

      if (typeof ctx.createPanner === 'function') {
        const panner = ctx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = opts.refDistance ?? 6;
        panner.maxDistance = opts.maxDistance ?? 68;
        panner.rolloffFactor = 1.35;
        if (panner.positionX) {
          panner.positionX.setValueAtTime(opts.x, now);
          panner.positionY.setValueAtTime(opts.y, now);
          panner.positionZ.setValueAtTime(opts.z, now);
        } else {
          panner.setPosition(opts.x, opts.y, opts.z);
        }
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + opts.duration);
    } catch {
      // Ignore Web Audio errors on locked contexts
    }
  }

  public playSpatialTone(
    freq: number,
    duration: number,
    type: OscillatorType,
    volume: number,
    pitchSlide: number,
    pan: number,
    distance: number,
    maxDistance: number = 55,
    channel: AudioChannel = 'sfx'
  ): void {
    const chMult = this.getChannelGain(channel);
    if (chMult <= 0.001) return;
    const atten = Math.max(0, 1 - distance / Math.max(1, maxDistance));
    if (atten <= 0.03) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (pitchSlide !== 1.0) {
        osc.frequency.exponentialRampToValueAtTime(
          Math.max(30, freq * pitchSlide),
          now + duration
        );
      }

      const scaledVol = Math.max(0.001, volume * atten * chMult);
      gain.gain.setValueAtTime(scaledVol, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

      if (panner) {
        panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Ignore Web Audio errors on locked contexts
    }
  }

  public updateDriftAudio(intensity: number, active: boolean): void {
    const sfxMult = this.getChannelGain('sfx');
    if (!active || intensity <= 0.08 || this.muted || sfxMult <= 0.001) {
      if (this.driftRunning && this.ctx && this.driftGain) {
        const now = this.ctx.currentTime;
        this.driftGain.gain.setTargetAtTime(0.0001, now, 0.04);
      }
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (!this.driftRunning || !this.driftOsc || !this.driftFilter || !this.driftGain) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(720, now);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1150, now);
        filter.Q.setValueAtTime(5.2, now);
        gain.gain.setValueAtTime(0.0001, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);

        this.driftOsc = osc;
        this.driftFilter = filter;
        this.driftGain = gain;
        this.driftRunning = true;
      }

      const clamped = Math.min(1, Math.max(0, intensity));
      this.driftOsc.frequency.setTargetAtTime(680 + clamped * 290, now, 0.05);
      this.driftFilter.frequency.setTargetAtTime(980 + clamped * 540, now, 0.05);
      this.driftGain.gain.setTargetAtTime(0.024 * clamped * sfxMult, now, 0.05);
    } catch {
      // Ignore audio errors
    }
  }

  public stopDriftAudio(): void {
    if (!this.driftRunning || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.driftGain?.gain.setTargetAtTime(0.0001, now, 0.02);
      const osc = this.driftOsc;
      const filter = this.driftFilter;
      const gain = this.driftGain;
      this.driftOsc = null;
      this.driftFilter = null;
      this.driftGain = null;
      this.driftRunning = false;
      osc?.stop(now + 0.08);
      window.setTimeout(() => {
        try {
          osc?.disconnect();
          filter?.disconnect();
          gain?.disconnect();
        } catch {
          // Ignore already disconnected
        }
      }, 120);
    } catch {
      this.driftRunning = false;
    }
  }

  public playPropCrash(pan: number = 0): void {
    this.playSpatialTone(185, 0.14, 'triangle', 0.15, 0.42, pan, 4, 40, 'sfx');
    this.playSpatialTone(420, 0.09, 'square', 0.08, 0.65, pan, 4, 40, 'sfx');
  }

  public playThunderBoom(): void {
    this.playTone(54, 0.85, 'sawtooth', 0.11, 0.42, 'ambience');
    window.setTimeout(() => {
      this.playTone(42, 0.95, 'triangle', 0.095, 0.55, 'ambience');
    }, 180);
  }

  public playVictoryFanfare(): void {
    this.playTone(523.25, 0.14, 'triangle', 0.16, 1.0, 'sfx');
    window.setTimeout(
      () => this.playTone(659.25, 0.16, 'triangle', 0.17, 1.0, 'sfx'),
      110
    );
    window.setTimeout(
      () => this.playTone(783.99, 0.24, 'triangle', 0.18, 1.0, 'sfx'),
      230
    );
    window.setTimeout(
      () => this.playTone(1046.5, 0.36, 'sine', 0.16, 1.0, 'sfx'),
      360
    );
  }

  public playDefeatSting() {
    this.playTone(260, 0.25, 'sawtooth', 0.18, 0.7, 'sfx');
    setTimeout(() => this.playTone(175, 0.45, 'sawtooth', 0.2, 0.5, 'sfx'), 200);
  }
}

export const soundEngine = new SoundEngine();

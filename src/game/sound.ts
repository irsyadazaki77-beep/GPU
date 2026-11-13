import {
  AmbientCueId,
  AmbientSoundscapeProfile,
  WeatherMode,
  resolveJakartaAmbientProfile,
} from './rules';

class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private engineOsc: OscillatorNode | null = null;
  private engineSubOsc: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private engineRunning: boolean = false;

  // Dynamic Jakarta Ambient Soundscape Layer
  private ambientNoiseBuffer: AudioBuffer | null = null;
  private ambientBedSource: AudioBufferSourceNode | null = null;
  private ambientBedFilter: BiquadFilterNode | null = null;
  private ambientBedGain: GainNode | null = null;
  private ambientLfoOsc: OscillatorNode | null = null;
  private ambientLfoGain: GainNode | null = null;
  private ambientRunning: boolean = false;
  private currentAmbientProfile: AmbientSoundscapeProfile | null = null;
  private userUnlocked: boolean = false;

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

    // Paul Kellet's pink noise filter approximation for warm urban/rain/coastal ambience
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
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
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
      this.ambientBedGain.gain.setTargetAtTime(profile.bedGain, now, 0.55);

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
    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      if (cue === 'distant_traffic') {
        // Distant Jakarta Bajaj/Metromini two-tone horn & passing Doppler swell
        const isBusHorn = Math.random() > 0.45;
        const baseA = isBusHorn ? 196 : 340;
        const baseB = isBusHorn ? 247 : 425;
        this.scheduleMuffledHorn(ctx, now + 0.05, baseA, baseB, 0.14, 0.018);
        this.scheduleMuffledHorn(ctx, now + 0.25, baseA, baseB, 0.22, 0.02);
      } else if (cue === 'street_vendor_tektek') {
        // Authentic street food vendor bamboo kentongan / wok "tek-tek-tek" rhythm
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
          gain.gain.linearRampToValueAtTime(tap.vol, now + tap.offset + 0.008);
          gain.gain.exponentialRampToValueAtTime(
            0.0008,
            now + tap.offset + 0.07
          );
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + tap.offset);
          osc.stop(now + tap.offset + 0.075);
        }
      } else if (cue === 'prayer_call_echo') {
        // Distant mosque bedug drum pulse + warm reverberant Hijaz/Pelog melodic phrase
        this.playTone(74, 0.34, 'sine', 0.032, 0.62);
        this.playTone(76, 0.28, 'sine', 0.024, 0.65);

        const notes = [
          { offset: 0.22, freq: 293.66, dur: 0.55 }, // D4
          { offset: 0.72, freq: 311.13, dur: 0.45 }, // Eb4 (Hijaz inflection)
          { offset: 1.12, freq: 369.99, dur: 0.75 }, // F#4
          { offset: 1.82, freq: 392.0, dur: 0.9 },   // G4
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
          gain.gain.linearRampToValueAtTime(0.02, now + n.offset + 0.14);
          gain.gain.exponentialRampToValueAtTime(
            0.0008,
            now + n.offset + n.dur
          );

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + n.offset);
          osc.stop(now + n.offset + n.dur + 0.04);
        }
      } else if (cue === 'harbor_foghorn_gulls') {
        // Deep Tanjung Priok / Ancol cargo vessel foghorn + distant coastal gull call
        this.scheduleMuffledHorn(ctx, now + 0.05, 98, 147, 0.85, 0.026);
        window.setTimeout(() => {
          this.playTone(1480, 0.24, 'sine', 0.014, 0.76);
        }, 480);
      } else if (cue === 'monsoon_rain_thunder') {
        // Distant tropical monsoon thunder rumble across Jakarta skyline
        this.playTone(58, 0.65, 'triangle', 0.036, 0.48);
        window.setTimeout(() => {
          this.playTone(44, 0.75, 'sine', 0.032, 0.55);
        }, 220);
      } else if (cue === 'mrt_chime_station') {
        // 3-note Jakarta MRT/LRT transit station platform chime (C5 - E5 - G5)
        const chimeNotes = [523.25, 659.25, 783.99];
        chimeNotes.forEach((freq, idx) => {
          const t0 = now + idx * 0.22;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, t0);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.linearRampToValueAtTime(0.02, t0 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.36);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t0);
          osc.stop(t0 + 0.38);
        });
      } else if (cue === 'night_cicada_neon') {
        // Tropical Jakarta night cricket chirps & subtle neon hum
        for (let i = 0; i < 3; i++) {
          const t0 = now + i * 0.14;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(2950 + (i % 2) * 180, t0);
          gain.gain.setValueAtTime(0.0001, t0);
          gain.gain.linearRampToValueAtTime(0.011, t0 + 0.015);
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
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.03);
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
    if (!active || !isDriving || this.muted) {
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
        0.02 + Math.min(1, sr) * 0.028 + (nitroActive ? 0.012 : 0);

      this.engineOsc.frequency.setTargetAtTime(baseFreq, now, 0.08);
      this.engineSubOsc.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.08);
      this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.08);
      this.engineGain.gain.setTargetAtTime(gainTarget, now, 0.09);
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
    pitchSlide: number = 1.0
  ) {
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

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    } catch {
      // Ignore audio errors on locked contexts
    }
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
      this.playTone(130, 0.09, 'triangle', 0.15, 0.5);
    } else if (weapon === 'golok') {
      this.playTone(320, 0.12, 'sawtooth', 0.14, 0.35);
    } else if (weapon === 'pistol') {
      this.playTone(240, 0.14, 'sawtooth', 0.18, 0.25);
    } else if (weapon === 'mercon') {
      this.playTone(90, 0.38, 'sawtooth', 0.24, 0.22);
      setTimeout(() => this.playTone(65, 0.32, 'square', 0.2, 0.4), 80);
    } else if (weapon === 'pasopati') {
      this.playTone(680, 0.18, 'sine', 0.2, 0.45);
      setTimeout(() => this.playTone(420, 0.22, 'triangle', 0.16, 1.5), 55);
    } else if (weapon === 'gatotkaca') {
      this.playTone(840, 0.22, 'sawtooth', 0.22, 0.3);
      setTimeout(() => this.playTone(110, 0.34, 'sine', 0.22, 0.5), 45);
    } else {
      this.playTone(290, 0.09, 'square', 0.15, 0.3);
    }
  }

  public playRadioBeat(
    station: 'prambors' | 'koplo' | 'synth_scbd',
    step: number
  ) {
    if (this.muted) return;
    if (station === 'prambors') {
      const leadNotes = [261.6, 329.6, 392.0, 523.2, 440.0, 392.0, 329.6, 293.7];
      const bassNotes = [130.8, 130.8, 164.8, 164.8, 174.6, 174.6, 196.0, 146.8];
      const idx = step % leadNotes.length;
      this.playTone(bassNotes[idx], 0.18, 'triangle', 0.032, 0.98);
      this.playTone(leadNotes[idx], 0.13, 'sine', 0.028, 1.01);
      if (step % 2 === 1) {
        this.playTone(880, 0.04, 'triangle', 0.012, 0.7);
      }
    } else if (station === 'koplo') {
      const bassNotes = [110.0, 146.8, 110.0, 164.8, 130.8, 146.8, 196.0, 146.8];
      const melodyNotes = [220.0, 293.6, 329.6, 293.6, 261.6, 293.6, 392.0, 329.6];
      const idx = step % bassNotes.length;
      this.playTone(bassNotes[idx], 0.16, 'sine', 0.042, 0.72);
      if (step % 2 === 0) {
        this.playTone(95, 0.11, 'triangle', 0.035, 0.45);
      }
      this.playTone(melodyNotes[idx], 0.14, 'triangle', 0.025, 0.96);
    } else if (station === 'synth_scbd') {
      const arpNotes = [110.0, 164.8, 220.0, 261.6, 329.6, 261.6, 220.0, 196.0];
      const padNotes = [110.0, 110.0, 130.8, 130.8, 146.8, 146.8, 164.8, 130.8];
      const idx = step % arpNotes.length;
      this.playTone(padNotes[idx], 0.24, 'sawtooth', 0.022, 1.0);
      this.playTone(arpNotes[idx], 0.15, 'triangle', 0.026, 1.02);
      if (step % 4 === 0) {
        this.playTone(68, 0.14, 'sine', 0.038, 0.55);
      }
    }
  }

  public playHit(heavy: boolean = false) {
    if (heavy) {
      this.playTone(95, 0.22, 'sawtooth', 0.22, 0.35);
    } else {
      this.playTone(180, 0.08, 'triangle', 0.14, 0.6);
    }
  }

  public playPickup() {
    this.playTone(520, 0.1, 'sine', 0.14, 1.45);
    setTimeout(() => this.playTone(780, 0.14, 'sine', 0.14, 1.2), 70);
  }

  public playVehicleDoor() {
    this.playTone(160, 0.14, 'triangle', 0.16, 1.35);
  }

  public playCharacterSwitchBoom(stage: 1 | 2 | 3) {
    if (stage === 1) {
      this.playTone(110, 0.24, 'sawtooth', 0.18, 0.6);
      setTimeout(() => this.playTone(220, 0.14, 'sine', 0.12, 1.3), 80);
    } else if (stage === 2) {
      this.playTone(165, 0.22, 'triangle', 0.16, 1.25);
    } else {
      this.playTone(330, 0.18, 'sine', 0.18, 0.5);
      setTimeout(() => this.playTone(520, 0.22, 'triangle', 0.15, 1.1), 90);
    }
  }

  public playPoliceSiren() {
    this.playTone(620, 0.22, 'sine', 0.055, 1.42);
    setTimeout(() => this.playTone(880, 0.22, 'sine', 0.055, 0.7), 210);
  }

  public playNitroBoost() {
    this.playTone(140, 0.35, 'sawtooth', 0.16, 2.2);
  }

  public playCashRegister() {
    this.playTone(880, 0.08, 'sine', 0.14, 1.15);
    setTimeout(() => this.playTone(1174, 0.16, 'sine', 0.15, 1.05), 75);
  }

  public playMissionFanfare() {
    this.playTone(440, 0.15, 'triangle', 0.16, 1.0);
    setTimeout(() => this.playTone(554, 0.15, 'triangle', 0.16, 1.0), 120);
    setTimeout(() => this.playTone(659, 0.3, 'triangle', 0.18, 1.05), 240);
  }

  public playDefeatSting() {
    this.playTone(260, 0.25, 'sawtooth', 0.18, 0.7);
    setTimeout(() => this.playTone(175, 0.45, 'sawtooth', 0.2, 0.5), 200);
  }
}

export const soundEngine = new SoundEngine();


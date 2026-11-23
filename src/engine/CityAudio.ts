import { soundEngine } from '../game/sound';

/**
 * Lightweight Procedural Web Audio API synthesizer for San Nabilo Open-World:
 * - Speed-linked vehicle engine harmonic hum
 * - Dual-tone Jakarta car/angkot horn & reactive nearby traffic response horn
 * - Punchy low-end collision thud
 * - Subtle distant Jakarta urban ambience bed
 * Respects browser autoplay policies (unlocks on first user gesture) and global mute state.
 */
class CityAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOscMain: OscillatorNode | null = null;
  private engineOscSub: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private unlocked = false;

  private getSfxMasterGain(): number {
    if (soundEngine.muted) return 0;
    const vols = soundEngine.getChannelVolumes();
    return Math.max(0, Math.min(1, vols.master * vols.sfx)) * 0.72;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.getSfxMasterGain();
      this.masterGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 2.8;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.unlocked = true;
    this.syncMuteState(soundEngine.muted);
  }

  public syncMuteState(muted: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(
      muted ? 0 : this.getSfxMasterGain(),
      now,
      0.05
    );
  }

  public updateEngine(
    speedRatio: number,
    isDriving: boolean,
    vehicleType: string | null = null
  ): void {
    if (!this.unlocked || soundEngine.muted) {
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      }
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    if (!this.engineOscMain && isDriving) {
      this.engineOscMain = ctx.createOscillator();
      this.engineOscSub = ctx.createOscillator();
      this.engineFilter = ctx.createBiquadFilter();
      this.engineGain = ctx.createGain();

      this.engineOscMain.type = 'sawtooth';
      this.engineOscSub.type = 'triangle';
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 180;
      this.engineFilter.Q.value = 1.6;
      this.engineGain.gain.value = 0.0001;

      this.engineOscMain.connect(this.engineFilter);
      this.engineOscSub.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOscMain.start();
      this.engineOscSub.start();
    }

    if (
      this.engineOscMain &&
      this.engineOscSub &&
      this.engineFilter &&
      this.engineGain
    ) {
      const now = ctx.currentTime;
      if (!isDriving) {
        this.engineGain.gain.setTargetAtTime(0, now, 0.12);
        return;
      }
      const r = Math.max(0, Math.min(1.25, speedRatio));
      // Distinct acoustic signature per Indonesian vehicle archetype
      let waveMain: OscillatorType = 'sawtooth';
      let baseIdle = 52;
      let revSpan = 118;
      let subRatio = 0.5;
      let filterBase = 160;
      let filterSpan = 420;
      let gainPeak = 0.038;

      if (vehicleType === 'bajaj') {
        waveMain = 'square';
        baseIdle = 68;
        revSpan = 132;
        subRatio = 0.34;
        filterBase = 260;
        filterSpan = 520;
        gainPeak = 0.032;
      } else if (vehicleType === 'ojek') {
        waveMain = 'sawtooth';
        baseIdle = 74;
        revSpan = 165;
        subRatio = 0.5;
        filterBase = 240;
        filterSpan = 580;
      } else if (vehicleType === 'supercar') {
        waveMain = 'sawtooth';
        baseIdle = 62;
        revSpan = 195;
        subRatio = 1.5; // High-rev harmonic fifth
        filterBase = 220;
        filterSpan = 740;
        gainPeak = 0.044;
      } else if (
        vehicleType === 'transjakarta' ||
        vehicleType === 'metromini' ||
        vehicleType === 'barracuda'
      ) {
        waveMain = 'triangle';
        baseIdle = 36;
        revSpan = 68;
        subRatio = 0.5;
        filterBase = 110;
        filterSpan = 240;
        gainPeak = 0.045;
      } else if (vehicleType === 'speedboat') {
        waveMain = 'sawtooth';
        baseIdle = 48;
        revSpan = 128;
        subRatio = 0.75;
        filterBase = 190;
        filterSpan = 480;
      } else if (vehicleType === 'heli' || vehicleType === 'vtol_jet') {
        waveMain = 'triangle';
        baseIdle = vehicleType === 'vtol_jet' ? 84 : 44;
        revSpan = vehicleType === 'vtol_jet' ? 140 : 54;
        subRatio = 0.25;
        filterBase = 150;
        filterSpan = 360;
      }

      if (this.engineOscMain.type !== waveMain) {
        this.engineOscMain.type = waveMain;
      }

      const baseFreq = baseIdle + r * revSpan;
      this.engineOscMain.frequency.setTargetAtTime(baseFreq, now, 0.07);
      this.engineOscSub.frequency.setTargetAtTime(baseFreq * subRatio, now, 0.07);
      this.engineFilter.frequency.setTargetAtTime(filterBase + r * filterSpan, now, 0.08);
      this.engineGain.gain.setTargetAtTime(0.028 + r * gainPeak, now, 0.08);
    }
  }

  public updateUrbanAmbience(active: boolean, nightFactor: number): void {
    if (!this.unlocked || soundEngine.muted) {
      if (this.ambientGain && this.ctx) {
        this.ambientGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      }
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    if (!this.ambientSource && active) {
      const src = ctx.createBufferSource();
      src.buffer = this.getNoiseBuffer(ctx);
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 260;
      filter.Q.value = 0.7;

      const gain = ctx.createGain();
      gain.gain.value = 0.0001;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      src.start();

      this.ambientSource = src;
      this.ambientFilter = filter;
      this.ambientGain = gain;
    }

    if (this.ambientGain && this.ambientFilter) {
      const now = ctx.currentTime;
      const targetVol = active ? 0.032 - nightFactor * 0.008 : 0;
      this.ambientGain.gain.setTargetAtTime(targetVol, now, 0.25);
      this.ambientFilter.frequency.setTargetAtTime(
        310 - nightFactor * 80,
        now,
        0.3
      );
    }
  }

  /**
   * Dual-tone Jakarta klakson (F4 + A4 disharmonic twin horn)
   */
  public playHorn(): void {
    const masterSfx = this.getSfxMasterGain();
    if (masterSfx <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.masterGain.gain.setTargetAtTime(masterSfx, ctx.currentTime, 0.02);

    const now = ctx.currentTime;
    const dur = 0.28;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 920;
    filter.Q.value = 1.2;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.018);
    gain.gain.setValueAtTime(0.14, now + dur - 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    const freqs = [349.23, 440.0];
    for (const freq of freqs) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    }

    filter.connect(gain);
    gain.connect(this.masterGain);
  }

  /**
   * Short delayed honk-back from nearby reactive traffic (Angkot / Ojol / Sedan)
   */
  public playTrafficResponseHorn(pitchMult: number = 1.0, delaySec: number = 0.16): void {
    const masterSfx = this.getSfxMasterGain();
    if (masterSfx <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;
    this.masterGain.gain.setTargetAtTime(masterSfx, ctx.currentTime, 0.02);

    const start = ctx.currentTime + delaySec;
    const dur = 0.16;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1250;

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.085, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

    for (const f of [392 * pitchMult, 493.88 * pitchMult]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, start);
      osc.connect(filter);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    }
    filter.connect(gain);
    gain.connect(this.masterGain);
  }

  /**
   * Low-end tactile collision thud scaled by impact intensity (0..1)
   */
  public playCollisionThud(intensity: number = 0.65): void {
    const masterSfx = this.getSfxMasterGain();
    if (masterSfx <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;
    this.masterGain.gain.setTargetAtTime(masterSfx, ctx.currentTime, 0.02);

    const now = ctx.currentTime;
    const amp = Math.max(0.06, Math.min(0.28, intensity * 0.24));

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(118, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.19);

    gain.gain.setValueAtTime(amp, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  /**
   * Dual-pop racing exhaust backfire crackle on high-RPM gear shift or throttle lift-off
   */
  public playExhaustBackfire(intensity: number = 0.7): void {
    const masterSfx = this.getSfxMasterGain();
    if (masterSfx <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;
    this.masterGain.gain.setTargetAtTime(masterSfx, ctx.currentTime, 0.02);

    const now = ctx.currentTime;
    const popOffsets = [0, 0.065];
    for (let i = 0; i < popOffsets.length; i++) {
      const t0 = now + popOffsets[i];
      const amp = Math.max(0.05, Math.min(0.22, intensity * (i === 0 ? 0.18 : 0.12)));

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(i === 0 ? 155 : 132, t0);
      osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.055);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(240, t0);
      filter.Q.setValueAtTime(1.4, t0);

      gain.gain.setValueAtTime(amp, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.065);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.075);
    }
  }

  /**
   * Warm resonant Maghrib bedug drum chime at Jakarta twilight (17:50 - 18:25 WIB)
   */
  public playDistantMaghribBedug(): void {
    const masterSfx = this.getSfxMasterGain();
    if (masterSfx <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const strikes = [0, 0.42, 0.78];
    for (let i = 0; i < strikes.length; i++) {
      const t0 = now + strikes[i];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(92 - i * 4, t0);
      osc.frequency.exponentialRampToValueAtTime(46, t0 + 0.34);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.065, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.36);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    }
  }

  /**
   * Deep maritime container ship foghorn near Tanjung Priok / Jakarta Bay coast
   */
  public playHarborFoghorn(): void {
    const masterSfx = this.getSfxMasterGain();
    if (masterSfx <= 0.001) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const dur = 1.45;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(210, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.075, now + 0.22);
    gain.gain.setValueAtTime(0.068, now + dur - 0.35);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    for (const freq of [73.42, 110.0]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + dur + 0.05);
    }

    filter.connect(gain);
    gain.connect(this.masterGain);
  }

  public dispose(): void {
    try {
      this.engineOscMain?.stop();
      this.engineOscSub?.stop();
      this.ambientSource?.stop();
    } catch {
      // Ignore already-stopped nodes
    }
    this.engineOscMain = null;
    this.engineOscSub = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.ambientSource = null;
    this.ambientFilter = null;
    this.ambientGain = null;
    this.noiseBuffer = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.masterGain = null;
    }
    this.unlocked = false;
  }
}

export const cityAudio = new CityAudioSynthesizer();

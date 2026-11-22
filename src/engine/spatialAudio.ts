import { soundEngine, type AudioChannel } from '../game/sound';
import { computeDopplerPitchMultiplier } from '../game/rules';

export interface SpatialEmitter3D {
  x: number;
  y: number;
  z: number;
}

export interface ListenerPose3D {
  x: number;
  y: number;
  z: number;
  forwardX: number;
  forwardY: number;
  forwardZ: number;
  upX: number;
  upY: number;
  upZ: number;
}

/**
 * Computes stereo pan [-1, 1] and inverse distance attenuation [0, 1]
 * relative to a 3D camera listener pose. Pure function for deterministic testing
 * and fallback when HRTF PannerNode is unavailable.
 */
export function computeSpatialPanAndAttenuation(
  listener: ListenerPose3D,
  source: SpatialEmitter3D,
  refDistance: number = 6,
  maxDistance: number = 68,
  rolloffFactor: number = 1.35
): { pan: number; attenuation: number; distance: number } {
  const dx = source.x - listener.x;
  const dy = source.y - listener.y;
  const dz = source.z - listener.z;
  const distance = Math.hypot(dx, dy, dz);

  if (distance >= maxDistance) {
    return { pan: 0, attenuation: 0, distance };
  }

  // Right vector = forward x up
  const rx = listener.forwardY * listener.upZ - listener.forwardZ * listener.upY;
  const ry = listener.forwardZ * listener.upX - listener.forwardX * listener.upZ;
  const rz = listener.forwardX * listener.upY - listener.forwardY * listener.upX;
  const rLen = Math.hypot(rx, ry, rz) || 1;

  const invD = 1 / Math.max(0.001, distance);
  const panRaw = ((dx * rx + dy * ry + dz * rz) / rLen) * invD;
  const pan = Math.max(-1, Math.min(1, panRaw));

  const clampedDist = Math.max(refDistance, distance);
  const invAtten =
    refDistance /
    (refDistance + rolloffFactor * (clampedDist - refDistance));
  const linearEdgeFade = 1 - distance / maxDistance;
  const attenuation = Math.max(0, Math.min(1, invAtten * linearEdgeFade));

  return { pan, attenuation, distance };
}

class SpatialAudioEngine {
  private listenerPose: ListenerPose3D = {
    x: 0,
    y: 4,
    z: 32,
    forwardX: 0,
    forwardY: 0,
    forwardZ: -1,
    upX: 0,
    upY: 1,
    upZ: 0,
  };

  public syncCameraListener(pose: ListenerPose3D): void {
    this.listenerPose = pose;
    soundEngine.syncSpatialListenerPose(pose);
  }

  public getListenerPose(): ListenerPose3D {
    return this.listenerPose;
  }

  public play3DSound(options: {
    source: SpatialEmitter3D;
    freq: number;
    duration: number;
    type?: OscillatorType;
    volume?: number;
    pitchSlide?: number;
    refDistance?: number;
    maxDistance?: number;
    channel?: AudioChannel;
  }): void {
    const {
      source,
      freq,
      duration,
      type = 'sawtooth',
      volume = 0.12,
      pitchSlide = 1.0,
      refDistance = 6,
      maxDistance = 65,
      channel = 'sfx',
    } = options;

    soundEngine.playHrtf3DTone({
      x: source.x,
      y: source.y,
      z: source.z,
      freq,
      duration,
      type,
      volume,
      pitchSlide,
      refDistance,
      maxDistance,
      channel,
    });
  }

  public playTransJakartaHorn3D(x: number, y: number, z: number): void {
    this.play3DSound({
      source: { x, y, z },
      freq: 196,
      duration: 0.22,
      type: 'sawtooth',
      volume: 0.14,
      pitchSlide: 0.98,
      refDistance: 8,
      maxDistance: 72,
    });
    this.play3DSound({
      source: { x, y, z },
      freq: 247,
      duration: 0.22,
      type: 'triangle',
      volume: 0.11,
      pitchSlide: 0.98,
      refDistance: 8,
      maxDistance: 72,
    });
  }

  public playOjolHorn3D(x: number, y: number, z: number): void {
    this.play3DSound({
      source: { x, y, z },
      freq: 440,
      duration: 0.12,
      type: 'triangle',
      volume: 0.11,
      pitchSlide: 1.04,
      refDistance: 6,
      maxDistance: 52,
    });
  }

  public playPoliceSiren3D(
    x: number,
    y: number,
    z: number,
    highPhase: boolean,
    vx: number = 0,
    vz: number = 0
  ): void {
    const doppler = computeDopplerPitchMultiplier({
      sourceX: x,
      sourceY: y,
      sourceZ: z,
      sourceVx: vx,
      sourceVy: 0,
      sourceVz: vz,
      listenerX: this.listenerPose.x,
      listenerY: this.listenerPose.y,
      listenerZ: this.listenerPose.z,
    });
    this.play3DSound({
      source: { x, y, z },
      freq: (highPhase ? 880 : 620) * doppler,
      duration: 0.2,
      type: 'sine',
      volume: 0.085,
      pitchSlide: highPhase ? 0.78 : 1.28,
      refDistance: 10,
      maxDistance: 80,
    });
  }

  public playDopplerPass3D(
    x: number,
    y: number,
    z: number,
    vx: number,
    vz: number
  ): void {
    const doppler = computeDopplerPitchMultiplier({
      sourceX: x,
      sourceY: y,
      sourceZ: z,
      sourceVx: vx,
      sourceVy: 0,
      sourceVz: vz,
      listenerX: this.listenerPose.x,
      listenerY: this.listenerPose.y,
      listenerZ: this.listenerPose.z,
    });
    this.play3DSound({
      source: { x, y, z },
      freq: 145 * doppler,
      duration: 0.28,
      type: 'sawtooth',
      volume: 0.055,
      pitchSlide: 0.88,
      refDistance: 8,
      maxDistance: 58,
    });
  }
}

export const spatialAudio = new SpatialAudioEngine();

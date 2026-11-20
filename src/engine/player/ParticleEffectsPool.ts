import * as THREE from 'three';

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
}

interface TracerSlot {
  active: boolean;
  midX: number;
  midY: number;
  midZ: number;
  yaw: number;
  length: number;
  life: number;
  maxLife: number;
  colorHex: number;
}

const PARTICLE_CAP = 112;
const TRACER_CAP = 16;
const SKIDMARK_CAP = 140;

/**
 * Zero-GC InstancedMesh ring-buffered pool for particles, bullet tracers, and tire skidmarks.
 */
export class ParticleEffectsPool {
  private readonly particleGeo: THREE.BoxGeometry;
  private readonly particleMat: THREE.MeshBasicMaterial;
  private readonly particleInst: THREE.InstancedMesh;
  private readonly particles: ParticleSlot[];
  private particleCursor = 0;
  private prevParticleCount = -1;

  private readonly tracerGeo: THREE.BoxGeometry;
  private readonly tracerMat: THREE.MeshBasicMaterial;
  private readonly tracerInst: THREE.InstancedMesh;
  private readonly tracers: TracerSlot[];
  private tracerCursor = 0;
  private prevTracerCount = -1;

  private readonly skidGeo: THREE.PlaneGeometry;
  private readonly skidMat: THREE.MeshBasicMaterial;
  private readonly skidInst: THREE.InstancedMesh;
  private skidCursor = 0;

  private readonly _v1 = new THREE.Vector3();
  private readonly _scale = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();
  private readonly _mat4 = new THREE.Matrix4();
  private readonly _color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    this.particleGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    this.particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInst = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      PARTICLE_CAP
    );
    this.particleInst.count = 0;
    this.particleInst.frustumCulled = false;
    scene.add(this.particleInst);

    this.particles = Array.from({ length: PARTICLE_CAP }, () => ({
      active: false,
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.4,
      size: 1,
      colorHex: 0xfef08a,
    }));

    this.tracerGeo = new THREE.BoxGeometry(0.06, 0.06, 1.0);
    this.tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.tracerInst = new THREE.InstancedMesh(
      this.tracerGeo,
      this.tracerMat,
      TRACER_CAP
    );
    this.tracerInst.count = 0;
    this.tracerInst.frustumCulled = false;
    scene.add(this.tracerInst);

    this.tracers = Array.from({ length: TRACER_CAP }, () => ({
      active: false,
      midX: 0,
      midY: -100,
      midZ: 0,
      yaw: 0,
      length: 1,
      life: 0,
      maxLife: 0.09,
      colorHex: 0xfde047,
    }));

    this.skidGeo = new THREE.PlaneGeometry(0.32, 1.45);
    this.skidGeo.rotateX(-Math.PI / 2);
    this.skidMat = new THREE.MeshBasicMaterial({
      color: 0x090c12,
      transparent: true,
      opacity: 0.56,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.skidInst = new THREE.InstancedMesh(
      this.skidGeo,
      this.skidMat,
      SKIDMARK_CAP
    );
    this.skidInst.frustumCulled = false;
    this._v1.set(0, -100, 0);
    this._scale.setScalar(0.001);
    this._mat4.compose(this._v1, this._quat.identity(), this._scale);
    for (let i = 0; i < SKIDMARK_CAP; i++) {
      this.skidInst.setMatrixAt(i, this._mat4);
    }
    this.skidInst.instanceMatrix.needsUpdate = true;
    scene.add(this.skidInst);
  }

  public spawnParticles(
    x: number,
    y: number,
    z: number,
    count: number,
    colorHex: number,
    speed: number = 6
  ): void {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_CAP;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      const ang = Math.random() * Math.PI * 2;
      const spd = (0.35 + Math.random() * 0.65) * speed;
      slot.vx = Math.cos(ang) * spd;
      slot.vy = 2.0 + Math.random() * (speed * 0.65);
      slot.vz = Math.sin(ang) * spd;
      slot.life = 0;
      slot.maxLife = 0.22 + Math.random() * 0.28;
      slot.size = 0.7 + Math.random() * 0.9;
      slot.colorHex = colorHex;
    }
  }

  public spawnTracer(
    fromX: number,
    fromY: number,
    fromZ: number,
    toX: number,
    toY: number,
    toZ: number,
    colorHex: number = 0xfde047
  ): void {
    const slot = this.tracers[this.tracerCursor];
    this.tracerCursor = (this.tracerCursor + 1) % TRACER_CAP;
    const dx = toX - fromX;
    const dz = toZ - fromZ;
    slot.active = true;
    slot.midX = (fromX + toX) * 0.5;
    slot.midY = (fromY + toY) * 0.5;
    slot.midZ = (fromZ + toZ) * 0.5;
    slot.yaw = Math.atan2(dx, dz);
    slot.length = Math.max(0.6, Math.hypot(dx, dz));
    slot.life = 0;
    slot.maxLife = 0.085;
    slot.colorHex = colorHex;
  }

  public dropSkidmarkPair(
    cx: number,
    cy: number,
    cz: number,
    heading: number
  ): void {
    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    const backX = cx - sinH * 1.15;
    const backZ = cz - cosH * 1.15;
    const sideX = cosH * 0.72;
    const sideZ = -sinH * 0.72;

    this._euler.set(0, heading, 0);
    this._quat.setFromEuler(this._euler);
    this._scale.set(1, 1, 1);

    for (const sign of [-1, 1]) {
      const idx = this.skidCursor;
      this.skidCursor = (this.skidCursor + 1) % SKIDMARK_CAP;
      this._v1.set(backX + sideX * sign, cy + 0.055, backZ + sideZ * sign);
      this._mat4.compose(this._v1, this._quat, this._scale);
      this.skidInst.setMatrixAt(idx, this._mat4);
    }
    this.skidInst.instanceMatrix.needsUpdate = true;
  }

  public step(dt: number): void {
    let activeParticleCount = 0;
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy -= 14 * dt;

      const t = 1 - p.life / p.maxLife;
      this._v1.set(p.x, Math.max(0.05, p.y), p.z);
      this._scale.setScalar(p.size * t);
      this._mat4.compose(this._v1, this._quat.identity(), this._scale);
      this.particleInst.setMatrixAt(activeParticleCount, this._mat4);
      this._color.setHex(p.colorHex);
      this.particleInst.setColorAt(activeParticleCount, this._color);
      activeParticleCount++;
    }
    this.particleInst.count = activeParticleCount;
    if (activeParticleCount > 0 || this.prevParticleCount > 0) {
      this.particleInst.instanceMatrix.needsUpdate = true;
      if (this.particleInst.instanceColor) {
        this.particleInst.instanceColor.needsUpdate = true;
      }
    }
    this.prevParticleCount = activeParticleCount;

    let activeTracerCount = 0;
    for (let i = 0; i < TRACER_CAP; i++) {
      const tr = this.tracers[i];
      if (!tr.active) continue;
      tr.life += dt;
      if (tr.life >= tr.maxLife) {
        tr.active = false;
        continue;
      }
      const alphaScale = Math.max(0.1, 1 - tr.life / tr.maxLife);
      this._v1.set(tr.midX, tr.midY, tr.midZ);
      this._euler.set(0, tr.yaw, 0);
      this._quat.setFromEuler(this._euler);
      this._scale.set(alphaScale, alphaScale, tr.length);
      this._mat4.compose(this._v1, this._quat, this._scale);
      this.tracerInst.setMatrixAt(activeTracerCount, this._mat4);
      this._color.setHex(tr.colorHex);
      this.tracerInst.setColorAt(activeTracerCount, this._color);
      activeTracerCount++;
    }
    this.tracerInst.count = activeTracerCount;
    if (activeTracerCount > 0 || this.prevTracerCount > 0) {
      this.tracerInst.instanceMatrix.needsUpdate = true;
      if (this.tracerInst.instanceColor) {
        this.tracerInst.instanceColor.needsUpdate = true;
      }
    }
    this.prevTracerCount = activeTracerCount;
  }

  public dispose(): void {
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.tracerGeo.dispose();
    this.tracerMat.dispose();
    this.skidGeo.dispose();
    this.skidMat.dispose();
  }
}

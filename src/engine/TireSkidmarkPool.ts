import * as THREE from 'three';

export function computeRearWheelPositions(
  x: number,
  z: number,
  heading: number,
  trackHalfWidth: number,
  rearOffset: number
): { lx: number; lz: number; rx: number; rz: number } {
  const fwdX = Math.sin(heading);
  const fwdZ = Math.cos(heading);
  const rightX = Math.cos(heading);
  const rightZ = -Math.sin(heading);

  const rearX = x - fwdX * rearOffset;
  const rearZ = z - fwdZ * rearOffset;

  return {
    lx: rearX - rightX * trackHalfWidth,
    lz: rearZ - rightZ * trackHalfWidth,
    rx: rearX + rightX * trackHalfWidth,
    rz: rearZ + rightZ * trackHalfWidth,
  };
}

/**
 * Zero-GC pooled ring buffer rendering persistent drift/brake tire skidmarks onto Jakarta asphalt.
 */
export class TireSkidmarkPool {
  private readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly maxMarks: number;
  private writeCursor = 0;
  private activeCount = 0;
  private lastX: number | null = null;
  private lastZ: number | null = null;

  constructor(scene: THREE.Scene, maxMarks: number = 260) {
    this.maxMarks = Math.max(20, maxMarks);
    const geo = new THREE.PlaneGeometry(0.26, 0.88);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x090b10,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, this.maxMarks);
    this.mesh.name = 'TireSkidmarkPool';
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  public stampPair(
    x: number,
    z: number,
    heading: number,
    trackHalfWidth: number,
    rearOffset: number,
    wetnessFactor: number
  ): boolean {
    if (wetnessFactor > 0.82) {
      return false;
    }
    if (this.lastX !== null && this.lastZ !== null) {
      const dx = x - this.lastX;
      const dz = z - this.lastZ;
      if (dx * dx + dz * dz < 0.55 * 0.55) {
        return false;
      }
    }

    const wheels = computeRearWheelPositions(
      x,
      z,
      heading,
      trackHalfWidth,
      rearOffset
    );
    const dummy = this.dummy;

    dummy.position.set(wheels.lx, 0.048, wheels.lz);
    dummy.rotation.set(0, heading, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(this.writeCursor, dummy.matrix);
    this.writeCursor = (this.writeCursor + 1) % this.maxMarks;

    dummy.position.set(wheels.rx, 0.048, wheels.rz);
    dummy.rotation.set(0, heading, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    this.mesh.setMatrixAt(this.writeCursor, dummy.matrix);
    this.writeCursor = (this.writeCursor + 1) % this.maxMarks;

    this.activeCount = Math.min(this.maxMarks, this.activeCount + 2);
    this.mesh.count = this.activeCount;
    this.mesh.instanceMatrix.needsUpdate = true;

    this.lastX = x;
    this.lastZ = z;
    return true;
  }

  public resetTrack(): void {
    this.lastX = null;
    this.lastZ = null;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public dispose(): void {
    this.mesh.parent?.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

import * as THREE from 'three';
import { getGroundElevationAt } from '../game/rules';
import { soundEngine } from '../game/sound';
import { isNearBuilding, isOnRoadway } from '../game/world/spatial';

type PropKind = 'cone' | 'crate' | 'barrier';

interface DestructibleProp {
  kind: PropKind;
  homeX: number;
  homeZ: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  vrx: number;
  vry: number;
  vrz: number;
  knocked: boolean;
  resetTimer: number;
}

export class DestructiblePropsSystem {
  public readonly group = new THREE.Group();

  private readonly props: DestructibleProp[] = [];
  private readonly coneMesh: THREE.InstancedMesh;
  private readonly crateMesh: THREE.InstancedMesh;
  private readonly barrierMesh: THREE.InstancedMesh;

  private readonly coneIndices: number[] = [];
  private readonly crateIndices: number[] = [];
  private readonly barrierIndices: number[] = [];

  private readonly _dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    // 1. Place scatterable Jakarta street cones, wooden crates & Dishub barriers along curbs
    const candidates: { kind: PropKind; x: number; z: number }[] = [];

    for (let z = -70; z <= 70; z += 14) {
      if (Math.abs(z) < 20 || Math.abs(Math.abs(z) - 32) < 6) continue;
      candidates.push({ kind: 'cone', x: -7.1, z });
      candidates.push({ kind: 'cone', x: 7.1, z: z + 4 });
    }
    for (let x = -66; x <= 66; x += 22) {
      if (Math.abs(x) < 20 || Math.abs(Math.abs(x) - 32) < 6) continue;
      candidates.push({ kind: 'barrier', x, z: -7.2 });
      candidates.push({ kind: 'crate', x: x + 3, z: 7.2 });
    }
    // Extra crates near warungs & harbor alleys
    const extra: { kind: PropKind; x: number; z: number }[] = [
      { kind: 'crate', x: -13.5, z: 24 },
      { kind: 'crate', x: -14.2, z: 24.9 },
      { kind: 'crate', x: 13.5, z: 21 },
      { kind: 'barrier', x: -7.2, z: 39 },
      { kind: 'barrier', x: 7.2, z: -39 },
    ];
    candidates.push(...extra);

    for (const c of candidates) {
      if (this.props.length >= 30) break;
      if (isNearBuilding(c.x, c.z, 1.3)) continue;
      if (c.kind === 'crate' && isOnRoadway(c.x, c.z)) continue;
      const gY = getGroundElevationAt(c.x, c.z);
      const idx = this.props.length;
      this.props.push({
        kind: c.kind,
        homeX: c.x,
        homeZ: c.z,
        x: c.x,
        y: gY,
        z: c.z,
        vx: 0,
        vy: 0,
        vz: 0,
        rx: 0,
        ry: (idx * 0.7) % (Math.PI * 2),
        rz: 0,
        vrx: 0,
        vry: 0,
        vrz: 0,
        knocked: false,
        resetTimer: 0,
      });
      if (c.kind === 'cone') this.coneIndices.push(idx);
      else if (c.kind === 'crate') this.crateIndices.push(idx);
      else this.barrierIndices.push(idx);
    }

    // 2. Instanced Geometries & Materials
    const coneGeo = new THREE.ConeGeometry(0.28, 0.72, 10);
    coneGeo.translate(0, 0.36, 0);
    const coneMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xea580c,
      emissiveIntensity: 0.16,
      roughness: 0.48,
    });
    this.coneMesh = new THREE.InstancedMesh(
      coneGeo,
      coneMat,
      Math.max(1, this.coneIndices.length)
    );
    this.coneMesh.castShadow = true;
    this.group.add(this.coneMesh);

    const crateGeo = new THREE.BoxGeometry(0.75, 0.72, 0.75);
    crateGeo.translate(0, 0.36, 0);
    const crateMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      roughness: 0.85,
      metalness: 0.04,
    });
    this.crateMesh = new THREE.InstancedMesh(
      crateGeo,
      crateMat,
      Math.max(1, this.crateIndices.length)
    );
    this.crateMesh.castShadow = true;
    this.group.add(this.crateMesh);

    const barrierGeo = new THREE.BoxGeometry(1.35, 0.65, 0.38);
    barrierGeo.translate(0, 0.325, 0);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.55,
      metalness: 0.12,
    });
    this.barrierMesh = new THREE.InstancedMesh(
      barrierGeo,
      barrierMat,
      Math.max(1, this.barrierIndices.length)
    );
    this.barrierMesh.castShadow = true;
    this.group.add(this.barrierMesh);

    this.syncMatrices();
    scene.add(this.group);
  }

  public applyBlastImpulse(
    blastX: number,
    blastZ: number,
    radius: number,
    camRightX: number,
    camRightZ: number
  ): void {
    for (const prop of this.props) {
      const dx = prop.x - blastX;
      const dz = prop.z - blastZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) {
        const dirX = dx / (dist || 1);
        const dirZ = dz / (dist || 1);
        const force = (1 - dist / radius) * 16 + 6;
        prop.vx += dirX * force;
        prop.vz += dirZ * force;
        prop.vy = Math.max(prop.vy, 5.5 + Math.random() * 4);
        prop.vrx = (Math.random() - 0.5) * 11;
        prop.vry = (Math.random() - 0.5) * 9;
        prop.vrz = (Math.random() - 0.5) * 11;
        prop.knocked = true;
        prop.resetTimer = 14;
        const pan = THREE.MathUtils.clamp(dx * camRightX + dz * camRightZ, -1, 1);
        soundEngine.playPropCrash(pan);
      }
    }
  }

  public step(
    dt: number,
    playerX: number,
    playerZ: number,
    vehicleSpeed: number,
    vehicleRadius: number,
    isDriving: boolean,
    camRightX: number,
    camRightZ: number
  ): void {
    let dirty = false;

    for (const prop of this.props) {
      // Check vehicle collision impact
      if (isDriving && Math.abs(vehicleSpeed) > 2.2) {
        const dx = prop.x - playerX;
        const dz = prop.z - playerZ;
        const dist = Math.hypot(dx, dz);
        if (dist < vehicleRadius + 0.65 && prop.y < 2.2) {
          const pushScale = Math.min(22, Math.abs(vehicleSpeed) * 0.85 + 5);
          const nx = dx / (dist || 1);
          const nz = dz / (dist || 1);
          prop.vx = nx * pushScale + (Math.random() - 0.5) * 3;
          prop.vz = nz * pushScale + (Math.random() - 0.5) * 3;
          prop.vy = 4.2 + Math.min(5, Math.abs(vehicleSpeed) * 0.25);
          prop.vrx = (Math.random() - 0.5) * 12;
          prop.vry = (Math.random() - 0.5) * 10;
          prop.vrz = (Math.random() - 0.5) * 12;
          prop.knocked = true;
          prop.resetTimer = 15;
          dirty = true;
          const pan = THREE.MathUtils.clamp((dx * camRightX + dz * camRightZ) * 0.15, -1, 1);
          soundEngine.playPropCrash(pan);
        }
      }

      if (prop.knocked) {
        prop.resetTimer -= dt;
        const floorY = getGroundElevationAt(prop.x, prop.z);
        if (
          prop.y > floorY + 0.01 ||
          Math.abs(prop.vx) > 0.15 ||
          Math.abs(prop.vz) > 0.15 ||
          Math.abs(prop.vy) > 0.15
        ) {
          prop.x += prop.vx * dt;
          prop.z += prop.vz * dt;
          prop.y += prop.vy * dt;
          prop.vy -= 20 * dt;
          prop.rx += prop.vrx * dt;
          prop.ry += prop.vry * dt;
          prop.rz += prop.vrz * dt;

          const newFloor = getGroundElevationAt(prop.x, prop.z);
          if (prop.y <= newFloor) {
            prop.y = newFloor;
            prop.vy = Math.abs(prop.vy) > 2.4 ? -prop.vy * 0.35 : 0;
            prop.vx *= 0.62;
            prop.vz *= 0.62;
            prop.vrx *= 0.5;
            prop.vrz *= 0.5;
            prop.rx = Math.PI * 0.45;
          }
          dirty = true;
        }

        if (
          prop.resetTimer <= 0 &&
          Math.hypot(prop.homeX - playerX, prop.homeZ - playerZ) > 22
        ) {
          prop.x = prop.homeX;
          prop.z = prop.homeZ;
          prop.y = getGroundElevationAt(prop.homeX, prop.homeZ);
          prop.vx = 0;
          prop.vy = 0;
          prop.vz = 0;
          prop.rx = 0;
          prop.rz = 0;
          prop.knocked = false;
          dirty = true;
        }
      }
    }

    if (dirty) {
      this.syncMatrices();
    }
  }

  private syncMatrices(): void {
    const dummy = this._dummy;
    this.coneIndices.forEach((pIdx, i) => {
      const p = this.props[pIdx];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.updateMatrix();
      this.coneMesh.setMatrixAt(i, dummy.matrix);
    });
    this.coneMesh.instanceMatrix.needsUpdate = true;

    this.crateIndices.forEach((pIdx, i) => {
      const p = this.props[pIdx];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.updateMatrix();
      this.crateMesh.setMatrixAt(i, dummy.matrix);
    });
    this.crateMesh.instanceMatrix.needsUpdate = true;

    this.barrierIndices.forEach((pIdx, i) => {
      const p = this.props[pIdx];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.updateMatrix();
      this.barrierMesh.setMatrixAt(i, dummy.matrix);
    });
    this.barrierMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.coneMesh.geometry.dispose();
    (this.coneMesh.material as THREE.Material).dispose();
    this.crateMesh.geometry.dispose();
    (this.crateMesh.material as THREE.Material).dispose();
    this.barrierMesh.geometry.dispose();
    (this.barrierMesh.material as THREE.Material).dispose();
  }
}

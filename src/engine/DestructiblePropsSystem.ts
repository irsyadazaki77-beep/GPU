import * as THREE from 'three';
import { getGroundElevationAt } from '../game/rules';
import { soundEngine } from '../game/sound';
import { isNearBuilding, isOnRoadway } from '../game/world/spatial';

type PropKind = 'cone' | 'crate' | 'barrier' | 'barrel';

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
  detonated: boolean;
  resetTimer: number;
}

export class DestructiblePropsSystem {
  public readonly group = new THREE.Group();

  private readonly props: DestructibleProp[] = [];
  private readonly coneMesh: THREE.InstancedMesh;
  private readonly crateMesh: THREE.InstancedMesh;
  private readonly barrierMesh: THREE.InstancedMesh;
  private readonly barrelMesh: THREE.InstancedMesh;

  private readonly coneIndices: number[] = [];
  private readonly crateIndices: number[] = [];
  private readonly barrierIndices: number[] = [];
  private readonly barrelIndices: number[] = [];

  private readonly _dummy = new THREE.Object3D();

  constructor(scene: THREE.Scene) {
    // 1. Place scatterable Jakarta street cones, wooden crates, Dishub barriers & explosive fuel barrels
    // strictly along sidewalk perimeters, pedestrian plazas & alleys (100% off active roadways)
    const candidates: { kind: PropKind; x: number; z: number }[] = [];

    for (let z = -70; z <= 70; z += 14) {
      if (Math.abs(z) < 20 || Math.abs(Math.abs(z) - 32) < 6) continue;
      candidates.push({ kind: 'cone', x: -10.5, z });
      candidates.push({ kind: 'cone', x: 10.5, z: z + 4 });
    }
    for (let x = -66; x <= 66; x += 22) {
      if (Math.abs(x) < 20 || Math.abs(Math.abs(x) - 32) < 6) continue;
      candidates.push({ kind: 'barrier', x, z: -10.5 });
      candidates.push({ kind: 'crate', x: x + 3, z: 10.5 });
    }
    // Extra crates & explosive red fuel barrels near warungs, Gang Blok M & Tanjung Priok harbor
    const extra: { kind: PropKind; x: number; z: number }[] = [
      { kind: 'crate', x: -13.5, z: 24 },
      { kind: 'crate', x: -14.2, z: 24.9 },
      { kind: 'crate', x: 13.5, z: 21 },
      { kind: 'barrier', x: -11.5, z: 39 },
      { kind: 'barrier', x: 11.5, z: -39 },
      { kind: 'barrel', x: -16.5, z: 18 },
      { kind: 'barrel', x: 16.5, z: -18 },
      { kind: 'barrel', x: -34.5, z: 10 },
      { kind: 'barrel', x: 43.0, z: -64 },
      { kind: 'barrel', x: -24.5, z: -66 },
      { kind: 'barrel', x: 35.0, z: 28 },
      { kind: 'barrel', x: -18.5, z: -50 },
      { kind: 'barrel', x: 18.5, z: 50 },
    ];
    candidates.push(...extra);

    for (const c of candidates) {
      if (c.kind !== 'barrel' && this.props.length >= 30) continue;
      if (isNearBuilding(c.x, c.z, 1.3)) continue;
      if (isOnRoadway(c.x, c.z)) continue;
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
        detonated: false,
        resetTimer: 0,
      });
      if (c.kind === 'cone') this.coneIndices.push(idx);
      else if (c.kind === 'crate') this.crateIndices.push(idx);
      else if (c.kind === 'barrier') this.barrierIndices.push(idx);
      else this.barrelIndices.push(idx);
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

    const barrelGeo = new THREE.CylinderGeometry(0.42, 0.44, 1.08, 12);
    barrelGeo.translate(0, 0.54, 0);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0x991b1b,
      emissiveIntensity: 0.38,
      roughness: 0.36,
      metalness: 0.48,
    });
    this.barrelMesh = new THREE.InstancedMesh(
      barrelGeo,
      barrelMat,
      Math.max(1, this.barrelIndices.length)
    );
    this.barrelMesh.castShadow = true;
    this.group.add(this.barrelMesh);

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

  public checkBarrelLineHit(
    originX: number,
    originZ: number,
    dirX: number,
    dirZ: number,
    maxRange: number
  ): { x: number; y: number; z: number } | null {
    for (const pIdx of this.barrelIndices) {
      const prop = this.props[pIdx];
      if (prop.detonated) continue;
      const dx = prop.x - originX;
      const dz = prop.z - originZ;
      const dist = Math.hypot(dx, dz);
      if (dist > maxRange || dist < 0.8) continue;
      const dot = (dx / dist) * dirX + (dz / dist) * dirZ;
      if (dot >= 0.9 || dist < 2.2) {
        prop.detonated = true;
        prop.knocked = true;
        prop.resetTimer = 25;
        this.applyBlastImpulse(prop.x, prop.z, 10, -dirZ, dirX);
        this.syncMatrices();
        return { x: prop.x, y: prop.y, z: prop.z };
      }
    }
    return null;
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
  ): { triggeredBlasts: { x: number; y: number; z: number }[] } {
    let dirty = false;
    const triggeredBlasts: { x: number; y: number; z: number }[] = [];

    for (const prop of this.props) {
      // Check vehicle collision impact
      if (!prop.detonated && isDriving && Math.abs(vehicleSpeed) > 2.2) {
        const dx = prop.x - playerX;
        const dz = prop.z - playerZ;
        const dist = Math.hypot(dx, dz);
        if (dist < vehicleRadius + 0.72 && prop.y < 2.2) {
          if (prop.kind === 'barrel') {
            prop.detonated = true;
            prop.knocked = true;
            prop.resetTimer = 25;
            triggeredBlasts.push({ x: prop.x, y: prop.y, z: prop.z });
            dirty = true;
          } else {
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
      }

      if (prop.knocked) {
        prop.resetTimer -= dt;
        const floorY = getGroundElevationAt(prop.x, prop.z);
        if (
          !prop.detonated &&
          (prop.y > floorY + 0.01 ||
            Math.abs(prop.vx) > 0.15 ||
            Math.abs(prop.vz) > 0.15 ||
            Math.abs(prop.vy) > 0.15)
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
          prop.detonated = false;
          dirty = true;
        }
      }
    }

    if (dirty) {
      this.syncMatrices();
    }
    return { triggeredBlasts };
  }

  private syncMatrices(): void {
    const dummy = this._dummy;
    this.coneIndices.forEach((pIdx, i) => {
      const p = this.props[pIdx];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.coneMesh.setMatrixAt(i, dummy.matrix);
    });
    this.coneMesh.instanceMatrix.needsUpdate = true;

    this.crateIndices.forEach((pIdx, i) => {
      const p = this.props[pIdx];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.crateMesh.setMatrixAt(i, dummy.matrix);
    });
    this.crateMesh.instanceMatrix.needsUpdate = true;

    this.barrierIndices.forEach((pIdx, i) => {
      const p = this.props[pIdx];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.barrierMesh.setMatrixAt(i, dummy.matrix);
    });
    this.barrierMesh.instanceMatrix.needsUpdate = true;

    this.barrelIndices.forEach((pIdx, i) => {
      const p = this.props[pIdx];
      dummy.position.set(p.x, p.detonated ? -40 : p.y, p.z);
      dummy.rotation.set(p.rx, p.ry, p.rz);
      dummy.scale.setScalar(p.detonated ? 0.001 : 1);
      dummy.updateMatrix();
      this.barrelMesh.setMatrixAt(i, dummy.matrix);
    });
    this.barrelMesh.instanceMatrix.needsUpdate = true;
  }

  public dispose(): void {
    this.coneMesh.geometry.dispose();
    (this.coneMesh.material as THREE.Material).dispose();
    this.crateMesh.geometry.dispose();
    (this.crateMesh.material as THREE.Material).dispose();
    this.barrierMesh.geometry.dispose();
    (this.barrierMesh.material as THREE.Material).dispose();
    this.barrelMesh.geometry.dispose();
    (this.barrelMesh.material as THREE.Material).dispose();
  }
}

import * as THREE from 'three';
import {
  BuildingFootprint,
  MAIN_BOULEVARD_SIDEWALK_SLABS,
  SpatialHashGrid,
  TrafficSignalPhase,
  resolveCircleAABBCollision,
  stepSidewalkPatrol,
} from '../game/rules';
import type { SidewalkRect } from '../game/world/textures';

interface PedestrianAgent {
  x: number;
  z: number;
  axis: 'ns' | 'ew';
  dir: 1 | -1;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  speed: number;
  phase: number;
  panicTimer: number;
  panicVx: number;
  panicVz: number;
  torsoColor: number;
}

const MAX_PEDESTRIANS = 44;

const BATIK_SHIRT_COLORS = [
  0xe11d48, // merah marun
  0x0284c7, // biru muda kantoran
  0x16a34a, // jaket ojol
  0xf59e0b, // kuning kunyit
  0xf8fafc, // kemeja putih
  0x9333ea, // ungu batik
  0x0d9488, // teal
];

export class CrowdSystem {
  public readonly group = new THREE.Group();

  private readonly agents: PedestrianAgent[] = [];
  private readonly buildingGrid?: SpatialHashGrid<BuildingFootprint>;
  private readonly torsoMesh: THREE.InstancedMesh;
  private readonly headMesh: THREE.InstancedMesh;
  private readonly leftLegMesh: THREE.InstancedMesh;
  private readonly rightLegMesh: THREE.InstancedMesh;
  private readonly umbrellaMesh: THREE.InstancedMesh;

  private readonly _dummy = new THREE.Object3D();
  private readonly _color = new THREE.Color();

  constructor(
    scene: THREE.Scene,
    sidewalkRects: SidewalkRect[],
    buildingGrid?: SpatialHashGrid<BuildingFootprint>
  ) {
    this.buildingGrid = buildingGrid;
    const poolRects: SidewalkRect[] =
      sidewalkRects.length > 0 ? sidewalkRects : MAIN_BOULEVARD_SIDEWALK_SLABS;

    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      const rect = poolRects[i % poolRects.length];
      const spanX = rect.maxX - rect.minX;
      const spanZ = rect.maxZ - rect.minZ;
      const axis: 'ns' | 'ew' = spanZ >= spanX ? 'ns' : 'ew';

      const padX = Math.min(0.55, spanX * 0.25);
      const padZ = Math.min(0.55, spanZ * 0.25);
      const fracA = ((i * 37) % 11) / 10;
      const fracB = ((i * 53) % 7) / 6;

      const sx =
        rect.minX + padX + Math.max(0, spanX - padX * 2) * (axis === 'ns' ? fracB : fracA);
      const sz =
        rect.minZ + padZ + Math.max(0, spanZ - padZ * 2) * (axis === 'ns' ? fracA : fracB);

      this.agents.push({
        x: sx,
        z: sz,
        axis,
        dir: i % 2 === 0 ? 1 : -1,
        minX: rect.minX,
        maxX: rect.maxX,
        minZ: rect.minZ,
        maxZ: rect.maxZ,
        speed: 1.45 + (i % 5) * 0.18,
        phase: i * 0.85,
        panicTimer: 0,
        panicVx: 0,
        panicVz: 0,
        torsoColor: BATIK_SHIRT_COLORS[i % BATIK_SHIRT_COLORS.length],
      });
    }

    const torsoGeo = new THREE.BoxGeometry(0.42, 0.58, 0.24);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.76,
    });
    this.torsoMesh = new THREE.InstancedMesh(torsoGeo, torsoMat, MAX_PEDESTRIANS);
    this.torsoMesh.castShadow = true;
    this.group.add(this.torsoMesh);

    const headGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xd99b66,
      roughness: 0.65,
    });
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, MAX_PEDESTRIANS);
    this.group.add(this.headMesh);

    const legGeo = new THREE.BoxGeometry(0.15, 0.52, 0.16);
    legGeo.translate(0, -0.26, 0);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
    });
    this.leftLegMesh = new THREE.InstancedMesh(legGeo, legMat, MAX_PEDESTRIANS);
    this.rightLegMesh = new THREE.InstancedMesh(legGeo, legMat, MAX_PEDESTRIANS);
    this.group.add(this.leftLegMesh, this.rightLegMesh);

    const umbrellaGeo = new THREE.ConeGeometry(0.62, 0.22, 8);
    const umbrellaMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.45,
      metalness: 0.1,
    });
    this.umbrellaMesh = new THREE.InstancedMesh(
      umbrellaGeo,
      umbrellaMat,
      MAX_PEDESTRIANS
    );
    this.umbrellaMesh.visible = false;
    this.group.add(this.umbrellaMesh);

    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      this._color.setHex(this.agents[i].torsoColor);
      this.torsoMesh.setColorAt(i, this._color);
      this._color.setHex(i % 3 === 0 ? 0xf59e0b : i % 3 === 1 ? 0x38bdf8 : 0xef4444);
      this.umbrellaMesh.setColorAt(i, this._color);
    }
    if (this.torsoMesh.instanceColor) {
      this.torsoMesh.instanceColor.needsUpdate = true;
    }
    if (this.umbrellaMesh.instanceColor) {
      this.umbrellaMesh.instanceColor.needsUpdate = true;
    }

    scene.add(this.group);
  }

  public triggerPanicNear(worldX: number, worldZ: number, radius: number = 22): void {
    for (const ag of this.agents) {
      const dx = ag.x - worldX;
      const dz = ag.z - worldZ;
      const dist = Math.hypot(dx, dz);
      if (dist < radius) {
        const inv = 1 / (dist || 1);
        ag.panicTimer = 4.2;
        ag.panicVx = dx * inv * 4.4;
        ag.panicVz = dz * inv * 4.4;
      }
    }
  }

  public step(
    dt: number,
    crowdRatio: number,
    wetnessFactor: number,
    signalPhase: TrafficSignalPhase,
    wantedLevel: number,
    playerX: number,
    playerZ: number
  ): void {
    const activeCount = Math.max(
      10,
      Math.min(MAX_PEDESTRIANS, Math.round(MAX_PEDESTRIANS * crowdRatio))
    );
    const showUmbrellas = wetnessFactor > 0.38;
    this.umbrellaMesh.visible = showUmbrellas;

    this.torsoMesh.count = activeCount;
    this.headMesh.count = activeCount;
    this.leftLegMesh.count = activeCount;
    this.rightLegMesh.count = activeCount;
    this.umbrellaMesh.count = showUmbrellas ? activeCount : 0;

    const dummy = this._dummy;

    for (let i = 0; i < activeCount; i++) {
      const ag = this.agents[i];

      if (wantedLevel >= 2) {
        const dP = Math.hypot(ag.x - playerX, ag.z - playerZ);
        if (dP < 14 && ag.panicTimer <= 0) {
          ag.panicTimer = 3.0;
          ag.panicVx = ((ag.x - playerX) / (dP || 1)) * 4.2;
          ag.panicVz = ((ag.z - playerZ) / (dP || 1)) * 4.2;
        }
      }

      let facing = 0;
      let moving = true;

      if (ag.panicTimer > 0) {
        ag.panicTimer -= dt;
        const col = resolveCircleAABBCollision(
          ag.x + ag.panicVx * dt,
          ag.z + ag.panicVz * dt,
          0.4,
          undefined,
          this.buildingGrid
        );
        ag.x = col.x;
        ag.z = col.z;
        facing = Math.atan2(ag.panicVx, ag.panicVz);
        ag.phase += dt * 11.5;
      } else {
        // Pause politely near curb intersections when avenue light is green for cars
        const nearCurbEnd =
          ag.axis === 'ns'
            ? ag.z - ag.minZ < 1.2 || ag.maxZ - ag.z < 1.2
            : ag.x - ag.minX < 1.2 || ag.maxX - ag.x < 1.2;
        const waitForLight =
          nearCurbEnd &&
          ((ag.axis === 'ns' && signalPhase === 'ns_green') ||
            (ag.axis === 'ew' && signalPhase === 'ew_green'));

        if (waitForLight) {
          moving = false;
          facing =
            ag.axis === 'ns'
              ? ag.dir > 0
                ? 0
                : Math.PI
              : ag.dir > 0
                ? Math.PI / 2
                : -Math.PI / 2;
        } else {
          const next = stepSidewalkPatrol(
            ag.x,
            ag.z,
            ag.dir,
            ag.speed,
            dt,
            ag.minX,
            ag.maxX,
            ag.minZ,
            ag.maxZ,
            ag.axis,
            0.5
          );
          ag.x = next.x;
          ag.z = next.z;
          ag.dir = next.dir;
          facing =
            ag.axis === 'ns'
              ? ag.dir > 0
                ? 0
                : Math.PI
              : ag.dir > 0
                ? Math.PI / 2
                : -Math.PI / 2;
          ag.phase += dt * 5.2;
        }
      }

      const swing = moving ? Math.sin(ag.phase) * 0.45 : 0;
      const baseY = 0.14;

      // Torso
      dummy.position.set(ag.x, baseY + 0.88, ag.z);
      dummy.rotation.set(0, facing, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.torsoMesh.setMatrixAt(i, dummy.matrix);

      // Head
      dummy.position.set(ag.x, baseY + 1.38, ag.z);
      dummy.rotation.set(0, facing, 0);
      dummy.updateMatrix();
      this.headMesh.setMatrixAt(i, dummy.matrix);

      // Legs
      const cosF = Math.cos(facing);
      const sinF = Math.sin(facing);
      dummy.position.set(ag.x - cosF * 0.11, baseY + 0.58, ag.z + sinF * 0.11);
      dummy.rotation.set(swing, facing, 0);
      dummy.updateMatrix();
      this.leftLegMesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(ag.x + cosF * 0.11, baseY + 0.58, ag.z - sinF * 0.11);
      dummy.rotation.set(-swing, facing, 0);
      dummy.updateMatrix();
      this.rightLegMesh.setMatrixAt(i, dummy.matrix);

      if (showUmbrellas) {
        dummy.position.set(ag.x, baseY + 1.82, ag.z);
        dummy.rotation.set(0, facing, 0);
        dummy.updateMatrix();
        this.umbrellaMesh.setMatrixAt(i, dummy.matrix);
      }
    }

    this.torsoMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.leftLegMesh.instanceMatrix.needsUpdate = true;
    this.rightLegMesh.instanceMatrix.needsUpdate = true;
    if (showUmbrellas) {
      this.umbrellaMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public dispose(): void {
    this.torsoMesh.geometry.dispose();
    (this.torsoMesh.material as THREE.Material).dispose();
    this.headMesh.geometry.dispose();
    (this.headMesh.material as THREE.Material).dispose();
    this.leftLegMesh.geometry.dispose();
    (this.leftLegMesh.material as THREE.Material).dispose();
    this.rightLegMesh.geometry.dispose();
    this.umbrellaMesh.geometry.dispose();
    (this.umbrellaMesh.material as THREE.Material).dispose();
  }
}

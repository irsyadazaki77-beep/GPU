import * as THREE from 'three';
import {
  BuildingFootprint,
  MAIN_BOULEVARD_SIDEWALK_SLABS,
  SpatialHashGrid,
  TrafficSignalPhase,
} from '../game/rules';
import type { SidewalkRect } from '../game/world/textures';
import {
  PedestrianAiAgent,
  stepPedestrianAgentInPlace,
  triggerCrowdFleeImpulse,
  triggerCrowdSocialFilming,
} from './crowdAi';

const MAX_PEDESTRIANS = 52;

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

  private readonly agents: PedestrianAiAgent[] = [];
  private readonly buildingGrid?: SpatialHashGrid<BuildingFootprint>;
  private readonly torsoMesh: THREE.InstancedMesh;
  private readonly headMesh: THREE.InstancedMesh;
  private readonly leftLegMesh: THREE.InstancedMesh;
  private readonly rightLegMesh: THREE.InstancedMesh;
  private readonly umbrellaMesh: THREE.InstancedMesh;
  private readonly phoneMesh: THREE.InstancedMesh;

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
        rect.minX +
        padX +
        Math.max(0, spanX - padX * 2) * (axis === 'ns' ? fracB : fracA);
      const sz =
        rect.minZ +
        padZ +
        Math.max(0, spanZ - padZ * 2) * (axis === 'ns' ? fracA : fracB);

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
        state: 'WALKING',
        panicTimer: 0,
        panicVx: 0,
        panicVz: 0,
        crowdTimer: 0,
        crowdAnchorX: sx,
        crowdAnchorZ: sz,
        filmTimer: 0,
        torsoColor: BATIK_SHIRT_COLORS[i % BATIK_SHIRT_COLORS.length],
      });
    }

    const torsoGeo = new THREE.BoxGeometry(0.42, 0.58, 0.24);
    const torsoMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.76,
    });
    this.torsoMesh = new THREE.InstancedMesh(
      torsoGeo,
      torsoMat,
      MAX_PEDESTRIANS
    );
    this.torsoMesh.castShadow = true;
    this.torsoMesh.frustumCulled = false;
    this.group.add(this.torsoMesh);

    const headGeo = new THREE.SphereGeometry(0.16, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xd99b66,
      roughness: 0.65,
    });
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, MAX_PEDESTRIANS);
    this.headMesh.frustumCulled = false;
    this.group.add(this.headMesh);

    const legGeo = new THREE.BoxGeometry(0.15, 0.52, 0.16);
    legGeo.translate(0, -0.26, 0);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.85,
    });
    this.leftLegMesh = new THREE.InstancedMesh(legGeo, legMat, MAX_PEDESTRIANS);
    this.rightLegMesh = new THREE.InstancedMesh(
      legGeo,
      legMat,
      MAX_PEDESTRIANS
    );
    this.leftLegMesh.frustumCulled = false;
    this.rightLegMesh.frustumCulled = false;
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
    this.umbrellaMesh.frustumCulled = false;
    this.group.add(this.umbrellaMesh);

    // Glowing smartphone screens raised by NPCs filming viral events
    const phoneGeo = new THREE.BoxGeometry(0.14, 0.24, 0.04);
    const phoneMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    this.phoneMesh = new THREE.InstancedMesh(phoneGeo, phoneMat, MAX_PEDESTRIANS);
    this.phoneMesh.frustumCulled = false;
    this.phoneMesh.count = 0;
    this.group.add(this.phoneMesh);

    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      this._color.setHex(this.agents[i].torsoColor);
      this.torsoMesh.setColorAt(i, this._color);
      this._color.setHex(
        i % 3 === 0 ? 0xf59e0b : i % 3 === 1 ? 0x38bdf8 : 0xef4444
      );
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

  public triggerPanicNear(
    worldX: number,
    worldZ: number,
    radius: number = 22
  ): void {
    triggerCrowdFleeImpulse(this.agents, worldX, worldZ, radius, 4.2);
  }

  public triggerSocialFilmingNear(
    worldX: number,
    worldZ: number,
    maxRadius: number = 26
  ): number {
    return triggerCrowdSocialFilming(this.agents, worldX, worldZ, 6.5, maxRadius, 5.5);
  }

  public getAgents(): readonly PedestrianAiAgent[] {
    return this.agents;
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
      12,
      Math.min(MAX_PEDESTRIANS, Math.round(MAX_PEDESTRIANS * crowdRatio))
    );
    const showUmbrellas = wetnessFactor > 0.65;
    this.umbrellaMesh.visible = showUmbrellas;

    this.torsoMesh.count = activeCount;
    this.headMesh.count = activeCount;
    this.leftLegMesh.count = activeCount;
    this.rightLegMesh.count = activeCount;
    this.umbrellaMesh.count = showUmbrellas ? activeCount : 0;

    const dummy = this._dummy;
    const stepCtx = {
      dt,
      signalPhase,
      wantedLevel,
      playerX,
      playerZ,
      buildingGrid: this.buildingGrid,
    };

    let filmingPhoneCount = 0;

    for (let i = 0; i < activeCount; i++) {
      const ag = this.agents[i];
      const { facing, moving, state } = stepPedestrianAgentInPlace(ag, stepCtx);

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

      if (state === 'FILMING' && filmingPhoneCount < MAX_PEDESTRIANS) {
        dummy.position.set(
          ag.x + sinF * 0.42,
          baseY + 1.34,
          ag.z + cosF * 0.42
        );
        dummy.rotation.set(-0.15, facing, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        this.phoneMesh.setMatrixAt(filmingPhoneCount++, dummy.matrix);
      }
    }

    this.phoneMesh.count = filmingPhoneCount;
    this.phoneMesh.visible = filmingPhoneCount > 0;

    this.torsoMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.leftLegMesh.instanceMatrix.needsUpdate = true;
    this.rightLegMesh.instanceMatrix.needsUpdate = true;
    if (showUmbrellas) {
      this.umbrellaMesh.instanceMatrix.needsUpdate = true;
    }
    if (filmingPhoneCount > 0) {
      this.phoneMesh.instanceMatrix.needsUpdate = true;
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
    this.phoneMesh.geometry.dispose();
    (this.phoneMesh.material as THREE.Material).dispose();
  }
}

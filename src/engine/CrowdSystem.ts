import * as THREE from 'three';
import {
  BuildingFootprint,
  MAIN_BOULEVARD_SIDEWALK_SLABS,
  SpatialHashGrid,
  TrafficSignalPhase,
} from '../game/rules';
import type { SidewalkRect } from '../game/world/textures';
import { proceduralTextures } from './ProceduralTextures';
import {
  PedestrianAiAgent,
  PedestrianArchetype,
  recycleDistantPedestrianInPlace,
  stepPedestrianAgentInPlace,
  stepPedestrianInteractions,
  triggerCrowdCheerNear,
  triggerCrowdFleeImpulse,
  triggerCrowdSocialFilming,
} from './crowdAi';

const MAX_PEDESTRIANS = 96;

const BATIK_SHIRT_COLORS = [
  0xe11d48, // merah marun
  0x0284c7, // biru muda kantoran
  0x16a34a, // jaket ojol
  0xf59e0b, // kuning kunyit
  0xf8fafc, // kemeja putih
  0x9333ea, // ungu batik
  0x0d9488, // teal
];

const ARCHETYPES: PedestrianArchetype[] = [
  'komuter',
  'ojol_driver',
  'jogger',
  'anak_scbd',
  'pedagang',
  'satpam',
  'komuter',
  'anak_scbd',
];

function resolveArchetypeShirtColor(
  arch: PedestrianArchetype,
  index: number
): number {
  if (arch === 'ojol_driver') return 0x16a34a;
  if (arch === 'satpam') return 0x1e3a8a;
  if (arch === 'pedagang') return index % 2 === 0 ? 0xf59e0b : 0xe11d48;
  if (arch === 'jogger') return index % 2 === 0 ? 0x0ea5e9 : 0xf43f5e;
  if (arch === 'anak_scbd') return index % 2 === 0 ? 0xf8fafc : 0x9333ea;
  return BATIK_SHIRT_COLORS[index % BATIK_SHIRT_COLORS.length];
}

const SKIN_TONES = [0xd99b66, 0xc68652, 0xe3ae7e, 0xad6f42];
const TROUSER_COLORS = [0x1e293b, 0x1d3557, 0x3f3f46, 0x574c3f];

function resolveHatColor(arch: PedestrianArchetype, index: number): number {
  if (arch === 'ojol_driver') return 0x15803d;
  if (arch === 'satpam') return 0x172554;
  if (arch === 'pedagang') return 0xd97706;
  return index % 3 === 0 ? 0x27201c : 0x18181b;
}

export class CrowdSystem {
  public readonly group = new THREE.Group();

  private readonly agents: PedestrianAiAgent[] = [];
  private readonly poolRects: SidewalkRect[];
  private readonly buildingGrid?: SpatialHashGrid<BuildingFootprint>;
  private readonly torsoMesh: THREE.InstancedMesh;
  private readonly headMesh: THREE.InstancedMesh;
  private readonly armMesh: THREE.InstancedMesh;
  private readonly hatHelmetMesh: THREE.InstancedMesh;
  private readonly leftLegMesh: THREE.InstancedMesh;
  private readonly rightLegMesh: THREE.InstancedMesh;
  private readonly umbrellaMesh: THREE.InstancedMesh;
  private readonly phoneMesh: THREE.InstancedMesh;
  private readonly shadowMesh: THREE.InstancedMesh;

  private readonly _dummy = new THREE.Object3D();
  private readonly _color = new THREE.Color();
  private interactionTimer = 0;
  private recycleCursor = 0;

  constructor(
    scene: THREE.Scene,
    sidewalkRects: SidewalkRect[],
    buildingGrid?: SpatialHashGrid<BuildingFootprint>
  ) {
    this.buildingGrid = buildingGrid;
    const extraOuter = MAIN_BOULEVARD_SIDEWALK_SLABS.slice(16);
    this.poolRects =
      sidewalkRects.length > 0
        ? [...sidewalkRects, ...extraOuter]
        : MAIN_BOULEVARD_SIDEWALK_SLABS;

    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      const rect = this.poolRects[i % this.poolRects.length];
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

      const arch = ARCHETYPES[i % ARCHETYPES.length];
      this.agents.push({
        x: sx,
        z: sz,
        axis,
        dir: i % 2 === 0 ? 1 : -1,
        minX: rect.minX,
        maxX: rect.maxX,
        minZ: rect.minZ,
        maxZ: rect.maxZ,
        speed: arch === 'jogger' ? 2.25 + (i % 3) * 0.2 : 1.45 + (i % 5) * 0.18,
        phase: i * 0.85,
        state: arch === 'jogger' ? 'JOGGING' : 'WALKING',
        archetype: arch,
        panicTimer: 0,
        panicVx: 0,
        panicVz: 0,
        crowdTimer: 0,
        crowdAnchorX: sx,
        crowdAnchorZ: sz,
        filmTimer: 0,
        torsoColor: resolveArchetypeShirtColor(arch, i),
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
      color: 0xffffff,
      roughness: 0.65,
    });
    this.headMesh = new THREE.InstancedMesh(headGeo, headMat, MAX_PEDESTRIANS);
    this.headMesh.frustumCulled = false;
    this.group.add(this.headMesh);

    const armGeo = new THREE.BoxGeometry(0.11, 0.44, 0.11);
    armGeo.translate(0, -0.18, 0);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.76,
    });
    this.armMesh = new THREE.InstancedMesh(armGeo, armMat, MAX_PEDESTRIANS * 2);
    this.armMesh.frustumCulled = false;
    this.group.add(this.armMesh);

    const hatGeo = new THREE.SphereGeometry(
      0.185,
      8,
      6,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.56
    );
    const hatMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.45,
      metalness: 0.15,
    });
    this.hatHelmetMesh = new THREE.InstancedMesh(hatGeo, hatMat, MAX_PEDESTRIANS);
    this.hatHelmetMesh.frustumCulled = false;
    this.group.add(this.hatHelmetMesh);

    const legGeo = new THREE.BoxGeometry(0.15, 0.52, 0.16);
    legGeo.translate(0, -0.26, 0);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
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

    const shadowGeo = new THREE.PlaneGeometry(0.95, 0.95);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: proceduralTextures.getContactShadowTexture(),
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.shadowMesh = new THREE.InstancedMesh(
      shadowGeo,
      shadowMat,
      MAX_PEDESTRIANS
    );
    this.shadowMesh.frustumCulled = false;
    this.group.add(this.shadowMesh);

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

    // Glowing smartphone screens raised by NPCs filming viral events or browsing
    const phoneGeo = new THREE.BoxGeometry(0.14, 0.24, 0.04);
    const phoneMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    this.phoneMesh = new THREE.InstancedMesh(phoneGeo, phoneMat, MAX_PEDESTRIANS);
    this.phoneMesh.frustumCulled = false;
    this.phoneMesh.count = 0;
    this.group.add(this.phoneMesh);

    for (let i = 0; i < MAX_PEDESTRIANS; i++) {
      const arch = this.agents[i].archetype ?? 'komuter';
      this._color.setHex(this.agents[i].torsoColor);
      this.torsoMesh.setColorAt(i, this._color);
      this.armMesh.setColorAt(i * 2, this._color);
      this.armMesh.setColorAt(i * 2 + 1, this._color);
      this.headMesh.setColorAt(
        i,
        this._color.setHex(SKIN_TONES[i % SKIN_TONES.length])
      );
      const trouserColor = this._color.setHex(
        TROUSER_COLORS[i % TROUSER_COLORS.length]
      );
      this.leftLegMesh.setColorAt(i, trouserColor);
      this.rightLegMesh.setColorAt(i, trouserColor);
      this.umbrellaMesh.setColorAt(
        i,
        this._color.setHex(
          i % 3 === 0 ? 0xf59e0b : i % 3 === 1 ? 0x38bdf8 : 0xef4444
        )
      );
      this.hatHelmetMesh.setColorAt(
        i,
        this._color.setHex(resolveHatColor(arch, i))
      );
    }
    if (this.torsoMesh.instanceColor) {
      this.torsoMesh.instanceColor.needsUpdate = true;
    }
    if (this.headMesh.instanceColor) {
      this.headMesh.instanceColor.needsUpdate = true;
    }
    if (this.leftLegMesh.instanceColor) {
      this.leftLegMesh.instanceColor.needsUpdate = true;
    }
    if (this.rightLegMesh.instanceColor) {
      this.rightLegMesh.instanceColor.needsUpdate = true;
    }
    if (this.armMesh.instanceColor) {
      this.armMesh.instanceColor.needsUpdate = true;
    }
    if (this.umbrellaMesh.instanceColor) {
      this.umbrellaMesh.instanceColor.needsUpdate = true;
    }
    if (this.hatHelmetMesh.instanceColor) {
      this.hatHelmetMesh.instanceColor.needsUpdate = true;
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

  public triggerCheerNear(
    worldX: number,
    worldZ: number,
    radius: number = 22
  ): number {
    return triggerCrowdCheerNear(this.agents, worldX, worldZ, radius, 3.8);
  }

  public hasPedestrianNear(
    worldX: number,
    worldZ: number,
    radius: number = 14
  ): boolean {
    const rSq = radius * radius;
    for (let i = 0; i < this.agents.length; i++) {
      const ag = this.agents[i];
      if (ag.panicTimer > 0) continue;
      const dx = ag.x - worldX;
      const dz = ag.z - worldZ;
      if (dx * dx + dz * dz <= rSq) return true;
    }
    return false;
  }

  public getAmbientCallout(
    playerX: number,
    playerZ: number
  ): { text: string; x: number; y: number; z: number } | null {
    for (let i = 0; i < this.agents.length; i++) {
      const ag = this.agents[i];
      const dx = ag.x - playerX;
      const dz = ag.z - playerZ;
      if (dx * dx + dz * dz > 16 * 16) continue;
      if (ag.state === 'CHEERING') {
        return {
          text: 'Warga Trotoar: "Gokil abangku!! Lanjut gas!"',
          x: ag.x,
          y: 2.1,
          z: ag.z,
        };
      }
      if (ag.state === 'FILMING') {
        return {
          text: 'Anak SCBD: "Auto masuk FYP NabiloGram nih, rekam dulu!"',
          x: ag.x,
          y: 2.1,
          z: ag.z,
        };
      }
      if (ag.state === 'CHATTING') {
        return {
          text: 'Warga: "Macet lumayan hari ini ya, untung trotoar adem."',
          x: ag.x,
          y: 2.1,
          z: ag.z,
        };
      }
      if (ag.archetype === 'ojol_driver') {
        return {
          text: 'Driver Ojol: "Klakson kalau butuh tumpangan atau narik, Bang!"',
          x: ag.x,
          y: 2.1,
          z: ag.z,
        };
      }
      if (ag.archetype === 'jogger') {
        return {
          text: 'Pelari Sudirman: "Lari pagi dulu sebelum kena jam sibuk!"',
          x: ag.x,
          y: 2.1,
          z: ag.z,
        };
      }
      if (ag.archetype === 'pedagang') {
        return {
          text: 'Pedagang Kaki Lima: "Mampir dulu Bang, kopi sama gorengan anget!"',
          x: ag.x,
          y: 2.1,
          z: ag.z,
        };
      }
    }
    return null;
  }

  public reactToHorn(
    worldX: number,
    worldZ: number,
    radius: number = 20
  ): { x: number; y: number; z: number }[] {
    const reacting: { dist: number; x: number; y: number; z: number }[] = [];
    for (let i = 0; i < this.agents.length; i++) {
      const ag = this.agents[i];
      const dx = ag.x - worldX;
      const dz = ag.z - worldZ;
      const dist = Math.hypot(dx, dz);
      if (dist <= radius) {
        const inv = dist > 0.01 ? 1 / dist : 1;
        ag.state = 'FLEEING';
        ag.panicTimer = Math.max(ag.panicTimer, 1.55);
        ag.panicVx = dx * inv * 3.8;
        ag.panicVz = dz * inv * 3.8;
        reacting.push({ dist, x: ag.x, y: 2.05, z: ag.z });
      }
    }
    reacting.sort((a, b) => a.dist - b.dist);
    return reacting.slice(0, 2).map(({ x, y, z }) => ({ x, y, z }));
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
    playerZ: number,
    playerSpeed: number = 0,
    playerInVehicle: boolean = false
  ): void {
    const activeCount = Math.max(
      18,
      Math.min(MAX_PEDESTRIANS, Math.round(MAX_PEDESTRIANS * crowdRatio))
    );
    const showUmbrellas = wetnessFactor > 0.65;

    // Rate-limit streaming NPC recycling around player across wide 480m Jakarta
    let recycledThisStep = 0;
    for (let i = 0; i < activeCount && recycledThisStep < 6; i++) {
      const idx = (this.recycleCursor + i) % activeCount;
      if (
        recycleDistantPedestrianInPlace(
          this.agents[idx],
          playerX,
          playerZ,
          this.poolRects,
          idx + this.recycleCursor,
          108 * 108
        )
      ) {
        recycledThisStep++;
      }
    }
    this.recycleCursor = (this.recycleCursor + 6) % activeCount;

    this.interactionTimer += dt;
    if (this.interactionTimer >= 0.22) {
      this.interactionTimer = 0;
      stepPedestrianInteractions(this.agents, activeCount);
    }

    const dummy = this._dummy;
    const stepCtx = {
      dt,
      signalPhase,
      wantedLevel,
      playerX,
      playerZ,
      playerSpeed,
      playerInVehicle,
      buildingGrid: this.buildingGrid,
    };

    let renderedCount = 0;
    let armCount = 0;
    let hatCount = 0;
    let umbCount = 0;
    let filmingPhoneCount = 0;

    for (let i = 0; i < activeCount; i++) {
      const ag = this.agents[i];
      const { facing, moving, state } = stepPedestrianAgentInPlace(ag, stepCtx);

      const dSq =
        (ag.x - playerX) * (ag.x - playerX) +
        (ag.z - playerZ) * (ag.z - playerZ);
      if (dSq > 125 * 125) continue;

      const slot = renderedCount++;
      const swing = moving ? Math.sin(ag.phase) * 0.45 : 0;
      const baseY = 0.14;
      const cosF = Math.cos(facing);
      const sinF = Math.sin(facing);

      // Contact Shadow Disc
      dummy.position.set(ag.x, 0.042, ag.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.shadowMesh.setMatrixAt(slot, dummy.matrix);

      // Torso
      dummy.position.set(ag.x, baseY + 0.88, ag.z);
      dummy.rotation.set(0, facing, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.torsoMesh.setMatrixAt(slot, dummy.matrix);
      this._color.setHex(ag.torsoColor);
      this.torsoMesh.setColorAt(slot, this._color);

      // Head + varied natural skin tone
      dummy.position.set(ag.x, baseY + 1.38, ag.z);
      dummy.rotation.set(0, facing, 0);
      dummy.updateMatrix();
      this.headMesh.setMatrixAt(slot, dummy.matrix);
      this.headMesh.setColorAt(
        slot,
        this._color.setHex(SKIN_TONES[i % SKIN_TONES.length])
      );

      // Hair cap / Hat / Helmet
      const hatHex = resolveHatColor(ag.archetype ?? 'komuter', i);
      dummy.position.set(ag.x, baseY + 1.425, ag.z);
      dummy.rotation.set(0, facing, 0);
      dummy.updateMatrix();
      this.hatHelmetMesh.setMatrixAt(hatCount, dummy.matrix);
      this.hatHelmetMesh.setColorAt(hatCount, this._color.setHex(hatHex));
      hatCount++;

      // Arms (1 draw call for both left + right articulated arms)
      let leftArmRotX = moving ? swing : 0;
      let rightArmRotX = moving ? -swing : 0;
      let armSpreadZ = 0;
      if (state === 'CHEERING') {
        const wave = Math.sin(ag.phase) * 0.28;
        leftArmRotX = -2.55 + wave;
        rightArmRotX = -2.55 - wave;
        armSpreadZ = 0.25;
      } else if (state === 'FILMING') {
        rightArmRotX = -1.25;
      } else if (state === 'BROWSING_PHONE') {
        rightArmRotX = -0.78;
      } else if (state === 'CHATTING') {
        rightArmRotX = -0.35 + Math.sin(ag.phase) * 0.38;
        leftArmRotX = -0.2 + Math.cos(ag.phase) * 0.22;
      }

      this._color.setHex(ag.torsoColor);
      // Left arm
      dummy.position.set(ag.x - cosF * 0.27, baseY + 1.09, ag.z + sinF * 0.27);
      dummy.rotation.set(leftArmRotX, facing, -armSpreadZ);
      dummy.updateMatrix();
      this.armMesh.setMatrixAt(armCount, dummy.matrix);
      this.armMesh.setColorAt(armCount, this._color);
      armCount++;

      // Right arm
      dummy.position.set(ag.x + cosF * 0.27, baseY + 1.09, ag.z - sinF * 0.27);
      dummy.rotation.set(rightArmRotX, facing, armSpreadZ);
      dummy.updateMatrix();
      this.armMesh.setMatrixAt(armCount, dummy.matrix);
      this.armMesh.setColorAt(armCount, this._color);
      armCount++;

      // Legs + trousers tint
      const trouserHex = TROUSER_COLORS[i % TROUSER_COLORS.length];
      dummy.position.set(ag.x - cosF * 0.11, baseY + 0.58, ag.z + sinF * 0.11);
      dummy.rotation.set(swing, facing, 0);
      dummy.updateMatrix();
      this.leftLegMesh.setMatrixAt(slot, dummy.matrix);
      this.leftLegMesh.setColorAt(slot, this._color.setHex(trouserHex));

      dummy.position.set(ag.x + cosF * 0.11, baseY + 0.58, ag.z - sinF * 0.11);
      dummy.rotation.set(-swing, facing, 0);
      dummy.updateMatrix();
      this.rightLegMesh.setMatrixAt(slot, dummy.matrix);
      this.rightLegMesh.setColorAt(slot, this._color);

      if (showUmbrellas) {
        dummy.position.set(ag.x, baseY + 1.82, ag.z);
        dummy.rotation.set(0, facing, 0);
        dummy.updateMatrix();
        this.umbrellaMesh.setMatrixAt(umbCount, dummy.matrix);
        this._color.setHex(
          i % 3 === 0 ? 0xf59e0b : i % 3 === 1 ? 0x38bdf8 : 0xef4444
        );
        this.umbrellaMesh.setColorAt(umbCount, this._color);
        umbCount++;
      }

      if (
        (state === 'FILMING' || state === 'BROWSING_PHONE') &&
        filmingPhoneCount < MAX_PEDESTRIANS
      ) {
        const reach = state === 'FILMING' ? 0.42 : 0.34;
        const heightOffset = state === 'FILMING' ? 1.34 : 1.06;
        dummy.position.set(
          ag.x + sinF * reach,
          baseY + heightOffset,
          ag.z + cosF * reach
        );
        dummy.rotation.set(state === 'FILMING' ? -0.15 : -0.55, facing, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        this.phoneMesh.setMatrixAt(filmingPhoneCount++, dummy.matrix);
      }
    }

    this.shadowMesh.count = renderedCount;
    this.shadowMesh.visible = renderedCount > 0;
    this.torsoMesh.count = renderedCount;
    this.headMesh.count = renderedCount;
    this.leftLegMesh.count = renderedCount;
    this.rightLegMesh.count = renderedCount;
    this.armMesh.count = armCount;
    this.hatHelmetMesh.count = hatCount;
    this.hatHelmetMesh.visible = hatCount > 0;
    this.umbrellaMesh.count = umbCount;
    this.umbrellaMesh.visible = umbCount > 0;
    this.phoneMesh.count = filmingPhoneCount;
    this.phoneMesh.visible = filmingPhoneCount > 0;

    if (renderedCount > 0) {
      this.shadowMesh.instanceMatrix.needsUpdate = true;
      this.torsoMesh.instanceMatrix.needsUpdate = true;
      if (this.torsoMesh.instanceColor) {
        this.torsoMesh.instanceColor.needsUpdate = true;
      }
      this.headMesh.instanceMatrix.needsUpdate = true;
      if (this.headMesh.instanceColor) {
        this.headMesh.instanceColor.needsUpdate = true;
      }
      this.leftLegMesh.instanceMatrix.needsUpdate = true;
      if (this.leftLegMesh.instanceColor) {
        this.leftLegMesh.instanceColor.needsUpdate = true;
      }
      this.rightLegMesh.instanceMatrix.needsUpdate = true;
      if (this.rightLegMesh.instanceColor) {
        this.rightLegMesh.instanceColor.needsUpdate = true;
      }
      this.armMesh.instanceMatrix.needsUpdate = true;
      if (this.armMesh.instanceColor) {
        this.armMesh.instanceColor.needsUpdate = true;
      }
    }
    if (hatCount > 0) {
      this.hatHelmetMesh.instanceMatrix.needsUpdate = true;
      if (this.hatHelmetMesh.instanceColor) {
        this.hatHelmetMesh.instanceColor.needsUpdate = true;
      }
    }
    if (umbCount > 0) {
      this.umbrellaMesh.instanceMatrix.needsUpdate = true;
      if (this.umbrellaMesh.instanceColor) {
        this.umbrellaMesh.instanceColor.needsUpdate = true;
      }
    }
    if (filmingPhoneCount > 0) {
      this.phoneMesh.instanceMatrix.needsUpdate = true;
    }
  }

  public spawnCarjackedDriver(
    carX: number,
    carZ: number,
    carHeading: number
  ): void {
    if (this.agents.length === 0) return;
    // Repurpose the next recycled pedestrian slot as the ejected vehicle driver
    const idx = this.recycleCursor % this.agents.length;
    this.recycleCursor = (this.recycleCursor + 1) % this.agents.length;
    const agent = this.agents[idx];
    const sideX = Math.cos(carHeading);
    const sideZ = -Math.sin(carHeading);
    agent.x = carX - sideX * 2.1;
    agent.z = carZ - sideZ * 2.1;
    agent.state = 'FLEEING';
    agent.panicTimer = 5.5;
    agent.panicVx = -sideX * 5.2;
    agent.panicVz = -sideZ * 5.2;
    triggerCrowdFleeImpulse(this.agents, carX, carZ, 12);
  }

  public dispose(): void {
    this.shadowMesh.geometry.dispose();
    (this.shadowMesh.material as THREE.Material).dispose();
    this.torsoMesh.geometry.dispose();
    (this.torsoMesh.material as THREE.Material).dispose();
    this.headMesh.geometry.dispose();
    (this.headMesh.material as THREE.Material).dispose();
    this.armMesh.geometry.dispose();
    (this.armMesh.material as THREE.Material).dispose();
    this.hatHelmetMesh.geometry.dispose();
    (this.hatHelmetMesh.material as THREE.Material).dispose();
    this.leftLegMesh.geometry.dispose();
    (this.leftLegMesh.material as THREE.Material).dispose();
    this.rightLegMesh.geometry.dispose();
    this.umbrellaMesh.geometry.dispose();
    (this.umbrellaMesh.material as THREE.Material).dispose();
    this.phoneMesh.geometry.dispose();
    (this.phoneMesh.material as THREE.Material).dispose();
  }
}

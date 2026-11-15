import * as THREE from 'three';
import {
  BuildingFootprint,
  ENEMY_ARCHETYPES,
  ENTERABLE_INTERIORS,
  EnemyBehaviorPolicy,
  EnterableInteriorSpec,
  NABILO_OUTFITS,
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  ProtagonistId,
  STORY_MISSIONS,
  SpatialHashGrid,
  StoryChoiceOption,
  StoryMission,
  VEHICLE_SPECS,
  WARUNG_STALL_LOCATIONS,
  WEAPONS,
  getGroundElevationAt,
  getPlayerStaminaSpeedMultiplier,
  resolveCircleAABBCollision,
  stepEnemyMovementPolicy,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import {
  buildCharacterRig,
  buildCombatDroneMesh,
} from '../game/world/geometryBuilders';
import type { RadarEnemyBlip } from '../state/gameStore';
import { TrafficSystem, VehicleEntity } from './TrafficSystem';

export interface EnemyEntity {
  id: string;
  policy: EnemyBehaviorPolicy;
  rig: ReturnType<typeof buildCharacterRig>;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  hp: number;
  maxHp: number;
  state: 'alive' | 'ko';
  koTimer: number;
  hitFlashTimer: number;
  windupTimer: number;
  cooldownTimer: number;
  phaseTimer: number;
}

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

export interface PlayerControllerCallbacks {
  getGameState: () => string;
  getPlayerState: () => PlayerProgressState;
  getActiveChoice: () => StoryChoiceOption | null;
  getTpsAiming: () => boolean;
  getWheelSlowMo: () => boolean;
  getCustomsOpen: () => boolean;
  onPlayerDamage: (dmg: number) => void;
  onEnemyDefeated: (rewardRp: number, scoreDelta: number) => void;
  onConsumeAmmo: () => boolean;
  onOpenMissionDialog: (mission: StoryMission) => void;
  onCompleteActiveObjective: () => void;
  onToggleTpsAim: () => void;
  onEnterOrExitInterior: (target?: EnterableInteriorSpec | null) => void;
}

const PARTICLE_CAP = 96;

export class PlayerController {
  private readonly scene: THREE.Scene;
  private readonly domElement: HTMLElement;
  private readonly buildingGrid: SpatialHashGrid<BuildingFootprint>;
  private readonly traffic: TrafficSystem;
  private readonly callbacks: PlayerControllerCallbacks;

  public readonly playerRig: ReturnType<typeof buildCharacterRig>;
  public readonly idleProtagonistRigs: Record<
    ProtagonistId,
    ReturnType<typeof buildCharacterRig>
  >;
  public readonly enemies: EnemyEntity[] = [];
  public readonly beaconGroup: THREE.Group;
  public readonly droneMesh: THREE.Group;
  public readonly crewCompanions: {
    rig: ReturnType<typeof buildCharacterRig>;
    x: number;
    z: number;
    facing: number;
    walkDist: number;
    fireCooldown: number;
  }[];

  public readonly playerPhys = {
    x: 0,
    y: 0,
    z: 26,
    vx: 0,
    vy: 0,
    vz: 0,
    facing: Math.PI,
    attackCooldown: 0,
    combatRollTimer: 0,
    walkDist: 0,
    drivingVehicleId: null as string | null,
  };
  private savedExteriorPos: { x: number; z: number; facing: number } | null =
    null;

  public readonly skySwitch = {
    active: false,
    targetId: 'nabilo' as ProtagonistId,
    fromX: 0,
    fromZ: 26,
    toX: 0,
    toZ: 26,
    elapsed: 0,
    duration: 1.35,
    lastStageSound: 0,
  };

  public objectiveProgress = 0;
  private checkpointStage = 0;
  private droneFireCooldown = 0.5;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private tourElapsed = 0;
  private customsOrbitAngle = 0;
  private sirenSoundCooldown = 0;
  private camYaw = Math.PI;
  private camPitch = 0.28;
  private userOrbitTimer = 0;

  private readonly particleGeo: THREE.BoxGeometry;
  private readonly particleMat: THREE.MeshBasicMaterial;
  private readonly particleInst: THREE.InstancedMesh;
  private readonly particles: ParticleSlot[];
  private particleCursor = 0;

  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _scale = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _mat4 = new THREE.Matrix4();
  private readonly _color = new THREE.Color();

  private readonly keysHeld = new Set<string>();
  private readonly keysJustPressed = new Set<string>();
  private mouseJustClicked = false;
  private rightMouseHeld = false;
  private isOrbitDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private dragDistance = 0;

  constructor(
    scene: THREE.Scene,
    domElement: HTMLElement,
    buildingGrid: SpatialHashGrid<BuildingFootprint>,
    traffic: TrafficSystem,
    callbacks: PlayerControllerCallbacks
  ) {
    this.scene = scene;
    this.domElement = domElement;
    this.buildingGrid = buildingGrid;
    this.traffic = traffic;
    this.callbacks = callbacks;

    // 1. Mission Beacon Pillar + Ring
    this.beaconGroup = new THREE.Group();
    const beaconCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beaconCyl.position.y = 7;
    this.beaconGroup.add(beaconCyl);

    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beaconRing.position.y = 0.06;
    this.beaconGroup.add(beaconRing);
    scene.add(this.beaconGroup);

    // 2. Pooled Particles InstancedMesh
    this.particleGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    this.particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleInst = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      PARTICLE_CAP
    );
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

    // 3. Player + Idle Trio Protagonists
    this.playerRig = buildCharacterRig('player');
    scene.add(this.playerRig.group);

    this.idleProtagonistRigs = {
      nabilo: buildCharacterRig('player'),
      raka: buildCharacterRig('player'),
      kirana: buildCharacterRig('player'),
    };
    (['nabilo', 'raka', 'kirana'] as ProtagonistId[]).forEach((pId) => {
      const rig = this.idleProtagonistRigs[pId];
      const prof = PROTAGONIST_PROFILES[pId];
      const outfit =
        NABILO_OUTFITS.find((o) => o.id === prof.defaultOutfitId) ||
        NABILO_OUTFITS[0];
      if (rig.group.userData.jacketMat) {
        (
          rig.group.userData.jacketMat as THREE.MeshStandardMaterial
        ).color.setHex(outfit.jacketHex);
        (
          rig.group.userData.pantsMat as THREE.MeshStandardMaterial
        ).color.setHex(outfit.pantsHex);
        (rig.group.userData.capMat as THREE.MeshStandardMaterial).color.setHex(
          outfit.capHex
        );
      }
      rig.group.position.set(
        prof.spawnX,
        getGroundElevationAt(prof.spawnX, prof.spawnZ),
        prof.spawnZ
      );
      scene.add(rig.group);
    });

    // 4. Crew & Rajawali Drone
    this.crewCompanions = [0, 1, 2].map((idx) => {
      const rig = buildCharacterRig('crew');
      rig.group.visible = false;
      rig.group.position.set(
        this.playerPhys.x - 2 + idx * 2,
        0,
        this.playerPhys.z + 2
      );
      scene.add(rig.group);
      return {
        rig,
        x: this.playerPhys.x - 2 + idx * 2,
        z: this.playerPhys.z + 2,
        facing: Math.PI,
        walkDist: 0,
        fireCooldown: 0.4 + idx * 0.3,
      };
    });

    this.droneMesh = buildCombatDroneMesh();
    this.droneMesh.position.set(
      this.playerPhys.x + 1.6,
      3.2,
      this.playerPhys.z - 1.2
    );
    scene.add(this.droneMesh);

    this.spawnEnemyGroup(-36, 12, 3);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    window.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.keysHeld.has(e.code)) {
      this.keysJustPressed.add(e.code);
    }
    this.keysHeld.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keysHeld.delete(e.code);
  };

  private onWindowBlur = () => {
    this.keysHeld.clear();
    this.keysJustPressed.clear();
    this.mouseJustClicked = false;
    this.rightMouseHeld = false;
    this.isOrbitDragging = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.target !== this.domElement) return;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (e.button === 0) {
      this.isOrbitDragging = true;
      this.dragDistance = 0;
      if (this.callbacks.getTpsAiming() || this.rightMouseHeld) {
        this.mouseJustClicked = true;
      }
    } else if (e.button === 2) {
      this.rightMouseHeld = true;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.callbacks.getGameState() !== 'playing') return;
    if (this.callbacks.getCustomsOpen() || this.callbacks.getWheelSlowMo()) {
      return;
    }
    if (!this.isOrbitDragging && !this.rightMouseHeld) return;

    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;

    if (this.isOrbitDragging) {
      this.dragDistance += Math.abs(dx) + Math.abs(dy);
    }

    this.camYaw -= dx * 0.0055;
    this.camPitch = THREE.MathUtils.clamp(
      this.camPitch + dy * 0.004,
      0.1,
      0.88
    );
    this.userOrbitTimer = 2.0;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) {
      if (
        this.isOrbitDragging &&
        this.dragDistance < 8 &&
        !(this.callbacks.getTpsAiming() || this.rightMouseHeld)
      ) {
        this.mouseJustClicked = true;
      }
      this.isOrbitDragging = false;
    } else if (e.button === 2) {
      this.rightMouseHeld = false;
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (e.target === this.domElement) {
      e.preventDefault();
    }
  };

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

  public spawnEnemyGroup(
    centerX: number,
    centerZ: number,
    count: number
  ): void {
    const policies: EnemyBehaviorPolicy[] = [
      'rusher',
      'ranged_kiter',
      'charger_enforcer',
    ];
    for (let i = 0; i < count; i++) {
      const policy = policies[i % policies.length];
      const spec = ENEMY_ARCHETYPES[policy];
      const rig = buildCharacterRig(policy);
      const ang = (i / count) * Math.PI * 2;
      const ex = centerX + Math.cos(ang) * 6.5;
      const ez = centerZ + Math.sin(ang) * 6.5;
      rig.group.position.set(ex, getGroundElevationAt(ex, ez), ez);
      this.scene.add(rig.group);
      this.enemies.push({
        id: `enemy_${Date.now()}_${i}`,
        policy,
        rig,
        x: ex,
        z: ez,
        vx: 0,
        vz: 0,
        facing: 0,
        hp: spec.maxHp,
        maxHp: spec.maxHp,
        state: 'alive',
        koTimer: 0,
        hitFlashTimer: 0,
        windupTimer: 0,
        cooldownTimer: 0.4 + i * 0.25,
        phaseTimer: i * 1.1,
      });
    }
  }

  public triggerHorn(): void {
    soundEngine.playHorn();
    this.traffic.notifyHorn(this.playerPhys.x, this.playerPhys.z);
    this.spawnParticles(
      this.playerPhys.x,
      this.playerPhys.y + 1.8,
      this.playerPhys.z,
      4,
      0xfacc15,
      4
    );
  }

  public toggleEnterExitVehicle(): void {
    if (this.playerPhys.drivingVehicleId) {
      const v = this.traffic.vehicles.find(
        (item) => item.id === this.playerPhys.drivingVehicleId
      );
      this.playerPhys.drivingVehicleId = null;
      if (v) {
        const gY = getGroundElevationAt(v.x, v.z);
        v.y = gY;
        v.mesh.position.y = gY;
        v.mesh.rotation.z = 0;
        this.playerPhys.x = v.x + Math.cos(v.heading) * 2.4;
        this.playerPhys.z = v.z - Math.sin(v.heading) * 2.4;
        this.playerPhys.y = getGroundElevationAt(
          this.playerPhys.x,
          this.playerPhys.z
        );
      }
      this.playerRig.group.visible = true;
      soundEngine.stopEngineAudio(false);
      soundEngine.playVehicleDoor();
      return;
    }

    let nearest: VehicleEntity | null = null;
    let bestDist = 6.5;
    for (const v of this.traffic.vehicles) {
      const d = Math.hypot(v.x - this.playerPhys.x, v.z - this.playerPhys.z);
      if (d < bestDist) {
        bestDist = d;
        nearest = v;
      }
    }
    if (nearest) {
      nearest.isTraffic = false;
      this.playerPhys.drivingVehicleId = nearest.id;
      this.playerRig.group.visible = false;
      soundEngine.playVehicleDoor();
    }
  }

  public startMissionObjective(choice: StoryChoiceOption): void {
    this.objectiveProgress = 0;
    this.checkpointStage = 0;
    while (this.enemies.length > 0) {
      const old = this.enemies.pop()!;
      this.scene.remove(old.rig.group);
    }
    if (choice.objectiveType === 'combat_wave') {
      this.spawnEnemyGroup(
        choice.targetX,
        choice.targetZ,
        choice.objectiveTargetCount
      );
    } else if (choice.objectiveType === 'heist_escape') {
      this.spawnEnemyGroup(choice.targetX, choice.targetZ, 3);
    }
    soundEngine.playPickup();
  }

  public resetWorldForNewRun(): void {
    this.playerPhys.drivingVehicleId = null;
    this.playerPhys.x = 0;
    this.playerPhys.y = 0;
    this.playerPhys.z = 26;
    this.playerPhys.vx = 0;
    this.playerPhys.vy = 0;
    this.playerPhys.vz = 0;
    this.playerPhys.facing = Math.PI;
    this.camYaw = Math.PI;
    this.camPitch = 0.28;
    this.userOrbitTimer = 0;
    this.playerRig.group.visible = true;
    this.objectiveProgress = 0;
    this.checkpointStage = 0;
    this.skySwitch.active = false;

    while (this.enemies.length > 0) {
      const old = this.enemies.pop()!;
      this.scene.remove(old.rig.group);
    }
    this.spawnEnemyGroup(-36, 12, 3);
  }

  public restoreSavedPosition(targetX: number, targetZ: number): void {
    if (this.playerPhys.drivingVehicleId) {
      this.playerPhys.drivingVehicleId = null;
      this.playerRig.group.visible = true;
    }
    const safe = resolveCircleAABBCollision(
      targetX,
      targetZ,
      2.2,
      undefined,
      this.buildingGrid
    );
    const gY = getGroundElevationAt(safe.x, safe.z);
    this.playerPhys.x = safe.x;
    this.playerPhys.y = gY;
    this.playerPhys.z = safe.z;
    this.playerPhys.vx = 0;
    this.playerPhys.vz = 0;
    this.camYaw = this.playerPhys.facing;
    this.camPitch = 0.28;
    this.userOrbitTimer = 0;
    this.playerRig.group.position.set(
      this.playerPhys.x,
      this.playerPhys.y,
      this.playerPhys.z
    );
    this.skySwitch.active = false;
  }

  public teleportPlayerTo(targetX: number, targetZ: number): void {
    const safe = resolveCircleAABBCollision(
      targetX,
      targetZ,
      2.8,
      undefined,
      this.buildingGrid
    );
    const gY = getGroundElevationAt(safe.x, safe.z);
    if (this.playerPhys.drivingVehicleId) {
      const v = this.traffic.vehicles.find(
        (item) => item.id === this.playerPhys.drivingVehicleId
      );
      if (v) {
        v.x = safe.x;
        v.y = gY;
        v.z = safe.z;
        v.speed = 0;
        v.mesh.position.set(v.x, v.y, v.z);
      }
    }
    this.playerPhys.x = safe.x;
    this.playerPhys.y = gY;
    this.playerPhys.z = safe.z;
    this.playerPhys.vx = 0;
    this.playerPhys.vz = 0;
    this.playerRig.group.position.set(
      this.playerPhys.x,
      this.playerPhys.y,
      this.playerPhys.z
    );
    this.spawnParticles(safe.x, gY + 1.4, safe.z, 22, 0x38bdf8, 9);
    soundEngine.playPickup();
  }

  public triggerSatelliteSwitch(
    targetId: ProtagonistId,
    targetX: number,
    targetZ: number
  ): void {
    if (this.playerPhys.drivingVehicleId) {
      this.playerPhys.drivingVehicleId = null;
      this.playerRig.group.visible = true;
    }
    const safe = resolveCircleAABBCollision(
      targetX,
      targetZ,
      2.2,
      undefined,
      this.buildingGrid
    );
    this.skySwitch.active = true;
    this.skySwitch.targetId = targetId;
    this.skySwitch.fromX = this.playerPhys.x;
    this.skySwitch.fromZ = this.playerPhys.z;
    this.skySwitch.toX = safe.x;
    this.skySwitch.toZ = safe.z;
    this.skySwitch.elapsed = 0;
    this.skySwitch.lastStageSound = 1;
    soundEngine.playCharacterSwitchBoom(1);

    this.playerPhys.x = safe.x;
    this.playerPhys.z = safe.z;
    this.playerPhys.y = getGroundElevationAt(safe.x, safe.z);
    this.playerPhys.vx = 0;
    this.playerPhys.vz = 0;
    this.camYaw = this.playerPhys.facing;
    this.camPitch = 0.28;
    this.userOrbitTimer = 0;
    this.playerRig.group.position.set(
      this.playerPhys.x,
      this.playerPhys.y,
      this.playerPhys.z
    );
  }

  private triggerPlayerAttack(): void {
    const pState = this.callbacks.getPlayerState();
    const wSpec = WEAPONS[pState.activeWeapon];
    if (this.playerPhys.attackCooldown > 0) return;

    if (!wSpec.isMelee) {
      const hasAmmo = this.callbacks.onConsumeAmmo();
      if (!hasAmmo) {
        soundEngine.playTone(150, 0.06, 'sine', 0.1);
        this.playerPhys.attackCooldown = 0.25;
        return;
      }
    }

    this.playerPhys.attackCooldown = wSpec.cooldown;
    soundEngine.playShoot(wSpec.id);
    this.playerRig.rightArm.rotation.x = -Math.PI * 0.75;

    const fwdX = Math.sin(this.playerPhys.facing);
    const fwdZ = Math.cos(this.playerPhys.facing);
    const muzzleX = this.playerPhys.x + fwdX * 1.1;
    const muzzleZ = this.playerPhys.z + fwdZ * 1.1;

    this.spawnParticles(
      muzzleX,
      this.playerPhys.y + 1.25,
      muzzleZ,
      wSpec.isMelee ? 5 : 8,
      wSpec.isMelee ? 0xfef08a : 0xf97316,
      wSpec.isMelee ? 5 : 9
    );

    let hitAny = false;
    const activeChoice = this.callbacks.getActiveChoice();

    if (wSpec.splashRadius > 0) {
      let blastX = this.playerPhys.x + fwdX * 14;
      let blastZ = this.playerPhys.z + fwdZ * 14;
      for (const en of this.enemies) {
        if (en.state !== 'alive') continue;
        const dx = en.x - this.playerPhys.x;
        const dz = en.z - this.playerPhys.z;
        const dist = Math.hypot(dx, dz);
        if (dist <= wSpec.range) {
          const dot = (dx / (dist || 1)) * fwdX + (dz / (dist || 1)) * fwdZ;
          if (dot >= 0.6) {
            blastX = en.x;
            blastZ = en.z;
            break;
          }
        }
      }

      this.spawnParticles(
        blastX,
        this.playerPhys.y + 1.5,
        blastZ,
        28,
        wSpec.id === 'pasopati' ? 0x38bdf8 : 0xf97316,
        13
      );
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.65);

      for (const en of this.enemies) {
        if (en.state !== 'alive') continue;
        const d = Math.hypot(en.x - blastX, en.z - blastZ);
        if (d <= wSpec.splashRadius) {
          const dmgMult = pState.fokusActive ? 1.75 : 1.0;
          en.hp -= Math.round(wSpec.damage * dmgMult);
          en.hitFlashTimer = 0.08;
          const pushAng = Math.atan2(en.x - blastX, en.z - blastZ);
          en.vx += Math.sin(pushAng) * 12;
          en.vz += Math.cos(pushAng) * 12;
          hitAny = true;

          if (en.hp <= 0) {
            this.markEnemyKo(en, activeChoice);
          }
        }
      }
      return;
    }

    for (const en of this.enemies) {
      if (en.state !== 'alive') continue;
      const dx = en.x - this.playerPhys.x;
      const dz = en.z - this.playerPhys.z;
      const dist = Math.hypot(dx, dz);
      if (dist > wSpec.range) continue;

      const dirX = dx / (dist || 1);
      const dirZ = dz / (dist || 1);
      const dot = dirX * fwdX + dirZ * fwdZ;
      const minDot = wSpec.isMelee ? 0.25 : 0.72;

      if (dot >= minDot || dist < 2.2) {
        const dmgMult = pState.fokusActive ? 1.75 : 1.0;
        en.hp -= Math.round(wSpec.damage * dmgMult);
        en.hitFlashTimer = 0.06;
        en.vx += dirX * (wSpec.isMelee ? 9 : 5);
        en.vz += dirZ * (wSpec.isMelee ? 9 : 5);
        hitAny = true;

        this.spawnParticles(en.x, 1.2, en.z, 14, 0xef4444, 8);

        if (en.hp <= 0) {
          this.markEnemyKo(en, activeChoice);
        } else {
          this.hitstopTimer = 0.03;
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.2);
          soundEngine.playHit(false);
        }

        if (!wSpec.isMelee) break;
      }
    }

    if (!hitAny && !wSpec.isMelee) {
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.08);
    }
  }

  private markEnemyKo(
    en: EnemyEntity,
    activeChoice: StoryChoiceOption | null
  ): void {
    en.state = 'ko';
    en.koTimer = 0.42;
    this.hitstopTimer = 0.055;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
    soundEngine.playHit(true);

    const arch = ENEMY_ARCHETYPES[en.policy];
    this.callbacks.onEnemyDefeated(arch.rewardRp, arch.scoreValue);

    if (activeChoice && activeChoice.objectiveType === 'combat_wave') {
      this.objectiveProgress += 1;
      if (this.objectiveProgress >= activeChoice.objectiveTargetCount) {
        soundEngine.playMissionFanfare();
        this.callbacks.onCompleteActiveObjective();
      }
    }
  }

  public updateWorldActors(
    dt: number,
    nowMs: number,
    pState: PlayerProgressState,
    activeChoice: StoryChoiceOption | null,
    isPlaying: boolean
  ): StoryMission | null {
    const outfitSpec =
      NABILO_OUTFITS.find((o) => o.id === pState.outfitId) || NABILO_OUTFITS[0];
    if (this.playerRig.group.userData.jacketMat) {
      (
        this.playerRig.group.userData.jacketMat as THREE.MeshStandardMaterial
      ).color.setHex(outfitSpec.jacketHex);
      (
        this.playerRig.group.userData.pantsMat as THREE.MeshStandardMaterial
      ).color.setHex(outfitSpec.pantsHex);
      (
        this.playerRig.group.userData.capMat as THREE.MeshStandardMaterial
      ).color.setHex(outfitSpec.capHex);
    }

    (['nabilo', 'raka', 'kirana'] as ProtagonistId[]).forEach((pId) => {
      const rig = this.idleProtagonistRigs[pId];
      if (
        pId === pState.activeProtagonist ||
        pState.currentInterior !== 'exterior'
      ) {
        rig.group.visible = false;
      } else {
        rig.group.visible = true;
        const live = pState.protagonistRoster[pId];
        rig.group.position.set(
          live.x,
          getGroundElevationAt(live.x, live.z),
          live.z
        );
      }
    });

    const pRingMat = this.playerRig.telegraphRing
      .material as THREE.MeshBasicMaterial;
    if (pState.fokusActive) {
      pRingMat.opacity = 0.65 + Math.sin(nowMs * 0.014) * 0.25;
      this.playerRig.telegraphRing.scale.setScalar(
        1.1 + Math.sin(nowMs * 0.01) * 0.15
      );
      if (Math.random() < 0.25) {
        this.spawnParticles(
          this.playerPhys.x,
          this.playerPhys.y + 0.9,
          this.playerPhys.z,
          1,
          0xfacc15,
          4
        );
      }
    } else {
      pRingMat.opacity = 0;
    }

    const droneEnabled = pState.droneLevel > 0 && pState.droneActive;
    this.droneMesh.visible = droneEnabled;
    if (droneEnabled) {
      const orbitAng = nowMs * 0.0026;
      const dx = this.playerPhys.x + Math.cos(orbitAng) * 2.1;
      const dz = this.playerPhys.z + Math.sin(orbitAng) * 2.1;
      const dy =
        (this.playerPhys.y || 0) + 3.15 + Math.sin(nowMs * 0.006) * 0.22;
      this.droneMesh.position.set(dx, dy, dz);
      this.droneMesh.rotation.y = -orbitAng + Math.PI / 2;

      if (isPlaying) {
        this.droneFireCooldown -= dt;
        if (this.droneFireCooldown <= 0) {
          let nearestEn: EnemyEntity | null = null;
          let bestDist = 20;
          for (const en of this.enemies) {
            if (en.state !== 'alive') continue;
            const d = Math.hypot(en.x - dx, en.z - dz);
            if (d < bestDist) {
              bestDist = d;
              nearestEn = en;
            }
          }
          if (nearestEn) {
            const kiranaBoost =
              pState.activeProtagonist === 'kirana' && pState.fokusActive
                ? 0.5
                : 1.0;
            this.droneFireCooldown =
              Math.max(0.38, 0.92 - pState.droneLevel * 0.16) * kiranaBoost;
            nearestEn.hp -= 20 + pState.droneLevel * 12;
            nearestEn.hitFlashTimer = 0.06;
            this.spawnParticles(dx, dy, dz, 3, 0x38bdf8, 5);
            this.spawnParticles(
              nearestEn.x,
              1.3,
              nearestEn.z,
              9,
              0x38bdf8,
              8
            );
            if (nearestEn.hp <= 0) {
              this.markEnemyKo(nearestEn, activeChoice);
            }
          }
        }
      }
    }

    const nextStoryMission =
      STORY_MISSIONS.find(
        (m) => !pState.completedMissions.includes(m.id)
      ) || STORY_MISSIONS[0];

    if (activeChoice) {
      this.beaconGroup.position.set(
        activeChoice.targetX,
        getGroundElevationAt(activeChoice.targetX, activeChoice.targetZ),
        activeChoice.targetZ
      );
      this.beaconGroup.visible = true;
    } else if (nextStoryMission) {
      this.beaconGroup.position.set(
        nextStoryMission.markerX,
        getGroundElevationAt(
          nextStoryMission.markerX,
          nextStoryMission.markerZ
        ),
        nextStoryMission.markerZ
      );
      this.beaconGroup.visible = true;
    } else {
      this.beaconGroup.visible = false;
    }
    this.beaconGroup.rotation.y += dt * 1.4;

    return nextStoryMission;
  }

  public stepPlaying(
    dt: number,
    nowMs: number,
    camera: THREE.PerspectiveCamera,
    pState: PlayerProgressState,
    activeChoice: StoryChoiceOption | null,
    nextStoryMission: StoryMission | null,
    nightFactor: number
  ): {
    nearbyInterior: EnterableInteriorSpec | null;
    nearbyMission: StoryMission | null;
    activeVehicle: VehicleEntity | null;
    spottedByPolice: boolean;
  } {
    const isTpsAim = this.callbacks.getTpsAiming();
    const isWheelSlowMo = this.callbacks.getWheelSlowMo();
    const isCustomsOpen = this.callbacks.getCustomsOpen();

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    }
    const rawSimDt = this.hitstopTimer > 0 ? 0 : dt;
    const simDt = isWheelSlowMo ? rawSimDt * 0.25 : rawSimDt;

    let nearbyInterior: EnterableInteriorSpec | null = null;
    if (pState.currentInterior === 'exterior') {
      for (const intSpec of ENTERABLE_INTERIORS) {
        const dInt = Math.hypot(
          this.playerPhys.x - intSpec.portalX,
          this.playerPhys.z - intSpec.portalZ
        );
        if (dInt < 6.5) {
          nearbyInterior = intSpec;
          break;
        }
      }
      if (!nearbyInterior) {
        const warungSpec = ENTERABLE_INTERIORS.find((i) => i.id === 'warung');
        if (warungSpec) {
          for (const [wx, wz] of WARUNG_STALL_LOCATIONS) {
            if (Math.hypot(this.playerPhys.x - wx, this.playerPhys.z - wz) < 6.5) {
              nearbyInterior = warungSpec;
              break;
            }
          }
        }
      }
    }

    if (this.keysJustPressed.has('KeyF')) {
      this.toggleEnterExitVehicle();
    }
    if (this.keysJustPressed.has('KeyG')) {
      if (nearbyInterior || pState.currentInterior !== 'exterior') {
        this.callbacks.onEnterOrExitInterior(nearbyInterior);
      } else {
        this.toggleEnterExitVehicle();
      }
    }
    if (this.keysJustPressed.has('KeyX')) {
      this.callbacks.onToggleTpsAim();
    }
    if (
      (this.keysJustPressed.has('AltLeft') ||
        this.keysJustPressed.has('ControlLeft')) &&
      !this.playerPhys.drivingVehicleId &&
      this.playerPhys.combatRollTimer <= 0
    ) {
      this.playerPhys.combatRollTimer = 0.32;
      soundEngine.playTone(220, 0.12, 'triangle', 0.14, 1.5);
      this.spawnParticles(
        this.playerPhys.x,
        this.playerPhys.y + 0.5,
        this.playerPhys.z,
        10,
        0x38bdf8,
        6
      );
    }

    if (this.keysJustPressed.has('KeyK')) {
      if (this.playerPhys.drivingVehicleId) {
        this.triggerHorn();
      } else {
        this.triggerPlayerAttack();
      }
    } else if (this.keysJustPressed.has('Space') || this.mouseJustClicked) {
      if (!this.playerPhys.drivingVehicleId) {
        this.triggerPlayerAttack();
      }
    }

    let nearbyMission: StoryMission | null = null;
    if (!activeChoice && nextStoryMission) {
      nearbyMission = nextStoryMission;
      if (this.keysJustPressed.has('KeyE')) {
        this.callbacks.onOpenMissionDialog(nextStoryMission);
      }
    }

    this.keysJustPressed.clear();
    this.mouseJustClicked = false;

    const moveForward =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const moveTurn =
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) -
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0);
    const sprinting =
      this.keysHeld.has('ShiftLeft') || this.keysHeld.has('ShiftRight');

    let activeVehicle: VehicleEntity | null = null;
    if (this.playerPhys.drivingVehicleId) {
      activeVehicle =
        this.traffic.vehicles.find(
          (v) => v.id === this.playerPhys.drivingVehicleId
        ) || null;
    }

    const camFwdX = Math.sin(this.camYaw);
    const camFwdZ = Math.cos(this.camYaw);
    const camRightX = -Math.cos(this.camYaw);
    const camRightZ = Math.sin(this.camYaw);
    const strafeRight = -moveTurn;
    const staminaMult = getPlayerStaminaSpeedMultiplier(pState);

    if (pState.currentInterior !== 'exterior') {
      if (!this.savedExteriorPos) {
        this.savedExteriorPos = {
          x: this.playerPhys.x,
          z: this.playerPhys.z,
          facing: this.playerPhys.facing,
        };
        this.playerPhys.x = 0;
        this.playerPhys.z = 4.5;
        this.playerPhys.facing = Math.PI;
        this.camYaw = Math.PI;
      }
      const inputX = camFwdX * moveForward + camRightX * strafeRight;
      const inputZ = camFwdZ * moveForward + camRightZ * strafeRight;
      const mag = Math.hypot(inputX, inputZ);
      if (mag > 0.01) {
        this.playerPhys.x = THREE.MathUtils.clamp(
          this.playerPhys.x + (inputX / mag) * 7.5 * staminaMult * simDt,
          -11,
          11
        );
        this.playerPhys.z = THREE.MathUtils.clamp(
          this.playerPhys.z + (inputZ / mag) * 7.5 * staminaMult * simDt,
          -11,
          11
        );
        this.playerPhys.facing = Math.atan2(inputX, inputZ);
      }
      this.playerPhys.y = 68;
      this.playerRig.group.position.set(
        this.playerPhys.x,
        68,
        this.playerPhys.z
      );
      this.playerRig.group.rotation.y = this.playerPhys.facing;
    } else if (activeVehicle && simDt > 0) {
      this.savedExteriorPos = null;
      const vSpec = VEHICLE_SPECS[activeVehicle.type];
      const rakaBoost =
        pState.activeProtagonist === 'raka' && pState.fokusActive ? 1.45 : 1.0;
      const turboMult =
        (1 + pState.vehicleUpgradeLevel * 0.15) *
        (pState.fokusActive ? 1.18 : 1.0) *
        rakaBoost;

      if (moveForward !== 0) {
        activeVehicle.speed +=
          moveForward * vSpec.acceleration * turboMult * simDt;
      } else {
        activeVehicle.speed *= Math.exp(-3.5 * simDt);
      }
      activeVehicle.speed = THREE.MathUtils.clamp(
        activeVehicle.speed,
        -vSpec.maxSpeed * turboMult * 0.45,
        vSpec.maxSpeed * turboMult
      );

      if (vSpec.isAircraft || Math.abs(activeVehicle.speed) > 0.4) {
        const dirSign =
          vSpec.isAircraft || activeVehicle.speed >= 0 ? 1 : -1;
        activeVehicle.heading += moveTurn * vSpec.turnRate * dirSign * simDt;
      }

      const nextVX =
        activeVehicle.x +
        Math.sin(activeVehicle.heading) * activeVehicle.speed * simDt;
      const nextVZ =
        activeVehicle.z +
        Math.cos(activeVehicle.heading) * activeVehicle.speed * simDt;

      const surfaceElev = getGroundElevationAt(nextVX, nextVZ);
      if (vSpec.isAircraft) {
        const climbDir =
          (this.keysHeld.has('Space') ? 1 : 0) -
          (this.keysHeld.has('KeyZ') ? 1 : 0);
        activeVehicle.y = THREE.MathUtils.clamp(
          activeVehicle.y + climbDir * 14 * simDt,
          surfaceElev,
          38
        );
      } else {
        activeVehicle.y = surfaceElev;
      }

      const col =
        (vSpec.isAircraft && activeVehicle.y > 5) || surfaceElev > 2.5
          ? {
              x: THREE.MathUtils.clamp(nextVX, -88, 88),
              z: THREE.MathUtils.clamp(nextVZ, -88, 88),
              collided: false,
            }
          : resolveCircleAABBCollision(
              nextVX,
              nextVZ,
              vSpec.radius,
              undefined,
              this.buildingGrid
            );

      if (col.collided) {
        activeVehicle.speed *= -0.35;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.25);
        soundEngine.playHit(false);
      }
      activeVehicle.x = col.x;
      activeVehicle.z = col.z;
      activeVehicle.mesh.position.set(
        activeVehicle.x,
        activeVehicle.y,
        activeVehicle.z
      );
      activeVehicle.mesh.rotation.y = activeVehicle.heading;
      const speedLeanRatio = Math.min(1, Math.abs(activeVehicle.speed) / 14);
      const targetRoll =
        -moveTurn * speedLeanRatio * (vSpec.isAircraft ? 0.22 : 0.075);
      activeVehicle.mesh.rotation.z = THREE.MathUtils.damp(
        activeVehicle.mesh.rotation.z,
        targetRoll,
        8,
        simDt
      );

      this.playerPhys.x = activeVehicle.x;
      this.playerPhys.y = activeVehicle.y;
      this.playerPhys.z = activeVehicle.z;
      this.playerPhys.facing = activeVehicle.heading;

      if (Math.abs(activeVehicle.speed) > 8 && activeVehicle.y < 3) {
        for (const en of this.enemies) {
          if (en.state !== 'alive') continue;
          const d = Math.hypot(
            en.x - activeVehicle.x,
            en.z - activeVehicle.z
          );
          if (d < vSpec.radius + 1.0) {
            en.hp = 0;
            this.spawnParticles(en.x, 1.1, en.z, 16, 0xf97316, 10);
            this.markEnemyKo(en, activeChoice);
          }
        }
      }
    } else if (simDt > 0) {
      if (this.savedExteriorPos) {
        this.playerPhys.x = this.savedExteriorPos.x;
        this.playerPhys.z = this.savedExteriorPos.z;
        this.playerPhys.facing = this.savedExteriorPos.facing;
        this.playerPhys.y = getGroundElevationAt(
          this.playerPhys.x,
          this.playerPhys.z
        );
        this.savedExteriorPos = null;
      }
      if (this.playerPhys.combatRollTimer > 0) {
        this.playerPhys.combatRollTimer = Math.max(
          0,
          this.playerPhys.combatRollTimer - simDt
        );
      }
      const rollBoost = this.playerPhys.combatRollTimer > 0 ? 1.85 : 1.0;
      const walkSpeed =
        (sprinting ? 12.5 : 8.5) *
        (pState.fokusActive ? 1.22 : 1.0) *
        staminaMult *
        rollBoost;
      const inputX = camFwdX * moveForward + camRightX * strafeRight;
      const inputZ = camFwdZ * moveForward + camRightZ * strafeRight;
      const mag = Math.hypot(inputX, inputZ);

      if (mag > 0.01) {
        const nx = inputX / mag;
        const nz = inputZ / mag;
        this.playerPhys.vx = nx * walkSpeed;
        this.playerPhys.vz = nz * walkSpeed;
        if (staminaMult > 1.0 && Math.random() < 0.22) {
          this.spawnParticles(
            this.playerPhys.x,
            this.playerPhys.y + 0.35,
            this.playerPhys.z,
            1,
            0x10b981,
            3.5
          );
        }
        const targetAngle = isTpsAim ? this.camYaw : Math.atan2(nx, nz);
        const diff =
          ((targetAngle - this.playerPhys.facing + Math.PI * 3) %
            (Math.PI * 2)) -
          Math.PI;
        this.playerPhys.facing += diff * (1 - Math.exp(-15 * simDt));
      } else {
        this.playerPhys.vx *= Math.exp(-12 * simDt);
        this.playerPhys.vz *= Math.exp(-12 * simDt);
        if (isTpsAim) {
          const diff =
            ((this.camYaw - this.playerPhys.facing + Math.PI * 3) %
              (Math.PI * 2)) -
            Math.PI;
          this.playerPhys.facing += diff * (1 - Math.exp(-18 * simDt));
        }
      }

      const nextPX = this.playerPhys.x + this.playerPhys.vx * simDt;
      const nextPZ = this.playerPhys.z + this.playerPhys.vz * simDt;
      const elevY = getGroundElevationAt(nextPX, nextPZ);
      const col =
        elevY > 2.5
          ? {
              x: THREE.MathUtils.clamp(nextPX, -88, 88),
              z: THREE.MathUtils.clamp(nextPZ, -88, 88),
              collided: false,
            }
          : resolveCircleAABBCollision(
              nextPX,
              nextPZ,
              0.75,
              undefined,
              this.buildingGrid
            );
      this.playerPhys.x = col.x;
      this.playerPhys.z = col.z;
      this.playerPhys.y = elevY;

      const stepDist =
        Math.hypot(this.playerPhys.vx, this.playerPhys.vz) * simDt;
      this.playerPhys.walkDist += stepDist;
      if (mag > 0.01) {
        const swing = Math.sin(this.playerPhys.walkDist * 2.2) * 0.55;
        this.playerRig.leftLeg.rotation.x = swing;
        this.playerRig.rightLeg.rotation.x = -swing;
      } else {
        this.playerRig.leftLeg.rotation.x *= 0.8;
        this.playerRig.rightLeg.rotation.x *= 0.8;
      }

      this.playerRig.rightArm.rotation.x = THREE.MathUtils.damp(
        this.playerRig.rightArm.rotation.x,
        isTpsAim ? -Math.PI * 0.42 : 0,
        12,
        simDt
      );

      this.playerRig.group.position.set(
        this.playerPhys.x,
        this.playerPhys.y,
        this.playerPhys.z
      );
      this.playerRig.group.rotation.y = this.playerPhys.facing;
    }

    if (this.playerPhys.attackCooldown > 0) {
      this.playerPhys.attackCooldown = Math.max(
        0,
        this.playerPhys.attackCooldown - simDt
      );
    }

    // Checkpoints / Heist Escape
    if (
      activeChoice &&
      (activeChoice.objectiveType === 'checkpoint_drive' ||
        activeChoice.objectiveType === 'heist_escape')
    ) {
      const distToTarget = Math.hypot(
        this.playerPhys.x - activeChoice.targetX,
        this.playerPhys.z - activeChoice.targetZ
      );
      if (distToTarget < 7.0) {
        this.objectiveProgress += 1;
        this.checkpointStage += 1;
        this.spawnParticles(
          activeChoice.targetX,
          this.playerPhys.y + 1.5,
          activeChoice.targetZ,
          20,
          0xfef08a,
          9
        );
        soundEngine.playPickup();

        if (this.objectiveProgress >= activeChoice.objectiveTargetCount) {
          soundEngine.playMissionFanfare();
          this.callbacks.onCompleteActiveObjective();
        } else {
          const checkpoints = [
            [0, -26],
            [36, -26],
            [32, 16],
            [0, 26],
          ];
          const nextPt =
            checkpoints[this.checkpointStage % checkpoints.length];
          activeChoice.targetX = nextPt[0];
          activeChoice.targetZ = nextPt[1];
        }
      }
    }

    // Crew Companions
    for (let cIdx = 0; cIdx < this.crewCompanions.length; cIdx++) {
      const comp = this.crewCompanions[cIdx];
      const shouldShow =
        cIdx < pState.crewCount &&
        !this.playerPhys.drivingVehicleId &&
        pState.currentInterior === 'exterior';
      comp.rig.group.visible = shouldShow;
      if (!shouldShow) continue;

      const formAngle =
        this.playerPhys.facing + Math.PI + (cIdx - 1) * 0.65;
      const targetCX = this.playerPhys.x + Math.sin(formAngle) * 2.6;
      const targetCZ = this.playerPhys.z + Math.cos(formAngle) * 2.6;
      const dxC = targetCX - comp.x;
      const dzC = targetCZ - comp.z;
      const distC = Math.hypot(dxC, dzC);

      if (distC > 0.35) {
        const stepC = Math.min(distC, 9.2 * simDt);
        comp.x += (dxC / distC) * stepC;
        comp.z += (dzC / distC) * stepC;
        comp.facing = Math.atan2(dxC, dzC);
        comp.walkDist += stepC;
        const swing = Math.sin(comp.walkDist * 2.2) * 0.5;
        comp.rig.leftLeg.rotation.x = swing;
        comp.rig.rightLeg.rotation.x = -swing;
      } else {
        comp.rig.leftLeg.rotation.x *= 0.8;
        comp.rig.rightLeg.rotation.x *= 0.8;
      }

      comp.fireCooldown -= simDt;
      if (comp.fireCooldown <= 0) {
        let targetEn: EnemyEntity | null = null;
        let bestED = 16;
        for (const en of this.enemies) {
          if (en.state !== 'alive') continue;
          const d = Math.hypot(en.x - comp.x, en.z - comp.z);
          if (d < bestED) {
            bestED = d;
            targetEn = en;
          }
        }
        if (targetEn) {
          comp.fireCooldown = 1.05;
          comp.facing = Math.atan2(
            targetEn.x - comp.x,
            targetEn.z - comp.z
          );
          comp.rig.rightArm.rotation.x = -Math.PI * 0.65;
          targetEn.hp -= 24;
          targetEn.hitFlashTimer = 0.06;
          this.spawnParticles(targetEn.x, 1.2, targetEn.z, 8, 0x22c55e, 7);
          if (targetEn.hp <= 0) {
            this.markEnemyKo(targetEn, activeChoice);
          }
        } else {
          comp.fireCooldown = 0.35;
        }
      }

      comp.rig.rightArm.rotation.x = THREE.MathUtils.damp(
        comp.rig.rightArm.rotation.x,
        0,
        10,
        simDt
      );
      comp.rig.group.position.set(
        comp.x,
        getGroundElevationAt(comp.x, comp.z),
        comp.z
      );
      comp.rig.group.rotation.y = comp.facing;
    }

    let spottedByPolice = this.traffic.stepTrafficAI(
      simDt,
      nowMs,
      this.playerPhys.drivingVehicleId,
      activeVehicle,
      pState,
      this.playerPhys.x,
      this.playerPhys.y,
      this.playerPhys.z,
      nightFactor,
      isWheelSlowMo
    );

    if (pState.wantedLevel > 0) {
      for (const en of this.enemies) {
        if (
          en.state === 'alive' &&
          Math.hypot(en.x - this.playerPhys.x, en.z - this.playerPhys.z) < 25
        ) {
          spottedByPolice = true;
          break;
        }
      }
      this.sirenSoundCooldown -= dt;
      if (this.sirenSoundCooldown <= 0 && !pState.wantedEvading) {
        this.sirenSoundCooldown = 3.6;
        soundEngine.playPoliceSiren();
      }
    }

    // Enemy AI Loop
    let activeAttackers = 0;
    const MAX_CONCURRENT_ATTACKERS = 3;
    const enemySimDt = simDt * (pState.fokusActive ? 0.38 : 1.0);

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (en.state === 'ko') {
        en.koTimer -= dt;
        en.rig.group.rotation.x = THREE.MathUtils.damp(
          en.rig.group.rotation.x,
          -Math.PI / 2,
          10,
          dt
        );
        if (en.koTimer <= 0) {
          this.scene.remove(en.rig.group);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      en.phaseTimer += enemySimDt;
      const spec = ENEMY_ARCHETYPES[en.policy];

      if (en.hitFlashTimer > 0) {
        en.hitFlashTimer -= dt;
        (
          en.rig.bodyMesh.material as THREE.MeshStandardMaterial
        ).emissive.setHex(en.hitFlashTimer > 0 ? 0xffffff : 0x000000);
      }

      en.x += en.vx * simDt;
      en.z += en.vz * simDt;
      en.vx *= Math.exp(-10 * simDt);
      en.vz *= Math.exp(-10 * simDt);

      const distToPlayer = Math.hypot(
        this.playerPhys.x - en.x,
        this.playerPhys.z - en.z
      );

      if (en.windupTimer <= 0 && distToPlayer < 48) {
        const moveRes = stepEnemyMovementPolicy(
          en.policy,
          en.x,
          en.z,
          this.playerPhys.x,
          this.playerPhys.z,
          spec.speed,
          enemySimDt,
          en.phaseTimer
        );
        const col = resolveCircleAABBCollision(
          moveRes.nextX,
          moveRes.nextZ,
          0.75,
          undefined,
          this.buildingGrid
        );
        en.x = col.x;
        en.z = col.z;
        en.facing = moveRes.facingAngle;
      }

      if (en.cooldownTimer > 0) {
        en.cooldownTimer -= enemySimDt;
      }

      const ringMat = en.rig.telegraphRing
        .material as THREE.MeshBasicMaterial;
      if (en.windupTimer > 0) {
        activeAttackers++;
        en.windupTimer -= enemySimDt;
        ringMat.opacity = 0.75;
        const pulse =
          1 + (1 - en.windupTimer / spec.windupDuration) * 0.45;
        en.rig.telegraphRing.scale.setScalar(pulse);

        if (en.windupTimer <= 0) {
          ringMat.opacity = 0;
          en.cooldownTimer = spec.cooldown;
          if (
            distToPlayer <= spec.attackRange + 1.2 &&
            this.playerPhys.combatRollTimer <= 0
          ) {
            this.callbacks.onPlayerDamage(spec.damage);
            this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
            soundEngine.playHit(false);
            this.spawnParticles(
              this.playerPhys.x,
              this.playerPhys.y + 1.1,
              this.playerPhys.z,
              10,
              0xef4444,
              6
            );
          }
        }
      } else {
        ringMat.opacity = 0;
        if (
          distToPlayer <= spec.attackRange &&
          en.cooldownTimer <= 0 &&
          activeAttackers < MAX_CONCURRENT_ATTACKERS
        ) {
          activeAttackers++;
          en.windupTimer = spec.windupDuration;
          soundEngine.playTone(380, 0.12, 'sine', 0.08, 1.35);
        }
      }

      en.rig.group.position.set(
        en.x,
        getGroundElevationAt(en.x, en.z),
        en.z
      );
      en.rig.group.rotation.y = en.facing;
    }

    // Police Reinforcements
    const maxPoliceReinforcements = Math.min(6, pState.wantedLevel + 1);
    if (
      pState.wantedLevel >= 1 &&
      pState.currentInterior === 'exterior' &&
      this.enemies.length < maxPoliceReinforcements &&
      Math.random() < 0.018
    ) {
      this.spawnEnemyGroup(this.playerPhys.x - 16, this.playerPhys.z - 16, 2);
    }

    // Update Zero-GC Pooled Particles
    for (let i = 0; i < PARTICLE_CAP; i++) {
      const p = this.particles[i];
      if (!p.active) {
        this._v1.set(0, -100, 0);
        this._scale.setScalar(0.001);
        this._mat4.compose(this._v1, this._quat.identity(), this._scale);
        this.particleInst.setMatrixAt(i, this._mat4);
        continue;
      }
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
      this.particleInst.setMatrixAt(i, this._mat4);
      this._color.setHex(p.colorHex);
      this.particleInst.setColorAt(i, this._color);
    }
    this.particleInst.instanceMatrix.needsUpdate = true;
    if (this.particleInst.instanceColor) {
      this.particleInst.instanceColor.needsUpdate = true;
    }

    // Camera Choreography
    if (this.userOrbitTimer > 0) {
      this.userOrbitTimer = Math.max(0, this.userOrbitTimer - dt);
    }

    const isDriving = Boolean(activeVehicle);
    const speedRatio = activeVehicle
      ? Math.min(
          1.25,
          Math.abs(activeVehicle.speed) /
            Math.max(1, VEHICLE_SPECS[activeVehicle.type].maxSpeed)
        )
      : 0;
    const targetFov = isTpsAim
      ? 46
      : isDriving
      ? 60 + speedRatio * 10 + (pState.fokusActive ? 3.5 : 0)
      : 60;
    if (Math.abs(camera.fov - targetFov) > 0.15) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 8);
      camera.updateProjectionMatrix();
    }

    if (this.skySwitch.active) {
      this.skySwitch.elapsed += dt;
      const progress = Math.min(
        1,
        this.skySwitch.elapsed / this.skySwitch.duration
      );
      const stageNum: 1 | 2 | 3 =
        progress < 0.34 ? 1 : progress < 0.68 ? 2 : 3;
      if (stageNum !== this.skySwitch.lastStageSound) {
        this.skySwitch.lastStageSound = stageNum;
        soundEngine.playCharacterSwitchBoom(stageNum);
      }

      if (progress < 0.34) {
        const t1 = progress / 0.34;
        camera.position.set(
          this.skySwitch.fromX,
          THREE.MathUtils.lerp(12, 66, t1),
          this.skySwitch.fromZ + 8
        );
        camera.lookAt(this.skySwitch.fromX, 0, this.skySwitch.fromZ);
      } else if (progress < 0.68) {
        const t2 = (progress - 0.34) / 0.34;
        const curX = THREE.MathUtils.lerp(
          this.skySwitch.fromX,
          this.skySwitch.toX,
          t2
        );
        const curZ = THREE.MathUtils.lerp(
          this.skySwitch.fromZ,
          this.skySwitch.toZ,
          t2
        );
        camera.position.set(curX, 66, curZ + 8);
        camera.lookAt(curX, 0, curZ);
      } else {
        const t3 = (progress - 0.68) / 0.32;
        const targetGroundY = getGroundElevationAt(
          this.skySwitch.toX,
          this.skySwitch.toZ
        );
        camera.position.set(
          this.skySwitch.toX,
          THREE.MathUtils.lerp(66, targetGroundY + 4.2, t3),
          this.skySwitch.toZ + THREE.MathUtils.lerp(8, 9.2, t3)
        );
        camera.lookAt(this.skySwitch.toX, targetGroundY + 2.2, this.skySwitch.toZ);
      }

      if (progress >= 1) {
        this.skySwitch.active = false;
      }
    } else if (isCustomsOpen) {
      this.customsOrbitAngle += dt * 0.65;
      const focusVeh =
        activeVehicle ||
        this.traffic.vehicles.find((v) => v.type === 'supercar') ||
        this.traffic.vehicles[0];
      const vx = focusVeh ? focusVeh.x : this.playerPhys.x;
      const vy = focusVeh ? focusVeh.y : this.playerPhys.y;
      const vz = focusVeh ? focusVeh.z : this.playerPhys.z;
      camera.position.set(
        vx + Math.cos(this.customsOrbitAngle) * 7.2,
        vy + 2.6,
        vz + Math.sin(this.customsOrbitAngle) * 7.2
      );
      camera.lookAt(vx, vy + 0.9, vz);
    } else {
      if (
        isDriving &&
        activeVehicle &&
        !this.isOrbitDragging &&
        !this.rightMouseHeld &&
        this.userOrbitTimer <= 0 &&
        Math.abs(activeVehicle.speed) > 1.8
      ) {
        const diff =
          ((activeVehicle.heading - this.camYaw + Math.PI * 3) %
            (Math.PI * 2)) -
          Math.PI;
        this.camYaw += diff * (1 - Math.exp(-3.4 * dt));
      }

      const baseElevY = activeVehicle ? activeVehicle.y : this.playerPhys.y;
      const orbitFwdX = Math.sin(this.camYaw);
      const orbitFwdZ = Math.cos(this.camYaw);
      const orbitRightX = -Math.cos(this.camYaw);
      const orbitRightZ = Math.sin(this.camYaw);

      const camDist = isTpsAim
        ? 4.4
        : isDriving
        ? 12.2 + speedRatio * 1.4
        : 9.8;
      const horizDist = camDist * Math.cos(this.camPitch);
      const vertOffset = camDist * Math.sin(this.camPitch);

      let desiredX = this.playerPhys.x - orbitFwdX * horizDist;
      let desiredZ = this.playerPhys.z - orbitFwdZ * horizDist;
      let desiredY = baseElevY + (isTpsAim ? 1.55 : 1.75) + vertOffset;

      if (isTpsAim) {
        desiredX += orbitRightX * 1.1;
        desiredZ += orbitRightZ * 1.1;
      }

      const dampFactor =
        Math.abs(camera.position.y - desiredY) > 25
          ? 1
          : 1 - Math.exp(-(isTpsAim ? 14 : 9.5) * dt);
      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        desiredX,
        dampFactor
      );
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        desiredY,
        dampFactor
      );
      camera.position.z = THREE.MathUtils.lerp(
        camera.position.z,
        desiredZ,
        dampFactor
      );

      if (this.cameraTrauma > 0) {
        const shake = this.cameraTrauma * this.cameraTrauma * 0.38;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
      }

      const lookDist = isTpsAim ? 14 : 5.2;
      const lookPitchShift = (0.28 - this.camPitch) * (isTpsAim ? 9.5 : 4.5);
      this._v2.set(
        this.playerPhys.x + orbitFwdX * lookDist,
        baseElevY + (isTpsAim ? 1.7 : 2.15) + lookPitchShift,
        this.playerPhys.z + orbitFwdZ * lookDist
      );
      camera.lookAt(this._v2);
    }

    return {
      nearbyInterior,
      nearbyMission,
      activeVehicle,
      spottedByPolice,
    };
  }

  public stepTitleOrbitCamera(
    dt: number,
    camera: THREE.PerspectiveCamera
  ): void {
    this.tourElapsed += dt;
    const orbitAngle = this.tourElapsed * 0.22;
    const camX = Math.sin(orbitAngle) * 46;
    const camZ = Math.cos(orbitAngle) * 46;
    camera.position.set(
      camX,
      20 + Math.sin(this.tourElapsed * 0.5) * 2.5,
      camZ
    );
    camera.lookAt(0, 16.5, 0);
  }

  public writeRadarEnemies(out: RadarEnemyBlip[]): void {
    out.length = this.enemies.length;
    for (let i = 0; i < this.enemies.length; i++) {
      const en = this.enemies[i];
      const alive = en.state === 'alive';
      if (!out[i]) {
        out[i] = { x: en.x, z: en.z, alive };
      } else {
        out[i].x = en.x;
        out[i].z = en.z;
        out[i].alive = alive;
      }
    }
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.particleGeo.dispose();
    this.particleMat.dispose();
  }
}

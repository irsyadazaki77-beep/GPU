import * as THREE from 'three';
import {
  BuildingFootprint,
  CITY_BUILDINGS,
  ENEMY_ARCHETYPES,
  ENTERABLE_INTERIORS,
  EnemyBehaviorPolicy,
  EnterableInteriorSpec,
  HEIST_PROTAGONIST_ROLES,
  NABILO_OUTFITS,
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  ProtagonistId,
  STORY_MISSIONS,
  SpatialHashGrid,
  StoryChoiceOption,
  StoryMission,
  StuntRampSpec,
  VEHICLE_SPECS,
  WARUNG_STALL_LOCATIONS,
  WEAPON_MAGAZINE_SIZES,
  WEAPON_RELOAD_SEC,
  applyCoverDamageMitigation,
  checkPlayerDetourProgress,
  computeDriftCounterSteerBoost,
  computeHeadshotResolution,
  computeNearMissBonus,
  computeSpeedSensitiveTurnRate,
  computeVehicleArmorMitigation,
  evaluateCoverAvailability,
  evaluateFloodZoneAt,
  evaluateRoadEventImpactAt,
  evaluateStuntRampContact,
  getActiveWingmanIds,
  getEffectiveWeaponSpec,
  getGroundElevationAt,
  getPlayerStaminaSpeedMultiplier,
  getVehicleHandlingPenalty,
  resolveCameraWallPullIn,
  resolveCircleAABBCollision,
  scoreStuntJump,
  stepEnemyMovementPolicy,
  stepVehicleLongitudinalSpeed,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import {
  INTERIOR_ROOM_CENTERS,
  animateCharacterRig,
  buildCharacterRig,
  buildCombatDroneMesh,
  syncCharacterWeaponVisual,
} from '../game/world/geometryBuilders';
import type {
  CombatHitFeedbackEvent,
  TrafficSignalPhase,
  WeaponId,
} from '../game/types';
import {
  engineTelemetryRef,
  gameStore,
  virtualInputRef,
  type RadarEnemyBlip,
} from '../state/gameStore';
import { TrafficSystem, VehicleEntity } from './TrafficSystem';
import { cityAudio } from './CityAudio';
import { ParticleEffectsPool } from './player/ParticleEffectsPool';
import {
  canTriggerHorn,
  computeChaseCameraFov,
  computeOffRoadMicroShake,
  computeStaggeredCrewPosition,
  exponentialDampFactor,
} from './visualOverhaulMath';

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
  staggerTimer?: number;
  staggerType?: 'head' | 'chest' | 'leg';
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
  onCombatHitFeedback?: (evt: CombatHitFeedbackEvent) => void;
  onPlayerHitAngle?: (angleRad: number) => void;
  onWeaponNoise?: (x: number, z: number, radius: number, isBlast: boolean) => void;
  onHornTriggered?: (px: number, py: number, pz: number) => void;
  onViralMoment?: (
    kind: 'drift_stunt' | 'chain_explosion',
    summaryNote?: string
  ) => void;
  onCheckBarrelShot?: (
    originX: number,
    originZ: number,
    dirX: number,
    dirZ: number,
    range: number
  ) => { x: number; y: number; z: number } | null;
  onExplosionShockwaveProps?: (blastX: number, blastZ: number, radius: number) => void;
}

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
  public readonly waypointBeaconGroup: THREE.Group;
  public readonly droneMesh: THREE.Group;
  public readonly muzzleFlashLight: THREE.PointLight;
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

  public readonly cutsceneDirector = {
    active: false,
    focusX: 0,
    focusZ: 26,
    elapsed: 0,
    duration: 3.5,
  };

  public objectiveProgress = 0;
  private checkpointStage = 0;
  private droneFireCooldown = 0.5;
  private hitstopTimer = 0;
  private cameraTrauma = 0;
  private damagePulse = 0;
  private muzzleLightTimer = 0;
  private tourElapsed = 0;
  private customsOrbitAngle = 0;
  private prevGamepadBtns: boolean[] = [];
  private sirenSoundCooldown = 0;
  private camYaw = Math.PI;
  private camPitch = 0.28;
  private userOrbitTimer = 0;
  private skidSpawnAccum = 0;
  private driftChainScore = 0;
  private driftChainTimer = 0;
  private cameraNeedsSnap = true;
  private camLookInitialized = false;
  private lastHornMs = -9999;
  private exhaustPuffAccum = 0;
  private lastAppliedOutfitId = '';
  private lastWeaponVisualKey = '';
  private lastNearMissMs = -9999;
  private comboExpireAccum = 0;
  private beaconOuterRing!: THREE.Mesh;
  private beaconChevron!: THREE.Mesh;
  private readonly aimLaserLine: THREE.Line;
  private readonly aimLaserDot: THREE.Mesh;

  // Wave 2: Tactical Gunplay, Cover, Trio Squad AI, Stunt Physics, Kill-Cam & Turf War
  private crosshairSpread = 0;
  private killCamTimer = 0;
  private floodSplashAccum = 0;
  private coverNormalX = 0;
  private coverNormalZ = 1;
  private readonly turfWarEnemyIds = new Set<string>();
  private captainEnemyId: string | null = null;
  private readonly stuntJump = {
    airborne: false,
    ramp: null as StuntRampSpec | null,
    launchX: 0,
    launchZ: 0,
    airTime: 0,
    vy: 0,
    slowMoTimer: 0,
  };
  private readonly trioSquadRuntime: Record<
    ProtagonistId,
    {
      x: number;
      z: number;
      facing: number;
      walkDist: number;
      fireCooldown: number;
      abilityCooldown: number;
      actionLabel: string;
    }
  > = {
    nabilo: {
      x: -1.75,
      z: 27.95,
      facing: Math.PI,
      walkDist: 0,
      fireCooldown: 0.4,
      abilityCooldown: 4,
      actionLabel: 'Mengawal',
    },
    raka: {
      x: 1.65,
      z: 27.95,
      facing: Math.PI,
      walkDist: 0,
      fireCooldown: 0.5,
      abilityCooldown: 5,
      actionLabel: 'Mengawal',
    },
    kirana: {
      x: -1.9,
      z: 28.45,
      facing: Math.PI,
      walkDist: 0,
      fireCooldown: 0.6,
      abilityCooldown: 6,
      actionLabel: 'Siap EMP',
    },
  };

  private readonly fxPool: ParticleEffectsPool;

  private readonly _v1 = new THREE.Vector3();
  private readonly _v2 = new THREE.Vector3();
  private readonly _camLookTarget = new THREE.Vector3();
  private readonly _scale = new THREE.Vector3();
  private readonly _quat = new THREE.Quaternion();
  private readonly _euler = new THREE.Euler();
  private readonly _mat4 = new THREE.Matrix4();
  private readonly _color = new THREE.Color();

  private readonly keysHeld = new Set<string>();
  private readonly keysJustPressed = new Set<string>();
  private mouseJustClicked = false;
  private leftMouseHeld = false;
  private rightMouseHeld = false;
  private isOrbitDragging = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private dragDistance = 0;
  private clipAmmo: Partial<Record<WeaponId, number>> = {
    pistol: 12,
    rifle: 30,
    mercon: 1,
    pasopati: 20,
    gatotkaca: 1,
  };
  private reloadTimer = 0;
  private meleeComboStep = 0;

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

    // 1. Grounded GTA-Style Mission Corona Marker (low profile, clean unobstructed skyline)
    this.beaconGroup = new THREE.Group();
    const beaconCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.55, 2.2, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    beaconCyl.position.y = 1.12;
    this.beaconGroup.add(beaconCyl);

    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(1.35, 1.65, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beaconRing.position.y = 0.08;
    this.beaconGroup.add(beaconRing);

    this.beaconOuterRing = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.05, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.beaconOuterRing.position.y = 0.09;
    this.beaconGroup.add(this.beaconOuterRing);

    this.beaconChevron = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        transparent: true,
        opacity: 0.65,
      })
    );
    this.beaconChevron.position.y = 2.6;
    this.beaconGroup.add(this.beaconChevron);
    scene.add(this.beaconGroup);

    // 1b. Grounded Custom GPS Waypoint Corona
    this.waypointBeaconGroup = new THREE.Group();
    const wpCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.35, 1.8, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    wpCyl.position.y = 0.92;
    this.waypointBeaconGroup.add(wpCyl);

    const wpRing = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.5, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    wpRing.position.y = 0.08;
    this.waypointBeaconGroup.add(wpRing);
    this.waypointBeaconGroup.visible = false;
    scene.add(this.waypointBeaconGroup);

    // 2. Pooled Particles, Bullet Tracers, Skidmarks, Shockwaves & Laser Sight
    this.fxPool = new ParticleEffectsPool(scene);

    const laserPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1)];
    const laserGeo = new THREE.BufferGeometry().setFromPoints(laserPts);
    const laserMat = new THREE.LineBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.72,
    });
    this.aimLaserLine = new THREE.Line(laserGeo, laserMat);
    this.aimLaserLine.visible = false;
    this.aimLaserLine.frustumCulled = false;
    scene.add(this.aimLaserLine);

    this.aimLaserDot = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xf87171,
        transparent: true,
        opacity: 0.9,
      })
    );
    this.aimLaserDot.visible = false;
    scene.add(this.aimLaserDot);

    // 2b. Muzzle Flash PointLight
    this.muzzleFlashLight = new THREE.PointLight(0xfbbf24, 0, 14, 1.8);
    scene.add(this.muzzleFlashLight);

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

    // 4. Crew & Rajawali Drone (Spawn in Staggered V-Formation behind player)
    this.crewCompanions = [0, 1, 2].map((idx) => {
      const rig = buildCharacterRig('crew');
      rig.group.visible = false;
      const slotPos = computeStaggeredCrewPosition(
        this.playerPhys.x,
        this.playerPhys.z,
        this.playerPhys.facing,
        idx + 2
      );
      rig.group.position.set(slotPos.x, 0, slotPos.z);
      scene.add(rig.group);
      return {
        rig,
        x: slotPos.x,
        z: slotPos.z,
        facing: this.playerPhys.facing,
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
    this.leftMouseHeld = false;
    this.rightMouseHeld = false;
    this.isOrbitDragging = false;
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.target !== this.domElement) return;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    if (e.button === 0) {
      this.leftMouseHeld = true;
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
    if (this.callbacks.getWheelSlowMo()) {
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

    if (this.callbacks.getCustomsOpen()) {
      this.customsOrbitAngle += dx * 0.008;
      return;
    }

    this.camYaw -= dx * 0.0055;
    this.camPitch = THREE.MathUtils.clamp(
      this.camPitch + dy * 0.004,
      0.08,
      0.92
    );
    this.userOrbitTimer = 2.0;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.button === 0) {
      this.leftMouseHeld = false;
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
    this.fxPool.spawnParticles(x, y, z, count, colorHex, speed);
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
    this.fxPool.spawnTracer(fromX, fromY, fromZ, toX, toY, toZ, colorHex);
  }

  public spawnShockwave(
    x: number,
    y: number,
    z: number,
    maxScale: number = 10,
    colorHex: number = 0xf97316,
    durationSec: number = 0.45
  ): void {
    this.fxPool.spawnShockwave(x, y, z, maxScale, colorHex, durationSec);
  }

  public triggerFlashLight(
    x: number,
    y: number,
    z: number,
    colorHex: number = 0xf97316,
    intensity: number = 12
  ): void {
    this.fxPool.triggerFlashLight(x, y, z, colorHex, intensity);
  }

  public detonateExplosionAt(
    bx: number,
    by: number,
    bz: number,
    radius: number = 11,
    colorHex: number = 0xf97316
  ): void {
    this.spawnParticles(bx, by + 1.1, bz, 30, colorHex, 14);
    this.spawnParticles(bx, by + 1.6, bz, 16, 0xfef08a, 10);
    this.spawnShockwave(bx, by, bz, radius, colorHex, 0.5);
    this.triggerFlashLight(bx, by + 2.2, bz, colorHex, 15);
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
    soundEngine.playPropCrash(0);
    this.callbacks.onWeaponNoise?.(bx, bz, radius * 2.2, true);
    this.callbacks.onExplosionShockwaveProps?.(bx, bz, radius);

    const activeChoice = this.callbacks.getActiveChoice();
    for (const en of this.enemies) {
      if (en.state !== 'alive') continue;
      const d = Math.hypot(en.x - bx, en.z - bz);
      if (d <= radius) {
        const dealt = Math.round(85 * (1 - d / (radius * 1.35)));
        en.hp -= dealt;
        en.hitFlashTimer = 0.09;
        const ang = Math.atan2(en.x - bx, en.z - bz);
        en.vx += Math.sin(ang) * 14;
        en.vz += Math.cos(ang) * 14;
        if (en.hp <= 0) {
          this.markEnemyKo(en, activeChoice);
        }
      }
    }
    const dPlayer = Math.hypot(this.playerPhys.x - bx, this.playerPhys.z - bz);
    if (dPlayer <= radius && !this.playerPhys.drivingVehicleId) {
      const pDmg = Math.max(8, Math.round(45 * (1 - dPlayer / (radius * 1.2))));
      this.callbacks.onPlayerDamage(pDmg);
      const hitAngle =
        Math.atan2(bx - this.playerPhys.x, bz - this.playerPhys.z) - this.camYaw;
      this.callbacks.onPlayerHitAngle?.(hitAngle);
      this.damagePulse = 1.0;
    }
    for (const veh of this.traffic.vehicles) {
      if (veh.damage.exploded) continue;
      const d = Math.hypot(veh.x - bx, veh.z - bz);
      if (d <= radius) {
        this.traffic.applyVehicleImpact(veh, Math.max(8, (radius - d) * 1.4), 'front');
      }
    }
  }

  private dropSkidmarkPair(
    cx: number,
    cy: number,
    cz: number,
    heading: number
  ): void {
    this.fxPool.dropSkidmarkPair(cx, cy, cz, heading);
  }

  public startCutsceneFraming(focusX: number, focusZ: number, duration: number = 3.2): void {
    this.cutsceneDirector.active = true;
    this.cutsceneDirector.focusX = focusX;
    this.cutsceneDirector.focusZ = focusZ;
    this.cutsceneDirector.elapsed = 0;
    this.cutsceneDirector.duration = duration;
  }

  public stopCutsceneFraming(): void {
    this.cutsceneDirector.active = false;
  }

  public getDamagePulse(): number {
    return this.damagePulse;
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
      const safePos = resolveCircleAABBCollision(
        centerX + Math.cos(ang) * 6.5,
        centerZ + Math.sin(ang) * 6.5,
        0.9,
        undefined,
        this.buildingGrid
      );
      const ex = safePos.x;
      const ez = safePos.z;
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

  public spawnTurfWarWave(
    centerX: number,
    centerZ: number,
    wave: 1 | 2 | 3
  ): void {
    this.clearTurfWarEnemies();
    const count = wave === 2 ? 5 : 4;
    const policies: EnemyBehaviorPolicy[] = [
      'rusher',
      'ranged_kiter',
      'charger_enforcer',
    ];
    for (let i = 0; i < count; i++) {
      const isCaptain = wave === 3 && i === count - 1;
      const policy: EnemyBehaviorPolicy = isCaptain
        ? 'charger_enforcer'
        : policies[(i + wave) % policies.length];
      const spec = ENEMY_ARCHETYPES[policy];
      const rig = buildCharacterRig(policy);
      const ang = (i / count) * Math.PI * 2 + wave * 0.4;
      const radius = isCaptain ? 5.2 : 9.5;
      const safePos = resolveCircleAABBCollision(
        centerX + Math.cos(ang) * radius,
        centerZ + Math.sin(ang) * radius,
        0.95,
        undefined,
        this.buildingGrid
      );
      const ex = safePos.x;
      const ez = safePos.z;
      rig.group.position.set(ex, getGroundElevationAt(ex, ez), ez);
      if (isCaptain) {
        rig.group.scale.setScalar(1.24);
        const rMat = rig.telegraphRing.material as THREE.MeshBasicMaterial;
        rMat.color.setHex(0xf59e0b);
      }
      this.scene.add(rig.group);
      const id = `turf_w${wave}_${Date.now()}_${i}`;
      const maxHp = isCaptain ? Math.round(spec.maxHp * 2.5) : Math.round(spec.maxHp * (1 + (wave - 1) * 0.18));
      this.turfWarEnemyIds.add(id);
      if (isCaptain) {
        this.captainEnemyId = id;
      }
      this.enemies.push({
        id,
        policy,
        rig,
        x: ex,
        z: ez,
        vx: 0,
        vz: 0,
        facing: 0,
        hp: maxHp,
        maxHp,
        state: 'alive',
        koTimer: 0,
        hitFlashTimer: 0,
        windupTimer: 0,
        cooldownTimer: 0.45 + i * 0.2,
        phaseTimer: i * 0.9,
      });
    }
    this.spawnParticles(centerX, getGroundElevationAt(centerX, centerZ) + 1.8, centerZ, 22, 0xef4444, 9);
  }

  public clearTurfWarEnemies(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.turfWarEnemyIds.has(this.enemies[i].id)) {
        this.scene.remove(this.enemies[i].rig.group);
        this.enemies.splice(i, 1);
      }
    }
    this.turfWarEnemyIds.clear();
    this.captainEnemyId = null;
  }

  public getRemainingTurfWarEnemyCount(): {
    remaining: number;
    captainAlive: boolean;
  } {
    let remaining = 0;
    let captainAlive = false;
    for (let i = 0; i < this.enemies.length; i++) {
      const en = this.enemies[i];
      if (en.state === 'alive' && this.turfWarEnemyIds.has(en.id)) {
        remaining++;
        if (en.id === this.captainEnemyId) captainAlive = true;
      }
    }
    return { remaining, captainAlive };
  }

  public toggleCover(): void {
    if (this.playerPhys.drivingVehicleId) {
      gameStore.setCoverState(false, 'none');
      return;
    }
    const store = gameStore.getState();
    if (store.inCover) {
      gameStore.setCoverState(false, 'none');
      soundEngine.playTone(190, 0.06, 'sine', 0.08);
      return;
    }
    const avail = evaluateCoverAvailability(
      this.playerPhys.x,
      this.playerPhys.z,
      CITY_BUILDINGS,
      this.traffic.vehicles
    );
    const kind = avail.canTakeCover ? avail.coverKind : 'barrier';
    this.coverNormalX = avail.normalX;
    this.coverNormalZ = avail.normalZ;
    gameStore.setCoverState(true, kind);
    soundEngine.playTone(260, 0.08, 'triangle', 0.11, 0.85);
    this.spawnParticles(
      this.playerPhys.x,
      this.playerPhys.y + 0.5,
      this.playerPhys.z,
      6,
      0x94a3b8,
      3.5
    );
  }

  public triggerHorn(): void {
    const now = performance.now();
    if (!canTriggerHorn(now, this.lastHornMs)) return;
    this.lastHornMs = now;
    cityAudio.playHorn();
    if (this.callbacks.onHornTriggered) {
      this.callbacks.onHornTriggered(
        this.playerPhys.x,
        this.playerPhys.y,
        this.playerPhys.z
      );
    } else {
      this.traffic.notifyHorn(this.playerPhys.x, this.playerPhys.z);
    }
  }

  public toggleEnterExitVehicle(): void {
    if (this.playerPhys.drivingVehicleId) {
      const v = this.traffic.vehicles.find(
        (item) => item.id === this.playerPhys.drivingVehicleId
      );
      this.playerPhys.drivingVehicleId = null;
      if (v) {
        const wasHighSpeedBail =
          !VEHICLE_SPECS[v.type].isAircraft && Math.abs(v.speed) > 10;
        const gY = getGroundElevationAt(v.x, v.z);
        v.y = gY;
        v.mesh.position.y = gY;
        v.mesh.rotation.z = 0;
        v.isBraking = false;
        this.playerPhys.x = v.x + Math.cos(v.heading) * 2.5;
        this.playerPhys.z = v.z - Math.sin(v.heading) * 2.5;
        this.playerPhys.y = getGroundElevationAt(
          this.playerPhys.x,
          this.playerPhys.z
        );
        if (wasHighSpeedBail) {
          // GTA high-speed bail-out: tumble roll sideways while car coasts forward with momentum
          this.playerPhys.combatRollTimer = 0.55;
          this.playerPhys.vx = Math.sin(v.heading) * v.speed * 0.45 + Math.cos(v.heading) * 4.5;
          this.playerPhys.vz = Math.cos(v.heading) * v.speed * 0.45 - Math.sin(v.heading) * 4.5;
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
          this.callbacks.onPlayerDamage(6);
          soundEngine.playHit(false);
        }
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
      const wasOccupiedTraffic = nearest.isTraffic;
      nearest.isTraffic = false;
      this.playerPhys.drivingVehicleId = nearest.id;
      this.playerRig.group.visible = false;
      gameStore.setCoverState(false, 'none');
      soundEngine.playVehicleDoor();
      if (wasOccupiedTraffic) {
        this.callbacks.onWeaponNoise?.(nearest.x, nearest.z, 18, false);
        gameStore.setState({
          lastOutcomeText: `Pembajakan ${VEHICLE_SPECS[nearest.type].name}! Warga sekitar panik melapor!`,
        });
      }
    }
  }

  public startMissionObjective(
    choiceOrMission: StoryChoiceOption | StoryMission,
    maybeChoice?: StoryChoiceOption
  ): void {
    const choice = maybeChoice || (choiceOrMission as StoryChoiceOption);
    const mission = maybeChoice ? (choiceOrMission as StoryMission) : undefined;
    this.objectiveProgress = 0;
    this.checkpointStage = 0;
    while (this.enemies.length > 0) {
      const old = this.enemies.pop()!;
      this.scene.remove(old.rig.group);
    }
    if (mission) {
      const qState = gameStore.startQuest(mission, choice);
      const stage0 = qState.stages[0];
      if (stage0) {
        choice.targetX = stage0.targetX;
        choice.targetZ = stage0.targetZ;
      }
    } else {
      if (choice.objectiveType === 'combat_wave') {
        this.spawnEnemyGroup(
          choice.targetX,
          choice.targetZ,
          choice.objectiveTargetCount
        );
      } else if (choice.objectiveType === 'heist_escape') {
        this.spawnEnemyGroup(choice.targetX, choice.targetZ, 3);
      }
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
    this.cameraNeedsSnap = true;
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
    this.cameraNeedsSnap = true;
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
    this.cameraNeedsSnap = true;
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

  private triggerPlayerAttack(isDriveBy: boolean = false): void {
    const pState = this.callbacks.getPlayerState();
    const effectiveWeaponId =
      isDriveBy && (pState.activeWeapon === 'fist' || pState.activeWeapon === 'golok')
        ? pState.unlockedWeapons.includes('rifle')
          ? 'rifle'
          : pState.unlockedWeapons.includes('pistol')
          ? 'pistol'
          : pState.activeWeapon
        : pState.activeWeapon;
    const wSpec = getEffectiveWeaponSpec(effectiveWeaponId, pState);
    if (isDriveBy && wSpec.isMelee) return;
    if (this.playerPhys.attackCooldown > 0 || this.reloadTimer > 0) return;

    if (!wSpec.isMelee) {
      const magSize = WEAPON_MAGAZINE_SIZES[wSpec.id] || 12;
      const curClip = this.clipAmmo[wSpec.id] ?? magSize;
      if (curClip <= 0) {
        this.reloadTimer = WEAPON_RELOAD_SEC[wSpec.id] || 1.2;
        this.clipAmmo[wSpec.id] = magSize;
        soundEngine.playTone(210, 0.08, 'triangle', 0.1, 1.35);
        return;
      }
      const hasAmmo = this.callbacks.onConsumeAmmo();
      if (!hasAmmo) {
        soundEngine.playTone(150, 0.06, 'sine', 0.1);
        this.playerPhys.attackCooldown = 0.25;
        return;
      }
      const nextClip = curClip - 1;
      this.clipAmmo[wSpec.id] = nextClip;
      if (nextClip <= 0 && (pState.ammo[wSpec.id] || 0) > 1) {
        this.reloadTimer = WEAPON_RELOAD_SEC[wSpec.id] || 1.2;
        this.clipAmmo[wSpec.id] = magSize;
      }
    } else {
      // 3-Hit GTA Melee Combo with subtle forward step lunge
      this.meleeComboStep = (this.meleeComboStep + 1) % 3;
      const lungeSpeed = this.meleeComboStep === 2 ? 7.5 : 4.2;
      this.playerPhys.vx += Math.sin(this.playerPhys.facing) * lungeSpeed;
      this.playerPhys.vz += Math.cos(this.playerPhys.facing) * lungeSpeed;
    }

    this.playerPhys.attackCooldown = wSpec.cooldown;
    this.crosshairSpread = Math.min(
      1.0,
      this.crosshairSpread + (wSpec.isMelee ? 0.1 : 0.25)
    );
    soundEngine.playShoot(wSpec.id);
    if (!wSpec.isMelee) {
      const recoilPitch =
        wSpec.id === 'mercon' || wSpec.id === 'gatotkaca' ? 0.026 : 0.013;
      this.camPitch = Math.max(0.04, this.camPitch - recoilPitch);
    }
    if (wSpec.isMelee && this.meleeComboStep === 1) {
      this.playerRig.leftArm.rotation.x = -Math.PI * 0.72;
    } else {
      this.playerRig.rightArm.rotation.x = -Math.PI * 0.75;
    }

    const aimYaw = isDriveBy ? this.camYaw : this.playerPhys.facing;
    const fwdX = Math.sin(aimYaw);
    const fwdZ = Math.cos(aimYaw);
    const muzzleX = this.playerPhys.x + fwdX * (isDriveBy ? 1.6 : 1.1);
    const muzzleY = this.playerPhys.y + (isDriveBy ? 1.35 : 1.25);
    const muzzleZ = this.playerPhys.z + fwdZ * (isDriveBy ? 1.6 : 1.1);

    if (!wSpec.isMelee) {
      this.muzzleFlashLight.position.set(muzzleX, muzzleY + 0.15, muzzleZ);
      this.muzzleFlashLight.color.setHex(
        wSpec.id === 'pasopati' || wSpec.id === 'gatotkaca'
          ? 0x38bdf8
          : wSpec.silent
          ? 0x10b981
          : 0xfbbf24
      );
      this.muzzleFlashLight.intensity = wSpec.silent ? 2.5 : 6.5;
      this.muzzleLightTimer = 0.065;
      this.callbacks.onWeaponNoise?.(
        this.playerPhys.x,
        this.playerPhys.z,
        wSpec.splashRadius > 0 ? 28 : wSpec.silent ? 6.5 : 20,
        wSpec.splashRadius > 0
      );
    }

    this.spawnParticles(
      muzzleX,
      muzzleY,
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

      this.spawnTracer(
        muzzleX,
        muzzleY,
        muzzleZ,
        blastX,
        this.playerPhys.y + 1.2,
        blastZ,
        wSpec.id === 'pasopati' ? 0x38bdf8 : 0xf97316
      );
      this.callbacks.onWeaponNoise?.(blastX, blastZ, wSpec.splashRadius * 2.2, true);

      this.spawnParticles(
        blastX,
        this.playerPhys.y + 1.5,
        blastZ,
        28,
        wSpec.id === 'pasopati' ? 0x38bdf8 : 0xf97316,
        13
      );
      this.spawnShockwave(
        blastX,
        this.playerPhys.y,
        blastZ,
        wSpec.splashRadius * 1.45,
        wSpec.id === 'pasopati' ? 0x38bdf8 : 0xf97316,
        0.46
      );
      this.triggerFlashLight(
        blastX,
        this.playerPhys.y + 2.0,
        blastZ,
        wSpec.id === 'pasopati' ? 0x38bdf8 : 0xf97316,
        13
      );
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.65);

      for (const en of this.enemies) {
        if (en.state !== 'alive') continue;
        const d = Math.hypot(en.x - blastX, en.z - blastZ);
        if (d <= wSpec.splashRadius) {
          const dmgMult = pState.fokusActive ? 1.75 : 1.0;
          const dealtDmg = Math.round(wSpec.damage * dmgMult);
          en.hp -= dealtDmg;
          en.hitFlashTimer = 0.08;
          const pushAng = Math.atan2(en.x - blastX, en.z - blastZ);
          en.vx += Math.sin(pushAng) * 12;
          en.vz += Math.cos(pushAng) * 12;
          hitAny = true;

          const ko = en.hp <= 0;
          const isCrit = pState.fokusActive || wSpec.id === 'gatotkaca';
          this.callbacks.onCombatHitFeedback?.({
            id: Math.floor(performance.now() * 1000) + Math.floor(Math.random() * 999),
            damage: dealtDmg,
            isCrit,
            isKo: ko,
            label: ko ? 'K.O!' : isCrit ? 'KRITIS!' : `${dealtDmg}`,
            screenX: 46 + Math.random() * 8,
            screenY: 36 + Math.random() * 7,
          });

          if (ko) {
            this.markEnemyKo(en, activeChoice);
          }
        }
      }
      return;
    }

    let tracerEndX = muzzleX + fwdX * Math.min(26, wSpec.range);
    let tracerEndZ = muzzleZ + fwdZ * Math.min(26, wSpec.range);

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
        let dealtDmg = Math.round(wSpec.damage * dmgMult);
        const isTpsAim = this.callbacks.getTpsAiming() || this.rightMouseHeld;
        const isFirstPerson = gameStore.getState().cameraViewMode === 'first_person';
        const headshotRes = computeHeadshotResolution(
          isTpsAim,
          wSpec.id,
          pState.characterSkills?.aimPrecision ?? 1,
          isFirstPerson,
          dot
        );

        if (headshotRes.isHeadshot) {
          dealtDmg = Math.round(dealtDmg * headshotRes.damageMultiplier);
          en.staggerTimer = 0.45;
          en.staggerType = 'head';
          this.spawnParticles(en.x, 1.8, en.z, 16, 0xfacc15, 9);
          soundEngine.playTone(920, 0.08, 'triangle', 0.25, 2.8);
          if (pState.fokusEnergy < 100) {
            pState.fokusEnergy = Math.min(
              100,
              pState.fokusEnergy + headshotRes.focusBonus
            );
          }
        } else {
          en.staggerTimer = 0.28;
          en.staggerType = 'chest';
          this.spawnParticles(en.x, 1.2, en.z, 14, 0xef4444, 8);
        }

        en.hp -= dealtDmg;
        en.hitFlashTimer = 0.06;
        en.vx += dirX * (wSpec.isMelee ? 9.5 : 5.5);
        en.vz += dirZ * (wSpec.isMelee ? 9.5 : 5.5);
        hitAny = true;
        tracerEndX = en.x;
        tracerEndZ = en.z;

        const ko = en.hp <= 0;
        const isCrit =
          headshotRes.isHeadshot ||
          pState.fokusActive ||
          wSpec.id === 'pasopati' ||
          Math.random() < wSpec.critBonus;
        const critDmg =
          isCrit && !headshotRes.isHeadshot
            ? Math.round(dealtDmg * 1.25)
            : dealtDmg;
        if (isCrit && !headshotRes.isHeadshot && !ko) {
          en.hp -= critDmg - dealtDmg;
        }

        this.callbacks.onCombatHitFeedback?.({
          id:
            Math.floor(performance.now() * 1000) +
            Math.floor(Math.random() * 999),
          damage: critDmg,
          isCrit,
          isHeadshot: headshotRes.isHeadshot,
          isKo: en.hp <= 0,
          label:
            en.hp <= 0
              ? headshotRes.isHeadshot
                ? 'HEADSHOT K.O!'
                : 'K.O!'
              : headshotRes.isHeadshot
              ? 'HEADSHOT!'
              : isCrit
              ? 'KRITIS!'
              : `${critDmg}`,
          screenX: 46 + Math.random() * 8,
          screenY: 36 + Math.random() * 7,
        });

        if (ko) {
          this.markEnemyKo(en, activeChoice);
        } else {
          this.hitstopTimer = headshotRes.isHeadshot ? 0.065 : 0.042;
          this.cameraTrauma = Math.min(
            1,
            this.cameraTrauma + (headshotRes.isHeadshot ? 0.32 : 0.22)
          );
          if (!headshotRes.isHeadshot) {
            soundEngine.playHit(false);
          }
        }

        if (!wSpec.isMelee) break;
      }
    }

    if (!wSpec.isMelee) {
      // Allow bullets to damage NPC traffic & police vehicles (GTA-style vehicle shootouts!)
      for (const veh of this.traffic.vehicles) {
        if (veh.id === this.playerPhys.drivingVehicleId || veh.damage.exploded) {
          continue;
        }
        const vdx = veh.x - this.playerPhys.x;
        const vdz = veh.z - this.playerPhys.z;
        const vDist = Math.hypot(vdx, vdz);
        if (vDist > wSpec.range || vDist < 1.2) continue;
        const vDot = (vdx / vDist) * fwdX + (vdz / vDist) * fwdZ;
        if (vDot >= 0.88) {
          const vRes = this.traffic.applyVehicleImpact(
            veh,
            Math.max(4, wSpec.damage * 0.24),
            'front'
          );
          tracerEndX = veh.x;
          tracerEndZ = veh.z;
          hitAny = true;
          this.spawnParticles(veh.x, veh.y + 1.1, veh.z, 8, 0xfacc15, 7);
          if (vRes.justCaughtFire) {
            soundEngine.playPropCrash(0);
          }
          break;
        }
      }

      const barrelBlast = this.callbacks.onCheckBarrelShot?.(
        this.playerPhys.x,
        this.playerPhys.z,
        fwdX,
        fwdZ,
        wSpec.range
      );
      if (barrelBlast) {
        tracerEndX = barrelBlast.x;
        tracerEndZ = barrelBlast.z;
        hitAny = true;
        this.detonateExplosionAt(
          barrelBlast.x,
          barrelBlast.y,
          barrelBlast.z,
          11,
          0xf97316
        );
      }

      this.spawnTracer(
        muzzleX,
        muzzleY,
        muzzleZ,
        tracerEndX,
        this.playerPhys.y + 1.2,
        tracerEndZ,
        wSpec.id === 'pasopati' ? 0x38bdf8 : 0xfde047
      );
    }

    if (!hitAny && !wSpec.isMelee) {
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.08);
    }
  }

  private markEnemyKo(
    en: EnemyEntity,
    activeChoice: StoryChoiceOption | null,
    bySquad: boolean = false
  ): void {
    en.state = 'ko';
    en.koTimer = 0.42;
    this.hitstopTimer = 0.055;
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
    soundEngine.playHit(true);

    const isCaptain = en.id === this.captainEnemyId;
    if (isCaptain || en.policy === 'charger_enforcer') {
      this.killCamTimer = 0.65;
      gameStore.triggerKillCamBanner(
        isCaptain ? 'KAPTEN WILAYAH TUMBANG!' : 'TAKEDOWN SINEMATIK!'
      );
    }
    if (isCaptain) {
      this.captainEnemyId = null;
    }
    if (this.turfWarEnemyIds.has(en.id)) {
      this.turfWarEnemyIds.delete(en.id);
    }

    if (bySquad || gameStore.getState().inCover) {
      gameStore.recordDailyProgress('squad_takedown', 1);
    }

    const arch = ENEMY_ARCHETYPES[en.policy];
    this.callbacks.onEnemyDefeated(
      isCaptain ? arch.rewardRp * 3 : arch.rewardRp,
      isCaptain ? arch.scoreValue * 3 : arch.scoreValue
    );
    const comboRes = gameStore.registerCombatCombo(Date.now());
    if (comboRes.comboCount >= 2) {
      this.callbacks.onCombatHitFeedback?.({
        id: Math.floor(performance.now() * 1000) + 777,
        damage: comboRes.bonusRp,
        isCrit: true,
        isKo: true,
        label: `x${comboRes.comboCount} ${comboRes.tierLabel}`,
        screenX: 50,
        screenY: 28,
      });
    }

    const qState = gameStore.getState().activeQuestState;
    if (qState && !qState.isCompleted) {
      const curStage = qState.stages[qState.currentStageIndex];
      if (curStage && curStage.type === 'combat') {
        const adv = gameStore.advanceQuestStage(
          this.playerPhys.x,
          this.playerPhys.z,
          gameStore.getState().playerState.wantedLevel,
          1
        );
        if (adv?.advancedStage) {
          soundEngine.playTone(660, 0.16, 'triangle', 0.2, 1.8);
          if (adv.missionJustCompleted) {
            soundEngine.playMissionFanfare();
            this.callbacks.onCompleteActiveObjective();
          } else {
            const nextStage =
              adv.nextQuest.stages[adv.nextQuest.currentStageIndex];
            if (nextStage && activeChoice) {
              activeChoice.targetX = nextStage.targetX;
              activeChoice.targetZ = nextStage.targetZ;
              if (nextStage.type === 'escape') {
                gameStore.updatePlayerState((prev) => ({
                  ...prev,
                  wantedLevel: Math.max(1, activeChoice.wantedDelta || 2),
                }));
              }
            }
          }
          return;
        }
      }
    }

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
    if (
      this.lastAppliedOutfitId !== outfitSpec.id &&
      this.playerRig.group.userData.jacketMat
    ) {
      this.lastAppliedOutfitId = outfitSpec.id;
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

    const isGildedWeapon =
      pState.weaponAttachments?.[pState.activeWeapon]?.includes('gildedSkin') ??
      false;
    const weaponVisKey = `${pState.activeWeapon}|${isGildedWeapon ? '1' : '0'}`;
    if (this.lastWeaponVisualKey !== weaponVisKey) {
      this.lastWeaponVisualKey = weaponVisKey;
      syncCharacterWeaponVisual(this.playerRig, pState.activeWeapon, isGildedWeapon);
    }

    (['nabilo', 'raka', 'kirana'] as ProtagonistId[]).forEach((pId) => {
      const rig = this.idleProtagonistRigs[pId];
      if (
        pId === pState.activeProtagonist ||
        pState.currentInterior !== 'exterior' ||
        Boolean(this.playerPhys.drivingVehicleId)
      ) {
        rig.group.visible = false;
      } else {
        rig.group.visible = true;
        const rt = this.trioSquadRuntime[pId];
        rig.group.position.set(
          rt.x,
          getGroundElevationAt(rt.x, rt.z),
          rt.z
        );
        rig.group.rotation.y = rt.facing;
      }
    });

    const pRingMat = this.playerRig.telegraphRing
      .material as THREE.MeshBasicMaterial;
    if (pState.fokusActive) {
      pRingMat.opacity = 0.28 + Math.sin(nowMs * 0.01) * 0.1;
      this.playerRig.telegraphRing.scale.setScalar(
        1.04 + Math.sin(nowMs * 0.008) * 0.08
      );
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
    if (this.beaconGroup.visible) {
      const pulse = 1 + Math.sin(nowMs * 0.004) * 0.1;
      this.beaconOuterRing.scale.set(pulse, 1, pulse);
      this.beaconChevron.position.y = 2.6 + Math.sin(nowMs * 0.0045) * 0.24;
      this.beaconChevron.rotation.y -= dt * 1.8;
    }

    // Update Custom GPS Waypoint 3D Beacon & Detour / Contract progression
    const storeSnap = gameStore.getState();
    const wp = storeSnap.customWaypoint;
    const activeContract = storeSnap.activeContract;
    const activeRoadEvent = storeSnap.worldClockEventState.activeEvent;

    if (
      isPlaying &&
      activeRoadEvent &&
      !activeRoadEvent.detourCompleted &&
      pState.currentInterior === 'exterior'
    ) {
      const detourCheck = checkPlayerDetourProgress(
        activeRoadEvent,
        this.playerPhys.x,
        this.playerPhys.z
      );
      if (detourCheck.reachedWaypoint && detourCheck.updatedEvent) {
        const upEv = detourCheck.updatedEvent;
        if (detourCheck.completedDetour) {
          soundEngine.playMissionFanfare();
          this.spawnParticles(
            this.playerPhys.x,
            this.playerPhys.y + 1.5,
            this.playerPhys.z,
            24,
            0x22c55e,
            9
          );
          gameStore.recordCashTransaction(
            `Bonus Rute Alternatif: ${upEv.spec.corridorName}`,
            65000,
            'misi'
          );
          gameStore.updatePlayerState((prev) => ({
            ...prev,
            rupiah: prev.rupiah + 65000,
            score: prev.score + 250,
            bestScore: Math.max(prev.bestScore, prev.score + 250),
          }));
          gameStore.setState((prev) => ({
            worldClockEventState: {
              ...prev.worldClockEventState,
              activeEvent: upEv,
            },
            customWaypoint:
              prev.customWaypoint?.category === 'detour'
                ? null
                : prev.customWaypoint,
            lastOutcomeText: `Rute Alternatif Tuntas! Berhasil memutar menghindari ${upEv.spec.title} (+Rp 65.000)`,
          }));
        } else if (detourCheck.nextWaypoint) {
          soundEngine.playPickup();
          const nextPt = detourCheck.nextWaypoint;
          this.spawnParticles(
            this.playerPhys.x,
            this.playerPhys.y + 1.4,
            this.playerPhys.z,
            16,
            0x38bdf8,
            7
          );
          gameStore.setState((prev) => ({
            worldClockEventState: {
              ...prev.worldClockEventState,
              activeEvent: upEv,
            },
            customWaypoint:
              prev.customWaypoint?.category === 'detour' || !prev.customWaypoint
                ? {
                    x: nextPt[0],
                    z: nextPt[1],
                    label: `Rute Alternatif (${upEv.detourStageIndex + 1}/${upEv.spec.detourWaypoints.length}): ${upEv.spec.detourLabel}`,
                    category: 'detour',
                  }
                : prev.customWaypoint,
          }));
        }
      }
    }

    if (wp && pState.currentInterior === 'exterior') {
      const wpY = getGroundElevationAt(wp.x, wp.z);
      this.waypointBeaconGroup.position.set(wp.x, wpY, wp.z);
      this.waypointBeaconGroup.visible = true;
      this.waypointBeaconGroup.rotation.y -= dt * 1.8;

      if (isPlaying && wp.category !== 'detour') {
        const distWp = Math.hypot(
          this.playerPhys.x - wp.x,
          this.playerPhys.z - wp.z
        );
        if (distWp < 8.5) {
          this.spawnParticles(wp.x, wpY + 1.5, wp.z, 18, 0xc084fc, 8);
          if (
            activeContract &&
            Math.hypot(
              activeContract.targetX - wp.x,
              activeContract.targetZ - wp.z
            ) < 4
          ) {
            gameStore.completeStreetContract();
          } else {
            soundEngine.playPickup();
            gameStore.setState({
              customWaypoint: null,
              lastOutcomeText: `Tiba di Tujuan GPS: ${wp.label}`,
            });
          }
        }
      }
    } else {
      this.waypointBeaconGroup.visible = false;
    }

    return nextStoryMission;
  }

  public stepPlaying(
    dt: number,
    nowMs: number,
    camera: THREE.PerspectiveCamera,
    pState: PlayerProgressState,
    activeChoice: StoryChoiceOption | null,
    nextStoryMission: StoryMission | null,
    nightFactor: number,
    wetnessFactor: number = 0
  ): {
    nearbyInterior: EnterableInteriorSpec | null;
    nearbyMission: StoryMission | null;
    activeVehicle: VehicleEntity | null;
    spottedByPolice: boolean;
    signalPhase: TrafficSignalPhase;
    isDrifting: boolean;
    turnInput: number;
  } {
    this.damagePulse = Math.max(0, this.damagePulse - dt * 2.2);
    this.crosshairSpread = Math.max(0, this.crosshairSpread - dt * 1.65);
    engineTelemetryRef.crosshairSpread = this.crosshairSpread;
    if (this.killCamTimer > 0) {
      this.killCamTimer = Math.max(0, this.killCamTimer - dt);
    }
    if (this.stuntJump.slowMoTimer > 0) {
      this.stuntJump.slowMoTimer = Math.max(0, this.stuntJump.slowMoTimer - dt);
    }
    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
    }
    if (this.muzzleLightTimer > 0) {
      this.muzzleLightTimer = Math.max(0, this.muzzleLightTimer - dt);
      this.muzzleFlashLight.intensity =
        (this.muzzleLightTimer / 0.065) * 6.5;
    } else {
      this.muzzleFlashLight.intensity = 0;
    }
    // Authentic GTA Hold-RMB to enter over-the-shoulder TPS Aim cleanly on foot
    const isTpsAim =
      this.callbacks.getTpsAiming() ||
      (this.rightMouseHeld && !this.playerPhys.drivingVehicleId);
    const isWheelSlowMo = this.callbacks.getWheelSlowMo();
    const isCustomsOpen = this.callbacks.getCustomsOpen();

    const storeState = gameStore.getState();
    const isPhotoMode = storeState.photoModeOpen;
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    }
    const rawSimDt = this.hitstopTimer > 0 || isPhotoMode ? 0 : dt;
    const cineSlowMult =
      isWheelSlowMo
        ? 0.25
        : this.killCamTimer > 0
        ? 0.34
        : this.stuntJump.slowMoTimer > 0
        ? 0.52
        : 1.0;
    const simDt = rawSimDt * cineSlowMult;

    // Poll HTML5 Gamepad API (60Hz) and merge with Virtual Touch Input Ref
    let gpMoveX = 0;
    let gpMoveY = 0;
    let gpLookX = 0;
    let gpLookY = 0;
    let gpSprint = false;
    let gpFireHeld = false;
    let gpDriftHeld = false;

    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const pads = navigator.getGamepads();
      const pad = pads ? pads[0] || pads[1] || pads[2] || pads[3] : null;
      if (pad && pad.connected) {
        if (!virtualInputRef.gamepadConnected) {
          virtualInputRef.gamepadConnected = true;
          virtualInputRef.gamepadName = pad.id || 'Gamepad Controller';
          gameStore.setState({ gamepadActive: true });
        }
        const deadzone = (v: number) => (Math.abs(v) < 0.16 ? 0 : v);
        gpMoveX = deadzone(pad.axes[0] || 0);
        gpMoveY = -deadzone(pad.axes[1] || 0);
        gpLookX = deadzone(pad.axes[2] || 0);
        gpLookY = deadzone(pad.axes[3] || 0);

        const btnPressed = (idx: number) => Boolean(pad.buttons[idx]?.pressed);
        const btnJustPressed = (idx: number) =>
          btnPressed(idx) && !this.prevGamepadBtns[idx];

        const rtVal = pad.buttons[7]?.value || 0;
        const ltVal = pad.buttons[6]?.value || 0;
        if (this.playerPhys.drivingVehicleId) {
          if (rtVal > 0.12 || ltVal > 0.12) {
            gpMoveY = rtVal - ltVal;
          }
          gpDriftHeld = btnPressed(0) || btnPressed(5); // A / RB handbrake drift
        } else {
          gpFireHeld = rtVal > 0.35 || btnPressed(0);
          gpSprint = btnPressed(10) || btnPressed(1);
        }

        if (btnJustPressed(3)) {
          // Y / Triangle -> Enter/Exit Vehicle
          virtualInputRef.enterVehicleTap = true;
        }
        if (btnJustPressed(2)) {
          // X / Square -> Attack or Horn
          if (this.playerPhys.drivingVehicleId) {
            virtualInputRef.hornTap = true;
          } else {
            virtualInputRef.fireTap = true;
          }
        }
        if (btnJustPressed(4)) {
          // LB / L1 -> Toggle Fokus / Nitro
          virtualInputRef.fokusTap = true;
        }
        if (btnJustPressed(11)) {
          // R3 -> Toggle TPS Aim
          this.callbacks.onToggleTpsAim();
        }

        this.prevGamepadBtns = pad.buttons.map((b) => Boolean(b?.pressed));
      } else if (virtualInputRef.gamepadConnected) {
        virtualInputRef.gamepadConnected = false;
        gameStore.setState({ gamepadActive: false });
      }
    }

    // Apply virtual touch + gamepad camera look deltas
    if (
      Math.abs(virtualInputRef.lookDeltaX) > 0.001 ||
      Math.abs(virtualInputRef.lookDeltaY) > 0.001 ||
      Math.abs(gpLookX) > 0.01 ||
      Math.abs(gpLookY) > 0.01
    ) {
      const yawDelta =
        virtualInputRef.lookDeltaX * 0.0065 + gpLookX * 2.5 * dt;
      const pitchDelta =
        virtualInputRef.lookDeltaY * 0.0045 + gpLookY * 1.6 * dt;
      virtualInputRef.lookDeltaX = 0;
      virtualInputRef.lookDeltaY = 0;
      if (isCustomsOpen) {
        this.customsOrbitAngle += yawDelta;
      } else {
        this.camYaw -= yawDelta;
        this.camPitch = THREE.MathUtils.clamp(
          this.camPitch + pitchDelta,
          0.08,
          0.92
        );
        this.userOrbitTimer = 1.8;
      }
    }

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

    if (this.keysJustPressed.has('KeyF') || virtualInputRef.enterVehicleTap) {
      virtualInputRef.enterVehicleTap = false;
      this.toggleEnterExitVehicle();
    }
    if (this.keysJustPressed.has('KeyG')) {
      if (nearbyInterior || pState.currentInterior !== 'exterior') {
        this.callbacks.onEnterOrExitInterior(nearbyInterior);
      } else {
        this.toggleEnterExitVehicle();
      }
    }
    if (this.keysJustPressed.has('KeyX') || virtualInputRef.coverTap) {
      virtualInputRef.coverTap = false;
      this.toggleCover();
    }
    if (this.keysJustPressed.has('KeyV') || virtualInputRef.cameraTap) {
      virtualInputRef.cameraTap = false;
      gameStore.cycleCameraViewMode();
    }
    if (this.keysJustPressed.has('F1')) {
      gameStore.setSquadOrder('follow');
    } else if (this.keysJustPressed.has('F2')) {
      gameStore.setSquadOrder('attack');
    } else if (this.keysJustPressed.has('F3')) {
      gameStore.setSquadOrder('hold');
    }
    if (this.keysJustPressed.has('KeyR')) {
      if (this.playerPhys.drivingVehicleId) {
        gameStore.cycleRadioStation();
      } else if (this.reloadTimer <= 0) {
        const magSize = WEAPON_MAGAZINE_SIZES[pState.activeWeapon] || 0;
        const curClip = this.clipAmmo[pState.activeWeapon] ?? magSize;
        if (magSize > 0 && curClip < magSize && (pState.ammo[pState.activeWeapon] || 0) > 0) {
          this.reloadTimer = WEAPON_RELOAD_SEC[pState.activeWeapon] || 1.2;
          this.clipAmmo[pState.activeWeapon] = magSize;
          soundEngine.playTone(230, 0.09, 'triangle', 0.11, 1.35);
        }
      }
    }
    if (
      (this.keysJustPressed.has('AltLeft') ||
        this.keysJustPressed.has('ControlLeft') ||
        virtualInputRef.rollTap) &&
      !this.playerPhys.drivingVehicleId &&
      this.playerPhys.combatRollTimer <= 0
    ) {
      virtualInputRef.rollTap = false;
      this.playerPhys.combatRollTimer = 0.34;
      soundEngine.playTone(200, 0.1, 'triangle', 0.12, 1.35);
    }

    const autoFireHeld =
      this.leftMouseHeld &&
      (isTpsAim ||
        pState.activeWeapon === 'rifle' ||
        pState.activeWeapon === 'pasopati');

    if (
      this.keysJustPressed.has('KeyK') ||
      virtualInputRef.hornTap ||
      (this.keysJustPressed.has('KeyH') && Boolean(this.playerPhys.drivingVehicleId))
    ) {
      virtualInputRef.hornTap = false;
      if (this.playerPhys.drivingVehicleId) {
        this.triggerHorn();
      } else {
        this.triggerPlayerAttack();
      }
    } else if (
      this.keysJustPressed.has('Space') ||
      this.mouseJustClicked ||
      autoFireHeld ||
      virtualInputRef.fireTap ||
      virtualInputRef.fireHeld ||
      gpFireHeld
    ) {
      virtualInputRef.fireTap = false;
      if (!this.playerPhys.drivingVehicleId && !isPhotoMode) {
        this.triggerPlayerAttack(false);
      } else if (
        this.playerPhys.drivingVehicleId &&
        !isPhotoMode &&
        (this.mouseJustClicked || this.leftMouseHeld || virtualInputRef.fireHeld || gpFireHeld)
      ) {
        this.triggerPlayerAttack(true);
      } else if (
        this.keysJustPressed.has('Space') &&
        this.playerPhys.drivingVehicleId
      ) {
        const curVeh = this.traffic.vehicles.find(
          (v) => v.id === this.playerPhys.drivingVehicleId
        );
        if (curVeh && !VEHICLE_SPECS[curVeh.type].isAircraft && Math.abs(curVeh.speed) < 2.2) {
          this.triggerHorn();
        }
      }
    }

    let nearbyMission: StoryMission | null = null;
    if (!activeChoice && nextStoryMission) {
      nearbyMission = nextStoryMission;
      if (this.keysJustPressed.has('KeyE') || virtualInputRef.interactTap) {
        virtualInputRef.interactTap = false;
        this.callbacks.onOpenMissionDialog(nextStoryMission);
      }
    }
    virtualInputRef.interactTap = false;
    virtualInputRef.rollTap = false;

    this.keysJustPressed.clear();
    this.mouseJustClicked = false;

    const kbForward =
      (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp') ? 1 : 0) -
      (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown') ? 1 : 0);
    const kbTurn =
      (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft') ? 1 : 0) -
      (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight') ? 1 : 0);

    const moveForward = THREE.MathUtils.clamp(
      kbForward + virtualInputRef.moveY + gpMoveY,
      -1,
      1
    );
    const moveTurn = THREE.MathUtils.clamp(
      kbTurn - virtualInputRef.moveX - gpMoveX,
      -1,
      1
    );
    const sprinting =
      this.keysHeld.has('ShiftLeft') ||
      this.keysHeld.has('ShiftRight') ||
      virtualInputRef.sprintHeld ||
      gpSprint;

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
      const roomCenterX = INTERIOR_ROOM_CENTERS[pState.currentInterior] ?? 0;
      if (
        !this.savedExteriorPos ||
        Math.abs(this.playerPhys.x - roomCenterX) > 14
      ) {
        if (!this.savedExteriorPos) {
          this.savedExteriorPos = {
            x: this.playerPhys.x,
            z: this.playerPhys.z,
            facing: this.playerPhys.facing,
          };
        }
        this.playerPhys.x = roomCenterX;
        this.playerPhys.z = 4.5;
        this.playerPhys.facing = Math.PI;
        this.camYaw = Math.PI;
        this.cameraNeedsSnap = true;
      }
      const inputX = camFwdX * moveForward + camRightX * strafeRight;
      const inputZ = camFwdZ * moveForward + camRightZ * strafeRight;
      const mag = Math.hypot(inputX, inputZ);
      if (mag > 0.01) {
        this.playerPhys.x = THREE.MathUtils.clamp(
          this.playerPhys.x + (inputX / mag) * 7.5 * staminaMult * simDt,
          roomCenterX - 11,
          roomCenterX + 11
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
      const roleSpec = HEIST_PROTAGONIST_ROLES[pState.activeProtagonist];
      const abilitySurgeActive =
        storeState.trioAbilityBuffUntilMs > Date.now() &&
        pState.activeProtagonist === 'raka';
      const rakaBikeBonus =
        pState.activeProtagonist === 'raka' && activeVehicle.type === 'ojek'
          ? roleSpec.sprintAndBikeMultiplier
          : 1.0;
      const rakaBoost =
        (pState.activeProtagonist === 'raka' && pState.fokusActive ? 1.45 : 1.0) *
        (abilitySurgeActive ? 1.25 : 1.0) *
        rakaBikeBonus;
      const turboMult =
        (1 + pState.vehicleUpgradeLevel * 0.15) *
        (pState.fokusActive ? 1.18 : 1.0) *
        rakaBoost;

      const handlingPenalty = getVehicleHandlingPenalty(activeVehicle.damage);
      const effectiveMaxSpeed =
        vSpec.maxSpeed * turboMult * handlingPenalty.speedMultiplier;
      const isWetRoad =
        storeState.weatherMode === 'hujan' || storeState.weatherMode === 'senja';
      const wetGripMult =
        storeState.weatherMode === 'hujan' ? 1.24 : isWetRoad ? 1.08 : 1.0;

      const prevSpeed = activeVehicle.speed;
      const handbrakeHeld =
        !vSpec.isAircraft &&
        (this.keysHeld.has('Space') ||
          virtualInputRef.driftHeld ||
          gpDriftHeld);
      const isDrifting =
        handbrakeHeld &&
        Math.abs(activeVehicle.speed) > 6.5 &&
        Math.abs(moveTurn) > 0;
      activeVehicle.isDrifting = isDrifting;

      const longStep = stepVehicleLongitudinalSpeed(
        activeVehicle.speed,
        moveForward,
        vSpec.acceleration * turboMult * handlingPenalty.speedMultiplier,
        effectiveMaxSpeed,
        handbrakeHeld,
        activeVehicle.damage.exploded,
        simDt
      );
      activeVehicle.speed = longStep.speed;
      activeVehicle.isBraking = longStep.isBraking;

      if (vSpec.isAircraft || Math.abs(activeVehicle.speed) > 0.35) {
        const dirSign =
          vSpec.isAircraft || activeVehicle.speed >= 0 ? 1 : -1;
        const effectiveTurnRate = computeSpeedSensitiveTurnRate(
          vSpec.turnRate,
          Math.abs(activeVehicle.speed),
          effectiveMaxSpeed,
          isDrifting,
          wetGripMult
        );
        const pullYaw =
          !vSpec.isAircraft && Math.abs(activeVehicle.speed) > 4
            ? handlingPenalty.steeringPull *
              Math.min(1, Math.abs(activeVehicle.speed) / 14)
            : 0;
        activeVehicle.heading +=
          (moveTurn * effectiveTurnRate + pullYaw) *
          dirSign *
          simDt;
      }

      // Slip angle & lateral skid motion while handbrake drifting (amplified on wet Vice-Jakarta asphalt)
      const targetDriftAngle = isDrifting ? -moveTurn * 0.38 * wetGripMult : 0;
      activeVehicle.driftAngle = THREE.MathUtils.damp(
        activeVehicle.driftAngle,
        targetDriftAngle,
        8,
        simDt
      );
      // Drift catch counter-steer boost on exiting a drift
      const driftCatch = computeDriftCounterSteerBoost(
        moveTurn,
        activeVehicle.driftAngle,
        Math.abs(activeVehicle.speed)
      );
      if (driftCatch.boosted) {
        activeVehicle.speed *= 1 + (driftCatch.accelerationSurge - 1) * simDt * 3.5;
      }
      const travelAngle =
        activeVehicle.heading - activeVehicle.driftAngle * 0.55;

      const nextVX =
        activeVehicle.x +
        Math.sin(travelAngle) * activeVehicle.speed * simDt;
      const nextVZ =
        activeVehicle.z +
        Math.cos(travelAngle) * activeVehicle.speed * simDt;

      const surfaceElev = getGroundElevationAt(nextVX, nextVZ);
      let rampPitchBoost = 0;

      // Monsoon Flood Zone hydroplaning & splash physics
      if (!vSpec.isAircraft && !this.stuntJump.airborne) {
        const floodEval = evaluateFloodZoneAt(nextVX, nextVZ, wetnessFactor);
        if (floodEval.inFlood && Math.abs(activeVehicle.speed) > 4.5) {
          activeVehicle.speed *= Math.exp(-0.55 * floodEval.hydroplaneStrength * simDt);
          const wobble = Math.sin(nowMs * 0.012) * floodEval.hydroplaneStrength * 0.45;
          activeVehicle.heading += wobble * simDt;
          this.floodSplashAccum += simDt;
          if (this.floodSplashAccum >= 0.065) {
            this.floodSplashAccum = 0;
            const backX = activeVehicle.x - Math.sin(activeVehicle.heading) * 1.4;
            const backZ = activeVehicle.z - Math.cos(activeVehicle.heading) * 1.4;
            this.spawnParticles(backX, surfaceElev + 0.3, backZ, 3, 0x7dd3fc, 5.2);
          }
        }
      }

      if (vSpec.isAircraft) {
        const climbDir =
          (this.keysHeld.has('Space') ? 1 : 0) -
          (this.keysHeld.has('KeyZ') ? 1 : 0);
        activeVehicle.y = THREE.MathUtils.clamp(
          activeVehicle.y + climbDir * 14 * simDt,
          surfaceElev,
          38
        );
      } else if (this.stuntJump.airborne) {
        this.stuntJump.airTime += simDt;
        this.stuntJump.vy -= 18.5 * simDt;
        activeVehicle.y += this.stuntJump.vy * simDt;
        rampPitchBoost = THREE.MathUtils.clamp(-this.stuntJump.vy * 0.028, -0.35, 0.25);
        engineTelemetryRef.stuntAirTimeSec = this.stuntJump.airTime;

        if (activeVehicle.y <= surfaceElev && this.stuntJump.vy < 0) {
          activeVehicle.y = surfaceElev;
          const distM = Math.hypot(
            nextVX - this.stuntJump.launchX,
            nextVZ - this.stuntJump.launchZ
          );
          const launchedRamp = this.stuntJump.ramp;
          const totalAir = this.stuntJump.airTime;
          this.stuntJump.airborne = false;
          this.stuntJump.ramp = null;
          this.stuntJump.vy = 0;
          this.stuntJump.airTime = 0;
          this.stuntJump.slowMoTimer = 0;
          engineTelemetryRef.stuntAirTimeSec = 0;
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.34);
          this.spawnParticles(nextVX, surfaceElev + 0.35, nextVZ, 18, 0xf59e0b, 8);
          this.spawnShockwave(nextVX, surfaceElev, nextVZ, 7.5, 0xfacc15, 0.42);
          this.triggerFlashLight(nextVX, surfaceElev + 1.4, nextVZ, 0xfacc15, 10);
          soundEngine.playPropCrash(0);

          if (launchedRamp && distM >= 8) {
            const stuntRes = scoreStuntJump(
              launchedRamp,
              distM,
              totalAir,
              gameStore.getState().stuntCompletedIds
            );
            gameStore.recordStuntJump(stuntRes);
            if (stuntRes.rating !== 'MANTAP') {
              this.callbacks.onViralMoment?.(
                'drift_stunt',
                `Lompatan Stunt ${stuntRes.rating} sejauh ${stuntRes.distanceM}m di ${stuntRes.rampName}!`
              );
            }
          }
        }
      } else {
        const rampEval = evaluateStuntRampContact(
          nextVX,
          nextVZ,
          activeVehicle.speed,
          activeVehicle.heading
        );
        if (rampEval.onRamp && rampEval.ramp) {
          activeVehicle.y = surfaceElev + rampEval.surfaceHeight;
          rampPitchBoost = -0.26;
          if (rampEval.launchReady) {
            this.stuntJump.airborne = true;
            this.stuntJump.ramp = rampEval.ramp;
            this.stuntJump.launchX = nextVX;
            this.stuntJump.launchZ = nextVZ;
            this.stuntJump.airTime = 0.05;
            this.stuntJump.vy = Math.max(9.2, Math.abs(activeVehicle.speed) * 0.44);
            this.stuntJump.slowMoTimer = 0.8;
            soundEngine.playTone(420, 0.22, 'sawtooth', 0.14, 1.45);
            this.spawnParticles(nextVX, activeVehicle.y + 0.4, nextVZ, 14, 0x38bdf8, 8);
          }
        } else {
          activeVehicle.y = surfaceElev;
        }
      }

      const col =
        (vSpec.isAircraft && activeVehicle.y > 5) || surfaceElev > 2.5
          ? {
              x: THREE.MathUtils.clamp(nextVX, -236, 236),
              z: THREE.MathUtils.clamp(nextVZ, -236, 236),
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
        const wallImpact = Math.abs(activeVehicle.speed);
        if (wallImpact > 4.5) {
          const rawForce = wallImpact * 0.65;
          const mitigated = computeVehicleArmorMitigation(
            rawForce,
            pState.vehicleCustoms?.armorPlatingLevel ?? 0
          );
          this.traffic.applyVehicleImpact(
            activeVehicle,
            mitigated,
            activeVehicle.speed >= 0 ? 'front' : 'rear'
          );
          this.spawnParticles(
            activeVehicle.x,
            activeVehicle.y + 0.8,
            activeVehicle.z,
            wallImpact > 10 ? 14 : 9,
            0xfbbf24,
            8
          );
        }
        activeVehicle.speed *= -0.35;
        this.cameraTrauma = Math.min(
          1,
          this.cameraTrauma + (wallImpact > 10 ? 0.42 : 0.25)
        );
        soundEngine.playHit(false);
        cityAudio.playCollisionThud(Math.min(1, wallImpact / 16));
      }
      activeVehicle.x = col.x;
      activeVehicle.z = col.z;

      // Active World Clock Road Event (Road Construction / Traffic Jam) physical barrier & slowdown
      const roadEventImpact = evaluateRoadEventImpactAt(
        storeState.worldClockEventState.activeEvent,
        activeVehicle.x,
        activeVehicle.z,
        activeVehicle.y
      );
      if (roadEventImpact.inZone) {
        activeVehicle.speed *= Math.pow(
          roadEventImpact.speedMultiplier,
          simDt * 3.2
        );
        if (roadEventImpact.blockedBarrierCollide) {
          activeVehicle.x = roadEventImpact.pushX;
          activeVehicle.z = roadEventImpact.pushZ;
          activeVehicle.speed *= -0.38;
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.26);
          this.spawnParticles(
            activeVehicle.x,
            activeVehicle.y + 0.75,
            activeVehicle.z,
            10,
            0xf97316,
            7
          );
          soundEngine.playPropCrash(0);
          cityAudio.playCollisionThud(0.75);
        }
      }

      // Ground vehicle-to-vehicle physical collision pushback & momentum transfer
      if (!vSpec.isAircraft || activeVehicle.y < 2.2) {
        for (const other of this.traffic.vehicles) {
          if (other.id === activeVehicle.id) continue;
          if (Math.abs(other.y - activeVehicle.y) > 2.2) continue;
          const otherSpec = VEHICLE_SPECS[other.type];
          const minDist = vSpec.radius + otherSpec.radius;
          const dxV = activeVehicle.x - other.x;
          const dzV = activeVehicle.z - other.z;
          const distSq = dxV * dxV + dzV * dzV;
          if (distSq < minDist * minDist) {
            const dist = Math.sqrt(distSq) || 0.01;
            const nx = dxV / dist;
            const nz = dzV / dist;
            const overlap = minDist - dist;
            activeVehicle.x += nx * overlap * 0.45;
            activeVehicle.z += nz * overlap * 0.45;

            const safeOther = resolveCircleAABBCollision(
              other.x - nx * overlap * 0.65,
              other.z - nz * overlap * 0.65,
              otherSpec.radius,
              undefined,
              this.buildingGrid
            );
            other.x = safeOther.x;
            other.z = safeOther.z;
            other.mesh.position.set(other.x, other.y, other.z);

            const impactSpeed = Math.abs(activeVehicle.speed);
            if (impactSpeed > 4.5) {
              this.traffic.applyVehicleImpact(
                activeVehicle,
                impactSpeed * 0.52,
                activeVehicle.speed >= 0 ? 'front' : 'rear'
              );
              this.traffic.applyVehicleImpact(
                other,
                impactSpeed * 0.72,
                'left'
              );
            }
            if (impactSpeed > 6) {
              activeVehicle.speed *= 0.58;
              other.stopTimer = Math.max(other.stopTimer, 0.9);
              this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.28);
              this.spawnParticles(
                (activeVehicle.x + other.x) * 0.5,
                activeVehicle.y + 0.85,
                (activeVehicle.z + other.z) * 0.5,
                8,
                0xfbbf24,
                7
              );
              soundEngine.playPropCrash(0);
              cityAudio.playCollisionThud(Math.min(1, impactSpeed / 18));
            } else {
              activeVehicle.speed *= 0.82;
            }
          }
        }
      }

      // Damped 4-wheel spring suspension pitch (acceleration squat / brake dive) & body roll
      const accelDelta = (activeVehicle.speed - prevSpeed) / Math.max(0.008, simDt);
      const targetPitch = vSpec.isAircraft
        ? -moveForward * 0.08
        : THREE.MathUtils.clamp(-accelDelta * 0.0028, -0.075, 0.075) + rampPitchBoost;
      activeVehicle.pitchAngle = THREE.MathUtils.damp(
        activeVehicle.pitchAngle,
        targetPitch,
        9,
        simDt
      );

      const speedLeanRatio = Math.min(1, Math.abs(activeVehicle.speed) / 14);
      const targetRoll =
        -moveTurn *
        speedLeanRatio *
        (vSpec.isAircraft ? 0.24 : isDrifting ? 0.12 : 0.08);
      activeVehicle.rollAngle = THREE.MathUtils.damp(
        activeVehicle.rollAngle,
        targetRoll,
        9,
        simDt
      );

      activeVehicle.mesh.position.set(
        activeVehicle.x,
        activeVehicle.y,
        activeVehicle.z
      );
      activeVehicle.mesh.rotation.y =
        activeVehicle.heading + activeVehicle.driftAngle * 0.45;
      activeVehicle.mesh.rotation.x = activeVehicle.pitchAngle;
      activeVehicle.mesh.rotation.z = activeVehicle.rollAngle;

      // Pooled exhaust / Nitro flames / boat wake foam
      if (vSpec.isWatercraft && Math.abs(activeVehicle.speed) > 3.5) {
        this.exhaustPuffAccum += simDt;
        if (this.exhaustPuffAccum >= 0.055) {
          this.exhaustPuffAccum = 0;
          const tailX = activeVehicle.x - Math.sin(activeVehicle.heading) * 2.1;
          const tailZ = activeVehicle.z - Math.cos(activeVehicle.heading) * 2.1;
          this.spawnParticles(tailX, activeVehicle.y + 0.15, tailZ, 4, 0xbae6fd, 4.8);
        }
      } else if (
        !vSpec.isAircraft &&
        !vSpec.isWatercraft &&
        (pState.fokusActive || abilitySurgeActive) &&
        moveForward > 0.2
      ) {
        this.exhaustPuffAccum += simDt;
        if (this.exhaustPuffAccum >= 0.045) {
          this.exhaustPuffAccum = 0;
          const tailX = activeVehicle.x - Math.sin(activeVehicle.heading) * 1.85;
          const tailZ = activeVehicle.z - Math.cos(activeVehicle.heading) * 1.85;
          this.spawnParticles(tailX, activeVehicle.y + 0.32, tailZ, 3, 0x38bdf8, 5.2);
          this.spawnParticles(tailX, activeVehicle.y + 0.32, tailZ, 2, 0xf97316, 4.0);
        }
      } else if (
        !vSpec.isAircraft &&
        activeVehicle.y < 1.2 &&
        moveForward > 0.5 &&
        activeVehicle.speed >= 0.4 &&
        activeVehicle.speed < 9.5
      ) {
        this.exhaustPuffAccum += simDt;
        if (this.exhaustPuffAccum >= 0.11) {
          this.exhaustPuffAccum = 0;
          const tailX = activeVehicle.x - Math.sin(activeVehicle.heading) * 1.75;
          const tailZ = activeVehicle.z - Math.cos(activeVehicle.heading) * 1.75;
          this.spawnParticles(tailX, activeVehicle.y + 0.3, tailZ, 2, 0x94a3b8, 2.2);
        }
      } else {
        this.exhaustPuffAccum = 0;
      }

      // Tire smoke, asphalt skidmarks & live Drift Combo Scoring during drift
      const driftSkillLv = pState.characterSkills?.driftControl ?? 1;
      if (isDrifting && activeVehicle.y < 1.2) {
        const driftIntensity = Math.min(1, Math.abs(activeVehicle.speed) / 18);
        soundEngine.updateDriftAudio(driftIntensity, true);
        this.driftChainTimer += simDt;
        const mult = Math.min(
          5,
          1 + Math.floor(this.driftChainTimer / 1.4) + Math.floor((driftSkillLv - 1) * 0.5)
        );
        this.driftChainScore +=
          Math.abs(activeVehicle.speed) * (1 + driftSkillLv * 0.18) * mult * simDt * 8;
        if (
          Math.round(this.driftChainScore) !== storeState.driftScore ||
          mult !== storeState.driftMultiplier
        ) {
          gameStore.setState({
            driftScore: Math.round(this.driftChainScore),
            driftMultiplier: mult,
          });
        }
        this.skidSpawnAccum += simDt;
        if (this.skidSpawnAccum >= 0.045) {
          this.skidSpawnAccum = 0;
          this.dropSkidmarkPair(
            activeVehicle.x,
            activeVehicle.y,
            activeVehicle.z,
            activeVehicle.heading
          );
          const backX = activeVehicle.x - Math.sin(activeVehicle.heading) * 1.3;
          const backZ = activeVehicle.z - Math.cos(activeVehicle.heading) * 1.3;
          this.spawnParticles(backX, activeVehicle.y + 0.25, backZ, 2, 0xcbd5e1, 3.2);
          if (this.driftChainTimer > 0.7) {
            this.spawnParticles(backX, activeVehicle.y + 0.2, backZ, 2, 0xf59e0b, 4.5);
          }
        }
      } else {
        soundEngine.updateDriftAudio(0, false);
        if (this.driftChainScore >= 120) {
          const bonusRp = Math.round(this.driftChainScore * 35);
          const pts = Math.round(this.driftChainScore);
          const wasViralDrift = this.driftChainTimer >= 2.2 || pts >= 260;
          this.driftChainScore = 0;
          this.driftChainTimer = 0;
          soundEngine.playPickup();
          gameStore.updatePlayerState((prev) => ({
            ...prev,
            rupiah: prev.rupiah + bonusRp,
            score: prev.score + pts,
            bestScore: Math.max(prev.bestScore, prev.score + pts),
          }));
          gameStore.setState({
            driftScore: 0,
            driftMultiplier: 1,
            lastOutcomeText: `Kombo Drift Malam Tuntas: +${pts.toLocaleString('id-ID')} Poin (+Rp ${bonusRp.toLocaleString('id-ID')})`,
          });
          gameStore.recordDailyProgress('drift_combo', 1);
          if (wasViralDrift) {
            this.callbacks.onViralMoment?.(
              'drift_stunt',
              `Kombo drift ${pts.toLocaleString('id-ID')} poin di aspal basah Jakarta! Netizen langsung heboh!`
            );
          }
        } else if (this.driftChainScore > 0) {
          this.driftChainScore = 0;
          this.driftChainTimer = 0;
          gameStore.setState({ driftScore: 0, driftMultiplier: 1 });
        }
      }

      this.playerPhys.x = activeVehicle.x;
      this.playerPhys.y = activeVehicle.y;
      this.playerPhys.z = activeVehicle.z;
      this.playerPhys.facing = activeVehicle.heading;

      // High-speed traffic Near-Miss adrenaline overtake bonus
      if (!vSpec.isAircraft && Math.abs(activeVehicle.speed) >= 19.5) {
        let closestDist = 99;
        for (let ti = 0; ti < this.traffic.vehicles.length; ti++) {
          const other = this.traffic.vehicles[ti];
          if (other.id === activeVehicle.id || !other.isTraffic) continue;
          if (Math.abs(other.y - activeVehicle.y) > 2.2) continue;
          const d = Math.hypot(other.x - activeVehicle.x, other.z - activeVehicle.z);
          if (d < closestDist) closestDist = d;
        }
        const nearMiss = computeNearMissBonus(
          Math.abs(activeVehicle.speed),
          closestDist,
          Boolean(vSpec.isAircraft),
          this.lastNearMissMs,
          nowMs
        );
        if (nearMiss.triggered) {
          this.lastNearMissMs = nowMs;
          gameStore.registerNearMiss(
            nearMiss.rewardRp,
            nearMiss.focusGain,
            nearMiss.scoreDelta
          );
          soundEngine.playTone(720, 0.08, 'triangle', 0.12, 1.35);
          this.spawnParticles(activeVehicle.x, activeVehicle.y + 0.7, activeVehicle.z, 8, 0x22d3ee, 6);
        }
      }

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
      soundEngine.updateDriftAudio(0, false);
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
      const inCover = storeState.inCover;
      if (inCover && ((sprinting && (moveForward !== 0 || moveTurn !== 0)) || this.playerPhys.combatRollTimer > 0)) {
        gameStore.setCoverState(false, 'none');
      }
      const coverSpeedMult = inCover ? 0.56 : 1.0;
      const roleSpec = HEIST_PROTAGONIST_ROLES[pState.activeProtagonist];
      const rakaSurgeMult =
        pState.activeProtagonist === 'raka' &&
        storeState.trioAbilityBuffUntilMs > Date.now()
          ? 1.22
          : 1.0;
      const walkSpeed =
        (sprinting ? 12.5 : 8.5) *
        (pState.fokusActive ? 1.22 : 1.0) *
        roleSpec.sprintAndBikeMultiplier *
        rakaSurgeMult *
        staminaMult *
        rollBoost *
        coverSpeedMult;
      const inputX = camFwdX * moveForward + camRightX * strafeRight;
      const inputZ = camFwdZ * moveForward + camRightZ * strafeRight;
      const mag = Math.hypot(inputX, inputZ);
      const isFirstPerson = storeState.cameraViewMode === 'first_person';

      if (mag > 0.01) {
        const nx = inputX / mag;
        const nz = inputZ / mag;
        this.playerPhys.vx = THREE.MathUtils.damp(
          this.playerPhys.vx,
          nx * walkSpeed,
          13.5,
          simDt
        );
        this.playerPhys.vz = THREE.MathUtils.damp(
          this.playerPhys.vz,
          nz * walkSpeed,
          13.5,
          simDt
        );
        const targetAngle = isTpsAim || isFirstPerson ? this.camYaw : Math.atan2(nx, nz);
        const diff =
          ((targetAngle - this.playerPhys.facing + Math.PI * 3) %
            (Math.PI * 2)) -
          Math.PI;
        this.playerPhys.facing += diff * (1 - Math.exp(-15 * simDt));
      } else {
        this.playerPhys.vx *= Math.exp(-11 * simDt);
        this.playerPhys.vz *= Math.exp(-11 * simDt);
        if (isTpsAim || isFirstPerson) {
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
              x: THREE.MathUtils.clamp(nextPX, -236, 236),
              z: THREE.MathUtils.clamp(nextPZ, -236, 236),
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
      animateCharacterRig(this.playerRig, {
        elapsedTime: nowMs * 0.001,
        walkDist: this.playerPhys.walkDist,
        isMoving: mag > 0.01,
        isAiming: isTpsAim,
        phaseOffset: 0,
        dt: simDt,
      });

      const targetScaleY =
        storeState.inCover && this.playerPhys.attackCooldown <= 0.08 ? 0.8 : 1.0;
      this.playerRig.group.scale.y = THREE.MathUtils.damp(
        this.playerRig.group.scale.y,
        targetScaleY,
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

    // Active Staged Quest Director progression check
    const questState = gameStore.getState().activeQuestState;
    if (
      questState &&
      !questState.isCompleted &&
      questState.currentStageIndex < questState.stages.length
    ) {
      const curStage = questState.stages[questState.currentStageIndex];
      if (curStage.type === 'travel') {
        const distToStage = Math.hypot(
          this.playerPhys.x - curStage.targetX,
          this.playerPhys.z - curStage.targetZ
        );
        if (distToStage < 8.5) {
          const adv = gameStore.advanceQuestStage(
            this.playerPhys.x,
            this.playerPhys.z,
            pState.wantedLevel,
            1
          );
          soundEngine.playTone(660, 0.16, 'triangle', 0.2, 1.8);
          this.spawnParticles(
            curStage.targetX,
            this.playerPhys.y + 1.2,
            curStage.targetZ,
            18,
            0x38bdf8,
            8
          );
          if (adv?.advancedStage) {
            if (adv.missionJustCompleted) {
              soundEngine.playMissionFanfare();
              this.callbacks.onCompleteActiveObjective();
            } else {
              const nextStage =
                adv.nextQuest.stages[adv.nextQuest.currentStageIndex];
              if (nextStage && activeChoice) {
                activeChoice.targetX = nextStage.targetX;
                activeChoice.targetZ = nextStage.targetZ;
                if (nextStage.type === 'combat') {
                  this.spawnEnemyGroup(
                    nextStage.targetX,
                    nextStage.targetZ,
                    nextStage.targetCount
                  );
                }
              }
            }
          }
        }
      } else if (curStage.type === 'escape') {
        if (pState.wantedLevel <= 0) {
          const adv = gameStore.advanceQuestStage(
            this.playerPhys.x,
            this.playerPhys.z,
            pState.wantedLevel,
            1
          );
          if (adv?.missionJustCompleted) {
            soundEngine.playMissionFanfare();
            this.callbacks.onCompleteActiveObjective();
          }
        }
      }
    }

    // Checkpoints / Heist Escape fallback
    if (
      !questState &&
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

    // Crew Companions (Outer Diagonal V-Formation behind player)
    for (let cIdx = 0; cIdx < this.crewCompanions.length; cIdx++) {
      const comp = this.crewCompanions[cIdx];
      const shouldShow =
        cIdx < pState.crewCount &&
        !this.playerPhys.drivingVehicleId &&
        pState.currentInterior === 'exterior';
      comp.rig.group.visible = shouldShow;
      if (!shouldShow) continue;

      const slotTarget = computeStaggeredCrewPosition(
        this.playerPhys.x,
        this.playerPhys.z,
        this.playerPhys.facing,
        cIdx + 2
      );
      const dxC = slotTarget.x - comp.x;
      const dzC = slotTarget.z - comp.z;
      const distC = Math.hypot(dxC, dzC);
      const crewMoving = distC > 0.35;

      if (crewMoving) {
        const stepC = Math.min(distC, 9.2 * simDt);
        const safeCrew = resolveCircleAABBCollision(
          comp.x + (dxC / distC) * stepC,
          comp.z + (dzC / distC) * stepC,
          0.65,
          undefined,
          this.buildingGrid
        );
        comp.x = safeCrew.x;
        comp.z = safeCrew.z;
        comp.facing = Math.atan2(dxC, dzC);
        comp.walkDist += stepC;
      }

      let crewFiring = false;
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
          crewFiring = true;
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

      animateCharacterRig(comp.rig, {
        elapsedTime: nowMs * 0.001,
        walkDist: comp.walkDist,
        isMoving: crewMoving,
        isAiming: crewFiring,
        phaseOffset: 1.7 + cIdx * 1.15,
        dt: simDt,
      });
      comp.rig.group.position.set(
        comp.x,
        getGroundElevationAt(comp.x, comp.z),
        comp.z
      );
      comp.rig.group.rotation.y = comp.facing;
    }

    // Wave 2: Autonomous 3D Trio Squad AI (Raka & Kirana / Active Wingmen in Inner Diagonal V-Formation)
    const wingmen = getActiveWingmanIds(pState.activeProtagonist);
    const squadOrder = storeState.squadOrder;
    engineTelemetryRef.squadMembers.length = wingmen.length;
    for (let wIdx = 0; wIdx < wingmen.length; wIdx++) {
      const wId = wingmen[wIdx];
      const rt = this.trioSquadRuntime[wId];
      const rig = this.idleProtagonistRigs[wId];
      const showWingman =
        pState.currentInterior === 'exterior' &&
        !this.playerPhys.drivingVehicleId;

      const distToPlayer = Math.hypot(
        this.playerPhys.x - rt.x,
        this.playerPhys.z - rt.z
      );
      if (distToPlayer > 34 || !showWingman) {
        // Snap into staggered diagonal V-formation if player drove away or exited vehicle
        const snapPos = computeStaggeredCrewPosition(
          this.playerPhys.x,
          this.playerPhys.z,
          this.playerPhys.facing,
          wIdx
        );
        const safeSnap = resolveCircleAABBCollision(
          snapPos.x,
          snapPos.z,
          0.7,
          undefined,
          this.buildingGrid
        );
        rt.x = safeSnap.x;
        rt.z = safeSnap.z;
        rt.facing = this.playerPhys.facing;
      }

      if (showWingman && simDt > 0) {
        // Find nearest live enemy
        let targetEn: EnemyEntity | null = null;
        let bestEnDist = squadOrder === 'attack' ? 32 : 22;
        for (let ei = 0; ei < this.enemies.length; ei++) {
          const en = this.enemies[ei];
          if (en.state !== 'alive') continue;
          const d = Math.hypot(en.x - rt.x, en.z - rt.z);
          if (d < bestEnDist) {
            bestEnDist = d;
            targetEn = en;
          }
        }

        let goalX = rt.x;
        let goalZ = rt.z;
        if (squadOrder === 'hold') {
          rt.actionLabel = targetEn ? 'Tahan & Tembak' : 'Jaga Perimeter';
        } else if (squadOrder === 'attack' && targetEn) {
          const keepDist = wId === 'raka' ? 5.2 : 9.5;
          const ang = Math.atan2(rt.x - targetEn.x, rt.z - targetEn.z);
          goalX = targetEn.x + Math.sin(ang) * keepDist;
          goalZ = targetEn.z + Math.cos(ang) * keepDist;
          rt.actionLabel = wId === 'raka' ? 'Menyerbu!' : 'Taktis Serang';
        } else {
          const vSlot = computeStaggeredCrewPosition(
            this.playerPhys.x,
            this.playerPhys.z,
            this.playerPhys.facing,
            wIdx
          );
          goalX = vSlot.x;
          goalZ = vSlot.z;
          rt.actionLabel = targetEn ? 'Kawal & Tembak' : 'Mengawal';
        }

        const dxW = goalX - rt.x;
        const dzW = goalZ - rt.z;
        const distW = Math.hypot(dxW, dzW);
        const wingMoving = distW > 0.45;
        if (wingMoving) {
          const stepW = Math.min(distW, (squadOrder === 'attack' ? 10.6 : 9.4) * simDt);
          const safeW = resolveCircleAABBCollision(
            rt.x + (dxW / distW) * stepW,
            rt.z + (dzW / distW) * stepW,
            0.7,
            undefined,
            this.buildingGrid
          );
          rt.x = safeW.x;
          rt.z = safeW.z;
          rt.facing = Math.atan2(dxW, dzW);
          rt.walkDist += stepW;
        }

        animateCharacterRig(rig, {
          elapsedTime: nowMs * 0.001,
          walkDist: rt.walkDist,
          isMoving: wingMoving,
          isAiming: Boolean(targetEn),
          phaseOffset: 0.85 + wIdx * 1.4,
          dt: simDt,
        });

        // Wingman gunfire & signature abilities (Raka Breach Burst / Kirana EMP Pulse)
        rt.fireCooldown -= simDt;
        rt.abilityCooldown -= simDt;
        const wGroundY = getGroundElevationAt(rt.x, rt.z);

        if (targetEn && rt.fireCooldown <= 0) {
          rt.facing = Math.atan2(targetEn.x - rt.x, targetEn.z - rt.z);
          rig.rightArm.rotation.x = -Math.PI * 0.72;
          const isRaka = wId === 'raka';
          rt.fireCooldown = isRaka ? 0.95 : 0.78;
          const dmg = isRaka ? 34 : 24;
          targetEn.hp -= dmg;
          targetEn.hitFlashTimer = 0.07;
          this.spawnTracer(
            rt.x,
            wGroundY + 1.35,
            rt.z,
            targetEn.x,
            getGroundElevationAt(targetEn.x, targetEn.z) + 1.2,
            targetEn.z,
            isRaka ? 0xf97316 : 0x38bdf8
          );
          this.spawnParticles(targetEn.x, 1.25, targetEn.z, 7, isRaka ? 0xf97316 : 0x38bdf8, 7);
          if (targetEn.hp <= 0) {
            this.markEnemyKo(targetEn, activeChoice, true);
          }
        }

        // Kirana EMP Pulse slows nearby police/traffic vehicles & stuns nearby enemies
        if (wId === 'kirana' && rt.abilityCooldown <= 0 && (targetEn || pState.wantedLevel >= 1)) {
          rt.abilityCooldown = 11.0;
          rt.actionLabel = 'EMP PULSE!';
          const slowedCount = this.traffic.applyEmpPulseAt(
            rt.x,
            rt.z,
            24,
            this.playerPhys.drivingVehicleId
          );
          this.spawnParticles(rt.x, wGroundY + 1.2, rt.z, 22, 0x22d3ee, 10);
          soundEngine.playTone(540, 0.25, 'sine', 0.14, 0.45);
          for (let ei = 0; ei < this.enemies.length; ei++) {
            const en = this.enemies[ei];
            if (en.state === 'alive' && Math.hypot(en.x - rt.x, en.z - rt.z) < 15) {
              en.cooldownTimer = Math.max(en.cooldownTimer, 1.8);
              en.hp -= 18;
              en.hitFlashTimer = 0.1;
              if (en.hp <= 0) this.markEnemyKo(en, activeChoice, true);
            }
          }
          if (slowedCount > 0 || targetEn) {
            gameStore.triggerSquadCallout(
              `Kirana: "Pulsa EMP aktif! ${slowedCount > 0 ? `${slowedCount} kendaraan lumpuh` : 'Sistem lawan terganggu'}!"`
            );
          }
        }

        rig.rightArm.rotation.x = THREE.MathUtils.damp(
          rig.rightArm.rotation.x,
          0,
          10,
          simDt
        );
        rig.group.position.set(rt.x, wGroundY, rt.z);
        rig.group.rotation.y = rt.facing;
      }

      const prevT = engineTelemetryRef.squadMembers[wIdx];
      if (!prevT) {
        engineTelemetryRef.squadMembers[wIdx] = {
          id: wId,
          name: PROTAGONIST_PROFILES[wId].name,
          x: rt.x,
          z: rt.z,
          facing: rt.facing,
          active: true,
          actionLabel: rt.actionLabel,
        };
      } else {
        prevT.id = wId;
        prevT.name = PROTAGONIST_PROFILES[wId].name;
        prevT.x = rt.x;
        prevT.z = rt.z;
        prevT.facing = rt.facing;
        prevT.active = true;
        prevT.actionLabel = rt.actionLabel;
      }
    }

    const trafficRes = this.traffic.stepTrafficAI(
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
    let spottedByPolice = trafficRes.spottedByPolice;
    const signalPhase = trafficRes.signalPhase;

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

      const isStaggered = Boolean(en.staggerTimer && en.staggerTimer > 0);
      if (isStaggered && en.staggerTimer) {
        en.staggerTimer -= enemySimDt;
        en.windupTimer = 0;
        if (en.staggerType === 'head') {
          en.rig.headGroup.rotation.x = -0.55;
          en.rig.bodyMesh.rotation.x = -0.22;
          en.rig.leftArm.rotation.z = -0.65;
          en.rig.rightArm.rotation.z = 0.65;
        } else {
          en.rig.bodyMesh.rotation.x = -0.38;
          en.rig.leftArm.rotation.x = -0.55;
          en.rig.rightArm.rotation.x = -0.55;
        }
      } else {
        en.rig.headGroup.rotation.x = THREE.MathUtils.damp(
          en.rig.headGroup.rotation.x,
          0,
          10,
          dt
        );
        en.rig.bodyMesh.rotation.x = THREE.MathUtils.damp(
          en.rig.bodyMesh.rotation.x,
          0,
          10,
          dt
        );
        en.rig.leftArm.rotation.z = THREE.MathUtils.damp(
          en.rig.leftArm.rotation.z,
          0,
          10,
          dt
        );
        en.rig.rightArm.rotation.z = THREE.MathUtils.damp(
          en.rig.rightArm.rotation.z,
          0,
          10,
          dt
        );
      }

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

      const effectiveEnemySpeed = isStaggered ? spec.speed * 0.35 : spec.speed;

      if (en.windupTimer <= 0 && distToPlayer < 48) {
        const moveRes = stepEnemyMovementPolicy(
          en.policy,
          en.x,
          en.z,
          this.playerPhys.x,
          this.playerPhys.z,
          effectiveEnemySpeed,
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
            const roleDmgMult =
              1 -
              (HEIST_PROTAGONIST_ROLES[pState.activeProtagonist]
                ?.damageReductionBonus ?? 0);
            const surgeDmgMult =
              pState.activeProtagonist === 'nabilo' &&
              storeState.trioAbilityBuffUntilMs > Date.now()
                ? 0.65
                : 1.0;
            const mitigatedDmg = Math.max(
              1,
              Math.round(
                applyCoverDamageMitigation(spec.damage, storeState.inCover) *
                  roleDmgMult *
                  surgeDmgMult
              )
            );
            this.callbacks.onPlayerDamage(mitigatedDmg);
            this.damagePulse = storeState.inCover ? 0.45 : 1.0;
            this.cameraTrauma = Math.min(
              1,
              this.cameraTrauma + (storeState.inCover ? 0.14 : 0.35)
            );
            const hitAngle = Math.atan2(
              en.x - this.playerPhys.x,
              en.z - this.playerPhys.z
            ) - this.camYaw;
            this.callbacks.onPlayerHitAngle?.(hitAngle);
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
          !isStaggered &&
          activeAttackers < MAX_CONCURRENT_ATTACKERS
        ) {
          activeAttackers++;
          en.windupTimer = spec.windupDuration;
          soundEngine.playTone(380, 0.12, 'sine', 0.08, 1.35);
        }
      }

      const enGroundY = getGroundElevationAt(en.x, en.z);
      en.rig.group.position.set(en.x, enGroundY, en.z);
      en.rig.group.rotation.y = en.facing;

      if (en.rig.hpBarGroup && en.rig.hpFillMesh) {
        const damaged = en.hp < en.maxHp && en.hp > 0;
        en.rig.hpBarGroup.visible = damaged;
        if (damaged) {
          const ratio = Math.max(0.05, en.hp / Math.max(1, en.maxHp));
          en.rig.hpFillMesh.scale.set(ratio, 1, 1);
          en.rig.hpFillMesh.position.x = -(1 - ratio) * 0.43;
          en.rig.hpBarGroup.lookAt(
            camera.position.x,
            enGroundY + 2.08,
            camera.position.z
          );
        }
      }
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

    // Update Zero-GC Compacted Pooled Particles, Shockwaves & Bullet Tracers
    this.fxPool.step(dt);

    // Clear expired combat combo & near-miss streak banners cleanly
    this.comboExpireAccum += dt;
    if (this.comboExpireAccum >= 0.25) {
      this.comboExpireAccum = 0;
      gameStore.clearExpiredCombatCombo(Date.now());
    }

    // 3D Tactical Aim Laser Sight + Barrel Dot during TPS aiming on foot
    const equippedWSpec = getEffectiveWeaponSpec(pState.activeWeapon, pState);
    if (
      storeState.gameState === 'playing' &&
      isTpsAim &&
      !activeVehicle &&
      !equippedWSpec.isMelee &&
      !isPhotoMode
    ) {
      const aimX = Math.sin(this.camYaw);
      const aimZ = Math.cos(this.camYaw);
      const startY = this.playerPhys.y + (storeState.inCover ? 1.02 : 1.32);
      const startX = this.playerPhys.x + aimX * 0.65;
      const startZ = this.playerPhys.z + aimZ * 0.65;

      let laserLen = Math.min(24, equippedWSpec.range);
      for (let i = 0; i < this.enemies.length; i++) {
        const en = this.enemies[i];
        if (en.state !== 'alive') continue;
        const dx = en.x - this.playerPhys.x;
        const dz = en.z - this.playerPhys.z;
        const d = Math.hypot(dx, dz);
        if (d < laserLen && d > 0.8) {
          const dot = (dx / d) * aimX + (dz / d) * aimZ;
          if (dot >= 0.92) laserLen = d;
        }
      }
      const endX = startX + aimX * laserLen;
      const endZ = startZ + aimZ * laserLen;
      const posAttr = this.aimLaserLine.geometry.attributes
        .position as THREE.BufferAttribute;
      posAttr.setXYZ(0, startX, startY, startZ);
      posAttr.setXYZ(1, endX, startY - 0.08, endZ);
      posAttr.needsUpdate = true;
      (this.aimLaserLine.material as THREE.LineBasicMaterial).color.setHex(
        equippedWSpec.id === 'pasopati' ? 0x22d3ee : 0xef4444
      );
      this.aimLaserLine.visible = true;
      this.aimLaserDot.position.set(endX, startY - 0.08, endZ);
      (this.aimLaserDot.material as THREE.MeshBasicMaterial).color.setHex(
        equippedWSpec.id === 'pasopati' ? 0x67e8f9 : 0xf87171
      );
      this.aimLaserDot.visible = true;
    } else {
      this.aimLaserLine.visible = false;
      this.aimLaserDot.visible = false;
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
    const photoCfg = storeState.photoConfig;
    const camMode = storeState.cameraViewMode;
    const targetFov = isPhotoMode
      ? photoCfg.fov
      : this.stuntJump.airborne
      ? 54
      : isTpsAim
      ? 46
      : camMode === 'first_person'
      ? isDriving
        ? 72 + speedRatio * 10
        : 70
      : camMode === 'cinematic'
      ? 56 + speedRatio * 8
      : computeChaseCameraFov(speedRatio, isDriving, pState.fokusActive);
    if (Math.abs(camera.fov - targetFov) > 0.12) {
      camera.fov = THREE.MathUtils.lerp(
        camera.fov,
        targetFov,
        exponentialDampFactor(7.5, dt)
      );
      camera.updateProjectionMatrix();
    }

    if (isPhotoMode) {
      // Photo Mode Free-Orbit & Dutch Roll Camera
      this.playerRig.group.visible =
        !this.playerPhys.drivingVehicleId && !photoCfg.hidePlayer;
      const focusX = activeVehicle ? activeVehicle.x : this.playerPhys.x;
      const focusY = activeVehicle ? activeVehicle.y : this.playerPhys.y;
      const focusZ = activeVehicle ? activeVehicle.z : this.playerPhys.z;
      const orbitAng = this.camYaw + photoCfg.orbitOffset;
      const dist = photoCfg.distance;
      const targetCamX = focusX - Math.sin(orbitAng) * dist;
      const targetCamZ = focusZ - Math.cos(orbitAng) * dist;
      const targetCamY = focusY + photoCfg.heightOffset + Math.sin(this.camPitch) * 3.5;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 10, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 10, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 10, dt);
      camera.lookAt(focusX, focusY + 1.25, focusZ);
      if (Math.abs(photoCfg.rollDeg) > 0.1) {
        camera.rotateZ((photoCfg.rollDeg * Math.PI) / 180);
      }
    } else if (this.skySwitch.active) {
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
    } else if (this.cutsceneDirector.active) {
      this.cutsceneDirector.elapsed += dt;
      const panAngle = this.cutsceneDirector.elapsed * 0.42;
      const focusY = getGroundElevationAt(
        this.cutsceneDirector.focusX,
        this.cutsceneDirector.focusZ
      );
      camera.position.set(
        THREE.MathUtils.lerp(
          camera.position.x,
          this.cutsceneDirector.focusX + Math.sin(panAngle) * 14,
          1 - Math.exp(-3.5 * dt)
        ),
        THREE.MathUtils.lerp(
          camera.position.y,
          focusY + 6.5,
          1 - Math.exp(-3.5 * dt)
        ),
        THREE.MathUtils.lerp(
          camera.position.z,
          this.cutsceneDirector.focusZ + Math.cos(panAngle) * 14,
          1 - Math.exp(-3.5 * dt)
        )
      );
      camera.lookAt(
        this.cutsceneDirector.focusX,
        focusY + 2.0,
        this.cutsceneDirector.focusZ
      );
      if (this.cutsceneDirector.elapsed >= this.cutsceneDirector.duration) {
        this.cutsceneDirector.active = false;
      }
    } else if (isCustomsOpen) {
      const preset = storeState.garageCameraPreset;
      const focusVeh =
        activeVehicle ||
        this.traffic.vehicles.find((v) => v.type === 'supercar') ||
        this.traffic.vehicles[0];
      const vx = focusVeh ? focusVeh.x : this.playerPhys.x;
      const vy = focusVeh ? focusVeh.y : this.playerPhys.y;
      const vz = focusVeh ? focusVeh.z : this.playerPhys.z;
      const vHeading = focusVeh ? focusVeh.heading : this.playerPhys.facing;

      let targetCamX = vx;
      let targetCamY = vy + 2.6;
      let targetCamZ = vz;
      let lookY = vy + 0.9;

      if (preset === 'free_orbit') {
        if (!this.isOrbitDragging) {
          this.customsOrbitAngle += dt * 0.55;
        }
        targetCamX = vx + Math.cos(this.customsOrbitAngle) * 7.2;
        targetCamY = vy + 2.5;
        targetCamZ = vz + Math.sin(this.customsOrbitAngle) * 7.2;
      } else if (preset === 'front_low') {
        const ang = vHeading + 0.32;
        targetCamX = vx + Math.sin(ang) * 4.8;
        targetCamY = vy + 1.05;
        targetCamZ = vz + Math.cos(ang) * 4.8;
        lookY = vy + 0.65;
      } else if (preset === 'side_profile') {
        const ang = vHeading + Math.PI * 0.5;
        targetCamX = vx + Math.sin(ang) * 5.8;
        targetCamY = vy + 1.35;
        targetCamZ = vz + Math.cos(ang) * 5.8;
        lookY = vy + 0.7;
      } else if (preset === 'rear_exhaust') {
        const ang = vHeading + Math.PI - 0.35;
        targetCamX = vx + Math.sin(ang) * 5.0;
        targetCamY = vy + 1.25;
        targetCamZ = vz + Math.cos(ang) * 5.0;
        lookY = vy + 0.72;
      } else if (preset === 'top_down') {
        const ang = vHeading + 0.2;
        targetCamX = vx + Math.sin(ang) * 3.8;
        targetCamY = vy + 7.2;
        targetCamZ = vz + Math.cos(ang) * 3.8;
        lookY = vy + 0.5;
      }

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetCamX, 8.5, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetCamY, 8.5, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetCamZ, 8.5, dt);
      camera.lookAt(vx, lookY, vz);
    } else if (this.stuntJump.airborne && activeVehicle) {
      // Dramatic Stunt Jump Slow-Mo Side Camera
      const sideAng = activeVehicle.heading + Math.PI * 0.42;
      const sx = activeVehicle.x + Math.sin(sideAng) * 11.5;
      const sz = activeVehicle.z + Math.cos(sideAng) * 11.5;
      const sy = activeVehicle.y + 2.8;
      camera.position.x = THREE.MathUtils.damp(camera.position.x, sx, 6, dt);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, sy, 6, dt);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, sz, 6, dt);
      camera.lookAt(activeVehicle.x, activeVehicle.y + 0.9, activeVehicle.z);
    } else if (camMode === 'first_person') {
      // Immersive First-Person On-Foot & Vehicle Cockpit Camera
      this.playerRig.group.visible = false;
      if (isDriving && activeVehicle) {
        const sinH = Math.sin(activeVehicle.heading);
        const cosH = Math.cos(activeVehicle.heading);
        const camX = activeVehicle.x + sinH * 0.35;
        const camY = activeVehicle.y + 1.38;
        const camZ = activeVehicle.z + cosH * 0.35;
        camera.position.set(camX, camY, camZ);
        this._v2.set(
          camX + sinH * 24,
          camY - 0.18 + (0.28 - this.camPitch) * 6.5,
          camZ + cosH * 24
        );
        camera.lookAt(this._v2);
      } else {
        const orbitFwdX = Math.sin(this.camYaw);
        const orbitFwdZ = Math.cos(this.camYaw);
        const walkBob =
          Math.hypot(this.playerPhys.vx, this.playerPhys.vz) > 0.6
            ? Math.sin(this.playerPhys.walkDist * 4.4) * 0.045
            : 0;
        const eyeY =
          this.playerPhys.y + (storeState.inCover ? 1.12 : 1.62) + walkBob;
        camera.position.set(
          this.playerPhys.x + orbitFwdX * 0.12,
          eyeY,
          this.playerPhys.z + orbitFwdZ * 0.12
        );
        const lookPitchShift = (0.28 - this.camPitch) * 12;
        this._v2.set(
          this.playerPhys.x + orbitFwdX * 18,
          eyeY + lookPitchShift,
          this.playerPhys.z + orbitFwdZ * 18
        );
        camera.lookAt(this._v2);
      }
      if (this.cameraTrauma > 0) {
        const shake = this.cameraTrauma * this.cameraTrauma * 0.2;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
      }
    } else {
      if (!this.playerPhys.drivingVehicleId && !this.playerRig.group.visible) {
        this.playerRig.group.visible = true;
      }
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

      const isCinematic = camMode === 'cinematic';
      const cineSway = isCinematic ? Math.sin(nowMs * 0.00055) * 0.42 : 0;
      const effectiveYaw = this.camYaw + cineSway;
      const baseElevY = activeVehicle ? activeVehicle.y : this.playerPhys.y;
      const orbitFwdX = Math.sin(effectiveYaw);
      const orbitFwdZ = Math.cos(effectiveYaw);
      const orbitRightX = -Math.cos(effectiveYaw);
      const orbitRightZ = Math.sin(effectiveYaw);

      const gForceCamOffset =
        isDriving && activeVehicle
          ? moveForward > 0.4
            ? 0.75
            : activeVehicle.isBraking
            ? -0.55
            : 0
          : 0;
      const camDist =
        (isTpsAim
          ? 4.4
          : isCinematic
          ? (isDriving ? 14.2 : 11.4) + speedRatio * 1.6
          : isDriving
          ? 12.2 + speedRatio * 1.4
          : 9.8) + gForceCamOffset;
      const effectivePitch = isCinematic ? 0.16 : this.camPitch;
      const horizDist = camDist * Math.cos(effectivePitch);
      const vertOffset = camDist * Math.sin(effectivePitch);

      let desiredX = this.playerPhys.x - orbitFwdX * horizDist;
      let desiredZ = this.playerPhys.z - orbitFwdZ * horizDist;
      let desiredY = baseElevY + (isTpsAim ? 1.55 : isCinematic ? 1.35 : 1.75) + vertOffset;

      if (isTpsAim) {
        desiredX += orbitRightX * 1.1;
        desiredZ += orbitRightZ * 1.1;
      }

      const pulledCam = resolveCameraWallPullIn(
        this.playerPhys.x,
        this.playerPhys.z,
        desiredX,
        desiredY,
        desiredZ,
        this.buildingGrid
      );

      const snapNow =
        this.cameraNeedsSnap ||
        Math.abs(camera.position.y - pulledCam.y) > 25;
      const dampFactor = snapNow
        ? 1
        : exponentialDampFactor(isTpsAim ? 14 : isCinematic ? 5.5 : 8.8, dt);
      this.cameraNeedsSnap = false;

      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        pulledCam.x,
        dampFactor
      );
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        pulledCam.y,
        dampFactor
      );
      camera.position.z = THREE.MathUtils.lerp(
        camera.position.z,
        pulledCam.z,
        dampFactor
      );

      // Subtle off-road rumble micro-shake when speeding off paved asphalt corridors
      if (isDriving && activeVehicle) {
        const offRoadShake = computeOffRoadMicroShake(
          activeVehicle.x,
          activeVehicle.z,
          Math.abs(activeVehicle.speed),
          Boolean(VEHICLE_SPECS[activeVehicle.type].isAircraft)
        );
        if (offRoadShake > 0.001) {
          camera.position.x += Math.sin(nowMs * 0.042) * offRoadShake;
          camera.position.y += Math.cos(nowMs * 0.056) * offRoadShake * 0.75;
        }
      }

      if (this.cameraTrauma > 0) {
        const shake = this.cameraTrauma * this.cameraTrauma * 0.38;
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 2.2);
      }

      const lookDist = isTpsAim ? 14 : isDriving ? 6.2 + speedRatio * 2.4 : 5.2;
      const lookPitchShift = (0.28 - this.camPitch) * (isTpsAim ? 9.5 : 4.5);
      this._v2.set(
        this.playerPhys.x + orbitFwdX * lookDist,
        baseElevY + (isTpsAim ? 1.7 : 2.15) + lookPitchShift,
        this.playerPhys.z + orbitFwdZ * lookDist
      );
      if (snapNow || !this.camLookInitialized) {
        this._camLookTarget.copy(this._v2);
        this.camLookInitialized = true;
      } else {
        const lookDamp = exponentialDampFactor(isTpsAim ? 18 : 11.5, dt);
        this._camLookTarget.lerp(this._v2, lookDamp);
      }
      camera.lookAt(this._camLookTarget);
      if (isDriving && activeVehicle && camMode !== 'cinematic') {
        const cornerRoll =
          -moveTurn * 0.035 * Math.min(1, Math.abs(activeVehicle.speed) / 14);
        camera.rotation.z = cornerRoll;
      } else {
        camera.rotation.z = 0;
      }
    }

    return {
      nearbyInterior,
      nearbyMission,
      activeVehicle,
      spottedByPolice,
      signalPhase,
      isDrifting: Boolean(activeVehicle?.isDrifting),
      turnInput: moveTurn,
    };
  }

  public stepTitleOrbitCamera(
    dt: number,
    camera: THREE.PerspectiveCamera
  ): void {
    this.cameraNeedsSnap = true;
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
    soundEngine.stopDriftAudio();
    this.aimLaserLine.geometry.dispose();
    (this.aimLaserLine.material as THREE.Material).dispose();
    this.aimLaserDot.geometry.dispose();
    (this.aimLaserDot.material as THREE.Material).dispose();
    this.fxPool.dispose();
  }
}

import * as THREE from 'three';
import {
  BuildingFootprint,
  PlayerProgressState,
  PoliceVisionCone,
  RACE_RIVAL_PROFILES,
  RaceRivalTelemetry,
  SpatialHashGrid,
  TRAFFIC_ROUTES,
  TrafficAISteppable,
  TrafficRouteId,
  TrafficSignalPhase,
  TrafficSignalState,
  VEHICLE_SPECS,
  VehicleCustomConfig,
  VehicleDamageState,
  VehicleDamageZone,
  VehicleType,
  applyTirePuncture,
  applyVehicleImpactDamage,
  computeAmbientSkyAndMarinePose,
  computePoliceInterceptVector,
  createInitialTrafficSignalState,
  createInitialVehicleDamage,
  evaluateSpikeStripHit,
  generateInitialTrafficSpawns,
  getGroundElevationAt,
  resolveCircleAABBCollision,
  stepTrafficSignals,
  stepTrafficVehicleInPlace,
  stepVehicleDamageTick,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import {
  applyVehicleCustomizationToMesh,
  buildIndonesianVehicleMesh,
  buildPolicePursuitHeliWithSpotlight,
} from '../game/world/geometryBuilders';
import { gameStore, type RadarVehicleBlip } from '../state/gameStore';
import { cityAudio } from './CityAudio';
import { spatialAudio } from './spatialAudio';

export interface VehicleEntity extends TrafficAISteppable {
  id: string;
  type: VehicleType;
  mesh: THREE.Group;
  y: number;
  fallVy?: number;
  isTraffic: boolean;
  routeId: TrafficRouteId;
  driftAngle: number;
  isDrifting: boolean;
  isBraking?: boolean;
  pitchAngle: number;
  rollAngle: number;
  damage: VehicleDamageState;
  smokeParticleAccum: number;
  highBeamFlashTimer?: number;
  cutOffHonkCooldown?: number;
}

export class TrafficSystem {
  public readonly vehicles: VehicleEntity[] = [];
  public readonly vehicleHeadlight: THREE.SpotLight;
  public readonly sirenLight: THREE.PointLight;
  public readonly policeHeliMesh: THREE.Group;
  public readonly chopperSpotLight: THREE.SpotLight;
  public readonly chopperBeamMesh: THREE.Mesh;
  public signalState: TrafficSignalState;

  private readonly scene: THREE.Scene;
  private readonly buildingGrid: SpatialHashGrid<BuildingFootprint>;
  private readonly roadblockGroup: THREE.Group;
  private readonly roadEventGroup: THREE.Group;
  private readonly constructionSubGroup: THREE.Group;
  private readonly trafficJamSubGroup: THREE.Group;
  private readonly eventBeaconMat: THREE.MeshStandardMaterial;
  private roadblockActive = false;
  private roadblockX = 0;
  private roadblockZ = -42;
  private roadblockCooldown = 0;
  private pendingHornPulse = false;
  private workerAheadBuffer: Float32Array | null = null;
  private readonly ambientSkyHelis: THREE.Group[] = [];
  private readonly ambientBayBoats: THREE.Group[] = [];
  private readonly vigilanteTargetMesh: THREE.Group;
  private readonly raceRivals: {
    id: string;
    name: string;
    colorHex: number;
    baseSpeed: number;
    mesh: THREE.Group;
    x: number;
    y: number;
    z: number;
    heading: number;
    speed: number;
    checkpointIndex: number;
    finished: boolean;
    finishTimeSec: number | null;
  }[] = [];

  constructor(
    scene: THREE.Scene,
    buildingGrid: SpatialHashGrid<BuildingFootprint>
  ) {
    this.scene = scene;
    this.buildingGrid = buildingGrid;
    this.signalState = createInitialTrafficSignalState();

    this.vehicleHeadlight = new THREE.SpotLight(
      0xfef3c7,
      0,
      44,
      Math.PI / 4.2,
      0.58,
      1.35
    );
    this.vehicleHeadlight.castShadow = false;
    scene.add(this.vehicleHeadlight, this.vehicleHeadlight.target);

    this.sirenLight = new THREE.PointLight(0xef4444, 0, 24, 1.7);
    scene.add(this.sirenLight);

    // Parked protagonist fleet across dedicated roadside bays & staging pads (100% clear of active driving lanes)
    const parkedVehicles: {
      type: VehicleType;
      x: number;
      z: number;
      heading: number;
    }[] = [
      { type: 'vtol_jet', x: -15.8, z: -15.4, heading: Math.PI * 0.25 },
      { type: 'bajaj', x: -24.5, z: 25.5, heading: Math.PI * 0.5 },
      { type: 'ojek', x: 24.5, z: 25.5, heading: -Math.PI * 0.5 },
      { type: 'heli', x: 15.2, z: -15.2, heading: -Math.PI * 0.25 },
      { type: 'barracuda', x: -24.5, z: -25.5, heading: -Math.PI * 0.75 },
      { type: 'supercar', x: 11.8, z: 45.0, heading: Math.PI },
      { type: 'supercar', x: 28, z: -26, heading: -Math.PI / 2 },
      { type: 'angkot', x: -11.8, z: 45.5, heading: Math.PI },
      { type: 'sedan', x: 22.0, z: -15.0, heading: 0 },
      { type: 'speedboat', x: -28, z: -82, heading: 0 },
      // Outer Megapolitan parked fleet (Pondok Indah, Kemang, Kelapa Gading, Marunda Bay)
      { type: 'supercar', x: -146, z: 162, heading: Math.PI * 0.5 },
      { type: 'ojek', x: 38, z: 168, heading: 0 },
      { type: 'barracuda', x: 160, z: 48, heading: -Math.PI * 0.5 },
      { type: 'speedboat', x: 152, z: -82, heading: Math.PI },
    ];

    parkedVehicles.forEach((vCfg, idx) => {
      const vMesh = buildIndonesianVehicleMesh(vCfg.type);
      const groundY = getGroundElevationAt(vCfg.x, vCfg.z, 0);
      vMesh.position.set(vCfg.x, groundY, vCfg.z);
      vMesh.rotation.y = vCfg.heading;
      scene.add(vMesh);
      this.vehicles.push({
        id: `veh_${idx}`,
        type: vCfg.type,
        vehicleType: vCfg.type,
        mesh: vMesh,
        x: vCfg.x,
        y: groundY,
        z: vCfg.z,
        heading: vCfg.heading,
        speed: 0,
        isTraffic: false,
        routeId: 'ring_clockwise',
        waypointIndex: 0,
        stopTimer: 0,
        preferredSpeed: 10,
        layer: groundY > 1 ? 'elevated' : 'ground',
        driftAngle: 0,
        isDrifting: false,
        pitchAngle: 0,
        rollAngle: 0,
        damage: createInitialVehicleDamage(),
        smokeParticleAccum: 0,
      });
    });

    // Dynamic Jakarta AI Traffic (TransJakarta, Angkot, Ojol, Bajaj, Metromini, Polisi, Sedan + Barracuda Patwal)
    const trafficSpawns = [
      ...generateInitialTrafficSpawns(),
      {
        id: 'traffic_barracuda_patwal',
        type: 'barracuda' as VehicleType,
        routeId: 'ring_clockwise' as TrafficRouteId,
        waypointIndex: 2,
        x: -26,
        z: 26,
        heading: Math.PI * 0.5,
        preferredSpeed: 13.5,
        layer: 'ground' as const,
      },
    ];
    trafficSpawns.forEach((ts) => {
      const vMesh = buildIndonesianVehicleMesh(ts.type);
      const spawnY =
        ts.layer === 'elevated' ? getGroundElevationAt(ts.x, ts.z) : 0;
      vMesh.position.set(ts.x, spawnY, ts.z);
      vMesh.rotation.y = ts.heading;
      scene.add(vMesh);
      this.vehicles.push({
        id: ts.id,
        type: ts.type,
        vehicleType: ts.type,
        mesh: vMesh,
        x: ts.x,
        y: spawnY,
        z: ts.z,
        heading: ts.heading,
        speed: ts.preferredSpeed * 0.75,
        isTraffic: true,
        routeId: ts.routeId,
        waypointIndex: ts.waypointIndex,
        stopTimer: 0,
        preferredSpeed: ts.preferredSpeed,
        layer: ts.layer,
        ngetemTimer: 0,
        ngetemCooldown: 5,
        weaveOffset: 0,
        hornReactionTimer: 0,
        driftAngle: 0,
        isDrifting: false,
        pitchAngle: 0,
        rollAngle: 0,
        damage: createInitialVehicleDamage(),
        smokeParticleAccum: 0,
      });
    });

    // Police Chopper + Real Searchlight SpotLight + Visible Volumetric Searchlight Cone
    this.policeHeliMesh = buildPolicePursuitHeliWithSpotlight();
    this.policeHeliMesh.position.set(0, 24, -30);
    this.policeHeliMesh.visible = false;
    scene.add(this.policeHeliMesh);

    const beamGeo = new THREE.ConeGeometry(6.8, 25, 16, 1, true);
    beamGeo.translate(0, -12.5, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.chopperBeamMesh = new THREE.Mesh(beamGeo, beamMat);
    this.chopperBeamMesh.position.set(0, -0.8, 0.9);
    this.policeHeliMesh.add(this.chopperBeamMesh);

    this.chopperSpotLight = new THREE.SpotLight(
      0xfef08a,
      0,
      46,
      Math.PI / 5.5,
      0.5,
      1.3
    );
    scene.add(this.chopperSpotLight, this.chopperSpotLight.target);

    // Tactical Police Roadblock Barricade Group (Wanted >= 3)
    this.roadblockGroup = new THREE.Group();
    const blockMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.72,
      metalness: 0.12,
      envMapIntensity: 0.1,
    });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    for (const bx of [-3.2, 0, 3.2]) {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.9, 0.55),
        blockMat
      );
      barrier.position.set(bx, 0.45, 0);
      this.roadblockGroup.add(barrier);

      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.2, 0.58),
        stripeMat
      );
      stripe.position.set(bx, 0.65, 0);
      this.roadblockGroup.add(stripe);
    }
    // Paku Ranjau (Spike Strip) metallic teeth strip in front of police roadblock
    const spikeBaseMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.75,
      roughness: 0.35,
    });
    const spikeStripMesh = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 0.08, 0.45),
      spikeBaseMat
    );
    spikeStripMesh.position.set(0, 0.04, 2.2);
    this.roadblockGroup.add(spikeStripMesh);
    this.roadblockGroup.visible = false;
    scene.add(this.roadblockGroup);

    // Grand Plan 6.0: Ambient Sky Airspace Helicopters & Jakarta Bay Marine Boats
    for (let hi = 0; hi < 2; hi++) {
      const hMesh = buildIndonesianVehicleMesh('heli');
      hMesh.scale.setScalar(0.95);
      hMesh.position.set(0, 32 + hi * 6, 0);
      scene.add(hMesh);
      this.ambientSkyHelis.push(hMesh);
    }
    for (let bi = 0; bi < 2; bi++) {
      const bMesh = buildIndonesianVehicleMesh('speedboat');
      bMesh.position.set(0, 0.18, -110 - bi * 18);
      scene.add(bMesh);
      this.ambientBayBoats.push(bMesh);
    }

    // Vigilante Patrol Fleeing Target Supercar + Overhead Beacon
    this.vigilanteTargetMesh = buildIndonesianVehicleMesh('supercar');
    const vigBeacon = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshBasicMaterial({ color: 0xef4444 })
    );
    vigBeacon.position.y = 2.6;
    this.vigilanteTargetMesh.add(vigBeacon);
    this.vigilanteTargetMesh.visible = false;
    scene.add(this.vigilanteTargetMesh);

    // Dynamic World Clock Road Event 3D Group (Road Construction & Traffic Jam Obstacles)
    this.roadEventGroup = new THREE.Group();
    this.constructionSubGroup = new THREE.Group();
    this.trafficJamSubGroup = new THREE.Group();
    this.eventBeaconMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.2,
      roughness: 0.25,
    });

    const trenchMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.92,
      metalness: 0.08,
    });
    const orangeMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.55,
      metalness: 0.15,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.45,
      metalness: 0.1,
    });

    // 1) Road Construction Sub-Group: Trench, Striped Barricades, Traffic Cones & Flashing Beacons
    const trenchSlab = new THREE.Mesh(
      new THREE.BoxGeometry(6.8, 0.08, 4.2),
      trenchMat
    );
    trenchSlab.position.set(0, 0.04, 0);
    this.constructionSubGroup.add(trenchSlab);

    for (const bx of [-2.8, 0, 2.8]) {
      for (const bz of [-2.4, 2.4]) {
        const barBase = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.95, 0.48),
          orangeMat
        );
        barBase.position.set(bx, 0.48, bz);
        this.constructionSubGroup.add(barBase);

        const barStripe = new THREE.Mesh(
          new THREE.BoxGeometry(2.05, 0.26, 0.52),
          whiteMat
        );
        barStripe.position.set(bx, 0.68, bz);
        this.constructionSubGroup.add(barStripe);

        const beacon = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.16, 0.24, 10),
          this.eventBeaconMat
        );
        beacon.position.set(bx, 1.08, bz);
        this.constructionSubGroup.add(beacon);
      }
    }

    const coneGeo = new THREE.ConeGeometry(0.28, 0.78, 10);
    for (const [cx, cz] of [
      [-4.2, -3.5],
      [4.2, -3.5],
      [-4.2, 3.5],
      [4.2, 3.5],
      [-4.5, 0],
      [4.5, 0],
    ]) {
      const cone = new THREE.Mesh(coneGeo, orangeMat);
      cone.position.set(cx, 0.39, cz);
      this.constructionSubGroup.add(cone);
    }

    // 2) Traffic Jam Sub-Group: Stalled Angkot & Sedan + Hazard Triangle Beacons
    const stalledAngkot = buildIndonesianVehicleMesh('angkot');
    stalledAngkot.position.set(-1.6, 0, -1.2);
    stalledAngkot.rotation.y = 0.42;
    this.trafficJamSubGroup.add(stalledAngkot);

    const stalledSedan = buildIndonesianVehicleMesh('sedan');
    stalledSedan.position.set(1.8, 0, 1.3);
    stalledSedan.rotation.y = -0.52;
    this.trafficJamSubGroup.add(stalledSedan);

    for (const [tx, tz] of [
      [-2.6, -4.2],
      [2.6, 4.2],
      [0, 0],
    ]) {
      const hazardTri = new THREE.Mesh(
        new THREE.ConeGeometry(0.34, 0.65, 4),
        this.eventBeaconMat
      );
      hazardTri.position.set(tx, 0.35, tz);
      this.trafficJamSubGroup.add(hazardTri);
    }

    this.roadEventGroup.add(this.constructionSubGroup, this.trafficJamSubGroup);
    this.roadEventGroup.visible = false;
    scene.add(this.roadEventGroup);
  }

  public setWorkerAheadDistances(buf: Float32Array | null): void {
    this.workerAheadBuffer = buf;
  }

  public notifyHorn(
    px: number,
    pz: number
  ): { x: number; y: number; z: number; type: VehicleType }[] {
    this.pendingHornPulse = true;
    const reacting: {
      dist: number;
      x: number;
      y: number;
      z: number;
      type: VehicleType;
    }[] = [];

    for (const v of this.vehicles) {
      if (!v.isTraffic) continue;
      const dist = Math.hypot(v.x - px, v.z - pz);
      if (dist < 30) {
        v.hornReactionTimer = 1.65;
        // Visible startled swerve / defensive brake reaction
        const sideSign = (v.x - px) * Math.cos(v.heading) - (v.z - pz) * Math.sin(v.heading) >= 0 ? 1 : -1;
        v.weaveOffset = sideSign * 0.85;
        v.rollAngle = -sideSign * 0.08;
        if (v.type === 'angkot') {
          v.ngetemTimer = 0;
          v.stopTimer = 0;
          v.speed = Math.max(v.speed, v.preferredSpeed * 0.95);
        } else {
          v.speed = Math.max(2.5, v.speed * 0.72);
        }
        reacting.push({ dist, x: v.x, y: v.y + 2.35, z: v.z, type: v.type });
      }
    }

    reacting.sort((a, b) => a.dist - b.dist);
    if (reacting.length > 0) {
      const pitch =
        reacting[0].type === 'transjakarta' || reacting[0].type === 'metromini'
          ? 0.72
          : reacting[0].type === 'ojek' || reacting[0].type === 'bajaj'
          ? 1.32
          : 1.04;
      cityAudio.playTrafficResponseHorn(pitch, 0.17);
    }

    return reacting.slice(0, 2).map(({ x, y, z, type }) => ({ x, y, z, type }));
  }

  public spawnVehicleNearPlayer(
    type: VehicleType,
    px: number,
    pz: number,
    facing: number,
    customs: VehicleCustomConfig
  ): { x: number; y: number; z: number } {
    let sx = px + Math.sin(facing) * 4.5;
    let sz = pz + Math.cos(facing) * 4.5;
    for (const existing of this.vehicles) {
      if (existing.y > 2.2) continue;
      const dx = sx - existing.x;
      const dz = sz - existing.z;
      const dist = Math.hypot(dx, dz);
      const minClear = 4.6;
      if (dist < minClear) {
        const pushAngle = dist > 0.05 ? Math.atan2(dx, dz) : facing + Math.PI * 0.5;
        sx = existing.x + Math.sin(pushAngle) * minClear;
        sz = existing.z + Math.cos(pushAngle) * minClear;
      }
    }
    const safe = resolveCircleAABBCollision(
      sx,
      sz,
      2.5,
      undefined,
      this.buildingGrid
    );
    const gY = getGroundElevationAt(safe.x, safe.z, 0);
    const vMesh = buildIndonesianVehicleMesh(type);
    applyVehicleCustomizationToMesh(vMesh, customs);
    vMesh.position.set(safe.x, gY, safe.z);
    vMesh.rotation.y = facing;
    this.scene.add(vMesh);

    this.vehicles.push({
      id: `veh_custom_${Date.now()}`,
      type,
      vehicleType: type,
      mesh: vMesh,
      x: safe.x,
      y: gY,
      z: safe.z,
      heading: facing,
      speed: 0,
      isTraffic: false,
      routeId: 'ring_clockwise',
      waypointIndex: 0,
      stopTimer: 0,
      preferredSpeed: 10,
      layer: gY > 1 ? 'elevated' : 'ground',
      driftAngle: 0,
      isDrifting: false,
      pitchAngle: 0,
      rollAngle: 0,
      damage: createInitialVehicleDamage(),
      smokeParticleAccum: 0,
    });

    return { x: safe.x, y: gY, z: safe.z };
  }

  public applyVehicleImpact(
    veh: VehicleEntity,
    impactForce: number,
    zone: VehicleDamageZone
  ): {
    justCaughtFire: boolean;
    damageApplied: number;
  } {
    const res = applyVehicleImpactDamage(veh.damage, impactForce, zone);
    veh.damage = res.next;
    if (res.damageApplied > 0) {
      this.applyVisualDeformation(veh);
    }
    return {
      justCaughtFire: res.justCaughtFire,
      damageApplied: res.damageApplied,
    };
  }

  public applyVisualDeformation(veh: VehicleEntity): void {
    const dmg = veh.damage;
    const frontCrumple = Math.min(0.14, dmg.zones.front * 0.045);
    const sideCrumple = Math.min(
      0.1,
      (dmg.zones.left + dmg.zones.right) * 0.024
    );
    const rearCrumple = Math.min(0.11, dmg.zones.rear * 0.036);
    veh.mesh.scale.set(
      1 - sideCrumple,
      1 + frontCrumple * 0.18,
      1 - frontCrumple - rearCrumple * 0.6
    );
    if (dmg.exploded) {
      veh.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material.color.setHex(0x1e293b);
          obj.material.roughness = 0.95;
          obj.material.metalness = 0.1;
        }
      });
    }
  }

  public repairVehicle(veh: VehicleEntity): void {
    veh.damage = createInitialVehicleDamage();
    veh.smokeParticleAccum = 0;
    veh.mesh.scale.set(1, 1, 1);
  }

  public stepVehicleDamageAndExplosions(
    dt: number,
    spawnParticles: (
      x: number,
      y: number,
      z: number,
      count: number,
      colorHex: number,
      speed?: number
    ) => void,
    onChainExplosion: (x: number, y: number, z: number, veh: VehicleEntity) => void
  ): void {
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.damage.smokeStage === 'none' && !v.damage.exploded) continue;

      const tick = stepVehicleDamageTick(v.damage, dt);
      v.damage = tick.next;

      if (tick.triggeredExplosion) {
        v.speed = 0;
        this.applyVisualDeformation(v);
        spawnParticles(v.x, v.y + 1.4, v.z, 34, 0xf97316, 15);
        spawnParticles(v.x, v.y + 2.0, v.z, 18, 0xfef08a, 11);
        soundEngine.playPropCrash(0);
        onChainExplosion(v.x, v.y, v.z, v);

        // Chain-reaction blast damages nearby vehicles within 13m
        for (let j = 0; j < this.vehicles.length; j++) {
          if (i === j) continue;
          const other = this.vehicles[j];
          const d = Math.hypot(other.x - v.x, other.z - v.z);
          if (d < 13 && !other.damage.exploded) {
            this.applyVehicleImpact(other, Math.max(6, (13 - d) * 1.3), 'front');
          }
        }
        continue;
      }

      v.smokeParticleAccum += dt;
      const emitInterval =
        v.damage.smokeStage === 'fire'
          ? 0.08
          : v.damage.smokeStage === 'heavy_smoke'
          ? 0.16
          : 0.28;
      if (v.smokeParticleAccum >= emitInterval) {
        v.smokeParticleAccum = 0;
        const hoodX = v.x + Math.sin(v.heading) * 1.4;
        const hoodZ = v.z + Math.cos(v.heading) * 1.4;
        if (v.damage.smokeStage === 'fire') {
          spawnParticles(hoodX, v.y + 1.25, hoodZ, 3, 0xf97316, 5.2);
          spawnParticles(hoodX, v.y + 1.45, hoodZ, 2, 0x1e293b, 3.6);
        } else if (v.damage.smokeStage === 'heavy_smoke') {
          spawnParticles(hoodX, v.y + 1.2, hoodZ, 2, 0x334155, 3.2);
        } else if (v.damage.smokeStage === 'steam') {
          spawnParticles(hoodX, v.y + 1.15, hoodZ, 1, 0xcbd5e1, 2.4);
        }
      }
    }
  }

  public updateVisualsAndAircraft(
    dt: number,
    nowMs: number,
    drivingVehicleId: string | null,
    pState: PlayerProgressState,
    isPlaying: boolean,
    playerX: number,
    playerZ: number,
    nightFactor: number = 0.5
  ): void {
    const customs = pState.vehicleCustoms;
    const customsKey = `${customs.paintId}|${customs.underglowId}|${customs.armorPlatingLevel}|${customs.nitroEnabled}`;
    const sirenPhaseRed = Math.floor(nowMs / 115) % 2 === 0;

    for (const v of this.vehicles) {
      const isPlayerVeh = v.id === drivingVehicleId;
      const dSq =
        (v.x - playerX) * (v.x - playerX) + (v.z - playerZ) * (v.z - playerZ);
      if (!isPlayerVeh && dSq > 195 * 195) {
        if (v.mesh.visible) v.mesh.visible = false;
        continue;
      }
      if (!v.mesh.visible) v.mesh.visible = true;

      if (v.type === 'heli' || v.type === 'vtol_jet') {
        const rotor =
          (v.mesh.userData.mainRotor as THREE.Object3D | undefined) ||
          v.mesh.getObjectByName('heliRotor');
        if (rotor) {
          v.mesh.userData.mainRotor = rotor;
          rotor.rotation.y += dt * (isPlayerVeh ? 22 : 4.5);
        }
      } else if (isPlayerVeh || dSq <= 95 * 95) {
        // Spin 3D wheels proportionally to linear speed + steer front wheels + punctured tire slump
        const wheels = v.mesh.userData.wheels as THREE.Object3D[] | undefined;
        if (wheels) {
          const spinDelta = Math.abs(v.speed) > 0.05 ? v.speed * dt : 0;
          for (let wi = 0; wi < wheels.length; wi++) {
            const wObj = wheels[wi];
            const radius = (wObj.userData.wheelRadius as number) || 0.38;
            if (spinDelta !== 0) {
              wObj.rotation.x += spinDelta / radius;
            }
            const isFlat = Boolean(v.damage.puncturedTires[wi % 4]);
            wObj.scale.set(1, isFlat ? 0.72 : 1, isFlat ? 0.72 : 1);
            wObj.rotation.z = isFlat ? (wi % 2 === 0 ? 0.14 : -0.14) : 0;
          }
        }
        const frontPivots = v.mesh.userData.frontWheelPivots as THREE.Group[] | undefined;
        if (frontPivots && frontPivots.length > 0) {
          const targetSteer = v.isDrifting
            ? THREE.MathUtils.clamp(-v.driftAngle * 1.15, -0.45, 0.45)
            : v.id === drivingVehicleId
            ? THREE.MathUtils.clamp((v.rollAngle || 0) * -2.8, -0.38, 0.38)
            : 0;
          for (let pi = 0; pi < frontPivots.length; pi++) {
            frontPivots[pi].rotation.y = THREE.MathUtils.damp(
              frontPivots[pi].rotation.y,
              targetSteer,
              12,
              dt
            );
          }
        }
      }

      if (v.highBeamFlashTimer && v.highBeamFlashTimer > 0) {
        v.highBeamFlashTimer = Math.max(0, v.highBeamFlashTimer - dt);
      }
      if (v.cutOffHonkCooldown && v.cutOffHonkCooldown > 0) {
        v.cutOffHonkCooldown = Math.max(0, v.cutOffHonkCooldown - dt);
      }

      // Brake / reverse taillight dynamic color & emissive flare
      const tailMat = v.mesh.userData.taillightMat as
        | THREE.MeshStandardMaterial
        | undefined;
      if (tailMat) {
        const isReversing = v.id === drivingVehicleId && v.speed < -0.35;
        const isBraking =
          !isReversing &&
          (v.isDrifting ||
            Boolean(v.isBraking) ||
            (v.isTraffic && (v.speed < 1.5 || (v.hornReactionTimer ?? 0) > 1.0)));

        if (isReversing) {
          tailMat.color.setHex(0xf8fafc);
          tailMat.emissive.setHex(0xffffff);
          tailMat.emissiveIntensity = 3.8;
        } else if (isBraking) {
          tailMat.color.setHex(0xff0f22);
          tailMat.emissive.setHex(0xff1122);
          tailMat.emissiveIntensity = 4.2;
        } else {
          tailMat.color.setHex(0xb91c1c);
          tailMat.emissive.setHex(0xef4444);
          tailMat.emissiveIntensity = 0.72 + nightFactor * 0.65;
        }
      }

      // Night headlight glow, high-beam flash on cut-off, & additive headlight cones
      const headMat = v.mesh.userData.headlightMat as
        | THREE.MeshStandardMaterial
        | undefined;
      const bothHeadlightsBroken =
        v.damage.headlightsBroken[0] && v.damage.headlightsBroken[1];
      const oneHeadlightBroken =
        v.damage.headlightsBroken[0] || v.damage.headlightsBroken[1];
      const isFlashingHighBeam =
        (v.highBeamFlashTimer ?? 0) > 0 &&
        Math.sin((v.highBeamFlashTimer ?? 0) * 28) > 0;
      if (headMat) {
        headMat.emissiveIntensity = bothHeadlightsBroken
          ? 0.05
          : isFlashingHighBeam
          ? 4.8
          : (0.55 + nightFactor * 2.25) * (oneHeadlightBroken ? 0.55 : 1.0);
      }
      const coneMat = v.mesh.userData.headlightConeMat as
        | THREE.MeshBasicMaterial
        | undefined;
      if (coneMat) {
        const activeOrMoving = v.id === drivingVehicleId || v.isTraffic;
        coneMat.opacity =
          !bothHeadlightsBroken && activeOrMoving
            ? isFlashingHighBeam
              ? 0.34
              : nightFactor > 0.16
              ? (nightFactor - 0.16) *
                (v.id === drivingVehicleId ? 0.24 : 0.14) *
                (oneHeadlightBroken ? 0.52 : 1.0)
              : 0
            : 0;
      }

      // Alternating red/blue police lightbars on Patwal & Barracuda units
      const sirenRedMat = v.mesh.userData.sirenRedMat as
        | THREE.MeshStandardMaterial
        | undefined;
      const sirenBlueMat = v.mesh.userData.sirenBlueMat as
        | THREE.MeshStandardMaterial
        | undefined;
      if (sirenRedMat && sirenBlueMat) {
        const sirenOn =
          pState.wantedLevel > 0 ||
          (v.id === drivingVehicleId &&
            (v.type === 'polisi' || v.type === 'barracuda'));
        sirenRedMat.emissiveIntensity = sirenOn
          ? sirenPhaseRed
            ? 2.8
            : 0.25
          : 0.45;
        sirenBlueMat.emissiveIntensity = sirenOn
          ? !sirenPhaseRed
            ? 2.8
            : 0.25
          : 0.45;
      }

      if (v.id === drivingVehicleId || v.type === 'supercar') {
        if (v.mesh.userData.lastCustomsKey !== customsKey) {
          v.mesh.userData.lastCustomsKey = customsKey;
          applyVehicleCustomizationToMesh(v.mesh, customs);
        }
      }
    }

    const kiranaBlackout = gameStore.getState().kiranaHackState.cameraBlackout;
    if (
      pState.wantedLevel >= 3 &&
      pState.currentInterior === 'exterior' &&
      isPlaying &&
      !kiranaBlackout
    ) {
      this.policeHeliMesh.visible = true;
      const heliOrbit = nowMs * 0.0014;
      const hx = playerX + Math.cos(heliOrbit) * 9.5;
      const hz = playerZ + Math.sin(heliOrbit) * 9.5;
      this.policeHeliMesh.position.set(hx, 22.5, hz);
      this.policeHeliMesh.rotation.y = -heliOrbit + Math.PI;
      const pRotor = this.policeHeliMesh.getObjectByName('heliRotor');
      if (pRotor) pRotor.rotation.y += dt * 24;

      this.chopperSpotLight.position.set(hx, 21.8, hz);
      this.chopperSpotLight.target.position.set(
        playerX + Math.sin(heliOrbit * 0.6) * 2.5,
        0,
        playerZ + Math.cos(heliOrbit * 0.6) * 2.5
      );
      this.chopperSpotLight.intensity = 5.5;
    } else {
      this.policeHeliMesh.visible = false;
      this.chopperSpotLight.intensity = 0;
    }

    // Sync World Clock Road Event 3D Obstacle Group
    const activeRoadEvent =
      gameStore.getState().worldClockEventState.activeEvent;
    if (
      activeRoadEvent &&
      pState.currentInterior === 'exterior' &&
      isPlaying
    ) {
      this.roadEventGroup.visible = true;
      this.roadEventGroup.position.set(
        activeRoadEvent.spec.x,
        0,
        activeRoadEvent.spec.z
      );
      this.roadEventGroup.rotation.y = activeRoadEvent.spec.heading;
      const isConstruction = activeRoadEvent.spec.kind === 'road_construction';
      this.constructionSubGroup.visible = isConstruction;
      this.trafficJamSubGroup.visible = !isConstruction;
      this.eventBeaconMat.emissiveIntensity =
        Math.floor(nowMs / 220) % 2 === 0 ? 2.8 : 0.45;
    } else {
      this.roadEventGroup.visible = false;
    }
  }

  public stepTrafficAI(
    simDt: number,
    nowMs: number,
    drivingVehicleId: string | null,
    activeVehicle: VehicleEntity | null,
    pState: PlayerProgressState,
    playerX: number,
    playerY: number,
    playerZ: number,
    nightFactor: number,
    isWheelSlowMo: boolean
  ): { spottedByPolice: boolean; signalPhase: TrafficSignalPhase } {
    const hornTriggered = this.pendingHornPulse;
    this.pendingHornPulse = false;

    const kiranaHack = gameStore.getState().kiranaHackState;
    this.signalState = stepTrafficSignals(this.signalState, simDt);
    const signalPhase: TrafficSignalPhase = kiranaHack.forceGreenLights
      ? 'ns_green'
      : this.signalState.phase;

    // Step Ambient Jakarta Sky Helicopters & Bay Coastal Boats
    const skySea = computeAmbientSkyAndMarinePose(nowMs * 0.001);
    const skyPoses = [skySea.skyHeli1, skySea.skyHeli2];
    for (let hi = 0; hi < this.ambientSkyHelis.length; hi++) {
      const h = this.ambientSkyHelis[hi];
      const p = skyPoses[hi];
      h.position.set(p.x, p.y, p.z);
      h.rotation.y = p.heading;
      const rotor = h.getObjectByName('mainRotor');
      if (rotor) rotor.rotation.y += simDt * 24;
    }
    const seaPoses = [skySea.bayBoat1, skySea.bayBoat2];
    for (let bi = 0; bi < this.ambientBayBoats.length; bi++) {
      const b = this.ambientBayBoats[bi];
      const p = seaPoses[bi];
      b.position.set(p.x, p.y + Math.sin(nowMs * 0.003 + bi) * 0.08, p.z);
      b.rotation.y = p.heading;
    }

    // Tactical Police Roadblock (Wanted >= 3)
    this.roadblockCooldown = Math.max(0, this.roadblockCooldown - simDt);
    if (
      pState.wantedLevel >= 3 &&
      pState.currentInterior === 'exterior'
    ) {
      if (
        !this.roadblockActive ||
        (Math.hypot(this.roadblockX - playerX, this.roadblockZ - playerZ) > 68 &&
          this.roadblockCooldown <= 0)
      ) {
        const anchorZ = playerZ > 56 ? 96 : playerZ > 0 ? 54 : -48;
        this.roadblockX = Math.abs(playerX) < 16 ? 0 : playerX > 0 ? 32 : -32;
        this.roadblockZ = anchorZ;
        this.roadblockGroup.position.set(this.roadblockX, 0, this.roadblockZ);
        this.roadblockGroup.rotation.y = 0;
        this.roadblockActive = true;
        this.roadblockCooldown = 8;
      }
      this.roadblockGroup.visible = this.roadblockActive;

      // Check collision if player rams through barricade or hits spike strip (paku ranjau)
      if (this.roadblockActive && activeVehicle && activeVehicle.y < 2.2) {
        const spikeEval = evaluateSpikeStripHit(
          playerX,
          playerZ,
          this.roadblockX,
          this.roadblockZ,
          this.roadblockActive,
          pState.wantedLevel
        );
        if (spikeEval.hit) {
          activeVehicle.speed *= spikeEval.speedMultiplier;
          activeVehicle.driftAngle += spikeEval.angularImpulse * 0.25;
          activeVehicle.damage = applyTirePuncture(activeVehicle.damage, [0, 1]);
          this.applyVisualDeformation(activeVehicle);
          this.roadblockActive = false;
          this.roadblockGroup.visible = false;
          this.roadblockCooldown = 10;
          soundEngine.playPropCrash(0);
          gameStore.setState((prev) => ({
            policeTactical: {
              ...prev.policeTactical,
              spikeStripsHitCount: prev.policeTactical.spikeStripsHitCount + 1,
              radioCallout:
                'Unit Barikade: Ban suspek pecah kena paku ranjau! Rapatkan formasi!',
              radioCalloutStamp: Date.now(),
            },
            lastOutcomeText:
              'AWAS! Ban depan pecah terkena paku ranjau polisi — handling berat & kecepatan turun!',
          }));
        }
      }
    } else {
      this.roadblockActive = false;
      this.roadblockGroup.visible = false;
    }

    let spottedByPolice = false;
    // Police Helicopter Searchlight cone detection (can evade under Tol Layang cover!)
    if (
      pState.wantedLevel >= 3 &&
      this.policeHeliMesh.visible &&
      pState.currentInterior === 'exterior'
    ) {
      const spotTarget = this.chopperSpotLight.target.position;
      const inCone = Math.hypot(playerX - spotTarget.x, playerZ - spotTarget.z) < 8.5;
      const underOverpassCover =
        Math.abs(playerZ - 80) < 5.5 && Math.abs(playerX) <= 44 && playerY < 4.0;
      if (inCone && !underOverpassCover) {
        spottedByPolice = true;
      }
    }

    const playerVx = activeVehicle
      ? Math.sin(activeVehicle.heading) * activeVehicle.speed
      : 0;
    const playerVz = activeVehicle
      ? Math.cos(activeVehicle.heading) * activeVehicle.speed
      : 0;

    for (let vi = 0; vi < this.vehicles.length; vi++) {
      const v = this.vehicles[vi];
      if (v.id === drivingVehicleId) continue;
      if (!v.isTraffic) {
        const groundY = getGroundElevationAt(v.x, v.z, v.y);
        let moved = false;

        // Unmanned coasting momentum (e.g. after GTA high-speed bail-out)
        if (Math.abs(v.speed) > 0.25) {
          v.speed *= Math.exp(-2.1 * simDt);
          const nx = v.x + Math.sin(v.heading) * v.speed * simDt;
          const nz = v.z + Math.cos(v.heading) * v.speed * simDt;
          const col = resolveCircleAABBCollision(
            nx,
            nz,
            VEHICLE_SPECS[v.type].radius,
            undefined,
            this.buildingGrid
          );
          if (col.collided) {
            v.speed *= -0.2;
          }
          v.x = col.x;
          v.z = col.z;
          moved = true;
        } else if (v.speed !== 0) {
          v.speed = 0;
          v.isBraking = false;
        }

        // Smooth gravity descent when an unmanned vehicle/aircraft is left mid-air
        if (v.y > groundY + 0.12) {
          v.fallVy = (v.fallVy ?? 0) - 18.5 * simDt;
          v.y = Math.max(groundY, v.y + v.fallVy * simDt);
          if (v.y <= groundY + 0.05) {
            v.y = groundY;
            v.fallVy = 0;
          }
          moved = true;
        } else {
          v.fallVy = 0;
          if (Math.abs(v.y - groundY) > 0.01) {
            v.y = groundY;
            moved = true;
          }
        }

        if (moved) {
          v.mesh.position.set(v.x, v.y, v.z);
          v.mesh.rotation.y = v.heading;
        }
        continue;
      }

      if (
        (v.type === 'polisi' && pState.wantedLevel > 0) ||
        (v.type === 'barracuda' && pState.wantedLevel >= 4)
      ) {
        const kiranaEmp =
          pState.activeProtagonist === 'kirana' && pState.fokusActive;
        const pSpeed = kiranaEmp ? 1.5 : 13.5 + pState.wantedLevel * 1.4;
        const intercept = computePoliceInterceptVector(
          v.x,
          v.z,
          playerX,
          playerZ,
          playerVx,
          playerVz,
          pState.wantedLevel
        );
        if (intercept.distance < 32) {
          spottedByPolice = true;
        }
        if (intercept.distance > 5.0) {
          let moveX = intercept.dirX;
          let moveZ = intercept.dirZ;
          // Mild lateral avoidance around nearby vehicles so pursuit units flank instead of stacking
          for (let oi = 0; oi < this.vehicles.length; oi++) {
            if (oi === vi) continue;
            const other = this.vehicles[oi];
            if (Math.abs(other.y - v.y) > 2.2) continue;
            const dxO = v.x - other.x;
            const dzO = v.z - other.z;
            const dSq = dxO * dxO + dzO * dzO;
            if (dSq > 0.01 && dSq < 28) {
              const d = Math.sqrt(dSq);
              const w = (5.3 - d) / 5.3;
              moveX += (dxO / d) * w * 0.9;
              moveZ += (dzO / d) * w * 0.9;
            }
          }
          const mLen = Math.hypot(moveX, moveZ) || 1;
          moveX /= mLen;
          moveZ /= mLen;
          v.heading = Math.atan2(moveX, moveZ);
          v.speed = pSpeed;
          const nx = v.x + moveX * pSpeed * simDt;
          const nz = v.z + moveZ * pSpeed * simDt;
          const col = resolveCircleAABBCollision(
            nx,
            nz,
            2.2,
            undefined,
            this.buildingGrid
          );
          v.x = col.x;
          v.z = col.z;
        }
        v.y = getGroundElevationAt(v.x, v.z, v.y);
      } else {
        let minAheadDist = 999;
        const sinH = Math.sin(v.heading);
        const cosH = Math.cos(v.heading);
        const rV = VEHICLE_SPECS[v.type]?.radius ?? 1.9;
        void this.workerAheadBuffer;

        for (let oi = 0; oi < this.vehicles.length; oi++) {
          if (oi === vi) continue;
          const other = this.vehicles[oi];
          if (Math.abs(other.y - v.y) > 2.2) continue;
          if (
            (other.type === 'heli' || other.type === 'vtol_jet') &&
            other.y > 2.2
          ) {
            continue;
          }
          const rOther = VEHICLE_SPECS[other.type]?.radius ?? 1.9;
          const dxO = other.x - v.x;
          const dzO = other.z - v.z;
          const fwdDot = dxO * sinH + dzO * cosH;
          const latDist = Math.abs(dxO * cosH - dzO * sinH);
          const latCorridor = rV + rOther + 0.35;

          if (fwdDot >= -0.3 && latDist < latCorridor) {
            const bumperGap = Math.max(0, fwdDot - (rV + rOther) * 0.45);
            if (bumperGap < minAheadDist) {
              minAheadDist = bumperGap;
            }
          } else if (
            other.isTraffic &&
            other.speed > 0.8 &&
            fwdDot > 0.5 &&
            fwdDot < 11.5 &&
            latDist < 9.5
          ) {
            // Intersection cross-traffic yield: prevent 90-degree crashes while breaking symmetric ties by ID
            const oSin = Math.sin(other.heading);
            const oCos = Math.cos(other.heading);
            const headingDot = sinH * oSin + cosH * oCos;
            if (headingDot < 0.45) {
              const otherFwd = -dxO * oSin - dzO * oCos;
              if (otherFwd > -1.0 && otherFwd < 10.0) {
                const shouldYield =
                  otherFwd + 1.0 < fwdDot ||
                  (Math.abs(otherFwd - fwdDot) <= 1.0 && v.id > other.id);
                if (shouldYield) {
                  const crossStop = Math.max(0, fwdDot - (rV + rOther + 0.8));
                  if (crossStop < minAheadDist) {
                    minAheadDist = crossStop;
                  }
                }
              }
            }
          }
        }

        if (Math.abs(playerY - v.y) < 2.2) {
          const dxP = playerX - v.x;
          const dzP = playerZ - v.z;
          const fwdP = dxP * sinH + dzP * cosH;
          if (fwdP >= 0 && fwdP < 18) {
            const latP = Math.abs(dxP * cosH - dzP * sinH);
            if (latP < rV + 1.4) {
              minAheadDist = Math.min(minAheadDist, Math.max(0, fwdP - rV * 0.5));
              if (
                fwdP > 1.2 &&
                fwdP < 9.2 &&
                latP < rV + 1.05 &&
                (v.cutOffHonkCooldown ?? 0) <= 0
              ) {
                v.highBeamFlashTimer = 1.35;
                v.cutOffHonkCooldown = 4.5;
                const pitch =
                  v.type === 'bajaj' || v.type === 'ojek'
                    ? 1.32
                    : v.type === 'transjakarta' || v.type === 'metromini'
                    ? 0.72
                    : 1.04;
                cityAudio.playTrafficResponseHorn(pitch, 0.08);
              }
            }
          }
        }

        const route = TRAFFIC_ROUTES[v.routeId];
        stepTrafficVehicleInPlace(v, route, minAheadDist, simDt, {
          playerWantedLevel: pState.wantedLevel,
          hornTriggered:
            hornTriggered && Math.hypot(v.x - playerX, v.z - playerZ) < 30,
          signalPhase: kiranaHack.forceGreenLights ? undefined : signalPhase,
          buildingGrid: this.buildingGrid,
          activeRoadEvent:
            gameStore.getState().worldClockEventState.activeEvent,
        });
        v.y =
          v.layer === 'elevated'
            ? getGroundElevationAt(v.x, v.z, Math.max(v.y, 6.2))
            : getGroundElevationAt(v.x, v.z, v.y);
      }

      v.mesh.position.set(v.x, v.y, v.z);
      v.mesh.rotation.y = v.heading + (v.isDrifting ? v.driftAngle * 0.25 : 0);
      if (v.type !== 'heli' && v.type !== 'vtol_jet') {
        v.mesh.rotation.x = v.pitchAngle || 0;
        v.mesh.rotation.z = v.rollAngle || 0;
      }

      if (hornTriggered && Math.hypot(v.x - playerX, v.z - playerZ) < 26) {
        if (v.type === 'transjakarta') {
          spatialAudio.playTransJakartaHorn3D(v.x, v.y, v.z);
        } else if (v.type === 'ojek') {
          spatialAudio.playOjolHorn3D(v.x, v.y, v.z);
        }
      }
    }

    // Soft elastic vehicle-vehicle separation to prevent clipping & intersecting pile-ups
    for (let i = 0; i < this.vehicles.length; i++) {
      const vA = this.vehicles[i];
      if (!vA.isTraffic || vA.id === drivingVehicleId) continue;
      if ((vA.type === 'heli' || vA.type === 'vtol_jet') && vA.y > 2.2) continue;
      const specA = VEHICLE_SPECS[vA.type];
      const rA = specA ? specA.radius * 0.78 : 1.5;
      for (let j = i + 1; j < this.vehicles.length; j++) {
        const vB = this.vehicles[j];
        if (vB.id === drivingVehicleId) continue;
        if ((vB.type === 'heli' || vB.type === 'vtol_jet') && vB.y > 2.2) continue;
        if (Math.abs(vA.y - vB.y) > 1.8) continue;
        if (vA.layer !== vB.layer) continue;
        const dx = vB.x - vA.x;
        const dz = vB.z - vA.z;
        const distSq = dx * dx + dz * dz;
        const specB = VEHICLE_SPECS[vB.type];
        const rB = specB ? specB.radius * 0.78 : 1.5;
        const minDist = rA + rB;
        if (distSq > 0.0001 && distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          const pushFraction = overlap * 0.55 * Math.min(1, simDt * 8);
          const pushX = (dx / dist) * pushFraction;
          const pushZ = (dz / dist) * pushFraction;
          const safeA =
            vA.layer === 'elevated'
              ? { x: vA.x - pushX, z: vA.z - pushZ }
              : resolveCircleAABBCollision(
                  vA.x - pushX,
                  vA.z - pushZ,
                  rA,
                  undefined,
                  this.buildingGrid
                );
          vA.x = safeA.x;
          vA.z = safeA.z;
          vA.mesh.position.x = vA.x;
          vA.mesh.position.z = vA.z;
          if (vB.isTraffic) {
            const safeB =
              vB.layer === 'elevated'
                ? { x: vB.x + pushX, z: vB.z + pushZ }
                : resolveCircleAABBCollision(
                    vB.x + pushX,
                    vB.z + pushZ,
                    rB,
                    undefined,
                    this.buildingGrid
                  );
            vB.x = safeB.x;
            vB.z = safeB.z;
            vB.mesh.position.x = vB.x;
            vB.mesh.position.z = vB.z;
          }
        }
      }
    }

    // Active Vehicle Headlights & Cabin Acoustic Muffling
    soundEngine.setVehicleCabinMuffle(Boolean(activeVehicle));
    if (activeVehicle && pState.currentInterior === 'exterior') {
      const vSpec = VEHICLE_SPECS[activeVehicle.type];
      const speedRatio =
        Math.abs(activeVehicle.speed) / Math.max(1, vSpec.maxSpeed);
      soundEngine.updateEngineAudio(
        speedRatio,
        true,
        Boolean(vSpec.isAircraft),
        pState.fokusActive,
        !isWheelSlowMo,
        activeVehicle.type
      );

      if (nightFactor > 0.04) {
        const hFwdX = Math.sin(activeVehicle.heading);
        const hFwdZ = Math.cos(activeVehicle.heading);
        this.vehicleHeadlight.position.set(
          activeVehicle.x + hFwdX * 1.5,
          activeVehicle.y + 1.15,
          activeVehicle.z + hFwdZ * 1.5
        );
        this.vehicleHeadlight.target.position.set(
          activeVehicle.x + hFwdX * 16,
          activeVehicle.y + 0.1,
          activeVehicle.z + hFwdZ * 16
        );
        const brokenCount =
          (activeVehicle.damage.headlightsBroken[0] ? 1 : 0) +
          (activeVehicle.damage.headlightsBroken[1] ? 1 : 0);
        const flicker =
          brokenCount === 1
            ? Math.sin(nowMs * 0.042) > -0.35
              ? 0.58
              : 0.14
            : brokenCount >= 2
            ? Math.sin(nowMs * 0.065) > 0.72
              ? 0.28
              : 0
            : 1.0;
        this.vehicleHeadlight.intensity = nightFactor * 4.6 * flicker;
      } else {
        this.vehicleHeadlight.intensity = 0;
      }
    } else {
      this.vehicleHeadlight.intensity = 0;
      soundEngine.updateEngineAudio(0, false, false, false, false);
    }

    if (pState.wantedLevel > 0 && pState.currentInterior === 'exterior') {
      let nearestPolice: VehicleEntity | null = null;
      let bestPoliceDist = 48;
      for (const v of this.vehicles) {
        if (v.type !== 'polisi' && v.type !== 'barracuda') continue;
        const dPol = Math.hypot(v.x - playerX, v.z - playerZ);
        if (dPol < bestPoliceDist) {
          bestPoliceDist = dPol;
          nearestPolice = v;
        }
      }
      if (nearestPolice) {
        this.sirenLight.position.set(
          nearestPolice.x,
          nearestPolice.y + 2.1,
          nearestPolice.z
        );
        const sirenRedPhase = Math.floor(nowMs / 115) % 2 === 0;
        this.sirenLight.color.setHex(sirenRedPhase ? 0xef4444 : 0x3b82f6);
        this.sirenLight.intensity = 4.2;
        if (Math.floor(nowMs / 320) !== Math.floor((nowMs - simDt * 1000) / 320)) {
          const polVx = Math.sin(nearestPolice.heading) * nearestPolice.speed;
          const polVz = Math.cos(nearestPolice.heading) * nearestPolice.speed;
          spatialAudio.playPoliceSiren3D(
            nearestPolice.x,
            nearestPolice.y,
            nearestPolice.z,
            sirenRedPhase,
            polVx,
            polVz
          );
        }
      } else {
        this.sirenLight.intensity = 0;
      }
    } else {
      this.sirenLight.intensity = 0;
    }

    return { spottedByPolice, signalPhase };
  }

  public getNearbyVehicleType(px: number, pz: number): VehicleType | null {
    let nearbyVehType: VehicleType | null = null;
    let bestD = 6.2;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d < bestD) {
        bestD = d;
        nearbyVehType = v.type;
      }
    }
    return nearbyVehType;
  }

  public writeRadarSnapshot(out: RadarVehicleBlip[]): void {
    out.length = this.vehicles.length;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (!out[i]) {
        out[i] = { id: v.id, type: v.type, x: v.x, z: v.z, heading: v.heading };
      } else {
        out[i].id = v.id;
        out[i].type = v.type;
        out[i].x = v.x;
        out[i].z = v.z;
        out[i].heading = v.heading;
      }
    }
  }

  public writePoliceVisionCones(
    out: PoliceVisionCone[],
    wantedLevel: number
  ): void {
    let count = 0;
    if (wantedLevel > 0) {
      for (let i = 0; i < this.vehicles.length; i++) {
        const v = this.vehicles[i];
        if (v.type !== 'polisi' && v.type !== 'barracuda') continue;
        const range = v.type === 'barracuda' ? 32 : 26;
        if (!out[count]) {
          out[count] = {
            id: v.id,
            x: v.x,
            z: v.z,
            heading: v.heading,
            range,
            halfAngleRad: 0.44,
            isHeli: false,
          };
        } else {
          out[count].id = v.id;
          out[count].x = v.x;
          out[count].z = v.z;
          out[count].heading = v.heading;
          out[count].range = range;
          out[count].halfAngleRad = 0.44;
          out[count].isHeli = false;
        }
        count++;
      }
      if (this.policeHeliMesh.visible) {
        const tgt = this.chopperSpotLight.target.position;
        if (!out[count]) {
          out[count] = {
            id: 'heli_searchlight',
            x: tgt.x,
            z: tgt.z,
            heading: 0,
            range: 9.5,
            halfAngleRad: Math.PI,
            isHeli: true,
          };
        } else {
          out[count].id = 'heli_searchlight';
          out[count].x = tgt.x;
          out[count].z = tgt.z;
          out[count].heading = 0;
          out[count].range = 9.5;
          out[count].halfAngleRad = Math.PI;
          out[count].isHeli = true;
        }
        count++;
      }
    }
    out.length = count;
  }

  public startRaceRivals(
    checkpoints: [number, number][],
    startX: number,
    startZ: number,
    startHeading: number
  ): void {
    this.clearRaceRivals();
    const rightX = Math.cos(startHeading);
    const rightZ = -Math.sin(startHeading);
    const fwdX = Math.sin(startHeading);
    const fwdZ = Math.cos(startHeading);

    RACE_RIVAL_PROFILES.forEach((profile, idx) => {
      const mesh = buildIndonesianVehicleMesh('supercar');
      mesh.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshStandardMaterial &&
          child.userData.isBodyPaint
        ) {
          child.material = child.material.clone();
          child.material.color.setHex(profile.colorHex);
          child.material.metalness = 0.72;
          child.material.roughness = 0.22;
        }
      });
      const laneOffset = idx === 0 ? -3.4 : idx === 1 ? 3.4 : 0;
      const rowOffset = idx === 2 ? -5.8 : -2.2;
      const rx = startX + rightX * laneOffset + fwdX * rowOffset;
      const rz = startZ + rightZ * laneOffset + fwdZ * rowOffset;
      const ry = getGroundElevationAt(rx, rz);
      mesh.position.set(rx, ry, rz);
      mesh.rotation.y = startHeading;
      this.scene.add(mesh);

      this.raceRivals.push({
        id: profile.id,
        name: profile.name,
        colorHex: profile.colorHex,
        baseSpeed: profile.baseSpeed,
        mesh,
        x: rx,
        y: ry,
        z: rz,
        heading: startHeading,
        speed: 0,
        checkpointIndex: 0,
        finished: false,
        finishTimeSec: null,
      });
    });
    void checkpoints;
  }

  public stepRaceRivals(
    dt: number,
    checkpoints: [number, number][],
    elapsedSec: number,
    isRacing: boolean
  ): void {
    if (this.raceRivals.length === 0 || checkpoints.length === 0) return;

    for (let i = 0; i < this.raceRivals.length; i++) {
      const rv = this.raceRivals[i];
      if (!isRacing) {
        rv.speed = 0;
        rv.mesh.position.set(rv.x, rv.y, rv.z);
        continue;
      }
      if (rv.finished) {
        rv.speed = Math.max(0, rv.speed - dt * 16);
      } else {
        const target = checkpoints[Math.min(rv.checkpointIndex, checkpoints.length - 1)];
        const dx = target[0] - rv.x;
        const dz = target[1] - rv.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 7.2) {
          rv.checkpointIndex += 1;
          if (rv.checkpointIndex >= checkpoints.length) {
            rv.finished = true;
            rv.finishTimeSec = elapsedSec;
          }
        }
        const desiredHeading = Math.atan2(dx, dz);
        const angleDiff = Math.atan2(
          Math.sin(desiredHeading - rv.heading),
          Math.cos(desiredHeading - rv.heading)
        );
        rv.heading += THREE.MathUtils.clamp(angleDiff, -4.2 * dt, 4.2 * dt);
        const cornerPenalty = Math.abs(angleDiff) > 0.55 ? 0.65 : 1.0;
        const targetSpeed =
          rv.baseSpeed * cornerPenalty * (0.94 + Math.sin(elapsedSec * 1.3 + i * 2) * 0.08);
        rv.speed = THREE.MathUtils.damp(rv.speed, targetSpeed, 3.2, dt);
      }

      const nx = rv.x + Math.sin(rv.heading) * rv.speed * dt;
      const nz = rv.z + Math.cos(rv.heading) * rv.speed * dt;
      const col = resolveCircleAABBCollision(nx, nz, 2.0, undefined, this.buildingGrid);
      rv.x = col.x;
      rv.z = col.z;
      rv.y = getGroundElevationAt(rv.x, rv.z, rv.y);
      rv.mesh.position.set(rv.x, rv.y, rv.z);
      rv.mesh.rotation.y = rv.heading;
    }

    // Prevent race rivals from stacking inside each other around tight corners
    for (let i = 0; i < this.raceRivals.length; i++) {
      for (let j = i + 1; j < this.raceRivals.length; j++) {
        const a = this.raceRivals[i];
        const b = this.raceRivals[j];
        if (Math.abs(a.y - b.y) > 2.0) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01 && dist < 3.6) {
          const push = (3.6 - dist) * 0.5;
          const px = (dx / dist) * push;
          const pz = (dz / dist) * push;
          a.x -= px;
          a.z -= pz;
          b.x += px;
          b.z += pz;
          a.mesh.position.set(a.x, a.y, a.z);
          b.mesh.position.set(b.x, b.y, b.z);
        }
      }
    }
  }

  public writeRaceRivalsTelemetry(out: RaceRivalTelemetry[]): void {
    out.length = this.raceRivals.length;
    for (let i = 0; i < this.raceRivals.length; i++) {
      const rv = this.raceRivals[i];
      if (!out[i]) {
        out[i] = {
          id: rv.id,
          name: rv.name,
          colorHex: rv.colorHex,
          x: rv.x,
          z: rv.z,
          heading: rv.heading,
          checkpointIndex: rv.checkpointIndex,
          finished: rv.finished,
          finishTimeSec: rv.finishTimeSec,
        };
      } else {
        out[i].id = rv.id;
        out[i].name = rv.name;
        out[i].colorHex = rv.colorHex;
        out[i].x = rv.x;
        out[i].z = rv.z;
        out[i].heading = rv.heading;
        out[i].checkpointIndex = rv.checkpointIndex;
        out[i].finished = rv.finished;
        out[i].finishTimeSec = rv.finishTimeSec;
      }
    }
  }

  public clearRaceRivals(): void {
    for (const rv of this.raceRivals) {
      this.scene.remove(rv.mesh);
      rv.mesh.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => m?.dispose());
        }
      });
    }
    this.raceRivals.length = 0;
  }

  public applyEmpPulseAt(
    x: number,
    z: number,
    radius: number,
    drivingVehicleId: string | null
  ): number {
    let disrupted = 0;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      if (v.id === drivingVehicleId) continue;
      if (Math.hypot(v.x - x, v.z - z) <= radius) {
        if (v.type === 'polisi' || v.type === 'barracuda' || v.isTraffic) {
          v.speed *= 0.15;
          v.stopTimer = Math.max(v.stopTimer, 4.2);
          disrupted++;
        }
      }
    }
    return disrupted;
  }

  public syncVigilanteTarget(
    x: number,
    z: number,
    heading: number,
    active: boolean
  ): void {
    this.vigilanteTargetMesh.visible = active;
    if (active) {
      const y = getGroundElevationAt(x, z, 0);
      this.vigilanteTargetMesh.position.set(x, y, z);
      this.vigilanteTargetMesh.rotation.y = heading;
    }
  }

  public dispose(): void {
    const disposeGroup = (grp: THREE.Object3D) => {
      grp.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry?.dispose();
          const mats = Array.isArray(obj.material)
            ? obj.material
            : [obj.material];
          mats.forEach((m) => m?.dispose());
        }
      });
    };
    this.clearRaceRivals();
    for (const v of this.vehicles) {
      disposeGroup(v.mesh);
    }
    for (const h of this.ambientSkyHelis) {
      disposeGroup(h);
    }
    for (const b of this.ambientBayBoats) {
      disposeGroup(b);
    }
    disposeGroup(this.vigilanteTargetMesh);
    disposeGroup(this.policeHeliMesh);
    disposeGroup(this.roadblockGroup);
    disposeGroup(this.roadEventGroup);
  }
}

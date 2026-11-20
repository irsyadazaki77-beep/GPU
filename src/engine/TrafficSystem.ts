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
  isTraffic: boolean;
  routeId: TrafficRouteId;
  driftAngle: number;
  isDrifting: boolean;
  isBraking?: boolean;
  pitchAngle: number;
  rollAngle: number;
  damage: VehicleDamageState;
  smokeParticleAccum: number;
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

    // Parked protagonist fleet across curb bays & plaza staging pads (clear of crosswalks & sidewalks)
    const parkedVehicles: {
      type: VehicleType;
      x: number;
      z: number;
      heading: number;
    }[] = [
      { type: 'vtol_jet', x: -15.8, z: -15.4, heading: Math.PI * 0.25 },
      { type: 'bajaj', x: -5.4, z: 30.2, heading: Math.PI },
      { type: 'ojek', x: 5.4, z: 30.2, heading: Math.PI },
      { type: 'heli', x: 15.2, z: -15.2, heading: -Math.PI * 0.25 },
      { type: 'barracuda', x: -14.8, z: 14.2, heading: -Math.PI * 0.75 },
      { type: 'supercar', x: 5.4, z: 45.0, heading: Math.PI },
      { type: 'supercar', x: 28, z: -26, heading: -Math.PI / 2 },
      { type: 'angkot', x: -5.4, z: 45.5, heading: Math.PI },
      { type: 'sedan', x: 5.4, z: -15.0, heading: 0 },
      { type: 'speedboat', x: -28, z: -82, heading: 0 },
    ];

    parkedVehicles.forEach((vCfg, idx) => {
      const vMesh = buildIndonesianVehicleMesh(vCfg.type);
      const groundY = getGroundElevationAt(vCfg.x, vCfg.z);
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
    const spawnX = px + Math.sin(facing) * 4.5;
    const spawnZ = pz + Math.cos(facing) * 4.5;
    const safe = resolveCircleAABBCollision(
      spawnX,
      spawnZ,
      2.5,
      undefined,
      this.buildingGrid
    );
    const gY = getGroundElevationAt(safe.x, safe.z);
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
      if (v.type === 'heli' || v.type === 'vtol_jet') {
        const rotor =
          (v.mesh.userData.mainRotor as THREE.Object3D | undefined) ||
          v.mesh.getObjectByName('heliRotor');
        if (rotor) {
          v.mesh.userData.mainRotor = rotor;
          const isActiveAircraft = v.id === drivingVehicleId;
          rotor.rotation.y += dt * (isActiveAircraft ? 22 : 4.5);
        }
      } else {
        // Spin 3D wheels proportionally to linear speed
        const wheels = v.mesh.userData.wheels as THREE.Object3D[] | undefined;
        if (wheels && Math.abs(v.speed) > 0.05) {
          for (let wi = 0; wi < wheels.length; wi++) {
            const wObj = wheels[wi];
            const radius = (wObj.userData.wheelRadius as number) || 0.38;
            wObj.rotation.x += (v.speed * dt) / radius;
          }
        }
      }

      // Brake / taillight emissive boost (#ff1a1a) when braking, reversing, or drifting
      const tailMat = v.mesh.userData.taillightMat as
        | THREE.MeshStandardMaterial
        | undefined;
      if (tailMat) {
        const isBraking =
          v.isDrifting ||
          Boolean(v.isBraking) ||
          (v.id === drivingVehicleId && v.speed < -0.2) ||
          (v.isTraffic && (v.speed < 1.5 || (v.hornReactionTimer ?? 0) > 1.0));
        tailMat.emissiveIntensity = isBraking ? 3.2 : 0.72 + nightFactor * 0.65;
      }

      // Night headlight glow & subtle additive headlight cones on ground vehicles
      const headMat = v.mesh.userData.headlightMat as
        | THREE.MeshStandardMaterial
        | undefined;
      if (headMat) {
        headMat.emissiveIntensity = 0.55 + nightFactor * 2.25;
      }
      const coneMat = v.mesh.userData.headlightConeMat as
        | THREE.MeshBasicMaterial
        | undefined;
      if (coneMat) {
        const activeOrMoving = v.id === drivingVehicleId || v.isTraffic;
        coneMat.opacity =
          activeOrMoving && nightFactor > 0.16
            ? (nightFactor - 0.16) * (v.id === drivingVehicleId ? 0.24 : 0.14)
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
        const anchorZ = playerZ > 0 ? -38 : 38;
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
        Math.abs(playerZ - -26) < 4.5 && playerY < 3.0;
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
          v.y = getGroundElevationAt(v.x, v.z);
          v.mesh.position.set(v.x, v.y, v.z);
          v.mesh.rotation.y = v.heading;
        } else if (v.speed !== 0) {
          v.speed = 0;
          v.isBraking = false;
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
        if (intercept.distance > 4.5) {
          v.heading = Math.atan2(intercept.dirX, intercept.dirZ);
          v.speed = pSpeed;
          const nx = v.x + intercept.dirX * pSpeed * simDt;
          const nz = v.z + intercept.dirZ * pSpeed * simDt;
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
        v.y = getGroundElevationAt(v.x, v.z);
      } else {
        let minAheadDist = 999;
        const sinH = Math.sin(v.heading);
        const cosH = Math.cos(v.heading);
        const workerBuf = this.workerAheadBuffer;

        if (workerBuf && vi * 4 < workerBuf.length) {
          minAheadDist = workerBuf[vi * 4] || 999;
        } else {
          for (let oi = 0; oi < this.vehicles.length; oi++) {
            if (oi === vi) continue;
            const other = this.vehicles[oi];
            if (Math.abs(other.y - v.y) > 2.2) continue;
            const dxO = other.x - v.x;
            const dzO = other.z - v.z;
            const fwdDot = dxO * sinH + dzO * cosH;
            if (fwdDot > 0.4 && fwdDot < minAheadDist) {
              const latDist = Math.abs(dxO * cosH - dzO * sinH);
              if (latDist < 2.25) {
                minAheadDist = fwdDot;
              }
            }
          }

          if (Math.abs(playerY - v.y) < 2.2) {
            const dxP = playerX - v.x;
            const dzP = playerZ - v.z;
            const fwdP = dxP * sinH + dzP * cosH;
            if (fwdP > 0.4 && fwdP < minAheadDist) {
              const latP = Math.abs(dxP * cosH - dzP * sinH);
              if (latP < 2.1) {
                minAheadDist = fwdP;
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
        v.y = v.layer === 'elevated' ? getGroundElevationAt(v.x, v.z) : 0;
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
          spatialAudio.playPoliceSiren3D(
            nearestPolice.x,
            nearestPolice.y,
            nearestPolice.z,
            sirenRedPhase
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
      rv.y = getGroundElevationAt(rv.x, rv.z);
      rv.mesh.position.set(rv.x, rv.y, rv.z);
      rv.mesh.rotation.y = rv.heading;
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
    disposeGroup(this.policeHeliMesh);
    disposeGroup(this.roadblockGroup);
    disposeGroup(this.roadEventGroup);
  }
}

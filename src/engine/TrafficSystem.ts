import * as THREE from 'three';
import {
  BuildingFootprint,
  PlayerProgressState,
  SpatialHashGrid,
  TRAFFIC_ROUTES,
  TrafficAISteppable,
  TrafficRouteId,
  VEHICLE_SPECS,
  VehicleCustomConfig,
  VehicleType,
  generateInitialTrafficSpawns,
  getGroundElevationAt,
  resolveCircleAABBCollision,
  stepTrafficVehicleInPlace,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import {
  applyVehicleCustomizationToMesh,
  buildIndonesianVehicleMesh,
  buildPolicePursuitHeliWithSpotlight,
} from '../game/world/geometryBuilders';
import type { RadarVehicleBlip } from '../state/gameStore';

export interface VehicleEntity extends TrafficAISteppable {
  id: string;
  type: VehicleType;
  mesh: THREE.Group;
  y: number;
  isTraffic: boolean;
  routeId: TrafficRouteId;
}

export class TrafficSystem {
  public readonly vehicles: VehicleEntity[] = [];
  public readonly vehicleHeadlight: THREE.SpotLight;
  public readonly sirenLight: THREE.PointLight;
  public readonly policeHeliMesh: THREE.Group;

  private readonly scene: THREE.Scene;
  private readonly buildingGrid: SpatialHashGrid<BuildingFootprint>;
  private pendingHornPulse = false;

  constructor(
    scene: THREE.Scene,
    buildingGrid: SpatialHashGrid<BuildingFootprint>
  ) {
    this.scene = scene;
    this.buildingGrid = buildingGrid;

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

    // Parked protagonist fleet across Monas & Tol Layang
    const parkedVehicles: {
      type: VehicleType;
      x: number;
      z: number;
      heading: number;
    }[] = [
      { type: 'vtol_jet', x: -4.2, z: 24.5, heading: Math.PI },
      { type: 'bajaj', x: -8.5, z: 22, heading: Math.PI },
      { type: 'ojek', x: 5.5, z: 23, heading: Math.PI },
      { type: 'heli', x: 9.5, z: 19.5, heading: Math.PI },
      { type: 'barracuda', x: -10.5, z: 19.5, heading: Math.PI },
      { type: 'supercar', x: 9.5, z: 26.5, heading: Math.PI },
      { type: 'supercar', x: 28, z: -26, heading: -Math.PI / 2 },
      { type: 'angkot', x: -9.5, z: 27.5, heading: Math.PI },
      { type: 'sedan', x: 8.5, z: -16, heading: 0 },
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
      });
    });

    // Dynamic Jakarta AI Traffic (TransJakarta, Angkot, Ojol, Bajaj, Metromini, Polisi, Sedan)
    const trafficSpawns = generateInitialTrafficSpawns();
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
      });
    });

    this.policeHeliMesh = buildPolicePursuitHeliWithSpotlight();
    this.policeHeliMesh.position.set(0, 24, -30);
    this.policeHeliMesh.visible = false;
    scene.add(this.policeHeliMesh);
  }

  public notifyHorn(px: number, pz: number): void {
    this.pendingHornPulse = true;
    for (const v of this.vehicles) {
      if (!v.isTraffic) continue;
      if (Math.hypot(v.x - px, v.z - pz) < 30) {
        v.hornReactionTimer = 1.6;
        if (v.type === 'angkot') {
          v.ngetemTimer = 0;
          v.stopTimer = 0;
        }
      }
    }
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
    });

    return { x: safe.x, y: gY, z: safe.z };
  }

  public updateVisualsAndAircraft(
    dt: number,
    nowMs: number,
    drivingVehicleId: string | null,
    pState: PlayerProgressState,
    isPlaying: boolean,
    playerX: number,
    playerZ: number
  ): void {
    for (const v of this.vehicles) {
      if (v.type === 'heli' || v.type === 'vtol_jet') {
        const rotor =
          v.mesh.getObjectByName('heliRotor') ||
          (v.mesh.userData.mainRotor as THREE.Object3D | undefined);
        if (rotor) {
          const isActiveAircraft = v.id === drivingVehicleId;
          rotor.rotation.y += dt * (isActiveAircraft ? 22 : 4.5);
        }
      }
      if (v.id === drivingVehicleId || v.type === 'supercar') {
        applyVehicleCustomizationToMesh(v.mesh, pState.vehicleCustoms);
      }
    }

    if (
      pState.wantedLevel >= 3 &&
      pState.currentInterior === 'exterior' &&
      isPlaying
    ) {
      this.policeHeliMesh.visible = true;
      const heliOrbit = nowMs * 0.0014;
      const hx = playerX + Math.cos(heliOrbit) * 9.5;
      const hz = playerZ + Math.sin(heliOrbit) * 9.5;
      this.policeHeliMesh.position.set(hx, 22.5, hz);
      this.policeHeliMesh.rotation.y = -heliOrbit + Math.PI;
      const pRotor = this.policeHeliMesh.getObjectByName('heliRotor');
      if (pRotor) pRotor.rotation.y += dt * 24;
    } else {
      this.policeHeliMesh.visible = false;
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
  ): boolean {
    const hornTriggered = this.pendingHornPulse;
    this.pendingHornPulse = false;

    let spottedByPolice = false;
    for (let vi = 0; vi < this.vehicles.length; vi++) {
      const v = this.vehicles[vi];
      if (!v.isTraffic || v.id === drivingVehicleId) continue;

      if (v.type === 'polisi' && pState.wantedLevel > 0) {
        const kiranaEmp =
          pState.activeProtagonist === 'kirana' && pState.fokusActive;
        const pSpeed = kiranaEmp ? 1.5 : 13.5 + pState.wantedLevel * 1.4;
        const dxP = playerX - v.x;
        const dzP = playerZ - v.z;
        const distP = Math.hypot(dxP, dzP) || 1;
        if (distP < 34) {
          spottedByPolice = true;
        }
        if (distP > 4.5) {
          v.heading = Math.atan2(dxP, dzP);
          const nx = v.x + (dxP / distP) * pSpeed * simDt;
          const nz = v.z + (dzP / distP) * pSpeed * simDt;
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

        const route = TRAFFIC_ROUTES[v.routeId];
        stepTrafficVehicleInPlace(v, route, minAheadDist, simDt, {
          playerWantedLevel: pState.wantedLevel,
          hornTriggered:
            hornTriggered && Math.hypot(v.x - playerX, v.z - playerZ) < 30,
        });
        v.y = v.layer === 'elevated' ? getGroundElevationAt(v.x, v.z) : 0;
      }

      v.mesh.position.set(v.x, v.y, v.z);
      v.mesh.rotation.y = v.heading;
    }

    // Active Vehicle Headlights & Police Siren Light
    if (activeVehicle && pState.currentInterior === 'exterior') {
      const vSpec = VEHICLE_SPECS[activeVehicle.type];
      const speedRatio =
        Math.abs(activeVehicle.speed) / Math.max(1, vSpec.maxSpeed);
      soundEngine.updateEngineAudio(
        speedRatio,
        true,
        Boolean(vSpec.isAircraft),
        pState.fokusActive,
        !isWheelSlowMo
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
        this.vehicleHeadlight.intensity = nightFactor * 4.6;
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
        if (v.type !== 'polisi') continue;
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
        this.sirenLight.color.setHex(
          Math.floor(nowMs / 115) % 2 === 0 ? 0xef4444 : 0x3b82f6
        );
        this.sirenLight.intensity = 4.2;
      } else {
        this.sirenLight.intensity = 0;
      }
    } else {
      this.sirenLight.intensity = 0;
    }

    return spottedByPolice;
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
    for (const v of this.vehicles) {
      disposeGroup(v.mesh);
    }
    disposeGroup(this.policeHeliMesh);
  }
}

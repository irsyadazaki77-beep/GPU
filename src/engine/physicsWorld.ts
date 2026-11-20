import RAPIER from '@dimforge/rapier3d-compat';
import {
  BuildingFootprint,
  CITY_BUILDINGS,
  SpatialHashGrid,
  VehicleType,
  WeatherMode,
  resolveCircleAABBCollision,
} from '../game/rules';
import { isInJakartaBayWaterZone } from './chunkLoader';

export const FIXED_PHYSICS_DT = 1 / 60;
const MAX_SUBSTEPS = 4;

export interface VehicleSuspensionTelemetry {
  pitchAngle: number;
  rollAngle: number;
  heaveOffset: number;
  lateralVelocity: number;
  forwardVelocity: number;
  slipRatio: number;
}

export interface FloodZoneSpec {
  id: string;
  districtId: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  depthM: number;
  lateralFrictionMultiplier: number;
}

/**
 * Low-lying Jakarta flood/puddle basins active during heavy monsoon rain ('hujan').
 */
export const JAKARTA_FLOOD_ZONES: FloodZoneSpec[] = [
  {
    id: 'flood_tanah_abang_underpass',
    districtId: 'tanah_abang',
    name: 'Genangan Underpass Tanah Abang',
    x: -36,
    z: 8,
    radius: 14,
    depthM: 0.35,
    lateralFrictionMultiplier: 0.42,
  },
  {
    id: 'flood_kota_tua_canal',
    districtId: 'kota_tua',
    name: 'Genangan Kali Besar Kota Tua & Glodok',
    x: 38,
    z: 14,
    radius: 15,
    depthM: 0.38,
    lateralFrictionMultiplier: 0.38,
  },
  {
    id: 'flood_ancol_coastal',
    districtId: 'ancol_pik',
    name: 'Rob Pesisir Marina Ancol-PIK',
    x: -44,
    z: 48,
    radius: 16,
    depthM: 0.42,
    lateralFrictionMultiplier: 0.35,
  },
  {
    id: 'flood_kemayoran_basin',
    districtId: 'kemayoran',
    name: 'Genangan Boulevard Kemayoran',
    x: 42,
    z: -18,
    radius: 14,
    depthM: 0.32,
    lateralFrictionMultiplier: 0.45,
  },
];

export interface FloodHydroplaningResult {
  inFloodZone: boolean;
  zone: FloodZoneSpec | null;
  lateralFrictionMultiplier: number;
  dragSpeedMultiplier: number;
  splashIntensity: number;
}

/**
 * Evaluates hydroplaning tire lateral friction reduction and water drag when driving
 * through low-lying Jakarta flood zones during heavy rain ('hujan').
 */
export function evaluateFloodZoneHydroplaning(
  x: number,
  z: number,
  weatherMode: WeatherMode,
  vehicleSpeed: number = 0,
  vehicleY: number = 0
): FloodHydroplaningResult {
  if (weatherMode !== 'hujan' || vehicleY > 1.2) {
    return {
      inFloodZone: false,
      zone: null,
      lateralFrictionMultiplier: 1.0,
      dragSpeedMultiplier: 1.0,
      splashIntensity: 0,
    };
  }

  for (const zone of JAKARTA_FLOOD_ZONES) {
    const dist = Math.hypot(x - zone.x, z - zone.z);
    if (dist <= zone.radius) {
      const absSpeed = Math.abs(vehicleSpeed);
      const splashIntensity = Math.min(1, absSpeed / 16);
      return {
        inFloodZone: true,
        zone,
        lateralFrictionMultiplier: zone.lateralFrictionMultiplier,
        dragSpeedMultiplier: 0.86,
        splashIntensity,
      };
    }
  }

  return {
    inFloodZone: false,
    zone: null,
    lateralFrictionMultiplier: 1.0,
    dragSpeedMultiplier: 1.0,
    splashIntensity: 0,
  };
}

/**
 * Computes water surface wave elevation and spring-damped buoyancy for speedboats
 * and vehicles in Jakarta Bay & Kepulauan Seribu.
 */
export function computeWaterBuoyancyStep(
  x: number,
  currentY: number,
  z: number,
  currentVy: number,
  speed: number,
  dt: number,
  nowMs: number = 0
): {
  inWater: boolean;
  waterSurfaceY: number;
  nextY: number;
  nextVy: number;
  wavePitch: number;
  waveRoll: number;
} {
  const inWater = isInJakartaBayWaterZone(x, z);
  const t = nowMs * 0.0022;
  const waveHeight =
    Math.sin(x * 0.14 + t) * 0.09 + Math.cos(z * 0.18 + t * 1.2) * 0.07;
  const waterSurfaceY = -0.05 + waveHeight;

  if (!inWater || dt <= 0) {
    return {
      inWater: false,
      waterSurfaceY,
      nextY: currentY,
      nextVy: 0,
      wavePitch: 0,
      waveRoll: 0,
    };
  }

  const submersion = waterSurfaceY - currentY;
  const buoyancyAccel = submersion * 28.0 - currentVy * 6.5;
  const nextVy = currentVy + buoyancyAccel * dt;
  const nextY = currentY + nextVy * dt;

  const planingLift = Math.min(0.11, Math.abs(speed) * 0.0032);
  const wavePitch = -planingLift + Math.sin(t * 1.4 + z * 0.1) * 0.035;
  const waveRoll = Math.cos(t * 1.1 + x * 0.1) * 0.04;

  return {
    inWater: true,
    waterSurfaceY,
    nextY,
    nextVy,
    wavePitch,
    waveRoll,
  };
}

export interface VehiclePhysicsRecord {
  id: string;
  type: VehicleType;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  radius: number;
  massKg: number;
  impulseVx: number;
  impulseVz: number;
  prevSpeed: number;
  prevHeading: number;
  pitchAngle: number;
  rollAngle: number;
  heaveOffset: number;
  bodyHandle?: number;
}

const VEHICLE_MASS_KG: Record<VehicleType, number> = {
  ojek: 190,
  bajaj: 420,
  speedboat: 980,
  sedan: 1380,
  supercar: 1460,
  angkot: 1650,
  polisi: 1720,
  metromini: 4800,
  barracuda: 7600,
  transjakarta: 9400,
  heli: 2800,
  vtol_jet: 5200,
};

export function computeDriftAndSuspensionStep(
  prevSpeed: number,
  targetSpeed: number,
  turnInput: number,
  isDrifting: boolean,
  prevPitch: number,
  prevRoll: number,
  dt: number,
  lateralFrictionMultiplier: number = 1.0
): VehicleSuspensionTelemetry {
  if (dt <= 0) {
    return {
      pitchAngle: prevPitch,
      rollAngle: prevRoll,
      heaveOffset: 0,
      lateralVelocity: 0,
      forwardVelocity: targetSpeed,
      slipRatio: 0,
    };
  }

  const accel = (targetSpeed - prevSpeed) / Math.max(0.008, dt);
  const clampedAccel = Math.max(-28, Math.min(28, accel));
  // Nose dives on braking, squats on acceleration
  const targetPitch = Math.max(-0.075, Math.min(0.075, -clampedAccel * 0.0024));
  // Body roll into turns, amplified during handbrake drift
  const lateralG = turnInput * (Math.abs(targetSpeed) / 18) * (isDrifting ? 1.45 : 1.0);
  const targetRoll = Math.max(-0.11, Math.min(0.11, lateralG * 0.065));

  const dampFactor = 1 - Math.exp(-10 * dt);
  const pitchAngle = prevPitch + (targetPitch - prevPitch) * dampFactor;
  const rollAngle = prevRoll + (targetRoll - prevRoll) * dampFactor;

  const gripScale = Math.max(0.25, Math.min(1.0, lateralFrictionMultiplier));
  const hydroSlipBoost = (1 - gripScale) * 0.55;
  const baseSlip = isDrifting
    ? Math.min(1, Math.abs(turnInput) * Math.min(1, Math.abs(targetSpeed) / 12))
    : Math.min(0.22, Math.abs(turnInput) * 0.12);
  const slipRatio = Math.min(1, baseSlip + hydroSlipBoost);

  const lateralVelocity = -turnInput * targetSpeed * slipRatio * (0.36 / gripScale);
  const heaveOffset =
    Math.abs(targetSpeed) > 0.5
      ? Math.sin(performance.now() * 0.024) * 0.012 * Math.min(1, Math.abs(targetSpeed) / 16)
      : 0;

  return {
    pitchAngle,
    rollAngle,
    heaveOffset,
    lateralVelocity,
    forwardVelocity: targetSpeed,
    slipRatio,
  };
}

export class JakartaPhysicsWorld {
  private rapierReady = false;
  private world: RAPIER.World | null = null;
  private bodyMap = new Map<string, RAPIER.RigidBody>();
  private chunkStaticBodies = new Map<string, RAPIER.RigidBody>();
  private vehicles = new Map<string, VehiclePhysicsRecord>();
  private accumulator = 0;
  private disposed = false;
  private readonly buildingGrid?: SpatialHashGrid<BuildingFootprint>;
  private readonly buildings: BuildingFootprint[];

  constructor(
    buildings: BuildingFootprint[] = CITY_BUILDINGS,
    buildingGrid?: SpatialHashGrid<BuildingFootprint>
  ) {
    this.buildings = buildings;
    this.buildingGrid = buildingGrid;
  }

  public async init(): Promise<boolean> {
    if (this.rapierReady || this.disposed) return this.rapierReady;
    try {
      await RAPIER.init();
      if (this.disposed) return false;

      this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 });

      // Ground plane collider
      const groundDesc = RAPIER.ColliderDesc.cuboid(260, 0.5, 260)
        .setTranslation(0, -0.5, 0)
        .setFriction(0.85)
        .setRestitution(0.1);
      this.world.createCollider(groundDesc);

      // Semanggi Elevated Tollway deck & approach ramp colliders
      const deckBody = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(0, 5.9, -26)
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(42, 0.3, 4.5).setFriction(0.8),
        deckBody
      );

      // Static building colliders synced with CITY_BUILDINGS
      for (const b of this.buildings) {
        const halfW = b.width * 0.5;
        const halfH = Math.max(2, b.height * 0.5);
        const halfD = b.depth * 0.5;
        const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(
          b.x,
          halfH,
          b.z
        );
        const fixedBody = this.world.createRigidBody(bodyDesc);
        const colDesc = RAPIER.ColliderDesc.cuboid(halfW, halfH, halfD)
          .setRestitution(0.25)
          .setFriction(0.6);
        this.world.createCollider(colDesc, fixedBody);
      }

      // Sync any vehicles registered prior to WASM initialization
      for (const rec of this.vehicles.values()) {
        this.attachRapierBody(rec);
      }

      this.rapierReady = true;
      return true;
    } catch {
      this.rapierReady = false;
      return false;
    }
  }

  public registerChunkStaticBox(
    colliderId: string,
    x: number,
    y: number,
    z: number,
    halfW: number,
    halfH: number,
    halfD: number
  ): void {
    if (!this.world || !this.rapierReady || this.chunkStaticBodies.has(colliderId)) {
      return;
    }
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z);
    const fixedBody = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.5, halfW),
      Math.max(0.5, halfH),
      Math.max(0.5, halfD)
    )
      .setRestitution(0.2)
      .setFriction(0.65);
    this.world.createCollider(colDesc, fixedBody);
    this.chunkStaticBodies.set(colliderId, fixedBody);
  }

  public unregisterChunkStaticBox(colliderId: string): void {
    const rb = this.chunkStaticBodies.get(colliderId);
    if (!rb) return;
    this.chunkStaticBodies.delete(colliderId);
    if (this.world && this.rapierReady) {
      try {
        this.world.removeRigidBody(rb);
      } catch {
        // Ignore already removed body
      }
    }
  }

  private attachRapierBody(rec: VehiclePhysicsRecord): void {
    if (!this.world || this.bodyMap.has(rec.id)) return;
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(rec.x, Math.max(0.5, rec.y + 0.5), rec.z)
      .setLinearDamping(2.4)
      .setAngularDamping(4.5)
      .lockRotations();
    const rb = this.world.createRigidBody(bodyDesc);
    const colDesc = RAPIER.ColliderDesc.ball(Math.max(0.8, rec.radius * 0.85))
      .setMass(rec.massKg)
      .setRestitution(0.32)
      .setFriction(0.45);
    this.world.createCollider(colDesc, rb);
    rec.bodyHandle = rb.handle;
    this.bodyMap.set(rec.id, rb);
  }

  public registerVehicle(
    id: string,
    type: VehicleType,
    x: number,
    y: number,
    z: number,
    heading: number,
    radius: number
  ): VehiclePhysicsRecord {
    const existing = this.vehicles.get(id);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.z = z;
      existing.heading = heading;
      return existing;
    }
    const rec: VehiclePhysicsRecord = {
      id,
      type,
      x,
      y,
      z,
      vx: 0,
      vz: 0,
      heading,
      speed: 0,
      radius,
      massKg: VEHICLE_MASS_KG[type] ?? 1400,
      impulseVx: 0,
      impulseVz: 0,
      prevSpeed: 0,
      prevHeading: heading,
      pitchAngle: 0,
      rollAngle: 0,
      heaveOffset: 0,
    };
    this.vehicles.set(id, rec);
    if (this.rapierReady) {
      this.attachRapierBody(rec);
    }
    return rec;
  }

  public applyCollisionImpulse(
    id: string,
    impulseX: number,
    impulseZ: number
  ): void {
    const rec = this.vehicles.get(id);
    if (!rec) return;
    const invMassScale = 1400 / Math.max(250, rec.massKg);
    rec.impulseVx += impulseX * invMassScale;
    rec.impulseVz += impulseZ * invMassScale;

    const rb = this.bodyMap.get(id);
    if (rb && this.rapierReady) {
      rb.applyImpulse({ x: impulseX * 120, y: 0, z: impulseZ * 120 }, true);
    }
  }

  /**
   * Resolves pairwise vehicle-to-vehicle elastic impulse collisions and syncs
   * the Rapier fixed-timestep world (`dt = 1/60` accumulator).
   */
  public stepFixed(
    dt: number,
    vehicleList: {
      id: string;
      type: VehicleType;
      x: number;
      y: number;
      z: number;
      heading: number;
      speed: number;
      isDrifting: boolean;
      pitchAngle: number;
      rollAngle: number;
    }[],
    drivingVehicleId: string | null,
    turnInput: number = 0,
    weatherMode: WeatherMode = 'senja'
  ): { playerCollisionImpact: number; playerInFloodZone: boolean } {
    if (dt <= 0 || this.disposed) {
      return { playerCollisionImpact: 0, playerInFloodZone: false };
    }

    for (const v of vehicleList) {
      const rec = this.registerVehicle(
        v.id,
        v.type,
        v.x,
        v.y,
        v.z,
        v.heading,
        v.type === 'transjakarta' || v.type === 'barracuda' ? 2.4 : 1.75
      );
      rec.x = v.x;
      rec.y = v.y;
      rec.z = v.z;
      rec.heading = v.heading;
      rec.speed = v.speed;
    }

    let playerCollisionImpact = 0;
    let playerInFloodZone = false;

    // Pairwise impulse-based vehicle collision solver (player vs traffic & traffic vs traffic)
    for (let i = 0; i < vehicleList.length; i++) {
      const a = vehicleList[i];
      const recA = this.vehicles.get(a.id)!;
      for (let j = i + 1; j < vehicleList.length; j++) {
        const b = vehicleList[j];
        if (Math.abs(a.y - b.y) > 2.2) continue;

        const recB = this.vehicles.get(b.id)!;
        const minDist = (recA.radius + recB.radius) * 0.78;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);

        if (dist > 0.001 && dist < minDist) {
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = minDist - dist;

          const totalMass = recA.massKg + recB.massKg;
          const shareA = recB.massKg / totalMass;
          const shareB = recA.massKg / totalMass;

          // Separate overlapping vehicles and clamp against building footprints
          const nextAX = a.x - nx * overlap * shareA;
          const nextAZ = a.z - nz * overlap * shareA;
          const nextBX = b.x + nx * overlap * shareB;
          const nextBZ = b.z + nz * overlap * shareB;

          const colA = resolveCircleAABBCollision(
            nextAX,
            nextAZ,
            recA.radius * 0.85,
            undefined,
            this.buildingGrid
          );
          const colB = resolveCircleAABBCollision(
            nextBX,
            nextBZ,
            recB.radius * 0.85,
            undefined,
            this.buildingGrid
          );

          a.x = colA.x;
          a.z = colA.z;
          b.x = colB.x;
          b.z = colB.z;

          const relSpeed = Math.abs(a.speed - b.speed);
          if (relSpeed > 1.5) {
            const impulseMag = Math.min(14, relSpeed * 0.45);
            recA.impulseVx -= nx * impulseMag * shareA;
            recA.impulseVz -= nz * impulseMag * shareA;
            recB.impulseVx += nx * impulseMag * shareB;
            recB.impulseVz += nz * impulseMag * shareB;

            if (a.id === drivingVehicleId || b.id === drivingVehicleId) {
              playerCollisionImpact = Math.max(
                playerCollisionImpact,
                relSpeed * 0.08
              );
              if (a.id === drivingVehicleId) {
                a.speed *= 0.72;
              } else {
                b.speed *= 0.72;
              }
            }
          }
        }
      }
    }

    // Apply decaying knockback impulses, flood hydroplaning, water buoyancy, and suspension telemetry
    const nowMs = performance.now();
    for (const v of vehicleList) {
      const rec = this.vehicles.get(v.id);
      if (!rec) continue;

      if (Math.hypot(rec.impulseVx, rec.impulseVz) > 0.05) {
        const nx = v.x + rec.impulseVx * dt;
        const nz = v.z + rec.impulseVz * dt;
        const col = resolveCircleAABBCollision(
          nx,
          nz,
          rec.radius * 0.85,
          undefined,
          this.buildingGrid
        );
        v.x = col.x;
        v.z = col.z;
        const decay = Math.exp(-6.5 * dt);
        rec.impulseVx *= decay;
        rec.impulseVz *= decay;
      } else {
        rec.impulseVx = 0;
        rec.impulseVz = 0;
      }

      const isPlayerVeh = v.id === drivingVehicleId;
      const floodRes = evaluateFloodZoneHydroplaning(
        v.x,
        v.z,
        weatherMode,
        v.speed,
        v.y
      );
      if (isPlayerVeh && floodRes.inFloodZone) {
        playerInFloodZone = true;
      }

      const steer = isPlayerVeh
        ? turnInput
        : Math.max(-1, Math.min(1, (v.heading - rec.prevHeading) / Math.max(0.008, dt)));
      const susp = computeDriftAndSuspensionStep(
        rec.prevSpeed,
        v.speed,
        steer,
        v.isDrifting || floodRes.inFloodZone,
        v.pitchAngle,
        v.rollAngle,
        dt,
        floodRes.lateralFrictionMultiplier
      );

      if (v.type === 'speedboat' || isInJakartaBayWaterZone(v.x, v.z)) {
        const buoy = computeWaterBuoyancyStep(
          v.x,
          v.y,
          v.z,
          0,
          v.speed,
          dt,
          nowMs
        );
        if (buoy.inWater) {
          v.y = buoy.nextY;
          v.pitchAngle = susp.pitchAngle + buoy.wavePitch;
          v.rollAngle = susp.rollAngle + buoy.waveRoll;
        } else {
          v.pitchAngle = susp.pitchAngle;
          v.rollAngle = susp.rollAngle;
        }
      } else {
        v.pitchAngle = susp.pitchAngle;
        v.rollAngle = susp.rollAngle;
      }

      rec.prevSpeed = v.speed;
      rec.prevHeading = v.heading;

      const rb = this.bodyMap.get(v.id);
      if (rb && this.rapierReady) {
        rb.setTranslation(
          { x: v.x, y: Math.max(0.5, v.y + 0.5), z: v.z },
          true
        );
      }
    }

    // Fixed-timestep Rapier world stepping
    this.accumulator = Math.min(this.accumulator + dt, FIXED_PHYSICS_DT * MAX_SUBSTEPS);
    let steps = 0;
    while (this.accumulator >= FIXED_PHYSICS_DT && steps < MAX_SUBSTEPS) {
      this.accumulator -= FIXED_PHYSICS_DT;
      steps++;
      if (this.world && this.rapierReady) {
        this.world.timestep = FIXED_PHYSICS_DT;
        this.world.step();
      }
    }

    return { playerCollisionImpact, playerInFloodZone };
  }

  public isInitialized(): boolean {
    return this.rapierReady;
  }

  public getActiveRigidBodyCount(): number {
    if (this.world && this.rapierReady) {
      return this.world.bodies.len();
    }
    return this.vehicles.size + this.buildings.length + this.chunkStaticBodies.size;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.bodyMap.clear();
    this.chunkStaticBodies.clear();
    this.vehicles.clear();
    if (this.world) {
      try {
        this.world.free();
      } catch {
        // Ignore already freed world
      }
      this.world = null;
    }
    this.rapierReady = false;
  }
}

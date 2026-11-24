import * as THREE from 'three';
import {
  computeDriftCounterSteerBoost,
  computeSpeedSensitiveTurnRate,
  evaluateFloodZoneAt,
  getGroundElevationAt,
  stepVehicleLongitudinalSpeed,
} from '../../game/rules';

export interface VehicleKinematicsStepInput {
  x: number;
  y: number;
  z: number;
  speed: number;
  heading: number;
  driftAngle: number;
  moveForward: number;
  moveTurn: number;
  handbrakeHeld: boolean;
  climbDir: number;
  maxSpeed: number;
  acceleration: number;
  turnRate: number;
  steeringPull: number;
  isAircraft: boolean;
  isExploded: boolean;
  isAirborne: boolean;
  wetnessFactor: number;
  wetGripMult: number;
  nowMs: number;
  dt: number;
}

export interface VehicleKinematicsStepOutput {
  nextX: number;
  nextY: number;
  nextZ: number;
  nextSpeed: number;
  nextHeading: number;
  nextDriftAngle: number;
  isBraking: boolean;
  isDrifting: boolean;
  surfaceElev: number;
  inFloodSplash: boolean;
}

/**
 * Pure vehicle driving & flight kinematics extracted from PlayerController.
 */
export function stepDrivenVehicleKinematics(
  input: VehicleKinematicsStepInput
): VehicleKinematicsStepOutput {
  const simDt = Math.max(0.001, Math.min(0.05, input.dt));
  const isDrifting =
    !input.isAircraft &&
    input.handbrakeHeld &&
    Math.abs(input.speed) > 6.5 &&
    Math.abs(input.moveTurn) > 0;

  const longStep = stepVehicleLongitudinalSpeed(
    input.speed,
    input.moveForward,
    input.acceleration,
    input.maxSpeed,
    input.handbrakeHeld,
    input.isExploded,
    simDt
  );
  let nextSpeed = longStep.speed;
  let nextHeading = input.heading;

  if (input.isAircraft || Math.abs(nextSpeed) > 0.35) {
    const dirSign = input.isAircraft || nextSpeed >= 0 ? 1 : -1;
    const effectiveTurnRate = computeSpeedSensitiveTurnRate(
      input.turnRate,
      Math.abs(nextSpeed),
      input.maxSpeed,
      isDrifting,
      input.wetGripMult
    );
    const pullYaw =
      !input.isAircraft && Math.abs(nextSpeed) > 4
        ? input.steeringPull * Math.min(1, Math.abs(nextSpeed) / 14)
        : 0;
    nextHeading += (input.moveTurn * effectiveTurnRate + pullYaw) * dirSign * simDt;
  }

  const targetDriftAngle = isDrifting
    ? -input.moveTurn * 0.38 * input.wetGripMult
    : 0;
  const nextDriftAngle = THREE.MathUtils.damp(
    input.driftAngle,
    targetDriftAngle,
    8,
    simDt
  );

  const driftCatch = computeDriftCounterSteerBoost(
    input.moveTurn,
    nextDriftAngle,
    Math.abs(nextSpeed)
  );
  if (driftCatch.boosted) {
    nextSpeed *= 1 + (driftCatch.accelerationSurge - 1) * simDt * 3.5;
  }

  const travelAngle = nextHeading - nextDriftAngle * 0.55;
  const nextX = input.x + Math.sin(travelAngle) * nextSpeed * simDt;
  const nextZ = input.z + Math.cos(travelAngle) * nextSpeed * simDt;
  const surfaceElev = getGroundElevationAt(
    nextX,
    nextZ,
    input.isAircraft ? 99 : input.y
  );

  let inFloodSplash = false;
  if (!input.isAircraft && !input.isAirborne) {
    const floodEval = evaluateFloodZoneAt(nextX, nextZ, input.wetnessFactor);
    if (floodEval.inFlood && Math.abs(nextSpeed) > 4.5) {
      nextSpeed *= Math.exp(-0.55 * floodEval.hydroplaneStrength * simDt);
      const wobble =
        Math.sin(input.nowMs * 0.012) * floodEval.hydroplaneStrength * 0.45;
      nextHeading += wobble * simDt;
      inFloodSplash = true;
    }
  }

  const nextY = input.isAircraft
    ? THREE.MathUtils.clamp(input.y + input.climbDir * 14 * simDt, surfaceElev, 38)
    : input.y;

  return {
    nextX,
    nextY,
    nextZ,
    nextSpeed,
    nextHeading,
    nextDriftAngle,
    isBraking: longStep.isBraking,
    isDrifting,
    surfaceElev,
    inFloodSplash,
  };
}

/* ==========================================================================
 * GRAND PLAN 8.0: NITRO NOS BOOST & MOTORCYCLE STUNT PHYSICS
 * ========================================================================== */

export interface NitroTankState {
  level: number; // 0..100
  active: boolean;
  cooldownSec: number;
}

export function createInitialNitroTankState(): NitroTankState {
  return {
    level: 100,
    active: false,
    cooldownSec: 0,
  };
}

export interface NitroStepResult {
  nextState: NitroTankState;
  justReleased: boolean;
  speedMultiplier: number;
  accelerationMultiplier: number;
  fovBoostDeg: number;
}

/**
 * Steps the vehicle Nitro NOS tank: consumes fuel at 28/s while boosting,
 * recharges passively at 11/s (or 24/s while drifting), and signals blow-off valve release.
 */
export function stepNitroBoostState(params: {
  state: NitroTankState;
  boostRequested: boolean;
  forwardSpeed: number;
  isDrifting: boolean;
  isAircraft: boolean;
  dt: number;
}): NitroStepResult {
  const dt = Math.max(0, Math.min(0.1, params.dt));
  const wasActive = params.state.active;
  const nextCooldown = Math.max(0, params.state.cooldownSec - dt);

  const canEngage =
    !params.isAircraft &&
    params.boostRequested &&
    params.forwardSpeed > 3.5 &&
    (wasActive ? params.state.level > 1.5 : params.state.level >= 15 && nextCooldown <= 0);

  if (canEngage) {
    const nextLevel = Math.max(0, params.state.level - 28 * dt);
    const stillActive = nextLevel > 0.5;
    return {
      nextState: {
        level: nextLevel,
        active: stillActive,
        cooldownSec: stillActive ? 0 : 1.4,
      },
      justReleased: !stillActive,
      speedMultiplier: stillActive ? 1.26 : 1.0,
      accelerationMultiplier: stillActive ? 1.48 : 1.0,
      fovBoostDeg: stillActive ? 8.5 : 0,
    };
  }

  const rechargeRate = params.isDrifting ? 24 : 11;
  const nextLevel = Math.min(100, params.state.level + rechargeRate * dt);
  return {
    nextState: {
      level: nextLevel,
      active: false,
      cooldownSec: nextCooldown,
    },
    justReleased: wasActive,
    speedMultiplier: 1.0,
    accelerationMultiplier: 1.0,
    fovBoostDeg: 0,
  };
}

export interface MotorStuntPoseResult {
  stuntKind: 'none' | 'wheelie' | 'stoppie';
  pitchOffsetRad: number;
  rollOffsetRad: number;
  stuntScoreDelta: number;
  label: string;
}

/**
 * Evaluates motorcycle (ojek) wheelie, stoppie, and corner-lean roll angles.
 */
export function evaluateMotorcycleStuntPose(params: {
  isMotorcycle: boolean;
  speed: number;
  turnInput: number;
  wheelieHeld: boolean;
  isBraking: boolean;
  dt: number;
}): MotorStuntPoseResult {
  if (!params.isMotorcycle) {
    return {
      stuntKind: 'none',
      pitchOffsetRad: 0,
      rollOffsetRad: 0,
      stuntScoreDelta: 0,
      label: '',
    };
  }

  const absSpeed = Math.abs(params.speed);
  const speedRatio = Math.min(1, absSpeed / 18);
  const cornerLean = -params.turnInput * 0.34 * speedRatio;

  if (params.wheelieHeld && params.speed > 4.5 && !params.isBraking) {
    return {
      stuntKind: 'wheelie',
      pitchOffsetRad: -0.38 * Math.min(1, params.speed / 12),
      rollOffsetRad: cornerLean * 0.5,
      stuntScoreDelta: Math.round(95 * Math.max(0, params.dt)),
      label: 'WHEELIE JAWARA!',
    };
  }

  if (params.isBraking && params.speed > 6.5) {
    return {
      stuntKind: 'stoppie',
      pitchOffsetRad: 0.24 * Math.min(1, params.speed / 15),
      rollOffsetRad: cornerLean * 0.4,
      stuntScoreDelta: Math.round(80 * Math.max(0, params.dt)),
      label: 'STOPPIE TAJAM!',
    };
  }

  return {
    stuntKind: 'none',
    pitchOffsetRad: 0,
    rollOffsetRad: cornerLean,
    stuntScoreDelta: 0,
    label: '',
  };
}

/* ==========================================================================
 * GRAND PLAN 9.0: STUNT LANDING SUSPENSION SQUASH & FUEL ENDURANCE
 * ========================================================================== */

export interface StuntLandingImpactResult {
  landedHard: boolean;
  squashDepthM: number;
  sparkCount: number;
  cameraShakeAmp: number;
  chassisDamage: number;
}

/**
 * Evaluates vertical stunt landing impact when transitioning from airborne to ground contact.
 */
export function evaluateStuntLandingImpact(
  dropHeightM: number,
  horizontalSpeed: number
): StuntLandingImpactResult {
  if (dropHeightM < 0.75) {
    return {
      landedHard: false,
      squashDepthM: 0,
      sparkCount: 0,
      cameraShakeAmp: 0,
      chassisDamage: 0,
    };
  }
  const normalizedDrop = Math.min(1, (dropHeightM - 0.75) / 5.5);
  const speedFactor = Math.min(1.25, 0.6 + Math.abs(horizontalSpeed) / 22);
  const squashDepthM = Number((0.12 + normalizedDrop * 0.26).toFixed(3));
  const sparkCount =
    dropHeightM >= 1.35 ? Math.round(6 + normalizedDrop * 16 * speedFactor) : 0;
  const cameraShakeAmp = Number((0.08 + normalizedDrop * 0.24).toFixed(3));
  const chassisDamage =
    dropHeightM >= 4.2 ? Math.round((dropHeightM - 4.0) * 3.5) : 0;

  return {
    landedHard: true,
    squashDepthM,
    sparkCount,
    cameraShakeAmp,
    chassisDamage,
  };
}

export interface FuelStepResult {
  nextFuelPct: number;
  speedCapMultiplier: number;
  lowFuelWarning: boolean;
}

/**
 * Steps light realistic fuel consumption (0..100%) on ground vehicles.
 * Empty tank triggers 28% limp-home speed cap rather than soft-locking the player.
 */
export function stepVehicleFuelConsumption(params: {
  fuelPct: number;
  speedRatio: number;
  nitroActive: boolean;
  isAircraft: boolean;
  dt: number;
}): FuelStepResult {
  const clamped = Math.max(0, Math.min(100, params.fuelPct));
  if (params.isAircraft) {
    return {
      nextFuelPct: clamped,
      speedCapMultiplier: 1.0,
      lowFuelWarning: false,
    };
  }
  const simDt = Math.max(0, Math.min(0.1, params.dt));
  const sr = Math.max(0, Math.min(1.3, params.speedRatio));
  const idleBurn = 0.015;
  const driveBurn = sr * 0.22 + (params.nitroActive ? 0.55 : 0);
  const nextFuelPct = Math.max(0, clamped - (idleBurn + driveBurn) * simDt);

  return {
    nextFuelPct,
    speedCapMultiplier: nextFuelPct <= 0.05 ? 0.28 : nextFuelPct < 8 ? 0.78 : 1.0,
    lowFuelWarning: nextFuelPct > 0 && nextFuelPct <= 15,
  };
}


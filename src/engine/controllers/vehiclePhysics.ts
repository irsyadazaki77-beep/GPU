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

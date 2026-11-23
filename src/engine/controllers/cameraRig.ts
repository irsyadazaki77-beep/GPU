import type { BuildingFootprint, SpatialHashGrid } from '../../game/rules';
import { resolveCameraWallPullIn } from '../../game/rules';
import type { CameraViewMode } from '../../game/types';
import { exponentialDampFactor } from '../visualOverhaulMath';

export interface ChaseCameraSolveInput {
  playerX: number;
  playerZ: number;
  baseElevY: number;
  camYaw: number;
  camPitch: number;
  camMode: CameraViewMode;
  isDriving: boolean;
  isTpsAim: boolean;
  isBraking: boolean;
  moveForward: number;
  speedRatio: number;
  nowMs: number;
  dt: number;
  buildingGrid: SpatialHashGrid<BuildingFootprint>;
}

export interface ChaseCameraSolveOutput {
  desiredPos: { x: number; y: number; z: number };
  lookTarget: { x: number; y: number; z: number };
  dampFactor: number;
  lookDampFactor: number;
}

/**
 * Computes subtle high-speed asphalt vibration (>72% top speed / ~90+ km/h)
 */
export function computeHighSpeedCameraRumble(
  speedRatio: number,
  nowMs: number
): { offsetX: number; offsetY: number } {
  if (speedRatio <= 0.72) {
    return { offsetX: 0, offsetY: 0 };
  }
  const intensity = Math.min(1, (speedRatio - 0.72) / 0.35);
  const amp = intensity * 0.038;
  return {
    offsetX: Math.sin(nowMs * 0.052) * amp,
    offsetY: Math.cos(nowMs * 0.068) * amp * 0.85,
  };
}

/**
 * Pure orbital / chase / cinematic / TPS camera rig solver pulled cleanly out of PlayerController.
 */
export function solveChaseCameraRig(
  input: ChaseCameraSolveInput
): ChaseCameraSolveOutput {
  const isCinematic = input.camMode === 'cinematic';
  const cineSway = isCinematic ? Math.sin(input.nowMs * 0.00055) * 0.42 : 0;
  const effectiveYaw = input.camYaw + cineSway;

  const orbitFwdX = Math.sin(effectiveYaw);
  const orbitFwdZ = Math.cos(effectiveYaw);
  const orbitRightX = -Math.cos(effectiveYaw);
  const orbitRightZ = Math.sin(effectiveYaw);

  const gForceCamOffset = input.isDriving
    ? input.moveForward > 0.4
      ? 0.75
      : input.isBraking
      ? -0.55
      : 0
    : 0;

  const camDist =
    (input.isTpsAim
      ? 4.4
      : isCinematic
      ? (input.isDriving ? 14.2 : 11.4) + input.speedRatio * 1.6
      : input.isDriving
      ? 12.2 + input.speedRatio * 1.4
      : 9.8) + gForceCamOffset;

  const effectivePitch = isCinematic ? 0.16 : input.camPitch;
  const horizDist = camDist * Math.cos(effectivePitch);
  const vertOffset = camDist * Math.sin(effectivePitch);

  let desiredX = input.playerX - orbitFwdX * horizDist;
  let desiredZ = input.playerZ - orbitFwdZ * horizDist;
  const desiredY =
    input.baseElevY +
    (input.isTpsAim ? 1.55 : isCinematic ? 1.35 : 1.75) +
    vertOffset;

  if (input.isTpsAim) {
    desiredX += orbitRightX * 1.1;
    desiredZ += orbitRightZ * 1.1;
  }

  const pulledCam = resolveCameraWallPullIn(
    input.playerX,
    input.playerZ,
    desiredX,
    desiredY,
    desiredZ,
    input.buildingGrid
  );

  const lookDist = input.isTpsAim
    ? 14
    : input.isDriving
    ? 6.2 + input.speedRatio * 2.4
    : 5.2;
  const lookPitchShift =
    (0.28 - input.camPitch) * (input.isTpsAim ? 9.5 : 4.5);

  const rumble = input.isDriving
    ? computeHighSpeedCameraRumble(input.speedRatio, input.nowMs)
    : { offsetX: 0, offsetY: 0 };

  return {
    desiredPos: {
      x: pulledCam.x + orbitRightX * rumble.offsetX,
      y: pulledCam.y + rumble.offsetY,
      z: pulledCam.z + orbitRightZ * rumble.offsetX,
    },
    lookTarget: {
      x: input.playerX + orbitFwdX * lookDist,
      y:
        input.baseElevY +
        (input.isTpsAim ? 1.7 : 2.15) +
        lookPitchShift,
      z: input.playerZ + orbitFwdZ * lookDist,
    },
    dampFactor: exponentialDampFactor(
      input.isTpsAim ? 14 : isCinematic ? 5.5 : 8.8,
      input.dt
    ),
    lookDampFactor: exponentialDampFactor(input.isTpsAim ? 18 : 11.5, input.dt),
  };
}

/**
 * Resolves drone FPV camera eye & look-ahead target above Jakarta.
 */
export function solveDroneFpvCamera(pose: {
  x: number;
  y: number;
  z: number;
  yaw: number;
}): {
  eye: { x: number; y: number; z: number };
  lookAt: { x: number; y: number; z: number };
} {
  const fwdX = Math.sin(pose.yaw);
  const fwdZ = Math.cos(pose.yaw);
  return {
    eye: {
      x: pose.x - fwdX * 0.4,
      y: pose.y - 0.15,
      z: pose.z - fwdZ * 0.4,
    },
    lookAt: {
      x: pose.x + fwdX * 18,
      y: Math.max(0, pose.y - 6.5),
      z: pose.z + fwdZ * 18,
    },
  };
}

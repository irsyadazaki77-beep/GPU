import assert from 'node:assert/strict';
import test from 'node:test';
import { createBuildingSpatialGrid, GRAND_HEISTS } from '../../game/rules';
import {
  computeHighSpeedCameraRumble,
  solveChaseCameraRig,
  solveDroneFpvCamera,
} from './cameraRig';
import { evaluateDroneEmpTargets } from './droneAndTakedown';

test('solveChaseCameraRig resolves smooth follow rig and TPS shoulder offset', () => {
  const grid = createBuildingSpatialGrid([], 18);
  const follow = solveChaseCameraRig({
    playerX: 10,
    playerZ: 20,
    baseElevY: 0,
    camYaw: 0,
    camPitch: 0.28,
    camMode: 'third_person',
    isDriving: true,
    isTpsAim: false,
    isBraking: false,
    moveForward: 1,
    speedRatio: 0.6,
    nowMs: 1000,
    dt: 0.016,
    buildingGrid: grid,
  });

  assert.ok(follow.desiredPos.z < 20);
  assert.ok(follow.lookTarget.z > 20);
  assert.ok(follow.dampFactor > 0 && follow.dampFactor <= 1);

  const fpv = solveDroneFpvCamera({ x: 5, y: 12, z: -8, yaw: 0 });
  assert.ok(fpv.lookAt.z > fpv.eye.z);
  assert.ok(fpv.lookAt.y < fpv.eye.y);

  const lowSpeedRumble = computeHighSpeedCameraRumble(0.5, 1000);
  assert.equal(lowSpeedRumble.offsetX, 0);
  assert.equal(lowSpeedRumble.offsetY, 0);

  const highSpeedRumble = computeHighSpeedCameraRumble(0.95, 1250);
  assert.ok(
    Math.abs(highSpeedRumble.offsetX) > 0 || Math.abs(highSpeedRumble.offsetY) > 0
  );
});

test('evaluateDroneEmpTargets detects enemies and nearby active Grand Heist CCTV vaults', () => {
  const heist = GRAND_HEISTS[0];
  const res = evaluateDroneEmpTargets({
    droneX: heist.vaultX + 4,
    droneZ: heist.vaultZ - 3,
    droneLevel: 2,
    activeHeistId: heist.id,
    enemies: [
      { id: 'e_near', x: heist.vaultX + 5, z: heist.vaultZ, state: 'alive' },
      { id: 'e_dead', x: heist.vaultX + 2, z: heist.vaultZ, state: 'ko' },
      { id: 'e_far', x: heist.vaultX + 90, z: heist.vaultZ, state: 'alive' },
    ],
  });

  assert.deepEqual(res.stunnedEnemyIds, ['e_near']);
  assert.equal(res.sabotagedHeistId, heist.id);
  assert.ok(res.empRadius >= 15);
});

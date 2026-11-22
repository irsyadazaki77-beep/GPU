import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JAKARTA_SPEED_TRAPS,
  RIVAL_BOSS_CATALOG,
  computeAmbientSkyAndMarinePose,
  computeDroneEmpRadius,
  computeSlipstreamDraftBoost,
  computeSurgeFareMultiplier,
  createVigilantePatrolSession,
  evaluateSpeedTrapTrigger,
  stepDroneReconPose,
  stepVigilanteTargetMovement,
} from './rules';

test('Grand Plan 6.0: Rajawali-X FPV Drone flight leash, altitude clamp, and EMP radius scaling', () => {
  let pose = { x: 0, y: 8, z: 0, yaw: 0, empCooldownSec: 2.0 };
  for (let i = 0; i < 80; i++) {
    pose = stepDroneReconPose({
      pose,
      playerX: 0,
      playerZ: 0,
      forwardInput: 1,
      strafeInput: 0,
      climbInput: 1,
      yawInput: 0,
      dt: 0.05,
      maxLeashM: 68,
    });
  }
  assert.ok(Math.hypot(pose.x, pose.z) <= 68.01);
  assert.ok(pose.y <= 44);
  assert.equal(pose.empCooldownSec, 0);
  assert.ok(computeDroneEmpRadius(3) > computeDroneEmpRadius(1));
});

test('Grand Plan 6.0: Jakarta ETLE speed traps trigger records, rewards, and extreme speeding alert', () => {
  const trap = JAKARTA_SPEED_TRAPS[0];
  const miss = evaluateSpeedTrapTrigger({
    x: trap.x,
    z: trap.z,
    speedKmh: trap.targetKmh - 10,
    records: {},
    cooldowns: {},
    nowMs: 50000,
  });
  assert.equal(miss.triggered, false);

  const hit = evaluateSpeedTrapTrigger({
    x: trap.x + 2,
    z: trap.z,
    speedKmh: 170,
    records: {},
    cooldowns: {},
    nowMs: 50000,
  });
  assert.equal(hit.triggered, true);
  assert.equal(hit.isNewRecord, true);
  assert.equal(hit.wantedTriggered, true);
  assert.equal(hit.rewardRp, trap.rewardRp);

  // Cooldown prevents re-trigger within 15s
  const cdBlocked = evaluateSpeedTrapTrigger({
    x: trap.x,
    z: trap.z,
    speedKmh: 170,
    records: { [trap.id]: 170 },
    cooldowns: { [trap.id]: 50000 },
    nowMs: 55000,
  });
  assert.equal(cdBlocked.triggered, false);
});

test('Grand Plan 6.0: Vigilante Patrol session, fleeing target kinematics, and Rival Boss catalog', () => {
  const session = createVigilantePatrolSession(2);
  assert.equal(session.streak, 2);
  assert.equal(session.status, 'active');
  assert.ok(session.rewardRp > 145000);

  const step = stepVigilanteTargetMovement({
    targetX: 20,
    targetZ: 20,
    playerX: 10,
    playerZ: 20,
    dt: 0.05,
  });
  assert.ok(step.x > 20); // Flees +X away from player
  assert.equal(RIVAL_BOSS_CATALOG.length, 3);
});

test('Grand Plan 6.0: Slipstream drafting boost, monsoon surge multiplier, and ambient sky/marine traffic', () => {
  const draft = computeSlipstreamDraftBoost({
    playerX: 0,
    playerZ: 0,
    playerHeading: 0,
    playerSpeed: 18,
    otherVehicles: [{ x: 0.4, z: 11, speed: 15 }],
  });
  assert.equal(draft.drafting, true);
  assert.equal(draft.speedMultiplier, 1.18);

  const noDraft = computeSlipstreamDraftBoost({
    playerX: 0,
    playerZ: 0,
    playerHeading: 0,
    playerSpeed: 6,
    otherVehicles: [{ x: 0.4, z: 11, speed: 15 }],
  });
  assert.equal(noDraft.drafting, false);

  assert.equal(computeSurgeFareMultiplier('siang', 720), 1.0);
  assert.equal(computeSurgeFareMultiplier('hujan', 1140), 1.6);

  const skySea = computeAmbientSkyAndMarinePose(12.5);
  assert.ok(skySea.skyHeli1.y > 25);
  assert.ok(skySea.bayBoat1.z < -85);
});

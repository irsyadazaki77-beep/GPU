import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDynamicRadioBroadcast,
  canDeployParachute,
  canPerformSilentTakedown,
  computeDopplerPitchMultiplier,
  computeMrtTrainState,
  computeStealthDetectionProfile,
  createInitialVehicleDamage,
  createRagdollImpulse,
  evaluateVehicleDebrisDrop,
  isPlayerNearMrtStation,
  reduceCoopHeistRoomState,
  resolveAcousticZone,
  resolveCoopPassengerOffset,
  stepParachuteGlide,
  stepRagdollState,
} from './rules';
import { applyVehicleImpactDamage } from './nextGenSystems';

test('Grand Plan 5.0: Stealth crouch, suppressor noise reduction, and behind-the-back silent takedown', () => {
  const loud = computeStealthDetectionProfile({
    crouching: false,
    inCover: false,
    hasSuppressor: false,
    isNightOrRain: false,
  });
  const stealth = computeStealthDetectionProfile({
    crouching: true,
    inCover: true,
    hasSuppressor: true,
    isNightOrRain: true,
  });

  assert.equal(loud.detectionRadiusMultiplier, 1);
  assert.ok(stealth.detectionRadiusMultiplier <= 0.35);
  assert.ok(stealth.gunshotNoiseRadius < loud.gunshotNoiseRadius * 0.3);

  // Enemy facing +Z (heading = 0); player standing behind at -Z
  const behindOk = canPerformSilentTakedown({
    playerX: 0,
    playerZ: -1.8,
    enemyX: 0,
    enemyZ: 0,
    enemyFacing: 0,
    enemyAlerted: true,
    isStealthOrMelee: true,
  });
  assert.equal(behindOk, true);

  // Player in front of alerted enemy should not silent-takedown
  const frontBlocked = canPerformSilentTakedown({
    playerX: 0,
    playerZ: 1.8,
    enemyX: 0,
    enemyZ: 0,
    enemyFacing: 0,
    enemyAlerted: true,
    isStealthOrMelee: true,
  });
  assert.equal(frontBlocked, false);
});

test('Grand Plan 5.0: Parachute deployment threshold and glide physics to safe landing', () => {
  assert.equal(
    canDeployParachute({
      playerY: 4.0,
      groundY: 0,
      drivingVehicleId: null,
      alreadyDeployed: false,
      ridingMrt: false,
    }),
    false
  );
  assert.equal(
    canDeployParachute({
      playerY: 16.0,
      groundY: 0,
      drivingVehicleId: null,
      alreadyDeployed: false,
      ridingMrt: false,
    }),
    true
  );

  let state = { x: 0, y: 12, z: 0, heading: 0, vy: -8 };
  let landed = false;
  for (let i = 0; i < 200; i++) {
    const step = stepParachuteGlide({
      ...state,
      groundY: 0,
      forwardInput: 1,
      turnInput: 0.25,
      brakeInput: false,
      dt: 0.05,
    });
    state = { x: step.x, y: step.y, z: step.z, heading: step.heading, vy: step.vy };
    if (step.landed) {
      landed = true;
      break;
    }
  }
  assert.equal(landed, true);
  assert.equal(state.y, 0);
  assert.ok(state.z > 10);
});

test('Grand Plan 5.0: Ragdoll impulse + bounce settling & detachable vehicle debris drop', () => {
  let rag = createRagdollImpulse({
    dirX: 1,
    dirZ: 0.5,
    force: 15,
    isExplosion: true,
  });
  assert.equal(rag.active, true);
  assert.ok(rag.vy > 5);

  let totalDx = 0;
  for (let i = 0; i < 120 && rag.active; i++) {
    const res = stepRagdollState(rag, 0.03);
    rag = res.next;
    totalDx += res.dx;
  }
  assert.ok(totalDx > 2);
  assert.equal(rag.yOffset, 0);

  const initDmg = createInitialVehicleDamage();
  const crashed = applyVehicleImpactDamage(initDmg, 14, 'front');
  const debris = evaluateVehicleDebrisDrop(crashed.next, 14, false);
  assert.ok(debris.includes('bumper'));
  const boomDebris = evaluateVehicleDebrisDrop(crashed.next, 20, true);
  assert.deepEqual(boomDebris, ['hood', 'door', 'bumper', 'wheel']);
});

test('Grand Plan 5.0: 3D Doppler pitch shift, acoustic zone reverb, and dynamic radio broadcast', () => {
  const approaching = computeDopplerPitchMultiplier({
    sourceX: 0,
    sourceY: 0,
    sourceZ: -30,
    sourceVx: 0,
    sourceVy: 0,
    sourceVz: 25,
    listenerX: 0,
    listenerY: 0,
    listenerZ: 0,
  });
  const receding = computeDopplerPitchMultiplier({
    sourceX: 0,
    sourceY: 0,
    sourceZ: -30,
    sourceVx: 0,
    sourceVy: 0,
    sourceVz: -25,
    listenerX: 0,
    listenerY: 0,
    listenerZ: 0,
  });
  assert.ok(approaching > 1.05);
  assert.ok(receding < 0.95);

  assert.equal(
    resolveAcousticZone({ x: -13.6, y: 0.5, z: 10, currentInterior: 'exterior' }).zone,
    'underpass_toll'
  );
  assert.equal(
    resolveAcousticZone({ x: 0, y: 0.5, z: 0, currentInterior: 'safehouse_trio' }).zone,
    'interior_room'
  );

  const dispatch = buildDynamicRadioBroadcast({
    stationId: 'berita_kriminal',
    wantedLevel: 5,
    districtName: 'Sudirman',
    weatherMode: 'malam',
    activeHeistId: null,
    tickSeed: 42,
  });
  assert.ok(dispatch);
  assert.equal(dispatch!.urgency, 'police_dispatch');
  assert.match(dispatch!.headline, /BINTANG 5/);
});

test('Grand Plan 5.0: Co-Op passenger seat offset, shared heist sync, and rideable MRT Ratangga', () => {
  const seat = resolveCoopPassengerOffset({
    x: 10,
    y: 0,
    z: 20,
    heading: 0,
    vehicleType: 'supercar',
  });
  assert.ok(Math.abs(seat.x - 10.85) < 0.01);

  const synced = reduceCoopHeistRoomState(
    {
      heistId: null,
      stageLabel: 'Siaga',
      progressPct: 0,
      sharedWantedLevel: 0,
      crewRoles: {},
      updatedAtMs: 0,
    },
    [
      {
        peerId: 'p2',
        displayName: 'Raka',
        protagonist: 'raka',
        x: 0,
        y: 0,
        z: 0,
        heading: 0,
        speed: 0,
        vehicleType: 'ojek',
        wantedLevel: 4,
        updatedAt: 1,
      },
    ],
    'p1',
    'nabilo',
    1,
    { heistId: 'heist_bursa_scbd', progressPct: 65, stageLabel: 'Brankas Terbuka' }
  );
  assert.equal(synced.sharedWantedLevel, 4);
  assert.equal(synced.crewRoles.p1, 'nabilo');
  assert.equal(synced.crewRoles.p2, 'raka');
  assert.equal(synced.progressPct, 65);

  const mrt = computeMrtTrainState(0);
  assert.equal(mrt.x, -13.6);
  assert.ok(isPlayerNearMrtStation(-13.6, 48, 6.5));
});

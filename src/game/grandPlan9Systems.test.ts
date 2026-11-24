import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JAKARTA_DISTRICTS,
  SPBU_SERVICE_PRICE_RP,
  SPBU_STATIONS,
  computeHighStakesRaceTerms,
  createInitialPlayerState,
  createThrownGadgetZone,
  createTurfRaidEvent,
  evaluateMolotovBurnAt,
  evaluateRaceTimeMedal,
  evaluateSmokeScreenEffect,
  evaluateSpbuPumpExplosion,
  findNearestSpbuStation,
  isNearBuilding,
  isOnRoadway,
  resolveTurfRaidFailure,
  resolveTurfRaidVictory,
  stepActiveTacticalZones,
  updatePersonalBestRaceRecord,
} from './rules';
import {
  evaluateStuntLandingImpact,
  stepVehicleFuelConsumption,
} from '../engine/controllers/vehiclePhysics';
import { gameStore } from '../state/gameStore';

test('Grand Plan 9.0: 3 SPBU Pertamina stations stay off asphalt roadways and clear of CITY_BUILDINGS', () => {
  assert.equal(SPBU_STATIONS.length, 3);
  for (const st of SPBU_STATIONS) {
    assert.equal(
      isOnRoadway(st.x, st.z),
      false,
      `SPBU ${st.id} overlaps roadway`
    );
    assert.equal(
      isNearBuilding(st.x, st.z, 5.5),
      false,
      `SPBU ${st.id} too close to building`
    );
  }

  const nearScbd = findNearestSpbuStation(42, 60, []);
  assert.equal(nearScbd?.id, 'spbu_scbd_kuningan');

  // Chain-reaction fuel dispenser explosion marks station destroyed and adds +2 Wanted stars
  const blast = evaluateSpbuPumpExplosion({
    impactX: 44.5,
    impactZ: 62.2,
    impactRadiusM: 3.2,
    destroyedIds: [],
  });
  assert.equal(blast.triggered, true);
  assert.equal(blast.station?.id, 'spbu_scbd_kuningan');
  assert.equal(blast.wantedStarsAdded, 2);
  assert.equal(blast.blastRadiusM >= 11, true);
  assert.deepEqual(blast.nextDestroyedIds, ['spbu_scbd_kuningan']);

  // Destroyed SPBU cannot be used for service or detonated twice
  assert.equal(findNearestSpbuStation(44, 62, blast.nextDestroyedIds), null);
  const secondBlast = evaluateSpbuPumpExplosion({
    impactX: 44,
    impactZ: 62,
    destroyedIds: blast.nextDestroyedIds,
  });
  assert.equal(secondBlast.triggered, false);
});

test('Grand Plan 9.0: Throwable Smoke Grenade conceals from police and Molotov applies burn DoT', () => {
  const smokeZone = createThrownGadgetZone('smoke_grenade', 0, 20, 0, 's1');
  const molotovZone = createThrownGadgetZone('molotov', 10, 20, Math.PI / 2, 'm1');

  // Smoke screen hides player inside 12m radius
  const insideSmoke = evaluateSmokeScreenEffect(
    [smokeZone],
    smokeZone.x + 3,
    smokeZone.z - 2
  );
  assert.equal(insideSmoke.inSmoke, true);
  assert.ok(insideSmoke.detectionMultiplier < 0.5);
  assert.ok(insideSmoke.wantedCooldownMultiplier >= 2.0);

  const outsideSmoke = evaluateSmokeScreenEffect([smokeZone], 80, 80);
  assert.equal(outsideSmoke.inSmoke, false);

  // Molotov deals continuous fire DoT inside 5.5m radius
  const burnHit = evaluateMolotovBurnAt(
    [molotovZone],
    molotovZone.x + 1.5,
    molotovZone.z,
    0.5
  );
  assert.equal(burnHit.burning, true);
  assert.equal(burnHit.damage, 9);

  // Zones expire cleanly over time
  const stepped = stepActiveTacticalZones([smokeZone, molotovZone], 8.0);
  assert.equal(stepped.length, 1); // 7s molotov expired, 9s smoke has 1s left
  assert.equal(stepped[0].kind, 'smoke_grenade');
});

test('Grand Plan 9.0: Stunt landing suspension squash, titanium sparks, and vehicle fuel endurance', () => {
  const softHop = evaluateStuntLandingImpact(0.4, 10);
  assert.equal(softHop.landedHard, false);
  assert.equal(softHop.sparkCount, 0);

  const bigJump = evaluateStuntLandingImpact(3.6, 22);
  assert.equal(bigJump.landedHard, true);
  assert.ok(bigJump.squashDepthM >= 0.2);
  assert.ok(bigJump.sparkCount >= 12);

  const extremeDrop = evaluateStuntLandingImpact(5.5, 25);
  assert.ok(extremeDrop.chassisDamage > 0);

  // Fuel burns faster under Nitro and triggers non-locking limp mode at 0%
  const normalStep = stepVehicleFuelConsumption({
    fuelPct: 50,
    speedRatio: 0.8,
    nitroActive: false,
    isAircraft: false,
    dt: 1.0,
  });
  const nitroStep = stepVehicleFuelConsumption({
    fuelPct: 50,
    speedRatio: 0.8,
    nitroActive: true,
    isAircraft: false,
    dt: 1.0,
  });
  assert.ok(nitroStep.nextFuelPct < normalStep.nextFuelPct);
  assert.equal(normalStep.speedCapMultiplier, 1.0);

  const emptyStep = stepVehicleFuelConsumption({
    fuelPct: 0,
    speedRatio: 1.0,
    nitroActive: false,
    isAircraft: false,
    dt: 0.5,
  });
  assert.equal(emptyStep.nextFuelPct, 0);
  assert.equal(emptyStep.speedCapMultiplier, 0.28);
});

test('Grand Plan 9.0: Rival Turf Raid defense, High-Stakes Race Wagers, Medals, and Store SPBU/Siren actions', () => {
  const base = createInitialPlayerState('anak_jalanan');
  const fortifiedTurf = Object.fromEntries(
    Object.entries(base.districtTurf).map(([k, v]) => [
      k,
      { ...v, defenseLevel: 3 },
    ])
  );
  const withOwnedTurf = {
    ...base,
    rupiah: 200000,
    districtTurf: {
      ...fortifiedTurf,
      blok_m: {
        districtId: 'blok_m',
        owner: 'player' as const,
        defenseLevel: 1,
        dividendRp: 12000,
      },
    },
  };

  const raid = createTurfRaidEvent(withOwnedTurf, JAKARTA_DISTRICTS, 0);
  assert.ok(raid);
  assert.equal(raid.districtId, 'blok_m');

  const defended = resolveTurfRaidVictory(withOwnedTurf, raid);
  assert.equal(defended.rupiah, 200000 + raid.rewardRp);
  assert.equal(defended.districtTurf.blok_m.defenseLevel, 2);

  const failed = resolveTurfRaidFailure(withOwnedTurf, raid);
  assert.equal(failed.districtTurf.blok_m.owner, 'syndicate');

  // High-stakes race terms & personal best medal tracking
  const hsTerms = computeHighStakesRaceTerms(20000, 100000, true);
  assert.equal(hsTerms.entryFeeRp, 40000);
  assert.equal(hsTerms.firstPlaceRewardRp, 250000);
  assert.equal(evaluateRaceTimeMedal(18, 5), 'emas');
  assert.equal(evaluateRaceTimeMedal(45, 5), 'perunggu');

  const rec1 = updatePersonalBestRaceRecord({}, 'sudirman_sprint', 24.5, 5, 1000);
  assert.equal(rec1.isNewBest, true);
  assert.equal(rec1.medal, 'emas');
  const rec2 = updatePersonalBestRaceRecord(
    rec1.nextRecords,
    'sudirman_sprint',
    29.2,
    5,
    2000
  );
  assert.equal(rec2.isNewBest, false);
  assert.equal(rec2.nextRecords.sudirman_sprint.bestSec, 24.5);

  // Store integration: SPBU refuel & Patwal siren toggle
  const prevSnap = gameStore.getState();
  gameStore.setState({
    vehicleFuelPct: 32,
    patwalSirenActive: false,
    playerState: { ...prevSnap.playerState, rupiah: 100000 },
  });
  const refueled = gameStore.refuelAndRepairAtSpbu('SPBU SCBD');
  assert.equal(refueled, true);
  assert.equal(gameStore.getState().vehicleFuelPct, 100);
  assert.equal(
    gameStore.getState().playerState.rupiah,
    100000 - SPBU_SERVICE_PRICE_RP
  );

  assert.equal(gameStore.togglePatwalSiren(), true);
  assert.equal(gameStore.getState().patwalSirenActive, true);
  assert.equal(gameStore.togglePatwalSiren(), false);
});

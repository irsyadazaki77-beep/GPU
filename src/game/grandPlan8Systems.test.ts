import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialNitroTankState,
  evaluateMotorcycleStuntPose,
  stepNitroBoostState,
} from '../engine/controllers/vehiclePhysics';
import {
  attemptSafePinLock,
  computeSafeDialProximity,
  createInitialPlayerState,
  createSafeDialSession,
  evaluateSyndicateCounterAttack,
  getActiveBlackMarketVanLocation,
  purchaseBlackMarketItem,
} from './rules';

test('Grand Plan 8.0: Nitro NOS consumes fuel, boosts speed/FOV, recharges faster during drift, and triggers blow-off valve on release', () => {
  const init = createInitialNitroTankState();
  assert.equal(init.level, 100);

  const boosting = stepNitroBoostState({
    state: init,
    boostRequested: true,
    forwardSpeed: 14,
    isDrifting: false,
    isAircraft: false,
    dt: 0.5,
  });
  assert.equal(boosting.nextState.active, true);
  assert.ok(boosting.nextState.level < 100);
  assert.ok(boosting.speedMultiplier > 1.2);
  assert.ok(boosting.fovBoostDeg > 5);

  const released = stepNitroBoostState({
    state: boosting.nextState,
    boostRequested: false,
    forwardSpeed: 18,
    isDrifting: true,
    isAircraft: false,
    dt: 0.5,
  });
  assert.equal(released.justReleased, true);
  assert.equal(released.nextState.active, false);
  assert.ok(released.nextState.level > boosting.nextState.level);
});

test('Grand Plan 8.0: Motorcycle stunt physics evaluates wheelie, stoppie, and corner lean cleanly', () => {
  const wheelie = evaluateMotorcycleStuntPose({
    isMotorcycle: true,
    speed: 12,
    turnInput: 0,
    wheelieHeld: true,
    isBraking: false,
    dt: 0.2,
  });
  assert.equal(wheelie.stuntKind, 'wheelie');
  assert.ok(wheelie.pitchOffsetRad < -0.2);
  assert.ok(wheelie.stuntScoreDelta > 0);

  const stoppie = evaluateMotorcycleStuntPose({
    isMotorcycle: true,
    speed: 14,
    turnInput: 0.5,
    wheelieHeld: false,
    isBraking: true,
    dt: 0.2,
  });
  assert.equal(stoppie.stuntKind, 'stoppie');
  assert.ok(stoppie.pitchOffsetRad > 0.15);
  assert.ok(stoppie.rollOffsetRad < 0);
});

test('Grand Plan 8.0: Roaming Black Market Van rotates by 24h Jakarta clock and scales prices with District Heat', () => {
  const nightStop = getActiveBlackMarketVanLocation(22 * 60);
  assert.equal(nightStop.id, 'van_glodok_night');

  const dawnStop = getActiveBlackMarketVanLocation(6 * 60);
  assert.equal(dawnStop.id, 'van_priok_dawn');

  const noonStop = getActiveBlackMarketVanLocation(13 * 60);
  assert.equal(noonStop.id, 'van_tanah_abang_noon');

  const duskStop = getActiveBlackMarketVanLocation(18 * 60);
  assert.equal(duskStop.id, 'van_blokm_dusk');

  const pCalm = {
    ...createInitialPlayerState('anak_jalanan'),
    rupiah: 500000,
    armor: 10,
    wantedLevel: 0,
  };
  const buyCalm = purchaseBlackMarketItem(pCalm, 'kevlar_brimob_vest');
  assert.equal(buyCalm.purchased, true);
  assert.equal(buyCalm.nextState.armor, pCalm.maxArmor);

  const pHot = { ...pCalm, wantedLevel: 5 };
  const buyHot = purchaseBlackMarketItem(pHot, 'kevlar_brimob_vest');
  assert.equal(buyHot.purchased, true);
  assert.ok(buyHot.finalPriceRp > buyCalm.finalPriceRp);
});

test('Grand Plan 8.0: Safe Dial Tumbler Lock-Picking unlocks 3 pins cleanly and Syndicate Counter-Invasion triggers at 4+ player districts', () => {
  let dial = createSafeDialSession(99);
  assert.equal(dial.unlockedPins, 0);

  // Wrap-around proximity check near 0/360
  const wrapProx = computeSafeDialProximity(356, 2);
  assert.equal(wrapProx.angularDistanceDeg, 6);
  assert.equal(wrapProx.inSweetSpot, true);

  for (let pin = 0; pin < 3; pin++) {
    dial = { ...dial, currentAngleDeg: dial.targetAnglesDeg[pin] };
    const attempt = attemptSafePinLock(dial);
    assert.equal(attempt.pinLocked, true);
    dial = attempt.nextState;
    if (pin === 2) {
      assert.equal(attempt.vaultOpened, true);
      assert.equal(dial.completed, true);
    }
  }

  // Turf war counter-attack requires >= 4 player-owned districts
  const baseState = createInitialPlayerState('anak_jalanan');
  const noInvasion = evaluateSyndicateCounterAttack(baseState, 1);
  assert.equal(noInvasion.active, false);

  const expandedState = {
    ...baseState,
    districtTurf: {
      ...baseState.districtTurf,
      scbd: {
        ...baseState.districtTurf.scbd,
        owner: 'player' as const,
      },
    },
  };
  const invasion = evaluateSyndicateCounterAttack(expandedState, 2);
  assert.equal(invasion.active, true);
  assert.ok(invasion.districtId !== null);
  assert.ok(invasion.bonusDefenseRewardRp >= 175000);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WANTED_TIER_SPECS,
  getWantedTierSpec,
  computePoliceInterceptVector,
  evaluateSpikeStripHit,
  stepWantedSystemCooldown,
} from './wantedSystem';

test('getWantedTierSpec returns exact 1-5 star escalation specs', () => {
  assert.equal(getWantedTierSpec(0), null);

  const tier1 = getWantedTierSpec(1);
  assert.ok(tier1);
  assert.deepEqual(tier1.unitTypes, ['ojek']);
  assert.equal(tier1.enablePitManeuver, false);

  const tier2 = getWantedTierSpec(2);
  assert.ok(tier2);
  assert.equal(tier2.enablePitManeuver, true);
  assert.ok(tier2.unitTypes.includes('polisi'));

  const tier3 = getWantedTierSpec(3);
  assert.ok(tier3);
  assert.equal(tier3.enableRoadblocks, true);
  assert.equal(tier3.enableSpikeStrips, true);

  const tier4 = getWantedTierSpec(4);
  assert.ok(tier4);
  assert.equal(tier4.enableBrimobTactical, true);
  assert.ok(tier4.unitTypes.includes('barracuda'));

  const tier5 = getWantedTierSpec(5);
  assert.ok(tier5);
  assert.equal(tier5.enableHelicopterSpotlight, true);
  assert.equal(tier5.districtLockdown, true);
  assert.ok(tier5.unitTypes.includes('heli'));
});

test('computePoliceInterceptVector predicts ahead of moving target at 2+ stars (PIT maneuver)', () => {
  // At 1 star, no lead prediction
  const tier1Vec = computePoliceInterceptVector(0, 0, 50, 0, 0, 20, 1);
  assert.equal(tier1Vec.pitManeuverActive, false);
  assert.equal(tier1Vec.targetZ, 0);

  // At 2 stars, lead prediction aims ahead along player velocity Z
  const tier2Vec = computePoliceInterceptVector(0, 0, 50, 0, 0, 20, 2);
  assert.equal(tier2Vec.pitManeuverActive, true);
  assert.ok(tier2Vec.targetZ > 10, 'Should aim ahead of moving vehicle for PIT intercept');
  assert.ok(tier2Vec.dirZ > 0.2);
});

test('evaluateSpikeStripHit triggers tire burst slowdown only at Wanted 3+ on active roadblocks', () => {
  const missLowWanted = evaluateSpikeStripHit(10, 10, 10, 10, true, 2);
  assert.equal(missLowWanted.hit, false);
  assert.equal(missLowWanted.speedMultiplier, 1);

  const hitTier3 = evaluateSpikeStripHit(12, 11, 10, 10, true, 3);
  assert.equal(hitTier3.hit, true);
  assert.ok(hitTier3.speedMultiplier < 0.5);
  assert.ok(hitTier3.damage > 0);

  const missFar = evaluateSpikeStripHit(35, 11, 10, 10, true, 4);
  assert.equal(missFar.hit, false);
});

test('stepWantedSystemCooldown decays stars when out of line of sight and accelerates under overpass cover', () => {
  const tier1Cooldown = WANTED_TIER_SPECS[1].baseCooldownSeconds;

  // Still in line of sight -> resets timer, not flashing
  const inSight = stepWantedSystemCooldown(1, 5, true, false, false, 2);
  assert.equal(inSight.flashingCooldown, false);
  assert.equal(inSight.remainingSeconds, tier1Cooldown);
  assert.equal(inSight.cleared, false);

  // Out of sight -> flashes and counts down
  const halfWay = stepWantedSystemCooldown(1, 0, false, false, false, tier1Cooldown * 0.5);
  assert.equal(halfWay.flashingCooldown, true);
  assert.equal(halfWay.wantedLevel, 1);
  assert.equal(halfWay.cleared, false);

  // Under overpass + Kirana blackout -> accelerates cooldown past threshold
  const cleared = stepWantedSystemCooldown(1, tier1Cooldown * 0.5, false, true, true, tier1Cooldown * 0.35);
  assert.equal(cleared.cleared, true);
  assert.equal(cleared.wantedLevel, 0);
});

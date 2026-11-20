import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTirePuncture,
  applyVehicleImpactDamage,
  buildLocalViralPost,
  computeTrioSynergyPerks,
  computeViralCloutState,
  createInitialPoliceTacticalState,
  createInitialTrioSynergy,
  createInitialVehicleDamage,
  getVehicleHandlingPenalty,
  incrementTrioSynergy,
  isPlayerWithinStreetEvent,
  spawnNextStreetRandomEvent,
  stepPoliceTacticalState,
  stepVehicleDamageTick,
  triggerWitnessCrimeReport,
} from './nextGenSystems';

test('vehicle impact damage crumples zones, breaks headlights, catches fire, and explodes', () => {
  let dmg = createInitialVehicleDamage();
  assert.equal(dmg.integrity, 100);
  assert.equal(dmg.smokeStage, 'none');

  // Small tap under threshold does nothing
  const tap = applyVehicleImpactDamage(dmg, 0.8, 'front');
  assert.equal(tap.damageApplied, 0);
  assert.equal(tap.next.integrity, 100);

  // Heavy front impact breaks headlight and crumples front
  const hit1 = applyVehicleImpactDamage(dmg, 12, 'front');
  dmg = hit1.next;
  assert.ok(hit1.damageApplied > 0);
  assert.equal(hit1.justBrokeHeadlight, true);
  assert.equal(dmg.headlightsBroken[0], true);
  assert.ok(dmg.zones.front >= 1.5);

  // Repeated heavy hits transition into fire & countdown
  const hit2 = applyVehicleImpactDamage(dmg, 15, 'front');
  const hit3 = applyVehicleImpactDamage(hit2.next, 15, 'rear');
  dmg = hit3.next;
  assert.equal(dmg.smokeStage, 'fire');
  assert.ok(dmg.explosionCountdownSec !== null && dmg.explosionCountdownSec > 0);

  // Tick down to explosion
  const exp = stepVehicleDamageTick(dmg, 6);
  assert.equal(exp.triggeredExplosion, true);
  assert.equal(exp.next.exploded, true);
  assert.equal(exp.next.integrity, 0);
});

test('tire punctures reduce speed multiplier and introduce asymmetric steering pull', () => {
  const base = createInitialVehicleDamage();
  const basePenalty = getVehicleHandlingPenalty(base);
  assert.equal(basePenalty.speedMultiplier, 1);
  assert.equal(basePenalty.steeringPull, 0);

  // Puncture right-front tire (index 1)
  const puncturedRight = applyTirePuncture(base, [1]);
  const rightPenalty = getVehicleHandlingPenalty(puncturedRight);
  assert.equal(rightPenalty.flatCount, 1);
  assert.ok(rightPenalty.speedMultiplier < 1);
  assert.ok(rightPenalty.steeringPull > 0);

  // Puncture both front tires balances steering pull back to 0 but lowers speed further
  const puncturedBoth = applyTirePuncture(puncturedRight, [0]);
  const bothPenalty = getVehicleHandlingPenalty(puncturedBoth);
  assert.equal(bothPenalty.flatCount, 2);
  assert.equal(bothPenalty.steeringPull, 0);
  assert.ok(bothPenalty.speedMultiplier < rightPenalty.speedMultiplier);
});

test('police tactical AI transitions witness -> active pursuit -> LKP search -> clear', () => {
  let state = createInitialPoliceTacticalState();
  state = triggerWitnessCrimeReport(state, 10, 20, 'Sudirman', 0, 1000);
  assert.equal(state.phase, 'witness_reporting');
  assert.ok(state.radioCallout?.includes('Sudirman'));

  // Stay near witness until escalation to 1 star
  const esc = stepPoliceTacticalState(state, {
    dt: 4,
    wantedLevel: 0,
    hasLineOfSight: false,
    playerX: 14,
    playerZ: 22,
    districtName: 'Sudirman',
    nowMs: 5000,
  });
  assert.equal(esc.escalateToStarOne, true);
  assert.equal(esc.next.phase, 'active_pursuit');

  // Lose line of sight -> searching LKP
  const lkp = stepPoliceTacticalState(esc.next, {
    dt: 1,
    wantedLevel: 2,
    hasLineOfSight: false,
    playerX: 40,
    playerZ: 60,
    districtName: 'SCBD',
    nowMs: 6000,
  });
  assert.equal(lkp.next.phase, 'searching_lkp');
  assert.equal(lkp.next.lastKnownX, 14);
  assert.equal(lkp.next.lastKnownZ, 22);

  // Clear wanted -> returns to clear
  const cleared = stepPoliceTacticalState(lkp.next, {
    dt: 1,
    wantedLevel: 0,
    hasLineOfSight: false,
    playerX: 80,
    playerZ: 80,
    districtName: 'SCBD',
    nowMs: 7000,
  });
  assert.equal(cleared.next.phase, 'clear');
});

test('living Jakarta street random events rotate without immediate duplicates and check radius', () => {
  const ev1 = spawnNextStreetRandomEvent(1);
  const ev2 = spawnNextStreetRandomEvent(2, ev1.kind);
  assert.notEqual(ev1.kind, ev2.kind);
  assert.equal(isPlayerWithinStreetEvent(ev1, ev1.x + 3, ev1.z - 4, 12), true);
  assert.equal(isPlayerWithinStreetEvent(ev1, ev1.x + 40, ev1.z, 12), false);
});

test('NabiloGram clout progression, local viral post builder, and trio synergy perks', () => {
  const clout = computeViralCloutState(300);
  assert.equal(clout.level, 3);
  assert.equal(clout.tierTitle, 'Trending Ibu Kota');
  assert.equal(clout.sponsorBonusPercent, 10);

  const post = buildLocalViralPost({
    id: 'ng_test_1',
    triggerKind: 'heist_complete',
    districtName: 'Kawasan Elit SCBD',
    protagonistName: 'Nabilo',
    wantedLevel: 4,
    snapshotDataUrl: null,
  });
  assert.ok(post.caption.includes('SCBD'));
  assert.ok(post.hashtags.length >= 2);
  assert.ok(post.comments.length >= 1);

  let syn = createInitialTrioSynergy();
  syn = incrementTrioSynergy(syn, 'kirana', 40);
  syn = incrementTrioSynergy(syn, 'raka', 30);
  const perks = computeTrioSynergyPerks(syn);
  assert.ok(perks.averageBond >= 75);
  assert.ok(perks.heistBonusPercent >= 8);
  assert.ok(syn.lastBanterLine !== null);
});

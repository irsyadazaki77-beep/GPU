import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyWantedHeatStockShock,
  computeDistrictHeatModifier,
  createInitialPlayerState,
  evaluateHelicopterSpotlightCone,
  projectSlideVelocityAlongWall,
  resolveCircleAABBCollision,
  stepWantedSystemCooldown,
} from '../../game/rules';
import {
  advanceMeleeComboStep,
  consumeWeaponAmmoAndComputeSpread,
  createInitialDodgeRollState,
  createInitialMagazineMap,
  createInitialMeleeComboState,
  evaluateBallisticHitDamage,
  evaluateTacticalEnemyAction,
  getEffectiveMagazineCapacity,
  startWeaponReload,
  stepMeleeComboDecay,
  stepTacticalDodgeRoll,
  stepWeaponMagazineAndReload,
  triggerTacticalDodgeRoll,
} from './combatController';
import {
  createInitialMissionLifecycleState,
  evaluateHeistGetawayProgress,
  spawnDynamicStreetEncounter,
  stepDynamicStreetEncounter,
  transitionMissionPhase,
} from './missionDirector';

test('combatController: magazine capacity scales with extendedMag, consumes rounds, and reloads cleanly', () => {
  assert.equal(getEffectiveMagazineCapacity('pistol', []), 12);
  assert.equal(getEffectiveMagazineCapacity('pistol', ['extendedMag']), 18);

  const magMap = createInitialMagazineMap({ pistol: ['extendedMag'] });
  let pistolMag = magMap.pistol;
  assert.equal(pistolMag.currentInMag, 18);

  const shot1 = consumeWeaponAmmoAndComputeSpread(pistolMag, 40, ['extendedMag']);
  assert.equal(shot1.canFire, true);
  assert.equal(shot1.nextMag.currentInMag, 17);
  assert.ok(shot1.nextMag.currentSpreadRad > pistolMag.currentSpreadRad);

  const reloading = startWeaponReload(shot1.nextMag, 39, ['extendedMag']);
  assert.equal(reloading.reloading, true);

  const stepHalf = stepWeaponMagazineAndReload(reloading, 39, 0.5, ['extendedMag']);
  assert.equal(stepHalf.reloadCompleted, false);

  const stepDone = stepWeaponMagazineAndReload(
    stepHalf.nextMag,
    39,
    1.0,
    ['extendedMag']
  );
  assert.equal(stepDone.reloadCompleted, true);
  assert.equal(stepDone.nextMag.reloading, false);
  assert.equal(stepDone.nextMag.currentInMag, 18);
});

test('combatController: evaluateBallisticHitDamage applies headshot critical multiplier, range falloff, and cover mitigation', () => {
  const headshot = evaluateBallisticHitDamage({
    weaponId: 'pistol',
    baseDamage: 30,
    distanceM: 8,
    maxRangeM: 28,
    aimAlignmentDot: 0.995,
    tpsAiming: true,
    aimPrecisionLevel: 3,
    targetInCover: false,
  });
  assert.equal(headshot.isHeadshot, true);
  assert.equal(headshot.isCritical, true);
  assert.ok(headshot.finalDamage >= 55);

  const longRangeCovered = evaluateBallisticHitDamage({
    weaponId: 'pistol',
    baseDamage: 30,
    distanceM: 26,
    maxRangeM: 28,
    aimAlignmentDot: 0.85,
    tpsAiming: false,
    aimPrecisionLevel: 1,
    targetInCover: true,
    deterministicRoll: 0.95,
  });
  assert.equal(longRangeCovered.isHeadshot, false);
  assert.ok(longRangeCovered.falloffMultiplier < 1.0);
  assert.ok(longRangeCovered.finalDamage < 15);
});

test('combatController: 3-hit melee combo escalates to Hantaman Jawara finisher and tactical dodge roll grants i-frames', () => {
  let combo = createInitialMeleeComboState();
  const s1 = advanceMeleeComboStep(combo);
  assert.equal(s1.stageExecuted, 1);
  assert.equal(s1.isFinisher, false);

  const s2 = advanceMeleeComboStep(s1.nextCombo);
  assert.equal(s2.stageExecuted, 2);
  assert.ok(s2.damageMultiplier > s1.damageMultiplier);

  const s3 = advanceMeleeComboStep(s2.nextCombo);
  assert.equal(s3.stageExecuted, 3);
  assert.equal(s3.isFinisher, true);
  assert.equal(s3.damageMultiplier, 1.75);

  const decayed = stepMeleeComboDecay(s3.nextCombo, 1.2);
  assert.equal(decayed.stage, 0);

  const rollInit = createInitialDodgeRollState();
  const triggered = triggerTacticalDodgeRoll(rollInit, 0, 1, 0);
  assert.equal(triggered.triggered, true);
  assert.equal(triggered.nextState.active, true);

  const rollStep = stepTacticalDodgeRoll(triggered.nextState, 0.15);
  assert.equal(rollStep.hasActiveIFrames, true);
  assert.ok(rollStep.dz > 0);
});

test('combatController: evaluateTacticalEnemyAction flanks and suppresses when player is in cover', () => {
  const flanker = evaluateTacticalEnemyAction({
    policy: 'charger_enforcer',
    enemyX: 0,
    enemyZ: 0,
    playerX: 0,
    playerZ: 12,
    playerInCover: true,
    moveSpeed: 6,
    preferredRange: 4,
    phaseTimer: 1.0,
    enemyIndex: 0,
  });
  assert.equal(flanker.flankingActive, true);
  assert.ok(Math.abs(flanker.moveVx) > 1.0);

  const ranged = evaluateTacticalEnemyAction({
    policy: 'ranged_kiter',
    enemyX: 0,
    enemyZ: 0,
    playerX: 0,
    playerZ: 14,
    playerInCover: true,
    moveSpeed: 5,
    preferredRange: 14,
    phaseTimer: 0.5,
    enemyIndex: 1,
  });
  assert.equal(ranged.suppressionBurst, true);
});

test('missionDirector: transitions mission lifecycle phases cleanly and evaluates Heist Getaway & Dynamic Street Encounters', () => {
  const init = createInitialMissionLifecycleState();
  const active = transitionMissionPhase(init, 'active', {
    missionId: 'm_test',
    spawnedEntityIds: ['en_1', 'en_2'],
  });
  assert.equal(active.nextState.phase, 'active');
  assert.equal(active.entitiesToCleanup.length, 0);

  const getaway = transitionMissionPhase(active.nextState, 'getaway', {
    originX: 0,
    originZ: 0,
    getawayRequiredRadiusM: 60,
  });
  const stepNear = evaluateHeistGetawayProgress(
    getaway.nextState,
    20,
    0,
    3,
    1.0
  );
  assert.equal(stepNear.escaped, false);
  assert.ok(stepNear.nextState.getawayProgressPct > 0);

  const stepFar = evaluateHeistGetawayProgress(
    stepNear.nextState,
    70,
    0,
    3,
    1.0
  );
  assert.equal(stepFar.escaped, true);
  assert.equal(stepFar.nextState.phase, 'completed');

  const aborted = transitionMissionPhase(active.nextState, 'failed');
  assert.deepEqual(aborted.entitiesToCleanup, ['en_1', 'en_2']);
  assert.equal(aborted.nextState.spawnedEntityIds.length, 0);

  const enc = spawnDynamicStreetEncounter(32, 50, []);
  assert.ok(enc !== null);
  const doneStep = stepDynamicStreetEncounter(enc!, enc!.spec.x, enc!.spec.z, 'nabilo', 5.0);
  assert.equal(doneStep.justCompleted, true);
  assert.ok(doneStep.rewardRp >= enc!.spec.rewardRp);
});

test('spatial, wantedSystem & economy: elevated collision separation, wall-sliding, ★5 chopper spotlight LOS, and District Heat stock shock', () => {
  // Ground collision at Monas (0, 0) pushes out, elevated flyover/aircraft above height (y=40) passes cleanly
  const groundCol = resolveCircleAABBCollision(0, 0, 1.2, undefined, undefined, 0);
  assert.equal(groundCol.collided, true);

  const skyCol = resolveCircleAABBCollision(0, 0, 1.2, undefined, undefined, 42);
  assert.equal(skyCol.collided, false);

  const slid = projectSlideVelocityAlongWall(-10, 6, 1, 0, 0);
  assert.equal(slid.vx, 0);
  assert.equal(slid.vz, 6);

  // ★5 Helicopter spotlight cone pauses wanted cooldown unless under overpass or Kirana blackout
  const spotExposed = evaluateHelicopterSpotlightCone({
    playerX: 10,
    playerZ: 10,
    chopperX: 12,
    chopperZ: 12,
    wantedLevel: 5,
    underOverpassCover: false,
    kiranaBlackoutActive: false,
  });
  assert.equal(spotExposed.illuminated, true);

  const cooldownPaused = stepWantedSystemCooldown(
    5,
    10,
    false,
    false,
    false,
    5.0,
    spotExposed.illuminated
  );
  assert.equal(cooldownPaused.flashingCooldown, false);

  const heatMod = computeDistrictHeatModifier(5, 2);
  assert.equal(heatMod.lockdownActive, true);
  assert.ok(heatMod.shopPriceMultiplier > 1.3);
  assert.ok(heatMod.policeResponseSpeedMultiplier > 1.3);

  const pState = createInitialPlayerState('anak_jalanan');
  const shock = applyWantedHeatStockShock(pState, 'scbd', 5, '14:00 WIB');
  assert.equal(shock.shocked, true);
  assert.ok(shock.news !== null);
  assert.ok(
    shock.nextState.stockPortfolio.GATO.currentPrice >
      pState.stockPortfolio.GATO.currentPrice
  );
});

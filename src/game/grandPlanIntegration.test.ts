import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMBAT_COMBO_WINDOW_MS,
  NEAR_MISS_COOLDOWN_MS,
  NUSANTARA_ALL_PACKAGES_BONUS_RP,
  NUSANTARA_PACKAGES,
  NUSANTARA_PACKAGE_REWARD_RP,
  TRAFFIC_ROUTES,
  WORLD_MAX_BOUND,
  collectNusantaraPackage,
  computeHospitalRespawnState,
  computeNearMissBonus,
  computeSpeedSensitiveTurnRate,
  createCustomRaceTrackSpec,
  createInitialPlayerState,
  resolveCombatComboState,
  stepVehicleLongitudinalSpeed,
} from './rules';
import { gameStore } from '../state/gameStore';

test('World expansion to 320m x 320m preserves outer ring route and bounds', () => {
  assert.equal(WORLD_MAX_BOUND, 160);
  assert.ok(TRAFFIC_ROUTES.outer_ring_express.length >= 6);
});

test('Trio active abilities, Kirana Cyber Hack, Safehouse rest, and Custom UGC race store actions work end-to-end', () => {
  // 1. Kirana 20s Cyber Hack activation & tick
  gameStore.setState({
    playerState: {
      ...createInitialPlayerState('teknisi_glodok'),
      activeProtagonist: 'kirana',
      hp: 45,
      armor: 10,
      wantedLevel: 2,
    },
    worldTimeMinutes: 600,
  });

  const kiranaRes = gameStore.triggerActiveProtagonistAbility();
  assert.equal(kiranaRes.triggered, true);
  assert.equal(kiranaRes.kind, 'kirana_hack');
  assert.equal(gameStore.getState().kiranaHackState.active, true);
  assert.equal(gameStore.getState().kiranaHackState.forceGreenLights, true);
  assert.equal(gameStore.getState().kiranaHackState.cameraBlackout, true);

  gameStore.stepKiranaHackTick(21);
  assert.equal(gameStore.getState().kiranaHackState.active, false);
  assert.equal(gameStore.getState().kiranaHackState.forceGreenLights, false);

  // 2. Nabilo Garuda Armor Surge (+25 armor)
  gameStore.updatePlayerState((prev) => ({
    ...prev,
    activeProtagonist: 'nabilo',
    fokusEnergy: 100,
    armor: 20,
    maxArmor: 100,
  }));
  const nabiloRes = gameStore.triggerActiveProtagonistAbility();
  assert.equal(nabiloRes.triggered, true);
  assert.equal(nabiloRes.kind, 'nabilo_surge');
  assert.equal(gameStore.getState().playerState.armor, 45);

  // 3. Safehouse Trio Rest (+6h, full HP/armor, clears wanted <= 2)
  const restRes = gameStore.restInSafehouse(6);
  assert.equal(restRes.hoursRested, 6);
  assert.equal(gameStore.getState().worldTimeMinutes, 960);
  assert.equal(gameStore.getState().playerState.hp, gameStore.getState().playerState.maxHp);
  assert.equal(gameStore.getState().playerState.armor, gameStore.getState().playerState.maxArmor);
  assert.equal(gameStore.getState().playerState.wantedLevel, 0);

  // 4. Custom Race Track UGC creation, Co-Op share receive, and launch
  const created = createCustomRaceTrackSpec({
    name: 'Sirkuit Kemerdekaan',
    authorName: 'Nabilo',
    checkpoints: [
      [0, -30],
      [32, -30],
      [32, 30],
      [-32, 30],
    ],
    isLoop: true,
  });
  assert.ok(created.track);
  gameStore.addCustomRaceTrack(created.track);
  assert.equal(
    gameStore.getState().playerState.customRaceTracks?.some((t) => t.id === created.track!.id),
    true
  );

  gameStore.receiveSharedCoopRace({ ...created.track, id: 'ugc_shared_peer_1' });
  assert.equal(
    gameStore.getState().sharedCoopRaces.some((t) => t.id === 'ugc_shared_peer_1'),
    true
  );

  const session = gameStore.startCustomStreetRace(created.track);
  assert.equal(session.raceId, created.track.id);
  assert.equal(session.totalRacers, 4);
  assert.equal(gameStore.getState().activeRace?.status, 'countdown');
});

test('10 Koper Emas Nusantara collectibles grant per-package rewards and 2M grand bonus', () => {
  assert.equal(NUSANTARA_PACKAGES.length, 10);
  let state = createInitialPlayerState('mantan_kurir');
  const startCash = state.rupiah;

  for (let i = 0; i < NUSANTARA_PACKAGES.length - 1; i++) {
    const res = collectNusantaraPackage(state, NUSANTARA_PACKAGES[i].id);
    assert.equal(res.collected, true);
    assert.equal(res.allCompleted, false);
    assert.equal(res.rewardRp, NUSANTARA_PACKAGE_REWARD_RP);
    state = res.nextState;
  }

  // Duplicate collection is ignored
  const dup = collectNusantaraPackage(state, NUSANTARA_PACKAGES[0].id);
  assert.equal(dup.collected, false);

  // 10th package triggers grand bonus
  const finalRes = collectNusantaraPackage(
    state,
    NUSANTARA_PACKAGES[NUSANTARA_PACKAGES.length - 1].id
  );
  assert.equal(finalRes.collected, true);
  assert.equal(finalRes.allCompleted, true);
  assert.equal(
    finalRes.rewardRp,
    NUSANTARA_PACKAGE_REWARD_RP + NUSANTARA_ALL_PACKAGES_BONUS_RP
  );
  assert.equal(
    finalRes.nextState.rupiah,
    startCash + 10 * NUSANTARA_PACKAGE_REWARD_RP + NUSANTARA_ALL_PACKAGES_BONUS_RP
  );
});

test('Wave 3 combat takedown combo streaks and high-speed near-miss adrenaline bonuses', () => {
  const t0 = 10_000;
  const c1 = resolveCombatComboState(0, 0, t0);
  assert.equal(c1.comboCount, 1);
  assert.equal(c1.bonusRp, 0);

  const c2 = resolveCombatComboState(c1.comboCount, t0, t0 + 1800);
  assert.equal(c2.comboCount, 2);
  assert.equal(c2.tierLabel, 'KOMBO GANDA!');
  assert.equal(c2.bonusRp, 24000);

  const c5 = resolveCombatComboState(4, t0 + 2500, t0 + 4000);
  assert.equal(c5.comboCount, 5);
  assert.equal(c5.tierLabel, 'RAJA JALANAN!');
  assert.ok(c5.healGain > 0);

  // Window expiry resets streak cleanly
  const reset = resolveCombatComboState(5, t0, t0 + COMBAT_COMBO_WINDOW_MS + 500);
  assert.equal(reset.comboCount, 1);

  // Near-miss bonus triggers only at high ground speed within 2.2m..4.4m outside cooldown
  const nmSlow = computeNearMissBonus(12, 3.0, false, 0, 10_000);
  assert.equal(nmSlow.triggered, false);

  const nmAir = computeNearMissBonus(30, 3.0, true, 0, 10_000);
  assert.equal(nmAir.triggered, false);

  const nmFast = computeNearMissBonus(29, 3.1, false, 0, 10_000);
  assert.equal(nmFast.triggered, true);
  assert.equal(nmFast.rewardRp, 22000);
  assert.equal(nmFast.focusGain, 8);

  const nmCooldown = computeNearMissBonus(29, 3.1, false, 10_000, 10_000 + NEAR_MISS_COOLDOWN_MS - 200);
  assert.equal(nmCooldown.triggered, false);
});

test('GTA driving braking vs reverse, speed-sensitive steering, and Hospital Respawn preserve progress', () => {
  // Pressing reverse while moving forward engages service brakes to 0 instead of reversing immediately
  const brakeStep = stepVehicleLongitudinalSpeed(18, -1, 14, 34, false, false, 0.25);
  assert.equal(brakeStep.isBraking, true);
  assert.ok(brakeStep.speed < 18 && brakeStep.speed >= 0);

  // From standstill, pressing reverse engages reverse gear
  const revStep = stepVehicleLongitudinalSpeed(0, -1, 14, 34, false, false, 0.25);
  assert.equal(revStep.isBraking, false);
  assert.ok(revStep.speed < 0);

  // Speed-sensitive steering is sharper at low city speed than at highway top speed
  const lowSpeedTurn = computeSpeedSensitiveTurnRate(2.4, 4, 34, false, 1);
  const highSpeedTurn = computeSpeedSensitiveTurnRate(2.4, 32, 34, false, 1);
  assert.ok(lowSpeedTurn > highSpeedTurn);

  // Hospital respawn preserves weapons/missions, clears wanted, heals full HP, caps bill at 50k
  const wounded = {
    ...createInitialPlayerState('anak_jalanan'),
    hp: 0,
    rupiah: 2_000_000,
    wantedLevel: 4,
    completedMissions: ['ch1_m1', 'ch1_m2'],
  };
  const respawn = computeHospitalRespawnState(wounded);
  assert.equal(respawn.billRp, 50_000);
  assert.equal(respawn.nextState.hp, wounded.maxHp);
  assert.equal(respawn.nextState.wantedLevel, 0);
  assert.equal(respawn.nextState.rupiah, 1_950_000);
  assert.deepEqual(respawn.nextState.completedMissions, ['ch1_m1', 'ch1_m2']);
});

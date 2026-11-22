import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JAKARTA_FLOOD_ZONES,
  STUNT_RAMPS_CATALOG,
  advanceDailyChallengeProgress,
  advanceTurfWarWave,
  applyCoverDamageMitigation,
  calculateStreetRacePayout,
  claimDailyChallengeReward,
  computeEmpireEndgameSummary,
  computePlayerRacePosition,
  createDailyChallengesForDate,
  createInitialPlayerState,
  createStreetRaceSession,
  createTurfWarSession,
  cycleCameraViewMode,
  evaluateCoverAvailability,
  evaluateFloodZoneAt,
  evaluateStuntRampContact,
  getActiveWingmanIds,
  resolveSquadOrderCallout,
  scoreStuntJump,
} from './rules';

describe('Wave 2 Perfection Upgrade — Domain Systems', () => {
  it('cycles camera view mode across third_person, first_person, and cinematic', () => {
    assert.equal(cycleCameraViewMode('third_person'), 'first_person');
    assert.equal(cycleCameraViewMode('first_person'), 'cinematic');
    assert.equal(cycleCameraViewMode('cinematic'), 'third_person');
  });

  it('evaluates tactical cover near vehicles/buildings and mitigates 65% damage in cover', () => {
    const vehCover = evaluateCoverAvailability(
      10,
      10,
      [],
      [{ x: 11.8, z: 10 }]
    );
    assert.equal(vehCover.canTakeCover, true);
    assert.equal(vehCover.coverKind, 'vehicle');

    const bldgCover = evaluateCoverAvailability(
      20,
      20,
      [
        {
          id: 'test_bldg',
          name: 'Test Ruko',
          x: 25,
          z: 20,
          width: 8,
          depth: 8,
          height: 14,
          style: 'ruko',
          primaryColor: 0x334155,
          accentColor: 0x0ea5e9,
        },
      ],
      []
    );
    assert.equal(bldgCover.canTakeCover, true);
    assert.equal(bldgCover.coverKind, 'building');

    assert.equal(applyCoverDamageMitigation(20, false), 20);
    assert.equal(applyCoverDamageMitigation(20, true), 7);
  });

  it('returns active wingmen and localized squad order callouts', () => {
    assert.deepEqual(getActiveWingmanIds('nabilo'), ['raka', 'kirana']);
    assert.deepEqual(getActiveWingmanIds('raka'), ['nabilo', 'kirana']);
    assert.match(resolveSquadOrderCallout('attack', 'nabilo'), /EMP/i);
    assert.match(resolveSquadOrderCallout('hold', 'raka'), /Kirana/i);
  });

  it('evaluates 6 handcrafted Jakarta stunt ramps launch contact and scores air-time jumps', () => {
    assert.equal(STUNT_RAMPS_CATALOG.length, 6);
    const ramp = STUNT_RAMPS_CATALOG[0]; // heading 0 (+Z)
    const tipZ = ramp.z + ramp.length * 0.4;
    const contact = evaluateStuntRampContact(ramp.x, tipZ, 20, 0);
    assert.equal(contact.onRamp, true);
    assert.equal(contact.launchReady, true);
    assert.ok(contact.surfaceHeight > 2.0);

    const res = scoreStuntJump(ramp, 38, 1.85, []);
    assert.equal(res.rating, 'LEGENDARIS');
    assert.equal(res.isNewRamp, true);
    assert.ok(res.rewardRp > ramp.rewardRp);
  });

  it('activates monsoon flood zone hydroplaning only during heavy rain wetness', () => {
    assert.equal(JAKARTA_FLOOD_ZONES.length, 4);
    const zone = JAKARTA_FLOOD_ZONES[0];

    const dryRes = evaluateFloodZoneAt(zone.x, zone.z, 0.2);
    assert.equal(dryRes.inFlood, false);
    assert.equal(dryRes.hydroplaneStrength, 0);

    const rainRes = evaluateFloodZoneAt(zone.x, zone.z, 0.95);
    assert.equal(rainRes.inFlood, true);
    assert.equal(rainRes.zone?.id, zone.id);
    assert.ok(rainRes.hydroplaneStrength > 0.2);
  });

  it('tracks street race session creation, live rank against 3 AI rivals, and podium payouts', () => {
    const session = createStreetRaceSession('race_sudirman');
    assert.ok(session);
    assert.equal(session.totalRacers, 4);
    assert.equal(session.status, 'countdown');

    const rank = computePlayerRacePosition(
      2,
      session.checkpoints[2][0],
      session.checkpoints[2][1],
      session.checkpoints,
      [
        { id: 'r1', name: 'Reno', x: 0, z: 0, heading: 0, checkpointIndex: 3, finished: false, finishTimeSec: null, colorHex: 0x06b6d4 },
        { id: 'r2', name: 'Vina', x: 0, z: 0, heading: 0, checkpointIndex: 1, finished: false, finishTimeSec: null, colorHex: 0xf43f5e },
        { id: 'r3', name: 'Bima', x: 0, z: 0, heading: 0, checkpointIndex: 1, finished: false, finishTimeSec: null, colorHex: 0xf59e0b },
      ]
    );
    assert.equal(rank, 2);

    const firstPayout = calculateStreetRacePayout(250000, 1);
    const secondPayout = calculateStreetRacePayout(250000, 2);
    assert.equal(firstPayout.rewardRp, 250000);
    assert.ok(secondPayout.rewardRp < firstPayout.rewardRp);
  });

  it('progresses 3D turf war across 3 waves with Kapten Wilayah boss and computes Empire tiers', () => {
    const tw1 = createTurfWarSession('kemayoran');
    assert.ok(tw1);
    assert.equal(tw1.wave, 1);
    assert.equal(tw1.captainAlive, false);

    const step2 = advanceTurfWarWave(tw1);
    assert.equal(step2.spawnedNewWave, true);
    assert.equal(step2.next.wave, 2);

    const step3 = advanceTurfWarWave(step2.next);
    assert.equal(step3.spawnedNewWave, true);
    assert.equal(step3.next.wave, 3);
    assert.equal(step3.next.captainAlive, true);

    const win = advanceTurfWarWave(step3.next);
    assert.equal(win.victory, true);
    assert.equal(win.next.status, 'victory');

    const basePlayer = createInitialPlayerState('mantan_kurir');
    const summary1 = computeEmpireEndgameSummary(basePlayer, 0);
    assert.equal(summary1.tier, 1);

    // Simulate owning 11 districts and completing 2 grand heists -> Tier 4
    const turfKeys = Object.keys(basePlayer.districtTurf);
    for (let i = 0; i < Math.min(11, turfKeys.length); i++) {
      basePlayer.districtTurf[turfKeys[i]] = {
        ...basePlayer.districtTurf[turfKeys[i]],
        owner: 'player',
      };
    }
    basePlayer.completedHeists = ['heist_bank_sentral', 'heist_kargo_priok'];
    const summary4 = computeEmpireEndgameSummary(basePlayer, 6);
    assert.equal(summary4.tier, 4);
    assert.equal(summary4.tierTitle, 'Penguasa Mutlak Jakarta');
  });

  it('generates 3 deterministic daily challenges, advances progress, and applies streak reward multiplier', () => {
    const dc = createDailyChallengesForDate('2026-11-20', 3);
    assert.equal(dc.items.length, 3);
    assert.equal(dc.streakDays, 3);

    const first = dc.items[0];
    const adv = advanceDailyChallengeProgress(dc, first.kind, first.target);
    assert.equal(adv.justCompletedTitle, first.title);
    assert.equal(adv.next.items[0].progress, first.target);

    const claimed = claimDailyChallengeReward(adv.next, first.id);
    assert.equal(claimed.claimed, true);
    // Streak day 3 = +20% bonus
    assert.equal(claimed.rewardRp, Math.round(first.rewardRp * 1.2));
    assert.equal(claimed.next.items[0].claimed, true);

    // Double-claim prevented
    const duplicate = claimDailyChallengeReward(claimed.next, first.id);
    assert.equal(duplicate.claimed, false);
  });
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TRAFFIC_ROUTES,
  WORLD_MAX_BOUND,
  createCustomRaceTrackSpec,
  createInitialPlayerState,
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

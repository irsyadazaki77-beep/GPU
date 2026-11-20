import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createApiApp } from '../server';
import { createInitialPlayerState } from '../src/game/rules';
import {
  DEFAULT_AUDIO_VOLUMES,
  DEFAULT_GAME_SETTINGS,
  type SavedGameSnapshot,
} from '../src/game/save';
import {
  CloudSaveStore,
  LEGACY_MIGRATION_PLAYER_TOKEN,
  parseSlotIdParam,
  validatePlayerToken,
  validateStrictSaveSchemaV3,
} from './cloudSave';

function buildValidSaveV3(rupiah: number = 1_500_000): SavedGameSnapshot {
  const playerState = createInitialPlayerState('anak_jalanan');
  playerState.rupiah = rupiah;
  playerState.completedMissions = ['m1_monas_couriers', 'm2_tanah_abang_turf'];
  return {
    version: 3,
    origin: 'anak_jalanan',
    selectedStage: 5,
    weatherMode: 'senja',
    playerState,
    playerPos: { x: 14, z: -22 },
    audioSettings: { ...DEFAULT_AUDIO_VOLUMES },
    gameSettings: { ...DEFAULT_GAME_SETTINGS },
    completedDynamicQuests: ['dq_monas_1'],
    savedAt: 1730000000000,
  };
}

test('CloudSaveStore: SQLite WAL mode round-trip, player isolation, concurrent writes, and legacy JSON migration', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-nabilo-sqlite-'));
  const dbPath = path.join(tmpDir, 'san_nabilo.db');
  const legacyPath = path.join(tmpDir, 'cloud_saves_v3.json');

  try {
    // 1. Seed a legacy flat-file JSON to verify automatic one-time migration
    const legacySnapshot = buildValidSaveV3(888_000);
    fs.writeFileSync(
      legacyPath,
      JSON.stringify({ '1': legacySnapshot }, null, 2),
      'utf-8'
    );

    const store = new CloudSaveStore({ dbPath, legacyJsonPath: legacyPath });
    assert.equal(store.isReady(), true);

    // Verify legacy slot 1 was automatically migrated into SQLite
    const migratedSlot1 = store.getSlot('1', LEGACY_MIGRATION_PLAYER_TOKEN);
    assert.ok(migratedSlot1);
    assert.equal(migratedSlot1.playerState.rupiah, 888_000);

    // 2. Player isolation: Player A and Player B writing to slot 1 do not overwrite each other
    const tokenA = 'plr_alpha_session_12345';
    const tokenB = 'plr_bravo_session_67890';

    const savedA = store.putSlot('1', buildValidSaveV3(2_100_000), tokenA);
    const savedB = store.putSlot('1', buildValidSaveV3(4_750_000), tokenB);
    assert.ok(savedA);
    assert.ok(savedB);

    const readA = store.getSlot('1', tokenA);
    const readB = store.getSlot('1', tokenB);
    assert.equal(readA?.playerState.rupiah, 2_100_000);
    assert.equal(readB?.playerState.rupiah, 4_750_000);
    assert.equal(store.getSlot('2', tokenA), null);

    // 3. Concurrent writes across 25 parallel promises on the same and distinct slots
    const writes = Array.from({ length: 25 }, (_, idx) =>
      Promise.resolve().then(() => {
        const slot = `slot_${(idx % 3) + 1}`;
        const amount = 100_000 + idx * 10_000;
        return store.putSlot(slot, buildValidSaveV3(amount), tokenA);
      })
    );
    const results = await Promise.all(writes);
    assert.equal(results.every(Boolean), true);

    const finalSlot1 = store.getSlot('slot_1', tokenA);
    assert.ok(finalSlot1);
    assert.equal(finalSlot1.version, 3);
    // Index 24 writes to slot_1: 100_000 + 24 * 10_000 = 340_000
    assert.equal(finalSlot1.playerState.rupiah, 340_000);

    store.close();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('Strict validation rejects invalid slotId, missing/short playerToken, and malformed Save Schema v3 payloads', () => {
  assert.equal(parseSlotIdParam('1'), '1');
  assert.equal(parseSlotIdParam('slot_alpha-09'), 'slot_alpha-09');
  assert.equal(parseSlotIdParam(''), null);
  assert.equal(parseSlotIdParam('../etc/passwd'), null);
  assert.equal(parseSlotIdParam('bad slot!'), null);
  assert.equal(parseSlotIdParam('x'.repeat(33)), null);

  assert.equal(validatePlayerToken('plr_valid_token_12345'), 'plr_valid_token_12345');
  assert.equal(validatePlayerToken('short'), null);
  assert.equal(validatePlayerToken('bad token spaces'), null);
  assert.equal(validatePlayerToken(undefined), null);

  // Version mismatch (version: 2 instead of 3)
  const v2Payload = { ...buildValidSaveV3(), version: 2 };
  const v2Check = validateStrictSaveSchemaV3(v2Payload);
  assert.equal(v2Check.valid, false);

  // Oversized completedMissions array (> 64 items)
  const oversizedMissions = buildValidSaveV3();
  oversizedMissions.playerState.completedMissions = Array.from(
    { length: 70 },
    (_, i) => `m_${i}`
  );
  assert.equal(validateStrictSaveSchemaV3(oversizedMissions).valid, false);

  // Valid v3 payload passes
  const validCheck = validateStrictSaveSchemaV3(buildValidSaveV3(950_000));
  assert.equal(validCheck.valid, true);
});

test('HTTP /api/saves/:slotId and /api/readyz enforce token auth, slotId regex, and schema v3 validation', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'san-nabilo-api-'));
  const dbPath = path.join(tmpDir, 'api_test.db');
  const store = new CloudSaveStore({ dbPath, legacyJsonPath: null });
  const app = createApiApp({ cloudSaveStore: store });
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. /api/health & /api/readyz
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = (await healthRes.json()) as { status: string; version: string };
    assert.equal(healthJson.status, 'ok');
    assert.equal(healthJson.version, '0.3.0');

    const readyRes = await fetch(`${baseUrl}/api/readyz`);
    assert.equal(readyRes.status, 200);
    const readyJson = (await readyRes.json()) as {
      status: string;
      checks: { sqlite: string };
    };
    assert.equal(readyJson.status, 'ready');
    assert.equal(readyJson.checks.sqlite, 'ok');

    // 2. Missing X-Player-Token -> 401
    const noTokenRes = await fetch(`${baseUrl}/api/saves/1`);
    assert.equal(noTokenRes.status, 401);

    // 3. Invalid slotId -> 400
    const badSlotRes = await fetch(`${baseUrl}/api/saves/invalid$slot!`, {
      headers: { 'X-Player-Token': 'plr_test_token_9999' },
    });
    assert.equal(badSlotRes.status, 400);

    // 4. Invalid Save Schema v3 body -> 400
    const badBodyRes = await fetch(`${baseUrl}/api/saves/1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': 'plr_test_token_9999',
      },
      body: JSON.stringify({ version: 2, origin: 'anak_jalanan' }),
    });
    assert.equal(badBodyRes.status, 400);

    // 5. Valid POST + GET round-trip
    const validSave = buildValidSaveV3(3_300_000);
    const postRes = await fetch(`${baseUrl}/api/saves/1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': 'plr_test_token_9999',
      },
      body: JSON.stringify(validSave),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${baseUrl}/api/saves/1`, {
      headers: { 'X-Player-Token': 'plr_test_token_9999' },
    });
    assert.equal(getRes.status, 200);
    const getData = (await getRes.json()) as {
      exists: boolean;
      snapshot: SavedGameSnapshot;
    };
    assert.equal(getData.exists, true);
    assert.equal(getData.snapshot.playerState.rupiah, 3_300_000);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

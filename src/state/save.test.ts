import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialPlayerState } from '../game/rules';
import {
  DEFAULT_AUDIO_VOLUMES,
  DEFAULT_GAME_SETTINGS,
  SAVE_VERSION,
  clearSavedGame,
  exportSavedGameJson,
  getActiveSaveSlot,
  listSaveSlotSummaries,
  loadSavedGame,
  migrateSavedGame,
  parseImportedSaveJson,
  saveGameSnapshot,
  setActiveSaveSlot,
  type SavedGameSnapshot,
} from '../game/save';

function installMockLocalStorage(): Map<string, string> {
  const store = new Map<string, string>();
  const mockStorage: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: mockStorage },
    configurable: true,
    writable: true,
  });

  return store;
}

test('Save Schema v1 and v2 snapshots migrate cleanly to Save Schema v3', () => {
  const basePlayer = createInitialPlayerState('teknisi_glodok');

  const legacyV1Raw = {
    version: 1,
    origin: 'teknisi_glodok',
    selectedStage: 3,
    weatherMode: 'malam',
    playerState: {
      ...basePlayer,
      rupiah: 920000,
      completedMissions: ['m1_monas_couriers', 'm2_tanah_abang_turf'],
    },
    playerPos: { x: 145, z: -210 }, // out-of-bounds, should clamp to [-88, 88]
    savedAt: 1700000000000,
  };

  const migratedFromV1 = migrateSavedGame(legacyV1Raw);
  assert.ok(migratedFromV1, 'Expected v1 snapshot to migrate');
  assert.equal(migratedFromV1.version, SAVE_VERSION);
  assert.equal(migratedFromV1.origin, 'teknisi_glodok');
  assert.equal(migratedFromV1.selectedStage, 3);
  assert.equal(migratedFromV1.weatherMode, 'malam');
  assert.equal(migratedFromV1.playerState.rupiah, 920000);
  assert.equal(migratedFromV1.playerPos.x, 88);
  assert.equal(migratedFromV1.playerPos.z, -88);
  assert.deepEqual(migratedFromV1.audioSettings, DEFAULT_AUDIO_VOLUMES);
  assert.deepEqual(migratedFromV1.gameSettings, DEFAULT_GAME_SETTINGS);

  const legacyV2Raw = {
    version: 2,
    origin: 'mantan_kurir',
    selectedStage: 4,
    weatherMode: 'hujan',
    playerState: {
      ...createInitialPlayerState('mantan_kurir'),
      rupiah: 1450000,
    },
    playerPos: { x: -24, z: 32 },
    audioSettings: { master: 0.8, sfx: 0.9, radio: 0.6, ambience: 0.75 },
    completedDynamicQuests: ['dq_scbd_01'],
    savedAt: 1710000000000,
  };

  const migratedFromV2 = migrateSavedGame(legacyV2Raw);
  assert.ok(migratedFromV2, 'Expected v2 snapshot to migrate');
  assert.equal(migratedFromV2.version, 3);
  assert.equal(migratedFromV2.origin, 'mantan_kurir');
  assert.equal(migratedFromV2.audioSettings.radio, 0.6);
  assert.deepEqual(migratedFromV2.completedDynamicQuests, ['dq_scbd_01']);
  assert.ok(migratedFromV2.playerState.characterSkills);
  assert.ok(migratedFromV2.playerState.districtTurf);
});

test('Multi-slot management (Slots 1-3) and JSON export/import preserve full Save Schema v3 integrity', () => {
  installMockLocalStorage();

  setActiveSaveSlot(2);
  assert.equal(getActiveSaveSlot(), 2);

  const pState = createInitialPlayerState('anak_jalanan');
  pState.rupiah = 2750000;
  pState.completedMissions = ['m1', 'm2', 'm3', 'm4'];

  const snapshotSlot2: SavedGameSnapshot = {
    version: 3,
    origin: 'anak_jalanan',
    selectedStage: 5,
    weatherMode: 'senja',
    playerState: pState,
    playerPos: { x: -12, z: 28 },
    audioSettings: { master: 0.95, sfx: 0.85, radio: 0.7, ambience: 0.8 },
    gameSettings: {
      graphicsTier: 'ultra',
      voiceActingEnabled: true,
      cinematicCameraEnabled: true,
      touchControlsMode: 'auto',
    },
    completedDynamicQuests: ['dq_glodok_99'],
    savedAt: 1720000000000,
  };

  saveGameSnapshot(snapshotSlot2, 2);

  const summaries = listSaveSlotSummaries();
  assert.equal(summaries.length, 3);
  assert.equal(summaries[0].exists, false);
  assert.equal(summaries[1].exists, true);
  assert.equal(summaries[1].rupiah, 2750000);
  assert.equal(summaries[1].completedMissionsCount, 4);

  const exportedJson = exportSavedGameJson(2);
  assert.ok(exportedJson.includes('"version": 3'));

  const imported = parseImportedSaveJson(exportedJson);
  assert.ok(imported);
  assert.equal(imported.version, 3);
  assert.equal(imported.playerState.rupiah, 2750000);
  assert.equal(imported.gameSettings.graphicsTier, 'ultra');
  assert.deepEqual(imported.completedDynamicQuests, ['dq_glodok_99']);

  clearSavedGame(2);
  assert.equal(loadSavedGame(2), null);
});

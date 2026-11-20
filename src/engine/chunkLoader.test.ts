import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DEFAULT_CHUNK_SIZE_M,
  JAKARTA_EXPANSION_ZONES,
  SpatialChunkLoader,
  chunkCoordToWorldCenter,
  computeChunkDiff,
  getChunkKey,
  getChunksWithinRadius,
  isInJakartaBayWaterZone,
  parseChunkKey,
  worldToChunkCoord,
} from './chunkLoader';
import { CITY_BUILDINGS } from '../game/world/bounds';

test('worldToChunkCoord and getChunkKey hash 250m x 250m spatial coordinates deterministically', () => {
  const c0 = worldToChunkCoord(0, 0, DEFAULT_CHUNK_SIZE_M);
  assert.deepEqual(c0, { chunkX: 0, chunkZ: 0 });
  assert.equal(getChunkKey(c0.chunkX, c0.chunkZ), '0,0');

  const northEast = worldToChunkCoord(210, -240, DEFAULT_CHUNK_SIZE_M);
  assert.deepEqual(northEast, { chunkX: 1, chunkZ: -1 });
  assert.equal(getChunkKey(northEast.chunkX, northEast.chunkZ), '1,-1');

  const parsed = parseChunkKey('1,-1');
  assert.deepEqual(parsed, { chunkX: 1, chunkZ: -1 });
  assert.equal(parseChunkKey('invalid_key'), null);

  const center = chunkCoordToWorldCenter(2, -1, 250);
  assert.deepEqual(center, { x: 500, z: -250 });
});

test('getChunksWithinRadius enumerates nearest-first Chebyshev ring chunks and computeChunkDiff calculates load/unload sets', () => {
  const ring1 = getChunksWithinRadius(0, 0, 1, 250);
  assert.equal(ring1.length, 9);
  assert.equal(ring1[0].key, '0,0');
  assert.equal(ring1[0].ringDistance, 0);

  const ring2 = getChunksWithinRadius(260, 0, 1, 250);
  const diff = computeChunkDiff(
    ring1.map((c) => c.key),
    ring2.map((c) => c.key)
  );
  assert.equal(diff.toLoad.length, 3);
  assert.equal(diff.toUnload.length, 3);
  assert.equal(diff.retained.length, 6);
  assert.equal(diff.toLoad.includes('2,0'), true);
  assert.equal(diff.toUnload.includes('-1,0'), true);
});

test('SpatialChunkLoader streams chunks within budget, assigns inner/outer LOD tiers, and disposes colliders on unload', () => {
  const scene = new THREE.Scene();
  const activeColliders = new Set<string>();

  const loader = new SpatialChunkLoader(scene, CITY_BUILDINGS, {
    chunkSize: 250,
    activeRadiusChunks: 1,
    maxOpsPerFrame: 3,
    physicsBridge: {
      registerChunkStaticBox: (id) => {
        activeColliders.add(id);
      },
      unregisterChunkStaticBox: (id) => {
        activeColliders.delete(id);
      },
    },
  });

  // Step 1: frame-budgeted load (max 3 chunks per frame)
  const step1 = loader.updateAroundPlayer(0, 0, false);
  assert.equal(step1.loadedThisStep.length, 3);
  assert.equal(step1.loadedThisStep[0], '0,0');

  // Step 2: force immediate completion of remaining ring chunks
  loader.updateAroundPlayer(0, 0, true);
  assert.equal(loader.getLoadedChunkCount(), 9);
  assert.equal(loader.getChunkRecord('0,0')?.lodRing, 'inner');
  assert.equal(loader.getChunkRecord('0,0')?.lodTier, 'LOD0');
  assert.equal(loader.getChunkRecord('1,1')?.lodRing, 'outer');
  assert.equal(loader.getChunkRecord('1,1')?.lodTier, 'LOD2');
  assert.equal(activeColliders.size > 0, true);

  // Move player far away so chunk 0,0 unloads and releases its static colliders
  loader.updateAroundPlayer(1000, 1000, true);
  assert.equal(loader.getChunkRecord('0,0'), undefined);
  assert.equal(activeColliders.size, 0);

  loader.dispose();
  assert.equal(loader.getLoadedChunkCount(), 0);
});

test('Expansion zones and Jakarta Bay water detection cover Tanjung Priok, Semanggi Tollway, and Kepulauan Seribu', () => {
  assert.equal(JAKARTA_EXPANSION_ZONES.length, 3);
  assert.equal(isInJakartaBayWaterZone(0, -80), true);
  assert.equal(isInJakartaBayWaterZone(-76, 62), true);
  assert.equal(isInJakartaBayWaterZone(0, 0), false);
});

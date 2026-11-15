import test from 'node:test';
import assert from 'node:assert/strict';
import { CITY_BUILDINGS, WORLD_MAX_BOUND } from './bounds';
import {
  SpatialHashGrid,
  createBuildingSpatialGrid,
  hash2D,
  isNearBuilding,
  isOnRoadway,
  resolveCircleAABBCollision,
} from './spatial';

test('hash2D returns deterministic normalized numbers in [0, 1)', () => {
  const a1 = hash2D(12.5, -44.2);
  const a2 = hash2D(12.5, -44.2);
  const b = hash2D(13.1, -44.2);

  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.equal(a1 >= 0 && a1 < 1, true);
  assert.equal(b >= 0 && b < 1, true);
});

test('isNearBuilding and isOnRoadway classify Jakarta geometry accurately', () => {
  const firstBldg = CITY_BUILDINGS[0];
  assert.equal(isNearBuilding(firstBldg.x, firstBldg.z, 2), true);
  assert.equal(isNearBuilding(0, 26, 1), false);

  assert.equal(isOnRoadway(0, 26), true);
  assert.equal(isOnRoadway(-32, 10), true);
  assert.equal(isOnRoadway(75, 75), false);
});

test('SpatialHashGrid insert, queryAABB, queryRadius, nearest, and clear operate in O(1) buckets', () => {
  const grid = new SpatialHashGrid<string>(16);
  grid.insert('monas', 0, 0, 4, 4, 'Monas');
  grid.insert('blokm', 8, 60, 5, 5, 'Blok M');
  grid.insert('scbd', -62, -56, 6, 6, 'SCBD');

  assert.equal(grid.size, 3);

  const boxHits = grid.queryAABB(-6, -6, 6, 6);
  assert.deepEqual(boxHits, ['Monas']);

  const radiusHits = grid.queryRadius(10, 58, 6);
  assert.deepEqual(radiusHits, ['Blok M']);

  const closest = grid.nearest(-60, -50, 20);
  assert.ok(closest);
  assert.equal(closest.item, 'SCBD');
  assert.equal(closest.distance < 10, true);

  assert.equal(grid.nearest(0, 30, 5), null);

  grid.clear();
  assert.equal(grid.size, 0);
  assert.deepEqual(grid.queryAABB(-100, -100, 100, 100), []);
});

test('createBuildingSpatialGrid and resolveCircleAABBCollision match linear collision and clamp world perimeter', () => {
  const grid = createBuildingSpatialGrid(CITY_BUILDINGS, 18);
  assert.equal(grid.size, CITY_BUILDINGS.length);

  const testBldg = CITY_BUILDINGS[0];
  const withGrid = resolveCircleAABBCollision(
    testBldg.x,
    testBldg.z,
    1.2,
    undefined,
    grid
  );
  const linear = resolveCircleAABBCollision(
    testBldg.x,
    testBldg.z,
    1.2,
    CITY_BUILDINGS
  );

  assert.equal(withGrid.collided, true);
  assert.equal(withGrid.x, linear.x);
  assert.equal(withGrid.z, linear.z);

  const outOfBounds = resolveCircleAABBCollision(
    WORLD_MAX_BOUND + 20,
    -WORLD_MAX_BOUND - 15,
    1.0,
    undefined,
    grid
  );
  assert.equal(outOfBounds.collided, true);
  assert.equal(outOfBounds.x <= WORLD_MAX_BOUND, true);
  assert.equal(outOfBounds.z >= -WORLD_MAX_BOUND, true);
});

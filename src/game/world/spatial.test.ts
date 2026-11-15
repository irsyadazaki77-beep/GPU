import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAFFIC_ROUTES, stepTrafficVehicleAI } from '../racing';
import { CITY_BUILDINGS, WORLD_MAX_BOUND } from './bounds';
import {
  SpatialHashGrid,
  createBuildingSpatialGrid,
  hash2D,
  isNearBuilding,
  isOnRoadway,
  resolveCameraWallPullIn,
  resolveCircleAABBCollision,
  stepSidewalkPatrol,
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

test('resolveCameraWallPullIn pulls camera boom in front of obstructing buildings and leaves clear rays untouched', () => {
  const grid = createBuildingSpatialGrid(CITY_BUILDINGS, 18);

  // Clear open avenue behind player at (0, 26)
  const clearCam = resolveCameraWallPullIn(0, 26, 0, 4.5, 35.4, grid);
  assert.equal(clearCam.pulledIn, false);
  assert.equal(clearCam.x, 0);
  assert.equal(clearCam.z, 35.4);

  // Obstructed boom reaching behind Wisma Nabilo (-22, -42, width 12, depth 12)
  const blockedCam = resolveCameraWallPullIn(-12, -42, -26, 4.5, -42, grid);
  assert.equal(blockedCam.pulledIn, true);
  assert.equal(blockedCam.x > -16.5, true);
  assert.equal(blockedCam.y >= 4.5, true);
});

test('stepSidewalkPatrol constrains pedestrians inside assigned sidewalk bounds and reverses at curb ends', () => {
  const stepFwd = stepSidewalkPatrol(9.2, 23.8, 1, 2.0, 0.5, 7.05, 11.35, 19, 25, 'ns', 0.5);
  assert.equal(stepFwd.x >= 7.55 && stepFwd.x <= 10.85, true);
  assert.equal(stepFwd.z <= 24.5, true);
  assert.equal(stepFwd.dir, -1);

  const stepClamp = stepSidewalkPatrol(5.0, 22.0, 1, 1.5, 0.2, 7.05, 11.35, 19, 25, 'ew', 0.5);
  assert.equal(stepClamp.x >= 7.55 && stepClamp.x <= 10.85, true);
});

test('stepTrafficVehicleAI uses provided buildingGrid to keep ground AI vehicles out of buildings', () => {
  const grid = createBuildingSpatialGrid(CITY_BUILDINGS, 18);
  const bldg = CITY_BUILDINGS[1];
  const next = stepTrafficVehicleAI(
    {
      vehicleType: 'sedan',
      x: bldg.x - bldg.width * 0.5 - 0.5,
      z: bldg.z,
      heading: Math.PI / 2,
      speed: 10,
      waypointIndex: 0,
      stopTimer: 0,
      preferredSpeed: 12,
      layer: 'ground',
    },
    TRAFFIC_ROUTES.ring_clockwise,
    30,
    0.1,
    { buildingGrid: grid }
  );

  assert.equal(next.x <= bldg.x - bldg.width * 0.5, true);
});

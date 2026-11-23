import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAFFIC_ROUTES,
  generateRoadsideSpawnLayout,
  stepTrafficVehicleAI,
} from '../racing';
import { ENTERABLE_INTERIORS } from '../heists';
import { STORY_MISSIONS } from '../missionsData';
import { STUNT_RAMPS_CATALOG } from '../wave2Systems';
import { MRT_TRACK_X } from '../grandPlan5Systems';
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
import {
  findRoadNavRoute,
  getRoadNavNodes,
  getRoadNavSegments,
  isRoadNavRouteValid,
} from './roadNavGraph';

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
  assert.equal(isOnRoadway(58, 58), false);
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

  // Obstructed boom reaching behind Wisma Nabilo (-20.5, 56, width 10, depth 13)
  const blockedCam = resolveCameraWallPullIn(-10, 56, -26, 4.5, 56, grid);
  assert.equal(blockedCam.pulledIn, true);
  assert.equal(blockedCam.x > -15.6, true);
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

test('city layout keeps buildings clear of roads & MRT viaduct, and keeps portals/ramps/haltes/signs unobstructed', () => {
  for (const b of CITY_BUILDINGS) {
    if (b.id !== 'monas_monument') {
      for (const sx of [-1, 0, 1]) {
        for (const sz of [-1, 0, 1]) {
          const px = b.x + sx * (b.width * 0.48);
          const pz = b.z + sz * (b.depth * 0.48);
          assert.equal(
            isOnRoadway(px, pz),
            false,
            `Building ${b.id} overlaps roadway at (${px}, ${pz})`
          );
        }
      }
      if (b.z + b.depth * 0.5 >= -20 && b.z - b.depth * 0.5 <= 125) {
        assert.equal(
          Math.abs(b.x - MRT_TRACK_X) >= b.width * 0.5 + 1.4,
          true,
          `Building ${b.id} intersects MRT viaduct at x=${MRT_TRACK_X}`
        );
      }
    }
  }

  for (const p of ENTERABLE_INTERIORS) {
    assert.equal(isOnRoadway(p.portalX, p.portalZ), false, `Portal ${p.id} is on roadway`);
    for (const b of CITY_BUILDINGS) {
      const inside =
        Math.abs(p.portalX - b.x) < b.width * 0.5 + 0.5 &&
        Math.abs(p.portalZ - b.z) < b.depth * 0.5 + 0.5;
      assert.equal(inside, false, `Portal ${p.id} is inside building ${b.id}`);
    }
  }

  for (const r of STUNT_RAMPS_CATALOG) {
    for (const b of CITY_BUILDINGS) {
      const hits =
        Math.abs(r.x - b.x) < b.width * 0.5 + 2.0 &&
        Math.abs(r.z - b.z) < b.depth * 0.5 + 2.0;
      assert.equal(hits, false, `Ramp ${r.id} hits building ${b.id}`);
    }
  }

  for (const m of STORY_MISSIONS) {
    assert.ok(m.markerZ > -72, `Mission ${m.id} marker is in water`);
    for (const b of CITY_BUILDINGS) {
      const inside =
        Math.abs(m.markerX - b.x) < b.width * 0.5 &&
        Math.abs(m.markerZ - b.z) < b.depth * 0.5;
      assert.equal(inside, false, `Mission ${m.id} marker is inside ${b.id}`);
    }
  }

  const layout = generateRoadsideSpawnLayout();
  for (const h of layout.transJakartaHaltes) {
    assert.ok(h.z > -72, `Halte ${h.id} is in Jakarta Bay water`);
  }
  for (const s of layout.trafficSigns) {
    assert.equal(isOnRoadway(s.x, s.z), false, `Traffic sign ${s.id} is on roadway`);
  }
});

test('findRoadNavRoute computes A* road routes that stay on asphalt roadways and bypass buildings and Monas', () => {
  const nodes = getRoadNavNodes();
  const segments = getRoadNavSegments();
  assert.ok(nodes.length >= 60, 'Road network graph covers all major Jakarta intersections');
  assert.ok(segments.length >= 100, 'Road network graph connects N-S and E-W corridors');

  // 1. Thamrin (0, 20) to Kuningan Rasuna Said (84, 56) requires a left turn at Bundaran HI (0, 32)
  const thamrinToKuningan = findRoadNavRoute(0, 20, 84, 56);
  assert.ok(thamrinToKuningan.points.length >= 3);
  assert.equal(isRoadNavRouteValid(thamrinToKuningan), true);
  assert.ok(thamrinToKuningan.totalDistanceM >= 110);
  assert.equal(thamrinToKuningan.nextTurnDirection, 'left');
  assert.ok(thamrinToKuningan.turnInstruction.includes('Belok Kiri'));

  // 2. North Harmoni (0, -40) to South Sudirman (0, 60) routes cleanly around Monas Monument at (0, 0)
  const harmoniToSudirman = findRoadNavRoute(0, -40, 0, 60);
  assert.equal(isRoadNavRouteValid(harmoniToSudirman), true);
  for (const pt of harmoniToSudirman.points) {
    // Must never pass directly through (0, 0) inside Monas Monument (11x11m footprint)
    const insideMonas = Math.abs(pt.x) < 5.5 && Math.abs(pt.z) < 5.5;
    assert.equal(insideMonas, false, `Point (${pt.x}, ${pt.z}) entered Monas footprint`);
  }

  // 3. Nearby arrival threshold (< 8.5m) reports 'arrived'
  const arrivedRoute = findRoadNavRoute(0, 32, 0, 36);
  assert.equal(arrivedRoute.nextTurnDirection, 'arrived');
  assert.equal(arrivedRoute.turnInstruction, 'Tiba di Destinasi');
});


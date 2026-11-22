import assert from 'node:assert/strict';
import test from 'node:test';
import {
  JAKARTA_FLOOD_ZONES,
  JakartaPhysicsWorld,
  computeDriftAndSuspensionStep,
  computeWaterBuoyancyStep,
  evaluateFloodZoneHydroplaning,
} from './physicsWorld';

test('evaluateFloodZoneHydroplaning triggers only during monsoon rain within low-lying basins', () => {
  const zone = JAKARTA_FLOOD_ZONES[0];
  const dry = evaluateFloodZoneHydroplaning(zone.x, zone.z, 'siang', 14, 0);
  assert.equal(dry.inFloodZone, false);
  assert.equal(dry.lateralFrictionMultiplier, 1);

  const flooded = evaluateFloodZoneHydroplaning(zone.x, zone.z, 'hujan', 14, 0);
  assert.equal(flooded.inFloodZone, true);
  assert.ok(flooded.lateralFrictionMultiplier < 0.6);
  assert.ok(flooded.splashIntensity > 0.5);

  const airborne = evaluateFloodZoneHydroplaning(zone.x, zone.z, 'hujan', 20, 4.5);
  assert.equal(airborne.inFloodZone, false);
});

test('computeWaterBuoyancyStep produces upward heave and wave oscillation in Jakarta Bay', () => {
  const boatWave = computeWaterBuoyancyStep(0, 0.2, -120, 0, 12, 0.016, 1500);
  assert.equal(boatWave.inWater, true);
  assert.ok(Math.abs(boatWave.nextY - 0.2) > 0);
});

test('computeDriftAndSuspensionStep increases body roll under lateral cornering and hydroplaning', () => {
  const straight = computeDriftAndSuspensionStep(15, 15, 0, false, 0, 0, 0.016, 1);
  const cornering = computeDriftAndSuspensionStep(15, 15, 1, true, 0, 0, 0.016, 0.4);
  assert.ok(Math.abs(cornering.rollAngle) > Math.abs(straight.rollAngle));
});

test('JakartaPhysicsWorld resolves pairwise vehicle impact momentum cleanly without NaN', () => {
  const world = new JakartaPhysicsWorld([]);
  const vehicles = [
    {
      id: 'veh_player',
      type: 'sedan' as const,
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      speed: 14,
      isDrifting: false,
      pitchAngle: 0,
      rollAngle: 0,
    },
    {
      id: 'veh_traffic',
      type: 'transjakarta' as const,
      x: 0,
      y: 0,
      z: 1.5,
      heading: Math.PI,
      speed: 8,
      isDrifting: false,
      pitchAngle: 0,
      rollAngle: 0,
    },
  ];

  const step = world.stepFixed(0.016, vehicles, 'veh_player', 0, 'hujan');
  assert.ok(step.playerCollisionImpact > 0);
  assert.ok(Number.isFinite(vehicles[0].x) && Number.isFinite(vehicles[0].z));
  assert.ok(vehicles[0].z < vehicles[1].z);

  world.spawnExplosionDebris(5, 1.5, 5, 3);
  assert.equal(world.getDynamicDebrisCount(), 3);
  world.stepFixed(0.05, vehicles, 'veh_player', 0, 'siang');
  assert.equal(world.getDynamicDebrisCount(), 3);

  world.dispose();
});

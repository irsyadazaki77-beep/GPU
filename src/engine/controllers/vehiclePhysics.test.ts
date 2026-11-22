import assert from 'node:assert/strict';
import test from 'node:test';
import { JAKARTA_FLOOD_ZONES } from '../../game/rules';
import { stepDrivenVehicleKinematics } from './vehiclePhysics';

test('stepDrivenVehicleKinematics accelerates, drifts, hydroplanes in monsoon basins, and clamps aircraft altitude', () => {
  const accel = stepDrivenVehicleKinematics({
    x: 0,
    y: 0,
    z: 0,
    speed: 0,
    heading: 0,
    driftAngle: 0,
    moveForward: 1,
    moveTurn: 0,
    handbrakeHeld: false,
    climbDir: 0,
    maxSpeed: 32,
    acceleration: 18,
    turnRate: 2.2,
    steeringPull: 0,
    isAircraft: false,
    isExploded: false,
    isAirborne: false,
    wetnessFactor: 0,
    wetGripMult: 1,
    nowMs: 1000,
    dt: 0.016,
  });
  assert.ok(accel.nextSpeed > 0);
  assert.equal(accel.isDrifting, false);

  const floodZone = JAKARTA_FLOOD_ZONES[0];
  const floodDrift = stepDrivenVehicleKinematics({
    x: floodZone.x,
    y: 0,
    z: floodZone.z,
    speed: 18,
    heading: 0,
    driftAngle: 0,
    moveForward: 1,
    moveTurn: 1,
    handbrakeHeld: true,
    climbDir: 0,
    maxSpeed: 32,
    acceleration: 18,
    turnRate: 2.2,
    steeringPull: 0,
    isAircraft: false,
    isExploded: false,
    isAirborne: false,
    wetnessFactor: 1,
    wetGripMult: 1.24,
    nowMs: 1200,
    dt: 0.016,
  });
  assert.equal(floodDrift.isDrifting, true);
  assert.equal(floodDrift.inFloodSplash, true);

  const heli = stepDrivenVehicleKinematics({
    x: 0,
    y: 37.8,
    z: 0,
    speed: 12,
    heading: 0,
    driftAngle: 0,
    moveForward: 0.5,
    moveTurn: 0,
    handbrakeHeld: false,
    climbDir: 1,
    maxSpeed: 28,
    acceleration: 14,
    turnRate: 1.8,
    steeringPull: 0,
    isAircraft: true,
    isExploded: false,
    isAirborne: false,
    wetnessFactor: 0,
    wetGripMult: 1,
    nowMs: 1500,
    dt: 0.05,
  });
  assert.ok(heli.nextY <= 38);
  assert.ok(heli.nextY >= 37.8);
});

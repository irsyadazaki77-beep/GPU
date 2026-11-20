import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  HORN_REACTION_CALLOUTS,
  canTriggerHorn,
  computeChaseCameraFov,
  computeOffRoadMicroShake,
  computeStaggeredCrewPosition,
  computeTimeOfDayToneState,
  exponentialDampFactor,
  pickHornReactionCallout,
  selectNearestLightIndices,
  snapShadowCoordToTexel,
} from './visualOverhaulMath';

test('computeTimeOfDayToneState scales exposure, IBL, bloom, and night windows smoothly', () => {
  const day = computeTimeOfDayToneState(0, 0);
  const sunset = computeTimeOfDayToneState(0.58, 0.35);
  const night = computeTimeOfDayToneState(1.0, 0.2);

  assert.ok(day.exposure >= 1.05 && day.exposure <= 1.12);
  assert.ok(sunset.exposure >= 1.0 && sunset.exposure <= 1.08);
  assert.ok(night.exposure >= 0.9 && night.exposure <= 1.02);

  // IBL must remain active enough to give realistic reflections (never crushed to 0.12)
  assert.ok(day.envIntensity > 0.6);
  assert.ok(night.envIntensity >= 0.32);

  // Night bloom stronger than daylight; building windows & streetlights turn on at dusk/night
  assert.ok(night.bloomStrength > day.bloomStrength);
  assert.ok(night.windowEmissiveIntensity > 1.2);
  assert.ok(day.windowEmissiveIntensity < 0.1);
  assert.equal(day.streetlightIntensity, 0);
  assert.ok(night.streetlightIntensity > 3.0);
});

test('computeChaseCameraFov smoothly scales from 60 to 74 with speed', () => {
  assert.equal(computeChaseCameraFov(0, false, false), 60);
  assert.equal(computeChaseCameraFov(0, true, false), 60);
  assert.equal(computeChaseCameraFov(0.5, true, false), 67);
  assert.equal(computeChaseCameraFov(1.0, true, false), 74);
  assert.equal(computeChaseCameraFov(1.0, true, true), 78);
});

test('exponentialDampFactor is frame-rate independent and bounded in [0, 1]', () => {
  assert.equal(exponentialDampFactor(8, 0), 0);
  const f1 = exponentialDampFactor(8, 1 / 60);
  const f2 = exponentialDampFactor(8, 1 / 30);
  assert.ok(f1 > 0 && f1 < 1);
  assert.ok(f2 > f1 && f2 < 1);
  // Two 1/60 steps should match one 1/30 step in remaining error
  const remTwo = (1 - f1) * (1 - f1);
  const remOne = 1 - f2;
  assert.ok(Math.abs(remTwo - remOne) < 1e-9);
});

test('computeOffRoadMicroShake activates only when driving fast off paved corridors', () => {
  assert.equal(computeOffRoadMicroShake(0, 26, 20, false), 0); // On Sudirman boulevard
  assert.equal(computeOffRoadMicroShake(128, 40, 25, false), 0); // On Outer Ring highway
  assert.equal(computeOffRoadMicroShake(208, 100, 28, false), 0); // On JORR perimeter
  assert.equal(computeOffRoadMicroShake(-168, -66, 22, false), 0); // On northern coastal wing
  assert.equal(computeOffRoadMicroShake(22, 22, 3, false), 0); // Too slow
  assert.equal(computeOffRoadMicroShake(22, 22, 20, true), 0); // Aircraft exempt
  const offRoadShake = computeOffRoadMicroShake(22, 22, 20, false);
  assert.ok(offRoadShake > 0.04 && offRoadShake <= 0.085);
});

test('selectNearestLightIndices picks the K closest streetlight anchors sorted nearest-first', () => {
  const anchors = [
    { x: 50, z: 50 },
    { x: 2, z: 3 },
    { x: -1, z: 1 },
    { x: 10, z: 10 },
    { x: 0, z: -2 },
  ];
  const nearest = selectNearestLightIndices(anchors, 0, 0, 3);
  assert.deepEqual(nearest, [2, 4, 1]);
});

test('horn cooldown and Jakarta callout selection behave deterministically', () => {
  assert.equal(canTriggerHorn(1500, 1000, 800), false);
  assert.equal(canTriggerHorn(1800, 1000, 800), true);
  const phrase = pickHornReactionCallout(3);
  assert.ok(HORN_REACTION_CALLOUTS.includes(phrase));
});

test('computeStaggeredCrewPosition forms a diagonal V-escort behind player without blocking center sightline', () => {
  // Player facing North (Math.PI => forward = (0, -1), behind = +Z)
  const slots = [0, 1, 2, 3, 4].map((slot) =>
    computeStaggeredCrewPosition(0, 26, Math.PI, slot)
  );
  for (const s of slots) {
    // Strictly behind the player (+Z)
    assert.ok(s.z > 27.8, `Expected slot behind player, got z=${s.z}`);
    // Clear of center camera sightline (|x| >= 1.5m)
    assert.ok(Math.abs(s.x) >= 1.5, `Expected lateral clearance, got x=${s.x}`);
  }
  // Alternating sides and increasing depth between rows
  assert.ok(slots[0].x > 0 && slots[1].x < 0);
  assert.ok(slots[2].z > slots[0].z);
  assert.ok(slots[3].z > slots[1].z);
});

test('snapShadowCoordToTexel quantizes coordinates cleanly to shadow-map texel steps', () => {
  // Half extent 46 => frustum width 92; mapSize 920 => texel = 0.1
  assert.ok(Math.abs(snapShadowCoordToTexel(12.34, 46, 920) - 12.3) < 1e-9);
  assert.ok(Math.abs(snapShadowCoordToTexel(12.36, 46, 920) - 12.4) < 1e-9);
});

test('camera orientation maintains upright up-vector across all 360-degree lookAt azimuth angles without Euler gimbal flip', () => {
  const cam = new THREE.PerspectiveCamera();
  const upVec = new THREE.Vector3(0, 1, 0);

  // Test looking from all compass points (North, South, East, West, diagonals)
  const angles = [
    0,
    Math.PI * 0.25,
    Math.PI * 0.5,
    Math.PI * 0.75,
    Math.PI,
    Math.PI * 1.25,
    Math.PI * 1.5,
    Math.PI * 1.75,
  ];
  for (const ang of angles) {
    cam.position.set(Math.sin(ang) * 10, 3.2, Math.cos(ang) * 10);
    cam.lookAt(0, 1.7, 0);

    // Subtle cornering roll via rotateZ must maintain upright world Y
    const cornerRoll = -0.035;
    if (Math.abs(cornerRoll) > 0.0001) {
      cam.rotateZ(cornerRoll);
    }

    const worldUp = upVec.clone().applyQuaternion(cam.quaternion);
    assert.ok(
      worldUp.y > 0.6,
      `Expected upright camera for angle ${ang}, but got worldUp.y=${worldUp.y}`
    );
  }
});

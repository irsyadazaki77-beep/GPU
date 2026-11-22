export interface TimeOfDayToneState {
  exposure: number;
  envIntensity: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  windowEmissiveIntensity: number;
  streetlightIntensity: number;
}

export interface Point2D {
  x: number;
  z: number;
}

export const HORN_REACTION_CALLOUTS: readonly string[] = [
  'Woy!',
  'Minggir bang!',
  'Santai!',
  'Pelan-pelan mas!',
  'Awas bro!',
  'Sabar bos!',
];

export const HORN_COOLDOWN_MS = 800;

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Computes ACESFilmic exposure, IBL environment intensity, conservative bloom parameters,
 * night building window emissive intensity, and pooled streetlight intensity
 * from smoothly interpolated nightFactor (0 = crisp daylight, ~0.58 = golden hour, 1 = night)
 * and wetnessFactor (0 = dry, 1 = monsoon storm).
 */
export function computeTimeOfDayToneState(
  nightFactor: number,
  wetnessFactor: number
): TimeOfDayToneState {
  const n = clamp01(nightFactor);
  const w = clamp01(wetnessFactor);

  // Daylight 1.12 -> Golden Hour ~1.08 -> Night 1.02 for AgX Filmic curve
  const exposure = lerp(1.12, 1.02, n) - w * 0.04;

  // High-contrast IBL reflection strength so clearcoat supercars & glass curtain-walls mirror sky/city glow
  const envIntensity = Math.max(0.46, lerp(0.94, 0.56, n) - w * 0.04);

  // Filmic bloom: sun-kissed highlights in day/senja, rich neon/headlight halation at night
  const bloomThreshold = lerp(0.92, 0.82, n);
  const bloomStrength = lerp(0.14, 0.30, n) + w * 0.04;
  const bloomRadius = lerp(0.32, 0.44, n);

  // Office & ruko windows turn on smoothly starting at late afternoon / golden hour
  const windowRamp = clamp01((n - 0.16) / 0.60);
  const windowEmissiveIntensity = lerp(0.06, 1.55, windowRamp);

  // Pooled dynamic PointLights on nearest PJU poles ramp smoothly at dusk/night
  const streetRamp = clamp01((n - 0.20) / 0.54);
  const streetlightIntensity = lerp(0, 4.2, streetRamp);

  return {
    exposure,
    envIntensity,
    bloomStrength,
    bloomRadius,
    bloomThreshold,
    windowEmissiveIntensity,
    streetlightIntensity,
  };
}

/**
 * Frame-rate-independent exponential damping factor in [0, 1].
 */
export function exponentialDampFactor(stiffness: number, dt: number): number {
  if (dt <= 0) return 0;
  return 1 - Math.exp(-Math.max(0, stiffness) * dt);
}

/**
 * Smoothly scales third-person chase camera FOV from 60° (stationary) up to 74° (top speed),
 * with optional Fokus nitro boost up to 78°.
 */
export function computeChaseCameraFov(
  speedRatio: number,
  isDriving: boolean,
  fokusActive: boolean = false
): number {
  if (!isDriving) return 60;
  const clampedRatio = clamp01(speedRatio);
  const baseFov = 60 + clampedRatio * 14;
  return Math.min(78, baseFov + (fokusActive ? 4 : 0));
}

/**
 * Determines whether a world coordinate lies on one of Jakarta's main paved boulevards, outer ring, JORR, or plaza.
 */
export function isOnPavedCorridor(x: number, z: number): boolean {
  const onMainNS = Math.abs(x) <= 7.6 && z >= -74 && z <= 218;
  const onMainEW = Math.abs(z) <= 7.6 && Math.abs(x) <= 218;
  const onRingNS = Math.abs(Math.abs(x) - 32) <= 5.6 && z >= -74 && z <= 218;
  const onRingEW = Math.abs(Math.abs(z) - 32) <= 5.6 && Math.abs(x) <= 218;
  const onOuterRingNS = Math.abs(Math.abs(x) - 128) <= 6.6 && z >= -70 && z <= 216;
  const onOuterRingSouth = Math.abs(z - 128) <= 6.6 && Math.abs(x) <= 216;
  const onJorrNS = Math.abs(Math.abs(x) - 208) <= 7.6 && z >= -72 && z <= 216;
  const onJorrSouth = Math.abs(z - 208) <= 7.6 && Math.abs(x) <= 216;
  const onCoastalWings =
    Math.abs(z + 66) <= 6.2 && Math.abs(x) >= 120 && Math.abs(x) <= 216;
  const onMonasPlaza = x * x + z * z <= 19.2 * 19.2;
  const onBundaranHi = Math.hypot(x, z - 32) <= 12.5;
  const onElevatedToll = z >= 75.5 && z <= 84.5 && Math.abs(x) <= 68;
  return (
    onMainNS ||
    onMainEW ||
    onRingNS ||
    onRingEW ||
    onOuterRingNS ||
    onOuterRingSouth ||
    onJorrNS ||
    onJorrSouth ||
    onCoastalWings ||
    onMonasPlaza ||
    onBundaranHi ||
    onElevatedToll
  );
}

/**
 * Subtle continuous camera micro-shake amplitude when driving fast off paved roads.
 */
export function computeOffRoadMicroShake(
  x: number,
  z: number,
  speedAbs: number,
  isAircraft: boolean
): number {
  if (isAircraft || speedAbs < 5.5) return 0;
  if (isOnPavedCorridor(x, z)) return 0;
  const factor = clamp01((speedAbs - 5.5) / 18);
  return factor * 0.085;
}

/**
 * Returns indices of the K closest light positions to (playerX, playerZ) sorted nearest-first.
 */
export function selectNearestLightIndices(
  positions: readonly Point2D[],
  playerX: number,
  playerZ: number,
  maxCount: number
): number[] {
  const k = Math.max(0, Math.min(maxCount, positions.length));
  if (k === 0) return [];

  const bestIndices: number[] = [];
  const bestDistSq: number[] = [];

  for (let i = 0; i < positions.length; i++) {
    const dx = positions[i].x - playerX;
    const dz = positions[i].z - playerZ;
    const dSq = dx * dx + dz * dz;

    let insertAt = -1;
    for (let j = 0; j < bestDistSq.length; j++) {
      if (dSq < bestDistSq[j]) {
        insertAt = j;
        break;
      }
    }

    if (insertAt !== -1) {
      bestIndices.splice(insertAt, 0, i);
      bestDistSq.splice(insertAt, 0, dSq);
      if (bestIndices.length > k) {
        bestIndices.pop();
        bestDistSq.pop();
      }
    } else if (bestIndices.length < k) {
      bestIndices.push(i);
      bestDistSq.push(dSq);
    }
  }

  return bestIndices;
}

export function canTriggerHorn(
  nowMs: number,
  lastHornMs: number,
  cooldownMs: number = HORN_COOLDOWN_MS
): boolean {
  return nowMs - lastHornMs >= cooldownMs;
}

export function pickHornReactionCallout(seed: number): string {
  const idx =
    ((Math.abs(Math.floor(seed)) % HORN_REACTION_CALLOUTS.length) +
      HORN_REACTION_CALLOUTS.length) %
    HORN_REACTION_CALLOUTS.length;
  return HORN_REACTION_CALLOUTS[idx];
}

/**
 * Computes a natural staggered diagonal / V-formation escort slot behind the player.
 * Never places a follower directly on lateral offset 0 so the central chase camera sightline
 * to the protagonist remains clear.
 */
export function computeStaggeredCrewPosition(
  playerX: number,
  playerZ: number,
  playerFacing: number,
  slotIndex: number
): Point2D {
  const slot = Math.max(0, Math.floor(slotIndex));
  const row = Math.floor(slot / 2);
  const side = slot % 2 === 0 ? -1 : 1;

  // Stagger right-side slots slightly further back for an organic, asymmetric escort silhouette
  const backDist = 1.9 + row * 0.92 + (side > 0 ? 0.36 : 0);
  const sideDist = side * (1.55 + row * 0.72 + (side > 0 ? 0.14 : 0));

  const forwardX = Math.sin(playerFacing);
  const forwardZ = Math.cos(playerFacing);
  const rightX = Math.cos(playerFacing);
  const rightZ = -Math.sin(playerFacing);

  return {
    x: playerX - forwardX * backDist + rightX * sideDist,
    z: playerZ - forwardZ * backDist + rightZ * sideDist,
  };
}

/**
 * Snaps a world coordinate to the nearest shadow-map texel increment to eliminate shadow edge shimmering.
 */
export function snapShadowCoordToTexel(
  coord: number,
  shadowHalfExtent: number,
  shadowMapSize: number
): number {
  if (shadowHalfExtent <= 0 || shadowMapSize <= 0) return coord;
  const texelSize = (shadowHalfExtent * 2) / shadowMapSize;
  return Math.round(coord / texelSize) * texelSize;
}


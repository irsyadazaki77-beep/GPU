import { DistrictId, PlayerProgressState, VehicleType } from './types';

export interface WantedTierSpec {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  unitTypes: VehicleType[];
  maxPursuitUnits: number;
  enablePitManeuver: boolean;
  enableRoadblocks: boolean;
  enableSpikeStrips: boolean;
  enableBrimobTactical: boolean;
  enableHelicopterSpotlight: boolean;
  districtLockdown: boolean;
  baseCooldownSeconds: number;
}

export const WANTED_TIER_SPECS: Record<1 | 2 | 3 | 4 | 5, WantedTierSpec> = {
  1: {
    level: 1,
    label: '★1 — Teguran & Kejaran Motor Patwal',
    unitTypes: ['ojek'],
    maxPursuitUnits: 2,
    enablePitManeuver: false,
    enableRoadblocks: false,
    enableSpikeStrips: false,
    enableBrimobTactical: false,
    enableHelicopterSpotlight: false,
    districtLockdown: false,
    baseCooldownSeconds: 10,
  },
  2: {
    level: 2,
    label: '★★2 — Mobil Patroli & Manuver PIT',
    unitTypes: ['ojek', 'polisi'],
    maxPursuitUnits: 4,
    enablePitManeuver: true,
    enableRoadblocks: false,
    enableSpikeStrips: false,
    enableBrimobTactical: false,
    enableHelicopterSpotlight: false,
    districtLockdown: false,
    baseCooldownSeconds: 16,
  },
  3: {
    level: 3,
    label: '★★★3 — Barikade Jalanan & Paku Ranjau',
    unitTypes: ['polisi', 'ojek'],
    maxPursuitUnits: 5,
    enablePitManeuver: true,
    enableRoadblocks: true,
    enableSpikeStrips: true,
    enableBrimobTactical: false,
    enableHelicopterSpotlight: false,
    districtLockdown: false,
    baseCooldownSeconds: 24,
  },
  4: {
    level: 4,
    label: '★★★★4 — Unit Taktis Brimob & Barracuda',
    unitTypes: ['polisi', 'barracuda'],
    maxPursuitUnits: 6,
    enablePitManeuver: true,
    enableRoadblocks: true,
    enableSpikeStrips: true,
    enableBrimobTactical: true,
    enableHelicopterSpotlight: false,
    districtLockdown: false,
    baseCooldownSeconds: 34,
  },
  5: {
    level: 5,
    label: '★★★★★5 — Helikopter Spotlight & Penyekatan Total Distrik',
    unitTypes: ['barracuda', 'polisi', 'heli'],
    maxPursuitUnits: 8,
    enablePitManeuver: true,
    enableRoadblocks: true,
    enableSpikeStrips: true,
    enableBrimobTactical: true,
    enableHelicopterSpotlight: true,
    districtLockdown: true,
    baseCooldownSeconds: 45,
  },
};

export function getWantedTierSpec(wantedLevel: number): WantedTierSpec | null {
  const clamped = Math.max(0, Math.min(5, Math.floor(wantedLevel)));
  if (clamped === 0) return null;
  return WANTED_TIER_SPECS[clamped as 1 | 2 | 3 | 4 | 5];
}

export interface PoliceInterceptVector {
  targetX: number;
  targetZ: number;
  dirX: number;
  dirZ: number;
  distance: number;
  pitManeuverActive: boolean;
}

/**
 * Computes aggressive police pursuit steering vector.
 * At Wanted ★2+, units predict the player's velocity vector to execute a rear-quarter PIT intercept.
 */
export function computePoliceInterceptVector(
  policeX: number,
  policeZ: number,
  playerX: number,
  playerZ: number,
  playerVx: number,
  playerVz: number,
  wantedLevel: number
): PoliceInterceptVector {
  const spec = getWantedTierSpec(wantedLevel);
  const pitManeuverActive = Boolean(spec?.enablePitManeuver);

  const rawDx = playerX - policeX;
  const rawDz = playerZ - policeZ;
  const rawDist = Math.hypot(rawDx, rawDz) || 0.0001;

  // Lead prediction time scales with distance (clamped 0.25s..1.4s) when PIT maneuver is active
  const leadSeconds = pitManeuverActive
    ? Math.max(0.25, Math.min(1.4, rawDist / 24))
    : 0;

  const targetX = playerX + playerVx * leadSeconds;
  const targetZ = playerZ + playerVz * leadSeconds;
  const dx = targetX - policeX;
  const dz = targetZ - policeZ;
  const dist = Math.hypot(dx, dz) || 0.0001;

  return {
    targetX,
    targetZ,
    dirX: dx / dist,
    dirZ: dz / dist,
    distance: rawDist,
    pitManeuverActive,
  };
}

export interface SpikeStripEvaluation {
  hit: boolean;
  speedMultiplier: number;
  angularImpulse: number;
  damage: number;
}

/**
 * Evaluates whether a vehicle crosses an active ★3+ police spike strip (paku ranjau) near a roadblock.
 */
export function evaluateSpikeStripHit(
  playerX: number,
  playerZ: number,
  roadblockX: number,
  roadblockZ: number,
  roadblockActive: boolean,
  wantedLevel: number
): SpikeStripEvaluation {
  const spec = getWantedTierSpec(wantedLevel);
  if (!roadblockActive || !spec || !spec.enableSpikeStrips) {
    return { hit: false, speedMultiplier: 1, angularImpulse: 0, damage: 0 };
  }

  // Spike strip extends 8.5m laterally across the roadblock lane
  const dx = Math.abs(playerX - roadblockX);
  const dz = Math.abs(playerZ - roadblockZ);
  if (dx <= 8.5 && dz <= 4.2) {
    return {
      hit: true,
      speedMultiplier: 0.38,
      angularImpulse: 1.65,
      damage: 14,
    };
  }

  return { hit: false, speedMultiplier: 1, angularImpulse: 0, damage: 0 };
}

export interface WantedCooldownStepResult {
  wantedLevel: number;
  flashingCooldown: boolean;
  remainingSeconds: number;
  cleared: boolean;
}

/**
 * Steps the line-of-sight cooldown timer when evading police pursuit.
 * Hiding under Semanggi overpass cover or activating Kirana's district blackout accelerates decay.
 */
export function stepWantedSystemCooldown(
  wantedLevel: number,
  currentElapsedOutOfSightSec: number,
  hasPoliceLineOfSight: boolean,
  underOverpassCover: boolean,
  kiranaBlackoutActive: boolean,
  dt: number
): WantedCooldownStepResult {
  const clampedWanted = Math.max(0, Math.min(5, Math.floor(wantedLevel)));
  if (clampedWanted === 0) {
    return {
      wantedLevel: 0,
      flashingCooldown: false,
      remainingSeconds: 0,
      cleared: false,
    };
  }

  const spec = WANTED_TIER_SPECS[clampedWanted as 1 | 2 | 3 | 4 | 5];
  // If Kirana's camera/chopper hack is active, helicopter & CCTV lose sight unless police are right next to player
  const effectiveLineOfSight = hasPoliceLineOfSight && !kiranaBlackoutActive;

  if (effectiveLineOfSight) {
    return {
      wantedLevel: clampedWanted,
      flashingCooldown: false,
      remainingSeconds: spec.baseCooldownSeconds,
      cleared: false,
    };
  }

  const coverRateMultiplier =
    (underOverpassCover ? 1.65 : 1.0) * (kiranaBlackoutActive ? 1.5 : 1.0);
  const nextElapsed = currentElapsedOutOfSightSec + Math.max(0, dt) * coverRateMultiplier;

  if (nextElapsed >= spec.baseCooldownSeconds) {
    const nextLevel = Math.max(0, clampedWanted - 1);
    return {
      wantedLevel: nextLevel,
      flashingCooldown: nextLevel > 0,
      remainingSeconds:
        nextLevel > 0
          ? WANTED_TIER_SPECS[nextLevel as 1 | 2 | 3 | 4 | 5].baseCooldownSeconds
          : 0,
      cleared: true,
    };
  }

  return {
    wantedLevel: clampedWanted,
    flashingCooldown: true,
    remainingSeconds: Math.max(0, spec.baseCooldownSeconds - nextElapsed),
    cleared: false,
  };
}

/**
 * Escalates player wanted level cleanly up to 5 stars and tracks lockdown state.
 */
export function escalateWantedTier(
  state: PlayerProgressState,
  deltaStars: number,
  districtId?: DistrictId
): { state: PlayerProgressState; tierSpec: WantedTierSpec | null; lockdownDistrict: DistrictId | null } {
  const nextLevel = Math.max(0, Math.min(5, Math.floor(state.wantedLevel + deltaStars)));
  const tierSpec = getWantedTierSpec(nextLevel);
  return {
    state: {
      ...state,
      wantedLevel: nextLevel,
    },
    tierSpec,
    lockdownDistrict: tierSpec?.districtLockdown && districtId ? districtId : null,
  };
}

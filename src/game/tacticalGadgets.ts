import type {
  ActiveTacticalZone,
  SpbuStationSpec,
  TacticalGadgetKind,
} from './types';

export const SPBU_SERVICE_PRICE_RP = 15000;
export const SPBU_EMERGENCY_DELIVERY_PRICE_RP = 25000;

/**
 * 3 Verified Pertamina Pasti Pas SPBU Fuel & Quick-Service Hubs
 * Positioned on clear roadside bays (off asphalt roadways and >=6m clear of CITY_BUILDINGS).
 */
export const SPBU_STATIONS: SpbuStationSpec[] = [
  {
    id: 'spbu_scbd_kuningan',
    name: 'SPBU Pertamina 31.129 SCBD-Kuningan',
    districtId: 'scbd',
    x: 44,
    z: 62,
    rotY: -Math.PI / 2,
    serviceRadius: 8.5,
  },
  {
    id: 'spbu_tanah_abang',
    name: 'SPBU Pertamina 31.102 Tanah Abang',
    districtId: 'tanah_abang',
    x: -44,
    z: 18,
    rotY: Math.PI / 2,
    serviceRadius: 8.5,
  },
  {
    id: 'spbu_blok_m',
    name: 'SPBU Pertamina 34.121 Blok M',
    districtId: 'blok_m',
    x: -44,
    z: 108,
    rotY: Math.PI / 2,
    serviceRadius: 8.5,
  },
];

export interface TacticalGadgetSpec {
  kind: TacticalGadgetKind;
  name: string;
  shortLabel: string;
  radiusM: number;
  durationSec: number;
  throwDistanceM: number;
  priceRp: number;
  maxCarry: number;
  policeSightMultiplier: number;
  wantedCooldownMultiplier: number;
  burnDps: number;
}

export const TACTICAL_GADGET_SPECS: Record<
  TacticalGadgetKind,
  TacticalGadgetSpec
> = {
  smoke_grenade: {
    kind: 'smoke_grenade',
    name: 'Granat Asap Taktis',
    shortLabel: 'ASAP',
    radiusM: 12.0,
    durationSec: 9.0,
    throwDistanceM: 10.5,
    priceRp: 18000,
    maxCarry: 5,
    policeSightMultiplier: 0.35,
    wantedCooldownMultiplier: 2.5,
    burnDps: 0,
  },
  molotov: {
    kind: 'molotov',
    name: 'Bom Molotov Jalanan',
    shortLabel: 'MOLOTOV',
    radiusM: 5.5,
    durationSec: 7.0,
    throwDistanceM: 12.0,
    priceRp: 22000,
    maxCarry: 5,
    policeSightMultiplier: 1.0,
    wantedCooldownMultiplier: 1.0,
    burnDps: 18,
  },
};

export function findNearestSpbuStation(
  x: number,
  z: number,
  destroyedIds: string[] = [],
  maxDistOverride?: number
): SpbuStationSpec | null {
  let best: SpbuStationSpec | null = null;
  let bestDist = Infinity;
  for (const st of SPBU_STATIONS) {
    if (destroyedIds.includes(st.id)) continue;
    const d = Math.hypot(x - st.x, z - st.z);
    const limit = maxDistOverride ?? st.serviceRadius;
    if (d <= limit && d < bestDist) {
      bestDist = d;
      best = st;
    }
  }
  return best;
}

export interface SpbuExplosionOutcome {
  triggered: boolean;
  station: SpbuStationSpec | null;
  blastRadiusM: number;
  peakDamage: number;
  wantedStarsAdded: number;
  nextDestroyedIds: string[];
}

/**
 * Evaluates whether a bullet impact, explosion, or high-speed vehicle ram detonates an intact SPBU fuel dispenser.
 */
export function evaluateSpbuPumpExplosion(params: {
  impactX: number;
  impactZ: number;
  impactRadiusM?: number;
  destroyedIds: string[];
}): SpbuExplosionOutcome {
  const hitPad = params.impactRadiusM ?? 3.2;
  for (const st of SPBU_STATIONS) {
    if (params.destroyedIds.includes(st.id)) continue;
    const dist = Math.hypot(params.impactX - st.x, params.impactZ - st.z);
    if (dist <= hitPad) {
      return {
        triggered: true,
        station: st,
        blastRadiusM: 11.5,
        peakDamage: 125,
        wantedStarsAdded: 2,
        nextDestroyedIds: [...params.destroyedIds, st.id],
      };
    }
  }
  return {
    triggered: false,
    station: null,
    blastRadiusM: 0,
    peakDamage: 0,
    wantedStarsAdded: 0,
    nextDestroyedIds: params.destroyedIds,
  };
}

export function createThrownGadgetZone(
  kind: TacticalGadgetKind,
  originX: number,
  originZ: number,
  facingRad: number,
  idSuffix: string | number = Date.now()
): ActiveTacticalZone {
  const spec = TACTICAL_GADGET_SPECS[kind];
  const targetX = originX + Math.sin(facingRad) * spec.throwDistanceM;
  const targetZ = originZ + Math.cos(facingRad) * spec.throwDistanceM;
  return {
    id: `tac_${kind}_${idSuffix}`,
    kind,
    x: targetX,
    z: targetZ,
    radius: spec.radiusM,
    remainingSec: spec.durationSec,
    totalDurationSec: spec.durationSec,
  };
}

export function stepActiveTacticalZones(
  zones: ActiveTacticalZone[],
  dt: number
): ActiveTacticalZone[] {
  if (zones.length === 0) return zones;
  const simDt = Math.max(0, dt);
  const next: ActiveTacticalZone[] = [];
  for (const z of zones) {
    const rem = z.remainingSec - simDt;
    if (rem > 0.01) {
      next.push({ ...z, remainingSec: rem });
    }
  }
  return next;
}

export function evaluateSmokeScreenEffect(
  zones: ActiveTacticalZone[],
  playerX: number,
  playerZ: number
): {
  inSmoke: boolean;
  detectionMultiplier: number;
  wantedCooldownMultiplier: number;
} {
  for (const z of zones) {
    if (z.kind !== 'smoke_grenade' || z.remainingSec <= 0) continue;
    const dist = Math.hypot(playerX - z.x, playerZ - z.z);
    if (dist <= z.radius) {
      const spec = TACTICAL_GADGET_SPECS.smoke_grenade;
      return {
        inSmoke: true,
        detectionMultiplier: spec.policeSightMultiplier,
        wantedCooldownMultiplier: spec.wantedCooldownMultiplier,
      };
    }
  }
  return {
    inSmoke: false,
    detectionMultiplier: 1.0,
    wantedCooldownMultiplier: 1.0,
  };
}

export function evaluateMolotovBurnAt(
  zones: ActiveTacticalZone[],
  entityX: number,
  entityZ: number,
  dt: number
): { burning: boolean; damage: number } {
  let totalDps = 0;
  for (const z of zones) {
    if (z.kind !== 'molotov' || z.remainingSec <= 0) continue;
    const dist = Math.hypot(entityX - z.x, entityZ - z.z);
    if (dist <= z.radius) {
      totalDps += TACTICAL_GADGET_SPECS.molotov.burnDps;
    }
  }
  if (totalDps <= 0) {
    return { burning: false, damage: 0 };
  }
  return {
    burning: true,
    damage: totalDps * Math.max(0, dt),
  };
}

import type { DistrictId, PlayerProgressState } from './types';
import { computeDistrictHeatModifier } from './wantedSystem';

/* ==========================================================================
 * 1. ROAMING BLACK MARKET ARMS VAN ("MOBIL TOKO GELAP BERJALAN")
 * ========================================================================== */

export interface BlackMarketVanStop {
  id: string;
  districtId: DistrictId;
  districtName: string;
  locationHint: string;
  x: number;
  z: number;
  startHour: number;
  endHour: number;
  vendorGreeting: string;
}

export const BLACK_MARKET_VAN_STOPS: BlackMarketVanStop[] = [
  {
    id: 'van_glodok_night',
    districtId: 'kota_tua',
    districtName: 'Gang Gelap Glodok',
    locationHint: 'Belakang Sentra Elektronik Glodok (20:00–03:59 WIB)',
    x: 24,
    z: -44,
    startHour: 20,
    endHour: 4,
    vendorGreeting: 'Koh Alex: "Sst... barang selundupan siber baru mendarat malam ini."',
  },
  {
    id: 'van_priok_dawn',
    districtId: 'tanjung_priok',
    districtName: 'Dermaga Kontainer Priok',
    locationHint: 'Sisi Timur Terminal Petikemas Priok (04:00–09:59 WIB)',
    x: 52,
    z: -42,
    startHour: 4,
    endHour: 10,
    vendorGreeting: 'Bang Maman: "Kargo kapal pagi masih hangat, stok Kevlar penuh!"',
  },
  {
    id: 'van_tanah_abang_noon',
    districtId: 'tanah_abang',
    districtName: 'Lorong Grosir Tanah Abang',
    locationHint: 'Samping Blok A Tanah Abang (10:00–15:59 WIB)',
    x: -48,
    z: -10,
    startHour: 10,
    endHour: 16,
    vendorGreeting: 'Uda Riko: "Siang bolong paling aman transaksi di tengah keramaian pasar."',
  },
  {
    id: 'van_blokm_dusk',
    districtId: 'blok_m',
    districtName: 'Parkiran Belakang Melawai Blok M',
    locationHint: 'Sudut Little Tokyo Blok M (16:00–19:59 WIB)',
    x: -12,
    z: 98,
    startHour: 16,
    endHour: 20,
    vendorGreeting: 'Mas Bagus: "Paket knalpot brong, neon underglow & amunisi siap pasang!"',
  },
];

export function getActiveBlackMarketVanLocation(
  worldTimeMinutes: number
): BlackMarketVanStop {
  const normalizedMin = ((worldTimeMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalizedMin / 60);

  for (const stop of BLACK_MARKET_VAN_STOPS) {
    if (stop.startHour < stop.endHour) {
      if (hour >= stop.startHour && hour < stop.endHour) return stop;
    } else {
      // Overnight wrap (e.g. 20..4)
      if (hour >= stop.startHour || hour < stop.endHour) return stop;
    }
  }
  return BLACK_MARKET_VAN_STOPS[0];
}

export type BlackMarketItemId =
  | 'kevlar_brimob_vest'
  | 'emp_tactical_pack'
  | 'pasopati_ap_ammo'
  | 'nitro_overclock_kit';

export interface BlackMarketItemSpec {
  id: BlackMarketItemId;
  name: string;
  subtitle: string;
  basePriceRp: number;
  category: 'armor' | 'ammo' | 'vehicle';
}

export const BLACK_MARKET_CATALOG: BlackMarketItemSpec[] = [
  {
    id: 'kevlar_brimob_vest',
    name: 'Rompi Kevlar Taktis Brimob Lv.3',
    subtitle: 'Pulihkan Armor 100% penuh dan tingkatkan Fokus Tempur +40%',
    basePriceRp: 95000,
    category: 'armor',
  },
  {
    id: 'emp_tactical_pack',
    name: 'Paket Amunisi Mercon & Plasma Penuh',
    subtitle: 'Isi penuh cadangan amunisi seluruh senjata yang sudah terbuka',
    basePriceRp: 120000,
    category: 'ammo',
  },
  {
    id: 'pasopati_ap_ammo',
    name: 'Selongsong Penembus Baja Pasopati',
    subtitle: '+60 peluru Rifle & +40 sel energi Pasopati dengan daya hancur tinggi',
    basePriceRp: 85000,
    category: 'ammo',
  },
  {
    id: 'nitro_overclock_kit',
    name: 'Kit Knalpot Brong, Neon Underglow & NOS',
    subtitle: 'Tingkatkan level performa garasi kendaraan (+1 Lv, maks Lv.5)',
    basePriceRp: 165000,
    category: 'vehicle',
  },
];

export function purchaseBlackMarketItem(
  state: PlayerProgressState,
  itemId: BlackMarketItemId
): {
  nextState: PlayerProgressState;
  purchased: boolean;
  finalPriceRp: number;
  message: string;
} {
  const spec = BLACK_MARKET_CATALOG.find((i) => i.id === itemId);
  if (!spec) {
    return {
      nextState: state,
      purchased: false,
      finalPriceRp: 0,
      message: 'Barang pasar gelap tidak ditemukan.',
    };
  }

  const heatMod = computeDistrictHeatModifier(
    state.wantedLevel,
    state.characterSkills?.negotiation ?? 1
  );
  const finalPriceRp = Math.round(spec.basePriceRp * heatMod.shopPriceMultiplier);

  if (state.rupiah < finalPriceRp) {
    return {
      nextState: state,
      purchased: false,
      finalPriceRp,
      message: `Dana kurang! Dibutuhkan Rp ${finalPriceRp.toLocaleString('id-ID')}.`,
    };
  }

  let nextState: PlayerProgressState = {
    ...state,
    rupiah: state.rupiah - finalPriceRp,
    score: state.score + 180,
    bestScore: Math.max(state.bestScore, state.score + 180),
  };

  if (itemId === 'kevlar_brimob_vest') {
    nextState = {
      ...nextState,
      armor: nextState.maxArmor,
      fokusEnergy: Math.min(100, nextState.fokusEnergy + 40),
    };
  } else if (itemId === 'emp_tactical_pack') {
    nextState = {
      ...nextState,
      ammo: {
        ...nextState.ammo,
        pistol: Math.max(nextState.ammo.pistol || 0, 96),
        rifle: Math.max(nextState.ammo.rifle || 0, 180),
        mercon: Math.max(nextState.ammo.mercon || 0, 12),
        pasopati: Math.max(nextState.ammo.pasopati || 0, 80),
        gatotkaca: Math.max(nextState.ammo.gatotkaca || 0, 10),
      },
    };
  } else if (itemId === 'pasopati_ap_ammo') {
    nextState = {
      ...nextState,
      ammo: {
        ...nextState.ammo,
        rifle: (nextState.ammo.rifle || 0) + 60,
        pasopati: (nextState.ammo.pasopati || 0) + 40,
      },
    };
  } else if (itemId === 'nitro_overclock_kit') {
    nextState = {
      ...nextState,
      vehicleUpgradeLevel: Math.min(5, nextState.vehicleUpgradeLevel + 1),
    };
  }

  return {
    nextState,
    purchased: true,
    finalPriceRp,
    message: `Berhasil membeli ${spec.name}!`,
  };
}

/* ==========================================================================
 * 2. GRAND HEIST 2.0: SAFE DIAL TUMBLER LOCK-PICKING STATE MACHINE
 * ========================================================================== */

export interface SafeDialState {
  currentAngleDeg: number; // 0..359
  targetAnglesDeg: [number, number, number];
  unlockedPins: number; // 0..3
  completed: boolean;
  attemptsFailed: number;
}

export function createSafeDialSession(seed: number = 42): SafeDialState {
  const s1 = (Math.abs(Math.floor(seed * 73 + 45)) % 300) + 30;
  const s2 = (Math.abs(Math.floor(seed * 137 + 165)) % 300) + 30;
  const s3 = (Math.abs(Math.floor(seed * 211 + 255)) % 300) + 30;
  return {
    currentAngleDeg: 0,
    targetAnglesDeg: [s1, s2, s3],
    unlockedPins: 0,
    completed: false,
    attemptsFailed: 0,
  };
}

export function computeSafeDialProximity(
  currentAngleDeg: number,
  targetAngleDeg: number
): { angularDistanceDeg: number; inSweetSpot: boolean; tensionPct: number } {
  const normA = ((currentAngleDeg % 360) + 360) % 360;
  const normB = ((targetAngleDeg % 360) + 360) % 360;
  const rawDiff = Math.abs(normA - normB);
  const angularDistanceDeg = Math.min(rawDiff, 360 - rawDiff);
  const inSweetSpot = angularDistanceDeg <= 10;
  const tensionPct = Math.max(
    0,
    Math.min(100, Math.round((1 - angularDistanceDeg / 45) * 100))
  );
  return { angularDistanceDeg, inSweetSpot, tensionPct };
}

export function attemptSafePinLock(state: SafeDialState): {
  nextState: SafeDialState;
  pinLocked: boolean;
  vaultOpened: boolean;
} {
  if (state.completed || state.unlockedPins >= 3) {
    return { nextState: state, pinLocked: false, vaultOpened: true };
  }

  const target = state.targetAnglesDeg[state.unlockedPins];
  const prox = computeSafeDialProximity(state.currentAngleDeg, target);

  if (prox.inSweetSpot) {
    const nextUnlocked = state.unlockedPins + 1;
    const completed = nextUnlocked >= 3;
    return {
      nextState: {
        ...state,
        unlockedPins: nextUnlocked,
        completed,
      },
      pinLocked: true,
      vaultOpened: completed,
    };
  }

  return {
    nextState: {
      ...state,
      attemptsFailed: state.attemptsFailed + 1,
    },
    pinLocked: false,
    vaultOpened: false,
  };
}

/* ==========================================================================
 * 3. TURF WAR SYNDICATE COUNTER-INVASION EVALUATOR
 * ========================================================================== */

export interface SyndicateCounterInvasion {
  active: boolean;
  districtId: DistrictId | null;
  attackerFactionName: string;
  defenseTimerSec: number;
  bonusDefenseRewardRp: number;
}

export function evaluateSyndicateCounterAttack(
  state: PlayerProgressState,
  seed: number = 1
): SyndicateCounterInvasion {
  const playerDistricts = Object.values(state.districtTurf || {}).filter(
    (d) => d.owner === 'player'
  );
  if (playerDistricts.length < 4) {
    return {
      active: false,
      districtId: null,
      attackerFactionName: '',
      defenseTimerSec: 0,
      bonusDefenseRewardRp: 0,
    };
  }

  const target =
    playerDistricts[Math.abs(Math.floor(seed)) % playerDistricts.length];
  return {
    active: true,
    districtId: target.districtId as DistrictId,
    attackerFactionName: 'Brigade Elit Sindikat Naga',
    defenseTimerSec: 90,
    bonusDefenseRewardRp: 175000 + target.defenseLevel * 25000,
  };
}

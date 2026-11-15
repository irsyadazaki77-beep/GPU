import { PROTAGONIST_PROFILES } from './archetypes';
import { createInitialStockPortfolio } from './economy';
import type {
  EnemyArchetypeSpec,
  EnemyBehaviorPolicy,
  OriginArchetype,
  PlayerProgressState,
  WeaponId,
  WeaponSpec,
} from './types';

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  fist: {
    id: 'fist',
    key: '1',
    name: 'Tangan Kosong',
    roleClue: 'Bela Diri Silat · Jarak Dekat Tanpa Peluru',
    damage: 22,
    range: 3.0,
    cooldown: 0.35,
    ammoCost: 0,
    maxAmmo: 0,
    isMelee: true,
    splashRadius: 0,
    price: 0,
  },
  golok: {
    id: 'golok',
    key: '2',
    name: 'Golok Betawi',
    roleClue: 'Tebasan Lebar · Knockback Tinggi',
    damage: 45,
    range: 3.6,
    cooldown: 0.48,
    ammoCost: 0,
    maxAmmo: 0,
    isMelee: true,
    splashRadius: 0,
    price: 150000,
  },
  pistol: {
    id: 'pistol',
    key: '3',
    name: 'Pistol Rakitan',
    roleClue: 'Tembakan Presisi · Jarak Menengah',
    damage: 38,
    range: 36,
    cooldown: 0.32,
    ammoCost: 1,
    maxAmmo: 60,
    isMelee: false,
    splashRadius: 0,
    price: 350000,
  },
  rifle: {
    id: 'rifle',
    key: '4',
    name: 'Senapan Taktis',
    roleClue: 'Rentetan Cepat · Daya Hancur Tinggi',
    damage: 30,
    range: 46,
    cooldown: 0.14,
    ammoCost: 1,
    maxAmmo: 120,
    isMelee: false,
    splashRadius: 0,
    price: 750000,
  },
  mercon: {
    id: 'mercon',
    key: '5',
    name: 'Pelontar Mercon Naga',
    roleClue: 'Ledakan Area Luas · Penghancur Barikade (Tahap 2)',
    damage: 95,
    range: 42,
    cooldown: 0.85,
    ammoCost: 1,
    maxAmmo: 16,
    isMelee: false,
    splashRadius: 7.5,
    price: 1250000,
  },
  pasopati: {
    id: 'pasopati',
    key: '6',
    name: 'Busur Pasopati Listrik',
    roleClue: 'Kejut Listrik Berantai · Senjata Elit (Tahap 3)',
    damage: 115,
    range: 48,
    cooldown: 0.52,
    ammoCost: 1,
    maxAmmo: 24,
    isMelee: false,
    splashRadius: 5.5,
    price: 1650000,
  },
  gatotkaca: {
    id: 'gatotkaca',
    key: '7',
    name: 'Meriam Plasma Gatotkaca',
    roleClue: 'Dentuman Plasma Orbital · Senjata Pamungkas (Fase 5)',
    damage: 165,
    range: 55,
    cooldown: 0.62,
    ammoCost: 1,
    maxAmmo: 18,
    isMelee: false,
    splashRadius: 7.0,
    price: 2400000,
  },
};

export const ENEMY_ARCHETYPES: Record<EnemyBehaviorPolicy, EnemyArchetypeSpec> = {
  rusher: {
    policy: 'rusher',
    name: 'Preman Pasar (Jawara)',
    maxHp: 65,
    speed: 6.2,
    damage: 14,
    attackRange: 2.3,
    windupDuration: 0.35,
    cooldown: 1.1,
    rewardRp: 45000,
    scoreValue: 120,
  },
  ranged_kiter: {
    policy: 'ranged_kiter',
    name: 'Penembak Sindikat',
    maxHp: 55,
    speed: 5.0,
    damage: 16,
    attackRange: 18.0,
    windupDuration: 0.5,
    cooldown: 1.6,
    rewardRp: 75000,
    scoreValue: 180,
  },
  charger_enforcer: {
    policy: 'charger_enforcer',
    name: 'Algojo Lapis Baja',
    maxHp: 130,
    speed: 7.8,
    damage: 24,
    attackRange: 3.2,
    windupDuration: 0.65,
    cooldown: 2.1,
    rewardRp: 120000,
    scoreValue: 300,
  },
};

export const DRONE_UPGRADE_COST = 300000;
export const VEHICLE_UPGRADE_COST = 250000;

export function createInitialPlayerState(origin: OriginArchetype): PlayerProgressState {
  const base: PlayerProgressState = {
    hp: 100,
    maxHp: 100,
    armor: 50,
    maxArmor: 100,
    rupiah: 350000,
    wantedLevel: 0,
    wantedEvading: false,
    wantedEvadeTimer: 0,
    score: 0,
    bestScore: 0,
    reputation: {
      jalanan: 15,
      sindikat: 15,
      rakyat: 15,
    },
    completedMissions: [],
    unlockedWeapons: ['fist', 'golok', 'pistol', 'mercon', 'pasopati', 'gatotkaca'],
    activeWeapon: 'pistol',
    ammo: {
      fist: 0,
      golok: 0,
      pistol: 48,
      rifle: 60,
      mercon: 8,
      pasopati: 14,
      gatotkaca: 10,
    },
    ownedProperties: [],
    crewCount: 0,
    radioStation: 'off',
    fokusEnergy: 100,
    fokusActive: false,
    outfitId: 'jaket_jawara',
    vehicleUpgradeLevel: 0,
    droneLevel: 1,
    droneActive: true,
    activeProtagonist: 'nabilo',
    protagonistRoster: {
      nabilo: {
        id: 'nabilo',
        x: 0,
        z: 26,
        hp: 100,
        armor: 80,
        outfitId: 'jaket_jawara',
        statusText: PROTAGONIST_PROFILES.nabilo.idleActivity,
      },
      raka: {
        id: 'raka',
        x: 32,
        z: -26,
        hp: 100,
        armor: 75,
        outfitId: 'rompi_taktis',
        statusText: PROTAGONIST_PROFILES.raka.idleActivity,
      },
      kirana: {
        id: 'kirana',
        x: -48,
        z: -44,
        hp: 100,
        armor: 70,
        outfitId: 'hoodie_siber',
        statusText: PROTAGONIST_PROFILES.kirana.idleActivity,
      },
    },
    vehicleCustoms: {
      paintId: 'paint_jawara_crimson',
      underglowId: 'glow_cyan',
      armorPlatingLevel: 1,
      nitroEnabled: true,
    },
    stockPortfolio: createInitialStockPortfolio(),
    completedHeistSetups: ['heist_bank_sentral'],
    completedHeists: [],
    activeHeistPlan: {
      heistId: 'heist_bank_sentral',
      approach: 'stealth_cyber',
      hackerId: 'crew_dimas_siber',
      driverId: 'crew_sari_drift',
      gunmanId: 'crew_bang_tigers',
    },
    currentInterior: 'exterior',
    staminaBuffTimer: 0,
    lastSnackEaten: null,
  };

  if (origin === 'anak_jalanan') {
    base.reputation.jalanan = 40;
    base.armor = 80;
    base.rupiah = 300000;
    base.crewCount = 1;
  } else if (origin === 'mantan_kurir') {
    base.reputation.rakyat = 40;
    base.rupiah = 550000;
  } else if (origin === 'teknisi_glodok') {
    base.reputation.sindikat = 40;
    base.unlockedWeapons = [
      'fist',
      'golok',
      'pistol',
      'rifle',
      'mercon',
      'pasopati',
      'gatotkaca',
    ];
    base.ammo.rifle = 90;
    base.ammo.mercon = 12;
    base.ammo.pasopati = 20;
    base.ammo.gatotkaca = 16;
    base.droneLevel = 2;
  }

  return base;
}

export function upgradeDroneTech(
  state: PlayerProgressState
): { nextState: PlayerProgressState; upgraded: boolean } {
  if (state.droneLevel >= 3 || state.rupiah < DRONE_UPGRADE_COST) {
    return { nextState: state, upgraded: false };
  }
  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - DRONE_UPGRADE_COST,
      droneLevel: state.droneLevel + 1,
      droneActive: true,
      score: state.score + 260,
      bestScore: Math.max(state.bestScore, state.score + 260),
    },
    upgraded: true,
  };
}

export function recruitCrewMember(
  state: PlayerProgressState
): { nextState: PlayerProgressState; recruited: boolean } {
  const MAX_CREW = 3;
  const CREW_COST = 200000;
  if (state.crewCount >= MAX_CREW || state.rupiah < CREW_COST) {
    return { nextState: state, recruited: false };
  }
  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - CREW_COST,
      crewCount: state.crewCount + 1,
      score: state.score + 180,
      bestScore: Math.max(state.bestScore, state.score + 180),
    },
    recruited: true,
  };
}

export function upgradeVehicleGarage(
  state: PlayerProgressState
): { nextState: PlayerProgressState; upgraded: boolean } {
  if (state.vehicleUpgradeLevel >= 3 || state.rupiah < VEHICLE_UPGRADE_COST) {
    return { nextState: state, upgraded: false };
  }
  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - VEHICLE_UPGRADE_COST,
      vehicleUpgradeLevel: state.vehicleUpgradeLevel + 1,
      score: state.score + 220,
      bestScore: Math.max(state.bestScore, state.score + 220),
    },
    upgraded: true,
  };
}

export function stepFokusAbility(
  state: PlayerProgressState,
  dt: number
): PlayerProgressState {
  if (state.fokusActive) {
    const nextEnergy = Math.max(0, state.fokusEnergy - dt * 16);
    if (nextEnergy <= 0) {
      return {
        ...state,
        fokusEnergy: 0,
        fokusActive: false,
      };
    }
    return {
      ...state,
      fokusEnergy: nextEnergy,
    };
  }
  if (state.fokusEnergy >= 100) return state;
  return {
    ...state,
    fokusEnergy: Math.min(100, state.fokusEnergy + dt * 9.5),
  };
}

export function clampDt(rawDt: number): number {
  if (!Number.isFinite(rawDt) || rawDt < 0) return 0;
  return Math.min(rawDt, 0.05);
}

export function applyDamageToPlayer(
  state: PlayerProgressState,
  rawDamage: number
): { nextState: PlayerProgressState; isDefeated: boolean } {
  const dmg = Math.max(0, Math.round(rawDamage));
  let armor = state.armor;
  let hp = state.hp;

  if (armor > 0) {
    const absorbed = Math.min(armor, Math.ceil(dmg * 0.65));
    armor -= absorbed;
    const remainder = dmg - absorbed;
    hp = Math.max(0, hp - remainder);
  } else {
    hp = Math.max(0, hp - dmg);
  }

  return {
    nextState: {
      ...state,
      hp,
      armor,
    },
    isDefeated: hp <= 0,
  };
}

export function escalateWantedLevel(
  currentWanted: number,
  delta: number
): number {
  return Math.max(0, Math.min(5, Math.round(currentWanted + delta)));
}

export function stepWantedEvade(
  state: PlayerProgressState,
  isHiddenFromPolice: boolean,
  dt: number
): { nextState: PlayerProgressState; cleared: boolean } {
  if (state.wantedLevel <= 0 || dt <= 0) {
    return { nextState: state, cleared: false };
  }
  if (!isHiddenFromPolice) {
    if (!state.wantedEvading && state.wantedEvadeTimer === 0) {
      return { nextState: state, cleared: false };
    }
    return {
      nextState: { ...state, wantedEvading: false, wantedEvadeTimer: 0 },
      cleared: false,
    };
  }

  const nextTimer = state.wantedEvadeTimer + dt;
  const evadeThreshold = 5 + state.wantedLevel * 2.5;
  if (nextTimer >= evadeThreshold) {
    return {
      nextState: {
        ...state,
        wantedLevel: 0,
        wantedEvading: false,
        wantedEvadeTimer: 0,
        score: state.score + 200,
        bestScore: Math.max(state.bestScore, state.score + 200),
      },
      cleared: true,
    };
  }
  return {
    nextState: {
      ...state,
      wantedEvading: true,
      wantedEvadeTimer: nextTimer,
    },
    cleared: false,
  };
}

export function stepEnemyMovementPolicy(
  policy: EnemyBehaviorPolicy,
  ex: number,
  ez: number,
  px: number,
  pz: number,
  speed: number,
  dt: number,
  phaseTimer: number
): { nextX: number; nextZ: number; facingAngle: number } {
  const dx = px - ex;
  const dz = pz - ez;
  const dist = Math.hypot(dx, dz) || 0.001;
  const dirX = dx / dist;
  const dirZ = dz / dist;
  const facingAngle = Math.atan2(dirX, dirZ);

  if (policy === 'rusher') {
    const perpX = -dirZ * Math.sin(phaseTimer * 3.5) * 0.25;
    const perpZ = dirX * Math.sin(phaseTimer * 3.5) * 0.25;
    const stopDist = 1.7;
    if (dist > stopDist) {
      return {
        nextX: ex + (dirX + perpX) * speed * dt,
        nextZ: ez + (dirZ + perpZ) * speed * dt,
        facingAngle,
      };
    }
    return { nextX: ex, nextZ: ez, facingAngle };
  }

  if (policy === 'ranged_kiter') {
    const strafeSign = Math.sin(phaseTimer * 1.4) >= 0 ? 1 : -1;
    const perpX = -dirZ * strafeSign;
    const perpZ = dirX * strafeSign;
    let radialFactor = 0;
    if (dist < 8.5) radialFactor = -0.85;
    else if (dist > 14.0) radialFactor = 0.9;

    return {
      nextX: ex + (dirX * radialFactor + perpX * 0.65) * speed * dt,
      nextZ: ez + (dirZ * radialFactor + perpZ * 0.65) * speed * dt,
      facingAngle,
    };
  }

  const cycle = phaseTimer % 3.2;
  const isCharging = cycle > 2.0;
  const burstMultiplier = isCharging ? 1.85 : 0.45;
  const stopDist = 2.0;
  if (dist > stopDist) {
    return {
      nextX: ex + dirX * speed * burstMultiplier * dt,
      nextZ: ez + dirZ * speed * burstMultiplier * dt,
      facingAngle,
    };
  }
  return { nextX: ex, nextZ: ez, facingAngle };
}

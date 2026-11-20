import { JAKARTA_DISTRICTS } from './heists';
import { STREET_RACES } from './racing';
import type {
  ActiveStreetRaceSession,
  ActiveTurfWarSession,
  BuildingFootprint,
  CameraViewMode,
  DailyChallengeItem,
  DailyChallengeKind,
  DailyChallengesState,
  EmpireEndgameSummary,
  FloodZoneSpec,
  PlayerProgressState,
  ProtagonistId,
  RaceRivalTelemetry,
  SquadOrderMode,
  StuntJumpResult,
  StuntRampSpec,
} from './types';

/* ==========================================================================
 * 1. CAMERA MODE CYCLE & TACTICAL COVER / GUNPLAY RULES
 * ========================================================================== */

export const CAMERA_VIEW_ORDER: CameraViewMode[] = [
  'third_person',
  'first_person',
  'cinematic',
];

export const CAMERA_VIEW_LABELS: Record<CameraViewMode, string> = {
  third_person: 'Orang Ketiga',
  first_person: 'First-Person',
  cinematic: 'Sinematik',
};

export function cycleCameraViewMode(current: CameraViewMode): CameraViewMode {
  const idx = CAMERA_VIEW_ORDER.indexOf(current);
  return CAMERA_VIEW_ORDER[(idx + 1) % CAMERA_VIEW_ORDER.length];
}

export function evaluateCoverAvailability(
  px: number,
  pz: number,
  buildings: readonly BuildingFootprint[],
  nearbyVehicles: readonly { x: number; z: number }[]
): {
  canTakeCover: boolean;
  coverKind: 'none' | 'building' | 'vehicle' | 'barrier';
  normalX: number;
  normalZ: number;
} {
  // Check nearby vehicles first (2.9m snap distance)
  let bestDist = 3.1;
  let coverKind: 'none' | 'building' | 'vehicle' | 'barrier' = 'none';
  let nx = 0;
  let nz = 1;

  for (let i = 0; i < nearbyVehicles.length; i++) {
    const v = nearbyVehicles[i];
    const dx = px - v.x;
    const dz = pz - v.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.4 && dist < bestDist) {
      bestDist = dist;
      coverKind = 'vehicle';
      nx = dx / dist;
      nz = dz / dist;
    }
  }

  // Check building perimeters
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const hw = b.width * 0.5;
    const hd = b.depth * 0.5;
    const cx = Math.max(b.x - hw, Math.min(b.x + hw, px));
    const cz = Math.max(b.z - hd, Math.min(b.z + hd, pz));
    const dx = px - cx;
    const dz = pz - cz;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.2 && dist < bestDist) {
      bestDist = dist;
      coverKind = 'building';
      nx = dist > 0.01 ? dx / dist : 0;
      nz = dist > 0.01 ? dz / dist : 1;
    }
  }

  // Fallback: tactical roadside jersey barrier cover along major avenues
  if (coverKind === 'none' && (Math.abs(Math.abs(px) - 7.5) < 2.4 || Math.abs(Math.abs(pz) - 7.5) < 2.4)) {
    coverKind = 'barrier';
    nx = Math.abs(Math.abs(px) - 7.5) < 2.4 ? Math.sign(px || 1) : 0;
    nz = nx === 0 ? Math.sign(pz || 1) : 0;
  }

  return {
    canTakeCover: coverKind !== 'none',
    coverKind,
    normalX: nx,
    normalZ: nz,
  };
}

export function applyCoverDamageMitigation(
  rawDamage: number,
  inCover: boolean
): number {
  if (!inCover || rawDamage <= 0) return rawDamage;
  return Math.max(1, Math.round(rawDamage * 0.35));
}

/* ==========================================================================
 * 2. 3D TRIO SQUAD AI (RAKA & KIRANA) ORDERS & RADIO CALLOUTS
 * ========================================================================== */

export const SQUAD_ORDER_LABELS: Record<SquadOrderMode, string> = {
  follow: 'Ikuti',
  attack: 'Serang',
  hold: 'Tahan Posisi',
};

export function resolveSquadOrderCallout(
  order: SquadOrderMode,
  activeProtagonist: ProtagonistId
): string {
  const speaker =
    activeProtagonist === 'raka'
      ? 'Kirana'
      : activeProtagonist === 'kirana'
      ? 'Raka'
      : 'Raka & Kirana';

  if (order === 'attack') {
    return `${speaker}: "Siap! Kami maju serbu target — Kirana siapkan pulsa EMP!"`;
  }
  if (order === 'hold') {
    return `${speaker}: "Posisi dikunci! Kami tahan perimeter ini sampai clear."`;
  }
  return `${speaker}: "Formasi rapat! Kami kawal belakangmu terus."`;
}

export function getActiveWingmanIds(active: ProtagonistId): ProtagonistId[] {
  const all: ProtagonistId[] = ['nabilo', 'raka', 'kirana'];
  return all.filter((id) => id !== active);
}

/* ==========================================================================
 * 3. 6 HANDCRAFTED 3D JAKARTA STUNT RAMPS & AIR-TIME SCORING
 * ========================================================================== */

export const STUNT_RAMPS_CATALOG: StuntRampSpec[] = [
  {
    id: 'ramp_sudirman_skyway',
    name: 'Lompatan Langit Sudirman',
    districtName: 'Koridor Sudirman - Thamrin',
    x: 0,
    z: -42,
    heading: Math.PI, // Facing north (-Z)
    length: 11,
    width: 5.2,
    peakHeight: 3.0,
    targetDistanceM: 28,
    rewardRp: 140000,
  },
  {
    id: 'ramp_monas_selatan',
    name: 'Tanjakan Monas Selatan',
    districtName: 'Medan Merdeka & Monas',
    x: 0,
    z: 36,
    heading: 0, // Facing south (+Z)
    length: 10.5,
    width: 5.2,
    peakHeight: 2.8,
    targetDistanceM: 25,
    rewardRp: 125000,
  },
  {
    id: 'ramp_semanggi_tol',
    name: 'Loncatan Simpang Semanggi',
    districtName: 'Kawasan Elit SCBD',
    x: -32,
    z: -16,
    heading: Math.PI,
    length: 11.5,
    width: 5.0,
    peakHeight: 3.1,
    targetDistanceM: 30,
    rewardRp: 165000,
  },
  {
    id: 'ramp_kota_tua_kanal',
    name: 'Lompatan Kanal Kota Tua',
    districtName: 'Kota Tua & Glodok',
    x: 46,
    z: 2.5,
    heading: Math.PI / 2, // Facing east (+X)
    length: 10.5,
    width: 5.0,
    peakHeight: 2.9,
    targetDistanceM: 26,
    rewardRp: 145000,
  },
  {
    id: 'ramp_tanah_abang_kicker',
    name: 'Kicker Pasar Tanah Abang',
    districtName: 'Pasar Tanah Abang',
    x: -46,
    z: 2.5,
    heading: -Math.PI / 2, // Facing west (-X)
    length: 10.0,
    width: 4.8,
    peakHeight: 2.7,
    targetDistanceM: 24,
    rewardRp: 130000,
  },
  {
    id: 'ramp_blok_m_neon',
    name: 'Ramp Neon Melawai Blok M',
    districtName: 'Terminal Blok M & Melawai',
    x: 32,
    z: 18,
    heading: 0,
    length: 11.0,
    width: 5.0,
    peakHeight: 3.0,
    targetDistanceM: 28,
    rewardRp: 155000,
  },
];

export function evaluateStuntRampContact(
  x: number,
  z: number,
  speed: number,
  vehicleHeading: number
): {
  onRamp: boolean;
  ramp: StuntRampSpec | null;
  surfaceHeight: number;
  progressT: number;
  launchReady: boolean;
} {
  for (let i = 0; i < STUNT_RAMPS_CATALOG.length; i++) {
    const r = STUNT_RAMPS_CATALOG[i];
    const dx = x - r.x;
    const dz = z - r.z;
    const sinH = Math.sin(r.heading);
    const cosH = Math.cos(r.heading);

    // Local ramp coordinates: forward along heading, lateral perpendicular
    const localForward = dx * sinH + dz * cosH;
    const localLateral = Math.abs(dx * cosH - dz * sinH);
    const halfLen = r.length * 0.5;
    const halfWid = r.width * 0.5 + 0.6;

    if (
      localForward >= -halfLen &&
      localForward <= halfLen &&
      localLateral <= halfWid
    ) {
      const progressT = Math.max(0, Math.min(1, (localForward + halfLen) / r.length));
      const surfaceHeight = progressT * r.peakHeight;
      const alignDot =
        Math.sin(vehicleHeading) * sinH + Math.cos(vehicleHeading) * cosH;
      const launchReady =
        progressT >= 0.78 && Math.abs(speed) >= 13 && alignDot > 0.45;
      return {
        onRamp: true,
        ramp: r,
        surfaceHeight,
        progressT,
        launchReady,
      };
    }
  }
  return {
    onRamp: false,
    ramp: null,
    surfaceHeight: 0,
    progressT: 0,
    launchReady: false,
  };
}

export function scoreStuntJump(
  ramp: StuntRampSpec,
  distanceM: number,
  airTimeSec: number,
  completedRampIds: readonly string[]
): StuntJumpResult {
  const safeDist = Math.max(4, Math.round(distanceM));
  const safeAir = Number(Math.max(0.3, airTimeSec).toFixed(2));
  const isNewRamp = !completedRampIds.includes(ramp.id);
  const ratio = safeDist / Math.max(10, ramp.targetDistanceM);
  const rating: StuntJumpResult['rating'] =
    ratio >= 1.25 ? 'LEGENDARIS' : ratio >= 0.85 ? 'GOKIL' : 'MANTAP';
  const mult = rating === 'LEGENDARIS' ? 1.5 : rating === 'GOKIL' ? 1.15 : 0.85;
  const firstBonus = isNewRamp ? 1.25 : 1.0;

  return {
    rampId: ramp.id,
    rampName: ramp.name,
    distanceM: safeDist,
    airTimeSec: safeAir,
    rating,
    rewardRp: Math.round(ramp.rewardRp * mult * firstBonus),
    cloutXp: Math.round((rating === 'LEGENDARIS' ? 80 : rating === 'GOKIL' ? 55 : 35) * firstBonus),
    isNewRamp,
    timestampMs: Date.now(),
  };
}

/* ==========================================================================
 * 4. JAKARTA MONSOON FLOOD ZONES & HYDROPLANING PHYSICS
 * ========================================================================== */

export const JAKARTA_FLOOD_ZONES: FloodZoneSpec[] = [
  {
    id: 'flood_thamrin_bawah',
    name: 'Genangan Koridor Thamrin',
    x: 0,
    z: -56,
    radius: 10.5,
    depthM: 0.28,
    hydroplaneFactor: 0.34,
  },
  {
    id: 'flood_kemayoran_ring',
    name: 'Banjir Lingkar Kemayoran',
    x: 32,
    z: -10,
    radius: 9.5,
    depthM: 0.25,
    hydroplaneFactor: 0.3,
  },
  {
    id: 'flood_kota_tua_kanal',
    name: 'Luapan Kanal Kota Tua',
    x: 58,
    z: 2.5,
    radius: 10.0,
    depthM: 0.32,
    hydroplaneFactor: 0.38,
  },
  {
    id: 'flood_blok_m_underpass',
    name: 'Genangan Underpass Blok M',
    x: 0,
    z: 56,
    radius: 9.5,
    depthM: 0.26,
    hydroplaneFactor: 0.32,
  },
];

export function evaluateFloodZoneAt(
  x: number,
  z: number,
  wetnessFactor: number
): {
  inFlood: boolean;
  zone: FloodZoneSpec | null;
  hydroplaneStrength: number;
} {
  if (wetnessFactor < 0.55) {
    return { inFlood: false, zone: null, hydroplaneStrength: 0 };
  }
  const intensity = Math.min(1, (wetnessFactor - 0.55) / 0.45);
  for (let i = 0; i < JAKARTA_FLOOD_ZONES.length; i++) {
    const fz = JAKARTA_FLOOD_ZONES[i];
    const dist = Math.hypot(x - fz.x, z - fz.z);
    if (dist <= fz.radius) {
      return {
        inFlood: true,
        zone: fz,
        hydroplaneStrength: Number((fz.hydroplaneFactor * intensity).toFixed(3)),
      };
    }
  }
  return { inFlood: false, zone: null, hydroplaneStrength: 0 };
}

/* ==========================================================================
 * 5. RIVAL AI STREET RACING SESSION ENGINE
 * ========================================================================== */

export const RACE_RIVAL_PROFILES = [
  { id: 'rival_reno', name: 'Reno "Drift" Kemayoran', colorHex: 0x06b6d4, baseSpeed: 29.5 },
  { id: 'rival_vina', name: 'Vina "SCBD" GT', colorHex: 0xf43f5e, baseSpeed: 31.2 },
  { id: 'rival_bima', name: 'Bima "Tol Layang"', colorHex: 0xf59e0b, baseSpeed: 28.4 },
] as const;

export function createStreetRaceSession(raceId: string): ActiveStreetRaceSession | null {
  const spec = STREET_RACES.find((r) => r.id === raceId) || STREET_RACES[0];
  if (!spec) return null;
  return {
    raceId: spec.id,
    raceName: spec.name,
    checkpoints: spec.checkpoints,
    playerCheckpointIndex: 0,
    elapsedSec: 0,
    countdownSec: 3.0,
    position: 1,
    totalRacers: 4,
    status: 'countdown',
    rewardRp: spec.rewardRp,
    finishedPlace: null,
  };
}

export function computePlayerRacePosition(
  playerCheckpointIndex: number,
  playerX: number,
  playerZ: number,
  checkpoints: [number, number][],
  rivals: readonly RaceRivalTelemetry[]
): number {
  const scoreProgress = (cpIdx: number, rx: number, rz: number, finished: boolean) => {
    if (finished) return 1_000_000 - cpIdx;
    const clampedIdx = Math.min(cpIdx, checkpoints.length - 1);
    const target = checkpoints[clampedIdx] || [0, 0];
    const distToNext = Math.hypot(rx - target[0], rz - target[1]);
    return cpIdx * 1000 - distToNext;
  };

  const playerScore = scoreProgress(
    playerCheckpointIndex,
    playerX,
    playerZ,
    playerCheckpointIndex >= checkpoints.length
  );

  let rank = 1;
  for (let i = 0; i < rivals.length; i++) {
    const rv = rivals[i];
    const rvScore = scoreProgress(rv.checkpointIndex, rv.x, rv.z, rv.finished);
    if (rvScore > playerScore) rank++;
  }
  return rank;
}

export function calculateStreetRacePayout(
  baseRewardRp: number,
  place: number
): { rewardRp: number; cloutXp: number; label: string } {
  if (place === 1) {
    return {
      rewardRp: baseRewardRp,
      cloutXp: 95,
      label: 'JUARA 1 — Raja Aspal Jakarta!',
    };
  }
  if (place === 2) {
    return {
      rewardRp: Math.round(baseRewardRp * 0.55),
      cloutXp: 55,
      label: 'JUARA 2 — Podium Perak!',
    };
  }
  if (place === 3) {
    return {
      rewardRp: Math.round(baseRewardRp * 0.3),
      cloutXp: 30,
      label: 'JUARA 3 — Podium Perunggu!',
    };
  }
  return {
    rewardRp: Math.round(baseRewardRp * 0.12),
    cloutXp: 15,
    label: 'FINIS KE-4 — Coba Tuning Nitro Lagi!',
  };
}

/* ==========================================================================
 * 6. ACTIVE 3D TURF WAR WAVES, EMPIRE ENDGAME & DAILY CHALLENGES
 * ========================================================================== */

export function createTurfWarSession(districtId: string): ActiveTurfWarSession | null {
  const district = JAKARTA_DISTRICTS.find((d) => d.id === districtId);
  if (!district) return null;
  return {
    districtId: district.id,
    districtName: district.name,
    centerX: district.centerX,
    centerZ: district.centerZ,
    radius: 26,
    wave: 1,
    totalWaves: 3,
    enemiesRemaining: 4,
    captainAlive: false,
    progressPct: 0,
    status: 'active',
  };
}

export function advanceTurfWarWave(
  session: ActiveTurfWarSession
): { next: ActiveTurfWarSession; spawnedNewWave: boolean; victory: boolean } {
  if (session.status !== 'active') {
    return { next: session, spawnedNewWave: false, victory: false };
  }
  if (session.wave < 3) {
    const nextWave = (session.wave + 1) as 2 | 3;
    return {
      next: {
        ...session,
        wave: nextWave,
        enemiesRemaining: nextWave === 2 ? 5 : 4,
        captainAlive: nextWave === 3,
        progressPct: nextWave === 2 ? 34 : 68,
      },
      spawnedNewWave: true,
      victory: false,
    };
  }
  return {
    next: {
      ...session,
      enemiesRemaining: 0,
      captainAlive: false,
      progressPct: 100,
      status: 'victory',
    },
    spawnedNewWave: false,
    victory: true,
  };
}

export function computeEmpireEndgameSummary(
  playerState: PlayerProgressState,
  completedStuntsCount: number
): EmpireEndgameSummary {
  const turfValues = Object.values(playerState.districtTurf || {});
  const totalDistricts = Math.max(13, turfValues.length);
  const ownedDistricts = turfValues.filter((t) => t.owner === 'player').length;
  const turfPassive = turfValues
    .filter((t) => t.owner === 'player')
    .reduce((sum, t) => sum + t.dividendRp, 0);

  const ownedBusinessesCount = Object.values(playerState.ownedBusinesses || {}).filter(
    (lv) => (lv ?? 0) > 0
  ).length;
  const businessPassive = ownedBusinessesCount * 45000;
  const propertyPassive = (playerState.ownedProperties?.length || 0) * 32000;
  const completedHeistsCount = playerState.completedHeists?.length || 0;

  const passiveIncomePerMinRp = turfPassive + businessPassive + propertyPassive;
  const empireScore =
    ownedDistricts * 180 +
    ownedBusinessesCount * 140 +
    completedHeistsCount * 320 +
    completedStuntsCount * 90;

  let tier: 1 | 2 | 3 | 4 = 1;
  let tierTitle = 'Penguasa Jalanan Blok M';
  let nextTierGoal = 'Kuasai 6 distrik atau selesaikan 1 Grand Heist';

  if (ownedDistricts >= 11 && completedHeistsCount >= 2) {
    tier = 4;
    tierTitle = 'Penguasa Mutlak Jakarta';
    nextTierGoal = 'Takhta tertinggi Jakarta tercapai — pertahankan imperium!';
  } else if (ownedDistricts >= 8 || empireScore >= 1800) {
    tier = 3;
    tierTitle = 'Bos Sindikat Ibu Kota';
    nextTierGoal = 'Kuasai 11 distrik & 2 Grand Heist untuk gelar Mutlak';
  } else if (ownedDistricts >= 5 || completedHeistsCount >= 1 || empireScore >= 1000) {
    tier = 2;
    tierTitle = 'Kapten Distrik Protokol';
    nextTierGoal = 'Kuasai 8 distrik atau raih 1.800 Skor Imperium';
  }

  return {
    tier,
    tierTitle,
    ownedDistricts,
    totalDistricts,
    ownedBusinessesCount,
    completedHeistsCount,
    completedStuntsCount,
    passiveIncomePerMinRp,
    empireScore,
    nextTierGoal,
  };
}

const DAILY_CHALLENGE_POOL: Omit<DailyChallengeItem, 'id' | 'progress' | 'claimed'>[] = [
  {
    kind: 'stunt_jump',
    title: 'Lompatan Stunt Jakarta',
    subtitle: 'Tuntaskan 2 lompatan lewat 3D Stunt Ramp di jalan protokol',
    target: 2,
    rewardRp: 220000,
    cloutXp: 85,
  },
  {
    kind: 'street_race_win',
    title: 'Podium Balap Liar Malam',
    subtitle: 'Finis di posisi 3 besar pada balap rival AI Jakarta',
    target: 1,
    rewardRp: 320000,
    cloutXp: 110,
  },
  {
    kind: 'turf_capture',
    title: 'Ekspansi Wilayah Imperium',
    subtitle: 'Rebut 1 distrik sindikat lewat Serangan Turf War 3D',
    target: 1,
    rewardRp: 360000,
    cloutXp: 120,
  },
  {
    kind: 'squad_takedown',
    title: 'Operasi Taktis Trio',
    subtitle: 'Lumpuhkan 5 musuh bersama Raka & Kirana atau dari posisi Cover',
    target: 5,
    rewardRp: 240000,
    cloutXp: 90,
  },
  {
    kind: 'viral_post',
    title: 'Trending NabiloGram',
    subtitle: 'Picu atau unggah 2 momen viral ke feed NabiloGram',
    target: 2,
    rewardRp: 185000,
    cloutXp: 95,
  },
  {
    kind: 'drift_combo',
    title: 'Raja Drift Aspal Basah',
    subtitle: 'Lakukan 3 kali rantai drift panjang di jalanan Jakarta',
    target: 3,
    rewardRp: 210000,
    cloutXp: 80,
  },
];

export function getTodayDateKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createDailyChallengesForDate(
  dateKey: string = getTodayDateKey(),
  streakDays: number = 1
): DailyChallengesState {
  // Deterministic 3-item daily pick from dateKey hash
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  const picked: DailyChallengeItem[] = [];
  const used = new Set<number>();
  // Always ensure diverse high-fun mix (1 stunt/race, 1 turf/combat, 1 viral/drift)
  const buckets = [
    [0, 1],
    [2, 3],
    [4, 5],
  ];
  for (let b = 0; b < buckets.length; b++) {
    const idx = buckets[b][(hash + b) % buckets[b].length];
    used.add(idx);
    const tpl = DAILY_CHALLENGE_POOL[idx];
    picked.push({
      id: `dc_${dateKey}_${tpl.kind}`,
      ...tpl,
      progress: 0,
      claimed: false,
    });
  }

  return {
    dateKey,
    streakDays: Math.max(1, streakDays),
    items: picked,
  };
}

export function advanceDailyChallengeProgress(
  state: DailyChallengesState,
  kind: DailyChallengeKind,
  delta: number = 1
): { next: DailyChallengesState; justCompletedTitle: string | null } {
  if (delta <= 0) return { next: state, justCompletedTitle: null };
  let justCompletedTitle: string | null = null;
  let changed = false;

  const items = state.items.map((item) => {
    if (item.kind !== kind || item.claimed || item.progress >= item.target) {
      return item;
    }
    changed = true;
    const nextProg = Math.min(item.target, item.progress + delta);
    if (nextProg >= item.target && item.progress < item.target) {
      justCompletedTitle = item.title;
    }
    return { ...item, progress: nextProg };
  });

  if (!changed) return { next: state, justCompletedTitle: null };
  return {
    next: { ...state, items },
    justCompletedTitle,
  };
}

export function claimDailyChallengeReward(
  state: DailyChallengesState,
  challengeId: string
): {
  next: DailyChallengesState;
  claimed: boolean;
  rewardRp: number;
  cloutXp: number;
} {
  const target = state.items.find((i) => i.id === challengeId);
  if (!target || target.claimed || target.progress < target.target) {
    return { next: state, claimed: false, rewardRp: 0, cloutXp: 0 };
  }
  const streakMult = 1 + Math.min(0.5, (state.streakDays - 1) * 0.1);
  const rewardRp = Math.round(target.rewardRp * streakMult);
  const cloutXp = Math.round(target.cloutXp * streakMult);

  return {
    next: {
      ...state,
      items: state.items.map((i) =>
        i.id === challengeId ? { ...i, claimed: true } : i
      ),
    },
    claimed: true,
    rewardRp,
    cloutXp,
  };
}

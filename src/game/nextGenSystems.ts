import type {
  ActiveStreetContractState,
  FactionId,
  NabiloGramPost,
  NabiloGramTriggerKind,
  PoliceTacticalState,
  ProtagonistId,
  StreetRandomEvent,
  StreetRandomEventKind,
  TrioSynergyState,
  VehicleDamageState,
  VehicleDamageZone,
  ViralCloutState,
} from './types';

/* ==========================================================================
 * 1. REAL-TIME VEHICLE DAMAGE, DEFORMATION & CHAIN EXPLOSION ENGINE
 * ========================================================================== */

export function createInitialVehicleDamage(): VehicleDamageState {
  return {
    integrity: 100,
    zones: { front: 0, rear: 0, left: 0, right: 0 },
    puncturedTires: [false, false, false, false],
    headlightsBroken: [false, false],
    smokeStage: 'none',
    explosionCountdownSec: null,
    exploded: false,
    lastImpactSeverity: 0,
  };
}

export function resolveSmokeStage(integrity: number): VehicleDamageState['smokeStage'] {
  if (integrity <= 16) return 'fire';
  if (integrity <= 34) return 'heavy_smoke';
  if (integrity <= 58) return 'steam';
  return 'none';
}

export function applyVehicleImpactDamage(
  current: VehicleDamageState,
  impactForce: number,
  zone: VehicleDamageZone
): {
  next: VehicleDamageState;
  justBrokeHeadlight: boolean;
  justCaughtFire: boolean;
  damageApplied: number;
} {
  if (current.exploded) {
    return {
      next: current,
      justBrokeHeadlight: false,
      justCaughtFire: false,
      damageApplied: 0,
    };
  }

  const clampedForce = Math.max(0, impactForce);
  if (clampedForce < 1.2) {
    return {
      next: current,
      justBrokeHeadlight: false,
      justCaughtFire: false,
      damageApplied: 0,
    };
  }

  const damageApplied = Math.min(48, Math.round(clampedForce * 2.9));
  const nextIntegrity = Math.max(0, current.integrity - damageApplied);
  const nextZones = { ...current.zones };
  const zoneBump = clampedForce > 11 ? 2 : clampedForce > 4.5 ? 1 : 0.45;
  nextZones[zone] = Math.min(3, Number((nextZones[zone] + zoneBump).toFixed(2)));

  const nextHeadlights: [boolean, boolean] = [...current.headlightsBroken];
  let justBrokeHeadlight = false;
  if (zone === 'front' && nextZones.front >= 1.1) {
    if (!nextHeadlights[0]) {
      nextHeadlights[0] = true;
      justBrokeHeadlight = true;
    }
    if (nextZones.front >= 2.0 && !nextHeadlights[1]) {
      nextHeadlights[1] = true;
      justBrokeHeadlight = true;
    }
  }

  const prevSmoke = current.smokeStage;
  const nextSmoke = resolveSmokeStage(nextIntegrity);
  const justCaughtFire = prevSmoke !== 'fire' && nextSmoke === 'fire';
  const explosionCountdownSec =
    nextSmoke === 'fire'
      ? current.explosionCountdownSec ?? (nextIntegrity <= 5 ? 1.6 : 4.2)
      : current.explosionCountdownSec;

  return {
    next: {
      ...current,
      integrity: nextIntegrity,
      zones: nextZones,
      headlightsBroken: nextHeadlights,
      smokeStage: nextSmoke,
      explosionCountdownSec,
      lastImpactSeverity: clampedForce,
    },
    justBrokeHeadlight,
    justCaughtFire,
    damageApplied,
  };
}

export function applyTirePuncture(
  current: VehicleDamageState,
  tireIndices: (0 | 1 | 2 | 3)[]
): VehicleDamageState {
  const nextTires: [boolean, boolean, boolean, boolean] = [...current.puncturedTires];
  for (const idx of tireIndices) {
    nextTires[idx] = true;
  }
  const nextIntegrity = Math.max(8, current.integrity - tireIndices.length * 4);
  return {
    ...current,
    integrity: nextIntegrity,
    puncturedTires: nextTires,
    smokeStage: resolveSmokeStage(nextIntegrity),
  };
}

export function stepVehicleDamageTick(
  current: VehicleDamageState,
  dt: number
): { next: VehicleDamageState; triggeredExplosion: boolean } {
  if (current.exploded || current.explosionCountdownSec === null) {
    return { next: current, triggeredExplosion: false };
  }
  const rem = current.explosionCountdownSec - Math.max(0, dt);
  if (rem <= 0) {
    return {
      next: {
        ...current,
        integrity: 0,
        smokeStage: 'fire',
        explosionCountdownSec: 0,
        exploded: true,
      },
      triggeredExplosion: true,
    };
  }
  return {
    next: {
      ...current,
      integrity: Math.max(0, current.integrity - dt * 2.5),
      explosionCountdownSec: rem,
    },
    triggeredExplosion: false,
  };
}

export function getVehicleHandlingPenalty(damage: VehicleDamageState): {
  speedMultiplier: number;
  steeringPull: number;
  flatCount: number;
} {
  const flatCount = damage.puncturedTires.filter(Boolean).length;
  const leftFlats =
    (damage.puncturedTires[0] ? 1 : 0) + (damage.puncturedTires[2] ? 1 : 0);
  const rightFlats =
    (damage.puncturedTires[1] ? 1 : 0) + (damage.puncturedTires[3] ? 1 : 0);

  const engineFactor =
    damage.exploded
      ? 0
      : damage.integrity < 20
      ? 0.62
      : damage.integrity < 45
      ? 0.82
      : 1.0;
  const tireFactor = Math.max(0.42, 1 - flatCount * 0.14);
  const steeringPull = (rightFlats - leftFlats) * 0.18;

  return {
    speedMultiplier: Number((engineFactor * tireFactor).toFixed(3)),
    steeringPull,
    flatCount,
  };
}

/* ==========================================================================
 * 2. POLICE TACTICAL AI (WITNESS -> PURSUIT -> LKP SEARCH & RADIO)
 * ========================================================================== */

export function createInitialPoliceTacticalState(): PoliceTacticalState {
  return {
    phase: 'clear',
    witnessProgress: 0,
    witnessX: 0,
    witnessZ: 0,
    witnessDistrict: 'Monas',
    lastKnownX: null,
    lastKnownZ: null,
    searchRadius: 24,
    radioCallout: null,
    radioCalloutStamp: 0,
    spikeStripsHitCount: 0,
  };
}

export function resolvePoliceRadioCallout(
  wantedLevel: number,
  districtName: string,
  phase: PoliceTacticalState['phase']
): string {
  if (phase === 'witness_reporting') {
    return `110 Darurat: Saksi mata merekam insiden di ${districtName}, patroli mendekat.`;
  }
  if (phase === 'searching_lkp') {
    return `Unit 86: Suspek menghilang dari visual sekitar ${districtName}. Sisir radius LKP!`;
  }
  switch (Math.max(1, Math.min(5, Math.floor(wantedLevel)))) {
    case 1:
      return `Patwal 04: Pelanggaran di ${districtName}, lakukan pengejaran motor.`;
    case 2:
      return `Patroli 12: Suspek melawan di ${districtName}, izinkan manuver PIT!`;
    case 3:
      return `Komando Metro: Pasang barikade dan paku ranjau di jalur keluar ${districtName}!`;
    case 4:
      return `Brimob Taktis: Kerahkan Barracuda ke sektor ${districtName}, target bersenjata!`;
    default:
      return `Elang-1 (Heli): Lampu sorot mengunci suspek di ${districtName}. Penyekatan total!`;
  }
}

export function triggerWitnessCrimeReport(
  current: PoliceTacticalState,
  x: number,
  z: number,
  districtName: string,
  currentWantedLevel: number,
  nowMs: number = Date.now()
): PoliceTacticalState {
  if (currentWantedLevel >= 1) {
    return {
      ...current,
      phase: 'active_pursuit',
      lastKnownX: x,
      lastKnownZ: z,
      searchRadius: 22 + currentWantedLevel * 7,
      radioCallout: resolvePoliceRadioCallout(
        currentWantedLevel,
        districtName,
        'active_pursuit'
      ),
      radioCalloutStamp: nowMs,
    };
  }
  return {
    ...current,
    phase: 'witness_reporting',
    witnessProgress: Math.min(100, Math.max(current.witnessProgress, 24)),
    witnessX: x,
    witnessZ: z,
    witnessDistrict: districtName,
    radioCallout: resolvePoliceRadioCallout(1, districtName, 'witness_reporting'),
    radioCalloutStamp: nowMs,
  };
}

export function stepPoliceTacticalState(
  current: PoliceTacticalState,
  params: {
    dt: number;
    wantedLevel: number;
    hasLineOfSight: boolean;
    playerX: number;
    playerZ: number;
    districtName: string;
    nowMs?: number;
  }
): {
  next: PoliceTacticalState;
  escalateToStarOne: boolean;
} {
  const { dt, wantedLevel, hasLineOfSight, playerX, playerZ, districtName } = params;
  const nowMs = params.nowMs ?? Date.now();

  if (wantedLevel <= 0) {
    if (current.phase === 'witness_reporting') {
      const distFromWitness = Math.hypot(
        playerX - current.witnessX,
        playerZ - current.witnessZ
      );
      if (distFromWitness > 34) {
        return {
          next: {
            ...createInitialPoliceTacticalState(),
            radioCallout: 'Saksi kehilangan jejak. Area kembali aman.',
            radioCalloutStamp: nowMs,
          },
          escalateToStarOne: false,
        };
      }
      const nextProg = current.witnessProgress + dt * 28;
      if (nextProg >= 100) {
        return {
          next: {
            ...current,
            phase: 'active_pursuit',
            witnessProgress: 100,
            lastKnownX: playerX,
            lastKnownZ: playerZ,
            searchRadius: 26,
            radioCallout: resolvePoliceRadioCallout(1, districtName, 'active_pursuit'),
            radioCalloutStamp: nowMs,
          },
          escalateToStarOne: true,
        };
      }
      return {
        next: { ...current, witnessProgress: nextProg },
        escalateToStarOne: false,
      };
    }

    if (current.phase !== 'clear') {
      return {
        next: createInitialPoliceTacticalState(),
        escalateToStarOne: false,
      };
    }
    return { next: current, escalateToStarOne: false };
  }

  if (hasLineOfSight) {
    const phaseChanged = current.phase !== 'active_pursuit';
    return {
      next: {
        ...current,
        phase: 'active_pursuit',
        witnessProgress: 0,
        lastKnownX: playerX,
        lastKnownZ: playerZ,
        searchRadius: 22 + wantedLevel * 7,
        radioCallout: phaseChanged
          ? resolvePoliceRadioCallout(wantedLevel, districtName, 'active_pursuit')
          : current.radioCallout,
        radioCalloutStamp: phaseChanged ? nowMs : current.radioCalloutStamp,
      },
      escalateToStarOne: false,
    };
  }

  const phaseChanged = current.phase !== 'searching_lkp';
  return {
    next: {
      ...current,
      phase: 'searching_lkp',
      lastKnownX: current.lastKnownX ?? playerX,
      lastKnownZ: current.lastKnownZ ?? playerZ,
      searchRadius: Math.max(18, (current.searchRadius || 28) - dt * 0.45),
      radioCallout: phaseChanged
        ? resolvePoliceRadioCallout(wantedLevel, districtName, 'searching_lkp')
        : current.radioCallout,
      radioCalloutStamp: phaseChanged ? nowMs : current.radioCalloutStamp,
    },
    escalateToStarOne: false,
  };
}

/* ==========================================================================
 * 3. LIVING JAKARTA RANDOM STREET EVENTS DIRECTOR
 * ========================================================================== */

interface StreetEventTemplate {
  kind: StreetRandomEventKind;
  title: string;
  subtitle: string;
  districtId: string;
  districtName: string;
  x: number;
  z: number;
  rewardRp: number;
  cloutXp: number;
  faction: FactionId;
}

export const STREET_RANDOM_EVENTS_CATALOG: StreetEventTemplate[] = [
  {
    kind: 'begal_rescue',
    title: 'Driver Ojol Dihadang Begal Malam',
    subtitle: 'Bantu driver ojol di tepi jalan Sudirman sebelum motornya dirampas.',
    districtId: 'sudirman',
    districtName: 'Koridor Sudirman - Thamrin',
    x: 8,
    z: -42,
    rewardRp: 125000,
    cloutXp: 45,
    faction: 'rakyat',
  },
  {
    kind: 'street_race_challenge',
    title: 'Tantangan Drift Liar Blok M',
    subtitle: 'Pembalap malam Melawai menantang adu kecepatan di tikungan bundaran.',
    districtId: 'blok_m',
    districtName: 'Terminal Blok M & Melawai',
    x: 10,
    z: 48,
    rewardRp: 175000,
    cloutXp: 65,
    faction: 'jalanan',
  },
  {
    kind: 'vip_convoy',
    title: 'Konvoi Koper VIP Sindikat SCBD',
    subtitle: 'Cegat kiriman dana kilat di bawah lampu neon SCBD untuk bonus besar.',
    districtId: 'scbd',
    districtName: 'Kawasan Elit SCBD',
    x: -44,
    z: -36,
    rewardRp: 240000,
    cloutXp: 75,
    faction: 'sindikat',
  },
  {
    kind: 'gang_brawl',
    title: 'Keributan Pasar Tanah Abang',
    subtitle: 'Lerai preman pemalak kios dan amankan jalur dagang warga.',
    districtId: 'tanah_abang',
    districtName: 'Pasar Tanah Abang',
    x: -42,
    z: 14,
    rewardRp: 140000,
    cloutXp: 50,
    faction: 'rakyat',
  },
  {
    kind: 'stolen_motor',
    title: 'Kejaran Curanmor Kota Tua',
    subtitle: 'Hentikan pencuri motor yang kabur melintasi kanal Kota Tua.',
    districtId: 'kota_tua',
    districtName: 'Kota Tua & Glodok',
    x: 44,
    z: 16,
    rewardRp: 155000,
    cloutXp: 55,
    faction: 'jalanan',
  },
  {
    kind: 'vip_convoy',
    title: 'Konvoi Bisnis Pondok Indah',
    subtitle: 'Kawal atau rampas koper transaksi sindikat di bulevar Pondok Indah.',
    districtId: 'pondok_indah',
    districtName: 'Pondok Indah Golf & Mall',
    x: -168,
    z: 176,
    rewardRp: 260000,
    cloutXp: 80,
    faction: 'sindikat',
  },
  {
    kind: 'street_race_challenge',
    title: 'Adu Kecepatan Kemang Selatan',
    subtitle: 'Pembalap malam Jaksel menantang sprint liar di koridor Kemang.',
    districtId: 'kemang_selatan',
    districtName: 'Kemang Selatan Creative Hub',
    x: 34,
    z: 174,
    rewardRp: 195000,
    cloutXp: 70,
    faction: 'jalanan',
  },
  {
    kind: 'stolen_motor',
    title: 'Begalan Kurir Kelapa Gading',
    subtitle: 'Cegat penadah motor curian di depan Boulevard Kelapa Gading.',
    districtId: 'kelapa_gading',
    districtName: 'Kelapa Gading Boulevard',
    x: 176,
    z: 36,
    rewardRp: 185000,
    cloutXp: 65,
    faction: 'jalanan',
  },
  {
    kind: 'gang_brawl',
    title: 'Pengamanan Pantai PIK 2',
    subtitle: 'Bubarkan preman pengganggu pengunjung bulevar pesisir PIK Utara.',
    districtId: 'pantai_pik_utara',
    districtName: 'PIK 2 Pesisir Utara',
    x: -174,
    z: -56,
    rewardRp: 210000,
    cloutXp: 75,
    faction: 'rakyat',
  },
];

export function spawnNextStreetRandomEvent(
  eventCounter: number,
  excludeKind?: StreetRandomEventKind,
  playerX?: number,
  playerZ?: number
): StreetRandomEvent {
  const pool = excludeKind
    ? STREET_RANDOM_EVENTS_CATALOG.filter((e) => e.kind !== excludeKind)
    : STREET_RANDOM_EVENTS_CATALOG;
  let candidatePool = pool;
  if (playerX !== undefined && playerZ !== undefined) {
    const nearby = pool.filter(
      (e) => Math.hypot(e.x - playerX, e.z - playerZ) <= 165
    );
    if (nearby.length > 0) {
      candidatePool = nearby;
    }
  }
  const tpl =
    candidatePool[Math.abs(eventCounter) % candidatePool.length] ||
    STREET_RANDOM_EVENTS_CATALOG[0];
  return {
    id: `sev_${tpl.kind}_${eventCounter}`,
    ...tpl,
    remainingSec: 85,
    totalDurationSec: 85,
    status: 'active',
  };
}

const PASSENGER_FARES_DESTINATIONS: {
  label: string;
  districtId: string;
  x: number;
  z: number;
}[] = [
  { label: 'Pondok Indah Mall', districtId: 'pondok_indah', x: -166, z: 168 },
  { label: 'Kemang Village Hub', districtId: 'kemang_selatan', x: 30, z: 170 },
  { label: 'Boulevard Kelapa Gading', districtId: 'kelapa_gading', x: 168, z: 38 },
  { label: 'PIK 2 Beachfront', districtId: 'pantai_pik_utara', x: -168, z: -60 },
  { label: 'Bundaran HI', districtId: 'sudirman', x: -12, z: -48 },
  { label: 'SCBD Equity Tower', districtId: 'scbd', x: -42, z: -34 },
  { label: 'Terminal Blok M', districtId: 'blok_m', x: -14, z: 44 },
  { label: 'Stasiun Kota Tua', districtId: 'kota_tua', x: 42, z: 18 },
];

export function createQuickPassengerFare(
  playerX: number,
  playerZ: number,
  vehicleLabel: string
): ActiveStreetContractState {
  const qualified = PASSENGER_FARES_DESTINATIONS.filter(
    (d) => Math.hypot(d.x - playerX, d.z - playerZ) >= 65
  );
  const candidates = qualified.length > 0 ? qualified : PASSENGER_FARES_DESTINATIONS;
  const pickIdx =
    Math.floor(Math.abs(playerX * 7 + playerZ * 13)) % candidates.length;
  const dest = candidates[pickIdx] || PASSENGER_FARES_DESTINATIONS[0];
  const dist = Math.hypot(dest.x - playerX, dest.z - playerZ);
  const rewardRp = Math.max(
    110000,
    Math.min(260000, Math.round((85000 + dist * 650) / 5000) * 5000)
  );
  const totalTimeSec = Math.max(65, Math.min(110, Math.round(45 + dist * 0.28)));

  return {
    id: `contract_fare_${Date.now()}`,
    kind: 'ojol_delivery',
    title: `Tarikan Cepat (${vehicleLabel})`,
    subtitle: `Antar penumpang ke ${dest.label}`,
    targetX: dest.x,
    targetZ: dest.z,
    districtId: dest.districtId,
    rewardRp,
    timeRemainingSec: totalTimeSec,
    totalTimeSec,
  };
}

export function isPlayerWithinStreetEvent(
  event: StreetRandomEvent | null,
  playerX: number,
  playerZ: number,
  triggerRadius: number = 12
): boolean {
  if (!event || event.status !== 'active') return false;
  return Math.hypot(playerX - event.x, playerZ - event.z) <= triggerRadius;
}

/* ==========================================================================
 * 4. NABILOGRAM VIRAL SOCIAL FEED & TRIO SYNERGY
 * ========================================================================== */

export function computeViralCloutState(xp: number): ViralCloutState {
  const safeXp = Math.max(0, Math.floor(xp));
  const level = Math.floor(safeXp / 120) + 1;
  const nextLevelXp = level * 120;
  const tierTitle =
    level >= 8
      ? 'Ikon Viral Jakarta'
      : level >= 5
      ? 'Seleb Jalanan SCBD'
      : level >= 3
      ? 'Trending Ibu Kota'
      : 'Pendatang Baru FYP';
  const sponsorBonusPercent = Math.min(35, (level - 1) * 5);

  return {
    xp: safeXp,
    level,
    tierTitle,
    nextLevelXp,
    sponsorBonusPercent,
  };
}

export function createSeedNabiloGramPosts(): NabiloGramPost[] {
  const now = Date.now();
  return [
    {
      id: 'ng_seed_1',
      authorHandle: '@jakarta.senja.cam',
      authorTag: 'Warga Sudirman',
      districtName: 'Koridor Sudirman - Thamrin',
      triggerKind: 'drift_stunt',
      snapshotDataUrl: null,
      caption:
        'Senja basah di Sudirman baru aja pecah! Lampu neon mantul di aspal kayak film layar lebar, denger-denger geng Nabilo lagi keluar garasi.',
      hashtags: ['#ViceJakarta', '#SudirmanSenja', '#NabiloGram'],
      comments: [
        {
          id: 'c_s1',
          handle: '@ojol_ganteng99',
          text: 'Gue tadi liat Garuda GT-X ngebut abis hujan, gokil parah suaranya!',
          likes: 184,
        },
        {
          id: 'c_s2',
          handle: '@anakscbd.id',
          text: 'Pantesan macet di Semanggi, ternyata lagi pada syuting balap liar wkwk',
          likes: 92,
        },
      ],
      views: 14820,
      likes: 2340,
      isLiked: false,
      boosted: false,
      createdAtMs: now - 180_000,
      source: 'local',
    },
    {
      id: 'ng_seed_2',
      authorHandle: '@infopatroli.jkt',
      authorTag: 'Pantauan Lalu Lintas',
      districtName: 'Medan Merdeka & Monas',
      triggerKind: 'police_chase',
      snapshotDataUrl: null,
      caption:
        'Siaga malam: Unit Patwal dan Helikopter Elang-1 mulai patroli ketat sekitar Monas sampai SCBD. Warga harap tetap waspada.',
      hashtags: ['#InfoJakarta', '#PatroliMalam', '#Monas'],
      comments: [
        {
          id: 'c_s3',
          handle: '@warung_mba_yanti',
          text: 'Mampir dulu sini bang, kopi panas sama indomie telor udah siap 24 jam!',
          likes: 312,
        },
      ],
      views: 9410,
      likes: 1105,
      isLiked: false,
      boosted: false,
      createdAtMs: now - 420_000,
      source: 'local',
    },
  ];
}

export function buildLocalViralPost(params: {
  id: string;
  triggerKind: NabiloGramTriggerKind;
  districtName: string;
  protagonistName: string;
  wantedLevel: number;
  vehicleName?: string;
  snapshotDataUrl: string | null;
  summaryNote?: string;
}): NabiloGramPost {
  const {
    id,
    triggerKind,
    districtName,
    protagonistName,
    wantedLevel,
    vehicleName,
    snapshotDataUrl,
    summaryNote,
  } = params;

  const presets: Record<
    NabiloGramTriggerKind,
    {
      handle: string;
      tag: string;
      caption: string;
      hashtags: string[];
      comments: { handle: string; text: string; likes: number }[];
      baseViews: number;
    }
  > = {
    drift_stunt: {
      handle: '@melawai.spotter',
      tag: 'Spotter Mobil',
      caption: `${protagonistName} baru aja nge-drift miring pake ${
        vehicleName || 'mobil kenceng'
      } di aspal basah ${districtName}! Asap ban nutup lampu jalan!`,
      hashtags: ['#DriftJakarta', '#ViceJakarta', '#FYPJKT'],
      comments: [
        {
          handle: '@bengkel_blokm',
          text: 'Ban langsung botak tuh, mampir garasi buat pasang nitro lagi bro!',
          likes: 214,
        },
        {
          handle: '@scbd_vibes',
          text: 'Kameramen kebal tabrak emang selalu di garis depan wkwk',
          likes: 158,
        },
      ],
      baseViews: 24500,
    },
    chain_explosion: {
      handle: '@breaking.jkt24',
      tag: 'Warga di Lokasi',
      caption: `PARAH!! Ledakan berantai baru aja ngeguncang ${districtName}! Api ngebul tinggi banget, orang-orang langsung lari sambil ngerekam!`,
      hashtags: ['#JakartaHeboh', '#Ledakan', '#ViralSekarang'],
      comments: [
        {
          handle: '@doni_glodok',
          text: 'Kaca toko gue sampe bergetar, gila ini ulah siapa lagi?!',
          likes: 482,
        },
        {
          handle: '@patwal_watch',
          text: `Sirene udah bunyi bintang ${Math.max(1, wantedLevel)}, siap-siap Barracuda turun!`,
          likes: 309,
        },
      ],
      baseViews: 68400,
    },
    police_chase: {
      handle: '@ojol.dashcam',
      tag: 'Dashcam Ojol',
      caption: `LIVE dari ${districtName}: ${protagonistName} lagi dikejar polisi bintang ${Math.max(
        1,
        wantedLevel
      )}! Barikade sama paku ranjau sampe diterobos!`,
      hashtags: ['#KejaranPolisi', '#JakartaMalam', '#NabiloGram'],
      comments: [
        {
          handle: '@raka_fanclub',
          text: 'Awas helikopter sorot di atas bang, ngumpet bawah tol Semanggi!',
          likes: 375,
        },
        {
          handle: '@netizen_jaksel',
          text: 'Berasa nonton film action langsung depan kantor sumpah!',
          likes: 190,
        },
      ],
      baseViews: 51200,
    },
    police_escape: {
      handle: '@underground.jkt',
      tag: 'Komunitas Malam',
      caption: `Hantu aspal! ${protagonistName} barusan berhasil lolos dari penyekatan polisi di ${districtName} tanpa jejak!`,
      hashtags: ['#LolosPenyekatan', '#LegendaJakarta', '#ViceJakarta'],
      comments: [
        {
          handle: '@kirana_net',
          text: 'Sinyal radar mati total, aparat bingung nyari LKP wkwk',
          likes: 295,
        },
      ],
      baseViews: 41900,
    },
    street_event: {
      handle: '@warga.jakarta.asli',
      tag: 'Saksi Jalanan',
      caption:
        summaryNote ||
        `Respect buat ${protagonistName}! Baru aja beresin insiden jalanan di ${districtName}, warga langsung sorak!`,
      hashtags: ['#PahlawanJalanan', '#JakartaHidup', '#FYP'],
      comments: [
        {
          handle: '@bang_ucup_ojol',
          text: 'Makasih banyak bang, jalanan jadi aman lagi malam ini!',
          likes: 412,
        },
      ],
      baseViews: 32600,
    },
    heist_complete: {
      handle: '@bursa.bajsa.news',
      tag: 'Breaking Ekonomi',
      caption: `GEGER IBU KOTA! Operasi Grand Heist di ${districtName} sukses besar — bursa saham BAJSA langsung bergejolak tajam!`,
      hashtags: ['#GrandHeistJKT', '#BAJSA', '#BreakingNews'],
      comments: [
        {
          handle: '@trader_sudirman',
          text: 'Saham rival langsung terbang, yang beli sebelum heist auto tajir!',
          likes: 890,
        },
        {
          handle: '@detektif_netizen',
          text: 'Pasti ulah trio Nabilo, Raka, sama Kirana ini mah!',
          likes: 641,
        },
      ],
      baseViews: 128000,
    },
    warung_viral: {
      handle: '@kuliner.tengahmalam',
      tag: 'Food Vlogger JKT',
      caption: `Nongkrong santai bareng ${protagonistName} di Warung 24 Jam ${districtName}. Mie goreng + kopi susu bikin energi balik 100%!`,
      hashtags: ['#WarungJakarta', '#KulinerMalam', '#Nongkrong'],
      comments: [
        {
          handle: '@pecinta_gorengan',
          text: 'Spill lokasinya dong, keliatan syahdu banget abis hujan!',
          likes: 164,
        },
      ],
      baseViews: 18900,
    },
    manual_snap: {
      handle: `@${protagonistName.toLowerCase()}.official`,
      tag: 'Protagonis',
      caption:
        summaryNote ||
        `Suasana langsung dari ${districtName}. Langit tropis, neon nyala, Jakarta malam ini milik kita.`,
      hashtags: ['#SanNabilo', '#ViceJakarta', '#ShotOnNabiloPhone'],
      comments: [
        {
          handle: '@raka.tanahabang',
          text: 'Keren fotonya bro, habis ini merapat ke garasi Blok M!',
          likes: 128,
        },
        {
          handle: '@kirana.glodok',
          text: 'Lighting aspal basahnya dapet banget, auto masuk FYP!',
          likes: 145,
        },
      ],
      baseViews: 15200,
    },
  };

  const p = presets[triggerKind];
  return {
    id,
    authorHandle: p.handle,
    authorTag: p.tag,
    districtName,
    triggerKind,
    snapshotDataUrl,
    caption: p.caption,
    hashtags: p.hashtags,
    comments: p.comments.map((c, idx) => ({
      id: `${id}_c${idx}`,
      ...c,
    })),
    views: p.baseViews + Math.floor(Math.random() * 4200),
    likes: Math.round(p.baseViews * 0.14),
    isLiked: false,
    boosted: false,
    createdAtMs: Date.now(),
    source: 'local',
  };
}

export function createInitialTrioSynergy(): TrioSynergyState {
  return {
    nabiloRaka: 38,
    nabiloKirana: 42,
    rakaKirana: 34,
    lastBanterLine: null,
    lastBanterSpeaker: null,
  };
}

const SYNERGY_BANTER: Record<ProtagonistId, string[]> = {
  nabilo: [
    'Nabilo: "Raka, jaga sisi kanan—Kirana, siapin jalur keluar bebas CCTV!"',
    'Nabilo: "Kalau kita bertiga kompak, satu Jakarta nggak bakal bisa ngehentikan kita."',
  ],
  raka: [
    'Raka: "Santai Bil, barikade depan biar gue yang tabrak duluan!"',
    'Raka: "Habis urusan ini kelar, kita ngopi bareng di Warung Blok M."',
  ],
  kirana: [
    'Kirana: "Jaringan radio aparat udah gue sadap. Semua gerak mereka kebaca di radar."',
    'Kirana: "Nabilo, Raka—koneksi tim naik! Waktu cooldown kemampuan kita makin cepet."',
  ],
};

export function incrementTrioSynergy(
  current: TrioSynergyState,
  activeProtagonist: ProtagonistId,
  amount: number = 8
): TrioSynergyState {
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  const banterPool = SYNERGY_BANTER[activeProtagonist];
  const line =
    banterPool[
      (current.nabiloRaka + current.nabiloKirana + amount) % banterPool.length
    ];

  return {
    nabiloRaka: clamp(
      current.nabiloRaka + (activeProtagonist === 'kirana' ? Math.ceil(amount * 0.5) : amount)
    ),
    nabiloKirana: clamp(
      current.nabiloKirana + (activeProtagonist === 'raka' ? Math.ceil(amount * 0.5) : amount)
    ),
    rakaKirana: clamp(
      current.rakaKirana + (activeProtagonist === 'nabilo' ? Math.ceil(amount * 0.5) : amount)
    ),
    lastBanterLine: line,
    lastBanterSpeaker:
      activeProtagonist === 'raka'
        ? 'Raka'
        : activeProtagonist === 'kirana'
        ? 'Kirana'
        : 'Nabilo',
  };
}

export function computeTrioSynergyPerks(synergy: TrioSynergyState): {
  averageBond: number;
  heistBonusPercent: number;
  fokusRechargeBonus: number;
  tierLabel: string;
} {
  const averageBond = Math.round(
    (synergy.nabiloRaka + synergy.nabiloKirana + synergy.rakaKirana) / 3
  );
  const heistBonusPercent = averageBond >= 80 ? 15 : averageBond >= 55 ? 8 : 3;
  const fokusRechargeBonus = averageBond >= 80 ? 1.4 : averageBond >= 55 ? 1.2 : 1.0;
  const tierLabel =
    averageBond >= 80
      ? 'Ikatan Legendaris'
      : averageBond >= 55
      ? 'Kru Solid'
      : 'Rekan Lapangan';

  return {
    averageBond,
    heistBonusPercent,
    fokusRechargeBonus,
    tierLabel,
  };
}

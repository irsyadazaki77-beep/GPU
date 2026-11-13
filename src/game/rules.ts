export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type OriginArchetype = 'anak_jalanan' | 'mantan_kurir' | 'teknisi_glodok';

export type FactionId = 'jalanan' | 'sindikat' | 'rakyat';

export type WeatherMode = 'senja' | 'malam' | 'siang' | 'hujan';

export const WEATHER_MODES: {
  id: WeatherMode;
  label: string;
  skyHex: number;
  fogDensity: number;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
}[] = [
  {
    id: 'senja',
    label: 'Senja Emas Jakarta',
    skyHex: 0x161f33,
    fogDensity: 0.0028,
    sunHex: 0xffb067,
    sunIntensity: 1.35,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e2430,
    hemiIntensity: 0.62,
  },
  {
    id: 'malam',
    label: 'Malam Neon Sudirman',
    skyHex: 0x070b14,
    fogDensity: 0.0032,
    sunHex: 0x60a5fa,
    sunIntensity: 0.72,
    hemiSkyHex: 0x38bdf8,
    hemiGroundHex: 0x090d16,
    hemiIntensity: 0.48,
  },
  {
    id: 'siang',
    label: 'Siang Terik Khatulistiwa',
    skyHex: 0x2563eb,
    fogDensity: 0.0022,
    sunHex: 0xfff7ed,
    sunIntensity: 1.48,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.68,
  },
  {
    id: 'hujan',
    label: 'Hujan Monsun Deras',
    skyHex: 0x0f172a,
    fogDensity: 0.0042,
    sunHex: 0x94a3b8,
    sunIntensity: 0.85,
    hemiSkyHex: 0x64748b,
    hemiGroundHex: 0x0b0f19,
    hemiIntensity: 0.54,
  },
];

export type WeaponId =
  | 'fist'
  | 'golok'
  | 'pistol'
  | 'rifle'
  | 'mercon'
  | 'pasopati'
  | 'gatotkaca';

export type RadioStationId = 'off' | 'prambors' | 'koplo' | 'synth_scbd';

export type OutfitId = 'jaket_jawara' | 'jas_scbd' | 'rompi_taktis' | 'hoodie_siber';

export interface OutfitSpec {
  id: OutfitId;
  name: string;
  subtitle: string;
  jacketHex: number;
  pantsHex: number;
  capHex: number;
}

export const NABILO_OUTFITS: OutfitSpec[] = [
  {
    id: 'jaket_jawara',
    name: 'Jaket Jawara Tanah Abang',
    subtitle: 'Setelan Klasik Merah-Hitam Nabilo',
    jacketHex: 0xdc2626,
    pantsHex: 0x1e293b,
    capHex: 0x111827,
  },
  {
    id: 'jas_scbd',
    name: 'Jas Eksekutif Komisaris SCBD',
    subtitle: 'Setelan Jas Emas-Safir Konglomerat',
    jacketHex: 0x1e3a8a,
    pantsHex: 0x0f172a,
    capHex: 0xfacc15,
  },
  {
    id: 'rompi_taktis',
    name: 'Rompi Taktis Pasukan Khusus',
    subtitle: 'Armor Kevlar Hijau Rimba & Baret',
    jacketHex: 0x15803d,
    pantsHex: 0x1c1917,
    capHex: 0x991b1b,
  },
  {
    id: 'hoodie_siber',
    name: 'Jaket Neon Siber Kemayoran',
    subtitle: 'Gaya Peretas Malam Ungu-Sian',
    jacketHex: 0x7e22ce,
    pantsHex: 0x090d16,
    capHex: 0x22d3ee,
  },
];

export interface RadioStationSpec {
  id: RadioStationId;
  name: string;
  freq: string;
  genre: string;
}

export const RADIO_STATIONS: RadioStationSpec[] = [
  { id: 'off', name: 'Radio Mati', freq: '-', genre: 'Hening' },
  {
    id: 'prambors',
    name: 'Kemayoran Hits FM',
    freq: '102.2 FM',
    genre: 'Beat Pop & Funk Jakarta',
  },
  {
    id: 'koplo',
    name: 'Pantura Koplo Bass',
    freq: '98.8 FM',
    genre: 'Dangdut Koplo Angkot',
  },
  {
    id: 'synth_scbd',
    name: 'SCBD Nightwave',
    freq: '106.4 FM',
    genre: 'Cyberpunk Sudirman Synth',
  },
];

export interface WeaponSpec {
  id: WeaponId;
  key: string;
  name: string;
  roleClue: string;
  damage: number;
  range: number;
  cooldown: number;
  ammoCost: number;
  maxAmmo: number;
  isMelee: boolean;
  splashRadius: number;
  price: number;
}

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

export type VehicleType =
  | 'bajaj'
  | 'ojek'
  | 'angkot'
  | 'sedan'
  | 'metromini'
  | 'transjakarta'
  | 'polisi'
  | 'barracuda'
  | 'heli'
  | 'supercar'
  | 'vtol_jet';

export interface VehicleSpec {
  type: VehicleType;
  name: string;
  subtitle: string;
  maxSpeed: number;
  acceleration: number;
  turnRate: number;
  maxHp: number;
  colorHex: number;
  accentHex: number;
  radius: number;
  isAircraft?: boolean;
}

export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  bajaj: {
    type: 'bajaj',
    name: 'Bajaj Oranye BBG',
    subtitle: 'Lincah di Gang Sempit · Putar Balik Cepat',
    maxSpeed: 22,
    acceleration: 16,
    turnRate: 3.4,
    maxHp: 140,
    colorHex: 0xea580c,
    accentHex: 0xfef08a,
    radius: 1.8,
  },
  ojek: {
    type: 'ojek',
    name: 'Motor Ojek SanNabilo',
    subtitle: 'Akselerasi Kilat · Selap-Selip Macet',
    maxSpeed: 31,
    acceleration: 25,
    turnRate: 3.8,
    maxHp: 100,
    colorHex: 0x16a34a,
    accentHex: 0x111827,
    radius: 1.3,
  },
  angkot: {
    type: 'angkot',
    name: 'Angkot Mikrolet M-15',
    subtitle: 'Raja Ngetem Tanah Abang · Audio Bass Jalanan',
    maxSpeed: 26,
    acceleration: 19,
    turnRate: 3.1,
    maxHp: 190,
    colorHex: 0x0284c7,
    accentHex: 0xe0f2fe,
    radius: 2.1,
  },
  sedan: {
    type: 'sedan',
    name: 'Sedan Sport Sudirman',
    subtitle: 'Kecepatan Tinggi · Stabil di Jalan Protokol',
    maxSpeed: 36,
    acceleration: 22,
    turnRate: 2.7,
    maxHp: 220,
    colorHex: 0xdc2626,
    accentHex: 0x1e293b,
    radius: 2.3,
  },
  metromini: {
    type: 'metromini',
    name: 'Bus Kota Raja Jalanan',
    subtitle: 'Bodi Baja Tebal · Tabrakan Beruntun',
    maxSpeed: 24,
    acceleration: 13,
    turnRate: 2.0,
    maxHp: 380,
    colorHex: 0x2563eb,
    accentHex: 0xf97316,
    radius: 3.0,
  },
  polisi: {
    type: 'polisi',
    name: 'Patroli Sabhara Cepat',
    subtitle: 'Sirine Aktif · Mesin Interseptor',
    maxSpeed: 34,
    acceleration: 24,
    turnRate: 2.9,
    maxHp: 260,
    colorHex: 0x1e293b,
    accentHex: 0x3b82f6,
    radius: 2.3,
  },
  transjakarta: {
    type: 'transjakarta',
    name: 'Bus TransNabilo Koridor 1',
    subtitle: 'Raja Jalur Busway Sudirman - Kota (Tahap 3)',
    maxSpeed: 29,
    acceleration: 18,
    turnRate: 2.2,
    maxHp: 450,
    colorHex: 0x1d4ed8,
    accentHex: 0xf8fafc,
    radius: 3.1,
  },
  barracuda: {
    type: 'barracuda',
    name: 'Rantis Taktis Barracuda',
    subtitle: 'Lapis Baja Anti-Peluru · Penggilas Barikade (Tahap 3)',
    maxSpeed: 33,
    acceleration: 23,
    turnRate: 2.6,
    maxHp: 540,
    colorHex: 0x334155,
    accentHex: 0xf59e0b,
    radius: 2.7,
  },
  heli: {
    type: 'heli',
    name: 'Helikopter Nabilo-Air',
    subtitle: 'Lintas Langit Jakarta · Spasi Naik / C Turun',
    maxSpeed: 42,
    acceleration: 28,
    turnRate: 2.6,
    maxHp: 320,
    colorHex: 0xf59e0b,
    accentHex: 0x0f172a,
    radius: 2.6,
    isAircraft: true,
  },
  supercar: {
    type: 'supercar',
    name: 'Hypercar Garuda GT-X',
    subtitle: 'Aerodinamika V12 Nusantara · Raja Aspal Tahap 4',
    maxSpeed: 46,
    acceleration: 32,
    turnRate: 3.1,
    maxHp: 280,
    colorHex: 0xdc2626,
    accentHex: 0xfacc15,
    radius: 2.2,
  },
  vtol_jet: {
    type: 'vtol_jet',
    name: 'Jet VTOL Elang Nusantara',
    subtitle: 'Supersonik Stealth Udara · Spasi Naik / C Turun (Fase 5)',
    maxSpeed: 54,
    acceleration: 38,
    turnRate: 2.9,
    maxHp: 420,
    colorHex: 0x0f172a,
    accentHex: 0x38bdf8,
    radius: 2.8,
    isAircraft: true,
  },
};

export interface PropertySpec {
  id: string;
  name: string;
  districtName: string;
  price: number;
  incomePerTick: number;
  description: string;
}

export const JAKARTA_PROPERTIES: PropertySpec[] = [
  {
    id: 'prop_warung_blokm',
    name: 'Jaringan Warung Pecel Lele Blok M',
    districtName: 'Terminal Blok M',
    price: 150000,
    incomePerTick: 12000,
    description: 'Setoran malam rutin dari 5 tenda kuliner ramai di Melawai.',
  },
  {
    id: 'prop_angkot_tanahabang',
    name: 'Koperasi Angkot & Ojek Tanah Abang',
    districtName: 'Pasar Tanah Abang',
    price: 350000,
    incomePerTick: 28000,
    description: 'Menguasai seluruh trayek mikrolet dan pangkalan kurir pasar.',
  },
  {
    id: 'prop_logistik_priok',
    name: 'Gudang Kontainer Tanjung Priok',
    districtName: 'Pelabuhan Tanjung Priok',
    price: 650000,
    incomePerTick: 55000,
    description: 'Arus bongkar muat kargo internasional di dermaga utara.',
  },
  {
    id: 'prop_penthouse_scbd',
    name: 'Menara Investasi & Helipad SCBD',
    districtName: 'SCBD & Bundaran HI',
    price: 1200000,
    incomePerTick: 110000,
    description: 'Markas konglomerat finansial dengan dividen pasif tertinggi.',
  },
  {
    id: 'prop_marina_ancol',
    name: 'Dermaga Yacht & Klub Pantai Ancol-PIK',
    districtName: 'Pesisir Ancol & PIK',
    price: 1800000,
    incomePerTick: 165000,
    description: 'Pajak dermaga eksklusif dan hiburan malam pesisir utara (Tahap 3).',
  },
  {
    id: 'prop_stasiun_halim',
    name: 'Konsesi Logistik Kereta Cepat Halim',
    districtName: 'Stasiun Terpadu Halim',
    price: 2500000,
    incomePerTick: 240000,
    description: 'Kendali penuh jalur kargo kilat antarkota Jakarta-Bandung (Tahap 3).',
  },
];

export interface DistrictZone {
  id: string;
  name: string;
  subtitle: string;
  centerX: number;
  centerZ: number;
  radius: number;
}

export const JAKARTA_DISTRICTS: DistrictZone[] = [
  {
    id: 'monas',
    name: 'Medan Merdeka & Monas',
    subtitle: 'Pusat Kekuasaan & Tugu Emas',
    centerX: 0,
    centerZ: 0,
    radius: 30,
  },
  {
    id: 'sudirman',
    name: 'Koridor Sudirman - Thamrin',
    subtitle: 'Distrik Finansial & Gedung Pencakar Langit',
    centerX: 0,
    centerZ: -58,
    radius: 34,
  },
  {
    id: 'tanah_abang',
    name: 'Pasar Tanah Abang & Kebon Kacang',
    subtitle: 'Labirin Pasar Grosir & Markas Jawara',
    centerX: -56,
    centerZ: 12,
    radius: 32,
  },
  {
    id: 'kota_tua',
    name: 'Kawasan Kota Tua & Glodok',
    subtitle: 'Gedung Kolonial & Bursa Elektronik',
    centerX: 56,
    centerZ: 15,
    radius: 32,
  },
  {
    id: 'blok_m',
    name: 'Terminal Blok M & Melawai',
    subtitle: 'Bursa Malam, Kuliner & Garasi Modifikasi',
    centerX: 8,
    centerZ: 60,
    radius: 32,
  },
  {
    id: 'tanjung_priok',
    name: 'Pelabuhan Tanjung Priok',
    subtitle: 'Dermaga Kontainer & Logistik Utara (Tahap 2)',
    centerX: 62,
    centerZ: -58,
    radius: 34,
  },
  {
    id: 'scbd',
    name: 'Kawasan Elit SCBD & Semanggi',
    subtitle: 'Bursa Saham & Menara Kaca Malam (Tahap 2)',
    centerX: -62,
    centerZ: -56,
    radius: 34,
  },
  {
    id: 'ancol_pik',
    name: 'Pesisir Ancol & Pantai Indah Kapuk',
    subtitle: 'Dermaga Marina & Boulevard Pantai (Tahap 3)',
    centerX: -62,
    centerZ: 58,
    radius: 34,
  },
  {
    id: 'halim_station',
    name: 'Stasiun Terpadu Halim & Cawang',
    subtitle: 'Hub Kereta Cepat & Pangkalan Taktis (Tahap 3)',
    centerX: 62,
    centerZ: 58,
    radius: 34,
  },
  {
    id: 'senayan_gbk',
    name: 'Kompleks Gelora Senayan & GBK',
    subtitle: 'Arena Stadion Megah & Markas Komando Garuda (Tahap 4)',
    centerX: -64,
    centerZ: 36,
    radius: 26,
  },
  {
    id: 'kemayoran',
    name: 'Distrik Siber & Bandara Kemayoran',
    subtitle: 'Menara Radar Lama & Benteng Data Sovereign (Tahap 4)',
    centerX: 64,
    centerZ: -36,
    radius: 26,
  },
  {
    id: 'pik2_mangrove',
    name: 'Kawasan Pesisir PIK 2 & Ekowisata',
    subtitle: 'Pulau Reklamasi, Pagoda Kaca & Dermaga Jet (Fase 5)',
    centerX: -76,
    centerZ: -18,
    radius: 24,
  },
  {
    id: 'tmii_ragunan',
    name: 'Taman Mini & Koridor Selatan',
    subtitle: 'Kubah Budaya Nusantara & Pangkalan Gatotkaca (Fase 5)',
    centerX: 48,
    centerZ: 74,
    radius: 24,
  },
];

export type EnemyBehaviorPolicy = 'rusher' | 'ranged_kiter' | 'charger_enforcer';

export interface EnemyArchetypeSpec {
  policy: EnemyBehaviorPolicy;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  windupDuration: number;
  cooldown: number;
  rewardRp: number;
  scoreValue: number;
}

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

export interface StoryChoiceOption {
  id: string;
  label: string;
  description: string;
  faction: FactionId;
  reputationDelta: Record<FactionId, number>;
  rewardRp: number;
  wantedDelta: number;
  objectiveType: 'combat_wave' | 'checkpoint_drive' | 'heist_escape';
  objectiveTargetCount: number;
  targetX: number;
  targetZ: number;
  nextMissionId: string | null;
  outcomeNarrative: string;
}

export interface StoryMission {
  id: string;
  stageNumber: 1 | 2 | 3 | 4 | 5;
  chapterNumber: number;
  title: string;
  giverName: string;
  giverRole: string;
  locationName: string;
  markerX: number;
  markerZ: number;
  briefing: string;
  choices: StoryChoiceOption[];
}

export const STORY_MISSIONS: StoryMission[] = [
  {
    id: 'm1_bayangan_monas',
    stageNumber: 1,
    chapterNumber: 1,
    title: 'Babak 1: Koper Panas di Kaki Monas',
    giverName: 'Bang Jaka "Kopi Hitam"',
    giverRole: 'Informan Senior Medan Merdeka',
    locationName: 'Plaza Selatan Monas',
    markerX: -12,
    markerZ: 16,
    briefing:
      'Selamat datang di San Nabilo, Jakarta. Sebuah koper berisi data transaksi gelap proyek reklamasi baru saja jatuh di tangan kurir yang salah. Tiga pihak menawarimu jalan masuk ke lingkaran kekuasaan kota ini. Siapa yang kau bela?',
    choices: [
      {
        id: 'c1_jalanan',
        label: 'Bela Jawara Tanah Abang (Jalur Jalanan)',
        description: 'Rebut koper dengan paksa dari pengawal sindikat dan bagikan upahnya ke jaringan pedagang lokal.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 35, sindikat: -15, rakyat: 15 },
        rewardRp: 350000,
        wantedDelta: 1,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 3,
        targetX: -42,
        targetZ: 10,
        nextMissionId: 'm2_malam_sudirman',
        outcomeNarrative:
          'Para Jawara Tanah Abang menghormatimu. Nama Nabilo mulai disegani di sepanjang jalur pasar hingga Bundaran.',
      },
      {
        id: 'c1_sindikat',
        label: 'Antar Cepat ke Menara Sudirman (Jalur Elit)',
        description: 'Kemudikan kendaraan melewati patroli dan serahkan koper utuh ke Direktur Sindikat Konstruksi.',
        faction: 'sindikat',
        reputationDelta: { jalanan: -10, sindikat: 40, rakyat: -10 },
        rewardRp: 600000,
        wantedDelta: 0,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 3,
        targetX: 0,
        targetZ: -48,
        nextMissionId: 'm2_malam_sudirman',
        outcomeNarrative:
          'Eksekutif Menara Sudirman terkesan dengan ketepatanmu. Akses ke garasi sport dan dana besar terbuka lebar.',
      },
      {
        id: 'c1_rakyat',
        label: 'Bocorkan ke Jurnalis Kota Tua (Jalur Rakyat)',
        description: 'Lindungi kurir jurnalis dari kepungan algojo bayaran agar skandal ini tayang di berita utama.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 10, sindikat: -25, rakyat: 40 },
        rewardRp: 250000,
        wantedDelta: 0,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 3,
        targetX: 42,
        targetZ: 14,
        nextMissionId: 'm2_malam_sudirman',
        outcomeNarrative:
          'Berita skandal mengguncang Jakarta! Warga memujimu sebagai pelindung bayangan kota San Nabilo.',
      },
    ],
  },
  {
    id: 'm2_malam_sudirman',
    stageNumber: 1,
    chapterNumber: 2,
    title: 'Babak 2: Konvoi Panas Koridor Sudirman',
    giverName: 'Raras "Valkyrie" Wijaya',
    giverRole: 'Koordinator Lapangan San Nabilo',
    locationName: 'Bundaran Air Mancur Sudirman',
    markerX: 14,
    markerZ: -38,
    briefing:
      'Keputusanmu di Monas memicu gelombang balasan. Konvoi logistik rahasia sedang bergerak melintasi jalur protokol Sudirman menuju Blok M. Bagaimana cara kita mengambil alih kendali malam ini?',
    choices: [
      {
        id: 'c2_jalanan',
        label: 'Sergap Konvoi di Persimpangan (Aksi Agresif)',
        description: 'Hadang para pengawal bersenjata dan kuasai muatan logistik secara langsung di jalan protokol.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 40, sindikat: -20, rakyat: 5 },
        rewardRp: 550000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 4,
        targetX: -18,
        targetZ: -35,
        nextMissionId: 'm3_puncak_jakarta',
        outcomeNarrative:
          'Aksi penyergapan di Sudirman membuat geng rival kocar-kacir. Kau kini menguasai jalur distribusi tengah kota.',
      },
      {
        id: 'c2_sindikat',
        label: 'Sabotase Elektronik & Balap Kurir (Taktis)',
        description: 'Pacu kendaraan melintasi 3 titik pemancar di Jakarta untuk mengalihkan rute konvoi ke garasi kita.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 5, sindikat: 40, rakyat: 5 },
        rewardRp: 750000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 3,
        targetX: 28,
        targetZ: 34,
        nextMissionId: 'm3_puncak_jakarta',
        outcomeNarrative:
          'Tanpa sebutir peluru pun terbuang sia-sia, seluruh konvoi berbelok masuk ke garasi rahasia milikmu.',
      },
      {
        id: 'c2_rakyat',
        label: 'Bajak Truk Dana & Bagikan ke Blok M (Populis)',
        description: 'Rebut kendaraan di tengah kepungan aparat dan bawa langsung menuju titik kumpul warga di Blok M.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 20, sindikat: -30, rakyat: 45 },
        rewardRp: 450000,
        wantedDelta: 1,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 2,
        targetX: 8,
        targetZ: 48,
        nextMissionId: 'm3_puncak_jakarta',
        outcomeNarrative:
          'Warga Blok M hingga Melawai menyambutmu bak pahlawan jalanan. Jaringan informan kota siap melindungimu.',
      },
    ],
  },
  {
    id: 'm3_puncak_jakarta',
    stageNumber: 1,
    chapterNumber: 3,
    title: 'Babak 3: Penentuan Takhta San Nabilo',
    giverName: 'Komisaris & Dewan Bayangan',
    giverRole: 'Pertemuan Puncak Medan Merdeka',
    locationName: 'Pelataran Tugu Monas Utara',
    markerX: 0,
    markerZ: -18,
    briefing:
      'Semua faksi Jakarta kini menatap langkahmu. Bos Besar Sindikat Lama mengirim pasukan elit untuk membungkammu sebelum ekspansi ke Pelabuhan Tanjung Priok dan SCBD dimulai.',
    choices: [
      {
        id: 'c3_jalanan',
        label: 'Kuasai Jalanan Jakarta Pusat (Raja Jalanan)',
        description: 'Kalahkan gelombang pasukan elit dan buka akses penuh menuju kawasan Tanjung Priok & SCBD.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 50, sindikat: 0, rakyat: 20 },
        rewardRp: 900000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 4,
        targetX: 0,
        targetZ: 18,
        nextMissionId: 'm4_kontainer_priok',
        outcomeNarrative:
          'Babak 3 Tuntas! Jaringanmu kini merambah hingga dermaga Tanjung Priok dan kawasan elit SCBD.',
      },
      {
        id: 'c3_sindikat',
        label: 'Ambil Alih Saham Koridor Sudirman (Konglomerat)',
        description: 'Tuntaskan manuver kejar-kejaran berkecepatan tinggi menuju helipad Sudirman.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 0, sindikat: 60, rakyat: 0 },
        rewardRp: 1100000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 3,
        targetX: -20,
        targetZ: -52,
        nextMissionId: 'm4_kontainer_priok',
        outcomeNarrative:
          'Babak 3 Tuntas! Modal besar mengalir ke rekeningmu untuk memulai ekspansi Tahap 2.',
      },
      {
        id: 'c3_rakyat',
        label: 'Bersihkan Oknum & Bela Warga (Penjaga Jakarta)',
        description: 'Tumpas algojo bayaran korup di jantung kota dan buka jalan menuju reformasi pelabuhan.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 25, sindikat: -30, rakyat: 65 },
        rewardRp: 850000,
        wantedDelta: 0,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 4,
        targetX: 16,
        targetZ: 18,
        nextMissionId: 'm4_kontainer_priok',
        outcomeNarrative:
          'Babak 3 Tuntas! Warga mendukung langkahmu menuju penyelidikan besar di Tanjung Priok.',
      },
    ],
  },
  // ================= TAHAP 2 EXPANSION MISSIONS (BABAK 4 - 6) =================
  {
    id: 'm4_kontainer_priok',
    stageNumber: 2,
    chapterNumber: 4,
    title: 'Babak 4: Sindikat Kontainer Tanjung Priok (Tahap 2)',
    giverName: 'Kapten Darmawan "Jangkar"',
    giverRole: 'Kepala Dermaga Kargo Utara',
    locationName: 'Pelabuhan Tanjung Priok',
    markerX: 46,
    markerZ: -44,
    briefing:
      'Memasuki Tahap 2! Di Pelabuhan Tanjung Priok, ratusan kontainer berisi suku cadang supercar dan persenjataan ilegal ditahan oleh kartel pelabuhan. Bagaimana cara Nabilo mengambil alih dermaga ini?',
    choices: [
      {
        id: 'c4_jalanan',
        label: 'Gempur Gudang Kartel dengan Mercon Naga (Agresif)',
        description: 'Ratakan penjaga dermaga kontainer di Tanjung Priok dan rebut seluruh muatan senjata.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 45, sindikat: -15, rakyat: 10 },
        rewardRp: 950000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 4,
        targetX: 52,
        targetZ: -46,
        nextMissionId: 'm5_langit_scbd',
        outcomeNarrative:
          'Ledakan di Dermaga Priok menegaskan kekuasaanmu! Seluruh jalur logistik laut kini di bawah komandomu.',
      },
      {
        id: 'c4_sindikat',
        label: 'Suap Bea Dermaga & Kawal Konvoi Kontainer (Bisnis)',
        description: 'Kemudikan kendaraan melewati 3 pos pemeriksaan pelabuhan menuju gudang distribusi SCBD.',
        faction: 'sindikat',
        reputationDelta: { jalanan: -5, sindikat: 50, rakyat: 0 },
        rewardRp: 1350000,
        wantedDelta: 0,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 3,
        targetX: 38,
        targetZ: -32,
        nextMissionId: 'm5_langit_scbd',
        outcomeNarrative:
          'Kontainer bernilai miliaran Rupiah lolos tanpa hambatan. Para investor SCBD mengundangmu ke lantai puncak.',
      },
      {
        id: 'c4_rakyat',
        label: 'Bongkar Penyelundupan & Bagi Sembako Pelabuhan (Rakyat)',
        description: 'Lumpuhkan algojo kartel dan serahkan kontainer logistik pangan kepada buruh dermaga.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 15, sindikat: -25, rakyat: 55 },
        rewardRp: 800000,
        wantedDelta: 1,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 4,
        targetX: 48,
        targetZ: -40,
        nextMissionId: 'm5_langit_scbd',
        outcomeNarrative:
          'Para buruh Pelabuhan Tanjung Priok bersumpah setia menjaga garis belakangmu di Jakarta Utara!',
      },
    ],
  },
  {
    id: 'm5_langit_scbd',
    stageNumber: 2,
    chapterNumber: 5,
    title: 'Babak 5: Operasi Langit Malam SCBD (Tahap 2)',
    giverName: 'Helena "Zero-Day" Tan',
    giverRole: 'Spesialis Siber & Helipad SCBD',
    locationName: 'Kawasan Elit SCBD',
    markerX: -46,
    markerZ: -44,
    briefing:
      'Server utama Bursa Gelap Jakarta disimpan di lantai atas Menara SCBD dengan penjagaan berlapis dan patroli udara. Gunakan Helikopter Nabilo-Air atau terobos barikade darat untuk menyapu mereka!',
    choices: [
      {
        id: 'c5_jalanan',
        label: 'Serbuan Darat & Udara di Plaza SCBD (Total Chaos)',
        description: 'Tumpas 5 pasukan khusus korporat yang menjaga lobi menara kembar SCBD.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 50, sindikat: -20, rakyat: 15 },
        rewardRp: 1400000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 5,
        targetX: -50,
        targetZ: -48,
        nextMissionId: 'm6_mahkota_megapolitan',
        outcomeNarrative:
          'Plaza SCBD bergetar! Tak ada lagi eksekutif korup yang berani meremehkan anak jalanan San Nabilo.',
      },
      {
        id: 'c5_sindikat',
        label: 'Terbang Lintas Menara dengan Helikopter (Eksekutif)',
        description: 'Lintasi 3 titik sinyal pemancar di atas koridor SCBD - Sudirman untuk mengakuisisi server.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 5, sindikat: 55, rakyat: 5 },
        rewardRp: 1750000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 3,
        targetX: -32,
        targetZ: -32,
        nextMissionId: 'm6_mahkota_megapolitan',
        outcomeNarrative:
          'Akuisisi siber dari udara berhasil! Seluruh data rekening rahasia oligarki kini berada di NabiloPhone milikmu.',
      },
      {
        id: 'c5_rakyat',
        label: 'Retas Dana Korupsi & Transfer ke Kas Warga (Robin Hood)',
        description: 'Amankan titik transmisi di SCBD lalu loloskan diri menuju kawasan aman warga.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 20, sindikat: -35, rakyat: 60 },
        rewardRp: 1200000,
        wantedDelta: 1,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 2,
        targetX: -32,
        targetZ: 28,
        nextMissionId: 'm6_mahkota_megapolitan',
        outcomeNarrative:
          'Triliunan dana gelap berhasil dikembalikan ke publik! Seluruh Jakarta meneriakkan nama Nabilo.',
      },
    ],
  },
  {
    id: 'm6_mahkota_megapolitan',
    stageNumber: 2,
    chapterNumber: 6,
    title: 'Babak 6: Puncak Kedaulatan Megapolitan (Finale Tahap 2)',
    giverName: 'Dewan Tertinggi Nusantara',
    giverRole: 'Penentuan Akhir Tahap 2',
    locationName: 'Bundaran Monas & Jantung Jakarta',
    markerX: 0,
    markerZ: 14,
    briefing:
      'Inilah puncak dari pengembangan Tahap 2 GPU: San Nabilo! Koalisi musuh terakhir mengepung Medan Merdeka dari darat dan udara. Pilih takdir terakhirmu sebagai penguasa sejati Megapolitan Jakarta!',
    choices: [
      {
        id: 'c6_jalanan',
        label: 'Deklarasi Kaisar Jalanan Nusantara (Lanjut ke Tahap 3)',
        description: 'Kalahkan gelombang tempur di Monas dan buka ekspansi menuju Ancol-PIK & Halim.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 60, sindikat: 0, rakyat: 25 },
        rewardRp: 2500000,
        wantedDelta: 3,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 5,
        targetX: 0,
        targetZ: -16,
        nextMissionId: 'm7_dermaga_ancol',
        outcomeNarrative:
          'Babak 6 Tuntas! Kekuasaanmu kini membentang menuju Pesisir Ancol-PIK dan Stasiun Kereta Cepat Halim.',
      },
      {
        id: 'c6_sindikat',
        label: 'Kuasai Monopoli Megapolitan Jakarta (Lanjut ke Tahap 3)',
        description: 'Pacu kendaraan atau Helikopter melewati 4 titik vital kota untuk mengunci kendali ekonomi penuh.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 10, sindikat: 70, rakyat: 0 },
        rewardRp: 3500000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 4,
        targetX: 0,
        targetZ: -38,
        nextMissionId: 'm7_dermaga_ancol',
        outcomeNarrative:
          'Babak 6 Tuntas! Kau menguasai piramida finansial SCBD dan siap mengakuisisi proyek Ancol-PIK & Halim.',
      },
      {
        id: 'c6_rakyat',
        label: 'Fajar Baru Keadilan San Nabilo (Lanjut ke Tahap 3)',
        description: 'Tumpas komandan bayaran di Monas dan lanjutkan pembebasan ke pesisir Ancol & Halim.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 30, sindikat: -40, rakyat: 75 },
        rewardRp: 2200000,
        wantedDelta: 0,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 5,
        targetX: 12,
        targetZ: 16,
        nextMissionId: 'm7_dermaga_ancol',
        outcomeNarrative:
          'Babak 6 Tuntas! Rakyat mendukung langkahmu menuju operasi besar Tahap 3 di Ancol-PIK dan Halim.',
      },
    ],
  },
  // ================= TAHAP 3 EXPANSION MISSIONS (BABAK 7 - 9) =================
  {
    id: 'm7_dermaga_ancol',
    stageNumber: 3,
    chapterNumber: 7,
    title: 'Babak 7: Operasi Marina Ancol & PIK (Tahap 3)',
    giverName: 'Laksamana Muda Karin "Bahari"',
    giverRole: 'Komandan Patroli Pesisir Jakarta',
    locationName: 'Pesisir Ancol & PIK',
    markerX: -48,
    markerZ: 46,
    briefing:
      'Selamat datang di Tahap 3! Sebuah kapal pesiar gelap berlabuh di Marina Ancol-PIK membawa chip pertahanan siber dan unit Rantis Barracuda selundupan. Ambil langkah tegas sebelum mereka meloloskan diri ke laut lepas!',
    choices: [
      {
        id: 'c7_jalanan',
        label: 'Serbu Dermaga Marina dengan Busur Pasopati (Agresif)',
        description: 'Gunakan Busur Pasopati Listrik & Kru Jawara untuk melumpuhkan 5 pengawal elit di Marina Ancol.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 55, sindikat: -20, rakyat: 20 },
        rewardRp: 1850000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 5,
        targetX: -52,
        targetZ: 48,
        nextMissionId: 'm8_kereta_cepat_halim',
        outcomeNarrative:
          'Kilatan listrik Busur Pasopati menyapu Dermaga Ancol! Seluruh kawasan pantai utara kini di bawah kendalimu.',
      },
      {
        id: 'c7_sindikat',
        label: 'Kejar Konvoi VIP Sepanjang Boulevard PIK (Taktis)',
        description: 'Kemudikan Rantis Barracuda atau Helikopter melintasi 3 titik pantau pesisir untuk menyergap kurir VIP.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 5, sindikat: 60, rakyat: 0 },
        rewardRp: 2400000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 3,
        targetX: -36,
        targetZ: 36,
        nextMissionId: 'm8_kereta_cepat_halim',
        outcomeNarrative:
          'Kurir VIP menyerahkan kode akses tanpa perlawanan. Aset properti Marina Ancol kini terbuka untukmu!',
      },
      {
        id: 'c7_rakyat',
        label: 'Sita Rantis Barracuda untuk Pertahanan Warga (Rakyat)',
        description: 'Rebut kendaraan lapis baja dari tangan sindikat di Ancol dan amankan ke markas warga.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 25, sindikat: -35, rakyat: 65 },
        rewardRp: 1650000,
        wantedDelta: 1,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 2,
        targetX: -28,
        targetZ: 32,
        nextMissionId: 'm8_kereta_cepat_halim',
        outcomeNarrative:
          'Rantis Barracuda berhasil diamankan! Nelayan dan warga pesisir Ancol mengelu-elukan keberanianmu.',
      },
    ],
  },
  {
    id: 'm8_kereta_cepat_halim',
    stageNumber: 3,
    chapterNumber: 8,
    title: 'Babak 8: Sabotase Stasiun Kereta Cepat Halim (Tahap 3)',
    giverName: 'Insinyur Bayu "Whoosh" Pratama',
    giverRole: 'Kepala Otorita Transportasi Halim',
    locationName: 'Stasiun Terpadu Halim & Cawang',
    markerX: 48,
    markerZ: 46,
    briefing:
      'Kelompok tentara bayaran internasional berusaha membajak pengiriman emas cadangan dan server AI di Terminal Kereta Cepat Halim. Seluruh jalur timur Jakarta berada dalam siaga merah!',
    choices: [
      {
        id: 'c8_jalanan',
        label: 'Pertahankan Peron Halim Sampai Titik Penghabisan (Tempur)',
        description: 'Kalahkan 5 tentara bayaran lapis baja yang merangsek masuk ke Plaza Stasiun Halim.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 60, sindikat: -10, rakyat: 30 },
        rewardRp: 2600000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 5,
        targetX: 52,
        targetZ: 48,
        nextMissionId: 'm9_takhta_nusantara',
        outcomeNarrative:
          'Pasukan bayaran terpukul mundur di Stasiun Halim! Jalur kereta cepat selamat berkat komandomu.',
      },
      {
        id: 'c8_sindikat',
        label: 'Kawal Logistik Emas Lintas Koridor Busway (Eksekutif)',
        description: 'Pacu kendaraan melewati 4 titik sensor dari Halim menuju Sudirman dalam waktu singkat.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 10, sindikat: 65, rakyat: 10 },
        rewardRp: 3200000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 4,
        targetX: 34,
        targetZ: 32,
        nextMissionId: 'm9_takhta_nusantara',
        outcomeNarrative:
          'Pengiriman emas cadangan tiba dengan aman di brankas utama. Komisi jutaan Rupiah langsung cair!',
      },
      {
        id: 'c8_rakyat',
        label: 'Evakuasi Penumpang & Amankan Server Publik (Pahlawan)',
        description: 'Amankan jalur evakuasi warga dari kepungan musuh di sekitar koridor Halim - Cawang.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 25, sindikat: -30, rakyat: 70 },
        rewardRp: 2300000,
        wantedDelta: 0,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 3,
        targetX: 24,
        targetZ: 28,
        nextMissionId: 'm9_takhta_nusantara',
        outcomeNarrative:
          'Ratusan penumpang kereta cepat selamat! Namamu diabadikan di sepanjang koridor timur Jakarta.',
      },
    ],
  },
  {
    id: 'm9_takhta_nusantara',
    stageNumber: 3,
    chapterNumber: 9,
    title: 'Babak 9: Kedaulatan Agung Nusantara (Finale Tahap 3)',
    giverName: 'Majelis Agung San Nabilo',
    giverRole: 'Puncak Trilogi GPU: San Nabilo',
    locationName: 'Medan Merdeka & Tugu Monas',
    markerX: 0,
    markerZ: -16,
    briefing:
      'Inilah klimaks agung Tahap 3 GPU: San Nabilo! Seluruh kekuatan dari Monas, Sudirman, SCBD, Tanjung Priok, Ancol-PIK, hingga Halim berkumpul. Tentukan mahkota abadi Nabilo di ibu kota!',
    choices: [
      {
        id: 'c9_jalanan',
        label: 'Mahkota Panglima Agung Nusantara (True Ending Jalanan)',
        description: 'Pimpin Kru Jawara menumpas gelombang elit terakhir di Monas dan kuasai seluruh Jakarta.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 80, sindikat: 0, rakyat: 35 },
        rewardRp: 5000000,
        wantedDelta: 3,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 6,
        targetX: 0,
        targetZ: 16,
        nextMissionId: 'm10_stadion_gbk',
        outcomeNarrative:
          'TRILOGI TAHAP 3 TUNTAS: Kau adalah Panglima Agung San Nabilo! Namun Komandan Satria menghubungimu: ada ancaman darurat di Gelora Senayan GBK.',
      },
      {
        id: 'c9_sindikat',
        label: 'Arsitek Ekonomi Megapolitan Abadi (True Ending Sindikat)',
        description: 'Tuntaskan patroli udara/darat melewati 4 titik mahkota ibu kota sebagai penguasa tunggal.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 15, sindikat: 85, rakyat: 15 },
        rewardRp: 6500000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 4,
        targetX: 0,
        targetZ: -38,
        nextMissionId: 'm10_stadion_gbk',
        outcomeNarrative:
          'TRILOGI TAHAP 3 TUNTAS: Seluruh menara SCBD berada di bawah imperium bisnismu! Kini Komandan Satria meminta bantuanmu di Gelora Senayan GBK.',
      },
      {
        id: 'c9_rakyat',
        label: 'Pelindung Abadi Rakyat Nusantara (True Ending Rakyat)',
        description: 'Bersihkan sisa kekuatan tirani di Monas dan serahkan kedaulatan penuh kepada warga Jakarta.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 40, sindikat: -50, rakyat: 90 },
        rewardRp: 4500000,
        wantedDelta: 0,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 6,
        targetX: -14,
        targetZ: 16,
        nextMissionId: 'm10_stadion_gbk',
        outcomeNarrative:
          'TRILOGI TAHAP 3 TUNTAS: Legenda Nabilo Sang Pelindung Rakyat Jakarta menggema! Kini krisis baru muncul di Kompleks Gelora Senayan GBK.',
      },
    ],
  },
  // ==================== TAHAP 4 MISSIONS (BABAK 10 - 12: EDISI PARIPURNA) ====================
  {
    id: 'm10_stadion_gbk',
    stageNumber: 4,
    chapterNumber: 10,
    title: 'Babak 10: Konspirasi Gelora Senayan GBK (Tahap 4)',
    giverName: 'Komandan Satria "Garuda"',
    giverRole: 'Perwira Satgas Anti-Konspirasi Senayan',
    locationName: 'Kompleks Gelora Senayan & GBK',
    markerX: -52,
    markerZ: 34,
    briefing:
      'Kontraktor militer bayangan "Black Garuda" menyandera sistem satelit penyiaran nasional di Kompleks Gelora Senayan! Pacu Hypercar Garuda GT-X atau gunakan Fokus Badai [Q] untuk menembus barikade mereka!',
    choices: [
      {
        id: 'c10_jalanan',
        label: 'Gempur Barikade Stadion bersama Kru Jawara (Jalanan)',
        description: 'Aktifkan Fokus Badai [Q] dan tumpas 6 personel Black Garuda di plaza Gelora Senayan.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 65, sindikat: -10, rakyat: 25 },
        rewardRp: 3800000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 6,
        targetX: -60,
        targetZ: 36,
        nextMissionId: 'm11_benteng_kemayoran',
        outcomeNarrative:
          'Pasukan Black Garuda di Gelora Senayan berhasil dilumpuhkan! Profesor Wira segera mengirim koordinat markas AI mereka di Kemayoran.',
      },
      {
        id: 'c10_sindikat',
        label: 'Uji Kecepatan Hypercar Garuda GT-X Lintas Senayan (Sindikat)',
        description: 'Pacu kendaraan memutari 4 titik sensor sinyal satelit dari Senayan ke Sudirman.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 15, sindikat: 70, rakyat: 5 },
        rewardRp: 4500000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 4,
        targetX: -44,
        targetZ: 28,
        nextMissionId: 'm11_benteng_kemayoran',
        outcomeNarrative:
          'Transmisi satelit berhasil diambil alih dalam kecepatan tinggi! Profesor Wira mengarahkanmu ke Bandara Lama Kemayoran.',
      },
      {
        id: 'c10_rakyat',
        label: 'Siarkan Dokumen Rahasia ke Layar Raksasa GBK (Rakyat)',
        description: 'Amankan tribun utama dan buka kedok pendana konspirasi di hadapan warga Jakarta.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 25, sindikat: -30, rakyat: 75 },
        rewardRp: 3400000,
        wantedDelta: 0,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 3,
        targetX: -48,
        targetZ: 40,
        nextMissionId: 'm11_benteng_kemayoran',
        outcomeNarrative:
          'Layar raksasa Gelora Senayan menyiarkan kebenaran ke seluruh penjuru ibu kota! Saatnya menyerbu benteng siber Kemayoran.',
      },
    ],
  },
  {
    id: 'm11_benteng_kemayoran',
    stageNumber: 4,
    chapterNumber: 11,
    title: 'Babak 11: Benteng Siber Bandara Lama Kemayoran (Tahap 4)',
    giverName: 'Profesor Wira "Sovereign"',
    giverRole: 'Arsitek Keamanan Siber Nasional',
    locationName: 'Distrik Siber & Bandara Kemayoran',
    markerX: 52,
    markerZ: -34,
    briefing:
      'Jaringan algoritma "Sovereign-IX" di bawah landasan pacu Bandara Lama Kemayoran mencoba membekukan seluruh rekening bank dan lampu lalu lintas Jakarta. Hentikan manuver mereka sekarang!',
    choices: [
      {
        id: 'c11_jalanan',
        label: 'Hancurkan Pengawal Inti Server Kemayoran (Jalanan)',
        description: 'Gunakan Busur Pasopati & Fokus Badai [Q] untuk meruntuhkan 6 penjaga elit menara radar.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 75, sindikat: 5, rakyat: 30 },
        rewardRp: 4800000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 6,
        targetX: 60,
        targetZ: -36,
        nextMissionId: 'm12_paripurna_jakarta',
        outcomeNarrative:
          'Menara radar Kemayoran berhasil direbut! Kini saatnya kembali ke Monas untuk pertempuran penutup Babak 12.',
      },
      {
        id: 'c11_sindikat',
        label: 'Tanam Kunci Akses NabiloPhone OS 4.0 di Landasan Pacu (Sindikat)',
        description: 'Lintasi 4 pemancar data di jalur cepat Kemayoran - Tanjung Priok untuk menguasai algoritma.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 15, sindikat: 80, rakyat: -10 },
        rewardRp: 5800000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 4,
        targetX: 46,
        targetZ: -28,
        nextMissionId: 'm12_paripurna_jakarta',
        outcomeNarrative:
          'Inti server Sovereign-IX kini patuh pada NabiloPhone OS 4.0 milikmu! Bersiaplah menuju Grand Finale di Medan Merdeka.',
      },
      {
        id: 'c11_rakyat',
        label: 'Program Ulang Sovereign-IX untuk Hapus Utang Warga (Rakyat)',
        description: 'Bajak 3 konsol utama Kemayoran dan pulihkan seluruh dana koperasi warga Jakarta.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 30, sindikat: -40, rakyat: 85 },
        rewardRp: 4200000,
        wantedDelta: 0,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 3,
        targetX: 50,
        targetZ: -42,
        nextMissionId: 'm12_paripurna_jakarta',
        outcomeNarrative:
          'Jutaan warga Jakarta bersorak saat saldo tabungan rakyat kembali utuh! Menuju Babak Final Paripurna di Monas.',
      },
    ],
  },
  {
    id: 'm12_paripurna_jakarta',
    stageNumber: 4,
    chapterNumber: 12,
    title: 'Babak 12: Mahkota Paripurna San Nabilo (Grand Finale Tahap 4)',
    giverName: 'Konsul Agung Nusantara',
    giverRole: 'Majelis Tertinggi Ibu Kota San Nabilo',
    locationName: 'Medan Merdeka & Puncak Emas Monas',
    markerX: 0,
    markerZ: 18,
    briefing:
      'Inilah Puncak Paripurna GPU: San Nabilo Tahap 4! Koalisi jenderal bayangan dan sindikat global melancarkan serangan terakhir ke jantung Medan Merdeka. Kerahkan Fokus Badai [Q], Kru Jawara, dan Hypercar Garuda GT-X untuk mengukir sejarah abadi!',
    choices: [
      {
        id: 'c12_jalanan',
        label: 'Maharaja Jawara Paripurna Nusantara (Ending Agung Jalanan)',
        description: 'Tumpas 7 gelombang elit terakhir di pelataran Monas dengan Fokus Badai [Q] & Kru Jawara.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 100, sindikat: 20, rakyat: 50 },
        rewardRp: 8500000,
        wantedDelta: 3,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 7,
        targetX: 0,
        targetZ: -14,
        nextMissionId: 'm13_krisis_pik2',
        outcomeNarrative:
          'EDISI PARIPURNA TAHAP 4 TUNTAS: Engkaulah Maharaja Jawara San Nabilo! Namun sinyal darurat dari Pulau Reklamasi PIK 2 memanggilmu ke Fase 5.',
      },
      {
        id: 'c12_sindikat',
        label: 'Kaisar Megapolitan & Bursa Nusantara (Lanjut ke Fase 5)',
        description: 'Pacu Hypercar Garuda GT-X atau Helikopter melewati 5 titik mahkota ibu kota Jakarta.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 30, sindikat: 100, rakyat: 25 },
        rewardRp: 10000000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 5,
        targetX: 0,
        targetZ: -36,
        nextMissionId: 'm13_krisis_pik2',
        outcomeNarrative:
          'EDISI PARIPURNA TAHAP 4 TUNTAS: Imperium bisnismu menguasai ibu kota! Kini ekspansi berlanjut ke Pulau Reklamasi PIK 2 di Fase 5.',
      },
      {
        id: 'c12_rakyat',
        label: 'Pahlawan Kedaulatan Abadi San Nabilo (Lanjut ke Fase 5)',
        description: 'Pertahankan Monas dari 7 pasukan tirani terakhir dan serahkan piagam kemakmuran ke rakyat.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 55, sindikat: -40, rakyat: 100 },
        rewardRp: 7500000,
        wantedDelta: 0,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 7,
        targetX: -12,
        targetZ: -14,
        nextMissionId: 'm13_krisis_pik2',
        outcomeNarrative:
          'EDISI PARIPURNA TAHAP 4 TUNTAS: Kembang api menghiasi Monas! Kini Laksamana Karin meminta bantuanmu di Kawasan Pesisir PIK 2 (Fase 5).',
      },
    ],
  },
  // ==================== FASE 5 MISSIONS (BABAK 13 - 15: EDISI MAHAKARYA NUSANTARA) ====================
  {
    id: 'm13_krisis_pik2',
    stageNumber: 5,
    chapterNumber: 13,
    title: 'Babak 13: Operasi Pulau Reklamasi PIK 2 (Fase 5)',
    giverName: 'Laksamana Karin "Bahari"',
    giverRole: 'Komandan Pertahanan Maritim Barat',
    locationName: 'Kawasan Pesisir PIK 2 & Ekowisata',
    markerX: -68,
    markerZ: -18,
    briefing:
      'Selamat datang di Fase 5! Konsorsium gelap membangun pangkalan drone otonom di Pagoda Kaca PIK 2 untuk memblokade perairan barat Jakarta. Aktifkan Drone Taktis Rajawali-X [Z] atau terbangkan Jet VTOL Elang Nusantara untuk membongkar pertahanan mereka!',
    choices: [
      {
        id: 'c13_jalanan',
        label: 'Gempur Pagoda PIK 2 dengan Meriam Plasma Gatotkaca [7] (Jalanan)',
        description: 'Tumpas 6 pengawal elit konsorsium bersama Drone Rajawali-X [Z] dan Kru Jawara.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 70, sindikat: -10, rakyat: 30 },
        rewardRp: 6200000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 6,
        targetX: -74,
        targetZ: -18,
        nextMissionId: 'm14_benteng_tmii',
        outcomeNarrative:
          'Dentuman Meriam Plasma Gatotkaca dan Drone Rajawali-X menghancurkan blokade PIK 2! Kini Empu Gandring memanggilmu ke Taman Mini di selatan.',
      },
      {
        id: 'c13_sindikat',
        label: 'Uji Terbang Jet VTOL Elang Nusantara Lintas Pesisir (Sindikat)',
        description: 'Terbangkan Jet VTOL atau Hypercar melewati 4 titik sensor maritim PIK 2 menuju SCBD.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 15, sindikat: 80, rakyat: 10 },
        rewardRp: 7500000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 4,
        targetX: -62,
        targetZ: -32,
        nextMissionId: 'm14_benteng_tmii',
        outcomeNarrative:
          'Manuver supersonik Jet VTOL Elang Nusantara membuat investor PIK 2 bertekuk lutut! Saatnya bergerak menuju Taman Mini di selatan.',
      },
      {
        id: 'c13_rakyat',
        label: 'Bebaskan Kawasan Mangrove & Nelayan Pesisir Barat (Rakyat)',
        description: 'Rebut kembali 3 titik kontrol ekowisata PIK 2 dan buka akses laut bagi nelayan tradisional.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 30, sindikat: -30, rakyat: 85 },
        rewardRp: 5600000,
        wantedDelta: 0,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 3,
        targetX: -64,
        targetZ: -10,
        nextMissionId: 'm14_benteng_tmii',
        outcomeNarrative:
          'Kawasan mangrove dan perairan barat kembali bebas! Nelayan PIK 2 mendukung langkahmu menuju Taman Mini.',
      },
    ],
  },
  {
    id: 'm14_benteng_tmii',
    stageNumber: 5,
    chapterNumber: 14,
    title: 'Babak 14: Konspirasi Kubah Nusantara TMII (Fase 5)',
    giverName: 'Empu Gandring "Gatotkaca"',
    giverRole: 'Kepala Riset Persenjataan Plasma Nasional',
    locationName: 'Taman Mini & Koridor Selatan',
    markerX: 44,
    markerZ: 68,
    briefing:
      'Di bawah Kubah Budaya Taman Mini & Koridor Selatan, sindikat bayangan menyembunyikan reaktor inti plasma curian. Gunakan Teleportasi MRT di NabiloPhone OS 5.0 atau terbang langsung ke selatan untuk merebutnya kembali!',
    choices: [
      {
        id: 'c14_jalanan',
        label: 'Sapu Bersih Penjaga Kubah TMII dengan Drone Rajawali-X (Jalanan)',
        description: 'Kalahkan 7 pasukan khusus di pelataran Taman Mini menggunakan Meriam Plasma Gatotkaca.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 80, sindikat: 0, rakyat: 35 },
        rewardRp: 7800000,
        wantedDelta: 2,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 7,
        targetX: 48,
        targetZ: 72,
        nextMissionId: 'm15_mahakarya_nabilo',
        outcomeNarrative:
          'Reaktor plasma Gatotkaca berhasil direbut utuh! Seluruh elemen kekuatan Nusantara kini siap untuk Grand Finale Babak 15 di Monas.',
      },
      {
        id: 'c14_sindikat',
        label: 'Kawal Inti Plasma Lintas Koridor Selatan - Sudirman (Sindikat)',
        description: 'Pacu kendaraan atau Jet VTOL melewati 4 pos pengamanan dari TMII menuju jantung kota.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 20, sindikat: 90, rakyat: 0 },
        rewardRp: 9200000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 4,
        targetX: 30,
        targetZ: 58,
        nextMissionId: 'm15_mahakarya_nabilo',
        outcomeNarrative:
          'Teknologi plasma bernilai triliunan Rupiah kini menjadi milik imperiummu! Bersiaplah menuju penobatan Babak 15 di Monas.',
      },
      {
        id: 'c14_rakyat',
        label: 'Konversi Reaktor Plasma untuk Listrik Gratis Warga Jakarta (Rakyat)',
        description: 'Amankan 3 gardu distribusi di Koridor Selatan agar energi bersih mengalir ke rumah warga.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 35, sindikat: -35, rakyat: 95 },
        rewardRp: 7000000,
        wantedDelta: 0,
        objectiveType: 'heist_escape',
        objectiveTargetCount: 3,
        targetX: 38,
        targetZ: 64,
        nextMissionId: 'm15_mahakarya_nabilo',
        outcomeNarrative:
          'Seluruh kawasan selatan Jakarta terang benderang berkat energi bersihmu! Saatnya kembali ke Monas untuk Babak 15.',
      },
    ],
  },
  {
    id: 'm15_mahakarya_nabilo',
    stageNumber: 5,
    chapterNumber: 15,
    title: 'Babak 15: Takhta Abadi Nusantara (Grand Finale Fase 5)',
    giverName: 'Dewan Tertinggi Nusantara',
    giverRole: 'Penobatan Edisi Mahakarya GPU: San Nabilo',
    locationName: 'Medan Merdeka & Puncak Emas Monas',
    markerX: 0,
    markerZ: -18,
    briefing:
      'Inilah Puncak Mahakarya Fase 5 GPU: San Nabilo! Dari Monas, Sudirman, Tanah Abang, Kota Tua, Blok M, Priok, SCBD, Ancol, Halim, Senayan GBK, Kemayoran, PIK 2, hingga Taman Mini — seluruh Jakarta menanti komando terakhirmu!',
    choices: [
      {
        id: 'c15_jalanan',
        label: 'Maharaja Abadi Nusantara (Ultimate Ending Jalanan)',
        description: 'Kerahkan Drone Rajawali-X [Z], Fokus Badai [Q], Kru Jawara & Meriam Gatotkaca [7] menumpas 8 elit terakhir.',
        faction: 'jalanan',
        reputationDelta: { jalanan: 100, sindikat: 35, rakyat: 60 },
        rewardRp: 15000000,
        wantedDelta: 3,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 8,
        targetX: 0,
        targetZ: 16,
        nextMissionId: null,
        outcomeNarrative:
          'MAHAKARYA FASE 5 TAMAT SEMPURNA: Engkaulah Maharaja Abadi San Nabilo! Seluruh 13 distrik Jakarta tunduk di bawah panji kehormatanmu selamanya.',
      },
      {
        id: 'c15_sindikat',
        label: 'Penguasa Supersonik & Konglomerat Nusantara (Ultimate Ending Sindikat)',
        description: 'Terbangkan Jet VTOL Elang Nusantara atau Hypercar Garuda GT-X melintasi 5 titik mahkota ibu kota.',
        faction: 'sindikat',
        reputationDelta: { jalanan: 40, sindikat: 100, rakyat: 40 },
        rewardRp: 18000000,
        wantedDelta: 1,
        objectiveType: 'checkpoint_drive',
        objectiveTargetCount: 5,
        targetX: 0,
        targetZ: -40,
        nextMissionId: null,
        outcomeNarrative:
          'MAHAKARYA FASE 5 TAMAT SEMPURNA: Dari menara pencakar langit SCBD hingga langit supersonik Nusantara, imperium Nabilo berkuasa abadi!',
      },
      {
        id: 'c15_rakyat',
        label: 'Penjaga Agung Kemakmuran Rakyat Nusantara (Ultimate Ending Rakyat)',
        description: 'Tumpas 8 armada tirani terakhir di Medan Merdeka dan resmikan era keemasan warga Jakarta.',
        faction: 'rakyat',
        reputationDelta: { jalanan: 65, sindikat: -30, rakyat: 100 },
        rewardRp: 14000000,
        wantedDelta: 0,
        objectiveType: 'combat_wave',
        objectiveTargetCount: 8,
        targetX: 14,
        targetZ: 16,
        nextMissionId: null,
        outcomeNarrative:
          'MAHAKARYA FASE 5 TAMAT SEMPURNA: Jutaan warga dari 13 distrik Jakarta merayakan kemakmuran abadi bersama Sang Legenda Nabilo!',
      },
    ],
  },
];

export type ProtagonistId = 'nabilo' | 'raka' | 'kirana';

export interface ProtagonistProfileSpec {
  id: ProtagonistId;
  name: string;
  codename: string;
  roleTitle: string;
  specialAbilityName: string;
  specialAbilityDesc: string;
  colorHex: string;
  threeColorHex: number;
  defaultOutfitId: OutfitId;
  homeDistrictName: string;
  spawnX: number;
  spawnZ: number;
  idleActivity: string;
}

export const PROTAGONIST_PROFILES: Record<ProtagonistId, ProtagonistProfileSpec> = {
  nabilo: {
    id: 'nabilo',
    name: 'Nabilo',
    codename: 'Sang Jawara Tanah Abang',
    roleTitle: 'Komandan Serbu & Taktik Lapangan',
    specialAbilityName: 'Fokus Badai [Q]',
    specialAbilityDesc: 'Perlambatan Waktu Tempur 0.38x & +75% Daya Hancur Senjata',
    colorHex: '#ef4444',
    threeColorHex: 0xef4444,
    defaultOutfitId: 'jaket_jawara',
    homeDistrictName: 'Medan Merdeka & Monas',
    spawnX: 0,
    spawnZ: 26,
    idleActivity: 'Mengawasi arus kurir di Plaza Selatan Monas',
  },
  raka: {
    id: 'raka',
    name: 'Raka Wijaya',
    codename: 'Raja Aspal Kemayoran',
    roleTitle: 'Spesialis Pelarian & Balap Jalan Tol',
    specialAbilityName: 'Overdrive Nitro & Drift [Q]',
    specialAbilityDesc: '+45% Akselerasi Turbo, Kemudi Drift Tajam & Kebal Benturan',
    colorHex: '#38bdf8',
    threeColorHex: 0x38bdf8,
    defaultOutfitId: 'rompi_taktis',
    homeDistrictName: 'Tol Layang Semanggi & Kemayoran',
    spawnX: 32,
    spawnZ: -26,
    idleActivity: 'Menyetel mesin Hypercar Garuda GT-X di jalur layang',
  },
  kirana: {
    id: 'kirana',
    name: 'Kirana Larasati',
    codename: 'Arsitek Siber SCBD',
    roleTitle: 'Peretas Brankas, Drone & Bursa Saham',
    specialAbilityName: 'Gelombang EMP & Overclock Drone [Q]',
    specialAbilityDesc: 'Lumpuhkan Patroli Polisi Sekitar & Tembakan Drone 2x Lipat',
    colorHex: '#f59e0b',
    threeColorHex: 0xf59e0b,
    defaultOutfitId: 'hoodie_siber',
    homeDistrictName: 'Menara Bursa SCBD',
    spawnX: -48,
    spawnZ: -44,
    idleActivity: 'Memantau algoritma saham BAJSA & frekuensi radio aparat',
  },
};

export interface ProtagonistLiveState {
  id: ProtagonistId;
  x: number;
  z: number;
  hp: number;
  armor: number;
  outfitId: OutfitId;
  statusText: string;
}

export type VehiclePaintFinish = 'metallic' | 'matte' | 'chrome';

export interface VehicleCustomPaintSpec {
  id: string;
  name: string;
  primaryHex: number;
  accentHex: number;
  finish: VehiclePaintFinish;
  price: number;
}

export const VEHICLE_CUSTOM_PAINTS: VehicleCustomPaintSpec[] = [
  {
    id: 'paint_jawara_crimson',
    name: 'Merah Jawara Metalik',
    primaryHex: 0xdc2626,
    accentHex: 0xfacc15,
    finish: 'metallic',
    price: 0,
  },
  {
    id: 'paint_garuda_gold',
    name: 'Emas Murni Kencana (Chrome)',
    primaryHex: 0xf59e0b,
    accentHex: 0x0f172a,
    finish: 'chrome',
    price: 180000,
  },
  {
    id: 'paint_stealth_obsidian',
    name: 'Hitam Siluman Taktis (Matte)',
    primaryHex: 0x111827,
    accentHex: 0x38bdf8,
    finish: 'matte',
    price: 150000,
  },
  {
    id: 'paint_scbd_sapphire',
    name: 'Biru Safir Eksekutif SCBD',
    primaryHex: 0x0284c7,
    accentHex: 0xe0f2fe,
    finish: 'metallic',
    price: 140000,
  },
  {
    id: 'paint_emerald_nusantara',
    name: 'Zamrud Khatulistiwa Metalik',
    primaryHex: 0x16a34a,
    accentHex: 0xfef08a,
    finish: 'metallic',
    price: 140000,
  },
  {
    id: 'paint_cyber_violet',
    name: 'Ungu Siber Kemayoran (Chrome)',
    primaryHex: 0x7e22ce,
    accentHex: 0x22d3ee,
    finish: 'chrome',
    price: 200000,
  },
];

export interface VehicleUnderglowSpec {
  id: string;
  name: string;
  colorHex: number | null;
  cssColor: string;
  price: number;
}

export const VEHICLE_UNDERGLOWS: VehicleUnderglowSpec[] = [
  { id: 'glow_off', name: 'Tanpa Lampu Kolong', colorHex: null, cssColor: '#334155', price: 0 },
  { id: 'glow_cyan', name: 'Neon Sian Siber', colorHex: 0x22d3ee, cssColor: '#22d3ee', price: 95000 },
  { id: 'glow_gold', name: 'Neon Emas Monas', colorHex: 0xfacc15, cssColor: '#facc15', price: 95000 },
  { id: 'glow_red', name: 'Neon Merah Balap', colorHex: 0xef4444, cssColor: '#ef4444', price: 95000 },
  { id: 'glow_purple', name: 'Neon Ungu Malam', colorHex: 0xc084fc, cssColor: '#c084fc', price: 110000 },
  { id: 'glow_green', name: 'Neon Hijau Nitro', colorHex: 0x22c55e, cssColor: '#22c55e', price: 95000 },
];

export interface VehicleCustomConfig {
  paintId: string;
  underglowId: string;
  armorPlatingLevel: number;
  nitroEnabled: boolean;
}

export type StockSymbol = 'BNBL' | 'SCBD' | 'PRIO' | 'HALM' | 'GATO' | 'KMYR';

export interface StockTickerSpec {
  symbol: StockSymbol;
  name: string;
  sector: string;
  rivalSymbol: StockSymbol;
  basePrice: number;
  sabotageHint: string;
}

export const JAKARTA_STOCKS: StockTickerSpec[] = [
  {
    symbol: 'BNBL',
    name: 'Bank Sentral Nabilo Tbk',
    sector: 'Perbankan & Brankas',
    rivalSymbol: 'SCBD',
    basePrice: 4200,
    sabotageHint: 'Beli saham SCBD sebelum merampok Brankas Bank Sentral untuk profit berlipat!',
  },
  {
    symbol: 'SCBD',
    name: 'SCBD Sovereign Capital',
    sector: 'Konglomerat Finansial',
    rivalSymbol: 'BNBL',
    basePrice: 6800,
    sabotageHint: 'Menyabotase Menara Bursa SCBD akan menjatuhkan SCBD dan melambungkan BNBL.',
  },
  {
    symbol: 'PRIO',
    name: 'Priok Global Kontainer',
    sector: 'Logistik Maritim',
    rivalSymbol: 'HALM',
    basePrice: 3100,
    sabotageHint: 'Menyerbu kargo Tanjung Priok membuat investor beralih ke kereta cepat HALM.',
  },
  {
    symbol: 'HALM',
    name: 'Halim Bullet Express',
    sector: 'Kereta Cepat & Kargo',
    rivalSymbol: 'PRIO',
    basePrice: 5400,
    sabotageHint: 'Naik tajam saat jalur kontainer laut PRIO terganggu aksi bajak.',
  },
  {
    symbol: 'GATO',
    name: 'Gatotkaca Defense Corp',
    sector: 'Alutsista & Rantis',
    rivalSymbol: 'KMYR',
    basePrice: 8900,
    sabotageHint: 'Melonjak saat eskalasi kejaran polisi Bintang 3–5 atau serbuan senjata berat.',
  },
  {
    symbol: 'KMYR',
    name: 'Kemayoran Cyber & Drone',
    sector: 'Teknologi Siber & AI',
    rivalSymbol: 'GATO',
    basePrice: 7500,
    sabotageHint: 'Melonjak saat Heist diselesaikan lewat pendekatan Siluman Siber Kirana.',
  },
];

export interface StockMarketEntry {
  symbol: StockSymbol;
  currentPrice: number;
  previousPrice: number;
  history: number[];
  ownedShares: number;
  avgBuyPrice: number;
}

export type HeistId = 'heist_bank_sentral' | 'heist_bursa_scbd' | 'heist_kargo_priok';
export type HeistApproach = 'stealth_cyber' | 'tactical_assault';

export interface HeistCrewMemberSpec {
  id: string;
  name: string;
  role: 'hacker' | 'driver' | 'gunman';
  roleLabel: string;
  skillRating: number;
  cutPercent: number;
  perkDesc: string;
}

export const HEIST_CREW_ROSTER: HeistCrewMemberSpec[] = [
  {
    id: 'crew_dimas_siber',
    name: 'Dimas "Zero-Day" Glodok',
    role: 'hacker',
    roleLabel: 'Peretas Brankas',
    skillRating: 94,
    cutPercent: 12,
    perkDesc: '+25 detik waktu lumpuh alarm & menaikkan saham KMYR',
  },
  {
    id: 'crew_bobi_sinyal',
    name: 'Bobi "Sinyal" Tanah Abang',
    role: 'hacker',
    roleLabel: 'Peretas Amatir',
    skillRating: 68,
    cutPercent: 6,
    perkDesc: 'Potongan komisi hemat, namun alarm brankas lebih cepat aktif',
  },
  {
    id: 'crew_sari_drift',
    name: 'Sari "V12" Kemayoran',
    role: 'driver',
    roleLabel: 'Sopir Pelarian Elit',
    skillRating: 92,
    cutPercent: 10,
    perkDesc: 'Menyiapkan Garuda GT-X / Helikopter di titik jemputan akhir',
  },
  {
    id: 'crew_ucup_bajaj',
    name: 'Ucup "Raja Tikungan"',
    role: 'driver',
    roleLabel: 'Sopir Jalan Tikus',
    skillRating: 72,
    cutPercent: 5,
    perkDesc: 'Biaya komisi sangat rendah, rute pelarian darat standar',
  },
  {
    id: 'crew_bang_tigers',
    name: 'Bang Tigor "Eks-Kopassus"',
    role: 'gunman',
    roleLabel: 'Penembak Taktis Senior',
    skillRating: 96,
    cutPercent: 14,
    perkDesc: 'Dukungan tembakan berat selama penerobosan brankas',
  },
  {
    id: 'crew_roni_jawara',
    name: 'Roni "Golok Kilat"',
    role: 'gunman',
    roleLabel: 'Pengawal Jalanan',
    skillRating: 75,
    cutPercent: 7,
    perkDesc: 'Potongan hemat, cocok untuk operasi senyap',
  },
];

export interface GrandHeistSpec {
  id: HeistId;
  title: string;
  targetLocation: string;
  targetStockRival: StockSymbol;
  victimStock: StockSymbol;
  grossTakeRp: number;
  setupDescription: string;
  stealthDesc: string;
  assaultDesc: string;
  vaultX: number;
  vaultZ: number;
  escapeX: number;
  escapeZ: number;
}

export const GRAND_HEISTS: GrandHeistSpec[] = [
  {
    id: 'heist_bank_sentral',
    title: 'Operasi I: Brankas Emas Bank Sentral Thamrin',
    targetLocation: 'Lobi & Brankas Bawah Tanah Bank Sentral (Thamrin)',
    victimStock: 'BNBL',
    targetStockRival: 'SCBD',
    grossTakeRp: 8500000,
    setupDescription: 'Amankan cetak biru ventilasi brankas dan kode otorisasi direksi di koridor Sudirman.',
    stealthDesc: 'Taktik Siluman Siber: Kirana meretas sensor laser brankas sementara Nabilo & Raka menguras emas batangan dengan minim bintang buronan.',
    assaultDesc: 'Serbuan Lapis Baja: Terobos lobi utama menggunakan Rantis Barracuda & Mercon Naga, hadapi kepungan polisi Bintang 4!',
    vaultX: 18,
    vaultZ: -38,
    escapeX: -54,
    escapeZ: -52,
  },
  {
    id: 'heist_bursa_scbd',
    title: 'Operasi II: Akuisisi Server Inti Bursa SCBD',
    targetLocation: 'Penthouse Menara Bursa & Helipad SCBD',
    victimStock: 'SCBD',
    targetStockRival: 'BNBL',
    grossTakeRp: 14500000,
    setupDescription: 'Sadap frekuensi pengawal helipad SCBD dan siapkan kartu akses eksekutif.',
    stealthDesc: 'Infiltrasi Atap Senyap: Menyusup lewat helipad menggunakan kode samaran, unduh obligasi digital, lalu meluncur via jalur tol layang.',
    assaultDesc: 'Penyergapan Udara & Darat: Gempur menara SCBD dengan Drone Rajawali-X dan kabur menggunakan Helikopter Taktis!',
    vaultX: -56,
    vaultZ: -52,
    escapeX: 0,
    escapeZ: 24,
  },
  {
    id: 'heist_kargo_priok',
    title: 'Operasi III: Pembajakan Kargo Litium Tanjung Priok',
    targetLocation: 'Dermaga Kontainer Tanjung Priok & Tol Layang',
    victimStock: 'PRIO',
    targetStockRival: 'HALM',
    grossTakeRp: 24000000,
    setupDescription: 'Lumpuhkan menara radar pelabuhan dan kunci koordinat kontainer litium murni.',
    stealthDesc: 'Sabotase EMP Malam: Matikan lampu dermaga dengan gelombang EMP Kirana dan bawa lari kargo lewat Tol Layang Semanggi.',
    assaultDesc: 'Badai Gatotkaca & Jet VTOL: Hancurkan barikade penjaga dermaga dengan Meriam Plasma Gatotkaca dan ekstrak kargo via udara!',
    vaultX: 58,
    vaultZ: -52,
    escapeX: -68,
    escapeZ: -18,
  },
];

export type InteriorZoneId = 'exterior' | 'heist_penthouse' | 'customs_garage' | 'bank_vault';

export interface EnterableInteriorSpec {
  id: Exclude<InteriorZoneId, 'exterior'>;
  name: string;
  subtitle: string;
  districtName: string;
  portalX: number;
  portalZ: number;
  accentHex: number;
}

export const ENTERABLE_INTERIORS: EnterableInteriorSpec[] = [
  {
    id: 'heist_penthouse',
    name: 'Penthouse Komando Heist SCBD',
    subtitle: 'Markas Taktis 3 Protagonis & Papan Strategi Operasi Besar',
    districtName: 'SCBD & Semanggi',
    portalX: -22,
    portalZ: -34,
    accentHex: 0xa855f7,
  },
  {
    id: 'customs_garage',
    name: 'Bengkel Kustom Nusantara (LS Customs)',
    subtitle: 'Modifikasi Cat Metalik/Chrome, Neon Kolong, Lapis Baja & Hapus Buronan',
    districtName: 'Sudirman & Kemayoran',
    portalX: 14,
    portalZ: 22,
    accentHex: 0xf59e0b,
  },
  {
    id: 'bank_vault',
    name: 'Lobi & Brankas Emas Bank Sentral',
    subtitle: 'Zona Target Perampokan Utama & Penyimpanan Cadangan Emas',
    districtName: 'Thamrin & Monas',
    portalX: 22,
    portalZ: -34,
    accentHex: 0x22c55e,
  },
];

export interface StreetRaceSpec {
  id: string;
  name: string;
  subtitle: string;
  entryFeeRp: number;
  rewardRp: number;
  checkpoints: [number, number][];
}

export const STREET_RACES: StreetRaceSpec[] = [
  {
    id: 'race_tol_layang',
    name: 'GP Malam Tol Layang Semanggi',
    subtitle: 'Lintasan Atas Jalan Tol Layang & Tanjakan Kemayoran (4 Checkpoint)',
    entryFeeRp: 50000,
    rewardRp: 650000,
    checkpoints: [
      [-45, -26],
      [0, -26],
      [45, -26],
      [0, 18],
    ],
  },
  {
    id: 'race_sudirman_sprint',
    name: 'Sprint Neon Sudirman – Monas',
    subtitle: 'Adu Kecepatan Tinggi Mengitari Tugu Monas & Bundaran HI (5 Checkpoint)',
    entryFeeRp: 100000,
    rewardRp: 1200000,
    checkpoints: [
      [0, -32],
      [0, -64],
      [32, -32],
      [32, 24],
      [0, 24],
    ],
  },
];

export interface PlayerProgressState {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  rupiah: number;
  wantedLevel: number;
  wantedEvading: boolean;
  wantedEvadeTimer: number;
  score: number;
  bestScore: number;
  reputation: Record<FactionId, number>;
  completedMissions: string[];
  unlockedWeapons: WeaponId[];
  activeWeapon: WeaponId;
  ammo: Record<WeaponId, number>;
  ownedProperties: string[];
  crewCount: number;
  radioStation: RadioStationId;
  fokusEnergy: number;
  fokusActive: boolean;
  outfitId: OutfitId;
  vehicleUpgradeLevel: number;
  droneLevel: number;
  droneActive: boolean;
  activeProtagonist: ProtagonistId;
  protagonistRoster: Record<ProtagonistId, ProtagonistLiveState>;
  vehicleCustoms: VehicleCustomConfig;
  stockPortfolio: Record<StockSymbol, StockMarketEntry>;
  completedHeistSetups: HeistId[];
  completedHeists: HeistId[];
  activeHeistPlan: {
    heistId: HeistId;
    approach: HeistApproach;
    hackerId: string;
    driverId: string;
    gunmanId: string;
  };
  currentInterior: InteriorZoneId;
}

export function createInitialStockPortfolio(): Record<StockSymbol, StockMarketEntry> {
  const map = {} as Record<StockSymbol, StockMarketEntry>;
  for (const st of JAKARTA_STOCKS) {
    const p = st.basePrice;
    map[st.symbol] = {
      symbol: st.symbol,
      currentPrice: p,
      previousPrice: Math.round(p * 0.98),
      history: [
        Math.round(p * 0.94),
        Math.round(p * 0.96),
        Math.round(p * 0.95),
        Math.round(p * 0.99),
        Math.round(p * 0.97),
        Math.round(p * 1.01),
        Math.round(p * 0.98),
        p,
      ],
      ownedShares: 0,
      avgBuyPrice: 0,
    };
  }
  return map;
}

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

export const DRONE_UPGRADE_COST = 300000;

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

export const VEHICLE_UPGRADE_COST = 250000;

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

export function calculatePassivePropertyIncome(ownedPropertyIds: string[]): number {
  let total = 0;
  for (const id of ownedPropertyIds) {
    const prop = JAKARTA_PROPERTIES.find((p) => p.id === id);
    if (prop) total += prop.incomePerTick;
  }
  return total;
}

export function purchaseProperty(
  state: PlayerProgressState,
  propertyId: string
): { nextState: PlayerProgressState; purchased: boolean } {
  if (state.ownedProperties.includes(propertyId)) {
    return { nextState: state, purchased: false };
  }
  const prop = JAKARTA_PROPERTIES.find((p) => p.id === propertyId);
  if (!prop || state.rupiah < prop.price) {
    return { nextState: state, purchased: false };
  }
  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - prop.price,
      ownedProperties: [...state.ownedProperties, propertyId],
      score: state.score + 250,
      bestScore: Math.max(state.bestScore, state.score + 250),
    },
    purchased: true,
  };
}

export function clampDt(rawDt: number): number {
  if (!Number.isFinite(rawDt) || rawDt < 0) return 0;
  return Math.min(rawDt, 0.05);
}

export function resolveDistrictAtPosition(x: number, z: number): DistrictZone {
  let closest = JAKARTA_DISTRICTS[0];
  let bestDist = Infinity;
  for (const d of JAKARTA_DISTRICTS) {
    const dist = Math.hypot(x - d.centerX, z - d.centerZ);
    if (dist < bestDist) {
      bestDist = dist;
      closest = d;
    }
  }
  return closest;
}

export function applyStoryChoice(
  state: PlayerProgressState,
  choice: StoryChoiceOption
): PlayerProgressState {
  const nextRep: Record<FactionId, number> = {
    jalanan: Math.max(0, Math.min(100, state.reputation.jalanan + (choice.reputationDelta.jalanan || 0))),
    sindikat: Math.max(0, Math.min(100, state.reputation.sindikat + (choice.reputationDelta.sindikat || 0))),
    rakyat: Math.max(0, Math.min(100, state.reputation.rakyat + (choice.reputationDelta.rakyat || 0))),
  };
  const nextWanted = Math.max(0, Math.min(5, state.wantedLevel + choice.wantedDelta));

  return {
    ...state,
    reputation: nextRep,
    wantedLevel: nextWanted,
  };
}

export function completeMissionReward(
  state: PlayerProgressState,
  missionId: string,
  choice: StoryChoiceOption
): PlayerProgressState {
  const alreadyDone = state.completedMissions.includes(missionId);
  const completedMissions = alreadyDone
    ? state.completedMissions
    : [...state.completedMissions, missionId];
  const scoreGain = 500 + Math.round(choice.rewardRp / 1000);
  const nextScore = state.score + scoreGain;

  return {
    ...state,
    rupiah: state.rupiah + choice.rewardRp,
    score: nextScore,
    bestScore: Math.max(state.bestScore, nextScore),
    wantedLevel: 0,
    hp: state.maxHp,
    completedMissions,
  };
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

  const nextState: PlayerProgressState = {
    ...state,
    hp,
    armor,
  };

  return {
    nextState,
    isDefeated: hp <= 0,
  };
}

export function getDominantFactionTitle(rep: Record<FactionId, number>): {
  faction: FactionId;
  title: string;
  endingSummary: string;
} {
  if (rep.sindikat >= rep.jalanan && rep.sindikat >= rep.rakyat) {
    return {
      faction: 'sindikat',
      title: 'Eksekutif Bayangan Sudirman',
      endingSummary: 'Kau mengendalikan arus modal dan proyek raksasa Jakarta dari balik layar kaca gedung pencakar langit.',
    };
  }
  if (rep.rakyat >= rep.jalanan && rep.rakyat >= rep.sindikat) {
    return {
      faction: 'rakyat',
      title: 'Pahlawan Jalanan Jakarta',
      endingSummary: 'Warga kecil dari Tanah Abang hingga Blok M menjadikan namamu simbol perlawanan terhadap kesewenang-wenangan.',
    };
  }
  return {
    faction: 'jalanan',
    title: 'Panglima Jawara San Nabilo',
    endingSummary: 'Seluruh teritori pasar, terminal, dan jalur malam Jakarta tunduk di bawah kode kehormatan jalananmu.',
  };
}

export interface BuildingFootprint {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  style: 'skyscraper' | 'colonial' | 'pasar' | 'ruko' | 'monas' | 'port_crane';
  primaryColor: number;
  accentColor: number;
}

export const CITY_BUILDINGS: BuildingFootprint[] = [
  // Monas Centerpiece at (0, 0)
  {
    id: 'monas_monument',
    name: 'Monumen Nasional (Monas)',
    x: 0,
    z: 0,
    width: 11,
    depth: 11,
    height: 36,
    style: 'monas',
    primaryColor: 0xf5f5f4,
    accentColor: 0xf59e0b,
  },
  // Sudirman Skyscrapers (North Z < -25)
  {
    id: 'wisma_nabilo',
    name: 'Menara Wisma Nabilo 46',
    x: -22,
    z: -42,
    width: 12,
    depth: 12,
    height: 44,
    style: 'skyscraper',
    primaryColor: 0x1e293b,
    accentColor: 0x38bdf8,
  },
  {
    id: 'menara_bca_sudirman',
    name: 'Menara Finansial Sudirman',
    x: 22,
    z: -42,
    width: 13,
    depth: 11,
    height: 48,
    style: 'skyscraper',
    primaryColor: 0x0f172a,
    accentColor: 0x60a5fa,
  },
  {
    id: 'plaza_thamrin',
    name: 'Grand Thamrin Plaza',
    x: -24,
    z: -68,
    width: 15,
    depth: 12,
    height: 36,
    style: 'skyscraper',
    primaryColor: 0x334155,
    accentColor: 0xfbbf24,
  },
  {
    id: 'menara_nusantara',
    name: 'Menara Nusantara Jaya',
    x: 24,
    z: -68,
    width: 14,
    depth: 12,
    height: 42,
    style: 'skyscraper',
    primaryColor: 0x1e293b,
    accentColor: 0x2dd4bf,
  },
  // Tanah Abang (West X < -30)
  {
    id: 'blok_a_tanah_abang',
    name: 'Pusat Grosir Tanah Abang Blok A',
    x: -54,
    z: -10,
    width: 18,
    depth: 14,
    height: 18,
    style: 'pasar',
    primaryColor: 0x15803d,
    accentColor: 0xfacc15,
  },
  {
    id: 'ruko_kebon_kacang',
    name: 'Deretan Ruko Kebon Kacang',
    x: -54,
    z: 26,
    width: 16,
    depth: 10,
    height: 11,
    style: 'ruko',
    primaryColor: 0xb45309,
    accentColor: 0xfef08a,
  },
  // Kota Tua & Glodok (East X > 30)
  {
    id: 'museum_fatahillah',
    name: 'Gedung Balai Kota Tua',
    x: 54,
    z: -8,
    width: 18,
    depth: 12,
    height: 14,
    style: 'colonial',
    primaryColor: 0xfafaf9,
    accentColor: 0x9a3412,
  },
  {
    id: 'glodok_harco',
    name: 'Sentra Elektronik Glodok',
    x: 54,
    z: 28,
    width: 16,
    depth: 12,
    height: 16,
    style: 'ruko',
    primaryColor: 0x991b1b,
    accentColor: 0xfbbf24,
  },
  // Blok M & Melawai (South Z > 35)
  {
    id: 'blok_m_square',
    name: 'Blok M Plaza & Terminal',
    x: -22,
    z: 54,
    width: 18,
    depth: 12,
    height: 15,
    style: 'pasar',
    primaryColor: 0xc2410c,
    accentColor: 0xfde047,
  },
  {
    id: 'melawai_night_club',
    name: 'Little Tokyo & Warung Melawai',
    x: 24,
    z: 54,
    width: 16,
    depth: 11,
    height: 12,
    style: 'ruko',
    primaryColor: 0x312e81,
    accentColor: 0xf43f5e,
  },
  // TAHAP 2 NEW LANDMARKS: Tanjung Priok Container Port (North-East) & SCBD Towers (North-West)
  {
    id: 'priok_container_terminal',
    name: 'Terminal Petikemas Tanjung Priok',
    x: 62,
    z: -56,
    width: 18,
    depth: 14,
    height: 16,
    style: 'port_crane',
    primaryColor: 0x0284c7,
    accentColor: 0xf97316,
  },
  {
    id: 'scbd_treasury_tower',
    name: 'Menara Bursa SCBD & Helipad',
    x: -60,
    z: -56,
    width: 15,
    depth: 15,
    height: 52,
    style: 'skyscraper',
    primaryColor: 0x0f172a,
    accentColor: 0xa855f7,
  },
  // TAHAP 3 NEW LANDMARKS: Marina Ancol-PIK & Stasiun Kereta Cepat Halim
  {
    id: 'ancol_marina_tower',
    name: 'Menara Bahari & Marina Ancol-PIK',
    x: -60,
    z: 58,
    width: 16,
    depth: 13,
    height: 28,
    style: 'skyscraper',
    primaryColor: 0x0369a1,
    accentColor: 0x2dd4bf,
  },
  {
    id: 'halim_bullet_station',
    name: 'Terminal Kereta Cepat Halim',
    x: 60,
    z: 58,
    width: 19,
    depth: 14,
    height: 18,
    style: 'port_crane',
    primaryColor: 0x991b1b,
    accentColor: 0xfef08a,
  },
  // TAHAP 4 NEW LANDMARKS: Stadion Gelora Senayan GBK & Menara Siber Kemayoran
  {
    id: 'gbk_senayan_dome',
    name: 'Tribun Utama Gelora Senayan GBK',
    x: -64,
    z: 36,
    width: 16,
    depth: 12,
    height: 20,
    style: 'colonial',
    primaryColor: 0x1e293b,
    accentColor: 0xfacc15,
  },
  {
    id: 'kemayoran_cyber_tower',
    name: 'Menara Radar & Siber Kemayoran',
    x: 64,
    z: -36,
    width: 14,
    depth: 14,
    height: 36,
    style: 'skyscraper',
    primaryColor: 0x0f172a,
    accentColor: 0x22d3ee,
  },
  // FASE 5 NEW LANDMARKS: Pagoda Kaca PIK 2 & Kubah Budaya Nusantara TMII
  {
    id: 'pik2_glass_pagoda',
    name: 'Pagoda Kaca & Dermaga Jet PIK 2',
    x: -76,
    z: -18,
    width: 14,
    depth: 14,
    height: 32,
    style: 'skyscraper',
    primaryColor: 0x0c4a6e,
    accentColor: 0x38bdf8,
  },
  {
    id: 'tmii_archipelago_dome',
    name: 'Kubah Budaya Nusantara TMII',
    x: 48,
    z: 74,
    width: 16,
    depth: 12,
    height: 22,
    style: 'colonial',
    primaryColor: 0x7c2d12,
    accentColor: 0xfacc15,
  },
];

export function resolveCircleAABBCollision(
  px: number,
  pz: number,
  radius: number,
  buildings: BuildingFootprint[] = CITY_BUILDINGS
): { x: number; z: number; collided: boolean } {
  let x = px;
  let z = pz;
  let collided = false;

  // World outer perimeter clamp (natural boundary at +-92m)
  const maxBound = 92;
  if (x < -maxBound) {
    x = -maxBound;
    collided = true;
  } else if (x > maxBound) {
    x = maxBound;
    collided = true;
  }
  if (z < -maxBound) {
    z = -maxBound;
    collided = true;
  } else if (z > maxBound) {
    z = maxBound;
    collided = true;
  }

  for (const b of buildings) {
    const halfW = b.width / 2;
    const halfD = b.depth / 2;
    const minX = b.x - halfW;
    const maxX = b.x + halfW;
    const minZ = b.z - halfD;
    const maxZ = b.z + halfD;

    const closestX = Math.max(minX, Math.min(x, maxX));
    const closestZ = Math.max(minZ, Math.min(z, maxZ));

    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      } else {
        const leftPen = Math.abs(x - minX);
        const rightPen = Math.abs(maxX - x);
        const topPen = Math.abs(z - minZ);
        const botPen = Math.abs(maxZ - z);
        const minPen = Math.min(leftPen, rightPen, topPen, botPen);
        if (minPen === leftPen) x = minX - radius;
        else if (minPen === rightPen) x = maxX + radius;
        else if (minPen === topPen) z = minZ - radius;
        else z = maxZ + radius;
      }
    }
  }

  return { x, z, collided };
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

export function formatRupiah(amount: number): string {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

/**
 * Returns the physical surface elevation Y (in meters) at world coordinates (x, z),
 * including the Jakarta Inner-City Elevated Toll Highway (Tol Layang Semanggi - Kemayoran)
 * at Z ∈ [-30.5, -21.5]:
 * - Main elevated deck: X ∈ [-42, 42] at Y = 6.2m
 * - West sloped ramp: X ∈ [-68, -42] climbing smoothly from 0m to 6.2m
 * - East sloped ramp: X ∈ [42, 68] descending smoothly from 6.2m to 0m
 */
export function getGroundElevationAt(x: number, z: number): number {
  if (z >= -30.5 && z <= -21.5) {
    if (x >= -42 && x <= 42) {
      return 6.2;
    }
    if (x >= -68 && x < -42) {
      const t = (x - -68) / 26;
      return Math.max(0, Math.min(6.2, t * 6.2));
    }
    if (x > 42 && x <= 68) {
      const t = (68 - x) / 26;
      return Math.max(0, Math.min(6.2, t * 6.2));
    }
  }
  return 0;
}

export function buyStockShares(
  state: PlayerProgressState,
  symbol: StockSymbol,
  sharesToBuy: number
): { nextState: PlayerProgressState; bought: boolean } {
  const entry = state.stockPortfolio[symbol];
  if (!entry || sharesToBuy <= 0) return { nextState: state, bought: false };
  const totalCost = entry.currentPrice * sharesToBuy;
  if (state.rupiah < totalCost) return { nextState: state, bought: false };

  const newTotalShares = entry.ownedShares + sharesToBuy;
  const newAvgPrice = Math.round(
    (entry.ownedShares * entry.avgBuyPrice + totalCost) / newTotalShares
  );

  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - totalCost,
      stockPortfolio: {
        ...state.stockPortfolio,
        [symbol]: {
          ...entry,
          ownedShares: newTotalShares,
          avgBuyPrice: newAvgPrice,
        },
      },
    },
    bought: true,
  };
}

export function sellStockShares(
  state: PlayerProgressState,
  symbol: StockSymbol,
  sharesToSell: number
): { nextState: PlayerProgressState; sold: boolean; proceedsRp: number } {
  const entry = state.stockPortfolio[symbol];
  if (!entry || sharesToSell <= 0 || entry.ownedShares < sharesToSell) {
    return { nextState: state, sold: false, proceedsRp: 0 };
  }
  const proceedsRp = entry.currentPrice * sharesToSell;
  const remaining = entry.ownedShares - sharesToSell;

  return {
    nextState: {
      ...state,
      rupiah: state.rupiah + proceedsRp,
      stockPortfolio: {
        ...state.stockPortfolio,
        [symbol]: {
          ...entry,
          ownedShares: remaining,
          avgBuyPrice: remaining === 0 ? 0 : entry.avgBuyPrice,
        },
      },
    },
    sold: true,
    proceedsRp,
  };
}

export function triggerStockMarketImpact(
  state: PlayerProgressState,
  victimSymbol: StockSymbol,
  boostSymbol: StockSymbol,
  dropPercent: number = 0.22,
  boostPercent: number = 0.28
): PlayerProgressState {
  const nextPortfolio = { ...state.stockPortfolio };

  const victim = nextPortfolio[victimSymbol];
  if (victim) {
    const nextPrice = Math.max(400, Math.round(victim.currentPrice * (1 - dropPercent)));
    nextPortfolio[victimSymbol] = {
      ...victim,
      previousPrice: victim.currentPrice,
      currentPrice: nextPrice,
      history: [...victim.history.slice(1), nextPrice],
    };
  }

  const boost = nextPortfolio[boostSymbol];
  if (boost) {
    const nextPrice = Math.round(boost.currentPrice * (1 + boostPercent));
    nextPortfolio[boostSymbol] = {
      ...boost,
      previousPrice: boost.currentPrice,
      currentPrice: nextPrice,
      history: [...boost.history.slice(1), nextPrice],
    };
  }

  return {
    ...state,
    stockPortfolio: nextPortfolio,
  };
}

export function stepStockMarketTick(state: PlayerProgressState): PlayerProgressState {
  const nextPortfolio = { ...state.stockPortfolio };
  for (const spec of JAKARTA_STOCKS) {
    const item = nextPortfolio[spec.symbol];
    if (!item) continue;
    let bias = 0;
    if (spec.symbol === 'GATO' && state.wantedLevel >= 3) bias = 0.035;
    if (spec.symbol === 'KMYR' && state.droneActive) bias = 0.02;

    const deltaPct = (Math.random() - 0.485 + bias) * 0.045;
    const nextPrice = Math.max(
      500,
      Math.round(item.currentPrice * (1 + deltaPct))
    );
    nextPortfolio[spec.symbol] = {
      ...item,
      previousPrice: item.currentPrice,
      currentPrice: nextPrice,
      history: [...item.history.slice(1), nextPrice],
    };
  }
  return {
    ...state,
    stockPortfolio: nextPortfolio,
  };
}

export function calculateHeistBreakdown(
  heistId: HeistId,
  hackerId: string,
  driverId: string,
  gunmanId: string
): {
  grossTakeRp: number;
  totalCrewCutPercent: number;
  crewCutRp: number;
  netPlayerTakeRp: number;
} {
  const heist = GRAND_HEISTS.find((h) => h.id === heistId) || GRAND_HEISTS[0];
  const hacker = HEIST_CREW_ROSTER.find((c) => c.id === hackerId);
  const driver = HEIST_CREW_ROSTER.find((c) => c.id === driverId);
  const gunman = HEIST_CREW_ROSTER.find((c) => c.id === gunmanId);

  const totalCrewCutPercent =
    (hacker?.cutPercent || 8) +
    (driver?.cutPercent || 7) +
    (gunman?.cutPercent || 9);
  const crewCutRp = Math.round((heist.grossTakeRp * totalCrewCutPercent) / 100);
  const netPlayerTakeRp = heist.grossTakeRp - crewCutRp;

  return {
    grossTakeRp: heist.grossTakeRp,
    totalCrewCutPercent,
    crewCutRp,
    netPlayerTakeRp,
  };
}

// ==================== AUTHENTIC JAKARTA ROADSIDE SPAWN SYSTEM ====================

export type TrafficSignKind =
  | 'dilarang_parkir'
  | 'batas_kecepatan_40'
  | 'batas_kecepatan_60'
  | 'khusus_busway'
  | 'peringatan_penyeberangan'
  | 'arah_wajib_lurus';

export interface TrafficSignSpawn {
  id: string;
  kind: TrafficSignKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  corridor: 'sudirman_ns' | 'merdeka_ew' | 'tol_layang';
}

export interface TollSignSpawn {
  id: string;
  variant: 'cantilever' | 'twin_post';
  theme: 'green_arterial' | 'blue_toll';
  topText: string;
  bottomText: string;
  badgeText: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface TransJakartaHalteSpawn {
  id: string;
  stationName: string;
  corridorCode: string;
  routeSummary: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface RoadsideSpawnLayout {
  trafficSigns: TrafficSignSpawn[];
  tollSigns: TollSignSpawn[];
  transJakartaHaltes: TransJakartaHalteSpawn[];
}

export interface SidewalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const MAIN_BOULEVARD_SIDEWALK_SLABS: SidewalkBounds[] = [
  // N-S Sudirman slabs (cx = ±9.2, width = 4.3 -> [7.05, 11.35])
  { minX: -11.35, maxX: -7.05, minZ: -86, maxZ: -42 },
  { minX: 7.05, maxX: 11.35, minZ: -86, maxZ: -42 },
  { minX: -11.35, maxX: -7.05, minZ: -19, maxZ: -8 },
  { minX: 7.05, maxX: 11.35, minZ: -19, maxZ: -8 },
  { minX: -11.35, maxX: -7.05, minZ: 19, maxZ: 25 },
  { minX: 7.05, maxX: 11.35, minZ: 19, maxZ: 25 },
  { minX: -11.35, maxX: -7.05, minZ: 40, maxZ: 86 },
  { minX: 7.05, maxX: 11.35, minZ: 40, maxZ: 86 },
  // E-W Merdeka slabs (cz = ±9.2, depth = 4.3 -> [7.05, 11.35])
  { minX: -82, maxX: -40, minZ: -11.35, maxZ: -7.05 },
  { minX: -82, maxX: -40, minZ: 7.05, maxZ: 11.35 },
  { minX: -25, maxX: -20, minZ: -11.35, maxZ: -7.05 },
  { minX: -25, maxX: -20, minZ: 7.05, maxZ: 11.35 },
  { minX: 20, maxX: 25, minZ: -11.35, maxZ: -7.05 },
  { minX: 20, maxX: 25, minZ: 7.05, maxZ: 11.35 },
  { minX: 40, maxX: 82, minZ: -11.35, maxZ: -7.05 },
  { minX: 40, maxX: 82, minZ: 7.05, maxZ: 11.35 },
];

export function getRoadsideGroundY(
  x: number,
  z: number,
  sidewalkSlabs: SidewalkBounds[] = MAIN_BOULEVARD_SIDEWALK_SLABS
): number {
  for (const s of sidewalkSlabs) {
    if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ) {
      return 0.14;
    }
  }
  return 0;
}

const KNOWN_PJU_POLES: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (let z = -76; z <= 76; z += 18) {
    if (Math.abs(z) < 21 || Math.abs(z - -26) < 7 || Math.abs(Math.abs(z) - 32) < 6) {
      continue;
    }
    pts.push([-7.45, z], [7.45, z]);
  }
  for (let x = -76; x <= 76; x += 20) {
    if (Math.abs(x) < 21 || Math.abs(Math.abs(x) - 32) < 6) continue;
    pts.push([x, -7.45], [x, 7.45]);
  }
  return pts;
})();

const KNOWN_BOULEVARD_TREES: [number, number][] = (() => {
  const pts: [number, number][] = [];
  for (let idx = 0; idx < 36; idx++) {
    const side = idx % 2 === 0 ? -10.8 : 10.8;
    const tx = idx < 18 ? side : -76 + (idx - 18) * 9;
    const tz = idx < 18 ? -76 + idx * 9 : side;
    pts.push([tx, tz]);
  }
  return pts;
})();

const KNOWN_STREETSCAPE_OBSTACLES: {
  x: number;
  z: number;
  hx: number;
  hz: number;
}[] = [
  // Existing 6 traffic signals
  { x: -7.8, z: -38.5, hx: 1.4, hz: 1.4 },
  { x: 7.8, z: -19.5, hx: 1.4, hz: 1.4 },
  { x: -7.8, z: 19.5, hx: 1.4, hz: 1.4 },
  { x: 7.8, z: 38.5, hx: 1.4, hz: 1.4 },
  { x: -38.5, z: -7.8, hx: 1.4, hz: 1.4 },
  { x: 38.5, z: 7.8, hx: 1.4, hz: 1.4 },
  // Existing 3 gantry column bases
  { x: -7.5, z: -50, hx: 1.8, hz: 1.8 },
  { x: 7.5, z: -50, hx: 1.8, hz: 1.8 },
  { x: -7.5, z: 42, hx: 1.8, hz: 1.8 },
  { x: 7.5, z: 42, hx: 1.8, hz: 1.8 },
  { x: -42, z: -7.5, hx: 1.8, hz: 1.8 },
  { x: -42, z: 7.5, hx: 1.8, hz: 1.8 },
  // Existing Warung stalls
  { x: -11, z: 22, hx: 2.6, hz: 2.6 },
  { x: 11, z: 20, hx: 2.6, hz: 2.6 },
  { x: -14, z: -22, hx: 2.6, hz: 2.6 },
  { x: 14, z: -22, hx: 2.6, hz: 2.6 },
  // Existing 2 streetscape shelters at (-9.0, -42) and (9.0, 42)
  { x: -9.0, z: -42, hx: 2.2, hz: 5.8 },
  { x: 9.0, z: 42, hx: 2.2, hz: 5.8 },
  // Initial sedan parked at (8.5, -16)
  { x: 8.5, z: -16, hx: 2.2, hz: 3.2 },
  // Enterable interior portals
  ...ENTERABLE_INTERIORS.map((p) => ({
    x: p.portalX,
    z: p.portalZ,
    hx: 3.2,
    hz: 3.2,
  })),
  // PJU poles
  ...KNOWN_PJU_POLES.map(([x, z]) => ({ x, z, hx: 0.85, hz: 0.85 })),
  // Boulevard shade trees (trunk + crown clearance)
  ...KNOWN_BOULEVARD_TREES.map(([x, z]) => ({ x, z, hx: 1.5, hz: 1.5 })),
];

export function isOnMainRoadwayFootprint(
  x: number,
  z: number,
  pad: number = 0.1
): boolean {
  if (Math.abs(x) < 7.0 + pad && Math.abs(z) < 96) return true;
  if (Math.abs(z) < 7.0 + pad && Math.abs(x) < 96) return true;
  if (Math.abs(Math.abs(x) - 32) < 5.0 + pad && Math.abs(z) < 82) return true;
  if (Math.abs(Math.abs(z) - 32) < 5.0 + pad && Math.abs(x) < 82) return true;
  if (z >= -30.6 - pad && z <= -21.4 + pad && Math.abs(x) <= 68.5 + pad) {
    return true;
  }
  return false;
}

export function isRoadsideSpotClear(
  x: number,
  z: number,
  halfX: number,
  halfZ: number,
  occupied: { x: number; z: number; hx: number; hz: number }[]
): boolean {
  // Keep outside world boundary
  if (Math.abs(x) + halfX > 88 || Math.abs(z) + halfZ > 88) return false;

  // Never block roadway lanes or Tol Layang deck/ramps
  const roadPad = Math.min(halfX, halfZ) * 0.25;
  if (isOnMainRoadwayFootprint(x, z, roadPad)) return false;

  // Keep outside Monas Central Plaza circle (r=18.5 + crosswalks)
  if (x * x + z * z < 19.6 * 19.6) return false;

  // Keep clear of initial player/vehicle spawn zone around (0, 26)
  if (Math.abs(x) < 11.8 && z >= 18.0 && z <= 29.0) return false;

  // Keep clear of CITY_BUILDINGS
  for (const b of CITY_BUILDINGS) {
    const hw = b.width * 0.5 + halfX + 0.8;
    const hd = b.depth * 0.5 + halfZ + 0.8;
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) {
      return false;
    }
  }

  // Keep clear of existing streetscape poles, signals, stalls, portals & shelters
  for (const obs of KNOWN_STREETSCAPE_OBSTACLES) {
    if (
      Math.abs(x - obs.x) < halfX + obs.hx &&
      Math.abs(z - obs.z) < halfZ + obs.hz
    ) {
      return false;
    }
  }

  // Keep clear of previously spawned roadside props
  for (const item of occupied) {
    if (
      Math.abs(x - item.x) < halfX + item.hx &&
      Math.abs(z - item.z) < halfZ + item.hz
    ) {
      return false;
    }
  }

  return true;
}

export function generateRoadsideSpawnLayout(
  sidewalkSlabs: SidewalkBounds[] = MAIN_BOULEVARD_SIDEWALK_SLABS
): RoadsideSpawnLayout {
  const occupied: { x: number; z: number; hx: number; hz: number }[] = [];
  const trafficSigns: TrafficSignSpawn[] = [];
  const tollSigns: TollSignSpawn[] = [];
  const transJakartaHaltes: TransJakartaHalteSpawn[] = [];

  // 1. Spawn Halte TransJakarta along primary N-S Sudirman & E-W Merdeka arterial corridors
  const halteCandidates: Omit<TransJakartaHalteSpawn, 'y'>[] = [
    {
      id: 'halte_bundaran_hi',
      stationName: 'HALTE BUNDARAN HI',
      corridorCode: 'K1',
      routeSummary: 'BLOK M  ↔  KOTA',
      x: -9.65,
      z: -67,
      rotY: 0,
    },
    {
      id: 'halte_dukuh_atas',
      stationName: 'HALTE DUKUH ATAS',
      corridorCode: 'K1',
      routeSummary: 'MONAS  ↔  SENAYAN',
      x: 9.65,
      z: -58,
      rotY: Math.PI,
    },
    {
      id: 'halte_blok_m',
      stationName: 'HALTE BLOK M',
      corridorCode: 'K1',
      routeSummary: 'BLOK M  ↔  HARMONI',
      x: -9.65,
      z: 59,
      rotY: 0,
    },
    {
      id: 'halte_karet_sudirman',
      stationName: 'HALTE KARET SUDIRMAN',
      corridorCode: 'K1',
      routeSummary: 'SUDIRMAN  ↔  MELAWAI',
      x: 9.65,
      z: 68,
      rotY: Math.PI,
    },
    {
      id: 'halte_tanah_abang',
      stationName: 'HALTE TANAH ABANG',
      corridorCode: 'K8',
      routeSummary: 'HARMONI  ↔  LEBAK BULUS',
      x: -58,
      z: 9.65,
      rotY: Math.PI / 2,
    },
    {
      id: 'halte_kota_tua',
      stationName: 'HALTE KOTA TUA',
      corridorCode: 'K12',
      routeSummary: 'KOTA  ↔  TANJUNG PRIOK',
      x: 50,
      z: 9.65,
      rotY: Math.PI / 2,
    },
    {
      id: 'halte_glodok_harco',
      stationName: 'HALTE GLODOK HARCO',
      corridorCode: 'K1',
      routeSummary: 'KOTA TUA  ↔  BLOK M',
      x: 75,
      z: -9.65,
      rotY: -Math.PI / 2,
    },
  ];

  for (const hc of halteCandidates) {
    const alongZ = Math.abs(Math.cos(hc.rotY)) > 0.5;
    const hx = alongZ ? 1.25 : 4.8;
    const hz = alongZ ? 4.8 : 1.25;
    if (isRoadsideSpotClear(hc.x, hc.z, hx, hz, occupied)) {
      transJakartaHaltes.push({
        ...hc,
        y: getRoadsideGroundY(hc.x, hc.z, sidewalkSlabs),
      });
      occupied.push({ x: hc.x, z: hc.z, hx: hx + 0.8, hz: hz + 0.8 });
    }
  }

  // 2. Spawn Papan Penunjuk Jalan Tol (Green Arterial & Blue Toll Directional Signs)
  const tollCandidates: Omit<TollSignSpawn, 'y'>[] = [
    {
      id: 'toll_sudirman_northbound',
      variant: 'cantilever',
      theme: 'green_arterial',
      topText: 'TOL DALAM KOTA ↑',
      bottomText: 'SEMANGGI · CAWANG · PRIOK',
      badgeText: 'TOL',
      x: -7.75,
      z: 45.5,
      rotY: 0,
    },
    {
      id: 'toll_sudirman_southbound',
      variant: 'cantilever',
      theme: 'green_arterial',
      topText: 'BLOK M · SENAYAN GBK ↑',
      bottomText: 'JALUR PROTOKOL SELATAN',
      badgeText: 'JKT',
      x: 7.75,
      z: 78.5,
      rotY: Math.PI,
    },
    {
      id: 'toll_thamrin_southbound',
      variant: 'cantilever',
      theme: 'green_arterial',
      topText: 'TOL SEMANGGI · MONAS ↑',
      bottomText: 'CAWANG · HALIM · BLOK M',
      badgeText: 'TOL',
      x: 7.75,
      z: -44.5,
      rotY: Math.PI,
    },
    {
      id: 'toll_thamrin_northbound',
      variant: 'cantilever',
      theme: 'blue_toll',
      topText: 'SCBD ←   PRIOK →',
      bottomText: 'TOL BANDARA SOETTA ↑',
      badgeText: 'TOL',
      x: -7.75,
      z: -80.5,
      rotY: 0,
    },
    {
      id: 'toll_ramp_semanggi_west',
      variant: 'twin_post',
      theme: 'blue_toll',
      topText: 'GERBANG TOL SEMANGGI',
      bottomText: 'e-TOLL · TOL LAYANG →',
      badgeText: 'TOL',
      x: -64.5,
      z: -19.8,
      rotY: -Math.PI / 2,
    },
    {
      id: 'toll_ramp_kemayoran_east',
      variant: 'twin_post',
      theme: 'blue_toll',
      topText: 'TOL LAYANG KEMAYORAN',
      bottomText: '← SCBD · SENAYAN · PIK 2',
      badgeText: 'TOL',
      x: 64.5,
      z: -19.8,
      rotY: Math.PI / 2,
    },
    {
      id: 'toll_ew_west_approach',
      variant: 'cantilever',
      theme: 'green_arterial',
      topText: 'MONAS · SUDIRMAN ↑',
      bottomText: 'AKSES TOL DALAM KOTA 200m',
      badgeText: 'TOL',
      x: -48.5,
      z: 7.75,
      rotY: -Math.PI / 2,
    },
    {
      id: 'toll_ew_east_approach',
      variant: 'cantilever',
      theme: 'green_arterial',
      topText: 'KOTA TUA ←   MONAS ↑',
      bottomText: 'TOL TANJUNG PRIOK · HALIM →',
      badgeText: 'TOL',
      x: 67.5,
      z: -7.75,
      rotY: Math.PI / 2,
    },
  ];

  for (const tc of tollCandidates) {
    const hx = tc.variant === 'twin_post' ? 2.1 : 1.0;
    const hz = tc.variant === 'twin_post' ? 1.4 : 1.0;
    if (isRoadsideSpotClear(tc.x, tc.z, hx, hz, occupied)) {
      tollSigns.push({
        ...tc,
        y: getRoadsideGroundY(tc.x, tc.z, sidewalkSlabs),
      });
      occupied.push({ x: tc.x, z: tc.z, hx: hx + 1.5, hz: hz + 1.5 });
    }
  }

  // 3. Spawn Rambu Lalu Lintas along N-S Sudirman, E-W Merdeka, and Tol Layang shoulders
  const nsSignSequence: TrafficSignKind[] = [
    'khusus_busway',
    'batas_kecepatan_60',
    'dilarang_parkir',
    'peringatan_penyeberangan',
    'arah_wajib_lurus',
    'batas_kecepatan_40',
  ];

  let signIndex = 0;

  // Sudirman N-S main corridor (West & East curbs)
  const nsZStops = [-81, -69, -54, -44, -22, 16, 22, 37, 48, 66, 79];
  for (const zPos of nsZStops) {
    for (const sideX of [-7.45, 7.45]) {
      const rotY = sideX < 0 ? 0 : Math.PI;
      const nearCrosswalk =
        Math.abs(Math.abs(zPos) - 21) < 3 ||
        Math.abs(Math.abs(zPos) - 38) < 3;
      const kind: TrafficSignKind = nearCrosswalk
        ? 'peringatan_penyeberangan'
        : nsSignSequence[signIndex % nsSignSequence.length];
      if (isRoadsideSpotClear(sideX, zPos, 0.55, 0.55, occupied)) {
        trafficSigns.push({
          id: `rambu_ns_${signIndex}`,
          kind,
          x: sideX,
          y: getRoadsideGroundY(sideX, zPos, sidewalkSlabs),
          z: zPos,
          rotY,
          corridor: 'sudirman_ns',
        });
        occupied.push({ x: sideX, z: zPos, hx: 1.8, hz: 1.8 });
        signIndex++;
      }
    }
  }

  // Merdeka E-W main corridor (North & South curbs)
  const ewXStops = [-78, -62, -46, -22, 22, 42, 58, 76];
  for (const xPos of ewXStops) {
    for (const sideZ of [-7.45, 7.45]) {
      const rotY = sideZ < 0 ? -Math.PI / 2 : Math.PI / 2;
      const nearCrosswalk = Math.abs(Math.abs(xPos) - 22) < 3;
      const kind: TrafficSignKind = nearCrosswalk
        ? 'peringatan_penyeberangan'
        : nsSignSequence[(signIndex + 2) % nsSignSequence.length];
      if (isRoadsideSpotClear(xPos, sideZ, 0.55, 0.55, occupied)) {
        trafficSigns.push({
          id: `rambu_ew_${signIndex}`,
          kind,
          x: xPos,
          y: getRoadsideGroundY(xPos, sideZ, sidewalkSlabs),
          z: sideZ,
          rotY,
          corridor: 'merdeka_ew',
        });
        occupied.push({ x: xPos, z: sideZ, hx: 1.8, hz: 1.8 });
        signIndex++;
      }
    }
  }

  // Tol Layang ramp shoulders (Eastbound & Westbound approaches)
  const tollShoulderCandidates: {
    x: number;
    z: number;
    rotY: number;
    kind: TrafficSignKind;
  }[] = [
    { x: -58, z: -20.5, rotY: -Math.PI / 2, kind: 'batas_kecepatan_60' },
    { x: -45, z: -20.5, rotY: -Math.PI / 2, kind: 'arah_wajib_lurus' },
    { x: 58, z: -31.5, rotY: Math.PI / 2, kind: 'batas_kecepatan_60' },
    { x: 45, z: -31.5, rotY: Math.PI / 2, kind: 'arah_wajib_lurus' },
  ];
  for (const ts of tollShoulderCandidates) {
    if (isRoadsideSpotClear(ts.x, ts.z, 0.55, 0.55, occupied)) {
      trafficSigns.push({
        id: `rambu_tol_${signIndex}`,
        kind: ts.kind,
        x: ts.x,
        y: getRoadsideGroundY(ts.x, ts.z, sidewalkSlabs),
        z: ts.z,
        rotY: ts.rotY,
        corridor: 'tol_layang',
      });
      occupied.push({ x: ts.x, z: ts.z, hx: 1.8, hz: 1.8 });
      signIndex++;
    }
  }

  return {
    trafficSigns,
    tollSigns,
    transJakartaHaltes,
  };
}

// ==================== JAKARTA NPC TRAFFIC AI SYSTEM ====================

export type TrafficRouteId =
  | 'ring_clockwise'
  | 'ring_ccw'
  | 'sudirman_north_arterial'
  | 'sudirman_south_arterial'
  | 'busway_corridor_north'
  | 'busway_corridor_south'
  | 'merdeka_west_arterial'
  | 'merdeka_east_arterial'
  | 'grand_boulevard_circuit'
  | 'tol_layang_express';

export interface TrafficWaypoint {
  x: number;
  z: number;
  pauseSec?: number;
}

export interface TrafficSpawnSpec {
  id: string;
  type: VehicleType;
  routeId: TrafficRouteId;
  layer: 'ground' | 'elevated';
  x: number;
  z: number;
  heading: number;
  waypointIndex: number;
  preferredSpeed: number;
}

export interface TrafficAISteppable {
  x: number;
  z: number;
  heading: number;
  speed: number;
  waypointIndex: number;
  stopTimer: number;
  preferredSpeed: number;
  layer: 'ground' | 'elevated';
}

export const TRAFFIC_ROUTES: Record<TrafficRouteId, TrafficWaypoint[]> = {
  // Outer Monas perimeter ring (Left-hand driving clockwise)
  ring_clockwise: [
    { x: -34.4, z: 34.4 },
    { x: -34.4, z: -34.4 },
    { x: 34.4, z: -34.4 },
    { x: 34.4, z: 34.4 },
  ],
  // Inner Monas perimeter ring (Left-hand driving counter-clockwise)
  ring_ccw: [
    { x: -29.6, z: -29.6 },
    { x: -29.6, z: 29.6 },
    { x: 29.6, z: 29.6 },
    { x: 29.6, z: -29.6 },
  ],
  // North Sudirman–Thamrin mixed traffic loop
  sudirman_north_arterial: [
    { x: -4.6, z: -34.4 },
    { x: -4.6, z: -80 },
    { x: 4.6, z: -80 },
    { x: 4.6, z: -34.4 },
  ],
  // South Sudirman–Blok M mixed traffic loop
  sudirman_south_arterial: [
    { x: 4.6, z: 34.4 },
    { x: 4.6, z: 80 },
    { x: -4.6, z: 80 },
    { x: -4.6, z: 34.4 },
  ],
  // TransJakarta Corridor 1 North Busway (pauses at Halte Bundaran HI & Dukuh Atas)
  busway_corridor_north: [
    { x: -1.85, z: -38 },
    { x: -1.85, z: -67, pauseSec: 1.6 },
    { x: -1.85, z: -81 },
    { x: 1.85, z: -81 },
    { x: 1.85, z: -58, pauseSec: 1.6 },
    { x: 1.85, z: -38 },
  ],
  // TransJakarta Corridor 1 South Busway (pauses at Halte Blok M & Karet Sudirman)
  busway_corridor_south: [
    { x: 1.85, z: 38 },
    { x: 1.85, z: 68, pauseSec: 1.6 },
    { x: 1.85, z: 81 },
    { x: -1.85, z: 81 },
    { x: -1.85, z: 59, pauseSec: 1.6 },
    { x: -1.85, z: 38 },
  ],
  // West Medan Merdeka arterial loop (clears Blok A Tanah Abang & passes Halte Tanah Abang)
  merdeka_west_arterial: [
    { x: -34.4, z: 0.8 },
    { x: -80, z: 0.8 },
    { x: -80, z: 4.6 },
    { x: -34.4, z: 4.6 },
  ],
  // East Medan Merdeka arterial loop (clears Museum Fatahillah & passes Halte Kota Tua)
  merdeka_east_arterial: [
    { x: 34.4, z: 4.6 },
    { x: 80, z: 4.6 },
    { x: 80, z: 0.8 },
    { x: 34.4, z: 0.8 },
  ],
  // Grand Cross-City Express connecting Ring Road + all 4 Boulevard Spurs
  grand_boulevard_circuit: [
    { x: -34.4, z: -34.4 },
    { x: -4.6, z: -34.4 },
    { x: -4.6, z: -78 },
    { x: 4.6, z: -78 },
    { x: 4.6, z: -34.4 },
    { x: 34.4, z: -34.4 },
    { x: 34.4, z: 4.6 },
    { x: 78, z: 4.6 },
    { x: 78, z: 0.8 },
    { x: 34.4, z: 0.8 },
    { x: 34.4, z: 34.4 },
    { x: 4.6, z: 34.4 },
    { x: 4.6, z: 78 },
    { x: -4.6, z: 78 },
    { x: -4.6, z: 34.4 },
    { x: -34.4, z: 34.4 },
    { x: -34.4, z: 0.8 },
    { x: -78, z: 0.8 },
    { x: -78, z: 4.6 },
    { x: -34.4, z: 4.6 },
  ],
  // Elevated Tol Layang Semanggi – Kemayoran Express Loop
  tol_layang_express: [
    { x: -65, z: -24.2 },
    { x: 65, z: -24.2 },
    { x: 65, z: -27.8 },
    { x: -65, z: -27.8 },
  ],
};

function interpolateRoutePosition(
  route: TrafficWaypoint[],
  segmentIndex: number,
  t: number
): { x: number; z: number; heading: number; waypointIndex: number } {
  const idx = ((segmentIndex % route.length) + route.length) % route.length;
  const nextIdx = (idx + 1) % route.length;
  const a = route[idx];
  const b = route[nextIdx];
  const x = a.x + (b.x - a.x) * t;
  const z = a.z + (b.z - a.z) * t;
  const heading = Math.atan2(b.x - a.x, b.z - a.z);
  return { x, z, heading, waypointIndex: nextIdx };
}

export function generateInitialTrafficSpawns(): TrafficSpawnSpec[] {
  const assignments: {
    id: string;
    type: VehicleType;
    routeId: TrafficRouteId;
    seg: number;
    t: number;
    speed: number;
  }[] = [
    // TransJakarta Corridor 1 BRT Buses
    { id: 'traffic_tj_n1', type: 'transjakarta', routeId: 'busway_corridor_north', seg: 0, t: 0.35, speed: 9.2 },
    { id: 'traffic_tj_n2', type: 'transjakarta', routeId: 'busway_corridor_north', seg: 3, t: 0.4, speed: 9.2 },
    { id: 'traffic_tj_s1', type: 'transjakarta', routeId: 'busway_corridor_south', seg: 0, t: 0.45, speed: 9.2 },
    // Patroli Polisi Sabhara
    { id: 'traffic_polisi_1', type: 'polisi', routeId: 'ring_clockwise', seg: 1, t: 0.42, speed: 11.2 },
    { id: 'traffic_polisi_2', type: 'polisi', routeId: 'grand_boulevard_circuit', seg: 10, t: 0.5, speed: 11.4 },
    // Ring Road & Cross-City Traffic
    { id: 'traffic_angkot_ring', type: 'angkot', routeId: 'ring_clockwise', seg: 3, t: 0.35, speed: 9.4 },
    { id: 'traffic_sedan_ring', type: 'sedan', routeId: 'ring_ccw', seg: 0, t: 0.48, speed: 12.2 },
    { id: 'traffic_bajaj_ring', type: 'bajaj', routeId: 'ring_ccw', seg: 2, t: 0.52, speed: 7.8 },
    // North & South Sudirman Arterial Traffic
    { id: 'traffic_sedan_ns1', type: 'sedan', routeId: 'sudirman_north_arterial', seg: 0, t: 0.38, speed: 12.6 },
    { id: 'traffic_ojek_ns2', type: 'ojek', routeId: 'sudirman_north_arterial', seg: 2, t: 0.42, speed: 11.0 },
    { id: 'traffic_angkot_ss1', type: 'angkot', routeId: 'sudirman_south_arterial', seg: 0, t: 0.35, speed: 9.5 },
    { id: 'traffic_bajaj_ss2', type: 'bajaj', routeId: 'sudirman_south_arterial', seg: 2, t: 0.5, speed: 8.0 },
    // East & West Merdeka Arterial Traffic
    { id: 'traffic_metromini_ew1', type: 'metromini', routeId: 'merdeka_west_arterial', seg: 0, t: 0.3, speed: 8.6 },
    { id: 'traffic_ojek_ew2', type: 'ojek', routeId: 'merdeka_east_arterial', seg: 0, t: 0.45, speed: 11.2 },
    { id: 'traffic_angkot_grand', type: 'angkot', routeId: 'grand_boulevard_circuit', seg: 1, t: 0.55, speed: 9.6 },
    // Elevated Tol Layang Highway Express Traffic
    { id: 'traffic_sedan_tol1', type: 'sedan', routeId: 'tol_layang_express', seg: 0, t: 0.32, speed: 15.8 },
    { id: 'traffic_sedan_tol2', type: 'sedan', routeId: 'tol_layang_express', seg: 2, t: 0.35, speed: 14.8 },
  ];

  return assignments.map((item) => {
    const route = TRAFFIC_ROUTES[item.routeId];
    const pos = interpolateRoutePosition(route, item.seg, item.t);
    return {
      id: item.id,
      type: item.type,
      routeId: item.routeId,
      layer: item.routeId === 'tol_layang_express' ? 'elevated' : 'ground',
      x: pos.x,
      z: pos.z,
      heading: pos.heading,
      waypointIndex: pos.waypointIndex,
      preferredSpeed: item.speed,
    };
  });
}

export function stepTrafficVehicleInPlace(
  vehicle: TrafficAISteppable,
  route: TrafficWaypoint[],
  aheadObstacleDist: number,
  dt: number
): void {
  if (route.length === 0 || dt <= 0) return;

  const wpIdx = ((vehicle.waypointIndex % route.length) + route.length) % route.length;
  const targetWp = route[wpIdx];

  const dx = targetWp.x - vehicle.x;
  const dz = targetWp.z - vehicle.z;
  const distToWp = Math.hypot(dx, dz);

  // Advance waypoint smoothly when entering arrival radius
  if (distToWp < 2.2) {
    if (targetWp.pauseSec && targetWp.pauseSec > 0) {
      vehicle.stopTimer = targetWp.pauseSec;
    }
    vehicle.waypointIndex = (wpIdx + 1) % route.length;
  }

  const nextWp = route[vehicle.waypointIndex];
  const ndx = nextWp.x - vehicle.x;
  const ndz = nextWp.z - vehicle.z;
  const targetHeading =
    ndx * ndx + ndz * ndz > 0.0001 ? Math.atan2(ndx, ndz) : vehicle.heading;

  // Shortest signed angular error in [-PI, PI]
  const angleDiff = Math.atan2(
    Math.sin(targetHeading - vehicle.heading),
    Math.cos(targetHeading - vehicle.heading)
  );
  const maxTurn = 3.8 * dt;
  const clampedTurn = Math.max(-maxTurn, Math.min(maxTurn, angleDiff));
  vehicle.heading += clampedTurn;

  // Target cruising speed modulated by corners, Halte dwell stops & car-following clearance
  let targetSpeed = vehicle.preferredSpeed;
  if (Math.abs(angleDiff) > 0.36) {
    targetSpeed = Math.min(targetSpeed, 5.8);
  }

  if (vehicle.stopTimer > 0) {
    vehicle.stopTimer = Math.max(0, vehicle.stopTimer - dt);
    targetSpeed = 0;
  }

  if (aheadObstacleDist < 5.4) {
    targetSpeed = 0;
  } else if (aheadObstacleDist < 13.5) {
    const gapFactor = (aheadObstacleDist - 5.4) / (13.5 - 5.4);
    targetSpeed = Math.min(targetSpeed, vehicle.preferredSpeed * gapFactor);
  }

  // Smooth acceleration and braking
  const rate = targetSpeed < vehicle.speed ? 16.5 : 8.5;
  const deltaV = targetSpeed - vehicle.speed;
  const maxStep = rate * dt;
  if (Math.abs(deltaV) <= maxStep) {
    vehicle.speed = targetSpeed;
  } else {
    vehicle.speed += Math.sign(deltaV) * maxStep;
  }
  if (vehicle.speed < 0) vehicle.speed = 0;

  const nx = vehicle.x + Math.sin(vehicle.heading) * vehicle.speed * dt;
  const nz = vehicle.z + Math.cos(vehicle.heading) * vehicle.speed * dt;

  if (vehicle.layer === 'ground') {
    const col = resolveCircleAABBCollision(nx, nz, 1.9);
    vehicle.x = col.x;
    vehicle.z = col.z;
  } else {
    vehicle.x = nx;
    vehicle.z = nz;
  }
}

export function stepTrafficVehicleAI(
  state: TrafficAISteppable,
  route: TrafficWaypoint[],
  aheadObstacleDist: number,
  dt: number
): TrafficAISteppable {
  const next: TrafficAISteppable = { ...state };
  stepTrafficVehicleInPlace(next, route, aheadObstacleDist, dt);
  return next;
}

export type AmbientCueId =
  | 'distant_traffic'
  | 'street_vendor_tektek'
  | 'prayer_call_echo'
  | 'harbor_foghorn_gulls'
  | 'monsoon_rain_thunder'
  | 'night_cicada_neon'
  | 'mrt_chime_station';

export type AmbientBedType =
  | 'urban_traffic'
  | 'coastal_wind'
  | 'market_hum'
  | 'monsoon_downpour'
  | 'night_city';

export interface AmbientSoundscapeProfile {
  districtId: string;
  weatherMode: WeatherMode;
  primaryBed: AmbientBedType;
  bedFilterHz: number;
  bedGain: number;
  lfoRateHz: number;
  cueCycle: AmbientCueId[];
  activeCue: AmbientCueId;
  activeCueLabel: string;
}

export const AMBIENT_CUE_LABELS: Record<AmbientCueId, string> = {
  distant_traffic: 'Deru Lalu Lintas & Klakson Kejauhan',
  street_vendor_tektek: 'Pedagang Tek-Tek & Kuliner Kaki Lima',
  prayer_call_echo: 'Gema Bedug & Panggilan Doa Kejauhan',
  harbor_foghorn_gulls: 'Peluit Kapal Kargo & Ombak Pesisir',
  monsoon_rain_thunder: 'Derai Hujan Monsun & Guntur Kota',
  night_cicada_neon: 'Angin Malam & Jangkrik Taman Kota',
  mrt_chime_station: 'Bel Peron MRT & Koridor Protokol',
};

const COASTAL_DISTRICTS = new Set([
  'tanjung_priok',
  'ancol_pik',
  'pik2_mangrove',
]);

const STREET_FOOD_MARKET_DISTRICTS = new Set([
  'tanah_abang',
  'blok_m',
  'kota_tua',
  'kemayoran',
]);

const TRANSIT_CBD_DISTRICTS = new Set([
  'sudirman',
  'scbd',
  'halim_station',
  'senayan_gbk',
]);

export function resolveJakartaAmbientProfile(
  districtId: string,
  weatherMode: WeatherMode,
  cycleStep: number = 0
): AmbientSoundscapeProfile {
  const isCoastal = COASTAL_DISTRICTS.has(districtId);
  const isMarket = STREET_FOOD_MARKET_DISTRICTS.has(districtId);
  const isTransitCbd = TRANSIT_CBD_DISTRICTS.has(districtId);

  let primaryBed: AmbientBedType = 'urban_traffic';
  let bedFilterHz = 360;
  let bedGain = 0.018;
  let lfoRateHz = 0.18;

  if (weatherMode === 'hujan') {
    primaryBed = 'monsoon_downpour';
    bedFilterHz = 820;
    bedGain = 0.026;
    lfoRateHz = 0.28;
  } else if (isCoastal) {
    primaryBed = 'coastal_wind';
    bedFilterHz = 480;
    bedGain = 0.02;
    lfoRateHz = 0.14;
  } else if (isMarket) {
    primaryBed = 'market_hum';
    bedFilterHz = 430;
    bedGain = 0.019;
    lfoRateHz = 0.22;
  } else if (weatherMode === 'malam') {
    primaryBed = 'night_city';
    bedFilterHz = 290;
    bedGain = 0.015;
    lfoRateHz = 0.12;
  }

  const cueCycle: AmbientCueId[] = [];

  if (weatherMode === 'hujan') {
    cueCycle.push('monsoon_rain_thunder');
    if (isCoastal) {
      cueCycle.push('harbor_foghorn_gulls', 'distant_traffic');
    } else if (isMarket) {
      cueCycle.push('street_vendor_tektek', 'distant_traffic');
    } else {
      cueCycle.push('distant_traffic', 'mrt_chime_station');
    }
  } else if (weatherMode === 'senja') {
    // Dusk / Maghrib & golden hour across Jakarta
    if (isCoastal) {
      cueCycle.push(
        'harbor_foghorn_gulls',
        'prayer_call_echo',
        'distant_traffic'
      );
    } else if (isMarket) {
      cueCycle.push(
        'prayer_call_echo',
        'street_vendor_tektek',
        'distant_traffic'
      );
    } else if (isTransitCbd) {
      cueCycle.push(
        'distant_traffic',
        'mrt_chime_station',
        'prayer_call_echo'
      );
    } else {
      // Monas / TMII cultural & civic heart
      cueCycle.push(
        'prayer_call_echo',
        'distant_traffic',
        'street_vendor_tektek'
      );
    }
  } else if (weatherMode === 'siang') {
    // Morning / Daytime bustling Jakarta
    if (isCoastal) {
      cueCycle.push(
        'harbor_foghorn_gulls',
        'distant_traffic',
        'prayer_call_echo'
      );
    } else if (isMarket) {
      cueCycle.push(
        'street_vendor_tektek',
        'distant_traffic',
        'prayer_call_echo'
      );
    } else if (isTransitCbd) {
      cueCycle.push(
        'distant_traffic',
        'mrt_chime_station',
        'street_vendor_tektek'
      );
    } else {
      cueCycle.push(
        'prayer_call_echo',
        'distant_traffic',
        'mrt_chime_station'
      );
    }
  } else {
    // 'malam' — Nighttime culinary stalls, distant traffic & night breeze
    if (isCoastal) {
      cueCycle.push(
        'harbor_foghorn_gulls',
        'night_cicada_neon',
        'street_vendor_tektek'
      );
    } else if (isMarket) {
      cueCycle.push(
        'street_vendor_tektek',
        'distant_traffic',
        'night_cicada_neon'
      );
    } else if (isTransitCbd) {
      cueCycle.push(
        'distant_traffic',
        'mrt_chime_station',
        'night_cicada_neon'
      );
    } else {
      cueCycle.push(
        'night_cicada_neon',
        'street_vendor_tektek',
        'distant_traffic'
      );
    }
  }

  const normalizedIdx =
    ((Math.floor(cycleStep) % cueCycle.length) + cueCycle.length) %
    cueCycle.length;
  const activeCue = cueCycle[normalizedIdx];

  return {
    districtId,
    weatherMode,
    primaryBed,
    bedFilterHz,
    bedGain,
    lfoRateHz,
    cueCycle,
    activeCue,
    activeCueLabel: AMBIENT_CUE_LABELS[activeCue],
  };
}

export interface RgbColorTuple {
  r: number;
  g: number;
  b: number;
}

export interface WeatherEnvironmentSpec {
  id: WeatherMode;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  skyTopHex: number;
  skyHorizonHex: number;
  skyBottomHex: number;
  sunColorHex: number;
  sunGlowStrength: number;
  sunDir: [number, number, number];
  fogHorizonHex: number;
  fogDensity: number;
  monasPlazaLightIntensity: number;
  sudirmanPlazaLightIntensity: number;
  wetnessFactor: number;
  nightFactor: number;
}

export const WEATHER_ENVIRONMENT_TARGETS: Record<
  WeatherMode,
  WeatherEnvironmentSpec
> = {
  senja: {
    id: 'senja',
    sunHex: 0xffb067,
    sunIntensity: 1.35,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e2430,
    hemiIntensity: 0.62,
    skyTopHex: 0x0c1428,
    skyHorizonHex: 0xb45309,
    skyBottomHex: 0x0f172a,
    sunColorHex: 0xfbbf24,
    sunGlowStrength: 0.45,
    sunDir: [0.55, 0.22, 0.8],
    fogHorizonHex: 0x1e2638,
    fogDensity: 0.0028,
    monasPlazaLightIntensity: 1.25,
    sudirmanPlazaLightIntensity: 1.05,
    wetnessFactor: 0,
    nightFactor: 0.65,
  },
  malam: {
    id: 'malam',
    sunHex: 0x60a5fa,
    sunIntensity: 0.72,
    hemiSkyHex: 0x38bdf8,
    hemiGroundHex: 0x090d16,
    hemiIntensity: 0.48,
    skyTopHex: 0x050814,
    skyHorizonHex: 0x111c33,
    skyBottomHex: 0x070b14,
    sunColorHex: 0x93c5fd,
    sunGlowStrength: 0.35,
    sunDir: [-0.45, 0.48, -0.75],
    fogHorizonHex: 0x0f192d,
    fogDensity: 0.0032,
    monasPlazaLightIntensity: 1.65,
    sudirmanPlazaLightIntensity: 1.45,
    wetnessFactor: 0,
    nightFactor: 1.0,
  },
  siang: {
    id: 'siang',
    sunHex: 0xfff7ed,
    sunIntensity: 1.48,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.68,
    skyTopHex: 0x1e40af,
    skyHorizonHex: 0x60a5fa,
    skyBottomHex: 0x1e293b,
    sunColorHex: 0xfffbeb,
    sunGlowStrength: 0.45,
    sunDir: [0.5, 0.72, 0.48],
    fogHorizonHex: 0x475569,
    fogDensity: 0.0022,
    monasPlazaLightIntensity: 0.25,
    sudirmanPlazaLightIntensity: 0.2,
    wetnessFactor: 0,
    nightFactor: 0.0,
  },
  hujan: {
    id: 'hujan',
    sunHex: 0x94a3b8,
    sunIntensity: 0.85,
    hemiSkyHex: 0x64748b,
    hemiGroundHex: 0x0b0f19,
    hemiIntensity: 0.54,
    skyTopHex: 0x0c1322,
    skyHorizonHex: 0x1e293b,
    skyBottomHex: 0x0f172a,
    sunColorHex: 0x94a3b8,
    sunGlowStrength: 0.12,
    sunDir: [0.35, 0.55, 0.65],
    fogHorizonHex: 0x1e293b,
    fogDensity: 0.0042,
    monasPlazaLightIntensity: 1.45,
    sudirmanPlazaLightIntensity: 1.25,
    wetnessFactor: 1.0,
    nightFactor: 0.65,
  },
};

export interface WeatherTransitionState {
  targetMode: WeatherMode;
  sunRgb: RgbColorTuple;
  sunIntensity: number;
  hemiSkyRgb: RgbColorTuple;
  hemiGroundRgb: RgbColorTuple;
  hemiIntensity: number;
  skyTopRgb: RgbColorTuple;
  skyHorizonRgb: RgbColorTuple;
  skyBottomRgb: RgbColorTuple;
  sunColorRgb: RgbColorTuple;
  sunGlowStrength: number;
  sunDir: [number, number, number];
  fogHorizonRgb: RgbColorTuple;
  fogDensity: number;
  monasPlazaLightIntensity: number;
  sudirmanPlazaLightIntensity: number;
  wetnessFactor: number;
  nightFactor: number;
}

function hexToRgbTuple(hex: number): RgbColorTuple {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

function normalizeTuple3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgbInPlace(
  cur: RgbColorTuple,
  targetHex: number,
  t: number
): void {
  const tr = ((targetHex >> 16) & 0xff) / 255;
  const tg = ((targetHex >> 8) & 0xff) / 255;
  const tb = (targetHex & 0xff) / 255;
  cur.r += (tr - cur.r) * t;
  cur.g += (tg - cur.g) * t;
  cur.b += (tb - cur.b) * t;
}

export function createInitialWeatherTransitionState(
  initialMode: WeatherMode
): WeatherTransitionState {
  const spec = WEATHER_ENVIRONMENT_TARGETS[initialMode] || WEATHER_ENVIRONMENT_TARGETS.senja;
  return {
    targetMode: spec.id,
    sunRgb: hexToRgbTuple(spec.sunHex),
    sunIntensity: spec.sunIntensity,
    hemiSkyRgb: hexToRgbTuple(spec.hemiSkyHex),
    hemiGroundRgb: hexToRgbTuple(spec.hemiGroundHex),
    hemiIntensity: spec.hemiIntensity,
    skyTopRgb: hexToRgbTuple(spec.skyTopHex),
    skyHorizonRgb: hexToRgbTuple(spec.skyHorizonHex),
    skyBottomRgb: hexToRgbTuple(spec.skyBottomHex),
    sunColorRgb: hexToRgbTuple(spec.sunColorHex),
    sunGlowStrength: spec.sunGlowStrength,
    sunDir: normalizeTuple3(spec.sunDir),
    fogHorizonRgb: hexToRgbTuple(spec.fogHorizonHex),
    fogDensity: spec.fogDensity,
    monasPlazaLightIntensity: spec.monasPlazaLightIntensity,
    sudirmanPlazaLightIntensity: spec.sudirmanPlazaLightIntensity,
    wetnessFactor: spec.wetnessFactor,
    nightFactor: spec.nightFactor,
  };
}

export function stepWeatherTransitionInPlace(
  state: WeatherTransitionState,
  targetMode: WeatherMode,
  dt: number,
  transitionRate: number = 1.65
): void {
  const target = WEATHER_ENVIRONMENT_TARGETS[targetMode] || WEATHER_ENVIRONMENT_TARGETS.senja;
  state.targetMode = target.id;
  if (dt <= 0) return;

  const alpha = 1 - Math.exp(-Math.max(0.1, transitionRate) * dt);

  lerpRgbInPlace(state.sunRgb, target.sunHex, alpha);
  state.sunIntensity = lerpScalar(state.sunIntensity, target.sunIntensity, alpha);

  lerpRgbInPlace(state.hemiSkyRgb, target.hemiSkyHex, alpha);
  lerpRgbInPlace(state.hemiGroundRgb, target.hemiGroundHex, alpha);
  state.hemiIntensity = lerpScalar(state.hemiIntensity, target.hemiIntensity, alpha);

  lerpRgbInPlace(state.skyTopRgb, target.skyTopHex, alpha);
  lerpRgbInPlace(state.skyHorizonRgb, target.skyHorizonHex, alpha);
  lerpRgbInPlace(state.skyBottomRgb, target.skyBottomHex, alpha);
  lerpRgbInPlace(state.sunColorRgb, target.sunColorHex, alpha);
  state.sunGlowStrength = lerpScalar(
    state.sunGlowStrength,
    target.sunGlowStrength,
    alpha
  );

  const normTargetDir = normalizeTuple3(target.sunDir);
  const dx = lerpScalar(state.sunDir[0], normTargetDir[0], alpha);
  const dy = lerpScalar(state.sunDir[1], normTargetDir[1], alpha);
  const dz = lerpScalar(state.sunDir[2], normTargetDir[2], alpha);
  const dLen = Math.hypot(dx, dy, dz) || 1;
  state.sunDir[0] = dx / dLen;
  state.sunDir[1] = dy / dLen;
  state.sunDir[2] = dz / dLen;

  lerpRgbInPlace(state.fogHorizonRgb, target.fogHorizonHex, alpha);
  state.fogDensity = lerpScalar(state.fogDensity, target.fogDensity, alpha);

  state.monasPlazaLightIntensity = lerpScalar(
    state.monasPlazaLightIntensity,
    target.monasPlazaLightIntensity,
    alpha
  );
  state.sudirmanPlazaLightIntensity = lerpScalar(
    state.sudirmanPlazaLightIntensity,
    target.sudirmanPlazaLightIntensity,
    alpha
  );

  state.wetnessFactor = lerpScalar(state.wetnessFactor, target.wetnessFactor, alpha);
  state.nightFactor = lerpScalar(state.nightFactor, target.nightFactor, alpha);
}

export function stepWeatherTransition(
  state: WeatherTransitionState,
  targetMode: WeatherMode,
  dt: number,
  transitionRate: number = 1.65
): WeatherTransitionState {
  const next: WeatherTransitionState = {
    ...state,
    sunRgb: { ...state.sunRgb },
    hemiSkyRgb: { ...state.hemiSkyRgb },
    hemiGroundRgb: { ...state.hemiGroundRgb },
    skyTopRgb: { ...state.skyTopRgb },
    skyHorizonRgb: { ...state.skyHorizonRgb },
    skyBottomRgb: { ...state.skyBottomRgb },
    sunColorRgb: { ...state.sunColorRgb },
    sunDir: [...state.sunDir] as [number, number, number],
    fogHorizonRgb: { ...state.fogHorizonRgb },
  };
  stepWeatherTransitionInPlace(next, targetMode, dt, transitionRate);
  return next;
}







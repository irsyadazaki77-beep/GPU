import type {
  DistrictZone,
  EnterableInteriorSpec,
  FactionId,
  GrandHeistSpec,
  HeistCrewMemberSpec,
  HeistId,
  PlayerProgressState,
  StoryChoiceOption,
} from './types';
export { STORY_MISSIONS } from './missionsData';

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
  {
    id: 'pondok_indah',
    name: 'Pondok Indah & TB Simatupang',
    subtitle: 'Kawasan Elit Selatan & Menara Korporat JORR',
    centerX: -145,
    centerZ: 160,
    radius: 52,
  },
  {
    id: 'kemang_selatan',
    name: 'Kemang Village & Koridor Selatan',
    subtitle: 'Distrik Kafe Malam & Boulevard Lingkar Luar',
    centerX: 48,
    centerZ: 172,
    radius: 50,
  },
  {
    id: 'kelapa_gading',
    name: 'Kelapa Gading & Marunda Timur',
    subtitle: 'Sentra Boulevard Timur & Depot Logistik JORR',
    centerX: 172,
    centerZ: 48,
    radius: 52,
  },
  {
    id: 'pantai_pik_utara',
    name: 'Pantai Pasir Putih & Kargo Barat',
    subtitle: 'Klub Pantai Pesisir Barat & Hub Kargo Bandara',
    centerX: -172,
    centerZ: 12,
    radius: 52,
  },
];

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

export const WARUNG_STALL_LOCATIONS: [number, number][] = [
  [-11, 22],
  [11, 20],
  [-14, -22],
  [14, -22],
];

export const ENTERABLE_INTERIORS: EnterableInteriorSpec[] = [
  {
    id: 'warung',
    name: 'Warung Kopi & Jajanan Nusantara',
    subtitle: 'Racik Jajanan Pasar & Kopi Gula Aren untuk Pulihkan HP & Buff Stamina',
    districtName: 'Melawai & Sabang',
    portalX: -11,
    portalZ: 22,
    accentHex: 0x10b981,
  },
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
  {
    id: 'safehouse_trio',
    name: 'Safehouse Trio Menteng & Tanah Abang',
    subtitle: 'Tidur (+6 Jam & Auto-Save), Lemari Senjata, Ganti Setelan & Ganti Protagonis',
    districtName: 'Menteng & Medan Merdeka',
    portalX: -14,
    portalZ: 18,
    accentHex: 0x38bdf8,
  },
  {
    id: 'faction_hq_jalanan',
    name: 'Markas Komando Jawara Tanah Abang',
    subtitle: 'Meja Rapat Operasi Faksi Jalanan & Kontrak Teritori Pasar',
    districtName: 'Pasar Tanah Abang',
    portalX: -42,
    portalZ: -12,
    accentHex: 0xef4444,
  },
  {
    id: 'faction_hq_sindikat',
    name: 'Suite Eksekutif Sindikat Menara SCBD',
    subtitle: 'Meja Taktis Bursa BAJSA, Operasi Sabotase & Grand Heist',
    districtName: 'SCBD & Sudirman',
    portalX: -46,
    portalZ: -52,
    accentHex: 0x8b5cf6,
  },
  {
    id: 'faction_hq_rakyat',
    name: 'Balai Solidaritas Rakyat Blok M',
    subtitle: 'Posko Koalisi Warga, Kurir Ojol & Misi Pertahanan Distrik',
    districtName: 'Blok M & Melawai',
    portalX: -12,
    portalZ: 48,
    accentHex: 0x14b8a6,
  },
  {
    id: 'glodok_tech_shop',
    name: 'Bursa Siber & Senjata Glodok Harco',
    subtitle: 'Upgrade Chipset Drone, Amunisi Taktis & Info Rumor NPC Glodok',
    districtName: 'Kota Tua & Glodok',
    portalX: 42,
    portalZ: 24,
    accentHex: 0xf97316,
  },
];

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

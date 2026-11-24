import type {
  ActiveWorldRoadEvent,
  BuildingFootprint,
  CustomRaceTrackSpec,
  RaceRecordEntry,
  RaceTimeMedal,
  RoadsideSpawnLayout,
  SidewalkBounds,
  StreetRaceSpec,
  TollSignSpawn,
  TrafficAISteppable,
  TrafficRouteId,
  TrafficSignalPhase,
  TrafficSignalState,
  TrafficSignKind,
  TrafficSignSpawn,
  TrafficSpawnSpec,
  TrafficWaypoint,
  TransJakartaHalteSpawn,
  VehicleCustomPaintSpec,
  VehicleSpec,
  VehicleType,
  VehicleUnderglowSpec,
  WorldClockEventTickerState,
  WorldRoadEventKind,
  WorldRoadEventSpec,
} from './types';
import { ENTERABLE_INTERIORS } from './heists';
import { CITY_BUILDINGS, MAIN_BOULEVARD_SIDEWALK_SLABS } from './world/bounds';
import {
  SpatialHashGrid,
  resolveCircleAABBCollision,
} from './world/spatial';

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
  speedboat: {
    type: 'speedboat',
    name: 'Speedboat Barracuda Maritim',
    subtitle: 'Penyelundup Cepat Teluk Jakarta & Kepulauan Seribu',
    maxSpeed: 40,
    acceleration: 27,
    turnRate: 2.8,
    maxHp: 240,
    colorHex: 0x0284c7,
    accentHex: 0xf8fafc,
    radius: 2.4,
    isWatercraft: true,
  },
};

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

export const VEHICLE_UNDERGLOWS: VehicleUnderglowSpec[] = [
  { id: 'glow_off', name: 'Tanpa Lampu Kolong', colorHex: null, cssColor: '#334155', price: 0 },
  { id: 'glow_cyan', name: 'Neon Sian Siber', colorHex: 0x22d3ee, cssColor: '#22d3ee', price: 95000 },
  { id: 'glow_gold', name: 'Neon Emas Monas', colorHex: 0xfacc15, cssColor: '#facc15', price: 95000 },
  { id: 'glow_red', name: 'Neon Merah Balap', colorHex: 0xef4444, cssColor: '#ef4444', price: 95000 },
  { id: 'glow_purple', name: 'Neon Ungu Malam', colorHex: 0xc084fc, cssColor: '#c084fc', price: 110000 },
  { id: 'glow_green', name: 'Neon Hijau Nitro', colorHex: 0x22c55e, cssColor: '#22c55e', price: 95000 },
];

export const STREET_RACES: StreetRaceSpec[] = [
  {
    id: 'race_tol_layang',
    name: 'GP Malam Tol Layang Semanggi',
    subtitle: 'Lintasan Atas Tol Layang Semanggi & SCBD Selatan (4 Checkpoint)',
    entryFeeRp: 50000,
    rewardRp: 650000,
    checkpoints: [
      [-45, 80],
      [0, 80],
      [45, 80],
      [0, 32],
    ],
  },
  {
    id: 'race_sudirman_sprint',
    name: 'Sprint Neon Sudirman – Bundaran HI',
    subtitle: 'Adu Kecepatan Mengitari Monas, Bundaran HI & Koridor Sudirman (5 Checkpoint)',
    entryFeeRp: 100000,
    rewardRp: 1200000,
    checkpoints: [
      [0, 32],
      [0, 64],
      [32, 32],
      [32, -32],
      [0, -32],
    ],
  },
  {
    id: 'race_drift_sabuk_tol',
    name: 'Turnamen Drift Malam Sabuk Tol & Semanggi',
    subtitle: 'Uji Sudut Drift Tajam Mengelilingi Cincin Monas, SCBD & Kota Tua (6 Checkpoint)',
    entryFeeRp: 75000,
    rewardRp: 950000,
    checkpoints: [
      [-32, -32],
      [32, -32],
      [32, 32],
      [-32, 32],
      [32, 80],
      [0, 24],
    ],
  },
  {
    id: 'race_jorr_grand_tour',
    name: 'Grand Tour Lingkar Luar Megapolitan JORR',
    subtitle: 'Lintasan Ekspres 480m Pondok Indah – Kemang – Kelapa Gading – Marunda (6 Checkpoint)',
    entryFeeRp: 150000,
    rewardRp: 1850000,
    checkpoints: [
      [-128, 128],
      [0, 208],
      [208, 208],
      [208, 0],
      [128, 128],
      [0, 24],
    ],
  },
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

const KNOWN_STREETSCAPE_OBSTACLES: { x: number; z: number; hx: number; hz: number }[] = [
  { x: -7.8, z: -38.5, hx: 1.4, hz: 1.4 },
  { x: 7.8, z: -19.5, hx: 1.4, hz: 1.4 },
  { x: -7.8, z: 19.5, hx: 1.4, hz: 1.4 },
  { x: 7.8, z: 38.5, hx: 1.4, hz: 1.4 },
  { x: -38.5, z: -7.8, hx: 1.4, hz: 1.4 },
  { x: 38.5, z: 7.8, hx: 1.4, hz: 1.4 },
  { x: -7.5, z: -50, hx: 1.8, hz: 1.8 },
  { x: 7.5, z: -50, hx: 1.8, hz: 1.8 },
  { x: -7.5, z: 42, hx: 1.8, hz: 1.8 },
  { x: 7.5, z: 42, hx: 1.8, hz: 1.8 },
  { x: -42, z: -7.5, hx: 1.8, hz: 1.8 },
  { x: -42, z: 7.5, hx: 1.8, hz: 1.8 },
  { x: -11, z: 22, hx: 2.6, hz: 2.6 },
  { x: 11, z: 20, hx: 2.6, hz: 2.6 },
  { x: -14, z: -22, hx: 2.6, hz: 2.6 },
  { x: 14, z: -22, hx: 2.6, hz: 2.6 },
  { x: -9.0, z: -42, hx: 2.2, hz: 5.8 },
  { x: 9.0, z: 42, hx: 2.2, hz: 5.8 },
  { x: 8.5, z: -16, hx: 2.2, hz: 3.2 },
  ...ENTERABLE_INTERIORS.map((p) => ({
    x: p.portalX,
    z: p.portalZ,
    hx: 3.2,
    hz: 3.2,
  })),
  ...KNOWN_PJU_POLES.map(([x, z]) => ({ x, z, hx: 0.85, hz: 0.85 })),
  ...KNOWN_BOULEVARD_TREES.map(([x, z]) => ({ x, z, hx: 1.5, hz: 1.5 })),
];

export function isOnMainRoadwayFootprint(
  x: number,
  z: number,
  pad: number = 0.1
): boolean {
  if (Math.abs(x) < 7.0 + pad && Math.abs(z) < 126) return true;
  if (Math.abs(z) < 7.0 + pad && Math.abs(x) < 126) return true;
  if (Math.abs(Math.abs(x) - 32) < 5.0 + pad && Math.abs(z) < 126) return true;
  if (Math.abs(Math.abs(z) - 32) < 5.0 + pad && Math.abs(x) < 126) return true;
  if (Math.abs(Math.abs(x) - 84) < 5.0 + pad && Math.abs(z) < 126) return true;
  if (Math.abs(z + 66) < 5.0 + pad && Math.abs(x) < 126) return true;
  if (Math.hypot(x, z - 32) < 12.2 + pad) return true;
  if (z >= 75.4 - pad && z <= 84.6 + pad && Math.abs(x) <= 68.5 + pad) {
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
  if (Math.abs(x) + halfX > 122 || Math.abs(z) + halfZ > 122) return false;
  const roadPad = Math.min(halfX, halfZ) * 0.25;
  if (isOnMainRoadwayFootprint(x, z, roadPad)) return false;
  if (x * x + z * z < 19.6 * 19.6) return false;
  if (Math.hypot(x, z - 32) < 13.5) return false;

  for (const b of CITY_BUILDINGS) {
    const hw = b.width * 0.5 + halfX + 0.8;
    const hd = b.depth * 0.5 + halfZ + 0.8;
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) return false;
  }
  for (const obs of KNOWN_STREETSCAPE_OBSTACLES) {
    if (Math.abs(x - obs.x) < halfX + obs.hx && Math.abs(z - obs.z) < halfZ + obs.hz) {
      return false;
    }
  }
  for (const item of occupied) {
    if (Math.abs(x - item.x) < halfX + item.hx && Math.abs(z - item.z) < halfZ + item.hz) {
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

  const halteCandidates: Omit<TransJakartaHalteSpawn, 'y'>[] = [
    { id: 'halte_bundaran_hi', stationName: 'HALTE BUNDARAN HI', corridorCode: 'K1', routeSummary: 'BLOK M  <->  KOTA', x: -9.65, z: 43.2, rotY: 0 },
    { id: 'halte_dukuh_atas', stationName: 'HALTE DUKUH ATAS', corridorCode: 'K1', routeSummary: 'MONAS  <->  SENAYAN', x: 9.65, z: 117.2, rotY: Math.PI },
    { id: 'halte_blok_m', stationName: 'HALTE BLOK M', corridorCode: 'K1', routeSummary: 'BLOK M  <->  HARMONI', x: 9.65, z: 92.0, rotY: Math.PI },
    { id: 'halte_karet_sudirman', stationName: 'HALTE KARET SUDIRMAN', corridorCode: 'K1', routeSummary: 'SUDIRMAN  <->  MELAWAI', x: 9.65, z: 68.8, rotY: Math.PI },
    { id: 'halte_tanah_abang', stationName: 'HALTE TANAH ABANG', corridorCode: 'K8', routeSummary: 'HARMONI  <->  LEBAK BULUS', x: -73.6, z: 9.65, rotY: Math.PI / 2 },
    { id: 'halte_kota_tua', stationName: 'HALTE KOTA TUA', corridorCode: 'K12', routeSummary: 'KOTA  <->  TANJUNG PRIOK', x: -9.65, z: -49.0, rotY: 0 },
    { id: 'halte_glodok_harco', stationName: 'HALTE GLODOK HARCO', corridorCode: 'K1', routeSummary: 'KOTA TUA  <->  BLOK M', x: 50, z: 9.65, rotY: Math.PI / 2 },
  ];

  for (const hc of halteCandidates) {
    const alongZ = Math.abs(Math.cos(hc.rotY)) > 0.5;
    const hx = alongZ ? 1.25 : 4.8;
    const hz = alongZ ? 4.8 : 1.25;
    if (isRoadsideSpotClear(hc.x, hc.z, hx, hz, occupied)) {
      transJakartaHaltes.push({ ...hc, y: getRoadsideGroundY(hc.x, hc.z, sidewalkSlabs) });
      occupied.push({ x: hc.x, z: hc.z, hx: hx + 0.8, hz: hz + 0.8 });
    }
  }

  const tollCandidates: Omit<TollSignSpawn, 'y'>[] = [
    { id: 'toll_sudirman_northbound', variant: 'cantilever', theme: 'green_arterial', topText: 'TOL DALAM KOTA ↑', bottomText: 'SEMANGGI · CAWANG · PRIOK', badgeText: 'TOL', x: -7.75, z: 45.5, rotY: 0 },
    { id: 'toll_sudirman_southbound', variant: 'cantilever', theme: 'green_arterial', topText: 'BLOK M · SENAYAN GBK ↑', bottomText: 'JALUR PROTOKOL SELATAN', badgeText: 'JKT', x: 7.75, z: 66.5, rotY: Math.PI },
    { id: 'toll_thamrin_southbound', variant: 'cantilever', theme: 'green_arterial', topText: 'TOL SEMANGGI · MONAS ↑', bottomText: 'CAWANG · HALIM · BLOK M', badgeText: 'TOL', x: 7.75, z: -44.5, rotY: Math.PI },
    { id: 'toll_thamrin_northbound', variant: 'cantilever', theme: 'blue_toll', topText: 'SCBD ←   PRIOK →', bottomText: 'TOL BANDARA SOETTA ↑', badgeText: 'TOL', x: -7.75, z: -48.5, rotY: 0 },
    { id: 'toll_ramp_semanggi_west', variant: 'twin_post', theme: 'blue_toll', topText: 'GERBANG TOL SEMANGGI', bottomText: 'e-TOLL · TOL LAYANG →', badgeText: 'TOL', x: -64.5, z: 74.2, rotY: -Math.PI / 2 },
    { id: 'toll_ramp_kemayoran_east', variant: 'twin_post', theme: 'blue_toll', topText: 'TOL LAYANG SEMANGGI', bottomText: '← SCBD · SENAYAN · PIK 2', badgeText: 'TOL', x: 64.5, z: 85.8, rotY: Math.PI / 2 },
    { id: 'toll_ew_west_approach', variant: 'cantilever', theme: 'green_arterial', topText: 'MONAS · SUDIRMAN ↑', bottomText: 'AKSES TOL DALAM KOTA 200m', badgeText: 'TOL', x: -48.5, z: 7.75, rotY: -Math.PI / 2 },
    { id: 'toll_ew_east_approach', variant: 'cantilever', theme: 'green_arterial', topText: 'KOTA TUA ←   MONAS ↑', bottomText: 'TOL TANJUNG PRIOK · HALIM →', badgeText: 'TOL', x: 67.5, z: -7.75, rotY: Math.PI / 2 },
  ];

  for (const tc of tollCandidates) {
    const hx = tc.variant === 'twin_post' ? 2.1 : 1.0;
    const hz = tc.variant === 'twin_post' ? 1.4 : 1.0;
    if (isRoadsideSpotClear(tc.x, tc.z, hx, hz, occupied)) {
      tollSigns.push({ ...tc, y: getRoadsideGroundY(tc.x, tc.z, sidewalkSlabs) });
      occupied.push({ x: tc.x, z: tc.z, hx: hx + 1.5, hz: hz + 1.5 });
    }
  }

  const nsSignSequence: TrafficSignKind[] = [
    'khusus_busway',
    'batas_kecepatan_60',
    'dilarang_parkir',
    'peringatan_penyeberangan',
    'arah_wajib_lurus',
    'batas_kecepatan_40',
  ];
  let signIndex = 0;

  const nsZStops = [-81, -69, -54, -44, -22, 16, 22, 37, 48, 66, 79];
  for (const zPos of nsZStops) {
    for (const sideX of [-7.45, 7.45]) {
      const rotY = sideX < 0 ? 0 : Math.PI;
      const nearCrosswalk =
        Math.abs(Math.abs(zPos) - 21) < 3 || Math.abs(Math.abs(zPos) - 38) < 3;
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

  const tollShoulderCandidates: { x: number; z: number; rotY: number; kind: TrafficSignKind }[] = [
    { x: -58, z: 74.1, rotY: -Math.PI / 2, kind: 'batas_kecepatan_60' },
    { x: -45, z: 74.1, rotY: -Math.PI / 2, kind: 'arah_wajib_lurus' },
    { x: 58, z: 85.9, rotY: Math.PI / 2, kind: 'batas_kecepatan_60' },
    { x: 45, z: 85.9, rotY: Math.PI / 2, kind: 'arah_wajib_lurus' },
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

  return { trafficSigns, tollSigns, transJakartaHaltes };
}

export const TRAFFIC_ROUTES: Record<TrafficRouteId, TrafficWaypoint[]> = {
  ring_clockwise: [
    { x: -34.4, z: 34.4 },
    { x: -34.4, z: -34.4 },
    { x: 34.4, z: -34.4 },
    { x: 34.4, z: 34.4 },
    { x: 10.2, z: 34.4 },
    { x: 0, z: 42.6 },
    { x: -10.2, z: 34.4 },
  ],
  ring_ccw: [
    { x: -29.6, z: -29.6 },
    { x: -29.6, z: 29.6 },
    { x: -10.2, z: 29.6 },
    { x: 0, z: 21.8 },
    { x: 10.2, z: 29.6 },
    { x: 29.6, z: 29.6 },
    { x: 29.6, z: -29.6 },
  ],
  sudirman_north_arterial: [
    { x: -4.6, z: -34.4 },
    { x: -4.6, z: -64 },
    { x: 4.6, z: -64 },
    { x: 4.6, z: -34.4 },
  ],
  sudirman_south_arterial: [
    { x: 4.6, z: 46 },
    { x: 4.6, z: 118 },
    { x: -4.6, z: 118 },
    { x: -4.6, z: 46 },
  ],
  busway_corridor_north: [
    { x: -1.85, z: -38 },
    { x: -1.85, z: -50, pauseSec: 1.6 },
    { x: -1.85, z: -64, pauseSec: 1.6 },
    { x: 1.85, z: -64 },
    { x: 1.85, z: -50, pauseSec: 1.6 },
    { x: 1.85, z: -38 },
  ],
  busway_corridor_south: [
    { x: 1.85, z: 46 },
    { x: 1.85, z: 68.8, pauseSec: 1.6 },
    { x: 1.85, z: 116, pauseSec: 1.6 },
    { x: -1.85, z: 116 },
    { x: -1.85, z: 91.5, pauseSec: 1.6 },
    { x: -1.85, z: 46 },
  ],
  merdeka_west_arterial: [
    { x: -34.4, z: 0.8 },
    { x: -80, z: 0.8 },
    { x: -80, z: 4.6 },
    { x: -34.4, z: 4.6 },
  ],
  merdeka_east_arterial: [
    { x: 34.4, z: 4.6 },
    { x: 80, z: 4.6 },
    { x: 80, z: 0.8 },
    { x: 34.4, z: 0.8 },
  ],
  grand_boulevard_circuit: [
    { x: -34.4, z: -34.4 },
    { x: -4.6, z: -34.4 },
    { x: -4.6, z: -64 },
    { x: 4.6, z: -64 },
    { x: 4.6, z: -34.4 },
    { x: 34.4, z: -34.4 },
    { x: 34.4, z: 4.6 },
    { x: 78, z: 4.6 },
    { x: 78, z: 0.8 },
    { x: 34.4, z: 0.8 },
    { x: 34.4, z: 32 },
    { x: 10.6, z: 32 },
    { x: 4.6, z: 42.5 },
    { x: 4.6, z: 96 },
    { x: -4.6, z: 96 },
    { x: -4.6, z: 42.5 },
    { x: -10.6, z: 32 },
    { x: -34.4, z: 32 },
    { x: -34.4, z: 0.8 },
    { x: -78, z: 0.8 },
    { x: -78, z: 4.6 },
    { x: -34.4, z: 4.6 },
  ],
  tol_layang_express: [
    { x: -65, z: 81.8 },
    { x: 65, z: 81.8 },
    { x: 65, z: 78.2 },
    { x: -65, z: 78.2 },
  ],
  outer_ring_express: [
    { x: -81.5, z: 32 },
    { x: -81.5, z: -32 },
    { x: 81.5, z: -32 },
    { x: 81.5, z: 4.6 },
    { x: 125.5, z: 4.6 },
    { x: 125.5, z: 125.5 },
    { x: -81.5, z: 125.5 },
    { x: -81.5, z: 80 },
  ],
  jorr_perimeter_loop: [
    { x: -205.5, z: 208 },
    { x: -205.5, z: 0 },
    { x: -205.5, z: -64 },
    { x: 0, z: -64 },
    { x: 205.5, z: -64 },
    { x: 205.5, z: 0 },
    { x: 205.5, z: 208 },
    { x: 0, z: 208 },
  ],
  south_jakarta_boulevard: [
    { x: -125.5, z: 130.5 },
    { x: 130.5, z: 130.5 },
    { x: 130.5, z: 205.5 },
    { x: -125.5, z: 205.5 },
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
    { id: 'traffic_tj_n1', type: 'transjakarta', routeId: 'busway_corridor_north', seg: 0, t: 0.1, speed: 9.2 },
    { id: 'traffic_tj_n2', type: 'transjakarta', routeId: 'busway_corridor_north', seg: 3, t: 0.15, speed: 9.2 },
    { id: 'traffic_tj_s1', type: 'transjakarta', routeId: 'busway_corridor_south', seg: 0, t: 0.45, speed: 9.2 },
    { id: 'traffic_polisi_1', type: 'polisi', routeId: 'ring_clockwise', seg: 1, t: 0.72, speed: 11.2 },
    { id: 'traffic_polisi_2', type: 'polisi', routeId: 'grand_boulevard_circuit', seg: 13, t: 0.4, speed: 11.4 },
    { id: 'traffic_angkot_ring', type: 'angkot', routeId: 'ring_clockwise', seg: 3, t: 0.35, speed: 9.4 },
    { id: 'traffic_sedan_ring', type: 'sedan', routeId: 'ring_ccw', seg: 0, t: 0.48, speed: 12.2 },
    { id: 'traffic_bajaj_ring', type: 'bajaj', routeId: 'ring_ccw', seg: 2, t: 0.52, speed: 7.8 },
    { id: 'traffic_sedan_ns1', type: 'sedan', routeId: 'sudirman_north_arterial', seg: 0, t: 0.55, speed: 12.6 },
    { id: 'traffic_ojek_ns2', type: 'ojek', routeId: 'sudirman_north_arterial', seg: 2, t: 0.55, speed: 11.0 },
    { id: 'traffic_angkot_ss1', type: 'angkot', routeId: 'sudirman_south_arterial', seg: 0, t: 0.35, speed: 9.5 },
    { id: 'traffic_bajaj_ss2', type: 'bajaj', routeId: 'sudirman_south_arterial', seg: 2, t: 0.5, speed: 8.0 },
    { id: 'traffic_metromini_ew1', type: 'metromini', routeId: 'merdeka_west_arterial', seg: 0, t: 0.3, speed: 8.6 },
    { id: 'traffic_ojek_ew2', type: 'ojek', routeId: 'merdeka_east_arterial', seg: 0, t: 0.45, speed: 11.2 },
    { id: 'traffic_angkot_grand', type: 'angkot', routeId: 'grand_boulevard_circuit', seg: 7, t: 0.45, speed: 9.6 },
    { id: 'traffic_sedan_tol1', type: 'sedan', routeId: 'tol_layang_express', seg: 0, t: 0.32, speed: 15.8 },
    { id: 'traffic_sedan_tol2', type: 'sedan', routeId: 'tol_layang_express', seg: 2, t: 0.35, speed: 14.8 },
    { id: 'traffic_supercar_outer', type: 'supercar', routeId: 'outer_ring_express', seg: 1, t: 0.4, speed: 17.5 },
    { id: 'traffic_tj_outer', type: 'transjakarta', routeId: 'outer_ring_express', seg: 5, t: 0.55, speed: 11.2 },
    { id: 'traffic_jorr_supercar', type: 'supercar', routeId: 'jorr_perimeter_loop', seg: 0, t: 0.35, speed: 18.8 },
    { id: 'traffic_jorr_polisi', type: 'polisi', routeId: 'jorr_perimeter_loop', seg: 4, t: 0.45, speed: 13.5 },
    { id: 'traffic_jorr_tj', type: 'transjakarta', routeId: 'jorr_perimeter_loop', seg: 6, t: 0.5, speed: 11.8 },
    { id: 'traffic_jorr_ojek', type: 'ojek', routeId: 'south_jakarta_boulevard', seg: 0, t: 0.6, speed: 12.8 },
    { id: 'traffic_south_angkot', type: 'angkot', routeId: 'south_jakarta_boulevard', seg: 1, t: 0.5, speed: 10.2 },
    { id: 'traffic_south_sedan', type: 'sedan', routeId: 'south_jakarta_boulevard', seg: 2, t: 0.35, speed: 14.5 },
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

export function createInitialTrafficSignalState(): TrafficSignalState {
  return {
    phase: 'ns_green',
    timer: 7.5,
    cycleCount: 0,
  };
}

export function stepTrafficSignals(
  state: TrafficSignalState,
  dt: number
): TrafficSignalState {
  if (dt <= 0) return state;
  let timer = state.timer - dt;
  let phase = state.phase;
  let cycleCount = state.cycleCount;

  if (timer <= 0) {
    if (phase === 'ns_green') {
      phase = 'ns_amber';
      timer = 2.0;
    } else if (phase === 'ns_amber') {
      phase = 'ew_green';
      timer = 7.5;
    } else if (phase === 'ew_green') {
      phase = 'ew_amber';
      timer = 2.0;
    } else {
      phase = 'ns_green';
      timer = 7.5;
      cycleCount += 1;
    }
  }
  return { phase, timer, cycleCount };
}

export function isStoppedAtTrafficSignal(
  x: number,
  z: number,
  heading: number,
  layer: 'ground' | 'elevated',
  signalPhase?: TrafficSignalPhase
): boolean {
  if (!signalPhase || layer !== 'ground') return false;
  const sinH = Math.sin(heading);
  const cosH = Math.cos(heading);
  const movingNS = Math.abs(cosH) > Math.abs(sinH);

  if (movingNS) {
    if (signalPhase === 'ns_green') return false;
    // Check approaches to z = ±32 and z = ±19 intersections along Sudirman & Ring
    const stopLinesZ = cosH > 0 ? [-39.5, -19.5, 24.5] : [39.5, 19.5, -24.5];
    for (const sl of stopLinesZ) {
      const distAhead = (sl - z) * Math.sign(cosH);
      if (distAhead > 0.5 && distAhead < 6.2 && Math.abs(x) < 38) {
        return true;
      }
    }
  } else {
    if (signalPhase === 'ew_green') return false;
    // Check approaches to x = ±32 and x = 0 intersections along Merdeka & Ring
    const stopLinesX = sinH > 0 ? [-39.5, -19.5, 24.5] : [39.5, 19.5, -24.5];
    for (const sl of stopLinesX) {
      const distAhead = (sl - x) * Math.sign(sinH);
      if (distAhead > 0.5 && distAhead < 6.2 && Math.abs(z) < 38) {
        return true;
      }
    }
  }
  return false;
}

export const WORLD_ROAD_EVENT_CATALOG: WorldRoadEventSpec[] = [
  {
    id: 'evt_construction_sudirman_utara',
    kind: 'road_construction',
    title: 'Proyek Galian Pipa & Beton Sudirman Utara',
    corridorName: 'Jl. Jend. Sudirman Utara (Thamrin)',
    description:
      'Galian utilitas bawah tanah menutup lajur utama Sudirman Utara. Barikade beton memaksa pengendara memutar.',
    detourLabel: 'Putar via Lingkar Barat Tanah Abang',
    x: 0,
    z: -48,
    radius: 7.5,
    heading: 0,
    detourWaypoints: [
      [-32, -32],
      [-32, -60],
      [0, -68],
    ],
    detourTargetX: -32,
    detourTargetZ: -32,
  },
  {
    id: 'evt_jam_sudirman_selatan',
    kind: 'traffic_jam',
    title: 'Kemacetan Mendadak & Bus Mogok Blok M',
    corridorName: 'Jl. Jend. Sudirman Selatan (Blok M)',
    description:
      'Antrean padat akibat angkutan umum mogok melintang di koridor selatan menuju Senayan & Blok M.',
    detourLabel: 'Putar via Sabuk Timur Kemayoran - Senayan',
    x: 0,
    z: 48,
    radius: 8.0,
    heading: 0,
    detourWaypoints: [
      [32, 32],
      [32, 60],
      [0, 68],
    ],
    detourTargetX: 32,
    detourTargetZ: 32,
  },
  {
    id: 'evt_construction_merdeka_barat',
    kind: 'road_construction',
    title: 'Perbaikan Aspal & Barikade Medan Merdeka Barat',
    corridorName: 'Jl. Medan Merdeka Barat (Harmoni)',
    description:
      'Pengaspalan ulang dan alat berat menutup koridor barat Monas menuju Tanah Abang.',
    detourLabel: 'Putar via Lingkar Utara SCBD & Kota Tua',
    x: -48,
    z: 2.5,
    radius: 7.5,
    heading: Math.PI / 2,
    detourWaypoints: [
      [-32, -32],
      [-60, -32],
      [-68, 2.5],
    ],
    detourTargetX: -32,
    detourTargetZ: -32,
  },
  {
    id: 'evt_jam_merdeka_timur',
    kind: 'traffic_jam',
    title: 'Antrean Padat & Truk Kontainer Melintang',
    corridorName: 'Jl. Medan Merdeka Timur (Kemayoran)',
    description:
      'Penumpukan kendaraan di simpang timur menghambat laju menuju Kemayoran dan Tanjung Priok.',
    detourLabel: 'Putar via Lingkar Selatan Monas',
    x: 48,
    z: 2.5,
    radius: 8.0,
    heading: Math.PI / 2,
    detourWaypoints: [
      [32, 32],
      [60, 32],
      [68, 2.5],
    ],
    detourTargetX: 32,
    detourTargetZ: 32,
  },
  {
    id: 'evt_construction_lingkar_barat',
    kind: 'road_construction',
    title: 'Penutupan Lajur Konstruksi Jembatan Semanggi Barat',
    corridorName: 'Lingkar Barat Monas - SCBD',
    description:
      'Pemasangan girder baja menutup lajur lingkar barat. Gunakan boulevard utama Monas sebagai jalur alternatif.',
    detourLabel: 'Putar via Boulevard Tengah Monas',
    x: -32,
    z: -14,
    radius: 7.2,
    heading: 0,
    detourWaypoints: [
      [0, 0],
      [0, -32],
      [-32, -32],
    ],
    detourTargetX: 0,
    detourTargetZ: -32,
  },
  {
    id: 'evt_jam_lingkar_timur',
    kind: 'traffic_jam',
    title: 'Kemacetan Jam Sibuk Simpang Lingkar Timur',
    corridorName: 'Lingkar Timur Monas - Pasar Baru',
    description:
      'Titik temu arus komuter menyebabkan kemacetan beruntun di jalur Lingkar Timur.',
    detourLabel: 'Putar via Jalur Protokol Tengah Monas',
    x: 32,
    z: 14,
    radius: 7.8,
    heading: 0,
    detourWaypoints: [
      [0, 0],
      [0, 32],
      [32, 32],
    ],
    detourTargetX: 0,
    detourTargetZ: 32,
  },
];

export function createInitialWorldClockEventState(
  startWithActiveEvent: boolean = true
): WorldClockEventTickerState {
  if (!startWithActiveEvent) {
    return {
      activeEvent: null,
      cooldownSec: 12,
      totalEventsTriggered: 0,
      lastEventId: null,
    };
  }
  const initialSpec = WORLD_ROAD_EVENT_CATALOG[0];
  return {
    activeEvent: {
      spec: initialSpec,
      startedAtMinute: 1050,
      remainingSec: 65,
      totalDurationSec: 65,
      detourStageIndex: 0,
      detourCompleted: false,
    },
    cooldownSec: 18,
    totalEventsTriggered: 1,
    lastEventId: initialSpec.id,
  };
}

export function isJakartaRushHour(worldTimeMinutes: number): boolean {
  const norm = ((Math.floor(worldTimeMinutes) % 1440) + 1440) % 1440;
  // Morning rush (06:30 - 09:45 WIB) or Evening rush (16:15 - 20:15 WIB)
  return (norm >= 390 && norm <= 585) || (norm >= 975 && norm <= 1215);
}

export function triggerManualWorldRoadEvent(
  state: WorldClockEventTickerState,
  worldTimeMinutes: number,
  preferredKind?: WorldRoadEventKind,
  rngValue: number = Math.random()
): {
  nextState: WorldClockEventTickerState;
  triggeredEvent: ActiveWorldRoadEvent;
} {
  const candidates = WORLD_ROAD_EVENT_CATALOG.filter((item) => {
    if (preferredKind && item.kind !== preferredKind) return false;
    return item.id !== state.lastEventId;
  });
  const pool =
    candidates.length > 0
      ? candidates
      : preferredKind
      ? WORLD_ROAD_EVENT_CATALOG.filter((i) => i.kind === preferredKind)
      : WORLD_ROAD_EVENT_CATALOG;

  const clampedRng = Math.max(0, Math.min(0.999999, rngValue));
  const chosenSpec = pool[Math.floor(clampedRng * pool.length)] || WORLD_ROAD_EVENT_CATALOG[0];
  const durationSec = chosenSpec.kind === 'road_construction' ? 65 : 50;

  const triggeredEvent: ActiveWorldRoadEvent = {
    spec: chosenSpec,
    startedAtMinute: ((Math.floor(worldTimeMinutes) % 1440) + 1440) % 1440,
    remainingSec: durationSec,
    totalDurationSec: durationSec,
    detourStageIndex: 0,
    detourCompleted: false,
  };

  const nextState: WorldClockEventTickerState = {
    activeEvent: triggeredEvent,
    cooldownSec: 18,
    totalEventsTriggered: state.totalEventsTriggered + 1,
    lastEventId: chosenSpec.id,
  };

  return { nextState, triggeredEvent };
}

export function stepWorldClockEventTicker(
  state: WorldClockEventTickerState,
  worldTimeMinutes: number,
  dtSec: number = 1,
  rngValue: number = Math.random()
): {
  nextState: WorldClockEventTickerState;
  triggeredEvent: ActiveWorldRoadEvent | null;
  expiredEvent: ActiveWorldRoadEvent | null;
} {
  if (dtSec <= 0) {
    return { nextState: state, triggeredEvent: null, expiredEvent: null };
  }

  if (state.activeEvent) {
    const rem = state.activeEvent.remainingSec - dtSec;
    if (rem <= 0) {
      return {
        nextState: {
          ...state,
          activeEvent: null,
          cooldownSec: 14,
        },
        triggeredEvent: null,
        expiredEvent: state.activeEvent,
      };
    }
    return {
      nextState: {
        ...state,
        activeEvent: {
          ...state.activeEvent,
          remainingSec: rem,
        },
      },
      triggeredEvent: null,
      expiredEvent: null,
    };
  }

  const nextCooldown = Math.max(0, state.cooldownSec - dtSec);
  if (nextCooldown > 0) {
    return {
      nextState: {
        ...state,
        cooldownSec: nextCooldown,
      },
      triggeredEvent: null,
      expiredEvent: null,
    };
  }

  const rushHour = isJakartaRushHour(worldTimeMinutes);
  const triggerThreshold = rushHour ? 0.36 : 0.22;
  if (rngValue < triggerThreshold) {
    const normSelector = triggerThreshold > 0 ? rngValue / triggerThreshold : 0;
    const { nextState, triggeredEvent } = triggerManualWorldRoadEvent(
      state,
      worldTimeMinutes,
      undefined,
      normSelector
    );
    return {
      nextState,
      triggeredEvent,
      expiredEvent: null,
    };
  }

  return {
    nextState: {
      ...state,
      cooldownSec: 4,
    },
    triggeredEvent: null,
    expiredEvent: null,
  };
}

export function evaluateRoadEventImpactAt(
  event: ActiveWorldRoadEvent | null | undefined,
  x: number,
  z: number,
  y: number = 0
): {
  inZone: boolean;
  speedMultiplier: number;
  blockedBarrierCollide: boolean;
  pushX: number;
  pushZ: number;
} {
  if (!event || y > 2.2) {
    return {
      inZone: false,
      speedMultiplier: 1.0,
      blockedBarrierCollide: false,
      pushX: x,
      pushZ: z,
    };
  }

  const dx = x - event.spec.x;
  const dz = z - event.spec.z;
  const dist = Math.hypot(dx, dz);
  const outerRadius = event.spec.radius;

  if (dist > outerRadius) {
    return {
      inZone: false,
      speedMultiplier: 1.0,
      blockedBarrierCollide: false,
      pushX: x,
      pushZ: z,
    };
  }

  const innerBarrierRadius =
    event.spec.kind === 'road_construction'
      ? outerRadius * 0.56
      : outerRadius * 0.42;

  if (dist < innerBarrierRadius) {
    const safeDist = dist > 0.001 ? dist : 1;
    const nx = dist > 0.001 ? dx / safeDist : Math.sin(event.spec.heading);
    const nz = dist > 0.001 ? dz / safeDist : Math.cos(event.spec.heading);
    return {
      inZone: true,
      speedMultiplier: event.spec.kind === 'road_construction' ? 0.2 : 0.28,
      blockedBarrierCollide: true,
      pushX: event.spec.x + nx * (innerBarrierRadius + 0.35),
      pushZ: event.spec.z + nz * (innerBarrierRadius + 0.35),
    };
  }

  return {
    inZone: true,
    speedMultiplier: event.spec.kind === 'road_construction' ? 0.38 : 0.32,
    blockedBarrierCollide: false,
    pushX: x,
    pushZ: z,
  };
}

export function checkPlayerDetourProgress(
  event: ActiveWorldRoadEvent | null | undefined,
  playerX: number,
  playerZ: number
): {
  updatedEvent: ActiveWorldRoadEvent | null;
  reachedWaypoint: boolean;
  completedDetour: boolean;
  nextWaypoint: [number, number] | null;
} {
  if (!event || event.detourCompleted) {
    return {
      updatedEvent: event ?? null,
      reachedWaypoint: false,
      completedDetour: false,
      nextWaypoint: null,
    };
  }

  const waypoints = event.spec.detourWaypoints;
  const currentIdx = Math.min(event.detourStageIndex, waypoints.length - 1);
  const targetPt = waypoints[currentIdx];
  if (!targetPt) {
    return {
      updatedEvent: event,
      reachedWaypoint: false,
      completedDetour: false,
      nextWaypoint: null,
    };
  }

  const dist = Math.hypot(playerX - targetPt[0], playerZ - targetPt[1]);
  if (dist > 10.5) {
    return {
      updatedEvent: event,
      reachedWaypoint: false,
      completedDetour: false,
      nextWaypoint: targetPt,
    };
  }

  const nextIdx = currentIdx + 1;
  if (nextIdx >= waypoints.length) {
    const completedEvent: ActiveWorldRoadEvent = {
      ...event,
      detourStageIndex: waypoints.length,
      detourCompleted: true,
    };
    return {
      updatedEvent: completedEvent,
      reachedWaypoint: true,
      completedDetour: true,
      nextWaypoint: null,
    };
  }

  const nextPt = waypoints[nextIdx];
  const updatedEvent: ActiveWorldRoadEvent = {
    ...event,
    detourStageIndex: nextIdx,
    spec: {
      ...event.spec,
      detourTargetX: nextPt[0],
      detourTargetZ: nextPt[1],
    },
  };
  return {
    updatedEvent,
    reachedWaypoint: true,
    completedDetour: false,
    nextWaypoint: nextPt,
  };
}

export function stepTrafficVehicleInPlace(
  vehicle: TrafficAISteppable,
  route: TrafficWaypoint[],
  aheadObstacleDist: number,
  dt: number,
  options?: {
    playerWantedLevel?: number;
    hornTriggered?: boolean;
    signalPhase?: TrafficSignalPhase;
    buildingGrid?: SpatialHashGrid<BuildingFootprint>;
    activeRoadEvent?: ActiveWorldRoadEvent | null;
  }
): void {
  if (route.length === 0 || dt <= 0) return;

  const wpIdx = ((vehicle.waypointIndex % route.length) + route.length) % route.length;
  const targetWp = route[wpIdx];
  const dx = targetWp.x - vehicle.x;
  const dz = targetWp.z - vehicle.z;
  const distToWp = Math.hypot(dx, dz);

  if (distToWp < 2.2) {
    if (targetWp.pauseSec && targetWp.pauseSec > 0) {
      vehicle.stopTimer = targetWp.pauseSec;
    }
    vehicle.waypointIndex = (wpIdx + 1) % route.length;
  }

  // Jakarta AI Behavior Extensions:
  // 1) Angkot stochastic ngetem curb pause along busy streets
  if (vehicle.vehicleType === 'angkot' && vehicle.layer === 'ground') {
    if ((vehicle.ngetemCooldown ?? 0) > 0) {
      vehicle.ngetemCooldown = Math.max(0, (vehicle.ngetemCooldown ?? 0) - dt);
    }
    if ((vehicle.ngetemTimer ?? 0) > 0) {
      vehicle.ngetemTimer = Math.max(0, (vehicle.ngetemTimer ?? 0) - dt);
      vehicle.stopTimer = Math.max(vehicle.stopTimer, vehicle.ngetemTimer);
    } else if (
      (vehicle.ngetemCooldown ?? 0) <= 0 &&
      aheadObstacleDist > 12 &&
      Math.abs(Math.sin(vehicle.x * 0.37 + vehicle.z * 0.23)) > 0.992
    ) {
      vehicle.ngetemTimer = 2.0;
      vehicle.ngetemCooldown = 14.0;
      vehicle.stopTimer = Math.max(vehicle.stopTimer, 2.0);
    }
  }

  // 2) Ojol lane-splitting weave & reaction to Klakson or player wanted sirens
  if (options?.hornTriggered) {
    vehicle.hornReactionTimer = 1.4;
    if (vehicle.vehicleType === 'angkot') {
      // Honking nudges a ngetem angkot to roll forward sooner
      vehicle.ngetemTimer = 0;
      vehicle.stopTimer = 0;
    }
  } else if ((vehicle.hornReactionTimer ?? 0) > 0) {
    vehicle.hornReactionTimer = Math.max(0, (vehicle.hornReactionTimer ?? 0) - dt);
  }

  const nextWp = route[vehicle.waypointIndex];
  const ndx = nextWp.x - vehicle.x;
  const ndz = nextWp.z - vehicle.z;
  let targetHeading =
    ndx * ndx + ndz * ndz > 0.0001 ? Math.atan2(ndx, ndz) : vehicle.heading;

  // Check active road event (traffic jam / road construction) ahead of ground AI vehicles
  let effectiveAheadDist = aheadObstacleDist;
  let roadEventSpeedCap: number | null = null;
  if (options?.activeRoadEvent && vehicle.layer === 'ground') {
    const ev = options.activeRoadEvent.spec;
    const dxE = ev.x - vehicle.x;
    const dzE = ev.z - vehicle.z;
    const distE = Math.hypot(dxE, dzE);
    if (distE < ev.radius + 14) {
      const sinH = Math.sin(vehicle.heading);
      const cosH = Math.cos(vehicle.heading);
      const fwdDot = dxE * sinH + dzE * cosH;
      const latDist = Math.abs(dxE * cosH - dzE * sinH);
      if (fwdDot > -2.5 && latDist < ev.radius * 0.95) {
        if (ev.kind === 'road_construction') {
          effectiveAheadDist = Math.min(
            effectiveAheadDist,
            Math.max(0, distE - ev.radius * 0.55)
          );
          roadEventSpeedCap = vehicle.vehicleType === 'ojek' ? 3.5 : 0;
        } else {
          // Traffic jam: severe crawl
          roadEventSpeedCap =
            vehicle.vehicleType === 'ojek'
              ? vehicle.preferredSpeed * 0.45
              : vehicle.preferredSpeed * 0.18;
        }
      }
    }
  }

  // Ojol nimble lane-splitting when traffic ahead slows down or horn/wanted is active
  if (vehicle.vehicleType === 'ojek') {
    const yielding =
      (vehicle.hornReactionTimer ?? 0) > 0 || (options?.playerWantedLevel ?? 0) >= 2;
    const weaving = effectiveAheadDist < 12.0 || roadEventSpeedCap !== null;
    const desiredOffset = yielding ? 0.52 : weaving ? -0.34 : 0;
    const curOffset = vehicle.weaveOffset ?? 0;
    vehicle.weaveOffset = curOffset + (desiredOffset - curOffset) * Math.min(1, dt * 6);
    targetHeading += vehicle.weaveOffset * 0.45;
  }

  const angleDiff = Math.atan2(
    Math.sin(targetHeading - vehicle.heading),
    Math.cos(targetHeading - vehicle.heading)
  );
  const turnCap = vehicle.vehicleType === 'ojek' ? 5.2 : 3.8;
  const maxTurn = turnCap * dt;
  vehicle.heading += Math.max(-maxTurn, Math.min(maxTurn, angleDiff));

  let targetSpeed = vehicle.preferredSpeed;
  if (Math.abs(angleDiff) > 0.36) {
    targetSpeed = Math.min(targetSpeed, 5.8);
  }
  if (vehicle.vehicleType === 'ojek' && (vehicle.hornReactionTimer ?? 0) > 0) {
    targetSpeed *= 1.25;
  }
  if (roadEventSpeedCap !== null) {
    targetSpeed = Math.min(targetSpeed, roadEventSpeedCap);
  }

  if (vehicle.stopTimer > 0) {
    vehicle.stopTimer = Math.max(0, vehicle.stopTimer - dt);
    targetSpeed = 0;
  }

  // Respect Jakarta 4-way traffic lights unless yielding to wanted sirens or urgent horn
  if (
    options?.signalPhase &&
    (options?.playerWantedLevel ?? 0) < 2 &&
    isStoppedAtTrafficSignal(
      vehicle.x,
      vehicle.z,
      vehicle.heading,
      vehicle.layer,
      options.signalPhase
    )
  ) {
    targetSpeed = 0;
  }

  // Natural GTA-style following distance: Ojol can filter close, cars maintain smooth queue
  const hardStopDist = vehicle.vehicleType === 'ojek' ? 2.4 : 4.2;
  if (effectiveAheadDist < hardStopDist) {
    targetSpeed = 0;
  } else if (effectiveAheadDist < 15.0) {
    const gapFactor = (effectiveAheadDist - hardStopDist) / (15.0 - hardStopDist);
    targetSpeed = Math.min(targetSpeed, vehicle.preferredSpeed * (gapFactor * gapFactor));
  }

  // Anti-gridlock unjam recovery: only advance waypoint if blocked by geometry/corner,
  // never drive blindly into a vehicle directly blocking in front.
  const isWaitingSignal =
    options?.signalPhase &&
    isStoppedAtTrafficSignal(
      vehicle.x,
      vehicle.z,
      vehicle.heading,
      vehicle.layer,
      options.signalPhase
    );
  if (vehicle.speed < 0.25 && vehicle.stopTimer <= 0 && !isWaitingSignal) {
    vehicle.stuckTimer = (vehicle.stuckTimer ?? 0) + dt;
    if (vehicle.stuckTimer > 8.0 && effectiveAheadDist > hardStopDist + 1.2) {
      vehicle.waypointIndex = (wpIdx + 1) % route.length;
      vehicle.stuckTimer = 0;
      targetSpeed = Math.min(vehicle.preferredSpeed * 0.45, 4.0);
    }
  } else {
    vehicle.stuckTimer = 0;
  }

  if (effectiveAheadDist < hardStopDist * 0.55) {
    vehicle.speed = 0;
  } else {
    const rate =
      effectiveAheadDist < hardStopDist
        ? 26.0
        : targetSpeed < vehicle.speed
        ? 16.5
        : 8.5;
    const deltaV = targetSpeed - vehicle.speed;
    const maxStep = rate * dt;
    if (Math.abs(deltaV) <= maxStep) {
      vehicle.speed = targetSpeed;
    } else {
      vehicle.speed += Math.sign(deltaV) * maxStep;
    }
    if (vehicle.speed < 0) vehicle.speed = 0;
  }

  const nx = vehicle.x + Math.sin(vehicle.heading) * vehicle.speed * dt;
  const nz = vehicle.z + Math.cos(vehicle.heading) * vehicle.speed * dt;

  if (vehicle.layer === 'ground') {
    const col = resolveCircleAABBCollision(
      nx,
      nz,
      1.9,
      undefined,
      options?.buildingGrid
    );
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
  dt: number,
  options?: {
    playerWantedLevel?: number;
    hornTriggered?: boolean;
    signalPhase?: TrafficSignalPhase;
    buildingGrid?: SpatialHashGrid<BuildingFootprint>;
    activeRoadEvent?: ActiveWorldRoadEvent | null;
  }
): TrafficAISteppable {
  const next: TrafficAISteppable = { ...state };
  stepTrafficVehicleInPlace(next, route, aheadObstacleDist, dt, options);
  return next;
}

export function validateCustomRaceTrack(
  name: string,
  checkpoints: [number, number][],
  isLoop: boolean = false
): {
  valid: boolean;
  reason?: string;
  trackDistanceM: number;
  normalizedCheckpoints: [number, number][];
} {
  const cleanName = name.trim();
  if (cleanName.length < 3) {
    return {
      valid: false,
      reason: 'Nama sirkuit minimal 3 karakter.',
      trackDistanceM: 0,
      normalizedCheckpoints: [],
    };
  }
  if (!Array.isArray(checkpoints) || checkpoints.length < 3) {
    return {
      valid: false,
      reason: 'Minimal 3 checkpoint diperlukan untuk membuat sirkuit balap.',
      trackDistanceM: 0,
      normalizedCheckpoints: [],
    };
  }

  const normalized: [number, number][] = [];
  let totalDist = 0;

  for (let i = 0; i < checkpoints.length; i++) {
    const pt = checkpoints[i];
    if (
      !Array.isArray(pt) ||
      pt.length < 2 ||
      !Number.isFinite(pt[0]) ||
      !Number.isFinite(pt[1])
    ) {
      return {
        valid: false,
        reason: `Koordinat checkpoint #${i + 1} tidak valid.`,
        trackDistanceM: 0,
        normalizedCheckpoints: [],
      };
    }
    const cx = Math.max(-236, Math.min(236, Math.round(pt[0] * 10) / 10));
    const cz = Math.max(-236, Math.min(236, Math.round(pt[1] * 10) / 10));

    if (i > 0) {
      const prev = normalized[i - 1];
      const legDist = Math.hypot(cx - prev[0], cz - prev[1]);
      if (legDist < 6) {
        return {
          valid: false,
          reason: `Checkpoint #${i} dan #${i + 1} terlalu berdekatan (< 6m).`,
          trackDistanceM: 0,
          normalizedCheckpoints: [],
        };
      }
      totalDist += legDist;
    }
    normalized.push([cx, cz]);
  }

  if (isLoop && normalized.length >= 3) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    const loopBackDist = Math.hypot(first[0] - last[0], first[1] - last[1]);
    if (loopBackDist > 4) {
      normalized.push([first[0], first[1]]);
      totalDist += loopBackDist;
    }
  }

  return {
    valid: true,
    trackDistanceM: Math.round(totalDist),
    normalizedCheckpoints: normalized,
  };
}

export function createCustomRaceTrackSpec(params: {
  name: string;
  subtitle?: string;
  authorName?: string;
  checkpoints: [number, number][];
  isLoop?: boolean;
  entryFeeRp?: number;
  rewardRp?: number;
}): { track: CustomRaceTrackSpec | null; error?: string } {
  const check = validateCustomRaceTrack(
    params.name,
    params.checkpoints,
    Boolean(params.isLoop)
  );
  if (!check.valid) {
    return { track: null, error: check.reason };
  }
  const rewardRp =
    params.rewardRp ?? Math.max(180000, Math.round(check.trackDistanceM * 2400));
  const entryFeeRp = params.entryFeeRp ?? Math.round(rewardRp * 0.2);

  return {
    track: {
      id: `ugc_race_${Date.now()}_${Math.floor(Math.random() * 999)}`,
      name: params.name.trim().slice(0, 48),
      subtitle:
        params.subtitle?.trim().slice(0, 72) ||
        `Sirkuit Kustom UGC (${check.normalizedCheckpoints.length} CP · ${check.trackDistanceM}m)`,
      authorName: (params.authorName || 'Pembalap Jakarta').trim().slice(0, 28),
      createdAt: Date.now(),
      isLoop: Boolean(params.isLoop),
      entryFeeRp,
      rewardRp,
      checkpoints: check.normalizedCheckpoints,
    },
  };
}

export function exportCustomRaceTrackJson(track: CustomRaceTrackSpec): string {
  return JSON.stringify(track, null, 2);
}

export function importCustomRaceTrackJson(
  rawJson: string
): { track: CustomRaceTrackSpec | null; error?: string } {
  try {
    const parsed = JSON.parse(rawJson) as Partial<CustomRaceTrackSpec>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.name !== 'string') {
      return { track: null, error: 'Format JSON sirkuit tidak dikenali.' };
    }
    return createCustomRaceTrackSpec({
      name: parsed.name,
      subtitle: typeof parsed.subtitle === 'string' ? parsed.subtitle : undefined,
      authorName:
        typeof parsed.authorName === 'string' ? parsed.authorName : undefined,
      checkpoints: Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [],
      isLoop: Boolean(parsed.isLoop),
      entryFeeRp:
        typeof parsed.entryFeeRp === 'number' ? parsed.entryFeeRp : undefined,
      rewardRp: typeof parsed.rewardRp === 'number' ? parsed.rewardRp : undefined,
    });
  } catch {
    return { track: null, error: 'JSON sirkuit rusak atau gagal di-parse.' };
  }
}

/* ==========================================================================
 * GRAND PLAN 9.0: HIGH-STAKES STREET RACE WAGERS & PERSONAL BEST MEDALS
 * ========================================================================== */

export function computeHighStakesRaceTerms(
  baseEntryFeeRp: number,
  baseRewardRp: number,
  highStakes: boolean
): {
  entryFeeRp: number;
  firstPlaceRewardRp: number;
  repBonus: number;
} {
  if (!highStakes) {
    return {
      entryFeeRp: baseEntryFeeRp,
      firstPlaceRewardRp: baseRewardRp,
      repBonus: 6,
    };
  }
  return {
    entryFeeRp: Math.round(baseEntryFeeRp * 2),
    firstPlaceRewardRp: Math.round(baseRewardRp * 2.5),
    repBonus: 18,
  };
}

export function evaluateRaceTimeMedal(
  elapsedSec: number,
  checkpointCount: number
): RaceTimeMedal {
  const goldParSec = Math.max(12, checkpointCount * 5.2);
  const silverParSec = goldParSec * 1.32;
  if (elapsedSec <= goldParSec) return 'emas';
  if (elapsedSec <= silverParSec) return 'perak';
  return 'perunggu';
}

export function updatePersonalBestRaceRecord(
  records: Record<string, RaceRecordEntry>,
  raceId: string,
  elapsedSec: number,
  checkpointCount: number,
  nowMs: number = Date.now()
): {
  nextRecords: Record<string, RaceRecordEntry>;
  isNewBest: boolean;
  medal: RaceTimeMedal;
} {
  const roundedSec = Math.max(1, Math.round(elapsedSec * 100) / 100);
  const medal = evaluateRaceTimeMedal(roundedSec, checkpointCount);
  const prev = records[raceId];
  if (prev && prev.bestSec <= roundedSec) {
    return {
      nextRecords: records,
      isNewBest: false,
      medal,
    };
  }
  return {
    nextRecords: {
      ...records,
      [raceId]: {
        raceId,
        bestSec: roundedSec,
        medal,
        updatedAt: nowMs,
      },
    },
    isNewBest: true,
    medal,
  };
}



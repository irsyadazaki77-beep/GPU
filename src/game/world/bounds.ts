import type { BuildingFootprint, SidewalkBounds } from '../types';

export const WORLD_MAX_BOUND = 240;

/**
 * Curated Jakarta Landmarks & Hero City Buildings arranged on an authentic
 * Real-Jakarta North-South geographic axis:
 * - North (-Z <= -49): Ancol, PIK, Kota Tua, Glodok Chinatown, Tanjung Priok, Marunda
 * - Center (z in [-20..+20]): Monas & Medan Merdeka, Istiqlal (NE), Tanah Abang (W), Kemayoran (E)
 * - Thamrin - Sudirman Golden Corridor (+Z): Bundaran HI (0, +32), Thamrin, Sudirman, SCBD (E of Sudirman), GBK Senayan (SW)
 * - South (+Z >= +104): Tol Layang Simpang Semanggi (z=+80), Blok M & Melawai, Halim, Kemang, TB Simatupang, Pondok Indah, TMII
 */
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

  // NORTH JAKARTA COASTAL & HERITAGE CORRIDOR (z = -49, south of Jl. Pantai Utara -66)
  {
    id: 'museum_fatahillah',
    name: 'Gedung Balai Kota Tua (Fatahillah)',
    x: -18,
    z: -49,
    width: 16,
    depth: 11,
    height: 14,
    style: 'colonial',
    primaryColor: 0xfafaf9,
    accentColor: 0x9a3412,
  },
  {
    id: 'glodok_harco',
    name: 'Sentra Elektronik Glodok',
    x: 18,
    z: -49,
    width: 16,
    depth: 11,
    height: 16,
    style: 'ruko',
    primaryColor: 0x991b1b,
    accentColor: 0xfbbf24,
  },
  {
    id: 'ancol_marina_tower',
    name: 'Menara Bahari & Marina Ancol',
    x: -56,
    z: -49,
    width: 16,
    depth: 13,
    height: 28,
    style: 'skyscraper',
    primaryColor: 0x0369a1,
    accentColor: 0x2dd4bf,
  },
  {
    id: 'priok_container_terminal',
    name: 'Terminal Petikemas Tanjung Priok',
    x: 58,
    z: -49,
    width: 18,
    depth: 14,
    height: 16,
    style: 'port_crane',
    primaryColor: 0x0284c7,
    accentColor: 0xf97316,
  },
  {
    id: 'pik2_glass_pagoda',
    name: 'Pagoda Kaca & Dermaga Jet PIK 2',
    x: -106,
    z: -49,
    width: 14,
    depth: 14,
    height: 32,
    style: 'skyscraper',
    primaryColor: 0x0c4a6e,
    accentColor: 0x38bdf8,
  },
  {
    id: 'pik2_beach_club',
    name: 'Klub Pantai Pasir Putih PIK Utara',
    x: -168,
    z: -49,
    width: 18,
    depth: 14,
    height: 14,
    style: 'colonial',
    primaryColor: 0xf8fafc,
    accentColor: 0x0ea5e9,
  },
  {
    id: 'marunda_lighthouse_depot',
    name: 'Mercusuar & Depot Marunda Timur',
    x: 168,
    z: -49,
    width: 16,
    depth: 14,
    height: 30,
    style: 'skyscraper',
    primaryColor: 0x1e293b,
    accentColor: 0x22d3ee,
  },

  // CENTRAL JAKARTA: MEDAN MERDEKA, TANAH ABANG (W), KEMAYORAN (NE), KELAPA GADING (E)
  {
    id: 'blok_a_tanah_abang',
    name: 'Pusat Grosir Tanah Abang Blok A',
    x: -58,
    z: -17,
    width: 18,
    depth: 13,
    height: 18,
    style: 'pasar',
    primaryColor: 0x15803d,
    accentColor: 0xfacc15,
  },
  {
    id: 'ruko_kebon_kacang',
    name: 'Deretan Ruko Kebon Kacang',
    x: -58,
    z: 17,
    width: 16,
    depth: 11,
    height: 11,
    style: 'ruko',
    primaryColor: 0xb45309,
    accentColor: 0xfef08a,
  },
  {
    id: 'kemayoran_cyber_tower',
    name: 'Menara Radar & Siber Kemayoran',
    x: 58,
    z: -17,
    width: 14,
    depth: 13,
    height: 36,
    style: 'skyscraper',
    primaryColor: 0x0f172a,
    accentColor: 0x22d3ee,
  },
  {
    id: 'kelapa_gading_mall',
    name: 'Sentra Kelapa Gading & Summarecon',
    x: 168,
    z: -17,
    width: 20,
    depth: 15,
    height: 26,
    style: 'pasar',
    primaryColor: 0x0f766e,
    accentColor: 0xfef08a,
  },
  {
    id: 'soetta_cargo_hub',
    name: 'Hub Kargo Logistik Bandara Barat',
    x: -168,
    z: 17,
    width: 22,
    depth: 15,
    height: 16,
    style: 'port_crane',
    primaryColor: 0x334155,
    accentColor: 0xf59e0b,
  },

  // MH THAMRIN – BUNDARAN HI (0, +32) – SUDIRMAN – SCBD (+X, +Z) – GBK SENAYAN (-X, +Z)
  {
    id: 'plaza_thamrin',
    name: 'Grand Thamrin Plaza',
    x: -18,
    z: 17,
    width: 14,
    depth: 11,
    height: 38,
    style: 'skyscraper',
    primaryColor: 0x334155,
    accentColor: 0xfbbf24,
  },
  {
    id: 'menara_nusantara',
    name: 'Menara Nusantara Jaya Thamrin',
    x: 18,
    z: 17,
    width: 14,
    depth: 11,
    height: 42,
    style: 'skyscraper',
    primaryColor: 0x1e293b,
    accentColor: 0x2dd4bf,
  },
  {
    id: 'wisma_nabilo',
    name: 'Menara Wisma Nabilo 46 Sudirman',
    x: -18,
    z: 56,
    width: 13,
    depth: 13,
    height: 46,
    style: 'skyscraper',
    primaryColor: 0x1e293b,
    accentColor: 0x38bdf8,
  },
  {
    id: 'menara_bca_sudirman',
    name: 'Menara Finansial Sudirman',
    x: 18,
    z: 56,
    width: 13,
    depth: 13,
    height: 50,
    style: 'skyscraper',
    primaryColor: 0x0f172a,
    accentColor: 0x60a5fa,
  },
  {
    id: 'scbd_treasury_tower',
    name: 'Menara Bursa SCBD & Helipad',
    x: 58,
    z: 56,
    width: 15,
    depth: 15,
    height: 54,
    style: 'skyscraper',
    primaryColor: 0x0f172a,
    accentColor: 0xa855f7,
  },
  {
    id: 'gbk_senayan_dome',
    name: 'Kompleks Arena & Tribun Garuda Senayan',
    x: -106,
    z: 56,
    width: 16,
    depth: 12,
    height: 20,
    style: 'colonial',
    primaryColor: 0x1e293b,
    accentColor: 0xfacc15,
  },

  // SOUTH OF SEMANGGI (z = +80): BLOK M, MELAWAI, HALIM, KEMANG, SIMATUPANG, PONDOK INDAH, TMII
  {
    id: 'blok_m_square',
    name: 'Blok M Plaza & Terminal',
    x: -18,
    z: 104,
    width: 16,
    depth: 12,
    height: 16,
    style: 'pasar',
    primaryColor: 0xc2410c,
    accentColor: 0xfde047,
  },
  {
    id: 'melawai_night_club',
    name: 'Little Tokyo & Warung Melawai',
    x: 18,
    z: 104,
    width: 15,
    depth: 11,
    height: 12,
    style: 'ruko',
    primaryColor: 0x312e81,
    accentColor: 0xf43f5e,
  },
  {
    id: 'halim_bullet_station',
    name: 'Terminal Kereta Cepat Halim',
    x: 58,
    z: 104,
    width: 18,
    depth: 14,
    height: 18,
    style: 'port_crane',
    primaryColor: 0x991b1b,
    accentColor: 0xfef08a,
  },
  {
    id: 'tb_simatupang_hq',
    name: 'Menara Korporasi TB Simatupang',
    x: -18,
    z: 166,
    width: 18,
    depth: 14,
    height: 40,
    style: 'skyscraper',
    primaryColor: 0x0f172a,
    accentColor: 0x38bdf8,
  },
  {
    id: 'kemang_village_plaza',
    name: 'Kemang Village & Avenue Selatan',
    x: 18,
    z: 166,
    width: 16,
    depth: 13,
    height: 20,
    style: 'ruko',
    primaryColor: 0x7c2d12,
    accentColor: 0xf97316,
  },
  {
    id: 'tmii_archipelago_dome',
    name: 'Kubah Budaya Nusantara TMII',
    x: 58,
    z: 166,
    width: 16,
    depth: 12,
    height: 22,
    style: 'colonial',
    primaryColor: 0x7c2d12,
    accentColor: 0xfacc15,
  },
  {
    id: 'pondok_indah_tower',
    name: 'Menara Pondok Indah & Mal Selatan',
    x: -158,
    z: 166,
    width: 18,
    depth: 15,
    height: 42,
    style: 'skyscraper',
    primaryColor: 0x1e293b,
    accentColor: 0xfacc15,
  },
  {
    id: 'bekasi_industrial_depot',
    name: 'Kawasan Industri & Logistik Timur',
    x: 168,
    z: 166,
    width: 22,
    depth: 16,
    height: 18,
    style: 'port_crane',
    primaryColor: 0x1e3a8a,
    accentColor: 0xf59e0b,
  },
];

export const MAIN_BOULEVARD_SIDEWALK_SLABS: SidewalkBounds[] = [
  // N-S Thamrin-Sudirman slabs (cx = +-9.2, width = 4.3 -> [7.05, 11.35])
  { minX: -11.35, maxX: -7.05, minZ: -60, maxZ: -38 },
  { minX: 7.05, maxX: 11.35, minZ: -60, maxZ: -38 },
  { minX: -11.35, maxX: -7.05, minZ: -26, maxZ: -19 },
  { minX: 7.05, maxX: 11.35, minZ: -26, maxZ: -19 },
  { minX: -11.35, maxX: -7.05, minZ: 19, maxZ: 24 },
  { minX: 7.05, maxX: 11.35, minZ: 19, maxZ: 24 },
  { minX: -11.35, maxX: -7.05, minZ: 43, maxZ: 74 },
  { minX: 7.05, maxX: 11.35, minZ: 43, maxZ: 74 },
  { minX: -11.35, maxX: -7.05, minZ: 86, maxZ: 121 },
  { minX: 7.05, maxX: 11.35, minZ: 86, maxZ: 121 },
  // E-W Merdeka slabs (cz = +-9.2, depth = 4.3 -> [7.05, 11.35])
  { minX: -78, maxX: -38, minZ: -11.35, maxZ: -7.05 },
  { minX: -78, maxX: -38, minZ: 7.05, maxZ: 11.35 },
  { minX: -26, maxX: -20, minZ: -11.35, maxZ: -7.05 },
  { minX: -26, maxX: -20, minZ: 7.05, maxZ: 11.35 },
  { minX: 20, maxX: 26, minZ: -11.35, maxZ: -7.05 },
  { minX: 20, maxX: 26, minZ: 7.05, maxZ: 11.35 },
  { minX: 38, maxX: 78, minZ: -11.35, maxZ: -7.05 },
  { minX: 38, maxX: 78, minZ: 7.05, maxZ: 11.35 },
  // Outer Megapolitan Promenade Sidewalk Slabs
  { minX: -196, maxX: -140, minZ: 136, maxZ: 141 },
  { minX: -196, maxX: -140, minZ: -11.5, maxZ: -7.2 },
  { minX: 140, maxX: 196, minZ: 7.2, maxZ: 11.5 },
  { minX: -118, maxX: -40, minZ: 136, maxZ: 141 },
  { minX: 40, maxX: 118, minZ: 136, maxZ: 141 },
  { minX: -118, maxX: -40, minZ: 197, maxZ: 201 },
  { minX: 40, maxX: 118, minZ: 197, maxZ: 201 },
];

/**
 * Returns the physical surface elevation Y (in meters) at world coordinates (x, z),
 * including the Elevated Semanggi-Gatot Subroto Inner-City Tollway at z = +80.
 *
 * When `currentY` is supplied, ground-level actors/vehicles passing beneath the bridge
 * remain at street level (`0`), whereas entities approaching from the ground-level ramp
 * mouths (`bridgeY <= 1.85`) or already near/above deck elevation (`currentY >= bridgeY - 2.4`)
 * smoothly ride the elevated deck & ramps.
 */
export function getGroundElevationAt(
  x: number,
  z: number,
  currentY?: number
): number {
  let bridgeY = 0;
  if (z >= 75.5 && z <= 84.5) {
    if (x >= -42 && x <= 42) {
      bridgeY = 6.2;
    } else if (x >= -68 && x < -42) {
      const t = (x - -68) / 26;
      bridgeY = Math.max(0, Math.min(6.2, t * 6.2));
    } else if (x > 42 && x <= 68) {
      const t = (68 - x) / 26;
      bridgeY = Math.max(0, Math.min(6.2, t * 6.2));
    }
  }
  if (bridgeY <= 0) return 0;
  if (currentY === undefined) return bridgeY;
  if (currentY >= bridgeY - 2.4 || bridgeY <= 1.85) {
    return bridgeY;
  }
  return 0;
}

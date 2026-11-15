import type { BuildingFootprint, SidewalkBounds } from '../types';

export const WORLD_MAX_BOUND = 92;

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
  // TAHAP 2 NEW LANDMARKS: Tanjung Priok Container Port & SCBD Towers
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

export const MAIN_BOULEVARD_SIDEWALK_SLABS: SidewalkBounds[] = [
  // N-S Sudirman slabs (cx = +-9.2, width = 4.3 -> [7.05, 11.35])
  { minX: -11.35, maxX: -7.05, minZ: -86, maxZ: -42 },
  { minX: 7.05, maxX: 11.35, minZ: -86, maxZ: -42 },
  { minX: -11.35, maxX: -7.05, minZ: -19, maxZ: -8 },
  { minX: 7.05, maxX: 11.35, minZ: -19, maxZ: -8 },
  { minX: -11.35, maxX: -7.05, minZ: 19, maxZ: 25 },
  { minX: 7.05, maxX: 11.35, minZ: 19, maxZ: 25 },
  { minX: -11.35, maxX: -7.05, minZ: 40, maxZ: 86 },
  { minX: 7.05, maxX: 11.35, minZ: 40, maxZ: 86 },
  // E-W Merdeka slabs (cz = +-9.2, depth = 4.3 -> [7.05, 11.35])
  { minX: -82, maxX: -40, minZ: -11.35, maxZ: -7.05 },
  { minX: -82, maxX: -40, minZ: 7.05, maxZ: 11.35 },
  { minX: -25, maxX: -20, minZ: -11.35, maxZ: -7.05 },
  { minX: -25, maxX: -20, minZ: 7.05, maxZ: 11.35 },
  { minX: 20, maxX: 25, minZ: -11.35, maxZ: -7.05 },
  { minX: 20, maxX: 25, minZ: 7.05, maxZ: 11.35 },
  { minX: 40, maxX: 82, minZ: -11.35, maxZ: -7.05 },
  { minX: 40, maxX: 82, minZ: 7.05, maxZ: 11.35 },
];

/**
 * Returns the physical surface elevation Y (in meters) at world coordinates (x, z),
 * including the Jakarta Inner-City Elevated Toll Highway (Tol Layang Semanggi - Kemayoran).
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

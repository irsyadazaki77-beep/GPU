import type { PlayerProgressState } from './types';

export interface NusantaraPackageSpec {
  id: string;
  title: string;
  districtName: string;
  x: number;
  y: number;
  z: number;
  rewardRp: number;
}

export const NUSANTARA_PACKAGE_REWARD_RP = 150_000;
export const NUSANTARA_ALL_PACKAGES_BONUS_RP = 2_000_000;

export const NUSANTARA_PACKAGES: NusantaraPackageSpec[] = [
  {
    id: 'pkg_monas_crest',
    title: 'Koper Emas Pelataran Monas',
    districtName: 'Medan Merdeka & Monas',
    x: 11,
    y: 0.7,
    z: -11,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_tol_semanggi',
    title: 'Koper Emas Dek Tol Layang Semanggi',
    districtName: 'Tol Layang Semanggi',
    x: 0,
    y: 6.9,
    z: -26,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_teluk_karang',
    title: 'Koper Emas Pulau Karang Kepulauan Seribu',
    districtName: 'Teluk Jakarta & Kepulauan Seribu',
    x: -48,
    y: 1.5,
    z: -83,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_priok_dermaga',
    title: 'Koper Emas Kontainer Tanjung Priok',
    districtName: 'Pelabuhan Tanjung Priok',
    x: 54,
    y: 0.7,
    z: -68,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_scbd_plaza',
    title: 'Koper Emas Bursa SCBD',
    districtName: 'Kawasan Elit SCBD',
    x: -48,
    y: 0.7,
    z: -48,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_blokm_arcade',
    title: 'Koper Emas Little Tokyo Melawai',
    districtName: 'Blok M & Melawai',
    x: 16,
    y: 0.7,
    z: 66,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_gbk_senayan',
    title: 'Koper Emas Pelataran GBK Senayan',
    districtName: 'Gelora Senayan GBK',
    x: -74,
    y: 0.7,
    z: 36,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_kemayoran_radar',
    title: 'Koper Emas Menara Siber Kemayoran',
    districtName: 'Kemayoran Siber',
    x: 74,
    y: 0.7,
    z: -36,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_pik2_coast',
    title: 'Koper Emas Pagoda Pesisir PIK 2',
    districtName: 'PIK 2 & Mangrove',
    x: -92,
    y: 0.7,
    z: -16,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
  {
    id: 'pkg_outer_beltway',
    title: 'Koper Emas Sabuk Luar Selatan Jakarta',
    districtName: 'Koridor Sabuk Luar',
    x: 0,
    y: 0.7,
    z: 128,
    rewardRp: NUSANTARA_PACKAGE_REWARD_RP,
  },
];

export function collectNusantaraPackage(
  state: PlayerProgressState,
  packageId: string
): {
  collected: boolean;
  allCompleted: boolean;
  totalCollected: number;
  rewardRp: number;
  nextState: PlayerProgressState;
} {
  const spec = NUSANTARA_PACKAGES.find((p) => p.id === packageId);
  if (!spec) {
    return {
      collected: false,
      allCompleted: false,
      totalCollected: (state.collectedPackages || []).length,
      rewardRp: 0,
      nextState: state,
    };
  }

  const prevCollected = state.collectedPackages || [];
  if (prevCollected.includes(packageId)) {
    return {
      collected: false,
      allCompleted: prevCollected.length >= NUSANTARA_PACKAGES.length,
      totalCollected: prevCollected.length,
      rewardRp: 0,
      nextState: state,
    };
  }

  const nextCollected = [...prevCollected, packageId];
  const allCompleted = nextCollected.length >= NUSANTARA_PACKAGES.length;
  const totalReward =
    spec.rewardRp + (allCompleted ? NUSANTARA_ALL_PACKAGES_BONUS_RP : 0);
  const nextScore = state.score + (allCompleted ? 2500 : 350);

  return {
    collected: true,
    allCompleted,
    totalCollected: nextCollected.length,
    rewardRp: totalReward,
    nextState: {
      ...state,
      rupiah: state.rupiah + totalReward,
      score: nextScore,
      bestScore: Math.max(state.bestScore, nextScore),
      collectedPackages: nextCollected,
    },
  };
}

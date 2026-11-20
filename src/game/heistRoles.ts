import { PlayerProgressState, ProtagonistId, StreetContractKind } from './types';

export interface HeistRoleProfile {
  id: ProtagonistId;
  name: string;
  codename: string;
  roleTitle: string;
  specialtySummary: string;
  damageReductionBonus: number;
  sprintAndBikeMultiplier: number;
  canHackTrafficAndCameras: boolean;
  defaultSupportOffset: { x: number; z: number };
}

export const HEIST_PROTAGONIST_ROLES: Record<ProtagonistId, HeistRoleProfile> = {
  nabilo: {
    id: 'nabilo',
    name: 'Nabilo',
    codename: 'GARUDA-1',
    roleTitle: 'Heavy Enforcer & Getaway Driver',
    specialtySummary: 'Tahan benturan +25%, kontrol sasis kendaraan berat, dan barisan depan baku tembak.',
    damageReductionBonus: 0.25,
    sprintAndBikeMultiplier: 1.0,
    canHackTrafficAndCameras: false,
    defaultSupportOffset: { x: -3.2, z: -2.4 },
  },
  raka: {
    id: 'raka',
    name: 'Raka',
    codename: 'KILAT-2',
    roleTitle: 'High-Speed Courier & Flanker',
    specialtySummary: 'Akselerasi motor/sprint +22%, manuver celah sempit, dan penyergapan sayap cepat.',
    damageReductionBonus: 0.08,
    sprintAndBikeMultiplier: 1.22,
    canHackTrafficAndCameras: false,
    defaultSupportOffset: { x: 3.4, z: -1.8 },
  },
  kirana: {
    id: 'kirana',
    name: 'Kirana',
    codename: 'SIBER-3',
    roleTitle: 'Glodok Tech Hacker & Overwatch',
    specialtySummary: 'Retas lampu lalu lintas distrik jadi hijau & butakan kamera/helikopter selama 20 detik [H].',
    damageReductionBonus: 0.1,
    sprintAndBikeMultiplier: 1.08,
    canHackTrafficAndCameras: true,
    defaultSupportOffset: { x: 0.0, z: -4.2 },
  },
};

const PROTAGONIST_ROTATION: ProtagonistId[] = ['nabilo', 'raka', 'kirana'];

/**
 * Cycles or selects the active protagonist during Free Roam or Grand Heists (`[C]`).
 */
export function switchHeistProtagonistRole(
  state: PlayerProgressState,
  targetProtagonist?: ProtagonistId
): { state: PlayerProgressState; profile: HeistRoleProfile; switched: boolean } {
  const currentIdx = PROTAGONIST_ROTATION.indexOf(state.activeProtagonist);
  const nextId =
    targetProtagonist ??
    PROTAGONIST_ROTATION[(currentIdx + 1) % PROTAGONIST_ROTATION.length];
  const profile = HEIST_PROTAGONIST_ROLES[nextId];

  if (nextId === state.activeProtagonist) {
    return { state, profile, switched: false };
  }

  return {
    state: {
      ...state,
      activeProtagonist: nextId,
    },
    profile,
    switched: true,
  };
}

export interface KiranaDistrictHackState {
  active: boolean;
  remainingSeconds: number;
  cooldownSeconds: number;
  forceGreenLights: boolean;
  cameraBlackout: boolean;
}

export const KIRANA_HACK_DURATION_SEC = 20;
export const KIRANA_HACK_COOLDOWN_SEC = 35;

export function createInitialKiranaHackState(): KiranaDistrictHackState {
  return {
    active: false,
    remainingSeconds: 0,
    cooldownSeconds: 0,
    forceGreenLights: false,
    cameraBlackout: false,
  };
}

/**
 * Triggers Kirana's 20-second Glodok Cyber Overdrive:
 * - Forces district traffic lights green for high-speed getaway
 * - Disables police CCTV & helicopter spotlight lock
 */
export function triggerKiranaDistrictHack(
  activeProtagonist: ProtagonistId,
  hackState: KiranaDistrictHackState
): { hackState: KiranaDistrictHackState; triggered: boolean; message: string } {
  if (activeProtagonist !== 'kirana') {
    return {
      hackState,
      triggered: false,
      message: 'Beralih ke Kirana [C] untuk mengaktifkan Retas Siber Distrik.',
    };
  }
  if (hackState.active) {
    return {
      hackState,
      triggered: false,
      message: `Retas Siber aktif (${Math.ceil(hackState.remainingSeconds)} dtk tersisa).`,
    };
  }
  if (hackState.cooldownSeconds > 0) {
    return {
      hackState,
      triggered: false,
      message: `Modul Siber Glodok sedang pendinginan (${Math.ceil(hackState.cooldownSeconds)} dtk).`,
    };
  }

  return {
    hackState: {
      active: true,
      remainingSeconds: KIRANA_HACK_DURATION_SEC,
      cooldownSeconds: KIRANA_HACK_COOLDOWN_SEC,
      forceGreenLights: true,
      cameraBlackout: true,
    },
    triggered: true,
    message: 'RETAS SIBER AKTIF (20 dtk): Semua lampu lalu lintas HIJAU & radar polisi buta!',
  };
}

export function stepKiranaDistrictHack(
  hackState: KiranaDistrictHackState,
  dt: number
): KiranaDistrictHackState {
  const safeDt = Math.max(0, dt);
  if (hackState.active) {
    const nextRemaining = Math.max(0, hackState.remainingSeconds - safeDt);
    const stillActive = nextRemaining > 0;
    return {
      active: stillActive,
      remainingSeconds: nextRemaining,
      cooldownSeconds: hackState.cooldownSeconds,
      forceGreenLights: stillActive,
      cameraBlackout: stillActive,
    };
  }
  if (hackState.cooldownSeconds > 0) {
    return {
      ...hackState,
      cooldownSeconds: Math.max(0, hackState.cooldownSeconds - safeDt),
    };
  }
  return hackState;
}

export interface HeistSupportNpcPose {
  protagonistId: ProtagonistId;
  name: string;
  x: number;
  z: number;
  heading: number;
  roleTitle: string;
}

/**
 * Computes formation positions for the 2 non-active protagonists so they hold AI support positions near the active protagonist.
 */
export function computeHeistAiSupportPositions(
  activeProtagonist: ProtagonistId,
  leaderX: number,
  leaderZ: number,
  leaderHeading: number
): HeistSupportNpcPose[] {
  const cos = Math.cos(leaderHeading);
  const sin = Math.sin(leaderHeading);
  const poses: HeistSupportNpcPose[] = [];

  for (const id of PROTAGONIST_ROTATION) {
    if (id === activeProtagonist) continue;
    const profile = HEIST_PROTAGONIST_ROLES[id];
    const ox = profile.defaultSupportOffset.x;
    const oz = profile.defaultSupportOffset.z;
    const worldX = leaderX + ox * cos - oz * sin;
    const worldZ = leaderZ + ox * sin + oz * cos;
    poses.push({
      protagonistId: id,
      name: profile.name,
      x: Math.round(worldX * 100) / 100,
      z: Math.round(worldZ * 100) / 100,
      heading: leaderHeading,
      roleTitle: profile.roleTitle,
    });
  }

  return poses;
}

export interface JakartaSideJobSpec {
  id: Extract<StreetContractKind, 'ojol_delivery' | 'glodok_arena' | 'priok_container_heist'>;
  title: string;
  districtId: 'scbd' | 'glodok' | 'priok' | 'kota_tua';
  recommendedProtagonist: ProtagonistId;
  summary: string;
  timeLimitSeconds: number;
  rewardMoney: number;
  rewardReputation: number;
  startPoint: { x: number; z: number };
  targetPoint: { x: number; z: number };
}

export const JAKARTA_SIDE_JOBS: JakartaSideJobSpec[] = [
  {
    id: 'ojol_delivery',
    title: 'Ojol Express: Paket Kilat Sudirman–Kota Tua',
    districtId: 'scbd',
    recommendedProtagonist: 'raka',
    summary: 'Antarkan dokumen rahasia korporat menembus kemacetan protokol sebelum batas waktu habis.',
    timeLimitSeconds: 95,
    rewardMoney: 340,
    rewardReputation: 24,
    startPoint: { x: 0, z: 32 },
    targetPoint: { x: 0, z: -215 },
  },
  {
    id: 'glodok_arena',
    title: 'Glodok Underground Arena: Gelombang Sindikat',
    districtId: 'glodok',
    recommendedProtagonist: 'nabilo',
    summary: 'Bertahan hidup dari gelombang petarung jalanan di gang neon Glodok dan rebut taruhan utama.',
    timeLimitSeconds: 120,
    rewardMoney: 520,
    rewardReputation: 38,
    startPoint: { x: -58, z: -172 },
    targetPoint: { x: -45, z: -185 },
  },
  {
    id: 'priok_container_heist',
    title: 'Priok Container Heist: Ekstraksi Kendaraan Impor',
    districtId: 'priok',
    recommendedProtagonist: 'kirana',
    summary: 'Retas manifest kargo Pelabuhan Tanjung Priok dan bawa kabur kendaraan selundupan ke safehouse.',
    timeLimitSeconds: 150,
    rewardMoney: 780,
    rewardReputation: 52,
    startPoint: { x: 255, z: -255 },
    targetPoint: { x: -34, z: -34 },
  },
];

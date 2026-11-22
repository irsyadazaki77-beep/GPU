import type {
  RivalBossSpec,
  SpeedTrapSpec,
  VigilantePatrolSession,
  WeatherMode,
} from './types';

/* ==========================================================================
 * 1. RAJAWALI-X FPV RECON DRONE KINEMATICS & EMP
 * ========================================================================== */

export interface DroneReconPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  empCooldownSec: number;
}

export function stepDroneReconPose(params: {
  pose: DroneReconPose;
  playerX: number;
  playerZ: number;
  forwardInput: number;
  strafeInput: number;
  climbInput: number;
  yawInput: number;
  dt: number;
  maxLeashM?: number;
}): DroneReconPose {
  const dt = Math.max(0.001, Math.min(0.05, params.dt));
  const maxLeash = params.maxLeashM ?? 68;
  const speed = 20;

  const nextYaw = params.pose.yaw - params.yawInput * 2.1 * dt;
  const fwdX = Math.sin(nextYaw);
  const fwdZ = Math.cos(nextYaw);
  const rightX = Math.cos(nextYaw);
  const rightZ = -Math.sin(nextYaw);

  let nextX =
    params.pose.x +
    (fwdX * params.forwardInput + rightX * params.strafeInput) * speed * dt;
  let nextZ =
    params.pose.z +
    (fwdZ * params.forwardInput + rightZ * params.strafeInput) * speed * dt;
  const nextY = Math.max(
    2.4,
    Math.min(44, params.pose.y + params.climbInput * 14 * dt)
  );

  // Enforce radial leash around protagonist so drone stays within radio link
  const dx = nextX - params.playerX;
  const dz = nextZ - params.playerZ;
  const dist = Math.hypot(dx, dz);
  if (dist > maxLeash) {
    const scale = maxLeash / dist;
    nextX = params.playerX + dx * scale;
    nextZ = params.playerZ + dz * scale;
  }

  return {
    x: nextX,
    y: nextY,
    z: nextZ,
    yaw: nextYaw,
    empCooldownSec: Math.max(0, params.pose.empCooldownSec - dt),
  };
}

export function computeDroneEmpRadius(droneLevel: number): number {
  return 13 + Math.max(1, droneLevel) * 2.5;
}

/* ==========================================================================
 * 2. JAKARTA ETLE SPEED TRAPS (KAMERA KECEPATAN)
 * ========================================================================== */

export const JAKARTA_SPEED_TRAPS: SpeedTrapSpec[] = [
  {
    id: 'etle_sudirman_hi',
    name: 'Kamera ETLE Bundaran HI - Sudirman',
    x: 0,
    z: -32,
    targetKmh: 95,
    rewardRp: 45000,
  },
  {
    id: 'etle_semanggi_toll',
    name: 'ETLE Tol Layang Simpang Semanggi',
    x: -44,
    z: -48,
    targetKmh: 120,
    rewardRp: 75000,
  },
  {
    id: 'etle_scbd_night',
    name: 'ETLE Koridor SCBD Lot 10',
    x: -56,
    z: -28,
    targetKmh: 110,
    rewardRp: 65000,
  },
  {
    id: 'etle_kemayoran',
    name: 'ETLE Sirkuit Boulevard Kemayoran',
    x: 42,
    z: -16,
    targetKmh: 115,
    rewardRp: 70000,
  },
  {
    id: 'etle_jorr_selatan',
    name: 'ETLE Tol Lingkar Luar JORR',
    x: 16,
    z: 178,
    targetKmh: 135,
    rewardRp: 95000,
  },
];

export function evaluateSpeedTrapTrigger(params: {
  x: number;
  z: number;
  speedKmh: number;
  records: Record<string, number>;
  cooldowns: Record<string, number>;
  nowMs: number;
}): {
  triggered: boolean;
  trap: SpeedTrapSpec | null;
  isNewRecord: boolean;
  rewardRp: number;
  wantedTriggered: boolean;
} {
  for (const trap of JAKARTA_SPEED_TRAPS) {
    const lastMs = params.cooldowns[trap.id] ?? -99999;
    if (params.nowMs - lastMs < 15000) continue;

    const dist = Math.hypot(params.x - trap.x, params.z - trap.z);
    if (dist <= 9.5 && params.speedKmh >= trap.targetKmh) {
      const prevBest = params.records[trap.id] ?? 0;
      const isNewRecord = params.speedKmh > prevBest;
      const bonus = isNewRecord ? trap.rewardRp : Math.round(trap.rewardRp * 0.45);
      return {
        triggered: true,
        trap,
        isNewRecord,
        rewardRp: bonus,
        wantedTriggered: params.speedKmh >= 165,
      };
    }
  }
  return {
    triggered: false,
    trap: null,
    isNewRecord: false,
    rewardRp: 0,
    wantedTriggered: false,
  };
}

/* ==========================================================================
 * 3. VIGILANTE PATROL MODE & RIVAL STREET BOSSES
 * ========================================================================== */

export const RIVAL_BOSS_CATALOG: RivalBossSpec[] = [
  {
    id: 'boss_bang_jago',
    name: 'Bang Jago Pasar',
    title: 'Penguasa Blok Tanah Abang',
    districtId: 'tanah_abang',
    x: -54,
    z: 14,
    maxHp: 380,
    rewardRp: 240000,
    policy: 'charger_enforcer',
  },
  {
    id: 'boss_siren_scbd',
    name: 'Siren Queen',
    title: 'Ratu Balap Liar SCBD',
    districtId: 'scbd',
    x: -60,
    z: -54,
    maxHp: 340,
    rewardRp: 280000,
    policy: 'ranged_kiter',
  },
  {
    id: 'boss_komandan_priok',
    name: 'Komandan Dermaga',
    title: 'Panglima Kartel Tanjung Priok',
    districtId: 'tanjung_priok',
    x: 62,
    z: -56,
    maxHp: 460,
    rewardRp: 350000,
    policy: 'charger_enforcer',
  },
];

const VIGILANTE_LOCATIONS = [
  { name: 'Pembajak Supercar SCBD', district: 'SCBD & Semanggi', x: -58, z: -42 },
  { name: 'Kurir Sindikat Tanjung Priok', district: 'Tanjung Priok', x: 56, z: -48 },
  { name: 'Pembalap Buronan JORR', district: 'Blok M & Melawai', x: 18, z: 66 },
  { name: 'Perampok Brankas Kota Tua', district: 'Kota Tua & Glodok', x: 52, z: 16 },
];

export function createVigilantePatrolSession(streak: number): VigilantePatrolSession {
  const pick = VIGILANTE_LOCATIONS[streak % VIGILANTE_LOCATIONS.length];
  return {
    id: `vig_${Date.now()}_${streak}`,
    targetName: pick.name,
    districtName: pick.district,
    targetX: pick.x,
    targetZ: pick.z,
    targetHp: 180 + streak * 35,
    maxHp: 180 + streak * 35,
    rewardRp: 145000 + streak * 45000,
    streak,
    status: 'active',
  };
}

export function stepVigilanteTargetMovement(params: {
  targetX: number;
  targetZ: number;
  playerX: number;
  playerZ: number;
  dt: number;
}): { x: number; z: number; heading: number; speed: number } {
  const dx = params.targetX - params.playerX;
  const dz = params.targetZ - params.playerZ;
  const dist = Math.hypot(dx, dz) || 1;
  const heading = Math.atan2(dx / dist, dz / dist);
  const speed = dist < 45 ? 19.5 : 13.5;
  const cDt = Math.max(0.001, Math.min(0.05, params.dt));
  let nx = params.targetX + Math.sin(heading) * speed * cDt;
  let nz = params.targetZ + Math.cos(heading) * speed * cDt;

  // Keep target inside playable Jakarta perimeter [-210, 210]
  if (Math.abs(nx) > 210) nx = Math.sign(nx) * 210;
  if (Math.abs(nz) > 210) nz = Math.sign(nz) * 210;

  return { x: nx, z: nz, heading, speed };
}

/* ==========================================================================
 * 4. SLIPSTREAM DRAFTING & MONSOON SURGE ECONOMY
 * ========================================================================== */

export function computeSlipstreamDraftBoost(params: {
  playerX: number;
  playerZ: number;
  playerHeading: number;
  playerSpeed: number;
  otherVehicles: readonly { x: number; z: number; speed: number }[];
}): { drafting: boolean; speedMultiplier: number; fokusBonusPerSec: number } {
  if (params.playerSpeed < 10) {
    return { drafting: false, speedMultiplier: 1.0, fokusBonusPerSec: 0 };
  }
  const fwdX = Math.sin(params.playerHeading);
  const fwdZ = Math.cos(params.playerHeading);

  for (let i = 0; i < params.otherVehicles.length; i++) {
    const o = params.otherVehicles[i];
    if (Math.abs(o.speed) < 6) continue;
    const dx = o.x - params.playerX;
    const dz = o.z - params.playerZ;
    const dist = Math.hypot(dx, dz);
    if (dist < 3.5 || dist > 18.5) continue;
    const dot = (dx / dist) * fwdX + (dz / dist) * fwdZ;
    if (dot >= 0.86) {
      return {
        drafting: true,
        speedMultiplier: 1.18,
        fokusBonusPerSec: 4.5,
      };
    }
  }
  return { drafting: false, speedMultiplier: 1.0, fokusBonusPerSec: 0 };
}

export function computeSurgeFareMultiplier(
  weatherMode: WeatherMode,
  worldTimeMinutes: number
): number {
  let mult = 1.0;
  if (weatherMode === 'hujan') mult += 0.35;
  const hour = Math.floor((worldTimeMinutes % 1440) / 60);
  if (hour >= 17 && hour <= 22) mult += 0.25;
  return Number(mult.toFixed(2));
}

/* ==========================================================================
 * 5. AMBIENT SKY AIRSPACE & JAKARTA BAY MARINE TRAFFIC KINEMATICS
 * ========================================================================== */

export function computeAmbientSkyAndMarinePose(elapsedSec: number): {
  skyHeli1: { x: number; y: number; z: number; heading: number };
  skyHeli2: { x: number; y: number; z: number; heading: number };
  bayBoat1: { x: number; y: number; z: number; heading: number };
  bayBoat2: { x: number; y: number; z: number; heading: number };
} {
  const t1 = elapsedSec * 0.14;
  const h1x = Math.cos(t1) * 78;
  const h1z = Math.sin(t1) * 68;
  const h1Heading = Math.atan2(-Math.sin(t1) * 78, Math.cos(t1) * 68);

  const t2 = elapsedSec * 0.09 + Math.PI;
  const h2x = Math.cos(t2) * 124;
  const h2z = Math.sin(t2) * 112;
  const h2Heading = Math.atan2(-Math.sin(t2) * 124, Math.cos(t2) * 112);

  // Jakarta Bay marine corridor along northern water z in [-145, -92]
  const b1t = elapsedSec * 0.12;
  const b1x = Math.sin(b1t) * 110;
  const b1z = -104 + Math.cos(b1t * 2) * 10;
  const b1Heading = Math.atan2(Math.cos(b1t) * 110, -Math.sin(b1t * 2) * 20);

  const b2t = elapsedSec * 0.1 + 1.8;
  const b2x = Math.cos(b2t) * 125;
  const b2z = -126 + Math.sin(b2t) * 12;
  const b2Heading = Math.atan2(-Math.sin(b2t) * 125, Math.cos(b2t) * 12);

  return {
    skyHeli1: { x: h1x, y: 31, z: h1z, heading: h1Heading },
    skyHeli2: { x: h2x, y: 38, z: h2z, heading: h2Heading },
    bayBoat1: { x: b1x, y: 0.18, z: b1z, heading: b1Heading },
    bayBoat2: { x: b2x, y: 0.18, z: b2z, heading: b2Heading },
  };
}

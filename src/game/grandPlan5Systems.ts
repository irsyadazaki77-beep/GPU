import type {
  AcousticZoneId,
  CoopHeistSyncState,
  HeistId,
  InteriorZoneId,
  NetPeerSnapshot,
  ProtagonistId,
  RadioBroadcastMessage,
  RadioStationId,
  VehicleDamageState,
  VehicleType,
  WeatherMode,
} from './types';

/* ==========================================================================
 * 1. STEALTH CROUCH, SUPPRESSOR NOISE & SILENT TAKEDOWN
 * ========================================================================== */

export interface StealthDetectionInput {
  crouching: boolean;
  inCover: boolean;
  hasSuppressor: boolean;
  isNightOrRain: boolean;
}

export function computeStealthDetectionProfile(input: StealthDetectionInput): {
  detectionRadiusMultiplier: number;
  gunshotNoiseRadius: number;
  footstepNoiseRadius: number;
} {
  let mult = 1.0;
  if (input.crouching) mult *= 0.52;
  if (input.inCover) mult *= 0.62;
  if (input.isNightOrRain) mult *= 0.85;
  mult = Math.max(0.24, Math.min(1.0, Number(mult.toFixed(3))));

  const gunshotNoiseRadius = input.hasSuppressor ? 7.5 : 34;
  const footstepNoiseRadius = input.crouching ? 2.2 : 6.8;

  return {
    detectionRadiusMultiplier: mult,
    gunshotNoiseRadius,
    footstepNoiseRadius,
  };
}

export function canPerformSilentTakedown(params: {
  playerX: number;
  playerZ: number;
  enemyX: number;
  enemyZ: number;
  enemyFacing: number;
  enemyAlerted: boolean;
  isStealthOrMelee: boolean;
}): boolean {
  const dx = params.playerX - params.enemyX;
  const dz = params.playerZ - params.enemyZ;
  const dist = Math.hypot(dx, dz);
  if (dist > 2.85 || dist < 0.05) return false;
  if (!params.isStealthOrMelee) return false;

  // Enemy faces (sin(facing), cos(facing)). Behind means dot(toPlayer, enemyForward) < 0.25
  const fwdX = Math.sin(params.enemyFacing);
  const fwdZ = Math.cos(params.enemyFacing);
  const dot = (dx / dist) * fwdX + (dz / dist) * fwdZ;
  return dot < 0.25 || !params.enemyAlerted;
}

/* ==========================================================================
 * 2. PARACHUTE & SKYDIVING PHYSICS
 * ========================================================================== */

export const PARACHUTE_DEPLOY_MIN_AGL = 6.5;

export function canDeployParachute(params: {
  playerY: number;
  groundY: number;
  drivingVehicleId: string | null;
  alreadyDeployed: boolean;
  ridingMrt: boolean;
}): boolean {
  if (params.drivingVehicleId || params.alreadyDeployed || params.ridingMrt) {
    return false;
  }
  return params.playerY - params.groundY >= PARACHUTE_DEPLOY_MIN_AGL;
}

export function stepParachuteGlide(params: {
  x: number;
  y: number;
  z: number;
  heading: number;
  vy: number;
  groundY: number;
  forwardInput: number;
  turnInput: number;
  brakeInput: boolean;
  dt: number;
}): {
  x: number;
  y: number;
  z: number;
  heading: number;
  vy: number;
  glideSpeed: number;
  landed: boolean;
} {
  const dt = Math.max(0.001, Math.min(0.05, params.dt));
  const nextHeading = params.heading - params.turnInput * 1.45 * dt;
  const targetGlideSpeed = params.brakeInput
    ? 5.2
    : params.forwardInput > 0.1
      ? 16.5
      : 10.8;
  const targetDescent = params.brakeInput ? -2.4 : params.forwardInput > 0.1 ? -4.2 : -3.1;
  const nextVy = params.vy + (targetDescent - params.vy) * Math.min(1, dt * 6);

  const nextX = params.x + Math.sin(nextHeading) * targetGlideSpeed * dt;
  const nextZ = params.z + Math.cos(nextHeading) * targetGlideSpeed * dt;
  const nextY = params.y + nextVy * dt;

  if (nextY <= params.groundY + 0.18) {
    return {
      x: nextX,
      y: params.groundY,
      z: nextZ,
      heading: nextHeading,
      vy: 0,
      glideSpeed: 0,
      landed: true,
    };
  }

  return {
    x: nextX,
    y: nextY,
    z: nextZ,
    heading: nextHeading,
    vy: nextVy,
    glideSpeed: targetGlideSpeed,
    landed: false,
  };
}

/* ==========================================================================
 * 3. RAGDOLL KNOCKBACK & DETACHABLE VEHICLE DEBRIS
 * ========================================================================== */

export interface RagdollMotionState {
  active: boolean;
  vx: number;
  vy: number;
  vz: number;
  spinX: number;
  spinZ: number;
  angleX: number;
  angleZ: number;
  yOffset: number;
  bounces: number;
}

export function createRagdollImpulse(params: {
  dirX: number;
  dirZ: number;
  force: number;
  isExplosion?: boolean;
}): RagdollMotionState {
  const len = Math.hypot(params.dirX, params.dirZ) || 1;
  const nx = params.dirX / len;
  const nz = params.dirZ / len;
  const speed = Math.min(24, Math.max(3.5, params.force));
  const lift = params.isExplosion ? Math.min(12.5, speed * 0.65) : Math.min(6.8, speed * 0.34);

  return {
    active: true,
    vx: nx * speed,
    vy: lift,
    vz: nz * speed,
    spinX: (params.isExplosion ? 9.5 : 5.8) * (nz >= 0 ? 1 : -1),
    spinZ: (params.isExplosion ? 7.2 : 3.6) * (nx >= 0 ? -1 : 1),
    angleX: 0,
    angleZ: 0,
    yOffset: 0.15,
    bounces: 0,
  };
}

export function stepRagdollState(
  state: RagdollMotionState,
  dt: number
): { next: RagdollMotionState; dx: number; dz: number } {
  if (!state.active) {
    return { next: state, dx: 0, dz: 0 };
  }
  const cDt = Math.max(0.001, Math.min(0.05, dt));
  const gravity = 21.5;

  let vx = state.vx * Math.exp(-2.1 * cDt);
  let vz = state.vz * Math.exp(-2.1 * cDt);
  let vy = state.vy - gravity * cDt;
  let yOffset = state.yOffset + vy * cDt;
  let bounces = state.bounces;

  let angleX = state.angleX + state.spinX * cDt;
  let angleZ = state.angleZ + state.spinZ * cDt;
  let spinX = state.spinX;
  let spinZ = state.spinZ;

  if (yOffset <= 0) {
    yOffset = 0;
    if (Math.abs(vy) > 2.4 && bounces < 2) {
      vy = -vy * 0.36;
      vx *= 0.65;
      vz *= 0.65;
      spinX *= 0.45;
      spinZ *= 0.45;
      bounces++;
    } else {
      vy = 0;
      vx *= Math.exp(-8 * cDt);
      vz *= Math.exp(-8 * cDt);
      spinX = 0;
      spinZ = 0;
      // Settle flat on ground
      angleX = Math.abs(angleX) > 0.4 ? Math.sign(angleX) * (Math.PI * 0.48) : Math.PI * 0.48;
      angleZ = Math.max(-0.5, Math.min(0.5, angleZ));
    }
  }

  const settled = yOffset === 0 && vy === 0 && Math.hypot(vx, vz) < 0.25;
  return {
    next: {
      active: !settled,
      vx: settled ? 0 : vx,
      vy,
      vz: settled ? 0 : vz,
      spinX,
      spinZ,
      angleX,
      angleZ,
      yOffset,
      bounces,
    },
    dx: vx * cDt,
    dz: vz * cDt,
  };
}

export type VehicleDebrisPartKind = 'bumper' | 'door' | 'hood' | 'wheel';

export function evaluateVehicleDebrisDrop(
  damage: VehicleDamageState,
  impactForce: number,
  explodedNow: boolean
): VehicleDebrisPartKind[] {
  if (explodedNow) {
    return ['hood', 'door', 'bumper', 'wheel'];
  }
  if (impactForce < 7.5) return [];
  const parts: VehicleDebrisPartKind[] = [];
  if (damage.zones.front >= 1.5 || damage.zones.rear >= 1.5) parts.push('bumper');
  if (damage.zones.left >= 1.4 || damage.zones.right >= 1.4) parts.push('door');
  if (damage.integrity <= 42 && impactForce >= 10) parts.push('hood');
  if (damage.puncturedTires.some(Boolean) && impactForce >= 9) parts.push('wheel');
  return parts;
}

/* ==========================================================================
 * 4. 3D DOPPLER PITCH & ACOUSTIC ZONE REVERB
 * ========================================================================== */

export function computeDopplerPitchMultiplier(params: {
  sourceX: number;
  sourceY: number;
  sourceZ: number;
  sourceVx: number;
  sourceVy: number;
  sourceVz: number;
  listenerX: number;
  listenerY: number;
  listenerZ: number;
  listenerVx?: number;
  listenerVy?: number;
  listenerVz?: number;
  speedOfSound?: number;
}): number {
  const c = params.speedOfSound ?? 110; // Scaled game acoustic velocity for audible urban pass-bys
  const dx = params.listenerX - params.sourceX;
  const dy = params.listenerY - params.sourceY;
  const dz = params.listenerZ - params.sourceZ;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 0.1) return 1.0;

  const nx = dx / dist;
  const ny = dy / dist;
  const nz = dz / dist;

  // Radial velocity toward listener
  const vs = params.sourceVx * nx + params.sourceVy * ny + params.sourceVz * nz;
  const vl =
    (params.listenerVx ?? 0) * nx +
    (params.listenerVy ?? 0) * ny +
    (params.listenerVz ?? 0) * nz;

  const denom = Math.max(20, c - vs);
  const rawRatio = (c - vl) / denom;
  return Math.max(0.74, Math.min(1.36, Number(rawRatio.toFixed(4))));
}

export function resolveAcousticZone(params: {
  x: number;
  y: number;
  z: number;
  currentInterior: InteriorZoneId;
}): {
  zone: AcousticZoneId;
  reverbWet: number;
  reverbDecayMs: number;
} {
  if (params.currentInterior !== 'exterior') {
    return { zone: 'interior_room', reverbWet: 0.34, reverbDecayMs: 280 };
  }
  // Under Semanggi/JORR elevated tollway or MRT viaduct
  const underSemanggi =
    params.y < 5.5 &&
    ((Math.abs(params.x) < 16 && Math.abs(params.z) < 75) ||
      (Math.abs(params.z) < 16 && Math.abs(params.x) < 75) ||
      Math.hypot(params.x + 13.6, 0) < 4.5);
  if (underSemanggi && Math.abs(params.x + 13.6) < 4.2 && Math.abs(params.z) < 78) {
    return { zone: 'underpass_toll', reverbWet: 0.44, reverbDecayMs: 360 };
  }
  // Near elevated ring tollway deck while underneath
  const onPerimeterRing = Math.max(Math.abs(params.x), Math.abs(params.z));
  if (params.y < 5.2 && onPerimeterRing > 168 && onPerimeterRing < 194) {
    return { zone: 'underpass_toll', reverbWet: 0.42, reverbDecayMs: 340 };
  }
  if (params.z < -85 || (params.x > 48 && params.z < -38)) {
    return { zone: 'harbor_water', reverbWet: 0.18, reverbDecayMs: 190 };
  }
  return { zone: 'open_street', reverbWet: 0.08, reverbDecayMs: 120 };
}

/* ==========================================================================
 * 5. DYNAMIC AI LIVE RADIO JAKARTA DIRECTOR
 * ========================================================================== */

export function buildDynamicRadioBroadcast(params: {
  stationId: RadioStationId;
  wantedLevel: number;
  districtName: string;
  weatherMode: WeatherMode;
  activeHeistId: HeistId | null;
  lastOutcomeText?: string;
  stockShockSymbol?: string | null;
  tickSeed: number;
}): RadioBroadcastMessage | null {
  if (params.stationId === 'off') return null;

  const urgency: RadioBroadcastMessage['urgency'] =
    params.wantedLevel >= 3
      ? 'police_dispatch'
      : params.activeHeistId || params.stockShockSymbol
        ? 'breaking'
        : 'normal';

  let headline = 'LIVE JAKARTA FM';
  let djLine = `Lalu lintas ${params.districtName} terpantau ramai lancar, tetap waspada di persimpangan.`;

  if (params.wantedLevel >= 4) {
    headline = `SIAGA POLDA BINTANG ${params.wantedLevel} — ${params.districtName.toUpperCase()}`;
    djLine = `Breaking! Unit taktis Barracuda dan helikopter memburu buronan kelas kakap di sekitar ${params.districtName}! Warga diminta menjauh dari jalan protokol.`;
  } else if (params.wantedLevel >= 2) {
    headline = `KEJAR-KEJARAN DI ${params.districtName.toUpperCase()}`;
    djLine = `Laporan Patwal: pengejaran berkecepatan tinggi sedang berlangsung di ${params.districtName}. Manuver PIT disiagakan!`;
  } else if (params.stockShockSymbol) {
    headline = `BURSA BAJSA GONJANG-GANJING (${params.stockShockSymbol})`;
    djLine = `Analis SCBD panik! Saham ${params.stockShockSymbol} bergejolak tajam usai insiden sabotase jaringan di Jakarta.`;
  } else if (params.weatherMode === 'hujan') {
    headline = `PERINGATAN BANJIR & HYDROPLANING`;
    djLine = `Hujan deras mengguyur ${params.districtName}! Hati-hati genangan di Underpass Tanah Abang dan Kali Besar Kota Tua.`;
  } else if (params.stationId === 'koplo') {
    const lines = [
      'Tarikk sis, semongko! Malam ini Blok M dan Tanah Abang bergoyang bersama Koplo Pantura FM!',
      'Request dari abang ojol Kebon Kacang: hati-hati angkot ngetem mendadak di depan halte!',
    ];
    headline = 'KOPLO PANTURA 98.4 FM';
    djLine = lines[params.tickSeed % lines.length];
  } else if (params.stationId === 'synth_scbd') {
    headline = 'SCBD NIGHTDRIVE 101.2 FM';
    djLine = 'Neon refleksi gedung pencakar langit Sudirman-SCBD — sempurna untuk ngebut di Tol Layang Semanggi.';
  } else if (params.stationId === 'indie_senopati') {
    headline = 'INDIE SENOPATI 105.8 FM';
    djLine = 'Sruput kopi susu di Melawai sambil dengerin alunan senja Jakarta Selatan.';
  } else if (params.stationId === 'berita_kriminal') {
    headline = 'DISPATCH KRIMINAL JAKARTA';
    djLine = `Pantauan intelijen di ${params.districtName}: sindikat pelabuhan dan geng jalanan terdeteksi aktif.`;
  } else {
    headline = 'PRAMBORS JAKARTA 102.2 FM';
    djLine = `Selamat mengaspal Kawula Muda di ${params.districtName}! Jangan lupa mampir ke Warung Mba Yanti.`;
  }

  return {
    id: `rad_${params.stationId}_${params.tickSeed}`,
    stationId: params.stationId,
    headline,
    djLine,
    urgency,
    timestampMs: Date.now(),
  };
}

/* ==========================================================================
 * 6. CO-OP MULTI-SEAT PASSENGER & SHARED HEIST ROOM SYNC
 * ========================================================================== */

export function resolveCoopPassengerOffset(driver: {
  x: number;
  y: number;
  z: number;
  heading: number;
  vehicleType: VehicleType | null;
}): { x: number; y: number; z: number } {
  const lateral = driver.vehicleType === 'ojek' ? 0 : 0.85;
  const back = driver.vehicleType === 'ojek' ? -0.65 : 0.1;
  const rightX = Math.cos(driver.heading);
  const rightZ = -Math.sin(driver.heading);
  const fwdX = Math.sin(driver.heading);
  const fwdZ = Math.cos(driver.heading);

  return {
    x: driver.x + rightX * lateral + fwdX * back,
    y: driver.y + (driver.vehicleType === 'ojek' ? 0.65 : 0.45),
    z: driver.z + rightZ * lateral + fwdZ * back,
  };
}

export function reduceCoopHeistRoomState(
  current: CoopHeistSyncState,
  peers: readonly NetPeerSnapshot[],
  localPeerId: string,
  localProtagonist: ProtagonistId,
  localWanted: number,
  incoming?: Partial<CoopHeistSyncState>
): CoopHeistSyncState {
  const crewRoles: Record<string, ProtagonistId> = {
    [localPeerId]: localProtagonist,
  };
  let maxWanted = localWanted;
  for (const p of peers) {
    crewRoles[p.peerId] = p.protagonist;
    if (typeof p.wantedLevel === 'number' && p.wantedLevel > maxWanted) {
      maxWanted = p.wantedLevel;
    }
  }
  return {
    heistId: incoming?.heistId !== undefined ? incoming.heistId : current.heistId,
    stageLabel: incoming?.stageLabel ?? current.stageLabel,
    progressPct:
      incoming?.progressPct !== undefined
        ? Math.max(0, Math.min(100, incoming.progressPct))
        : current.progressPct,
    sharedWantedLevel:
      incoming?.sharedWantedLevel !== undefined
        ? Math.max(maxWanted, incoming.sharedWantedLevel)
        : maxWanted,
    crewRoles,
    updatedAtMs: Date.now(),
  };
}

/* ==========================================================================
 * 7. ELEVATED MRT "RATANGGA" RIDEABLE KINEMATICS & STATIONS
 * ========================================================================== */

export const MRT_TRACK_X = -13.6;
export const MRT_DECK_Y = 8.95;
export const MRT_ROOF_Y = 11.2;

export const MRT_STATIONS = [
  { id: 'mrt_sudirman', name: 'Stasiun MRT Dukuh Atas - Sudirman', x: -13.6, z: -68 },
  { id: 'mrt_blok_m', name: 'Stasiun MRT Blok M BCA', x: -13.6, z: 68 },
] as const;

export function computeMrtTrainState(elapsedTimeSec: number): {
  x: number;
  y: number;
  z: number;
  roofY: number;
  vz: number;
  halfLengthZ: number;
  halfWidthX: number;
} {
  const omega = 0.18;
  const amp = 68;
  const cycle = (elapsedTimeSec * omega) % (Math.PI * 2);
  const z = Math.sin(cycle) * amp;
  const vz = Math.cos(cycle) * amp * omega;

  return {
    x: MRT_TRACK_X,
    y: MRT_DECK_Y,
    z,
    roofY: MRT_ROOF_Y,
    vz,
    halfLengthZ: 10.2,
    halfWidthX: 1.25,
  };
}

export function isPlayerNearMrtStation(
  px: number,
  pz: number,
  radius: number = 6.5
): (typeof MRT_STATIONS)[number] | null {
  for (const st of MRT_STATIONS) {
    if (Math.hypot(px - st.x, pz - st.z) <= radius) {
      return st;
    }
  }
  return null;
}

import { applyCoverDamageMitigation } from '../../game/wave2Systems';
import type {
  EnemyBehaviorPolicy,
  WeaponAttachmentId,
  WeaponId,
} from '../../game/types';

export interface WeaponMagazineSpec {
  weaponId: WeaponId;
  magazineSize: number;
  reloadDurationSec: number;
  baseSpreadRad: number;
  recoilPerShotRad: number;
  maxSpreadRad: number;
  bloomRecoveryRate: number;
  headshotMultiplier: number;
}

export const WEAPON_MAGAZINE_SPECS: Record<WeaponId, WeaponMagazineSpec> = {
  fist: {
    weaponId: 'fist',
    magazineSize: 0, // Melee infinite
    reloadDurationSec: 0,
    baseSpreadRad: 0,
    recoilPerShotRad: 0,
    maxSpreadRad: 0,
    bloomRecoveryRate: 10,
    headshotMultiplier: 1.45,
  },
  golok: {
    weaponId: 'golok',
    magazineSize: 0, // Melee infinite
    reloadDurationSec: 0,
    baseSpreadRad: 0,
    recoilPerShotRad: 0,
    maxSpreadRad: 0,
    bloomRecoveryRate: 10,
    headshotMultiplier: 1.55,
  },
  pistol: {
    weaponId: 'pistol',
    magazineSize: 12,
    reloadDurationSec: 1.25,
    baseSpreadRad: 0.015,
    recoilPerShotRad: 0.014,
    maxSpreadRad: 0.085,
    bloomRecoveryRate: 4.8,
    headshotMultiplier: 1.85,
  },
  rifle: {
    weaponId: 'rifle',
    magazineSize: 30,
    reloadDurationSec: 1.65,
    baseSpreadRad: 0.022,
    recoilPerShotRad: 0.012,
    maxSpreadRad: 0.11,
    bloomRecoveryRate: 4.5,
    headshotMultiplier: 1.75,
  },
  mercon: {
    weaponId: 'mercon',
    magazineSize: 4,
    reloadDurationSec: 2.15,
    baseSpreadRad: 0.025,
    recoilPerShotRad: 0.04,
    maxSpreadRad: 0.1,
    bloomRecoveryRate: 3.2,
    headshotMultiplier: 1.35,
  },
  pasopati: {
    weaponId: 'pasopati',
    magazineSize: 20,
    reloadDurationSec: 1.55,
    baseSpreadRad: 0.008,
    recoilPerShotRad: 0.01,
    maxSpreadRad: 0.065,
    bloomRecoveryRate: 5.8,
    headshotMultiplier: 1.9,
  },
  gatotkaca: {
    weaponId: 'gatotkaca',
    magazineSize: 6,
    reloadDurationSec: 2.1,
    baseSpreadRad: 0.018,
    recoilPerShotRad: 0.035,
    maxSpreadRad: 0.095,
    bloomRecoveryRate: 4.0,
    headshotMultiplier: 1.65,
  },
};

export interface WeaponMagazineState {
  weaponId: WeaponId;
  currentInMag: number;
  maxMagCapacity: number;
  reloading: boolean;
  reloadTimerSec: number;
  reloadDurationSec: number;
  currentSpreadRad: number;
  recoilPitchKick: number;
}

export function getEffectiveMagazineCapacity(
  weaponId: WeaponId,
  attachments: WeaponAttachmentId[] = []
): number {
  const base = WEAPON_MAGAZINE_SPECS[weaponId]?.magazineSize ?? 0;
  if (base <= 0) return 0;
  const hasExtended = attachments.includes('extendedMag');
  return hasExtended ? Math.round(base * 1.5) : base;
}

export function createInitialMagazineMap(
  weaponAttachments?: Partial<Record<WeaponId, WeaponAttachmentId[]>>
): Record<WeaponId, WeaponMagazineState> {
  const ids: WeaponId[] = [
    'fist',
    'golok',
    'pistol',
    'rifle',
    'mercon',
    'pasopati',
    'gatotkaca',
  ];
  const map = {} as Record<WeaponId, WeaponMagazineState>;
  for (const id of ids) {
    const spec = WEAPON_MAGAZINE_SPECS[id];
    const cap = getEffectiveMagazineCapacity(id, weaponAttachments?.[id] ?? []);
    map[id] = {
      weaponId: id,
      currentInMag: cap,
      maxMagCapacity: cap,
      reloading: false,
      reloadTimerSec: 0,
      reloadDurationSec: spec.reloadDurationSec,
      currentSpreadRad: spec.baseSpreadRad,
      recoilPitchKick: 0,
    };
  }
  return map;
}

export function startWeaponReload(
  magState: WeaponMagazineState,
  totalReserveAmmo: number,
  attachments: WeaponAttachmentId[] = []
): WeaponMagazineState {
  const maxCap = getEffectiveMagazineCapacity(magState.weaponId, attachments);
  if (
    maxCap <= 0 ||
    magState.reloading ||
    magState.currentInMag >= maxCap ||
    totalReserveAmmo <= 0
  ) {
    return { ...magState, maxMagCapacity: maxCap };
  }
  const spec = WEAPON_MAGAZINE_SPECS[magState.weaponId];
  return {
    ...magState,
    maxMagCapacity: maxCap,
    reloading: true,
    reloadTimerSec: spec.reloadDurationSec,
    reloadDurationSec: spec.reloadDurationSec,
  };
}

export function stepWeaponMagazineAndReload(
  magState: WeaponMagazineState,
  totalReserveAmmo: number,
  dt: number,
  attachments: WeaponAttachmentId[] = []
): {
  nextMag: WeaponMagazineState;
  reloadCompleted: boolean;
} {
  const spec = WEAPON_MAGAZINE_SPECS[magState.weaponId];
  const maxCap = getEffectiveMagazineCapacity(magState.weaponId, attachments);
  const hasPrecisionBarrel = attachments.includes('precisionBarrel');
  const minSpread = spec.baseSpreadRad * (hasPrecisionBarrel ? 0.75 : 1.0);

  const clampedDt = Math.max(0, dt);
  const nextSpread = Math.max(
    minSpread,
    magState.currentSpreadRad - spec.bloomRecoveryRate * 0.04 * clampedDt
  );
  const nextRecoilKick = Math.max(0, magState.recoilPitchKick - 4.5 * clampedDt);

  if (!magState.reloading) {
    return {
      nextMag: {
        ...magState,
        maxMagCapacity: maxCap,
        currentSpreadRad: nextSpread,
        recoilPitchKick: nextRecoilKick,
      },
      reloadCompleted: false,
    };
  }

  const nextTimer = magState.reloadTimerSec - clampedDt;
  if (nextTimer <= 0) {
    const filled = Math.min(maxCap, Math.max(0, totalReserveAmmo));
    return {
      nextMag: {
        ...magState,
        maxMagCapacity: maxCap,
        currentInMag: filled,
        reloading: false,
        reloadTimerSec: 0,
        currentSpreadRad: minSpread,
        recoilPitchKick: 0,
      },
      reloadCompleted: true,
    };
  }

  return {
    nextMag: {
      ...magState,
      maxMagCapacity: maxCap,
      reloadTimerSec: nextTimer,
      currentSpreadRad: nextSpread,
      recoilPitchKick: nextRecoilKick,
    },
    reloadCompleted: false,
  };
}

export function consumeWeaponAmmoAndComputeSpread(
  magState: WeaponMagazineState,
  totalReserveAmmo: number,
  attachments: WeaponAttachmentId[] = []
): {
  canFire: boolean;
  autoReloadTriggered: boolean;
  shotSpreadRad: number;
  nextMag: WeaponMagazineState;
} {
  const spec = WEAPON_MAGAZINE_SPECS[magState.weaponId];
  const maxCap = getEffectiveMagazineCapacity(magState.weaponId, attachments);

  // Melee weapons always fire without magazine consumption
  if (maxCap <= 0) {
    return {
      canFire: true,
      autoReloadTriggered: false,
      shotSpreadRad: 0,
      nextMag: magState,
    };
  }

  if (magState.reloading) {
    return {
      canFire: false,
      autoReloadTriggered: false,
      shotSpreadRad: magState.currentSpreadRad,
      nextMag: magState,
    };
  }

  if (magState.currentInMag <= 0) {
    const reloaded = startWeaponReload(magState, totalReserveAmmo, attachments);
    return {
      canFire: false,
      autoReloadTriggered: reloaded.reloading,
      shotSpreadRad: magState.currentSpreadRad,
      nextMag: reloaded,
    };
  }

  const hasPrecision = attachments.includes('precisionBarrel');
  const recoilMult = hasPrecision ? 0.75 : 1.0;
  const shotSpreadRad = magState.currentSpreadRad;
  const remainingInMag = magState.currentInMag - 1;
  const remainingReserveAfterShot = Math.max(0, totalReserveAmmo - 1);

  let nextMag: WeaponMagazineState = {
    ...magState,
    maxMagCapacity: maxCap,
    currentInMag: remainingInMag,
    currentSpreadRad: Math.min(
      spec.maxSpreadRad,
      magState.currentSpreadRad + spec.recoilPerShotRad * recoilMult
    ),
    recoilPitchKick: Math.min(0.24, magState.recoilPitchKick + 0.045 * recoilMult),
  };

  let autoReloadTriggered = false;
  if (remainingInMag <= 0 && remainingReserveAfterShot > 0) {
    nextMag = startWeaponReload(nextMag, remainingReserveAfterShot, attachments);
    autoReloadTriggered = nextMag.reloading;
  }

  return {
    canFire: true,
    autoReloadTriggered,
    shotSpreadRad,
    nextMag,
  };
}

/* ==========================================================================
 * 2. HEADSHOT / WEAKSPOT CRITICAL HIT & RANGE FALLOFF EVALUATOR
 * ========================================================================== */

export interface BallisticHitEvaluation {
  finalDamage: number;
  isHeadshot: boolean;
  isCritical: boolean;
  falloffMultiplier: number;
  staggerSec: number;
}

/**
 * Computes weapon hit damage incorporating distance falloff, headshot/weakspot alignment,
 * Aim Precision skill crit chance, and cover mitigation.
 */
export function evaluateBallisticHitDamage(params: {
  weaponId: WeaponId;
  baseDamage: number;
  distanceM: number;
  maxRangeM: number;
  aimAlignmentDot: number;
  tpsAiming: boolean;
  aimPrecisionLevel: number;
  targetInCover?: boolean;
  deterministicRoll?: number;
}): BallisticHitEvaluation {
  const spec = WEAPON_MAGAZINE_SPECS[params.weaponId];
  const distRatio = Math.max(0, params.distanceM / Math.max(1, params.maxRangeM));
  // Smooth falloff beyond 65% of max weapon range
  const falloffMultiplier =
    distRatio <= 0.65
      ? 1.0
      : Math.max(0.45, 1.0 - (distRatio - 0.65) * 1.15);

  // Headshot triggers when aiming accurately near center reticle (dot >= 0.982 in TPS or >= 0.992 hipfire)
  const headshotThreshold = params.tpsAiming ? 0.982 : 0.992;
  const isHeadshot =
    params.weaponId !== 'mercon' &&
    params.weaponId !== 'gatotkaca' &&
    params.aimAlignmentDot >= headshotThreshold &&
    distRatio <= 0.92;

  const skillBonusPct = Math.max(0, params.aimPrecisionLevel - 1) * 0.06;
  const critChance = 0.08 + Math.max(0, params.aimPrecisionLevel - 1) * 0.04;
  const roll = params.deterministicRoll ?? 0.5;
  const isCritical = isHeadshot || roll < critChance;

  const critMult = isHeadshot
    ? spec.headshotMultiplier
    : isCritical
      ? 1.35
      : 1.0;

  let rawDamage =
    params.baseDamage * (1 + skillBonusPct) * falloffMultiplier * critMult;
  if (params.targetInCover) {
    rawDamage = applyCoverDamageMitigation(rawDamage, true);
  }

  const finalDamage = Math.max(1, Math.round(rawDamage));
  const staggerSec = isHeadshot ? 0.65 : isCritical ? 0.42 : 0.24;

  return {
    finalDamage,
    isHeadshot,
    isCritical,
    falloffMultiplier: Number(falloffMultiplier.toFixed(3)),
    staggerSec,
  };
}

/* ==========================================================================
 * 3. 3-HIT MELEE COMBO & TACTICAL DODGE ROLL STATE MACHINE
 * ========================================================================== */

export interface MeleeComboState {
  stage: 0 | 1 | 2 | 3;
  comboWindowSec: number;
  lastStrikeLabel: string;
}

export function createInitialMeleeComboState(): MeleeComboState {
  return {
    stage: 0,
    comboWindowSec: 0,
    lastStrikeLabel: '',
  };
}

export interface MeleeStrikeResolution {
  nextCombo: MeleeComboState;
  stageExecuted: 1 | 2 | 3;
  damageMultiplier: number;
  knockbackImpulse: number;
  staggerDurationSec: number;
  strikeLabel: string;
  isFinisher: boolean;
}

/**
 * Advances the 3-hit pencak silat / street brawl melee combo chain:
 * Stage 1: Sabetan Cepat (1.0x) -> Stage 2: Tebasan Silang (1.28x) -> Stage 3: Hantaman Jawara (1.75x + heavy knockback).
 */
export function advanceMeleeComboStep(
  state: MeleeComboState
): MeleeStrikeResolution {
  const nextStage: 1 | 2 | 3 =
    state.comboWindowSec > 0 && state.stage >= 1 && state.stage < 3
      ? ((state.stage + 1) as 2 | 3)
      : 1;

  const specs: Record<
    1 | 2 | 3,
    {
      mult: number;
      knockback: number;
      stagger: number;
      label: string;
      finisher: boolean;
    }
  > = {
    1: {
      mult: 1.0,
      knockback: 1.8,
      stagger: 0.32,
      label: 'Sabetan Cepat',
      finisher: false,
    },
    2: {
      mult: 1.28,
      knockback: 2.9,
      stagger: 0.48,
      label: 'Tebasan Silang',
      finisher: false,
    },
    3: {
      mult: 1.75,
      knockback: 5.4,
      stagger: 0.85,
      label: 'Hantaman Jawara!',
      finisher: true,
    },
  };

  const s = specs[nextStage];
  return {
    nextCombo: {
      stage: nextStage,
      comboWindowSec: 0.95,
      lastStrikeLabel: s.label,
    },
    stageExecuted: nextStage,
    damageMultiplier: s.mult,
    knockbackImpulse: s.knockback,
    staggerDurationSec: s.stagger,
    strikeLabel: s.label,
    isFinisher: s.finisher,
  };
}

export function stepMeleeComboDecay(
  state: MeleeComboState,
  dt: number
): MeleeComboState {
  if (state.comboWindowSec <= 0) {
    return state.stage === 0
      ? state
      : { stage: 0, comboWindowSec: 0, lastStrikeLabel: '' };
  }
  const nextWindow = Math.max(0, state.comboWindowSec - Math.max(0, dt));
  if (nextWindow <= 0) {
    return { stage: 0, comboWindowSec: 0, lastStrikeLabel: '' };
  }
  return {
    ...state,
    comboWindowSec: nextWindow,
  };
}

export interface DodgeRollState {
  active: boolean;
  timerSec: number;
  iFrameSec: number;
  cooldownSec: number;
  dirX: number;
  dirZ: number;
  dashSpeed: number;
}

export function createInitialDodgeRollState(): DodgeRollState {
  return {
    active: false,
    timerSec: 0,
    iFrameSec: 0,
    cooldownSec: 0,
    dirX: 0,
    dirZ: 1,
    dashSpeed: 13.5,
  };
}

export function triggerTacticalDodgeRoll(
  state: DodgeRollState,
  moveDirX: number,
  moveDirZ: number,
  facingAngle: number
): { nextState: DodgeRollState; triggered: boolean } {
  if (state.active || state.cooldownSec > 0) {
    return { nextState: state, triggered: false };
  }
  const len = Math.hypot(moveDirX, moveDirZ);
  const dirX = len > 0.05 ? moveDirX / len : Math.sin(facingAngle);
  const dirZ = len > 0.05 ? moveDirZ / len : Math.cos(facingAngle);

  return {
    nextState: {
      active: true,
      timerSec: 0.46,
      iFrameSec: 0.34,
      cooldownSec: 1.05,
      dirX,
      dirZ,
      dashSpeed: 13.8,
    },
    triggered: true,
  };
}

export function stepTacticalDodgeRoll(
  state: DodgeRollState,
  dt: number
): {
  nextState: DodgeRollState;
  hasActiveIFrames: boolean;
  dx: number;
  dz: number;
} {
  const clampedDt = Math.max(0, dt);
  const nextCooldown = Math.max(0, state.cooldownSec - clampedDt);

  if (!state.active) {
    return {
      nextState: { ...state, cooldownSec: nextCooldown },
      hasActiveIFrames: false,
      dx: 0,
      dz: 0,
    };
  }

  const nextTimer = Math.max(0, state.timerSec - clampedDt);
  const nextIFrame = Math.max(0, state.iFrameSec - clampedDt);
  const speedDecay = 0.65 + 0.35 * (nextTimer / 0.46);
  const stepDist = state.dashSpeed * speedDecay * clampedDt;

  return {
    nextState: {
      ...state,
      active: nextTimer > 0,
      timerSec: nextTimer,
      iFrameSec: nextIFrame,
      cooldownSec: nextCooldown,
    },
    hasActiveIFrames: nextIFrame > 0,
    dx: state.dirX * stepDist,
    dz: state.dirZ * stepDist,
  };
}

/* ==========================================================================
 * 4. TACTICAL ENEMY AI POLICY EVALUATOR
 * ========================================================================== */

export interface TacticalEnemyDecision {
  moveVx: number;
  moveVz: number;
  shouldFireOrStrike: boolean;
  flankingActive: boolean;
  suppressionBurst: boolean;
}

/**
 * Computes tactical enemy movement and attack decisions with flanking strafe vectors
 * when the player is hiding in cover, suppression bursts for ranged shooters, and zig-zag rush approaches.
 */
export function evaluateTacticalEnemyAction(params: {
  policy: EnemyBehaviorPolicy;
  enemyX: number;
  enemyZ: number;
  playerX: number;
  playerZ: number;
  playerInCover: boolean;
  moveSpeed: number;
  preferredRange: number;
  phaseTimer: number;
  enemyIndex: number;
}): TacticalEnemyDecision {
  const dx = params.playerX - params.enemyX;
  const dz = params.playerZ - params.enemyZ;
  const dist = Math.hypot(dx, dz) || 0.001;
  const nx = dx / dist;
  const nz = dz / dist;
  // Perpendicular lateral vector
  const px = -nz;
  const pz = nx;
  const sideSign = params.enemyIndex % 2 === 0 ? 1 : -1;

  if (params.policy === 'rusher') {
    // Zig-zag aggressive rush toward player; wider flank arc if player is in cover
    const zig = Math.sin(params.phaseTimer * 3.8 + params.enemyIndex) * (params.playerInCover ? 0.62 : 0.35);
    const vx = (nx + px * zig * sideSign) * params.moveSpeed;
    const vz = (nz + pz * zig * sideSign) * params.moveSpeed;
    return {
      moveVx: vx,
      moveVz: vz,
      shouldFireOrStrike: dist <= params.preferredRange + 0.6,
      flankingActive: params.playerInCover,
      suppressionBurst: false,
    };
  }

  if (params.policy === 'charger_enforcer') {
    // Orbits laterally to break player cover angles before charging into heavy strike range
    const radialFactor =
      dist > params.preferredRange * 1.15
        ? 0.68
        : dist < params.preferredRange * 0.7
          ? -0.45
          : 0.15;
    const lateralFactor = params.playerInCover ? 0.92 : 0.65;
    const vx = (nx * radialFactor + px * lateralFactor * sideSign) * params.moveSpeed;
    const vz = (nz * radialFactor + pz * lateralFactor * sideSign) * params.moveSpeed;
    return {
      moveVx: vx,
      moveVz: vz,
      shouldFireOrStrike: dist <= params.preferredRange * 1.35,
      flankingActive: true,
      suppressionBurst: false,
    };
  }

  // Ranged / Suppressor policy: holds optimal standoff distance and unleashes suppression fire when player is in cover
  const standoffDelta = dist - params.preferredRange;
  const radialSpeed =
    Math.abs(standoffDelta) < 2.2
      ? 0
      : Math.sign(standoffDelta) * params.moveSpeed * 0.72;
  const strafeSpeed =
    Math.sin(params.phaseTimer * 1.8 + params.enemyIndex) * params.moveSpeed * 0.42;

  return {
    moveVx: nx * radialSpeed + px * strafeSpeed,
    moveVz: nz * radialSpeed + pz * strafeSpeed,
    shouldFireOrStrike: dist <= params.preferredRange * 1.45,
    flankingActive: false,
    suppressionBurst: params.playerInCover && dist <= params.preferredRange * 1.45,
  };
}

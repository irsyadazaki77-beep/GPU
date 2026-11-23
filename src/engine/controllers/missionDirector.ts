import type { DistrictId, HeistId, ProtagonistId } from '../../game/types';

export type MissionLifecyclePhase =
  | 'idle'
  | 'briefing'
  | 'active'
  | 'getaway'
  | 'completed'
  | 'failed';

export interface MissionLifecycleState {
  phase: MissionLifecyclePhase;
  missionId: string | null;
  choiceId: string | null;
  heistId: HeistId | null;
  originX: number;
  originZ: number;
  getawayRequiredRadiusM: number;
  getawayProgressPct: number;
  elapsedPhaseSec: number;
  spawnedEntityIds: string[];
}

export function createInitialMissionLifecycleState(): MissionLifecycleState {
  return {
    phase: 'idle',
    missionId: null,
    choiceId: null,
    heistId: null,
    originX: 0,
    originZ: 0,
    getawayRequiredRadiusM: 65,
    getawayProgressPct: 0,
    elapsedPhaseSec: 0,
    spawnedEntityIds: [],
  };
}

/**
 * Transitions the mission/heist lifecycle state machine deterministically and returns
 * any entity IDs that must be cleaned up when leaving an active/getaway phase.
 */
export function transitionMissionPhase(
  current: MissionLifecycleState,
  nextPhase: MissionLifecyclePhase,
  context?: {
    missionId?: string | null;
    choiceId?: string | null;
    heistId?: HeistId | null;
    originX?: number;
    originZ?: number;
    getawayRequiredRadiusM?: number;
    spawnedEntityIds?: string[];
  }
): {
  nextState: MissionLifecycleState;
  entitiesToCleanup: string[];
} {
  const isTerminalOrReset =
    nextPhase === 'idle' ||
    nextPhase === 'completed' ||
    nextPhase === 'failed';

  const entitiesToCleanup = isTerminalOrReset
    ? [...current.spawnedEntityIds]
    : [];

  return {
    nextState: {
      phase: nextPhase,
      missionId:
        context?.missionId !== undefined
          ? context.missionId
          : isTerminalOrReset
            ? null
            : current.missionId,
      choiceId:
        context?.choiceId !== undefined
          ? context.choiceId
          : isTerminalOrReset
            ? null
            : current.choiceId,
      heistId:
        context?.heistId !== undefined
          ? context.heistId
          : isTerminalOrReset
            ? null
            : current.heistId,
      originX: context?.originX ?? current.originX,
      originZ: context?.originZ ?? current.originZ,
      getawayRequiredRadiusM:
        context?.getawayRequiredRadiusM ?? current.getawayRequiredRadiusM,
      getawayProgressPct: nextPhase === 'completed' ? 100 : 0,
      elapsedPhaseSec: 0,
      spawnedEntityIds: isTerminalOrReset
        ? []
        : context?.spawnedEntityIds ?? current.spawnedEntityIds,
    },
    entitiesToCleanup,
  };
}

/**
 * Evaluates Heist Getaway escape progress after breaching a vault.
 * Player must either escape outside the getaway perimeter radius or drop Wanted level to 0.
 */
export function evaluateHeistGetawayProgress(
  state: MissionLifecycleState,
  playerX: number,
  playerZ: number,
  wantedLevel: number,
  dt: number
): {
  nextState: MissionLifecycleState;
  escaped: boolean;
  distanceFromVaultM: number;
} {
  if (state.phase !== 'getaway') {
    return {
      nextState: state,
      escaped: false,
      distanceFromVaultM: 0,
    };
  }

  const dist = Math.hypot(playerX - state.originX, playerZ - state.originZ);
  const reqRadius = Math.max(25, state.getawayRequiredRadiusM);
  const distanceRatio = Math.min(100, Math.round((dist / reqRadius) * 100));

  if (dist >= reqRadius || wantedLevel === 0) {
    const transitioned = transitionMissionPhase(state, 'completed');
    return {
      nextState: transitioned.nextState,
      escaped: true,
      distanceFromVaultM: dist,
    };
  }

  return {
    nextState: {
      ...state,
      getawayProgressPct: distanceRatio,
      elapsedPhaseSec: state.elapsedPhaseSec + Math.max(0, dt),
    },
    escaped: false,
    distanceFromVaultM: dist,
  };
}

/* ==========================================================================
 * 2. DYNAMIC JAKARTA OPEN-WORLD STREET ENCOUNTERS
 * ========================================================================== */

export type DynamicEncounterKind =
  | 'konvoi_brankas'
  | 'begal_malam'
  | 'balap_dadakan'
  | 'kurir_darurat';

export interface DynamicStreetEncounterSpec {
  id: string;
  kind: DynamicEncounterKind;
  title: string;
  subtitle: string;
  districtId: DistrictId;
  x: number;
  z: number;
  triggerRadiusM: number;
  durationSec: number;
  rewardRp: number;
  repBonus: {
    faction: 'jalanan' | 'sindikat' | 'rakyat';
    delta: number;
  };
  recommendedProtagonist: ProtagonistId;
}

export const DYNAMIC_ENCOUNTER_CATALOG: DynamicStreetEncounterSpec[] = [
  {
    id: 'enc_konvoi_scbd',
    kind: 'konvoi_brankas',
    title: 'Intersepsi Konvoi Brankas Sindikat',
    subtitle: 'Lumpuhkan pengawal rantis sindikat di koridor SCBD sebelum mencapai tol.',
    districtId: 'scbd',
    x: 34,
    z: 52,
    triggerRadiusM: 18,
    durationSec: 75,
    rewardRp: 240000,
    repBonus: { faction: 'jalanan', delta: 8 },
    recommendedProtagonist: 'nabilo',
  },
  {
    id: 'enc_kurir_tanah_abang',
    kind: 'kurir_darurat',
    title: 'Penyelamatan Kurir Ojol Tanah Abang',
    subtitle: 'Halau preman pemalak yang menghadang armada kurir logistik warga.',
    districtId: 'tanah_abang',
    x: -38,
    z: -12,
    triggerRadiusM: 16,
    durationSec: 60,
    rewardRp: 155000,
    repBonus: { faction: 'rakyat', delta: 10 },
    recommendedProtagonist: 'raka',
  },
  {
    id: 'enc_siber_glodok',
    kind: 'begal_malam',
    title: 'Sabotase Node Siber Glodok',
    subtitle: 'Retas terminal relay gelap sebelum data transaksi BAJSA terenkripsi.',
    districtId: 'kota_tua',
    x: 22,
    z: -38,
    triggerRadiusM: 16,
    durationSec: 65,
    rewardRp: 195000,
    repBonus: { faction: 'sindikat', delta: 9 },
    recommendedProtagonist: 'kirana',
  },
  {
    id: 'enc_balap_semanggi',
    kind: 'balap_dadakan',
    title: 'Tantangan Sprint Tol Semanggi',
    subtitle: 'Kalahkan pembalap liar malam di lintasan lurus Simpang Semanggi.',
    districtId: 'blok_m',
    x: 0,
    z: 76,
    triggerRadiusM: 20,
    durationSec: 55,
    rewardRp: 180000,
    repBonus: { faction: 'jalanan', delta: 7 },
    recommendedProtagonist: 'raka',
  },
];

export interface ActiveDynamicEncounter {
  spec: DynamicStreetEncounterSpec;
  remainingSec: number;
  engaged: boolean;
  progressPct: number;
  completed: boolean;
}

export function spawnDynamicStreetEncounter(
  playerX: number,
  playerZ: number,
  completedIds: string[] = []
): ActiveDynamicEncounter | null {
  let bestSpec: DynamicStreetEncounterSpec | null = null;
  let bestDist = Infinity;

  for (const spec of DYNAMIC_ENCOUNTER_CATALOG) {
    if (completedIds.includes(spec.id)) continue;
    const dist = Math.hypot(playerX - spec.x, playerZ - spec.z);
    if (dist <= 95 && dist < bestDist) {
      bestDist = dist;
      bestSpec = spec;
    }
  }

  if (!bestSpec) return null;

  return {
    spec: bestSpec,
    remainingSec: bestSpec.durationSec,
    engaged: bestDist <= bestSpec.triggerRadiusM,
    progressPct: 0,
    completed: false,
  };
}

export function stepDynamicStreetEncounter(
  encounter: ActiveDynamicEncounter,
  playerX: number,
  playerZ: number,
  activeProtagonist: ProtagonistId,
  dt: number
): {
  nextEncounter: ActiveDynamicEncounter | null;
  justCompleted: boolean;
  expired: boolean;
  rewardRp: number;
} {
  const clampedDt = Math.max(0, dt);
  const dist = Math.hypot(
    playerX - encounter.spec.x,
    playerZ - encounter.spec.z
  );
  const inZone = dist <= encounter.spec.triggerRadiusM;
  const engaged = encounter.engaged || inZone;

  const nextRemaining = encounter.remainingSec - clampedDt;
  if (nextRemaining <= 0 && !encounter.completed) {
    return {
      nextEncounter: null,
      justCompleted: false,
      expired: true,
      rewardRp: 0,
    };
  }

  const protagonistSynergy =
    activeProtagonist === encounter.spec.recommendedProtagonist ? 1.35 : 1.0;
  const progressGain = inZone ? clampedDt * 24 * protagonistSynergy : 0;
  const nextProgress = Math.min(100, encounter.progressPct + progressGain);

  if (nextProgress >= 100) {
    const reward = Math.round(
      encounter.spec.rewardRp * (protagonistSynergy > 1 ? 1.15 : 1.0)
    );
    return {
      nextEncounter: {
        ...encounter,
        engaged: true,
        progressPct: 100,
        completed: true,
      },
      justCompleted: true,
      expired: false,
      rewardRp: reward,
    };
  }

  return {
    nextEncounter: {
      ...encounter,
      remainingSec: nextRemaining,
      engaged,
      progressPct: nextProgress,
    },
    justCompleted: false,
    expired: false,
    rewardRp: 0,
  };
}

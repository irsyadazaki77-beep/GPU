import type {
  FactionId,
  StoryChoiceOption,
  StoryMission,
} from './types';
import { resolveCircleAABBCollision } from './world/spatial';

export type MissionStageType = 'travel' | 'combat' | 'escape' | 'interact';

export interface MissionStageSpec {
  stageIndex: number;
  stageName: string;
  instruction: string;
  type: MissionStageType;
  targetX: number;
  targetZ: number;
  targetCount: number;
  dialogueCue?: string;
}

export interface ActiveQuestState {
  missionId: string;
  missionTitle: string;
  chapterNumber: number;
  giverName: string;
  faction: FactionId;
  stages: MissionStageSpec[];
  currentStageIndex: number;
  stageProgress: number;
  isCompleted: boolean;
  outcomeNarrative: string;
  rewardRp: number;
}

/**
 * Builds a structured, cinematic GTA-style multi-stage sequence for any story mission choice.
 * Splits a flat objective into 2 or 3 distinct stages:
 * - Stage 1: Infiltrasi / Titik Temu (Travel to target zone)
 * - Stage 2: Eksekusi Utama (Combat, hacking, or checkpoint race)
 * - Stage 3: Pelarian / Evade Police & Dropoff (if wanted level > 0 or getaway required)
 */
export function buildMissionStages(
  mission: StoryMission,
  choice: StoryChoiceOption
): MissionStageSpec[] {
  const stages: MissionStageSpec[] = [];

  // Stage 1: Approach / Infiltrate the designated area (resolved clear of solid buildings)
  const rawApproachX = Math.round((choice.targetX + mission.markerX) * 0.5);
  const rawApproachZ = Math.round((choice.targetZ + mission.markerZ) * 0.5);
  const safeApproach = resolveCircleAABBCollision(rawApproachX, rawApproachZ, 2.5);
  const approachX = Math.round(safeApproach.x);
  const approachZ = Math.round(safeApproach.z);

  stages.push({
    stageIndex: 0,
    stageName: 'Tahap 1: Infiltrasi Lokasi',
    instruction: `Menuju ke area ${mission.locationName} untuk memulai operasi`,
    type: 'travel',
    targetX: approachX,
    targetZ: approachZ,
    targetCount: 1,
    dialogueCue: `Ambil kendaraan dan segera dekati perimeter ${mission.locationName}.`,
  });

  // Stage 2: Primary Objective
  if (choice.objectiveType === 'combat_wave') {
    stages.push({
      stageIndex: 1,
      stageName: 'Tahap 2: Kontak Tempur',
      instruction: `Lumpuhkan ${choice.objectiveTargetCount} pengawal lawan di area sasaran`,
      type: 'combat',
      targetX: choice.targetX,
      targetZ: choice.targetZ,
      targetCount: choice.objectiveTargetCount,
      dialogueCue: 'Sasaran terlihat! Bersihkan semua pengawal bersenjata di lokasi!',
    });
  } else if (choice.objectiveType === 'checkpoint_drive') {
    stages.push({
      stageIndex: 1,
      stageName: 'Tahap 2: Pacu Rute Protokol',
      instruction: `Lintasi ${choice.objectiveTargetCount} titik koordinat transmisi tanpa tertangkap`,
      type: 'travel',
      targetX: choice.targetX,
      targetZ: choice.targetZ,
      targetCount: choice.objectiveTargetCount,
      dialogueCue: 'Waktu berjalan! Lewati setiap titik navigasi dengan kecepatan penuh!',
    });
  } else {
    stages.push({
      stageIndex: 1,
      stageName: 'Tahap 2: Jebol Brankas',
      instruction: 'Infiltrasi brankas utama dan amankan barang bukti',
      type: 'combat',
      targetX: choice.targetX,
      targetZ: choice.targetZ,
      targetCount: choice.objectiveTargetCount,
      dialogueCue: 'Pintu brankas terbuka! Amankan muatan secepatnya!',
    });
  }

  // Stage 3: Escape / Evade Pursuit
  if (choice.wantedDelta > 0 || choice.objectiveType === 'heist_escape') {
    stages.push({
      stageIndex: 2,
      stageName: 'Tahap 3: Lepaskan Kejaran Polisi',
      instruction: 'Kabur dari radius patroli aparat dan hilangkan bintang buronan',
      type: 'escape',
      targetX: mission.markerX,
      targetZ: mission.markerZ,
      targetCount: 1,
      dialogueCue: 'Sirene polisi mendekat! Masuki gang sempit atau kolong tol untuk melepas kejaran!',
    });
  }

  return stages;
}

/**
 * Creates initial ActiveQuestState when accepting a mission.
 */
export function createActiveQuestState(
  mission: StoryMission,
  choice: StoryChoiceOption
): ActiveQuestState {
  const stages = buildMissionStages(mission, choice);
  return {
    missionId: mission.id,
    missionTitle: mission.title,
    chapterNumber: mission.chapterNumber,
    giverName: mission.giverName,
    faction: choice.faction,
    stages,
    currentStageIndex: 0,
    stageProgress: 0,
    isCompleted: false,
    outcomeNarrative: choice.outcomeNarrative,
    rewardRp: choice.rewardRp,
  };
}

/**
 * Evaluates whether player position or actions advance the current quest stage.
 */
export function stepQuestStageProgress(
  quest: ActiveQuestState,
  playerX: number,
  playerZ: number,
  wantedLevel: number,
  additionalProgress: number = 0
): {
  nextQuest: ActiveQuestState;
  advancedStage: boolean;
  missionJustCompleted: boolean;
} {
  if (quest.isCompleted || quest.currentStageIndex >= quest.stages.length) {
    return { nextQuest: quest, advancedStage: false, missionJustCompleted: false };
  }

  const currentStage = quest.stages[quest.currentStageIndex];
  let newProgress = quest.stageProgress + additionalProgress;
  let stageDone = false;

  if (currentStage.type === 'travel') {
    const dist = Math.hypot(playerX - currentStage.targetX, playerZ - currentStage.targetZ);
    if (dist < 8.5) {
      newProgress = Math.max(newProgress, 1);
      stageDone = true;
    }
  } else if (currentStage.type === 'combat') {
    if (newProgress >= currentStage.targetCount) {
      stageDone = true;
    }
  } else if (currentStage.type === 'escape') {
    if (wantedLevel <= 0) {
      stageDone = true;
      newProgress = 1;
    }
  }

  if (stageDone) {
    const nextIdx = quest.currentStageIndex + 1;
    const isCompleted = nextIdx >= quest.stages.length;
    return {
      nextQuest: {
        ...quest,
        currentStageIndex: nextIdx,
        stageProgress: 0,
        isCompleted,
      },
      advancedStage: true,
      missionJustCompleted: isCompleted,
    };
  }

  return {
    nextQuest: {
      ...quest,
      stageProgress: newProgress,
    },
    advancedStage: false,
    missionJustCompleted: false,
  };
}

/**
 * Determines whether ambient HUD distractions (detours, UGC race invites, random passengers)
 * should be suppressed to keep the player focused during intense story missions.
 */
export function shouldSuppressWorldClutter(hasActiveMission: boolean): boolean {
  return hasActiveMission;
}

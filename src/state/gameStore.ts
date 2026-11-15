import { useSyncExternalStore } from 'react';
import {
  AudioChannelVolumes,
  DistrictZone,
  EnterableInteriorSpec,
  GameState,
  JAKARTA_DISTRICTS,
  NpcDynamicSideQuest,
  OriginArchetype,
  PlayerProgressState,
  ProtagonistId,
  STORY_MISSIONS,
  StoryChoiceOption,
  StoryMission,
  VehicleType,
  WeaponId,
  WeatherMode,
  createInitialPlayerState,
} from '../game/rules';
import {
  DEFAULT_AUDIO_VOLUMES,
  SavedGameSnapshot,
  loadSavedGame,
} from '../game/save';
import { soundEngine } from '../game/sound';

export interface RadarVehicleBlip {
  id: string;
  type: VehicleType;
  x: number;
  z: number;
  heading: number;
}

export interface RadarEnemyBlip {
  x: number;
  z: number;
  alive: boolean;
}

export interface EngineTelemetrySnapshot {
  playerX: number;
  playerY: number;
  playerZ: number;
  playerFacing: number;
  drivingVehicleId: string | null;
  vehicles: RadarVehicleBlip[];
  enemies: RadarEnemyBlip[];
  nearbyMission: StoryMission | null;
  activeChoice: StoryChoiceOption | null;
}

/**
 * Mutable 60fps engine ref read directly by Three.js loops and MiniMapRadar
 * without triggering React reconciliations or frame drops.
 */
export const engineTelemetryRef: EngineTelemetrySnapshot = {
  playerX: 0,
  playerY: 0,
  playerZ: 26,
  playerFacing: Math.PI,
  drivingVehicleId: null,
  vehicles: [],
  enemies: [],
  nearbyMission: STORY_MISSIONS[12],
  activeChoice: null,
};

export interface SkySwitchPhaseState {
  active: boolean;
  stage: 1 | 2 | 3;
  targetId: ProtagonistId;
}

export interface GameStoreSnapshot {
  gameState: GameState;
  origin: OriginArchetype;
  selectedStage: 1 | 2 | 3 | 4 | 5;
  weatherMode: WeatherMode;
  outcomeMode: 'victory' | 'defeat';
  playerState: PlayerProgressState;
  ghostHp: number;
  endSnapshot: PlayerProgressState;
  district: DistrictZone;
  drivingVehicle: VehicleType | null;
  vehicleSpeedKmh: number;
  aircraftAltitude: number;
  nearbyVehicle: VehicleType | null;
  nearbyMission: StoryMission | null;
  nearbyInterior: EnterableInteriorSpec | null;
  objectiveProgress: number;
  skySwitchPhase: SkySwitchPhaseState | null;
  dialogueMission: StoryMission | null;
  activeMission: StoryMission | null;
  activeChoice: StoryChoiceOption | null;
  lastOutcomeText: string | null;
  phoneOpen: boolean;
  wheelMode: 'weapon' | 'character' | null;
  heistBoardOpen: boolean;
  customsGarageOpen: boolean;
  warungModalOpen: boolean;
  tpsAiming: boolean;
  muted: boolean;
  audioVolumes: AudioChannelVolumes;
  ambientCycleStep: number;
  savedGame: SavedGameSnapshot | null;
  completedDynamicQuests: string[];
}

export function buildInitialStateForStage(
  chosenOrigin: OriginArchetype,
  stage: 1 | 2 | 3 | 4 | 5
): PlayerProgressState {
  const base = createInitialPlayerState(chosenOrigin);
  if (stage === 2) {
    return {
      ...base,
      rupiah: base.rupiah + 250000,
      unlockedWeapons: Array.from(
        new Set<WeaponId>([...base.unlockedWeapons, 'pistol', 'mercon'])
      ),
      completedMissions: STORY_MISSIONS.slice(0, 3).map((m) => m.id),
    };
  }
  if (stage === 3) {
    return {
      ...base,
      rupiah: base.rupiah + 500000,
      crewCount: Math.max(1, base.crewCount),
      unlockedWeapons: Array.from(
        new Set<WeaponId>([
          ...base.unlockedWeapons,
          'pistol',
          'mercon',
          'pasopati',
        ])
      ),
      completedMissions: STORY_MISSIONS.slice(0, 6).map((m) => m.id),
    };
  }
  if (stage === 4) {
    return {
      ...base,
      rupiah: base.rupiah + 750000,
      crewCount: Math.max(1, base.crewCount),
      vehicleUpgradeLevel: 1,
      unlockedWeapons: Array.from(
        new Set<WeaponId>([
          ...base.unlockedWeapons,
          'pistol',
          'rifle',
          'mercon',
          'pasopati',
        ])
      ),
      completedMissions: STORY_MISSIONS.slice(0, 9).map((m) => m.id),
    };
  }
  if (stage === 5) {
    return {
      ...base,
      rupiah: base.rupiah + 1200000,
      crewCount: Math.max(2, base.crewCount),
      vehicleUpgradeLevel: 2,
      droneLevel: Math.max(2, base.droneLevel),
      droneActive: true,
      unlockedWeapons: Array.from(
        new Set<WeaponId>([
          ...base.unlockedWeapons,
          'pistol',
          'rifle',
          'mercon',
          'pasopati',
          'gatotkaca',
        ])
      ),
      completedMissions: STORY_MISSIONS.slice(0, 12).map((m) => m.id),
    };
  }
  return base;
}

const isAutostart =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('autostart') === '1';

const initialPlayer = buildInitialStateForStage('anak_jalanan', 5);
const initialSave = loadSavedGame();
if (initialSave?.audioSettings) {
  soundEngine.setChannelVolumes(initialSave.audioSettings);
}

let state: GameStoreSnapshot = {
  gameState: isAutostart ? 'playing' : 'title',
  origin: 'anak_jalanan',
  selectedStage: 5,
  weatherMode: 'senja',
  outcomeMode: 'victory',
  playerState: initialPlayer,
  ghostHp: initialPlayer.hp,
  endSnapshot: initialPlayer,
  district: JAKARTA_DISTRICTS[0],
  drivingVehicle: null,
  vehicleSpeedKmh: 0,
  aircraftAltitude: 0,
  nearbyVehicle: 'vtol_jet',
  nearbyMission: STORY_MISSIONS[12],
  nearbyInterior: null,
  objectiveProgress: 0,
  skySwitchPhase: null,
  dialogueMission: null,
  activeMission: null,
  activeChoice: null,
  lastOutcomeText: null,
  phoneOpen: false,
  wheelMode: null,
  heistBoardOpen: false,
  customsGarageOpen: false,
  warungModalOpen: false,
  tpsAiming: false,
  muted: false,
  audioVolumes: initialSave?.audioSettings || { ...DEFAULT_AUDIO_VOLUMES },
  ambientCycleStep: 0,
  savedGame: initialSave,
  completedDynamicQuests: initialSave?.completedDynamicQuests || [],
};

const listeners = new Set<() => void>();

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export const gameStore = {
  getState: (): GameStoreSnapshot => state,

  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  setState: (
    updater:
      | Partial<GameStoreSnapshot>
      | ((prev: GameStoreSnapshot) => Partial<GameStoreSnapshot> | GameStoreSnapshot)
  ) => {
    const patch = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...patch };
    emitChange();
  },

  updatePlayerState: (
    updater:
      | Partial<PlayerProgressState>
      | ((prev: PlayerProgressState) => PlayerProgressState)
  ) => {
    const nextPlayer =
      typeof updater === 'function'
        ? updater(state.playerState)
        : { ...state.playerState, ...updater };
    if (nextPlayer === state.playerState) return;
    state = { ...state, playerState: nextPlayer };
    emitChange();
  },

  setAudioVolumes: (patch: Partial<AudioChannelVolumes>) => {
    const nextVolumes = soundEngine.setChannelVolumes(patch);
    state = { ...state, audioVolumes: nextVolumes };
    emitChange();
  },

  toggleMute: () => {
    soundEngine.muted = !soundEngine.muted;
    if (soundEngine.muted) {
      soundEngine.stopEngineAudio(true);
      soundEngine.stopAmbientSoundscape(true);
    }
    state = { ...state, muted: soundEngine.muted };
    emitChange();
  },

  claimDynamicSideQuest: (quest: NpcDynamicSideQuest): boolean => {
    if (state.completedDynamicQuests.includes(quest.id)) return false;
    soundEngine.playCashRegister();
    const prev = state.playerState;
    const nextScore = prev.score + 350;
    const nextRep = Math.min(100, prev.reputation[quest.faction] + quest.repGain);
    state = {
      ...state,
      completedDynamicQuests: [...state.completedDynamicQuests, quest.id],
      lastOutcomeText: `Side-Quest Jakarta Selesai: ${quest.title} (+Rp ${quest.rewardRp.toLocaleString('id-ID')})`,
      playerState: {
        ...prev,
        rupiah: prev.rupiah + quest.rewardRp,
        score: nextScore,
        bestScore: Math.max(prev.bestScore, nextScore),
        reputation: {
          ...prev.reputation,
          [quest.faction]: nextRep,
        },
      },
    };
    emitChange();
    return true;
  },
};

export function useGameStore<T>(selector: (s: GameStoreSnapshot) => T): T {
  return useSyncExternalStore(
    gameStore.subscribe,
    () => selector(gameStore.getState()),
    () => selector(gameStore.getState())
  );
}

import { useSyncExternalStore } from 'react';
import {
  ActiveStreetContractState,
  ActiveStreetRaceSession,
  ActiveTurfWarSession,
  ActiveQuestState,
  createActiveQuestState,
  stepQuestStageProgress,
  AudioChannelVolumes,
  COMBAT_COMBO_WINDOW_MS,
  CameraViewMode,
  CashLedgerEntry,
  CombatHitFeedbackEvent,
  CustomWaypointState,
  CutsceneOverlayState,
  CustomRaceTrackSpec,
  DailyChallengeKind,
  DailyChallengesState,
  DistrictZone,
  EnterableInteriorSpec,
  GRAND_HEISTS,
  GameSettings,
  GameState,
  GarageCameraPreset,
  GraphicsQualityTier,
  HeistBreachSession,
  HeistId,
  JAKARTA_DISTRICTS,
  KiranaDistrictHackState,
  NabiloGramPost,
  NabiloGramTriggerKind,
  NetCoopEvent,
  NpcDynamicSideQuest,
  OriginArchetype,
  PROTAGONIST_PROFILES,
  PhotoModeConfig,
  PlayerProgressState,
  PoliceTacticalState,
  PoliceVisionCone,
  ProtagonistId,
  RADIO_STATIONS,
  RaceRivalTelemetry,
  STORY_MISSIONS,
  SaveSlotId,
  SquadOrderMode,
  StreetBountySpec,
  StreetContractKind,
  StreetRandomEvent,
  StoryChoiceOption,
  StoryMission,
  StuntJumpResult,
  TrafficSignalPhase,
  TrioSquadTelemetryMember,
  TrioSynergyState,
  VehicleDamageState,
  VehicleType,
  ViralCloutState,
  ViralPostResponse,
  WeaponId,
  WeatherMode,
  WorldClockEventTickerState,
  WorldRoadEventKind,
  advanceDailyChallengeProgress,
  buildLocalViralPost,
  calculateStreetRacePayout,
  captureDistrictTurf,
  claimDailyChallengeReward,
  collectNusantaraPackage,
  computeHospitalRespawnState,
  computeViralCloutState,
  createDailyChallengesForDate,
  createInitialKiranaHackState,
  createInitialPlayerState,
  createInitialPoliceTacticalState,
  createInitialTrioSynergy,
  createInitialWorldClockEventState,
  createQuickPassengerFare,
  createSeedNabiloGramPosts,
  createStreetRaceSession,
  createTurfWarSession,
  cycleCameraViewMode as cycleCameraModePure,
  formatJakartaClock,
  incrementTrioSynergy,
  resolveCombatComboState,
  resolveSquadOrderCallout,
  spawnNextStreetRandomEvent,
  stepKiranaDistrictHack,
  stepPoliceTacticalState,
  triggerKiranaDistrictHack,
  triggerManualWorldRoadEvent,
  triggerWitnessCrimeReport,
} from '../game/rules';
import { InteriorManager } from '../engine/interiorManager';
import {
  DEFAULT_AUDIO_VOLUMES,
  DEFAULT_GAME_SETTINGS,
  SavedGameSnapshot,
  getActiveSaveSlot,
  loadSavedGame,
  setActiveSaveSlot,
} from '../game/save';
import { soundEngine } from '../game/sound';
import { cityAudio } from '../engine/CityAudio';

export const STREET_BOUNTIES: StreetBountySpec[] = [
  {
    id: 'bounty_priok_smuggler',
    title: 'Penyergapan Kontainer Gelap Priok',
    targetName: 'Kapten Bachtiar (Sindikat Dermaga)',
    districtName: 'Pelabuhan Tanjung Priok',
    x: 42,
    z: -42,
    rewardRp: 185000,
    faction: 'rakyat',
    difficulty: 'Menengah',
    description:
      'Amankan manifest kargo selundupan di dermaga utara dan lumpuhkan pengawal bersenjata.',
  },
  {
    id: 'bounty_scbd_courier',
    title: 'Intersepsi Kurir Data Bursa SCBD',
    targetName: 'Aldo V. (Broker Bayangan)',
    districtName: 'SCBD Sudirman',
    x: -28,
    z: 18,
    rewardRp: 240000,
    faction: 'sindikat',
    difficulty: 'Tinggi',
    description:
      'Rebut koper enkripsi algoritma BAJSA sebelum kurir mencapai helipad eksekutif.',
  },
  {
    id: 'bounty_kemayoran_racer',
    title: 'Tantangan Raja Drift Kemayoran',
    targetName: 'Riko Turbo (Sirkuit Malam)',
    districtName: 'Landasan Kemayoran',
    x: 34,
    z: 24,
    rewardRp: 210000,
    faction: 'jalanan',
    difficulty: 'Tinggi',
    description:
      'Patahkan dominasi geng balap liar di koridor tol layang dan menangkan taruhan jalanan.',
  },
  {
    id: 'bounty_glodok_tech',
    title: 'Pengawalan Chipset Drone Glodok',
    targetName: 'Koh Hendra (Pasar Elektronik)',
    districtName: 'Glodok & Kota Tua',
    x: -36,
    z: -32,
    rewardRp: 165000,
    faction: 'rakyat',
    difficulty: 'Menengah',
    description:
      'Lindungi kiriman komponen optik Drone Rajawali dari pemalak jalanan Kota Tua.',
  },
  {
    id: 'bounty_blokm_syndicate',
    title: 'Pembersihan Markas Preman Blok M',
    targetName: 'Bang Jago Terminal',
    districtName: 'Blok M & Melawai',
    x: -14,
    z: 40,
    rewardRp: 295000,
    faction: 'jalanan',
    difficulty: 'Ekstrem',
    description:
      'Bebaskan pedagang kaki lima Melawai dari pungutan liar kelompok bersenjata.',
  },
  {
    id: 'bounty_monas_vip',
    title: 'Konvoi Lapis Baja Medan Merdeka',
    targetName: 'Komandan Viktor',
    districtName: 'Lingkar Monas',
    x: 12,
    z: -14,
    rewardRp: 340000,
    faction: 'sindikat',
    difficulty: 'Ekstrem',
    description:
      'Gunakan taktik penyergapan cepat di bundaran Monas untuk menyita dana taktis sindikat.',
  },
];

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

export interface ProjectedWorldCallout {
  id: string;
  text: string;
  screenX: number;
  screenY: number;
  opacity: number;
  visible: boolean;
}

export interface EngineTelemetrySnapshot {
  playerX: number;
  playerY: number;
  playerZ: number;
  playerFacing: number;
  drivingVehicleId: string | null;
  vehicles: RadarVehicleBlip[];
  enemies: RadarEnemyBlip[];
  policeCones: PoliceVisionCone[];
  squadMembers: TrioSquadTelemetryMember[];
  raceRivals: RaceRivalTelemetry[];
  worldCallouts: ProjectedWorldCallout[];
  crosshairSpread: number;
  inCover: boolean;
  stuntAirTimeSec: number;
  activeVehicleDamage: VehicleDamageState | null;
  nearbyMission: StoryMission | null;
  activeChoice: StoryChoiceOption | null;
  perf: {
    fps: number;
    drawCalls: number;
    triangles: number;
    activeRigidBodies: number;
    networkPingMs: number;
    connectedPeers: number;
    roomId: string;
    roomMode: 'free_roam' | 'street_race' | 'coop_heist';
    simWorkerActive: boolean;
    connectionState: 'connected' | 'reconnecting' | 'offline';
  };
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
  policeCones: [],
  squadMembers: [],
  raceRivals: [],
  worldCallouts: [],
  crosshairSpread: 0,
  inCover: false,
  stuntAirTimeSec: 0,
  activeVehicleDamage: null,
  nearbyMission: STORY_MISSIONS[12],
  activeChoice: null,
  perf: {
    fps: 60,
    drawCalls: 42,
    triangles: 18400,
    activeRigidBodies: 26,
    networkPingMs: 0,
    connectedPeers: 0,
    roomId: 'jakarta_pusat',
    roomMode: 'free_roam',
    simWorkerActive: true,
    connectionState: 'connected',
  },
};

/**
 * Mutable 60Hz virtual touch + HTML5 Gamepad input ref read directly by PlayerController
 * with zero React re-render overhead.
 */
export interface VirtualInputState {
  moveX: number; // -1 (left) to +1 (right)
  moveY: number; // -1 (backward/brake) to +1 (forward/gas)
  lookDeltaX: number;
  lookDeltaY: number;
  fireHeld: boolean;
  aimHeld: boolean;
  sprintHeld: boolean;
  driftHeld: boolean;
  fireTap: boolean;
  enterVehicleTap: boolean;
  hornTap: boolean;
  fokusTap: boolean;
  interactTap: boolean;
  rollTap: boolean;
  coverTap: boolean;
  cameraTap: boolean;
  gamepadConnected: boolean;
  gamepadName: string;
}

export const virtualInputRef: VirtualInputState = {
  moveX: 0,
  moveY: 0,
  lookDeltaX: 0,
  lookDeltaY: 0,
  fireHeld: false,
  aimHeld: false,
  sprintHeld: false,
  driftHeld: false,
  fireTap: false,
  enterVehicleTap: false,
  hornTap: false,
  fokusTap: false,
  interactTap: false,
  rollTap: false,
  coverTap: false,
  cameraTap: false,
  gamepadConnected: false,
  gamepadName: '',
};

export interface SkySwitchPhaseState {
  active: boolean;
  stage: 1 | 2 | 3;
  targetId: ProtagonistId;
}

export const DEFAULT_PHOTO_CONFIG: PhotoModeConfig = {
  fov: 55,
  rollDeg: 0,
  orbitOffset: 0.4,
  heightOffset: 2.2,
  distance: 8.5,
  filter: 'standar',
  letterbox: true,
  ruleOfThirds: true,
  hidePlayer: false,
};

export interface GameStoreSnapshot {
  gameState: GameState;
  origin: OriginArchetype;
  selectedStage: 1 | 2 | 3 | 4 | 5;
  weatherMode: WeatherMode;
  worldTimeMinutes: number;
  autoTimeCycle: boolean;
  outcomeMode: 'victory' | 'defeat';
  playerState: PlayerProgressState;
  ghostHp: number;
  endSnapshot: PlayerProgressState;
  district: DistrictZone;
  drivingVehicle: VehicleType | null;
  vehicleSpeedKmh: number;
  aircraftAltitude: number;
  isDrifting: boolean;
  driftScore: number;
  driftMultiplier: number;
  nearbyVehicle: VehicleType | null;
  nearbyMission: StoryMission | null;
  nearbyInterior: EnterableInteriorSpec | null;
  objectiveProgress: number;
  skySwitchPhase: SkySwitchPhaseState | null;
  trafficSignalPhase: TrafficSignalPhase;
  dialogueMission: StoryMission | null;
  activeMission: StoryMission | null;
  activeChoice: StoryChoiceOption | null;
  activeQuestState: ActiveQuestState | null;
  activeContract: ActiveStreetContractState | null;
  lastOutcomeText: string | null;
  phoneOpen: boolean;
  phoneTargetScreen: 'home' | 'feed' | 'satelit' | 'imperium';
  wheelMode: 'weapon' | 'character' | null;
  heistBoardOpen: boolean;
  customsGarageOpen: boolean;
  warungModalOpen: boolean;
  tpsAiming: boolean;
  muted: boolean;
  audioVolumes: AudioChannelVolumes;
  gameSettings: GameSettings;
  resolvedGraphicsTier: Exclude<GraphicsQualityTier, 'auto'>;
  combatHitEvents: CombatHitFeedbackEvent[];
  playerHitFlash: { active: boolean; angleRad: number; stamp: number };
  cutsceneOverlay: CutsceneOverlayState | null;
  ambientCycleStep: number;
  activeSaveSlot: SaveSlotId;
  savedGame: SavedGameSnapshot | null;
  completedDynamicQuests: string[];
  customWaypoint: CustomWaypointState | null;
  zenHudMode: boolean;
  photoModeOpen: boolean;
  photoConfig: PhotoModeConfig;
  garageCameraPreset: GarageCameraPreset;
  cashLedger: CashLedgerEntry[];
  claimedBounties: string[];
  gamepadActive: boolean;
  worldClockEventState: WorldClockEventTickerState;
  perfOverlayOpen: boolean;
  cloudSyncStatus: string | null;
  nabiloGramPosts: NabiloGramPost[];
  viralClout: ViralCloutState;
  latestViralToast: NabiloGramPost | null;
  policeTactical: PoliceTacticalState;
  activeStreetEvent: StreetRandomEvent | null;
  streetEventCounter: number;
  trioSynergy: TrioSynergyState;
  activeHeistBreach: HeistBreachSession | null;
  activeVehicleDamage: VehicleDamageState | null;
  // Wave 2 Perfection Upgrade State
  cameraViewMode: CameraViewMode;
  inCover: boolean;
  coverKind: 'none' | 'building' | 'vehicle' | 'barrier';
  squadOrder: SquadOrderMode;
  squadCallout: { text: string; stamp: number } | null;
  activeRace: ActiveStreetRaceSession | null;
  stuntCompletedIds: string[];
  lastStuntBanner: StuntJumpResult | null;
  activeTurfWar: ActiveTurfWarSession | null;
  dailyChallenges: DailyChallengesState;
  killCamBanner: { label: string; stamp: number } | null;
  kiranaHackState: KiranaDistrictHackState;
  trioAbilityBuffUntilMs: number;
  inFloodZone: boolean;
  sharedCoopRaces: CustomRaceTrackSpec[];
  lastCoopEventToast: NetCoopEvent | null;
  combatCombo: {
    count: number;
    label: string;
    multiplier: number;
    bonusRp: number;
    lastKoMs: number;
  } | null;
  nearMissBanner: { text: string; rewardRp: number; stamp: number } | null;
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

const initialSlot = getActiveSaveSlot();
const initialPlayer = buildInitialStateForStage('anak_jalanan', 5);
const initialSave = loadSavedGame(initialSlot);
if (initialSave?.audioSettings) {
  soundEngine.setChannelVolumes(initialSave.audioSettings);
}

const INITIAL_CASH_LEDGER: CashLedgerEntry[] = [
  {
    id: 'tx_init_1',
    label: 'Modal Operasi Awal Trio Jakarta',
    amountRp: 1200000,
    category: 'misi',
    timestampLabel: '19:15 WIB',
  },
  {
    id: 'tx_init_2',
    label: 'Dividen Awal Portofolio BAJSA',
    amountRp: 85000,
    category: 'saham',
    timestampLabel: '19:30 WIB',
  },
];

let state: GameStoreSnapshot = {
  gameState: isAutostart ? 'playing' : 'title',
  origin: 'anak_jalanan',
  selectedStage: 5,
  weatherMode: 'senja',
  worldTimeMinutes: 1050, // 17:30 WIB Senja Emas
  autoTimeCycle: true,
  outcomeMode: 'victory',
  playerState: initialPlayer,
  ghostHp: initialPlayer.hp,
  endSnapshot: initialPlayer,
  district: JAKARTA_DISTRICTS[0],
  drivingVehicle: null,
  vehicleSpeedKmh: 0,
  aircraftAltitude: 0,
  isDrifting: false,
  driftScore: 0,
  driftMultiplier: 1,
  nearbyVehicle: 'vtol_jet',
  nearbyMission: STORY_MISSIONS[12],
  nearbyInterior: null,
  objectiveProgress: 0,
  skySwitchPhase: null,
  trafficSignalPhase: 'ns_green',
  dialogueMission: null,
  activeMission: null,
  activeChoice: null,
  activeQuestState: null,
  activeContract: null,
  lastOutcomeText: null,
  phoneOpen: false,
  phoneTargetScreen: 'home',
  wheelMode: null,
  heistBoardOpen: false,
  customsGarageOpen: false,
  warungModalOpen: false,
  tpsAiming: false,
  muted: false,
  audioVolumes: initialSave?.audioSettings || { ...DEFAULT_AUDIO_VOLUMES },
  gameSettings: initialSave?.gameSettings || { ...DEFAULT_GAME_SETTINGS },
  resolvedGraphicsTier: 'balanced',
  combatHitEvents: [],
  playerHitFlash: { active: false, angleRad: 0, stamp: 0 },
  cutsceneOverlay: null,
  ambientCycleStep: 0,
  activeSaveSlot: initialSlot,
  savedGame: initialSave,
  completedDynamicQuests: initialSave?.completedDynamicQuests || [],
  customWaypoint: null,
  zenHudMode: false,
  photoModeOpen: false,
  photoConfig: { ...DEFAULT_PHOTO_CONFIG },
  garageCameraPreset: 'free_orbit',
  cashLedger: INITIAL_CASH_LEDGER,
  claimedBounties: [],
  gamepadActive: false,
  worldClockEventState: createInitialWorldClockEventState(true),
  perfOverlayOpen: false,
  cloudSyncStatus: null,
  nabiloGramPosts: createSeedNabiloGramPosts(),
  viralClout: computeViralCloutState(60),
  latestViralToast: null,
  policeTactical: createInitialPoliceTacticalState(),
  activeStreetEvent: spawnNextStreetRandomEvent(1),
  streetEventCounter: 1,
  trioSynergy: createInitialTrioSynergy(),
  activeHeistBreach: null,
  activeVehicleDamage: null,
  cameraViewMode: 'third_person',
  inCover: false,
  coverKind: 'none',
  squadOrder: 'follow',
  squadCallout: null,
  activeRace: null,
  stuntCompletedIds: [],
  lastStuntBanner: null,
  activeTurfWar: null,
  dailyChallenges: createDailyChallengesForDate(),
  killCamBanner: null,
  kiranaHackState: createInitialKiranaHackState(),
  trioAbilityBuffUntilMs: 0,
  inFloodZone: false,
  sharedCoopRaces: [],
  lastCoopEventToast: null,
  combatCombo: null,
  nearMissBanner: null,
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

  togglePerfOverlay: () => {
    soundEngine.playPickup();
    state = { ...state, perfOverlayOpen: !state.perfOverlayOpen };
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

  setGameSettings: (patch: Partial<GameSettings>) => {
    state = {
      ...state,
      gameSettings: { ...state.gameSettings, ...patch },
    };
    emitChange();
  },

  setWorldTimeMinutes: (minutes: number) => {
    const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
    state = { ...state, worldTimeMinutes: wrapped };
    emitChange();
  },

  toggleAutoTimeCycle: () => {
    state = { ...state, autoTimeCycle: !state.autoTimeCycle };
    emitChange();
  },

  activateRoadEventDetourGps: () => {
    const activeEvent = state.worldClockEventState.activeEvent;
    if (!activeEvent) return;
    soundEngine.playPickup();
    const wpIndex = Math.min(
      activeEvent.detourStageIndex,
      activeEvent.spec.detourWaypoints.length - 1
    );
    const pt = activeEvent.spec.detourWaypoints[wpIndex] || [
      activeEvent.spec.detourTargetX,
      activeEvent.spec.detourTargetZ,
    ];
    state = {
      ...state,
      customWaypoint: {
        x: pt[0],
        z: pt[1],
        label: `Rute Alternatif (${wpIndex + 1}/${activeEvent.spec.detourWaypoints.length}): ${activeEvent.spec.detourLabel}`,
        category: 'detour',
      },
      lastOutcomeText: `GPS Rute Alternatif Aktif: ${activeEvent.spec.detourLabel} — Hindari ${activeEvent.spec.corridorName}!`,
    };
    emitChange();
  },

  triggerNextWorldRoadEvent: (preferredKind?: WorldRoadEventKind) => {
    soundEngine.playPickup();
    const { nextState, triggeredEvent } = triggerManualWorldRoadEvent(
      state.worldClockEventState,
      state.worldTimeMinutes,
      preferredKind
    );
    const firstPt = triggeredEvent.spec.detourWaypoints[0] || [
      triggeredEvent.spec.detourTargetX,
      triggeredEvent.spec.detourTargetZ,
    ];
    state = {
      ...state,
      worldClockEventState: nextState,
      customWaypoint: {
        x: firstPt[0],
        z: firstPt[1],
        label: `Rute Alternatif (1/${triggeredEvent.spec.detourWaypoints.length}): ${triggeredEvent.spec.detourLabel}`,
        category: 'detour',
      },
      lastOutcomeText: `Info Lalu Lintas (${formatJakartaClock(state.worldTimeMinutes)}): ${triggeredEvent.spec.title} — ${triggeredEvent.spec.detourLabel}`,
    };
    emitChange();
  },

  cycleRadioStation: () => {
    const currIdx = RADIO_STATIONS.findIndex(
      (r) => r.id === state.playerState.radioStation
    );
    const nextSpec =
      RADIO_STATIONS[(currIdx + 1) % RADIO_STATIONS.length] || RADIO_STATIONS[0];
    soundEngine.playPickup();
    if (nextSpec.id !== 'off') {
      soundEngine.playRadioBeat(nextSpec.id, 0);
    }
    state = {
      ...state,
      lastOutcomeText: `Radio FM: ${nextSpec.name} (${nextSpec.freq})`,
      playerState: {
        ...state.playerState,
        radioStation: nextSpec.id,
      },
    };
    emitChange();
  },

  switchSaveSlot: (slotId: SaveSlotId) => {
    setActiveSaveSlot(slotId);
    const loaded = loadSavedGame(slotId);
    soundEngine.playPickup();
    state = {
      ...state,
      activeSaveSlot: slotId,
      savedGame: loaded,
      completedDynamicQuests: loaded?.completedDynamicQuests || [],
    };
    emitChange();
  },

  startStreetContract: (kind: StreetContractKind, districtId?: string) => {
    soundEngine.playPickup();
    if (kind === 'ojol_delivery') {
      const targets = [
        { label: 'Drop-Off Paket Kilat SCBD Tower', x: -24, z: 18 },
        { label: 'Antar Dokumen VIP Bundaran HI', x: -12, z: -48 },
        { label: 'Kiriman Chipset Pasar Glodok', x: -34, z: -28 },
        { label: 'Kurir Ekspres Terminal Blok M', x: -16, z: 42 },
      ];
      const pick = targets[Math.floor(Math.random() * targets.length)];
      const contract: ActiveStreetContractState = {
        id: `contract_ojol_${Date.now()}`,
        kind: 'ojol_delivery',
        title: 'Kurir Ojol Kilat: Paket Prioritas',
        subtitle: pick.label,
        targetX: pick.x,
        targetZ: pick.z,
        rewardRp: 175000,
        timeRemainingSec: 75,
        totalTimeSec: 75,
      };
      state = {
        ...state,
        activeContract: contract,
        customWaypoint: {
          x: pick.x,
          z: pick.z,
          label: pick.label,
          category: 'custom',
        },
        lastOutcomeText: `Kontrak Dimulai: ${contract.title} — Capai titik tujuan sebelum waktu habis!`,
      };
      emitChange();
      return;
    }

    if (kind === 'convoy_intercept') {
      const contract: ActiveStreetContractState = {
        id: `contract_convoy_${Date.now()}`,
        kind: 'convoy_intercept',
        title: 'Intersepsi Konvoi Lapis Baja Sindikat',
        subtitle: 'Sergap kargo dana taktis di Lingkar Sabuk Tol & Semanggi',
        targetX: 28,
        targetZ: -26,
        rewardRp: 320000,
        timeRemainingSec: 95,
        totalTimeSec: 95,
      };
      state = {
        ...state,
        activeContract: contract,
        customWaypoint: {
          x: contract.targetX,
          z: contract.targetZ,
          label: 'Titik Sergap Konvoi Lapis Baja',
          category: 'custom',
        },
        lastOutcomeText: `Kontrak Taktis: ${contract.title} (+Rp 320.000)`,
      };
      emitChange();
      return;
    }

    if (kind === 'glodok_arena') {
      const contract: ActiveStreetContractState = {
        id: `contract_glodok_${Date.now()}`,
        kind: 'glodok_arena',
        title: 'Glodok Underground Arena: Gelombang Sindikat',
        subtitle: 'Bertahan hidup di gang neon Glodok & rebut taruhan utama',
        targetX: -34,
        targetZ: -28,
        rewardRp: 520000,
        timeRemainingSec: 120,
        totalTimeSec: 120,
        districtId: 'glodok',
      };
      state = {
        ...state,
        activeContract: contract,
        customWaypoint: {
          x: contract.targetX,
          z: contract.targetZ,
          label: 'Arena Bawah Tanah Glodok',
          category: 'custom',
        },
        lastOutcomeText: `Arena Glodok Dimulai: ${contract.title} (+Rp 520.000)`,
      };
      emitChange();
      return;
    }

    if (kind === 'priok_container_heist') {
      const contract: ActiveStreetContractState = {
        id: `contract_priok_${Date.now()}`,
        kind: 'priok_container_heist',
        title: 'Priok Container Heist: Ekstraksi Kendaraan Impor',
        subtitle: 'Retas manifest kargo Tanjung Priok & amankan kontainer VIP',
        targetX: 42,
        targetZ: -42,
        rewardRp: 780000,
        timeRemainingSec: 150,
        totalTimeSec: 150,
        districtId: 'priok',
      };
      state = {
        ...state,
        activeContract: contract,
        customWaypoint: {
          x: contract.targetX,
          z: contract.targetZ,
          label: 'Dermaga Kontainer Tanjung Priok',
          category: 'custom',
        },
        lastOutcomeText: `Misi Penyelundupan Priok: ${contract.title} (+Rp 780.000)`,
      };
      emitChange();
      return;
    }

    const dist =
      JAKARTA_DISTRICTS.find((d) => d.id === districtId) || JAKARTA_DISTRICTS[2];
    const cx = Math.round(dist.centerX);
    const cz = Math.round(dist.centerZ);
    const contract: ActiveStreetContractState = {
      id: `contract_turf_${Date.now()}`,
      kind: 'turf_assault',
      title: `Operasi Rebut Distrik: ${dist.name}`,
      subtitle: `Amankan pos komando ${dist.name} dari pengawal sindikat`,
      targetX: cx,
      targetZ: cz,
      rewardRp: 240000,
      timeRemainingSec: 90,
      totalTimeSec: 90,
      districtId: dist.id,
    };
    state = {
      ...state,
      activeContract: contract,
      customWaypoint: {
        x: cx,
        z: cz,
        label: `Rebut Teritori: ${dist.name}`,
        category: 'custom',
      },
      lastOutcomeText: `Operasi Teritori Dimulai: ${dist.name}`,
    };
    emitChange();
  },

  completeStreetContract: () => {
    const contract = state.activeContract;
    if (!contract) return;
    soundEngine.playMissionFanfare();
    const prev = state.playerState;
    const nextTurf = { ...(prev.districtTurf || {}) };
    if (contract.districtId && nextTurf[contract.districtId]) {
      nextTurf[contract.districtId] = {
        ...nextTurf[contract.districtId],
        owner: 'player',
        defenseLevel: Math.max(1, nextTurf[contract.districtId].defenseLevel),
      };
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const tx: CashLedgerEntry = {
      id: `tx_contract_${Date.now()}`,
      label: `Kontrak Selesai: ${contract.title}`,
      amountRp: contract.rewardRp,
      category: 'misi',
      timestampLabel: `${hh}:${mm} WIB`,
    };
    const nextScore = prev.score + 600;
    state = {
      ...state,
      activeContract: null,
      customWaypoint: null,
      cashLedger: [tx, ...state.cashLedger].slice(0, 18),
      lastOutcomeText: `Kontrak Tuntas! ${contract.title} (+Rp ${contract.rewardRp.toLocaleString('id-ID')})`,
      playerState: {
        ...prev,
        rupiah: prev.rupiah + contract.rewardRp,
        score: nextScore,
        bestScore: Math.max(prev.bestScore, nextScore),
        districtTurf: nextTurf,
      },
    };
    emitChange();
  },

  startQuickTaxiFare: (
    playerX: number,
    playerZ: number,
    vehicleLabel: string
  ): ActiveStreetContractState | null => {
    if (state.activeContract) return null;
    soundEngine.playPickup();
    const fare = createQuickPassengerFare(playerX, playerZ, vehicleLabel);
    state = {
      ...state,
      activeContract: fare,
      customWaypoint: {
        x: fare.targetX,
        z: fare.targetZ,
        label: fare.subtitle,
        category: 'custom',
      },
      lastOutcomeText: `${fare.title}: ${fare.subtitle} (+Rp ${fare.rewardRp.toLocaleString('id-ID')})`,
    };
    emitChange();
    return fare;
  },

  setCustomWaypoint: (wp: CustomWaypointState | null) => {
    soundEngine.playPickup();
    state = { ...state, customWaypoint: wp };
    emitChange();
  },

  setPhotoConfig: (patch: Partial<PhotoModeConfig>) => {
    state = {
      ...state,
      photoConfig: { ...state.photoConfig, ...patch },
    };
    emitChange();
  },

  setGarageCameraPreset: (preset: GarageCameraPreset) => {
    soundEngine.playPickup();
    state = { ...state, garageCameraPreset: preset };
    emitChange();
  },

  recordCashTransaction: (
    label: string,
    amountRp: number,
    category: CashLedgerEntry['category']
  ) => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const entry: CashLedgerEntry = {
      id: `tx_${Date.now()}_${Math.floor(Math.random() * 999)}`,
      label,
      amountRp,
      category,
      timestampLabel: `${hh}:${mm} WIB`,
    };
    state = {
      ...state,
      cashLedger: [entry, ...state.cashLedger].slice(0, 18),
    };
    emitChange();
  },

  claimStreetBounty: (bountyId: string): boolean => {
    if (state.claimedBounties.includes(bountyId)) return false;
    const spec = STREET_BOUNTIES.find((b) => b.id === bountyId);
    if (!spec) return false;
    soundEngine.playCashRegister();
    const prev = state.playerState;
    const nextScore = prev.score + 500;
    const nextRep = Math.min(100, prev.reputation[spec.faction] + 10);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const tx: CashLedgerEntry = {
      id: `tx_bounty_${Date.now()}`,
      label: `Bounty Tuntas: ${spec.title}`,
      amountRp: spec.rewardRp,
      category: 'bounty',
      timestampLabel: `${hh}:${mm} WIB`,
    };
    state = {
      ...state,
      claimedBounties: [...state.claimedBounties, bountyId],
      cashLedger: [tx, ...state.cashLedger].slice(0, 18),
      lastOutcomeText: `Bounty Jalanan Tuntas: ${spec.title} (+Rp ${spec.rewardRp.toLocaleString('id-ID')})`,
      playerState: {
        ...prev,
        rupiah: prev.rupiah + spec.rewardRp,
        score: nextScore,
        bestScore: Math.max(prev.bestScore, nextScore),
        reputation: {
          ...prev.reputation,
          [spec.faction]: nextRep,
        },
      },
    };
    emitChange();
    return true;
  },

  pushCombatHitEvent: (evt: CombatHitFeedbackEvent) => {
    const next = [...state.combatHitEvents.slice(-5), evt];
    state = { ...state, combatHitEvents: next };
    emitChange();
    window.setTimeout(() => {
      state = {
        ...state,
        combatHitEvents: state.combatHitEvents.filter((item) => item.id !== evt.id),
      };
      emitChange();
    }, 680);
  },

  triggerPlayerHitFlash: (angleRad: number) => {
    const stamp = Date.now();
    state = {
      ...state,
      playerHitFlash: { active: true, angleRad, stamp },
    };
    emitChange();
    window.setTimeout(() => {
      if (state.playerHitFlash.stamp === stamp) {
        state = {
          ...state,
          playerHitFlash: { ...state.playerHitFlash, active: false },
        };
        emitChange();
      }
    }, 420);
  },

  toggleMute: () => {
    soundEngine.muted = !soundEngine.muted;
    cityAudio.syncMuteState(soundEngine.muted);
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
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const tx: CashLedgerEntry = {
      id: `tx_quest_${Date.now()}`,
      label: `Side-Quest: ${quest.title}`,
      amountRp: quest.rewardRp,
      category: 'bounty',
      timestampLabel: `${hh}:${mm} WIB`,
    };
    state = {
      ...state,
      completedDynamicQuests: [...state.completedDynamicQuests, quest.id],
      cashLedger: [tx, ...state.cashLedger].slice(0, 18),
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

  publishViralEvent: (params: {
    triggerKind: NabiloGramTriggerKind;
    snapshotDataUrl: string | null;
    vehicleName?: string;
    summaryNote?: string;
    cloutGain?: number;
  }) => {
    const pState = state.playerState;
    const protagonistName =
      PROTAGONIST_PROFILES[pState.activeProtagonist]?.name || 'Nabilo';
    const districtName = state.district?.name || 'Jakarta Pusat';
    const postId = `ng_${Date.now()}_${Math.floor(Math.random() * 999)}`;

    const localPost = buildLocalViralPost({
      id: postId,
      triggerKind: params.triggerKind,
      districtName,
      protagonistName,
      wantedLevel: pState.wantedLevel,
      vehicleName: params.vehicleName,
      snapshotDataUrl: params.snapshotDataUrl,
      summaryNote: params.summaryNote,
    });

    const gain = params.cloutGain ?? (params.triggerKind === 'heist_complete' ? 95 : 35);
    const nextClout = computeViralCloutState(state.viralClout.xp + gain);
    const dcRes = advanceDailyChallengeProgress(state.dailyChallenges, 'viral_post', 1);
    soundEngine.playPickup();

    state = {
      ...state,
      nabiloGramPosts: [localPost, ...state.nabiloGramPosts].slice(0, 16),
      viralClout: nextClout,
      latestViralToast: localPost,
      dailyChallenges: dcRes.next,
    };
    emitChange();

    window.setTimeout(() => {
      if (state.latestViralToast?.id === postId) {
        state = { ...state, latestViralToast: null };
        emitChange();
      }
    }, 5200);

    // Asynchronously upgrade caption & comments with live Gemini AI if available
    if (typeof fetch === 'function') {
      void fetch('/api/social/viral-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerKind: params.triggerKind,
          districtName,
          protagonistName,
          wantedLevel: pState.wantedLevel,
          vehicleName: params.vehicleName,
          summaryNote: params.summaryNote,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: ViralPostResponse | null) => {
          if (!data || !data.caption) return;
          const idx = state.nabiloGramPosts.findIndex((p) => p.id === postId);
          if (idx === -1) return;
          const existing = state.nabiloGramPosts[idx];
          const upgraded: NabiloGramPost = {
            ...existing,
            authorHandle: data.authorHandle || existing.authorHandle,
            authorTag: data.authorTag || existing.authorTag,
            caption: data.caption,
            hashtags:
              Array.isArray(data.hashtags) && data.hashtags.length > 0
                ? data.hashtags
                : existing.hashtags,
            comments:
              Array.isArray(data.comments) && data.comments.length > 0
                ? data.comments.map((c, ci) => ({
                    id: `${postId}_ai_${ci}`,
                    handle: c.handle,
                    text: c.text,
                    likes: c.likes,
                  }))
                : existing.comments,
            source: data.source || 'gemini',
          };
          const nextPosts = [...state.nabiloGramPosts];
          nextPosts[idx] = upgraded;
          state = {
            ...state,
            nabiloGramPosts: nextPosts,
            latestViralToast:
              state.latestViralToast?.id === postId
                ? upgraded
                : state.latestViralToast,
          };
          emitChange();
        })
        .catch(() => {
          // Local Jakarta post is already rendered immediately
        });
    }
  },

  toggleLikeViralPost: (postId: string) => {
    soundEngine.playPickup();
    let gainedXp = 0;
    const nextPosts = state.nabiloGramPosts.map((p) => {
      if (p.id !== postId) return p;
      const nextLiked = !p.isLiked;
      if (nextLiked) gainedXp = 5;
      return {
        ...p,
        isLiked: nextLiked,
        likes: p.likes + (nextLiked ? 1 : -1),
      };
    });
    state = {
      ...state,
      nabiloGramPosts: nextPosts,
      viralClout:
        gainedXp > 0
          ? computeViralCloutState(state.viralClout.xp + gainedXp)
          : state.viralClout,
    };
    emitChange();
  },

  boostViralPost: (postId: string): boolean => {
    const BOOST_COST = 25000;
    const target = state.nabiloGramPosts.find((p) => p.id === postId);
    if (!target || target.boosted || state.playerState.rupiah < BOOST_COST) {
      return false;
    }
    soundEngine.playCashRegister();
    const nextPosts = state.nabiloGramPosts.map((p) =>
      p.id === postId
        ? {
            ...p,
            boosted: true,
            views: p.views + 28500,
            likes: p.likes + 4200,
          }
        : p
    );
    const nextClout = computeViralCloutState(state.viralClout.xp + 65);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const tx: CashLedgerEntry = {
      id: `tx_boost_${Date.now()}`,
      label: 'Promosi FYP NabiloGram',
      amountRp: -BOOST_COST,
      category: 'belanja',
      timestampLabel: `${hh}:${mm} WIB`,
    };
    state = {
      ...state,
      nabiloGramPosts: nextPosts,
      viralClout: nextClout,
      cashLedger: [tx, ...state.cashLedger].slice(0, 18),
      playerState: {
        ...state.playerState,
        rupiah: state.playerState.rupiah - BOOST_COST,
        score: state.playerState.score + 200,
        bestScore: Math.max(
          state.playerState.bestScore,
          state.playerState.score + 200
        ),
      },
      lastOutcomeText: `Postingan melesat ke Trending Jakarta! Clout Lv.${nextClout.level} (${nextClout.tierTitle})`,
    };
    emitChange();
    return true;
  },

  dismissViralToast: () => {
    if (!state.latestViralToast) return;
    state = { ...state, latestViralToast: null };
    emitChange();
  },

  reportWitnessCrime: (x: number, z: number, districtName?: string) => {
    const dName = districtName || state.district?.name || 'Jakarta Pusat';
    const nextTac = triggerWitnessCrimeReport(
      state.policeTactical,
      x,
      z,
      dName,
      state.playerState.wantedLevel
    );
    state = { ...state, policeTactical: nextTac };
    emitChange();
  },

  stepPoliceTactical: (params: {
    dt: number;
    hasLineOfSight: boolean;
    playerX: number;
    playerZ: number;
    districtName: string;
  }) => {
    const { next, escalateToStarOne } = stepPoliceTacticalState(
      state.policeTactical,
      {
        ...params,
        wantedLevel: state.playerState.wantedLevel,
      }
    );
    const changed =
      next.phase !== state.policeTactical.phase ||
      Math.round(next.witnessProgress) !==
        Math.round(state.policeTactical.witnessProgress) ||
      next.radioCallout !== state.policeTactical.radioCallout ||
      escalateToStarOne;
    if (!changed) return;

    if (escalateToStarOne) {
      soundEngine.playPoliceSiren();
      state = {
        ...state,
        policeTactical: next,
        playerState: {
          ...state.playerState,
          wantedLevel: Math.max(1, state.playerState.wantedLevel),
          wantedEvading: false,
          wantedEvadeTimer: 0,
        },
        lastOutcomeText:
          next.radioCallout ||
          'Saksi melapor ke 110! Patroli polisi mulai mengejar.',
      };
    } else {
      state = { ...state, policeTactical: next };
    }
    emitChange();
  },

  tickStreetRandomEvent: (dt: number) => {
    const cur = state.activeStreetEvent;
    if (!cur || cur.status !== 'active') {
      const nextCounter = state.streetEventCounter + 1;
      state = {
        ...state,
        streetEventCounter: nextCounter,
        activeStreetEvent: spawnNextStreetRandomEvent(nextCounter, cur?.kind),
      };
      emitChange();
      return;
    }
    const rem = cur.remainingSec - dt;
    if (rem <= 0) {
      const nextCounter = state.streetEventCounter + 1;
      state = {
        ...state,
        streetEventCounter: nextCounter,
        activeStreetEvent: spawnNextStreetRandomEvent(nextCounter, cur.kind),
      };
      emitChange();
    } else if (Math.floor(rem) !== Math.floor(cur.remainingSec)) {
      state = {
        ...state,
        activeStreetEvent: { ...cur, remainingSec: rem },
      };
      emitChange();
    }
  },

  spawnStreetEventNow: () => {
    soundEngine.playPickup();
    const nextCounter = state.streetEventCounter + 1;
    const nextEv = spawnNextStreetRandomEvent(
      nextCounter,
      state.activeStreetEvent?.kind
    );
    state = {
      ...state,
      streetEventCounter: nextCounter,
      activeStreetEvent: nextEv,
      customWaypoint: {
        x: nextEv.x,
        z: nextEv.z,
        label: `Event Jalanan: ${nextEv.title}`,
        category: 'custom',
      },
      lastOutcomeText: `Event Jalanan Baru di ${nextEv.districtName}: ${nextEv.title}`,
    };
    emitChange();
  },

  resolveActiveStreetEvent: (snapshotDataUrl: string | null = null): StreetRandomEvent | null => {
    const ev = state.activeStreetEvent;
    if (!ev || ev.status !== 'active') return null;
    soundEngine.playMissionFanfare();
    const prev = state.playerState;
    const sponsorBonus = Math.round(
      ev.rewardRp * (state.viralClout.sponsorBonusPercent / 100)
    );
    const totalRp = ev.rewardRp + sponsorBonus;
    const nextScore = prev.score + 420;
    const nextRep = Math.min(100, prev.reputation[ev.faction] + 8);
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const tx: CashLedgerEntry = {
      id: `tx_sev_${Date.now()}`,
      label: `Event Jalanan: ${ev.title}`,
      amountRp: totalRp,
      category: 'bounty',
      timestampLabel: `${hh}:${mm} WIB`,
    };
    const nextCounter = state.streetEventCounter + 1;
    const nextEv = spawnNextStreetRandomEvent(nextCounter, ev.kind);
    const nextSynergy = incrementTrioSynergy(
      state.trioSynergy,
      prev.activeProtagonist,
      5
    );
    state = {
      ...state,
      streetEventCounter: nextCounter,
      activeStreetEvent: nextEv,
      trioSynergy: nextSynergy,
      cashLedger: [tx, ...state.cashLedger].slice(0, 18),
      lastOutcomeText: `Event Jalanan Tuntas: ${ev.title} (+Rp ${totalRp.toLocaleString('id-ID')} & +${ev.cloutXp} Clout)`,
      playerState: {
        ...prev,
        rupiah: prev.rupiah + totalRp,
        score: nextScore,
        bestScore: Math.max(prev.bestScore, nextScore),
        reputation: {
          ...prev.reputation,
          [ev.faction]: nextRep,
        },
      },
    };
    emitChange();

    gameStore.publishViralEvent({
      triggerKind: 'street_event',
      snapshotDataUrl,
      summaryNote: `${ev.title} di ${ev.districtName} beres dalam hitungan detik! Warga kasih hormat!`,
      cloutGain: ev.cloutXp,
    });
    return ev;
  },

  boostTrioSynergy: (amount: number = 8, toastNote?: string) => {
    const nextSyn = incrementTrioSynergy(
      state.trioSynergy,
      state.playerState.activeProtagonist,
      amount
    );
    soundEngine.playPickup();
    state = {
      ...state,
      trioSynergy: nextSyn,
      lastOutcomeText:
        toastNote || nextSyn.lastBanterLine || 'Sinergi Trio Jakarta meningkat!',
    };
    emitChange();
  },

  startHeistBreach: (heistId: HeistId) => {
    const spec = GRAND_HEISTS.find((h) => h.id === heistId);
    if (!spec) return;
    const approach = state.playerState.activeHeistPlan.approach;
    soundEngine.playPickup();
    state = {
      ...state,
      heistBoardOpen: false,
      activeHeistBreach: {
        heistId,
        approach,
        stage: approach === 'stealth_cyber' ? 'cyber_signal' : 'thermal_drill',
        progress: 0,
        heat: 18,
        lockedBands: 0,
        active: true,
      },
    };
    emitChange();
  },

  updateHeistBreach: (patch: Partial<HeistBreachSession>) => {
    if (!state.activeHeistBreach) return;
    state = {
      ...state,
      activeHeistBreach: { ...state.activeHeistBreach, ...patch },
    };
    emitChange();
  },

  closeHeistBreach: () => {
    if (!state.activeHeistBreach) return;
    state = { ...state, activeHeistBreach: null };
    emitChange();
  },

  /* ==========================================================================
   * WAVE 2 PERFECTION UPGRADE ACTIONS
   * ========================================================================== */

  cycleCameraViewMode: () => {
    const nextMode = cycleCameraModePure(state.cameraViewMode);
    soundEngine.playPickup();
    state = { ...state, cameraViewMode: nextMode };
    emitChange();
  },

  setCameraViewMode: (mode: CameraViewMode) => {
    if (state.cameraViewMode === mode) return;
    state = { ...state, cameraViewMode: mode };
    emitChange();
  },

  setCoverState: (
    inCover: boolean,
    coverKind: 'none' | 'building' | 'vehicle' | 'barrier' = 'none'
  ) => {
    if (state.inCover === inCover && state.coverKind === coverKind) return;
    engineTelemetryRef.inCover = inCover;
    state = { ...state, inCover, coverKind };
    emitChange();
  },

  setSquadOrder: (order: SquadOrderMode) => {
    const callout = resolveSquadOrderCallout(
      order,
      state.playerState.activeProtagonist
    );
    soundEngine.playPickup();
    state = {
      ...state,
      squadOrder: order,
      squadCallout: { text: callout, stamp: Date.now() },
    };
    emitChange();
  },

  triggerSquadCallout: (text: string) => {
    state = {
      ...state,
      squadCallout: { text, stamp: Date.now() },
    };
    emitChange();
  },

  triggerKillCamBanner: (label: string) => {
    state = {
      ...state,
      killCamBanner: { label, stamp: Date.now() },
    };
    emitChange();
  },

  startStreetRace: (raceId: string) => {
    const session = createStreetRaceSession(raceId);
    if (!session) return null;
    soundEngine.playPickup();
    state = {
      ...state,
      phoneOpen: false,
      activeRace: session,
      lastOutcomeText: `Balap Liar dimulai: ${session.raceName} (3 Rival AI)`,
    };
    emitChange();
    return session;
  },

  updateActiveRace: (patch: Partial<ActiveStreetRaceSession>) => {
    if (!state.activeRace) return;
    state = {
      ...state,
      activeRace: { ...state.activeRace, ...patch },
    };
    emitChange();
  },

  finishStreetRace: (place: number) => {
    const race = state.activeRace;
    if (!race || race.status === 'finished') return;
    const payout = calculateStreetRacePayout(race.rewardRp, place);
    const nextClout = computeViralCloutState(state.viralClout.xp + payout.cloutXp);
    const nextSyn = incrementTrioSynergy(
      state.trioSynergy,
      state.playerState.activeProtagonist,
      place <= 2 ? 8 : 4
    );
    const dcRes =
      place <= 3
        ? advanceDailyChallengeProgress(state.dailyChallenges, 'street_race_win', 1)
        : { next: state.dailyChallenges, justCompletedTitle: null };

    soundEngine.playVictoryFanfare();
    state = {
      ...state,
      playerState: {
        ...state.playerState,
        rupiah: state.playerState.rupiah + payout.rewardRp,
        score: state.playerState.score + (place === 1 ? 650 : 320),
        bestScore: Math.max(
          state.playerState.bestScore,
          state.playerState.score + (place === 1 ? 650 : 320)
        ),
        reputation: {
          ...state.playerState.reputation,
          jalanan: Math.min(100, state.playerState.reputation.jalanan + (place === 1 ? 10 : 5)),
        },
      },
      viralClout: nextClout,
      trioSynergy: nextSyn,
      dailyChallenges: dcRes.next,
      activeRace: {
        ...race,
        status: 'finished',
        position: place,
        finishedPlace: place,
      },
      lastOutcomeText: `${payout.label} · +Rp ${payout.rewardRp.toLocaleString('id-ID')}${
        dcRes.justCompletedTitle ? ` · Tantangan Selesai: ${dcRes.justCompletedTitle}` : ''
      }`,
    };
    emitChange();
  },

  cancelStreetRace: () => {
    if (!state.activeRace) return;
    state = { ...state, activeRace: null };
    engineTelemetryRef.raceRivals.length = 0;
    emitChange();
  },

  recordStuntJump: (result: StuntJumpResult) => {
    const nextCompleted = result.isNewRamp
      ? Array.from(new Set([...state.stuntCompletedIds, result.rampId]))
      : state.stuntCompletedIds;
    const nextClout = computeViralCloutState(state.viralClout.xp + result.cloutXp);
    const dcRes = advanceDailyChallengeProgress(state.dailyChallenges, 'stunt_jump', 1);
    soundEngine.playPickup();
    state = {
      ...state,
      playerState: {
        ...state.playerState,
        rupiah: state.playerState.rupiah + result.rewardRp,
        score: state.playerState.score + Math.round(result.distanceM * 12),
        bestScore: Math.max(
          state.playerState.bestScore,
          state.playerState.score + Math.round(result.distanceM * 12)
        ),
      },
      viralClout: nextClout,
      stuntCompletedIds: nextCompleted,
      lastStuntBanner: result,
      dailyChallenges: dcRes.next,
      lastOutcomeText: `STUNT ${result.rating}! ${result.distanceM}m (${result.airTimeSec}d) · +Rp ${result.rewardRp.toLocaleString('id-ID')}`,
    };
    emitChange();
  },

  dismissStuntBanner: () => {
    if (!state.lastStuntBanner) return;
    state = { ...state, lastStuntBanner: null };
    emitChange();
  },

  startTurfWar: (districtId: string) => {
    const session = createTurfWarSession(districtId);
    if (!session) return null;
    soundEngine.playPickup();
    state = {
      ...state,
      phoneOpen: false,
      activeTurfWar: session,
      lastOutcomeText: `Serangan Wilayah dimulai di ${session.districtName} — Gelombang 1/3!`,
    };
    emitChange();
    return session;
  },

  updateTurfWarState: (patch: Partial<ActiveTurfWarSession>) => {
    if (!state.activeTurfWar) return;
    state = {
      ...state,
      activeTurfWar: { ...state.activeTurfWar, ...patch },
    };
    emitChange();
  },

  completeTurfWar: () => {
    const tw = state.activeTurfWar;
    if (!tw || tw.status !== 'active') return;
    const cap = captureDistrictTurf(state.playerState, tw.districtId);
    const nextClout = computeViralCloutState(state.viralClout.xp + 90);
    const nextSyn = incrementTrioSynergy(
      state.trioSynergy,
      state.playerState.activeProtagonist,
      10
    );
    const dcRes = advanceDailyChallengeProgress(
      state.dailyChallenges,
      'turf_capture',
      1
    );
    soundEngine.playVictoryFanfare();
    state = {
      ...state,
      playerState: cap.nextState,
      viralClout: nextClout,
      trioSynergy: nextSyn,
      dailyChallenges: dcRes.next,
      activeTurfWar: {
        ...tw,
        enemiesRemaining: 0,
        captainAlive: false,
        progressPct: 100,
        status: 'victory',
      },
      lastOutcomeText: `WILAYAH DIKUASAI: ${tw.districtName}! +Rp ${cap.rewardRp.toLocaleString('id-ID')} & Dividen Pasif Naik`,
    };
    emitChange();
  },

  abortTurfWar: () => {
    if (!state.activeTurfWar) return;
    state = { ...state, activeTurfWar: null };
    emitChange();
  },

  recordDailyProgress: (kind: DailyChallengeKind, delta: number = 1) => {
    const res = advanceDailyChallengeProgress(state.dailyChallenges, kind, delta);
    if (res.next === state.dailyChallenges) return;
    state = {
      ...state,
      dailyChallenges: res.next,
      lastOutcomeText: res.justCompletedTitle
        ? `Tantangan Harian Selesai: ${res.justCompletedTitle} — Klaim di NabiloPhone!`
        : state.lastOutcomeText,
    };
    emitChange();
  },

  claimDailyChallenge: (challengeId: string) => {
    const res = claimDailyChallengeReward(state.dailyChallenges, challengeId);
    if (!res.claimed) return false;
    const nextClout = computeViralCloutState(state.viralClout.xp + res.cloutXp);
    soundEngine.playVictoryFanfare();
    state = {
      ...state,
      playerState: {
        ...state.playerState,
        rupiah: state.playerState.rupiah + res.rewardRp,
        score: state.playerState.score + 350,
        bestScore: Math.max(state.playerState.bestScore, state.playerState.score + 350),
      },
      viralClout: nextClout,
      dailyChallenges: res.next,
      lastOutcomeText: `Hadiah Tantangan Harian diklaim! +Rp ${res.rewardRp.toLocaleString('id-ID')} · +${res.cloutXp} Clout`,
    };
    emitChange();
    return true;
  },

  triggerActiveProtagonistAbility: (): { triggered: boolean; kind: 'kirana_hack' | 'raka_overdrive' | 'nabilo_surge' | 'none'; message: string } => {
    const activeId = state.playerState.activeProtagonist;
    if (activeId === 'kirana') {
      const res = triggerKiranaDistrictHack(activeId, state.kiranaHackState);
      if (res.triggered) {
        soundEngine.playMissionFanfare();
        state = {
          ...state,
          kiranaHackState: res.hackState,
          lastOutcomeText: res.message,
        };
        emitChange();
        return { triggered: true, kind: 'kirana_hack', message: res.message };
      }
      state = { ...state, lastOutcomeText: res.message };
      emitChange();
      return { triggered: false, kind: 'none', message: res.message };
    }

    const nowMs = Date.now();
    if (state.trioAbilityBuffUntilMs > nowMs) {
      const rem = Math.ceil((state.trioAbilityBuffUntilMs - nowMs) / 1000);
      const msg = `Skill Taktis ${PROTAGONIST_PROFILES[activeId].name} masih aktif (${rem} dtk).`;
      state = { ...state, lastOutcomeText: msg };
      emitChange();
      return { triggered: false, kind: 'none', message: msg };
    }

    if (state.playerState.fokusEnergy < 30) {
      const msg = 'Energi Fokus minimal 30% untuk mengaktifkan Skill Taktis!';
      state = { ...state, lastOutcomeText: msg };
      emitChange();
      return { triggered: false, kind: 'none', message: msg };
    }

    soundEngine.playNitroBoost();
    const isRaka = activeId === 'raka';
    const msg = isRaka
      ? 'KILAT OVERDRIVE (12 dtk): Akselerasi motor & kecepatan lari Raka memuncak!'
      : 'GARUDA ARMOR SURGE (12 dtk): +25 Armor darurat & ketahanan benturan maksimal!';
    state = {
      ...state,
      trioAbilityBuffUntilMs: nowMs + 12_000,
      playerState: {
        ...state.playerState,
        fokusEnergy: Math.max(0, state.playerState.fokusEnergy - 30),
        armor: isRaka
          ? state.playerState.armor
          : Math.min(state.playerState.maxArmor, state.playerState.armor + 25),
      },
      lastOutcomeText: msg,
    };
    emitChange();
    return {
      triggered: true,
      kind: isRaka ? 'raka_overdrive' : 'nabilo_surge',
      message: msg,
    };
  },

  stepKiranaHackTick: (dt: number) => {
    if (!state.kiranaHackState.active && state.kiranaHackState.cooldownSeconds <= 0) {
      return;
    }
    const nextHack = stepKiranaDistrictHack(state.kiranaHackState, dt);
    if (
      nextHack.active !== state.kiranaHackState.active ||
      Math.ceil(nextHack.remainingSeconds) !== Math.ceil(state.kiranaHackState.remainingSeconds) ||
      Math.ceil(nextHack.cooldownSeconds) !== Math.ceil(state.kiranaHackState.cooldownSeconds)
    ) {
      state = { ...state, kiranaHackState: nextHack };
      emitChange();
    } else {
      state.kiranaHackState = nextHack;
    }
  },

  restInSafehouse: (hours: number = 6) => {
    const res = InteriorManager.restInSafehouse(
      state.playerState,
      state.worldTimeMinutes,
      hours
    );
    soundEngine.playMissionFanfare();
    state = {
      ...state,
      playerState: res.nextPlayerState,
      worldTimeMinutes: res.nextWorldTimeMinutes,
      lastOutcomeText: `Istirahat Safehouse +${res.hoursRested} Jam (${formatJakartaClock(
        res.nextWorldTimeMinutes
      )}): HP & Armor penuh, level buronan mereda.`,
    };
    emitChange();
    return res;
  },

  addCustomRaceTrack: (track: CustomRaceTrackSpec) => {
    const existing = state.playerState.customRaceTracks || [];
    const nextTracks = [track, ...existing.filter((t) => t.id !== track.id)].slice(0, 12);
    soundEngine.playPickup();
    state = {
      ...state,
      playerState: {
        ...state.playerState,
        customRaceTracks: nextTracks,
      },
      lastOutcomeText: `Sirkuit UGC "${track.name}" tersimpan (${track.checkpoints.length} CP).`,
    };
    emitChange();
  },

  receiveSharedCoopRace: (track: CustomRaceTrackSpec) => {
    const nextShared = [
      track,
      ...state.sharedCoopRaces.filter((t) => t.id !== track.id),
    ].slice(0, 8);
    state = {
      ...state,
      sharedCoopRaces: nextShared,
      lastOutcomeText: `Sirkuit Co-Op diterima dari ${track.authorName}: "${track.name}"!`,
    };
    emitChange();
  },

  startCustomStreetRace: (track: CustomRaceTrackSpec): ActiveStreetRaceSession => {
    const session: ActiveStreetRaceSession = {
      raceId: track.id,
      raceName: track.name,
      checkpoints: track.checkpoints,
      playerCheckpointIndex: 0,
      countdownSec: 3,
      elapsedSec: 0,
      position: 1,
      totalRacers: 4,
      status: 'countdown',
      rewardRp: track.rewardRp,
      finishedPlace: null,
    };
    soundEngine.playPickup();
    state = {
      ...state,
      phoneOpen: false,
      activeRace: session,
      lastOutcomeText: `Balap Sirkuit UGC dimulai: ${track.name} (3 Rival AI)`,
    };
    emitChange();
    return session;
  },

  pushCoopEventToast: (evt: NetCoopEvent) => {
    const labelMap: Record<NetCoopEvent['type'], string> = {
      horn: `${evt.displayName} membunyikan klakson di dekatmu!`,
      weapon_fire: `${evt.displayName} sedang baku tembak!`,
      explosion: `Ledakan besar dipicu oleh ${evt.displayName}!`,
      wanted_alert: `${evt.displayName} memicu kejaran Polisi ★${evt.wantedLevel || 1}!`,
      passenger_ping: `${evt.displayName} mengajak mabar satu mobil/lokasi!`,
    };
    state = {
      ...state,
      lastCoopEventToast: evt,
      lastOutcomeText: evt.detail || labelMap[evt.type],
    };
    emitChange();
  },

  collectHiddenPackage: (packageId: string): boolean => {
    const res = collectNusantaraPackage(state.playerState, packageId);
    if (!res.collected) return false;
    soundEngine.playVictoryFanfare();
    const nextClout = computeViralCloutState(
      state.viralClout.xp + (res.allCompleted ? 180 : 45)
    );
    state = {
      ...state,
      playerState: res.nextState,
      viralClout: nextClout,
      lastOutcomeText: res.allCompleted
        ? `SELURUH 10 KOPER EMAS NUSANTARA TERKUMPUL! Bonus +Rp ${res.rewardRp.toLocaleString('id-ID')}!`
        : `Koper Emas Nusantara (${res.totalCollected}/10) ditemukan! +Rp ${res.rewardRp.toLocaleString('id-ID')}`,
    };
    emitChange();
    return true;
  },

  registerCombatCombo: (nowMs: number = Date.now()) => {
    const prev = state.combatCombo;
    const evalRes = resolveCombatComboState(
      prev?.count ?? 0,
      prev?.lastKoMs ?? 0,
      nowMs
    );
    const scoreGain = evalRes.comboCount >= 2 ? evalRes.comboCount * 45 : 0;
    const nextScore = state.playerState.score + scoreGain;
    state = {
      ...state,
      playerState: {
        ...state.playerState,
        rupiah: state.playerState.rupiah + evalRes.bonusRp,
        hp: Math.min(state.playerState.maxHp, state.playerState.hp + evalRes.healGain),
        fokusEnergy: Math.min(100, state.playerState.fokusEnergy + evalRes.focusGain),
        score: nextScore,
        bestScore: Math.max(state.playerState.bestScore, nextScore),
      },
      combatCombo: {
        count: evalRes.comboCount,
        label: evalRes.tierLabel,
        multiplier: evalRes.multiplier,
        bonusRp: evalRes.bonusRp,
        lastKoMs: nowMs,
      },
    };
    emitChange();
    return evalRes;
  },

  clearExpiredCombatCombo: (nowMs: number = Date.now()) => {
    if (
      state.combatCombo &&
      nowMs - state.combatCombo.lastKoMs > COMBAT_COMBO_WINDOW_MS
    ) {
      state = { ...state, combatCombo: null };
      emitChange();
    }
    if (
      state.nearMissBanner &&
      nowMs - state.nearMissBanner.stamp > 2400
    ) {
      state = { ...state, nearMissBanner: null };
      emitChange();
    }
  },

  registerNearMiss: (rewardRp: number, focusGain: number, scoreDelta: number) => {
    const nowMs = Date.now();
    const nextScore = state.playerState.score + scoreDelta;
    state = {
      ...state,
      playerState: {
        ...state.playerState,
        rupiah: state.playerState.rupiah + rewardRp,
        fokusEnergy: Math.min(100, state.playerState.fokusEnergy + focusGain),
        score: nextScore,
        bestScore: Math.max(state.playerState.bestScore, nextScore),
      },
      nearMissBanner: {
        text: `SALIP TIPIS! +Rp ${rewardRp.toLocaleString('id-ID')} · +${focusGain} Fokus`,
        rewardRp,
        stamp: nowMs,
      },
    };
    emitChange();
  },

  respawnAtHospital: () => {
    const res = computeHospitalRespawnState(state.playerState);
    soundEngine.playPickup();
    state = {
      ...state,
      gameState: 'playing',
      playerState: res.nextState,
      ghostHp: res.nextState.maxHp,
      activeMission: null,
      activeChoice: null,
      activeQuestState: null,
      combatCombo: null,
      policeTactical: createInitialPoliceTacticalState(),
      lastOutcomeText: `Keluar RS Cipto Mangunkusumo · Biaya Medis -Rp ${res.billRp.toLocaleString('id-ID')}`,
    };
    emitChange();
    return res;
  },

  startQuest: (mission: StoryMission, choice: StoryChoiceOption) => {
    const quest = createActiveQuestState(mission, choice);
    state = {
      ...state,
      activeMission: mission,
      activeChoice: choice,
      activeQuestState: quest,
    };
    emitChange();
    return quest;
  },

  advanceQuestStage: (
    playerX: number,
    playerZ: number,
    wantedLevel: number,
    additionalProgress: number = 0
  ) => {
    if (!state.activeQuestState) return null;
    const res = stepQuestStageProgress(
      state.activeQuestState,
      playerX,
      playerZ,
      wantedLevel,
      additionalProgress
    );
    if (res.advancedStage || res.nextQuest.stageProgress !== state.activeQuestState.stageProgress) {
      state = {
        ...state,
        activeQuestState: res.nextQuest,
      };
      emitChange();
    }
    return res;
  },

  clearActiveQuest: () => {
    state = {
      ...state,
      activeMission: null,
      activeChoice: null,
      activeQuestState: null,
    };
    emitChange();
  },
};

export function useGameStore<T>(selector: (s: GameStoreSnapshot) => T): T {
  return useSyncExternalStore(
    gameStore.subscribe,
    () => selector(gameStore.getState()),
    () => selector(gameStore.getState())
  );
}



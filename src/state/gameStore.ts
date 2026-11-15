import { useSyncExternalStore } from 'react';
import {
  ActiveStreetContractState,
  AudioChannelVolumes,
  CashLedgerEntry,
  CombatHitFeedbackEvent,
  CustomWaypointState,
  CutsceneOverlayState,
  DistrictZone,
  EnterableInteriorSpec,
  GameSettings,
  GameState,
  GarageCameraPreset,
  GraphicsQualityTier,
  JAKARTA_DISTRICTS,
  NpcDynamicSideQuest,
  OriginArchetype,
  PhotoModeConfig,
  PlayerProgressState,
  ProtagonistId,
  RADIO_STATIONS,
  STORY_MISSIONS,
  SaveSlotId,
  StreetBountySpec,
  StreetContractKind,
  StoryChoiceOption,
  StoryMission,
  TrafficSignalPhase,
  VehicleType,
  WeaponId,
  WeatherMode,
  createInitialPlayerState,
} from '../game/rules';
import {
  DEFAULT_AUDIO_VOLUMES,
  DEFAULT_GAME_SETTINGS,
  SavedGameSnapshot,
  getActiveSaveSlot,
  loadSavedGame,
  setActiveSaveSlot,
} from '../game/save';
import { soundEngine } from '../game/sound';

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
  activeContract: ActiveStreetContractState | null;
  lastOutcomeText: string | null;
  phoneOpen: boolean;
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
  activeContract: null,
  lastOutcomeText: null,
  phoneOpen: false,
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
};

export function useGameStore<T>(selector: (s: GameStoreSnapshot) => T): T {
  return useSyncExternalStore(
    gameStore.subscribe,
    () => selector(gameStore.getState()),
    () => selector(gameStore.getState())
  );
}



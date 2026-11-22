import {
  AudioChannelVolumes,
  CustomRaceTrackSpec,
  GameSettings,
  GraphicsQualityTier,
  OriginArchetype,
  PlayerProgressState,
  SaveSlotId,
  WeatherMode,
  createInitialPlayerState,
} from './rules';

export const SAVE_VERSION = 3 as const;
export const SAVE_STORAGE_KEY = 'san_nabilo_save_v3';
export const SAVE_SLOT_2_KEY = 'san_nabilo_save_v3_slot2';
export const SAVE_SLOT_3_KEY = 'san_nabilo_save_v3_slot3';
export const ACTIVE_SAVE_SLOT_KEY = 'san_nabilo_active_save_slot';
export const V2_SAVE_STORAGE_KEY = 'san_nabilo_save_v2';
export const LEGACY_SAVE_STORAGE_KEY = 'san_nabilo_save_v1';

export interface SaveSlotSummary {
  slotId: SaveSlotId;
  exists: boolean;
  savedAt: number | null;
  origin: OriginArchetype | null;
  rupiah: number;
  completedMissionsCount: number;
  controlledDistrictsCount: number;
  snapshot: SavedGameSnapshot | null;
}

export const DEFAULT_AUDIO_VOLUMES: AudioChannelVolumes = {
  master: 1,
  sfx: 1,
  radio: 0.85,
  ambience: 0.9,
};

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  graphicsTier: 'auto',
  voiceActingEnabled: true,
  cinematicCameraEnabled: true,
  touchControlsMode: 'auto',
};

export interface SavedGameSnapshot {
  version: 3;
  origin: OriginArchetype;
  selectedStage: 1 | 2 | 3 | 4 | 5;
  weatherMode: WeatherMode;
  playerState: PlayerProgressState;
  playerPos: { x: number; z: number };
  audioSettings: AudioChannelVolumes;
  gameSettings: GameSettings;
  completedDynamicQuests: string[];
  stuntCompletedIds?: string[];
  speedTrapRecords?: Record<string, number>;
  sharedCoopRaces?: CustomRaceTrackSpec[];
  vigilanteStreak?: number;
  savedAt: number;
}

const VALID_ORIGINS: OriginArchetype[] = [
  'anak_jalanan',
  'mantan_kurir',
  'teknisi_glodok',
];

const VALID_WEATHERS: WeatherMode[] = ['senja', 'malam', 'siang', 'hujan'];

function clampCoord(n: unknown, fallback: number, maxBound: number = 236): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(-maxBound, Math.min(maxBound, n));
}

function clampUnitVolume(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

const VALID_TIERS: GraphicsQualityTier[] = [
  'auto',
  'performance',
  'balanced',
  'ultra',
];

/**
 * Validates and migrates a v1, v2, or v3 snapshot into the current v3 schema.
 */
export function migrateSavedGame(raw: unknown): SavedGameSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Omit<Partial<SavedGameSnapshot>, 'version'> & {
    version?: number;
    playerPos?: { x?: unknown; z?: unknown };
  };

  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3) {
    return null;
  }
  if (!parsed.playerState || typeof parsed.playerState !== 'object') return null;

  const origin: OriginArchetype = VALID_ORIGINS.includes(
    parsed.origin as OriginArchetype
  )
    ? (parsed.origin as OriginArchetype)
    : 'anak_jalanan';

  const rawStage = parsed.selectedStage;
  const selectedStage: 1 | 2 | 3 | 4 | 5 =
    rawStage === 1 ||
    rawStage === 2 ||
    rawStage === 3 ||
    rawStage === 4 ||
    rawStage === 5
      ? rawStage
      : 5;

  const weatherMode: WeatherMode = VALID_WEATHERS.includes(
    parsed.weatherMode as WeatherMode
  )
    ? (parsed.weatherMode as WeatherMode)
    : 'senja';

  const fallbackState = createInitialPlayerState(origin);
  const savedState = parsed.playerState as Partial<PlayerProgressState>;

  const mergedState: PlayerProgressState = {
    ...fallbackState,
    ...savedState,
    hp:
      typeof savedState.hp === 'number' && savedState.hp > 0
        ? Math.min(fallbackState.maxHp, savedState.hp)
        : fallbackState.maxHp,
    armor:
      typeof savedState.armor === 'number'
        ? Math.max(0, Math.min(fallbackState.maxArmor, savedState.armor))
        : fallbackState.armor,
    rupiah:
      typeof savedState.rupiah === 'number' && Number.isFinite(savedState.rupiah)
        ? Math.max(0, savedState.rupiah)
        : fallbackState.rupiah,
    reputation: {
      ...fallbackState.reputation,
      ...(savedState.reputation || {}),
    },
    ammo: {
      ...fallbackState.ammo,
      ...(savedState.ammo || {}),
    },
    protagonistRoster: {
      ...fallbackState.protagonistRoster,
      ...(savedState.protagonistRoster || {}),
    },
    vehicleCustoms: {
      ...fallbackState.vehicleCustoms,
      ...(savedState.vehicleCustoms || {}),
    },
    stockPortfolio: {
      ...fallbackState.stockPortfolio,
      ...(savedState.stockPortfolio || {}),
    },
    activeHeistPlan: {
      ...fallbackState.activeHeistPlan,
      ...(savedState.activeHeistPlan || {}),
    },
    completedMissions: Array.isArray(savedState.completedMissions)
      ? savedState.completedMissions
      : fallbackState.completedMissions,
    unlockedWeapons: Array.isArray(savedState.unlockedWeapons)
      ? savedState.unlockedWeapons
      : fallbackState.unlockedWeapons,
    ownedProperties: Array.isArray(savedState.ownedProperties)
      ? savedState.ownedProperties
      : fallbackState.ownedProperties,
    completedHeistSetups: Array.isArray(savedState.completedHeistSetups)
      ? savedState.completedHeistSetups
      : fallbackState.completedHeistSetups,
    completedHeists: Array.isArray(savedState.completedHeists)
      ? savedState.completedHeists
      : fallbackState.completedHeists,
    currentInterior: 'exterior',
    fokusActive: false,
    staminaBuffTimer:
      typeof savedState.staminaBuffTimer === 'number' &&
      Number.isFinite(savedState.staminaBuffTimer)
        ? Math.max(0, Math.min(180, savedState.staminaBuffTimer))
        : 0,
    lastSnackEaten:
      typeof savedState.lastSnackEaten === 'string'
        ? savedState.lastSnackEaten
        : null,
    characterSkills: {
      ...fallbackState.characterSkills,
      ...(savedState.characterSkills || {}),
    },
    weaponAttachments: {
      ...fallbackState.weaponAttachments,
      ...(savedState.weaponAttachments || {}),
    },
    districtTurf: {
      ...fallbackState.districtTurf,
      ...(savedState.districtTurf || {}),
    },
    unlockedSafehouses: Array.isArray(savedState.unlockedSafehouses)
      ? savedState.unlockedSafehouses.filter((s): s is string => typeof s === 'string')
      : fallbackState.unlockedSafehouses,
    ownedBusinesses: {
      ...(fallbackState.ownedBusinesses || {}),
      ...(savedState.ownedBusinesses || {}),
    },
    customRaceTracks: Array.isArray(savedState.customRaceTracks)
      ? savedState.customRaceTracks
      : fallbackState.customRaceTracks,
    collectedPackages: Array.isArray(savedState.collectedPackages)
      ? savedState.collectedPackages.filter((s): s is string => typeof s === 'string')
      : fallbackState.collectedPackages || [],
  };

  const maxCoordBound = parsed.version && parsed.version < 3 ? 88 : 236;
  const playerPos = {
    x: clampCoord(parsed.playerPos?.x, 0, maxCoordBound),
    z: clampCoord(parsed.playerPos?.z, 26, maxCoordBound),
  };

  const rawAudio = (parsed.audioSettings || {}) as Partial<AudioChannelVolumes>;
  const audioSettings: AudioChannelVolumes = {
    master: clampUnitVolume(rawAudio.master, DEFAULT_AUDIO_VOLUMES.master),
    sfx: clampUnitVolume(rawAudio.sfx, DEFAULT_AUDIO_VOLUMES.sfx),
    radio: clampUnitVolume(rawAudio.radio, DEFAULT_AUDIO_VOLUMES.radio),
    ambience: clampUnitVolume(rawAudio.ambience, DEFAULT_AUDIO_VOLUMES.ambience),
  };

  const rawSettings = (parsed.gameSettings || {}) as Partial<GameSettings>;
  const gameSettings: GameSettings = {
    graphicsTier: VALID_TIERS.includes(
      rawSettings.graphicsTier as GraphicsQualityTier
    )
      ? (rawSettings.graphicsTier as GraphicsQualityTier)
      : DEFAULT_GAME_SETTINGS.graphicsTier,
    voiceActingEnabled:
      typeof rawSettings.voiceActingEnabled === 'boolean'
        ? rawSettings.voiceActingEnabled
        : DEFAULT_GAME_SETTINGS.voiceActingEnabled,
    cinematicCameraEnabled:
      typeof rawSettings.cinematicCameraEnabled === 'boolean'
        ? rawSettings.cinematicCameraEnabled
        : DEFAULT_GAME_SETTINGS.cinematicCameraEnabled,
    touchControlsMode:
      rawSettings.touchControlsMode === 'auto' ||
      rawSettings.touchControlsMode === 'on' ||
      rawSettings.touchControlsMode === 'off'
        ? rawSettings.touchControlsMode
        : 'auto',
  };

  const completedDynamicQuests = Array.isArray(parsed.completedDynamicQuests)
    ? parsed.completedDynamicQuests.filter((q): q is string => typeof q === 'string')
    : [];

  const stuntCompletedIds = Array.isArray(parsed.stuntCompletedIds)
    ? parsed.stuntCompletedIds
        .filter((s): s is string => typeof s === 'string' && s.length > 0 && s.length <= 64)
        .slice(0, 32)
    : [];

  const speedTrapRecords: Record<string, number> = {};
  if (
    parsed.speedTrapRecords &&
    typeof parsed.speedTrapRecords === 'object' &&
    !Array.isArray(parsed.speedTrapRecords)
  ) {
    for (const [k, v] of Object.entries(parsed.speedTrapRecords).slice(0, 32)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 999) {
        speedTrapRecords[k.slice(0, 64)] = Math.round(v);
      }
    }
  }

  const sharedCoopRaces: CustomRaceTrackSpec[] = Array.isArray(
    parsed.sharedCoopRaces
  )
    ? parsed.sharedCoopRaces
        .filter(
          (t): t is CustomRaceTrackSpec =>
            Boolean(t) &&
            typeof t === 'object' &&
            typeof t.id === 'string' &&
            typeof t.name === 'string' &&
            Array.isArray(t.checkpoints) &&
            t.checkpoints.length >= 2 &&
            t.checkpoints.length <= 12
        )
        .slice(0, 16)
    : [];

  const vigilanteStreak =
    typeof parsed.vigilanteStreak === 'number' &&
    Number.isFinite(parsed.vigilanteStreak) &&
    parsed.vigilanteStreak >= 0
      ? Math.min(999, Math.floor(parsed.vigilanteStreak))
      : 0;

  return {
    version: SAVE_VERSION,
    origin,
    selectedStage,
    weatherMode,
    playerState: mergedState,
    playerPos,
    audioSettings,
    gameSettings,
    completedDynamicQuests,
    stuntCompletedIds,
    speedTrapRecords,
    sharedCoopRaces,
    vigilanteStreak,
    savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
  };
}

export function getSaveSlotStorageKey(slotId: SaveSlotId): string {
  if (slotId === 2) return SAVE_SLOT_2_KEY;
  if (slotId === 3) return SAVE_SLOT_3_KEY;
  return SAVE_STORAGE_KEY;
}

export function getActiveSaveSlot(): SaveSlotId {
  if (typeof window === 'undefined' || !window.localStorage) return 1;
  try {
    const raw = window.localStorage.getItem(ACTIVE_SAVE_SLOT_KEY);
    if (raw === '2') return 2;
    if (raw === '3') return 3;
    return 1;
  } catch {
    return 1;
  }
}

export function setActiveSaveSlot(slotId: SaveSlotId): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(ACTIVE_SAVE_SLOT_KEY, String(slotId));
  } catch {
    // Ignore storage errors
  }
}

export function loadSavedGame(slotId?: SaveSlotId): SavedGameSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const targetSlot = slotId ?? getActiveSaveSlot();
  const slotKey = getSaveSlotStorageKey(targetSlot);
  try {
    const rawV3 = window.localStorage.getItem(slotKey);
    if (rawV3) {
      return migrateSavedGame(JSON.parse(rawV3));
    }
    if (targetSlot === 1) {
      const rawV2 = window.localStorage.getItem(V2_SAVE_STORAGE_KEY);
      if (rawV2) {
        const migrated = migrateSavedGame(JSON.parse(rawV2));
        if (migrated) saveGameSnapshot(migrated, 1);
        return migrated;
      }
      const rawV1 = window.localStorage.getItem(LEGACY_SAVE_STORAGE_KEY);
      if (rawV1) {
        const migrated = migrateSavedGame(JSON.parse(rawV1));
        if (migrated) {
          saveGameSnapshot(migrated, 1);
        }
        return migrated;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function saveGameSnapshot(
  snapshot: SavedGameSnapshot,
  slotId?: SaveSlotId
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const targetSlot = slotId ?? getActiveSaveSlot();
  const slotKey = getSaveSlotStorageKey(targetSlot);
  try {
    window.localStorage.setItem(slotKey, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function clearSavedGame(slotId?: SaveSlotId): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const targetSlot = slotId ?? getActiveSaveSlot();
  const slotKey = getSaveSlotStorageKey(targetSlot);
  try {
    window.localStorage.removeItem(slotKey);
    if (targetSlot === 1) {
      window.localStorage.removeItem(V2_SAVE_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_SAVE_STORAGE_KEY);
    }
  } catch {
    // Ignore errors
  }
}

export function listSaveSlotSummaries(): SaveSlotSummary[] {
  const slots: SaveSlotId[] = [1, 2, 3];
  return slots.map((slotId) => {
    const snap = loadSavedGame(slotId);
    if (!snap) {
      return {
        slotId,
        exists: false,
        savedAt: null,
        origin: null,
        rupiah: 0,
        completedMissionsCount: 0,
        controlledDistrictsCount: 0,
        snapshot: null,
      };
    }
    const turf = snap.playerState.districtTurf || {};
    const controlledDistrictsCount = Object.values(turf).filter(
      (t) => t && t.owner === 'player'
    ).length;
    return {
      slotId,
      exists: true,
      savedAt: snap.savedAt,
      origin: snap.origin,
      rupiah: snap.playerState.rupiah,
      completedMissionsCount: snap.playerState.completedMissions.length,
      controlledDistrictsCount,
      snapshot: snap,
    };
  });
}

export function exportSavedGameJson(
  slotOrSnapshot?: SaveSlotId | SavedGameSnapshot
): string {
  if (typeof slotOrSnapshot === 'object' && slotOrSnapshot !== null) {
    return JSON.stringify(slotOrSnapshot, null, 2);
  }
  const snap = loadSavedGame(slotOrSnapshot);
  if (!snap) return '';
  return JSON.stringify(snap, null, 2);
}

export function parseImportedSaveJson(rawJson: string): SavedGameSnapshot | null {
  try {
    const parsed = JSON.parse(rawJson);
    return migrateSavedGame(parsed);
  } catch {
    return null;
  }
}

export const PLAYER_TOKEN_STORAGE_KEY = 'san_nabilo_player_token_v1';

function generatePlayerUuidToken(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `plr_${crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  }
  const randomPart = () =>
    Math.floor((1 + Math.random()) * 0x100000000)
      .toString(16)
      .slice(1);
  return `plr_${Date.now().toString(36)}_${randomPart()}${randomPart()}`;
}

export function getOrCreatePlayerToken(): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'plr_ssr_fallback_token_v3';
  }
  try {
    const existing = window.localStorage.getItem(PLAYER_TOKEN_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing.trim())) {
      return existing.trim();
    }
    const created = generatePlayerUuidToken();
    window.localStorage.setItem(PLAYER_TOKEN_STORAGE_KEY, created);
    return created;
  } catch {
    return generatePlayerUuidToken();
  }
}

export async function syncSaveToCloud(
  slotId: SaveSlotId,
  snapshot?: SavedGameSnapshot | null
): Promise<boolean> {
  const payload = snapshot ?? loadSavedGame(slotId);
  if (!payload || typeof fetch !== 'function') return false;
  try {
    const playerToken = getOrCreatePlayerToken();
    const res = await fetch(`/api/saves/${slotId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': playerToken,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { snapshot?: SavedGameSnapshot };
    if (data?.snapshot) {
      saveGameSnapshot(data.snapshot, slotId);
    }
    return true;
  } catch {
    return false;
  }
}

export async function fetchSaveFromCloud(
  slotId: SaveSlotId
): Promise<SavedGameSnapshot | null> {
  if (typeof fetch !== 'function') return null;
  try {
    const playerToken = getOrCreatePlayerToken();
    const res = await fetch(`/api/saves/${slotId}`, {
      headers: {
        'X-Player-Token': playerToken,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      exists?: boolean;
      snapshot?: unknown;
    };
    if (!data?.exists || !data.snapshot) return null;
    const migrated = migrateSavedGame(data.snapshot);
    if (migrated) {
      saveGameSnapshot(migrated, slotId);
    }
    return migrated;
  } catch {
    return null;
  }
}




import {
  AudioChannelVolumes,
  OriginArchetype,
  PlayerProgressState,
  WeatherMode,
  createInitialPlayerState,
} from './rules';

export const SAVE_VERSION = 2 as const;
export const SAVE_STORAGE_KEY = 'san_nabilo_save_v2';
export const LEGACY_SAVE_STORAGE_KEY = 'san_nabilo_save_v1';

export const DEFAULT_AUDIO_VOLUMES: AudioChannelVolumes = {
  master: 1,
  sfx: 1,
  radio: 0.85,
  ambience: 0.9,
};

export interface SavedGameSnapshot {
  version: 2;
  origin: OriginArchetype;
  selectedStage: 1 | 2 | 3 | 4 | 5;
  weatherMode: WeatherMode;
  playerState: PlayerProgressState;
  playerPos: { x: number; z: number };
  audioSettings: AudioChannelVolumes;
  completedDynamicQuests: string[];
  savedAt: number;
}

const VALID_ORIGINS: OriginArchetype[] = [
  'anak_jalanan',
  'mantan_kurir',
  'teknisi_glodok',
];

const VALID_WEATHERS: WeatherMode[] = ['senja', 'malam', 'siang', 'hujan'];

function clampCoord(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(-88, Math.min(88, n));
}

function clampUnitVolume(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

/**
 * Validates and migrates a v1 or v2 snapshot into the current v2 schema.
 */
export function migrateSavedGame(raw: unknown): SavedGameSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Omit<Partial<SavedGameSnapshot>, 'version'> & {
    version?: number;
    playerPos?: { x?: unknown; z?: unknown };
  };

  if (parsed.version !== 1 && parsed.version !== 2) return null;
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
  };

  const playerPos = {
    x: clampCoord(parsed.playerPos?.x, 0),
    z: clampCoord(parsed.playerPos?.z, 26),
  };

  const rawAudio = (parsed.audioSettings || {}) as Partial<AudioChannelVolumes>;
  const audioSettings: AudioChannelVolumes = {
    master: clampUnitVolume(rawAudio.master, DEFAULT_AUDIO_VOLUMES.master),
    sfx: clampUnitVolume(rawAudio.sfx, DEFAULT_AUDIO_VOLUMES.sfx),
    radio: clampUnitVolume(rawAudio.radio, DEFAULT_AUDIO_VOLUMES.radio),
    ambience: clampUnitVolume(rawAudio.ambience, DEFAULT_AUDIO_VOLUMES.ambience),
  };

  const completedDynamicQuests = Array.isArray(parsed.completedDynamicQuests)
    ? parsed.completedDynamicQuests.filter((q): q is string => typeof q === 'string')
    : [];

  return {
    version: SAVE_VERSION,
    origin,
    selectedStage,
    weatherMode,
    playerState: mergedState,
    playerPos,
    audioSettings,
    completedDynamicQuests,
    savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
  };
}

export function loadSavedGame(): SavedGameSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const rawV2 = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (rawV2) {
      return migrateSavedGame(JSON.parse(rawV2));
    }
    const rawV1 = window.localStorage.getItem(LEGACY_SAVE_STORAGE_KEY);
    if (rawV1) {
      const migrated = migrateSavedGame(JSON.parse(rawV1));
      if (migrated) {
        saveGameSnapshot(migrated);
      }
      return migrated;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveGameSnapshot(snapshot: SavedGameSnapshot): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export function clearSavedGame(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(SAVE_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_SAVE_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

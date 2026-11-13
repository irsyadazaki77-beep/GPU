import {
  OriginArchetype,
  PlayerProgressState,
  WeatherMode,
  createInitialPlayerState,
} from './rules';

export const SAVE_STORAGE_KEY = 'san_nabilo_save_v1';

export interface SavedGameSnapshot {
  version: 1;
  origin: OriginArchetype;
  selectedStage: 1 | 2 | 3 | 4 | 5;
  weatherMode: WeatherMode;
  playerState: PlayerProgressState;
  playerPos: { x: number; z: number };
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

export function loadSavedGame(): SavedGameSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedGameSnapshot> | null;
    if (!parsed || parsed.version !== 1 || !parsed.playerState) return null;

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
        typeof savedState.rupiah === 'number' &&
        Number.isFinite(savedState.rupiah)
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
    };

    const playerPos = {
      x: clampCoord(parsed.playerPos?.x, 0),
      z: clampCoord(parsed.playerPos?.z, 26),
    };

    return {
      version: 1,
      origin,
      selectedStage,
      weatherMode,
      playerState: mergedState,
      playerPos,
      savedAt:
        typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
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
  } catch {
    // Ignore errors
  }
}

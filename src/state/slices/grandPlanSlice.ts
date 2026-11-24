import {
  PROTAGONIST_PROFILES,
  createVigilantePatrolSession,
} from '../../game/rules';
import type {
  ActiveRivalBossState,
  CommunityUgcTrack,
  CustomWaypointState,
  GlobalLeaderboardEntry,
  MultiplayerLobbyState,
  PlayerProgressState,
  RaceRecordEntry,
  SpeedTrapFlashBanner,
  TacticalGadgetKind,
  TurfRaidEvent,
  VigilantePatrolSession,
} from '../../game/types';

export interface GrandPlanSliceState {
  droneReconActive: boolean;
  droneEmpReady: boolean;
  slipstreamActive: boolean;
  speedTrapRecords: Record<string, number>;
  speedTrapBanner: SpeedTrapFlashBanner | null;
  activeVigilante: VigilantePatrolSession | null;
  vigilanteStreak: number;
  activeRivalBoss: ActiveRivalBossState | null;
  // Grand Plan 7.0 & 8.0 Social Hub, Lobby Sync & Heist 3D Security
  globalLeaderboard: GlobalLeaderboardEntry[];
  communityUgcTracks: CommunityUgcTrack[];
  socialHubLoading: boolean;
  sabotagedHeistCctvIds: string[];
  multiplayerLobby: MultiplayerLobbyState | null;
  // Grand Plan 9.0: Fuel/SPBU, Tactical Throwables, Patwal Siren, Turf Raids & Race Records
  vehicleFuelPct: number;
  nearbySpbuName: string | null;
  destroyedSpbuIds: string[];
  activeGadgetKind: TacticalGadgetKind;
  smokeGrenades: number;
  molotovs: number;
  inSmokeScreen: boolean;
  patwalSirenActive: boolean;
  activeTurfRaid: TurfRaidEvent | null;
  highStakesRaceMode: boolean;
  raceBestTimes: Record<string, RaceRecordEntry>;
}

export function createInitialGrandPlanSliceState(initialSave?: {
  speedTrapRecords?: Record<string, number>;
  vigilanteStreak?: number;
} | null): GrandPlanSliceState {
  return {
    droneReconActive: false,
    droneEmpReady: true,
    slipstreamActive: false,
    speedTrapRecords: initialSave?.speedTrapRecords || {},
    speedTrapBanner: null,
    activeVigilante: null,
    vigilanteStreak: initialSave?.vigilanteStreak ?? 0,
    activeRivalBoss: null,
    globalLeaderboard: [],
    communityUgcTracks: [],
    socialHubLoading: false,
    sabotagedHeistCctvIds: [],
    multiplayerLobby: null,
    vehicleFuelPct: 100,
    nearbySpbuName: null,
    destroyedSpbuIds: [],
    activeGadgetKind: 'smoke_grenade',
    smokeGrenades: 3,
    molotovs: 2,
    inSmokeScreen: false,
    patwalSirenActive: false,
    activeTurfRaid: null,
    highStakesRaceMode: false,
    raceBestTimes: {},
  };
}

export function reduceSpeedTrapTrigger(
  state: {
    speedTrapRecords: Record<string, number>;
    playerState: PlayerProgressState;
  },
  banner: SpeedTrapFlashBanner
): {
  speedTrapRecords: Record<string, number>;
  speedTrapBanner: SpeedTrapFlashBanner;
  playerState: PlayerProgressState;
  leaderboardPayload: {
    category: 'etle_speed';
    targetId: string;
    targetName: string;
    playerName: string;
    protagonistId: PlayerProgressState['activeProtagonist'];
    scoreValue: number;
    metricLabel: string;
  } | null;
} {
  const prevBest = state.speedTrapRecords[banner.trapId] ?? 0;
  const nextBest = Math.max(prevBest, banner.speedKmh);
  const nextScore = state.playerState.score + Math.round(banner.speedKmh * 2);
  const nextPlayerState: PlayerProgressState = {
    ...state.playerState,
    rupiah: state.playerState.rupiah + banner.rewardRp,
    wantedLevel: banner.wantedTriggered
      ? Math.max(1, state.playerState.wantedLevel)
      : state.playerState.wantedLevel,
    score: nextScore,
    bestScore: Math.max(state.playerState.bestScore, nextScore),
  };

  return {
    speedTrapRecords: {
      ...state.speedTrapRecords,
      [banner.trapId]: nextBest,
    },
    speedTrapBanner: banner,
    playerState: nextPlayerState,
    leaderboardPayload: banner.isNewRecord
      ? {
          category: 'etle_speed',
          targetId: banner.trapId,
          targetName: banner.trapName,
          playerName: PROTAGONIST_PROFILES[state.playerState.activeProtagonist].name,
          protagonistId: state.playerState.activeProtagonist,
          scoreValue: banner.speedKmh,
          metricLabel: `${banner.speedKmh} km/jam`,
        }
      : null,
  };
}

export function reduceStartVigilante(vigilanteStreak: number): {
  activeVigilante: VigilantePatrolSession;
  customWaypoint: CustomWaypointState;
  lastOutcomeText: string;
} {
  const session = createVigilantePatrolSession(vigilanteStreak);
  return {
    activeVigilante: session,
    customWaypoint: {
      x: session.targetX,
      z: session.targetZ,
      label: `Buronan: ${session.targetName}`,
      category: 'custom',
    },
    lastOutcomeText: `Patroli Patwal Aktif: Kejar ${session.targetName} di ${session.districtName}!`,
  };
}

export function reduceCompleteVigilante(
  vig: VigilantePatrolSession,
  vigilanteStreak: number,
  playerState: PlayerProgressState
): {
  activeVigilante: null;
  vigilanteStreak: number;
  customWaypoint: null;
  playerState: PlayerProgressState;
  lastOutcomeText: string;
} {
  const nextScore = playerState.score + 450;
  return {
    activeVigilante: null,
    vigilanteStreak: vigilanteStreak + 1,
    customWaypoint: null,
    playerState: {
      ...playerState,
      rupiah: playerState.rupiah + vig.rewardRp,
      reputation: {
        ...playerState.reputation,
        rakyat: playerState.reputation.rakyat + 6,
      },
      score: nextScore,
      bestScore: Math.max(playerState.bestScore, nextScore),
    },
    lastOutcomeText: `PATROLI TUNTAS! ${vig.targetName} dilumpuhkan (+Rp ${vig.rewardRp.toLocaleString('id-ID')})`,
  };
}

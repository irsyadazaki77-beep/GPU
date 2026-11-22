import React, { useCallback, useRef } from 'react';
import {
  EnterableInteriorSpec,
  GRAND_HEISTS,
  HeistId,
  InteriorZoneId,
  JAKARTA_DISTRICTS,
  OriginArchetype,
  OutfitId,
  PROTAGONIST_PROFILES,
  ProtagonistId,
  RadioStationId,
  STORY_MISSIONS,
  StockSymbol,
  StoryChoiceOption,
  StoryMission,
  WARUNG_SNACKS,
  WEAPONS,
  WarungServeQuality,
  WarungSnackId,
  WeaponId,
  WeatherMode,
  applyDamageToPlayer,
  applyStoryChoice,
  buyStockShares,
  calculateHeistBreakdown,
  calculatePassivePropertyIncome,
  calculateTurfWarsIncome,
  completeMissionReward,
  computeTrioSynergyPerks,
  consumeWarungSnack,
  formatRupiah,
  purchaseProperty,
  recruitCrewMember,
  resolveJakartaAmbientProfile,
  sellStockShares,
  stepWantedSystemCooldown,
  triggerStockMarketImpact,
  upgradeDroneTech,
  upgradeVehicleGarage,
  WANTED_TIER_SPECS,
} from './game/rules';
import {
  JakartaWorldCanvas,
  WorldControllerHandle,
} from './components/JakartaWorldCanvas';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { RadialWheelOverlay } from './components/RadialWheelOverlay';
import { CinematicOverlay } from './components/CinematicOverlay';
import { MobileTouchControls } from './components/MobileTouchControls';
import { WorldCalloutOverlay } from './components/WorldCalloutOverlay';

const StoryDialogueModal = React.lazy(() =>
  import('./components/StoryDialogueModal').then((m) => ({
    default: m.StoryDialogueModal,
  }))
);
const NabiloPhoneModal = React.lazy(() =>
  import('./components/NabiloPhoneModal').then((m) => ({
    default: m.NabiloPhoneModal,
  }))
);
const StatusModal = React.lazy(() =>
  import('./components/StatusModal').then((m) => ({
    default: m.StatusModal,
  }))
);
const HeistPlanningModal = React.lazy(() =>
  import('./components/HeistPlanningModal').then((m) => ({
    default: m.HeistPlanningModal,
  }))
);
const HeistBreachOverlay = React.lazy(() =>
  import('./components/HeistBreachOverlay').then((m) => ({
    default: m.HeistBreachOverlay,
  }))
);
const CustomsGarageModal = React.lazy(() =>
  import('./components/CustomsGarageModal').then((m) => ({
    default: m.CustomsGarageModal,
  }))
);
const WarungSnackModal = React.lazy(() =>
  import('./components/WarungSnackModal').then((m) => ({
    default: m.WarungSnackModal,
  }))
);
const PhotoModeOverlay = React.lazy(() =>
  import('./components/PhotoModeOverlay').then((m) => ({
    default: m.PhotoModeOverlay,
  }))
);
import { useGameKeyboardShortcuts } from './hooks/useGameKeyboardShortcuts';
import { useGameRuntimeLoops } from './hooks/useGameRuntimeLoops';
import { soundEngine } from './game/sound';
import { submitLeaderboardRecord } from './game/socialHubClient';
import { speakDialogueLine } from './game/voiceClient';
import {
  SAVE_VERSION,
  SavedGameSnapshot,
  loadSavedGame,
  saveGameSnapshot,
  syncSaveToCloud,
} from './game/save';
import {
  buildInitialStateForStage,
  gameStore,
  useGameStore,
} from './state/gameStore';

const WEATHER_ORDER: WeatherMode[] = ['senja', 'malam', 'siang', 'hujan'];
const WEATHER_PRESET_MINUTES: Record<WeatherMode, number> = {
  siang: 780, // 13:00 WIB Siang Cerah
  senja: 1050, // 17:30 WIB Senja Emas
  malam: 1320, // 22:00 WIB Malam Neon
  hujan: 960, // 16:00 WIB Hujan Deras
};

export default function App() {
  const gameState = useGameStore((s) => s.gameState);
  const origin = useGameStore((s) => s.origin);
  const selectedStage = useGameStore((s) => s.selectedStage);
  const weatherMode = useGameStore((s) => s.weatherMode);
  const outcomeMode = useGameStore((s) => s.outcomeMode);
  const playerState = useGameStore((s) => s.playerState);
  const ghostHp = useGameStore((s) => s.ghostHp);
  const endSnapshot = useGameStore((s) => s.endSnapshot);
  const district = useGameStore((s) => s.district);
  const drivingVehicle = useGameStore((s) => s.drivingVehicle);
  const vehicleSpeedKmh = useGameStore((s) => s.vehicleSpeedKmh);
  const aircraftAltitude = useGameStore((s) => s.aircraftAltitude);
  const isDrifting = useGameStore((s) => s.isDrifting);
  const nearbyVehicle = useGameStore((s) => s.nearbyVehicle);
  const nearbyMission = useGameStore((s) => s.nearbyMission);
  const nearbyInterior = useGameStore((s) => s.nearbyInterior);
  const objectiveProgress = useGameStore((s) => s.objectiveProgress);
  const skySwitchPhase = useGameStore((s) => s.skySwitchPhase);
  const dialogueMission = useGameStore((s) => s.dialogueMission);
  const activeMission = useGameStore((s) => s.activeMission);
  const activeChoice = useGameStore((s) => s.activeChoice);
  const lastOutcomeText = useGameStore((s) => s.lastOutcomeText);
  const phoneOpen = useGameStore((s) => s.phoneOpen);
  const wheelMode = useGameStore((s) => s.wheelMode);
  const heistBoardOpen = useGameStore((s) => s.heistBoardOpen);
  const customsGarageOpen = useGameStore((s) => s.customsGarageOpen);
  const warungModalOpen = useGameStore((s) => s.warungModalOpen);
  const photoModeOpen = useGameStore((s) => s.photoModeOpen);
  const tpsAiming = useGameStore((s) => s.tpsAiming);
  const muted = useGameStore((s) => s.muted);
  const ambientCycleStep = useGameStore((s) => s.ambientCycleStep);
  const savedGame = useGameStore((s) => s.savedGame);
  const gameSettings = useGameStore((s) => s.gameSettings);
  const combatHitEvents = useGameStore((s) => s.combatHitEvents);
  const playerHitFlash = useGameStore((s) => s.playerHitFlash);
  const cutsceneOverlay = useGameStore((s) => s.cutsceneOverlay);
  const activeHeistBreach = useGameStore((s) => s.activeHeistBreach);
  const trioSynergy = useGameStore((s) => s.trioSynergy);

  const controllerRef = useRef<WorldControllerHandle | null>(null);
  const cutsceneTimerRef = useRef<number | null>(null);

  const triggerCinematicShot = useCallback(
    (
      mode: 'briefing' | 'heist' | 'sky_switch',
      title: string,
      speakerName: string,
      subtitleText: string,
      focusX: number,
      focusZ: number,
      durationSec: number = 3.2
    ) => {
      const s = gameStore.getState();
      if (!s.gameSettings.cinematicCameraEnabled) return;
      if (cutsceneTimerRef.current !== null) {
        window.clearTimeout(cutsceneTimerRef.current);
      }
      controllerRef.current?.startCutsceneFraming(focusX, focusZ, durationSec);
      gameStore.setState({
        cutsceneOverlay: {
          active: true,
          mode,
          title,
          speakerName,
          subtitleText,
        },
      });
      cutsceneTimerRef.current = window.setTimeout(() => {
        gameStore.setState({ cutsceneOverlay: null });
        cutsceneTimerRef.current = null;
      }, durationSec * 1000);
    },
    []
  );

  // Save v3 persistence helper + runtime loops
  const persistCurrentSave = useCallback(() => {
    const cur = gameStore.getState();
    if (cur.playerState.hp <= 0) return;
    const pos = controllerRef.current?.getPlayerPosition() || { x: 0, z: 26 };
    const snapshot: SavedGameSnapshot = {
      version: SAVE_VERSION,
      origin: cur.origin,
      selectedStage: cur.selectedStage,
      weatherMode: cur.weatherMode,
      playerState: cur.playerState,
      playerPos: pos,
      audioSettings: cur.audioVolumes,
      gameSettings: cur.gameSettings,
      completedDynamicQuests: cur.completedDynamicQuests,
      stuntCompletedIds: cur.stuntCompletedIds,
      speedTrapRecords: cur.speedTrapRecords,
      sharedCoopRaces: cur.sharedCoopRaces,
      vigilanteStreak: cur.vigilanteStreak,
      saveAt: Date.now(),
      savedAt: Date.now(),
    } as SavedGameSnapshot;
    saveGameSnapshot(snapshot, cur.activeSaveSlot);
    gameStore.setState({ savedGame: snapshot });
    void syncSaveToCloud(cur.activeSaveSlot, snapshot).then((ok) => {
      if (ok) {
        gameStore.setState({
          cloudSyncStatus: `Slot ${cur.activeSaveSlot} Cloud v3 ✓`,
        });
      }
    });
  }, []);

  useGameRuntimeLoops(persistCurrentSave);

  const cycleWeather = useCallback(() => {
    gameStore.setState((prev) => {
      const idx = WEATHER_ORDER.indexOf(prev.weatherMode);
      const nextMode = WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
      return {
        weatherMode: nextMode,
        worldTimeMinutes: WEATHER_PRESET_MINUTES[nextMode],
      };
    });
    soundEngine.playPickup();
  }, []);

  const handleToggleFokus = useCallback(() => {
    gameStore.updatePlayerState((prev) => {
      if (prev.fokusActive) {
        soundEngine.playTone(320, 0.08, 'sine', 0.12);
        return { ...prev, fokusActive: false };
      }
      if (prev.fokusEnergy < 12) return prev;
      if (prev.activeProtagonist === 'raka') {
        soundEngine.playNitroBoost();
      } else {
        soundEngine.playPickup();
      }
      return { ...prev, fokusActive: true };
    });
  }, []);

  const handleToggleDrone = useCallback(() => {
    gameStore.updatePlayerState((prev) => {
      soundEngine.playPickup();
      if (prev.droneLevel <= 0) {
        return { ...prev, droneLevel: 1, droneActive: true };
      }
      return { ...prev, droneActive: !prev.droneActive };
    });
  }, []);

  const handleSwitchProtagonist = useCallback((targetId: ProtagonistId) => {
    const liveCoords = controllerRef.current?.getPlayerPosition() || {
      x: 0,
      z: 18,
    };
    gameStore.updatePlayerState((prev) => {
      if (prev.activeProtagonist === targetId) return prev;
      const currentId = prev.activeProtagonist;
      const targetLive = prev.protagonistRoster[targetId];
      const targetProfile = PROTAGONIST_PROFILES[targetId];

      controllerRef.current?.triggerSatelliteSwitch(
        targetId,
        targetLive.x,
        targetLive.z
      );

      return {
        ...prev,
        activeProtagonist: targetId,
        currentInterior: 'exterior',
        hp: targetLive.hp,
        armor: targetLive.armor,
        outfitId: targetProfile.defaultOutfitId,
        protagonistRoster: {
          ...prev.protagonistRoster,
          [currentId]: {
            ...prev.protagonistRoster[currentId],
            x: liveCoords.x,
            z: liveCoords.z,
            hp: prev.hp,
            armor: prev.armor,
          },
        },
      };
    });
  }, []);

  const handleContinueGame = useCallback(() => {
    const slot = gameStore.getState().activeSaveSlot;
    const latest = loadSavedGame(slot) || gameStore.getState().savedGame;
    if (!latest) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    soundEngine.setChannelVolumes(latest.audioSettings);
    document.body.dataset.state = 'playing';
    gameStore.setState({
      origin: latest.origin,
      selectedStage: latest.selectedStage,
      weatherMode: latest.weatherMode,
      playerState: latest.playerState,
      ghostHp: latest.playerState.hp,
      audioVolumes: latest.audioSettings,
      gameSettings: latest.gameSettings,
      completedDynamicQuests: latest.completedDynamicQuests,
      stuntCompletedIds: latest.stuntCompletedIds || [],
      speedTrapRecords: latest.speedTrapRecords || {},
      sharedCoopRaces: latest.sharedCoopRaces || [],
      vigilanteStreak: latest.vigilanteStreak ?? 0,
      activeMission: null,
      activeChoice: null,
      dialogueMission: null,
      phoneOpen: false,
      wheelMode: null,
      heistBoardOpen: false,
      customsGarageOpen: false,
      warungModalOpen: false,
      tpsAiming: false,
      cutsceneOverlay: null,
      gameState: 'playing',
    });
    requestAnimationFrame(() => {
      controllerRef.current?.restoreSavedPosition(
        latest.playerPos.x,
        latest.playerPos.z
      );
    });
  }, []);

  const startNewGame = useCallback(
    (chosenOrigin?: OriginArchetype, stage?: 1 | 2 | 3 | 4 | 5) => {
      const cur = gameStore.getState();
      const targetOrigin = chosenOrigin ?? cur.origin;
      const targetStage = stage ?? cur.selectedStage;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.body.dataset.state = 'playing';
      const fresh = buildInitialStateForStage(targetOrigin, targetStage);
      gameStore.setState({
        origin: targetOrigin,
        selectedStage: targetStage,
        playerState: fresh,
        ghostHp: fresh.hp,
        activeMission: null,
        activeChoice: null,
        dialogueMission: null,
        phoneOpen: false,
        wheelMode: null,
        heistBoardOpen: false,
        customsGarageOpen: false,
        warungModalOpen: false,
        tpsAiming: false,
        activeHeistBreach: null,
        activeRace: null,
        activeTurfWar: null,
        activeVigilante: null,
        activeRivalBoss: null,
        speedTrapBanner: null,
        sabotagedHeistCctvIds: [],
        stuntCompletedIds: [],
        speedTrapRecords: {},
        vigilanteStreak: 0,
        gameState: 'playing',
      });
      controllerRef.current?.resetWorldForNewRun();
    },
    []
  );

  const handleTriggerProtagonistAbility = useCallback(() => {
    controllerRef.current?.triggerProtagonistAbility();
  }, []);

  const handleTriggerHorn = useCallback(() => {
    controllerRef.current?.triggerHorn();
  }, []);

  useGameKeyboardShortcuts({
    onContinueGame: handleContinueGame,
    onStartNewGame: startNewGame,
    onCycleWeather: cycleWeather,
    onToggleFokus: handleToggleFokus,
    onToggleDrone: handleToggleDrone,
    onTriggerHorn: handleTriggerHorn,
    onTriggerProtagonistAbility: handleTriggerProtagonistAbility,
  });

  const handleSelectChoice = useCallback(
    (choice: StoryChoiceOption) => {
      const mission = gameStore.getState().dialogueMission;
      if (!mission) return;
      gameStore.setState((prev) => ({
        dialogueMission: null,
        activeMission: mission,
        activeChoice: { ...choice },
        playerState: applyStoryChoice(prev.playerState, choice),
      }));
      controllerRef.current?.startMissionObjective(mission, { ...choice });
      triggerCinematicShot(
        'briefing',
        mission.title,
        mission.giverName,
        choice.description,
        choice.targetX,
        choice.targetZ,
        2.8
      );
    },
    [triggerCinematicShot]
  );

  const handleLaunchHeistSetup = useCallback((heistId: HeistId) => {
    const heist =
      GRAND_HEISTS.find((h) => h.id === heistId) || GRAND_HEISTS[0];
    const setupMission: StoryMission = {
      id: `heist_setup:${heist.id}`,
      stageNumber: 5,
      chapterNumber: 90,
      title: `Setup Heist: ${heist.title}`,
      giverName: 'Kirana Larasati (Komando Siber)',
      giverRole: 'Perencana Taktis Grand Heist',
      locationName: heist.targetLocation,
      markerX: heist.vaultX,
      markerZ: heist.vaultZ,
      briefing: heist.setupDescription,
      choices: [],
    };
    const setupChoice: StoryChoiceOption = {
      id: `choice_setup_${heist.id}`,
      label: 'Amankan Peralatan Setup Heist',
      faction: 'sindikat',
      description: heist.setupDescription,
      objectiveType: 'checkpoint_drive',
      targetX: heist.vaultX,
      targetZ: heist.vaultZ,
      objectiveTargetCount: 1,
      rewardRp: 220000,
      reputationDelta: { rakyat: 4, jalanan: 6, sindikat: 8 },
      wantedDelta: 1,
      nextMissionId: 'm1_bayangan_monas',
      outcomeNarrative: `Peralatan taktis untuk ${heist.title} berhasil diamankan! Brankas siap dieksekusi dari Papan Heist [H].`,
    };
    gameStore.setState({
      activeMission: setupMission,
      activeChoice: setupChoice,
    });
    controllerRef.current?.startMissionObjective(setupMission, setupChoice);
    soundEngine.playMissionFanfare();
  }, []);

  const executeHeistGetawayFinale = useCallback(
    (heistId: HeistId, synergyMultiplier: number = 1) => {
      const heist =
        GRAND_HEISTS.find((h) => h.id === heistId) || GRAND_HEISTS[0];
      const plan = gameStore.getState().playerState.activeHeistPlan;
      const breakdown = calculateHeistBreakdown(
        heist.id,
        plan.hackerId,
        plan.driverId,
        plan.gunmanId
      );
      const netTakeRp = Math.round(breakdown.netPlayerTakeRp * synergyMultiplier);
      const isStealth = plan.approach === 'stealth_cyber';

      const finaleMission: StoryMission = {
        id: `heist_finale:${heist.id}`,
        stageNumber: 5,
        chapterNumber: 99,
        title: `GRAND HEIST: ${heist.title}`,
        giverName: 'Trio Protagonis Jakarta',
        giverRole: isStealth
          ? 'Operasi Siluman Siber'
          : 'Serbuan Taktis Lapis Baja',
        locationName: heist.targetLocation,
        markerX: heist.vaultX,
        markerZ: heist.vaultZ,
        briefing: isStealth ? heist.stealthDesc : heist.assaultDesc,
        choices: [],
      };

      const finaleChoice: StoryChoiceOption = {
        id: `choice_finale_${heist.id}`,
        label: isStealth ? 'Infiltrasi Siber Brankas' : 'Serbuan Penuh Brankas',
        faction: isStealth ? 'sindikat' : 'jalanan',
        description: isStealth
          ? `Brankas jebol! Bawa kabur hasil bersih ${formatRupiah(netTakeRp)} dari ${heist.targetLocation}!`
          : `Pintu brankas tembus! Gempur penjaga ${heist.targetLocation} dan rebut ${formatRupiah(netTakeRp)}!`,
        objectiveType: isStealth ? 'heist_escape' : 'combat_wave',
        targetX: isStealth ? heist.escapeX : heist.vaultX,
        targetZ: isStealth ? heist.escapeZ : heist.vaultZ,
        objectiveTargetCount: isStealth ? 2 : 5,
        rewardRp: netTakeRp,
        reputationDelta: { rakyat: 12, jalanan: 18, sindikat: 15 },
        wantedDelta: isStealth ? 2 : 4,
        nextMissionId: 'm1_bayangan_monas',
        outcomeNarrative: `GRAND HEIST SUKSES! Trio Jakarta membawa pulang ${formatRupiah(netTakeRp)}. Saham ${heist.victimStock} anjlok & saham ${heist.targetStockRival} meroket di Bursa BAJSA!`,
      };

      gameStore.closeHeistBreach();
      gameStore.boostTrioSynergy(
        10,
        'Pembobolan brankas sukses! Sinergi Trio Jakarta meningkat pesat!'
      );
      gameStore.setState((prev) => ({
        activeMission: finaleMission,
        activeChoice: finaleChoice,
        playerState: {
          ...prev.playerState,
          wantedLevel: Math.min(
            5,
            prev.playerState.wantedLevel + (isStealth ? 1 : 3)
          ),
        },
      }));
      controllerRef.current?.startMissionObjective(finaleMission, finaleChoice);
      controllerRef.current?.sendLobbyAction?.({
        action: 'heist_loot',
        lootDelta: netTakeRp,
      });
      const activeProto = gameStore.getState().playerState.activeProtagonist;
      void submitLeaderboardRecord({
        category: 'heist_score',
        targetId: heist.id,
        targetName: heist.title,
        playerName: PROTAGONIST_PROFILES[activeProto].name,
        protagonistId: activeProto,
        scoreValue: netTakeRp,
        metricLabel: formatRupiah(netTakeRp),
      });
      soundEngine.playMissionFanfare();
      triggerCinematicShot(
        'heist',
        finaleMission.title,
        'Trio Protagonis Jakarta',
        finaleChoice.description,
        finaleChoice.targetX,
        finaleChoice.targetZ,
        3.4
      );
      const curS = gameStore.getState();
      if (curS.gameSettings.voiceActingEnabled && !curS.muted) {
        void speakDialogueLine(
          {
            text: finaleChoice.description,
            speakerName: 'Kirana Larasati',
            tone: 'Operasi Rahasia Mendesak',
          },
          true,
          curS.audioVolumes.master
        );
      }
    },
    [triggerCinematicShot]
  );

  const handleLaunchHeistFinale = useCallback((heistId: HeistId) => {
    gameStore.startHeistBreach(heistId);
  }, []);

  const handleStartStreetRace = useCallback((raceId: string) => {
    controllerRef.current?.startStreetRace(raceId);
    soundEngine.playNitroBoost();
  }, []);

  const handleCompleteActiveObjective = useCallback(() => {
    const { activeMission: mission, activeChoice: choice } = gameStore.getState();
    if (!mission || !choice) return;

    gameStore.setState({
      lastOutcomeText: choice.outcomeNarrative,
      activeMission: null,
      activeChoice: null,
      activeQuestState: null,
    });

    if (mission.id.startsWith('heist_setup:')) {
      const heistId = mission.id.replace('heist_setup:', '') as HeistId;
      soundEngine.playMissionFanfare();
      gameStore.recordCashTransaction(mission.title, choice.rewardRp, 'heist');
      gameStore.updatePlayerState((prev) => ({
        ...prev,
        rupiah: prev.rupiah + choice.rewardRp,
        score: prev.score + 450,
        bestScore: Math.max(prev.bestScore, prev.score + 450),
        completedHeistSetups: prev.completedHeistSetups.includes(heistId)
          ? prev.completedHeistSetups
          : [...prev.completedHeistSetups, heistId],
      }));
      return;
    }

    if (mission.id.startsWith('heist_finale:')) {
      const heistId = mission.id.replace('heist_finale:', '') as HeistId;
      const heistSpec =
        GRAND_HEISTS.find((h) => h.id === heistId) || GRAND_HEISTS[0];
      soundEngine.playCashRegister();
      gameStore.recordCashTransaction(mission.title, choice.rewardRp, 'heist');
      gameStore.updatePlayerState((prev) => {
        const afterImpact = triggerStockMarketImpact(
          prev,
          heistSpec.victimStock,
          heistSpec.targetStockRival
        );
        const nextScore = afterImpact.score + 2500;
        return {
          ...afterImpact,
          rupiah: afterImpact.rupiah + choice.rewardRp,
          wantedLevel: 0,
          wantedEvadeTimer: 0,
          score: nextScore,
          bestScore: Math.max(afterImpact.bestScore, nextScore),
          completedHeists: afterImpact.completedHeists.includes(heistId)
            ? afterImpact.completedHeists
            : [...afterImpact.completedHeists, heistId],
        };
      });
      const heistSnap =
        controllerRef.current?.captureViralThumbnailDataUrl() || null;
      gameStore.publishViralEvent({
        triggerKind: 'heist_complete',
        snapshotDataUrl: heistSnap,
        summaryNote: `${heistSpec.title} sukses dibobol Trio Jakarta! Valuasi ${heistSpec.victimStock} langsung anjlok di BAJSA!`,
        cloutGain: 110,
      });
      return;
    }

    if (mission.id.startsWith('street_race:')) {
      soundEngine.playCashRegister();
      gameStore.recordCashTransaction(mission.title, choice.rewardRp, 'misi');
      gameStore.updatePlayerState((prev) => {
        const nextScore = prev.score + 800;
        return {
          ...prev,
          rupiah: prev.rupiah + choice.rewardRp,
          score: nextScore,
          bestScore: Math.max(prev.bestScore, nextScore),
        };
      });
      return;
    }

    gameStore.recordCashTransaction(mission.title, choice.rewardRp, 'misi');
    const updated = completeMissionReward(
      gameStore.getState().playerState,
      mission.id,
      choice
    );
    const stockAdjusted =
      choice.faction === 'sindikat'
        ? triggerStockMarketImpact(updated, 'BNBL', 'KMYR')
        : choice.faction === 'jalanan'
        ? triggerStockMarketImpact(updated, 'SCBD', 'GATO')
        : triggerStockMarketImpact(updated, 'HALM', 'PRIO');

    if (
      choice.nextMissionId === null ||
      stockAdjusted.completedMissions.length >= 15
    ) {
      document.body.dataset.state = 'gameover';
      gameStore.setState({
        playerState: stockAdjusted,
        endSnapshot: stockAdjusted,
        outcomeMode: 'victory',
        gameState: 'gameover',
      });
    } else {
      gameStore.setState({ playerState: stockAdjusted });
    }
  }, []);

  const handlePlayerDamage = useCallback((dmg: number) => {
    const { nextState, isDefeated } = applyDamageToPlayer(
      gameStore.getState().playerState,
      dmg
    );
    gameStore.setState({ playerState: nextState });
    if (isDefeated) {
      soundEngine.playDefeatSting();
      gameStore.setState({ endSnapshot: nextState, outcomeMode: 'defeat' });
      window.setTimeout(() => {
        document.body.dataset.state = 'gameover';
        gameStore.setState({ gameState: 'gameover' });
      }, 420);
    }
  }, []);

  const handleEnemyDefeated = useCallback(
    (rewardRp: number, scoreDelta: number) => {
      gameStore.updatePlayerState((prev) => {
        const nextScore = prev.score + scoreDelta;
        return {
          ...prev,
          rupiah: prev.rupiah + rewardRp,
          score: nextScore,
          bestScore: Math.max(prev.bestScore, nextScore),
        };
      });
    },
    []
  );

  const handleConsumeAmmo = useCallback((): boolean => {
    const prev = gameStore.getState().playerState;
    const w = prev.activeWeapon;
    const spec = WEAPONS[w];
    if (spec.isMelee) return true;
    const currentAmmo = prev.ammo[w] || 0;
    if (currentAmmo < spec.ammoCost) return false;
    gameStore.setState({
      playerState: {
        ...prev,
        ammo: { ...prev.ammo, [w]: currentAmmo - spec.ammoCost },
      },
    });
    return true;
  }, []);

  const handleBuyOrEquipWeapon = useCallback((wId: WeaponId) => {
    const spec = WEAPONS[wId];
    gameStore.updatePlayerState((prev) => {
      const unlocked = prev.unlockedWeapons.includes(wId);
      if (unlocked) {
        if (!spec.isMelee && prev.rupiah >= 40000) {
          soundEngine.playPickup();
          return {
            ...prev,
            rupiah: prev.rupiah - 40000,
            activeWeapon: wId,
            ammo: { ...prev.ammo, [wId]: spec.maxAmmo },
          };
        }
        return { ...prev, activeWeapon: wId };
      }
      if (prev.rupiah >= spec.price) {
        soundEngine.playPickup();
        return {
          ...prev,
          rupiah: prev.rupiah - spec.price,
          unlockedWeapons: [...prev.unlockedWeapons, wId],
          activeWeapon: wId,
          ammo: { ...prev.ammo, [wId]: spec.maxAmmo },
        };
      }
      return prev;
    });
  }, []);

  const handleBuyArmorOrMedkit = useCallback(
    (item: 'medkit' | 'armor' | 'bribe') => {
      gameStore.updatePlayerState((prev) => {
        if (item === 'medkit' && prev.rupiah >= 50000) {
          soundEngine.playPickup();
          return { ...prev, rupiah: prev.rupiah - 50000, hp: prev.maxHp };
        }
        if (item === 'armor' && prev.rupiah >= 100000) {
          soundEngine.playPickup();
          return { ...prev, rupiah: prev.rupiah - 100000, armor: prev.maxArmor };
        }
        if (item === 'bribe' && prev.rupiah >= 120000) {
          soundEngine.playPickup();
          return {
            ...prev,
            rupiah: prev.rupiah - 120000,
            wantedLevel: 0,
            wantedEvadeTimer: 0,
          };
        }
        return prev;
      });
    },
    []
  );

  const handleBuyProperty = useCallback((propId: string) => {
    gameStore.updatePlayerState((prev) => {
      const res = purchaseProperty(prev, propId);
      if (res.purchased) soundEngine.playMissionFanfare();
      return res.nextState;
    });
  }, []);

  const handleRecruitCrew = useCallback(() => {
    gameStore.updatePlayerState((prev) => {
      const res = recruitCrewMember(prev);
      if (res.recruited) soundEngine.playMissionFanfare();
      return res.nextState;
    });
  }, []);

  const handleChangeRadio = useCallback((station: RadioStationId) => {
    soundEngine.playPickup();
    gameStore.updatePlayerState((prev) => ({ ...prev, radioStation: station }));
  }, []);

  const handleChangeOutfit = useCallback((outfitId: OutfitId) => {
    soundEngine.playPickup();
    gameStore.updatePlayerState((prev) => ({ ...prev, outfitId }));
  }, []);

  const handleUpgradeVehicle = useCallback(() => {
    gameStore.updatePlayerState((prev) => {
      const res = upgradeVehicleGarage(prev);
      if (res.upgraded) soundEngine.playMissionFanfare();
      return res.nextState;
    });
  }, []);

  const handleUpgradeDrone = useCallback(() => {
    gameStore.updatePlayerState((prev) => {
      const res = upgradeDroneTech(prev);
      if (res.upgraded) soundEngine.playMissionFanfare();
      return res.nextState;
    });
  }, []);

  const handleFastTravel = useCallback((districtId: string) => {
    const target = JAKARTA_DISTRICTS.find((d) => d.id === districtId);
    if (!target) return;
    gameStore.setState((prev) => ({
      playerState: { ...prev.playerState, currentInterior: 'exterior' },
      lastOutcomeText: `Teleportasi MRT & Helipad berhasil menuju ${target.name}!`,
    }));
    controllerRef.current?.teleportPlayerTo(
      target.centerX + 8,
      target.centerZ + 10
    );
  }, []);

  const handleTeleportCoords = useCallback(
    (x: number, z: number, label: string) => {
      soundEngine.playPickup();
      gameStore.setState((prev) => ({
        playerState: { ...prev.playerState, currentInterior: 'exterior' },
        lastOutcomeText: `Teleportasi Taktis berhasil menuju ${label}!`,
      }));
      controllerRef.current?.teleportPlayerTo(x, z);
    },
    []
  );

  const handleCapturePhoto = useCallback((): string | undefined => {
    soundEngine.playPickup();
    return controllerRef.current?.captureSnapshotDataUrl() || undefined;
  }, []);

  const handleCompleteSideHustle = useCallback((rewardRp: number) => {
    soundEngine.playPickup();
    gameStore.recordCashTransaction('Kontrak Sampingan Jakarta', rewardRp, 'misi');
    gameStore.updatePlayerState((prev) => {
      const nextScore = prev.score + 120;
      return {
        ...prev,
        rupiah: prev.rupiah + rewardRp,
        score: nextScore,
        bestScore: Math.max(prev.bestScore, nextScore),
        reputation: {
          ...prev.reputation,
          rakyat: Math.min(100, prev.reputation.rakyat + 4),
          jalanan: Math.min(100, prev.reputation.jalanan + 3),
        },
      };
    });
  }, []);

  const handleBuyStock = useCallback((ticker: StockSymbol, shares: number) => {
    gameStore.updatePlayerState((prev) => {
      const res = buyStockShares(prev, ticker, shares);
      if (res.bought) soundEngine.playCashRegister();
      return res.nextState;
    });
  }, []);

  const handleSellStock = useCallback((ticker: StockSymbol, shares: number) => {
    gameStore.updatePlayerState((prev) => {
      const res = sellStockShares(prev, ticker, shares);
      if (res.sold) soundEngine.playCashRegister();
      return res.nextState;
    });
  }, []);

  const handleEnterOrExitInterior = useCallback(
    (target?: EnterableInteriorSpec | null) => {
      soundEngine.playPickup();
      const prev = gameStore.getState().playerState;
      if (prev.currentInterior !== 'exterior') {
        gameStore.setState({
          playerState: { ...prev, currentInterior: 'exterior' },
          warungModalOpen: false,
        });
        return;
      }
      if (!target) return;
      gameStore.setState({
        playerState: { ...prev, currentInterior: target.id },
        heistBoardOpen:
          target.id === 'heist_penthouse'
            ? true
            : gameStore.getState().heistBoardOpen,
        customsGarageOpen:
          target.id === 'customs_garage'
            ? true
            : gameStore.getState().customsGarageOpen,
        warungModalOpen:
          target.id === 'warung' ? true : gameStore.getState().warungModalOpen,
      });
    },
    []
  );

  const handleEnterInteriorById = useCallback((interiorId: InteriorZoneId) => {
    soundEngine.playPickup();
    gameStore.setState((prev) => ({
      playerState: { ...prev.playerState, currentInterior: interiorId },
      heistBoardOpen:
        interiorId === 'heist_penthouse' ? true : prev.heistBoardOpen,
      customsGarageOpen:
        interiorId === 'customs_garage' ? true : prev.customsGarageOpen,
      warungModalOpen: interiorId === 'warung' ? true : prev.warungModalOpen,
    }));
  }, []);

  const handleOpenWarung = useCallback(() => {
    soundEngine.playPickup();
    gameStore.setState((prev) => ({
      playerState: {
        ...prev.playerState,
        currentInterior: 'warung',
      },
      warungModalOpen: true,
      phoneOpen: false,
      wheelMode: null,
      heistBoardOpen: false,
      customsGarageOpen: false,
    }));
  }, []);

  const handleConsumeWarungSnack = useCallback(
    (snackId: WarungSnackId, quality: WarungServeQuality) => {
      const curState = gameStore.getState().playerState;
      const res = consumeWarungSnack(curState, snackId, quality);
      if (res.consumed) {
        soundEngine.playCashRegister();
        const snack = WARUNG_SNACKS.find((s) => s.id === snackId);
        gameStore.setState({
          playerState: res.nextState,
          lastOutcomeText: `Sajian Warung: ${snack?.name || 'Jajanan'} (+${res.hpRecovered} HP · +${res.staminaAddedSec}d Buff Stamina)`,
        });
      }
      return res;
    },
    []
  );

  const handleWantedEvadeUpdate = useCallback(
    (isEvading: boolean, dt: number, underOverpassCover: boolean = false) => {
      const storeSnap = gameStore.getState();
      const kiranaBlackout = Boolean(storeSnap.kiranaHackState?.active);
      gameStore.updatePlayerState((prev) => {
        if (prev.wantedLevel <= 0) return prev;
        const spec =
          WANTED_TIER_SPECS[
            Math.max(1, Math.min(5, prev.wantedLevel)) as 1 | 2 | 3 | 4 | 5
          ];
        const prevRem =
          prev.wantedEvadeTimer > 0
            ? prev.wantedEvadeTimer
            : spec.baseCooldownSeconds;
        const elapsedOutOfSight = Math.max(0, spec.baseCooldownSeconds - prevRem);
        const res = stepWantedSystemCooldown(
          prev.wantedLevel,
          elapsedOutOfSight,
          !isEvading,
          underOverpassCover,
          kiranaBlackout,
          dt
        );
        if (res.cleared) {
          soundEngine.playPickup();
        }
        const roundedRem = Math.ceil(res.remainingSeconds * 2) / 2;
        if (
          res.wantedLevel === prev.wantedLevel &&
          res.flashingCooldown === prev.wantedEvading &&
          Math.abs(roundedRem - prev.wantedEvadeTimer) < 0.45
        ) {
          return prev;
        }
        return {
          ...prev,
          wantedLevel: res.wantedLevel,
          wantedEvading: res.flashingCooldown,
          wantedEvadeTimer: res.flashingCooldown ? roundedRem : 0,
        };
      });
    },
    []
  );

  const handleSelectPaint = useCallback((paintId: string, price: number) => {
    gameStore.updatePlayerState((prev) => {
      if (prev.rupiah < price) return prev;
      soundEngine.playPickup();
      return {
        ...prev,
        rupiah: prev.rupiah - price,
        vehicleCustoms: { ...prev.vehicleCustoms, paintId },
      };
    });
  }, []);

  const handleSelectUnderglow = useCallback((glowId: string, price: number) => {
    gameStore.updatePlayerState((prev) => {
      if (prev.rupiah < price) return prev;
      soundEngine.playPickup();
      return {
        ...prev,
        rupiah: prev.rupiah - price,
        vehicleCustoms: { ...prev.vehicleCustoms, underglowId: glowId },
      };
    });
  }, []);

  const handleUpgradeArmorPlating = useCallback(() => {
    gameStore.updatePlayerState((prev) => {
      if (
        prev.vehicleCustoms.armorPlatingLevel >= 3 ||
        prev.rupiah < 200000
      ) {
        return prev;
      }
      soundEngine.playMissionFanfare();
      return {
        ...prev,
        rupiah: prev.rupiah - 200000,
        vehicleCustoms: {
          ...prev.vehicleCustoms,
          armorPlatingLevel: (prev.vehicleCustoms.armorPlatingLevel + 1) as
            | 0
            | 1
            | 2
            | 3,
        },
      };
    });
  }, []);

  const handleRepairAndClearWanted = useCallback(() => {
    const repaired = controllerRef.current?.repairCurrentVehicle() ?? false;
    gameStore.updatePlayerState((prev) => {
      if (prev.rupiah < 75000) return prev;
      soundEngine.playCashRegister();
      return {
        ...prev,
        rupiah: prev.rupiah - 75000,
        hp: prev.maxHp,
        armor: prev.maxArmor,
        wantedLevel: 0,
        wantedEvadeTimer: 0,
      };
    });
    if (repaired) {
      gameStore.setState({
        activeVehicleDamage: null,
        lastOutcomeText: 'Bengkel Blok M: Bodi mobil mulus 100%, ban baru & buronan bersih!',
      });
    }
  }, []);

  const handleCaptureViralSnap = useCallback(() => {
    const thumb = controllerRef.current?.captureViralThumbnailDataUrl() || null;
    gameStore.publishViralEvent({
      triggerKind: 'manual_snap',
      snapshotDataUrl: thumb,
      cloutGain: 35,
    });
  }, []);

  const handleInteriorQuickAction = useCallback(
    (
      action:
        | 'hangout'
        | 'save'
        | 'repair'
        | 'rest'
        | 'refill_ammo'
        | 'faction_boost'
    ) => {
      if (action === 'rest') {
        gameStore.restInSafehouse(6);
        persistCurrentSave();
      } else if (action === 'refill_ammo') {
        const cur = gameStore.getState().playerState;
        if (cur.rupiah < 25000) {
          gameStore.setState({
            lastOutcomeText: 'Dana minimal Rp 25.000 untuk paket amunisi Glodok.',
          });
          return;
        }
        soundEngine.playCashRegister();
        gameStore.updatePlayerState((prev) => ({
          ...prev,
          rupiah: prev.rupiah - 25000,
          ammo: {
            ...prev.ammo,
            pistol: 96,
            rifle: 180,
            mercon: 24,
            pasopati: 36,
            gatotkaca: 18,
          },
        }));
        gameStore.setState({
          lastOutcomeText: 'Amunisi taktis seluruh senjata diisi penuh di Glodok Tech Shop!',
        });
      } else if (action === 'faction_boost') {
        const interiorId = gameStore.getState().playerState.currentInterior;
        const targetFaction =
          interiorId === 'faction_hq_sindikat'
            ? 'sindikat'
            : interiorId === 'faction_hq_rakyat'
            ? 'rakyat'
            : 'jalanan';
        soundEngine.playPickup();
        gameStore.updatePlayerState((prev) => ({
          ...prev,
          reputation: {
            ...prev.reputation,
            [targetFaction]: Math.min(100, prev.reputation[targetFaction] + 6),
          },
        }));
        gameStore.boostTrioSynergy(
          6,
          `Briefing Markas Faksi (${targetFaction.toUpperCase()}): Reputasi +6 & Sinergi Trio +6%!`
        );
      } else if (action === 'hangout') {
        gameStore.updatePlayerState((prev) => ({
          ...prev,
          hp: Math.min(prev.maxHp, prev.hp + 35),
          fokusEnergy: Math.min(100, prev.fokusEnergy + 35),
        }));
        gameStore.boostTrioSynergy(
          8,
          'Nongkrong santai di dalam ruangan: HP pulih & Sinergi Trio +8%!'
        );
        const thumb = controllerRef.current?.captureViralThumbnailDataUrl() || null;
        gameStore.publishViralEvent({
          triggerKind: 'warung_viral',
          snapshotDataUrl: thumb,
          cloutGain: 25,
        });
      } else if (action === 'repair') {
        const ok = controllerRef.current?.repairCurrentVehicle() ?? false;
        gameStore.setState({
          activeVehicleDamage: null,
          lastOutcomeText: ok
            ? 'Kendaraan terdekat berhasil diservis ke kondisi 100%!'
            : 'Parkir kendaraan di dekat pintu untuk servis cepat.',
        });
      } else if (action === 'save') {
        persistCurrentSave();
        soundEngine.playPickup();
        gameStore.setState({
          lastOutcomeText: 'Progres permainan berhasil disimpan ke slot aktif & Cloud!',
        });
      }
    },
    [persistCurrentSave]
  );

  const passiveIncome =
    calculatePassivePropertyIncome(playerState.ownedProperties) +
    calculateTurfWarsIncome(playerState);
  const activeAmbientProfile = resolveJakartaAmbientProfile(
    district.id,
    weatherMode,
    ambientCycleStep
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0b0d12] select-none">
      {/* Persistent 3D Jakarta Open World Canvas */}
      <JakartaWorldCanvas
        gameState={gameState}
        playerState={playerState}
        weatherMode={weatherMode}
        activeMission={activeMission}
        activeChoice={activeChoice}
        wheelSlowMo={wheelMode !== null}
        customsShowcaseOpen={customsGarageOpen}
        tpsAiming={tpsAiming}
        gameSettings={gameSettings}
        controllerRef={controllerRef}
        onUpdateHud={(payload) => {
          const cur = gameStore.getState();
          const changed =
            cur.district.id !== payload.district.id ||
            cur.drivingVehicle !== payload.drivingVehicle ||
            cur.vehicleSpeedKmh !== payload.vehicleSpeedKmh ||
            cur.aircraftAltitude !== payload.aircraftAltitude ||
            cur.isDrifting !== payload.isDrifting ||
            cur.trafficSignalPhase !== payload.trafficSignalPhase ||
            cur.nearbyVehicle !== payload.nearbyVehicle ||
            cur.nearbyMission?.id !== payload.nearbyMission?.id ||
            cur.nearbyInterior?.id !== payload.nearbyInterior?.id ||
            cur.objectiveProgress !== payload.objectiveProgress ||
            cur.skySwitchPhase?.stage !== payload.skySwitchPhase?.stage ||
            cur.skySwitchPhase?.active !== payload.skySwitchPhase?.active;
          if (changed) {
            gameStore.setState(payload);
          }
        }}
        onGraphicsTierResolved={(tier) => {
          if (gameStore.getState().resolvedGraphicsTier !== tier) {
            gameStore.setState({ resolvedGraphicsTier: tier });
          }
        }}
        onCombatHitFeedback={gameStore.pushCombatHitEvent}
        onPlayerHitAngle={gameStore.triggerPlayerHitFlash}
        onPlayerDamage={handlePlayerDamage}
        onEnemyDefeated={handleEnemyDefeated}
        onConsumeAmmo={handleConsumeAmmo}
        onOpenMissionDialog={(mission) => {
          gameStore.setState({ dialogueMission: mission });
          if (gameStore.getState().gameSettings.cinematicCameraEnabled) {
            controllerRef.current?.startCutsceneFraming(
              mission.markerX,
              mission.markerZ,
              3.0
            );
          }
        }}
        onCompleteActiveObjective={handleCompleteActiveObjective}
        onToggleTpsAim={() =>
          gameStore.setState((prev) => ({ tpsAiming: !prev.tpsAiming }))
        }
        onEnterOrExitInterior={handleEnterOrExitInterior}
        onWantedEvadeUpdate={handleWantedEvadeUpdate}
      />

      {/* STATE 1: TITLE SCREEN */}
      {gameState === 'title' && (
        <TitleScreen
          selectedOrigin={origin}
          selectedStage={selectedStage}
          savedGame={savedGame}
          onSelectOrigin={(o) =>
            gameStore.setState({
              origin: o,
              playerState: buildInitialStateForStage(o, selectedStage),
            })
          }
          onSelectStage={(s) =>
            gameStore.setState({
              selectedStage: s,
              playerState: buildInitialStateForStage(origin, s),
            })
          }
          onContinueGame={handleContinueGame}
          onStartGame={(e) => {
            e.currentTarget.blur();
            startNewGame(origin, selectedStage);
          }}
        />
      )}

      {/* STATE 2: PLAYING HUD */}
      {gameState === 'playing' && !photoModeOpen && (
        <GameHud
          playerState={playerState}
          ghostHp={ghostHp}
          district={district}
          drivingVehicle={drivingVehicle}
          vehicleSpeedKmh={vehicleSpeedKmh}
          aircraftAltitude={aircraftAltitude}
          isDrifting={isDrifting}
          combatHitEvents={combatHitEvents}
          playerHitFlash={playerHitFlash}
          nearbyVehicle={nearbyVehicle}
          nearbyMission={nearbyMission}
          nearbyInterior={nearbyInterior}
          activeMission={activeMission}
          activeChoice={activeChoice}
          objectiveProgress={objectiveProgress}
          weatherMode={weatherMode}
          ambientCueLabel={activeAmbientProfile.activeCueLabel}
          passiveIncome={passiveIncome}
          muted={muted}
          tpsAiming={tpsAiming}
          lastOutcomeText={lastOutcomeText}
          skySwitchPhase={skySwitchPhase}
          onSelectWeapon={(w) =>
            gameStore.updatePlayerState((prev) => ({ ...prev, activeWeapon: w }))
          }
          onTogglePhone={() =>
            gameStore.setState((prev) => ({
              phoneOpen: !prev.phoneOpen,
              phoneTargetScreen: 'home',
            }))
          }
          onOpenNabiloGram={() =>
            gameStore.setState({
              phoneTargetScreen: 'feed',
              phoneOpen: true,
              wheelMode: null,
              heistBoardOpen: false,
              customsGarageOpen: false,
              warungModalOpen: false,
            })
          }
          onOpenImperium={() =>
            gameStore.setState({
              phoneTargetScreen: 'imperium',
              phoneOpen: true,
              wheelMode: null,
              heistBoardOpen: false,
              customsGarageOpen: false,
              warungModalOpen: false,
            })
          }
          onCycleCamera={() => controllerRef.current?.cycleCameraViewMode()}
          onToggleCover={() => controllerRef.current?.toggleCover()}
          onSquadOrder={(ord) => controllerRef.current?.setSquadOrder(ord)}
          onCancelStreetRace={() => controllerRef.current?.cancelStreetRace()}
          onAbortTurfWar={() => controllerRef.current?.abortTurfWar()}
          onMultiplayerLobbyAction={(action) =>
            controllerRef.current?.sendLobbyAction?.({ action })
          }
          onRepairVehicle={() => {
            controllerRef.current?.repairCurrentVehicle();
            gameStore.setState({
              activeVehicleDamage: null,
              lastOutcomeText: 'Servis darurat selesai — bodi & ban kembali 100%!',
            });
          }}
          onInteriorAction={handleInteriorQuickAction}
          onTriggerProtagonistAbility={handleTriggerProtagonistAbility}
          onToggleVehicle={() => controllerRef.current?.toggleEnterExitVehicle()}
          onHonk={() => controllerRef.current?.triggerHorn()}
          onToggleFokus={handleToggleFokus}
          onToggleDrone={handleToggleDrone}
          onOpenMissionDialog={(m) => gameStore.setState({ dialogueMission: m })}
          onEnterOrExitInterior={() =>
            handleEnterOrExitInterior(nearbyInterior)
          }
          onOpenWeaponWheel={() =>
            gameStore.setState((prev) => ({
              wheelMode: prev.wheelMode === 'weapon' ? null : 'weapon',
            }))
          }
          onOpenCharacterWheel={() =>
            gameStore.setState((prev) => ({
              wheelMode: prev.wheelMode === 'character' ? null : 'character',
            }))
          }
          onSwitchProtagonist={handleSwitchProtagonist}
          onOpenHeistBoard={() => gameStore.setState({ heistBoardOpen: true })}
          onOpenCustomsGarage={() =>
            gameStore.setState({ customsGarageOpen: true })
          }
          onOpenWarung={handleOpenWarung}
          onOpenPhotoMode={() => gameStore.setState({ photoModeOpen: true })}
          onToggleTpsAim={() =>
            gameStore.setState((prev) => ({ tpsAiming: !prev.tpsAiming }))
          }
          onCycleWeather={cycleWeather}
          onToggleMute={() => gameStore.toggleMute()}
          onPause={() => {
            persistCurrentSave();
            document.body.dataset.state = 'paused';
            gameStore.setState({ gameState: 'paused' });
          }}
          onRestart={() => startNewGame(origin, selectedStage)}
        />
      )}

      {/* FLOATING WORLD-SPACE NPC & TRAFFIC REACTION CALLOUTS */}
      {gameState === 'playing' && !photoModeOpen && <WorldCalloutOverlay />}

      {/* DUAL-THUMB MOBILE TOUCH CONTROLS OVERLAY */}
      {gameState === 'playing' &&
        !photoModeOpen &&
        !dialogueMission &&
        !phoneOpen &&
        !heistBoardOpen &&
        !customsGarageOpen &&
        !warungModalOpen && (
          <MobileTouchControls
            mode={gameSettings.touchControlsMode ?? 'auto'}
            drivingVehicle={drivingVehicle}
            nearbyVehicle={nearbyVehicle}
            tpsAiming={tpsAiming}
            fokusActive={playerState.fokusActive}
            onToggleVehicle={() =>
              controllerRef.current?.toggleEnterExitVehicle()
            }
            onToggleTpsAim={() =>
              gameStore.setState((prev) => ({ tpsAiming: !prev.tpsAiming }))
            }
            onToggleFokus={handleToggleFokus}
            onHonk={() => controllerRef.current?.triggerHorn()}
            onToggleDroneRecon={() => controllerRef.current?.toggleDroneRecon()}
          />
        )}

      {/* CINEMATIC PHOTO MODE STUDIO [N] */}
      <React.Suspense fallback={null}>
        {gameState === 'playing' && photoModeOpen && (
          <PhotoModeOverlay
            weatherMode={weatherMode}
            onChangeWeather={(w) => {
              gameStore.setState({
                weatherMode: w,
                worldTimeMinutes: WEATHER_PRESET_MINUTES[w],
              });
              soundEngine.playPickup();
            }}
            onCapturePng={handleCapturePhoto}
            onClose={() => gameStore.setState({ photoModeOpen: false })}
          />
        )}
      </React.Suspense>

      {/* RADIAL WEAPON WHEEL & SATELLITE CHARACTER SWITCHER */}
      {gameState === 'playing' && wheelMode && (
        <RadialWheelOverlay
          mode={wheelMode}
          playerState={playerState}
          onSelectWeapon={(w) =>
            gameStore.updatePlayerState((prev) => ({ ...prev, activeWeapon: w }))
          }
          onSwitchProtagonist={handleSwitchProtagonist}
          onClose={() => gameStore.setState({ wheelMode: null })}
        />
      )}

      <React.Suspense fallback={null}>
        {/* GRAND HEIST TACTICAL PLANNING BOARD */}
        {gameState === 'playing' && heistBoardOpen && (
          <HeistPlanningModal
            playerState={playerState}
            onUpdatePlan={(plan) =>
              gameStore.updatePlayerState((prev) => ({
                ...prev,
                activeHeistPlan: plan,
              }))
            }
            onLaunchHeistSetup={handleLaunchHeistSetup}
            onLaunchHeistFinale={handleLaunchHeistFinale}
            onClose={() => gameStore.setState({ heistBoardOpen: false })}
          />
        )}

        {/* GRAND HEIST MULTI-STAGE VAULT BREACH MINIGAME */}
        {gameState === 'playing' && activeHeistBreach && (
          <HeistBreachOverlay
            session={activeHeistBreach}
            synergyBonusPct={computeTrioSynergyPerks(trioSynergy).heistBonusPercent}
            onCompleteBreach={(hId, mult) => executeHeistGetawayFinale(hId, mult)}
            onCancel={() => gameStore.closeHeistBreach()}
          />
        )}

        {/* BENGKEL GARUDA 360 VEHICLE CUSTOMIZATION GARAGE */}
        {gameState === 'playing' && customsGarageOpen && (
          <CustomsGarageModal
            playerState={playerState}
            onSelectPaint={handleSelectPaint}
            onSelectUnderglow={handleSelectUnderglow}
            onUpgradeEngine={handleUpgradeVehicle}
            onUpgradeArmorPlating={handleUpgradeArmorPlating}
            onRepairAndClearWanted={handleRepairAndClearWanted}
            onHonk={() => controllerRef.current?.triggerHorn()}
            onClose={() => gameStore.setState({ customsGarageOpen: false })}
          />
        )}

        {/* WARUNG KOPI & JAJANAN NUSANTARA INTERACTIVE MINI-GAME */}
        {gameState === 'playing' && warungModalOpen && (
          <WarungSnackModal
            playerState={playerState}
            onConsumeSnack={handleConsumeWarungSnack}
            onCloseModal={() => gameStore.setState({ warungModalOpen: false })}
            onExitWarung={() => {
              soundEngine.playPickup();
              gameStore.setState((prev) => ({
                warungModalOpen: false,
                playerState: {
                  ...prev.playerState,
                  currentInterior: 'exterior',
                },
              }));
            }}
          />
        )}
      </React.Suspense>

      {/* 2.39:1 CINEMATIC LETTERBOX & SUBTITLES */}
      {gameState === 'playing' && !photoModeOpen && (
        <CinematicOverlay
          cutscene={cutsceneOverlay}
          enabled={gameSettings.cinematicCameraEnabled}
          onDismiss={() => {
            if (cutsceneTimerRef.current !== null) {
              window.clearTimeout(cutsceneTimerRef.current);
              cutsceneTimerRef.current = null;
            }
            controllerRef.current?.stopCutsceneFraming();
            gameStore.setState({ cutsceneOverlay: null });
          }}
        />
      )}

      <React.Suspense fallback={null}>
        {/* INTERACTIVE BRANCHING STORY DIALOGUE */}
        {gameState === 'playing' && dialogueMission && (
          <StoryDialogueModal
            mission={dialogueMission}
            onSelectChoice={handleSelectChoice}
            onClose={() => {
              controllerRef.current?.stopCutsceneFraming();
              gameStore.setState({ dialogueMission: null });
            }}
          />
        )}

        {/* NABILOPHONE OS 6.0 SMARTPHONE OVERLAY */}
        {gameState === 'playing' && phoneOpen && !dialogueMission && (
          <NabiloPhoneModal
            playerState={playerState}
            activeMission={activeMission}
            lastOutcomeText={lastOutcomeText}
            weatherMode={weatherMode}
            onClose={() => gameStore.setState({ phoneOpen: false })}
            onTriggerMissionDialog={(m) =>
              gameStore.setState({ dialogueMission: m })
            }
            onSpawnVehicle={(type) =>
              controllerRef.current?.spawnVehicleNearPlayer(type)
            }
            onBuyOrEquipWeapon={handleBuyOrEquipWeapon}
            onBuyArmorOrMedkit={handleBuyArmorOrMedkit}
            onBuyProperty={handleBuyProperty}
            onCompleteSideHustle={(rp) => handleCompleteSideHustle(rp)}
            onChangeWeather={(w) => {
              gameStore.setState({
                weatherMode: w,
                worldTimeMinutes: WEATHER_PRESET_MINUTES[w],
              });
              soundEngine.playPickup();
            }}
            onRecruitCrew={handleRecruitCrew}
            onChangeRadio={handleChangeRadio}
            onChangeOutfit={handleChangeOutfit}
            onUpgradeVehicle={handleUpgradeVehicle}
            onUpgradeDrone={handleUpgradeDrone}
            onFastTravel={handleFastTravel}
            onBuyStock={handleBuyStock}
            onSellStock={handleSellStock}
            onSwitchProtagonist={handleSwitchProtagonist}
            onOpenHeistBoard={() => gameStore.setState({ heistBoardOpen: true })}
            onOpenCustomsGarage={() =>
              gameStore.setState({ customsGarageOpen: true })
            }
            onEnterInterior={handleEnterInteriorById}
            onStartStreetRace={handleStartStreetRace}
            onStartCustomRace={(track) =>
              controllerRef.current?.startCustomStreetRace(track)
            }
            onShareCustomRace={(track) =>
              controllerRef.current?.sendCustomRaceTrack?.(track) ?? false
            }
            onCaptureViralSnap={handleCaptureViralSnap}
            onStartTurfWar={(districtId) =>
              controllerRef.current?.startTurfWar(districtId)
            }
            onWarpToRamp={(rampId) =>
              controllerRef.current?.teleportToStuntRamp(rampId)
            }
            onSpawnRivalBoss={(bossId) =>
              controllerRef.current?.spawnRivalBoss(bossId)
            }
            onStartVigilantePatrol={() =>
              controllerRef.current?.startVigilantePatrol()
            }
          />
        )}

        {/* STATE 3 & 4: UNIFIED PAUSE MENU / VICTORY / DEFEAT MODAL */}
        {(gameState === 'paused' || gameState === 'gameover') && (
          <StatusModal
            mode={gameState === 'paused' ? 'paused' : outcomeMode}
            snapshot={gameState === 'paused' ? playerState : endSnapshot}
            outcomeNarrative={lastOutcomeText}
            weatherMode={weatherMode}
            muted={muted}
            onResume={() => {
              document.body.dataset.state = 'playing';
              gameStore.setState({ gameState: 'playing' });
            }}
            onRestart={(e) => {
              e.currentTarget.blur();
              startNewGame(origin, selectedStage);
            }}
            onHospitalRespawn={() => {
              const res = gameStore.respawnAtHospital();
              document.body.dataset.state = 'playing';
              controllerRef.current?.restoreSavedPosition(res.spawnX, res.spawnZ);
            }}
            onReturnTitle={() => {
              persistCurrentSave();
              document.body.dataset.state = 'title';
              gameStore.setState({
                savedGame: loadSavedGame(),
                gameState: 'title',
              });
            }}
            onFastTravel={handleFastTravel}
            onTeleportCoords={handleTeleportCoords}
            onTriggerMissionDialog={(m) =>
              gameStore.setState({ dialogueMission: m })
            }
            onChangeWeather={(w) => {
              gameStore.setState({
                weatherMode: w,
                worldTimeMinutes: WEATHER_PRESET_MINUTES[w],
              });
              soundEngine.playPickup();
            }}
            onChangeRadio={handleChangeRadio}
            onToggleMute={() => gameStore.toggleMute()}
            onOpenHeistBoard={() => gameStore.setState({ heistBoardOpen: true })}
            onOpenCustomsGarage={() =>
              gameStore.setState({ customsGarageOpen: true })
            }
            onOpenPhotoMode={() => gameStore.setState({ photoModeOpen: true })}
          />
        )}
      </React.Suspense>
    </div>
  );
}

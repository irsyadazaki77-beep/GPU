import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DistrictZone,
  EnterableInteriorSpec,
  GRAND_HEISTS,
  GameState,
  HeistId,
  InteriorZoneId,
  JAKARTA_DISTRICTS,
  OriginArchetype,
  OutfitId,
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  ProtagonistId,
  RadioStationId,
  STORY_MISSIONS,
  STREET_RACES,
  StockSymbol,
  StoryChoiceOption,
  StoryMission,
  VehicleType,
  WEAPONS,
  WeaponId,
  WeatherMode,
  applyDamageToPlayer,
  applyStoryChoice,
  buyStockShares,
  calculateHeistBreakdown,
  calculatePassivePropertyIncome,
  completeMissionReward,
  createInitialPlayerState,
  formatRupiah,
  purchaseProperty,
  recruitCrewMember,
  sellStockShares,
  stepFokusAbility,
  stepStockMarketTick,
  triggerStockMarketImpact,
  upgradeDroneTech,
  upgradeVehicleGarage,
  resolveJakartaAmbientProfile,
} from './game/rules';
import {
  JakartaWorldCanvas,
  WorldControllerHandle,
} from './components/JakartaWorldCanvas';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { StoryDialogueModal } from './components/StoryDialogueModal';
import { NabiloPhoneModal } from './components/NabiloPhoneModal';
import { StatusModal } from './components/StatusModal';
import { RadialWheelOverlay } from './components/RadialWheelOverlay';
import { HeistPlanningModal } from './components/HeistPlanningModal';
import { CustomsGarageModal } from './components/CustomsGarageModal';
import { soundEngine } from './game/sound';
import {
  SavedGameSnapshot,
  loadSavedGame,
  saveGameSnapshot,
} from './game/save';

const WEATHER_ORDER: WeatherMode[] = ['senja', 'malam', 'siang', 'hujan'];

function buildInitialStateForStage(
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

export default function App() {
  const isAutostart =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('autostart') === '1';

  const [origin, setOrigin] = useState<OriginArchetype>('anak_jalanan');
  const [selectedStage, setSelectedStage] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [weatherMode, setWeatherMode] = useState<WeatherMode>('senja');
  const [gameState, setGameState] = useState<GameState>(
    isAutostart ? 'playing' : 'title'
  );
  const [outcomeMode, setOutcomeMode] = useState<'victory' | 'defeat'>('victory');
  const [playerState, setPlayerState] = useState<PlayerProgressState>(() =>
    buildInitialStateForStage('anak_jalanan', 5)
  );
  const [ghostHp, setGhostHp] = useState<number>(100);
  const [endSnapshot, setEndSnapshot] = useState<PlayerProgressState>(() =>
    buildInitialStateForStage('anak_jalanan', 5)
  );

  // World HUD telemetry state
  const [district, setDistrict] = useState<DistrictZone>(JAKARTA_DISTRICTS[0]);
  const [drivingVehicle, setDrivingVehicle] = useState<VehicleType | null>(null);
  const [vehicleSpeedKmh, setVehicleSpeedKmh] = useState<number>(0);
  const [aircraftAltitude, setAircraftAltitude] = useState<number>(0);
  const [nearbyVehicle, setNearbyVehicle] = useState<VehicleType | null>('vtol_jet');
  const [nearbyMission, setNearbyMission] = useState<StoryMission | null>(
    STORY_MISSIONS[12]
  );
  const [nearbyInterior, setNearbyInterior] =
    useState<EnterableInteriorSpec | null>(null);
  const [objectiveProgress, setObjectiveProgress] = useState<number>(0);
  const [skySwitchPhase, setSkySwitchPhase] = useState<{
    active: boolean;
    stage: 1 | 2 | 3;
    targetId: ProtagonistId;
  } | null>(null);

  // Branching Narrative, NabiloPhone & GTA V Overlays
  const [dialogueMission, setDialogueMission] = useState<StoryMission | null>(
    null
  );
  const [activeMission, setActiveMission] = useState<StoryMission | null>(null);
  const [activeChoice, setActiveChoice] = useState<StoryChoiceOption | null>(
    null
  );
  const [lastOutcomeText, setLastOutcomeText] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState<boolean>(false);
  const [wheelMode, setWheelMode] = useState<'weapon' | 'character' | null>(
    null
  );
  const [heistBoardOpen, setHeistBoardOpen] = useState<boolean>(false);
  const [customsGarageOpen, setCustomsGarageOpen] = useState<boolean>(false);
  const [tpsAiming, setTpsAiming] = useState<boolean>(false);
  const [muted, setMuted] = useState<boolean>(false);
  const [ambientCycleStep, setAmbientCycleStep] = useState<number>(0);

  const [savedGame, setSavedGame] = useState<SavedGameSnapshot | null>(() =>
    loadSavedGame()
  );

  const radarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<WorldControllerHandle | null>(null);

  // Mirror state to document.body.dataset.state immediately & silence engine/ambience on non-playing states
  useEffect(() => {
    document.body.dataset.state = gameState;
    if (gameState !== 'playing') {
      soundEngine.stopEngineAudio(false);
      soundEngine.stopAmbientSoundscape(false);
    }
  }, [gameState]);

  // Cycle Jakarta Ambient Soundscape Cue every 6.5 seconds while playing outdoors
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      setAmbientCycleStep((prev) => prev + 1);
    }, 6500);
    return () => clearInterval(interval);
  }, [gameState]);

  // Update Dynamic Jakarta Ambient Soundscape Layer on district, time-of-day/weather, or cycle step change
  useEffect(() => {
    const isOutdoorPlaying =
      gameState === 'playing' &&
      playerState.currentInterior === 'exterior' &&
      !muted;
    soundEngine.updateAmbientSoundscape(
      district.id,
      weatherMode,
      isOutdoorPlaying,
      ambientCycleStep,
      isOutdoorPlaying
    );
  }, [
    gameState,
    district.id,
    weatherMode,
    muted,
    playerState.currentInterior,
    ambientCycleStep,
  ]);

  // Unlock & resume continuous ambient city bed on first user pointer/keyboard gesture
  useEffect(() => {
    const unlockAmbience = () => {
      soundEngine.unlockAudio();
      if (gameState !== 'playing' || muted) return;
      const isOutdoor = playerState.currentInterior === 'exterior';
      soundEngine.updateAmbientSoundscape(
        district.id,
        weatherMode,
        isOutdoor,
        ambientCycleStep,
        false
      );
    };
    window.addEventListener('pointerdown', unlockAmbience, { passive: true });
    window.addEventListener('keydown', unlockAmbience, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAmbience);
      window.removeEventListener('keydown', unlockAmbience);
    };
  }, [
    gameState,
    muted,
    district.id,
    weatherMode,
    playerState.currentInterior,
    ambientCycleStep,
  ]);

  // Delayed trailing ghost HP bar effect
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setGhostHp(playerState.hp);
    }, 320);
    return () => clearTimeout(timer);
  }, [playerState.hp]);

  // Tahap 4 Fokus Badai [Q] Energy Drain & Recharge Ticker (every 250ms)
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      setPlayerState((prev) => stepFokusAbility(prev, 0.25));
    }, 250);
    return () => clearInterval(interval);
  }, [gameState]);

  // Passive Property Dividend, Stock Market Ticker & Drone Rajawali-X Armor Regeneration (Every 4 seconds)
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      setPlayerState((prev) => {
        const tickedStocks = stepStockMarketTick(prev);
        const dividend = calculatePassivePropertyIncome(
          tickedStocks.ownedProperties
        );
        const armorRegen =
          tickedStocks.droneActive && tickedStocks.droneLevel > 0
            ? tickedStocks.droneLevel * 3
            : 0;
        return {
          ...tickedStocks,
          rupiah: tickedStocks.rupiah + dividend,
          armor: Math.min(
            tickedStocks.maxArmor,
            tickedStocks.armor + armorRegen
          ),
          score: tickedStocks.score + (dividend > 0 ? 25 : 0),
          bestScore: Math.max(
            tickedStocks.bestScore,
            tickedStocks.score + (dividend > 0 ? 25 : 0)
          ),
        };
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [gameState]);

  // Tahap 3, 4 & 5 Radio FM Jakarta Synthesizer Groove
  useEffect(() => {
    if (gameState !== 'playing' || playerState.radioStation === 'off') return;
    let step = 0;
    const station = playerState.radioStation;
    const interval = window.setInterval(() => {
      soundEngine.playRadioBeat(station, step++);
    }, 420);
    return () => clearInterval(interval);
  }, [gameState, playerState.radioStation]);

  // Auto-Save Latest Snapshot Helper + Debounced & Periodic Sync
  const latestSaveInputRef = useRef({
    playerState,
    origin,
    selectedStage,
    weatherMode,
  });
  latestSaveInputRef.current = {
    playerState,
    origin,
    selectedStage,
    weatherMode,
  };

  const persistCurrentSave = useCallback(() => {
    const cur = latestSaveInputRef.current;
    if (cur.playerState.hp <= 0) return;
    const pos = controllerRef.current?.getPlayerPosition() || { x: 0, z: 26 };
    const snapshot: SavedGameSnapshot = {
      version: 1,
      origin: cur.origin,
      selectedStage: cur.selectedStage,
      weatherMode: cur.weatherMode,
      playerState: cur.playerState,
      playerPos: pos,
      savedAt: Date.now(),
    };
    saveGameSnapshot(snapshot);
    setSavedGame(snapshot);
  }, []);

  useEffect(() => {
    if (gameState !== 'playing' || playerState.hp <= 0) return;
    const timer = window.setTimeout(() => {
      persistCurrentSave();
    }, 650);
    return () => clearTimeout(timer);
  }, [
    gameState,
    playerState,
    origin,
    selectedStage,
    weatherMode,
    persistCurrentSave,
  ]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      persistCurrentSave();
    }, 5000);
    return () => clearInterval(interval);
  }, [gameState, persistCurrentSave]);

  const cycleWeather = useCallback(() => {
    setWeatherMode((prev) => {
      const idx = WEATHER_ORDER.indexOf(prev);
      return WEATHER_ORDER[(idx + 1) % WEATHER_ORDER.length];
    });
    soundEngine.playPickup();
  }, []);

  const handleToggleFokus = useCallback(() => {
    setPlayerState((prev) => {
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
    setPlayerState((prev) => {
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

    setPlayerState((prev) => {
      if (prev.activeProtagonist === targetId) return prev;
      const currentId = prev.activeProtagonist;
      const targetLive = prev.protagonistRoster[targetId];
      const targetProfile = PROTAGONIST_PROFILES[targetId];

      // Trigger GTA V 3-Stage Satellite Sky-Switch Camera in 3D canvas
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
    const latest = loadSavedGame() || savedGame;
    if (!latest) return;
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    document.body.dataset.state = 'playing';
    setOrigin(latest.origin);
    setSelectedStage(latest.selectedStage);
    setWeatherMode(latest.weatherMode);
    setPlayerState(latest.playerState);
    setGhostHp(latest.playerState.hp);
    setActiveMission(null);
    setActiveChoice(null);
    setDialogueMission(null);
    setPhoneOpen(false);
    setWheelMode(null);
    setHeistBoardOpen(false);
    setCustomsGarageOpen(false);
    setTpsAiming(false);
    setGameState('playing');
    requestAnimationFrame(() => {
      controllerRef.current?.restoreSavedPosition(
        latest.playerPos.x,
        latest.playerPos.z
      );
    });
  }, [savedGame]);

  const startNewGame = useCallback(
    (
      chosenOrigin: OriginArchetype = origin,
      stage: 1 | 2 | 3 | 4 | 5 = selectedStage
    ) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.body.dataset.state = 'playing';
      const fresh = buildInitialStateForStage(chosenOrigin, stage);
      setPlayerState(fresh);
      setGhostHp(fresh.hp);
      setActiveMission(null);
      setActiveChoice(null);
      setDialogueMission(null);
      setPhoneOpen(false);
      setWheelMode(null);
      setHeistBoardOpen(false);
      setCustomsGarageOpen(false);
      setTpsAiming(false);
      setGameState('playing');
      controllerRef.current?.resetWorldForNewRun();
    },
    [origin, selectedStage]
  );

  // Keyboard bindings for Title Start, Pause, Phone [Tab], Fokus [Q], Wheel [Y], Protagonist [C], Heist [H], Customs [B], TPS Aim [X], Weapons [1-7]
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (savedGame) {
            handleContinueGame();
          } else {
            startNewGame(origin, selectedStage);
          }
        }
        return;
      }

      if (gameState === 'gameover') {
        if (e.code === 'Enter') {
          e.preventDefault();
          startNewGame(origin, selectedStage);
        }
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (dialogueMission) {
          setDialogueMission(null);
          return;
        }
        if (wheelMode) {
          setWheelMode(null);
          return;
        }
        if (heistBoardOpen) {
          setHeistBoardOpen(false);
          return;
        }
        if (customsGarageOpen) {
          setCustomsGarageOpen(false);
          return;
        }
        if (phoneOpen) {
          setPhoneOpen(false);
          return;
        }
        e.preventDefault();
        setGameState((prev) => {
          const next = prev === 'playing' ? 'paused' : 'playing';
          document.body.dataset.state = next;
          return next;
        });
        return;
      }

      if (gameState !== 'playing') return;

      if (e.code === 'Tab') {
        e.preventDefault();
        setPhoneOpen((prev) => !prev);
        setWheelMode(null);
        setHeistBoardOpen(false);
        setCustomsGarageOpen(false);
      } else if (e.code === 'KeyY') {
        e.preventDefault();
        setWheelMode((prev) => (prev === 'weapon' ? null : 'weapon'));
        setPhoneOpen(false);
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        setWheelMode((prev) => (prev === 'character' ? null : 'character'));
        setPhoneOpen(false);
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        setHeistBoardOpen((prev) => !prev);
        setPhoneOpen(false);
        setWheelMode(null);
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        setCustomsGarageOpen((prev) => !prev);
        setPhoneOpen(false);
        setWheelMode(null);
      } else if (e.code === 'KeyX') {
        e.preventDefault();
        setTpsAiming((prev) => !prev);
      } else if (e.code === 'KeyQ') {
        handleToggleFokus();
      } else if (e.code === 'KeyZ') {
        handleToggleDrone();
      } else if (e.code === 'KeyV') {
        cycleWeather();
      } else if (e.code === 'KeyM') {
        soundEngine.muted = !soundEngine.muted;
        if (soundEngine.muted) {
          soundEngine.stopEngineAudio(true);
          soundEngine.stopAmbientSoundscape(true);
        }
        setMuted(soundEngine.muted);
      } else if (e.code === 'KeyR') {
        startNewGame(origin, selectedStage);
      } else if (e.code === 'Digit1') {
        setPlayerState((s) => ({ ...s, activeWeapon: 'fist' }));
      } else if (e.code === 'Digit2') {
        setPlayerState((s) =>
          s.unlockedWeapons.includes('golok')
            ? { ...s, activeWeapon: 'golok' }
            : s
        );
      } else if (e.code === 'Digit3') {
        setPlayerState((s) =>
          s.unlockedWeapons.includes('pistol')
            ? { ...s, activeWeapon: 'pistol' }
            : s
        );
      } else if (e.code === 'Digit4') {
        setPlayerState((s) =>
          s.unlockedWeapons.includes('rifle')
            ? { ...s, activeWeapon: 'rifle' }
            : s
        );
      } else if (e.code === 'Digit5') {
        setPlayerState((s) =>
          s.unlockedWeapons.includes('mercon')
            ? { ...s, activeWeapon: 'mercon' }
            : s
        );
      } else if (e.code === 'Digit6') {
        setPlayerState((s) =>
          s.unlockedWeapons.includes('pasopati')
            ? { ...s, activeWeapon: 'pasopati' }
            : s
        );
      } else if (e.code === 'Digit7') {
        setPlayerState((s) =>
          s.unlockedWeapons.includes('gatotkaca')
            ? { ...s, activeWeapon: 'gatotkaca' }
            : s
        );
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    origin,
    selectedStage,
    savedGame,
    dialogueMission,
    phoneOpen,
    wheelMode,
    heistBoardOpen,
    customsGarageOpen,
    handleContinueGame,
    startNewGame,
    cycleWeather,
    handleToggleFokus,
    handleToggleDrone,
  ]);

  const handleSelectChoice = useCallback(
    (choice: StoryChoiceOption) => {
      if (!dialogueMission) return;
      const mission = dialogueMission;
      setDialogueMission(null);
      setActiveMission(mission);
      setActiveChoice({ ...choice });
      setPlayerState((prev) => applyStoryChoice(prev, choice));
      controllerRef.current?.startMissionObjective(mission, { ...choice });
    },
    [dialogueMission]
  );

  // Grand Heist Setup & Finale Launchers
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

    setActiveMission(setupMission);
    setActiveChoice(setupChoice);
    controllerRef.current?.startMissionObjective(setupMission, setupChoice);
    soundEngine.playMissionFanfare();
  }, []);

  const handleLaunchHeistFinale = useCallback(
    (heistId: HeistId) => {
      const heist =
        GRAND_HEISTS.find((h) => h.id === heistId) || GRAND_HEISTS[0];
      const plan = playerState.activeHeistPlan;
      const breakdown = calculateHeistBreakdown(
        heist.id,
        plan.hackerId,
        plan.driverId,
        plan.gunmanId
      );
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
          ? `Bobol sistem keamanan ${heist.targetLocation} dan bawa kabur hasil bersih ${formatRupiah(breakdown.netPlayerTakeRp)}!`
          : `Gempur penjaga brankas ${heist.targetLocation} dan rebut hasil bersih ${formatRupiah(breakdown.netPlayerTakeRp)}!`,
        objectiveType: isStealth ? 'heist_escape' : 'combat_wave',
        targetX: isStealth ? heist.escapeX : heist.vaultX,
        targetZ: isStealth ? heist.escapeZ : heist.vaultZ,
        objectiveTargetCount: isStealth ? 2 : 5,
        rewardRp: breakdown.netPlayerTakeRp,
        reputationDelta: { rakyat: 12, jalanan: 18, sindikat: 15 },
        wantedDelta: isStealth ? 2 : 4,
        nextMissionId: 'm1_bayangan_monas',
        outcomeNarrative: `GRAND HEIST SUKSES! Trio Jakarta membawa pulang ${formatRupiah(breakdown.netPlayerTakeRp)}. Saham ${heist.victimStock} anjlok & saham ${heist.targetStockRival} meroket di Bursa BAJSA!`,
      };

      setActiveMission(finaleMission);
      setActiveChoice(finaleChoice);
      setPlayerState((prev) => ({
        ...prev,
        wantedLevel: Math.min(5, prev.wantedLevel + (isStealth ? 1 : 3)),
      }));
      controllerRef.current?.startMissionObjective(finaleMission, finaleChoice);
      soundEngine.playMissionFanfare();
    },
    [playerState.activeHeistPlan]
  );

  // Night Street Race Launcher
  const handleStartStreetRace = useCallback((raceId: string) => {
    const race = STREET_RACES.find((r) => r.id === raceId) || STREET_RACES[0];
    const startPt = race.checkpoints[0] || [0, -26];
    const finishPt =
      race.checkpoints[race.checkpoints.length - 1] || [0, 18];

    const raceMission: StoryMission = {
      id: `street_race:${race.id}`,
      stageNumber: 5,
      chapterNumber: 88,
      title: `Balap Liar: ${race.name}`,
      giverName: 'Raka Wijaya (Sirkuit Malam)',
      giverRole: 'Raja Aspal Kemayoran',
      locationName: race.subtitle,
      markerX: startPt[0],
      markerZ: startPt[1],
      briefing: `Pacu kendaraan melewati ${race.checkpoints.length} gerbang sirkuit jalan raya dan menangkan hadiah ${formatRupiah(race.rewardRp)}!`,
      choices: [],
    };
    const raceChoice: StoryChoiceOption = {
      id: `choice_race_${race.id}`,
      label: race.name,
      faction: 'jalanan',
      description: `Lintasi seluruh ${race.checkpoints.length} titik checkpoint balap liar dengan kecepatan tinggi!`,
      objectiveType: 'checkpoint_drive',
      targetX: finishPt[0],
      targetZ: finishPt[1],
      objectiveTargetCount: race.checkpoints.length,
      rewardRp: race.rewardRp,
      reputationDelta: { rakyat: 4, jalanan: 12, sindikat: 2 },
      wantedDelta: 0,
      nextMissionId: 'm1_bayangan_monas',
      outcomeNarrative: `JUARA SIRKUIT JALANAN! Anda menaklukkan ${race.name} dan mengantongi hadiah ${formatRupiah(race.rewardRp)}!`,
    };

    controllerRef.current?.teleportPlayerTo(startPt[0], startPt[1]);
    controllerRef.current?.spawnVehicleNearPlayer('supercar');
    setActiveMission(raceMission);
    setActiveChoice(raceChoice);
    controllerRef.current?.startMissionObjective(raceMission, raceChoice);
    soundEngine.playNitroBoost();
  }, []);

  const handleCompleteActiveObjective = useCallback(() => {
    if (!activeMission || !activeChoice) return;
    const mission = activeMission;
    const choice = activeChoice;

    setLastOutcomeText(choice.outcomeNarrative);
    setActiveMission(null);
    setActiveChoice(null);

    // Check if this is a Grand Heist Setup, Grand Heist Finale, or Street Race
    if (mission.id.startsWith('heist_setup:')) {
      const heistId = mission.id.replace('heist_setup:', '') as HeistId;
      soundEngine.playMissionFanfare();
      setPlayerState((prev) => ({
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
      setPlayerState((prev) => {
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
      return;
    }

    if (mission.id.startsWith('street_race:')) {
      soundEngine.playCashRegister();
      setPlayerState((prev) => {
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

    // Standard Story Mission Completion + Stock Market Reaction
    setPlayerState((prev) => {
      const updated = completeMissionReward(prev, mission.id, choice);
      const stockAdjusted =
        choice.faction === 'sindikat'
          ? triggerStockMarketImpact(updated, 'BNBL', 'KMYR')
          : choice.faction === 'jalanan'
          ? triggerStockMarketImpact(updated, 'SCBD', 'GATO')
          : triggerStockMarketImpact(updated, 'HALM', 'PRIO');

      // If Chapter 15 (final Fase 5 mission) completed, trigger Victory!
      if (
        choice.nextMissionId === null ||
        stockAdjusted.completedMissions.length >= 15
      ) {
        setEndSnapshot(stockAdjusted);
        setOutcomeMode('victory');
        document.body.dataset.state = 'gameover';
        setGameState('gameover');
      }
      return stockAdjusted;
    });
  }, [activeMission, activeChoice]);

  const handlePlayerDamage = useCallback((dmg: number) => {
    setPlayerState((prev) => {
      const { nextState, isDefeated } = applyDamageToPlayer(prev, dmg);
      if (isDefeated) {
        soundEngine.playDefeatSting();
        setEndSnapshot(nextState);
        setOutcomeMode('defeat');
        window.setTimeout(() => {
          document.body.dataset.state = 'gameover';
          setGameState('gameover');
        }, 420);
      }
      return nextState;
    });
  }, []);

  const handleEnemyDefeated = useCallback(
    (rewardRp: number, scoreDelta: number) => {
      setPlayerState((prev) => {
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
    let success = false;
    setPlayerState((prev) => {
      const w = prev.activeWeapon;
      const spec = WEAPONS[w];
      if (spec.isMelee) {
        success = true;
        return prev;
      }
      const currentAmmo = prev.ammo[w] || 0;
      if (currentAmmo < spec.ammoCost) {
        success = false;
        return prev;
      }
      success = true;
      return {
        ...prev,
        ammo: {
          ...prev.ammo,
          [w]: currentAmmo - spec.ammoCost,
        },
      };
    });
    return success;
  }, []);

  const handleBuyOrEquipWeapon = useCallback((wId: WeaponId) => {
    const spec = WEAPONS[wId];
    setPlayerState((prev) => {
      const unlocked = prev.unlockedWeapons.includes(wId);
      if (unlocked) {
        if (!spec.isMelee && prev.rupiah >= 40000) {
          soundEngine.playPickup();
          return {
            ...prev,
            rupiah: prev.rupiah - 40000,
            activeWeapon: wId,
            ammo: {
              ...prev.ammo,
              [wId]: spec.maxAmmo,
            },
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
          ammo: {
            ...prev.ammo,
            [wId]: spec.maxAmmo,
          },
        };
      }
      return prev;
    });
  }, []);

  const handleBuyArmorOrMedkit = useCallback(
    (item: 'medkit' | 'armor' | 'bribe') => {
      setPlayerState((prev) => {
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
    setPlayerState((prev) => {
      const res = purchaseProperty(prev, propId);
      if (res.purchased) {
        soundEngine.playMissionFanfare();
      }
      return res.nextState;
    });
  }, []);

  const handleRecruitCrew = useCallback(() => {
    setPlayerState((prev) => {
      const res = recruitCrewMember(prev);
      if (res.recruited) {
        soundEngine.playMissionFanfare();
      }
      return res.nextState;
    });
  }, []);

  const handleChangeRadio = useCallback((station: RadioStationId) => {
    soundEngine.playPickup();
    setPlayerState((prev) => ({ ...prev, radioStation: station }));
  }, []);

  const handleChangeOutfit = useCallback((outfitId: OutfitId) => {
    soundEngine.playPickup();
    setPlayerState((prev) => ({ ...prev, outfitId }));
  }, []);

  const handleUpgradeVehicle = useCallback(() => {
    setPlayerState((prev) => {
      const res = upgradeVehicleGarage(prev);
      if (res.upgraded) {
        soundEngine.playMissionFanfare();
      }
      return res.nextState;
    });
  }, []);

  const handleUpgradeDrone = useCallback(() => {
    setPlayerState((prev) => {
      const res = upgradeDroneTech(prev);
      if (res.upgraded) {
        soundEngine.playMissionFanfare();
      }
      return res.nextState;
    });
  }, []);

  const handleFastTravel = useCallback((districtId: string) => {
    const target = JAKARTA_DISTRICTS.find((d) => d.id === districtId);
    if (!target) return;
    setPlayerState((prev) => ({ ...prev, currentInterior: 'exterior' }));
    controllerRef.current?.teleportPlayerTo(
      target.centerX + 8,
      target.centerZ + 10
    );
    setLastOutcomeText(
      `Teleportasi MRT & Helipad berhasil menuju ${target.name}!`
    );
  }, []);

  const handleCompleteSideHustle = useCallback(
    (rewardRp: number, _label: string) => {
      soundEngine.playPickup();
      setPlayerState((prev) => {
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
    },
    []
  );

  // Stock Market Buy & Sell Handlers
  const handleBuyStock = useCallback((ticker: StockSymbol, shares: number) => {
    setPlayerState((prev) => {
      const res = buyStockShares(prev, ticker, shares);
      if (res.bought) {
        soundEngine.playCashRegister();
      }
      return res.nextState;
    });
  }, []);

  const handleSellStock = useCallback(
    (ticker: StockSymbol, shares: number) => {
      setPlayerState((prev) => {
        const res = sellStockShares(prev, ticker, shares);
        if (res.sold) {
          soundEngine.playCashRegister();
        }
        return res.nextState;
      });
    },
    []
  );

  // Enter / Exit Building Interior Handler
  const handleEnterOrExitInterior = useCallback(
    (target?: EnterableInteriorSpec | null) => {
      soundEngine.playPickup();
      setPlayerState((prev) => {
        if (prev.currentInterior !== 'exterior') {
          return { ...prev, currentInterior: 'exterior' };
        }
        if (!target) return prev;
        if (target.id === 'heist_penthouse') {
          setHeistBoardOpen(true);
        } else if (target.id === 'customs_garage') {
          setCustomsGarageOpen(true);
        }
        return { ...prev, currentInterior: target.id };
      });
    },
    []
  );

  const handleEnterInteriorById = useCallback((interiorId: InteriorZoneId) => {
    soundEngine.playPickup();
    setPlayerState((prev) => ({
      ...prev,
      currentInterior: interiorId,
    }));
    if (interiorId === 'heist_penthouse') {
      setHeistBoardOpen(true);
    } else if (interiorId === 'customs_garage') {
      setCustomsGarageOpen(true);
    }
  }, []);

  // Police Pursuit Line-of-Sight Evade Timer Handler
  const handleWantedEvadeUpdate = useCallback(
    (isEvading: boolean, dt: number) => {
      setPlayerState((prev) => {
        if (prev.wantedLevel <= 0) {
          return prev.wantedEvadeTimer !== 0
            ? { ...prev, wantedEvadeTimer: 0 }
            : prev;
        }
        if (!isEvading) {
          return prev.wantedEvadeTimer !== 0
            ? { ...prev, wantedEvadeTimer: 0 }
            : prev;
        }
        const currentTimer =
          prev.wantedEvadeTimer > 0 ? prev.wantedEvadeTimer : 10;
        const nextTimer = currentTimer - dt;
        if (nextTimer <= 0) {
          soundEngine.playPickup();
          return {
            ...prev,
            wantedLevel: 0,
            wantedEvadeTimer: 0,
          };
        }
        return {
          ...prev,
          wantedEvadeTimer: nextTimer,
        };
      });
    },
    []
  );

  // Vehicle Customization Handlers (Los Santos Customs 360 Garage)
  const handleSelectPaint = useCallback((paintId: string, price: number) => {
    setPlayerState((prev) => {
      if (prev.rupiah < price) return prev;
      soundEngine.playPickup();
      return {
        ...prev,
        rupiah: prev.rupiah - price,
        vehicleCustoms: {
          ...prev.vehicleCustoms,
          paintId,
        },
      };
    });
  }, []);

  const handleSelectUnderglow = useCallback((glowId: string, price: number) => {
    setPlayerState((prev) => {
      if (prev.rupiah < price) return prev;
      soundEngine.playPickup();
      return {
        ...prev,
        rupiah: prev.rupiah - price,
        vehicleCustoms: {
          ...prev.vehicleCustoms,
          underglowId: glowId,
        },
      };
    });
  }, []);

  const handleUpgradeArmorPlating = useCallback(() => {
    setPlayerState((prev) => {
      if (prev.vehicleCustoms.armorPlatingLevel >= 3 || prev.rupiah < 200000) {
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
    setPlayerState((prev) => {
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
  }, []);

  const passiveIncome = calculatePassivePropertyIncome(
    playerState.ownedProperties
  );
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
        radarCanvasRef={radarCanvasRef}
        controllerRef={controllerRef}
        onUpdateHud={(payload) => {
          setDistrict(payload.district);
          setDrivingVehicle(payload.drivingVehicle);
          setVehicleSpeedKmh(payload.vehicleSpeedKmh);
          setAircraftAltitude(payload.aircraftAltitude);
          setNearbyVehicle(payload.nearbyVehicle);
          setNearbyMission(payload.nearbyMission);
          setNearbyInterior(payload.nearbyInterior);
          setObjectiveProgress(payload.objectiveProgress);
          setSkySwitchPhase(payload.skySwitchPhase);
        }}
        onPlayerDamage={handlePlayerDamage}
        onEnemyDefeated={handleEnemyDefeated}
        onConsumeAmmo={handleConsumeAmmo}
        onOpenMissionDialog={(mission) => setDialogueMission(mission)}
        onCompleteActiveObjective={handleCompleteActiveObjective}
        onToggleTpsAim={() => setTpsAiming((prev) => !prev)}
        onEnterOrExitInterior={handleEnterOrExitInterior}
        onWantedEvadeUpdate={handleWantedEvadeUpdate}
      />

      {/* STATE 1: TITLE SCREEN */}
      {gameState === 'title' && (
        <TitleScreen
          selectedOrigin={origin}
          selectedStage={selectedStage}
          savedGame={savedGame}
          onSelectOrigin={(o) => {
            setOrigin(o);
            setPlayerState(buildInitialStateForStage(o, selectedStage));
          }}
          onSelectStage={(s) => {
            setSelectedStage(s);
            setPlayerState(buildInitialStateForStage(origin, s));
          }}
          onContinueGame={handleContinueGame}
          onStartGame={(e) => {
            e.currentTarget.blur();
            startNewGame(origin, selectedStage);
          }}
        />
      )}

      {/* STATE 2: PLAYING HUD */}
      {gameState === 'playing' && (
        <GameHud
          playerState={playerState}
          ghostHp={ghostHp}
          district={district}
          drivingVehicle={drivingVehicle}
          vehicleSpeedKmh={vehicleSpeedKmh}
          aircraftAltitude={aircraftAltitude}
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
          radarCanvasRef={radarCanvasRef}
          onSelectWeapon={(w) =>
            setPlayerState((prev) => ({ ...prev, activeWeapon: w }))
          }
          onTogglePhone={() => setPhoneOpen((p) => !p)}
          onToggleVehicle={() => controllerRef.current?.toggleEnterExitVehicle()}
          onToggleFokus={handleToggleFokus}
          onToggleDrone={handleToggleDrone}
          onOpenMissionDialog={(m) => setDialogueMission(m)}
          onEnterOrExitInterior={() =>
            handleEnterOrExitInterior(nearbyInterior)
          }
          onOpenWeaponWheel={() =>
            setWheelMode((prev) => (prev === 'weapon' ? null : 'weapon'))
          }
          onOpenCharacterWheel={() =>
            setWheelMode((prev) => (prev === 'character' ? null : 'character'))
          }
          onSwitchProtagonist={handleSwitchProtagonist}
          onOpenHeistBoard={() => setHeistBoardOpen(true)}
          onOpenCustomsGarage={() => setCustomsGarageOpen(true)}
          onToggleTpsAim={() => setTpsAiming((prev) => !prev)}
          onCycleWeather={cycleWeather}
          onToggleMute={() => {
            soundEngine.muted = !soundEngine.muted;
            if (soundEngine.muted) {
              soundEngine.stopEngineAudio(true);
              soundEngine.stopAmbientSoundscape(true);
            }
            setMuted(soundEngine.muted);
          }}
          onPause={() => {
            persistCurrentSave();
            document.body.dataset.state = 'paused';
            setGameState('paused');
          }}
          onRestart={() => startNewGame(origin, selectedStage)}
        />
      )}

      {/* GTA V RADIAL WEAPON WHEEL & SATELLITE CHARACTER SWITCHER */}
      {gameState === 'playing' && wheelMode && (
        <RadialWheelOverlay
          mode={wheelMode}
          playerState={playerState}
          onSelectWeapon={(w) =>
            setPlayerState((prev) => ({ ...prev, activeWeapon: w }))
          }
          onSwitchProtagonist={handleSwitchProtagonist}
          onClose={() => setWheelMode(null)}
        />
      )}

      {/* GTA V GRAND HEIST TACTICAL PLANNING BOARD MODAL */}
      {gameState === 'playing' && heistBoardOpen && (
        <HeistPlanningModal
          playerState={playerState}
          onUpdatePlan={(plan) =>
            setPlayerState((prev) => ({ ...prev, activeHeistPlan: plan }))
          }
          onLaunchHeistSetup={handleLaunchHeistSetup}
          onLaunchHeistFinale={handleLaunchHeistFinale}
          onClose={() => setHeistBoardOpen(false)}
        />
      )}

      {/* LOS SANTOS CUSTOMS 360° VEHICLE CUSTOMIZATION GARAGE MODAL */}
      {gameState === 'playing' && customsGarageOpen && (
        <CustomsGarageModal
          playerState={playerState}
          onSelectPaint={handleSelectPaint}
          onSelectUnderglow={handleSelectUnderglow}
          onUpgradeEngine={handleUpgradeVehicle}
          onUpgradeArmorPlating={handleUpgradeArmorPlating}
          onRepairAndClearWanted={handleRepairAndClearWanted}
          onClose={() => setCustomsGarageOpen(false)}
        />
      )}

      {/* INTERACTIVE BRANCHING STORY DIALOGUE MODAL */}
      {gameState === 'playing' && dialogueMission && (
        <StoryDialogueModal
          mission={dialogueMission}
          onSelectChoice={handleSelectChoice}
          onClose={() => setDialogueMission(null)}
        />
      )}

      {/* NABILOPHONE OS 6.0 IN-GAME SMARTPHONE OVERLAY */}
      {gameState === 'playing' && phoneOpen && !dialogueMission && (
        <NabiloPhoneModal
          playerState={playerState}
          activeMission={activeMission}
          lastOutcomeText={lastOutcomeText}
          weatherMode={weatherMode}
          onClose={() => setPhoneOpen(false)}
          onTriggerMissionDialog={(m) => setDialogueMission(m)}
          onSpawnVehicle={(type) =>
            controllerRef.current?.spawnVehicleNearPlayer(type)
          }
          onBuyOrEquipWeapon={handleBuyOrEquipWeapon}
          onBuyArmorOrMedkit={handleBuyArmorOrMedkit}
          onBuyProperty={handleBuyProperty}
          onCompleteSideHustle={handleCompleteSideHustle}
          onChangeWeather={(w) => {
            setWeatherMode(w);
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
          onOpenHeistBoard={() => setHeistBoardOpen(true)}
          onOpenCustomsGarage={() => setCustomsGarageOpen(true)}
          onEnterInterior={handleEnterInteriorById}
          onStartStreetRace={handleStartStreetRace}
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
            setGameState('playing');
          }}
          onRestart={(e) => {
            e.currentTarget.blur();
            startNewGame(origin, selectedStage);
          }}
          onReturnTitle={() => {
            persistCurrentSave();
            setSavedGame(loadSavedGame());
            document.body.dataset.state = 'title';
            setGameState('title');
          }}
          onFastTravel={handleFastTravel}
          onTriggerMissionDialog={(m) => setDialogueMission(m)}
          onChangeWeather={(w) => {
            setWeatherMode(w);
            soundEngine.playPickup();
          }}
          onChangeRadio={handleChangeRadio}
          onToggleMute={() => {
            soundEngine.muted = !soundEngine.muted;
            if (soundEngine.muted) {
              soundEngine.stopEngineAudio(true);
              soundEngine.stopAmbientSoundscape(true);
            }
            setMuted(soundEngine.muted);
          }}
          onOpenHeistBoard={() => setHeistBoardOpen(true)}
          onOpenCustomsGarage={() => setCustomsGarageOpen(true)}
        />
      )}
    </div>
  );
}

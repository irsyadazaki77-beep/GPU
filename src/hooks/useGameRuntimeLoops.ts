import { useEffect } from 'react';
import {
  calculatePassiveBusinessIncome,
  calculatePassivePropertyIncome,
  calculateTurfWarsIncome,
  formatJakartaClock,
  resolveWeatherFromWorldClock,
  stepFokusAbility,
  stepStockMarketTick,
  stepWarungStaminaBuff,
  stepWorldClockEventTicker,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import { cityAudio } from '../engine/CityAudio';
import { gameStore, useGameStore } from '../state/gameStore';

export function useGameRuntimeLoops(persistCurrentSave: () => void): void {
  const gameState = useGameStore((s) => s.gameState);
  const origin = useGameStore((s) => s.origin);
  const selectedStage = useGameStore((s) => s.selectedStage);
  const weatherMode = useGameStore((s) => s.weatherMode);
  const playerState = useGameStore((s) => s.playerState);
  const district = useGameStore((s) => s.district);
  const muted = useGameStore((s) => s.muted);
  const ambientCycleStep = useGameStore((s) => s.ambientCycleStep);
  const audioVolumes = useGameStore((s) => s.audioVolumes);
  const gameSettings = useGameStore((s) => s.gameSettings);
  const completedDynamicQuests = useGameStore((s) => s.completedDynamicQuests);

  useEffect(() => {
    document.body.dataset.state = gameState;
    if (gameState !== 'playing') {
      soundEngine.stopEngineAudio(false);
      soundEngine.stopAmbientSoundscape(false);
    }
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      gameStore.setState((prev) => ({
        ambientCycleStep: prev.ambientCycleStep + 1,
      }));
    }, 6500);
    return () => clearInterval(interval);
  }, [gameState]);

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

  useEffect(() => {
    const unlockAmbience = () => {
      soundEngine.unlockAudio();
      cityAudio.unlock();
      const s = gameStore.getState();
      if (s.gameState !== 'playing' || s.muted) return;
      const isOutdoor = s.playerState.currentInterior === 'exterior';
      soundEngine.updateAmbientSoundscape(
        s.district.id,
        s.weatherMode,
        isOutdoor,
        s.ambientCycleStep,
        false
      );
    };
    window.addEventListener('pointerdown', unlockAmbience, { passive: true });
    window.addEventListener('keydown', unlockAmbience, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAmbience);
      window.removeEventListener('keydown', unlockAmbience);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      gameStore.setState({ ghostHp: playerState.hp });
    }, 320);
    return () => clearTimeout(timer);
  }, [playerState.hp]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      gameStore.updatePlayerState((prev) =>
        stepWarungStaminaBuff(stepFokusAbility(prev, 0.25), 0.25)
      );
    }, 250);
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      gameStore.setState((prev) => {
        const nextMinutes = prev.autoTimeCycle
          ? (prev.worldTimeMinutes + 2) % 1440
          : prev.worldTimeMinutes;
        const nextWeather = prev.autoTimeCycle
          ? resolveWeatherFromWorldClock(
              nextMinutes,
              prev.weatherMode === 'hujan'
            )
          : prev.weatherMode;

        let nextContract = prev.activeContract;
        let nextOutcome = prev.lastOutcomeText;
        let nextWaypoint = prev.customWaypoint;
        if (nextContract) {
          const rem = nextContract.timeRemainingSec - 1;
          if (rem <= 0) {
            nextContract = null;
            nextWaypoint = null;
            nextOutcome = `Waktu Habis: ${prev.activeContract?.title} gagal diselesaikan.`;
          } else {
            nextContract = { ...nextContract, timeRemainingSec: rem };
          }
        }

        const eventStep = stepWorldClockEventTicker(
          prev.worldClockEventState,
          nextMinutes,
          1
        );
        if (eventStep.triggeredEvent) {
          const ev = eventStep.triggeredEvent;
          nextOutcome = `Info Lalu Lintas (${formatJakartaClock(nextMinutes)}): ${ev.spec.title} — ${ev.spec.detourLabel}`;
          if (!nextWaypoint && !prev.activeMission && !nextContract) {
            const firstPt = ev.spec.detourWaypoints[0] || [
              ev.spec.detourTargetX,
              ev.spec.detourTargetZ,
            ];
            nextWaypoint = {
              x: firstPt[0],
              z: firstPt[1],
              label: `Rute Alternatif (1/${ev.spec.detourWaypoints.length}): ${ev.spec.detourLabel}`,
              category: 'detour',
            };
          }
        } else if (eventStep.expiredEvent) {
          if (nextWaypoint?.category === 'detour') {
            nextWaypoint = null;
          }
        }

        return {
          worldTimeMinutes: nextMinutes,
          weatherMode: nextWeather,
          activeContract: nextContract,
          customWaypoint: nextWaypoint,
          lastOutcomeText: nextOutcome,
          worldClockEventState: eventStep.nextState,
        };
      });
      gameStore.tickStreetRandomEvent(1);
    }, 1000);
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      gameStore.updatePlayerState((prev) => {
        const tickedStocks = stepStockMarketTick(prev);
        const dividend =
          calculatePassivePropertyIncome(tickedStocks.ownedProperties) +
          calculateTurfWarsIncome(tickedStocks) +
          Math.round(
            calculatePassiveBusinessIncome(
              tickedStocks.ownedBusinesses,
              tickedStocks.characterSkills?.negotiation ?? 1
            ) / 15
          );
        const armorRegen =
          tickedStocks.droneActive && tickedStocks.droneLevel > 0
            ? tickedStocks.droneLevel * 3
            : 0;
        const nextScore = tickedStocks.score + (dividend > 0 ? 25 : 0);
        return {
          ...tickedStocks,
          rupiah: tickedStocks.rupiah + dividend,
          armor: Math.min(
            tickedStocks.maxArmor,
            tickedStocks.armor + armorRegen
          ),
          score: nextScore,
          bestScore: Math.max(tickedStocks.bestScore, nextScore),
        };
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== 'playing' || playerState.radioStation === 'off') return;
    let step = 0;
    const station = playerState.radioStation;
    const interval = window.setInterval(() => {
      soundEngine.playRadioBeat(station, step++);
    }, 420);
    return () => clearInterval(interval);
  }, [gameState, playerState.radioStation]);

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
    audioVolumes,
    gameSettings,
    completedDynamicQuests,
    persistCurrentSave,
  ]);

  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = window.setInterval(() => {
      persistCurrentSave();
    }, 5000);
    return () => clearInterval(interval);
  }, [gameState, persistCurrentSave]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = gameStore.getState();
      const now = Date.now();
      if (s.lastStuntBanner && now - s.lastStuntBanner.timestampMs > 3800) {
        gameStore.dismissStuntBanner();
      }
      if (s.killCamBanner && now - s.killCamBanner.stamp > 2100) {
        gameStore.setState({ killCamBanner: null });
      }
      if (s.squadCallout && now - s.squadCallout.stamp > 4200) {
        gameStore.setState({ squadCallout: null });
      }
    }, 350);
    return () => clearInterval(id);
  }, []);
}

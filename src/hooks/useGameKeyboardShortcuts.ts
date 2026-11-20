import { useEffect } from 'react';
import type { OriginArchetype, WeaponId } from '../game/rules';
import { soundEngine } from '../game/sound';
import { gameStore } from '../state/gameStore';

interface UseGameKeyboardShortcutsOptions {
  onContinueGame: () => void;
  onStartNewGame: (origin?: OriginArchetype, stage?: 1 | 2 | 3 | 4 | 5) => void;
  onCycleWeather: () => void;
  onToggleFokus: () => void;
  onToggleDrone: () => void;
  onTriggerHorn: () => void;
  onTriggerProtagonistAbility: () => void;
}

export function useGameKeyboardShortcuts({
  onContinueGame,
  onStartNewGame,
  onCycleWeather,
  onToggleFokus,
  onToggleDrone,
  onTriggerHorn,
  onTriggerProtagonistAbility,
}: UseGameKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      const s = gameStore.getState();
      if (s.gameState === 'title') {
        if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          if (s.savedGame) {
            onContinueGame();
          } else {
            onStartNewGame(s.origin, s.selectedStage);
          }
        }
        return;
      }

      if (s.gameState === 'gameover') {
        if (e.code === 'Enter') {
          e.preventDefault();
          onStartNewGame(s.origin, s.selectedStage);
        }
        return;
      }

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (isTyping && e.code === 'KeyP') return;
        if (s.dialogueMission) {
          gameStore.setState({ dialogueMission: null });
          return;
        }
        if (s.wheelMode) {
          gameStore.setState({ wheelMode: null });
          return;
        }
        if (s.activeHeistBreach) {
          gameStore.closeHeistBreach();
          return;
        }
        if (s.heistBoardOpen) {
          gameStore.setState({ heistBoardOpen: false });
          return;
        }
        if (s.customsGarageOpen) {
          gameStore.setState({ customsGarageOpen: false });
          return;
        }
        if (s.warungModalOpen) {
          gameStore.setState({ warungModalOpen: false });
          return;
        }
        if (s.photoModeOpen) {
          gameStore.setState({ photoModeOpen: false });
          return;
        }
        if (s.phoneOpen) {
          gameStore.setState({ phoneOpen: false });
          return;
        }
        e.preventDefault();
        const next = s.gameState === 'playing' ? 'paused' : 'playing';
        document.body.dataset.state = next;
        gameStore.setState({ gameState: next });
        return;
      }

      if (s.gameState !== 'playing' || isTyping) return;

      if (e.code === 'Tab') {
        e.preventDefault();
        gameStore.setState((prev) => ({
          phoneOpen: !prev.phoneOpen,
          phoneTargetScreen: 'home',
          wheelMode: null,
          heistBoardOpen: false,
          customsGarageOpen: false,
          warungModalOpen: false,
          photoModeOpen: false,
        }));
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        soundEngine.playPickup();
        gameStore.setState((prev) => ({
          photoModeOpen: !prev.photoModeOpen,
          phoneOpen: false,
          wheelMode: null,
          heistBoardOpen: false,
          customsGarageOpen: false,
          warungModalOpen: false,
        }));
      } else if (e.code === 'KeyU') {
        e.preventDefault();
        gameStore.setState((prev) => ({ zenHudMode: !prev.zenHudMode }));
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        onTriggerProtagonistAbility();
      } else if (e.code === 'F1' || e.code === 'F2' || e.code === 'F3') {
        // Prevent browser help/search shortcuts; PlayerController handles F1/F2/F3 Squad Orders
        e.preventDefault();
      } else if (e.code === 'F8') {
        e.preventDefault();
        gameStore.togglePerfOverlay();
      } else if (e.code === 'KeyY') {
        e.preventDefault();
        gameStore.setState((prev) => ({
          wheelMode: prev.wheelMode === 'weapon' ? null : 'weapon',
          phoneOpen: false,
        }));
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        gameStore.setState((prev) => ({
          wheelMode: prev.wheelMode === 'character' ? null : 'character',
          phoneOpen: false,
        }));
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        if (s.drivingVehicle) {
          onTriggerHorn();
        } else {
          gameStore.setState((prev) => ({
            heistBoardOpen: !prev.heistBoardOpen,
            phoneOpen: false,
            wheelMode: null,
          }));
        }
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        gameStore.setState((prev) => ({
          customsGarageOpen: !prev.customsGarageOpen,
          phoneOpen: false,
          wheelMode: null,
        }));
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        soundEngine.playPickup();
        gameStore.setState((prev) => ({
          playerState: {
            ...prev.playerState,
            currentInterior: prev.warungModalOpen
              ? prev.playerState.currentInterior
              : 'warung',
          },
          warungModalOpen: !prev.warungModalOpen,
          phoneOpen: false,
          wheelMode: null,
          heistBoardOpen: false,
          customsGarageOpen: false,
        }));
      } else if (e.code === 'KeyT') {
        e.preventDefault();
        gameStore.setState((prev) => ({ tpsAiming: !prev.tpsAiming }));
      } else if (e.code === 'KeyQ') {
        onToggleFokus();
      } else if (e.code === 'KeyZ') {
        onToggleDrone();
      } else if (e.code === 'KeyO') {
        onCycleWeather();
      } else if (e.code === 'KeyM') {
        gameStore.toggleMute();
      } else if (e.code === 'KeyR' && !s.drivingVehicle) {
        onStartNewGame(s.origin, s.selectedStage);
      } else {
        const slotMap: Record<string, WeaponId> = {
          Digit1: 'fist',
          Digit2: 'golok',
          Digit3: 'pistol',
          Digit4: 'rifle',
          Digit5: 'mercon',
          Digit6: 'pasopati',
          Digit7: 'gatotkaca',
        };
        const chosenWeapon = slotMap[e.code];
        if (chosenWeapon) {
          gameStore.updatePlayerState((prev) =>
            prev.unlockedWeapons.includes(chosenWeapon)
              ? { ...prev, activeWeapon: chosenWeapon }
              : prev
          );
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onContinueGame,
    onStartNewGame,
    onCycleWeather,
    onToggleFokus,
    onToggleDrone,
    onTriggerHorn,
    onTriggerProtagonistAbility,
  ]);
}

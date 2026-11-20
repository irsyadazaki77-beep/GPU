import {
  ENTERABLE_INTERIORS,
  EnterableInteriorSpec,
  InteriorZoneId,
  OutfitId,
  PlayerProgressState,
  ProtagonistId,
  WARUNG_STALL_LOCATIONS,
  WeaponId,
} from '../game/rules';
import { INTERIOR_ROOM_CENTERS } from '../game/world/streetscapeBuilder';

export interface ExteriorReturnSnapshot {
  x: number;
  y: number;
  z: number;
  facing: number;
  drivingVehicleId: string | null;
  enteredFromSpec: EnterableInteriorSpec;
  enteredAtMs: number;
}

export interface SafehouseRestResult {
  nextPlayerState: PlayerProgressState;
  nextWorldTimeMinutes: number;
  hoursRested: number;
  hpRecovered: number;
  armorRecovered: number;
  autoSaveTriggered: boolean;
}

/**
 * Manages seamless portal transitions between exterior Jakarta districts and isolated
 * 3D interior rooms (Protagonist Safehouse, Faction HQs, Glodok Tech Shop, Warung, Penthouse, Garage, Vault)
 * without page reloads while pausing exterior traffic rendering and preserving exact return coordinates.
 */
export class InteriorManager {
  private activeInterior: InteriorZoneId = 'exterior';
  private savedExteriorSnapshot: ExteriorReturnSnapshot | null = null;
  private transitionFadeAlpha = 0;
  private exteriorTrafficPaused = false;

  public getActiveInterior(): InteriorZoneId {
    return this.activeInterior;
  }

  public isExteriorTrafficPaused(): boolean {
    return this.exteriorTrafficPaused;
  }

  public getSavedExteriorSnapshot(): ExteriorReturnSnapshot | null {
    return this.savedExteriorSnapshot;
  }

  public getTransitionFadeAlpha(): number {
    return this.transitionFadeAlpha;
  }

  /**
   * Finds the nearest enterable interior portal within trigger radius (`6.5m`).
   */
  public findNearbyPortal(
    playerX: number,
    playerZ: number,
    triggerRadius: number = 6.5
  ): EnterableInteriorSpec | null {
    for (const spec of ENTERABLE_INTERIORS) {
      if (
        Math.hypot(playerX - spec.portalX, playerZ - spec.portalZ) <
        triggerRadius
      ) {
        return spec;
      }
    }
    const warungSpec = ENTERABLE_INTERIORS.find((i) => i.id === 'warung');
    if (warungSpec) {
      for (const [wx, wz] of WARUNG_STALL_LOCATIONS) {
        if (Math.hypot(playerX - wx, playerZ - wz) < triggerRadius) {
          return warungSpec;
        }
      }
    }
    return null;
  }

  /**
   * Transitions smoothly into an isolated 3D interior scene, saving the exact exterior coordinates
   * and vehicle state while pausing exterior traffic rendering.
   */
  public enterInterior(
    spec: EnterableInteriorSpec,
    exteriorPose: {
      x: number;
      y: number;
      z: number;
      facing: number;
      drivingVehicleId: string | null;
    }
  ): {
    interiorId: Exclude<InteriorZoneId, 'exterior'>;
    spawnX: number;
    spawnY: number;
    spawnZ: number;
    spawnFacing: number;
  } {
    this.savedExteriorSnapshot = {
      x: exteriorPose.x,
      y: exteriorPose.y,
      z: exteriorPose.z,
      facing: exteriorPose.facing,
      drivingVehicleId: exteriorPose.drivingVehicleId,
      enteredFromSpec: spec,
      enteredAtMs: Date.now(),
    };
    this.activeInterior = spec.id;
    this.exteriorTrafficPaused = true;
    this.transitionFadeAlpha = 1.0;

    const roomCenterX = INTERIOR_ROOM_CENTERS[spec.id] ?? 0;
    return {
      interiorId: spec.id,
      spawnX: roomCenterX,
      spawnY: 68,
      spawnZ: 4.5,
      spawnFacing: Math.PI,
    };
  }

  /**
   * Returns cleanly from any interior room to the exact exterior coordinates and vehicle state.
   */
  public exitInterior(): {
    interiorId: 'exterior';
    restoreX: number;
    restoreY: number;
    restoreZ: number;
    restoreFacing: number;
    restoreVehicleId: string | null;
  } {
    const snap = this.savedExteriorSnapshot;
    const fallbackSpec = ENTERABLE_INTERIORS[0];
    this.activeInterior = 'exterior';
    this.exteriorTrafficPaused = false;
    this.transitionFadeAlpha = 1.0;
    this.savedExteriorSnapshot = null;

    return {
      interiorId: 'exterior',
      restoreX: snap ? snap.x : fallbackSpec.portalX,
      restoreY: snap ? snap.y : 0,
      restoreZ: snap ? snap.z : fallbackSpec.portalZ + 2.5,
      restoreFacing: snap ? snap.facing : Math.PI,
      restoreVehicleId: snap ? snap.drivingVehicleId : null,
    };
  }

  public stepTransitionFade(dt: number): number {
    if (this.transitionFadeAlpha > 0) {
      this.transitionFadeAlpha = Math.max(0, this.transitionFadeAlpha - dt * 2.5);
    }
    return this.transitionFadeAlpha;
  }

  /**
   * Protagonist Safehouse Rest/Sleep action:
   * - Advances Jakarta World Clock by `hoursToRest * 60` minutes
   * - Restores full HP and Armor
   * - Clears low-tier wanted heat (`wantedLevel <= 2`)
   * - Marks auto-save trigger for local & SQLite cloud persistence
   */
  public static restInSafehouse(
    state: PlayerProgressState,
    currentWorldTimeMinutes: number,
    hoursToRest: number = 6
  ): SafehouseRestResult {
    const clampedHours = Math.max(1, Math.min(12, Math.round(hoursToRest)));
    const nextWorldTimeMinutes =
      ((Math.round(currentWorldTimeMinutes + clampedHours * 60) % 1440) + 1440) %
      1440;
    const hpRecovered = Math.max(0, state.maxHp - state.hp);
    const armorRecovered = Math.max(0, state.maxArmor - state.armor);
    const unlocked = Array.from(
      new Set([...(state.unlockedSafehouses || ['safehouse_menteng']), 'safehouse_menteng'])
    );

    const nextPlayerState: PlayerProgressState = {
      ...state,
      hp: state.maxHp,
      armor: state.maxArmor,
      fokusEnergy: 100,
      wantedLevel: state.wantedLevel <= 2 ? 0 : state.wantedLevel - 1,
      wantedEvading: false,
      wantedEvadeTimer: 0,
      unlockedSafehouses: unlocked,
    };

    return {
      nextPlayerState,
      nextWorldTimeMinutes,
      hoursRested: clampedHours,
      hpRecovered,
      armorRecovered,
      autoSaveTriggered: true,
    };
  }

  /**
   * Equips stashed weapon, outfit, or switches protagonist inside the Trio Safehouse.
   */
  public static equipSafehouseLoadout(
    state: PlayerProgressState,
    options: {
      protagonist?: ProtagonistId;
      outfitId?: OutfitId;
      weaponId?: WeaponId;
    }
  ): PlayerProgressState {
    let next = { ...state };
    if (options.protagonist) {
      next.activeProtagonist = options.protagonist;
    }
    if (options.outfitId) {
      next.outfitId = options.outfitId;
    }
    if (options.weaponId && next.unlockedWeapons.includes(options.weaponId)) {
      next.activeWeapon = options.weaponId;
    }
    return next;
  }
}

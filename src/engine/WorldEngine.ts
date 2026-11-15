import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  DistrictZone,
  EnterableInteriorSpec,
  GameState,
  PlayerProgressState,
  ProtagonistId,
  StoryChoiceOption,
  StoryMission,
  VehicleType,
  WeatherMode,
  clampDt,
  resolveDistrictAtPosition,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import { engineTelemetryRef } from '../state/gameStore';
import { CityRenderer } from './CityRenderer';
import { PlayerController } from './PlayerController';
import { TrafficSystem } from './TrafficSystem';
import { WeatherLightingSystem } from './WeatherLightingSystem';

export interface WorldControllerHandle {
  spawnVehicleNearPlayer: (type: VehicleType) => void;
  toggleEnterExitVehicle: () => void;
  triggerHorn: () => void;
  startMissionObjective: (
    mission: StoryMission,
    choice: StoryChoiceOption
  ) => void;
  resetWorldForNewRun: () => void;
  teleportPlayerTo: (x: number, z: number) => void;
  restoreSavedPosition: (x: number, z: number) => void;
  triggerSatelliteSwitch: (
    targetId: ProtagonistId,
    targetX: number,
    targetZ: number
  ) => void;
  getPlayerPosition: () => { x: number; z: number };
}

export interface WorldHudPayload {
  district: DistrictZone;
  drivingVehicle: VehicleType | null;
  vehicleSpeedKmh: number;
  aircraftAltitude: number;
  nearbyVehicle: VehicleType | null;
  nearbyMission: StoryMission | null;
  nearbyInterior: EnterableInteriorSpec | null;
  objectiveProgress: number;
  skySwitchPhase: {
    active: boolean;
    targetId: ProtagonistId;
    stage: 1 | 2 | 3;
  } | null;
}

export interface WorldEngineProps {
  gameState: GameState;
  playerState: PlayerProgressState;
  weatherMode: WeatherMode;
  activeMission: StoryMission | null;
  activeChoice: StoryChoiceOption | null;
  tpsAiming: boolean;
  wheelSlowMo: boolean;
  customsShowcaseOpen: boolean;
  onUpdateHud: (payload: WorldHudPayload) => void;
  onPlayerDamage: (dmg: number) => void;
  onEnemyDefeated: (rewardRp: number, scoreDelta: number) => void;
  onConsumeAmmo: () => boolean;
  onOpenMissionDialog: (mission: StoryMission) => void;
  onCompleteActiveObjective: () => void;
  onToggleTpsAim: () => void;
  onEnterOrExitInterior: (target?: EnterableInteriorSpec | null) => void;
  onWantedEvadeUpdate: (isEvading: boolean, dt: number) => void;
}

export class WorldEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;
  private readonly weatherSystem: WeatherLightingSystem;
  private readonly cityRenderer: CityRenderer;
  private readonly trafficSystem: TrafficSystem;
  private readonly playerController: PlayerController;
  private readonly resizeObserver: ResizeObserver;

  public props: WorldEngineProps;

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private hudSyncAccumulator = 0;

  constructor(container: HTMLElement, initialProps: WorldEngineProps) {
    this.container = container;
    this.props = initialProps;

    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.96;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    this.renderer.domElement.setAttribute(
      'data-testid',
      'jakarta-webgl-canvas'
    );
    container.appendChild(this.renderer.domElement);

    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.scene = new THREE.Scene();
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      60,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.2,
      360
    );

    this.weatherSystem = new WeatherLightingSystem(
      this.scene,
      initialProps.weatherMode,
      this.isSoftwareGl
    );
    this.cityRenderer = new CityRenderer(this.scene, maxAnisotropy);
    this.trafficSystem = new TrafficSystem(
      this.scene,
      this.cityRenderer.buildingGrid
    );
    this.playerController = new PlayerController(
      this.scene,
      this.renderer.domElement,
      this.cityRenderer.buildingGrid,
      this.trafficSystem,
      {
        getGameState: () => this.props.gameState,
        getPlayerState: () => this.props.playerState,
        getActiveChoice: () => this.props.activeChoice,
        getTpsAiming: () => this.props.tpsAiming,
        getWheelSlowMo: () => this.props.wheelSlowMo,
        getCustomsOpen: () => this.props.customsShowcaseOpen,
        onPlayerDamage: (dmg) => this.props.onPlayerDamage(dmg),
        onEnemyDefeated: (rp, score) =>
          this.props.onEnemyDefeated(rp, score),
        onConsumeAmmo: () => this.props.onConsumeAmmo(),
        onOpenMissionDialog: (m) => this.props.onOpenMissionDialog(m),
        onCompleteActiveObjective: () => this.props.onCompleteActiveObjective(),
        onToggleTpsAim: () => this.props.onToggleTpsAim(),
        onEnterOrExitInterior: (t) => this.props.onEnterOrExitInterior(t),
      }
    );

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    if (initialProps.gameState === 'title') {
      this.playerController.stepTitleOrbitCamera(0, this.camera);
    }
    this.renderer.render(this.scene, this.camera);

    this.resizeObserver = new ResizeObserver(this.handleResize);
    this.resizeObserver.observe(container);
    window.addEventListener('resize', this.handleResize);

    this.frameId = requestAnimationFrame(this.tick);
  }

  public getControllerHandle(): WorldControllerHandle {
    return {
      spawnVehicleNearPlayer: (type) => {
        const phys = this.playerController.playerPhys;
        const pos = this.trafficSystem.spawnVehicleNearPlayer(
          type,
          phys.x,
          phys.z,
          phys.facing,
          this.props.playerState.vehicleCustoms
        );
        this.playerController.spawnParticles(
          pos.x,
          pos.y + 1.0,
          pos.z,
          14,
          0xf59e0b,
          7
        );
        soundEngine.playPickup();
      },
      toggleEnterExitVehicle: () =>
        this.playerController.toggleEnterExitVehicle(),
      triggerHorn: () => this.playerController.triggerHorn(),
      startMissionObjective: (_mission, choice) =>
        this.playerController.startMissionObjective(choice),
      resetWorldForNewRun: () => this.playerController.resetWorldForNewRun(),
      teleportPlayerTo: (x, z) =>
        this.playerController.teleportPlayerTo(x, z),
      restoreSavedPosition: (x, z) =>
        this.playerController.restoreSavedPosition(x, z),
      triggerSatelliteSwitch: (id, x, z) =>
        this.playerController.triggerSatelliteSwitch(id, x, z),
      getPlayerPosition: () => ({
        x: this.playerController.playerPhys.x,
        z: this.playerController.playerPhys.z,
      }),
    };
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.render(this.scene, this.camera);
  };

  private afterDraw(cb: () => void): void {
    if (this.disposed) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync
      ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
      : null;
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync
        ? gl.getSyncParameter(sync, gl.SYNC_STATUS)
        : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const dt = clampDt((now - this.lastTime) / 1000);
    this.lastTime = now;

    const pState = this.props.playerState;
    const currentGameState = this.props.gameState;
    const phys = this.playerController.playerPhys;

    const { nightFactor, wetnessFactor } = this.weatherSystem.update(
      this.props.weatherMode,
      phys.x,
      phys.z,
      this.camera.position,
      dt
    );
    this.cityRenderer.setWeatherTransition(nightFactor, wetnessFactor);

    this.trafficSystem.updateVisualsAndAircraft(
      dt,
      now,
      phys.drivingVehicleId,
      pState,
      currentGameState === 'playing',
      phys.x,
      phys.z
    );

    const nextStoryMission = this.playerController.updateWorldActors(
      dt,
      now,
      pState,
      this.props.activeChoice,
      currentGameState === 'playing'
    );

    if (currentGameState === 'title') {
      this.playerController.stepTitleOrbitCamera(dt, this.camera);
    } else if (currentGameState === 'playing') {
      const stepRes = this.playerController.stepPlaying(
        dt,
        now,
        this.camera,
        pState,
        this.props.activeChoice,
        nextStoryMission,
        nightFactor
      );

      // Publish 60fps mutable telemetry snapshot (0 React re-renders!)
      engineTelemetryRef.playerX = phys.x;
      engineTelemetryRef.playerY = phys.y;
      engineTelemetryRef.playerZ = phys.z;
      engineTelemetryRef.playerFacing = phys.facing;
      engineTelemetryRef.drivingVehicleId = phys.drivingVehicleId;
      engineTelemetryRef.nearbyMission = stepRes.nearbyMission;
      engineTelemetryRef.activeChoice = this.props.activeChoice;
      this.trafficSystem.writeRadarSnapshot(engineTelemetryRef.vehicles);
      this.playerController.writeRadarEnemies(engineTelemetryRef.enemies);

      this.hudSyncAccumulator += dt;
      if (this.hudSyncAccumulator >= 0.1) {
        const syncDt = this.hudSyncAccumulator;
        this.hudSyncAccumulator = 0;

        if (pState.wantedLevel > 0) {
          this.props.onWantedEvadeUpdate(!stepRes.spottedByPolice, syncDt);
        }

        const district = resolveDistrictAtPosition(phys.x, phys.z);
        const nearbyVehType = stepRes.activeVehicle
          ? null
          : this.trafficSystem.getNearbyVehicleType(phys.x, phys.z);

        const skySwitch = this.playerController.skySwitch;
        const stageProgress = skySwitch.elapsed / skySwitch.duration;
        const currentSkyStage: 1 | 2 | 3 =
          stageProgress < 0.34 ? 1 : stageProgress < 0.68 ? 2 : 3;

        this.props.onUpdateHud({
          district,
          drivingVehicle: stepRes.activeVehicle
            ? stepRes.activeVehicle.type
            : null,
          vehicleSpeedKmh: stepRes.activeVehicle
            ? Math.abs(stepRes.activeVehicle.speed) * 3.2
            : 0,
          aircraftAltitude: stepRes.activeVehicle
            ? stepRes.activeVehicle.y
            : phys.y,
          nearbyVehicle: nearbyVehType,
          nearbyMission: stepRes.nearbyMission,
          nearbyInterior: stepRes.nearbyInterior,
          objectiveProgress: this.playerController.objectiveProgress,
          skySwitchPhase: skySwitch.active
            ? {
                active: true,
                targetId: skySwitch.targetId,
                stage: currentSkyStage,
              }
            : null,
        });
      }
    } else {
      this.trafficSystem.vehicleHeadlight.intensity = 0;
      this.trafficSystem.sirenLight.intensity = 0;
      soundEngine.updateEngineAudio(0, false, false, false, false);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    soundEngine.stopEngineAudio(true);
    soundEngine.stopAmbientSoundscape(true);
    this.resizeObserver.disconnect();
    window.removeEventListener('resize', this.handleResize);

    this.playerController.dispose();
    this.trafficSystem.dispose();
    this.cityRenderer.dispose();
    this.weatherSystem.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

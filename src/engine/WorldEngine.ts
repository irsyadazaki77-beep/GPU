import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  CombatHitFeedbackEvent,
  DistrictZone,
  EnterableInteriorSpec,
  GameSettings,
  GameState,
  PlayerProgressState,
  ProtagonistId,
  STUNT_RAMPS_CATALOG,
  SquadOrderMode,
  StoryChoiceOption,
  StoryMission,
  TrafficSignalPhase,
  VEHICLE_SPECS,
  VehicleType,
  WeatherMode,
  advanceTurfWarWave,
  clampDt,
  computePlayerRacePosition,
  isPlayerWithinStreetEvent,
  resolveDistrictAtPosition,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import { engineTelemetryRef, gameStore } from '../state/gameStore';
import { CityRenderer } from './CityRenderer';
import { CrowdSystem } from './CrowdSystem';
import { DestructiblePropsSystem } from './DestructiblePropsSystem';
import { MultiplayerClientSync } from './netSync';
import { JakartaPhysicsWorld } from './physicsWorld';
import { PlayerController } from './PlayerController';
import {
  PostProcessingPipeline,
  ResolvedQualityTier,
} from './PostProcessingPipeline';
import { SimWorkerClient } from './simWorkerClient';
import { spatialAudio } from './spatialAudio';
import { TrafficSystem } from './TrafficSystem';
import { WeatherLightingSystem } from './WeatherLightingSystem';
import type { MultiplayerRoomMode } from '../game/types';

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
  startCutsceneFraming: (focusX: number, focusZ: number, duration?: number) => void;
  stopCutsceneFraming: () => void;
  getPlayerPosition: () => { x: number; z: number };
  captureSnapshotDataUrl: () => string;
  captureViralThumbnailDataUrl: () => string | null;
  repairCurrentVehicle: () => boolean;
  switchMultiplayerRoom?: (roomId: string, mode: MultiplayerRoomMode) => void;
  cycleCameraViewMode: () => void;
  toggleCover: () => void;
  setSquadOrder: (order: SquadOrderMode) => void;
  startStreetRace: (raceId: string) => void;
  cancelStreetRace: () => void;
  startTurfWar: (districtId: string) => void;
  abortTurfWar: () => void;
  teleportToStuntRamp: (rampId: string) => void;
}

export interface WorldHudPayload {
  district: DistrictZone;
  drivingVehicle: VehicleType | null;
  vehicleSpeedKmh: number;
  aircraftAltitude: number;
  isDrifting: boolean;
  nearbyVehicle: VehicleType | null;
  nearbyMission: StoryMission | null;
  nearbyInterior: EnterableInteriorSpec | null;
  objectiveProgress: number;
  trafficSignalPhase: TrafficSignalPhase;
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
  gameSettings: GameSettings;
  onUpdateHud: (payload: WorldHudPayload) => void;
  onPlayerDamage: (dmg: number) => void;
  onEnemyDefeated: (rewardRp: number, scoreDelta: number) => void;
  onConsumeAmmo: () => boolean;
  onOpenMissionDialog: (mission: StoryMission) => void;
  onCompleteActiveObjective: () => void;
  onToggleTpsAim: () => void;
  onEnterOrExitInterior: (target?: EnterableInteriorSpec | null) => void;
  onWantedEvadeUpdate: (isEvading: boolean, dt: number) => void;
  onGraphicsTierResolved?: (tier: ResolvedQualityTier) => void;
  onCombatHitFeedback?: (evt: CombatHitFeedbackEvent) => void;
  onPlayerHitAngle?: (angleRad: number) => void;
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
  private readonly destructibleProps: DestructiblePropsSystem;
  private readonly crowdSystem: CrowdSystem;
  private readonly physicsWorld: JakartaPhysicsWorld;
  private readonly netSync: MultiplayerClientSync;
  private readonly simWorker: SimWorkerClient;
  private readonly postProcessing: PostProcessingPipeline;
  private readonly playerController: PlayerController;
  private readonly resizeObserver: ResizeObserver;

  public props: WorldEngineProps;

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private hudSyncAccumulator = 0;
  private rollingFps = 60;
  private readonly _camRight = new THREE.Vector3();
  private viralThumbCanvas: HTMLCanvasElement | null = null;
  private lastViralMomentAt = 0;
  private lastWantedLevelSeen = 0;

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

    const initW = container.clientWidth || window.innerWidth;
    const initH = container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.85;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(initW, initH);
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
    this.scene.environmentIntensity = 0.12;
    roomEnv.dispose();
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(
      60,
      initW / initH,
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
    this.destructibleProps = new DestructiblePropsSystem(this.scene);
    this.crowdSystem = new CrowdSystem(
      this.scene,
      this.cityRenderer.getSidewalkRects(),
      this.cityRenderer.buildingGrid
    );
    this.physicsWorld = new JakartaPhysicsWorld(
      undefined,
      this.cityRenderer.buildingGrid
    );
    void this.physicsWorld.init();
    this.netSync = new MultiplayerClientSync(this.scene);
    this.netSync.connect('jakarta_pusat', 'free_roam');
    this.simWorker = new SimWorkerClient(this.trafficSystem.vehicles.length);

    this.postProcessing = new PostProcessingPipeline(
      this.renderer,
      this.scene,
      this.camera,
      initW,
      initH,
      this.isSoftwareGl
    );
    initialProps.onGraphicsTierResolved?.(this.postProcessing.getResolvedTier());

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
        onCombatHitFeedback: (evt) => this.props.onCombatHitFeedback?.(evt),
        onPlayerHitAngle: (ang) => this.props.onPlayerHitAngle?.(ang),
        onWeaponNoise: (wx, wz, radius, isBlast) => {
          this.crowdSystem.triggerPanicNear(wx, wz, radius);
          if (radius >= 16) {
            const dZone = resolveDistrictAtPosition(wx, wz);
            gameStore.reportWitnessCrime(wx, wz, dZone.name);
          }
          if (isBlast) {
            this.crowdSystem.triggerSocialFilmingNear(wx, wz, radius * 1.15);
            this._camRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
            this.destructibleProps.applyBlastImpulse(
              wx,
              wz,
              radius * 0.45,
              this._camRight.x,
              this._camRight.z
            );
          }
        },
        onViralMoment: (kind, summaryNote) => {
          const nowTs = Date.now();
          if (nowTs - this.lastViralMomentAt < 9000) return;
          this.lastViralMomentAt = nowTs;
          const phys = this.playerController.playerPhys;
          this.crowdSystem.triggerSocialFilmingNear(phys.x, phys.z, 26);
          const thumb = this.captureViralThumbnailInternal();
          const activeVeh = phys.drivingVehicleId
            ? this.trafficSystem.vehicles.find(
                (v) => v.id === phys.drivingVehicleId
              )
            : null;
          gameStore.publishViralEvent({
            triggerKind: kind,
            snapshotDataUrl: thumb,
            vehicleName: activeVeh ? VEHICLE_SPECS[activeVeh.type].name : undefined,
            summaryNote,
          });
        },
      }
    );

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    if (initialProps.gameState === 'title') {
      this.playerController.stepTitleOrbitCamera(0, this.camera);
    }
    this.postProcessing.render(
      {
        dt: 0.016,
        nightFactor: initialProps.weatherMode === 'malam' ? 1 : 0.35,
        speedRatio: 0,
        fokusActive: false,
        damagePulse: 0,
        requestedTier: initialProps.gameSettings.graphicsTier,
      },
      this.props.onGraphicsTierResolved
    );

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
      startCutsceneFraming: (focusX, focusZ, duration) =>
        this.playerController.startCutsceneFraming(focusX, focusZ, duration),
      stopCutsceneFraming: () => this.playerController.stopCutsceneFraming(),
      getPlayerPosition: () => ({
        x: this.playerController.playerPhys.x,
        z: this.playerController.playerPhys.z,
      }),
      switchMultiplayerRoom: (roomId, mode) => {
        this.netSync.switchRoom(roomId, mode);
      },
      captureSnapshotDataUrl: () => {
        const s = gameStore.getState();
        this.postProcessing.render(
          {
            dt: 0.016,
            nightFactor: this.props.weatherMode === 'malam' ? 1 : 0.35,
            speedRatio: 0,
            fokusActive: this.props.playerState.fokusActive,
            damagePulse: 0,
            requestedTier: this.props.gameSettings.graphicsTier,
            photoFilter: s.photoModeOpen ? s.photoConfig.filter : 'standar',
          },
          this.props.onGraphicsTierResolved
        );
        return this.renderer.domElement.toDataURL('image/png');
      },
      captureViralThumbnailDataUrl: () => this.captureViralThumbnailInternal(),
      repairCurrentVehicle: () => {
        const phys = this.playerController.playerPhys;
        const target =
          (phys.drivingVehicleId
            ? this.trafficSystem.vehicles.find(
                (v) => v.id === phys.drivingVehicleId
              )
            : null) ||
          this.trafficSystem.vehicles.find(
            (v) => Math.hypot(v.x - phys.x, v.z - phys.z) < 10
          );
        if (!target) return false;
        this.trafficSystem.repairVehicle(target);
        this.playerController.spawnParticles(
          target.x,
          target.y + 1.2,
          target.z,
          18,
          0x22c55e,
          7
        );
        soundEngine.playPickup();
        return true;
      },
      cycleCameraViewMode: () => {
        gameStore.cycleCameraViewMode();
      },
      toggleCover: () => {
        this.playerController.toggleCover();
      },
      setSquadOrder: (order: SquadOrderMode) => {
        gameStore.setSquadOrder(order);
      },
      startStreetRace: (raceId: string) => {
        const session = gameStore.startStreetRace(raceId);
        if (!session || session.checkpoints.length === 0) return;
        const cp0 = session.checkpoints[0];
        const cp1 = session.checkpoints[1] || cp0;
        const startHeading = Math.atan2(cp1[0] - cp0[0], cp1[1] - cp0[1]);
        const startX = cp0[0] - Math.sin(startHeading) * 8;
        const startZ = cp0[1] - Math.cos(startHeading) * 8;

        this.playerController.teleportPlayerTo(startX, startZ);
        if (!this.playerController.playerPhys.drivingVehicleId) {
          this.trafficSystem.spawnVehicleNearPlayer(
            'supercar',
            startX,
            startZ,
            startHeading,
            this.props.playerState.vehicleCustoms
          );
          this.playerController.toggleEnterExitVehicle();
        }
        const activeVeh = this.trafficSystem.vehicles.find(
          (v) => v.id === this.playerController.playerPhys.drivingVehicleId
        );
        if (activeVeh) {
          activeVeh.x = startX;
          activeVeh.z = startZ;
          activeVeh.heading = startHeading;
          activeVeh.speed = 0;
        }
        this.trafficSystem.startRaceRivals(
          session.checkpoints,
          startX,
          startZ,
          startHeading
        );
        this.cityRenderer.setRaceCheckpointMarker(cp0[0], cp0[1], false);
      },
      cancelStreetRace: () => {
        gameStore.cancelStreetRace();
        this.trafficSystem.clearRaceRivals();
        this.cityRenderer.setRaceCheckpointMarker(null, null);
      },
      startTurfWar: (districtId: string) => {
        const session = gameStore.startTurfWar(districtId);
        if (!session) return;
        if (this.playerController.playerPhys.drivingVehicleId) {
          this.playerController.toggleEnterExitVehicle();
        }
        this.playerController.teleportPlayerTo(
          session.centerX,
          session.centerZ + 12
        );
        this.playerController.spawnTurfWarWave(
          session.centerX,
          session.centerZ,
          1
        );
        this.cityRenderer.setTurfWarZoneMarker(
          session.centerX,
          session.centerZ,
          session.radius
        );
        gameStore.setSquadOrder('attack');
      },
      abortTurfWar: () => {
        gameStore.abortTurfWar();
        this.playerController.clearTurfWarEnemies();
        this.cityRenderer.setTurfWarZoneMarker(null, null);
      },
      teleportToStuntRamp: (rampId: string) => {
        const ramp = STUNT_RAMPS_CATALOG.find((r) => r.id === rampId);
        if (!ramp) return;
        const approachX = ramp.x - Math.sin(ramp.heading) * 20;
        const approachZ = ramp.z - Math.cos(ramp.heading) * 20;
        this.playerController.teleportPlayerTo(approachX, approachZ);
        if (!this.playerController.playerPhys.drivingVehicleId) {
          this.trafficSystem.spawnVehicleNearPlayer(
            'supercar',
            approachX,
            approachZ,
            ramp.heading,
            this.props.playerState.vehicleCustoms
          );
          this.playerController.toggleEnterExitVehicle();
        }
        const activeVeh = this.trafficSystem.vehicles.find(
          (v) => v.id === this.playerController.playerPhys.drivingVehicleId
        );
        if (activeVeh) {
          activeVeh.x = approachX;
          activeVeh.z = approachZ;
          activeVeh.heading = ramp.heading;
          activeVeh.speed = 6;
        }
        gameStore.setState({
          phoneOpen: false,
          lastOutcomeText: `Siap meluncur ke ${ramp.name}! Gas penuh & pakai Nitro!`,
        });
      },
    };
  }

  private captureViralThumbnailInternal(): string | null {
    try {
      const src = this.renderer.domElement;
      if (!src || src.width === 0 || src.height === 0) return null;
      if (!this.viralThumbCanvas) {
        this.viralThumbCanvas = document.createElement('canvas');
        this.viralThumbCanvas.width = 320;
        this.viralThumbCanvas.height = 180;
      }
      const ctx = this.viralThumbCanvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(src, 0, 0, 320, 180);
      return this.viralThumbCanvas.toDataURL('image/jpeg', 0.72);
    } catch {
      return null;
    }
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.postProcessing.setSize(w, h);
    this.postProcessing.render(
      {
        dt: 0.016,
        nightFactor: this.props.weatherMode === 'malam' ? 1 : 0.35,
        speedRatio: 0,
        fokusActive: this.props.playerState.fokusActive,
        damagePulse: this.playerController.getDamagePulse(),
        requestedTier: this.props.gameSettings.graphicsTier,
      },
      this.props.onGraphicsTierResolved
    );
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
    const rawDtSec = Math.max(0.001, (now - this.lastTime) / 1000);
    const dt = clampDt(rawDtSec);
    this.lastTime = now;
    const instFps = Math.min(120, 1 / rawDtSec);
    this.rollingFps = this.rollingFps * 0.9 + instFps * 0.1;

    const pState = this.props.playerState;
    const currentGameState = this.props.gameState;
    const phys = this.playerController.playerPhys;

    const { nightFactor, wetnessFactor, lightningTriggered } =
      this.weatherSystem.update(
        this.props.weatherMode,
        phys.x,
        phys.z,
        this.camera.position,
        dt
      );
    if (lightningTriggered && currentGameState === 'playing') {
      soundEngine.playThunderBoom();
    }
    this.cityRenderer.setWeatherTransition(nightFactor, wetnessFactor, dt);

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

    let speedRatio = 0;

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
        nightFactor,
        wetnessFactor
      );

      this.cityRenderer.setTrafficSignalPhase(stepRes.signalPhase);
      this._camRight.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      spatialAudio.syncCameraListener({
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z,
        forwardX: this._camRight.x,
        forwardY: this._camRight.y,
        forwardZ: this._camRight.z,
        upX: 0,
        upY: 1,
        upZ: 0,
      });

      // Fixed-Timestep Rapier3D Physics & Pairwise Vehicle Impulses (dt = 1/60)
      const physStep = this.physicsWorld.stepFixed(
        dt,
        this.trafficSystem.vehicles,
        phys.drivingVehicleId
      );
      if (physStep.playerCollisionImpact > 0.35) {
        soundEngine.playPropCrash(0);
        this.crowdSystem.triggerPanicNear(phys.x, phys.z, 18);
      }

      // Offload spatial radar & LOD distance calculations to Web Worker
      this.simWorker.stepBatch(
        this.trafficSystem.vehicles,
        phys.x,
        phys.z,
        dt
      );

      // Step 20Hz -> 60fps Co-Op Multiplayer Interpolation
      const activeVeh = stepRes.activeVehicle;
      this.netSync.step(dt, {
        protagonist: pState.activeProtagonist,
        x: phys.x,
        y: phys.y,
        z: phys.z,
        heading: activeVeh ? activeVeh.heading : phys.facing,
        speed: activeVeh ? activeVeh.speed : 0,
        vehicleType: activeVeh ? activeVeh.type : null,
      });

      this._camRight.set(1, 0, 0).applyQuaternion(this.camera.quaternion);
      const vehSpec = activeVeh ? VEHICLE_SPECS[activeVeh.type] : null;
      speedRatio =
        activeVeh && vehSpec
          ? Math.min(1.2, Math.abs(activeVeh.speed) / Math.max(1, vehSpec.maxSpeed))
          : 0;

      this.destructibleProps.step(
        dt,
        phys.x,
        phys.z,
        activeVeh ? activeVeh.speed : 0,
        vehSpec ? vehSpec.radius : 0.7,
        Boolean(activeVeh),
        this._camRight.x,
        this._camRight.z
      );

      this.crowdSystem.step(
        dt,
        this.postProcessing.getRecommendedCrowdRatio(),
        wetnessFactor,
        stepRes.signalPhase,
        pState.wantedLevel,
        phys.x,
        phys.z
      );

      // Step real-time vehicle smoke, engine fire, and chain-reaction explosions
      this.trafficSystem.stepVehicleDamageAndExplosions(
        dt,
        (x, y, z, count, colorHex, speed) =>
          this.playerController.spawnParticles(x, y, z, count, colorHex, speed),
        (bx, _by, bz, explodedVeh) => {
          this.crowdSystem.triggerPanicNear(bx, bz, 30);
          this.crowdSystem.triggerSocialFilmingNear(bx, bz, 34);
          const dZone = resolveDistrictAtPosition(bx, bz);
          gameStore.reportWitnessCrime(bx, bz, dZone.name);
          if (explodedVeh.id === phys.drivingVehicleId) {
            this.props.onPlayerDamage(32);
            this.playerController.toggleEnterExitVehicle();
          }
          const nowTs = Date.now();
          if (nowTs - this.lastViralMomentAt > 7500) {
            this.lastViralMomentAt = nowTs;
            const thumb = this.captureViralThumbnailInternal();
            gameStore.publishViralEvent({
              triggerKind: 'chain_explosion',
              snapshotDataUrl: thumb,
              vehicleName: VEHICLE_SPECS[explodedVeh.type].name,
              cloutGain: 55,
            });
          }
        }
      );

      // Update 3D Living Jakarta Street Random Event Marker
      const activeStreetEv = gameStore.getState().activeStreetEvent;
      if (
        activeStreetEv &&
        activeStreetEv.status === 'active' &&
        pState.currentInterior === 'exterior'
      ) {
        this.cityRenderer.setActiveStreetEventMarker(
          activeStreetEv.x,
          activeStreetEv.z
        );
        if (isPlayerWithinStreetEvent(activeStreetEv, phys.x, phys.z, 12)) {
          this.crowdSystem.triggerSocialFilmingNear(phys.x, phys.z, 26);
          const thumb = this.captureViralThumbnailInternal();
          gameStore.resolveActiveStreetEvent(thumb);
        }
      } else {
        this.cityRenderer.setActiveStreetEventMarker(null, null);
      }

      // Wave 2: Step Active Street Race (3D Rival AI + Checkpoint Arch + Live Rank)
      const activeRace = gameStore.getState().activeRace;
      if (activeRace && activeRace.status !== 'finished') {
        const nextCp =
          activeRace.checkpoints[activeRace.playerCheckpointIndex] ||
          activeRace.checkpoints[activeRace.checkpoints.length - 1];
        const isFinalCp =
          activeRace.playerCheckpointIndex >= activeRace.checkpoints.length - 1;
        this.cityRenderer.setRaceCheckpointMarker(nextCp[0], nextCp[1], isFinalCp);

        if (activeRace.status === 'countdown') {
          const prevSec = Math.ceil(activeRace.countdownSec);
          const nextCd = Math.max(0, activeRace.countdownSec - dt);
          const curSec = Math.ceil(nextCd);
          if (curSec < prevSec) {
            soundEngine.playTone(curSec === 0 ? 780 : 440, 0.14, 'triangle', 0.15);
          }
          if (nextCd <= 0) {
            gameStore.updateActiveRace({ countdownSec: 0, status: 'racing' });
          } else {
            gameStore.updateActiveRace({ countdownSec: nextCd });
          }
          this.trafficSystem.stepRaceRivals(
            dt,
            activeRace.checkpoints,
            activeRace.elapsedSec,
            false
          );
          this.trafficSystem.writeRaceRivalsTelemetry(engineTelemetryRef.raceRivals);
        } else {
          this.trafficSystem.stepRaceRivals(
            dt,
            activeRace.checkpoints,
            activeRace.elapsedSec,
            true
          );
          this.trafficSystem.writeRaceRivalsTelemetry(engineTelemetryRef.raceRivals);
          const nextElapsed = activeRace.elapsedSec + dt;
          const distCp = Math.hypot(phys.x - nextCp[0], phys.z - nextCp[1]);
          let nextCpIdx = activeRace.playerCheckpointIndex;
          if (distCp < 9.5) {
            nextCpIdx += 1;
            soundEngine.playPickup();
            this.playerController.spawnParticles(
              nextCp[0],
              phys.y + 1.8,
              nextCp[1],
              18,
              0x22d3ee,
              8
            );
          }

          const liveRank = computePlayerRacePosition(
            nextCpIdx,
            phys.x,
            phys.z,
            activeRace.checkpoints,
            engineTelemetryRef.raceRivals
          );

          if (nextCpIdx >= activeRace.checkpoints.length) {
            gameStore.finishStreetRace(liveRank);
            this.trafficSystem.clearRaceRivals();
            this.cityRenderer.setRaceCheckpointMarker(null, null);
            if (liveRank <= 3) {
              const thumb = this.captureViralThumbnailInternal();
              gameStore.publishViralEvent({
                triggerKind: 'drift_stunt',
                snapshotDataUrl: thumb,
                summaryNote: `Finis Juara #${liveRank} di ${activeRace.raceName} dalam ${nextElapsed.toFixed(1)} detik!`,
                cloutGain: liveRank === 1 ? 85 : 45,
              });
            }
          } else if (
            nextCpIdx !== activeRace.playerCheckpointIndex ||
            liveRank !== activeRace.position ||
            Math.floor(nextElapsed * 5) !== Math.floor(activeRace.elapsedSec * 5)
          ) {
            gameStore.updateActiveRace({
              playerCheckpointIndex: nextCpIdx,
              elapsedSec: nextElapsed,
              position: liveRank,
            });
          } else {
            activeRace.elapsedSec = nextElapsed;
          }
        }
      } else {
        this.cityRenderer.setRaceCheckpointMarker(null, null);
      }

      // Wave 2: Step Active 3D Turf War Territory Assault
      const activeTw = gameStore.getState().activeTurfWar;
      if (activeTw && activeTw.status === 'active') {
        this.cityRenderer.setTurfWarZoneMarker(
          activeTw.centerX,
          activeTw.centerZ,
          activeTw.radius
        );
        const twCounts = this.playerController.getRemainingTurfWarEnemyCount();
        if (twCounts.remaining === 0) {
          const adv = advanceTurfWarWave(activeTw);
          if (adv.victory) {
            gameStore.completeTurfWar();
            this.cityRenderer.setTurfWarZoneMarker(null, null);
            const thumb = this.captureViralThumbnailInternal();
            gameStore.publishViralEvent({
              triggerKind: 'heist_complete',
              snapshotDataUrl: thumb,
              summaryNote: `Wilayah ${activeTw.districtName} resmi direbut dari Sindikat setelah menumbangkan Kapten Wilayah!`,
              cloutGain: 90,
            });
          } else if (adv.spawnedNewWave) {
            gameStore.updateTurfWarState(adv.next);
            this.playerController.spawnTurfWarWave(
              activeTw.centerX,
              activeTw.centerZ,
              adv.next.wave
            );
            soundEngine.playPoliceSiren();
            gameStore.triggerSquadCallout(
              adv.next.wave === 3
                ? `Raka: "Waspada! Kapten Wilayah ${activeTw.districtName} turun tangan di Gelombang 3!"`
                : `Kirana: "Gelombang 2 masuk! Aku siap kunci perimeter pakai EMP!"`
            );
          }
        } else if (
          twCounts.remaining !== activeTw.enemiesRemaining ||
          twCounts.captainAlive !== activeTw.captainAlive
        ) {
          gameStore.updateTurfWarState({
            enemiesRemaining: twCounts.remaining,
            captainAlive: twCounts.captainAlive,
          });
        }
      } else {
        this.cityRenderer.setTurfWarZoneMarker(null, null);
      }

      // Publish 60fps mutable telemetry snapshot (0 React re-renders!)
      engineTelemetryRef.playerX = phys.x;
      engineTelemetryRef.playerY = phys.y;
      engineTelemetryRef.playerZ = phys.z;
      engineTelemetryRef.playerFacing = phys.facing;
      engineTelemetryRef.drivingVehicleId = phys.drivingVehicleId;
      engineTelemetryRef.activeVehicleDamage = activeVeh ? activeVeh.damage : null;
      engineTelemetryRef.nearbyMission = stepRes.nearbyMission;
      engineTelemetryRef.activeChoice = this.props.activeChoice;
      this.trafficSystem.writeRadarSnapshot(engineTelemetryRef.vehicles);
      this.trafficSystem.writePoliceVisionCones(
        engineTelemetryRef.policeCones,
        pState.wantedLevel
      );
      this.playerController.writeRadarEnemies(engineTelemetryRef.enemies);

      const netInfo = this.netSync.getTelemetry();
      engineTelemetryRef.perf.fps = Math.round(this.rollingFps);
      engineTelemetryRef.perf.drawCalls = this.renderer.info.render.calls;
      engineTelemetryRef.perf.triangles = this.renderer.info.render.triangles;
      engineTelemetryRef.perf.activeRigidBodies =
        this.physicsWorld.getActiveRigidBodyCount();
      engineTelemetryRef.perf.networkPingMs = netInfo.networkPingMs;
      engineTelemetryRef.perf.connectedPeers = netInfo.connectedPeers;
      engineTelemetryRef.perf.roomId = netInfo.roomId;
      engineTelemetryRef.perf.roomMode = netInfo.roomMode;
      engineTelemetryRef.perf.simWorkerActive = this.simWorker.isWorkerActive();
      engineTelemetryRef.perf.connectionState = netInfo.connectionState;

      this.hudSyncAccumulator += dt;
      if (this.hudSyncAccumulator >= 0.1) {
        const syncDt = this.hudSyncAccumulator;
        this.hudSyncAccumulator = 0;

        const district = resolveDistrictAtPosition(phys.x, phys.z);
        if (pState.wantedLevel > 0) {
          this.props.onWantedEvadeUpdate(!stepRes.spottedByPolice, syncDt);
        }

        // Detect high-heat police escape for NabiloGram viral highlight
        if (this.lastWantedLevelSeen >= 2 && pState.wantedLevel === 0) {
          const thumb = this.captureViralThumbnailInternal();
          gameStore.publishViralEvent({
            triggerKind: 'police_escape',
            snapshotDataUrl: thumb,
            cloutGain: 60,
          });
        } else if (
          this.lastWantedLevelSeen < 3 &&
          pState.wantedLevel >= 3 &&
          Date.now() - this.lastViralMomentAt > 10000
        ) {
          this.lastViralMomentAt = Date.now();
          const thumb = this.captureViralThumbnailInternal();
          gameStore.publishViralEvent({
            triggerKind: 'police_chase',
            snapshotDataUrl: thumb,
            cloutGain: 45,
          });
        }
        this.lastWantedLevelSeen = pState.wantedLevel;

        gameStore.stepPoliceTactical({
          dt: syncDt,
          hasLineOfSight: stepRes.spottedByPolice,
          playerX: phys.x,
          playerZ: phys.z,
          districtName: district.name,
        });

        const nextVehDmg = activeVeh ? activeVeh.damage : null;
        const prevDmg = gameStore.getState().activeVehicleDamage;
        if (
          (nextVehDmg?.integrity ?? -1) !== (prevDmg?.integrity ?? -1) ||
          (nextVehDmg?.smokeStage ?? 'none') !== (prevDmg?.smokeStage ?? 'none') ||
          Boolean(nextVehDmg?.puncturedTires.some(Boolean)) !==
            Boolean(prevDmg?.puncturedTires.some(Boolean))
        ) {
          gameStore.setState({ activeVehicleDamage: nextVehDmg ? { ...nextVehDmg } : null });
        }

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
          isDrifting: stepRes.isDrifting,
          nearbyVehicle: nearbyVehType,
          nearbyMission: stepRes.nearbyMission,
          nearbyInterior: stepRes.nearbyInterior,
          objectiveProgress: this.playerController.objectiveProgress,
          trafficSignalPhase: stepRes.signalPhase,
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

    const storeSnap = gameStore.getState();
    this.postProcessing.render(
      {
        dt,
        nightFactor,
        speedRatio,
        fokusActive: pState.fokusActive,
        damagePulse: this.playerController.getDamagePulse(),
        requestedTier: this.props.gameSettings.graphicsTier,
        photoFilter: storeSnap.photoModeOpen
          ? storeSnap.photoConfig.filter
          : 'standar',
      },
      this.props.onGraphicsTierResolved
    );

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

    this.netSync.dispose();
    this.simWorker.dispose();
    this.physicsWorld.dispose();
    this.playerController.dispose();
    this.destructibleProps.dispose();
    this.crowdSystem.dispose();
    this.trafficSystem.dispose();
    this.cityRenderer.dispose();
    this.weatherSystem.dispose();
    this.postProcessing.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

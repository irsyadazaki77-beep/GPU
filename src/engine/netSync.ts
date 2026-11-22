import * as THREE from 'three';
import {
  PROTAGONIST_PROFILES,
  VEHICLE_SPECS,
  createCustomRaceTrackSpec,
  getGroundElevationAt,
  reduceCoopHeistRoomState,
} from '../game/rules';
import type {
  CustomRaceTrackSpec,
  HeistId,
  MultiplayerConnectionState,
  MultiplayerLobbyState,
  MultiplayerRoomMode,
  NetCoopEvent,
  NetPeerSnapshot,
  ProtagonistId,
  VehicleType,
} from '../game/types';
import {
  animateCharacterRig,
  buildCharacterRig,
  buildIndonesianVehicleMesh,
  buildParachuteCanopyMesh,
} from '../game/world/geometryBuilders';
import { gameStore } from '../state/gameStore';
import { spatialAudio } from './spatialAudio';

export interface InterpolatedPeerPose {
  x: number;
  y: number;
  z: number;
  heading: number;
}

/**
 * Exponential backoff delay calculator (1s -> 2s -> 4s -> 8s -> max 15s)
 * for automatic WebSocket multiplayer reconnection.
 */
export function computeReconnectBackoffSec(attempt: number): number {
  const cleanAttempt = Math.max(0, Math.floor(attempt));
  return Math.min(15, Math.pow(2, cleanAttempt));
}

/**
 * Pure 20Hz -> 60fps exponential damping + velocity extrapolation step
 * so remote Co-Op players glide smoothly between 50ms network ticks.
 */
export function interpolateRemotePeerPose(
  current: InterpolatedPeerPose,
  target: NetPeerSnapshot,
  dt: number,
  extrapolateSec: number = 0.025
): InterpolatedPeerPose {
  if (dt <= 0) return { ...current };

  const predictedX =
    target.x + Math.sin(target.heading) * target.speed * extrapolateSec;
  const predictedZ =
    target.z + Math.cos(target.heading) * target.speed * extrapolateSec;

  const snapDist = Math.hypot(predictedX - current.x, predictedZ - current.z);
  if (snapDist > 36) {
    return {
      x: target.x,
      y: target.y,
      z: target.z,
      heading: target.heading,
    };
  }

  const alpha = 1 - Math.exp(-14 * dt);
  const x = current.x + (predictedX - current.x) * alpha;
  const y = current.y + (target.y - current.y) * alpha;
  const z = current.z + (predictedZ - current.z) * alpha;

  const angleDiff = Math.atan2(
    Math.sin(target.heading - current.heading),
    Math.cos(target.heading - current.heading)
  );
  const heading = current.heading + angleDiff * alpha;

  return { x, y, z, heading };
}

interface RemotePeerRenderSlot {
  peerId: string;
  target: NetPeerSnapshot;
  pose: InterpolatedPeerPose;
  rootGroup: THREE.Group;
  charRig: ReturnType<typeof buildCharacterRig>;
  parachuteMesh: THREE.Group;
  vehicleGroup: THREE.Group | null;
  vehicleType: VehicleType | null;
  markerRing: THREE.Mesh;
  nameSprite: THREE.Sprite | null;
  walkDist: number;
}

function createPeerNameplateSprite(label: string, colorHex: string): THREE.Sprite | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(9, 12, 18, 0.82)';
  ctx.fillRect(16, 12, 224, 40);
  ctx.strokeStyle = colorHex;
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 12, 224, 40);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label.slice(0, 18), 128, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.set(0, 2.55, 0);
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
}

export class MultiplayerClientSync {
  private readonly scene: THREE.Scene;
  private readonly peersGroup = new THREE.Group();
  private readonly peerSlots = new Map<string, RemotePeerRenderSlot>();

  private ws: WebSocket | null = null;
  private disposed = false;
  private localPeerId = '';
  private roomId = 'jakarta_1';
  private roomMode: MultiplayerRoomMode = 'free_roam';
  private connectionState: MultiplayerConnectionState = 'connected';
  private pingMs = 12;
  private sendAccumulator = 0;
  private pingAccumulator = 0;
  private reconnectTimer = 0;
  private reconnectAttempt = 0;
  private nextReconnectDelaySec = 1;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.peersGroup);
  }

  public connect(
    roomId: string = this.roomId,
    mode: MultiplayerRoomMode = this.roomMode
  ): void {
    if (this.disposed || typeof window === 'undefined' || !window.WebSocket) {
      this.connectionState = 'offline';
      return;
    }

    this.roomId = roomId;
    this.roomMode = mode;

    try {
      if (this.ws) {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
        this.ws = null;
      }

      this.connectionState =
        this.reconnectAttempt > 0 ? 'reconnecting' : 'connected';

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/multiplayer?room=${encodeURIComponent(
        this.roomId
      )}&mode=${encodeURIComponent(this.roomMode)}`;

      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.disposed) return;
        this.connectionState = 'connected';
        this.reconnectAttempt = 0;
        this.reconnectTimer = 0;
        this.nextReconnectDelaySec = computeReconnectBackoffSec(0);
      };

      socket.onmessage = (evt) => {
        if (this.disposed) return;
        try {
          const data = JSON.parse(String(evt.data)) as {
            type?: string;
            peerId?: string;
            senderPeerId?: string;
            roomId?: string;
            mode?: MultiplayerRoomMode;
            peers?: NetPeerSnapshot[];
            lobby?: MultiplayerLobbyState;
            clientTime?: number;
            track?: Partial<CustomRaceTrackSpec>;
            event?: NetCoopEvent;
          };

          if (data.type === 'room:init') {
            this.connectionState = 'connected';
            this.reconnectAttempt = 0;
            this.reconnectTimer = 0;
            if (data.peerId) this.localPeerId = data.peerId;
            if (data.roomId) this.roomId = data.roomId;
            if (data.mode) this.roomMode = data.mode;
            if (Array.isArray(data.peers)) {
              this.ingestPeerList(data.peers);
            }
            if (data.lobby) {
              gameStore.setMultiplayerLobbyState(data.lobby);
            }
            return;
          }

          if (data.type === 'room:lobby' && data.lobby) {
            gameStore.setMultiplayerLobbyState(data.lobby);
            return;
          }

          if (data.type === 'room:state' && Array.isArray(data.peers)) {
            this.connectionState = 'connected';
            if (data.roomId) this.roomId = data.roomId;
            if (data.mode) this.roomMode = data.mode;
            if (data.lobby) {
              gameStore.setMultiplayerLobbyState(data.lobby);
            }
            this.ingestPeerList(data.peers);
            return;
          }

          if (data.type === 'custom_race_sync' && data.track && data.senderPeerId !== this.localPeerId) {
            const created = createCustomRaceTrackSpec({
              name: String(data.track.name || 'Sirkuit Co-Op'),
              subtitle: typeof data.track.subtitle === 'string' ? data.track.subtitle : undefined,
              authorName: typeof data.track.authorName === 'string' ? data.track.authorName : 'Kru Co-Op',
              checkpoints: Array.isArray(data.track.checkpoints) ? data.track.checkpoints : [],
              isLoop: Boolean(data.track.isLoop),
              entryFeeRp: typeof data.track.entryFeeRp === 'number' ? data.track.entryFeeRp : undefined,
              rewardRp: typeof data.track.rewardRp === 'number' ? data.track.rewardRp : undefined,
            });
            if (created.track) {
              gameStore.receiveSharedCoopRace({
                ...created.track,
                id: typeof data.track.id === 'string' ? data.track.id : created.track.id,
              });
            }
            return;
          }

          if (data.type === 'coop:event' && data.event && data.event.peerId !== this.localPeerId) {
            const ev = data.event;
            if (ev.type === 'horn') {
              spatialAudio.playOjolHorn3D(ev.x, ev.y, ev.z);
            } else if (ev.type === 'weapon_fire' || ev.type === 'explosion') {
              spatialAudio.playPoliceSiren3D(ev.x, ev.y, ev.z, true);
            } else if (ev.type === 'heist_sync') {
              const parts = (ev.detail || '').split('|');
              const heistId = (parts[0] || null) as HeistId | null;
              const pct = Number(parts[1] || 0);
              const stageLabel = parts[2] || 'Sinkronisasi Heist Kru';
              gameStore.ingestCoopHeistSync({
                heistId,
                progressPct: Number.isFinite(pct) ? pct : 0,
                stageLabel,
                sharedWantedLevel: ev.wantedLevel ?? undefined,
              });
            } else if (ev.type === 'wanted_sync' && typeof ev.wantedLevel === 'number') {
              gameStore.ingestCoopHeistSync({
                sharedWantedLevel: ev.wantedLevel,
              });
            }
            gameStore.pushCoopEventToast(ev);
            return;
          }

          if (data.type === 'pong' && typeof data.clientTime === 'number') {
            this.pingMs = Math.max(1, Math.round(Date.now() - data.clientTime));
          }
        } catch {
          // Ignore malformed WS payloads
        }
      };

      socket.onclose = () => {
        if (this.disposed) return;
        this.ws = null;
        const navigatorOnline =
          typeof navigator === 'undefined' || navigator.onLine !== false;
        this.connectionState = navigatorOnline ? 'reconnecting' : 'offline';
        this.nextReconnectDelaySec = computeReconnectBackoffSec(
          this.reconnectAttempt
        );
        this.reconnectAttempt++;
        this.reconnectTimer = 0;
      };

      socket.onerror = () => {
        // Ignore transient WS errors; exponential backoff onclose handles recovery
      };
    } catch {
      this.connectionState = 'offline';
      this.nextReconnectDelaySec = computeReconnectBackoffSec(
        this.reconnectAttempt
      );
      this.reconnectAttempt++;
    }
  }

  public sendCustomRaceTrack(track: CustomRaceTrackSpec): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'custom_race_sync',
          track,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  public sendCoopEvent(event: {
    type: NetCoopEvent['type'];
    x: number;
    y: number;
    z: number;
    wantedLevel?: number;
    detail?: string;
  }): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'coop:event',
          event,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  public sendLobbyAction(payload: {
    action: 'ready' | 'start_race' | 'finish_race' | 'heist_loot';
    elapsedSec?: number;
    lootDelta?: number;
  }): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'lobby:action',
          ...payload,
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  public switchRoom(roomId: string, mode: MultiplayerRoomMode): void {
    this.roomId = roomId.trim() || 'jakarta_1';
    this.roomMode = mode;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'room:switch',
          roomId: this.roomId,
          mode: this.roomMode,
        })
      );
    } else {
      this.reconnectAttempt = 0;
      this.connect(this.roomId, this.roomMode);
    }
  }

  private ingestPeerList(peers: NetPeerSnapshot[]): void {
    const activeRemoteIds = new Set<string>();

    for (const p of peers) {
      if (!p || !p.peerId || p.peerId === this.localPeerId) continue;
      activeRemoteIds.add(p.peerId);

      const existing = this.peerSlots.get(p.peerId);
      if (existing) {
        existing.target = p;
      } else {
        const rootGroup = new THREE.Group();
        const charRig = buildCharacterRig('crew');
        rootGroup.add(charRig.group);
        const parachuteMesh = buildParachuteCanopyMesh();
        rootGroup.add(parachuteMesh);

        const ringGeo = new THREE.RingGeometry(0.85, 1.15, 20);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75,
        });
        const markerRing = new THREE.Mesh(ringGeo, ringMat);
        markerRing.position.y = 0.08;
        rootGroup.add(markerRing);

        const prof = PROTAGONIST_PROFILES[p.protagonist];
        const nameSprite = createPeerNameplateSprite(
          p.displayName || 'Kru',
          prof?.colorHex || '#38bdf8'
        );
        if (nameSprite) {
          rootGroup.add(nameSprite);
        }

        rootGroup.position.set(p.x, p.y, p.z);
        rootGroup.rotation.y = p.heading;
        this.peersGroup.add(rootGroup);

        this.peerSlots.set(p.peerId, {
          peerId: p.peerId,
          target: p,
          pose: { x: p.x, y: p.y, z: p.z, heading: p.heading },
          rootGroup,
          charRig,
          parachuteMesh,
          vehicleGroup: null,
          vehicleType: null,
          markerRing,
          nameSprite,
          walkDist: 0,
        });
      }
    }

    for (const [peerId, slot] of this.peerSlots.entries()) {
      if (!activeRemoteIds.has(peerId)) {
        this.disposeSlot(slot);
        this.peerSlots.delete(peerId);
      }
    }
  }

  public getNearestRemoteVehiclePeer(
    px: number,
    pz: number,
    maxDist: number = 5.8
  ): {
    peerId: string;
    displayName: string;
    vehicleType: VehicleType;
    vehicleName: string;
    x: number;
    y: number;
    z: number;
    heading: number;
    speed: number;
  } | null {
    let best: ReturnType<MultiplayerClientSync['getNearestRemoteVehiclePeer']> = null;
    let bestDist = maxDist;
    for (const slot of this.peerSlots.values()) {
      if (!slot.target.vehicleType) continue;
      const d = Math.hypot(slot.pose.x - px, slot.pose.z - pz);
      if (d < bestDist) {
        bestDist = d;
        best = {
          peerId: slot.peerId,
          displayName: slot.target.displayName,
          vehicleType: slot.target.vehicleType,
          vehicleName: VEHICLE_SPECS[slot.target.vehicleType]?.name || slot.target.vehicleType,
          x: slot.pose.x,
          y: slot.pose.y,
          z: slot.pose.z,
          heading: slot.pose.heading,
          speed: slot.target.speed,
        };
      }
    }
    return best;
  }

  public getRemotePeerPose(peerId: string): {
    x: number;
    y: number;
    z: number;
    heading: number;
    speed: number;
    vehicleType: VehicleType | null;
    displayName: string;
  } | null {
    const slot = this.peerSlots.get(peerId);
    if (!slot) return null;
    return {
      x: slot.pose.x,
      y: slot.pose.y,
      z: slot.pose.z,
      heading: slot.pose.heading,
      speed: slot.target.speed,
      vehicleType: slot.target.vehicleType,
      displayName: slot.target.displayName,
    };
  }

  public step(
    dt: number,
    localState: {
      protagonist: ProtagonistId;
      x: number;
      y: number;
      z: number;
      heading: number;
      speed: number;
      vehicleType: VehicleType | null;
      wantedLevel?: number;
      ridingPeerId?: string | null;
      isCrouching?: boolean;
      isParachuting?: boolean;
    }
  ): void {
    if (this.disposed) return;

    // Exponential backoff auto-reconnect (1s -> 2s -> 4s -> 8s -> max 15s)
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.reconnectTimer += dt;
      if (this.reconnectTimer >= this.nextReconnectDelaySec) {
        this.reconnectTimer = 0;
        this.connect(this.roomId, this.roomMode);
      }
    }

    // 20Hz outbound state sync
    this.sendAccumulator += dt;
    if (this.sendAccumulator >= 0.05) {
      this.sendAccumulator = 0;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(
            JSON.stringify({
              type: 'peer:update',
              state: localState,
            })
          );
        } catch {
          // Ignore send errors
        }
      }
    }

    // 1Hz ping measurement
    this.pingAccumulator += dt;
    if (this.pingAccumulator >= 1.2) {
      this.pingAccumulator = 0;
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(
            JSON.stringify({
              type: 'ping',
              clientTime: Date.now(),
            })
          );
        } catch {
          // Ignore send errors
        }
      }
    }

    // Smooth 60fps interpolation of all remote Co-Op peers
    for (const slot of this.peerSlots.values()) {
      slot.pose = interpolateRemotePeerPose(slot.pose, slot.target, dt);

      const groundY = getGroundElevationAt(slot.pose.x, slot.pose.z);
      const renderY = Math.max(groundY, slot.pose.y);
      slot.rootGroup.position.set(slot.pose.x, renderY, slot.pose.z);
      slot.rootGroup.rotation.y = slot.pose.heading;

      const prof = PROTAGONIST_PROFILES[slot.target.protagonist];
      if (prof) {
        (slot.markerRing.material as THREE.MeshBasicMaterial).color.setHex(
          prof.threeColorHex
        );
      }

      if (slot.target.vehicleType !== slot.vehicleType) {
        if (slot.vehicleGroup) {
          slot.rootGroup.remove(slot.vehicleGroup);
          slot.vehicleGroup = null;
        }
        slot.vehicleType = slot.target.vehicleType;
        if (slot.vehicleType) {
          slot.vehicleGroup = buildIndonesianVehicleMesh(slot.vehicleType);
          slot.rootGroup.add(slot.vehicleGroup);
        }
      }

      slot.charRig.group.visible = !slot.vehicleType;
      slot.parachuteMesh.visible = !slot.vehicleType && Boolean(slot.target.isParachuting);
      if (!slot.vehicleType) {
        const isMoving = Math.abs(slot.target.speed) > 0.35;
        if (isMoving) slot.walkDist += Math.abs(slot.target.speed) * dt * 0.55;
        animateCharacterRig(slot.charRig, {
          elapsedTime: performance.now() * 0.001,
          walkDist: slot.walkDist,
          isMoving,
          isCrouching: Boolean(slot.target.isCrouching),
          dt,
        });
      }
    }

    // Periodically refresh Co-Op crew roles & shared wanted level in store
    if (this.peerSlots.size > 0) {
      const storeState = gameStore.getState();
      const peerSnaps = Array.from(this.peerSlots.values()).map((s) => s.target);
      const reduced = reduceCoopHeistRoomState(
        storeState.coopHeistSync,
        peerSnaps,
        this.localPeerId || 'local',
        localState.protagonist,
        localState.wantedLevel ?? storeState.playerState.wantedLevel
      );
      if (
        reduced.sharedWantedLevel !== storeState.coopHeistSync.sharedWantedLevel ||
        Object.keys(reduced.crewRoles).length !==
          Object.keys(storeState.coopHeistSync.crewRoles).length
      ) {
        gameStore.ingestCoopHeistSync(reduced);
      }
    }
  }

  public getTelemetry(): {
    networkPingMs: number;
    connectedPeers: number;
    roomId: string;
    roomMode: MultiplayerRoomMode;
    connectionState: MultiplayerConnectionState;
  } {
    const isSocketOpen =
      Boolean(this.ws) && this.ws!.readyState === WebSocket.OPEN;
    return {
      networkPingMs: this.pingMs,
      connectedPeers: this.peerSlots.size + 1,
      roomId: this.roomId,
      roomMode: this.roomMode,
      connectionState: isSocketOpen ? 'connected' : this.connectionState,
    };
  }

  private disposeSlot(slot: RemotePeerRenderSlot): void {
    this.peersGroup.remove(slot.rootGroup);
    slot.rootGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m) => m?.dispose());
      }
    });
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.connectionState = 'offline';
    for (const slot of this.peerSlots.values()) {
      this.disposeSlot(slot);
    }
    this.peerSlots.clear();
    this.scene.remove(this.peersGroup);
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}

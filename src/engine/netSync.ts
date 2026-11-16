import * as THREE from 'three';
import { PROTAGONIST_PROFILES, getGroundElevationAt } from '../game/rules';
import type {
  MultiplayerRoomMode,
  NetPeerSnapshot,
  ProtagonistId,
  VehicleType,
} from '../game/types';
import {
  buildCharacterRig,
  buildIndonesianVehicleMesh,
} from '../game/world/geometryBuilders';

export interface InterpolatedPeerPose {
  x: number;
  y: number;
  z: number;
  heading: number;
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
  vehicleGroup: THREE.Group | null;
  vehicleType: VehicleType | null;
  markerRing: THREE.Mesh;
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
  private pingMs = 12;
  private sendAccumulator = 0;
  private pingAccumulator = 0;
  private reconnectTimer = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.scene.add(this.peersGroup);
  }

  public connect(
    roomId: string = this.roomId,
    mode: MultiplayerRoomMode = this.roomMode
  ): void {
    if (this.disposed || typeof window === 'undefined' || !window.WebSocket) {
      return;
    }

    this.roomId = roomId;
    this.roomMode = mode;

    try {
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.close();
        this.ws = null;
      }

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${proto}//${window.location.host}/ws/multiplayer?room=${encodeURIComponent(
        this.roomId
      )}&mode=${encodeURIComponent(this.roomMode)}`;

      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onmessage = (evt) => {
        if (this.disposed) return;
        try {
          const data = JSON.parse(String(evt.data)) as {
            type?: string;
            peerId?: string;
            roomId?: string;
            mode?: MultiplayerRoomMode;
            peers?: NetPeerSnapshot[];
            clientTime?: number;
          };

          if (data.type === 'room:init') {
            if (data.peerId) this.localPeerId = data.peerId;
            if (data.roomId) this.roomId = data.roomId;
            if (data.mode) this.roomMode = data.mode;
            if (Array.isArray(data.peers)) {
              this.ingestPeerList(data.peers);
            }
            return;
          }

          if (data.type === 'room:state' && Array.isArray(data.peers)) {
            if (data.roomId) this.roomId = data.roomId;
            if (data.mode) this.roomMode = data.mode;
            this.ingestPeerList(data.peers);
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
      };

      socket.onerror = () => {
        // Ignore transient WS errors; auto-reconnect handles recovery
      };
    } catch {
      // Ignore connection errors when offline
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

        rootGroup.position.set(p.x, p.y, p.z);
        rootGroup.rotation.y = p.heading;
        this.peersGroup.add(rootGroup);

        this.peerSlots.set(p.peerId, {
          peerId: p.peerId,
          target: p,
          pose: { x: p.x, y: p.y, z: p.z, heading: p.heading },
          rootGroup,
          charRig,
          vehicleGroup: null,
          vehicleType: null,
          markerRing,
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
    }
  ): void {
    if (this.disposed) return;

    // Reconnect automatically if disconnected
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.reconnectTimer += dt;
      if (this.reconnectTimer >= 4.0) {
        this.reconnectTimer = 0;
        this.connect();
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
    }
  }

  public getTelemetry(): {
    networkPingMs: number;
    connectedPeers: number;
    roomId: string;
    roomMode: MultiplayerRoomMode;
  } {
    return {
      networkPingMs: this.pingMs,
      connectedPeers: this.peerSlots.size + 1,
      roomId: this.roomId,
      roomMode: this.roomMode,
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
    for (const slot of this.peerSlots.values()) {
      this.disposeSlot(slot);
    }
    this.peerSlots.clear();
    this.scene.remove(this.peersGroup);
    if (this.ws) {
      try {
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
  }
}

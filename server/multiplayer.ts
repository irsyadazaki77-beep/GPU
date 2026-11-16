import type { Server as HttpServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  MultiplayerRoomMode,
  NetPeerSnapshot,
  ProtagonistId,
  VehicleType,
} from '../src/game/types';

export const MAX_PLAYERS_PER_ROOM = 8;
export const SERVER_TICK_MS = 50; // 20Hz authoritative broadcast tick
const PEER_STALE_TIMEOUT_MS = 18_000;

interface ConnectedClient {
  peerId: string;
  roomId: string;
  mode: MultiplayerRoomMode;
  ws: WebSocket | null;
  isAlive: boolean;
  state: NetPeerSnapshot;
}

interface RoomInstance {
  roomId: string;
  mode: MultiplayerRoomMode;
  clients: Map<string, ConnectedClient>;
}

const VALID_MODES: MultiplayerRoomMode[] = [
  'free_roam',
  'street_race',
  'coop_heist',
];

const VALID_PROTAGONISTS: ProtagonistId[] = ['nabilo', 'raka', 'kirana'];

function clampWorldCoord(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(-92, Math.min(92, n));
}

export class MultiplayerRoomHub {
  private readonly rooms = new Map<string, RoomInstance>();

  public joinOrSelectRoom(
    requestedRoomId: string,
    mode: MultiplayerRoomMode,
    peerId: string,
    displayName: string,
    ws: WebSocket | null = null
  ): { roomId: string; mode: MultiplayerRoomMode; snapshot: NetPeerSnapshot } {
    const cleanMode: MultiplayerRoomMode = VALID_MODES.includes(mode)
      ? mode
      : 'free_roam';
    const baseRoom =
      requestedRoomId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 28) ||
      `jkt_${cleanMode}`;

    let targetRoomId = baseRoom;
    let suffix = 1;
    while (true) {
      const existing = this.rooms.get(targetRoomId);
      if (
        !existing ||
        existing.clients.has(peerId) ||
        existing.clients.size < MAX_PLAYERS_PER_ROOM
      ) {
        break;
      }
      suffix++;
      targetRoomId = `${baseRoom}_${suffix}`;
    }

    let room = this.rooms.get(targetRoomId);
    if (!room) {
      room = {
        roomId: targetRoomId,
        mode: cleanMode,
        clients: new Map(),
      };
      this.rooms.set(targetRoomId, room);
    }

    const initialSnap: NetPeerSnapshot = {
      peerId,
      displayName: displayName.slice(0, 24) || `Kru-${peerId.slice(0, 4)}`,
      protagonist: 'nabilo',
      x: 0,
      y: 0,
      z: 26,
      heading: Math.PI,
      speed: 0,
      vehicleType: null,
      updatedAt: Date.now(),
    };

    room.clients.set(peerId, {
      peerId,
      roomId: targetRoomId,
      mode: room.mode,
      ws,
      isAlive: true,
      state: initialSnap,
    });

    return { roomId: targetRoomId, mode: room.mode, snapshot: initialSnap };
  }

  public updatePeerState(
    roomId: string,
    peerId: string,
    patch: Partial<NetPeerSnapshot>
  ): NetPeerSnapshot | null {
    const room = this.rooms.get(roomId);
    const client = room?.clients.get(peerId);
    if (!client) return null;

    const prev = client.state;
    const protagonist: ProtagonistId = VALID_PROTAGONISTS.includes(
      patch.protagonist as ProtagonistId
    )
      ? (patch.protagonist as ProtagonistId)
      : prev.protagonist;

    client.isAlive = true;
    client.state = {
      ...prev,
      displayName:
        typeof patch.displayName === 'string' && patch.displayName.trim()
          ? patch.displayName.trim().slice(0, 24)
          : prev.displayName,
      protagonist,
      x: clampWorldCoord(patch.x, prev.x),
      y: Math.max(0, Math.min(72, Number(patch.y ?? prev.y) || 0)),
      z: clampWorldCoord(patch.z, prev.z),
      heading:
        typeof patch.heading === 'number' && Number.isFinite(patch.heading)
          ? patch.heading
          : prev.heading,
      speed:
        typeof patch.speed === 'number' && Number.isFinite(patch.speed)
          ? Math.max(-40, Math.min(70, patch.speed))
          : prev.speed,
      vehicleType:
        patch.vehicleType !== undefined
          ? (patch.vehicleType as VehicleType | null)
          : prev.vehicleType,
      updatedAt: Date.now(),
    };

    return client.state;
  }

  public removePeer(roomId: string, peerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clients.delete(peerId);
    if (room.clients.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  public getRoomPeers(roomId: string): NetPeerSnapshot[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.clients.values()).map((c) => c.state);
  }

  public pruneStalePeers(nowMs: number = Date.now()): void {
    for (const [roomId, room] of this.rooms.entries()) {
      for (const [peerId, client] of room.clients.entries()) {
        if (nowMs - client.state.updatedAt > PEER_STALE_TIMEOUT_MS) {
          try {
            client.ws?.terminate();
          } catch {
            // Ignore close errors
          }
          room.clients.delete(peerId);
        }
      }
      if (room.clients.size === 0) {
        this.rooms.delete(roomId);
      }
    }
  }

  public broadcastRoomTicks(): void {
    const now = Date.now();
    for (const room of this.rooms.values()) {
      if (room.clients.size === 0) continue;
      const peers = Array.from(room.clients.values()).map((c) => c.state);
      const payload = JSON.stringify({
        type: 'room:state',
        roomId: room.roomId,
        mode: room.mode,
        serverTime: now,
        peers,
      });

      for (const client of room.clients.values()) {
        if (client.ws && client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(payload);
          } catch {
            // Ignore send errors on closing sockets
          }
        }
      }
    }
  }
}

export function attachMultiplayerWebSocketServer(
  httpServer: HttpServer
): { wss: WebSocketServer; hub: MultiplayerRoomHub } {
  const hub = new MultiplayerRoomHub();
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws/multiplayer',
  });

  wss.on('connection', (ws, req) => {
    const reqUrl = new URL(req.url || '/ws/multiplayer', 'http://localhost:3000');
    const requestedRoom = reqUrl.searchParams.get('room') || 'jakarta_1';
    const rawMode = (reqUrl.searchParams.get('mode') ||
      'free_roam') as MultiplayerRoomMode;
    const displayName = reqUrl.searchParams.get('name') || 'Jawara';
    const peerId = `p_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;

    let currentRoomId = requestedRoom;
    const joined = hub.joinOrSelectRoom(
      requestedRoom,
      rawMode,
      peerId,
      displayName,
      ws
    );
    currentRoomId = joined.roomId;

    ws.send(
      JSON.stringify({
        type: 'room:init',
        peerId,
        roomId: joined.roomId,
        mode: joined.mode,
        peers: hub.getRoomPeers(joined.roomId),
        serverTime: Date.now(),
      })
    );

    ws.on('message', (rawBuf) => {
      try {
        const msg = JSON.parse(String(rawBuf)) as {
          type?: string;
          clientTime?: number;
          roomId?: string;
          mode?: MultiplayerRoomMode;
          state?: Partial<NetPeerSnapshot>;
        };

        if (msg.type === 'ping') {
          ws.send(
            JSON.stringify({
              type: 'pong',
              clientTime: msg.clientTime ?? Date.now(),
              serverTime: Date.now(),
            })
          );
          return;
        }

        if (msg.type === 'room:switch' && msg.roomId) {
          hub.removePeer(currentRoomId, peerId);
          const switched = hub.joinOrSelectRoom(
            msg.roomId,
            msg.mode || 'free_roam',
            peerId,
            displayName,
            ws
          );
          currentRoomId = switched.roomId;
          ws.send(
            JSON.stringify({
              type: 'room:init',
              peerId,
              roomId: switched.roomId,
              mode: switched.mode,
              peers: hub.getRoomPeers(switched.roomId),
              serverTime: Date.now(),
            })
          );
          return;
        }

        if (msg.type === 'peer:update' && msg.state) {
          hub.updatePeerState(currentRoomId, peerId, msg.state);
        }
      } catch {
        // Ignore malformed JSON frames
      }
    });

    ws.on('close', () => {
      hub.removePeer(currentRoomId, peerId);
    });

    ws.on('error', () => {
      hub.removePeer(currentRoomId, peerId);
    });
  });

  const tickTimer = setInterval(() => {
    hub.broadcastRoomTicks();
  }, SERVER_TICK_MS);

  const pruneTimer = setInterval(() => {
    hub.pruneStalePeers();
  }, 5000);

  wss.on('close', () => {
    clearInterval(tickTimer);
    clearInterval(pruneTimer);
  });

  return { wss, hub };
}

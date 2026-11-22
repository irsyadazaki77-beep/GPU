import type { Server as HttpServer } from 'node:http';
import { type RawData, WebSocket, WebSocketServer } from 'ws';
import type {
  MultiplayerLobbyState,
  MultiplayerRoomMode,
  NetPeerSnapshot,
  ProtagonistId,
  VehicleType,
} from '../src/game/types';
import { WORLD_MAX_BOUND } from '../src/game/world/bounds';

export const MAX_PLAYERS_PER_ROOM = 8;
export const SERVER_TICK_MS = 50; // 20Hz authoritative broadcast tick
export const MAX_WS_FRAME_BYTES = 8 * 1024; // 8KB strict incoming frame cap
export const MAX_STEP_DELTA_UNITS = 16; // Anti-teleport per-tick distance clamp
const PEER_STALE_TIMEOUT_MS = 18_000;

interface ConnectedClient {
  peerId: string;
  roomId: string;
  mode: MultiplayerRoomMode;
  ws: WebSocket | null;
  isAlive: boolean;
  lastSeenAt: number;
  state: NetPeerSnapshot;
}

interface RoomInstance {
  roomId: string;
  mode: MultiplayerRoomMode;
  clients: Map<string, ConnectedClient>;
  lobby: MultiplayerLobbyState;
}

const VALID_MODES: MultiplayerRoomMode[] = [
  'free_roam',
  'street_race',
  'coop_heist',
];

const VALID_PROTAGONISTS: ProtagonistId[] = ['nabilo', 'raka', 'kirana'];

const VALID_VEHICLES: Set<string> = new Set([
  'bajaj',
  'ojek',
  'angkot',
  'sedan',
  'metromini',
  'transjakarta',
  'polisi',
  'barracuda',
  'heli',
  'supercar',
  'vtol_jet',
  'speedboat',
]);

// Known spawn points (initial spawn + protagonist home coordinates) allowed for instant respawn/sky-switch
const KNOWN_RESPAWN_COORDS: ReadonlyArray<{ x: number; z: number }> = [
  { x: 0, z: 26 },
  { x: -12, z: 28 },
  { x: -24, z: 18 },
  { x: -34, z: -28 },
];

function isNearKnownRespawn(x: number, z: number): boolean {
  return KNOWN_RESPAWN_COORDS.some(
    (pt) => Math.hypot(x - pt.x, z - pt.z) <= 6.5
  );
}

function clampWorldCoord(n: unknown, fallback: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return fallback;
  return Math.max(-WORLD_MAX_BOUND, Math.min(WORLD_MAX_BOUND, n));
}

function computeRawByteLength(raw: RawData | string): number {
  if (typeof raw === 'string') return Buffer.byteLength(raw, 'utf-8');
  if (Buffer.isBuffer(raw)) return raw.byteLength;
  if (Array.isArray(raw)) {
    return raw.reduce((sum, buf) => sum + buf.byteLength, 0);
  }
  if (raw instanceof ArrayBuffer) return raw.byteLength;
  return 0;
}

export interface ValidatedWsClientMessage {
  type:
    | 'ping'
    | 'room:switch'
    | 'peer:update'
    | 'custom_race_sync'
    | 'coop:event'
    | 'lobby:action';
  clientTime?: number;
  roomId?: string;
  mode?: MultiplayerRoomMode;
  state?: Partial<NetPeerSnapshot>;
  track?: Record<string, unknown>;
  lobbyAction?: {
    action: 'ready' | 'start_race' | 'finish_race' | 'heist_loot';
    elapsedSec?: number;
    lootDelta?: number;
  };
  event?: {
    type:
      | 'horn'
      | 'weapon_fire'
      | 'explosion'
      | 'wanted_alert'
      | 'passenger_ping'
      | 'heist_sync'
      | 'wanted_sync';
    x: number;
    y: number;
    z: number;
    wantedLevel?: number;
    detail?: string;
  };
}

export function validateIncomingWsFrame(
  rawBuf: RawData | string
):
  | { ok: true; msg: ValidatedWsClientMessage }
  | { ok: false; reason: 'oversized_frame' | 'malformed_json' | 'invalid_schema' } {
  const byteLength = computeRawByteLength(rawBuf);
  if (byteLength <= 0 || byteLength > MAX_WS_FRAME_BYTES) {
    return { ok: false, reason: 'oversized_frame' };
  }

  let parsed: unknown;
  try {
    const text = typeof rawBuf === 'string' ? rawBuf : String(rawBuf);
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'malformed_json' };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'invalid_schema' };
  }

  const candidate = parsed as Record<string, unknown>;
  const msgType = candidate.type;
  if (
    msgType !== 'ping' &&
    msgType !== 'room:switch' &&
    msgType !== 'peer:update' &&
    msgType !== 'custom_race_sync' &&
    msgType !== 'coop:event' &&
    msgType !== 'lobby:action'
  ) {
    return { ok: false, reason: 'invalid_schema' };
  }

  if (msgType === 'room:switch') {
    if (
      typeof candidate.roomId !== 'string' ||
      candidate.roomId.trim().length === 0 ||
      candidate.roomId.length > 64
    ) {
      return { ok: false, reason: 'invalid_schema' };
    }
  }

  if (msgType === 'peer:update') {
    if (
      !candidate.state ||
      typeof candidate.state !== 'object' ||
      Array.isArray(candidate.state)
    ) {
      return { ok: false, reason: 'invalid_schema' };
    }
  }

  if (msgType === 'custom_race_sync') {
    if (
      !candidate.track ||
      typeof candidate.track !== 'object' ||
      Array.isArray(candidate.track) ||
      !Array.isArray((candidate.track as Record<string, unknown>).checkpoints) ||
      ((candidate.track as Record<string, unknown>).checkpoints as unknown[]).length < 3 ||
      ((candidate.track as Record<string, unknown>).checkpoints as unknown[]).length > 10
    ) {
      return { ok: false, reason: 'invalid_schema' };
    }
  }

  let validatedEvent: ValidatedWsClientMessage['event'];
  if (msgType === 'coop:event') {
    const ev = candidate.event as Record<string, unknown> | undefined;
    const validEvTypes = [
      'horn',
      'weapon_fire',
      'explosion',
      'wanted_alert',
      'passenger_ping',
      'heist_sync',
      'wanted_sync',
    ];
    if (
      !ev ||
      typeof ev !== 'object' ||
      !validEvTypes.includes(String(ev.type)) ||
      typeof ev.x !== 'number' ||
      !Number.isFinite(ev.x) ||
      typeof ev.z !== 'number' ||
      !Number.isFinite(ev.z)
    ) {
      return { ok: false, reason: 'invalid_schema' };
    }
    validatedEvent = {
      type: ev.type as NonNullable<ValidatedWsClientMessage['event']>['type'],
      x: clampWorldCoord(ev.x, 0),
      y: typeof ev.y === 'number' && Number.isFinite(ev.y) ? Math.max(0, Math.min(72, ev.y)) : 0,
      z: clampWorldCoord(ev.z, 0),
      wantedLevel:
        typeof ev.wantedLevel === 'number' && Number.isFinite(ev.wantedLevel)
          ? Math.max(0, Math.min(5, Math.floor(ev.wantedLevel)))
          : undefined,
      detail: typeof ev.detail === 'string' ? ev.detail.slice(0, 96) : undefined,
    };
  }

  let validatedLobbyAction: ValidatedWsClientMessage['lobbyAction'];
  if (msgType === 'lobby:action') {
    const rawAction = candidate.action;
    if (
      rawAction !== 'ready' &&
      rawAction !== 'start_race' &&
      rawAction !== 'finish_race' &&
      rawAction !== 'heist_loot'
    ) {
      return { ok: false, reason: 'invalid_schema' };
    }
    validatedLobbyAction = {
      action: rawAction,
      elapsedSec:
        typeof candidate.elapsedSec === 'number' &&
        Number.isFinite(candidate.elapsedSec) &&
        candidate.elapsedSec >= 0 &&
        candidate.elapsedSec <= 3600
          ? Math.round(candidate.elapsedSec * 10) / 10
          : undefined,
      lootDelta:
        typeof candidate.lootDelta === 'number' &&
        Number.isFinite(candidate.lootDelta) &&
        candidate.lootDelta > 0 &&
        candidate.lootDelta <= 25_000_000
          ? Math.round(candidate.lootDelta)
          : undefined,
    };
  }

  return {
    ok: true,
    msg: {
      type: msgType,
      clientTime:
        typeof candidate.clientTime === 'number' &&
        Number.isFinite(candidate.clientTime)
          ? candidate.clientTime
          : undefined,
      roomId:
        typeof candidate.roomId === 'string' ? candidate.roomId : undefined,
      mode: VALID_MODES.includes(candidate.mode as MultiplayerRoomMode)
        ? (candidate.mode as MultiplayerRoomMode)
        : undefined,
      state:
        candidate.state && typeof candidate.state === 'object'
          ? (candidate.state as Partial<NetPeerSnapshot>)
          : undefined,
      track:
        candidate.track && typeof candidate.track === 'object'
          ? (candidate.track as Record<string, unknown>)
          : undefined,
      lobbyAction: validatedLobbyAction,
      event: validatedEvent,
    },
  };
}

export class MultiplayerRoomHub {
  private readonly rooms = new Map<string, RoomInstance>();
  private antiCheatClampCount = 0;

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
        lobby: {
          roomId: targetRoomId,
          mode: cleanMode,
          raceStatus: 'idle',
          countdownSec: 0,
          readyPeerIds: [],
          placements: [],
          sharedHeistPotRp: 0,
        },
      };
      this.rooms.set(targetRoomId, room);
    }

    const now = Date.now();
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
      updatedAt: now,
    };

    room.clients.set(peerId, {
      peerId,
      roomId: targetRoomId,
      mode: room.mode,
      ws,
      isAlive: true,
      lastSeenAt: now,
      state: initialSnap,
    });

    return { roomId: targetRoomId, mode: room.mode, snapshot: initialSnap };
  }

  public markPeerAlive(roomId: string, peerId: string, nowMs: number = Date.now()): void {
    const client = this.rooms.get(roomId)?.clients.get(peerId);
    if (!client) return;
    client.isAlive = true;
    client.lastSeenAt = nowMs;
  }

  public updatePeerState(
    roomId: string,
    peerId: string,
    patch: Partial<NetPeerSnapshot>,
    nowMs: number = Date.now()
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

    let nextX = clampWorldCoord(patch.x, prev.x);
    let nextZ = clampWorldCoord(patch.z, prev.z);

    // Server-side anti-teleport / speed sanity check per tick
    const dtSec = Math.max(0.05, Math.min(0.5, (nowMs - prev.updatedAt) / 1000));
    const maxAllowedDelta = Math.max(MAX_STEP_DELTA_UNITS, 80 * dtSec);
    const dx = nextX - prev.x;
    const dz = nextZ - prev.z;
    const dist = Math.hypot(dx, dz);

    const isLegitimateRespawnOrSwitch =
      protagonist !== prev.protagonist || isNearKnownRespawn(nextX, nextZ);

    if (!isLegitimateRespawnOrSwitch && dist > maxAllowedDelta) {
      const scale = maxAllowedDelta / dist;
      nextX = clampWorldCoord(prev.x + dx * scale, prev.x);
      nextZ = clampWorldCoord(prev.z + dz * scale, prev.z);
      this.antiCheatClampCount++;
    }

    const nextVehicleType: VehicleType | null =
      patch.vehicleType === null
        ? null
        : typeof patch.vehicleType === 'string' &&
          VALID_VEHICLES.has(patch.vehicleType)
        ? (patch.vehicleType as VehicleType)
        : prev.vehicleType;

    client.isAlive = true;
    client.lastSeenAt = nowMs;
    client.state = {
      ...prev,
      displayName:
        typeof patch.displayName === 'string' && patch.displayName.trim()
          ? patch.displayName.trim().slice(0, 24)
          : prev.displayName,
      protagonist,
      x: nextX,
      y: Math.max(
        0,
        Math.min(
          72,
          typeof patch.y === 'number' && Number.isFinite(patch.y)
            ? patch.y
            : prev.y
        )
      ),
      z: nextZ,
      heading:
        typeof patch.heading === 'number' && Number.isFinite(patch.heading)
          ? patch.heading
          : prev.heading,
      speed:
        typeof patch.speed === 'number' && Number.isFinite(patch.speed)
          ? Math.max(-40, Math.min(70, patch.speed))
          : prev.speed,
      vehicleType: nextVehicleType,
      wantedLevel:
        typeof patch.wantedLevel === 'number' && Number.isFinite(patch.wantedLevel)
          ? Math.max(0, Math.min(5, Math.floor(patch.wantedLevel)))
          : prev.wantedLevel,
      ridingPeerId:
        patch.ridingPeerId === null
          ? null
          : typeof patch.ridingPeerId === 'string' && patch.ridingPeerId.length <= 48
            ? patch.ridingPeerId
            : prev.ridingPeerId,
      isCrouching:
        typeof patch.isCrouching === 'boolean' ? patch.isCrouching : prev.isCrouching,
      isParachuting:
        typeof patch.isParachuting === 'boolean'
          ? patch.isParachuting
          : prev.isParachuting,
      updatedAt: nowMs,
    };

    return client.state;
  }

  public removePeer(roomId: string, peerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.clients.delete(peerId);
    room.lobby.readyPeerIds = room.lobby.readyPeerIds.filter((id) => id !== peerId);
    if (room.clients.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  public getRoomLobby(roomId: string): MultiplayerLobbyState | null {
    return this.rooms.get(roomId)?.lobby ?? null;
  }

  public applyLobbyAction(
    roomId: string,
    peerId: string,
    action: NonNullable<ValidatedWsClientMessage['lobbyAction']>
  ): MultiplayerLobbyState | null {
    const room = this.rooms.get(roomId);
    const client = room?.clients.get(peerId);
    if (!room || !client) return null;

    if (action.action === 'ready') {
      if (room.lobby.readyPeerIds.includes(peerId)) {
        room.lobby.readyPeerIds = room.lobby.readyPeerIds.filter((id) => id !== peerId);
      } else {
        room.lobby.readyPeerIds = [...room.lobby.readyPeerIds, peerId];
      }
    } else if (action.action === 'start_race') {
      room.lobby.raceStatus = 'countdown';
      room.lobby.countdownSec = 3;
      room.lobby.placements = [];
    } else if (action.action === 'finish_race') {
      const alreadyPlaced = room.lobby.placements.some((p) => p.peerId === peerId);
      if (!alreadyPlaced) {
        room.lobby.placements = [
          ...room.lobby.placements,
          {
            peerId,
            displayName: client.state.displayName,
            finishSec: action.elapsedSec ?? 0,
          },
        ].sort((a, b) => a.finishSec - b.finishSec);
      }
      if (
        room.lobby.placements.length >= Math.max(1, room.lobby.readyPeerIds.length)
      ) {
        room.lobby.raceStatus = 'finished';
      }
    } else if (action.action === 'heist_loot' && action.lootDelta) {
      room.lobby.sharedHeistPotRp = Math.min(
        50_000_000,
        room.lobby.sharedHeistPotRp + action.lootDelta
      );
    }

    const payload = JSON.stringify({
      type: 'room:lobby',
      roomId,
      lobby: room.lobby,
      serverTime: Date.now(),
    });
    for (const c of room.clients.values()) {
      if (c.ws && c.ws.readyState === WebSocket.OPEN) {
        try {
          c.ws.send(payload);
        } catch {
          // Ignore send errors
        }
      }
    }
    return room.lobby;
  }

  public getRoomPeers(roomId: string): NetPeerSnapshot[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room.clients.values()).map((c) => c.state);
  }

  public getRoomCount(): number {
    return this.rooms.size;
  }

  public getAntiCheatClampCount(): number {
    return this.antiCheatClampCount;
  }

  public pruneStalePeers(
    nowMs: number = Date.now(),
    staleTimeoutMs: number = PEER_STALE_TIMEOUT_MS
  ): number {
    let pruned = 0;
    for (const [roomId, room] of this.rooms.entries()) {
      for (const [peerId, client] of room.clients.entries()) {
        const isStale =
          !client.isAlive || nowMs - client.lastSeenAt > staleTimeoutMs;
        if (isStale) {
          try {
            client.ws?.terminate();
          } catch {
            // Ignore close errors
          }
          room.clients.delete(peerId);
          pruned++;
        }
      }
      if (room.clients.size === 0) {
        this.rooms.delete(roomId);
      }
    }
    return pruned;
  }

  public pingConnectedSockets(nowMs: number = Date.now()): void {
    for (const room of this.rooms.values()) {
      for (const client of room.clients.values()) {
        if (client.ws && client.ws.readyState === WebSocket.OPEN) {
          if (nowMs - client.lastSeenAt > PEER_STALE_TIMEOUT_MS) {
            client.isAlive = false;
          }
          try {
            client.ws.ping();
          } catch {
            // Ignore ping errors
          }
        }
      }
    }
  }

  public broadcastRoomTicks(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.clients.size === 0) {
        this.rooms.delete(roomId);
        continue;
      }
      if (room.lobby.raceStatus === 'countdown') {
        room.lobby.countdownSec = Math.max(
          0,
          Math.round((room.lobby.countdownSec - SERVER_TICK_MS / 1000) * 100) / 100
        );
        if (room.lobby.countdownSec <= 0) {
          room.lobby.raceStatus = 'racing';
        }
      }
      const peers = Array.from(room.clients.values()).map((c) => c.state);
      const payload = JSON.stringify({
        type: 'room:state',
        roomId: room.roomId,
        mode: room.mode,
        serverTime: now,
        peers,
        lobby: room.lobby,
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

  public broadcastCustomRaceTrack(
    roomId: string,
    senderPeerId: string,
    track: Record<string, unknown>
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const payload = JSON.stringify({
      type: 'custom_race_sync',
      roomId,
      senderPeerId,
      track,
      serverTime: Date.now(),
    });
    for (const client of room.clients.values()) {
      if (client.ws && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch {
          // Ignore send errors
        }
      }
    }
  }

  public broadcastCoopEvent(
    roomId: string,
    senderPeerId: string,
    event: NonNullable<ValidatedWsClientMessage['event']>
  ): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const sender = room.clients.get(senderPeerId);
    const payload = JSON.stringify({
      type: 'coop:event',
      roomId,
      event: {
        ...event,
        peerId: senderPeerId,
        displayName: sender?.state.displayName || `Kru-${senderPeerId.slice(0, 4)}`,
        timestamp: Date.now(),
      },
    });
    for (const client of room.clients.values()) {
      if (client.peerId === senderPeerId) continue;
      if (client.ws && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(payload);
        } catch {
          // Ignore send errors
        }
      }
    }
  }
}

export function attachMultiplayerWebSocketServer(
  httpServer: HttpServer
): { wss: WebSocketServer; hub: MultiplayerRoomHub; close: () => Promise<void> } {
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
        lobby: hub.getRoomLobby(joined.roomId),
        serverTime: Date.now(),
      })
    );

    ws.on('pong', () => {
      hub.markPeerAlive(currentRoomId, peerId);
    });

    ws.on('message', (rawBuf) => {
      const validation = validateIncomingWsFrame(rawBuf);
      if (!validation.ok) {
        // Silently drop malformed JSON or oversized (> 8KB) frames
        return;
      }

      const msg = validation.msg;
      hub.markPeerAlive(currentRoomId, peerId);

      if (msg.type === 'ping') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'pong',
              clientTime: msg.clientTime ?? Date.now(),
              serverTime: Date.now(),
            })
          );
        }
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
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'room:init',
              peerId,
              roomId: switched.roomId,
              mode: switched.mode,
              peers: hub.getRoomPeers(switched.roomId),
              lobby: hub.getRoomLobby(switched.roomId),
              serverTime: Date.now(),
            })
          );
        }
        return;
      }

      if (msg.type === 'peer:update' && msg.state) {
        hub.updatePeerState(currentRoomId, peerId, msg.state);
      }

      if (msg.type === 'custom_race_sync' && msg.track) {
        hub.broadcastCustomRaceTrack(currentRoomId, peerId, msg.track);
      }

      if (msg.type === 'coop:event' && msg.event) {
        hub.broadcastCoopEvent(currentRoomId, peerId, msg.event);
      }

      if (msg.type === 'lobby:action' && msg.lobbyAction) {
        hub.applyLobbyAction(currentRoomId, peerId, msg.lobbyAction);
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
  tickTimer.unref?.();

  const pruneTimer = setInterval(() => {
    hub.pruneStalePeers();
    hub.pingConnectedSockets();
  }, 5000);
  pruneTimer.unref?.();

  wss.on('close', () => {
    clearInterval(tickTimer);
    clearInterval(pruneTimer);
  });

  const close = () =>
    new Promise<void>((resolve) => {
      clearInterval(tickTimer);
      clearInterval(pruneTimer);
      for (const client of wss.clients) {
        try {
          client.terminate();
        } catch {
          // Ignore terminate errors
        }
      }
      wss.close(() => resolve());
    });

  return { wss, hub, close };
}

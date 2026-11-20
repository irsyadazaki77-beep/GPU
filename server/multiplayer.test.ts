import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { WebSocket } from 'ws';
import { computeReconnectBackoffSec } from '../src/engine/netSync';
import type { NetPeerSnapshot } from '../src/game/types';
import {
  MAX_PLAYERS_PER_ROOM,
  MAX_STEP_DELTA_UNITS,
  MAX_WS_FRAME_BYTES,
  MultiplayerRoomHub,
  attachMultiplayerWebSocketServer,
  validateIncomingWsFrame,
} from './multiplayer';

interface WsInitMessage {
  type: 'room:init';
  peerId: string;
  roomId: string;
  mode: string;
  peers: NetPeerSnapshot[];
}

interface WsStateMessage {
  type: 'room:state';
  roomId: string;
  mode: string;
  peers: NetPeerSnapshot[];
}

function connectTestClient(
  wsBaseUrl: string,
  room: string,
  mode: string = 'free_roam',
  name: string = 'Tester'
): Promise<{ ws: WebSocket; initMsg: WsInitMessage }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(
      `${wsBaseUrl}/ws/multiplayer?room=${encodeURIComponent(
        room
      )}&mode=${encodeURIComponent(mode)}&name=${encodeURIComponent(name)}`
    );
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error('Timed out waiting for room:init'));
    }, 4000);

    ws.on('message', function onFirstMsg(raw) {
      try {
        const msg = JSON.parse(String(raw)) as WsInitMessage;
        if (msg.type === 'room:init') {
          clearTimeout(timer);
          ws.off('message', onFirstMsg);
          resolve({ ws, initMsg: msg });
        }
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForMessage<T>(
  ws: WebSocket,
  predicate: (msg: T) => boolean,
  timeoutMs: number = 2500
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', onMsg);
      reject(new Error('Timed out waiting for matching WS message'));
    }, timeoutMs);

    function onMsg(raw: unknown) {
      try {
        const parsed = JSON.parse(String(raw)) as T;
        if (predicate(parsed)) {
          clearTimeout(timer);
          ws.off('message', onMsg);
          resolve(parsed);
        }
      } catch {
        // Ignore parse errors
      }
    }

    ws.on('message', onMsg);
  });
}

test('Multiplayer unit checks: frame validation, anti-teleport sanity clamping, zombie pruning, and client exponential backoff', () => {
  // 1. Exponential backoff: 1s -> 2s -> 4s -> 8s -> max 15s
  assert.equal(computeReconnectBackoffSec(0), 1);
  assert.equal(computeReconnectBackoffSec(1), 2);
  assert.equal(computeReconnectBackoffSec(2), 4);
  assert.equal(computeReconnectBackoffSec(3), 8);
  assert.equal(computeReconnectBackoffSec(4), 15);
  assert.equal(computeReconnectBackoffSec(9), 15);

  // 2. Frame validation: oversized > 8KB & malformed JSON rejected
  const oversized = 'x'.repeat(MAX_WS_FRAME_BYTES + 100);
  const overCheck = validateIncomingWsFrame(oversized);
  assert.equal(overCheck.ok, false);
  if (!overCheck.ok) {
    assert.equal(overCheck.reason, 'oversized_frame');
  }

  const badJsonCheck = validateIncomingWsFrame('{bad json');
  assert.equal(badJsonCheck.ok, false);

  const unknownTypeCheck = validateIncomingWsFrame(
    JSON.stringify({ type: 'hack:teleport' })
  );
  assert.equal(unknownTypeCheck.ok, false);

  // 3. Anti-teleport clamping on MultiplayerRoomHub
  const hub = new MultiplayerRoomHub();
  const joined = hub.joinOrSelectRoom(
    'scbd_test',
    'free_roam',
    'peer_1',
    'Nabilo'
  );
  assert.equal(joined.snapshot.x, 0);
  assert.equal(joined.snapshot.z, 26);

  // Legitimate movement within tick speed limit passes through
  const step1 = hub.updatePeerState(
    joined.roomId,
    'peer_1',
    { x: 3, z: 24, speed: 22 },
    joined.snapshot.updatedAt + 50
  );
  assert.ok(step1);
  assert.equal(step1.x, 3);
  assert.equal(step1.z, 24);
  assert.equal(hub.getAntiCheatClampCount(), 0);

  // Impossible teleport jump (e.g. +80 units in 50ms) is clamped to MAX_STEP_DELTA_UNITS
  const teleportAttempt = hub.updatePeerState(
    joined.roomId,
    'peer_1',
    { x: 83, z: 24, speed: 999 },
    step1.updatedAt + 50
  );
  assert.ok(teleportAttempt);
  assert.equal(hub.getAntiCheatClampCount(), 1);
  assert.ok(
    teleportAttempt.x <= 3 + MAX_STEP_DELTA_UNITS + 0.01,
    `Expected teleport X to be clamped, got ${teleportAttempt.x}`
  );
  assert.equal(teleportAttempt.speed, 70); // Speed clamped to max 70

  // Stale peer pruning cleans up zombie sockets and removes empty room
  const prunedCount = hub.pruneStalePeers(teleportAttempt.updatedAt + 25_000);
  assert.equal(prunedCount, 1);
  assert.equal(hub.getRoomCount(), 0);
});

test('Ephemeral WebSocket server: room join/leave, 8-player room cap overflow, 20Hz broadcast, malformed frame resilience, and clean teardown', async () => {
  const httpServer = createServer();
  const mp = attachMultiplayerWebSocketServer(httpServer);

  await new Promise<void>((resolve) =>
    httpServer.listen(0, '127.0.0.1', resolve)
  );
  const port = (httpServer.address() as AddressInfo).port;
  const wsBaseUrl = `ws://127.0.0.1:${port}`;
  const openSockets: WebSocket[] = [];

  try {
    // 1. Connect 8 clients to 'balap_liar' street_race room (fills room to MAX_PLAYERS_PER_ROOM = 8)
    for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
      const { ws, initMsg } = await connectTestClient(
        wsBaseUrl,
        'balap_liar',
        'street_race',
        `Racer_${i + 1}`
      );
      openSockets.push(ws);
      assert.equal(initMsg.roomId, 'balap_liar');
      assert.equal(initMsg.mode, 'street_race');
    }

    // 2. 9th client joining 'balap_liar' must overflow into 'balap_liar_2'
    const ninth = await connectTestClient(
      wsBaseUrl,
      'balap_liar',
      'street_race',
      'Racer_9'
    );
    openSockets.push(ninth.ws);
    assert.equal(ninth.initMsg.roomId, 'balap_liar_2');
    assert.equal(mp.hub.getRoomPeers('balap_liar').length, 8);
    assert.equal(mp.hub.getRoomPeers('balap_liar_2').length, 1);

    // 3. Verify 20Hz state broadcast between Client 1 and Client 2 in 'balap_liar'
    const client1 = openSockets[0];
    const client2 = openSockets[1];

    // Send malformed JSON and oversized > 8KB frame from client1 — server must not crash
    client1.send('{malformed_json_frame');
    client1.send('A'.repeat(MAX_WS_FRAME_BYTES + 512));

    // Send valid peer:update from client1
    client1.send(
      JSON.stringify({
        type: 'peer:update',
        state: {
          protagonist: 'raka',
          x: 6,
          y: 0,
          z: 22,
          heading: 1.5,
          speed: 18,
          vehicleType: 'supercar',
        },
      })
    );

    const broadcastMsg = await waitForMessage<WsStateMessage>(
      client2,
      (m) =>
        m.type === 'room:state' &&
        Array.isArray(m.peers) &&
        m.peers.some((p) => p.protagonist === 'raka' && p.x === 6 && p.z === 22)
    );
    assert.equal(broadcastMsg.roomId, 'balap_liar');
    assert.equal(broadcastMsg.peers.length, 8);

    // 4. Close all sockets and verify rooms are deterministically cleaned up
    await Promise.all(
      openSockets.map(
        (sock) =>
          new Promise<void>((resolve) => {
            if (sock.readyState === WebSocket.CLOSED) {
              resolve();
              return;
            }
            sock.once('close', () => resolve());
            sock.close();
          })
      )
    );
    openSockets.length = 0;

    // Wait briefly for close handlers to fire on server
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(mp.hub.getRoomCount(), 0);
  } finally {
    for (const sock of openSockets) {
      try {
        sock.terminate();
      } catch {
        // Ignore
      }
    }
    await mp.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
});

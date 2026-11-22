import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { createApiApp } from '../server';
import { CloudSaveStore } from './cloudSave';
import {
  SocialHubStore,
  checkSocialHubRateLimit,
  resetSocialHubRateLimiter,
  validateLeaderboardSubmit,
  validateUgcTrackPayload,
} from './socialHub';

test('validateLeaderboardSubmit & validateUgcTrackPayload reject malformed inputs cleanly', () => {
  assert.equal(validateLeaderboardSubmit(null).valid, false);
  assert.equal(
    validateLeaderboardSubmit({
      category: 'invalid_cat',
      targetId: 'etle_1',
      scoreValue: 120,
    }).valid,
    false
  );
  assert.equal(
    validateLeaderboardSubmit({
      category: 'etle_speed',
      targetId: 'etle_sudirman_hi',
      targetName: 'Sudirman',
      playerName: '<Nabilo>',
      scoreValue: 192,
      metricLabel: '192 km/jam',
    }).valid,
    true
  );

  assert.equal(
    validateUgcTrackPayload({
      name: 'No',
      checkpoints: [[0, 0]],
    }).valid,
    false
  );
  const trackCheck = validateUgcTrackPayload({
    id: 'track_monas_night',
    name: 'Monas Drift Loop',
    authorName: 'Raka',
    checkpoints: [
      [0, -24],
      [28, -24],
      [28, 24],
    ],
  });
  assert.equal(trackCheck.valid, true);
  if (trackCheck.valid) {
    assert.ok(trackCheck.track.rewardRp >= 45000);
  }
});

test('SocialHubStore + HTTP endpoints persist leaderboard & UGC tracks in SQLite', async () => {
  resetSocialHubRateLimiter();
  const cloudStore = new CloudSaveStore({
    dbPath: ':memory:',
    legacyJsonPath: null,
  });
  const hubStore = new SocialHubStore({ dbPath: ':memory:' });
  const app = createApiApp({
    cloudSaveStore: cloudStore,
    socialHubStore: hubStore,
  });
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Seeded leaderboard entries should exist immediately
    const initLbRes = await fetch(`${baseUrl}/api/leaderboard?category=etle_speed`);
    assert.equal(initLbRes.status, 200);
    const initLb = (await initLbRes.json()) as {
      entries: { scoreValue: number; targetId: string }[];
    };
    assert.ok(initLb.entries.length >= 2);

    // 2. Submit new top ETLE record
    const postLbRes = await fetch(`${baseUrl}/api/leaderboard/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Player-Token': 'plr_hub_test_token_111',
      },
      body: JSON.stringify({
        category: 'etle_speed',
        targetId: 'etle_jorr_selatan',
        targetName: 'ETLE Tol Lingkar Luar JORR',
        playerName: 'Kirana Hyper',
        protagonistId: 'kirana',
        scoreValue: 224,
        metricLabel: '224 km/jam',
      }),
    });
    assert.equal(postLbRes.status, 200);

    const afterLbRes = await fetch(`${baseUrl}/api/leaderboard?category=etle_speed`);
    const afterLb = (await afterLbRes.json()) as {
      entries: { scoreValue: number; playerName: string }[];
    };
    assert.equal(afterLb.entries[0]?.playerName, 'Kirana Hyper');
    assert.equal(afterLb.entries[0]?.scoreValue, 224);

    // 3. Publish UGC track -> Like -> Play increment
    const pubTrackRes = await fetch(`${baseUrl}/api/ugc/tracks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'ugc_glodok_gp',
        name: 'Glodok Midnight Sprint',
        authorName: 'Nabilo',
        checkpoints: [
          [10, -10],
          [50, -10],
          [50, 30],
          [10, 30],
        ],
      }),
    });
    assert.equal(pubTrackRes.status, 200);

    const likeRes = await fetch(`${baseUrl}/api/ugc/tracks/ugc_glodok_gp/like`, {
      method: 'POST',
    });
    assert.equal(likeRes.status, 200);
    const likedJson = (await likeRes.json()) as {
      track: { likes: number; plays: number };
    };
    assert.equal(likedJson.track.likes, 1);

    const playRes = await fetch(`${baseUrl}/api/ugc/tracks/ugc_glodok_gp/play`, {
      method: 'POST',
    });
    assert.equal(playRes.status, 200);
    const playedJson = (await playRes.json()) as {
      track: { plays: number };
    };
    assert.equal(playedJson.track.plays, 1);

    const listRes = await fetch(`${baseUrl}/api/ugc/tracks`);
    const listJson = (await listRes.json()) as {
      tracks: { id: string; likes: number }[];
    };
    assert.ok(listJson.tracks.some((t) => t.id === 'ugc_glodok_gp' && t.likes === 1));

    // 4. Rate limiter protects burst writes
    const now = 5_000_000;
    for (let i = 0; i < 15; i++) {
      assert.equal(checkSocialHubRateLimit('burst_client', now + i).allowed, true);
    }
    assert.equal(checkSocialHubRateLimit('burst_client', now + 50).allowed, false);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    hubStore.close();
    cloudStore.close();
  }
});

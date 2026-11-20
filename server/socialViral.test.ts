import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkViralRateLimit,
  generateViralSocialPost,
  resetViralRateLimiter,
  sanitizeSocialText,
} from './socialViral';

test('sanitizeSocialText strips control characters and HTML-like tokens', () => {
  const clean = sanitizeSocialText('  <script>\nHalo Jakarta\t{test}  ', 50);
  assert.equal(clean, 'script Halo Jakarta test');
});

test('generateViralSocialPost returns deterministic Jakarta slang fallback when API key is missing', async () => {
  const result = await generateViralSocialPost(
    {
      triggerKind: 'police_chase',
      districtName: 'Koridor Sudirman - Thamrin',
      protagonistName: 'Nabilo',
      wantedLevel: 3,
      vehicleName: 'Garuda GT-X',
    },
    undefined
  );

  assert.equal(result.source, 'local');
  assert.ok(result.authorHandle.startsWith('@'));
  assert.ok(result.caption.includes('Sudirman'));
  assert.ok(result.hashtags.length >= 2);
  assert.ok(result.comments.length >= 1);
});

test('checkViralRateLimit enforces rate window per client key', () => {
  resetViralRateLimiter();
  const baseTs = 100_000;
  for (let i = 0; i < 10; i++) {
    const check = checkViralRateLimit('client-a', baseTs + i * 100);
    assert.equal(check.allowed, true);
  }
  const blocked = checkViralRateLimit('client-a', baseTs + 1500);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);

  // After window expires, requests are allowed again
  const allowedAfter = checkViralRateLimit('client-a', baseTs + 13_000);
  assert.equal(allowedAfter.allowed, true);
});

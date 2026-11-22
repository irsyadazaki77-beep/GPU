import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVoiceCacheKey,
  checkNpcVoiceRateLimit,
  clearVoiceCache,
  generateNpcVoice,
  getVoiceCacheEntry,
  getVoiceCacheSize,
  putVoiceCacheEntry,
  resetNpcVoiceRateLimiter,
  resolveJakartaNpcVoiceName,
} from './npcVoice';

test('resolveJakartaNpcVoiceName maps Jakarta characters to distinct Gemini voice personas', () => {
  assert.equal(resolveJakartaNpcVoiceName('Kirana Larasati'), 'Kore');
  assert.equal(resolveJakartaNpcVoiceName('Komisaris Hendro'), 'Charon');
  assert.equal(resolveJakartaNpcVoiceName('Raka Suryo'), 'Fenrir');
  assert.equal(resolveJakartaNpcVoiceName('Dimas Siber'), 'Zephyr');
  assert.equal(resolveJakartaNpcVoiceName('Nabilo Monas'), 'Puck');
});

test('npcVoice LRU cache promotes hits and bounds total entries cleanly', () => {
  clearVoiceCache();
  const k1 = buildVoiceCacheKey('Puck', 'tegang', 'Awas polisi!');
  const k2 = buildVoiceCacheKey('Kore', 'tenang', 'Sistem aman.');

  putVoiceCacheEntry(
    k1,
    {
      audioBase64: 'AAA=',
      mimeType: 'audio/wav',
      voiceName: 'Puck',
      source: 'gemini_tts',
      cacheHit: false,
    },
    2
  );
  putVoiceCacheEntry(
    k2,
    {
      audioBase64: 'BBB=',
      mimeType: 'audio/wav',
      voiceName: 'Kore',
      source: 'gemini_tts',
      cacheHit: false,
    },
    2
  );
  assert.equal(getVoiceCacheSize(), 2);

  // Touch k1 so k2 becomes LRU and gets evicted by k3
  const hit1 = getVoiceCacheEntry(k1);
  assert.equal(hit1?.cacheHit, true);

  const k3 = buildVoiceCacheKey('Fenrir', 'marah', 'Gas terus!');
  putVoiceCacheEntry(
    k3,
    {
      audioBase64: 'CCC=',
      mimeType: 'audio/wav',
      voiceName: 'Fenrir',
      source: 'gemini_tts',
      cacheHit: false,
    },
    2
  );
  assert.equal(getVoiceCacheSize(), 2);
  assert.equal(getVoiceCacheEntry(k2), undefined);
  assert.ok(getVoiceCacheEntry(k1));
  assert.ok(getVoiceCacheEntry(k3));
});

test('checkNpcVoiceRateLimit blocks abusive bursts and recovers after window', () => {
  resetNpcVoiceRateLimiter();
  const base = 1_000_000;
  for (let i = 0; i < 10; i++) {
    const r = checkNpcVoiceRateLimit('10.0.0.5', base + i * 20);
    assert.equal(r.allowed, true);
  }
  const blocked = checkNpcVoiceRateLimit('10.0.0.5', base + 300);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterMs > 0);

  // Different IP remains unaffected
  assert.equal(checkNpcVoiceRateLimit('10.0.0.6', base + 300).allowed, true);

  // Window resets cleanly after 10 seconds
  assert.equal(checkNpcVoiceRateLimit('10.0.0.5', base + 10_500).allowed, true);
});

test('generateNpcVoice falls back cleanly without API key', async () => {
  clearVoiceCache();
  const res = await generateNpcVoice(
    { speakerName: 'Kirana Larasati', text: 'Sinyal CCTV siap dibajak!' },
    undefined
  );
  assert.equal(res.source, 'fallback');
  assert.equal(res.audioBase64, null);
  assert.equal(res.voiceName, 'Kore');
});

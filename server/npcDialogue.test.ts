import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFallbackNpcDialogue,
  checkNpcDialogueRateLimit,
  generateNpcDialogue,
  resetNpcDialogueRateLimiter,
  sanitizeDialogueInput,
  sanitizeWorldContext,
} from './npcDialogue';
import {
  buildVoiceCacheKey,
  clearVoiceCache,
  generateNpcVoice,
  getVoiceCacheEntry,
  getVoiceCacheSize,
  putVoiceCacheEntry,
  resolveJakartaNpcVoiceName,
} from './npcVoice';

test('sanitizeDialogueInput strips unsafe markup and clamps length', () => {
  const dirty = '  <script>alert(1)</script>\n\tInfo `jalur` {tikus} Sudirman  ';
  const cleaned = sanitizeDialogueInput(dirty);
  assert.ok(!cleaned.includes('<'));
  assert.ok(!cleaned.includes('>'));
  assert.ok(!cleaned.includes('`'));
  assert.ok(!cleaned.includes('{'));
  assert.ok(cleaned.includes('Info jalur tikus Sudirman'));
});

test('checkNpcDialogueRateLimit enforces sliding window quota per client key', () => {
  resetNpcDialogueRateLimiter();
  const baseTime = 1_700_000_000_000;

  for (let i = 0; i < 12; i++) {
    const res = checkNpcDialogueRateLimit('ip_127_0_0_1', baseTime + i * 100);
    assert.equal(res.allowed, true);
  }

  const blocked = checkNpcDialogueRateLimit('ip_127_0_0_1', baseTime + 1500);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.ok(blocked.retryAfterMs > 0);

  // Another client key is unaffected
  const otherClient = checkNpcDialogueRateLimit('ip_10_0_0_2', baseTime + 1500);
  assert.equal(otherClient.allowed, true);

  // After window expires (10s), client is allowed again
  const recovered = checkNpcDialogueRateLimit('ip_127_0_0_1', baseTime + 11_000);
  assert.equal(recovered.allowed, true);
});

test('generateNpcDialogue falls back deterministically when GEMINI_API_KEY is unset and incorporates WorldContextSnapshot', async () => {
  const ctx = sanitizeWorldContext(
    {
      activeProtagonist: 'Kirana',
      currentDistrict: 'SCBD Sudirman',
      wantedLevel: 2,
      factionStandings: { jalanan: 45, sindikat: 70, rakyat: 55 },
      ownedTurfCount: 5,
      recentEvents: [
        'Grand Heist Bank Sentral Tuntas (+Rp 2.400.000)',
        'Menang Balap Liar Tol Layang Semanggi',
        'Sabotase Saham BAJSA: SCBD Anjlok',
        'Event Ke-4 yang Harus Dipotong',
      ],
    },
    'SCBD Sudirman',
    2,
    { jalanan: 45, sindikat: 70, rakyat: 55 }
  );

  assert.equal(ctx.activeProtagonist, 'Kirana');
  assert.equal(ctx.ownedTurfCount, 5);
  assert.equal(ctx.recentEvents.length, 3);

  const response = await generateNpcDialogue(
    {
      npcName: 'Laksamana Karin',
      npcRole: 'Informan Pelabuhan & Siber',
      locationName: 'SCBD Sudirman',
      missionTitle: 'Operasi Protokol SCBD',
      playerPrompt: 'Ada kerjaan cepat berbayar?',
      origin: 'teknisi_glodok',
      wantedLevel: 2,
      reputation: { jalanan: 45, sindikat: 70, rakyat: 55 },
      worldContext: ctx,
    },
    undefined // Explicitly unset API key
  );

  assert.equal(response.source, 'fallback');
  assert.ok(response.reply.includes('Kirana'));
  assert.ok(response.reply.includes('Grand Heist Bank Sentral Tuntas'));
  assert.ok(response.reply.includes('5 distrik'));
  assert.ok(response.sideQuest);
  assert.equal(response.sideQuest.faction, 'sindikat');
  assert.ok(response.worldMemorySummary?.includes('Kirana'));

  const directFallback = buildFallbackNpcDialogue({
    npcName: 'Bang Jali',
    npcRole: 'Koordinator Lapangan',
    locationName: 'Tanah Abang',
    missionTitle: 'Sabuk Pasar',
    playerPrompt: 'Info patroli polisi?',
    origin: 'anak_jalanan',
    wantedLevel: 4,
    reputation: { jalanan: 80, sindikat: 20, rakyat: 50 },
    worldContext: {
      activeProtagonist: 'Raka',
      currentDistrict: 'Pasar Tanah Abang',
      wantedLevel: 4,
      factionStandings: { jalanan: 80, sindikat: 20, rakyat: 50 },
      ownedTurfCount: 3,
      recentEvents: ['Rebut Teritori Tanah Abang'],
    },
  });
  assert.ok(directFallback.reply.includes('Raka'));
  assert.equal(directFallback.tone, 'Tegang (Siaga Polisi)');
});

test('npcVoice LRU cache hashes voicePersona + normalizedText and evicts least-recently-used entries', async () => {
  clearVoiceCache();
  assert.equal(resolveJakartaNpcVoiceName('Kirana Siber'), 'Kore');
  assert.equal(resolveJakartaNpcVoiceName('Raka Tigers'), 'Fenrir');

  const keyA = buildVoiceCacheKey('Kore', 'Tegas', 'Halo   Jakarta!');
  const keyA2 = buildVoiceCacheKey('Kore', 'tegas', 'halo jakarta!');
  assert.equal(keyA, keyA2, 'Normalized text and tone should produce identical cache keys');

  putVoiceCacheEntry(
    'k1',
    { audioBase64: 'AAA', mimeType: 'audio/wav', voiceName: 'Kore', source: 'gemini_tts' },
    3
  );
  putVoiceCacheEntry(
    'k2',
    { audioBase64: 'BBB', mimeType: 'audio/wav', voiceName: 'Fenrir', source: 'gemini_tts' },
    3
  );
  putVoiceCacheEntry(
    'k3',
    { audioBase64: 'CCC', mimeType: 'audio/wav', voiceName: 'Puck', source: 'gemini_tts' },
    3
  );
  assert.equal(getVoiceCacheSize(), 3);

  // Touch k1 so k2 becomes the least-recently-used entry
  const hitK1 = getVoiceCacheEntry('k1');
  assert.ok(hitK1);
  assert.equal(hitK1.cacheHit, true);

  // Insert k4 with maxEntries = 3 -> should evict k2
  putVoiceCacheEntry(
    'k4',
    { audioBase64: 'DDD', mimeType: 'audio/wav', voiceName: 'Charon', source: 'gemini_tts' },
    3
  );
  assert.equal(getVoiceCacheSize(), 3);
  assert.equal(getVoiceCacheEntry('k2'), undefined);
  assert.ok(getVoiceCacheEntry('k1'));
  assert.ok(getVoiceCacheEntry('k4'));

  // Offline fallback when API key is unset
  const fallbackVoice = await generateNpcVoice(
    { text: 'Siapkan kru di bundaran HI sekarang.', speakerName: 'Nabilo' },
    ''
  );
  assert.equal(fallbackVoice.source, 'fallback');
  assert.equal(fallbackVoice.audioBase64, null);
});

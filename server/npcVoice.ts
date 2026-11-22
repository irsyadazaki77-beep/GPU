import { GoogleGenAI } from '@google/genai';
import type { NpcVoiceRequest, NpcVoiceResponse } from '../src/game/types';
import { sanitizeDialogueInput } from './npcDialogue';

const GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const MAX_TEXT_LENGTH = 260;
export const MAX_VOICE_CACHE_SIZE = 48;
const VOICE_RATE_LIMIT_WINDOW_MS = 10_000;
const VOICE_RATE_LIMIT_MAX_REQUESTS = 10;

const voiceLruCache = new Map<string, NpcVoiceResponse>();
const voiceRateBuckets = new Map<string, number[]>();

export function checkNpcVoiceRateLimit(
  clientKey: string = 'default',
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const key = clientKey.trim() || 'default';
  const prev = voiceRateBuckets.get(key) || [];
  const active = prev.filter((ts) => nowMs - ts < VOICE_RATE_LIMIT_WINDOW_MS);

  if (active.length >= VOICE_RATE_LIMIT_MAX_REQUESTS) {
    const oldest = active[0] ?? nowMs;
    const retryAfterMs = Math.max(100, VOICE_RATE_LIMIT_WINDOW_MS - (nowMs - oldest));
    voiceRateBuckets.set(key, active);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  active.push(nowMs);
  voiceRateBuckets.set(key, active);
  return {
    allowed: true,
    remaining: Math.max(0, VOICE_RATE_LIMIT_MAX_REQUESTS - active.length),
    retryAfterMs: 0,
  };
}

export function resetNpcVoiceRateLimiter(): void {
  voiceRateBuckets.clear();
}

function fnv1aHash(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

export function buildVoiceCacheKey(
  voicePersona: string,
  tone: string | undefined,
  rawText: string
): string {
  const normalizedText = sanitizeDialogueInput(rawText)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedTone = (tone || 'default').toLowerCase().trim();
  return `v_${voicePersona}_${fnv1aHash(`${voicePersona}|${normalizedTone}|${normalizedText}`)}`;
}

export function getVoiceCacheEntry(key: string): NpcVoiceResponse | undefined {
  const existing = voiceLruCache.get(key);
  if (!existing) return undefined;
  // Promote to most-recently-used (MRU)
  voiceLruCache.delete(key);
  voiceLruCache.set(key, { ...existing, cacheHit: true });
  return voiceLruCache.get(key);
}

export function putVoiceCacheEntry(
  key: string,
  value: NpcVoiceResponse,
  maxEntries: number = MAX_VOICE_CACHE_SIZE
): void {
  if (voiceLruCache.has(key)) {
    voiceLruCache.delete(key);
  } else if (voiceLruCache.size >= maxEntries) {
    const lruKey = voiceLruCache.keys().next().value;
    if (lruKey !== undefined) {
      voiceLruCache.delete(lruKey);
    }
  }
  voiceLruCache.set(key, value);
}

export function getVoiceCacheSize(): number {
  return voiceLruCache.size;
}

export function clearVoiceCache(): void {
  voiceLruCache.clear();
}

function hasUsableApiKey(apiKey: string | undefined): apiKey is string {
  if (!apiKey) return false;
  const trimmed = apiKey.trim();
  return (
    trimmed.length > 10 &&
    trimmed !== 'MY_GEMINI_API_KEY' &&
    trimmed !== 'your_api_key_here'
  );
}

export function resolveJakartaNpcVoiceName(speakerName: string): string {
  const lower = speakerName.toLowerCase();
  if (
    lower.includes('komisaris') ||
    lower.includes('bos') ||
    lower.includes('hendro') ||
    lower.includes('panglima')
  ) {
    return 'Charon';
  }
  if (
    lower.includes('kirana') ||
    /\bsari\b/.test(lower) ||
    /\bibu\b/.test(lower) ||
    lower.includes('dewi') ||
    lower.includes('ratna') ||
    lower.includes('karin')
  ) {
    return 'Kore';
  }
  if (
    lower.includes('raka') ||
    lower.includes('tigers') ||
    lower.includes('jali')
  ) {
    return 'Fenrir';
  }
  if (lower.includes('dimas') || lower.includes('siber')) {
    return 'Zephyr';
  }
  return 'Puck';
}

export async function generateNpcVoice(
  rawReq: NpcVoiceRequest,
  apiKey: string | undefined = process.env.GEMINI_API_KEY
): Promise<NpcVoiceResponse> {
  const cleanText = sanitizeDialogueInput(rawReq.text).slice(0, MAX_TEXT_LENGTH);
  const voiceName = resolveJakartaNpcVoiceName(rawReq.speakerName || 'Nabilo');

  if (!cleanText) {
    return {
      audioBase64: null,
      mimeType: 'audio/wav',
      voiceName,
      source: 'fallback',
      cacheHit: false,
    };
  }

  const cacheKey = buildVoiceCacheKey(voiceName, rawReq.tone, cleanText);
  const cached = getVoiceCacheEntry(cacheKey);
  if (cached) {
    return cached;
  }

  if (!hasUsableApiKey(apiKey)) {
    return {
      audioBase64: null,
      mimeType: 'audio/wav',
      voiceName,
      source: 'fallback',
      cacheHit: false,
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const styleDesc = rawReq.tone
      ? `Natural Indonesian voice acting with tone: ${rawReq.tone}`
      : 'Confident, street-smart Indonesian voice acting for a Jakarta crime drama';

    const response = await ai.models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: styleDesc,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.[0];
    const base64Audio = part?.inlineData?.data;
    const mimeType = part?.inlineData?.mimeType || 'audio/wav';

    if (!base64Audio) {
      return {
        audioBase64: null,
        mimeType: 'audio/wav',
        voiceName,
        source: 'fallback',
        cacheHit: false,
      };
    }

    const result: NpcVoiceResponse = {
      audioBase64: base64Audio,
      mimeType,
      voiceName,
      source: 'gemini_tts',
      cacheHit: false,
    };

    putVoiceCacheEntry(cacheKey, result);
    return result;
  } catch {
    return {
      audioBase64: null,
      mimeType: 'audio/wav',
      voiceName,
      source: 'fallback',
      cacheHit: false,
    };
  }
}

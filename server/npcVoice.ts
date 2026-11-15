import { GoogleGenAI } from '@google/genai';
import type { NpcVoiceRequest, NpcVoiceResponse } from '../src/game/types';
import { sanitizeDialogueInput } from './npcDialogue';

const GEMINI_TTS_MODEL = 'gemini-3.8-flash-lite-tts';
const MAX_TEXT_LENGTH = 260;
const MAX_VOICE_CACHE_SIZE = 40;

const voiceCache = new Map<string, NpcVoiceResponse>();

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
    lower.includes('kirana') ||
    lower.includes('sari') ||
    lower.includes('ibu') ||
    lower.includes('dewi') ||
    lower.includes('ratna')
  ) {
    return 'Kore';
  }
  if (
    lower.includes('komisaris') ||
    lower.includes('bos') ||
    lower.includes('hendro') ||
    lower.includes('panglima')
  ) {
    return 'Charon';
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
    };
  }

  const cacheKey = `${voiceName}|${rawReq.tone || ''}|${cleanText}`;
  const cached = voiceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (!hasUsableApiKey(apiKey)) {
    return {
      audioBase64: null,
      mimeType: 'audio/wav',
      voiceName,
      source: 'fallback',
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
      };
    }

    const result: NpcVoiceResponse = {
      audioBase64: base64Audio,
      mimeType,
      voiceName,
      source: 'gemini_tts',
    };

    if (voiceCache.size >= MAX_VOICE_CACHE_SIZE) {
      const oldestKey = voiceCache.keys().next().value;
      if (oldestKey) voiceCache.delete(oldestKey);
    }
    voiceCache.set(cacheKey, result);

    return result;
  } catch {
    return {
      audioBase64: null,
      mimeType: 'audio/wav',
      voiceName,
      source: 'fallback',
    };
  }
}

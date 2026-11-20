import { GoogleGenAI, Type } from '@google/genai';
import { buildLocalViralPost } from '../src/game/nextGenSystems';
import type {
  NabiloGramTriggerKind,
  ViralPostRequest,
  ViralPostResponse,
} from '../src/game/types';

const GEMINI_MODEL = 'gemini-4-hydrogen';
const RATE_WINDOW_MS = 12_000;
const RATE_MAX = 10;
const rateBuckets = new Map<string, number[]>();

const VALID_TRIGGERS = new Set<NabiloGramTriggerKind>([
  'drift_stunt',
  'chain_explosion',
  'police_chase',
  'police_escape',
  'street_event',
  'heist_complete',
  'warung_viral',
  'manual_snap',
]);

export function sanitizeSocialText(raw: unknown, maxLen: number = 140): string {
  return String(raw ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>`{}]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function checkViralRateLimit(
  clientKey: string = 'default',
  nowMs: number = Date.now()
): { allowed: boolean; retryAfterMs: number } {
  const key = clientKey.trim() || 'default';
  const prev = rateBuckets.get(key) || [];
  const active = prev.filter((ts) => nowMs - ts < RATE_WINDOW_MS);
  if (active.length >= RATE_MAX) {
    const oldest = active[0] ?? nowMs;
    rateBuckets.set(key, active);
    return {
      allowed: false,
      retryAfterMs: Math.max(150, RATE_WINDOW_MS - (nowMs - oldest)),
    };
  }
  active.push(nowMs);
  rateBuckets.set(key, active);
  return { allowed: true, retryAfterMs: 0 };
}

export function resetViralRateLimiter(): void {
  rateBuckets.clear();
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

export function buildFallbackViralResponse(
  req: ViralPostRequest
): ViralPostResponse {
  const local = buildLocalViralPost({
    id: 'local_srv',
    triggerKind: VALID_TRIGGERS.has(req.triggerKind)
      ? req.triggerKind
      : 'manual_snap',
    districtName: sanitizeSocialText(req.districtName, 60) || 'Sudirman',
    protagonistName: sanitizeSocialText(req.protagonistName, 32) || 'Nabilo',
    wantedLevel: Math.max(0, Math.min(5, Math.floor(req.wantedLevel || 0))),
    vehicleName: sanitizeSocialText(req.vehicleName, 40) || undefined,
    snapshotDataUrl: null,
    summaryNote: sanitizeSocialText(req.summaryNote, 140) || undefined,
  });

  return {
    authorHandle: local.authorHandle,
    authorTag: local.authorTag,
    caption: local.caption,
    hashtags: local.hashtags,
    comments: local.comments.map((c) => ({
      handle: c.handle,
      text: c.text,
      likes: c.likes,
    })),
    source: 'local',
  };
}

export async function generateViralSocialPost(
  rawReq: ViralPostRequest,
  apiKey: string | undefined = process.env.GEMINI_API_KEY
): Promise<ViralPostResponse> {
  const req: ViralPostRequest = {
    triggerKind: VALID_TRIGGERS.has(rawReq.triggerKind)
      ? rawReq.triggerKind
      : 'manual_snap',
    districtName: sanitizeSocialText(rawReq.districtName, 60) || 'Sudirman',
    protagonistName: sanitizeSocialText(rawReq.protagonistName, 32) || 'Nabilo',
    wantedLevel: Math.max(0, Math.min(5, Math.floor(rawReq.wantedLevel || 0))),
    vehicleName: sanitizeSocialText(rawReq.vehicleName, 40) || undefined,
    summaryNote: sanitizeSocialText(rawReq.summaryNote, 140) || undefined,
  };

  if (!hasUsableApiKey(apiKey)) {
    return buildFallbackViralResponse(req);
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

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: JSON.stringify(req),
      config: {
        systemInstruction:
          'Kamu adalah penulis feed media sosial fiktif NabiloGram di dalam game open-world Jakarta "GPU: San Nabilo". Buat 1 postingan pendek viral ala netizen Jakarta (slang natural, lucu, dramatis, maksimal 2 kalimat untuk caption) dan 2-3 komentar netizen lokal yang merespons aksi pemain secara spesifik. Jangan pernah menyebut AI, model, atau sistem.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            authorHandle: {
              type: Type.STRING,
              description: 'Handle akun netizen Jakarta dimulai dengan @, misal @dashcam.sudirman',
            },
            authorTag: {
              type: Type.STRING,
              description: 'Peran singkat pengunggah, misal Saksi Mata atau Driver Ojol',
            },
            caption: {
              type: Type.STRING,
              description: 'Caption viral singkat 1-2 kalimat bahasa Indonesia slang Jakarta.',
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-3 hashtag singkat dimulai dengan #.',
            },
            comments: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  handle: { type: Type.STRING },
                  text: { type: Type.STRING },
                  likes: { type: Type.INTEGER },
                },
                required: ['handle', 'text', 'likes'],
              },
            },
          },
          required: ['authorHandle', 'authorTag', 'caption', 'hashtags', 'comments'],
        },
      },
    });

    const raw = response.text?.trim();
    if (!raw) return buildFallbackViralResponse(req);
    const parsed = JSON.parse(raw) as Partial<ViralPostResponse>;
    if (!parsed.caption || !Array.isArray(parsed.comments)) {
      return buildFallbackViralResponse(req);
    }

    const handle = sanitizeSocialText(parsed.authorHandle, 28) || '@warga.jakarta';
    return {
      authorHandle: handle.startsWith('@') ? handle : `@${handle}`,
      authorTag: sanitizeSocialText(parsed.authorTag, 24) || 'Warga Jakarta',
      caption: sanitizeSocialText(parsed.caption, 200),
      hashtags: (Array.isArray(parsed.hashtags) ? parsed.hashtags : ['#ViceJakarta'])
        .slice(0, 3)
        .map((h) => {
          const clean = sanitizeSocialText(h, 24).replace(/\s+/g, '');
          return clean.startsWith('#') ? clean : `#${clean || 'ViceJakarta'}`;
        }),
      comments: parsed.comments.slice(0, 3).map((c) => {
        const ch = sanitizeSocialText(c.handle, 24) || '@netizen_jkt';
        return {
          handle: ch.startsWith('@') ? ch : `@${ch}`,
          text: sanitizeSocialText(c.text, 120),
          likes: Math.max(5, Math.min(9999, Math.round(Number(c.likes) || 45))),
        };
      }),
      source: 'gemini',
    };
  } catch {
    return buildFallbackViralResponse(req);
  }
}

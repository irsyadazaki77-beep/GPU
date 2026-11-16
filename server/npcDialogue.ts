import { GoogleGenAI, Type } from '@google/genai';
import type {
  FactionId,
  NpcDialogueRequest,
  NpcDialogueResponse,
  NpcDynamicSideQuest,
  WorldContextSnapshot,
} from '../src/game/types';

const GEMINI_MODEL = 'gemini-4-hydrogen';

const MAX_PROMPT_LENGTH = 260;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const clientRateBuckets = new Map<string, number[]>();

export function sanitizeDialogueInput(raw: string): string {
  return String(raw || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>`{}]/g, '')
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
}

export function checkNpcDialogueRateLimit(
  clientKey: string = 'default',
  nowMs: number = Date.now()
): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const key = clientKey.trim() || 'default';
  const prev = clientRateBuckets.get(key) || [];
  const active = prev.filter((ts) => nowMs - ts < RATE_LIMIT_WINDOW_MS);

  if (active.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = active[0] ?? nowMs;
    const retryAfterMs = Math.max(100, RATE_LIMIT_WINDOW_MS - (nowMs - oldest));
    clientRateBuckets.set(key, active);
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  active.push(nowMs);
  clientRateBuckets.set(key, active);
  return {
    allowed: true,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - active.length),
    retryAfterMs: 0,
  };
}

export function resetNpcDialogueRateLimiter(): void {
  clientRateBuckets.clear();
}

export function sanitizeWorldContext(
  rawCtx: WorldContextSnapshot | undefined,
  fallbackDistrict: string,
  fallbackWanted: number,
  fallbackReputation: Record<FactionId, number>
): WorldContextSnapshot {
  if (!rawCtx || typeof rawCtx !== 'object') {
    return {
      activeProtagonist: 'Nabilo',
      currentDistrict: sanitizeDialogueInput(fallbackDistrict) || 'Monas',
      wantedLevel: Math.max(0, Math.min(5, Math.floor(fallbackWanted || 0))),
      factionStandings: {
        jalanan: fallbackReputation?.jalanan ?? 40,
        sindikat: fallbackReputation?.sindikat ?? 40,
        rakyat: fallbackReputation?.rakyat ?? 40,
      },
      ownedTurfCount: 0,
      recentEvents: [],
    };
  }

  const rawProto = String(rawCtx.activeProtagonist || 'Nabilo').toLowerCase();
  const activeProtagonist: 'Nabilo' | 'Raka' | 'Kirana' =
    rawProto === 'raka'
      ? 'Raka'
      : rawProto === 'kirana'
      ? 'Kirana'
      : 'Nabilo';

  const recentEvents = Array.isArray(rawCtx.recentEvents)
    ? rawCtx.recentEvents
        .filter((e): e is string => typeof e === 'string')
        .map((e) => sanitizeDialogueInput(e).slice(0, 110))
        .filter((e) => e.length > 0)
        .slice(0, 3)
    : [];

  return {
    activeProtagonist,
    currentDistrict:
      sanitizeDialogueInput(rawCtx.currentDistrict || fallbackDistrict).slice(
        0,
        64
      ) || 'Monas',
    wantedLevel: Math.max(
      0,
      Math.min(
        5,
        Math.floor(
          typeof rawCtx.wantedLevel === 'number'
            ? rawCtx.wantedLevel
            : fallbackWanted
        )
      )
    ),
    factionStandings: {
      jalanan: Math.max(
        0,
        Math.min(
          100,
          Number(
            rawCtx.factionStandings?.jalanan ?? fallbackReputation?.jalanan ?? 40
          )
        )
      ),
      sindikat: Math.max(
        0,
        Math.min(
          100,
          Number(
            rawCtx.factionStandings?.sindikat ??
              fallbackReputation?.sindikat ??
              40
          )
        )
      ),
      rakyat: Math.max(
        0,
        Math.min(
          100,
          Number(
            rawCtx.factionStandings?.rakyat ?? fallbackReputation?.rakyat ?? 40
          )
        )
      ),
    },
    ownedTurfCount: Math.max(
      0,
      Math.min(13, Math.floor(Number(rawCtx.ownedTurfCount || 0)))
    ),
    recentEvents,
  };
}

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickQuestFaction(req: NpcDialogueRequest): FactionId {
  const { jalanan, sindikat, rakyat } = req.reputation;
  if (sindikat >= jalanan && sindikat >= rakyat) return 'sindikat';
  if (rakyat >= jalanan && rakyat >= sindikat) return 'rakyat';
  return 'jalanan';
}

export function buildFallbackNpcDialogue(
  rawReq: NpcDialogueRequest
): NpcDialogueResponse {
  const prompt = sanitizeDialogueInput(rawReq.playerPrompt);
  const lower = prompt.toLowerCase();
  const faction = pickQuestFaction(rawReq);
  const worldCtx = sanitizeWorldContext(
    rawReq.worldContext,
    rawReq.locationName,
    rawReq.wantedLevel,
    rawReq.reputation
  );

  const questHash = stableHash(
    `${rawReq.missionTitle}|${rawReq.npcName}|${prompt}|${rawReq.origin}|${worldCtx.activeProtagonist}`
  )
    .toString(36)
    .slice(0, 6);

  const protagonistCallout =
    worldCtx.activeProtagonist === 'Raka'
      ? 'Bro Raka, otot jalanan Tanah Abang lo udah kedengeran sampe pos sini.'
      : worldCtx.activeProtagonist === 'Kirana'
      ? 'Mbak Kirana, sinyal siber Glodok lo bikin jaringan kamera aparat kedip-kedip.'
      : rawReq.origin === 'anak_jalanan'
      ? 'Bang Nabilo, anak lapangan kayak lo pasti ngerti denyut aspal Blok M.'
      : rawReq.origin === 'mantan_kurir'
      ? 'Bang Nabilo, eks-kurir kilat punya mata tajam buat celah jalur tikus.'
      : 'Bang Nabilo, teknisi Glodok selalu selangkah di depan kamera CCTV.';

  const recentDeedNote =
    worldCtx.recentEvents.length > 0
      ? ` Kabar soal "${worldCtx.recentEvents[0]}" juga udah nyebar di warung kopi ${worldCtx.currentDistrict}${
          worldCtx.ownedTurfCount > 0
            ? ` (kru lo sekarang pegang ${worldCtx.ownedTurfCount} distrik)`
            : ''
        }.`
      : worldCtx.ownedTurfCount > 0
      ? ` Kru lo udah pegang ${worldCtx.ownedTurfCount} distrik di Jakarta, jadi mata-mata lapangan makin respek.`
      : '';

  let reply: string;
  let tone = 'Taktis & Waspada';

  if (rawReq.wantedLevel >= 3) {
    tone = 'Tegang (Siaga Polisi)';
    reply = `${protagonistCallout} Hati-hati, status buronan bintang ${rawReq.wantedLevel} lo bikin unit patroli merapat ke ${rawReq.locationName}.${recentDeedNote} Lewat jalur halte TransJakarta atau gang sempit biar sensor patroli keputus sebelum eksekusi ${rawReq.missionTitle}.`;
  } else if (
    lower.includes('polisi') ||
    lower.includes('aparat') ||
    lower.includes('patroli') ||
    lower.includes('wanted')
  ) {
    tone = 'Intel Jalanan';
    reply = `${protagonistCallout} Dengar info dari pos ojol dekat ${rawReq.locationName}: unit patroli lagi fokus di bundaran Monas dan Sudirman.${recentDeedNote} Kalau bunyiin klakson di persimpangan, driver ojol bakal minggir buka celah buat lo cabut.`;
  } else if (
    lower.includes('kerjaan') ||
    lower.includes('duit') ||
    lower.includes('uang') ||
    lower.includes('cuan') ||
    lower.includes('quest') ||
    lower.includes('misi')
  ) {
    tone = 'Peluang Kontrak Cepat';
    reply = `${protagonistCallout}${recentDeedNote} Gue ada satu kontrak sampingan kilat sekitar ${rawReq.locationName}: amankan paket logistik sebelum kurir rival nyampe halte berikutnya.`;
  } else if (
    lower.includes('faksi') ||
    lower.includes('sindikat') ||
    lower.includes('rakyat') ||
    lower.includes('jalanan')
  ) {
    tone = 'Dinamika Faksi Jakarta';
    reply = `${protagonistCallout} Keseimbangan faksi lagi panas—Jawara Jalanan (${rawReq.reputation.jalanan}%), Eksekutif Sindikat (${rawReq.reputation.sindikat}%), Bela Rakyat (${rawReq.reputation.rakyat}%).${recentDeedNote} Pilihan lo di ${rawReq.missionTitle} bakal langsung ngeguncang bursa BAJSA dan kontrol distrik.`;
  } else {
    reply = `${protagonistCallout}${recentDeedNote} Untuk urusan "${rawReq.missionTitle}" di ${rawReq.locationName}, jaga jarak aman dari konvoi angkot yang sering ngetem mendadak dan koordinasikan langkah lo bareng informan lokal.`;
  }

  const sideQuest: NpcDynamicSideQuest = {
    id: `dq_${questHash}`,
    title:
      faction === 'sindikat'
        ? `Dekripsi Relay ${rawReq.locationName}`
        : faction === 'rakyat'
        ? `Pengawalan Logistik ${rawReq.locationName}`
        : `Sapuan Kurir Blok ${rawReq.locationName}`,
    description: `Selesaikan kontak lapangan cepat dari ${rawReq.npcName} untuk ${worldCtx.activeProtagonist} di area ${rawReq.locationName}.`,
    targetDistrict: rawReq.locationName,
    rewardRp: 85000 + rawReq.wantedLevel * 15000 + worldCtx.ownedTurfCount * 5000,
    faction,
    repGain: 6,
  };

  const worldMemorySummary = `${worldCtx.activeProtagonist} · ${worldCtx.currentDistrict} · ${worldCtx.ownedTurfCount} Teritori${
    worldCtx.recentEvents[0] ? ` · Aksi Terakhir: ${worldCtx.recentEvents[0]}` : ''
  }`;

  return {
    reply,
    tone,
    source: 'fallback',
    sideQuest,
    worldMemorySummary,
  };
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

export async function generateNpcDialogue(
  req: NpcDialogueRequest,
  apiKey: string | undefined = process.env.GEMINI_API_KEY
): Promise<NpcDialogueResponse> {
  const sanitizedPrompt = sanitizeDialogueInput(req.playerPrompt);
  const worldCtx = sanitizeWorldContext(
    req.worldContext,
    req.locationName,
    req.wantedLevel,
    req.reputation
  );

  const safeReq: NpcDialogueRequest = {
    ...req,
    playerPrompt:
      sanitizedPrompt.length > 0
        ? sanitizedPrompt
        : 'Bagaimana situasi lapangan dan ada kontrak sampingan?',
    worldContext: worldCtx,
  };

  if (!hasUsableApiKey(apiKey)) {
    return buildFallbackNpcDialogue(safeReq);
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

    const systemInstruction = [
      'Kamu adalah penulis naratif untuk game aksi open-world Jakarta "GPU: San Nabilo".',
      `Perankan NPC informan bernama ${safeReq.npcName} (${safeReq.npcRole}) di distrik ${worldCtx.currentDistrict} (${safeReq.locationName}).`,
      `Pemain saat ini mengendalikan protagonis ${worldCtx.activeProtagonist} dengan penguasaan ${worldCtx.ownedTurfCount} distrik Jakarta.`,
      worldCtx.recentEvents.length > 0
        ? `Ingat dan komentari secara organik aksi terbaru pemain di Jakarta: ${worldCtx.recentEvents.join(' | ')}.`
        : 'Beri respons yang menyatu dengan atmosfer jalanan Jakarta.',
      'Gunakan Bahasa Indonesia khas jalanan Jakarta (lo/gue, slang urban sinematik) yang hidup, padat, dan bebas jargon teknis AI.',
      'Jawab singkat (maksimal 2-3 kalimat) yang relevan dengan misi aktif, karakter aktif, level buronan, dan reputasi faksi.',
      'Sertakan 1 dynamic sideQuest opsional yang ringkas dan realistis di Jakarta.',
    ].join(' ');

    const userContext = JSON.stringify({
      missionTitle: safeReq.missionTitle,
      origin: safeReq.origin,
      activeProtagonist: worldCtx.activeProtagonist,
      currentDistrict: worldCtx.currentDistrict,
      wantedLevel: safeReq.wantedLevel,
      reputation: safeReq.reputation,
      ownedTurfCount: worldCtx.ownedTurfCount,
      recentEvents: worldCtx.recentEvents,
      playerQuestion: safeReq.playerPrompt,
    });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userContext,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: {
              type: Type.STRING,
              description:
                'Dialog balasan NPC berbahasa Indonesia slang Jakarta (2-3 kalimat) yang menyapa protagonis aktif dan menyinggung aksi terbaru pemain.',
            },
            tone: {
              type: Type.STRING,
              description:
                'Label nada bicara singkat, misal: Taktis & Waspada.',
            },
            sideQuestTitle: {
              type: Type.STRING,
              description: 'Judul misi sampingan singkat khas Jakarta.',
            },
            sideQuestDescription: {
              type: Type.STRING,
              description: 'Deskripsi 1 kalimat misi sampingan.',
            },
            sideQuestFaction: {
              type: Type.STRING,
              description: 'Salah satu dari: jalanan, sindikat, rakyat.',
            },
            sideQuestRewardRp: {
              type: Type.INTEGER,
              description: 'Hadiah rupiah antara 60000 sampai 220000.',
            },
          },
          required: ['reply', 'tone', 'sideQuestTitle', 'sideQuestDescription'],
        },
      },
    });

    const rawText = response.text?.trim();
    if (!rawText) {
      return buildFallbackNpcDialogue(safeReq);
    }

    const parsed = JSON.parse(rawText) as {
      reply?: string;
      tone?: string;
      sideQuestTitle?: string;
      sideQuestDescription?: string;
      sideQuestFaction?: string;
      sideQuestRewardRp?: number;
    };

    if (!parsed.reply || typeof parsed.reply !== 'string') {
      return buildFallbackNpcDialogue(safeReq);
    }

    const validFaction: FactionId =
      parsed.sideQuestFaction === 'sindikat' ||
      parsed.sideQuestFaction === 'rakyat' ||
      parsed.sideQuestFaction === 'jalanan'
        ? parsed.sideQuestFaction
        : pickQuestFaction(safeReq);

    const questHash = stableHash(
      `${safeReq.missionTitle}|${parsed.sideQuestTitle || safeReq.locationName}`
    )
      .toString(36)
      .slice(0, 6);

    const rewardRp =
      typeof parsed.sideQuestRewardRp === 'number' &&
      Number.isFinite(parsed.sideQuestRewardRp)
        ? Math.max(
            60000,
            Math.min(250000, Math.round(parsed.sideQuestRewardRp))
          )
        : 110000;

    const worldMemorySummary = `${worldCtx.activeProtagonist} · ${worldCtx.currentDistrict} · ${worldCtx.ownedTurfCount} Teritori${
      worldCtx.recentEvents[0]
        ? ` · Aksi Terakhir: ${worldCtx.recentEvents[0]}`
        : ''
    }`;

    return {
      reply: parsed.reply.trim(),
      tone: (parsed.tone || 'Informan Jakarta').trim(),
      source: 'gemini',
      worldMemorySummary,
      sideQuest: parsed.sideQuestTitle
        ? {
            id: `dq_ai_${questHash}`,
            title: parsed.sideQuestTitle.trim().slice(0, 64),
            description: (
              parsed.sideQuestDescription ||
              `Tugas lapangan cepat di sekitar ${safeReq.locationName}.`
            )
              .trim()
              .slice(0, 140),
            targetDistrict: safeReq.locationName,
            rewardRp,
            faction: validFaction,
            repGain: 7,
          }
        : undefined,
    };
  } catch {
    return buildFallbackNpcDialogue(safeReq);
  }
}

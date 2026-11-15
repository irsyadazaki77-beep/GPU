import { GoogleGenAI, Type } from '@google/genai';
import type {
  FactionId,
  NpcDialogueRequest,
  NpcDialogueResponse,
  NpcDynamicSideQuest,
} from '../src/game/types';

const GEMINI_MODEL = 'gemini-4-hydrogen';

const MAX_PROMPT_LENGTH = 260;

export function sanitizeDialogueInput(raw: string): string {
  return raw
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[<>`{}]/g, '')
    .trim()
    .slice(0, MAX_PROMPT_LENGTH);
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
  const questHash = stableHash(
    `${rawReq.missionTitle}|${rawReq.npcName}|${prompt}|${rawReq.origin}`
  )
    .toString(36)
    .slice(0, 6);

  const originGreeting =
    rawReq.origin === 'anak_jalanan'
      ? 'Anak lapangan kayak lo pasti ngerti denyut aspal Blok M.'
      : rawReq.origin === 'mantan_kurir'
      ? 'Eks-kurir kilat punya mata tajam buat celah jalur tikus.'
      : 'Anak teknisi Glodok selalu selangkah di depan kamera CCTV.';

  let reply: string;
  let tone = 'Taktis & Waspada';

  if (rawReq.wantedLevel >= 3) {
    tone = 'Tegang (Siaga Polisi)';
    reply = `${originGreeting} Hati-hati, status buronan bintang ${rawReq.wantedLevel} lo bikin unit patroli merapat ke ${rawReq.locationName}. Lewat jalur halte TransJakarta atau gang sempit biar sensor patroli keputus sebelum eksekusi ${rawReq.missionTitle}.`;
  } else if (
    lower.includes('polisi') ||
    lower.includes('aparat') ||
    lower.includes('patroli') ||
    lower.includes('wanted')
  ) {
    tone = 'Intel Jalanan';
    reply = `Dengar info dari pos ojol dekat ${rawReq.locationName}: unit patroli lagi fokus di bundaran Monas dan Sudirman. Kalau bunyiin klakson di persimpangan, driver ojol bakal minggir buka celah buat lo cabut.`;
  } else if (
    lower.includes('kerjaan') ||
    lower.includes('duit') ||
    lower.includes('uang') ||
    lower.includes('cuan') ||
    lower.includes('quest') ||
    lower.includes('misi')
  ) {
    tone = 'Peluang Kontrak Cepat';
    reply = `${originGreeting} Gue ada satu kontrak sampingan kilat sekitar ${rawReq.locationName}: amankan paket logistik sebelum kurir rival nyampe halte berikutnya. Cuan bersih siap cair ke saldo lo.`;
  } else if (
    lower.includes('faksi') ||
    lower.includes('sindikat') ||
    lower.includes('rakyat') ||
    lower.includes('jalanan')
  ) {
    tone = 'Dinamika Faksi Jakarta';
    reply = `Keseimbangan faksi lagi panas—Jawara Jalanan (${rawReq.reputation.jalanan}%), Eksekutif Sindikat (${rawReq.reputation.sindikat}%), Bela Rakyat (${rawReq.reputation.rakyat}%). Pilihan lo di ${rawReq.missionTitle} bakal langsung ngeguncang bursa BAJSA dan kontrol distrik.`;
  } else {
    reply = `${originGreeting} Untuk urusan "${rawReq.missionTitle}" di ${rawReq.locationName}, jaga jarak aman dari konvoi angkot yang sering ngetem mendadak dan koordinasikan langkah lo bareng informan lokal.`;
  }

  const sideQuest: NpcDynamicSideQuest = {
    id: `dq_${questHash}`,
    title:
      faction === 'sindikat'
        ? `Dekripsi Relay ${rawReq.locationName}`
        : faction === 'rakyat'
        ? `Pengawalan Logistik ${rawReq.locationName}`
        : `Sapuan Kurir Blok ${rawReq.locationName}`,
    description: `Selesaikan kontak lapangan cepat dari ${rawReq.npcName} di area ${rawReq.locationName}.`,
    targetDistrict: rawReq.locationName,
    rewardRp: 85000 + (rawReq.wantedLevel * 15000),
    faction,
    repGain: 6,
  };

  return {
    reply,
    tone,
    source: 'fallback',
    sideQuest,
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
  const safeReq: NpcDialogueRequest = {
    ...req,
    playerPrompt:
      sanitizedPrompt.length > 0
        ? sanitizedPrompt
        : 'Bagaimana situasi lapangan dan ada kontrak sampingan?',
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
      `Perankan NPC bernama ${safeReq.npcName} (${safeReq.npcRole}) di lokasi ${safeReq.locationName}.`,
      'Gunakan Bahasa Indonesia khas jalanan Jakarta yang hidup, padat, sinematik, dan bebas jargon teknis AI.',
      'Jawab singkat (maksimal 2-3 kalimat) yang relevan dengan misi aktif, latar belakang pemain, level buronan, dan reputasi faksi.',
      'Sertakan 1 dynamic sideQuest opsional yang ringkas dan realistis di Jakarta.',
    ].join(' ');

    const userContext = JSON.stringify({
      missionTitle: safeReq.missionTitle,
      origin: safeReq.origin,
      wantedLevel: safeReq.wantedLevel,
      reputation: safeReq.reputation,
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
              description: 'Dialog balasan NPC berbahasa Indonesia Jakarta (2-3 kalimat).',
            },
            tone: {
              type: Type.STRING,
              description: 'Label nada bicara singkat, misal: Taktis & Waspada.',
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
        ? Math.max(60000, Math.min(250000, Math.round(parsed.sideQuestRewardRp)))
        : 110000;

    return {
      reply: parsed.reply.trim(),
      tone: (parsed.tone || 'Informan Jakarta').trim(),
      source: 'gemini',
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

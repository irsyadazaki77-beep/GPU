import type { NpcVoiceRequest, NpcVoiceResponse } from './types';

let activeAudioEl: HTMLAudioElement | null = null;
const clientAudioCache = new Map<string, string>();
let activeRequestToken = 0;

export function stopVoicePlayback(): void {
  activeRequestToken += 1;
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.currentTime = 0;
    } catch {
      // ignore
    }
    activeAudioEl = null;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
}

function speakWithBrowserFallback(text: string, volume: number): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'id-ID';
    utter.rate = 1.02;
    utter.pitch = 0.98;
    utter.volume = Math.max(0.05, Math.min(1, volume));
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id'));
    if (idVoice) utter.voice = idVoice;
    window.speechSynthesis.speak(utter);
  } catch {
    // ignore speech synthesis restrictions
  }
}

export async function speakDialogueLine(
  req: NpcVoiceRequest,
  enabled: boolean,
  volume: number = 0.85
): Promise<'gemini_tts' | 'fallback' | 'disabled'> {
  if (!enabled || volume <= 0.01) return 'disabled';
  const trimmed = req.text.trim();
  if (!trimmed) return 'disabled';

  stopVoicePlayback();
  const token = activeRequestToken;
  const cacheKey = `${req.speakerName}|${req.tone || ''}|${trimmed}`;
  const clampedVol = Math.max(0.05, Math.min(1, volume));

  const playDataUrl = (dataUrl: string) => {
    if (token !== activeRequestToken || typeof Audio === 'undefined') return;
    const audio = new Audio(dataUrl);
    audio.volume = clampedVol;
    activeAudioEl = audio;
    audio.play().catch(() => {
      speakWithBrowserFallback(trimmed, clampedVol);
    });
  };

  const cachedUrl = clientAudioCache.get(cacheKey);
  if (cachedUrl) {
    playDataUrl(cachedUrl);
    return 'gemini_tts';
  }

  try {
    const res = await fetch('/api/npc/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (token !== activeRequestToken) return 'disabled';
    if (!res.ok) {
      speakWithBrowserFallback(trimmed, clampedVol);
      return 'fallback';
    }
    const data = (await res.json()) as NpcVoiceResponse;
    if (token !== activeRequestToken) return 'disabled';

    if (data.source === 'gemini_tts' && data.audioBase64) {
      const mime = data.mimeType || 'audio/wav';
      const dataUrl = `data:${mime};base64,${data.audioBase64}`;
      if (clientAudioCache.size >= 30) {
        const firstKey = clientAudioCache.keys().next().value;
        if (firstKey) clientAudioCache.delete(firstKey);
      }
      clientAudioCache.set(cacheKey, dataUrl);
      playDataUrl(dataUrl);
      return 'gemini_tts';
    }

    speakWithBrowserFallback(trimmed, clampedVol);
    return 'fallback';
  } catch {
    if (token === activeRequestToken) {
      speakWithBrowserFallback(trimmed, clampedVol);
    }
    return 'fallback';
  }
}

let lastRadioVoiceAtMs = 0;

/**
 * Ambient Indonesian DJ radio voiceover via Web Speech API.
 * Skips quietly if NPC dialogue audio is active or triggered too frequently.
 */
export function speakRadioDjLine(
  headline: string,
  djLine: string,
  enabled: boolean,
  radioVolume: number
): boolean {
  if (!enabled || radioVolume <= 0.05) return false;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }
  if (activeAudioEl && !activeAudioEl.paused) {
    return false;
  }
  const now = Date.now();
  if (now - lastRadioVoiceAtMs < 14_000) {
    return false;
  }
  if (window.speechSynthesis.speaking) {
    return false;
  }

  lastRadioVoiceAtMs = now;
  const script = `${headline}. ${djLine}`.trim().slice(0, 180);
  try {
    const utter = new SpeechSynthesisUtterance(script);
    utter.lang = 'id-ID';
    utter.rate = 1.08;
    utter.pitch = 1.03;
    utter.volume = Math.max(0.05, Math.min(0.65, radioVolume * 0.55));
    const voices = window.speechSynthesis.getVoices();
    const idVoice = voices.find((v) => v.lang.toLowerCase().startsWith('id'));
    if (idVoice) utter.voice = idVoice;
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}


import React, { useEffect, useState } from 'react';
import {
  NpcDialogueRequest,
  NpcDialogueResponse,
  StoryChoiceOption,
  StoryMission,
  formatRupiah,
} from '../game/rules';
import { speakDialogueLine, stopVoicePlayback } from '../game/voiceClient';
import { gameStore, useGameStore } from '../state/gameStore';

interface StoryDialogueModalProps {
  mission: StoryMission;
  onSelectChoice: (choice: StoryChoiceOption) => void;
  onClose: () => void;
}

const FACTION_LABELS: Record<
  StoryChoiceOption['faction'],
  { name: string; color: string }
> = {
  jalanan: { name: 'Jawara Jalanan', color: '#f97316' },
  sindikat: { name: 'Eksekutif Sindikat', color: '#38bdf8' },
  rakyat: { name: 'Bela Rakyat', color: '#22c55e' },
};

const QUICK_PROMPTS = [
  'Info patroli polisi sekitar sini?',
  'Ada kerjaan cepat berbayar?',
  'Bagaimana situasi faksi Jakarta saat ini?',
];

export const StoryDialogueModal: React.FC<StoryDialogueModalProps> = ({
  mission,
  onSelectChoice,
  onClose,
}) => {
  const origin = useGameStore((s) => s.origin);
  const wantedLevel = useGameStore((s) => s.playerState.wantedLevel);
  const reputation = useGameStore((s) => s.playerState.reputation);
  const completedDynamicQuests = useGameStore((s) => s.completedDynamicQuests);
  const voiceActingEnabled = useGameStore(
    (s) => s.gameSettings.voiceActingEnabled
  );
  const masterVol = useGameStore((s) => s.audioVolumes.master);
  const muted = useGameStore((s) => s.muted);

  const [promptInput, setPromptInput] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [dialogueRes, setDialogueRes] = useState<NpcDialogueResponse | null>(
    null
  );
  const [voiceActive, setVoiceActive] = useState(false);

  useEffect(() => {
    if (voiceActingEnabled && !muted) {
      setVoiceActive(true);
      void speakDialogueLine(
        {
          text: mission.briefing,
          speakerName: mission.giverName,
          tone: 'Tegas & Sinematik',
        },
        true,
        masterVol
      );
    }
    return () => {
      stopVoicePlayback();
    };
  }, [mission.id, mission.briefing, mission.giverName, voiceActingEnabled, muted, masterVol]);

  const requestNpcDialogue = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || loadingAi) return;
    setLoadingAi(true);
    setAiError(null);

    const payload: NpcDialogueRequest = {
      npcName: mission.giverName,
      npcRole: mission.giverRole,
      locationName: mission.locationName,
      missionTitle: mission.title,
      playerPrompt: trimmed,
      origin,
      wantedLevel,
      reputation,
    };

    try {
      const res = await fetch('/api/npc/dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as NpcDialogueResponse;
      setDialogueRes(data);
      setPromptInput('');
      if (voiceActingEnabled && !muted) {
        setVoiceActive(true);
        void speakDialogueLine(
          {
            text: data.reply,
            speakerName: mission.giverName,
            tone: data.tone,
          },
          true,
          masterVol
        );
      }
    } catch {
      setAiError(
        'Kanal komunikasi Jakarta terputus sementara. Coba kirim ulang pertanyaanmu.'
      );
    } finally {
      setLoadingAi(false);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    void requestNpcDialogue(promptInput);
  };

  const claimedQuest =
    dialogueRes?.sideQuest &&
    completedDynamicQuests.includes(dialogueRes.sideQuest.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-6 pointer-events-auto"
      style={{ backgroundColor: 'rgba(6, 8, 13, 0.78)' }}
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto aaa-glass rounded-2xl p-6 md:p-8 shadow-2xl text-[#f4f1ea] animate-aaa-up">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
              <span className="font-mono-num text-[#f59e0b] font-semibold">
                Tahap {mission.stageNumber} · Babak {mission.chapterNumber}
              </span>
              <span aria-hidden="true">·</span>
              <span className="truncate">
                {mission.locationName} · {mission.giverName}
              </span>
            </div>
            <h2
              id="story-modal-title"
              className="font-display text-3xl font-extrabold italic uppercase tracking-wide text-[#f4f1ea] mt-1"
            >
              {mission.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (voiceActive) {
                  stopVoicePlayback();
                  setVoiceActive(false);
                } else {
                  setVoiceActive(true);
                  const line = dialogueRes ? dialogueRes.reply : mission.briefing;
                  void speakDialogueLine(
                    {
                      text: line,
                      speakerName: mission.giverName,
                      tone: dialogueRes?.tone || 'Tegas & Sinematik',
                    },
                    !muted,
                    masterVol
                  );
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 text-xs font-medium text-[#7dd3fc] cursor-pointer whitespace-nowrap"
            >
              {voiceActive ? 'Hentikan Suara' : 'Putar Suara Brief'}
            </button>
            <button
              type="button"
              onClick={() => {
                stopVoicePlayback();
                onClose();
              }}
              aria-label="Tutup Dialog Misi"
              className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-medium text-[#cbd5e1] hover:text-white cursor-pointer whitespace-nowrap"
            >
              Tunda [Esc]
            </button>
          </div>
        </div>

        <p className="mt-4 text-sm md:text-base leading-relaxed text-[#cbd5e1] max-w-[65ch]">
          {mission.briefing}
        </p>

        {/* Interactive Jakarta Informant AI Dialogue + Dynamic Side-Quest */}
        <div className="mt-5 rounded-xl border border-[#38bdf8]/25 bg-[#09111d]/75 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#38bdf8]">
              Obrolan Informan Jakarta · {mission.giverName}
            </span>
            {dialogueRes && (
              <span className="text-[11px] font-mono-num text-[#94a3b8]">
                Nada: {dialogueRes.tone} ·{' '}
                {dialogueRes.source === 'gemini' ? 'Gemini AI' : 'Lokal Offline'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loadingAi}
                onClick={() => void requestNpcDialogue(q)}
                className="px-2.5 py-1 rounded-md bg-white/8 hover:bg-white/15 text-[11px] text-[#e2e8f0] cursor-pointer disabled:opacity-50 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmitForm} className="flex items-center gap-2">
            <label htmlFor="npc-dialogue-prompt" className="sr-only">
              Tanya informan Jakarta
            </label>
            <input
              id="npc-dialogue-prompt"
              type="text"
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={`Tanya ${mission.giverName.split(' ')[0]} soal rute, polisi, atau kontrak cepat...`}
              maxLength={200}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#05080f] border border-white/15 text-xs text-[#f4f1ea] placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]"
            />
            <button
              type="submit"
              disabled={loadingAi || !promptInput.trim()}
              className="px-3.5 py-2 rounded-lg bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#090c12] font-semibold text-xs cursor-pointer disabled:opacity-50 whitespace-nowrap"
            >
              {loadingAi ? 'Mengontak...' : 'Tanya NPC'}
            </button>
          </form>

          {aiError && (
            <p className="text-xs text-[#f87171]">{aiError}</p>
          )}

          {dialogueRes && (
            <div className="rounded-lg bg-white/[0.04] border border-white/10 p-3 flex flex-col gap-2.5">
              <p className="text-xs md:text-sm text-[#e2e8f0] leading-relaxed">
                “{dialogueRes.reply}”
              </p>

              {dialogueRes.sideQuest && (
                <div className="pt-2.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-semibold text-[#f59e0b]">
                        Kontrak Sampingan: {dialogueRes.sideQuest.title}
                      </span>
                      <span
                        className="font-mono-num text-[11px] whitespace-nowrap shrink-0"
                        style={{
                          color: FACTION_LABELS[dialogueRes.sideQuest.faction].color,
                        }}
                      >
                        +{formatRupiah(dialogueRes.sideQuest.rewardRp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8] mt-0.5">
                      {dialogueRes.sideQuest.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={Boolean(claimedQuest)}
                    onClick={() => {
                      if (dialogueRes.sideQuest) {
                        gameStore.claimDynamicSideQuest(dialogueRes.sideQuest);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                      claimedQuest
                        ? 'bg-[#22c55e]/20 text-[#4ade80] cursor-default'
                        : 'bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12]'
                    }`}
                  >
                    {claimedQuest ? 'Kontrak Selesai' : 'Ambil & Klaim Kontrak'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <p className="text-xs font-semibold text-[#94a3b8]">
            Pilih pendekatan taktis
          </p>
          <div className="divide-y divide-white/10 border border-white/10 rounded-xl overflow-hidden bg-white/[0.02]">
            {mission.choices.map((choice, idx) => {
              const factionMeta = FACTION_LABELS[choice.faction];
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => onSelectChoice(choice)}
                  className="w-full group text-left p-4 hover:bg-white/8 transition-colors cursor-pointer"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-display text-xl font-bold uppercase tracking-wide text-[#f4f1ea] group-hover:text-[#f59e0b] transition-colors">
                      0{idx + 1}. {choice.label}
                    </span>
                    <span
                      className="font-mono-num text-xs font-semibold whitespace-nowrap"
                      style={{ color: factionMeta.color }}
                    >
                      {factionMeta.name} · +{formatRupiah(choice.rewardRp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs md:text-sm text-[#94a3b8] leading-snug">
                    {choice.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

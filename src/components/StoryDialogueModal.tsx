import React from 'react';
import {
  StoryChoiceOption,
  StoryMission,
  formatRupiah,
} from '../game/rules';

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

export const StoryDialogueModal: React.FC<StoryDialogueModalProps> = ({
  mission,
  onSelectChoice,
  onClose,
}) => {
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

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Dialog Misi"
            className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-medium text-[#cbd5e1] hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            Tunda [Esc]
          </button>
        </div>

        <p className="mt-4 text-sm md:text-base leading-relaxed text-[#cbd5e1] max-w-[65ch]">
          {mission.briefing}
        </p>

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

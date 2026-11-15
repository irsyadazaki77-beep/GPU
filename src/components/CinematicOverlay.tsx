import React from 'react';
import type { CutsceneOverlayState } from '../game/types';

interface CinematicOverlayProps {
  cutscene: CutsceneOverlayState | null;
  enabled: boolean;
  onDismiss: () => void;
}

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  cutscene,
  enabled,
  onDismiss,
}) => {
  if (!enabled || !cutscene || !cutscene.active) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Sinematik Misi GPU San Nabilo"
      className="fixed inset-0 z-25 pointer-events-none flex flex-col justify-between"
    >
      {/* Top 2.39:1 Anamorphic Letterbox Bar */}
      <div className="w-full h-[9vh] max-h-20 bg-[#05070c] border-b border-white/10 px-6 flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono-num text-[11px] font-bold uppercase tracking-[0.2em] text-[#f59e0b] shrink-0">
            {cutscene.mode === 'heist'
              ? 'OPERASI GRAND HEIST'
              : cutscene.mode === 'sky_switch'
              ? 'SATELIT ORBIT'
              : 'BREIFING TAKTIS'}
          </span>
          <span className="text-xs font-display font-bold uppercase tracking-wide text-[#f4f1ea] truncate">
            {cutscene.title}
          </span>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-[11px] font-mono-num text-[#cbd5e1] cursor-pointer transition-colors shrink-0"
        >
          Lewati Sinematik
        </button>
      </div>

      {/* Bottom 2.39:1 Letterbox Bar with Subtitles */}
      <div className="w-full min-h-[10vh] bg-[#05070c] border-t border-white/10 px-6 py-3 flex flex-col items-center justify-center text-center">
        <div className="max-w-2xl">
          <span className="text-xs font-display font-bold uppercase tracking-wider text-[#38bdf8] mr-2">
            {cutscene.speakerName}:
          </span>
          <span className="text-xs sm:text-sm text-[#f4f1ea] leading-relaxed">
            “{cutscene.subtitleText}”
          </span>
        </div>
      </div>
    </div>
  );
};

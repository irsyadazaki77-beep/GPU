import React, { useState } from 'react';
import { WEATHER_MODES } from '../game/rules';
import type { PhotoFilterId, WeatherMode } from '../game/types';
import {
  DEFAULT_PHOTO_CONFIG,
  gameStore,
  useGameStore,
} from '../state/gameStore';

interface PhotoModeOverlayProps {
  weatherMode: WeatherMode;
  onChangeWeather: (mode: WeatherMode) => void;
  onCapturePng: () => string | undefined;
  onClose: () => void;
}

const PHOTO_FILTERS: { id: PhotoFilterId; label: string }[] = [
  { id: 'standar', label: 'Standar ACES' },
  { id: 'senja_emas', label: 'Senja Emas' },
  { id: 'noir_jakarta', label: 'Noir Kontras' },
  { id: 'siber_matrix', label: 'Siber Neon' },
  { id: 'vintage_98', label: 'Analog 98' },
];

export const PhotoModeOverlay: React.FC<PhotoModeOverlayProps> = ({
  weatherMode,
  onChangeWeather,
  onCapturePng,
  onClose,
}) => {
  const photoConfig = useGameStore((s) => s.photoConfig);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [flashActive, setFlashActive] = useState(false);

  const handleDownloadSnapshot = () => {
    setFlashActive(true);
    window.setTimeout(() => setFlashActive(false), 220);
    const dataUrl = onCapturePng();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `san-nabilo-jakarta-${Date.now()}.png`;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Studio Kamera Photo Mode Jakarta"
      className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between"
    >
      {/* Camera Shutter Flash */}
      {flashActive && (
        <div className="fixed inset-0 bg-white/80 z-50 pointer-events-none transition-opacity duration-200" />
      )}

      {/* Optional 2.39:1 Cinema Letterbox Bars */}
      {photoConfig.letterbox && (
        <>
          <div className="w-full h-10 sm:h-14 bg-[#05070b] pointer-events-none shrink-0" />
          <div className="w-full h-10 sm:h-14 bg-[#05070b] pointer-events-none shrink-0 mt-auto" />
        </>
      )}

      {/* Rule of Thirds Composition Grid */}
      {photoConfig.ruleOfThirds && !dockCollapsed && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none grid grid-cols-3 grid-rows-3"
        >
          <div className="border-r border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-r border-b border-white/10" />
          <div className="border-b border-white/10" />
          <div className="border-r border-white/10" />
          <div className="border-r border-white/10" />
          <div />
        </div>
      )}

      {/* Top Minimal Spec Badge */}
      {!dockCollapsed && (
        <div className="fixed top-4 left-4 z-40 pointer-events-auto aaa-glass-subtle px-3.5 py-2 rounded-lg flex items-center gap-3">
          <span className="font-display text-lg font-extrabold italic uppercase tracking-wider text-[#f59e0b]">
            Studio Lensa Jakarta
          </span>
          <span aria-hidden="true" className="text-white/25">
            ·
          </span>
          <span className="text-xs text-[#cbd5e1]">
            Seret kanvas 3D untuk memutar sudut kamera bebas
          </span>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock (Zero Viewport Occlusion) */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(920px,95vw)] flex flex-col items-center pointer-events-auto">
        <div className="flex items-center gap-2 mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="px-3.5 py-1 rounded-t-lg aaa-glass text-xs font-semibold text-[#e2e8f0] hover:text-white cursor-pointer"
          >
            {dockCollapsed ? '▴ Tampilkan Kontrol Kamera' : '▾ Sembunyikan Kontrol'}
          </button>
          <button
            type="button"
            onClick={handleDownloadSnapshot}
            className="px-4 py-1 rounded-t-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] text-xs font-bold cursor-pointer"
          >
            Potret &amp; Unduh PNG
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded-t-lg bg-[#090c12]/90 hover:bg-[#ef4444] text-xs font-semibold text-[#f4f1ea] hover:text-white border border-white/15 cursor-pointer"
          >
            Keluar [N / Esc]
          </button>
        </div>

        {!dockCollapsed && (
          <div className="w-full aaa-glass rounded-2xl p-4 shadow-2xl flex flex-col gap-3 border border-white/10">
            {/* Row 1: Sliders for FOV, Dutch Roll, Distance, Elevation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Lensa FOV</span>
                  <span className="font-mono-num text-[#f4f1ea]">
                    {photoConfig.fov}°
                  </span>
                </div>
                <input
                  type="range"
                  min={35}
                  max={90}
                  step={1}
                  value={photoConfig.fov}
                  onChange={(e) =>
                    gameStore.setPhotoConfig({ fov: Number(e.target.value) })
                  }
                  className="w-full accent-[#f59e0b] cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Kemiringan Lensa</span>
                  <span className="font-mono-num text-[#f4f1ea]">
                    {photoConfig.rollDeg}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-25}
                  max={25}
                  step={1}
                  value={photoConfig.rollDeg}
                  onChange={(e) =>
                    gameStore.setPhotoConfig({
                      rollDeg: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#38bdf8] cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Jarak Orbit</span>
                  <span className="font-mono-num text-[#f4f1ea]">
                    {photoConfig.distance.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range"
                  min={3.5}
                  max={18}
                  step={0.5}
                  value={photoConfig.distance}
                  onChange={(e) =>
                    gameStore.setPhotoConfig({
                      distance: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#22c55e] cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Tinggi Kamera</span>
                  <span className="font-mono-num text-[#f4f1ea]">
                    {photoConfig.heightOffset.toFixed(1)} m
                  </span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={7.5}
                  step={0.25}
                  value={photoConfig.heightOffset}
                  onChange={(e) =>
                    gameStore.setPhotoConfig({
                      heightOffset: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#c084fc] cursor-pointer"
                />
              </div>
            </div>

            {/* Row 2: Color Grading Filter Bar + Weather + Composition Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[11px] text-[#94a3b8] mr-1">Filter:</span>
                {PHOTO_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => gameStore.setPhotoConfig({ filter: f.id })}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                      photoConfig.filter === f.id
                        ? 'bg-[#f59e0b] text-[#090c12] font-bold'
                        : 'bg-white/5 text-[#cbd5e1] hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {WEATHER_MODES.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => onChangeWeather(w.id)}
                    className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer whitespace-nowrap ${
                      weatherMode === w.id
                        ? 'bg-[#38bdf8] text-[#090c12] font-bold'
                        : 'bg-white/5 text-[#94a3b8] hover:text-white'
                    }`}
                  >
                    {w.label.split(' ')[0]}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    gameStore.setPhotoConfig({
                      letterbox: !photoConfig.letterbox,
                    })
                  }
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                    photoConfig.letterbox
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-[#94a3b8]'
                  }`}
                >
                  2.39:1
                </button>

                <button
                  type="button"
                  onClick={() =>
                    gameStore.setPhotoConfig({
                      hidePlayer: !photoConfig.hidePlayer,
                    })
                  }
                  className={`px-2.5 py-1 rounded text-[11px] font-medium cursor-pointer ${
                    photoConfig.hidePlayer
                      ? 'bg-[#c084fc] text-[#090c12] font-bold'
                      : 'bg-white/5 text-[#94a3b8]'
                  }`}
                >
                  Sembunyikan Karakter
                </button>

                <button
                  type="button"
                  onClick={() =>
                    gameStore.setPhotoConfig({ ...DEFAULT_PHOTO_CONFIG })
                  }
                  className="px-2.5 py-1 rounded bg-white/8 hover:bg-white/15 text-[11px] text-[#cbd5e1] cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

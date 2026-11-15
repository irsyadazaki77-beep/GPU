import React, { useEffect, useRef, useState } from 'react';
import {
  PlayerProgressState,
  WARUNG_SNACKS,
  WarungServeQuality,
  WarungSnackId,
  WarungSnackSpec,
  evaluateWarungMiniGame,
  formatRupiah,
} from '../game/rules';

interface WarungSnackModalProps {
  playerState: PlayerProgressState;
  onConsumeSnack: (
    snackId: WarungSnackId,
    quality: WarungServeQuality
  ) => {
    consumed: boolean;
    hpRecovered: number;
    staminaAddedSec: number;
    fokusAdded: number;
    armorAdded: number;
    quality: WarungServeQuality;
    multiplier: number;
  };
  onCloseModal: () => void;
  onExitWarung: () => void;
}

const SnackIconSvg: React.FC<{ id: WarungSnackId; className?: string }> = ({
  id,
  className = 'w-8 h-8',
}) => {
  switch (id) {
    case 'gorengan_bakwan':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none">
          <circle cx="14" cy="18" r="8" fill="#f59e0b" stroke="#090c12" strokeWidth="2" />
          <circle cx="20" cy="14" r="6" fill="#fbbf24" stroke="#090c12" strokeWidth="2" />
          <path d="M9 12c3-4 8-4 11 0" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="13" cy="17" r="1.3" fill="#16a34a" />
          <circle cx="16" cy="20" r="1.3" fill="#dc2626" />
        </svg>
      );
    case 'klepon_pandan':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none">
          <path d="M5 22c4 4 18 4 22 0" stroke="#15803d" strokeWidth="3" strokeLinecap="round" />
          <circle cx="11" cy="17" r="5" fill="#22c55e" stroke="#090c12" strokeWidth="1.8" />
          <circle cx="20" cy="17" r="5" fill="#4ade80" stroke="#090c12" strokeWidth="1.8" />
          <circle cx="15.5" cy="11.5" r="4.8" fill="#16a34a" stroke="#090c12" strokeWidth="1.8" />
          <circle cx="15.5" cy="11.5" r="1.5" fill="#fef08a" />
        </svg>
      );
    case 'es_kopi_susu':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none">
          <path d="M9 9h14l-1.8 17H10.8L9 9z" fill="#d97706" stroke="#090c12" strokeWidth="2" />
          <path d="M10 18h12l-.8 8H10.8L10 18z" fill="#78350f" />
          <path d="M8 9h16" stroke="#f4f1ea" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M18 4l-2 12" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );
    case 'wedang_jahe':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none">
          <rect x="7" y="12" width="14" height="13" rx="3" fill="#b45309" stroke="#090c12" strokeWidth="2" />
          <path d="M21 15h3a2.5 2.5 0 010 5h-3" stroke="#f59e0b" strokeWidth="2.2" />
          <path d="M11 6c0 2 2 2 2 4M16 5c0 2 2 2 2 4" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'kerak_telor':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none">
          <ellipse cx="16" cy="18" rx="11" ry="6.5" fill="#ea580c" stroke="#090c12" strokeWidth="2" />
          <ellipse cx="16" cy="17" rx="8" ry="4" fill="#fbbf24" />
          <path d="M11 16h10M13 19h6" stroke="#7c2d12" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'sate_padang':
      return (
        <svg viewBox="0 0 32 32" className={className} fill="none">
          <path d="M6 26L25 7" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
          <rect x="11" y="16" width="5" height="5" rx="1.2" transform="rotate(-45 11 16)" fill="#991b1b" stroke="#090c12" strokeWidth="1.5" />
          <rect x="15" y="12" width="5" height="5" rx="1.2" transform="rotate(-45 15 12)" fill="#b45309" stroke="#090c12" strokeWidth="1.5" />
          <rect x="19" y="8" width="5" height="5" rx="1.2" transform="rotate(-45 19 8)" fill="#d97706" stroke="#090c12" strokeWidth="1.5" />
        </svg>
      );
  }
};

export const WarungSnackModal: React.FC<WarungSnackModalProps> = ({
  playerState,
  onConsumeSnack,
  onCloseModal,
  onExitWarung,
}) => {
  const [selectedId, setSelectedId] = useState<WarungSnackId>('es_kopi_susu');
  const [categoryFilter, setCategoryFilter] = useState<
    'all' | 'jajanan_hp' | 'minuman_stamina' | 'paket_komplit'
  >('all');
  const [cursorPct, setCursorPct] = useState<number>(52);
  const [autoOscillate, setAutoOscillate] = useState<boolean>(true);
  const [serveResult, setServeResult] = useState<{
    snackName: string;
    hpRecovered: number;
    staminaAddedSec: number;
    fokusAdded: number;
    armorAdded: number;
    quality: WarungServeQuality;
    multiplier: number;
  } | null>(null);

  const dirRef = useRef<number>(1);

  const selectedSnack: WarungSnackSpec =
    WARUNG_SNACKS.find((s) => s.id === selectedId) || WARUNG_SNACKS[0];

  // Smoothly oscillate the mini-game preparation meter when autoOscillate is active
  useEffect(() => {
    if (!autoOscillate) return;
    const interval = window.setInterval(() => {
      setCursorPct((prev) => {
        let next = prev + dirRef.current * 3.5;
        if (next >= 94) {
          next = 94;
          dirRef.current = -1;
        } else if (next <= 6) {
          next = 6;
          dirRef.current = 1;
        }
        return next;
      });
    }, 55);
    return () => clearInterval(interval);
  }, [autoOscillate]);

  const currentQuality = evaluateWarungMiniGame(
    cursorPct,
    selectedSnack.prepTargetZone
  );

  const handleLockAndEat = (forcedQuality?: WarungServeQuality) => {
    const targetQuality = forcedQuality || currentQuality;
    if (forcedQuality === 'sempurna') {
      const center = Math.round(
        (selectedSnack.prepTargetZone[0] + selectedSnack.prepTargetZone[1]) *
          0.5
      );
      setCursorPct(center);
    }
    const res = onConsumeSnack(selectedSnack.id, targetQuality);
    if (res.consumed) {
      setServeResult({
        snackName: selectedSnack.name,
        hpRecovered: res.hpRecovered,
        staminaAddedSec: res.staminaAddedSec,
        fokusAdded: res.fokusAdded,
        armorAdded: res.armorAdded,
        quality: res.quality,
        multiplier: res.multiplier,
      });
    }
  };

  const filteredSnacks =
    categoryFilter === 'all'
      ? WARUNG_SNACKS
      : WARUNG_SNACKS.filter((s) => s.category === categoryFilter);

  const [zoneMin, zoneMax] = selectedSnack.prepTargetZone;
  const sweetCenter = (zoneMin + zoneMax) * 0.5;
  const sweetHalf = Math.max(4, (zoneMax - zoneMin) * 0.22);
  const canAffordSelected = playerState.rupiah >= selectedSnack.priceRp;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mini-Game Kuliner Warung Kopi dan Jajanan Nusantara"
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-5 pointer-events-none"
    >
      <div className="w-full max-w-4xl aaa-glass rounded-2xl p-4 sm:p-6 shadow-2xl text-[#f4f1ea] flex flex-col gap-4 max-h-[92vh] overflow-y-auto pointer-events-auto animate-aaa-up border border-[#10b981]/35">
        {/* TOP HEADER */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono-num font-bold uppercase tracking-wider bg-[#10b981]/20 text-[#34d399] border border-[#10b981]/40">
                Interior Warung Nusantara
              </span>
              <span className="text-xs text-[#94a3b8]">
                Mini-Game Racik Jajanan &amp; Jamu Stamina
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold italic uppercase text-[#f4f1ea] leading-tight mt-1">
              Warung Pojok Bang Jali
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-[#090c12]/90 border border-[#22c55e]/40 text-right">
              <div className="text-[10px] text-[#94a3b8]">Kas Dompet</div>
              <div className="font-mono-num text-sm font-bold text-[#22c55e]">
                {formatRupiah(playerState.rupiah)}
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseModal}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/15 text-[#cbd5e1] hover:text-white cursor-pointer whitespace-nowrap"
            >
              Tutup Menu [Esc]
            </button>
            <button
              type="button"
              onClick={onExitWarung}
              className="px-3.5 py-2 rounded-lg text-xs font-bold bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] cursor-pointer whitespace-nowrap"
            >
              Keluar Warung [G]
            </button>
          </div>
        </div>

        {/* LIVE PLAYER VITALS & STAMINA BUFF READOUT */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-[#090c12]/80 p-3 rounded-xl border border-white/10">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8]">Kesehatan (HP)</span>
              <span className="font-mono-num font-bold text-[#22c55e]">
                {Math.round(playerState.hp)}/{playerState.maxHp}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#22c55e] transition-all duration-200"
                style={{
                  width: `${Math.min(
                    100,
                    (playerState.hp / Math.max(1, playerState.maxHp)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8]">Buff Stamina</span>
              <span className="font-mono-num font-bold text-[#34d399]">
                {playerState.staminaBuffTimer > 0
                  ? `${Math.ceil(playerState.staminaBuffTimer)}d (+28% Lari)`
                  : '0d (Normal)'}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#10b981] transition-all duration-200"
                style={{
                  width: `${Math.min(
                    100,
                    ((playerState.staminaBuffTimer || 0) / 180) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8]">Energi Fokus</span>
              <span className="font-mono-num font-bold text-[#facc15]">
                {Math.round(playerState.fokusEnergy)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#facc15] transition-all duration-200"
                style={{
                  width: `${Math.min(100, playerState.fokusEnergy)}%`,
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#94a3b8]">Rompi Kevlar</span>
              <span className="font-mono-num font-bold text-[#38bdf8]">
                {Math.round(playerState.armor)}/{playerState.maxArmor}
              </span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#38bdf8] transition-all duration-200"
                style={{
                  width: `${Math.min(
                    100,
                    (playerState.armor / Math.max(1, playerState.maxArmor)) *
                      100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* MAIN TWO-COLUMN BODY: SNACK CATALOG + INTERACTIVE MINI-GAME */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT 7 COLS: TRADITIONAL SNACKS MENU */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#cbd5e1]">
                1. Pilih Jajanan Tradisional Warung
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {[
                  { id: 'all', label: 'Semua (6)' },
                  { id: 'jajanan_hp', label: 'Pulih HP' },
                  { id: 'minuman_stamina', label: 'Buff Stamina' },
                  { id: 'paket_komplit', label: 'Spesial' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() =>
                      setCategoryFilter(
                        tab.id as
                          | 'all'
                          | 'jajanan_hp'
                          | 'minuman_stamina'
                          | 'paket_komplit'
                      )
                    }
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-colors ${
                      categoryFilter === tab.id
                        ? 'bg-[#10b981] text-[#090c12] font-bold'
                        : 'bg-white/5 text-[#cbd5e1] hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredSnacks.map((snack) => {
                const isSelected = snack.id === selectedSnack.id;
                const affordable = playerState.rupiah >= snack.priceRp;
                return (
                  <button
                    key={snack.id}
                    type="button"
                    onClick={() => setSelectedId(snack.id)}
                    aria-label={`Pilih ${snack.name}`}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'bg-[#10b981]/15 border-[#10b981] shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                        : 'bg-white/[0.03] border-white/10 hover:bg-white/8'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-[#090c12] border border-white/10 flex items-center justify-center shrink-0">
                          <SnackIconSvg id={snack.id} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[#f4f1ea] leading-snug">
                            {snack.name}
                          </div>
                          <div className="text-[10px] text-[#94a3b8] leading-snug mt-0.5">
                            {snack.subtitle}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`font-mono-num text-xs font-bold shrink-0 ${
                          affordable ? 'text-[#f59e0b]' : 'text-[#ef4444]'
                        }`}
                      >
                        {formatRupiah(snack.priceRp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/10 text-[10px] font-mono-num">
                      <span className="px-1.5 py-0.5 rounded bg-[#22c55e]/15 text-[#4ade80] font-semibold">
                        +{snack.hpRestore} HP
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-[#10b981]/15 text-[#34d399] font-semibold">
                        +{snack.staminaBuffSeconds}d Stamina
                      </span>
                      {snack.fokusRestore > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-[#facc15]/15 text-[#fde047]">
                          +{snack.fokusRestore} Fokus
                        </span>
                      )}
                      {snack.armorRestore > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-[#38bdf8]/15 text-[#7dd3fc]">
                          +{snack.armorRestore} Armor
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* RIGHT 5 COLS: INTERACTIVE PREPARATION MINI-GAME */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-3 bg-[#090c12]/90 p-4 rounded-xl border border-white/10">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#34d399]">
                  2. Mini-Game Racik &amp; Sajikan
                </span>
                <button
                  type="button"
                  onClick={() => setAutoOscillate((prev) => !prev)}
                  className="text-[11px] font-mono-num text-[#38bdf8] hover:text-white cursor-pointer"
                >
                  {autoOscillate ? 'Jeda Gerak' : 'Gerak Otomatis'}
                </button>
              </div>

              {/* Selected Snack Focus Card */}
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#0b0f17] border border-white/15 flex items-center justify-center shrink-0">
                  <SnackIconSvg id={selectedSnack.id} className="w-9 h-9" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[#f4f1ea] truncate">
                    {selectedSnack.name}
                  </div>
                  <div className="text-[11px] text-[#34d399] font-medium mt-0.5">
                    Tugas: {selectedSnack.prepActionLabel}
                  </div>
                  <div className="text-[11px] font-mono-num text-[#94a3b8] mt-0.5">
                    Harga: {formatRupiah(selectedSnack.priceRp)} · Sempurna 1.5x
                  </div>
                </div>
              </div>

              {/* Interactive Timing & Sweet-Spot Bar */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[#cbd5e1]">
                    Indikator Takaran:{' '}
                    <strong className="font-mono-num text-[#f4f1ea]">
                      {Math.round(cursorPct)}%
                    </strong>
                  </span>
                  <span
                    className={`font-mono-num font-bold uppercase ${
                      currentQuality === 'sempurna'
                        ? 'text-[#facc15]'
                        : currentQuality === 'mantap'
                        ? 'text-[#34d399]'
                        : 'text-[#94a3b8]'
                    }`}
                  >
                    {currentQuality === 'sempurna'
                      ? '★ Racikan Sempurna (1.5x)'
                      : currentQuality === 'mantap'
                      ? '✓ Racikan Mantap (1.25x)'
                      : '• Takaran Standar (1.0x)'}
                  </span>
                </div>

                {/* Meter Track */}
                <div
                  data-testid="warung-minigame-bar"
                  className="relative w-full h-7 rounded-lg bg-[#111827] border border-white/15 overflow-hidden"
                >
                  {/* Target Zone (Mantap 1.25x) */}
                  <div
                    className="absolute inset-y-0 bg-[#10b981]/35 border-x border-[#10b981]"
                    style={{
                      left: `${zoneMin}%`,
                      width: `${zoneMax - zoneMin}%`,
                    }}
                  />
                  {/* Inner Sweet Spot (Sempurna 1.5x) */}
                  <div
                    className="absolute inset-y-0 bg-[#facc15]/55 border-x border-[#facc15]"
                    style={{
                      left: `${sweetCenter - sweetHalf}%`,
                      width: `${sweetHalf * 2}%`,
                    }}
                  />
                  {/* Moving Cursor Needle */}
                  <div
                    className="absolute inset-y-0 w-1.5 -ml-0.5 bg-white shadow-[0_0_10px_#ffffff] transition-all duration-75"
                    style={{ left: `${cursorPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono-num text-[#94a3b8]">
                  <span>0% Kurang Bumbu</span>
                  <span className="text-[#34d399]">
                    Zona Pas {zoneMin}%–{zoneMax}%
                  </span>
                  <span>100% Kelebihan</span>
                </div>

                {/* Fine-Tune Controls for Accessibility & Precision */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAutoOscillate(false);
                      setCursorPct((p) => Math.max(5, p - 10));
                    }}
                    className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono-num text-[#cbd5e1] cursor-pointer"
                  >
                    -10% Takaran
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoOscillate(false);
                      setCursorPct(Math.round(sweetCenter));
                    }}
                    className="py-1.5 px-2 rounded-lg bg-[#facc15]/15 hover:bg-[#facc15]/25 border border-[#facc15]/40 text-[11px] font-mono-num font-bold text-[#fde047] cursor-pointer"
                  >
                    Pas Sempurna
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoOscillate(false);
                      setCursorPct((p) => Math.min(95, p + 10));
                    }}
                    className="py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono-num text-[#cbd5e1] cursor-pointer"
                  >
                    +10% Takaran
                  </button>
                </div>
              </div>

              {/* Predicted Effect Preview */}
              <div className="p-2.5 rounded-lg bg-[#111827] border border-white/10 flex items-center justify-between text-xs">
                <span className="text-[#94a3b8]">Estimasi Efek Racikan:</span>
                <div className="font-mono-num font-bold text-[#f4f1ea] flex items-center gap-2">
                  <span className="text-[#4ade80]">
                    +
                    {Math.round(
                      selectedSnack.hpRestore *
                        (currentQuality === 'sempurna'
                          ? 1.5
                          : currentQuality === 'mantap'
                          ? 1.25
                          : 1)
                    )}{' '}
                    HP
                  </span>
                  <span>·</span>
                  <span className="text-[#34d399]">
                    +
                    {Math.round(
                      selectedSnack.staminaBuffSeconds *
                        (currentQuality === 'sempurna'
                          ? 1.5
                          : currentQuality === 'mantap'
                          ? 1.25
                          : 1)
                    )}
                    d Stamina
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons & Result Feedback */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
              {serveResult && (
                <div
                  role="status"
                  className="p-2.5 rounded-xl bg-[#10b981]/15 border border-[#10b981]/50 text-xs flex flex-col gap-0.5 animate-aaa-up"
                >
                  <div className="font-bold text-[#34d399] flex items-center justify-between">
                    <span>Sajian Disantap: {serveResult.snackName}</span>
                    <span className="font-mono-num uppercase text-[#fde047]">
                      {serveResult.quality} ({serveResult.multiplier}x)
                    </span>
                  </div>
                  <div className="font-mono-num text-[11px] text-[#f4f1ea]">
                    Pulih +{serveResult.hpRecovered} HP · Buff Stamina +
                    {serveResult.staminaAddedSec} detik (+28% Kecepatan Lari)
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!canAffordSelected}
                  onClick={() => handleLockAndEat()}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#10b981] hover:bg-[#34d399] disabled:bg-white/10 text-[#090c12] disabled:text-[#64748b] font-display text-sm font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
                >
                  Kunci Racikan &amp; Santap
                </button>
                <button
                  type="button"
                  disabled={!canAffordSelected}
                  onClick={() => handleLockAndEat('sempurna')}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-white/10 text-[#090c12] disabled:text-[#64748b] font-display text-sm font-extrabold uppercase tracking-wide cursor-pointer transition-colors"
                >
                  Racik Sempurna (1.5x)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

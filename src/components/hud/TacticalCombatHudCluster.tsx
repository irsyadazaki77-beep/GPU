import React from 'react';
import { formatRupiah } from '../../game/rules';
import type { TacticalGadgetKind, WeaponId } from '../../game/types';

export interface TacticalCombatHudClusterProps {
  activeWeapon: WeaponId;
  isMeleeWeapon: boolean;
  magazineInClip: number;
  magazineCapacity: number;
  reloadingWeapon: boolean;
  reloadProgressPct: number;
  meleeComboStage: 0 | 1 | 2 | 3;
  meleeComboLabel: string;
  dodgeRollActive: boolean;
  dodgeRollCooldownSec: number;
  headshotBannerActive: boolean;
  activeGadgetKind?: TacticalGadgetKind;
  smokeGrenades?: number;
  molotovs?: number;
  inSmokeScreen?: boolean;
  activeDynamicEncounter: {
    id: string;
    title: string;
    subtitle: string;
    progressPct: number;
    remainingSec: number;
    rewardRp: number;
  } | null;
  onTriggerReload?: () => void;
  onThrowGadget?: () => void;
  onCycleGadget?: () => void;
}

export const TacticalCombatHudCluster: React.FC<
  TacticalCombatHudClusterProps
> = ({
  isMeleeWeapon,
  magazineInClip,
  magazineCapacity,
  reloadingWeapon,
  reloadProgressPct,
  meleeComboStage,
  meleeComboLabel,
  dodgeRollActive,
  dodgeRollCooldownSec,
  headshotBannerActive,
  activeGadgetKind = 'smoke_grenade',
  smokeGrenades = 0,
  molotovs = 0,
  inSmokeScreen = false,
  activeDynamicEncounter,
  onTriggerReload,
  onThrowGadget,
  onCycleGadget,
}) => {
  const gadgetCount =
    activeGadgetKind === 'smoke_grenade' ? smokeGrenades : molotovs;
  const gadgetLabel =
    activeGadgetKind === 'smoke_grenade' ? 'ASAP' : 'MOLOTOV';
  return (
    <div
      data-testid="tactical-combat-hud-cluster"
      className="flex flex-col items-end gap-1.5 pointer-events-auto"
    >
      {/* Dynamic Street Encounter Live Tracker */}
      {activeDynamicEncounter && (
        <div
          data-testid="hud-dynamic-encounter"
          className="aaa-glass rounded-xl px-3 py-2 border border-[#f59e0b]/40 shadow-xl max-w-xs text-right animate-aaa-up"
        >
          <div className="flex items-center justify-end gap-1.5">
            <span className="px-1.5 py-0.5 rounded bg-[#f59e0b] text-[#090c12] font-mono-num text-[9px] font-extrabold uppercase tracking-wider">
              INSIDEN JALANAN · {Math.ceil(activeDynamicEncounter.remainingSec)}d
            </span>
            <span className="font-mono-num text-[10px] font-bold text-[#4ade80]">
              +{formatRupiah(activeDynamicEncounter.rewardRp)}
            </span>
          </div>
          <div className="font-display text-xs sm:text-sm font-bold text-[#f4f1ea] mt-0.5 truncate">
            {activeDynamicEncounter.title}
          </div>
          <div className="text-[10px] text-[#cbd5e1] truncate">
            {activeDynamicEncounter.subtitle}
          </div>
          <div className="w-full h-1.5 bg-[#090c12]/80 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-gradient-to-r from-[#f59e0b] to-[#22c55e] transition-all duration-150"
              style={{
                width: `${Math.max(
                  4,
                  Math.min(100, activeDynamicEncounter.progressPct)
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Headshot / Critical Strike Flash Pill */}
      {headshotBannerActive && (
        <div
          data-testid="hud-headshot-banner"
          className="px-2.5 py-1 rounded-lg bg-[#ef4444]/90 text-[#fef2f2] font-mono-num text-[10px] font-extrabold uppercase tracking-wider shadow-lg animate-aaa-up"
        >
          HEADSHOT KRITIS · x1.85 DAMAGE
        </div>
      )}

      {/* 3-Hit Melee Combo Chain Badge */}
      {meleeComboStage > 0 && (
        <div
          data-testid="hud-melee-combo-badge"
          className={`px-2.5 py-1 rounded-lg font-mono-num text-[10px] font-extrabold uppercase tracking-wider shadow-lg transition-all ${
            meleeComboStage === 3
              ? 'bg-[#f59e0b] text-[#090c12]'
              : 'bg-[#1e293b]/90 text-[#fde047] border border-[#f59e0b]/40'
          }`}
        >
          KOMBO SILAT {meleeComboStage}/3 · {meleeComboLabel || 'SERANGAN'}
        </div>
      )}

      {/* Magazine Clip / Reload Progress & Tactical Dodge Roll Row */}
      <div className="flex items-center gap-1.5">
        {!isMeleeWeapon && magazineCapacity > 0 && (
          <button
            type="button"
            data-testid="hud-magazine-status"
            onClick={onTriggerReload}
            title="Tekan [R] untuk Isi Ulang Magasin"
            className={`px-2.5 py-1 rounded-lg aaa-glass-subtle font-mono-num text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              reloadingWeapon
                ? 'text-[#f59e0b] border border-[#f59e0b]/50'
                : magazineInClip <= Math.ceil(magazineCapacity * 0.25)
                  ? 'text-[#ef4444] border border-[#ef4444]/50'
                  : 'text-[#e2e8f0] hover:bg-white/10'
            }`}
          >
            {reloadingWeapon ? (
              <span>ISI ULANG {Math.round(reloadProgressPct)}%</span>
            ) : (
              <span>
                MAG {magazineInClip}/{magazineCapacity} · [R]
              </span>
            )}
          </button>
        )}

        <div
          data-testid="hud-dodge-roll-status"
          className={`px-2 py-1 rounded-lg aaa-glass-subtle font-mono-num text-[10px] font-bold ${
            dodgeRollActive
              ? 'text-[#38bdf8] border border-[#38bdf8]/50'
              : dodgeRollCooldownSec > 0
                ? 'text-[#64748b]'
                : 'text-[#cbd5e1]'
          }`}
        >
          {dodgeRollActive
            ? 'GULING I-FRAME'
            : dodgeRollCooldownSec > 0
              ? `GULING ${dodgeRollCooldownSec.toFixed(1)}d`
              : '[ALT] GULING'}
        </div>

        {/* Grand Plan 9.0: Throwable Tactical Gadget Slot ([8] Throw / [9] Cycle) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            data-testid="hud-tactical-gadget-btn"
            onClick={onThrowGadget}
            title="Tekan [8] untuk Melempar Gadget Taktis"
            className={`px-2 py-1 rounded-lg aaa-glass-subtle font-mono-num text-[10px] font-bold cursor-pointer transition-colors ${
              gadgetCount <= 0
                ? 'text-[#64748b]'
                : activeGadgetKind === 'molotov'
                  ? 'text-[#fb923c] border border-[#f97316]/45 hover:bg-[#f97316]/15'
                  : 'text-[#67e8f9] border border-[#22d3ee]/45 hover:bg-[#22d3ee]/15'
            }`}
          >
            [8] {gadgetLabel} ({gadgetCount})
          </button>
          {onCycleGadget && (
            <button
              type="button"
              data-testid="hud-cycle-gadget-btn"
              onClick={onCycleGadget}
              title="Tekan [9] untuk Ganti Jenis Gadget"
              className="px-1.5 py-1 rounded-lg aaa-glass-subtle font-mono-num text-[9px] text-[#94a3b8] hover:text-white cursor-pointer"
            >
              [9]
            </button>
          )}
        </div>
      </div>

      {inSmokeScreen && (
        <div
          data-testid="hud-smoke-screen-badge"
          className="px-2.5 py-0.5 rounded bg-[#334155]/90 border border-[#94a3b8]/50 text-[#e2e8f0] font-mono-num text-[9px] font-extrabold uppercase tracking-wider"
        >
          TABIR ASAP AKTIF · SILUMAN APARAT
        </div>
      )}
    </div>
  );
};

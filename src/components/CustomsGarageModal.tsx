import React from 'react';
import {
  PlayerProgressState,
  VEHICLE_CUSTOM_PAINTS,
  VEHICLE_UNDERGLOWS,
  VEHICLE_UPGRADE_COST,
  VehicleCustomConfig,
  formatRupiah,
} from '../game/rules';

interface CustomsGarageModalProps {
  playerState: PlayerProgressState;
  onSelectPaint: (paintId: string, price: number) => void;
  onSelectUnderglow: (glowId: string, price: number) => void;
  onUpgradeEngine: () => void;
  onUpgradeArmorPlating: () => void;
  onRepairAndClearWanted: () => void;
  onClose: () => void;
}

export const CustomsGarageModal: React.FC<CustomsGarageModalProps> = ({
  playerState,
  onSelectPaint,
  onSelectUnderglow,
  onUpgradeEngine,
  onUpgradeArmorPlating,
  onRepairAndClearWanted,
  onClose,
}) => {
  const customs: VehicleCustomConfig = playerState.vehicleCustoms;

  const engineBonus = playerState.vehicleUpgradeLevel * 12;
  const armorBonus = customs.armorPlatingLevel * 18;
  const topSpeedStat = Math.min(100, 64 + engineBonus);
  const accelStat = Math.min(100, 62 + engineBonus);
  const handlingStat = Math.min(100, 74 + playerState.vehicleUpgradeLevel * 8);
  const armorStat = Math.min(100, 46 + armorBonus);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bengkel Kustom Nusantara 360"
      className="fixed inset-0 z-30 flex items-center justify-end p-4 md:p-6 pointer-events-none"
    >
      {/* Sleek Right-Docked Drawer so the 360° vehicle showcase stays unobstructed */}
      <div className="w-full max-w-sm aaa-glass rounded-2xl p-5 shadow-2xl text-[#f4f1ea] flex flex-col gap-4 max-h-[92vh] overflow-y-auto pointer-events-auto animate-aaa-up">
        <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <div className="text-[11px] font-medium text-[#38bdf8]">
              Bengkel Kustom 360°
            </div>
            <h2 className="font-display text-2xl font-extrabold italic uppercase text-[#f4f1ea] leading-tight">
              Garasi Nusantara
            </h2>
            <p className="text-xs font-mono-num font-bold text-[#22c55e] mt-0.5">
              {formatRupiah(playerState.rupiah)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/15 text-[#cbd5e1] hover:text-white cursor-pointer whitespace-nowrap"
          >
            Selesai [Esc]
          </button>
        </div>

        {/* Performance Telemetry */}
        <div className="flex flex-col gap-2 pb-3 border-b border-white/10">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#94a3b8]">Performa Kendaraan</span>
            <span className="font-mono-num text-[#22c55e]">
              +{playerState.vehicleUpgradeLevel * 15}% Power
            </span>
          </div>

          {[
            { label: 'Kecepatan Puncak', val: topSpeedStat, color: '#f59e0b' },
            { label: 'Akselerasi Turbo', val: accelStat, color: '#38bdf8' },
            { label: 'Kendali Drift', val: handlingStat, color: '#22c55e' },
            { label: 'Ketahanan Sasis', val: armorStat, color: '#c084fc' },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#cbd5e1]">{stat.label}</span>
                <span className="font-mono-num text-[#f4f1ea]">{stat.val}/100</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-200"
                  style={{ width: `${stat.val}%`, backgroundColor: stat.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Instant Repair & Clear Wanted */}
        <button
          type="button"
          onClick={onRepairAndClearWanted}
          className="w-full p-3 rounded-xl bg-[#22c55e]/12 hover:bg-[#22c55e]/20 border border-[#22c55e]/40 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
        >
          <div>
            <div className="text-xs font-bold text-[#22c55e]">
              Reparasi Bodi &amp; Ganti Pelat
            </div>
            <div className="text-[11px] text-[#cbd5e1]">
              Pulihkan mesin &amp; hapus bintang buronan
            </div>
          </div>
          <span className="font-mono-num text-xs font-bold text-[#f4f1ea] shrink-0">
            Rp 75rb
          </span>
        </button>

        {/* PBR Paint Finishes */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[#94a3b8]">Cat Bodi PBR</span>
          <div className="grid grid-cols-2 gap-1.5">
            {VEHICLE_CUSTOM_PAINTS.map((p) => {
              const active = customs.paintId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPaint(p.id, active ? 0 : p.price)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#f59e0b]/15 border-[#f59e0b]'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border border-white/30 shrink-0"
                      style={{
                        backgroundColor:
                          '#' + p.primaryHex.toString(16).padStart(6, '0'),
                      }}
                    />
                    <span className="text-xs font-semibold text-[#f4f1ea] truncate">
                      {p.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-mono-num mt-1">
                    <span className="capitalize text-[#94a3b8]">{p.finish}</span>
                    <span className="text-[#f59e0b]">
                      {active
                        ? 'Aktif'
                        : p.price === 0
                        ? 'Gratis'
                        : formatRupiah(p.price)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Underglow LED */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[#94a3b8]">
            Lampu Kolong Neon
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {VEHICLE_UNDERGLOWS.map((g) => {
              const active = customs.underglowId === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => onSelectUnderglow(g.id, active ? 0 : g.price)}
                  className={`p-2 rounded-xl border text-left cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#c084fc]/15 border-[#c084fc]'
                      : 'bg-white/[0.03] border-white/10 hover:bg-white/8'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: g.cssColor }}
                    />
                    <span className="text-xs font-medium text-[#f4f1ea] truncate">
                      {g.name}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono-num text-[#94a3b8] mt-0.5">
                    {active
                      ? 'Aktif'
                      : g.price === 0
                      ? 'Standar'
                      : formatRupiah(g.price)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Engine & Armor Upgrades */}
        <div className="divide-y divide-white/10 border-t border-white/10 pt-1">
          <div className="py-2.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-[#f4f1ea]">
                Mesin Twin-Turbo (Lv {playerState.vehicleUpgradeLevel}/3)
              </div>
              <div className="text-[11px] text-[#94a3b8]">
                +{playerState.vehicleUpgradeLevel * 15}% kecepatan &amp; akselerasi
              </div>
            </div>
            <button
              type="button"
              disabled={
                playerState.vehicleUpgradeLevel >= 3 ||
                playerState.rupiah < VEHICLE_UPGRADE_COST
              }
              onClick={onUpgradeEngine}
              className="px-3 py-1.5 rounded-lg bg-[#f59e0b] disabled:bg-white/10 text-[#090c12] disabled:text-[#64748b] font-mono-num text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              {playerState.vehicleUpgradeLevel >= 3
                ? 'Maks'
                : formatRupiah(VEHICLE_UPGRADE_COST)}
            </button>
          </div>

          <div className="py-2.5 flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-[#f4f1ea]">
                Sasis Lapis Baja (Lv {customs.armorPlatingLevel}/3)
              </div>
              <div className="text-[11px] text-[#94a3b8]">
                Reduksi benturan &amp; tembakan
              </div>
            </div>
            <button
              type="button"
              disabled={
                customs.armorPlatingLevel >= 3 || playerState.rupiah < 200000
              }
              onClick={onUpgradeArmorPlating}
              className="px-3 py-1.5 rounded-lg bg-[#38bdf8] disabled:bg-white/10 text-[#090c12] disabled:text-[#64748b] font-mono-num text-xs font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              {customs.armorPlatingLevel >= 3 ? 'Maks' : 'Rp 200.000'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

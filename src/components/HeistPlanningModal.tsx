import React from 'react';
import {
  GRAND_HEISTS,
  HEIST_CREW_ROSTER,
  HeistApproach,
  HeistId,
  PlayerProgressState,
  calculateHeistBreakdown,
  formatRupiah,
} from '../game/rules';

interface HeistPlanningModalProps {
  playerState: PlayerProgressState;
  onUpdatePlan: (plan: PlayerProgressState['activeHeistPlan']) => void;
  onLaunchHeistSetup: (heistId: HeistId) => void;
  onLaunchHeistFinale: (heistId: HeistId) => void;
  onClose: () => void;
}

export const HeistPlanningModal: React.FC<HeistPlanningModalProps> = ({
  playerState,
  onUpdatePlan,
  onLaunchHeistSetup,
  onLaunchHeistFinale,
  onClose,
}) => {
  const plan = playerState.activeHeistPlan;
  const selectedHeist =
    GRAND_HEISTS.find((h) => h.id === plan.heistId) || GRAND_HEISTS[0];
  const setupCompleted = playerState.completedHeistSetups.includes(
    selectedHeist.id
  );
  const heistCompleted = playerState.completedHeists.includes(selectedHeist.id);

  const breakdown = calculateHeistBreakdown(
    plan.heistId,
    plan.hackerId,
    plan.driverId,
    plan.gunmanId
  );

  const hackers = HEIST_CREW_ROSTER.filter((c) => c.role === 'hacker');
  const drivers = HEIST_CREW_ROSTER.filter((c) => c.role === 'driver');
  const gunmen = HEIST_CREW_ROSTER.filter((c) => c.role === 'gunman');

  const mapX = (wx: number) => Math.round(((wx + 90) / 180) * 320 + 20);
  const mapZ = (wz: number) => Math.round(((wz + 90) / 180) * 116 + 17);
  const vaultSvgX = mapX(selectedHeist.vaultX);
  const vaultSvgY = mapZ(selectedHeist.vaultZ);
  const escapeSvgX = mapX(selectedHeist.escapeX);
  const escapeSvgY = mapZ(selectedHeist.escapeZ);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Papan Strategi Grand Heist"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-30 flex items-center justify-center p-4 md:p-6 pointer-events-auto"
      style={{ backgroundColor: 'rgba(6, 8, 13, 0.84)' }}
    >
      <div className="w-full max-w-6xl aaa-glass rounded-2xl p-6 shadow-2xl text-[#f4f1ea] flex flex-col gap-5 max-h-[92vh] overflow-y-auto animate-aaa-up">
        {/* Clean Command Room Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="text-xs font-medium text-[#38bdf8]">
              Ruang Komando SCBD · Operasi Grand Heist
            </div>
            <h2 className="font-display text-3xl font-extrabold italic uppercase tracking-wide text-[#f4f1ea] mt-0.5">
              {selectedHeist.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-white/8 hover:bg-white/15 text-[#cbd5e1] hover:text-white cursor-pointer whitespace-nowrap"
          >
            Tutup [Esc]
          </button>
        </div>

        {/* Target Operation Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {GRAND_HEISTS.map((h, i) => {
            const active = plan.heistId === h.id;
            const done = playerState.completedHeists.includes(h.id);
            return (
              <button
                key={h.id}
                type="button"
                onClick={() => onUpdatePlan({ ...plan, heistId: h.id })}
                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-[#f59e0b]/12 border-[#f59e0b]'
                    : 'bg-white/[0.03] border-white/10 hover:bg-white/8'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#94a3b8]">Target 0{i + 1}</span>
                    <span className="font-mono-num font-bold text-[#22c55e]">
                      {done ? 'Tuntas' : formatRupiah(h.grossTakeRp)}
                    </span>
                  </div>
                  <div className="font-display text-xl font-bold uppercase text-[#f4f1ea] mt-0.5">
                    {h.title}
                  </div>
                  <div className="text-xs text-[#94a3b8]">{h.targetLocation}</div>
                </div>
                <div className="text-[11px] font-mono-num text-[#cbd5e1] pt-1.5 border-t border-white/10">
                  Target: <span className="text-[#ef4444]">{h.victimStock}</span> ·
                  Rival: <span className="text-[#22c55e]">{h.targetStockRival}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main 2-Column Blueprint Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left 7 Cols: Approach + Crew Selection */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div>
              <h3 className="text-xs font-semibold text-[#94a3b8] mb-2">
                Metode Eksekusi
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(
                  [
                    {
                      id: 'stealth_cyber' as HeistApproach,
                      title: 'Siluman Siber & EMP',
                      desc: selectedHeist.stealthDesc,
                      note: 'Risiko polisi rendah · Saham KMYR naik',
                    },
                    {
                      id: 'tactical_assault' as HeistApproach,
                      title: 'Serbuan Lapis Baja',
                      desc: selectedHeist.assaultDesc,
                      note: 'Aksi tempur penuh · Saham GATO naik',
                    },
                  ] as const
                ).map((app) => {
                  const active = plan.approach === app.id;
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => onUpdatePlan({ ...plan, approach: app.id })}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer flex flex-col justify-between gap-2 transition-colors ${
                        active
                          ? 'bg-[#38bdf8]/12 border-[#38bdf8]'
                          : 'bg-white/[0.03] border-white/10 hover:bg-white/8'
                      }`}
                    >
                      <div>
                        <div className="font-display text-lg font-bold uppercase text-[#f4f1ea]">
                          {app.title}
                        </div>
                        <p className="text-xs text-[#cbd5e1] mt-1 leading-relaxed">
                          {app.desc}
                        </p>
                      </div>
                      <div className="text-[11px] text-[#38bdf8]">{app.note}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[#94a3b8] mb-2">
                Spesialis Kru Pendukung
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  {
                    roleLabel: 'Peretas Siber',
                    list: hackers,
                    selectedId: plan.hackerId,
                    onPick: (id: string) => onUpdatePlan({ ...plan, hackerId: id }),
                    accent: '#38bdf8',
                  },
                  {
                    roleLabel: 'Sopir Pelarian',
                    list: drivers,
                    selectedId: plan.driverId,
                    onPick: (id: string) => onUpdatePlan({ ...plan, driverId: id }),
                    accent: '#f59e0b',
                  },
                  {
                    roleLabel: 'Penembak Taktis',
                    list: gunmen,
                    selectedId: plan.gunmanId,
                    onPick: (id: string) => onUpdatePlan({ ...plan, gunmanId: id }),
                    accent: '#ef4444',
                  },
                ].map((group) => (
                  <div key={group.roleLabel} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-[#cbd5e1]">
                      {group.roleLabel}
                    </span>
                    {group.list.map((c) => {
                      const active = group.selectedId === c.id;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => group.onPick(c.id)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                            active
                              ? 'bg-[#f59e0b]/12 border-[#f59e0b]'
                              : 'bg-white/[0.03] border-white/10 hover:bg-white/8'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold text-[#f4f1ea] truncate">
                              {c.name}
                            </span>
                            <span className="text-[11px] font-mono-num font-bold text-[#ef4444]">
                              -{c.cutPercent}%
                            </span>
                          </div>
                          <div className="w-full h-1 bg-white/10 rounded-full my-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${c.skillRating}%`,
                                backgroundColor: group.accent,
                              }}
                            />
                          </div>
                          <div className="text-[11px] text-[#94a3b8] leading-snug">
                            {c.perkDesc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right 5 Cols: Schematic Map & Financial Ledger */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-5">
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono-num text-[#38bdf8] mb-1.5">
                  <span>Skematik Rute Ekstraksi</span>
                  <span className="text-[#94a3b8]">
                    ({selectedHeist.vaultX}, {selectedHeist.vaultZ}) → (
                    {selectedHeist.escapeX}, {selectedHeist.escapeZ})
                  </span>
                </div>
                <svg
                  viewBox="0 0 360 150"
                  className="w-full h-36 rounded-xl bg-[#070a10] border border-white/10"
                >
                  {[60, 120, 180, 240, 300].map((gx) => (
                    <line
                      key={gx}
                      x1={gx}
                      y1={0}
                      x2={gx}
                      y2={150}
                      stroke="rgba(56,189,248,0.1)"
                      strokeWidth="1"
                    />
                  ))}
                  {[38, 75, 112].map((gy) => (
                    <line
                      key={gy}
                      x1={0}
                      y1={gy}
                      x2={360}
                      y2={gy}
                      stroke="rgba(56,189,248,0.1)"
                      strokeWidth="1"
                    />
                  ))}
                  <line
                    x1={20}
                    y1={56}
                    x2={340}
                    y2={56}
                    stroke="rgba(245,158,11,0.3)"
                    strokeWidth="3"
                  />
                  <line
                    x1={vaultSvgX}
                    y1={vaultSvgY}
                    x2={escapeSvgX}
                    y2={escapeSvgY}
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="5 4"
                  />
                  <circle
                    cx={vaultSvgX}
                    cy={vaultSvgY}
                    r="7"
                    fill="rgba(239,68,68,0.28)"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                  <text
                    x={vaultSvgX + 10}
                    y={vaultSvgY + 4}
                    fill="#f4f1ea"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    Brankas
                  </text>
                  <circle
                    cx={escapeSvgX}
                    cy={escapeSvgY}
                    r="6"
                    fill="rgba(34,197,94,0.28)"
                    stroke="#22c55e"
                    strokeWidth="2"
                  />
                  <text
                    x={escapeSvgX + 10}
                    y={escapeSvgY + 4}
                    fill="#22c55e"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    Ekstraksi
                  </text>
                </svg>
              </div>

              <div className="divide-y divide-white/10 text-xs">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#94a3b8]">Estimasi Isi Brankas</span>
                  <span className="font-mono-num font-semibold text-[#f4f1ea]">
                    {formatRupiah(breakdown.grossTakeRp)}
                  </span>
                </div>
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#94a3b8]">
                    Komisi Kru ({breakdown.totalCrewCutPercent}%)
                  </span>
                  <span className="font-mono-num font-semibold text-[#ef4444]">
                    -{formatRupiah(breakdown.crewCutRp)}
                  </span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-[#f4f1ea]">
                    Bagian Bersih Trio
                  </span>
                  <span className="font-mono-num font-extrabold text-lg text-[#22c55e]">
                    {formatRupiah(breakdown.netPlayerTakeRp)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-[#94a3b8] leading-relaxed">
                Tip Kirana: Borong saham{' '}
                <span className="text-[#22c55e] font-semibold">
                  {selectedHeist.targetStockRival}
                </span>{' '}
                di iFruit OS sebelum membobol{' '}
                <span className="text-[#ef4444] font-semibold">
                  {selectedHeist.victimStock}
                </span>{' '}
                untuk memicu lonjakan harga +28%.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {!setupCompleted && (
                <button
                  type="button"
                  onClick={() => {
                    onLaunchHeistSetup(selectedHeist.id);
                    onClose();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-[#38bdf8] font-semibold text-xs cursor-pointer transition-colors"
                >
                  Jalankan Misi Persiapan (Setup)
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onLaunchHeistFinale(selectedHeist.id);
                  onClose();
                }}
                className="w-full py-3 px-5 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] font-display text-xl font-extrabold uppercase tracking-wider cursor-pointer transition-colors"
              >
                {heistCompleted
                  ? 'Eksekusi Ulang Grand Heist'
                  : 'Luncurkan Grand Heist'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

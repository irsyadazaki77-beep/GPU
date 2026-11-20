import React, { useEffect, useRef, useState } from 'react';
import {
  GRAND_HEISTS,
  HeistBreachSession,
  HeistId,
  formatRupiah,
} from '../game/rules';
import { soundEngine } from '../game/sound';

interface HeistBreachOverlayProps {
  session: HeistBreachSession;
  synergyBonusPct: number;
  onCompleteBreach: (heistId: HeistId, bonusMultiplier: number) => void;
  onCancel: () => void;
}

export const HeistBreachOverlay: React.FC<HeistBreachOverlayProps> = ({
  session,
  synergyBonusPct,
  onCompleteBreach,
  onCancel,
}) => {
  const heist =
    GRAND_HEISTS.find((h) => h.id === session.heistId) || GRAND_HEISTS[0];
  const isCyber = session.stage === 'cyber_signal';

  // Cyber Signal Frequency Alignment state
  const [targetFreq, setTargetFreq] = useState<number>(62);
  const [cursorFreq, setCursorFreq] = useState<number>(18);
  const [lockedBands, setLockedBands] = useState<number>(0);

  // Thermal Vault Drill state
  const [drillProgress, setDrillProgress] = useState<number>(0);
  const [drillHeat, setDrillHeat] = useState<number>(20);
  const [drillingHeld, setDrillingHeld] = useState<boolean>(false);
  const [overheated, setOverheated] = useState<boolean>(false);
  const [statusLine, setStatusLine] = useState<string>(
    isCyber
      ? 'Kirana: "Kunci 3 kanal sinyal saat kursor masuk zona hijau!"'
      : 'Raka: "Tahan Bor Termal di zona panas optimal — jangan sampai overheat!"'
  );

  const dirRef = useRef<number>(1);
  const completedRef = useRef<boolean>(false);

  // Animation loop for Cyber Signal Sweep OR Thermal Drill Heat/Progress
  useEffect(() => {
    let rafId = 0;
    let last = performance.now();

    const loop = (now: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (completedRef.current) return;

      if (isCyber) {
        setCursorFreq((prev) => {
          const speed = 58 + lockedBands * 16;
          let next = prev + dirRef.current * speed * dt;
          if (next >= 96) {
            next = 96;
            dirRef.current = -1;
          } else if (next <= 4) {
            next = 4;
            dirRef.current = 1;
          }
          return next;
        });
      } else {
        setDrillHeat((prevHeat) => {
          let nextHeat = prevHeat;
          if (drillingHeld && !overheated) {
            nextHeat = Math.min(100, prevHeat + dt * 34);
          } else {
            nextHeat = Math.max(12, prevHeat - dt * 28);
          }

          if (nextHeat >= 96 && !overheated) {
            setOverheated(true);
            setDrillingHeld(false);
            soundEngine.playTone(140, 0.16, 'sawtooth', 0.15);
            setStatusLine(
              'Raka: "Bor kepanasan! Lepas sebentar biar dingin dulu!"'
            );
          } else if (overheated && nextHeat <= 42) {
            setOverheated(false);
            setStatusLine(
              'Raka: "Suhu aman lagi! Lanjut bor pintu brankas sekarang!"'
            );
          }

          if (drillingHeld && !overheated && nextHeat < 95) {
            const sweetSpot = nextHeat >= 50 && nextHeat <= 84;
            const rate = sweetSpot ? 26 : 14;
            setDrillProgress((prevProg) => {
              const nextProg = Math.min(100, prevProg + rate * dt);
              if (nextProg >= 100 && !completedRef.current) {
                completedRef.current = true;
                soundEngine.playMissionFanfare();
                window.setTimeout(() => {
                  onCompleteBreach(
                    session.heistId,
                    1 + synergyBonusPct / 100
                  );
                }, 420);
              }
              return nextProg;
            });
          }

          return nextHeat;
        });
      }
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [
    isCyber,
    lockedBands,
    drillingHeld,
    overheated,
    onCompleteBreach,
    session.heistId,
    synergyBonusPct,
  ]);

  const handleLockSignal = () => {
    if (!isCyber || completedRef.current) return;
    const dist = Math.abs(cursorFreq - targetFreq);
    if (dist <= 11) {
      const nextLocked = lockedBands + 1;
      setLockedBands(nextLocked);
      soundEngine.playPickup();
      if (nextLocked >= 3) {
        completedRef.current = true;
        setStatusLine(
          'Kirana: "Firewall brankas jebol 100%! Saatnya pelarian!"'
        );
        soundEngine.playMissionFanfare();
        window.setTimeout(() => {
          onCompleteBreach(session.heistId, 1 + synergyBonusPct / 100);
        }, 420);
      } else {
        setTargetFreq(24 + ((nextLocked * 29 + 17) % 56));
        setStatusLine(
          `Kirana: "Kanal ${nextLocked}/3 terkunci! Sisa ${3 - nextLocked} lapis enkripsi lagi!"`
        );
      }
    } else {
      soundEngine.playTone(170, 0.12, 'sawtooth', 0.14);
      setStatusLine(
        'Kirana: "Meleset dikit! Tunggu kursor tepat di zona hijau!"'
      );
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pembobolan Brankas Grand Heist"
      className="fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(6, 9, 15, 0.86)' }}
    >
      <div className="w-full max-w-xl aaa-glass rounded-2xl p-6 text-[#f4f1ea] shadow-2xl border border-white/12 flex flex-col gap-5 animate-aaa-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-3.5">
          <div>
            <div className="text-[11px] font-mono-num uppercase tracking-wider text-[#ff6b4a]">
              Tahap Pembobolan · {isCyber ? 'Infiltrasi Siber Kirana' : 'Bor Termal Raka'}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold italic uppercase text-[#f4f1ea] mt-0.5">
              {heist.title}
            </h2>
            <div className="text-xs text-[#94a3b8] mt-0.5">
              {heist.targetLocation} · Bonus Sinergi Trio +{synergyBonusPct}% · Target{' '}
              <span className="font-mono-num text-[#22c55e] font-semibold">
                {formatRupiah(heist.grossTakeRp)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-xs font-mono-num text-[#cbd5e1] cursor-pointer"
          >
            Batal
          </button>
        </div>

        {/* Live Crew Radio Banter */}
        <div className="px-3.5 py-2.5 rounded-xl bg-[#0e1420] border-l-2 border-l-[#38bdf8] text-xs text-[#e2e8f0]">
          {statusLine}
        </div>

        {isCyber ? (
          /* STAGE A: KIRANA CYBER SIGNAL ALIGNMENT */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs font-mono-num">
              <span className="text-[#94a3b8]">Lapis Enkripsi Terkunci</span>
              <span className="text-[#22c55e] font-bold">{lockedBands} / 3</span>
            </div>

            <div className="relative h-12 rounded-xl bg-[#070a10] border border-white/15 overflow-hidden">
              {/* Target Green Lock Zone */}
              <div
                className="absolute inset-y-0 bg-[#22c55e]/28 border-x-2 border-[#22c55e]"
                style={{
                  left: `${Math.max(0, targetFreq - 10)}%`,
                  width: '20%',
                }}
              />
              {/* Moving Signal Cursor */}
              <div
                className="absolute inset-y-1 w-2 rounded bg-[#38bdf8] shadow-[0_0_12px_#38bdf8]"
                style={{ left: `calc(${cursorFreq}% - 4px)` }}
              />
            </div>

            <button
              type="button"
              onClick={handleLockSignal}
              className="w-full py-3.5 rounded-xl bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#090c12] font-display text-xl font-extrabold uppercase tracking-wider cursor-pointer transition-colors"
            >
              Kunci Frekuensi Sinyal [Klik]
            </button>
          </div>
        ) : (
          /* STAGE B: RAKA THERMAL VAULT DRILL */
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono-num">
                <span className="text-[#94a3b8]">Progres Pembobolan Brankas</span>
                <span className="text-[#22c55e] font-bold">
                  {Math.round(drillProgress)}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-[#22c55e] transition-all duration-75"
                  style={{ width: `${drillProgress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-mono-num">
                <span className="text-[#94a3b8]">Suhu Mata Bor Termal</span>
                <span
                  className={`font-bold ${
                    overheated
                      ? 'text-[#ef4444]'
                      : drillHeat >= 50 && drillHeat <= 84
                      ? 'text-[#f59e0b]'
                      : 'text-[#cbd5e1]'
                  }`}
                >
                  {Math.round(drillHeat)}°C {overheated ? '(OVERHEAT)' : drillHeat >= 50 && drillHeat <= 84 ? '(OPTIMAL 2x)' : ''}
                </span>
              </div>
              <div className="relative w-full h-4 rounded-full bg-[#070a10] border border-white/15 overflow-hidden">
                <div
                  className="absolute inset-y-0 bg-[#f59e0b]/25 border-x border-[#f59e0b]/60"
                  style={{ left: '50%', width: '34%' }}
                />
                <div
                  className={`h-full transition-all duration-75 ${
                    overheated
                      ? 'bg-[#ef4444]'
                      : drillHeat >= 50
                      ? 'bg-[#f59e0b]'
                      : 'bg-[#38bdf8]'
                  }`}
                  style={{ width: `${drillHeat}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              disabled={overheated}
              onPointerDown={() => setDrillingHeld(true)}
              onPointerUp={() => setDrillingHeld(false)}
              onPointerLeave={() => setDrillingHeld(false)}
              className="w-full py-3.5 rounded-xl bg-[#f59e0b] hover:bg-[#fbbf24] disabled:bg-white/10 text-[#090c12] disabled:text-[#64748b] font-display text-xl font-extrabold uppercase tracking-wider cursor-pointer transition-colors select-none"
            >
              {overheated
                ? 'Mendinginkan Bor Termal...'
                : drillingHeld
                ? 'Sedang Mengebor Brankas...'
                : 'Tahan untuk Mengebor Brankas'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

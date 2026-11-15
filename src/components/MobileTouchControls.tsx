import React, { useEffect, useRef, useState } from 'react';
import type { TouchControlsMode, VehicleType } from '../game/types';
import { virtualInputRef } from '../state/gameStore';

interface MobileTouchControlsProps {
  mode?: TouchControlsMode;
  drivingVehicle: VehicleType | null;
  nearbyVehicle: VehicleType | null;
  fokusActive: boolean;
  tpsAiming: boolean;
  onToggleVehicle: () => void;
  onToggleFokus: () => void;
  onToggleTpsAim: () => void;
  onHonk?: () => void;
}

const STICK_RADIUS = 46;

export const MobileTouchControls: React.FC<MobileTouchControlsProps> = ({
  mode = 'auto',
  drivingVehicle,
  nearbyVehicle,
  fokusActive,
  tpsAiming,
  onToggleVehicle,
  onToggleFokus,
  onToggleTpsAim,
  onHonk,
}) => {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [sprintLocked, setSprintLocked] = useState(false);

  const stickTouchIdRef = useRef<number | null>(null);
  const stickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lookTouchIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const checkTouch = () => {
      const hasCoarse =
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(pointer: coarse)').matches ||
          'ontouchstart' in window ||
          window.innerWidth < 820);
      setIsTouchDevice(Boolean(hasCoarse));
    };
    checkTouch();
    window.addEventListener('resize', checkTouch);
    return () => window.removeEventListener('resize', checkTouch);
  }, []);

  useEffect(() => {
    return () => {
      virtualInputRef.moveX = 0;
      virtualInputRef.moveY = 0;
      virtualInputRef.fireHeld = false;
      virtualInputRef.driftHeld = false;
      virtualInputRef.sprintHeld = false;
    };
  }, []);

  const shouldRender =
    mode === 'on' || (mode === 'auto' && isTouchDevice);

  if (!shouldRender) return null;

  const updateStickVector = (clientX: number, clientY: number) => {
    const dx = clientX - stickCenterRef.current.x;
    const dy = clientY - stickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(STICK_RADIUS, dist);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;

    setKnobOffset({ x: kx, y: ky });

    const normX = kx / STICK_RADIUS;
    const normY = -ky / STICK_RADIUS;
    virtualInputRef.moveX = Math.abs(normX) < 0.12 ? 0 : normX;
    virtualInputRef.moveY = Math.abs(normY) < 0.12 ? 0 : normY;
  };

  const resetStick = () => {
    stickTouchIdRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    virtualInputRef.moveX = 0;
    virtualInputRef.moveY = 0;
  };

  return (
    <div
      aria-label="Kontrol Layar Sentuh Mobile"
      className="fixed inset-x-0 bottom-20 sm:bottom-24 z-20 pointer-events-none flex items-end justify-between px-4 select-none"
    >
      {/* LEFT THUMB ZONE: Virtual Analog Movement / Steering Stick */}
      <div className="flex flex-col items-center gap-2 pointer-events-auto">
        {!drivingVehicle && (
          <button
            type="button"
            onClick={() => {
              const next = !sprintLocked;
              setSprintLocked(next);
              virtualInputRef.sprintHeld = next;
            }}
            className={`min-h-[36px] px-3 rounded-lg font-mono-num text-[11px] font-bold border transition-colors cursor-pointer ${
              sprintLocked
                ? 'bg-[#f59e0b] text-[#090c12] border-[#f59e0b]'
                : 'bg-[#090c12]/85 text-[#cbd5e1] border-white/15'
            }`}
          >
            {sprintLocked ? 'Lari Cepat: Aktif' : 'Kunci Lari'}
          </button>
        )}

        <div
          onPointerDown={(e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            stickTouchIdRef.current = e.pointerId;
            const rect = e.currentTarget.getBoundingClientRect();
            stickCenterRef.current = {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            };
            updateStickVector(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (stickTouchIdRef.current !== e.pointerId) return;
            updateStickVector(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => {
            if (stickTouchIdRef.current === e.pointerId) {
              resetStick();
            }
          }}
          onPointerCancel={resetStick}
          data-testid="mobile-virtual-joystick"
          className="relative w-28 h-28 rounded-full bg-[#090c12]/80 border-2 border-white/20 shadow-2xl flex items-center justify-center touch-none"
        >
          <div className="w-12 h-12 rounded-full border border-white/10 pointer-events-none" />
          <div
            className="w-12 h-12 rounded-full bg-[#f59e0b] border-2 border-[#fef08a] shadow-lg pointer-events-none transition-transform duration-75"
            style={{
              transform: `translate3d(${Math.round(knobOffset.x)}px, ${Math.round(
                knobOffset.y
              )}px, 0)`,
            }}
          />
        </div>
      </div>

      {/* CENTER-RIGHT CAMERA SWIPE PAD (Invisible Touch Look Zone) */}
      <div
        onPointerDown={(e) => {
          lookTouchIdRef.current = e.pointerId;
          lastLookPosRef.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerMove={(e) => {
          if (lookTouchIdRef.current !== e.pointerId) return;
          const dx = e.clientX - lastLookPosRef.current.x;
          const dy = e.clientY - lastLookPosRef.current.y;
          lastLookPosRef.current = { x: e.clientX, y: e.clientY };
          virtualInputRef.lookDeltaX += dx;
          virtualInputRef.lookDeltaY += dy;
        }}
        onPointerUp={() => {
          lookTouchIdRef.current = null;
        }}
        onPointerCancel={() => {
          lookTouchIdRef.current = null;
        }}
        className="hidden max-sm:block flex-1 h-28 mx-2 pointer-events-auto touch-none"
      />

      {/* RIGHT THUMB ZONE: Adaptive Contextual Action Cluster (>=44x44px hitboxes) */}
      <div className="flex flex-col items-end gap-2 pointer-events-auto">
        {drivingVehicle ? (
          /* DRIVING MODE PEDALS & CONTROLS */
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onHonk}
              className="min-w-[52px] min-h-[44px] px-3 rounded-xl bg-[#090c12]/85 border border-white/15 text-xs font-mono-num font-bold text-[#facc15] active:scale-95 cursor-pointer"
            >
              Klakson
            </button>
            <button
              type="button"
              onClick={onToggleVehicle}
              className="min-w-[52px] min-h-[44px] px-3 rounded-xl bg-[#090c12]/85 border border-[#38bdf8]/50 text-xs font-mono-num font-bold text-[#38bdf8] active:scale-95 cursor-pointer"
            >
              Turun
            </button>
            <button
              type="button"
              onPointerDown={() => {
                virtualInputRef.driftHeld = true;
              }}
              onPointerUp={() => {
                virtualInputRef.driftHeld = false;
              }}
              onPointerLeave={() => {
                virtualInputRef.driftHeld = false;
              }}
              className="min-w-[64px] min-h-[52px] px-3 rounded-xl bg-[#ef4444]/85 border border-white/25 text-xs font-display font-extrabold uppercase tracking-wider text-white active:scale-95 cursor-pointer touch-none"
            >
              Drift / Rem
            </button>
            <button
              type="button"
              onPointerDown={() => {
                virtualInputRef.moveY = 1;
              }}
              onPointerUp={() => {
                virtualInputRef.moveY = 0;
              }}
              onPointerLeave={() => {
                virtualInputRef.moveY = 0;
              }}
              className="min-w-[68px] min-h-[52px] px-3 rounded-xl bg-[#22c55e] border border-white/30 text-sm font-display font-extrabold uppercase tracking-wider text-[#090c12] active:scale-95 cursor-pointer touch-none"
            >
              Gas
            </button>
          </div>
        ) : (
          /* ON-FOOT COMBAT & INTERACTION CLUSTER */
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleTpsAim}
              className={`min-w-[54px] min-h-[44px] px-3 rounded-xl border text-xs font-mono-num font-bold active:scale-95 cursor-pointer ${
                tpsAiming
                  ? 'bg-[#38bdf8] text-[#090c12] border-[#38bdf8]'
                  : 'bg-[#090c12]/85 text-[#e2e8f0] border-white/15'
              }`}
            >
              Bidik
            </button>
            <button
              type="button"
              onClick={() => {
                virtualInputRef.rollTap = true;
              }}
              className="min-w-[54px] min-h-[44px] px-3 rounded-xl bg-[#090c12]/85 border border-white/15 text-xs font-mono-num font-bold text-[#cbd5e1] active:scale-95 cursor-pointer"
            >
              Elak
            </button>
            {nearbyVehicle ? (
              <button
                type="button"
                onClick={onToggleVehicle}
                className="min-w-[58px] min-h-[52px] px-3 rounded-xl bg-[#38bdf8] text-[#090c12] text-xs font-display font-extrabold uppercase tracking-wider active:scale-95 cursor-pointer"
              >
                Setir
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleFokus}
                className={`min-w-[58px] min-h-[52px] px-3 rounded-xl border text-xs font-display font-extrabold uppercase tracking-wider active:scale-95 cursor-pointer ${
                  fokusActive
                    ? 'bg-[#facc15] text-[#090c12] border-[#facc15]'
                    : 'bg-[#090c12]/85 text-[#facc15] border-[#facc15]/40'
                }`}
              >
                Fokus
              </button>
            )}
            <button
              type="button"
              onPointerDown={() => {
                virtualInputRef.fireHeld = true;
                virtualInputRef.fireTap = true;
              }}
              onPointerUp={() => {
                virtualInputRef.fireHeld = false;
              }}
              onPointerLeave={() => {
                virtualInputRef.fireHeld = false;
              }}
              data-testid="mobile-fire-button"
              className="min-w-[68px] min-h-[52px] px-3 rounded-xl bg-[#f59e0b] border-2 border-[#fef08a] text-sm font-display font-extrabold uppercase tracking-wider text-[#090c12] shadow-lg active:scale-95 cursor-pointer touch-none"
            >
              Serang
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

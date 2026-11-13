import React, { useState } from 'react';
import {
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  ProtagonistId,
  WEAPONS,
  WeaponId,
} from '../game/rules';
import { WeaponSilhouetteSvg } from './GameHud';

interface RadialWheelOverlayProps {
  mode: 'weapon' | 'character';
  playerState: PlayerProgressState;
  onSelectWeapon: (weaponId: WeaponId) => void;
  onSwitchProtagonist: (targetId: ProtagonistId) => void;
  onClose: () => void;
}

const WEAPON_WHEEL_ORDER: WeaponId[] = [
  'fist',
  'golok',
  'pistol',
  'rifle',
  'mercon',
  'pasopati',
  'gatotkaca',
];

const PROTAGONIST_STATS: Record<
  ProtagonistId,
  {
    stamina: number;
    driving: number;
    shooting: number;
    hacking: number;
    stealth: number;
  }
> = {
  nabilo: {
    stamina: 92,
    driving: 78,
    shooting: 96,
    hacking: 64,
    stealth: 80,
  },
  raka: {
    stamina: 86,
    driving: 99,
    shooting: 82,
    hacking: 68,
    stealth: 75,
  },
  kirana: {
    stamina: 78,
    driving: 80,
    shooting: 85,
    hacking: 99,
    stealth: 95,
  },
};

function describeAnnularSector(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startAngleRad: number,
  endAngleRad: number
): string {
  const x1Out = cx + outerR * Math.cos(startAngleRad);
  const y1Out = cy + outerR * Math.sin(startAngleRad);
  const x2Out = cx + outerR * Math.cos(endAngleRad);
  const y2Out = cy + outerR * Math.sin(endAngleRad);

  const x1In = cx + innerR * Math.cos(endAngleRad);
  const y1In = cy + innerR * Math.sin(endAngleRad);
  const x2In = cx + innerR * Math.cos(startAngleRad);
  const y2In = cy + innerR * Math.sin(startAngleRad);

  const largeArc = endAngleRad - startAngleRad > Math.PI ? 1 : 0;

  return [
    `M ${x1Out} ${y1Out}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Out} ${y2Out}`,
    `L ${x1In} ${y1In}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2In} ${y2In}`,
    'Z',
  ].join(' ');
}

export const RadialWheelOverlay: React.FC<RadialWheelOverlayProps> = ({
  mode,
  playerState,
  onSelectWeapon,
  onSwitchProtagonist,
  onClose,
}) => {
  const [hoveredWeapon, setHoveredWeapon] = useState<WeaponId>(
    playerState.activeWeapon
  );
  const [hoveredChar, setHoveredChar] = useState<ProtagonistId>(
    playerState.activeProtagonist
  );

  const focusedWeaponSpec = WEAPONS[hoveredWeapon];
  const focusedCharSpec = PROTAGONIST_PROFILES[hoveredChar];
  const focusedCharLive = playerState.protagonistRoster[hoveredChar];
  const focusedCharStats = PROTAGONIST_STATS[hoveredChar];

  // Derived weapon telemetry (0-100)
  const damagePct = Math.min(100, Math.round((focusedWeaponSpec.damage / 165) * 100));
  const fireRatePct = Math.min(
    100,
    Math.round(((1.0 - Math.min(0.9, focusedWeaponSpec.cooldown)) / 0.9) * 100)
  );
  const rangePct = Math.min(100, Math.round((focusedWeaponSpec.range / 55) * 100));
  const accuracyPct = focusedWeaponSpec.isMelee
    ? 95
    : focusedWeaponSpec.splashRadius > 0
    ? 78
    : 90;

  if (mode === 'character') {
    const protagonists: ProtagonistId[] = ['nabilo', 'raka', 'kirana'];
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pemilih Trio Protagonis"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        className="fixed inset-0 z-30 flex items-end justify-end p-6 md:p-8 pointer-events-auto"
        style={{
          background:
            'radial-gradient(circle at bottom right, rgba(7,10,16,0.72) 0%, rgba(7,10,16,0.28) 55%, rgba(7,10,16,0.12) 100%)',
        }}
      >
        {/* GTA V Bottom-Right Character Wheel + Adjacent Skill Card */}
        <div className="flex flex-col sm:flex-row items-end gap-4 animate-aaa-up">
          {/* Floating Attribute Dossier Card for Hovered Protagonist */}
          <div className="w-64 aaa-glass rounded-xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <div
                  className="text-[11px] font-semibold"
                  style={{ color: focusedCharSpec.colorHex }}
                >
                  {focusedCharSpec.codename}
                </div>
                <h3 className="font-display text-2xl font-extrabold uppercase text-[#f4f1ea] leading-none mt-0.5">
                  {focusedCharSpec.name}
                </h3>
                <p className="text-[11px] text-[#94a3b8] mt-1">
                  {focusedCharSpec.homeDistrictName} · HP {Math.round(focusedCharLive.hp)}%
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-[11px]">
              {[
                { label: 'Kemampuan Khusus', val: 95 },
                { label: 'Menembak', val: focusedCharStats.shooting },
                { label: 'Mengemudi', val: focusedCharStats.driving },
                { label: 'Peretasan Siber', val: focusedCharStats.hacking },
                { label: 'Siluman', val: focusedCharStats.stealth },
              ].map((row) => (
                <div key={row.label} className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-[#cbd5e1]">{row.label}</span>
                    <span className="font-mono-num text-[#f4f1ea]">
                      {row.val}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-150"
                      style={{
                        width: `${row.val}%`,
                        backgroundColor: focusedCharSpec.colorHex,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-[#94a3b8] border-t border-white/10 pt-2 leading-snug">
              {focusedCharLive.statusText}
            </div>
          </div>

          {/* 3-Protagonist Selector Wheel Column */}
          <div className="flex flex-col gap-2 w-60">
            {protagonists.map((pId) => {
              const prof = PROTAGONIST_PROFILES[pId];
              const live = playerState.protagonistRoster[pId];
              const isCurrent = playerState.activeProtagonist === pId;
              const isHovered = hoveredChar === pId;

              return (
                <button
                  key={pId}
                  type="button"
                  onMouseEnter={() => setHoveredChar(pId)}
                  onClick={() => {
                    onSwitchProtagonist(pId);
                    onClose();
                  }}
                  className={`px-4 py-3 rounded-xl aaa-glass text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                    isCurrent || isHovered ? 'scale-[1.02]' : 'opacity-85 hover:opacity-100'
                  }`}
                  style={{
                    borderColor: isCurrent
                      ? prof.colorHex
                      : isHovered
                      ? 'rgba(255,255,255,0.28)'
                      : 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-display text-lg font-extrabold text-[#090c12]"
                      style={{ backgroundColor: prof.colorHex }}
                    >
                      {prof.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="font-display text-lg font-extrabold uppercase text-[#f4f1ea] leading-none truncate">
                        {prof.name}
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-1 truncate">
                        {isCurrent ? 'Aktif sekarang' : prof.specialAbilityName}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#22c55e] shrink-0">
                    {Math.round(live.hp)}%
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={onClose}
              className="mt-1 px-3 py-1.5 rounded-lg text-xs text-[#94a3b8] hover:text-white text-right cursor-pointer"
            >
              Tutup [Esc]
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ==================== WEAPON RADIAL WHEEL ==================== */
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Roda Senjata Radial"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-30 flex items-center justify-center p-4 pointer-events-auto"
      style={{
        background:
          'radial-gradient(circle, rgba(7,10,16,0.56) 0%, rgba(5,7,12,0.84) 100%)',
      }}
    >
      {/* Top-Right Floating GTA V Weapon Spec Card */}
      <div className="hidden md:flex fixed top-6 right-6 w-64 aaa-glass rounded-xl p-4 flex-col gap-2.5 shadow-2xl animate-aaa-up">
        <div className="flex items-baseline justify-between gap-2 border-b border-white/10 pb-2">
          <span className="font-display text-xl font-extrabold uppercase text-[#f4f1ea] truncate">
            {focusedWeaponSpec.name}
          </span>
          <span className="font-mono-num text-xs text-[#38bdf8] shrink-0">
            {focusedWeaponSpec.isMelee
              ? 'Melee'
              : `${playerState.ammo[hoveredWeapon] || 0}/${focusedWeaponSpec.maxAmmo}`}
          </span>
        </div>

        {[
          { label: 'Daya Hancur', val: damagePct, color: '#ef4444' },
          { label: 'Laju Tembak', val: fireRatePct, color: '#f59e0b' },
          { label: 'Akurasi', val: accuracyPct, color: '#22c55e' },
          { label: 'Jangkauan', val: rangePct, color: '#38bdf8' },
        ].map((st) => (
          <div key={st.label} className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#cbd5e1]">{st.label}</span>
              <span className="font-mono-num text-[#f4f1ea]">{st.val}</span>
            </div>
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-150"
                style={{ width: `${st.val}%`, backgroundColor: st.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Center Annular Weapon Wheel */}
      <div className="relative w-[370px] h-[370px] sm:w-[440px] sm:h-[440px] flex items-center justify-center animate-stamp-in">
        <svg
          viewBox="0 0 480 480"
          className="absolute inset-0 w-full h-full overflow-visible"
        >
          {WEAPON_WHEEL_ORDER.map((wId, idx) => {
            const total = WEAPON_WHEEL_ORDER.length;
            const step = (Math.PI * 2) / total;
            const gap = 0.028;
            const startAngle = idx * step - Math.PI / 2 - step / 2 + gap;
            const endAngle = (idx + 1) * step - Math.PI / 2 - step / 2 - gap;
            const unlocked = playerState.unlockedWeapons.includes(wId);
            const isSelected = playerState.activeWeapon === wId;
            const isHovered = hoveredWeapon === wId;

            const pathData = describeAnnularSector(
              240,
              240,
              104,
              224,
              startAngle,
              endAngle
            );

            const fillHex = isHovered && unlocked
              ? 'rgba(245, 158, 11, 0.28)'
              : isSelected
              ? 'rgba(56, 189, 248, 0.22)'
              : unlocked
              ? 'rgba(12, 16, 25, 0.82)'
              : 'rgba(8, 10, 16, 0.55)';

            const strokeHex = isHovered && unlocked
              ? '#f59e0b'
              : isSelected
              ? '#38bdf8'
              : 'rgba(255,255,255,0.12)';

            return (
              <path
                key={wId}
                d={pathData}
                fill={fillHex}
                stroke={strokeHex}
                strokeWidth={isHovered || isSelected ? 2.5 : 1}
                className={
                  unlocked
                    ? 'cursor-pointer transition-colors duration-150'
                    : 'cursor-not-allowed'
                }
                onMouseEnter={() => setHoveredWeapon(wId)}
                onClick={() => {
                  if (!unlocked) return;
                  onSelectWeapon(wId);
                  onClose();
                }}
              />
            );
          })}

          <circle
            cx="240"
            cy="240"
            r="96"
            fill="rgba(9, 12, 18, 0.9)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
          />
        </svg>

        {/* Sector Icons & Labels */}
        {WEAPON_WHEEL_ORDER.map((wId, idx) => {
          const spec = WEAPONS[wId];
          const unlocked = playerState.unlockedWeapons.includes(wId);
          const isHovered = hoveredWeapon === wId;
          const angle =
            (idx / WEAPON_WHEEL_ORDER.length) * Math.PI * 2 - Math.PI / 2;
          const leftPct = 50 + Math.cos(angle) * 34.5;
          const topPct = 50 + Math.sin(angle) * 34.5;

          return (
            <div
              key={wId}
              style={{ left: `${leftPct}%`, top: `${topPct}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center text-center w-24 ${
                unlocked ? 'opacity-100' : 'opacity-30'
              }`}
            >
              <div className={isHovered ? 'text-[#f59e0b]' : 'text-[#f4f1ea]'}>
                <WeaponSilhouetteSvg weaponId={wId} className="w-11 h-5 mx-auto" />
              </div>
              <div className="font-display text-xs font-bold uppercase tracking-wide text-[#f4f1ea] mt-0.5 truncate max-w-full">
                {spec.name.split(' ')[0]}
              </div>
              <div className="text-[10px] font-mono-num text-[#94a3b8]">
                {!unlocked
                  ? 'Terkunci'
                  : spec.isMelee
                  ? 'Melee'
                  : `${playerState.ammo[wId] || 0}/${spec.maxAmmo}`}
              </div>
            </div>
          );
        })}

        {/* Clean Uncrowded Center Hub */}
        <div className="relative z-10 w-36 text-center flex flex-col items-center gap-1 px-2 pointer-events-none">
          <span className="font-mono-num text-[10px] text-[#f59e0b]">
            Slot [{focusedWeaponSpec.key}]
          </span>
          <h3 className="font-display text-xl font-extrabold uppercase text-[#f4f1ea] leading-tight">
            {focusedWeaponSpec.name}
          </h3>
          <p className="text-[11px] text-[#94a3b8] leading-snug line-clamp-2">
            {focusedWeaponSpec.roleClue}
          </p>
          <span className="mt-1 font-mono-num text-xs font-bold text-[#38bdf8]">
            {focusedWeaponSpec.isMelee
              ? 'Amunisi Tak Terbatas'
              : `${playerState.ammo[hoveredWeapon] || 0} / ${focusedWeaponSpec.maxAmmo}`}
          </span>
        </div>
      </div>

      {/* Subtle Bottom Helper Caption */}
      <div className="fixed bottom-6 inset-x-0 flex justify-center pointer-events-none">
        <div className="aaa-glass-subtle px-4 py-1.5 rounded-full text-xs text-[#cbd5e1] pointer-events-auto flex items-center gap-3">
          <span>Klik sektor senjata untuk memilih</span>
          <span className="text-white/20">·</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#f59e0b] hover:underline cursor-pointer"
          >
            Tutup [Esc]
          </button>
        </div>
      </div>
    </div>
  );
};

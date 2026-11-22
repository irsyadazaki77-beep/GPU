import React from 'react';
import {
  CustomRaceTrackSpec,
  JAKARTA_DISTRICTS,
  NUSANTARA_PACKAGES,
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  STREET_RACES,
  STUNT_RAMPS_CATALOG,
  computeEmpireEndgameSummary,
  formatRupiah,
} from '../../game/rules';
import { gameStore, useGameStore } from '../../state/gameStore';
import { CustomRaceUgcSection } from './CustomRaceUgcSection';
import { GlobalLeaderboardCard } from './GlobalLeaderboardCard';

interface PhoneImperiumScreenProps {
  playerState: PlayerProgressState;
  onClosePhone: () => void;
  onStartStreetRace: (raceId: string) => void;
  onStartCustomRace?: (track: CustomRaceTrackSpec) => void;
  onShareCustomRace?: (track: CustomRaceTrackSpec) => boolean;
  onStartTurfWar?: (districtId: string) => void;
  onWarpToRamp?: (rampId: string) => void;
}

export const PhoneImperiumScreen: React.FC<PhoneImperiumScreenProps> = ({
  playerState,
  onClosePhone,
  onStartStreetRace,
  onStartCustomRace,
  onShareCustomRace,
  onStartTurfWar,
  onWarpToRamp,
}) => {
  const stuntCompletedIds = useGameStore((s) => s.stuntCompletedIds);
  const dailyChallenges = useGameStore((s) => s.dailyChallenges);
  const activeTurfWar = useGameStore((s) => s.activeTurfWar);
  const empireSummary = computeEmpireEndgameSummary(
    playerState,
    stuntCompletedIds.length
  );

  return (
    <div data-testid="phone-imperium-screen" className="flex flex-col gap-3.5">
      {/* 1. Empire Endgame Tier Summary */}
      <div className="p-3 rounded-xl bg-gradient-to-br from-[#2a1f0b] to-[#111827] border border-[#f59e0b]/45 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-mono-num">
          <span className="font-bold uppercase tracking-wider text-[#f59e0b]">
            Tier {empireSummary.tier}/4 · Imperium Jakarta
          </span>
          <span className="text-[#22c55e] font-bold">
            +{formatRupiah(empireSummary.passiveIncomePerMinRp)}/mnt
          </span>
        </div>
        <div className="font-display text-base font-extrabold uppercase text-[#f4f1ea]">
          {empireSummary.tierTitle}
        </div>
        <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono-num">
          <div className="bg-black/30 rounded px-2 py-1">
            <div className="text-[#94a3b8]">Distrik</div>
            <div className="font-bold text-[#f4f1ea]">
              {empireSummary.ownedDistricts}/{empireSummary.totalDistricts}
            </div>
          </div>
          <div className="bg-black/30 rounded px-2 py-1">
            <div className="text-[#94a3b8]">Stunt</div>
            <div className="font-bold text-[#38bdf8]">
              {empireSummary.completedStuntsCount}/{STUNT_RAMPS_CATALOG.length}
            </div>
          </div>
          <div className="bg-black/30 rounded px-2 py-1">
            <div className="text-[#94a3b8]">Koper</div>
            <div className="font-bold text-[#facc15]">
              {(playerState.collectedPackages || []).length}/{NUSANTARA_PACKAGES.length}
            </div>
          </div>
          <div className="bg-black/30 rounded px-2 py-1">
            <div className="text-[#94a3b8]">Skor</div>
            <div className="font-bold text-[#f59e0b]">
              {empireSummary.empireScore.toLocaleString('id-ID')}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-[#cbd5e1] pt-1">
          Target: {empireSummary.nextTierGoal}
        </div>
      </div>

      {/* 1B. Leaderboard Global Jakarta (ETLE / Balap Liar / Grand Heist) */}
      <GlobalLeaderboardCard />

      {/* 2. Tantangan Harian Jakarta */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono-num">
          <span className="font-bold uppercase text-[#38bdf8]">
            Tantangan Harian Jakarta
          </span>
          <span className="text-[#f59e0b] font-bold">
            Streak Hari #{dailyChallenges.streakDays}
          </span>
        </div>
        <div className="flex flex-col gap-2">
          {dailyChallenges.items.map((item) => {
            const ready = !item.claimed && item.progress >= item.target;
            const pct = Math.min(
              100,
              Math.round((item.progress / Math.max(1, item.target)) * 100)
            );
            return (
              <div
                key={item.id}
                className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col gap-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#f4f1ea] truncate">
                      {item.title}
                    </div>
                    <div className="text-[10px] text-[#94a3b8] leading-snug">
                      {item.subtitle}
                    </div>
                  </div>
                  <span className="font-mono-num text-[10px] font-bold text-[#22c55e] shrink-0">
                    +{formatRupiah(item.rewardRp)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.claimed
                          ? 'bg-[#22c55e]'
                          : ready
                          ? 'bg-[#f59e0b]'
                          : 'bg-[#38bdf8]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono-num text-[10px] text-[#cbd5e1] shrink-0">
                    {item.progress}/{item.target}
                  </span>
                  {ready && (
                    <button
                      type="button"
                      onClick={() => gameStore.claimDailyChallenge(item.id)}
                      className="px-2 py-0.5 rounded bg-[#22c55e] hover:bg-[#4ade80] text-[#090c12] font-mono-num text-[10px] font-extrabold cursor-pointer shrink-0"
                    >
                      Klaim
                    </button>
                  )}
                  {item.claimed && (
                    <span className="text-[10px] font-mono-num font-bold text-[#22c55e]">
                      Selesai
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Serangan Wilayah 3D (Turf War Assaults) */}
      <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase font-mono-num text-[#ef4444]">
          Serangan Wilayah 3D (Turf War)
        </div>
        <div className="divide-y divide-white/10">
          {JAKARTA_DISTRICTS.slice(0, 6).map((dist) => {
            const turf = playerState.districtTurf?.[dist.id];
            const owned = turf?.owner === 'player';
            const isFighting =
              activeTurfWar?.districtId === dist.id &&
              activeTurfWar.status === 'active';
            return (
              <div
                key={dist.id}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                    {dist.name}
                  </div>
                  <div className="text-[10px] font-mono-num text-[#94a3b8]">
                    {owned
                      ? `Dikuasai · +${formatRupiah(turf?.dividendRp || 45000)}/mnt`
                      : 'Dikuasai Sindikat · 3 Gelombang + Kapten'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={owned || isFighting}
                  onClick={() => {
                    onStartTurfWar?.(dist.id);
                    onClosePhone();
                  }}
                  className="px-2.5 py-1 rounded-md bg-[#ef4444] disabled:bg-white/10 text-white disabled:text-[#22c55e] font-mono-num text-[10px] font-bold cursor-pointer shrink-0"
                >
                  {owned ? 'Milikmu' : isFighting ? 'Aktif' : 'Serbu 3D'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Balap Liar Malam & 6 Stunt Ramp Jakarta */}
      <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase font-mono-num text-[#22d3ee]">
          Balap Liar Malam Jakarta
        </div>
        <div className="flex flex-col gap-1.5">
          {STREET_RACES.map((race) => (
            <div
              key={race.id}
              className="p-2 rounded-lg bg-white/[0.04] flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                  {race.name}
                </div>
                <div className="text-[10px] font-mono-num text-[#22c55e]">
                  3 Pembalap · Hadiah {formatRupiah(race.rewardRp)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onStartStreetRace(race.id);
                  onClosePhone();
                }}
                className="px-2.5 py-1 rounded bg-[#22d3ee] text-[#090c12] font-mono-num text-[10px] font-extrabold cursor-pointer shrink-0"
              >
                Mulai
              </button>
            </div>
          ))}
        </div>
        {onStartCustomRace && (
          <CustomRaceUgcSection
            protagonistName={PROTAGONIST_PROFILES[playerState.activeProtagonist].name}
            onStartCustomRace={onStartCustomRace}
            onShareCustomRace={onShareCustomRace}
            onClosePhone={onClosePhone}
          />
        )}
      </div>

      <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] font-mono-num">
          <span className="font-bold uppercase text-[#f59e0b]">
            6 Stunt Ramp Jakarta
          </span>
          <span className="text-[#cbd5e1]">
            {stuntCompletedIds.length}/{STUNT_RAMPS_CATALOG.length}
          </span>
        </div>
        <div className="divide-y divide-white/10">
          {STUNT_RAMPS_CATALOG.map((ramp) => {
            const done = stuntCompletedIds.includes(ramp.id);
            return (
              <div
                key={ramp.id}
                className="py-2 flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                    {ramp.name}
                  </div>
                  <div className="text-[10px] font-mono-num text-[#94a3b8]">
                    Target {ramp.targetDistanceM}m · {formatRupiah(ramp.rewardRp)}
                    {done ? ' · ✓' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onWarpToRamp?.(ramp.id);
                    onClosePhone();
                  }}
                  className="px-2.5 py-1 rounded bg-[#f59e0b]/25 hover:bg-[#f59e0b] text-[#fbbf24] hover:text-[#090c12] font-mono-num text-[10px] font-bold cursor-pointer shrink-0 transition-colors"
                >
                  Warp Ramp
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

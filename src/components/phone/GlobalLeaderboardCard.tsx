import React, { useEffect, useState } from 'react';
import { LeaderboardCategory } from '../../game/types';
import { gameStore, useGameStore } from '../../state/gameStore';

const CATEGORY_TABS: { id: LeaderboardCategory; label: string }[] = [
  { id: 'etle_speed', label: 'ETLE' },
  { id: 'street_race', label: 'Balap' },
  { id: 'heist_score', label: 'Heist' },
];

export const GlobalLeaderboardCard: React.FC = () => {
  const [category, setCategory] = useState<LeaderboardCategory>('etle_speed');
  const entries = useGameStore((s) => s.globalLeaderboard);
  const loading = useGameStore((s) => s.socialHubLoading);

  useEffect(() => {
    void gameStore.refreshGlobalLeaderboard(category);
  }, [category]);

  return (
    <div
      data-testid="global-leaderboard-card"
      className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase font-mono-num text-[#22d3ee]">
          Leaderboard Global Jakarta
        </span>
        <button
          type="button"
          onClick={() => void gameStore.refreshGlobalLeaderboard(category)}
          className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] font-mono-num text-[#cbd5e1] cursor-pointer"
        >
          {loading ? '...' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCategory(tab.id)}
            className={`py-1 rounded text-[10px] font-mono-num font-bold cursor-pointer ${
              category === tab.id
                ? 'bg-[#22d3ee] text-[#090c12]'
                : 'bg-white/8 text-[#94a3b8] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="text-[11px] text-[#94a3b8] py-1">
          Belum ada rekor di kategori ini. Pecahkan rekor di jalanan Jakarta!
        </div>
      ) : (
        <div className="divide-y divide-white/10">
          {entries.slice(0, 5).map((entry, idx) => (
            <div
              key={entry.id}
              className="py-1.5 flex items-center justify-between gap-2 text-[11px]"
            >
              <div className="min-w-0">
                <div className="font-semibold text-[#f4f1ea] truncate">
                  #{idx + 1} {entry.playerName}
                </div>
                <div className="text-[10px] text-[#94a3b8] truncate">
                  {entry.targetName}
                </div>
              </div>
              <span className="font-mono-num font-bold text-[#22c55e] shrink-0">
                {entry.metricLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

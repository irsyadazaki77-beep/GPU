import React from 'react';
import {
  JAKARTA_STOCKS,
  PlayerProgressState,
  StockSymbol,
  calculatePortfolioMetrics,
  formatRupiah,
} from '../../game/rules';

interface PhoneSahamAppProps {
  playerState: PlayerProgressState;
  portfolioValueRp: number;
  onBuyStock: (symbol: StockSymbol, shares: number) => void;
  onSellStock: (symbol: StockSymbol, shares: number) => void;
}

export const PhoneSahamApp: React.FC<PhoneSahamAppProps> = ({
  playerState,
  portfolioValueRp,
  onBuyStock,
  onSellStock,
}) => {
  const portfolioMetrics = calculatePortfolioMetrics(playerState.stockPortfolio);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div>
          <div className="text-[10px] text-[#94a3b8]">Nilai Portofolio</div>
          <div className="font-mono-num text-base font-bold text-[#22c55e]">
            {formatRupiah(portfolioValueRp)}
          </div>
          <div
            className={`text-[10px] font-mono-num ${
              portfolioMetrics.unrealizedPnLRp >= 0
                ? 'text-[#22c55e]'
                : 'text-[#ef4444]'
            }`}
          >
            PnL: {portfolioMetrics.unrealizedPnLRp >= 0 ? '+' : ''}
            {formatRupiah(portfolioMetrics.unrealizedPnLRp)} (
            {portfolioMetrics.unrealizedPnLPct}%)
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#94a3b8]">Kas Tersedia</div>
          <div className="font-mono-num text-xs font-semibold text-[#f4f1ea]">
            {formatRupiah(playerState.rupiah)}
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/10">
        {JAKARTA_STOCKS.map((st) => {
          const entry = playerState.stockPortfolio[st.symbol];
          const diff = entry.currentPrice - entry.previousPrice;
          const pct =
            entry.previousPrice > 0
              ? ((diff / entry.previousPrice) * 100).toFixed(1)
              : '0.0';
          const isUp = diff >= 0;
          const minP = Math.min(...entry.history);
          const maxP = Math.max(...entry.history, minP + 1);
          const points = entry.history
            .map((val, i) => {
              const x = (i / (entry.history.length - 1)) * 100;
              const y = 22 - ((val - minP) / (maxP - minP)) * 18;
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <div key={st.symbol} className="py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono-num text-xs font-bold text-[#38bdf8]">
                    {st.symbol}
                  </span>
                  <span className="ml-2 text-xs font-semibold text-[#f4f1ea] truncate">
                    {st.name}
                  </span>
                </div>
                <div className="text-right font-mono-num shrink-0">
                  <div className="text-xs font-bold text-[#f4f1ea]">
                    {formatRupiah(entry.currentPrice)}
                  </div>
                  <div
                    className={`text-[10px] ${
                      isUp ? 'text-[#22c55e]' : 'text-[#ef4444]'
                    }`}
                  >
                    {isUp ? '+' : ''}
                    {pct}%
                  </div>
                </div>
              </div>

              <svg viewBox="0 0 100 24" className="w-full h-6">
                <polyline
                  fill="none"
                  stroke={isUp ? '#22c55e' : '#ef4444'}
                  strokeWidth="1.8"
                  points={points}
                />
              </svg>

              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-mono-num text-[#94a3b8]">
                  {entry.ownedShares} Lot
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onBuyStock(st.symbol, 10)}
                    className="px-2.5 py-1 rounded bg-[#22c55e] text-[#090c12] font-mono-num text-[10px] font-bold cursor-pointer"
                  >
                    Beli 10
                  </button>
                  <button
                    type="button"
                    disabled={entry.ownedShares < 10}
                    onClick={() => onSellStock(st.symbol, 10)}
                    className="px-2.5 py-1 rounded bg-[#ef4444] disabled:bg-white/10 text-white disabled:text-[#64748b] font-mono-num text-[10px] font-bold cursor-pointer"
                  >
                    Jual 10
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

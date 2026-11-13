import React, { useState } from 'react';
import {
  DRONE_UPGRADE_COST,
  ENTERABLE_INTERIORS,
  InteriorZoneId,
  JAKARTA_DISTRICTS,
  JAKARTA_PROPERTIES,
  JAKARTA_STOCKS,
  NABILO_OUTFITS,
  OutfitId,
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  ProtagonistId,
  RADIO_STATIONS,
  RadioStationId,
  STORY_MISSIONS,
  STREET_RACES,
  StockSymbol,
  StoryMission,
  VEHICLE_SPECS,
  VehicleType,
  WEATHER_MODES,
  WEAPONS,
  WeaponId,
  WeatherMode,
  calculatePassivePropertyIncome,
  formatRupiah,
  getDominantFactionTitle,
} from '../game/rules';

interface NabiloPhoneModalProps {
  playerState: PlayerProgressState;
  activeMission: StoryMission | null;
  lastOutcomeText: string | null;
  weatherMode: WeatherMode;
  onClose: () => void;
  onTriggerMissionDialog: (mission: StoryMission) => void;
  onSpawnVehicle: (type: VehicleType) => void;
  onBuyOrEquipWeapon: (weaponId: WeaponId) => void;
  onBuyArmorOrMedkit: (item: 'medkit' | 'armor' | 'bribe') => void;
  onBuyProperty: (propertyId: string) => void;
  onCompleteSideHustle: (rewardRp: number, label: string) => void;
  onChangeWeather: (mode: WeatherMode) => void;
  onRecruitCrew: () => void;
  onChangeRadio: (station: RadioStationId) => void;
  onChangeOutfit: (outfitId: OutfitId) => void;
  onUpgradeVehicle: () => void;
  onUpgradeDrone: () => void;
  onFastTravel: (districtId: string) => void;
  onBuyStock: (symbol: StockSymbol, shares: number) => void;
  onSellStock: (symbol: StockSymbol, shares: number) => void;
  onOpenHeistBoard: () => void;
  onOpenCustomsGarage: () => void;
  onSwitchProtagonist: (targetId: ProtagonistId) => void;
  onEnterInterior: (interiorId: InteriorZoneId) => void;
  onStartStreetRace: (raceId: string) => void;
}

type AppScreenId =
  | 'home'
  | 'misi'
  | 'saham'
  | 'heist'
  | 'pegasus'
  | 'senjata'
  | 'properti'
  | 'satelit'
  | 'gaya'
  | 'mrt';

const IFRUIT_APPS: {
  id: Exclude<AppScreenId, 'home'>;
  name: string;
  color: string;
}[] = [
  { id: 'misi', name: 'Kontrak', color: '#f59e0b' },
  { id: 'saham', name: 'BAJSA', color: '#22c55e' },
  { id: 'heist', name: 'Heist', color: '#ef4444' },
  { id: 'pegasus', name: 'Pegasus', color: '#38bdf8' },
  { id: 'senjata', name: 'Glodok', color: '#f97316' },
  { id: 'properti', name: 'Properti', color: '#a855f7' },
  { id: 'satelit', name: 'Trio', color: '#06b6d4' },
  { id: 'gaya', name: 'Radio', color: '#ec4899' },
  { id: 'mrt', name: 'Transit', color: '#eab308' },
];

const AppGlyph: React.FC<{ id: Exclude<AppScreenId, 'home'> }> = ({ id }) => {
  const cls = 'w-5 h-5 text-[#090c12]';
  switch (id) {
    case 'misi':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="M9 12h6M9 16h4" />
        </svg>
      );
    case 'saham':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 17l6-6 4 4 8-8" />
          <path d="M17 7h4v4" />
        </svg>
      );
    case 'heist':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="3" />
          <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
        </svg>
      );
    case 'pegasus':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 13l2-5h12l4 5v4h-2a2 2 0 01-4 0H9a2 2 0 01-4 0H3v-4z" />
        </svg>
      );
    case 'senjata':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M4 9h16v4H11l-2 6H6l1-6H4V9z" />
        </svg>
      );
    case 'properti':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 21h18M5 21V7l7-4 7 4v14" />
          <path d="M9 13h2v8H9zM13 9h2v4h-2z" />
        </svg>
      );
    case 'satelit':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="8" r="3" />
          <path d="M6 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        </svg>
      );
    case 'gaya':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="2" />
          <path d="M8.5 15.5a5 5 0 010-7M15.5 8.5a5 5 0 010 7M5.5 18.5a9 9 0 010-13M18.5 5.5a9 9 0 010 13" />
        </svg>
      );
    case 'mrt':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M12 21s-6-5.3-6-10a6 6 0 1112 0c0 4.7-6 10-6 10z" />
          <circle cx="12" cy="11" r="2" />
        </svg>
      );
  }
};

export const NabiloPhoneModal: React.FC<NabiloPhoneModalProps> = ({
  playerState,
  activeMission,
  lastOutcomeText,
  weatherMode,
  onClose,
  onTriggerMissionDialog,
  onSpawnVehicle,
  onBuyOrEquipWeapon,
  onBuyArmorOrMedkit,
  onBuyProperty,
  onCompleteSideHustle,
  onChangeWeather,
  onRecruitCrew,
  onChangeRadio,
  onChangeOutfit,
  onUpgradeDrone,
  onFastTravel,
  onBuyStock,
  onSellStock,
  onOpenHeistBoard,
  onOpenCustomsGarage,
  onSwitchProtagonist,
  onEnterInterior,
  onStartStreetRace,
}) => {
  const [screen, setScreen] = useState<AppScreenId>('home');

  const dominantFaction = getDominantFactionTitle(playerState.reputation);
  const passiveIncome = calculatePassivePropertyIncome(
    playerState.ownedProperties
  );

  let portfolioValueRp = 0;
  for (const st of JAKARTA_STOCKS) {
    const entry = playerState.stockPortfolio[st.symbol];
    if (entry) {
      portfolioValueRp += entry.ownedShares * entry.currentPrice;
    }
  }

  return (
    /* Non-blocking right-corner anchor so the live 3D city stays bright & unobstructed */
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Smartphone iFruit Jakarta"
      className="fixed inset-0 z-30 flex items-end justify-end p-4 md:p-6 pointer-events-none"
    >
      <div className="w-full max-w-[348px] h-[640px] max-h-[84vh] bg-[#0a0d14] border-[3px] border-[#2d3748] rounded-[36px] shadow-[0_24px_60px_rgba(0,0,0,0.9)] flex flex-col justify-between overflow-hidden text-[#f4f1ea] pointer-events-auto animate-phone-in">
        {/* Top Phone Bezel & Clean Status Bar */}
        <div className="bg-[#0e131d] border-b border-white/10 px-5 pt-3 pb-2.5 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-mono-num text-[#94a3b8]">
            <span>19:42 WIB</span>
            <div className="w-16 h-3 bg-[#05070b] rounded-full border border-white/10" />
            <span className="text-[#22c55e] font-semibold">
              {formatRupiah(playerState.rupiah)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            {screen !== 'home' ? (
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="text-xs font-medium text-[#38bdf8] hover:text-white cursor-pointer flex items-center gap-1"
              >
                <span aria-hidden="true">‹</span> Beranda
              </button>
            ) : (
              <span className="text-xs font-semibold text-[#94a3b8]">
                iFruit OS · Jakarta
              </span>
            )}

            <span className="font-display text-base font-bold uppercase tracking-wide text-[#f4f1ea]">
              {screen === 'home'
                ? 'Menu Utama'
                : IFRUIT_APPS.find((a) => a.id === screen)?.name}
            </span>

            <button
              type="button"
              onClick={onClose}
              className="text-xs font-mono-num text-[#94a3b8] hover:text-white cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

        {/* Phone Screen Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {screen === 'home' && (
            <>
              {/* Active Protagonist Summary Strip */}
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="min-w-0">
                  <div className="font-display text-xl font-extrabold uppercase text-[#f4f1ea] leading-none truncate">
                    {PROTAGONIST_PROFILES[playerState.activeProtagonist].name}
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-1 truncate">
                    {dominantFaction.title} · +{formatRupiah(passiveIncome)}/4d
                  </div>
                </div>
                <span className="font-mono-num text-xs font-semibold text-[#22c55e] shrink-0">
                  {playerState.completedMissions.length}/15 Misi
                </span>
              </div>

              {/* 3x3 Crisp Icon App Launcher */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-4 py-1">
                {IFRUIT_APPS.map((app) => (
                  <button
                    key={app.id}
                    type="button"
                    onClick={() => setScreen(app.id)}
                    className="flex flex-col items-center gap-1.5 cursor-pointer group"
                  >
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform"
                      style={{ backgroundColor: app.color }}
                    >
                      <AppGlyph id={app.id} />
                    </div>
                    <span className="text-[11px] font-medium text-[#e2e8f0] group-hover:text-white">
                      {app.name}
                    </span>
                  </button>
                ))}
              </div>

              {/* Direct Links for Heist Board & Customs 360 */}
              <div className="mt-auto pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenHeistBoard();
                    onClose();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer transition-colors"
                >
                  <div className="text-[10px] font-mono-num text-[#f59e0b]">
                    Pintasan [H]
                  </div>
                  <div className="text-xs font-semibold text-[#f4f1ea] mt-0.5">
                    Papan Heist
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenCustomsGarage();
                    onClose();
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer transition-colors"
                >
                  <div className="text-[10px] font-mono-num text-[#c084fc]">
                    Pintasan [B]
                  </div>
                  <div className="text-xs font-semibold text-[#f4f1ea] mt-0.5">
                    Bengkel 360°
                  </div>
                </button>
              </div>
            </>
          )}

          {/* APP 1: KONTRAK MISI */}
          {screen === 'misi' && (
            <div className="flex flex-col gap-3">
              {lastOutcomeText && (
                <div className="pb-2.5 border-b border-white/10 text-xs text-[#cbd5e1]">
                  <span className="text-[#38bdf8] font-semibold">Laporan Terakhir: </span>
                  {lastOutcomeText}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onCompleteSideHustle(95000, 'Kurir Kilat Dokumen SCBD')
                  }
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#f4f1ea]">
                    Kurir Kilat SCBD
                  </div>
                  <div className="text-[11px] font-mono-num text-[#22c55e] mt-0.5">
                    +Rp 95.000
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onCompleteSideHustle(135000, 'Patroli Keamanan Tanah Abang')
                  }
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#f4f1ea]">
                    Kawal Kargo Pasar
                  </div>
                  <div className="text-[11px] font-mono-num text-[#22c55e] mt-0.5">
                    +Rp 135.000
                  </div>
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {STORY_MISSIONS.map((m) => {
                  const done = playerState.completedMissions.includes(m.id);
                  const isCurrent = activeMission?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono-num text-[#94a3b8]">
                          Babak {m.chapterNumber} · {m.locationName}
                        </div>
                        <div
                          className={`text-xs font-semibold truncate ${
                            isCurrent
                              ? 'text-[#f59e0b]'
                              : done
                              ? 'text-[#94a3b8]'
                              : 'text-[#f4f1ea]'
                          }`}
                        >
                          {m.title}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onTriggerMissionDialog(m);
                        }}
                        className="px-2.5 py-1 rounded-md bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] text-[11px] font-semibold cursor-pointer shrink-0"
                      >
                        {done ? 'Ulangi' : 'Mulai'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* APP 2: BURSA SAHAM BAJSA */}
          {screen === 'saham' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
                <div>
                  <div className="text-[10px] text-[#94a3b8]">Nilai Portofolio</div>
                  <div className="font-mono-num text-base font-bold text-[#22c55e]">
                    {formatRupiah(portfolioValueRp)}
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
          )}

          {/* APP 3: KOMANDO HEIST & BALAP LIAR */}
          {screen === 'heist' && (
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  onOpenHeistBoard();
                  onClose();
                }}
                className="w-full p-3.5 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-left cursor-pointer hover:bg-[#f59e0b]/20 transition-colors"
              >
                <div className="font-display text-lg font-bold uppercase text-[#f59e0b]">
                  Buka Papan Grand Heist
                </div>
                <p className="text-xs text-[#cbd5e1] mt-0.5 leading-snug">
                  Rencanakan perampokan bank, pilih kru spesialis, dan tentukan jalur eksekusi.
                </p>
              </button>

              <div className="text-xs font-semibold text-[#94a3b8] pt-1">
                Sirkuit Balap Liar
              </div>
              <div className="divide-y divide-white/10">
                {STREET_RACES.map((race) => (
                  <div
                    key={race.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                        {race.name}
                      </div>
                      <div className="text-[11px] font-mono-num text-[#22c55e]">
                        Hadiah {formatRupiah(race.rewardRp)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onStartStreetRace(race.id);
                        onClose();
                      }}
                      className="px-3 py-1 rounded-md bg-[#38bdf8] text-[#090c12] text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      Balap
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APP 4: GARASI PEGASUS */}
          {screen === 'pegasus' && (
            <div className="divide-y divide-white/10">
              {(Object.keys(VEHICLE_SPECS) as VehicleType[]).map((vType) => {
                const spec = VEHICLE_SPECS[vType];
                return (
                  <div
                    key={vType}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                        {spec.name}
                      </div>
                      <div className="text-[11px] text-[#94a3b8] truncate">
                        {spec.subtitle}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSpawnVehicle(vType);
                        onClose();
                      }}
                      className="px-3 py-1 rounded-md bg-[#f59e0b] text-[#090c12] text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      Panggil
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* APP 5: AMUNISI GLODOK */}
          {screen === 'senjata' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onBuyArmorOrMedkit('medkit')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#22c55e]">Medkit</div>
                  <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                    Rp 50rb
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onBuyArmorOrMedkit('armor')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#38bdf8]">Kevlar</div>
                  <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                    Rp 100rb
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onBuyArmorOrMedkit('bribe')}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#f59e0b]">Suap</div>
                  <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                    Rp 120rb
                  </div>
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {(Object.keys(WEAPONS) as WeaponId[]).map((wId) => {
                  const spec = WEAPONS[wId];
                  const unlocked = playerState.unlockedWeapons.includes(wId);
                  const active = playerState.activeWeapon === wId;
                  return (
                    <div
                      key={wId}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                          {spec.name}
                        </div>
                        <div className="text-[11px] text-[#94a3b8] truncate">
                          {spec.roleClue}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onBuyOrEquipWeapon(wId)}
                        className={`px-2.5 py-1 rounded-md font-mono-num text-[11px] font-bold cursor-pointer shrink-0 ${
                          active
                            ? 'bg-[#22c55e] text-[#090c12]'
                            : 'bg-[#f59e0b] text-[#090c12]'
                        }`}
                      >
                        {unlocked
                          ? active
                            ? 'Isi'
                            : 'Pakai'
                          : formatRupiah(spec.price)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* APP 6: DINASTI PROPERTI */}
          {screen === 'properti' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onRecruitCrew}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#38bdf8]">
                    Kru ({playerState.crewCount}/3)
                  </div>
                  <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                    Rp 200.000
                  </div>
                </button>
                <button
                  type="button"
                  onClick={onUpgradeDrone}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer"
                >
                  <div className="text-xs font-semibold text-[#c084fc]">
                    Drone Lv.{playerState.droneLevel}/3
                  </div>
                  <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                    {formatRupiah(DRONE_UPGRADE_COST)}
                  </div>
                </button>
              </div>

              <div className="divide-y divide-white/10">
                {JAKARTA_PROPERTIES.map((prop) => {
                  const owned = playerState.ownedProperties.includes(prop.id);
                  return (
                    <div
                      key={prop.id}
                      className="py-2.5 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                          {prop.name}
                        </div>
                        <div className="text-[11px] font-mono-num text-[#22c55e]">
                          +{formatRupiah(prop.incomePerTick)} / 4d
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={owned}
                        onClick={() => onBuyProperty(prop.id)}
                        className="px-2.5 py-1 rounded-md bg-[#f59e0b] disabled:bg-white/10 text-[#090c12] disabled:text-[#22c55e] font-mono-num text-[11px] font-bold cursor-pointer shrink-0"
                      >
                        {owned ? 'Dimiliki' : formatRupiah(prop.price)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* APP 7: SATELIT TRIO PROTAGONIS */}
          {screen === 'satelit' && (
            <div className="divide-y divide-white/10">
              {(['nabilo', 'raka', 'kirana'] as ProtagonistId[]).map((pId) => {
                const prof = PROTAGONIST_PROFILES[pId];
                const live = playerState.protagonistRoster[pId];
                const isCurrent = playerState.activeProtagonist === pId;
                return (
                  <button
                    key={pId}
                    type="button"
                    onClick={() => {
                      onSwitchProtagonist(pId);
                      onClose();
                    }}
                    className="w-full py-3 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-white/5 px-1 rounded-lg transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: prof.colorHex }}
                        />
                        <span className="font-display text-base font-bold uppercase text-[#f4f1ea]">
                          {prof.name}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] text-[#f59e0b] font-semibold">
                            Aktif
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#94a3b8] mt-0.5 truncate">
                        {live.statusText}
                      </div>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-[#22c55e] shrink-0">
                      {Math.round(live.hp)}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* APP 8: RADIO FM, BUSANA & CUACA */}
          {screen === 'gaya' && (
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-2">
                  Stasiun Radio
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {RADIO_STATIONS.map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => onChangeRadio(st.id)}
                      className={`p-2 rounded-lg text-left cursor-pointer transition-colors ${
                        playerState.radioStation === st.id
                          ? 'bg-[#f59e0b] text-[#090c12]'
                          : 'bg-white/5 text-[#e2e8f0] hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{st.name}</div>
                      <div className="text-[10px] opacity-75">{st.freq}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-2">
                  Busana Karakter
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {NABILO_OUTFITS.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onChangeOutfit(o.id)}
                      className={`p-2 rounded-lg text-left cursor-pointer transition-colors ${
                        playerState.outfitId === o.id
                          ? 'bg-[#38bdf8] text-[#090c12]'
                          : 'bg-white/5 text-[#e2e8f0] hover:bg-white/10'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{o.name}</div>
                      <div className="text-[10px] opacity-75 truncate">
                        {o.subtitle}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#94a3b8] mb-2">
                  Cuaca Jakarta
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {WEATHER_MODES.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => onChangeWeather(w.id)}
                      className={`p-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                        weatherMode === w.id
                          ? 'bg-white text-[#090c12]'
                          : 'bg-white/5 text-[#cbd5e1] hover:bg-white/10'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* APP 9: MRT TRANSIT & INTERIOR */}
          {screen === 'mrt' && (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-semibold text-[#c084fc]">
                Interior Gedung
              </div>
              <div className="divide-y divide-white/10">
                {ENTERABLE_INTERIORS.map((inter) => (
                  <button
                    key={inter.id}
                    type="button"
                    onClick={() => {
                      onEnterInterior(inter.id);
                      onClose();
                    }}
                    className="w-full py-2 text-left flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 px-1 rounded"
                  >
                    <span className="text-xs font-semibold text-[#f4f1ea]">
                      {inter.name}
                    </span>
                    <span className="text-[11px] text-[#c084fc]">Masuk</span>
                  </button>
                ))}
              </div>

              <div className="text-xs font-semibold text-[#38bdf8] pt-1">
                Fast Travel Distrik
              </div>
              <div className="divide-y divide-white/10">
                {JAKARTA_DISTRICTS.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onFastTravel(d.id);
                      onClose();
                    }}
                    className="w-full py-2 text-left flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 px-1 rounded"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                        {d.name}
                      </div>
                      <div className="text-[10px] text-[#94a3b8] truncate">
                        {d.subtitle}
                      </div>
                    </div>
                    <span className="text-[11px] text-[#38bdf8] shrink-0">
                      Terbang
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Home Indicator Bar */}
        <div className="bg-[#0e131d] border-t border-white/10 py-2.5 flex items-center justify-center shrink-0">
          <button
            type="button"
            onClick={() => setScreen('home')}
            className="w-24 h-1 rounded-full bg-white/30 hover:bg-white/60 transition-colors cursor-pointer"
            title="Kembali ke Beranda"
          >
            <span className="sr-only">Beranda iFruit</span>
          </button>
        </div>
      </div>
    </div>
  );
};

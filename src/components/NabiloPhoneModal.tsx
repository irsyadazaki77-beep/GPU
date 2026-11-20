import React, { useState } from 'react';
import {
  CHARACTER_SKILL_SPECS,
  CustomRaceTrackSpec,
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
  STUNT_RAMPS_CATALOG,
  StockSymbol,
  StoryMission,
  VEHICLE_SPECS,
  VehicleType,
  WEAPON_ATTACHMENT_SPECS,
  WEATHER_MODES,
  WEAPONS,
  WeaponId,
  WeatherMode,
  bribePoliceWanted,
  buyWeaponAttachment,
  calculatePassiveBusinessIncome,
  calculatePassivePropertyIncome,
  calculateTurfWarsIncome,
  computeEmpireEndgameSummary,
  computeTrioSynergyPerks,
  executeBusinessSabotage,
  formatJakartaClock,
  formatRupiah,
  getDominantFactionTitle,
  JAKARTA_BUSINESSES,
  NUSANTARA_PACKAGES,
  purchaseOrUpgradeBusiness,
  upgradeCharacterSkill,
} from '../game/rules';

import {
  STREET_BOUNTIES,
  gameStore,
  useGameStore,
} from '../state/gameStore';
import { soundEngine } from '../game/sound';
import { CustomRaceUgcSection } from './phone/CustomRaceUgcSection';
import { PhoneSahamApp } from './phone/PhoneSahamApp';

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
  onStartCustomRace?: (track: CustomRaceTrackSpec) => void;
  onShareCustomRace?: (track: CustomRaceTrackSpec) => boolean;
  onCaptureViralSnap?: () => void;
  onStartTurfWar?: (districtId: string) => void;
  onWarpToRamp?: (rampId: string) => void;
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
  | 'mrt'
  | 'dompet'
  | 'feed'
  | 'bounty'
  | 'imperium';

const IFRUIT_APPS: {
  id: Exclude<AppScreenId, 'home'>;
  name: string;
  color: string;
}[] = [
  { id: 'imperium', name: 'Imperium', color: '#eab308' },
  { id: 'misi', name: 'Kontrak', color: '#f59e0b' },
  { id: 'saham', name: 'BAJSA', color: '#22c55e' },
  { id: 'heist', name: 'Heist', color: '#ef4444' },
  { id: 'pegasus', name: 'Pegasus', color: '#38bdf8' },
  { id: 'senjata', name: 'Glodok', color: '#f97316' },
  { id: 'properti', name: 'Properti', color: '#a855f7' },
  { id: 'satelit', name: 'Trio', color: '#06b6d4' },
  { id: 'gaya', name: 'Radio', color: '#ec4899' },
  { id: 'mrt', name: 'Transit', color: '#eab308' },
  { id: 'dompet', name: 'NabiloPay', color: '#10b981' },
  { id: 'feed', name: 'NabiloGram', color: '#ff6b4a' },
  { id: 'bounty', name: 'Bounty', color: '#f43f5e' },
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
    case 'dompet':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="6" width="18" height="13" rx="2" />
          <path d="M16 12h2" />
          <path d="M3 10h18" />
        </svg>
      );
    case 'feed':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      );
    case 'bounty':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      );
    case 'imperium':
      return (
        <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M3 18h18l-2-10-4.5 4L12 5l-2.5 7L5 8l-2 10z" />
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
  onStartCustomRace,
  onShareCustomRace,
  onCaptureViralSnap,
  onStartTurfWar,
  onWarpToRamp,
}) => {
  const phoneTargetScreen = useGameStore((s) => s.phoneTargetScreen);
  const [screen, setScreen] = useState<AppScreenId>(phoneTargetScreen || 'home');
  const [feedFilter, setFeedFilter] = useState<'all' | 'trending' | 'mine'>('all');
  const cashLedger = useGameStore((s) => s.cashLedger);
  const claimedBounties = useGameStore((s) => s.claimedBounties);
  const customWaypoint = useGameStore((s) => s.customWaypoint);
  const worldTimeMinutes = useGameStore((s) => s.worldTimeMinutes);
  const nabiloGramPosts = useGameStore((s) => s.nabiloGramPosts);
  const viralClout = useGameStore((s) => s.viralClout);
  const trioSynergy = useGameStore((s) => s.trioSynergy);
  const stuntCompletedIds = useGameStore((s) => s.stuntCompletedIds);
  const dailyChallenges = useGameStore((s) => s.dailyChallenges);
  const activeTurfWar = useGameStore((s) => s.activeTurfWar);
  const synergyPerks = computeTrioSynergyPerks(trioSynergy);
  const empireSummary = computeEmpireEndgameSummary(
    playerState,
    stuntCompletedIds.length
  );

  const dominantFaction = getDominantFactionTitle(playerState.reputation);
  const passiveIncome =
    calculatePassivePropertyIncome(playerState.ownedProperties) +
    calculateTurfWarsIncome(playerState) +
    calculatePassiveBusinessIncome(
      playerState.ownedBusinesses,
      playerState.characterSkills?.negotiation ?? 1
    );

  let portfolioValueRp = 0;
  for (const st of JAKARTA_STOCKS) {
    const entry = playerState.stockPortfolio[st.symbol];
    if (entry) {
      portfolioValueRp += entry.ownedShares * entry.currentPrice;
    }
  }

  let propertyAssetValueRp = 0;
  for (const prop of JAKARTA_PROPERTIES) {
    if (playerState.ownedProperties.includes(prop.id)) {
      propertyAssetValueRp += prop.price;
    }
  }
  const totalNetWorthRp =
    playerState.rupiah + portfolioValueRp + propertyAssetValueRp;

  return (
    /* Non-blocking right-corner anchor so the live 3D city stays bright & unobstructed */
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Smartphone iFruit Jakarta"
      className="fixed inset-0 z-30 flex items-end justify-end p-4 md:p-6 pointer-events-none"
    >
      <div className="w-full max-w-[344px] h-[644px] max-h-[84vh] aaa-phone-wallpaper border-[2px] border-white/20 ring-4 ring-black/65 rounded-[40px] shadow-[0_28px_72px_rgba(0,0,0,0.92)] flex flex-col justify-between overflow-hidden text-[#f4f1ea] pointer-events-auto animate-phone-in">
        {/* Top Phone Bezel & Dynamic Island Status Bar */}
        <div className="bg-[#090d16]/85 border-b border-white/10 px-5 pt-3 pb-2.5 flex flex-col gap-2 shrink-0">
          <div className="flex items-center justify-between text-[10px] font-mono-num text-[#cbd5e1]">
            <span>{formatJakartaClock(worldTimeMinutes)}</span>
            <div className="w-20 h-3.5 bg-[#030508] rounded-full border border-white/10 flex items-center justify-end pr-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1e293b]" />
            </div>
            <span className="text-[#4ade80] font-bold">
              {formatRupiah(playerState.rupiah)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            {screen !== 'home' ? (
              <button
                type="button"
                onClick={() => setScreen('home')}
                className="text-xs font-semibold text-[#38bdf8] hover:text-white cursor-pointer flex items-center gap-1"
              >
                <span aria-hidden="true">‹</span> Beranda
              </button>
            ) : (
              <span className="text-[11px] font-mono-num uppercase tracking-wider text-[#94a3b8]">
                iFruit OS
              </span>
            )}

            <span className="font-display text-base font-bold uppercase tracking-wide text-[#f4f1ea]">
              {screen === 'home'
                ? 'Jakarta'
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
              <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl bg-white/5 border border-white/10">
                <div className="min-w-0">
                  <div className="font-display text-lg font-extrabold uppercase text-[#f4f1ea] leading-none truncate">
                    {PROTAGONIST_PROFILES[playerState.activeProtagonist].name}
                  </div>
                  <div className="text-[11px] text-[#94a3b8] mt-1 truncate">
                    {dominantFaction.title} · +{formatRupiah(passiveIncome)}/4d
                  </div>
                </div>
                <span className="font-mono-num text-[11px] font-bold text-[#4ade80] bg-[#22c55e]/15 px-2 py-0.5 rounded-full shrink-0">
                  {playerState.completedMissions.length}/15
                </span>
              </div>

              {/* 4x3 Crisp Icon App Launcher with Specular Glass Sheen */}
              <div className="grid grid-cols-3 gap-x-3 gap-y-3.5 py-0.5">
                {IFRUIT_APPS.map((app) => {
                  const hasClaimable =
                    app.id === 'imperium' &&
                    dailyChallenges.items.some(
                      (c) => !c.claimed && c.progress >= c.target
                    );
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setScreen(app.id)}
                      className="flex flex-col items-center gap-1.5 cursor-pointer group"
                    >
                      <div
                        className="relative w-12 h-12 rounded-[15px] flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.45)] group-hover:scale-105 group-active:scale-95 transition-transform border border-white/25"
                        style={{
                          background: `linear-gradient(155deg, ${app.color} 0%, ${app.color}cc 100%)`,
                        }}
                      >
                        <AppGlyph id={app.id} />
                        {hasClaimable && (
                          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#22c55e] border-2 border-[#090d16]" />
                        )}
                      </div>
                      <span className="text-[11px] font-medium text-[#e2e8f0] group-hover:text-white leading-none">
                        {app.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Direct Links for Heist Board, Customs 360 & Photo Mode */}
              <div className="mt-auto pt-2.5 border-t border-white/10 grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onOpenHeistBoard();
                    onClose();
                  }}
                  className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer transition-colors"
                >
                  <div className="text-[10px] font-mono-num text-[#f59e0b]">
                    [H] Heist
                  </div>
                  <div className="text-[11px] font-semibold text-[#f4f1ea] mt-0.5 truncate">
                    Strategi
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onOpenCustomsGarage();
                    onClose();
                  }}
                  className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer transition-colors"
                >
                  <div className="text-[10px] font-mono-num text-[#c084fc]">
                    [B] Garasi
                  </div>
                  <div className="text-[11px] font-semibold text-[#f4f1ea] mt-0.5 truncate">
                    Kustom 360°
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    gameStore.setState({ photoModeOpen: true, phoneOpen: false });
                  }}
                  className="py-2 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-left cursor-pointer transition-colors"
                >
                  <div className="text-[10px] font-mono-num text-[#38bdf8]">
                    [N] Kamera
                  </div>
                  <div className="text-[11px] font-semibold text-[#f4f1ea] mt-0.5 truncate">
                    Photo Mode
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

              <div className="text-[11px] font-semibold text-[#38bdf8]">
                Misi Sampingan Lapangan (Open-World GPS)
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    gameStore.startStreetContract('ojol_delivery');
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-[#22c55e]/15 border border-[#22c55e]/35 hover:bg-[#22c55e]/25 text-left cursor-pointer"
                >
                  <div className="text-xs font-bold text-[#f4f1ea]">
                    Kurir Ojol Kilat
                  </div>
                  <div className="text-[11px] font-mono-num text-[#22c55e] mt-0.5">
                    +Rp 175.000 · 75d
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    gameStore.startStreetContract('convoy_intercept');
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-[#f59e0b]/15 border border-[#f59e0b]/35 hover:bg-[#f59e0b]/25 text-left cursor-pointer"
                >
                  <div className="text-xs font-bold text-[#f4f1ea]">
                    Sergap Konvoi Baja
                  </div>
                  <div className="text-[11px] font-mono-num text-[#f59e0b] mt-0.5">
                    +Rp 320.000 · 95d
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    gameStore.startStreetContract('glodok_arena');
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/35 hover:bg-[#ef4444]/25 text-left cursor-pointer"
                >
                  <div className="text-xs font-bold text-[#f4f1ea]">
                    Arena Bawah Tanah Glodok
                  </div>
                  <div className="text-[11px] font-mono-num text-[#ef4444] mt-0.5">
                    +Rp 520.000 · 120d
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    gameStore.startStreetContract('priok_container_heist');
                    onClose();
                  }}
                  className="p-2.5 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/35 hover:bg-[#38bdf8]/25 text-left cursor-pointer"
                >
                  <div className="text-xs font-bold text-[#f4f1ea]">
                    Kontainer Tanjung Priok
                  </div>
                  <div className="text-[11px] font-mono-num text-[#38bdf8] mt-0.5">
                    +Rp 780.000 · 150d
                  </div>
                </button>
              </div>

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
            <PhoneSahamApp
              playerState={playerState}
              portfolioValueRp={portfolioValueRp}
              onBuyStock={onBuyStock}
              onSellStock={onSellStock}
            />
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

          {/* APP 5: AMUNISI GLODOK, ATTACHMENT SENJATA & SKILL KARAKTER */}
          {screen === 'senjata' && (
            <div className="flex flex-col gap-3.5">
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
                  onClick={() => {
                    const res = bribePoliceWanted(playerState);
                    if (res.bribed) {
                      soundEngine.playPickup();
                      gameStore.setState({
                        playerState: res.nextState,
                        lastOutcomeText: `Suap Patwal Berhasil (-${formatRupiah(res.costRp)}) · Buronan Bersih!`,
                      });
                    } else {
                      onBuyArmorOrMedkit('bribe');
                    }
                  }}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-center cursor-pointer"
                >
                  <div className="text-[11px] font-bold text-[#f59e0b]">Suap Patwal</div>
                  <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                    Bersih ★
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
                      className="py-2 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                          {spec.name}
                        </div>
                        <div className="text-[10px] text-[#94a3b8] truncate">
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

              {/* Weapon Attachments for Active Firearm */}
              {!WEAPONS[playerState.activeWeapon].isMelee && (
                <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                  <div className="text-[11px] font-semibold text-[#f97316]">
                    Modifikasi Attachment: {WEAPONS[playerState.activeWeapon].name}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {WEAPON_ATTACHMENT_SPECS.map((att) => {
                      const owned = (
                        playerState.weaponAttachments?.[playerState.activeWeapon] ||
                        []
                      ).includes(att.id);
                      return (
                        <button
                          key={att.id}
                          type="button"
                          disabled={owned}
                          onClick={() => {
                            const res = buyWeaponAttachment(
                              playerState,
                              playerState.activeWeapon,
                              att.id
                            );
                            if (res.bought) {
                              soundEngine.playPickup();
                              gameStore.setState({
                                playerState: res.nextState,
                                lastOutcomeText: `Attachment Terpasang: ${att.name} (${WEAPONS[playerState.activeWeapon].name})`,
                              });
                            }
                          }}
                          className={`p-2 rounded-lg text-left cursor-pointer transition-colors ${
                            owned
                              ? 'bg-[#22c55e]/20 border border-[#22c55e]/40 text-[#22c55e]'
                              : 'bg-white/5 hover:bg-white/10 text-[#f4f1ea]'
                          }`}
                        >
                          <div className="text-[11px] font-bold truncate">
                            {att.name}
                          </div>
                          <div className="text-[10px] font-mono-num text-[#cbd5e1]">
                            {owned ? 'Terpasang' : formatRupiah(att.priceRp)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5-Branch Character Skill Progression */}
              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <div className="text-[11px] font-semibold text-[#38bdf8]">
                  Upgrade Skill Karakter (Lv. 1–5)
                </div>
                <div className="divide-y divide-white/10">
                  {CHARACTER_SKILL_SPECS.map((sk) => {
                    const lv = playerState.characterSkills?.[sk.id] ?? 1;
                    const cost = sk.baseCostRp * lv;
                    return (
                      <div
                        key={sk.id}
                        className="py-2 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                            {sk.name} ·{' '}
                            <span className="font-mono-num text-[#38bdf8]">
                              Lv.{lv}/5
                            </span>
                          </div>
                          <div className="text-[10px] text-[#94a3b8] truncate">
                            {sk.perkSummary}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={lv >= 5}
                          onClick={() => {
                            const res = upgradeCharacterSkill(playerState, sk.id);
                            if (res.upgraded) {
                              soundEngine.playMissionFanfare();
                              gameStore.setState({
                                playerState: res.nextState,
                                lastOutcomeText: `Skill Meningkat: ${sk.name} naik ke Lv.${lv + 1}!`,
                              });
                            }
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#38bdf8] disabled:bg-white/10 text-[#090c12] disabled:text-[#22c55e] font-mono-num text-[10px] font-bold cursor-pointer shrink-0"
                        >
                          {lv >= 5 ? 'Maks' : formatRupiah(cost)}
                        </button>
                      </div>
                    );
                  })}
                </div>
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

              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <div className="text-[11px] font-semibold text-[#c084fc]">
                  Bisnis Bawah Tanah & Sabotase Bursa BAJSA
                </div>
                <div className="divide-y divide-white/10">
                  {JAKARTA_BUSINESSES.map((biz) => {
                    const lv = playerState.ownedBusinesses?.[biz.id] || 0;
                    const cost = lv === 0 ? biz.basePrice : biz.upgradeCost * lv;
                    return (
                      <div key={biz.id} className="py-2.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                              {biz.name} {lv > 0 ? `(Lv.${lv}/5)` : ''}
                            </div>
                            <div className="text-[10px] font-mono-num text-[#22c55e]">
                              +{formatRupiah(biz.baseIncomePerHour)}/jam · Saham{' '}
                              {biz.linkedStock} vs {biz.rivalStock}
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={lv >= 5}
                            onClick={() => {
                              const res = purchaseOrUpgradeBusiness(
                                playerState,
                                biz.id
                              );
                              if (res.success) {
                                soundEngine.playCashRegister();
                                gameStore.setState({
                                  playerState: res.nextState,
                                  lastOutcomeText: `Bisnis Diperkuat: ${biz.name} naik ke Lv.${res.newLevel}!`,
                                });
                              }
                            }}
                            className="px-2.5 py-1 rounded-md bg-[#c084fc] disabled:bg-white/10 text-[#090c12] disabled:text-[#22c55e] font-mono-num text-[10px] font-bold cursor-pointer shrink-0"
                          >
                            {lv >= 5 ? 'Maks' : lv === 0 ? formatRupiah(cost) : `Up ${formatRupiah(cost)}`}
                          </button>
                        </div>
                        {lv > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const sab = executeBusinessSabotage(
                                playerState,
                                biz.id,
                                `${formatJakartaClock(worldTimeMinutes)} WIB`
                              );
                              if (sab.executed && sab.news) {
                                soundEngine.playMissionFanfare();
                                gameStore.setState({
                                  playerState: sab.nextState,
                                  lastOutcomeText: sab.news.headline,
                                });
                              }
                            }}
                            className="w-full py-1 px-2 rounded bg-[#ef4444]/20 hover:bg-[#ef4444]/35 border border-[#ef4444]/40 text-[10px] font-mono-num font-bold text-[#fca5a5] cursor-pointer text-left"
                          >
                            Sabotase Kompetitor ({biz.rivalStock} Anjlok / {biz.linkedStock} Naik)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* APP 7: SATELIT TRIO PROTAGONIS & SINERGI KRU */}
          {screen === 'satelit' && (
            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display text-sm font-bold uppercase tracking-wide text-[#ff6b4a]">
                    Sinergi Trio · {synergyPerks.tierLabel}
                  </span>
                  <span className="font-mono-num text-[11px] font-bold text-[#22c55e]">
                    +{synergyPerks.heistBonusPercent}% Heist
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 text-[11px] font-mono-num">
                  {[
                    { label: 'Nabilo ↔ Raka', val: trioSynergy.nabiloRaka, color: '#f59e0b' },
                    { label: 'Nabilo ↔ Kirana', val: trioSynergy.nabiloKirana, color: '#38bdf8' },
                    { label: 'Raka ↔ Kirana', val: trioSynergy.rakaKirana, color: '#c084fc' },
                  ].map((pair) => (
                    <div key={pair.label} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between text-[#cbd5e1]">
                        <span>{pair.label}</span>
                        <span>{pair.val}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pair.val}%`, backgroundColor: pair.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {trioSynergy.lastBanterLine && (
                  <p className="text-[11px] text-[#e2e8f0] italic pt-1 border-t border-white/10 leading-snug">
                    {trioSynergy.lastBanterLine}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() =>
                    gameStore.boostTrioSynergy(
                      6,
                      'Briefing Trio di radio aman — kekompakan tim meningkat!'
                    )
                  }
                  className="w-full py-1.5 rounded-lg bg-[#38bdf8]/20 hover:bg-[#38bdf8]/30 border border-[#38bdf8]/40 text-[#7dd3fc] text-[11px] font-semibold cursor-pointer transition-colors"
                >
                  Kumpul Radio Kru (+Sinergi)
                </button>
              </div>

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

          {/* APP 10: NABILOPAY DIGITAL WALLET & LEDGER */}
          {screen === 'dompet' && (
            <div className="flex flex-col gap-3">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#064e3b] to-[#0f172a] border border-[#10b981]/40 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono-num text-[#6ee7b7]">
                  <span>NABILOPAY PLATINUM</span>
                  <span>ID · JKT-8829</span>
                </div>
                <div className="font-mono-num text-xl font-extrabold text-[#f4f1ea]">
                  {formatRupiah(totalNetWorthRp)}
                </div>
                <div className="text-[11px] text-[#cbd5e1] flex items-center justify-between pt-1 border-t border-white/10 font-mono-num">
                  <span>Kas: {formatRupiah(playerState.rupiah)}</span>
                  <span>Saham: {formatRupiah(portfolioValueRp)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/8">
                  <div className="text-[10px] text-[#94a3b8]">Aset Properti</div>
                  <div className="font-mono-num text-xs font-bold text-[#c084fc] mt-0.5">
                    {formatRupiah(propertyAssetValueRp)}
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/8">
                  <div className="text-[10px] text-[#94a3b8]">Dividen Pasif</div>
                  <div className="font-mono-num text-xs font-bold text-[#22c55e] mt-0.5">
                    +{formatRupiah(passiveIncome)}/4d
                  </div>
                </div>
              </div>

              <div className="text-xs font-semibold text-[#94a3b8] pt-1">
                Mutasi Rekening Terakhir
              </div>
              <div className="divide-y divide-white/10">
                {cashLedger.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-[#f4f1ea] truncate">
                        {tx.label}
                      </div>
                      <div className="text-[10px] font-mono-num text-[#94a3b8] uppercase">
                        {tx.category}
                      </div>
                    </div>
                    <span
                      className={`font-mono-num text-xs font-bold shrink-0 ${
                        tx.amountRp >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
                      }`}
                    >
                      {tx.amountRp >= 0
                        ? `+${formatRupiah(tx.amountRp)}`
                        : `-${formatRupiah(Math.abs(tx.amountRp))}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* APP 11: NABILOGRAM VIRAL SOCIAL FEED */}
          {screen === 'feed' && (
            <div className="flex flex-col gap-3">
              {/* Viral Clout Header */}
              <div className="p-3 rounded-xl bg-gradient-to-br from-[#2a1529] to-[#0f172a] border border-[#ff6b4a]/35 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-display text-base font-extrabold uppercase tracking-wide text-[#ff6b4a]">
                      NabiloGram · Lv.{viralClout.level}
                    </div>
                    <div className="text-[11px] text-[#e2e8f0]">
                      {viralClout.tierTitle} · Bonus Sponsor +{viralClout.sponsorBonusPercent}%
                    </div>
                  </div>
                  <span className="font-mono-num text-[11px] font-bold text-[#fef08a]">
                    {viralClout.xp}/{viralClout.nextLevelXp} XP
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-[#ff6b4a] transition-all duration-300"
                    style={{
                      width: `${Math.min(
                        100,
                        ((viralClout.xp % 120) / 120) * 100
                      )}%`,
                    }}
                  />
                </div>
                {onCaptureViralSnap && (
                  <button
                    type="button"
                    data-testid="nabilogram-snap-btn"
                    onClick={() => onCaptureViralSnap()}
                    className="w-full py-1.5 px-3 rounded-lg bg-[#ff6b4a] hover:bg-[#fb7185] text-[#090c12] font-bold text-xs cursor-pointer transition-colors"
                  >
                    Rekam & Posting Momen Sekarang (+Clout)
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="grid grid-cols-3 gap-1.5 text-[11px] font-semibold">
                {(
                  [
                    { id: 'all', label: 'Untuk Kamu' },
                    { id: 'trending', label: 'Trending' },
                    { id: 'mine', label: 'Klip Gue' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFeedFilter(tab.id)}
                    className={`py-1.5 rounded-lg cursor-pointer transition-colors ${
                      feedFilter === tab.id
                        ? 'bg-[#ff6b4a] text-[#090c12]'
                        : 'bg-white/5 text-[#cbd5e1] hover:bg-white/10'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Vertical Reactive Viral Posts */}
              <div className="flex flex-col gap-3">
                {nabiloGramPosts
                  .filter((p) => {
                    if (feedFilter === 'trending') return p.views >= 25000 || p.boosted;
                    if (feedFilter === 'mine') return p.triggerKind === 'manual_snap' || Boolean(p.snapshotDataUrl);
                    return true;
                  })
                  .map((post) => (
                    <article
                      key={post.id}
                      className="rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden flex flex-col"
                    >
                      {post.snapshotDataUrl ? (
                        <div className="relative w-full aspect-video bg-[#070a10] overflow-hidden">
                          <img
                            src={post.snapshotDataUrl}
                            alt={`Cuplikan ${post.districtName}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-[#070a10]/85 text-[10px] font-mono-num text-[#fef08a]">
                            {post.districtName}
                          </div>
                        </div>
                      ) : (
                        <div className="px-3 py-2 bg-gradient-to-r from-[#1e1b4b]/80 to-[#3b1525]/70 border-b border-white/8 flex items-center justify-between text-[10px] font-mono-num text-[#cbd5e1]">
                          <span>{post.districtName}</span>
                          <span className="text-[#ff6b4a]">
                            {post.source === 'gemini' ? 'Live Wire' : 'Jakarta Live'}
                          </span>
                        </div>
                      )}

                      <div className="p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <div className="min-w-0 truncate">
                            <span className="font-mono-num font-bold text-[#ff6b4a]">
                              {post.authorHandle}
                            </span>
                            <span className="text-[#94a3b8] ml-1.5">
                              · {post.authorTag}
                            </span>
                          </div>
                          <span className="font-mono-num text-[10px] text-[#94a3b8] shrink-0">
                            {(post.views / 1000).toFixed(1)}k views
                          </span>
                        </div>

                        <p className="text-xs text-[#f4f1ea] leading-relaxed">
                          {post.caption}
                        </p>

                        <div className="text-[10px] font-mono-num text-[#38bdf8] flex flex-wrap gap-1.5">
                          {post.hashtags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => gameStore.toggleLikeViralPost(post.id)}
                            className={`text-[11px] font-mono-num font-bold cursor-pointer transition-colors ${
                              post.isLiked
                                ? 'text-[#fb7185]'
                                : 'text-[#cbd5e1] hover:text-white'
                            }`}
                          >
                            {post.isLiked ? '♥' : '♡'} {post.likes.toLocaleString('id-ID')}
                          </button>

                          <button
                            type="button"
                            disabled={post.boosted || playerState.rupiah < 25000}
                            onClick={() => gameStore.boostViralPost(post.id)}
                            className="px-2 py-0.5 rounded bg-[#f59e0b]/20 hover:bg-[#f59e0b]/35 disabled:bg-white/5 text-[#fbbf24] disabled:text-[#64748b] text-[10px] font-mono-num font-bold cursor-pointer transition-colors"
                          >
                            {post.boosted ? 'Trending FYP ✓' : 'Boost Rp 25rb'}
                          </button>
                        </div>

                        {post.comments.length > 0 && (
                          <div className="pt-1.5 border-t border-white/8 flex flex-col gap-1">
                            {post.comments.slice(0, 2).map((c) => (
                              <div key={c.id} className="text-[11px] text-[#cbd5e1] leading-snug">
                                <span className="font-mono-num font-semibold text-[#94a3b8] mr-1.5">
                                  {c.handle}
                                </span>
                                {c.text}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            </div>
          )}

          {/* APP 12: RADAR BOUNTY & GPS WAYPOINT TRACKER */}
          {screen === 'bounty' && (
            <div className="flex flex-col gap-3">
              {customWaypoint && (
                <div className="p-2.5 rounded-xl bg-[#c084fc]/15 border border-[#c084fc]/40 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono-num text-[#c084fc]">
                      GPS WAYPOINT AKTIF
                    </div>
                    <div className="text-xs font-bold text-[#f4f1ea] truncate">
                      {customWaypoint.label}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => gameStore.setCustomWaypoint(null)}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px] font-mono-num text-[#f4f1ea] cursor-pointer shrink-0"
                  >
                    Hapus
                  </button>
                </div>
              )}

              <div className="divide-y divide-white/10">
                {STREET_BOUNTIES.map((b) => {
                  const claimed = claimedBounties.includes(b.id);
                  return (
                    <div
                      key={b.id}
                      className="py-3 flex flex-col gap-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono-num text-[#94a3b8]">
                            {b.districtName} · Kesulitan {b.difficulty}
                          </div>
                          <div className="text-xs font-bold text-[#f4f1ea] truncate">
                            {b.targetName}
                          </div>
                          <div className="text-[11px] text-[#cbd5e1] truncate">
                            {b.title}
                          </div>
                        </div>
                        <span className="font-mono-num text-xs font-bold text-[#22c55e] shrink-0">
                          {formatRupiah(b.rewardRp)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playPickup();
                            gameStore.setCustomWaypoint({
                              x: b.x,
                              z: b.z,
                              label: `Bounty: ${b.targetName}`,
                              category: 'bounty',
                            });
                            onClose();
                          }}
                          className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#c084fc]/20 hover:bg-[#c084fc]/30 border border-[#c084fc]/40 text-[#e9d5ff] text-[11px] font-semibold cursor-pointer text-center"
                        >
                          Pin GPS Waypoint
                        </button>
                        <button
                          type="button"
                          disabled={claimed}
                          onClick={() => {
                            soundEngine.playCashRegister();
                            gameStore.claimStreetBounty(b.id);
                          }}
                          className="py-1.5 px-3 rounded-lg bg-[#f43f5e] disabled:bg-white/10 text-white disabled:text-[#64748b] text-[11px] font-bold cursor-pointer shrink-0"
                        >
                          {claimed ? 'Tuntas' : 'Sergap'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* APP 13: IMPERIUM ENDGAME, TANTANGAN HARIAN, TURF WAR 3D & STUNT RAMP */}
          {screen === 'imperium' && (
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
                            onClose();
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

              {/* 4. Balap Liar Rival AI & 6 Stunt Ramp Jakarta */}
              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <div className="text-[11px] font-bold uppercase font-mono-num text-[#22d3ee]">
                  Balap Liar Rival AI Jakarta
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
                          3 Rival AI · Hadiah {formatRupiah(race.rewardRp)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onStartStreetRace(race.id);
                          onClose();
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
                    protagonistName={
                      PROTAGONIST_PROFILES[playerState.activeProtagonist].name
                    }
                    onStartCustomRace={onStartCustomRace}
                    onShareCustomRace={onShareCustomRace}
                    onClosePhone={onClose}
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
                            onClose();
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

import React, { useEffect, useRef, useState } from 'react';
import type {
  CombatHitFeedbackEvent,
  DistrictZone,
  EnterableInteriorSpec,
  PlayerProgressState,
  ProtagonistId,
  StoryChoiceOption,
  StoryMission,
  VehicleType,
  WeaponId,
  WeatherMode,
} from '../game/types';
import {
  PROTAGONIST_PROFILES,
  RADIO_STATIONS,
  VEHICLE_SPECS,
  WEATHER_MODES,
  formatJakartaClock,
  formatRupiah,
  getEffectiveWeaponSpec,
} from '../game/rules';
import {
  engineTelemetryRef,
  gameStore,
  useGameStore,
} from '../state/gameStore';
import { MiniMapRadar } from './MiniMapRadar';

interface GameHudProps {
  playerState: PlayerProgressState;
  ghostHp: number;
  district: DistrictZone;
  drivingVehicle: VehicleType | null;
  vehicleSpeedKmh: number;
  aircraftAltitude: number;
  isDrifting?: boolean;
  combatHitEvents?: CombatHitFeedbackEvent[];
  playerHitFlash?: { active: boolean; angleRad: number; stamp?: number };
  nearbyVehicle: VehicleType | null;
  nearbyMission: StoryMission | null;
  nearbyInterior: EnterableInteriorSpec | null;
  activeMission: StoryMission | null;
  activeChoice: StoryChoiceOption | null;
  objectiveProgress: number;
  weatherMode: WeatherMode;
  ambientCueLabel?: string;
  passiveIncome: number;
  muted: boolean;
  tpsAiming: boolean;
  lastOutcomeText?: string | null;
  skySwitchPhase: {
    active: boolean;
    targetId: ProtagonistId;
    stage: 1 | 2 | 3;
  } | null;
  onSelectWeapon: (w: WeaponId) => void;
  onTogglePhone: () => void;
  onToggleVehicle: () => void;
  onHonk?: () => void;
  onToggleFokus: () => void;
  onToggleDrone: () => void;
  onToggleTpsAim: () => void;
  onOpenWeaponWheel: () => void;
  onOpenCharacterWheel: () => void;
  onSwitchProtagonist: (targetId: ProtagonistId) => void;
  onOpenHeistBoard: () => void;
  onOpenCustomsGarage: () => void;
  onOpenWarung: () => void;
  onOpenPhotoMode?: () => void;
  onEnterOrExitInterior: () => void;
  onOpenMissionDialog: (m: StoryMission) => void;
  onCycleWeather: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

/** Custom SVG Weapon Silhouettes for AAA Top-Right HUD & Wheel */
export const WeaponSilhouetteSvg: React.FC<{
  weaponId: WeaponId;
  className?: string;
}> = ({ weaponId, className = 'w-14 h-7' }) => {
  switch (weaponId) {
    case 'fist':
      return (
        <svg viewBox="0 0 64 32" className={className} fill="currentColor">
          <path d="M18 12h6v12h-6zM26 9h6v15h-6zM34 10h6v14h-6zM42 13h5v11h-5zM14 16h4v8h-4z" />
        </svg>
      );
    case 'golok':
      return (
        <svg viewBox="0 0 64 32" className={className} fill="currentColor">
          <path d="M8 20l10-3 36-11c3 2 4 6 1 9L20 22l-10 3z" />
        </svg>
      );
    case 'pistol':
      return (
        <svg viewBox="0 0 64 32" className={className} fill="currentColor">
          <path d="M14 8h34v7H26l-3 11h-8l2-11h-3z" />
        </svg>
      );
    case 'rifle':
      return (
        <svg viewBox="0 0 64 32" className={className} fill="currentColor">
          <path d="M6 12h44v4h8v2h-8v2H34l-2 7h-5l1-7H18l-3 6H9l2-8H6z" />
        </svg>
      );
    case 'mercon':
      return (
        <svg viewBox="0 0 64 32" className={className} fill="currentColor">
          <path d="M8 10h42l6-3v14l-6-3H28l-2 7h-6l1-7H8z" />
        </svg>
      );
    case 'pasopati':
      return (
        <svg viewBox="0 0 64 32" className={className} fill="currentColor">
          <path d="M26 3c12 5 16 11 16 13s-4 8-16 13l-2-3c8-4 12-8 12-10S32 10 24 6l2-3zm-14 12h42v2H12z" />
        </svg>
      );
    case 'gatotkaca':
      return (
        <svg viewBox="0 0 64 32" className={className} fill="currentColor">
          <path d="M6 9h38l12-2v4h4v6h-4v4l-12-2H26l-2 7h-7l1-7H6z" />
        </svg>
      );
  }
};

export const GameHud: React.FC<GameHudProps> = ({
  playerState,
  ghostHp,
  district,
  drivingVehicle,
  vehicleSpeedKmh,
  aircraftAltitude,
  isDrifting = false,
  combatHitEvents = [],
  playerHitFlash,
  nearbyVehicle,
  nearbyMission,
  nearbyInterior,
  activeMission,
  activeChoice,
  objectiveProgress,
  weatherMode,
  ambientCueLabel,
  passiveIncome,
  muted,
  tpsAiming,
  lastOutcomeText,
  skySwitchPhase,
  onTogglePhone,
  onToggleVehicle,
  onHonk,
  onToggleFokus,
  onToggleDrone,
  onOpenWeaponWheel,
  onOpenCharacterWheel,
  onOpenCustomsGarage,
  onOpenWarung,
  onOpenPhotoMode,
  onEnterOrExitInterior,
  onOpenMissionDialog,
  onPause,
}) => {
  const customWaypoint = useGameStore((s) => s.customWaypoint);
  const zenHudMode = useGameStore((s) => s.zenHudMode);
  const gamepadActive = useGameStore((s) => s.gamepadActive);
  const worldTimeMinutes = useGameStore((s) => s.worldTimeMinutes);
  const driftScore = useGameStore((s) => s.driftScore);
  const driftMultiplier = useGameStore((s) => s.driftMultiplier);
  const activeContract = useGameStore((s) => s.activeContract);
  const worldClockEventState = useGameStore((s) => s.worldClockEventState);
  const perfOverlayOpen = useGameStore((s) => s.perfOverlayOpen);
  const cloudSyncStatus = useGameStore((s) => s.cloudSyncStatus);
  const activeSaveSlot = useGameStore((s) => s.activeSaveSlot);
  const activeRoadEvent = worldClockEventState.activeEvent;

  const [perfSnap, setPerfSnap] = useState(() => ({
    ...engineTelemetryRef.perf,
  }));

  useEffect(() => {
    if (!perfOverlayOpen) return;
    setPerfSnap({ ...engineTelemetryRef.perf });
    const id = window.setInterval(() => {
      setPerfSnap({ ...engineTelemetryRef.perf });
    }, 250);
    return () => clearInterval(id);
  }, [perfOverlayOpen]);

  const currentWeaponSpec = getEffectiveWeaponSpec(
    playerState.activeWeapon,
    playerState
  );
  const activeRadioSpec =
    RADIO_STATIONS.find((r) => r.id === playerState.radioStation) ||
    RADIO_STATIONS[0];
  const activeProtagonistProf =
    PROTAGONIST_PROFILES[playerState.activeProtagonist];
  const lowHp = playerState.hp <= 30;

  // Instant Cash Delta Popup (+Rp / -Rp) like GTA V
  const prevRupiahRef = useRef<number>(playerState.rupiah);
  const [cashDelta, setCashDelta] = useState<number | null>(null);

  useEffect(() => {
    const diff = playerState.rupiah - prevRupiahRef.current;
    prevRupiahRef.current = playerState.rupiah;
    if (diff !== 0) {
      setCashDelta(diff);
      const t = window.setTimeout(() => setCashDelta(null), 2400);
      return () => clearTimeout(t);
    }
  }, [playerState.rupiah]);

  // Rockstar-Style Mission Passed / Heist Complete Stamp Banner
  const prevOutcomeRef = useRef<string | null | undefined>(lastOutcomeText);
  const [stampBanner, setStampBanner] = useState<string | null>(null);

  useEffect(() => {
    if (lastOutcomeText && lastOutcomeText !== prevOutcomeRef.current) {
      prevOutcomeRef.current = lastOutcomeText;
      setStampBanner(lastOutcomeText);
      const t = window.setTimeout(() => setStampBanner(null), 4600);
      return () => clearTimeout(t);
    }
  }, [lastOutcomeText]);

  // Transient District Reveal Toast on district change (Rockstar style)
  const prevDistrictRef = useRef<string>(district.id);
  const [districtToast, setDistrictToast] = useState<boolean>(false);

  useEffect(() => {
    if (district.id !== prevDistrictRef.current) {
      prevDistrictRef.current = district.id;
      setDistrictToast(true);
      const t = window.setTimeout(() => setDistrictToast(false), 3200);
      return () => clearTimeout(t);
    }
  }, [district.id]);

  // Transient Radio FM Station Banner on radio station change
  const prevRadioRef = useRef<string>(playerState.radioStation);
  const [radioToast, setRadioToast] = useState<{
    name: string;
    freq: string;
    genre: string;
  } | null>(null);

  useEffect(() => {
    if (playerState.radioStation !== prevRadioRef.current) {
      prevRadioRef.current = playerState.radioStation;
      const st = RADIO_STATIONS.find((r) => r.id === playerState.radioStation);
      if (st) {
        setRadioToast({ name: st.name, freq: st.freq, genre: st.genre });
        const t = window.setTimeout(() => setRadioToast(null), 3000);
        return () => clearTimeout(t);
      }
    }
  }, [playerState.radioStation]);

  const waypointDistanceM = customWaypoint
    ? Math.round(
        Math.hypot(
          customWaypoint.x - engineTelemetryRef.playerX,
          customWaypoint.z - engineTelemetryRef.playerZ
        )
      )
    : null;

  const weatherSpec =
    WEATHER_MODES.find((w) => w.id === weatherMode) || WEATHER_MODES[0];

  // Calculate RPM & Gear for Driving Speedometer Arc
  const vehicleSpec = drivingVehicle ? VEHICLE_SPECS[drivingVehicle] : null;
  const maxKmh = vehicleSpec ? Math.round(vehicleSpec.maxSpeed * 3.2) : 140;
  const speedRatio = Math.min(1, vehicleSpeedKmh / Math.max(1, maxKmh));
  const gearNumber = vehicleSpec?.isAircraft
    ? 'VTOL'
    : vehicleSpeedKmh < 4
    ? 'N'
    : Math.min(6, Math.max(1, Math.ceil(speedRatio * 6)));
  const rpmRatio =
    vehicleSpeedKmh < 4
      ? 0.16
      : Math.min(0.98, ((speedRatio * 6) % 1) * 0.65 + 0.32);

  const arcRadius = 42;
  const arcCircumference = 2 * Math.PI * arcRadius;
  const sweepFraction = 0.68;
  const maxDash = arcCircumference * sweepFraction;
  const currentDash = maxDash * rpmRatio;

  // Determine single highest-priority contextual prompt for bottom-center
  const primaryPrompt =
    nearbyInterior || playerState.currentInterior !== 'exterior'
      ? {
          keycap: 'G',
          label:
            playerState.currentInterior !== 'exterior'
              ? 'Keluar Gedung'
              : `Masuk ${nearbyInterior?.name}`,
          accent: '#10b981',
          onClick: onEnterOrExitInterior,
        }
      : nearbyMission && !activeMission
      ? {
          keycap: 'E',
          label: `Bicara dengan ${nearbyMission.giverName}`,
          accent: '#f59e0b',
          onClick: () => onOpenMissionDialog(nearbyMission),
        }
      : drivingVehicle || nearbyVehicle
      ? {
          keycap: 'F',
          label: drivingVehicle
            ? `Turun dari ${VEHICLE_SPECS[drivingVehicle].name}`
            : `Kemudikan ${VEHICLE_SPECS[nearbyVehicle!].name}`,
          accent: '#38bdf8',
          onClick: onToggleVehicle,
        }
      : null;

  return (
    <div
      aria-label="HUD Permainan GPU San Nabilo"
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 md:p-6"
    >
      {/* Low HP Critical Peripheral Vignette */}
      {lowHp && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            background:
              'radial-gradient(circle, rgba(0,0,0,0) 55%, rgba(220,38,38,0.42) 100%)',
          }}
        />
      )}

      {/* Directional Damage Arc Vignette */}
      {playerHitFlash?.active && (
        <div
          className="fixed inset-0 pointer-events-none flex items-center justify-center z-10"
          aria-hidden="true"
        >
          <div
            className="w-[82vmin] h-[82vmin] rounded-full transition-transform duration-150"
            style={{
              transform: `rotate(${Math.round(
                (playerHitFlash.angleRad * 180) / Math.PI
              )}deg)`,
              background:
                'conic-gradient(from -28deg at 50% 50%, rgba(239,68,68,0.52) 0deg, rgba(239,68,68,0.42) 56deg, rgba(0,0,0,0) 76deg, rgba(0,0,0,0) 360deg)',
              WebkitMaskImage:
                'radial-gradient(circle, transparent 58%, black 76%, transparent 96%)',
              maskImage:
                'radial-gradient(circle, transparent 58%, black 76%, transparent 96%)',
            }}
          />
        </div>
      )}

      {/* Floating Combat Hit & KO Callouts */}
      {combatHitEvents.length > 0 && (
        <div
          className="fixed inset-0 pointer-events-none z-20"
          aria-hidden="true"
        >
          {combatHitEvents.map((evt) => (
            <div
              key={evt.id}
              className={`absolute -translate-x-1/2 -translate-y-1/2 font-display font-extrabold italic uppercase tracking-wider hud-stroke animate-aaa-up ${
                evt.isKo
                  ? 'text-2xl text-[#f59e0b]'
                  : evt.isCrit
                  ? 'text-lg text-[#38bdf8]'
                  : 'text-base text-[#f4f1ea]'
              }`}
              style={{
                left: `${evt.screenX}%`,
                top: `${evt.screenY}%`,
              }}
            >
              {evt.isKo ? `K.O! -${evt.damage}` : `-${evt.damage}`}
              {evt.isCrit && !evt.isKo && ' KRITIS'}
            </div>
          ))}
        </div>
      )}

      {/* Special Ability [Q] Tactical Chromatic Vignette */}
      {playerState.fokusActive && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            background:
              playerState.activeProtagonist === 'raka'
                ? 'radial-gradient(circle, rgba(0,0,0,0) 58%, rgba(56,189,248,0.28) 100%)'
                : playerState.activeProtagonist === 'kirana'
                ? 'radial-gradient(circle, rgba(0,0,0,0) 58%, rgba(192,132,252,0.28) 100%)'
                : 'radial-gradient(circle, rgba(0,0,0,0) 58%, rgba(250,204,21,0.26) 100%)',
          }}
        />
      )}

      {/* ROCKSTAR WIDESCREEN MISSION PASSED / HEIST COMPLETE STAMP */}
      {stampBanner && (
        <div className="fixed inset-x-0 top-20 z-30 flex justify-center pointer-events-none px-4 animate-stamp-in">
          <div
            className="w-full max-w-xl py-3 px-6 text-center"
            style={{
              background:
                'linear-gradient(90deg, rgba(7,10,16,0) 0%, rgba(9,12,18,0.92) 22%, rgba(9,12,18,0.92) 78%, rgba(7,10,16,0) 100%)',
            }}
          >
            <div className="font-display text-3xl md:text-4xl font-extrabold italic uppercase tracking-wider text-[#f59e0b] hud-stroke">
              {stampBanner.includes('HEIST')
                ? 'Grand Heist Tuntas'
                : stampBanner.includes('JUARA')
                ? 'Juara Sirkuit Jalanan'
                : 'Misi Tuntas'}
            </div>
            <p className="text-xs md:text-sm font-medium text-[#f4f1ea] mt-1 max-w-md mx-auto">
              {stampBanner}
            </p>
          </div>
        </div>
      )}

      {/* GTA V 3-STAGE SATELLITE SKY-SWITCH OVERLAY */}
      {skySwitchPhase?.active && (
        <div
          className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-20"
          style={{
            background:
              'radial-gradient(circle, rgba(14,116,144,0.12) 0%, rgba(7,10,16,0.75) 100%)',
          }}
        >
          <div className="px-8 py-5 rounded-xl aaa-glass text-center shadow-2xl animate-stamp-in">
            <div className="text-xs font-mono-num font-semibold uppercase tracking-[0.22em] text-[#38bdf8]">
              Satelit Orbit Jakarta · Tahap {skySwitchPhase.stage} / 3
            </div>
            <div className="font-display text-3xl font-extrabold italic uppercase text-[#f4f1ea] mt-1 tracking-wide">
              {PROTAGONIST_PROFILES[skySwitchPhase.targetId].name}
            </div>
            <div className="text-xs text-[#94a3b8] mt-0.5">
              {PROTAGONIST_PROFILES[skySwitchPhase.targetId].homeDistrictName}
            </div>
          </div>
        </div>
      )}

      {/* OVER-THE-SHOULDER TPS PRECISION RETICLE */}
      {tpsAiming && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-10">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] shadow-[0_0_8px_#ef4444]" />
            <span className="absolute top-0 w-0.5 h-2.5 bg-[#f4f1ea]/90" />
            <span className="absolute bottom-0 w-0.5 h-2.5 bg-[#f4f1ea]/90" />
            <span className="absolute left-0 h-0.5 w-2.5 bg-[#f4f1ea]/90" />
            <span className="absolute right-0 h-0.5 w-2.5 bg-[#f4f1ea]/90" />
          </div>
        </div>
      )}

      {/* RADIO FM TUNER BANNER */}
      {radioToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-aaa-up">
          <div className="aaa-glass-subtle px-4 py-2 rounded-xl border border-[#f59e0b]/40 flex items-center gap-3 shadow-xl">
            <span className="w-2 h-2 rounded-full bg-[#f59e0b] animate-pulse" />
            <div>
              <div className="font-display text-sm font-bold uppercase tracking-wider text-[#f4f1ea]">
                {radioToast.name} ·{' '}
                <span className="text-[#f59e0b] font-mono-num">
                  {radioToast.freq}
                </span>
              </div>
              <div className="text-[10px] text-[#94a3b8]">{radioToast.genre}</div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TOP ROW ==================== */}
      {zenHudMode ? (
        <div className="flex items-start justify-end">
          <button
            type="button"
            onClick={() => gameStore.setState({ zenHudMode: false })}
            className="pointer-events-auto px-3 py-1.5 rounded-lg aaa-glass-subtle hover:bg-white/15 text-xs font-mono-num text-[#cbd5e1] hover:text-white cursor-pointer"
          >
            [U] Tampilkan HUD
          </button>
        </div>
      ) : (
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        {/* TOP-LEFT: Frameless Active Objective OR Transient District Reveal */}
        <div className="flex flex-col gap-2 flex-1 max-w-sm min-w-0">
          {activeMission && activeChoice ? (
            <div className="aaa-glass-subtle rounded-lg px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-lg pointer-events-auto animate-aaa-up">
              <div className="flex items-center justify-between gap-2 sm:gap-3">
                <span className="text-xs font-semibold text-[#f59e0b] truncate">
                  {activeMission.title}
                </span>
                <span className="font-mono-num text-xs font-bold text-[#22c55e] whitespace-nowrap shrink-0">
                  {objectiveProgress}/{activeChoice.objectiveTargetCount}
                </span>
              </div>
              <p className="text-xs text-[#e2e8f0] mt-0.5 leading-snug line-clamp-2">
                {activeChoice.description}
              </p>
              <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-[#f59e0b] transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      (objectiveProgress /
                        Math.max(1, activeChoice.objectiveTargetCount)) *
                        100
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="aaa-glass-subtle rounded-lg border-l-2 border-l-[#f59e0b] px-2.5 py-1.5 sm:px-3.5 sm:py-2 flex flex-col gap-0.5 shadow-xl min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-[#e2e8f0] hud-stroke-sm min-w-0">
                <span className="font-display text-sm sm:text-base md:text-lg font-bold uppercase tracking-wide text-[#f4f1ea] truncate">
                  {district.name}
                </span>
                <span aria-hidden="true" className="text-[#f59e0b] shrink-0">
                  ·
                </span>
                <span className="font-mono-num text-[11px] font-bold text-[#fef08a] whitespace-nowrap shrink-0">
                  {formatJakartaClock(worldTimeMinutes)}
                </span>
                <span aria-hidden="true" className="hidden sm:inline text-[#f59e0b] shrink-0">
                  ·
                </span>
                <span className="hidden sm:inline text-[#cbd5e1] whitespace-nowrap">
                  {weatherSpec.label}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] font-mono-num text-[#94a3b8] hud-stroke-sm flex items-center gap-1.5 flex-wrap">
                <span>
                  Babak {playerState.completedMissions.length}/15 · Heist{' '}
                  {playerState.completedHeists.length}/3
                  {playerState.currentInterior !== 'exterior' && ' · Interior'}
                </span>
                {playerState.staminaBuffTimer > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[#64748b]">·</span>
                    <span className="text-[#34d399] font-bold">
                      Stamina +{Math.ceil(playerState.staminaBuffTimer)}d
                    </span>
                  </>
                )}
                {ambientCueLabel && !muted && playerState.currentInterior === 'exterior' && (
                  <>
                    <span aria-hidden="true" className="hidden sm:inline text-[#64748b]">·</span>
                    <span className="hidden sm:inline text-[#38bdf8] font-sans font-medium">
                      {ambientCueLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Active Open-World Street Contract (Kurir Ojol Kilat / Konvoi Lapis Baja / Rebut Teritori) */}
          {activeContract && (
            <div className="aaa-glass-subtle rounded-lg border-l-2 border-l-[#22c55e] px-3 py-2 flex flex-col gap-1 pointer-events-auto animate-aaa-up max-w-xs">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-[#22c55e] truncate">
                  {activeContract.title}
                </span>
                <span className="font-mono-num font-extrabold text-[#fef08a] shrink-0">
                  {activeContract.timeRemainingSec}d
                </span>
              </div>
              <div className="text-[11px] text-[#cbd5e1] truncate">
                {activeContract.subtitle} · +{formatRupiah(activeContract.rewardRp)}
              </div>
            </div>
          )}

          {/* World Clock Ticker Event: Traffic Jam / Road Construction & Detour Tracker */}
          {activeRoadEvent && (
            <div
              data-testid="world-clock-road-event-banner"
              className={`aaa-glass-subtle rounded-lg border-l-2 ${
                activeRoadEvent.spec.kind === 'road_construction'
                  ? 'border-l-[#f97316]'
                  : 'border-l-[#ef4444]'
              } px-3 py-2 flex flex-col gap-1 pointer-events-auto animate-aaa-up max-w-xs shadow-lg`}
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <svg
                    viewBox="0 0 24 24"
                    className={`w-3.5 h-3.5 shrink-0 ${
                      activeRoadEvent.spec.kind === 'road_construction'
                        ? 'text-[#f97316]'
                        : 'text-[#ef4444]'
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <span
                    className={`font-bold truncate ${
                      activeRoadEvent.spec.kind === 'road_construction'
                        ? 'text-[#fb923c]'
                        : 'text-[#f87171]'
                    }`}
                  >
                    {activeRoadEvent.spec.kind === 'road_construction'
                      ? 'PROYEK JALAN'
                      : 'MACET MENDADAK'}
                  </span>
                </div>
                <span className="font-mono-num text-[11px] font-bold text-[#fef08a] shrink-0">
                  {Math.ceil(activeRoadEvent.remainingSec)}d
                </span>
              </div>
              <div className="text-xs font-semibold text-[#f4f1ea] truncate">
                {activeRoadEvent.spec.title}
              </div>
              <div className="text-[11px] text-[#38bdf8] truncate">
                Jalur Alternatif: {activeRoadEvent.spec.detourLabel}
                {!activeRoadEvent.detourCompleted &&
                  ` (${Math.min(
                    activeRoadEvent.detourStageIndex + 1,
                    activeRoadEvent.spec.detourWaypoints.length
                  )}/${activeRoadEvent.spec.detourWaypoints.length})`}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="activate-road-event-detour-btn"
                  onClick={() => gameStore.activateRoadEventDetourGps()}
                  className="flex-1 py-1 px-2 rounded bg-[#38bdf8]/20 hover:bg-[#38bdf8] text-[#38bdf8] hover:text-[#090c12] text-[10px] font-mono-num font-bold cursor-pointer transition-colors truncate"
                >
                  {activeRoadEvent.detourCompleted
                    ? 'Rute Alternatif Tuntas ✓'
                    : 'Pasang GPS Rute Alternatif'}
                </button>
                <button
                  type="button"
                  data-testid="trigger-next-road-event-btn"
                  onClick={() => gameStore.triggerNextWorldRoadEvent()}
                  title="Simulasi Insiden Jam Dunia Berikutnya"
                  className="py-1 px-2 rounded bg-white/8 hover:bg-white/15 text-[#cbd5e1] hover:text-white text-[10px] font-mono-num cursor-pointer transition-colors shrink-0"
                >
                  Berikutnya
                </button>
              </div>
            </div>
          )}

          {/* Custom GPS Waypoint Tracker Pill */}
          {customWaypoint && waypointDistanceM !== null && (
            <div
              data-testid="custom-gps-waypoint-pill"
              className={`aaa-glass-subtle rounded-lg border-l-2 ${
                customWaypoint.category === 'detour'
                  ? 'border-l-[#38bdf8]'
                  : 'border-l-[#c084fc]'
              } px-3 py-1.5 flex items-center justify-between gap-2 pointer-events-auto animate-aaa-up max-w-xs`}
            >
              <div className="min-w-0 flex items-center gap-2 text-xs">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    customWaypoint.category === 'detour'
                      ? 'bg-[#38bdf8]'
                      : 'bg-[#c084fc]'
                  }`}
                />
                <span className="font-semibold text-[#f4f1ea] truncate">
                  {customWaypoint.label}
                </span>
                <span
                  className={`font-mono-num font-bold shrink-0 ${
                    customWaypoint.category === 'detour'
                      ? 'text-[#38bdf8]'
                      : 'text-[#c084fc]'
                  }`}
                >
                  {waypointDistanceM}m
                </span>
              </div>
              <button
                type="button"
                onClick={() => gameStore.setCustomWaypoint(null)}
                title="Hapus Waypoint GPS"
                className="text-xs font-mono-num text-[#94a3b8] hover:text-white px-1 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}

          {/* Transient District Toast when moving across Jakarta */}
          {districtToast && activeMission && (
            <div className="animate-aaa-up aaa-glass-subtle rounded-lg px-3 py-1.5 border-l-2 border-l-[#38bdf8]">
              <div className="font-display text-xl font-extrabold italic uppercase tracking-wide text-[#f4f1ea] hud-stroke">
                {district.name}
              </div>
              <div className="text-xs text-[#cbd5e1] hud-stroke-sm">
                {district.subtitle}
              </div>
            </div>
          )}
        </div>

        {/* TOP-RIGHT: GTA V Wanted Stars + Cash + Weapon + Discreet Corner Icons */}
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto shrink-0">
          <div className="aaa-glass-subtle rounded-lg px-3.5 py-2 flex flex-col items-end gap-1 shadow-xl border-r-2 border-r-[#22c55e]/70">
            {/* Row 1: Wanted Stars + Cash */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {playerState.wantedLevel > 0 &&
                  playerState.wantedEvadeTimer > 0 && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono-num font-bold bg-[#0a0d14]/90 text-[#38bdf8] border border-[#38bdf8]/40 whitespace-nowrap">
                      Lolos {Math.ceil(playerState.wantedEvadeTimer)}d
                    </span>
                  )}
                <div
                  className="flex items-center gap-0.5"
                  aria-label={`Tingkat Buronan Polisi ${playerState.wantedLevel} dari 5`}
                >
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= playerState.wantedLevel;
                    return (
                      <span
                        key={star}
                        className={`text-base leading-none ${
                          active
                            ? 'wanted-siren-star'
                            : 'text-white/25 hud-stroke-sm'
                        }`}
                      >
                        ★
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col items-end">
                <div className="flex items-baseline gap-2">
                  {passiveIncome > 0 && (
                    <span className="text-[11px] font-mono-num font-semibold text-[#38bdf8] hud-stroke-sm whitespace-nowrap">
                      +{formatRupiah(passiveIncome)}
                    </span>
                  )}
                  <span className="font-display text-base sm:text-xl md:text-2xl font-extrabold text-[#22c55e] hud-stroke tracking-tight whitespace-nowrap font-mono-num">
                    {formatRupiah(playerState.rupiah)}
                  </span>
                </div>

                {cashDelta !== null && (
                  <div
                    className={`font-mono-num text-xs font-bold hud-stroke-sm whitespace-nowrap ${
                      cashDelta >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'
                    }`}
                  >
                    {cashDelta >= 0
                      ? `+${formatRupiah(cashDelta)}`
                      : `-${formatRupiah(Math.abs(cashDelta))}`}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Active Weapon Readout (click opens Weapon Wheel) */}
            <button
              type="button"
              onClick={onOpenWeaponWheel}
              title="Buka Roda Senjata [Y]"
              className="flex items-center gap-2.5 pt-1 border-t border-white/10 w-full justify-end text-right cursor-pointer group"
            >
              <div className="text-[#f4f1ea] group-hover:text-[#f59e0b] transition-colors drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                <WeaponSilhouetteSvg
                  weaponId={playerState.activeWeapon}
                  className="w-10 h-4"
                />
              </div>
              <div className="flex flex-col items-end">
                <span className="font-display text-xs md:text-sm font-bold uppercase tracking-wide text-[#f4f1ea] group-hover:text-[#f59e0b] transition-colors hud-stroke-sm leading-none whitespace-nowrap">
                  {currentWeaponSpec.name}
                </span>
                <span className="font-mono-num text-[11px] font-semibold text-[#cbd5e1] hud-stroke-sm mt-0.5 whitespace-nowrap">
                  {currentWeaponSpec.isMelee
                    ? 'Jarak Dekat'
                    : `${playerState.ammo[playerState.activeWeapon] || 0} / ${
                        currentWeaponSpec.maxAmmo
                      }`}
                </span>
              </div>
            </button>
          </div>

          {/* Row 3: Discreet Corner Utility Icons (Photo Mode, Zen HUD, Phone & Pause Menu) */}
          <div className="flex items-center gap-1.5 mt-0.5">
            {gamepadActive && (
              <span
                title="Kontroler Gamepad Terhubung"
                className="px-2 py-1 rounded-md aaa-glass-subtle text-[10px] font-mono-num text-[#22c55e] hidden sm:inline-flex items-center gap-1"
              >
                PAD
              </span>
            )}
            {onOpenPhotoMode && (
              <button
                type="button"
                onClick={onOpenPhotoMode}
                title="Studio Kamera Sinematik / Photo Mode [N]"
                className="px-2 py-1 rounded-md aaa-glass-subtle hover:bg-white/15 text-xs font-medium text-[#e2e8f0] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-3.5 h-3.5 text-[#c084fc]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
                <span className="hidden sm:inline font-mono-num text-[11px]">N</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => gameStore.togglePerfOverlay()}
              data-testid="toggle-perf-overlay-btn"
              title="Overlay Telemetri 60FPS, Rapier3D & Co-Op Multiplayer [F3]"
              className={`px-2 py-1 rounded-md aaa-glass-subtle hover:bg-white/15 text-[11px] font-mono-num transition-colors cursor-pointer whitespace-nowrap ${
                perfOverlayOpen
                  ? 'text-[#22c55e] border border-[#22c55e]/50'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              [F3]
            </button>
            <button
              type="button"
              onClick={() => gameStore.setState({ zenHudMode: true })}
              title="Mode Layar Bersih / Zen HUD [U]"
              className="hidden sm:flex px-2 py-1 rounded-md aaa-glass-subtle hover:bg-white/15 text-[11px] font-mono-num text-[#94a3b8] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              [U]
            </button>
            <button
              type="button"
              onClick={onTogglePhone}
              title="Buka iFruit Phone [Tab]"
              className="px-2.5 py-1 rounded-md aaa-glass-subtle hover:bg-white/15 text-xs font-medium text-[#e2e8f0] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 text-[#38bdf8]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="6" y="2" width="12" height="20" rx="2.5" />
                <line x1="10" y1="18" x2="14" y2="18" />
              </svg>
              <span className="font-mono-num text-[11px]">Tab</span>
            </button>
            <button
              type="button"
              onClick={onPause}
              title="Menu Jeda & Peta Interaktif [Esc / P]"
              className="px-2.5 py-1 rounded-md aaa-glass-subtle hover:bg-white/15 text-xs font-medium text-[#e2e8f0] transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
            >
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 text-[#f59e0b]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
              <span className="font-mono-num text-[11px]">Esc</span>
            </button>
          </div>

          {/* Phase 4: 60FPS Engine, Rapier3D Physics, Co-Op WS & Cloud Save v3 Telemetry Overlay [F3] */}
          {perfOverlayOpen && (
            <div
              data-testid="engine-perf-overlay"
              className="aaa-glass-subtle rounded-lg border border-[#38bdf8]/40 px-3 py-2 mt-1 w-64 text-[11px] font-mono-num text-[#e2e8f0] shadow-2xl animate-aaa-up"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-1 mb-1.5">
                <span className="font-bold text-[#38bdf8] uppercase tracking-wider">
                  GPU Engine · Rapier3D
                </span>
                <span className="text-[#22c55e] font-bold">
                  {perfSnap.fps} FPS
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Draw Calls:</span>
                  <span className="font-bold text-[#f4f1ea]">
                    {perfSnap.drawCalls}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">RigidBodies:</span>
                  <span className="font-bold text-[#f59e0b]">
                    {perfSnap.activeRigidBodies}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">WS Ping:</span>
                  <span className="font-bold text-[#38bdf8]">
                    {perfSnap.networkPingMs} ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#94a3b8]">Co-Op Lobby:</span>
                  <span className="font-bold text-[#22c55e]">
                    {perfSnap.connectedPeers + 1}/8
                  </span>
                </div>
              </div>
              <div className="mt-1.5 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] text-[#94a3b8]">
                <span>
                  LOD 3-Tier · Worker:{' '}
                  <strong className="text-[#22c55e]">
                    {perfSnap.simWorkerActive ? 'ON' : 'SYNC'}
                  </strong>
                </span>
                <span className="text-[#fef08a]">
                  {cloudSyncStatus || `Slot ${activeSaveSlot} v3`}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ==================== BOTTOM ROW ==================== */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4">
        {/* Mobile: Contextual prompt sits cleanly above Radar + Ability bar */}
        {primaryPrompt && (
          <div className="flex sm:hidden items-center justify-center pointer-events-auto">
            <button
              type="button"
              onClick={primaryPrompt.onClick}
              className="aaa-glass hover:bg-white/10 px-3 py-1.5 rounded-lg shadow-xl flex items-center gap-2 cursor-pointer transition-colors max-w-full"
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center font-mono-num text-[11px] font-bold text-[#090c12] shrink-0"
                style={{ backgroundColor: primaryPrompt.accent }}
              >
                {primaryPrompt.keycap}
              </span>
              <span className="text-xs font-semibold text-[#f4f1ea] truncate">
                {primaryPrompt.label}
              </span>
            </button>
          </div>
        )}

        <div className="flex items-end justify-between gap-2 sm:contents">
          {/* BOTTOM-LEFT: Iconic GTA V Frameless Minimap + Integrated Tri-Bar (Zero Clutter) */}
          <div className="pointer-events-auto shrink-0">
            <div className="relative bg-[#070a10] border-2 border-[#0d111a] shadow-[0_10px_28px_rgba(0,0,0,0.85)] overflow-hidden rounded-sm">
              {/* Live Standalone Minimap (20fps isolated from React reconciler) */}
              <MiniMapRadar onClickRadar={onPause} />

              {/* GTA V Signature Integrated Tri-Bar (50% HP | 25% Armor | 25% Special) */}
              <div className="w-full h-2 bg-[#05070b] flex items-center gap-[2px] pt-[2px]">
                <div className="relative w-1/2 h-full bg-[#1e293b]/80 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#f87171]/60 transition-all duration-300"
                    style={{ width: `${Math.max(0, Math.min(100, ghostHp))}%` }}
                  />
                  <div
                    className={`relative h-full transition-all duration-150 ${
                      lowHp ? 'bg-[#ef4444]' : 'bg-[#22c55e]'
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, playerState.hp))}%`,
                    }}
                  />
                </div>

                <div className="w-1/4 h-full bg-[#1e293b]/80 overflow-hidden">
                  <div
                    className="h-full bg-[#38bdf8] transition-all duration-150"
                    style={{
                      width: `${Math.max(0, Math.min(100, playerState.armor))}%`,
                    }}
                  />
                </div>

                <div className="w-1/4 h-full bg-[#1e293b]/80 overflow-hidden">
                  <div
                    className="h-full bg-[#facc15] transition-all duration-150"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(100, playerState.fokusEnergy)
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM-CENTER (Desktop): Single Clean Contextual Interaction Prompt */}
          <div className="hidden sm:flex flex-col items-center justify-end pointer-events-auto min-w-0 max-w-md mx-auto pb-1">
            {primaryPrompt && (
              <button
                type="button"
                onClick={primaryPrompt.onClick}
                className="aaa-glass hover:bg-white/10 px-3.5 py-2 rounded-lg shadow-xl flex items-center gap-2.5 cursor-pointer transition-colors animate-aaa-up"
              >
                <span
                  className="w-6 h-6 rounded flex items-center justify-center font-mono-num text-xs font-bold text-[#090c12] shrink-0"
                  style={{ backgroundColor: primaryPrompt.accent }}
                >
                  {primaryPrompt.keycap}
                </span>
                <span className="text-xs md:text-sm font-semibold text-[#f4f1ea] whitespace-nowrap truncate">
                  {primaryPrompt.label}
                </span>
              </button>
            )}
          </div>

          {/* BOTTOM-RIGHT: Sleek Driving Speedometer Arc + Minimal Character/Ability Dock */}
          <div className="flex flex-col items-end gap-2 pointer-events-auto min-w-0 sm:shrink-0">
          {drivingVehicle && vehicleSpec && (
            <div className="flex items-center gap-2.5 sm:gap-3 aaa-glass-subtle px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl shadow-xl animate-aaa-up">
              <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                <svg
                  viewBox="0 0 100 100"
                  className="w-full h-full -rotate-[212deg]"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={arcRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="7"
                    strokeDasharray={`${maxDash} ${arcCircumference}`}
                    strokeLinecap="round"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r={arcRadius}
                    fill="none"
                    stroke={
                      playerState.fokusActive
                        ? '#38bdf8'
                        : rpmRatio > 0.82
                        ? '#ef4444'
                        : '#f59e0b'
                    }
                    strokeWidth="7"
                    strokeDasharray={`${currentDash} ${arcCircumference}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="font-mono-num text-sm sm:text-base font-extrabold text-[#f4f1ea] leading-none">
                    {Math.round(vehicleSpeedKmh)}
                  </span>
                  <span className="text-[8px] font-mono-num text-[#94a3b8]">
                    {gearNumber === 'VTOL'
                      ? 'VTOL'
                      : gearNumber === 'N'
                      ? 'N'
                      : `G${gearNumber}`}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end text-right">
                <div className="flex items-center gap-1.5">
                  {(isDrifting || driftScore > 0) && (
                    <span className="px-1.5 py-0.5 rounded bg-[#f59e0b] text-[#090c12] font-mono-num text-[10px] font-extrabold tracking-wider">
                      DRIFT {driftScore > 0 ? `${driftScore} · x${driftMultiplier}` : ''}
                    </span>
                  )}
                  <span className="font-display text-sm sm:text-base font-bold uppercase text-[#f4f1ea] leading-none whitespace-nowrap">
                    {vehicleSpec.name}
                  </span>
                </div>
                <span className="text-[10px] font-mono-num text-[#94a3b8] mt-1 whitespace-nowrap">
                  {vehicleSpec.isAircraft
                    ? `Alt ${Math.round(aircraftAltitude)} m`
                    : `${activeRadioSpec.id === 'off' ? 'Radio Off' : activeRadioSpec.freq} · Turbo Lv.${playerState.vehicleUpgradeLevel}`}
                </span>
                <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 text-[10px] sm:text-[11px] font-mono-num">
                  <button
                    type="button"
                    onClick={() => gameStore.cycleRadioStation()}
                    title="Ganti Stasiun Radio FM Jakarta [R]"
                    className="text-[#38bdf8] hover:text-[#7dd3fc] cursor-pointer transition-colors"
                  >
                    [R]<span className="hidden sm:inline"> Radio</span>
                  </button>
                  <span className="text-white/20">·</span>
                  {onHonk && (
                    <>
                      <button
                        type="button"
                        onClick={onHonk}
                        title="Bunyikan Klakson untuk reaksi Ojol/Angkot [K]"
                        className="text-[#facc15] hover:text-[#fef08a] cursor-pointer transition-colors"
                      >
                        [K]<span className="hidden sm:inline"> Klakson</span>
                      </button>
                      <span className="text-white/20">·</span>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={onToggleFokus}
                    className={`cursor-pointer transition-colors ${
                      playerState.fokusActive
                        ? 'text-[#38bdf8] font-bold'
                        : 'text-[#cbd5e1] hover:text-white'
                    }`}
                  >
                    [Q]<span className="hidden sm:inline"> Nitro</span>
                  </button>
                  <span className="text-white/20">·</span>
                  <button
                    type="button"
                    onClick={onOpenCustomsGarage}
                    className="text-[#c084fc] hover:text-[#e9d5ff] cursor-pointer transition-colors"
                  >
                    [B]<span className="hidden sm:inline"> Bengkel</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Compact Protagonist & Tactical Ability Strip */}
          <div className="flex items-center gap-1 sm:gap-2 aaa-glass-subtle px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg max-w-full">
            <button
              type="button"
              onClick={onToggleFokus}
              title={`Aktifkan ${activeProtagonistProf.specialAbilityName} [Q]`}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                playerState.fokusActive
                  ? 'bg-[#facc15] text-[#090c12]'
                  : 'text-[#fef08a] hover:bg-white/10'
              }`}
            >
              [Q]<span className="hidden sm:inline"> Fokus</span>
            </button>

            <button
              type="button"
              onClick={onToggleDrone}
              title="Aktifkan/Matikan Drone Rajawali [Z]"
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                playerState.droneActive
                  ? 'bg-[#38bdf8]/20 text-[#38bdf8]'
                  : 'text-[#94a3b8] hover:bg-white/10'
              }`}
            >
              [Z]<span className="hidden sm:inline"> Drone</span>
            </button>

            <button
              type="button"
              onClick={onOpenWarung}
              title="Masuk Warung Kopi & Jajanan Nusantara [J]"
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-mono-num font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                playerState.currentInterior === 'warung' ||
                playerState.staminaBuffTimer > 0
                  ? 'bg-[#10b981]/25 text-[#34d399]'
                  : 'text-[#34d399] hover:bg-white/10'
              }`}
            >
              [J]<span className="hidden sm:inline"> Warung</span>
              {playerState.staminaBuffTimer > 0 && (
                <span className="ml-1 text-[#fde047]">
                  +{Math.ceil(playerState.staminaBuffTimer)}d
                </span>
              )}
            </button>

            <div className="h-3.5 w-[1px] bg-white/15 shrink-0" />

            <button
              type="button"
              onClick={onOpenCharacterWheel}
              title="Buka Roda 3 Protagonis [C]"
              className="flex items-center gap-1.5 px-1.5 sm:px-2 py-0.5 rounded hover:bg-white/10 cursor-pointer transition-colors whitespace-nowrap"
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeProtagonistProf.colorHex }}
              />
              <span className="font-display text-xs sm:text-sm font-bold uppercase tracking-wide text-[#f4f1ea]">
                {activeProtagonistProf.name.split(' ')[0]}
              </span>
              <span className="hidden sm:inline font-mono-num text-[10px] text-[#94a3b8]">
                [C]
              </span>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
};

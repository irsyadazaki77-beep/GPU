import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CITY_BUILDINGS,
  ENTERABLE_INTERIORS,
  GRAND_HEISTS,
  JAKARTA_DISTRICTS,
  PROTAGONIST_PROFILES,
  ProtagonistId,
  STORY_MISSIONS,
  STREET_RACES,
  applyTurfWarStockShock,
  calculateTurfWarsIncome,
  captureDistrictTurf,
  formatJakartaClock,
  formatRupiah,
  fortifyDistrictTurf,
  generateRoadsideSpawnLayout,
  resolveWeatherFromWorldClock,
} from '../game/rules';
import { soundEngine } from '../game/sound';
import type {
  CustomWaypointState,
  PlayerProgressState,
  StoryMission,
  WaypointCategory,
} from '../game/types';
import {
  STREET_BOUNTIES,
  engineTelemetryRef,
  gameStore,
  useGameStore,
} from '../state/gameStore';

export type MapFilterCategory =
  | 'all'
  | 'misi'
  | 'heist_balap'
  | 'properti_transit'
  | 'bounty';

interface MapPoiItem {
  id: string;
  label: string;
  subtitle: string;
  x: number;
  z: number;
  category: WaypointCategory;
  filterGroup: Exclude<MapFilterCategory, 'all'>;
  color: string;
  badge: string;
  rewardText?: string;
  districtId?: string;
  missionRef?: StoryMission;
}

interface InteractiveWorldMapProps {
  playerState: PlayerProgressState;
  onFastTravel?: (districtId: string) => void;
  onTeleportCoords?: (x: number, z: number, label: string) => void;
  onTriggerMissionDialog?: (mission: StoryMission) => void;
  onResumeGame?: () => void;
}

const CANVAS_W = 640;
const CANVAS_H = 420;

export const InteractiveWorldMap: React.FC<InteractiveWorldMapProps> = ({
  playerState,
  onFastTravel,
  onTeleportCoords,
  onTriggerMissionDialog,
  onResumeGame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const customWaypoint = useGameStore((s) => s.customWaypoint);
  const claimedBounties = useGameStore((s) => s.claimedBounties);
  const worldTimeMinutes = useGameStore((s) => s.worldTimeMinutes);
  const autoTimeCycle = useGameStore((s) => s.autoTimeCycle);
  const worldClockEventState = useGameStore((s) => s.worldClockEventState);
  const activeRoadEvent = worldClockEventState.activeEvent;

  const [filter, setFilter] = useState<MapFilterCategory>('all');
  const [zoom, setZoom] = useState<number>(1.35);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [selectedPoi, setSelectedPoi] = useState<MapPoiItem | null>(null);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0, moved: 0 });

  const staticLayout = useMemo(() => generateRoadsideSpawnLayout(), []);

  // Build unified POI catalog across Jakarta
  const poiItems = useMemo<MapPoiItem[]>(() => {
    const list: MapPoiItem[] = [];

    // 1. Districts
    for (const d of JAKARTA_DISTRICTS) {
      list.push({
        id: `dist_${d.id}`,
        label: d.name,
        subtitle: d.subtitle,
        x: d.centerX,
        z: d.centerZ,
        category: 'district',
        filterGroup: 'properti_transit',
        color: '#38bdf8',
        badge: 'D',
        districtId: d.id,
      });
    }

    // 2. Next uncompleted story missions (up to 4 visible on map)
    const uncompleted = STORY_MISSIONS.filter(
      (m) => !playerState.completedMissions.includes(m.id)
    ).slice(0, 4);
    for (const m of uncompleted) {
      list.push({
        id: `mission_${m.id}`,
        label: m.title,
        subtitle: `${m.giverName} · ${m.locationName}`,
        x: m.markerX,
        z: m.markerZ,
        category: 'mission',
        filterGroup: 'misi',
        color: '#f59e0b',
        badge: 'M',
        missionRef: m,
      });
    }

    // 3. Grand Heists
    for (const h of GRAND_HEISTS) {
      const done = playerState.completedHeists.includes(h.id);
      list.push({
        id: `heist_${h.id}`,
        label: h.title,
        subtitle: h.targetLocation,
        x: h.vaultX,
        z: h.vaultZ,
        category: 'heist',
        filterGroup: 'heist_balap',
        color: done ? '#22c55e' : '#eab308',
        badge: '$',
        rewardText: formatRupiah(h.grossTakeRp),
      });
    }

    // 4. Street Races
    for (const r of STREET_RACES) {
      const pt = r.checkpoints[0] || [0, -26];
      list.push({
        id: `race_${r.id}`,
        label: r.name,
        subtitle: r.subtitle,
        x: pt[0],
        z: pt[1],
        category: 'race',
        filterGroup: 'heist_balap',
        color: '#f97316',
        badge: 'R',
        rewardText: formatRupiah(r.rewardRp),
      });
    }

    // 5. Enterable Interiors & Properties
    for (const inter of ENTERABLE_INTERIORS) {
      list.push({
        id: `int_${inter.id}`,
        label: inter.name,
        subtitle: `${inter.subtitle} · ${inter.districtName}`,
        x: inter.portalX,
        z: inter.portalZ,
        category: 'property',
        filterGroup: 'properti_transit',
        color: '#a855f7',
        badge: 'G',
      });
    }

    // 6. Street Bounties
    for (const b of STREET_BOUNTIES) {
      const claimed = claimedBounties.includes(b.id);
      if (claimed) continue;
      list.push({
        id: `bounty_${b.id}`,
        label: b.title,
        subtitle: `${b.targetName} · ${b.districtName}`,
        x: b.x,
        z: b.z,
        category: 'bounty',
        filterGroup: 'bounty',
        color: '#ef4444',
        badge: '!',
        rewardText: formatRupiah(b.rewardRp),
      });
    }

    return list;
  }, [
    playerState.completedMissions,
    playerState.completedHeists,
    claimedBounties,
  ]);

  const visiblePois = useMemo(
    () =>
      filter === 'all'
        ? poiItems
        : poiItems.filter((p) => p.filterGroup === filter),
    [poiItems, filter]
  );

  // Convert world (x,z) to canvas pixel coordinates
  const worldToCanvas = (wx: number, wz: number) => {
    const scale = 2.05 * zoom;
    return {
      cx: CANVAS_W / 2 + pan.x + wx * scale,
      cy: CANVAS_H / 2 + pan.y + wz * scale,
    };
  };

  // Convert canvas pixel coordinates to world (x,z)
  const canvasToWorld = (cx: number, cy: number) => {
    const scale = 2.05 * zoom;
    const wx = Math.round(
      Math.max(-86, Math.min(86, (cx - CANVAS_W / 2 - pan.x) / scale))
    );
    const wz = Math.round(
      Math.max(-86, Math.min(86, (cy - CANVAS_H / 2 - pan.y) / scale))
    );
    return { wx, wz };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const renderMap = () => {
      const { playerX, playerZ, playerFacing, vehicles } = engineTelemetryRef;
      const scale = 2.05 * zoom;
      const originX = CANVAS_W / 2 + pan.x;
      const originY = CANVAS_H / 2 + pan.y;

      // 1. Tactical Dark Ocean & City Base
      ctx.fillStyle = '#060911';
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // 2. Subtle Coordinate Grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      const stepPx = Math.max(20, Math.round(16 * scale));
      for (let gx = originX % stepPx; gx < CANVAS_W; gx += stepPx) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, CANVAS_H);
        ctx.stroke();
      }
      for (let gy = originY % stepPx; gy < CANVAS_H; gy += stepPx) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(CANVAS_W, gy);
        ctx.stroke();
      }

      // 3. District Territory Rings & Turf Wars Ownership Colors
      for (const dist of JAKARTA_DISTRICTS) {
        const dx = originX + dist.centerX * scale;
        const dz = originY + dist.centerZ * scale;
        const turf = playerState.districtTurf?.[dist.id];
        const owner = turf?.owner || 'neutral';
        ctx.fillStyle =
          owner === 'player'
            ? 'rgba(34, 197, 94, 0.11)'
            : owner === 'syndicate'
            ? 'rgba(239, 68, 68, 0.11)'
            : 'rgba(56, 189, 248, 0.05)';
        ctx.strokeStyle =
          owner === 'player'
            ? 'rgba(34, 197, 94, 0.48)'
            : owner === 'syndicate'
            ? 'rgba(239, 68, 68, 0.45)'
            : 'rgba(148, 163, 184, 0.22)';
        ctx.lineWidth = owner === 'neutral' ? 1 : 1.6;
        ctx.beginPath();
        ctx.arc(dx, dz, dist.radius * 0.72 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 4. Arterial Road Network & Ring Road
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = Math.max(6, 7.5 * zoom);
      ctx.strokeRect(
        originX - 32 * scale,
        originY - 32 * scale,
        64 * scale,
        64 * scale
      );
      ctx.beginPath();
      ctx.moveTo(originX, originY - 90 * scale);
      ctx.lineTo(originX, originY + 90 * scale);
      ctx.moveTo(originX - 90 * scale, originY);
      ctx.lineTo(originX + 90 * scale, originY);
      ctx.stroke();

      // Elevated Toll Road (Tol Layang)
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
      ctx.lineWidth = Math.max(2.5, 3.2 * zoom);
      ctx.beginPath();
      ctx.moveTo(originX - 90 * scale, originY + 24 * scale);
      ctx.lineTo(originX + 90 * scale, originY + 24 * scale);
      ctx.stroke();

      // Monas Central Plaza
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(originX, originY, 14 * scale, 0, Math.PI * 2);
      ctx.fill();

      // 5. City Buildings Footprints
      ctx.fillStyle = '#334155';
      for (const b of CITY_BUILDINGS) {
        const bx = originX + b.x * scale;
        const bz = originY + b.z * scale;
        ctx.fillRect(
          bx - (b.width * scale) / 2,
          bz - (b.depth * scale) / 2,
          b.width * scale,
          b.depth * scale
        );
      }

      // 6. TransJakarta Haltes ("T")
      if (filter === 'all' || filter === 'properti_transit') {
        for (const halte of staticLayout.transJakartaHaltes) {
          const hx = originX + halte.x * scale;
          const hz = originY + halte.z * scale;
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(hx - 4, hz - 4, 8, 8);
        }
      }

      // 7. Live Traffic Vehicles
      for (const v of vehicles) {
        const vx = originX + v.x * scale;
        const vz = originY + v.z * scale;
        ctx.fillStyle =
          v.type === 'polisi'
            ? '#ef4444'
            : v.type === 'transjakarta'
            ? '#38bdf8'
            : 'rgba(203, 213, 225, 0.55)';
        ctx.fillRect(vx - 2, vz - 2, 4, 4);
      }

      // 8. Filtered POI Icons
      for (const poi of visiblePois) {
        const px = originX + poi.x * scale;
        const pz = originY + poi.z * scale;
        const isSelected = selectedPoi?.id === poi.id;

        if (isSelected) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, pz, 10, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = poi.color;
        ctx.beginPath();
        ctx.arc(px, pz, poi.category === 'district' ? 5.5 : 6.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#090c12';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(poi.badge, px, pz + 0.5);

        if (poi.category === 'district' && zoom >= 1.15) {
          ctx.fillStyle = '#e2e8f0';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText(poi.label, px, pz - 10);
        }
      }

      // 9. Inactive Protagonists
      for (const pId of ['nabilo', 'raka', 'kirana'] as ProtagonistId[]) {
        if (pId === playerState.activeProtagonist) continue;
        const pLive = playerState.protagonistRoster[pId];
        const rx = originX + pLive.x * scale;
        const rz = originY + pLive.z * scale;
        ctx.fillStyle = PROTAGONIST_PROFILES[pId].colorHex;
        ctx.beginPath();
        ctx.arc(rx, rz, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 10. Custom GPS Waypoint Line & Pin + Active Road Event Hazard & Detour
      const pCanvasX = originX + playerX * scale;
      const pCanvasY = originY + playerZ * scale;

      if (activeRoadEvent) {
        const ev = activeRoadEvent.spec;
        const ex = originX + ev.x * scale;
        const ez = originY + ev.z * scale;
        const isConst = ev.kind === 'road_construction';

        if (ev.detourWaypoints.length > 0 && !activeRoadEvent.detourCompleted) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(pCanvasX, pCanvasY);
          for (
            let wi = activeRoadEvent.detourStageIndex;
            wi < ev.detourWaypoints.length;
            wi++
          ) {
            const pt = ev.detourWaypoints[wi];
            ctx.lineTo(originX + pt[0] * scale, originY + pt[1] * scale);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.fillStyle = isConst
          ? 'rgba(249, 115, 22, 0.24)'
          : 'rgba(239, 68, 68, 0.24)';
        ctx.strokeStyle = isConst ? '#f97316' : '#ef4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ex, ez, ev.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isConst ? '#f97316' : '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ez, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090c12';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', ex, ez + 0.5);
      }

      if (customWaypoint) {
        const wx = originX + customWaypoint.x * scale;
        const wz = originY + customWaypoint.z * scale;

        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(pCanvasX, pCanvasY);
        ctx.lineTo(wx, wz);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(wx, wz, 7.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.stroke();

        ctx.fillStyle = '#090c12';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('W', wx, wz + 0.5);
      }

      // 11. Active Player Heading Chevron
      ctx.save();
      ctx.translate(pCanvasX, pCanvasY);
      ctx.rotate(-playerFacing);
      ctx.fillStyle =
        PROTAGONIST_PROFILES[playerState.activeProtagonist].colorHex;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 3);
      ctx.lineTo(-6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      animId = window.requestAnimationFrame(renderMap);
    };

    animId = window.requestAnimationFrame(renderMap);
    return () => window.cancelAnimationFrame(animId);
  }, [
    zoom,
    pan,
    filter,
    visiblePois,
    selectedPoi,
    customWaypoint,
    activeRoadEvent,
    playerState.activeProtagonist,
    playerState.protagonistRoster,
    staticLayout,
  ]);

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: 0,
    };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current.moved += Math.abs(dx) + Math.abs(dy);
    setPan({
      x: Math.max(-240, Math.min(240, dragStartRef.current.panX + dx)),
      y: Math.max(-180, Math.min(180, dragStartRef.current.panY + dy)),
    });
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    // Treat as click if drag movement was minimal
    if (dragStartRef.current.moved < 10 && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
      const clickY = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

      // Check if user clicked on a POI icon
      let hitPoi: MapPoiItem | null = null;
      let bestDist = 14;
      for (const poi of visiblePois) {
        const { cx, cy } = worldToCanvas(poi.x, poi.z);
        const d = Math.hypot(clickX - cx, clickY - cy);
        if (d < bestDist) {
          bestDist = d;
          hitPoi = poi;
        }
      }

      if (hitPoi) {
        setSelectedPoi(hitPoi);
        const wp: CustomWaypointState = {
          x: hitPoi.x,
          z: hitPoi.z,
          label: hitPoi.label,
          category: hitPoi.category,
        };
        gameStore.setCustomWaypoint(wp);
      } else {
        const { wx, wz } = canvasToWorld(clickX, clickY);
        const wp: CustomWaypointState = {
          x: wx,
          z: wz,
          label: `Pin Koordinat (${wx}, ${wz})`,
          category: 'custom',
        };
        setSelectedPoi(null);
        gameStore.setCustomWaypoint(wp);
      }
    }
  };

  const distanceToWaypoint = customWaypoint
    ? Math.round(
        Math.hypot(
          engineTelemetryRef.playerX - customWaypoint.x,
          engineTelemetryRef.playerZ - customWaypoint.z
        )
      )
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* LEFT 8 COLS: Interactive 2D Tactical Radar Map Canvas */}
      <div className="lg:col-span-8 flex flex-col gap-3">
        {/* Filter & Zoom Control Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-white/5 p-1 rounded-lg">
            {(
              [
                { id: 'all', label: 'Semua Lokasi' },
                { id: 'misi', label: 'Misi Cerita' },
                { id: 'heist_balap', label: 'Heist & Balap' },
                { id: 'properti_transit', label: 'Distrik & Garasi' },
                { id: 'bounty', label: 'Bounty Jalanan' },
              ] as { id: MapFilterCategory; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-colors whitespace-nowrap ${
                  filter === f.id
                    ? 'bg-[#f59e0b] text-[#090c12] font-bold'
                    : 'text-[#cbd5e1] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.9, +(z - 0.25).toFixed(2)))}
              className="px-2.5 py-1 rounded bg-white/8 hover:bg-white/15 text-xs font-mono-num text-[#f4f1ea] cursor-pointer"
              title="Perkecil Peta"
            >
              -
            </button>
            <span className="font-mono-num text-xs text-[#94a3b8] px-1">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.8, +(z + 0.25).toFixed(2)))}
              className="px-2.5 py-1 rounded bg-white/8 hover:bg-white/15 text-xs font-mono-num text-[#f4f1ea] cursor-pointer"
              title="Perbesar Peta"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1.35);
                setPan({ x: 0, y: 0 });
              }}
              className="px-2.5 py-1 rounded bg-white/8 hover:bg-white/15 text-xs text-[#cbd5e1] cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Map Canvas Container */}
        <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#060911] shadow-2xl">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerLeave={() => {
              isDraggingRef.current = false;
            }}
            data-testid="interactive-world-map-canvas"
            className="w-full h-[320px] sm:h-[380px] block cursor-crosshair touch-none"
          />

          {/* Top-Left Map Legend Overlay */}
          <div className="absolute top-3 left-3 pointer-events-none bg-[#070a10]/90 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-[#cbd5e1] flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Klik Peta: Pasang GPS</span>
            <span aria-hidden="true">·</span>
            <span>Seret: Geser Peta</span>
            {customWaypoint && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#c084fc] font-mono-num font-semibold">
                  Tujuan: {customWaypoint.label} ({distanceToWaypoint} m)
                </span>
              </>
            )}
          </div>

          {customWaypoint && (
            <button
              type="button"
              onClick={() => gameStore.setCustomWaypoint(null)}
              className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-[#090c12]/90 hover:bg-[#ef4444] text-xs font-semibold text-[#f4f1ea] hover:text-white border border-white/15 cursor-pointer transition-colors"
            >
              Hapus Pin GPS
            </button>
          )}
        </div>

        {/* 24-Hour Real-Time Jakarta Clock, World Event Ticker & Turf Summary Strip */}
        <div className="aaa-glass rounded-xl px-4 py-2.5 flex flex-col gap-2 border border-white/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-mono-num text-sm font-extrabold text-[#fef08a]">
                {formatJakartaClock(worldTimeMinutes)} WIB
              </span>
              <input
                type="range"
                min={0}
                max={1439}
                step={15}
                value={worldTimeMinutes}
                aria-label="Pengatur Waktu 24 Jam Jakarta"
                onChange={(e) => {
                  const mins = Number(e.target.value);
                  gameStore.setState((prev) => ({
                    worldTimeMinutes: mins,
                    weatherMode: resolveWeatherFromWorldClock(
                      mins,
                      prev.weatherMode === 'hujan'
                    ),
                  }));
                }}
                className="w-32 sm:w-44 accent-[#f59e0b] cursor-pointer"
              />
              <button
                type="button"
                onClick={() => gameStore.toggleAutoTimeCycle()}
                className={`px-2.5 py-1 rounded text-[11px] font-mono-num font-bold cursor-pointer ${
                  autoTimeCycle
                    ? 'bg-[#22c55e]/20 text-[#22c55e]'
                    : 'bg-white/10 text-[#94a3b8]'
                }`}
              >
                {autoTimeCycle ? 'Siklus 24J Aktif' : 'Waktu Dikunci'}
              </button>
            </div>
            <div className="text-xs font-mono-num text-[#cbd5e1]">
              Dividen Teritori Kru:{' '}
              <span className="text-[#22c55e] font-bold">
                +{formatRupiah(calculateTurfWarsIncome(playerState))}/4d
              </span>
            </div>
          </div>

          {/* World Clock Traffic Jam / Road Construction Ticker Control Row */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`px-1.5 py-0.5 rounded font-mono-num text-[10px] font-bold ${
                  activeRoadEvent?.spec.kind === 'road_construction'
                    ? 'bg-[#f97316]/20 text-[#fb923c]'
                    : activeRoadEvent
                    ? 'bg-[#ef4444]/20 text-[#f87171]'
                    : 'bg-white/10 text-[#94a3b8]'
                }`}
              >
                {activeRoadEvent
                  ? activeRoadEvent.spec.kind === 'road_construction'
                    ? 'PROYEK JALAN'
                    : 'MACET MENDADAK'
                  : 'LALU LINTAS LANCAR'}
              </span>
              <span className="text-[#e2e8f0] font-medium truncate">
                {activeRoadEvent
                  ? `${activeRoadEvent.spec.title} (${activeRoadEvent.spec.detourLabel})`
                  : 'Tidak ada penutupan jalan aktif saat ini'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {activeRoadEvent && (
                <button
                  type="button"
                  onClick={() => {
                    gameStore.activateRoadEventDetourGps();
                    onResumeGame?.();
                  }}
                  className="px-2.5 py-1 rounded bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#090c12] text-[11px] font-bold cursor-pointer transition-colors"
                >
                  GPS Rute Alternatif
                </button>
              )}
              <button
                type="button"
                onClick={() => gameStore.triggerNextWorldRoadEvent()}
                className="px-2.5 py-1 rounded bg-[#f59e0b]/20 hover:bg-[#f59e0b] text-[#f59e0b] hover:text-[#090c12] text-[11px] font-bold cursor-pointer transition-colors"
              >
                Simulasi Insiden Jalan
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT 4 COLS: Selected POI Details + Quick District Fast-Travel List */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Selected POI or Custom Waypoint Card */}
        {selectedPoi ? (
          <div className="aaa-glass rounded-xl p-4 flex flex-col gap-3 border border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[11px] font-mono-num text-[#38bdf8]">
                  Koordinat ({selectedPoi.x}, {selectedPoi.z})
                </div>
                <h4 className="font-display text-2xl font-bold uppercase text-[#f4f1ea] leading-tight">
                  {selectedPoi.label}
                </h4>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  {selectedPoi.subtitle}
                </p>
              </div>
              {selectedPoi.rewardText && (
                <span className="font-mono-num text-xs font-bold text-[#22c55e] shrink-0">
                  {selectedPoi.rewardText}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  gameStore.setCustomWaypoint({
                    x: selectedPoi.x,
                    z: selectedPoi.z,
                    label: selectedPoi.label,
                    category: selectedPoi.category,
                  });
                  onResumeGame?.();
                }}
                className="flex-1 py-2 px-3 rounded-lg bg-[#c084fc] hover:bg-[#d8b4fe] text-[#090c12] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                Arahkan Rute GPS
              </button>

              {selectedPoi.districtId && onFastTravel && (
                <button
                  type="button"
                  onClick={() => {
                    onFastTravel(selectedPoi.districtId!);
                    onResumeGame?.();
                  }}
                  className="py-2 px-3 rounded-lg bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#090c12] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Teleport MRT
                </button>
              )}

              {!selectedPoi.districtId && onTeleportCoords && (
                <button
                  type="button"
                  onClick={() => {
                    onTeleportCoords(
                      selectedPoi.x,
                      selectedPoi.z,
                      selectedPoi.label
                    );
                    onResumeGame?.();
                  }}
                  className="py-2 px-3 rounded-lg bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#090c12] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Ke Lokasi
                </button>
              )}

              {selectedPoi.missionRef && onTriggerMissionDialog && (
                <button
                  type="button"
                  onClick={() => {
                    onResumeGame?.();
                    onTriggerMissionDialog(selectedPoi.missionRef!);
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-[#f59e0b] hover:bg-[#fbbf24] text-[#090c12] text-xs font-bold cursor-pointer"
                >
                  Buka Briefing Misi
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="aaa-glass rounded-xl p-4 flex flex-col gap-1.5 border border-white/10">
            <div className="font-display text-lg font-bold uppercase text-[#f4f1ea]">
              Komando Navigasi GPS Jakarta
            </div>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Klik titik mana pun pada peta di samping untuk memasang suar rute GPS 3D, atau pilih salah satu dari 13 distrik di bawah untuk teleportasi MRT instan.
            </p>
          </div>
        )}

        {/* Scrollable 13 Districts Turf Wars & Quick List */}
        <div className="aaa-glass rounded-xl p-4 flex flex-col gap-2.5 max-h-[290px] overflow-y-auto border border-white/10">
          <div className="flex items-center justify-between text-xs text-[#94a3b8]">
            <span className="font-semibold text-[#f4f1ea]">
              Perang Teritori 13 Distrik
            </span>
            <span>Kru / GPS / MRT</span>
          </div>
          <div className="divide-y divide-white/10">
            {JAKARTA_DISTRICTS.map((d) => {
              const turf = playerState.districtTurf?.[d.id];
              const owner = turf?.owner || 'neutral';
              const defLv = turf?.defenseLevel ?? 0;
              return (
                <div
                  key={d.id}
                  className="py-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          owner === 'player'
                            ? 'bg-[#22c55e]'
                            : owner === 'syndicate'
                            ? 'bg-[#ef4444]'
                            : 'bg-[#38bdf8]'
                        }`}
                      />
                      <span className="text-xs font-semibold text-[#f4f1ea] truncate">
                        {d.name}
                      </span>
                    </div>
                    <div className="text-[10px] font-mono-num text-[#94a3b8] truncate">
                      {owner === 'player'
                        ? `Jawara Kita · Benteng Lv.${defLv}/3`
                        : owner === 'syndicate'
                        ? 'Dikuasai Sindikat · Rp 180rb'
                        : 'Zona Netral · Rp 110rb'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {owner !== 'player' ? (
                      <button
                        type="button"
                        onClick={() => {
                          const res = captureDistrictTurf(playerState, d.id);
                          if (res.captured) {
                            const shocked = applyTurfWarStockShock(
                              res.nextState,
                              d.id,
                              `${formatJakartaClock(worldTimeMinutes)} WIB`
                            );
                            soundEngine.playMissionFanfare();
                            gameStore.setState({
                              playerState: shocked.nextState,
                              lastOutcomeText: `Teritori Direbut: ${d.name} · ${shocked.news.headline}`,
                            });
                          }
                        }}
                        className="px-2 py-1 rounded bg-[#22c55e]/20 hover:bg-[#22c55e] text-[#22c55e] hover:text-[#090c12] text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        Rebut
                      </button>
                    ) : defLv < 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const res = fortifyDistrictTurf(playerState, d.id);
                          if (res.fortified) {
                            soundEngine.playPickup();
                            gameStore.setState({
                              playerState: res.nextState,
                              lastOutcomeText: `Benteng Kru ${d.name} diperkuat ke Lv.${defLv + 1}!`,
                            });
                          }
                        }}
                        className="px-2 py-1 rounded bg-[#f59e0b]/20 hover:bg-[#f59e0b] text-[#f59e0b] hover:text-[#090c12] text-[10px] font-bold cursor-pointer transition-colors"
                      >
                        Benteng+
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        gameStore.setCustomWaypoint({
                          x: d.centerX,
                          z: d.centerZ,
                          label: d.name,
                          category: 'district',
                        })
                      }
                      className="px-2 py-1 rounded bg-white/8 hover:bg-white/15 text-[11px] font-mono-num text-[#c084fc] cursor-pointer"
                    >
                      GPS
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onFastTravel?.(d.id);
                        onResumeGame?.();
                      }}
                      className="px-2 py-1 rounded bg-[#38bdf8]/20 hover:bg-[#38bdf8] text-[#38bdf8] hover:text-[#090c12] text-[11px] font-semibold cursor-pointer transition-colors"
                    >
                      MRT
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

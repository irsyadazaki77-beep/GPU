import React, { useEffect, useMemo, useRef } from 'react';
import {
  CITY_BUILDINGS,
  GRAND_HEISTS,
  JAKARTA_DISTRICTS,
  PROTAGONIST_PROFILES,
  ProtagonistId,
  STREET_RACES,
  generateRoadsideSpawnLayout,
} from '../game/rules';
import {
  STREET_BOUNTIES,
  engineTelemetryRef,
  gameStore,
  useGameStore,
} from '../state/gameStore';

const RADAR_WIDTH = 196;
const RADAR_HEIGHT = 122;
const RADAR_FRAME_MS = 50; // ~20fps crisp radar sweep without main-thread pressure

interface MiniMapRadarProps {
  onClickRadar?: () => void;
}

export const MiniMapRadar: React.FC<MiniMapRadarProps> = ({ onClickRadar }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const customWaypoint = useGameStore((s) => s.customWaypoint);

  const staticLayout = useMemo(() => generateRoadsideSpawnLayout(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frameId = 0;
    let lastDrawMs = 0;

    const drawRadar = (now: number) => {
      frameId = window.requestAnimationFrame(drawRadar);
      if (now - lastDrawMs < RADAR_FRAME_MS) return;
      lastDrawMs = now;

      const store = gameStore.getState();
      if (store.gameState !== 'playing') return;

      const {
        playerX: px,
        playerZ: pz,
        playerFacing,
        vehicles,
        enemies,
        nearbyMission,
        activeChoice,
      } = engineTelemetryRef;
      const { playerState } = store;

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const zoom = 1.65;

      // Dark tactical Jakarta radar background
      ctx.fillStyle = '#070b12';
      ctx.fillRect(0, 0, w, h);

      // Subtle tactical grid
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.06)';
      ctx.lineWidth = 1;
      for (let gx = (cx % 20) - 20; gx < w; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
        ctx.stroke();
      }
      for (let gy = (cy % 20) - 20; gy < h; gy += 20) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
        ctx.stroke();
      }

      // 1. Roads
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 12;
      ctx.strokeRect(
        cx + (-32 - px) * zoom,
        cy + (-32 - pz) * zoom,
        64 * zoom,
        64 * zoom
      );
      ctx.beginPath();
      ctx.moveTo(cx + (0 - px) * zoom, cy + (-92 - pz) * zoom);
      ctx.lineTo(cx + (0 - px) * zoom, cy + (92 - pz) * zoom);
      ctx.moveTo(cx + (-92 - px) * zoom, cy + (0 - pz) * zoom);
      ctx.lineTo(cx + (92 - px) * zoom, cy + (0 - pz) * zoom);
      ctx.stroke();

      // 2. Monas Plaza core
      ctx.fillStyle = '#243044';
      ctx.beginPath();
      ctx.arc(
        cx + (0 - px) * zoom,
        cy + (0 - pz) * zoom,
        15 * zoom,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // 3. Tol Layang elevated highway
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx + (-92 - px) * zoom, cy + (24 - pz) * zoom);
      ctx.lineTo(cx + (92 - px) * zoom, cy + (24 - pz) * zoom);
      ctx.stroke();

      // 4. Faction Territory Rings across districts
      for (const dist of JAKARTA_DISTRICTS) {
        const dx = cx + (dist.centerX - px) * zoom;
        const dz = cy + (dist.centerZ - pz) * zoom;
        ctx.strokeStyle =
          dist.id === 'tanjung_priok' || dist.id === 'scbd'
            ? 'rgba(56, 189, 248, 0.28)'
            : dist.id === 'blok_m' || dist.id === 'kemayoran'
            ? 'rgba(249, 115, 22, 0.28)'
            : 'rgba(34, 197, 94, 0.22)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(dx, dz, 18 * zoom, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 5. City Buildings
      ctx.fillStyle = '#334155';
      for (const b of CITY_BUILDINGS) {
        const bx = cx + (b.x - px) * zoom;
        const bz = cy + (b.z - pz) * zoom;
        ctx.fillRect(
          bx - (b.width * zoom) / 2,
          bz - (b.depth * zoom) / 2,
          b.width * zoom,
          b.depth * zoom
        );
      }

      // 6. TransJakarta Halte Markers ("T")
      for (const halte of staticLayout.transJakartaHaltes) {
        const hx = cx + (halte.x - px) * zoom;
        const hz = cy + (halte.z - pz) * zoom;
        ctx.fillStyle = '#0ea5e9';
        ctx.fillRect(hx - 4, hz - 4, 8, 8);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('T', hx, hz + 0.5);
      }

      // 7. Street Race Start Points
      for (const race of STREET_RACES) {
        const start = race.checkpoints[0];
        if (!start) continue;
        const rx = cx + (start[0] - px) * zoom;
        const rz = cy + (start[1] - pz) * zoom;
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.moveTo(rx, rz - 4.5);
        ctx.lineTo(rx + 4.5, rz);
        ctx.lineTo(rx, rz + 4.5);
        ctx.lineTo(rx - 4.5, rz);
        ctx.closePath();
        ctx.fill();
      }

      // 8. Grand Heists Locations ("$")
      for (const heist of GRAND_HEISTS) {
        const gx = cx + (heist.vaultX - px) * zoom;
        const gz = cy + (heist.vaultZ - pz) * zoom;
        const completed = playerState.completedHeists.includes(heist.id);
        ctx.fillStyle = completed ? '#22c55e' : '#eab308';
        ctx.beginPath();
        ctx.arc(gx, gz, 5.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090c12';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', gx, gz + 0.5);
      }

      // 9. GPS Route Dashed Line to Active Objective or Nearby Mission
      const gpsTargetX = activeChoice?.targetX ?? nearbyMission?.markerX;
      const gpsTargetZ = activeChoice?.targetZ ?? nearbyMission?.markerZ;
      if (gpsTargetX !== undefined && gpsTargetZ !== undefined) {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + (gpsTargetX - px) * zoom,
          cy + (gpsTargetZ - pz) * zoom
        );
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(
          cx + (gpsTargetX - px) * zoom,
          cy + (gpsTargetZ - pz) * zoom,
          4.2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // 9b. Street Bounty Blips
      for (const b of STREET_BOUNTIES) {
        if (store.claimedBounties.includes(b.id)) continue;
        const bx = cx + (b.x - px) * zoom;
        const bz = cy + (b.z - pz) * zoom;
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(bx, bz, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // 9c. Custom GPS Waypoint Pin & Dashed Purple Route
      const wp = store.customWaypoint;
      if (wp) {
        const wx = cx + (wp.x - px) * zoom;
        const wz = cy + (wp.z - pz) * zoom;
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.92)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(wx, wz);
        ctx.stroke();
        ctx.setLineDash([]);

        // Clamp edge indicator if waypoint is outside radar viewport
        const clampedX = Math.max(8, Math.min(w - 8, wx));
        const clampedZ = Math.max(8, Math.min(h - 8, wz));
        ctx.fillStyle = '#c084fc';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(clampedX, clampedZ, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#090c12';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('W', clampedX, clampedZ + 0.5);
      }

      // 10. Inactive Protagonists
      for (const pId of ['nabilo', 'raka', 'kirana'] as ProtagonistId[]) {
        if (pId === playerState.activeProtagonist) continue;
        const pInfo = playerState.protagonistRoster[pId];
        const rx = cx + (pInfo.x - px) * zoom;
        const rz = cy + (pInfo.z - pz) * zoom;
        ctx.fillStyle = PROTAGONIST_PROFILES[pId].colorHex;
        ctx.beginPath();
        ctx.arc(rx, rz, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // 11. Active Enemies
      ctx.fillStyle = '#ef4444';
      for (const en of enemies) {
        if (!en.alive) continue;
        ctx.beginPath();
        ctx.arc(
          cx + (en.x - px) * zoom,
          cy + (en.z - pz) * zoom,
          2.6,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // 12. Traffic & Police Units (with flashing red-blue siren + vision cone during Wanted pursuit)
      const sirenFlash = Math.floor(now / 190) % 2 === 0;
      for (const v of vehicles) {
        const vx = cx + (v.x - px) * zoom;
        const vz = cy + (v.z - pz) * zoom;

        if (v.type === 'polisi' && playerState.wantedLevel > 0) {
          ctx.fillStyle = sirenFlash
            ? 'rgba(239, 68, 68, 0.25)'
            : 'rgba(59, 130, 246, 0.25)';
          ctx.beginPath();
          ctx.moveTo(vx, vz);
          ctx.arc(
            vx,
            vz,
            24,
            -v.heading - Math.PI / 2 - 0.55,
            -v.heading - Math.PI / 2 + 0.55
          );
          ctx.closePath();
          ctx.fill();
        }

        ctx.fillStyle =
          v.type === 'polisi'
            ? sirenFlash
              ? '#ef4444'
              : '#3b82f6'
            : v.type === 'transjakarta'
            ? '#06b6d4'
            : v.type === 'angkot'
            ? '#38bdf8'
            : v.type === 'ojek'
            ? '#22c55e'
            : v.type === 'vtol_jet' || v.type === 'heli'
            ? '#c084fc'
            : '#cbd5e1';
        ctx.fillRect(vx - 2.3, vz - 2.3, 4.6, 4.6);
      }

      // 13. Player Heading Chevron
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-playerFacing);
      ctx.fillStyle = PROTAGONIST_PROFILES[playerState.activeProtagonist].colorHex;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -6.5);
      ctx.lineTo(4.6, 5);
      ctx.lineTo(0, 2.5);
      ctx.lineTo(-4.6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    frameId = window.requestAnimationFrame(drawRadar);
    return () => window.cancelAnimationFrame(frameId);
  }, [staticLayout]);

  return (
    <div
      onClick={onClickRadar}
      role={onClickRadar ? 'button' : undefined}
      tabIndex={onClickRadar ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClickRadar && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClickRadar();
        }
      }}
      title="Klik untuk membuka Peta Taktis Jakarta & Pin GPS [Esc]"
      className={`relative w-[136px] h-[85px] sm:w-[196px] sm:h-[122px] bg-[#070b12] ${
        onClickRadar ? 'cursor-pointer group' : ''
      }`}
    >
      <canvas
        ref={canvasRef}
        width={RADAR_WIDTH}
        height={RADAR_HEIGHT}
        aria-label="Radar Mini-Map Jakarta"
        data-testid="minimap-radar-canvas"
        className="w-full h-full block"
      />
      <span className="absolute top-1.5 right-1.5 px-1 rounded bg-[#070a10]/90 text-[9px] font-mono-num font-bold text-[#cbd5e1] pointer-events-none">
        U
      </span>
      {customWaypoint && (
        <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 rounded bg-[#070a10]/92 border border-[#c084fc]/50 text-[9px] font-mono-num font-bold text-[#c084fc] pointer-events-none truncate max-w-[140px]">
          GPS: {customWaypoint.label}
        </span>
      )}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: 'inset 0 0 14px rgba(0,0,0,0.55)',
        }}
      />
    </div>
  );
};

import React, { useEffect, useMemo, useRef } from 'react';
import {
  CITY_BUILDINGS,
  GRAND_HEISTS,
  JAKARTA_DISTRICTS,
  JAKARTA_FLOOD_ZONES,
  JAKARTA_SPEED_TRAPS,
  MRT_STATIONS,
  PROTAGONIST_PROFILES,
  ProtagonistId,
  STREET_RACES,
  STUNT_RAMPS_CATALOG,
  computeMrtTrainState,
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
  const wantedLevel = useGameStore((s) => s.playerState.wantedLevel);
  const wantedEvading = useGameStore((s) => s.playerState.wantedEvading);

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

      // Northern Jakarta Bay Water Basin (z < -72)
      const bayEdgeY = cy + (-72 - pz) * zoom;
      if (bayEdgeY > 0) {
        ctx.fillStyle = 'rgba(3, 105, 161, 0.28)';
        ctx.fillRect(0, 0, w, Math.min(h, bayEdgeY));
      }

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

      // 1. Roads (Inner Ring + Outer Ring +-128 + JORR Perimeter +-208 + Coastal Wings)
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 12;
      ctx.strokeRect(
        cx + (-32 - px) * zoom,
        cy + (-32 - pz) * zoom,
        64 * zoom,
        64 * zoom
      );
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.72)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      // Outer Ring x = +-128 over z [-68..214] & z = 128 across [-214..214]
      ctx.moveTo(cx + (-128 - px) * zoom, cy + (-68 - pz) * zoom);
      ctx.lineTo(cx + (-128 - px) * zoom, cy + (214 - pz) * zoom);
      ctx.moveTo(cx + (128 - px) * zoom, cy + (-68 - pz) * zoom);
      ctx.lineTo(cx + (128 - px) * zoom, cy + (214 - pz) * zoom);
      ctx.moveTo(cx + (-214 - px) * zoom, cy + (128 - pz) * zoom);
      ctx.lineTo(cx + (214 - px) * zoom, cy + (128 - pz) * zoom);
      // JORR Perimeter x = +-208 over z [-71..215] & z = 208 across [-215..215]
      ctx.moveTo(cx + (-208 - px) * zoom, cy + (-71 - pz) * zoom);
      ctx.lineTo(cx + (-208 - px) * zoom, cy + (215 - pz) * zoom);
      ctx.moveTo(cx + (208 - px) * zoom, cy + (-71 - pz) * zoom);
      ctx.lineTo(cx + (208 - px) * zoom, cy + (215 - pz) * zoom);
      ctx.moveTo(cx + (-215 - px) * zoom, cy + (208 - pz) * zoom);
      ctx.lineTo(cx + (215 - px) * zoom, cy + (208 - pz) * zoom);
      // Northern wing coastal boulevards (z = -66 across [-214..-122] and [122..214])
      ctx.moveTo(cx + (-214 - px) * zoom, cy + (-66 - pz) * zoom);
      ctx.lineTo(cx + (-122 - px) * zoom, cy + (-66 - pz) * zoom);
      ctx.moveTo(cx + (122 - px) * zoom, cy + (-66 - pz) * zoom);
      ctx.lineTo(cx + (214 - px) * zoom, cy + (-66 - pz) * zoom);
      ctx.stroke();

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(cx + (0 - px) * zoom, cy + (-72 - pz) * zoom);
      ctx.lineTo(cx + (0 - px) * zoom, cy + (216 - pz) * zoom);
      ctx.moveTo(cx + (-216 - px) * zoom, cy + (0 - pz) * zoom);
      ctx.lineTo(cx + (216 - px) * zoom, cy + (0 - pz) * zoom);
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

      // 8b. Monsoon Flood Zones (visible during heavy rain)
      if (store.weatherMode === 'hujan') {
        for (let fi = 0; fi < JAKARTA_FLOOD_ZONES.length; fi++) {
          const fz = JAKARTA_FLOOD_ZONES[fi];
          const fx = cx + (fz.x - px) * zoom;
          const fzY = cy + (fz.z - pz) * zoom;
          ctx.fillStyle = 'rgba(14, 165, 233, 0.24)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(fx, fzY, fz.radius * zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // 8c. 6 Handcrafted Jakarta Stunt Ramps
      for (let ri = 0; ri < STUNT_RAMPS_CATALOG.length; ri++) {
        const ramp = STUNT_RAMPS_CATALOG[ri];
        const rx = cx + (ramp.x - px) * zoom;
        const rz = cy + (ramp.z - pz) * zoom;
        const done = store.stuntCompletedIds.includes(ramp.id);
        ctx.save();
        ctx.translate(rx, rz);
        ctx.rotate(-ramp.heading);
        ctx.fillStyle = done ? '#22c55e' : '#f59e0b';
        ctx.beginPath();
        ctx.moveTo(0, -4.5);
        ctx.lineTo(3.5, 3.5);
        ctx.lineTo(0, 1.5);
        ctx.lineTo(-3.5, 3.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // 8d. Active 3D Turf War Contested Zone Ring
      if (store.activeTurfWar && store.activeTurfWar.status === 'active') {
        const tw = store.activeTurfWar;
        const tx = cx + (tw.centerX - px) * zoom;
        const tz = cy + (tw.centerZ - pz) * zoom;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(tx, tz, tw.radius * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // 8e. ETLE Speed Traps, MRT Stations, Live MRT Train & Vigilante Target
      for (let ti = 0; ti < JAKARTA_SPEED_TRAPS.length; ti++) {
        const trap = JAKARTA_SPEED_TRAPS[ti];
        const tx = cx + (trap.x - px) * zoom;
        const tz = cy + (trap.z - pz) * zoom;
        ctx.fillStyle = '#facc15';
        ctx.fillRect(tx - 2.2, tz - 2.2, 4.4, 4.4);
      }

      for (let mi = 0; mi < MRT_STATIONS.length; mi++) {
        const st = MRT_STATIONS[mi];
        const mx = cx + (st.x - px) * zoom;
        const mz = cy + (st.z - pz) * zoom;
        ctx.fillStyle = '#0284c7';
        ctx.strokeStyle = '#e0f2fe';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(mx, mz, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      const mrtLive = computeMrtTrainState(now * 0.001);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(
        cx + (mrtLive.x - px) * zoom - 2,
        cy + (mrtLive.z - pz) * zoom - 6,
        4,
        12
      );

      if (store.activeVigilante && store.activeVigilante.status === 'active') {
        const vx = cx + (store.activeVigilante.targetX - px) * zoom;
        const vz = cy + (store.activeVigilante.targetZ - pz) * zoom;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(vx, vz, 6.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(vx, vz, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 8e. Active Street Race Checkpoint & Rival AI Racers
      if (store.activeRace && store.activeRace.status !== 'finished') {
        const cp =
          store.activeRace.checkpoints[store.activeRace.playerCheckpointIndex];
        if (cp) {
          const rcx = cx + (cp[0] - px) * zoom;
          const rcz = cy + (cp[1] - pz) * zoom;
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.9)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(rcx, rcz);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#22d3ee';
          ctx.beginPath();
          ctx.arc(
            Math.max(8, Math.min(w - 8, rcx)),
            Math.max(8, Math.min(h - 8, rcz)),
            5.2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        const rivals = engineTelemetryRef.raceRivals;
        for (let vi = 0; vi < rivals.length; vi++) {
          const rv = rivals[vi];
          const rvx = cx + (rv.x - px) * zoom;
          const rvz = cy + (rv.z - pz) * zoom;
          ctx.fillStyle = `#${rv.colorHex.toString(16).padStart(6, '0')}`;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(rvx, rvz, 3.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
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

      // 9b-2. Active World Clock Road Event (Traffic Jam / Construction Hazard & Detour Path)
      const activeRoadEvent = store.worldClockEventState.activeEvent;
      if (activeRoadEvent) {
        const ev = activeRoadEvent.spec;
        const ex = cx + (ev.x - px) * zoom;
        const ez = cy + (ev.z - pz) * zoom;
        const isConst = ev.kind === 'road_construction';

        // Dashed Detour Route around blockage
        if (ev.detourWaypoints.length > 0 && !activeRoadEvent.detourCompleted) {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          for (
            let wi = activeRoadEvent.detourStageIndex;
            wi < ev.detourWaypoints.length;
            wi++
          ) {
            const dpt = ev.detourWaypoints[wi];
            ctx.lineTo(cx + (dpt[0] - px) * zoom, cy + (dpt[1] - pz) * zoom);
          }
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Hazard Zone Ring & Marker
        ctx.fillStyle = isConst
          ? 'rgba(249, 115, 22, 0.28)'
          : 'rgba(239, 68, 68, 0.28)';
        ctx.strokeStyle = isConst ? '#f97316' : '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ex, ez, ev.radius * zoom * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isConst ? '#f97316' : '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ez, 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090c12';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', ex, ez + 0.5);
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

      // 10. Autonomous 3D Trio Squad Wingmen (Raka & Kirana live telemetry)
      const squadMembers = engineTelemetryRef.squadMembers;
      if (squadMembers.length > 0) {
        for (let si = 0; si < squadMembers.length; si++) {
          const sm = squadMembers[si];
          const rx = cx + (sm.x - px) * zoom;
          const rz = cy + (sm.z - pz) * zoom;
          ctx.fillStyle = PROTAGONIST_PROFILES[sm.id].colorHex;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rx, rz - 4);
          ctx.lineTo(rx + 4, rz);
          ctx.lineTo(rx, rz + 4);
          ctx.lineTo(rx - 4, rz);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      } else {
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

      // 11b. Living Jakarta Street Random Event Beacon (Coral Vice-Jakarta Pulse)
      const activeStreetEv = store.activeStreetEvent;
      if (activeStreetEv && activeStreetEv.status === 'active') {
        const sx = cx + (activeStreetEv.x - px) * zoom;
        const sz = cy + (activeStreetEv.z - pz) * zoom;
        const clampedSX = Math.max(8, Math.min(w - 8, sx));
        const clampedSZ = Math.max(8, Math.min(h - 8, sz));
        const pulseR = 6.5 + Math.sin(now * 0.008) * 2.2;
        ctx.strokeStyle = 'rgba(255, 107, 74, 0.78)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(clampedSX, clampedSZ, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#ff6b4a';
        ctx.beginPath();
        ctx.arc(clampedSX, clampedSZ, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#090c12';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', clampedSX, clampedSZ + 0.5);
      }

      // 11c. Tactical Police Witness Ring & Last Known Position (LKP) Search Zone
      const tac = store.policeTactical;
      if (tac.phase === 'witness_reporting') {
        const wx = cx + (tac.witnessX - px) * zoom;
        const wz = cy + (tac.witnessZ - pz) * zoom;
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.arc(wx, wz, 14, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (
        tac.phase === 'searching_lkp' &&
        tac.lastKnownX !== null &&
        tac.lastKnownZ !== null
      ) {
        const lx = cx + (tac.lastKnownX - px) * zoom;
        const lz = cy + (tac.lastKnownZ - pz) * zoom;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(lx, lz, Math.min(44, tac.searchRadius * zoom * 0.55), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulsing LKP Diamond
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.moveTo(lx, lz - 5);
        ctx.lineTo(lx + 5, lz);
        ctx.lineTo(lx, lz + 5);
        ctx.lineTo(lx - 5, lz);
        ctx.closePath();
        ctx.fill();
      }

      // 12. Tactical Police Vision Cones & Helicopter Searchlight from engineTelemetryRef
      const sirenFlash = Math.floor(now / 190) % 2 === 0;
      const policeCones = engineTelemetryRef.policeCones;
      for (let ci = 0; ci < policeCones.length; ci++) {
        const cone = policeCones[ci];
        const vx = cx + (cone.x - px) * zoom;
        const vz = cy + (cone.z - pz) * zoom;
        if (cone.isHeli) {
          ctx.fillStyle = 'rgba(254, 240, 138, 0.22)';
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.72)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(vx, vz, cone.range * zoom, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = sirenFlash
            ? 'rgba(239, 68, 68, 0.24)'
            : 'rgba(59, 130, 246, 0.24)';
          ctx.beginPath();
          ctx.moveTo(vx, vz);
          ctx.arc(
            vx,
            vz,
            Math.min(36, cone.range * zoom * 0.85),
            -cone.heading + Math.PI / 2 - cone.halfAngleRad,
            -cone.heading + Math.PI / 2 + cone.halfAngleRad
          );
          ctx.closePath();
          ctx.fill();
        }
      }

      // 12b. Traffic & Police Units
      for (const v of vehicles) {
        const vx = cx + (v.x - px) * zoom;
        const vz = cy + (v.z - pz) * zoom;

        ctx.fillStyle =
          v.type === 'polisi' || v.type === 'barracuda'
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
      {wantedLevel > 0 && wantedEvading && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-[#070a10]/92 border border-slate-400 text-[8px] font-mono-num font-extrabold text-slate-200 pointer-events-none animate-pulse">
          LOLOS DARI RADAR
        </span>
      )}
      <div
        className={`absolute inset-0 pointer-events-none transition-colors duration-150 ${
          wantedLevel > 0
            ? wantedEvading
              ? 'border-2 border-slate-300/80 shadow-[inset_0_0_16px_rgba(203,213,225,0.45)]'
              : 'border-2 border-red-500 shadow-[inset_0_0_18px_rgba(239,68,68,0.55)]'
            : ''
        }`}
        style={{
          boxShadow: wantedLevel > 0 ? undefined : 'inset 0 0 14px rgba(0,0,0,0.55)',
        }}
      />
    </div>
  );
};

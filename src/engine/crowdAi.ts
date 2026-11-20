import {
  BuildingFootprint,
  SpatialHashGrid,
  TrafficSignalPhase,
  WARUNG_STALL_LOCATIONS,
  resolveCircleAABBCollision,
  stepSidewalkPatrol,
} from '../game/rules';

export type PedestrianAiState =
  | 'WALKING'
  | 'CROSSING_AT_GREEN'
  | 'FLEEING'
  | 'CROWDING'
  | 'FILMING';

export interface PedestrianAiAgent {
  x: number;
  z: number;
  axis: 'ns' | 'ew';
  dir: 1 | -1;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  speed: number;
  phase: number;
  state: PedestrianAiState;
  panicTimer: number;
  panicVx: number;
  panicVz: number;
  crowdTimer: number;
  crowdAnchorX: number;
  crowdAnchorZ: number;
  filmTimer?: number;
  filmTargetX?: number;
  filmTargetZ?: number;
  torsoColor: number;
}

export interface PedestrianStepContext {
  dt: number;
  signalPhase: TrafficSignalPhase;
  wantedLevel: number;
  playerX: number;
  playerZ: number;
  buildingGrid?: SpatialHashGrid<BuildingFootprint>;
}

/**
 * Pure state machine evaluator for Jakarta pedestrian agents:
 * - FLEEING: during gunfights, high wanted levels (wanted >= 2 near player), horns, or vehicle collisions
 * - FILMING: pulling out smartphones to record viral stunts, explosions, or chases for NabiloGram
 * - CROSSING_AT_GREEN: when near intersection curb ends and perpendicular vehicle signal is red
 * - CROWDING: when near Warung culinary stalls and pausing to socialize
 * - WALKING: normal sidewalk patrol
 */
export function evaluatePedestrianAiState(
  agent: PedestrianAiAgent,
  ctx: PedestrianStepContext
): PedestrianAiState {
  if (agent.panicTimer > 0) {
    return 'FLEEING';
  }

  if ((agent.filmTimer ?? 0) > 0) {
    return 'FILMING';
  }

  if (ctx.wantedLevel >= 2) {
    const distToPlayer = Math.hypot(agent.x - ctx.playerX, agent.z - ctx.playerZ);
    if (distToPlayer < 15) {
      return 'FLEEING';
    }
  }

  if (agent.crowdTimer > 0) {
    return 'CROWDING';
  }

  const nearCurbEnd =
    agent.axis === 'ns'
      ? agent.z - agent.minZ < 1.35 || agent.maxZ - agent.z < 1.35
      : agent.x - agent.minX < 1.35 || agent.maxX - agent.x < 1.35;

  if (nearCurbEnd) {
    const pedestrianWalkSignal =
      (agent.axis === 'ns' && ctx.signalPhase === 'ew_green') ||
      (agent.axis === 'ew' && ctx.signalPhase === 'ns_green');
    if (pedestrianWalkSignal) {
      return 'CROSSING_AT_GREEN';
    }
  }

  return 'WALKING';
}

export function stepPedestrianAgentInPlace(
  ag: PedestrianAiAgent,
  ctx: PedestrianStepContext
): { facing: number; moving: boolean; state: PedestrianAiState } {
  const { dt, signalPhase, wantedLevel, playerX, playerZ, buildingGrid } = ctx;

  if (wantedLevel >= 2 && ag.panicTimer <= 0 && (ag.filmTimer ?? 0) <= 0) {
    const dP = Math.hypot(ag.x - playerX, ag.z - playerZ);
    if (dP < 15) {
      ag.panicTimer = 3.2;
      ag.panicVx = ((ag.x - playerX) / (dP || 1)) * 4.4;
      ag.panicVz = ((ag.z - playerZ) / (dP || 1)) * 4.4;
    } else if (dP < 24 && Math.sin(ag.phase * 2.1) > 0.92) {
      ag.filmTimer = 4.5;
      ag.filmTargetX = playerX;
      ag.filmTargetZ = playerZ;
    }
  }

  // Check proximity to Warung stalls for spontaneous CROWDING social behavior
  if (ag.panicTimer <= 0 && ag.crowdTimer <= 0 && (ag.filmTimer ?? 0) <= 0) {
    for (const [wx, wz] of WARUNG_STALL_LOCATIONS) {
      const dW = Math.hypot(ag.x - wx, ag.z - wz);
      if (dW < 3.4 && Math.sin(ag.phase * 1.7) > 0.96) {
        ag.crowdTimer = 2.4;
        ag.crowdAnchorX = wx;
        ag.crowdAnchorZ = wz;
        break;
      }
    }
  }

  ag.state = evaluatePedestrianAiState(ag, ctx);

  if (ag.state === 'FLEEING') {
    ag.panicTimer = Math.max(0, ag.panicTimer - dt);
    const col = resolveCircleAABBCollision(
      ag.x + ag.panicVx * dt,
      ag.z + ag.panicVz * dt,
      0.4,
      undefined,
      buildingGrid
    );
    ag.x = col.x;
    ag.z = col.z;
    const facing = Math.atan2(ag.panicVx, ag.panicVz);
    ag.phase += dt * 11.5;
    return { facing, moving: true, state: ag.state };
  }

  if (ag.state === 'FILMING') {
    ag.filmTimer = Math.max(0, (ag.filmTimer ?? 0) - dt);
    const tx = ag.filmTargetX ?? playerX;
    const tz = ag.filmTargetZ ?? playerZ;
    const facing = Math.atan2(tx - ag.x, tz - ag.z);
    return { facing, moving: false, state: ag.state };
  }

  if (ag.state === 'CROWDING') {
    ag.crowdTimer = Math.max(0, ag.crowdTimer - dt);
    const facing = Math.atan2(ag.crowdAnchorX - ag.x, ag.crowdAnchorZ - ag.z);
    return { facing, moving: false, state: ag.state };
  }

  // Check if waiting for vehicle green light at curb
  const nearCurbEnd =
    ag.axis === 'ns'
      ? ag.z - ag.minZ < 1.2 || ag.maxZ - ag.z < 1.2
      : ag.x - ag.minX < 1.2 || ag.maxX - ag.x < 1.2;
  const waitForCarGreen =
    nearCurbEnd &&
    ((ag.axis === 'ns' && signalPhase === 'ns_green') ||
      (ag.axis === 'ew' && signalPhase === 'ew_green'));

  if (waitForCarGreen) {
    const facing =
      ag.axis === 'ns'
        ? ag.dir > 0
          ? 0
          : Math.PI
        : ag.dir > 0
        ? Math.PI / 2
        : -Math.PI / 2;
    return { facing, moving: false, state: 'WALKING' };
  }

  const speedMult = ag.state === 'CROSSING_AT_GREEN' ? 1.28 : 1.0;
  const next = stepSidewalkPatrol(
    ag.x,
    ag.z,
    ag.dir,
    ag.speed * speedMult,
    dt,
    ag.minX,
    ag.maxX,
    ag.minZ,
    ag.maxZ,
    ag.axis,
    0.5
  );
  ag.x = next.x;
  ag.z = next.z;
  ag.dir = next.dir;
  const facing =
    ag.axis === 'ns'
      ? ag.dir > 0
        ? 0
        : Math.PI
      : ag.dir > 0
      ? Math.PI / 2
      : -Math.PI / 2;
  ag.phase += dt * (ag.state === 'CROSSING_AT_GREEN' ? 6.8 : 5.2);

  return { facing, moving: true, state: ag.state };
}

export function triggerCrowdFleeImpulse(
  agents: PedestrianAiAgent[],
  worldX: number,
  worldZ: number,
  radius: number = 22,
  durationSec: number = 4.2
): number {
  let affected = 0;
  for (const ag of agents) {
    const dx = ag.x - worldX;
    const dz = ag.z - worldZ;
    const dist = Math.hypot(dx, dz);
    if (dist < radius) {
      const inv = 1 / (dist || 1);
      ag.panicTimer = durationSec;
      ag.crowdTimer = 0;
      ag.filmTimer = 0;
      ag.panicVx = dx * inv * 4.5;
      ag.panicVz = dz * inv * 4.5;
      ag.state = 'FLEEING';
      affected++;
    }
  }
  return affected;
}

export function triggerCrowdSocialFilming(
  agents: PedestrianAiAgent[],
  worldX: number,
  worldZ: number,
  minRadius: number = 7,
  maxRadius: number = 26,
  durationSec: number = 5.5
): number {
  let filmers = 0;
  for (let i = 0; i < agents.length; i++) {
    const ag = agents[i];
    const dist = Math.hypot(ag.x - worldX, ag.z - worldZ);
    if (dist >= minRadius && dist <= maxRadius && ag.panicTimer <= 0) {
      ag.filmTimer = durationSec;
      ag.filmTargetX = worldX;
      ag.filmTargetZ = worldZ;
      ag.crowdTimer = 0;
      ag.state = 'FILMING';
      filmers++;
      if (filmers >= 6) break;
    }
  }
  return filmers;
}

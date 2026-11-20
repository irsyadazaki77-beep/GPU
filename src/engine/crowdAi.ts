import {
  BuildingFootprint,
  SpatialHashGrid,
  TrafficSignalPhase,
  WARUNG_STALL_LOCATIONS,
  resolveCircleAABBCollision,
  stepSidewalkPatrol,
} from '../game/rules';

export type PedestrianArchetype =
  | 'komuter'
  | 'ojol_driver'
  | 'jogger'
  | 'pedagang'
  | 'anak_scbd'
  | 'satpam';

export type PedestrianAiState =
  | 'WALKING'
  | 'CROSSING_AT_GREEN'
  | 'FLEEING'
  | 'CROWDING'
  | 'FILMING'
  | 'JOGGING'
  | 'CHATTING'
  | 'BROWSING_PHONE'
  | 'CHEERING';

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
  archetype?: PedestrianArchetype;
  panicTimer: number;
  panicVx: number;
  panicVz: number;
  crowdTimer: number;
  crowdAnchorX: number;
  crowdAnchorZ: number;
  filmTimer?: number;
  filmTargetX?: number;
  filmTargetZ?: number;
  chatTimer?: number;
  chatPartnerX?: number;
  chatPartnerZ?: number;
  phoneTimer?: number;
  cheerTimer?: number;
  interactCooldown?: number;
  torsoColor: number;
}

export interface PedestrianStepContext {
  dt: number;
  signalPhase: TrafficSignalPhase;
  wantedLevel: number;
  playerX: number;
  playerZ: number;
  playerSpeed?: number;
  playerInVehicle?: boolean;
  buildingGrid?: SpatialHashGrid<BuildingFootprint>;
}

/**
 * Pure state machine evaluator for Jakarta pedestrian agents:
 * - FLEEING: during gunfights, high wanted levels (wanted >= 2 near player), horns, or fast near-misses
 * - CHEERING: reacting enthusiastically to drifts, stunts, or street triumphs
 * - FILMING: pulling out smartphones to record viral stunts, explosions, or chases for NabiloGram
 * - CHATTING: conversing briefly when crossing paths with another local pedestrian
 * - BROWSING_PHONE: checking ojol orders or scrolling NabiloGram along sidewalks
 * - CROWDING: when near Warung culinary stalls and pausing to socialize
 * - CROSSING_AT_GREEN: when near intersection curb ends and perpendicular vehicle signal is red
 * - JOGGING / WALKING: active sidewalk patrol
 */
export function evaluatePedestrianAiState(
  agent: PedestrianAiAgent,
  ctx: PedestrianStepContext
): PedestrianAiState {
  if (agent.panicTimer > 0) {
    return 'FLEEING';
  }

  if (ctx.wantedLevel >= 2) {
    const distToPlayer = Math.hypot(agent.x - ctx.playerX, agent.z - ctx.playerZ);
    if (distToPlayer < 15) {
      return 'FLEEING';
    }
  }

  if ((agent.cheerTimer ?? 0) > 0) {
    return 'CHEERING';
  }

  if ((agent.filmTimer ?? 0) > 0) {
    return 'FILMING';
  }

  if ((agent.chatTimer ?? 0) > 0) {
    return 'CHATTING';
  }

  if ((agent.phoneTimer ?? 0) > 0) {
    return 'BROWSING_PHONE';
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

  if (agent.archetype === 'jogger') {
    return 'JOGGING';
  }

  return 'WALKING';
}

export function stepPedestrianAgentInPlace(
  ag: PedestrianAiAgent,
  ctx: PedestrianStepContext
): { facing: number; moving: boolean; state: PedestrianAiState } {
  const {
    dt,
    signalPhase,
    wantedLevel,
    playerX,
    playerZ,
    playerSpeed = 0,
    playerInVehicle = false,
    buildingGrid,
  } = ctx;

  if ((ag.interactCooldown ?? 0) > 0) {
    ag.interactCooldown = Math.max(0, (ag.interactCooldown ?? 0) - dt);
  }

  const dxPlayer = ag.x - playerX;
  const dzPlayer = ag.z - playerZ;
  const dPlayerSq = dxPlayer * dxPlayer + dzPlayer * dzPlayer;

  if (
    playerInVehicle &&
    playerSpeed > 14 &&
    ag.panicTimer <= 0 &&
    dPlayerSq < 7.5 * 7.5
  ) {
    const dP = Math.sqrt(dPlayerSq) || 1;
    ag.panicTimer = 1.65;
    ag.cheerTimer = 0;
    ag.chatTimer = 0;
    ag.phoneTimer = 0;
    ag.panicVx = (dxPlayer / dP) * 4.2;
    ag.panicVz = (dzPlayer / dP) * 4.2;
  }

  if (wantedLevel >= 2 && ag.panicTimer <= 0 && (ag.filmTimer ?? 0) <= 0) {
    if (dPlayerSq < 15 * 15) {
      const dP = Math.sqrt(dPlayerSq) || 1;
      ag.panicTimer = 3.2;
      ag.panicVx = (dxPlayer / dP) * 4.4;
      ag.panicVz = (dzPlayer / dP) * 4.4;
    } else if (dPlayerSq < 24 * 24 && Math.sin(ag.phase * 2.1) > 0.92) {
      ag.filmTimer = 4.5;
      ag.filmTargetX = playerX;
      ag.filmTargetZ = playerZ;
    }
  }

  // Check proximity to Warung stalls for spontaneous CROWDING social behavior
  if (
    ag.panicTimer <= 0 &&
    ag.crowdTimer <= 0 &&
    (ag.filmTimer ?? 0) <= 0 &&
    (ag.chatTimer ?? 0) <= 0 &&
    (ag.cheerTimer ?? 0) <= 0
  ) {
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

  // Spontaneous smartphone scrolling for commuters & Anak SCBD
  if (
    ag.panicTimer <= 0 &&
    ag.crowdTimer <= 0 &&
    (ag.filmTimer ?? 0) <= 0 &&
    (ag.chatTimer ?? 0) <= 0 &&
    (ag.phoneTimer ?? 0) <= 0 &&
    (ag.cheerTimer ?? 0) <= 0 &&
    (ag.interactCooldown ?? 0) <= 0 &&
    ag.archetype !== 'jogger' &&
    Math.sin(ag.phase * 0.73) > 0.996
  ) {
    ag.phoneTimer = 2.8;
    ag.interactCooldown = 10.5;
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

  if (ag.state === 'CHEERING') {
    ag.cheerTimer = Math.max(0, (ag.cheerTimer ?? 0) - dt);
    const tx = ag.filmTargetX ?? playerX;
    const tz = ag.filmTargetZ ?? playerZ;
    const facing = Math.atan2(tx - ag.x, tz - ag.z);
    ag.phase += dt * 9.5;
    return { facing, moving: false, state: ag.state };
  }

  if (ag.state === 'FILMING') {
    ag.filmTimer = Math.max(0, (ag.filmTimer ?? 0) - dt);
    const tx = ag.filmTargetX ?? playerX;
    const tz = ag.filmTargetZ ?? playerZ;
    const facing = Math.atan2(tx - ag.x, tz - ag.z);
    return { facing, moving: false, state: ag.state };
  }

  if (ag.state === 'CHATTING') {
    ag.chatTimer = Math.max(0, (ag.chatTimer ?? 0) - dt);
    const tx = ag.chatPartnerX ?? ag.x;
    const tz = ag.chatPartnerZ ?? ag.z + 1;
    const facing = Math.atan2(tx - ag.x, tz - ag.z);
    ag.phase += dt * 2.5;
    return { facing, moving: false, state: ag.state };
  }

  if (ag.state === 'BROWSING_PHONE') {
    ag.phoneTimer = Math.max(0, (ag.phoneTimer ?? 0) - dt);
    const facing =
      ag.axis === 'ns'
        ? ag.dir > 0
          ? 0
          : Math.PI
        : ag.dir > 0
        ? Math.PI / 2
        : -Math.PI / 2;
    ag.phase += dt * 1.4;
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

  const speedMult =
    ag.state === 'JOGGING'
      ? 1.72
      : ag.state === 'CROSSING_AT_GREEN'
      ? 1.28
      : 1.0;
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
  ag.phase +=
    dt *
    (ag.state === 'JOGGING'
      ? 8.8
      : ag.state === 'CROSSING_AT_GREEN'
      ? 6.8
      : 5.2);

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
      ag.chatTimer = 0;
      ag.phoneTimer = 0;
      ag.state = 'FILMING';
      filmers++;
      if (filmers >= 6) break;
    }
  }
  return filmers;
}

export function triggerCrowdCheerNear(
  agents: PedestrianAiAgent[],
  worldX: number,
  worldZ: number,
  radius: number = 22,
  durationSec: number = 3.8
): number {
  let cheered = 0;
  for (let i = 0; i < agents.length; i++) {
    const ag = agents[i];
    const dist = Math.hypot(ag.x - worldX, ag.z - worldZ);
    if (dist <= radius && ag.panicTimer <= 0) {
      ag.cheerTimer = durationSec;
      ag.filmTargetX = worldX;
      ag.filmTargetZ = worldZ;
      ag.crowdTimer = 0;
      ag.chatTimer = 0;
      ag.phoneTimer = 0;
      ag.state = 'CHEERING';
      cheered++;
      if (cheered >= 8) break;
    }
  }
  return cheered;
}

export function stepPedestrianInteractions(
  agents: PedestrianAiAgent[],
  activeCount: number
): number {
  const limit = Math.min(activeCount, agents.length);
  let pairsStarted = 0;
  for (let i = 0; i < limit && pairsStarted < 2; i++) {
    const a = agents[i];
    if (
      a.panicTimer > 0 ||
      a.crowdTimer > 0 ||
      (a.filmTimer ?? 0) > 0 ||
      (a.chatTimer ?? 0) > 0 ||
      (a.cheerTimer ?? 0) > 0 ||
      (a.interactCooldown ?? 0) > 0 ||
      a.archetype === 'jogger'
    ) {
      continue;
    }
    for (let j = i + 1; j < limit; j++) {
      const b = agents[j];
      if (
        b.panicTimer > 0 ||
        b.crowdTimer > 0 ||
        (b.filmTimer ?? 0) > 0 ||
        (b.chatTimer ?? 0) > 0 ||
        (b.cheerTimer ?? 0) > 0 ||
        (b.interactCooldown ?? 0) > 0 ||
        b.archetype === 'jogger'
      ) {
        continue;
      }
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      if (dx * dx + dz * dz < 2.2 * 2.2) {
        a.chatTimer = 3.2;
        b.chatTimer = 3.2;
        a.chatPartnerX = b.x;
        a.chatPartnerZ = b.z;
        b.chatPartnerX = a.x;
        b.chatPartnerZ = a.z;
        a.interactCooldown = 14;
        b.interactCooldown = 14;
        a.state = 'CHATTING';
        b.state = 'CHATTING';
        pairsStarted++;
        break;
      }
    }
  }
  return pairsStarted;
}

export function recycleDistantPedestrianInPlace(
  ag: PedestrianAiAgent,
  playerX: number,
  playerZ: number,
  sidewalks: readonly {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }[],
  seedIndex: number,
  maxDistSq: number = 108 * 108
): boolean {
  if (sidewalks.length === 0) return false;
  const dx = ag.x - playerX;
  const dz = ag.z - playerZ;
  if (dx * dx + dz * dz <= maxDistSq) {
    return false;
  }

  let chosenIdx = -1;
  let bestScore = Infinity;
  const start = Math.abs(seedIndex) % sidewalks.length;

  for (let k = 0; k < sidewalks.length; k++) {
    const idx = (start + k) % sidewalks.length;
    const sw = sidewalks[idx];
    const cx = (sw.minX + sw.maxX) * 0.5;
    const cz = (sw.minZ + sw.maxZ) * 0.5;
    const dist = Math.hypot(cx - playerX, cz - playerZ);
    // Prefer sidewalks around 18m..88m from player so NPCs stream in naturally ahead
    const penalty = dist < 16 ? 40 + (16 - dist) : dist > 92 ? dist * 1.4 : dist;
    if (penalty < bestScore) {
      bestScore = penalty;
      chosenIdx = idx;
      if (dist >= 18 && dist <= 72) break;
    }
  }

  if (chosenIdx < 0) return false;
  const rect = sidewalks[chosenIdx];
  const spanX = rect.maxX - rect.minX;
  const spanZ = rect.maxZ - rect.minZ;
  const axis: 'ns' | 'ew' = spanZ >= spanX ? 'ns' : 'ew';
  const padX = Math.min(0.55, spanX * 0.25);
  const padZ = Math.min(0.55, spanZ * 0.25);
  const fracA = ((seedIndex * 29 + 3) % 9) / 8;
  const fracB = ((seedIndex * 17 + 1) % 5) / 4;

  ag.minX = rect.minX;
  ag.maxX = rect.maxX;
  ag.minZ = rect.minZ;
  ag.maxZ = rect.maxZ;
  ag.axis = axis;
  ag.x =
    rect.minX +
    padX +
    Math.max(0, spanX - padX * 2) * (axis === 'ns' ? fracB : fracA);
  ag.z =
    rect.minZ +
    padZ +
    Math.max(0, spanZ - padZ * 2) * (axis === 'ns' ? fracA : fracB);
  ag.panicTimer = 0;
  ag.crowdTimer = 0;
  ag.filmTimer = 0;
  ag.chatTimer = 0;
  ag.phoneTimer = 0;
  ag.cheerTimer = 0;
  ag.interactCooldown = 2.0;
  ag.state = ag.archetype === 'jogger' ? 'JOGGING' : 'WALKING';
  return true;
}

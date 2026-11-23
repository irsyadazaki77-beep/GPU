import { isNearBuilding, isOnRoadway } from './spatial';

export interface RoadNavNode {
  id: string;
  x: number;
  z: number;
  label: string;
}

export interface RoadNavEdge {
  from: string;
  to: string;
  corridorName: string;
  distance: number;
}

export interface RoadNavRouteResult {
  /** Snapped road polyline from current position to target destination */
  points: Array<{ x: number; z: number }>;
  /** Total cumulative travel distance along the route in meters */
  totalDistanceM: number;
  /** Estimated driving time in seconds at urban cruising speed */
  estimatedTimeSec: number;
  /** Direction of the upcoming turn */
  nextTurnDirection: 'straight' | 'left' | 'right' | 'uturn' | 'arrived';
  /** Distance in meters to the next turn junction */
  distanceToNextTurnM: number;
  /** Name of the road corridor being entered or followed */
  nextCorridorName: string;
  /** Formatted Indonesian turn-by-turn HUD instruction */
  turnInstruction: string;
}

const ROAD_X_CORRIDORS: Array<{ x: number; name: string }> = [
  { x: -208, name: 'Tol JORR Barat' },
  { x: -128, name: 'Jl. Lingkar Luar Barat' },
  { x: -84, name: 'Jl. S. Parman / Antasari' },
  { x: -32, name: 'Jl. Medan Merdeka Barat' },
  { x: 0, name: 'Jl. MH Thamrin - Sudirman' },
  { x: 32, name: 'Jl. Medan Merdeka Timur' },
  { x: 84, name: 'Jl. HR Rasuna Said' },
  { x: 128, name: 'Jl. Bypass Lingkar Timur' },
  { x: 208, name: 'Tol JORR Timur' },
];

const ROAD_Z_CORRIDORS: Array<{ z: number; name: string }> = [
  { z: -66, name: 'Jl. Pantai Utara (Pantura)' },
  { z: -32, name: 'Jl. Medan Merdeka Utara' },
  { z: 0, name: 'Jl. Medan Merdeka / Kebon Sirih' },
  { z: 32, name: 'Bundaran HI / Jl. Imam Bonjol' },
  { z: 80, name: 'Jl. Gatot Subroto (Semanggi)' },
  { z: 128, name: 'Jl. Trunojoyo (Blok M)' },
  { z: 208, name: 'Jl. TB Simatupang (JORR)' },
];

interface InternalGraph {
  nodes: Map<string, RoadNavNode>;
  adj: Map<string, RoadNavEdge[]>;
  uniqueSegments: Array<{
    a: RoadNavNode;
    b: RoadNavNode;
    corridorName: string;
  }>;
}

let cachedGraph: InternalGraph | null = null;

function resolveCorridorName(x1: number, z1: number, x2: number, z2: number): string {
  const dx = Math.abs(x2 - x1);
  const dz = Math.abs(z2 - z1);
  if (dx < 1 && dz >= 1) {
    const midZ = (z1 + z2) * 0.5;
    if (Math.abs(x1) < 1) {
      return midZ < 0 ? 'Jl. Hayam Wuruk / Harmoni' : midZ <= 35 ? 'Jl. MH Thamrin' : 'Jl. Jend. Sudirman';
    }
    const found = ROAD_X_CORRIDORS.find((c) => Math.abs(c.x - x1) < 1.5);
    if (found) return found.name;
  }
  if (dz < 1 && dx >= 1) {
    const found = ROAD_Z_CORRIDORS.find((c) => Math.abs(c.z - z1) < 1.5);
    if (found) return found.name;
  }
  if (Math.abs(x1) <= 10.5 && Math.abs(z1) <= 10.5 && Math.abs(x2) <= 10.5 && Math.abs(z2) <= 10.5) {
    return 'Lingkar Plaza Monas';
  }
  return 'Jl. Arteri Jakarta';
}

function buildRoadNavGraph(): InternalGraph {
  if (cachedGraph) return cachedGraph;

  const nodes = new Map<string, RoadNavNode>();
  const adj = new Map<string, RoadNavEdge[]>();
  const uniqueSegments: Array<{
    a: RoadNavNode;
    b: RoadNavNode;
    corridorName: string;
  }> = [];

  const addNode = (id: string, x: number, z: number, label: string) => {
    nodes.set(id, { id, x, z, label });
    adj.set(id, []);
  };

  const addBidirectionalEdge = (idA: string, idB: string, customName?: string) => {
    const a = nodes.get(idA);
    const b = nodes.get(idB);
    if (!a || !b) return;
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const corridorName = customName ?? resolveCorridorName(a.x, a.z, b.x, b.z);
    adj.get(idA)!.push({ from: idA, to: idB, corridorName, distance: dist });
    adj.get(idB)!.push({ from: idB, to: idA, corridorName, distance: dist });
    uniqueSegments.push({ a, b, corridorName });
  };

  // 1. Add all primary orthogonal intersection nodes except (0, 0) which is occupied by Monas Monument
  for (const xc of ROAD_X_CORRIDORS) {
    for (const zc of ROAD_Z_CORRIDORS) {
      if (xc.x === 0 && zc.z === 0) continue;
      const id = `n_${xc.x}_${zc.z}`;
      addNode(id, xc.x, zc.z, `${xc.name} & ${zc.name}`);
    }
  }

  // 2. Add 8-node Monas Plaza Loop at +-6.8m (inside the +-7.2m roadway corridor and clear of Monas 11x11m base)
  const M = 6.8;
  addNode('monas_n', 0, -M, 'Simpang Monas Utara');
  addNode('monas_ne', M, -M, 'Simpang Monas Timur Laut');
  addNode('monas_e', M, 0, 'Simpang Monas Timur');
  addNode('monas_se', M, M, 'Simpang Monas Tenggara');
  addNode('monas_s', 0, M, 'Simpang Monas Selatan');
  addNode('monas_sw', -M, M, 'Simpang Monas Barat Daya');
  addNode('monas_w', -M, 0, 'Simpang Monas Barat');
  addNode('monas_nw', -M, -M, 'Simpang Monas Barat Laut');

  addBidirectionalEdge('monas_n', 'monas_ne', 'Lingkar Plaza Monas');
  addBidirectionalEdge('monas_ne', 'monas_e', 'Lingkar Plaza Monas');
  addBidirectionalEdge('monas_e', 'monas_se', 'Lingkar Plaza Monas');
  addBidirectionalEdge('monas_se', 'monas_s', 'Lingkar Plaza Monas');
  addBidirectionalEdge('monas_s', 'monas_sw', 'Lingkar Plaza Monas');
  addBidirectionalEdge('monas_sw', 'monas_w', 'Lingkar Plaza Monas');
  addBidirectionalEdge('monas_w', 'monas_nw', 'Lingkar Plaza Monas');
  addBidirectionalEdge('monas_nw', 'monas_n', 'Lingkar Plaza Monas');

  // Connect Monas Plaza Loop to the 4 cardinal arterial trunks
  addBidirectionalEdge('monas_n', 'n_0_-32', 'Jl. Medan Merdeka / Harmoni');
  addBidirectionalEdge('monas_s', 'n_0_32', 'Jl. MH Thamrin');
  addBidirectionalEdge('monas_w', 'n_-32_0', 'Jl. Medan Merdeka');
  addBidirectionalEdge('monas_e', 'n_32_0', 'Jl. Medan Merdeka');

  // 3. Connect N-S corridors along each X line
  for (const xc of ROAD_X_CORRIDORS) {
    for (let i = 0; i < ROAD_Z_CORRIDORS.length - 1; i++) {
      const zA = ROAD_Z_CORRIDORS[i].z;
      const zB = ROAD_Z_CORRIDORS[i + 1].z;
      // Skip segments that cross directly through (0, 0) since Monas loop connects them
      if (xc.x === 0 && ((zA === -32 && zB === 0) || (zA === 0 && zB === 32))) {
        continue;
      }
      addBidirectionalEdge(`n_${xc.x}_${zA}`, `n_${xc.x}_${zB}`);
    }
  }

  // 4. Connect E-W corridors along each Z line
  for (const zc of ROAD_Z_CORRIDORS) {
    for (let i = 0; i < ROAD_X_CORRIDORS.length - 1; i++) {
      const xA = ROAD_X_CORRIDORS[i].x;
      const xB = ROAD_X_CORRIDORS[i + 1].x;
      // Skip segments that cross directly through (0, 0) since Monas loop connects them
      if (zc.z === 0 && ((xA === -32 && xB === 0) || (xA === 0 && xB === 32))) {
        continue;
      }
      addBidirectionalEdge(`n_${xA}_${zc.z}`, `n_${xB}_${zc.z}`);
    }
  }

  cachedGraph = { nodes, adj, uniqueSegments };
  return cachedGraph;
}

export function getRoadNavNodes(): RoadNavNode[] {
  return Array.from(buildRoadNavGraph().nodes.values());
}

export function getRoadNavSegments(): Array<{
  a: RoadNavNode;
  b: RoadNavNode;
  corridorName: string;
}> {
  return buildRoadNavGraph().uniqueSegments;
}

function projectPointToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): { x: number; z: number; t: number; dist: number } {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) {
    return { x: ax, z: az, t: 0, dist: Math.hypot(px - ax, pz - az) };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
  const x = ax + t * vx;
  const z = az + t * vz;
  return { x, z, t, dist: Math.hypot(px - x, pz - z) };
}

function findNearestSegmentProjection(px: number, pz: number) {
  const graph = buildRoadNavGraph();
  let bestSeg = graph.uniqueSegments[0];
  let bestProj = projectPointToSegment(
    px,
    pz,
    bestSeg.a.x,
    bestSeg.a.z,
    bestSeg.b.x,
    bestSeg.b.z
  );

  for (let i = 1; i < graph.uniqueSegments.length; i++) {
    const seg = graph.uniqueSegments[i];
    const proj = projectPointToSegment(
      px,
      pz,
      seg.a.x,
      seg.a.z,
      seg.b.x,
      seg.b.z
    );
    if (proj.dist < bestProj.dist) {
      bestProj = proj;
      bestSeg = seg;
    }
  }
  return { segment: bestSeg, projection: bestProj };
}

/**
 * Computes the shortest drivable GPS road route from (startX, startZ) to (targetX, targetZ)
 * using A* search over the Jakarta arterial road graph, guaranteeing that road segments stay
 * on valid asphalt roadways and route around buildings and Monas monument.
 */
export function findRoadNavRoute(
  startX: number,
  startZ: number,
  targetX: number,
  targetZ: number
): RoadNavRouteResult {
  const directDist = Math.hypot(targetX - startX, targetZ - startZ);
  if (directDist <= 8.5) {
    return {
      points: [
        { x: startX, z: startZ },
        { x: targetX, z: targetZ },
      ],
      totalDistanceM: Math.round(directDist),
      estimatedTimeSec: Math.max(1, Math.round(directDist / 14)),
      nextTurnDirection: 'arrived',
      distanceToNextTurnM: Math.round(directDist),
      nextCorridorName: 'Tujuan',
      turnInstruction: 'Tiba di Destinasi',
    };
  }

  const graph = buildRoadNavGraph();
  const startSnap = findNearestSegmentProjection(startX, startZ);
  const targetSnap = findNearestSegmentProjection(targetX, targetZ);

  const rawPoints: Array<{ x: number; z: number }> = [];
  rawPoints.push({ x: startX, z: startZ });

  if (startSnap.projection.dist > 1.2) {
    rawPoints.push({ x: startSnap.projection.x, z: startSnap.projection.z });
  }

  // Case 1: Start and Target snap onto the exact same road segment
  const sameSegment =
    (startSnap.segment.a.id === targetSnap.segment.a.id &&
      startSnap.segment.b.id === targetSnap.segment.b.id) ||
    (startSnap.segment.a.id === targetSnap.segment.b.id &&
      startSnap.segment.b.id === targetSnap.segment.a.id);

  let firstCorridorName = startSnap.segment.corridorName;

  if (sameSegment) {
    rawPoints.push({ x: targetSnap.projection.x, z: targetSnap.projection.z });
  } else {
    // Run A* from virtual start (connected to startSnap.segment.a and .b)
    // to virtual goal (connected from targetSnap.segment.a and .b)
    const START_ID = '__virtual_start__';
    const GOAL_ID = '__virtual_goal__';

    const sx = startSnap.projection.x;
    const sz = startSnap.projection.z;
    const gx = targetSnap.projection.x;
    const gz = targetSnap.projection.z;

    const gScore = new Map<string, number>();
    const fScore = new Map<string, number>();
    const cameFrom = new Map<string, string>();
    const openSet = new Set<string>([START_ID]);

    gScore.set(START_ID, 0);
    fScore.set(START_ID, Math.hypot(gx - sx, gz - sz));

    const getNeighbors = (nodeId: string): Array<{ to: string; cost: number }> => {
      if (nodeId === START_ID) {
        const a = startSnap.segment.a;
        const b = startSnap.segment.b;
        return [
          { to: a.id, cost: Math.hypot(a.x - sx, a.z - sz) },
          { to: b.id, cost: Math.hypot(b.x - sx, b.z - sz) },
        ];
      }
      const list: Array<{ to: string; cost: number }> = [];
      const edges = graph.adj.get(nodeId) ?? [];
      for (const e of edges) {
        list.push({ to: e.to, cost: e.distance });
      }
      if (
        nodeId === targetSnap.segment.a.id ||
        nodeId === targetSnap.segment.b.id
      ) {
        const n = graph.nodes.get(nodeId)!;
        list.push({
          to: GOAL_ID,
          cost: Math.hypot(gx - n.x, gz - n.z),
        });
      }
      return list;
    };

    const getHeuristic = (nodeId: string): number => {
      if (nodeId === GOAL_ID) return 0;
      const n = graph.nodes.get(nodeId);
      if (!n) return 0;
      return Math.hypot(gx - n.x, gz - n.z);
    };

    while (openSet.size > 0) {
      let current = '';
      let bestF = Infinity;
      for (const candidate of openSet) {
        const f = fScore.get(candidate) ?? Infinity;
        if (f < bestF) {
          bestF = f;
          current = candidate;
        }
      }

      if (!current || current === GOAL_ID) break;
      openSet.delete(current);

      const currentG = gScore.get(current) ?? Infinity;
      for (const nb of getNeighbors(current)) {
        const tentativeG = currentG + nb.cost;
        if (tentativeG < (gScore.get(nb.to) ?? Infinity)) {
          cameFrom.set(nb.to, current);
          gScore.set(nb.to, tentativeG);
          fScore.set(nb.to, tentativeG + getHeuristic(nb.to));
          openSet.add(nb.to);
        }
      }
    }

    // Reconstruct node sequence
    const nodeChain: string[] = [];
    let curr: string | undefined = GOAL_ID;
    while (curr && curr !== START_ID) {
      if (curr !== GOAL_ID) {
        nodeChain.push(curr);
      }
      curr = cameFrom.get(curr);
    }
    nodeChain.reverse();

    for (const nid of nodeChain) {
      const n = graph.nodes.get(nid);
      if (n) {
        rawPoints.push({ x: n.x, z: n.z });
      }
    }
    rawPoints.push({ x: gx, z: gz });
  }

  if (targetSnap.projection.dist > 1.2) {
    rawPoints.push({ x: targetX, z: targetZ });
  }

  // Deduplicate and simplify colinear road points
  const deduped: Array<{ x: number; z: number }> = [];
  for (const pt of rawPoints) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.z - prev.z) > 0.75) {
      deduped.push(pt);
    }
  }

  const simplified: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < deduped.length; i++) {
    if (i === 0 || i === deduped.length - 1) {
      simplified.push(deduped[i]);
      continue;
    }
    const prev = simplified[simplified.length - 1];
    const curr = deduped[i];
    const next = deduped[i + 1];
    const v1x = curr.x - prev.x;
    const v1z = curr.z - prev.z;
    const v2x = next.x - curr.x;
    const v2z = next.z - curr.z;
    const l1 = Math.hypot(v1x, v1z);
    const l2 = Math.hypot(v2x, v2z);
    if (l1 > 0.1 && l2 > 0.1) {
      const dot = (v1x * v2x + v1z * v2z) / (l1 * l2);
      // If nearly colinear (same direction), collapse intermediate node
      if (dot > 0.996) {
        continue;
      }
    }
    simplified.push(curr);
  }

  if (simplified.length < 2) {
    simplified.push({ x: targetX, z: targetZ });
  }

  // Compute total path length
  let totalDist = 0;
  for (let i = 0; i < simplified.length - 1; i++) {
    totalDist += Math.hypot(
      simplified[i + 1].x - simplified[i].x,
      simplified[i + 1].z - simplified[i].z
    );
  }

  // Evaluate first significant turn
  let nextTurnDirection: RoadNavRouteResult['nextTurnDirection'] = 'straight';
  let distanceToNextTurnM = Math.round(
    Math.hypot(simplified[1].x - simplified[0].x, simplified[1].z - simplified[0].z)
  );

  if (simplified.length >= 3) {
    const p0 = simplified[0];
    const p1 = simplified[1];
    const p2 = simplified[2];
    const v1x = p1.x - p0.x;
    const v1z = p1.z - p0.z;
    const v2x = p2.x - p1.x;
    const v2z = p2.z - p1.z;
    const l1 = Math.hypot(v1x, v1z) || 1;
    const l2 = Math.hypot(v2x, v2z) || 1;

    // 2D cross product in XZ plane (where +X is East, +Z is South)
    // Heading vector (v1x, v1z) to (v2x, v2z):
    // cross = v1x * v2z - v1z * v2x
    // Positive cross in (+X right, +Z down screen) corresponds to a clockwise / RIGHT turn
    const cross = (v1x * v2z - v1z * v2x) / (l1 * l2);
    const dot = (v1x * v2x + v1z * v2z) / (l1 * l2);

    if (dot < -0.75) {
      nextTurnDirection = 'uturn';
    } else if (cross > 0.28) {
      nextTurnDirection = 'right';
    } else if (cross < -0.28) {
      nextTurnDirection = 'left';
    } else {
      nextTurnDirection = 'straight';
    }
    firstCorridorName = resolveCorridorName(p1.x, p1.z, p2.x, p2.z);
  } else {
    firstCorridorName = resolveCorridorName(
      simplified[0].x,
      simplified[0].z,
      simplified[1].x,
      simplified[1].z
    );
  }

  const turnPrefix =
    nextTurnDirection === 'left'
      ? `Belok Kiri ${distanceToNextTurnM}m`
      : nextTurnDirection === 'right'
      ? `Belok Kanan ${distanceToNextTurnM}m`
      : nextTurnDirection === 'uturn'
      ? `Putar Balik ${distanceToNextTurnM}m`
      : `Lurus ${Math.round(totalDist)}m`;

  const turnInstruction = `${turnPrefix} • ${firstCorridorName}`;

  return {
    points: simplified,
    totalDistanceM: Math.max(1, Math.round(totalDist)),
    estimatedTimeSec: Math.max(1, Math.round(totalDist / 14)),
    nextTurnDirection,
    distanceToNextTurnM: Math.max(1, distanceToNextTurnM),
    nextCorridorName: firstCorridorName,
    turnInstruction,
  };
}

/**
 * Verifies whether all intermediate road segments of a route stay on valid roadways
 * and clear of building footprints.
 */
export function isRoadNavRouteValid(route: RoadNavRouteResult): boolean {
  if (route.points.length < 2) return false;
  // Check intermediate snapped points (excluding raw off-road start/end endpoints)
  const startIdx = route.points.length > 2 ? 1 : 0;
  const endIdx = route.points.length > 2 ? route.points.length - 2 : route.points.length - 1;

  for (let i = startIdx; i < endIdx; i++) {
    const a = route.points[i];
    const b = route.points[i + 1];
    const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 4));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      if (!isOnRoadway(x, z) || isNearBuilding(x, z, 0.25)) {
        return false;
      }
    }
  }
  return true;
}

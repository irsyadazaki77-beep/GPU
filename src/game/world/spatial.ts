import type { BuildingFootprint } from '../types';
import { CITY_BUILDINGS, WORLD_MAX_BOUND } from './bounds';

export function hash2D(x: number, z: number): number {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export function isNearBuilding(x: number, z: number, pad: number = 4): boolean {
  for (const b of CITY_BUILDINGS) {
    if (
      Math.abs(x - b.x) < b.width * 0.5 + pad &&
      Math.abs(z - b.z) < b.depth * 0.5 + pad
    ) {
      return true;
    }
  }
  return false;
}

export function isOnRoadway(x: number, z: number): boolean {
  if (Math.abs(x) < 9.5 || Math.abs(z) < 9.5) return true;
  if (Math.abs(Math.abs(x) - 32) < 6.5 && Math.abs(z) < 82) return true;
  if (Math.abs(Math.abs(z) - 32) < 6.5 && Math.abs(x) < 82) return true;
  if (z >= -32 && z <= -20 && Math.abs(x) <= 72) return true;
  return false;
}

export interface SpatialEntry<T> {
  id: string;
  x: number;
  z: number;
  halfW: number;
  halfD: number;
  data: T;
}

/**
 * O(1) average-case Spatial Hash Grid for Jakarta buildings, obstacles, and dynamic actors.
 */
export class SpatialHashGrid<T> {
  public readonly cellSize: number;
  private cells = new Map<string, SpatialEntry<T>[]>();
  private entries = new Map<string, SpatialEntry<T>>();
  private queryStamp = 0;
  private visitedStamp = new Map<string, number>();

  constructor(cellSize: number = 16) {
    this.cellSize = Math.max(2, cellSize);
  }

  public get size(): number {
    return this.entries.size;
  }

  private cellCoord(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  private cellKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public clear(): void {
    this.cells.clear();
    this.entries.clear();
    this.visitedStamp.clear();
    this.queryStamp = 0;
  }

  public insert(
    id: string,
    x: number,
    z: number,
    halfW: number,
    halfD: number,
    data: T
  ): void {
    const entry: SpatialEntry<T> = {
      id,
      x,
      z,
      halfW: Math.max(0, halfW),
      halfD: Math.max(0, halfD),
      data,
    };
    this.entries.set(id, entry);

    const minCx = this.cellCoord(x - entry.halfW);
    const maxCx = this.cellCoord(x + entry.halfW);
    const minCz = this.cellCoord(z - entry.halfD);
    const maxCz = this.cellCoord(z + entry.halfD);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const key = this.cellKey(cx, cz);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(entry);
      }
    }
  }

  public queryAABB(
    minX: number,
    minZ: number,
    maxX: number,
    maxZ: number,
    out: T[] = []
  ): T[] {
    out.length = 0;
    const minCx = this.cellCoord(minX);
    const maxCx = this.cellCoord(maxX);
    const minCz = this.cellCoord(minZ);
    const maxCz = this.cellCoord(maxZ);

    this.queryStamp += 1;
    const stamp = this.queryStamp;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(this.cellKey(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const entry = bucket[i];
          if (this.visitedStamp.get(entry.id) === stamp) continue;
          this.visitedStamp.set(entry.id, stamp);

          if (
            entry.x + entry.halfW >= minX &&
            entry.x - entry.halfW <= maxX &&
            entry.z + entry.halfD >= minZ &&
            entry.z - entry.halfD <= maxZ
          ) {
            out.push(entry.data);
          }
        }
      }
    }
    return out;
  }

  public queryRadius(x: number, z: number, radius: number, out: T[] = []): T[] {
    out.length = 0;
    const r = Math.max(0, radius);
    const rSq = r * r;
    const minCx = this.cellCoord(x - r);
    const maxCx = this.cellCoord(x + r);
    const minCz = this.cellCoord(z - r);
    const maxCz = this.cellCoord(z + r);

    this.queryStamp += 1;
    const stamp = this.queryStamp;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(this.cellKey(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const entry = bucket[i];
          if (this.visitedStamp.get(entry.id) === stamp) continue;
          this.visitedStamp.set(entry.id, stamp);

          const closestX = Math.max(
            entry.x - entry.halfW,
            Math.min(x, entry.x + entry.halfW)
          );
          const closestZ = Math.max(
            entry.z - entry.halfD,
            Math.min(z, entry.z + entry.halfD)
          );
          const dx = x - closestX;
          const dz = z - closestZ;
          if (dx * dx + dz * dz <= rSq) {
            out.push(entry.data);
          }
        }
      }
    }
    return out;
  }

  public nearest(
    x: number,
    z: number,
    maxRadius: number
  ): { item: T; distance: number } | null {
    const r = Math.max(0, maxRadius);
    const rSq = r * r;
    const minCx = this.cellCoord(x - r);
    const maxCx = this.cellCoord(x + r);
    const minCz = this.cellCoord(z - r);
    const maxCz = this.cellCoord(z + r);

    this.queryStamp += 1;
    const stamp = this.queryStamp;

    let best: T | null = null;
    let bestDistSq = Infinity;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cz = minCz; cz <= maxCz; cz++) {
        const bucket = this.cells.get(this.cellKey(cx, cz));
        if (!bucket) continue;
        for (let i = 0; i < bucket.length; i++) {
          const entry = bucket[i];
          if (this.visitedStamp.get(entry.id) === stamp) continue;
          this.visitedStamp.set(entry.id, stamp);

          const closestX = Math.max(
            entry.x - entry.halfW,
            Math.min(x, entry.x + entry.halfW)
          );
          const closestZ = Math.max(
            entry.z - entry.halfD,
            Math.min(z, entry.z + entry.halfD)
          );
          const cdx = x - closestX;
          const cdz = z - closestZ;
          if (cdx * cdx + cdz * cdz <= rSq) {
            const dx = entry.x - x;
            const dz = entry.z - z;
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              best = entry.data;
            }
          }
        }
      }
    }

    return best !== null ? { item: best, distance: Math.sqrt(bestDistSq) } : null;
  }
}

export function createBuildingSpatialGrid(
  buildings: BuildingFootprint[] = CITY_BUILDINGS,
  cellSize: number = 18
): SpatialHashGrid<BuildingFootprint> {
  const grid = new SpatialHashGrid<BuildingFootprint>(cellSize);
  for (const b of buildings) {
    grid.insert(b.id, b.x, b.z, b.width * 0.5, b.depth * 0.5, b);
  }
  return grid;
}

const DEFAULT_BUILDING_GRID = createBuildingSpatialGrid(CITY_BUILDINGS, 18);
const _collisionScratch: BuildingFootprint[] = [];

export function resolveCircleAABBCollision(
  px: number,
  pz: number,
  radius: number,
  buildings?: BuildingFootprint[],
  grid?: SpatialHashGrid<BuildingFootprint>
): { x: number; z: number; collided: boolean } {
  let x = px;
  let z = pz;
  let collided = false;

  // World outer perimeter clamp (natural boundary at +-92m)
  const maxBound = WORLD_MAX_BOUND;
  if (x < -maxBound) {
    x = -maxBound;
    collided = true;
  } else if (x > maxBound) {
    x = maxBound;
    collided = true;
  }
  if (z < -maxBound) {
    z = -maxBound;
    collided = true;
  } else if (z > maxBound) {
    z = maxBound;
    collided = true;
  }

  let candidates: BuildingFootprint[];
  if (grid) {
    candidates = grid.queryAABB(
      x - radius - 2,
      z - radius - 2,
      x + radius + 2,
      z + radius + 2,
      _collisionScratch
    );
  } else if (!buildings) {
    candidates = DEFAULT_BUILDING_GRID.queryAABB(
      x - radius - 2,
      z - radius - 2,
      x + radius + 2,
      z + radius + 2,
      _collisionScratch
    );
  } else {
    candidates = buildings;
  }

  for (const b of candidates) {
    const halfW = b.width / 2;
    const halfD = b.depth / 2;
    const minX = b.x - halfW;
    const maxX = b.x + halfW;
    const minZ = b.z - halfD;
    const maxZ = b.z + halfD;

    const closestX = Math.max(minX, Math.min(x, maxX));
    const closestZ = Math.max(minZ, Math.min(z, maxZ));

    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      collided = true;
      const dist = Math.sqrt(distSq);
      if (dist > 0.0001) {
        const push = radius - dist;
        x += (dx / dist) * push;
        z += (dz / dist) * push;
      } else {
        const leftPen = Math.abs(x - minX);
        const rightPen = Math.abs(maxX - x);
        const topPen = Math.abs(z - minZ);
        const botPen = Math.abs(maxZ - z);
        const minPen = Math.min(leftPen, rightPen, topPen, botPen);
        if (minPen === leftPen) x = minX - radius;
        else if (minPen === rightPen) x = maxX + radius;
        else if (minPen === topPen) z = minZ - radius;
        else z = maxZ + radius;
      }
    }
  }

  return { x, z, collided };
}

const _camScratch: BuildingFootprint[] = [];

/**
 * Prevents the third-person camera boom from clipping inside city buildings
 * using exact ray-AABB slab intersection along the horizontal boom segment.
 */
export function resolveCameraWallPullIn(
  targetX: number,
  targetZ: number,
  desiredX: number,
  desiredY: number,
  desiredZ: number,
  grid?: SpatialHashGrid<BuildingFootprint>,
  padding: number = 0.65
): { x: number; y: number; z: number; pulledIn: boolean } {
  const dx = desiredX - targetX;
  const dz = desiredZ - targetZ;
  const minX = Math.min(targetX, desiredX) - padding;
  const maxX = Math.max(targetX, desiredX) + padding;
  const minZ = Math.min(targetZ, desiredZ) - padding;
  const maxZ = Math.max(targetZ, desiredZ) + padding;

  const activeGrid = grid ?? DEFAULT_BUILDING_GRID;
  const candidates = activeGrid.queryAABB(minX, minZ, maxX, maxZ, _camScratch);

  let bestT = 1.0;

  for (let i = 0; i < candidates.length; i++) {
    const b = candidates[i];
    if (desiredY > b.height + 0.35) continue;

    const bMinX = b.x - b.width * 0.5 - padding;
    const bMaxX = b.x + b.width * 0.5 + padding;
    const bMinZ = b.z - b.depth * 0.5 - padding;
    const bMaxZ = b.z + b.depth * 0.5 + padding;

    // Skip if target itself is inside padded AABB
    if (
      targetX >= bMinX &&
      targetX <= bMaxX &&
      targetZ >= bMinZ &&
      targetZ <= bMaxZ
    ) {
      continue;
    }

    let tMin = 0;
    let tMax = bestT;

    if (Math.abs(dx) < 1e-6) {
      if (targetX < bMinX || targetX > bMaxX) continue;
    } else {
      const invDx = 1 / dx;
      let tx1 = (bMinX - targetX) * invDx;
      let tx2 = (bMaxX - targetX) * invDx;
      if (tx1 > tx2) {
        const tmp = tx1;
        tx1 = tx2;
        tx2 = tmp;
      }
      tMin = Math.max(tMin, tx1);
      tMax = Math.min(tMax, tx2);
      if (tMin > tMax) continue;
    }

    if (Math.abs(dz) < 1e-6) {
      if (targetZ < bMinZ || targetZ > bMaxZ) continue;
    } else {
      const invDz = 1 / dz;
      let tz1 = (bMinZ - targetZ) * invDz;
      let tz2 = (bMaxZ - targetZ) * invDz;
      if (tz1 > tz2) {
        const tmp = tz1;
        tz1 = tz2;
        tz2 = tmp;
      }
      tMin = Math.max(tMin, tz1);
      tMax = Math.min(tMax, tz2);
      if (tMin > tMax) continue;
    }

    if (tMin > 0.02 && tMin < bestT) {
      bestT = tMin;
    }
  }

  if (bestT < 1.0) {
    const safeT = Math.max(0.24, bestT - 0.04);
    return {
      x: targetX + dx * safeT,
      y: desiredY + (1 - safeT) * 0.65,
      z: targetZ + dz * safeT,
      pulledIn: true,
    };
  }

  return { x: desiredX, y: desiredY, z: desiredZ, pulledIn: false };
}

/**
 * Advances a pedestrian smoothly along a rectangular sidewalk corridor
 * without wandering off curbs into traffic lanes or intersecting buildings.
 */
export function stepSidewalkPatrol(
  x: number,
  z: number,
  dir: 1 | -1,
  speed: number,
  dt: number,
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
  axis: 'ns' | 'ew',
  margin: number = 0.55
): { x: number; z: number; dir: 1 | -1 } {
  const safeMinX = Math.min(maxX, minX + margin);
  const safeMaxX = Math.max(minX, maxX - margin);
  const safeMinZ = Math.min(maxZ, minZ + margin);
  const safeMaxZ = Math.max(minZ, maxZ - margin);

  let nx = Math.max(safeMinX, Math.min(safeMaxX, x));
  let nz = Math.max(safeMinZ, Math.min(safeMaxZ, z));
  let nextDir = dir;

  if (axis === 'ns') {
    nz += nextDir * speed * dt;
    if (nz >= safeMaxZ) {
      nz = safeMaxZ;
      nextDir = -1;
    } else if (nz <= safeMinZ) {
      nz = safeMinZ;
      nextDir = 1;
    }
  } else {
    nx += nextDir * speed * dt;
    if (nx >= safeMaxX) {
      nx = safeMaxX;
      nextDir = -1;
    } else if (nx <= safeMinX) {
      nx = safeMinX;
      nextDir = 1;
    }
  }

  return { x: nx, z: nz, dir: nextDir };
}


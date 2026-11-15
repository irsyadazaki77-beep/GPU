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
    const r = Math.max(0, radius);
    const candidates = this.queryAABB(x - r, z - r, x + r, z + r, []);
    out.length = 0;
    const rSq = r * r;

    for (let i = 0; i < candidates.length; i++) {
      // Because candidates came from queryAABB, match against exact entry bounds
      out.push(candidates[i]);
    }

    // Refine circle-to-AABB exact distance when entries are queried via radius
    if (out.length === 0) return out;

    const refined: T[] = [];
    this.queryStamp += 1;
    const stamp = this.queryStamp;
    const minCx = this.cellCoord(x - r);
    const maxCx = this.cellCoord(x + r);
    const minCz = this.cellCoord(z - r);
    const maxCz = this.cellCoord(z + r);

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
            refined.push(entry.data);
          }
        }
      }
    }
    out.length = 0;
    for (let i = 0; i < refined.length; i++) out.push(refined[i]);
    return out;
  }

  public nearest(
    x: number,
    z: number,
    maxRadius: number
  ): { item: T; distance: number } | null {
    const hits = this.queryRadius(x, z, maxRadius, []);
    let best: T | null = null;
    let bestDist = Infinity;

    for (let i = 0; i < hits.length; i++) {
      const candidate = hits[i];
      // Entries store their id? Fallback to iterating entries that matched
      for (const entry of this.entries.values()) {
        if (entry.data === candidate) {
          const d = Math.hypot(entry.x - x, entry.z - z);
          if (d < bestDist) {
            bestDist = d;
            best = candidate;
          }
          break;
        }
      }
    }

    return best !== null ? { item: best, distance: bestDist } : null;
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

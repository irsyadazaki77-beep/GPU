import * as THREE from 'three';
import type { BuildingFootprint } from '../game/types';
import {
  buildDistrictLodGroup,
  computeLodRingAssignments,
  type LodTier,
} from './lodBuilder';

export const DEFAULT_CHUNK_SIZE_M = 250;

export interface ChunkCoord {
  chunkX: number;
  chunkZ: number;
}

export interface ChunkDiffResult {
  toLoad: string[];
  toUnload: string[];
  retained: string[];
}

export interface ExpansionZoneSpec {
  id: 'tanjung_priok_port' | 'semanggi_elevated_tollway' | 'jakarta_bay_kepulauan_seribu';
  name: string;
  subtitle: string;
  chunkKey: string;
  centerX: number;
  centerZ: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  waterLevelY?: number;
}

export const JAKARTA_EXPANSION_ZONES: ExpansionZoneSpec[] = [
  {
    id: 'tanjung_priok_port',
    name: 'Dermaga Kargo Pelabuhan Tanjung Priok',
    subtitle: 'Lapangan Kontainer Ekspor, Gantry Crane & Jalur Truk Dermaga',
    chunkKey: '0,-1',
    centerX: 62,
    centerZ: -64,
    bounds: { minX: 38, maxX: 88, minZ: -88, maxZ: -44 },
  },
  {
    id: 'semanggi_elevated_tollway',
    name: 'Tol Layang & Simpang Susun Semanggi',
    subtitle: 'Jalur Cepat Bertingkat, Ramp Spiral & Koridor Balap Malam',
    chunkKey: '0,-1',
    centerX: 0,
    centerZ: -26,
    bounds: { minX: -72, maxX: 72, minZ: -34, maxZ: -18 },
  },
  {
    id: 'jakarta_bay_kepulauan_seribu',
    name: 'Teluk Jakarta & Dermaga Kepulauan Seribu',
    subtitle: 'Perairan Laut Utara, Dermaga Speedboat & Pulau Karang',
    chunkKey: '-1,-1',
    centerX: -66,
    centerZ: -112,
    bounds: { minX: -158, maxX: 158, minZ: -158, maxZ: -72 },
    waterLevelY: -0.15,
  },
];

export interface LoadedChunkRecord {
  key: string;
  chunkX: number;
  chunkZ: number;
  lodRing: 'inner' | 'outer';
  lodTier: LodTier;
  group: THREE.Group;
  colliderIds: string[];
  buildingIds: string[];
  loadedAtMs: number;
}

export interface ChunkPhysicsBridge {
  registerChunkStaticBox?: (
    colliderId: string,
    x: number,
    y: number,
    z: number,
    halfW: number,
    halfH: number,
    halfD: number
  ) => void;
  unregisterChunkStaticBox?: (colliderId: string) => void;
}

/**
 * Converts world-space (x, z) meters into discrete 250m x 250m chunk coordinates.
 */
export function worldToChunkCoord(
  x: number,
  z: number,
  chunkSize: number = DEFAULT_CHUNK_SIZE_M
): ChunkCoord {
  const safeSize = Math.max(10, chunkSize);
  const chunkX = Math.floor((x + safeSize * 0.5) / safeSize);
  const chunkZ = Math.floor((z + safeSize * 0.5) / safeSize);
  return {
    chunkX: chunkX === 0 ? 0 : chunkX,
    chunkZ: chunkZ === 0 ? 0 : chunkZ,
  };
}

/**
 * Formats a deterministic spatial hash key "chunkX,chunkZ".
 */
export function getChunkKey(chunkX: number, chunkZ: number): string {
  const cx = chunkX === 0 ? 0 : chunkX;
  const cz = chunkZ === 0 ? 0 : chunkZ;
  return `${cx},${cz}`;
}

/**
 * Parses a "chunkX,chunkZ" string back into numeric coordinates.
 */
export function parseChunkKey(key: string): ChunkCoord | null {
  const parts = key.split(',');
  if (parts.length !== 2) return null;
  const chunkX = Number(parts[0]);
  const chunkZ = Number(parts[1]);
  if (!Number.isInteger(chunkX) || !Number.isInteger(chunkZ)) return null;
  return { chunkX, chunkZ };
}

/**
 * Returns the world-space center of a chunk.
 */
export function chunkCoordToWorldCenter(
  chunkX: number,
  chunkZ: number,
  chunkSize: number = DEFAULT_CHUNK_SIZE_M
): { x: number; z: number } {
  return {
    x: chunkX * chunkSize,
    z: chunkZ * chunkSize,
  };
}

/**
 * Enumerates all chunk keys within a Chebyshev radius around the given world position,
 * sorted nearest-first so frame-budgeted streaming loads the player's immediate chunk first.
 */
export function getChunksWithinRadius(
  worldX: number,
  worldZ: number,
  activeRadiusChunks: number = 1,
  chunkSize: number = DEFAULT_CHUNK_SIZE_M
): { key: string; chunkX: number; chunkZ: number; ringDistance: number }[] {
  const center = worldToChunkCoord(worldX, worldZ, chunkSize);
  const r = Math.max(0, Math.floor(activeRadiusChunks));
  const result: {
    key: string;
    chunkX: number;
    chunkZ: number;
    ringDistance: number;
  }[] = [];

  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      const cx = center.chunkX + dx;
      const cz = center.chunkZ + dz;
      const ringDistance = Math.max(Math.abs(dx), Math.abs(dz));
      result.push({
        key: getChunkKey(cx, cz),
        chunkX: cx,
        chunkZ: cz,
        ringDistance,
      });
    }
  }

  result.sort((a, b) => a.ringDistance - b.ringDistance);
  return result;
}

/**
 * Computes the deterministic diff between currently active chunk keys and desired target chunk keys.
 */
export function computeChunkDiff(
  currentLoadedKeys: Iterable<string>,
  targetKeys: Iterable<string>
): ChunkDiffResult {
  const currentSet = new Set(currentLoadedKeys);
  const targetSet = new Set(targetKeys);

  const toLoad: string[] = [];
  const toUnload: string[] = [];
  const retained: string[] = [];

  for (const key of targetSet) {
    if (currentSet.has(key)) {
      retained.push(key);
    } else {
      toLoad.push(key);
    }
  }

  for (const key of currentSet) {
    if (!targetSet.has(key)) {
      toUnload.push(key);
    }
  }

  return { toLoad, toUnload, retained };
}

/**
 * Determines whether a world coordinate is inside the Jakarta Bay & Kepulauan Seribu water zone.
 */
export function isInJakartaBayWaterZone(x: number, z: number): boolean {
  // Northern coastal water basin & Kepulauan Seribu channel
  if (z <= -72 && Math.abs(x) <= 158) {
    return true;
  }
  // Ancol-PIK western coastal marina inlet
  if (x <= -70 && z >= 46 && z <= 156) {
    return true;
  }
  return false;
}

function disposeObject3DResources(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        m?.dispose();
      }
    }
  });
}

/**
 * Frame-budgeted 250m x 250m Spatial Chunk Loader that streams district LOD groups,
 * expansion zone geometry, and Rapier static colliders around the player camera.
 */
export class SpatialChunkLoader {
  public readonly chunkSize: number;
  public readonly activeRadiusChunks: number;
  public readonly maxOpsPerFrame: number;

  private readonly scene: THREE.Scene;
  private readonly rootGroup: THREE.Group;
  private readonly buildingsByChunk = new Map<string, BuildingFootprint[]>();
  private readonly loadedChunks = new Map<string, LoadedChunkRecord>();
  private readonly pendingLoadQueue: {
    key: string;
    chunkX: number;
    chunkZ: number;
    ringDistance: number;
  }[] = [];
  private readonly pendingUnloadQueue: string[] = [];
  private physicsBridge: ChunkPhysicsBridge | null = null;
  private lastCenterKey: string | null = null;

  constructor(
    scene: THREE.Scene,
    buildings: BuildingFootprint[],
    options?: {
      chunkSize?: number;
      activeRadiusChunks?: number;
      maxOpsPerFrame?: number;
      physicsBridge?: ChunkPhysicsBridge;
    }
  ) {
    this.scene = scene;
    this.chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE_M;
    this.activeRadiusChunks = options?.activeRadiusChunks ?? 1;
    this.maxOpsPerFrame = options?.maxOpsPerFrame ?? 2;
    this.physicsBridge = options?.physicsBridge ?? null;

    this.rootGroup = new THREE.Group();
    this.rootGroup.name = 'SpatialChunkStreamRoot';
    this.scene.add(this.rootGroup);

    for (const b of buildings) {
      const coord = worldToChunkCoord(b.x, b.z, this.chunkSize);
      const key = getChunkKey(coord.chunkX, coord.chunkZ);
      const list = this.buildingsByChunk.get(key) || [];
      list.push(b);
      this.buildingsByChunk.set(key, list);
    }
  }

  public setPhysicsBridge(bridge: ChunkPhysicsBridge): void {
    this.physicsBridge = bridge;
  }

  public getLoadedChunkKeys(): string[] {
    return Array.from(this.loadedChunks.keys());
  }

  public getLoadedChunkCount(): number {
    return this.loadedChunks.size;
  }

  public getChunkRecord(key: string): LoadedChunkRecord | undefined {
    return this.loadedChunks.get(key);
  }

  /**
   * Queues chunk load/unload diffs when the player crosses chunk boundaries and
   * executes up to `maxOpsPerFrame` streaming operations per frame.
   */
  public updateAroundPlayer(
    playerX: number,
    playerZ: number,
    forceImmediate: boolean = false
  ): { loadedThisStep: string[]; unloadedThisStep: string[] } {
    const centerCoord = worldToChunkCoord(playerX, playerZ, this.chunkSize);
    const centerKey = getChunkKey(centerCoord.chunkX, centerCoord.chunkZ);

    if (centerKey !== this.lastCenterKey || this.loadedChunks.size === 0) {
      this.lastCenterKey = centerKey;
      const targetChunks = getChunksWithinRadius(
        playerX,
        playerZ,
        this.activeRadiusChunks,
        this.chunkSize
      );
      const targetMap = new Map(targetChunks.map((c) => [c.key, c]));
      const diff = computeChunkDiff(
        this.loadedChunks.keys(),
        targetMap.keys()
      );

      this.pendingLoadQueue.length = 0;
      for (const k of diff.toLoad) {
        const desc = targetMap.get(k);
        if (desc) {
          this.pendingLoadQueue.push(desc);
        }
      }

      this.pendingUnloadQueue.length = 0;
      for (const k of diff.toUnload) {
        this.pendingUnloadQueue.push(k);
      }

      // Update LOD ring assignments for retained chunks
      for (const k of diff.retained) {
        const rec = this.loadedChunks.get(k);
        const desc = targetMap.get(k);
        if (rec && desc) {
          const nextRing: 'inner' | 'outer' =
            desc.ringDistance === 0 ? 'inner' : 'outer';
          if (rec.lodRing !== nextRing) {
            rec.lodRing = nextRing;
            rec.lodTier = nextRing === 'inner' ? 'LOD0' : 'LOD2';
            this.applyChunkLodVisibility(rec, playerX, playerZ);
          }
        }
      }
    }

    const loadedThisStep: string[] = [];
    const unloadedThisStep: string[] = [];
    const budget = forceImmediate ? 999 : this.maxOpsPerFrame;
    let ops = 0;

    while (this.pendingUnloadQueue.length > 0 && ops < budget) {
      const unloadKey = this.pendingUnloadQueue.shift()!;
      if (this.unloadChunk(unloadKey)) {
        unloadedThisStep.push(unloadKey);
        ops++;
      }
    }

    while (this.pendingLoadQueue.length > 0 && ops < budget) {
      const next = this.pendingLoadQueue.shift()!;
      if (!this.loadedChunks.has(next.key)) {
        this.loadChunk(next.key, next.chunkX, next.chunkZ, next.ringDistance, playerX, playerZ);
        loadedThisStep.push(next.key);
        ops++;
      }
    }

    return { loadedThisStep, unloadedThisStep };
  }

  private applyChunkLodVisibility(
    rec: LoadedChunkRecord,
    playerX: number,
    playerZ: number
  ): void {
    const chunkBuildings = this.buildingsByChunk.get(rec.key) || [];
    const assignments = computeLodRingAssignments(
      chunkBuildings,
      playerX,
      playerZ
    );
    const tierById = new Map(assignments.map((a) => [a.id, a.tier]));

    rec.group.traverse((child) => {
      const bId = child.userData?.buildingId as string | undefined;
      if (bId && child.userData?.lodProxy) {
        const tier = tierById.get(bId) ?? rec.lodTier;
        child.visible = rec.lodRing === 'outer' || tier !== 'LOD0';
      }
    });
  }

  private loadChunk(
    key: string,
    chunkX: number,
    chunkZ: number,
    ringDistance: number,
    playerX: number,
    playerZ: number
  ): void {
    const lodRing: 'inner' | 'outer' = ringDistance === 0 ? 'inner' : 'outer';
    const lodTier: LodTier = lodRing === 'inner' ? 'LOD0' : 'LOD2';
    const chunkBuildings = this.buildingsByChunk.get(key) || [];

    const chunkGroup = new THREE.Group();
    chunkGroup.name = `chunk_${key}`;

    if (chunkBuildings.length > 0) {
      const lodProxyGroup = buildDistrictLodGroup(chunkBuildings);
      lodProxyGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.userData.lodProxy = true;
        }
      });
      lodProxyGroup.visible = lodRing === 'outer';
      chunkGroup.add(lodProxyGroup);
    }

    const colliderIds: string[] = [];
    for (const b of chunkBuildings) {
      const cid = `chunk_${key}_bldg_${b.id}`;
      colliderIds.push(cid);
      this.physicsBridge?.registerChunkStaticBox?.(
        cid,
        b.x,
        b.height * 0.5,
        b.z,
        b.width * 0.5,
        b.height * 0.5,
        b.depth * 0.5
      );
    }

    this.rootGroup.add(chunkGroup);

    const record: LoadedChunkRecord = {
      key,
      chunkX,
      chunkZ,
      lodRing,
      lodTier,
      group: chunkGroup,
      colliderIds,
      buildingIds: chunkBuildings.map((b) => b.id),
      loadedAtMs: Date.now(),
    };
    this.loadedChunks.set(key, record);
    this.applyChunkLodVisibility(record, playerX, playerZ);
  }

  private unloadChunk(key: string): boolean {
    const rec = this.loadedChunks.get(key);
    if (!rec) return false;

    for (const cid of rec.colliderIds) {
      this.physicsBridge?.unregisterChunkStaticBox?.(cid);
    }

    this.rootGroup.remove(rec.group);
    disposeObject3DResources(rec.group);
    this.loadedChunks.delete(key);
    return true;
  }

  public dispose(): void {
    for (const key of Array.from(this.loadedChunks.keys())) {
      this.unloadChunk(key);
    }
    this.scene.remove(this.rootGroup);
  }
}

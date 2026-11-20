import * as THREE from 'three';
import type { BuildingFootprint } from '../game/types';

/**
 * Wraps a high-detail Jakarta building group in a 3-tier THREE.LOD
 * (Level 0: 0–68m full detail, Level 1: 68–132m medium massing, Level 2: >132m silhouette proxy)
 * with frustum culling enabled to keep draw calls and vertex load low at 60 FPS.
 */
export function buildThreeTierBuildingLOD(
  spec: BuildingFootprint,
  highDetailGroup: THREE.Group
): THREE.LOD {
  const lod = new THREE.LOD();
  lod.position.copy(highDetailGroup.position);
  lod.rotation.copy(highDetailGroup.rotation);

  // Reset local transform on highDetailGroup since LOD holds the world position
  highDetailGroup.position.set(0, 0, 0);
  highDetailGroup.rotation.set(0, 0, 0);
  lod.addLevel(highDetailGroup, 0);

  // Reuse high-detail textured/emissive facade material on LOD1 so distant skyscrapers retain lit windows
  const highNightMats = highDetailGroup.userData.nightEmissiveMats as
    | THREE.MeshStandardMaterial[]
    | undefined;
  const medGroup = new THREE.Group();
  const medMat =
    highNightMats && highNightMats.length > 0
      ? highNightMats[0]
      : new THREE.MeshStandardMaterial({
          color: spec.primaryColor,
          roughness: 0.62,
          metalness: 0.28,
        });
  const bodyGeo = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
  bodyGeo.translate(0, spec.height * 0.5, 0);
  const bodyMesh = new THREE.Mesh(bodyGeo, medMat);
  bodyMesh.castShadow = false;
  bodyMesh.receiveShadow = true;
  medGroup.add(bodyMesh);

  const crownGeo = new THREE.BoxGeometry(
    spec.width * 0.82,
    Math.min(2.2, spec.height * 0.12),
    spec.depth * 0.82
  );
  crownGeo.translate(0, spec.height + 0.5, 0);
  const crownMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    roughness: 0.52,
    metalness: 0.32,
  });
  medGroup.add(new THREE.Mesh(crownGeo, crownMat));
  lod.addLevel(medGroup, 130);

  // Low-Detail Silhouette Tier (distance >= 210m): Single hull mesh
  const lowMat = new THREE.MeshBasicMaterial({
    color: spec.primaryColor,
  });
  const lowMesh = new THREE.Mesh(bodyGeo, lowMat);
  lod.addLevel(lowMesh, 210);

  lod.frustumCulled = true;
  return lod;
}

export type LodTier = 'LOD0' | 'LOD1' | 'LOD2';

export interface LodRingAssignment {
  id: string;
  distance: number;
  tier: LodTier;
}

/**
 * Assigns LOD0 (< 72m), LOD1 (72–135m), or LOD2 (> 135m) to a list of building footprints
 * relative to the active camera / player coordinate.
 */
export function computeLodRingAssignments(
  buildings: BuildingFootprint[],
  playerX: number,
  playerZ: number
): LodRingAssignment[] {
  return buildings.map((b) => {
    const distance = Math.hypot(b.x - playerX, b.z - playerZ);
    const tier: LodTier =
      distance < 72 ? 'LOD0' : distance < 135 ? 'LOD1' : 'LOD2';
    return { id: b.id, distance, tier };
  });
}

/**
 * Builds a lightweight proxy THREE.Group for a spatial chunk's buildings used by SpatialChunkLoader.
 */
export function buildDistrictLodGroup(buildings: BuildingFootprint[]): THREE.Group {
  const group = new THREE.Group();
  for (const b of buildings) {
    const geo = new THREE.BoxGeometry(b.width, b.height, b.depth);
    geo.translate(0, b.height * 0.5, 0);
    const mat = new THREE.MeshBasicMaterial({ color: b.primaryColor });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, 0, b.z);
    mesh.userData.buildingId = b.id;
    mesh.userData.lodProxy = true;
    group.add(mesh);
  }
  return group;
}


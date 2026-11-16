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

  // Medium-Detail Tier (distance >= 72m): Primary tower + roof crown
  const medGroup = new THREE.Group();
  const medMat = new THREE.MeshStandardMaterial({
    color: spec.primaryColor,
    roughness: 0.72,
    metalness: 0.18,
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
    roughness: 0.55,
    metalness: 0.25,
  });
  medGroup.add(new THREE.Mesh(crownGeo, crownMat));
  lod.addLevel(medGroup, 72);

  // Low-Detail Silhouette Tier (distance >= 135m): Single hull mesh
  const lowMat = new THREE.MeshBasicMaterial({
    color: spec.primaryColor,
  });
  const lowMesh = new THREE.Mesh(bodyGeo, lowMat);
  lod.addLevel(lowMesh, 135);

  lod.frustumCulled = true;
  return lod;
}

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { proceduralTextures } from '../../engine/ProceduralTextures';
import type { Point2D } from '../../engine/visualOverhaulMath';
import { SPBU_STATIONS } from '../tacticalGadgets';
import { isNearBuilding, isOnRoadway } from './spatial';

export interface JakartaDistrictPropsHandle {
  group: THREE.Group;
  lightAnchors: Point2D[];
  setWeatherTransition: (nightFactor: number, elapsedTime: number) => void;
  setSpbuDestroyedIds: (destroyedIds: readonly string[]) => void;
  updateDigitalVmsStatus: (
    headline: string,
    subline: string,
    accentColor: string
  ) => void;
  dispose: () => void;
}

/**
 * High-density instanced Jakarta district props focused on the two hero corridors:
 * 1. Sudirman–Thamrin CBD (North/Central boulevard):
 *    - Dedicated red TransJakarta busway inner corridor & separator curbs
 *    - TransJakarta Halte shelters with illuminated signage
 *    - Dense tropical boulevard palms & angsana canopy trees (InstancedMesh + setColorAt)
 *    - Granite sidewalk planters & bollards + Bundaran HI glowing fountain jets
 * 2. Blok M & Melawai (South shophouse & culinary district):
 *    - Utility poles with steel crossbars & drooping overhead cable spans (InstancedMesh + merged LineSegments)
 *    - Dense instanced gerobak / warung tenda stalls with colorful tarps & night-glowing hanging lanterns
 *    - Glowing vertical neon ruko signboards (InstancedMesh + setColorAt)
 *    - Dense tropical angsana street trees
 *
 * Also returns world-space light anchor coordinates so CityRenderer's pooled PointLights
 * smoothly cast real warm light pools onto nearby vehicles and sidewalks at dusk/night.
 */
export function buildJakartaDistrictProps(
  maxAnisotropy: number
): JakartaDistrictPropsHandle {
  const group = new THREE.Group();
  group.name = 'JakartaDistrictPropsGroup';

  const lightAnchors: Point2D[] = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // =========================================================================
  // 1. SUDIRMAN–THAMRIN TRANSJAKARTA SEPARATOR CURBS
  // =========================================================================
  // Instanced concrete separator curbs along the TransJakarta busway lane
  const curbCoords: { x: number; z: number }[] = [];
  for (let z = -60; z <= -22; z += 5.5) {
    if (Math.abs(z - -32) < 5) continue;
    curbCoords.push({ x: -2.6, z }, { x: 2.6, z });
  }
  for (let z = 46; z <= 120; z += 5.5) {
    if (Math.abs(z - 80) < 6) continue;
    curbCoords.push({ x: -2.6, z }, { x: 2.6, z });
  }
  const busCurbGeo = new THREE.BoxGeometry(0.22, 0.16, 2.4);
  const busCurbMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.78,
    metalness: 0.06,
  });
  const busCurbInst = new THREE.InstancedMesh(
    busCurbGeo,
    busCurbMat,
    curbCoords.length
  );
  curbCoords.forEach((c, idx) => {
    dummy.position.set(c.x, 0.09, c.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    busCurbInst.setMatrixAt(idx, dummy.matrix);
    color.setHex(idx % 2 === 0 ? 0xf8fafc : 0x1e293b);
    busCurbInst.setColorAt(idx, color);
  });
  busCurbInst.instanceMatrix.needsUpdate = true;
  if (busCurbInst.instanceColor) busCurbInst.instanceColor.needsUpdate = true;
  busCurbInst.computeBoundingSphere();
  group.add(busCurbInst);

  // =========================================================================
  // 2. ICONIC JAKARTA JPO (JEMBATAN PENYEBERANGAN ORANG) PHINISI SKYBRIDGES
  // =========================================================================
  const jpoSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.72,
    roughness: 0.34,
    envMapIntensity: 0.85,
  });
  const jpoSailMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    emissive: 0xc2410c,
    emissiveIntensity: 0.28,
    roughness: 0.4,
    metalness: 0.35,
  });
  const jpoGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.14,
    metalness: 0.25,
    clearcoat: 0.8,
    transparent: true,
    opacity: 0.48,
    envMapIntensity: 1.0,
  });
  const jpoLedMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.15,
    roughness: 0.25,
  });

  for (const jpoZ of [-42, 54]) {
    const jpoGrp = new THREE.Group();
    jpoGrp.position.set(0, 0, jpoZ);

    // Main overhead pedestrian deck (5.4m clearance above Sudirman road)
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(17.6, 0.34, 2.4),
      jpoSteelMat
    );
    deck.position.y = 5.4;
    deck.castShadow = true;
    deck.receiveShadow = true;
    jpoGrp.add(deck);

    // Warm LED under-deck & side architectural light strips
    for (const sz of [-1.22, 1.22]) {
      const ledStrip = new THREE.Mesh(
        new THREE.BoxGeometry(17.2, 0.12, 0.08),
        jpoLedMat
      );
      ledStrip.position.set(0, 5.42, sz);
      jpoGrp.add(ledStrip);

      const railGlass = new THREE.Mesh(
        new THREE.BoxGeometry(16.8, 1.15, 0.08),
        jpoGlassMat
      );
      railGlass.position.set(0, 6.1, sz * 0.94);
      jpoGrp.add(railGlass);
    }

    // Iconic Phinisi sculptural arch ribs curving over the bridge deck
    for (let ri = -3; ri <= 3; ri++) {
      const rx = ri * 2.2;
      const archH = 2.6 - Math.abs(ri) * 0.38;
      const archRib = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, archH, 2.65),
        jpoSailMat
      );
      archRib.position.set(rx, 5.5 + archH * 0.5, 0);
      jpoGrp.add(archRib);
    }
    const spineBeam = new THREE.Mesh(
      new THREE.BoxGeometry(15.6, 0.22, 0.45),
      jpoSailMat
    );
    spineBeam.position.set(0, 8.05, 0);
    jpoGrp.add(spineBeam);

    // Left & Right sidewalk support piers + stepped access ramps
    for (const sideX of [-8.4, 8.4]) {
      const pier = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 5.5, 1.8),
        jpoSteelMat
      );
      pier.position.set(sideX, 2.75, 0);
      pier.castShadow = true;
      jpoGrp.add(pier);

      const stairRamp = new THREE.Mesh(
        new THREE.BoxGeometry(1.25, 0.28, 6.4),
        jpoSteelMat
      );
      stairRamp.position.set(sideX + (sideX < 0 ? -0.35 : 0.35), 2.7, 3.1);
      stairRamp.rotation.x = 0.72;
      jpoGrp.add(stairRamp);
    }

    group.add(jpoGrp);
    lightAnchors.push({ x: -7.5, z: jpoZ }, { x: 7.5, z: jpoZ });
  }

  // =========================================================================
  // 3. BLOK M & RUKO UTILITY POLES + CROSSBARS + OVERHEAD CABLE SPANS
  // =========================================================================
  const utilityChains: Point2D[][] = [
    // Blok M South-West Ruko corridor
    [
      { x: -11.4, z: 38 },
      { x: -11.4, z: 48 },
      { x: -11.4, z: 58 },
      { x: -11.4, z: 68 },
    ],
    // Blok M / Melawai South-East culinary strip
    [
      { x: 11.4, z: 38 },
      { x: 11.4, z: 48 },
      { x: 11.4, z: 58 },
      { x: 11.4, z: 68 },
    ],
    // Blok M horizontal Melawai alley (Z = 42)
    [
      { x: -38, z: 41.5 },
      { x: -24, z: 41.5 },
      { x: -11.4, z: 41.5 },
      { x: 11.4, z: 41.5 },
      { x: 24, z: 41.5 },
      { x: 38, z: 41.5 },
    ],
    // Kebon Kacang / Tanah Abang west ruko strip
    [
      { x: -38.5, z: 12 },
      { x: -38.5, z: 22 },
      { x: -38.5, z: 32 },
    ],
  ];

  const utilPoles: { x: number; z: number; rotY: number }[] = [];
  const cableSegments: number[] = [];

  for (const chain of utilityChains) {
    const validNodes: Point2D[] = [];
    for (let i = 0; i < chain.length; i++) {
      const pt = chain[i];
      if (isNearBuilding(pt.x, pt.z, 1.2) || isOnRoadway(pt.x, pt.z)) continue;
      validNodes.push(pt);
      const next = chain[i + 1] || chain[i - 1];
      const rotY = next ? Math.atan2(next.x - pt.x, next.z - pt.z) : 0;
      utilPoles.push({ x: pt.x, z: pt.z, rotY });
      lightAnchors.push({ x: pt.x, z: pt.z });
    }

    // Build drooping catenary overhead wire segments between adjacent poles
    for (let i = 0; i < validNodes.length - 1; i++) {
      const a = validNodes[i];
      const b = validNodes[i + 1];
      const segs = 5;
      for (const wireH of [6.85, 6.25]) {
        for (const sideOff of [-0.55, 0.55]) {
          const dx = b.x - a.x;
          const dz = b.z - a.z;
          const len = Math.hypot(dx, dz) || 1;
          const perpX = (-dz / len) * sideOff;
          const perpZ = (dx / len) * sideOff;

          for (let s = 0; s < segs; s++) {
            const t0 = s / segs;
            const t1 = (s + 1) / segs;
            const sag0 = Math.sin(t0 * Math.PI) * 0.45;
            const sag1 = Math.sin(t1 * Math.PI) * 0.45;

            cableSegments.push(
              a.x + dx * t0 + perpX,
              wireH - sag0,
              a.z + dz * t0 + perpZ,
              a.x + dx * t1 + perpX,
              wireH - sag1,
              a.z + dz * t1 + perpZ
            );
          }
        }
      }
    }
  }

  const utilPoleMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    roughness: 0.72,
    metalness: 0.48,
    envMapIntensity: 0.55,
  });
  const utilPoleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7.6, 7);
  utilPoleGeo.translate(0, 3.8, 0);
  const utilCrossGeo = new THREE.BoxGeometry(1.45, 0.1, 0.12);
  utilCrossGeo.translate(0, 6.95, 0);
  const utilTransGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.75, 8);
  utilTransGeo.translate(0.28, 5.9, 0);

  if (utilPoles.length > 0) {
    const poleInst = new THREE.InstancedMesh(
      utilPoleGeo,
      utilPoleMat,
      utilPoles.length
    );
    const crossInst = new THREE.InstancedMesh(
      utilCrossGeo,
      utilPoleMat,
      utilPoles.length
    );
    const transInst = new THREE.InstancedMesh(
      utilTransGeo,
      utilPoleMat,
      utilPoles.length
    );
    poleInst.castShadow = true;

    utilPoles.forEach((p, idx) => {
      dummy.position.set(p.x, 0, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poleInst.setMatrixAt(idx, dummy.matrix);
      crossInst.setMatrixAt(idx, dummy.matrix);
      dummy.scale.setScalar(idx % 3 === 0 ? 1 : 0.001);
      dummy.updateMatrix();
      transInst.setMatrixAt(idx, dummy.matrix);
    });
    poleInst.instanceMatrix.needsUpdate = true;
    crossInst.instanceMatrix.needsUpdate = true;
    transInst.instanceMatrix.needsUpdate = true;
    poleInst.computeBoundingSphere();
    crossInst.computeBoundingSphere();
    transInst.computeBoundingSphere();
    group.add(poleInst, crossInst, transInst);
  }

  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(cableSegments, 3)
  );
  const cableMat = new THREE.LineBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.78,
  });
  const cableLines = new THREE.LineSegments(cableGeo, cableMat);
  group.add(cableLines);

  // =========================================================================
  // 4. INSTANCED GEROBAK & WARUNG TENDA STALLS (Blok M, Melawai & Side Streets)
  // =========================================================================
  const stallCandidates: { x: number; z: number; rotY: number; color: number }[] = [
    // Blok M & Melawai vibrant culinary row
    { x: -11.2, z: 43, rotY: Math.PI / 2, color: 0xea580c },
    { x: -11.2, z: 50, rotY: Math.PI / 2, color: 0x0284c7 },
    { x: -11.2, z: 57, rotY: Math.PI / 2, color: 0x16a34a },
    { x: -11.2, z: 64, rotY: Math.PI / 2, color: 0xdc2626 },
    { x: 11.2, z: 43, rotY: -Math.PI / 2, color: 0xd97706 },
    { x: 11.2, z: 50, rotY: -Math.PI / 2, color: 0x2563eb },
    { x: 11.2, z: 57, rotY: -Math.PI / 2, color: 0xea580c },
    { x: 11.2, z: 64, rotY: -Math.PI / 2, color: 0x15803d },
    { x: -20, z: 43, rotY: 0, color: 0xc2410c },
    { x: -27, z: 43, rotY: 0, color: 0x0369a1 },
    { x: 19, z: 43, rotY: 0, color: 0xb91c1c },
    { x: 28, z: 43, rotY: 0, color: 0x047857 },
    // Sudirman–Thamrin side-plaza coffee & street carts
    { x: -11.5, z: -38, rotY: Math.PI / 2, color: 0x0284c7 },
    { x: 11.5, z: -38, rotY: -Math.PI / 2, color: 0xd97706 },
    { x: -11.5, z: -55, rotY: Math.PI / 2, color: 0x16a34a },
    { x: 11.5, z: -55, rotY: -Math.PI / 2, color: 0xea580c },
    // Monas South & Spawn sightline flanking carts
    { x: -10.8, z: 16, rotY: Math.PI / 2, color: 0xea580c },
    { x: 10.8, z: 16, rotY: -Math.PI / 2, color: 0x0284c7 },
  ];

  const validStalls = stallCandidates.filter(
    (s) => !isNearBuilding(s.x, s.z, 1.5) && !isOnRoadway(s.x, s.z)
  );

  const warungLanternMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.4,
    roughness: 0.25,
  });

  if (validStalls.length > 0) {
    const cartWoodMat = new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      roughness: 0.84,
      metalness: 0.05,
    });
    const tarpMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.04,
      envMapIntensity: 0.25,
    });

    const cartGeo = new THREE.BoxGeometry(2.2, 0.95, 1.15);
    cartGeo.translate(0, 0.62, 0);
    const tarpGeo = new THREE.ConeGeometry(1.95, 0.82, 4);
    tarpGeo.rotateY(Math.PI / 4);
    tarpGeo.translate(0, 2.48, 0);
    const lanternGeo = new THREE.SphereGeometry(0.16, 8, 8);
    lanternGeo.translate(0, 2.02, 0.48);

    const cartInst = new THREE.InstancedMesh(
      cartGeo,
      cartWoodMat,
      validStalls.length
    );
    const tarpInst = new THREE.InstancedMesh(
      tarpGeo,
      tarpMat,
      validStalls.length
    );
    const lanternInst = new THREE.InstancedMesh(
      lanternGeo,
      warungLanternMat,
      validStalls.length
    );
    cartInst.castShadow = true;
    tarpInst.castShadow = true;

    validStalls.forEach((st, idx) => {
      dummy.position.set(st.x, 0.08, st.z);
      dummy.rotation.set(0, st.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      cartInst.setMatrixAt(idx, dummy.matrix);
      tarpInst.setMatrixAt(idx, dummy.matrix);
      lanternInst.setMatrixAt(idx, dummy.matrix);

      color.setHex(st.color);
      tarpInst.setColorAt(idx, color);
      lightAnchors.push({ x: st.x, z: st.z });
    });
    cartInst.instanceMatrix.needsUpdate = true;
    tarpInst.instanceMatrix.needsUpdate = true;
    lanternInst.instanceMatrix.needsUpdate = true;
    if (tarpInst.instanceColor) tarpInst.instanceColor.needsUpdate = true;
    cartInst.computeBoundingSphere();
    tarpInst.computeBoundingSphere();
    lanternInst.computeBoundingSphere();

    group.add(cartInst, tarpInst, lanternInst);
  }

  // =========================================================================
  // 5. BLOK M & SUDIRMAN GLOWING VERTICAL NEON SHOP SIGNBOARDS (InstancedMesh)
  // =========================================================================
  const neonBoardSpots: { x: number; z: number; rotY: number; hex: number }[] = [
    { x: -14.2, z: 48, rotY: Math.PI / 2, hex: 0xf43f5e },
    { x: -14.2, z: 54, rotY: Math.PI / 2, hex: 0x38bdf8 },
    { x: -14.2, z: 60, rotY: Math.PI / 2, hex: 0xfacc15 },
    { x: 14.2, z: 48, rotY: -Math.PI / 2, hex: 0x22d3ee },
    { x: 14.2, z: 54, rotY: -Math.PI / 2, hex: 0xf97316 },
    { x: 14.2, z: 60, rotY: -Math.PI / 2, hex: 0xa855f7 },
    { x: -14.8, z: -42, rotY: Math.PI / 2, hex: 0x38bdf8 },
    { x: 14.8, z: -42, rotY: -Math.PI / 2, hex: 0xfbbf24 },
    { x: -14.8, z: -64, rotY: Math.PI / 2, hex: 0x2dd4bf },
    { x: 14.8, z: -64, rotY: -Math.PI / 2, hex: 0xf43f5e },
  ];

  const neonBoardMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.9,
    roughness: 0.28,
  });
  const neonBoardGeo = new THREE.BoxGeometry(0.18, 2.4, 0.85);
  const neonBoardInst = new THREE.InstancedMesh(
    neonBoardGeo,
    neonBoardMat,
    neonBoardSpots.length
  );
  neonBoardSpots.forEach((nb, idx) => {
    dummy.position.set(nb.x, 4.4, nb.z);
    dummy.rotation.set(0, nb.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    neonBoardInst.setMatrixAt(idx, dummy.matrix);
    color.setHex(nb.hex);
    neonBoardInst.setColorAt(idx, color);
  });
  neonBoardInst.instanceMatrix.needsUpdate = true;
  if (neonBoardInst.instanceColor) neonBoardInst.instanceColor.needsUpdate = true;
  neonBoardInst.computeBoundingSphere();
  group.add(neonBoardInst);

  // =========================================================================
  // 6. DENSE TROPICAL BOULEVARD TREES & SUDIRMAN PLANTERS (InstancedMesh)
  // =========================================================================
  const districtTrees: { x: number; z: number; scale: number }[] = [];
  // Sudirman–Thamrin lush double-side boulevard trees
  for (let z = -74; z <= -36; z += 7.5) {
    for (const sx of [-10.4, 10.4]) {
      if (!isNearBuilding(sx, z, 1.8) && !isOnRoadway(sx, z)) {
        districtTrees.push({
          x: sx,
          z,
          scale: 0.85 + ((Math.abs(z * 13) % 28) / 100),
        });
      }
    }
  }
  // Blok M & Monas south shade trees
  for (let z = 38; z <= 74; z += 8.5) {
    for (const sx of [-10.6, 10.6]) {
      if (!isNearBuilding(sx, z, 1.8) && !isOnRoadway(sx, z)) {
        districtTrees.push({
          x: sx,
          z,
          scale: 0.9 + ((Math.abs(z * 17) % 25) / 100),
        });
      }
    }
  }

  if (districtTrees.length > 0) {
    const planterGeo = new THREE.BoxGeometry(1.15, 0.42, 1.15);
    planterGeo.translate(0, 0.21, 0);
    const planterMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.86,
      metalness: 0.06,
    });
    const dTrunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 3.6, 6);
    dTrunkGeo.translate(0, 1.8, 0);
    const dTrunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.92,
      flatShading: true,
    });
    const dCrownGeo = new THREE.DodecahedronGeometry(1.42, 0);
    dCrownGeo.scale(1.18, 0.72, 1.12);
    dCrownGeo.translate(0.06, 3.95, -0.04);
    const dCrownSubGeo = new THREE.DodecahedronGeometry(1.04, 0);
    dCrownSubGeo.scale(1.12, 0.68, 1.18);
    dCrownSubGeo.translate(-0.78, 4.48, 0.42);
    const dCrownMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
      envMapIntensity: 0.16,
    });

    const planterInst = new THREE.InstancedMesh(
      planterGeo,
      planterMat,
      districtTrees.length
    );
    const dTrunkInst = new THREE.InstancedMesh(
      dTrunkGeo,
      dTrunkMat,
      districtTrees.length
    );
    const dCrownInst = new THREE.InstancedMesh(
      dCrownGeo,
      dCrownMat,
      districtTrees.length
    );
    const dCrownSubInst = new THREE.InstancedMesh(
      dCrownSubGeo,
      dCrownMat,
      districtTrees.length
    );
    dCrownInst.castShadow = true;
    dCrownSubInst.castShadow = true;

    districtTrees.forEach((tr, idx) => {
      dummy.position.set(tr.x, 0.08, tr.z);
      dummy.rotation.set(0, idx * 1.17, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      planterInst.setMatrixAt(idx, dummy.matrix);

      dummy.rotation.set(
        Math.sin(idx * 1.9) * 0.075,
        idx * 1.618,
        Math.cos(idx * 1.3) * 0.075
      );
      dummy.scale.set(
        tr.scale * (0.9 + (idx % 3) * 0.1),
        tr.scale * (0.92 + ((idx + 1) % 3) * 0.09),
        tr.scale * (0.9 + ((idx + 2) % 3) * 0.1)
      );
      dummy.updateMatrix();
      dTrunkInst.setMatrixAt(idx, dummy.matrix);
      dCrownInst.setMatrixAt(idx, dummy.matrix);
      dCrownSubInst.setMatrixAt(idx, dummy.matrix);

      color.setHSL(
        0.31 + ((idx % 7) - 3) * 0.018,
        0.56 + (idx % 3) * 0.06,
        0.18 + (idx % 4) * 0.032
      );
      dCrownInst.setColorAt(idx, color);
      color.offsetHSL(0.025, 0.03, 0.045);
      dCrownSubInst.setColorAt(idx, color);
    });
    planterInst.instanceMatrix.needsUpdate = true;
    dTrunkInst.instanceMatrix.needsUpdate = true;
    dCrownInst.instanceMatrix.needsUpdate = true;
    dCrownSubInst.instanceMatrix.needsUpdate = true;
    if (dCrownInst.instanceColor) dCrownInst.instanceColor.needsUpdate = true;
    if (dCrownSubInst.instanceColor)
      dCrownSubInst.instanceColor.needsUpdate = true;
    planterInst.computeBoundingSphere();
    dTrunkInst.computeBoundingSphere();
    dCrownInst.computeBoundingSphere();
    dCrownSubInst.computeBoundingSphere();
    group.add(planterInst, dTrunkInst, dCrownInst, dCrownSubInst);
  }

  // =========================================================================
  // 7. ENHANCED BUNDARAN HI FOUNTAIN JETS & NIGHT WATER GLOW (0, 0, 32)
  // =========================================================================
  const fountainJetMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.58,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const fountainJetsGroup = new THREE.Group();
  fountainJetsGroup.position.set(0, 0.72, 32);
  const jetGeo = new THREE.ConeGeometry(0.14, 2.6, 6, 1, true);
  jetGeo.translate(0, 1.3, 0);
  const outerPlumes: THREE.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const jet = new THREE.Mesh(jetGeo, fountainJetMat);
    jet.position.set(Math.cos(ang) * 2.75, 0, Math.sin(ang) * 2.75);
    jet.rotation.z = Math.cos(ang) * 0.24;
    jet.rotation.x = -Math.sin(ang) * 0.24;
    fountainJetsGroup.add(jet);
    outerPlumes.push(jet);
  }
  // Inner high central crown plumes + animated surface ripple rings
  const innerCrownJetGeo = new THREE.ConeGeometry(0.18, 3.6, 8, 1, true);
  innerCrownJetGeo.translate(0, 1.8, 0);
  const innerCrownJets: THREE.Mesh[] = [];
  for (let c = 0; c < 4; c++) {
    const cAng = (c / 4) * Math.PI * 2 + Math.PI / 4;
    const cJet = new THREE.Mesh(innerCrownJetGeo, fountainJetMat);
    cJet.position.set(Math.cos(cAng) * 1.15, 0.1, Math.sin(cAng) * 1.15);
    cJet.rotation.z = Math.cos(cAng) * 0.12;
    cJet.rotation.x = -Math.sin(cAng) * 0.12;
    fountainJetsGroup.add(cJet);
    innerCrownJets.push(cJet);
  }
  const rippleRingMat = new THREE.MeshBasicMaterial({
    color: 0xbae6fd,
    transparent: true,
    opacity: 0.42,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const rippleGeo = new THREE.RingGeometry(1.6, 1.85, 24);
  rippleGeo.rotateX(-Math.PI / 2);
  const fountainRipples: THREE.Mesh[] = [];
  for (let r = 0; r < 2; r++) {
    const rip = new THREE.Mesh(rippleGeo, rippleRingMat);
    rip.position.set(0, 0.06, 0);
    fountainJetsGroup.add(rip);
    fountainRipples.push(rip);
  }
  group.add(fountainJetsGroup);
  lightAnchors.push({ x: 0, z: 32 });

  // =========================================================================
  // 7. 3 ICONIC SPBU PERTAMINA PASTI PAS FUEL & SERVICE STATIONS
  // =========================================================================
  const spbuCanopyWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.35,
    metalness: 0.25,
  });
  const spbuRedMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x991b1b,
    emissiveIntensity: 0.35,
    roughness: 0.32,
    metalness: 0.28,
  });
  const spbuBlueMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.35,
    roughness: 0.35,
    metalness: 0.3,
  });
  const spbuGreenMat = new THREE.MeshStandardMaterial({
    color: 0x16a34a,
    emissive: 0x15803d,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  const spbuCeilingGlowMat = new THREE.MeshBasicMaterial({
    color: 0xfefce8,
  });
  const spbuServiceRingMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const spbuCharredMat = new THREE.MeshStandardMaterial({
    color: 0x171717,
    emissive: 0x7c2d12,
    emissiveIntensity: 0.55,
    roughness: 0.92,
  });

  const spbuDispenserRefs = new Map<
    string,
    {
      intactGroup: THREE.Group;
      wreckGroup: THREE.Group;
      serviceRing: THREE.Mesh;
    }
  >();

  for (const st of SPBU_STATIONS) {
    const stGroup = new THREE.Group();
    stGroup.position.set(st.x, 0.05, st.z);
    stGroup.rotation.y = st.rotY;

    // Concrete forecourt apron slab
    const apron = new THREE.Mesh(
      new RoundedBoxGeometry(9.6, 0.14, 7.2, 2, 0.04),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 })
    );
    apron.position.y = 0.04;
    apron.receiveShadow = true;
    stGroup.add(apron);

    // 4 steel support columns
    const colGeo = new THREE.CylinderGeometry(0.2, 0.24, 4.5, 10);
    for (const [cx, cz] of [
      [-3.1, -1.8],
      [3.1, -1.8],
      [-3.1, 1.8],
      [3.1, 1.8],
    ]) {
      const col = new THREE.Mesh(colGeo, spbuCanopyWhiteMat);
      col.position.set(cx, 2.3, cz);
      col.castShadow = true;
      stGroup.add(col);
    }

    // Pertamina Tri-Color Canopy Fascia (Red top band + White core + Blue/Green accent)
    const canopyCore = new THREE.Mesh(
      new RoundedBoxGeometry(8.2, 0.52, 5.4, 3, 0.08),
      spbuCanopyWhiteMat
    );
    canopyCore.position.y = 4.65;
    canopyCore.castShadow = true;
    stGroup.add(canopyCore);

    const canopyRedStripe = new THREE.Mesh(
      new RoundedBoxGeometry(8.32, 0.24, 5.52, 2, 0.05),
      spbuRedMat
    );
    canopyRedStripe.position.y = 4.86;
    stGroup.add(canopyRedStripe);

    const canopyBlueStripe = new THREE.Mesh(
      new THREE.BoxGeometry(8.28, 0.12, 5.48),
      spbuBlueMat
    );
    canopyBlueStripe.position.y = 4.44;
    stGroup.add(canopyBlueStripe);

    const ceilingLight = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 4.0),
      spbuCeilingGlowMat
    );
    ceilingLight.rotation.x = Math.PI / 2;
    ceilingLight.position.y = 4.37;
    stGroup.add(ceilingLight);

    // Roadside Pertamina Totem Price Sign
    const totem = new THREE.Mesh(
      new RoundedBoxGeometry(0.95, 4.6, 0.34, 2, 0.06),
      spbuRedMat
    );
    totem.position.set(4.3, 2.35, 2.7);
    stGroup.add(totem);
    const totemLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 1.35, 0.38),
      spbuGreenMat
    );
    totemLed.position.set(4.3, 3.1, 2.7);
    stGroup.add(totemLed);

    // Intact Fuel Dispensers
    const intactGroup = new THREE.Group();
    for (const px of [-1.45, 1.45]) {
      const island = new THREE.Mesh(
        new RoundedBoxGeometry(1.3, 0.18, 2.6, 2, 0.04),
        spbuCanopyWhiteMat
      );
      island.position.set(px, 0.14, 0);
      intactGroup.add(island);

      const pumpBody = new THREE.Mesh(
        new RoundedBoxGeometry(0.68, 1.55, 0.56, 2, 0.06),
        spbuBlueMat
      );
      pumpBody.position.set(px, 0.98, 0);
      intactGroup.add(pumpBody);

      const pumpHeader = new THREE.Mesh(
        new RoundedBoxGeometry(0.74, 0.34, 0.6, 2, 0.05),
        spbuRedMat
      );
      pumpHeader.position.set(px, 1.85, 0);
      intactGroup.add(pumpHeader);
    }
    stGroup.add(intactGroup);

    // Wrecked / Exploded Dispenser Debris (hidden until detonated)
    const wreckGroup = new THREE.Group();
    wreckGroup.visible = false;
    for (const px of [-1.45, 1.45]) {
      const charredStub = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.68, 0.62),
        spbuCharredMat
      );
      charredStub.position.set(px, 0.38, 0);
      charredStub.rotation.set(0.18, px * 0.2, -0.24);
      wreckGroup.add(charredStub);
    }
    stGroup.add(wreckGroup);

    // Glowing Green Service Pad Ring
    const sRingGeo = new THREE.RingGeometry(2.6, 3.1, 28);
    sRingGeo.rotateX(-Math.PI / 2);
    const serviceRing = new THREE.Mesh(sRingGeo, spbuServiceRingMat);
    serviceRing.position.set(0, 0.13, 0);
    stGroup.add(serviceRing);

    spbuDispenserRefs.set(st.id, { intactGroup, wreckGroup, serviceRing });
    group.add(stGroup);
    lightAnchors.push({ x: st.x, z: st.z });
  }

  // =========================================================================
  // 8. OVERHEAD DIGITAL VMS TRAFFIC GANTRIES (Sudirman & Gatot Subroto)
  // =========================================================================
  let vmsCanvas: HTMLCanvasElement | null = null;
  let vmsCtx: CanvasRenderingContext2D | null = null;
  let vmsTexture: THREE.CanvasTexture | null = null;
  let lastVmsKey = '';

  if (typeof document !== 'undefined') {
    vmsCanvas = document.createElement('canvas');
    vmsCanvas.width = 512;
    vmsCanvas.height = 128;
    vmsCtx = vmsCanvas.getContext('2d');
    vmsTexture = new THREE.CanvasTexture(vmsCanvas);
    vmsTexture.colorSpace = THREE.SRGBColorSpace;
  }

  const renderVmsCanvas = (
    headline: string,
    subline: string,
    accentColor: string
  ) => {
    if (!vmsCtx || !vmsCanvas || !vmsTexture) return;
    const key = `${headline}|${subline}|${accentColor}`;
    if (key === lastVmsKey) return;
    lastVmsKey = key;

    vmsCtx.fillStyle = '#05080f';
    vmsCtx.fillRect(0, 0, 512, 128);
    vmsCtx.strokeStyle = accentColor;
    vmsCtx.lineWidth = 4;
    vmsCtx.strokeRect(6, 6, 500, 116);

    vmsCtx.fillStyle = accentColor;
    vmsCtx.font = 'bold 30px monospace';
    vmsCtx.textAlign = 'center';
    vmsCtx.textBaseline = 'middle';
    vmsCtx.fillText(headline.slice(0, 28), 256, 46);

    vmsCtx.fillStyle = '#e2e8f0';
    vmsCtx.font = 'bold 20px monospace';
    vmsCtx.fillText(subline.slice(0, 38), 256, 88);
    vmsTexture.needsUpdate = true;
  };

  renderVmsCanvas(
    'DISHUB DKI · LALU LINTAS LANCAR',
    'PATUHI BATAS KECEPATAN KORIDOR PROTOKOL',
    '#22c55e'
  );

  const vmsSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.48,
    metalness: 0.72,
  });
  const vmsScreenMat = new THREE.MeshBasicMaterial({
    map: vmsTexture ?? undefined,
    color: 0xffffff,
  });

  const vmsPlacements: { x: number; z: number; rotY: number; span: number }[] = [
    { x: 0, z: 52, rotY: 0, span: 15.6 }, // Over Jl. Jend. Sudirman
    { x: 46, z: 80, rotY: Math.PI / 2, span: 13.6 }, // Over Jl. Gatot Subroto
  ];

  for (const vp of vmsPlacements) {
    const vg = new THREE.Group();
    vg.position.set(vp.x, 0, vp.z);
    vg.rotation.y = vp.rotY;

    const legGeo = new THREE.CylinderGeometry(0.22, 0.26, 6.8, 8);
    for (const sx of [-vp.span * 0.5, vp.span * 0.5]) {
      const leg = new THREE.Mesh(legGeo, vmsSteelMat);
      leg.position.set(sx, 3.4, 0);
      vg.add(leg);
    }
    const crossBeam = new THREE.Mesh(
      new THREE.BoxGeometry(vp.span + 0.6, 0.36, 0.36),
      vmsSteelMat
    );
    crossBeam.position.set(0, 6.65, 0);
    vg.add(crossBeam);

    const housing = new THREE.Mesh(
      new RoundedBoxGeometry(7.6, 1.85, 0.42, 2, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 })
    );
    housing.position.set(0, 6.65, 0);
    vg.add(housing);

    const screenGeo = new THREE.PlaneGeometry(7.2, 1.62);
    const frontScreen = new THREE.Mesh(screenGeo, vmsScreenMat);
    frontScreen.position.set(0, 6.65, 0.23);
    const backScreen = new THREE.Mesh(screenGeo, vmsScreenMat);
    backScreen.position.set(0, 6.65, -0.23);
    backScreen.rotation.y = Math.PI;
    vg.add(frontScreen, backScreen);

    group.add(vg);
  }

  const setSpbuDestroyedIds = (destroyedIds: readonly string[]) => {
    for (const [id, refs] of spbuDispenserRefs.entries()) {
      const isDead = destroyedIds.includes(id);
      refs.intactGroup.visible = !isDead;
      refs.wreckGroup.visible = isDead;
      refs.serviceRing.visible = !isDead;
    }
  };

  const setWeatherTransition = (nightFactor: number, elapsedTime: number) => {
    const n = Math.max(0, Math.min(1, nightFactor));
    warungLanternMat.emissiveIntensity = 0.25 + n * 1.95;
    jpoLedMat.emissiveIntensity = 0.55 + n * 1.35;
    neonBoardMat.emissiveIntensity = 0.22 + n * 1.45;
    spbuRedMat.emissiveIntensity = 0.28 + n * 0.95;
    spbuBlueMat.emissiveIntensity = 0.28 + n * 0.95;
    spbuServiceRingMat.opacity = 0.34 + Math.sin(elapsedTime * 3.8) * 0.14;

    fountainJetMat.opacity = 0.42 + n * 0.35 + Math.sin(elapsedTime * 4.2) * 0.08;
    fountainJetsGroup.scale.y = 0.94 + Math.sin(elapsedTime * 3.1) * 0.1;
    for (let i = 0; i < outerPlumes.length; i++) {
      outerPlumes[i].scale.y = 0.85 + Math.sin(elapsedTime * 4.6 + i * 0.8) * 0.22;
    }
    for (let c = 0; c < innerCrownJets.length; c++) {
      innerCrownJets[c].scale.y = 0.9 + Math.cos(elapsedTime * 3.8 + c * 1.4) * 0.24;
    }
    for (let r = 0; r < fountainRipples.length; r++) {
      const phase = ((elapsedTime * 0.65 + r * 0.5) % 1);
      const scale = 0.85 + phase * 1.45;
      fountainRipples[r].scale.set(scale, scale, 1);
    }
  };

  const dispose = () => {
    if (vmsTexture) {
      vmsTexture.dispose();
    }
    const disposedGeos = new Set<THREE.BufferGeometry>();
    const disposedMats = new Set<THREE.Material>();
    group.traverse((obj) => {
      if (
        obj instanceof THREE.Mesh ||
        obj instanceof THREE.InstancedMesh ||
        obj instanceof THREE.LineSegments
      ) {
        if (obj.geometry && !disposedGeos.has(obj.geometry)) {
          disposedGeos.add(obj.geometry);
          obj.geometry.dispose();
        }
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        for (const m of mats) {
          if (m && !disposedMats.has(m)) {
            disposedMats.add(m);
            m.dispose();
          }
        }
      }
    });
  };

  return {
    group,
    lightAnchors,
    setWeatherTransition,
    setSpbuDestroyedIds,
    updateDigitalVmsStatus: renderVmsCanvas,
    dispose,
  };
}

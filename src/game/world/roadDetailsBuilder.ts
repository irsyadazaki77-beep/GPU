import * as THREE from 'three';
import type { WeatherMode } from '../types';
import {
  createBuswayStencilTexture,
  createCrackDecalTexture,
  createCrosswalkStripeTexture,
  createLaneArrowTexture,
  createManholeTexture,
  createSeededRng,
  createYellowBoxTexture,
} from './roadTextures';
import type { SidewalkRect } from './textures';

export function buildProceduralRoadDetailSystem(
  sidewalkRects: SidewalkRect[],
  maxAnisotropy: number
): {
  group: THREE.Group;
  setWeatherVisuals: (weather: WeatherMode) => void;
  setWeatherTransition: (wetnessFactor: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };
  const trackTex = <T extends THREE.Texture>(t: T): T => {
    textures.push(t);
    return t;
  };

  const dummy = new THREE.Object3D();
  const unitPlaneGeo = trackGeo(new THREE.PlaneGeometry(1, 1));
  unitPlaneGeo.rotateX(-Math.PI / 2);

  // 1. Intersection & Crosswalk Cleanout Asphalt Patches (cover crossing dashed centerlines)
  const cleanoutSpecs: { x: number; z: number; w: number; d: number }[] = [
    { x: 0, z: -32, w: 13.6, d: 9.8 },
    { x: -32, z: 0, w: 9.8, d: 13.6 },
    { x: 32, z: 0, w: 9.8, d: 13.6 },
    { x: -32, z: -32, w: 9.8, d: 9.8 },
    { x: 32, z: -32, w: 9.8, d: 9.8 },
    { x: -32, z: 32, w: 9.8, d: 9.8 },
    { x: 32, z: 32, w: 9.8, d: 9.8 },
    { x: 0, z: -20.0, w: 13.4, d: 2.5 },
    { x: 0, z: 20.0, w: 13.4, d: 2.5 },
    { x: -20.0, z: 0, w: 2.5, d: 13.4 },
    { x: 20.0, z: 0, w: 2.5, d: 13.4 },
    { x: 0, z: -26.1, w: 13.4, d: 2.5 },
    { x: 0, z: -38.3, w: 13.4, d: 2.5 },
    { x: -26.1, z: 0, w: 2.5, d: 13.4 },
    { x: 26.1, z: 0, w: 2.5, d: 13.4 },
    { x: -38.3, z: 0, w: 2.5, d: 13.4 },
    { x: 38.3, z: 0, w: 2.5, d: 13.4 },
  ];
  const cleanoutMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x131720,
      roughness: 0.88,
      metalness: 0.05,
      envMapIntensity: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const cleanoutInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    cleanoutMat,
    cleanoutSpecs.length
  );
  cleanoutSpecs.forEach((s, i) => {
    dummy.position.set(s.x, 0.048, s.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(s.w, 1, s.d);
    dummy.updateMatrix();
    cleanoutInst.setMatrixAt(i, dummy.matrix);
  });
  cleanoutInst.instanceMatrix.needsUpdate = true;
  cleanoutInst.receiveShadow = true;
  group.add(cleanoutInst);

  // 2. Jakarta Yellow Box Junctions (4 major boulevard intersections)
  const yellowBoxTex = trackTex(createYellowBoxTexture(maxAnisotropy));
  const yellowBoxMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: yellowBoxTex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const yellowBoxCoords: { x: number; z: number; w: number; d: number }[] = [
    { x: 0, z: -32, w: 12.6, d: 8.8 },
    { x: -32, z: 0, w: 8.8, d: 12.6 },
    { x: 32, z: 0, w: 8.8, d: 12.6 },
  ];
  const yellowBoxInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    yellowBoxMat,
    yellowBoxCoords.length
  );
  yellowBoxCoords.forEach((jb, i) => {
    dummy.position.set(jb.x, 0.052, jb.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(jb.w, 1, jb.d);
    dummy.updateMatrix();
    yellowBoxInst.setMatrixAt(i, dummy.matrix);
  });
  yellowBoxInst.instanceMatrix.needsUpdate = true;
  group.add(yellowBoxInst);

  // 3. TransJakarta Busway Terracotta Corridor Strips & BUSWAY Stencils
  const buswaySegments: [number, number][] = [
    [-60.5, -39.9],
    [44.5, 73.5],
    [86.5, 121.0],
  ];
  const busStripMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7f1d1d,
      roughness: 0.78,
      metalness: 0.06,
      transparent: true,
      opacity: 0.74,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const busStripPlacements: { x: number; z: number; len: number }[] = [];
  for (const [zStart, zEnd] of buswaySegments) {
    const len = zEnd - zStart;
    const zMid = (zStart + zEnd) * 0.5;
    busStripPlacements.push({ x: -1.85, z: zMid, len });
    busStripPlacements.push({ x: 1.85, z: zMid, len });
  }
  const busStripInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    busStripMat,
    busStripPlacements.length
  );
  busStripPlacements.forEach((bs, i) => {
    dummy.position.set(bs.x, 0.047, bs.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1.65, 1, bs.len);
    dummy.updateMatrix();
    busStripInst.setMatrixAt(i, dummy.matrix);
  });
  busStripInst.instanceMatrix.needsUpdate = true;
  group.add(busStripInst);

  const buswayStencilTex = trackTex(createBuswayStencilTexture(maxAnisotropy));
  const buswayStencilMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: buswayStencilTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const buswayStencils: { x: number; z: number; rotY: number }[] = [
    { x: -1.85, z: -50, rotY: 0 },
    { x: 1.85, z: -50, rotY: Math.PI },
    { x: -1.85, z: 50, rotY: 0 },
    { x: 1.85, z: 50, rotY: Math.PI },
    { x: -1.85, z: 68, rotY: 0 },
    { x: 1.85, z: 68, rotY: Math.PI },
    { x: -1.85, z: 96, rotY: 0 },
    { x: 1.85, z: 96, rotY: Math.PI },
    { x: -1.85, z: 114, rotY: 0 },
    { x: 1.85, z: 114, rotY: Math.PI },
  ];
  const busStencilInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    buswayStencilMat,
    buswayStencils.length
  );
  buswayStencils.forEach((st, i) => {
    dummy.position.set(st.x, 0.05, st.z);
    dummy.rotation.set(0, st.rotY, 0);
    dummy.scale.set(1.5, 1, 3.6);
    dummy.updateMatrix();
    busStencilInst.setMatrixAt(i, dummy.matrix);
  });
  busStencilInst.instanceMatrix.needsUpdate = true;
  group.add(busStencilInst);

  // 4. Zebra Crosswalks
  const stripeTex = trackTex(createCrosswalkStripeTexture(maxAnisotropy));
  const stripeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: stripeTex,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );

  const crosswalkEntries: {
    x: number;
    z: number;
    rotY: number;
    w: number;
    l: number;
  }[] = [];

  const pushCrosswalk = (
    cx: number,
    cz: number,
    axis: 'ns' | 'ew',
    roadWidth: number,
    stripeLength = 2.05
  ) => {
    const count = roadWidth >= 13 ? 10 : 7;
    const span = roadWidth >= 13 ? 11.4 : 7.8;
    const step = span / (count - 1);
    for (let i = 0; i < count; i++) {
      const offset = -span * 0.5 + i * step;
      if (axis === 'ns') {
        crosswalkEntries.push({
          x: cx + offset,
          z: cz,
          rotY: 0,
          w: 0.52,
          l: stripeLength,
        });
      } else {
        crosswalkEntries.push({
          x: cx,
          z: cz + offset,
          rotY: Math.PI / 2,
          w: 0.52,
          l: stripeLength,
        });
      }
    }
  };

  pushCrosswalk(0, -20.0, 'ns', 14, 2.0);
  pushCrosswalk(0, 20.0, 'ns', 14, 2.0);
  pushCrosswalk(-20.0, 0, 'ew', 14, 2.0);
  pushCrosswalk(20.0, 0, 'ew', 14, 2.0);

  for (const s of [-1, 1]) {
    pushCrosswalk(0, s * 38.3, 'ns', 14, 2.05);
    pushCrosswalk(0, s * 26.1, 'ns', 14, 2.05);
    pushCrosswalk(-8.6, s * 32, 'ew', 10, 2.05);
    pushCrosswalk(8.6, s * 32, 'ew', 10, 2.05);

    pushCrosswalk(s * 38.3, 0, 'ew', 14, 2.05);
    pushCrosswalk(s * 26.1, 0, 'ew', 14, 2.05);
    pushCrosswalk(s * 32, -8.6, 'ns', 10, 2.05);
    pushCrosswalk(s * 32, 8.6, 'ns', 10, 2.05);
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      pushCrosswalk(sx * 32, sz * 26.1, 'ns', 10, 2.05);
      pushCrosswalk(sx * 32, sz * 38.3, 'ns', 10, 2.05);
      pushCrosswalk(sx * 26.1, sz * 32, 'ew', 10, 2.05);
      pushCrosswalk(sx * 38.3, sz * 32, 'ew', 10, 2.05);
    }
  }

  const zebraInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    stripeMat,
    crosswalkEntries.length
  );
  crosswalkEntries.forEach((ce, i) => {
    dummy.position.set(ce.x, 0.055, ce.z);
    dummy.rotation.set(0, ce.rotY, 0);
    dummy.scale.set(ce.w, 1, ce.l);
    dummy.updateMatrix();
    zebraInst.setMatrixAt(i, dummy.matrix);
  });
  zebraInst.instanceMatrix.needsUpdate = true;
  zebraInst.receiveShadow = true;
  group.add(zebraInst);

  // 5. Intersection Stop Lines (Indonesian left-hand drive approach lanes) & Directional Lane Arrows
  const paintLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.96,
      metalness: 0.0,
      envMapIntensity: 0.04,
      transparent: true,
      opacity: 0.54,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    })
  );
  const stopLines: { x: number; z: number; rotY: number; w: number }[] = [
    // Monas Plaza crosswalk approaches (left-hand drive)
    { x: 3.5, z: -21.6, rotY: 0, w: 5.4 },
    { x: -3.5, z: 21.6, rotY: 0, w: 5.4 },
    { x: -21.6, z: -3.5, rotY: Math.PI / 2, w: 5.4 },
    { x: 21.6, z: 3.5, rotY: Math.PI / 2, w: 5.4 },
    // Major z = +-32 intersections along Sudirman
    { x: 3.5, z: -40.0, rotY: 0, w: 5.4 },
    { x: -3.5, z: -24.4, rotY: 0, w: 5.4 },
    { x: 3.5, z: 24.4, rotY: 0, w: 5.4 },
    { x: -3.5, z: 40.0, rotY: 0, w: 5.4 },
    // Major x = +-32 intersections along Merdeka
    { x: -40.0, z: -3.5, rotY: Math.PI / 2, w: 5.4 },
    { x: -24.4, z: 3.5, rotY: Math.PI / 2, w: 5.4 },
    { x: 24.4, z: -3.5, rotY: Math.PI / 2, w: 5.4 },
    { x: 40.0, z: 3.5, rotY: Math.PI / 2, w: 5.4 },
    // Ring street approaches
    { x: -10.3, z: -29.8, rotY: Math.PI / 2, w: 3.8 },
    { x: 10.3, z: -34.2, rotY: Math.PI / 2, w: 3.8 },
    { x: -10.3, z: 29.8, rotY: Math.PI / 2, w: 3.8 },
    { x: 10.3, z: 34.2, rotY: Math.PI / 2, w: 3.8 },
    { x: -34.2, z: -10.3, rotY: 0, w: 3.8 },
    { x: -29.8, z: 10.3, rotY: 0, w: 3.8 },
    { x: 29.8, z: -10.3, rotY: 0, w: 3.8 },
    { x: 34.2, z: 10.3, rotY: 0, w: 3.8 },
  ];
  const stopLineInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    paintLineMat,
    stopLines.length
  );
  stopLines.forEach((sl, i) => {
    dummy.position.set(sl.x, 0.054, sl.z);
    dummy.rotation.set(0, sl.rotY, 0);
    dummy.scale.set(sl.w, 1, 0.32);
    dummy.updateMatrix();
    stopLineInst.setMatrixAt(i, dummy.matrix);
  });
  stopLineInst.instanceMatrix.needsUpdate = true;
  group.add(stopLineInst);

  const straightArrowTex = trackTex(
    createLaneArrowTexture('straight', maxAnisotropy)
  );
  const straightRightArrowTex = trackTex(
    createLaneArrowTexture('straight_right', maxAnisotropy)
  );
  const straightArrowMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: straightArrowTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const straightRightArrowMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: straightRightArrowTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.95,
      metalness: 0.0,
      envMapIntensity: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );

  const straightArrows: { x: number; z: number; rotY: number }[] = [
    { x: -4.6, z: -56, rotY: Math.PI },
    { x: 4.6, z: 56, rotY: 0 },
    { x: -4.6, z: -72, rotY: Math.PI },
    { x: 4.6, z: 72, rotY: 0 },
    { x: -56, z: 4.6, rotY: Math.PI / 2 },
    { x: 56, z: -4.6, rotY: -Math.PI / 2 },
    { x: -44, z: 4.6, rotY: Math.PI / 2 },
    { x: 44, z: -4.6, rotY: -Math.PI / 2 },
  ];
  const straightRightArrows: { x: number; z: number; rotY: number }[] = [
    { x: -4.6, z: -43.5, rotY: Math.PI },
    { x: 4.6, z: 43.5, rotY: 0 },
    { x: -44, z: 2.2, rotY: Math.PI / 2 },
    { x: 44, z: -2.2, rotY: -Math.PI / 2 },
  ];

  const straightArrowInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    straightArrowMat,
    straightArrows.length
  );
  straightArrows.forEach((a, i) => {
    dummy.position.set(a.x, 0.051, a.z);
    dummy.rotation.set(0, a.rotY, 0);
    dummy.scale.set(1.5, 1, 3.1);
    dummy.updateMatrix();
    straightArrowInst.setMatrixAt(i, dummy.matrix);
  });
  straightArrowInst.instanceMatrix.needsUpdate = true;
  group.add(straightArrowInst);

  const straightRightArrowInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    straightRightArrowMat,
    straightRightArrows.length
  );
  straightRightArrows.forEach((a, i) => {
    dummy.position.set(a.x, 0.051, a.z);
    dummy.rotation.set(0, a.rotY, 0);
    dummy.scale.set(1.6, 1, 3.1);
    dummy.updateMatrix();
    straightRightArrowInst.setMatrixAt(i, dummy.matrix);
  });
  straightRightArrowInst.instanceMatrix.needsUpdate = true;
  group.add(straightRightArrowInst);

  // 6. Procedural Asphalt Cracks & Tar-Seal Repairs along Roadways
  const asphaltCrackTex = trackTex(
    createCrackDecalTexture(6817, 'asphalt', maxAnisotropy)
  );
  const asphaltCrackMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: asphaltCrackTex,
      transparent: true,
      depthWrite: false,
      roughness: 0.65,
      metalness: 0.12,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const tarPatchMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x11151d,
      roughness: 0.78,
      metalness: 0.08,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );

  const roadCrackRng = createSeededRng(202607);
  const roadCrackSpecs: {
    x: number;
    z: number;
    rotY: number;
    sx: number;
    sz: number;
  }[] = [];
  const tarPatchSpecs: {
    x: number;
    z: number;
    rotY: number;
    sx: number;
    sz: number;
  }[] = [];

  const pushRoadWear = (x: number, z: number) => {
    if (x * x + z * z < 21.5 * 21.5) return;
    if (Math.abs(Math.abs(z) - 20) < 2.5 || Math.abs(Math.abs(z) - 26.1) < 2.5 || Math.abs(Math.abs(z) - 38.3) < 2.5) return;
    if (Math.abs(Math.abs(x) - 20) < 2.5 || Math.abs(Math.abs(x) - 26.1) < 2.5 || Math.abs(Math.abs(x) - 38.3) < 2.5) return;
    roadCrackSpecs.push({
      x,
      z,
      rotY: roadCrackRng() * Math.PI * 2,
      sx: 2.2 + roadCrackRng() * 2.1,
      sz: 2.2 + roadCrackRng() * 2.1,
    });
    if (roadCrackRng() > 0.68) {
      tarPatchSpecs.push({
        x: x + (roadCrackRng() - 0.5) * 1.4,
        z: z + (roadCrackRng() - 0.5) * 1.4,
        rotY: (roadCrackRng() - 0.5) * 0.14,
        sx: 1.4 + roadCrackRng() * 1.8,
        sz: 1.8 + roadCrackRng() * 2.6,
      });
    }
  };

  for (let d = -82; d <= 82; d += 7.5) {
    pushRoadWear((roadCrackRng() - 0.5) * 9.5, d);
    pushRoadWear(d, (roadCrackRng() - 0.5) * 9.5);
  }
  for (const r of [-32, 32]) {
    for (let d = -74; d <= 74; d += 10.5) {
      pushRoadWear(r + (roadCrackRng() - 0.5) * 6.5, d);
      pushRoadWear(d, r + (roadCrackRng() - 0.5) * 6.5);
    }
  }

  const roadCrackInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    asphaltCrackMat,
    roadCrackSpecs.length
  );
  roadCrackSpecs.forEach((rc, i) => {
    dummy.position.set(rc.x, 0.05, rc.z);
    dummy.rotation.set(0, rc.rotY, 0);
    dummy.scale.set(rc.sx, 1, rc.sz);
    dummy.updateMatrix();
    roadCrackInst.setMatrixAt(i, dummy.matrix);
  });
  roadCrackInst.instanceMatrix.needsUpdate = true;
  group.add(roadCrackInst);

  if (tarPatchSpecs.length > 0) {
    const tarPatchInst = new THREE.InstancedMesh(
      unitPlaneGeo,
      tarPatchMat,
      tarPatchSpecs.length
    );
    tarPatchSpecs.forEach((tp, i) => {
      dummy.position.set(tp.x, 0.046, tp.z);
      dummy.rotation.set(0, tp.rotY, 0);
      dummy.scale.set(tp.sx, 1, tp.sz);
      dummy.updateMatrix();
      tarPatchInst.setMatrixAt(i, dummy.matrix);
    });
    tarPatchInst.instanceMatrix.needsUpdate = true;
    group.add(tarPatchInst);
  }

  // 7. Procedural Sidewalk Cracks, Expansion Seams & Drainage Grates
  const swCrackTexA = trackTex(
    createCrackDecalTexture(3319, 'sidewalk', maxAnisotropy)
  );
  const swCrackTexB = trackTex(
    createCrackDecalTexture(8847, 'sidewalk', maxAnisotropy)
  );
  const manholeTex = trackTex(createManholeTexture(maxAnisotropy));

  const swCrackMatA = trackMat(
    new THREE.MeshStandardMaterial({
      map: swCrackTexA,
      transparent: true,
      depthWrite: false,
      roughness: 0.85,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
  );
  const swCrackMatB = trackMat(
    new THREE.MeshStandardMaterial({
      map: swCrackTexB,
      transparent: true,
      depthWrite: false,
      roughness: 0.85,
      metalness: 0.04,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    })
  );
  const seamMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    })
  );
  const manholeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: manholeTex,
      roughness: 0.55,
      metalness: 0.65,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );

  const swRng = createSeededRng(90421);
  const swCracksA: {
    x: number;
    z: number;
    rotY: number;
    sx: number;
    sz: number;
  }[] = [];
  const swCracksB: {
    x: number;
    z: number;
    rotY: number;
    sx: number;
    sz: number;
  }[] = [];
  const swSeams: { x: number; z: number; w: number; d: number }[] = [];
  const manholes: { x: number; z: number; rotY: number }[] = [];

  for (const rect of sidewalkRects) {
    const width = rect.maxX - rect.minX;
    const depth = rect.maxZ - rect.minZ;
    const alongZ = depth >= width;

    if (alongZ) {
      const spanZ = depth - 1.2;
      const safeW = Math.max(0.8, width - 0.9);
      const count = Math.max(1, Math.floor(spanZ / 4.2));
      for (let i = 0; i < count; i++) {
        const zPos = rect.minZ + 0.6 + (i + 0.5) * (spanZ / count);
        swSeams.push({
          x: (rect.minX + rect.maxX) * 0.5,
          z: zPos,
          w: width - 0.28,
          d: 0.06,
        });
        if (swRng() > 0.12) {
          const target = swRng() > 0.5 ? swCracksA : swCracksB;
          const crackScale = Math.min(safeW, 2.7) * (0.82 + swRng() * 0.34);
          target.push({
            x: rect.minX + 0.55 + swRng() * Math.max(0.2, width - 1.1),
            z: zPos + (swRng() - 0.5) * 2.8,
            rotY: swRng() * Math.PI * 2,
            sx: crackScale,
            sz: crackScale * (0.85 + swRng() * 0.35),
          });
        }
        if (i % 5 === 2 && width >= 2.6) {
          manholes.push({
            x: (rect.minX + rect.maxX) * 0.5,
            z: zPos + 1.1,
            rotY: 0,
          });
        }
      }
    } else {
      const spanX = width - 1.2;
      const safeD = Math.max(0.8, depth - 0.9);
      const count = Math.max(1, Math.floor(spanX / 4.2));
      for (let i = 0; i < count; i++) {
        const xPos = rect.minX + 0.6 + (i + 0.5) * (spanX / count);
        swSeams.push({
          x: xPos,
          z: (rect.minZ + rect.maxZ) * 0.5,
          w: 0.06,
          d: depth - 0.28,
        });
        if (swRng() > 0.12) {
          const target = swRng() > 0.5 ? swCracksA : swCracksB;
          const crackScale = Math.min(safeD, 2.7) * (0.82 + swRng() * 0.34);
          target.push({
            x: xPos + (swRng() - 0.5) * 2.8,
            z: rect.minZ + 0.55 + swRng() * Math.max(0.2, depth - 1.1),
            rotY: swRng() * Math.PI * 2,
            sx: crackScale,
            sz: crackScale * (0.85 + swRng() * 0.35),
          });
        }
        if (i % 5 === 2 && depth >= 2.6) {
          manholes.push({
            x: xPos + 1.1,
            z: (rect.minZ + rect.maxZ) * 0.5,
            rotY: Math.PI / 2,
          });
        }
      }
    }
  }

  if (swSeams.length > 0) {
    const seamInst = new THREE.InstancedMesh(
      unitPlaneGeo,
      seamMat,
      swSeams.length
    );
    swSeams.forEach((s, i) => {
      dummy.position.set(s.x, 0.142, s.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(s.w, 1, s.d);
      dummy.updateMatrix();
      seamInst.setMatrixAt(i, dummy.matrix);
    });
    seamInst.instanceMatrix.needsUpdate = true;
    group.add(seamInst);
  }

  if (swCracksA.length > 0) {
    const swInstA = new THREE.InstancedMesh(
      unitPlaneGeo,
      swCrackMatA,
      swCracksA.length
    );
    swCracksA.forEach((c, i) => {
      dummy.position.set(c.x, 0.146, c.z);
      dummy.rotation.set(0, c.rotY, 0);
      dummy.scale.set(c.sx, 1, c.sz);
      dummy.updateMatrix();
      swInstA.setMatrixAt(i, dummy.matrix);
    });
    swInstA.instanceMatrix.needsUpdate = true;
    swInstA.receiveShadow = true;
    group.add(swInstA);
  }

  if (swCracksB.length > 0) {
    const swInstB = new THREE.InstancedMesh(
      unitPlaneGeo,
      swCrackMatB,
      swCracksB.length
    );
    swCracksB.forEach((c, i) => {
      dummy.position.set(c.x, 0.146, c.z);
      dummy.rotation.set(0, c.rotY, 0);
      dummy.scale.set(c.sx, 1, c.sz);
      dummy.updateMatrix();
      swInstB.setMatrixAt(i, dummy.matrix);
    });
    swInstB.instanceMatrix.needsUpdate = true;
    swInstB.receiveShadow = true;
    group.add(swInstB);
  }

  if (manholes.length > 0) {
    const mhInst = new THREE.InstancedMesh(
      unitPlaneGeo,
      manholeMat,
      manholes.length
    );
    manholes.forEach((mh, i) => {
      dummy.position.set(mh.x, 0.144, mh.z);
      dummy.rotation.set(0, mh.rotY, 0);
      dummy.scale.set(0.95, 1, 0.95);
      dummy.updateMatrix();
      mhInst.setMatrixAt(i, dummy.matrix);
    });
    mhInst.instanceMatrix.needsUpdate = true;
    mhInst.receiveShadow = true;
    group.add(mhInst);
  }

  const setWeatherTransition = (wetnessFactor: number) => {
    const w = Math.max(0, Math.min(1, wetnessFactor));
    cleanoutMat.roughness = 0.94 - w * 0.54;
    cleanoutMat.metalness = 0.02 + w * 0.14;
    yellowBoxMat.roughness = 0.94 - w * 0.46;
    stripeMat.roughness = 0.96 - w * 0.46;
    paintLineMat.roughness = 0.96 - w * 0.46;
    straightArrowMat.roughness = 0.95 - w * 0.42;
    straightRightArrowMat.roughness = 0.95 - w * 0.42;
    buswayStencilMat.roughness = 0.92 - w * 0.42;
    swCrackMatA.roughness = 0.92 - w * 0.45;
    swCrackMatB.roughness = 0.92 - w * 0.45;
  };

  const setWeatherVisuals = (weather: WeatherMode) => {
    setWeatherTransition(weather === 'hujan' ? 1 : 0);
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return { group, setWeatherVisuals, setWeatherTransition, dispose };
}

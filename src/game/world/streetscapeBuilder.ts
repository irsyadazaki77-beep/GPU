import * as THREE from 'three';
import { proceduralTextures } from '../../engine/ProceduralTextures';
import type { Point2D } from '../../engine/visualOverhaulMath';
import { ENTERABLE_INTERIORS } from '../heists';
import { computeMrtTrainState } from '../grandPlan5Systems';
import type { TrafficSignalPhase, WeatherMode } from '../types';
import { isNearBuilding, isOnRoadway } from './spatial';
import { SidewalkRect, createGantrySignTexture } from './textures';

export function buildJakartaStreetscape(maxAnisotropy: number): {
  group: THREE.Group;
  sidewalkRects: SidewalkRect[];
  pjuLightAnchors: Point2D[];
  setWeatherVisuals: (weather: WeatherMode) => void;
  setWeatherTransition: (
    nightFactor: number,
    wetnessFactor: number,
    elapsedTime?: number
  ) => void;
  setTrafficSignalPhase: (phase: TrafficSignalPhase) => void;
} {
  const group = new THREE.Group();
  const sidewalkRects: SidewalkRect[] = [];

  const sidewalkSet = proceduralTextures.getSidewalkTextures(maxAnisotropy);
  sidewalkSet.map.repeat.set(1, 5);
  sidewalkSet.bumpMap.repeat.set(1, 5);
  sidewalkSet.roughnessMap.repeat.set(1, 5);
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sidewalkSet.map,
    bumpMap: sidewalkSet.bumpMap,
    bumpScale: 0.035,
    roughnessMap: sidewalkSet.roughnessMap,
    roughness: 0.9,
    metalness: 0.04,
    envMapIntensity: 0.34,
  });
  const curbYellowMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.82,
    metalness: 0.04,
    envMapIntensity: 0.25,
  });

  const addSidewalkSlab = (
    cx: number,
    cz: number,
    w: number,
    d: number,
    curbSide: 'left' | 'right' | 'top' | 'bottom'
  ) => {
    if (isNearBuilding(cx, cz, 1.8)) return;
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.14, d),
      sidewalkMat
    );
    slab.position.set(cx, 0.07, cz);
    slab.receiveShadow = true;
    group.add(slab);

    sidewalkRects.push({
      minX: cx - w * 0.5,
      maxX: cx + w * 0.5,
      minZ: cz - d * 0.5,
      maxZ: cz + d * 0.5,
    });

    let cw = 0.24;
    let cd = d;
    let kx = cx;
    let kz = cz;
    if (curbSide === 'left') kx = cx - w * 0.5 + 0.12;
    else if (curbSide === 'right') kx = cx + w * 0.5 - 0.12;
    else if (curbSide === 'top') {
      cw = w;
      cd = 0.24;
      kz = cz - d * 0.5 + 0.12;
    } else {
      cw = w;
      cd = 0.24;
      kz = cz + d * 0.5 - 0.12;
    }
    const curb = new THREE.Mesh(
      new THREE.BoxGeometry(cw, 0.16, cd),
      curbYellowMat
    );
    curb.position.set(kx, 0.08, kz);
    group.add(curb);
  };

  const nsSidewalkSegments: [number, number][] = [
    [-86, -42],
    [-19, -8],
    [19, 25],
    [40, 86],
  ];
  for (const [zStart, zEnd] of nsSidewalkSegments) {
    const len = zEnd - zStart;
    const zMid = (zStart + zEnd) * 0.5;
    addSidewalkSlab(-9.2, zMid, 4.3, len, 'right');
    addSidewalkSlab(9.2, zMid, 4.3, len, 'left');
  }

  const ewSidewalkSegments: [number, number][] = [
    [-82, -40],
    [-25, -20],
    [20, 25],
    [40, 82],
  ];
  for (const [xStart, xEnd] of ewSidewalkSegments) {
    const len = xEnd - xStart;
    const xMid = (xStart + xEnd) * 0.5;
    addSidewalkSlab(xMid, -9.2, len, 4.3, 'bottom');
    addSidewalkSlab(xMid, 9.2, len, 4.3, 'top');
  }

  for (const rx of [-32, 32]) {
    for (const [zStart, zEnd] of [
      [-74, -40],
      [-18, -9],
      [9, 24],
      [40, 74],
    ] as [number, number][]) {
      const len = zEnd - zStart;
      const zMid = (zStart + zEnd) * 0.5;
      addSidewalkSlab(rx - 6.6, zMid, 3.0, len, 'right');
      addSidewalkSlab(rx + 6.6, zMid, 3.0, len, 'left');
    }
  }
  for (const rz of [-32, 32]) {
    for (const [xStart, xEnd] of [
      [-74, -40],
      [-24, -10],
      [10, 24],
      [40, 74],
    ] as [number, number][]) {
      if (rz === -32 && Math.abs(xStart) < 70 && Math.abs(xEnd) < 70) continue;
      const len = xEnd - xStart;
      const xMid = (xStart + xEnd) * 0.5;
      addSidewalkSlab(xMid, rz - 6.6, len, 3.0, 'bottom');
      addSidewalkSlab(xMid, rz + 6.6, len, 3.0, 'top');
    }
  }

  const dummy = new THREE.Object3D();

  const polePositions: { x: number; z: number; rotY: number }[] = [];
  for (let z = -76; z <= 76; z += 18) {
    if (
      Math.abs(z) < 21 ||
      Math.abs(z - -26) < 7 ||
      Math.abs(Math.abs(z) - 32) < 6
    ) {
      continue;
    }
    for (const sx of [-7.45, 7.45]) {
      if (!isNearBuilding(sx, z, 1.5)) {
        polePositions.push({ x: sx, z, rotY: sx < 0 ? 0 : Math.PI });
      }
    }
  }
  for (let x = -76; x <= 76; x += 20) {
    if (Math.abs(x) < 21 || Math.abs(Math.abs(x) - 32) < 6) continue;
    for (const sz of [-7.45, 7.45]) {
      if (!isNearBuilding(x, sz, 1.5)) {
        polePositions.push({
          x,
          z: sz,
          rotY: sz < 0 ? -Math.PI / 2 : Math.PI / 2,
        });
      }
    }
  }

  const pjuMetalMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    metalness: 0.68,
    roughness: 0.42,
    envMapIntensity: 0.3,
  });
  const pjuBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.95,
    roughness: 0.25,
  });
  const radialPoolTex = proceduralTextures.getRadialLightPoolTexture();
  const lightPoolMat = new THREE.MeshBasicMaterial({
    map: radialPoolTex,
    color: 0xffd27d,
    transparent: true,
    opacity: 0.14,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const pCount = polePositions.length;
  const pjuMastGeo = new THREE.CylinderGeometry(0.08, 0.14, 6.8, 8);
  pjuMastGeo.translate(0, 3.4, 0);
  const pjuMastInst = new THREE.InstancedMesh(pjuMastGeo, pjuMetalMat, pCount);

  const pjuArmGeo = new THREE.BoxGeometry(1.9, 0.1, 0.12);
  pjuArmGeo.translate(0.85, 6.65, 0);
  const pjuArmInst = new THREE.InstancedMesh(pjuArmGeo, pjuMetalMat, pCount);

  const pjuLampGeo = new THREE.BoxGeometry(0.65, 0.14, 0.28);
  pjuLampGeo.translate(1.65, 6.56, 0);
  const pjuLampInst = new THREE.InstancedMesh(pjuLampGeo, pjuBulbMat, pCount);

  const poolGeo = new THREE.PlaneGeometry(8.6, 8.6);
  poolGeo.rotateX(-Math.PI / 2);
  poolGeo.translate(1.8, 0.048, 0);
  const poolInst = new THREE.InstancedMesh(poolGeo, lightPoolMat, pCount);

  polePositions.forEach((pp, i) => {
    dummy.position.set(pp.x, 0, pp.z);
    dummy.rotation.set(0, pp.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    pjuMastInst.setMatrixAt(i, dummy.matrix);
    pjuArmInst.setMatrixAt(i, dummy.matrix);
    pjuLampInst.setMatrixAt(i, dummy.matrix);
    poolInst.setMatrixAt(i, dummy.matrix);
  });
  pjuMastInst.instanceMatrix.needsUpdate = true;
  pjuArmInst.instanceMatrix.needsUpdate = true;
  pjuLampInst.instanceMatrix.needsUpdate = true;
  poolInst.instanceMatrix.needsUpdate = true;
  group.add(pjuMastInst, pjuArmInst, pjuLampInst, poolInst);

  const signalCorners: {
    x: number;
    z: number;
    rotY: number;
    axis: 'ns' | 'ew';
  }[] = [
    { x: -7.8, z: -38.5, rotY: 0, axis: 'ns' },
    { x: 7.8, z: -19.5, rotY: Math.PI, axis: 'ns' },
    { x: -7.8, z: 19.5, rotY: 0, axis: 'ns' },
    { x: 7.8, z: 38.5, rotY: Math.PI, axis: 'ns' },
    { x: -38.5, z: -7.8, rotY: -Math.PI / 2, axis: 'ew' },
    { x: 38.5, z: 7.8, rotY: Math.PI / 2, axis: 'ew' },
  ];
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.5,
    envMapIntensity: 0.25,
  });

  const nsRedMat = new THREE.MeshBasicMaterial({ color: 0x3f1518 });
  const nsAmberMat = new THREE.MeshBasicMaterial({ color: 0x3b2a0b });
  const nsGreenMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });

  const ewRedMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const ewAmberMat = new THREE.MeshBasicMaterial({ color: 0x3b2a0b });
  const ewGreenMat = new THREE.MeshBasicMaterial({ color: 0x123820 });

  const lensGeo = new THREE.CircleGeometry(0.11, 10);

  for (const sig of signalCorners) {
    if (isNearBuilding(sig.x, sig.z, 1.0)) continue;
    const sGrp = new THREE.Group();
    sGrp.position.set(sig.x, 0, sig.z);
    sGrp.rotation.y = sig.rotY;

    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.14, 5.2, 8),
      housingMat
    );
    post.position.y = 2.6;
    sGrp.add(post);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.14, 0.14),
      housingMat
    );
    arm.position.set(1.5, 5.1, 0);
    sGrp.add(arm);

    const box = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.42, 0.34),
      housingMat
    );
    box.position.set(2.2, 4.95, 0);
    sGrp.add(box);

    const redMat = sig.axis === 'ns' ? nsRedMat : ewRedMat;
    const amberMat = sig.axis === 'ns' ? nsAmberMat : ewAmberMat;
    const greenMat = sig.axis === 'ns' ? nsGreenMat : ewGreenMat;

    for (const faceZ of [0.18, -0.18]) {
      const rotY = faceZ < 0 ? Math.PI : 0;
      const rLens = new THREE.Mesh(lensGeo, redMat);
      rLens.position.set(1.86, 4.95, faceZ);
      rLens.rotation.y = rotY;
      sGrp.add(rLens);

      const aLens = new THREE.Mesh(lensGeo, amberMat);
      aLens.position.set(2.2, 4.95, faceZ);
      aLens.rotation.y = rotY;
      sGrp.add(aLens);

      const gLens = new THREE.Mesh(lensGeo, greenMat);
      gLens.position.set(2.54, 4.95, faceZ);
      gLens.rotation.y = rotY;
      sGrp.add(gLens);
    }

    group.add(sGrp);
  }

  const gantrySpecs = [
    {
      x: 0,
      z: -50,
      rotY: 0,
      top: 'SUDIRMAN · SCBD · MONAS',
      bot: 'JALUR PROTOKOL  ↑',
    },
    {
      x: 0,
      z: 42,
      rotY: Math.PI,
      top: 'BLOK M · SENAYAN GBK',
      bot: 'PUSAT KOTA  ↑',
    },
    {
      x: -42,
      z: 0,
      rotY: Math.PI / 2,
      top: 'TANAH ABANG ←  MONAS ↑',
      bot: 'KOTA TUA · PRIOK →',
    },
  ];
  for (const gs of gantrySpecs) {
    const gGrp = new THREE.Group();
    gGrp.position.set(gs.x, 0, gs.z);
    gGrp.rotation.y = gs.rotY;

    for (const px of [-7.5, 7.5]) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.2, 7.2, 8),
        pjuMetalMat
      );
      col.position.set(px, 3.6, 0);
      gGrp.add(col);
    }
    const truss = new THREE.Mesh(
      new THREE.BoxGeometry(15.6, 0.38, 0.35),
      pjuMetalMat
    );
    truss.position.set(0, 7.05, 0);
    gGrp.add(truss);

    const signTex = createGantrySignTexture(gs.top, gs.bot);
    const boardMat = new THREE.MeshStandardMaterial({
      map: signTex,
      emissive: 0x064e3b,
      emissiveIntensity: 0.14,
      roughness: 0.58,
      metalness: 0.08,
      envMapIntensity: 0.2,
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.1, 0.16), boardMat);
    board.position.set(0, 7.1, 0);
    gGrp.add(board);

    group.add(gGrp);
  }

  const shelterTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.32,
    roughness: 0.35,
    envMapIntensity: 0.25,
  });

  const treeCoords: { x: number; z: number; scale: number; isPalm: boolean }[] =
    [];
  for (let i = 0; i < 16; i++) {
    const ang = (i / 16) * Math.PI * 2;
    if (
      Math.abs(Math.cos(ang)) > 0.85 ||
      Math.abs(Math.sin(ang)) > 0.85
    ) {
      continue;
    }
    treeCoords.push({
      x: Math.cos(ang) * 16.5,
      z: Math.sin(ang) * 16.5,
      scale: 0.95 + (i % 3) * 0.12,
      isPalm: true,
    });
  }
  for (let i = 0; i < 72; i++) {
    let tx = 0;
    let tz = 0;
    if (i < 36) {
      const ang = (i / 36) * Math.PI * 2;
      const rad = 93 + (i % 3) * 4;
      tx = Math.cos(ang) * rad;
      tz = Math.sin(ang) * rad;
    } else {
      const idx = i - 36;
      const side = idx % 2 === 0 ? -10.8 : 10.8;
      if (idx < 18) {
        tx = side;
        tz = -76 + idx * 9;
      } else {
        tx = -76 + (idx - 18) * 9;
        tz = side;
      }
    }
    if (isOnRoadway(tx, tz) || isNearBuilding(tx, tz, 2.4)) continue;
    treeCoords.push({
      x: tx,
      z: tz,
      scale: 0.88 + ((i * 19) % 32) / 100,
      isPalm: i % 4 === 0,
    });
  }

  const tCount = treeCoords.length;
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.34, 3.45, 7);
  trunkGeo.translate(0, 1.72, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3525,
    roughness: 0.94,
    metalness: 0.02,
    flatShading: true,
    envMapIntensity: 0.16,
  });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, tCount);
  trunkInst.castShadow = true;

  const branchGeo = new THREE.CylinderGeometry(0.07, 0.15, 1.75, 5);
  branchGeo.rotateZ(0.56);
  branchGeo.translate(-0.46, 3.05, 0.12);
  const branchInst = new THREE.InstancedMesh(branchGeo, trunkMat, tCount);

  const branchBGeo = new THREE.CylinderGeometry(0.06, 0.13, 1.45, 5);
  branchBGeo.rotateZ(-0.48);
  branchBGeo.rotateY(0.65);
  branchBGeo.translate(0.42, 3.25, -0.18);
  const branchBInst = new THREE.InstancedMesh(branchBGeo, trunkMat, tCount);

  // Multi-cluster faceted low-poly tropical canopies (asymmetric organic silhouettes, zero smooth spheres)
  const crownCenterGeo = new THREE.DodecahedronGeometry(1.48, 0);
  crownCenterGeo.scale(1.26, 0.72, 1.18);
  crownCenterGeo.rotateY(0.35);
  crownCenterGeo.translate(0.08, 4.05, -0.05);

  const crownSideAGeo = new THREE.DodecahedronGeometry(1.16, 0);
  crownSideAGeo.scale(1.22, 0.62, 1.05);
  crownSideAGeo.rotateZ(0.22);
  crownSideAGeo.translate(-1.02, 3.52, 0.48);

  const crownSideBGeo = new THREE.DodecahedronGeometry(1.08, 0);
  crownSideBGeo.scale(1.06, 0.74, 1.24);
  crownSideBGeo.rotateX(-0.18);
  crownSideBGeo.translate(0.92, 4.38, -0.44);

  const crownTopGeo = new THREE.IcosahedronGeometry(0.92, 0);
  crownTopGeo.scale(1.18, 0.68, 1.08);
  crownTopGeo.translate(-0.22, 4.92, 0.24);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.92,
    metalness: 0.0,
    flatShading: true,
    envMapIntensity: 0.14,
  });
  const crownCenterInst = new THREE.InstancedMesh(
    crownCenterGeo,
    foliageMat,
    tCount
  );
  const crownSideAInst = new THREE.InstancedMesh(
    crownSideAGeo,
    foliageMat,
    tCount
  );
  const crownSideBInst = new THREE.InstancedMesh(
    crownSideBGeo,
    foliageMat,
    tCount
  );
  const crownTopInst = new THREE.InstancedMesh(
    crownTopGeo,
    foliageMat,
    tCount
  );
  crownCenterInst.castShadow = true;
  crownSideAInst.castShadow = true;
  crownTopInst.castShadow = true;

  const clr = new THREE.Color();
  const trunkClr = new THREE.Color();
  treeCoords.forEach((tc, i) => {
    const leanX = Math.sin(i * 2.13) * 0.085;
    const leanZ = Math.cos(i * 1.71) * 0.085;
    const yaw = (i * 1.618 * Math.PI) % (Math.PI * 2);
    dummy.position.set(tc.x, 0, tc.z);
    dummy.rotation.set(leanX, yaw, leanZ);
    const s = tc.scale;
    const widthJitter = 0.86 + ((i * 29) % 30) / 100;
    const heightJitter = 0.88 + ((i * 17) % 28) / 100;
    dummy.scale.set(
      tc.isPalm ? s * 0.78 * widthJitter : s * 1.06 * widthJitter,
      tc.isPalm ? s * 1.24 * heightJitter : s * 0.98 * heightJitter,
      tc.isPalm ? s * 0.78 * widthJitter : s * 1.04 * widthJitter
    );
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    branchInst.setMatrixAt(i, dummy.matrix);
    branchBInst.setMatrixAt(i, dummy.matrix);
    crownCenterInst.setMatrixAt(i, dummy.matrix);
    crownSideAInst.setMatrixAt(i, dummy.matrix);
    crownSideBInst.setMatrixAt(i, dummy.matrix);
    crownTopInst.setMatrixAt(i, dummy.matrix);

    trunkClr.setHSL(0.075 + ((i % 3) - 1) * 0.01, 0.34, 0.19 + (i % 3) * 0.025);
    trunkInst.setColorAt(i, trunkClr);

    // Rich tropical foliage palette variation (deep emerald, warm olive, sun-kissed angsana leaf)
    const hueBase = tc.isPalm ? 0.28 : 0.32;
    clr.setHSL(
      hueBase + ((i % 7) - 3) * 0.018,
      0.56 + (i % 3) * 0.08,
      0.16 + (i % 4) * 0.032
    );
    crownCenterInst.setColorAt(i, clr);
    clr.offsetHSL(-0.018, 0.05, -0.025);
    crownSideAInst.setColorAt(i, clr);
    clr.offsetHSL(0.032, 0.04, 0.045);
    crownSideBInst.setColorAt(i, clr);
    clr.offsetHSL(0.015, -0.02, 0.055);
    crownTopInst.setColorAt(i, clr);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  branchInst.instanceMatrix.needsUpdate = true;
  branchBInst.instanceMatrix.needsUpdate = true;
  crownCenterInst.instanceMatrix.needsUpdate = true;
  crownSideAInst.instanceMatrix.needsUpdate = true;
  crownSideBInst.instanceMatrix.needsUpdate = true;
  crownTopInst.instanceMatrix.needsUpdate = true;
  if (trunkInst.instanceColor) trunkInst.instanceColor.needsUpdate = true;
  if (crownCenterInst.instanceColor)
    crownCenterInst.instanceColor.needsUpdate = true;
  if (crownSideAInst.instanceColor)
    crownSideAInst.instanceColor.needsUpdate = true;
  if (crownSideBInst.instanceColor)
    crownSideBInst.instanceColor.needsUpdate = true;
  if (crownTopInst.instanceColor)
    crownTopInst.instanceColor.needsUpdate = true;
  group.add(
    trunkInst,
    branchInst,
    branchBInst,
    crownCenterInst,
    crownSideAInst,
    crownSideBInst,
    crownTopInst
  );

  // Elevated MRT Jakarta "Ratangga" Viaduct & Moving 3-Car Train along Sudirman Corridor
  const mrtConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.05,
    envMapIntensity: 0.06,
  });
  const mrtBodyMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.72,
    metalness: 0.18,
    envMapIntensity: 0.1,
  });
  const mrtStripeMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.18,
    roughness: 0.65,
    envMapIntensity: 0.08,
  });
  const mrtWinMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.25,
    roughness: 0.5,
    envMapIntensity: 0.08,
  });

  const mrtTrackX = -13.6;
  const mrtDeckY = 8.6;
  const mrtViaductBeam = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.55, 168),
    mrtConcreteMat
  );
  mrtViaductBeam.position.set(mrtTrackX, mrtDeckY, 0);
  group.add(mrtViaductBeam);

  for (const zPillar of [-74, -52, -36, 36, 54, 74]) {
    if (isNearBuilding(mrtTrackX, zPillar, 1.6)) continue;
    const mPillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, mrtDeckY, 8),
      mrtConcreteMat
    );
    mPillar.position.set(mrtTrackX, mrtDeckY * 0.5, zPillar);
    group.add(mPillar);
  }

  const mrtTrainGroup = new THREE.Group();
  mrtTrainGroup.position.set(mrtTrackX, mrtDeckY + 0.35, -60);
  for (const carOffsetZ of [-6.8, 0, 6.8]) {
    const carShell = new THREE.Mesh(
      new THREE.BoxGeometry(2.15, 2.25, 6.2),
      mrtBodyMat
    );
    carShell.position.set(0, 1.15, carOffsetZ);
    carShell.castShadow = true;
    mrtTrainGroup.add(carShell);

    const blueBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.38, 6.24),
      mrtStripeMat
    );
    blueBand.position.set(0, 0.85, carOffsetZ);
    mrtTrainGroup.add(blueBand);

    const windowBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.22, 0.56, 5.4),
      mrtWinMat
    );
    windowBand.position.set(0, 1.45, carOffsetZ);
    mrtTrainGroup.add(windowBand);
  }
  group.add(mrtTrainGroup);

  // Elevated MRT Station Boarding Beacons (Dukuh Atas z=-68 & Blok M z=68)
  const stationRingMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
  });
  for (const stZ of [-68, 68]) {
    const stationRing = new THREE.Mesh(
      new THREE.RingGeometry(1.4, 2.05, 24),
      stationRingMat
    );
    stationRing.rotation.x = -Math.PI / 2;
    stationRing.position.set(mrtTrackX, 0.09, stZ);
    group.add(stationRing);
  }

  const setWeatherTransition = (
    nightFactor: number,
    _wetnessFactor: number,
    elapsedTime: number = 0
  ) => {
    const n = Math.max(0, Math.min(1, nightFactor));
    pjuBulbMat.emissiveIntensity = 0.15 + n * 1.35;
    lightPoolMat.opacity = n * 0.16;
    poolInst.visible = n > 0.06;
    shelterTrimMat.emissiveIntensity = 0.15 + Math.min(1, n * 1.5) * 0.3;
    mrtWinMat.emissiveIntensity = 0.14 + n * 0.48;

    // Smooth shuttle motion for MRT Ratangga train along Sudirman viaduct (-68..68)
    const mrtState = computeMrtTrainState(elapsedTime);
    mrtTrainGroup.position.z = mrtState.z;
  };

  const setTrafficSignalPhase = (phase: TrafficSignalPhase) => {
    nsRedMat.color.setHex(
      phase === 'ew_green' || phase === 'ew_amber' ? 0xef4444 : 0x3b1216
    );
    nsAmberMat.color.setHex(phase === 'ns_amber' ? 0xfacc15 : 0x3b2a0b);
    nsGreenMat.color.setHex(phase === 'ns_green' ? 0x22c55e : 0x10331d);

    ewRedMat.color.setHex(
      phase === 'ns_green' || phase === 'ns_amber' ? 0xef4444 : 0x3b1216
    );
    ewAmberMat.color.setHex(phase === 'ew_amber' ? 0xfacc15 : 0x3b2a0b);
    ewGreenMat.color.setHex(phase === 'ew_green' ? 0x22c55e : 0x10331d);
  };

  const setWeatherVisuals = (weather: WeatherMode) => {
    const nf = weather === 'malam' ? 1 : weather === 'siang' ? 0 : 0.65;
    setWeatherTransition(nf, weather === 'hujan' ? 1 : 0, 0);
  };

  return {
    group,
    sidewalkRects,
    pjuLightAnchors: polePositions.map((p) => ({ x: p.x, z: p.z })),
    setWeatherVisuals,
    setWeatherTransition,
    setTrafficSignalPhase,
  };
}

export function buildElevatedHighwayMesh(
  roadMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.05,
    envMapIntensity: 0.06,
  });
  const barrierRailMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xb45309,
    emissiveIntensity: 0.1,
    roughness: 0.76,
    metalness: 0.2,
    envMapIntensity: 0.08,
  });

  const deckGeo = new THREE.BoxGeometry(84, 0.5, 9.0);
  const deckMesh = new THREE.Mesh(deckGeo, roadMat);
  deckMesh.position.set(0, 6.2 - 0.25, -26);
  deckMesh.receiveShadow = true;
  deckMesh.castShadow = true;
  group.add(deckMesh);

  for (const sz of [-30.35, -21.65]) {
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(84, 0.7, 0.38),
      concreteMat
    );
    parapet.position.set(0, 6.35, sz);
    group.add(parapet);

    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(84, 0.14, 0.42),
      barrierRailMat
    );
    rail.position.set(0, 6.72, sz);
    group.add(rail);
  }

  const pillarGeo = new THREE.CylinderGeometry(0.85, 1.05, 5.6, 10);
  const capGeo = new THREE.BoxGeometry(2.2, 0.65, 7.6);
  for (const px of [-36, -20, -8, 8, 20, 36]) {
    const pillar = new THREE.Mesh(pillarGeo, concreteMat);
    pillar.position.set(px, 2.8, -26);
    pillar.castShadow = true;
    group.add(pillar);

    const cap = new THREE.Mesh(capGeo, concreteMat);
    cap.position.set(px, 5.7, -26);
    group.add(cap);
  }

  const rampHoriz = 26;
  const rampRise = 6.2;
  const rampLen = Math.hypot(rampHoriz, rampRise);
  const rampAngle = Math.atan2(rampRise, rampHoriz);

  const westRamp = new THREE.Mesh(
    new THREE.BoxGeometry(rampLen, 0.45, 8.8),
    roadMat
  );
  westRamp.position.set(-55, rampRise / 2 - 0.2, -26);
  westRamp.rotation.z = rampAngle;
  westRamp.receiveShadow = true;
  group.add(westRamp);

  const eastRamp = new THREE.Mesh(
    new THREE.BoxGeometry(rampLen, 0.45, 8.8),
    roadMat
  );
  eastRamp.position.set(55, rampRise / 2 - 0.2, -26);
  eastRamp.rotation.z = -rampAngle;
  eastRamp.receiveShadow = true;
  group.add(eastRamp);

  const archBeam = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.05, 9.8),
    concreteMat
  );
  archBeam.position.set(0, 10.6, -26);
  group.add(archBeam);

  const etollTex = createGantrySignTexture(
    'GERBANG TOL DALAM KOTA',
    'e-TOLL  ·  OTOMATIS'
  );
  const etollPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.9, 6.2),
    new THREE.MeshStandardMaterial({
      map: etollTex,
      emissive: 0x065f46,
      emissiveIntensity: 0.5,
    })
  );
  etollPanel.rotation.y = Math.PI / 2;
  etollPanel.position.set(0.75, 10.6, -26);
  group.add(etollPanel);

  for (const sz of [-30.4, -21.6]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 4.5, 0.45),
      concreteMat
    );
    post.position.set(0, 8.4, sz);
    group.add(post);
  }

  return group;
}

export const INTERIOR_ROOM_CENTERS: Record<
  | 'heist_penthouse'
  | 'customs_garage'
  | 'bank_vault'
  | 'warung'
  | 'safehouse_trio'
  | 'faction_hq_jalanan'
  | 'faction_hq_sindikat'
  | 'faction_hq_rakyat'
  | 'glodok_tech_shop',
  number
> = {
  heist_penthouse: 0,
  customs_garage: 40,
  bank_vault: -40,
  warung: 80,
  safehouse_trio: -80,
  faction_hq_jalanan: 120,
  faction_hq_sindikat: -120,
  faction_hq_rakyat: 160,
  glodok_tech_shop: -160,
};

export function buildInteriorPortalsAndStage(): {
  portalsGroup: THREE.Group;
  interiorStageGroup: THREE.Group;
} {
  const portalsGroup = new THREE.Group();

  const radialGlowTex = proceduralTextures.getRadialLightPoolTexture();
  const pulseRings: THREE.Mesh[] = [];

  for (const spec of ENTERABLE_INTERIORS) {
    const pGroup = new THREE.Group();
    pGroup.position.set(spec.portalX, 0, spec.portalZ);

    // Clean, low-profile glowing ground ring (never obstructs warung stalls or doorways)
    const outerRingGeo = new THREE.RingGeometry(1.18, 1.48, 32);
    outerRingGeo.rotateX(-Math.PI / 2);
    const outerRingMat = new THREE.MeshBasicMaterial({
      color: spec.accentHex,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
    outerRing.position.y = 0.042;
    pGroup.add(outerRing);

    const pulseRingGeo = new THREE.RingGeometry(0.84, 1.0, 28);
    pulseRingGeo.rotateX(-Math.PI / 2);
    const pulseRingMat = new THREE.MeshBasicMaterial({
      color: spec.accentHex,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const pulseRing = new THREE.Mesh(pulseRingGeo, pulseRingMat);
    pulseRing.position.y = 0.046;
    pGroup.add(pulseRing);
    pulseRings.push(pulseRing);

    // Subtle soft-fading radial floor decal (opacity <= 0.16)
    const glowDiscGeo = new THREE.PlaneGeometry(3.1, 3.1);
    glowDiscGeo.rotateX(-Math.PI / 2);
    const glowDiscMat = new THREE.MeshBasicMaterial({
      map: radialGlowTex,
      color: spec.accentHex,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const glowDisc = new THREE.Mesh(glowDiscGeo, glowDiscMat);
    glowDisc.position.y = 0.04;
    pGroup.add(glowDisc);

    portalsGroup.add(pGroup);
  }
  portalsGroup.userData.pulseRings = pulseRings;

  const interiorStageGroup = new THREE.Group();
  interiorStageGroup.position.set(0, 68, 0);

  const buildRoomShell = (
    centerX: number,
    floorHex: number,
    wallHex: number,
    accentHex: number
  ) => {
    const roomGrp = new THREE.Group();
    roomGrp.position.set(centerX, 0, 0);

    const floorMat = new THREE.MeshStandardMaterial({
      color: floorHex,
      roughness: 0.82,
      metalness: 0.12,
      envMapIntensity: 0.08,
    });
    const wallMat = new THREE.MeshStandardMaterial({
      color: wallHex,
      roughness: 0.86,
      metalness: 0.08,
      envMapIntensity: 0.08,
    });
    const accentTrimMat = new THREE.MeshStandardMaterial({
      color: accentHex,
      emissive: accentHex,
      emissiveIntensity: 0.35,
      roughness: 0.5,
      envMapIntensity: 0.08,
    });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(26, 0.6, 26), floorMat);
    floor.position.set(0, -0.3, 0);
    roomGrp.add(floor);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(26, 8.5, 0.6),
      wallMat
    );
    backWall.position.set(0, 4.25, -12.7);
    roomGrp.add(backWall);

    for (const sx of [-12.7, 12.7]) {
      const sideWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 8.5, 26),
        wallMat
      );
      sideWall.position.set(sx, 4.25, 0);
      roomGrp.add(sideWall);
    }

    const trimStrip = new THREE.Mesh(
      new THREE.BoxGeometry(24, 0.22, 0.16),
      accentTrimMat
    );
    trimStrip.position.set(0, 6.8, -12.35);
    roomGrp.add(trimStrip);

    interiorStageGroup.add(roomGrp);
    return roomGrp;
  };

  // Room 1: Penthouse Komando Heist SCBD (x = 0)
  const penthouseRoom = buildRoomShell(0, 0x0f172a, 0x1e293b, 0xa855f7);
  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.42,
    roughness: 0.55,
    metalness: 0.25,
    envMapIntensity: 0.08,
  });
  const holoTable = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.95, 2.8),
    tableMat
  );
  holoTable.position.set(0, 0.48, -3.5);
  penthouseRoom.add(holoTable);

  const serverMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.78,
    metalness: 0.2,
  });
  for (const rx of [-7.5, -5.2, 5.2, 7.5]) {
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 4.2, 1.2),
      serverMat
    );
    rack.position.set(rx, 2.1, -9.8);
    penthouseRoom.add(rack);
  }

  // Room 2: Bengkel Kustom Nusantara (x = 40)
  const garageRoom = buildRoomShell(40, 0x18181b, 0x27272a, 0xf59e0b);
  const liftMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.68,
    metalness: 0.3,
  });
  for (const lx of [-3.2, 3.2]) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 4.6, 0.48),
      liftMat
    );
    post.position.set(lx, 2.3, -3.5);
    garageRoom.add(post);

    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.18, 6.2),
      liftMat
    );
    ramp.position.set(lx * 0.55, 0.12, -3.5);
    garageRoom.add(ramp);
  }
  const toolBoxMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.72,
    metalness: 0.2,
  });
  for (const tx of [-8.2, 8.2]) {
    const toolChest = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 1.6, 1.2),
      toolBoxMat
    );
    toolChest.position.set(tx, 0.8, -10.5);
    garageRoom.add(toolChest);
  }

  // Room 3: Lobi & Brankas Emas Bank Sentral (x = -40)
  const vaultRoom = buildRoomShell(-40, 0x0f172a, 0x1e293b, 0x22c55e);
  const vaultSteelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.52,
    metalness: 0.65,
    envMapIntensity: 0.12,
  });
  const vaultDoor = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.65, 24),
    vaultSteelMat
  );
  vaultDoor.rotation.x = Math.PI / 2;
  vaultDoor.position.set(0, 3.8, -11.8);
  vaultRoom.add(vaultDoor);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.32,
    roughness: 0.45,
    metalness: 0.68,
    envMapIntensity: 0.14,
  });
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = 0; gz < 3; gz++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.68, 0.72),
        goldMat
      );
      bar.position.set(gx * 1.8, 0.34, -5.8 + gz * 1.3);
      vaultRoom.add(bar);
    }
  }

  // Room 4: Warung Kopi & Jajanan Nusantara (x = 80)
  const warungRoom = buildRoomShell(80, 0x1c1917, 0x292524, 0x10b981);
  const warungWoodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.86,
    metalness: 0.06,
  });
  const warungLanternMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.48,
    roughness: 0.55,
  });
  const warungCounter = new THREE.Mesh(
    new THREE.BoxGeometry(6.8, 1.1, 1.8),
    warungWoodMat
  );
  warungCounter.position.set(0, 0.55, -6.2);
  warungRoom.add(warungCounter);

  const warungSign = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 0.65, 0.22),
    warungLanternMat
  );
  warungSign.position.set(0, 3.6, -6.2);
  warungRoom.add(warungSign);

  for (const sx of [-2.4, -0.8, 0.8, 2.4]) {
    const stool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.32, 0.68, 10),
      warungWoodMat
    );
    stool.position.set(sx, 0.34, -4.2);
    warungRoom.add(stool);
  }

  // Room 5: Safehouse Trio Menteng (x = -80) — Bed, Weapon Stash & Wardrobe
  const safehouseRoom = buildRoomShell(-80, 0x0f172a, 0x1e293b, 0x38bdf8);
  const bedFrame = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 0.65, 4.2),
    warungWoodMat
  );
  bedFrame.position.set(-6.5, 0.32, -6.5);
  safehouseRoom.add(bedFrame);
  const weaponLocker = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 3.6, 1.1),
    vaultSteelMat
  );
  weaponLocker.position.set(6.5, 1.8, -9.5);
  safehouseRoom.add(weaponLocker);

  // Interactive 3D Workstation Marker inside Safehouse (Rest Bed + Stash Ring)
  const safehousePad = new THREE.Mesh(
    new THREE.RingGeometry(1.1, 1.55, 24),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
  );
  safehousePad.rotation.x = -Math.PI / 2;
  safehousePad.position.set(-4.0, 0.06, -5.5);
  safehouseRoom.add(safehousePad);

  // Rooms 6–8: Faction HQs (jalanan x=120, sindikat x=-120, rakyat x=160)
  for (const [cx, hex] of [
    [120, 0xef4444],
    [-120, 0x8b5cf6],
    [160, 0x14b8a6],
  ] as [number, number][]) {
    const hqRoom = buildRoomShell(cx, 0x111827, 0x1f2937, hex);
    const planTable = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.95, 3.0),
      tableMat
    );
    planTable.position.set(0, 0.48, -4.0);
    hqRoom.add(planTable);
  }

  // Room 9: Glodok Tech & Rumor Shop (x = -160)
  const glodokRoom = buildRoomShell(-160, 0x18181b, 0x27272a, 0xf97316);
  const techCounter = new THREE.Mesh(
    new THREE.BoxGeometry(7.2, 1.1, 1.6),
    serverMat
  );
  techCounter.position.set(0, 0.55, -5.8);
  glodokRoom.add(techCounter);

  return { portalsGroup, interiorStageGroup };
}


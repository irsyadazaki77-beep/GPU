import * as THREE from 'three';
import { ENTERABLE_INTERIORS } from '../heists';
import type { WeatherMode } from '../types';
import { isNearBuilding, isOnRoadway } from './spatial';
import {
  SidewalkRect,
  createGantrySignTexture,
  createSidewalkTexture,
} from './textures';

export function buildJakartaStreetscape(maxAnisotropy: number): {
  group: THREE.Group;
  sidewalkRects: SidewalkRect[];
  setWeatherVisuals: (weather: WeatherMode) => void;
  setWeatherTransition: (nightFactor: number, wetnessFactor: number) => void;
} {
  const group = new THREE.Group();
  const sidewalkRects: SidewalkRect[] = [];

  const sidewalkTex = createSidewalkTexture(maxAnisotropy);
  sidewalkTex.repeat.set(1, 5);
  const sidewalkMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: sidewalkTex,
    roughness: 0.88,
    metalness: 0.04,
    envMapIntensity: 0.22,
  });
  const curbYellowMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.78,
    metalness: 0.05,
    envMapIntensity: 0.2,
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
  const lightPoolMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.08,
    depthWrite: false,
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

  const poolGeo = new THREE.CircleGeometry(3.8, 18);
  poolGeo.rotateX(-Math.PI / 2);
  poolGeo.translate(1.8, 0.056, 0);
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
    green: boolean;
  }[] = [
    { x: -7.8, z: -38.5, rotY: 0, green: true },
    { x: 7.8, z: -19.5, rotY: Math.PI, green: true },
    { x: -7.8, z: 19.5, rotY: 0, green: false },
    { x: 7.8, z: 38.5, rotY: Math.PI, green: false },
    { x: -38.5, z: -7.8, rotY: -Math.PI / 2, green: false },
    { x: 38.5, z: 7.8, rotY: Math.PI / 2, green: true },
  ];
  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.45,
    metalness: 0.5,
    envMapIntensity: 0.25,
  });
  const greenLensMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
  const redLensMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

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
      new THREE.BoxGeometry(1.1, 0.42, 0.34),
      housingMat
    );
    box.position.set(2.2, 4.95, 0);
    sGrp.add(box);

    const activeLens = new THREE.Mesh(
      new THREE.CircleGeometry(0.11, 10),
      sig.green ? greenLensMat : redLensMat
    );
    activeLens.position.set(sig.green ? 2.5 : 1.9, 4.95, 0.18);
    sGrp.add(activeLens);

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

  const glassShelterMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.38,
    roughness: 0.18,
    metalness: 0.65,
    envMapIntensity: 0.35,
  });
  const shelterTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.32,
    roughness: 0.35,
    envMapIntensity: 0.25,
  });
  for (const hPos of [
    { x: -9.0, z: -42, rotY: 0 },
    { x: 9.0, z: 42, rotY: Math.PI },
  ]) {
    const hGrp = new THREE.Group();
    hGrp.position.set(hPos.x, 0.14, hPos.z);
    hGrp.rotation.y = hPos.rotY;

    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.26, 9.5),
      pjuMetalMat
    );
    platform.position.y = 0.13;
    hGrp.add(platform);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.9, 0.18, 9.8),
      pjuMetalMat
    );
    roof.position.y = 3.15;
    roof.castShadow = true;
    hGrp.add(roof);

    const ledStrip = new THREE.Mesh(
      new THREE.BoxGeometry(2.94, 0.12, 9.84),
      shelterTrimMat
    );
    ledStrip.position.y = 3.04;
    hGrp.add(ledStrip);

    const backGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 2.4, 8.6),
      glassShelterMat
    );
    backGlass.position.set(-1.1, 1.5, 0);
    hGrp.add(backGlass);

    group.add(hGrp);
  }

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
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.36, 3.4, 8);
  trunkGeo.translate(0, 1.7, 0);
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x4a3525,
    roughness: 0.94,
    metalness: 0.02,
    envMapIntensity: 0.18,
  });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, tCount);
  trunkInst.castShadow = true;

  const branchGeo = new THREE.CylinderGeometry(0.08, 0.15, 1.6, 6);
  branchGeo.rotateZ(0.52);
  branchGeo.translate(-0.42, 3.1, 0);
  const branchInst = new THREE.InstancedMesh(branchGeo, trunkMat, tCount);

  const crownCenterGeo = new THREE.DodecahedronGeometry(1.65, 1);
  crownCenterGeo.scale(1.32, 0.66, 1.28);
  crownCenterGeo.translate(0, 3.85, 0);

  const crownSideAGeo = new THREE.DodecahedronGeometry(1.22, 1);
  crownSideAGeo.scale(1.18, 0.68, 1.15);
  crownSideAGeo.translate(-0.92, 3.55, 0.42);

  const crownSideBGeo = new THREE.DodecahedronGeometry(1.18, 1);
  crownSideBGeo.scale(1.15, 0.72, 1.18);
  crownSideBGeo.translate(0.84, 4.35, -0.36);

  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.18,
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
  crownCenterInst.castShadow = true;
  crownSideAInst.castShadow = true;

  const clr = new THREE.Color();
  treeCoords.forEach((tc, i) => {
    dummy.position.set(tc.x, 0, tc.z);
    dummy.rotation.set(0, (i * 1.37) % (Math.PI * 2), 0);
    const s = tc.scale;
    dummy.scale.set(
      tc.isPalm ? s * 0.85 : s * 1.05,
      tc.isPalm ? s * 1.22 : s * 0.95,
      tc.isPalm ? s * 0.85 : s * 1.05
    );
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    branchInst.setMatrixAt(i, dummy.matrix);
    crownCenterInst.setMatrixAt(i, dummy.matrix);
    crownSideAInst.setMatrixAt(i, dummy.matrix);
    crownSideBInst.setMatrixAt(i, dummy.matrix);

    clr.setHSL(0.35 + ((i % 5) - 2) * 0.015, 0.64, 0.16 + (i % 3) * 0.03);
    crownCenterInst.setColorAt(i, clr);
    clr.offsetHSL(-0.01, 0.04, -0.02);
    crownSideAInst.setColorAt(i, clr);
    clr.offsetHSL(0.02, 0.02, 0.04);
    crownSideBInst.setColorAt(i, clr);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  branchInst.instanceMatrix.needsUpdate = true;
  crownCenterInst.instanceMatrix.needsUpdate = true;
  crownSideAInst.instanceMatrix.needsUpdate = true;
  crownSideBInst.instanceMatrix.needsUpdate = true;
  if (crownCenterInst.instanceColor)
    crownCenterInst.instanceColor.needsUpdate = true;
  if (crownSideAInst.instanceColor)
    crownSideAInst.instanceColor.needsUpdate = true;
  if (crownSideBInst.instanceColor)
    crownSideBInst.instanceColor.needsUpdate = true;
  group.add(
    trunkInst,
    branchInst,
    crownCenterInst,
    crownSideAInst,
    crownSideBInst
  );

  const setWeatherTransition = (
    nightFactor: number,
    _wetnessFactor: number
  ) => {
    const n = Math.max(0, Math.min(1, nightFactor));
    pjuBulbMat.emissiveIntensity = 0.1 + n * 1.25;
    lightPoolMat.opacity = n * 0.12;
    shelterTrimMat.emissiveIntensity = 0.15 + Math.min(1, n * 1.5) * 0.3;
  };

  const setWeatherVisuals = (weather: WeatherMode) => {
    const nf = weather === 'malam' ? 1 : weather === 'siang' ? 0 : 0.65;
    setWeatherTransition(nf, weather === 'hujan' ? 1 : 0);
  };

  return { group, sidewalkRects, setWeatherVisuals, setWeatherTransition };
}

export function buildElevatedHighwayMesh(
  roadMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.78,
    metalness: 0.15,
  });
  const barrierRailMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.6,
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

export function buildInteriorPortalsAndStage(): {
  portalsGroup: THREE.Group;
  interiorStageGroup: THREE.Group;
} {
  const portalsGroup = new THREE.Group();

  for (const spec of ENTERABLE_INTERIORS) {
    const pGroup = new THREE.Group();
    pGroup.position.set(spec.portalX, 0, spec.portalZ);

    const ringGeo = new THREE.RingGeometry(1.4, 2.0, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: spec.accentHex,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.07;
    pGroup.add(ring);

    const archMat = new THREE.MeshBasicMaterial({
      color: spec.accentHex,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.65, 1.65, 5.5, 16, 1, true),
      archMat
    );
    cyl.position.y = 2.75;
    pGroup.add(cyl);

    portalsGroup.add(pGroup);
  }

  const interiorStageGroup = new THREE.Group();
  interiorStageGroup.position.set(0, 68, 0);

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.22,
    metalness: 0.65,
  });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(28, 0.6, 28), floorMat);
  floor.position.set(0, -0.3, 0);
  interiorStageGroup.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.3,
  });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(28, 9, 0.6), wallMat);
  backWall.position.set(0, 4.5, -13.7);
  interiorStageGroup.add(backWall);

  const tableMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.8,
  });
  const holoTable = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.95, 2.6),
    tableMat
  );
  holoTable.position.set(-5.5, 0.48, -4.5);
  interiorStageGroup.add(holoTable);

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.92,
  });
  for (let gx = 0; gx < 3; gx++) {
    for (let gz = 0; gz < 2; gz++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 0.65, 0.65),
        goldMat
      );
      bar.position.set(5.2 + gx * 1.35, 0.33, -4.5 + gz * 0.95);
      interiorStageGroup.add(bar);
    }
  }

  // Warung Nusantara wooden counter & warm display etalase inside interior stage
  const warungWoodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.82,
    metalness: 0.08,
  });
  const warungLanternMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.75,
    roughness: 0.3,
  });
  const warungCounter = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 1.05, 1.6),
    warungWoodMat
  );
  warungCounter.position.set(0, 0.52, -7.2);
  interiorStageGroup.add(warungCounter);

  const warungSign = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.55, 0.18),
    warungLanternMat
  );
  warungSign.position.set(0, 3.2, -7.2);
  interiorStageGroup.add(warungSign);

  return { portalsGroup, interiorStageGroup };
}

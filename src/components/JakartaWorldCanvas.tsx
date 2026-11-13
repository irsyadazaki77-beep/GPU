import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CITY_BUILDINGS,
  DistrictZone,
  ENEMY_ARCHETYPES,
  ENTERABLE_INTERIORS,
  EnemyBehaviorPolicy,
  EnterableInteriorSpec,
  GameState,
  NABILO_OUTFITS,
  PROTAGONIST_PROFILES,
  PlayerProgressState,
  ProtagonistId,
  STORY_MISSIONS,
  StoryChoiceOption,
  StoryMission,
  TRAFFIC_ROUTES,
  TollSignSpawn,
  TrafficAISteppable,
  TrafficRouteId,
  TrafficSignKind,
  TrafficSignSpawn,
  TransJakartaHalteSpawn,
  VEHICLE_SPECS,
  VehicleType,
  WEATHER_MODES,
  WEAPONS,
  WeatherMode,
  clampDt,
  createInitialWeatherTransitionState,
  generateInitialTrafficSpawns,
  generateRoadsideSpawnLayout,
  getGroundElevationAt,
  resolveCircleAABBCollision,
  resolveDistrictAtPosition,
  stepEnemyMovementPolicy,
  stepTrafficVehicleInPlace,
  stepWeatherTransitionInPlace,
} from '../game/rules';
import {
  SidewalkRect,
  applyVehicleCustomizationToMesh,
  buildCharacterRig,
  buildCombatDroneMesh,
  buildElevatedHighwayMesh,
  buildIndonesianVehicleMesh,
  buildInteriorPortalsAndStage,
  buildJakartaBuilding,
  buildJakartaStreetscape,
  buildPolicePursuitHeliWithSpotlight,
  buildWarungStall,
  createAsphaltRoadTexture,
} from '../game/models';
import { soundEngine } from '../game/sound';

// Module-scope scratch math objects (Zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createCrosswalkStripeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Weathered thermoplastic road paint base (non-blinding off-white)
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#94a3b8');
  grad.addColorStop(0.15, '#cbd5e1');
  grad.addColorStop(0.5, '#e2e8f0');
  grad.addColorStop(0.85, '#cbd5e1');
  grad.addColorStop(1, '#94a3b8');
  ctx.fillStyle = grad;
  ctx.fillRect(6, 4, canvas.width - 12, canvas.height - 8);

  // Tire wear & asphalt bleed-through tracks along driving direction
  const rng = createSeededRng(4109);
  for (let i = 0; i < 460; i++) {
    const x = 6 + rng() * (canvas.width - 12);
    const y = 4 + rng() * (canvas.height - 8);
    const w = 1 + rng() * 5;
    const h = 4 + rng() * 18;
    ctx.fillStyle =
      rng() > 0.28
        ? `rgba(15, 23, 42, ${0.12 + rng() * 0.22})`
        : `rgba(226, 232, 240, ${0.06 + rng() * 0.08})`;
    ctx.fillRect(x, y, w, h);
  }

  // Subtle chipped edge distress
  ctx.fillStyle = 'rgba(15, 23, 42, 0.34)';
  for (let i = 0; i < 28; i++) {
    const x = rng() > 0.5 ? 6 : canvas.width - 11;
    const y = 8 + rng() * (canvas.height - 16);
    ctx.fillRect(x, y, 5, 3 + rng() * 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createYellowBoxTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  // Outer yellow box perimeter (traffic amber-gold, showing dark asphalt inside)
  ctx.strokeStyle = 'rgba(217, 119, 6, 0.82)';
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, 476, 476);

  // Crisp diagonal Jakarta Yellow Box Junction crosshatch
  ctx.save();
  ctx.beginPath();
  ctx.rect(26, 26, 460, 460);
  ctx.clip();

  ctx.strokeStyle = 'rgba(217, 119, 6, 0.72)';
  ctx.lineWidth = 9;
  for (let offset = -512; offset <= 1024; offset += 72) {
    ctx.beginPath();
    ctx.moveTo(offset, 0);
    ctx.lineTo(offset + 512, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(offset + 512, 0);
    ctx.lineTo(offset, 512);
    ctx.stroke();
  }
  ctx.restore();

  // Tire scuff weathering across junction paint
  const rng = createSeededRng(7331);
  for (let i = 0; i < 1600; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    ctx.fillStyle = `rgba(15, 23, 42, ${0.18 + rng() * 0.28})`;
    ctx.fillRect(x, y, 2 + rng() * 5, 2 + rng() * 5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLaneArrowTexture(
  variant: 'straight' | 'straight_right',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  ctx.fillStyle = 'rgba(241, 245, 249, 0.88)';
  if (variant === 'straight') {
    // Elongated perspective highway arrow
    ctx.fillRect(108, 160, 40, 310);
    ctx.beginPath();
    ctx.moveTo(128, 34);
    ctx.lineTo(206, 174);
    ctx.lineTo(156, 174);
    ctx.lineTo(156, 160);
    ctx.lineTo(100, 160);
    ctx.lineTo(100, 174);
    ctx.lineTo(50, 174);
    ctx.closePath();
    ctx.fill();
  } else {
    // Straight + Right branch arrow
    ctx.fillRect(72, 160, 34, 310);
    ctx.beginPath();
    ctx.moveTo(89, 44);
    ctx.lineTo(154, 174);
    ctx.lineTo(24, 174);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(104, 330);
    ctx.quadraticCurveTo(138, 250, 180, 238);
    ctx.lineTo(180, 200);
    ctx.lineTo(238, 254);
    ctx.lineTo(180, 308);
    ctx.lineTo(180, 272);
    ctx.quadraticCurveTo(148, 280, 106, 366);
    ctx.closePath();
    ctx.fill();
  }

  // Asphalt wear speckles
  const rng = createSeededRng(variant === 'straight' ? 9123 : 9455);
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 480; i++) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + rng() * 0.3})`;
    ctx.fillRect(rng() * 256, rng() * 512, 2 + rng() * 4, 3 + rng() * 9);
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBuswayStencilTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  // Terracotta / red TransJakarta lane stripe backing
  ctx.fillStyle = 'rgba(153, 27, 27, 0.72)';
  ctx.fillRect(14, 0, 228, 512);

  // Crisp side borders
  ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.fillRect(14, 0, 10, 512);
  ctx.fillRect(232, 0, 10, 512);

  // Vertical stencil text "BUSWAY"
  ctx.save();
  ctx.translate(128, 256);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '900 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.fillText('BUSWAY', 0, 0);
  ctx.restore();

  const rng = createSeededRng(5021);
  for (let i = 0; i < 650; i++) {
    ctx.fillStyle = `rgba(15, 23, 42, ${0.08 + rng() * 0.16})`;
    ctx.fillRect(rng() * 256, rng() * 512, 2 + rng() * 4, 4 + rng() * 12);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCrackDecalTexture(
  seed: number,
  style: 'sidewalk' | 'asphalt',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const rng = createSeededRng(seed);

  const drawBranch = (
    sx: number,
    sy: number,
    angle: number,
    length: number,
    width: number,
    depth: number
  ) => {
    if (depth > 3 || length < 10) return;

    const segments = 5 + Math.floor(rng() * 4);
    const step = length / segments;
    let cx = sx;
    let cy = sy;
    let curAngle = angle;

    const pts: { x: number; y: number }[] = [{ x: cx, y: cy }];
    for (let i = 0; i < segments; i++) {
      curAngle += (rng() - 0.5) * 0.65;
      cx += Math.cos(curAngle) * step;
      cy += Math.sin(curAngle) * step;
      pts.push({ x: cx, y: cy });

      if (depth < 3 && i > 0 && rng() > 0.48) {
        const branchSign = rng() > 0.5 ? 1 : -1;
        drawBranch(
          cx,
          cy,
          curAngle + branchSign * (0.42 + rng() * 0.55),
          length * (0.42 + rng() * 0.25),
          Math.max(0.9, width * 0.62),
          depth + 1
        );
      }
    }

    // Weathered crevice grime / chipped concrete halo around fracture
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle =
      style === 'sidewalk'
        ? 'rgba(30, 41, 59, 0.38)'
        : 'rgba(2, 6, 23, 0.36)';
    ctx.lineWidth = width + (style === 'sidewalk' ? 6.5 : 4.5);
    ctx.stroke();

    // Chipped bright concrete edge highlight on sidewalk cracks
    if (style === 'sidewalk') {
      ctx.beginPath();
      ctx.moveTo(pts[0].x + 2.0, pts[0].y + 2.0);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x + 2.0, pts[i].y + 2.0);
      }
      ctx.strokeStyle = 'rgba(241, 245, 249, 0.44)';
      ctx.lineWidth = Math.max(1.2, width * 0.55);
      ctx.stroke();
    }

    // Dark jagged crack core (or bitumen tar seal for asphalt)
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.strokeStyle =
      style === 'sidewalk'
        ? 'rgba(9, 13, 22, 0.94)'
        : 'rgba(10, 14, 22, 0.92)';
    ctx.lineWidth = width;
    ctx.stroke();
  };

  // Primary fracture radiating through the decal
  const startAngle = rng() * Math.PI * 2;
  const rx = 128 + Math.cos(startAngle + Math.PI) * 92;
  const ry = 128 + Math.sin(startAngle + Math.PI) * 92;
  drawBranch(rx, ry, startAngle, 175, style === 'sidewalk' ? 5.4 : 4.2, 0);

  if (style === 'sidewalk') {
    // Secondary crossing hairline crack for realistic slab weathering
    const crossAngle = startAngle + (rng() > 0.5 ? 1.15 : -1.15);
    drawBranch(
      128 + Math.cos(crossAngle + Math.PI) * 58,
      128 + Math.sin(crossAngle + Math.PI) * 58,
      crossAngle,
      120,
      3.1,
      1
    );
    // Spall chips near fracture intersection
    for (let i = 0; i < 24; i++) {
      const x = 36 + rng() * 184;
      const y = 36 + rng() * 184;
      ctx.fillStyle =
        rng() > 0.4 ? 'rgba(15, 23, 42, 0.48)' : 'rgba(226, 232, 240, 0.36)';
      ctx.fillRect(x, y, 2 + rng() * 5, 2 + rng() * 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createManholeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  // Outer concrete collar
  ctx.fillStyle = '#475569';
  ctx.fillRect(10, 10, 108, 108);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 108, 108);

  // Cast-iron drainage grate slats
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(18, 18, 92, 92);
  ctx.fillStyle = '#090d16';
  for (let x = 24; x <= 96; x += 12) {
    ctx.fillRect(x, 24, 6, 80);
  }
  ctx.fillStyle = '#334155';
  ctx.fillRect(18, 61, 92, 6);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildProceduralRoadDetailSystem(
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
    { x: 0, z: 32, w: 13.6, d: 9.8 },
    { x: -32, z: 0, w: 9.8, d: 13.6 },
    { x: 32, z: 0, w: 9.8, d: 13.6 },
    { x: -32, z: -32, w: 9.8, d: 9.8 },
    { x: 32, z: -32, w: 9.8, d: 9.8 },
    { x: -32, z: 32, w: 9.8, d: 9.8 },
    { x: 32, z: 32, w: 9.8, d: 9.8 },
    // Clean asphalt backing under crosswalks so yellow/white dashed centerlines stop cleanly
    { x: 0, z: -20.0, w: 13.4, d: 2.5 },
    { x: 0, z: 20.0, w: 13.4, d: 2.5 },
    { x: -20.0, z: 0, w: 2.5, d: 13.4 },
    { x: 20.0, z: 0, w: 2.5, d: 13.4 },
    { x: 0, z: -26.1, w: 13.4, d: 2.5 },
    { x: 0, z: 26.1, w: 13.4, d: 2.5 },
    { x: 0, z: -38.3, w: 13.4, d: 2.5 },
    { x: 0, z: 38.3, w: 13.4, d: 2.5 },
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
    dummy.position.set(s.x, 0.045, s.z);
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
      opacity: 0.82,
      depthWrite: false,
      roughness: 0.82,
      metalness: 0.04,
      envMapIntensity: 0.2,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const yellowBoxCoords: { x: number; z: number; w: number; d: number }[] = [
    { x: 0, z: -32, w: 12.6, d: 8.8 },
    { x: 0, z: 32, w: 12.6, d: 8.8 },
    { x: -32, z: 0, w: 8.8, d: 12.6 },
    { x: 32, z: 0, w: 8.8, d: 12.6 },
  ];
  const yellowBoxInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    yellowBoxMat,
    yellowBoxCoords.length
  );
  yellowBoxCoords.forEach((jb, i) => {
    dummy.position.set(jb.x, 0.049, jb.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(jb.w, 1, jb.d);
    dummy.updateMatrix();
    yellowBoxInst.setMatrixAt(i, dummy.matrix);
  });
  yellowBoxInst.instanceMatrix.needsUpdate = true;
  group.add(yellowBoxInst);

  // 3. TransJakarta Busway Terracotta Corridor Strips & BUSWAY Stencils along Sudirman N-S arterials
  const buswaySegments: [number, number][] = [
    [-86, -39.9],
    [39.9, 86],
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
    { x: -1.85, z: -48, rotY: 0 },
    { x: 1.85, z: -48, rotY: Math.PI },
    { x: -1.85, z: -68, rotY: 0 },
    { x: 1.85, z: -68, rotY: Math.PI },
    { x: -1.85, z: 48, rotY: 0 },
    { x: 1.85, z: 48, rotY: Math.PI },
    { x: -1.85, z: 68, rotY: 0 },
    { x: 1.85, z: 68, rotY: Math.PI },
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

  // 4. Zebra Crosswalks (Textured Pedestrian Crossings at Monas, Sudirman & Ring Intersections)
  const stripeTex = trackTex(createCrosswalkStripeTexture(maxAnisotropy));
  const stripeMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: stripeTex,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
      roughness: 0.84,
      metalness: 0.04,
      envMapIntensity: 0.2,
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
        // Crosswalk across a N-S road: stripes spaced along X, oriented along Z
        crosswalkEntries.push({
          x: cx + offset,
          z: cz,
          rotY: 0,
          w: 0.52,
          l: stripeLength,
        });
      } else {
        // Crosswalk across an E-W road: stripes spaced along Z, oriented along X
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

  // Monas perimeter crosswalks (outside r=18.5 plaza)
  pushCrosswalk(0, -20.0, 'ns', 14, 2.0);
  pushCrosswalk(0, 20.0, 'ns', 14, 2.0);
  pushCrosswalk(-20.0, 0, 'ew', 14, 2.0);
  pushCrosswalk(20.0, 0, 'ew', 14, 2.0);

  // Sudirman x Ring intersections (0, ±32) & (±32, 0)
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

  // Secondary ring corner intersections (±32, ±32)
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

  // 5. Intersection Stop Lines (Garis Henti) & Directional Lane Arrows
  const paintLineMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.82,
      metalness: 0.04,
      envMapIntensity: 0.2,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  const stopLines: { x: number; z: number; rotY: number; w: number }[] = [
    // Monas approach stop lines
    { x: -3.4, z: -21.7, rotY: 0, w: 6.0 },
    { x: 3.4, z: 21.7, rotY: 0, w: 6.0 },
    { x: -21.7, z: 3.4, rotY: Math.PI / 2, w: 6.0 },
    { x: 21.7, z: -3.4, rotY: Math.PI / 2, w: 6.0 },
    // Sudirman x ±32 stop lines
    { x: -3.4, z: -40.1, rotY: 0, w: 6.0 },
    { x: 3.4, z: -24.4, rotY: 0, w: 6.0 },
    { x: -3.4, z: 24.4, rotY: 0, w: 6.0 },
    { x: 3.4, z: 40.1, rotY: 0, w: 6.0 },
    // E-W x ±32 stop lines
    { x: -40.1, z: 3.4, rotY: Math.PI / 2, w: 6.0 },
    { x: -24.4, z: -3.4, rotY: Math.PI / 2, w: 6.0 },
    { x: 24.4, z: 3.4, rotY: Math.PI / 2, w: 6.0 },
    { x: 40.1, z: -3.4, rotY: Math.PI / 2, w: 6.0 },
    // Ring intersections stop lines
    { x: -10.3, z: -34.2, rotY: Math.PI / 2, w: 4.1 },
    { x: 10.3, z: -29.8, rotY: Math.PI / 2, w: 4.1 },
    { x: -10.3, z: 34.2, rotY: Math.PI / 2, w: 4.1 },
    { x: 10.3, z: 29.8, rotY: Math.PI / 2, w: 4.1 },
    { x: -34.2, z: 10.3, rotY: 0, w: 4.1 },
    { x: -29.8, z: -10.3, rotY: 0, w: 4.1 },
    { x: 29.8, z: 10.3, rotY: 0, w: 4.1 },
    { x: 34.2, z: -10.3, rotY: 0, w: 4.1 },
  ];
  const stopLineInst = new THREE.InstancedMesh(
    unitPlaneGeo,
    paintLineMat,
    stopLines.length
  );
  stopLines.forEach((sl, i) => {
    dummy.position.set(sl.x, 0.051, sl.z);
    dummy.rotation.set(0, sl.rotY, 0);
    dummy.scale.set(sl.w, 1, 0.42);
    dummy.updateMatrix();
    stopLineInst.setMatrixAt(i, dummy.matrix);
  });
  stopLineInst.instanceMatrix.needsUpdate = true;
  group.add(stopLineInst);

  // Directional lane arrows
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
      roughness: 0.72,
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
      roughness: 0.72,
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
    if (x * x + z * z < 20.5 * 20.5) return;
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

  // 7. Procedural Sidewalk Cracks (Retakan Trotoar), Expansion Seams & Drainage Grates
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
        // Expansion seam
        swSeams.push({
          x: (rect.minX + rect.maxX) * 0.5,
          z: zPos,
          w: width - 0.28,
          d: 0.06,
        });
        // Branching sidewalk crack
        if (swRng() > 0.12) {
          const target = swRng() > 0.5 ? swCracksA : swCracksB;
          const crackScale = Math.min(safeW, 2.7) * (0.82 + swRng() * 0.34);
          target.push({
            x:
              rect.minX +
              0.55 +
              swRng() * Math.max(0.2, width - 1.1),
            z: zPos + (swRng() - 0.5) * 2.8,
            rotY: swRng() * Math.PI * 2,
            sx: crackScale,
            sz: crackScale * (0.85 + swRng() * 0.35),
          });
        }
        // Occasional sidewalk storm drain grate
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
            z:
              rect.minZ +
              0.55 +
              swRng() * Math.max(0.2, depth - 1.1),
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
    cleanoutMat.roughness = 0.88 - w * 0.64;
    cleanoutMat.metalness = 0.05 + w * 0.19;
    yellowBoxMat.roughness = 0.82 - w * 0.56;
    stripeMat.roughness = 0.84 - w * 0.56;
    paintLineMat.roughness = 0.82 - w * 0.54;
    straightArrowMat.roughness = 0.72 - w * 0.44;
    straightRightArrowMat.roughness = 0.72 - w * 0.44;
    buswayStencilMat.roughness = 0.7 - w * 0.44;
    swCrackMatA.roughness = 0.85 - w * 0.51;
    swCrackMatB.roughness = 0.85 - w * 0.51;
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

function createTrafficSignTexture(
  kind: TrafficSignKind,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  if (
    kind === 'dilarang_parkir' ||
    kind === 'batas_kecepatan_40' ||
    kind === 'batas_kecepatan_60'
  ) {
    // Circular Indonesian regulatory Dishub sign
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(128, 128, 122, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 22;
    ctx.strokeStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(128, 128, 108, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(128, 128, 121, 0, Math.PI * 2);
    ctx.stroke();

    if (kind === 'dilarang_parkir') {
      ctx.fillStyle = '#1e3a8a';
      ctx.beginPath();
      ctx.arc(128, 128, 96, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8fafc';
      ctx.font = '900 132px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', 128, 134);

      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 22;
      ctx.beginPath();
      ctx.moveTo(52, 52);
      ctx.lineTo(204, 204);
      ctx.stroke();
    } else {
      const limitLabel = kind === 'batas_kecepatan_40' ? '40' : '60';
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 104px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(limitLabel, 128, 120);

      ctx.font = '700 24px sans-serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('km/j', 128, 178);
    }
  } else if (kind === 'arah_wajib_lurus') {
    ctx.fillStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(128, 128, 122, 0, Math.PI * 2);
    ctx.fill();

    ctx.lineWidth = 8;
    ctx.strokeStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(128, 128, 114, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(114, 96, 28, 108);
    ctx.beginPath();
    ctx.moveTo(128, 44);
    ctx.lineTo(182, 106);
    ctx.lineTo(74, 106);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'peringatan_penyeberangan') {
    // Indonesian Yellow Diamond Warning Sign (Zebra Cross)
    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-86, -86, 172, 172);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeRect(-78, -78, 156, 156);
    ctx.restore();

    // Zebra stripes + pedestrian silhouette
    ctx.fillStyle = '#0f172a';
    for (const sx of [86, 110, 134, 158]) {
      ctx.fillRect(sx, 166, 14, 18);
    }
    ctx.beginPath();
    ctx.arc(128, 88, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(128, 102);
    ctx.lineTo(124, 134);
    ctx.lineTo(106, 162);
    ctx.moveTo(124, 134);
    ctx.lineTo(146, 162);
    ctx.moveTo(104, 120);
    ctx.lineTo(148, 118);
    ctx.stroke();
  } else {
    // 'khusus_busway' Rectangular Dishub Busway Regulation Board
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(6, 6, 244, 244);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, 228, 228);

    // Bus pictogram
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(72, 40, 112, 86);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(84, 52, 88, 36);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(82, 104, 20, 12);
    ctx.fillRect(154, 104, 20, 12);

    ctx.fillStyle = '#facc15';
    ctx.fillRect(28, 148, 200, 38);
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KHUSUS', 128, 168);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '900 32px sans-serif';
    ctx.fillText('BUSWAY', 128, 212);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTollSignTexture(
  topText: string,
  bottomText: string,
  badgeText: string,
  theme: 'green_arterial' | 'blue_toll',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 320;
  const ctx = canvas.getContext('2d')!;

  const bgTop = theme === 'blue_toll' ? '#1e40af' : '#065f46';
  const bgBot = theme === 'blue_toll' ? '#1d4ed8' : '#047857';
  const grad = ctx.createLinearGradient(0, 0, 0, 320);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 768, 320);

  // Outer reflective white border
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 740, 292);

  // Horizontal divider bar
  ctx.fillStyle = 'rgba(248, 250, 252, 0.35)';
  ctx.fillRect(28, 168, 712, 4);

  // Jasa Marga / Dishub highway badge box
  ctx.fillStyle = badgeText === 'TOL' ? '#facc15' : '#e2e8f0';
  ctx.fillRect(36, 36, 98, 56);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, 98, 56);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, 85, 66);

  // Top primary destination text
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(topText, 434, 98, 570);

  // Bottom route detail text
  ctx.fillStyle = '#fef08a';
  ctx.font = '800 34px sans-serif';
  ctx.fillText(bottomText, 384, 236, 680);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHalteBoardTexture(
  stationName: string,
  corridorCode: string,
  routeSummary: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#082f49';
  ctx.fillRect(0, 0, 1024, 192);

  // Top sky-blue TransJakarta accent bar
  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(0, 0, 1024, 20);
  ctx.fillRect(0, 174, 1024, 18);

  // Corridor circular/shield emblem on left
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(96, 96, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#f8fafc';
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(corridorCode, 96, 98);

  // Station title
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 52px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(stationName, 178, 72, 810);

  // Route subtitle
  ctx.fillStyle = '#7dd3fc';
  ctx.font = '800 30px sans-serif';
  ctx.fillText(`TRANSJAKARTA  ·  ${routeSummary}`, 178, 132, 810);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHalteTotemTexture(
  stationName: string,
  corridorCode: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 768;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, 256, 768);

  ctx.fillStyle = '#0284c7';
  ctx.fillRect(14, 14, 228, 220);

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 108px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('T', 128, 106);

  ctx.font = '800 24px sans-serif';
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText('TRANSJAKARTA', 128, 198);

  // Corridor badge
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(128, 340, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 46px sans-serif';
  ctx.fillText(corridorCode, 128, 342);

  // Vertical station label block
  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 24px sans-serif';
  const words = stationName.replace('HALTE ', '').split(' ');
  words.forEach((word, idx) => {
    ctx.fillText(word, 128, 465 + idx * 42, 220);
  });

  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(28, 690, 200, 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildAuthenticRoadsideSystem(
  sidewalkRects: SidewalkRect[],
  maxAnisotropy: number
): {
  group: THREE.Group;
  setWeatherVisuals: (weather: WeatherMode) => void;
  setWeatherTransition: (nightFactor: number, wetnessFactor: number) => void;
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

  const layout = generateRoadsideSpawnLayout(sidewalkRects);

  // Shared PBR structural materials
  const galvanizedSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.76,
      roughness: 0.34,
    })
  );
  const darkSteelMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.68,
      roughness: 0.42,
    })
  );
  const concretePlinthMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.06,
      roughness: 0.88,
    })
  );
  const yellowTactileMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.08,
      roughness: 0.64,
    })
  );
  const aluminumBackMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.72,
      roughness: 0.38,
    })
  );
  const halteGlassMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.36,
      roughness: 0.1,
      metalness: 0.82,
    })
  );
  const halteLedMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.85,
      roughness: 0.22,
      metalness: 0.25,
    })
  );
  const nfcPadMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x16a34a,
      emissive: 0x22c55e,
      emissiveIntensity: 0.9,
      roughness: 0.25,
    })
  );
  const hoodLampMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xfde68a,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    })
  );
  const halteRoofMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x0369a1,
      metalness: 0.52,
      roughness: 0.36,
    })
  );

  const reflectiveBoardMats: THREE.MeshStandardMaterial[] = [];
  const litSignMats: THREE.MeshStandardMaterial[] = [];

  // 1. Build Rambu Lalu Lintas (6 Indonesian Dishub sign types)
  const signKinds: TrafficSignKind[] = [
    'dilarang_parkir',
    'batas_kecepatan_40',
    'batas_kecepatan_60',
    'khusus_busway',
    'peringatan_penyeberangan',
    'arah_wajib_lurus',
  ];
  const signFaceMatByKind = new Map<TrafficSignKind, THREE.MeshStandardMaterial>();
  for (const kind of signKinds) {
    const tex = trackTex(createTrafficSignTexture(kind, maxAnisotropy));
    const mat = trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.14,
        roughness: 0.28,
        metalness: 0.18,
        transparent: kind === 'peringatan_penyeberangan',
        alphaTest: kind === 'peringatan_penyeberangan' ? 0.5 : 0,
      })
    );
    reflectiveBoardMats.push(mat);
    signFaceMatByKind.set(kind, mat);
  }

  const signBaseGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.18, 0.14, 10));
  signBaseGeo.translate(0, 0.07, 0);
  const signPoleGeo = trackGeo(new THREE.CylinderGeometry(0.042, 0.052, 2.75, 10));
  signPoleGeo.translate(0, 1.375, 0);
  const clampGeo = trackGeo(new THREE.CylinderGeometry(0.068, 0.068, 0.26, 8));

  const circleBackingGeo = trackGeo(new THREE.CylinderGeometry(0.43, 0.43, 0.032, 24));
  circleBackingGeo.rotateX(Math.PI / 2);
  const circleFaceGeo = trackGeo(new THREE.CircleGeometry(0.415, 24));

  const rectBackingGeo = trackGeo(new THREE.BoxGeometry(0.76, 0.9, 0.032));
  const rectFaceGeo = trackGeo(new THREE.PlaneGeometry(0.73, 0.87));

  const diamondBackingGeo = trackGeo(new THREE.BoxGeometry(0.58, 0.58, 0.03));
  diamondBackingGeo.rotateZ(Math.PI / 4);
  const diamondFaceGeo = trackGeo(new THREE.PlaneGeometry(0.84, 0.84));

  const spawnTrafficSign = (ts: TrafficSignSpawn) => {
    const sGrp = new THREE.Group();
    sGrp.position.set(ts.x, ts.y, ts.z);
    sGrp.rotation.y = ts.rotY;

    const base = new THREE.Mesh(signBaseGeo, concretePlinthMat);
    const pole = new THREE.Mesh(signPoleGeo, galvanizedSteelMat);
    pole.castShadow = true;
    const clamp = new THREE.Mesh(clampGeo, darkSteelMat);
    clamp.position.set(0, 2.38, 0.02);

    const faceMat = signFaceMatByKind.get(ts.kind)!;
    const isRect = ts.kind === 'khusus_busway';
    const isDiamond = ts.kind === 'peringatan_penyeberangan';

    const backing = new THREE.Mesh(
      isRect ? rectBackingGeo : isDiamond ? diamondBackingGeo : circleBackingGeo,
      aluminumBackMat
    );
    backing.position.set(0, 2.38, 0.058);
    backing.castShadow = true;

    const face = new THREE.Mesh(
      isRect ? rectFaceGeo : isDiamond ? diamondFaceGeo : circleFaceGeo,
      faceMat
    );
    face.position.set(0, 2.38, 0.078);

    sGrp.add(base, pole, clamp, backing, face);
    group.add(sGrp);
  };
  layout.trafficSigns.forEach(spawnTrafficSign);

  // 2. Build Papan Penunjuk Jalan Tol (Cantilever & Twin-Post Directional Boards)
  const tollFootingGeo = trackGeo(new THREE.BoxGeometry(0.65, 0.42, 0.65));
  tollFootingGeo.translate(0, 0.21, 0);
  const tollCantileverMastGeo = trackGeo(new THREE.CylinderGeometry(0.16, 0.21, 6.2, 10));
  tollCantileverMastGeo.translate(0, 3.1, 0);
  const tollBoomGeo = trackGeo(new THREE.BoxGeometry(4.4, 0.22, 0.22));
  const tollGussetGeo = trackGeo(new THREE.BoxGeometry(2.4, 0.14, 0.14));
  const tollTwinPostGeo = trackGeo(new THREE.CylinderGeometry(0.13, 0.16, 5.2, 10));
  tollTwinPostGeo.translate(0, 2.6, 0);
  const tollBoardFrameGeo = trackGeo(new THREE.BoxGeometry(4.3, 1.78, 0.14));
  const tollFaceGeo = trackGeo(new THREE.PlaneGeometry(4.16, 1.66));
  const hoodGeo = trackGeo(new THREE.BoxGeometry(0.45, 0.12, 0.34));
  const hoodBulbGeo = trackGeo(new THREE.PlaneGeometry(0.36, 0.18));
  hoodBulbGeo.rotateX(Math.PI / 2);

  const spawnTollSign = (ts: TollSignSpawn) => {
    const tGrp = new THREE.Group();
    tGrp.position.set(ts.x, ts.y, ts.z);
    tGrp.rotation.y = ts.rotY;

    const tex = trackTex(
      createTollSignTexture(
        ts.topText,
        ts.bottomText,
        ts.badgeText,
        ts.theme,
        maxAnisotropy
      )
    );
    const boardMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.18,
        roughness: 0.3,
        metalness: 0.14,
      })
    );
    litSignMats.push(boardMat);

    const addOverheadFloodlights = (cx: number, cy: number) => {
      for (const ox of [-1.2, 1.2]) {
        const arm = new THREE.Mesh(
          hoodGeo,
          darkSteelMat
        );
        arm.position.set(cx + ox, cy + 0.96, 0.24);
        const bulb = new THREE.Mesh(hoodBulbGeo, hoodLampMat);
        bulb.position.set(cx + ox, cy + 0.89, 0.28);
        tGrp.add(arm, bulb);
      }
    };

    if (ts.variant === 'cantilever') {
      // E-W signs have arm extending along -X so the cantilever overhangs the roadway
      const armDir = Math.abs(Math.sin(ts.rotY)) > 0.5 ? -1 : 1;

      const footing = new THREE.Mesh(tollFootingGeo, concretePlinthMat);
      const mast = new THREE.Mesh(tollCantileverMastGeo, galvanizedSteelMat);
      mast.castShadow = true;

      const boom = new THREE.Mesh(tollBoomGeo, galvanizedSteelMat);
      boom.position.set(armDir * 2.1, 5.55, 0);
      boom.castShadow = true;

      const gusset = new THREE.Mesh(tollGussetGeo, darkSteelMat);
      gusset.position.set(armDir * 1.05, 4.75, 0);
      gusset.rotation.z = armDir * 0.64;

      const frame = new THREE.Mesh(tollBoardFrameGeo, aluminumBackMat);
      frame.position.set(armDir * 2.65, 5.42, 0.1);
      frame.castShadow = true;

      const frontFace = new THREE.Mesh(tollFaceGeo, boardMat);
      frontFace.position.set(armDir * 2.65, 5.42, 0.18);

      const backFace = new THREE.Mesh(tollFaceGeo, boardMat);
      backFace.rotation.y = Math.PI;
      backFace.position.set(armDir * 2.65, 5.42, 0.02);

      tGrp.add(footing, mast, boom, gusset, frame, frontFace, backFace);
      addOverheadFloodlights(armDir * 2.65, 5.42);
    } else {
      for (const px of [-1.55, 1.55]) {
        const footing = new THREE.Mesh(tollFootingGeo, concretePlinthMat);
        footing.position.x = px;
        const post = new THREE.Mesh(tollTwinPostGeo, galvanizedSteelMat);
        post.position.x = px;
        post.castShadow = true;
        tGrp.add(footing, post);
      }

      const frame = new THREE.Mesh(tollBoardFrameGeo, aluminumBackMat);
      frame.position.set(0, 4.35, 0);
      frame.castShadow = true;

      const frontFace = new THREE.Mesh(tollFaceGeo, boardMat);
      frontFace.position.set(0, 4.35, 0.08);

      const backFace = new THREE.Mesh(tollFaceGeo, boardMat);
      backFace.rotation.y = Math.PI;
      backFace.position.set(0, 4.35, -0.08);

      tGrp.add(frame, frontFace, backFace);
      addOverheadFloodlights(0, 4.35);
    }

    group.add(tGrp);
  };
  layout.tollSigns.forEach(spawnTollSign);

  // 3. Build Halte TransJakarta Shelters (Multi-Part BRT Architecture + Illuminated Totem)
  const halteDeckGeo = trackGeo(new THREE.BoxGeometry(2.35, 0.24, 9.2));
  halteDeckGeo.translate(0, 0.12, 0);
  const tactileEdgeGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.255, 9.16));
  tactileEdgeGeo.translate(1.08, 0.1275, 0);
  const halteColGeo = trackGeo(new THREE.BoxGeometry(0.14, 3.05, 0.14));
  halteColGeo.translate(0, 1.72, 0);
  const halteRoofGeo = trackGeo(new THREE.BoxGeometry(2.75, 0.14, 9.6));
  const halteFasciaGeo = trackGeo(new THREE.BoxGeometry(2.8, 0.18, 9.64));
  const halteLedGeo = trackGeo(new THREE.BoxGeometry(2.84, 0.07, 9.68));
  const halteGlassGeo = trackGeo(new THREE.BoxGeometry(0.06, 2.25, 8.2));
  const mullionGeo = trackGeo(new THREE.BoxGeometry(0.09, 2.35, 0.09));
  const railBarGeo = trackGeo(new THREE.BoxGeometry(0.07, 0.07, 2.9));
  const railPostGeo = trackGeo(new THREE.CylinderGeometry(0.035, 0.035, 0.92, 8));
  const turnstileBodyGeo = trackGeo(new THREE.BoxGeometry(0.24, 0.92, 0.65));
  const turnstilePadGeo = trackGeo(new THREE.BoxGeometry(0.14, 0.06, 0.18));
  const benchSeatGeo = trackGeo(new THREE.BoxGeometry(0.46, 0.08, 2.6));
  const benchLegGeo = trackGeo(new THREE.BoxGeometry(0.38, 0.42, 0.08));
  const signBoxGeo = trackGeo(new THREE.BoxGeometry(0.18, 0.66, 5.4));
  const signFaceGeo = trackGeo(new THREE.PlaneGeometry(5.3, 0.6));
  const totemBodyGeo = trackGeo(new THREE.BoxGeometry(0.56, 3.55, 0.22));
  totemBodyGeo.translate(0, 1.775, 0);
  const totemFaceGeo = trackGeo(new THREE.PlaneGeometry(0.52, 2.85));

  const spawnHalte = (hs: TransJakartaHalteSpawn) => {
    const hGrp = new THREE.Group();
    hGrp.position.set(hs.x, hs.y, hs.z);
    hGrp.rotation.y = hs.rotY;

    const deck = new THREE.Mesh(halteDeckGeo, concretePlinthMat);
    deck.receiveShadow = true;
    const tactile = new THREE.Mesh(tactileEdgeGeo, yellowTactileMat);
    hGrp.add(deck, tactile);

    // 4 brushed steel columns
    for (const cx of [-0.98, 0.92]) {
      for (const cz of [-4.05, 4.05]) {
        const col = new THREE.Mesh(halteColGeo, darkSteelMat);
        col.position.set(cx, 0, cz);
        col.castShadow = true;
        hGrp.add(col);
      }
    }

    // Cantilevered roof canopy + TransJakarta blue fascia & LED rim
    const roof = new THREE.Mesh(halteRoofGeo, aluminumBackMat);
    roof.position.set(0.05, 3.3, 0);
    roof.castShadow = true;
    const fascia = new THREE.Mesh(halteFasciaGeo, halteRoofMat);
    fascia.position.set(0.05, 3.16, 0);
    const ledRim = new THREE.Mesh(halteLedGeo, halteLedMat);
    ledRim.position.set(0.05, 3.06, 0);
    hGrp.add(roof, fascia, ledRim);

    // Rear tempered glass windscreen + steel mullions
    const backGlass = new THREE.Mesh(halteGlassGeo, halteGlassMat);
    backGlass.position.set(-0.98, 1.48, 0);
    hGrp.add(backGlass);
    for (const mz of [-2.05, 0, 2.05]) {
      const mullion = new THREE.Mesh(mullionGeo, darkSteelMat);
      mullion.position.set(-0.98, 1.48, mz);
      hGrp.add(mullion);
    }

    // Front (+X) stainless tubular guardrails leaving central boarding doorway open
    for (const rz of [-2.85, 2.85]) {
      const topRail = new THREE.Mesh(railBarGeo, galvanizedSteelMat);
      topRail.position.set(1.02, 1.12, rz);
      const midRail = new THREE.Mesh(railBarGeo, galvanizedSteelMat);
      midRail.position.set(1.02, 0.72, rz);
      hGrp.add(topRail, midRail);

      for (const pz of [rz - 1.35, rz + 1.35]) {
        const post = new THREE.Mesh(railPostGeo, galvanizedSteelMat);
        post.position.set(1.02, 0.7, pz);
        hGrp.add(post);
      }
    }

    // e-Money Tap-In / Tap-Out turnstiles
    for (const tz of [-2.35, 2.35]) {
      const gate = new THREE.Mesh(turnstileBodyGeo, darkSteelMat);
      gate.position.set(0.42, 0.7, tz);
      const pad = new THREE.Mesh(turnstilePadGeo, nfcPadMat);
      pad.position.set(0.42, 1.18, tz + (tz < 0 ? 0.16 : -0.16));
      hGrp.add(gate, pad);
    }

    // Waiting bench
    const benchSeat = new THREE.Mesh(benchSeatGeo, galvanizedSteelMat);
    benchSeat.position.set(-0.56, 0.66, 0);
    hGrp.add(benchSeat);
    for (const lz of [-1.05, 0, 1.05]) {
      const leg = new THREE.Mesh(benchLegGeo, darkSteelMat);
      leg.position.set(-0.56, 0.45, lz);
      hGrp.add(leg);
    }

    // Illuminated Station Nameboard (both road-facing +X and pedestrian-facing -X)
    const boardTex = trackTex(
      createHalteBoardTexture(
        hs.stationName,
        hs.corridorCode,
        hs.routeSummary,
        maxAnisotropy
      )
    );
    const boardMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: boardTex,
        emissiveMap: boardTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.25,
        roughness: 0.26,
      })
    );
    litSignMats.push(boardMat);

    const signHousing = new THREE.Mesh(signBoxGeo, darkSteelMat);
    signHousing.position.set(0.86, 2.86, 0);
    const roadFace = new THREE.Mesh(signFaceGeo, boardMat);
    roadFace.rotation.y = Math.PI / 2;
    roadFace.position.set(0.96, 2.86, 0);
    const walkFace = new THREE.Mesh(signFaceGeo, boardMat);
    walkFace.rotation.y = -Math.PI / 2;
    walkFace.position.set(0.76, 2.86, 0);
    hGrp.add(signHousing, roadFace, walkFace);

    // Standing Illuminated TransJakarta Wayfinding Totem Pylon at entry
    const totemTex = trackTex(
      createHalteTotemTexture(hs.stationName, hs.corridorCode, maxAnisotropy)
    );
    const totemMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: totemTex,
        emissiveMap: totemTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.26,
        roughness: 0.24,
      })
    );
    litSignMats.push(totemMat);

    const totem = new THREE.Mesh(totemBodyGeo, darkSteelMat);
    totem.position.set(0.1, 0, -4.95);
    totem.castShadow = true;
    const totemFront = new THREE.Mesh(totemFaceGeo, totemMat);
    totemFront.position.set(0.1, 1.98, -4.83);
    const totemBack = new THREE.Mesh(totemFaceGeo, totemMat);
    totemBack.rotation.y = Math.PI;
    totemBack.position.set(0.1, 1.98, -5.07);
    hGrp.add(totem, totemFront, totemBack);

    group.add(hGrp);
  };
  layout.transJakartaHaltes.forEach(spawnHalte);

  const setWeatherTransition = (nightFactor: number, wetnessFactor: number) => {
    const n = Math.max(0, Math.min(1, nightFactor));
    const w = Math.max(0, Math.min(1, wetnessFactor));

    const reflIntensity = 0.06 + n * 0.18;
    const litIntensity = 0.08 + n * 0.28;

    for (const mat of reflectiveBoardMats) {
      mat.emissiveIntensity = reflIntensity;
    }
    for (const mat of litSignMats) {
      mat.emissiveIntensity = litIntensity;
    }

    halteLedMat.emissiveIntensity = 0.35 + n * 0.6;
    hoodLampMat.emissiveIntensity = 0.2 + n * 0.85;
    nfcPadMat.emissiveIntensity = 0.5 + n * 0.35;
    halteRoofMat.roughness = 0.36 - w * 0.18;
    concretePlinthMat.roughness = 0.88 - w * 0.54;
  };

  const setWeatherVisuals = (weather: WeatherMode) => {
    const nf = weather === 'malam' ? 1 : weather === 'siang' ? 0 : 0.65;
    setWeatherTransition(nf, weather === 'hujan' ? 1 : 0);
  };

  const dispose = () => {
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
  };

  return { group, setWeatherVisuals, setWeatherTransition, dispose };
}

interface VehicleEntity extends TrafficAISteppable {
  id: string;
  type: VehicleType;
  mesh: THREE.Group;
  y: number;
  isTraffic: boolean;
  routeId: TrafficRouteId;
}

interface EnemyEntity {
  id: string;
  policy: EnemyBehaviorPolicy;
  rig: ReturnType<typeof buildCharacterRig>;
  x: number;
  z: number;
  vx: number;
  vz: number;
  facing: number;
  hp: number;
  maxHp: number;
  state: 'alive' | 'ko';
  koTimer: number;
  hitFlashTimer: number;
  windupTimer: number;
  cooldownTimer: number;
  phaseTimer: number;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
}

export interface WorldControllerHandle {
  spawnVehicleNearPlayer: (type: VehicleType) => void;
  toggleEnterExitVehicle: () => void;
  startMissionObjective: (
    mission: StoryMission,
    choice: StoryChoiceOption
  ) => void;
  resetWorldForNewRun: () => void;
  teleportPlayerTo: (x: number, z: number) => void;
  restoreSavedPosition: (x: number, z: number) => void;
  triggerSatelliteSwitch: (
    targetId: ProtagonistId,
    targetX: number,
    targetZ: number
  ) => void;
  getPlayerPosition: () => { x: number; z: number };
}

interface JakartaWorldCanvasProps {
  gameState: GameState;
  playerState: PlayerProgressState;
  weatherMode: WeatherMode;
  activeMission: StoryMission | null;
  activeChoice: StoryChoiceOption | null;
  tpsAiming: boolean;
  wheelSlowMo: boolean;
  customsShowcaseOpen: boolean;
  radarCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  controllerRef: React.MutableRefObject<WorldControllerHandle | null>;
  onUpdateHud: (payload: {
    district: DistrictZone;
    drivingVehicle: VehicleType | null;
    vehicleSpeedKmh: number;
    aircraftAltitude: number;
    nearbyVehicle: VehicleType | null;
    nearbyMission: StoryMission | null;
    nearbyInterior: EnterableInteriorSpec | null;
    objectiveProgress: number;
    skySwitchPhase: {
      active: boolean;
      targetId: ProtagonistId;
      stage: 1 | 2 | 3;
    } | null;
  }) => void;
  onPlayerDamage: (dmg: number) => void;
  onEnemyDefeated: (rewardRp: number, scoreDelta: number) => void;
  onConsumeAmmo: () => boolean;
  onOpenMissionDialog: (mission: StoryMission) => void;
  onCompleteActiveObjective: () => void;
  onToggleTpsAim: () => void;
  onEnterOrExitInterior: (target?: EnterableInteriorSpec | null) => void;
  onWantedEvadeUpdate: (isEvading: boolean, dt: number) => void;
}

export const JakartaWorldCanvas: React.FC<JakartaWorldCanvasProps> = ({
  gameState,
  playerState,
  weatherMode,
  activeMission,
  activeChoice,
  tpsAiming,
  wheelSlowMo,
  customsShowcaseOpen,
  radarCanvasRef,
  controllerRef,
  onUpdateHud,
  onPlayerDamage,
  onEnemyDefeated,
  onConsumeAmmo,
  onOpenMissionDialog,
  onCompleteActiveObjective,
  onToggleTpsAim,
  onEnterOrExitInterior,
  onWantedEvadeUpdate,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest React props/callbacks in refs so the WebGL loop never tears down
  const propsRef = useRef({
    gameState,
    playerState,
    weatherMode,
    activeMission,
    activeChoice,
    tpsAiming,
    wheelSlowMo,
    customsShowcaseOpen,
    onUpdateHud,
    onPlayerDamage,
    onEnemyDefeated,
    onConsumeAmmo,
    onOpenMissionDialog,
    onCompleteActiveObjective,
    onToggleTpsAim,
    onEnterOrExitInterior,
    onWantedEvadeUpdate,
  });

  useEffect(() => {
    propsRef.current = {
      gameState,
      playerState,
      weatherMode,
      activeMission,
      activeChoice,
      tpsAiming,
      wheelSlowMo,
      customsShowcaseOpen,
      onUpdateHud,
      onPlayerDamage,
      onEnemyDefeated,
      onConsumeAmmo,
      onOpenMissionDialog,
      onCompleteActiveObjective,
      onToggleTpsAim,
      onEnterOrExitInterior,
      onWantedEvadeUpdate,
    };
  }, [
    gameState,
    playerState,
    weatherMode,
    activeMission,
    activeChoice,
    tpsAiming,
    wheelSlowMo,
    customsShowcaseOpen,
    onUpdateHud,
    onPlayerDamage,
    onEnemyDefeated,
    onConsumeAmmo,
    onOpenMissionDialog,
    onCompleteActiveObjective,
    onToggleTpsAim,
    onEnterOrExitInterior,
    onWantedEvadeUpdate,
  ]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.96;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2)
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    renderer.domElement.setAttribute('data-testid', 'jakarta-webgl-canvas');
    container.appendChild(renderer.domElement);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

    // 2. Scene, Horizon Fog & Studio Environment Reflection
    const scene = new THREE.Scene();
    const horizonHex = 0x1e2638;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.0028);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(
      new RoomEnvironment(),
      0.04
    ).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      60,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.2,
      360
    );

    // 2b. Atmospheric Procedural Sky Dome Shader (Synced to Horizon Fog + Sun Glow)
    const skyDomeGeo = new THREE.SphereGeometry(250, 28, 20);
    const skyUniforms = {
      uTopColor: { value: new THREE.Color(0x0c1428) },
      uHorizonColor: { value: new THREE.Color(0xd97706) },
      uBottomColor: { value: new THREE.Color(0x0f172a) },
      uSunDir: { value: new THREE.Vector3(0.55, 0.34, 0.76).normalize() },
      uSunColor: { value: new THREE.Color(0xffd28a) },
      uSunGlowStrength: { value: 0.45 },
    };
    const skyDomeMat = new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uBottomColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunGlowStrength;
        varying vec3 vLocalPos;
        void main() {
          vec3 dir = normalize(vLocalPos);
          float h = dir.y;
          vec3 col = mix(uBottomColor, uHorizonColor, smoothstep(-0.14, 0.03, h));
          col = mix(col, uTopColor, smoothstep(0.0, 0.38, h));
          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sunAmt, 18.0) * (0.35 * uSunGlowStrength);
          col += uSunColor * smoothstep(0.997, 0.9995, sunAmt) * (0.9 * uSunGlowStrength);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    const skyDomeMesh = new THREE.Mesh(skyDomeGeo, skyDomeMat);
    skyDomeMesh.frustumCulled = false;
    scene.add(skyDomeMesh);

    // 3. Studio Warm/Cool Lighting Rig + Texel-Snapped Player-Following Sun Shadows
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.56);
    hemiLight.position.set(0, 60, 0);
    scene.add(hemiLight);

    const sunOffset = new THREE.Vector3(46, 68, 38);
    const sunLight = new THREE.DirectionalLight(0xffedd5, 1.15);
    sunLight.position.copy(sunOffset);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.width = isSoftwareGl ? 512 : 2048;
    sunLight.shadow.mapSize.height = isSoftwareGl ? 512 : 2048;
    const d = 46;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.camera.near = 6;
    sunLight.shadow.camera.far = 165;
    sunLight.shadow.bias = -0.0004;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    rimLight.position.set(-40, 30, -50);
    scene.add(rimLight);

    const vehicleHeadlight = new THREE.SpotLight(
      0xfef3c7,
      0,
      44,
      Math.PI / 4.2,
      0.58,
      1.35
    );
    vehicleHeadlight.castShadow = false;
    scene.add(vehicleHeadlight);
    scene.add(vehicleHeadlight.target);

    const sirenLight = new THREE.PointLight(0xef4444, 0, 24, 1.7);
    scene.add(sirenLight);

    const monasPlazaLight = new THREE.PointLight(0xfbbf24, 1.1, 36, 1.6);
    monasPlazaLight.position.set(0, 5.2, 12);
    scene.add(monasPlazaLight);

    const sudirmanPlazaLight = new THREE.PointLight(0x38bdf8, 0.95, 38, 1.6);
    sudirmanPlazaLight.position.set(0, 5.5, -36);
    scene.add(sudirmanPlazaLight);

    // 4. Extended Outdoor Terrain & Road Network
    const groundGeo = new THREE.PlaneGeometry(320, 320);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f1a14,
      roughness: 0.94,
      metalness: 0.04,
      envMapIntensity: 0.2,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Monas Central Park Plaza
    const plazaGeo = new THREE.CircleGeometry(18.5, 32);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x263142,
      roughness: 0.82,
      envMapIntensity: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.position.y = 0.065;
    plazaMesh.receiveShadow = true;
    scene.add(plazaMesh);

    // Asphalt Boulevards
    const roadTex = createAsphaltRoadTexture(maxAnisotropy);
    roadTex.repeat.set(1, 18);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      roughness: 0.86,
      metalness: 0.06,
      envMapIntensity: 0.22,
    });

    const nsRoadGeo = new THREE.PlaneGeometry(14, 190);
    nsRoadGeo.rotateX(-Math.PI / 2);
    const nsRoad = new THREE.Mesh(nsRoadGeo, roadMat);
    nsRoad.position.set(0, 0.03, 0);
    nsRoad.receiveShadow = true;
    scene.add(nsRoad);

    const ewRoadGeo = new THREE.PlaneGeometry(14, 190);
    ewRoadGeo.rotateX(-Math.PI / 2);
    ewRoadGeo.rotateY(Math.PI / 2);
    const ewRoad = new THREE.Mesh(ewRoadGeo, roadMat);
    ewRoad.position.set(0, 0.04, 0);
    ewRoad.receiveShadow = true;
    scene.add(ewRoad);

    for (const offset of [-32, 32]) {
      const hRoadGeo = new THREE.PlaneGeometry(10, 160);
      hRoadGeo.rotateX(-Math.PI / 2);
      hRoadGeo.rotateY(Math.PI / 2);
      const hRoad = new THREE.Mesh(hRoadGeo, roadMat);
      hRoad.position.set(0, 0.022, offset);
      scene.add(hRoad);

      const vRoadGeo = new THREE.PlaneGeometry(10, 160);
      vRoadGeo.rotateX(-Math.PI / 2);
      const vRoad = new THREE.Mesh(vRoadGeo, roadMat);
      vRoad.position.set(offset, 0.026, 0);
      scene.add(vRoad);
    }

    // 4b. GTA V Expansion: Inner-City Elevated Toll Highway (Tol Layang Semanggi - Kemayoran)
    const elevatedHighwayGroup = buildElevatedHighwayMesh(roadMat);
    scene.add(elevatedHighwayGroup);

    // 4c. GTA V Expansion: Enterable Building Portals & Elevated 3D Interior Stage
    const { portalsGroup, interiorStageGroup } = buildInteriorPortalsAndStage();
    scene.add(portalsGroup);
    scene.add(interiorStageGroup);

    // Add Jakarta Warung Pecel Lele Stalls
    scene.add(buildWarungStall(-11, 22, Math.PI / 4));
    scene.add(buildWarungStall(11, 20, -Math.PI / 4));
    scene.add(buildWarungStall(-14, -22, 0));
    scene.add(buildWarungStall(14, -22, 0));

    // 5. Jakarta Buildings & Monas Landmark
    for (const b of CITY_BUILDINGS) {
      const bGroup = buildJakartaBuilding(b, maxAnisotropy);
      scene.add(bGroup);
    }

    // 6. Urban Jakarta Streetscape (Trotoar, PJU, Traffic Signals, Gantry, Halte, Trees)
    const streetscape = buildJakartaStreetscape(maxAnisotropy);
    scene.add(streetscape.group);

    // 6b. Procedural Road Markings, Zebra Crosswalks & Sidewalk Cracks System
    const roadDetailSystem = buildProceduralRoadDetailSystem(
      streetscape.sidewalkRects,
      maxAnisotropy
    );
    scene.add(roadDetailSystem.group);

    // 6c. Authentic Indonesian Traffic Signs, Toll Directional Boards & Halte TransJakarta Shelters
    const roadsideSystem = buildAuthenticRoadsideSystem(
      streetscape.sidewalkRects,
      maxAnisotropy
    );
    scene.add(roadsideSystem.group);

    // 7. Mission Beacon Pillar + Ring in 3D World
    const beaconGroup = new THREE.Group();
    const beaconCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beaconCyl.position.y = 7;
    beaconGroup.add(beaconCyl);

    const beaconRing = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.2, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xfef08a,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    beaconRing.position.y = 0.06;
    beaconGroup.add(beaconRing);
    scene.add(beaconGroup);

    // 8. Zero-GC Pooled Particle Ring Buffer (InstancedMesh)
    const PARTICLE_CAP = 96;
    const particleGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particleInst = new THREE.InstancedMesh(
      particleGeo,
      particleMat,
      PARTICLE_CAP
    );
    particleInst.frustumCulled = false;
    scene.add(particleInst);

    const particles: ParticleSlot[] = Array.from(
      { length: PARTICLE_CAP },
      () => ({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.4,
        size: 1,
        colorHex: 0xfef08a,
      })
    );
    let particleCursor = 0;

    function spawnParticles(
      x: number,
      y: number,
      z: number,
      count: number,
      colorHex: number,
      speed: number = 6
    ) {
      for (let i = 0; i < count; i++) {
        const slot = particles[particleCursor];
        particleCursor = (particleCursor + 1) % PARTICLE_CAP;
        slot.active = true;
        slot.x = x;
        slot.y = y;
        slot.z = z;
        const ang = Math.random() * Math.PI * 2;
        const spd = (0.35 + Math.random() * 0.65) * speed;
        slot.vx = Math.cos(ang) * spd;
        slot.vy = 2.0 + Math.random() * (speed * 0.65);
        slot.vz = Math.sin(ang) * spd;
        slot.life = 0;
        slot.maxLife = 0.22 + Math.random() * 0.28;
        slot.size = 0.7 + Math.random() * 0.9;
        slot.colorHex = colorHex;
      }
    }

    // 9. Active Protagonist Rig + 2 Non-Active Autonomous Protagonist Rigs in the World!
    const playerRig = buildCharacterRig('player');
    scene.add(playerRig.group);

    const idleProtagonistRigs: Record<
      ProtagonistId,
      ReturnType<typeof buildCharacterRig>
    > = {
      nabilo: buildCharacterRig('player'),
      raka: buildCharacterRig('player'),
      kirana: buildCharacterRig('player'),
    };
    (['nabilo', 'raka', 'kirana'] as ProtagonistId[]).forEach((pId) => {
      const rig = idleProtagonistRigs[pId];
      const prof = PROTAGONIST_PROFILES[pId];
      const outfit =
        NABILO_OUTFITS.find((o) => o.id === prof.defaultOutfitId) ||
        NABILO_OUTFITS[0];
      if (rig.group.userData.jacketMat) {
        (
          rig.group.userData.jacketMat as THREE.MeshStandardMaterial
        ).color.setHex(outfit.jacketHex);
        (
          rig.group.userData.pantsMat as THREE.MeshStandardMaterial
        ).color.setHex(outfit.pantsHex);
        (rig.group.userData.capMat as THREE.MeshStandardMaterial).color.setHex(
          outfit.capHex
        );
      }
      rig.group.position.set(
        prof.spawnX,
        getGroundElevationAt(prof.spawnX, prof.spawnZ),
        prof.spawnZ
      );
      scene.add(rig.group);
    });

    const playerPhys = {
      x: 0,
      y: 0,
      z: 26,
      vx: 0,
      vy: 0,
      vz: 0,
      facing: Math.PI,
      attackCooldown: 0,
      combatRollTimer: 0,
      walkDist: 0,
      drivingVehicleId: null as string | null,
    };

    // GTA V 3-Stage Satellite Camera Switch State
    const skySwitch = {
      active: false,
      targetId: 'nabilo' as ProtagonistId,
      fromX: 0,
      fromZ: 26,
      toX: 0,
      toZ: 26,
      elapsed: 0,
      duration: 1.35,
      lastStageSound: 0,
    };

    // 10. Active Vehicles in Jakarta (Parked Protagonist Fleet + Dynamic NPC Traffic)
    const vehicles: VehicleEntity[] = [];
    const parkedVehicles: {
      type: VehicleType;
      x: number;
      z: number;
      heading: number;
    }[] = [
      { type: 'vtol_jet', x: -4.2, z: 24.5, heading: Math.PI },
      { type: 'bajaj', x: -8.5, z: 22, heading: Math.PI },
      { type: 'ojek', x: 5.5, z: 23, heading: Math.PI },
      { type: 'heli', x: 9.5, z: 19.5, heading: Math.PI },
      { type: 'barracuda', x: -10.5, z: 19.5, heading: Math.PI },
      { type: 'supercar', x: 9.5, z: 26.5, heading: Math.PI },
      // Raka's signature Garuda GT-X parked on the Elevated Toll Highway
      { type: 'supercar', x: 28, z: -26, heading: -Math.PI / 2 },
      { type: 'angkot', x: -9.5, z: 27.5, heading: Math.PI },
      { type: 'sedan', x: 8.5, z: -16, heading: 0 },
    ];

    parkedVehicles.forEach((vCfg, idx) => {
      const vMesh = buildIndonesianVehicleMesh(vCfg.type);
      const groundY = getGroundElevationAt(vCfg.x, vCfg.z);
      vMesh.position.set(vCfg.x, groundY, vCfg.z);
      vMesh.rotation.y = vCfg.heading;
      scene.add(vMesh);
      vehicles.push({
        id: `veh_${idx}`,
        type: vCfg.type,
        mesh: vMesh,
        x: vCfg.x,
        y: groundY,
        z: vCfg.z,
        heading: vCfg.heading,
        speed: 0,
        isTraffic: false,
        routeId: 'ring_clockwise',
        waypointIndex: 0,
        stopTimer: 0,
        preferredSpeed: 10,
        layer: groundY > 1 ? 'elevated' : 'ground',
      });
    });

    const trafficSpawns = generateInitialTrafficSpawns();
    trafficSpawns.forEach((ts) => {
      const vMesh = buildIndonesianVehicleMesh(ts.type);
      const spawnY = ts.layer === 'elevated' ? getGroundElevationAt(ts.x, ts.z) : 0;
      vMesh.position.set(ts.x, spawnY, ts.z);
      vMesh.rotation.y = ts.heading;
      scene.add(vMesh);
      vehicles.push({
        id: ts.id,
        type: ts.type,
        mesh: vMesh,
        x: ts.x,
        y: spawnY,
        z: ts.z,
        heading: ts.heading,
        speed: ts.preferredSpeed * 0.75,
        isTraffic: true,
        routeId: ts.routeId,
        waypointIndex: ts.waypointIndex,
        stopTimer: 0,
        preferredSpeed: ts.preferredSpeed,
        layer: ts.layer,
      });
    });

    // 10b. Police Tactical Pursuit Helicopter (Active at Wanted Level >= 3)
    const policeHeliMesh = buildPolicePursuitHeliWithSpotlight();
    policeHeliMesh.position.set(0, 24, -30);
    policeHeliMesh.visible = false;
    scene.add(policeHeliMesh);

    // 10c. Loyal AI Crew Bodyguards
    const crewCompanions = [0, 1, 2].map((idx) => {
      const rig = buildCharacterRig('crew');
      rig.group.visible = false;
      rig.group.position.set(playerPhys.x - 2 + idx * 2, 0, playerPhys.z + 2);
      scene.add(rig.group);
      return {
        rig,
        x: playerPhys.x - 2 + idx * 2,
        z: playerPhys.z + 2,
        facing: Math.PI,
        walkDist: 0,
        fireCooldown: 0.4 + idx * 0.3,
      };
    });

    // 10d. Autonomous Tactical Drone "Rajawali-X"
    const droneMesh = buildCombatDroneMesh();
    droneMesh.position.set(playerPhys.x + 1.6, 3.2, playerPhys.z - 1.2);
    scene.add(droneMesh);
    let droneFireCooldown = 0.5;

    // 11. Enemy Pool
    const enemies: EnemyEntity[] = [];

    function spawnEnemyGroup(
      centerX: number,
      centerZ: number,
      count: number
    ) {
      const policies: EnemyBehaviorPolicy[] = [
        'rusher',
        'ranged_kiter',
        'charger_enforcer',
      ];
      for (let i = 0; i < count; i++) {
        const policy = policies[i % policies.length];
        const spec = ENEMY_ARCHETYPES[policy];
        const rig = buildCharacterRig(policy);
        const ang = (i / count) * Math.PI * 2;
        const ex = centerX + Math.cos(ang) * 6.5;
        const ez = centerZ + Math.sin(ang) * 6.5;
        rig.group.position.set(ex, getGroundElevationAt(ex, ez), ez);
        scene.add(rig.group);
        enemies.push({
          id: `enemy_${Date.now()}_${i}`,
          policy,
          rig,
          x: ex,
          z: ez,
          vx: 0,
          vz: 0,
          facing: 0,
          hp: spec.maxHp,
          maxHp: spec.maxHp,
          state: 'alive',
          koTimer: 0,
          hitFlashTimer: 0,
          windupTimer: 0,
          cooldownTimer: 0.4 + i * 0.25,
          phaseTimer: i * 1.1,
        });
      }
    }

    spawnEnemyGroup(-36, 12, 3);

    // 12. Objective & Camera State
    let hitstopTimer = 0;
    let cameraTrauma = 0;
    let tourElapsed = 0;
    let customsOrbitAngle = 0;
    let hudSyncAccumulator = 0;
    let objectiveProgress = 0;
    let checkpointStage = 0;
    let sirenSoundCooldown = 0;
    let camYaw = Math.PI;
    let camPitch = 0.28;
    let userOrbitTimer = 0;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 13. Unified Input Hub (Keyboard + Mouse Orbit & TPS Aim)
    const keysHeld = new Set<string>();
    const keysJustPressed = new Set<string>();
    let mouseJustClicked = false;
    let rightMouseHeld = false;
    let isOrbitDragging = false;
    let lastPointerX = 0;
    let lastPointerY = 0;
    let dragDistance = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!keysHeld.has(e.code)) {
        keysJustPressed.add(e.code);
      }
      keysHeld.add(e.code);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
    };
    const onWindowBlur = () => {
      keysHeld.clear();
      keysJustPressed.clear();
      mouseJustClicked = false;
      rightMouseHeld = false;
      isOrbitDragging = false;
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.target !== renderer.domElement) return;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;
      if (e.button === 0) {
        isOrbitDragging = true;
        dragDistance = 0;
        if (propsRef.current.tpsAiming || rightMouseHeld) {
          mouseJustClicked = true;
        }
      } else if (e.button === 2) {
        rightMouseHeld = true;
      }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (propsRef.current.gameState !== 'playing') return;
      if (
        propsRef.current.customsShowcaseOpen ||
        propsRef.current.wheelSlowMo
      ) {
        return;
      }
      if (!isOrbitDragging && !rightMouseHeld) return;

      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY;
      lastPointerX = e.clientX;
      lastPointerY = e.clientY;

      if (isOrbitDragging) {
        dragDistance += Math.abs(dx) + Math.abs(dy);
      }

      camYaw -= dx * 0.0055;
      camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.004, 0.1, 0.88);
      userOrbitTimer = 2.0;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 0) {
        if (
          isOrbitDragging &&
          dragDistance < 8 &&
          !(propsRef.current.tpsAiming || rightMouseHeld)
        ) {
          mouseJustClicked = true;
        }
        isOrbitDragging = false;
      } else if (e.button === 2) {
        rightMouseHeld = false;
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      if (e.target === renderer.domElement) {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('contextmenu', onContextMenu);

    // Controller methods exposed to React HUD / NabiloPhone
    function toggleEnterExitVehicle() {
      if (playerPhys.drivingVehicleId) {
        const v = vehicles.find(
          (item) => item.id === playerPhys.drivingVehicleId
        );
        playerPhys.drivingVehicleId = null;
        if (v) {
          const gY = getGroundElevationAt(v.x, v.z);
          v.y = gY;
          v.mesh.position.y = gY;
          v.mesh.rotation.z = 0;
          playerPhys.x = v.x + Math.cos(v.heading) * 2.4;
          playerPhys.z = v.z - Math.sin(v.heading) * 2.4;
          playerPhys.y = getGroundElevationAt(playerPhys.x, playerPhys.z);
        }
        playerRig.group.visible = true;
        soundEngine.stopEngineAudio(false);
        soundEngine.playVehicleDoor();
        return;
      }

      let nearest: VehicleEntity | null = null;
      let bestDist = 6.5;
      for (const v of vehicles) {
        const d = Math.hypot(v.x - playerPhys.x, v.z - playerPhys.z);
        if (d < bestDist) {
          bestDist = d;
          nearest = v;
        }
      }
      if (nearest) {
        nearest.isTraffic = false;
        playerPhys.drivingVehicleId = nearest.id;
        playerRig.group.visible = false;
        soundEngine.playVehicleDoor();
      }
    }

    function spawnVehicleNearPlayer(type: VehicleType) {
      const spawnX = playerPhys.x + Math.sin(playerPhys.facing) * 4.5;
      const spawnZ = playerPhys.z + Math.cos(playerPhys.facing) * 4.5;
      const safe = resolveCircleAABBCollision(spawnX, spawnZ, 2.5);
      const gY = getGroundElevationAt(safe.x, safe.z);
      const vMesh = buildIndonesianVehicleMesh(type);
      applyVehicleCustomizationToMesh(
        vMesh,
        propsRef.current.playerState.vehicleCustoms
      );
      vMesh.position.set(safe.x, gY, safe.z);
      vMesh.rotation.y = playerPhys.facing;
      scene.add(vMesh);
      const newId = `veh_custom_${Date.now()}`;
      vehicles.push({
        id: newId,
        type,
        mesh: vMesh,
        x: safe.x,
        y: gY,
        z: safe.z,
        heading: playerPhys.facing,
        speed: 0,
        isTraffic: false,
        routeId: 'ring_clockwise',
        waypointIndex: 0,
        stopTimer: 0,
        preferredSpeed: 10,
        layer: gY > 1 ? 'elevated' : 'ground',
      });
      spawnParticles(safe.x, gY + 1.0, safe.z, 14, 0xf59e0b, 7);
      soundEngine.playPickup();
    }

    function startMissionObjective(
      _mission: StoryMission,
      choice: StoryChoiceOption
    ) {
      objectiveProgress = 0;
      checkpointStage = 0;
      while (enemies.length > 0) {
        const old = enemies.pop()!;
        scene.remove(old.rig.group);
      }

      if (choice.objectiveType === 'combat_wave') {
        spawnEnemyGroup(
          choice.targetX,
          choice.targetZ,
          choice.objectiveTargetCount
        );
      } else if (choice.objectiveType === 'heist_escape') {
        spawnEnemyGroup(choice.targetX, choice.targetZ, 3);
      }
      soundEngine.playPickup();
    }

    function resetWorldForNewRun() {
      playerPhys.drivingVehicleId = null;
      playerPhys.x = 0;
      playerPhys.y = 0;
      playerPhys.z = 26;
      playerPhys.vx = 0;
      playerPhys.vy = 0;
      playerPhys.vz = 0;
      playerPhys.facing = Math.PI;
      camYaw = Math.PI;
      camPitch = 0.28;
      userOrbitTimer = 0;
      playerRig.group.visible = true;
      objectiveProgress = 0;
      checkpointStage = 0;
      skySwitch.active = false;

      while (enemies.length > 0) {
        const old = enemies.pop()!;
        scene.remove(old.rig.group);
      }
      spawnEnemyGroup(-36, 12, 3);
    }

    function restoreSavedPosition(targetX: number, targetZ: number) {
      if (playerPhys.drivingVehicleId) {
        playerPhys.drivingVehicleId = null;
        playerRig.group.visible = true;
      }
      const safe = resolveCircleAABBCollision(targetX, targetZ, 2.2);
      const gY = getGroundElevationAt(safe.x, safe.z);
      playerPhys.x = safe.x;
      playerPhys.y = gY;
      playerPhys.z = safe.z;
      playerPhys.vx = 0;
      playerPhys.vz = 0;
      camYaw = playerPhys.facing;
      camPitch = 0.28;
      userOrbitTimer = 0;
      playerRig.group.position.set(playerPhys.x, playerPhys.y, playerPhys.z);
      skySwitch.active = false;
    }

    function teleportPlayerTo(targetX: number, targetZ: number) {
      const safe = resolveCircleAABBCollision(targetX, targetZ, 2.8);
      const gY = getGroundElevationAt(safe.x, safe.z);
      if (playerPhys.drivingVehicleId) {
        const v = vehicles.find(
          (item) => item.id === playerPhys.drivingVehicleId
        );
        if (v) {
          v.x = safe.x;
          v.y = gY;
          v.z = safe.z;
          v.speed = 0;
          v.mesh.position.set(v.x, v.y, v.z);
        }
      }
      playerPhys.x = safe.x;
      playerPhys.y = gY;
      playerPhys.z = safe.z;
      playerPhys.vx = 0;
      playerPhys.vz = 0;
      playerRig.group.position.set(playerPhys.x, playerPhys.y, playerPhys.z);
      spawnParticles(safe.x, gY + 1.4, safe.z, 22, 0x38bdf8, 9);
      soundEngine.playPickup();
    }

    function triggerSatelliteSwitch(
      targetId: ProtagonistId,
      targetX: number,
      targetZ: number
    ) {
      if (playerPhys.drivingVehicleId) {
        playerPhys.drivingVehicleId = null;
        playerRig.group.visible = true;
      }
      const safe = resolveCircleAABBCollision(targetX, targetZ, 2.2);
      skySwitch.active = true;
      skySwitch.targetId = targetId;
      skySwitch.fromX = playerPhys.x;
      skySwitch.fromZ = playerPhys.z;
      skySwitch.toX = safe.x;
      skySwitch.toZ = safe.z;
      skySwitch.elapsed = 0;
      skySwitch.lastStageSound = 1;
      soundEngine.playCharacterSwitchBoom(1);

      playerPhys.x = safe.x;
      playerPhys.z = safe.z;
      playerPhys.y = getGroundElevationAt(safe.x, safe.z);
      playerPhys.vx = 0;
      playerPhys.vz = 0;
      camYaw = playerPhys.facing;
      camPitch = 0.28;
      userOrbitTimer = 0;
      playerRig.group.position.set(playerPhys.x, playerPhys.y, playerPhys.z);
    }

    controllerRef.current = {
      spawnVehicleNearPlayer,
      toggleEnterExitVehicle,
      startMissionObjective,
      resetWorldForNewRun,
      teleportPlayerTo,
      restoreSavedPosition,
      triggerSatelliteSwitch,
      getPlayerPosition: () => ({ x: playerPhys.x, z: playerPhys.z }),
    };

    // Perform player attack
    function triggerPlayerAttack() {
      const pState = propsRef.current.playerState;
      const wSpec = WEAPONS[pState.activeWeapon];
      if (playerPhys.attackCooldown > 0) return;

      if (!wSpec.isMelee) {
        const hasAmmo = propsRef.current.onConsumeAmmo();
        if (!hasAmmo) {
          soundEngine.playTone(150, 0.06, 'sine', 0.1);
          playerPhys.attackCooldown = 0.25;
          return;
        }
      }

      playerPhys.attackCooldown = wSpec.cooldown;
      soundEngine.playShoot(wSpec.id);
      playerRig.rightArm.rotation.x = -Math.PI * 0.75;

      const fwdX = Math.sin(playerPhys.facing);
      const fwdZ = Math.cos(playerPhys.facing);
      const muzzleX = playerPhys.x + fwdX * 1.1;
      const muzzleZ = playerPhys.z + fwdZ * 1.1;

      spawnParticles(
        muzzleX,
        playerPhys.y + 1.25,
        muzzleZ,
        wSpec.isMelee ? 5 : 8,
        wSpec.isMelee ? 0xfef08a : 0xf97316,
        wSpec.isMelee ? 5 : 9
      );

      let hitAny = false;

      if (wSpec.splashRadius > 0) {
        let blastX = playerPhys.x + fwdX * 14;
        let blastZ = playerPhys.z + fwdZ * 14;
        for (const en of enemies) {
          if (en.state !== 'alive') continue;
          const dx = en.x - playerPhys.x;
          const dz = en.z - playerPhys.z;
          const dist = Math.hypot(dx, dz);
          if (dist <= wSpec.range) {
            const dot =
              (dx / (dist || 1)) * fwdX + (dz / (dist || 1)) * fwdZ;
            if (dot >= 0.6) {
              blastX = en.x;
              blastZ = en.z;
              break;
            }
          }
        }

        spawnParticles(
          blastX,
          playerPhys.y + 1.5,
          blastZ,
          28,
          wSpec.id === 'pasopati' ? 0x38bdf8 : 0xf97316,
          13
        );
        cameraTrauma = Math.min(1, cameraTrauma + 0.65);

        for (const en of enemies) {
          if (en.state !== 'alive') continue;
          const d = Math.hypot(en.x - blastX, en.z - blastZ);
          if (d <= wSpec.splashRadius) {
            const dmgMult = pState.fokusActive ? 1.75 : 1.0;
            en.hp -= Math.round(wSpec.damage * dmgMult);
            en.hitFlashTimer = 0.08;
            const pushAng = Math.atan2(en.x - blastX, en.z - blastZ);
            en.vx += Math.sin(pushAng) * 12;
            en.vz += Math.cos(pushAng) * 12;
            hitAny = true;

            if (en.hp <= 0) {
              en.state = 'ko';
              en.koTimer = 0.45;
              hitstopTimer = 0.06;
              soundEngine.playHit(true);
              const arch = ENEMY_ARCHETYPES[en.policy];
              propsRef.current.onEnemyDefeated(
                arch.rewardRp,
                arch.scoreValue
              );
              const choice = propsRef.current.activeChoice;
              if (choice && choice.objectiveType === 'combat_wave') {
                objectiveProgress += 1;
                if (objectiveProgress >= choice.objectiveTargetCount) {
                  soundEngine.playMissionFanfare();
                  propsRef.current.onCompleteActiveObjective();
                }
              }
            }
          }
        }
        return;
      }

      for (const en of enemies) {
        if (en.state !== 'alive') continue;
        const dx = en.x - playerPhys.x;
        const dz = en.z - playerPhys.z;
        const dist = Math.hypot(dx, dz);
        if (dist > wSpec.range) continue;

        const dirX = dx / (dist || 1);
        const dirZ = dz / (dist || 1);
        const dot = dirX * fwdX + dirZ * fwdZ;
        const minDot = wSpec.isMelee ? 0.25 : 0.72;

        if (dot >= minDot || dist < 2.2) {
          const dmgMult = pState.fokusActive ? 1.75 : 1.0;
          en.hp -= Math.round(wSpec.damage * dmgMult);
          en.hitFlashTimer = 0.06;
          en.vx += dirX * (wSpec.isMelee ? 9 : 5);
          en.vz += dirZ * (wSpec.isMelee ? 9 : 5);
          hitAny = true;

          spawnParticles(en.x, 1.2, en.z, 14, 0xef4444, 8);

          if (en.hp <= 0) {
            en.state = 'ko';
            en.koTimer = 0.42;
            hitstopTimer = 0.055;
            cameraTrauma = Math.min(1, cameraTrauma + 0.45);
            soundEngine.playHit(true);

            const arch = ENEMY_ARCHETYPES[en.policy];
            propsRef.current.onEnemyDefeated(arch.rewardRp, arch.scoreValue);

            const choice = propsRef.current.activeChoice;
            if (choice && choice.objectiveType === 'combat_wave') {
              objectiveProgress += 1;
              if (objectiveProgress >= choice.objectiveTargetCount) {
                soundEngine.playMissionFanfare();
                propsRef.current.onCompleteActiveObjective();
              }
            }
          } else {
            hitstopTimer = 0.03;
            cameraTrauma = Math.min(1, cameraTrauma + 0.2);
            soundEngine.playHit(false);
          }

          if (!wSpec.isMelee) break;
        }
      }

      if (!hitAny && !wSpec.isMelee) {
        cameraTrauma = Math.min(1, cameraTrauma + 0.08);
      }
    }

    // Draw 2D Radar Minimap onto HUD Canvas (with Police Vision Cones & 3 Protagonist Blips)
    function renderRadarMinimap(
      nearbyMission: StoryMission | null,
      activeChoice: StoryChoiceOption | null
    ) {
      const radarCanvas = radarCanvasRef.current;
      if (!radarCanvas) return;
      const ctx = radarCanvas.getContext('2d');
      if (!ctx) return;

      const pState = propsRef.current.playerState;
      const w = radarCanvas.width;
      const h = radarCanvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const scale = 0.82;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(cx, cy);

      const px = playerPhys.x;
      const pz = playerPhys.z;

      // Roads: Main Boulevards + Secondary Ring Grid + Elevated Toll Highway
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (const offset of [-32, 32]) {
        ctx.moveTo((offset - px) * scale, (-80 - pz) * scale);
        ctx.lineTo((offset - px) * scale, (80 - pz) * scale);
        ctx.moveTo((-80 - px) * scale, (offset - pz) * scale);
        ctx.lineTo((80 - px) * scale, (offset - pz) * scale);
      }
      ctx.stroke();

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.moveTo(-px * scale, (-95 - pz) * scale);
      ctx.lineTo(-px * scale, (95 - pz) * scale);
      ctx.moveTo((-95 - px) * scale, -pz * scale);
      ctx.lineTo((95 - px) * scale, -pz * scale);
      ctx.stroke();

      // Monas circular plaza footprint
      ctx.fillStyle = '#273142';
      ctx.beginPath();
      ctx.arc(-px * scale, -pz * scale, 18 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Elevated Toll Highway on radar
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo((-68 - px) * scale, (-26 - pz) * scale);
      ctx.lineTo((68 - px) * scale, (-26 - pz) * scale);
      ctx.stroke();

      // Buildings
      for (const b of CITY_BUILDINGS) {
        const bx = (b.x - px) * scale;
        const bz = (b.z - pz) * scale;
        const bw = b.width * scale;
        const bd = b.depth * scale;
        ctx.fillStyle = b.style === 'monas' ? '#f59e0b' : '#1e293b';
        ctx.fillRect(bx - bw / 2, bz - bd / 2, bw, bd);
      }

      // Vehicles & Police Vision Cones when Wanted!
      for (const v of vehicles) {
        if (v.id === playerPhys.drivingVehicleId) continue;
        const vx = (v.x - px) * scale;
        const vz = (v.z - pz) * scale;

        if (v.type === 'polisi' && pState.wantedLevel > 0) {
          // Draw GTA V Police Vision Cone on Radar
          ctx.save();
          ctx.translate(vx, vz);
          ctx.rotate(-v.heading + Math.PI / 2);
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, 24, -0.5, 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          ctx.fillStyle = '#ef4444';
          ctx.fillRect(vx - 3, vz - 3, 6, 6);
        } else {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(vx - 2.5, vz - 2.5, 5, 5);
        }
      }

      // Other 2 Inactive Protagonist Blips on Radar
      (['nabilo', 'raka', 'kirana'] as ProtagonistId[]).forEach((pId) => {
        if (pId === pState.activeProtagonist) return;
        const live = pState.protagonistRoster[pId];
        const prof = PROTAGONIST_PROFILES[pId];
        const rx = (live.x - px) * scale;
        const rz = (live.z - pz) * scale;
        ctx.fillStyle = prof.colorHex;
        ctx.beginPath();
        ctx.arc(rx, rz, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Enemies (Red dots)
      for (const en of enemies) {
        if (en.state !== 'alive') continue;
        const ex = (en.x - px) * scale;
        const ez = (en.z - pz) * scale;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(ex, ez, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Active Objective or Next Mission Beacon (Yellow Target + GPS Route Line)
      let targetX: number | null = null;
      let targetZ: number | null = null;
      if (activeChoice) {
        targetX = activeChoice.targetX;
        targetZ = activeChoice.targetZ;
      } else if (nearbyMission) {
        targetX = nearbyMission.markerX;
        targetZ = nearbyMission.markerZ;
      }
      if (targetX !== null && targetZ !== null) {
        const tx = (targetX - px) * scale;
        const tz = (targetZ - pz) * scale;

        // GPS Guide Line
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(tx, tz);
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.strokeStyle = '#090b10';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(tx, tz, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Player center notched chevron with crisp outline
      ctx.rotate(-playerPhys.facing + Math.PI);
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#090b10';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.5, 4.5);
      ctx.lineTo(0, 2.2);
      ctx.lineTo(-4.5, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    // 14. Main Game Loop with Software-WebGL `afterDraw` Pacing
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    const weatherTransitionState = createInitialWeatherTransitionState(
      propsRef.current.weatherMode
    );

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync
        ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        : null;
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync
          ? gl.getSyncParameter(sync, gl.SYNC_STATUS)
          : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = clampDt((now - lastTime) / 1000);
      lastTime = now;

      const currentGameState = propsRef.current.gameState;
      const activeChoice = propsRef.current.activeChoice;
      const pState = propsRef.current.playerState;
      const isTpsAim = propsRef.current.tpsAiming || rightMouseHeld;
      const isWheelSlowMo = propsRef.current.wheelSlowMo;
      const isCustomsOpen = propsRef.current.customsShowcaseOpen;

      const weatherSpec =
        WEATHER_MODES.find((w) => w.id === propsRef.current.weatherMode) ||
        WEATHER_MODES[0];

      // Smooth frame-rate-independent interpolation across skybox, fog, lighting & surface wetness
      stepWeatherTransitionInPlace(weatherTransitionState, weatherSpec.id, dt, 1.65);

      sunLight.color.setRGB(
        weatherTransitionState.sunRgb.r,
        weatherTransitionState.sunRgb.g,
        weatherTransitionState.sunRgb.b
      );
      sunLight.intensity = weatherTransitionState.sunIntensity;
      hemiLight.color.setRGB(
        weatherTransitionState.hemiSkyRgb.r,
        weatherTransitionState.hemiSkyRgb.g,
        weatherTransitionState.hemiSkyRgb.b
      );
      hemiLight.groundColor.setRGB(
        weatherTransitionState.hemiGroundRgb.r,
        weatherTransitionState.hemiGroundRgb.g,
        weatherTransitionState.hemiGroundRgb.b
      );
      hemiLight.intensity = weatherTransitionState.hemiIntensity;

      skyUniforms.uTopColor.value.setRGB(
        weatherTransitionState.skyTopRgb.r,
        weatherTransitionState.skyTopRgb.g,
        weatherTransitionState.skyTopRgb.b
      );
      skyUniforms.uHorizonColor.value.setRGB(
        weatherTransitionState.skyHorizonRgb.r,
        weatherTransitionState.skyHorizonRgb.g,
        weatherTransitionState.skyHorizonRgb.b
      );
      skyUniforms.uBottomColor.value.setRGB(
        weatherTransitionState.skyBottomRgb.r,
        weatherTransitionState.skyBottomRgb.g,
        weatherTransitionState.skyBottomRgb.b
      );
      skyUniforms.uSunDir.value.set(
        weatherTransitionState.sunDir[0],
        weatherTransitionState.sunDir[1],
        weatherTransitionState.sunDir[2]
      );
      skyUniforms.uSunColor.value.setRGB(
        weatherTransitionState.sunColorRgb.r,
        weatherTransitionState.sunColorRgb.g,
        weatherTransitionState.sunColorRgb.b
      );
      skyUniforms.uSunGlowStrength.value =
        weatherTransitionState.sunGlowStrength;

      monasPlazaLight.intensity =
        weatherTransitionState.monasPlazaLightIntensity;
      sudirmanPlazaLight.intensity =
        weatherTransitionState.sudirmanPlazaLightIntensity;

      (scene.background as THREE.Color).setRGB(
        weatherTransitionState.fogHorizonRgb.r,
        weatherTransitionState.fogHorizonRgb.g,
        weatherTransitionState.fogHorizonRgb.b
      );
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.setRGB(
          weatherTransitionState.fogHorizonRgb.r,
          weatherTransitionState.fogHorizonRgb.g,
          weatherTransitionState.fogHorizonRgb.b
        );
        scene.fog.density = weatherTransitionState.fogDensity;
      }

      // Gradually transition wet rain asphalt specular reflections vs dry matte asphalt
      const wet = weatherTransitionState.wetnessFactor;
      const night = weatherTransitionState.nightFactor;
      roadMat.roughness = 0.86 - wet * 0.64;
      roadMat.metalness = 0.06 + wet * 0.2;
      streetscape.setWeatherTransition(night, wet);
      roadDetailSystem.setWeatherTransition(wet);
      roadsideSystem.setWeatherTransition(night, wet);

      // Sync Active Protagonist Outfit & Special Ability Aura
      const outfitSpec =
        NABILO_OUTFITS.find((o) => o.id === pState.outfitId) ||
        NABILO_OUTFITS[0];
      if (playerRig.group.userData.jacketMat) {
        (
          playerRig.group.userData.jacketMat as THREE.MeshStandardMaterial
        ).color.setHex(outfitSpec.jacketHex);
        (
          playerRig.group.userData.pantsMat as THREE.MeshStandardMaterial
        ).color.setHex(outfitSpec.pantsHex);
        (
          playerRig.group.userData.capMat as THREE.MeshStandardMaterial
        ).color.setHex(outfitSpec.capHex);
      }

      // Show/Hide Idle Protagonist Rigs in the World
      (['nabilo', 'raka', 'kirana'] as ProtagonistId[]).forEach((pId) => {
        const rig = idleProtagonistRigs[pId];
        if (
          pId === pState.activeProtagonist ||
          pState.currentInterior !== 'exterior'
        ) {
          rig.group.visible = false;
        } else {
          rig.group.visible = true;
          const live = pState.protagonistRoster[pId];
          rig.group.position.set(
            live.x,
            getGroundElevationAt(live.x, live.z),
            live.z
          );
        }
      });

      const pRingMat = playerRig.telegraphRing
        .material as THREE.MeshBasicMaterial;
      if (pState.fokusActive) {
        pRingMat.opacity = 0.65 + Math.sin(now * 0.014) * 0.25;
        playerRig.telegraphRing.scale.setScalar(
          1.1 + Math.sin(now * 0.01) * 0.15
        );
        if (Math.random() < 0.25) {
          spawnParticles(
            playerPhys.x,
            playerPhys.y + 0.9,
            playerPhys.z,
            1,
            0xfacc15,
            4
          );
        }
      } else {
        pRingMat.opacity = 0;
      }

      // Spin Helicopter & VTOL Jet Rotors + Apply Customs Paint to Player's Vehicle
      for (const v of vehicles) {
        if (v.type === 'heli' || v.type === 'vtol_jet') {
          const rotor =
            v.mesh.getObjectByName('heliRotor') ||
            (v.mesh.userData.mainRotor as THREE.Object3D | undefined);
          if (rotor) {
            const isActiveAircraft = v.id === playerPhys.drivingVehicleId;
            rotor.rotation.y += dt * (isActiveAircraft ? 22 : 4.5);
          }
        }
        if (v.id === playerPhys.drivingVehicleId || v.type === 'supercar') {
          applyVehicleCustomizationToMesh(v.mesh, pState.vehicleCustoms);
        }
      }

      // Update Wanted 3–5 Star Police Tactical Helicopter with Searchlight Cone
      if (
        pState.wantedLevel >= 3 &&
        pState.currentInterior === 'exterior' &&
        currentGameState === 'playing'
      ) {
        policeHeliMesh.visible = true;
        const heliOrbit = now * 0.0014;
        const hx = playerPhys.x + Math.cos(heliOrbit) * 9.5;
        const hz = playerPhys.z + Math.sin(heliOrbit) * 9.5;
        policeHeliMesh.position.set(hx, 22.5, hz);
        policeHeliMesh.rotation.y = -heliOrbit + Math.PI;
        const pRotor = policeHeliMesh.getObjectByName('heliRotor');
        if (pRotor) pRotor.rotation.y += dt * 24;
      } else {
        policeHeliMesh.visible = false;
      }

      // Update Autonomous Combat Drone "Rajawali-X"
      const droneEnabled = pState.droneLevel > 0 && pState.droneActive;
      droneMesh.visible = droneEnabled;
      if (droneEnabled) {
        const orbitAng = now * 0.0026;
        const dx = playerPhys.x + Math.cos(orbitAng) * 2.1;
        const dz = playerPhys.z + Math.sin(orbitAng) * 2.1;
        const dy = (playerPhys.y || 0) + 3.15 + Math.sin(now * 0.006) * 0.22;
        droneMesh.position.set(dx, dy, dz);
        droneMesh.rotation.y = -orbitAng + Math.PI / 2;

        if (currentGameState === 'playing') {
          droneFireCooldown -= dt;
          if (droneFireCooldown <= 0) {
            let nearestEn: EnemyEntity | null = null;
            let bestDist = 20;
            for (const en of enemies) {
              if (en.state !== 'alive') continue;
              const d = Math.hypot(en.x - dx, en.z - dz);
              if (d < bestDist) {
                bestDist = d;
                nearestEn = en;
              }
            }
            if (nearestEn) {
              const kiranaBoost =
                pState.activeProtagonist === 'kirana' && pState.fokusActive
                  ? 0.5
                  : 1.0;
              droneFireCooldown =
                Math.max(0.38, 0.92 - pState.droneLevel * 0.16) * kiranaBoost;
              const droneDmg = 20 + pState.droneLevel * 12;
              nearestEn.hp -= droneDmg;
              nearestEn.hitFlashTimer = 0.06;
              spawnParticles(dx, dy, dz, 3, 0x38bdf8, 5);
              spawnParticles(nearestEn.x, 1.3, nearestEn.z, 9, 0x38bdf8, 8);
              if (nearestEn.hp <= 0) {
                nearestEn.state = 'ko';
                nearestEn.koTimer = 0.42;
                soundEngine.playHit(true);
                const arch = ENEMY_ARCHETYPES[nearestEn.policy];
                propsRef.current.onEnemyDefeated(
                  arch.rewardRp,
                  arch.scoreValue
                );
                if (
                  activeChoice &&
                  activeChoice.objectiveType === 'combat_wave'
                ) {
                  objectiveProgress += 1;
                  if (objectiveProgress >= activeChoice.objectiveTargetCount) {
                    soundEngine.playMissionFanfare();
                    propsRef.current.onCompleteActiveObjective();
                  }
                }
              }
            }
          }
        }
      }

      // Determine next available story mission marker
      const nextStoryMission =
        STORY_MISSIONS.find(
          (m) => !pState.completedMissions.includes(m.id)
        ) || STORY_MISSIONS[0];

      if (activeChoice) {
        beaconGroup.position.set(
          activeChoice.targetX,
          getGroundElevationAt(activeChoice.targetX, activeChoice.targetZ),
          activeChoice.targetZ
        );
        beaconGroup.visible = true;
      } else if (nextStoryMission) {
        beaconGroup.position.set(
          nextStoryMission.markerX,
          getGroundElevationAt(
            nextStoryMission.markerX,
            nextStoryMission.markerZ
          ),
          nextStoryMission.markerZ
        );
        beaconGroup.visible = true;
      } else {
        beaconGroup.visible = false;
      }
      beaconGroup.rotation.y += dt * 1.4;

      if (currentGameState === 'title') {
        tourElapsed += dt;
        const orbitAngle = tourElapsed * 0.22;
        const camX = Math.sin(orbitAngle) * 46;
        const camZ = Math.cos(orbitAngle) * 46;
        camera.position.set(
          camX,
          20 + Math.sin(tourElapsed * 0.5) * 2.5,
          camZ
        );
        camera.lookAt(0, 16.5, 0);
      } else if (currentGameState === 'playing') {
        if (hitstopTimer > 0) {
          hitstopTimer = Math.max(0, hitstopTimer - dt);
        }
        const rawSimDt = hitstopTimer > 0 ? 0 : dt;
        const simDt = isWheelSlowMo ? rawSimDt * 0.25 : rawSimDt;

        // Check nearby Enterable Interior Portal
        let nearbyInterior: EnterableInteriorSpec | null = null;
        if (pState.currentInterior === 'exterior') {
          for (const intSpec of ENTERABLE_INTERIORS) {
            const dInt = Math.hypot(
              playerPhys.x - intSpec.portalX,
              playerPhys.z - intSpec.portalZ
            );
            if (dInt < 6.5) {
              nearbyInterior = intSpec;
              break;
            }
          }
        }

        // One-shot edge triggers
        if (keysJustPressed.has('KeyF')) {
          toggleEnterExitVehicle();
        }
        if (keysJustPressed.has('KeyG')) {
          if (nearbyInterior || pState.currentInterior !== 'exterior') {
            propsRef.current.onEnterOrExitInterior(nearbyInterior);
          } else {
            toggleEnterExitVehicle();
          }
        }
        if (keysJustPressed.has('KeyX')) {
          propsRef.current.onToggleTpsAim();
        }
        // Tactical Combat Roll ([AltLeft] or [ControlLeft])
        if (
          (keysJustPressed.has('AltLeft') ||
            keysJustPressed.has('ControlLeft')) &&
          !playerPhys.drivingVehicleId &&
          playerPhys.combatRollTimer <= 0
        ) {
          playerPhys.combatRollTimer = 0.32;
          soundEngine.playTone(220, 0.12, 'triangle', 0.14, 1.5);
          spawnParticles(
            playerPhys.x,
            playerPhys.y + 0.5,
            playerPhys.z,
            10,
            0x38bdf8,
            6
          );
        }

        if (
          keysJustPressed.has('Space') ||
          keysJustPressed.has('KeyK') ||
          mouseJustClicked
        ) {
          if (!playerPhys.drivingVehicleId) {
            triggerPlayerAttack();
          }
        }

        let nearbyMission: StoryMission | null = null;
        if (!activeChoice && nextStoryMission) {
          nearbyMission = nextStoryMission;
          if (keysJustPressed.has('KeyE')) {
            propsRef.current.onOpenMissionDialog(nextStoryMission);
          }
        }

        keysJustPressed.clear();
        mouseJustClicked = false;

        // Player or Driven Vehicle Movement
        const moveForward =
          (keysHeld.has('KeyW') || keysHeld.has('ArrowUp') ? 1 : 0) -
          (keysHeld.has('KeyS') || keysHeld.has('ArrowDown') ? 1 : 0);
        const moveTurn =
          (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft') ? 1 : 0) -
          (keysHeld.has('KeyD') || keysHeld.has('ArrowRight') ? 1 : 0);
        const sprinting =
          keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight');

        let activeVehicle: VehicleEntity | null = null;
        if (playerPhys.drivingVehicleId) {
          activeVehicle =
            vehicles.find((v) => v.id === playerPhys.drivingVehicleId) || null;
        }

        const camFwdX = Math.sin(camYaw);
        const camFwdZ = Math.cos(camYaw);
        const camRightX = -Math.cos(camYaw);
        const camRightZ = Math.sin(camYaw);
        const strafeRight = -moveTurn;

        if (pState.currentInterior !== 'exterior') {
          // Player is inside the 3D Elevated Interior Stage at (0, 68, 0)
          const inputX = camFwdX * moveForward + camRightX * strafeRight;
          const inputZ = camFwdZ * moveForward + camRightZ * strafeRight;
          const mag = Math.hypot(inputX, inputZ);
          if (mag > 0.01) {
            playerPhys.x = THREE.MathUtils.clamp(
              playerPhys.x + (inputX / mag) * 7.5 * simDt,
              -11,
              11
            );
            playerPhys.z = THREE.MathUtils.clamp(
              playerPhys.z + (inputZ / mag) * 7.5 * simDt,
              -11,
              11
            );
            playerPhys.facing = Math.atan2(inputX, inputZ);
          }
          playerPhys.y = 68;
          playerRig.group.position.set(playerPhys.x, 68, playerPhys.z);
          playerRig.group.rotation.y = playerPhys.facing;
        } else if (activeVehicle && simDt > 0) {
          const vSpec = VEHICLE_SPECS[activeVehicle.type];
          const rakaBoost =
            pState.activeProtagonist === 'raka' && pState.fokusActive
              ? 1.45
              : 1.0;
          const turboMult =
            (1 + pState.vehicleUpgradeLevel * 0.15) *
            (pState.fokusActive ? 1.18 : 1.0) *
            rakaBoost;

          if (moveForward !== 0) {
            activeVehicle.speed +=
              moveForward * vSpec.acceleration * turboMult * simDt;
          } else {
            activeVehicle.speed *= Math.exp(-3.5 * simDt);
          }
          activeVehicle.speed = THREE.MathUtils.clamp(
            activeVehicle.speed,
            -vSpec.maxSpeed * turboMult * 0.45,
            vSpec.maxSpeed * turboMult
          );

          if (vSpec.isAircraft || Math.abs(activeVehicle.speed) > 0.4) {
            const dirSign =
              vSpec.isAircraft || activeVehicle.speed >= 0 ? 1 : -1;
            activeVehicle.heading +=
              moveTurn * vSpec.turnRate * dirSign * simDt;
          }

          const nextVX =
            activeVehicle.x +
            Math.sin(activeVehicle.heading) * activeVehicle.speed * simDt;
          const nextVZ =
            activeVehicle.z +
            Math.cos(activeVehicle.heading) * activeVehicle.speed * simDt;

          const surfaceElev = getGroundElevationAt(nextVX, nextVZ);
          if (vSpec.isAircraft) {
            const climbDir =
              (keysHeld.has('Space') ? 1 : 0) -
              (keysHeld.has('KeyZ') ? 1 : 0);
            activeVehicle.y = THREE.MathUtils.clamp(
              activeVehicle.y + climbDir * 14 * simDt,
              surfaceElev,
              38
            );
          } else {
            activeVehicle.y = surfaceElev;
          }

          const col =
            (vSpec.isAircraft && activeVehicle.y > 5) || surfaceElev > 2.5
              ? {
                  x: THREE.MathUtils.clamp(nextVX, -88, 88),
                  z: THREE.MathUtils.clamp(nextVZ, -88, 88),
                  collided: false,
                }
              : resolveCircleAABBCollision(nextVX, nextVZ, vSpec.radius);

          if (col.collided) {
            activeVehicle.speed *= -0.35;
            cameraTrauma = Math.min(1, cameraTrauma + 0.25);
            soundEngine.playHit(false);
          }
          activeVehicle.x = col.x;
          activeVehicle.z = col.z;
          activeVehicle.mesh.position.set(
            activeVehicle.x,
            activeVehicle.y,
            activeVehicle.z
          );
          activeVehicle.mesh.rotation.y = activeVehicle.heading;
          const speedLeanRatio = Math.min(1, Math.abs(activeVehicle.speed) / 14);
          const targetRoll =
            -moveTurn * speedLeanRatio * (vSpec.isAircraft ? 0.22 : 0.075);
          activeVehicle.mesh.rotation.z = THREE.MathUtils.damp(
            activeVehicle.mesh.rotation.z,
            targetRoll,
            8,
            simDt
          );

          playerPhys.x = activeVehicle.x;
          playerPhys.y = activeVehicle.y;
          playerPhys.z = activeVehicle.z;
          playerPhys.facing = activeVehicle.heading;

          // Vehicle ramming enemies
          if (Math.abs(activeVehicle.speed) > 8 && activeVehicle.y < 3) {
            for (const en of enemies) {
              if (en.state !== 'alive') continue;
              const d = Math.hypot(
                en.x - activeVehicle.x,
                en.z - activeVehicle.z
              );
              if (d < vSpec.radius + 1.0) {
                en.hp = 0;
                en.state = 'ko';
                en.koTimer = 0.45;
                hitstopTimer = 0.05;
                cameraTrauma = Math.min(1, cameraTrauma + 0.4);
                spawnParticles(en.x, 1.1, en.z, 16, 0xf97316, 10);
                soundEngine.playHit(true);
                const arch = ENEMY_ARCHETYPES[en.policy];
                propsRef.current.onEnemyDefeated(
                  arch.rewardRp,
                  arch.scoreValue
                );
                if (
                  activeChoice &&
                  activeChoice.objectiveType === 'combat_wave'
                ) {
                  objectiveProgress += 1;
                  if (objectiveProgress >= activeChoice.objectiveTargetCount) {
                    soundEngine.playMissionFanfare();
                    propsRef.current.onCompleteActiveObjective();
                  }
                }
              }
            }
          }
        } else if (simDt > 0) {
          if (playerPhys.combatRollTimer > 0) {
            playerPhys.combatRollTimer = Math.max(
              0,
              playerPhys.combatRollTimer - simDt
            );
          }
          const rollBoost = playerPhys.combatRollTimer > 0 ? 1.85 : 1.0;
          const walkSpeed =
            (sprinting ? 12.5 : 8.5) *
            (pState.fokusActive ? 1.22 : 1.0) *
            rollBoost;
          const inputX = camFwdX * moveForward + camRightX * strafeRight;
          const inputZ = camFwdZ * moveForward + camRightZ * strafeRight;
          const mag = Math.hypot(inputX, inputZ);

          if (mag > 0.01) {
            const nx = inputX / mag;
            const nz = inputZ / mag;
            playerPhys.vx = nx * walkSpeed;
            playerPhys.vz = nz * walkSpeed;
            const targetAngle = isTpsAim ? camYaw : Math.atan2(nx, nz);
            const diff =
              ((targetAngle - playerPhys.facing + Math.PI * 3) %
                (Math.PI * 2)) -
              Math.PI;
            playerPhys.facing += diff * (1 - Math.exp(-15 * simDt));
          } else {
            playerPhys.vx *= Math.exp(-12 * simDt);
            playerPhys.vz *= Math.exp(-12 * simDt);
            if (isTpsAim) {
              const diff =
                ((camYaw - playerPhys.facing + Math.PI * 3) % (Math.PI * 2)) -
                Math.PI;
              playerPhys.facing += diff * (1 - Math.exp(-18 * simDt));
            }
          }

          const nextPX = playerPhys.x + playerPhys.vx * simDt;
          const nextPZ = playerPhys.z + playerPhys.vz * simDt;
          const elevY = getGroundElevationAt(nextPX, nextPZ);
          const col =
            elevY > 2.5
              ? {
                  x: THREE.MathUtils.clamp(nextPX, -88, 88),
                  z: THREE.MathUtils.clamp(nextPZ, -88, 88),
                  collided: false,
                }
              : resolveCircleAABBCollision(nextPX, nextPZ, 0.75);
          playerPhys.x = col.x;
          playerPhys.z = col.z;
          playerPhys.y = elevY;

          const stepDist = Math.hypot(playerPhys.vx, playerPhys.vz) * simDt;
          playerPhys.walkDist += stepDist;
          if (mag > 0.01) {
            const swing = Math.sin(playerPhys.walkDist * 2.2) * 0.55;
            playerRig.leftLeg.rotation.x = swing;
            playerRig.rightLeg.rotation.x = -swing;
          } else {
            playerRig.leftLeg.rotation.x *= 0.8;
            playerRig.rightLeg.rotation.x *= 0.8;
          }

          playerRig.rightArm.rotation.x = THREE.MathUtils.damp(
            playerRig.rightArm.rotation.x,
            isTpsAim ? -Math.PI * 0.42 : 0,
            12,
            simDt
          );

          playerRig.group.position.set(
            playerPhys.x,
            playerPhys.y,
            playerPhys.z
          );
          playerRig.group.rotation.y = playerPhys.facing;
        }

        // Dynamic Vehicle Headlight SpotLight, Police Siren Light & Continuous RPM Audio
        if (activeVehicle && pState.currentInterior === 'exterior') {
          const vSpec = VEHICLE_SPECS[activeVehicle.type];
          const speedRatio =
            Math.abs(activeVehicle.speed) / Math.max(1, vSpec.maxSpeed);
          soundEngine.updateEngineAudio(
            speedRatio,
            true,
            Boolean(vSpec.isAircraft),
            pState.fokusActive,
            !isWheelSlowMo
          );

          if (weatherTransitionState.nightFactor > 0.04) {
            const hFwdX = Math.sin(activeVehicle.heading);
            const hFwdZ = Math.cos(activeVehicle.heading);
            vehicleHeadlight.position.set(
              activeVehicle.x + hFwdX * 1.5,
              activeVehicle.y + 1.15,
              activeVehicle.z + hFwdZ * 1.5
            );
            vehicleHeadlight.target.position.set(
              activeVehicle.x + hFwdX * 16,
              activeVehicle.y + 0.1,
              activeVehicle.z + hFwdZ * 16
            );
            vehicleHeadlight.intensity =
              weatherTransitionState.nightFactor * 4.6;
          } else {
            vehicleHeadlight.intensity = 0;
          }
        } else {
          vehicleHeadlight.intensity = 0;
          soundEngine.updateEngineAudio(0, false, false, false, false);
        }

        if (
          pState.wantedLevel > 0 &&
          pState.currentInterior === 'exterior'
        ) {
          let nearestPolice: VehicleEntity | null = null;
          let bestPoliceDist = 48;
          for (const v of vehicles) {
            if (v.type !== 'polisi') continue;
            const dPol = Math.hypot(v.x - playerPhys.x, v.z - playerPhys.z);
            if (dPol < bestPoliceDist) {
              bestPoliceDist = dPol;
              nearestPolice = v;
            }
          }
          if (nearestPolice) {
            sirenLight.position.set(
              nearestPolice.x,
              nearestPolice.y + 2.1,
              nearestPolice.z
            );
            sirenLight.color.setHex(
              Math.floor(now / 115) % 2 === 0 ? 0xef4444 : 0x3b82f6
            );
            sirenLight.intensity = 4.2;
          } else {
            sirenLight.intensity = 0;
          }
        } else {
          sirenLight.intensity = 0;
        }

        if (playerPhys.attackCooldown > 0) {
          playerPhys.attackCooldown = Math.max(
            0,
            playerPhys.attackCooldown - simDt
          );
        }

        // Check Checkpoint Drive or Heist Escape Objective Completion
        if (
          activeChoice &&
          (activeChoice.objectiveType === 'checkpoint_drive' ||
            activeChoice.objectiveType === 'heist_escape')
        ) {
          const distToTarget = Math.hypot(
            playerPhys.x - activeChoice.targetX,
            playerPhys.z - activeChoice.targetZ
          );
          if (distToTarget < 7.0) {
            objectiveProgress += 1;
            checkpointStage += 1;
            spawnParticles(
              activeChoice.targetX,
              playerPhys.y + 1.5,
              activeChoice.targetZ,
              20,
              0xfef08a,
              9
            );
            soundEngine.playPickup();

            if (objectiveProgress >= activeChoice.objectiveTargetCount) {
              soundEngine.playMissionFanfare();
              propsRef.current.onCompleteActiveObjective();
            } else {
              const checkpoints = [
                [0, -26],
                [36, -26],
                [32, 16],
                [0, 26],
              ];
              const nextPt = checkpoints[checkpointStage % checkpoints.length];
              activeChoice.targetX = nextPt[0];
              activeChoice.targetZ = nextPt[1];
            }
          }
        }

        // Update Loyal AI Crew Bodyguards
        for (let cIdx = 0; cIdx < crewCompanions.length; cIdx++) {
          const comp = crewCompanions[cIdx];
          const shouldShow =
            cIdx < pState.crewCount &&
            !playerPhys.drivingVehicleId &&
            pState.currentInterior === 'exterior';
          comp.rig.group.visible = shouldShow;
          if (!shouldShow) continue;

          const formAngle =
            playerPhys.facing + Math.PI + (cIdx - 1) * 0.65;
          const targetCX = playerPhys.x + Math.sin(formAngle) * 2.6;
          const targetCZ = playerPhys.z + Math.cos(formAngle) * 2.6;
          const dxC = targetCX - comp.x;
          const dzC = targetCZ - comp.z;
          const distC = Math.hypot(dxC, dzC);

          if (distC > 0.35) {
            const stepC = Math.min(distC, 9.2 * simDt);
            comp.x += (dxC / distC) * stepC;
            comp.z += (dzC / distC) * stepC;
            comp.facing = Math.atan2(dxC, dzC);
            comp.walkDist += stepC;
            const swing = Math.sin(comp.walkDist * 2.2) * 0.5;
            comp.rig.leftLeg.rotation.x = swing;
            comp.rig.rightLeg.rotation.x = -swing;
          } else {
            comp.rig.leftLeg.rotation.x *= 0.8;
            comp.rig.rightLeg.rotation.x *= 0.8;
          }

          comp.fireCooldown -= simDt;
          if (comp.fireCooldown <= 0) {
            let targetEn: EnemyEntity | null = null;
            let bestED = 16;
            for (const en of enemies) {
              if (en.state !== 'alive') continue;
              const d = Math.hypot(en.x - comp.x, en.z - comp.z);
              if (d < bestED) {
                bestED = d;
                targetEn = en;
              }
            }
            if (targetEn) {
              comp.fireCooldown = 1.05;
              comp.facing = Math.atan2(
                targetEn.x - comp.x,
                targetEn.z - comp.z
              );
              comp.rig.rightArm.rotation.x = -Math.PI * 0.65;
              targetEn.hp -= 24;
              targetEn.hitFlashTimer = 0.06;
              spawnParticles(targetEn.x, 1.2, targetEn.z, 8, 0x22c55e, 7);
              if (targetEn.hp <= 0) {
                targetEn.state = 'ko';
                targetEn.koTimer = 0.42;
                soundEngine.playHit(true);
                const arch = ENEMY_ARCHETYPES[targetEn.policy];
                propsRef.current.onEnemyDefeated(
                  arch.rewardRp,
                  arch.scoreValue
                );
                if (
                  activeChoice &&
                  activeChoice.objectiveType === 'combat_wave'
                ) {
                  objectiveProgress += 1;
                  if (objectiveProgress >= activeChoice.objectiveTargetCount) {
                    soundEngine.playMissionFanfare();
                    propsRef.current.onCompleteActiveObjective();
                  }
                }
              }
            } else {
              comp.fireCooldown = 0.35;
            }
          }

          comp.rig.rightArm.rotation.x = THREE.MathUtils.damp(
            comp.rig.rightArm.rotation.x,
            0,
            10,
            simDt
          );
          comp.rig.group.position.set(
            comp.x,
            getGroundElevationAt(comp.x, comp.z),
            comp.z
          );
          comp.rig.group.rotation.y = comp.facing;
        }

        // Ambient Lane-Following Traffic AI & Police Pursuit Steering (Stars 1–5)
        let spottedByPolice = false;
        for (let vi = 0; vi < vehicles.length; vi++) {
          const v = vehicles[vi];
          if (!v.isTraffic || v.id === playerPhys.drivingVehicleId) continue;

          if (v.type === 'polisi' && pState.wantedLevel > 0) {
            // Kirana EMP freezes police patrol cars!
            const kiranaEmp =
              pState.activeProtagonist === 'kirana' && pState.fokusActive;
            const pSpeed = kiranaEmp ? 1.5 : 13.5 + pState.wantedLevel * 1.4;
            const dxP = playerPhys.x - v.x;
            const dzP = playerPhys.z - v.z;
            const distP = Math.hypot(dxP, dzP) || 1;
            if (distP < 34) {
              spottedByPolice = true;
            }
            if (distP > 4.5) {
              v.heading = Math.atan2(dxP, dzP);
              const nx = v.x + (dxP / distP) * pSpeed * simDt;
              const nz = v.z + (dzP / distP) * pSpeed * simDt;
              const col = resolveCircleAABBCollision(nx, nz, 2.2);
              v.x = col.x;
              v.z = col.z;
            }
            v.y = getGroundElevationAt(v.x, v.z);
          } else {
            // Compute nearest obstacle directly ahead in same lane & elevation layer (Zero-GC)
            let minAheadDist = 999;
            const sinH = Math.sin(v.heading);
            const cosH = Math.cos(v.heading);

            for (let oi = 0; oi < vehicles.length; oi++) {
              if (oi === vi) continue;
              const other = vehicles[oi];
              if (Math.abs(other.y - v.y) > 2.2) continue;
              const dxO = other.x - v.x;
              const dzO = other.z - v.z;
              const fwdDot = dxO * sinH + dzO * cosH;
              if (fwdDot > 0.4 && fwdDot < minAheadDist) {
                const latDist = Math.abs(dxO * cosH - dzO * sinH);
                if (latDist < 2.25) {
                  minAheadDist = fwdDot;
                }
              }
            }

            // Also yield when the player is walking or stopped in the lane ahead
            if (Math.abs(playerPhys.y - v.y) < 2.2) {
              const dxP = playerPhys.x - v.x;
              const dzP = playerPhys.z - v.z;
              const fwdP = dxP * sinH + dzP * cosH;
              if (fwdP > 0.4 && fwdP < minAheadDist) {
                const latP = Math.abs(dxP * cosH - dzP * sinH);
                if (latP < 2.1) {
                  minAheadDist = fwdP;
                }
              }
            }

            const route = TRAFFIC_ROUTES[v.routeId];
            stepTrafficVehicleInPlace(v, route, minAheadDist, simDt);
            v.y = v.layer === 'elevated' ? getGroundElevationAt(v.x, v.z) : 0;
          }

          v.mesh.position.set(v.x, v.y, v.z);
          v.mesh.rotation.y = v.heading;
        }

        // Check if any alive enemies are also spotting the player during Wanted Pursuit
        if (pState.wantedLevel > 0) {
          for (const en of enemies) {
            if (
              en.state === 'alive' &&
              Math.hypot(en.x - playerPhys.x, en.z - playerPhys.z) < 25
            ) {
              spottedByPolice = true;
              break;
            }
          }
          sirenSoundCooldown -= dt;
          if (sirenSoundCooldown <= 0 && !pState.wantedEvading) {
            sirenSoundCooldown = 3.6;
            soundEngine.playPoliceSiren();
          }
        }

        // Enemy AI Loop
        let activeAttackers = 0;
        const MAX_CONCURRENT_ATTACKERS = 3;
        const enemySimDt = simDt * (pState.fokusActive ? 0.38 : 1.0);

        for (let i = enemies.length - 1; i >= 0; i--) {
          const en = enemies[i];
          if (en.state === 'ko') {
            en.koTimer -= dt;
            en.rig.group.rotation.x = THREE.MathUtils.damp(
              en.rig.group.rotation.x,
              -Math.PI / 2,
              10,
              dt
            );
            if (en.koTimer <= 0) {
              scene.remove(en.rig.group);
              enemies.splice(i, 1);
            }
            continue;
          }

          en.phaseTimer += enemySimDt;
          const spec = ENEMY_ARCHETYPES[en.policy];

          if (en.hitFlashTimer > 0) {
            en.hitFlashTimer -= dt;
            (
              en.rig.bodyMesh.material as THREE.MeshStandardMaterial
            ).emissive.setHex(en.hitFlashTimer > 0 ? 0xffffff : 0x000000);
          }

          en.x += en.vx * simDt;
          en.z += en.vz * simDt;
          en.vx *= Math.exp(-10 * simDt);
          en.vz *= Math.exp(-10 * simDt);

          const distToPlayer = Math.hypot(
            playerPhys.x - en.x,
            playerPhys.z - en.z
          );

          if (en.windupTimer <= 0 && distToPlayer < 48) {
            const moveRes = stepEnemyMovementPolicy(
              en.policy,
              en.x,
              en.z,
              playerPhys.x,
              playerPhys.z,
              spec.speed,
              enemySimDt,
              en.phaseTimer
            );
            const col = resolveCircleAABBCollision(
              moveRes.nextX,
              moveRes.nextZ,
              0.75
            );
            en.x = col.x;
            en.z = col.z;
            en.facing = moveRes.facingAngle;
          }

          if (en.cooldownTimer > 0) {
            en.cooldownTimer -= enemySimDt;
          }

          const ringMat = en.rig.telegraphRing
            .material as THREE.MeshBasicMaterial;
          if (en.windupTimer > 0) {
            activeAttackers++;
            en.windupTimer -= enemySimDt;
            ringMat.opacity = 0.75;
            const pulse =
              1 + (1 - en.windupTimer / spec.windupDuration) * 0.45;
            en.rig.telegraphRing.scale.setScalar(pulse);

            if (en.windupTimer <= 0) {
              ringMat.opacity = 0;
              en.cooldownTimer = spec.cooldown;
              if (
                distToPlayer <= spec.attackRange + 1.2 &&
                playerPhys.combatRollTimer <= 0
              ) {
                propsRef.current.onPlayerDamage(spec.damage);
                cameraTrauma = Math.min(1, cameraTrauma + 0.35);
                soundEngine.playHit(false);
                spawnParticles(
                  playerPhys.x,
                  playerPhys.y + 1.1,
                  playerPhys.z,
                  10,
                  0xef4444,
                  6
                );
              }
            }
          } else {
            ringMat.opacity = 0;
            if (
              distToPlayer <= spec.attackRange &&
              en.cooldownTimer <= 0 &&
              activeAttackers < MAX_CONCURRENT_ATTACKERS
            ) {
              activeAttackers++;
              en.windupTimer = spec.windupDuration;
              soundEngine.playTone(380, 0.12, 'sine', 0.08, 1.35);
            }
          }

          en.rig.group.position.set(
            en.x,
            getGroundElevationAt(en.x, en.z),
            en.z
          );
          en.rig.group.rotation.y = en.facing;
        }

        // Wanted Level Police Reinforcement Spawn (Scales with Stars 1-5)
        const maxPoliceReinforcements = Math.min(6, pState.wantedLevel + 1);
        if (
          pState.wantedLevel >= 1 &&
          pState.currentInterior === 'exterior' &&
          enemies.length < maxPoliceReinforcements &&
          Math.random() < 0.018
        ) {
          spawnEnemyGroup(playerPhys.x - 16, playerPhys.z - 16, 2);
        }

        // Update Zero-GC Pooled Particles
        for (let i = 0; i < PARTICLE_CAP; i++) {
          const p = particles[i];
          if (!p.active) {
            _v1.set(0, -100, 0);
            _scale.setScalar(0.001);
            _mat4.compose(_v1, _quat.identity(), _scale);
            particleInst.setMatrixAt(i, _mat4);
            continue;
          }
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 14 * dt;

          const t = 1 - p.life / p.maxLife;
          _v1.set(p.x, Math.max(0.05, p.y), p.z);
          _scale.setScalar(p.size * t);
          _mat4.compose(_v1, _quat.identity(), _scale);
          particleInst.setMatrixAt(i, _mat4);
          _color.setHex(p.colorHex);
          particleInst.setColorAt(i, _color);
        }
        particleInst.instanceMatrix.needsUpdate = true;
        if (particleInst.instanceColor) {
          particleInst.instanceColor.needsUpdate = true;
        }

        // CAMERA CHOREOGRAPHY:
        // 1. GTA V 3-Stage Satellite Sky-Switch
        // 2. 360° Customs Garage Showcase Orbit
        // 3. Mouse-Orbit Over-the-Shoulder TPS Aiming Camera
        // 4. Exponentially Damped Speed-Dynamic Chase Camera
        if (userOrbitTimer > 0) {
          userOrbitTimer = Math.max(0, userOrbitTimer - dt);
        }

        const isDriving = Boolean(activeVehicle);
        const speedRatio = activeVehicle
          ? Math.min(
              1.25,
              Math.abs(activeVehicle.speed) /
                Math.max(1, VEHICLE_SPECS[activeVehicle.type].maxSpeed)
            )
          : 0;
        const targetFov = isTpsAim
          ? 46
          : isDriving
          ? 60 + speedRatio * 10 + (pState.fokusActive ? 3.5 : 0)
          : 60;
        if (Math.abs(camera.fov - targetFov) > 0.15) {
          camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, dt * 8);
          camera.updateProjectionMatrix();
        }

        if (skySwitch.active) {
          skySwitch.elapsed += dt;
          const progress = Math.min(1, skySwitch.elapsed / skySwitch.duration);
          const stageNum: 1 | 2 | 3 =
            progress < 0.34 ? 1 : progress < 0.68 ? 2 : 3;
          if (stageNum !== skySwitch.lastStageSound) {
            skySwitch.lastStageSound = stageNum;
            soundEngine.playCharacterSwitchBoom(stageNum);
          }

          if (progress < 0.34) {
            // Stage 1: Zoom up into Jakarta sky above previous character
            const t1 = progress / 0.34;
            camera.position.set(
              skySwitch.fromX,
              THREE.MathUtils.lerp(12, 66, t1),
              skySwitch.fromZ + 8
            );
            camera.lookAt(skySwitch.fromX, 0, skySwitch.fromZ);
          } else if (progress < 0.68) {
            // Stage 2: Pan across Jakarta satellite altitude to target character
            const t2 = (progress - 0.34) / 0.34;
            const curX = THREE.MathUtils.lerp(
              skySwitch.fromX,
              skySwitch.toX,
              t2
            );
            const curZ = THREE.MathUtils.lerp(
              skySwitch.fromZ,
              skySwitch.toZ,
              t2
            );
            camera.position.set(curX, 66, curZ + 8);
            camera.lookAt(curX, 0, curZ);
          } else {
            // Stage 3: Dive down into target character
            const t3 = (progress - 0.68) / 0.32;
            const targetGroundY = getGroundElevationAt(
              skySwitch.toX,
              skySwitch.toZ
            );
            camera.position.set(
              skySwitch.toX,
              THREE.MathUtils.lerp(66, targetGroundY + 4.2, t3),
              skySwitch.toZ + THREE.MathUtils.lerp(8, 9.2, t3)
            );
            camera.lookAt(skySwitch.toX, targetGroundY + 2.2, skySwitch.toZ);
          }

          if (progress >= 1) {
            skySwitch.active = false;
          }
        } else if (isCustomsOpen) {
          // 360° Los Santos Customs Showroom Orbit around active or nearest vehicle
          customsOrbitAngle += dt * 0.65;
          const focusVeh =
            activeVehicle ||
            vehicles.find((v) => v.type === 'supercar') ||
            vehicles[0];
          const vx = focusVeh ? focusVeh.x : playerPhys.x;
          const vy = focusVeh ? focusVeh.y : playerPhys.y;
          const vz = focusVeh ? focusVeh.z : playerPhys.z;
          camera.position.set(
            vx + Math.cos(customsOrbitAngle) * 7.2,
            vy + 2.6,
            vz + Math.sin(customsOrbitAngle) * 7.2
          );
          camera.lookAt(vx, vy + 0.9, vz);
        } else {
          // Gentle chase auto-align when driving and user is not dragging mouse
          if (
            isDriving &&
            activeVehicle &&
            !isOrbitDragging &&
            !rightMouseHeld &&
            userOrbitTimer <= 0 &&
            Math.abs(activeVehicle.speed) > 1.8
          ) {
            const diff =
              ((activeVehicle.heading - camYaw + Math.PI * 3) % (Math.PI * 2)) -
              Math.PI;
            camYaw += diff * (1 - Math.exp(-3.4 * dt));
          }

          const baseElevY = activeVehicle ? activeVehicle.y : playerPhys.y;
          const orbitFwdX = Math.sin(camYaw);
          const orbitFwdZ = Math.cos(camYaw);
          const orbitRightX = -Math.cos(camYaw);
          const orbitRightZ = Math.sin(camYaw);

          const camDist = isTpsAim
            ? 4.4
            : isDriving
            ? 12.2 + speedRatio * 1.4
            : 9.8;
          const horizDist = camDist * Math.cos(camPitch);
          const vertOffset = camDist * Math.sin(camPitch);

          let desiredX = playerPhys.x - orbitFwdX * horizDist;
          let desiredZ = playerPhys.z - orbitFwdZ * horizDist;
          let desiredY = baseElevY + (isTpsAim ? 1.55 : 1.75) + vertOffset;

          if (isTpsAim) {
            desiredX += orbitRightX * 1.1;
            desiredZ += orbitRightZ * 1.1;
          }

          const dampFactor = 1 - Math.exp(-(isTpsAim ? 14 : 9.5) * dt);
          camera.position.x = THREE.MathUtils.lerp(
            camera.position.x,
            desiredX,
            dampFactor
          );
          camera.position.y = THREE.MathUtils.lerp(
            camera.position.y,
            desiredY,
            dampFactor
          );
          camera.position.z = THREE.MathUtils.lerp(
            camera.position.z,
            desiredZ,
            dampFactor
          );

          if (cameraTrauma > 0) {
            const shake = cameraTrauma * cameraTrauma * 0.38;
            camera.position.x += (Math.random() - 0.5) * shake;
            camera.position.y += (Math.random() - 0.5) * shake;
            cameraTrauma = Math.max(0, cameraTrauma - dt * 2.2);
          }

          const lookDist = isTpsAim ? 14 : 5.2;
          const lookPitchShift = (0.28 - camPitch) * (isTpsAim ? 9.5 : 4.5);
          _v2.set(
            playerPhys.x + orbitFwdX * lookDist,
            baseElevY + (isTpsAim ? 1.7 : 2.15) + lookPitchShift,
            playerPhys.z + orbitFwdZ * lookDist
          );
          camera.lookAt(_v2);
        }

        // Throttled HUD & Radar Update (<= 10Hz)
        hudSyncAccumulator += dt;
        if (hudSyncAccumulator >= 0.1) {
          const syncDt = hudSyncAccumulator;
          hudSyncAccumulator = 0;

          if (pState.wantedLevel > 0) {
            propsRef.current.onWantedEvadeUpdate(!spottedByPolice, syncDt);
          }

          const district = resolveDistrictAtPosition(
            playerPhys.x,
            playerPhys.z
          );

          let nearbyVehType: VehicleType | null = null;
          if (!activeVehicle) {
            let bestD = 6.2;
            for (const v of vehicles) {
              const d = Math.hypot(v.x - playerPhys.x, v.z - playerPhys.z);
              if (d < bestD) {
                bestD = d;
                nearbyVehType = v.type;
              }
            }
          }

          renderRadarMinimap(nearbyMission, activeChoice);

          const stageProgress = skySwitch.elapsed / skySwitch.duration;
          const currentSkyStage: 1 | 2 | 3 =
            stageProgress < 0.34 ? 1 : stageProgress < 0.68 ? 2 : 3;

          propsRef.current.onUpdateHud({
            district,
            drivingVehicle: activeVehicle ? activeVehicle.type : null,
            vehicleSpeedKmh: activeVehicle
              ? Math.abs(activeVehicle.speed) * 3.2
              : 0,
            aircraftAltitude: activeVehicle ? activeVehicle.y : playerPhys.y,
            nearbyVehicle: nearbyVehType,
            nearbyMission,
            nearbyInterior,
            objectiveProgress,
            skySwitchPhase: skySwitch.active
              ? {
                  active: true,
                  targetId: skySwitch.targetId,
                  stage: currentSkyStage,
                }
              : null,
          });
        }
      } else {
        vehicleHeadlight.intensity = 0;
        sirenLight.intensity = 0;
        soundEngine.updateEngineAudio(0, false, false, false, false);
      }

      // Texel-snapped sun shadow frustum tracking player position across all Jakarta districts
      if (sunLight.castShadow) {
        const texelWorldSize = (d * 2) / 2048;
        const snapX =
          Math.round(playerPhys.x / texelWorldSize) * texelWorldSize;
        const snapZ =
          Math.round(playerPhys.z / texelWorldSize) * texelWorldSize;
        sunLight.target.position.set(snapX, 0, snapZ);
        sunLight.position.set(
          snapX + sunOffset.x,
          sunOffset.y,
          snapZ + sunOffset.z
        );
      }

      skyDomeMesh.position.copy(camera.position);
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);
    window.addEventListener('resize', handleResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      soundEngine.stopEngineAudio(true);
      soundEngine.stopAmbientSoundscape(true);
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('contextmenu', onContextMenu);
      roadDetailSystem.dispose();
      roadsideSystem.dispose();
      skyDomeGeo.dispose();
      skyDomeMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [controllerRef, radarCanvasRef]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#0b0d12]"
    />
  );
};

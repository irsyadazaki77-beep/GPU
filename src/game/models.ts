import * as THREE from 'three';
import {
  BuildingFootprint,
  CITY_BUILDINGS,
  ENTERABLE_INTERIORS,
  EnemyBehaviorPolicy,
  VEHICLE_CUSTOM_PAINTS,
  VEHICLE_SPECS,
  VEHICLE_UNDERGLOWS,
  VehicleCustomConfig,
  VehicleType,
  WeatherMode,
} from './rules';

function hash2D(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function isNearBuilding(x: number, z: number, pad: number = 1.6): boolean {
  for (const b of CITY_BUILDINGS) {
    const hw = b.width * 0.5 + pad;
    const hd = b.depth * 0.5 + pad;
    if (Math.abs(x - b.x) < hw && Math.abs(z - b.z) < hd) {
      return true;
    }
  }
  return false;
}

function isOnRoadway(x: number, z: number, pad: number = 0.8): boolean {
  if (Math.abs(x) < 7.0 + pad && Math.abs(z) < 96) return true;
  if (Math.abs(z) < 7.0 + pad && Math.abs(x) < 96) return true;
  if (Math.abs(Math.abs(x) - 32) < 5.0 + pad && Math.abs(z) < 82) return true;
  if (Math.abs(Math.abs(z) - 32) < 5.0 + pad && Math.abs(x) < 82) return true;
  if (z >= -31.5 - pad && z <= -20.5 + pad && Math.abs(x) < 70) return true;
  return false;
}

export function createAsphaltRoadTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#12161f';
  ctx.fillRect(0, 0, 512, 512);

  // Realistic dark asphalt aggregate grain
  for (let i = 0; i < 7200; i++) {
    const x = (i * 139 + (i % 17) * 29) % 512;
    const y = (i * 227 + (i % 13) * 43) % 512;
    ctx.fillStyle =
      i % 3 === 0 ? '#1a202c' : i % 3 === 1 ? '#0d1017' : '#151a24';
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle tire wear tracks along left & right lanes
  ctx.fillStyle = 'rgba(7, 10, 15, 0.34)';
  ctx.fillRect(72, 0, 46, 512);
  ctx.fillRect(148, 0, 46, 512);
  ctx.fillRect(320, 0, 46, 512);
  ctx.fillRect(396, 0, 46, 512);

  // Weathered off-white outer lane edge lines (never blinding pure white)
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(14, 0, 6, 512);
  ctx.fillRect(492, 0, 6, 512);

  // Double dashed Jakarta center divider markings (warm highway amber)
  ctx.fillStyle = '#d97706';
  for (let y = 14; y < 512; y += 128) {
    ctx.fillRect(247, y, 6, 76);
    ctx.fillRect(259, y, 6, 76);
  }

  // Subtle lane divider ticks
  ctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
  for (let y = 32; y < 512; y += 128) {
    ctx.fillRect(130, y, 4, 46);
    ctx.fillRect(378, y, 4, 46);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export interface SidewalkRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function createSidewalkTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#262d3a';
  ctx.fillRect(0, 0, 256, 256);

  // Concrete paving slab grid with subtle weathering variation
  const tile = 32;
  for (let y = 0; y < 256; y += tile) {
    for (let x = 0; x < 256; x += tile) {
      const shade = 38 + ((x * 7 + y * 13) % 14);
      ctx.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 12})`;
      ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
      if ((x + y) % 96 === 0) {
        ctx.fillStyle = 'rgba(10, 15, 25, 0.28)';
        ctx.fillRect(x + 3, y + 3, tile - 8, tile - 8);
      }
    }
  }

  // Hairline concrete surface cracks baked into base slab tiles
  ctx.strokeStyle = 'rgba(10, 14, 20, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(42, 18);
  ctx.lineTo(54, 38);
  ctx.lineTo(48, 56);
  ctx.moveTo(160, 140);
  ctx.lineTo(176, 154);
  ctx.lineTo(192, 148);
  ctx.stroke();

  // Jakarta Sudirman-style tactile yellow guiding band
  ctx.fillStyle = '#b45309';
  ctx.fillRect(28, 0, 12, 256);
  ctx.fillStyle = '#d97706';
  for (let y = 4; y < 256; y += 16) {
    ctx.fillRect(30, y, 8, 10);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createGantrySignTexture(
  topText: string,
  bottomText: string
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, '#064e3b');
  grad.addColorStop(1, '#047857');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 160);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 7;
  ctx.strokeRect(8, 8, 496, 144);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.25)';
  ctx.fillRect(18, 84, 476, 2);

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(topText, 256, 50);

  ctx.fillStyle = '#fde047';
  ctx.font = '800 26px sans-serif';
  ctx.fillText(bottomText, 256, 118);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createBuildingFacadeTextures(
  primaryHex: number,
  accentHex: number,
  style: BuildingFootprint['style'],
  maxAnisotropy: number
): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = 512;
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = size;
  colorCanvas.height = size;
  const cCtx = colorCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const baseColor = new THREE.Color(primaryHex).multiplyScalar(0.68);
  const darkMullion = baseColor.clone().multiplyScalar(0.45);
  const spandrelColor = baseColor.clone().multiplyScalar(0.62);
  const accentColor = new THREE.Color(accentHex).multiplyScalar(0.78);

  cCtx.fillStyle = '#' + baseColor.getHexString();
  cCtx.fillRect(0, 0, size, size);

  // Base structure is matte aluminum/concrete (roughness ~0.85 -> grayscale 218)
  rCtx.fillStyle = 'rgb(218, 218, 218)';
  rCtx.fillRect(0, 0, size, size);

  const rows = style === 'skyscraper' ? 12 : style === 'colonial' ? 5 : 6;
  const cols = style === 'skyscraper' ? 8 : style === 'colonial' ? 6 : 6;
  const padX = 16;
  const padY = 18;
  const cellW = (size - padX * 2) / cols;
  const cellH = (size - padY * 2) / rows;

  // Horizontal concrete/aluminum floor spandrel bands
  for (let r = 0; r <= rows; r++) {
    const sy = padY + r * cellH - 4;
    cCtx.fillStyle = '#' + spandrelColor.getHexString();
    cCtx.fillRect(0, sy, size, 9);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const wx = padX + c * cellW + 5;
      const wy = padY + r * cellH + 5;
      const ww = cellW - 10;
      const wh = cellH - 10;

      // Dark outer mullion frame
      cCtx.fillStyle = '#' + darkMullion.getHexString();
      cCtx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

      const h = hash2D(r + primaryHex * 0.001, c + accentHex * 0.001);
      const isWarmLit = h > 0.74;
      const isCoolLit = h > 0.46 && h <= 0.74;

      if (style === 'skyscraper') {
        const grad = cCtx.createLinearGradient(wx, wy, wx, wy + wh);
        if (isWarmLit) {
          grad.addColorStop(0, '#92400e');
          grad.addColorStop(0.5, '#d97706');
          grad.addColorStop(1, '#451a03');
        } else if (isCoolLit) {
          grad.addColorStop(0, '#1e3a5f');
          grad.addColorStop(1, '#0f172a');
        } else {
          grad.addColorStop(0, '#0f172a');
          grad.addColorStop(1, '#070b14');
        }
        cCtx.fillStyle = grad;
        cCtx.fillRect(wx, wy, ww, wh);

        // Subtle interior ceiling light strip inside lit offices
        if (isWarmLit) {
          cCtx.fillStyle = 'rgba(253, 224, 71, 0.55)';
          cCtx.fillRect(wx + 3, wy + 3, ww - 6, 3);
        } else if (isCoolLit) {
          cCtx.fillStyle = 'rgba(125, 211, 252, 0.35)';
          cCtx.fillRect(wx + 3, wy + 3, ww - 6, 2);
        }

        // Glass pane roughness ~0.42 (prevents blinding mirror reflections)
        rCtx.fillStyle = 'rgb(108, 108, 108)';
        rCtx.fillRect(wx, wy, ww, wh);

        // Center glazing mullion bar
        cCtx.fillStyle = '#' + darkMullion.getHexString();
        cCtx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      } else if (style === 'colonial') {
        cCtx.fillStyle = isWarmLit ? '#b45309' : '#111827';
        cCtx.fillRect(wx + 3, wy + wh * 0.25, ww - 6, wh * 0.72);
        cCtx.beginPath();
        cCtx.arc(wx + ww * 0.5, wy + wh * 0.28, (ww - 6) * 0.5, Math.PI, 0);
        cCtx.fill();
        rCtx.fillStyle = 'rgb(120, 120, 120)';
        rCtx.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
      } else if (style === 'port_crane') {
        cCtx.fillStyle = r % 2 === 0 ? '#' + accentColor.getHexString() : '#111827';
        cCtx.fillRect(wx, wy, ww, wh);
        rCtx.fillStyle = 'rgb(165, 165, 165)';
        rCtx.fillRect(wx, wy, ww, wh);
      } else {
        // Pasar / Ruko windows with dark glass & subtle warm interior depth
        cCtx.fillStyle = isWarmLit ? '#92400e' : isCoolLit ? '#1e3a5f' : '#0b1120';
        cCtx.fillRect(wx, wy, ww, wh);
        if (isWarmLit) {
          cCtx.fillStyle = '#f59e0b';
          cCtx.fillRect(wx + 4, wy + 4, ww - 8, 4);
        }
        if (r === rows - 1) {
          cCtx.fillStyle = '#' + accentColor.getHexString();
          cCtx.fillRect(wx, wy, ww, wh * 0.28);
        }
        rCtx.fillStyle = 'rgb(125, 125, 125)';
        rCtx.fillRect(wx, wy, ww, wh);
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.anisotropy = maxAnisotropy;

  return { map, roughnessMap };
}

export function createBuildingFacadeTexture(
  primaryHex: number,
  accentHex: number,
  style: BuildingFootprint['style'],
  maxAnisotropy: number
): THREE.CanvasTexture {
  return createBuildingFacadeTextures(
    primaryHex,
    accentHex,
    style,
    maxAnisotropy
  ).map;
}

export function createContactShadowDisc(radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 20);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x040609,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(geo, mat);
  disc.position.y = 0.02;
  return disc;
}

/**
 * Builds Monumen Nasional (Monas) with detailed marble plaza steps, relief pedestal,
 * sculpted Cawan goblet, tapered obelisk, observation deck, and glowing Lidah Api.
 */
export function buildMonasLandmark(): THREE.Group {
  const group = new THREE.Group();

  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.42,
    metalness: 0.08,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    roughness: 0.72,
    metalness: 0.15,
  });
  const goldFlameMat = new THREE.MeshPhysicalMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.85,
    metalness: 0.92,
    roughness: 0.14,
    clearcoat: 1.0,
  });

  // 1. Stepped marble base terraces
  const lowerStep = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.7, 12.6), darkStoneMat);
  lowerStep.position.y = 0.35;
  lowerStep.receiveShadow = true;
  lowerStep.castShadow = true;
  group.add(lowerStep);

  const upperStep = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.9, 10.8), marbleMat);
  upperStep.position.y = 1.15;
  upperStep.castShadow = true;
  upperStep.receiveShadow = true;
  group.add(upperStep);

  // 2. Cawan (Goblet cup) via LatheGeometry
  const cawanPoints = [
    new THREE.Vector2(3.1, 1.55),
    new THREE.Vector2(4.9, 3.8),
    new THREE.Vector2(5.6, 5.4),
    new THREE.Vector2(2.6, 5.9),
  ];
  const cawanGeo = new THREE.LatheGeometry(cawanPoints, 8);
  const cawanMesh = new THREE.Mesh(cawanGeo, marbleMat);
  cawanMesh.rotation.y = Math.PI / 8;
  cawanMesh.castShadow = true;
  cawanMesh.receiveShadow = true;
  group.add(cawanMesh);

  // 3. Tall tapered obelisk shaft
  const shaftGeo = new THREE.CylinderGeometry(0.95, 1.55, 25, 8);
  const shaftMesh = new THREE.Mesh(shaftGeo, marbleMat);
  shaftMesh.position.y = 18.0;
  shaftMesh.castShadow = true;
  group.add(shaftMesh);

  // 4. Pelataran Puncak (Observation deck + railing)
  const deckGeo = new THREE.BoxGeometry(3.0, 0.9, 3.0);
  const deckMesh = new THREE.Mesh(deckGeo, darkStoneMat);
  deckMesh.position.y = 30.8;
  group.add(deckMesh);

  // 5. Lidah Api Kemerdekaan (Gold Flame)
  const flamePoints = [
    new THREE.Vector2(0.1, 0),
    new THREE.Vector2(0.85, 1.2),
    new THREE.Vector2(1.05, 2.3),
    new THREE.Vector2(0.55, 3.6),
    new THREE.Vector2(0.02, 4.6),
  ];
  const flameGeo = new THREE.LatheGeometry(flamePoints, 12);
  const flameMesh = new THREE.Mesh(flameGeo, goldFlameMat);
  flameMesh.position.y = 31.3;
  group.add(flameMesh);

  // 6. Ornamental corner fountain bollards
  const pillarGeo = new THREE.CylinderGeometry(0.35, 0.45, 2.4, 8);
  for (const [ox, oz] of [
    [-5.1, -5.1],
    [5.1, -5.1],
    [-5.1, 5.1],
    [5.1, 5.1],
  ]) {
    const p = new THREE.Mesh(pillarGeo, goldFlameMat);
    p.position.set(ox, 1.2, oz);
    group.add(p);
  }

  // 7. Merah-Putih Indonesian Flagpoles flanking Southern Plaza Entrance
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.85,
    roughness: 0.2,
  });
  const redFlagMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.65,
  });
  const whiteFlagMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.65,
  });

  for (const fx of [-7.5, 7.5]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 8.5, 8),
      poleMat
    );
    pole.position.set(fx, 4.25, 9.5);
    group.add(pole);

    const flagRed = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.48, 0.06),
      redFlagMat
    );
    flagRed.position.set(fx + 0.82, 8.1, 9.5);
    group.add(flagRed);

    const flagWhite = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.48, 0.06),
      whiteFlagMat
    );
    flagWhite.position.set(fx + 0.82, 7.62, 9.5);
    group.add(flagWhite);
  }

  return group;
}

/**
 * Builds an iconic Jakarta Warung Pecel Lele & Street Stall prop group.
 */
export function buildWarungStall(
  x: number,
  z: number,
  rotY: number
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0.12, z);
  group.rotation.y = rotY;

  const tarpMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.72,
  });
  const bannerMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.55,
    roughness: 0.4,
  });
  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.85,
  });
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.7,
    roughness: 0.4,
  });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.4), woodMat);
  counter.position.set(0, 0.45, 0);
  counter.castShadow = true;
  group.add(counter);

  for (const px of [-1.2, 1.2]) {
    for (const pz of [-0.6, 0.6]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.2, 6),
        poleMat
      );
      post.position.set(px, 1.1, pz);
      group.add(post);
    }
  }

  const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.1, 4), tarpMat);
  canopy.rotation.y = Math.PI / 4;
  canopy.position.set(0, 2.55, 0);
  canopy.castShadow = true;
  group.add(canopy);

  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.42, 0.08), bannerMat);
  sign.position.set(0, 1.88, 0.95);
  group.add(sign);

  return group;
}

/**
 * Builds a multi-tiered architectural Jakarta building with lobby arcade podium,
 * stepped tower massing, vertical facade mullions, illuminated crown, and rooftop HVAC/helipads.
 */
export function buildJakartaBuilding(
  b: BuildingFootprint,
  maxAnisotropy: number
): THREE.Group {
  if (b.style === 'monas') {
    const monas = buildMonasLandmark();
    monas.position.set(b.x, 0, b.z);
    return monas;
  }

  const group = new THREE.Group();
  group.position.set(b.x, 0, b.z);

  const { map: facadeTex, roughnessMap } = createBuildingFacadeTextures(
    b.primaryColor,
    b.accentColor,
    b.style,
    maxAnisotropy
  );

  // 1. Architectural Ground Lobby Podium + Dark Glazed Storefront Colonnade
  const podiumMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    roughness: 0.76,
    metalness: 0.18,
    envMapIntensity: 0.25,
  });
  const lobbyGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0xd97706,
    emissiveIntensity: 0.08,
    roughness: 0.28,
    metalness: 0.45,
    envMapIntensity: 0.35,
  });
  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.52,
    metalness: 0.55,
    envMapIntensity: 0.3,
  });

  const podiumH = b.style === 'skyscraper' ? 3.8 : 2.8;
  const podium = new THREE.Mesh(
    new THREE.BoxGeometry(b.width, podiumH, b.depth),
    podiumMat
  );
  podium.position.y = podiumH * 0.5;
  podium.castShadow = true;
  podium.receiveShadow = true;
  group.add(podium);

  // Recessed dark glass ground storefront band (no blinding yellow glow)
  const shopBand = new THREE.Mesh(
    new THREE.BoxGeometry(b.width * 0.92, podiumH * 0.56, b.depth * 0.96),
    lobbyGlassMat
  );
  shopBand.position.y = podiumH * 0.44;
  group.add(shopBand);

  // Corner & entrance structural colonnade pillars
  for (const px of [-b.width * 0.46, 0, b.width * 0.46]) {
    for (const pz of [-b.depth * 0.48, b.depth * 0.48]) {
      const col = new THREE.Mesh(
        new THREE.BoxGeometry(0.48, podiumH, 0.48),
        mullionMat
      );
      col.position.set(px, podiumH * 0.5, pz);
      group.add(col);
    }
  }

  // Entrance canopy overhang
  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(b.width * 0.54, 0.26, b.depth * 1.08),
    mullionMat
  );
  canopy.position.y = podiumH * 0.86;
  canopy.castShadow = true;
  group.add(canopy);

  // 2. Main Structural Tower (with 512px Facade + Calibrated Roughness & EnvMap)
  const totalBodyH = Math.max(4, b.height - podiumH);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: facadeTex,
    roughnessMap,
    roughness: b.style === 'skyscraper' ? 0.64 : 0.82,
    metalness: b.style === 'skyscraper' ? 0.32 : 0.12,
    envMapIntensity: 0.3,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: b.accentColor,
    emissive: b.accentColor,
    emissiveIntensity: 0.28,
    roughness: 0.42,
    metalness: 0.45,
    envMapIntensity: 0.3,
  });

  if (b.style === 'skyscraper') {
    const lowerH = totalBodyH * 0.68;
    const upperH = totalBodyH - lowerH;

    const lowerShaft = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.9, lowerH, b.depth * 0.9),
      bodyMat
    );
    lowerShaft.position.y = podiumH + lowerH * 0.5;
    lowerShaft.castShadow = true;
    lowerShaft.receiveShadow = true;
    group.add(lowerShaft);

    // Architectural stepped upper setback tier
    const upperShaft = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.72, upperH, b.depth * 0.72),
      bodyMat
    );
    upperShaft.position.y = podiumH + lowerH + upperH * 0.5;
    upperShaft.castShadow = true;
    upperShaft.receiveShadow = true;
    group.add(upperShaft);

    // Vertical structural facade ribs/fins on lower shaft
    for (const fx of [-b.width * 0.28, b.width * 0.28]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, lowerH + 0.6, b.depth * 0.93),
        mullionMat
      );
      fin.position.set(fx, podiumH + lowerH * 0.5, 0);
      group.add(fin);
    }

    // Illuminated architectural crown trim + Wisma spire + rooftop HVAC pod
    const crownBand = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.75, 0.65, b.depth * 0.75),
      accentMat
    );
    crownBand.position.y = b.height + 0.32;
    group.add(crownBand);

    const roofPenthouse = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.38, 2.8, b.depth * 0.38),
      mullionMat
    );
    roofPenthouse.position.y = b.height + 1.8;
    group.add(roofPenthouse);

    const spire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.22, 6.2, 8),
      accentMat
    );
    spire.position.y = b.height + 6.2;
    group.add(spire);
  } else {
    const bodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.92, totalBodyH, b.depth * 0.92),
      bodyMat
    );
    bodyMesh.position.y = podiumH + totalBodyH * 0.5;
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Rooftop parapet ledge & HVAC unit
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.95, 0.45, b.depth * 0.95),
      mullionMat
    );
    parapet.position.y = b.height + 0.22;
    group.add(parapet);

    const hvac = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.26, 1.1, b.depth * 0.24),
      mullionMat
    );
    hvac.position.set(b.width * 0.16, b.height + 0.65, -b.depth * 0.14);
    group.add(hvac);

    if (b.style === 'colonial') {
      const cornice = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.98, 0.65, b.depth * 0.98),
        podiumMat
      );
      cornice.position.y = b.height + 0.32;
      group.add(cornice);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(b.width * 0.58, 3.8, 4),
        new THREE.MeshStandardMaterial({
          color: 0x7c2d12,
          roughness: 0.78,
          envMapIntensity: 0.25,
        })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.y = b.height + 2.4;
      roof.castShadow = true;
      group.add(roof);
    } else if (b.style === 'port_crane') {
      const craneBeam = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 1.15, 1.2, 2.2),
        accentMat
      );
      craneBeam.position.set(0, b.height + 3.5, 0);
      group.add(craneBeam);

      for (const lx of [-b.width * 0.4, b.width * 0.4]) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(1.1, 4.5, 1.1),
          mullionMat
        );
        leg.position.set(lx, b.height + 1.5, 0);
        group.add(leg);
      }
    } else {
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.98, 0.48, b.depth * 0.98),
        accentMat
      );
      awning.position.y = podiumH + 0.24;
      group.add(awning);
    }
  }

  return group;
}

/**
 * Builds the complete Urban Jakarta Streetscape:
 * 1. Raised Sidewalks (Trotoar +0.12m) & Yellow-Black Curbs flanking major boulevards
 * 2. Crisp Zebra Crosswalks & Intersection Stop Lines (InstancedMesh)
 * 3. Modern Dual-Arm Jakarta PJU Streetlights + Glowing Lamp Heads + Light Pools (InstancedMesh)
 * 4. 3-Aspect Intersection Traffic Signals
 * 5. Green Indonesian Arterial Overhead Gantry Signs
 * 6. Two Modern Halte TransNabilo Busway Shelters
 * 7. Multi-Cluster Tropical Angsana & Royal Palm Trees (InstancedMesh)
 */
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

  // 1. Raised Sidewalks flanking N-S Sudirman Boulevard (outside road [-7, 7])
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

  // Raised Sidewalks flanking E-W Boulevard (avoiding Monas & buildings)
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

  // Secondary ring road sidewalks along X = ±32 and Z = ±32
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

  // 3. Modern Jakarta PJU Streetlights (InstancedMesh Poles + Arms + Glowing Heads + Light Pools)
  const polePositions: { x: number; z: number; rotY: number }[] = [];
  for (let z = -76; z <= 76; z += 18) {
    if (Math.abs(z) < 21 || Math.abs(z - -26) < 7 || Math.abs(Math.abs(z) - 32) < 6) {
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

  // 4. Intersection 3-Aspect Traffic Signals (8 key corners)
  const signalCorners: { x: number; z: number; rotY: number; green: boolean }[] = [
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

  // 5. Green Indonesian Arterial Overhead Gantry Signs (Rambu Tol / Sudirman)
  const gantrySpecs = [
    { x: 0, z: -50, rotY: 0, top: 'SUDIRMAN · SCBD · MONAS', bot: 'JALUR PROTOKOL  ↑' },
    { x: 0, z: 42, rotY: Math.PI, top: 'BLOK M · SENAYAN GBK', bot: 'PUSAT KOTA  ↑' },
    { x: -42, z: 0, rotY: Math.PI / 2, top: 'TANAH ABANG ←  MONAS ↑', bot: 'KOTA TUA · PRIOK →' },
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

  // 6. Modern Halte TransNabilo (Busway Shelters)
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

  // 7. Multi-Cluster Tropical Angsana Shade Trees & Royal Palms (InstancedMesh)
  const treeCoords: { x: number; z: number; scale: number; isPalm: boolean }[] = [];
  // Inner Monas Park Ring
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
  // Boulevard & District Shade Trees
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
    if (isOnRoadway(tx, tz, 1.4) || isNearBuilding(tx, tz, 2.4)) continue;
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

  // Secondary fork limbs for natural branching silhouette
  const branchGeo = new THREE.CylinderGeometry(0.08, 0.15, 1.6, 6);
  branchGeo.rotateZ(0.52);
  branchGeo.translate(-0.42, 3.1, 0);
  const branchInst = new THREE.InstancedMesh(branchGeo, trunkMat, tCount);

  // 3 distinct organic foliage sub-crowns per tree (wide spreading tropical canopy, never an ice-cream cone)
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

    // Rich deep tropical rainforest/emerald greens (never pale pastel mint)
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
  if (crownCenterInst.instanceColor) crownCenterInst.instanceColor.needsUpdate = true;
  if (crownSideAInst.instanceColor) crownSideAInst.instanceColor.needsUpdate = true;
  if (crownSideBInst.instanceColor) crownSideBInst.instanceColor.needsUpdate = true;
  group.add(
    trunkInst,
    branchInst,
    crownCenterInst,
    crownSideAInst,
    crownSideBInst
  );

  const setWeatherTransition = (nightFactor: number, _wetnessFactor: number) => {
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

/**
 * Helper: Creates a multi-part automotive wheel (dark rubber tire + metallic alloy rim + hub cap).
 */
function createWheelAssembly(
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material
): THREE.Group {
  const wGroup = new THREE.Group();

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wGroup.add(tire);

  const rimGeo = new THREE.CylinderGeometry(
    radius * 0.62,
    radius * 0.62,
    width + 0.02,
    10
  );
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wGroup.add(rim);

  const hubGeo = new THREE.CylinderGeometry(
    radius * 0.22,
    radius * 0.22,
    width + 0.04,
    8
  );
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, tireMat);
  wGroup.add(hub);

  return wGroup;
}

/**
 * Helper: Extrudes a 2D side-profile (Z horizontal, Y vertical) centered along X with smooth bevels.
 */
function extrudeSideProfile(
  pts: [number, number][],
  width: number,
  bevelSize: number = 0.07
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  shape.closePath();

  const innerDepth = Math.max(0.05, width - bevelSize * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerDepth,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 6,
  });
  // Extrude is along +Z from 2D (X->worldZ, Y->worldY). Rotate +PI/2 around Y so 2D X maps to +Z (forward)!
  geo.translate(0, 0, -innerDepth * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds sculpted non-boxy Indonesian Vehicles using beveled ExtrudeGeometry side silhouettes,
 * sloped glass cabins, side mirrors, alloy wheels, and bright emissive LED light bars.
 */
export function buildIndonesianVehicleMesh(type: VehicleType): THREE.Group {
  const spec = VEHICLE_SPECS[type];
  const group = new THREE.Group();

  group.add(createContactShadowDisc(spec.radius * 1.05));

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: spec.colorHex,
    roughness: 0.34,
    metalness: 0.36,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.38,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.accentHex,
    roughness: 0.55,
    metalness: 0.3,
    envMapIntensity: 0.3,
  });
  const darkGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.65,
    metalness: 0.35,
    envMapIntensity: 0.2,
  });
  const underglowGeo = new THREE.RingGeometry(
    spec.radius * 0.55,
    spec.radius * 1.15,
    24
  );
  underglowGeo.rotateX(-Math.PI / 2);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.position.y = 0.045;
  group.add(underglowMesh);

  group.userData.bodyMat = bodyMat;
  group.userData.trimMat = trimMat;
  group.userData.underglowMat = underglowMat;

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x070d19,
    roughness: 0.16,
    metalness: 0.48,
    clearcoat: 0.85,
    envMapIntensity: 0.42,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x14161b,
    roughness: 0.88,
    metalness: 0.06,
    envMapIntensity: 0.15,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.72,
    envMapIntensity: 0.4,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.75,
    roughness: 0.25,
  });

  if (type === 'bajaj') {
    const hullGeo = extrudeSideProfile(
      [
        [-1.1, 0.28],
        [1.12, 0.28],
        [1.18, 0.65],
        [0.86, 0.98],
        [0.42, 0.98],
        [0.35, 0.45],
        [-0.45, 0.45],
        [-1.08, 0.95],
      ],
      1.42,
      0.06
    );
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.castShadow = true;
    group.add(hull);

    const canopyGeo = extrudeSideProfile(
      [
        [-1.02, 0.95],
        [-0.95, 1.62],
        [0.45, 1.68],
        [0.62, 1.48],
        [-0.85, 1.42],
      ],
      1.36,
      0.05
    );
    const canopy = new THREE.Mesh(
      canopyGeo,
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.85,
        envMapIntensity: 0.2,
      })
    );
    group.add(canopy);

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.56, 0.08),
      glassMat
    );
    glass.position.set(0, 1.24, 0.62);
    glass.rotation.x = -0.32;
    group.add(glass);

    const fw = createWheelAssembly(0.34, 0.22, tireMat, alloyMat);
    fw.position.set(0, 0.34, 0.92);
    group.add(fw);
    for (const sx of [-0.72, 0.72]) {
      const rw = createWheelAssembly(0.36, 0.24, tireMat, alloyMat);
      rw.position.set(sx, 0.36, -0.78);
      group.add(rw);
    }

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      headlightMat
    );
    lamp.position.set(0, 0.76, 1.2);
    group.add(lamp);
  } else if (type === 'ojek') {
    const fairingGeo = extrudeSideProfile(
      [
        [-0.88, 0.48],
        [0.75, 0.48],
        [0.9, 0.88],
        [0.52, 1.18],
        [0.18, 0.86],
        [-0.35, 0.88],
        [-0.86, 0.95],
      ],
      0.46,
      0.06
    );
    const fairing = new THREE.Mesh(fairingGeo, bodyMat);
    fairing.castShadow = true;
    group.add(fairing);

    const seat = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.58, 4, 8),
      trimMat
    );
    seat.rotation.x = Math.PI / 2;
    seat.position.set(0, 0.92, -0.2);
    group.add(seat);

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.56), trimMat);
    box.position.set(0, 1.22, -0.72);
    group.add(box);

    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.88, 8),
      alloyMat
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.24, 0.56);
    group.add(bar);

    for (const sz of [-0.66, 0.72]) {
      const w = createWheelAssembly(0.34, 0.16, tireMat, alloyMat);
      w.position.set(0, 0.34, sz);
      group.add(w);
    }

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.16, 0.1),
      headlightMat
    );
    lamp.position.set(0, 1.04, 0.84);
    group.add(lamp);
  } else if (type === 'angkot') {
    const bodyGeo = extrudeSideProfile(
      [
        [-1.82, 0.36],
        [1.82, 0.36],
        [1.86, 0.98],
        [1.6, 1.65],
        [-1.72, 1.68],
      ],
      1.76,
      0.09
    );
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    const winBand = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.48, 3.15),
      glassMat
    );
    winBand.position.set(0, 1.32, 0.04);
    group.add(winBand);

    const roofRack = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.12, 2.4),
      trimMat
    );
    roofRack.position.set(0, 1.78, -0.15);
    group.add(roofRack);

    const frontGrille = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.28, 0.08),
      darkGrilleMat
    );
    frontGrille.position.set(0, 0.66, 1.88);
    group.add(frontGrille);

    for (const sx of [-0.88, 0.88]) {
      for (const sz of [-1.15, 1.15]) {
        const w = createWheelAssembly(0.36, 0.24, tireMat, alloyMat);
        w.position.set(sx, 0.36, sz);
        group.add(w);
      }
    }
    for (const sx of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.16, 0.1),
        headlightMat
      );
      hl.position.set(sx, 0.68, 1.88);
      group.add(hl);
    }
  } else if (type === 'heli') {
    for (const sx of [-0.95, 0.95]) {
      const skid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8),
        alloyMat
      );
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, 0.12, 0.1);
      group.add(skid);

      for (const sz of [-0.6, 0.7]) {
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.72, 8),
          alloyMat
        );
        strut.position.set(sx * 0.88, 0.44, sz);
        strut.rotation.z = sx < 0 ? -0.25 : 0.25;
        group.add(strut);
      }
    }

    const cabinGeo = extrudeSideProfile(
      [
        [-1.35, 0.65],
        [1.15, 0.62],
        [2.05, 0.92],
        [1.75, 1.48],
        [0.85, 1.85],
        [-0.95, 1.85],
        [-1.45, 1.45],
      ],
      1.78,
      0.16
    );
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.castShadow = true;
    group.add(cabin);

    const canopyGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 14, 10),
      glassMat
    );
    canopyGlass.scale.set(0.95, 0.68, 1.32);
    canopyGlass.position.set(0, 1.24, 1.15);
    group.add(canopyGlass);

    const boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.34, 3.4, 10),
      trimMat
    );
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 1.42, -2.8);
    group.add(boom);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.8), bodyMat);
    fin.position.set(0, 1.82, -4.2);
    fin.rotation.x = -0.25;
    group.add(fin);

    const rotorGroup = new THREE.Group();
    rotorGroup.name = 'heliRotor';
    rotorGroup.position.set(0, 2.08, 0.1);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.26, 10),
      alloyMat
    );
    rotorGroup.add(hub);
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.05, 0.28), alloyMat);
    const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 7.0), alloyMat);
    rotorGroup.add(blade1, blade2);
    group.add(rotorGroup);
  } else if (type === 'metromini' || type === 'transjakarta') {
    const hullGeo = extrudeSideProfile(
      [
        [-2.78, 0.42],
        [2.75, 0.42],
        [2.82, 1.35],
        [2.56, 2.38],
        [-2.72, 2.42],
      ],
      2.32,
      0.1
    );
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.castShadow = true;
    group.add(hull);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.42, 5.45),
      trimMat
    );
    stripe.position.set(0, 1.12, 0);
    group.add(stripe);

    const win = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 0.68, 4.9),
      glassMat
    );
    win.position.set(0, 1.78, 0.08);
    group.add(win);

    if (type === 'transjakarta') {
      const acPod = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.28, 3.2),
        alloyMat
      );
      acPod.position.set(0, 2.58, -0.15);
      group.add(acPod);
    }

    for (const sx of [-1.14, 1.14]) {
      for (const sz of [-1.75, 1.75]) {
        const w = createWheelAssembly(0.46, 0.3, tireMat, alloyMat);
        w.position.set(sx, 0.46, sz);
        group.add(w);
      }
    }

    for (const sx of [-0.78, 0.78]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.18, 0.1),
        headlightMat
      );
      hl.position.set(sx, 0.78, 2.84);
      group.add(hl);

      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.22, 0.1),
        taillightMat
      );
      tl.position.set(sx, 0.84, -2.84);
      group.add(tl);
    }
  } else if (type === 'barracuda') {
    const hullGeo = extrudeSideProfile(
      [
        [-2.25, 0.48],
        [2.28, 0.48],
        [2.4, 0.92],
        [1.92, 1.38],
        [1.38, 1.88],
        [-1.78, 1.92],
        [-2.25, 1.32],
      ],
      2.18,
      0.08
    );
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.castShadow = true;
    group.add(hull);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.3, 0.16),
      glassMat
    );
    visor.position.set(0, 1.62, 1.62);
    visor.rotation.x = -0.35;
    group.add(visor);

    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.68, 0.45, 8),
      trimMat
    );
    turret.position.set(0, 2.15, -0.2);
    group.add(turret);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 1.25, 8),
      alloyMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 2.18, 0.65);
    group.add(barrel);

    const bullbar = new THREE.Mesh(
      new THREE.BoxGeometry(2.28, 0.48, 0.24),
      trimMat
    );
    bullbar.position.set(0, 0.72, 2.42);
    group.add(bullbar);

    for (const sx of [-1.12, 1.12]) {
      for (const sz of [-1.5, 0, 1.5]) {
        const w = createWheelAssembly(0.48, 0.34, tireMat, alloyMat);
        w.position.set(sx, 0.48, sz);
        group.add(w);
      }
    }
  } else if (type === 'supercar') {
    const bodyGeo = extrudeSideProfile(
      [
        [-2.22, 0.26],
        [2.25, 0.24],
        [2.3, 0.48],
        [1.55, 0.74],
        [0.85, 0.82],
        [-1.45, 0.84],
        [-2.22, 0.74],
      ],
      2.06,
      0.08
    );
    const chassis = new THREE.Mesh(bodyGeo, bodyMat);
    chassis.castShadow = true;
    group.add(chassis);

    const canopyGeo = extrudeSideProfile(
      [
        [-1.25, 0.78],
        [0.95, 0.76],
        [0.32, 1.16],
        [-0.58, 1.16],
      ],
      1.48,
      0.08
    );
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    group.add(canopy);

    // Body-colored aero roof panel above glass cabin
    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.06, 0.92),
      bodyMat
    );
    roofCap.position.set(0, 1.17, -0.14);
    group.add(roofCap);

    // Front splitter & air intake grille
    const frontSplitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.16, 0.14),
      darkGrilleMat
    );
    frontSplitter.position.set(0, 0.34, 2.26);
    group.add(frontSplitter);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.05, 3.8),
      trimMat
    );
    stripe.position.set(0, 0.84, 0.12);
    group.add(stripe);

    for (const sx of [-0.68, 0.68]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.36, 0.26),
        trimMat
      );
      strut.position.set(sx, 0.94, -1.96);
      group.add(strut);
    }
    const gtWing = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.08, 0.42),
      trimMat
    );
    gtWing.position.set(0, 1.14, -2.04);
    group.add(gtWing);

    for (const sx of [-1.02, 1.02]) {
      for (const sz of [-1.38, 1.38]) {
        const w = createWheelAssembly(0.4, 0.28, tireMat, alloyMat);
        w.position.set(sx, 0.4, sz);
        group.add(w);
      }
    }

    for (const sx of [-0.72, 0.72]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.1, 0.12),
        headlightMat
      );
      hl.position.set(sx, 0.52, 2.26);
      group.add(hl);
    }
    const rearBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.12, 0.1),
      taillightMat
    );
    rearBar.position.set(0, 0.62, -2.26);
    group.add(rearBar);
  } else if (type === 'vtol_jet') {
    const fuseGeo = extrudeSideProfile(
      [
        [-2.7, 0.74],
        [2.2, 0.72],
        [3.75, 0.88],
        [2.25, 1.18],
        [-2.65, 1.24],
      ],
      1.36,
      0.12
    );
    const fuselage = new THREE.Mesh(fuseGeo, bodyMat);
    fuselage.castShadow = true;
    group.add(fuselage);

    const canopy = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 1.35, 6, 12),
      glassMat
    );
    canopy.rotation.x = Math.PI / 2;
    canopy.scale.set(1.0, 1.0, 0.72);
    canopy.position.set(0, 1.24, 1.15);
    group.add(canopy);

    // Swept Delta Wing via Shape + ExtrudeGeometry (XZ horizontal plane)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 1.15);
    wingShape.lineTo(2.9, -1.25);
    wingShape.lineTo(2.9, -1.65);
    wingShape.lineTo(0.4, -1.35);
    wingShape.lineTo(-0.4, -1.35);
    wingShape.lineTo(-2.9, -1.65);
    wingShape.lineTo(-2.9, -1.25);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);
    const mainWing = new THREE.Mesh(wingGeo, bodyMat);
    mainWing.position.set(0, 0.98, 0.15);
    mainWing.castShadow = true;
    group.add(mainWing);

    for (const sx of [-0.72, 0.72]) {
      const tailFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.05, 1.3),
        trimMat
      );
      tailFin.position.set(sx, 1.56, -2.0);
      tailFin.rotation.z = sx < 0 ? 0.28 : -0.28;
      tailFin.rotation.x = -0.25;
      group.add(tailFin);
    }

    const afterburnerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const sx of [-0.4, 0.4]) {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.3, 0.45, 12),
        afterburnerMat
      );
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(sx, 0.94, -2.8);
      group.add(nozzle);
    }

    const vtolRotorGroup = new THREE.Group();
    vtolRotorGroup.position.set(0, 1.06, -0.35);
    const vtolRing = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.92, 16),
      afterburnerMat
    );
    vtolRing.rotation.x = -Math.PI / 2;
    vtolRotorGroup.add(vtolRing);
    group.add(vtolRotorGroup);
    group.userData.mainRotor = vtolRotorGroup;
  } else {
    // Sleek Sedan Sport or Patroli Polisi
    const chassisGeo = extrudeSideProfile(
      [
        [-2.02, 0.3],
        [2.04, 0.3],
        [2.08, 0.68],
        [1.82, 0.88],
        [1.02, 0.95],
        [-1.65, 0.96],
        [-2.04, 0.86],
      ],
      1.86,
      0.08
    );
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.castShadow = true;
    group.add(chassis);

    const cabinGeo = extrudeSideProfile(
      [
        [-1.35, 0.9],
        [0.88, 0.9],
        [0.32, 1.44],
        [-0.78, 1.44],
      ],
      1.54,
      0.08
    );
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    group.add(cabin);

    // Body-colored roof panel on top of cabin so it looks like a real car, not a bare glass block
    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 0.07, 1.12),
      bodyMat
    );
    roofCap.position.set(0, 1.45, -0.23);
    roofCap.castShadow = true;
    group.add(roofCap);

    // Front radiator grille, lower air dam & Indonesian black license plate
    const frontGrille = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.22, 0.08),
      darkGrilleMat
    );
    frontGrille.position.set(0, 0.58, 2.08);
    group.add(frontGrille);

    const lowerDam = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.12, 0.08),
      darkGrilleMat
    );
    lowerDam.position.set(0, 0.36, 2.07);
    group.add(lowerDam);

    // Side mirrors
    for (const sx of [-0.94, 0.94]) {
      const mirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.1, 0.14),
        bodyMat
      );
      mirror.position.set(sx, 1.04, 0.56);
      group.add(mirror);
    }

    if (type === 'polisi') {
      const sirenBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, 0.12, 0.3),
        alloyMat
      );
      sirenBase.position.set(0, 1.54, -0.18);
      group.add(sirenBase);

      const redLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.14, 0.32),
        taillightMat
      );
      redLight.position.set(-0.36, 1.56, -0.18);
      group.add(redLight);

      const blueLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.14, 0.32),
        new THREE.MeshBasicMaterial({ color: 0x3b82f6 })
      );
      blueLight.position.set(0.36, 1.56, -0.18);
      group.add(blueLight);
    } else {
      const spoiler = new THREE.Mesh(
        new THREE.BoxGeometry(1.74, 0.1, 0.32),
        trimMat
      );
      spoiler.position.set(0, 1.08, -1.82);
      group.add(spoiler);
    }

    for (const sx of [-0.92, 0.92]) {
      for (const sz of [-1.24, 1.24]) {
        const w = createWheelAssembly(0.38, 0.26, tireMat, alloyMat);
        w.position.set(sx, 0.38, sz);
        group.add(w);
      }
    }

    for (const sx of [-0.66, 0.66]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.14, 0.1),
        headlightMat
      );
      hl.position.set(sx, 0.66, 2.08);
      group.add(hl);

      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.14, 0.1),
        taillightMat
      );
      tl.position.set(sx, 0.74, -2.08);
      group.add(tl);
    }
  }

  return group;
}

/**
 * Builds the Fase 5 "Rajawali-X" Autonomous Tactical Quad-Rotor Combat Drone.
 */
export function buildCombatDroneMesh(): THREE.Group {
  const group = new THREE.Group();

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.25,
    metalness: 0.75,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.8,
  });

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 1), coreMat);
  core.scale.set(1.1, 0.55, 1.35);
  group.add(core);

  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.42), goldMat);
  crest.position.set(0, 0.18, 0);
  group.add(crest);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), glowMat);
  eye.position.set(0, -0.02, 0.38);
  group.add(eye);

  for (const sx of [-0.46, 0.46]) {
    for (const sz of [-0.46, 0.46]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.52), coreMat);
      arm.position.set(sx * 0.5, 0, sz * 0.5);
      arm.rotation.y = Math.atan2(sx, sz);
      group.add(arm);

      const rotorRing = new THREE.Mesh(
        new THREE.RingGeometry(0.14, 0.21, 12),
        glowMat
      );
      rotorRing.rotation.x = -Math.PI / 2;
      rotorRing.position.set(sx, 0.04, sz);
      group.add(rotorRing);
    }
  }

  return group;
}

/**
 * Builds an articulated, stylized 3D humanoid character rig with layered street jacket,
 * inner shirt collar, utility belt, cargo trousers, sneakers/boots, sculpted head with
 * sunglasses & hair, articulated arms with hands, and multi-part firearm.
 */
export function buildCharacterRig(
  role: 'player' | EnemyBehaviorPolicy | 'civilian' | 'crew'
): {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Group;
  telegraphRing: THREE.Mesh;
  bodyMesh: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.add(createContactShadowDisc(0.68));

  let jacketColor = 0xb91c1c;
  let pantsColor = 0x1e293b;
  let accentColor = 0xd97706;
  let scaleMultiplier = 1.0;

  if (role === 'rusher') {
    jacketColor = 0x991b1b;
    pantsColor = 0x18181b;
    accentColor = 0xef4444;
  } else if (role === 'ranged_kiter') {
    jacketColor = 0x3730a3;
    pantsColor = 0x0f172a;
    accentColor = 0x0284c7;
  } else if (role === 'charger_enforcer') {
    jacketColor = 0x27272a;
    pantsColor = 0x18181b;
    accentColor = 0xea580c;
    scaleMultiplier = 1.2;
  } else if (role === 'crew') {
    jacketColor = 0x166534;
    pantsColor = 0x0f172a;
    accentColor = 0xca8a04;
  } else if (role === 'civilian') {
    jacketColor = 0x0f766e;
    pantsColor = 0x334155;
    accentColor = 0x94a3b8;
  }

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc68b59,
    roughness: 0.72,
    metalness: 0.04,
    envMapIntensity: 0.2,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: 0.64,
    metalness: 0.12,
    envMapIntensity: 0.25,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.84,
    metalness: 0.05,
    envMapIntensity: 0.18,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.7,
    envMapIntensity: 0.2,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.8,
    envMapIntensity: 0.15,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.52,
    metalness: 0.25,
    envMapIntensity: 0.25,
  });
  const darkGearMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.45,
    metalness: 0.45,
    envMapIntensity: 0.25,
  });

  group.userData.jacketMat = jacketMat;
  group.userData.pantsMat = pantsMat;
  group.userData.capMat = accentMat;

  // 1 & 2. Hip-pivoted articulated legs with knee cargo pockets & sneakers
  const legGeo = new THREE.CapsuleGeometry(0.098, 0.48, 4, 8);
  legGeo.translate(0, -0.34, 0);

  const buildShoeAndCuff = () => {
    const sub = new THREE.Group();
    const shoeUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.12, 0.3),
      shoeMat
    );
    shoeUpper.position.set(0, -0.62, 0.05);
    const shoeSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.04, 0.32),
      soleMat
    );
    shoeSole.position.set(0, -0.68, 0.05);
    sub.add(shoeUpper, shoeSole);
    return sub;
  };

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.145, 0.74, 0);
  leftLeg.castShadow = true;
  leftLeg.add(buildShoeAndCuff());
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.145, 0.74, 0);
  rightLeg.castShadow = true;
  rightLeg.add(buildShoeAndCuff());
  group.add(rightLeg);

  // 3. Sculpted Torso + Tactical Belt + Inner Shirt + Collar/Lapels
  const torsoGeo = new THREE.BoxGeometry(0.5, 0.64, 0.3);
  const bodyMesh = new THREE.Mesh(torsoGeo, jacketMat);
  bodyMesh.position.set(0, 1.12, 0);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Shoulder pads / rounded upper back
  const shoulderBar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.34, 4, 8),
    jacketMat
  );
  shoulderBar.rotation.z = Math.PI / 2;
  shoulderBar.position.set(0, 1.36, 0);
  group.add(shoulderBar);

  // Inner dark shirt V-strip & zipper line
  const innerShirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.56, 0.315),
    darkGearMat
  );
  innerShirt.position.set(0, 1.14, 0);
  group.add(innerShirt);

  // Tactical waist belt & metallic buckle
  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.09, 0.32),
    darkGearMat
  );
  belt.position.set(0, 0.78, 0);
  group.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.08, 0.33),
    accentMat
  );
  buckle.position.set(0, 0.78, 0);
  group.add(buckle);

  // Compact tactical sling pack on back
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.42, 0.14),
    darkGearMat
  );
  backpack.position.set(0, 1.15, -0.19);
  group.add(backpack);

  // Neck
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.095, 0.15, 8),
    skinMat
  );
  neck.position.set(0, 1.52, 0);
  group.add(neck);

  // 4. Sculpted Head + Sunglasses + Hair Back-Fade
  const headGeo = new THREE.SphereGeometry(0.195, 14, 12);
  headGeo.scale(0.94, 1.06, 0.98);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.72, 0);
  head.castShadow = true;
  group.add(head);

  // Wrap-around tactical sunglasses / shades on front (+Z)
  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.075, 0.12),
    darkGearMat
  );
  shades.position.set(0, 1.74, 0.14);
  group.add(shades);

  // Hair back-fade under cap
  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.198, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65),
    darkGearMat
  );
  hairBack.position.set(0, 1.73, -0.02);
  group.add(hairBack);

  // 5. Peaked Cap + Curved Visor Brim
  const capGeo = new THREE.SphereGeometry(
    0.205,
    12,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52
  );
  const cap = new THREE.Mesh(capGeo, accentMat);
  cap.position.set(0, 1.77, 0);
  group.add(cap);

  const brim = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.03, 0.18),
    accentMat
  );
  brim.position.set(0, 1.8, 0.15);
  brim.rotation.x = 0.12;
  group.add(brim);

  // 6. Left Articulated Arm + Hand
  const armGeo = new THREE.CapsuleGeometry(0.078, 0.4, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, jacketMat);
  leftArm.position.set(-0.34, 1.14, 0);
  leftArm.rotation.z = 0.09;
  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 8, 8),
    skinMat
  );
  leftHand.position.set(0, -0.26, 0);
  leftArm.add(leftHand);
  group.add(leftArm);

  // 7. Right Arm + Hand + Detailed Multi-Part Weapon Prop
  const rightArm = new THREE.Group();
  rightArm.position.set(0.34, 1.34, 0);
  const rArmMesh = new THREE.Mesh(armGeo, jacketMat);
  rArmMesh.position.set(0, -0.2, 0.11);
  rArmMesh.rotation.x = -Math.PI / 4;
  rightArm.add(rArmMesh);

  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 8, 8),
    skinMat
  );
  rightHand.position.set(0, -0.34, 0.25);
  rightArm.add(rightHand);

  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.72,
    envMapIntensity: 0.35,
  });
  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0, -0.32, 0.38);
  const gunReceiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.11, 0.38),
    gunMat
  );
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8),
    gunMat
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.025, 0.24);
  const gunGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.14, 0.08),
    darkGearMat
  );
  gunGrip.position.set(0, -0.09, -0.08);
  gunGrip.rotation.x = 0.25;
  weaponGroup.add(gunReceiver, gunBarrel, gunGrip);
  rightArm.add(weaponGroup);
  group.add(rightArm);

  // 8. Sleek, Low-Profile Tactical Foot Ring (never a giant glowing green hula-hoop)
  const ringGeo = new THREE.RingGeometry(0.42, 0.5, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color:
      role === 'crew' ? 0x22c55e : role === 'player' ? 0xfacc15 : 0xef4444,
    transparent: true,
    opacity: role === 'crew' ? 0.22 : 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(ringGeo, ringMat);
  telegraphRing.position.y = 0.035;
  group.add(telegraphRing);

  group.scale.setScalar(scaleMultiplier);

  return {
    group,
    leftLeg,
    rightLeg,
    rightArm,
    telegraphRing,
    bodyMesh,
  };
}

/**
 * Applies Los Santos Customs-style PBR Paint Finish (Metallic, Matte, Chrome)
 * and Neon Underglow LED to any player-driven vehicle mesh in real time.
 */
export function applyVehicleCustomizationToMesh(
  mesh: THREE.Group,
  customs: VehicleCustomConfig
) {
  const paintSpec =
    VEHICLE_CUSTOM_PAINTS.find((p) => p.id === customs.paintId) ||
    VEHICLE_CUSTOM_PAINTS[0];
  const glowSpec =
    VEHICLE_UNDERGLOWS.find((g) => g.id === customs.underglowId) ||
    VEHICLE_UNDERGLOWS[0];

  const bodyMat = mesh.userData.bodyMat as
    | THREE.MeshPhysicalMaterial
    | undefined;
  const trimMat = mesh.userData.trimMat as
    | THREE.MeshStandardMaterial
    | undefined;
  const underglowMat = mesh.userData.underglowMat as
    | THREE.MeshBasicMaterial
    | undefined;

  if (bodyMat) {
    bodyMat.color.setHex(paintSpec.primaryHex);
    if (paintSpec.finish === 'chrome') {
      bodyMat.metalness = 0.85;
      bodyMat.roughness = 0.14;
      bodyMat.clearcoat = 0.9;
      bodyMat.envMapIntensity = 0.55;
    } else if (paintSpec.finish === 'matte') {
      bodyMat.metalness = 0.1;
      bodyMat.roughness = 0.82;
      bodyMat.clearcoat = 0.05;
      bodyMat.envMapIntensity = 0.25;
    } else {
      bodyMat.metalness = 0.36;
      bodyMat.roughness = 0.32;
      bodyMat.clearcoat = 0.65;
      bodyMat.envMapIntensity = 0.38;
    }
  }
  if (trimMat) {
    trimMat.color.setHex(paintSpec.accentHex);
  }
  if (underglowMat) {
    if (glowSpec.colorHex !== null) {
      underglowMat.color.setHex(glowSpec.colorHex);
      underglowMat.opacity = 0.65;
    } else {
      underglowMat.opacity = 0.0;
    }
  }
}

/**
 * Builds the Jakarta Inner-City Elevated Toll Highway (Tol Layang Semanggi - Kemayoran)
 * with concrete crosshead piers, deck edge parapets, glowing amber reflectors, and overhead toll gantry.
 */
export function buildElevatedHighwayMesh(roadMat: THREE.Material): THREE.Group {
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

  // Parapet concrete walls + glowing amber reflector rail
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

  // Overhead Toll Gantry Arch with illuminated e-TOLL strip
  const archBeam = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.05, 9.8),
    concreteMat
  );
  archBeam.position.set(0, 10.6, -26);
  group.add(archBeam);

  const etollTex = createGantrySignTexture('GERBANG TOL DALAM KOTA', 'e-TOLL  ·  OTOMATIS');
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

/**
 * Builds the 3 Glowing Building Interior Entrance Portals and elevated 3D Interior Showcase Stage.
 */
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

  return { portalsGroup, interiorStageGroup };
}

/**
 * Builds a Police Tactical Helicopter + Volumetric Searchlight Cone for 3-5 Star Wanted Pursuits.
 */
export function buildPolicePursuitHeliWithSpotlight(): THREE.Group {
  const group = buildIndonesianVehicleMesh('heli');
  const coneGeo = new THREE.ConeGeometry(6.5, 22, 16, 1, true);
  coneGeo.translate(0, -11, 0);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.name = 'searchlightCone';
  coneMesh.position.set(0, 0.2, 0.8);
  group.add(coneMesh);
  return group;
}

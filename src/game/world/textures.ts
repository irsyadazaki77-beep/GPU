import * as THREE from 'three';
import type { BuildingFootprint } from '../types';
import { hash2D } from './spatial';

export interface SidewalkRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
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

  for (let i = 0; i < 7200; i++) {
    const x = (i * 139 + (i % 17) * 29) % 512;
    const y = (i * 227 + (i % 13) * 43) % 512;
    ctx.fillStyle =
      i % 3 === 0 ? '#1a202c' : i % 3 === 1 ? '#0d1017' : '#151a24';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.fillStyle = 'rgba(7, 10, 15, 0.34)';
  ctx.fillRect(72, 0, 46, 512);
  ctx.fillRect(148, 0, 46, 512);
  ctx.fillRect(320, 0, 46, 512);
  ctx.fillRect(396, 0, 46, 512);

  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(14, 0, 6, 512);
  ctx.fillRect(492, 0, 6, 512);

  ctx.fillStyle = '#d97706';
  for (let y = 14; y < 512; y += 128) {
    ctx.fillRect(247, y, 6, 76);
    ctx.fillRect(259, y, 6, 76);
  }

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

export function createAsphaltNormalTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  // Compute subtle aggregate heightfield first
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n1 = hash2D(x * 0.73, y * 0.73);
      const n2 = hash2D(Math.floor(x / 3) * 1.9, Math.floor(y / 3) * 1.9);
      // Tire wear ruts reduce micro-bump height along wheel tracks
      const u = x / size;
      const inTrack =
        (u > 0.14 && u < 0.23) ||
        (u > 0.29 && u < 0.38) ||
        (u > 0.62 && u < 0.71) ||
        (u > 0.77 && u < 0.86);
      heights[y * size + x] = (n1 * 0.65 + n2 * 0.35) * (inTrack ? 0.45 : 1.0);
    }
  }

  const strength = 2.1;
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) % size;
    const yp = (y + 1) % size;
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) % size;
      const xp = (x + 1) % size;
      const dx = (heights[y * size + xp] - heights[y * size + xm]) * strength;
      const dy = (heights[yp * size + x] - heights[ym * size + x]) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 1.0;
      const invLen = 1 / Math.hypot(nx, ny, nz);
      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * invLen * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * invLen * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * invLen * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createAsphaltRoughnessTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(245, 245, 245)';
  ctx.fillRect(0, 0, size, size);

  // Matte-satin wheel tracks (no mirror glare when dry)
  ctx.fillStyle = 'rgb(220, 220, 220)';
  ctx.fillRect(36, 0, 23, size);
  ctx.fillRect(74, 0, 23, size);
  ctx.fillRect(160, 0, 23, size);
  ctx.fillRect(198, 0, 23, size);

  // Micro aggregate speckles
  for (let i = 0; i < 2400; i++) {
    const x = (i * 97 + (i % 11) * 19) % size;
    const y = (i * 151 + (i % 19) * 23) % size;
    const shade = 210 + (i % 44);
    ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
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

  rCtx.fillStyle = 'rgb(218, 218, 218)';
  rCtx.fillRect(0, 0, size, size);

  const rows = style === 'skyscraper' ? 12 : style === 'colonial' ? 5 : 6;
  const cols = style === 'skyscraper' ? 8 : style === 'colonial' ? 6 : 6;
  const padX = 16;
  const padY = 18;
  const cellW = (size - padX * 2) / cols;
  const cellH = (size - padY * 2) / rows;

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

        if (isWarmLit) {
          cCtx.fillStyle = 'rgba(253, 224, 71, 0.36)';
          cCtx.fillRect(wx + 3, wy + 3, ww - 6, 3);
        } else if (isCoolLit) {
          cCtx.fillStyle = 'rgba(125, 211, 252, 0.26)';
          cCtx.fillRect(wx + 3, wy + 3, ww - 6, 2);
        }

        rCtx.fillStyle = 'rgb(210, 210, 210)';
        rCtx.fillRect(wx, wy, ww, wh);

        cCtx.fillStyle = '#' + darkMullion.getHexString();
        cCtx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
      } else if (style === 'colonial') {
        cCtx.fillStyle = isWarmLit ? '#b45309' : '#111827';
        cCtx.fillRect(wx + 3, wy + wh * 0.25, ww - 6, wh * 0.72);
        cCtx.beginPath();
        cCtx.arc(wx + ww * 0.5, wy + wh * 0.28, (ww - 6) * 0.5, Math.PI, 0);
        cCtx.fill();
        rCtx.fillStyle = 'rgb(205, 205, 205)';
        rCtx.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
      } else if (style === 'port_crane') {
        cCtx.fillStyle =
          r % 2 === 0 ? '#' + accentColor.getHexString() : '#111827';
        cCtx.fillRect(wx, wy, ww, wh);
        rCtx.fillStyle = 'rgb(210, 210, 210)';
        rCtx.fillRect(wx, wy, ww, wh);
      } else {
        cCtx.fillStyle = isWarmLit
          ? '#92400e'
          : isCoolLit
          ? '#1e3a5f'
          : '#0b1120';
        cCtx.fillRect(wx, wy, ww, wh);
        if (isWarmLit) {
          cCtx.fillStyle = '#d97706';
          cCtx.fillRect(wx + 4, wy + 4, ww - 8, 4);
        }
        if (r === rows - 1) {
          cCtx.fillStyle = '#' + accentColor.getHexString();
          cCtx.fillRect(wx, wy, ww, wh * 0.28);
        }
        rCtx.fillStyle = 'rgb(205, 205, 205)';
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

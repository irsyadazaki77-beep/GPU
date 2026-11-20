import * as THREE from 'three';
import type { BuildingFootprint } from '../game/types';

export interface AsphaltTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface BuildingFacadeTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
}

export interface SidewalkTextureSet {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export interface MarbleTextureSet {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

function hash2D(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Cached procedural HTML5 Canvas PBR texture factory for Jakarta asphalt, TransJakarta busway lanes,
 * reflective office towers, Blok M ruko shopfronts, concrete paving-block sidewalks,
 * Monas marble stone, soft radial ground light pools, and warung tenda banners.
 * All created textures are tracked and cleanly disposed on WorldEngine unmount.
 */
class ProceduralTextureFactory {
  private readonly asphaltCache = new Map<string, AsphaltTextureSet>();
  private readonly facadeCache = new Map<string, BuildingFacadeTextureSet>();
  private readonly warungBannerCache = new Map<string, THREE.CanvasTexture>();
  private sidewalkCache: SidewalkTextureSet | null = null;
  private marbleCache: MarbleTextureSet | null = null;
  private radialPoolCache: THREE.CanvasTexture | null = null;
  private flagTextureCache: THREE.CanvasTexture | null = null;
  private contactShadowCache: THREE.CanvasTexture | null = null;

  public getAsphaltTextures(
    maxAnisotropy: number,
    variant: 'standard' | 'busway' = 'standard'
  ): AsphaltTextureSet {
    const key = `${variant}_${maxAnisotropy}`;
    const cached = this.asphaltCache.get(key);
    if (cached) return cached;

    const size = 512;
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = size;
    diffCanvas.height = size;
    const dCtx = diffCanvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Base weathered Jakarta asphalt
    dCtx.fillStyle = '#252932';
    dCtx.fillRect(0, 0, size, size);

    bCtx.fillStyle = 'rgb(128,128,128)';
    bCtx.fillRect(0, 0, size, size);

    rCtx.fillStyle = 'rgb(214,214,214)';
    rCtx.fillRect(0, 0, size, size);

    // Subtle aggregate mineral speckles across diffuse, bump, and roughness
    for (let i = 0; i < 6500; i++) {
      const gx = hash2D(i * 1.13, 3.7) * size;
      const gy = hash2D(i * 2.41, 9.1) * size;
      const gVal = hash2D(i * 0.71, 17.3);
      const tone = Math.floor(28 + gVal * 32);
      const sz = gVal > 0.85 ? 2 : 1.5;

      dCtx.fillStyle = `rgb(${tone},${tone + 2},${tone + 6})`;
      dCtx.fillRect(gx, gy, sz, sz);

      const bumpV = Math.floor(96 + gVal * 64);
      bCtx.fillStyle = `rgb(${bumpV},${bumpV},${bumpV})`;
      bCtx.fillRect(gx, gy, sz, sz);

      const roughV = Math.floor(194 + gVal * 44);
      rCtx.fillStyle = `rgb(${roughV},${roughV},${roughV})`;
      rCtx.fillRect(gx, gy, sz, sz);
    }

    // Subtle longitudinal tire wear polishing tracks (darker albedo, smoother roughness)
    const wearCenters = [108, 176, 336, 404];
    for (const cx of wearCenters) {
      const dGrad = dCtx.createLinearGradient(cx - 26, 0, cx + 26, 0);
      dGrad.addColorStop(0, 'rgba(10,13,18,0)');
      dGrad.addColorStop(0.5, 'rgba(10,13,18,0.28)');
      dGrad.addColorStop(1, 'rgba(10,13,18,0)');
      dCtx.fillStyle = dGrad;
      dCtx.fillRect(cx - 26, 0, 52, size);

      const rGrad = rCtx.createLinearGradient(cx - 24, 0, cx + 24, 0);
      rGrad.addColorStop(0, 'rgba(165,165,165,0)');
      rGrad.addColorStop(0.5, 'rgba(148,148,148,0.62)');
      rGrad.addColorStop(1, 'rgba(165,165,165,0)');
      rCtx.fillStyle = rGrad;
      rCtx.fillRect(cx - 24, 0, 48, size);
    }

    // Subtle transverse tar repair seam
    dCtx.fillStyle = 'rgba(14,16,20,0.55)';
    dCtx.fillRect(14, 244, size - 28, 4);
    bCtx.fillStyle = 'rgb(75,75,75)';
    bCtx.fillRect(14, 244, size - 28, 4);

    if (variant === 'busway') {
      // Dedicated Jakarta TransJakarta red/terracotta inner busway corridor
      const busGrad = dCtx.createLinearGradient(178, 0, 334, 0);
      busGrad.addColorStop(0, '#7f1d1d');
      busGrad.addColorStop(0.5, '#991b1b');
      busGrad.addColorStop(1, '#7f1d1d');
      dCtx.fillStyle = busGrad;
      dCtx.fillRect(184, 0, 144, size);

      // Subtle weathered texture over painted busway lane
      for (let i = 0; i < 1200; i++) {
        const bx = 184 + hash2D(i * 3.1, 4.2) * 144;
        const by = hash2D(i * 1.9, 8.8) * size;
        dCtx.fillStyle =
          i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.14)';
        dCtx.fillRect(bx, by, 2, 2);
      }

      // Crisp white busway separator stripes
      dCtx.fillStyle = '#e2e8f0';
      dCtx.fillRect(178, 0, 7, size);
      dCtx.fillRect(327, 0, 7, size);

      // Painted road stencil text "BUSWAY"
      dCtx.save();
      dCtx.fillStyle = 'rgba(248, 250, 252, 0.78)';
      dCtx.font = '800 30px sans-serif';
      dCtx.textAlign = 'center';
      dCtx.textBaseline = 'middle';
      dCtx.fillText('BUSWAY', 256, 132);
      dCtx.fillText('TJ · KOR 1', 256, 388);
      dCtx.restore();

      // Painted busway surface is slightly smoother than raw asphalt
      rCtx.fillStyle = 'rgb(168,168,168)';
      rCtx.fillRect(184, 0, 144, size);
    } else {
      // Double warm yellow Jakarta center divider
      dCtx.fillStyle = '#eab308';
      dCtx.fillRect(size * 0.5 - 8, 0, 5, size);
      dCtx.fillRect(size * 0.5 + 3, 0, 5, size);
    }

    // Solid white shoulder edge lines
    dCtx.fillStyle = '#cbd5e1';
    dCtx.fillRect(14, 0, 6, size);
    dCtx.fillRect(size - 20, 0, 6, size);

    // Dashed white lane dividers
    dCtx.fillStyle = '#e2e8f0';
    for (let y = 18; y < size; y += 84) {
      dCtx.fillRect(size * 0.25 - 3, y, 5, 44);
      dCtx.fillRect(size * 0.75 - 2, y, 5, 44);
    }

    const map = new THREE.CanvasTexture(diffCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = maxAnisotropy;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.colorSpace = THREE.NoColorSpace;
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.anisotropy = maxAnisotropy;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = maxAnisotropy;

    const result: AsphaltTextureSet = { map, bumpMap, roughnessMap };
    this.asphaltCache.set(key, result);
    return result;
  }

  public getBuildingFacadeTextures(
    primaryHex: number,
    accentHex: number,
    style: BuildingFootprint['style'],
    maxAnisotropy: number
  ): BuildingFacadeTextureSet {
    const key = `${primaryHex}_${accentHex}_${style}_${maxAnisotropy}`;
    const cached = this.facadeCache.get(key);
    if (cached) return cached;

    const size = 512;
    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = size;
    colorCanvas.height = size;
    const cCtx = colorCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    const emissiveCanvas = document.createElement('canvas');
    emissiveCanvas.width = size;
    emissiveCanvas.height = size;
    const eCtx = emissiveCanvas.getContext('2d')!;

    const baseColor = new THREE.Color(primaryHex).multiplyScalar(0.82);
    const darkMullion = baseColor.clone().multiplyScalar(0.42);
    const spandrelColor = baseColor.clone().multiplyScalar(0.68);
    const accentColor = new THREE.Color(accentHex);

    // Base wall diffuse, matte concrete roughness, black (unlit) emissive
    cCtx.fillStyle = '#' + baseColor.getHexString();
    cCtx.fillRect(0, 0, size, size);

    // Concrete / stucco base roughness (~0.84)
    rCtx.fillStyle = 'rgb(214,214,214)';
    rCtx.fillRect(0, 0, size, size);

    eCtx.fillStyle = '#000000';
    eCtx.fillRect(0, 0, size, size);

    // Subtle architectural panel grain
    for (let i = 0; i < 1400; i++) {
      const gx = hash2D(i * 1.3, primaryHex * 0.001) * size;
      const gy = hash2D(i * 2.1, accentHex * 0.001) * size;
      cCtx.fillStyle =
        i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
      cCtx.fillRect(gx, gy, 3, 2);
    }

    const rows = style === 'skyscraper' ? 12 : style === 'colonial' ? 5 : 6;
    const cols = style === 'skyscraper' ? 8 : style === 'colonial' ? 6 : 6;
    const padX = 14;
    const padY = 16;
    const cellW = (size - padX * 2) / cols;
    const cellH = (size - padY * 2) / rows;

    // Concrete floor spandrel bands
    for (let r = 0; r <= rows; r++) {
      const sy = padY + r * cellH - 4;
      cCtx.fillStyle = '#' + spandrelColor.getHexString();
      cCtx.fillRect(0, sy, size, 9);
      rCtx.fillStyle = 'rgb(224,224,224)';
      rCtx.fillRect(0, sy, size, 9);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = padX + c * cellW + 4;
        const wy = padY + r * cellH + 4;
        const ww = cellW - 8;
        const wh = cellH - 8;

        // Window frame / mullion surround
        cCtx.fillStyle = '#' + darkMullion.getHexString();
        cCtx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);

        const h = hash2D(
          r * 3.17 + primaryHex * 0.0007,
          c * 5.23 + accentHex * 0.0009
        );
        const h2 = hash2D(r * 7.1 + c * 2.3, primaryHex * 0.0003);

        if (style === 'skyscraper') {
          // Modern Sudirman-Thamrin curtain wall glass: glossy low roughness so IBL reflects sky!
          const grad = cCtx.createLinearGradient(wx, wy, wx, wy + wh);
          if (h > 0.62) {
            grad.addColorStop(0, '#334e68');
            grad.addColorStop(0.5, '#1e3a5f');
            grad.addColorStop(1, '#0f172a');
          } else {
            grad.addColorStop(0, '#1e293b');
            grad.addColorStop(0.45, '#0f2942');
            grad.addColorStop(1, '#081224');
          }
          cCtx.fillStyle = grad;
          cCtx.fillRect(wx, wy, ww, wh);

          // Glossy glass reflection band in roughnessMap (~0.14 - 0.22)
          rCtx.fillStyle = h > 0.5 ? 'rgb(38,38,38)' : 'rgb(52,52,52)';
          rCtx.fillRect(wx, wy, ww, wh);

          // Vertical aluminum mullion bar (higher roughness)
          cCtx.fillStyle = '#' + darkMullion.getHexString();
          cCtx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
          rCtx.fillStyle = 'rgb(160,160,160)';
          rCtx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);

          // Randomized lit office windows in emissiveMap (warm tungsten + cool fluorescent)
          const officeCluster = hash2D(r * 1.9, Math.floor(c / 2) * 4.7);
          if (h > 0.56 || officeCluster > 0.72) {
            const isWarm = h2 > 0.38;
            const eGrad = eCtx.createLinearGradient(wx, wy, wx, wy + wh);
            if (isWarm) {
              eGrad.addColorStop(0, '#fff3c4');
              eGrad.addColorStop(0.45, '#f59e0b');
              eGrad.addColorStop(1, '#92400e');
            } else {
              eGrad.addColorStop(0, '#e0f2fe');
              eGrad.addColorStop(0.5, '#38bdf8');
              eGrad.addColorStop(1, '#0c4a6e');
            }
            eCtx.fillStyle = eGrad;
            eCtx.fillRect(wx + 1, wy + 2, ww - 2, wh - 3);

            // Interior blinds / ceiling fixture silhouettes for architectural realism
            eCtx.fillStyle = 'rgba(0,0,0,0.42)';
            eCtx.fillRect(wx + ww * 0.5 - 1, wy, 2, wh);
            if (h2 > 0.7) {
              eCtx.fillRect(wx + 1, wy + wh * 0.62, ww - 2, wh * 0.36);
            }
          }
        } else if (style === 'colonial') {
          // Heritage Kota Tua arched shutters & warm interior glow
          cCtx.fillStyle = '#182230';
          cCtx.fillRect(wx + 3, wy + wh * 0.25, ww - 6, wh * 0.72);
          cCtx.beginPath();
          cCtx.arc(wx + ww * 0.5, wy + wh * 0.28, (ww - 6) * 0.5, Math.PI, 0);
          cCtx.fill();

          rCtx.fillStyle = 'rgb(76,76,76)';
          rCtx.fillRect(wx + 3, wy + 4, ww - 6, wh - 6);

          if (h > 0.45) {
            eCtx.fillStyle = '#f59e0b';
            eCtx.fillRect(wx + 5, wy + wh * 0.28, ww - 10, wh * 0.66);
            eCtx.beginPath();
            eCtx.arc(
              wx + ww * 0.5,
              wy + wh * 0.3,
              (ww - 10) * 0.5,
              Math.PI,
              0
            );
            eCtx.fill();
          }
        } else if (style === 'port_crane') {
          // Industrial Tanjung Priok terminal siding + amber beacon strip
          cCtx.fillStyle =
            r % 2 === 0 ? '#' + accentColor.getHexString() : '#1e293b';
          cCtx.fillRect(wx, wy, ww, wh);
          rCtx.fillStyle = 'rgb(118,118,118)';
          rCtx.fillRect(wx, wy, ww, wh);
          if (r === 1 || (r === rows - 1 && h > 0.5)) {
            eCtx.fillStyle = '#fb923c';
            eCtx.fillRect(wx + 4, wy + wh * 0.35, ww - 8, wh * 0.3);
          }
        } else {
          // Blok M / Kemang Ruko & Pasar shophouses
          if (r === rows - 1) {
            // Ground floor rolling shutters + colorful striped awning
            cCtx.fillStyle = '#334155';
            cCtx.fillRect(wx, wy + wh * 0.26, ww, wh * 0.74);
            // Rolling shutter horizontal ribs
            cCtx.fillStyle = '#1e293b';
            for (let sy = wy + wh * 0.34; sy < wy + wh; sy += 6) {
              cCtx.fillRect(wx + 2, sy, ww - 4, 2);
            }
            // Striped shopfront awning
            for (let stripe = 0; stripe < 4; stripe++) {
              cCtx.fillStyle =
                stripe % 2 === 0 ? '#' + accentColor.getHexString() : '#f8fafc';
              cCtx.fillRect(
                wx + (stripe * ww) / 4,
                wy,
                ww / 4 + 0.5,
                wh * 0.28
              );
            }
            rCtx.fillStyle = 'rgb(142,142,142)';
            rCtx.fillRect(wx, wy, ww, wh);

            // Warm open-shop signage / neon strip glow at night
            if (h > 0.32) {
              eCtx.fillStyle =
                h2 > 0.5 ? '#fde047' : '#' + accentColor.getHexString();
              eCtx.fillRect(wx + 2, wy + 2, ww - 4, wh * 0.2);
              eCtx.fillStyle = '#d97706';
              eCtx.fillRect(wx + 6, wy + wh * 0.38, ww - 12, wh * 0.5);
            }
          } else {
            // Upper ruko living/office windows with glossy panes + warm glow
            cCtx.fillStyle = h > 0.48 ? '#1e3a5f' : '#0f172a';
            cCtx.fillRect(wx, wy, ww, wh);
            rCtx.fillStyle = 'rgb(58,58,58)';
            rCtx.fillRect(wx, wy, ww, wh);

            if (h > 0.44) {
              eCtx.fillStyle = h2 > 0.42 ? '#fbbf24' : '#67e8f9';
              eCtx.fillRect(wx + 3, wy + 4, ww - 6, wh - 8);
              eCtx.fillStyle = 'rgba(0,0,0,0.35)';
              eCtx.fillRect(wx + ww * 0.5 - 1, wy + 4, 2, wh - 8);
            }
          }
        }
      }
    }

    const map = new THREE.CanvasTexture(colorCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = maxAnisotropy;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = maxAnisotropy;

    const emissiveMap = new THREE.CanvasTexture(emissiveCanvas);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = THREE.RepeatWrapping;
    emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.anisotropy = maxAnisotropy;

    const set: BuildingFacadeTextureSet = { map, roughnessMap, emissiveMap };
    this.facadeCache.set(key, set);
    return set;
  }

  public getSidewalkTextures(maxAnisotropy: number): SidewalkTextureSet {
    if (this.sidewalkCache) return this.sidewalkCache;

    const size = 256;
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = size;
    diffCanvas.height = size;
    const dCtx = diffCanvas.getContext('2d')!;

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    dCtx.fillStyle = '#475569';
    dCtx.fillRect(0, 0, size, size);
    bCtx.fillStyle = 'rgb(152,152,152)';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = 'rgb(218,218,218)';
    rCtx.fillRect(0, 0, size, size);

    // Paving-block tile grid with tonal variation & recessed mortar joints
    const tile = 32;
    for (let y = 0; y < size; y += tile) {
      for (let x = 0; x < size; x += tile) {
        const v = hash2D(x * 0.17, y * 0.31);
        const shade = Math.floor(66 + v * 26);
        dCtx.fillStyle = `rgb(${shade},${shade + 6},${shade + 14})`;
        dCtx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

        const rTone = Math.floor(195 + v * 36);
        rCtx.fillStyle = `rgb(${rTone},${rTone},${rTone})`;
        rCtx.fillRect(x + 2, y + 2, tile - 4, tile - 4);
      }
    }

    // Recessed mortar seams
    dCtx.strokeStyle = '#1e293b';
    dCtx.lineWidth = 2;
    bCtx.strokeStyle = 'rgb(52,52,52)';
    bCtx.lineWidth = 2;
    for (let i = 0; i <= size; i += tile) {
      dCtx.beginPath();
      dCtx.moveTo(i, 0);
      dCtx.lineTo(i, size);
      dCtx.moveTo(0, i);
      dCtx.lineTo(size, i);
      dCtx.stroke();

      bCtx.beginPath();
      bCtx.moveTo(i, 0);
      bCtx.lineTo(i, size);
      bCtx.moveTo(0, i);
      bCtx.lineTo(size, i);
      bCtx.stroke();
    }

    // Authentic Jakarta yellow tactile guiding block strip along sidewalk center
    dCtx.fillStyle = '#ca8a04';
    dCtx.fillRect(size * 0.43, 0, size * 0.14, size);
    bCtx.fillStyle = 'rgb(220,220,220)';
    for (let y = 4; y < size; y += 16) {
      dCtx.fillStyle = '#eab308';
      dCtx.fillRect(size * 0.45, y, 5, 10);
      dCtx.fillRect(size * 0.51, y, 5, 10);
      bCtx.fillRect(size * 0.45, y, 5, 10);
      bCtx.fillRect(size * 0.51, y, 5, 10);
    }

    // High-contrast curb edge border
    dCtx.fillStyle = '#cbd5e1';
    dCtx.fillRect(0, 0, 10, size);
    dCtx.fillRect(size - 10, 0, 10, size);
    dCtx.fillStyle = '#1e293b';
    for (let y = 0; y < size; y += 64) {
      dCtx.fillRect(0, y, 10, 32);
      dCtx.fillRect(size - 10, y, 10, 32);
    }

    const map = new THREE.CanvasTexture(diffCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = maxAnisotropy;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.colorSpace = THREE.NoColorSpace;
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.anisotropy = maxAnisotropy;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.anisotropy = maxAnisotropy;

    this.sidewalkCache = { map, bumpMap, roughnessMap };
    return this.sidewalkCache;
  }

  public getMarbleTextures(maxAnisotropy: number): MarbleTextureSet {
    if (this.marbleCache) return this.marbleCache;

    const size = 256;
    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = size;
    diffCanvas.height = size;
    const dCtx = diffCanvas.getContext('2d')!;

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d')!;

    // Warm Italian-Indonesian cream marble base (Monas limestone/marble cladding)
    dCtx.fillStyle = '#ece9e0';
    dCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = 'rgb(88,88,88)';
    rCtx.fillRect(0, 0, size, size);

    // Subtle stone block ashlar courses & micro grain
    const blockH = 32;
    const blockW = 64;
    for (let row = 0; row < size / blockH; row++) {
      const y = row * blockH;
      const offsetX = (row % 2) * (blockW / 2);
      for (let col = -1; col <= size / blockW + 1; col++) {
        const x = col * blockW + offsetX;
        const v = hash2D(col * 2.13, row * 4.71);
        const lum = Math.floor(224 + v * 20);
        dCtx.fillStyle = `rgb(${lum},${lum - 3},${lum - 10})`;
        dCtx.fillRect(x + 1, y + 1, blockW - 2, blockH - 2);

        const rv = Math.floor(72 + v * 42);
        rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
        rCtx.fillRect(x + 1, y + 1, blockW - 2, blockH - 2);
      }
    }

    // Subtle diagonal mineral veins
    dCtx.strokeStyle = 'rgba(148, 138, 124, 0.22)';
    rCtx.strokeStyle = 'rgba(136, 136, 136, 0.35)';
    for (let i = 0; i < 16; i++) {
      const sx = hash2D(i * 3.1, 1.7) * size;
      const sy = hash2D(i * 1.9, 5.3) * size;
      dCtx.lineWidth = 1 + (i % 2);
      dCtx.beginPath();
      dCtx.moveTo(sx, sy);
      dCtx.quadraticCurveTo(
        sx + 28,
        sy + 14 + (i % 3) * 8,
        sx + 58,
        sy + 32
      );
      dCtx.stroke();

      rCtx.lineWidth = 1.5;
      rCtx.beginPath();
      rCtx.moveTo(sx, sy);
      rCtx.quadraticCurveTo(sx + 28, sy + 14, sx + 58, sy + 32);
      rCtx.stroke();
    }

    // Crisp ashlar joint lines
    dCtx.strokeStyle = 'rgba(120, 113, 108, 0.24)';
    dCtx.lineWidth = 1;
    for (let y = 0; y <= size; y += blockH) {
      dCtx.beginPath();
      dCtx.moveTo(0, y);
      dCtx.lineTo(size, y);
      dCtx.stroke();
    }

    const map = new THREE.CanvasTexture(diffCanvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2, 4);
    map.anisotropy = maxAnisotropy;

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.colorSpace = THREE.NoColorSpace;
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(2, 4);
    roughnessMap.anisotropy = maxAnisotropy;

    this.marbleCache = { map, roughnessMap };
    return this.marbleCache;
  }

  public getMerahPutihFlagTexture(maxAnisotropy: number): THREE.CanvasTexture {
    if (this.flagTextureCache) return this.flagTextureCache;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 64, 256, 64);

    // Subtle woven fabric horizontal creases for cloth realism
    for (let y = 0; y < 128; y += 4) {
      ctx.fillStyle =
        y % 8 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.05)';
      ctx.fillRect(0, y, 256, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    this.flagTextureCache = tex;
    return tex;
  }

  public getRadialLightPoolTexture(): THREE.CanvasTexture {
    if (this.radialPoolCache) return this.radialPoolCache;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(
      size / 2,
      size / 2,
      2,
      size / 2,
      size / 2,
      size / 2
    );
    grad.addColorStop(0.0, 'rgba(255, 232, 168, 1.0)');
    grad.addColorStop(0.32, 'rgba(251, 191, 36, 0.52)');
    grad.addColorStop(0.68, 'rgba(245, 158, 11, 0.14)');
    grad.addColorStop(1.0, 'rgba(245, 158, 11, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.radialPoolCache = tex;
    return tex;
  }

  public getContactShadowTexture(): THREE.CanvasTexture {
    if (this.contactShadowCache) return this.contactShadowCache;
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0.0, 'rgba(3, 5, 9, 0.72)');
    grad.addColorStop(0.48, 'rgba(3, 5, 9, 0.44)');
    grad.addColorStop(0.82, 'rgba(3, 5, 9, 0.12)');
    grad.addColorStop(1.0, 'rgba(3, 5, 9, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.contactShadowCache = tex;
    return tex;
  }

  public getWarungBannerTexture(
    title: string = 'WARUNG KOPI & SOTO BETAWI',
    subtitle: string = 'KOPI TUBRUK · GORENGAN · BUKA 24 JAM'
  ): THREE.CanvasTexture {
    const key = `${title}_${subtitle}`;
    const cached = this.warungBannerCache.get(key);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Authentic Jakarta warung tenda vinyl banner: warm saffron-yellow with deep red & green trim
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 128);
    bgGrad.addColorStop(0, '#fef08a');
    bgGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 128);

    ctx.fillStyle = '#991b1b';
    ctx.fillRect(0, 0, 512, 14);
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 114, 512, 14);

    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 18, 496, 92);

    ctx.fillStyle = '#7f1d1d';
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 256, 52);

    ctx.fillStyle = '#14532d';
    ctx.font = '800 18px sans-serif';
    ctx.fillText(subtitle, 256, 90);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.warungBannerCache.set(key, tex);
    return tex;
  }

  public disposeAll(): void {
    for (const set of this.asphaltCache.values()) {
      set.map.dispose();
      set.bumpMap.dispose();
      set.roughnessMap.dispose();
    }
    this.asphaltCache.clear();

    for (const set of this.facadeCache.values()) {
      set.map.dispose();
      set.roughnessMap.dispose();
      set.emissiveMap.dispose();
    }
    this.facadeCache.clear();

    for (const tex of this.warungBannerCache.values()) {
      tex.dispose();
    }
    this.warungBannerCache.clear();

    if (this.sidewalkCache) {
      this.sidewalkCache.map.dispose();
      this.sidewalkCache.bumpMap.dispose();
      this.sidewalkCache.roughnessMap.dispose();
      this.sidewalkCache = null;
    }

    if (this.marbleCache) {
      this.marbleCache.map.dispose();
      this.marbleCache.roughnessMap.dispose();
      this.marbleCache = null;
    }

    if (this.radialPoolCache) {
      this.radialPoolCache.dispose();
      this.radialPoolCache = null;
    }

    if (this.flagTextureCache) {
      this.flagTextureCache.dispose();
      this.flagTextureCache = null;
    }

    if (this.contactShadowCache) {
      this.contactShadowCache.dispose();
      this.contactShadowCache = null;
    }
  }
}

export const proceduralTextures = new ProceduralTextureFactory();

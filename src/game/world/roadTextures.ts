import * as THREE from 'three';
import type { TrafficSignKind } from '../types';

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function createCrosswalkStripeTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, '#64748b');
  grad.addColorStop(0.15, '#7c8aa0');
  grad.addColorStop(0.5, '#94a3b8');
  grad.addColorStop(0.85, '#7c8aa0');
  grad.addColorStop(1, '#64748b');
  ctx.fillStyle = grad;
  ctx.fillRect(6, 4, canvas.width - 12, canvas.height - 8);

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

export function createYellowBoxTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 512, 512);

  ctx.strokeStyle = 'rgba(217, 119, 6, 0.82)';
  ctx.lineWidth = 14;
  ctx.strokeRect(18, 18, 476, 476);

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

export function createLaneArrowTexture(
  variant: 'straight' | 'straight_right',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
  if (variant === 'straight') {
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

export function createBuswayStencilTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  ctx.fillStyle = 'rgba(153, 27, 27, 0.72)';
  ctx.fillRect(14, 0, 228, 512);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.fillRect(14, 0, 10, 512);
  ctx.fillRect(232, 0, 10, 512);

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

export function createCrackDecalTexture(
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

  const startAngle = rng() * Math.PI * 2;
  const rx = 128 + Math.cos(startAngle + Math.PI) * 92;
  const ry = 128 + Math.sin(startAngle + Math.PI) * 92;
  drawBranch(rx, ry, startAngle, 175, style === 'sidewalk' ? 5.4 : 4.2, 0);

  if (style === 'sidewalk') {
    const crossAngle = startAngle + (rng() > 0.5 ? 1.15 : -1.15);
    drawBranch(
      128 + Math.cos(crossAngle + Math.PI) * 58,
      128 + Math.sin(crossAngle + Math.PI) * 58,
      crossAngle,
      120,
      3.1,
      1
    );
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

export function createManholeTexture(
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 128);

  ctx.fillStyle = '#475569';
  ctx.fillRect(10, 10, 108, 108);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 108, 108);

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

export function createTrafficSignTexture(
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
    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(-86, -86, 172, 172);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#0f172a';
    ctx.strokeRect(-78, -78, 156, 156);
    ctx.restore();

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
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(6, 6, 244, 244);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 8;
    ctx.strokeRect(14, 14, 228, 228);

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

export function createTollSignTexture(
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

  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, 740, 292);

  ctx.fillStyle = 'rgba(248, 250, 252, 0.35)';
  ctx.fillRect(28, 168, 712, 4);

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

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(topText, 434, 98, 570);

  ctx.fillStyle = '#fef08a';
  ctx.font = '800 34px sans-serif';
  ctx.fillText(bottomText, 384, 236, 680);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHalteBoardTexture(
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

  ctx.fillStyle = '#0ea5e9';
  ctx.fillRect(0, 0, 1024, 20);
  ctx.fillRect(0, 174, 1024, 18);

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

  ctx.fillStyle = '#f8fafc';
  ctx.font = '900 52px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(stationName, 178, 72, 810);

  ctx.fillStyle = '#7dd3fc';
  ctx.font = '800 30px sans-serif';
  ctx.fillText(`TRANSJAKARTA  ·  ${routeSummary}`, 178, 132, 810);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = maxAnisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHalteTotemTexture(
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

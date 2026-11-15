import * as THREE from 'three';
import type { BuildingFootprint } from '../types';
import { createBuildingFacadeTextures } from './textures';

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

  const lowerStep = new THREE.Mesh(
    new THREE.BoxGeometry(12.6, 0.7, 12.6),
    darkStoneMat
  );
  lowerStep.position.y = 0.35;
  lowerStep.receiveShadow = true;
  lowerStep.castShadow = true;
  group.add(lowerStep);

  const upperStep = new THREE.Mesh(
    new THREE.BoxGeometry(10.8, 0.9, 10.8),
    marbleMat
  );
  upperStep.position.y = 1.15;
  upperStep.castShadow = true;
  upperStep.receiveShadow = true;
  group.add(upperStep);

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

  const shaftGeo = new THREE.CylinderGeometry(0.95, 1.55, 25, 8);
  const shaftMesh = new THREE.Mesh(shaftGeo, marbleMat);
  shaftMesh.position.y = 18.0;
  shaftMesh.castShadow = true;
  group.add(shaftMesh);

  const deckGeo = new THREE.BoxGeometry(3.0, 0.9, 3.0);
  const deckMesh = new THREE.Mesh(deckGeo, darkStoneMat);
  deckMesh.position.y = 30.8;
  group.add(deckMesh);

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

  const shopBand = new THREE.Mesh(
    new THREE.BoxGeometry(b.width * 0.92, podiumH * 0.56, b.depth * 0.96),
    lobbyGlassMat
  );
  shopBand.position.y = podiumH * 0.44;
  group.add(shopBand);

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

  const canopy = new THREE.Mesh(
    new THREE.BoxGeometry(b.width * 0.54, 0.26, b.depth * 1.08),
    mullionMat
  );
  canopy.position.y = podiumH * 0.86;
  canopy.castShadow = true;
  group.add(canopy);

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

    const upperShaft = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.72, upperH, b.depth * 0.72),
      bodyMat
    );
    upperShaft.position.y = podiumH + lowerH + upperH * 0.5;
    upperShaft.castShadow = true;
    upperShaft.receiveShadow = true;
    group.add(upperShaft);

    for (const fx of [-b.width * 0.28, b.width * 0.28]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, lowerH + 0.6, b.depth * 0.93),
        mullionMat
      );
      fin.position.set(fx, podiumH + lowerH * 0.5, 0);
      group.add(fin);
    }

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

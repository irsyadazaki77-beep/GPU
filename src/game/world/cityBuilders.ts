import * as THREE from 'three';
import { proceduralTextures } from '../../engine/ProceduralTextures';
import type { BuildingFootprint } from '../types';

export function createContactShadowDisc(radius: number): THREE.Mesh {
  const size = radius * 2.2;
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: proceduralTextures.getContactShadowTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const disc = new THREE.Mesh(geo, mat);
  disc.position.y = 0.032;
  return disc;
}

export function buildMonasLandmark(maxAnisotropy: number = 4): THREE.Group {
  const group = new THREE.Group();

  const marbleSet = proceduralTextures.getMarbleTextures(maxAnisotropy);
  const marbleMat = new THREE.MeshStandardMaterial({
    color: 0xf8f6f0,
    map: marbleSet.map,
    roughnessMap: marbleSet.roughnessMap,
    roughness: 0.55,
    metalness: 0.06,
    envMapIntensity: 0.72,
  });
  const darkStoneMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    roughness: 0.72,
    metalness: 0.14,
    envMapIntensity: 0.48,
  });
  const goldFlameMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xffaa00,
    emissiveIntensity: 1.6,
    metalness: 0.88,
    roughness: 0.16,
    envMapIntensity: 1.25,
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
  const flagTex = proceduralTextures.getMerahPutihFlagTexture(maxAnisotropy);
  const flagClothMat = new THREE.MeshStandardMaterial({
    map: flagTex,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide,
    envMapIntensity: 0.35,
  });

  const animatedFlags: {
    geometry: THREE.PlaneGeometry;
    basePositions: Float32Array;
    phase: number;
  }[] = [];

  for (let fIdx = 0; fIdx < 2; fIdx++) {
    const fx = fIdx === 0 ? -7.5 : 7.5;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 8.6, 8),
      poleMat
    );
    pole.position.set(fx, 4.3, 9.5);
    group.add(pole);

    // Finial gold sphere atop flagpole
    const finial = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      goldFlameMat
    );
    finial.position.set(fx, 8.65, 9.5);
    group.add(finial);

    // Subdivided cloth flag anchored at x = 0 so wind flutter wave travels pole -> fly edge
    const flagGeo = new THREE.PlaneGeometry(1.82, 1.04, 10, 4);
    flagGeo.translate(0.91, 0, 0);
    const posAttr = flagGeo.attributes.position as THREE.BufferAttribute;
    const basePositions = new Float32Array(posAttr.array);
    const flagMesh = new THREE.Mesh(flagGeo, flagClothMat);
    flagMesh.position.set(fx + 0.06, 7.92, 9.5);
    flagMesh.castShadow = true;
    group.add(flagMesh);

    animatedFlags.push({
      geometry: flagGeo,
      basePositions,
      phase: fIdx * 1.65,
    });
  }

  group.userData.animatedFlags = animatedFlags;

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
    color: 0xc2410c,
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.12,
  });
  const bannerTex = proceduralTextures.getWarungBannerTexture();
  const bannerMat = new THREE.MeshStandardMaterial({
    map: bannerTex,
    emissive: 0xf59e0b,
    emissiveMap: bannerTex,
    emissiveIntensity: 0.28,
    roughness: 0.68,
    envMapIntensity: 0.14,
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
  const cordMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff7ed,
    emissive: 0xffb74d,
    emissiveIntensity: 1.65,
    roughness: 0.2,
  });

  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.4), woodMat);
  counter.position.set(0, 0.45, 0);
  counter.castShadow = true;
  counter.receiveShadow = true;
  group.add(counter);

  // Glass food display cabinet (etalase warung) on counter
  const etalaseMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.45,
    roughness: 0.18,
    metalness: 0.15,
  });
  const etalase = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.52, 0.56),
    etalaseMat
  );
  etalase.position.set(-0.65, 1.16, 0.15);
  group.add(etalase);

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

  const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.35, 1.05, 4), tarpMat);
  canopy.rotation.y = Math.PI / 4;
  canopy.position.set(0, 2.55, 0);
  canopy.castShadow = true;
  group.add(canopy);

  // Procedural Jakarta warung tenda vinyl banner suspended cleanly under front canopy edge
  const sign = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.52, 0.06), bannerMat);
  sign.position.set(0, 1.88, 0.98);
  group.add(sign);

  // Warm hanging tungsten bulb under canopy roof
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.015, 0.015, 0.42, 6),
    cordMat
  );
  cord.position.set(0, 2.15, 0.12);
  group.add(cord);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bulbMat);
  bulb.position.set(0, 1.9, 0.12);
  group.add(bulb);

  return group;
}

export function buildJakartaBuilding(
  b: BuildingFootprint,
  maxAnisotropy: number
): THREE.Group {
  if (b.style === 'monas') {
    const monas = buildMonasLandmark(maxAnisotropy);
    monas.position.set(b.x, 0, b.z);
    return monas;
  }

  const group = new THREE.Group();
  group.position.set(b.x, 0, b.z);

  const { map: facadeTex, roughnessMap, emissiveMap } =
    proceduralTextures.getBuildingFacadeTextures(
      b.primaryColor,
      b.accentColor,
      b.style,
      maxAnisotropy
    );

  // Deterministic per-building architectural variant selector
  let idHash = 0;
  for (let i = 0; i < b.id.length; i++) {
    idHash = (idHash * 31 + b.id.charCodeAt(i)) >>> 0;
  }

  const graniteMat = new THREE.MeshStandardMaterial({
    color: b.style === 'colonial' ? 0xd6d3d1 : 0x1e2636,
    roughness: 0.78,
    metalness: 0.14,
    envMapIntensity: 0.45,
  });
  const lobbyGlassMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: b.style === 'skyscraper' ? 0xf59e0b : b.accentColor,
    emissiveIntensity: 0.34,
    roughness: 0.16,
    metalness: 0.48,
    envMapIntensity: 1.08,
  });
  const mullionMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.48,
    metalness: 0.56,
    envMapIntensity: 0.72,
  });
  const creamStoneMat = new THREE.MeshStandardMaterial({
    color: 0xf1ece1,
    roughness: 0.76,
    metalness: 0.04,
    envMapIntensity: 0.3,
  });
  const terracottaTileMat = new THREE.MeshStandardMaterial({
    color: 0x9a3412,
    roughness: 0.82,
    metalness: 0.05,
    envMapIntensity: 0.22,
  });
  const foliageMat = new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.1,
  });

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: facadeTex,
    roughnessMap,
    emissive: new THREE.Color(0xffffff),
    emissiveMap,
    emissiveIntensity: 0.68,
    roughness: b.style === 'skyscraper' ? 0.84 : 0.9,
    metalness: b.style === 'skyscraper' ? 0.54 : 0.14,
    envMapIntensity: b.style === 'skyscraper' ? 1.24 : 0.52,
  });

  if (b.style === 'skyscraper') {
    bodyMat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vTowerWorldPos;
varying vec3 vTowerWorldNormal;`
        )
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
vTowerWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
vTowerWorldNormal = normalize(mat3(modelMatrix) * objectNormal);`
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vTowerWorldPos;
varying vec3 vTowerWorldNormal;`
        )
        .replace(
          '#include <dithering_fragment>',
          `vec3 tView = normalize(cameraPosition - vTowerWorldPos);
vec2 roomCell = fract(vTowerWorldPos.xy * 0.24 + vTowerWorldPos.zy * 0.24);
vec2 parallax = (tView.xy - vTowerWorldNormal.xy * dot(tView, vTowerWorldNormal)) * 0.18;
vec2 roomInner = fract(roomCell + parallax);
float roomDepthShade = smoothstep(0.08, 0.38, roomInner.x) * smoothstep(0.92, 0.62, roomInner.x) * smoothstep(0.1, 0.35, roomInner.y);
float glassFresnel = pow(1.0 - max(dot(tView, normalize(vTowerWorldNormal)), 0.0), 3.4);
gl_FragColor.rgb += vec3(0.14, 0.28, 0.44) * glassFresnel * 0.26;
gl_FragColor.rgb *= (0.94 + roomDepthShade * 0.12);
#include <dithering_fragment>`
        );
    };
    bodyMat.customProgramCacheKey = () => 'san-nabilo-tower-parallax-v1';
  }

  const accentMat = new THREE.MeshStandardMaterial({
    color: b.accentColor,
    emissive: b.accentColor,
    emissiveIntensity: 0.48,
    roughness: 0.36,
    metalness: 0.46,
    envMapIntensity: 0.85,
  });

  group.userData.nightEmissiveMats = [bodyMat, lobbyGlassMat, accentMat];

  // Landscaped concrete granite base plinth for all hero buildings
  const basePlinth = new THREE.Mesh(
    new THREE.BoxGeometry(b.width + 1.2, 0.24, b.depth + 1.2),
    graniteMat
  );
  basePlinth.position.y = 0.12;
  basePlinth.receiveShadow = true;
  group.add(basePlinth);

  if (b.style === 'skyscraper') {
    const podiumH = 4.6;
    // Double-height commercial podium + recessed illuminated lobby atrium + colonnade columns
    const podiumCore = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.98, podiumH, b.depth * 0.98),
      graniteMat
    );
    podiumCore.position.y = podiumH * 0.5 + 0.18;
    podiumCore.castShadow = true;
    podiumCore.receiveShadow = true;
    group.add(podiumCore);

    const atriumGlass = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.93, podiumH * 0.72, b.depth * 0.995),
      lobbyGlassMat
    );
    atriumGlass.position.y = podiumH * 0.48 + 0.18;
    group.add(atriumGlass);

    const atriumGlassSide = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.995, podiumH * 0.72, b.depth * 0.91),
      lobbyGlassMat
    );
    atriumGlassSide.position.y = podiumH * 0.48 + 0.18;
    group.add(atriumGlassSide);

    // Architectural podium colonnade piers & entry portico porte-cochere
    for (const px of [-b.width * 0.45, -b.width * 0.22, 0, b.width * 0.22, b.width * 0.45]) {
      for (const pz of [-b.depth * 0.49, b.depth * 0.49]) {
        const col = new THREE.Mesh(
          new THREE.BoxGeometry(0.46, podiumH + 0.15, 0.56),
          mullionMat
        );
        col.position.set(px, podiumH * 0.5 + 0.18, pz);
        group.add(col);
      }
    }

    const porticoRoof = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.58, 0.34, b.depth * 1.16),
      mullionMat
    );
    porticoRoof.position.y = podiumH * 0.88 + 0.18;
    porticoRoof.castShadow = true;
    group.add(porticoRoof);

    const porticoTrim = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.585, 0.12, b.depth * 1.165),
      accentMat
    );
    porticoTrim.position.y = podiumH * 0.88 + 0.36;
    group.add(porticoTrim);

    // Front granite planter boxes flanking entrance
    for (const sideX of [-b.width * 0.34, b.width * 0.34]) {
      for (const sideZ of [b.depth * 0.56, -b.depth * 0.56]) {
        const planter = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.48, 0.95), graniteMat);
        planter.position.set(sideX, 0.42, sideZ);
        const shrub = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.52, 0.7), foliageMat);
        shrub.position.set(sideX, 0.82, sideZ);
        group.add(planter, shrub);
      }
    }

    // 3-Tier Setback Tower Architecture: Lower Shaft -> Sky-Lobby Terrace -> Upper Tapered Tower
    const totalShaftH = Math.max(8, b.height - podiumH);
    const lowerH = totalShaftH * 0.52;
    const skyLobbyH = 2.0;
    const upperH = Math.max(4, totalShaftH - lowerH - skyLobbyH);

    const lowerShaft = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.88, lowerH, b.depth * 0.88),
      bodyMat
    );
    lowerShaft.position.y = podiumH + lowerH * 0.5;
    lowerShaft.castShadow = true;
    lowerShaft.receiveShadow = true;
    group.add(lowerShaft);

    // Horizontal precast curtain-wall spandrel belts every ~6.5m on lower shaft
    const beltGeo = new THREE.BoxGeometry(b.width * 0.91, 0.28, b.depth * 0.91);
    const beltCount = Math.max(1, Math.floor(lowerH / 6.5));
    for (let bi = 1; bi <= beltCount; bi++) {
      const beltY = podiumH + (bi / (beltCount + 1)) * lowerH;
      const belt = new THREE.Mesh(beltGeo, mullionMat);
      belt.position.y = beltY;
      group.add(belt);
    }

    // Vertical corner structural ribs & central glazing fins
    for (const fx of [-b.width * 0.445, -b.width * 0.16, b.width * 0.16, b.width * 0.445]) {
      for (const fz of [-b.depth * 0.445, b.depth * 0.445]) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.36, lowerH + 0.4, 0.36),
          mullionMat
        );
        rib.position.set(fx, podiumH + lowerH * 0.5, fz);
        group.add(rib);
      }
    }

    // Recessed glowing Sky-Lobby Floor Band + Rooftop Terrace Planters
    const skyLobbyY = podiumH + lowerH;
    const skyLobby = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.78, skyLobbyH, b.depth * 0.78),
      lobbyGlassMat
    );
    skyLobby.position.y = skyLobbyY + skyLobbyH * 0.5;
    group.add(skyLobby);

    const skyTerraceSlab = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.92, 0.36, b.depth * 0.92),
      graniteMat
    );
    skyTerraceSlab.position.y = skyLobbyY + 0.18;
    group.add(skyTerraceSlab);

    const skyRimLight = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.93, 0.14, b.depth * 0.93),
      accentMat
    );
    skyRimLight.position.y = skyLobbyY + 0.38;
    group.add(skyRimLight);

    // Upper Tapered Tower Shaft
    const upperStartY = skyLobbyY + skyLobbyH;
    const upperShaft = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.72, upperH, b.depth * 0.72),
      bodyMat
    );
    upperShaft.position.y = upperStartY + upperH * 0.5;
    upperShaft.castShadow = true;
    upperShaft.receiveShadow = true;
    group.add(upperShaft);

    const upperBeltGeo = new THREE.BoxGeometry(b.width * 0.745, 0.26, b.depth * 0.745);
    const uBeltCount = Math.max(1, Math.floor(upperH / 6.0));
    for (let bi = 1; bi <= uBeltCount; bi++) {
      const belt = new THREE.Mesh(upperBeltGeo, mullionMat);
      belt.position.y = upperStartY + (bi / (uBeltCount + 1)) * upperH;
      group.add(belt);
    }

    // Illuminated Crown Band & Mechanical Louver Penthouse
    const roofY = upperStartY + upperH;
    const crownCollar = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.76, 0.72, b.depth * 0.76),
      mullionMat
    );
    crownCollar.position.y = roofY + 0.36;
    group.add(crownCollar);

    const crownNeon = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.77, 0.22, b.depth * 0.77),
      accentMat
    );
    crownNeon.position.y = roofY + 0.56;
    group.add(crownNeon);

    const penthouse = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.44, 2.4, b.depth * 0.44),
      mullionMat
    );
    penthouse.position.y = roofY + 1.9;
    group.add(penthouse);

    // Signature Architectural Skyline Crown Variety
    const crownVariant = b.id.includes('wisma')
      ? 0
      : b.id.includes('scbd') || b.id.includes('bca')
      ? 1
      : idHash % 3;

    if (crownVariant === 0) {
      // Wisma 46 Iconic Twin-Fin "Fountain Pen Nib" Arch Crown
      const archRoof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.min(b.width, b.depth) * 0.42, 7.2, 4),
        bodyMat
      );
      archRoof.rotation.y = Math.PI / 4;
      archRoof.scale.set(1.0, 1.0, 0.48);
      archRoof.position.y = roofY + 4.4;
      group.add(archRoof);

      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.22, 6.8, 8),
        accentMat
      );
      mast.position.y = roofY + 8.8;
      group.add(mast);
    } else if (crownVariant === 1) {
      // SCBD Executive Helipad Deck ("H" Pad + Illuminated Ring) & Twin Communications Spires
      const helipadDeck = new THREE.Mesh(
        new THREE.CylinderGeometry(b.width * 0.32, b.width * 0.28, 0.45, 20),
        graniteMat
      );
      helipadDeck.position.y = roofY + 3.25;
      group.add(helipadDeck);

      const heliRing = new THREE.Mesh(
        new THREE.TorusGeometry(b.width * 0.25, 0.1, 8, 24),
        accentMat
      );
      heliRing.rotation.x = Math.PI / 2;
      heliRing.position.y = roofY + 3.5;
      group.add(heliRing);

      const hBarMat = creamStoneMat;
      const hLeft = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 2.1), hBarMat);
      hLeft.position.set(-0.75, roofY + 3.52, 0);
      const hRight = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 2.1), hBarMat);
      hRight.position.set(0.75, roofY + 3.52, 0);
      const hCross = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.32), hBarMat);
      hCross.position.set(0, roofY + 3.52, 0);
      group.add(hLeft, hRight, hCross);

      for (const sx of [-b.width * 0.24, b.width * 0.24]) {
        const twinSpire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.16, 5.8, 8),
          accentMat
        );
        twinSpire.position.set(sx, roofY + 5.0, -b.depth * 0.2);
        group.add(twinSpire);
      }
    } else {
      // Modernist Glass Lantern Atrium Top + Finial Mast
      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.56, 3.2, b.depth * 0.56),
        lobbyGlassMat
      );
      lantern.position.y = roofY + 2.2;
      group.add(lantern);

      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.2, 6.2, 8),
        accentMat
      );
      spire.position.y = roofY + 6.6;
      group.add(spire);
    }
  } else if (b.style === 'colonial') {
    // Dutch-Indies & Nusantara Heritage Pavilion: Stepped Plinth, Columned Portico, Twin Wings, Hipped Terracotta Roof + Bell Cupola
    const podiumH = 1.6;
    const stonePlinth = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.98, podiumH, b.depth * 0.98),
      creamStoneMat
    );
    stonePlinth.position.y = podiumH * 0.5 + 0.16;
    stonePlinth.castShadow = true;
    stonePlinth.receiveShadow = true;
    group.add(stonePlinth);

    // Ceremonial front entrance stairs
    for (let st = 0; st < 3; st++) {
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.44 - st * 0.6, 0.36, 0.95),
        creamStoneMat
      );
      step.position.set(0, 0.34 + st * 0.36, b.depth * 0.56 - st * 0.35);
      group.add(step);
    }

    const hallH = Math.max(5.5, b.height - podiumH - 3.6);
    const centerHall = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.92, hallH, b.depth * 0.84),
      bodyMat
    );
    centerHall.position.y = podiumH + hallH * 0.5;
    centerHall.castShadow = true;
    centerHall.receiveShadow = true;
    group.add(centerHall);

    // Symmetrical left & right projecting heritage wings
    for (const wx of [-b.width * 0.34, b.width * 0.34]) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.26, hallH + 0.4, b.depth * 0.96),
        bodyMat
      );
      wing.position.set(wx, podiumH + hallH * 0.5, 0);
      wing.castShadow = true;
      group.add(wing);
    }

    // Classical front colonnade columns supporting grand pediment gable
    const colGeo = new THREE.CylinderGeometry(0.24, 0.3, hallH * 0.92, 10);
    for (const cx of [-b.width * 0.26, -b.width * 0.13, 0, b.width * 0.13, b.width * 0.26]) {
      for (const cz of [b.depth * 0.48, -b.depth * 0.48]) {
        const col = new THREE.Mesh(colGeo, creamStoneMat);
        col.position.set(cx, podiumH + hallH * 0.46, cz);
        col.castShadow = true;
        group.add(col);
      }
    }

    const roofBaseY = podiumH + hallH;
    const cornice = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 1.02, 0.58, b.depth * 1.02),
      creamStoneMat
    );
    cornice.position.y = roofBaseY + 0.28;
    group.add(cornice);

    // Hipped clay terracotta main roof
    const mainRoof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(b.width, b.depth) * 0.68, 4.2, 4),
      terracottaTileMat
    );
    mainRoof.rotation.y = Math.PI / 4;
    mainRoof.scale.set(b.width / Math.max(b.width, b.depth), 1.0, b.depth / Math.max(b.width, b.depth));
    mainRoof.position.y = roofBaseY + 2.55;
    mainRoof.castShadow = true;
    group.add(mainRoof);

    // Front triangular pediment gable & Kota Tua central clock cupola tower
    const gable = new THREE.Mesh(
      new THREE.ConeGeometry(b.width * 0.24, 2.4, 3),
      creamStoneMat
    );
    gable.rotation.x = Math.PI / 2;
    gable.rotation.z = Math.PI;
    gable.scale.set(1.2, 0.35, 1.0);
    gable.position.set(0, roofBaseY + 1.15, b.depth * 0.47);
    group.add(gable);

    const cupolaBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.65, 2.8, 8),
      creamStoneMat
    );
    cupolaBase.position.y = roofBaseY + 4.4;
    group.add(cupolaBase);

    const cupolaLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.15, 1.1, 8),
      lobbyGlassMat
    );
    cupolaLantern.position.y = roofBaseY + 5.2;
    group.add(cupolaLantern);

    const cupolaRoof = new THREE.Mesh(
      new THREE.ConeGeometry(1.75, 2.6, 8),
      terracottaTileMat
    );
    cupolaRoof.position.y = roofBaseY + 7.0;
    group.add(cupolaRoof);
  } else if (b.style === 'ruko') {
    // Authentic 3-Bay Multi-Unit Jakarta Ruko Row: Kaki-Lima Arcade, Neon Signboards, Awnings, Balconies & Toren Tanks
    const bays = 3;
    const bayW = (b.width - 0.5) / bays;
    const groundH = 3.2;
    const tankOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.42,
      metalness: 0.08,
    });
    const signPalette = [0xf59e0b, 0xef4444, 0x38bdf8, 0x22c55e];

    // Shaded sidewalk kaki-lima arcade overhang & slender street columns
    const arcadeSlab = new THREE.Mesh(
      new THREE.BoxGeometry(b.width + 0.4, 0.32, b.depth + 2.1),
      graniteMat
    );
    arcadeSlab.position.y = groundH;
    arcadeSlab.castShadow = true;
    group.add(arcadeSlab);

    const colGeo = new THREE.BoxGeometry(0.32, groundH, 0.32);
    for (let bi = 0; bi <= bays; bi++) {
      const cx = -b.width * 0.5 + bi * bayW + (bi === bays ? 0.35 : 0.15);
      for (const cz of [b.depth * 0.5 + 0.72, -b.depth * 0.5 - 0.72]) {
        const pillar = new THREE.Mesh(colGeo, creamStoneMat);
        pillar.position.set(cx, groundH * 0.5, cz);
        group.add(pillar);
      }
    }

    for (let bi = 0; bi < bays; bi++) {
      const unitX = -b.width * 0.5 + (bi + 0.5) * (b.width / bays);
      const unitH = b.height * (0.86 + ((bi + idHash) % 3) * 0.12);
      const upperH = Math.max(3.5, unitH - groundH);

      // Ground floor illuminated shop bay
      const shopBay = new THREE.Mesh(
        new THREE.BoxGeometry(bayW * 0.94, groundH - 0.1, b.depth * 0.88),
        lobbyGlassMat
      );
      shopBay.position.set(unitX, (groundH - 0.1) * 0.5 + 0.12, 0);
      group.add(shopBay);

      // Sloped striped canopy awning above shopfront
      for (const sideSign of [1, -1]) {
        const awning = new THREE.Mesh(
          new THREE.BoxGeometry(bayW * 0.9, 0.24, 1.35),
          bi % 2 === 0 ? accentMat : terracottaTileMat
        );
        awning.position.set(unitX, groundH - 0.22, sideSign * (b.depth * 0.5 + 0.48));
        awning.rotation.x = sideSign * 0.28;
        group.add(awning);

        // Glowing shopfront vertical neon signboard
        const signMat = new THREE.MeshStandardMaterial({
          color: signPalette[(bi + idHash) % signPalette.length],
          emissive: signPalette[(bi + idHash) % signPalette.length],
          emissiveIntensity: 0.72,
          roughness: 0.32,
        });
        const shopSign = new THREE.Mesh(new THREE.BoxGeometry(bayW * 0.76, 0.62, 0.22), signMat);
        shopSign.position.set(unitX, groundH + 0.52, sideSign * (b.depth * 0.5 + 0.18));
        group.add(shopSign);
      }

      // Upper shophouse body + concrete balcony sunshade fins ("topi beton")
      const unitBody = new THREE.Mesh(
        new THREE.BoxGeometry(bayW * 0.94, upperH, b.depth * 0.88),
        bodyMat
      );
      unitBody.position.set(unitX, groundH + upperH * 0.5, 0);
      unitBody.castShadow = true;
      unitBody.receiveShadow = true;
      group.add(unitBody);

      const sunshade = new THREE.Mesh(
        new THREE.BoxGeometry(bayW * 0.96, 0.24, b.depth * 0.98),
        creamStoneMat
      );
      sunshade.position.set(unitX, groundH + upperH * 0.52, 0);
      group.add(sunshade);

      // Sloped ruko roof + iconic orange Indonesian cylindrical Toren water tank on rooftop
      const rukoRoof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(bayW, b.depth) * 0.62, 1.9, 4),
        terracottaTileMat
      );
      rukoRoof.rotation.y = Math.PI / 4;
      rukoRoof.scale.set(bayW / Math.max(bayW, b.depth), 1, b.depth / Math.max(bayW, b.depth));
      rukoRoof.position.set(unitX, groundH + upperH + 0.95, 0);
      rukoRoof.castShadow = true;
      group.add(rukoRoof);

      if ((bi + idHash) % 2 === 0) {
        const tankStand = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.1), mullionMat);
        tankStand.position.set(unitX + bayW * 0.18, groundH + upperH + 0.28, -b.depth * 0.24);
        const toren = new THREE.Mesh(
          new THREE.CylinderGeometry(0.55, 0.58, 1.25, 10),
          tankOrangeMat
        );
        toren.position.set(unitX + bayW * 0.18, groundH + upperH + 1.15, -b.depth * 0.24);
        group.add(tankStand, toren);
      }
    }
  } else if (b.style === 'pasar') {
    // Grand Jakarta Wholesale Hub / Mall (Blok A / Blok M Square / Summarecon): Twin Corner Rotundas, Central Skylight Atrium & LED Marquee
    const podiumH = 4.2;
    const mallBase = new THREE.Mesh(
      new THREE.BoxGeometry(b.width, podiumH, b.depth),
      graniteMat
    );
    mallBase.position.y = podiumH * 0.5 + 0.18;
    mallBase.castShadow = true;
    mallBase.receiveShadow = true;
    group.add(mallBase);

    const upperH = Math.max(6, b.height - podiumH);
    const mallUpper = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.9, upperH, b.depth * 0.88),
      bodyMat
    );
    mallUpper.position.y = podiumH + upperH * 0.5;
    mallUpper.castShadow = true;
    mallUpper.receiveShadow = true;
    group.add(mallUpper);

    // Twin glazed corner rotunda towers
    const rotR = Math.min(b.width, b.depth) * 0.22;
    for (const rx of [-b.width * 0.42, b.width * 0.42]) {
      const rot = new THREE.Mesh(
        new THREE.CylinderGeometry(rotR, rotR, b.height + 1.4, 14),
        lobbyGlassMat
      );
      rot.position.set(rx, (b.height + 1.4) * 0.5, b.depth * 0.36);
      group.add(rot);

      const rotCap = new THREE.Mesh(
        new THREE.CylinderGeometry(rotR + 0.35, rotR + 0.35, 0.45, 14),
        accentMat
      );
      rotCap.position.set(rx, b.height + 1.6, b.depth * 0.36);
      group.add(rotCap);
    }

    // Glowing front mall drop-off marquee & rooftop curved sky-atrium barrel vault
    const marquee = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.62, 1.35, b.depth * 1.04),
      accentMat
    );
    marquee.position.y = podiumH + 0.55;
    group.add(marquee);

    const skylightVault = new THREE.Mesh(
      new THREE.CylinderGeometry(b.depth * 0.28, b.depth * 0.28, b.width * 0.72, 14, 1, false, 0, Math.PI),
      lobbyGlassMat
    );
    skylightVault.rotation.z = Math.PI / 2;
    skylightVault.position.y = b.height + 0.1;
    group.add(skylightVault);
  } else {
    // 'port_crane': High-Speed Whoosh Terminal / Port Logistics Hangar with Arched Roof Vault, Loading Bays & Yard Gantry
    const hallH = Math.max(7, b.height * 0.68);
    const hallBody = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.94, hallH, b.depth * 0.88),
      bodyMat
    );
    hallBody.position.y = hallH * 0.5 + 0.18;
    hallBody.castShadow = true;
    hallBody.receiveShadow = true;
    group.add(hallBody);

    // Wide arched steel terminal vault roof
    const vaultR = b.depth * 0.48;
    const barrelRoof = new THREE.Mesh(
      new THREE.CylinderGeometry(vaultR, vaultR, b.width * 0.98, 16, 1, false, 0, Math.PI),
      graniteMat
    );
    barrelRoof.rotation.z = Math.PI / 2;
    barrelRoof.scale.set(0.45, 1, 1);
    barrelRoof.position.y = hallH + 0.18;
    barrelRoof.castShadow = true;
    group.add(barrelRoof);

    // Steel structural arch ribs across barrel vault
    for (const rx of [-b.width * 0.38, -b.width * 0.13, b.width * 0.13, b.width * 0.38]) {
      const archRib = new THREE.Mesh(
        new THREE.CylinderGeometry(vaultR + 0.25, vaultR + 0.25, 0.42, 16, 1, false, 0, Math.PI),
        accentMat
      );
      archRib.rotation.z = Math.PI / 2;
      archRib.scale.set(0.46, 1, 1);
      archRib.position.set(rx, hallH + 0.2, 0);
      group.add(archRib);
    }

    // Illuminated glazing clerestory & loading bay roll-up doors
    const clerestory = new THREE.Mesh(
      new THREE.BoxGeometry(b.width * 0.84, 1.4, b.depth * 0.92),
      lobbyGlassMat
    );
    clerestory.position.y = hallH - 1.1;
    group.add(clerestory);

    for (const dx of [-b.width * 0.3, 0, b.width * 0.3]) {
      const bayDoor = new THREE.Mesh(
        new THREE.BoxGeometry(b.width * 0.2, 3.2, b.depth * 0.91),
        mullionMat
      );
      bayDoor.position.set(dx, 1.8, 0);
      group.add(bayDoor);
    }

    // Exterior yard gantry crane frame flanking one side (standing on ground, NOT floating on roof)
    const gantryX = b.width * 0.5 + 1.3;
    const gantryH = hallH + 4.8;
    for (const gz of [-b.depth * 0.36, b.depth * 0.36]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.65, gantryH, 0.65), accentMat);
      leg.position.set(gantryX, gantryH * 0.5, gz);
      group.add(leg);
    }
    const gantryCross = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.85, b.depth * 0.86),
      accentMat
    );
    gantryCross.position.set(gantryX, gantryH + 0.2, 0);
    group.add(gantryCross);
  }

  return group;
}

export function buildJakartaIconicLandmarks(): THREE.Group {
  const landmarksGroup = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.86,
    metalness: 0.04,
    envMapIntensity: 0.08,
  });
  const darkSlateMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.88,
    metalness: 0.06,
    envMapIntensity: 0.08,
  });
  const bronzeMat = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.58,
    metalness: 0.42,
    envMapIntensity: 0.14,
  });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0369a1,
    emissiveIntensity: 0.24,
    roughness: 0.14,
    metalness: 0.52,
    envMapIntensity: 0.95,
  });

  // 1. Bundaran HI Fountain & Patung Selamat Datang Plaza RIGHT AT Thamrin Roundabout (0, 0, +32)
  const hiGroup = new THREE.Group();
  hiGroup.position.set(0, 0, 32);

  const plazaApron = new THREE.Mesh(
    new THREE.CylinderGeometry(5.4, 5.6, 0.16, 28),
    darkSlateMat
  );
  plazaApron.position.y = 0.08;
  hiGroup.add(plazaApron);

  const basinRim = new THREE.Mesh(
    new THREE.CylinderGeometry(4.6, 4.9, 0.65, 24),
    darkSlateMat
  );
  basinRim.position.y = 0.36;
  hiGroup.add(basinRim);

  const waterPool = new THREE.Mesh(
    new THREE.CylinderGeometry(4.2, 4.2, 0.72, 24),
    waterMat
  );
  waterPool.position.y = 0.38;
  hiGroup.add(waterPool);

  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.8, 0.14, 8, 24),
    stoneMat
  );
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.78;
  hiGroup.add(innerRing);

  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.85, 1.25, 5.8, 10),
    stoneMat
  );
  pedestal.position.y = 3.1;
  pedestal.castShadow = true;
  hiGroup.add(pedestal);

  // Twin welcoming bronze figures waving aloft
  for (const sx of [-0.36, 0.36]) {
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 1.35, 4, 8),
      bronzeMat
    );
    torso.position.set(sx, 6.75, 0);
    hiGroup.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      bronzeMat
    );
    head.position.set(sx, 7.75, 0);
    hiGroup.add(head);

    const raisedArm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.09, 1.05, 6),
      bronzeMat
    );
    raisedArm.position.set(sx * 1.65, 7.65, 0.15);
    raisedArm.rotation.z = sx < 0 ? 0.45 : -0.45;
    hiGroup.add(raisedArm);
  }
  landmarksGroup.add(hiGroup);

  // 2. Masjid Istiqlal Grand Geodesic Dome & Minaret (NE of Monas at +20, 0, -17)
  const istiqlalGroup = new THREE.Group();
  istiqlalGroup.position.set(20, 0, -17);

  const istiqlalPlaza = new THREE.Mesh(
    new THREE.BoxGeometry(16.5, 0.18, 15.5),
    darkSlateMat
  );
  istiqlalPlaza.position.y = 0.09;
  istiqlalPlaza.receiveShadow = true;
  istiqlalGroup.add(istiqlalPlaza);

  const hallBase = new THREE.Mesh(
    new THREE.BoxGeometry(11.5, 4.2, 11.5),
    stoneMat
  );
  hallBase.position.y = 2.15;
  hallBase.castShadow = true;
  hallBase.receiveShadow = true;
  istiqlalGroup.add(hallBase);

  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.78,
    metalness: 0.08,
    envMapIntensity: 0.08,
  });
  const grandDome = new THREE.Mesh(
    new THREE.SphereGeometry(4.8, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
    domeMat
  );
  grandDome.position.y = 4.15;
  grandDome.castShadow = true;
  istiqlalGroup.add(grandDome);

  const crescentSpire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.14, 2.4, 8),
    bronzeMat
  );
  crescentSpire.position.y = 9.65;
  istiqlalGroup.add(crescentSpire);

  // Modernist perimeter louver colonnade gallery around Istiqlal courtyard
  for (let li = -4; li <= 4; li += 2) {
    const colF = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.6, 0.58), domeMat);
    colF.position.set(li * 1.35, 2.3, 6.2);
    const colB = new THREE.Mesh(new THREE.BoxGeometry(0.42, 4.6, 0.58), domeMat);
    colB.position.set(li * 1.35, 2.3, -6.2);
    istiqlalGroup.add(colF, colB);
  }

  const minaret = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.68, 17.5, 10),
    domeMat
  );
  minaret.position.set(5.2, 8.75, 5.2);
  minaret.castShadow = true;
  istiqlalGroup.add(minaret);

  const minaretCap = new THREE.Mesh(
    new THREE.ConeGeometry(0.65, 2.6, 10),
    bronzeMat
  );
  minaretCap.position.set(5.2, 18.6, 5.2);
  istiqlalGroup.add(minaretCap);
  landmarksGroup.add(istiqlalGroup);

  // 3. Gelora Bung Karno (GBK) Stadium Temu Gelang Ring (SW of Semanggi at -58, 0, +56)
  const gbkGroup = new THREE.Group();
  gbkGroup.position.set(-58, 0, 56);

  const gbkPlaza = new THREE.Mesh(
    new THREE.CylinderGeometry(16.5, 16.8, 0.18, 32),
    darkSlateMat
  );
  gbkPlaza.position.y = 0.09;
  gbkPlaza.receiveShadow = true;
  gbkGroup.add(gbkPlaza);

  const stadiumBowl = new THREE.Mesh(
    new THREE.CylinderGeometry(11.2, 9.2, 5.4, 24, 1, true),
    darkSlateMat
  );
  stadiumBowl.position.y = 2.7;
  gbkGroup.add(stadiumBowl);

  const pitchTurf = new THREE.Mesh(
    new THREE.CircleGeometry(8.8, 24),
    new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.05,
    })
  );
  pitchTurf.rotation.x = -Math.PI / 2;
  pitchTurf.position.y = 0.2;
  gbkGroup.add(pitchTurf);

  const roofRing = new THREE.Mesh(
    new THREE.TorusGeometry(10.2, 1.35, 10, 28),
    domeMat
  );
  roofRing.rotation.x = Math.PI / 2;
  roofRing.scale.set(1, 1, 0.42);
  roofRing.position.y = 5.6;
  gbkGroup.add(roofRing);

  // Iconic "Temu Gelang" radial structural facade ribs + 4 stadium floodlight towers
  for (let ri = 0; ri < 16; ri++) {
    const a = (ri / 16) * Math.PI * 2;
    const ribCol = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5.8, 0.9), domeMat);
    ribCol.position.set(Math.cos(a) * 11.4, 2.9, Math.sin(a) * 11.4);
    ribCol.rotation.y = -a;
    gbkGroup.add(ribCol);
  }
  const mastMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xfef9c3,
    emissiveIntensity: 0.65,
    roughness: 0.35,
  });
  for (const [mx, mz] of [
    [-11.8, -11.8],
    [11.8, -11.8],
    [-11.8, 11.8],
    [11.8, 11.8],
  ]) {
    const mastPole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 11.5, 8), darkSlateMat);
    mastPole.position.set(mx, 5.75, mz);
    const mastHead = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.95, 0.55), mastMat);
    mastHead.position.set(mx, 11.4, mz);
    mastHead.lookAt(0, 2, 0);
    gbkGroup.add(mastPole, mastHead);
  }

  const gbkAccentRing = new THREE.Mesh(
    new THREE.TorusGeometry(11.35, 0.18, 8, 28),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.25,
      roughness: 0.65,
    })
  );
  gbkAccentRing.rotation.x = Math.PI / 2;
  gbkAccentRing.position.y = 5.65;
  gbkGroup.add(gbkAccentRing);
  landmarksGroup.add(gbkGroup);

  // 4. Pelabuhan Tanjung Priok Container Stacks & Harbor Quay Gantry Crane (+106, 0, -49)
  const priokGroup = new THREE.Group();
  priokGroup.position.set(106, 0, -49);

  const yardSlab = new THREE.Mesh(
    new THREE.BoxGeometry(16, 0.18, 16),
    darkSlateMat
  );
  yardSlab.position.y = 0.09;
  yardSlab.receiveShadow = true;
  priokGroup.add(yardSlab);

  const craneOrangeMat = new THREE.MeshStandardMaterial({
    color: 0xea580c,
    roughness: 0.48,
    metalness: 0.42,
  });
  for (const gx of [-5.8, 5.8]) {
    for (const gz of [-5.2, 5.2]) {
      const craneLeg = new THREE.Mesh(new THREE.BoxGeometry(0.65, 11.5, 0.65), craneOrangeMat);
      craneLeg.position.set(gx, 5.75, gz);
      priokGroup.add(craneLeg);
    }
  }
  const craneGantryGirder = new THREE.Mesh(new THREE.BoxGeometry(13.8, 1.0, 1.4), craneOrangeMat);
  craneGantryGirder.position.set(0, 11.6, 0);
  const craneBoom = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 15.6), craneOrangeMat);
  craneBoom.position.set(0, 12.1, -1.8);
  priokGroup.add(craneGantryGirder, craneBoom);

  const containerColors = [0xdc2626, 0x0284c7, 0xd97706, 0x15803d];
  const containerGeo = new THREE.BoxGeometry(2.6, 2.4, 5.8);
  containerColors.forEach((hex, idx) => {
    const cMat = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.84,
      metalness: 0.14,
      envMapIntensity: 0.08,
    });
    const row = Math.floor(idx / 2);
    const col = idx % 2;
    const stackBottom = new THREE.Mesh(containerGeo, cMat);
    stackBottom.position.set(col * 3.1 - 1.5, 1.2, row * 6.4 - 3.2);
    stackBottom.castShadow = true;
    priokGroup.add(stackBottom);

    const stackTop = new THREE.Mesh(containerGeo, cMat);
    stackTop.position.set(col * 3.1 - 1.5, 3.65, row * 6.4 - 3.2);
    stackTop.castShadow = true;
    priokGroup.add(stackTop);
  });
  landmarksGroup.add(priokGroup);

  return landmarksGroup;
}


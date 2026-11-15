import * as THREE from 'three';
import { generateRoadsideSpawnLayout } from '../racing';
import type {
  TollSignSpawn,
  TrafficSignKind,
  TrafficSignSpawn,
  TransJakartaHalteSpawn,
  WeatherMode,
} from '../types';
import {
  createHalteBoardTexture,
  createHalteTotemTexture,
  createTollSignTexture,
  createTrafficSignTexture,
} from './roadTextures';
import type { SidewalkRect } from './textures';

export function buildAuthenticRoadsideSystem(
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

  const circleBackingGeo = trackGeo(
    new THREE.CylinderGeometry(0.43, 0.43, 0.032, 24)
  );
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
  const tollCantileverMastGeo = trackGeo(
    new THREE.CylinderGeometry(0.16, 0.21, 6.2, 10)
  );
  tollCantileverMastGeo.translate(0, 3.1, 0);
  const tollBoomGeo = trackGeo(new THREE.BoxGeometry(4.4, 0.22, 0.22));
  const tollGussetGeo = trackGeo(new THREE.BoxGeometry(2.4, 0.14, 0.14));
  const tollTwinPostGeo = trackGeo(
    new THREE.CylinderGeometry(0.13, 0.16, 5.2, 10)
  );
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
        const arm = new THREE.Mesh(hoodGeo, darkSteelMat);
        arm.position.set(cx + ox, cy + 0.96, 0.24);
        const bulb = new THREE.Mesh(hoodBulbGeo, hoodLampMat);
        bulb.position.set(cx + ox, cy + 0.89, 0.28);
        tGrp.add(arm, bulb);
      }
    };

    if (ts.variant === 'cantilever') {
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

  // 3. Build Halte TransJakarta Shelters
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
  const railPostGeo = trackGeo(
    new THREE.CylinderGeometry(0.035, 0.035, 0.92, 8)
  );
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

    for (const cx of [-0.98, 0.92]) {
      for (const cz of [-4.05, 4.05]) {
        const col = new THREE.Mesh(halteColGeo, darkSteelMat);
        col.position.set(cx, 0, cz);
        col.castShadow = true;
        hGrp.add(col);
      }
    }

    const roof = new THREE.Mesh(halteRoofGeo, aluminumBackMat);
    roof.position.set(0.05, 3.3, 0);
    roof.castShadow = true;
    const fascia = new THREE.Mesh(halteFasciaGeo, halteRoofMat);
    fascia.position.set(0.05, 3.16, 0);
    const ledRim = new THREE.Mesh(halteLedGeo, halteLedMat);
    ledRim.position.set(0.05, 3.06, 0);
    hGrp.add(roof, fascia, ledRim);

    const backGlass = new THREE.Mesh(halteGlassGeo, halteGlassMat);
    backGlass.position.set(-0.98, 1.48, 0);
    hGrp.add(backGlass);
    for (const mz of [-2.05, 0, 2.05]) {
      const mullion = new THREE.Mesh(mullionGeo, darkSteelMat);
      mullion.position.set(-0.98, 1.48, mz);
      hGrp.add(mullion);
    }

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

    for (const tz of [-2.35, 2.35]) {
      const gate = new THREE.Mesh(turnstileBodyGeo, darkSteelMat);
      gate.position.set(0.42, 0.7, tz);
      const pad = new THREE.Mesh(turnstilePadGeo, nfcPadMat);
      pad.position.set(0.42, 1.18, tz + (tz < 0 ? 0.16 : -0.16));
      hGrp.add(gate, pad);
    }

    const benchSeat = new THREE.Mesh(benchSeatGeo, galvanizedSteelMat);
    benchSeat.position.set(-0.56, 0.66, 0);
    hGrp.add(benchSeat);
    for (const lz of [-1.05, 0, 1.05]) {
      const leg = new THREE.Mesh(benchLegGeo, darkSteelMat);
      leg.position.set(-0.56, 0.45, lz);
      hGrp.add(leg);
    }

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

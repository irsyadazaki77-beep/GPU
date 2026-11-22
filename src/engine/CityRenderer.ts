import * as THREE from 'three';
import {
  BuildingFootprint,
  CITY_BUILDINGS,
  JAKARTA_FLOOD_ZONES,
  NUSANTARA_PACKAGES,
  STUNT_RAMPS_CATALOG,
  SpatialHashGrid,
  TrafficSignalPhase,
  createBuildingSpatialGrid,
  isNearBuilding,
  isOnRoadway,
} from '../game/rules';
import {
  SidewalkRect,
  buildAuthenticRoadsideSystem,
  buildElevatedHighwayMesh,
  buildInteriorPortalsAndStage,
  buildJakartaBuilding,
  buildJakartaIconicLandmarks,
  buildJakartaStreetscape,
  buildProceduralRoadDetailSystem,
  buildWarungStall,
} from '../game/world/geometryBuilders';
import { buildJakartaDistrictProps } from '../game/world/jakartaDistrictProps';
import { buildThreeTierBuildingLOD } from './lodBuilder';
import { SpatialChunkLoader } from './chunkLoader';
import { proceduralTextures } from './ProceduralTextures';
import {
  Point2D,
  computeTimeOfDayToneState,
  selectNearestLightIndices,
} from './visualOverhaulMath';

function buildExpansionZonesGroup(uTimeUniform: { value: number }): {
  group: THREE.Group;
  bayWaterMat: THREE.MeshStandardMaterial;
} {
  const group = new THREE.Group();
  group.name = 'JakartaExpansionZonesGroup';

  // 1. Jakarta Bay & Kepulauan Seribu Water Basin (North Z <= -72 .. -248), GPU vertex wave shader
  const bayWaterMat = new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.18,
    metalness: 0.65,
    envMapIntensity: 0.55,
    transparent: true,
    opacity: 0.88,
  });
  bayWaterMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying vec3 vWaterWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float sanWaveY = sin(position.x * 0.14 + uTime * 2.1) * 0.11 + cos(position.z * 0.18 + uTime * 2.6) * 0.08;
transformed.y += sanWaveY;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying vec3 vWaterWorldPos;`
      )
      .replace(
        '#include <dithering_fragment>',
        `vec3 wView = normalize(cameraPosition - vWaterWorldPos);
float r1 = sin(vWaterWorldPos.x * 0.65 + uTime * 2.2) * cos(vWaterWorldPos.z * 0.55 - uTime * 1.8);
float r2 = sin((vWaterWorldPos.x + vWaterWorldPos.z) * 1.15 - uTime * 3.1);
vec3 rippleN = normalize(vec3(r1 * 0.12, 1.0, r2 * 0.12));
float wFresnel = pow(1.0 - max(dot(wView, rippleN), 0.0), 3.0);
float sparkle = pow(max(dot(reflect(-wView, rippleN), normalize(vec3(0.45, 0.55, 0.7))), 0.0), 28.0);
float shoreEdge = smoothstep(-80.0, -72.8, vWaterWorldPos.z);
float foamLine = shoreEdge * (0.55 + 0.45 * sin(vWaterWorldPos.x * 0.8 + uTime * 3.6 + r1 * 2.0));
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.28, 0.56, 0.78), wFresnel * 0.48);
gl_FragColor.rgb += vec3(0.95, 0.92, 0.82) * sparkle * 0.38;
gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.88, 0.96, 1.0), clamp(foamLine * 0.65, 0.0, 0.72));
#include <dithering_fragment>`
      );
  };
  bayWaterMat.customProgramCacheKey = () => 'san-nabilo-bay-waves-v2';

  const bayGeo = new THREE.PlaneGeometry(540, 175, 48, 18);
  bayGeo.rotateX(-Math.PI / 2);
  const bayMesh = new THREE.Mesh(bayGeo, bayMatOrFallback(bayWaterMat));
  bayMesh.position.set(0, -0.02, -160);
  group.add(bayMesh);

  // Kepulauan Seribu Coral Atolls & Speedboat Jetty Pier
  const sandMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3d1,
    roughness: 0.88,
    metalness: 0.04,
  });
  const reefPositions: [number, number, number, number][] = [
    [-48, 0.35, -83, 7.5],
    [92, 0.35, -148, 9.2],
    [-118, 0.35, -152, 8.6],
  ];
  for (const [rx, ry, rz, rad] of reefPositions) {
    const reefIsland = new THREE.Mesh(
      new THREE.CylinderGeometry(rad, rad + 2.2, 1.2, 16),
      sandMat
    );
    reefIsland.position.set(rx, ry, rz);
    group.add(reefIsland);
  }

  const jettyMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.75,
    metalness: 0.2,
  });
  const jettyDeck = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.4, 14),
    jettyMat
  );
  jettyDeck.position.set(-28, 0.35, -75);
  group.add(jettyDeck);

  // 2. Tanjung Priok Port Shipping Container Stacks & Gantry Crane Yard
  const containerColors = [0x0284c7, 0xea580c, 0x16a34a, 0xdc2626];
  const containerGeo = new THREE.BoxGeometry(2.6, 2.5, 6.2);
  for (let row = 0; row < 3; row++) {
    for (let tier = 0; tier < 2; tier++) {
      const cMat = new THREE.MeshStandardMaterial({
        color: containerColors[(row + tier) % containerColors.length],
        roughness: 0.62,
        metalness: 0.32,
      });
      const box = new THREE.Mesh(containerGeo, cMat);
      box.position.set(46 + row * 3.2, 1.25 + tier * 2.55, -68);
      group.add(box);
    }
  }

  // 3. Semanggi Elevated Tollway Cloverleaf Neon Arch Portals
  const archMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x38bdf8,
    emissiveIntensity: 0.75,
    roughness: 0.35,
    metalness: 0.6,
  });
  for (const ax of [-28, 0, 28]) {
    const archBeam = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.55, 9.4),
      archMat
    );
    archBeam.position.set(ax, 10.6, -26);
    group.add(archBeam);
  }

  return { group, bayWaterMat };
}

function bayMatOrFallback(mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  return mat;
}

function disposeObjectTree(root: THREE.Object3D): void {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();
  const disposedTex = new Set<THREE.Texture>();

  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
      if (obj.geometry && !disposedGeos.has(obj.geometry)) {
        disposedGeos.add(obj.geometry);
        obj.geometry.dispose();
      }
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m || disposedMats.has(m)) continue;
        disposedMats.add(m);
        const std = m as THREE.MeshStandardMaterial;
        for (const tex of [
          std.map,
          std.emissiveMap,
          std.roughnessMap,
          std.bumpMap,
          std.normalMap,
        ]) {
          if (tex && !disposedTex.has(tex)) {
            disposedTex.add(tex);
            tex.dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

export class CityRenderer {
  public readonly rootGroup = new THREE.Group();
  public readonly buildingGrid: SpatialHashGrid<BuildingFootprint>;
  public readonly chunkLoader: SpatialChunkLoader;

  private readonly roadMat: THREE.MeshStandardMaterial;
  private readonly spireBeaconMat: THREE.MeshBasicMaterial;
  private readonly bayWaterMat: THREE.MeshStandardMaterial;
  private readonly collectibleMeshes = new Map<string, THREE.Group>();
  private lastCollectedCount = -1;
  private lastCollectedFirstId: string | undefined;
  private collectedIdSet = new Set<string>();
  private readonly streetscape: ReturnType<typeof buildJakartaStreetscape>;
  private readonly districtProps: ReturnType<typeof buildJakartaDistrictProps>;
  private readonly roadDetailSystem: ReturnType<
    typeof buildProceduralRoadDetailSystem
  >;
  private readonly roadsideSystem: ReturnType<
    typeof buildAuthenticRoadsideSystem
  >;
  private readonly buildingEmissiveMats: THREE.MeshStandardMaterial[] = [];
  private readonly streetlightAnchors: Point2D[] = [];
  private readonly streetlightPool: THREE.PointLight[] = [];
  private readonly roadUniforms = {
    uWetness: { value: 0 },
    uNightFactor: { value: 0.5 },
    uTime: { value: 0 },
  };
  private elapsedTime = 0;

  constructor(scene: THREE.Scene, maxAnisotropy: number) {
    this.buildingGrid = createBuildingSpatialGrid(CITY_BUILDINGS, 18);
    this.chunkLoader = new SpatialChunkLoader(scene, CITY_BUILDINGS, {
      chunkSize: 120,
      activeRadiusChunks: 1,
      maxOpsPerFrame: 2,
    });
    this.chunkLoader.updateAroundPlayer(0, 26, true);

    const expZones = buildExpansionZonesGroup(this.roadUniforms.uTime);
    this.bayWaterMat = expZones.bayWaterMat;
    this.rootGroup.add(expZones.group);

    // 10 Glowing Koper Emas Nusantara Collectibles
    const pkgMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.4,
      metalness: 0.85,
      roughness: 0.22,
    });
    const pkgRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pkgBoxGeo = new THREE.BoxGeometry(0.92, 0.58, 0.42);
    const pkgRingGeo = new THREE.RingGeometry(0.95, 1.25, 20);
    pkgRingGeo.rotateX(-Math.PI / 2);
    for (const pkg of NUSANTARA_PACKAGES) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(pkgBoxGeo, pkgMat);
      box.position.y = 0.55;
      const ring = new THREE.Mesh(pkgRingGeo, pkgRingMat);
      ring.position.y = -0.52;
      g.add(box, ring);
      g.position.set(pkg.x, pkg.y, pkg.z);
      this.rootGroup.add(g);
      this.collectibleMeshes.set(pkg.id, g);
    }

    // 1. Extended Terrain & Monas Plaza
    const groundGeo = new THREE.PlaneGeometry(760, 760);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f1a14,
      roughness: 0.96,
      metalness: 0.02,
      envMapIntensity: 0.06,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    this.rootGroup.add(groundMesh);

    const plazaGeo = new THREE.CircleGeometry(18.5, 48);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x222b3a,
      roughness: 0.92,
      metalness: 0.02,
      envMapIntensity: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.position.y = 0.072;
    plazaMesh.receiveShadow = true;
    this.rootGroup.add(plazaMesh);

    const plazaCurbGeo = new THREE.RingGeometry(18.15, 18.85, 48);
    plazaCurbGeo.rotateX(-Math.PI / 2);
    const plazaCurbMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const plazaCurbMesh = new THREE.Mesh(plazaCurbGeo, plazaCurbMat);
    plazaCurbMesh.position.y = 0.078;
    plazaCurbMesh.receiveShadow = true;
    this.rootGroup.add(plazaCurbMesh);

    // 2. Asphalt Boulevards (Procedural PBR Albedo + Bump + Roughness + Wet Puddle Shader)
    const asphaltPbr = proceduralTextures.getAsphaltTextures(
      maxAnisotropy,
      'standard'
    );
    asphaltPbr.map.repeat.set(1, 18);
    asphaltPbr.bumpMap.repeat.set(1, 18);
    asphaltPbr.roughnessMap.repeat.set(1, 18);

    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphaltPbr.map,
      bumpMap: asphaltPbr.bumpMap,
      bumpScale: 0.045,
      roughnessMap: asphaltPbr.roughnessMap,
      roughness: 0.88,
      metalness: 0.04,
      envMapIntensity: 0.34,
    });

    this.roadMat.onBeforeCompile = (shader) => {
      shader.uniforms.uWetness = this.roadUniforms.uWetness;
      shader.uniforms.uNightFactor = this.roadUniforms.uNightFactor;
      shader.uniforms.uTime = this.roadUniforms.uTime;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vRoadWorldPos;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uWetness;
uniform float uNightFactor;
uniform float uTime;
varying vec3 vRoadWorldPos;

float roadHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float roadNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(roadHash(i), roadHash(i + vec2(1.0, 0.0)), u.x),
    mix(roadHash(i + vec2(0.0, 1.0)), roadHash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
float sanPuddleMask = 0.0;
if (uWetness > 0.04) {
  float sanPuddleField = roadNoise(vRoadWorldPos.xz * 0.14) * 0.65 + roadNoise(vRoadWorldPos.xz * 0.37) * 0.35;
  sanPuddleMask = smoothstep(0.56 - uWetness * 0.36, 0.72 - uWetness * 0.3, sanPuddleField) * uWetness;
  roughnessFactor = mix(roughnessFactor, 0.075, sanPuddleMask);
}`
        )
        .replace(
          '#include <dithering_fragment>',
          `if (uWetness > 0.06 && sanPuddleMask > 0.01) {
  vec3 viewDirW = normalize(cameraPosition - vRoadWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDirW, vec3(0.0, 1.0, 0.0)), 0.0), 2.8);
  vec3 sunsetSkyRef = mix(vec3(0.42, 0.22, 0.34), vec3(0.08, 0.14, 0.32), uNightFactor);
  float neonBand = roadNoise(vRoadWorldPos.xz * 0.085);
  vec3 coralAmber = mix(vec3(1.0, 0.38, 0.5), vec3(0.98, 0.64, 0.16), smoothstep(0.2, 0.8, neonBand));
  vec3 viceCyan = vec3(0.14, 0.84, 0.96);
  vec3 neonTint = mix(coralAmber, viceCyan, smoothstep(0.45, 0.78, roadNoise(vRoadWorldPos.xz * 0.06 + vec2(3.1, 1.7))));
  float rainRippleAmp = smoothstep(0.6, 0.95, uWetness);
  float rippleCell = sin(length(fract(vRoadWorldPos.xz * 0.72) - 0.5) * 28.0 - uTime * 9.5);
  float rippleSpark = smoothstep(0.92, 1.0, rippleCell) * sanPuddleMask * 0.10 * rainRippleAmp;
  gl_FragColor.rgb += (sunsetSkyRef * 0.24 + neonTint * (0.08 + uNightFactor * 0.14)) * (sanPuddleMask * (0.28 + fresnel * 0.52)) + vec3(rippleSpark);
}
#include <dithering_fragment>`
        );
    };
    this.roadMat.customProgramCacheKey = () => 'san-nabilo-wet-asphalt-v3';

    // Primary N-S Thamrin-Sudirman Corridor (x=0, z in [-72..214])
    const nsRoadGeo = new THREE.PlaneGeometry(14, 286);
    nsRoadGeo.rotateX(-Math.PI / 2);
    const nsRoad = new THREE.Mesh(nsRoadGeo, this.roadMat);
    nsRoad.position.set(0, 0.036, 71);
    nsRoad.receiveShadow = true;
    this.rootGroup.add(nsRoad);

    // Primary E-W Medan Merdeka Corridor (z=0)
    const ewRoadGeo = new THREE.PlaneGeometry(14, 434);
    ewRoadGeo.rotateX(-Math.PI / 2);
    ewRoadGeo.rotateY(Math.PI / 2);
    const ewRoad = new THREE.Mesh(ewRoadGeo, this.roadMat);
    ewRoad.position.set(0, 0.044, 0);
    ewRoad.receiveShadow = true;
    this.rootGroup.add(ewRoad);

    // Bundaran HI Asphalt Traffic Roundabout Ring around Patung Selamat Datang (0, +32)
    const hiRingGeo = new THREE.RingGeometry(5.5, 11.4, 40);
    hiRingGeo.rotateX(-Math.PI / 2);
    const hiRing = new THREE.Mesh(hiRingGeo, this.roadMat);
    hiRing.position.set(0, 0.046, 32);
    hiRing.receiveShadow = true;
    this.rootGroup.add(hiRing);

    // Inner Urban Grid Corridors (x = +-32, z = +-32)
    for (const offset of [-32, 32]) {
      const hRoadGeo = new THREE.PlaneGeometry(10, 434);
      hRoadGeo.rotateX(-Math.PI / 2);
      hRoadGeo.rotateY(Math.PI / 2);
      const hRoad = new THREE.Mesh(hRoadGeo, this.roadMat);
      hRoad.position.set(0, 0.02, offset);
      this.rootGroup.add(hRoad);

      const vRoadGeo = new THREE.PlaneGeometry(10, 288);
      vRoadGeo.rotateX(-Math.PI / 2);
      const vRoad = new THREE.Mesh(vRoadGeo, this.roadMat);
      vRoad.position.set(offset, 0.028, 72);
      this.rootGroup.add(vRoad);
    }

    // District Arteri Grid (x = +-84 Tanah Abang/GBK & Kemayoran/SCBD/Halim; z = -66 Coastal North, z = +80 Semanggi-Gatot Subroto)
    for (const artX of [-84, 84]) {
      const artGeo = new THREE.PlaneGeometry(10, 286);
      artGeo.rotateX(-Math.PI / 2);
      const artRoad = new THREE.Mesh(artGeo, this.roadMat);
      artRoad.position.set(artX, 0.024, 72);
      this.rootGroup.add(artRoad);
    }
    for (const artZ of [-66, 80]) {
      const artHGeo = new THREE.PlaneGeometry(11, 432);
      artHGeo.rotateX(-Math.PI / 2);
      artHGeo.rotateY(Math.PI / 2);
      const artHRoad = new THREE.Mesh(artHGeo, this.roadMat);
      artHRoad.position.set(0, 0.024, artZ);
      this.rootGroup.add(artHRoad);
    }

    // Outer Jakarta Ring Boulevard (x = +-128, z = +128)
    const outerRingSouthGeo = new THREE.PlaneGeometry(12, 428);
    outerRingSouthGeo.rotateX(-Math.PI / 2);
    outerRingSouthGeo.rotateY(Math.PI / 2);
    const outerRingSouth = new THREE.Mesh(outerRingSouthGeo, this.roadMat);
    outerRingSouth.position.set(0, 0.024, 128);
    this.rootGroup.add(outerRingSouth);

    for (const sideX of [-128, 128]) {
      const outerSideGeo = new THREE.PlaneGeometry(12, 282);
      outerSideGeo.rotateX(-Math.PI / 2);
      const outerSide = new THREE.Mesh(outerSideGeo, this.roadMat);
      outerSide.position.set(sideX, 0.026, 73);
      this.rootGroup.add(outerSide);
    }

    // JORR Outer Perimeter Loop (x = +-208, z = +208)
    const jorrSouthGeo = new THREE.PlaneGeometry(14, 430);
    jorrSouthGeo.rotateX(-Math.PI / 2);
    jorrSouthGeo.rotateY(Math.PI / 2);
    const jorrSouth = new THREE.Mesh(jorrSouthGeo, this.roadMat);
    jorrSouth.position.set(0, 0.023, 208);
    this.rootGroup.add(jorrSouth);

    for (const sideX of [-208, 208]) {
      const jorrSideGeo = new THREE.PlaneGeometry(14, 286);
      jorrSideGeo.rotateX(-Math.PI / 2);
      const jorrSide = new THREE.Mesh(jorrSideGeo, this.roadMat);
      jorrSide.position.set(sideX, 0.025, 72);
      this.rootGroup.add(jorrSide);
    }

    // 3. Tol Layang, Enterable Interior Stage & Warung Stalls
    this.rootGroup.add(buildElevatedHighwayMesh(this.roadMat));
    const { portalsGroup, interiorStageGroup } = buildInteriorPortalsAndStage();
    const pulseRings = portalsGroup.userData.pulseRings as
      | THREE.Mesh[]
      | undefined;
    if (pulseRings) {
      this.portalPulseRings.push(...pulseRings);
    }
    this.rootGroup.add(portalsGroup, interiorStageGroup);

    this.rootGroup.add(buildWarungStall(-11, 22, Math.PI / 4));
    this.rootGroup.add(buildWarungStall(11, 20, -Math.PI / 4));
    this.rootGroup.add(buildWarungStall(-14, -22, 0));
    this.rootGroup.add(buildWarungStall(14, -22, 0));
    this.rootGroup.add(buildJakartaIconicLandmarks());

    // 3b. Tropical Vice-Jakarta Neon Videotron Billboards & Swaying Boulevard Palms
    this.viceNeonGroup = this.buildViceJakartaAtmosphereProps(maxAnisotropy);
    this.rootGroup.add(this.viceNeonGroup);

    // 3c. Living Jakarta Street Random Event 3D Beacon
    this.streetEventBeaconGroup = this.buildStreetEventBeacon();
    this.streetEventBeaconGroup.visible = false;
    this.rootGroup.add(this.streetEventBeaconGroup);

    // 3d. Wave 2: 6 Handcrafted 3D Jakarta Stunt Ramps, 4 Flood Zones, Race Gate & Turf War Ring
    this.stuntRampsGroup = this.buildJakartaStuntRamps();
    this.rootGroup.add(this.stuntRampsGroup);

    this.wave2FloodZonesGroup = this.buildMonsoonFloodZones();
    this.wave2FloodZonesGroup.visible = false;
    this.rootGroup.add(this.wave2FloodZonesGroup);

    this.raceCheckpointGroup = this.buildRaceCheckpointArch();
    this.raceCheckpointGroup.visible = false;
    this.rootGroup.add(this.raceCheckpointGroup);

    this.turfWarRingGroup = this.buildTurfWarZoneRing();
    this.turfWarRingGroup.visible = false;
    this.rootGroup.add(this.turfWarRingGroup);

    // 4. Buildings (3-Tier THREE.LOD: 0m High, 72m Mid, 135m Low Proxy) + Instanced Rooftop Aviation Beacons
    const beaconPositions: { x: number; y: number; z: number; color: number }[] = [];
    for (const b of CITY_BUILDINGS) {
      const highDetail = buildJakartaBuilding(b, maxAnisotropy);
      const nightMats = highDetail.userData.nightEmissiveMats as
        | THREE.MeshStandardMaterial[]
        | undefined;
      if (nightMats) {
        for (let ni = 0; ni < nightMats.length; ni++) {
          this.buildingEmissiveMats.push(nightMats[ni]);
        }
      }
      const flags = highDetail.userData.animatedFlags as
        | {
            geometry: THREE.PlaneGeometry;
            basePositions: Float32Array;
            phase: number;
          }[]
        | undefined;
      if (flags) {
        this.animatedFlags.push(...flags);
      }
      this.rootGroup.add(buildThreeTierBuildingLOD(b, highDetail));
      if (b.style === 'skyscraper' && b.height >= 16) {
        beaconPositions.push({
          x: b.x,
          y: b.height + 0.45,
          z: b.z,
          color: b.accentColor,
        });
      }
    }

    this.spireBeaconMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    if (beaconPositions.length > 0) {
      const beaconGeo = new THREE.SphereGeometry(0.32, 8, 8);
      const beaconInst = new THREE.InstancedMesh(
        beaconGeo,
        this.spireBeaconMat,
        beaconPositions.length
      );
      const dummy = new THREE.Object3D();
      const color = new THREE.Color();
      beaconPositions.forEach((bp, i) => {
        dummy.position.set(bp.x, bp.y, bp.z);
        dummy.updateMatrix();
        beaconInst.setMatrixAt(i, dummy.matrix);
        color.setHex(bp.color);
        beaconInst.setColorAt(i, color);
      });
      beaconInst.instanceMatrix.needsUpdate = true;
      if (beaconInst.instanceColor) {
        beaconInst.instanceColor.needsUpdate = true;
      }
      this.rootGroup.add(beaconInst);
    }

    // 5. Jakarta Streetscape, Hero District Props, Road Details & Authentic Halte/Toll/Dishub System
    this.streetscape = buildJakartaStreetscape(maxAnisotropy);
    this.rootGroup.add(this.streetscape.group);

    this.districtProps = buildJakartaDistrictProps(maxAnisotropy);
    this.rootGroup.add(this.districtProps.group);

    this.streetlightAnchors.push(
      ...this.streetscape.pjuLightAnchors,
      ...this.districtProps.lightAnchors
    );
    for (let li = 0; li < 4; li++) {
      const pLight = new THREE.PointLight(0xffb347, 0, 24, 1.8);
      pLight.castShadow = false;
      pLight.position.set(0, 6.2, 0);
      this.streetlightPool.push(pLight);
      this.rootGroup.add(pLight);
    }

    this.roadDetailSystem = buildProceduralRoadDetailSystem(
      this.streetscape.sidewalkRects,
      maxAnisotropy
    );
    this.rootGroup.add(this.roadDetailSystem.group);

    this.roadsideSystem = buildAuthenticRoadsideSystem(
      this.streetscape.sidewalkRects,
      maxAnisotropy
    );
    this.rootGroup.add(this.roadsideSystem.group);

    this.rootGroup.add(this.buildOuterMegapolitanBlocks(maxAnisotropy));

    scene.add(this.rootGroup);
  }

  private viceNeonGroup: THREE.Group;
  private streetEventBeaconGroup: THREE.Group;
  private stuntRampsGroup: THREE.Group;
  private wave2FloodZonesGroup: THREE.Group;
  private raceCheckpointGroup: THREE.Group;
  private turfWarRingGroup: THREE.Group;
  private readonly videotronMats: THREE.MeshStandardMaterial[] = [];
  private readonly palmCanopies: THREE.Object3D[] = [];
  private readonly rampChevronMats: THREE.MeshBasicMaterial[] = [];
  private readonly portalPulseRings: THREE.Mesh[] = [];
  private readonly animatedFlags: {
    geometry: THREE.PlaneGeometry;
    basePositions: Float32Array;
    phase: number;
  }[] = [];
  private floodZoneMat: THREE.MeshStandardMaterial | null = null;

  private buildViceJakartaAtmosphereProps(maxAnisotropy: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'ViceJakartaAtmosphereProps';

    // 1. Vibrant LED Videotron Billboards on key corridors
    const signs: {
      x: number;
      y: number;
      z: number;
      rotY: number;
      title: string;
      subtitle: string;
      bg: string;
      accent: string;
    }[] = [
      {
        x: -9.5,
        y: 8.4,
        z: -38,
        rotY: Math.PI * 0.25,
        title: 'BURSA NUSANTARA',
        subtitle: 'KORIDOR FINANSIAL SUDIRMAN',
        bg: '#0b1220',
        accent: '#e2a93b',
      },
      {
        x: 9.8,
        y: 8.6,
        z: -48,
        rotY: -Math.PI * 0.25,
        title: 'BENGKEL GARUDA',
        subtitle: 'TUNING & RESTORASI BLOK M',
        bg: '#101826',
        accent: '#38bdf8',
      },
      {
        x: -10.5,
        y: 7.8,
        z: 42,
        rotY: Math.PI * 0.75,
        title: 'KOPI MELAWAI 24J',
        subtitle: 'ROASTERY · SOTO · WARUNG MALAM',
        bg: '#18120c',
        accent: '#d97706',
      },
      {
        x: -40,
        y: 9.2,
        z: -32,
        rotY: Math.PI * 0.2,
        title: 'PASEBAN LOUNGE',
        subtitle: 'DISTRIK SCBD · LIVE JAZZ',
        bg: '#14111c',
        accent: '#f4a261',
      },
    ];

    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.65,
      metalness: 0.45,
    });
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.4,
      metalness: 0.72,
    });

    for (const s of signs) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 224;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 512, 224);
        grad.addColorStop(0, s.bg);
        grad.addColorStop(1, '#090d16');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 224);

        ctx.fillStyle = s.accent;
        ctx.fillRect(0, 0, 512, 6);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = 2;
        ctx.strokeRect(14, 16, 484, 194);

        ctx.fillStyle = s.accent;
        ctx.font = '700 44px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(s.title, 256, 106);

        ctx.fillStyle = '#e2e8f0';
        ctx.font = '600 22px system-ui, sans-serif';
        ctx.fillText(s.subtitle, 256, 158);
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = maxAnisotropy;

      const screenMat = new THREE.MeshStandardMaterial({
        map: tex,
        emissiveMap: tex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.65,
        roughness: 0.34,
        metalness: 0.1,
      });
      this.videotronMats.push(screenMat);

      const boardGroup = new THREE.Group();
      boardGroup.position.set(s.x, 0, s.z);
      boardGroup.rotation.y = s.rotY;

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.28, s.y - 1.2, 8),
        poleMat
      );
      pole.position.y = (s.y - 1.2) / 2;
      boardGroup.add(pole);

      const housing = new THREE.Mesh(
        new THREE.BoxGeometry(6.8, 3.1, 0.42),
        frameMat
      );
      housing.position.y = s.y;
      boardGroup.add(housing);

      const face = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2.75), screenMat);
      face.position.set(0, s.y, 0.23);
      boardGroup.add(face);

      const backFace = new THREE.Mesh(
        new THREE.PlaneGeometry(6.4, 2.75),
        screenMat
      );
      backFace.position.set(0, s.y, -0.23);
      backFace.rotation.y = Math.PI;
      boardGroup.add(backFace);

      group.add(boardGroup);
    }

    // 2. Tropical Vice-Jakarta Swaying Boulevard Palms (composite 3-part silhouettes)
    const palmSpots: [number, number][] = [
      [-9.2, -16],
      [9.2, -16],
      [-9.2, 16],
      [9.2, 16],
      [-9.2, -46],
      [9.2, -46],
      [-24, -68],
      [24, -68],
      [-48, -68],
      [-20, 48],
      [20, 48],
    ];
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.92,
      metalness: 0.02,
    });
    const frondMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.72,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    const trunkGeo = new THREE.CylinderGeometry(0.14, 0.24, 5.4, 7);
    const frondGeo = new THREE.ConeGeometry(0.55, 2.7, 4);
    frondGeo.rotateX(Math.PI * 0.42);
    frondGeo.translate(0, 0, 1.15);

    palmSpots.forEach(([px, pz], idx) => {
      const palm = new THREE.Group();
      palm.position.set(px, 0.08, pz);
      const scale = 0.88 + (idx % 3) * 0.14;
      palm.scale.setScalar(scale);

      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 2.7;
      trunk.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.06;
      palm.add(trunk);

      const canopy = new THREE.Group();
      canopy.position.set(trunk.rotation.z * -2.2, 5.35, 0);
      for (let f = 0; f < 6; f++) {
        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.rotation.y = (f / 6) * Math.PI * 2 + idx * 0.4;
        frond.rotation.x = 0.25;
        canopy.add(frond);
      }
      this.palmCanopies.push(canopy);
      palm.add(canopy);
      group.add(palm);
    });

    return group;
  }

  private buildStreetEventBeacon(): THREE.Group {
    const g = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(2.4, 2.85, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.12;
    g.add(ring);

    const beamGeo = new THREE.CylinderGeometry(2.5, 2.6, 1.6, 20, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 0.9;
    g.add(beam);

    return g;
  }

  private buildJakartaStuntRamps(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'JakartaStuntRamps';

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.88,
      metalness: 0.12,
    });
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.55,
    });
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      emissive: new THREE.Color(0xd97706),
      emissiveIntensity: 0.18,
      roughness: 0.42,
      metalness: 0.48,
    });

    for (const r of STUNT_RAMPS_CATALOG) {
      const rampGroup = new THREE.Group();
      rampGroup.position.set(r.x, 0.04, r.z);
      rampGroup.rotation.y = r.heading;

      // Extruded wedge side profile (local +Z = uphill launch direction)
      const shape = new THREE.Shape();
      shape.moveTo(-r.length * 0.5, 0);
      shape.lineTo(r.length * 0.5, 0);
      shape.lineTo(r.length * 0.5, r.peakHeight);
      shape.lineTo(-r.length * 0.5, 0.14);
      shape.closePath();

      const wedgeGeo = new THREE.ExtrudeGeometry(shape, {
        depth: r.width,
        bevelEnabled: false,
      });
      // Center width along X, align length along Z
      wedgeGeo.rotateY(-Math.PI / 2);
      wedgeGeo.translate(r.width * 0.5, 0, 0);
      const wedgeMesh = new THREE.Mesh(wedgeGeo, concreteMat);
      wedgeMesh.receiveShadow = true;
      wedgeMesh.castShadow = true;
      rampGroup.add(wedgeMesh);

      // Sloped steel launch deck on top
      const slopeAngle = Math.atan2(r.peakHeight - 0.14, r.length);
      const slopeLen = Math.hypot(r.length, r.peakHeight - 0.14);
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(r.width - 0.25, 0.12, slopeLen),
        deckMat
      );
      deck.position.set(0, r.peakHeight * 0.5 + 0.06, 0);
      deck.rotation.x = -slopeAngle;
      rampGroup.add(deck);

      // Glowing amber side guide rails
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.32, slopeLen),
          railMat
        );
        rail.position.set(
          side * (r.width * 0.5 - 0.1),
          r.peakHeight * 0.5 + 0.2,
          0
        );
        rail.rotation.x = -slopeAngle;
        rampGroup.add(rail);
      }

      // Subtle amber launch chevrons painted along ramp deck
      const chevMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.32,
        side: THREE.DoubleSide,
      });
      this.rampChevronMats.push(chevMat);
      for (let c = 0; c < 3; c++) {
        const frac = 0.25 + c * 0.28;
        const chev = new THREE.Mesh(
          new THREE.PlaneGeometry(r.width * 0.52, 0.55),
          chevMat
        );
        chev.position.set(
          0,
          0.18 + frac * (r.peakHeight - 0.14) + 0.08,
          -r.length * 0.5 + frac * r.length
        );
        chev.rotation.x = -Math.PI / 2 - slopeAngle;
        rampGroup.add(chev);
      }

      group.add(rampGroup);
    }

    return group;
  }

  private buildMonsoonFloodZones(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'JakartaFloodZones';
    this.floodZoneMat = new THREE.MeshStandardMaterial({
      color: 0x0e2a47,
      roughness: 0.06,
      metalness: 0.78,
      transparent: true,
      opacity: 0.62,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    for (const fz of JAKARTA_FLOOD_ZONES) {
      const geo = new THREE.CircleGeometry(fz.radius, 28);
      geo.rotateX(-Math.PI / 2);
      const disc = new THREE.Mesh(geo, this.floodZoneMat);
      disc.position.set(fz.x, 0.09, fz.z);
      group.add(disc);
    }
    return group;
  }

  private buildRaceCheckpointArch(): THREE.Group {
    const g = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringGeo = new THREE.RingGeometry(4.2, 5.2, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.18;
    g.add(ring);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(4.1, 4.5, 5.5, 20, 1, true),
      beamMat
    );
    beam.position.y = 2.85;
    g.add(beam);
    return g;
  }

  private buildTurfWarZoneRing(): THREE.Group {
    const g = new THREE.Group();
    const ringGeo = new THREE.RingGeometry(25.2, 26.0, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 0.14;
    g.add(ring);

    const pillarMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.4, 2.2, 16, 1, true),
      pillarMat
    );
    pillar.position.y = 1.15;
    g.add(pillar);
    return g;
  }

  public setActiveStreetEventMarker(x: number | null, z: number | null): void {
    if (x === null || z === null) {
      this.streetEventBeaconGroup.visible = false;
      return;
    }
    this.streetEventBeaconGroup.visible = true;
    this.streetEventBeaconGroup.position.set(x, 0, z);
  }

  public setRaceCheckpointMarker(
    x: number | null,
    z: number | null,
    isFinish: boolean = false
  ): void {
    if (x === null || z === null) {
      this.raceCheckpointGroup.visible = false;
      return;
    }
    this.raceCheckpointGroup.visible = true;
    this.raceCheckpointGroup.position.set(x, 0, z);
    const s = isFinish ? 1.25 : 1.0;
    this.raceCheckpointGroup.scale.set(s, isFinish ? 1.18 : 1.0, s);
  }

  public setTurfWarZoneMarker(
    x: number | null,
    z: number | null,
    radius: number = 26
  ): void {
    if (x === null || z === null) {
      this.turfWarRingGroup.visible = false;
      return;
    }
    this.turfWarRingGroup.visible = true;
    this.turfWarRingGroup.position.set(x, 0, z);
    const scale = radius / 26;
    this.turfWarRingGroup.scale.set(scale, 1, scale);
  }

  public getSidewalkRects(): SidewalkRect[] {
    return this.streetscape.sidewalkRects;
  }

  public setTrafficSignalPhase(phase: TrafficSignalPhase): void {
    this.streetscape.setTrafficSignalPhase(phase);
  }

  private buildOuterMegapolitanBlocks(maxAnisotropy: number): THREE.Group {
    const group = new THREE.Group();
    group.name = 'OrganizedJakartaCityBlocks';

    // Curated urban block centers neatly framed between real road arteries:
    // Roads N-S: -208, -128, -84, -32, 0, 32, 84, 128, 208
    // Roads E-W: -66, -32, 0, 32, 80, 128, 208
    const xBlockBands: [number, number][] = [
      [-186, 16],
      [-150, 16],
      [-106, 15],
      [-64, 14],
      [-48, 13],
      [-18, 12],
      [18, 12],
      [48, 13],
      [64, 14],
      [106, 15],
      [150, 16],
      [186, 16],
    ];
    const zBlockBands: [number, number][] = [
      [-49, 13],
      [-17, 12],
      [17, 12],
      [56, 15],
      [104, 14],
      [148, 15],
      [182, 15],
    ];

    const plinthPlacements: { x: number; z: number; w: number; d: number }[] = [];
    const blockPlacements: {
      x: number;
      z: number;
      w: number;
      h: number;
      d: number;
      podiumW: number;
      podiumD: number;
      podiumH: number;
      color: number;
    }[] = [];
    const treePlacements: {
      x: number;
      z: number;
      trunkH: number;
      crownR: number;
      color: number;
    }[] = [];

    const reservedLandmarks: { x: number; z: number; r: number }[] = [
      { x: 0, z: 0, r: 28 }, // Monas Medan Merdeka Park
      { x: 0, z: 32, r: 16 }, // Bundaran HI
      { x: 20, z: -17, r: 17 }, // Masjid Istiqlal courtyard
      { x: -58, z: 56, r: 22 }, // GBK Senayan Stadium Park
      { x: 106, z: -49, r: 16 }, // Priok Container Yard
    ];

    const cbdPalette = [0x94a3b8, 0xcbd5e1, 0x64748b, 0xbfdbfe];
    const heritagePalette = [0xe7e5e4, 0xd6d3d1, 0xcbd5e1, 0xd9c7b8];
    const industrialPalette = [0x94a3b8, 0x64748b, 0x9ca3af];
    const treePalette = [0x15803d, 0x166534, 0x1e5631, 0x1b4332];

    const hashUnit = (gx: number, gz: number): number => {
      const s = Math.sin(gx * 12.9898 + gz * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    for (const [bx, slotW] of xBlockBands) {
      for (const [bz, slotD] of zBlockBands) {
        if (isOnRoadway(bx, bz)) continue;
        // Every organized urban block receives a clean concrete sidewalk plinth pad
        plinthPlacements.push({
          x: bx,
          z: bz,
          w: slotW + 2.6,
          d: slotD + 2.6,
        });

        let inLandmark = false;
        for (const lm of reservedLandmarks) {
          if (Math.hypot(bx - lm.x, bz - lm.z) < lm.r) {
            inLandmark = true;
            break;
          }
        }
        if (inLandmark || isNearBuilding(bx, bz, 12.5)) {
          continue;
        }

        const rnd = hashUnit(bx, bz);
        // Reserve ~22% of clean blocks as manicured pocket parks with symmetrical trees
        if (rnd < 0.22) {
          for (const [ox, oz] of [
            [-3.5, -3.5],
            [3.5, -3.5],
            [-3.5, 3.5],
            [3.5, 3.5],
          ]) {
            treePlacements.push({
              x: bx + ox,
              z: bz + oz,
              trunkH: 2.0 + hashUnit(bx + ox, bz + oz) * 0.9,
              crownR: 2.2 + hashUnit(bz + oz, bx + ox) * 0.6,
              color: treePalette[Math.floor(rnd * 23) % treePalette.length],
            });
          }
          continue;
        }

        const isSudirmanScbd =
          Math.abs(bx) <= 72 && bz >= 12 && bz <= 112;
        const isNorthHeritage = bz <= -36 && Math.abs(bx) <= 72;
        const isIndustrial = bz <= -36 && Math.abs(bx) > 72;

        const w = Math.max(8, Math.round(slotW * (0.68 + rnd * 0.16)));
        const d = Math.max(8, Math.round(slotD * (0.68 + hashUnit(bz, bx) * 0.16)));
        const podiumH = isSudirmanScbd ? 4.8 : 3.4;
        const h = isSudirmanScbd
          ? 24 + Math.floor(rnd * 20)
          : isNorthHeritage
          ? 11 + Math.floor(rnd * 6)
          : isIndustrial
          ? 12 + Math.floor(rnd * 8)
          : 15 + Math.floor(rnd * 14);

        const palette = isSudirmanScbd
          ? cbdPalette
          : isIndustrial
          ? industrialPalette
          : heritagePalette;

        blockPlacements.push({
          x: bx,
          z: bz,
          w,
          h,
          d,
          podiumW: w + 1.8,
          podiumD: d + 1.8,
          podiumH,
          color: palette[Math.floor(rnd * 19) % palette.length],
        });
      }
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    if (plinthPlacements.length > 0) {
      const plinthGeo = new THREE.BoxGeometry(1, 0.16, 1);
      const plinthMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.92,
        metalness: 0.04,
        envMapIntensity: 0.1,
      });
      const plinthInst = new THREE.InstancedMesh(
        plinthGeo,
        plinthMat,
        plinthPlacements.length
      );
      plinthPlacements.forEach((p, i) => {
        dummy.position.set(p.x, 0.08, p.z);
        dummy.scale.set(p.w, 1, p.d);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        plinthInst.setMatrixAt(i, dummy.matrix);
      });
      plinthInst.instanceMatrix.needsUpdate = true;
      plinthInst.receiveShadow = true;
      group.add(plinthInst);
    }

    if (blockPlacements.length > 0) {
      const outerFacade = proceduralTextures.getBuildingFacadeTextures(
        0x334155,
        0x38bdf8,
        'skyscraper',
        maxAnisotropy
      );
      const boxGeo = new THREE.BoxGeometry(1, 1, 1);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: outerFacade.map,
        roughnessMap: outerFacade.roughnessMap,
        emissiveMap: outerFacade.emissiveMap,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.12,
        roughness: 0.68,
        metalness: 0.24,
      });
      this.buildingEmissiveMats.push(boxMat);
      const blockInst = new THREE.InstancedMesh(
        boxGeo,
        boxMat,
        blockPlacements.length
      );

      const podiumMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.78,
        metalness: 0.18,
      });
      const podiumInst = new THREE.InstancedMesh(
        boxGeo,
        podiumMat,
        blockPlacements.length
      );

      const roofGeo = new THREE.BoxGeometry(1, 1, 1);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.84,
        metalness: 0.2,
      });
      const roofInst = new THREE.InstancedMesh(
        roofGeo,
        roofMat,
        blockPlacements.length
      );

      blockPlacements.forEach((b, i) => {
        dummy.position.set(b.x, b.podiumH * 0.5 + 0.12, b.z);
        dummy.scale.set(b.podiumW, b.podiumH, b.podiumD);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        podiumInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(b.x, b.podiumH + b.h * 0.5, b.z);
        dummy.scale.set(b.w, b.h, b.d);
        dummy.updateMatrix();
        blockInst.setMatrixAt(i, dummy.matrix);
        color.setHex(b.color);
        blockInst.setColorAt(i, color);

        dummy.position.set(b.x, b.podiumH + b.h + 0.65, b.z);
        dummy.scale.set(b.w * 0.65, 1.3, b.d * 0.65);
        dummy.updateMatrix();
        roofInst.setMatrixAt(i, dummy.matrix);
      });
      podiumInst.instanceMatrix.needsUpdate = true;
      blockInst.instanceMatrix.needsUpdate = true;
      if (blockInst.instanceColor) blockInst.instanceColor.needsUpdate = true;
      roofInst.instanceMatrix.needsUpdate = true;
      group.add(podiumInst, blockInst, roofInst);
    }

    if (treePlacements.length > 0) {
      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 6);
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x4a3728,
        roughness: 0.94,
        metalness: 0.02,
      });
      const trunkInst = new THREE.InstancedMesh(
        trunkGeo,
        trunkMat,
        treePlacements.length
      );

      const canopyGeo = new THREE.IcosahedronGeometry(1, 1);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.88,
        metalness: 0.04,
      });
      const canopyInst = new THREE.InstancedMesh(
        canopyGeo,
        canopyMat,
        treePlacements.length
      );

      treePlacements.forEach((t, i) => {
        dummy.position.set(t.x, t.trunkH * 0.5, t.z);
        dummy.scale.set(1, t.trunkH, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(t.x, t.trunkH + t.crownR * 0.45, t.z);
        dummy.scale.set(t.crownR, t.crownR * 0.76, t.crownR);
        dummy.rotation.set(0, (i * 0.7) % (Math.PI * 2), 0);
        dummy.updateMatrix();
        canopyInst.setMatrixAt(i, dummy.matrix);
        color.setHex(t.color);
        canopyInst.setColorAt(i, color);
      });
      trunkInst.instanceMatrix.needsUpdate = true;
      canopyInst.instanceMatrix.needsUpdate = true;
      if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
      group.add(trunkInst, canopyInst);
    }

    return group;
  }

  public updateChunksAroundPlayer(playerX: number, playerZ: number): void {
    this.chunkLoader.updateAroundPlayer(playerX, playerZ, false);
  }

  public syncCollectibles(collectedIds: readonly string[], dt: number): void {
    if (
      collectedIds.length !== this.lastCollectedCount ||
      collectedIds[0] !== this.lastCollectedFirstId
    ) {
      this.lastCollectedCount = collectedIds.length;
      this.lastCollectedFirstId = collectedIds[0];
      this.collectedIdSet.clear();
      for (let i = 0; i < collectedIds.length; i++) {
        this.collectedIdSet.add(collectedIds[i]);
      }
    }
    for (const pkg of NUSANTARA_PACKAGES) {
      const grp = this.collectibleMeshes.get(pkg.id);
      if (!grp) continue;
      const visible = !this.collectedIdSet.has(pkg.id);
      grp.visible = visible;
      if (visible) {
        grp.rotation.y += dt * 1.9;
        grp.position.y = pkg.y + Math.sin(this.elapsedTime * 3.1 + pkg.x) * 0.18;
      }
    }
  }

  public updateStreetlightPool(
    playerX: number,
    playerZ: number,
    nightFactor: number,
    wetnessFactor: number
  ): void {
    const tone = computeTimeOfDayToneState(nightFactor, wetnessFactor);
    const intensity = tone.streetlightIntensity;
    if (intensity <= 0.02 || this.streetlightAnchors.length === 0) {
      for (let i = 0; i < this.streetlightPool.length; i++) {
        this.streetlightPool[i].intensity = 0;
      }
      return;
    }

    const nearest = selectNearestLightIndices(
      this.streetlightAnchors,
      playerX,
      playerZ,
      this.streetlightPool.length
    );
    for (let i = 0; i < this.streetlightPool.length; i++) {
      const light = this.streetlightPool[i];
      const idx = nearest[i];
      if (idx === undefined) {
        light.intensity = 0;
        continue;
      }
      const anchor = this.streetlightAnchors[idx];
      light.position.set(anchor.x, 5.8, anchor.z);
      light.intensity = intensity;
    }
  }

  public setWeatherTransition(
    nightFactor: number,
    wetnessFactor: number,
    dt: number = 0.016,
    playerX: number = 0,
    playerZ: number = 0
  ): void {
    this.elapsedTime += dt;
    const tone = computeTimeOfDayToneState(nightFactor, wetnessFactor);

    this.roadUniforms.uWetness.value = wetnessFactor;
    this.roadUniforms.uNightFactor.value = nightFactor;
    this.roadUniforms.uTime.value = this.elapsedTime;
    this.roadMat.roughness = 0.88 - wetnessFactor * 0.58;
    this.roadMat.metalness = 0.04 + wetnessFactor * 0.24;
    this.roadMat.envMapIntensity = 0.34 + wetnessFactor * 0.42;
    this.spireBeaconMat.color.setScalar(0.55 + nightFactor * 0.45);
    this.bayWaterMat.roughness = 0.14 + Math.sin(this.elapsedTime * 1.8) * 0.04;

    // Automatically illuminate Jakarta skyscraper offices & Blok M ruko windows at dusk/night
    for (let i = 0; i < this.buildingEmissiveMats.length; i++) {
      this.buildingEmissiveMats[i].emissiveIntensity =
        tone.windowEmissiveIntensity;
    }

    // Pulse Vice-Jakarta LED videotrons subtly at dusk/night
    const screenBoost = 0.38 + nightFactor * 0.54;
    for (let i = 0; i < this.videotronMats.length; i++) {
      this.videotronMats[i].emissiveIntensity =
        screenBoost + Math.sin(this.elapsedTime * 2.2 + i * 1.4) * 0.04;
    }

    // Gentle tropical breeze sway on boulevard palm canopies
    const windStrength = 0.045 + wetnessFactor * 0.06;
    for (let i = 0; i < this.palmCanopies.length; i++) {
      this.palmCanopies[i].rotation.z =
        Math.sin(this.elapsedTime * 1.65 + i * 0.9) * windStrength;
      this.palmCanopies[i].rotation.x =
        Math.cos(this.elapsedTime * 1.25 + i * 0.7) * windStrength * 0.65;
    }

    // Subtle procedural cloth wave flutter on Monas Merah Putih flags (near central core)
    if (playerX * playerX + playerZ * playerZ <= 75 * 75) {
      const flagWindAmp = 0.12 + wetnessFactor * 0.07;
      for (let f = 0; f < this.animatedFlags.length; f++) {
        const fl = this.animatedFlags[f];
        const posAttr = fl.geometry.attributes.position as THREE.BufferAttribute;
        const arr = posAttr.array as Float32Array;
        const base = fl.basePositions;
        for (let v = 0; v < posAttr.count; v++) {
          const ix = v * 3;
          const bx = base[ix];
          const by = base[ix + 1];
          const flutterWeight = Math.min(1, Math.max(0, bx / 1.82));
          const wave =
            Math.sin(bx * 3.6 - this.elapsedTime * 5.2 + fl.phase) *
              flagWindAmp *
              flutterWeight +
            Math.sin(by * 2.4 - this.elapsedTime * 3.1 + fl.phase) *
              0.03 *
              flutterWeight;
          arr[ix + 2] = base[ix + 2] + wave;
        }
        posAttr.needsUpdate = true;
      }
    }

    // Subtle low-profile breathing pulse on interior & warung ground rings
    for (let pr = 0; pr < this.portalPulseRings.length; pr++) {
      const ring = this.portalPulseRings[pr];
      const s = 0.94 + Math.sin(this.elapsedTime * 2.8 + pr * 0.8) * 0.1;
      ring.scale.set(s, s, 1);
    }

    if (this.streetEventBeaconGroup.visible) {
      const pulse = 1 + Math.sin(this.elapsedTime * 5.2) * 0.12;
      this.streetEventBeaconGroup.scale.set(pulse, 1, pulse);
    }

    // Wave 2: Pulse stunt ramp chevrons subtly, monsoon flood puddles & race checkpoint gate
    for (let i = 0; i < this.rampChevronMats.length; i++) {
      this.rampChevronMats[i].opacity =
        0.22 + Math.sin(this.elapsedTime * 3.2 + i * 1.1) * 0.08;
    }
    this.wave2FloodZonesGroup.visible = wetnessFactor > 0.55;
    if (this.floodZoneMat && this.wave2FloodZonesGroup.visible) {
      const floodAlpha = Math.min(0.68, (wetnessFactor - 0.55) * 1.5);
      this.floodZoneMat.opacity = floodAlpha;
      this.floodZoneMat.roughness = 0.05 + Math.sin(this.elapsedTime * 3.1) * 0.03;
    }
    if (this.raceCheckpointGroup.visible) {
      this.raceCheckpointGroup.rotation.y += dt * 1.6;
    }
    if (this.turfWarRingGroup.visible) {
      this.turfWarRingGroup.rotation.y -= dt * 0.8;
    }

    this.streetscape.setWeatherTransition(
      nightFactor,
      wetnessFactor,
      this.elapsedTime
    );
    this.districtProps.setWeatherTransition(nightFactor, this.elapsedTime);
    this.roadDetailSystem.setWeatherTransition(wetnessFactor);
    this.roadsideSystem.setWeatherTransition(nightFactor, wetnessFactor);
  }

  public dispose(): void {
    this.chunkLoader.dispose();
    this.districtProps.dispose();
    this.roadDetailSystem.dispose();
    this.roadsideSystem.dispose();
    disposeObjectTree(this.rootGroup);
  }
}

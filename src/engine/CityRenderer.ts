import * as THREE from 'three';
import {
  BuildingFootprint,
  CITY_BUILDINGS,
  SpatialHashGrid,
  TrafficSignalPhase,
  createBuildingSpatialGrid,
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
  createAsphaltNormalTexture,
  createAsphaltRoadTexture,
  createAsphaltRoughnessTexture,
} from '../game/world/geometryBuilders';

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

  private readonly roadMat: THREE.MeshStandardMaterial;
  private readonly spireBeaconMat: THREE.MeshBasicMaterial;
  private readonly streetscape: ReturnType<typeof buildJakartaStreetscape>;
  private readonly roadDetailSystem: ReturnType<
    typeof buildProceduralRoadDetailSystem
  >;
  private readonly roadsideSystem: ReturnType<
    typeof buildAuthenticRoadsideSystem
  >;
  private readonly roadUniforms = {
    uWetness: { value: 0 },
    uNightFactor: { value: 0.5 },
    uTime: { value: 0 },
  };
  private elapsedTime = 0;

  constructor(scene: THREE.Scene, maxAnisotropy: number) {
    this.buildingGrid = createBuildingSpatialGrid(CITY_BUILDINGS, 18);

    // 1. Extended Terrain & Monas Plaza
    const groundGeo = new THREE.PlaneGeometry(520, 520);
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

    // 2. Asphalt Boulevards (PBR Albedo + Normal + Roughness + Wet Puddle Shader)
    const roadTex = createAsphaltRoadTexture(maxAnisotropy);
    roadTex.repeat.set(1, 18);
    const roadNormalTex = createAsphaltNormalTexture(maxAnisotropy);
    roadNormalTex.repeat.set(1, 18);
    const roadRoughTex = createAsphaltRoughnessTexture(maxAnisotropy);
    roadRoughTex.repeat.set(1, 18);

    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: roadTex,
      normalMap: roadNormalTex,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: roadRoughTex,
      roughness: 0.95,
      metalness: 0.02,
      envMapIntensity: 0.08,
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
          `if (uWetness > 0.08 && sanPuddleMask > 0.01) {
  vec3 viewDirW = normalize(cameraPosition - vRoadWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDirW, vec3(0.0, 1.0, 0.0)), 0.0), 3.0);
  vec3 nightSkyRef = mix(vec3(0.16, 0.24, 0.38), vec3(0.06, 0.14, 0.26), uNightFactor);
  vec3 neonTint = mix(vec3(0.95, 0.58, 0.14), vec3(0.18, 0.75, 0.98), roadNoise(vRoadWorldPos.xz * 0.08));
  float rippleCell = sin(length(fract(vRoadWorldPos.xz * 0.72) - 0.5) * 28.0 - uTime * 9.5);
  float rippleSpark = smoothstep(0.92, 1.0, rippleCell) * sanPuddleMask * 0.14;
  gl_FragColor.rgb += (nightSkyRef * 0.38 + neonTint * (0.14 + uNightFactor * 0.26)) * (sanPuddleMask * (0.35 + fresnel * 0.65)) + vec3(rippleSpark);
}
#include <dithering_fragment>`
        );
    };
    this.roadMat.customProgramCacheKey = () => 'san-nabilo-wet-asphalt-v2';

    const nsRoadGeo = new THREE.PlaneGeometry(14, 190);
    nsRoadGeo.rotateX(-Math.PI / 2);
    const nsRoad = new THREE.Mesh(nsRoadGeo, this.roadMat);
    nsRoad.position.set(0, 0.036, 0);
    nsRoad.receiveShadow = true;
    this.rootGroup.add(nsRoad);

    const ewRoadGeo = new THREE.PlaneGeometry(14, 190);
    ewRoadGeo.rotateX(-Math.PI / 2);
    ewRoadGeo.rotateY(Math.PI / 2);
    const ewRoad = new THREE.Mesh(ewRoadGeo, this.roadMat);
    ewRoad.position.set(0, 0.044, 0);
    ewRoad.receiveShadow = true;
    this.rootGroup.add(ewRoad);

    for (const offset of [-32, 32]) {
      const hRoadGeo = new THREE.PlaneGeometry(10, 160);
      hRoadGeo.rotateX(-Math.PI / 2);
      hRoadGeo.rotateY(Math.PI / 2);
      const hRoad = new THREE.Mesh(hRoadGeo, this.roadMat);
      hRoad.position.set(0, 0.02, offset);
      this.rootGroup.add(hRoad);

      const vRoadGeo = new THREE.PlaneGeometry(10, 160);
      vRoadGeo.rotateX(-Math.PI / 2);
      const vRoad = new THREE.Mesh(vRoadGeo, this.roadMat);
      vRoad.position.set(offset, 0.028, 0);
      this.rootGroup.add(vRoad);
    }

    // 3. Tol Layang, Enterable Interior Stage & Warung Stalls
    this.rootGroup.add(buildElevatedHighwayMesh(this.roadMat));
    const { portalsGroup, interiorStageGroup } = buildInteriorPortalsAndStage();
    this.rootGroup.add(portalsGroup, interiorStageGroup);

    this.rootGroup.add(buildWarungStall(-11, 22, Math.PI / 4));
    this.rootGroup.add(buildWarungStall(11, 20, -Math.PI / 4));
    this.rootGroup.add(buildWarungStall(-14, -22, 0));
    this.rootGroup.add(buildWarungStall(14, -22, 0));
    this.rootGroup.add(buildJakartaIconicLandmarks());

    // 4. Buildings + Instanced Rooftop Aviation Beacons (reduces draw calls)
    const beaconPositions: { x: number; y: number; z: number; color: number }[] = [];
    for (const b of CITY_BUILDINGS) {
      this.rootGroup.add(buildJakartaBuilding(b, maxAnisotropy));
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

    // 5. Jakarta Streetscape, Road Details & Authentic Halte/Toll/Dishub System
    this.streetscape = buildJakartaStreetscape(maxAnisotropy);
    this.rootGroup.add(this.streetscape.group);

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

    scene.add(this.rootGroup);
  }

  public getSidewalkRects(): SidewalkRect[] {
    return this.streetscape.sidewalkRects;
  }

  public setTrafficSignalPhase(phase: TrafficSignalPhase): void {
    this.streetscape.setTrafficSignalPhase(phase);
  }

  public setWeatherTransition(
    nightFactor: number,
    wetnessFactor: number,
    dt: number = 0.016
  ): void {
    this.elapsedTime += dt;
    this.roadUniforms.uWetness.value = wetnessFactor;
    this.roadUniforms.uNightFactor.value = nightFactor;
    this.roadUniforms.uTime.value = this.elapsedTime;
    this.roadMat.roughness = 0.95 - wetnessFactor * 0.54;
    this.roadMat.metalness = 0.02 + wetnessFactor * 0.18;
    this.roadMat.envMapIntensity = 0.08 + wetnessFactor * 0.26;
    this.spireBeaconMat.color.setScalar(0.55 + nightFactor * 0.45);
    this.streetscape.setWeatherTransition(
      nightFactor,
      wetnessFactor,
      this.elapsedTime
    );
    this.roadDetailSystem.setWeatherTransition(wetnessFactor);
    this.roadsideSystem.setWeatherTransition(nightFactor, wetnessFactor);
  }

  public dispose(): void {
    this.roadDetailSystem.dispose();
    this.roadsideSystem.dispose();
    disposeObjectTree(this.rootGroup);
  }
}

import * as THREE from 'three';
import {
  WeatherMode,
  WeatherTransitionState,
  createInitialWeatherTransitionState,
  stepWeatherTransitionInPlace,
} from '../game/rules';
import { snapShadowCoordToTexel } from './visualOverhaulMath';

export class WeatherLightingSystem {
  private scene: THREE.Scene;
  private skyDomeGeo: THREE.SphereGeometry;
  private skyDomeMat: THREE.ShaderMaterial;
  private skyDomeMesh: THREE.Mesh;
  private skyUniforms: {
    uTopColor: { value: THREE.Color };
    uHorizonColor: { value: THREE.Color };
    uBottomColor: { value: THREE.Color };
    uSunDir: { value: THREE.Vector3 };
    uSunColor: { value: THREE.Color };
    uSunGlowStrength: { value: number };
    uTime: { value: number };
    uWetness: { value: number };
    uNightFactor: { value: number };
    uLightning: { value: number };
  };

  public readonly hemiLight: THREE.HemisphereLight;
  public readonly sunLight: THREE.DirectionalLight;
  public readonly rimLight: THREE.DirectionalLight;
  public readonly monasPlazaLight: THREE.PointLight;
  public readonly sudirmanPlazaLight: THREE.PointLight;
  public readonly transitionState: WeatherTransitionState;

  private readonly sunOffset = new THREE.Vector3(46, 68, 38);
  private readonly shadowHalfExtent = 46;
  private readonly shadowMapSize: number;
  private readonly rainCount: number;

  private rainGeo: THREE.BoxGeometry;
  private rainMat: THREE.MeshBasicMaterial;
  private rainInst: THREE.InstancedMesh;
  private rainOffsetsX: Float32Array;
  private rainOffsetsY: Float32Array;
  private rainOffsetsZ: Float32Array;
  private rainSpeeds: Float32Array;
  private rainDummy = new THREE.Object3D();

  private elapsedTime = 0;
  private lightningStrength = 0;
  private nextLightningTimer = 6.5;
  private lightningBoltGroup: THREE.Group;
  private lightningBoltMat: THREE.LineBasicMaterial;
  private lightningCoreMat: THREE.MeshBasicMaterial;
  private lightningBoltLine: THREE.Line;
  private lightningBoltCore: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    initialWeather: WeatherMode,
    isSoftwareGl: boolean
  ) {
    this.scene = scene;
    this.shadowMapSize = isSoftwareGl ? 512 : 2048;
    this.rainCount = isSoftwareGl ? 240 : 620;

    this.rainOffsetsX = new Float32Array(this.rainCount);
    this.rainOffsetsY = new Float32Array(this.rainCount);
    this.rainOffsetsZ = new Float32Array(this.rainCount);
    this.rainSpeeds = new Float32Array(this.rainCount);

    const horizonHex = 0x1e2638;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.0028);

    this.skyDomeGeo = new THREE.SphereGeometry(250, 32, 24);
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x0c1428) },
      uHorizonColor: { value: new THREE.Color(0xd97706) },
      uBottomColor: { value: new THREE.Color(0x0f172a) },
      uSunDir: { value: new THREE.Vector3(0.55, 0.34, 0.76).normalize() },
      uSunColor: { value: new THREE.Color(0xffd28a) },
      uSunGlowStrength: { value: 0.45 },
      uTime: { value: 0 },
      uWetness: { value: 0 },
      uNightFactor: { value: 0.4 },
      uLightning: { value: 0 },
    };

    this.skyDomeMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
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
        uniform float uTime;
        uniform float uWetness;
        uniform float uNightFactor;
        uniform float uLightning;
        varying vec3 vLocalPos;

        float hash21(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }
        float vNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
            mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }
        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * vNoise(p);
            p *= 2.06;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 dir = normalize(vLocalPos);
          float h = dir.y;
          vec3 col = mix(uBottomColor, uHorizonColor, smoothstep(-0.14, 0.03, h));
          col = mix(col, uTopColor, smoothstep(0.0, 0.38, h));

          vec3 sunD = normalize(uSunDir);
          float sunAmt = max(dot(dir, sunD), 0.0);
          col += uSunColor * pow(sunAmt, 16.0) * (0.38 * uSunGlowStrength);
          col += uSunColor * smoothstep(0.9965, 0.9994, sunAmt) * (0.95 * uSunGlowStrength);

          // Procedural tropical sky clouds (drifting FBM layer above horizon)
          if (h > 0.01) {
            vec2 cloudUv = dir.xz / (h + 0.24) * 1.45 + vec2(uTime * 0.012, uTime * 0.006);
            float cDensity = fbm(cloudUv);
            float coverage = mix(0.46, 0.28, uWetness);
            float cloudMask = smoothstep(coverage, coverage + 0.34, cDensity) * smoothstep(0.01, 0.22, h);
            vec3 cloudBase = mix(uHorizonColor * 0.72, uTopColor * 0.52, 0.45);
            vec3 cloudSunRim = uSunColor * pow(sunAmt, 6.0) * 0.65 * uSunGlowStrength;
            vec3 cloudCol = cloudBase + cloudSunRim + vec3(0.42, 0.56, 0.85) * uLightning * 0.85;
            col = mix(col, cloudCol, cloudMask * mix(0.55, 0.82, uWetness));
          }

          // Subtle circular pinpoint night starfield
          if (uNightFactor > 0.35 && h > 0.14 && uWetness < 0.7) {
            vec2 starUv = dir.xz / (h + 0.45) * 115.0;
            vec2 starCell = floor(starUv);
            float starSeed = hash21(starCell);
            if (starSeed > 0.992) {
              vec2 jitter = vec2(hash21(starCell + 1.3), hash21(starCell + 7.9)) * 0.45 - 0.225;
              float distToStar = length(fract(starUv) - 0.5 - jitter);
              float starShape = smoothstep(0.18, 0.02, distToStar);
              float twinkle = 0.55 + 0.45 * sin(uTime * 2.8 + starSeed * 90.0);
              float starVis = (uNightFactor - 0.35) * 1.5 * (1.0 - uWetness) * smoothstep(0.14, 0.4, h);
              col += vec3(0.85, 0.92, 1.0) * starShape * twinkle * starVis * 0.95;
            }
          }

          // Monsoon lightning illumination boost
          col += vec3(0.48, 0.64, 0.95) * uLightning * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    this.skyDomeMesh = new THREE.Mesh(this.skyDomeGeo, this.skyDomeMat);
    this.skyDomeMesh.frustumCulled = false;
    scene.add(this.skyDomeMesh);

    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.56);
    this.hemiLight.position.set(0, 60, 0);
    scene.add(this.hemiLight);

    const d = this.shadowHalfExtent;
    this.sunLight = new THREE.DirectionalLight(0xffedd5, 1.15);
    this.sunLight.position.copy(this.sunOffset);
    this.sunLight.castShadow = !isSoftwareGl;
    this.sunLight.shadow.mapSize.width = this.shadowMapSize;
    this.sunLight.shadow.mapSize.height = this.shadowMapSize;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 6;
    this.sunLight.shadow.camera.far = 165;
    this.sunLight.shadow.bias = -0.0004;
    this.sunLight.shadow.normalBias = 0.025;
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.35);
    this.rimLight.position.set(-40, 30, -50);
    scene.add(this.rimLight);

    this.monasPlazaLight = new THREE.PointLight(0xfbbf24, 1.1, 36, 1.6);
    this.monasPlazaLight.position.set(0, 5.2, 12);
    scene.add(this.monasPlazaLight);

    this.sudirmanPlazaLight = new THREE.PointLight(0x38bdf8, 0.95, 38, 1.6);
    this.sudirmanPlazaLight.position.set(0, 5.5, -36);
    scene.add(this.sudirmanPlazaLight);

    // Pooled InstancedMesh tropical monsoon rain streaks
    this.rainGeo = new THREE.BoxGeometry(0.032, 0.92, 0.032);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.rainInst = new THREE.InstancedMesh(
      this.rainGeo,
      this.rainMat,
      this.rainCount
    );
    this.rainInst.frustumCulled = false;
    this.rainInst.visible = false;
    for (let i = 0; i < this.rainCount; i++) {
      this.rainOffsetsX[i] = (Math.random() - 0.5) * 46;
      this.rainOffsetsY[i] = Math.random() * 26;
      this.rainOffsetsZ[i] = (Math.random() - 0.5) * 46;
      this.rainSpeeds[i] = 24 + Math.random() * 12;
    }
    scene.add(this.rainInst);

    // Pooled 3D Jagged Monsoon Lightning Bolt (strikes skyline during heavy storms)
    this.lightningBoltGroup = new THREE.Group();
    const boltPts: THREE.Vector3[] = [];
    for (let s = 0; s <= 12; s++) {
      const frac = s / 12;
      const jitterX = s === 0 || s === 12 ? 0 : Math.sin(s * 3.7) * 2.4;
      const jitterZ = s === 0 || s === 12 ? 0 : Math.cos(s * 2.9) * 2.1;
      boltPts.push(new THREE.Vector3(jitterX, (1 - frac) * 96, jitterZ));
    }
    const boltGeo = new THREE.BufferGeometry().setFromPoints(boltPts);
    this.lightningBoltMat = new THREE.LineBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0,
    });
    this.lightningBoltLine = new THREE.Line(boltGeo, this.lightningBoltMat);
    this.lightningBoltGroup.add(this.lightningBoltLine);

    const coreGeo = new THREE.CylinderGeometry(0.16, 0.34, 94, 6, 1, true);
    this.lightningCoreMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.lightningBoltCore = new THREE.Mesh(coreGeo, this.lightningCoreMat);
    this.lightningBoltCore.position.y = 47;
    this.lightningBoltGroup.add(this.lightningBoltCore);
    this.lightningBoltGroup.visible = false;
    scene.add(this.lightningBoltGroup);

    this.transitionState = createInitialWeatherTransitionState(initialWeather);
  }

  public update(
    targetWeather: WeatherMode,
    playerX: number,
    playerZ: number,
    cameraPosition: THREE.Vector3,
    dt: number
  ): { nightFactor: number; wetnessFactor: number; lightningTriggered: boolean } {
    this.elapsedTime += dt;
    stepWeatherTransitionInPlace(this.transitionState, targetWeather, dt, 1.65);

    const wet = this.transitionState.wetnessFactor;
    let lightningTriggered = false;
    if (wet > 0.64) {
      this.nextLightningTimer -= dt;
      if (this.nextLightningTimer <= 0) {
        this.lightningStrength = 1.0;
        this.nextLightningTimer = 5.2 + Math.random() * 7.0;
        lightningTriggered = true;
        // Strike a dramatic skyline coordinate near the player
        const angle = Math.random() * Math.PI * 2;
        const dist = 34 + Math.random() * 48;
        this.lightningBoltGroup.position.set(
          playerX + Math.cos(angle) * dist,
          0,
          playerZ + Math.sin(angle) * dist
        );
        this.lightningBoltGroup.rotation.y = Math.random() * Math.PI * 2;
        this.lightningBoltGroup.visible = true;
      }
    }
    this.lightningStrength = Math.max(0, this.lightningStrength - dt * 3.8);
    if (this.lightningStrength > 0.08) {
      this.lightningBoltGroup.visible = true;
      this.lightningBoltMat.opacity = Math.min(1, this.lightningStrength * 1.3);
      this.lightningCoreMat.opacity = this.lightningStrength * 0.45;
    } else {
      this.lightningBoltGroup.visible = false;
    }
    const flashBoost = this.lightningStrength > 0.45 ? this.lightningStrength * 1.45 : 0;

    this.sunLight.color.setRGB(
      Math.min(1, this.transitionState.sunRgb.r + flashBoost * 0.35),
      Math.min(1, this.transitionState.sunRgb.g + flashBoost * 0.45),
      Math.min(1, this.transitionState.sunRgb.b + flashBoost * 0.85)
    );
    this.sunLight.intensity = this.transitionState.sunIntensity + flashBoost;

    this.hemiLight.color.setRGB(
      this.transitionState.hemiSkyRgb.r,
      this.transitionState.hemiSkyRgb.g,
      this.transitionState.hemiSkyRgb.b
    );
    this.hemiLight.groundColor.setRGB(
      this.transitionState.hemiGroundRgb.r,
      this.transitionState.hemiGroundRgb.g,
      this.transitionState.hemiGroundRgb.b
    );
    this.hemiLight.intensity =
      this.transitionState.hemiIntensity + flashBoost * 0.35;

    this.monasPlazaLight.intensity =
      this.transitionState.monasPlazaLightIntensity;
    this.sudirmanPlazaLight.intensity =
      this.transitionState.sudirmanPlazaLightIntensity;

    this.skyUniforms.uTopColor.value.setRGB(
      this.transitionState.skyTopRgb.r,
      this.transitionState.skyTopRgb.g,
      this.transitionState.skyTopRgb.b
    );
    this.skyUniforms.uHorizonColor.value.setRGB(
      this.transitionState.skyHorizonRgb.r,
      this.transitionState.skyHorizonRgb.g,
      this.transitionState.skyHorizonRgb.b
    );
    this.skyUniforms.uBottomColor.value.setRGB(
      this.transitionState.skyBottomRgb.r,
      this.transitionState.skyBottomRgb.g,
      this.transitionState.skyBottomRgb.b
    );
    this.skyUniforms.uSunColor.value.setRGB(
      this.transitionState.sunColorRgb.r,
      this.transitionState.sunColorRgb.g,
      this.transitionState.sunColorRgb.b
    );
    this.skyUniforms.uSunGlowStrength.value =
      this.transitionState.sunGlowStrength;
    this.skyUniforms.uSunDir.value
      .set(
        this.transitionState.sunDir[0],
        this.transitionState.sunDir[1],
        this.transitionState.sunDir[2]
      )
      .normalize();
    this.skyUniforms.uTime.value = this.elapsedTime;
    this.skyUniforms.uWetness.value = wet;
    this.skyUniforms.uNightFactor.value = this.transitionState.nightFactor;
    this.skyUniforms.uLightning.value = this.lightningStrength;

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setRGB(
        this.transitionState.fogHorizonRgb.r,
        this.transitionState.fogHorizonRgb.g,
        this.transitionState.fogHorizonRgb.b
      );
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.setRGB(
        this.transitionState.fogHorizonRgb.r,
        this.transitionState.fogHorizonRgb.g,
        this.transitionState.fogHorizonRgb.b
      );
      this.scene.fog.density = Math.max(0.002, this.transitionState.fogDensity);
    }

    // Active rain drops only during monsoon downpour (wet > 0.58), preserving glossy post-rain asphalt in senja/malam
    if (wet > 0.58) {
      const rainIntensity = Math.min(1, (wet - 0.58) / 0.42);
      const activeRain = Math.max(32, Math.round(this.rainCount * rainIntensity));
      this.rainInst.visible = true;
      this.rainInst.count = activeRain;
      this.rainMat.opacity = 0.14 + rainIntensity * 0.36;
      const dummy = this.rainDummy;
      for (let i = 0; i < activeRain; i++) {
        this.rainOffsetsY[i] -= this.rainSpeeds[i] * dt;
        this.rainOffsetsX[i] -= 2.4 * dt;
        if (this.rainOffsetsY[i] < 0) {
          this.rainOffsetsY[i] = 24 + (i % 5);
          this.rainOffsetsX[i] = (Math.random() - 0.5) * 46;
          this.rainOffsetsZ[i] = (Math.random() - 0.5) * 46;
        }
        dummy.position.set(
          playerX + this.rainOffsetsX[i],
          this.rainOffsetsY[i],
          playerZ + this.rainOffsetsZ[i]
        );
        dummy.rotation.set(0, 0, -0.09);
        dummy.scale.set(1, 0.72 + rainIntensity * 0.7, 1);
        dummy.updateMatrix();
        this.rainInst.setMatrixAt(i, dummy.matrix);
      }
      this.rainInst.instanceMatrix.needsUpdate = true;
    } else {
      this.rainInst.visible = false;
    }

    // Dynamic Time-of-Day Sun/Moon direction + texel-snapped directional shadow frustum tracking player
    const sunDirX = this.transitionState.sunDir[0];
    const sunDirY = Math.max(0.32, this.transitionState.sunDir[1]);
    const sunDirZ = this.transitionState.sunDir[2];
    const sunDist = 84;
    this.sunOffset.set(sunDirX * sunDist, sunDirY * sunDist, sunDirZ * sunDist);

    const snapX = this.sunLight.castShadow
      ? snapShadowCoordToTexel(playerX, this.shadowHalfExtent, this.shadowMapSize)
      : playerX;
    const snapZ = this.sunLight.castShadow
      ? snapShadowCoordToTexel(playerZ, this.shadowHalfExtent, this.shadowMapSize)
      : playerZ;
    this.sunLight.target.position.set(snapX, 0, snapZ);
    this.sunLight.position.set(
      snapX + this.sunOffset.x,
      this.sunOffset.y,
      snapZ + this.sunOffset.z
    );

    this.skyDomeMesh.position.copy(cameraPosition);

    return {
      nightFactor: this.transitionState.nightFactor,
      wetnessFactor: wet,
      lightningTriggered,
    };
  }

  public dispose(): void {
    this.skyDomeGeo.dispose();
    this.skyDomeMat.dispose();
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.lightningBoltLine.geometry.dispose();
    this.lightningBoltMat.dispose();
    this.lightningBoltCore.geometry.dispose();
    this.lightningCoreMat.dispose();
    this.sunLight.shadow.map?.dispose();
  }
}

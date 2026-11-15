import * as THREE from 'three';
import {
  WeatherMode,
  WeatherTransitionState,
  createInitialWeatherTransitionState,
  stepWeatherTransitionInPlace,
} from '../game/rules';

const RAIN_DROP_COUNT = 260;

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

  private rainGeo: THREE.BoxGeometry;
  private rainMat: THREE.MeshBasicMaterial;
  private rainInst: THREE.InstancedMesh;
  private rainOffsetsX = new Float32Array(RAIN_DROP_COUNT);
  private rainOffsetsY = new Float32Array(RAIN_DROP_COUNT);
  private rainOffsetsZ = new Float32Array(RAIN_DROP_COUNT);
  private rainSpeeds = new Float32Array(RAIN_DROP_COUNT);
  private rainDummy = new THREE.Object3D();

  constructor(
    scene: THREE.Scene,
    initialWeather: WeatherMode,
    isSoftwareGl: boolean
  ) {
    this.scene = scene;
    this.shadowMapSize = isSoftwareGl ? 512 : 2048;

    const horizonHex = 0x1e2638;
    scene.background = new THREE.Color(horizonHex);
    scene.fog = new THREE.FogExp2(horizonHex, 0.0028);

    this.skyDomeGeo = new THREE.SphereGeometry(250, 28, 20);
    this.skyUniforms = {
      uTopColor: { value: new THREE.Color(0x0c1428) },
      uHorizonColor: { value: new THREE.Color(0xd97706) },
      uBottomColor: { value: new THREE.Color(0x0f172a) },
      uSunDir: { value: new THREE.Vector3(0.55, 0.34, 0.76).normalize() },
      uSunColor: { value: new THREE.Color(0xffd28a) },
      uSunGlowStrength: { value: 0.45 },
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
        varying vec3 vLocalPos;
        void main() {
          vec3 dir = normalize(vLocalPos);
          float h = dir.y;
          vec3 col = mix(uBottomColor, uHorizonColor, smoothstep(-0.14, 0.03, h));
          col = mix(col, uTopColor, smoothstep(0.0, 0.38, h));
          float sunAmt = max(dot(dir, normalize(uSunDir)), 0.0);
          col += uSunColor * pow(sunAmt, 18.0) * (0.35 * uSunGlowStrength);
          col += uSunColor * smoothstep(0.997, 0.9995, sunAmt) * (0.9 * uSunGlowStrength);
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
    this.rainGeo = new THREE.BoxGeometry(0.032, 0.85, 0.032);
    this.rainMat = new THREE.MeshBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    this.rainInst = new THREE.InstancedMesh(
      this.rainGeo,
      this.rainMat,
      RAIN_DROP_COUNT
    );
    this.rainInst.frustumCulled = false;
    this.rainInst.visible = false;
    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      this.rainOffsetsX[i] = (Math.random() - 0.5) * 44;
      this.rainOffsetsY[i] = Math.random() * 26;
      this.rainOffsetsZ[i] = (Math.random() - 0.5) * 44;
      this.rainSpeeds[i] = 24 + Math.random() * 11;
    }
    scene.add(this.rainInst);

    this.transitionState = createInitialWeatherTransitionState(initialWeather);
  }

  public update(
    targetWeather: WeatherMode,
    playerX: number,
    playerZ: number,
    cameraPosition: THREE.Vector3,
    dt: number
  ): { nightFactor: number; wetnessFactor: number } {
    stepWeatherTransitionInPlace(this.transitionState, targetWeather, dt, 1.65);

    this.sunLight.color.setRGB(
      this.transitionState.sunRgb.r,
      this.transitionState.sunRgb.g,
      this.transitionState.sunRgb.b
    );
    this.sunLight.intensity = this.transitionState.sunIntensity;

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
    this.hemiLight.intensity = this.transitionState.hemiIntensity;

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
      this.scene.fog.density = this.transitionState.fogDensity;
    }

    // Rain particle curtain around player camera
    const wet = this.transitionState.wetnessFactor;
    if (wet > 0.12) {
      this.rainInst.visible = true;
      this.rainMat.opacity = 0.1 + wet * 0.36;
      const dummy = this.rainDummy;
      for (let i = 0; i < RAIN_DROP_COUNT; i++) {
        this.rainOffsetsY[i] -= this.rainSpeeds[i] * dt;
        this.rainOffsetsX[i] -= 2.2 * dt;
        if (this.rainOffsetsY[i] < 0) {
          this.rainOffsetsY[i] = 24 + (i % 5);
          this.rainOffsetsX[i] = (Math.random() - 0.5) * 44;
          this.rainOffsetsZ[i] = (Math.random() - 0.5) * 44;
        }
        dummy.position.set(
          playerX + this.rainOffsetsX[i],
          this.rainOffsetsY[i],
          playerZ + this.rainOffsetsZ[i]
        );
        dummy.rotation.set(0, 0, -0.09);
        dummy.scale.set(1, 0.7 + wet * 0.65, 1);
        dummy.updateMatrix();
        this.rainInst.setMatrixAt(i, dummy.matrix);
      }
      this.rainInst.instanceMatrix.needsUpdate = true;
    } else {
      this.rainInst.visible = false;
    }

    // Texel-snapped directional sun shadow frustum tracking player
    if (this.sunLight.castShadow) {
      const texelWorldSize = (this.shadowHalfExtent * 2) / this.shadowMapSize;
      const snapX = Math.round(playerX / texelWorldSize) * texelWorldSize;
      const snapZ = Math.round(playerZ / texelWorldSize) * texelWorldSize;
      this.sunLight.target.position.set(snapX, 0, snapZ);
      this.sunLight.position.set(
        snapX + this.sunOffset.x,
        this.sunOffset.y,
        snapZ + this.sunOffset.z
      );
    }

    this.skyDomeMesh.position.copy(cameraPosition);

    return {
      nightFactor: this.transitionState.nightFactor,
      wetnessFactor: wet,
    };
  }

  public dispose(): void {
    this.skyDomeGeo.dispose();
    this.skyDomeMat.dispose();
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.sunLight.shadow.map?.dispose();
  }
}

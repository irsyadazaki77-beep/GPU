import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import type { GraphicsQualityTier, PhotoFilterId } from '../game/types';
import { computeTimeOfDayToneState } from './visualOverhaulMath';

export type ResolvedQualityTier = Exclude<GraphicsQualityTier, 'auto'>;

const CinematicGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uChromatic: { value: 0.0012 },
    uVignette: { value: 0.24 },
    uDamagePulse: { value: 0 },
    uFokusMix: { value: 0 },
    uSpeedRatio: { value: 0 },
    uPhotoFilter: { value: 0 },
    uTime: { value: 0 },
    uDroneReconMix: { value: 0 },
    uLightningFlash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uChromatic;
    uniform float uVignette;
    uniform float uDamagePulse;
    uniform float uFokusMix;
    uniform float uSpeedRatio;
    uniform float uPhotoFilter;
    uniform float uTime;
    uniform float uDroneReconMix;
    uniform float uLightningFlash;
    varying vec2 vUv;

    void main() {
      vec2 center = vUv - vec2(0.5);
      float dist = length(center);
      vec2 offset = center * uChromatic * (0.4 + dist * 1.4);

      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 col = vec3(r, g, b);

      // Subtle 4-tap local micro-sharpen to keep road markings, storefront signs & car lines crisp over FXAA
      float texel = 0.00085;
      vec3 blurNeighbors = (
        texture2D(tDiffuse, vUv + vec2(texel, 0.0)).rgb +
        texture2D(tDiffuse, vUv - vec2(texel, 0.0)).rgb +
        texture2D(tDiffuse, vUv + vec2(0.0, texel)).rgb +
        texture2D(tDiffuse, vUv - vec2(0.0, texel)).rgb
      ) * 0.25;
      col = clamp(col + (col - blurNeighbors) * 0.26, vec3(0.0), vec3(1.5));

      // Subtle high-speed / Nitro peripheral radial motion blur streaks
      float speedBlurMask = smoothstep(0.52, 1.15, uSpeedRatio + uFokusMix * 0.28) * smoothstep(0.24, 0.72, dist);
      if (speedBlurMask > 0.005) {
        vec2 radialStep = center * (0.018 * speedBlurMask);
        vec3 s1 = texture2D(tDiffuse, vUv - radialStep).rgb;
        vec3 s2 = texture2D(tDiffuse, vUv - radialStep * 2.0).rgb;
        col = mix(col, (col + s1 + s2) * 0.3333, min(0.58, speedBlurMask * 0.65));
      }

      // Tropical Vice-Jakarta Split-Tone Grade (warm coral-amber highlights + cool deep indigo shadows)
      float lumaBase = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 shadowTint = vec3(col.r * 0.96, col.g * 0.98, col.b * 1.07);
      vec3 highlightTint = vec3(col.r * 1.06, col.g * 1.01, col.b * 0.96);
      col = mix(shadowTint, highlightTint, smoothstep(0.18, 0.78, lumaBase));

      // Subtle warm golden Fokus highlight + peripheral kinetic energy rim
      vec3 fokusTint = vec3(col.r * 1.08, col.g * 1.03, col.b * 0.86);
      col = mix(col, fokusTint, uFokusMix * 0.38);
      col += vec3(0.06, 0.22, 0.35) * uFokusMix * smoothstep(0.38, 0.85, dist) * 0.45;

      // Photo Mode Color Grading Filters (1=senja_emas, 2=noir_jakarta, 3=siber_matrix, 4=vintage_98)
      if (uPhotoFilter > 0.5 && uPhotoFilter < 1.5) {
        // Senja Emas Jakarta
        col = vec3(col.r * 1.16, col.g * 1.02, col.b * 0.82);
        col = pow(max(col, vec3(0.0)), vec3(0.95));
      } else if (uPhotoFilter > 1.5 && uPhotoFilter < 2.5) {
        // Noir Kontras Jakarta
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        float highContrast = smoothstep(0.08, 0.92, luma);
        col = mix(vec3(highContrast), col * vec3(1.1, 0.95, 0.9), 0.14);
      } else if (uPhotoFilter > 2.5 && uPhotoFilter < 3.5) {
        // Siber Matrix Neon
        col = vec3(col.r * 0.82, col.g * 1.12, col.b * 1.22);
      } else if (uPhotoFilter > 3.5) {
        // Vintage 98 Film
        float luma = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 sepia = vec3(luma * 1.08, luma * 0.98, luma * 0.82);
        col = mix(col, sepia, 0.42) + vec3(0.02, 0.015, 0.03);
      }

      // Subtle peripheral cinema vignette + crimson hit pulse
      float vig = smoothstep(0.42, 0.96, dist) * uVignette;
      col *= (1.0 - vig);
      float dmgMask = smoothstep(0.32, 0.85, dist) * uDamagePulse;
      col = mix(col, vec3(0.86, 0.12, 0.14), clamp(dmgMask * 0.55, 0.0, 0.65));

      // Gentle filmic S-curve + ultra-subtle analog micro-grain to cure flat 8-bit sky/asphalt banding
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.14);
      float grain = (fract(sin(dot(vUv * vec2(1280.0, 720.0) + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.014;
      col += grain * (1.0 - lumaBase * 0.45);

      // Rajawali-X Tactical Drone FPV Scanline & Cyber Optic Grade
      if (uDroneReconMix > 0.01) {
        float scan = 0.92 + 0.08 * sin(vUv.y * 540.0 + uTime * 8.0);
        vec3 cyberCol = vec3(col.r * 0.72, col.g * 1.12, col.b * 1.24) * scan;
        col = mix(col, cyberCol, clamp(uDroneReconMix, 0.0, 1.0));
      }

      // Monsoon Lightning Flash
      if (uLightningFlash > 0.005) {
        col = mix(col, vec3(0.88, 0.95, 1.0), clamp(uLightningFlash * 0.48, 0.0, 0.65));
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export interface PostProcessingFrameParams {
  dt: number;
  nightFactor: number;
  wetnessFactor?: number;
  speedRatio: number;
  fokusActive: boolean;
  damagePulse: number;
  requestedTier: GraphicsQualityTier;
  photoFilter?: PhotoFilterId;
  droneReconActive?: boolean;
  lightningFlash?: number;
}

export class PostProcessingPipeline {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;

  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloomPass: UnrealBloomPass;
  private readonly gradePass: ShaderPass;
  private readonly fxaaPass: ShaderPass;
  private readonly outputPass: OutputPass;

  private width = 1;
  private height = 1;
  private resolvedTier: ResolvedQualityTier = 'balanced';
  private activePixelRatio = 1;

  private readonly frameWindow: number[] = [];
  private governorCooldown = 0;
  private elapsedTime = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    width: number,
    height: number,
    isSoftwareGl: boolean
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.isSoftwareGl = isSoftwareGl;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    const isMobileViewport = this.width < 768;
    this.resolvedTier = isSoftwareGl
      ? 'performance'
      : isMobileViewport
      ? 'balanced'
      : 'ultra';

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, Math.floor(this.width / 2)), Math.max(1, Math.floor(this.height / 2))),
      0.32,
      0.4,
      0.85
    );
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(CinematicGradeShader);
    this.composer.addPass(this.gradePass);

    this.fxaaPass = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    this.applyTierConfiguration(this.resolvedTier);
  }

  public getResolvedTier(): ResolvedQualityTier {
    return this.resolvedTier;
  }

  public getRecommendedCrowdRatio(): number {
    if (this.resolvedTier === 'performance') return 0.4;
    if (this.resolvedTier === 'balanced') return 0.72;
    return 1.0;
  }

  private applyTierConfiguration(tier: ResolvedQualityTier): void {
    this.resolvedTier = tier;
    if (this.isSoftwareGl) {
      this.resolvedTier = 'performance';
      this.activePixelRatio = 1;
      this.renderer.setPixelRatio(1);
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    let targetRatio = 1;
    if (tier === 'performance') {
      targetRatio = Math.min(dpr, 1.0);
      this.bloomPass.enabled = false;
      this.fxaaPass.enabled = false;
    } else if (tier === 'balanced') {
      targetRatio = Math.min(dpr, 1.35);
      this.bloomPass.enabled = true;
      this.fxaaPass.enabled = true;
    } else {
      targetRatio = Math.min(dpr, 1.85);
      this.bloomPass.enabled = true;
      this.fxaaPass.enabled = true;
    }

    if (Math.abs(targetRatio - this.activePixelRatio) > 0.05) {
      this.activePixelRatio = targetRatio;
      this.renderer.setPixelRatio(targetRatio);
      this.composer.setPixelRatio(targetRatio);
    }
    this.updateFxaaResolution();
  }

  private updateFxaaResolution(): void {
    const pr = this.activePixelRatio || 1;
    const invW = 1 / Math.max(1, this.width * pr);
    const invH = 1 / Math.max(1, this.height * pr);
    if (this.fxaaPass.material.uniforms.resolution?.value) {
      this.fxaaPass.material.uniforms.resolution.value.set(invW, invH);
    }
  }

  public setSize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.renderer.setSize(this.width, this.height);
    if (!this.isSoftwareGl) {
      this.composer.setSize(this.width, this.height);
      this.bloomPass.resolution.set(
        Math.max(1, Math.floor(this.width / 2)),
        Math.max(1, Math.floor(this.height / 2))
      );
      this.updateFxaaResolution();
    }
  }

  public render(
    params: PostProcessingFrameParams,
    onTierChanged?: (tier: ResolvedQualityTier) => void
  ): void {
    if (this.isSoftwareGl) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Evaluate Auto 60 FPS Governor
    if (params.requestedTier !== 'auto') {
      if (this.resolvedTier !== params.requestedTier) {
        this.applyTierConfiguration(params.requestedTier);
        onTierChanged?.(this.resolvedTier);
      }
    } else {
      const clampedMs = Math.min(100, Math.max(4, params.dt * 1000));
      this.frameWindow.push(clampedMs);
      if (this.frameWindow.length > 36) {
        this.frameWindow.shift();
      }
      this.governorCooldown = Math.max(0, this.governorCooldown - params.dt);

      if (this.frameWindow.length >= 28 && this.governorCooldown <= 0) {
        let sum = 0;
        for (let i = 0; i < this.frameWindow.length; i++) {
          sum += this.frameWindow[i];
        }
        const avgMs = sum / this.frameWindow.length;

        let nextTier = this.resolvedTier;
        if (avgMs > 23.5) {
          nextTier =
            this.resolvedTier === 'ultra' ? 'balanced' : 'performance';
        } else if (avgMs < 15.2 && this.width >= 768) {
          nextTier =
            this.resolvedTier === 'performance' ? 'balanced' : 'ultra';
        }

        if (nextTier !== this.resolvedTier) {
          this.applyTierConfiguration(nextTier);
          onTierChanged?.(this.resolvedTier);
          this.governorCooldown = 3.5;
          this.frameWindow.length = 0;
        }
      }
    }

    const filterCode =
      params.photoFilter === 'senja_emas'
        ? 1
        : params.photoFilter === 'noir_jakarta'
        ? 2
        : params.photoFilter === 'siber_matrix'
        ? 3
        : params.photoFilter === 'vintage_98'
        ? 4
        : 0;

    if (this.resolvedTier === 'performance' && filterCode === 0) {
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Dynamic Bloom & Grade tuning based on Jakarta time-of-day + Fokus + Speed
    const tone = computeTimeOfDayToneState(
      params.nightFactor,
      params.wetnessFactor ?? 0
    );
    this.bloomPass.strength =
      tone.bloomStrength + (params.fokusActive ? 0.06 : 0);
    this.bloomPass.radius = tone.bloomRadius;
    this.bloomPass.threshold = tone.bloomThreshold;

    this.elapsedTime += params.dt;
    const u = this.gradePass.material.uniforms;
    u.uChromatic.value =
      Math.max(0, params.speedRatio - 0.65) * 0.0012 + params.damagePulse * 0.0018;
    u.uVignette.value = 0.14 + params.speedRatio * 0.11;
    u.uDamagePulse.value = params.damagePulse;
    u.uFokusMix.value = params.fokusActive ? 1.0 : 0.0;
    u.uSpeedRatio.value = params.speedRatio;
    u.uPhotoFilter.value = filterCode;
    u.uTime.value = this.elapsedTime;
    u.uDroneReconMix.value = params.droneReconActive ? 1.0 : 0.0;
    u.uLightningFlash.value = params.lightningFlash ?? 0;

    this.composer.render();
  }

  public dispose(): void {
    this.bloomPass.dispose();
    this.gradePass.dispose();
    this.fxaaPass.dispose();
    this.outputPass.dispose();
    this.composer.dispose();
  }
}


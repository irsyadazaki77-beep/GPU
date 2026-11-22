import * as THREE from 'three';
import { GRAND_HEISTS } from '../game/heists';
import type { HeistId } from '../game/types';

interface VaultSecurityRig {
  heistId: HeistId;
  root: THREE.Group;
  cctvHead: THREE.Group;
  cctvConeMat: THREE.MeshBasicMaterial;
  laserBeamMat: THREE.MeshBasicMaterial;
  laserBarA: THREE.Mesh;
  laserBarB: THREE.Mesh;
  strobeBeacon: THREE.Mesh;
  strobeMat: THREE.MeshBasicMaterial;
  baseX: number;
  baseZ: number;
}

export interface LaserTripwireResult {
  tripped: boolean;
  heistId: HeistId | null;
  vaultX: number;
  vaultZ: number;
}

/**
 * Pure check testing whether the player stepped or drove into an armed
 * 3D Heist Vault security laser gate before disabling it with Drone EMP.
 */
export function evaluateHeistLaserTripwire(params: {
  playerX: number;
  playerY: number;
  playerZ: number;
  sabotagedIds: string[];
}): LaserTripwireResult {
  if (params.playerY > 2.75) {
    return { tripped: false, heistId: null, vaultX: 0, vaultZ: 0 };
  }
  for (const h of GRAND_HEISTS) {
    if (params.sabotagedIds.includes(h.id)) continue;
    const dx = params.playerX - h.vaultX;
    const dz = params.playerZ - (h.vaultZ + 3.8);
    if (Math.abs(dx) <= 3.6 && Math.abs(dz) <= 0.72) {
      return {
        tripped: true,
        heistId: h.id,
        vaultX: h.vaultX,
        vaultZ: h.vaultZ + 3.8,
      };
    }
  }
  return { tripped: false, heistId: null, vaultX: 0, vaultZ: 0 };
}

/**
 * Renders 3D Heist Vault security CCTV vision cones, sweeping red laser tripwires,
 * armored vault door arch, gold bullion pallets, and alarm beacons at Jakarta's Grand Heist sites.
 * Responds dynamically to Rajawali-X EMP sabotage (`sabotagedHeistCctvIds`).
 */
export class HeistSecurity3DManager {
  public readonly group = new THREE.Group();
  private readonly rigs: VaultSecurityRig[] = [];

  constructor(scene: THREE.Scene) {
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.55,
      metalness: 0.7,
    });
    const vaultSteelMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.85,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xca8a04,
      emissiveIntensity: 0.25,
      roughness: 0.22,
      metalness: 0.92,
    });
    const terminalMat = new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    });
    const camBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.4,
      metalness: 0.45,
    });

    const poleGeo = new THREE.CylinderGeometry(0.11, 0.14, 5.2, 8);
    const pillarGeo = new THREE.BoxGeometry(0.45, 3.6, 0.45);
    const lintelGeo = new THREE.BoxGeometry(7.9, 0.42, 0.52);
    const goldBarGeo = new THREE.BoxGeometry(1.1, 0.55, 0.7);
    const terminalGeo = new THREE.BoxGeometry(0.42, 1.35, 0.32);
    const camGeo = new THREE.BoxGeometry(0.38, 0.24, 0.58);
    const coneGeo = new THREE.ConeGeometry(2.6, 7.2, 16, 1, true);
    coneGeo.translate(0, -3.6, 0);
    coneGeo.rotateX(Math.PI / 2.6);

    const laserGeo = new THREE.CylinderGeometry(0.03, 0.03, 7.2, 6);
    laserGeo.rotateZ(Math.PI / 2);

    const strobeGeo = new THREE.SphereGeometry(0.24, 10, 8);

    for (const h of GRAND_HEISTS) {
      const root = new THREE.Group();
      root.position.set(h.vaultX, 0, h.vaultZ);

      // Walkable 3D Armored Vault Archway & Gold Bullion Interior Cache
      const leftPillar = new THREE.Mesh(pillarGeo, vaultSteelMat);
      leftPillar.position.set(-3.75, 1.8, 3.8);
      const rightPillar = new THREE.Mesh(pillarGeo, vaultSteelMat);
      rightPillar.position.set(3.75, 1.8, 3.8);
      const topLintel = new THREE.Mesh(lintelGeo, vaultSteelMat);
      topLintel.position.set(0, 3.65, 3.8);
      const goldStack = new THREE.Mesh(goldBarGeo, goldMat);
      goldStack.position.set(0, 0.28, 1.1);
      const cyberConsole = new THREE.Mesh(terminalGeo, terminalMat);
      cyberConsole.position.set(2.8, 0.68, 2.2);
      root.add(leftPillar, rightPillar, topLintel, goldStack, cyberConsole);

      // Perimeter security mast next to vault entrance
      const mast = new THREE.Mesh(poleGeo, poleMat);
      mast.position.set(-4.2, 2.6, 3.6);
      root.add(mast);

      const cctvHead = new THREE.Group();
      cctvHead.position.set(-4.2, 5.15, 3.6);

      const camBody = new THREE.Mesh(camGeo, camBodyMat);
      cctvHead.add(camBody);

      const cctvConeMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.16,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const cone = new THREE.Mesh(coneGeo, cctvConeMat);
      cctvHead.add(cone);
      root.add(cctvHead);

      const laserBeamMat = new THREE.MeshBasicMaterial({
        color: 0xf43f5e,
        transparent: true,
        opacity: 0.72,
      });
      const laserBarA = new THREE.Mesh(laserGeo, laserBeamMat);
      laserBarA.position.set(0, 1.15, 3.8);
      root.add(laserBarA);

      const laserBarB = new THREE.Mesh(laserGeo, laserBeamMat);
      laserBarB.position.set(0, 2.25, 3.8);
      root.add(laserBarB);

      const strobeMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.85,
      });
      const strobeBeacon = new THREE.Mesh(strobeGeo, strobeMat);
      strobeBeacon.position.set(-4.2, 5.65, 3.6);
      root.add(strobeBeacon);

      this.group.add(root);
      this.rigs.push({
        heistId: h.id,
        root,
        cctvHead,
        cctvConeMat,
        laserBeamMat,
        laserBarA,
        laserBarB,
        strobeBeacon,
        strobeMat,
        baseX: h.vaultX,
        baseZ: h.vaultZ,
      });
    }

    scene.add(this.group);
  }

  public step(
    elapsedSec: number,
    playerX: number,
    playerZ: number,
    sabotagedIds: string[],
    activeHeistId: HeistId | null
  ): void {
    for (let i = 0; i < this.rigs.length; i++) {
      const rig = this.rigs[i];
      const dist = Math.hypot(playerX - rig.baseX, playerZ - rig.baseZ);
      const isFocused = activeHeistId === rig.heistId || dist < 62;
      rig.root.visible = isFocused;
      if (!isFocused) continue;

      const sabotaged = sabotagedIds.includes(rig.heistId);
      if (sabotaged) {
        rig.cctvHead.rotation.y = Math.sin(elapsedSec * 0.4 + i) * 0.15;
        rig.cctvHead.rotation.x = 0.55;
        rig.cctvConeMat.color.setHex(0x22d3ee);
        rig.cctvConeMat.opacity = 0.05;
        rig.laserBarA.visible = false;
        rig.laserBarB.visible = false;
        rig.strobeMat.color.setHex(0x22d3ee);
        rig.strobeMat.opacity = 0.25;
      } else {
        rig.cctvHead.rotation.x = 0;
        rig.cctvHead.rotation.y = Math.sin(elapsedSec * 1.15 + i * 1.3) * 0.85;
        rig.cctvConeMat.color.setHex(0xef4444);
        rig.cctvConeMat.opacity = 0.14 + Math.sin(elapsedSec * 4) * 0.04;
        rig.laserBarA.visible = true;
        rig.laserBarB.visible = true;
        rig.laserBarA.position.y = 1.05 + Math.sin(elapsedSec * 2.4 + i) * 0.38;
        rig.laserBarB.position.y = 2.25 + Math.cos(elapsedSec * 2.1 + i) * 0.35;
        rig.laserBeamMat.opacity = 0.62 + Math.sin(elapsedSec * 8) * 0.2;
        rig.strobeMat.color.setHex(0xef4444);
        rig.strobeMat.opacity = elapsedSec % 0.8 < 0.4 ? 0.95 : 0.2;
      }
    }
  }
}

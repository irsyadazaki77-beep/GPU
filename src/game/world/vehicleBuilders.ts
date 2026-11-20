import * as THREE from 'three';
import {
  VEHICLE_CUSTOM_PAINTS,
  VEHICLE_SPECS,
  VEHICLE_UNDERGLOWS,
} from '../racing';
import type { VehicleCustomConfig, VehicleType } from '../types';
import { createContactShadowDisc } from './cityBuilders';
import {
  VehicleMaterialSet,
  createWheelAssembly,
  extrudeSideProfile,
  populateHeavyOrAirVehicle,
} from './heavyVehicleBuilders';

export function buildIndonesianVehicleMesh(type: VehicleType): THREE.Group {
  const spec = VEHICLE_SPECS[type];
  const group = new THREE.Group();

  group.add(createContactShadowDisc(spec.radius * 1.05));

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: spec.colorHex,
    roughness: 0.46,
    metalness: 0.24,
    clearcoat: 0.32,
    clearcoatRoughness: 0.34,
    envMapIntensity: 0.16,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: spec.accentHex,
    roughness: 0.68,
    metalness: 0.2,
    envMapIntensity: 0.14,
  });
  const darkGrilleMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.78,
    metalness: 0.2,
    envMapIntensity: 0.1,
  });
  const underglowGeo = new THREE.RingGeometry(
    spec.radius * 0.55,
    spec.radius * 1.15,
    24
  );
  underglowGeo.rotateX(-Math.PI / 2);
  const underglowMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const underglowMesh = new THREE.Mesh(underglowGeo, underglowMat);
  underglowMesh.position.y = 0.045;
  group.add(underglowMesh);

  group.userData.bodyMat = bodyMat;
  group.userData.trimMat = trimMat;
  group.userData.underglowMat = underglowMat;

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x070d19,
    roughness: 0.32,
    metalness: 0.28,
    clearcoat: 0.38,
    envMapIntensity: 0.18,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x14161b,
    roughness: 0.88,
    metalness: 0.06,
    envMapIntensity: 0.15,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.3,
    metalness: 0.72,
    envMapIntensity: 0.4,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfde047,
    emissiveIntensity: 0.65,
    roughness: 0.2,
  });
  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.75,
    roughness: 0.25,
  });
  group.userData.taillightMat = taillightMat;

  const collectWheels = (root: THREE.Group) => {
    const wheels: THREE.Object3D[] = [];
    root.traverse((child) => {
      if (child.userData?.isWheel) {
        wheels.push(child);
      }
    });
    root.userData.wheels = wheels;
  };

  const mats: VehicleMaterialSet = {
    bodyMat,
    trimMat,
    glassMat,
    tireMat,
    alloyMat,
    headlightMat,
    taillightMat,
  };

  if (
    type === 'heli' ||
    type === 'metromini' ||
    type === 'transjakarta' ||
    type === 'barracuda' ||
    type === 'vtol_jet'
  ) {
    populateHeavyOrAirVehicle(type, group, mats);
    collectWheels(group);
    return group;
  }

  if (type === 'bajaj') {
    const hullGeo = extrudeSideProfile(
      [
        [-1.1, 0.28],
        [1.12, 0.28],
        [1.18, 0.65],
        [0.86, 0.98],
        [0.42, 0.98],
        [0.35, 0.45],
        [-0.45, 0.45],
        [-1.08, 0.95],
      ],
      1.42,
      0.06
    );
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.castShadow = true;
    group.add(hull);

    const canopyGeo = extrudeSideProfile(
      [
        [-1.02, 0.95],
        [-0.95, 1.62],
        [0.45, 1.68],
        [0.62, 1.48],
        [-0.85, 1.42],
      ],
      1.36,
      0.05
    );
    const canopy = new THREE.Mesh(
      canopyGeo,
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.85,
        envMapIntensity: 0.2,
      })
    );
    group.add(canopy);

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.18, 0.56, 0.08),
      glassMat
    );
    glass.position.set(0, 1.24, 0.62);
    glass.rotation.x = -0.32;
    group.add(glass);

    const fw = createWheelAssembly(0.34, 0.22, tireMat, alloyMat);
    fw.position.set(0, 0.34, 0.92);
    group.add(fw);
    for (const sx of [-0.72, 0.72]) {
      const rw = createWheelAssembly(0.36, 0.24, tireMat, alloyMat);
      rw.position.set(sx, 0.36, -0.78);
      group.add(rw);
    }

    const lamp = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 10, 10),
      headlightMat
    );
    lamp.position.set(0, 0.76, 1.2);
    group.add(lamp);
  } else if (type === 'ojek') {
    const fairingGeo = extrudeSideProfile(
      [
        [-0.88, 0.48],
        [0.75, 0.48],
        [0.9, 0.88],
        [0.52, 1.18],
        [0.18, 0.86],
        [-0.35, 0.88],
        [-0.86, 0.95],
      ],
      0.46,
      0.06
    );
    const fairing = new THREE.Mesh(fairingGeo, bodyMat);
    fairing.castShadow = true;
    group.add(fairing);

    const seat = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.18, 0.58, 4, 8),
      trimMat
    );
    seat.rotation.x = Math.PI / 2;
    seat.position.set(0, 0.92, -0.2);
    group.add(seat);

    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.56), trimMat);
    box.position.set(0, 1.22, -0.72);
    group.add(box);

    const bar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.88, 8),
      alloyMat
    );
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 1.24, 0.56);
    group.add(bar);

    for (const sz of [-0.66, 0.72]) {
      const w = createWheelAssembly(0.34, 0.16, tireMat, alloyMat);
      w.position.set(0, 0.34, sz);
      group.add(w);
    }

    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.16, 0.1),
      headlightMat
    );
    lamp.position.set(0, 1.04, 0.84);
    group.add(lamp);
  } else if (type === 'angkot') {
    const bodyGeo = extrudeSideProfile(
      [
        [-1.82, 0.36],
        [1.82, 0.36],
        [1.86, 0.98],
        [1.6, 1.65],
        [-1.72, 1.68],
      ],
      1.76,
      0.09
    );
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    group.add(body);

    const winBand = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.48, 3.15),
      glassMat
    );
    winBand.position.set(0, 1.32, 0.04);
    group.add(winBand);

    const roofRack = new THREE.Mesh(
      new THREE.BoxGeometry(1.42, 0.12, 2.4),
      trimMat
    );
    roofRack.position.set(0, 1.78, -0.15);
    group.add(roofRack);

    const frontGrille = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.28, 0.08),
      darkGrilleMat
    );
    frontGrille.position.set(0, 0.66, 1.88);
    group.add(frontGrille);

    for (const sx of [-0.88, 0.88]) {
      for (const sz of [-1.15, 1.15]) {
        const w = createWheelAssembly(0.36, 0.24, tireMat, alloyMat);
        w.position.set(sx, 0.36, sz);
        group.add(w);
      }
    }
    for (const sx of [-0.62, 0.62]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.16, 0.1),
        headlightMat
      );
      hl.position.set(sx, 0.68, 1.88);
      group.add(hl);
    }
  } else if (type === 'supercar') {
    const bodyGeo = extrudeSideProfile(
      [
        [-2.22, 0.26],
        [2.25, 0.24],
        [2.3, 0.48],
        [1.55, 0.74],
        [0.85, 0.82],
        [-1.45, 0.84],
        [-2.22, 0.74],
      ],
      2.06,
      0.08
    );
    const chassis = new THREE.Mesh(bodyGeo, bodyMat);
    chassis.castShadow = true;
    group.add(chassis);

    const canopyGeo = extrudeSideProfile(
      [
        [-1.25, 0.78],
        [0.95, 0.76],
        [0.32, 1.16],
        [-0.58, 1.16],
      ],
      1.48,
      0.08
    );
    const canopy = new THREE.Mesh(canopyGeo, glassMat);
    group.add(canopy);

    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(1.36, 0.06, 0.92),
      bodyMat
    );
    roofCap.position.set(0, 1.17, -0.14);
    group.add(roofCap);

    const frontSplitter = new THREE.Mesh(
      new THREE.BoxGeometry(1.98, 0.16, 0.14),
      darkGrilleMat
    );
    frontSplitter.position.set(0, 0.34, 2.26);
    group.add(frontSplitter);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.05, 3.8),
      trimMat
    );
    stripe.position.set(0, 0.84, 0.12);
    group.add(stripe);

    for (const sx of [-0.68, 0.68]) {
      const strut = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.36, 0.26),
        trimMat
      );
      strut.position.set(sx, 0.94, -1.96);
      group.add(strut);
    }
    const gtWing = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.08, 0.42),
      trimMat
    );
    gtWing.position.set(0, 1.14, -2.04);
    group.add(gtWing);

    for (const sx of [-1.02, 1.02]) {
      for (const sz of [-1.38, 1.38]) {
        const w = createWheelAssembly(0.4, 0.28, tireMat, alloyMat);
        w.position.set(sx, 0.4, sz);
        group.add(w);
      }
    }

    for (const sx of [-0.72, 0.72]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.1, 0.12),
        headlightMat
      );
      hl.position.set(sx, 0.52, 2.26);
      group.add(hl);
    }
    const rearBar = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 0.12, 0.1),
      taillightMat
    );
    rearBar.position.set(0, 0.62, -2.26);
    group.add(rearBar);
  } else if (type === 'speedboat') {
    const hullGeo = extrudeSideProfile(
      [
        [-2.35, 0.18],
        [1.85, 0.16],
        [2.45, 0.68],
        [1.4, 0.86],
        [-1.95, 0.84],
        [-2.35, 0.66],
      ],
      1.92,
      0.08
    );
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.castShadow = true;
    group.add(hull);

    const deckStripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.62, 0.08, 3.8),
      trimMat
    );
    deckStripe.position.set(0, 0.88, -0.1);
    group.add(deckStripe);

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(1.48, 0.42, 0.95),
      glassMat
    );
    windshield.position.set(0, 1.08, 0.45);
    windshield.rotation.x = -0.28;
    group.add(windshield);

    const radarArch = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.56, 0.18),
      alloyMat
    );
    radarArch.position.set(0, 1.24, -0.85);
    group.add(radarArch);

    for (const sx of [-0.46, 0.46]) {
      const outboard = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.62, 0.44),
        darkGrilleMat
      );
      outboard.position.set(sx, 0.48, -2.42);
      group.add(outboard);
    }

    const bowLamp = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.12, 0.14),
      headlightMat
    );
    bowLamp.position.set(0, 0.74, 2.38);
    group.add(bowLamp);
  } else {
    const chassisGeo = extrudeSideProfile(
      [
        [-2.02, 0.3],
        [2.04, 0.3],
        [2.08, 0.68],
        [1.82, 0.88],
        [1.02, 0.95],
        [-1.65, 0.96],
        [-2.04, 0.86],
      ],
      1.86,
      0.08
    );
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.castShadow = true;
    group.add(chassis);

    const cabinGeo = extrudeSideProfile(
      [
        [-1.35, 0.9],
        [0.88, 0.9],
        [0.32, 1.44],
        [-0.78, 1.44],
      ],
      1.54,
      0.08
    );
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    group.add(cabin);

    const roofCap = new THREE.Mesh(
      new THREE.BoxGeometry(1.44, 0.07, 1.12),
      bodyMat
    );
    roofCap.position.set(0, 1.45, -0.23);
    roofCap.castShadow = true;
    group.add(roofCap);

    const frontGrille = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.22, 0.08),
      darkGrilleMat
    );
    frontGrille.position.set(0, 0.58, 2.08);
    group.add(frontGrille);

    const lowerDam = new THREE.Mesh(
      new THREE.BoxGeometry(1.56, 0.12, 0.08),
      darkGrilleMat
    );
    lowerDam.position.set(0, 0.36, 2.07);
    group.add(lowerDam);

    for (const sx of [-0.94, 0.94]) {
      const mirror = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.1, 0.14),
        bodyMat
      );
      mirror.position.set(sx, 1.04, 0.56);
      group.add(mirror);
    }

    if (type === 'polisi') {
      const sirenBase = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, 0.12, 0.3),
        alloyMat
      );
      sirenBase.position.set(0, 1.54, -0.18);
      group.add(sirenBase);

      const sirenRedMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.75,
        roughness: 0.3,
      });
      const redLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.14, 0.32),
        sirenRedMat
      );
      redLight.position.set(-0.36, 1.56, -0.18);
      group.add(redLight);

      const sirenBlueMat = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x2563eb,
        emissiveIntensity: 0.75,
        roughness: 0.3,
      });
      const blueLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.46, 0.14, 0.32),
        sirenBlueMat
      );
      blueLight.position.set(0.36, 1.56, -0.18);
      group.add(blueLight);

      group.userData.sirenRedMat = sirenRedMat;
      group.userData.sirenBlueMat = sirenBlueMat;
    } else {
      const spoiler = new THREE.Mesh(
        new THREE.BoxGeometry(1.74, 0.1, 0.32),
        trimMat
      );
      spoiler.position.set(0, 1.08, -1.82);
      group.add(spoiler);
    }

    for (const sx of [-0.92, 0.92]) {
      for (const sz of [-1.24, 1.24]) {
        const w = createWheelAssembly(0.38, 0.26, tireMat, alloyMat);
        w.position.set(sx, 0.38, sz);
        group.add(w);
      }
    }

    for (const sx of [-0.66, 0.66]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.14, 0.1),
        headlightMat
      );
      hl.position.set(sx, 0.66, 2.08);
      group.add(hl);

      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.14, 0.1),
        taillightMat
      );
      tl.position.set(sx, 0.74, -2.08);
      group.add(tl);
    }
  }

  collectWheels(group);
  return group;
}

export function buildCombatDroneMesh(): THREE.Group {
  const group = new THREE.Group();

  const coreMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.25,
    metalness: 0.75,
  });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.3,
    metalness: 0.8,
  });

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 1), coreMat);
  core.scale.set(1.1, 0.55, 1.35);
  group.add(core);

  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.42), goldMat);
  crest.position.set(0, 0.18, 0);
  group.add(crest);

  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), glowMat);
  eye.position.set(0, -0.02, 0.38);
  group.add(eye);

  for (const sx of [-0.46, 0.46]) {
    for (const sz of [-0.46, 0.46]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.52), coreMat);
      arm.position.set(sx * 0.5, 0, sz * 0.5);
      arm.rotation.y = Math.atan2(sx, sz);
      group.add(arm);

      const rotorRing = new THREE.Mesh(
        new THREE.RingGeometry(0.14, 0.21, 12),
        glowMat
      );
      rotorRing.rotation.x = -Math.PI / 2;
      rotorRing.position.set(sx, 0.04, sz);
      group.add(rotorRing);
    }
  }

  return group;
}

export function applyVehicleCustomizationToMesh(
  mesh: THREE.Group,
  customs: VehicleCustomConfig
): void {
  const paintSpec =
    VEHICLE_CUSTOM_PAINTS.find((p) => p.id === customs.paintId) ||
    VEHICLE_CUSTOM_PAINTS[0];
  const glowSpec =
    VEHICLE_UNDERGLOWS.find((g) => g.id === customs.underglowId) ||
    VEHICLE_UNDERGLOWS[0];

  const bodyMat = mesh.userData.bodyMat as
    | THREE.MeshPhysicalMaterial
    | undefined;
  const trimMat = mesh.userData.trimMat as
    | THREE.MeshStandardMaterial
    | undefined;
  const underglowMat = mesh.userData.underglowMat as
    | THREE.MeshBasicMaterial
    | undefined;

  if (bodyMat) {
    bodyMat.color.setHex(paintSpec.primaryHex);
    if (paintSpec.finish === 'chrome') {
      bodyMat.metalness = 0.85;
      bodyMat.roughness = 0.14;
      bodyMat.clearcoat = 0.9;
      bodyMat.envMapIntensity = 0.55;
    } else if (paintSpec.finish === 'matte') {
      bodyMat.metalness = 0.1;
      bodyMat.roughness = 0.82;
      bodyMat.clearcoat = 0.05;
      bodyMat.envMapIntensity = 0.25;
    } else {
      bodyMat.metalness = 0.36;
      bodyMat.roughness = 0.32;
      bodyMat.clearcoat = 0.65;
      bodyMat.envMapIntensity = 0.38;
    }
  }
  if (trimMat) {
    trimMat.color.setHex(paintSpec.accentHex);
  }
  if (underglowMat) {
    if (glowSpec.colorHex !== null) {
      underglowMat.color.setHex(glowSpec.colorHex);
      underglowMat.opacity = 0.65;
    } else {
      underglowMat.opacity = 0.0;
    }
  }
}

export function buildPolicePursuitHeliWithSpotlight(): THREE.Group {
  const group = buildIndonesianVehicleMesh('heli');
  const coneGeo = new THREE.ConeGeometry(6.5, 22, 16, 1, true);
  coneGeo.translate(0, -11, 0);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coneMesh = new THREE.Mesh(coneGeo, coneMat);
  coneMesh.name = 'searchlightCone';
  coneMesh.position.set(0, 0.2, 0.8);
  group.add(coneMesh);
  return group;
}

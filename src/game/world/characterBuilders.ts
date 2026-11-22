import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EnemyBehaviorPolicy, WeaponId } from '../types';
import { createContactShadowDisc } from './cityBuilders';

export interface CharacterRigHandle {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftShin?: THREE.Group;
  rightShin?: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  headGroup: THREE.Group;
  torsoGroup: THREE.Group;
  telegraphRing: THREE.Mesh;
  bodyMesh: THREE.Mesh;
  hpBarGroup?: THREE.Group;
  hpFillMesh?: THREE.Mesh;
  weaponGroup?: THREE.Group;
}

export interface CharacterAnimationInput {
  elapsedTime: number;
  walkDist: number;
  isMoving: boolean;
  isAiming?: boolean;
  isCrouching?: boolean;
  phaseOffset?: number;
  dt: number;
}

/**
 * Smooth procedural idle breathing, natural head look-around, and articulated arm/leg stride
 * animation shared across player, crew companions, and autonomous trio wingmen.
 */
export function animateCharacterRig(
  rig: CharacterRigHandle,
  input: CharacterAnimationInput
): void {
  const {
    elapsedTime,
    walkDist,
    isMoving,
    isAiming = false,
    isCrouching = false,
    phaseOffset = 0,
    dt,
  } = input;
  const t = elapsedTime + phaseOffset;

  // 1. Subtle idle chest breathing on torsoGroup (plus crouch lowering)
  const breath = Math.sin(t * 2.35);
  const crouchDrop = isCrouching ? -0.34 : 0;
  rig.torsoGroup.position.y = THREE.MathUtils.damp(
    rig.torsoGroup.position.y,
    crouchDrop + breath * 0.014,
    12,
    dt
  );
  rig.torsoGroup.rotation.x = THREE.MathUtils.damp(
    rig.torsoGroup.rotation.x,
    isCrouching ? 0.24 : 0,
    12,
    dt
  );
  rig.torsoGroup.scale.set(1 + breath * 0.012, 1 + breath * 0.01, 1);

  // 2. Natural idle head look-around & subtle cadence nod while walking
  const targetHeadYaw = isAiming
    ? 0
    : isMoving
      ? Math.sin(walkDist * 1.1 + phaseOffset) * 0.06
      : Math.sin(t * 0.82) * 0.24 + Math.sin(t * 0.37) * 0.1;
  const targetHeadPitch = isAiming
    ? -0.04
    : isMoving
      ? Math.abs(Math.sin(walkDist * 2.2)) * 0.04
      : Math.sin(t * 1.18) * 0.05;

  rig.headGroup.rotation.y = THREE.MathUtils.damp(
    rig.headGroup.rotation.y,
    targetHeadYaw,
    6.5,
    dt
  );
  rig.headGroup.rotation.x = THREE.MathUtils.damp(
    rig.headGroup.rotation.x,
    targetHeadPitch,
    6.5,
    dt
  );

  // 3. Articulated legs (thigh + knee shin bend) + counter-swinging upper/lower arms
  const crouchKnee = isCrouching ? 0.58 : 0;
  const crouchHip = isCrouching ? -0.34 : 0;
  if (isMoving) {
    const stride = Math.sin(walkDist * 2.25);
    rig.leftLeg.rotation.x = stride * 0.54 + crouchHip;
    rig.rightLeg.rotation.x = -stride * 0.54 + crouchHip;
    if (rig.leftShin) {
      rig.leftShin.rotation.x = THREE.MathUtils.damp(
        rig.leftShin.rotation.x,
        Math.max(0, -stride) * 0.68 + crouchKnee,
        14,
        dt
      );
    }
    if (rig.rightShin) {
      rig.rightShin.rotation.x = THREE.MathUtils.damp(
        rig.rightShin.rotation.x,
        Math.max(0, stride) * 0.68 + crouchKnee,
        14,
        dt
      );
    }

    rig.leftArm.rotation.x = THREE.MathUtils.damp(
      rig.leftArm.rotation.x,
      -stride * 0.44,
      12,
      dt
    );
    rig.leftForearm.rotation.x = THREE.MathUtils.damp(
      rig.leftForearm.rotation.x,
      -0.36 - Math.max(0, stride) * 0.24,
      12,
      dt
    );

    if (!isAiming) {
      rig.rightArm.rotation.x = THREE.MathUtils.damp(
        rig.rightArm.rotation.x,
        stride * 0.34 - 0.12,
        11,
        dt
      );
      rig.rightForearm.rotation.x = THREE.MathUtils.damp(
        rig.rightForearm.rotation.x,
        -0.48 - Math.max(0, -stride) * 0.18,
        11,
        dt
      );
    }
  } else {
    rig.leftLeg.rotation.x = THREE.MathUtils.damp(
      rig.leftLeg.rotation.x,
      crouchHip,
      10,
      dt
    );
    rig.rightLeg.rotation.x = THREE.MathUtils.damp(
      rig.rightLeg.rotation.x,
      crouchHip,
      10,
      dt
    );
    if (rig.leftShin) {
      rig.leftShin.rotation.x = THREE.MathUtils.damp(
        rig.leftShin.rotation.x,
        crouchKnee,
        10,
        dt
      );
    }
    if (rig.rightShin) {
      rig.rightShin.rotation.x = THREE.MathUtils.damp(
        rig.rightShin.rotation.x,
        crouchKnee,
        10,
        dt
      );
    }
    rig.leftArm.rotation.x = THREE.MathUtils.damp(
      rig.leftArm.rotation.x,
      0.04 + breath * 0.03,
      8,
      dt
    );
    rig.leftForearm.rotation.x = THREE.MathUtils.damp(
      rig.leftForearm.rotation.x,
      -0.28 + breath * 0.03,
      8,
      dt
    );

    if (!isAiming) {
      rig.rightArm.rotation.x = THREE.MathUtils.damp(
        rig.rightArm.rotation.x,
        -0.1 + breath * 0.025,
        9,
        dt
      );
      rig.rightForearm.rotation.x = THREE.MathUtils.damp(
        rig.rightForearm.rotation.x,
        -0.42,
        9,
        dt
      );
    }
  }

  if (isAiming) {
    rig.rightArm.rotation.x = THREE.MathUtils.damp(
      rig.rightArm.rotation.x,
      -Math.PI * 0.42,
      14,
      dt
    );
    rig.rightForearm.rotation.x = THREE.MathUtils.damp(
      rig.rightForearm.rotation.x,
      -0.14,
      14,
      dt
    );
  }
}

export function buildCharacterRig(
  role: 'player' | EnemyBehaviorPolicy | 'civilian' | 'crew'
): CharacterRigHandle {
  const group = new THREE.Group();
  group.add(createContactShadowDisc(0.68));

  let jacketColor = 0xb91c1c;
  let pantsColor = 0x1e293b;
  let accentColor = 0xd97706;
  let scaleMultiplier = 1.0;

  if (role === 'rusher') {
    jacketColor = 0x991b1b;
    pantsColor = 0x18181b;
    accentColor = 0xef4444;
  } else if (role === 'ranged_kiter') {
    jacketColor = 0x3730a3;
    pantsColor = 0x0f172a;
    accentColor = 0x0284c7;
  } else if (role === 'charger_enforcer') {
    jacketColor = 0x27272a;
    pantsColor = 0x18181b;
    accentColor = 0xea580c;
    scaleMultiplier = 1.2;
  } else if (role === 'crew') {
    jacketColor = 0x166534;
    pantsColor = 0x0f172a;
    accentColor = 0xca8a04;
  } else if (role === 'civilian') {
    jacketColor = 0x0f766e;
    pantsColor = 0x334155;
    accentColor = 0x94a3b8;
  }

  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xc68b59,
    roughness: 0.82,
    metalness: 0.02,
    envMapIntensity: 0.14,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: 0.78,
    metalness: 0.06,
    envMapIntensity: 0.18,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.1,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.78,
    envMapIntensity: 0.14,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.88,
    envMapIntensity: 0.1,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.68,
    metalness: 0.12,
    envMapIntensity: 0.24,
  });
  const darkGearMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.72,
    metalness: 0.18,
    envMapIntensity: 0.22,
  });
  const visorLensMat = new THREE.MeshStandardMaterial({
    color: role === 'player' ? 0x0f172a : 0x1e293b,
    emissive: role === 'ranged_kiter' ? 0x0284c7 : 0x000000,
    emissiveIntensity: role === 'ranged_kiter' ? 0.5 : 0,
    roughness: 0.14,
    metalness: 0.86,
    envMapIntensity: 0.95,
  });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.4,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.2,
  });

  group.userData.jacketMat = jacketMat;
  group.userData.pantsMat = pantsMat;
  group.userData.capMat = accentMat;

  // Articulated two-segment legs (thigh + knee shin joint + sneakers)
  const thighGeo = new THREE.CapsuleGeometry(0.095, 0.22, 4, 8);
  thighGeo.translate(0, -0.17, 0);
  const shinGeo = new THREE.CapsuleGeometry(0.082, 0.22, 4, 8);
  shinGeo.translate(0, -0.16, 0);

  const buildShoeAndCuff = () => {
    const sub = new THREE.Group();
    const shoeUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.185, 0.115, 0.29),
      shoeMat
    );
    shoeUpper.position.set(0, -0.3, 0.05);
    const shoeSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.195, 0.04, 0.31),
      soleMat
    );
    shoeSole.position.set(0, -0.36, 0.05);
    sub.add(shoeUpper, shoeSole);
    return sub;
  };

  const leftLeg = new THREE.Mesh(thighGeo, pantsMat);
  leftLeg.position.set(-0.145, 0.74, 0);
  leftLeg.castShadow = true;
  const leftShin = new THREE.Group();
  leftShin.position.set(0, -0.33, 0);
  const leftShinMesh = new THREE.Mesh(shinGeo, pantsMat);
  leftShinMesh.castShadow = true;
  leftShin.add(leftShinMesh, buildShoeAndCuff());
  leftLeg.add(leftShin);
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(thighGeo, pantsMat);
  rightLeg.position.set(0.145, 0.74, 0);
  rightLeg.castShadow = true;
  const rightShin = new THREE.Group();
  rightShin.position.set(0, -0.33, 0);
  const rightShinMesh = new THREE.Mesh(shinGeo, pantsMat);
  rightShinMesh.castShadow = true;
  rightShin.add(rightShinMesh, buildShoeAndCuff());
  rightLeg.add(rightShin);
  group.add(rightLeg);

  // Upper body breathing container (torso + angled shoulders + collar + neck + head + arms)
  const torsoGroup = new THREE.Group();
  group.add(torsoGroup);

  const torsoGeo = new RoundedBoxGeometry(0.46, 0.62, 0.28, 3, 0.085);
  const bodyMesh = new THREE.Mesh(torsoGeo, jacketMat);
  bodyMesh.position.set(0, 1.11, 0);
  bodyMesh.castShadow = true;
  torsoGroup.add(bodyMesh);

  // Distinct sculpted angled shoulders & upper chest trapezius contour
  const collarMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.165, 0.11, 10),
    accentMat
  );
  collarMesh.position.set(0, 1.43, 0);
  torsoGroup.add(collarMesh);

  for (const sx of [-1, 1]) {
    const shoulderCap = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.105, 0.12, 4, 8),
      jacketMat
    );
    shoulderCap.position.set(sx * 0.26, 1.35, 0);
    shoulderCap.rotation.z = sx * 0.42;
    shoulderCap.castShadow = true;
    torsoGroup.add(shoulderCap);
  }

  const innerShirt = new THREE.Mesh(
    new RoundedBoxGeometry(0.15, 0.54, 0.298, 2, 0.03),
    darkGearMat
  );
  innerShirt.position.set(0, 1.12, 0);
  torsoGroup.add(innerShirt);

  const belt = new THREE.Mesh(
    new RoundedBoxGeometry(0.48, 0.085, 0.305, 2, 0.028),
    darkGearMat
  );
  belt.position.set(0, 0.79, 0);
  torsoGroup.add(belt);

  const buckle = new THREE.Mesh(
    new RoundedBoxGeometry(0.095, 0.075, 0.315, 2, 0.02),
    accentMat
  );
  buckle.position.set(0, 0.79, 0);
  torsoGroup.add(buckle);

  if (role === 'player' || role === 'crew') {
    // Sleek urban sling pack across back & chest strap
    const slingPack = new THREE.Mesh(
      new RoundedBoxGeometry(0.32, 0.4, 0.12, 3, 0.04),
      darkGearMat
    );
    slingPack.position.set(0, 1.13, -0.18);
    slingPack.castShadow = true;
    torsoGroup.add(slingPack);
  }

  const backpack = new THREE.Mesh(
    new RoundedBoxGeometry(0.32, 0.4, 0.13, 3, 0.045),
    darkGearMat
  );
  backpack.position.set(0, 1.14, -0.185);
  torsoGroup.add(backpack);

  // Articulated neck + head group for idle look-around & expressive facial features
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.088, 0.16, 10),
    skinMat
  );
  neck.position.set(0, 1.52, 0);
  torsoGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.69, 0);
  torsoGroup.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.188, 16, 14);
  headGeo.scale(0.92, 1.07, 0.96);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Subtle nose bridge & ears for recognizable human head silhouette
  const nose = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.016, 0.028, 4, 6),
    skinMat
  );
  nose.position.set(0, -0.01, 0.175);
  headGroup.add(nose);

  for (const ex of [-0.17, 0.17]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), skinMat);
    ear.scale.set(0.6, 1.15, 0.85);
    ear.position.set(ex, 0.0, 0.01);
    headGroup.add(ear);
  }

  // Facial details: eyes + brows + role-appropriate sunglasses / visor / tactical mask
  for (const ex of [-0.062, 0.062]) {
    const eyeW = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 8, 6),
      eyeWhiteMat
    );
    eyeW.scale.set(1.1, 0.72, 0.45);
    eyeW.position.set(ex, 0.03, 0.168);
    headGroup.add(eyeW);

    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 8, 6),
      pupilMat
    );
    pupil.position.set(ex, 0.03, 0.176);
    headGroup.add(pupil);

    const brow = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.007, 0.038, 4, 6),
      darkGearMat
    );
    brow.rotation.z = Math.PI / 2;
    brow.position.set(ex, 0.062, 0.17);
    headGroup.add(brow);
  }

  // Stylish Jakarta aviator shades / tactical visor for player, crew & enforcers
  if (role !== 'civilian') {
    const frameBridge = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.26, 8),
      darkGearMat
    );
    frameBridge.rotation.z = Math.PI / 2;
    frameBridge.position.set(0, 0.046, 0.168);
    headGroup.add(frameBridge);

    for (const gx of [-0.068, 0.068]) {
      const lens = new THREE.Mesh(
        new RoundedBoxGeometry(0.095, 0.052, 0.032, 2, 0.012),
        visorLensMat
      );
      lens.position.set(gx, 0.028, 0.174);
      headGroup.add(lens);
    }
  }

  // Lower-face streetwear bandana/mask for crew & rushers
  if (role === 'rusher' || role === 'charger_enforcer') {
    const mask = new THREE.Mesh(
      new RoundedBoxGeometry(0.22, 0.088, 0.12, 2, 0.035),
      darkGearMat
    );
    mask.position.set(0, -0.065, 0.125);
    headGroup.add(mask);
  }

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.194, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.65),
    darkGearMat
  );
  hairBack.position.set(0, 0.015, -0.02);
  headGroup.add(hairBack);

  // Cap + curved visor brim
  const capGeo = new THREE.SphereGeometry(
    0.2,
    14,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52
  );
  const cap = new THREE.Mesh(capGeo, accentMat);
  cap.position.set(0, 0.055, 0);
  headGroup.add(cap);

  const brim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.17, 0.024, 14, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
    accentMat
  );
  brim.position.set(0, 0.082, 0.12);
  brim.rotation.x = 0.14;
  headGroup.add(brim);

  // Articulated Left Arm (Upper Arm + Elbow Joint + Forearm + Hand)
  const upperArmGeo = new THREE.CapsuleGeometry(0.068, 0.2, 4, 8);
  upperArmGeo.translate(0, -0.12, 0);
  const forearmGeo = new THREE.CapsuleGeometry(0.058, 0.19, 4, 8);
  forearmGeo.translate(0, -0.11, 0);

  const leftArm = new THREE.Group();
  leftArm.position.set(-0.33, 1.35, 0);
  leftArm.rotation.z = 0.11;
  const lUpper = new THREE.Mesh(upperArmGeo, jacketMat);
  lUpper.castShadow = true;
  leftArm.add(lUpper);

  const leftForearm = new THREE.Group();
  leftForearm.position.set(0, -0.24, 0);
  leftForearm.rotation.x = -0.28;
  const lLower = new THREE.Mesh(forearmGeo, jacketMat);
  lLower.castShadow = true;
  leftForearm.add(lLower);

  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.064, 8, 8),
    skinMat
  );
  leftHand.position.set(0, -0.23, 0.01);
  leftForearm.add(leftHand);
  leftArm.add(leftForearm);
  torsoGroup.add(leftArm);

  // Articulated Right Arm (Upper Arm + Elbow Joint + Forearm + Hand + Sidearm)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.33, 1.35, 0);
  rightArm.rotation.z = -0.1;
  const rUpper = new THREE.Mesh(upperArmGeo, jacketMat);
  rUpper.castShadow = true;
  rightArm.add(rUpper);

  const rightForearm = new THREE.Group();
  rightForearm.position.set(0, -0.24, 0);
  rightForearm.rotation.x = -0.42;
  const rLower = new THREE.Mesh(forearmGeo, jacketMat);
  rLower.castShadow = true;
  rightForearm.add(rLower);

  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.064, 8, 8),
    skinMat
  );
  rightHand.position.set(0, -0.23, 0.015);
  rightForearm.add(rightHand);

  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.72,
    envMapIntensity: 0.45,
  });
  const cyberWeaponMat = new THREE.MeshStandardMaterial({
    color: 0x0891b2,
    emissive: 0x22d3ee,
    emissiveIntensity: 1.25,
    roughness: 0.2,
    metalness: 0.8,
  });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.9,
    envMapIntensity: 0.95,
  });

  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0, -0.23, 0.14);

  // Pistol / compact firearm mesh
  const pistolMesh = new THREE.Group();
  const pRec = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.085, 0.24), gunMat);
  const pBar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), gunMat);
  pBar.rotation.x = Math.PI / 2;
  pBar.position.set(0, 0.02, 0.16);
  const pGrip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.12, 0.07), darkGearMat);
  pGrip.position.set(0, -0.075, -0.05);
  pGrip.rotation.x = 0.24;
  pistolMesh.add(pRec, pBar, pGrip);

  // Rifle / Senapan Serbu mesh
  const rifleMesh = new THREE.Group();
  const rRec = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.1, 0.46), gunMat);
  rRec.position.set(0, 0.01, 0.08);
  const rBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8), gunMat);
  rBar.rotation.x = Math.PI / 2;
  rBar.position.set(0, 0.028, 0.38);
  const rMag = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.18, 0.075), accentMat);
  rMag.position.set(0, -0.1, 0.12);
  rMag.rotation.x = -0.18;
  rifleMesh.add(rRec, rBar, rMag);
  rifleMesh.visible = false;

  // Golok Betawi blade mesh
  const golokMesh = new THREE.Group();
  const gHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.16, 8), darkGearMat);
  gHandle.rotation.x = Math.PI / 2;
  const gBlade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.075, 0.54), bladeMat);
  gBlade.position.set(0, 0.015, 0.3);
  golokMesh.add(gHandle, gBlade);
  golokMesh.visible = false;

  // Heavy launcher (Mercon / Gatotkaca) mesh
  const launcherMesh = new THREE.Group();
  const lTube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.78, 12), darkGearMat);
  lTube.rotation.x = Math.PI / 2;
  lTube.position.set(0, 0.04, 0.12);
  const lCone = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.075, 0.14, 12), accentMat);
  lCone.rotation.x = Math.PI / 2;
  lCone.position.set(0, 0.04, 0.52);
  launcherMesh.add(lTube, lCone);
  launcherMesh.visible = false;

  // Pasopati cyber-rifle mesh
  const cyberMesh = new THREE.Group();
  const cBody = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.11, 0.56), darkGearMat);
  cBody.position.set(0, 0.01, 0.12);
  const cCore = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.62), cyberWeaponMat);
  cCore.position.set(0, 0.055, 0.24);
  cyberMesh.add(cBody, cCore);
  cyberMesh.visible = false;

  weaponGroup.add(pistolMesh, rifleMesh, golokMesh, launcherMesh, cyberMesh);
  group.userData.weaponGroup = weaponGroup;
  group.userData.gunMat = gunMat;
  group.userData.weaponVariants = {
    golok: golokMesh,
    pistol: pistolMesh,
    rifle: rifleMesh,
    launcher: launcherMesh,
    pasopati: cyberMesh,
  };

  rightForearm.add(weaponGroup);
  rightArm.add(rightForearm);
  torsoGroup.add(rightArm);

  const ringGeo = new THREE.RingGeometry(0.42, 0.5, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color:
      role === 'crew' ? 0x22c55e : role === 'player' ? 0xfacc15 : 0xef4444,
    transparent: true,
    opacity: role === 'crew' ? 0.18 : 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const telegraphRing = new THREE.Mesh(ringGeo, ringMat);
  telegraphRing.position.y = 0.035;
  group.add(telegraphRing);

  let hpBarGroup: THREE.Group | undefined;
  let hpFillMesh: THREE.Mesh | undefined;
  if (role === 'rusher' || role === 'ranged_kiter' || role === 'charger_enforcer') {
    hpBarGroup = new THREE.Group();
    hpBarGroup.position.set(0, 2.08, 0);
    hpBarGroup.visible = false;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(0.92, 0.12),
      new THREE.MeshBasicMaterial({
        color: 0x090d16,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    hpFillMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.075),
      new THREE.MeshBasicMaterial({
        color: role === 'charger_enforcer' ? 0xf59e0b : 0xef4444,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    hpFillMesh.position.z = 0.005;
    hpBarGroup.add(bg, hpFillMesh);
    group.add(hpBarGroup);
  }

  group.scale.setScalar(scaleMultiplier);

  return {
    group,
    leftLeg,
    rightLeg,
    leftShin,
    rightShin,
    leftArm,
    rightArm,
    leftForearm,
    rightForearm,
    headGroup,
    torsoGroup,
    telegraphRing,
    bodyMesh,
    hpBarGroup,
    hpFillMesh,
    weaponGroup,
  };
}

/**
 * Switches the visible 3D weapon model in a character's hand and applies optional gilded finish.
 */
export function syncCharacterWeaponVisual(
  rig: CharacterRigHandle,
  weaponId: WeaponId,
  isGilded: boolean = false
): void {
  const wg = rig.weaponGroup;
  const variants = rig.group.userData.weaponVariants as
    | Record<string, THREE.Object3D>
    | undefined;
  const gunMat = rig.group.userData.gunMat as THREE.MeshStandardMaterial | undefined;
  if (!wg || !variants) return;

  if (weaponId === 'fist') {
    wg.visible = false;
    return;
  }
  wg.visible = true;
  const activeKey =
    weaponId === 'golok'
      ? 'golok'
      : weaponId === 'rifle'
      ? 'rifle'
      : weaponId === 'mercon' || weaponId === 'gatotkaca'
      ? 'launcher'
      : weaponId === 'pasopati'
      ? 'pasopati'
      : 'pistol';

  for (const [key, obj] of Object.entries(variants)) {
    obj.visible = key === activeKey;
  }
  if (gunMat) {
    gunMat.color.setHex(isGilded ? 0xfacc15 : 0x0f172a);
    gunMat.metalness = isGilded ? 0.92 : 0.72;
    gunMat.roughness = isGilded ? 0.18 : 0.35;
  }
}

export function buildParachuteCanopyMesh(): THREE.Group {
  const group = new THREE.Group();
  const canopyMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.65,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.65,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const cordMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });

  const domeGeo = new THREE.SphereGeometry(2.15, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
  domeGeo.scale(1.25, 0.72, 0.95);
  const dome = new THREE.Mesh(domeGeo, canopyMat);
  dome.position.y = 2.65;
  dome.castShadow = true;
  group.add(dome);

  const stripeGeo = new THREE.BoxGeometry(0.62, 0.08, 3.15);
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(0, 3.85, 0);
  group.add(stripe);

  const cordOffsets: [number, number][] = [
    [-1.4, -0.95],
    [1.4, -0.95],
    [-1.4, 0.95],
    [1.4, 0.95],
  ];
  for (const [cx, cz] of cordOffsets) {
    const cordGeo = new THREE.CylinderGeometry(0.015, 0.015, 2.45, 5);
    const cord = new THREE.Mesh(cordGeo, cordMat);
    cord.position.set(cx * 0.55, 1.8, cz * 0.55);
    cord.rotation.z = -cx * 0.24;
    cord.rotation.x = cz * 0.24;
    group.add(cord);
  }

  group.visible = false;
  return group;
}

export function applyCharacterRagdollPose(
  rig: CharacterRigHandle,
  angleX: number,
  angleZ: number,
  yOffset: number
): void {
  rig.group.rotation.x = angleX;
  rig.group.rotation.z = angleZ;
  rig.torsoGroup.position.y = yOffset;
  rig.leftArm.rotation.x = -0.85;
  rig.rightArm.rotation.x = -0.55;
  rig.leftLeg.rotation.x = 0.35;
  rig.rightLeg.rotation.x = -0.4;
}

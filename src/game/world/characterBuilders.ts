import * as THREE from 'three';
import type { EnemyBehaviorPolicy } from '../types';
import { createContactShadowDisc } from './cityBuilders';

export interface CharacterRigHandle {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  headGroup: THREE.Group;
  torsoGroup: THREE.Group;
  telegraphRing: THREE.Mesh;
  bodyMesh: THREE.Mesh;
}

export interface CharacterAnimationInput {
  elapsedTime: number;
  walkDist: number;
  isMoving: boolean;
  isAiming?: boolean;
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
    phaseOffset = 0,
    dt,
  } = input;
  const t = elapsedTime + phaseOffset;

  // 1. Subtle idle chest breathing on torsoGroup
  const breath = Math.sin(t * 2.35);
  rig.torsoGroup.position.y = breath * 0.014;
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

  // 3. Articulated legs + counter-swinging upper/lower arms with natural elbow bend
  if (isMoving) {
    const stride = Math.sin(walkDist * 2.25);
    rig.leftLeg.rotation.x = stride * 0.54;
    rig.rightLeg.rotation.x = -stride * 0.54;

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
      0,
      10,
      dt
    );
    rig.rightLeg.rotation.x = THREE.MathUtils.damp(
      rig.rightLeg.rotation.x,
      0,
      10,
      dt
    );
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

  // Legs with sneakers & ankle cuffs
  const legGeo = new THREE.CapsuleGeometry(0.095, 0.48, 4, 8);
  legGeo.translate(0, -0.34, 0);

  const buildShoeAndCuff = () => {
    const sub = new THREE.Group();
    const shoeUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.185, 0.115, 0.29),
      shoeMat
    );
    shoeUpper.position.set(0, -0.62, 0.05);
    const shoeSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.195, 0.04, 0.31),
      soleMat
    );
    shoeSole.position.set(0, -0.68, 0.05);
    sub.add(shoeUpper, shoeSole);
    return sub;
  };

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.145, 0.74, 0);
  leftLeg.castShadow = true;
  leftLeg.add(buildShoeAndCuff());
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.145, 0.74, 0);
  rightLeg.castShadow = true;
  rightLeg.add(buildShoeAndCuff());
  group.add(rightLeg);

  // Upper body breathing container (torso + angled shoulders + collar + neck + head + arms)
  const torsoGroup = new THREE.Group();
  group.add(torsoGroup);

  const torsoGeo = new THREE.BoxGeometry(0.46, 0.62, 0.28);
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
    new THREE.BoxGeometry(0.15, 0.54, 0.298),
    darkGearMat
  );
  innerShirt.position.set(0, 1.12, 0);
  torsoGroup.add(innerShirt);

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.085, 0.305),
    darkGearMat
  );
  belt.position.set(0, 0.79, 0);
  torsoGroup.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.095, 0.075, 0.315),
    accentMat
  );
  buckle.position.set(0, 0.79, 0);
  torsoGroup.add(buckle);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.4, 0.13),
    darkGearMat
  );
  backpack.position.set(0, 1.14, -0.185);
  torsoGroup.add(backpack);

  // Articulated neck + head group for idle look-around & expressive facial features
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.088, 0.16, 8),
    skinMat
  );
  neck.position.set(0, 1.52, 0);
  torsoGroup.add(neck);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.69, 0);
  torsoGroup.add(headGroup);

  const headGeo = new THREE.SphereGeometry(0.188, 14, 12);
  headGeo.scale(0.92, 1.07, 0.96);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Subtle nose bridge & ears for recognizable human head silhouette
  const nose = new THREE.Mesh(
    new THREE.BoxGeometry(0.036, 0.055, 0.05),
    skinMat
  );
  nose.position.set(0, -0.01, 0.175);
  headGroup.add(nose);

  for (const ex of [-0.17, 0.17]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.038, 6, 6), skinMat);
    ear.scale.set(0.6, 1.15, 0.85);
    ear.position.set(ex, 0.0, 0.01);
    headGroup.add(ear);
  }

  // Facial details: eyes + brows + role-appropriate sunglasses / visor / tactical mask
  for (const ex of [-0.062, 0.062]) {
    const eyeW = new THREE.Mesh(
      new THREE.BoxGeometry(0.044, 0.026, 0.02),
      eyeWhiteMat
    );
    eyeW.position.set(ex, 0.03, 0.168);
    headGroup.add(eyeW);

    const pupil = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.024, 0.024),
      pupilMat
    );
    pupil.position.set(ex, 0.03, 0.173);
    headGroup.add(pupil);

    const brow = new THREE.Mesh(
      new THREE.BoxGeometry(0.054, 0.014, 0.022),
      darkGearMat
    );
    brow.position.set(ex, 0.062, 0.17);
    headGroup.add(brow);
  }

  // Stylish Jakarta aviator shades / tactical visor for player, crew & enforcers
  if (role !== 'civilian') {
    const frameBridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.27, 0.018, 0.05),
      darkGearMat
    );
    frameBridge.position.set(0, 0.046, 0.168);
    headGroup.add(frameBridge);

    for (const gx of [-0.068, 0.068]) {
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.095, 0.052, 0.032),
        visorLensMat
      );
      lens.position.set(gx, 0.028, 0.174);
      headGroup.add(lens);
    }
  }

  // Lower-face streetwear bandana/mask for crew & rushers
  if (role === 'rusher' || role === 'charger_enforcer') {
    const mask = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.088, 0.12),
      darkGearMat
    );
    mask.position.set(0, -0.065, 0.125);
    headGroup.add(mask);
  }

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.194, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65),
    darkGearMat
  );
  hairBack.position.set(0, 0.015, -0.02);
  headGroup.add(hairBack);

  // Cap + visor brim
  const capGeo = new THREE.SphereGeometry(
    0.2,
    12,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52
  );
  const cap = new THREE.Mesh(capGeo, accentMat);
  cap.position.set(0, 0.055, 0);
  headGroup.add(cap);

  const brim = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.028, 0.17),
    accentMat
  );
  brim.position.set(0, 0.082, 0.145);
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
  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0, -0.23, 0.16);
  const gunReceiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.1, 0.34),
    gunMat
  );
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8),
    gunMat
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.022, 0.22);
  const gunGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.13, 0.075),
    darkGearMat
  );
  gunGrip.position.set(0, -0.08, -0.07);
  gunGrip.rotation.x = 0.25;
  weaponGroup.add(gunReceiver, gunBarrel, gunGrip);
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

  group.scale.setScalar(scaleMultiplier);

  return {
    group,
    leftLeg,
    rightLeg,
    leftArm,
    rightArm,
    leftForearm,
    rightForearm,
    headGroup,
    torsoGroup,
    telegraphRing,
    bodyMesh,
  };
}

import * as THREE from 'three';
import type { EnemyBehaviorPolicy } from '../types';
import { createContactShadowDisc } from './cityBuilders';

export interface CharacterRigHandle {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  rightArm: THREE.Group;
  telegraphRing: THREE.Mesh;
  bodyMesh: THREE.Mesh;
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
    roughness: 0.86,
    metalness: 0.02,
    envMapIntensity: 0.06,
  });
  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketColor,
    roughness: 0.84,
    metalness: 0.04,
    envMapIntensity: 0.06,
  });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: pantsColor,
    roughness: 0.9,
    metalness: 0.02,
    envMapIntensity: 0.06,
  });
  const shoeMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.84,
    envMapIntensity: 0.06,
  });
  const soleMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.9,
    envMapIntensity: 0.06,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.78,
    metalness: 0.08,
    envMapIntensity: 0.08,
  });
  const darkGearMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.76,
    metalness: 0.14,
    envMapIntensity: 0.08,
  });

  group.userData.jacketMat = jacketMat;
  group.userData.pantsMat = pantsMat;
  group.userData.capMat = accentMat;

  const legGeo = new THREE.CapsuleGeometry(0.098, 0.48, 4, 8);
  legGeo.translate(0, -0.34, 0);

  const buildShoeAndCuff = () => {
    const sub = new THREE.Group();
    const shoeUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.19, 0.12, 0.3),
      shoeMat
    );
    shoeUpper.position.set(0, -0.62, 0.05);
    const shoeSole = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.04, 0.32),
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

  const torsoGeo = new THREE.BoxGeometry(0.5, 0.64, 0.3);
  const bodyMesh = new THREE.Mesh(torsoGeo, jacketMat);
  bodyMesh.position.set(0, 1.12, 0);
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  const shoulderBar = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.13, 0.34, 4, 8),
    jacketMat
  );
  shoulderBar.rotation.z = Math.PI / 2;
  shoulderBar.position.set(0, 1.36, 0);
  group.add(shoulderBar);

  const innerShirt = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.56, 0.315),
    darkGearMat
  );
  innerShirt.position.set(0, 1.14, 0);
  group.add(innerShirt);

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.09, 0.32),
    darkGearMat
  );
  belt.position.set(0, 0.78, 0);
  group.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.08, 0.33),
    accentMat
  );
  buckle.position.set(0, 0.78, 0);
  group.add(buckle);

  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.42, 0.14),
    darkGearMat
  );
  backpack.position.set(0, 1.15, -0.19);
  group.add(backpack);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.095, 0.15, 8),
    skinMat
  );
  neck.position.set(0, 1.52, 0);
  group.add(neck);

  const headGeo = new THREE.SphereGeometry(0.195, 14, 12);
  headGeo.scale(0.94, 1.06, 0.98);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.72, 0);
  head.castShadow = true;
  group.add(head);

  const shades = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.075, 0.12),
    darkGearMat
  );
  shades.position.set(0, 1.74, 0.14);
  group.add(shades);

  const hairBack = new THREE.Mesh(
    new THREE.SphereGeometry(0.198, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.65),
    darkGearMat
  );
  hairBack.position.set(0, 1.73, -0.02);
  group.add(hairBack);

  const capGeo = new THREE.SphereGeometry(
    0.205,
    12,
    8,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.52
  );
  const cap = new THREE.Mesh(capGeo, accentMat);
  cap.position.set(0, 1.77, 0);
  group.add(cap);

  const brim = new THREE.Mesh(
    new THREE.BoxGeometry(0.26, 0.03, 0.18),
    accentMat
  );
  brim.position.set(0, 1.8, 0.15);
  brim.rotation.x = 0.12;
  group.add(brim);

  const armGeo = new THREE.CapsuleGeometry(0.078, 0.4, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, jacketMat);
  leftArm.position.set(-0.34, 1.14, 0);
  leftArm.rotation.z = 0.09;
  const leftHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 8, 8),
    skinMat
  );
  leftHand.position.set(0, -0.26, 0);
  leftArm.add(leftHand);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.34, 1.34, 0);
  const rArmMesh = new THREE.Mesh(armGeo, jacketMat);
  rArmMesh.position.set(0, -0.2, 0.11);
  rArmMesh.rotation.x = -Math.PI / 4;
  rightArm.add(rArmMesh);

  const rightHand = new THREE.Mesh(
    new THREE.SphereGeometry(0.072, 8, 8),
    skinMat
  );
  rightHand.position.set(0, -0.34, 0.25);
  rightArm.add(rightHand);

  const gunMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.35,
    metalness: 0.72,
    envMapIntensity: 0.35,
  });
  const weaponGroup = new THREE.Group();
  weaponGroup.position.set(0, -0.32, 0.38);
  const gunReceiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.11, 0.38),
    gunMat
  );
  const gunBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.24, 8),
    gunMat
  );
  gunBarrel.rotation.x = Math.PI / 2;
  gunBarrel.position.set(0, 0.025, 0.24);
  const gunGrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 0.14, 0.08),
    darkGearMat
  );
  gunGrip.position.set(0, -0.09, -0.08);
  gunGrip.rotation.x = 0.25;
  weaponGroup.add(gunReceiver, gunBarrel, gunGrip);
  rightArm.add(weaponGroup);
  group.add(rightArm);

  const ringGeo = new THREE.RingGeometry(0.42, 0.5, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color:
      role === 'crew' ? 0x22c55e : role === 'player' ? 0xfacc15 : 0xef4444,
    transparent: true,
    opacity: role === 'crew' ? 0.22 : 0.0,
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
    rightArm,
    telegraphRing,
    bodyMesh,
  };
}

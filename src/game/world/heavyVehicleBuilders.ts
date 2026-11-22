import * as THREE from 'three';
import type { VehicleType } from '../types';

export function createWheelAssembly(
  radius: number,
  width: number,
  tireMat: THREE.Material,
  rimMat: THREE.Material
): THREE.Group {
  const wGroup = new THREE.Group();
  wGroup.userData.isWheel = true;
  wGroup.userData.wheelRadius = radius;

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wGroup.add(tire);

  const rimGeo = new THREE.CylinderGeometry(
    radius * 0.64,
    radius * 0.64,
    width + 0.02,
    14
  );
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wGroup.add(rim);

  // Inner dark wheel barrel + brake disc rotor for realistic 3D depth
  const barrelGeo = new THREE.CylinderGeometry(
    radius * 0.54,
    radius * 0.54,
    width + 0.025,
    12
  );
  barrelGeo.rotateZ(Math.PI / 2);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.45,
    metalness: 0.72,
  });
  wGroup.add(new THREE.Mesh(barrelGeo, barrelMat));

  // 5-Spoke Sport Star Alloy Spokes
  const spokeGeo = new THREE.BoxGeometry(width + 0.036, radius * 1.12, radius * 0.14);
  for (let s = 0; s < 3; s++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (s * Math.PI) / 3;
    wGroup.add(spoke);
  }

  const hubGeo = new THREE.CylinderGeometry(
    radius * 0.2,
    radius * 0.2,
    width + 0.045,
    10
  );
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, tireMat);
  wGroup.add(hub);

  return wGroup;
}

export function extrudeSideProfile(
  pts: [number, number][],
  width: number,
  bevelSize: number = 0.07
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  shape.closePath();

  const innerDepth = Math.max(0.05, width - bevelSize * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: innerDepth,
    bevelEnabled: true,
    bevelThickness: bevelSize,
    bevelSize,
    bevelSegments: 2,
    curveSegments: 6,
  });
  geo.translate(0, 0, -innerDepth * 0.5);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export interface VehicleMaterialSet {
  bodyMat: THREE.MeshPhysicalMaterial;
  trimMat: THREE.MeshStandardMaterial;
  glassMat: THREE.MeshPhysicalMaterial;
  tireMat: THREE.MeshStandardMaterial;
  alloyMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
}

export function populateHeavyOrAirVehicle(
  type: Extract<
    VehicleType,
    'heli' | 'metromini' | 'transjakarta' | 'barracuda' | 'vtol_jet'
  >,
  group: THREE.Group,
  mats: VehicleMaterialSet
): void {
  const { bodyMat, trimMat, glassMat, tireMat, alloyMat, headlightMat, taillightMat } =
    mats;

  if (type === 'heli') {
    for (const sx of [-0.95, 0.95]) {
      const skid = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8),
        alloyMat
      );
      skid.rotation.x = Math.PI / 2;
      skid.position.set(sx, 0.12, 0.1);
      group.add(skid);

      for (const sz of [-0.6, 0.7]) {
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.045, 0.72, 8),
          alloyMat
        );
        strut.position.set(sx * 0.88, 0.44, sz);
        strut.rotation.z = sx < 0 ? -0.25 : 0.25;
        group.add(strut);
      }
    }

    const cabinGeo = extrudeSideProfile(
      [
        [-1.35, 0.65],
        [1.15, 0.62],
        [2.05, 0.92],
        [1.75, 1.48],
        [0.85, 1.85],
        [-0.95, 1.85],
        [-1.45, 1.45],
      ],
      1.78,
      0.16
    );
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.castShadow = true;
    group.add(cabin);

    const canopyGlass = new THREE.Mesh(
      new THREE.SphereGeometry(0.86, 14, 10),
      glassMat
    );
    canopyGlass.scale.set(0.95, 0.68, 1.32);
    canopyGlass.position.set(0, 1.24, 1.15);
    group.add(canopyGlass);

    const boom = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.34, 3.4, 10),
      trimMat
    );
    boom.rotation.x = Math.PI / 2;
    boom.position.set(0, 1.42, -2.8);
    group.add(boom);

    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.15, 0.8), bodyMat);
    fin.position.set(0, 1.82, -4.2);
    fin.rotation.x = -0.25;
    group.add(fin);

    const rotorGroup = new THREE.Group();
    rotorGroup.name = 'heliRotor';
    rotorGroup.position.set(0, 2.08, 0.1);
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.22, 0.26, 10),
      alloyMat
    );
    rotorGroup.add(hub);
    const blade1 = new THREE.Mesh(
      new THREE.BoxGeometry(7.0, 0.05, 0.28),
      alloyMat
    );
    const blade2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.05, 7.0),
      alloyMat
    );
    rotorGroup.add(blade1, blade2);
    group.add(rotorGroup);
  } else if (type === 'metromini' || type === 'transjakarta') {
    const hullGeo = extrudeSideProfile(
      [
        [-2.78, 0.42],
        [2.75, 0.42],
        [2.82, 1.35],
        [2.56, 2.38],
        [-2.72, 2.42],
      ],
      2.32,
      0.1
    );
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.castShadow = true;
    group.add(hull);

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.42, 5.45),
      trimMat
    );
    stripe.position.set(0, 1.12, 0);
    group.add(stripe);

    const win = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 0.68, 4.9),
      glassMat
    );
    win.position.set(0, 1.78, 0.08);
    group.add(win);

    if (type === 'transjakarta') {
      const acPod = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.28, 3.2),
        alloyMat
      );
      acPod.position.set(0, 2.58, -0.15);
      group.add(acPod);
    }

    for (const sx of [-1.14, 1.14]) {
      for (const sz of [-1.75, 1.75]) {
        const w = createWheelAssembly(0.46, 0.3, tireMat, alloyMat);
        w.position.set(sx, 0.46, sz);
        group.add(w);
      }
    }

    for (const sx of [-0.78, 0.78]) {
      const hl = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.18, 0.1),
        headlightMat
      );
      hl.position.set(sx, 0.78, 2.84);
      group.add(hl);

      const tl = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.22, 0.1),
        taillightMat
      );
      tl.position.set(sx, 0.84, -2.84);
      group.add(tl);
    }
  } else if (type === 'barracuda') {
    const hullGeo = extrudeSideProfile(
      [
        [-2.25, 0.48],
        [2.28, 0.48],
        [2.4, 0.92],
        [1.92, 1.38],
        [1.38, 1.88],
        [-1.78, 1.92],
        [-2.25, 1.32],
      ],
      2.18,
      0.08
    );
    const hull = new THREE.Mesh(hullGeo, bodyMat);
    hull.castShadow = true;
    group.add(hull);

    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.3, 0.16),
      glassMat
    );
    visor.position.set(0, 1.62, 1.62);
    visor.rotation.x = -0.35;
    group.add(visor);

    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.68, 0.45, 8),
      trimMat
    );
    turret.position.set(0, 2.15, -0.2);
    group.add(turret);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 1.25, 8),
      alloyMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 2.18, 0.65);
    group.add(barrel);

    const bullbar = new THREE.Mesh(
      new THREE.BoxGeometry(2.28, 0.48, 0.24),
      trimMat
    );
    bullbar.position.set(0, 0.72, 2.42);
    group.add(bullbar);

    for (const sx of [-1.12, 1.12]) {
      for (const sz of [-1.5, 0, 1.5]) {
        const w = createWheelAssembly(0.48, 0.34, tireMat, alloyMat);
        w.position.set(sx, 0.48, sz);
        group.add(w);
      }
    }

    const sirenRedMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });
    const sirenBlueMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x2563eb,
      emissiveIntensity: 0.65,
      roughness: 0.35,
    });
    const redBeacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.14, 0.28),
      sirenRedMat
    );
    redBeacon.position.set(-0.55, 1.98, 1.15);
    group.add(redBeacon);

    const blueBeacon = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.14, 0.28),
      sirenBlueMat
    );
    blueBeacon.position.set(0.55, 1.98, 1.15);
    group.add(blueBeacon);

    group.userData.sirenRedMat = sirenRedMat;
    group.userData.sirenBlueMat = sirenBlueMat;
  } else {
    const fuseGeo = extrudeSideProfile(
      [
        [-2.7, 0.74],
        [2.2, 0.72],
        [3.75, 0.88],
        [2.25, 1.18],
        [-2.65, 1.24],
      ],
      1.36,
      0.12
    );
    const fuselage = new THREE.Mesh(fuseGeo, bodyMat);
    fuselage.castShadow = true;
    group.add(fuselage);

    const canopy = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.42, 1.35, 6, 12),
      glassMat
    );
    canopy.rotation.x = Math.PI / 2;
    canopy.scale.set(1.0, 1.0, 0.72);
    canopy.position.set(0, 1.24, 1.15);
    group.add(canopy);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 1.15);
    wingShape.lineTo(2.9, -1.25);
    wingShape.lineTo(2.9, -1.65);
    wingShape.lineTo(0.4, -1.35);
    wingShape.lineTo(-0.4, -1.35);
    wingShape.lineTo(-2.9, -1.65);
    wingShape.lineTo(-2.9, -1.25);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: 0.1,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    wingGeo.rotateX(Math.PI / 2);
    const mainWing = new THREE.Mesh(wingGeo, bodyMat);
    mainWing.position.set(0, 0.98, 0.15);
    mainWing.castShadow = true;
    group.add(mainWing);

    for (const sx of [-0.72, 0.72]) {
      const tailFin = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1.05, 1.3),
        trimMat
      );
      tailFin.position.set(sx, 1.56, -2.0);
      tailFin.rotation.z = sx < 0 ? 0.28 : -0.28;
      tailFin.rotation.x = -0.25;
      group.add(tailFin);
    }

    const afterburnerMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (const sx of [-0.4, 0.4]) {
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.3, 0.45, 12),
        afterburnerMat
      );
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(sx, 0.94, -2.8);
      group.add(nozzle);
    }

    const vtolRotorGroup = new THREE.Group();
    vtolRotorGroup.position.set(0, 1.06, -0.35);
    const vtolRing = new THREE.Mesh(
      new THREE.RingGeometry(0.65, 0.92, 16),
      afterburnerMat
    );
    vtolRing.rotation.x = -Math.PI / 2;
    vtolRotorGroup.add(vtolRing);
    group.add(vtolRotorGroup);
    group.userData.mainRotor = vtolRotorGroup;
  }
}

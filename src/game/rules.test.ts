import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialPlayerState,
  clampDt,
  resolveDistrictAtPosition,
  applyStoryChoice,
  completeMissionReward,
  applyDamageToPlayer,
  getDominantFactionTitle,
  resolveCircleAABBCollision,
  stepEnemyMovementPolicy,
  purchaseProperty,
  calculatePassivePropertyIncome,
  recruitCrewMember,
  upgradeVehicleGarage,
  upgradeDroneTech,
  stepFokusAbility,
  STORY_MISSIONS,
  CITY_BUILDINGS,
  TRAFFIC_ROUTES,
  TrafficAISteppable,
  generateInitialTrafficSpawns,
  generateRoadsideSpawnLayout,
  getRoadsideGroundY,
  isOnMainRoadwayFootprint,
  stepTrafficVehicleAI,
  resolveJakartaAmbientProfile,
  WEATHER_ENVIRONMENT_TARGETS,
  createInitialWeatherTransitionState,
  stepWeatherTransition,
} from './rules';

test('createInitialPlayerState configures origin bonuses properly including Fase 5 Drone Rajawali-X & Gatotkaca', () => {
  const jalanan = createInitialPlayerState('anak_jalanan');
  assert.equal(jalanan.reputation.jalanan, 40);
  assert.equal(jalanan.armor, 80);
  assert.equal(jalanan.crewCount, 1);
  assert.equal(jalanan.fokusEnergy, 100);
  assert.equal(jalanan.outfitId, 'jaket_jawara');
  assert.equal(jalanan.vehicleUpgradeLevel, 0);
  assert.equal(jalanan.droneLevel, 1);
  assert.equal(jalanan.droneActive, true);
  assert.equal(jalanan.unlockedWeapons.includes('gatotkaca'), true);

  const teknisi = createInitialPlayerState('teknisi_glodok');
  assert.equal(teknisi.unlockedWeapons.includes('rifle'), true);
  assert.equal(teknisi.unlockedWeapons.includes('mercon'), true);
  assert.equal(teknisi.unlockedWeapons.includes('pasopati'), true);
  assert.equal(teknisi.unlockedWeapons.includes('gatotkaca'), true);
  assert.equal(teknisi.droneLevel, 2);
  assert.equal(teknisi.reputation.sindikat, 40);
});

test('clampDt clamps negative and large frame deltas safely', () => {
  assert.equal(clampDt(-0.2), 0);
  assert.equal(clampDt(0.016), 0.016);
  assert.equal(clampDt(0.5), 0.05);
});

test('resolveDistrictAtPosition identifies all 13 Jakarta districts including PIK 2 and TMII accurately', () => {
  const monas = resolveDistrictAtPosition(2, -3);
  assert.equal(monas.id, 'monas');

  const sudirman = resolveDistrictAtPosition(0, -55);
  assert.equal(sudirman.id, 'sudirman');

  const priok = resolveDistrictAtPosition(60, -56);
  assert.equal(priok.id, 'tanjung_priok');

  const scbd = resolveDistrictAtPosition(-60, -55);
  assert.equal(scbd.id, 'scbd');

  const ancol = resolveDistrictAtPosition(-60, 56);
  assert.equal(ancol.id, 'ancol_pik');

  const halim = resolveDistrictAtPosition(60, 56);
  assert.equal(halim.id, 'halim_station');

  const gbk = resolveDistrictAtPosition(-63, 35);
  assert.equal(gbk.id, 'senayan_gbk');

  const kemayoran = resolveDistrictAtPosition(63, -35);
  assert.equal(kemayoran.id, 'kemayoran');

  const pik2 = resolveDistrictAtPosition(-75, -18);
  assert.equal(pik2.id, 'pik2_mangrove');

  const tmii = resolveDistrictAtPosition(48, 73);
  assert.equal(tmii.id, 'tmii_ragunan');
});

test('applyStoryChoice and completeMissionReward update reputation, rupiah, and completed missions across 15 chapters', () => {
  assert.equal(STORY_MISSIONS.length, 15);
  const initial = createInitialPlayerState('mantan_kurir');
  const mission13 = STORY_MISSIONS[12]; // Babak 13 Operasi Pulau Reklamasi PIK 2 (Fase 5)
  const choice = mission13.choices[0];

  const afterChoice = applyStoryChoice(initial, choice);
  assert.equal(afterChoice.reputation.jalanan > initial.reputation.jalanan, true);
  assert.equal(afterChoice.wantedLevel, 2);

  const afterComplete = completeMissionReward(afterChoice, mission13.id, choice);
  assert.equal(afterComplete.rupiah, initial.rupiah + choice.rewardRp);
  assert.equal(afterComplete.completedMissions.includes(mission13.id), true);
  assert.equal(afterComplete.wantedLevel, 0);
});

test('purchaseProperty, calculatePassivePropertyIncome, recruitCrewMember, upgradeVehicleGarage, upgradeDroneTech, and stepFokusAbility work for Jakarta empire', () => {
  const initial = createInitialPlayerState('mantan_kurir'); // Rp 550.000
  const buy1 = purchaseProperty(initial, 'prop_warung_blokm'); // Rp 150.000
  assert.equal(buy1.purchased, true);
  assert.equal(buy1.nextState.ownedProperties.includes('prop_warung_blokm'), true);
  assert.equal(calculatePassivePropertyIncome(buy1.nextState.ownedProperties), 12000);

  // Recruit a Jawara crew member (costs Rp 200.000)
  const crewRes = recruitCrewMember(buy1.nextState);
  assert.equal(crewRes.recruited, true);
  assert.equal(crewRes.nextState.crewCount, 1);

  // Upgrade vehicle garage & Drone Rajawali-X with extra funds
  const richState = { ...crewRes.nextState, rupiah: 900000, fokusActive: true };
  const upgRes = upgradeVehicleGarage(richState);
  assert.equal(upgRes.upgraded, true);
  assert.equal(upgRes.nextState.vehicleUpgradeLevel, 1);

  const droneRes = upgradeDroneTech(upgRes.nextState);
  assert.equal(droneRes.upgraded, true);
  assert.equal(droneRes.nextState.droneLevel, 2);

  // Step Fokus Badai energy drain and recharge
  const drained = stepFokusAbility(droneRes.nextState, 1.0);
  assert.equal(drained.fokusEnergy < 100, true);
  const recharged = stepFokusAbility({ ...drained, fokusActive: false }, 0.5);
  assert.equal(recharged.fokusEnergy > drained.fokusEnergy, true);

  // Duplicate property purchase rejected
  const buyDup = purchaseProperty(buy1.nextState, 'prop_warung_blokm');
  assert.equal(buyDup.purchased, false);
});

test('applyDamageToPlayer absorbs damage with armor first and triggers defeat at 0 HP', () => {
  const initial = createInitialPlayerState('anak_jalanan');
  const hit1 = applyDamageToPlayer(initial, 40);
  assert.equal(hit1.isDefeated, false);
  assert.equal(hit1.nextState.armor < 80, true);
  assert.equal(hit1.nextState.hp < 100, true);

  const fatal = applyDamageToPlayer({ ...initial, armor: 0, hp: 20 }, 30);
  assert.equal(fatal.isDefeated, true);
  assert.equal(fatal.nextState.hp, 0);
});

test('resolveCircleAABBCollision pushes entities outside building footprints', () => {
  const inside = resolveCircleAABBCollision(5.2, 0, 1.0);
  assert.equal(inside.collided, true);
  assert.equal(inside.x >= 6.49, true);
});

test('stepEnemyMovementPolicy produces distinct movement vectors for 3 enemy policies', () => {
  const rusherMove = stepEnemyMovementPolicy('rusher', 0, 0, 0, 6, 6, 0.1, 0);
  const kiterMove = stepEnemyMovementPolicy('ranged_kiter', 0, 0, 0, 6, 6, 0.1, 0);
  const chargerMove = stepEnemyMovementPolicy('charger_enforcer', 0, 0, 0, 6, 6, 0.1, 2.5);

  assert.equal(rusherMove.nextZ > 0, true);
  assert.equal(kiterMove.nextZ < 0, true);
  assert.equal(chargerMove.nextZ > rusherMove.nextZ, true);
});

test('getDominantFactionTitle returns correct faction ending', () => {
  const res = getDominantFactionTitle({ jalanan: 20, sindikat: 80, rakyat: 30 });
  assert.equal(res.faction, 'sindikat');
});

test('generateRoadsideSpawnLayout spawns traffic signs, toll signs, and TransJakarta haltes clear of roads and buildings', () => {
  const layout = generateRoadsideSpawnLayout();

  assert.equal(layout.trafficSigns.length >= 16, true);
  assert.equal(layout.tollSigns.length >= 6, true);
  assert.equal(layout.transJakartaHaltes.length >= 5, true);

  // Verify coverage across main corridors
  assert.equal(
    layout.trafficSigns.some((s) => s.corridor === 'sudirman_ns'),
    true
  );
  assert.equal(
    layout.trafficSigns.some((s) => s.corridor === 'merdeka_ew'),
    true
  );
  assert.equal(
    layout.trafficSigns.some((s) => s.corridor === 'tol_layang'),
    true
  );

  // Verify every spawned item sits flush on sidewalk/ground, clear of roadways, Monas plaza, and buildings
  const allItems = [
    ...layout.trafficSigns.map((i) => ({ id: i.id, x: i.x, y: i.y, z: i.z })),
    ...layout.tollSigns.map((i) => ({ id: i.id, x: i.x, y: i.y, z: i.z })),
    ...layout.transJakartaHaltes.map((i) => ({ id: i.id, x: i.x, y: i.y, z: i.z })),
  ];

  for (const item of allItems) {
    assert.equal(isOnMainRoadwayFootprint(item.x, item.z, 0.05), false, `${item.id} must not block roadway`);
    assert.equal(item.x * item.x + item.z * item.z >= 19.5 * 19.5, true, `${item.id} must stay outside Monas plaza`);
    assert.equal(item.y, getRoadsideGroundY(item.x, item.z), `${item.id} Y must sit flush on sidewalk or ground`);

    for (const b of CITY_BUILDINGS) {
      const insideBuilding =
        Math.abs(item.x - b.x) < b.width * 0.5 + 0.5 &&
        Math.abs(item.z - b.z) < b.depth * 0.5 + 0.5;
      assert.equal(insideBuilding, false, `${item.id} must not clip building ${b.id}`);
    }
  }
});

test('generateInitialTrafficSpawns creates bustling Jakarta lane traffic clear of Monas and buildings', () => {
  const spawns = generateInitialTrafficSpawns();
  assert.equal(spawns.length >= 15, true);
  assert.equal(
    spawns.some((s) => s.type === 'transjakarta' && s.routeId.startsWith('busway_corridor')),
    true
  );
  assert.equal(
    spawns.some((s) => s.layer === 'elevated' && s.routeId === 'tol_layang_express'),
    true
  );

  // Verify every route segment stays outside Monas plaza and CITY_BUILDINGS
  for (const [routeId, wps] of Object.entries(TRAFFIC_ROUTES)) {
    for (let i = 0; i < wps.length; i++) {
      const a = wps[i];
      const b = wps[(i + 1) % wps.length];
      for (let step = 0; step <= 8; step++) {
        const t = step / 8;
        const px = a.x + (b.x - a.x) * t;
        const pz = a.z + (b.z - a.z) * t;
        if (routeId !== 'tol_layang_express') {
          assert.equal(
            px * px + pz * pz >= 19.5 * 19.5,
            true,
            `Route ${routeId} must stay clear of Monas plaza`
          );
          for (const bldg of CITY_BUILDINGS) {
            const inside =
              Math.abs(px - bldg.x) < bldg.width * 0.5 + 0.6 &&
              Math.abs(pz - bldg.z) < bldg.depth * 0.5 + 0.6;
            assert.equal(inside, false, `Route ${routeId} must not intersect ${bldg.id}`);
          }
        }
      }
    }
  }
});

test('stepTrafficVehicleAI follows waypoints, stops at Halte bus stops, and brakes for vehicles ahead', () => {
  const busRoute = TRAFFIC_ROUTES.busway_corridor_north;
  // Approach Halte stop waypoint index 1 at (-1.85, -67)
  let bus: TrafficAISteppable = {
    x: -1.85,
    z: -64.5,
    heading: Math.PI,
    speed: 8.5,
    waypointIndex: 1,
    stopTimer: 0,
    preferredSpeed: 9.2,
    layer: 'ground',
  };

  for (let i = 0; i < 6; i++) {
    bus = stepTrafficVehicleAI(bus, busRoute, 999, 0.1);
  }
  assert.equal(bus.waypointIndex, 2, 'Bus should advance past Halte waypoint');
  assert.equal(bus.stopTimer > 0, true, 'Bus should dwell at Halte pauseSec waypoint');

  // Verify car-following braking when obstacle is directly ahead (< 5.4m)
  const blocked = stepTrafficVehicleAI(
    {
      x: -34.4,
      z: 10,
      heading: Math.PI,
      speed: 10,
      waypointIndex: 1,
      stopTimer: 0,
      preferredSpeed: 11,
      layer: 'ground',
    },
    TRAFFIC_ROUTES.ring_clockwise,
    3.5,
    0.2
  );
  assert.equal(blocked.speed < 10, true, 'Vehicle must decelerate when another vehicle blocks lane ahead');
});

test('resolveJakartaAmbientProfile cycles through authentic Jakarta soundscapes by district and time of day', () => {
  // Dusk ('senja') at Monas starts with prayer call echo, then distant traffic, then street food vendors
  const monasStep0 = resolveJakartaAmbientProfile('monas', 'senja', 0);
  const monasStep1 = resolveJakartaAmbientProfile('monas', 'senja', 1);
  const monasStep2 = resolveJakartaAmbientProfile('monas', 'senja', 2);
  assert.equal(monasStep0.activeCue, 'prayer_call_echo');
  assert.equal(monasStep1.activeCue, 'distant_traffic');
  assert.equal(monasStep2.activeCue, 'street_vendor_tektek');

  // Night ('malam') at Blok M culinary market features street food vendors
  const blokMNight = resolveJakartaAmbientProfile('blok_m', 'malam', 0);
  assert.equal(blokMNight.primaryBed, 'market_hum');
  assert.equal(blokMNight.activeCue, 'street_vendor_tektek');

  // Coastal Tanjung Priok features harbor foghorn & coastal wind bed
  const priokDay = resolveJakartaAmbientProfile('tanjung_priok', 'siang', 0);
  assert.equal(priokDay.primaryBed, 'coastal_wind');
  assert.equal(priokDay.activeCue, 'harbor_foghorn_gulls');

  // Monsoon rain ('hujan') activates monsoon downpour bed and thunder cue
  const rainSudirman = resolveJakartaAmbientProfile('sudirman', 'hujan', 0);
  assert.equal(rainSudirman.primaryBed, 'monsoon_downpour');
  assert.equal(rainSudirman.activeCue, 'monsoon_rain_thunder');
});

test('stepWeatherTransition smoothly interpolates skybox, lighting, fog, and wetness instead of snapping', () => {
  const start = createInitialWeatherTransitionState('senja');
  const targetMalam = WEATHER_ENVIRONMENT_TARGETS.malam;

  // After a single 0.2s frame, lighting & skybox should be strictly between senja and malam
  const mid = stepWeatherTransition(start, 'malam', 0.2, 1.65);
  assert.equal(mid.targetMode, 'malam');
  assert.equal(mid.sunIntensity < start.sunIntensity, true);
  assert.equal(mid.sunIntensity > targetMalam.sunIntensity, true);
  assert.equal(mid.nightFactor > start.nightFactor, true);
  assert.equal(mid.nightFactor < targetMalam.nightFactor, true);
  assert.equal(mid.skyHorizonRgb.r < start.skyHorizonRgb.r, true);

  // Transitioning toward 'hujan' gradually increases wetnessFactor and fogDensity
  let wetState = mid;
  for (let i = 0; i < 6; i++) {
    wetState = stepWeatherTransition(wetState, 'hujan', 0.2, 1.65);
  }
  assert.equal(wetState.wetnessFactor > 0.75, true);
  assert.equal(wetState.wetnessFactor < 1.0, true);
  assert.equal(wetState.fogDensity > start.fogDensity, true);
  assert.equal(wetState.fogDensity < WEATHER_ENVIRONMENT_TARGETS.hujan.fogDensity, true);

  // After sufficient elapsed time, state converges tightly onto target values
  let converged = wetState;
  for (let i = 0; i < 40; i++) {
    converged = stepWeatherTransition(converged, 'siang', 0.25, 1.65);
  }
  assert.equal(Math.abs(converged.sunIntensity - WEATHER_ENVIRONMENT_TARGETS.siang.sunIntensity) < 0.005, true);
  assert.equal(Math.abs(converged.wetnessFactor) < 0.005, true);
  assert.equal(Math.abs(converged.nightFactor) < 0.005, true);
});






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
  buyStockShares,
  sellStockShares,
  stepStockMarketTick,
  triggerStockMarketImpact,
  calculateHeistBreakdown,
  VEHICLE_SPECS,
  STREET_RACES,
  STORY_MISSIONS,
  CITY_BUILDINGS,
  getGroundElevationAt,
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
  ENTERABLE_INTERIORS,
  WARUNG_SNACKS,
  evaluateWarungMiniGame,
  consumeWarungSnack,
  stepWarungStaminaBuff,
  getPlayerStaminaSpeedMultiplier,
  createInitialTrafficSignalState,
  isStoppedAtTrafficSignal,
  stepTrafficSignals,
  upgradeCharacterSkill,
  buyWeaponAttachment,
  getEffectiveWeaponSpec,
  captureDistrictTurf,
  fortifyDistrictTurf,
  calculateTurfWarsIncome,
  bribePoliceWanted,
  formatJakartaClock,
  resolveWeatherFromWorldClock,
  RADIO_STATIONS,
  WORLD_ROAD_EVENT_CATALOG,
  createInitialWorldClockEventState,
  isJakartaRushHour,
  triggerManualWorldRoadEvent,
  stepWorldClockEventTicker,
  evaluateRoadEventImpactAt,
  checkPlayerDetourProgress,
} from './rules';
import {
  SAVE_VERSION,
  migrateSavedGame,
  parseImportedSaveJson,
} from './save';
import {
  buildFallbackNpcDialogue,
  sanitizeDialogueInput,
} from '../../server/npcDialogue';

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

  const sudirman = resolveDistrictAtPosition(0, 55);
  assert.equal(sudirman.id, 'sudirman');

  const priok = resolveDistrictAtPosition(58, -52);
  assert.equal(priok.id, 'tanjung_priok');

  const scbd = resolveDistrictAtPosition(58, 56);
  assert.equal(scbd.id, 'scbd');

  const ancol = resolveDistrictAtPosition(-58, -52);
  assert.equal(ancol.id, 'ancol_pik');

  const halim = resolveDistrictAtPosition(58, 104);
  assert.equal(halim.id, 'halim_station');

  const gbk = resolveDistrictAtPosition(-58, 56);
  assert.equal(gbk.id, 'senayan_gbk');

  const kemayoran = resolveDistrictAtPosition(58, -18);
  assert.equal(kemayoran.id, 'kemayoran');

  const pik2 = resolveDistrictAtPosition(-106, -50);
  assert.equal(pik2.id, 'pik2_mangrove');

  const tmii = resolveDistrictAtPosition(58, 166);
  assert.equal(tmii.id, 'tmii_ragunan');
});

test('applyStoryChoice and completeMissionReward update reputation, rupiah, and completed missions across 15 chapters', () => {
  assert.equal(STORY_MISSIONS.length, 15);
  const initial = createInitialPlayerState('mantan_kurir');
  const mission13 = STORY_MISSIONS[12];
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
  const initial = createInitialPlayerState('mantan_kurir');
  const buy1 = purchaseProperty(initial, 'prop_warung_blokm');
  assert.equal(buy1.purchased, true);
  assert.equal(buy1.nextState.ownedProperties.includes('prop_warung_blokm'), true);
  assert.equal(calculatePassivePropertyIncome(buy1.nextState.ownedProperties), 12000);

  const crewRes = recruitCrewMember(buy1.nextState);
  assert.equal(crewRes.recruited, true);
  assert.equal(crewRes.nextState.crewCount, 1);

  const richState = { ...crewRes.nextState, rupiah: 900000, fokusActive: true };
  const upgRes = upgradeVehicleGarage(richState);
  assert.equal(upgRes.upgraded, true);
  assert.equal(upgRes.nextState.vehicleUpgradeLevel, 1);

  const droneRes = upgradeDroneTech(upgRes.nextState);
  assert.equal(droneRes.upgraded, true);
  assert.equal(droneRes.nextState.droneLevel, 2);

  const drained = stepFokusAbility(droneRes.nextState, 1.0);
  assert.equal(drained.fokusEnergy < 100, true);
  const recharged = stepFokusAbility({ ...drained, fokusActive: false }, 0.5);
  assert.equal(recharged.fokusEnergy > drained.fokusEnergy, true);

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

test('stepTrafficVehicleAI handles Halte bus stops, Angkot ngetem nudging, and Ojol lane-splitting/horn reaction', () => {
  const busRoute = TRAFFIC_ROUTES.busway_corridor_north;
  let bus: TrafficAISteppable = {
    x: -1.85,
    z: -49.5,
    heading: Math.PI,
    speed: 8.5,
    waypointIndex: 1,
    stopTimer: 0,
    preferredSpeed: 9.2,
    layer: 'ground',
    vehicleType: 'transjakarta',
  };

  for (let i = 0; i < 6; i++) {
    bus = stepTrafficVehicleAI(bus, busRoute, 999, 0.1);
  }
  assert.equal(bus.waypointIndex, 2);
  assert.equal(bus.stopTimer > 0, true);

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
  assert.equal(blocked.speed < 10, true);

  // Angkot ngetem resumes rolling immediately when honked
  const angkotNgetem: TrafficAISteppable = {
    x: 34,
    z: 12,
    heading: 0,
    speed: 0,
    waypointIndex: 1,
    stopTimer: 2.0,
    ngetemTimer: 2.0,
    preferredSpeed: 9.0,
    layer: 'ground',
    vehicleType: 'angkot',
  };
  const nudgedAngkot = stepTrafficVehicleAI(
    angkotNgetem,
    TRAFFIC_ROUTES.ring_clockwise,
    50,
    0.2,
    { hornTriggered: true }
  );
  assert.equal(nudgedAngkot.ngetemTimer, 0);
  assert.equal(nudgedAngkot.stopTimer, 0);
  assert.equal(nudgedAngkot.speed > 0, true);

  // Ojol weaves smoothly when traffic ahead slows and accelerates to yield on Klakson
  const ojolWeave = stepTrafficVehicleAI(
    {
      x: -34,
      z: -10,
      heading: 0,
      speed: 9,
      waypointIndex: 1,
      stopTimer: 0,
      preferredSpeed: 12,
      layer: 'ground',
      vehicleType: 'ojek',
      weaveOffset: 0,
    },
    TRAFFIC_ROUTES.ring_clockwise,
    8.0,
    0.2,
    { hornTriggered: true, playerWantedLevel: 3 }
  );
  assert.equal((ojolWeave.weaveOffset ?? 0) > 0, true);
  assert.equal((ojolWeave.hornReactionTimer ?? 0) > 1.0, true);
});

test('height-aware Semanggi elevation, non-overlapping traffic spawns, dry routes, and blocked car queue guard', () => {
  // Street traffic driving under Tol Layang Semanggi stays at ground level (0) instead of teleporting up to 6.2m
  assert.equal(getGroundElevationAt(0, 80, 0), 0);
  // Elevated Tol Layang vehicles and ramp entrants ride the 6.2m deck cleanly
  assert.equal(getGroundElevationAt(0, 80, 6.2), 6.2);
  const rampMouthY = getGroundElevationAt(-63, 80, 0);
  assert.ok(rampMouthY > 0.5 && rampMouthY <= 1.85);

  const spawns = generateInitialTrafficSpawns();
  for (let i = 0; i < spawns.length; i++) {
    if (spawns[i].layer === 'ground') {
      assert.ok(spawns[i].z > -72, `Ground spawn ${spawns[i].id} must stay on dry land`);
    }
    for (let j = i + 1; j < spawns.length; j++) {
      if (spawns[i].layer !== spawns[j].layer) continue;
      const dist = Math.hypot(spawns[i].x - spawns[j].x, spawns[i].z - spawns[j].z);
      assert.ok(
        dist >= 7.5,
        `Traffic spawns ${spawns[i].id} and ${spawns[j].id} too close (${dist.toFixed(2)}m)`
      );
    }
  }

  for (const [routeId, wps] of Object.entries(TRAFFIC_ROUTES)) {
    for (const wp of wps) {
      if (routeId !== 'tol_layang_express') {
        assert.ok(wp.z > -72, `Route ${routeId} waypoint (${wp.x}, ${wp.z}) enters Jakarta Bay sea`);
      }
    }
  }

  // Blocked car must hold at zero speed behind lead car even after stuckTimer accumulates
  const blockedCar: TrafficAISteppable = {
    x: 4.6,
    z: 60,
    heading: 0,
    speed: 0,
    waypointIndex: 1,
    stopTimer: 0,
    stuckTimer: 10,
    preferredSpeed: 11,
    layer: 'ground',
    vehicleType: 'sedan',
  };
  const stepped = stepTrafficVehicleAI(blockedCar, TRAFFIC_ROUTES.sudirman_south_arterial, 1.5, 0.2);
  assert.equal(stepped.speed, 0);
});

test('resolveJakartaAmbientProfile cycles through authentic Jakarta soundscapes by district and time of day', () => {
  const monasStep0 = resolveJakartaAmbientProfile('monas', 'senja', 0);
  const monasStep1 = resolveJakartaAmbientProfile('monas', 'senja', 1);
  const monasStep2 = resolveJakartaAmbientProfile('monas', 'senja', 2);
  assert.equal(monasStep0.activeCue, 'prayer_call_echo');
  assert.equal(monasStep1.activeCue, 'distant_traffic');
  assert.equal(monasStep2.activeCue, 'street_vendor_tektek');

  const blokMNight = resolveJakartaAmbientProfile('blok_m', 'malam', 0);
  assert.equal(blokMNight.primaryBed, 'market_hum');
  assert.equal(blokMNight.activeCue, 'street_vendor_tektek');

  const priokDay = resolveJakartaAmbientProfile('tanjung_priok', 'siang', 0);
  assert.equal(priokDay.primaryBed, 'coastal_wind');
  assert.equal(priokDay.activeCue, 'harbor_foghorn_gulls');

  const rainSudirman = resolveJakartaAmbientProfile('sudirman', 'hujan', 0);
  assert.equal(rainSudirman.primaryBed, 'monsoon_downpour');
  assert.equal(rainSudirman.activeCue, 'monsoon_rain_thunder');
});

test('stepWeatherTransition smoothly interpolates skybox, lighting, fog, and wetness instead of snapping', () => {
  const start = createInitialWeatherTransitionState('senja');
  const targetMalam = WEATHER_ENVIRONMENT_TARGETS.malam;

  const mid = stepWeatherTransition(start, 'malam', 0.2, 1.65);
  assert.equal(mid.targetMode, 'malam');
  assert.equal(mid.sunIntensity < start.sunIntensity, true);
  assert.equal(mid.sunIntensity > targetMalam.sunIntensity, true);
  assert.equal(mid.nightFactor > start.nightFactor, true);
  assert.equal(mid.nightFactor < targetMalam.nightFactor, true);
  assert.equal(mid.skyHorizonRgb.r < start.skyHorizonRgb.r, true);

  let wetState = mid;
  for (let i = 0; i < 6; i++) {
    wetState = stepWeatherTransition(wetState, 'hujan', 0.2, 1.65);
  }
  assert.equal(wetState.wetnessFactor > 0.75, true);
  assert.equal(wetState.wetnessFactor < 1.0, true);
  assert.equal(wetState.fogDensity > start.fogDensity, true);
  assert.equal(wetState.fogDensity < WEATHER_ENVIRONMENT_TARGETS.hujan.fogDensity, true);

  let converged = wetState;
  for (let i = 0; i < 40; i++) {
    converged = stepWeatherTransition(converged, 'siang', 0.25, 1.65);
  }
  assert.equal(Math.abs(converged.sunIntensity - WEATHER_ENVIRONMENT_TARGETS.siang.sunIntensity) < 0.005, true);
  assert.equal(Math.abs(converged.wetnessFactor) < 0.005, true);
  assert.equal(Math.abs(converged.nightFactor) < 0.005, true);
});

test('BAJSA stock market trading, sabotage impact, and market ticks update portfolio accurately', () => {
  const rich = { ...createInitialPlayerState('anak_jalanan'), rupiah: 500000 };
  const bought = buyStockShares(rich, 'BNBL', 10);
  assert.equal(bought.bought, true);
  assert.equal(bought.nextState.stockPortfolio.BNBL.ownedShares, 10);
  assert.equal(bought.nextState.rupiah < 500000, true);

  const impacted = triggerStockMarketImpact(bought.nextState, 'BNBL', 'SCBD', 0.25, 0.3);
  assert.equal(
    impacted.stockPortfolio.BNBL.currentPrice <
      bought.nextState.stockPortfolio.BNBL.currentPrice,
    true
  );
  assert.equal(
    impacted.stockPortfolio.SCBD.currentPrice >
      bought.nextState.stockPortfolio.SCBD.currentPrice,
    true
  );

  const ticked = stepStockMarketTick({ ...impacted, wantedLevel: 4 });
  assert.equal(ticked.stockPortfolio.GATO.history.length, 8);

  const sold = sellStockShares(ticked, 'BNBL', 10);
  assert.equal(sold.sold, true);
  assert.equal(sold.nextState.stockPortfolio.BNBL.ownedShares, 0);
  assert.equal(sold.proceedsRp > 0, true);

  const oversell = sellStockShares(sold.nextState, 'BNBL', 1);
  assert.equal(oversell.sold, false);
});

test('calculateHeistBreakdown and STREET_RACES/VEHICLE_SPECS produce valid payout and fleet data', () => {
  const breakdown = calculateHeistBreakdown(
    'heist_bank_sentral',
    'crew_dimas_siber',
    'crew_sari_drift',
    'crew_bang_tigers'
  );
  assert.equal(breakdown.grossTakeRp, 8500000);
  assert.equal(breakdown.totalCrewCutPercent, 12 + 10 + 14);
  assert.equal(breakdown.crewCutRp + breakdown.netPlayerTakeRp, breakdown.grossTakeRp);
  assert.equal(STREET_RACES.length >= 2, true);
  assert.equal(VEHICLE_SPECS.transjakarta.maxHp >= 400, true);
});

test('migrateSavedGame upgrades v1/v2 snapshots to v3, clamps invalid coordinates, and preserves settings', () => {
  const basePlayer = createInitialPlayerState('teknisi_glodok');
  const legacyV1 = {
    version: 1,
    origin: 'teknisi_glodok',
    selectedStage: 4,
    weatherMode: 'malam',
    playerState: { ...basePlayer, rupiah: 1234567, hp: 85 },
    playerPos: { x: 250, z: -200 },
    savedAt: 1700000000000,
  };

  const migrated = migrateSavedGame(legacyV1);
  assert.ok(migrated);
  assert.equal(SAVE_VERSION, 3);
  assert.equal(migrated.version, SAVE_VERSION);
  assert.equal(migrated.origin, 'teknisi_glodok');
  assert.equal(migrated.playerState.rupiah, 1234567);
  assert.equal(migrated.playerPos.x, 88);
  assert.equal(migrated.playerPos.z, -88);
  assert.equal(migrated.audioSettings.master, 1);
  assert.equal(migrated.gameSettings.graphicsTier, 'auto');
  assert.equal(migrated.gameSettings.voiceActingEnabled, true);
  assert.equal(migrated.gameSettings.cinematicCameraEnabled, true);
  assert.deepEqual(migrated.completedDynamicQuests, []);

  const v2Custom = {
    ...legacyV1,
    version: 2,
    gameSettings: {
      graphicsTier: 'ultra',
      voiceActingEnabled: false,
      cinematicCameraEnabled: true,
    },
  };
  const migratedV2 = migrateSavedGame(v2Custom);
  assert.ok(migratedV2);
  assert.equal(migratedV2.version, 3);
  assert.equal(migratedV2.gameSettings.graphicsTier, 'ultra');
  assert.equal(migratedV2.gameSettings.voiceActingEnabled, false);

  assert.equal(migrateSavedGame(null), null);
  assert.equal(migrateSavedGame({ version: 99 }), null);
});

test('sanitizeDialogueInput and buildFallbackNpcDialogue provide deterministic Jakarta dialogue and side-quests offline', () => {
  const cleaned = sanitizeDialogueInput('  <script>\nInfo patroli\tpolisi?`{}  ');
  assert.equal(cleaned.includes('<'), false);
  assert.equal(cleaned.includes('\n'), false);

  const res = buildFallbackNpcDialogue({
    npcName: 'Bang Jali',
    npcRole: 'Koordinator Lapangan',
    locationName: 'Terminal Blok M',
    missionTitle: 'Kudeta Senyap',
    playerPrompt: 'Ada info patroli polisi?',
    origin: 'anak_jalanan',
    wantedLevel: 2,
    reputation: { jalanan: 50, sindikat: 20, rakyat: 35 },
  });

  assert.equal(res.source, 'fallback');
  assert.equal(res.reply.length > 20, true);
  assert.ok(res.sideQuest);
  assert.equal(res.sideQuest.faction, 'jalanan');
  assert.equal(res.sideQuest.rewardRp >= 60000, true);
});

test('Warung interior mini-game evaluates serve quality, recovers minor HP, and grants temporary stamina buffs', () => {
  assert.equal(
    ENTERABLE_INTERIORS.some((i) => i.id === 'warung'),
    true
  );
  assert.equal(WARUNG_SNACKS.length, 6);

  // Mini-game sweet-spot evaluation
  const zone: [number, number] = [38, 66];
  assert.equal(evaluateWarungMiniGame(52, zone), 'sempurna');
  assert.equal(evaluateWarungMiniGame(41, zone), 'mantap');
  assert.equal(evaluateWarungMiniGame(15, zone), 'biasa');

  const base = {
    ...createInitialPlayerState('anak_jalanan'),
    hp: 60,
    fokusEnergy: 50,
    rupiah: 100000,
    staminaBuffTimer: 0,
  };
  assert.equal(getPlayerStaminaSpeedMultiplier(base), 1.0);

  // Consume Es Kopi Susu Gula Aren with 'sempurna' (1.5x) quality
  const kopiRes = consumeWarungSnack(base, 'es_kopi_susu', 'sempurna');
  assert.equal(kopiRes.consumed, true);
  assert.equal(kopiRes.multiplier, 1.5);
  assert.equal(kopiRes.hpRecovered, Math.round(12 * 1.5));
  assert.equal(kopiRes.staminaAddedSec, Math.round(45 * 1.5));
  assert.equal(kopiRes.nextState.hp, 60 + Math.round(12 * 1.5));
  assert.equal(kopiRes.nextState.staminaBuffTimer, Math.round(45 * 1.5));
  assert.equal(kopiRes.nextState.lastSnackEaten, 'es_kopi_susu');
  assert.equal(kopiRes.nextState.rupiah, 100000 - 18000);
  assert.equal(getPlayerStaminaSpeedMultiplier(kopiRes.nextState), 1.28);

  // Tick down stamina buff and verify passive Fokus regeneration
  const afterTick = stepWarungStaminaBuff(
    { ...kopiRes.nextState, fokusEnergy: 60 },
    5.0
  );
  assert.equal(
    afterTick.staminaBuffTimer,
    kopiRes.nextState.staminaBuffTimer - 5.0
  );
  assert.equal(afterTick.fokusEnergy > 60, true);

  // Insufficient funds guard
  const broke = { ...afterTick, rupiah: 5000 };
  const failRes = consumeWarungSnack(broke, 'sate_padang', 'mantap');
  assert.equal(failRes.consumed, false);
  assert.equal(failRes.nextState.rupiah, 5000);
});

test('Traffic signal state machine cycles phases and halts vehicles on red approaches', () => {
  let sig = createInitialTrafficSignalState();
  assert.equal(sig.phase, 'ns_green');

  // North-South vehicle approaching Bundaran Monas (z ~ -22, heading 0) moves on ns_green
  assert.equal(isStoppedAtTrafficSignal(0, -22, 0, 'ground', sig.phase), false);
  // East-West vehicle approaching stop line (x ~ -22, heading PI/2) stops on ns_green
  assert.equal(isStoppedAtTrafficSignal(-22, 0, Math.PI / 2, 'ground', sig.phase), true);
  // Elevated Tol Layang bypasses street-level red lights
  assert.equal(isStoppedAtTrafficSignal(-22, 0, Math.PI / 2, 'elevated', sig.phase), false);

  sig = stepTrafficSignals(sig, 8.2);
  assert.equal(sig.phase, 'ns_amber');
  sig = stepTrafficSignals(sig, 2.2);
  assert.equal(sig.phase, 'ew_green');
  assert.equal(isStoppedAtTrafficSignal(-22, 0, Math.PI / 2, 'ground', sig.phase), false);
  assert.equal(isStoppedAtTrafficSignal(0, -22, 0, 'ground', sig.phase), true);
  sig = stepTrafficSignals(sig, 8.2);
  assert.equal(sig.phase, 'ew_amber');
  sig = stepTrafficSignals(sig, 2.2);
  assert.equal(sig.phase, 'ns_green');
  assert.equal(sig.cycleCount, 1);
});

test('Character skills, weapon attachments, 13-district turf wars, police bribe, 24h clock, and JSON save import work properly', () => {
  let state = createInitialPlayerState('teknisi_glodok');
  state = { ...state, rupiah: 1000000, wantedLevel: 3 };

  // 1. Character skill upgrade
  const upSkill = upgradeCharacterSkill(state, 'aimPrecision');
  assert.equal(upSkill.upgraded, true);
  assert.equal(upSkill.nextState.characterSkills.aimPrecision, 2);

  // 2. Weapon attachment purchase & effective spec
  const baseRifle = getEffectiveWeaponSpec('rifle', upSkill.nextState);
  const attachRes = buyWeaponAttachment(
    upSkill.nextState,
    'rifle',
    'suppressor'
  );
  assert.equal(attachRes.bought, true);
  const modRifle = getEffectiveWeaponSpec('rifle', attachRes.nextState);
  assert.equal(modRifle.silent, true);
  assert.ok(modRifle.damage > baseRifle.damage);

  // 3. 13-District Turf Wars capture, fortify & passive income
  const baseTurfIncome = calculateTurfWarsIncome(attachRes.nextState);
  assert.ok(baseTurfIncome > 0);
  const capRes = captureDistrictTurf(attachRes.nextState, 'scbd');
  assert.equal(capRes.captured, true);
  assert.equal(capRes.nextState.districtTurf.scbd.owner, 'player');
  const fortRes = fortifyDistrictTurf(capRes.nextState, 'scbd');
  assert.equal(fortRes.fortified, true);
  assert.equal(fortRes.nextState.districtTurf.scbd.defenseLevel, 2);
  assert.ok(calculateTurfWarsIncome(fortRes.nextState) > baseTurfIncome);

  // 4. Police bribe clears wanted level
  const bribeRes = bribePoliceWanted(fortRes.nextState);
  assert.equal(bribeRes.bribed, true);
  assert.equal(bribeRes.nextState.wantedLevel, 0);

  // 5. 24-Hour Jakarta Clock & Weather Resolver + Radio & Drift Circuit
  assert.equal(formatJakartaClock(1050), '17:30 WIB');
  assert.equal(resolveWeatherFromWorldClock(1050, false), 'senja');
  assert.equal(resolveWeatherFromWorldClock(720, false), 'siang');
  assert.equal(resolveWeatherFromWorldClock(1320, false), 'malam');
  assert.equal(RADIO_STATIONS.length, 6);
  assert.equal(STREET_RACES.some((r) => r.id === 'race_drift_sabuk_tol'), true);

  // 6. JSON Save Import
  const rawJson = JSON.stringify({
    version: SAVE_VERSION,
    origin: 'teknisi_glodok',
    selectedStage: 5,
    weatherMode: 'malam',
    playerState: bribeRes.nextState,
    playerPos: { x: 12, z: -18 },
    savedAt: Date.now(),
  });
  const imported = parseImportedSaveJson(rawJson);
  assert.ok(imported);
  assert.equal(imported?.origin, 'teknisi_glodok');
});

test('World clock road event ticker triggers traffic jams and road construction events, blocks/slows traffic, and tracks detour completion', () => {
  assert.equal(WORLD_ROAD_EVENT_CATALOG.length >= 6, true);
  assert.equal(
    WORLD_ROAD_EVENT_CATALOG.some((e) => e.kind === 'road_construction'),
    true
  );
  assert.equal(
    WORLD_ROAD_EVENT_CATALOG.some((e) => e.kind === 'traffic_jam'),
    true
  );

  // Rush hour detection (08:00 WIB = 480, 17:30 WIB = 1050 vs 13:00 WIB = 780)
  assert.equal(isJakartaRushHour(480), true);
  assert.equal(isJakartaRushHour(1050), true);
  assert.equal(isJakartaRushHour(780), false);

  // Ticker countdown and expiration
  const initWithEvent = createInitialWorldClockEventState(true);
  assert.ok(initWithEvent.activeEvent);
  const step1 = stepWorldClockEventTicker(initWithEvent, 1052, 10);
  assert.equal(
    step1.nextState.activeEvent?.remainingSec,
    initWithEvent.activeEvent!.remainingSec - 10
  );

  // Expire active event
  const expiredStep = stepWorldClockEventTicker(
    step1.nextState,
    1060,
    100
  );
  assert.equal(expiredStep.nextState.activeEvent, null);
  assert.ok(expiredStep.expiredEvent);
  assert.ok(expiredStep.nextState.cooldownSec > 0);

  // Step through cooldown and trigger new event deterministically
  const readyState = { ...expiredStep.nextState, cooldownSec: 1 };
  const triggeredStep = stepWorldClockEventTicker(readyState, 1065, 1, 0.1);
  assert.ok(triggeredStep.triggeredEvent);
  assert.ok(triggeredStep.nextState.activeEvent);
  assert.notEqual(
    triggeredStep.triggeredEvent?.spec.id,
    initWithEvent.activeEvent?.spec.id
  );

  // Manual trigger by preferred kind
  const manualJam = triggerManualWorldRoadEvent(
    triggeredStep.nextState,
    1070,
    'traffic_jam',
    0.2
  );
  assert.equal(manualJam.triggeredEvent.spec.kind, 'traffic_jam');

  // Evaluate physical roadblock & slowdown impact at event center vs outside vs elevated
  const constructionEvt = triggerManualWorldRoadEvent(
    manualJam.nextState,
    1075,
    'road_construction',
    0.0
  ).triggeredEvent;
  const centerImpact = evaluateRoadEventImpactAt(
    constructionEvt,
    constructionEvt.spec.x + 0.5,
    constructionEvt.spec.z + 0.5,
    0
  );
  assert.equal(centerImpact.inZone, true);
  assert.equal(centerImpact.blockedBarrierCollide, true);
  assert.equal(centerImpact.speedMultiplier < 0.4, true);

  // Elevated Tol Layang or aircraft bypasses ground road construction
  const elevatedImpact = evaluateRoadEventImpactAt(
    constructionEvt,
    constructionEvt.spec.x,
    constructionEvt.spec.z,
    5.5
  );
  assert.equal(elevatedImpact.inZone, false);

  // AI traffic vehicle slows/stops when approaching active road construction
  const aiSedan: TrafficAISteppable = {
    x: constructionEvt.spec.x,
    z: constructionEvt.spec.z + 8.5,
    heading: Math.PI,
    speed: 12,
    waypointIndex: 1,
    stopTimer: 0,
    preferredSpeed: 12,
    layer: 'ground',
    vehicleType: 'sedan',
  };
  const route = [
    { x: constructionEvt.spec.x, z: constructionEvt.spec.z + 20 },
    { x: constructionEvt.spec.x, z: constructionEvt.spec.z - 20 },
  ];
  const steppedSedan = stepTrafficVehicleAI(aiSedan, route, 99, 0.5, {
    activeRoadEvent: constructionEvt,
  });
  assert.equal(steppedSedan.speed < aiSedan.speed, true);

  // Multi-waypoint Detour progression
  let detourEvt = constructionEvt;
  const wps = detourEvt.spec.detourWaypoints;
  assert.equal(wps.length >= 2, true);
  for (let i = 0; i < wps.length; i++) {
    const [wx, wz] = wps[i];
    const prog = checkPlayerDetourProgress(detourEvt, wx + 1, wz - 1);
    assert.equal(prog.reachedWaypoint, true);
    detourEvt = prog.updatedEvent!;
    if (i < wps.length - 1) {
      assert.equal(prog.completedDetour, false);
    } else {
      assert.equal(prog.completedDetour, true);
      assert.equal(detourEvt.detourCompleted, true);
    }
  }
});

test('Phase 2 & Phase 4: Physics suspension/drift, Crowd AI state machine, HRTF Spatial Audio, Co-Op NetSync interpolation, and SimWorker batching', async () => {
  const { computeDriftAndSuspensionStep } = await import('../engine/physicsWorld');
  const {
    evaluatePedestrianAiState,
    pickDiveEvadeCallout,
    stepPedestrianAgentInPlace,
  } = await import('../engine/crowdAi');
  const { computeSpatialPanAndAttenuation } = await import('../engine/spatialAudio');
  const { interpolateRemotePeerPose } = await import('../engine/netSync');
  const { computeSimBatchInPlace } = await import('../engine/sim.worker');
  const { MultiplayerRoomHub } = await import('../../server/multiplayer');

  // 1. Suspension & drift curve
  const driftRes = computeDriftAndSuspensionStep(
    12,
    18,
    0.85,
    true,
    0,
    0,
    0.05
  );
  assert.ok(driftRes.slipRatio > 0.5);
  assert.ok(driftRes.pitchAngle < 0); // accelerating nose-up pitch
  assert.ok(driftRes.rollAngle > 0); // cornering body roll

  // 2. Pedestrian AI state machine (WALKING, CROSSING_AT_GREEN, FLEEING, CROWDING)
  const basePed = {
    x: 0,
    z: 0,
    axis: 'ns' as const,
    dir: 1 as const,
    minX: -1,
    maxX: 1,
    minZ: -10,
    maxZ: 10,
    speed: 1.5,
    phase: 0,
    state: 'WALKING' as const,
    panicTimer: 0,
    panicVx: 0,
    panicVz: 0,
    crowdTimer: 0,
    crowdAnchorX: 0,
    crowdAnchorZ: 0,
    torsoColor: 0xffffff,
  };
  assert.equal(
    evaluatePedestrianAiState(basePed, {
      dt: 0.05,
      signalPhase: 'ns_green',
      wantedLevel: 4,
      playerX: 5,
      playerZ: 5,
    }),
    'FLEEING'
  );
  assert.equal(
    evaluatePedestrianAiState(
      { ...basePed, z: 9.5 },
      {
        dt: 0.05,
        signalPhase: 'ew_green',
        wantedLevel: 0,
        playerX: 80,
        playerZ: 80,
      }
    ),
    'CROSSING_AT_GREEN'
  );
  assert.equal(
    evaluatePedestrianAiState(
      { ...basePed, crowdTimer: 1.5 },
      {
        dt: 0.05,
        signalPhase: 'ns_amber',
        wantedLevel: 0,
        playerX: 80,
        playerZ: 80,
      }
    ),
    'CROWDING'
  );

  // Oncoming speeding vehicle triggers DIVE_EVADE lateral roll
  const divePed: import('../engine/crowdAi').PedestrianAiAgent = {
    ...basePed,
    x: 9,
    z: 0,
  };
  const diveRes = stepPedestrianAgentInPlace(divePed, {
    dt: 0.05,
    signalPhase: 'ns_green',
    wantedLevel: 0,
    playerX: 5,
    playerZ: 0,
    playerSpeed: 16,
    playerInVehicle: true,
  });
  assert.equal(diveRes.state, 'DIVE_EVADE');
  assert.ok((divePed.diveTimer ?? 0) > 0);
  assert.ok(pickDiveEvadeCallout(0).length > 5);

  // Direct high-speed vehicle collision triggers KNOCKED_DOWN tumble
  const hitPed: import('../engine/crowdAi').PedestrianAiAgent = {
    ...basePed,
    x: 9,
    z: 0,
  };
  const hitRes = stepPedestrianAgentInPlace(hitPed, {
    dt: 0.05,
    signalPhase: 'ns_green',
    wantedLevel: 0,
    playerX: 8.2,
    playerZ: 0,
    playerSpeed: 12,
    playerInVehicle: true,
  });
  assert.equal(hitRes.state, 'KNOCKED_DOWN');
  assert.ok((hitPed.knockdownTimer ?? 0) > 0);

  // 3. 3D Spatial Audio HRTF panning & inverse-distance attenuation
  const rightSource = computeSpatialPanAndAttenuation(
    {
      x: 0,
      y: 0,
      z: 0,
      forwardX: 0,
      forwardY: 0,
      forwardZ: -1,
      upX: 0,
      upY: 1,
      upZ: 0,
    },
    { x: 12, y: 0, z: 0 },
    6,
    60
  );
  assert.ok(rightSource.pan > 0.8);
  assert.ok(rightSource.attenuation < 1 && rightSource.attenuation > 0.3);

  // 4. 20Hz -> 60fps Remote Peer Pose Interpolation
  const interp = interpolateRemotePeerPose(
    { x: 0, y: 0, z: 0, heading: 0 },
    {
      peerId: 'p2',
      displayName: 'Raka',
      protagonist: 'raka',
      x: 10,
      y: 0,
      z: -10,
      heading: Math.PI / 2,
      speed: 14,
      vehicleType: 'supercar',
      updatedAt: Date.now(),
    },
    0.016,
    0.025
  );
  assert.ok(interp.x > 0 && interp.x < 10);
  assert.ok(interp.z < 0 && interp.z > -10);

  // 5. Multiplayer Room Hub (8-player room cap & state sync)
  const hub = new MultiplayerRoomHub();
  const join1 = hub.joinOrSelectRoom(
    'room_scbd',
    'street_race',
    'peer_1',
    'Nabilo'
  );
  assert.equal(join1.roomId, 'room_scbd');
  assert.equal(hub.getRoomPeers('room_scbd').length, 1);

  // 6. Web Worker Transferable Float32Array batch simulation
  const inBuf = new Float32Array([3, 4, Math.PI / 2, 10]);
  const outBuf = new Float32Array(4);
  computeSimBatchInPlace(inBuf, outBuf, 0, 0, 0.1);
  assert.ok(Math.abs(outBuf[1] - 5) < 0.01); // distToPlayer = hypot(3, 4) = 5
  assert.ok(Math.abs(outBuf[2] - 4) < 0.01); // nextX = 3 + sin(PI/2)*10*0.1 = 4
});


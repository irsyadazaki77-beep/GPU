export type GameState = 'title' | 'playing' | 'paused' | 'gameover';

export type OriginArchetype = 'anak_jalanan' | 'mantan_kurir' | 'teknisi_glodok';

export type FactionId = 'jalanan' | 'sindikat' | 'rakyat';

export type WeatherMode = 'senja' | 'malam' | 'siang' | 'hujan';

export type WeaponId =
  | 'fist'
  | 'golok'
  | 'pistol'
  | 'rifle'
  | 'mercon'
  | 'pasopati'
  | 'gatotkaca';

export type RadioStationId =
  | 'off'
  | 'prambors'
  | 'koplo'
  | 'synth_scbd'
  | 'indie_senopati'
  | 'berita_kriminal';

export type OutfitId = 'jaket_jawara' | 'jas_scbd' | 'rompi_taktis' | 'hoodie_siber';

export interface OutfitSpec {
  id: OutfitId;
  name: string;
  subtitle: string;
  jacketHex: number;
  pantsHex: number;
  capHex: number;
}

export interface RadioStationSpec {
  id: RadioStationId;
  name: string;
  freq: string;
  genre: string;
}

export interface WeaponSpec {
  id: WeaponId;
  key: string;
  name: string;
  roleClue: string;
  damage: number;
  range: number;
  cooldown: number;
  ammoCost: number;
  maxAmmo: number;
  isMelee: boolean;
  splashRadius: number;
  price: number;
}

export type VehicleType =
  | 'bajaj'
  | 'ojek'
  | 'angkot'
  | 'sedan'
  | 'metromini'
  | 'transjakarta'
  | 'polisi'
  | 'barracuda'
  | 'heli'
  | 'supercar'
  | 'vtol_jet'
  | 'speedboat';

export interface VehicleSpec {
  type: VehicleType;
  name: string;
  subtitle: string;
  maxSpeed: number;
  acceleration: number;
  turnRate: number;
  maxHp: number;
  colorHex: number;
  accentHex: number;
  radius: number;
  isAircraft?: boolean;
  isWatercraft?: boolean;
}

export interface PropertySpec {
  id: string;
  name: string;
  districtName: string;
  price: number;
  incomePerTick: number;
  description: string;
}

export interface DistrictZone {
  id: string;
  name: string;
  subtitle: string;
  centerX: number;
  centerZ: number;
  radius: number;
}

export type EnemyBehaviorPolicy = 'rusher' | 'ranged_kiter' | 'charger_enforcer';

export interface EnemyArchetypeSpec {
  policy: EnemyBehaviorPolicy;
  name: string;
  maxHp: number;
  speed: number;
  damage: number;
  attackRange: number;
  windupDuration: number;
  cooldown: number;
  rewardRp: number;
  scoreValue: number;
}

export interface StoryChoiceOption {
  id: string;
  label: string;
  description: string;
  faction: FactionId;
  reputationDelta: Record<FactionId, number>;
  rewardRp: number;
  wantedDelta: number;
  objectiveType: 'combat_wave' | 'checkpoint_drive' | 'heist_escape';
  objectiveTargetCount: number;
  targetX: number;
  targetZ: number;
  nextMissionId: string | null;
  outcomeNarrative: string;
}

export interface StoryMission {
  id: string;
  stageNumber: 1 | 2 | 3 | 4 | 5;
  chapterNumber: number;
  title: string;
  giverName: string;
  giverRole: string;
  locationName: string;
  markerX: number;
  markerZ: number;
  briefing: string;
  choices: StoryChoiceOption[];
}

export type ProtagonistId = 'nabilo' | 'raka' | 'kirana';

export interface ProtagonistProfileSpec {
  id: ProtagonistId;
  name: string;
  codename: string;
  roleTitle: string;
  specialAbilityName: string;
  specialAbilityDesc: string;
  colorHex: string;
  threeColorHex: number;
  defaultOutfitId: OutfitId;
  homeDistrictName: string;
  spawnX: number;
  spawnZ: number;
  idleActivity: string;
}

export interface ProtagonistLiveState {
  id: ProtagonistId;
  x: number;
  z: number;
  hp: number;
  armor: number;
  outfitId: OutfitId;
  statusText: string;
}

export type VehiclePaintFinish = 'metallic' | 'matte' | 'chrome';

export interface VehicleCustomPaintSpec {
  id: string;
  name: string;
  primaryHex: number;
  accentHex: number;
  finish: VehiclePaintFinish;
  price: number;
}

export interface VehicleUnderglowSpec {
  id: string;
  name: string;
  colorHex: number | null;
  cssColor: string;
  price: number;
}

export interface VehicleCustomConfig {
  paintId: string;
  underglowId: string;
  armorPlatingLevel: number;
  nitroEnabled: boolean;
}

export type StockSymbol = 'BNBL' | 'SCBD' | 'PRIO' | 'HALM' | 'GATO' | 'KMYR';

export interface StockTickerSpec {
  symbol: StockSymbol;
  name: string;
  sector: string;
  rivalSymbol: StockSymbol;
  basePrice: number;
  sabotageHint: string;
}

export interface StockMarketEntry {
  symbol: StockSymbol;
  currentPrice: number;
  previousPrice: number;
  history: number[];
  ownedShares: number;
  avgBuyPrice: number;
}

export type HeistId = 'heist_bank_sentral' | 'heist_bursa_scbd' | 'heist_kargo_priok';
export type HeistApproach = 'stealth_cyber' | 'tactical_assault';

export interface HeistCrewMemberSpec {
  id: string;
  name: string;
  role: 'hacker' | 'driver' | 'gunman';
  roleLabel: string;
  skillRating: number;
  cutPercent: number;
  perkDesc: string;
}

export interface GrandHeistSpec {
  id: HeistId;
  title: string;
  targetLocation: string;
  targetStockRival: StockSymbol;
  victimStock: StockSymbol;
  grossTakeRp: number;
  setupDescription: string;
  stealthDesc: string;
  assaultDesc: string;
  vaultX: number;
  vaultZ: number;
  escapeX: number;
  escapeZ: number;
}

export type InteriorZoneId =
  | 'exterior'
  | 'heist_penthouse'
  | 'customs_garage'
  | 'bank_vault'
  | 'warung'
  | 'safehouse_trio'
  | 'faction_hq_jalanan'
  | 'faction_hq_sindikat'
  | 'faction_hq_rakyat'
  | 'glodok_tech_shop';

export type DistrictId =
  | 'scbd'
  | 'monas'
  | 'blok_m'
  | 'kota_tua'
  | 'glodok'
  | 'tanah_abang'
  | 'kemayoran'
  | 'senayan'
  | 'priok'
  | 'pik_ancol'
  | 'manggarai'
  | 'kemang'
  | 'halim'
  | string;

export type BusinessId =
  | 'biz_bengkel_modif'
  | 'biz_armada_ojol'
  | 'biz_gudang_priok'
  | 'biz_server_glodok';

export interface BusinessSpec {
  id: BusinessId;
  name: string;
  districtId: DistrictId;
  basePrice: number;
  upgradeCost: number;
  baseIncomePerHour: number;
  linkedStock: StockSymbol;
  rivalStock: StockSymbol;
  description: string;
}

export interface FinancialNewsItem {
  id: string;
  headline: string;
  affectedSymbol: StockSymbol;
  deltaPct: number;
  timestampLabel: string;
}

export interface CustomRaceTrackSpec {
  id: string;
  name: string;
  subtitle?: string;
  author?: string;
  authorName?: string;
  isLoop?: boolean;
  entryFeeRp: number;
  rewardRp: number;
  checkpoints: [number, number][];
  createdAt: number;
}

export type WorldClockRoadEventKind =
  | 'none'
  | 'rush_hour_pagi'
  | 'macet_sore'
  | 'konvoi_pejabat'
  | 'pasar_tumpah'
  | 'razia_malam';

export type WarungSnackId =
  | 'gorengan_bakwan'
  | 'klepon_pandan'
  | 'es_kopi_susu'
  | 'wedang_jahe'
  | 'kerak_telor'
  | 'sate_padang';

export type WarungServeQuality = 'sempurna' | 'mantap' | 'biasa';

export interface WarungSnackSpec {
  id: WarungSnackId;
  name: string;
  subtitle: string;
  category: 'jajanan_hp' | 'minuman_stamina' | 'paket_komplit';
  categoryLabel: string;
  priceRp: number;
  hpRestore: number;
  staminaBuffSeconds: number;
  fokusRestore: number;
  armorRestore: number;
  prepActionLabel: string;
  prepTargetZone: [number, number];
  accentColor: string;
}

export interface EnterableInteriorSpec {
  id: Exclude<InteriorZoneId, 'exterior'>;
  name: string;
  subtitle: string;
  districtName: string;
  portalX: number;
  portalZ: number;
  accentHex: number;
}

export interface StreetRaceSpec {
  id: string;
  name: string;
  subtitle: string;
  entryFeeRp: number;
  rewardRp: number;
  checkpoints: [number, number][];
}

export type CharacterSkillId =
  | 'stamina'
  | 'aimPrecision'
  | 'driftControl'
  | 'negotiation'
  | 'fokusMastery';

export interface CharacterSkillSpec {
  id: CharacterSkillId;
  name: string;
  subtitle: string;
  perkSummary: string;
  effectLabel?: string;
  baseCostRp: number;
  maxLevel: number;
}

export type WeaponAttachmentId =
  | 'suppressor'
  | 'extendedMag'
  | 'precisionBarrel'
  | 'gildedSkin';

export interface WeaponAttachmentSpec {
  id: WeaponAttachmentId;
  name: string;
  subtitle: string;
  priceRp: number;
  damageBonusPct: number;
  rangeBonusPct: number;
  ammoBonusPct: number;
  silent: boolean;
}

export type DistrictOwnerId = 'player' | 'syndicate' | 'neutral';

export interface DistrictTurfEntry {
  districtId: string;
  owner: DistrictOwnerId;
  defenseLevel: number;
  dividendRp: number;
}

export type StreetContractKind =
  | 'ojol_delivery'
  | 'convoy_intercept'
  | 'turf_assault'
  | 'glodok_arena'
  | 'priok_container_heist';

export interface ActiveStreetContractState {
  id: string;
  kind: StreetContractKind;
  title: string;
  subtitle: string;
  targetX: number;
  targetZ: number;
  districtId?: string;
  rewardRp: number;
  timeRemainingSec: number;
  totalTimeSec: number;
}

export type SaveSlotId = 1 | 2 | 3;

export interface PlayerProgressState {
  hp: number;
  maxHp: number;
  armor: number;
  maxArmor: number;
  rupiah: number;
  wantedLevel: number;
  wantedEvading: boolean;
  wantedEvadeTimer: number;
  score: number;
  bestScore: number;
  reputation: Record<FactionId, number>;
  completedMissions: string[];
  unlockedWeapons: WeaponId[];
  activeWeapon: WeaponId;
  ammo: Record<WeaponId, number>;
  ownedProperties: string[];
  crewCount: number;
  radioStation: RadioStationId;
  fokusEnergy: number;
  fokusActive: boolean;
  outfitId: OutfitId;
  vehicleUpgradeLevel: number;
  droneLevel: number;
  droneActive: boolean;
  activeProtagonist: ProtagonistId;
  protagonistRoster: Record<ProtagonistId, ProtagonistLiveState>;
  vehicleCustoms: VehicleCustomConfig;
  stockPortfolio: Record<StockSymbol, StockMarketEntry>;
  completedHeistSetups: HeistId[];
  completedHeists: HeistId[];
  activeHeistPlan: {
    heistId: HeistId;
    approach: HeistApproach;
    hackerId: string;
    driverId: string;
    gunmanId: string;
  };
  currentInterior: InteriorZoneId;
  staminaBuffTimer: number;
  lastSnackEaten: WarungSnackId | null;
  characterSkills: Record<CharacterSkillId, number>;
  weaponAttachments: Partial<Record<WeaponId, WeaponAttachmentId[]>>;
  districtTurf: Record<string, DistrictTurfEntry>;
  unlockedSafehouses?: string[];
  ownedBusinesses?: Partial<Record<BusinessId, number>>;
  customRaceTracks?: CustomRaceTrackSpec[];
  collectedPackages?: string[];
}

export interface BuildingFootprint {
  id: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  style: 'skyscraper' | 'colonial' | 'pasar' | 'ruko' | 'monas' | 'port_crane';
  primaryColor: number;
  accentColor: number;
}

export type TrafficSignKind =
  | 'dilarang_parkir'
  | 'batas_kecepatan_40'
  | 'batas_kecepatan_60'
  | 'khusus_busway'
  | 'peringatan_penyeberangan'
  | 'arah_wajib_lurus';

export interface TrafficSignSpawn {
  id: string;
  kind: TrafficSignKind;
  x: number;
  y: number;
  z: number;
  rotY: number;
  corridor: 'sudirman_ns' | 'merdeka_ew' | 'tol_layang';
}

export interface TollSignSpawn {
  id: string;
  variant: 'cantilever' | 'twin_post';
  theme: 'green_arterial' | 'blue_toll';
  topText: string;
  bottomText: string;
  badgeText: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface TransJakartaHalteSpawn {
  id: string;
  stationName: string;
  corridorCode: string;
  routeSummary: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface RoadsideSpawnLayout {
  trafficSigns: TrafficSignSpawn[];
  tollSigns: TollSignSpawn[];
  transJakartaHaltes: TransJakartaHalteSpawn[];
}

export interface SidewalkBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type TrafficRouteId =
  | 'ring_clockwise'
  | 'ring_ccw'
  | 'sudirman_north_arterial'
  | 'sudirman_south_arterial'
  | 'busway_corridor_north'
  | 'busway_corridor_south'
  | 'merdeka_west_arterial'
  | 'merdeka_east_arterial'
  | 'grand_boulevard_circuit'
  | 'tol_layang_express'
  | 'outer_ring_express'
  | 'jorr_perimeter_loop'
  | 'south_jakarta_boulevard';

export interface TrafficWaypoint {
  x: number;
  z: number;
  pauseSec?: number;
}

export interface TrafficSpawnSpec {
  id: string;
  type: VehicleType;
  routeId: TrafficRouteId;
  layer: 'ground' | 'elevated';
  x: number;
  z: number;
  heading: number;
  waypointIndex: number;
  preferredSpeed: number;
}

export interface TrafficAISteppable {
  x: number;
  z: number;
  heading: number;
  speed: number;
  waypointIndex: number;
  stopTimer: number;
  preferredSpeed: number;
  layer: 'ground' | 'elevated';
  vehicleType?: VehicleType;
  ngetemTimer?: number;
  ngetemCooldown?: number;
  weaveOffset?: number;
  hornReactionTimer?: number;
  stuckTimer?: number;
}

export type AmbientCueId =
  | 'distant_traffic'
  | 'street_vendor_tektek'
  | 'prayer_call_echo'
  | 'harbor_foghorn_gulls'
  | 'monsoon_rain_thunder'
  | 'night_cicada_neon'
  | 'mrt_chime_station';

export type AmbientBedType =
  | 'urban_traffic'
  | 'coastal_wind'
  | 'market_hum'
  | 'monsoon_downpour'
  | 'night_city';

export interface AmbientSoundscapeProfile {
  districtId: string;
  weatherMode: WeatherMode;
  primaryBed: AmbientBedType;
  bedFilterHz: number;
  bedGain: number;
  lfoRateHz: number;
  cueCycle: AmbientCueId[];
  activeCue: AmbientCueId;
  activeCueLabel: string;
}

export interface RgbColorTuple {
  r: number;
  g: number;
  b: number;
}

export interface WeatherEnvironmentSpec {
  id: WeatherMode;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
  skyTopHex: number;
  skyHorizonHex: number;
  skyBottomHex: number;
  sunColorHex: number;
  sunGlowStrength: number;
  sunDir: [number, number, number];
  fogHorizonHex: number;
  fogDensity: number;
  monasPlazaLightIntensity: number;
  sudirmanPlazaLightIntensity: number;
  wetnessFactor: number;
  nightFactor: number;
}

export interface WeatherTransitionState {
  targetMode: WeatherMode;
  sunRgb: RgbColorTuple;
  sunIntensity: number;
  hemiSkyRgb: RgbColorTuple;
  hemiGroundRgb: RgbColorTuple;
  hemiIntensity: number;
  skyTopRgb: RgbColorTuple;
  skyHorizonRgb: RgbColorTuple;
  skyBottomRgb: RgbColorTuple;
  sunColorRgb: RgbColorTuple;
  sunGlowStrength: number;
  sunDir: [number, number, number];
  fogHorizonRgb: RgbColorTuple;
  fogDensity: number;
  monasPlazaLightIntensity: number;
  sudirmanPlazaLightIntensity: number;
  wetnessFactor: number;
  nightFactor: number;
}

export interface AudioChannelVolumes {
  master: number;
  sfx: number;
  radio: number;
  ambience: number;
}

export interface NpcDynamicSideQuest {
  id: string;
  title: string;
  description: string;
  targetDistrict: string;
  rewardRp: number;
  faction: FactionId;
  repGain: number;
}

export interface WorldContextSnapshot {
  activeProtagonist: 'Nabilo' | 'Raka' | 'Kirana' | ProtagonistId;
  currentDistrict: string;
  wantedLevel: number;
  factionStandings: Record<FactionId, number>;
  ownedTurfCount: number;
  recentEvents: string[];
}

export interface NpcDialogueRequest {
  npcName: string;
  npcRole: string;
  locationName: string;
  missionTitle: string;
  playerPrompt: string;
  origin: OriginArchetype;
  wantedLevel: number;
  reputation: Record<FactionId, number>;
  worldContext?: WorldContextSnapshot;
}

export interface NpcDialogueResponse {
  reply: string;
  tone: string;
  source: 'gemini' | 'fallback';
  sideQuest?: NpcDynamicSideQuest;
  worldMemorySummary?: string;
}

export type TouchControlsMode = 'auto' | 'on' | 'off';

export type WaypointCategory =
  | 'custom'
  | 'district'
  | 'mission'
  | 'heist'
  | 'race'
  | 'property'
  | 'bounty'
  | 'detour';

export type WorldRoadEventKind = 'traffic_jam' | 'road_construction';

export interface WorldRoadEventSpec {
  id: string;
  kind: WorldRoadEventKind;
  title: string;
  corridorName: string;
  description: string;
  detourLabel: string;
  x: number;
  z: number;
  radius: number;
  heading: number;
  detourWaypoints: [number, number][];
  detourTargetX: number;
  detourTargetZ: number;
}

export interface ActiveWorldRoadEvent {
  spec: WorldRoadEventSpec;
  startedAtMinute: number;
  remainingSec: number;
  totalDurationSec: number;
  detourStageIndex: number;
  detourCompleted: boolean;
}

export interface WorldClockEventTickerState {
  activeEvent: ActiveWorldRoadEvent | null;
  cooldownSec: number;
  totalEventsTriggered: number;
  lastEventId: string | null;
}

export interface CustomWaypointState {
  x: number;
  z: number;
  label: string;
  category: WaypointCategory;
}

export type GarageCameraPreset =
  | 'free_orbit'
  | 'front_low'
  | 'side_profile'
  | 'rear_exhaust'
  | 'top_down';

export type PhotoFilterId =
  | 'standar'
  | 'senja_emas'
  | 'noir_jakarta'
  | 'siber_matrix'
  | 'vintage_98';

export interface PhotoModeConfig {
  fov: number;
  rollDeg: number;
  orbitOffset: number;
  heightOffset: number;
  distance: number;
  filter: PhotoFilterId;
  letterbox: boolean;
  ruleOfThirds: boolean;
  hidePlayer: boolean;
}

export interface CashLedgerEntry {
  id: string;
  label: string;
  amountRp: number;
  category: 'misi' | 'heist' | 'saham' | 'properti' | 'belanja' | 'bounty';
  timestampLabel: string;
}

export interface StreetBountySpec {
  id: string;
  title: string;
  targetName: string;
  districtName: string;
  x: number;
  z: number;
  rewardRp: number;
  faction: FactionId;
  difficulty: 'Menengah' | 'Tinggi' | 'Ekstrem';
  description: string;
}

export type GraphicsQualityTier = 'auto' | 'performance' | 'balanced' | 'ultra';

export interface GameSettings {
  graphicsTier: GraphicsQualityTier;
  voiceActingEnabled: boolean;
  cinematicCameraEnabled: boolean;
  touchControlsMode?: TouchControlsMode;
}

export type TrafficSignalPhase = 'ns_green' | 'ns_amber' | 'ew_green' | 'ew_amber';

export interface TrafficSignalState {
  phase: TrafficSignalPhase;
  timer: number;
  cycleCount: number;
}

export interface CombatHitFeedbackEvent {
  id: number;
  damage: number;
  isCrit: boolean;
  isHeadshot?: boolean;
  isKo: boolean;
  label: string;
  screenX: number;
  screenY: number;
}

export interface CutsceneOverlayState {
  active: boolean;
  mode: 'briefing' | 'heist' | 'sky_switch';
  title: string;
  speakerName: string;
  subtitleText: string;
}

export interface NpcVoiceRequest {
  text: string;
  speakerName: string;
  tone?: string;
}

export interface NpcVoiceResponse {
  audioBase64: string | null;
  mimeType: string;
  voiceName: string;
  source: 'gemini_tts' | 'fallback';
  cacheHit?: boolean;
}

export type MultiplayerRoomMode = 'free_roam' | 'street_race' | 'coop_heist';

export type MultiplayerConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface NetCoopEvent {
  type:
    | 'horn'
    | 'weapon_fire'
    | 'explosion'
    | 'wanted_alert'
    | 'passenger_ping'
    | 'heist_sync'
    | 'wanted_sync';
  peerId: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
  wantedLevel?: number;
  detail?: string;
  timestamp: number;
}

export interface NetPeerSnapshot {
  peerId: string;
  displayName: string;
  protagonist: ProtagonistId;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  vehicleType: VehicleType | null;
  wantedLevel?: number;
  ridingPeerId?: string | null;
  isCrouching?: boolean;
  isParachuting?: boolean;
  updatedAt: number;
}

export interface EnginePerformanceTelemetry {
  fps: number;
  drawCalls: number;
  triangles: number;
  activeRigidBodies: number;
  networkPingMs: number;
  connectedPeers: number;
  roomId: string;
  roomMode: MultiplayerRoomMode;
  simWorkerActive: boolean;
  connectionState?: MultiplayerConnectionState;
}

export type VehicleDamageZone = 'front' | 'rear' | 'left' | 'right';
export type VehicleSmokeStage = 'none' | 'steam' | 'heavy_smoke' | 'fire';

export interface VehicleDamageState {
  integrity: number;
  zones: Record<VehicleDamageZone, number>;
  puncturedTires: [boolean, boolean, boolean, boolean];
  headlightsBroken: [boolean, boolean];
  smokeStage: VehicleSmokeStage;
  explosionCountdownSec: number | null;
  exploded: boolean;
  lastImpactSeverity: number;
}

export type PoliceTacticalPhase =
  | 'clear'
  | 'witness_reporting'
  | 'active_pursuit'
  | 'searching_lkp';

export interface PoliceVisionCone {
  id: string;
  x: number;
  z: number;
  heading: number;
  range: number;
  halfAngleRad: number;
  isHeli: boolean;
}

export interface PoliceTacticalState {
  phase: PoliceTacticalPhase;
  witnessProgress: number;
  witnessX: number;
  witnessZ: number;
  witnessDistrict: string;
  lastKnownX: number | null;
  lastKnownZ: number | null;
  searchRadius: number;
  radioCallout: string | null;
  radioCalloutStamp: number;
  spikeStripsHitCount: number;
}

export type NabiloGramTriggerKind =
  | 'drift_stunt'
  | 'chain_explosion'
  | 'police_chase'
  | 'police_escape'
  | 'street_event'
  | 'heist_complete'
  | 'warung_viral'
  | 'manual_snap';

export interface NabiloGramComment {
  id: string;
  handle: string;
  text: string;
  likes: number;
}

export interface NabiloGramPost {
  id: string;
  authorHandle: string;
  authorTag: string;
  districtName: string;
  triggerKind: NabiloGramTriggerKind;
  snapshotDataUrl: string | null;
  caption: string;
  hashtags: string[];
  comments: NabiloGramComment[];
  views: number;
  likes: number;
  isLiked: boolean;
  boosted: boolean;
  createdAtMs: number;
  source: 'gemini' | 'local';
  isPendingAi?: boolean;
}

export interface ViralCloutState {
  xp: number;
  level: number;
  tierTitle: string;
  nextLevelXp: number;
  sponsorBonusPercent: number;
}

export interface ViralPostRequest {
  triggerKind: NabiloGramTriggerKind;
  districtName: string;
  protagonistName: string;
  wantedLevel: number;
  vehicleName?: string;
  summaryNote?: string;
}

export interface ViralPostResponse {
  authorHandle: string;
  authorTag: string;
  caption: string;
  hashtags: string[];
  comments: { handle: string; text: string; likes: number }[];
  source: 'gemini' | 'local';
}

export type StreetRandomEventKind =
  | 'begal_rescue'
  | 'street_race_challenge'
  | 'vip_convoy'
  | 'gang_brawl'
  | 'stolen_motor';

export interface StreetRandomEvent {
  id: string;
  kind: StreetRandomEventKind;
  title: string;
  subtitle: string;
  districtId: string;
  districtName: string;
  x: number;
  z: number;
  remainingSec: number;
  totalDurationSec: number;
  rewardRp: number;
  cloutXp: number;
  faction: FactionId;
  status: 'active' | 'resolved' | 'expired';
}

export interface TrioSynergyState {
  nabiloRaka: number;
  nabiloKirana: number;
  rakaKirana: number;
  lastBanterLine: string | null;
  lastBanterSpeaker: string | null;
}

export interface HeistBreachSession {
  active: boolean;
  heistId: HeistId;
  approach: HeistApproach;
  stage: 'cyber_signal' | 'thermal_drill';
  progress: number;
  heat: number;
  lockedBands: number;
}

/* ==========================================================================
 * WAVE 2 PERFECTION UPGRADE TYPES
 * ========================================================================== */

export type CameraViewMode = 'third_person' | 'first_person' | 'cinematic';

export type SquadOrderMode = 'follow' | 'attack' | 'hold';

export interface TrioSquadTelemetryMember {
  id: ProtagonistId;
  name: string;
  x: number;
  z: number;
  facing: number;
  active: boolean;
  actionLabel: string;
}

export interface TacticalCoverState {
  inCover: boolean;
  coverKind: 'none' | 'building' | 'vehicle' | 'barrier';
  mitigationPct: number;
  crosshairSpread: number;
}

export interface StuntRampSpec {
  id: string;
  name: string;
  districtName: string;
  x: number;
  z: number;
  heading: number;
  length: number;
  width: number;
  peakHeight: number;
  targetDistanceM: number;
  rewardRp: number;
}

export interface StuntJumpResult {
  rampId: string;
  rampName: string;
  distanceM: number;
  airTimeSec: number;
  rating: 'MANTAP' | 'GOKIL' | 'LEGENDARIS';
  rewardRp: number;
  cloutXp: number;
  isNewRamp: boolean;
  timestampMs: number;
}

export interface FloodZoneSpec {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  depthM: number;
  hydroplaneFactor: number;
}

export interface RaceRivalTelemetry {
  id: string;
  name: string;
  colorHex: number;
  x: number;
  z: number;
  heading: number;
  checkpointIndex: number;
  finished: boolean;
  finishTimeSec: number | null;
}

export interface ActiveStreetRaceSession {
  raceId: string;
  raceName: string;
  checkpoints: [number, number][];
  playerCheckpointIndex: number;
  elapsedSec: number;
  countdownSec: number;
  position: number;
  totalRacers: number;
  status: 'countdown' | 'racing' | 'finished';
  rewardRp: number;
  finishedPlace: number | null;
}

export interface ActiveTurfWarSession {
  districtId: string;
  districtName: string;
  centerX: number;
  centerZ: number;
  radius: number;
  wave: 1 | 2 | 3;
  totalWaves: 3;
  enemiesRemaining: number;
  captainAlive: boolean;
  progressPct: number;
  status: 'active' | 'victory' | 'aborted';
}

export interface EmpireEndgameSummary {
  tier: 1 | 2 | 3 | 4;
  tierTitle: string;
  ownedDistricts: number;
  totalDistricts: number;
  ownedBusinessesCount: number;
  completedHeistsCount: number;
  completedStuntsCount: number;
  passiveIncomePerMinRp: number;
  empireScore: number;
  nextTierGoal: string;
}

export type DailyChallengeKind =
  | 'stunt_jump'
  | 'street_race_win'
  | 'turf_capture'
  | 'squad_takedown'
  | 'viral_post'
  | 'drift_combo';

export interface DailyChallengeItem {
  id: string;
  kind: DailyChallengeKind;
  title: string;
  subtitle: string;
  progress: number;
  target: number;
  rewardRp: number;
  cloutXp: number;
  claimed: boolean;
}

export interface DailyChallengesState {
  dateKey: string;
  streakDays: number;
  items: DailyChallengeItem[];
}

export type AcousticZoneId =
  | 'open_street'
  | 'underpass_toll'
  | 'interior_room'
  | 'harbor_water';

export interface RadioBroadcastMessage {
  id: string;
  stationId: RadioStationId;
  headline: string;
  djLine: string;
  urgency: 'normal' | 'breaking' | 'police_dispatch';
  timestampMs: number;
}

export interface ParachuteState {
  deployed: boolean;
  altitudeAboveGround: number;
  glideSpeed: number;
  descentRate: number;
  canDeploy: boolean;
}

export interface StealthStatusState {
  crouching: boolean;
  inCover: boolean;
  suppressedWeapon: boolean;
  detectionRadiusMultiplier: number;
  silentTakedownReady: boolean;
}

export interface CoopHeistSyncState {
  heistId: HeistId | null;
  stageLabel: string;
  progressPct: number;
  sharedWantedLevel: number;
  crewRoles: Record<string, ProtagonistId>;
  updatedAtMs: number;
}







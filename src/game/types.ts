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
  | 'vtol_jet';

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
  | 'warung';

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
  | 'turf_assault';

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
  | 'tol_layang_express';

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

export interface NpcDialogueRequest {
  npcName: string;
  npcRole: string;
  locationName: string;
  missionTitle: string;
  playerPrompt: string;
  origin: OriginArchetype;
  wantedLevel: number;
  reputation: Record<FactionId, number>;
}

export interface NpcDialogueResponse {
  reply: string;
  tone: string;
  source: 'gemini' | 'fallback';
  sideQuest?: NpcDynamicSideQuest;
}

export type TouchControlsMode = 'auto' | 'on' | 'off';

export type WaypointCategory =
  | 'custom'
  | 'district'
  | 'mission'
  | 'heist'
  | 'race'
  | 'property'
  | 'bounty';

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
}



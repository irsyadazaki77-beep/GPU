import type {
  AmbientBedType,
  AmbientCueId,
  AmbientSoundscapeProfile,
  RgbColorTuple,
  WeatherEnvironmentSpec,
  WeatherMode,
  WeatherTransitionState,
} from './types';

export const WEATHER_MODES: {
  id: WeatherMode;
  label: string;
  skyHex: number;
  fogDensity: number;
  sunHex: number;
  sunIntensity: number;
  hemiSkyHex: number;
  hemiGroundHex: number;
  hemiIntensity: number;
}[] = [
  {
    id: 'senja',
    label: 'Senja Emas Jakarta',
    skyHex: 0x2563eb,
    fogDensity: 0.002,
    sunHex: 0xffb36b,
    sunIntensity: 2.25,
    hemiSkyHex: 0xfed7aa,
    hemiGroundHex: 0x475569,
    hemiIntensity: 0.98,
  },
  {
    id: 'malam',
    label: 'Malam Neon Sudirman',
    skyHex: 0x0b1224,
    fogDensity: 0.0028,
    sunHex: 0x7dd3fc,
    sunIntensity: 1.15,
    hemiSkyHex: 0x60a5fa,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.78,
  },
  {
    id: 'siang',
    label: 'Siang Terik Khatulistiwa',
    skyHex: 0x0284c7,
    fogDensity: 0.0014,
    sunHex: 0xfffbeb,
    sunIntensity: 2.85,
    hemiSkyHex: 0xbae6fd,
    hemiGroundHex: 0x64748b,
    hemiIntensity: 1.28,
  },
  {
    id: 'hujan',
    label: 'Hujan Monsun Deras',
    skyHex: 0x1e293b,
    fogDensity: 0.0036,
    sunHex: 0xcbd5e1,
    sunIntensity: 1.35,
    hemiSkyHex: 0x94a3b8,
    hemiGroundHex: 0x334155,
    hemiIntensity: 0.92,
  },
];

export const AMBIENT_CUE_LABELS: Record<AmbientCueId, string> = {
  distant_traffic: 'Deru Lalu Lintas & Klakson Kejauhan',
  street_vendor_tektek: 'Pedagang Tek-Tek & Kuliner Kaki Lima',
  prayer_call_echo: 'Gema Bedug & Panggilan Doa Kejauhan',
  harbor_foghorn_gulls: 'Peluit Kapal Kargo & Ombak Pesisir',
  monsoon_rain_thunder: 'Derai Hujan Monsun & Guntur Kota',
  night_cicada_neon: 'Angin Malam & Jangkrik Taman Kota',
  mrt_chime_station: 'Bel Peron MRT & Koridor Protokol',
};

const COASTAL_DISTRICTS = new Set([
  'tanjung_priok',
  'ancol_pik',
  'pik2_mangrove',
]);

const STREET_FOOD_MARKET_DISTRICTS = new Set([
  'tanah_abang',
  'blok_m',
  'kota_tua',
  'kemayoran',
]);

const TRANSIT_CBD_DISTRICTS = new Set([
  'sudirman',
  'scbd',
  'halim_station',
  'senayan_gbk',
]);

export function resolveJakartaAmbientProfile(
  districtId: string,
  weatherMode: WeatherMode,
  cycleStep: number = 0
): AmbientSoundscapeProfile {
  const isCoastal = COASTAL_DISTRICTS.has(districtId);
  const isMarket = STREET_FOOD_MARKET_DISTRICTS.has(districtId);
  const isTransitCbd = TRANSIT_CBD_DISTRICTS.has(districtId);

  let primaryBed: AmbientBedType = 'urban_traffic';
  let bedFilterHz = 360;
  let bedGain = 0.018;
  let lfoRateHz = 0.18;

  if (weatherMode === 'hujan') {
    primaryBed = 'monsoon_downpour';
    bedFilterHz = 820;
    bedGain = 0.026;
    lfoRateHz = 0.28;
  } else if (isCoastal) {
    primaryBed = 'coastal_wind';
    bedFilterHz = 480;
    bedGain = 0.02;
    lfoRateHz = 0.14;
  } else if (isMarket) {
    primaryBed = 'market_hum';
    bedFilterHz = 430;
    bedGain = 0.019;
    lfoRateHz = 0.22;
  } else if (weatherMode === 'malam') {
    primaryBed = 'night_city';
    bedFilterHz = 290;
    bedGain = 0.015;
    lfoRateHz = 0.12;
  }

  const cueCycle: AmbientCueId[] = [];

  if (weatherMode === 'hujan') {
    cueCycle.push('monsoon_rain_thunder');
    if (isCoastal) {
      cueCycle.push('harbor_foghorn_gulls', 'distant_traffic');
    } else if (isMarket) {
      cueCycle.push('street_vendor_tektek', 'distant_traffic');
    } else {
      cueCycle.push('distant_traffic', 'mrt_chime_station');
    }
  } else if (weatherMode === 'senja') {
    if (isCoastal) {
      cueCycle.push('harbor_foghorn_gulls', 'prayer_call_echo', 'distant_traffic');
    } else if (isMarket) {
      cueCycle.push('prayer_call_echo', 'street_vendor_tektek', 'distant_traffic');
    } else if (isTransitCbd) {
      cueCycle.push('distant_traffic', 'mrt_chime_station', 'prayer_call_echo');
    } else {
      cueCycle.push('prayer_call_echo', 'distant_traffic', 'street_vendor_tektek');
    }
  } else if (weatherMode === 'siang') {
    if (isCoastal) {
      cueCycle.push('harbor_foghorn_gulls', 'distant_traffic', 'prayer_call_echo');
    } else if (isMarket) {
      cueCycle.push('street_vendor_tektek', 'distant_traffic', 'prayer_call_echo');
    } else if (isTransitCbd) {
      cueCycle.push('distant_traffic', 'mrt_chime_station', 'street_vendor_tektek');
    } else {
      cueCycle.push('prayer_call_echo', 'distant_traffic', 'mrt_chime_station');
    }
  } else {
    if (isCoastal) {
      cueCycle.push('harbor_foghorn_gulls', 'night_cicada_neon', 'street_vendor_tektek');
    } else if (isMarket) {
      cueCycle.push('street_vendor_tektek', 'distant_traffic', 'night_cicada_neon');
    } else if (isTransitCbd) {
      cueCycle.push('distant_traffic', 'mrt_chime_station', 'night_cicada_neon');
    } else {
      cueCycle.push('night_cicada_neon', 'street_vendor_tektek', 'distant_traffic');
    }
  }

  const normalizedIdx =
    ((Math.floor(cycleStep) % cueCycle.length) + cueCycle.length) %
    cueCycle.length;
  const activeCue = cueCycle[normalizedIdx];

  return {
    districtId,
    weatherMode,
    primaryBed,
    bedFilterHz,
    bedGain,
    lfoRateHz,
    cueCycle,
    activeCue,
    activeCueLabel: AMBIENT_CUE_LABELS[activeCue],
  };
}

export const WEATHER_ENVIRONMENT_TARGETS: Record<
  WeatherMode,
  WeatherEnvironmentSpec
> = {
  senja: {
    id: 'senja',
    sunHex: 0xffb36b,
    sunIntensity: 2.25,
    hemiSkyHex: 0xfed7aa,
    hemiGroundHex: 0x475569,
    hemiIntensity: 0.98,
    skyTopHex: 0x2563eb,
    skyHorizonHex: 0xfb923c,
    skyBottomHex: 0x334155,
    sunColorHex: 0xffb36b,
    sunGlowStrength: 0.68,
    sunDir: [0.64, 0.28, 0.72],
    fogHorizonHex: 0xfdba74,
    fogDensity: 0.002,
    monasPlazaLightIntensity: 1.05,
    sudirmanPlazaLightIntensity: 0.95,
    wetnessFactor: 0.28,
    nightFactor: 0.34,
  },
  malam: {
    id: 'malam',
    sunHex: 0x7dd3fc,
    sunIntensity: 1.15,
    hemiSkyHex: 0x60a5fa,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.78,
    skyTopHex: 0x080f24,
    skyHorizonHex: 0x1e294b,
    skyBottomHex: 0x0f172a,
    sunColorHex: 0x93c5fd,
    sunGlowStrength: 0.32,
    sunDir: [-0.45, 0.52, -0.72],
    fogHorizonHex: 0x18223d,
    fogDensity: 0.0028,
    monasPlazaLightIntensity: 1.35,
    sudirmanPlazaLightIntensity: 1.25,
    wetnessFactor: 0.35,
    nightFactor: 1.0,
  },
  siang: {
    id: 'siang',
    sunHex: 0xfffbeb,
    sunIntensity: 2.85,
    hemiSkyHex: 0xbae6fd,
    hemiGroundHex: 0x64748b,
    hemiIntensity: 1.28,
    skyTopHex: 0x0284c7,
    skyHorizonHex: 0xbae6fd,
    skyBottomHex: 0x475569,
    sunColorHex: 0xfffbeb,
    sunGlowStrength: 0.52,
    sunDir: [0.46, 0.76, 0.45],
    fogHorizonHex: 0xa5d8ff,
    fogDensity: 0.0014,
    monasPlazaLightIntensity: 0.18,
    sudirmanPlazaLightIntensity: 0.15,
    wetnessFactor: 0.0,
    nightFactor: 0.0,
  },
  hujan: {
    id: 'hujan',
    sunHex: 0xcbd5e1,
    sunIntensity: 1.35,
    hemiSkyHex: 0x94a3b8,
    hemiGroundHex: 0x334155,
    hemiIntensity: 0.92,
    skyTopHex: 0x1e293b,
    skyHorizonHex: 0x64748b,
    skyBottomHex: 0x1e293b,
    sunColorHex: 0xbae6fd,
    sunGlowStrength: 0.24,
    sunDir: [0.35, 0.58, 0.65],
    fogHorizonHex: 0x475569,
    fogDensity: 0.0036,
    monasPlazaLightIntensity: 1.2,
    sudirmanPlazaLightIntensity: 1.12,
    wetnessFactor: 1.0,
    nightFactor: 0.38,
  },
};

function hexToRgbTuple(hex: number): RgbColorTuple {
  return {
    r: ((hex >> 16) & 0xff) / 255,
    g: ((hex >> 8) & 0xff) / 255,
    b: (hex & 0xff) / 255,
  };
}

function normalizeTuple3(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgbInPlace(
  cur: RgbColorTuple,
  targetHex: number,
  t: number
): void {
  const tr = ((targetHex >> 16) & 0xff) / 255;
  const tg = ((targetHex >> 8) & 0xff) / 255;
  const tb = (targetHex & 0xff) / 255;
  cur.r += (tr - cur.r) * t;
  cur.g += (tg - cur.g) * t;
  cur.b += (tb - cur.b) * t;
}

export function createInitialWeatherTransitionState(
  initialMode: WeatherMode
): WeatherTransitionState {
  const spec = WEATHER_ENVIRONMENT_TARGETS[initialMode] || WEATHER_ENVIRONMENT_TARGETS.senja;
  return {
    targetMode: spec.id,
    sunRgb: hexToRgbTuple(spec.sunHex),
    sunIntensity: spec.sunIntensity,
    hemiSkyRgb: hexToRgbTuple(spec.hemiSkyHex),
    hemiGroundRgb: hexToRgbTuple(spec.hemiGroundHex),
    hemiIntensity: spec.hemiIntensity,
    skyTopRgb: hexToRgbTuple(spec.skyTopHex),
    skyHorizonRgb: hexToRgbTuple(spec.skyHorizonHex),
    skyBottomRgb: hexToRgbTuple(spec.skyBottomHex),
    sunColorRgb: hexToRgbTuple(spec.sunColorHex),
    sunGlowStrength: spec.sunGlowStrength,
    sunDir: normalizeTuple3(spec.sunDir),
    fogHorizonRgb: hexToRgbTuple(spec.fogHorizonHex),
    fogDensity: spec.fogDensity,
    monasPlazaLightIntensity: spec.monasPlazaLightIntensity,
    sudirmanPlazaLightIntensity: spec.sudirmanPlazaLightIntensity,
    wetnessFactor: spec.wetnessFactor,
    nightFactor: spec.nightFactor,
  };
}

export function stepWeatherTransitionInPlace(
  state: WeatherTransitionState,
  targetMode: WeatherMode,
  dt: number,
  transitionRate: number = 1.65
): void {
  const target = WEATHER_ENVIRONMENT_TARGETS[targetMode] || WEATHER_ENVIRONMENT_TARGETS.senja;
  state.targetMode = target.id;
  if (dt <= 0) return;

  const alpha = 1 - Math.exp(-Math.max(0.1, transitionRate) * dt);

  lerpRgbInPlace(state.sunRgb, target.sunHex, alpha);
  state.sunIntensity = lerpScalar(state.sunIntensity, target.sunIntensity, alpha);

  lerpRgbInPlace(state.hemiSkyRgb, target.hemiSkyHex, alpha);
  lerpRgbInPlace(state.hemiGroundRgb, target.hemiGroundHex, alpha);
  state.hemiIntensity = lerpScalar(state.hemiIntensity, target.hemiIntensity, alpha);

  lerpRgbInPlace(state.skyTopRgb, target.skyTopHex, alpha);
  lerpRgbInPlace(state.skyHorizonRgb, target.skyHorizonHex, alpha);
  lerpRgbInPlace(state.skyBottomRgb, target.skyBottomHex, alpha);
  lerpRgbInPlace(state.sunColorRgb, target.sunColorHex, alpha);
  state.sunGlowStrength = lerpScalar(
    state.sunGlowStrength,
    target.sunGlowStrength,
    alpha
  );

  const normTargetDir = normalizeTuple3(target.sunDir);
  const dx = lerpScalar(state.sunDir[0], normTargetDir[0], alpha);
  const dy = lerpScalar(state.sunDir[1], normTargetDir[1], alpha);
  const dz = lerpScalar(state.sunDir[2], normTargetDir[2], alpha);
  const dLen = Math.hypot(dx, dy, dz) || 1;
  state.sunDir[0] = dx / dLen;
  state.sunDir[1] = dy / dLen;
  state.sunDir[2] = dz / dLen;

  lerpRgbInPlace(state.fogHorizonRgb, target.fogHorizonHex, alpha);
  state.fogDensity = lerpScalar(state.fogDensity, target.fogDensity, alpha);

  state.monasPlazaLightIntensity = lerpScalar(
    state.monasPlazaLightIntensity,
    target.monasPlazaLightIntensity,
    alpha
  );
  state.sudirmanPlazaLightIntensity = lerpScalar(
    state.sudirmanPlazaLightIntensity,
    target.sudirmanPlazaLightIntensity,
    alpha
  );

  state.wetnessFactor = lerpScalar(state.wetnessFactor, target.wetnessFactor, alpha);
  state.nightFactor = lerpScalar(state.nightFactor, target.nightFactor, alpha);
}

export function stepWeatherTransition(
  state: WeatherTransitionState,
  targetMode: WeatherMode,
  dt: number,
  transitionRate: number = 1.65
): WeatherTransitionState {
  const next: WeatherTransitionState = {
    ...state,
    sunRgb: { ...state.sunRgb },
    hemiSkyRgb: { ...state.hemiSkyRgb },
    hemiGroundRgb: { ...state.hemiGroundRgb },
    skyTopRgb: { ...state.skyTopRgb },
    skyHorizonRgb: { ...state.skyHorizonRgb },
    skyBottomRgb: { ...state.skyBottomRgb },
    sunColorRgb: { ...state.sunColorRgb },
    sunDir: [...state.sunDir] as [number, number, number],
    fogHorizonRgb: { ...state.fogHorizonRgb },
  };
  stepWeatherTransitionInPlace(next, targetMode, dt, transitionRate);
  return next;
}

/**
 * Formats a minute-of-day value (0..1439) into Jakarta 24-hour clock string (e.g., "17:45 WIB").
 */
export function formatJakartaClock(worldTimeMinutes: number): string {
  const normalized = ((Math.floor(worldTimeMinutes) % 1440) + 1440) % 1440;
  const hh = Math.floor(normalized / 60);
  const mm = normalized % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} WIB`;
}

/**
 * Resolves the natural Jakarta weather/sky phase for a given minute-of-day (0..1439),
 * unless monsoon rain is active.
 */
export function resolveWeatherFromWorldClock(
  worldTimeMinutes: number,
  rainActive: boolean = false
): WeatherMode {
  if (rainActive) return 'hujan';
  const normalized = ((Math.floor(worldTimeMinutes) % 1440) + 1440) % 1440;
  const hour = normalized / 60;
  if (hour >= 6.5 && hour < 15.75) {
    return 'siang';
  }
  if ((hour >= 5.0 && hour < 6.5) || (hour >= 15.75 && hour < 18.75)) {
    return 'senja';
  }
  return 'malam';
}


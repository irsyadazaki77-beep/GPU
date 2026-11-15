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
    skyHex: 0x161f33,
    fogDensity: 0.0028,
    sunHex: 0xffb067,
    sunIntensity: 1.35,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e2430,
    hemiIntensity: 0.62,
  },
  {
    id: 'malam',
    label: 'Malam Neon Sudirman',
    skyHex: 0x070b14,
    fogDensity: 0.0032,
    sunHex: 0x60a5fa,
    sunIntensity: 0.72,
    hemiSkyHex: 0x38bdf8,
    hemiGroundHex: 0x090d16,
    hemiIntensity: 0.48,
  },
  {
    id: 'siang',
    label: 'Siang Terik Khatulistiwa',
    skyHex: 0x2563eb,
    fogDensity: 0.0022,
    sunHex: 0xfff7ed,
    sunIntensity: 1.48,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.68,
  },
  {
    id: 'hujan',
    label: 'Hujan Monsun Deras',
    skyHex: 0x0f172a,
    fogDensity: 0.0042,
    sunHex: 0x94a3b8,
    sunIntensity: 0.85,
    hemiSkyHex: 0x64748b,
    hemiGroundHex: 0x0b0f19,
    hemiIntensity: 0.54,
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
    sunHex: 0xffb067,
    sunIntensity: 1.35,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e2430,
    hemiIntensity: 0.62,
    skyTopHex: 0x0c1428,
    skyHorizonHex: 0xb45309,
    skyBottomHex: 0x0f172a,
    sunColorHex: 0xfbbf24,
    sunGlowStrength: 0.45,
    sunDir: [0.55, 0.22, 0.8],
    fogHorizonHex: 0x1e2638,
    fogDensity: 0.0028,
    monasPlazaLightIntensity: 1.25,
    sudirmanPlazaLightIntensity: 1.05,
    wetnessFactor: 0,
    nightFactor: 0.65,
  },
  malam: {
    id: 'malam',
    sunHex: 0x60a5fa,
    sunIntensity: 0.72,
    hemiSkyHex: 0x38bdf8,
    hemiGroundHex: 0x090d16,
    hemiIntensity: 0.48,
    skyTopHex: 0x050814,
    skyHorizonHex: 0x111c33,
    skyBottomHex: 0x070b14,
    sunColorHex: 0x93c5fd,
    sunGlowStrength: 0.35,
    sunDir: [-0.45, 0.48, -0.75],
    fogHorizonHex: 0x0f192d,
    fogDensity: 0.0032,
    monasPlazaLightIntensity: 1.65,
    sudirmanPlazaLightIntensity: 1.45,
    wetnessFactor: 0,
    nightFactor: 1.0,
  },
  siang: {
    id: 'siang',
    sunHex: 0xfff7ed,
    sunIntensity: 1.48,
    hemiSkyHex: 0x93c5fd,
    hemiGroundHex: 0x1e293b,
    hemiIntensity: 0.68,
    skyTopHex: 0x1e40af,
    skyHorizonHex: 0x60a5fa,
    skyBottomHex: 0x1e293b,
    sunColorHex: 0xfffbeb,
    sunGlowStrength: 0.45,
    sunDir: [0.5, 0.72, 0.48],
    fogHorizonHex: 0x475569,
    fogDensity: 0.0022,
    monasPlazaLightIntensity: 0.25,
    sudirmanPlazaLightIntensity: 0.2,
    wetnessFactor: 0,
    nightFactor: 0.0,
  },
  hujan: {
    id: 'hujan',
    sunHex: 0x94a3b8,
    sunIntensity: 0.85,
    hemiSkyHex: 0x64748b,
    hemiGroundHex: 0x0b0f19,
    hemiIntensity: 0.54,
    skyTopHex: 0x0c1322,
    skyHorizonHex: 0x1e293b,
    skyBottomHex: 0x0f172a,
    sunColorHex: 0x94a3b8,
    sunGlowStrength: 0.12,
    sunDir: [0.35, 0.55, 0.65],
    fogHorizonHex: 0x1e293b,
    fogDensity: 0.0042,
    monasPlazaLightIntensity: 1.45,
    sudirmanPlazaLightIntensity: 1.25,
    wetnessFactor: 1.0,
    nightFactor: 0.65,
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

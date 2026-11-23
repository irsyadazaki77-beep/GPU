import type {
  BusinessId,
  BusinessSpec,
  DistrictId,
  FinancialNewsItem,
  PlayerProgressState,
  PropertySpec,
  StockMarketEntry,
  StockSymbol,
  StockTickerSpec,
  WarungServeQuality,
  WarungSnackId,
  WarungSnackSpec,
  WorldClockRoadEventKind,
} from './types';

export const WARUNG_SNACKS: WarungSnackSpec[] = [
  {
    id: 'gorengan_bakwan',
    name: 'Bakwan Jagung & Tempe Mendoan',
    subtitle: 'Gorengan hangat renyah dengan cabai rawit hijau & sambal kacang',
    category: 'jajanan_hp',
    categoryLabel: 'Jajanan Pulih HP',
    priceRp: 12000,
    hpRestore: 18,
    staminaBuffSeconds: 15,
    fokusRestore: 8,
    armorRestore: 0,
    prepActionLabel: 'Tiriskan Minyak & Ulek Sambal Kacang',
    prepTargetZone: [36, 68],
    accentColor: '#f59e0b',
  },
  {
    id: 'klepon_pandan',
    name: 'Klepon Pandan Gula Aren',
    subtitle: 'Bola ketan pandan lumer isi gula merah dengan taburan kelapa parut',
    category: 'jajanan_hp',
    categoryLabel: 'Jajanan Pulih HP',
    priceRp: 15000,
    hpRestore: 26,
    staminaBuffSeconds: 20,
    fokusRestore: 22,
    armorRestore: 0,
    prepActionLabel: 'Kukus Pandan & Tabur Kelapa Parut',
    prepTargetZone: [40, 70],
    accentColor: '#22c55e',
  },
  {
    id: 'es_kopi_susu',
    name: 'Es Kopi Susu Gula Aren Jawara',
    subtitle: 'Kopi robusta dingin racikan warung malam untuk dorongan stamina sprint',
    category: 'minuman_stamina',
    categoryLabel: 'Racikan Buff Stamina',
    priceRp: 18000,
    hpRestore: 12,
    staminaBuffSeconds: 45,
    fokusRestore: 30,
    armorRestore: 0,
    prepActionLabel: 'Seduh Espresso & Kocok Gula Aren Dingin',
    prepTargetZone: [38, 66],
    accentColor: '#38bdf8',
  },
  {
    id: 'wedang_jahe',
    name: 'Wedang Jahe Merah Sereh',
    subtitle: 'Seduhan jahe bakar rempah Nusantara untuk stamina panjang & fokus tenang',
    category: 'minuman_stamina',
    categoryLabel: 'Racikan Buff Stamina',
    priceRp: 20000,
    hpRestore: 20,
    staminaBuffSeconds: 60,
    fokusRestore: 25,
    armorRestore: 5,
    prepActionLabel: 'Bakar Rimpang Jahe & Rebus Sereh Wangi',
    prepTargetZone: [35, 65],
    accentColor: '#10b981',
  },
  {
    id: 'kerak_telor',
    name: 'Kerak Telor Betawi Spesial',
    subtitle: 'Ketan panggang telur bebek & serundeng gurih khas Monas dan Kota Tua',
    category: 'paket_komplit',
    categoryLabel: 'Kuliner Spesial',
    priceRp: 25000,
    hpRestore: 34,
    staminaBuffSeconds: 30,
    fokusRestore: 15,
    armorRestore: 12,
    prepActionLabel: 'Kipas Arang Batok & Tabur Serundeng',
    prepTargetZone: [42, 68],
    accentColor: '#f97316',
  },
  {
    id: 'sate_padang',
    name: 'Sate Padang & Ketupat Kuah Rempah',
    subtitle: 'Sate lidah & daging sapi kuah kuning kental penambah tenaga tempur penuh',
    category: 'paket_komplit',
    categoryLabel: 'Kuliner Spesial',
    priceRp: 35000,
    hpRestore: 45,
    staminaBuffSeconds: 50,
    fokusRestore: 20,
    armorRestore: 15,
    prepActionLabel: 'Bakar Sate Arang & Siram Kuah Kental',
    prepTargetZone: [40, 64],
    accentColor: '#c084fc',
  },
];

export function evaluateWarungMiniGame(
  cursorPct: number,
  targetZone: [number, number]
): WarungServeQuality {
  const clamped = Math.max(0, Math.min(100, cursorPct));
  const [minZ, maxZ] = targetZone;
  if (clamped < minZ || clamped > maxZ) {
    return 'biasa';
  }
  const center = (minZ + maxZ) * 0.5;
  const perfectHalfSpan = Math.max(4, (maxZ - minZ) * 0.22);
  if (Math.abs(clamped - center) <= perfectHalfSpan) {
    return 'sempurna';
  }
  return 'mantap';
}

export function consumeWarungSnack(
  state: PlayerProgressState,
  snackId: WarungSnackId,
  quality: WarungServeQuality = 'mantap'
): {
  nextState: PlayerProgressState;
  consumed: boolean;
  hpRecovered: number;
  staminaAddedSec: number;
  fokusAdded: number;
  armorAdded: number;
  quality: WarungServeQuality;
  multiplier: number;
} {
  const snack = WARUNG_SNACKS.find((s) => s.id === snackId);
  if (!snack || state.rupiah < snack.priceRp) {
    return {
      nextState: state,
      consumed: false,
      hpRecovered: 0,
      staminaAddedSec: 0,
      fokusAdded: 0,
      armorAdded: 0,
      quality,
      multiplier: 1,
    };
  }

  const multiplier =
    quality === 'sempurna' ? 1.5 : quality === 'mantap' ? 1.25 : 1.0;

  const rawHpGain = Math.round(snack.hpRestore * multiplier);
  const rawStaminaSec = Math.round(snack.staminaBuffSeconds * multiplier);
  const rawFokusGain = Math.round(snack.fokusRestore * multiplier);
  const rawArmorGain = Math.round(snack.armorRestore * multiplier);

  const nextHp = Math.min(state.maxHp, state.hp + rawHpGain);
  const nextArmor = Math.min(state.maxArmor, state.armor + rawArmorGain);
  const nextFokus = Math.min(100, state.fokusEnergy + rawFokusGain);
  const nextStaminaTimer = Math.min(
    180,
    Math.round((state.staminaBuffTimer || 0) + rawStaminaSec)
  );

  const scoreBonus =
    quality === 'sempurna' ? 150 : quality === 'mantap' ? 100 : 60;
  const repBonus = quality === 'sempurna' ? 2 : 1;
  const nextScore = state.score + scoreBonus;

  const nextState: PlayerProgressState = {
    ...state,
    rupiah: state.rupiah - snack.priceRp,
    hp: nextHp,
    armor: nextArmor,
    fokusEnergy: nextFokus,
    staminaBuffTimer: nextStaminaTimer,
    lastSnackEaten: snack.id,
    score: nextScore,
    bestScore: Math.max(state.bestScore, nextScore),
    reputation: {
      ...state.reputation,
      rakyat: Math.min(100, state.reputation.rakyat + repBonus),
    },
  };

  return {
    nextState,
    consumed: true,
    hpRecovered: rawHpGain,
    staminaAddedSec: rawStaminaSec,
    fokusAdded: rawFokusGain,
    armorAdded: rawArmorGain,
    quality,
    multiplier,
  };
}

export function stepWarungStaminaBuff(
  state: PlayerProgressState,
  dt: number
): PlayerProgressState {
  if (!Number.isFinite(dt) || dt <= 0) return state;
  const currentTimer = state.staminaBuffTimer || 0;
  if (currentTimer <= 0) return state;

  const nextTimer = Math.max(0, currentTimer - dt);
  const extraFokus = !state.fokusActive ? dt * 3.5 : 0;
  const nextFokus = Math.min(100, state.fokusEnergy + extraFokus);

  return {
    ...state,
    staminaBuffTimer: nextTimer,
    fokusEnergy: nextFokus,
  };
}

export function getPlayerStaminaSpeedMultiplier(
  state: PlayerProgressState
): number {
  const skillLevel = state.characterSkills?.stamina ?? 1;
  const skillBonus = Math.max(0, skillLevel - 1) * 0.04;
  const warungBuff = (state.staminaBuffTimer || 0) > 0 ? 0.28 : 0;
  return 1.0 + warungBuff + skillBonus;
}

export function calculateTurfWarsIncome(state: PlayerProgressState): number {
  const turf = state.districtTurf || {};
  let total = 0;
  for (const key of Object.keys(turf)) {
    const item = turf[key];
    if (item && item.owner === 'player') {
      total += item.dividendRp + item.defenseLevel * 6000;
    }
  }
  const negLevel = state.characterSkills?.negotiation ?? 1;
  const mult = 1 + Math.max(0, negLevel - 1) * 0.08;
  return Math.round(total * mult);
}

export const JAKARTA_PROPERTIES: PropertySpec[] = [
  {
    id: 'prop_warung_blokm',
    name: 'Jaringan Warung Pecel Lele Blok M',
    districtName: 'Terminal Blok M',
    price: 150000,
    incomePerTick: 12000,
    description: 'Setoran malam rutin dari 5 tenda kuliner ramai di Melawai.',
  },
  {
    id: 'prop_angkot_tanahabang',
    name: 'Koperasi Angkot & Ojek Tanah Abang',
    districtName: 'Pasar Tanah Abang',
    price: 350000,
    incomePerTick: 28000,
    description: 'Menguasai seluruh trayek mikrolet dan pangkalan kurir pasar.',
  },
  {
    id: 'prop_logistik_priok',
    name: 'Gudang Kontainer Tanjung Priok',
    districtName: 'Pelabuhan Tanjung Priok',
    price: 650000,
    incomePerTick: 55000,
    description: 'Arus bongkar muat kargo internasional di dermaga utara.',
  },
  {
    id: 'prop_penthouse_scbd',
    name: 'Menara Investasi & Helipad SCBD',
    districtName: 'SCBD & Bundaran HI',
    price: 1200000,
    incomePerTick: 110000,
    description: 'Markas konglomerat finansial dengan dividen pasif tertinggi.',
  },
  {
    id: 'prop_marina_ancol',
    name: 'Dermaga Yacht & Klub Pantai Ancol-PIK',
    districtName: 'Pesisir Ancol & PIK',
    price: 1800000,
    incomePerTick: 165000,
    description: 'Pajak dermaga eksklusif dan hiburan malam pesisir utara (Tahap 3).',
  },
  {
    id: 'prop_stasiun_halim',
    name: 'Konsesi Logistik Kereta Cepat Halim',
    districtName: 'Stasiun Terpadu Halim',
    price: 2500000,
    incomePerTick: 240000,
    description: 'Kendali penuh jalur kargo kilat antarkota Jakarta-Bandung (Tahap 3).',
  },
];

export const JAKARTA_STOCKS: StockTickerSpec[] = [
  {
    symbol: 'BNBL',
    name: 'Bank Sentral Nabilo Tbk',
    sector: 'Perbankan & Brankas',
    rivalSymbol: 'SCBD',
    basePrice: 4200,
    sabotageHint: 'Beli saham SCBD sebelum merampok Brankas Bank Sentral untuk profit berlipat!',
  },
  {
    symbol: 'SCBD',
    name: 'SCBD Sovereign Capital',
    sector: 'Konglomerat Finansial',
    rivalSymbol: 'BNBL',
    basePrice: 6800,
    sabotageHint: 'Menyabotase Menara Bursa SCBD akan menjatuhkan SCBD dan melambungkan BNBL.',
  },
  {
    symbol: 'PRIO',
    name: 'Priok Global Kontainer',
    sector: 'Logistik Maritim',
    rivalSymbol: 'HALM',
    basePrice: 3100,
    sabotageHint: 'Menyerbu kargo Tanjung Priok membuat investor beralih ke kereta cepat HALM.',
  },
  {
    symbol: 'HALM',
    name: 'Halim Bullet Express',
    sector: 'Kereta Cepat & Kargo',
    rivalSymbol: 'PRIO',
    basePrice: 5400,
    sabotageHint: 'Naik tajam saat jalur kontainer laut PRIO terganggu aksi bajak.',
  },
  {
    symbol: 'GATO',
    name: 'Gatotkaca Defense Corp',
    sector: 'Alutsista & Rantis',
    rivalSymbol: 'KMYR',
    basePrice: 8900,
    sabotageHint: 'Melonjak saat eskalasi kejaran polisi Bintang 3–5 atau serbuan senjata berat.',
  },
  {
    symbol: 'KMYR',
    name: 'Kemayoran Cyber & Drone',
    sector: 'Teknologi Siber & AI',
    rivalSymbol: 'GATO',
    basePrice: 7500,
    sabotageHint: 'Melonjak saat Heist diselesaikan lewat pendekatan Siluman Siber Kirana.',
  },
];

export function formatRupiah(amount: number): string {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

export function createInitialStockPortfolio(): Record<StockSymbol, StockMarketEntry> {
  const map = {} as Record<StockSymbol, StockMarketEntry>;
  for (const st of JAKARTA_STOCKS) {
    const p = st.basePrice;
    map[st.symbol] = {
      symbol: st.symbol,
      currentPrice: p,
      previousPrice: Math.round(p * 0.98),
      history: [
        Math.round(p * 0.94),
        Math.round(p * 0.96),
        Math.round(p * 0.95),
        Math.round(p * 0.99),
        Math.round(p * 0.97),
        Math.round(p * 1.01),
        Math.round(p * 0.98),
        p,
      ],
      ownedShares: 0,
      avgBuyPrice: 0,
    };
  }
  return map;
}

export function calculatePassivePropertyIncome(ownedPropertyIds: string[]): number {
  let total = 0;
  for (const id of ownedPropertyIds) {
    const prop = JAKARTA_PROPERTIES.find((p) => p.id === id);
    if (prop) total += prop.incomePerTick;
  }
  return total;
}

export function purchaseProperty(
  state: PlayerProgressState,
  propertyId: string
): { nextState: PlayerProgressState; purchased: boolean } {
  if (state.ownedProperties.includes(propertyId)) {
    return { nextState: state, purchased: false };
  }
  const prop = JAKARTA_PROPERTIES.find((p) => p.id === propertyId);
  if (!prop || state.rupiah < prop.price) {
    return { nextState: state, purchased: false };
  }
  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - prop.price,
      ownedProperties: [...state.ownedProperties, propertyId],
      score: state.score + 250,
      bestScore: Math.max(state.bestScore, state.score + 250),
    },
    purchased: true,
  };
}

export function buyStockShares(
  state: PlayerProgressState,
  symbol: StockSymbol,
  sharesToBuy: number
): { nextState: PlayerProgressState; bought: boolean } {
  const entry = state.stockPortfolio[symbol];
  if (!entry || sharesToBuy <= 0) return { nextState: state, bought: false };
  const totalCost = entry.currentPrice * sharesToBuy;
  if (state.rupiah < totalCost) return { nextState: state, bought: false };

  const newTotalShares = entry.ownedShares + sharesToBuy;
  const newAvgPrice = Math.round(
    (entry.ownedShares * entry.avgBuyPrice + totalCost) / newTotalShares
  );

  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - totalCost,
      stockPortfolio: {
        ...state.stockPortfolio,
        [symbol]: {
          ...entry,
          ownedShares: newTotalShares,
          avgBuyPrice: newAvgPrice,
        },
      },
    },
    bought: true,
  };
}

export function sellStockShares(
  state: PlayerProgressState,
  symbol: StockSymbol,
  sharesToSell: number
): { nextState: PlayerProgressState; sold: boolean; proceedsRp: number } {
  const entry = state.stockPortfolio[symbol];
  if (!entry || sharesToSell <= 0 || entry.ownedShares < sharesToSell) {
    return { nextState: state, sold: false, proceedsRp: 0 };
  }
  const proceedsRp = entry.currentPrice * sharesToSell;
  const remaining = entry.ownedShares - sharesToSell;

  return {
    nextState: {
      ...state,
      rupiah: state.rupiah + proceedsRp,
      stockPortfolio: {
        ...state.stockPortfolio,
        [symbol]: {
          ...entry,
          ownedShares: remaining,
          avgBuyPrice: remaining === 0 ? 0 : entry.avgBuyPrice,
        },
      },
    },
    sold: true,
    proceedsRp,
  };
}

export function triggerStockMarketImpact(
  state: PlayerProgressState,
  victimSymbol: StockSymbol,
  boostSymbol: StockSymbol,
  dropPercent: number = 0.22,
  boostPercent: number = 0.28
): PlayerProgressState {
  const nextPortfolio = { ...state.stockPortfolio };

  const victim = nextPortfolio[victimSymbol];
  if (victim) {
    const nextPrice = Math.max(400, Math.round(victim.currentPrice * (1 - dropPercent)));
    nextPortfolio[victimSymbol] = {
      ...victim,
      previousPrice: victim.currentPrice,
      currentPrice: nextPrice,
      history: [...victim.history.slice(1), nextPrice],
    };
  }

  const boost = nextPortfolio[boostSymbol];
  if (boost) {
    const nextPrice = Math.round(boost.currentPrice * (1 + boostPercent));
    nextPortfolio[boostSymbol] = {
      ...boost,
      previousPrice: boost.currentPrice,
      currentPrice: nextPrice,
      history: [...boost.history.slice(1), nextPrice],
    };
  }

  return {
    ...state,
    stockPortfolio: nextPortfolio,
  };
}

export function stepStockMarketTick(state: PlayerProgressState): PlayerProgressState {
  const nextPortfolio = { ...state.stockPortfolio };
  for (const spec of JAKARTA_STOCKS) {
    const item = nextPortfolio[spec.symbol];
    if (!item) continue;
    let bias = 0;
    if (spec.symbol === 'GATO' && state.wantedLevel >= 3) bias = 0.035;
    if (spec.symbol === 'KMYR' && state.droneActive) bias = 0.02;

    const deltaPct = (Math.random() - 0.485 + bias) * 0.045;
    const nextPrice = Math.max(
      500,
      Math.round(item.currentPrice * (1 + deltaPct))
    );
    nextPortfolio[spec.symbol] = {
      ...item,
      previousPrice: item.currentPrice,
      currentPrice: nextPrice,
      history: [...item.history.slice(1), nextPrice],
    };
  }
  return {
    ...state,
    stockPortfolio: nextPortfolio,
  };
}

// ============================================================================
// PHASE C: SYSTEMIC ECONOMY (TURF WAR × BUSINESS × BAJSA STOCK MARKET)
// ============================================================================

export const JAKARTA_BUSINESSES: BusinessSpec[] = [
  {
    id: 'biz_bengkel_modif',
    name: 'Bengkel Modifikasi Blok M & Kemang',
    districtId: 'blok_m',
    basePrice: 220000,
    upgradeCost: 110000,
    baseIncomePerHour: 24000,
    linkedStock: 'GATO',
    rivalStock: 'KMYR',
    description: 'Jaringan bengkel kustomisasi sasis tempur dan penyamaran pelat nomor jalanan.',
  },
  {
    id: 'biz_armada_ojol',
    name: 'Armada Ojol Bayangan Tanah Abang',
    districtId: 'tanah_abang',
    basePrice: 320000,
    upgradeCost: 160000,
    baseIncomePerHour: 36000,
    linkedStock: 'HALM',
    rivalStock: 'PRIO',
    description: 'Jaringan kurir motor cepat untuk distribusi logistik bawah tanah lintas distrik.',
  },
  {
    id: 'biz_gudang_priok',
    name: 'Gudang Kontainer Bayangan Tanjung Priok',
    districtId: 'priok',
    basePrice: 540000,
    upgradeCost: 250000,
    baseIncomePerHour: 64000,
    linkedStock: 'PRIO',
    rivalStock: 'HALM',
    description: 'Terminal penyelundupan kontainer maritim dan speedboat Teluk Jakarta.',
  },
  {
    id: 'biz_server_glodok',
    name: 'Server Farm & Siber Glodok Underground',
    districtId: 'glodok',
    basePrice: 680000,
    upgradeCost: 310000,
    baseIncomePerHour: 82000,
    linkedStock: 'KMYR',
    rivalStock: 'SCBD',
    description: 'Pusat penambangan data siber Kirana dan manipulasi frekuensi bursa BAJSA.',
  },
];

export const DISTRICT_STOCK_LINK_MAP: Record<
  DistrictId,
  { victimSymbol: StockSymbol; boostSymbol: StockSymbol; sectorLabel: string }
> = {
  scbd: { victimSymbol: 'SCBD', boostSymbol: 'BNBL', sectorLabel: 'Koridor Finansial SCBD' },
  monas: { victimSymbol: 'BNBL', boostSymbol: 'SCBD', sectorLabel: 'Lingkar Monas & Bank Sentral' },
  blok_m: { victimSymbol: 'HALM', boostSymbol: 'GATO', sectorLabel: 'Terminal Blok M' },
  kota_tua: { victimSymbol: 'BNBL', boostSymbol: 'KMYR', sectorLabel: 'Kawasan Kota Tua' },
  glodok: { victimSymbol: 'SCBD', boostSymbol: 'KMYR', sectorLabel: 'Sentra Elektronik Glodok' },
  tanah_abang: { victimSymbol: 'PRIO', boostSymbol: 'HALM', sectorLabel: 'Grosir Tanah Abang' },
  kemayoran: { victimSymbol: 'GATO', boostSymbol: 'KMYR', sectorLabel: 'Bandara Lama Kemayoran' },
  senayan: { victimSymbol: 'SCBD', boostSymbol: 'GATO', sectorLabel: 'Kompleks Gelora Senayan' },
  priok: { victimSymbol: 'PRIO', boostSymbol: 'HALM', sectorLabel: 'Pelabuhan Tanjung Priok' },
  pik_ancol: { victimSymbol: 'SCBD', boostSymbol: 'PRIO', sectorLabel: 'Pesisir Ancol & PIK' },
  manggarai: { victimSymbol: 'HALM', boostSymbol: 'PRIO', sectorLabel: 'Simpul Rel Manggarai' },
  kemang: { victimSymbol: 'BNBL', boostSymbol: 'SCBD', sectorLabel: 'Hiburan Malam Kemang' },
  halim: { victimSymbol: 'HALM', boostSymbol: 'PRIO', sectorLabel: 'Stasiun Kereta Cepat Halim' },
};

/**
 * Purchases a business (level 1) or upgrades an owned business up to level 5.
 */
export function purchaseOrUpgradeBusiness(
  state: PlayerProgressState,
  businessId: BusinessId
): {
  nextState: PlayerProgressState;
  success: boolean;
  newLevel: number;
  costRp: number;
} {
  const spec = JAKARTA_BUSINESSES.find((b) => b.id === businessId);
  if (!spec) {
    return { nextState: state, success: false, newLevel: 0, costRp: 0 };
  }

  const owned = { ...(state.ownedBusinesses || {}) };
  const currentLevel = owned[businessId] || 0;
  if (currentLevel >= 5) {
    return { nextState: state, success: false, newLevel: currentLevel, costRp: 0 };
  }

  const costRp = currentLevel === 0 ? spec.basePrice : spec.upgradeCost * currentLevel;
  if (state.rupiah < costRp) {
    return { nextState: state, success: false, newLevel: currentLevel, costRp };
  }

  const newLevel = currentLevel + 1;
  owned[businessId] = newLevel;

  return {
    nextState: {
      ...state,
      rupiah: state.rupiah - costRp,
      ownedBusinesses: owned,
      score: state.score + 300,
      bestScore: Math.max(state.bestScore, state.score + 300),
    },
    success: true,
    newLevel,
    costRp,
  };
}

/**
 * Calculates hourly passive income across all owned Jakarta underground businesses.
 */
export function calculatePassiveBusinessIncome(
  ownedBusinesses: Partial<Record<BusinessId, number>> | undefined,
  negotiationLevel: number = 1
): number {
  if (!ownedBusinesses) return 0;
  let total = 0;
  for (const spec of JAKARTA_BUSINESSES) {
    const level = ownedBusinesses[spec.id] || 0;
    if (level > 0) {
      const levelMultiplier = 1 + (level - 1) * 0.45;
      total += Math.round(spec.baseIncomePerHour * levelMultiplier);
    }
  }
  const negBonus = 1 + Math.max(0, negotiationLevel - 1) * 0.08;
  return Math.round(total * negBonus);
}

/**
 * Executes a corporate sabotage operation from an owned business, crashing its rival BAJSA ticker
 * and boosting the business's linked ticker while generating a breaking financial news headline.
 */
export function executeBusinessSabotage(
  state: PlayerProgressState,
  businessId: BusinessId,
  timestampLabel: string = '12:00 WIB'
): {
  nextState: PlayerProgressState;
  executed: boolean;
  news: FinancialNewsItem | null;
} {
  const spec = JAKARTA_BUSINESSES.find((b) => b.id === businessId);
  const level = state.ownedBusinesses?.[businessId] || 0;
  if (!spec || level <= 0) {
    return { nextState: state, executed: false, news: null };
  }

  const dropPct = Math.min(0.42, 0.18 + level * 0.04);
  const boostPct = Math.min(0.48, 0.22 + level * 0.045);
  const shockedState = triggerStockMarketImpact(
    state,
    spec.rivalStock,
    spec.linkedStock,
    dropPct,
    boostPct
  );

  const news: FinancialNewsItem = {
    id: `news_sab_${businessId}_${Date.now()}`,
    headline: `SABOTASE BISNIS: Operasi ${spec.name} mengguncang rantai pasok ${spec.rivalStock} (-${Math.round(
      dropPct * 100
    )}%) & melambungkan ${spec.linkedStock} (+${Math.round(boostPct * 100)}%)!`,
    affectedSymbol: spec.rivalStock,
    deltaPct: -Math.round(dropPct * 100),
    timestampLabel,
  };

  return {
    nextState: shockedState,
    executed: true,
    news,
  };
}

/**
 * Links district turf war captures directly to live BAJSA stock prices.
 */
export function applyTurfWarStockShock(
  state: PlayerProgressState,
  districtId: DistrictId,
  timestampLabel: string = '12:00 WIB'
): {
  nextState: PlayerProgressState;
  news: FinancialNewsItem;
} {
  const link = DISTRICT_STOCK_LINK_MAP[districtId] || {
    victimSymbol: 'SCBD' as StockSymbol,
    boostSymbol: 'BNBL' as StockSymbol,
    sectorLabel: districtId.toUpperCase(),
  };

  const dropPct = 0.19;
  const boostPct = 0.24;
  const nextState = triggerStockMarketImpact(
    state,
    link.victimSymbol,
    link.boostSymbol,
    dropPct,
    boostPct
  );

  const news: FinancialNewsItem = {
    id: `news_turf_${districtId}_${Date.now()}`,
    headline: `BURSA BAJSA: Perebutan wilayah ${link.sectorLabel} menekan saham ${link.victimSymbol} (-19%) & mengangkat ${link.boostSymbol} (+24%).`,
    affectedSymbol: link.victimSymbol,
    deltaPct: -19,
    timestampLabel,
  };

  return { nextState, news };
}

/**
 * Links dynamic Jakarta World Clock road events to live BAJSA stock tickers.
 */
export function applyRoadEventStockShock(
  state: PlayerProgressState,
  eventKind: WorldClockRoadEventKind,
  timestampLabel: string = '12:00 WIB'
): {
  nextState: PlayerProgressState;
  news: FinancialNewsItem | null;
} {
  if (eventKind === 'none') {
    return { nextState: state, news: null };
  }

  let victim: StockSymbol = 'PRIO';
  let boost: StockSymbol = 'HALM';
  let headline = '';
  let dropPct = 0.12;
  let boostPct = 0.15;

  switch (eventKind) {
    case 'rush_hour_pagi':
    case 'macet_sore':
      victim = 'PRIO';
      boost = 'HALM';
      dropPct = 0.11;
      boostPct = 0.14;
      headline = `LALU LINTAS & BURSA: Kemacetan arteri Jakarta menghambat truk kontainer PRIO (-11%), investor beralih ke kereta cepat HALM (+14%).`;
      break;
    case 'konvoi_pejabat':
      victim = 'KMYR';
      boost = 'GATO';
      dropPct = 0.1;
      boostPct = 0.16;
      headline = `KEAMANAN PROTOKOL: Konvoi VVIP meningkatkan kontrak rantis GATO (+16%).`;
      break;
    case 'pasar_tumpah':
      victim = 'SCBD';
      boost = 'BNBL';
      dropPct = 0.09;
      boostPct = 0.13;
      headline = `EKONOMI JALANAN: Lonjakan transaksi tunai pasar tumpah mendongkrak likuiditas ritel BNBL (+13%).`;
      break;
    case 'razia_malam':
      victim = 'PRIO';
      boost = 'GATO';
      dropPct = 0.14;
      boostPct = 0.18;
      headline = `RAZIA GABUNGAN: Penyekatan jalan protokol memicu kenaikan saham alutsista GATO (+18%).`;
      break;
  }

  const nextState = triggerStockMarketImpact(state, victim, boost, dropPct, boostPct);
  return {
    nextState,
    news: {
      id: `news_event_${eventKind}_${Date.now()}`,
      headline,
      affectedSymbol: boost,
      deltaPct: Math.round(boostPct * 100),
      timestampLabel,
    },
  };
}

/**
 * Mean-reverting BAJSA stock recovery step: nudges shocked stocks smoothly back toward their fundamental basePrice
 * so players can buy the dip after sabotage/turf wars and profit as the market recovers.
 */
export function stepStockMarketMeanReversion(
  state: PlayerProgressState,
  reversionRate: number = 0.18
): PlayerProgressState {
  const clampedRate = Math.max(0.02, Math.min(0.6, reversionRate));
  const nextPortfolio = { ...state.stockPortfolio };

  for (const spec of JAKARTA_STOCKS) {
    const entry = nextPortfolio[spec.symbol];
    if (!entry) continue;
    const diff = spec.basePrice - entry.currentPrice;
    const stepDelta = Math.round(diff * clampedRate);
    const nextPrice = Math.max(400, entry.currentPrice + stepDelta);
    nextPortfolio[spec.symbol] = {
      ...entry,
      previousPrice: entry.currentPrice,
      currentPrice: nextPrice,
      history: [...entry.history.slice(1), nextPrice],
    };
  }

  return {
    ...state,
    stockPortfolio: nextPortfolio,
  };
}

export interface PortfolioMetrics {
  totalMarketValueRp: number;
  totalCostBasisRp: number;
  unrealizedPnLRp: number;
  unrealizedPnLPct: number;
}

/**
 * Computes real-time portfolio valuation and unrealized profit/loss across all BAJSA holdings.
 */
export function calculatePortfolioMetrics(
  portfolio: Record<StockSymbol, StockMarketEntry>
): PortfolioMetrics {
  let totalMarketValueRp = 0;
  let totalCostBasisRp = 0;

  for (const spec of JAKARTA_STOCKS) {
    const entry = portfolio[spec.symbol];
    if (!entry || entry.ownedShares <= 0) continue;
    totalMarketValueRp += entry.ownedShares * entry.currentPrice;
    totalCostBasisRp += entry.ownedShares * entry.avgBuyPrice;
  }

  const unrealizedPnLRp = totalMarketValueRp - totalCostBasisRp;
  const unrealizedPnLPct =
    totalCostBasisRp > 0
      ? Math.round((unrealizedPnLRp / totalCostBasisRp) * 1000) / 10
      : 0;

  return {
    totalMarketValueRp,
    totalCostBasisRp,
    unrealizedPnLRp,
    unrealizedPnLPct,
  };
}

/**
 * Links high-intensity Wanted police lockdowns (★3–★5) in a district to live BAJSA stock prices,
 * depressing local commercial activity while boosting tactical security contractor GATO.
 */
export function applyWantedHeatStockShock(
  state: PlayerProgressState,
  districtId: DistrictId,
  wantedLevel: number,
  timestampLabel: string = '12:00 WIB'
): {
  nextState: PlayerProgressState;
  shocked: boolean;
  news: FinancialNewsItem | null;
} {
  const clampedWanted = Math.max(0, Math.min(5, Math.floor(wantedLevel)));
  if (clampedWanted < 3) {
    return { nextState: state, shocked: false, news: null };
  }

  const link = DISTRICT_STOCK_LINK_MAP[districtId] || {
    victimSymbol: 'SCBD' as StockSymbol,
    boostSymbol: 'GATO' as StockSymbol,
    sectorLabel: districtId.toUpperCase(),
  };

  const victimSymbol: StockSymbol =
    link.victimSymbol === 'GATO' ? 'SCBD' : link.victimSymbol;
  const boostSymbol: StockSymbol = 'GATO';
  const dropPct = Number((0.06 + (clampedWanted - 2) * 0.04).toFixed(2));
  const boostPct = Number((0.08 + (clampedWanted - 2) * 0.05).toFixed(2));

  const nextState = triggerStockMarketImpact(
    state,
    victimSymbol,
    boostSymbol,
    dropPct,
    boostPct
  );

  const news: FinancialNewsItem = {
    id: `news_wanted_${districtId}_${clampedWanted}_${Date.now()}`,
    headline: `SIAGA KEAMANAN ★${clampedWanted}: Penyekatan aparat di ${link.sectorLabel} menekan saham ${victimSymbol} (-${Math.round(
      dropPct * 100
    )}%) & melambungkan kontrak pertahanan ${boostSymbol} (+${Math.round(
      boostPct * 100
    )}%).`,
    affectedSymbol: victimSymbol,
    deltaPct: -Math.round(dropPct * 100),
    timestampLabel,
  };

  return {
    nextState,
    shocked: true,
    news,
  };
}



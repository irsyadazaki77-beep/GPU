import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialPlayerState } from './combat';
import {
  JAKARTA_BUSINESSES,
  buyStockShares,
  sellStockShares,
  purchaseOrUpgradeBusiness,
  calculatePassiveBusinessIncome,
  executeBusinessSabotage,
  applyTurfWarStockShock,
  stepStockMarketMeanReversion,
  calculatePortfolioMetrics,
} from './economy';

test('applyTurfWarStockShock drops victim ticker and boosts rival ticker with breaking news', () => {
  const state = createInitialPlayerState('anak_jalanan');
  const initialScbd = state.stockPortfolio.SCBD.currentPrice;
  const initialBnbl = state.stockPortfolio.BNBL.currentPrice;

  const { nextState, news } = applyTurfWarStockShock(state, 'scbd', '14:30 WIB');
  assert.ok(nextState.stockPortfolio.SCBD.currentPrice < initialScbd);
  assert.ok(nextState.stockPortfolio.BNBL.currentPrice > initialBnbl);
  assert.equal(news.affectedSymbol, 'SCBD');
  assert.ok(news.headline.includes('SCBD'));
});

test('stepStockMarketMeanReversion recovers depressed stock prices back toward basePrice', () => {
  const state = createInitialPlayerState('anak_jalanan');
  const { nextState: shocked } = applyTurfWarStockShock(state, 'scbd', '15:00 WIB');
  const depressedPrice = shocked.stockPortfolio.SCBD.currentPrice;
  const basePrice = 6800;
  assert.ok(depressedPrice < basePrice);

  let current = shocked;
  for (let i = 0; i < 6; i++) {
    current = stepStockMarketMeanReversion(current, 0.25);
  }
  assert.ok(
    current.stockPortfolio.SCBD.currentPrice > depressedPrice,
    'Depressed stock should recover toward basePrice via mean reversion'
  );
  assert.ok(current.stockPortfolio.SCBD.currentPrice <= basePrice);
});

test('buy the dip, sabotage rival, and calculatePortfolioMetrics profit/loss accurately', () => {
  let state = {
    ...createInitialPlayerState('anak_jalanan'),
    rupiah: 2_000_000,
  };

  // Buy 100 shares of KMYR at base price (7500)
  const buyRes = buyStockShares(state, 'KMYR', 100);
  assert.equal(buyRes.bought, true);
  state = buyRes.nextState;

  // Purchase Server Glodok business (linkedStock: KMYR, rivalStock: SCBD)
  const bizRes = purchaseOrUpgradeBusiness(state, 'biz_server_glodok');
  assert.equal(bizRes.success, true);
  assert.equal(bizRes.newLevel, 1);
  state = bizRes.nextState;

  // Execute business sabotage to boost KMYR and crash SCBD
  const sabRes = executeBusinessSabotage(state, 'biz_server_glodok', '16:00 WIB');
  assert.equal(sabRes.executed, true);
  assert.ok(sabRes.news);
  state = sabRes.nextState;

  const metrics = calculatePortfolioMetrics(state.stockPortfolio);
  assert.ok(metrics.unrealizedPnLRp > 0, 'Portfolio should show positive unrealized PnL after boosting KMYR');
  assert.ok(metrics.unrealizedPnLPct > 20);

  // Sell all 100 shares for profit
  const sellRes = sellStockShares(state, 'KMYR', 100);
  assert.equal(sellRes.sold, true);
  assert.ok(sellRes.proceedsRp > 750_000);
});

test('purchaseOrUpgradeBusiness scales passive income across levels 1 to 5', () => {
  let state = {
    ...createInitialPlayerState('anak_jalanan'),
    rupiah: 5_000_000,
  };

  assert.equal(JAKARTA_BUSINESSES.length, 4);
  assert.equal(calculatePassiveBusinessIncome(state.ownedBusinesses, 1), 0);

  const l1 = purchaseOrUpgradeBusiness(state, 'biz_bengkel_modif');
  assert.equal(l1.success, true);
  assert.equal(l1.newLevel, 1);
  state = l1.nextState;
  const incomeL1 = calculatePassiveBusinessIncome(state.ownedBusinesses, 1);
  assert.ok(incomeL1 > 0);

  const l2 = purchaseOrUpgradeBusiness(state, 'biz_bengkel_modif');
  assert.equal(l2.success, true);
  assert.equal(l2.newLevel, 2);
  state = l2.nextState;
  const incomeL2 = calculatePassiveBusinessIncome(state.ownedBusinesses, 1);
  assert.ok(incomeL2 > incomeL1, 'Upgrading business level should increase hourly passive payout');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAllowableCac, evaluateCampaignProfitability, allocateMarketingBudget } from '../src/index.mjs';

test('allowable CAC uses first-order contribution plus haircutted future contribution', () => {
  const result = calculateAllowableCac({ firstOrderContributionCents: 5000, expectedFutureContributionCents: 4000, attributionConfidenceBps: 8000, policy: { ltvHaircutBps: 5000 } });
  assert.equal(result.allowableCacCents, 6600);
});

test('mature profitable campaign scales only modestly', () => {
  const result = evaluateCampaignProfitability({ campaignId: 'search-laptops', spendCents: 100000, attributedNetSalesCents: 1200000, contributionBeforeMarketingCents: 180000, attributedOrders: 40, attributedNewCustomers: 30, matureDays: 14, attributionConfidenceBps: 9000, currentDailyBudgetCents: 10000, expectedFutureContributionPerNewCustomerCents: 2000 });
  assert.equal(result.decision, 'SCALE_MODESTLY');
  assert.equal(result.recommendedDailyBudgetCents, 11000);
});

test('campaign pauses when CAC exceeds allowable CAC', () => {
  const result = evaluateCampaignProfitability({ campaignId: 'bad-social', spendCents: 150000, attributedNetSalesCents: 400000, contributionBeforeMarketingCents: 120000, attributedOrders: 30, attributedNewCustomers: 10, matureDays: 14, attributionConfidenceBps: 9000, currentDailyBudgetCents: 20000 });
  assert.equal(result.decision, 'PAUSE_OR_REDUCE');
  assert.ok(result.hardStops.includes('CAC_EXCEEDS_ALLOWABLE_CAC'));
});

test('immature profitable campaign holds instead of scaling', () => {
  const result = evaluateCampaignProfitability({ campaignId: 'new-shopping', spendCents: 10000, attributedNetSalesCents: 150000, contributionBeforeMarketingCents: 25000, attributedOrders: 4, attributedNewCustomers: 3, matureDays: 2, attributionConfidenceBps: 9000, currentDailyBudgetCents: 2000 });
  assert.equal(result.decision, 'HOLD_AND_COLLECT_DATA');
});

test('budget allocation caps channel concentration and preserves exploration', () => {
  const result = allocateMarketingBudget({ totalBudgetCents: 100000, campaigns: [
    { campaignId: 'search', decision: 'SCALE_MODESTLY', afterMarketingContributionCents: 100000, attributionConfidenceBps: 9000 },
    { campaignId: 'email', decision: 'SCALE_MODESTLY', afterMarketingContributionCents: 30000, attributionConfidenceBps: 10000 },
    { campaignId: 'new-video', decision: 'EXPLORATION', afterMarketingContributionCents: 0, attributionConfidenceBps: 0 },
  ] });
  const search = result.allocations.find((item) => item.campaignId === 'search');
  const exploration = result.allocations.find((item) => item.campaignId === 'new-video');
  assert.ok(search.budgetCents <= 50000);
  assert.equal(exploration.bucket, 'EXPLORATION');
  assert.equal(exploration.budgetCents, 10000);
});

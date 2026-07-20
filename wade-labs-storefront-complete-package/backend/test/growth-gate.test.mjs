import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateGrowthReadiness } from '../src/index.mjs';

const healthy = {
  trailingContributionCents: 300000, afterMarketingMarginBps: 500,
  fulfillmentOnTimeBps: 9800, cancellationRateBps: 200, returnRateBps: 500,
  chargebackRateBps: 50, supportBacklog: 10, p95PageLoadMs: 1800,
  inventoryFreshnessBps: 9950, cashCoverageDays: 30, stableWeeks: 4,
  currentWeeklyRevenueCents: 1000000,
};

test('healthy business expands weekly revenue by no more than policy cap', () => {
  const result = evaluateGrowthReadiness(healthy);
  assert.equal(result.decision, 'EXPAND_MODESTLY');
  assert.equal(result.maximumNextWeeklyRevenueCents, 1100000);
});

test('low cash coverage freezes growth', () => {
  const result = evaluateGrowthReadiness({ ...healthy, cashCoverageDays: 5 });
  assert.equal(result.decision, 'FREEZE_AND_REPAIR');
  assert.ok(result.blockers.includes('CASH_COVERAGE_BELOW_GATE'));
});

test('support overload freezes growth even when revenue is profitable', () => {
  const result = evaluateGrowthReadiness({ ...healthy, supportBacklog: 100 });
  assert.equal(result.decision, 'FREEZE_AND_REPAIR');
  assert.ok(result.blockers.includes('SUPPORT_CAPACITY_EXCEEDED'));
});

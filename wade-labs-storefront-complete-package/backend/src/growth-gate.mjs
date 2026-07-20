import { assertBps, assertIntegerCents } from './money.mjs';

const DEFAULT_POLICY = Object.freeze({
  minimumTrailingContributionCents: 100_000,
  minimumAfterMarketingMarginBps: 300,
  minimumFulfillmentOnTimeBps: 9500,
  maximumCancellationRateBps: 500,
  maximumReturnRateBps: 800,
  maximumChargebackRateBps: 100,
  maximumSupportBacklog: 25,
  maximumP95PageLoadMs: 2500,
  minimumInventoryFreshnessBps: 9800,
  minimumCashCoverageDays: 14,
  maximumWeeklyRevenueGrowthBps: 1000,
  minimumStableWeeks: 2,
});

function normalizePolicy(policy = {}) {
  const merged = { ...DEFAULT_POLICY, ...policy };
  for (const key of [
    'minimumAfterMarketingMarginBps','minimumFulfillmentOnTimeBps','maximumCancellationRateBps',
    'maximumReturnRateBps','maximumChargebackRateBps','minimumInventoryFreshnessBps','maximumWeeklyRevenueGrowthBps',
  ]) assertBps(merged[key], key);
  for (const key of ['maximumSupportBacklog','maximumP95PageLoadMs','minimumCashCoverageDays','minimumStableWeeks']) {
    if (!Number.isSafeInteger(merged[key]) || merged[key] < 0) throw new TypeError(`${key} must be a non-negative safe integer`);
  }
  assertIntegerCents(merged.minimumTrailingContributionCents, 'minimumTrailingContributionCents');
  return merged;
}

export function evaluateGrowthReadiness(input) {
  const {
    trailingContributionCents, afterMarketingMarginBps, fulfillmentOnTimeBps,
    cancellationRateBps, returnRateBps, chargebackRateBps, supportBacklog,
    p95PageLoadMs, inventoryFreshnessBps, cashCoverageDays, stableWeeks,
    currentWeeklyRevenueCents, policy: policyInput = {},
  } = input;
  assertIntegerCents(trailingContributionCents, 'trailingContributionCents');
  assertIntegerCents(currentWeeklyRevenueCents, 'currentWeeklyRevenueCents');
  for (const [key, value] of Object.entries({
    afterMarketingMarginBps, fulfillmentOnTimeBps, cancellationRateBps,
    returnRateBps, chargebackRateBps, inventoryFreshnessBps,
  })) assertBps(value, key);
  for (const [key, value] of Object.entries({ supportBacklog, p95PageLoadMs, cashCoverageDays, stableWeeks })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${key} must be a non-negative safe integer`);
  }
  const policy = normalizePolicy(policyInput);
  const blockers = [];
  const warnings = [];
  if (trailingContributionCents < policy.minimumTrailingContributionCents) blockers.push('TRAILING_CONTRIBUTION_BELOW_GATE');
  if (afterMarketingMarginBps < policy.minimumAfterMarketingMarginBps) blockers.push('AFTER_MARKETING_MARGIN_BELOW_GATE');
  if (fulfillmentOnTimeBps < policy.minimumFulfillmentOnTimeBps) blockers.push('FULFILLMENT_SLA_BELOW_GATE');
  if (cancellationRateBps > policy.maximumCancellationRateBps) blockers.push('CANCELLATION_RATE_ABOVE_GATE');
  if (returnRateBps > policy.maximumReturnRateBps) blockers.push('RETURN_RATE_ABOVE_GATE');
  if (chargebackRateBps > policy.maximumChargebackRateBps) blockers.push('CHARGEBACK_RATE_ABOVE_GATE');
  if (supportBacklog > policy.maximumSupportBacklog) blockers.push('SUPPORT_CAPACITY_EXCEEDED');
  if (p95PageLoadMs > policy.maximumP95PageLoadMs) warnings.push('SITE_PERFORMANCE_DEGRADED');
  if (inventoryFreshnessBps < policy.minimumInventoryFreshnessBps) blockers.push('INVENTORY_FRESHNESS_BELOW_GATE');
  if (cashCoverageDays < policy.minimumCashCoverageDays) blockers.push('CASH_COVERAGE_BELOW_GATE');
  if (stableWeeks < policy.minimumStableWeeks) warnings.push('INSUFFICIENT_STABLE_WEEKS');
  let decision = 'HOLD';
  let maximumNextWeeklyRevenueCents = currentWeeklyRevenueCents;
  if (blockers.length === 0 && warnings.length === 0) {
    decision = 'EXPAND_MODESTLY';
    maximumNextWeeklyRevenueCents = currentWeeklyRevenueCents + (currentWeeklyRevenueCents * BigInt(policy.maximumWeeklyRevenueGrowthBps) / 10000n);
  } else if (blockers.length > 0) {
    decision = 'FREEZE_AND_REPAIR';
  }
  return { decision, blockers, warnings, currentWeeklyRevenueCents, maximumNextWeeklyRevenueCents, maximumWeeklyRevenueGrowthBps: policy.maximumWeeklyRevenueGrowthBps };
}

import { assertBps, assertIntegerCents, applyBpsCeil } from './money.mjs';

const DEFAULT_POLICY = Object.freeze({
  minimumMatureOrders: 20,
  minimumMatureDays: 7,
  minimumAttributionConfidenceBps: 7000,
  minimumAfterMarketingContributionCents: 0,
  minimumAfterMarketingMarginBps: 300,
  maximumBudgetIncreaseBps: 1000,
  maximumBudgetDecreaseBps: 2500,
  ltvHaircutBps: 5000,
  maximumRefundRateBps: 800,
  maximumChargebackRateBps: 100,
  maximumCancellationRateBps: 500,
  maximumSingleChannelShareBps: 5000,
  explorationBudgetBps: 1000,
});

function normalizePolicy(policy = {}) {
  const merged = { ...DEFAULT_POLICY, ...policy };
  for (const key of [
    'minimumAttributionConfidenceBps','minimumAfterMarketingMarginBps',
    'maximumBudgetIncreaseBps','maximumBudgetDecreaseBps','ltvHaircutBps',
    'maximumRefundRateBps','maximumChargebackRateBps','maximumCancellationRateBps',
    'maximumSingleChannelShareBps','explorationBudgetBps',
  ]) assertBps(merged[key], key);
  for (const key of ['minimumMatureOrders','minimumMatureDays']) {
    if (!Number.isSafeInteger(merged[key]) || merged[key] < 0) {
      throw new TypeError(`${key} must be a non-negative safe integer`);
    }
  }
  assertIntegerCents(merged.minimumAfterMarketingContributionCents, 'minimumAfterMarketingContributionCents');
  return merged;
}

function safeRateBps(numerator, denominator) {
  if (denominator <= 0) return 0;
  return Math.floor((numerator * 10_000) / denominator);
}

export function calculateAllowableCac({
  firstOrderContributionCents,
  expectedFutureContributionCents = 0,
  attributionConfidenceBps = 10_000,
  policy: policyInput = {},
}) {
  assertIntegerCents(firstOrderContributionCents, 'firstOrderContributionCents');
  assertIntegerCents(expectedFutureContributionCents, 'expectedFutureContributionCents');
  assertBps(attributionConfidenceBps, 'attributionConfidenceBps');
  const policy = normalizePolicy(policyInput);
  const futureContributionAfterHaircut = Math.floor(
    (expectedFutureContributionCents * policy.ltvHaircutBps * attributionConfidenceBps) / 100_000_000,
  );
  return {
    allowableCacCents: firstOrderContributionCents + futureContributionAfterHaircut,
    firstOrderContributionCents,
    expectedFutureContributionCents,
    futureContributionAfterHaircut,
    ltvHaircutBps: policy.ltvHaircutBps,
    attributionConfidenceBps,
  };
}

export function evaluateCampaignProfitability(input) {
  const {
    campaignId, spendCents, attributedNetSalesCents, contributionBeforeMarketingCents,
    attributedOrders, attributedNewCustomers, matureDays, attributionConfidenceBps,
    refundsCents = 0, cancellations = 0, chargebacks = 0,
    expectedFutureContributionPerNewCustomerCents = 0, currentDailyBudgetCents,
    policy: policyInput = {},
  } = input;
  for (const [key, value] of Object.entries({
    spendCents, attributedNetSalesCents, contributionBeforeMarketingCents, refundsCents,
    expectedFutureContributionPerNewCustomerCents, currentDailyBudgetCents,
  })) assertIntegerCents(value, key);
  for (const [key, value] of Object.entries({
    attributedOrders, attributedNewCustomers, matureDays, cancellations, chargebacks,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`${key} must be a non-negative safe integer`);
  }
  assertBps(attributionConfidenceBps, 'attributionConfidenceBps');
  const policy = normalizePolicy(policyInput);
  const adjustedContributionBeforeMarketingCents = Math.max(0, contributionBeforeMarketingCents - refundsCents);
  const afterMarketingContributionCents = adjustedContributionBeforeMarketingCents - spendCents;
  const afterMarketingMarginBps = safeRateBps(Math.max(0, afterMarketingContributionCents), attributedNetSalesCents);
  const cacCents = attributedNewCustomers > 0 ? Math.ceil(spendCents / attributedNewCustomers) : (spendCents > 0 ? Number.MAX_SAFE_INTEGER : 0);
  const firstOrderContributionPerNewCustomerCents = attributedNewCustomers > 0 ? Math.floor(adjustedContributionBeforeMarketingCents / attributedNewCustomers) : 0;
  const allowableCac = calculateAllowableCac({
    firstOrderContributionCents: firstOrderContributionPerNewCustomerCents,
    expectedFutureContributionCents: expectedFutureContributionPerNewCustomerCents,
    attributionConfidenceBps,
    policy,
  });
  const refundRateBps = safeRateBps(refundsCents, attributedNetSalesCents);
  const cancellationRateBps = safeRateBps(cancellations, attributedOrders);
  const chargebackRateBps = safeRateBps(chargebacks, attributedOrders);
  const mature = attributedOrders >= policy.minimumMatureOrders && matureDays >= policy.minimumMatureDays;
  const reasons = [];
  const hardStops = [];
  if (attributionConfidenceBps < policy.minimumAttributionConfidenceBps) reasons.push('ATTRIBUTION_CONFIDENCE_LOW');
  if (!mature) reasons.push('DATA_NOT_MATURE');
  if (afterMarketingContributionCents < policy.minimumAfterMarketingContributionCents) hardStops.push('AFTER_MARKETING_CONTRIBUTION_NEGATIVE');
  if (afterMarketingMarginBps < policy.minimumAfterMarketingMarginBps) reasons.push('AFTER_MARKETING_MARGIN_BELOW_FLOOR');
  if (cacCents > allowableCac.allowableCacCents) hardStops.push('CAC_EXCEEDS_ALLOWABLE_CAC');
  if (refundRateBps > policy.maximumRefundRateBps) hardStops.push('REFUND_RATE_TOO_HIGH');
  if (cancellationRateBps > policy.maximumCancellationRateBps) hardStops.push('CANCELLATION_RATE_TOO_HIGH');
  if (chargebackRateBps > policy.maximumChargebackRateBps) hardStops.push('CHARGEBACK_RATE_TOO_HIGH');
  let decision = 'HOLD';
  let budgetChangeBps = 0;
  if (hardStops.length > 0) {
    decision = 'PAUSE_OR_REDUCE';
    budgetChangeBps = -policy.maximumBudgetDecreaseBps;
  } else if (mature && reasons.length === 0 && afterMarketingContributionCents > 0 && cacCents <= allowableCac.allowableCacCents) {
    decision = 'SCALE_MODESTLY';
    budgetChangeBps = policy.maximumBudgetIncreaseBps;
  } else if (afterMarketingContributionCents >= 0) {
    decision = 'HOLD_AND_COLLECT_DATA';
  }
  const recommendedDailyBudgetCents = budgetChangeBps >= 0
    ? currentDailyBudgetCents + applyBpsCeil(currentDailyBudgetCents, budgetChangeBps)
    : Math.max(0, currentDailyBudgetCents - applyBpsCeil(currentDailyBudgetCents, Math.abs(budgetChangeBps)));
  return {
    campaignId, decision, mature, spendCents, attributedNetSalesCents,
    adjustedContributionBeforeMarketingCents, afterMarketingContributionCents,
    afterMarketingMarginBps, cacCents, allowableCacCents: allowableCac.allowableCacCents,
    refundRateBps, cancellationRateBps, chargebackRateBps,
    currentDailyBudgetCents, recommendedDailyBudgetCents, budgetChangeBps,
    reasons, hardStops,
  };
}

export function allocateMarketingBudget({ totalBudgetCents, campaigns, policy: policyInput = {} }) {
  assertIntegerCents(totalBudgetCents, 'totalBudgetCents');
  if (!Array.isArray(campaigns) || campaigns.length === 0) throw new TypeError('campaigns must be a non-empty array');
  const policy = normalizePolicy(policyInput);
  const explorationBudgetCents = Math.floor((totalBudgetCents * policy.explorationBudgetBps) / 10_000);
  const provenBudgetCents = totalBudgetCents - explorationBudgetCents;
  const maximumPerChannelCents = Math.floor((totalBudgetCents * policy.maximumSingleChannelShareBps) / 10_000);
  const eligible = campaigns
    .filter((campaign) => ['SCALE_MODESTLY', 'HOLD_AND_COLLECT_DATA'].includes(campaign.decision))
    .map((campaign) => ({
      ...campaign,
      weight: Math.max(0, campaign.afterMarketingContributionCents * Math.max(1, campaign.attributionConfidenceBps ?? 10_000)),
    }));
  const totalWeight = eligible.reduce((sum, campaign) => sum + campaign.weight, 0);
  let allocatedCents = 0;
  const allocations = eligible.map((campaign) => {
    const rawAllocation = totalWeight > 0 ? Math.floor((provenBudgetCents * campaign.weight) / totalWeight) : 0;
    const budgetCents = Math.min(rawAllocation, maximumPerChannelCents);
    allocatedCents += budgetCents;
    return { campaignId: campaign.campaignId, bucket: 'PROVEN', budgetCents };
  });
  const explorationCandidates = campaigns.filter((campaign) => campaign.decision === 'EXPLORATION');
  if (explorationCandidates.length > 0 && explorationBudgetCents > 0) {
    const each = Math.floor(explorationBudgetCents / explorationCandidates.length);
    for (const campaign of explorationCandidates) {
      allocations.push({ campaignId: campaign.campaignId, bucket: 'EXPLORATION', budgetCents: each });
      allocatedCents += each;
    }
  }
  return {
    totalBudgetCents, allocatedCents,
    unallocatedCents: Math.max(0, totalBudgetCents - allocatedCents),
    explorationBudgetCents, maximumPerChannelCents, allocations,
  };
}

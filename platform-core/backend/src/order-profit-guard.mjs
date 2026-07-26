import { applyBpsCeil, assertBps, assertIntegerCents } from './money.mjs';

const DEFAULT_POLICY = Object.freeze({
  minimumOrderContributionCents: 2_500,
  minimumOrderMarginBps: 600,
  supportReserveBps: 50,
  chargebackReserveBps: 100,
  returnReserveBps: 150,
  warrantyReserveBps: 50,
  maximumSupplierCostIncreaseBps: 200,
});

function normalizePolicy(policy = {}) {
  const merged = { ...DEFAULT_POLICY, ...policy };
  assertIntegerCents(merged.minimumOrderContributionCents, 'minimumOrderContributionCents');
  for (const key of [
    'minimumOrderMarginBps',
    'supportReserveBps',
    'chargebackReserveBps',
    'returnReserveBps',
    'warrantyReserveBps',
    'maximumSupplierCostIncreaseBps',
  ]) assertBps(merged[key], key);
  return merged;
}

export function evaluateOrderProfit(input) {
  const {
    merchandiseRevenueCents,
    customerShippingRevenueCents = 0,
    discountsCents = 0,
    supplierCostCents,
    fulfillmentCostCents = 0,
    paymentFeeCents,
    taxCollectedCents = 0,
    taxLiabilityCents = taxCollectedCents,
    priorSupplierCostCents = supplierCostCents,
    policy: policyInput = {},
  } = input;

  for (const [key, value] of Object.entries({
    merchandiseRevenueCents,
    customerShippingRevenueCents,
    discountsCents,
    supplierCostCents,
    fulfillmentCostCents,
    paymentFeeCents,
    taxCollectedCents,
    taxLiabilityCents,
    priorSupplierCostCents,
  })) assertIntegerCents(value, key);

  const policy = normalizePolicy(policyInput);
  const netSalesCents =
    merchandiseRevenueCents + customerShippingRevenueCents - discountsCents;

  if (netSalesCents <= 0) {
    return {
      decision: 'BLOCK',
      state: 'BLOCKED_NON_POSITIVE_REVENUE',
      expectedContributionCents: -(supplierCostCents + fulfillmentCostCents + paymentFeeCents),
      expectedMarginBps: -10_000,
      reasons: ['NON_POSITIVE_REVENUE'],
    };
  }

  const reserveCents =
    applyBpsCeil(netSalesCents, policy.supportReserveBps) +
    applyBpsCeil(netSalesCents, policy.chargebackReserveBps) +
    applyBpsCeil(netSalesCents, policy.returnReserveBps) +
    applyBpsCeil(netSalesCents, policy.warrantyReserveBps);

  const taxLeakageCents = Math.max(0, taxLiabilityCents - taxCollectedCents);
  const expectedContributionCents =
    netSalesCents -
    supplierCostCents -
    fulfillmentCostCents -
    paymentFeeCents -
    reserveCents -
    taxLeakageCents;

  const expectedMarginBps = Math.floor(
    (expectedContributionCents * 10_000) / netSalesCents,
  );

  const supplierCostIncreaseCents = Math.max(0, supplierCostCents - priorSupplierCostCents);
  const allowedIncreaseCents = applyBpsCeil(
    priorSupplierCostCents,
    policy.maximumSupplierCostIncreaseBps,
  );

  const reasons = [];
  if (expectedContributionCents < policy.minimumOrderContributionCents) {
    reasons.push('CONTRIBUTION_BELOW_FLOOR');
  }
  if (expectedMarginBps < policy.minimumOrderMarginBps) {
    reasons.push('MARGIN_BELOW_FLOOR');
  }
  if (supplierCostIncreaseCents > allowedIncreaseCents) {
    reasons.push('SUPPLIER_COST_INCREASE_EXCEEDS_TOLERANCE');
  }
  if (taxLeakageCents > 0) reasons.push('UNCOLLECTED_TAX_LIABILITY');

  return {
    decision: reasons.length ? 'BLOCK' : 'ALLOW',
    state: reasons.length ? 'PROFIT_REVIEW_REQUIRED' : 'PROFIT_GUARD_PASSED',
    netSalesCents,
    reserveCents,
    taxLeakageCents,
    expectedContributionCents,
    expectedMarginBps,
    supplierCostIncreaseCents,
    allowedSupplierCostIncreaseCents: allowedIncreaseCents,
    reasons,
  };
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOrderProfit } from '../src/index.mjs';

test('profitable order passes the order-level guard', () => {
  const result = evaluateOrderProfit({
    merchandiseRevenueCents: 120_000,
    supplierCostCents: 90_000,
    fulfillmentCostCents: 2_000,
    paymentFeeCents: 3_800,
  });
  assert.equal(result.decision, 'ALLOW');
  assert.ok(result.expectedContributionCents >= 2_500);
});

test('thin-margin order is blocked even when revenue exceeds supplier cost', () => {
  const result = evaluateOrderProfit({
    merchandiseRevenueCents: 100_000,
    supplierCostCents: 95_000,
    fulfillmentCostCents: 1_000,
    paymentFeeCents: 3_000,
  });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.includes('CONTRIBUTION_BELOW_FLOOR'));
});

test('material supplier cost increase blocks order release', () => {
  const result = evaluateOrderProfit({
    merchandiseRevenueCents: 120_000,
    supplierCostCents: 94_000,
    priorSupplierCostCents: 90_000,
    fulfillmentCostCents: 1_000,
    paymentFeeCents: 3_500,
    policy: { maximumSupplierCostIncreaseBps: 200 },
  });
  assert.equal(result.decision, 'BLOCK');
  assert.ok(result.reasons.includes('SUPPLIER_COST_INCREASE_EXCEEDS_TOLERANCE'));
});

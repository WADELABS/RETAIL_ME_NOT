import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSpendableCapital,
  evaluateCapitalRelease,
  nextFulfillmentMode,
} from '../src/index.mjs';

const order = {
  id: 'ord_1',
  paymentIntentId: 'pi_1',
  paymentState: 'SUCCEEDED',
  paymentMethodType: 'card',
  riskDecision: 'ALLOW',
  reconciliationHold: false,
  fulfillmentGroups: [{
    fulfillmentType: 'DISTRIBUTOR',
    wholesaleCostCents: 85_000,
    supplierShippingCents: 1_000,
    dropShipFeesCents: 500,
    supplierTaxCents: 0,
    procurementBufferCents: 1_000,
  }],
};

const enoughCapital = {
  mercuryAvailableCents: 100_000,
  distributorCreditAvailableCents: 0,
  stripeAvailableCents: 200_000,
  reservedCapitalCents: 2_000,
  pendingSupplierDebitsCents: 1_000,
  safetyBufferCents: 5_000,
};

test('payment processing state never releases supplier fulfillment', () => {
  const decision = evaluateCapitalRelease({
    order: { ...order, paymentState: 'PROCESSING' },
    capitalSnapshot: enoughCapital,
  });
  assert.equal(decision.release, false);
  assert.equal(decision.state, 'AWAITING_PAYMENT_CLEARANCE');
});

test('Stripe balance is not treated as spendable bank cash by default', () => {
  const spendable = calculateSpendableCapital({
    mercuryAvailableCents: 0,
    distributorCreditAvailableCents: 0,
    stripeAvailableCents: 200_000,
    reservedCapitalCents: 0,
    pendingSupplierDebitsCents: 0,
    safetyBufferCents: 0,
  });
  assert.equal(spendable, 0);
});

test('insufficient Mercury balance routes order to the capital queue', () => {
  const decision = evaluateCapitalRelease({
    order,
    capitalSnapshot: {
      ...enoughCapital,
      mercuryAvailableCents: 20_000,
      distributorCreditAvailableCents: 10_000,
    },
  });
  assert.equal(decision.release, false);
  assert.equal(decision.state, 'AWAITING_AVAILABLE_CAPITAL');
  assert.ok(decision.shortfallCents > 0);
});

test('available Mercury cash plus distributor credit creates an idempotent reservation', () => {
  const decision = evaluateCapitalRelease({
    order,
    capitalSnapshot: {
      ...enoughCapital,
      mercuryAvailableCents: 60_000,
      distributorCreditAvailableCents: 40_000,
    },
    now: '2026-07-20T14:00:00.000Z',
  });
  assert.equal(decision.release, true);
  assert.equal(decision.state, 'READY_FOR_SUPPLIER_ORDER');
  assert.equal(decision.reservation.id, 'cap_ord_1_pi_1');
});

test('existing active reservation prevents duplicate capital allocation', () => {
  const first = evaluateCapitalRelease({ order, capitalSnapshot: enoughCapital });
  const second = evaluateCapitalRelease({
    order,
    capitalSnapshot: enoughCapital,
    existingReservation: first.reservation,
  });
  assert.equal(second.release, true);
  assert.equal(second.reason, 'EXISTING_CAPITAL_RESERVATION');
  assert.equal(second.reservation.id, first.reservation.id);
});

test('policy-driven ACH return-risk hold blocks supplier ordering', () => {
  const decision = evaluateCapitalRelease({
    order: { ...order, paymentMethodType: 'us_bank_account' },
    capitalSnapshot: enoughCapital,
    policy: { achAdditionalHoldUntil: '2026-07-23T14:00:00.000Z' },
    now: '2026-07-20T14:00:00.000Z',
  });
  assert.equal(decision.release, false);
  assert.equal(decision.state, 'ACH_RETURN_RISK_HOLD');
});

test('manual mode remains manual even when capital is available', () => {
  const decision = evaluateCapitalRelease({ order, capitalSnapshot: enoughCapital });
  const mode = nextFulfillmentMode({ configuredMode: 'MANUAL', releaseDecision: decision });
  assert.equal(mode.action, 'QUEUE_ADMIN_REVIEW');
});

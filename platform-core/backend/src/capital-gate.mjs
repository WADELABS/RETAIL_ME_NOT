import { assertIntegerCents, sumCents } from './money.mjs';

const TERMINAL_PAYMENT_STATES = new Set(['SUCCEEDED']);

function assertCapitalSnapshot(snapshot) {
  for (const [key, value] of Object.entries({
    mercuryAvailableCents: snapshot.mercuryAvailableCents ?? 0,
    distributorCreditAvailableCents: snapshot.distributorCreditAvailableCents ?? 0,
    stripeAvailableCents: snapshot.stripeAvailableCents ?? 0,
    reservedCapitalCents: snapshot.reservedCapitalCents ?? 0,
    pendingSupplierDebitsCents: snapshot.pendingSupplierDebitsCents ?? 0,
    safetyBufferCents: snapshot.safetyBufferCents ?? 0,
  })) assertIntegerCents(value, key);
}

export function calculateRequiredProcurementCapital(order) {
  const groups = order.fulfillmentGroups ?? [];
  return groups
    .filter((group) => group.fulfillmentType === 'DISTRIBUTOR')
    .reduce((total, group) => {
      const groupCost = sumCents([
        group.wholesaleCostCents,
        group.supplierShippingCents ?? 0,
        group.dropShipFeesCents ?? 0,
        group.supplierTaxCents ?? 0,
        group.otherSupplierChargesCents ?? 0,
        group.procurementBufferCents ?? 0,
      ], 'fulfillment group procurement cost');
      return total + groupCost;
    }, 0);
}

export function calculateSpendableCapital(snapshot, policy = {}) {
  assertCapitalSnapshot(snapshot);
  const countStripeBalanceAsSpendable = policy.countStripeBalanceAsSpendable === true;
  const base =
    snapshot.mercuryAvailableCents +
    snapshot.distributorCreditAvailableCents +
    (countStripeBalanceAsSpendable ? snapshot.stripeAvailableCents : 0);
  const encumbered =
    snapshot.reservedCapitalCents +
    snapshot.pendingSupplierDebitsCents +
    snapshot.safetyBufferCents;
  return Math.max(0, base - encumbered);
}

export function evaluateCapitalRelease({ order, capitalSnapshot, policy = {}, existingReservation = null, now = new Date() }) {
  if (!order?.id) throw new TypeError('order.id is required');
  if (!order.paymentIntentId) throw new TypeError('order.paymentIntentId is required');
  if (!TERMINAL_PAYMENT_STATES.has(order.paymentState)) {
    return {
      orderId: order.id,
      release: false,
      state: order.paymentState === 'PROCESSING' ? 'AWAITING_PAYMENT_CLEARANCE' : 'PAYMENT_NOT_CLEARED',
      reason: `PAYMENT_STATE_${order.paymentState}`,
    };
  }
  if (order.riskDecision === 'REVIEW' || order.riskDecision === 'BLOCK') {
    return {
      orderId: order.id,
      release: false,
      state: 'FULFILLMENT_HOLD',
      reason: `RISK_${order.riskDecision}`,
    };
  }
  if (order.reconciliationHold === true) {
    return {
      orderId: order.id,
      release: false,
      state: 'PAYMENT_RECONCILIATION_HOLD',
      reason: 'PAYMENT_MISMATCH',
    };
  }

  if (order.paymentMethodType === 'us_bank_account' && policy.achAdditionalHoldUntil) {
    const holdUntil = new Date(policy.achAdditionalHoldUntil).getTime();
    const nowMs = new Date(now).getTime();
    if (!Number.isFinite(holdUntil)) throw new TypeError('achAdditionalHoldUntil must be a valid date');
    if (nowMs < holdUntil) {
      return {
        orderId: order.id,
        release: false,
        state: 'ACH_RETURN_RISK_HOLD',
        reason: 'ACH_POLICY_HOLD_ACTIVE',
        retryAt: new Date(holdUntil).toISOString(),
      };
    }
  }

  const requiredCapitalCents = calculateRequiredProcurementCapital(order);
  if (requiredCapitalCents === 0) {
    return {
      orderId: order.id,
      release: true,
      state: 'READY_FOR_INTERNAL_FULFILLMENT',
      reason: 'NO_DISTRIBUTOR_CAPITAL_REQUIRED',
      requiredCapitalCents: 0,
      reservation: null,
    };
  }

  if (existingReservation?.orderId === order.id && existingReservation.status === 'ACTIVE') {
    if (existingReservation.amountCents < requiredCapitalCents) {
      return {
        orderId: order.id,
        release: false,
        state: 'CAPITAL_RESERVATION_SHORTFALL',
        reason: 'EXISTING_RESERVATION_TOO_SMALL',
        requiredCapitalCents,
        reservedCents: existingReservation.amountCents,
      };
    }
    return {
      orderId: order.id,
      release: true,
      state: 'READY_FOR_SUPPLIER_ORDER',
      reason: 'EXISTING_CAPITAL_RESERVATION',
      requiredCapitalCents,
      spendableCapitalCents: calculateSpendableCapital(capitalSnapshot, policy),
      reservation: existingReservation,
    };
  }

  const spendableCapitalCents = calculateSpendableCapital(capitalSnapshot, policy);
  if (spendableCapitalCents < requiredCapitalCents) {
    return {
      orderId: order.id,
      release: false,
      state: 'AWAITING_AVAILABLE_CAPITAL',
      reason: 'INSUFFICIENT_SPENDABLE_CAPITAL',
      requiredCapitalCents,
      spendableCapitalCents,
      shortfallCents: requiredCapitalCents - spendableCapitalCents,
      alert: {
        channel: policy.lowBalanceAlertChannel ?? 'ADMIN_QUEUE',
        severity: 'HIGH',
      },
    };
  }

  const reservationId = `cap_${order.id}_${order.paymentIntentId}`;
  return {
    orderId: order.id,
    release: true,
    state: 'READY_FOR_SUPPLIER_ORDER',
    reason: 'CAPITAL_AVAILABLE_AND_RESERVED',
    requiredCapitalCents,
    spendableCapitalCents,
    remainingCapitalCents: spendableCapitalCents - requiredCapitalCents,
    reservation: {
      id: reservationId,
      orderId: order.id,
      paymentIntentId: order.paymentIntentId,
      amountCents: requiredCapitalCents,
      status: 'ACTIVE',
      createdAt: new Date(now).toISOString(),
    },
  };
}

export function nextFulfillmentMode({ configuredMode, releaseDecision }) {
  if (configuredMode === 'MANUAL') {
    return {
      action: 'QUEUE_ADMIN_REVIEW',
      state: 'MANUAL_FULFILLMENT_REQUIRED',
    };
  }
  if (configuredMode !== 'CAPITAL_GATED_AUTO') {
    throw new TypeError('configuredMode must be MANUAL or CAPITAL_GATED_AUTO');
  }
  return releaseDecision.release
    ? { action: 'QUEUE_SUPPLIER_ORDER', state: releaseDecision.state }
    : { action: 'WAIT', state: releaseDecision.state };
}

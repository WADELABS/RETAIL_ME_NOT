const PAYMENT_READY = new Set(['SUCCEEDED']);
const RISK_READY = new Set(['ALLOW', 'APPROVED']);

function evaluateGroup({
  group,
  paymentState,
  riskDecision,
  profitDecision,
  compliance,
  capitalDecision,
  executionMode,
}) {
  if (!PAYMENT_READY.has(paymentState)) {
    return { groupId: group.id, action: 'WAIT', state: 'AWAITING_PAYMENT_CLEARANCE' };
  }
  if (!RISK_READY.has(riskDecision)) {
    return { groupId: group.id, action: 'QUEUE_REVIEW', state: 'FULFILLMENT_HOLD' };
  }
  if (profitDecision !== 'ALLOW') {
    return { groupId: group.id, action: 'QUEUE_REVIEW', state: 'PROFIT_REVIEW_REQUIRED' };
  }
  if (group.inventoryState !== 'IN_STOCK') {
    return { groupId: group.id, action: 'QUEUE_EXCEPTION', state: 'INVENTORY_REVALIDATION_FAILED' };
  }

  if (group.fulfillmentType === 'INTERNAL') {
    return { groupId: group.id, action: 'QUEUE_INTERNAL_FULFILLMENT', state: 'READY' };
  }

  if (group.fulfillmentType !== 'DISTRIBUTOR') {
    return { groupId: group.id, action: 'QUEUE_EXCEPTION', state: 'UNSUPPORTED_FULFILLMENT_TYPE' };
  }

  if (!compliance.distributorAccountApproved) {
    return { groupId: group.id, action: 'WAIT', state: 'DISTRIBUTOR_ACCOUNT_NOT_APPROVED' };
  }

  if (group.requiresTaxExemptProcurement && !compliance.taxExemptProcurementReady) {
    return { groupId: group.id, action: 'WAIT', state: 'RESALE_CERTIFICATE_OR_ACCEPTANCE_PENDING' };
  }

  if (!capitalDecision?.release) {
    return {
      groupId: group.id,
      action: 'WAIT',
      state: capitalDecision?.state ?? 'AWAITING_AVAILABLE_CAPITAL',
    };
  }

  if (executionMode === 'MANUAL') {
    return { groupId: group.id, action: 'QUEUE_ADMIN_REVIEW', state: 'MANUAL_FULFILLMENT_REQUIRED' };
  }
  if (executionMode !== 'CAPITAL_GATED_AUTO') {
    throw new TypeError('executionMode must be MANUAL or CAPITAL_GATED_AUTO');
  }

  return {
    groupId: group.id,
    action: 'QUEUE_SUPPLIER_ORDER',
    state: 'READY_FOR_SUPPLIER_ORDER',
    capitalReservationId: capitalDecision.reservation?.id ?? null,
  };
}

export function buildFulfillmentPlan(input) {
  const {
    orderId,
    paymentState,
    riskDecision,
    profitDecision,
    fulfillmentGroups,
    compliance,
    capitalDecisionsByGroup = {},
    executionMode = 'MANUAL',
  } = input;

  if (!orderId) throw new TypeError('orderId is required');
  if (!Array.isArray(fulfillmentGroups) || fulfillmentGroups.length === 0) {
    throw new TypeError('fulfillmentGroups must be a non-empty array');
  }

  const groupPlans = fulfillmentGroups.map((group) => evaluateGroup({
    group,
    paymentState,
    riskDecision,
    profitDecision,
    compliance,
    capitalDecision: capitalDecisionsByGroup[group.id],
    executionMode,
  }));

  const actionable = groupPlans.filter((item) =>
    ['QUEUE_INTERNAL_FULFILLMENT', 'QUEUE_SUPPLIER_ORDER', 'QUEUE_ADMIN_REVIEW'].includes(item.action)
  );
  const blocked = groupPlans.filter((item) =>
    ['WAIT', 'QUEUE_REVIEW', 'QUEUE_EXCEPTION'].includes(item.action)
  );

  let orderState = 'ROUTING_READY';
  if (blocked.length && actionable.length) orderState = 'PARTIALLY_BLOCKED';
  else if (blocked.length) orderState = 'BLOCKED';
  else if (executionMode === 'MANUAL') orderState = 'MANUAL_ROUTING_READY';

  return {
    orderId,
    orderState,
    groupPlans,
    counts: {
      total: groupPlans.length,
      actionable: actionable.length,
      blocked: blocked.length,
    },
  };
}

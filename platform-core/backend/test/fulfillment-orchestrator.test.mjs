import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFulfillmentPlan } from '../src/index.mjs';

const compliancePending = {
  distributorAccountApproved: true,
  taxExemptProcurementReady: false,
};

const complianceReady = {
  distributorAccountApproved: true,
  taxExemptProcurementReady: true,
};

test('mixed order releases owned inventory but blocks exemption-dependent distributor group while certificate is pending', () => {
  const result = buildFulfillmentPlan({
    orderId: 'ord_1',
    paymentState: 'SUCCEEDED',
    riskDecision: 'ALLOW',
    profitDecision: 'ALLOW',
    executionMode: 'MANUAL',
    compliance: compliancePending,
    fulfillmentGroups: [
      { id: 'internal', fulfillmentType: 'INTERNAL', inventoryState: 'IN_STOCK' },
      { id: 'supplier', fulfillmentType: 'DISTRIBUTOR', inventoryState: 'IN_STOCK', requiresTaxExemptProcurement: true },
    ],
    capitalDecisionsByGroup: {
      supplier: { release: true, state: 'READY_FOR_SUPPLIER_ORDER', reservation: { id: 'cap_1' } },
    },
  });
  assert.equal(result.orderState, 'PARTIALLY_BLOCKED');
  assert.equal(result.groupPlans[0].action, 'QUEUE_INTERNAL_FULFILLMENT');
  assert.equal(result.groupPlans[1].state, 'RESALE_CERTIFICATE_OR_ACCEPTANCE_PENDING');
});

test('capital-gated auto mode queues distributor order only after every gate passes', () => {
  const result = buildFulfillmentPlan({
    orderId: 'ord_2',
    paymentState: 'SUCCEEDED',
    riskDecision: 'ALLOW',
    profitDecision: 'ALLOW',
    executionMode: 'CAPITAL_GATED_AUTO',
    compliance: complianceReady,
    fulfillmentGroups: [
      { id: 'supplier', fulfillmentType: 'DISTRIBUTOR', inventoryState: 'IN_STOCK', requiresTaxExemptProcurement: true },
    ],
    capitalDecisionsByGroup: {
      supplier: { release: true, state: 'READY_FOR_SUPPLIER_ORDER', reservation: { id: 'cap_2' } },
    },
  });
  assert.equal(result.orderState, 'ROUTING_READY');
  assert.equal(result.groupPlans[0].action, 'QUEUE_SUPPLIER_ORDER');
  assert.equal(result.groupPlans[0].capitalReservationId, 'cap_2');
});

test('profit failure blocks all fulfillment', () => {
  const result = buildFulfillmentPlan({
    orderId: 'ord_3',
    paymentState: 'SUCCEEDED',
    riskDecision: 'ALLOW',
    profitDecision: 'BLOCK',
    executionMode: 'CAPITAL_GATED_AUTO',
    compliance: complianceReady,
    fulfillmentGroups: [
      { id: 'supplier', fulfillmentType: 'DISTRIBUTOR', inventoryState: 'IN_STOCK', requiresTaxExemptProcurement: true },
    ],
  });
  assert.equal(result.orderState, 'BLOCKED');
  assert.equal(result.groupPlans[0].state, 'PROFIT_REVIEW_REQUIRED');
});

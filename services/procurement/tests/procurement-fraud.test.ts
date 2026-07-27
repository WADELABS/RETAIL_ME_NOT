import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialize, purchaseOrders, releaseHeldProcurement, PurchaseOrderRecord } from '../src/index';
import { publisher } from '../../event-gateway/publisher/index';
import { v4 as uuidv4 } from 'uuid';

test('Procurement Service immediately processes and pays for ALLOWED low-risk orders', async () => {
  initialize();

  const orderId = uuidv4();
  const correlationId = uuidv4();

  // 1. Simulate the Fulfillment domain assigning a clean (ALLOW) order
  await publisher.publish(
    'fulfillment',
    'fulfillment.assigned',
    {
      orderId,
      providerId: 'INGRAM_MICRO_B2B',
      riskRecommendation: 'ALLOW', // APPROVED
      items: [
        { sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }
      ]
    },
    correlationId
  );

  // Retrieve the generated B2B PO record
  const posArray = Array.from(purchaseOrders.values());
  const po = posArray.find(p => p.orderId === orderId)!;

  assert.ok(po);
  assert.equal(po.status, 'EDI_850_TRANSMITTED', 'Approved checkouts must immediately pay and transmit the PO');
  assert.ok(po.issuedCard, 'Must generate a secure single-use virtual card');
  assert.ok(po.ediPayload?.includes('REF*CC*'), 'EDI text must serialize virtual card credentials');
});

test('Procurement Service completely blocks PO and virtual cards on DECLINE risk levels', async () => {
  initialize();

  const orderId = uuidv4();
  const correlationId = uuidv4();

  // 1. Simulate the Fulfillment domain assigning a high-risk (DECLINE) order
  await publisher.publish(
    'fulfillment',
    'fulfillment.assigned',
    {
      orderId,
      providerId: 'INGRAM_MICRO_B2B',
      riskRecommendation: 'DECLINE', // SEVERE FRAUD BLOCK
      items: [
        { sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }
      ]
    },
    correlationId
  );

  const posArray = Array.from(purchaseOrders.values());
  const po = posArray.find(p => p.orderId === orderId)!;

  assert.ok(po);
  assert.equal(po.status, 'FAILED_TRANSMISSION', 'Extreme fraud orders must fail PO generation');
  assert.equal(po.issuedCard, undefined, 'Must block Stripe virtual card generation, preserving capital');
  assert.equal(po.ediPayload, undefined, 'Must block B2B order transmission');
});

test('Procurement Service quarantines PO in HELD_FOR_FRAUD_AUDIT status on MANUAL_REVIEW risk levels', async () => {
  initialize();

  const orderId = uuidv4();
  const correlationId = uuidv4();

  // 1. Simulate the Fulfillment domain assigning a borderline (MANUAL_REVIEW) order
  await publisher.publish(
    'fulfillment',
    'fulfillment.assigned',
    {
      orderId,
      providerId: 'INGRAM_MICRO_B2B',
      riskRecommendation: 'MANUAL_REVIEW', // FRAUD GATE SUSPENDED
      items: [
        { sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }
      ]
    },
    correlationId
  );

  const posArray = Array.from(purchaseOrders.values());
  const po = posArray.find(p => p.orderId === orderId)!;

  assert.ok(po);
  assert.equal(po.status, 'HELD_FOR_FRAUD_AUDIT', 'Suspicious checkouts must quarantine PO in fraud audit');
  assert.equal(po.issuedCard, undefined, 'Must block card generation to protect our cash');
  assert.equal(po.ediPayload, undefined, 'Must block B2B order routing to distributor');
});

test('Procurement Service manual release allows administrator to manually pay and transmit a quarantined PO', async () => {
  initialize();

  const orderId = uuidv4();
  const correlationId = uuidv4();

  // 1. Ingest a quarantined (HELD) Purchase Order
  await publisher.publish(
    'fulfillment',
    'fulfillment.assigned',
    {
      orderId,
      providerId: 'INGRAM_MICRO_B2B',
      riskRecommendation: 'MANUAL_REVIEW', // QUARANTINED
      items: [
        { sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }
      ]
    },
    correlationId
  );

  const posArray = Array.from(purchaseOrders.values());
  const poBefore = posArray.find(p => p.orderId === orderId)!;
  assert.equal(poBefore.status, 'HELD_FOR_FRAUD_AUDIT');

  // 2. Administrator manual releases and pays the PO
  const releasedPO = await releaseHeldProcurement(poBefore.purchaseOrderId);

  // Verify transition and completion
  assert.equal(releasedPO.status, 'EDI_850_TRANSMITTED', 'Manual release must execute order routing');
  assert.ok(releasedPO.issuedCard, 'Must generate Stripe single-use card upon manual release approval');
  assert.ok(releasedPO.ediPayload?.includes('REF*CC*'), 'EDI text must serialize virtual card credentials');
});

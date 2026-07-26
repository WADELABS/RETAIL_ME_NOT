import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RiskService, FraudMetrics } from '../src/index';
import { v4 as uuidv4 } from 'uuid';

test('Risk Engine approves clean customer transactions with zero friction', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();

  const cleanMetrics: FraudMetrics = {
    cvvStatus: 'PASS',
    avsStatus: 'MATCH',
    hourlyOrderCount: 1,
    isNewDevice: false,
    isProxyOrVpn: false,
    hasBehavioralAnomalies: false,
    bankNameMismatch: false,
    multipleCardholderNames: false,
    orderValueCents: 5000, // $50
  };

  const assessment = await service.evaluateOrderRisk(orderId, customerId, cleanMetrics);

  assert.equal(assessment.recommendation, 'ALLOW');
  assert.equal(assessment.riskScore, 0);
  assert.equal(assessment.triggeredRules.length, 0);
});

test('Risk Engine blocks and DECLINES severe fraud/bot attacks instantly', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();

  const maliciousMetrics: FraudMetrics = {
    cvvStatus: 'FAIL',
    avsStatus: 'FULL_MISMATCH',
    hourlyOrderCount: 6,
    isNewDevice: true,
    isProxyOrVpn: true,
    hasBehavioralAnomalies: true,
    bankNameMismatch: true,
    multipleCardholderNames: true,
    orderValueCents: 159900,
  };

  const assessment = await service.evaluateOrderRisk(orderId, customerId, maliciousMetrics);

  assert.equal(assessment.recommendation, 'DECLINE');
  assert.equal(assessment.riskScore, 100);
});

// --- CODES AND RULES COMPLIANCE ENFORCEMENT TESTS ---

test('Risk Engine penalizes bank name mismatch, multiple cardholders, and high-value orders', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();

  const suspectMetrics: FraudMetrics = {
    cvvStatus: 'PASS',
    avsStatus: 'MATCH',
    hourlyOrderCount: 1,
    isNewDevice: false,
    isProxyOrVpn: false,
    hasBehavioralAnomalies: false,
    bankNameMismatch: true,          // +25
    multipleCardholderNames: true,     // +30
    orderValueCents: 159900,           // +15 (Total: 70 points -> MANUAL_REVIEW)
  };

  const assessment = await service.evaluateOrderRisk(orderId, customerId, suspectMetrics);

  assert.equal(assessment.recommendation, 'MANUAL_REVIEW');
  assert.equal(assessment.riskScore, 70);
  assert.ok(assessment.triggeredRules.includes('AUTOMATIC_BANK_VERIFICATION_NAME_MISMATCH'));
  assert.ok(assessment.triggeredRules.includes('MULTIPLE_CARDHOLDER_NAMES_DETECTED'));
  assert.ok(assessment.triggeredRules.includes('HIGH_VALUE_TRANSACTION_THRESHOLD_EXCEEDED'));
});

test('Returns domain automatically blacklists customer upon receiving WRONG_ITEM', async () => {
  const service = new RiskService();
  const customerId = uuidv4();
  const orderId = uuidv4();

  const profile = service.getOrCreateTrustProfile(customerId);
  assert.equal(profile.status, 'NEUTRAL');
  assert.equal(profile.trustScore, 500);

  // Simulate a returned item receiving inspection and grading as WRONG_ITEM (Fraud)
  await service.evaluateReturnOutcome({
    rmaId: uuidv4(),
    orderId,
    customerId,
    sku: 'GPU-RTX-4090',
    serialNumber: 'ECOS-99228811',
    grade: 'WRONG_ITEM', // FRAUD
    notes: 'Customer returned a brick instead of a graphics card',
    inspectedAt: new Date().toISOString(),
  });

  // Verify instant blacklist
  const updatedProfile = service.getOrCreateTrustProfile(customerId);
  assert.equal(updatedProfile.status, 'BLACKLISTED', 'Must instantly blacklist the customer');
  assert.equal(updatedProfile.trustScore, 0, 'Trust score must be reduced to 0');
});

test('Excessive returns flag customer trust as SUSPICIOUS and limit future returns', async () => {
  const service = new RiskService();
  const customerId = uuidv4();

  const profile = service.getOrCreateTrustProfile(customerId);
  assert.equal(profile.status, 'NEUTRAL');

  const inspectionPayload = {
    rmaId: uuidv4(),
    orderId: uuidv4(),
    customerId,
    sku: 'LAPTOP-WADE-01',
    serialNumber: 'ECOS-882233',
    grade: 'OPEN_BOX' as const, // legitimate return but high frequency
    notes: 'Customer returned open box laptop',
    inspectedAt: new Date().toISOString(),
  };

  // Simulate 4 successive returns (violating our maximum of 3)
  for (let i = 0; i < 4; i++) {
    await service.evaluateReturnOutcome({
      ...inspectionPayload,
      rmaId: uuidv4(),
    });
  }

  const updatedProfile = service.getOrCreateTrustProfile(customerId);
  assert.equal(updatedProfile.status, 'SUSPICIOUS', 'Must flag customer as SUSPICIOUS after excessive returns');
  assert.equal(updatedProfile.returnsCount, 4);
});

test('Stripe chargebacks automatically compile exhaustive evidence portfolio', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();

  // 1. Establish an order evaluation
  const metrics: FraudMetrics = {
    cvvStatus: 'PASS',
    avsStatus: 'MATCH',
    hourlyOrderCount: 1,
    isNewDevice: false,
    isProxyOrVpn: false,
    hasBehavioralAnomalies: false,
    bankNameMismatch: false,
    multipleCardholderNames: false,
    orderValueCents: 129900,
  };
  await service.evaluateOrderRisk(orderId, customerId, metrics);

  // 2. Receive a Stripe chargeback dispute event
  const disputeId = 'dp_1M3abc';
  await service.compileDisputeEvidence({
    disputeId,
    orderId,
    customerId,
    amountCents: 129900,
    reason: 'PRODUCT_NOT_RECEIVED',
    status: 'NEEDS_RESPONSE',
    receivedAt: new Date().toISOString(),
  });

  // 3. Verify evidence vault compilation
  const evidence = service.getDisputeEvidence(disputeId);
  
  assert.ok(evidence, 'Should compile and archive evidence portfolio');
  assert.equal(evidence.disputeId, disputeId);
  assert.equal(evidence.cvvVerification, 'PASS');
  assert.equal(evidence.avsVerification, 'MATCH');
  assert.equal(evidence.shippingCarrier, 'UPS');
  assert.equal(evidence.deliveryStatus, 'DELIVERED_AND_SIGNED', 'Must include shipping delivery logs to win dispute');
});

// --- ADVANCED SERIAL NUMBER VERIFICATION TESTS ---

test('Returns verification approves returns with matching serial numbers', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();
  const serialNumber = 'ECOS-SR-998811A';

  // 1. Register the original shipped serial number
  service.registerShippedSerial(orderId, serialNumber);

  // 2. Simulate return inspection with the MATCHING serial number
  await service.evaluateReturnOutcome({
    rmaId: uuidv4(),
    orderId,
    customerId,
    sku: 'LAPTOP-WADE-01',
    serialNumber, // MATCHES shipped serial
    grade: 'OPEN_BOX',
    notes: 'Item returned in original open box',
    inspectedAt: new Date().toISOString(),
  });

  // Verify the return was approved, and the customer was NOT blacklisted
  const profile = service.getOrCreateTrustProfile(customerId);
  assert.equal(profile.status, 'NEUTRAL', 'Should remain neutral for valid matched return');
  assert.notEqual(profile.trustScore, 0);
});

test('Returns verification intercepts, overrides, and blacklists mismatched serial numbers (Serial-Swapping Fraud)', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();
  
  const originalShippedSerial = 'ECOS-SR-998811A';
  const fraudulentReturnedSerial = 'FORGED-SR-220033B'; // Mismatched serial (card-swapping)

  // 1. Register the original shipped serial number
  service.registerShippedSerial(orderId, originalShippedSerial);

  // 2. Simulate return inspection with a MISMATCHED serial number
  await service.evaluateReturnOutcome({
    rmaId: uuidv4(),
    orderId,
    customerId,
    sku: 'LAPTOP-WADE-01',
    serialNumber: fraudulentReturnedSerial, // MISMATCH
    grade: 'OPEN_BOX', // Customer claimed it was an open box return, but serial verification intercepts it!
    notes: 'Customer attempted return, but serial verification failed.',
    inspectedAt: new Date().toISOString(),
  });

  // Verify that the return was intercepted, overridden to WRONG_ITEM, and the customer was immediately blacklisted
  const profile = service.getOrCreateTrustProfile(customerId);
  assert.equal(profile.status, 'BLACKLISTED', 'Mismatched serial numbers must trigger an automatic global blacklist');
  assert.equal(profile.trustScore, 0, 'Trust score must be reduced to 0');
});

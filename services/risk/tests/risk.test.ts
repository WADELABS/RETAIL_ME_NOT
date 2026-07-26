import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RiskService, FraudMetrics } from '../src/index';
import { v4 as uuidv4 } from 'uuid';

test('Risk Engine approves clean customer transactions with zero friction', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();

  // Low risk, clean shopper metrics
  const cleanMetrics: FraudMetrics = {
    cvvStatus: 'PASS',
    avsStatus: 'MATCH',
    hourlyOrderCount: 1,
    isNewDevice: false,
    isProxyOrVpn: false,
    hasBehavioralAnomalies: false,
  };

  const assessment = await service.evaluateOrderRisk(orderId, customerId, cleanMetrics);

  assert.equal(assessment.recommendation, 'ALLOW', 'Legitimate transactions must be approved without friction');
  assert.equal(assessment.riskScore, 0, 'Clean metrics should result in a score of 0');
  assert.equal(assessment.triggeredRules.length, 0);
});

test('Risk Engine blocks and DECLINES severe fraud/bot attacks instantly', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();

  // Extreme fraud metrics (card-testing bot signatures)
  const maliciousMetrics: FraudMetrics = {
    cvvStatus: 'FAIL',             // +35
    avsStatus: 'FULL_MISMATCH',    // +20
    hourlyOrderCount: 6,           // +40 (Critical Velocity)
    isNewDevice: true,             // +10
    isProxyOrVpn: true,            // +15
    hasBehavioralAnomalies: true,  // +15 (Total: 100/100, capped)
  };

  const assessment = await service.evaluateOrderRisk(orderId, customerId, maliciousMetrics);

  assert.equal(assessment.recommendation, 'DECLINE', 'Severe fraud indicators must trigger an instant hard block');
  assert.equal(assessment.riskScore, 100, 'Score should be capped at 100');
  assert.ok(assessment.triggeredRules.includes('CVV_VERIFICATION_FAILURE'));
  assert.ok(assessment.triggeredRules.includes('AVS_FULL_MISMATCH'));
  assert.ok(assessment.triggeredRules.includes('CRITICAL_VELOCITY_LIMIT_EXCEEDED'));
});

test('Risk Engine flags moderate-risk profiles for MANUAL_REVIEW', async () => {
  const service = new RiskService();
  const orderId = uuidv4();
  const customerId = uuidv4();

  // Suspicious but inconclusive metrics (e.g. customer checking out from hotel VPN with zip mismatch)
  const suspiciousMetrics: FraudMetrics = {
    cvvStatus: 'PASS',
    avsStatus: 'ZIP_MISMATCH',     // +10
    hourlyOrderCount: 2,
    isNewDevice: true,             // +10
    isProxyOrVpn: true,            // +15
    hasBehavioralAnomalies: true,  // +15 (Total: 50 points)
  };

  const assessment = await service.evaluateOrderRisk(orderId, customerId, suspiciousMetrics);

  assert.equal(assessment.recommendation, 'MANUAL_REVIEW', 'Borderline transactions must be placed on hold for human audit');
  assert.equal(assessment.riskScore, 50);
  assert.ok(assessment.triggeredRules.includes('AVS_PARTIAL_MISMATCH'));
  assert.ok(assessment.triggeredRules.includes('VPN_OR_PROXY_USAGE'));
});

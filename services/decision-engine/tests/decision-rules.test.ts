import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../engine/evaluator';
import { fraudRules, DecisionContext } from '../rules/fraud.rules';
import { pricingRules } from '../rules/pricing.rules';
import { fulfillmentRules, FulfillmentSourcingContext } from '../rules/fulfillment.rules';

test('Decision Engine approves normal, low-risk contexts cleanly', () => {
  const cleanContext: DecisionContext = {
    risk: {
      riskScore: 5,
      recommendation: 'ALLOW',
      triggeredRules: [],
    },
    pricing: {
      expectedMarginBps: 1500, // 15% margin (above our 12% threshold)
    }
  };

  const decision = evaluate(cleanContext, [...fraudRules, ...pricingRules]);

  assert.equal(decision.decision, 'ALLOW', 'Legitimate transactions must pass all rules');
  assert.equal(decision.matchedRule, 'GLOBAL_DEFAULT_ALLOW_RULE', 'Should fall back to global default allow');
  assert.deepEqual(decision.inputsSnapshot, cleanContext, 'Should include a complete, explainable inputs snapshot');
});

test('Decision Engine triggers Hard Fraud Decline Rule and blocks transaction', () => {
  const fraudulentContext: DecisionContext = {
    risk: {
      riskScore: 85,
      recommendation: 'DECLINE', // Hard fraud recommendation
      triggeredRules: ['CVV_VERIFICATION_FAILURE', 'CRITICAL_VELOCITY_LIMIT_EXCEEDED'],
    }
  };

  const decision = evaluate(fraudulentContext, [...fraudRules, ...pricingRules]);

  assert.equal(decision.decision, 'REJECT_ORDER', 'Should block and reject fraud orders');
  assert.equal(decision.reason, 'CRITICAL_FRAUD_RISK_DETECTED');
  assert.equal(decision.matchedRule, 'Hard Fraud Decline Rule', 'Must explicitly state which security policy blocked the order');
});

test('Decision Engine triggers Suspicious Activity Hold Rule and quarantines order', () => {
  const borderlineContext: DecisionContext = {
    risk: {
      riskScore: 55,
      recommendation: 'MANUAL_REVIEW', // Borderline fraud recommendation
      triggeredRules: ['AVS_PARTIAL_MISMATCH', 'VPN_OR_PROXY_USAGE'],
    }
  };

  const decision = evaluate(borderlineContext, [...fraudRules, ...pricingRules]);

  assert.equal(decision.decision, 'HOLD_FOR_REVIEW', 'Borderline orders must be held for review');
  assert.equal(decision.reason, 'SUSPICIOUS_TRANSACTION_ACTIVITY_HOLD');
  assert.equal(decision.matchedRule, 'Suspicious Activity Hold Rule');
});

test('Decision Engine triggers Hard Margin Protection Rule to block margin leakage', () => {
  const thinMarginContext: DecisionContext = {
    risk: {
      riskScore: 0,
      recommendation: 'ALLOW',
      triggeredRules: [],
    },
    pricing: {
      expectedMarginBps: 1000, // 10% margin (Violates our 12% / 1200 bps threshold!)
    }
  };

  const decision = evaluate(thinMarginContext, [...fraudRules, ...pricingRules]);

  assert.equal(decision.decision, 'REJECT_ORDER', 'ECOS must block low-margin checkout attempts');
  assert.equal(decision.reason, 'EXPECTED_MARGIN_BELOW_MINIMUM_THRESHOLD');
  assert.equal(decision.matchedRule, 'Hard Margin Protection Rule', 'Must explicitly cite our financial margin protection policy');
});

test('Decision Engine triggers Critical Provider Unreliability Rule and re-routes fulfillment', () => {
  const unstableSourcingContext: FulfillmentSourcingContext = {
    providerId: 'UNSTABLE_DISTRIBUTOR',
    reliabilityScore: 0.80, // 80% reliability (Below our 85% threshold!)
  };

  const decision = evaluate(unstableSourcingContext, fulfillmentRules);

  assert.equal(decision.decision, 'RE_ROUTE_PROVIDER', 'ECOS must reject unstable providers');
  assert.equal(decision.reason, 'PROVIDER_RELIABILITY_BELOW_SAFE_THRESHOLD');
  assert.equal(decision.matchedRule, 'Critical Provider Unreliability Rule');
});

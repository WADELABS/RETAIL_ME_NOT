import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateUxExperiment } from '../src/index.mjs';

const control = { sessions: 2000, orders: 100, contributionCents: 200000, returns: 5, supportContacts: 10, p95PageLoadMs: 1800 };

test('variant is promoted when contribution per session improves without guardrail failures', () => {
  const result = evaluateUxExperiment({ experimentId: 'product-card-cta', control, variant: { sessions: 2000, orders: 110, contributionCents: 230000, returns: 5, supportContacts: 10, p95PageLoadMs: 1850 } });
  assert.equal(result.decision, 'PROMOTE_VARIANT');
});

test('variant is stopped when it increases support contacts excessively', () => {
  const result = evaluateUxExperiment({ experimentId: 'hidden-shipping-copy', control, variant: { sessions: 2000, orders: 110, contributionCents: 240000, returns: 5, supportContacts: 30, p95PageLoadMs: 1850 } });
  assert.equal(result.decision, 'STOP_VARIANT');
  assert.ok(result.guardrailFailures.includes('SUPPORT_CONTACT_REGRESSION'));
});

test('immature experiment continues even when early lift appears positive', () => {
  const result = evaluateUxExperiment({ experimentId: 'early-test', control: { ...control, sessions: 100 }, variant: { sessions: 100, orders: 10, contributionCents: 25000, returns: 0, supportContacts: 0, p95PageLoadMs: 1800 } });
  assert.equal(result.decision, 'CONTINUE');
});

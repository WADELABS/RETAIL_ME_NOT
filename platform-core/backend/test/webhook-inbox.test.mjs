import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { acceptWebhookEvent, verifyStripeSignature } from '../src/index.mjs';

test('new provider event is queued as a durable inbox record', () => {
  const result = acceptWebhookEvent({
    provider: 'STRIPE',
    eventId: 'evt_1',
    eventType: 'payment_intent.succeeded',
    rawBody: '{"id":"evt_1"}',
    existingEventIds: new Set(),
    receivedAt: '2026-07-20T12:00:00.000Z',
  });
  assert.equal(result.accepted, true);
  assert.equal(result.record.processingState, 'RECEIVED');
  assert.equal(result.record.payloadHash.length, 64);
});

test('duplicate provider event is ignored', () => {
  const result = acceptWebhookEvent({
    provider: 'STRIPE',
    eventId: 'evt_1',
    eventType: 'payment_intent.succeeded',
    rawBody: '{"id":"evt_1"}',
    existingEventIds: new Set(['STRIPE:evt_1']),
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.state, 'DUPLICATE_IGNORED');
});


// --- PCI-DSS STRIPE CRYPTOGRAPHIC SIGNATURE VERIFICATION TESTS ---

const WEBHOOK_SECRET = 'whsec_test_secret_key_12345';
const SAMPLE_BODY = '{"id":"pi_3M3","amount":129900,"currency":"usd"}';

function generateStripeSignatureHeader(timestamp, body, secret) {
  const signedPayload = `${timestamp}.${body}`;
  const signature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

test('Stripe Signature Verification approves valid, authentic webhook signatures', () => {
  const now = Math.floor(Date.now() / 1000);
  const signatureHeader = generateStripeSignatureHeader(now, SAMPLE_BODY, WEBHOOK_SECRET);

  const isValid = verifyStripeSignature(SAMPLE_BODY, signatureHeader, WEBHOOK_SECRET);
  assert.equal(isValid, true, 'A valid signature generated with the shared secret must pass verification');
});

test('Stripe Signature Verification rejects modified/forged payloads', () => {
  const now = Math.floor(Date.now() / 1000);
  const signatureHeader = generateStripeSignatureHeader(now, SAMPLE_BODY, WEBHOOK_SECRET);

  // Attempt to pass a modified body representing a free product bypass ($0 instead of $1,299)
  const forgedBody = '{"id":"pi_3M3","amount":0,"currency":"usd"}';

  const isValid = verifyStripeSignature(forgedBody, signatureHeader, WEBHOOK_SECRET);
  assert.equal(isValid, false, 'An altered payload must fail verification, preventing billing fraud');
});

test('Stripe Signature Verification blocks replay attacks by rejecting old timestamps', () => {
  // Simulate a valid signature but from 1 hour ago (10 minutes/600s exceeds our 5-minute/300s limit)
  const oldTimestamp = Math.floor(Date.now() / 1000) - 3600;
  const signatureHeader = generateStripeSignatureHeader(oldTimestamp, SAMPLE_BODY, WEBHOOK_SECRET);

  const isValid = verifyStripeSignature(SAMPLE_BODY, signatureHeader, WEBHOOK_SECRET);
  assert.equal(isValid, false, 'Stale webhook events must be rejected to prevent replay attacks');
});

test('Stripe Signature Verification handles empty/malformed inputs safely without throwing', () => {
  // Ensure that malformed or incomplete parameters fail gracefully with a false return rather than crashing the thread
  assert.equal(verifyStripeSignature(null, 't=123,v1=abc', WEBHOOK_SECRET), false);
  assert.equal(verifyStripeSignature(SAMPLE_BODY, null, WEBHOOK_SECRET), false);
  assert.equal(verifyStripeSignature(SAMPLE_BODY, 'invalid_header_format', WEBHOOK_SECRET), false);
  assert.equal(verifyStripeSignature(SAMPLE_BODY, 't=invalid_timestamp,v1=abc', WEBHOOK_SECRET), false);
});

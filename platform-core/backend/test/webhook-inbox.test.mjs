import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptWebhookEvent } from '../src/index.mjs';

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

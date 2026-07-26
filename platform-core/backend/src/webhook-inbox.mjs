import { createHash } from 'node:crypto';

export function hashWebhookPayload(rawBody) {
  if (!(typeof rawBody === 'string' || Buffer.isBuffer(rawBody))) {
    throw new TypeError('rawBody must be a string or Buffer');
  }
  return createHash('sha256').update(rawBody).digest('hex');
}

export function acceptWebhookEvent({
  provider,
  eventId,
  eventType,
  objectId = null,
  rawBody,
  existingEventIds = new Set(),
  receivedAt = new Date(),
}) {
  if (!['STRIPE', 'MERCURY', 'DISTRIBUTOR'].includes(provider)) {
    throw new TypeError('unsupported webhook provider');
  }
  if (!eventId || typeof eventId !== 'string') throw new TypeError('eventId is required');
  if (!eventType || typeof eventType !== 'string') throw new TypeError('eventType is required');
  if (!(existingEventIds instanceof Set)) throw new TypeError('existingEventIds must be a Set');

  if (existingEventIds.has(`${provider}:${eventId}`)) {
    return {
      accepted: false,
      duplicate: true,
      state: 'DUPLICATE_IGNORED',
      provider,
      eventId,
    };
  }

  return {
    accepted: true,
    duplicate: false,
    state: 'QUEUED',
    record: {
      provider,
      eventId,
      eventType,
      objectId,
      payloadHash: hashWebhookPayload(rawBody),
      processingState: 'RECEIVED',
      attempts: 0,
      receivedAt: new Date(receivedAt).toISOString(),
    },
  };
}

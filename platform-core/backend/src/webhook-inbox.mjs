import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function hashWebhookPayload(rawBody) {
  if (!(typeof rawBody === 'string' || Buffer.isBuffer(rawBody))) {
    throw new TypeError('rawBody must be a string or Buffer');
  }
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Cryptographically verifies a Stripe Webhook signature using HMAC-SHA256
 * and constant-time equality checks to prevent timing attacks and replay attacks.
 * This is a mandatory requirement for PCI-DSS compliance under Stripe's guidelines.
 *
 * @param {string|Buffer} rawBody - The raw, unparsed request body string or Buffer.
 * @param {string} signatureHeader - The value of the 'Stripe-Signature' header.
 * @param {string} secret - The shared Stripe Webhook Secret (whsec_...).
 * @param {number} toleranceSeconds - Allowed drift for the timestamp to prevent replay attacks (default 300s / 5 mins).
 * @returns {boolean} True if the signature is valid and authentic.
 */
export function verifyStripeSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!rawBody || !signatureHeader || !secret) {
    return false;
  }

  // 1. Parse the Stripe-Signature header
  // Format: t=1492774577,v1=604646a7d6c1b7...
  const parts = signatureHeader.split(',');
  let timestampStr = '';
  let signature = '';

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') timestampStr = value;
    if (key === 'v1') signature = value;
  }

  if (!timestampStr || !signature) {
    return false;
  }

  // 2. Prevent Replay Attacks (Verify timestamp freshness)
  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);
  
  if (isNaN(timestamp) || Math.abs(now - timestamp) > toleranceSeconds) {
    console.error(`[Security Warning] Blocked Stripe webhook: Timestamp drift of ${Math.abs(now - timestamp)}s exceeds threshold of ${toleranceSeconds}s.`);
    return false;
  }

  // 3. Compute the expected HMAC signature
  // Payload is: timestamp.body
  const signedPayload = `${timestampStr}.${rawBody}`;
  const computedSignature = createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  // 4. Defend against Timing Attacks
  // Using timingSafeEqual prevents attackers from guessing the signature byte-by-byte
  const expectedBuffer = Buffer.from(computedSignature, 'utf8');
  const actualBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
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

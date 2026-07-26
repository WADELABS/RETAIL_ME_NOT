import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderPlacedEventSchema } from '@ecos/events';
import { v4 as uuidv4 } from 'uuid';

test('OrderPlacedEvent contract is valid', () => {
  const validPayload = {
    eventId: uuidv4(),
    correlationId: uuidv4(),
    timestamp: new Date().toISOString(),
    version: '1.0',
    domain: 'orders',
    eventName: 'order.placed',
    payload: {
      orderId: uuidv4(),
      customerId: uuidv4(),
      status: 'PENDING_FULFILLMENT',
      totalPriceCents: 159999,
      taxCents: 12000,
      shippingCents: 999,
      discountCents: 0,
      currency: 'USD',
      placedAt: new Date().toISOString(),
      shippingAddress: {
        recipientName: 'Jane Doe',
        line1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'US',
      },
      billingAddress: {
        recipientName: 'Jane Doe',
        line1: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        postalCode: '12345',
        country: 'US',
      },
      lineItems: [
        {
          lineItemId: uuidv4(),
          sku: 'GPU-RTX-4090',
          productTitle: 'NVIDIA GeForce RTX 4090',
          quantity: 1,
          unitPriceCents: 159999,
          totalPriceCents: 159999,
        },
      ],
    },
  };

  const result = OrderPlacedEventSchema.safeParse(validPayload);
  assert.equal(result.success, true, 'A valid OrderPlacedEvent payload should pass validation');

  const invalidPayload = { ...validPayload, payload: { ...validPayload.payload, currency: 'INVALID' } };
  const invalidResult = OrderPlacedEventSchema.safeParse(invalidPayload);
  assert.equal(invalidResult.success, false, 'An invalid OrderPlacedEvent payload should fail validation');
});

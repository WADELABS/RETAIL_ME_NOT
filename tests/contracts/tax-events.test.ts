import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TaxCalculatedEventSchema, TaxLiabilityRecordedEventSchema } from '../../packages/events/src/index';
import { v4 as uuidv4 } from 'uuid';

test('TaxCalculatedEvent contract is valid', () => {
  const validPayload = {
    eventId: uuidv4(),
    correlationId: uuidv4(),
    timestamp: new Date().toISOString(),
    version: '1.0',
    domain: 'finance',
    eventName: 'tax.calculated',
    payload: {
      orderId: uuidv4(),
      shippingState: 'TX',
      subtotalCents: 129900,
      totalTaxCents: 10392,
      calculatedAt: new Date().toISOString(),
      taxLines: [
        {
          state: 'TX',
          jurisdictionName: 'Austin',
          taxType: 'STATE', // Verifies z.enum works
          rateBps: 625,
          amountCents: 8118,
        },
        {
          state: 'TX',
          jurisdictionName: 'Austin Local',
          taxType: 'LOCAL',
          rateBps: 175,
          amountCents: 2274,
        }
      ],
    },
  };

  const result = TaxCalculatedEventSchema.safeParse(validPayload);
  assert.equal(result.success, true, 'A valid TaxCalculatedEvent payload should pass validation');

  // Verify that an invalid taxType fails validation
  const invalidPayload = {
    ...validPayload,
    payload: {
      ...validPayload.payload,
      taxLines: [{ ...validPayload.payload.taxLines[0], taxType: 'INVALID_TYPE' }]
    }
  };
  const invalidResult = TaxCalculatedEventSchema.safeParse(invalidPayload);
  assert.equal(invalidResult.success, false, 'An invalid TaxCalculatedEvent payload should fail validation');
});

test('TaxLiabilityRecordedEvent contract is valid', () => {
  const validPayload = {
    eventId: uuidv4(),
    correlationId: uuidv4(),
    timestamp: new Date().toISOString(),
    version: '1.0',
    domain: 'finance',
    eventName: 'tax.liability.recorded',
    payload: {
      orderId: uuidv4(),
      transactionId: uuidv4(),
      totalTaxCents: 10392,
      reserveAccountAction: 'TRANSFER_PENDING', // Verifies z.enum works
      recordedAt: new Date().toISOString(),
    },
  };

  const result = TaxLiabilityRecordedEventSchema.safeParse(validPayload);
  assert.equal(result.success, true, 'A valid TaxLiabilityRecordedEvent payload should pass validation');
});

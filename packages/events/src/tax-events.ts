import { z } from 'zod';

// Base schema for all events to ensure consistency
const EventBaseSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.literal('1.0'),
  domain: z.string(),
  eventName: z.string(),
  correlationId: z.string().uuid(),
});

// Detailed line item tax breakdown
const TaxLineSchema = z.object({
  state: z.string().length(2), // e.g., 'LA'
  jurisdictionName: z.string(), // e.g., 'East Baton Rouge Parish'
  taxType: z.enum(['STATE', 'LOCAL', 'SPECIAL']),
  rateBps: z.number().int().positive(), // Rate in basis points (e.g., 945 for 9.45%)
  amountCents: z.number().int().positive(),
});

// Payload for when sales tax is calculated for a pending order
const TaxCalculatedPayloadSchema = z.object({
  orderId: z.string().uuid(),
  shippingState: z.string().length(2),
  subtotalCents: z.number().int().positive(),
  totalTaxCents: z.number().int().nonnegative(),
  taxLines: z.array(TaxLineSchema),
  calculatedAt: z.string().datetime(),
});

// Full event schema for 'tax.calculated'
export const TaxCalculatedEventSchema = EventBaseSchema.extend({
  domain: z.literal('finance'),
  eventName: z.literal('tax.calculated'),
  payload: TaxCalculatedPayloadSchema,
});

export type TaxCalculatedEvent = z.infer<typeof TaxCalculatedEventSchema>;
export type TaxCalculatedPayload = z.infer<typeof TaxCalculatedPayloadSchema>;


// Payload for when tax liability is officially reserved and ledgered after payment success
const TaxLiabilityRecordedPayloadSchema = z.object({
  orderId: z.string().uuid(),
  transactionId: z.string().uuid(), // ID linking to our internal tax_transactions ledger table
  totalTaxCents: z.number().int().positive(),
  reserveAccountAction: z.enum(['TRANSFER_PENDING', 'TRANSFERRED']),
  recordedAt: z.string().datetime(),
});

export const TaxLiabilityRecordedEventSchema = EventBaseSchema.extend({
  domain: z.literal('finance'),
  eventName: z.literal('tax.liability.recorded'),
  payload: TaxLiabilityRecordedPayloadSchema,
});

export type TaxLiabilityRecordedEvent = z.infer<typeof TaxLiabilityRecordedEventSchema>;
export type TaxLiabilityRecordedPayload = z.infer<typeof TaxLiabilityRecordedPayloadSchema>;

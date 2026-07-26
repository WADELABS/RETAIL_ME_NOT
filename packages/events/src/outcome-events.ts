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

// Payload representing the actual, recorded outcome of a completed fulfillment
const FulfillmentOutcomePayloadSchema = z.object({
  outcomeId: z.string().uuid(),
  orderId: z.string().uuid(),
  providerId: z.string(), // e.g., 'DISTRIBUTOR_A'
  decisionId: z.string().uuid(), // Links back to the Decision Engine audit log

  // The Variance Evaluation metrics (Predicted vs. Actual)
  predictedDeliveryDays: z.number().int().positive(),
  actualDeliveryDays: z.number().int().positive(),
  deliveryDaysVariance: z.number().int(), // e.g., +3 if late by 3 days, -1 if early

  predictedWholesaleCostCents: z.number().int().positive(),
  actualWholesaleCostCents: z.number().int().positive(),
  costVarianceCents: z.number().int(), // e.g., positive if distributor overcharged

  status: z.enum(['SUCCESS', 'LATE', 'OVERCHARGED', 'CANCELLED']),
  recordedAt: z.string().datetime(),
});

export const FulfillmentOutcomeRecordedSchema = EventBaseSchema.extend({
  domain: z.literal('analytics'),
  eventName: z.literal('fulfillment.outcome.recorded'),
  payload: FulfillmentOutcomePayloadSchema,
});

export type FulfillmentOutcomeRecordedEvent = z.infer<typeof FulfillmentOutcomeRecordedSchema>;
export type FulfillmentOutcomeRecordedPayload = z.infer<typeof FulfillmentOutcomePayloadSchema>;

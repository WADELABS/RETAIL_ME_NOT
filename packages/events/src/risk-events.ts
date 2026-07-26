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

// Detailed line item return inspection breakdown
const ReturnInspectionPayloadSchema = z.object({
  rmaId: z.string().uuid(),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  sku: z.string(),
  // The crucial ECOS return grading, including WRONG_ITEM for fraud blacklisting
  grade: z.enum(['SEALED', 'OPEN_BOX', 'USED', 'REFURBISHED', 'WRONG_ITEM', 'DAMAGED']),
  notes: z.string(),
  inspectedAt: z.string().datetime(),
});

export const ReturnInspectionCompletedSchema = EventBaseSchema.extend({
  domain: z.literal('returns'),
  eventName: z.literal('return.inspection.completed'),
  payload: ReturnInspectionPayloadSchema,
});

export type ReturnInspectionCompletedEvent = z.infer<typeof ReturnInspectionCompletedSchema>;
export type ReturnInspectionCompletedPayload = z.infer<typeof ReturnInspectionPayloadSchema>;


// Payload for when a customer dispute (chargeback) is received from Stripe
const ChargebackDisputePayloadSchema = z.object({
  disputeId: z.string().startsWith('dp_'),
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  reason: z.string(), // e.g., 'FRAUDULENT', 'PRODUCT_NOT_RECEIVED'
  status: z.enum(['NEEDS_RESPONSE', 'UNDER_REVIEW', 'WON', 'LOST']),
  receivedAt: z.string().datetime(),
});

export const ChargebackDisputeReceivedSchema = EventBaseSchema.extend({
  domain: z.literal('finance'),
  eventName: z.literal('chargeback.dispute.received'),
  payload: ChargebackDisputePayloadSchema,
});

export type ChargebackDisputeReceivedEvent = z.infer<typeof ChargebackDisputeReceivedSchema>;
export type ChargebackDisputeReceivedPayload = z.infer<typeof ChargebackDisputePayloadSchema>;

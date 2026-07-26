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

// Schema for an item within a Supplier/Distributor Purchase Order
const PurchaseOrderItemSchema = z.object({
  poItemId: z.string().uuid(),
  sku: z.string(),
  wholesaleCostCents: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

// Payload for when a Purchase Order is created for a fulfillment provider
const PurchaseOrderCreatedPayloadSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  orderId: z.string().uuid(), // Links back to the customer's retail order
  providerId: z.string(),     // e.g., 'DISTRIBUTOR_A'
  totalWholesaleCostCents: z.number().int().positive(),
  items: z.array(PurchaseOrderItemSchema),
  status: z.literal('CREATED'),
  createdAt: z.string().datetime(),
});

// Full event schema for 'purchase_order.created'
export const PurchaseOrderCreatedEventSchema = EventBaseSchema.extend({
  domain: z.literal('procurement'),
  eventName: z.literal('purchase_order.created'),
  payload: PurchaseOrderCreatedPayloadSchema,
});

export type PurchaseOrderCreatedEvent = z.infer<typeof PurchaseOrderCreatedEventSchema>;
export type PurchaseOrderCreatedPayload = z.infer<typeof PurchaseOrderCreatedPayloadSchema>;


// Payload for when a Purchase Order is accepted by the provider's system
const PurchaseOrderAcceptedPayloadSchema = z.object({
  purchaseOrderId: z.string().uuid(),
  providerReferenceId: z.string(), // The distributor's internal order/PO reference number
  status: z.literal('ACCEPTED'),
  acceptedAt: z.string().datetime(),
});

export const PurchaseOrderAcceptedEventSchema = EventBaseSchema.extend({
  domain: z.literal('procurement'),
  eventName: z.literal('purchase_order.accepted'),
  payload: PurchaseOrderAcceptedPayloadSchema,
});

export type PurchaseOrderAcceptedEvent = z.infer<typeof PurchaseOrderAcceptedEventSchema>;
export type PurchaseOrderAcceptedPayload = z.infer<typeof PurchaseOrderAcceptedPayloadSchema>;

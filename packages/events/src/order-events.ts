import { z } from 'zod';
import { AddressSchema } from './common/address';

// Base schema for all events to ensure consistency
const EventBaseSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.literal('1.0'),
  domain: z.string(),
  eventName: z.string(),
  correlationId: z.string().uuid(),
});

// Schema for an individual line item within an order
export const OrderLineItemSchema = z.object({
  lineItemId: z.string().uuid(),
  sku: z.string(),
  productTitle: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  totalPriceCents: z.number().int().positive(),
});

// Schema for the payload of the 'order.placed' event
const OrderPlacedPayloadSchema = z.object({
  orderId: z.string().uuid(),
  customerId: z.string().uuid(),
  status: z.literal('PENDING_FULFILLMENT'),
  totalPriceCents: z.number().int().positive(),
  taxCents: z.number().int(),
  shippingCents: z.number().int(),
  discountCents: z.number().int(),
  currency: z.string().length(3),
  shippingAddress: AddressSchema,
  billingAddress: AddressSchema,
  placedAt: z.string().datetime(),
  lineItems: z.array(OrderLineItemSchema),
});

// The full schema for the 'order.placed' event
export const OrderPlacedEventSchema = EventBaseSchema.extend({
  domain: z.literal('orders'),
  eventName: z.literal('order.placed'),
  payload: OrderPlacedPayloadSchema,
});

// TypeScript types inferred from the Zod schemas
export type OrderPlacedEvent = z.infer<typeof OrderPlacedEventSchema>;
export type OrderPlacedEventPayload = z.infer<typeof OrderPlacedPayloadSchema>;


// --- STATUS UPDATE EVENT SCHEMAS ---

// Schema for the payload of the 'order.status.updated' event
const OrderStatusUpdatedPayloadSchema = z.object({
  orderId: z.string().uuid(),
  fromStatus: z.string(),
  toStatus: z.string(),
  reason: z.string(),
  timestamp: z.string().datetime(),
});

export const OrderStatusUpdatedEventSchema = EventBaseSchema.extend({
  domain: z.literal('orders'),
  eventName: z.literal('order.status.updated'),
  payload: OrderStatusUpdatedPayloadSchema,
});

export type OrderStatusUpdatedEvent = z.infer<typeof OrderStatusUpdatedEventSchema>;
export type OrderStatusUpdatedEventPayload = z.infer<typeof OrderStatusUpdatedPayloadSchema>;

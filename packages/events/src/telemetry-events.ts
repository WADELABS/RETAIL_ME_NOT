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

// Payload for when a customer performs a search
const SearchPerformedPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  query: z.string().min(1),
  matchedSkus: z.array(z.string()), // Skus displayed in search results
  timestamp: z.string().datetime(),
});

export const SearchPerformedEventSchema = EventBaseSchema.extend({
  domain: z.literal('telemetry'),
  eventName: z.literal('search.performed'),
  payload: SearchPerformedPayloadSchema,
});

export type SearchPerformedEvent = z.infer<typeof SearchPerformedEventSchema>;
export type SearchPerformedPayload = z.infer<typeof SearchPerformedPayloadSchema>;


// Payload for when a customer adds an item to their shopping cart (High buying intent indicator)
const CartItemAddedPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  sku: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().positive(),
  timestamp: z.string().datetime(),
});

export const CartItemAddedEventSchema = EventBaseSchema.extend({
  domain: z.literal('telemetry'),
  eventName: z.literal('cart.item_added'),
  payload: CartItemAddedPayloadSchema,
});

export type CartItemAddedEvent = z.infer<typeof CartItemAddedEventSchema>;
export type CartItemAddedPayload = z.infer<typeof CartItemAddedPayloadSchema>;


// Payload for when a sudden surge in demand is detected for a SKU
const DemandSpikeDetectedPayloadSchema = z.object({
  sku: z.string(),
  demandVelocityScore: z.number().positive(), // Aggregated click/search/cart score
  trendingStatus: z.enum(['TRENDING', 'HOT']),
  marginSurchargeBps: z.number().int().positive(), // Surcharge to apply (e.g., 200 bps / +2% price)
  detectedAt: z.string().datetime(),
});

export const DemandSpikeDetectedEventSchema = EventBaseSchema.extend({
  domain: z.literal('telemetry'),
  eventName: z.literal('demand.trending-spike'),
  payload: DemandSpikeDetectedPayloadSchema,
});

export type DemandSpikeDetectedEvent = z.infer<typeof DemandSpikeDetectedEventSchema>;
export type DemandSpikeDetectedPayload = z.infer<typeof DemandSpikeDetectedPayloadSchema>;

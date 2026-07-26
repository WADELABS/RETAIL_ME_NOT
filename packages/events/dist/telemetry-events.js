"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DemandSpikeDetectedEventSchema = exports.CartItemAddedEventSchema = exports.SearchPerformedEventSchema = void 0;
const zod_1 = require("zod");
// Base schema for all events to ensure consistency
const EventBaseSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    timestamp: zod_1.z.string().datetime(),
    version: zod_1.z.literal('1.0'),
    domain: zod_1.z.string(),
    eventName: zod_1.z.string(),
    correlationId: zod_1.z.string().uuid(),
});
// Payload for when a customer performs a search
const SearchPerformedPayloadSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    query: zod_1.z.string().min(1),
    matchedSkus: zod_1.z.array(zod_1.z.string()), // Skus displayed in search results
    timestamp: zod_1.z.string().datetime(),
});
exports.SearchPerformedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('telemetry'),
    eventName: zod_1.z.literal('search.performed'),
    payload: SearchPerformedPayloadSchema,
});
// Payload for when a customer adds an item to their shopping cart (High buying intent indicator)
const CartItemAddedPayloadSchema = zod_1.z.object({
    sessionId: zod_1.z.string().uuid(),
    sku: zod_1.z.string(),
    quantity: zod_1.z.number().int().positive(),
    unitPriceCents: zod_1.z.number().int().positive(),
    timestamp: zod_1.z.string().datetime(),
});
exports.CartItemAddedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('telemetry'),
    eventName: zod_1.z.literal('cart.item_added'),
    payload: CartItemAddedPayloadSchema,
});
// Payload for when a sudden surge in demand is detected for a SKU
const DemandSpikeDetectedPayloadSchema = zod_1.z.object({
    sku: zod_1.z.string(),
    demandVelocityScore: zod_1.z.number().positive(), // Aggregated click/search/cart score
    trendingStatus: zod_1.z.enum(['TRENDING', 'HOT']),
    marginSurchargeBps: zod_1.z.number().int().positive(), // Surcharge to apply (e.g., 200 bps / +2% price)
    detectedAt: zod_1.z.string().datetime(),
});
exports.DemandSpikeDetectedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('telemetry'),
    eventName: zod_1.z.literal('demand.trending-spike'),
    payload: DemandSpikeDetectedPayloadSchema,
});
//# sourceMappingURL=telemetry-events.js.map
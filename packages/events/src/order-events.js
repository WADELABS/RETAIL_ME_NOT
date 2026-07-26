"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderPlacedEventSchema = void 0;
const zod_1 = require("zod");
const address_1 = require("./common/address");
// Base schema for all events to ensure consistency
const EventBaseSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    timestamp: zod_1.z.string().datetime(),
    version: zod_1.z.literal('1.0'),
    domain: zod_1.z.string(),
    eventName: zod_1.z.string(),
    correlationId: zod_1.z.string().uuid(),
});
// Schema for an individual line item within an order
const OrderLineItemSchema = zod_1.z.object({
    lineItemId: zod_1.z.string().uuid(),
    sku: zod_1.z.string(),
    productTitle: zod_1.z.string(),
    quantity: zod_1.z.number().int().positive(),
    unitPriceCents: zod_1.z.number().int().positive(),
    totalPriceCents: zod_1.z.number().int().positive(),
});
// Schema for the payload of the 'order.placed' event
const OrderPlacedPayloadSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    customerId: zod_1.z.string().uuid(),
    status: zod_1.z.literal('PENDING_FULFILLMENT'),
    totalPriceCents: zod_1.z.number().int().positive(),
    taxCents: zod_1.z.number().int(),
    shippingCents: zod_1.z.number().int(),
    discountCents: zod_1.z.number().int(),
    currency: zod_1.z.string().length(3),
    shippingAddress: address_1.AddressSchema,
    billingAddress: address_1.AddressSchema,
    placedAt: zod_1.z.string().datetime(),
    lineItems: zod_1.z.array(OrderLineItemSchema),
});
// The full schema for the 'order.placed' event
exports.OrderPlacedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('orders'),
    eventName: zod_1.z.literal('order.placed'),
    payload: OrderPlacedPayloadSchema,
});
//# sourceMappingURL=order-events.js.map
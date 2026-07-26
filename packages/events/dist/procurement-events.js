"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseOrderAcceptedEventSchema = exports.PurchaseOrderCreatedEventSchema = void 0;
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
// Schema for an item within a Supplier/Distributor Purchase Order
const PurchaseOrderItemSchema = zod_1.z.object({
    poItemId: zod_1.z.string().uuid(),
    sku: zod_1.z.string(),
    wholesaleCostCents: zod_1.z.number().int().positive(),
    quantity: zod_1.z.number().int().positive(),
});
// Payload for when a Purchase Order is created for a fulfillment provider
const PurchaseOrderCreatedPayloadSchema = zod_1.z.object({
    purchaseOrderId: zod_1.z.string().uuid(),
    orderId: zod_1.z.string().uuid(), // Links back to the customer's retail order
    providerId: zod_1.z.string(), // e.g., 'DISTRIBUTOR_A'
    totalWholesaleCostCents: zod_1.z.number().int().positive(),
    items: zod_1.z.array(PurchaseOrderItemSchema),
    status: zod_1.z.literal('CREATED'),
    createdAt: zod_1.z.string().datetime(),
});
// Full event schema for 'purchase_order.created'
exports.PurchaseOrderCreatedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('procurement'),
    eventName: zod_1.z.literal('purchase_order.created'),
    payload: PurchaseOrderCreatedPayloadSchema,
});
// Payload for when a Purchase Order is accepted by the provider's system
const PurchaseOrderAcceptedPayloadSchema = zod_1.z.object({
    purchaseOrderId: zod_1.z.string().uuid(),
    providerReferenceId: zod_1.z.string(), // The distributor's internal order/PO reference number
    status: zod_1.z.literal('ACCEPTED'),
    acceptedAt: zod_1.z.string().datetime(),
});
exports.PurchaseOrderAcceptedEventSchema = EventBaseSchema.extend({
    domain: zod_1.z.literal('procurement'),
    eventName: zod_1.z.literal('purchase_order.accepted'),
    payload: PurchaseOrderAcceptedPayloadSchema,
});
//# sourceMappingURL=procurement-events.js.map
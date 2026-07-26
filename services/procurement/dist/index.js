"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
const index_1 = require("../../event-gateway/consumer/index");
const index_2 = require("../../event-gateway/publisher/index");
const zod_1 = require("zod");
const uuid_1 = require("uuid");
// Define a conceptual event schema for when the Fulfillment Engine assigns an order
const FulfillmentAssignedSchema = zod_1.z.object({
    eventId: zod_1.z.string().uuid(),
    timestamp: zod_1.z.string().datetime(),
    version: zod_1.z.literal('1.0'),
    domain: zod_1.z.literal('fulfillment'),
    eventName: zod_1.z.literal('fulfillment.assigned'),
    correlationId: zod_1.z.string().uuid(),
    payload: zod_1.z.object({
        orderId: zod_1.z.string().uuid(),
        providerId: zod_1.z.string(),
        items: zod_1.z.array(zod_1.z.object({
            sku: zod_1.z.string(),
            wholesaleCostCents: zod_1.z.number().int().positive(),
            quantity: zod_1.z.number().int().positive(),
        })),
    }),
});
// Initialize the Procurement Service by subscribing to the Fulfillment domain
function initialize() {
    console.log('[Procurement Service] Initializing and subscribing to fulfillment events...');
    index_1.consumer.subscribe('fulfillment', 'fulfillment.assigned', FulfillmentAssignedSchema, async (payload) => {
        console.log(`[Procurement Service] Received assignment. Creating PO for provider ${payload.providerId}`);
        const purchaseOrderId = (0, uuid_1.v4)();
        const totalCost = payload.items.reduce((sum, item) => sum + (item.wholesaleCostCents * item.quantity), 0);
        // 1. In a real implementation, we would persist this PO to our local database
        // await db('purchase_orders').insert({ purchase_order_id: purchaseOrderId, ... });
        console.log(`[Procurement Service] Saved Purchase Order ${purchaseOrderId} locally. Total: $${(totalCost / 100).toFixed(2)}`);
        // 2. Publish a 'purchase_order.created' event to the Event Bus
        await index_2.publisher.publish('procurement', 'purchase_order.created', {
            purchaseOrderId,
            orderId: payload.orderId,
            providerId: payload.providerId,
            totalWholesaleCostCents: totalCost,
            status: 'CREATED',
            createdAt: new Date().toISOString(),
            items: payload.items.map(item => ({
                poItemId: (0, uuid_1.v4)(),
                sku: item.sku,
                wholesaleCostCents: item.wholesaleCostCents,
                quantity: item.quantity,
            })),
        });
    });
}
//# sourceMappingURL=index.js.map
import { consumer } from '../../event-gateway/consumer/index';
import { publisher } from '../../event-gateway/publisher/index';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// Define a conceptual event schema for when the Fulfillment Engine assigns an order
const FulfillmentAssignedSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.literal('1.0'),
  domain: z.literal('fulfillment'),
  eventName: z.literal('fulfillment.assigned'),
  correlationId: z.string().uuid(),
  payload: z.object({
    orderId: z.string().uuid(),
    providerId: z.string(),
    items: z.array(z.object({
      sku: z.string(),
      wholesaleCostCents: z.number().int().positive(),
      quantity: z.number().int().positive(),
    })),
  }),
});

type FulfillmentAssignedEvent = z.infer<typeof FulfillmentAssignedSchema>;

// Initialize the Procurement Service by subscribing to the Fulfillment domain
export function initialize() {
  console.log('[Procurement Service] Initializing and subscribing to fulfillment events...');

  consumer.subscribe(
    'fulfillment',
    'fulfillment.assigned',
    FulfillmentAssignedSchema,
    async (payload) => {
      console.log(`[Procurement Service] Received assignment. Creating PO for provider ${payload.providerId}`);

      const purchaseOrderId = uuidv4();
      const totalCost = payload.items.reduce((sum, item) => sum + (item.wholesaleCostCents * item.quantity), 0);

      // 1. In a real implementation, we would persist this PO to our local database
      // await db('purchase_orders').insert({ purchase_order_id: purchaseOrderId, ... });
      console.log(`[Procurement Service] Saved Purchase Order ${purchaseOrderId} locally. Total: $${(totalCost / 100).toFixed(2)}`);

      // 2. Publish a 'purchase_order.created' event to the Event Bus
      await publisher.publish(
        'procurement',
        'purchase_order.created',
        {
          purchaseOrderId,
          orderId: payload.orderId,
          providerId: payload.providerId,
          totalWholesaleCostCents: totalCost,
          status: 'CREATED',
          createdAt: new Date().toISOString(),
          items: payload.items.map(item => ({
            poItemId: uuidv4(),
            sku: item.sku,
            wholesaleCostCents: item.wholesaleCostCents,
            quantity: item.quantity,
          })),
        }
      );
    }
  );
}

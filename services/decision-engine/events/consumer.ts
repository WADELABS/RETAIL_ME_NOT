import { OrderPlacedEvent, OrderPlacedEventSchema } from '@ecos/events';

// This file would contain the logic for consuming events from the event bus.
// A real implementation would use a client from a library like Kafkajs or Google Pub/Sub.

function handleOrderPlaced(event: OrderPlacedEvent) {
  // Validate the event payload at runtime to ensure data integrity
  const validationResult = OrderPlacedEventSchema.safeParse(event);
  if (!validationResult.success) {
    console.error('[Decision Engine] Invalid OrderPlacedEvent received:', validationResult.error);
    return;
  }

  console.log(`[Decision Engine] Received OrderPlacedEvent for order: ${validationResult.data.payload.orderId}`);
  // In a real system, this would trigger the resolver, evaluator, and audit logger.
}

// Example of how the consumer might be set up:
// eventBus.subscribe('orders.placed', handleOrderPlaced);


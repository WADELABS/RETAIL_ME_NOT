import { consumer } from '@ecos/event-gateway/consumer';
import { OrderPlacedEventPayload, OrderPlacedEventSchema } from '@ecos/events';
import { resolveContext } from '../engine/resolver';
import { evaluate } from '../engine/evaluator';
import { storeDecision } from '../persistence/audit-store';
import { fraudRules } from '../rules/fraud.rules';

// The consumer subscribes to events it cares about through the central gateway.
// The gateway handles the underlying bus implementation and schema validation.
consumer.subscribe(
  'orders',
  'order.placed',
  OrderPlacedEventSchema,
  async (payload: OrderPlacedEventPayload) => {
    console.log(`[Decision Engine] Processing order.placed event for order: ${payload.orderId}`);

    // 1. Resolve context from this and other related events (in a real scenario)
    const context = await resolveContext([{ type: 'order.placed', payload }]);

    // 2. Evaluate rules against the context
    // For now, we'll just run fraud rules as an example
    const decision = evaluate(context, fraudRules);
    
    // 3. Persist the decision to the audit log
    await storeDecision({
      decision: decision.decision,
      reason: decision.reason,
      confidence: decision.confidence,
      inputs: { orderId: payload.orderId }, // snapshot of inputs
    });

    // 4. Publish a new event with the decision (e.g., decision.completed)
    // publisher.publish('decision_engine', 'decision.completed', ...);
  }
);

console.log('[Decision Engine] Consumer initialized and subscribed to events.');



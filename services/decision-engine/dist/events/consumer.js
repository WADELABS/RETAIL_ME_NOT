"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("../../event-gateway/consumer/index");
const index_2 = require("../../../packages/events/src/index");
const resolver_1 = require("../engine/resolver");
const evaluator_1 = require("../engine/evaluator");
const audit_store_1 = require("../persistence/audit-store");
const fraud_rules_1 = require("../rules/fraud.rules");
// The consumer subscribes to events it cares about through the central gateway.
// The gateway handles the underlying bus implementation and schema validation.
index_1.consumer.subscribe('orders', 'order.placed', index_2.OrderPlacedEventSchema, async (payload) => {
    console.log(`[Decision Engine] Processing order.placed event for order: ${payload.orderId}`);
    // 1. Resolve context from this and other related events (in a real scenario)
    const context = await (0, resolver_1.resolveContext)([{ type: 'order.placed', payload }]);
    // 2. Evaluate rules against the context
    // For now, we'll just run fraud rules as an example
    const decision = (0, evaluator_1.evaluate)(context, fraud_rules_1.fraudRules);
    // 3. Persist the decision to the audit log
    await (0, audit_store_1.storeDecision)({
        decision: decision.decision,
        reason: decision.reason,
        confidence: decision.confidence,
        inputs: { orderId: payload.orderId }, // snapshot of inputs
    });
    // 4. Publish a new event with the decision (e.g., decision.completed)
    // publisher.publish('decision_engine', 'decision.completed', ...);
});
console.log('[Decision Engine] Consumer initialized and subscribed to events.');
//# sourceMappingURL=consumer.js.map
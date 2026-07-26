"use strict";
// The Resolver is responsible for gathering all the necessary data
// from various domain events to build the context for the evaluator.
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveContext = resolveContext;
async function resolveContext(events) {
    const context = {
        pricing: {},
        risk: {},
        inventory: {},
    };
    for (const event of events) {
        if (event.type === 'pricing.recommendation.created') {
            // In a real implementation, this would use a dedicated pricing adapter
            context.pricing = { ...event.payload };
        }
        if (event.type === 'risk.assessment.completed') {
            // In a real implementation, this would use a dedicated risk adapter
            context.risk = { ...event.payload };
        }
        // ... handle other domain events
    }
    return context;
}
//# sourceMappingURL=resolver.js.map
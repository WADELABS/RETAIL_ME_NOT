"use strict";
// Adapters are responsible for normalizing the data from domain-specific
// events into a standardized format that the Decision Engine's rules can use.
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptFraudEvent = adaptFraudEvent;
function adaptFraudEvent(event) {
    return {
        score: event.payload.risk_score,
        recommendation: event.payload.recommendation,
        // ... other normalized fields
    };
}
//# sourceMappingURL=fraud.js.map
"use strict";
// Adapters are responsible for normalizing the data from domain-specific
// events into a standardized format that the Decision Engine's rules can use.
Object.defineProperty(exports, "__esModule", { value: true });
exports.adaptPricingEvent = adaptPricingEvent;
function adaptPricingEvent(event) {
    return {
        expectedMarginBps: event.payload.expected_margin_bps,
        recommendedPriceCents: event.payload.recommended_price_cents,
        // ... other normalized fields
    };
}
//# sourceMappingURL=pricing.js.map
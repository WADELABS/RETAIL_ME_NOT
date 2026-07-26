"use strict";
// The Confidence module calculates the overall confidence score
// of a decision, potentially by looking at the confidence of
// individual rules and the completeness of the context.
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateConfidence = calculateConfidence;
function calculateConfidence(decision, context) {
    let finalConfidence = decision.confidence || 0;
    // Example: Reduce confidence if data is stale or missing
    if (!context.pricing.recommendation_id) {
        finalConfidence *= 0.9;
    }
    if (!context.risk.assessment_id) {
        finalConfidence *= 0.8;
    }
    return Math.max(0, Math.min(1, finalConfidence));
}
//# sourceMappingURL=confidence.js.map
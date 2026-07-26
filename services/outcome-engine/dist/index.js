"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutcomeEngineService = void 0;
const index_1 = require("../../event-gateway/publisher/index");
const uuid_1 = require("uuid");
class OutcomeEngineService {
    /**
     * Evaluates the outcome of a fulfillment execution by comparing actual results
     * against ECOS's original predictions. Calculates the variance and publishes an outcome event.
     */
    async evaluateOutcome(actual, predicted) {
        console.log(`[Outcome Engine] Evaluating execution outcome for Order: ${actual.orderId} (Provider: ${actual.providerId})`);
        const outcomeId = (0, uuid_1.v4)();
        const deliveryDaysVariance = actual.actualDeliveryDays - predicted.predictedDeliveryDays;
        const costVarianceCents = actual.actualWholesaleCostCents - predicted.predictedWholesaleCostCents;
        let status = 'SUCCESS';
        if (actual.isCancelled) {
            status = 'CANCELLED';
        }
        else if (costVarianceCents > 0) {
            status = 'OVERCHARGED';
        }
        else if (deliveryDaysVariance > 0) {
            status = 'LATE';
        }
        console.log(`[Outcome Engine] Evaluation complete. Outcome ID: ${outcomeId}. Status: ${status}`);
        console.log(`  - Delivery Variance: ${deliveryDaysVariance} days (Actual: ${actual.actualDeliveryDays}, Predicted: ${predicted.predictedDeliveryDays})`);
        console.log(`  - Cost Variance: $${(costVarianceCents / 100).toFixed(2)} (Actual: $${(actual.actualWholesaleCostCents / 100).toFixed(2)}, Predicted: $${(predicted.predictedWholesaleCostCents / 100).toFixed(2)})`);
        // Publish the closed-loop feedback event back to the ECOS Event Bus
        await index_1.publisher.publish('analytics', 'fulfillment.outcome.recorded', {
            outcomeId,
            orderId: actual.orderId,
            providerId: actual.providerId,
            decisionId: predicted.decisionId,
            predictedDeliveryDays: predicted.predictedDeliveryDays,
            actualDeliveryDays: actual.actualDeliveryDays,
            deliveryDaysVariance,
            predictedWholesaleCostCents: predicted.predictedWholesaleCostCents,
            actualWholesaleCostCents: actual.actualWholesaleCostCents,
            costVarianceCents,
            status,
            recordedAt: new Date().toISOString(),
        });
    }
}
exports.OutcomeEngineService = OutcomeEngineService;
//# sourceMappingURL=index.js.map
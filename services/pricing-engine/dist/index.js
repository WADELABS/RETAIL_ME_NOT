"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourcingAndPricingOptimizer = void 0;
const supplier_score_engine_mjs_1 = require("../../../platform-core/backend/src/supplier-intelligence/supplier-score-engine.mjs");
const index_1 = require("../../event-gateway/consumer/index");
const index_2 = require("../../../packages/events/src/index");
class SourcingAndPricingOptimizer {
    // Store active demand surcharges to apply real-time dynamic pricing
    activeSurcharges = new Map();
    initialize() {
        console.log('[Pricing Engine] Initializing real-time telemetry listners...');
        // Subscribe to demand spikes to dynamically adjust pricing floors
        index_1.consumer.subscribe('telemetry', 'demand.trending-spike', index_2.DemandSpikeDetectedEventSchema, async (payload) => {
            console.log(`[Pricing Engine] Dynamic Pricing Triggered: Applying +${(payload.marginSurchargeBps / 100).toFixed(1)}% surcharge to SKU: ${payload.sku}`);
            this.activeSurcharges.set(payload.sku, payload.marginSurchargeBps);
        });
    }
    /**
     * Calculates the exact, cost-aware Minimum Selling Price required to fulfill a transaction safely.
     * Solves: Price = (Base Costs + Flat Fees) / (1 - Sum of Variable Rates)
     */
    calculateMinimumViablePrice(sku, option, policy) {
        const allInCostCents = option.wholesaleCostCents + option.dropshipFeeCents + option.shippingCostCents;
        const baseCost = allInCostCents + policy.processingFlatFeeCents + policy.minimumContributionCents;
        // Check if there is an active real-time telemetry demand surcharge for this SKU
        const demandSurchargeBps = this.activeSurcharges.get(sku) || 0;
        const totalVariableBps = policy.fraudReserveBps +
            policy.returnReserveBps +
            policy.warrantyReserveBps +
            policy.processingFeeBps +
            demandSurchargeBps; // Dynamic surcharge injected
        if (totalVariableBps >= 10000) {
            throw new RangeError('Sum of variable reserves and processing fees must be less than 100%');
        }
        // Price = (allInCost + flatFee + minContribution) / (1 - variableFeeBps)
        return Math.ceil((baseCost * 10000) / (10000 - totalVariableBps));
    }
    /**
     * Scores and ranks all available sourcing options for a SKU, selecting the optimal provider.
     */
    optimize(sku, options, policy) {
        const evaluations = options.map(option => {
            const minimumPriceCents = this.calculateMinimumViablePrice(sku, option, policy);
            // Estimate expected contribution at the minimum price (proves baseline profitability)
            const expectedContributionCents = policy.minimumContributionCents;
            const expectedMarginBps = Math.floor((expectedContributionCents * 10000) / minimumPriceCents);
            // Calculate composite score using ECOS weighted operational model:
            // Profit: 20%, Reliability: 35%, Speed: 20%, Stock Confidence: 15%, Warranty: 10%
            const profitScore = Math.min(1, expectedContributionCents / 10000); // Normalize up to $100 profit
            const reliabilityScore = option.providerReliabilityScore;
            const deliveryScore = 1 - Math.min(1, option.averageShipDays / 30);
            const inventoryConfidence = Math.min(1, option.inventoryQuantity / 100) * option.providerReliabilityScore;
            const warrantyScore = option.providerType === 'OWN_WAREHOUSE' ? 0.9 : 0.6; // We prefer owned inventory warranty control
            // We call the core ECOS weighted scoring formula we implemented earlier
            const score = (0, supplier_score_engine_mjs_1.calculateSupplierScore)({
                profitScore,
                reliabilityScore,
                deliveryScore,
                inventoryConfidence,
                warrantyScore,
            });
            return {
                option,
                minimumPriceCents,
                expectedContributionCents,
                expectedMarginBps,
                score,
            };
        });
        // Sort by highest composite score first
        evaluations.sort((a, b) => b.score - a.score);
        const optimal = evaluations[0];
        return {
            sku,
            recommendedPriceCents: optimal.minimumPriceCents,
            selectedProviderId: optimal.option.providerId,
            expectedContributionCents: optimal.expectedContributionCents,
            expectedMarginBps: optimal.expectedMarginBps,
            optimizationScore: parseFloat(optimal.score.toFixed(4)),
        };
    }
}
exports.SourcingAndPricingOptimizer = SourcingAndPricingOptimizer;
//# sourceMappingURL=index.js.map
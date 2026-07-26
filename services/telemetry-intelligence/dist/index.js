"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelemetryIntelligenceService = void 0;
const index_1 = require("../../event-gateway/consumer/index");
const index_2 = require("../../event-gateway/publisher/index");
const index_3 = require("../../../packages/events/src/index");
class TelemetryIntelligenceService {
    // In-memory telemetry aggregator (replaces redis/postgres aggregate tables for local simulation)
    telemetryState = new Map();
    initialize() {
        console.log('[Telemetry Intelligence] Initializing real-time shopper telemetry service...');
        // 1. Subscribe to search.performed events
        index_1.consumer.subscribe('telemetry', 'search.performed', index_3.SearchPerformedEventSchema, async (payload) => {
            for (const sku of payload.matchedSkus) {
                await this.recordSearch(sku);
            }
        });
        // 2. Subscribe to cart.item_added events (extremely high buying intent)
        index_1.consumer.subscribe('telemetry', 'cart.item_added', index_3.CartItemAddedEventSchema, async (payload) => {
            await this.recordCartAdd(payload.sku, payload.quantity);
        });
    }
    async recordSearch(sku) {
        const state = this.getOrCreateState(sku);
        state.searches++;
        await this.evaluateDemandSpike(sku);
    }
    async recordCartAdd(sku, quantity) {
        const state = this.getOrCreateState(sku);
        state.cartAdds += quantity;
        await this.evaluateDemandSpike(sku);
    }
    getOrCreateState(sku) {
        if (!this.telemetryState.has(sku)) {
            this.telemetryState.set(sku, { searches: 0, cartAdds: 0 });
        }
        return this.telemetryState.get(sku);
    }
    /**
     * Computes the rolling Demand Velocity Score.
     * Cart additions represent absolute buying intent, so they are weighted heavily.
     * Formula: Demand Score = Searches + (CartAdditions * 5)
     */
    async evaluateDemandSpike(sku) {
        const state = this.telemetryState.get(sku);
        const score = state.searches + (state.cartAdds * 5);
        // If the demand velocity score crosses a critical threshold, flag it as TRENDING/HOT
        if (score >= 50) {
            const isHot = score >= 100;
            const status = isHot ? 'HOT' : 'TRENDING';
            // Apply a dynamic margin surcharge (e.g., +2.5% for trending, +5% for hot items)
            const surchargeBps = isHot ? 500 : 250;
            console.log(`\n[Telemetry Intelligence] 🚨 DEMAND SPIKE DETECTED for SKU: ${sku}!`);
            console.log(`  - Demand Velocity Score: ${score} (Searches: ${state.searches}, Cart Adds: ${state.cartAdds})`);
            console.log(`  - Status: ${status}. Applying automatic profit-surcharge: +${(surchargeBps / 100).toFixed(1)}%`);
            // Publish the closed-loop trending-spike event
            await index_2.publisher.publish('telemetry', 'demand.trending-spike', {
                sku,
                demandVelocityScore: score,
                trendingStatus: status,
                marginSurchargeBps: surchargeBps,
                detectedAt: new Date().toISOString(),
            });
        }
    }
}
exports.TelemetryIntelligenceService = TelemetryIntelligenceService;
//# sourceMappingURL=index.js.map
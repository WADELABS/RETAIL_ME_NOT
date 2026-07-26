import { consumer } from '../../event-gateway/consumer/index';
import { publisher } from '../../event-gateway/publisher/index';
import {
  SearchPerformedEventSchema,
  SearchPerformedPayload,
  CartItemAddedEventSchema,
  CartItemAddedPayload
} from '../../../packages/events/src/index';

export class TelemetryIntelligenceService {
  // In-memory telemetry aggregator (replaces redis/postgres aggregate tables for local simulation)
  private telemetryState: Map<string, { searches: number; cartAdds: number }> = new Map();

  public initialize(): void {
    console.log('[Telemetry Intelligence] Initializing real-time shopper telemetry service...');

    // 1. Subscribe to search.performed events
    consumer.subscribe(
      'telemetry',
      'search.performed',
      SearchPerformedEventSchema,
      async (payload: SearchPerformedPayload) => {
        for (const sku of payload.matchedSkus) {
          await this.recordSearch(sku);
        }
      }
    );

    // 2. Subscribe to cart.item_added events (extremely high buying intent)
    consumer.subscribe(
      'telemetry',
      'cart.item_added',
      CartItemAddedEventSchema,
      async (payload: CartItemAddedPayload) => {
        await this.recordCartAdd(payload.sku, payload.quantity);
      }
    );
  }

  private async recordSearch(sku: string): Promise<void> {
    const state = this.getOrCreateState(sku);
    state.searches++;
    await this.evaluateDemandSpike(sku);
  }

  private async recordCartAdd(sku: string, quantity: number): Promise<void> {
    const state = this.getOrCreateState(sku);
    state.cartAdds += quantity;
    await this.evaluateDemandSpike(sku);
  }

  private getOrCreateState(sku: string): { searches: number; cartAdds: number } {
    if (!this.telemetryState.has(sku)) {
      this.telemetryState.set(sku, { searches: 0, cartAdds: 0 });
    }
    return this.telemetryState.get(sku)!;
  }

  /**
   * Computes the rolling Demand Velocity Score.
   * Cart additions represent absolute buying intent, so they are weighted heavily.
   * Formula: Demand Score = Searches + (CartAdditions * 5)
   */
  private async evaluateDemandSpike(sku: string): Promise<void> {
    const state = this.telemetryState.get(sku)!;
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
      await publisher.publish(
        'telemetry',
        'demand.trending-spike',
        {
          sku,
          demandVelocityScore: score,
          trendingStatus: status,
          marginSurchargeBps: surchargeBps,
          detectedAt: new Date().toISOString(),
        }
      );
    }
  }
}

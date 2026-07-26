import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inMemoryEventBus } from '../packages/events/src/bus/in-memory-bus';
import { publisher } from '../services/event-gateway/publisher/index';
import { SourcingAndPricingOptimizer, SourcingOption, PricingPolicy } from '../services/pricing-engine/src/index';
import { TelemetryIntelligenceService } from '../services/telemetry-intelligence/src/index';
import { v4 as uuidv4 } from 'uuid';

const testPolicy: PricingPolicy = {
  minimumContributionCents: 7500, // $75 minimum profit
  targetMarginBps: 1500,
  fraudReserveBps: 200,
  returnReserveBps: 500,
  warrantyReserveBps: 300,
  processingFeeBps: 290,
  processingFlatFeeCents: 30,
};

test('ECOS Telemetry Dynamic Loop: Traffic Surge -> Demand Spike -> Dynamic Price Surcharge', async () => {
  console.log('\n--- STARTING ECOS REAL-TIME TELEMETRY DYNAMIC PRICING SIMULATION ---');

  const sessionId = uuidv4();
  const sku = 'GPU-RTX-5070TI-WADE';

  // 1. Initialize Sourcing Optimizer and Telemetry Intelligence
  const optimizer = new SourcingAndPricingOptimizer();
  optimizer.initialize(); // Activate telemetry listeners

  const telemetryService = new TelemetryIntelligenceService();
  telemetryService.initialize();

  const option: SourcingOption = {
    providerId: 'DISTRIBUTOR_A',
    providerType: 'DISTRIBUTOR',
    wholesaleCostCents: 80000, // $800 cost
    dropshipFeeCents: 500,
    shippingCostCents: 1500,
    averageShipDays: 2,
    providerReliabilityScore: 0.99,
    inventoryQuantity: 100,
  };

  // --- STEP 1: CALCULATE BASELINE PRICE ---
  console.log('\n[Telemetry Simulation] Calculating baseline price for standard item...');
  const basePrice = optimizer.calculateMinimumViablePrice(sku, option, testPolicy);
  
  // Base Cost = $820. Variable rate = 12.9%. Price = $895.30 / 0.871 = 102789.89 -> 102790 ($1,027.90)
  assert.equal(basePrice, 102790, 'Baseline price should equal $1,027.90');
  console.log(`[Telemetry Simulation] BASELINE PRICE: SKU: ${sku} is listed at $${(basePrice / 100).toFixed(2)}`);

  // --- STEP 2: EMIT REAL-TIME TRAFFIC SURGE (TELEMETRY) ---
  console.log('\n[Telemetry Simulation] Simulating traffic surge (10 searches, 8 cart-additions)...');

  // Emit 10 search events
  for (let i = 0; i < 10; i++) {
    await publisher.publish(
      'telemetry',
      'search.performed',
      {
        sessionId,
        query: 'rtx 5070 ti gpu',
        matchedSkus: [sku],
        timestamp: new Date().toISOString(),
      }
    );
  }

  // Emit 8 cart item additions
  for (let i = 0; i < 8; i++) {
    await publisher.publish(
      'telemetry',
      'cart.item_added',
      {
        sessionId,
        sku,
        quantity: 1,
        unitPriceCents: basePrice,
        timestamp: new Date().toISOString(),
      }
    );
  }

  // We introduce a micro-delay to allow the asynchronous Telemetry and Pricing listeners to complete
  await new Promise(resolve => setTimeout(resolve, 50));

  // --- STEP 3: EVALUATE DYNAMIC SURCHARGED PRICE ---
  console.log('\n[Telemetry Simulation] Recalculating price post-demand-spike...');
  const surchargedPrice = optimizer.calculateMinimumViablePrice(sku, option, testPolicy);

  // New Variable Rate = 12.9% + 2.5% (surcharge) = 15.4%
  // New Price = $895.30 / (1 - 0.154) = $895.30 / 0.846 = 105827.42 -> 105828 ($1,058.28)
  assert.ok(surchargedPrice > basePrice, 'Surcharged price must exceed baseline price');
  assert.equal(surchargedPrice, 105828, 'Surcharged price should equal $1,058.28');

  const extraProfitCents = surchargedPrice - basePrice;
  console.log(`[Telemetry Simulation] DYNAMIC SURCHARGED PRICE: SKU: ${sku} is now listed at $${(surchargedPrice / 100).toFixed(2)}`);
  console.log(`[Telemetry Simulation] SUCCESS: Captured an additional $${(extraProfitCents / 100).toFixed(2)} of high-demand gross profit dynamically!`);

  console.log('\n--- REAL-TIME TELEMETRY DYNAMIC PRICING SIMULATION FINISHED SUCCESSFULY ---');
});

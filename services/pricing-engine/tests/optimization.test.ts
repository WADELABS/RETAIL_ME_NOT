import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SourcingAndPricingOptimizer, SourcingOption, PricingPolicy } from '../src/index';

const testPolicy: PricingPolicy = {
  minimumContributionCents: 7500, // $75 minimum profit
  targetMarginBps: 1500,
  fraudReserveBps: 200,   // 2%
  returnReserveBps: 500,  // 5%
  warrantyReserveBps: 300, // 3%
  processingFeeBps: 290,  // 2.9%
  processingFlatFeeCents: 30,
};

test('Optimizer calculates exact cost-aware minimum selling price', () => {
  const optimizer = new SourcingAndPricingOptimizer();
  const option: SourcingOption = {
    providerId: 'DISTRIBUTOR_A',
    providerType: 'DISTRIBUTOR',
    wholesaleCostCents: 80000, // $800
    dropshipFeeCents: 500,     // $5
    shippingCostCents: 1500,   // $15
    averageShipDays: 2,
    providerReliabilityScore: 0.99,
    inventoryQuantity: 100,
  };

  // Base Cost = $800 + $5 + $15 + $0.30 + $75 = $895.30
  // Variable Rates = 2% (fraud) + 5% (return) + 3% (warranty) + 2.9% (stripe) = 12.9%
  // Price = $895.30 / (1 - 0.129) = $895.30 / 0.871 = 102789.89 -> ceil(102790)
  const price = optimizer.calculateMinimumViablePrice('LAPTOP-WADE-01', option, testPolicy);
  assert.equal(price, 102790);
});

test('Optimizer correctly prioritizes higher reliability over lower cost', () => {
  const optimizer = new SourcingAndPricingOptimizer();

  const options: SourcingOption[] = [
    {
      providerId: 'CHEAP_BUT_UNRELIABLE_DISTRIBUTOR',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 78000,  // $780 (Cheaper)
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 10,        // Slow (10 days)
      providerReliabilityScore: 0.75, // Low reliability (75%)
      inventoryQuantity: 20,
    },
    {
      providerId: 'EXPENSIVE_BUT_RELIABLE_DISTRIBUTOR',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 80000,  // $800 (More expensive)
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 2,         // Fast (2 days)
      providerReliabilityScore: 0.99, // High reliability (99%)
      inventoryQuantity: 100,     // Deep stock
    }
  ];

  const result = optimizer.optimize('LAPTOP-WADE-01', options, testPolicy);

  // The engine should select the reliable distributor despite the higher cost,
  // because reliability and speed are weighted heavily to guarantee fulfillment success.
  assert.equal(result.selectedProviderId, 'EXPENSIVE_BUT_RELIABLE_DISTRIBUTOR', 'Should choose the reliable provider');
  assert.ok(result.optimizationScore > 0.85, `Expected high optimization score, got: ${result.optimizationScore}`);
});

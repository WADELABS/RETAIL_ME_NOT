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

  const price = optimizer.calculateMinimumViablePrice('LAPTOP-WADE-01', option, testPolicy);
  assert.equal(price, 102790);
});

test('Optimizer correctly prioritizes higher reliability over lower cost', () => {
  const optimizer = new SourcingAndPricingOptimizer();

  const options: SourcingOption[] = [
    {
      providerId: 'CHEAP_BUT_UNRELIABLE_DISTRIBUTOR',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 78000,
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 10,
      providerReliabilityScore: 0.75,
      inventoryQuantity: 20,
    },
    {
      providerId: 'EXPENSIVE_BUT_RELIABLE_DISTRIBUTOR',
      providerType: 'DISTRIBUTOR',
      wholesaleCostCents: 80000,
      dropshipFeeCents: 500,
      shippingCostCents: 1500,
      averageShipDays: 2,
      providerReliabilityScore: 0.99,
      inventoryQuantity: 100,
    }
  ];

  const result = optimizer.optimize('LAPTOP-WADE-01', options, testPolicy);
  assert.equal(result.selectedProviderId, 'EXPENSIVE_BUT_RELIABLE_DISTRIBUTOR');
  assert.ok(result.optimizationScore > 0.85);
});

// --- CRITIQUE 5: STRICT BOUNDARY & EDGE-CASE MATHEMATICAL TESTS ---

test('Pricing Engine protects against division-by-zero on 100% combined variable fees', () => {
  const optimizer = new SourcingAndPricingOptimizer();
  const option: SourcingOption = {
    providerId: 'DISTRIBUTOR_A',
    providerType: 'DISTRIBUTOR',
    wholesaleCostCents: 10000,
    dropshipFeeCents: 0,
    shippingCostCents: 0,
    averageShipDays: 1,
    providerReliabilityScore: 0.99,
    inventoryQuantity: 100,
  };

  // Construct an extreme, invalid policy where variable fees equal or exceed 100% (10,000 bps)
  const brokenPolicy: PricingPolicy = {
    ...testPolicy,
    fraudReserveBps: 5000,  // 50%
    returnReserveBps: 5000, // 50% (Total: 100% variable rate!)
  };

  // The engine must actively block the calculation and throw a RangeError rather than dividing by zero or infinite pricing
  assert.throws(
    () => {
      optimizer.calculateMinimumViablePrice('LAPTOP-WADE-01', option, brokenPolicy);
    },
    RangeError,
    'Combined variable rates of 100% or more must fail-safe and throw a RangeError'
  );
});

test('Pricing Engine handles zero cost products correctly (e.g., free promotional items)', () => {
  const optimizer = new SourcingAndPricingOptimizer();
  
  // Sourcing option with zero wholesale, dropship, or shipping costs
  const freeOption: SourcingOption = {
    providerId: 'FREE_PROMO_NODE',
    providerType: 'OWN_WAREHOUSE',
    wholesaleCostCents: 0,
    dropshipFeeCents: 0,
    shippingCostCents: 0,
    averageShipDays: 1,
    providerReliabilityScore: 1.0,
    inventoryQuantity: 10,
  };

  // Under a standard policy, a $0 product must still be priced high enough to cover flat fees and minimum profit
  const price = optimizer.calculateMinimumViablePrice('PROMO-STICKER-01', freeOption, testPolicy);
  
  // Base Cost = $0 + $0 + $0 + $0.30 + $75.00 = $75.30
  // Variable Rates = 12.9%
  // Price = $75.30 / 0.871 = 8645.2 -> 8646 ($86.46)
  assert.equal(price, 8646, 'A free cost item must still be priced correctly to cover minimum contribution and fees');
});

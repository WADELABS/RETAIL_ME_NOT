import { InventoryNode } from '@ecos/inventory-availability';
import { calculateSupplierScore } from '../../../platform-core/backend/src/supplier-intelligence/supplier-score-engine.mjs';
import { consumer } from '../../event-gateway/consumer/index';
import { DemandSpikeDetectedEventSchema, DemandSpikeDetectedPayload } from '../../../packages/events/src/index';

export interface SourcingOption {
  providerId: string;
  providerType: 'OWN_WAREHOUSE' | 'DISTRIBUTOR' | '3PL';
  wholesaleCostCents: number;
  dropshipFeeCents: number;
  shippingCostCents: number;
  averageShipDays: number;
  providerReliabilityScore: number;
  inventoryQuantity: number;
}

export interface PricingPolicy {
  minimumContributionCents: number;
  targetMarginBps: number;
  fraudReserveBps: number;
  returnReserveBps: number;
  warrantyReserveBps: number;
  processingFeeBps: number;
  processingFlatFeeCents: number;
}

export interface OptimizationRecommendation {
  sku: string;
  recommendedPriceCents: number;
  selectedProviderId: string;
  expectedContributionCents: number;
  expectedMarginBps: number;
  optimizationScore: number;
}

export interface NetProfitMetrics {
  sellingPriceCents: number;
  stripeFeeCents: number;
  wholesaleCOGS: number;
  allocatedReservesCents: number;
  netProfitCents: number;
  netMarginPercentage: number;
}

export class SourcingAndPricingOptimizer {
  // Store active demand surcharges to apply real-time dynamic pricing
  private activeSurcharges: Map<string, number> = new Map();

  public initialize(): void {
    console.log('[Pricing Engine] Initializing real-time telemetry listners...');

    // Subscribe to demand spikes to dynamically adjust pricing floors
    consumer.subscribe(
      'telemetry',
      'demand.trending-spike',
      DemandSpikeDetectedEventSchema,
      async (payload: DemandSpikeDetectedPayload) => {
        console.log(`[Pricing Engine] Dynamic Pricing Triggered: Applying +${(payload.marginSurchargeBps / 100).toFixed(1)}% surcharge to SKU: ${payload.sku}`);
        this.activeSurcharges.set(payload.sku, payload.marginSurchargeBps);
      }
    );
  }

  /**
   * Calculates the exact, cost-aware Minimum Selling Price required to fulfill a transaction safely.
   * Solves: Price = (Base Costs + Flat Fees) / (1 - Sum of Variable Rates)
   */
  public calculateMinimumViablePrice(sku: string, option: SourcingOption, policy: PricingPolicy): number {
    const allInCostCents = option.wholesaleCostCents + option.dropshipFeeCents + option.shippingCostCents;
    const baseCost = allInCostCents + policy.processingFlatFeeCents + policy.minimumContributionCents;

    // Check if there is an active real-time telemetry demand surcharge for this SKU
    const demandSurchargeBps = this.activeSurcharges.get(sku) || 0;

    const totalVariableBps =
      policy.fraudReserveBps +
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
   * FEE CALCULATION HOOKS: Calculates the exact, real-world expected net profit and margin
   * for a proposed retail selling price, factoring in Stripe's gateway processing fees and distributor costs.
   */
  public calculateExpectedNetProfit(
    sku: string,
    proposedPriceCents: number,
    option: SourcingOption,
    policy: PricingPolicy
  ): NetProfitMetrics {
    console.log(`[Pricing Engine] Calculating net profits for SKU: ${sku} at proposed price: $${(proposedPriceCents / 100).toFixed(2)}`);

    // 1. Calculate Stripe Processing Fee (2.9% + $0.30)
    const stripeFeeCents = Math.round((proposedPriceCents * policy.processingFeeBps) / 10000) + policy.processingFlatFeeCents;

    // 2. Calculate Distributor COGS (Wholesale + Dropship + Shipping)
    const wholesaleCOGS = option.wholesaleCostCents + option.dropshipFeeCents + option.shippingCostCents;

    // 3. Calculate Operational Reserves (Fraud, Return, Warranty)
    const demandSurchargeBps = this.activeSurcharges.get(sku) || 0;
    const totalReserveBps = policy.fraudReserveBps + policy.returnReserveBps + policy.warrantyReserveBps + demandSurchargeBps;
    const allocatedReservesCents = Math.round((proposedPriceCents * totalReserveBps) / 10000);

    // 4. Calculate Net Profit (Selling Price - Stripe Fees - Distributor COGS - Reserves)
    const netProfitCents = proposedPriceCents - stripeFeeCents - wholesaleCOGS - allocatedReservesCents;
    const netMarginPercentage = (netProfitCents / proposedPriceCents) * 100;

    console.log(`[Pricing Engine] Margin Analysis Complete:`);
    console.log(`  - Proposed Price: $${(proposedPriceCents / 100).toFixed(2)}`);
    console.log(`  - Stripe Fee: $${(stripeFeeCents / 100).toFixed(2)}`);
    console.log(`  - Supplier COGS: $${(wholesaleCOGS / 100).toFixed(2)}`);
    console.log(`  - Allocated Reserves: $${(allocatedReservesCents / 100).toFixed(2)}`);
    console.log(`  - Net Profit Cents: $${(netProfitCents / 100).toFixed(2)} (Margin: ${netMarginPercentage.toFixed(2)}%)`);

    return {
      sellingPriceCents: proposedPriceCents,
      stripeFeeCents,
      wholesaleCOGS,
      allocatedReservesCents,
      netProfitCents,
      netMarginPercentage,
    };
  }

  /**
   * Scores and ranks all available sourcing options for a SKU, selecting the optimal provider.
   */
  public optimize(sku: string, options: SourcingOption[], policy: PricingPolicy): OptimizationRecommendation {
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
      const score = calculateSupplierScore({
        profitScore,
        reliabilityScore,
        deliveryScore,
        inventoryConfidence,
        warrantyScore,
        riskPenalty: 0,
      });

      return {
        sku,
        recommendedPriceCents: minimumPriceCents,
        selectedProviderId: option.providerId,
        expectedContributionCents,
        expectedMarginBps,
        optimizationScore: score,
      };
    });

    // Select the provider with the highest score
    return evaluations.reduce((best, current) => current.optimizationScore > best.optimizationScore ? current : best, evaluations[0]);
  }
}

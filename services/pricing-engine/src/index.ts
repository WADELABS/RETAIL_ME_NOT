import { InventoryNode } from '@ecos/inventory-availability';
import { calculateSupplierScore } from '../../../platform-core/backend/src/supplier-intelligence/supplier-score-engine.mjs';

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

export class SourcingAndPricingOptimizer {
  /**
   * Calculates the exact, cost-aware Minimum Selling Price required to fulfill a transaction safely.
   * Solves: Price = (Base Costs + Flat Fees) / (1 - Sum of Variable Rates)
   */
  public calculateMinimumViablePrice(option: SourcingOption, policy: PricingPolicy): number {
    const allInCostCents = option.wholesaleCostCents + option.dropshipFeeCents + option.shippingCostCents;
    const baseCost = allInCostCents + policy.processingFlatFeeCents + policy.minimumContributionCents;

    const totalVariableBps =
      policy.fraudReserveBps +
      policy.returnReserveBps +
      policy.warrantyReserveBps +
      policy.processingFeeBps;

    if (totalVariableBps >= 10000) {
      throw new RangeError('Sum of variable reserves and processing fees must be less than 100%');
    }

    // Price = (allInCost + flatFee + minContribution) / (1 - variableFeeBps)
    return Math.ceil((baseCost * 10000) / (10000 - totalVariableBps));
  }

  /**
   * Scores and ranks all available sourcing options for a SKU, selecting the optimal provider.
   */
  public optimize(sku: string, options: SourcingOption[], policy: PricingPolicy): OptimizationRecommendation {
    const evaluations = options.map(option => {
      const minimumPriceCents = this.calculateMinimumViablePrice(option, policy);

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

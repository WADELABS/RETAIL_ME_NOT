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
export declare class SourcingAndPricingOptimizer {
    private activeSurcharges;
    initialize(): void;
    /**
     * Calculates the exact, cost-aware Minimum Selling Price required to fulfill a transaction safely.
     * Solves: Price = (Base Costs + Flat Fees) / (1 - Sum of Variable Rates)
     */
    calculateMinimumViablePrice(sku: string, option: SourcingOption, policy: PricingPolicy): number;
    /**
     * Scores and ranks all available sourcing options for a SKU, selecting the optimal provider.
     */
    optimize(sku: string, options: SourcingOption[], policy: PricingPolicy): OptimizationRecommendation;
}

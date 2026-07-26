import { Address } from '@ecos/events';
export interface TaxCalculationRequest {
    orderId: string;
    customerAddress: Address;
    shippingAddress: Address;
    subtotalCents: number;
    items: Array<{
        sku: string;
        category: string;
        quantity: number;
        unitPriceCents: number;
    }>;
}
export interface TaxLine {
    state: string;
    jurisdictionName: string;
    taxType: 'STATE' | 'LOCAL' | 'SPECIAL';
    rateBps: number;
    amountCents: number;
}
export interface TaxCalculationResult {
    totalTaxCents: number;
    taxLines: TaxLine[];
    providerTransactionId: string;
}
export interface NexusStatus {
    state: string;
    hasNexus: boolean;
    reason: 'ECONOMIC_THRESHOLD_MET' | 'PHYSICAL_PRESENCE' | 'NO_NEXUS';
}
export interface TaxProvider {
    id: string;
    name: string;
    calculateSalesTax(request: TaxCalculationRequest): Promise<TaxCalculationResult>;
    evaluateNexus(state: string, historicalSalesCents: number, historicalTransactionCount: number): Promise<NexusStatus>;
    validateTaxAddress(address: Address): Promise<{
        isValid: boolean;
        normalizedAddress?: Address;
    }>;
    commitTaxTransaction(providerTransactionId: string): Promise<{
        status: 'COMMITTED' | 'FAILED';
    }>;
}

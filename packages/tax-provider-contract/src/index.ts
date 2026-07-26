import { Address } from '@ecos/events';

export interface TaxCalculationRequest {
  orderId: string;
  customerAddress: Address;
  shippingAddress: Address;
  subtotalCents: number;
  items: Array<{
    sku: string;
    category: string; // Used for state tax category mapping (e.g., 'computer_equipment')
    quantity: number;
    unitPriceCents: number;
  }>;
}

export interface TaxLine {
  state: string;            // e.g., 'TX'
  jurisdictionName: string; // e.g., 'Austin'
  taxType: 'STATE' | 'LOCAL' | 'SPECIAL';
  rateBps: number;          // e.g., 625 for 6.25%
  amountCents: number;
}

export interface TaxCalculationResult {
  totalTaxCents: number;
  taxLines: TaxLine[];
  providerTransactionId: string; // Reference ID from the tax provider (e.g., Avalara doc code)
}

export interface NexusStatus {
  state: string;
  hasNexus: boolean;
  reason: 'ECONOMIC_THRESHOLD_MET' | 'PHYSICAL_PRESENCE' | 'NO_NEXUS';
}

export interface TaxProvider {
  id: string; // e.g., 'AVALARA', 'TAXJAR', 'INTERNAL_FALLBACK'
  name: string;

  // Primary operational calculations
  calculateSalesTax(request: TaxCalculationRequest): Promise<TaxCalculationResult>;
  
  // Compliance and audit operations
  evaluateNexus(state: string, historicalSalesCents: number, historicalTransactionCount: number): Promise<NexusStatus>;
  validateTaxAddress(address: Address): Promise<{ isValid: boolean; normalizedAddress?: Address }>;
  commitTaxTransaction(providerTransactionId: string): Promise<{ status: 'COMMITTED' | 'FAILED' }>;
}

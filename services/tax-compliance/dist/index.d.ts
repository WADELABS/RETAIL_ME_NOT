import { TaxProvider, TaxCalculationRequest } from '../../../packages/tax-provider-contract/src/index';
export declare class TaxComplianceService {
    private taxProvider;
    constructor(taxProvider: TaxProvider);
    initialize(): void;
    /**
     * Proactive calculation called during the checkout/sales order creation process.
     */
    calculateOrderTax(request: TaxCalculationRequest): Promise<import("../../../packages/tax-provider-contract/src/index").TaxCalculationResult>;
    /**
     * Reactive ledger and reserve action taken when an order is finalized/paid.
     */
    private recordTaxLiability;
}

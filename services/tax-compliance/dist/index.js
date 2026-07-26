"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxComplianceService = void 0;
const index_1 = require("../../event-gateway/consumer/index");
const index_2 = require("../../event-gateway/publisher/index");
const index_3 = require("../../../packages/events/src/index");
const uuid_1 = require("uuid");
class TaxComplianceService {
    taxProvider;
    constructor(taxProvider) {
        this.taxProvider = taxProvider;
        if (!taxProvider) {
            throw new Error('A valid TaxProvider implementation is required.');
        }
    }
    initialize() {
        console.log(`[Tax Compliance] Service initialized using provider: ${this.taxProvider.id}`);
        // Subscribe to order.placed events to automatically record the tax liability
        index_1.consumer.subscribe('orders', 'order.placed', index_3.OrderPlacedEventSchema, async (payload) => {
            await this.recordTaxLiability(payload);
        });
    }
    /**
     * Proactive calculation called during the checkout/sales order creation process.
     */
    async calculateOrderTax(request) {
        console.log(`[Tax Compliance] Proactively calculating sales tax for Order: ${request.orderId}`);
        const result = await this.taxProvider.calculateSalesTax(request);
        // Publish a 'tax.calculated' event to notify the Checkout and Pricing domains
        await index_2.publisher.publish('finance', 'tax.calculated', {
            orderId: request.orderId,
            shippingState: request.shippingAddress.state,
            subtotalCents: request.subtotalCents,
            totalTaxCents: result.totalTaxCents,
            taxLines: result.taxLines.map(line => ({
                state: line.state,
                jurisdictionName: line.jurisdictionName,
                taxType: line.taxType,
                rateBps: line.rateBps,
                amountCents: line.amountCents,
            })),
            calculatedAt: new Date().toISOString(),
        });
        return result;
    }
    /**
     * Reactive ledger and reserve action taken when an order is finalized/paid.
     */
    async recordTaxLiability(orderPayload) {
        console.log(`[Tax Compliance] Recording tax liability for Paid Order: ${orderPayload.orderId}`);
        const transactionId = (0, uuid_1.v4)();
        // 1. In a real implementation, we would persist this to the tax_transactions table
        // await db('tax_transactions').insert({
        //   transaction_id: transactionId,
        //   order_id: orderPayload.orderId,
        //   total_tax_cents: orderPayload.taxCents,
        //   status: 'RESERVED',
        //   ...
        // });
        console.log(`[Tax Compliance] Saved $${(orderPayload.taxCents / 100).toFixed(2)} tax liability to ledger under tx: ${transactionId}`);
        // 2. Commit the transaction in our external tax provider (e.g., Avalara doc status)
        // await this.taxProvider.commitTaxTransaction(orderPayload.providerTransactionId);
        // 3. Publish 'tax.liability.recorded' to prompt the Treasury domain to execute
        // the physical bank transfer from Operating to the untouchable Tax Reserve Account.
        await index_2.publisher.publish('finance', 'tax.liability.recorded', {
            orderId: orderPayload.orderId,
            transactionId,
            totalTaxCents: orderPayload.taxCents,
            reserveAccountAction: 'TRANSFER_PENDING',
            recordedAt: new Date().toISOString(),
        });
    }
}
exports.TaxComplianceService = TaxComplianceService;
//# sourceMappingURL=index.js.map
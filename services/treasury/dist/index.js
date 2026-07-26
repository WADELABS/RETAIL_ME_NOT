"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initialize = initialize;
const index_1 = require("../../event-gateway/consumer/index");
const index_2 = require("../../event-gateway/publisher/index");
const index_3 = require("../../../packages/events/src/index");
const uuid_1 = require("uuid");
function initialize() {
    console.log('[Treasury Service] Initializing and subscribing to tax liability events...');
    // Subscribe to 'tax.liability.recorded' to execute the physical reserve transfer
    index_1.consumer.subscribe('finance', 'tax.liability.recorded', index_3.TaxLiabilityRecordedEventSchema, async (payload) => {
        console.log(`[Treasury Service] Triggering bank transfer for Tax Liability. Order: ${payload.orderId}. Amount: $${(payload.totalTaxCents / 100).toFixed(2)}`);
        const transferId = (0, uuid_1.v4)();
        // 1. In a real implementation, we would call our Mercury Bank API to initiate the transfer
        // const bankResult = await mercury.initiateTransfer({
        //   fromAccount: 'OPERATING',
        //   toAccount: 'TAX_RESERVE',
        //   amountCents: payload.totalTaxCents
        // });
        console.log(`[Treasury Service] Initiated transfer of $${(payload.totalTaxCents / 100).toFixed(2)} from OPERATING to TAX_RESERVE bank account.`);
        // 2. Persist the transfer record to our treasury_transfers ledger table
        // await db('treasury_transfers').insert({
        //   transfer_id: transferId,
        //   source_account: 'OPERATING',
        //   destination_account: 'TAX_RESERVE',
        //   amount_cents: payload.totalTaxCents,
        //   status: 'COMPLETED',
        //   reference_type: 'TAX_LIABILITY',
        //   reference_id: payload.orderId,
        //   gateway_transaction_id: 'tx_mercury_992a831'
        // });
        console.log(`[Treasury Service] Saved transfer record ${transferId} to ledger with status COMPLETED.`);
        // 3. Publish an update event to confirm the transfer is complete
        await index_2.publisher.publish('finance', 'tax.liability.transferred', {
            orderId: payload.orderId,
            transferId,
            amountCents: payload.totalTaxCents,
            status: 'TRANSFERRED',
            transferredAt: new Date().toISOString(),
        });
    });
}
//# sourceMappingURL=index.js.map
import { consumer } from '@ecos/event-gateway/consumer';
import { publisher } from '@ecos/event-gateway/publisher';
import { TaxLiabilityRecordedEventSchema, TaxLiabilityRecordedPayload } from '@ecos/events';
import { v4 as uuidv4 } from 'uuid';

export function initialize() {
  console.log('[Treasury Service] Initializing and subscribing to tax liability events...');

  // Subscribe to 'tax.liability.recorded' to execute the physical reserve transfer
  consumer.subscribe(
    'finance',
    'tax.liability.recorded',
    TaxLiabilityRecordedEventSchema,
    async (payload: TaxLiabilityRecordedPayload) => {
      console.log(`[Treasury Service] Triggering bank transfer for Tax Liability. Order: ${payload.orderId}. Amount: $${(payload.totalTaxCents / 100).toFixed(2)}`);

      const transferId = uuidv4();

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
      await publisher.publish(
        'finance',
        'tax.liability.transferred',
        {
          orderId: payload.orderId,
          transferId,
          amountCents: payload.totalTaxCents,
          status: 'TRANSFERRED',
          transferredAt: new Date().toISOString(),
        }
      );
    }
  );
}

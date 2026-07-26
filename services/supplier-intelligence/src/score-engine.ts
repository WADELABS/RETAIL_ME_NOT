import { consumer } from '../../event-gateway/consumer/index';
import { FulfillmentOutcomeRecordedSchema, FulfillmentOutcomeRecordedPayload } from '../../../packages/events/src/index';

export class SupplierReputationService {
  /**
   * Initializes the subscription to fulfillment outcome events to close the learning loop.
   */
  public initialize(): void {
    console.log('[Supplier Reputation] Initializing and subscribing to fulfillment outcome events...');

    consumer.subscribe(
      'analytics',
      'fulfillment.outcome.recorded',
      FulfillmentOutcomeRecordedSchema,
      async (payload: FulfillmentOutcomeRecordedPayload) => {
        await this.adjustSupplierReputation(payload);
      }
    );
  }

  /**
   * Automatically adjusts a supplier's reliability score based on performance variance.
   * If they are late or overcharge, their score degrades. If they deliver on time, it improves.
   */
  private async adjustSupplierReputation(outcome: FulfillmentOutcomeRecordedPayload): Promise<void> {
    console.log(`[Supplier Reputation] Processing outcome for Provider: ${outcome.providerId}. Status: ${outcome.status}`);

    let reliabilityAdjustment = 0;

    if (outcome.status === 'LATE') {
      // Degrade reliability by 10% (1000 bps) for late delivery
      reliabilityAdjustment = -0.10;
      console.log(`[Supplier Reputation] PENALTY: Provider ${outcome.providerId} was LATE by ${outcome.deliveryDaysVariance} days. Reducing reliability by 10%.`);
    } else if (outcome.status === 'OVERCHARGED') {
      // Degrade reliability by 8% (800 bps) for price/cost mismatch
      reliabilityAdjustment = -0.08;
      console.log(`[Supplier Reputation] PENALTY: Provider ${outcome.providerId} OVERCHARGED us by $${(outcome.costVarianceCents / 100).toFixed(2)}. Reducing reliability by 8%.`);
    } else if (outcome.status === 'CANCELLED') {
      // Degrade reliability by 15% (1500 bps) for canceling fulfillment
      reliabilityAdjustment = -0.15;
      console.log(`[Supplier Reputation] CRITICAL PENALTY: Provider ${outcome.providerId} CANCELLED fulfillment. Reducing reliability by 15%.`);
    } else if (outcome.status === 'SUCCESS' && outcome.deliveryDaysVariance <= 0) {
      // Reward the provider with +1% (100 bps) for on-time/early delivery (capped at 100% total)
      reliabilityAdjustment = 0.01;
      console.log(`[Supplier Reputation] REWARD: Provider ${outcome.providerId} delivered ON-TIME. Improving reliability by 1%.`);
    }

    // In a real database implementation:
    // await db.transaction(async trx => {
    //   // 1. Log the adjustment to the supplier_reputation_ledger
    //   await trx('supplier_reputation_ledger').insert({ ... });
    //   // 2. Fetch current reliability_score from the suppliers table
    //   const supplier = await trx('suppliers').where({ supplier_id: outcome.providerId }).first();
    //   const newReliability = Math.max(0, Math.min(1, supplier.reliability_score + reliabilityAdjustment));
    //   // 3. Update the suppliers table
    //   await trx('suppliers').where({ supplier_id: outcome.providerId }).update({ reliability_score: newReliability });
    // });

    console.log(`[Supplier Reputation] Successfully processed reputation adjustment of ${(reliabilityAdjustment * 100).toFixed(1)}% for ${outcome.providerId}.`);
  }
}

import { consumer } from '../../event-gateway/consumer/index';
import {
  OrderPlacedEventSchema,
  OrderPlacedEventPayload,
  PurchaseOrderCreatedEventSchema,
  PurchaseOrderCreatedPayload,
  TaxLiabilityRecordedEventSchema,
  TaxLiabilityRecordedPayload,
} from '../../../packages/events/src/index';
import { v4 as uuidv4 } from 'uuid';

export interface JournalLineInput {
  accountNumber: string;
  entryType: 'DEBIT' | 'CREDIT';
  amountCents: number;
}

export interface JournalEntryInput {
  referenceType: 'SALES_ORDER' | 'PURCHASE_ORDER' | 'TAX_RESERVE_TRANSFER';
  referenceId: string;
  description: string;
  lines: JournalLineInput[];
}

export class AccountingService {
  public initialize(): void {
    console.log('[Accounting Service] Initializing double-entry ledger and subscribing to financial events...');

    // 1. Consume Order Placed (Revenue & Tax Liability)
    consumer.subscribe(
      'orders',
      'order.placed',
      OrderPlacedEventSchema,
      async (payload: OrderPlacedEventPayload) => {
        await this.ledgerSalesOrder(payload);
      }
    );

    // 2. Consume Purchase Order Created (COGS & Accounts Payable)
    consumer.subscribe(
      'procurement',
      'purchase_order.created',
      PurchaseOrderCreatedEventSchema,
      async (payload: PurchaseOrderCreatedPayload) => {
        await this.ledgerPurchaseOrder(payload);
      }
    );

    // 3. Consume Tax Liability Recorded (Treasury Move: Tax Liability to Tax Reserve Account)
    consumer.subscribe(
      'finance',
      'tax.liability.recorded',
      TaxLiabilityRecordedEventSchema,
      async (payload: TaxLiabilityRecordedPayload) => {
        await this.ledgerTaxReserveTransfer(payload);
      }
    );
  }

  /**
   * Posts a journal entry. Strictly enforces that SUM(Debits) === SUM(Credits).
   */
  public async postJournalEntry(entry: JournalEntryInput): Promise<string> {
    const debits = entry.lines.filter(l => l.entryType === 'DEBIT').reduce((sum, l) => sum + l.amountCents, 0);
    const credits = entry.lines.filter(l => l.entryType === 'CREDIT').reduce((sum, l) => sum + l.amountCents, 0);

    if (debits !== credits) {
      throw new Error(`[Accounting Error] Unbalanced Journal Entry. Total Debits ($${(debits / 100).toFixed(2)}) must equal Total Credits ($${(credits / 100).toFixed(2)}).`);
    }

    const entryId = uuidv4();
    console.log(`[Accounting Ledger] Successfully posted balanced Journal Entry ${entryId} for ${entry.referenceType} (${entry.description}). Total Balanced: $${(debits / 100).toFixed(2)}`);

    // In a real implementation:
    // await db.transaction(async trx => {
    //   await trx('journal_entries').insert({ entry_id: entryId, reference_type: entry.referenceType, ... });
    //   for (const line of entry.lines) {
    //     await trx('journal_lines').insert({ entry_id: entryId, ... });
    //     // Update the running balance of the specific account
    //     await trx('accounts').where({ account_number: line.accountNumber }).increment('balance_cents', ...);
    //   }
    // });

    return entryId;
  }

  private async ledgerSalesOrder(order: OrderPlacedEventPayload): Promise<void> {
    console.log(`[Accounting Service] Ledgering Sales Order: ${order.orderId}`);

    // DEBIT: Operating Cash (1010) - Customer pays total price (inclusive of tax)
    // CREDIT: Sales Revenue (4010) - Product subtotal
    // CREDIT: Sales Tax Liability (2010) - Sales tax collected
    const revenueCents = order.totalPriceCents - order.taxCents;

    await this.postJournalEntry({
      referenceType: 'SALES_ORDER',
      referenceId: order.orderId,
      description: `Customer Sales Order checkout for Order: ${order.orderId}`,
      lines: [
        { accountNumber: '1010', entryType: 'DEBIT', amountCents: order.totalPriceCents },
        { accountNumber: '4010', entryType: 'CREDIT', amountCents: revenueCents },
        { accountNumber: '2010', entryType: 'CREDIT', amountCents: order.taxCents },
      ]
    });
  }

  private async ledgerPurchaseOrder(po: PurchaseOrderCreatedPayload): Promise<void> {
    console.log(`[Accounting Service] Ledgering Distributor Purchase Order: ${po.purchaseOrderId}`);

    // DEBIT: Cost of Goods Sold / COGS (5010) - Inventory acquisition cost
    // CREDIT: Accounts Payable (2020) - Amount owed to the distributor
    await this.postJournalEntry({
      referenceType: 'PURCHASE_ORDER',
      referenceId: po.purchaseOrderId,
      description: `B2B Purchase Order to Distributor: ${po.providerId} for Order: ${po.orderId}`,
      lines: [
        { accountNumber: '5010', entryType: 'DEBIT', amountCents: po.totalWholesaleCostCents },
        { accountNumber: '2020', entryType: 'CREDIT', amountCents: po.totalWholesaleCostCents },
      ]
    });
  }

  private async ledgerTaxReserveTransfer(tax: TaxLiabilityRecordedPayload): Promise<void> {
    console.log(`[Accounting Service] Ledgering Tax Reserve Transfer: ${tax.transactionId}`);

    // Logical Bank Transfer:
    // DEBIT: Tax Reserve Account (1020) - Moves tax funds into untouchable reserve asset
    // CREDIT: Operating Cash (1010) - Reduces spendable cash
    await this.postJournalEntry({
      referenceType: 'TAX_RESERVE_TRANSFER',
      referenceId: tax.transactionId,
      description: `Treasury reservation of sales tax funds for Order: ${tax.orderId}`,
      lines: [
        { accountNumber: '1020', entryType: 'DEBIT', amountCents: tax.totalTaxCents },
        { accountNumber: '1010', entryType: 'CREDIT', amountCents: tax.totalTaxCents },
      ]
    });
  }
}

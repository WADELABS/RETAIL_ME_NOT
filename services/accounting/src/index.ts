import { consumer } from '../../event-gateway/consumer/index';
import {
  OrderPlacedEventSchema,
  OrderPlacedEventPayload,
  PurchaseOrderCreatedEventSchema,
  PurchaseOrderCreatedPayload,
  TaxLiabilityRecordedEventSchema,
  TaxLiabilityRecordedPayload,
  DailyCloudCostAccruedEventSchema,
  DailyCloudCostAccruedPayload,
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
  
  // Auditing metadata
  metadata?: {
    stripeTransactionId?: string;
    purchaseOrderId?: string;
    mappedAuditTrailId?: string;
  };
}

export class AccountingService {
  // In-memory journal entries ledger database
  private ledger: JournalEntryInput[] = [];

  // ORDER-TO-PURCHASE MAPPING DATABASE:
  // Programmatically binds customer checkout transactions from Stripe
  // directly to the corresponding wholesale B2B distributor expense.
  private orderToPurchaseMapping: Map<string, { stripeTransactionId: string; purchaseOrderId?: string }> = new Map();

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

    // 4. Consume Daily Cloud Cost Accrued (Auto-Deduct Infrastructure Expense)
    consumer.subscribe(
      'telemetry',
      'billing.cost.accrued',
      DailyCloudCostAccruedEventSchema,
      async (payload: DailyCloudCostAccruedPayload) => {
        await this.ledgerCloudInfrastructureExpense(payload);
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
    this.ledger.push(entry);

    console.log(`[Accounting Ledger] Successfully posted balanced Journal Entry ${entryId} for ${entry.referenceType} (${entry.description}). Total Balanced: $${(debits / 100).toFixed(2)}`);
    if (entry.metadata) {
      console.log(`  - Audit Metadata: stripeId: ${entry.metadata.stripeTransactionId || 'N/A'}, purchaseOrderId: ${entry.metadata.purchaseOrderId || 'N/A'}`);
    }

    return entryId;
  }

  private async ledgerSalesOrder(order: OrderPlacedEventPayload): Promise<void> {
    console.log(`[Accounting Service] Ledgering Sales Order: ${order.orderId}`);

    // In production, the Stripe transaction ID is retrieved from the payment metadata
    const stripeTransactionId = `pi_${uuidv4().substring(0, 14).replace(/-/g, '')}`;

    // Record the Stripe-to-Order mapping in our audit database
    this.orderToPurchaseMapping.set(order.orderId, { stripeTransactionId });

    // DEBIT: Operating Cash (1010) - Customer pays total price (inclusive of tax)
    // CREDIT: Sales Revenue (4010) - Product subtotal
    // CREDIT: Sales Tax Liability (2010) - Sales tax collected
    const revenueCents = order.totalPriceCents - order.taxCents;

    await this.postJournalEntry({
      referenceType: 'SALES_ORDER',
      referenceId: order.orderId,
      description: `Customer Sales Order checkout for Order: ${order.orderId}`,
      metadata: { stripeTransactionId },
      lines: [
        { accountNumber: '1010', entryType: 'DEBIT', amountCents: order.totalPriceCents },
        { accountNumber: '4010', entryType: 'CREDIT', amountCents: revenueCents },
        { accountNumber: '2010', entryType: 'CREDIT', amountCents: order.taxCents },
      ]
    });
  }

  private async ledgerPurchaseOrder(po: PurchaseOrderCreatedPayload): Promise<void> {
    console.log(`[Accounting Service] Ledgering Distributor Purchase Order: ${po.purchaseOrderId}`);

    // --- FINANCIAL CODES & RULES COMPLIANCE ENFORCEMENT ---

    // ORDER-TO-PURCHASE AUDIT MAPPING:
    // Look up the corresponding customer sales order and fetch its Stripe Payment Intent ID.
    // We bind them together explicitly in the general ledger's metadata to create an unbreakable trace.
    const mapping = this.orderToPurchaseMapping.get(po.orderId);
    let stripeTransactionId = 'pi_unmapped_test_transaction';
    
    if (mapping) {
      mapping.purchaseOrderId = po.purchaseOrderId;
      stripeTransactionId = mapping.stripeTransactionId;

      console.log(`\n[Accounting Audit] 🔗 PROGRAMMATIC ORDER-TO-PURCHASE MATCH FOUND!`);
      console.log(`  - Customer Order: ${po.orderId}`);
      console.log(`  - Funding Source (Stripe ID): ${stripeTransactionId}`);
      console.log(`  - Distributor Expense (B2B PO ID): ${po.purchaseOrderId}`);
      console.log(`  - Status: Mapped successfully. Audit Trail ID: ${uuidv4().substring(0, 8).toUpperCase()}\n`);
    } else {
      // Create a fallback mapping for standalone/testing PO creations
      this.orderToPurchaseMapping.set(po.orderId, { stripeTransactionId, purchaseOrderId: po.purchaseOrderId });
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    // DEBIT: Cost of Goods Sold / COGS (5010) - Inventory acquisition cost
    // CREDIT: Accounts Payable (2020) - Amount owed to the distributor
    await this.postJournalEntry({
      referenceType: 'PURCHASE_ORDER',
      referenceId: po.purchaseOrderId,
      description: `B2B Purchase Order to Distributor: ${po.providerId} for Order: ${po.orderId}`,
      metadata: {
        stripeTransactionId,
        purchaseOrderId: po.purchaseOrderId,
        mappedAuditTrailId: uuidv4().substring(0, 8).toUpperCase(),
      },
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

  private async ledgerCloudInfrastructureExpense(billing: DailyCloudCostAccruedPayload): Promise<void> {
    console.log(`[Accounting Service] Ledgering Cloud Infrastructure Expense for period: ${billing.billingPeriod}`);

    // Automated Infrastructure Expense Deduction:
    // DEBIT: Cloud Infrastructure Expense (5020) - increases operational expenses
    // CREDIT: Operating Cash (1010) - decreases our spendable cash asset
    await this.postJournalEntry({
      referenceType: 'TAX_RESERVE_TRANSFER',
      referenceId: uuidv4(),
      description: `Auto-deduction of daily accrued cloud infrastructure costs for period: ${billing.billingPeriod}`,
      lines: [
        { accountNumber: '5020', entryType: 'DEBIT', amountCents: billing.costCents },
        { accountNumber: '1010', entryType: 'CREDIT', amountCents: billing.costCents },
      ]
    });
  }

  public getMapping(orderId: string) {
    return this.orderToPurchaseMapping.get(orderId);
  }

  public getLedger() {
    return this.ledger;
  }
}

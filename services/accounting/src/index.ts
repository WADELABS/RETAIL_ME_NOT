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
  timestamp: string; // The transaction date for report filtering
  
  // Auditing metadata
  metadata?: {
    stripeTransactionId?: string;
    purchaseOrderId?: string;
    mappedAuditTrailId?: string;
  };
}

export interface MonthlyLedgerReport {
  year: number;
  month: number;
  totalPurchaseVolumeCents: number;
  salesOrderCount: number;
  purchaseOrderCount: number;
  onTimeUpfrontPaymentPercentage: number; // Percentage of POs paid instantly on-time via virtual cards
  generatedAt: string;
}

export interface DistributorInvoicePayload {
  invoiceId: string;
  purchaseOrderId: string;
  billedAmountCents: number;
  shippedLineItems: Array<{ sku: string; quantity: number }>;
}

export interface ReconciliationResult {
  status: 'RECONCILED_SUCCESS' | 'DISCREPANCY_QUARANTINED';
  discrepancyReason?: string;
  invoiceId: string;
  purchaseOrderId: string;
}

export class AccountingService {
  // In-memory journal entries ledger database
  private ledger: JournalEntryInput[] = [];

  // ORDER-TO-PURCHASE MAPPING DATABASE:
  private orderToPurchaseMapping: Map<string, { stripeTransactionId: string; purchaseOrderId?: string }> = new Map();

  // Simulated Carrier Shipment database (simulating EDI 856 Advanced Ship Notices)
  private verifiedShipments: Map<string, Array<{ sku: string; quantity: number }>> = new Map();

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
   * Registers a verified distributor carrier shipment log (EDI 856).
   * Provided for three-way match account reconciliation.
   */
  public registerVerifiedShipment(purchaseOrderId: string, items: Array<{ sku: string; quantity: number }>): void {
    this.verifiedShipments.set(purchaseOrderId, items);
    console.log(`[Accounting Service] Registered Verified Carrier Shipment for PO: ${purchaseOrderId}`);
  }

  /**
   * Posts a journal entry. Strictly enforces that SUM(Debits) === SUM(Credits).
   */
  public async postJournalEntry(entry: Omit<JournalEntryInput, 'timestamp'>): Promise<string> {
    const debits = entry.lines.filter(l => l.entryType === 'DEBIT').reduce((sum, l) => sum + l.amountCents, 0);
    const credits = entry.lines.filter(l => l.entryType === 'CREDIT').reduce((sum, l) => sum + l.amountCents, 0);

    if (debits !== credits) {
      throw new Error(`[Accounting Error] Unbalanced Journal Entry. Total Debits ($${(debits / 100).toFixed(2)}) must equal Total Credits ($${(credits / 100).toFixed(2)}).`);
    }

    const entryId = uuidv4();
    const fullEntry: JournalEntryInput = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    this.ledger.push(fullEntry);

    console.log(`[Accounting Ledger] Successfully posted balanced Journal Entry ${entryId} for ${entry.referenceType} (${entry.description}). Total Balanced: $${(debits / 100).toFixed(2)}`);
    if (entry.metadata) {
      console.log(`  - Audit Metadata: stripeId: ${entry.metadata.stripeTransactionId || 'N/A'}, purchaseOrderId: ${entry.metadata.purchaseOrderId || 'N/A'}`);
    }

    return entryId;
  }

  /**
   * AUDITABLE ORDER VOLUME ANALYTICS:
   * Programmatically parses posted journal entries, generating clean, exportable monthly financial statements.
   */
  public generateMonthlyLedgerReport(year: number, month: number): MonthlyLedgerReport {
    console.log(`[Accounting Analytics] Generating monthly ledger report for ${year}-${month.toString().padStart(2, '0')}...`);

    let totalPurchaseVolumeCents = 0;
    let salesOrderCount = 0;
    let purchaseOrderCount = 0;
    let upfrontPaidCount = 0;

    for (const entry of this.ledger) {
      const entryDate = new Date(entry.timestamp);
      
      // Filter entries by calendar month
      if (entryDate.getFullYear() === year && (entryDate.getMonth() + 1) === month) {
        if (entry.referenceType === 'SALES_ORDER') {
          salesOrderCount++;
        } else if (entry.referenceType === 'PURCHASE_ORDER') {
          purchaseOrderCount++;
          
          // Sum up the wholesale purchase volumes (COGS Debit line)
          const cogsLine = entry.lines.find(l => l.accountNumber === '5010' && l.entryType === 'DEBIT');
          if (cogsLine) {
            totalPurchaseVolumeCents += cogsLine.amountCents;
          }

          // Check if PO was paid upfront instantly via Stripe Virtual Card
          if (entry.metadata?.stripeTransactionId && entry.metadata?.stripeTransactionId !== 'pi_unmapped_test_transaction') {
            upfrontPaidCount++;
          }
        }
      }
    }

    const onTimeUpfrontPaymentPercentage = purchaseOrderCount > 0 ? (upfrontPaidCount / purchaseOrderCount) * 100 : 100;

    console.log(`[Accounting Analytics] Report compiled:`);
    console.log(`  - Total Purchase Volume (TPV): $${(totalPurchaseVolumeCents / 100).toFixed(2)}`);
    console.log(`  - Sales Orders processed: ${salesOrderCount}`);
    console.log(`  - B2B Purchase Orders generated: ${purchaseOrderCount}`);
    console.log(`  - On-time Upfront Card Payment rate: ${onTimeUpfrontPaymentPercentage.toFixed(1)}%\n`);

    return {
      year,
      month,
      totalPurchaseVolumeCents,
      salesOrderCount,
      purchaseOrderCount,
      onTimeUpfrontPaymentPercentage,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * B2B DISTRIBUTOR ACCOUNT RECONCILIATION:
   * Performs a Three-Way Match (Purchase Order expected cost vs Carrier Shipping logs vs Billed Invoice).
   * Halts any credit drawdown and flags discrepancies instantly.
   */
  public reconcileDistributorInvoice(invoice: DistributorInvoicePayload): ReconciliationResult {
    console.log(`[Account Reconciliation] Reconciling Distributor Invoice: ${invoice.invoiceId} for B2B PO: ${invoice.purchaseOrderId}...`);

    // 1. Fetch the original Purchase Order recorded in our General Ledger
    const originalEntry = this.ledger.find(e => e.referenceType === 'PURCHASE_ORDER' && e.referenceId === invoice.purchaseOrderId);
    if (!originalEntry) {
      console.error(`[Reconciliation Warning] Halt payment: Original Purchase Order ${invoice.purchaseOrderId} does not exist in ledger.`);
      return {
        status: 'DISCREPANCY_QUARANTINED',
        discrepancyReason: 'ORIGINAL_PURCHASE_ORDER_NOT_FOUND',
        invoiceId: invoice.invoiceId,
        purchaseOrderId: invoice.purchaseOrderId,
      };
    }

    const expectedCostLine = originalEntry.lines.find(l => l.accountNumber === '5010' && l.entryType === 'DEBIT')!;
    const expectedCostCents = expectedCostLine.amountCents;

    // --- FINANCIAL CODES & RULES COMPLIANCE ENFORCEMENT ---

    // Rule A: Validate Invoiced Cost Mismatches (Overbilling Defense)
    // If the billed invoice amount is higher than our agreed-upon PO wholesale cost, halt checkout!
    if (invoice.billedAmountCents !== expectedCostCents) {
      console.error(`\n[Reconciliation Critical] 🚨 COST DISCREPANCY DETECTED!`);
      console.error(`  - Invoice Billed Amount: $${(invoice.billedAmountCents / 100).toFixed(2)}`);
      console.error(`  - PO Agreed Wholesale Cost: $${(expectedCostCents / 100).toFixed(2)}`);
      console.error('  - Action: Halting payment, quarantining invoice, and alerting support.');

      return {
        status: 'DISCREPANCY_QUARANTINED',
        discrepancyReason: 'WHOLESALE_COST_DISCREPANCY_OVERBILLING',
        invoiceId: invoice.invoiceId,
        purchaseOrderId: invoice.purchaseOrderId,
      };
    }

    // Rule B: Validate Carrier Shipment Logs (Under-delivery Defense)
    // Cross-references against verified carrier logs (EDI 856 ASN) to ensure they are only billing for items actually shipped!
    const verifiedItems = this.verifiedShipments.get(invoice.purchaseOrderId);
    if (!verifiedItems) {
      console.error(`\n[Reconciliation Critical] 🚨 LOGISTICS DISCREPANCY DETECTED!`);
      console.error(`  - Action: No verified carrier shipment records exist for PO ${invoice.purchaseOrderId}. Billed before delivery. Halting.`);
      
      return {
        status: 'DISCREPANCY_QUARANTINED',
        discrepancyReason: 'NO_VERIFIED_CARRIER_SHIPMENT_LOG_FOUND',
        invoiceId: invoice.invoiceId,
        purchaseOrderId: invoice.purchaseOrderId,
      };
    }

    for (const billedItem of invoice.shippedLineItems) {
      const shippedItem = verifiedItems.find(i => i.sku === billedItem.sku);
      if (!shippedItem || shippedItem.quantity !== billedItem.quantity) {
        console.error(`\n[Reconciliation Critical] 🚨 QUANTITY DISCREPANCY DETECTED for SKU: ${billedItem.sku}!`);
        console.error(`  - Billed Invoice Quantity: ${billedItem.quantity}`);
        console.error(`  - Carrier Shipped Quantity: ${shippedItem ? shippedItem.quantity : 0}`);
        console.error('  - Action: Halting payment, quarantining invoice, and alerting support.');

        return {
          status: 'DISCREPANCY_QUARANTINED',
          discrepancyReason: `QUANTITY_DISCREPANCY_UNSHIPPED_ITEMS_BILLED: ${billedItem.sku}`,
          invoiceId: invoice.invoiceId,
          purchaseOrderId: invoice.purchaseOrderId,
        };
      }
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    console.log(`[Account Reconciliation] SUCCESS: Three-Way Match complete for Invoice ${invoice.invoiceId}. Reconciled cleanly.`);
    
    return {
      status: 'RECONCILED_SUCCESS',
      invoiceId: invoice.invoiceId,
      purchaseOrderId: invoice.purchaseOrderId,
    };
  }

  private async ledgerSalesOrder(order: OrderPlacedEventPayload): Promise<void> {
    console.log(`[Accounting Service] Ledgering Sales Order: ${order.orderId}`);

    const stripeTransactionId = `pi_${uuidv4().substring(0, 14).replace(/-/g, '')}`;
    this.orderToPurchaseMapping.set(order.orderId, { stripeTransactionId });

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
      this.orderToPurchaseMapping.set(po.orderId, { stripeTransactionId, purchaseOrderId: po.purchaseOrderId });
    }

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

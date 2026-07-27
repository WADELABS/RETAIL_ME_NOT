import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountingService, DistributorInvoicePayload } from '../src/index';
import { v4 as uuidv4 } from 'uuid';

test('Accounting Ledger strictly blocks unbalanced journal entry postings', async () => {
  const service = new AccountingService();

  // Try to post an unbalanced entry (Debit: $100, Credit: $80)
  await assert.rejects(
    async () => {
      await service.postJournalEntry({
        referenceType: 'SALES_ORDER',
        referenceId: uuidv4(),
        description: 'Broken unbalanced entry test',
        lines: [
          { accountNumber: '1010', entryType: 'DEBIT', amountCents: 10000 },
          { accountNumber: '4010', entryType: 'CREDIT', amountCents: 8000 },
        ]
      });
    },
    /Unbalanced Journal Entry/,
    'Ledger must reject unbalanced entries to preserve double-entry balance integrity'
  );
});

test('Accounting Service programmatically maps and links Stripe payments to B2B Distributor Purchase Orders', async () => {
  const service = new AccountingService();
  
  const orderId = uuidv4();
  const customerId = uuidv4();
  const purchaseOrderId = `PO-REPL-${uuidv4().substring(0, 6).toUpperCase()}`;

  // 1. Simulate customer checkout event (Ledgering Sales Order)
  await service.ledgerSalesOrderForTest({
    orderId,
    customerId,
    status: 'PENDING_FULFILLMENT',
    totalPriceCents: 129900,
    taxCents: 10392,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    placedAt: new Date().toISOString(),
    shippingAddress: {
      recipientName: 'Wade Labs Operator',
      line1: '456 Tech Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    },
    billingAddress: {
      recipientName: 'Wade Labs Operator',
      line1: '456 Tech Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      country: 'US',
    },
    lineItems: [
      {
        lineItemId: uuidv4(),
        sku: 'LAPTOP-WADE-01',
        productTitle: 'Wade Stealth Laptop 16',
        quantity: 1,
        unitPriceCents: 129900,
        totalPriceCents: 129900,
      }
    ],
  });

  const mappingBefore = service.getMapping(orderId)!;
  const mockStripeId = mappingBefore.stripeTransactionId;

  // 2. Simulate B2B Procurement event (Ledgering Distributor Purchase Order)
  await service.ledgerPurchaseOrderForTest({
    purchaseOrderId,
    orderId,
    providerId: 'INGRAM_MICRO_B2B',
    totalWholesaleCostCents: 95000,
    status: 'EDI_850_TRANSMITTED',
    createdAt: new Date().toISOString(),
    items: [
      {
        poItemId: uuidv4(),
        sku: 'LAPTOP-WADE-01',
        wholesaleCostCents: 95000,
        quantity: 1,
      }
    ],
  });

  // Verify mapping
  const mappingAfter = service.getMapping(orderId);
  assert.ok(mappingAfter);
  assert.equal(mappingAfter.stripeTransactionId, mockStripeId);
  assert.equal(mappingAfter.purchaseOrderId, purchaseOrderId);

  const ledger = service.getLedger();
  const poEntry = ledger.find(e => e.referenceType === 'PURCHASE_ORDER')!;
  assert.equal(poEntry.metadata?.stripeTransactionId, mockStripeId);
});


// --- 1. AUDITABLE ORDER VOLUME ANALYTICS TESTS ---

test('Accounting Service programmatically generates clean monthly ledger reports', async () => {
  const service = new AccountingService();
  
  const orderId = uuidv4();
  const purchaseOrderId = `PO-REPL-552288`;

  // Place sales order and purchase order to seed the ledger
  await service.ledgerSalesOrderForTest({
    orderId,
    customerId: uuidv4(),
    status: 'PENDING_FULFILLMENT',
    totalPriceCents: 129900,
    taxCents: 10392,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    placedAt: new Date().toISOString(),
    shippingAddress: { recipientName: 'Wade', line1: '456 Tech Way', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
    billingAddress: { recipientName: 'Wade', line1: '456 Tech Way', city: 'Austin', state: 'TX', postalCode: '78701', country: 'US' },
    lineItems: [{ lineItemId: uuidv4(), sku: 'LAPTOP-WADE-01', productTitle: 'Laptop', quantity: 1, unitPriceCents: 129900, totalPriceCents: 129900 }],
  });

  await service.ledgerPurchaseOrderForTest({
    purchaseOrderId,
    orderId,
    providerId: 'INGRAM_MICRO_B2B',
    totalWholesaleCostCents: 95000, // $950 wholesale COGS cost
    status: 'EDI_850_TRANSMITTED',
    createdAt: new Date().toISOString(),
    items: [{ poItemId: uuidv4(), sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }],
  });

  const now = new Date();
  const report = service.generateMonthlyLedgerReport(now.getFullYear(), now.getMonth() + 1);

  assert.equal(report.year, now.getFullYear());
  assert.equal(report.month, now.getMonth() + 1);
  assert.equal(report.totalPurchaseVolumeCents, 95000, 'Report must accurately sum COGS purchase volumes');
  assert.equal(report.salesOrderCount, 1);
  assert.equal(report.purchaseOrderCount, 1);
  assert.equal(report.onTimeUpfrontPaymentPercentage, 100, 'Upfront card payments rate must be 100%');
});


// --- 2. B2B DISTRIBUTOR ACCOUNT RECONCILIATION TESTS ---

test('Account Reconciliation successfully approves valid three-way matches', async () => {
  const service = new AccountingService();
  
  const orderId = uuidv4();
  const purchaseOrderId = `PO-REPL-SUCCESS`;

  // Seed PO in ledger: expected wholesale cost = $950.00 (95000 cents)
  await service.ledgerPurchaseOrderForTest({
    purchaseOrderId,
    orderId,
    providerId: 'INGRAM_MICRO_B2B',
    totalWholesaleCostCents: 95000,
    status: 'EDI_850_TRANSMITTED',
    createdAt: new Date().toISOString(),
    items: [{ poItemId: uuidv4(), sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }],
  });

  // Register verified carrier shipment log (shipped quantity matches)
  service.registerVerifiedShipment(purchaseOrderId, [{ sku: 'LAPTOP-WADE-01', quantity: 1 }]);

  // Simulate receiving distributor invoice (EDI 810) - matches PO cost and shipped logs exactly
  const invoice: DistributorInvoicePayload = {
    invoiceId: 'INV-992211',
    purchaseOrderId,
    billedAmountCents: 95000, // Matches PO
    shippedLineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1 }], // Matches carrier logs
  };

  const result = service.reconcileDistributorInvoice(invoice);

  assert.equal(result.status, 'RECONCILED_SUCCESS', 'Legitimate invoices must pass reconciliation cleanly');
});

test('Account Reconciliation intercepts and quarantines billed cost discrepancies (Overbilling)', async () => {
  const service = new AccountingService();
  
  const orderId = uuidv4();
  const purchaseOrderId = `PO-REPL-COST-FAIL`;

  // Seed PO in ledger: expected wholesale cost = $950.00 (95000 cents)
  await service.ledgerPurchaseOrderForTest({
    purchaseOrderId,
    orderId,
    providerId: 'INGRAM_MICRO_B2B',
    totalWholesaleCostCents: 95000,
    status: 'EDI_850_TRANSMITTED',
    createdAt: new Date().toISOString(),
    items: [{ poItemId: uuidv4(), sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }],
  });

  service.registerVerifiedShipment(purchaseOrderId, [{ sku: 'LAPTOP-WADE-01', quantity: 1 }]);

  // Simulate receiving an overbilled distributor invoice: billed $1,050.00 instead of agreed $950.00
  const overbilledInvoice: DistributorInvoicePayload = {
    invoiceId: 'INV-FORGED-COST',
    purchaseOrderId,
    billedAmountCents: 105000, // OVERBILLING MISMATCH
    shippedLineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1 }],
  };

  const result = service.reconcileDistributorInvoice(overbilledInvoice);

  assert.equal(result.status, 'DISCREPANCY_QUARANTINED', 'Invoices with cost overbillings must be quarantined');
  assert.equal(result.discrepancyReason, 'WHOLESALE_COST_DISCREPANCY_OVERBILLING');
});

test('Account Reconciliation intercepts and quarantines logistics quantity discrepancies (Billed Unshipped items)', async () => {
  const service = new AccountingService();
  
  const orderId = uuidv4();
  const purchaseOrderId = `PO-REPL-QTY-FAIL`;

  // Seed PO in ledger: expected wholesale cost = $950.00 (95000 cents)
  await service.ledgerPurchaseOrderForTest({
    purchaseOrderId,
    orderId,
    providerId: 'INGRAM_MICRO_B2B',
    totalWholesaleCostCents: 95000,
    status: 'EDI_850_TRANSMITTED',
    createdAt: new Date().toISOString(),
    items: [{ poItemId: uuidv4(), sku: 'LAPTOP-WADE-01', wholesaleCostCents: 95000, quantity: 1 }],
  });

  // Carrier shipment log says the distributor only shipped 0 units (or record missing)
  service.registerVerifiedShipment(purchaseOrderId, [{ sku: 'LAPTOP-WADE-01', quantity: 0 }]);

  // Simulate receiving distributor invoice billing us for 1 unit which was never shipped
  const fraudulentInvoice: DistributorInvoicePayload = {
    invoiceId: 'INV-FORGED-QTY',
    purchaseOrderId,
    billedAmountCents: 95000,
    shippedLineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1 }], // Billed for 1 but carrier says 0 shipped!
  };

  const result = service.reconcileDistributorInvoice(fraudulentInvoice);

  assert.equal(result.status, 'DISCREPANCY_QUARANTINED', 'Invoices billing for unshipped items must be quarantined');
  assert.equal(result.discrepancyReason, 'QUANTITY_DISCREPANCY_UNSHIPPED_ITEMS_BILLED: LAPTOP-WADE-01');
});


// Extend class locally for testing environment control
declare module '../src/index' {
  interface AccountingService {
    ledgerSalesOrderForTest(payload: any): Promise<void>;
    ledgerPurchaseOrderForTest(payload: any): Promise<void>;
  }
}

AccountingService.prototype.ledgerSalesOrderForTest = function (payload: any) {
  return (this as any).ledgerSalesOrder(payload);
};

AccountingService.prototype.ledgerPurchaseOrderForTest = function (payload: any) {
  return (this as any).ledgerPurchaseOrder(payload);
};

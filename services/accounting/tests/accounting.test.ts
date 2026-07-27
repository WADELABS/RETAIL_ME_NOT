import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AccountingService } from '../src/index';
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
  // This automatically generates a simulated Stripe Payment Intent ID and registers it
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

  // Fetch the auto-generated Stripe transaction ID for verification
  const mappingBefore = service.getMapping(orderId)!;
  const mockStripeId = mappingBefore.stripeTransactionId;
  assert.ok(mockStripeId.startsWith('pi_'));

  // 2. Simulate B2B Procurement event (Ledgering Distributor Purchase Order)
  // This must automatically lookup orderId, retrieve mockStripeId, and bind them together!
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

  // Verify the audit mapping is correctly bound and traceble
  const mappingAfter = service.getMapping(orderId);
  assert.ok(mappingAfter, 'An active mapping trail must exist');
  assert.equal(mappingAfter.stripeTransactionId, mockStripeId, 'Should map the correct Stripe ID');
  assert.equal(mappingAfter.purchaseOrderId, purchaseOrderId, 'Should link the correct B2B PO ID');

  // Verify the posted journal entry metadata in ledger contains both references
  const ledger = service.getLedger();
  const poEntry = ledger.find(e => e.referenceType === 'PURCHASE_ORDER')!;
  
  assert.equal(poEntry.metadata?.stripeTransactionId, mockStripeId, 'Ledger entry must explicitly contain the Stripe Payment funding reference');
  assert.equal(poEntry.metadata?.purchaseOrderId, purchaseOrderId);
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

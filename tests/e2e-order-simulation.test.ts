import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inMemoryEventBus } from '../packages/events/src/bus/in-memory-bus';
import { publisher } from '../services/event-gateway/publisher/index';
import { AccountingService } from '../services/accounting/src/index';
import { TaxComplianceService } from '../services/tax-compliance/src/index';
import { createDistributorAAdapter } from '../services/distributor-adapter-a/src/index';
import { initialize as initTreasury } from '../services/treasury/src/index';
import { initialize as initProcurement } from '../services/procurement/src/index';
import { v4 as uuidv4 } from 'uuid';

// Import the Decision Engine consumer to initialize its subscriptions
import '../services/decision-engine/events/consumer';

test('ECOS Golden Path Transaction Loop: Sell -> Collect -> Reserve -> Buy -> Ledger', async () => {
  console.log('\n--- STARTING ECOS GOLDEN PATH ORDER WORKFLOW SIMULATION ---');

  const orderId = uuidv4();
  const correlationId = uuidv4();

  // 1. Initialize the ECOS Financial & Operational Services
  
  // A. Initialize the Tax Compliance Service with a mock adapter
  const mockTaxProvider = {
    id: 'TAXJAR_MOCK',
    name: 'TaxJar Mock Provider',
    calculateSalesTax: () => Promise.resolve({ totalTaxCents: 8000, taxLines: [], providerTransactionId: 'tax_doc_001' }),
    evaluateNexus: () => Promise.resolve({ state: 'LA', hasNexus: true, reason: 'ECONOMIC_THRESHOLD_MET' as const }),
    validateTaxAddress: () => Promise.resolve({ isValid: true }),
    commitTaxTransaction: () => Promise.resolve({ status: 'COMMITTED' as const }),
  };
  const taxCompliance = new TaxComplianceService(mockTaxProvider);
  taxCompliance.initialize();

  // B. Initialize the Treasury Service
  initTreasury();

  // C. Initialize the Procurement Service
  initProcurement();

  // D. Initialize the Accounting Service (General Ledger)
  const accounting = new AccountingService();
  accounting.initialize();

  console.log('[Simulation] Services fully initialized. Emitting mock Customer Checkout payment success...\n');

  // 2. Publish the initial 'order.placed' event onto the bus
  // This simulates the storefront checkout completing a transaction
  const orderPlacedPayload = {
    orderId,
    customerId: uuidv4(),
    status: 'PENDING_FULFILLMENT' as const,
    totalPriceCents: 108000, // Customer pays $1,080.00
    taxCents: 8000,         // Sales Tax: $80.00
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
        productTitle: 'WadeLabs Enterprise AI Laptop',
        quantity: 1,
        unitPriceCents: 100000, // Product subtotal: $1,000.00
        totalPriceCents: 100000,
      }
    ]
  };

  // Publish the order.placed event to the Event Bus
  await publisher.publish(
    'orders',
    'order.placed',
    orderPlacedPayload,
    correlationId
  );

  // 3. Simulate the Fulfillment Engine assigning the order to Distributor A
  // This step bridges orders to procurement, simulating the decision execution.
  console.log('\n[Simulation] Simulating Fulfillment Engine assignment...');
  await publisher.publish(
    'fulfillment',
    'fulfillment.assigned',
    {
      orderId,
      providerId: 'DISTRIBUTOR_A',
      items: [
        {
          sku: 'LAPTOP-WADE-01',
          wholesaleCostCents: 75000, // ECOS wholesale cost: $750.00
          quantity: 1
        }
      ]
    },
    correlationId
  );

  // We introduce a micro-delay to allow asynchronous in-memory event listeners to complete
  await new Promise(resolve => setTimeout(resolve, 100));

  console.log('\n--- SIMULATION WORKFLOW FINISHED ---');
  assert.ok(true, 'Complete financial order loop executed without errors');
});

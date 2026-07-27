import { consumer } from '../../event-gateway/consumer/index';
import { publisher } from '../../event-gateway/publisher/index';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'node:crypto';

// Define the event schema for when the Fulfillment Engine assigns an order
const FulfillmentAssignedSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.literal('1.0'),
  domain: z.literal('fulfillment'),
  eventName: z.literal('fulfillment.assigned'),
  correlationId: z.string().uuid(),
  payload: z.object({
    orderId: z.string().uuid(),
    providerId: z.string(),
    riskRecommendation: z.enum(['ALLOW', 'MANUAL_REVIEW', 'DECLINE']), // Mandatory risk filtering
    items: z.array(z.object({
      sku: z.string(),
      wholesaleCostCents: z.number().int().positive(),
      quantity: z.number().int().positive(),
    })),
  }),
});

type FulfillmentAssignedEvent = z.infer<typeof FulfillmentAssignedSchema>;

export interface StripeVirtualCard {
  cardId: string;
  pan: string;
  cvv: string;
  expiration: string;
  spendingLimitCents: number;
}

export interface PurchaseOrderRecord {
  purchaseOrderId: string;
  orderId: string;
  providerId: string;
  totalWholesaleCostCents: number;
  status: 'CREATED' | 'PAID_UPFRONT_VIRTUAL_CARD' | 'EDI_850_TRANSMITTED' | 'ACCEPTED_BY_DISTRIBUTOR' | 'SHIPPED_BY_DISTRIBUTOR' | 'FAILED_TRANSMISSION' | 'HELD_FOR_FRAUD_AUDIT';
  ediPayload?: string;
  issuedCard?: StripeVirtualCard;
  trackingNumber?: string;
  createdAt: string;
}

// In-memory PO Database
export const purchaseOrders: Map<string, PurchaseOrderRecord> = new Map();

// Initialize the Procurement Service by subscribing to the Fulfillment domain
export function initialize() {
  console.log('[Procurement Service] Initializing and subscribing to fulfillment events...');

  consumer.subscribe<FulfillmentAssignedEvent['payload']>(
    'fulfillment',
    'fulfillment.assigned',
    FulfillmentAssignedSchema,
    async (payload) => {
      console.log(`[Procurement Service] Received assignment for Order: ${payload.orderId}. Risk Recommendation: ${payload.riskRecommendation}`);

      const purchaseOrderId = `PO-${uuidv4().substring(0, 8).toUpperCase()}`;
      const totalCost = payload.items.reduce((sum, item) => sum + (item.wholesaleCostCents * item.quantity), 0);

      const items = payload.items.map(item => ({
        poItemId: uuidv4(),
        sku: item.sku,
        wholesaleCostCents: item.wholesaleCostCents,
        quantity: item.quantity,
      }));

      // Generate the base Purchase Order Record
      const poRecord: PurchaseOrderRecord = {
        purchaseOrderId,
        orderId: payload.orderId,
        providerId: payload.providerId,
        totalWholesaleCostCents: totalCost,
        status: 'CREATED',
        createdAt: new Date().toISOString(),
      };

      // --- CRITICAL B2B PROCUREMENT FRAUD GATE LOCK ---

      // Rule 1: IF risk recommendation is DECLINE (Extreme Fraud)
      if (payload.riskRecommendation === 'DECLINE') {
        console.error(`[Procurement Security] CRITICAL BLOCK: Order ${payload.orderId} failed risk check (DECLINE). Rejecting PO generation to prevent capital loss.`);
        poRecord.status = 'FAILED_TRANSMISSION';
        purchaseOrders.set(purchaseOrderId, poRecord);
        return;
      }

      // Rule 2: IF risk recommendation is MANUAL_REVIEW (Quarantine)
      if (payload.riskRecommendation === 'MANUAL_REVIEW') {
        console.warn(`\n[Procurement Security] 🚨 FRAUD HOLD ACTIVATED for PO: ${purchaseOrderId}!`);
        console.warn(`  - Context: Customer checkout Order ${payload.orderId} triggered Stripe Radar manual review.`);
        console.warn(`  - Action: Quarantine PO in HELD_FOR_FRAUD_AUDIT status.`);
        console.warn(`  - Status: BLOCKED virtual card generation and EDI routing. Cash is preserved in Stripe Treasury.\n`);

        poRecord.status = 'HELD_FOR_FRAUD_AUDIT';
        purchaseOrders.set(purchaseOrderId, poRecord);

        // Publish a held event notifying administrators to audit the transaction
        await publisher.publish(
          'procurement',
          'purchase_order.held',
          {
            purchaseOrderId,
            orderId: payload.orderId,
            status: 'HELD_FOR_FRAUD_AUDIT',
            totalWholesaleCostCents: totalCost,
            createdAt: poRecord.createdAt,
          }
        );
        return;
      }

      // Rule 3: Only ALLOWED orders proceed to upfront virtual card payment
      console.log(`[Procurement Security] Approved: Risk check passed (ALLOW). Executing instant payment and dropship routing...`);

      // Execute Virtual Card generation and EDI 850 compile
      try {
        const automator = new EdiDropshipAutomator();
        const card = automator.generateVirtualCard(totalCost);
        
        poRecord.issuedCard = card;
        poRecord.status = 'PAID_UPFRONT_VIRTUAL_CARD';

        const ediPayload = automator.translatePoToEdi850(poRecord, items);
        poRecord.ediPayload = ediPayload;
        poRecord.status = 'EDI_850_TRANSMITTED';

        console.log(`[Procurement EDI] SUCCESS: Compiled and Transmitted EDI 850 (Purchase Order) for PO: ${purchaseOrderId}`);
      } catch (err) {
        console.error(`[Procurement EDI Error] Failed to process PO routing: ${(err as any).message}`);
        poRecord.status = 'FAILED_TRANSMISSION';
      }

      // --- END SECURITY COMPLIANCE ENFORCEMENT ---

      purchaseOrders.set(purchaseOrderId, poRecord);

      // Publish a 'purchase_order.created' event to the Event Bus
      await publisher.publish(
        'procurement',
        'purchase_order.created',
        {
          purchaseOrderId,
          orderId: payload.orderId,
          providerId: payload.providerId,
          totalWholesaleCostCents: totalCost,
          status: poRecord.status,
          createdAt: poRecord.createdAt,
          items,
        }
      );
    }
  );
}

/**
 * Human-in-the-Loop Release Action:
 * Called by administrators from the dashboard ("Approve & Order" button) to manually release, pay, and finalize a quarantined PO.
 */
export async function releaseHeldProcurement(purchaseOrderId: string): Promise<PurchaseOrderRecord> {
  const po = purchaseOrders.get(purchaseOrderId);
  if (!po) {
    throw new Error(`[Procurement Error] Release failed: Purchase Order ${purchaseOrderId} not found.`);
  }

  if (po.status !== 'HELD_FOR_FRAUD_AUDIT') {
    throw new Error(`[Procurement Error] Release failed: Only HELD_FOR_FRAUD_AUDIT POs can be released. Current Status: ${po.status}`);
  }

  console.log(`\n[Procurement Security] 👤 MANUAL AUDIT RELEASE: Administrator approved and released PO: ${purchaseOrderId}`);

  // Process the upfront payment and route the EDI 850 Purchase Order now
  try {
    const automator = new EdiDropshipAutomator();
    
    // 1. Programmatically issue the Stripe Virtual Card (clears the PO status to PAID_UPFRONT_VIRTUAL_CARD)
    const card = automator.generateVirtualCard(po.totalWholesaleCostCents);
    po.issuedCard = card;
    po.status = 'PAID_UPFRONT_VIRTUAL_CARD';

    // Simulated lookup of items to translate
    const items = [{ sku: 'LAPTOP-WADE-01', quantity: 1, wholesaleCostCents: po.totalWholesaleCostCents }];

    // 2. Generate and transmit the EDI 850 document
    const ediPayload = automator.translatePoToEdi850(po, items);
    po.ediPayload = ediPayload;
    po.status = 'EDI_850_TRANSMITTED';

    console.log(`[Procurement EDI] SUCCESS: Manual release payment executed. EDI 850 Transmitted.`);

    // 3. Publish active purchase_order.created event
    await publisher.publish(
      'procurement',
      'purchase_order.created',
      {
        purchaseOrderId,
        orderId: po.orderId,
        providerId: po.providerId,
        totalWholesaleCostCents: po.totalWholesaleCostCents,
        status: po.status,
        createdAt: po.createdAt,
        items,
      }
    );

    return po;
  } catch (err) {
    console.error(`[Procurement EDI Error] Failed to process manually released PO routing: ${(err as any).message}`);
    po.status = 'FAILED_TRANSMISSION';
    throw err;
  }
}


// --- 1. ANSI X12 EDI DROPSHIP & VIRTUAL CARD AUTOMATION MODULE ---

export class EdiDropshipAutomator {
  public generateVirtualCard(spendingLimitCents: number): StripeVirtualCard {
    return {
      cardId: `ic_${randomBytes(4).toString('hex')}`,
      pan: `41111111${Math.floor(10000000 + Math.random() * 90000000)}`,
      cvv: `${Math.floor(100 + Math.random() * 900)}`,
      expiration: '12/29',
      spendingLimitCents,
    };
  }

  public translatePoToEdi850(
    po: PurchaseOrderRecord,
    items: Array<{ sku: string; quantity: number; wholesaleCostCents: number }>
  ): string {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/[-T:]/g, '').substring(2, 8); // YYMMDD
    const formattedTime = now.toISOString().replace(/[-T:]/g, '').substring(8, 12); // HHMM

    const segments: string[] = [];

    // ISA: Interchange Control Header
    segments.push(`ISA*00*          *00*          *ZZ*WADELABS       *ZZ*INGRAMMICRO    *${formattedDate}*${formattedTime}*U*00401*000000101*0*T*~`);
    
    // GS: Functional Group Header
    segments.push(`GS*PO*WADELABS*INGRAMMICRO*${now.getFullYear()}${formattedDate.substring(2)}*${formattedTime}*101*X*004010`);
    
    // ST: Transaction Set Header (850)
    segments.push(`ST*850*0001`);
    
    // BEG: Beginning Segment for Purchase Order
    segments.push(`BEG*00*NE*${po.purchaseOrderId}**${now.getFullYear()}${formattedDate.substring(2)}`);
    
    // N1: Name segments
    segments.push(`N1*BY*WADELABS DEPT*91*WL123`);
    segments.push(`N1*SU*${po.providerId}`);

    // REF: Payment reference segment containing our single-use virtual card
    if (po.issuedCard) {
      segments.push(`REF*CC*${po.issuedCard.pan}*EXP*${po.issuedCard.expiration}*CVV*${po.issuedCard.cvv}`);
    }

    // PO1: Loop through and append baseline item data
    items.forEach((item, index) => {
      const lineNum = index + 1;
      const formattedCost = (item.wholesaleCostCents / 100).toFixed(2);
      segments.push(`PO1*${lineNum}*${item.quantity}*EA*${formattedCost}**BP*${item.sku}`);
    });

    // CTT: Transaction Totals segment
    segments.push(`CTT*${items.length}`);
    
    // SE: Transaction Set Trailer
    segments.push(`SE*${segments.length + 1 - 2}*0001`);
    
    // GE & IEA: Control Trailers
    segments.push(`GE*1*101`);
    segments.push(`IEA*1*000000101`);

    return segments.join('\n');
  }

  public parseEdi855Acknowledgment(edi855Text: string): { purchaseOrderId: string; status: 'ACCEPTED' | 'REJECTED' } {
    console.log('[Procurement EDI] Parsing incoming EDI 855 (Purchase Order Acknowledgment)...');

    const segments = edi855Text.split('\n');
    let purchaseOrderId = '';
    let status: 'ACCEPTED' | 'REJECTED' = 'REJECTED';

    for (const segment of segments) {
      const elements = segment.split('*');
      
      if (elements[0] === 'BAK') {
        status = elements[2] === 'AD' ? 'ACCEPTED' : 'REJECTED';
        purchaseOrderId = elements[3];
      }
    }

    if (!purchaseOrderId) {
      throw new Error('Invalid EDI 855 payload: Missing BAK segments.');
    }

    console.log(`[Procurement EDI] Parse Complete. PO: ${purchaseOrderId}. Status: ${status}`);
    return { purchaseOrderId, status };
  }

  public parseEdi856ShipNotice(edi856Text: string): { purchaseOrderId: string; carrier: string; trackingNumber: string } {
    console.log('[Procurement EDI] Parsing incoming EDI 856 (Advanced Ship Notice / Shipment alert)...');

    const segments = edi856Text.split('\n');
    let purchaseOrderId = '';
    let carrier = 'UPS';
    let trackingNumber = '';

    for (const segment of segments) {
      const elements = segment.split('*');

      if (elements[0] === 'PRF') {
        purchaseOrderId = elements[1];
      }
      if (elements[0] === 'CAD') {
        carrier = elements[4] || 'UPS';
      }
      if (elements[0] === 'REF' && (elements[1] === '1Z' || elements[1] === 'CN')) {
        trackingNumber = elements[2];
      }
    }

    if (!purchaseOrderId || !trackingNumber) {
      throw new Error('Invalid EDI 856 payload: Missing PRF PO number or REF tracking elements.');
    }

    console.log(`[Procurement EDI] SUCCESS: Parsed Blind Dropship Shipment. PO: ${purchaseOrderId}. Carrier: ${carrier}. Tracking: ${trackingNumber}`);
    return { purchaseOrderId, carrier, trackingNumber };
  }
}


// --- 2. B2B SUPPLIER INTEGRATION PATHWAYS CLIENT ---

export class DistributorOrderingClient {
  /**
   * Pathway A: Portal Card-Vaulting (Modern JSON/REST API).
   * ASYNCHRONOUS FULFILLMENT BLOCK: This client explicitly aborts and SKIPS ordering
   * unless the Purchase Order status is fully cleared and verified ('PAID_UPFRONT_VIRTUAL_CARD').
   */
  public async submitOrderViaApi(
    po: PurchaseOrderRecord,
    items: Array<{ sku: string; quantity: number }>
  ): Promise<{ status: 'SUCCESS'; distributorOrderId: string }> {
    console.log(`[Distributor API Client] Initiating tokenized B2B ordering for PO: ${po.purchaseOrderId}...`);

    // --- ASYNC FULFILLMENT BLOCK ENFORCEMENT ---
    // Rule 1: We strictly reject and skip order routing if the PO is un-cleared or held on fraud audit!
    if (po.status !== 'PAID_UPFRONT_VIRTUAL_CARD' && po.status !== 'EDI_850_TRANSMITTED') {
      console.error(`\n[Procurement Collision Guard] 🛑 CRITICAL ABORT: Skipping automated checkout for PO: ${po.purchaseOrderId}. Transaction is NOT cleared. Current status: ${po.status}`);
      throw new Error(`[Procurement Error] Automated ordering suspended: PO ${po.purchaseOrderId} has not passed security clearance (Current Status: ${po.status}).`);
    }
    // --- END COMPLIANCE ENFORCEMENT ---

    console.log(`  - Target: Secure API Endpoint (Charge default vaulted merchant card on file)`);

    const distributorOrderId = `IM-API-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    console.log(`[Distributor API Client] SUCCESS: Order acknowledged by distributor. ID: ${distributorOrderId}`);

    return { status: 'SUCCESS', distributorOrderId };
  }

  /**
   * Pathway B: RPA Browser Automation (Legacy Supplier Portals).
   * ASYNCHRONOUS FULFILLMENT BLOCK: This browser automation scripts programmatically aborts
   * and skips website checkout if the PO is on fraud hold.
   */
  public async submitOrderViaBrowserAutomation(
    po: PurchaseOrderRecord,
    items: Array<{ sku: string; quantity: number }>
  ): Promise<{ status: 'SUCCESS'; rpaReceiptId: string }> {
    console.log(`[Distributor RPA Client] Launching Robotic Process Automation (RPA) check-out loop...`);

    // --- ASYNC FULFILLMENT BLOCK ENFORCEMENT ---
    // Rule 2: Strictly block legacy web browser checkouts if the PO is unverified or quarantined!
    if (po.status !== 'PAID_UPFRONT_VIRTUAL_CARD' && po.status !== 'EDI_850_TRANSMITTED') {
      console.error(`\n[Procurement Collision Guard] 🛑 CRITICAL ABORT: Skipping headless browser checkout for PO: ${po.purchaseOrderId}. Security status is unverified. Current status: ${po.status}`);
      throw new Error(`[Procurement Error] Automated web checkout aborted: PO ${po.purchaseOrderId} has failed security clearance (Current Status: ${po.status}).`);
    }
    // --- END COMPLIANCE ENFORCEMENT ---
    
    if (!po.issuedCard) {
      throw new Error('[RPA Error] Check-out failed: No active Stripe single-use virtual card generated for this PO.');
    }

    console.log(`  - Launching secure, headless Chromium browser instance...`);
    console.log(`  - Navigating to legacy reseller portal...`);

    for (const item of items) {
      console.log(`    * [RPA Action] Adding SKU: ${item.sku} (Qty: ${item.quantity}) to cart...`);
    }

    console.log(`  - Navigating to checkout page: '/checkout/payment'...`);
    console.log(`  - Selecting credit/debit card payment option...`);

    console.log(`  - [RPA Type] Typing single-use cardholder details:`);
    console.log(`    * Typing PAN: ${po.issuedCard.pan.substring(0, 4)} **** **** ${po.issuedCard.pan.substring(12)}`);
    console.log(`    * Typing Expiration: ${po.issuedCard.expiration}`);
    console.log(`    * Typing CVV: ***`);

    console.log(`  - [RPA Click] Programmatically clicking 'Place Reseller Order' button...`);
    
    const rpaReceiptId = `IM-RPA-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    console.log(`[Distributor RPA Client] SUCCESS: RPA Browser checkout complete! Receipt: ${rpaReceiptId}\n`);

    return { status: 'SUCCESS', rpaReceiptId };
  }
}

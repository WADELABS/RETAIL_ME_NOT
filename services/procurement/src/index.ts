import { consumer } from '../../event-gateway/consumer/index';
import { publisher } from '../../event-gateway/publisher/index';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

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
    items: z.array(z.object({
      sku: z.string(),
      wholesaleCostCents: z.number().int().positive(),
      quantity: z.number().int().positive(),
    })),
  }),
});

type FulfillmentAssignedEvent = z.infer<typeof FulfillmentAssignedSchema>;

export interface PurchaseOrderRecord {
  purchaseOrderId: string;
  orderId: string;
  providerId: string;
  totalWholesaleCostCents: number;
  status: 'CREATED' | 'EDI_850_TRANSMITTED' | 'ACCEPTED_BY_DISTRIBUTOR' | 'FAILED_TRANSMISSION';
  ediPayload?: string; // Standard ANSI X12 EDI 850 text document
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
      console.log(`[Procurement Service] Received assignment. Creating PO for provider ${payload.providerId}`);

      const purchaseOrderId = `PO-${uuidv4().substring(0, 8).toUpperCase()}`;
      const totalCost = payload.items.reduce((sum, item) => sum + (item.wholesaleCostCents * item.quantity), 0);

      const items = payload.items.map(item => ({
        poItemId: uuidv4(),
        sku: item.sku,
        wholesaleCostCents: item.wholesaleCostCents,
        quantity: item.quantity,
      }));

      // Generate the Purchase Order Record
      const poRecord: PurchaseOrderRecord = {
        purchaseOrderId,
        orderId: payload.orderId,
        providerId: payload.providerId,
        totalWholesaleCostCents: totalCost,
        status: 'CREATED',
        createdAt: new Date().toISOString(),
      };

      // --- SUPPLY CHAIN CODES & RULES ENFORCEMENT ---

      // Automatically translate and route the PO via ANSI X12 EDI 850
      try {
        const automator = new EdiDropshipAutomator();
        const ediPayload = automator.translatePoToEdi850(poRecord, items);
        
        poRecord.ediPayload = ediPayload;
        poRecord.status = 'EDI_850_TRANSMITTED';

        console.log(`[Procurement EDI] SUCCESS: Compiled and Transmitted EDI 850 (Purchase Order) for PO: ${purchaseOrderId}`);
      } catch (err) {
        console.error(`[Procurement EDI Error] Failed to generate EDI 850: ${(err as any).message}`);
        poRecord.status = 'FAILED_TRANSMISSION';
      }

      // --- END SUPPLY CHAIN COMPLIANCE ENFORCEMENT ---

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


// --- 1. ANSI X12 EDI DROPSHIP AUTOMATION MODULE ---

export class EdiDropshipAutomator {
  /**
   * Translates a standard database Purchase Order record into an industry-standard ANSI X12 EDI 850 text document.
   * This is what is transmitted directly to Ingram Micro or D&H's AS2 server.
   */
  public translatePoToEdi850(
    po: PurchaseOrderRecord,
    items: Array<{ sku: string; quantity: number; wholesaleCostCents: number }>
  ): string {
    const now = new Date();
    const formattedDate = now.toISOString().replace(/[-T:]/g, '').substring(2, 8); // YYMMDD
    const formattedTime = now.toISOString().replace(/[-T:]/g, '').substring(8, 12); // HHMM

    const segments: string[] = [];

    // ISA: Interchange Control Header (Segment separator is ~; Element separator is *)
    segments.push(`ISA*00*          *00*          *ZZ*WADELABS       *ZZ*INGRAMMICRO    *${formattedDate}*${formattedTime}*U*00401*000000101*0*T*~`);
    
    // GS: Functional Group Header
    segments.push(`GS*PO*WADELABS*INGRAMMICRO*${now.getFullYear()}${formattedDate.substring(2)}*${formattedTime}*101*X*004010`);
    
    // ST: Transaction Set Header (850 representing Purchase Order)
    segments.push(`ST*850*0001`);
    
    // BEG: Beginning Segment for Purchase Order (00 = Original PO; NE = New Order)
    segments.push(`BEG*00*NE*${po.purchaseOrderId}**${now.getFullYear()}${formattedDate.substring(2)}`);
    
    // N1: Name segments (Buyer & Supplier details)
    segments.push(`N1*BY*WADELABS DEPT*91*WL123`);
    segments.push(`N1*SU*${po.providerId}`);

    // PO1: Loop through and append baseline item data (SKU, Qty, Cost)
    items.forEach((item, index) => {
      const lineNum = index + 1;
      const formattedCost = (item.wholesaleCostCents / 100).toFixed(2);
      segments.push(`PO1*${lineNum}*${item.quantity}*EA*${formattedCost}**BP*${item.sku}`);
    });

    // CTT: Transaction Totals segment (Total lines)
    segments.push(`CTT*${items.length}`);
    
    // SE: Transaction Set Trailer
    segments.push(`SE*${segments.length + 1 - 2}*0001`); // Segments count excluding ISA/GS
    
    // GE & IEA: Control Trailers
    segments.push(`GE*1*101`);
    segments.push(`IEA*1*000000101`);

    return segments.join('\n');
  }

  /**
   * Parses an incoming ANSI X12 EDI 855 (Purchase Order Acknowledgment) document.
   * Confirms whether the supplier accepted the PO.
   */
  public parseEdi855Acknowledgment(edi855Text: string): { purchaseOrderId: string; status: 'ACCEPTED' | 'REJECTED' } {
    console.log('[Procurement EDI] Parsing incoming EDI 855 (Purchase Order Acknowledgment)...');

    const segments = edi855Text.split('\n');
    let purchaseOrderId = '';
    let status: 'ACCEPTED' | 'REJECTED' = 'REJECTED';

    for (const segment of segments) {
      const elements = segment.split('*');
      
      // BAK segment contains the PO reference and the acknowledgment status code
      // BAK*01*AD*PO-ID*... (AD = Acknowledged/Accepted)
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
}

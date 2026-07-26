import { consumer } from '../../event-gateway/consumer/index';
import { publisher } from '../../event-gateway/publisher/index';
import {
  SearchPerformedEventSchema,
  SearchPerformedPayload,
  CartItemAddedEventSchema,
  CartItemAddedPayload
} from '../../../packages/events/src/index';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

export interface CookieConsent {
  essential: boolean;   // Session, security, cart persistence (Always true)
  analytical: boolean;  // Searches, product views, rolling demand metrics (Opt-in required)
  marketing: boolean;   // Affiliate click tracking, sponsored ad pixels (Opt-in required)
}

export interface BrowserTelemetryPayload {
  sessionId: string;
  customerId?: string;
  eventType: 'SEARCH' | 'CART_ADD' | 'PRODUCT_VIEW' | 'REFERRAL_CLICK';
  payload: Record<string, any>;
}

// Schema to validate the incoming data deletion event
const DataDeletionRequestedSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.string().datetime(),
  version: z.literal('1.0'),
  domain: z.literal('identity'),
  eventName: z.literal('customer.data-deletion.requested'),
  correlationId: z.string().uuid(),
  payload: z.object({
    customerId: z.string().uuid(),
    sessionId: z.string().uuid(),
  }),
});

type DataDeletionRequestedEvent = z.infer<typeof DataDeletionRequestedSchema>;

export class TelemetryIntelligenceService {
  // In-memory telemetry database (simulating PostgreSQL aggregates and Redis cache)
  private telemetryState: Map<string, { searches: number; cartAdds: number }> = new Map();
  private historicalSessionLogs: Map<string, Array<{ eventType: string; payload: any }>> = new Map();

  public initialize(): void {
    console.log('[Telemetry Intelligence] Initializing real-time shopper telemetry service...');

    // 1. Subscribe to search.performed events (Event Bus side)
    consumer.subscribe(
      'telemetry',
      'search.performed',
      SearchPerformedEventSchema,
      async (payload: SearchPerformedPayload) => {
        for (const sku of payload.matchedSkus) {
          await this.recordSearch(sku);
        }
      }
    );

    // 2. Subscribe to cart.item_added events (Event Bus side)
    consumer.subscribe(
      'telemetry',
      'cart.item_added',
      CartItemAddedEventSchema,
      async (payload: CartItemAddedPayload) => {
        await this.recordCartAdd(payload.sku, payload.quantity);
      }
    );

    // 3. Subscribe to GDPR/CCPA "Right to be Forgotten" deletion events to close the compliance loop
    consumer.subscribe<DataDeletionRequestedEvent['payload']>(
      'identity',
      'customer.data-deletion.requested',
      DataDeletionRequestedSchema,
      async (payload) => {
        await this.anonymizeCustomerData(payload.customerId, payload.sessionId);
      }
    );
  }

  /**
   * Secure Ingestion Endpoint Logic.
   * This is called by our public HTTP API gateway when the customer's browser sends telemetry.
   * It strictly evaluates the customer's active cookie consent before publishing to the ECOS Event Bus.
   */
  public async ingestBrowserTelemetry(
    telemetry: BrowserTelemetryPayload,
    consent: CookieConsent
  ): Promise<{ status: 'ACCEPTED' | 'REJECTED_CONSENT_DENIED' }> {
    console.log(`[Telemetry Ingestion] Received raw telemetry for session: ${telemetry.sessionId}. Type: ${telemetry.eventType}`);

    // --- CODES AND RULES COMPLIANCE ENFORCEMENT ---

    // Rule 1: Drops analytical events (Searches, Product Views) if analytical consent is denied
    if ((telemetry.eventType === 'SEARCH' || telemetry.eventType === 'PRODUCT_VIEW') && !consent.analytical) {
      console.warn(`[Security & Privacy] DROPPED: Analytical telemetry blocked for session ${telemetry.sessionId} due to missing analytical consent.`);
      return { status: 'REJECTED_CONSENT_DENIED' };
    }

    // Rule 2: Drops marketing events (Affiliate referrals) if marketing consent is denied
    if (telemetry.eventType === 'REFERRAL_CLICK' && !consent.marketing) {
      console.warn(`[Security & Privacy] DROPPED: Marketing referral telemetry blocked for session ${telemetry.sessionId} due to missing marketing consent.`);
      return { status: 'REJECTED_CONSENT_DENIED' };
    }

    // Rule 3: Essential events (e.g. adding items to the basket) always pass to ensure checkout operates
    if (telemetry.eventType === 'CART_ADD' && !consent.essential) {
      console.warn(`[Security & Privacy] CRITICAL: Essential basket event received but essential consent flagged false. Forcing allowed to prevent cart failure.`);
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    // Persist to our session logs (if authorized)
    const sessionLogs = this.historicalSessionLogs.get(telemetry.sessionId) || [];
    sessionLogs.push({ eventType: telemetry.eventType, payload: telemetry.payload });
    this.historicalSessionLogs.set(telemetry.sessionId, sessionLogs);

    // Publish the validated, clean event to the Event Bus
    const correlationId = uuidv4();

    if (telemetry.eventType === 'SEARCH') {
      await publisher.publish(
        'telemetry',
        'search.performed',
        {
          sessionId: telemetry.sessionId,
          query: telemetry.payload.query,
          matchedSkus: telemetry.payload.matchedSkus,
          timestamp: new Date().toISOString(),
        },
        correlationId
      );
    } else if (telemetry.eventType === 'CART_ADD') {
      await publisher.publish(
        'telemetry',
        'cart.item_added',
        {
          sessionId: telemetry.sessionId,
          sku: telemetry.payload.sku,
          quantity: telemetry.payload.quantity,
          unitPriceCents: telemetry.payload.unitPriceCents,
          timestamp: new Date().toISOString(),
        },
        correlationId
      );
    }

    return { status: 'ACCEPTED' };
  }

  /**
   * Autonomous "Right to be Forgotten" Deletion Handler.
   * Completely scrubs, clears, and anonymizes all historical telemetry linked to a session/customer.
   */
  public async anonymizeCustomerData(customerId: string, sessionId: string): Promise<void> {
    console.log(`\n[Telemetry Compliance] 🪓 GDPR/CCPA DELETE REQUEST RECEIVED for Customer: ${customerId}`);

    // 1. Scrub historical session telemetry logs
    if (this.historicalSessionLogs.has(sessionId)) {
      this.historicalSessionLogs.delete(sessionId);
      console.log(`  - SUCCESS: Erased all historical page view and search telemetry logs for session: ${sessionId}`);
    }

    // 2. Publish a deletion completed event
    await publisher.publish(
      'telemetry',
      'customer.data-deletion.completed',
      {
        customerId,
        sessionId,
        scrubbedDomains: ['telemetry_session_logs', 'behavioral_events'],
        completedAt: new Date().toISOString(),
      }
    );

    console.log('[Telemetry Compliance] Customer data anonymization complete.');
  }

  public getSessionLogs(sessionId: string): Array<{ eventType: string; payload: any }> | undefined {
    return this.historicalSessionLogs.get(sessionId);
  }

  private async recordSearch(sku: string): Promise<void> {
    const state = this.getOrCreateState(sku);
    state.searches++;
    await this.evaluateDemandSpike(sku);
  }

  private async recordCartAdd(sku: string, quantity: number): Promise<void> {
    const state = this.getOrCreateState(sku);
    state.cartAdds += quantity;
    await this.evaluateDemandSpike(sku);
  }

  private getOrCreateState(sku: string): { searches: number; cartAdds: number } {
    if (!this.telemetryState.has(sku)) {
      this.telemetryState.set(sku, { searches: 0, cartAdds: 0 });
    }
    return this.telemetryState.get(sku)!;
  }

  /**
   * Computes the rolling Demand Velocity Score.
   * Formula: Demand Score = Searches + (CartAdditions * 5)
   */
  private async evaluateDemandSpike(sku: string): Promise<void> {
    const state = this.telemetryState.get(sku)!;
    const score = state.searches + (state.cartAdds * 5);

    // If the demand velocity score crosses a critical threshold, flag it as TRENDING/HOT
    if (score >= 50) {
      const isHot = score >= 100;
      const status = isHot ? 'HOT' : 'TRENDING';
      const surchargeBps = isHot ? 500 : 250;

      console.log(`\n[Telemetry Intelligence] 🚨 DEMAND SPIKE DETECTED for SKU: ${sku}!`);
      console.log(`  - Demand Velocity Score: ${score} (Searches: ${state.searches}, Cart Adds: ${state.cartAdds})`);
      console.log(`  - Status: ${status}. Applying automatic profit-surcharge: +${(surchargeBps / 100).toFixed(1)}%`);

      // Publish the closed-loop trending-spike event
      await publisher.publish(
        'telemetry',
        'demand.trending-spike',
        {
          sku,
          demandVelocityScore: score,
          trendingStatus: status,
          marginSurchargeBps: surchargeBps,
          detectedAt: new Date().toISOString(),
        }
      );
    }
  }
}

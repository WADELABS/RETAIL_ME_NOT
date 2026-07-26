import { consumer } from '../../event-gateway/consumer/index';
import { publisher } from '../../event-gateway/publisher/index';
import {
  OrderPlacedEventSchema,
  OrderPlacedEventPayload,
  OrderStatusUpdatedEventSchema,
  OrderStatusUpdatedEventPayload,
} from '../../../packages/events/src/index';
import { v4 as uuidv4 } from 'uuid';

export interface EmailLog {
  emailId: string;
  recipientEmail: string;
  type: 'ORDER_CONFIRMATION' | 'SHIPPING_NOTIFICATION' | 'SECURITY_REVIEW' | 'INVOICE';
  subject: string;
  body: string;
  sentAt: string;
}

export interface SupportTicket {
  ticketId: string;
  channel: 'EMAIL' | 'CHAT' | 'WARRANTY';
  customerEmail: string;
  subject: string;
  body: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'PENDING_REPLY' | 'CLOSED';
  associatedOrderId?: string;
  associatedSerial?: string;
  createdAt: string;
}

export class CommunicationAndHelpDeskService {
  // In-memory logs representing database persistence
  private emailLogs: EmailLog[] = [];
  private tickets: Map<string, SupportTicket> = new Map();

  // Simulated warranty lookup table (reusing our serial number database concept)
  private activeWarranties: Map<string, { model: string; expiresAt: number }> = new Map();

  public initialize(): void {
    console.log('[Communication Service] Initializing transactional email listeners...');

    // 1. Subscribe to order placement to auto-trigger Order Confirmations
    consumer.subscribe(
      'orders',
      'order.placed',
      OrderPlacedEventSchema,
      async (payload: OrderPlacedEventPayload) => {
        await this.sendOrderConfirmationEmail(payload);
      }
    );

    // 2. Subscribe to order status updates to auto-trigger Shipping or Delay alerts
    consumer.subscribe(
      'orders',
      'order.status.updated',
      OrderStatusUpdatedEventSchema,
      async (payload: OrderStatusUpdatedEventPayload) => {
        await this.handleOrderStatusEmailTrigger(payload);
      }
    );
  }

  /**
   * Registers a valid device serial number to our active warranty database.
   */
  public registerActiveWarranty(serialNumber: string, model: string, warrantyMonths: number): void {
    const expiresAt = Date.now() + (warrantyMonths * 30 * 24 * 60 * 60 * 1000);
    this.activeWarranties.set(serialNumber, { model, expiresAt });
    console.log(`[Communication Service] Registered Warranty. Serial: ${serialNumber} (${model}).`);
  }

  /**
   * Generates and "sends" a beautiful, dynamic Order Confirmation email.
   */
  public async sendOrderConfirmationEmail(order: OrderPlacedEventPayload): Promise<EmailLog> {
    const emailId = `em_${uuidv4().substring(0, 8)}`;
    const totalDollars = (order.totalPriceCents / 100).toFixed(2);

    const log: EmailLog = {
      emailId,
      recipientEmail: 'customer@example.com', // In production, retrieved from profile
      type: 'ORDER_CONFIRMATION',
      subject: `Thank you for your order! [#${order.orderId.substring(0, 8).toUpperCase()}]`,
      body: `Hi! We have successfully received your order of ${order.lineItems.length} items. Total: $${totalDollars}. We are preparing it for shipment.`,
      sentAt: new Date().toISOString(),
    };

    this.emailLogs.push(log);
    console.log(`\n[Email Engine] 📧 TRANSACTIONAL EMAIL SENT: ORDER_CONFIRMATION to ${log.recipientEmail}`);
    console.log(`  - Subject: ${log.subject}`);
    console.log(`  - Body snippet: "${log.body}"\n`);

    return log;
  }

  /**
   * Evaluates order status transitions and triggers corresponding customer notifications.
   */
  public async handleOrderStatusEmailTrigger(payload: OrderStatusUpdatedEventPayload): Promise<EmailLog | undefined> {
    const emailId = `em_${uuidv4().substring(0, 8)}`;
    let log: EmailLog | undefined = undefined;

    // A. Trigger Shipping Notification
    if (payload.toStatus === 'SHIPPED') {
      log = {
        emailId,
        recipientEmail: 'customer@example.com',
        type: 'SHIPPING_NOTIFICATION',
        subject: `Your order has shipped! [#${payload.orderId.substring(0, 8).toUpperCase()}]`,
        body: `Great news! Your order has shipped via UPS. Tracking number: 1Z999AA1013456. Tracking link: https://ecos.ups.com/track/1Z999AA101345`,
        sentAt: new Date().toISOString(),
      };
    } 
    // B. Trigger Security Hold/Delay Notification
    else if (payload.toStatus === 'ON_HOLD') {
      log = {
        emailId,
        recipientEmail: 'customer@example.com',
        type: 'SECURITY_REVIEW',
        subject: `Important update regarding your order [#${payload.orderId.substring(0, 8).toUpperCase()}]`,
        body: `Your order has been temporarily placed on hold by our automated risk validation engine for verification. Our support team is auditing the details.`,
        sentAt: new Date().toISOString(),
      };
    }

    if (log) {
      this.emailLogs.push(log);
      console.log(`\n[Email Engine] 📧 TRANSACTIONAL EMAIL SENT: ${log.type} to ${log.recipientEmail}`);
      console.log(`  - Subject: ${log.subject}\n`);
    }

    return log;
  }

  /**
   * Funnels customer emails, site chats, and warranty requests into a single, unified Support Queue.
   * Runs automated priority escalations and warranty validity checks.
   */
  public ingestHelpTicket(ticketInput: Omit<SupportTicket, 'ticketId' | 'priority' | 'status' | 'createdAt'>): SupportTicket {
    console.log(`[Help Desk] Ingesting customer support request via channel: ${ticketInput.channel}`);

    const ticketId = `TKT-${uuidv4().substring(0, 8).toUpperCase()}`;
    let priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' = 'NORMAL';

    // --- SUPPORT CODES & RULES ENFORCEMENT ---

    // Rule 1: Automated Priority Escalation
    const keywordPayload = `${ticketInput.subject} ${ticketInput.body}`.toLowerCase();
    
    if (keywordPayload.includes('chargeback') || keywordPayload.includes('dispute') || keywordPayload.includes('lawyer')) {
      priority = 'CRITICAL';
      console.error(`  - [Escalation Trigger] CRITICAL keyword detected. Escalating Ticket ${ticketId} to CRITICAL priority.`);
    } else if (keywordPayload.includes('broken') || keywordPayload.includes('refund') || keywordPayload.includes('defect') || keywordPayload.includes('scam')) {
      priority = 'HIGH';
      console.warn(`  - [Escalation Trigger] HIGH-risk keyword detected. Escalating Ticket ${ticketId} to HIGH priority.`);
    }

    // Rule 2: Automated Warranty Claims Verification
    if (ticketInput.channel === 'WARRANTY' && ticketInput.associatedSerial) {
      console.log(`  - [Warranty Claim] Intercepted warranty request for device serial: ${ticketInput.associatedSerial}`);
      const warranty = this.activeWarranties.get(ticketInput.associatedSerial);

      if (!warranty) {
        priority = 'HIGH';
        console.error(`  - [Fraud Warning] INVALID SERIAL: No warranty record exists for serial ${ticketInput.associatedSerial}. Flagging as high-risk claim.`);
      } else if (Date.now() > warranty.expiresAt) {
        priority = 'NORMAL';
        console.warn(`  - [Warranty Expired] Warranty for serial ${ticketInput.associatedSerial} expired on ${new Date(warranty.expiresAt).toLocaleDateString()}.`);
      } else {
        priority = 'LOW'; // Verified valid warranty, easy routing
        console.log(`  - [Warranty Verified] VALID warranty for ${warranty.model}. Auto-assigned to low-friction technician queue.`);
      }
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    const ticket: SupportTicket = {
      ...ticketInput,
      ticketId,
      priority,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };

    this.tickets.set(ticketId, ticket);
    console.log(`[Help Desk] SUCCESS: Created Ticket: ${ticketId}. Priority: ${priority}. Status: OPEN\n`);

    return ticket;
  }

  public getEmailLogs(): EmailLog[] {
    return this.emailLogs;
  }

  public getTicket(ticketId: string): SupportTicket | undefined {
    return this.tickets.get(ticketId);
  }
}

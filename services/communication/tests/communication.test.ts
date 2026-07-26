import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CommunicationAndHelpDeskService } from '../src/index';
import { OrderStatus } from '../../orders/src/index';
import { v4 as uuidv4 } from 'uuid';

test('Order placement automatically triggers dynamic Order Confirmation Email', async () => {
  const service = new CommunicationAndHelpDeskService();
  service.initialize();

  const orderId = uuidv4();
  const customerId = uuidv4();

  // Simulate receiving the orders.order.placed event
  const emailLog = await service.sendOrderConfirmationEmail({
    orderId,
    customerId,
    status: 'PENDING_FULFILLMENT',
    totalPriceCents: 129900, // $1,299.00
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

  assert.equal(emailLog.type, 'ORDER_CONFIRMATION');
  assert.ok(emailLog.subject.includes(orderId.substring(0, 8).toUpperCase()));
  assert.ok(emailLog.body.includes('$1299.00'), 'Email body must dynamically render totals');
});

test('Order status updates trigger Shipping or Security Hold notifications', async () => {
  const service = new CommunicationAndHelpDeskService();
  service.initialize();

  const orderId = uuidv4();

  // 1. Simulate order transitioning to SHIPPED
  const shippingEmail = await service.handleOrderStatusEmailTrigger({
    orderId,
    fromStatus: 'AWAITING_SHIPMENT' as any,
    toStatus: 'SHIPPED' as any,
    reason: 'Shipped via UPS',
    timestamp: new Date().toISOString(),
  });

  assert.ok(shippingEmail);
  assert.equal(shippingEmail.type, 'SHIPPING_NOTIFICATION');
  assert.ok(shippingEmail.body.includes('1Z999AA1013456'), 'Shipping email must include the carrier tracking number');

  // 2. Simulate order transitioning to ON_HOLD (security delay)
  const delayEmail = await service.handleOrderStatusEmailTrigger({
    orderId,
    fromStatus: 'PENDING_FULFILLMENT' as any,
    toStatus: 'ON_HOLD' as any,
    reason: 'Security check flagged',
    timestamp: new Date().toISOString(),
  });

  assert.ok(delayEmail);
  assert.equal(delayEmail.type, 'SECURITY_REVIEW');
  assert.ok(delayEmail.body.includes('hold'), 'Delay email must inform customer of verification hold');
});

test('Help Desk dynamically escalates tickets containing high-sentiment keywords', () => {
  const service = new CommunicationAndHelpDeskService();

  // Standard low-priority ticket
  const standardTicket = service.ingestHelpTicket({
    channel: 'EMAIL',
    customerEmail: 'operator@wadelabs.com',
    subject: 'Question about specifications',
    body: 'Can you tell me the RAM limits on the microserver?',
  });
  assert.equal(standardTicket.priority, 'NORMAL');

  // Ticket containing HIGH risk keyword
  const highRiskTicket = service.ingestHelpTicket({
    channel: 'EMAIL',
    customerEmail: 'buyer@example.com',
    subject: 'Requesting full refund',
    body: 'My item arrived broken and defective.',
  });
  assert.equal(highRiskTicket.priority, 'HIGH', 'Refund and broken keywords must auto-escalate ticket priority to HIGH');

  // Ticket containing CRITICAL legal/financial threat keywords
  const threatTicket = service.ingestHelpTicket({
    channel: 'EMAIL',
    customerEmail: 'buyer2@example.com',
    subject: 'Filing chargeback dispute',
    body: 'I will contact my lawyer and file a chargeback on this card charge.',
  });
  assert.equal(threatTicket.priority, 'CRITICAL', 'Chargeback and dispute keywords must auto-escalate ticket priority to CRITICAL');
});

test('Help Desk automatically cross-references and verifies warranty claims', () => {
  const service = new CommunicationAndHelpDeskService();
  
  const validSerial = 'ECOS-SR-998811A';
  const invalidSerial = 'FORGED-SERIAL-999';

  // Register a valid serial under active warranty
  service.registerActiveWarranty(validSerial, 'Laptop Stealth 16', 12); // 12-month warranty

  // 1. Submit a warranty claim with a VALID, registered serial
  const validClaim = service.ingestHelpTicket({
    channel: 'WARRANTY',
    customerEmail: 'operator@wadelabs.com',
    subject: 'Power port loose',
    body: 'The power port has become loose on my laptop.',
    associatedSerial: validSerial,
  });
  assert.equal(validClaim.priority, 'LOW', 'Verified warranty claims are assigned low priority for fast, automated dispatching');

  // 2. Submit a warranty claim with an INVALID, unregistered serial (Fraud Attempt)
  const fraudulentClaim = service.ingestHelpTicket({
    channel: 'WARRANTY',
    customerEmail: 'scammer@example.com',
    subject: 'Flickering screen',
    body: 'Requesting immediate replacement for this laptop.',
    associatedSerial: invalidSerial, // INVALID
  });
  assert.equal(fraudulentClaim.priority, 'HIGH', 'Invalid or forged serial warranty claims must be auto-escalated to HIGH priority for fraud auditing');
});


// --- "ANTIDOTE TO AMAZON" ESCAPE TO HUMAN BYPASS TESTS ---

test('Help Desk "Escape to Human" trigger successfully bypasses chatbot and routes to physical representative', () => {
  const service = new CommunicationAndHelpDeskService();

  // Customer asks to talk to a human agent directly
  const ticket = service.ingestHelpTicket({
    channel: 'CHAT',
    customerEmail: 'frustrated_buyer@example.com',
    subject: 'Need help',
    body: 'This chatbot is completely useless. Let me talk to a real human operator please.',
  });

  // Verify that ECOS programmatically bypassed automation and escalated the ticket
  assert.equal(ticket.isEscapedToHuman, true, 'isEscapedToHuman flag must be set to true');
  assert.equal(ticket.priority, 'HIGH', 'Escaped tickets must be auto-escalated to HIGH priority to meet customer SLAs');
  assert.equal(ticket.assignedAgentId, 'agent_hreed', 'Ticket must be immediately assigned to a physical representative');
});

test('Help Desk allows administrators to manually force-escape a ticket to a real person on demand', async () => {
  const service = new CommunicationAndHelpDeskService();

  // 1. Ingest a standard, non-escaped email ticket
  const ticket = service.ingestHelpTicket({
    channel: 'EMAIL',
    customerEmail: 'operator@wadelabs.com',
    subject: 'Compatibility check',
    body: 'Does this motherboard support PCIe Gen 5 nvme SSDs?',
  });

  assert.equal(ticket.isEscapedToHuman, false);
  assert.equal(ticket.priority, 'NORMAL');
  assert.equal(ticket.assignedAgentId, undefined);

  // 2. An administrator manual force-escapes it from the dashboard
  const updatedTicket = await service.forceEscapeToHuman(ticket.ticketId, 'agent_wade');

  // Verify update
  assert.equal(updatedTicket.isEscapedToHuman, true, 'isEscapedToHuman must be manually set');
  assert.equal(updatedTicket.priority, 'HIGH', 'Priority must be elevated');
  assert.equal(updatedTicket.assignedAgentId, 'agent_wade', 'Must assign the designated representative');
});

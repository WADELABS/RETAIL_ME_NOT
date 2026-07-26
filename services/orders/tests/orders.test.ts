import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderService, OrderStatus } from '../src/index';
import { CarrierShippingService } from '../../distributor-adapter-a/src/index';
import { v4 as uuidv4 } from 'uuid';

test('Order Service creates new orders in PENDING_PAYMENT state', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 108000,
    taxCents: 8000,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    lineItems: [
      { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 100000 }
    ],
  });

  assert.equal(order.status, OrderStatus.PENDING_PAYMENT, 'A new order must start in PENDING_PAYMENT');
});

test('Order Service enforces state machine transition rules', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 108000,
    taxCents: 8000,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    lineItems: [
      { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 100000 }
    ],
  });

  await assert.rejects(
    async () => {
      await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Testing invalid transition');
    },
    /Invalid transition/,
    'Directly transitioning to DELIVERED from PENDING_PAYMENT must fail'
  );

  const updatedOrder = await service.transitionOrder(
    order.orderId,
    OrderStatus.PENDING_FULFILLMENT,
    'Payment successfully processed'
  );
  assert.equal(updatedOrder.status, OrderStatus.PENDING_FULFILLMENT, 'Should successfully transition order status');
});

test('Order Service creates immutable audit trails for every transition', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 108000,
    taxCents: 8000,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    lineItems: [
      { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 100000 }
    ],
  });

  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Payment success');
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Risk checks complete, routed');

  const transitions = service.getTransitions(order.orderId);
  
  assert.equal(transitions.length, 2, 'Should record exactly 2 state transitions in the audit trail');
  assert.equal(transitions[0].fromStatus, OrderStatus.PENDING_PAYMENT);
  assert.equal(transitions[0].toStatus, OrderStatus.PENDING_FULFILLMENT);
  assert.equal(transitions[1].fromStatus, OrderStatus.PENDING_FULFILLMENT);
  assert.equal(transitions[1].toStatus, OrderStatus.AWAITING_SHIPMENT);
  assert.ok(transitions[0].timestamp, 'Audit transitions must have valid timestamps');
});


// --- 1. CARRIER SHIPPING LABEL GENERATION TESTS ---

test('Carrier Shipping Service generates valid tracking and base64-PDF label documents', async () => {
  const carrierService = new CarrierShippingService();

  const label = await carrierService.generateShippingLabel('UPS', '78701', '90210', 8.5);

  assert.equal(label.carrier, 'UPS');
  assert.ok(label.trackingNumber.startsWith('1Z'), 'UPS tracking numbers must begin with 1Z');
  assert.ok(label.labelBase64.length > 20, 'Should return a non-empty base64 PDF document payload');
});


// --- 2. SELF-SERVICE RETURNS & RMA PORTAL ENGINE TESTS ---

test('Self-Service RMA Portal accepts valid return requests and programmatically issues RMAs', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 129900,
    taxCents: 0,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    lineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 129900 }],
  });

  // Transition order to DELIVERED status to simulate active delivery history
  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Pay');
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Route');
  await service.transitionOrder(order.orderId, OrderStatus.SHIPPED, 'Ship');
  await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Deliver');

  // Customer requests a standard self-service return inside our 30-day window
  const rma = await service.initiateSelfServiceRma(
    order.orderId,
    'LAPTOP-WADE-01',
    'Customer changed mind',
    false // Non-defective, standard change-of-mind return
  );

  assert.ok(rma.rmaId.startsWith('RMA-'), 'RMA ID must be unique and trackable');
  assert.equal(rma.status, 'ISSUED');
  assert.equal(rma.prePaidLabel, undefined, 'Pre-paid return shipping label is NOT automatically issued for change-of-mind');

  // Confirm Order state machine transitioned to RETURN_REQUESTED
  const updatedOrder = service.getOrder(order.orderId)!;
  assert.equal(updatedOrder.status, OrderStatus.RETURN_REQUESTED, 'Order must transition to RETURN_REQUESTED upon RMA issuance');
});

test('Self-Service RMA Portal automatically attaches a pre-paid return shipping label for defective tech', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 129900,
    taxCents: 0,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    lineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 129900 }],
  });

  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Pay');
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Route');
  await service.transitionOrder(order.orderId, OrderStatus.SHIPPED, 'Ship');
  await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Deliver');

  // Customer requests return specifically flagging the tech item as DEFECTIVE
  const rma = await service.initiateSelfServiceRma(
    order.orderId,
    'LAPTOP-WADE-01',
    'Screen flickers and has horizontal lines',
    true // FLAG DEFECTIVE TECH
  );

  assert.ok(rma.rmaId.startsWith('RMA-'));
  assert.equal(rma.isDefective, true);
  
  // Verify that ECOS programmatically issued a pre-paid return label automatically
  assert.ok(rma.prePaidLabel, 'A pre-paid return shipping label must be automatically issued for defective tech');
  assert.equal(rma.prePaidLabel.carrier, 'UPS');
  assert.ok(rma.prePaidLabel.trackingNumber.startsWith('1Z'));
});

test('Self-Service RMA Portal strictly rejects return requests exceeding the 30-day window', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 129900,
    taxCents: 0,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    lineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 129900 }],
  });

  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Pay');
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Route');
  await service.transitionOrder(order.orderId, OrderStatus.SHIPPED, 'Ship');
  await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Deliver');

  // Backdate the order's placedAt date by 45 days in the database to simulate an expired window
  const backdate = new Date(Date.now() - 45 * 86400000).toISOString();
  order.placedAt = backdate;

  // The RMA Portal must actively block this attempt and reject the promise
  await assert.rejects(
    async () => {
      await service.initiateSelfServiceRma(order.orderId, 'LAPTOP-WADE-01', 'Defective', true);
    },
    /outside the allowable 30-day return window/,
    'RMA requests outside the 30-day return window must fail-safe'
  );
});

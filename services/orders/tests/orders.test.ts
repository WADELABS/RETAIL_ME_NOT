import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderService, OrderStatus, PaymentMethod } from '../src/index';
import { CarrierShippingService } from '../../distributor-adapter-a/src/index';
import { v4 as uuidv4 } from 'uuid';

test('Order Service creates new orders in PENDING_PAYMENT state', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 10800, // $108.00 (below $500, CC is allowed)
    taxCents: 800,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    selectedPaymentMethod: PaymentMethod.STRIPE_CREDIT_CARD,
    lineItems: [
      { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 10000 }
    ],
  });

  assert.equal(order.status, OrderStatus.PENDING_PAYMENT, 'A new order must start in PENDING_PAYMENT');
  assert.equal(order.selectedPaymentMethod, PaymentMethod.STRIPE_CREDIT_CARD);
});

test('Order Service enforces state machine transition rules', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 10800,
    taxCents: 800,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    selectedPaymentMethod: PaymentMethod.STRIPE_CREDIT_CARD,
    lineItems: [
      { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 10000 }
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
    totalPriceCents: 10800,
    taxCents: 800,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    selectedPaymentMethod: PaymentMethod.STRIPE_CREDIT_CARD,
    lineItems: [
      { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 10000 }
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


// --- CARRIER SHIPPING LABEL GENERATION TESTS ---

test('Carrier Shipping Service generates valid tracking and base64-PDF label documents', async () => {
  const carrierService = new CarrierShippingService();

  const label = await carrierService.generateShippingLabel('UPS', '78701', '90210', 8.5);

  assert.equal(label.carrier, 'UPS');
  assert.ok(label.trackingNumber.startsWith('1Z'), 'UPS tracking numbers must begin with 1Z');
  assert.ok(label.labelBase64.length > 20, 'Should return a non-empty base64 PDF document payload');
});


// --- SELF-SERVICE RETURNS & RMA PORTAL ENGINE TESTS ---

test('Self-Service RMA Portal accepts valid return requests and programmatically issues RMAs', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 12900,
    taxCents: 0,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    selectedPaymentMethod: PaymentMethod.STRIPE_CREDIT_CARD,
    lineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 12900 }],
  });

  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Pay');
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Route');
  await service.transitionOrder(order.orderId, OrderStatus.SHIPPED, 'Ship');
  await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Deliver');

  const rma = await service.initiateSelfServiceRma(
    order.orderId,
    'LAPTOP-WADE-01',
    'Customer changed mind',
    false
  );

  assert.ok(rma.rmaId.startsWith('RMA-'), 'RMA ID must be unique and trackable');
  assert.equal(rma.status, 'ISSUED');
  assert.equal(rma.prePaidLabel, undefined);

  const updatedOrder = service.getOrder(order.orderId)!;
  assert.equal(updatedOrder.status, OrderStatus.RETURN_REQUESTED);
});

test('Self-Service RMA Portal automatically attaches a pre-paid return shipping label for defective tech', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 12900,
    taxCents: 0,
    shippingCents: 0,
    discountCents: 0,
    selectedPaymentMethod: PaymentMethod.STRIPE_CREDIT_CARD,
    currency: 'USD',
    lineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 12900 }],
  });

  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Pay');
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Route');
  await service.transitionOrder(order.orderId, OrderStatus.SHIPPED, 'Ship');
  await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Deliver');

  const rma = await service.initiateSelfServiceRma(
    order.orderId,
    'LAPTOP-WADE-01',
    'Screen flickers and has horizontal lines',
    true
  );

  assert.ok(rma.rmaId.startsWith('RMA-'));
  assert.equal(rma.isDefective, true);
  assert.ok(rma.prePaidLabel);
  assert.equal(rma.prePaidLabel.carrier, 'UPS');
  assert.ok(rma.prePaidLabel.trackingNumber.startsWith('1Z'));
});

test('Self-Service RMA Portal strictly rejects return requests exceeding the 30-day window', async () => {
  const service = new OrderService();
  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 12900,
    taxCents: 0,
    shippingCents: 0,
    discountCents: 0,
    selectedPaymentMethod: PaymentMethod.STRIPE_CREDIT_CARD,
    currency: 'USD',
    lineItems: [{ sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 12900 }],
  });

  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Pay');
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Route');
  await service.transitionOrder(order.orderId, OrderStatus.SHIPPED, 'Ship');
  await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Deliver');

  const backdate = new Date(Date.now() - 45 * 86400000).toISOString();
  order.placedAt = backdate;

  await assert.rejects(
    async () => {
      await service.initiateSelfServiceRma(order.orderId, 'LAPTOP-WADE-01', 'Defective', true);
    },
    /outside the allowable 30-day return window/
  );
});


// --- ADVANCED B2B DYNAMIC PAYMENT METHOD TESTS ---

test('Payment Resolver allows both credit cards and bank transfers for low-value orders (< $500)', () => {
  const service = new OrderService();

  const allowedMethods = service.resolveAllowedPaymentMethods(45000); // $450.00
  
  assert.ok(allowedMethods.includes(PaymentMethod.STRIPE_CREDIT_CARD));
  assert.ok(allowedMethods.includes(PaymentMethod.STRIPE_ACH_FINANCIAL_CONNECTIONS), 'Legitimate, small orders support CC convenience');
});

test('Payment Resolver strictly hides credit cards for high-value orders (>= $500)', () => {
  const service = new OrderService();

  const allowedMethods = service.resolveAllowedPaymentMethods(129900); // $1,299.00
  
  assert.equal(allowedMethods.length, 1);
  assert.equal(allowedMethods[0], PaymentMethod.STRIPE_ACH_FINANCIAL_CONNECTIONS, 'Must restrict to Stripe ACH Direct Debit');
  assert.equal(allowedMethods.includes(PaymentMethod.STRIPE_CREDIT_CARD), false, 'Credit cards must be hidden');
});

test('Backend Payment Guard strictly blocks and rejects credit card checkout attempts on high-value orders', async () => {
  const service = new OrderService();

  // Hacky buyer attempts to bypass frontend and POST a $1,299.00 purchase on a credit card
  await assert.rejects(
    async () => {
      await service.createOrder({
        customerId: uuidv4(),
        totalPriceCents: 129900, // $1,299.00 (EXCEEDS $500 LIMIT!)
        taxCents: 10392,
        shippingCents: 0,
        discountCents: 0,
        currency: 'USD',
        selectedPaymentMethod: PaymentMethod.STRIPE_CREDIT_CARD, // VIOLATION!
        lineItems: [
          { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 129900 }
        ],
      });
    },
    RangeError,
    'The backend must fail-safe and block credit card usage on high-value orders'
  );
});

test('Backend Payment Guard successfully allows ACH checkout on high-value orders', async () => {
  const service = new OrderService();

  const order = await service.createOrder({
    customerId: uuidv4(),
    totalPriceCents: 129900, // $1,299.00 (EXCEEDS $500 LIMIT)
    taxCents: 10392,
    shippingCents: 0,
    discountCents: 0,
    currency: 'USD',
    selectedPaymentMethod: PaymentMethod.STRIPE_ACH_FINANCIAL_CONNECTIONS, // COMPLIANT PAYMENT METHOD
    lineItems: [
      { sku: 'LAPTOP-WADE-01', quantity: 1, unitPriceCents: 129900 }
    ],
  });

  assert.equal(order.status, OrderStatus.PENDING_PAYMENT);
  assert.equal(order.selectedPaymentMethod, PaymentMethod.STRIPE_ACH_FINANCIAL_CONNECTIONS, 'ACH direct checkout must succeed');
});

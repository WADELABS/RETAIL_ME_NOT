import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OrderService, OrderStatus } from '../src/index';
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

  // 1. Attempt an illegal transition (e.g., direct to DELIVERED)
  await assert.rejects(
    async () => {
      await service.transitionOrder(order.orderId, OrderStatus.DELIVERED, 'Testing invalid transition');
    },
    /Invalid transition/,
    'Directly transitioning to DELIVERED from PENDING_PAYMENT must fail'
  );

  // 2. Execute a legal transition (e.g., PENDING_PAYMENT -> PENDING_FULFILLMENT)
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

  // Transition 1: Payment processes
  await service.transitionOrder(order.orderId, OrderStatus.PENDING_FULFILLMENT, 'Payment success');
  
  // Transition 2: Risk checks pass and fulfillment router assigns it
  await service.transitionOrder(order.orderId, OrderStatus.AWAITING_SHIPMENT, 'Risk checks complete, routed');

  const transitions = service.getTransitions(order.orderId);
  
  assert.equal(transitions.length, 2, 'Should record exactly 2 state transitions in the audit trail');
  assert.equal(transitions[0].fromStatus, OrderStatus.PENDING_PAYMENT);
  assert.equal(transitions[0].toStatus, OrderStatus.PENDING_FULFILLMENT);
  assert.equal(transitions[1].fromStatus, OrderStatus.PENDING_FULFILLMENT);
  assert.equal(transitions[1].toStatus, OrderStatus.AWAITING_SHIPMENT);
  assert.ok(transitions[0].timestamp, 'Audit transitions must have valid timestamps');
});

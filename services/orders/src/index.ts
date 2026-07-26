import { publisher } from '../../event-gateway/publisher/index';
import { v4 as uuidv4 } from 'uuid';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_FULFILLMENT = 'PENDING_FULFILLMENT',
  AWAITING_SHIPMENT = 'AWAITING_SHIPMENT',
  ON_HOLD = 'ON_HOLD',
  PARTIALLY_SHIPPED = 'PARTIALLY_SHIPPED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

// Strictly defines the valid state transition graph for ECOS orders
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PENDING_FULFILLMENT, OrderStatus.FAILED],
  [OrderStatus.PENDING_FULFILLMENT]: [OrderStatus.AWAITING_SHIPMENT, OrderStatus.ON_HOLD, OrderStatus.CANCELLED],
  [OrderStatus.AWAITING_SHIPMENT]: [OrderStatus.PARTIALLY_SHIPPED, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.ON_HOLD]: [OrderStatus.AWAITING_SHIPMENT, OrderStatus.CANCELLED],
  [OrderStatus.PARTIALLY_SHIPPED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [], // End state
  [OrderStatus.CANCELLED]: [], // End state
  [OrderStatus.FAILED]: [],    // End state
};

export interface Order {
  orderId: string;
  customerId: string;
  status: OrderStatus;
  totalPriceCents: number;
  taxCents: number;
  shippingCents: number;
  discountCents: number;
  currency: string;
  placedAt: string;
  lineItems: Array<{
    sku: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

export interface OrderStateTransition {
  transitionId: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  reason: string;
  timestamp: string;
}

export class OrderStateMachine {
  /**
   * Validates whether a requested order status transition is legal.
   */
  public static isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    const allowed = VALID_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }
}

export class OrderService {
  // In-memory data store for local simulation & testing
  private orders: Map<string, Order> = new Map();
  private transitions: OrderStateTransition[] = [];

  /**
   * Creates a new Customer Sales Order, defaulting to PENDING_PAYMENT.
   */
  public async createOrder(orderInput: Omit<Order, 'orderId' | 'status' | 'placedAt'>): Promise<Order> {
    const orderId = uuidv4();
    const order: Order = {
      ...orderInput,
      orderId,
      status: OrderStatus.PENDING_PAYMENT,
      placedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, order);
    console.log(`[Order Service] Created Sales Order: ${orderId} in PENDING_PAYMENT state.`);
    return order;
  }

  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  public getTransitions(orderId: string): OrderStateTransition[] {
    return this.transitions.filter(t => t.orderId === orderId);
  }

  /**
   * Transitions an order's status, enforcing state machine integrity and logging the audit transition.
   */
  public async transitionOrder(orderId: string, toStatus: OrderStatus, reason: string): Promise<Order> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`[Order Service Error] Order ${orderId} not found.`);
    }

    const fromStatus = order.status;

    // 1. Enforce state machine rules
    if (!OrderStateMachine.isValidTransition(fromStatus, toStatus)) {
      throw new Error(`[Order Service Error] Invalid transition: Cannot transition Order ${orderId} from ${fromStatus} to ${toStatus}.`);
    }

    // 2. Perform the transition
    order.status = toStatus;
    console.log(`[Order Service] Transitioned Order ${orderId} from ${fromStatus} -> ${toStatus}. Reason: ${reason}`);

    // 3. Log the immutable transition to the audit ledger
    const transition: OrderStateTransition = {
      transitionId: uuidv4(),
      orderId,
      fromStatus,
      toStatus,
      reason,
      timestamp: new Date().toISOString(),
    };
    this.transitions.push(transition);

    // 4. Publish state change events to the Event Bus
    await publisher.publish(
      'orders',
      'order.status.updated',
      {
        orderId,
        fromStatus,
        toStatus,
        reason,
        timestamp: transition.timestamp,
      }
    );

    // If payment succeeds and order transitions to PENDING_FULFILLMENT, publish the main order.placed trigger
    if (toStatus === OrderStatus.PENDING_FULFILLMENT) {
      await publisher.publish(
        'orders',
        'order.placed',
        {
          orderId: order.orderId,
          customerId: order.customerId,
          status: order.status,
          totalPriceCents: order.totalPriceCents,
          taxCents: order.taxCents,
          shippingCents: order.shippingCents,
          discountCents: order.discountCents,
          currency: order.currency,
          placedAt: order.placedAt,
          lineItems: order.lineItems,
          // Simple address placeholders
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
        }
      );
    }

    return order;
  }
}

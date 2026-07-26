import { publisher } from '../../event-gateway/publisher/index';
import { v4 as uuidv4 } from 'uuid';
import { CarrierShippingService, ShippingLabelResult } from '../../distributor-adapter-a/src/index';

export enum OrderStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING_FULFILLMENT = 'PENDING_FULFILLMENT',
  AWAITING_SHIPMENT = 'AWAITING_SHIPMENT',
  ON_HOLD = 'ON_HOLD',
  PARTIALLY_SHIPPED = 'PARTIALLY_SHIPPED',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  RETURN_REQUESTED = 'RETURN_REQUESTED', // New return request status
  RETURNED = 'RETURNED',                 // Final returned and resolved status
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
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED, OrderStatus.CANCELLED], // Customers can return or cancel delivered orders
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED],                        // Return resolves to RETURNED status
  [OrderStatus.RETURNED]: [],  // End state
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

export interface RmaRecord {
  rmaId: string;
  orderId: string;
  sku: string;
  reason: string;
  isDefective: boolean;
  prePaidLabel?: ShippingLabelResult; // Return label attached automatically for defective tech
  status: 'ISSUED' | 'RECEIVED' | 'RESOLVED';
  createdAt: string;
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
  
  // Dedicated RMA database
  private rmas: Map<string, RmaRecord> = new Map();

  // Instantiate carrier integration service
  private carrierService = new CarrierShippingService();

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

  public getRma(rmaId: string): RmaRecord | undefined {
    return this.rmas.get(rmaId);
  }

  /**
   * Self-Service RMA Portal Engine.
   * Enables customers to request trackable return codes. Automatically issues pre-paid labels for defective tech.
   */
  public async initiateSelfServiceRma(
    orderId: string,
    sku: string,
    reason: string,
    isDefective: boolean
  ): Promise<RmaRecord> {
    console.log(`[RMA Portal] Received self-service return request for Order: ${orderId}. SKU: ${sku}`);

    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`[RMA Error] RMA request failed: Order ${orderId} not found.`);
    }

    if (order.status !== OrderStatus.DELIVERED) {
      throw new Error(`[RMA Error] RMA request failed: Only DELIVERED orders can be returned. Current Status: ${order.status}`);
    }

    // --- CODES AND RULES COMPLIANCE ENFORCEMENT ---

    // Rule 1: Enforce the standard 30-day return window (from order placement/delivery)
    const placedDate = new Date(order.placedAt).getTime();
    const ageInDays = (Date.now() - placedDate) / (1000 * 60 * 60 * 24);

    if (ageInDays > 30) {
      console.error(`[RMA Violation] REJECTED: Return request for Order ${orderId} exceeds the allowable 30-day window.`);
      throw new Error('[RMA Error] Return request rejected: Order is outside the allowable 30-day return window.');
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    const rmaId = `RMA-${uuidv4().substring(0, 8).toUpperCase()}`;
    let prePaidLabel: ShippingLabelResult | undefined = undefined;

    // Rule 2: If the tech item is defective, we automatically call our Carrier Shipping service to generate a pre-paid return label!
    if (isDefective) {
      console.log(`  - Defective tech item flagged. Programmatically issuing pre-paid return shipping label...`);
      prePaidLabel = await this.carrierService.generatePrePaidReturnLabel('UPS', '1Z999AA101_ORIGINAL_TRACKING');
    }

    const rma: RmaRecord = {
      rmaId,
      orderId,
      sku,
      reason,
      isDefective,
      prePaidLabel,
      status: 'ISSUED',
      createdAt: new Date().toISOString(),
    };

    this.rmas.set(rmaId, rma);

    // 3. Transition the order state to RETURN_REQUESTED
    await this.transitionOrder(orderId, OrderStatus.RETURN_REQUESTED, `RMA ${rmaId} issued. Reason: ${reason}`);

    console.log(`[RMA Portal] SUCCESS: Issued RMA: ${rmaId} for SKU: ${sku}. Pre-paid Label: ${prePaidLabel ? 'ATTACHED' : 'NOT_REQUIRED'}`);

    // Publish returns.rma.issued event to gateway
    await publisher.publish(
      'returns',
      'rma.issued',
      {
        rmaId,
        orderId,
        customerId: order.customerId,
        sku,
        isDefective,
        prePaidTrackingNumber: prePaidLabel?.trackingNumber,
        createdAt: rma.createdAt,
      }
    );

    return rma;
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

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
  RETURN_REQUESTED = 'RETURN_REQUESTED',
  RETURNED = 'RETURNED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

export enum PaymentMethod {
  STRIPE_CREDIT_CARD = 'STRIPE_CREDIT_CARD',
  STRIPE_ACH_FINANCIAL_CONNECTIONS = 'STRIPE_ACH_FINANCIAL_CONNECTIONS', // Instant Bank Login (Plaid-style)
}

// Strictly defines the valid state transition graph for ECOS orders
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PENDING_FULFILLMENT, OrderStatus.FAILED],
  [OrderStatus.PENDING_FULFILLMENT]: [OrderStatus.AWAITING_SHIPMENT, OrderStatus.ON_HOLD, OrderStatus.CANCELLED],
  [OrderStatus.AWAITING_SHIPMENT]: [OrderStatus.PARTIALLY_SHIPPED, OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.ON_HOLD]: [OrderStatus.AWAITING_SHIPMENT, OrderStatus.CANCELLED],
  [OrderStatus.PARTIALLY_SHIPPED]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.RETURN_REQUESTED, OrderStatus.CANCELLED],
  [OrderStatus.RETURN_REQUESTED]: [OrderStatus.RETURNED],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.FAILED]: [],
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
  selectedPaymentMethod: PaymentMethod; // Mandatory payment-routing tracking
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
  prePaidLabel?: ShippingLabelResult;
  status: 'ISSUED' | 'RECEIVED' | 'RESOLVED';
  createdAt: string;
}

export class OrderStateMachine {
  public static isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
    const allowed = VALID_TRANSITIONS[from] || [];
    return allowed.includes(to);
  }
}

export class OrderService {
  // In-memory data store for local simulation & testing
  private orders: Map<string, Order> = new Map();
  private transitions: OrderStateTransition[] = [];
  private rmas: Map<string, RmaRecord> = new Map();

  // High-value B2B payment method threshold (Default: $500.00 / 50,000 cents)
  private highValuePaymentThresholdCents = 50000;

  private carrierService = new CarrierShippingService();

  /**
   * DYNAMIC PAYMENT METHOD RESOLVER:
   * Programmed specifically to look at the total shopping cart value in real-time.
   * If it exceeds $500, we strictly hide standard credit card fields and display bank transfer options instead.
   */
  public resolveAllowedPaymentMethods(cartTotalCents: number): PaymentMethod[] {
    // --- FINANCIAL CODES & RULES COMPLIANCE ENFORCEMENT ---

    // Rule 1: For any B2B or consumer purchase exceeding $500.00, credit cards are blocked.
    // Customers must use Stripe ACH Instant Verification (using Plaid-like direct bank login).
    // This saves 2.1% in processing fees per order and completely eliminates chargeback fraud risk!
    if (cartTotalCents >= this.highValuePaymentThresholdCents) {
      console.warn(`[Payment Routing] HIGH-VALUE CART DETECTED ($${(cartTotalCents / 100).toFixed(2)} >= $${(this.highValuePaymentThresholdCents / 100).toFixed(2)}). Strictly restricting checkout to Instant Bank Verification (Stripe ACH).`);
      return [PaymentMethod.STRIPE_ACH_FINANCIAL_CONNECTIONS];
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    // For smaller, low-risk, low-fee orders, allow standard credit card convenience
    return [PaymentMethod.STRIPE_CREDIT_CARD, PaymentMethod.STRIPE_ACH_FINANCIAL_CONNECTIONS];
  }

  /**
   * Creates a new Customer Sales Order, defaulting to PENDING_PAYMENT.
   * Strictly enforces backend payment method guards to prevent malicious API-level bypasses.
   */
  public async createOrder(orderInput: Omit<Order, 'orderId' | 'status' | 'placedAt'>): Promise<Order> {
    const orderId = uuidv4();
    const totalPrice = orderInput.totalPriceCents;

    // --- FINANCIAL CODES & RULES COMPLIANCE ENFORCEMENT ---

    // Rule 2: Backend Payment Method Guard.
    // Confirms the selected checkout payment method matches the legally resolved allowed methods.
    // Block hackers trying to bypass our frontend UI to post a $1,500 credit card transaction!
    const allowedMethods = this.resolveAllowedPaymentMethods(totalPrice);
    if (!allowedMethods.includes(orderInput.selectedPaymentMethod)) {
      console.error(`[Security Violation] REJECTED: Order total is $${(totalPrice / 100).toFixed(2)}. Selected payment method "${orderInput.selectedPaymentMethod}" is strictly prohibited for orders exceeding $500.`);
      throw new RangeError('[Payment Error] Checkout failed: Credit card payments are disabled for orders exceeding $500. Please complete checkout via Instant Bank Verification (ACH).');
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    const order: Order = {
      ...orderInput,
      orderId,
      status: OrderStatus.PENDING_PAYMENT,
      placedAt: new Date().toISOString(),
    };

    this.orders.set(orderId, order);
    console.log(`[Order Service] Created Sales Order: ${orderId} in PENDING_PAYMENT state using Payment Method: ${order.selectedPaymentMethod}`);
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

    const placedDate = new Date(order.placedAt).getTime();
    const ageInDays = (Date.now() - placedDate) / (1000 * 60 * 60 * 24);

    if (ageInDays > 30) {
      console.error(`[RMA Violation] REJECTED: Return request for Order ${orderId} exceeds the allowable 30-day window.`);
      throw new Error('[RMA Error] Return request rejected: Order is outside the allowable 30-day return window.');
    }

    const rmaId = `RMA-${uuidv4().substring(0, 8).toUpperCase()}`;
    let prePaidLabel: ShippingLabelResult | undefined = undefined;

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

    await this.transitionOrder(orderId, OrderStatus.RETURN_REQUESTED, `RMA ${rmaId} issued. Reason: ${reason}`);

    console.log(`[RMA Portal] SUCCESS: Issued RMA: ${rmaId} for SKU: ${sku}. Pre-paid Label: ${prePaidLabel ? 'ATTACHED' : 'NOT_REQUIRED'}`);

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

    if (!OrderStateMachine.isValidTransition(fromStatus, toStatus)) {
      throw new Error(`[Order Service Error] Invalid transition: Cannot transition Order ${orderId} from ${fromStatus} to ${toStatus}.`);
    }

    order.status = toStatus;
    console.log(`[Order Service] Transitioned Order ${orderId} from ${fromStatus} -> ${toStatus}. Reason: ${reason}`);

    const transition: OrderStateTransition = {
      transitionId: uuidv4(),
      orderId,
      fromStatus,
      toStatus,
      reason,
      timestamp: new Date().toISOString(),
    };
    this.transitions.push(transition);

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

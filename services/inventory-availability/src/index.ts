import { publisher } from '../../event-gateway/publisher/index';
import { v4 as uuidv4 } from 'uuid';

export interface InventoryNode {
  providerId: string;
  providerType: 'OWN_WAREHOUSE' | 'DISTRIBUTOR' | '3PL';
  rawQuantity: number;
  providerReliabilityScore: number;
}

export interface AvailabilityGraph {
  sku: string;
  totalRawQuantity: number;
  weightedConfidenceScore: number;
  nodes: InventoryNode[];
}

export interface InventoryItem {
  sku: string;
  quantityAvailable: number;
  reservedQuantity: number;
  reorderPoint: number;       // The stock level that triggers automated reordering
  reorderQuantity: number;    // The bulk amount to purchase on reorder
  sourcingType: 'DROPSHIP' | 'OWN_WAREHOUSE';
  supplierId: string;
}

export interface StockReservationResult {
  status: 'SUCCESS' | 'FAILED_OUT_OF_STOCK';
  reservationId?: string;
  sku: string;
  availableRemaining: number;
}

export class InventoryAvailabilityService {
  // In-memory inventory database (simulating Redis and PostgreSQL)
  private inventory: Map<string, InventoryItem> = new Map();
  private activeReservations: Map<string, { sku: string; qty: number; expiresAt: number }> = new Map();

  /**
   * Registers or updates an item in our catalog with its inventory thresholds.
   */
  public registerInventoryItem(item: InventoryItem): void {
    this.inventory.set(item.sku, item);
    console.log(`[Inventory Service] Registered SKU: ${item.sku}. Sourcing: ${item.sourcingType}. Stock: ${item.quantityAvailable}. ROP: ${item.reorderPoint}`);
  }

  /**
   * Builds the availability graph for a given SKU based on reported inventory nodes.
   * Provided for pricing-engine compatibility.
   */
  public buildAvailabilityGraph(sku: string, nodes: InventoryNode[]): AvailabilityGraph {
    let totalRawQuantity = 0;
    let totalWeightedScore = 0;

    for (const node of nodes) {
      totalRawQuantity += node.rawQuantity;
      totalWeightedScore += node.rawQuantity * node.providerReliabilityScore;
    }

    const weightedConfidenceScore = totalRawQuantity > 0 ? totalWeightedScore / totalRawQuantity : 0;

    return {
      sku,
      totalRawQuantity,
      weightedConfidenceScore,
      nodes,
    };
  }

  /**
   * Real-Time Stock Sync.
   * Acquires a high-concurrency real-time stock lock (reservation) during checkout.
   * Prevents any overselling by instantly blocking requests if stock is fully committed.
   */
  public async reserveRealTimeStock(sku: string, quantityToReserve: number): Promise<StockReservationResult> {
    console.log(`[Inventory Sync] Real-time reservation request for SKU: ${sku}. Qty: ${quantityToReserve}`);

    const item = this.inventory.get(sku);
    if (!item) {
      console.warn(`[Inventory Warning] Reservation failed: SKU ${sku} does not exist in catalog.`);
      return { status: 'FAILED_OUT_OF_STOCK', sku, availableRemaining: 0 };
    }

    // Clean up any expired reservations first to release stock back to pool
    this.cleanupExpiredReservations();

    const actualAvailable = item.quantityAvailable - item.reservedQuantity;

    // --- CODES AND RULES COMPLIANCE ENFORCEMENT ---

    // Rule 1: Prevent Overselling
    if (actualAvailable < quantityToReserve) {
      console.error(`[Inventory Collision] REJECTED: Insufficient stock for high-demand SKU: ${sku}. Available: ${actualAvailable}, Requested: ${quantityToReserve}`);
      return { status: 'FAILED_OUT_OF_STOCK', sku, availableRemaining: actualAvailable };
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    // Create the temporary 10-minute reservation
    const reservationId = `res_${uuidv4().substring(0, 8)}`;
    item.reservedQuantity += quantityToReserve;

    this.activeReservations.set(reservationId, {
      sku,
      qty: quantityToReserve,
      expiresAt: Date.now() + 600000, // 10 minutes from now
    });

    console.log(`[Inventory Sync] SUCCESS: Reserved ${quantityToReserve} of ${sku}. Reservation ID: ${reservationId}. Remaining: ${item.quantityAvailable - item.reservedQuantity}`);

    return {
      status: 'SUCCESS',
      reservationId,
      sku,
      availableRemaining: item.quantityAvailable - item.reservedQuantity,
    };
  }

  /**
   * Finalizes a checkout reservation, permanently subtracting the physical inventory.
   * Also evaluates if we need to trigger an automated B2B reorder for self-owned inventory.
   */
  public async commitStockReservation(reservationId: string): Promise<void> {
    const reservation = this.activeReservations.get(reservationId);
    if (!reservation) {
      throw new Error(`[Inventory Error] Commit failed: Active reservation ${reservationId} not found or expired.`);
    }

    const item = this.inventory.get(reservation.sku)!;
    
    // Permanently deduct stock
    item.quantityAvailable -= reservation.qty;
    item.reservedQuantity -= reservation.qty;

    this.activeReservations.delete(reservationId);
    console.log(`[Inventory Sync] COMMITTED: Deducted ${reservation.qty} units from SKU ${reservation.sku}. Permanent Stock: ${item.quantityAvailable}`);

    // Trigger automated low-stock reorder checks
    await this.evaluateStockReorder(item.sku);
  }

  /**
   * Evaluates if we need to issue an automated bulk B2B Purchase Order.
   * STRICT RULE: Only triggers for self-owned inventory (OWN_WAREHOUSE), never for dropshipping!
   */
  public async evaluateStockReorder(sku: string): Promise<{ reordered: boolean; purchaseOrderId?: string }> {
    const item = this.inventory.get(sku)!;

    console.log(`[Inventory Reorder] Evaluating thresholds for SKU: ${sku}. Current Stock: ${item.quantityAvailable}`);

    // --- CODES AND RULES COMPLIANCE ENFORCEMENT ---

    // Rule 1: Automated reordering is restricted to self-owned inventory (OWN_WAREHOUSE) only!
    // Dropshipping items are purchased on-demand upon customer checkout, never pre-ordered in bulk.
    if (item.sourcingType === 'DROPSHIP') {
      console.log(`  - Sourcing is DROPSHIP. Skipping bulk reorder evaluation.`);
      return { reordered: false };
    }

    // Rule 2: Trigger reorder only when stock levels drop below the set Reorder Point (ROP)
    if (item.quantityAvailable <= item.reorderPoint) {
      const purchaseOrderId = `PO-REPL-${uuidv4().substring(0, 8).toUpperCase()}`;
      
      console.log(`\n[Inventory Reorder] 🚨 LOW STOCK TRIGGERED for SKU: ${sku}!`);
      console.log(`  - Stock Level (${item.quantityAvailable}) is at or below ROP (${item.reorderPoint}).`);
      console.log(`  - Action: Initiating automated bulk B2B Purchase Order to Supplier: ${item.supplierId} for Qty: ${item.reorderQuantity}`);

      // Publish the automated reorder event to ECOS Procurement
      await publisher.publish(
        'procurement',
        'purchase_order.created',
        {
          purchaseOrderId,
          orderId: uuidv4(), // Generated correlation ID representing the internal replenishment run
          providerId: item.supplierId,
          totalWholesaleCostCents: 150000, // Bulk purchase cost
          status: 'CREATED',
          createdAt: new Date().toISOString(),
          items: [{ sku, quantity: item.reorderQuantity }],
          notes: 'ECOS Automated Replenishment Run',
        }
      );

      // Simulate receiving the shipment and updating stock back to full
      item.quantityAvailable += item.reorderQuantity;
      console.log(`  - [Simulated Replenishment] Received bulk shipment. Stock of ${sku} restored to: ${item.quantityAvailable}\n`);

      return { reordered: true, purchaseOrderId };
    }

    // --- END COMPLIANCE ENFORCEMENT ---

    console.log(`  - Stock is safe. (Level: ${item.quantityAvailable} > ROP: ${item.reorderPoint})`);
    return { reordered: false };
  }

  /**
   * Cleans up expired 10-minute checkout reservations, returning reserved stock back to the available pool.
   */
  private cleanupExpiredReservations(): void {
    const now = Date.now();
    for (const [resId, res] of this.activeReservations.entries()) {
      if (now > res.expiresAt) {
        const item = this.inventory.get(res.sku)!;
        item.reservedQuantity -= res.qty;
        this.activeReservations.delete(resId);
        console.warn(`[Inventory Sync] RELEASED: Reservation ${resId} expired. Released ${res.qty} units of ${res.sku} back to available pool.`);
      }
    }
  }

  public getInventoryItem(sku: string): InventoryItem | undefined {
    return this.inventory.get(sku);
  }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InventoryAvailabilityService, InventoryItem } from '../src/index';

test('Real-Time Stock Sync successfully reserves inventory for checkout', async () => {
  const service = new InventoryAvailabilityService();
  
  const item: InventoryItem = {
    sku: 'MONITOR-WADE-4K',
    quantityAvailable: 10,
    reservedQuantity: 0,
    reorderPoint: 2,
    reorderQuantity: 20,
    sourcingType: 'DROPSHIP',
    supplierId: 'DISTRIBUTOR_A',
  };
  service.registerInventoryItem(item);

  // Attempt to reserve 3 units
  const result = await service.reserveRealTimeStock('MONITOR-WADE-4K', 3);

  assert.equal(result.status, 'SUCCESS');
  assert.equal(result.availableRemaining, 7, 'Remaining available stock must exclude reserved stock');
  
  const savedItem = service.getInventoryItem('MONITOR-WADE-4K')!;
  assert.equal(savedItem.reservedQuantity, 3, 'Reserved quantity must be incremented in database');
});

test('Real-Time Stock Sync strictly blocks checkout to prevent overselling', async () => {
  const service = new InventoryAvailabilityService();

  const item: InventoryItem = {
    sku: 'GPU-RTX-5090',
    quantityAvailable: 2, // Only 2 units physically exist
    reservedQuantity: 0,
    reorderPoint: 1,
    reorderQuantity: 5,
    sourcingType: 'DROPSHIP',
    supplierId: 'DISTRIBUTOR_A',
  };
  service.registerInventoryItem(item);

  // Attempt to reserve 3 units (exceeds our available stock of 2!)
  const result = await service.reserveRealTimeStock('GPU-RTX-5090', 3);

  assert.equal(result.status, 'FAILED_OUT_OF_STOCK', 'Should reject reservation to prevent overselling');
  assert.equal(result.availableRemaining, 2, 'Available remaining must reflect the correct inventory count');
});

test('Automated Reordering triggers bulk B2B Purchase Orders for self-owned inventory', async () => {
  const service = new InventoryAvailabilityService();

  // Self-owned inventory (e.g. Letter Paper we stock in our physical warehouse)
  const item: InventoryItem = {
    sku: 'CONS-PAPER-LTR',
    quantityAvailable: 25, // Starts at 25
    reservedQuantity: 0,
    reorderPoint: 20,       // Trigger reorder if stock drops to or below 20
    reorderQuantity: 100,   // Order 100 units in bulk
    sourcingType: 'OWN_WAREHOUSE', // SELF-OWNED STOCK
    supplierId: 'STAPLES_WHOLESALE',
  };
  service.registerInventoryItem(item);

  // 1. Reserve 6 units
  const reservation = await service.reserveRealTimeStock('CONS-PAPER-LTR', 6);
  assert.equal(reservation.status, 'SUCCESS');

  // 2. Commit the reservation (Stock drops from 25 to 19, which is <= ROP of 20)
  const reorderResult = await service.commitStockReservation(reservation.reservationId!);

  const updatedItem = service.getInventoryItem('CONS-PAPER-LTR')!;
  // Verify that the low stock triggered the bulk B2B reorder, restoring stock (19 + 100 = 119)
  assert.equal(updatedItem.quantityAvailable, 119, 'Bulk reorder must successfully replenish stock back to warehouse');
});

test('Automated Reordering is strictly disabled for dropshipped items', async () => {
  const service = new InventoryAvailabilityService();

  // Dropshipped tech items (we never buy these in advance or stock them)
  const item: InventoryItem = {
    sku: 'LAPTOP-WADE-01',
    quantityAvailable: 2,
    reservedQuantity: 0,
    reorderPoint: 1,
    reorderQuantity: 10,
    sourcingType: 'DROPSHIP', // DROPSHIP ONLY
    supplierId: 'DISTRIBUTOR_A',
  };
  service.registerInventoryItem(item);

  // Commit stock, dropping available units to 0 (which is <= ROP of 1)
  const reservation = await service.reserveRealTimeStock('LAPTOP-WADE-01', 2);
  assert.equal(reservation.status, 'SUCCESS');

  // Verify that the commit DOES NOT trigger a bulk reorder, as it is a dropship SKU
  await service.commitStockReservation(reservation.reservationId!);

  const updatedItem = service.getInventoryItem('LAPTOP-WADE-01')!;
  assert.equal(updatedItem.quantityAvailable, 0, 'Dropshipped items must never trigger bulk warehouse replenishment');
});

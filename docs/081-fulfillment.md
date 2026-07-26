# Fulfillment & Inventory

## 1. Domain Definition

The Fulfillment & Inventory domain is responsible for the physical logistics of storing, preparing, and shipping products to customers. It is the bridge between a digital order and a physical package arriving at a customer's door.

- **Bounded Context:** This domain's context begins when it receives an `order.placed` event. It is responsible for inventory management (tracking stock levels in physical locations), orchestrating the pick-pack-ship process in our own warehouses, and sending fulfillment requests to dropship suppliers. It owns the concept of a `Shipment`. Its responsibility for a given order fulfillment ends when it publishes a `fulfillment.group.shipped` event containing a tracking number.
- **Core Services:**
    - **Inventory Service:** The source of truth for `inventory_on_hand` for every SKU at every physical location (our warehouses).
    - **Fulfillment Router Service:** Consumes `order.placed` events and decides the optimal fulfillment source for each line item based on stock levels, shipping costs, and supplier scorecards.
    - **Warehouse Management Service (WMS):** Provides the tools and workflows for internal warehouse operations, including generating pick lists and printing shipping labels.
    - **Carrier Integration Service:** A set of adapters for interfacing with shipping carriers (e.g., FedEx, UPS) to get rates and create shipments.

## 2. Key Performance Indicators (KPIs)

- **Time to Ship:** Average time from `order.placed` to `fulfillment.group.shipped`.
- **Picking Accuracy:** Percentage of items picked from the warehouse that match the order exactly.
- **Shipping Cost Accuracy:** The variance between estimated shipping cost at checkout and the actual cost paid to the carrier.
- **Inventory Turnover:** The rate at which inventory is sold and replenished over a period.
- **Stockout Rate:** Percentage of customer orders that cannot be fulfilled from the desired warehouse due to zero inventory.

## 3. Data Model

The data model focuses on physical locations, stock levels, and the shipment process.

### Core Tables

- **`warehouses`**: A record of our own physical fulfillment centers.
  - `warehouse_id` (PK), `name`, `address` (JSONB), `capabilities` (e.g., `HAZMAT_CERTIFIED`, `BATTERY_HANDLING`).
- **`inventory_items`**: The master record of our physical stock. This is the source of truth for `on_hand` counts.
  - `inventory_item_id` (PK), `sku`, `warehouse_id` (FK), `quantity_on_hand`, `location_in_warehouse` (e.g., Aisle 5, Shelf B2), `last_recounted_at`.
- **`inventory_ledgers`**: An immutable, append-only log of all changes to inventory levels. This is critical for auditing.
  - `ledger_id` (PK), `inventory_item_id` (FK), `change_quantity` (integer, can be negative), `new_quantity`, `reason` (e.g., `SALE`, `RECEIPT_FROM_SUPPLIER`, `CYCLE_COUNT_ADJUSTMENT`), `source_reference_id` (e.g., order_id, supplier_po_id), `timestamp`.
- **`shipments`**: A record of a physical shipment to a customer. Corresponds to a `fulfillment_group` in the Orders domain.
  - `shipment_id` (PK), `fulfillment_group_id` (from Orders domain), `warehouse_id` (FK), `carrier`, `tracking_number`, `shipping_label_url`, `actual_shipping_cost_cents`, `status` (PENDING_PICK, PENDING_PACK, SHIPPED), `created_at`, `shipped_at`.
- **`picking_batches`**: A group of shipments to be picked by a warehouse operator in a single run.
  - `batch_id` (PK), `warehouse_id` (FK), `assigned_operator_id`, `status` (OPEN, IN_PROGRESS, COMPLETED).

## 4. Core Workflows

### Order Fulfillment Routing
1.  The **Fulfillment Router** consumes an `order.placed` event.
2.  For each `order_line_item`, it checks for available inventory in our own `warehouses`.
3.  It also fetches viable dropship `supplier_offers` from the Supplier Intelligence domain.
4.  It calculates the total cost (shipping + fulfillment) for each possible fulfillment option.
5.  It creates one or more `fulfillment_groups` in the Orders domain, assigning each line item to the optimal source. If an order is split, it might create one group for `WAREHOUSE` and another for `SUPPLIER`.

### Warehouse Pick, Pack, Ship
1.  A new `fulfillment_group` assigned to a warehouse triggers the creation of a `shipment` record.
2.  The `shipment` is added to a `picking_batch`.
3.  A warehouse operator gets the batch, picks the items, and marks the batch as picked.
4.  The packer gets the items, packs them into a box, weighs it, and uses the **Carrier Integration Service** to generate a shipping label.
5.  The `shipment` status is updated to `SHIPPED`, and a `fulfillment.group.shipped` event is published.

## 5. API Contracts (Conceptual)

This domain's APIs are mostly internal, used by other services or internal applications.
- `POST /v1/inventory/adjustments`: For manually adjusting stock levels after a cycle count.
- `GET /v1/inventory/{sku}`: Get on-hand inventory levels for a SKU across all warehouses.
- `POST /v1/shipments`: Internal endpoint to create a shipment from a fulfillment group.
- `GET /v1/picking-batches`: Endpoint for the WMS app to get open picking batches.

## 6. Key Events

### Consumed
- `order.placed`

### Published
- **`fulfillment.group.shipped`**: Signals that a portion of an order has been shipped. This is consumed by the Orders domain to update its state.
  - **Payload**: `order_id`, `fulfillment_group_id`, `carrier`, `tracking_number`, `shipped_at`.
- **`inventory.stock-level.changed`**: The primary event for this domain. It is published whenever the `quantity_on_hand` for a SKU changes. This is a critical signal for the Pricing domain and storefront to know what's available to sell.
  - **Payload**: `sku`, `warehouse_id`, `new_quantity`, `previous_quantity`.
- **`inventory.stock.low`**: A warning event fired when a SKU's inventory drops below a configured threshold.
  - **Payload**: `sku`, `warehouse_id`, `current_quantity`, `threshold`.

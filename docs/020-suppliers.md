# Supplier Intelligence

## 1. Domain Definition

The Supplier Intelligence domain is responsible for the entire lifecycle of a supplier relationship. It is the single source of truth for who our suppliers are, what products they offer, and how well they perform.

- **Bounded Context:** This domain's responsibilities include supplier onboarding, data ingestion (offers, pricing, inventory levels), performance monitoring, and generating a holistic supplier score. It provides a clean, normalized feed of `supplier_offers` to the rest of the ECOS. It does not decide which supplier to use for an order; it only provides the data for the Decision Engine to make that choice.
- **Core Services:**
    - **Supplier Onboarding Service:** Manages the process of registering and vetting new suppliers.
    - **Data Ingestion Service:** A set of workers and adapters for ingesting data from supplier APIs, CSV feeds, or EDI connections.
    - **Performance Monitoring Service:** Consumes events from other domains (e.g., `orders.shipped`, `returns.created`) to calculate supplier performance metrics.
    - **Supplier API:** Exposes the unified view of suppliers, offers, and performance scorecards.

## 2. Key Performance Indicators (KPIs)

- **Supplier Fill Rate:** Percentage of ordered items that were successfully fulfilled by the supplier without cancellation.
- **On-Time Shipment Rate:** Percentage of orders shipped within the supplier's stated lead time.
- **Inventory Accuracy:** Correlation between a supplier's reported inventory levels and their actual ability to fulfill orders.
- **Data Freshness:** The average age of supplier offer data (pricing and inventory).
- **Supplier Scorecard Distribution:** The number of suppliers in each tier (e.g., Tier 1, Tier 2, Tier 3).

## 3. Data Model

The data model for this domain centers around the supplier, their offers, and their ongoing performance.

### Core Tables

- **`suppliers`**: The master record for a supplier or distributor.
  - `supplier_id` (PK), `name`, `account_status` (PENDING_REVIEW, ACTIVE, DEACTIVATED), `onboarding_data` (JSONB, e.g., contact info, tax forms), `tier_level` (1, 2, 3).
- **`supplier_offers`**: A normalized record of a product being offered by a supplier.
  - `offer_id` (PK), `supplier_id` (FK), `sku` (FK to `products.sku`), `wholesale_cost_cents`, `dropship_fee_cents`, `shipping_cost_cents`, `inventory_quantity`, `map_price_cents`, `warranty_source`, `last_verified_at`.
- **`supplier_performance`**: A time-series table tracking quantitative performance metrics.
  - `performance_id` (PK), `supplier_id` (FK), `date`, `fulfilled_orders`, `late_orders`, `cancellations`, `returns`, `defect_rate`.
- **`supplier_scorecards`**: A rolling summary of a supplier's holistic score.
  - `scorecard_id` (PK), `supplier_id` (FK), `calculation_date`, `overall_score`, `financial_stability_score`, `fulfillment_speed_score`, `cancellation_rate_score`, `inventory_accuracy_score`, `invoice_accuracy_score`, `map_compliance_score`, etc.

## 4. Supplier Scorecard

The Supplier Scorecard is a composite metric that drives the `supplier_score` used by the Pricing domain and Decision Engine. It is calculated periodically by the Performance Monitoring Service.

| Score Component           | Data Source(s)                                                                  | Weight |
| ------------------------- | ------------------------------------------------------------------------------- | ------ |
| **Profitability**         | `supplier_offers.wholesale_cost_cents`, `pricing_decisions.expected_profit`     | 20%    |
| **Reliability**           | `supplier_performance` (cancellation rate, defect rate, invoice accuracy)         | 35%    |
| **Fulfillment Speed**     | `orders.shipped` timestamp vs `orders.placed` timestamp                         | 20%    |
| **Inventory Confidence**  | Correlation between `supplier_offers.inventory_quantity` and `cancellations`      | 15%    |
| **Warranty & Support**    | `warranty_claims.status`, `returns.reason_code`                                 | 10%    |

## 5. API Contracts (Conceptual)

- `GET /v1/suppliers`: List all suppliers and their overall scores.
- `POST /v1/suppliers`: Begin the supplier onboarding process.
- `GET /v1/suppliers/{id}`: Get a detailed supplier profile, including their full scorecard.
- `GET /v1/offers`: Query for all offers for a given SKU across all suppliers. (`GET /v1/offers?sku=SKU123`)
- `POST /v1/ingestion/feeds`: Endpoint for the Data Ingestion Service to push normalized data into the `supplier_offers` table.

## 6. Key Events Published

- **`supplier.registered`**: A new supplier has entered the onboarding pipeline.
  - **Payload**: `supplier_id`, `name`.
- **`supplier.activated`**: A supplier has been fully vetted and is now active.
  - **Payload**: `supplier_id`, `tier_level`.
- **`supplier.offer.updated`**: New pricing or inventory data for an offer has been ingested. This is a high-volume event.
  - **Payload**: `offer_id`, `supplier_id`, `sku`, `wholesale_cost_cents`, `inventory_quantity`.
- **`supplier.scorecard.changed`**: A supplier's overall score or a component score has changed significantly.
  - **Payload**: `supplier_id`, `overall_score`, `previous_score`.
- **`supplier.performance.degraded`**: A supplier's performance on a key metric (e.g., cancellation rate) has dropped below a critical threshold.
  - **Payload**: `supplier_id`, `metric`, `value`, `threshold`.

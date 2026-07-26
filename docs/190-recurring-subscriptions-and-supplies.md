# B2B Recurring Subscriptions & Office Supplies Specification

## 1. The B2B Consumables Model (Recurring Revenue)

To diversify cash flow, capture predictable monthly revenue, and lock in long-term B2B corporate accounts, ECOS integrates a native **Subscription & Consumables Engine**. 

Corporate customers can purchase technology hardware (laptops, printers, networks) and subscribe to automated, recurring deliveries of office consumables (ink, toner, paper, stationery). This matches their recurring monthly operational needs and maximizes Customer Lifetime Value (LTV).

```text
                        AUTOMATED SUBSCRIPTION ENGINE
                                      │
                                      ▼
                          Recurring Billing Trigger
                                      │
                                      ▼ (Service: subscription-billing-worker)
                            Stripe Billing API
                                      │
                                      ▼ (Payment Captured)
                         Event: orders.order.placed
                                      │
                                      ▼ (Reuses Hardened ECOS Spine)
       ┌──────────────────────────────┼──────────────────────────────┐
       ▼                              ▼                              ▼
  Tax Compliance                 Procurement                    Accounting
  Calculates Tax              Autogenerates B2B             Balanced Ledgering
  & Reserves cash             Distributor PO via             (Revenue vs COGS)
                               Stripe Virtual Card
```

---

## 2. Subscription Engine Data Model

To manage recurring schedules, billing frequencies, and customer preferences, we define a dedicated schema for the Subscription Engine:

-   **`subscriptions`**: Tracks active recurring customer contracts.
  - `subscription_id` (PK), `customer_id` (FK), `status` (ACTIVE, PAUSED, CANCELLED, PAST_DUE), `billing_interval` (WEEKLY, MONTHLY, QUARTERLY), `next_billing_date` (TIMESTAMPTZ), `shipping_address` (JSONB), `billing_address` (JSONB), `created_at`, `updated_at`.
-   **`subscription_items`**: The individual SKUs and quantities tied to a subscription.
  - `subscription_item_id` (PK), `subscription_id` (FK), `sku` (FK to `products.sku`), `quantity`.
-   **`subscription_billing_logs`**: An auditable history of recurring billing attempts.
  - `billing_log_id` (PK), `subscription_id` (FK), `stripe_invoice_id`, `amount_cents`, `status` (SUCCESS, FAILED), `error_message`, `timestamp`.

---

## 3. The Automated Subscription Worker Lifecycle

The `subscription-billing-worker` is a scheduled background process (cron) that automates the subscription lifecycle:

1.  **Schedule Evaluation:** The worker runs periodically (e.g., daily at 00:00 UTC) and queries the database for all `subscriptions` where `next_billing_date <= now()` and `status = 'ACTIVE'`.
2.  **Stripe Billing Trigger:** For each due subscription, the worker calls the Stripe Billing/Invoices API to charge the customer's saved payment method.
3.  **Automated Order Injection:**
    -   **If payment fails:** The subscription status transitions to `PAST_DUE`, and a retry/notification event is published.
    -   **If payment succeeds:** The worker logs the success, calculates the next billing date based on the interval, and **publishes a standard `orders.order.placed` event to the Event Bus**.
4.  **Zero-Overhead Processing:** Because `order.placed` is emitted, **the recurring order automatically utilizes 100% of our existing ECOS operational core**:
    -   *Tax Compliance* isolates the sales tax in the reserve account.
    -   *Procurement* issues a PO to our office-supply distributor (via a single-use Stripe virtual card).
    -   *Accounting* ledgers the sales revenue and COGS.
    -   *Fulfillment* routes the shipment to the distributor warehouse for direct B2B customer delivery.

---

## 4. Bulk Sourcing & Pricing Optimization

Office consumables have different pricing dynamics compared to high-end electronics:
-   **Category Elasticity:** Paper and ink have lower price points and high volume, making them perfect for bulk discount tiers (e.g., "Save 10% when ordering 10+ boxes").
-   **Supplier Sourcing:** ECOS integrates with specialized office-supply distributors. The Sourcing & Pricing Optimizer (defined in `docs/030-pricing.md`) automatically maps paper and ink SKUs to these distributors, calculating the optimal floor prices and bulk margins autonomously.

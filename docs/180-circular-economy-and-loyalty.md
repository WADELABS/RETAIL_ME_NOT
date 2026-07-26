# Circular Tech Lifecycle, Loyalty, & Affiliate Specification

## 1. The Circular Tech Economy ("Waste Not, Want Not")

ECOS is designed to control the entire lifecycle of consumer electronics. This closed-loop system, known as reverse commerce or circular retail, maximizes profitability by enabling customer trade-ins, automated grading, refurbishment, and second-hand marketplace re-sale.

```text
                          CUSTOMER TECH LIFECYCLE
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
    1st-HAND SALE                TRADE-IN                    RE-LISTING
  (ECOS Storefront)       (Ingestion & Grading)         (2nd-Hand Sale)
         │                           │                           │
         ▼                           ▼                           ▼
    Customer Pays             Customer Gets ECOS              ECOS Sells
     Retail Price             Credit / Points ($)           Refurbished SKU
         │                           │                           │
         ▼                           ▼                           ▼
   Gross Margin Bps            Physical Product            Highly Lucrative
       (6-15%)                Vetted & Refurbished         Gross Margin Bps
                                     │                         (40-60%)
                                     ▼
                          Graded: USED | REFURBISHED
```

### 1.1. Ingestion & Dynamic Grading Integration
Instead of building a separate system, ECOS reuses the exact same **Reverse Logistics and Returns** infrastructure (defined in `docs/082-returns.md`) to ingest customer trade-ins:
1.  **Trade-in Request:** A customer requests a trade-in quote for their old GPU or laptop. ECOS calculates a guaranteed trade-in value based on historical market depreciation.
2.  **RMA Issued:** ECOS issues a specialized Trade-in RMA and generates a shipping label.
3.  **Inspection and Grading:** When the item arrives, warehouse operators inspect the device and assign a strict grade:
    -   `SEALED` (Brand new, unopened)
    -   `OPEN_BOX` (Like new, original packaging opened)
    -   `USED` (Fully functional, visible cosmetic wear)
    -   `REFURBISHED` (Repaired, re-padded/pasted, fully functional)
    -   `DAMAGED` (Unsellable, queued for raw parts harvesting or certified recycling)
4.  **Instant Credit:** Upon grading completion, ECOS instantly issues the credit as ECOS Loyalty Points, which are immediately spendable.
5.  **Autonomous Re-Listing:** The PIM service updates the SKU condition, the Pricing engine recommends an optimized second-hand price, and the product is automatically re-published to the storefront as a high-margin "Refurbished" item.

---

## 2. The ECOS Loyalty Points Engine (Deferred Liability)

Loyalty points represent a deferred financial obligation. In alignment with our "Enterprise Before Convenience" principle, points are tracked strictly in our double-entry General Ledger:

-   **Earned Points (Debit Card/Purchase):** When a customer earns points (e.g., 5% back on purchases), the Accounting Service automatically posts:
    -   **DEBIT:** `Marketing Expense` (5050)
    -   **CREDIT:** `Loyalty Points Liability` (2040)
-   **Redeemed Points (Checkout):** When a customer redeems points at checkout (e.g., spending $10.00 in points), points act as a payment method:
    -   **DEBIT:** `Loyalty Points Liability` (2040) (Reducing our liabilities)
    -   **CREDIT:** `Sales Revenue` (4010) (Accruing the retail sale)

---

## 3. The Affiliate & Referral Attribution Engine

ECOS leverages its real-time telemetry event bus to attribute organic referral traffic and automate creator payouts:

```text
                           REFERRAL ATTRIBUTION
                                     │
                                     ▼
                         Affiliate Link Clicked
                                     │
                                     ▼ (Event: telemetry.referral.clicked)
                         Customer Places Order
                                     │
                                     ▼ (Event: orders.order.placed)
                            Payment Completed
                                     │
                                     ▼
                            Accounting Ledger
                     DEBIT: Marketing Expense (5050)
                     CREDIT: Accounts Payable - Affiliates (2050)
```

1.  **Tracking:** When a visitor arrives via an affiliate link (e.g., `https://retailmenot.com/product/sku?ref=creator123`), the storefront emits a `telemetry.referral.clicked` event containing the unique referrer ID.
2.  **Attribution:** The session state links the referrer ID to the active cart.
3.  **Settlement:** When the order is placed, ECOS's Accounting Service automatically calculates the creator's commission (e.g., 5% of product revenue) and posts a balanced journal entry:
    -   **DEBIT:** `Marketing Expense (5050)` (Recording the customer acquisition cost)
    -   **CREDIT:** `Accounts Payable - Affiliates (2050)` (Recording the liability owed to the creator)
4.  **Auto-Payout:** Every month, the Treasury Service processes the accumulated accounts payable to the creators automatically using Stripe Payouts.

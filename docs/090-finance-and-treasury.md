# ECOS Financial, Treasury, & Cloudflare Security Specification

## 1. The Stripe-Consolidated Treasury Model

ECOS is designed to operate with zero operational drag, minimal transaction latency, and low overhead. To achieve this, we consolidate our merchant acquiring, banking, and B2B payout infrastructure entirely within the **Stripe Ecosystem** (using Stripe Treasury and Stripe Issuing). This eliminates the need for separate external bank accounts (like Mercury) and streamlines the entire flow of cash.

```text
       CUSTOMER CHECKOUT (Storefront)
                    │
                    ▼ (Cloudflare Edge Filtered)
         Stripe Payment Gateway
                    │
                    ▼ (Immediate Settlement)
          Stripe Treasury Balance (Operating Cash)
                    │
         ┌──────────┴──────────┐
         ▼ (Instant Transfer)  ▼ (Instant Programmatic Virtual Card)
    Stripe Tax Reserve     Stripe Issuing Card (Distributor PO)
    (Untouchable Asset)    (Pays Distributor Wholesale Cost)
                               │
                               ▼
                        Fulfillment Initiated
```

### 1.1. Stripe Treasury (Banking & Reserve Balances)
Instead of a traditional commercial bank account, ECOS provisions a primary **Stripe Financial Account**. This account acts as our operating cash ledger. We create secondary, isolated sub-balances (reserves) within Stripe Treasury:
-   **Operating Account:** Receives net sales revenue after credit card fees. Used to fund distributor procurement and daily operations.
-   **Sales Tax Reserve:** Receives sales tax collections automatically. This balance is legally restricted and untouched for operations.
-   **Fulfillment & Returns Reserve:** Receives the return/fraud/warranty reserves deducted from every transaction.

### 1.2. Stripe Issuing (Automated Distributor Payments)
To fund B2B distributor Purchase Orders automatically, ECOS utilizes **Stripe Issuing** to programmatically generate virtual debit cards:
1.  **Fulfillment Approved:** The ECOS Decision Engine approves a procurement request.
2.  **Generate Virtual Card:** ECOS calls the Stripe Issuing API to create a single-use virtual debit card.
3.  **Strict Limits:** The card is locked with a maximum spend limit equal to the exact wholesale cost of the Purchase Order (e.g., $1,050.00) and is restricted to the specific distributor's merchant category code.
4.  **Authorization:** The distributor charges the card, the payment is authorized instantly from our Stripe Treasury Operating Balance, and the PO status transitions to `PAID/ACCEPTED`.

### 1.3. Backup Processor Support
To protect the platform against unexpected payment gateway outages or account freezes, ECOS supports a **Secondary Payment Processor** (e.g., Adyen or Braintree) as a failover. During a failover event:
- Checkout traffic is routed to the backup processor.
- Settled funds from the backup processor are routed via ACH/wire directly into our **Stripe Treasury Financial Account Routing Numbers**, maintaining our unified balance and automated ledgering.

---

## 2. Cloudflare Edge Security & DNS

Every customer-facing checkout API and distributor-facing adapter endpoint is shielded by **Cloudflare**:
-   **WAF (Web Application Firewall):** Blocks malicious bots, DDoS attacks, and unauthorized SQL injection attempts before they ever reach our ECOS servers.
-   **Cloudflare Tunnels (Argo):** ECOS microservices run securely inside private networks without exposing any public ports. They establish secure, outbound-only connections to Cloudflare, making direct port attacks impossible.
-   **SSL/TLS & DNS:** Enforces strict, zero-trust HTTPS transport for all ECOS API communication.

---

## 3. The ECOS Profit-Split Engine

For every completed sales transaction, ECOS calculates the net earnings and automatically ledger-splits them into distinct allocation buckets.

### 3.1. Net Earnings Calculation
`Net Earnings = Retail Sales Price - Wholesale Cost - Payment Fees - Sales Tax - Reserves`

**Example:**
-   Customer Retail Sales Price: `$1,299.00`
-   Sales Tax collected (e.g., 8%): `$103.92` (Directly moved to *Sales Tax Reserve*)
-   Gross Payment Charged: `$1,402.92`
-   Stripe Processing Fee (2.9% + 30c): `$40.98`
-   Distributor Wholesale Cost: `$950.00` (Funded via *Stripe Issuing Card*)
-   ECOS Operational Reserves (Fraud 2%, Return 5%): `$90.93` (Moved to *Fulfillment Reserve*)
-   **Net Earnings (ECOS Profit):** `$1,299.00 - $950.00 - $40.98 - $90.93` = **`$217.09`**

### 3.2. Automated Allocation Splits
The ECOS Profit-Split Engine automatically divides the remaining **Net Earnings ($217.09)** based on configurable percentage splits:

1.  **Owner Payout / Commission (e.g., 50% = $108.54):** Transferred automatically to your personal payout account as your commission.
2.  **Platform Reinvestment (e.g., 30% = $65.13):** Kept in the Operating Account to fund future product purchasing and scaling.
3.  **Marketing & Operational Budget (e.g., 20% = $43.42):** Moved to a dedicated marketing sub-balance to fund ad campaigns and growth telemetry.

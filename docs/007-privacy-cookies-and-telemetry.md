# Privacy, Cookies, & Telemetry Specification

## 1. Privacy-by-Design & Legal Compliance

ECOS is designed with strict adherence to global privacy regulations (including GDPR, CCPA/CPRA, and US state-level privacy acts). We reject the dark patterns employed by legacy retailers. We establish complete transparency: every customer must know exactly what we collect, how we use it, and have full, autonomous control over their personal data.

```text
                        ECOS TELEMETRY CONSENT GATE
                                     │
                                     ▼
                          First-Time Visitor Session
                                     │
                                     ▼
                          Consent Banner (Zero-Dark)
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼ (Auto-Enabled)            ▼ (Requires Opt-In)         ▼ (Requires Opt-In)
   ESSENTIAL COOKIES            ANALYTICAL COOKIES          MARKETING COOKIES
   - Session & Security         - Search Telemetry          - Affiliate Referrals
   - Cart Persistence           - Product Views             - Sponsored Ad Clicks
   - Secure Checkout            - Demand Velocity Scores    - Target Retargeting
```

---

## 2. Cookies & Consent Management

Cookies are strictly classified into three tiers, and our frontend consent manager enforces these boundaries dynamically:

### 2.1. Essential / Functional Cookies (Strictly Necessary)
-   **Description:** Required for the core ECOS transaction loop and platform security.
-   **Data Stored:** Session ID, active cart ID, CSRF security tokens, and Stripe/payment gateway identifiers.
-   **Opt-out:** Cannot be disabled, as they are mandatory for checkout operations. This is fully disclosed in our cookie policy.

### 2.2. Analytical / Telemetry Cookies
-   **Description:** Used to measure site traffic, search behavior, and product interest.
-   **Data Stored:** Anonymous session identifiers, scroll depth, search queries, and product page hovers.
-   **Compliance:** Disabled by default for EU/GDPR visitors until explicit, active opt-in consent is given. Accessible via opt-out for US/CCPA visitors.

### 2.3. Marketing & Advertising Cookies
-   **Description:** Used to attribute marketing campaigns and reward affiliate creators.
-   **Data Stored:** Campaign click IDs, publisher/creator affiliate codes, and product referral links.
-   **Compliance:** Strictly require active opt-in consent before any third-party tracking pixels or cookies are initialized.

---

## 3. Telemetry: What We Collect & How We Use It

Every telemetry event captured by our frontend is formatted as a structured event and published to our event bus (`telemetry.*`).

### 3.1. What We Collect
-   **Search Telemetry (`telemetry.search.performed`):** Captures the search query, timestamp, and SKUs returned in the results.
-   **Cart Telemetry (`telemetry.cart.item_added`):** Captures the SKU, quantity, unit price, and timestamp.
-   **Interaction Telemetry (`telemetry.product.viewed`):** Captures the SKU, session duration, and scroll depth on product specification sheets.
-   **Security Telemetry (`telemetry.security.fingerprint`):** Captures browser user-agents, screen resolution, and IP range data used exclusively by the Risk Engine to prevent account takeovers and credit card fraud.

### 3.2. How We Use It
-   **Dynamic Surcharging (Demand Telemetry):** We aggregate hourly search and cart-add volumes per SKU. If a sudden surge is detected, ECOS automatically applies a short-term margin surcharge to capture peak-demand profits in real-time.
-   **Supply Chain Planning:** Telemetry data is exported to the **Demand Forecasting** service to predict which SKUs are gaining traction, allowing ECOS to proactively reserve inventory with distributors or purchase wholesale stock internally before stockouts occur.
-   **Loss Prevention:** Behavioral velocity (e.g., adding 50 items to a cart in 2 seconds) is processed by the Risk Engine to instantly flag and block malicious bot checkout attempts.

---

## 4. Profit-Aware Personalization & Merchandising

Unlike Amazon's invasive profiling, which tracks a user's entire cross-site internet history to serve irrelevant ads, ECOS uses **Contextual, Profit-Aware Personalization**:

-   **Contextual Over Behavioral:** We do not perform cross-site tracking. We personalize your experience based entirely on **contextual compatibility**. If a business customer has a specific "baby server" in their cart, we dynamically display compatible RAM, SSD, and rackmount accessory SKUs. This is highly relevant, privacy-respecting, and has a significantly higher conversion rate.
-   **Margin-Optimized Recommendations:** When recommending accessories or compatible components, the ECOS Recommendation Engine does not just look at "customers also bought." It dynamically evaluates:
    *   *Margin:* Expected contribution margin.
    *   *SLA:* Supplier fulfillment reliability.
    *   *Inventory:* Stock levels across fulfillment nodes.
    We recommend the compatible products that are both highly useful to the customer and generate the healthier gross profit for the ECOS business ledger.

---

## 5. Compliance Automation (The Right to be Forgotten)

To remain PCI-DSS, GDPR, and CCPA compliant, ECOS implements automated data deletion workflows:
-   **Request Ingestion:** If a customer submits a "Delete My Data" request, the Identity service publishes `customer.data-deletion.requested`.
-   **Automated Purge:**
    -   *Identity/Customer Services:* Anonymize the profile (erasing name, email, addresses, and IP logs).
    -   *Telemetry Service:* Scrub or completely anonymize historical search and click session logs linked to that customer ID.
    -   *Audit/Orders/Accounting Services:* **Do not delete.** Financial transaction data (invoices, tax ledgers, and state tax liabilities) must legally be retained for tax auditing purposes (typically 7 years) and are protected by law from being deleted, as documented in our compliance records.
-   **Resolution:** Once all non-legal data is scrubbed, the system publishes `customer.data-deletion.completed`.

# Multi-Stream Revenue & Business Evolution Specification

## 1. The Multi-Stream Commerce Philosophy

ECOS is engineered as a unified monetization engine. To maximize profitability, diversify cash flow, and increase Customer Lifetime Value (LTV), the platform is designed to support multiple, diverse revenue streams natively.

Rather than running separate systems for retail, digital downloads, services, and ads, ECOS abstracts all commercial offerings into a single **SKU-centric catalog** and maps them to specialized fulfillment and accounting rules.

```text
                               ECOS CATALOG (SKUs)
                                        │
         ┌──────────────────┬───────────┴──────────┬──────────────────┐
         ▼                  ▼                      ▼                  ▼
     PHYSICAL            DIGITAL                SERVICES         ADVERTISING
     (Hardware)     (SaaS / Software)        (Tech Repair)      (Sponsored)
         │                  │                      │                  │
         ▼                  ▼                      ▼                  ▼
   Distributor PO     Digital License        Work Order Dispatch   Ad Impression
     Fulfillment        Dispatcher              Fulfillment         Pixel Tracker
         │                  │                      │                  │
         ▼                  ▼                      ▼                  ▼
    Sales Revenue     SaaS Revenue           Service Revenue     Ad Revenue
    Account (4010)    Account (4020)         Account (4030)      Account (4040)
```

---

## 2. Expanded Double-Entry Chart of Accounts (COA)

To ensure full operational visibility and accurate tax/margin reporting, the ECOS Accounting domain expands its General Ledger to separate revenue and cost categories by department:

### 2.1. Revenue Accounts
-   **`4010` - Retail Sales Revenue:** Revenue generated from physical hardware sales (laptops, components, accessories).
-   **`4020` - Software & SaaS Licensing Revenue:** High-margin revenue from digital downloads, software keys, and recurring software-as-a-service subscriptions.
-   **`4030` - Services & Tech Repair Revenue:** High-margin revenue from labor, physical technical repairs, installations, and extended service warranties.
-   **`4040` - Advertising & Sponsored Placements Revenue:** High-margin revenue from sponsored search results, minimal category ad banners, and brand partnerships.

### 2.2. Expense & COGS Accounts
-   **`5010` - Cost of Goods Sold (COGS - Hardware):** Wholesale acquisition cost for physical products.
-   **`5015` - Cost of Software Sales (SaaS Royalties/Licensing):** Costs or licensing fees paid to software developers or distributors.
-   **`5030` - Cost of Services (Labor & Parts):** Cost of replacement parts and technician labor payouts.
-   **`5040` - Cost of Advertising (Ad Serving/Egress):** Infrastructure cost to host and serve media placements.

---

## 3. Abstracting Fulfillment Providers for Non-Physical SKU Types

Because ECOS interacts with fulfillment nodes through our standard `FulfillmentProvider` interface (defined in `packages/fulfillment-provider-contract`), we can plug in non-physical fulfillment adapters seamlessly:

### 3.1. The Digital Delivery Adapter
-   **Trigger:** Customer purchases a Software License SKU (e.g., `SOFT-OS-WIN11`).
-   **Action:** The Fulfillment Engine routes the line item to the `DigitalLicenseDispatcher` service.
-   **Resolution:** The service automatically retrieves a secure license key from our database or requests one from a third-party software API, generates an encrypted download link, emails it to the customer, and publishes `fulfillment.completed`.

### 3.2. The Service & Tech Repair Work-Order Dispatcher
-   **Trigger:** Customer purchases a Tech Repair SKU (e.g., `SERV-REPAIR-SCREEN`).
-   **Action:** The Fulfillment Engine routes the request to the `ServiceWorkOrderDispatcher` service.
-   **Resolution:** The service automatically generates an internal service work-order, assigns it to a certified repair partner or local technician, prints a pre-paid shipping label for the customer's mail-in repair, and publishes `shipment.created` to initiate tracking.

---

## 4. Minimal Advertising & Sponsored Placements

ECOS implements highly non-intrusive, native sponsored placements to monetize traffic without sacrificing user experience:
-   **Sponsored Search:** Hardware manufacturers (e.g., ASUS, MSI) can pay ECOS to place their laptops at the top of search result results for specific queries.
-   **Telemetry Attribution:** The ECOS Ad Engine tracks impressions and clicks using the built-in telemetry event bus (`telemetry.ad_clicked`). 
-   **Automated Billing:** At the end of the billing cycle, the Ad Engine aggregates these clicks, calculates the ad bill, and automatically ledgers the revenue under account `4040` (Ad Revenue).

# B2B Business Tech & Corporate Hardware Specification

## 1. The B2B Business Tech Strategy

ECOS is optimized for the highest-value, highest-margin segment of technology retail: **Business Tech**. We do not target low-margin consumer gadgets. We target the critical operational infrastructure that businesses need to run:
- **Corporate Computers & Workstations:** High-performance, reliable desktop and laptop fleets for corporate employees.
- **"Baby Servers" & Microservers:** Compact, quiet, and efficient edge-computing servers, file servers, and virtualization nodes for small-to-medium business (SMB) offices.
- **Commercial Networking:** Managed switches, routers, firewalls, and access points.

```text
                       ECOS B2B HARDWARE ECOSYSTEM
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
  CORPORATE FLEETS             "BABY SERVERS"             B2B CONSUMABLES
 (Laptops/Workstations)     (Microservers/Edge)        (Recurring Supplies)
         │                           │                           │
         ▼                           ▼                           ▼
   Bulk PO Discount           Custom RAM/SSD Config       Monthly Subscription
   Sourcing Optimizer         Fulfillment Sourcing            Auto-Deducted
         │                           │                           │
         ▼                           ▼                           ▼
  High AOV ($10k+)            High Margin SLA             Sticky B2B LTV
```

### 1.1. Why Business Tech is the ECOS Sweet Spot
- **High Average Order Value (AOV):** Transactions are corporate-funded, routinely exceeding $5,000.
- **Professional Trust:** Businesses prioritize SLA delivery speed, inventory accuracy, and responsive support. Our Sourcing Optimizer and Incident-Management gates are engineered precisely to satisfy this need.
- **Low Price Sensitivity:** Corporate buyers prioritize procurement speed and tax compliance over minor price variations, protecting ECOS's gross margins.
- ** Consumable Drag-Along:** Hardware sales act as the customer acquisition path for high-margin recurring paper, ink, and toner subscriptions.

---

## 2. High-Value Corporate Catalog & PIM Schemas

To support complex business tech, the Catalog and PIM domains (defined in `docs/010-catalog-and-pim.md`) extend their capabilities to handle configurations and volume pricing.

### 2.1. Configuration-on-the-Fly (Custom SKUs)
Corporate computers and baby servers require custom configurations (e.g., adding 64GB RAM and a 2TB NVMe SSD to a base server model).
-   The PIM handles this by defining **base SKUs** and **modification SKUs** (RAM, SSD, CPU upgrades).
-   The Pricing Engine dynamically aggregates these sub-SKUs to calculate a unified, profit-guaranteed floor price for the custom configuration.

### 2.2. Fleet Volume Discount Pricing
The Pricing Engine automatically applies volume discounts for bulk corporate purchases (e.g., 5+, 10+, or 50+ units).
-   These rules are defined dynamically in `pricing_policies` (e.g., "Reduce markup bps by 100 for every 10 units ordered, capped at a minimum contribution floor").
-   The Procurement service aggregates this into a single wholesale PO to the distributor, securing bulk purchasing discounts from the supplier and maximizing margin.

---

## 3. B2B Service & Maintenance SKUs

ECOS couples high-value physical hardware with high-margin service and maintenance contracts, managed via our **Service Work-Order Dispatcher**:
-   **Virtual Setup Assistance SKU:** Can be added to any baby server or fleet order. Connects the customer with a virtual remote setup engineer (60%+ gross margin on labor).
-   **Hardware Warranty & Repair SKU:** Integrates with our reverse-logistics RMA and local technician dispatch, handling physical repairs autonomously.

---

## 4. Corporate Tax Exemption Integration

B2B corporate sales often require tax exemption (e.g., government, educational institutions, or resellers). 
-   The **Tax Compliance domain** (defined in `docs/040-risk.md`) handles this by maintaining a `tax_exemption_certificates` table.
-   During checkout, a verified corporate customer can present their certificate number.
-   The Tax Compliance service validates the certificate, bypasses the sales tax calculation dynamically, and registers the transaction as tax-exempt, ensuring 100% legal compliance for nationwide corporate audits.

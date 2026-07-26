# Enterprise Commerce Operating System (ECOS)

Welcome to the **Enterprise Commerce Operating System (ECOS)** repository—a highly intelligent, profit-maximizing, and risk-aware commerce operating system designed specifically for premium electronics retail. 

Rather than building a simple ecommerce website, this repository provides the core, modular services and foundational ECOS architecture on top of which the storefront, administration backend, and supplier portals run.

---

## 1. Documentation & Architecture Constitution

Before writing code, ECOS has established a rigorous architectural constitution. You can find our comprehensive specifications under the `/docs` directory:

-   **[Vision & Mission (000)](docs/000-vision.md):** The core ECOS mission, design principles (Profit First, Explainable Decisions, Telemetry), and 6-stage maturity model.
-   **[Platform Architecture (001)](docs/001-architecture.md):** Our Domain-Driven Design (DDD) boundaries, Event-Driven Architecture (EDA) via Event Bus, and the centralized **Decision Engine** orchestration.
-   **[Engineering Standards (002)](docs/002-engineering-standards.md):** Coding style, versioning, data integrity (3NF databases), testing pyramid, and observability standards.
-   **[Governance & Compliance (005)](docs/005-governance.md):** Standardized schema and storage rules for the immutable Audit Log.
-   **[Catalog & PIM (010)](docs/010-catalog-and-pim.md):** Product Information Management specs, rich electronics schema (compatibility, batteries, MAP), and API/events.
-   **[Supplier Intelligence (020)](docs/020-suppliers.md):** Distributor onboarding, real-time ingestion, and the composite, multi-factor supplier scorecard (Profitability + Reliability + Delivery Speed).
-   **[Pricing Intelligence (030)](docs/030-pricing.md):** Multi-factor price and listing recommendations (resolving raw costs, shipping, processing, fraud/return/warranty reserves, and competitor undercutting).
-   **[Risk & Fraud Prevention (040)](docs/040-risk.md):** Customer trust profiling, behavioral analytics, real-time risk scores, and the manual review pipeline.

---

## 2. Directory Structure

The project is structured to transition into a clean, composable monorepo:

```text
RETAIL_ME_NOT/
├── docs/                                          # Core Architectural Specifications & Constitution
│   ├── 000-vision.md
│   ├── 001-architecture.md
│   ├── 002-engineering-standards.md
│   ├── 005-governance.md
│   ├── 010-catalog-and-pim.md
│   ├── 020-suppliers.md
│   ├── 030-pricing.md
│   └── 040-risk.md
│
└── wade-labs-storefront-complete-package/         # Reference Implementation and Modules
    ├── backend/
    │   ├── sql/
    │   │   ├── 001_pricing_capital_fulfillment.sql
    │   │   ├── 002_compliance_profit_and_event_gates.sql
    │   │   ├── 003_marketing_growth_and_ux.sql
    │   │   └── 004_supplier_intelligence.sql       # Schema for suppliers, performance, and decisions
    │   │
    │   ├── src/
    │   │   ├── supplier-intelligence/              # Scoring engine, JSON schema, normalizers, workers
    │   │   ├── pricing-engine.mjs                  # Hardened, reserve-aware async pricing engine
    │   │   ├── order-profit-guard.mjs              # Real-time order-level guardrail checks
    │   │   ├── capital-gate.mjs                    # Mercury & credit limit capital gating
    │   │   ├── compliance-gate.mjs                 # Louisiana tax exemption validation
    │   │   └── index.mjs
    │   │
    │   └── test/                                   # Domain verification tests (43 passing specs)
    │       ├── pricing-engine.test.mjs             # Asynchronous, scorer-integrated test suite
    │       └── ...
```

---

## 3. Running & Verifying the Platform

### Prerequisites
- Node.js >= 20.x

### Install Dependencies
From the repository root or the backend folder, install dependencies:
```bash
npm install
```

### Run Tests
To execute all backend unit, integration, and logic checks:
```bash
npm test --prefix wade-labs-storefront-complete-package/backend
```

To run the root tests:
```bash
npm test
```

All 45+ test suites across both the root and core engines are configured to run automatically in CI.

---

## 4. Operational Principles

Every automated action and decision in ECOS is designed to be **explainable**, **profitable**, and **secure**. Central policies protect the cash flow and inventory risk of high-end consumer electronics (e.g., RTX GPUs, premium laptops) before orders ever proceed to distributor fulfillment adapters.

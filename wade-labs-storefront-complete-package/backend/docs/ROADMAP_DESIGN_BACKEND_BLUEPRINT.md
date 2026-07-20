# Wade Labs Premium Electronics Storefront
## Profit-First Roadmap, Design Strategy, and Backend Logic Blueprint

**Owner:** WADE LABS LLC  
**Business jurisdiction:** Louisiana  
**Build model:** Custom direct-retail storefront with owned and distributor-fulfilled inventory  
**Primary checkout:** Stripe  
**Bank and capital authority:** Mercury available balance plus approved distributor credit  
**Current Louisiana status:** LDR registration correspondence received; resale certificate not yet issued or validated  
**Default fulfillment mode:** Manual and capital-gated  
**Future fulfillment mode:** Automated only after every release gate passes

> Security rule: do not place the Louisiana tax number, LaTAP username, certificate document, distributor credentials, Stripe secrets, or Mercury credentials in frontend code, public repositories, analytics, screenshots, or public documentation.

---

# 1. Executive Objective

Build a premium electronics retailer whose primary optimization target is durable contribution profit, not traffic, gross revenue, product count, or apparent conversion rate.

Every automated output must answer five questions:

1. Does this action increase expected contribution profit?
2. Can the business fund the supplier obligation without using unavailable money?
3. Is the product, price, stock, tax, shipping, and warranty representation accurate?
4. Can the order survive fraud, return, warranty, cancellation, and chargeback exposure?
5. Is there an auditable rollback or stop condition?

The system must decline revenue that creates a negative expected outcome.

---

# 2. Current Louisiana Compliance State

## 2.1 What Is Confirmed

The business has received correspondence that Louisiana Department of Revenue registration for WADE LABS LLC was processed.

Record internally:

```text
LDR_REGISTRATION_STATUS=PROCESSED
LOUISIANA_RESALE_CERTIFICATE_STATUS=PENDING
```

Do not record `APPROVED_ACTIVE` until the certificate is visible in LaTAP, downloaded, and validated.

## 2.2 Immediate Actions

1. Log in to LaTAP through a trusted device.
2. Open the sales-tax account.
3. Confirm the full LDR account number or Location ID.
4. Check `View Letters`.
5. Check for `Re-print Resale Certificate`.
6. Save the issued certificate in encrypted business storage.
7. Store approval date and expiration date exactly as printed.
8. Validate the certificate.
9. Submit it independently to each distributor.
10. Record each distributor's acceptance.

## 2.3 Pending-Period Build Rule

Build the application now, but keep exemption-dependent distributor listings in:

```text
DRAFT
COMING_SOON
PAUSED_COMPLIANCE
```

unless supplier tax is explicitly included in all-in cost and the transaction still passes every profit, tax, distributor, and fulfillment gate.

---

# 3. Profit Constitution

## 3.1 Optimization Hierarchy

1. Legal and contractual compliance
2. Prevention of catastrophic loss
3. Protection of customer funds and trust
4. Positive expected contribution
5. Capital availability
6. Inventory certainty
7. Delivery reliability
8. Conversion
9. Revenue
10. Traffic and engagement

No lower priority may override a higher priority.

## 3.2 Financial Definitions

```text
Net Sales
= Merchandise Revenue
+ Customer Shipping Revenue
- Discounts
- Refund Expectations

All-In Procurement Cost
= Wholesale Cost
+ Supplier Tax
+ Dropship Fee
+ Supplier Shipping
+ Packaging
+ Insurance
+ Handling
+ Environmental Fees
+ Expected Procurement Exception Cost

Variable Risk Reserve
= Payment Cost
+ Return Reserve
+ Chargeback Reserve
+ Fraud Reserve
+ Warranty Reserve
+ Support Reserve
+ Shipping Claim Reserve

Expected Contribution
= Net Sales
- All-In Procurement Cost
- Variable Risk Reserve
- Uncollected Tax Liability
```

## 3.3 Absolute Rules

Block or suppress when:

- Expected contribution is below its dollar floor.
- Expected margin is below its percentage floor.
- Supplier stock is stale or unknown.
- Supplier cost changes beyond tolerance.
- The supplier account is not approved.
- Required resale documentation is not accepted.
- Customer tax cannot be calculated.
- Available capital cannot cover procurement plus safety buffer.
- Risk status is blocked or unresolved.
- Product identity, condition, warranty, or compatibility is uncertain.
- MAP or contractual rules would be violated.
- Shipping is incompatible with battery rules.
- A webhook cannot be verified.
- An external write is not idempotent.

## 3.4 Initial Policy Baseline

| Policy | Initial value |
|---|---:|
| Target contribution margin | 6% |
| Minimum contribution per order | $25 |
| Return reserve | 1.50% |
| Chargeback reserve | 1.00% |
| Fraud reserve | 0.75% |
| Warranty reserve | 0.50% |
| Support reserve | 0.50% |
| Maximum daily decrease | 5% or $100 |
| Supplier cost-change tolerance | 2% |
| Competitor freshness | 24 hours |
| Default fulfillment execution | Manual |

Category overrides must be stricter for laptops, phones, tablets, GPUs, consoles, and other fraud-sensitive products.

---

# 4. Product and Listing Strategy

## 4.1 Pipeline

```text
Authorized catalog
→ canonical product
→ exact variant
→ content rights
→ distributor eligibility
→ fresh inventory
→ shipping eligibility
→ warranty and return data
→ competitor market snapshot
→ all-in cost
→ profit floor
→ MAP
→ source score
→ publish, pause, or suppress
```

## 4.2 Listing States

```text
DRAFT
COMING_SOON
ACTIVE_COMPETITIVE
ACTIVE_AT_FLOOR
ACTIVE_NO_MARKET_DATA
ACTIVE_DECREASE_GUARDED
PAUSED_STALE_STOCK
PAUSED_COST_CHANGE
PAUSED_COMPLIANCE
SUPPRESSED_LOW_MARGIN
SUPPRESSED_NO_VIABLE_SOURCE
SUPPRESSED_CONTRACT_RESTRICTION
DISCONTINUED
```

## 4.3 Supplier Selection

Score every supplier by:

- Expected contribution
- Expected margin
- Reliability
- Confirmed stock
- Delivery time
- Shipping cost
- Cancellation rate
- Rejection rate
- Return process
- Warranty quality
- Battery-route eligibility
- Capital requirement
- Distributor credit
- Data freshness

The cheapest supplier is not automatically selected.

## 4.4 Competitor Data

Use only authorized APIs, licensed feeds, approved exports, or evidenced manual observations.

Normalize by exact MPN, condition, included accessories, warranty, seller type, shipping, public discount, stock, delivery, membership requirement, region, age, and trust.

## 4.5 Repricing Formula

```text
Protected Floor = max(
  margin floor,
  contribution floor,
  MAP,
  category floor,
  product override
)

Candidate = normalized market position - controlled adjustment

Published = max(
  Protected Floor,
  daily decrease guard,
  approved Candidate
)
```

If the protected floor exceeds the viable market ceiling, suppress the listing.

---

# 5. Storefront Design Strategy

## 5.1 Brand System

- Deep black and graphite foundation
- White-gold or pale metallic accent
- Neutral white content areas
- Controlled chromatic reflection
- High-contrast technical typography
- Large authorized product imagery
- Precise specifications
- Minimal noise
- No blue-heavy generic retail theme

## 5.2 Homepage

1. Trust and utility strip
2. Navigation and predictive search
3. Premium hero
4. Owned inventory spotlight
5. Personalized categories
6. New verified arrivals
7. High-margin compatible accessories
8. Complete-the-setup bundles
9. Comparison entry
10. Delivery and warranty reassurance
11. Contextual ad
12. Human business story
13. Policies and support

## 5.3 Product Page

1. Identity, condition, and fulfillment
2. Media
3. Price and last stock check
4. Variant
5. Delivery
6. Purchase action
7. Trust details
8. Specifications
9. Compatibility
10. Included items
11. Warranty and returns
12. Comparison
13. Compatible accessories
14. Verified reviews
15. Alternatives

## 5.4 Profit-Aware Placement

```text
placement_score =
relevance
+ expected_contribution
+ expected_margin
+ conversion_probability
+ stock_confidence
+ delivery_confidence
+ owned_inventory_priority
- return_risk
- fraud_risk
- cancellation_risk
- support_cost
- fatigue_penalty
```

Relevance is mandatory. Promotion is labeled. Accessories must be compatible. Paid add-ons cannot be preselected.

---

# 6. Technical Architecture

```text
React or Svelte storefront
        |
        v
Fastify API
        |
        +--> PostgreSQL
        +--> Redis / BullMQ
        +--> Stripe adapter
        +--> Mercury adapter
        +--> Tax adapter
        +--> Distributor adapters
        +--> Email/SMS adapter
        +--> Object storage
```

Services:

```text
catalog
inventory
pricing
ranking
cart
checkout
payments
webhooks
risk
compliance
capital
orders
fulfillment
supplier-orders
shipping
tax
returns
refunds
notifications
reconciliation
admin
audit
```

Rules:

- Money is integer cents.
- Rates are basis points.
- Dates are UTC.
- Every decision stores policy version and reason codes.
- Every external write uses an idempotency key.
- Every async event enters a durable inbox.

---

# 7. State Machines

## Product

```text
DRAFT → VALIDATED → PRICED → ACTIVE → PAUSED → SUPPRESSED → DISCONTINUED
```

## Checkout

```text
CREATED → REPRICING → READY_FOR_PAYMENT → PAYMENT_PROCESSING
→ PAYMENT_SUCCEEDED | PAYMENT_FAILED | EXPIRED
```

## Order

```text
DRAFT
→ AWAITING_PAYMENT
→ PAYMENT_PROCESSING
→ PAID
→ PAYMENT_REVIEW
→ PROFIT_REVIEW
→ COMPLIANCE_HOLD
→ CAPITAL_HOLD
→ ROUTING
→ PARTIALLY_ROUTED
→ ROUTED
→ PARTIALLY_SHIPPED
→ SHIPPED
→ DELIVERED
```

## Supplier Order

```text
PLANNED → READY → SUBMISSION_PENDING → SUBMITTED → ACKNOWLEDGED
→ PACKING → SHIPPED → DELIVERED
```

---

# 8. Stripe Backend Logic

## PaymentIntent

1. Load and lock checkout.
2. Refresh supplier stock and cost.
3. Reprice.
4. Calculate shipping and discounts.
5. Calculate tax.
6. Run order profit guard.
7. Store immutable checkout revision.
8. Create or update one PaymentIntent.
9. Return only the client secret.

## Webhook

1. Receive raw body.
2. Verify signature.
3. Insert provider/event ID into durable inbox.
4. Return quickly.
5. Process in BullMQ.
6. Replay safely.

`payment_intent.succeeded` opens the payment gate only. It does not prove Mercury cash, inventory, compliance, or supplier cost.

---

# 9. Capital Gate

```text
Spendable Capital =
Mercury Available Balance
+ Approved Distributor Credit
- Active Reservations
- Pending Supplier Debits
- Safety Buffer
```

Before supplier submission:

1. Revalidate inventory.
2. Revalidate supplier cost.
3. Recalculate expected contribution.
4. Load Mercury available balance.
5. Load distributor credit.
6. Lock capital rows.
7. Create idempotent reservation.
8. Submit order.
9. Consume reservation on acknowledgement.
10. Release reservation on failure or timeout.

---

# 10. Compliance Gate

Current state:

```text
LDR_REGISTRATION_STATUS=PROCESSED
LOUISIANA_RESALE_CERTIFICATE_STATUS=PENDING
```

Default distributor listing mode:

```text
DRAFT_OR_COMING_SOON
```

Tax-paid procurement before certificate acceptance is disabled by default. If explicitly enabled, supplier tax must be part of all-in cost and the product must still pass all floors.

---

# 11. Fulfillment Orchestration

A distributor group proceeds only when:

```text
payment == SUCCEEDED
risk == ALLOW or APPROVED
profit == ALLOW
compliance == READY
inventory == fresh IN_STOCK
supplier cost change <= tolerance
capital == RESERVED
execution mode permits action
```

Manual mode prepares the supplier order but requires an admin action.

Automatic mode is enabled only after distributor sandbox, idempotency, tracking, failure, cancellation, capital reservation, replay, and kill-switch tests pass.

---

# 12. Fraud and Loss Prevention

Inputs:

- Stripe risk
- AVS
- CVC
- 3DS
- Address mismatch
- Amount
- Product category
- Quantity
- Velocity
- Account age
- Freight forwarder
- Prior disputes
- Expedited delivery
- Device and location mismatch

Decisions:

```text
ALLOW
REQUEST_3DS
REVIEW
BLOCK
CANCEL
REFUND
```

High-risk items may require signature, identity confirmation, quantity caps, no post-payment address changes, and delayed supplier release.

---

# 13. Database Blueprint

```text
products
product_variants
supplier_offers
warehouse_inventory
inventory_snapshots
competitor_price_observations
pricing_policies
pricing_decisions
carts
cart_lines
checkout_revisions
payment_records
webhook_event_inbox
orders
order_lines
order_profit_gate_decisions
fulfillment_groups
fulfillment_gate_decisions
capital_snapshots
capital_reservations
supplier_order_attempts
shipments
tracking_events
returns
refunds
tax_calculations
tax_registrations
nexus_measurements
business_compliance_profiles
distributor_compliance_accounts
audit_events
feature_flags
background_jobs
dead_letter_events
```

---

# 14. Admin Control Center

Display:

- Mercury available capital
- Reserved capital
- Open obligations
- Distributor credit
- Payments awaiting capital
- Fraud holds
- Profit holds
- Compliance holds
- Stale inventory
- Cost changes
- Suppressed listings
- Webhook health
- Failed jobs
- Certificate state
- Distributor certificate acceptance
- Tax deadlines
- Expected and realized contribution

Controls:

- Pause checkout
- Pause distributor checkout
- Pause supplier
- Pause automation
- Pause repricing
- Freeze price
- Suppress listing
- Release manual order
- Reject order
- Replay event
- Release reservation
- Refund
- Export audit evidence

---

# 15. Roadmap

## Phase 0 — Louisiana and Business Lock

Deliver now:

- Registration status `PROCESSED`
- Certificate status `PENDING`
- Encrypted operational credentials
- Tax-provider setup
- Customer policies
- Distributor matrix
- Catalog-rights records
- Certificate upload and acceptance tracking
- Distributor products defaulted to draft

## Phase 1 — Foundation

- Fastify
- PostgreSQL
- Redis/BullMQ
- Authentication
- Roles
- Audit
- Observability
- Feature flags
- CI
- Secret manager
- Backup and restore

## Phase 2 — Catalog

- Provider registry
- CSV/XML/JSON imports
- Raw payloads
- Canonical products
- MPN identity
- Image rights
- Inventory snapshots
- Adapter shell

## Phase 3 — Pricing

- Competitor observations
- All-in cost
- Profit floor
- Contribution floor
- MAP
- Supplier score
- Listing suppression
- Pricing audit

## Phase 4 — Storefront

- Design tokens
- Homepage
- Search
- Categories
- Product page
- Comparison
- Cart
- Mobile
- Accessibility
- Performance

## Phase 5 — Checkout and Stripe

- Checkout revisions
- Tax
- Payment Element
- PaymentIntent
- Raw-body webhook
- Durable inbox
- State machine
- Refund base

## Phase 6 — Manual Gated Fulfillment

- Order profit guard
- Fraud queue
- Compliance gate
- Mercury balance
- Capital reservation
- Warehouse routing
- Manual supplier console
- Tracking

## Phase 7 — Certificate Activation

After issuance:

- Download
- Validate
- Store dates
- Submit to distributors
- Record acceptance
- Activate eligible listings
- Start renewal monitor

## Phase 8 — Automated Fulfillment

- Sandbox
- Idempotent submission
- Multi-warehouse routing
- Tracking webhook
- Cancellation
- Partial failure
- Capital-gated automation
- Kill switch

## Phase 9 — Personalization

- Consent
- Telemetry
- Ranking
- Recommendations
- Owned boost
- Ads
- Experiments
- Explainability

## Phase 10 — Returns and Scale

- Returns
- Refunds
- Supplier credits
- Warranty
- Tax reconciliation
- Nexus
- Disaster recovery
- Load tests
- Incident response

---

# 16. Loss-Prevention Matrix

| Threat | Prevention | Stop state |
|---|---|---|
| Stock disappears | Checkout refresh | `INVENTORY_REVALIDATION_FAILED` |
| Supplier cost rises | Tolerance and repricing | `PROFIT_REVIEW_REQUIRED` |
| Competitor falls below floor | Suppress | `SUPPRESSED_LOW_MARGIN` |
| Payment pending | No fulfillment | `AWAITING_PAYMENT_CLEARANCE` |
| Cash unavailable | Capital gate | `AWAITING_AVAILABLE_CAPITAL` |
| Duplicate webhook | Unique event key | `DUPLICATE_IGNORED` |
| Duplicate purchase order | Idempotency key | Existing attempt reused |
| Fraud risk | Hold | `FULFILLMENT_HOLD` |
| Certificate pending | Draft listing | `PAUSED_COMPLIANCE` |
| Distributor has not accepted certificate | Block exemption-dependent order | `RESALE_CERTIFICATE_OR_ACCEPTANCE_PENDING` |
| Tax failure | Block checkout | `TAX_CALCULATION_FAILED` |
| Battery route invalid | Reject warehouse | `SHIPPING_COMPLIANCE_HOLD` |
| Provider outage | Stale state | `PROVIDER_UNAVAILABLE` |
| Negative contribution | Block | `PROFIT_REVIEW_REQUIRED` |

---

# 17. Launch Gates

Soft launch requires:

- Eligible inventory
- Tax calculation
- Stripe test
- Published policies
- Fresh stock
- Pricing guard
- Manual fulfillment
- Refund test
- Support contact

Distributor launch requires:

- Approved account
- Catalog and dropship rights
- Certificate accepted or explicit tax-paid procurement
- Complete all-in cost
- Successful order and tracking tests

Automatic fulfillment requires:

- Clean manual operating record
- Stable webhooks
- Reliable capital data
- Atomic reservations
- Supplier idempotency
- Failure alerts
- Kill switch
- Replay tools

---

# 18. Verification

The system must prove:

1. Pending certificate blocks exemption-dependent listings.
2. Owned inventory is handled separately.
3. Prices cannot cross the floor.
4. Low-trust data cannot control pricing.
5. Browser values cannot change the Stripe amount.
6. Frontend success cannot fulfill.
7. Duplicate webhooks cannot duplicate orders.
8. Duplicate supplier requests cannot duplicate procurement.
9. Payment without capital cannot submit supplier orders.
10. Profit failure blocks fulfillment.
11. Fraud blocks fulfillment.
12. Inventory failure blocks fulfillment.
13. Tax failure blocks checkout.
14. Certificate activation requires dates and document.
15. Distributor acceptance is separate.
16. Tax identifiers never reach the client or logs.
17. Manual and auto modes use the same gates.
18. Every decision has reason codes and audit.
19. Refund and supplier credit reconcile separately.
20. Kill switches stop automated actions.

---

# 19. Safe Default

When the product, payment, capital, supplier, tax, risk, or compliance state is uncertain:

```text
HOLD
PAUSE
SUPPRESS
QUEUE_REVIEW
```

Automation is earned only after the manual workflow and every replay, failure, and loss-control path pass verification.


---

# 20. Advertising, Marketing, Growth, and UI/UX Expansion

The complete campaign, lifecycle, retention, paid-media, organic-growth, modest-scaling, responsive-interface, accessibility, performance, and UX-experiment authority is:

```text
docs/advertising-marketing-growth-uiux-blueprint.md
```

Backend modules:

```text
backend/src/marketing-profit-engine.mjs
backend/src/growth-gate.mjs
backend/src/ux-experiment-gate.mjs
backend/sql/003_marketing_growth_and_ux.sql
```

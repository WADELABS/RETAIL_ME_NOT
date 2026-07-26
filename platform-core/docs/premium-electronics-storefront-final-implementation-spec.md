# Premium Electronics Storefront
## Final Merged, Audited, and Rewritten LLM Implementation Specification

**Status:** Authoritative build specification  
**Primary model:** Direct retail with distributor API–first dropshipping  
**Payment authority:** Stripe backend webhooks for all purchases  
**Checkout UI:** Stripe Payment Element or an explicitly approved Stripe Checkout implementation  
**Finance system:** Mercury banking and verified invoicing functions only  
**Primary market:** United States  
**Business base:** Louisiana  
**Louisiana resale certificate:** Approved; exact approval and expiration data must be stored from the issued certificate

---

# 0. Governing Instruction

This document replaces the earlier Amazon/Best Buy cart-mirroring concept, the unverified Mercury iframe example, and all incomplete chat drafts.

The implementation LLM must build the application described here in tested vertical slices. It must not invent provider endpoints, request fields, response fields, checkout behavior, inventory guarantees, tax rules, shipping rules, or payment states.

For every build increment, output:

```text
TASK_LOCK:
FILES_CREATED_OR_MODIFIED:
COMMANDS_TO_RUN:
VERIFICATION:
BOUNDARY:
NEXT_PATCH:
```

A feature is not complete until its automated tests pass and any provider-dependent behavior has passed a sandbox or approved integration test.

---

# 1. Final Product Objective

Build a premium ecommerce website for high-end electronics, computers, mobile devices, components, peripherals, accessories, and related products.

The storefront must combine:

- Inventory physically owned by the business.
- Inventory sourced from approved wholesale distributors.
- Authorized supplier and manufacturer product data.
- One branded catalog.
- One local cart.
- One customer checkout.
- Stripe processing for every website purchase.
- Signed Stripe backend webhooks as the authoritative payment-state source.
- Internal fulfillment for owned inventory.
- Automated distributor purchase-order routing for distributor-fulfilled inventory.
- Personalized search, ranking, recommendations, and merchandising.
- Contextually consistent advertising.
- Fraud controls appropriate for high-value electronics.
- Nationwide sales-tax calculation and nexus monitoring.
- Unified order tracking, support, returns, refunds, and reconciliation.

The customer purchases from this business. A distributor is a supplier and fulfillment partner, not a separate customer checkout destination under the primary model.

The storefront uses One Stripe purchase flow for owned and distributor-fulfilled items, followed by fulfillment-group routing after verified payment.

The product must feel like a complete premium electronics retailer, not a retailer clone, affiliate-link directory, scraped catalog, or external-checkout shell.

---

# 2. Final Business-Model Lock

## 2.1 Merchant Relationship

For all production products:

- This business is the customer-facing seller.
- This business establishes the customer-facing price.
- This business collects the customer payment through Stripe.
- This business creates the order and customer-support record.
- This business routes each paid order line to internal or distributor fulfillment.
- Distributor costs are procurement expenses.
- The distributor receives a supplier purchase order, not the customer's Stripe session.
- Customer communication remains controlled by this business unless a disclosed contractual workflow requires otherwise.

## 2.2 Inventory Ownership Types

Every sellable offer must use one of:

```text
OWNED_INVENTORY
DISTRIBUTOR_FULFILLED
PREORDER
BACKORDER
```

## 2.3 Fulfillment Types

Every order line must use one of:

```text
INTERNAL
DISTRIBUTOR
PICKUP
DIGITAL
UNAVAILABLE
```

## 2.4 Unified Purchase

Owned and distributor-fulfilled products may appear in the same cart and are charged through one Stripe purchase flow.

After verified payment:

- Owned items create internal fulfillment tasks.
- Distributor items are grouped by distributor.
- Each group creates a supplier purchase order.
- Partial supplier failures are handled at fulfillment-group level.
- Customer order tracking remains unified while exposing each shipment separately.

---

# 3. Superseded or Rejected Assumptions

Do not implement any of the following as established functionality:

1. Mirroring Amazon or Best Buy carts as the primary business model.
2. Redirecting distributor products to a separate retailer checkout.
3. Scraping retailer product pages, reviews, prices, carts, or checkout pages.
4. Injecting products into external carts without an approved provider API.
5. Cloning another retailer's branding or checkout.
6. Posting invoice requests directly to `https://mercury.com`.
7. Assuming Mercury returns `invoiceData.url`.
8. Assuming Mercury payer pages can be embedded in an iframe.
9. Treating `sendEmailOption: "DontSend"` as a hidden custom-domain checkout feature.
10. Assuming undocumented Apple Pay, Google Pay, ACH, card, or Plaid behavior.
11. Claiming that iframe isolation produces zero security risk.
12. Marking an order paid from a browser redirect or frontend callback.
13. Starting fulfillment from frontend JavaScript.
14. Routing any order before a signed backend event permits it.
15. Treating `payment_intent.processing` as settled.
16. Using a universal sales-tax threshold for all states.
17. Fabricating low stock, reviews, popularity, countdowns, discounts, or purchase activity.
18. Using the resale certificate for equipment or supplies consumed by the business.

---

# 4. Definition of Success

A customer can:

1. Browse and search premium electronics.
2. Filter by brand, model, price, specifications, compatibility, availability, condition, and fulfillment speed.
3. Compare products accurately.
4. See current price, stock, delivery, warranty, return, and compatibility information.
5. Add owned and distributor-supplied products to one cart.
6. Receive a server-calculated total.
7. Pay through Stripe.
8. Receive an accurate confirmed, pending, failed, or review status.
9. Track multiple fulfillment groups and shipments under one order.
10. Request support and returns through one customer-facing system.

The business can:

1. Connect approved distributor APIs.
2. Import and normalize catalogs.
3. Monitor supplier inventory.
4. Control pricing and margins.
5. Heavily promote eligible owned products.
6. Block stale or unavailable offers.
7. Review high-risk orders.
8. Route verified paid orders to the correct fulfillment path.
9. Recover from partial supplier failures.
10. Monitor tax exposure by jurisdiction.
11. Reconcile payment, cost, tax, shipping, refund, fee, and margin records.
12. Audit every automated state transition.

---

# 5. Required Storefront Surfaces

- Homepage
- Search results
- Category pages
- Brand pages
- Product detail
- Product comparison
- Compatibility finder
- Cart
- Checkout
- Payment pending
- Payment failed
- Order confirmation
- Customer account
- Order history
- Order tracking
- Return request
- Customer support
- About
- Contact
- Shipping policy
- Return policy
- Warranty policy
- Privacy policy
- Cookie and tracking controls
- Terms of sale
- Accessibility statement
- Sponsorship and affiliate disclosure where applicable

---

# 6. Required Administrative Surfaces

- Executive dashboard
- Product catalog
- Variants
- Supplier offers
- Distributor connections
- Inventory health
- Pricing rules
- Margin controls
- Promotions
- Search ranking
- Recommendations
- Homepage merchandising
- Advertising
- Orders
- Stripe PaymentIntents
- Stripe webhook events
- Fraud-review queue
- Fulfillment groups
- Supplier purchase orders
- Shipments
- Returns
- Refunds
- Warranty cases
- Tax registrations
- Nexus monitoring
- Resale-certificate record
- Reconciliation
- Customer support
- Consent and privacy requests
- Audit log
- Feature flags
- Provider health
- Failed background jobs
- Rate-limit status
- Webhook health

---

# 7. System Modules

```text
identity
catalog
provider-registry
distributor-adapters
inventory
pricing
promotions
search
ranking
recommendations
advertising
telemetry
consent
cart
checkout
payments
stripe-webhooks
orders
risk
fulfillment
supplier-orders
shipping
tax
returns
refunds
warranty
notifications
reconciliation
admin
audit
observability
```

Rules:

- Page components must not call distributor APIs directly.
- Page components must not create authoritative totals.
- Browser code must not initiate fulfillment.
- Provider logic must be isolated behind adapters.
- Durable background jobs must handle supplier and post-payment processing.
- All financial and fulfillment state transitions must be idempotent.

---

# 8. Distributor Adapter Architecture

## 8.1 Required Interface

```ts
interface DistributorAdapter {
  providerKey: string;

  searchCatalog(input: DistributorSearchInput): Promise<DistributorProduct[]>;
  getProduct(externalProductId: string): Promise<DistributorProduct>;
  getOffer(input: DistributorOfferInput): Promise<DistributorOffer>;
  getInventory(input: InventoryRequest): Promise<InventoryResult>;
  getShippingQuote(input: ShippingQuoteRequest): Promise<ShippingQuoteResult>;
  submitOrder(input: DistributorOrderRequest): Promise<DistributorOrderResult>;
  getOrderStatus(externalOrderId: string): Promise<DistributorOrderStatus>;
  cancelOrder(input: DistributorCancelRequest): Promise<DistributorCancelResult>;
  requestReturn(input: DistributorReturnRequest): Promise<DistributorReturnResult>;
}
```

## 8.2 Capability Declaration

```ts
interface DistributorCapabilities {
  catalogSearch: boolean;
  incrementalCatalogSync: boolean;
  inventoryWebhooks: boolean;
  inventoryPolling: boolean;
  inventoryReservation: boolean;
  realtimeShippingQuotes: boolean;
  orderSubmission: boolean;
  orderWebhooks: boolean;
  orderPolling: boolean;
  cancellation: boolean;
  returns: boolean;
  serialNumbers: boolean;
  blindDropship: boolean;
  customPackingSlip: boolean;
}
```

## 8.3 Provider Registry Fields

- Provider key
- Provider name
- Contract status
- Enabled status
- Environment
- Supported regions
- Supported currencies
- Authentication method
- API version
- Rate limits
- Cache restrictions
- Product-description rights
- Product-image rights
- Review rights
- Attribution requirements
- MAP restrictions
- Pricing restrictions
- Inventory freshness window
- Reservation support
- Shipping support
- Dropship support
- Tracking support
- Cancellation support
- Return support
- Warranty terms
- Battery restrictions
- Webhook support
- Sandbox availability
- Last successful synchronization
- Provider health
- Operations contact

## 8.4 Unsupported Capability Rule

When a provider does not support a capability:

- Mark it unsupported.
- Disable the dependent feature.
- Use a documented operational fallback.
- Do not recreate the capability with scraping, browser automation, or guessed endpoints.

---

# 9. Catalog and Product Data

## 9.1 Canonical Entities

```text
Product
ProductVariant
Brand
Category
SpecificationDefinition
SpecificationValue
CompatibilityRule
MediaAsset
SupplierOffer
SellableOffer
InventorySnapshot
PriceSnapshot
ShippingProfile
WarrantyProfile
ReturnProfile
ComplianceAttribute
```

## 9.2 Identity Separation

```text
Product = canonical product identity
Variant = selectable configuration
SupplierOffer = distributor-specific cost, stock, and fulfillment terms
SellableOffer = customer-facing offer selected by the business
```

Multiple supplier offers may map to one variant.

## 9.3 Raw and Normalized Storage

Store:

- Raw provider payload
- Canonical normalized data
- Provider object ID
- Provider update timestamp
- Import timestamp
- Normalization version
- Change hash
- Content-rights expiration
- Last validation time
- Validation errors

## 9.4 Authorized Content Only

Use only:

- Official distributor feeds
- Manufacturer feeds
- Licensed content
- Business-created copy and media
- Authorized review providers
- User-generated content collected under published terms

Do not scrape or republish protected content without permission.

---

# 10. Inventory

## 10.1 States

```text
IN_STOCK
LOW_STOCK
OUT_OF_STOCK
BACKORDER
PREORDER
DISCONTINUED
UNKNOWN
STALE
```

## 10.2 Sync Priority

1. Distributor webhook
2. Provider event stream
3. Incremental polling
4. Scheduled full synchronization
5. On-demand validation

## 10.3 Required Validation Points

Validate distributor stock:

- During catalog synchronization
- Before add-to-cart when cached data is stale
- Before final checkout calculation
- Immediately before supplier-order submission
- During supplier exception recovery

## 10.4 Inventory Rules

- Every stock result has a checked timestamp.
- Every provider has a configurable freshness window.
- Stale stock cannot be shown as definitively available.
- Adding to cart does not reserve supplier stock unless reservation is supported.
- Checkout must detect price and quantity changes.
- Provider outages produce `UNKNOWN` or `STALE`.
- Oversells enter an operations queue.
- Inventory updates are idempotent.

---

# 11. Pricing and Margin Engine

## 11.1 Server Authority

The server alone calculates:

- Unit price
- Quantity eligibility
- Discounts
- Shipping
- Tax
- Total
- Currency
- Supplier cost
- Margin
- PaymentIntent amount

## 11.2 Pricing Inputs

- Supplier cost
- Owned inventory cost
- MAP
- MSRP
- Category margin
- Brand margin
- Product override
- Expected shipping cost
- Payment cost
- Expected return cost
- Fraud reserve
- Promotion
- Coupon
- Bundle adjustment
- Minimum contribution margin

## 11.3 Controls

- Global margin floor
- Category rules
- Brand rules
- Product overrides
- Distributor rules
- MAP enforcement
- Promotion dates
- Coupon stacking
- Maximum discount
- Loss-leader approval
- Cost-change alerts
- Margin anomaly alerts
- Price history
- Approval workflow

## 11.4 Checkout Repricing

1. Refresh supplier offers.
2. Refresh inventory.
3. Recalculate prices.
4. Recalculate shipping.
5. Recalculate discounts.
6. Recalculate tax.
7. Compare with cart snapshot.
8. Require acknowledgement for increases.
9. Persist the accepted checkout revision.
10. Create or update the PaymentIntent using the persisted revision.

## 11.5 Competitive Price Acquisition Boundary

Competitor prices may be ingested only from:

- Authorized retailer APIs
- Licensed market-data feeds
- Distributor or manufacturer feeds
- Approved affiliate feeds
- Public data explicitly licensed for automated use
- Manually imported observations with evidence

Do not implement unauthorized scraping, anti-bot bypass, browser impersonation, CAPTCHA evasion, or hidden cart extraction.

Each observation must store:

- Exact manufacturer part number or canonical variant ID
- Competitor
- Seller identity
- Condition
- Item price
- Shipping price
- Public discount
- Landed customer price
- Stock state
- Observation time
- Source type
- Trust score
- Comparability decision
- Evidence reference

Only fresh, in-stock, comparable observations can affect automatic pricing.

## 11.6 Minimum Viable Price

Use integer cents and basis points. Never calculate stored prices with binary floating-point currency.

For supplier offer `s`, define:

```text
C = wholesale cost
  + supplier fulfillment charge
  + dropship fee
  + packaging cost
  + shipping subsidy
  + supplier tax not removed by an accepted resale certificate
  + other fixed procurement cost

V = processing rate
  + estimated processing cost on collected sales tax
  + return reserve rate
  + fraud reserve rate
  + warranty reserve rate

F = payment processor flat fee
M = target margin rate
K = minimum contribution dollars
```

Calculate two floors:

```text
MarginFloor       = ceil((C + F) / (1 - V - M))
ContributionFloor = ceil((C + F + K) / (1 - V))
MinimumViablePrice = max(MarginFloor, ContributionFloor, MAP)
```

The listing-time tax factor is an estimate. Checkout must recalculate the exact destination tax and reject any final state that violates the configured margin or contribution policy.

## 11.7 Robust Market Position

Do not automatically match the single lowest observed number.

The pricing worker must:

1. Reject stale, out-of-stock, low-trust, wrong-condition, and non-comparable observations.
2. Convert accepted observations to landed price.
3. Calculate a trust-weighted market quantile and median.
4. Apply the configured target position or undercut.
5. Enforce MAP and the minimum viable price.
6. Enforce a premium-tolerance ceiling relative to the trusted market median.
7. Apply price-movement limits to prevent repricing oscillation.
8. Re-run the post-rounding margin calculation.

Default decision:

```text
DesiredPrice = TrustedMarketPosition - Undercut
RequiredPrice = max(MinimumViablePrice, MAP)
MarketCeiling = TrustedMedian * (1 + PremiumTolerance)
```

Publish when:

```text
max(DesiredPrice, RequiredPrice) <= MarketCeiling
```

Otherwise suppress the supplier offer or route it for manual merchandising review.

## 11.8 Listing-Source Selection

Evaluate every fresh supplier offer for the same canonical variant.

For each offer, calculate:

- Minimum viable price
- Public candidate price
- Expected processor cost
- Return, fraud, and warranty reserves
- Expected contribution
- Expected margin
- Available quantity
- Inventory freshness
- Supplier reliability
- Delivery estimate
- Warehouse availability
- MAP conflict
- Competitive ceiling conflict

A deterministic supplier score must combine contribution, reliability, stock depth, delivery speed, and operational penalties.

The highest-scoring viable supplier offer becomes the active listing source.

If no supplier offer is viable:

```text
is_listed = false
listing_state = SUPPRESSED_NO_VIABLE_SOURCE
```

Required listing states include:

```text
ACTIVE_COMPETITIVE
ACTIVE_AT_FLOOR
ACTIVE_NO_MARKET_DATA
ACTIVE_DECREASE_GUARDED
SUPPRESSED_NO_VIABLE_SOURCE
SUPPRESSED_LOW_MARGIN
SUPPRESSED_OUT_OF_STOCK
SUPPRESSED_STALE_OFFER
SUPPRESSED_MAP_MARKET_CONFLICT
SUPPRESSED_NO_MARKET_DATA
```

## 11.9 Race-to-the-Bottom Protection

The engine must never follow a competitor below the protected floor.

When market price falls below viability:

- Do not reduce below the protected floor.
- Do not accept a negative contribution.
- Do not hide margin loss inside shipping or mandatory fees.
- Suppress the listing when the protected floor exceeds the configured market ceiling.
- Alert merchandising when a category loses broad viability.
- Permit an explicit approved loss-leader override with dates, budget, approver, and audit log.

## 11.10 Pricing Worker and Publication

Run pricing outside the checkout API process.

Supported triggers:

- Authorized competitor-price event
- Supplier-cost event
- Inventory event
- Daily or twice-daily batch
- Manual product evaluation
- Promotion change
- Policy change

The worker must persist the full pricing decision before publication, including input hashes, rejected observations, selected supplier offer, floor, market position, final price, contribution, margin, reason codes, and algorithm version.

The storefront must render only products whose current listing state is active and whose supplier offer remains within its freshness window.

---

# 12. Search, Ranking, and Owned-Product Priority

## 12.1 Ranking Inputs

- Query relevance
- Exact model match
- Category match
- Specification match
- Compatibility
- Stock
- Delivery estimate
- Margin
- Product quality
- Authorized review quality and volume
- Click-through rate
- Add-to-cart rate
- Checkout-start rate
- Verified payment-success rate
- Return rate
- Cancellation rate
- Session intent
- User preference
- Price band
- Brand preference
- Recency
- Data freshness
- Promotion
- Owned-inventory priority
- Manual merchandising
- Diversity constraints

## 12.2 Owned-Product Promotion

Owned inventory receives the strongest commercial promotion through:

- `owned_inventory_boost`
- Homepage hero priority
- Featured by Us
- Our Pick
- Available Now
- Fastest Fulfillment
- Exclusive Offer
- Staff Recommendation
- Owned-product bundles
- Owned accessory cross-sells

Eligibility gates:

- Relevant
- Available
- Correct variant
- Accurate claims
- Compatible
- Meets quality requirements
- Clearly identified
- Does not displace an exact requested product with an unrelated product

## 12.3 Transparency

Label commercial placements as applicable:

- Sponsored
- Promoted
- Featured by Us
- Staff Recommendation
- Exclusive Offer

Store ranking reason codes, applied boosts, model version, and experiment ID.

---

# 13. Recommendations

Required modules:

- Recently viewed
- Similar products
- Lower-cost alternative
- Performance upgrade
- Premium upgrade
- Compatible accessories
- Frequently paired
- Complete the setup
- Trending
- Best sellers
- New arrivals
- Back in stock
- Price drops
- Owned-product spotlight

Each module requires:

- Candidate query
- Eligibility rules
- Ranking function
- Fallback
- Impression event
- Click event
- Add-to-cart event
- Verified payment attribution
- Frequency cap
- Reason code
- Experiment assignment

---

# 14. Telemetry and Personalization

## 14.1 Event Names

```text
session_started
consent_updated
page_viewed
module_impressed
product_impressed
product_clicked
search_submitted
filter_changed
sort_changed
comparison_added
comparison_removed
product_viewed
variant_selected
inventory_checked
cart_item_added
cart_item_removed
cart_quantity_changed
coupon_applied
checkout_started
checkout_repriced
payment_intent_created
payment_started
payment_processing
payment_succeeded
payment_failed
order_created
fulfillment_group_created
supplier_order_submitted
supplier_order_failed
shipment_created
shipment_delivered
return_started
refund_completed
ad_impressed
ad_clicked
recommendation_dismissed
```

## 14.2 Event Fields

Use only applicable fields:

- Event ID
- Schema version
- Timestamp
- Session ID
- User ID
- Consent state
- Page
- Module
- Product
- Variant
- Offer
- Experiment
- Recommendation reason
- Device class
- Coarse region
- Referral category
- Correlation ID
- Checkout ID
- PaymentIntent ID
- Order ID
- Fulfillment group ID

## 14.3 Privacy Rules

- Separate essential telemetry from optional analytics.
- Separate analytics from advertising.
- Obtain consent where required.
- Provide a complete non-personalized experience.
- Never log payment credentials.
- Never log secrets.
- Avoid precise location unless justified and consented.
- Define retention by data class.
- Implement export and deletion workflows.
- Do not infer sensitive traits for merchandising.
- Maintain a data and processor inventory.

## 14.4 Personalization Levels

```text
NONE
SESSION_ONLY
CONSENTED_ANONYMOUS
ACCOUNT_PROFILE
```

---

# 15. Advertising

Advertising must:

- Match the current product, category, compatibility, and price context.
- Respect inventory.
- Respect consent.
- Respect frequency caps.
- Use authorized media.
- Avoid disruptive layout shift.
- Be labeled.
- Disclose material sponsorship or affiliate relationships.

Advertising must not:

- Imitate security alerts.
- Hide sponsorship.
- Fabricate scarcity.
- Fabricate discounts.
- Use fake reviews.
- Force redirects.
- Obscure checkout totals.
- Preselect paid add-ons.
- Auto-play sound.

---

# 16. Sensory and Conversion Design

The interface must communicate:

- Premium quality
- Technical precision
- Speed
- Security
- Credibility
- Product excitement
- Human support

Use:

- A strict visual system
- Consistent typography
- High-resolution authorized media
- Stable layouts
- Clear spacing
- Subtle motion
- Close-up product imagery
- Port and connector diagrams
- Scale references
- Dimension visualization
- Comparison tables
- Compatibility indicators
- Included-items lists
- Delivery confidence
- Warranty clarity
- Smooth add-to-cart feedback
- User-initiated product video

Allowed conversion techniques:

- Verified reviews
- Genuine best-seller labels
- Real stock signals
- Real promotion deadlines
- Clear benefits
- Compatibility confidence
- Delivery estimates
- Return reassurance
- Transparent comparisons
- Clear next actions

Prohibited:

- Fake countdowns
- Fake low-stock warnings
- Fake recent-purchase notices
- False testimonials
- Hidden fees
- Confirmshaming
- Misleading button text
- Difficult cancellation
- Obscured return conditions

---

# 17. Cart Model

```ts
interface CartLine {
  id: string;
  cartId: string;
  productId: string;
  variantId: string;
  sellableOfferId: string;
  ownershipType: 'OWNED_INVENTORY' | 'DISTRIBUTOR_FULFILLED' | 'PREORDER' | 'BACKORDER';
  fulfillmentType: 'INTERNAL' | 'DISTRIBUTOR' | 'PICKUP' | 'DIGITAL';
  distributorKey?: string;
  externalProductId?: string;
  externalOfferId?: string;
  quantity: number;
  unitPriceSnapshot: number;
  currency: string;
  inventorySnapshotId: string;
  inventoryCheckedAt: string;
  shippingEstimateSnapshot?: number;
  taxCode: string;
  promotionIds: string[];
  attribution: Record<string, string>;
}
```

Rules:

- Cart totals are provisional until checkout validation.
- Quantity cannot exceed verified eligibility.
- Stale offers must refresh.
- Removed items require an explanation.
- Price changes require disclosure.
- Cart persists across authentication.
- Cart merge detects duplicates.
- Promotions recalculate server-side.
- Browser totals are never authoritative.
- Fulfillment source remains attached to each line.

---

# 18. Stripe Payment Architecture

## 18.1 Global Payment Rule

Stripe backend webhooks are authoritative for all purchases:

- Owned inventory
- Distributor-fulfilled inventory
- Mixed carts
- Pickup
- Digital items
- Preorders
- Backorders when permitted
- Card
- Approved wallets
- Approved delayed-notification payment methods

No purchase bypasses the payment state machine.

## 18.2 Checkout UI

Use Stripe Payment Element for a branded checkout unless the implementation deliberately chooses Stripe Checkout.

Do not build raw card-number, expiration, CVC, bank-account, or wallet credential fields.

## 18.3 Checkout Snapshot

Before PaymentIntent creation, persist:

- Checkout ID
- Customer ID or guest token
- Shipping address
- Billing address when required
- Order lines
- Product snapshots
- Supplier-offer snapshots
- Inventory snapshots
- Shipping selections
- Discount calculation
- Tax calculation
- Total
- Currency
- Fulfillment plan
- Risk context
- Terms version
- Privacy version
- Idempotency key
- Expiration time

## 18.4 PaymentIntent Endpoint

```text
POST /api/checkouts/:checkoutId/payment-intent
```

Server workflow:

1. Authenticate the customer or validate the guest session.
2. Load the checkout.
3. Acquire a mutation lock.
4. Refresh supplier offers and inventory.
5. Recalculate price, shipping, discounts, and tax.
6. Persist the final checkout revision.
7. Create or update one PaymentIntent.
8. Set amount and currency from the stored revision.
9. Put opaque internal IDs in Stripe metadata.
10. Store the PaymentIntent ID.
11. Return only the required client secret and public checkout state.
12. Never log the client secret.
13. Never place the client secret in a URL.

## 18.5 Payment States

```text
NOT_STARTED
REQUIRES_PAYMENT_METHOD
REQUIRES_CONFIRMATION
REQUIRES_ACTION
PROCESSING
SUCCEEDED
FAILED
CANCELED
PARTIALLY_REFUNDED
REFUNDED
DISPUTED
```

## 18.6 Frontend Rule

The frontend may:

- Render the Payment Element.
- Confirm the PaymentIntent.
- Display a provisional result.
- Poll the business order endpoint for user experience.

The frontend may not:

- Mark the order paid.
- Create fulfillment.
- Submit distributor orders.
- Trust a redirect as proof of payment.
- Choose the charged amount.
- Bypass webhook processing.

---

# 19. Stripe Backend Webhooks for All Purchases

## 19.1 Endpoint

```text
POST /api/webhooks/stripe
```

The route must receive the raw request body before JSON parsing.

## 19.2 Signature Verification

The webhook handler must:

1. Read `Stripe-Signature`.
2. Verify the signature using the environment-specific endpoint secret.
3. Reject invalid or missing signatures.
4. Never use a client-provided event object as authoritative.
5. Never expose the webhook secret.

## 19.3 Durable Event Inbox

Persist each event before business processing:

```ts
interface StripeEventInbox {
  stripeEventId: string;
  eventType: string;
  apiVersion?: string;
  objectId?: string;
  receivedAt: string;
  payloadHash: string;
  processingState: 'RECEIVED' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'IGNORED' | 'FAILED';
  attempts: number;
  lastError?: string;
  processedAt?: string;
}
```

Unique constraint:

```text
UNIQUE(stripeEventId)
```

Optional secondary duplicate guard:

```text
UNIQUE(eventType, objectId, semanticTransitionKey)
```

## 19.4 Handler Behavior

The HTTP handler must:

1. Verify the signature.
2. Insert or recognize the event idempotently.
3. Queue business processing.
4. Return a successful response promptly.
5. Avoid long distributor, email, tax, or shipping calls inside the request.

## 19.5 Required Event Types

At minimum, subscribe to the events the implementation actually uses:

```text
payment_intent.succeeded
payment_intent.processing
payment_intent.payment_failed
payment_intent.canceled
balance.available
payout.paid
payout.failed
charge.refunded
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
```

Add other event types only when a defined workflow consumes them.

## 19.6 Event Actions

### `payment_intent.succeeded`

1. Retrieve the local checkout/order reference from trusted metadata.
2. Load the expected order amount and currency.
3. Compare them with the PaymentIntent.
4. Record the successful payment.
5. Idempotently transition the order to `PAID`, `FULFILLMENT_HOLD`, or `PAYMENT_SUCCEEDED_AWAITING_CAPITAL`.
6. Run risk and reconciliation rules.
7. Create fulfillment groups if they do not already exist.
8. Queue eligible owned-inventory fulfillment according to risk policy.
9. Queue a capital-clearance evaluation for every distributor fulfillment group.
10. Do not submit a distributor purchase order from this webhook action.
11. Queue confirmation communication.
12. Emit internal `payment.succeeded`.

### `payment_intent.processing`

1. Record `PROCESSING`.
2. Show Payment Pending.
3. Do not ship physical goods.
4. Do not submit irreversible distributor orders.
5. Wait for a terminal event.

### `payment_intent.payment_failed`

1. Record the failure reason.
2. Keep the order unpaid.
3. Release temporary checkout locks.
4. Do not fulfill.
5. Permit a safe retry.
6. Notify the customer without exposing sensitive decline details.
7. Emit internal `payment.failed`.

### `payment_intent.canceled`

1. Record cancellation.
2. Prevent fulfillment.
3. Expire checkout state when applicable.
4. Release reservations where supported.

### `charge.refunded`

1. Reconcile the refund against local refund records.
2. Update payment and order totals.
3. Avoid duplicate refund notifications.
4. Trigger supplier-credit reconciliation where applicable.

### Dispute events

1. Open or update a dispute case.
2. Freeze unsafe actions where policy requires.
3. Attach order, shipment, customer, and communication evidence.
4. Notify authorized finance or risk staff.
5. Preserve an immutable audit trail.

## 19.7 Ordering and Replay

The event processor must tolerate:

- Duplicate delivery
- Delayed delivery
- Out-of-order delivery
- Manual replay
- Process restart
- Database retry
- Queue retry

State transitions must be conditional and idempotent.

## 19.8 Mismatch Boundary

If PaymentIntent amount, currency, customer reference, or checkout reference does not match the local order:

```text
PAYMENT_RECONCILIATION_HOLD
```

Do not fulfill automatically.

## 19.9 Webhook Failure Operations

Required controls:

- Dead-letter queue
- Retry policy
- Failure alert
- Event replay command
- Event inspection screen
- Last-success metric
- Processing-latency metric
- Duplicate-rate metric
- Signature-failure metric
- Runbook

## 19.10 Payment Success Is Not Spendable Capital

`payment_intent.succeeded` confirms payment success. It does not prove that the same funds are already spendable from the business checking account.

Use separate gates:

```text
Stripe payment gate
→ risk and reconciliation gate
→ payout/bank availability gate
→ capital reservation
→ supplier-order queue
```

Stripe `balance.available` means funds are available in the Stripe balance. It must not be counted as Mercury spendable cash unless the configured supplier payment mechanism can directly consume that balance.

For ordinary bank-funded supplier purchases, Mercury `availableBalance` or an approved distributor line of credit is the capital authority.

## 19.11 Mercury Balance Events

Subscribe to the appropriate signed Mercury webhook events when the account supports them:

```text
checkingAccount.balance.updated
savingsAccount.balance.updated
creditAccount.balance.updated
transaction.created
transaction.updated
```

Required behavior:

1. Verify the `Mercury-Signature` header using the configured Mercury verification method.
2. Store the event id and resource version idempotently.
3. Update the capital snapshot.
4. Use `availableBalance`, not pending incoming funds, for bank-funded supplier release.
5. Re-evaluate queued orders after a relevant balance change.
6. Do not submit supplier orders directly inside the Mercury webhook request.
7. Return promptly and process through a durable queue.

## 19.12 Capital Formula and Reservation

For an order, calculate:

```text
RequiredProcurementCapital =
  wholesale cost
  + supplier shipping
  + dropship fees
  + supplier tax
  + other supplier charges
  + procurement buffer

SpendableCapital =
  Mercury available balance
  + approved distributor credit available
  + explicitly spendable alternative capital
  - active capital reservations
  - pending supplier debits
  - operating safety buffer
```

Release only when:

```text
PaymentIntent = succeeded
AND reconciliation = passed
AND risk decision permits fulfillment
AND inventory = revalidated
AND supplier price remains within tolerance
AND SpendableCapital >= RequiredProcurementCapital
AND an idempotent capital reservation is committed
```

Each order may have only one active capital reservation. Duplicate events, retries, or worker restarts must reuse the existing reservation.

## 19.13 Manual-to-Automatic Transition

Support two deployment modes:

```text
FULFILLMENT_MODE=MANUAL
FULFILLMENT_MODE=CAPITAL_GATED_AUTO
```

### Manual

- Successful distributor orders enter an administrative queue.
- No supplier-order API is called automatically.
- An administrator confirms cleared capital, inventory, supplier cost, destination, and resale treatment.
- The same idempotent supplier-order module is used after approval.

### Capital-Gated Automatic

- Stripe and Mercury events update durable state.
- A worker evaluates risk, reconciliation, inventory, cost, warehouse, and capital.
- The worker creates a capital reservation.
- The supplier-order worker submits the order exactly once.
- Failed gates route to an exception queue and low-capital alert.

Changing the mode must not require schema changes or replacement of the supplier adapter.

## 19.14 ACH Additional-Risk Policy

ACH Direct Debit is asynchronous and can exceptionally fail after an apparent success.

Support a configurable additional hold for categories or order amounts where replacement capital is unavailable:

```text
ACH_ADDITIONAL_HOLD_DISABLED
ACH_HOLD_UNTIL_POLICY_DATE
MANUAL_ACH_RELEASE
```

This hold is a business risk policy, not a substitute for Stripe event verification.

---

# 20. Fraud and High-Ticket Controls

## 20.1 Risk Inputs

- Order amount
- Product category
- Quantity
- Billing and shipping mismatch
- Expedited shipping
- New account
- Failed attempts
- Payment velocity
- Account velocity
- Address velocity
- High-risk delivery address
- Freight forwarder
- Prior chargeback
- Trusted-customer history
- Distributor irreversibility
- Serial-number exposure
- Pickup identity requirements
- Stripe risk signals

## 20.2 Decisions

```text
ALLOW
REQUEST_3DS
REVIEW
BLOCK
CANCEL
REFUND
```

## 20.3 Fulfillment Hold

High-risk orders must support:

- `PAYMENT_REVIEW`
- `FULFILLMENT_HOLD`
- Manual review
- Customer verification
- Address verification
- Approval
- Rejection
- Cancellation
- Refund
- Audit record

A successful payment does not override a configured fraud hold.

---

# 21. Orders and Fulfillment

## 21.1 Core Entities

```text
Order
OrderLine
PaymentRecord
StripeEventInbox
TaxRecord
FulfillmentGroup
SupplierPurchaseOrder
Shipment
TrackingEvent
Return
Refund
WarrantyCase
CustomerCommunication
AuditEvent
```

## 21.2 Order States

```text
DRAFT
AWAITING_PAYMENT
PAYMENT_PROCESSING
PAYMENT_REVIEW
PAID
PAYMENT_SUCCEEDED_AWAITING_CAPITAL
AWAITING_AVAILABLE_CAPITAL
CAPITAL_RESERVED
PAYMENT_RECONCILIATION_HOLD
FULFILLMENT_HOLD
ROUTING
PARTIALLY_ROUTED
ROUTED
PARTIALLY_SHIPPED
SHIPPED
PARTIALLY_DELIVERED
DELIVERED
PARTIALLY_CANCELED
CANCELED
RETURN_IN_PROGRESS
PARTIALLY_REFUNDED
REFUNDED
EXCEPTION
```

## 21.3 Fulfillment Group States

```text
PLANNED
BLOCKED
READY
SUBMISSION_PENDING
SUBMITTED
ACKNOWLEDGED
BACKORDERED
REJECTED
CANCELED
PACKING
SHIPPED
DELIVERED
RETURN_REQUESTED
RETURN_AUTHORIZED
RETURNED
REFUNDED
EXCEPTION
```

## 21.4 Fulfillment Grouping

Group by:

- Fulfillment type
- Distributor
- Warehouse
- Shipping method
- Inventory state
- Battery and hazmat restrictions
- Pickup location
- Preorder release date

## 21.5 Release Condition

Default release condition:

```text
verified payment_intent.succeeded
AND amount/currency/order references match
AND risk decision permits fulfillment
AND inventory revalidation passes
AND supplier cost remains within tolerance
AND an active capital reservation covers distributor procurement cost
```

## 21.6 Supplier Submission

Before submission:

1. Confirm fulfillment mode permits execution.
2. Revalidate offer.
3. Revalidate stock.
4. Check supplier-cost tolerance.
5. Verify delivery eligibility.
6. Verify battery restrictions.
7. Verify an active capital reservation covers the current supplier total.
8. Select an eligible warehouse using stock, destination, shipping, delivery, reliability, and battery constraints.
9. Generate an idempotent supplier-order key.
10. Persist the outbound request.
11. Submit through the adapter.
12. Persist the raw response.
13. Parse acknowledgement.
14. Consume or release the capital reservation according to the result.
15. Schedule status polling if webhooks are unavailable.

## 21.7 Supplier Cost Changes

- Automatically proceed only within approved tolerance.
- Never increase a completed customer charge.
- Route material margin losses to operations.
- Permit alternative sourcing.
- Permit line cancellation and refund.
- Record financial impact.

## 21.8 Partial Failure

When one fulfillment group fails:

- Preserve successful groups.
- Mark the failed group `EXCEPTION`.
- Notify operations.
- Attempt documented recovery.
- Offer alternative source, delay, cancellation, or refund.
- Notify the customer accurately.
- Retain unified order tracking.

## 21.9 Multi-Warehouse Routing

Do not hard-code only an east-to-west fallback.

For every supplier group, rank eligible warehouses by:

- Available quantity
- Destination region
- Shipping cost
- Delivery estimate
- Supplier reliability
- Battery and air eligibility
- Restricted-state or restricted-region rules
- Preferred warehouse order
- Current warehouse data freshness

Reject warehouses that cannot fulfill the complete atomic quantity unless split fulfillment is explicitly permitted.

Persist the ranked candidates, rejection reasons, selected warehouse, and algorithm version before supplier submission.

## 21.10 Capital Reservation Lifecycle

Capital reservation states:

```text
ACTIVE
CONSUMED
RELEASED
EXPIRED
```

Rules:

- Reserve before queueing supplier submission.
- Use a unique order and PaymentIntent relationship.
- Consume after supplier acknowledgement or the configured irreversible supplier step.
- Release after supplier rejection, cancellation, timeout, or approved manual intervention.
- Recalculate capital after every reservation transition.
- Never create a second active reservation for the same order.

---

# 22. Shipping and Lithium-Battery Compliance

Store product-level attributes:

- Lithium-ion battery
- Lithium-metal battery
- Packed with equipment
- Contained in equipment
- Standalone battery
- Watt-hour rating
- Lithium content
- UN classification
- UN 38.3 test-summary reference
- Damaged, defective, or recalled state
- Air eligibility
- Ground-only state
- International eligibility
- Required marks
- Required labels
- Packaging rules
- Carrier restrictions

Rules:

- Do not treat all electronics or batteries identically.
- Block unsupported shipping services.
- Store the compliance decision used for the shipment.
- Send missing-data cases to operations.
- Identify contractually who acts as shipper for distributor-fulfilled orders.
- Never route damaged, defective, or recalled batteries through ordinary workflows.

---

# 23. Product Compatibility and Unlocked Devices

Store structured compatibility data for:

- Carrier bands
- Lock status
- Region
- eSIM
- Physical SIM
- Voltage
- Connector
- Power delivery
- Laptop model
- CPU socket
- RAM generation
- Storage interface
- GPU clearance
- Case form factor
- Operating-system support

Unlocked-device rules:

- Use manufacturer or distributor source data.
- Store the source and timestamp.
- Explain that carrier compatibility can depend on network bands, carrier rules, plan, region, and activation.
- Do not promise universal carrier compatibility.

---

# 24. Tax System

## 24.1 Tax Calculation

Use Stripe Tax or another approved tax provider.

Support:

- Product tax codes
- Customer destination
- Shipping taxability
- Discounts
- Refund adjustments
- Exempt customers
- Registration state
- Jurisdiction reports
- Reconciliation evidence

## 24.2 Nexus Registry

Track per jurisdiction:

- State
- Measurement period
- Gross sales
- Taxable sales
- Applicable transaction count
- Physical presence
- Inventory presence
- Registration status
- Threshold source
- Threshold version
- Approaching threshold
- Threshold exceeded
- Collection effective date
- Filing frequency
- Permit number
- Last filed return
- Next filing date

Do not encode one universal threshold.

## 24.3 Checkout Tax Rule

The server must:

1. Determine whether the business is registered for the destination.
2. Calculate through the configured tax engine.
3. Store the tax calculation reference.
4. Include tax in the PaymentIntent amount.
5. Persist the final tax breakdown.
6. Reverse or adjust tax when refunds occur.
7. Reconcile collected tax to filed records.

---

# 25. Louisiana Resale Certificate — Approved State

## 25.1 Current Status

Set the business compliance record to:

```text
LOUISIANA_RESALE_CERTIFICATE_STATUS=APPROVED_ACTIVE
```

Do not use `PENDING`, `NOT_APPLIED`, or `BLOCKED_ON_APPROVAL`.

## 25.2 Required Stored Fields

```ts
interface ResaleCertificateRecord {
  jurisdiction: 'LA';
  certificateType: 'LOUISIANA_RESALE_CERTIFICATE';
  status: 'APPROVED_ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'REVOKED';
  legalBusinessName: string;
  ldrAccountNumber: string;
  locationId?: string;
  certificateNumber?: string;
  approvalDate: string;
  expirationDate: string;
  certificateDocumentRef: string;
  validatedAt?: string;
  validationEvidenceRef?: string;
  renewalState: 'NOT_DUE' | 'AUTO_RENEWAL_EXPECTED' | 'RENEWAL_REQUIRED' | 'SUBMITTED' | 'RENEWED';
}
```

No approval or expiration date may be invented. Populate them from the issued certificate.

## 25.3 Immediate Operational Effect

The approved certificate:

- Removes the Louisiana resale-certificate application blocker.
- Allows it to be supplied to eligible distributors for qualifying resale purchases.
- Enables supplier onboarding workflows that require resale documentation.
- Does not automatically approve a distributor account.
- Does not eliminate sales-tax collection or filing duties on customer sales.
- Does not exempt business-use purchases.
- Does not automatically satisfy another state's resale-document requirements.

## 25.4 Supplier Onboarding Workflow

For each distributor:

1. Upload or submit the approved certificate through the distributor's authorized process.
2. Record submission date.
3. Record distributor approval or rejection.
4. Store the distributor's exemption account reference.
5. Confirm which jurisdictions and purchases the distributor recognizes.
6. Prevent tax-exempt procurement until the distributor accepts the documentation when acceptance is required.
7. Reconcile supplier invoices for unexpected tax charges.
8. Request correction or credit for qualifying resale purchases when appropriate.

## 25.5 Renewal Monitoring

Store the actual expiration date and create:

- 90-day reminder
- 60-day status check
- 45-day renewal action when renewal is required
- 30-day escalation
- Expiration blocker

If the certificate expires:

- Stop representing the credential as active.
- Alert finance and compliance.
- Review supplier tax treatment.
- Prevent new unsupported tax-exempt procurement.
- Preserve historical certificate records.

## 25.6 Use Restriction

The certificate may be used only for qualifying purchases intended for resale.

If inventory is withdrawn for business use:

- Reclassify it.
- Record the withdrawal date and cost.
- Route it to sales/use-tax accounting.
- Preserve an audit record.

---

# 26. Mercury Boundary

Mercury may be used for:

- Business banking
- Deposit reconciliation
- Approved invoice workflows
- Invoice-status retrieval
- Internal finance operations

Mercury is not the default checkout UI.

Do not implement a Mercury iframe until all of these are independently verified:

1. An official hosted payer URL exists.
2. The active API returns it.
3. Mercury permits embedding.
4. Security headers permit framing.
5. Completion can be verified server-side.
6. A test transaction passes.
7. Security review passes.

`sendEmailOption: "DontSend"` must not be interpreted as proof of embedded checkout.

---

# 27. Returns, Refunds, and Warranty

## 27.1 Customer Relationship

The customer works with this business even when the item was distributor fulfilled.

Internal return destinations may include:

- Business warehouse
- Distributor
- Manufacturer
- Repair partner

## 27.2 Return Record

Store:

- Return reason
- Requested lines
- Eligibility result
- Policy version
- Return destination
- RMA
- Label
- Tracking
- Received condition
- Inspection result
- Restocking fee when lawful
- Refund amount
- Refund state
- Supplier credit
- Financial loss

## 27.3 Refund Rules

- Create Stripe refunds server-side.
- Store Stripe refund IDs.
- Do not show completed status before provider confirmation.
- Support line-level refunds.
- Adjust tax and shipping.
- Reconcile supplier credits separately.
- Make refund processing idempotent.
- Handle disputes separately.

## 27.4 Warranty

Display:

- Warranty provider
- Duration
- Coverage summary
- Registration requirement
- Exclusions
- Claim path
- Source
- Last verified timestamp

---

# 28. Security

## 28.1 Secrets

- Store secrets server-side.
- Use a secret manager.
- Rotate credentials.
- Scope permissions.
- Separate test and production.
- Never commit secrets.
- Never expose supplier or Stripe secret keys to the browser.
- Redact secrets and client secrets from logs.

## 28.2 Roles

```text
CUSTOMER
SUPPORT_AGENT
OPERATIONS
MERCHANDISER
FRAUD_REVIEWER
FINANCE
COMPLIANCE
ADMIN
SYSTEM
```

Apply least privilege.

## 28.3 Payment Security

- Use Stripe.js and supported Stripe UI components.
- Verify webhook signatures.
- Enforce HTTPS.
- Protect checkout mutations.
- Rate-limit sensitive endpoints.
- Prevent duplicate submission.
- Never store raw card or bank credentials.

## 28.4 Application Security

- Input validation
- Output encoding
- Content Security Policy
- Secure cookies
- Session rotation
- Admin MFA
- Dependency scanning
- Secret scanning
- Static analysis
- Dynamic testing
- Audit logging
- Backup testing
- Restore testing
- Incident response

---

# 29. Observability and Audit

Use correlation IDs across:

- Session
- Checkout
- PaymentIntent
- Stripe event
- Order
- Fulfillment group
- Supplier purchase order
- Shipment
- Return
- Refund

Required metrics:

- Checkout conversion
- Payment success
- Payment processing duration
- Payment failure
- Webhook signature failure
- Webhook duplicate rate
- Webhook processing latency
- Webhook dead-letter count
- Inventory freshness
- Supplier submission success
- Supplier acknowledgement latency
- Oversell incidents
- Margin exceptions
- Fraud review rate
- Tax calculation failures
- Shipment exception rate
- Refund rate
- Return rate

Audit events must be append-only for:

- Price changes
- Promotion overrides
- Payment state changes
- Risk decisions
- Fulfillment releases
- Supplier submissions
- Cancellations
- Refunds
- Tax-record changes
- Resale-certificate changes
- Admin permission changes

---

# 30. Suggested API Surface

```text
GET    /api/products
GET    /api/products/:slug
GET    /api/search
POST   /api/carts
GET    /api/carts/:cartId
POST   /api/carts/:cartId/lines
PATCH  /api/carts/:cartId/lines/:lineId
DELETE /api/carts/:cartId/lines/:lineId
POST   /api/checkouts
POST   /api/checkouts/:checkoutId/reprice
POST   /api/checkouts/:checkoutId/payment-intent
POST   /api/pricing/evaluate
POST   /api/pricing/batches
GET    /api/admin/pricing/decisions/:productId
POST   /api/admin/orders/:orderId/release
GET    /api/admin/capital
GET    /api/orders/:orderId
GET    /api/orders/:orderId/tracking
POST   /api/orders/:orderId/returns
POST   /api/webhooks/stripe
POST   /api/webhooks/mercury
POST   /api/webhooks/distributors/:providerKey
GET    /api/admin/webhooks/stripe
POST   /api/admin/webhooks/stripe/:eventId/replay
GET    /api/admin/fulfillment/exceptions
GET    /api/admin/compliance/resale-certificate
PATCH  /api/admin/compliance/resale-certificate
```

---

# 31. Background Jobs

```text
catalog-full-sync
catalog-incremental-sync
inventory-refresh
offer-revalidation
competitor-price-import
competitive-pricing-evaluation
listing-source-publication
checkout-expiration
stripe-event-processing
payment-reconciliation
mercury-capital-snapshot
capital-release-evaluation
capital-reservation-expiration
fulfillment-planning
warehouse-routing
supplier-order-submission
supplier-order-status-sync
shipment-status-sync
supplier-exception-recovery
customer-notification
tax-reconciliation
nexus-monitoring
refund-reconciliation
resale-certificate-renewal-monitor
audit-retention
privacy-deletion
```

All jobs require:

- Idempotency
- Retry policy
- Backoff
- Dead-letter handling
- Observability
- Manual replay
- Correlation IDs

---

# 32. Acceptance Tests

## 32.1 Catalog and Inventory

1. Provider data normalizes without deleting the raw payload.
2. Disabled distributors disappear without breaking the catalog.
3. Stale inventory is refreshed before checkout.
4. Provider outage produces `STALE` or `UNKNOWN`.
5. Out-of-stock items cannot complete checkout.
6. Supplier offer changes are audited.
7. Content-rights restrictions are enforced.

## 32.2 Search and Merchandising

8. Exact model queries prioritize exact models.
9. Owned-product boost increases eligible exposure.
10. Irrelevant owned products cannot replace exact matches.
11. Sponsored placements are labeled.
12. Non-personalized mode works.
13. Ranking decisions store reason codes.
14. Experiments can be disabled.

## 32.3 Cart and Pricing

15. Owned and distributor items coexist in one cart.
16. Browser price manipulation does not change the charged amount.
17. Price increases require acknowledgement.
18. Quantity is revalidated.
19. Promotions recalculate server-side.
20. Cart merge does not duplicate identical variants.
21. Expired checkout snapshots cannot be charged.

## 32.4 Stripe PaymentIntent

22. PaymentIntent amount equals the persisted checkout revision.
23. Duplicate PaymentIntent requests do not create duplicate charges.
24. Secret keys never reach the browser.
25. Client secrets are not logged or embedded in URLs.
26. Failed payment leaves the order unpaid.
27. `processing` leaves the order unfulfilled.
28. Frontend success cannot mark the order paid.
29. Amount or currency mismatch creates a reconciliation hold.

## 32.5 Stripe Webhooks

30. Missing signature is rejected.
31. Invalid signature is rejected.
32. Valid event is accepted.
33. Duplicate event ID is processed once.
34. Replayed event is idempotent.
35. Out-of-order events do not corrupt state.
36. Handler queues work and returns promptly.
37. `payment_intent.succeeded` releases an eligible owned order.
38. `payment_intent.succeeded` queues distributor groups for capital evaluation but does not submit them.
39. Risk hold prevents fulfillment after payment success.
40. `payment_intent.processing` does not submit supplier orders.
41. `payment_intent.payment_failed` does not fulfill.
42. Refund events reconcile once.
43. Dispute events open or update one case.
44. Dead-letter replay succeeds without duplicate fulfillment.

## 32.6 Fulfillment

45. Owned lines create internal tasks.
46. Distributor lines group by provider.
47. Supplier-order submissions use idempotency keys.
48. Supplier stock is revalidated after payment and before submission.
49. Supplier price change within tolerance proceeds.
50. Material cost change enters exception.
51. One group can fail without corrupting successful groups.
52. Customer tracking shows shipment-level status.
53. No shipment is represented before acknowledgement or shipment evidence.

## 32.7 Fraud

54. High-value rules can create `FULFILLMENT_HOLD`.
55. Reviewer approval releases the order once.
56. Rejection prevents fulfillment.
57. Refund and cancellation preserve audit history.
58. Unauthorized staff cannot approve fraud review.

## 32.8 Tax and Resale Certificate

59. Tax is calculated server-side.
60. Tax record matches the PaymentIntent total.
61. Refund adjusts the tax record.
62. Nexus thresholds are jurisdiction-specific.
63. Louisiana certificate state is `APPROVED_ACTIVE`.
64. Certificate approval and expiration dates cannot be blank in production.
65. Certificate document reference is required.
66. Expired certificate cannot be represented as active.
67. Business-use withdrawal triggers use-tax accounting.
68. Supplier onboarding records certificate submission and acceptance independently.

## 32.9 Privacy, Security, and Trust

69. Optional personalization can be disabled.
70. Advertising consent is respected.
71. Raw payment data never reaches application logs.
72. Supplier credentials never reach the browser.
73. Seller, return, warranty, and delivery information are visible.
74. Fake scarcity and unlabeled sponsorship are absent.
75. Admin MFA and role enforcement pass.
76. Privacy deletion workflow is testable.


## 32.10 Competitive Pricing and Listing Selection

77. Unauthorized scraping is not an available competitor source.
78. Stale competitor observations are rejected.
79. Wrong-condition and out-of-stock competitor observations are rejected.
80. The weighted market position is not controlled by one low-trust outlier.
81. Minimum viable price protects target margin.
82. Minimum viable price protects minimum contribution.
83. MAP is enforced independently of the profit floor.
84. A market price below the protected floor cannot trigger a lower published price.
85. A floor above the market ceiling suppresses the supplier offer.
86. Post-rounding economics are revalidated.
87. Price-decrease limits prevent uncontrolled repricing loops.
88. Fresh supplier offers are evaluated independently.
89. The selected supplier offer is deterministic for the same inputs.
90. No viable supplier offer produces `SUPPRESSED_NO_VIABLE_SOURCE`.
91. Pricing decisions preserve input hashes, reason codes, and algorithm version.
92. Checkout repricing cannot charge a stale published price.

## 32.11 Capital-Insulated Fulfillment

93. `payment_intent.succeeded` alone cannot submit a distributor order.
94. `payment_intent.processing` remains blocked.
95. Stripe available balance is not counted as Mercury spendable cash by default.
96. Mercury available balance excludes pending incoming funds from automatic release.
97. Distributor credit can be combined with Mercury available balance when approved.
98. Active capital reservations reduce spendable capital.
99. Pending supplier debits reduce spendable capital.
100. Operating safety buffer reduces spendable capital.
101. Insufficient capital routes the order to `AWAITING_AVAILABLE_CAPITAL`.
102. A low-capital alert is emitted once per state transition.
103. One order can have only one active capital reservation.
104. Duplicate webhooks reuse the reservation.
105. Manual mode never calls the supplier API automatically.
106. Capital-gated automatic mode submits only after all gates pass.
107. ACH policy hold blocks supplier ordering until released.
108. Supplier rejection releases the capital reservation.
109. Supplier acknowledgement consumes the reservation at the configured irreversible step.
110. Mercury webhook replay does not duplicate a supplier order.
111. Warehouse routing falls back when the preferred warehouse has no stock.
112. Battery restrictions exclude an otherwise cheaper warehouse.
113. No eligible warehouse routes the group to an exception queue.

---

# 33. Required Build Sequence

## Increment 1 — Foundation

- Repository
- Environment validation
- Database
- Authentication
- Roles
- Audit
- Logging
- Queue
- Test harness

## Increment 2 — Catalog

- Canonical schema
- Provider registry
- One distributor adapter
- Raw payload storage
- Normalization
- Inventory sync
- Provider health

## Increment 3 — Storefront

- Homepage
- Search
- Category
- Product page
- Cart
- Responsive design
- Accessibility baseline

## Increment 4 — Pricing and Tax

- Integer-money pricing engine
- Authorized competitor-price ingestion
- Robust market-position calculation
- Margin and contribution floors
- Listing-source selection
- Price publication and suppression
- Margin rules
- Promotions
- Tax calculation
- Checkout snapshots
- Louisiana approved-certificate record

## Increment 5 — Stripe

- Payment Element
- Server-priced PaymentIntent
- Stripe webhook endpoint
- Signature verification
- Durable event inbox
- Queue processing
- Payment state machine
- Local Stripe CLI tests

## Increment 6 — Fulfillment

- Order creation
- Fulfillment grouping
- Manual mode
- Capital-gated automatic mode
- Mercury capital snapshots
- Capital reservations
- Multi-warehouse routing
- Internal fulfillment
- Distributor submission
- Supplier status
- Partial failure
- Shipment tracking

## Increment 7 — Fraud and Operations

- Risk rules
- Review queue
- Fulfillment hold
- Exception queues
- Reconciliation
- Alerting

## Increment 8 — Personalization

- Telemetry
- Consent
- Search ranking
- Recommendations
- Owned-product boost
- Advertising
- Experiments

## Increment 9 — Returns and Compliance

- Returns
- Refunds
- Warranty
- Battery rules
- Nexus monitor
- Filing records
- Certificate renewal monitor

## Increment 10 — Production Verification

- Stripe test suite
- Distributor sandbox
- Security test
- Accessibility test
- Load test
- Backup restore
- Incident runbook
- Production readiness gate

---

# 34. Audit Findings

## 34.1 Retained Requirements

The final specification preserves:

- Premium electronics retail focus
- Attention and engagement orientation
- Personalized telemetry
- Contextual advertising
- Heavy promotion of owned products
- Distributor API inventory
- Inventory validation
- Automatic distributor routing
- High-ticket fraud controls
- Lithium-battery handling
- Compatibility disclosure
- Trust and sensory design
- Nationwide sales-tax monitoring
- Approved Louisiana resale certificate
- Stripe PaymentIntents
- Stripe backend webhooks
- Competitive pricing and listing-source selection
- Capital-insulated supplier ordering
- Manual-to-automatic fulfillment transition
- Internal and distributor fulfillment
- Test-driven delivery

## 34.2 Corrected Requirements

Corrected:

- Affiliate-shell model changed to distributor API–first direct retail.
- External retailer checkout changed to unified Stripe checkout.
- Browser payment success changed to backend webhook authority.
- Mercury iframe claims removed.
- Universal tax-threshold assumptions removed.
- Fraud tools described as risk reduction, not guarantees.
- Resale certificate changed from onboarding prerequisite to approved active credential.
- Certificate use limited to qualifying resale purchases.
- Distributor order routing occurs only after verified payment, risk release, inventory validation, capital availability, and an active reservation.
- `payment_intent.succeeded` is separated from bank spendability.
- Competitor acquisition is limited to authorized or licensed sources rather than unrestricted scraping.

## 34.3 Provider-Dependent Boundaries

Still required before production:

- Chosen distributor contracts
- Official distributor documentation
- Distributor credentials
- Distributor sandbox or approved test environment
- Stripe account configuration
- Enabled Stripe payment methods
- Stripe webhook endpoint secret
- Tax-provider configuration
- State registrations
- Actual resale certificate fields and document
- Shipping-carrier agreements
- Return and warranty policies
- Product-media rights
- Final brand system

---

# 35. Final Execution Directive

Build this application as a verification-first commerce system.

Never substitute convincing prose for a working integration.

Never claim:

- Payment success without a verified server event.
- Supplier acceptance without an acknowledgement.
- Shipment without tracking or provider evidence.
- Tax compliance without configured registrations and jurisdiction data.
- Active resale status without the actual certificate record.
- Inventory availability from stale data.
- Provider capability without documentation or a passing test.

The final system is a premium electronics retailer with one Stripe purchase flow, webhook-authoritative payment state, internal and distributor fulfillment, personalized merchandising, contextual advertising, strong fraud controls, transparent customer policies, and auditable nationwide operations.

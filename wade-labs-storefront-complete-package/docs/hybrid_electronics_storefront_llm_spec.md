# Hybrid Electronics Storefront — LLM Objective and Build Specification

## 1. Objective

Build a premium, high-engagement retail website for high-end electronics and accessories.

The website is a **hybrid storefront and commerce-routing layer**:

1. It presents products from approved third-party retailers and affiliate/catalog partners inside one branded discovery experience.
2. It also sells the store owner’s own inventory directly.
3. It maintains one local cart interface for the customer.
4. At checkout, it routes each item to the checkout system belonging to the item’s actual seller.
5. It must never imply that the site is the merchant, seller, payment processor, or fulfillment provider for a third-party item when it is not.

The primary value of the site is discovery, comparison, personalization, merchandising, and conversion routing—not fulfillment of third-party products.

---

## 2. Business Model

The catalog contains two distinct product classes.

### A. First-Party Products

Products owned and sold directly by this business.

For these products:

- This business is the seller and merchant of record.
- The site controls pricing, inventory, promotions, checkout, payment status, order records, support, returns, and fulfillment messaging.
- These products receive the strongest permitted merchandising priority.
- Payment is processed only through an approved first-party payment integration.
- Mercury invoicing may be used only through capabilities explicitly supported by Mercury’s current API and account configuration.
- Do not assume that Mercury returns an embeddable checkout URL or permits iframe checkout unless this is verified in official documentation or a working integration test.
- If hosted embedding is unsupported, use a supported hosted-payment redirect or another approved processor.
- Never expose API credentials to the browser.

### B. Third-Party Products

Products supplied by Amazon, Best Buy, or another approved retailer, affiliate network, commerce API, or product-data provider.

For these products:

- The third-party retailer remains the seller, merchant of record, payment processor, and fulfillment provider.
- Product content must come from approved APIs, feeds, or affiliate tools.
- Prices, availability, descriptions, images, promotions, attribution, and branding must follow the provider’s current terms.
- The site may maintain a local representation of the item in its cart.
- Checkout must transfer or redirect the user to the retailer’s approved checkout or product flow.
- Preserve the selected item, quantity, variation, and affiliate attribution when the provider supports cart transfer, deep linking, or commerce APIs.
- When cart transfer is not supported, route the user to the most specific permitted product or offer page and clearly explain that checkout continues with the retailer.
- Never scrape, clone, impersonate, or bypass a retailer’s checkout.

---

## 3. Core User Experience

The site should feel like a polished premium electronics retailer rather than a directory of affiliate links.

The customer should be able to:

1. Browse a unified product catalog.
2. Search by natural language, category, brand, model, specification, use case, compatibility, price, condition, availability, and seller.
3. Compare first-party and third-party products.
4. See accurate seller attribution on every product.
5. Add eligible products from multiple sellers to one local cart.
6. Understand which seller will process each item before checkout.
7. Complete first-party purchases through the site’s approved payment flow.
8. Continue third-party purchases through each retailer’s approved checkout.
9. Return to the site after an external checkout without losing unresolved cart groups when technically possible.

The design should maximize attention, relevance, trust, product discovery, and conversion without using deception, fabricated scarcity, hidden sponsorship, forced continuity, or misleading checkout behavior.

---

## 4. Product Ranking and Merchandising

Create a ranking engine that determines which products and modules appear in search results, category pages, recommendations, advertising slots, and homepage sections.

### Ranking Inputs

Use a weighted combination of:

- Query relevance
- Category relevance
- Product quality
- Price competitiveness
- Availability
- Shipping or pickup availability when supplied
- Compatibility with products already viewed or selected
- Current promotions
- Review quality and review volume when licensed
- Click-through rate
- Add-to-cart rate
- Checkout-start rate
- Conversion signals available through approved attribution
- Return or cancellation signals for first-party products
- User preferences
- Session intent
- Device type
- Geographic market at a non-invasive level
- Recency and freshness of product data
- Seller reliability
- Commercial priority

### First-Party Promotion Rule

First-party products should receive the strongest commercial promotion, but ranking must remain defensible and useful.

Apply a configurable `first_party_boost` only after minimum eligibility checks:

- Relevant to the user’s query or current context
- In stock or explicitly marked as preorder/backorder
- Competitively presented
- Compatible with the requested use case
- Not materially inferior in a way hidden from the user
- Clearly labeled as sold by this business

Do not silently replace an objectively better exact-match result with an unrelated first-party product.

Use explicit placements such as:

- Featured by Us
- Our Pick
- Sold Directly by [Store Name]
- Exclusive Offer
- Staff Recommendation

Sponsored, promoted, or commercially prioritized placements must be labeled.

### Ranking Controls

The ranking service must support:

- Adjustable weights
- First-party promotion caps
- Category-specific rules
- Seller diversity
- Frequency caps
- Cold-start defaults
- Anonymous-session behavior
- Logged-in personalization
- A/B testing
- Explainable ranking logs
- Manual merchandising overrides
- Rollback to a deterministic baseline

---

## 5. Personalization and Telemetry

Use telemetry to personalize product discovery, not to conceal seller identity or manipulate checkout.

### Collectable Events

Subject to consent and applicable law, the event model may include:

- Page view
- Product impression
- Product click
- Search query
- Filter use
- Sort choice
- Comparison action
- Wishlist action
- Add to cart
- Remove from cart
- Quantity change
- Checkout start
- Seller handoff
- First-party payment completion
- External return callback
- Promotion impression
- Promotion click
- Dismissal
- Session duration
- Device and viewport class
- Coarse location or market
- Referral source
- Error and performance telemetry

### Data Rules

- Use first-party identifiers where possible.
- Obtain consent before optional personalization or advertising tracking.
- Provide a functional non-personalized experience.
- Minimize collected data.
- Define retention periods.
- Do not collect raw payment credentials.
- Do not log secrets, full card data, bank credentials, authentication tokens, or sensitive form values.
- Separate operational telemetry from advertising telemetry.
- Provide opt-out and deletion controls where required.
- Record why each recommendation was generated.
- Support anonymous preference profiles without requiring an account.

### Personalization Outputs

Personalization may influence:

- Homepage hero products
- Category ordering
- Search result ranking
- Recommended accessories
- Compatibility bundles
- Recently viewed products
- Price-band emphasis
- Brand emphasis
- Promotional banners
- Ad selection
- Email or notification recommendations after consent

---

## 6. Advertising System

Ads must look native to the visual system but remain clearly identifiable as advertising or sponsored placement.

Ad selection should consider:

- Current product or category context
- User intent
- Compatibility
- Price range
- Seller
- Inventory and availability
- Frequency caps
- Campaign dates
- User consent
- Excluded categories
- Brand-safety rules

Ads must not:

- Imitate system alerts
- Disguise themselves as neutral rankings
- Misrepresent discounts
- Claim false urgency
- Obscure the seller
- Conflict with the product being viewed
- Redirect through unapproved tracking chains

---

## 7. Unified Cart Model

The local cart is an orchestration layer, not necessarily the final cart of every retailer.

Every cart line must contain:

- Local cart-line ID
- Product ID
- Source provider
- Seller type: `FIRST_PARTY` or `THIRD_PARTY`
- Seller name
- Merchant-of-record disclosure
- Product title
- Selected variant
- Quantity
- Display price
- Currency
- Last price-check time
- Availability status
- Affiliate or campaign attribution
- External product ID
- External offer ID when available
- Checkout capability
- Checkout destination
- Fulfillment summary
- Tax and shipping estimate status
- Expiration or refresh time

### Checkout Capability Values

Use one of:

- `FIRST_PARTY_NATIVE`
- `PARTNER_CART_TRANSFER`
- `PARTNER_COMMERCE_API`
- `PARTNER_PRODUCT_DEEPLINK`
- `UNAVAILABLE`

The system must never claim a stronger capability than the provider actually supports.

---

## 8. Checkout Router

When the user selects Checkout:

1. Refresh price and availability for all items.
2. Identify the seller and checkout capability for each line.
3. Group items by merchant and checkout destination.
4. Present a checkout review that clearly shows:
   - Items sold by this business
   - Items sold by each external retailer
   - Which payments will be separate
   - Which seller handles shipping, returns, taxes, support, and fulfillment
5. Require the user to acknowledge material price or availability changes.
6. Process each group through the correct adapter.
7. Preserve unresolved groups if the user completes only part of the sequence.

### First-Party-Only Cart

- Use the approved first-party checkout adapter.
- Create the payment or invoice server-side.
- Store an idempotency key.
- Verify completion through a signed provider event, verified polling result, or another supported server-side confirmation.
- Never mark an order paid based only on a browser redirect.
- Display a normal branded checkout shell only where the provider explicitly permits it.

### Third-Party-Only Cart

For each retailer:

- Use an approved cart-transfer or commerce API when available.
- Otherwise use an approved affiliate deep link.
- Preserve item, quantity, variant, and attribution where supported.
- Clearly state that checkout continues with the named retailer.
- Do not collect payment details for third-party items.

### Mixed Cart

A mixed cart cannot be represented as one payment unless every participating merchant explicitly supports a shared marketplace transaction.

Default mixed-cart behavior:

1. Split the cart into merchant groups.
2. Show a single checkout plan before starting.
3. Process the first-party group through the native first-party checkout.
4. After first-party payment is successfully confirmed, guide the customer through each third-party retailer group.
5. Open only one external checkout destination at a time.
6. Preserve all unfinished groups in the local cart.
7. Mark external items as `HANDED_OFF`, not `PURCHASED`, unless the retailer provides a verified conversion or order callback.
8. Display separate receipts and support responsibilities.
9. Never charge the customer for a third-party item through the first-party payment processor.
10. Never imply that all items were purchased merely because the first-party group was paid.

The checkout order must be configurable. The initial default is first-party checkout followed by third-party retailer handoffs.

---

## 9. Mercury Integration Boundary

Treat Mercury as an invoice/accounting integration unless official capabilities prove a broader embedded-checkout role.

The implementation must:

- Call Mercury only from the server.
- Use the current official API base URL and request schema.
- Create or retrieve the required Mercury customer record.
- Include required invoice fields.
- Use `sendEmailOption: "DontSend"` only when suppressing Mercury’s automatic invoice email is appropriate and permitted.
- Configure ACH debit and credit card options using the current documented fields.
- Account for the requirement that card acceptance may depend on a connected Stripe account.
- Store Mercury invoice IDs and status.
- Verify payment status server-side.
- Handle failed, expired, canceled, duplicated, and partially completed attempts.
- Avoid presenting unsupported payment methods.
- Avoid claiming that funds bypass all middlemen when card processing depends on another processor.
- Avoid claiming zero security risk.
- Use accurate language: isolating payment fields can reduce PCI exposure, but security and compliance obligations still remain.

Before implementing an iframe:

1. Confirm that Mercury provides a hosted payer URL.
2. Confirm that the page permits framing through its security headers.
3. Confirm that Mercury authorizes this use.
4. Confirm supported browser payment methods.
5. Confirm completion callbacks or status-verification mechanics.
6. Pass an automated integration test.

If any condition fails, use a supported redirect or replace the adapter with an approved checkout provider.

---

## 10. Provider Adapter Architecture

Do not hard-code Amazon, Best Buy, or Mercury behavior directly into page components.

Create adapters with these interfaces:

```ts
interface CatalogProvider {
  search(input: SearchInput): Promise<ProductResult[]>;
  getProduct(id: string): Promise<ProductDetail>;
  refreshOffer(input: OfferRefreshInput): Promise<OfferStatus>;
}

interface CheckoutProvider {
  getCapability(lines: CartLine[]): Promise<CheckoutCapability>;
  createHandoff(lines: CartLine[], context: CheckoutContext): Promise<CheckoutHandoff>;
  verifyStatus(reference: string): Promise<CheckoutStatus>;
}

interface PaymentProvider {
  createPaymentSession(order: FirstPartyOrder): Promise<PaymentSession>;
  verifyPayment(reference: string): Promise<PaymentStatus>;
  cancelPayment(reference: string): Promise<void>;
}
```

Each adapter must declare:

- Supported regions
- Supported currencies
- Supported product data
- Cart-transfer support
- Quantity support
- Variant support
- Authentication requirements
- Attribution requirements
- Cache limits
- Rate limits
- Branding requirements
- Checkout behavior
- Error behavior
- Test mode availability

---

## 11. Visual and Sensory Direction

The site should communicate:

- Premium quality
- Technical competence
- Speed
- Clarity
- Security
- Product excitement
- Credibility

Use:

- High-resolution product imagery from authorized sources
- Strong visual hierarchy
- Clean motion and micro-interactions
- Fast predictive search
- Specification-first product pages
- Comparison tools
- Compatibility indicators
- Clear pricing and seller labels
- Personalized but stable layouts
- Accessible contrast and typography
- Responsive mobile and desktop behavior
- Performance budgets for images, scripts, recommendations, and ads

Avoid:

- Visual imitation of Amazon or Best Buy
- Misleading badges
- Fake reviews
- Fake countdowns
- Hidden fees
- Excessive popups
- Layout shifts caused by ads
- Auto-playing sound
- Confusing seller identity
- Unlabeled promotion
- Dark-pattern checkout

---

## 12. Trust Requirements

Every product page and cart line must answer:

- Who sells this item?
- Who receives payment?
- Who ships or fulfills it?
- Who handles returns?
- Is the price current?
- Is the item in stock?
- Is this placement sponsored or promoted?
- Will checkout remain here or continue elsewhere?

Include:

- Affiliate disclosure
- Seller attribution
- Privacy controls
- Cookie and tracking controls
- Clear terms
- Return and support ownership
- Secure-connection indicators
- Contact information
- Accurate warranty source
- Last-updated times where useful

Trust is a conversion feature and must not be sacrificed to make the site appear to be the retailer of products it does not sell.

---

## 13. Non-Goals

Do not build:

- A fake Amazon or Best Buy checkout
- A shared payment transaction for unrelated merchants
- A scraper that republishes protected catalog content
- A system that stores third-party product data beyond permitted limits
- A browser flow that injects products into retailer carts without authorization
- A checkout that hides the merchant of record
- A payment iframe based on an unverified URL
- A system that marks affiliate handoffs as completed purchases without confirmation
- A ranking system that hides sponsorship
- Telemetry that collects more data than required
- A site whose only behavior is opening generic affiliate links

---

## 14. Functional Acceptance Tests

The build is not complete until these tests pass.

### Catalog

- Search returns products from enabled providers.
- Every product displays source, seller, current price timestamp, and checkout behavior.
- Expired cached data is refreshed or clearly marked.
- Disabled providers disappear without breaking the site.

### Ranking

- Exact query relevance remains functional with first-party boosting enabled.
- First-party products receive measurable promotion.
- Sponsored placements are labeled.
- Ranking decisions are logged.
- Non-personalized mode works.

### Cart

- First-party, Amazon, Best Buy, and unsupported-provider lines can coexist locally.
- Price changes are detected.
- Unavailable items block or modify checkout correctly.
- Merchant grouping is deterministic.
- Removing one merchant group does not corrupt the others.

### First-Party Checkout

- API credentials never reach the browser.
- Duplicate clicks do not create duplicate charges or invoices.
- Payment success is verified server-side.
- Failed payment leaves the order unpaid.
- Cancellation and retry work.
- No raw payment credential appears in logs.

### Third-Party Handoff

- Attribution survives the handoff where supported.
- The correct item, quantity, and variant are transferred where supported.
- Unsupported cart transfer falls back to an approved product link.
- The interface identifies the retailer before redirecting.
- External handoff is not recorded as a completed sale without evidence.

### Mixed Checkout

- The customer sees all merchant groups before payment.
- First-party items are never sent to a third-party checkout.
- Third-party items are never charged through the first-party processor.
- Completing one group preserves unfinished groups.
- Each group has separate status and receipt handling.
- Returning from an external retailer restores the remaining plan.

### Privacy and Trust

- Tracking consent controls work.
- Personalization can be disabled.
- Affiliate and sponsored disclosures are visible.
- Seller identity is visible on product, cart, and checkout screens.
- Deletion and retention jobs are testable.
- Accessibility checks pass.

---

## 15. LLM Execution Directive

Act as a senior product engineer, commerce architect, UX designer, and verification lead.

Build the system described above in small, testable increments.

For every increment:

1. Lock the exact behavior.
2. Identify provider capabilities from current official documentation.
3. Refuse to invent unsupported API fields or checkout behavior.
4. Implement the smallest complete vertical slice.
5. Add automated tests.
6. Run the tests.
7. Report exact files changed, commands run, verification results, and remaining provider boundaries.
8. Do not claim checkout success until a real sandbox or approved test integration confirms it.
9. Keep provider-specific behavior behind adapters.
10. Preserve transparent seller identity throughout the user journey.

The final product must operate as a premium electronics discovery and commerce-routing storefront with first-party sales, third-party affiliate commerce, personalized merchandising, contextual advertising, and explicit split checkout.

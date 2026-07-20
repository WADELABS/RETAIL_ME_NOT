# Storefront Pricing and Capital Engine

A dependency-free reference implementation for:

- Competitive price normalization
- Margin and contribution floors
- Supplier-offer/listing-source selection
- Race-to-the-bottom suppression
- Manual-to-automatic fulfillment transition
- Mercury available-balance and distributor-credit gating
- Capital reservations
- Multi-warehouse routing

## Run

```bash
npm test
npm run demo
```

## Operational Modes

```text
FULFILLMENT_MODE=MANUAL
FULFILLMENT_MODE=CAPITAL_GATED_AUTO
```

`MANUAL` always routes paid orders to an administrator. `CAPITAL_GATED_AUTO` queues supplier ordering only after verified payment, risk clearance, inventory validation, and an idempotent capital reservation.

## Payment-versus-capital boundary

`payment_intent.succeeded` means the payment succeeded. It does not prove that the same amount is already spendable from the business bank account. The engine therefore treats these as separate gates:

1. Stripe payment gate
2. Risk and reconciliation gate
3. Mercury `availableBalance`/approved credit gate
4. Capital reservation
5. Supplier-order queue

Stripe balance is excluded from spendable capital unless the configured supplier payment method can directly use it. Default: excluded.

## Competitor-data boundary

Only ingest competitor observations from authorized APIs, licensed feeds, approved exports, or manual evidence. The engine does not implement unauthorized scraping.

## Pricing decision

For each supplier offer, the engine computes:

- All-in acquisition cost
- Margin floor
- Minimum-contribution floor
- MAP floor
- Robust competitor market position
- Premium tolerance ceiling
- Expected contribution and margin
- Supplier score based on contribution, reliability, stock, and delivery

The highest-scoring viable supplier offer becomes the active listing source. If no offer can meet the floor within the competitive ceiling, the product is suppressed.
